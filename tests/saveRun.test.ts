// The save runner against an in-memory folder that behaves like the File System Access API:
// unreadable files, a full drive, lost permission and Stop.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FileRecord } from '../src/engine/types';
import { newFolderSession, saveAsZip, saveToFolder } from '../src/ui/saveRun';
import type { DirHandle } from '../src/ui/saveRun';
import { planNames } from '../src/ui/savePlan';
import { crc32 } from '../src/ui/zip';

const err = (name: string) => new DOMException(name, name);

type Opts = { quota?: number; denyAfter?: number };
/** An in-memory folder. `quota`: total bytes the "drive" holds. `denyAfter`: files created before permission is lost. */
function memFs(opts: Opts = {}) {
  const used = { bytes: 0, created: 0 };
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
      const p = path ? `${path}/${name}` : name;
      if (dirs.has(p)) throw err('TypeMismatchError');
      if (!files.has(p)) {
        if (!o?.create) throw err('NotFoundError');
        if (opts.denyAfter !== undefined && used.created >= opts.denyAfter) throw err('NotAllowedError');
        used.created++;
        files.set(p, new Uint8Array(0));
      }
      return {
        kind: 'file', name,
        async getFile() { return new File([files.get(p)!.slice()], name); },
        async createWritable() {
          const parts: Uint8Array[] = [];
          let size = 0;
          return {
            async write(d: ArrayBuffer) {
              if (opts.quota !== undefined && used.bytes + size + d.byteLength > opts.quota) throw err('QuotaExceededError');
              parts.push(new Uint8Array(d));
              size += d.byteLength;
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
      };
    },
    async removeEntry(name: string) { files.delete(path ? `${path}/${name}` : name); },
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
