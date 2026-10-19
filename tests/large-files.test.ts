// T33: full copy checks for big files without holding them in memory, and a Stop that answers fast.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { markCopies, scanAll } from '../src/engine/scan';
import { Sha256 } from '../src/engine/sha256';
import type { FileRecord, FileSource, Progress } from '../src/engine/types';

const MB = 1024 * 1024;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('streaming SHA-256', () => {
  it('matches node:crypto for every padding edge and any way of cutting the input', () => {
    const data = new Uint8Array(5000).map((_, i) => (i * 31 + 7) & 255);
    for (const len of [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000, 5000]) {
      const want = createHash('sha256').update(data.subarray(0, len)).digest('hex');
      expect(new Sha256().update(data.subarray(0, len)).hex()).toBe(want);
      for (const step of [1, 7, 63, 64, 65, 333]) {
        const h = new Sha256();
        for (let at = 0; at < len; at += step) h.update(data.subarray(at, Math.min(len, at + step)));
        expect(h.hex()).toBe(want);
      }
    }
  });
  it('matches node:crypto on a few megabytes', () => {
    const data = new Uint8Array(3 * MB + 17).map((_, i) => (i ^ (i >>> 9)) & 255);
    expect(new Sha256().update(data).hex()).toBe(createHash('sha256').update(data).digest('hex'));
  });
});

/** ftyp, a moov with an mvhd, then an mdat running to the end of the file: a whole MP4. */
const MP4_START = (() => {
  const be32 = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
  const mvhd = [...be32(108), ...ascii('mvhd'), ...new Array(12).fill(0), ...be32(600), ...be32(6000), ...new Array(80).fill(0)];
  return new Uint8Array([...be32(24), ...ascii('ftypisom'), 0, 0, 2, 0, ...ascii('isomiso2'),
    ...be32(8 + mvhd.length), ...ascii('moov'), ...mvhd, ...be32(0), ...ascii('mdat')]);
})();

/**
 * A big MP4 made on the fly: `fill` after its boxes' start, except at `diffAt` (if given).
 * Never held whole in memory.
 */
const bigFile = (size: number, fill: number, diffAt = -1, log?: [number, number][], delay = 0): FileSource => ({
  path: 'v.mp4',
  size,
  async read(s, e) {
    log?.push([s, e]);
    if (delay) await sleep(delay);
    const b = new Uint8Array(e - s).fill(fill);
    if (s < MP4_START.length) b.set(MP4_START.subarray(s, Math.min(e, MP4_START.length)), 0);
    if (diffAt >= s && diffAt < e) b[diffAt - s] = fill ^ 0xff;
    return b;
  },
});
const recs = (n: number, size: number): FileRecord[] =>
  Array.from({ length: n }, (_, i) => ({ index: i, path: 'v.mp4', size, kind: 'mp4', group: 'keep', reason: 'video' }));

describe('copies of big files', () => {
  it('does not call two big videos copies when only the middle differs (the old sampled check did)', async () => {
    const size = 70 * MB;
    const records = recs(2, size);
    await markCopies(records, [bigFile(size, 3), bigFile(size, 3, 35 * MB)]);
    expect(records.map((r) => r.group)).toEqual(['keep', 'keep']);
  });

  it('calls byte-identical big videos copies, reading at most 1 MB at a time', async () => {
    const size = 20 * MB + 123;
    const log: [number, number][] = [];
    const records = recs(3, size);
    const progress: Progress[] = [];
    await markCopies(records, [bigFile(size, 9, -1, log), bigFile(size, 9, -1, log), bigFile(size, 9, -1, log)], (p) => progress.push(p));
    expect(records.map((r) => r.group)).toEqual(['keep', 'duplicate', 'duplicate']);
    expect(Math.max(...log.map(([s, e]) => e - s))).toBeLessThanOrEqual(MB);
    expect(progress.at(-1)).toEqual({ stage: 'copies', done: 6, total: 6 });
  });

  it('leaves a big file in Keep when a read fails part way, and still finishes the progress', async () => {
    const size = 20 * MB;
    const flaky: FileSource = { ...bigFile(size, 4), read: async (s, e) => { if (s >= 10 * MB && s < 19 * MB) throw new Error('card error'); return new Uint8Array(e - s).fill(4); } };
    const records = recs(2, size);
    const progress: Progress[] = [];
    await markCopies(records, [bigFile(size, 4), flaky], (p) => progress.push(p));
    expect(records.map((r) => r.group)).toEqual(['keep', 'keep']);
    expect(progress.at(-1)).toEqual({ stage: 'copies', done: 4, total: 4 });
  });
});

describe('Stop', () => {
  it('answers within 200 ms while a slow read is in flight, and the abandoned work winds down', async () => {
    // Two same-size 30 MB files on a slow card: each 1 MB piece takes 40 ms.
    const size = 30 * MB;
    const log: [number, number][] = [];
    const sources = [0, 1].map(() => bigFile(size, 1, -1, log, 40));
    let stop = false;
    const progress: Progress[] = [];
    const run = scanAll(sources, { isCancelled: () => stop, onProgress: (p) => progress.push(p) });
    await sleep(300); // well into the copy check
    const readsAtStop = log.length;
    expect(readsAtStop).toBeGreaterThan(2);
    const t0 = performance.now();
    stop = true;
    const progressAtStop = progress.length;
    expect(await run).toBeNull();
    expect(performance.now() - t0).toBeLessThan(200);
    await sleep(200);
    // At most the pieces already in flight finish; nothing new starts, nothing more is reported.
    expect(log.length - readsAtStop).toBeLessThanOrEqual(2);
    expect(progress.length).toBe(progressAtStop);
  });

  it('answers within 200 ms even when one read takes seconds', async () => {
    let stop = false;
    const stuck: FileSource = { path: 'f.jpg', size: 1000, read: async (s, e) => { await sleep(3000); return new Uint8Array(e - s); } };
    const run = scanAll([stuck], { isCancelled: () => stop });
    await sleep(50);
    const t0 = performance.now();
    stop = true;
    expect(await run).toBeNull();
    expect(performance.now() - t0).toBeLessThan(200);
  });

  it('a scan that is never stopped still finds the copy', async () => {
    const size = 20 * MB;
    const r = await scanAll([bigFile(size, 1), bigFile(size, 1)], { isCancelled: () => false });
    expect(r?.map((x) => [x.group, x.reason, x.durationSec])).toEqual([['keep', 'video', 10], ['duplicate', 'copy', 10]]);
  });
});
