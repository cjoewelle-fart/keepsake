// Main-thread side of HEIC previews: one or two decoding workers, started on first use, each fed
// one file at a time, replaced if a decode hangs, and shut down when idle so their memory is given
// back. The queue, time limit and URL cache live in previewQueue.ts (tested in Node).
import * as Comlink from 'comlink';
import type { HeicApi } from '../worker/heic.worker';
import { createPreviewQueue, type Lease } from './previewQueue';

/** Don't try to decode very large files for a preview. */
export const HEIC_PREVIEW_MAX_BYTES = 60 * 1024 * 1024;

/** Starts one HEIC decoding worker (also used by the large-photo viewer's own queue, viewerMedia.ts). */
export async function startHeicDecoder() {
  // The shareable single-page preview needs everything inline; the real app loads the
  // decoder as its own file, only when a HEIC preview is first needed.
  const mod = import.meta.env.MODE === 'artifact' || import.meta.env.MODE === 'artifact-test'
    ? await import('../worker/heic.worker.ts?worker&inline')
    : await import('../worker/heic.worker.ts?worker');
  const raw: Worker = new mod.default();
  const api = Comlink.wrap<HeicApi>(raw);
  return { decode: (file: Blob, maxSide: number) => api.preview(file, maxSide), terminate: () => raw.terminate() };
}

/**
 * Most phone HEICs carry a small copy that decodes in ~15 ms (T54), but one without it (edited or
 * exported photos) takes ~1 s and grows its worker to ~90 MB. A second worker keeps such a file
 * from holding up the quick ones behind it. It only starts when two previews are waiting at once,
 * and only on computers with 4+ cores and (where the browser says) 4+ GB of memory.
 */
function workers(): number {
  if (typeof navigator === 'undefined') return 1;
  const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  return (navigator.hardwareConcurrency || 2) >= 4 && memoryGb >= 4 ? 2 : 1;
}

const queue = createPreviewQueue({ startDecoder: startHeicDecoder, concurrency: workers(), timeoutMs: 15_000, idleMs: 20_000, maxCached: 200 });

/** A small JPEG preview of a HEIC file, as a URL the caller releases when it stops showing it. */
export const heicPreview = (file: Blob, isWanted: () => boolean, maxSide = 320): Promise<Lease> =>
  queue.preview(file, isWanted, maxSide);

/** Give back every cached HEIC preview no tile shows now (starting over with another folder, T83). */
export const dropUnusedHeicPreviews = () => queue.dropUnused();
