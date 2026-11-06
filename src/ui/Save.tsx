// Step 5, Save (T25): choose where (EX-choose), saving with a Stop, problems, and the receipt
// (EX-done). Source: team/brand/quiet-prints/EX-*.dc.html; words in copy.ts `save`.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Comlink from 'comlink';
import type { FileRecord } from '../engine/types';
import type { SaveApi } from '../worker/save.worker';
import SaveWorker from '../worker/save.worker.ts?worker&inline';
import { bytes, copy, n } from './copy';
import { ZIP_LIMITS, checkRecoveryFolder, insideRecovery, planNames, receiptText, scanFolders, sortedInto, splitParts, ZipLog, zipPath } from './savePlan';
import type { FolderCheck, Planned, RecoveryRootDir, ResolvingDir } from './savePlan';
import type { RecoveryRoot } from './recoveryFolder';
import { canSaveToFolder, download, ensureWritable, hasRoot, newFolderSession, pickFolder, saveAsZip, saveToFolder } from './saveRun';
import type { DirHandle, FolderSession, RunEnd } from './saveRun';
import { END_COST, entryCost } from './zip';
import { canDownload } from './embedded';
import { mediaType } from './timeline';
import { SafeNote } from './Results';
import { CautionIcon, CheckCircleIcon, DownloadIcon, FolderIcon, FolderOpenIcon, PhotoIcon, Prints } from './icons';

type Props = {
  records: FileRecord[];
  files: File[];
  /** Which scan `records` came from (unique while the page is open), for the page-wide zip log (T89). */
  scanId: number;
  /** Selected FileRecord indices, from the review timeline. */
  ids: number[];
  /** The recovery folder's own handle, when it was picked with the browser's folder picker. */
  recoveryRoot?: RecoveryRoot;
  onBack: () => void;
  /** The header says "Done" on the receipt. */
  onDone: (done: boolean) => void;
  /** "Sort another folder" on the receipt: back to the start screen, this tab's results cleared (T83). */
  onStartOver: () => void;
};

type Phase =
  | { k: 'choose'; problem?: 'denied' | 'recovery' | 'unchecked' | 'unsupported' }
  | { k: 'saving' }
  | { k: 'ended'; end: Exclude<RunEnd, 'done' | 'unsupported'> }
  | { k: 'done'; when: Date };

const s = copy.save;
/** Every zip downloaded while this page is open, across visits to the Save step (T89). */
const zipLog = new ZipLog();
const problemText = (problem: 'denied' | 'recovery' | 'unchecked' | 'unsupported', mediaOnly: boolean): readonly [string, string] =>
  problem === 'denied' ? [s.deniedH, s.deniedBody]
    : problem === 'recovery' ? [s.recoveryH, s.recoveryBody]
      : problem === 'unchecked' ? [s.uncheckedH, s.uncheckedBody]
        : [s.unsupportedH, s.unsupportedBody(mediaOnly)];
const split = (list: readonly Planned[]) => splitParts(list, (p) => entryCost(zipPath(p), p.size), END_COST);

export function Save({ records, files, scanId, ids, recoveryRoot, onBack, onDone, onStartOver }: Props) {
  // Zip downloads where the browser can't save into a folder safely (no folder picker, or no
  // move()); also if move() turns out not to work for the chosen folder.
  const [folderMode, setFolderMode] = useState(() => canSaveToFolder());
  // Neither works in a sandboxed frame (the claude.ai preview): say so calmly, offer nothing.
  const [noSaving] = useState(() => !canSaveToFolder() && !canDownload());
  const byIndex = useMemo(() => {
    const a: FileRecord[] = [];
    for (const r of records) a[r.index] = r;
    return a;
  }, [records]);
  const items = useMemo(() => ids.map((id) => byIndex[id]).filter(Boolean), [ids, byIndex]);
  const total = items.length;
  const mediaOnly = useMemo(() => items.every((r) => mediaType(r) !== 'other'), [items]);
  // The file's size now (it's what gets copied), falling back to the size at scan time.
  const sizeOf = useCallback((r: FileRecord) => files[r.index]?.size ?? r.size, [files]);
  const totalBytes = useMemo(() => items.reduce((a, r) => a + sizeOf(r), 0), [items, sizeOf]);

  // Zip names are decided once for the whole selection, so "Save the rest" can't clash with a part already downloaded.
  const planned = useMemo(() => (folderMode ? [] : planNames(items, sizeOf)), [folderMode, items, sizeOf]);
  const partCount = useMemo(() => split(folderMode ? planNames(items, sizeOf) : planned).length, [folderMode, items, planned, sizeOf]);
  const bigFile = useMemo(() => items.some((r) => sizeOf(r) > ZIP_LIMITS.maxBytes), [items, sizeOf]);

  const [phase, setPhase] = useState<Phase>({ k: 'choose' });
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);

  // What this visit to the Save step has done so far (kept across "Save the rest").
  // Mutable on purpose (like the timeline's Selection): changed while saving, and every change
  // that matters on screen comes with a phase or progress update that re-renders.
  const [sess] = useState(() => ({
    saved: new Set<number>(),
    failed: new Set<number>(),
    folder: undefined as FolderSession | undefined,
    savedTo: [] as string[],
    zips: [] as { name: string; blob: Blob }[],
    /** This visit in the page-wide zip log. */
    visit: zipLog.newVisit(scanId),
    existed: false,
    /** A newly chosen folder (and whether it already had a "Keepsake photos" folder). */
    setFolder(f: FolderSession, existed: boolean) {
      this.folder = f;
      this.existed = existed;
    },
  }));
  const stop = useRef(false);
  const [stopping, setStopping] = useState(false);
  const [progress, setProgress] = useState({ done: 0, part: 0, parts: 0 });

  const worker = useRef<{ raw: Worker; api: Comlink.Remote<SaveApi> }>(undefined);
  useEffect(() => () => worker.current?.raw.terminate(), []);
  const crc = (f: File) => {
    if (!worker.current) {
      const raw = new SaveWorker();
      worker.current = { raw, api: Comlink.wrap<SaveApi>(raw) };
    }
    return worker.current.api.crc(f);
  };

  useEffect(() => {
    onDone(phase.k === 'done');
  }, [phase.k, onDone]);
  // Focus goes to the new view's heading; when a problem comes up, to the problem's own heading,
  // so it's read first and can't be missed (T83).
  const problem = phase.k === 'choose' ? phase.problem : undefined;
  const [problemKey, setProblemKey] = useState(0);
  useEffect(() => {
    document.querySelector<HTMLElement>(problem ? '#problem-h' : 'main h1')?.focus();
  }, [phase.k, problem, problemKey]);
  /** Show a problem; the same one again (picked the recovery folder twice) still moves focus to it. */
  const showProblem = (p: NonNullable<typeof problem>) => {
    setPhase({ k: 'choose', problem: p });
    setProblemKey((x) => x + 1);
  };

  /**
   * Is the chosen folder the recovery folder or inside it (T55)? With the recovery folder's own
   * handle this is exact; without one (it came from the file-input fallback) it's the best-effort
   * check from the scanned files' folders. An error is 'unknown', and that folder is refused too.
   */
  const checkFolder = (chosen: DirHandle): Promise<FolderCheck> => (recoveryRoot
    ? checkRecoveryFolder(recoveryRoot as unknown as RecoveryRootDir, chosen as unknown as ResolvingDir)
    : insideRecovery(chosen as unknown as ResolvingDir, scanFolders(files)).then((inside): FolderCheck => (inside ? 'inside' : 'outside'), (): FolderCheck => 'unknown'));

  const remaining = () => items.filter((r) => !sess.saved.has(r.index));

  async function finish(end: RunEnd) {
    stop.current = false;
    setStopping(false);
    if (end === 'done') {
      zipLog.finish(sess.visit);
      setPhase({ k: 'done', when: new Date() });
    } else if (end === 'unsupported') {
      // Nothing was written: offer zip downloads instead.
      setFolderMode(false);
      showProblem('unsupported');
    } else {
      setPhase({ k: 'ended', end });
    }
  }

  const ev = {
    onSaved: (id: number) => { sess.saved.add(id); sess.failed.delete(id); },
    onFailed: (id: number) => { sess.failed.add(id); },
    shouldStop: () => stop.current,
  };

  async function runFolder() {
    const session = sess.folder!;
    const rest = remaining();
    sess.failed.clear();
    setProgress({ done: sess.saved.size, part: 0, parts: 0 });
    setPhase({ k: 'saving' });
    const end = await saveToFolder(session, rest.map((r) => ({ r, file: files[r.index] })), {
      ...ev,
      onSaved: (id) => { ev.onSaved(id); setProgress((p) => ({ ...p, done: sess.saved.size })); },
      onFailed: (id) => { ev.onFailed(id); rerender(); },
    });
    if (end !== 'unsupported' && !sess.savedTo.includes(session.chosen.name)) sess.savedTo.push(session.chosen.name);
    await finish(end);
  }

  async function chooseFolder() {
    let chosen: DirHandle;
    try {
      chosen = await pickFolder();
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // closed the picker: stay here, no message
      showProblem('denied');
      return;
    }
    const where = await checkFolder(chosen);
    if (where !== 'outside') {
      showProblem(where === 'inside' ? 'recovery' : 'unchecked');
      return;
    }
    if (!(await ensureWritable(chosen))) {
      showProblem('denied');
      return;
    }
    sess.setFolder(newFolderSession(chosen), await hasRoot(chosen));
    await runFolder();
  }

  async function runZip() {
    const rest = new Set(remaining().map((r) => r.index));
    const parts = split(planned.filter((p) => rest.has(p.id)));
    // Named from the page-wide log, so no name is ever used twice while the page is open (T89).
    sess.failed.clear();
    let worked = sess.saved.size;
    setProgress({ done: worked, part: 1, parts: parts.length });
    setPhase({ k: 'saving' });
    const end = await saveAsZip(parts, parts.map((_, i) => i + 1), files, crc, {
      ...ev,
      onPart: (i) => setProgress((p) => ({ ...p, part: i })),
      onWorked: () => { worked++; setProgress((p) => ({ ...p, done: worked })); },
      onZip: (blob, _i, ids) => {
        const name = zipLog.add(sess.visit, parts.length, ids);
        sess.zips.push({ name, blob });
        download(blob, name);
      },
    });
    await finish(end);
  }

  async function saveRest() {
    if (folderMode) {
      if (!sess.folder || !(await ensureWritable(sess.folder.chosen))) {
        setPhase({ k: 'ended', end: 'denied' });
        return;
      }
      await runFolder();
    } else {
      await runZip();
    }
  }

  // Stays focusable while stopping (aria-disabled, not disabled), so keyboard focus doesn't fall
  // to the page; repeat presses do nothing.
  const doStop = () => { if (stop.current) return; stop.current = true; setStopping(true); };

  const savedN = sess.saved.size;
  const failedN = sess.failed.size;

  if (phase.k === 'saving') {
    const pct = total ? Math.floor((100 * progress.done) / total) : 0;
    const label = s.progress(Math.min(progress.done, total), total);
    return (
      <main className="page narrow scanning save-progress">
        <h1 tabIndex={-1}>{s.savingH}</h1>
        {folderMode && sess.existed && <p className="note-box">{s.existsNote}</p>}
        <div className="progress-wrap">
          <progress max={total || 1} value={Math.min(progress.done, total)} aria-label={label} />
          <p className="progress-text" aria-hidden="true">
            <span>{!folderMode && progress.parts > 1 ? `${s.zipProgress(progress.part, progress.parts)} · ` : ''}{label}</span>
            <span>{pct}%</span>
          </p>
          <p className="sr-only" role="status">{s.announce(Math.floor((total * Math.floor(pct / 10)) / 10), total)}</p>
        </div>
        {failedN > 0 && <p className="sub-sm" data-k="failed-live">{s.failedLine(failedN)}</p>}
        <div className="scan-foot">
          <p className="safe-box"><span>{s.reassure}</span><b>{copy.scanning.deleted}</b></p>
          <p className="sub-sm">{s.keepOpen}</p>
          <button type="button" className="btn btn-secondary btn-block" aria-disabled={stopping || undefined} onClick={doStop}>
            {stopping ? s.stopping : s.stop}
          </button>
        </div>
      </main>
    );
  }

  if (phase.k === 'ended') {
    const left = remaining().reduce((a, r) => a + sizeOf(r), 0);
    const [h, body, buttons] =
      phase.end === 'stopped' ? [s.stoppedH, s.stoppedBody(savedN, total, mediaOnly, !folderMode), 'rest']
        : phase.end === 'full' ? [s.fullH, s.fullBody(savedN, total, mediaOnly, bytes(left), !folderMode), 'rest']
          : phase.end === 'denied' ? [s.lostH, s.lostBody(savedN, total, mediaOnly), 'again']
            : [s.brokenH, s.brokenBody(savedN, total, mediaOnly, !folderMode), 'rest'];
    return (
      <main className="page narrow">
        <h1 tabIndex={-1}>{h}</h1>
        <p className="lede" data-k="ended-body">{body}</p>
        {failedN > 0 && <p className="sub-sm">{s.failedLine(failedN)}</p>}
        <div className="actions">
          {buttons === 'rest' && <button type="button" className="btn btn-primary" onClick={saveRest}>{s.saveRest}</button>}
          {buttons === 'again' && <button type="button" className="btn btn-primary" onClick={chooseFolder}>{s.chooseAgain}</button>}
          {folderMode && buttons === 'rest' && phase.end !== 'stopped' && (
            <button type="button" className="btn btn-secondary" onClick={chooseFolder}>{s.chooseDifferent}</button>
          )}
          {phase.end === 'stopped' && <button type="button" className="btn btn-secondary" onClick={onBack}>{s.backToReview}</button>}
        </div>
        {!folderMode && sess.zips.length > 0 && <ZipAgain zips={sess.zips} />}
      </main>
    );
  }

  if (phase.k === 'done') {
    return (
      <Done
        total={total}
        saved={savedN}
        failedRecords={items.filter((r) => sess.failed.has(r.index))}
        mediaOnly={mediaOnly}
        folderNames={sess.savedTo}
        zips={folderMode ? undefined : sess.zips}
        earlier={folderMode ? undefined : zipLog.leftovers(sess.visit, sess.saved)}
        sorted={sortedInto(folderMode
          ? [...(sess.folder?.placed.values() ?? [])].map((dir) => ({ dir }))
          : planned.filter((p) => sess.saved.has(p.id)))}
        when={phase.when}
        onStartOver={onStartOver}
      />
    );
  }

  // Choose where to save
  return (
    <main className="page results save">
      <section className="envelope" aria-labelledby="where-h">
        <h1 id="where-h" tabIndex={-1}>
          {s.titleBefore}<span className="accent-num">{n(total)}</span>{s.titleAfter(total, mediaOnly)}
        </h1>
        <dl className="ledger" aria-label={s.ledgerLabel}>
          <div><dt>{s.ledgerSelected}</dt><dd data-k="selected">{n(total)}</dd></div>
          <div className="ledger-total"><dt>{s.ledgerSize}</dt><dd data-k="size">{bytes(totalBytes)}</dd></div>
        </dl>
        <p className="sub-sm">{s.needSpace(bytes(totalBytes))}</p>
        <SafeNote h={s.safeH} line={s.safeLine} />
        <div><button type="button" className="btn btn-link" onClick={onBack}>{s.back}</button></div>
      </section>

      <div className="sheet-col save-col">
        {phase.problem && (
          // T83: hard to miss. Warm caution colours, an icon, read out at once, and focus on its heading.
          <section key={problemKey} className="card card-problem" role="alert" aria-labelledby="problem-h" data-k="problem">
            <CautionIcon />
            <div className="problem-text">
              <h2 id="problem-h" tabIndex={-1}>{problemText(phase.problem, mediaOnly)[0]}</h2>
              <p>{problemText(phase.problem, mediaOnly)[1]}</p>
            </div>
          </section>
        )}
        {noSaving ? (
          <section className="card" aria-labelledby="preview-h" data-k="no-saving">
            <h2 id="preview-h">{s.previewH}</h2>
            <p className="card-body">{s.previewBody}</p>
          </section>
        ) : folderMode ? (
          <section className="card" aria-labelledby="folder-h">
            <h2 id="folder-h">{s.folderH}</h2>
            <p className="card-body">{s.folderBody}</p>
            <p className="card-body">{s.notTheCard}</p>
            <div>
              <button type="button" className="btn btn-primary btn-icon" onClick={chooseFolder}><FolderOpenIcon />{phase.problem ? s.chooseDifferent : s.chooseFolder}</button>
            </div>
            <p className="sub-sm">{s.browserNote(partCount, bigFile)}</p>
          </section>
        ) : (
          <section className="card" aria-labelledby="zip-h">
            <h2 id="zip-h">{s.zipH}</h2>
            <p className="card-body">{s.zipBody(total, mediaOnly, partCount, bigFile)}</p>
            {bigFile && <p className="card-body">{s.zipBigFile}</p>}
            {partCount > 1 && <p className="sub-sm">{s.zipAllowTip}</p>}
            <div><button type="button" className="btn btn-primary btn-icon" onClick={runZip}><DownloadIcon />{s.downloadZips(partCount)}</button></div>
            {/* T64: after 'unsupported' they're most likely in Chrome or Edge already. */}
            {phase.problem !== 'unsupported' && <p className="sub-sm">{s.zipChromeTip}</p>}
          </section>
        )}
        <section className="card card-quiet" aria-labelledby="tree-h">
          <h2 id="tree-h">{s.treeH}</h2>
          <ul className="tree" aria-label={s.treeLabel}>
            <li className="tree-root"><FolderIcon className="tree-folder" />{s.rootFolder}</li>
            <li style={{ paddingLeft: 30 }}><FolderIcon className="tree-folder" />{s.treeExample.year}</li>
            <li style={{ paddingLeft: 60 }}><FolderIcon className="tree-folder" />{s.monthFolder(s.treeExample.month)}</li>
            {s.treeExample.files.map((f) => <li key={f} className="tree-file" style={{ paddingLeft: 90 }}><PhotoIcon className="tree-photo" />{f}</li>)}
            <li style={{ paddingLeft: 30 }}><FolderIcon className="tree-folder" />{s.noDateFolder}</li>
          </ul>
          <p className="sub-sm">{s.treeCaption}</p>
        </section>
      </div>
    </main>
  );
}

/** The receipt's "Your files: None deleted, none sent anywhere" row (T76). A printed record, so it stays a ledger row. */
function SafeRow() {
  return (
    <div className="ledger-safe">
      <dt><span aria-hidden="true">{s.rSafe}</span><span className="sr-only">{s.rSafe}</span></dt>
      <dd><span aria-hidden="true">{s.rSafeValue}</span><span className="sr-only">{s.rSafeValue}</span></dd>
    </div>
  );
}

function ZipAgain({ zips }: { zips: { name: string; blob: Blob }[] }) {
  return (
    <div className="zip-again">
      <p className="sub-sm">{s.zipAgainNote}</p>
      <div className="actions">
        {zips.map((z, i) => (
          <button key={i} type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => download(z.blob, z.name)}><DownloadIcon />{s.zipAgain(z.name)}</button>
        ))}
      </div>
    </div>
  );
}

/** Where to find this save's zips: a sentence, or a sentence and a list of names (T89). */
function FindZips({ names }: { names: string[] }) {
  const f = s.findZip(names);
  if (!f.list) return <p className="find" data-k="find">{f.text}</p>;
  return (
    <div className="find" data-k="find">
      <p>{f.text}</p>
      <ul className="zip-names">{f.list.map((name) => <li key={name}>{name}</li>)}</ul>
    </div>
  );
}

type DoneProps = {
  total: number;
  saved: number;
  failedRecords: FileRecord[];
  mediaOnly: boolean;
  folderNames: string[];
  zips?: { name: string; blob: Blob }[];
  /** Zips from an earlier save on this page that didn't finish. */
  earlier?: { names: string[]; covered: boolean };
  sorted: { years: number; months: number; noDate: number };
  when: Date;
  onStartOver: () => void;
};

function Done({ total, saved, failedRecords, mediaOnly, folderNames, zips, earlier, sorted, when, onStartOver }: DoneProps) {
  const [showFailed, setShowFailed] = useState(false);
  const failed = failedRecords.length;
  const savedTo = zips ? s.rSavedToZip(zips.length) : folderNames.map(s.rSavedToFolder).join(' and ');
  const receipt = { when, saved, failed, mediaOnly, savedTo, sorted, failedPaths: failedRecords.map((r) => r.path) };
  const saveReceipt = () => download(new Blob([receiptText(receipt)], { type: 'text/plain;charset=utf-8' }), s.receiptFile);
  return (
    <main className="page done">
      <div className="done-side">
        <div className="no-print">
          <Prints settle>
            <span className="done-check"><CheckCircleIcon size={48} /></span>
          </Prints>
        </div>
        <h1 tabIndex={-1}>
          {failed === 0 || saved === total
            ? <>{s.doneBefore}<span className="accent-num">{n(saved)}</span>{s.doneAfter(saved, mediaOnly)}</>
            : <>{s.partBefore}<span className="accent-num">{n(saved)}</span>{s.partAfter(total, mediaOnly)}</>}
        </h1>
        {failed > 0 && <p className="note-box">{s.failedLine(failed)}</p>}
        <p className="lede">{zips ? s.doneZipLine(zips.length) : s.doneLine}</p>
        {zips ? <FindZips names={zips.map((z) => z.name)} /> : <p className="find" data-k="find">{folderNames.map(s.findThem).join(' ')}</p>}
        {zips && earlier && earlier.names.length > 0 && (
          <p className="sub-sm" data-k="earlier">{s.earlierZips(earlier.names, earlier.covered, zips.length, mediaOnly)}</p>
        )}
        {zips && zips.length > 0 && <div className="no-print"><ZipAgain zips={zips} /></div>}
        <p className="sub-sm">{s.secondCopy}</p>
        <div className="start-over no-print">
          <p className="sub-sm">{s.closeNow}</p>
          <div><button type="button" className="btn btn-secondary" onClick={onStartOver} aria-describedby="start-over-note">{s.startOver}</button></div>
          <p className="sub-sm" id="start-over-note">{s.startOverNote}</p>
        </div>
      </div>

      <section className="receipt" aria-labelledby="receipt-h">
        <div className="receipt-head">
          <h2 id="receipt-h">{s.receiptH}</h2>
          <span className="sub-sm">{s.when(when)}</span>
        </div>
        <dl className="ledger receipt-rows">
          <div><dt>{s.rSaved}</dt><dd data-k="saved">{s.rSavedValue(saved, mediaOnly)}</dd></div>
          <div><dt>{s.rFailed}</dt><dd data-k="failed">{n(failed)}</dd></div>
          <div><dt>{s.rSavedTo}</dt><dd className="plain" data-k="saved-to">{savedTo}</dd></div>
          <div><dt>{s.rSorted}</dt><dd className="plain">{s.rSortedValue(sorted.years, sorted.months, sorted.noDate)}</dd></div>
          <div className="ledger-total"><dt>{s.rRecovery}</dt><dd className="plain">{s.rRecoveryValue}</dd></div>
          <SafeRow />
        </dl>
        {failed > 0 && (
          <div>
            <button type="button" className="btn btn-link no-print" aria-expanded={showFailed} aria-controls="failed-list" onClick={() => setShowFailed((v) => !v)}>{s.seeWhich}</button>
            <ul id="failed-list" className="failed-list" aria-label={s.failedListLabel} hidden={!showFailed}>
              {failedRecords.map((r) => <li key={r.index}>{r.path}</li>)}
            </ul>
          </div>
        )}
        <p className="sub-sm">{s.receiptNote}</p>
        <div className="actions no-print">
          <button type="button" className="btn btn-secondary btn-sm" onClick={saveReceipt}>{s.saveReceipt}</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>{s.print}</button>
        </div>
      </section>
    </main>
  );
}
