// Main-thread side of the small tile previews (T53): a couple of workers that make small copies
// of photos near the screen, sized to the tile, and a capped cache of the copies. The page never
// decodes a full-size photo for a tile. The queue, time limit and cache live in previewQueue.ts.
import * as Comlink from 'comlink';
import type { ThumbApi } from '../worker/thumb.worker';
import { createPreviewQueue, type Lease } from './previewQueue';
import { UNSUPPORTED } from './thumbSize';

/** Don't make small copies of very large files (the tile falls back to the photo itself). */
export const THUMB_MAX_BYTES = 80 * 1024 * 1024;

async function startDecoder() {
  // The shareable single-page preview needs everything inline.
  const mod = import.meta.env.MODE === 'artifact' || import.meta.env.MODE === 'artifact-test'
    ? await import('../worker/thumb.worker.ts?worker&inline')
    : await import('../worker/thumb.worker.ts?worker');
  const raw: Worker = new mod.default();
  const api = Comlink.wrap<ThumbApi>(raw);
  return { decode: (file: Blob, side: number) => api.thumb(file, side), terminate: () => raw.terminate() };
}

// Two or three workers (three on 6+ cores): enough to keep up with a scroll, few enough that at
// most three full-size photos are ever decoded at once.
const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
const queue = createPreviewQueue({
  startDecoder, concurrency: Math.min(3, Math.max(2, cores >> 1)), timeoutMs: 15_000, idleMs: 20_000, maxCached: 300,
});

/** Set once a worker reports this browser can't make copies: tiles then show the photo itself. */
let unsupported = false;
export const thumbsSupported = () => !unsupported;

/**
 * A small copy of a photo whose shorter side is `side` px (from thumbSide), as a URL the caller
 * releases when it stops showing it.
 */
export async function thumbnail(file: Blob, isWanted: () => boolean, side: number): Promise<Lease> {
  try {
    return await queue.preview(file, isWanted, side);
  } catch (e) {
    if (e instanceof Error && e.message === UNSUPPORTED) unsupported = true;
    throw e;
  }
}

/** Give back every cached small copy no tile shows now (starting over with another folder, T83). */
export const dropUnusedThumbs = () => queue.dropUnused();
