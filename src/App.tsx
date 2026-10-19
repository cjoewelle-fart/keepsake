import { useEffect, useMemo, useRef, useState } from 'react';
import * as Comlink from 'comlink';
import { directoryOpen } from 'browser-fs-access';
import type { FileRecord, Progress } from './engine/types';
import type { SetAsideGroup } from './engine/summary';
import { summarize } from './engine/summary';
import type { ScanApi } from './worker/scan.worker';
// Bundled into the page itself, so the app is a single self-contained file set.
import ScanWorker from './worker/scan.worker.ts?worker&inline';
import { SAMPLES_ENABLED, loadSamples } from './sample';
import { Header } from './ui/Header';
import { Results } from './ui/Results';
import { Timeline } from './ui/Timeline';
import { Selection } from './ui/timeline';
import { copy } from './ui/copy';

type Screen =
  | { name: 'start'; note?: string }
  | { name: 'scanning'; progress: Progress }
  | { name: 'results' }
  | { name: 'review' }
  /** Placeholder for the save step (T25). */
  | { name: 'save'; ids: number[] }
  | { name: 'error' };

/** Files the operating system adds to folders; they're not part of the recovery. */
const isOsClutter = (name: string) => name.startsWith('.') || /^(thumbs\.db|desktop\.ini)$/i.test(name);
const pathOf = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'start' });
  const [files, setFiles] = useState<File[]>([]);
  const [records, setRecords] = useState<FileRecord[]>([]);
  const [movedBack, setMovedBack] = useState<ReadonlySet<SetAsideGroup>>(new Set());
  // What's selected on the review timeline. Kept here so going back to Clean up keeps the choices.
  const [selection, setSelection] = useState(() => new Selection(0));
  const setAside = useMemo(() => summarize(records, movedBack).setAside, [records, movedBack]);
  const workerRef = useRef<{ raw: Worker; api: Comlink.Remote<ScanApi> } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => workerRef.current?.raw.terminate(), []);
  // Move keyboard and screen-reader focus to the new screen's heading.
  useEffect(() => { document.querySelector<HTMLElement>('main h1')?.focus(); }, [screen.name]);

  const getWorker = () => {
    if (!workerRef.current) {
      const raw = new ScanWorker();
      workerRef.current = { raw, api: Comlink.wrap<ScanApi>(raw) };
    }
    return workerRef.current.api;
  };

  async function chooseFolder() {
    let picked: File[];
    try {
      picked = (await directoryOpen({ recursive: true })) as File[];
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // the person closed the picker
      setScreen({ name: 'error' });
      return;
    }
    const list = picked.filter((f) => f instanceof File && !isOsClutter(f.name));
    if (list.length === 0) {
      setScreen({ name: 'start', note: `${copy.empty.noFiles} ${copy.empty.noFilesBody}` });
      return;
    }
    await scan(list, list.map(pathOf));
  }

  async function trySamples() {
    try {
      const { files: list, paths } = await loadSamples();
      await scan(list, paths);
    } catch {
      setScreen({ name: 'error' });
    }
  }

  async function scan(list: File[], paths: string[]) {
    setFiles(list);
    setMovedBack(new Set());
    setScreen({ name: 'scanning', progress: { stage: 'checking', done: 0, total: list.length } });
    try {
      const result = await getWorker().scan(list, paths, Comlink.proxy((p: Progress) => setScreen({ name: 'scanning', progress: p })));
      if (!result) {
        setScreen({ name: 'start', note: copy.start.stopped });
        return;
      }
      setRecords(result);
      setSelection(new Selection(list.length));
      setScreen({ name: 'results' });
    } catch {
      setScreen({ name: 'error' });
    }
  }

  const toggleGroup = (g: SetAsideGroup) =>
    setMovedBack((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });

  const step = screen.name === 'results' ? 2 : screen.name === 'review' ? 3 : screen.name === 'save' ? 4 : 1;

  return (
    <div className="app">
      <a className="skip" href="#main">{copy.skip}</a>
      <Header current={step} />
      <div id="main" ref={headingRef}>
        {screen.name === 'start' && <Start note={screen.note} onChoose={chooseFolder} onSamples={SAMPLES_ENABLED ? trySamples : undefined} />}
        {screen.name === 'scanning' && <Scanning progress={screen.progress} onStop={() => getWorker().cancel()} />}
        {screen.name === 'results' && (
          <Results
            records={records}
            files={files}
            movedBack={movedBack}
            onToggleGroup={toggleGroup}
            onReview={() => setScreen({ name: 'review' })}
            onStartOver={() => { setRecords([]); setFiles([]); setScreen({ name: 'start' }); }}
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
          <main className="page narrow">
            <h1 tabIndex={-1}>{copy.save.title(screen.ids.length)}</h1>
            <p className="lede">{copy.save.body}</p>
            <div><button type="button" className="btn btn-secondary" onClick={() => setScreen({ name: 'review' })}>{copy.save.back}</button></div>
          </main>
        )}
        {screen.name === 'error' && (
          <main className="page narrow">
            <h1 tabIndex={-1}>{copy.error.title}</h1>
            <p className="lede">{copy.error.body}</p>
            <div><button type="button" className="btn btn-primary" onClick={chooseFolder}>{copy.error.retry}</button></div>
          </main>
        )}
      </div>
    </div>
  );
}

function Start({ note, onChoose, onSamples }: { note?: string; onChoose: () => void; onSamples?: () => void }) {
  const fullSupport = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  return (
    <main className="page narrow start">
      <Prints />
      <h1 tabIndex={-1}>{copy.start.title}</h1>
      <p className="lede">{copy.start.body}</p>
      <p className="sub">{copy.start.hint}</p>
      {note && <p className="note-box" role="status">{note}</p>}
      <div className="actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={onChoose}>{copy.start.choose}</button>
        {onSamples && <button type="button" className="btn btn-secondary btn-lg" onClick={onSamples}>{copy.start.samples}</button>}
      </div>
      {onSamples && <p className="sub-sm">{copy.start.samplesNote}</p>}
      {!fullSupport && <p className="sub-sm">{copy.start.browserNote}</p>}
      <p className="sub-sm privacy">{copy.privacy}</p>
    </main>
  );
}

/** Three blank prints, fanned out. Purely decorative. */
function Prints() {
  return (
    <div className="fan" aria-hidden="true">
      <div className="fan-print fan-l"><div className="ph ph-a"><i /><i /><i /></div></div>
      <div className="fan-print fan-r"><div className="ph ph-b"><i /><i /><i /></div></div>
      <div className="fan-print fan-c"><div className="ph ph-c"><i /><i /><i /></div></div>
    </div>
  );
}

function Scanning({ progress, onStop }: { progress: Progress; onStop: () => void }) {
  const { stage, done, total } = progress;
  const [stopping, setStopping] = useState(false);
  const pct = total ? Math.floor((100 * done) / total) : 0;
  const label = stage === 'checking' ? copy.scanning.progress(done, total) : copy.scanning.copiesProgress(done, total);
  // Announce progress to screen readers only every 10%, not on every update.
  const announced = useMemo(() => `${stage === 'checking' ? copy.scanning.title : copy.scanning.copiesTitle} ${Math.floor(pct / 10) * 10}%`, [stage, pct]);
  const current = stage === 'checking' ? 0 : 1;
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
      <div className="scan-foot">
        <p className="safe-box"><span>{copy.scanning.reassure}</span><b>{copy.scanning.deleted}</b></p>
        <button type="button" className="btn btn-secondary btn-lg btn-block" disabled={stopping} aria-disabled={stopping} onClick={() => { setStopping(true); onStop(); }}>
          {stopping ? copy.scanning.stopping : copy.scanning.stop}
        </button>
      </div>
    </main>
  );
}

function StageIcon({ state }: { state: 'done' | 'current' | 'todo' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="icon">
      {state === 'done' && <><circle cx="9" cy="9" r="8" fill="#23596B" /><path d="M5.4 9.2l2.3 2.3 4.8-4.8" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></>}
      {state === 'current' && <><circle cx="9" cy="9" r="7.2" stroke="#23596B" strokeWidth="1.8" /><circle cx="9" cy="9" r="3" fill="#23596B" /></>}
      {state === 'todo' && <circle cx="9" cy="9" r="7.2" stroke="#767D80" strokeWidth="1.6" />}
    </svg>
  );
}
