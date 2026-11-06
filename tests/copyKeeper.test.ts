// T101: which of several exact copies is kept must not depend on the order the browser listed
// the files in. Ties (same details) go to the first path in plain code-unit order.
import { describe, expect, it } from 'vitest';
import { markCopies } from '../src/engine/scan';
import type { FileRecord, FileSource } from '../src/engine/types';
import { placeFor } from '../src/ui/savePlan';

type Spec = { path: string; data: Uint8Array; takenAt?: string; camera?: string };

const bytes = (n: number, seed: number) => new Uint8Array(n).map((_, i) => (i * 7 + seed) & 255);

/** Feed `specs` in the given order; returns the kept file of each copy set and its saved place. */
async function run(specs: Spec[]) {
  const sources: FileSource[] = specs.map((s) => ({
    path: s.path,
    size: s.data.length,
    async read(a, b) { return s.data.slice(a, b); },
  }));
  const records: FileRecord[] = specs.map((s, i) => ({
    index: i, path: s.path, size: s.data.length, kind: 'jpeg', group: 'keep', reason: 'photo',
    ...(s.takenAt ? { takenAt: s.takenAt } : {}), ...(s.camera ? { camera: s.camera } : {}),
  }));
  const snapshot = specs.map((s) => s.data.slice());
  await markCopies(records, sources);
  // Read-only: the copy check never changes a source's bytes.
  specs.forEach((s, i) => expect(s.data).toEqual(snapshot[i]));
  const kept = records.filter((r) => r.group === 'keep');
  const copies = records.filter((r) => r.group === 'duplicate');
  // Every copy points at a kept file, by that file's index in this run.
  for (const c of copies) expect(records[c.copyOf!].group).toBe('keep');
  const place = (r: FileRecord) => { const p = placeFor(r); return [...p.dir, p.ext ? `${p.base}.${p.ext}` : p.base].join('/'); };
  return {
    kept: kept.map((r) => r.path).sort(),
    places: kept.map(place).sort(),
    copyOf: Object.fromEntries(copies.map((c) => [c.path, records[c.copyOf!].path])),
  };
}

const orders = <T,>(xs: T[]): T[][] => [xs, [...xs].reverse(), [xs[1], xs[2], xs[0], ...xs.slice(3)]];

describe('exact copies: the kept file is the same whatever the listing order (T101)', () => {
  it('undated copies: keeps the first path in code-unit order, so the saved name is stable', async () => {
    const d = bytes(3000, 1);
    // Code-unit order, not locale or numeric: "Z" (0x5A) < "a" (0x61), "f10" < "f9".
    const specs: Spec[] = [
      { path: 'recup_dir.2/f9.jpg', data: d.slice() },
      { path: 'recup_dir.2/f10.jpg', data: d.slice() },
      { path: 'recup_dir.1/a.jpg', data: d.slice() },
      { path: 'recup_dir.1/Z.jpg', data: d.slice() },
    ];
    const results = [];
    for (const o of orders(specs)) results.push(await run(o));
    for (const r of results) {
      expect(r.kept).toEqual(['recup_dir.1/Z.jpg']);
      expect(r.places).toEqual(['No date/Z.jpg']);
      expect(r.copyOf).toEqual({
        'recup_dir.1/a.jpg': 'recup_dir.1/Z.jpg',
        'recup_dir.2/f10.jpg': 'recup_dir.1/Z.jpg',
        'recup_dir.2/f9.jpg': 'recup_dir.1/Z.jpg',
      });
    }
  });

  it('dated copies with equal details: same kept file and same saved name (extension included)', async () => {
    const d = bytes(4000, 2);
    const at = '2021-07-04T10:15:00';
    const specs: Spec[] = [
      { path: 'recup_dir.3/f200.jpg', data: d.slice(), takenAt: at, camera: 'Cam' },
      { path: 'recup_dir.1/f500.JPEG', data: d.slice(), takenAt: at, camera: 'Cam' },
      { path: 'recup_dir.2/f100.jpg', data: d.slice(), takenAt: at, camera: 'Cam' },
    ];
    for (const o of orders(specs)) {
      const r = await run(o);
      expect(r.kept).toEqual(['recup_dir.1/f500.JPEG']);
      expect(r.places).toEqual(['2021/07 July/2021-07-04 10.15.jpeg']);
    }
  });

  it('a copy with richer details still wins over a lower path (unchanged rule)', async () => {
    const d = bytes(5000, 3);
    const specs: Spec[] = [
      { path: 'a/f1.jpg', data: d.slice() },
      { path: 'b/f2.jpg', data: d.slice(), takenAt: '2019-01-02T03:04:05' },
      { path: 'c/f3.jpg', data: d.slice(), takenAt: '2019-01-02T03:04:05', camera: 'Cam' },
    ];
    for (const o of orders(specs)) expect((await run(o)).kept).toEqual(['c/f3.jpg']);
  });

  it('several copy sets at once, mixed with unique files, in many orders', async () => {
    const specs: Spec[] = [];
    for (let set = 0; set < 4; set++) {
      const d = bytes(1000 + set, set);
      for (let k = 0; k < 3; k++) specs.push({ path: `recup_dir.${3 - k}/f${set}${k}.jpg`, data: d.slice() });
    }
    for (let u = 0; u < 3; u++) specs.push({ path: `recup_dir.1/u${u}.jpg`, data: bytes(1000 + u, 50 + u) });
    const base = await run(specs);
    expect(base.kept).toHaveLength(4 + 3);
    let seed = 5;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    for (let t = 0; t < 10; t++) {
      const shuffled = [...specs];
      for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
      expect(await run(shuffled)).toEqual(base);
    }
  });
});
