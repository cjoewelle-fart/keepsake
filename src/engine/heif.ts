// HEIF container reading (iPhone HEIC, AVIF): pixel size, where the photo details are,
// and whether the file was cut off. Pure byte parsing, no decoding.
//
// A HEIF file is a list of boxes: 'ftyp', then usually 'meta' (the table of contents),
// then 'mdat' (the coded pictures and the Exif block). 'meta' lists every item ('iinf'),
// where each item's bytes are ('iloc'), and per-item properties such as the pixel size
// ('iprp' > 'ipco' > 'ispe', linked to items by 'ipma'). 'pitm' names the main picture.

import type { Size, SizeResult } from './sniff';

/** A byte range in the file: [start, end). */
export type Range = { start: number; end: number };

export type BoxHeader = { type: string; headerLen: number; /** absolute end, as declared */ end: number };

const u16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
/** Unsigned big-endian integer of 0, 4 or 8 bytes. 8-byte values above 2^53 come back as Infinity. */
const uint = (b: Uint8Array, i: number, n: number): number => {
  if (n === 0) return 0;
  if (n === 4) return u32(b, i);
  if (n === 8) {
    const hi = u32(b, i);
    return hi >= 0x200000 ? Infinity : hi * 2 ** 32 + u32(b, i + 4);
  }
  throw new RangeError('bad field size');
};
const fourcc = (b: Uint8Array, i: number) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
const isFourcc = (b: Uint8Array, i: number) => {
  for (let k = i; k < i + 4; k++) if (b[k] < 0x20 || b[k] > 0x7e) return false;
  return true;
};

/**
 * Read the box header at `b[at]`. `base` is the absolute file offset of `b[0]`, `limit` the
 * absolute end of the enclosing space (the file size at top level), used for size 0 ("to the end").
 * Returns null when the bytes can't be a box header (too short, bad type, impossible size).
 */
export function readBoxHeader(b: Uint8Array, at: number, base: number, limit: number): BoxHeader | null {
  if (at + 8 > b.length || !isFourcc(b, at + 4)) return null;
  const type = fourcc(b, at + 4);
  const size32 = u32(b, at);
  if (size32 === 0) return { type, headerLen: 8, end: limit };
  if (size32 === 1) {
    if (at + 16 > b.length) return null;
    const size = uint(b, at + 8, 8);
    if (size < 16) return null;
    return { type, headerLen: 16, end: base + at + size };
  }
  if (size32 < 8) return null;
  return { type, headerLen: 8, end: base + at + size32 };
}

/** Child boxes of a container held fully in `b`, between `from` and `to` (offsets into b). */
function children(b: Uint8Array, from: number, to: number): { type: string; start: number; body: number; end: number }[] {
  const out = [];
  let at = from;
  while (at + 8 <= to) {
    const h = readBoxHeader(b, at, 0, to);
    if (!h || h.end > to) break;
    out.push({ type: h.type, start: at, body: at + h.headerLen, end: h.end });
    at = h.end;
  }
  return out;
}

export type HeifMeta = {
  /** Pixel size of the main picture, from its 'ispe' property. */
  size?: Size;
  /** Where the Exif block is, as absolute file ranges (in order). */
  exif?: Range[];
  /** Every file range that 'iloc' says holds item data. */
  extents: Range[];
  /** Some item's data lives in another file ('iloc' data_reference_index pointing outside this file). */
  external?: boolean;
};

/**
 * Parse a whole 'meta' box. `meta` holds the box from its first header byte;
 * `metaStart` is its absolute offset in the file (needed for items stored in 'idat').
 * Throws on structure it can't make sense of.
 */
export function parseHeifMeta(meta: Uint8Array, metaStart = 0): HeifMeta {
  const h = readBoxHeader(meta, 0, 0, meta.length);
  if (!h || h.type !== 'meta') throw new Error('not a meta box');
  const end = Math.min(h.end, meta.length);
  const kids = children(meta, h.headerLen + 4, end); // meta is a FullBox: 4 bytes version + flags
  const find = (t: string) => kids.find((k) => k.type === t);

  // Main picture id
  let primary: number | undefined;
  const pitm = find('pitm');
  if (pitm) primary = meta[pitm.body] === 0 ? u16(meta, pitm.body + 4) : u32(meta, pitm.body + 4);

  // Item types: find the Exif item
  const exifIds = new Set<number>();
  const iinf = find('iinf');
  if (iinf) {
    const v = meta[iinf.body];
    const first = iinf.body + 4 + (v === 0 ? 2 : 4);
    for (const infe of children(meta, first, iinf.end)) {
      if (infe.type !== 'infe') continue;
      const iv = meta[infe.body];
      if (iv < 2) continue; // versions 0 and 1 predate item types; not used for Exif in HEIF
      const id = iv === 2 ? u16(meta, infe.body + 4) : u32(meta, infe.body + 4);
      const typeAt = infe.body + 4 + (iv === 2 ? 2 : 4) + 2;
      if (typeAt + 4 <= infe.end && fourcc(meta, typeAt) === 'Exif') exifIds.add(id);
    }
  }

  // Data references: 'iloc' data_reference_index n (1-based) names entry n of 'dinf' > 'dref'.
  // 0, or an entry flagged self-contained (flags & 1), means this file; anything else is another file.
  const selfContained: boolean[] = [];
  const dinf = find('dinf');
  const dref = dinf ? children(meta, dinf.body, dinf.end).find((k) => k.type === 'dref') : undefined;
  if (dref) for (const e of children(meta, dref.body + 8, dref.end)) selfContained.push((meta[e.body + 3] & 1) === 1);
  let external = false;

  // Item locations
  const idat = find('idat');
  const idatStart = idat ? metaStart + idat.body : undefined;
  const extents: Range[] = [];
  let exif: Range[] | undefined;
  const iloc = find('iloc');
  if (iloc) {
    let p = iloc.body;
    const v = meta[p];
    p += 4;
    const offSize = meta[p] >> 4, lenSize = meta[p] & 15, baseSize = meta[p + 1] >> 4;
    const idxSize = v === 1 || v === 2 ? meta[p + 1] & 15 : 0;
    p += 2;
    const count = v < 2 ? u16(meta, p) : u32(meta, p);
    p += v < 2 ? 2 : 4;
    for (let n = 0; n < count; n++) {
      if (p > iloc.end) throw new Error('iloc overrun');
      const id = v < 2 ? u16(meta, p) : u32(meta, p);
      p += v < 2 ? 2 : 4;
      let method = 0;
      if (v === 1 || v === 2) { method = u16(meta, p) & 15; p += 2; }
      const dataRef = u16(meta, p);
      p += 2;
      const baseOffset = uint(meta, p, baseSize);
      p += baseSize;
      const extentCount = u16(meta, p);
      p += 2;
      const ranges: Range[] = [];
      for (let e = 0; e < extentCount; e++) {
        p += idxSize;
        const off = uint(meta, p, offSize);
        p += offSize;
        const len = uint(meta, p, lenSize);
        p += lenSize;
        if (p > iloc.end) throw new Error('iloc overrun');
        if (len === 0) continue; // "the whole file": nothing useful to check
        if (method === 0 && dataRef !== 0 && !selfContained[dataRef - 1]) { external = true; continue; } // in another file
        const start = method === 0 ? baseOffset + off : method === 1 && idatStart !== undefined ? idatStart + baseOffset + off : NaN;
        if (Number.isFinite(start)) ranges.push({ start, end: start + len });
      }
      if (method === 0) extents.push(...ranges);
      if (exifIds.has(id) && ranges.length) exif = ranges;
    }
  }

  // Pixel size: the 'ispe' property linked to the main picture
  let size: Size | undefined;
  const iprp = find('iprp');
  if (iprp) {
    const parts = children(meta, iprp.body, iprp.end);
    const ipco = parts.find((k) => k.type === 'ipco');
    const props = ipco ? children(meta, ipco.body, ipco.end) : [];
    const ispeAt = (k: { type: string; body: number; end: number } | undefined): Size | undefined => {
      if (!k || k.type !== 'ispe' || k.body + 12 > k.end) return undefined;
      const width = u32(meta, k.body + 4), height = u32(meta, k.body + 8);
      return width > 0 && height > 0 ? { width, height } : undefined;
    };
    for (const ipma of parts.filter((k) => k.type === 'ipma')) {
      if (size || primary === undefined) break;
      const v = meta[ipma.body];
      const wide = (meta[ipma.body + 3] & 1) === 1;
      let p = ipma.body + 4;
      const entries = u32(meta, p);
      p += 4;
      for (let n = 0; n < entries && p < ipma.end; n++) {
        const id = v < 1 ? u16(meta, p) : u32(meta, p);
        p += v < 1 ? 2 : 4;
        const assoc = meta[p++];
        for (let a = 0; a < assoc; a++) {
          const index = wide ? u16(meta, p) & 0x7fff : meta[p] & 0x7f;
          p += wide ? 2 : 1;
          if (id === primary && !size) size = ispeAt(props[index - 1]); // 1-based; 0 = none
        }
      }
    }
    // No main picture named: use the largest declared size (thumbnails are smaller).
    if (!size && primary === undefined) {
      for (const k of props) {
        const s = ispeAt(k);
        if (s && (!size || s.width * s.height > size.width * size.height)) size = s;
      }
    }
  }
  return { size, exif, extents, ...(external ? { external } : {}) };
}

/** Largest 'meta' box we'll hold in memory. Real ones are a few KB. */
const META_MAX = 4 * 1024 * 1024;

export type HeifLayout = {
  /** 'invalid' = not a readable HEIF structure; 'unknown' = no pixel size declared. */
  size: SizeResult;
  /** The file ends before data it says it contains. */
  cutOff: boolean;
  exif?: Range[];
  /**
   * The file couldn't be fully checked, so it must be kept as it is: its table of contents is
   * bigger than we'll read, or some of its data lives in another file.
   */
  unchecked?: 'meta-too-large' | 'external-data';
};

type Read = (start: number, end: number) => Promise<Uint8Array>;

/**
 * Walk the top-level boxes and parse 'meta'. Reads only box headers past `head`
 * (16 bytes each), so a large 'mdat' before 'meta' costs almost nothing.
 *
 * Cut-off rule: the file is cut off when it ends before the 'meta' box is complete,
 * or when any item's data (pictures, Exif) lies past the end of the file.
 * Bytes after the last complete box are ignored (padding or leftovers from recovery).
 */
export async function heifLayout(read: Read, fileSize: number, head: Uint8Array): Promise<HeifLayout> {
  const bytesAt = async (s: number, e: number) => (e <= head.length ? head.subarray(s, e) : read(s, Math.min(e, fileSize)));
  let at = 0;
  let meta: HeifMeta | undefined;
  let mdatPastEnd = false;
  let sawMoov = false;
  for (let boxes = 0; at + 8 <= fileSize && boxes < 10_000; boxes++) {
    const hb = await bytesAt(at, at + 16);
    const h = readBoxHeader(hb, 0, at, fileSize);
    if (!h || h.end <= at) {
      if (meta) break; // trailing junk after a complete picture
      return { size: 'invalid', cutOff: false };
    }
    if (h.type === 'moov') sawMoov = true;
    if (h.type === 'meta' && !meta) {
      if (h.end > fileSize) return { size: 'unknown', cutOff: true };
      if (h.end - at > META_MAX) return { size: 'unknown', cutOff: false, unchecked: 'meta-too-large' };
      try {
        meta = parseHeifMeta(await bytesAt(at, h.end), at);
      } catch {
        return { size: 'invalid', cutOff: false };
      }
    } else if (h.end > fileSize) {
      if (!meta) return { size: 'unknown', cutOff: true }; // ended before the table of contents
      mdatPastEnd = h.type === 'mdat';
      break;
    }
    at = h.end;
  }
  // HEIF image sequences (bursts, animations) may describe their pictures in 'moov' instead.
  // We don't read those; keep rather than call a real file damaged.
  if (!meta) return { size: sawMoov ? 'unknown' : 'invalid', cutOff: false };
  // Data in another file: we can't tell whether that part is complete, so don't judge it.
  if (meta.external) return { size: meta.size ?? 'unknown', cutOff: false, exif: meta.exif, unchecked: 'external-data' };
  // Without item locations, fall back to the declared length of the picture data box.
  const cutOff = meta.extents.length ? meta.extents.some((r) => r.end > fileSize) : mdatPastEnd;
  return { size: meta.size ?? 'unknown', cutOff, exif: meta.exif };
}

/** Pixel size from the first bytes of a HEIF file, without further reads. */
export function heifSize(head: Uint8Array): SizeResult {
  let at = 0;
  while (at + 8 <= head.length) {
    const h = readBoxHeader(head, at, 0, head.length);
    if (!h || h.end <= at) return 'invalid';
    if (h.type === 'meta') {
      if (h.end > head.length) return 'beyond';
      try {
        return parseHeifMeta(head.subarray(at, h.end), at).size ?? 'unknown';
      } catch {
        return 'invalid';
      }
    }
    at = h.end;
  }
  return 'beyond';
}

/**
 * The TIFF-structured part of a HEIF Exif item. The item starts with a 4-byte offset to
 * the TIFF header (usually skipping "Exif\0\0"); if that's off, look for the header nearby.
 */
export function exifTiff(item: Uint8Array): Uint8Array | undefined {
  const isTiff = (i: number) =>
    i + 4 <= item.length &&
    ((item[i] === 0x49 && item[i + 1] === 0x49 && item[i + 2] === 0x2a && item[i + 3] === 0) ||
      (item[i] === 0x4d && item[i + 1] === 0x4d && item[i + 2] === 0 && item[i + 3] === 0x2a));
  if (item.length >= 8) {
    const declared = 4 + u32(item, 0);
    if (isTiff(declared)) return item.subarray(declared);
  }
  for (let i = 0; i < Math.min(item.length, 64); i++) if (isTiff(i)) return item.subarray(i);
  return undefined;
}
