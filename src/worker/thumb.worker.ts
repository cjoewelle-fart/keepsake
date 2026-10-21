// Makes small JPEG copies of photos for the review tiles (T53), so a screen of tiles holds a few
// megabytes of pictures instead of a 48 MB bitmap per 12 MP photo. Uses only the browser's own
// decoders (WebCodecs ImageDecoder, createImageBitmap) and OffscreenCanvas: nothing is fetched,
// nothing leaves the computer, and the photo itself is only read. A copy that fails (a format the
// browser can't decode, a cut-off file) is reported and the tile falls back to what it did before.
// One file at a time per worker, off the main thread.
import * as Comlink from 'comlink';
import { jpegSize } from '../engine/sniff';
import { UNSUPPORTED, jpegScale, thumbSize } from '../ui/thumbSize';

/** Enough of the file to find a JPEG's pixel size past its Exif and other header blocks. */
const HEAD_BYTES = 256 * 1024;

type Picture = { source: CanvasImageSource; width: number; height: number; close(): void };

/**
 * A JPEG decoded straight to 1/2, 1/4 or 1/8 of its size where the browser can (Chromium's
 * ImageDecoder): a 12 MP photo then costs ~1 MB to decode instead of 48 MB, and is much faster.
 * Turned upright by the decoder. Undefined when this way isn't available for the file.
 */
async function scaledJpeg(file: Blob, head: Uint8Array, side: number): Promise<Picture | undefined> {
  if (typeof ImageDecoder !== 'function') return undefined;
  const size = jpegSize(head);
  if (typeof size !== 'object') return undefined;
  const d = jpegScale(size.width, size.height, side);
  if (d === 1) return undefined; // already small: nothing to gain
  const decoder = new ImageDecoder({
    data: file.stream(), type: 'image/jpeg',
    desiredWidth: Math.ceil(size.width / d), desiredHeight: Math.ceil(size.height / d),
  });
  try {
    const { image } = await decoder.decode();
    return { source: image, width: image.displayWidth, height: image.displayHeight, close: () => image.close() };
  } catch {
    return undefined; // the decoder said no: the plain way below may still manage
  } finally {
    decoder.close();
  }
}

/** The whole picture, turned the way the camera's orientation tag says. */
async function fullPicture(file: Blob): Promise<Picture> {
  const b = await createImageBitmap(file, { imageOrientation: 'from-image' });
  return { source: b, width: b.width, height: b.height, close: () => b.close() };
}

const api = {
  /** A small JPEG (PNG for see-through formats) whose shorter side is `side` (see thumbSize). */
  async thumb(file: Blob, side: number): Promise<Blob> {
    // Older Safari has no OffscreenCanvas 2D: the page then shows the photo itself, as before.
    if (typeof OffscreenCanvas !== 'function' || typeof createImageBitmap !== 'function') throw new Error(UNSUPPORTED);
    const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
    const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    // The decoded picture exists only inside this call, and is closed as soon as it's scaled.
    const pic = (jpeg && (await scaledJpeg(file, head, side))) || (await fullPicture(file));
    let small: ImageBitmap | undefined;
    try {
      const { width, height } = thumbSize(pic.width, pic.height, side);
      small = await createImageBitmap(pic.source as ImageBitmapSource, { resizeWidth: width, resizeHeight: height, resizeQuality: 'medium' });
    } finally {
      pic.close();
    }
    try {
      const canvas = new OffscreenCanvas(small.width, small.height);
      canvas.getContext('2d')!.drawImage(small, 0, 0);
      // JPEG for photos; PNG for formats that may be see-through, so the tile's own colour shows.
      return await canvas.convertToBlob(jpeg ? { type: 'image/jpeg', quality: 0.82 } : { type: 'image/png' });
    } finally {
      small.close();
    }
  },
};

export type ThumbApi = typeof api;
Comlink.expose(api);
