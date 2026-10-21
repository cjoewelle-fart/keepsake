// Handing files to the scan worker in batches (T52): same results, Stop works mid-way.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { feed, handOver } from '../src/engine/handoff';
import { scanAll } from '../src/engine/scan';
import type { FileSource } from '../src/engine/types';
import { fsSource, walk } from './fs-source';

const root = join(__dirname, 'real-phones');
const direct = (): FileSource[] => {
  const files = walk(root).filter((p) => !p.endsWith('README.md')).map((p) => fsSource(root, p));
  // Add an exact copy and an empty file so the copies pass and the no-read path are covered too.
  return [...files, { ...files[0], path: 'copy/' + files[0].path }, { path: 'empty.jpg', size: 0, read: async () => new Uint8Array() }];
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('handOver', () => {
  it('sends every file once, in order, with its size, at most maxBatch at a time', async () => {
    const files = Array.from({ length: 1003 }, (_, i) => i);
    const got: [number, number[], number[]][] = [];
    expect(await handOver(files, (f) => f * 10, async (start, b, sizes) => { got.push([start, b, sizes]); }, () => false, { maxBatch: 250 })).toBe(true);
    expect(got.map(([s, b]) => [s, b.length])).toEqual([[0, 250], [250, 250], [500, 250], [750, 250], [1000, 3]]);
    expect(got.flatMap(([, b]) => b)).toEqual(files);
    expect(got.flatMap(([, , s]) => s)).toEqual(files.map((f) => f * 10));
  });

  it('cuts a batch when its time budget is used up, but always sends at least one file', async () => {
    // Every size lookup takes 15 ms on this fake clock; budget 40 ms -> 3 files a batch.
    let clock = 0;
    const lens: number[] = [];
    await handOver(Array.from({ length: 10 }, (_, i) => i), () => { clock += 15; return 1; }, async (_, b) => { lens.push(b.length); }, () => false, { budgetMs: 40, now: () => clock });
    expect(lens).toEqual([3, 3, 3, 1]);
    // A single lookup slower than the whole budget still makes progress.
    const slow: number[] = [];
    await handOver([1, 2, 3], () => { clock += 100; return 1; }, async (_, b) => { slow.push(b.length); }, () => false, { budgetMs: 40, now: () => clock });
    expect(slow).toEqual([1, 1, 1]);
  });

  it('stops sending as soon as Stop is pressed', async () => {
    let stopped = false;
    let sent = 0;
    const ok = await handOver(Array.from({ length: 1000 }, (_, i) => i), () => 1, async () => { if (++sent === 2) stopped = true; }, () => stopped, { maxBatch: 100 });
    expect(ok).toBe(false);
    expect(sent).toBe(2);
  });
});

describe('feed', () => {
  it('gives the same results as handing every file over at once', async () => {
    const all = direct();
    const before = await scanAll(all);
    const f = feed<FileSource>(all.map((s) => s.path), (s) => s);
    const scanning = scanAll(f.sources, { ready: f.ready });
    // Batches of 3, arriving a tick apart while the scan is already running.
    const fed = handOver(all, (s) => s.size, async (start, b, sizes) => { await tick(); f.add(start, b, sizes); }, () => false, { maxBatch: 3 });
    const [after] = await Promise.all([scanning, fed]);
    expect(after).toEqual(before);
    expect(before!.some((r) => r.group === 'duplicate')).toBe(true);
  });

  it('files wait for their batch; closing fails the waits so a stopped scan ends', async () => {
    const all = direct();
    const f = feed<FileSource>(all.map((s) => s.path), (s) => s);
    expect(f.sources[1].path).toBe(all[1].path);
    expect(() => f.sources[1].size).toThrow(/not arrived/);
    let read = false;
    const pending = f.sources[1].read(0, 4).then(() => { read = true; });
    f.add(0, [all[0]], [all[0].size]);
    await tick();
    expect(read).toBe(false);
    f.add(1, [all[1]], [all[1].size]);
    await pending;
    expect(read).toBe(true);
    expect(f.sources[1].size).toBe(all[1].size);
    await f.ready(1);

    const late = f.sources[2].read(0, 4);
    f.close(new Error('stopped'));
    await expect(late).rejects.toThrow('stopped');
    await expect(f.sources[3].read(0, 4)).rejects.toThrow('stopped');
    await expect(f.ready(3)).rejects.toThrow('stopped');
    // Files that already arrived still read (work in flight when Stop came finishes cleanly).
    expect((await f.sources[0].read(0, 2)).length).toBe(2);
  });

  it('a scan stopped mid hand-over returns null and does not hang', async () => {
    const all = direct();
    const f = feed<FileSource>(all.map((s) => s.path), (s) => s);
    let cancelled = false;
    const scanning = scanAll(f.sources, { isCancelled: () => cancelled, ready: f.ready });
    f.add(0, all.slice(0, 2), all.slice(0, 2).map((s) => s.size));
    await tick();
    cancelled = true;
    f.close(new Error('stopped'));
    expect(await scanning).toBeNull();
  });

  it('a scan whose files stop coming without Stop also ends with null', async () => {
    const all = direct();
    const f = feed<FileSource>(all.map((s) => s.path), (s) => s);
    const scanning = scanAll(f.sources, { ready: f.ready });
    f.add(0, all.slice(0, 2), all.slice(0, 2).map((s) => s.size));
    await tick();
    f.close(new Error('page failed'));
    expect(await scanning).toBeNull();
  });
});
