// T40: the exact-copy check runs several fingerprints at once but must give the same
// answer as checking one file at a time, whatever order the reads finish in.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { markCopies } from '../src/engine/scan';
import type { FileRecord, FileSource } from '../src/engine/types';

/** Small deterministic PRNG so failures can be reproduced. */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Item = { data: Uint8Array; camera?: string; takenAt?: string };

/**
 * A set of files with many same-size suspects: several byte patterns per size, each repeated,
 * some with photo details (so the keeper isn't always the first one), plus unique sizes.
 */
function makeItems(rand: () => number): Item[] {
  const items: Item[] = [];
  for (let s = 0; s < 6; s++) {
    const size = 1000 + s * 17;
    for (let v = 0; v < 3; v++) {
      const base = new Uint8Array(size).map((_, i) => (i * (v + 3) + s) & 255);
      const reps = 1 + Math.floor(rand() * 4);
      for (let k = 0; k < reps; k++) {
        const r = rand();
        items.push({
          data: base.slice(),
          ...(r < 0.25 ? { takenAt: '2020-01-01T00:00:00' } : {}),
          ...(r > 0.75 ? { camera: 'Cam' } : {}),
        });
      }
    }
  }
  for (let u = 0; u < 5; u++) items.push({ data: new Uint8Array(5000 + u).fill(u) });
  return items;
}

type Tracker = { inFlight: number; peak: number; reads: number };

function build(items: Item[], rand: () => number, t: Tracker, failAt = new Set<number>()) {
  const sources: FileSource[] = items.map((it, i) => ({
    path: `f${i}.jpg`,
    size: it.data.length,
    async read(s, e) {
      t.reads++;
      t.inFlight++;
      t.peak = Math.max(t.peak, t.inFlight);
      try {
        await new Promise((r) => setTimeout(r, Math.floor(rand() * 4))); // random finish order
        if (failAt.has(i)) throw new Error('NotReadableError');
        return it.data.slice(s, e);
      } finally {
        t.inFlight--;
      }
    },
  }));
  const records: FileRecord[] = items.map((it, i) => ({
    index: i, path: `f${i}.jpg`, size: it.data.length, kind: 'jpeg', group: 'keep', reason: 'photo',
    ...(it.camera ? { camera: it.camera } : {}), ...(it.takenAt ? { takenAt: it.takenAt } : {}),
  }));
  return { sources, records };
}

/** The pre-T40 algorithm: one file at a time, decided per size group. */
function serialReference(records: FileRecord[], items: Item[], fail = new Set<number>()) {
  const out = records.map((r) => ({ ...r }));
  const bySize = new Map<number, FileRecord[]>();
  for (const r of out) {
    if (r.group !== 'keep') continue;
    const l = bySize.get(r.size);
    if (l) l.push(r); else bySize.set(r.size, [r]);
  }
  const richness = (r: FileRecord) => (r.takenAt ? 2 : 0) + (r.camera ? 1 : 0);
  for (const list of bySize.values()) {
    if (list.length < 2) continue;
    const byPrint = new Map<string, FileRecord[]>();
    for (const r of list) {
      if (fail.has(r.index)) continue;
      const fp = createHash('sha256').update(items[r.index].data).digest('hex');
      const same = byPrint.get(fp);
      if (same) same.push(r); else byPrint.set(fp, [r]);
    }
    for (const same of byPrint.values()) {
      if (same.length < 2) continue;
      // T101: ties go to the first path in code-unit order, not the first in the list.
      const [keeper] = [...same].sort((a, b) => richness(b) - richness(a) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) || a.index - b.index);
      for (const r of same) if (r !== keeper) Object.assign(r, { group: 'duplicate', reason: 'copy', copyOf: keeper.index });
    }
  }
  return out;
}

const outcome = (rs: FileRecord[]) => rs.map((r) => [r.index, r.group, r.reason, r.copyOf ?? null]);

describe('copy check with several reads at once', () => {
  it('gives the same result as the one-at-a-time check on shuffled inputs', async () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rand = rng(seed);
      const items = shuffle(makeItems(rand), rand);
      const fail = seed % 3 === 0 ? new Set([Math.floor(rand() * items.length)]) : new Set<number>();
      const expected = outcome(serialReference(build(items, rand, { inFlight: 0, peak: 0, reads: 0 }).records, items, fail));
      expect(expected.some((o) => o[1] === 'duplicate')).toBe(true);
      for (const c of [1, 2, 4, 9]) {
        const t = { inFlight: 0, peak: 0, reads: 0 };
        const { sources, records } = build(items, rand, t, fail);
        await markCopies(records, sources, undefined, undefined, c);
        expect(outcome(records), `seed ${seed}, concurrency ${c}`).toEqual(expected);
        expect(t.peak).toBeLessThanOrEqual(c);
      }
    }
  });

  it('really runs several at once, and never more than asked', async () => {
    const rand = rng(99);
    const items = makeItems(rand);
    const t = { inFlight: 0, peak: 0, reads: 0 };
    const { sources, records } = build(items, rand, t);
    await markCopies(records, sources, undefined, undefined, 4);
    expect(t.peak).toBe(4);
  });

  it('stops reading soon after cancel and marks nothing', async () => {
    const rand = rng(7);
    const items = makeItems(rand);
    const t = { inFlight: 0, peak: 0, reads: 0 };
    const { sources, records } = build(items, rand, t);
    let cancelled = false;
    const wrapped = sources.map((s) => ({
      ...s,
      read: async (a: number, b: number) => {
        const out = await s.read(a, b);
        if (t.reads >= 5) cancelled = true;
        return out;
      },
    }));
    await markCopies(records, wrapped, undefined, () => cancelled, 4);
    // At most the reads already started when cancel happened (one per slot) finish after it.
    expect(t.reads).toBeLessThanOrEqual(5 + 4);
    expect(t.reads).toBeLessThan(items.length);
    expect(records.every((r) => r.group === 'keep')).toBe(true);
  });

  it('reports progress, throttled, ending at the total', async () => {
    const rand = rng(3);
    const items = makeItems(rand);
    const { sources, records } = build(items, rand, { inFlight: 0, peak: 0, reads: 0 });
    const seen: number[] = [];
    await markCopies(records, sources, (p) => seen.push(p.done), undefined, 4);
    const total = records.length - 5; // the five unique sizes are never read
    expect(seen.at(-1)).toBe(total);
    expect(seen.length).toBeLessThan(total);
  });

  it('files over 64 MB are compared in full, 1 MB at a time (T33)', async () => {
    const size = 70 * 1024 * 1024;
    const ranges: [number, number][][] = [[], [], []];
    const big = (i: number, fill: number): FileSource => ({
      path: 'v.mp4', size,
      read: async (s, e) => { ranges[i].push([s, e]); return new Uint8Array(e - s).fill(fill); },
    });
    const records: FileRecord[] = [0, 1, 2].map((i) => ({ index: i, path: 'v.mp4', size, kind: 'mp4', group: 'keep', reason: 'video' }));
    await markCopies(records, [big(0, 1), big(1, 1), big(2, 2)], undefined, undefined, 4);
    expect(records.map((r) => r.group)).toEqual(['keep', 'duplicate', 'keep']);
    expect(ranges.flat().every(([s, e]) => e - s <= 1024 * 1024)).toBe(true);
    // The two matching files were read in full; the third only at its start and end.
    const bytesRead = ranges.map((rs) => rs.reduce((n, [s, e]) => n + e - s, 0));
    expect(bytesRead).toEqual([size + 2 * 1024 * 1024, size + 2 * 1024 * 1024, 2 * 1024 * 1024]);
  });
});
