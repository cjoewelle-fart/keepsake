// The save runner against an in-memory folder that behaves like the File System Access API:
// unreadable files, a full drive, lost permission and Stop.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FileRecord } from '../src/engine/types';
import { TEMP_PREFIX, newFolderSession, saveAsZip, saveToFolder } from '../src/ui/saveRun';
import type { DirHandle } from '../src/ui/saveRun';
import { ZipLog, planNames, splitParts } from '../src/ui/savePlan';
import type { Planned } from '../src/ui/savePlan';
import { copy } from '../src/ui/copy';
import { crc32 } from '../src/ui/zip';

const err = (name: string) => new DOMException(name, name);

type Opts = {
  quota?: number;
  denyAfter?: number;
  /** A browser without FileSystemFileHandle.move() (the old create-under-final-name path). */
  noMove?: boolean;
  /** Called on each slice written, with the file's current path and how many slices it has had. */
  onWrite?: (path: string, n: number) => void;
  /** Called just before a move, e.g. to have another program create the target name first. */
  beforeMove?: (from: string, to: string) => void;
};
/**
 * An in-memory folder. `quota`: total bytes the "drive" holds. `denyAfter`: files created before
 * permission is lost. Like Chromium, a writable only changes the file on close(), and move()
 * replaces a file already at the new name (which is why Save checks the name first).
 */
function memFs(opts: Opts = {}) {
  const used = { bytes: 0, created: 0, removed: [] as string[] };
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>(['']);
  const dir = (path: string): DirHandle => ({
    kind: 'directory',
    name: path.split('/').pop() || 'Pictures',
    async getDirectoryHandle(name: string, o?: { create?: boolean }) {
      const p = path ? `${path}/${name}` : name;
      if (!dirs.has(p)) {
        if (!o?.create) throw err('NotFoundError');
        dirs.add(p);
      }
      return dir(p);
    },
    async getFileHandle(name: string, o?: { create?: boolean }) {
      let p = path ? `${path}/${name}` : name;
      if (dirs.has(p)) throw err('TypeMismatchError');
      if (!files.has(p)) {
        if (!o?.create) throw err('NotFoundError');
        if (opts.denyAfter !== undefined && used.created >= opts.denyAfter) throw err('NotAllowedError');
        used.created++;
        files.set(p, new Uint8Array(0));
      }
      const h = {
        kind: 'file',
        get name() { return p.split('/').pop(); },
        async getFile() {
          if (!files.has(p)) throw err('NotFoundError');
          return new File([files.get(p)!.slice()], p.split('/').pop()!);
        },
        async createWritable() {
          const parts: Uint8Array[] = [];
          let size = 0;
          let n = 0;
          return {
            async write(d: ArrayBuffer) {
              if (opts.quota !== undefined && used.bytes + size + d.byteLength > opts.quota) throw err('QuotaExceededError');
              parts.push(new Uint8Array(d));
              size += d.byteLength;
              opts.onWrite?.(p, ++n);
            },
            async close() {
              const all = new Uint8Array(size);
              let at = 0;
              for (const x of parts) { all.set(x, at); at += x.length; }
              files.set(p, all);
              used.bytes += size;
            },
            async abort() {},
          };
        },
        async remove() { used.removed.push(p); files.delete(p); },
        ...(opts.noMove ? {} : {
          async move(newName: string) {
            const to = path ? `${path}/${newName}` : newName;
            opts.beforeMove?.(p, to);
            const data = files.get(p)!;
            files.delete(p);
            files.set(to, data); // replaces whatever was there
            p = to;
          },
        }),
      };
      return h;
    },
    async removeEntry(name: string) { const p = path ? `${path}/${name}` : name; used.removed.push(p); files.delete(p); },
    async *keys() {
      const pre = path ? `${path}/` : '';
      for (const k of [...files.keys(), ...dirs]) if (k.startsWith(pre) && k.length > pre.length && !k.slice(pre.length).includes('/')) yield k.slice(pre.length);
    },
  } as unknown as DirHandle);
  return { root: dir(''), files, used };
}

let i = 0;
const rec = (takenAt: string | undefined, path = `recup_dir.1/f${i}.jpg`): FileRecord =>
  ({ index: i++, path, size: 0, kind: 'jpeg', takenAt, group: 'keep', reason: 'photo' });
const bytesOf = (n: number, seed: number) => new Uint8Array(n).map((_, k) => (k * 7 + seed) & 0xff);
/** A file whose bytes can't be read (an unplugged card, a bad sector). */
class Unreadable extends File {
  slice(): Blob {
    return { arrayBuffer: () => Promise.reject(err('NotReadableError')) } as unknown as Blob;
  }
}

function setup(n: number, opts?: Opts) {
  const fs = memFs(opts);
  const items = Array.from({ length: n }, (_, k) => {
    const r = rec(`2024-06-28T14:32:${String(k).padStart(2, '0')}`);
    return { r, file: new File([bytesOf(1000 + k, k)], `f${k}.jpg`) };
  });
  const saved: number[] = [];
  const failed: number[] = [];
  const ev = { onSaved: (id: number) => saved.push(id), onFailed: (id: number) => failed.push(id), shouldStop: () => false };
  return { fs, items, saved, failed, ev, session: newFolderSession(fs.root) };
}

describe('saving to a folder', () => {
  it('writes new copies into Keepsake photos, byte for byte', async () => {
    const t = setup(3);
    expect(await saveToFolder(t.session, t.items, t.ev)).toBe('done');
    expect([...t.fs.files.keys()].sort()).toEqual([
      'Keepsake photos/2024/06 June/2024-06-28 14.32 (2).jpg',
      'Keepsake photos/2024/06 June/2024-06-28 14.32 (3).jpg',
      'Keepsake photos/2024/06 June/2024-06-28 14.32.jpg',
    ]);
    expect(t.fs.files.get('Keepsake photos/2024/06 June/2024-06-28 14.32 (2).jpg')).toEqual(bytesOf(1001, 1));
    expect(t.saved).toEqual(t.items.map((x) => x.r.index));
  });

  it('adds to an existing Keepsake photos folder without changing anything in it', async () => {
    const t = setup(1);
    const old = new Uint8Array([1, 2, 3]);
    t.fs.files.set('Keepsake photos/2024/06 June/2024-06-28 14.32.jpg', old);
    await t.fs.root.getDirectoryHandle('Keepsake photos', { create: true }).then((d) => d.getDirectoryHandle('2024', { create: true })).then((d) => d.getDirectoryHandle('06 June', { create: true }));
    expect(await saveToFolder(t.session, t.items, t.ev)).toBe('done');
    expect(t.fs.files.get('Keepsake photos/2024/06 June/2024-06-28 14.32.jpg')).toBe(old);
    expect(t.fs.files.has('Keepsake photos/2024/06 June/2024-06-28 14.32 (2).jpg')).toBe(true);
  });

  it('a file that can’t be read is skipped and counted, saving goes on, nothing empty is left', async () => {
    const t = setup(3);
    t.items[1].file = new Unreadable([bytesOf(10, 0)], 'bad.jpg');
    expect(await saveToFolder(t.session, t.items, t.ev)).toBe('done');
    expect(t.failed).toEqual([t.items[1].r.index]);
    expect(t.saved).toEqual([t.items[0].r.index, t.items[2].r.index]);
    expect(t.fs.files.size).toBe(2);
    for (const v of t.fs.files.values()) expect(v.length).toBeGreaterThan(0);
  });

  it('a full drive stops with "full", keeps what was saved, leaves no half-written file', async () => {
    const t = setup(4, { quota: 2500 });
    expect(await saveToFolder(t.session, t.items, t.ev)).toBe('full');
    expect(t.saved).toHaveLength(2);
    expect(t.fs.files.size).toBe(2);
    // "Save the rest" after making space carries on with new names, no overwrite.
    const rest = t.items.filter((x) => !t.saved.includes(x.r.index));
    const again = { ...t.ev, onSaved: (id: number) => t.saved.push(id) };
    t.fs.used.bytes = 0;
    expect(await saveToFolder(t.session, rest, again)).toBe('done');
    expect(t.fs.files.size).toBe(4);
  });

  it('lost permission stops with "denied"', async () => {
    const t = setup(3, { denyAfter: 1 });
    expect(await saveToFolder(t.session, t.items, t.ev)).toBe('denied');
    expect(t.saved).toHaveLength(1);
  });

  it('Stop leaves saved files in place and nothing partial', async () => {
    const t = setup(5);
    let n = 0;
    const ev = { ...t.ev, onSaved: (id: number) => { t.saved.push(id); n++; }, shouldStop: () => n >= 2 };
    expect(await saveToFolder(t.session, t.items, ev)).toBe('stopped');
    expect(t.saved).toHaveLength(2);
    expect(t.fs.files.size).toBe(2);
  });
});

const MB = 1024 * 1024;
const FINAL = 'Keepsake photos/2024/06 June/2024-06-28 14.32.jpg';
const isTemp = (p: string) => p.split('/').pop()!.startsWith(TEMP_PREFIX);
/** A file whose first `okBytes` read fine and the rest can't be read (a card pulled out mid-copy). */
class FailsPartway extends File {
  constructor(parts: BlobPart[], name: string, private okBytes: number) { super(parts, name); }
  slice(start?: number, end?: number): Blob {
    if ((end ?? this.size) > this.okBytes) return { arrayBuffer: () => Promise.reject(err('NotReadableError')) } as unknown as Blob;
    return super.slice(start, end);
  }
}

/** The one removal is the stopped/failed copy's own temporary file. */
function expectOnlyOwnRemoved(removed: string[]) {
  expect(removed).toHaveLength(1);
  expect(removed.filter((p) => !isTemp(p))).toEqual([]);
}

describe('saving to a folder: only ever removing the empty file this save made (T56)', () => {
  {
    const how = 'temporary name, then move';
    it(`${how}: Stop partway through a big file leaves nothing of it, and removes only its own file`, async () => {
      let stop = false;
      // The first two save normally (one slice each); the third is 2½ slices and is stopped after its first.
      const t = setup(3, { onWrite: () => { if (t.saved.length === 2) stop = true; } });
      t.items[2].file = new File([new Uint8Array(2 * 8 * MB + MB / 2)], 'big.mov');
      const ev = { ...t.ev, shouldStop: () => stop };
      expect(await saveToFolder(t.session, t.items, ev)).toBe('stopped');
      expect(t.saved).toEqual([t.items[0].r.index, t.items[1].r.index]);
      expect([...t.fs.files.keys()].sort()).toEqual([
        'Keepsake photos/2024/06 June/2024-06-28 14.32 (2).jpg',
        FINAL,
      ]);
      expectOnlyOwnRemoved(t.fs.used.removed);
    });

    it(`${how}: a read error partway through a file skips it, removes only its own file, saving goes on`, async () => {
      const t = setup(3);
      t.items[1].file = new FailsPartway([new Uint8Array(2 * 8 * MB)], 'bad.jpg', 8 * MB);
      expect(await saveToFolder(t.session, t.items, t.ev)).toBe('done');
      expect(t.failed).toEqual([t.items[1].r.index]);
      expect(t.saved).toEqual([t.items[0].r.index, t.items[2].r.index]);
      expect(t.fs.files.size).toBe(2);
      for (const [k, v] of t.fs.files) { expect(isTemp(k)).toBe(false); expect(v.length).toBeGreaterThan(0); }
      expectOnlyOwnRemoved(t.fs.used.removed);
    });
  }

  it('a file that appears under the planned name while copying is left alone; the copy takes the next name', async () => {
    const theirs = new Uint8Array([9, 9, 9]);
    const t = setup(1, { onWrite: (p, n) => { if (n === 1 && isTemp(p)) t.fs.files.set(FINAL, theirs); } });
    expect(await saveToFolder(t.session, t.items, t.ev)).toBe('done');
    expect(t.fs.files.get(FINAL)).toBe(theirs);
    expect(t.fs.files.get('Keepsake photos/2024/06 June/2024-06-28 14.32 (2).jpg')).toEqual(bytesOf(1000, 0));
    expect([...t.fs.files.keys()].some(isTemp)).toBe(false);
  });

  {
    it('a name that appears after the folder was listed is never written to', async () => {
      const t = setup(2);
      const second = 'Keepsake photos/2024/06 June/2024-06-28 14.32 (2).jpg';
      let calls = 0;
      // Between the first and second copy (after the listing), another program makes the next planned name.
      const ev = { ...t.ev, shouldStop: () => { if (++calls === 2) t.fs.files.set(second, new Uint8Array(0)); return false; } };
      expect(await saveToFolder(t.session, t.items, ev)).toBe('done');
      expect(t.fs.files.get(second)).toEqual(new Uint8Array(0)); // theirs: still there, still empty
      expect(t.fs.files.get('Keepsake photos/2024/06 June/2024-06-28 14.32 (3).jpg')).toEqual(bytesOf(1001, 1));
      expect(t.fs.used.removed.filter((p) => !isTemp(p))).toEqual([]);
    });
  }

  it('Stop never removes another program’s empty file that took the planned name', async () => {
    let stop = false;
    const t = setup(1, { onWrite: (p, n) => { if (n === 1) { t.fs.files.set(FINAL, new Uint8Array(0)); stop = true; } } });
    t.items[0].file = new File([new Uint8Array(8 * MB + 1)], 'big.jpg');
    expect(await saveToFolder(t.session, t.items, { ...t.ev, shouldStop: () => stop })).toBe('stopped');
    expect(t.fs.files.get(FINAL)).toEqual(new Uint8Array(0));
    expect(t.fs.used.removed.every(isTemp)).toBe(true);
    expect([...t.fs.files.keys()]).toEqual([FINAL]);
  });

  it('a normal save leaves no temporary files', async () => {
    const t = setup(4);
    expect(await saveToFolder(t.session, t.items, t.ev)).toBe('done');
    expect(t.fs.files.size).toBe(4);
    expect([...t.fs.files.keys()].some(isTemp)).toBe(false);
    expect(t.fs.used.removed).toEqual([]);
    expect(t.session.canMove).toBe(true);
  });

  it('move() that isn’t supported here: nothing is saved, the save ends "unsupported" (zip downloads instead), no temporary file left', async () => {
    const t = setup(2);
    // Wrap every file handle so move() throws NotSupportedError, as a browser without it for this folder would.
    const wrap = (d: DirHandle): DirHandle => new Proxy(d, {
      get(target, k) {
        if (k === 'getDirectoryHandle') return async (n: string, o?: object) => wrap(await target.getDirectoryHandle(n, o) as DirHandle);
        if (k === 'getFileHandle') {
          return async (n: string, o?: object) => {
            const h = await target.getFileHandle(n, o);
            return new Proxy(h, { get: (fh, kk) => (kk === 'move' ? async () => { throw err('NotSupportedError'); } : Reflect.get(fh, kk)) });
          };
        }
        const v = Reflect.get(target, k);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    const session = newFolderSession(wrap(t.fs.root));
    expect(await saveToFolder(session, t.items, t.ev)).toBe('unsupported');
    expect(session.canMove).toBe(false);
    expect(t.saved).toEqual([]);
    expect([...t.fs.files.keys()]).toEqual([]);
    expect(t.fs.used.removed).toHaveLength(1); // only the empty probe file
    expect(t.fs.used.removed.every(isTemp)).toBe(true);
  });
});

describe('saving as zip files', () => {
  it('builds valid zips part by part, skipping unreadable files', async () => {
    const recs = [rec('2024-06-28T14:32:00'), rec('2024-06-28T14:32:30'), rec(undefined, 'recup_dir.2/f9.jpg')];
    const files: File[] = [];
    recs.forEach((r, k) => { files[r.index] = new File([bytesOf(3000 + k, k)], `f${k}.jpg`); });
    const plan = planNames(recs, (r) => files[r.index].size);
    const crc = async (f: File) => {
      if (f === files[recs[1].index]) throw err('NotReadableError');
      const b = new Uint8Array(await f.arrayBuffer());
      return { crc: crc32(b), size: b.length };
    };
    const blobs: Blob[] = [];
    const saved: number[] = [];
    const failed: number[] = [];
    const end = await saveAsZip([plan.slice(0, 2), plan.slice(2)], [1, 2], files, crc, {
      onSaved: (id) => saved.push(id), onFailed: (id) => failed.push(id), shouldStop: () => false,
      onPart: () => {}, onWorked: () => {}, onZip: (b) => blobs.push(b),
    });
    expect(end).toBe('done');
    expect(failed).toEqual([recs[1].index]);
    expect(saved.sort()).toEqual([recs[0].index, recs[2].index].sort());
    expect(blobs).toHaveLength(2);
    const dir = mkdtempSync(join(tmpdir(), 'keepsake-zip-run-'));
    try {
      const names: string[] = [];
      for (const [k, b] of blobs.entries()) {
        const p = join(dir, `${k}.zip`);
        writeFileSync(p, new Uint8Array(await b.arrayBuffer()));
        expect(execFileSync('unzip', ['-t', p]).toString()).toMatch(/No errors detected/);
        names.push(...execFileSync('unzip', ['-Z1', p]).toString().trim().split('\n'));
      }
      expect(names).toEqual(['Keepsake photos/2024/06 June/2024-06-28 14.32.jpg', 'Keepsake photos/No date/f9.jpg']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// T89: what Save.tsx does. Each visit is one mount of <Save> (its own `saved` set, as "Back to review"
// then Save again starts over); the ZipLog is shared by the whole page. In a visit, run 1 stops after
// `stopAfter` files and "Save the rest" (run 2) saves only what's left.
function zipPage(count: number, perPart: number, log = new ZipLog(), scan = 1) {
  // Indices 0 … count-1, as in a real scan (each scan starts again at 0).
  const recs = Array.from({ length: count }, (_, k) => ({ ...rec(`2024-06-${String(1 + (k % 28)).padStart(2, '0')}T10:${String(k % 60).padStart(2, '0')}:00`), index: k }));
  const files: File[] = [];
  recs.forEach((r, k) => { files[r.index] = new File([bytesOf(100, k)], `f${k}.jpg`); });
  const plan = planNames(recs, (r) => files[r.index].size);
  const split = (ps: readonly Planned[]) => splitParts(ps, () => 1, 0, { maxBytes: perPart, maxEntries: 1e9 });
  const crc = async (f: File) => { const b = new Uint8Array(await f.arrayBuffer()); return { crc: crc32(b), size: b.length }; };
  const all: string[] = [];
  /** One visit: runs until done (Save the rest after a Stop) unless `thenBack`. */
  async function visit(stopAfter: number, thenBack = false) {
    const v = log.newVisit(scan);
    const zips: string[] = [];
    const saved = new Set<number>();
    let worked = 0;
    for (let run = 0; ; run++) {
      const parts = split(plan.filter((p) => !saved.has(p.id)));
      const end = await saveAsZip(parts, parts.map((_, k) => k + 1), files, crc, {
        onSaved: (id) => saved.add(id), onFailed: () => {}, onPart: () => {}, onWorked: () => { worked++; },
        shouldStop: () => run === 0 && worked >= stopAfter,
        onZip: (_b, _i, ids) => { const name = log.add(v, parts.length, ids); zips.push(name); all.push(name); },
      });
      if (end === 'done') { log.finish(v); break; }
      if (thenBack) break;
    }
    return { zips, saved: saved.size, find: copy.save.findZip(zips), earlier: log.leftovers(v, saved) };
  }
  return { visit, all, count };
}

describe('zip names across Stop, "Save the rest" and "Back to review" (T89)', () => {
  it('an uninterrupted save: "Keepsake photos.zip", or parts 1 to N', async () => {
    expect((await zipPage(5, 10).visit(Infinity)).zips).toEqual(['Keepsake photos.zip']);
    const v = await zipPage(5, 2).visit(Infinity);
    expect(v.zips).toEqual(['Keepsake photos part 1.zip', 'Keepsake photos part 2.zip', 'Keepsake photos part 3.zip']);
    expect(v.find.text).toBe('In your Downloads folder, look for these 3 zip files: Keepsake photos part 1.zip to Keepsake photos part 3.zip.');
  });

  it('one part, Stop then Save the rest: two names, and the Done text names both (both are needed)', async () => {
    const v = await zipPage(6, 10).visit(2);
    expect(v.saved).toBe(6);
    expect(v.zips).toEqual(['Keepsake photos.zip', 'Keepsake photos part 2.zip']);
    expect(v.find.text).toBe('In your Downloads folder, look for these 2 zip files: Keepsake photos.zip and Keepsake photos part 2.zip.');
    expect(v.earlier.names).toEqual([]);
  });

  it('several parts, Stop then Save the rest: numbering goes on, with no gap and no "of N"', async () => {
    const v = await zipPage(7, 2).visit(3); // parts of 2: stopped after 1 file of part 2
    expect(v.saved).toBe(7);
    expect(v.zips).toEqual(['Keepsake photos part 1.zip', 'Keepsake photos part 2.zip', 'Keepsake photos part 3.zip', 'Keepsake photos part 4.zip']);
    expect(v.find.text).toBe('In your Downloads folder, look for these 4 zip files: Keepsake photos part 1.zip to Keepsake photos part 4.zip.');
  });

  it('Stop, Back to review, Save again (one part): no name reused; Done names only this save and explains the old zip', async () => {
    const page = zipPage(6, 10);
    const first = await page.visit(2, true);
    expect(first.zips).toEqual(['Keepsake photos.zip']);
    const again = await page.visit(Infinity);
    expect(again.saved).toBe(6); // everything again, not just the rest
    expect(again.zips).toEqual(['Keepsake photos part 2.zip']);
    expect(new Set(page.all).size).toBe(page.all.length);
    expect(again.find.text).toBe('In your Downloads folder, look for Keepsake photos part 2.zip.');
    expect(again.earlier).toEqual({ names: ['Keepsake photos.zip'], covered: true });
  });

  it('Stop, Back to review, Save again (several parts): every name new; the Done text is this save only', async () => {
    const page = zipPage(7, 2);
    const first = await page.visit(3, true);
    expect(first.zips).toEqual(['Keepsake photos part 1.zip', 'Keepsake photos part 2.zip']);
    const again = await page.visit(Infinity);
    expect(again.zips).toEqual(['Keepsake photos part 3.zip', 'Keepsake photos part 4.zip', 'Keepsake photos part 5.zip', 'Keepsake photos part 6.zip']);
    expect(new Set(page.all.map((n) => n.toLowerCase())).size).toBe(page.all.length);
    expect(again.find.text).toBe('In your Downloads folder, look for these 4 zip files: Keepsake photos part 3.zip to Keepsake photos part 6.zip.');
    expect(again.earlier).toEqual({ names: ['Keepsake photos part 1.zip', 'Keepsake photos part 2.zip'], covered: true });
    // And after that save finished, a later one doesn't mention any of them.
    expect((await page.visit(Infinity)).earlier.names).toEqual([]);
  });

  it('Stop on folder A, Start over, scan folder B, save: the Done screen for B never mentions the zip from A (indices restart per scan)', async () => {
    const log = new ZipLog();
    const a = zipPage(6, 10, log, 1);
    expect((await a.visit(2, true)).zips).toEqual(['Keepsake photos.zip']);
    const b = zipPage(8, 10, log, 2); // indices 0-7: they include all of A's 0-5
    const v = await b.visit(Infinity);
    expect(v.zips).toEqual(['Keepsake photos part 2.zip']);
    expect(v.earlier).toEqual({ names: [], covered: true });
    expect(v.find.text).toBe('In your Downloads folder, look for Keepsake photos part 2.zip.');
  });
});
