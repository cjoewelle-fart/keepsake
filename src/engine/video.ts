// Video capture dates from MP4/QuickTime/3GP containers (ISO base media file format).
// Pure byte parsing: only box headers and a few small boxes are read, never the video data.
//
// The file is a list of boxes. 'moov' describes the movie and may come before or after the
// (huge) 'mdat' box that holds the frames, so we hop from header to header instead of reading
// the file. Inside 'moov':
// - 'mvhd' holds creation_time: seconds since 1904-01-01 UTC (32-bit in version 0, 64-bit in 1).
// - 'meta' (QuickTime, iPhones and many Androids) may hold 'com.apple.quicktime.creationdate',
//   an ISO 8601 text date in the camera's local time. We prefer it when it's valid, because
//   photos are stored in local time too.

import { readBoxHeader, type BoxHeader } from './heif';

type Read = (start: number, end: number) => Promise<Uint8Array>;

const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

/** Seconds between 1904-01-01 and 1970-01-01 (both UTC). */
const MAC_EPOCH_OFFSET = 2_082_844_800;
/** Earliest date we believe. Cameras with unset clocks write 1904, 1970, 1980 or 2000-ish defaults. */
const EARLIEST_MS = Date.UTC(1995, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;
/** Largest QuickTime 'meta' box we'll read. Real ones are a few KB. */
const META_MAX = 1024 * 1024;
const MAX_BOXES = 10_000;

const plausible = (ms: number, now: number) => Number.isFinite(ms) && ms >= EARLIEST_MS && ms <= now + DAY_MS;
/**
 * Exactly midnight on 1 January is what cameras write after a clock reset (2000-01-01 00:00:00
 * and similar). A real recording starting on that exact second is rare enough to give up.
 */
const isResetDefault = (iso: string) => iso.slice(5) === '01-01T00:00:00';

/** 'YYYY-MM-DDTHH:mm:ss' for a UTC instant. */
const isoUtc = (ms: number) => new Date(ms).toISOString().slice(0, 19);

/**
 * Parse an mvhd box body (starting at its version byte). Returns the creation time as
 * 'YYYY-MM-DDTHH:mm:ss' in UTC, or undefined for zero, implausible or unreadable values.
 */
export function mvhdDate(body: Uint8Array, now = Date.now()): string | undefined {
  if (body.length < 4) return undefined;
  const version = body[0];
  let secs: number;
  if (version === 0) {
    if (body.length < 8) return undefined;
    secs = u32(body, 4);
  } else if (version === 1) {
    if (body.length < 12) return undefined;
    const hi = u32(body, 4);
    if (hi >= 0x200000) return undefined; // beyond 2^53: nonsense
    secs = hi * 2 ** 32 + u32(body, 8);
  } else {
    return undefined;
  }
  if (secs === 0) return undefined;
  const ms = (secs - MAC_EPOCH_OFFSET) * 1000;
  if (!plausible(ms, now)) return undefined;
  const iso = isoUtc(ms);
  return isResetDefault(iso) ? undefined : iso;
}

/**
 * '2023-03-11T12:45:20+0100' -> '2023-03-11T12:45:20' (the camera's local time, like photos).
 * Rejects text that isn't a full date and time, impossible fields, and implausible dates.
 */
export function quicktimeDate(text: string, now = Date.now()): string | undefined {
  const m = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s = '00', zone] = m;
  const n = [y, mo, d, h, mi, s].map(Number);
  if (n[1] < 1 || n[1] > 12 || n[2] < 1 || n[2] > 31 || n[3] > 23 || n[4] > 59 || n[5] > 59) return undefined;
  let ms = Date.UTC(n[0], n[1] - 1, n[2], n[3], n[4], n[5]);
  if (zone && zone !== 'Z') {
    const z = zone.replace(':', '');
    const offMin = (Number(z.slice(1, 3)) * 60 + Number(z.slice(3, 5))) * (z[0] === '-' ? -1 : 1);
    ms -= offMin * 60_000; // to UTC, for the "not in the future" check
  }
  if (!plausible(ms, now)) return undefined;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  return isResetDefault(iso) ? undefined : iso;
}

/** Child boxes of a box held fully in `b`, between offsets `from` and `to`. Item boxes in 'ilst' have numeric types, so no fourcc check. */
function rawChildren(b: Uint8Array, from: number, to: number): { type: number; body: number; end: number }[] {
  const out = [];
  let at = from;
  while (at + 8 <= to) {
    const size = u32(b, at);
    if (size < 8 || at + size > to) break;
    out.push({ type: u32(b, at + 4), body: at + 8, end: at + size });
    at += size;
  }
  return out;
}

const tag = (s: string) => u32(new Uint8Array([...s].map((c) => c.charCodeAt(0))), 0);
const T_HDLR = tag('hdlr');
const T_KEYS = tag('keys');
const T_ILST = tag('ilst');
const T_DATA = tag('data');

/**
 * The 'com.apple.quicktime.creationdate' text from a QuickTime 'meta' box (the whole box,
 * header included). QuickTime's 'meta' has no version/flags field, ISO's does; accept both.
 */
export function quicktimeCreationText(meta: Uint8Array): string | undefined {
  if (meta.length < 16) return undefined;
  const first = u32(meta, 12);
  const start = first === T_HDLR || first === T_KEYS ? 8 : 12; // otherwise skip ISO version/flags
  const kids = rawChildren(meta, start, meta.length);
  const keys = kids.find((k) => k.type === T_KEYS);
  const ilst = kids.find((k) => k.type === T_ILST);
  if (!keys || !ilst) return undefined;

  // keys: version/flags, entry_count, then [size, namespace, name] entries numbered from 1.
  let index = 0;
  let at = keys.body + 8;
  const count = keys.body + 8 <= keys.end ? u32(meta, keys.body + 4) : 0;
  for (let i = 1; i <= count && at + 8 <= keys.end; i++) {
    const size = u32(meta, at);
    if (size < 8 || at + size > keys.end) break;
    let name = '';
    for (let k = at + 8; k < at + size; k++) name += String.fromCharCode(meta[k]);
    if (name === 'com.apple.quicktime.creationdate') { index = i; break; }
    at += size;
  }
  if (!index) return undefined;

  const item = rawChildren(meta, ilst.body, ilst.end).find((k) => k.type === index);
  if (!item) return undefined;
  const data = rawChildren(meta, item.body, item.end).find((k) => k.type === T_DATA);
  if (!data || data.body + 8 > data.end) return undefined;
  const typeCode = u32(meta, data.body) & 0xffffff;
  if (typeCode !== 1) return undefined; // 1 = UTF-8 text
  const bytes = meta.subarray(data.body + 8, Math.min(data.end, data.body + 8 + 64));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

/**
 * Find the capture date of an MP4/MOV/3GP video. `head` is the start of the file already read.
 * Returns 'YYYY-MM-DDTHH:mm:ss' or undefined when there's no believable date. Never throws on
 * malformed or truncated files (read errors from `read` do propagate).
 */
export async function videoDate(read: Read, fileSize: number, head: Uint8Array, now = Date.now()): Promise<string | undefined> {
  const bytesAt = async (s: number, e: number) => {
    const end = Math.min(e, fileSize);
    return end <= head.length ? head.subarray(s, end) : read(s, end);
  };
  const header = async (at: number, limit: number): Promise<BoxHeader | null> => {
    const h = readBoxHeader(await bytesAt(at, at + 16), 0, at, limit);
    return h && h.end > at ? h : null;
  };

  // Top level: hop over boxes until 'moov'.
  let moov: BoxHeader | undefined;
  let moovAt = 0;
  for (let at = 0, n = 0; at + 8 <= fileSize && n < MAX_BOXES; n++) {
    const h = await header(at, fileSize);
    if (!h) return undefined;
    if (h.type === 'moov') { moov = h; moovAt = at; break; }
    at = h.end;
  }
  if (!moov) return undefined;

  // Inside 'moov': only read the small boxes we need. A cut-off moov is fine if they're whole.
  const moovEnd = Math.min(moov.end, fileSize);
  let fromMvhd: string | undefined;
  let fromMeta: string | undefined;
  for (let at = moovAt + moov.headerLen, n = 0; at + 8 <= moovEnd && n < MAX_BOXES; n++) {
    const h = await header(at, moov.end);
    if (!h || h.end > moovEnd) break;
    if (h.type === 'mvhd' && fromMvhd === undefined) {
      fromMvhd = mvhdDate(await bytesAt(at + h.headerLen, Math.min(h.end, at + h.headerLen + 16)), now);
    } else if (h.type === 'meta' && fromMeta === undefined && h.end - at <= META_MAX) {
      const text = quicktimeCreationText(await bytesAt(at, h.end));
      if (text) fromMeta = quicktimeDate(text, now);
    }
    at = h.end;
  }
  return fromMeta ?? fromMvhd;
}
