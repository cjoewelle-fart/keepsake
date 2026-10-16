// The logic behind HEIC previews, kept free of React and of real workers so it can be tested
// in Node: one decoder at a time, a time limit per decode, and a capped cache of preview URLs.

/** A started decoding worker. */
export type Decoder = {
  decode(file: Blob, maxSide: number): Promise<Blob>;
  terminate(): void;
};

/** A preview URL a tile is using. Call `release` when the tile stops showing it. */
export type Lease = { url: string; release(): void };

export type PreviewQueueOptions = {
  startDecoder: () => Decoder | Promise<Decoder>;
  /** A decode taking longer than this is abandoned and its worker replaced. */
  timeoutMs?: number;
  /** Stop the worker after this long without work, to give its memory back. */
  idleMs?: number;
  /** Keep at most this many finished previews (more only while tiles are showing them). */
  maxCached?: number;
  createUrl?: (b: Blob) => string;
  revokeUrl?: (url: string) => void;
};

export const SKIPPED = new Error('preview no longer needed');
export const TIMED_OUT = new Error('preview took too long');

type Entry = { job: Promise<string>; url?: string; users: number };

export function createPreviewQueue(o: PreviewQueueOptions) {
  const {
    startDecoder, timeoutMs = 15_000, idleMs = 20_000, maxCached = 200,
    createUrl = (b) => URL.createObjectURL(b), revokeUrl = (u) => URL.revokeObjectURL(u),
  } = o;
  let decoder: Decoder | undefined;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<unknown> = Promise.resolve();
  /** Insertion order = least recently used first. */
  const cache = new Map<Blob, Entry>();

  const stop = (d: Decoder | undefined) => {
    if (!d) return;
    if (decoder === d) decoder = undefined;
    d.terminate();
  };
  const stopWhenIdle = () => {
    clearTimeout(idle);
    idle = setTimeout(() => stop(decoder), idleMs);
  };

  /** Decode with a time limit. A hung decode (odd or hostile file) costs its worker, not the queue. */
  async function decodeOnce(file: Blob, maxSide: number): Promise<Blob> {
    const d = (decoder ??= await startDecoder());
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { stop(d); reject(TIMED_OUT); }, timeoutMs);
    });
    try {
      return await Promise.race([d.decode(file, maxSide), limit]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Drop the oldest previews nobody is showing until the cache is back under its cap. */
  function trim() {
    for (const [file, e] of cache) {
      if (cache.size <= maxCached) return;
      if (e.users > 0) continue; // on screen, or still being made
      cache.delete(file);
      if (e.url) revokeUrl(e.url);
    }
  }

  /**
   * A preview URL for a HEIC file. Requests run one after another; `isWanted` is checked just
   * before decoding so previews scrolled away (or closed) are skipped. A failed or timed-out
   * file is remembered and not retried; a skipped one can be asked for again.
   */
  async function preview(file: Blob, isWanted: () => boolean, maxSide = 320): Promise<Lease> {
    let e = cache.get(file);
    if (e) {
      cache.delete(file); // move to the most recently used end
      cache.set(file, e);
    } else {
      const entry: Entry = { users: 0, job: undefined as unknown as Promise<string> };
      entry.job = chain.then(async () => {
        if (!isWanted()) throw SKIPPED;
        clearTimeout(idle);
        try {
          const blob = await decodeOnce(file, maxSide);
          entry.url = createUrl(blob);
          return entry.url;
        } finally {
          stopWhenIdle();
        }
      });
      chain = entry.job.catch(() => undefined);
      entry.job.catch((err) => { if (err === SKIPPED && cache.get(file) === entry) cache.delete(file); });
      cache.set(file, entry);
      e = entry;
    }
    const entry = e;
    entry.users++; // counted before waiting, so it can't be evicted between "ready" and "shown"
    let url: string;
    try {
      url = await entry.job;
    } catch (err) {
      entry.users--;
      trim();
      throw err;
    }
    let released = false;
    trim();
    return {
      url,
      release() {
        if (released) return;
        released = true;
        entry.users--;
        trim();
      },
    };
  }

  return {
    preview,
    /** For tests: how many previews are cached, and whether a worker is running. */
    stats: () => ({ cached: cache.size, urls: [...cache.values()].filter((e) => e.url).length, running: decoder !== undefined }),
  };
}
