// T50 and T59: what a kept photo looks like it is, for two "Show only" filters on the review
// screen ("Screenshots" and "From chat apps"). These are hints for looking through photos, never
// cleanup rules: nothing here sets a file aside or unticks it, and the file's group doesn't change.
//
// PhotoRec loses folder names, so the hints come only from the file itself: its pixel size, its
// format, and which details it carries (camera, exposure, the JFIF and Exif blocks, and any text
// tag that says "Screenshot"). Pure and framework-free: tested in Node (tests/looks.test.ts).
import type { Kind } from './sniff';

/** What a photo looks like it is. Undefined (on the record) = no hint. */
export type Look = 'screenshot' | 'chat';

/** Which sign gave the hint, so the UI (and a reviewer) can say why. */
export type LookSign =
  /** The file's own text details (Exif Software or UserComment, XMP, PNG text) say "Screenshot". */
  | 'screenshot-tag'
  /** A PNG with no camera details, exactly the size of a common phone, tablet or computer screen. */
  | 'screen-size'
  /** A JPEG with no camera details or date taken, whose long side is a size chat apps shrink photos to. */
  | 'chat-size'
  /** A JPEG with a JFIF header and no Exif block at all, the way WhatsApp and Messenger save photos. */
  | 'jfif-no-exif';

/** What the scan learns about a photo's own details, cheaply, from bytes it has already read. */
export type MetaSigns = {
  /** An Exif block is present (JPEG APP1 "Exif", PNG eXIf or ImageMagick's exif text). */
  exif: boolean;
  /** JPEG only: a JFIF APP0 header is present. */
  jfif: boolean;
  /** Some metadata text says "Screenshot" (any case; ASCII or UTF-16). */
  screenshotTag: boolean;
};

const NO_SIGNS: MetaSigns = { exif: false, jfif: false, screenshotTag: false };

const ascii = (b: Uint8Array, at: number, len: number): string => {
  let s = '';
  for (let i = at; i < at + len && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
};
const u16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

const WORD = 'screenshot';

/** Does `b` (from `start` to `end`) hold "screenshot" in any case, as ASCII/UTF-8 or UTF-16 (either byte order)? */
export function hasScreenshotWord(b: Uint8Array, start = 0, end = b.length): boolean {
  const lower = (x: number) => (x >= 0x41 && x <= 0x5a ? x + 32 : x);
  const n = WORD.length;
  for (let i = start; i < end; i++) {
    if (lower(b[i]) !== 0x73) continue; // 's'
    // one byte per letter
    let k = 1;
    while (k < n && i + k < end && lower(b[i + k]) === WORD.charCodeAt(k)) k++;
    if (k === n) return true;
    // UTF-16: each letter followed (LE) or preceded (BE) by a zero byte; for BE, `i` is the low
    // byte of 's', so the zero before it is already behind us, which this checks the same way.
    k = 1;
    while (k < n && i + 2 * k < end && b[i + 2 * k - 1] === 0 && lower(b[i + 2 * k]) === WORD.charCodeAt(k)) k++;
    if (k === n) return true;
  }
  return false;
}

/**
 * Walk a JPEG's segments up to the image data (or the end of `head`) and note the JFIF header,
 * the Exif block, and whether the Exif, XMP or comment text says "Screenshot".
 */
function jpegSigns(b: Uint8Array): MetaSigns {
  const out = { ...NO_SIGNS };
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) break;
    let marker = b[i + 1];
    while (marker === 0xff && i + 2 < b.length) { i++; marker = b[i + 1]; }
    if (marker === 0xda || marker === 0xd9) break; // image data (or the end) starts: no more details
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const len = u16(b, i + 2);
    if (len < 2) break;
    const start = i + 4;
    const end = Math.min(b.length, i + 2 + len);
    if (marker === 0xe0 && ascii(b, start, 5) === 'JFIF\0') out.jfif = true;
    if (marker === 0xe1) {
      if (ascii(b, start, 6) === 'Exif\0\0') out.exif = true;
      if (!out.screenshotTag && hasScreenshotWord(b, start, end)) out.screenshotTag = true;
    }
    if (marker === 0xfe && !out.screenshotTag && hasScreenshotWord(b, start, end)) out.screenshotTag = true;
    i += 2 + len;
  }
  return out;
}

/** PNG chunks that hold details as text (or Exif). Compressed text (zTXt) isn't unpacked. */
const PNG_TEXT = new Set(['tEXt', 'iTXt', 'eXIf']);

/** Walk a PNG's chunks up to the image data and note Exif and any "Screenshot" text. */
function pngSigns(b: Uint8Array): MetaSigns {
  const out = { ...NO_SIGNS };
  let i = 8;
  while (i + 8 <= b.length) {
    const len = u32(b, i);
    const type = ascii(b, i + 4, 4);
    if (type === 'IDAT' || type === 'IEND') break;
    const start = i + 8;
    const end = Math.min(b.length, start + len);
    if (type === 'eXIf') out.exif = true;
    // ImageMagick and exiftool can keep Exif as hex text: "Raw profile type exif".
    if ((type === 'tEXt' || type === 'zTXt') && ascii(b, start, 22).toLowerCase().startsWith('raw profile type exif')) out.exif = true;
    if (PNG_TEXT.has(type) && !out.screenshotTag && hasScreenshotWord(b, start, end)) out.screenshotTag = true;
    i = start + len + 4; // data, then the CRC
  }
  return out;
}

/** The cheap details for the hints, from the start of the file the scan has already read. */
export function metaSigns(kind: Kind, head: Uint8Array): MetaSigns {
  try {
    if (kind === 'jpeg') return jpegSigns(head);
    if (kind === 'png') return pngSigns(head);
  } catch {
    // a broken structure just means no hint
  }
  return { ...NO_SIGNS };
}

// ---------------------------------------------------------------------------------------------
// Sizes

/**
 * Phone screens, by their short side in pixels (portrait width). A phone screenshot is one of
 * these wide and between 16:10 and about 2.25:1 tall (720×1280 up to 1080×2400 or 1440×3200).
 * Half sizes some phones save at (540) are included; 600 and 800 are left out (common photo sizes).
 */
const PHONE_SHORT = new Set([320, 480, 540, 640, 720, 750, 828, 1080, 1125, 1170, 1179, 1206, 1242, 1260, 1284, 1290, 1320, 1440]);
const PHONE_RATIO_MIN = 1.6;
const PHONE_RATIO_MAX = 2.25;

/** Tablets and computer screens: exact sizes, either way round. */
const SCREENS: readonly [number, number][] = [
  // computers
  [1024, 768], [1280, 720], [1280, 800], [1280, 1024], [1360, 768], [1366, 768], [1440, 900], [1536, 864],
  [1600, 900], [1680, 1050], [1920, 1080], [1920, 1200], [2048, 1152], [2160, 1440], [2256, 1504], [2560, 1080],
  [2560, 1440], [2560, 1600], [2736, 1824], [2880, 1800], [2880, 1864], [3024, 1964], [3440, 1440], [3456, 2234],
  [3840, 2160], [3840, 1600], [5120, 2880],
  // tablets (iPads, common Android tablets)
  [2048, 1536], [2160, 1620], [2224, 1668], [2266, 1488], [2360, 1640], [2388, 1668], [2420, 1668], [2732, 2048],
  [2752, 2064], [1340, 800], [2000, 1200], [2560, 1600],
];
const SCREEN_KEYS = new Set(SCREENS.map(([a, b]) => `${Math.max(a, b)}x${Math.min(a, b)}`));

/** Is `w`×`h` (either way round) the size of a common phone, tablet or computer screen? */
export function isScreenSize(w: number, h: number): boolean {
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  if (short <= 0) return false;
  if (SCREEN_KEYS.has(`${long}x${short}`)) return true;
  const ratio = long / short;
  return PHONE_SHORT.has(short) && ratio >= PHONE_RATIO_MIN && ratio <= PHONE_RATIO_MAX;
}

/**
 * Long sides chat apps shrink photos to: 1280 (WhatsApp standard quality, Telegram), 1600
 * (WhatsApp before 2021, Viber) and 2048 (Messenger, Signal).
 */
export const CHAT_LONG_SIDES: ReadonlySet<number> = new Set([1280, 1600, 2048]);

/** The longest side the JFIF-with-no-Exif sign counts at: no chat app sends anything bigger. */
export const CHAT_JFIF_MAX_LONG = 2560;

export const isChatSize = (w: number, h: number) => CHAT_LONG_SIDES.has(Math.max(w, h));

// ---------------------------------------------------------------------------------------------
// The hint

export type LookInput = {
  kind: Kind;
  width?: number;
  height?: number;
  /** Camera make or model from the photo's details. */
  camera?: string;
  /** Exposure details (exposure time, aperture or ISO) are present: a camera took it. */
  exposure?: boolean;
  takenAt?: string;
  signs: MetaSigns;
};

/**
 * What a photo looks like it is, and why, or undefined. Conservative: a photo with camera details
 * is never called either, and a screenshot needs a tag saying so or a PNG of an exact screen size.
 * A screenshot hint wins over a chat one.
 */
export function lookOf(p: LookInput): { look: Look; sign: LookSign } | undefined {
  if (p.kind !== 'jpeg' && p.kind !== 'png') return undefined;
  if (p.exposure) return undefined; // a camera took it
  if (p.signs.screenshotTag) return { look: 'screenshot', sign: 'screenshot-tag' };
  if (p.camera) return undefined;
  const sized = p.width !== undefined && p.height !== undefined;
  if (p.kind === 'png') {
    return sized && isScreenSize(p.width!, p.height!) ? { look: 'screenshot', sign: 'screen-size' } : undefined;
  }
  // JPEG: chat apps take away the camera details and the date taken.
  if (p.takenAt) return undefined;
  if (sized && isChatSize(p.width!, p.height!)) return { look: 'chat', sign: 'chat-size' };
  // JFIF with no Exif block also fits a camera photo whose details were stripped by an editor or
  // an upload, so it only counts at the sizes chat apps send (long side up to 2560, which covers
  // WhatsApp HD at 2560 and every standard-quality size). A size we couldn't read gets no hint.
  if (p.signs.jfif && !p.signs.exif && sized && Math.max(p.width!, p.height!) <= CHAT_JFIF_MAX_LONG) {
    return { look: 'chat', sign: 'jfif-no-exif' };
  }
  return undefined;
}
