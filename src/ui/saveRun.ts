// Saving the selected files (T25): new copies in a chosen folder (Chromium's File System Access
// API), or zip downloads elsewhere. Browser-only; the decisions (paths, names, splitting, zip
// bytes) are in savePlan.ts and zip.ts, which are tested in Node.
//
// Safety rules this file keeps:
// - It only ever writes inside "<chosen>/Keepsake photos". The recovery folder is never opened
//   for writing (the scan's File objects are read-only), and the screen refuses a chosen folder
//   that is the recovery folder or inside it.
// - It never opens a file it didn't make: each copy is written under a temporary name of its own
//   (".keepsake-partial-<random>.tmp") and only then moved to its final name, which is checked
//   against what's on disk immediately before the move (T56), with no other step in between. A
//   name that appeared meanwhile is skipped for the next " (n)" one. Known limit: move() replaces
//   a file already at the new name and has no "only if free" option, so a file another program
//   makes in that last instant could still be replaced (see README, "Privacy by design").
// - The only removal is of the temporary file this save made, through its own handle: when its
//   copy failed or was stopped (while it's still empty, D17; browsers write to a swap file until
//   close()), or when the final move failed after a full write (the app's own transient copy;
//   the original in the recovery folder is untouched and "Save the rest" copies it again).
// - Browsers without move() don't write into folders at all: the old create-under-final-name way
//   could open a file another program had just made. They get zip downloads instead
//   (canSaveToFolder() is false up front; a move() that turns out unsupported ends 'unsupported').
import { canUseFolderPicker } from './embedded';
import { NameBook, classifyWriteError, dirKey, placeFor, zipPath } from './savePlan';
import type { Planned, WriteProblem } from './savePlan';
import { ZipWriter, dosFrom } from './zip';
import type { FileRecord } from '../engine/types';
import { copy } from './copy';

/** The pieces of the File System Access API used here (not all are in TypeScript's DOM types). */
export type DirHandle = FileSystemDirectoryHandle & {
  keys(): AsyncIterableIterator<string>;
  queryPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(d: { mode: 'readwrite' }): Promise<PermissionState>;
};
type Writable = { write(data: BufferSource | Blob): Promise<void>; close(): Promise<void>; abort(reason?: unknown): Promise<void> };
type FileHandle = FileSystemFileHandle & {
  createWritable(o?: { keepExistingData?: boolean }): Promise<Writable>;
  /** Rename in the same folder (Chromium; not in every browser). */
  move?(newName: string): Promise<void>;
  /** Remove the entry this handle points to (Chromium). */
  remove?(): Promise<void>;
};

/**
 * Can this browser save straight into a folder? It needs the folder picker and
 * FileSystemFileHandle.move(); without move() the person gets zip downloads instead.
 * Never inside a frame (the claude.ai preview): the picker is refused there.
 * `w` is the window (a parameter so it can be tested in Node).
 */
export function canSaveToFolder(w: object | undefined = typeof window !== 'undefined' ? window : undefined): boolean {
  if (!w || !canUseFolderPicker(w)) return false;
  const proto = (w as { FileSystemFileHandle?: { prototype?: object } }).FileSystemFileHandle?.prototype;
  return !!proto && typeof (proto as { move?: unknown }).move === 'function';
}

export async function pickFolder(): Promise<DirHandle> {
  const pick = (window as unknown as { showDirectoryPicker(o: object): Promise<DirHandle> }).showDirectoryPicker;
  return pick.call(window, { id: 'keepsake-save', mode: 'readwrite', startIn: 'pictures' });
}

/** Ask for write access (needs a click; the folder picker or a "Save the rest" button). */
export async function ensureWritable(dir: DirHandle): Promise<boolean> {
  try {
    if (!dir.queryPermission) return true;
    if ((await dir.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
    return (await dir.requestPermission?.({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}

/** Whether "Keepsake photos" is already in the chosen folder (it's added to, never replaced). */
export async function hasRoot(chosen: DirHandle): Promise<boolean> {
  try {
    await chosen.getDirectoryHandle(copy.save.rootFolder);
    return true;
  } catch {
    return false;
  }
}

/** 'unsupported': move() doesn't work here, nothing was written; save as zip files instead. */
export type RunEnd = 'done' | 'stopped' | 'unsupported' | WriteProblem;

export type RunEvents = {
  /** A file is safely written (folder) or handed to the browser's downloads (zip). */
  onSaved(id: number): void;
  /** The file couldn't be read: skipped, counted in "Couldn't save", saving goes on. */
  onFailed(id: number): void;
  /** Checked between files and between slices of a file. */
  shouldStop(): boolean;
};

const SLICE = 8 * 1024 * 1024;
class SourceError extends Error {}

async function exists(dir: DirHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch (e) {
    const n = (e as Error).name;
    if (n === 'NotFoundError') return false;
    if (n === 'TypeMismatchError') return true; // a folder by that name
    throw e;
  }
}

/** Remove a file this save created, through its own handle, if it's still empty (D17). */
async function removeOwnIfEmpty(dir: DirHandle, fh: FileHandle, name: string) {
  try {
    if ((await fh.getFile()).size !== 0) return;
    if (typeof fh.remove === 'function') await fh.remove();
    else await dir.removeEntry(name);
  } catch { /* leave it; it's an empty file in our own folder */ }
}

/**
 * Remove this save's own temporary copy, full or not, through its own handle. Only ever called
 * with a handle from getFileHandle(<our random temporary name>, {create}), never a final name.
 */
async function removeOwnTemp(dir: DirHandle, fh: FileHandle, name: string) {
  if (!name.startsWith(TEMP_PREFIX)) return;
  try {
    if (typeof fh.remove === 'function') await fh.remove();
    else await dir.removeEntry(name);
  } catch { /* leave it; it's a hidden file in our own folder */ }
}

/** Write a file's bytes in slices. The handle's file only changes on close(). */
async function writeInto(fh: FileHandle, file: File, shouldStop: () => boolean): Promise<'ok' | 'stopped'> {
  const w = await fh.createWritable({ keepExistingData: false });
  try {
    for (let at = 0; at < file.size; at += SLICE) {
      if (shouldStop()) {
        await w.abort().catch(() => {});
        return 'stopped';
      }
      let chunk: ArrayBuffer;
      try {
        chunk = await file.slice(at, Math.min(file.size, at + SLICE)).arrayBuffer();
      } catch (e) {
        throw new SourceError(String(e));
      }
      await w.write(chunk);
    }
    await w.close();
    return 'ok';
  } catch (e) {
    await w.abort().catch(() => {});
    throw e;
  }
}

export const TEMP_PREFIX = '.keepsake-partial-';
function tempName(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return `${TEMP_PREFIX}${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}.tmp`;
}
const unsupported = (e: unknown) => e instanceof TypeError || (e as Error | null)?.name === 'NotSupportedError';

type CopyEnd = { name: string } | 'stopped' | 'unsupported';

/**
 * Copy one file into `d` under a free name for `base`/`ext`. Nothing that was in the folder
 * before is ever opened or removed (see the limit of move() at the top).
 */
async function copyOne(s: FolderSession, d: DirHandle, k: string, base: string, ext: string, file: File, shouldStop: () => boolean): Promise<CopyEnd> {
  if (s.canMove === false) return 'unsupported';
  let tmp = tempName();
  while (await exists(d, tmp)) tmp = tempName();
  const fh = (await d.getFileHandle(tmp, { create: true })) as FileHandle;
  if (s.canMove === undefined) {
    // First copy: try a rename while the file is still empty, to learn whether move() works here.
    let works = typeof fh.move === 'function';
    if (works) {
      const next = tempName();
      try {
        await fh.move!(next);
        tmp = next;
      } catch (e) {
        if (!unsupported(e)) { await removeOwnIfEmpty(d, fh, tmp); throw e; }
        works = false;
      }
    }
    s.canMove = works;
    if (!works) { await removeOwnIfEmpty(d, fh, tmp); return 'unsupported'; }
  }

  let end: 'ok' | 'stopped';
  try {
    end = await writeInto(fh, file, shouldStop);
  } catch (e) {
    await removeOwnIfEmpty(d, fh, tmp);
    throw e;
  }
  if (end === 'stopped') { await removeOwnIfEmpty(d, fh, tmp); return 'stopped'; }

  // The name is chosen and checked only now, after the write. If something took it, use the next one.
  let name = '';
  try {
    for (;;) {
      name = s.book.claim(k, base, ext);
      if (!(await exists(d, name))) break;
    }
    // No other await between the check above and this move: the smallest window the API allows.
    await fh.move!(name);
  } catch (e) {
    // The copy didn't get its name. Give the name back (the retry re-checks the disk, so a name
    // that is in fact taken is still skipped), and remove the full temporary copy: the retry
    // copies the file again from the recovery folder.
    if (name) s.book.release(k, name);
    await removeOwnTemp(d, fh, tmp);
    throw e;
  }
  return { name };
}

export type FolderSession = {
  chosen: DirHandle;
  /** Names handed out so far, per folder, seeded from what was on disk. Kept for "Save the rest". */
  book: NameBook;
  dirs: Map<string, DirHandle>;
  /** Where each saved file went (folders below "Keepsake photos"), for the receipt. */
  placed: Map<number, string[]>;
  /** Whether copies can be moved into place from a temporary name (learned on the first copy; false ends the save 'unsupported'). */
  canMove?: boolean;
};

export const newFolderSession = (chosen: DirHandle): FolderSession => ({ chosen, book: new NameBook(), dirs: new Map(), placed: new Map() });

async function dirFor(s: FolderSession, path: string[]): Promise<DirHandle> {
  const k = dirKey(path);
  let d = s.dirs.get(k);
  if (d) return d;
  const parent = path.length ? await dirFor(s, path.slice(0, -1)) : s.chosen;
  const name = path.length ? path[path.length - 1] : copy.save.rootFolder;
  d = (await parent.getDirectoryHandle(name, { create: true })) as DirHandle;
  s.dirs.set(k, d);
  return d;
}

/** Write new copies into "<chosen>/Keepsake photos/…", oldest first. */
export async function saveToFolder(s: FolderSession, items: readonly { r: FileRecord; file: File }[], ev: RunEvents): Promise<RunEnd> {
  // A browser whose file handles have no move(): don't create anything (not even the folders).
  const FH = (globalThis as { FileSystemFileHandle?: { prototype?: { move?: unknown } } }).FileSystemFileHandle;
  if (s.canMove === false || (FH?.prototype && typeof FH.prototype.move !== 'function')) return 'unsupported';
  for (const { r, file } of items) {
    if (ev.shouldStop()) return 'stopped';
    const { dir, base, ext } = placeFor(r);
    const k = dirKey(dir);
    try {
      const d = await dirFor(s, dir);
      if (!s.book.isSeeded(k)) {
        const names: string[] = [];
        for await (const n of d.keys()) names.push(n);
        s.book.seed(k, names);
      }
      const got = await copyOne(s, d, k, base, ext, file, ev.shouldStop);
      if (got === 'stopped' || got === 'unsupported') return got;
      s.placed.set(r.index, dir);
      ev.onSaved(r.index);
    } catch (e) {
      if (e instanceof SourceError) { ev.onFailed(r.index); continue; }
      return classifyWriteError(e);
    }
  }
  return 'done';
}

export type ZipEvents = RunEvents & {
  /** A part is starting (1-based). */
  onPart(i: number): void;
  /** A part is built; hand it to the browser to download. */
  /** A zip was made: part `i` of the run, holding the files `ids` (T89: the page-wide log keeps these). */
  onZip(blob: Blob, i: number, ids: readonly number[]): void;
  /** One more file looked at (for progress within a part). */
  onWorked(): void;
};

/**
 * Build each zip part as a Blob of [header, File, header, File, …, directory]: the photos
 * themselves are never copied into memory. Only the CRC-32 reads them (in a worker). Stopping
 * finishes the current part with the files already in it, so those are saved.
 */
export async function saveAsZip(
  parts: readonly Planned[][],
  partNumbers: readonly number[],
  files: readonly File[],
  crc: (f: File) => Promise<{ crc: number; size: number }>,
  ev: ZipEvents,
): Promise<RunEnd> {
  for (let pi = 0; pi < parts.length; pi++) {
    const i = partNumbers[pi];
    ev.onPart(i);
    const w = new ZipWriter();
    const blobParts: BlobPart[] = [];
    const ids: number[] = [];
    let stopped = false;
    for (const p of parts[pi]) {
      if (ev.shouldStop()) { stopped = true; break; }
      const file = files[p.id];
      let sum: { crc: number; size: number };
      try {
        sum = await crc(file);
      } catch {
        ev.onFailed(p.id);
        ev.onWorked();
        continue;
      }
      if (sum.size !== file.size) { ev.onFailed(p.id); ev.onWorked(); continue; }
      blobParts.push(w.add({ name: zipPath(p), size: file.size, crc: sum.crc, date: dosFrom(p.takenAt, new Date(file.lastModified)) }), file);
      ids.push(p.id);
      ev.onWorked();
    }
    if (ids.length) {
      blobParts.push(w.finish());
      ev.onZip(new Blob(blobParts, { type: 'application/zip' }), i, ids);
      for (const id of ids) ev.onSaved(id);
    }
    if (stopped) return 'stopped';
  }
  return 'done';
}

/** Start a download of a Blob made on this computer (no network). */
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Big zips are read from the Blob as they download; give the browser time before letting go.
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
