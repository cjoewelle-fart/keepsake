// Main-thread side of HEIC previews: one decoding worker, started on first use, fed one file at
// a time, replaced if a decode hangs, and shut down when idle so its memory is given back.
// The queue, time limit and URL cache live in previewQueue.ts (tested in Node).
import * as Comlink from 'comlink';
import type { HeicApi } from '../worker/heic.worker';
import { createPreviewQueue, type Lease } from './previewQueue';

/** Don't try to decode very large files for a preview. */
export const HEIC_PREVIEW_MAX_BYTES = 60 * 1024 * 1024;

async function startDecoder() {
  // The shareable single-page preview needs everything inline; the real app loads the
  // decoder as its own file, only when a HEIC preview is first needed.
  const mod = import.meta.env.MODE === 'artifact'
    ? await import('../worker/heic.worker.ts?worker&inline')
    : await import('../worker/heic.worker.ts?worker');
  const raw: Worker = new mod.default();
  const api = Comlink.wrap<HeicApi>(raw);
  return { decode: (file: Blob, maxSide: number) => api.preview(file, maxSide), terminate: () => raw.terminate() };
}

const queue = createPreviewQueue({ startDecoder, timeoutMs: 15_000, idleMs: 20_000, maxCached: 200 });

/** A small JPEG preview of a HEIC file, as a URL the caller releases when it stops showing it. */
export const heicPreview = (file: Blob, isWanted: () => boolean, maxSide = 320): Promise<Lease> =>
  queue.preview(file, isWanted, maxSide);
