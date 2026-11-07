import { useEffect, useMemo, useRef, useState } from 'react';
import * as Comlink from 'comlink';
import { directoryOpen, directoryOpenLegacy } from 'browser-fs-access';
import type { FileRecord, Progress } from './engine/types';
import type { SetAsideGroup } from './engine/summary';
import { summarize } from './engine/summary';
import { handOver } from './engine/handoff';
import type { ScanApi } from './worker/scan.worker';
// Bundled into the page itself, so the app is a single self-contained file set.
import ScanWorker from './worker/scan.worker.ts?worker&inline';
import { SAMPLES_ENABLED, loadSamples } from './sample';
import { Header } from './ui/Header';
import { Results } from './ui/Results';
import { Timeline } from './ui/Timeline';
import { Save } from './ui/Save';
import { InfoPage } from './ui/InfoPage';
import { Selection } from './ui/timeline';
import { copy } from './ui/copy';
import { withPickedFolder } from './ui/recoveryFolder';
import { progressFor, type ScanRun } from './ui/scanRun';
import type { RecoveryRoot } from './ui/recoveryFolder';
import { canUseFolderPicker, inFrame } from './ui/embedded';
import { NOTE_DELAY_MS, shownNote } from './ui/liveNote';
import { dropUnusedThumbs } from './ui/thumbs';
import { dropUnusedHeicPreviews } from './ui/heicPreview';
import { HeroGrain } from './ui/HeroGrain';
import { BlankPrint, EyeOffIcon, FileCheckIcon, FolderOpenIcon, LockIcon, Prints, StageIcon, UserXIcon } from './ui/icons';

const dropUnusedPreviews = () => { dropUnusedThumbs(); dropUnusedHeicPreviews(); };

type Screen =
  /** `noteKey` changes on every note, so the same note twice is announced twice. */
  | { name: 'start'; note?: string; noteKey?: number }
  | { name: 'scanning'; progress: Progress }
  /** `fresh`: just arrived from scanning, so the big number counts up (once). */
  | { name: 'results'; fresh?: boolean }
  | { name: 'review' }
  /** Step 4: save new copies of the selected files (T25). */
  | { name: 'save'; ids: number[] }
  | { name: 'error' }
  /** The privacy page or the PhotoRec guide, from the start screen (T67). */
  | { name: 'info'; page: InfoName };

type InfoName = 'privacy' | 'guide';

/** Files the operating system adds to folders; they're not part of the recovery. */
const isOsClutter = (name: string) => name.startsWith('.') || /^(thumbs\.db|desktop\.ini)$/i.test(name);
/** The title the page loaded with ("Keepsake", or "Keepsake (test)" in the test build). */
const APP_TITLE = (typeof document !== 'undefined' && document.title) || copy.appName;
const pathOf = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'start' });
  const [files, setFiles] = useState<File[]>([]);
  // The recovery folder's own handle (Chromium's folder picker only), so Save can refuse it (T55).
  const [recoveryRoot, setRecoveryRoot] = useState<RecoveryRoot | undefined>(undefined);
  const [records, setRecords] = useState<FileRecord[]>([]);
  // Which scan `records` came from (its run id, never reused while the page is open). FileRecord.index
  // restarts at 0 with every scan, so Save keys what it remembers across visits by this too (T89).
  const [scanId, setScanId] = useState(0);
  const [movedBack, setMovedBack] = useState<ReadonlySet<SetAsideGroup>>(new Set());
  // What's selected on the review timeline. Kept here so going back to Sort keeps the choices.
  const [selection, setSelection] = useState(() => new Selection(0));
  const setAside = useMemo(() => summarize(records, movedBack).setAside, [records, movedBack]);
  const workerRef = useRef<{ raw: Worker; api: Comlink.Remote<ScanApi> } | null>(null);
  // The scan in progress: its id (so the worker can drop batches from a stopped scan) and Stop.
  const runRef = useRef({ id: 0, stopped: false });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [saveDone, setSaveDone] = useState(false);
  // Counts start-screen notes, so each one gets its own key.
  const noteCount = useRef(0);
  const startWithNote = (note: string) => setScreen({ name: 'start', note, noteKey: ++noteCount.current });

  useEffect(() => () => workerRef.current?.raw.terminate(), []);
  // Move keyboard and screen-reader focus to the new screen's heading.
  useEffect(() => {
    if (screen.name === 'info') window.scrollTo(0, 0);
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, [screen.name]);

  const getWorker = () => {
    if (!workerRef.current) {
      const raw = new ScanWorker();
      workerRef.current = { raw, api: Comlink.wrap<ScanApi>(raw) };
    }
    return workerRef.current.api;
  };

  async function chooseFolder() {
    let picked: File[];
    let root: RecoveryRoot | undefined;
    try {
      // In a frame (the claude.ai preview) the folder picker is refused, so the folder-upload
      // input is used straight away (still read-only, still only on this computer).
      const open = canUseFolderPicker() ? directoryOpen : directoryOpenLegacy;
      ({ result: picked, root } = await withPickedFolder(async () => (await open({ recursive: true })) as File[]));
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // the person closed the picker
      setScreen({ name: 'error' });
      return;
    }
    const list = picked.filter((f) => f instanceof File && !isOsClutter(f.name));
    if (list.length === 0) {
      startWithNote(`${copy.empty.noFiles} ${copy.empty.noFilesBody}`);
      return;
    }
    setRecoveryRoot(root);
    await scan(list, list.map(pathOf));
  }

  async function trySamples() {
    try {
      const { files: list, paths } = await loadSamples();
      setRecoveryRoot(undefined);
      await scan(list, paths);
    } catch {
      setScreen({ name: 'error' });
    }
  }

  async function scan(list: File[], paths: string[]) {
    setFiles(list);
    setMovedBack(new Set());
    setScreen({ name: 'scanning', progress: { stage: 'checking', done: 0, total: list.length } });
    runRef.current.stopped = true;
    const run: ScanRun = { id: runRef.current.id + 1, stopped: false };
    runRef.current = run;
    try {
      const api = getWorker();
      // Paths first, so the scan starts at once; the files and their sizes follow in small
      // batches so the page keeps answering (all at once froze it for seconds on 40,000 files, T52).
      // Progress can arrive after the scan's answer (T100, see ui/scanRun.ts): only while it runs.
      const onProgress = progressFor(run, () => runRef.current, (p: Progress) => setScreen({ name: 'scanning', progress: p }));
      const scanning = api.scan(run.id, paths, Comlink.proxy(onProgress));
      let fedOk = true;
      const send = (start: number, batch: File[], sizes: number[]) => api.add(run.id, start, batch, sizes);
      // The first batch waits for the next task, so it doesn't add to the browser's own
      // (long) task of listing the folder and the scan screen can draw first.
      const fed = new Promise((r) => setTimeout(r, 0))
        .then(() => handOver(list, (f) => f.size, send, () => run.stopped))
        .catch(() => { fedOk = false; api.cancel(); });
      const result = await scanning;
      run.stopped = true; // answered: a progress update still on its way is stale
      await fed;
      if (!fedOk) throw new Error('hand-over failed');
      if (!result) {
        startWithNote(copy.start.stopped);
        return;
      }
      setRecords(result);
      setScanId(run.id);
      setSelection(new Selection(list.length));
      setScreen({ name: 'results', fresh: true });
    } catch {
      setScreen({ name: 'error' });
    } finally {
      run.stopped = true; // a scan that failed sends no more batches
      // The worker's copies of the picked File objects, and what it read, hold renderer memory
      // as long as the worker lives, garbage or not (~45 MB for 40,000 files, T57). The next
      // scan starts a new worker.
      if (runRef.current === run) retireWorker();
    }
  }

  const retireWorker = () => {
    workerRef.current?.raw.terminate();
    workerRef.current = null;
  };

  /**
   * Back to the start screen with this tab's results cleared (T83): the results, the selection and
   * the recovery folder's handle go, the scan worker is stopped, and cached previews nobody shows are
   * given back. Nothing on disk is touched.
   */
  const startOver = () => {
    runRef.current.stopped = true;
    retireWorker();
    setRecords([]);
    setFiles([]);
    setMovedBack(new Set());
    setSelection(new Selection(0));
    setRecoveryRoot(undefined);
    setSaveDone(false);
    setScreen({ name: 'start' });
    // After the tiles' own cleanups have released their previews.
    setTimeout(dropUnusedPreviews, 0);
  };

  const toggleGroup = (g: SetAsideGroup) =>
    setMovedBack((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });

  // Steps inside the app: Scan (start, scanning, error and the reading pages), Sort, Choose, Save.
  const step = screen.name === 'results' ? 1 : screen.name === 'review' ? 2 : screen.name === 'save' ? 3 : 0;
  const done = screen.name === 'save' && saveDone;
  const info = screen.name === 'info' ? screen.page : undefined;
  // Which step you're on, in the browser tab too (2.4.2).
  useEffect(() => {
    document.title = copy.pageTitle(info ? copy.info[info].title : done ? copy.save.doneStep : copy.steps[step], APP_TITLE);
  }, [step, done, info]);

  return (
    <div className="app">
      <a className="skip" href="#main">{copy.skip}</a>
      <Header current={step} done={done} />
      <div id="main" ref={headingRef}>
        {screen.name === 'start' && <Start note={screen.note} noteKey={screen.noteKey} onChoose={chooseFolder} onSamples={SAMPLES_ENABLED ? trySamples : undefined} onInfo={(page) => setScreen({ name: 'info', page })} />}
        {screen.name === 'info' && (
          <InfoPage
            md={copy.info[screen.page].md}
            onBack={() => setScreen({ name: 'start' })}
            cta={screen.page === 'guide' ? copy.info.guide.cta : undefined}
          />
        )}
        {screen.name === 'scanning' && <Scanning progress={screen.progress} onStop={() => { runRef.current.stopped = true; workerRef.current?.api.cancel(); }} />}
        {screen.name === 'results' && (
          <Results
            records={records}
            files={files}
            movedBack={movedBack}
            countUp={!!screen.fresh}
            onToggleGroup={toggleGroup}
            onReview={() => setScreen({ name: 'review' })}
            onStartOver={startOver}
          />
        )}
        {screen.name === 'review' && (
          <Timeline
            records={records}
            files={files}
            movedBack={movedBack}
            setAside={setAside}
            selection={selection}
            onBack={() => setScreen({ name: 'results' })}
            onSave={(ids) => setScreen({ name: 'save', ids })}
          />
        )}
        {screen.name === 'save' && (
          <Save records={records} files={files} scanId={scanId} ids={screen.ids} recoveryRoot={recoveryRoot} onBack={() => setScreen({ name: 'review' })} onDone={setSaveDone} onStartOver={startOver} />
        )}
        {screen.name === 'error' && (
          <main className="page narrow">
            <BlankPrint />
            <h1 tabIndex={-1}>{copy.error.title}</h1>
            <p className="lede">{copy.error.body}</p>
            <div><button type="button" className="btn btn-primary btn-icon" onClick={chooseFolder}><FolderOpenIcon />{copy.error.retry}</button></div>
          </main>
        )}
      </div>
    </div>
  );
}

/** The start screen's entrance plays once per page load, not on every return to it. */
let startEntered = false;
const FAQ_ICONS = [EyeOffIcon, UserXIcon, FileCheckIcon];

function Start({ note, noteKey, onChoose, onSamples, onInfo }: { note?: string; noteKey?: number; onChoose: () => void; onSamples?: () => void; onInfo: (page: InfoName) => void }) {
  const fullSupport = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  // The claude.ai preview: choosing the folder opens the browser's "upload" dialog.
  const framed = inFrame();
  const [enter] = useState(() => !startEntered);
  useEffect(() => { startEntered = true; }, []);
  // The live region must exist before its text arrives, or screen readers stay silent. Start
  // can mount with a note already ("Scan stopped"), so the text goes in a moment after mount.
  // A new key empties the region at once (the key isn't ready yet) and refills it after the
  // delay, so picking an empty folder twice is announced twice.
  const [ready, setReady] = useState<number>();
  useEffect(() => {
    if (!note || noteKey === undefined) return;
    const t = setTimeout(() => setReady(noteKey), NOTE_DELAY_MS);
    return () => clearTimeout(t);
  }, [note, noteKey]);
  const said = shownNote(note, noteKey, ready);
  return (
    <main className={`page start${enter ? ' enter' : ''}`}>
      {/* One h1, the three-print fan between its two parts: one line from 960px (round 5: the fan
          hangs below the line over the row beneath), three rows below. Screen readers hear one sentence. */}
      <div className="hero-row">
        <HeroGrain />
        <h1 tabIndex={-1} className="hero-h">
          <span className="hero-l1 rise rise-1">{copy.start.titleA}</span><span className="sr-only">{copy.start.titleJoin}</span>
          <span className="hero-fan" aria-hidden="true"><Prints as="span" settle={enter} date={copy.start.fanDate} sizes="(max-width: 640px) 140px, 190px" /></span>
          <span className="hero-l2 rise rise-1">{copy.start.titleB}</span>
        </h1>
      </div>
      <div className="start-main">
        <p className="lede rise rise-2">{copy.start.body}</p>
        {/* Always mounted, and filled after mount, so screen readers announce the note (4.1.3). */}
        <div role="status">{said && <p className="note-box">{said}</p>}</div>
        {/* T83: the privacy promise, right above the button. */}
        <p className="promise rise rise-3"><LockIcon /><span>{copy.start.promise}</span></p>
        <div className="start-choose rise rise-4">
          <div className="actions">
            <button type="button" className="btn btn-primary btn-lg btn-icon" onClick={onChoose}><FolderOpenIcon />{copy.start.choose}</button>
            {onSamples && <button type="button" className="btn btn-secondary btn-lg" onClick={onSamples}>{copy.start.samples}</button>}
          </div>
          <p className="sub-sm">{copy.start.hint}</p>
          {onSamples && <p className="sub-sm">{copy.start.samplesNote}</p>}
          {!fullSupport && !framed && <p className="sub-sm">{copy.start.browserNote}</p>}
          {framed && <p className="sub-sm">{copy.start.uploadNote}</p>}
          <div><button type="button" className="btn btn-link no-folder" onClick={() => onInfo('guide')}>{copy.start.noFolder}</button></div>
        </div>
      </div>
      <section className="card faq rise rise-4" aria-labelledby="faq-h">
        <h2 id="faq-h">{copy.start.faqH}</h2>
        <dl>
          {copy.start.faq.map(({ q, a }, i) => {
            const Icon = FAQ_ICONS[i % FAQ_ICONS.length];
            return (
              <div key={q} className="faq-row">
                <dt><Icon size={24} className="faq-icon" />{q}</dt>
                <dd>{a}</dd>
              </div>
            );
          })}
        </dl>
        <ul className="start-links">
          <li><button type="button" className="btn btn-link" onClick={() => onInfo('privacy')}>{copy.info.privacy.link}</button></li>
          <li><button type="button" className="btn btn-link" onClick={() => onInfo('guide')}>{copy.info.guide.link}</button></li>
        </ul>
      </section>
    </main>
  );
}

/** When "Big folders can take a while" appears on the scanning screen. */
const SLOW_SCAN_MS = 60_000;

function Scanning({ progress, onStop }: { progress: Progress; onStop: () => void }) {
  const { stage, done, total } = progress;
  const [stopping, setStopping] = useState(false);
  const pct = total ? Math.floor((100 * done) / total) : 0;
  const label = stage === 'checking' ? copy.scanning.progress(done, total) : copy.scanning.copiesProgress(done, total);
  // Announce progress to screen readers only every 10%, not on every update.
  const announced = useMemo(() => `${stage === 'checking' ? copy.scanning.title : copy.scanning.copiesTitle} ${Math.floor(pct / 10) * 10}%`, [stage, pct]);
  const current = stage === 'checking' ? 0 : 1;
  // Round 2: after about a minute, a calm word about long waits.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_SCAN_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <main className="page narrow scanning">
      <Prints />
      <h1 tabIndex={-1}>{stage === 'checking' ? copy.scanning.title : copy.scanning.copiesTitle}</h1>
      <div className="progress-wrap">
        <progress max={total || 1} value={done} aria-label={label} />
        <p className="progress-text" aria-hidden="true"><span>{label}</span><span>{pct}%</span></p>
        <p className="sr-only" role="status">{announced}</p>
      </div>
      <ol className="stages" aria-label={copy.scanning.stagesLabel}>
        {copy.scanning.stages.map((name, i) =>
          i < current ? (
            <li key={name} className="stage done"><StageIcon state="done" /><span>{name} <span className="sr-only">{copy.scanning.stageDone}</span></span></li>
          ) : i === current ? (
            <li key={name} className="stage current" aria-current="step"><StageIcon state="current" />{name}</li>
          ) : (
            <li key={name} className="stage"><StageIcon state="todo" />{name}</li>
          ),
        )}
      </ol>
      {slow && <p className="sub-sm" data-k="slow">{copy.scanning.slow}</p>}
      <div className="scan-foot">
        <p className="safe-box"><span>{copy.scanning.reassure}</span><b>{copy.scanning.deleted}</b></p>
        {/* Stays focusable while stopping (aria-disabled, not disabled), so keyboard focus doesn't fall to the page. */}
        <button type="button" className="btn btn-secondary btn-lg btn-block" aria-disabled={stopping || undefined} onClick={() => { if (stopping) return; setStopping(true); onStop(); }}>
          {stopping ? copy.scanning.stopping : copy.scanning.stop}
        </button>
      </div>
    </main>
  );
}
