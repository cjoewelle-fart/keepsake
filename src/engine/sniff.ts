// Identify a file by its first bytes, never by its extension:
// PhotoRec guesses extensions, and recovered files can be mislabelled.

export type Kind =
  | 'jpeg' | 'png' | 'gif' | 'webp' | 'heic' | 'avif' | 'bmp' | 'tiff' | 'raw'
  | 'mp4' | 'mov' | '3gp' | 'avi' | 'mts'
  | 'empty' | 'other';

/** tiff covers TIFF scans and TIFF-based camera RAW (CR2, NEF, ARW, DNG); raw = Canon CR3. */
export const PHOTO_KINDS: ReadonlySet<Kind> = new Set(['jpeg', 'png', 'gif', 'webp', 'heic', 'avif', 'bmp', 'tiff', 'raw']);
export const VIDEO_KINDS: ReadonlySet<Kind> = new Set(['mp4', 'mov', '3gp', 'avi', 'mts']);

/** Kinds a browser can show directly in an <img>. */
export const PREVIEWABLE: ReadonlySet<Kind> = new Set(['jpeg', 'png', 'gif', 'webp', 'bmp']);

const ascii = (b: Uint8Array, at: number, len: number): string => {
  let s = '';
  for (let i = at; i < at + len && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
};

const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']);
/** MP4-family brands that are sound or streaming pieces, not videos people keep. */
const NOT_VIDEO_BRANDS = new Set(['M4A ', 'M4B ', 'M4P ', 'F4A ', 'F4B ', 'dash', 'msdh', 'msix']);
/** QuickTime files that start with a box other than ftyp (older cameras). */
const QT_FIRST_BOXES = new Set(['moov', 'wide', 'mdat', 'free', 'skip', 'pnot']);

export function sniff(b: Uint8Array): Kind {
  if (b.length === 0) return 'empty';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'png';
  if (ascii(b, 0, 4) === 'GIF8') return 'gif';
  if (ascii(b, 0, 4) === 'RIFF') {
    const t = ascii(b, 8, 4);
    if (t === 'WEBP') return 'webp';
    if (t === 'AVI ') return 'avi';
    return 'other';
  }
  if (ascii(b, 0, 2) === 'BM' && b.length > 26 && b[14] >= 12 && b[15] === 0) return 'bmp';
  if (ascii(b, 0, 4) === 'II*\0' || ascii(b, 0, 4) === 'MM\0*') return 'tiff';
  if (ascii(b, 4, 4) === 'ftyp') {
    const brand = ascii(b, 8, 4);
    if (brand === 'avif' || brand === 'avis') return 'avif';
    if (HEIC_BRANDS.has(brand)) return 'heic';
    if (brand === 'crx ') return 'raw';
    if (NOT_VIDEO_BRANDS.has(brand)) return 'other';
    if (brand === 'qt  ') return 'mov';
    if (brand.startsWith('3g')) return '3gp';
    return 'mp4'; // unknown brands are treated as video: keeping too much beats losing a memory
  }
  if (QT_FIRST_BOXES.has(ascii(b, 4, 4))) return 'mov';
  // MPEG transport stream: plain (188-byte packets) or camcorder AVCHD .mts (192-byte packets)
  if (b.length > 400 && b[0] === 0x47 && b[188] === 0x47 && b[376] === 0x47) return 'mts';
  if (b.length > 400 && b[4] === 0x47 && b[196] === 0x47 && b[388] === 0x47) return 'mts';
  return 'other';
}

export type Size = { width: number; height: number };
/** 'beyond' = the answer is past the bytes we read; 'invalid' = the structure is broken. */
export type SizeResult = Size | 'beyond' | 'invalid' | 'unknown';

const u16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export type JpegLayout = { size: SizeResult; /** offset where image data starts, or -1 if past the bytes read */ scanStart: number };

/** Walk JPEG markers: find the pixel size and where the compressed image data begins. */
export function jpegLayout(b: Uint8Array): JpegLayout {
  let size: SizeResult = 'beyond';
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return { size: 'invalid', scanStart: -1 };
    let marker = b[i + 1];
    while (marker === 0xff && i + 2 < b.length) { i++; marker = b[i + 1]; } // fill bytes
    if (SOF.has(marker) && size === 'beyond') {
      if (i + 8 >= b.length) return { size: 'beyond', scanStart: -1 };
      const height = u16(b, i + 5);
      const width = u16(b, i + 7);
      size = width > 0 && height > 0 ? { width, height } : 'invalid';
      if (size === 'invalid') return { size, scanStart: -1 };
    }
    if (marker === 0xda) return size === 'beyond' ? { size: 'invalid', scanStart: -1 } : { size, scanStart: i };
    if (marker === 0xd9) return { size: 'invalid', scanStart: -1 }; // image ended before any data
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const len = u16(b, i + 2);
    if (len < 2) return { size: 'invalid', scanStart: -1 };
    i += 2 + len;
  }
  return { size, scanStart: -1 };
}

export const jpegSize = (b: Uint8Array): SizeResult => jpegLayout(b).size;

export function imageSize(kind: Kind, b: Uint8Array): SizeResult {
  switch (kind) {
    case 'jpeg': return jpegSize(b);
    case 'png':
      if (b.length < 24) return 'invalid';
      if (ascii(b, 12, 4) !== 'IHDR') return 'invalid';
      return { width: u32(b, 16), height: u32(b, 20) };
    case 'gif':
      if (b.length < 10) return 'invalid';
      return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
    case 'bmp':
      if (b.length < 26) return 'invalid';
      return { width: Math.abs(new DataView(b.buffer, b.byteOffset).getInt32(18, true)), height: Math.abs(new DataView(b.buffer, b.byteOffset).getInt32(22, true)) };
    default:
      return 'unknown';
  }
}

/** Phones that add a short video or extra data after the photo say so in the photo's header. */
const HAS_ATTACHED_DATA = /MotionPhoto|MicroVideo|GCamera:|OpCamera:|Item:Semantic/;

/**
 * Does the photo's data reach its proper end? Truncated files don't.
 * `tail` is the last bytes of the file, starting at absolute offset `tailStart`.
 *
 * In JPEG image data the end marker (FF D9) cannot appear by accident, so finding one after
 * the data starts means the picture is whole, even if a phone added extra data after it
 * (Samsung trailers, Motion Photos) or the file is padded with zeros.
 */
export function endsCleanly(kind: Kind, tail: Uint8Array, opts: { tailStart?: number; head?: Uint8Array } = {}): boolean {
  const { tailStart = 0, head } = opts;
  if (kind === 'jpeg') {
    const scanStart = head ? jpegLayout(head).scanStart : -1;
    for (let i = tail.length - 2; i >= 0; i--) {
      if (tail[i] === 0xff && tail[i + 1] === 0xd9 && tailStart + i > scanStart) return true;
    }
    if (ascii(tail, tail.length - 4, 4) === 'SEFT') return true; // Samsung trailer
    if (head && HAS_ATTACHED_DATA.test(ascii(head, 0, Math.min(head.length, 65536)))) return true;
    return false;
  }
  if (kind === 'png') return ascii(tail, 0, tail.length).includes('IEND');
  return true;
}
