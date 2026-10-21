// The logic behind tile previews, kept free of React and of real workers so it can be tested
// in Node: a few decoders at most, a time limit per decode, and a capped cache of preview URLs.
// Used twice: small copies of ordinary photos (thumbs.ts) and HEIC decodes (heicPreview.ts).

/** A started decoding worker. */
export type Decoder = {
  decode(file: Blob, maxSide: number): Promise<Blob>;
  terminate(): void;
};

/** A preview a tile is using (its small picture, and a URL for it). Call `release` when the tile stops showing it. */
export type Lease = { url: string; blob: Blob; release(): void };

export type PreviewQueueOptions = {
  startDecoder: () => Decoder | Promise<Decoder>;
  /** How many decodes may run at once, each in its own worker. */
  concurrency?: number;
  /** A decode taking longer than this is abandoned and its worker replaced. */
  timeoutMs?: number;
  /** Stop the workers after this long without work, to give their memory back. */
  idleMs?: number;
  /** Keep at most this many finished previews (more only while tiles are showing them). */
  maxCached?: number;
  createUrl?: (b: Blob) => string;
  revokeUrl?: (url: string) => void;
};

export const SKIPPED = new Error('preview no longer needed');
export const TIMED_OUT = new Error('preview took too long');

type Entry = { job: Promise<string>; url?: string; blob?: Blob; users: number };
type Slot = { decoder?: Decoder };

export function createPreviewQueue(o: PreviewQueueOptions) {
  const {
    startDecoder, concurrency = 1, timeoutMs = 15_000, idleMs = 20_000, maxCached = 200,
    createUrl = (b) => URL.createObjectURL(b), revokeUrl = (u) => URL.revokeObjectURL(u),
  } = o;
  const slots: Slot[] = Array.from({ length: Math.max(1, concurrency) }, () => ({}));
  /** Slots not decoding right now. */
  const free = [...slots];
  /** Requests waiting for a free slot, oldest first. */
  const waiting: ((s: Slot) => void)[] = [];
  let idle: ReturnType<typeof setTimeout> | undefined;
  /** One entry per file and size. Insertion order = least recently used first. */
  const cache = new Map<string, Entry>();
  const ids = new WeakMap<Blob, number>();
  let nextId = 0;
  const keyOf = (file: Blob, maxSide: number) => {
    let id = ids.get(file);
    if (id === undefined) ids.set(file, (id = nextId++));
    return `${id}:${maxSide}`;
  };

  const stop = (slot: Slot, d: Decoder | undefined = slot.decoder) => {
    if (!d) return;
    if (slot.decoder === d) slot.decoder = undefined;
    d.terminate();
  };
  const stopWhenIdle = () => {
    clearTimeout(idle);
    idle = setTimeout(() => { for (const s of slots) stop(s); }, idleMs);
  };

  const acquire = () => new Promise<Slot>((resolve) => {
    const s = free.pop();
    if (s) resolve(s); else waiting.push(resolve);
  });
  const giveBack = (s: Slot) => {
    const next = waiting.shift();
    if (next) next(s);
    else {
      free.push(s);
      if (free.length === slots.length) stopWhenIdle();
    }
  };

  /** Decode with a time limit. A hung decode (odd or hostile file) costs its worker, not the queue. */
  async function decodeOnce(slot: Slot, file: Blob, maxSide: number): Promise<Blob> {
    const d = (slot.decoder ??= await startDecoder());
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { stop(slot, d); reject(TIMED_OUT); }, timeoutMs);
    });
    try {
      return await Promise.race([d.decode(file, maxSide), limit]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Drop the oldest previews nobody is showing until the cache is back under its cap. */
  function trim() {
    for (const [key, e] of cache) {
      if (cache.size <= maxCached) return;
      if (e.users > 0) continue; // on screen, or still being made
      cache.delete(key);
      if (e.url) revokeUrl(e.url);
    }
  }

  /**
   * A preview URL for a file at a size (`maxSide`, passed to the decoder). Requests wait their turn for a decoder; `isWanted` is checked just
   * before decoding so previews scrolled away (or closed) are skipped. A failed or timed-out
   * file is remembered and not retried; a skipped one can be asked for again.
   */
  async function preview(file: Blob, isWanted: () => boolean, maxSide = 320): Promise<Lease> {
    const key = keyOf(file, maxSide);
    let e = cache.get(key);
    if (e) {
      cache.delete(key); // move to the most recently used end
      cache.set(key, e);
    } else {
      const entry: Entry = { users: 0, job: undefined as unknown as Promise<string> };
      entry.job = acquire().then(async (slot) => {
        try {
          if (!isWanted()) throw SKIPPED;
          clearTimeout(idle);
          const blob = await decodeOnce(slot, file, maxSide);
          entry.blob = blob;
          entry.url = createUrl(blob);
          return entry.url;
        } finally {
          giveBack(slot);
        }
      });
      entry.job.catch((err) => { if (err === SKIPPED && cache.get(key) === entry) cache.delete(key); });
      cache.set(key, entry);
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
      blob: entry.blob!,
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
    /** For tests: how many previews are cached, how many are being shown, and how many workers run. */
    stats: () => {
      const all = [...cache.values()];
      const workers = slots.filter((s) => s.decoder).length;
      return { cached: cache.size, urls: all.filter((x) => x.url).length, inUse: all.filter((x) => x.users > 0).length, workers, running: workers > 0 };
    },
  };
}
