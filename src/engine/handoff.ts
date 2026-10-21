// Handing a big folder to the scan worker a little at a time (T52).
//
// In Chromium the first look at a picked file's size (File.size, or sending the File to a
// worker, which needs it) asks the browser process about the file, about 0.15 ms each. For
// 40,000 files done in one go that froze the page for about 6 s. So the page sends the paths
// first (plain strings, cheap) and starts the scan, then sends the files with their sizes in
// small batches, handling input and drawing progress between batches. The scan looks at a file
// only once its batch has arrived; nothing about how a file is sorted changes.
import type { FileSource } from './types';

/**
 * Main-thread time per batch. Looking up sizes gets slower while the scan is reading (the
 * browser process answers both), from ~0.15 ms to ~0.5 ms a file on a 2-core machine, so
 * batches are cut by time, not by count: the page is never busy much longer than this at once.
 */
export const HANDOFF_BUDGET_MS = 40;
/** At most this many files per batch, however fast sizes come. */
export const HANDOFF_MAX_BATCH = 1000;

export type HandOverOptions = { budgetMs?: number; maxBatch?: number; now?: () => number };

/**
 * Page side: send `files` with their sizes in batches of about `budgetMs` of work each,
 * waiting for each batch to be taken before the next (the page handles input and draws in
 * between). Stops early (returns false) as soon as `isStopped()` says so.
 */
export async function handOver<F>(
  files: readonly F[],
  sizeOf: (f: F) => number,
  send: (start: number, batch: F[], sizes: number[]) => Promise<void>,
  isStopped: () => boolean,
  { budgetMs = HANDOFF_BUDGET_MS, maxBatch = HANDOFF_MAX_BATCH, now = () => performance.now() }: HandOverOptions = {},
): Promise<boolean> {
  let start = 0;
  while (start < files.length) {
    if (isStopped()) return false;
    const t0 = now();
    const batch: F[] = [];
    const sizes: number[] = [];
    // At least one file per batch, so it always moves forward.
    do {
      const f = files[start + batch.length];
      sizes.push(sizeOf(f));
      batch.push(f);
    } while (start + batch.length < files.length && batch.length < maxBatch && now() - t0 < budgetMs);
    await send(start, batch, sizes);
    start += batch.length;
  }
  return !isStopped();
}

export type Feed<F> = {
  /** One source per file. Its size and bytes are there once `ready(i)` has resolved. */
  sources: FileSource[];
  /** Resolves when file `i` has arrived; rejects if the feed was closed first. */
  ready(i: number): Promise<void>;
  /** Files `start`, `start + 1`, … have arrived, with their sizes. */
  add(start: number, files: readonly F[], sizes: readonly number[]): void;
  /** No more files will come (Stop, or the page failed): waits still pending fail with `err`. */
  close(err: Error): void;
};

/**
 * Worker side: sources for files that arrive later, in batches. `open` makes the real source
 * once a file is here. Read-only, like every FileSource.
 */
export function feed<F>(paths: readonly string[], open: (file: F, path: string, size: number) => FileSource): Feed<F> {
  const opened: (FileSource | undefined)[] = new Array(paths.length);
  const waiting = new Map<number, { ok: () => void; fail: (e: Error) => void }[]>();
  let closed: Error | undefined;

  const ready = (i: number): Promise<void> => {
    if (opened[i]) return Promise.resolve();
    if (closed) return Promise.reject(closed);
    return new Promise((ok, fail) => {
      const list = waiting.get(i);
      if (list) list.push({ ok, fail }); else waiting.set(i, [{ ok, fail }]);
    });
  };
  const here = (i: number) => {
    const s = opened[i];
    if (!s) throw new Error(`file ${i} has not arrived yet`);
    return s;
  };

  const sources: FileSource[] = paths.map((path, i) => ({
    path,
    get size() { return here(i).size; },
    read: async (start, end) => { await ready(i); return here(i).read(start, end); },
  }));

  return {
    sources,
    ready,
    add(start, files, sizes) {
      if (closed) return;
      files.forEach((f, k) => {
        const i = start + k;
        if (i < 0 || i >= paths.length || opened[i]) return;
        opened[i] = open(f, paths[i], sizes[k]);
        const list = waiting.get(i);
        if (list) { waiting.delete(i); for (const w of list) w.ok(); }
      });
    },
    close(err) {
      if (closed) return;
      closed = err;
      for (const list of waiting.values()) for (const w of list) w.fail(err);
      waiting.clear();
    },
  };
}
