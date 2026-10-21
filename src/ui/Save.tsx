// Step 5, Save (T25): choose where (EX-choose), saving with a Stop, problems, and the receipt
// (EX-done). Source: team/brand/quiet-prints/EX-*.dc.html; words in copy.ts `save`.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Comlink from 'comlink';
import type { FileRecord } from '../engine/types';
import type { SaveApi } from '../worker/save.worker';
import SaveWorker from '../worker/save.worker.ts?worker&inline';
import { bytes, copy, n } from './copy';
import { ZIP_LIMITS, inRecoveryFolder, insideRecovery, planNames, receiptText, scanFolders, sortedInto, splitParts, zipPath } from './savePlan';
import type { Planned, RecoveryRootDir, ResolvingDir } from './savePlan';
import type { RecoveryRoot } from './recoveryFolder';
import { canPickFolder, download, ensureWritable, hasRoot, newFolderSession, pickFolder, saveAsZip, saveToFolder } from './saveRun';
import type { DirHandle, FolderSession, RunEnd } from './saveRun';
import { END_COST, entryCost } from './zip';
import { mediaType } from './timeline';

type Props = {
  records: FileRecord[];
  files: File[];
  /** Selected FileRecord indices, from the review timeline. */
  ids: number[];
  /** The recovery folder's own handle, when it was picked with the browser's folder picker. */
  recoveryRoot?: RecoveryRoot;
  onBack: () => void;
  /** The header says "Done" on the receipt. */
  onDone: (done: boolean) => void;
};

type Phase =
  | { k: 'choose'; problem?: 'denied' | 'recovery' }
  | { k: 'saving' }
  | { k: 'ended'; end: Exclude<RunEnd, 'done'> }
  | { k: 'done'; when: Date };

const s = copy.save;
const split = (list: readonly Planned[]) => splitParts(list, (p) => entryCost(zipPath(p), p.size), END_COST);

export function Save({ records, files, ids, recoveryRoot, onBack, onDone }: Props) {
  const folderMode = useMemo(() => canPickFolder(), []);
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
    document.querySelector<HTMLElement>('main h1')?.focus();
    onDone(phase.k === 'done');
  }, [phase.k, onDone]);

  /**
   * Is the chosen folder the recovery folder or inside it (T55)? With the recovery folder's own
   * handle this is exact; without one (it came from the file-input fallback) it's the best-effort
   * check from the scanned files' folders. Any error counts as "inside".
   */
  const isRecovery = (chosen: DirHandle) => (recoveryRoot
    ? inRecoveryFolder(recoveryRoot as unknown as RecoveryRootDir, chosen as unknown as ResolvingDir)
    : insideRecovery(chosen as unknown as ResolvingDir, scanFolders(files)).catch(() => true));

  const remaining = () => items.filter((r) => !sess.saved.has(r.index));

  async function finish(end: RunEnd) {
    stop.current = false;
    setStopping(false);
    if (end === 'done') {
      setPhase({ k: 'done', when: new Date() });
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
    if (!sess.savedTo.includes(session.chosen.name)) sess.savedTo.push(session.chosen.name);
    await finish(end);
  }

  async function chooseFolder() {
    let chosen: DirHandle;
    try {
      chosen = await pickFolder();
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // closed the picker: stay here, no message
      setPhase({ k: 'choose', problem: 'denied' });
      return;
    }
    if (await isRecovery(chosen)) {
      setPhase({ k: 'choose', problem: 'recovery' });
      return;
    }
    if (!(await ensureWritable(chosen))) {
      setPhase({ k: 'choose', problem: 'denied' });
      return;
    }
    sess.setFolder(newFolderSession(chosen), await hasRoot(chosen));
    await runFolder();
  }

  async function runZip() {
    const rest = new Set(remaining().map((r) => r.index));
    const parts = split(planned.filter((p) => rest.has(p.id)));
    sess.failed.clear();
    let worked = sess.saved.size;
    setProgress({ done: worked, part: 1, parts: parts.length });
    setPhase({ k: 'saving' });
    const end = await saveAsZip(parts, parts.map((_, i) => i + 1), files, crc, {
      ...ev,
      onPart: (i) => setProgress((p) => ({ ...p, part: i })),
      onWorked: () => { worked++; setProgress((p) => ({ ...p, done: worked })); },
      onZip: (blob, i) => {
        const name = s.zipName(i, parts.length);
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
        sorted={sortedInto(folderMode
          ? [...(sess.folder?.placed.values() ?? [])].map((dir) => ({ dir }))
          : planned.filter((p) => sess.saved.has(p.id)))}
        when={phase.when}
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
          <SafeRow />
        </dl>
        <p className="sub-sm">{s.needSpace(bytes(totalBytes))}</p>
        <p className="sub-sm">{s.newCopies}</p>
        <div><button type="button" className="btn btn-link" onClick={onBack}>{s.back}</button></div>
      </section>

      <div className="sheet-col save-col">
        {phase.problem && (
          <section className="card card-problem" role="alert" aria-labelledby="problem-h">
            <h2 id="problem-h">{phase.problem === 'denied' ? s.deniedH : s.recoveryH}</h2>
            <p className="sub">{phase.problem === 'denied' ? s.deniedBody : s.recoveryBody}</p>
          </section>
        )}
        {folderMode ? (
          <section className="card" aria-labelledby="folder-h">
            <h2 id="folder-h">{s.folderH}</h2>
            <p className="card-body">{s.folderBody}</p>
            <p className="card-body">{s.notTheCard}</p>
            <div>
              <button type="button" className="btn btn-primary" onClick={chooseFolder}>{phase.problem ? s.chooseDifferent : s.chooseFolder}</button>
            </div>
            <p className="sub-sm">{s.browserNote(partCount, bigFile)}</p>
          </section>
        ) : (
          <section className="card" aria-labelledby="zip-h">
            <h2 id="zip-h">{s.zipH}</h2>
            <p className="card-body">{s.zipBody(total, mediaOnly, partCount, bigFile)}</p>
            {bigFile && <p className="card-body">{s.zipBigFile}</p>}
            {partCount > 1 && <p className="sub-sm">{s.zipAllowTip}</p>}
            <div><button type="button" className="btn btn-primary" onClick={runZip}>{s.downloadZips(partCount)}</button></div>
            <p className="sub-sm">{s.zipChromeTip}</p>
          </section>
        )}
        <section className="card card-quiet" aria-labelledby="tree-h">
          <h2 id="tree-h">{s.treeH}</h2>
          <ul className="tree" aria-label={s.treeLabel}>
            <li className="tree-root"><FolderIcon />{s.rootFolder}</li>
            <li style={{ paddingLeft: 30 }}><FolderIcon />{s.treeExample.year}</li>
            <li style={{ paddingLeft: 60 }}><FolderIcon />{s.monthFolder(s.treeExample.month)}</li>
            {s.treeExample.files.map((f) => <li key={f} className="tree-file" style={{ paddingLeft: 90 }}><PhotoIcon />{f}</li>)}
            <li style={{ paddingLeft: 30 }}><FolderIcon />{s.noDateFolder}</li>
          </ul>
          <p className="sub-sm">{s.treeCaption}</p>
        </section>
      </div>
    </main>
  );
}

function SafeRow({ label = copy.results.ledgerSafe }: { label?: string }) {
  const r = copy.results;
  return (
    <div className="ledger-safe">
      <dt><span aria-hidden="true">{label}</span><span className="sr-only">{r.ledgerSafeSr}</span></dt>
      <dd><span aria-hidden="true">{r.ledgerSafeValue}</span><span className="sr-only">{r.ledgerSafeValueSr}</span></dd>
    </div>
  );
}

function ZipAgain({ zips }: { zips: { name: string; blob: Blob }[] }) {
  return (
    <div className="zip-again">
      <p className="sub-sm">{s.zipAgainNote}</p>
      <div className="actions">
        {zips.map((z, i) => (
          <button key={i} type="button" className="btn btn-secondary btn-sm" onClick={() => download(z.blob, z.name)}>{s.zipAgain(i + 1, zips.length)}</button>
        ))}
      </div>
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
  sorted: { years: number; months: number; noDate: number };
  when: Date;
};

function Done({ total, saved, failedRecords, mediaOnly, folderNames, zips, sorted, when }: DoneProps) {
  const [showFailed, setShowFailed] = useState(false);
  const failed = failedRecords.length;
  const savedTo = zips ? s.rSavedToZip(zips.length) : folderNames.map(s.rSavedToFolder).join(' and ');
  const receipt = { when, saved, failed, mediaOnly, savedTo, sorted, failedPaths: failedRecords.map((r) => r.path) };
  const saveReceipt = () => download(new Blob([receiptText(receipt)], { type: 'text/plain;charset=utf-8' }), s.receiptFile);
  return (
    <main className="page done">
      <div className="done-side">
        <div className="fan no-print" aria-hidden="true">
          <div className="fan-print fan-l"><div className="ph ph-a"><i /><i /><i /></div></div>
          <div className="fan-print fan-r"><div className="ph ph-b"><i /><i /><i /></div></div>
          <div className="fan-print fan-c"><div className="ph ph-c"><i /><i /><i /></div></div>
        </div>
        <h1 tabIndex={-1}>
          {failed === 0 || saved === total
            ? <>{s.doneBefore}<span className="accent-num">{n(saved)}</span>{s.doneAfter(saved, mediaOnly)}</>
            : <>{s.partBefore}<span className="accent-num">{n(saved)}</span>{s.partAfter(total, mediaOnly)}</>}
        </h1>
        {failed > 0 && <p className="note-box">{s.failedLine(failed)}</p>}
        <p className="lede">{zips ? s.doneZipLine(zips.length) : s.doneLine}</p>
        <p className="find" data-k="find">{zips ? s.findZip(zips.length) : folderNames.map(s.findThem).join(' ')}</p>
        {zips && zips.length > 0 && <div className="no-print"><ZipAgain zips={zips} /></div>}
        <p className="sub-sm">{s.closeNow}</p>
        <p className="sub-sm">{s.secondCopy}</p>
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
          <SafeRow label={s.rSafe} />
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

const FolderIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="icon">
    <path d="M2 5.5a1.5 1.5 0 011.5-1.5h4l2 2h7A1.5 1.5 0 0118 7.5v7a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 012 14.5z" stroke="#23596B" strokeWidth="1.6" />
  </svg>
);
const PhotoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="icon">
    <rect x="3" y="3" width="14" height="14" rx="3" stroke="#8A4B08" strokeWidth="1.6" />
    <path d="M5 14l3.5-4 3 3 2-2 2 3" stroke="#8A4B08" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
