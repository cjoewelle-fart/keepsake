// Decodes HEIC photos into small JPEG previews for browsers that can't show HEIC
// (Chrome, Edge, Firefox). Runs libheif compiled to WebAssembly, bundled with the app:
// nothing is fetched and nothing leaves the computer. One file at a time, off the main thread.
import * as Comlink from 'comlink';
// @ts-expect-error: the bundle ships without its own type declarations
import libheifFactory from 'libheif-js/libheif-wasm/libheif-bundle.mjs';

type HeifImage = {
  get_width(): number;
  get_height(): number;
  is_primary(): boolean;
  display(target: ImageData, done: (result: ImageData | null) => void): void;
  free(): void;
};
type Libheif = {
  HeifDecoder: new () => { decoder: unknown; decode(data: Uint8Array): HeifImage[] };
  heif_context_free(ctx: unknown): void;
};

let lib: Promise<Libheif> | undefined;

/** Biggest picture we'll decode, in pixels (a 48 MP iPhone ProRAW-sized HEIC is ~48M). */
const MAX_PIXELS = 50_000_000;

const api = {
  /** Decode the main picture and return a JPEG whose longer side is at most `maxSide`. */
  async preview(file: Blob, maxSide: number): Promise<Blob> {
    lib ??= libheifFactory() as Promise<Libheif>;
    const heif = await lib;
    const decoder = new heif.HeifDecoder();
    let images: HeifImage[] = [];
    try {
      images = decoder.decode(new Uint8Array(await file.arrayBuffer()));
      const image = images.find((i) => i.is_primary()) ?? images[0];
      if (!image) throw new Error('no picture');
      const w = image.get_width(), h = image.get_height();
      if (!(w > 0 && h > 0) || w * h > MAX_PIXELS) throw new Error('unsupported size');
      const pixels = await new Promise<ImageData>((resolve, reject) =>
        image.display(new ImageData(w, h), (r) => (r ? resolve(r) : reject(new Error('decode failed')))));
      const scale = Math.min(1, maxSide / Math.max(w, h));
      const bitmap = await createImageBitmap(pixels, {
        resizeWidth: Math.max(1, Math.round(w * scale)),
        resizeHeight: Math.max(1, Math.round(h * scale)),
        resizeQuality: 'medium',
      });
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
      bitmap.close();
      return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    } finally {
      for (const i of images) i.free();
      if (decoder.decoder) heif.heif_context_free(decoder.decoder);
    }
  },
};

export type HeicApi = typeof api;
Comlink.expose(api);
