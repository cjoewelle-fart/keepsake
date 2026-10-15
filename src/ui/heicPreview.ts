// Main-thread side of HEIC previews: one decoding worker, started on first use,
// fed one file at a time, and shut down when idle so its memory is given back.
import * as Comlink from 'comlink';
import type { HeicApi } from '../worker/heic.worker';

const IDLE_MS = 20_000;
/** Don't try to decode very large files for a preview. */
export const HEIC_PREVIEW_MAX_BYTES = 60 * 1024 * 1024;

let worker: { raw: Worker; api: Comlink.Remote<HeicApi> } | undefined;
let idle: ReturnType<typeof setTimeout> | undefined;
let chain: Promise<unknown> = Promise.resolve();
const cache = new WeakMap<Blob, Promise<Blob>>();
const SKIPPED = new Error('preview no longer needed');

async function getWorker() {
  if (!worker) {
    // The shareable single-page preview needs everything inline; the real app loads the
    // decoder as its own file, only when a HEIC preview is first needed.
    const mod = import.meta.env.MODE === 'artifact'
      ? await import('../worker/heic.worker.ts?worker&inline')
      : await import('../worker/heic.worker.ts?worker');
    const raw: Worker = new mod.default();
    worker = { raw, api: Comlink.wrap<HeicApi>(raw) };
  }
  return worker;
}

function stopWhenIdle() {
  clearTimeout(idle);
  idle = setTimeout(() => {
    worker?.raw.terminate();
    worker = undefined;
  }, IDLE_MS);
}

/**
 * A small JPEG preview of a HEIC file. Requests run one after another; `isWanted` is
 * checked just before decoding so previews scrolled away (or closed) are skipped.
 */
export function heicPreview(file: Blob, isWanted: () => boolean, maxSide = 320): Promise<Blob> {
  const hit = cache.get(file);
  if (hit) return hit;
  const job = chain.then(async () => {
    if (!isWanted()) throw SKIPPED;
    clearTimeout(idle);
    try {
      return await (await getWorker()).api.preview(file, maxSide);
    } finally {
      stopWhenIdle();
    }
  });
  chain = job.catch(() => undefined);
  cache.set(file, job);
  job.catch((e) => { if (e === SKIPPED) cache.delete(file); }); // a skipped job can be asked for again
  return job;
}
