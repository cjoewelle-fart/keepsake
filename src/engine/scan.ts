import exifr from 'exifr';
import { exifTiff, heifLayout, type Range } from './heif';
import { PHOTO_KINDS, VIDEO_KINDS, endsCleanly, imageSize, sniff, type Kind, type SizeResult } from './sniff';
import type { FileRecord, FileSource, Progress, Rules } from './types';
import { Sha256 } from './sha256';
import { videoInfo, type VideoInfo } from './video';
import { DEFAULT_RULES } from './types';

const HEAD_BYTES = 256 * 1024; // enough for photo details and the JPEG frame header
const TAIL_BYTES = 64 * 1024; // room for phone trailers and padding after the end of the picture
const WHOLE_READ_LIMIT = 16 * 1024 * 1024; // copy suspects up to this size are read whole; bigger ones in pieces
const SAMPLE_BYTES = 1024 * 1024; // start and end compared first for big copy suspects
const SLICE_BYTES = 1024 * 1024; // piece size when reading a big file in full
const EXIF_MAX = 1024 * 1024; // a HEIF Exif block bigger than this is ignored (real ones are a few KB)
const HEIF_KINDS: ReadonlySet<Kind> = new Set(['heic', 'avif']);

type Meta = { camera?: string; takenAt?: string };

// One shared options object: exifr caches parsed options in a module-level Map keyed by the
// object itself and never clears it, so a fresh literal per call leaked ~6 KB per photo (T27).
const EXIFR_OPTIONS = {
  pick: ['Make', 'Model', 'DateTimeOriginal', 'CreateDate'],
  reviveValues: false, // keep the camera's own date text; no time zone guessing
};

/** Photo details from a JPEG/PNG/WebP/TIFF start of file, or from a bare TIFF-structured Exif block. */
async function readMeta(bytes: Uint8Array): Promise<Meta> {
  try {
    const t = await exifr.parse(bytes, EXIFR_OPTIONS);
    if (!t) return {};
    const make = typeof t.Make === 'string' ? t.Make.trim() : '';
    const model = typeof t.Model === 'string' ? t.Model.trim() : '';
    const camera = model ? (model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`.trim()) : make || undefined;
    return { camera, takenAt: normalizeDate(t.DateTimeOriginal ?? t.CreateDate) };
  } catch {
    return {};
  }
}

/**
 * HEIF keeps its Exif block wherever 'iloc' says, often after the picture data, so read
 * exactly those bytes (from the head if they're there) instead of hoping they're near the start.
 */
async function readHeifMeta(src: FileSource, head: Uint8Array, exif: Range[] | undefined): Promise<Meta> {
  if (!exif) return {};
  const total = exif.reduce((n, r) => n + (r.end - r.start), 0);
  if (total > EXIF_MAX || exif.some((r) => r.end > src.size)) return {};
  const item = new Uint8Array(total);
  let at = 0;
  for (const r of exif) {
    item.set(r.end <= head.length ? head.subarray(r.start, r.end) : await src.read(r.start, r.end), at);
    at += r.end - r.start;
  }
  const tiff = exifTiff(item);
  return tiff ? readMeta(tiff) : {};
}

/** Videos built from MP4/QuickTime boxes, where the capture date lives in 'moov'. */
const BOX_VIDEO_KINDS: ReadonlySet<Kind> = new Set(['mp4', 'mov', '3gp']);

/**
 * A video's boxes give its date and length, and show when it was cut off. A read error means
 * "nothing learned", never a different group: the video is kept exactly as it was before.
 */
async function readVideo(src: FileSource, head: Uint8Array): Promise<VideoInfo> {
  try {
    return await videoInfo((s, e) => src.read(s, e), src.size, head);
  } catch {
    return {};
  }
}

/** '2023:03:11 12:45:20' -> '2023-03-11T12:45:20'; rejects zeroed or impossible dates. */
export function normalizeDate(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const m = v.match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s] = m;
  const year = Number(y);
  if (year < 1990 || year > 2100 || Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return undefined;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

/** Look at one file and decide its group, except for copies (decided across files later). */
export async function inspect(src: FileSource, index: number, rules: Rules = DEFAULT_RULES): Promise<FileRecord> {
  const base = { index, path: src.path, size: src.size };
  if (src.size === 0) return { ...base, kind: 'empty', group: 'damaged', reason: 'empty-file' };

  const head = await src.read(0, Math.min(src.size, HEAD_BYTES));
  const kind = sniff(head);

  if (VIDEO_KINDS.has(kind)) {
    if (src.size < rules.smallBytes) return { ...base, kind, group: 'damaged', reason: 'cut-off' };
    const { takenAt, durationSec, cutOff, codec } = BOX_VIDEO_KINDS.has(kind) ? await readVideo(src, head) : {};
    const dated = takenAt ? { takenAt } : {};
    // Cut off: the boxes stop before the file says they should, or there's no 'moov' at all.
    // The date (if 'moov' survived) stays so a video someone keeps anyway still lands on its day;
    // the length doesn't, because it describes the whole video, not what's left of it.
    if (cutOff) return { ...base, kind, ...dated, group: 'damaged', reason: 'cut-off' };
    return { ...base, kind, ...dated, ...(durationSec !== undefined ? { durationSec } : {}), ...(codec ? { codec } : {}), group: 'keep', reason: 'video' };
  }
  if (!PHOTO_KINDS.has(kind)) return { ...base, kind, group: 'system', reason: 'not-media' };

  let size: SizeResult;
  let meta: Meta;
  if (HEIF_KINDS.has(kind)) {
    // HEIC/AVIF: the box structure says how long everything is, so no need to read the tail.
    const layout = await heifLayout((s, e) => src.read(s, e), src.size, head);
    // Couldn't check it fully (huge table of contents, or data stored in another file): keep it.
    if (layout.unchecked) {
      const dims = typeof layout.size === 'object' ? layout.size : undefined;
      return { ...base, kind, ...dims, ...(await readHeifMeta(src, head, layout.exif)), group: 'keep', reason: 'not-checked' };
    }
    if (layout.cutOff) return { ...base, kind, group: 'damaged', reason: 'cut-off' };
    if (layout.size === 'invalid') return { ...base, kind, group: 'damaged', reason: 'unreadable' };
    size = layout.size;
    meta = await readHeifMeta(src, head, layout.exif);
  } else {
    size = imageSize(kind, head);
    if (size === 'invalid') return { ...base, kind, group: 'damaged', reason: 'unreadable' };
    // We read the whole file and never found where the picture starts: its structure is broken.
    if (size === 'beyond' && head.length >= src.size) return { ...base, kind, group: 'damaged', reason: 'unreadable' };
    const tailStart = Math.max(0, src.size - TAIL_BYTES);
    // A file that fits in the head was read whole already: its tail is the same bytes (T27).
    const tail = head.length >= src.size ? head.subarray(tailStart, src.size) : await src.read(tailStart, src.size);
    if (!endsCleanly(kind, tail, { tailStart, head })) return { ...base, kind, group: 'damaged', reason: 'cut-off' };
    meta = await readMeta(head);
  }
  const dims = typeof size === 'object' ? size : undefined;
  const rec: FileRecord = { ...base, kind, ...dims, ...meta, group: 'keep', reason: 'photo' };

  // Real photos carry camera details or a date taken; previews and icons made by apps almost never do.
  // So a small image with either is kept (an old phone's 320x240 photo is still a memory).
  // File size alone is only used when the pixel size is unknown: a full-size screenshot
  // or a heavily compressed shared photo can be under 20 KB and still matter.
  if (!meta.camera && !meta.takenAt) {
    if (dims && Math.min(dims.width, dims.height) < rules.minShortSide) return { ...rec, group: 'small', reason: 'low-resolution' };
    if (!dims && src.size < rules.smallBytes) return { ...rec, group: 'small', reason: 'tiny-file' };
  }
  return rec;
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');

/**
 * Fingerprint `src` from `start` to `end` in SLICE_BYTES pieces, so memory stays flat however
 * big the file is, checking for Stop between pieces. Returns null if the scan was cancelled.
 */
async function streamHash(src: FileSource, ranges: [number, number][], isCancelled?: () => boolean): Promise<string | null> {
  const h = new Sha256();
  for (const [start, end] of ranges) {
    for (let at = start; at < end; at += SLICE_BYTES) {
      if (isCancelled?.()) return null;
      const piece = await src.read(at, Math.min(end, at + SLICE_BYTES));
      if (piece.length !== Math.min(end, at + SLICE_BYTES) - at) throw new Error('short read');
      h.update(piece);
    }
  }
  return h.hex();
}

/**
 * The cheap first look at a copy suspect. Files up to WHOLE_READ_LIMIT get their full
 * fingerprint ('f:'); bigger ones only a fingerprint of their first and last SAMPLE_BYTES ('s:'),
 * which can only rule copies out. Returns null if the scan was cancelled.
 */
async function quickPrint(src: FileSource, isCancelled?: () => boolean): Promise<string | null> {
  if (src.size <= WHOLE_READ_LIMIT) {
    return 'f:' + hex(await crypto.subtle.digest('SHA-256', await src.read(0, src.size) as BufferSource));
  }
  const p = await streamHash(src, [[0, SAMPLE_BYTES], [src.size - SAMPLE_BYTES, src.size]], isCancelled);
  return p === null ? null : 's:' + p;
}

/** Every byte of a big file, read in pieces. Returns null if the scan was cancelled. */
async function fullPrint(src: FileSource, isCancelled?: () => boolean): Promise<string | null> {
  const p = await streamHash(src, [[0, src.size]], isCancelled);
  return p === null ? null : 'f:' + p;
}

/**
 * Run `job(0..count-1)` with at most `width` running at once. A job that returns false, or
 * Stop, ends the run and pool returns false. (Jobs handle their own read errors.)
 */
async function pool(count: number, width: number, job: (i: number) => Promise<boolean>, isCancelled?: () => boolean): Promise<boolean> {
  let next = 0;
  let stopped = false;
  const lane = async () => {
    while (next < count && !stopped) {
      if (isCancelled?.()) { stopped = true; return; }
      const i = next++;
      if (!(await job(i))) { stopped = true; return; }
    }
  };
  const w = Math.max(1, Math.min(Math.floor(width) || 1, count));
  await Promise.all(Array.from({ length: count ? w : 0 }, lane));
  return !stopped && !isCancelled?.();
}

/** Higher = better original to keep among identical copies. */
const richness = (r: FileRecord) => (r.takenAt ? 2 : 0) + (r.camera ? 1 : 0);

/**
 * Among files still in Keep, mark exact copies. Only files that share a byte size
 * with another file are fingerprinted, which skips most of the expensive reading.
 *
 * Cheap first, thorough second: files up to 16 MB are fingerprinted whole straight away. Bigger
 * ones (long videos) first get a fingerprint of their first and last 1 MB; only those whose
 * sample matches another same-size file's are then read in full, 1 MB at a time, so two files
 * are only called copies when every byte matches, without ever holding a big file in memory.
 *
 * Up to `concurrency` files are fingerprinted at once (each holds at most 16 MB). Fingerprints
 * are collected first and the copies are decided afterwards in file order, so the result never
 * depends on which read finished first. Cancelling stops new reads at once and marks nothing.
 */
export async function markCopies(
  records: FileRecord[],
  sources: FileSource[],
  onProgress?: (p: Progress) => void,
  isCancelled?: () => boolean,
  concurrency = 4,
): Promise<void> {
  const bySize = new Map<number, FileRecord[]>();
  for (const r of records) {
    if (r.group !== 'keep') continue;
    const list = bySize.get(r.size);
    if (list) list.push(r); else bySize.set(r.size, [r]);
  }
  const suspects = [...bySize.values()].filter((l) => l.length > 1);
  const queue = suspects.flat();
  const big = (r: FileRecord) => r.size > WHOLE_READ_LIMIT;
  // A big file is two steps (sample, then maybe the full read), so the total is known up front.
  const total = queue.length + queue.filter(big).length;
  // Fingerprint per queue position; undefined = couldn't read it (stays in Keep).
  const prints: (string | undefined)[] = new Array(queue.length);
  let done = 0;
  let lastReport = 0;
  const tick = (by = 1) => {
    done += by;
    const now = Date.now();
    if (now - lastReport > 100 || done === total) {
      lastReport = now;
      onProgress?.({ stage: 'copies', done, total });
    }
  };

  const first = await pool(queue.length, concurrency, async (i) => {
    let fp: string | null;
    try {
      fp = await quickPrint(sources[queue[i].index], isCancelled);
    } catch {
      tick(big(queue[i]) ? 2 : 1); // couldn't read it: it stays in Keep, and has no second step
      return true;
    }
    if (fp === null) return false;
    prints[i] = fp;
    tick();
    return true;
  }, isCancelled);
  if (!first) return;

  // Big files whose start and end match another same-size file's: read them in full.
  const again: number[] = [];
  let at = 0;
  for (const list of suspects) {
    const seen = new Map<string, number>();
    for (let k = 0; k < list.length; k++) { const fp = prints[at + k]; if (fp?.startsWith('s:')) seen.set(fp, (seen.get(fp) ?? 0) + 1); }
    for (let k = 0; k < list.length; k++) {
      const fp = prints[at + k];
      if (fp?.startsWith('s:')) {
        if (seen.get(fp)! > 1) again.push(at + k); else tick(); // unique start and end: can't be a copy
      }
    }
    at += list.length;
  }
  const second = await pool(again.length, concurrency, async (j) => {
    const i = again[j];
    prints[i] = undefined; // a sample alone never decides a copy
    let fp: string | null;
    try {
      fp = await fullPrint(sources[queue[i].index], isCancelled);
    } catch {
      tick(); // couldn't read it in full: it stays in Keep
      return true;
    }
    if (fp === null) return false;
    prints[i] = fp;
    tick();
    return true;
  }, isCancelled);
  if (!second) return;

  at = 0;
  for (const list of suspects) {
    const byPrint = new Map<string, FileRecord[]>();
    for (const r of list) {
      const fp = prints[at++];
      if (fp === undefined || !fp.startsWith('f:')) continue;
      const same = byPrint.get(fp);
      if (same) same.push(r); else byPrint.set(fp, [r]);
    }
    for (const same of byPrint.values()) {
      if (same.length < 2) continue;
      const [keeper] = [...same].sort((a, b) => richness(b) - richness(a) || a.index - b.index);
      for (const r of same) {
        if (r === keeper) continue;
        r.group = 'duplicate';
        r.reason = 'copy';
        r.copyOf = keeper.index;
      }
    }
  }
}

export type ScanOptions = {
  rules?: Rules;
  onProgress?: (p: Progress) => void;
  /** Polled often (between files, between 1 MB pieces, and on a short timer), so Stop answers fast. */
  isCancelled?: () => boolean;
  /** Files inspected at once (only the start and end of each file are read). */
  concurrency?: number;
  /** Copy suspects fingerprinted at once; each holds at most 16 MB in memory. */
  copyConcurrency?: number;
  /**
   * Waited on before file `i` is looked at, for files still arriving (T52). Rejects when no more
   * files will come; the scan then ends with null.
   */
  ready?: (i: number) => Promise<void>;
  /**
   * Told when file `i` is set aside by the first pass (T57). Only files still in Keep are read
   * again (by the copy check), so the caller can let go of this file's source.
   */
  setAside?: (i: number) => void;
};

/** How often scanAll checks for Stop while it waits on a slow read. */
const STOP_POLL_MS = 25;

/**
 * Scan every file. Returns null if cancelled. Never writes anything.
 *
 * Stop answers within about STOP_POLL_MS even while a read is in flight (a slow card can take
 * seconds for one): the scan returns null at once, and the work still running sees the flag at
 * its next check (between files or 1 MB pieces) and ends without reporting progress.
 */
export async function scanAll(sources: FileSource[], opts: ScanOptions = {}): Promise<FileRecord[] | null> {
  const { rules = DEFAULT_RULES, isCancelled, concurrency = 6, copyConcurrency = 4, ready, setAside } = opts;
  const onProgress = opts.onProgress && ((p: Progress) => { if (!isCancelled?.()) opts.onProgress!(p); });
  const work = scanWork(sources, rules, onProgress, isCancelled, concurrency, copyConcurrency, ready, setAside);
  if (!isCancelled) return work;
  work.catch(() => {}); // if Stop wins the race, a later failure of the abandoned work isn't an error
  let timer: ReturnType<typeof setInterval> | undefined;
  const stopped = new Promise<null>((resolve) => {
    timer = setInterval(() => { if (isCancelled()) resolve(null); }, STOP_POLL_MS);
  });
  try {
    return await Promise.race([work, stopped]);
  } finally {
    clearInterval(timer);
  }
}

async function scanWork(
  sources: FileSource[],
  rules: Rules,
  onProgress: ((p: Progress) => void) | undefined,
  isCancelled: (() => boolean) | undefined,
  concurrency: number,
  copyConcurrency: number,
  ready: ((i: number) => Promise<void>) | undefined,
  setAside: ((i: number) => void) | undefined,
): Promise<FileRecord[] | null> {
  const records: FileRecord[] = new Array(sources.length);
  let next = 0;
  let abandoned = false; // files stopped arriving
  let done = 0;
  let lastReport = 0;
  const report = (force = false) => {
    const now = Date.now();
    if (force || now - lastReport > 100) {
      lastReport = now;
      onProgress?.({ stage: 'checking', done, total: sources.length });
    }
  };
  const worker = async () => {
    while (next < sources.length) {
      if (isCancelled?.()) return;
      const i = next++;
      if (ready) {
        try { await ready(i); } catch { abandoned = true; return; }
        if (isCancelled?.()) return;
      }
      try {
        records[i] = await inspect(sources[i], i, rules);
      } catch {
        if (isCancelled?.()) return;
        try {
          records[i] = await inspect(sources[i], i, rules); // flaky cards often succeed on a second try
        } catch {
          // Couldn't read it at all. Keep it rather than hide a possible photo under "damaged".
          records[i] = { index: i, path: sources[i].path, size: sources[i].size, kind: 'other', group: 'keep', reason: 'not-checked' };
        }
      }
      if (records[i].group !== 'keep') setAside?.(i);
      done++;
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, worker));
  if (isCancelled?.() || abandoned) return null;
  report(true);
  await markCopies(records, sources, onProgress, isCancelled, copyConcurrency);
  if (isCancelled?.()) return null;
  return records;
}
