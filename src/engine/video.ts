// Video capture dates, lengths and cut-off checks for MP4/QuickTime/3GP containers
// (ISO base media file format).
// Pure byte parsing: only box headers and a few small boxes are read, never the video data.
//
// The file is a list of boxes. 'moov' describes the movie and may come before or after the
// (huge) 'mdat' box that holds the frames, so we hop from header to header instead of reading
// the file. Inside 'moov':
// - 'mvhd' holds creation_time: seconds since 1904-01-01 UTC (32-bit in version 0, 64-bit in 1).
// - 'meta' (QuickTime, iPhones and many Androids) may hold 'com.apple.quicktime.creationdate',
//   an ISO 8601 text date in the camera's local time. We prefer it when it's valid, because
//   photos are stored in local time too.
// - 'mvhd' also holds the length (duration / timescale).
// A recovered video whose boxes stop before the file says they should, or that has no 'moov'
// at all, can't be played as it is: that's how a cut-off video is told apart from a whole one.

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
const T_MEHD = tag('mehd');

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

export type VideoInfo = {
  /** 'YYYY-MM-DDTHH:mm:ss', or undefined when there's no believable date. */
  takenAt?: string;
  /** Length in seconds from 'mvhd' (or 'mehd' for fragmented files), when it's believable. */
  durationSec?: number;
  /**
   * The file stops early: a top-level box says it's longer than what's left of the file,
   * or the boxes run cleanly to the end of the file and none of them is 'moov' (the part
   * that tells a player how to play the video). Only set when the walk proves it.
   */
  cutOff?: boolean;
};

/** Longest length we believe (a week): anything bigger is a broken or placeholder value. */
const MAX_DURATION_SEC = 7 * 24 * 3600;

/**
 * Parse the length out of an 'mvhd' body (from its version byte): duration / timescale.
 * Undefined for version 0/1 "unknown" all-ones values, zero timescale, or nonsense.
 */
export function mvhdDuration(body: Uint8Array): number | undefined {
  if (body.length < 4) return undefined;
  const version = body[0];
  let timescale: number;
  let duration: number;
  if (version === 0) {
    if (body.length < 20) return undefined;
    timescale = u32(body, 12);
    duration = u32(body, 16);
    if (duration === 0xffffffff) return undefined;
  } else if (version === 1) {
    if (body.length < 32) return undefined;
    timescale = u32(body, 20);
    const hi = u32(body, 24);
    if (hi >= 0x200000) return undefined; // all-ones "unknown", or beyond 2^53
    duration = hi * 2 ** 32 + u32(body, 28);
  } else {
    return undefined;
  }
  return toSeconds(duration, timescale);
}

const toSeconds = (duration: number, timescale: number) => {
  if (!timescale || !duration) return undefined;
  const secs = duration / timescale;
  return Number.isFinite(secs) && secs > 0 && secs <= MAX_DURATION_SEC ? secs : undefined;
};

/** The fragment_duration from a whole 'mvex' box (header included), in the movie's timescale. */
function mehdDuration(mvex: Uint8Array): number | undefined {
  for (const k of rawChildren(mvex, 8, mvex.length)) {
    if (k.type !== T_MEHD || k.body + 8 > k.end) continue;
    const version = mvex[k.body];
    if (version === 1) {
      if (k.body + 12 > k.end) return undefined;
      const hi = u32(mvex, k.body + 4);
      return hi >= 0x200000 ? undefined : hi * 2 ** 32 + u32(mvex, k.body + 8);
    }
    return version === 0 ? u32(mvex, k.body + 4) : undefined;
  }
  return undefined;
}

/**
 * Walk an MP4/MOV/3GP video's boxes: its capture date, its length, and whether it was cut off.
 * `head` is the start of the file already read. Only box headers and a few small boxes inside
 * 'moov' are read, never the video data. Never throws on malformed or truncated files (read
 * errors from `read` do propagate).
 *
 * Being unsure never counts as cut off: bytes that aren't a box header, or more boxes than
 * MAX_BOXES, end the walk without a verdict, so the video stays in Keep.
 */
export async function videoInfo(read: Read, fileSize: number, head: Uint8Array, now = Date.now()): Promise<VideoInfo> {
  const bytesAt = async (s: number, e: number) => {
    const end = Math.min(e, fileSize);
    return end <= head.length ? head.subarray(s, end) : read(s, end);
  };
  const header = async (at: number, limit: number): Promise<BoxHeader | null> => {
    const h = readBoxHeader(await bytesAt(at, at + 16), 0, at, limit);
    return h && h.end > at ? h : null;
  };

  // Top level: hop from header to header to the end of the file.
  let moov: BoxHeader | undefined;
  let moovAt = 0;
  let cutOff = false;
  let reachedEnd = false;
  let at = 0;
  for (let n = 0; n < MAX_BOXES; n++) {
    if (at + 8 > fileSize) { reachedEnd = true; break; } // at the end, or a few stray bytes after the last box
    const h = await header(at, fileSize);
    if (!h) break; // not a box header: unsure, so no verdict
    if (h.end > fileSize) { cutOff = true; if (h.type === 'moov' && !moov) { moov = h; moovAt = at; } break; }
    if (h.type === 'moov' && !moov) { moov = h; moovAt = at; }
    at = h.end;
  }
  if (reachedEnd && !moov) cutOff = true;
  const info: VideoInfo = cutOff ? { cutOff } : {};
  if (!moov) return info;

  // Inside 'moov': only read the small boxes we need. A cut-off moov is fine if they're whole.
  const moovEnd = Math.min(moov.end, fileSize);
  let fromMvhd: string | undefined;
  let fromMeta: string | undefined;
  let timescale = 0;
  let duration: number | undefined;
  let mvex: { at: number; end: number } | undefined;
  for (let p = moovAt + moov.headerLen, n = 0; p + 8 <= moovEnd && n < MAX_BOXES; n++) {
    const h = await header(p, moov.end);
    if (!h || h.end > moovEnd) break;
    if (h.type === 'mvhd' && fromMvhd === undefined && timescale === 0) {
      const body = await bytesAt(p + h.headerLen, Math.min(h.end, p + h.headerLen + 32));
      fromMvhd = mvhdDate(body, now);
      duration = mvhdDuration(body);
      timescale = body[0] === 1 && body.length >= 24 ? u32(body, 20) : body.length >= 16 ? u32(body, 12) : 0;
    } else if (h.type === 'meta' && fromMeta === undefined && h.end - p <= META_MAX) {
      const text = quicktimeCreationText(await bytesAt(p, h.end));
      if (text) fromMeta = quicktimeDate(text, now);
    } else if (h.type === 'mvex' && !mvex && h.end - p <= META_MAX) {
      mvex = { at: p, end: h.end };
    }
    p = h.end;
  }
  // Fragmented files often leave mvhd's duration at zero and give the total in mvex > mehd.
  if (duration === undefined && mvex && timescale) {
    const frag = mehdDuration(await bytesAt(mvex.at, mvex.end));
    if (frag !== undefined) duration = toSeconds(frag, timescale);
  }
  const takenAt = fromMeta ?? fromMvhd;
  if (takenAt) info.takenAt = takenAt;
  if (duration !== undefined) info.durationSec = duration;
  return info;
}

/**
 * Find the capture date of an MP4/MOV/3GP video. `head` is the start of the file already read.
 * Returns 'YYYY-MM-DDTHH:mm:ss' or undefined when there's no believable date. Never throws on
 * malformed or truncated files (read errors from `read` do propagate).
 */
export async function videoDate(read: Read, fileSize: number, head: Uint8Array, now = Date.now()): Promise<string | undefined> {
  return (await videoInfo(read, fileSize, head, now)).takenAt;
}
