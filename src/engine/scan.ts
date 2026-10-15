import exifr from 'exifr';
import { exifTiff, heifLayout, type Range } from './heif';
import { PHOTO_KINDS, VIDEO_KINDS, endsCleanly, imageSize, sniff, type Kind, type SizeResult } from './sniff';
import type { FileRecord, FileSource, Progress, Rules } from './types';
import { DEFAULT_RULES } from './types';

const HEAD_BYTES = 256 * 1024; // enough for photo details and the JPEG frame header
const TAIL_BYTES = 64 * 1024; // room for phone trailers and padding after the end of the picture
const FULL_HASH_LIMIT = 64 * 1024 * 1024; // bigger files get a sampled fingerprint
const EXIF_MAX = 1024 * 1024; // a HEIF Exif block bigger than this is ignored (real ones are a few KB)
const HEIF_KINDS: ReadonlySet<Kind> = new Set(['heic', 'avif']);

type Meta = { camera?: string; takenAt?: string };

/** Photo details from a JPEG/PNG/WebP/TIFF start of file, or from a bare TIFF-structured Exif block. */
async function readMeta(bytes: Uint8Array): Promise<Meta> {
  try {
    const t = await exifr.parse(bytes, {
      pick: ['Make', 'Model', 'DateTimeOriginal', 'CreateDate'],
      reviveValues: false, // keep the camera's own date text; no time zone guessing
    });
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
    return src.size < rules.smallBytes
      ? { ...base, kind, group: 'damaged', reason: 'cut-off' }
      : { ...base, kind, group: 'keep', reason: 'video' };
  }
  if (!PHOTO_KINDS.has(kind)) return { ...base, kind, group: 'system', reason: 'not-media' };

  let size: SizeResult;
  let meta: Meta;
  if (HEIF_KINDS.has(kind)) {
    // HEIC/AVIF: the box structure says how long everything is, so no need to read the tail.
    const layout = await heifLayout((s, e) => src.read(s, e), src.size, head);
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
    const tail = await src.read(tailStart, src.size);
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

async function fingerprint(src: FileSource): Promise<string> {
  if (src.size <= FULL_HASH_LIMIT) {
    return hex(await crypto.subtle.digest('SHA-256', await src.read(0, src.size) as BufferSource));
  }
  const part = 4 * 1024 * 1024;
  const a = await src.read(0, part);
  const z = await src.read(src.size - part, src.size);
  const both = new Uint8Array(a.length + z.length);
  both.set(a);
  both.set(z, a.length);
  return `${src.size}:` + hex(await crypto.subtle.digest('SHA-256', both as BufferSource));
}

/** Higher = better original to keep among identical copies. */
const richness = (r: FileRecord) => (r.takenAt ? 2 : 0) + (r.camera ? 1 : 0);

/**
 * Among files still in Keep, mark exact copies. Only files that share a byte size
 * with another file are fingerprinted, which skips most of the expensive reading.
 */
export async function markCopies(
  records: FileRecord[],
  sources: FileSource[],
  onProgress?: (p: Progress) => void,
  isCancelled?: () => boolean,
): Promise<void> {
  const bySize = new Map<number, FileRecord[]>();
  for (const r of records) {
    if (r.group !== 'keep') continue;
    const list = bySize.get(r.size);
    if (list) list.push(r); else bySize.set(r.size, [r]);
  }
  const suspects = [...bySize.values()].filter((l) => l.length > 1);
  const total = suspects.reduce((n, l) => n + l.length, 0);
  let done = 0;
  let lastReport = 0;
  for (const list of suspects) {
    const byPrint = new Map<string, FileRecord[]>();
    for (const r of list) {
      if (isCancelled?.()) return;
      done++;
      let fp: string;
      try {
        fp = await fingerprint(sources[r.index]);
      } catch {
        continue; // couldn't read it in full: leave it in Keep rather than lose the scan
      }
      const same = byPrint.get(fp);
      if (same) same.push(r); else byPrint.set(fp, [r]);
      const now = Date.now();
      if (now - lastReport > 100 || done === total) {
        lastReport = now;
        onProgress?.({ stage: 'copies', done, total });
      }
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
  isCancelled?: () => boolean;
  concurrency?: number;
};

/** Scan every file. Returns null if cancelled. Never writes anything. */
export async function scanAll(sources: FileSource[], opts: ScanOptions = {}): Promise<FileRecord[] | null> {
  const { rules = DEFAULT_RULES, onProgress, isCancelled, concurrency = 6 } = opts;
  const records: FileRecord[] = new Array(sources.length);
  let next = 0;
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
      try {
        records[i] = await inspect(sources[i], i, rules);
      } catch {
        try {
          records[i] = await inspect(sources[i], i, rules); // flaky cards often succeed on a second try
        } catch {
          // Couldn't read it at all. Keep it rather than hide a possible photo under "damaged".
          records[i] = { index: i, path: sources[i].path, size: sources[i].size, kind: 'other', group: 'keep', reason: 'not-checked' };
        }
      }
      done++;
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, worker));
  if (isCancelled?.()) return null;
  report(true);
  await markCopies(records, sources, onProgress, isCancelled);
  if (isCancelled?.()) return null;
  return records;
}
