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
import { ArrowRightIcon, BlankPrint, CheckCircleIcon, FolderIcon, FolderOpenIcon, LockIcon, LogoMark, PlayIcon, Prints, StageIcon } from './ui/icons';
import { launchVideo, type LaunchVideo } from './ui/launchVideo';
import { addLeaveGuard, needsLeaveGuard } from './ui/leaveGuard';
import tileBeach from './assets/hero/6-beach-240.webp';
import tileRoadtrip from './assets/hero/4-roadtrip-240.webp';
import tileCandles from './assets/hero/3-candles-240.webp';

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
/**
 * The name the tab titles end with: the app's name, or "<name> (test)" in the test builds. The page
 * loads with its longer launch title (D41); once the app runs, each step's tab says "Sort · <name>".
 */
const APP_TITLE = typeof document !== 'undefined' && document.title.endsWith('(test)') ? `${copy.appName} (test)` : copy.appName;
/** The title the page loaded with: the launch title on the start screen (D41), kept there. */
const PAGE_TITLE = (typeof document !== 'undefined' && document.title) || copy.appName;
/** D43: the launch video (src/brand.ts), or null. */
const LAUNCH = launchVideo();
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
  // UX5: a save is running (from the Save step), for the leave guard below.
  const [saving, setSaving] = useState(false);
  // Counts start-screen notes, so each one gets its own key.
  const noteCount = useRef(0);
  const startWithNote = (note: string) => setScreen({ name: 'start', note, noteKey: ++noteCount.current });

  useEffect(() => () => workerRef.current?.raw.terminate(), []);
  // UX5: reloading or closing the tab asks first (the browser's own prompt) while a save runs, or
  // while the review choices differ from the default. Only listening while there's a scan to lose:
  // start over clears the records and removes it. The selection is mutated in place, so whether
  // choices were made is read when the page is about to close.
  const hasScan = records.length > 0;
  useEffect(() => {
    if (!hasScan && !saving) return;
    return addLeaveGuard(window, () => needsLeaveGuard({ saving, choicesMade: selection.changed(), saved: saveDone }));
  }, [hasScan, saving, saveDone, selection]);
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
    // The start screen keeps the page's own launch title (D41); every other screen says where you are.
    const home = screen.name === 'start';
    document.title = home ? PAGE_TITLE : copy.pageTitle(info ? copy.info[info].title : done ? copy.save.doneStep : copy.steps[step], APP_TITLE);
  }, [step, done, info, screen.name]);

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
          <Save records={records} files={files} scanId={scanId} ids={screen.ids} recoveryRoot={recoveryRoot} onBack={() => setScreen({ name: 'review' })} onDone={setSaveDone} onSaving={setSaving} onStartOver={startOver} />
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
      {/* Round 6: one centred band for the main task, then How it works and Good to know below. */}
      <div className="start-hero">
        {/* One h1, the three-print fan between its two parts: one line from 960px, with the words
            centred on the prints; three rows below. Screen readers hear one sentence. */}
        <div className="hero-row">
          <h1 tabIndex={-1} className="hero-h">
            <span className="hero-l1 rise rise-1">{copy.start.titleA}</span><span className="sr-only">{copy.start.titleJoin}</span>
            <span className="hero-fan" aria-hidden="true">
              {/* Paper grain behind the prints only: a static tile, faded out at the edges. */}
              <span className="hero-grain" />
              <Prints as="span" settle={enter} date={copy.start.fanDate} sizes="(max-width: 640px) 140px, 190px" />
            </span>
            <span className="hero-l2 rise rise-1">{copy.start.titleB}</span>
          </h1>
        </div>
        <p className="lede rise rise-2">{copy.start.body}</p>
        {/* Always mounted, and filled after mount, so screen readers announce the note (4.1.3). */}
        <div role="status">{said && <p className="note-box">{said}</p>}</div>
        <div className="start-cta rise rise-3">
          <button type="button" className="btn btn-primary btn-lg btn-icon" onClick={onChoose}><FolderOpenIcon />{copy.start.choose}</button>
          {onSamples && <button type="button" className="btn btn-secondary btn-lg" onClick={onSamples}>{copy.start.samples}</button>}
        </div>
        {/* T83: the privacy promise. Round 6: a plain line right below the button, part of its group. */}
        <p className="privacy-line rise rise-3"><LockIcon size={16} /><span>{copy.start.promise}</span></p>
        <div className="start-help rise rise-4">
          <p className="sub-sm">{copy.start.hint}</p>
          {onSamples && <p className="sub-sm">{copy.start.samplesNote}</p>}
          {!fullSupport && !framed && <p className="sub-sm">{copy.start.browserNote}</p>}
          {framed && <p className="sub-sm">{copy.start.uploadNote}</p>}
          <button type="button" className="btn btn-link no-folder" onClick={() => onInfo('guide')}>{copy.start.noFolder}</button>
        </div>
      </div>
      {/* Round 7: the one raised card below the hero. Panels 1 and 2 are a before and after, joined
          by an arrow (Upsort's own work); step 3 is the person's turn, so it has no arrow. */}
      <section className="how" aria-labelledby="how-h">
        <h2 id="how-h">{copy.start.how.h}</h2>
        <ol className="how-steps">
          {copy.start.how.steps.map(({ title, body, panel, sizes }, i) => (
            <li key={title} className="how-step">
              {/* The caption and picture are decorative, like the panel itself. Step 3's empty caption
                  keeps the three panels level in the row. */}
              <div className="how-fig" aria-hidden="true">
                <span className="how-cap">{i === 0 ? copy.start.how.before : i === 1 ? copy.start.how.after : ''}</span>
                <HowPanel lines={panel} sizes={sizes} n={i + 1} />
              </div>
              <div className="how-text">
                <h3><span className="how-num" aria-hidden="true">{i + 1}</span>{title}</h3>
                <p>{body}</p>
              </div>
              {i === 0 && <span className="how-arrow" aria-hidden="true"><ArrowRightIcon size={20} /></span>}
            </li>
          ))}
        </ol>
      </section>
      {LAUNCH && <WatchVideo video={LAUNCH} />}
      <section className="know" aria-labelledby="faq-h">
        <h2 id="faq-h">{copy.start.faqH}</h2>
        <dl>
          {copy.start.faq.map(({ q, a, guide }) => (
            <div key={q} className="faq-row">
              <dt>{q}</dt>
              <dd>
                {a}
                {guide && <button type="button" className="btn btn-link faq-link" onClick={() => onInfo('guide')}>{copy.start.guideLink}</button>}
              </dd>
            </div>
          ))}
        </dl>
        <ul className="know-links">
          <li><button type="button" className="btn btn-link" onClick={() => onInfo('privacy')}>{copy.info.privacy.link}</button></li>
        </ul>
      </section>
      {/* D41: a quiet footer, the logo in the text colour only, the name and the tagline. */}
      <footer className="start-foot">
        <LogoMark mono size={24} />
        <span className="start-foot-name">{copy.appName}</span>
        <span className="start-foot-line">{copy.start.tagline}</span>
      </footer>
    </main>
  );
}

/**
 * D43: "Watch <name> sort a recovery folder". Until the button is pressed there is no <video> and
 * nothing is requested: the poster is the page's own prints. The press inserts the video (with its
 * captions on) and moves focus to it. If it can't load (offline), a plain line says so.
 */
function WatchVideo({ video }: { video: LaunchVideo }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  // Focus follows the press to the video; if it can't load, back to the button (to try again).
  useEffect(() => { if (playing) videoRef.current?.focus(); }, [playing]);
  useEffect(() => { if (failed) playRef.current?.focus(); }, [failed]);
  const live = playing && !failed;
  return (
    <section className="watch" aria-labelledby="watch-h">
      <div className="watch-text">
        <h2 id="watch-h">{copy.start.video.h}</h2>
        <p className="sub-sm">{copy.start.video.line}</p>
      </div>
      <div className="watch-side">
        <div className="watch-frame">
          {live ? (
            <video ref={videoRef} controls playsInline autoPlay src={video.src} onError={() => { setFailed(true); setPlaying(false); }}>
              <track kind="captions" srcLang="en" label="English" default src={video.captions} />
            </video>
          ) : (
            <>
              <span className="watch-poster" aria-hidden="true"><Prints /></span>
              <button ref={playRef} type="button" className="btn btn-secondary btn-icon watch-play" aria-label={copy.start.video.playName(video.seconds)} onClick={() => { setFailed(false); setPlaying(true); }}>
                <PlayIcon />{copy.start.video.play(video.seconds)}
              </button>
            </>
          )}
        </div>
        <p role="status" className="sub-sm watch-note">{failed ? copy.start.video.offline : ''}</p>
      </div>
    </section>
  );
}

/**
 * A How it works step's small picture (decorative). Lines are a folder listing: a line ending in "/"
 * is a folder, and every folder indents the lines after it. No lines: three photo tiles, two ticked.
 * `sizes`: an optional size per line, shown right-aligned ('' for none).
 */
function HowPanel({ lines, sizes, n }: { lines: readonly string[]; sizes?: readonly string[]; n: number }) {
  if (!lines.length) {
    return (
      <div className={`how-panel p${n} how-tiles`}>
        {[tileBeach, tileCandles, tileRoadtrip].map((src, i) => (
          <span key={src} className={`how-tile${i === 2 ? ' off' : ''}`}>
            <img src={src} alt="" width={240} height={192} decoding="async" loading="lazy" draggable={false} />
            {i < 2 && <CheckCircleIcon size={20} className="how-tick" />}
          </span>
        ))}
      </div>
    );
  }
  let depth = 0;
  return (
    <div className={`how-panel p${n} how-list`}>
      {lines.map((line, i) => {
        const folder = line.endsWith('/');
        const d = depth;
        if (folder) depth += 1;
        return (
          <span key={line} className={`how-line d${Math.min(d, 3)}${folder ? ' dir' : ''}`}>
            {folder ? <FolderIcon size={16} /> : null}{line}
            {sizes?.[i] ? <span className="how-size">{sizes[i]}</span> : null}
          </span>
        );
      })}
    </div>
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
