import { useEffect, useMemo, useRef, useState } from 'react';
import * as Comlink from 'comlink';
import { directoryOpen } from 'browser-fs-access';
import type { FileRecord, Progress } from './engine/types';
import type { SetAsideGroup } from './engine/summary';
import { effectiveGroup } from './engine/summary';
import { PHOTO_KINDS, VIDEO_KINDS } from './engine/sniff';
import type { ScanApi } from './worker/scan.worker';
import { Header } from './ui/Header';
import { Results } from './ui/Results';
import { copy, n } from './ui/copy';

type Screen =
  | { name: 'start'; note?: string }
  | { name: 'scanning'; progress: Progress }
  | { name: 'results' }
  | { name: 'review' }
  | { name: 'error' };

/** Files the operating system adds to folders; they're not part of the recovery. */
const isOsClutter = (name: string) => name.startsWith('.') || /^(thumbs\.db|desktop\.ini)$/i.test(name);
const pathOf = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'start' });
  const [files, setFiles] = useState<File[]>([]);
  const [records, setRecords] = useState<FileRecord[]>([]);
  const [movedBack, setMovedBack] = useState<ReadonlySet<SetAsideGroup>>(new Set());
  const workerRef = useRef<{ raw: Worker; api: Comlink.Remote<ScanApi> } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => workerRef.current?.raw.terminate(), []);
  // Move keyboard and screen-reader focus to the new screen's heading.
  useEffect(() => { document.querySelector<HTMLElement>('main h1')?.focus(); }, [screen.name]);

  const getWorker = () => {
    if (!workerRef.current) {
      const raw = new Worker(new URL('./worker/scan.worker.ts', import.meta.url), { type: 'module' });
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
    setFiles(list);
    setMovedBack(new Set());
    setScreen({ name: 'scanning', progress: { stage: 'checking', done: 0, total: list.length } });
    try {
      const result = await getWorker().scan(list, list.map(pathOf), Comlink.proxy((p: Progress) => setScreen({ name: 'scanning', progress: p })));
      if (!result) {
        setScreen({ name: 'start', note: copy.start.stopped });
        return;
      }
      setRecords(result);
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

  const step = screen.name === 'results' ? 2 : screen.name === 'review' ? 3 : 1;

  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <Header current={step} />
      <div id="main" ref={headingRef}>
        {screen.name === 'start' && <Start note={screen.note} onChoose={chooseFolder} />}
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
        {screen.name === 'review' && <ReviewByYear records={records} movedBack={movedBack} onBack={() => setScreen({ name: 'results' })} />}
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

function Start({ note, onChoose }: { note?: string; onChoose: () => void }) {
  const fullSupport = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  return (
    <main className="page narrow">
      <p className="eyebrow">{copy.start.eyebrow}</p>
      <h1 tabIndex={-1}>{copy.start.title}</h1>
      <p className="lede">{copy.start.body}</p>
      <p className="sub">{copy.start.hint}</p>
      {note && <p className="callout callout-info" role="status">{note}</p>}
      <div><button type="button" className="btn btn-primary btn-lg" onClick={onChoose}>{copy.start.choose}</button></div>
      {!fullSupport && <p className="sub">{copy.start.browserNote}</p>}
      <p className="privacy">{copy.privacy}</p>
    </main>
  );
}

function Scanning({ progress, onStop }: { progress: Progress; onStop: () => void }) {
  const { stage, done, total } = progress;
  const [stopping, setStopping] = useState(false);
  const pct = total ? Math.floor((100 * done) / total) : 0;
  const label = stage === 'checking' ? copy.scanning.progress(done, total) : copy.scanning.copiesProgress(done, total);
  // Announce progress to screen readers only every 10%, not on every update.
  const announced = useMemo(() => `${stage === 'checking' ? copy.scanning.title : copy.scanning.copiesTitle} ${Math.floor(pct / 10) * 10}%`, [stage, pct]);
  return (
    <main className="page narrow">
      <h1 tabIndex={-1}>{stage === 'checking' ? copy.scanning.title : copy.scanning.copiesTitle}</h1>
      <div className="progress-wrap">
        <progress max={total || 1} value={done} aria-label={label} />
        <p className="progress-text" aria-hidden="true">{label} · {pct}%</p>
        <p className="sr-only" role="status">{announced}</p>
      </div>
      <p className="sub">{copy.scanning.reassure}</p>
      <div>
        <button type="button" className="btn btn-secondary" disabled={stopping} aria-disabled={stopping} onClick={() => { setStopping(true); onStop(); }}>
          {stopping ? copy.scanning.stopping : copy.scanning.stop}
        </button>
      </div>
    </main>
  );
}

function ReviewByYear({ records, movedBack, onBack }: { records: FileRecord[]; movedBack: ReadonlySet<SetAsideGroup>; onBack: () => void }) {
  // Same rules as the cleanup summary, so every number matches the previous screen.
  const rows = useMemo(() => {
    const years = new Map<string, number>();
    let undated = 0, videos = 0, others = 0;
    for (const r of records) {
      if (effectiveGroup(r, movedBack) !== 'keep') continue;
      if (VIDEO_KINDS.has(r.kind)) videos++;
      else if (!PHOTO_KINDS.has(r.kind)) others++;
      else if (r.takenAt) years.set(r.takenAt.slice(0, 4), (years.get(r.takenAt.slice(0, 4)) ?? 0) + 1);
      else undated++;
    }
    const out: [string, number][] = [...years.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (undated) out.push([copy.review.undated, undated]);
    if (videos) out.push([copy.review.videos, videos]);
    if (others) out.push([copy.review.otherFiles, others]);
    return out;
  }, [records, movedBack]);
  return (
    <main className="page narrow">
      <h1 tabIndex={-1}>{copy.review.title}</h1>
      <p className="lede">{copy.review.body}</p>
      <ul className="year-list">
        {rows.map(([y, c]) => <li key={y}><span>{y}</span><strong>{n(c)}</strong></li>)}
      </ul>
      <div><button type="button" className="btn btn-secondary" onClick={onBack}>{copy.review.back}</button></div>
    </main>
  );
}
