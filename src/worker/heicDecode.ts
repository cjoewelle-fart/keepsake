// HEIC decoding for tile previews (T54), free of the DOM so it runs in the worker and in Node tests.
//
// Phones store a small copy of each photo inside the HEIC file: an HEVC picture of about
// 320 x 240 (iPhone) or 384 x 512 (Samsung), linked to the main picture as its thumbnail
// ('thmb' in the file's item references). Decoding that copy takes a few milliseconds; decoding
// the main picture (a grid of 48 HEVC tiles for 12 MP) takes 0.5 to 2 seconds and ~50 MB. So we
// decode the small copy when it is there, big enough and shaped like the photo, and the main
// picture otherwise.
//
// libheif-js 1.23.2's own JavaScript wrapper (HeifDecoder) can't reach thumbnails, so this uses
// libheif's C functions, which the same bundle exports. Every buffer and handle made here is
// freed before returning, also on errors.

/** The libheif C functions we use, as exported by libheif-js's WebAssembly bundle. */
export type LibheifC = {
  HEAPU8: Uint8Array;
  _malloc(size: number): number;
  _free(ptr: number): void;
  _heif_context_alloc(): number;
  _heif_context_free(ctx: number): void;
  _heif_context_read_from_memory_without_copy(err: number, ctx: number, data: number, size: number, options: number): void;
  _heif_context_get_primary_image_handle(err: number, ctx: number, out: number): void;
  _heif_image_handle_get_width(handle: number): number;
  _heif_image_handle_get_height(handle: number): number;
  _heif_image_handle_get_number_of_thumbnails(handle: number): number;
  _heif_image_handle_get_list_of_thumbnail_IDs(handle: number, ids: number, count: number): number;
  _heif_image_handle_get_thumbnail(err: number, handle: number, id: number, out: number): void;
  _heif_image_handle_release(handle: number): void;
  _heif_decode_image(err: number, handle: number, out: number, colorspace: number, chroma: number, options: number): void;
  _heif_image_get_width(image: number, channel: number): number;
  _heif_image_get_height(image: number, channel: number): number;
  _heif_image_get_plane_readonly(image: number, channel: number, stride: number): number;
  _heif_image_release(image: number): void;
};

/** Decoded pixels, 4 bytes (RGBA) per pixel, rows packed. */
export type Rgba = { width: number; height: number; data: Uint8ClampedArray; from: 'thumbnail' | 'main' };

/** Biggest picture we'll decode, in pixels (a 48 MP iPhone ProRAW-sized HEIC is ~48M). */
export const MAX_PIXELS = 50_000_000;

const RGB = 1; // heif_colorspace_RGB
const RGBA = 11; // heif_chroma_interleaved_RGBA
const INTERLEAVED = 10; // heif_channel_interleaved

/**
 * Whether a thumbnail `tw` x `th` can stand in for a main picture `w` x `h` in a preview whose
 * longer side is `maxSide`: at least 3/4 of that size (a 320 px copy for a 320 px preview), and
 * the same shape. A copy turned the other way or cropped differently (some editing apps don't
 * update it) is not used: the main picture is decoded instead.
 */
export function thumbnailFits(tw: number, th: number, w: number, h: number, maxSide: number): boolean {
  if (!(tw > 0 && th > 0 && w > 0 && h > 0)) return false;
  if (Math.max(tw, th) < 0.75 * Math.min(maxSide, Math.max(w, h))) return false;
  return Math.abs(tw / th - w / h) <= 0.03 * (w / h);
}

/**
 * Decode a HEIC file's picture for a preview: its thumbnail when one fits (see thumbnailFits),
 * the main picture otherwise (or when the thumbnail won't decode). Turned the way the file says.
 */
export function decodeForPreview(m: LibheifC, bytes: Uint8Array, maxSide: number): Rgba {
  const err = m._malloc(16); // heif_error: code, subcode, message
  const out = m._malloc(4);
  const data = m._malloc(Math.max(1, bytes.length));
  const ctx = m._heif_context_alloc();
  const handles: number[] = [];
  const check = (what: string) => {
    const code = new Int32Array(m.HEAPU8.buffer, err, 1)[0]; // HEAPU8 is replaced when memory grows
    if (code !== 0) throw new Error(`${what} failed (${code})`);
  };
  const ptr = () => new Uint32Array(m.HEAPU8.buffer, out, 1)[0];
  try {
    m.HEAPU8.set(bytes, data);
    m._heif_context_read_from_memory_without_copy(err, ctx, data, bytes.length, 0);
    check('read');
    m._heif_context_get_primary_image_handle(err, ctx, out);
    check('primary');
    const main = ptr();
    handles.push(main);
    const w = m._heif_image_handle_get_width(main), h = m._heif_image_handle_get_height(main);

    // The smallest thumbnail that fits, if any.
    let best = 0;
    let bestPx = Infinity;
    const count = Math.min(16, m._heif_image_handle_get_number_of_thumbnails(main));
    if (count > 0) {
      const ids = m._malloc(4 * count);
      try {
        const n = m._heif_image_handle_get_list_of_thumbnail_IDs(main, ids, count);
        const list = Array.from(new Uint32Array(m.HEAPU8.buffer, ids, n));
        for (const id of list) {
          m._heif_image_handle_get_thumbnail(err, main, id, out);
          if (new Int32Array(m.HEAPU8.buffer, err, 1)[0] !== 0) continue;
          const t = ptr();
          handles.push(t);
          const tw = m._heif_image_handle_get_width(t), th = m._heif_image_handle_get_height(t);
          if (thumbnailFits(tw, th, w, h, maxSide) && tw * th < bestPx) { best = t; bestPx = tw * th; }
        }
      } finally {
        m._free(ids);
      }
    }
    if (best) {
      try {
        return { ...decode(m, best, err, out, check), from: 'thumbnail' };
      } catch {
        // A damaged copy: the main picture may still decode.
      }
    }
    if (!(w > 0 && h > 0) || w * h > MAX_PIXELS) throw new Error('unsupported size');
    return { ...decode(m, main, err, out, check), from: 'main' };
  } finally {
    for (const handle of handles) m._heif_image_handle_release(handle);
    m._heif_context_free(ctx);
    m._free(data);
    m._free(out);
    m._free(err);
  }
}

/** Decode one picture to packed RGBA, copied out of libheif's memory. */
function decode(m: LibheifC, handle: number, err: number, out: number, check: (what: string) => void) {
  m._heif_decode_image(err, handle, out, RGB, RGBA, 0);
  check('decode');
  const image = new Uint32Array(m.HEAPU8.buffer, out, 1)[0];
  try {
    const width = m._heif_image_get_width(image, INTERLEAVED), height = m._heif_image_get_height(image, INTERLEAVED);
    const plane = m._heif_image_get_plane_readonly(image, INTERLEAVED, out);
    const stride = new Int32Array(m.HEAPU8.buffer, out, 1)[0];
    if (!(width > 0 && height > 0) || !plane || stride < width * 4) throw new Error('no picture');
    const row = width * 4;
    const data = new Uint8ClampedArray(row * height);
    if (stride === row) data.set(m.HEAPU8.subarray(plane, plane + row * height));
    else for (let y = 0; y < height; y++) data.set(m.HEAPU8.subarray(plane + y * stride, plane + y * stride + row), y * row);
    return { width, height, data };
  } finally {
    m._heif_image_release(image);
  }
}
