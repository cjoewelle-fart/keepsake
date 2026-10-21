// Decodes HEIC photos into small JPEG previews for browsers that can't show HEIC
// (Chrome, Edge, Firefox). Runs libheif compiled to WebAssembly, bundled with the app:
// nothing is fetched and nothing leaves the computer. One file at a time, off the main thread.
// Uses the small copy phones store inside each HEIC when it fits (T54, see heicDecode.ts).
import * as Comlink from 'comlink';
// @ts-expect-error: the bundle ships without its own type declarations
import libheifFactory from 'libheif-js/libheif-wasm/libheif-bundle.mjs';
import { decodeForPreview, type LibheifC } from './heicDecode';

let lib: Promise<LibheifC> | undefined;

const api = {
  /** Decode the picture and return a JPEG whose longer side is at most `maxSide`. */
  async preview(file: Blob, maxSide: number): Promise<Blob> {
    lib ??= libheifFactory() as Promise<LibheifC>;
    const heif = await lib;
    const rgba = decodeForPreview(heif, new Uint8Array(await file.arrayBuffer()), maxSide);
    const { width: w, height: h } = rgba;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const bitmap = await createImageBitmap(new ImageData(rgba.data as Uint8ClampedArray<ArrayBuffer>, w, h), {
      resizeWidth: Math.max(1, Math.round(w * scale)),
      resizeHeight: Math.max(1, Math.round(h * scale)),
      resizeQuality: 'medium',
    });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    bitmap.close();
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  },
};

export type HeicApi = typeof api;
Comlink.expose(api);
