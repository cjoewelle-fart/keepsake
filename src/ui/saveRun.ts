// Saving the selected files (T25): new copies in a chosen folder (Chromium's File System Access
// API), or zip downloads elsewhere. Browser-only; the decisions (paths, names, splitting, zip
// bytes) are in savePlan.ts and zip.ts, which are tested in Node.
//
// Safety rules this file keeps:
// - It only ever writes inside "<chosen>/Keepsake photos". The recovery folder is never opened
//   for writing (the scan's File objects are read-only), and the screen refuses a chosen folder
//   that is the recovery folder or inside it.
// - It never overwrites: each copy is written under a temporary name of its own
//   (".keepsake-partial-<random>.tmp") and only then moved to its final name, which is checked
//   against what's on disk just before the move (T56). A name that appeared meanwhile is skipped
//   for the next " (n)" one.
// - The only removal is of the temporary file this save made, through its own handle, when its
//   copy failed or was stopped, and only while it's still empty (D17). Browsers write to a swap
//   file until close(), so a copy that didn't finish leaves its temporary file empty.
// - Where move() isn't available (older browsers), each copy is created under its final name as
//   before; that path still only removes the empty file it created, if its copy didn't finish.
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

export const canPickFolder = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

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

export type RunEnd = 'done' | 'stopped' | WriteProblem;

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

/**
 * Copy one file into `d` under a free name for `base`/`ext`. Returns the name it got, or null
 * if stopped. Nothing that was in the folder before is ever opened, replaced or removed.
 */
async function copyOne(s: FolderSession, d: DirHandle, k: string, base: string, ext: string, file: File, shouldStop: () => boolean): Promise<string | null> {
  const free = async () => {
    let name = s.book.claim(k, base, ext);
    while (await exists(d, name)) name = s.book.claim(k, base, ext); // appeared since the listing
    return name;
  };
  let name = await free();

  if (s.canMove !== false) {
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
      if (!works) await removeOwnIfEmpty(d, fh, tmp);
    }
    if (s.canMove) {
      let end: 'ok' | 'stopped';
      try {
        end = await writeInto(fh, file, shouldStop);
      } catch (e) {
        await removeOwnIfEmpty(d, fh, tmp);
        throw e;
      }
      if (end === 'stopped') { await removeOwnIfEmpty(d, fh, tmp); return null; }
      // Just before the move: is the name still free? If something took it, use the next one.
      while (await exists(d, name)) { s.book.take(k, name); name = await free(); }
      await fh.move!(name);
      return name;
    }
  }

  // No move(): create the copy under its final name (checked free just above).
  const fh = (await d.getFileHandle(name, { create: true })) as FileHandle;
  let end: 'ok' | 'stopped';
  try {
    end = await writeInto(fh, file, shouldStop);
  } catch (e) {
    await removeOwnIfEmpty(d, fh, name);
    throw e;
  }
  if (end === 'stopped') { await removeOwnIfEmpty(d, fh, name); return null; }
  return name;
}

export type FolderSession = {
  chosen: DirHandle;
  /** Names handed out so far, per folder, seeded from what was on disk. Kept for "Save the rest". */
  book: NameBook;
  dirs: Map<string, DirHandle>;
  /** Where each saved file went (folders below "Keepsake photos"), for the receipt. */
  placed: Map<number, string[]>;
  /** Whether copies can be moved into place from a temporary name (learned on the first copy). */
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
      if ((await copyOne(s, d, k, base, ext, file, ev.shouldStop)) === null) return 'stopped';
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
  onZip(blob: Blob, i: number): void;
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
      ev.onZip(new Blob(blobParts, { type: 'application/zip' }), i);
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
