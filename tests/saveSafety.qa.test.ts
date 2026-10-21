// QA re-check of Save (T25) after T55/T56. Probes for: refusing a save folder that is (or is in)
// the recovery folder, with and without the recovery folder's handle; and what a save can leave
// behind or touch when the folder changes under it. The fake folder copies what Chromium was seen
// to do in OPFS (scratchpad probe, Chromium 1194): getFileHandle({create}) on an existing name
// hands back that file; move() onto an existing file replaces it, onto a folder throws
// InvalidModificationError; a writable changes nothing until close(); handles are by path.
//
// `it.fails` marks a known gap: the test states the rule, and fails today. When a gap is closed,
// vitest reports it and the `.fails` comes off.
import { describe, expect, it } from 'vitest';
import type { FileRecord } from '../src/engine/types';
import { inRecoveryFolder, insideRecovery, scanFolders } from '../src/ui/savePlan';
import type { RecoveryRootDir } from '../src/ui/savePlan';
import { TEMP_PREFIX, newFolderSession, saveToFolder } from '../src/ui/saveRun';
import type { DirHandle } from '../src/ui/saveRun';

// ---------- refusing the recovery folder ----------
type Fake = RecoveryRootDir & { path: string };
const dir = (path: string): Fake => ({
  path,
  async isSameEntry(d) { return (d as Fake).path === path; },
  async resolve(d) {
    const p = (d as Fake).path;
    if (p === path) return [];
    return p.startsWith(`${path}/`) ? p.slice(path.length + 1).split('/') : null;
  },
});
const REC = '/home/me/rec';
function recovery(n: number) {
  const dirs = Array.from({ length: n }, (_, k) => dir(`${REC}/recup_dir.${k + 1}`));
  return { root: dir(REC), files: dirs.map((d, k) => ({ directoryHandle: d, webkitRelativePath: `rec/recup_dir.${k + 1}/f${k}.jpg` })) };
}
const throwing = (path: string, what: 'isSameEntry' | 'resolve', e: unknown = new DOMException('gone', 'NotFoundError')): Fake =>
  ({ ...dir(path), [what]: async () => { throw e; } });

describe('QA T55: with the recovery folder’s handle', () => {
  const { root } = recovery(305);
  const inside: [string, string][] = [
    ['the recovery folder itself', REC],
    ['depth 1', `${REC}/recup_dir.1`],
    ['depth 1, the 305th of 305 folders', `${REC}/recup_dir.305`],
    ['depth 5', `${REC}/recup_dir.7/a/b/c/d`],
    ['an empty subfolder no file is in', `${REC}/empty`],
    ['5 deep in an empty subfolder', `${REC}/empty/a/b/c/d`],
    ['a folder named like Keepsake photos inside it', `${REC}/Keepsake photos`],
  ];
  for (const [what, p] of inside) it(`refuses ${what}`, async () => expect(await inRecoveryFolder(root, dir(p))).toBe(true));

  it('allows a folder that contains the recovery folder (copies go to <chosen>/Keepsake photos, beside it)', async () => {
    expect(await inRecoveryFolder(root, dir('/home/me'))).toBe(false);
    expect(await inRecoveryFolder(root, dir('/'))).toBe(false);
  });
  it('refuses a folder whose "Keepsake photos" holds the recovery folder, at any depth or case', async () => {
    expect(await inRecoveryFolder(dir('/p/Keepsake photos'), dir('/p'))).toBe(true);
    expect(await inRecoveryFolder(dir('/p/KEEPSAKE PHOTOS/2019/x'), dir('/p'))).toBe(true);
    expect(await inRecoveryFolder(dir('/p/Keepsake photos2/x'), dir('/p'))).toBe(false);
  });
  it('allows look-alike neighbours (rec2, rec-old)', async () => {
    expect(await inRecoveryFolder(root, dir(`${REC}2`))).toBe(false);
    expect(await inRecoveryFolder(root, dir(`${REC}-old/x`))).toBe(false);
  });
  it('any error, including a non-Error rejection, counts as inside', async () => {
    expect(await inRecoveryFolder(throwing(REC, 'isSameEntry'), dir('/usb'))).toBe(true);
    expect(await inRecoveryFolder(throwing(REC, 'resolve'), dir('/usb'))).toBe(true);
    expect(await inRecoveryFolder(dir(REC), throwing('/usb', 'resolve'))).toBe(true);
    expect(await inRecoveryFolder(throwing(REC, 'resolve', undefined), dir('/usb'))).toBe(true);
  });
});

describe('QA T55: fallback without the handle (scanned files’ folders only)', () => {
  const r = recovery(305);
  const found = scanFolders(r.files);
  it('finds same, depth 1 in any of 305 folders, and below a scanned folder at depth 5', async () => {
    expect(found).toHaveLength(305);
    expect(await insideRecovery(dir(REC), found)).toBe(true);
    expect(await insideRecovery(dir(`${REC}/recup_dir.305`), found)).toBe(true);
    expect(await insideRecovery(dir(`${REC}/recup_dir.3/a/b/c/d`), found)).toBe(true);
  });
  it('a resolve() error rejects (Save.tsx turns that into "inside")', async () => {
    await expect(insideRecovery(dir('/usb'), [{ dir: throwing(`${REC}/recup_dir.1`, 'resolve'), depth: 1 }])).rejects.toBeTruthy();
  });
  // Known gaps of the fallback (documented in savePlan.ts). In the app the fallback only runs
  // with no handle, i.e. the sample files (not on disk) or a browser with no folder picker
  // (zip downloads, nothing written to a folder), so these can't reach a disk today.
  it.fails('gap: an empty subfolder of the recovery folder', async () => {
    expect(await insideRecovery(dir(`${REC}/empty`), found)).toBe(true);
  });
  it.fails('gap: the recovery folder inside "<chosen>/Keepsake photos"', async () => {
    const files = [{ directoryHandle: dir('/p/Keepsake photos/rec/recup_dir.1'), webkitRelativePath: 'rec/recup_dir.1/f.jpg' }];
    expect(await insideRecovery(dir('/p'), scanFolders(files))).toBe(true);
  });
  it.fails('gap: files without directoryHandle leave nothing to check, and the answer is "not inside"', async () => {
    expect(await insideRecovery(dir(REC), scanFolders([{ webkitRelativePath: 'rec/recup_dir.1/f.jpg' }]))).toBe(true);
  });
});

// ---------- what a save touches ----------
const err = (name: string) => new DOMException(name, name);
type Hooks = {
  noMove?: boolean;
  /** Another program, just before move(from → to). */
  beforeMove?: (to: string) => void;
  /** move() to a final (non-temporary) name throws this. */
  finalMoveThrows?: string;
  /** Another program, just before getFileHandle(name, {create}). */
  beforeCreate?: (path: string) => void;
  onWrite?: (path: string, n: number) => void;
};
const isTemp = (p: string) => p.split('/').pop()!.startsWith(TEMP_PREFIX);

function chromiumLikeFs(h: Hooks = {}) {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>(['']);
  const removed: string[] = [];
  const at = (path: string, name: string) => (path ? `${path}/${name}` : name);
  const mkdir = (path: string): DirHandle => ({
    kind: 'directory',
    name: path.split('/').pop() || 'Pictures',
    async getDirectoryHandle(name: string, o?: { create?: boolean }) {
      const p = at(path, name);
      if (files.has(p)) throw err('TypeMismatchError');
      if (!dirs.has(p)) { if (!o?.create) throw err('NotFoundError'); dirs.add(p); }
      return mkdir(p);
    },
    async getFileHandle(name: string, o?: { create?: boolean }) {
      let p = at(path, name);
      if (o?.create) h.beforeCreate?.(p);
      if (dirs.has(p)) throw err('TypeMismatchError');
      if (!files.has(p)) { if (!o?.create) throw err('NotFoundError'); files.set(p, new Uint8Array(0)); }
      return {
        kind: 'file',
        get name() { return p.split('/').pop(); },
        async getFile() { if (!files.has(p)) throw err('NotFoundError'); return new File([files.get(p)!.slice()], 'x'); },
        async createWritable() {
          const parts: Uint8Array[] = [];
          let n = 0;
          return {
            async write(d: ArrayBuffer) { parts.push(new Uint8Array(d)); h.onWrite?.(p, ++n); },
            async close() { files.set(p, new Uint8Array(await new Blob(parts as BlobPart[]).arrayBuffer())); },
            async abort() {},
          };
        },
        async remove() { removed.push(p); files.delete(p); },
        ...(h.noMove ? {} : {
          async move(newName: string) {
            const to = at(path, newName);
            if (!isTemp(to) && h.finalMoveThrows) throw err(h.finalMoveThrows);
            h.beforeMove?.(to);
            if (dirs.has(to)) throw err('InvalidModificationError');
            const data = files.get(p)!;
            files.delete(p);
            files.set(to, data); // Chromium: replaces a file already there
            p = to;
          },
        }),
      };
    },
    async removeEntry(name: string) { const p = at(path, name); removed.push(p); files.delete(p); },
    async *keys() {
      const pre = path ? `${path}/` : '';
      for (const k of [...files.keys(), ...dirs]) if (k.startsWith(pre) && k.length > pre.length && !k.slice(pre.length).includes('/')) yield k.slice(pre.length);
    },
  } as unknown as DirHandle);
  return { root: mkdir(''), files, dirs, removed };
}

const DAY = 'Keepsake photos/2024/06 June';
const FINAL = `${DAY}/2024-06-28 14.32.jpg`;
const N2 = `${DAY}/2024-06-28 14.32 (2).jpg`;
const MB = 1024 * 1024;
let idx = 0;
const rec = (): FileRecord => ({ index: idx++, path: 'recup_dir.1/f.jpg', size: 0, kind: 'jpeg', takenAt: '2024-06-28T14:32:00', group: 'keep', reason: 'photo' } as FileRecord);
const bytes = (n: number, seed: number) => new Uint8Array(n).map((_, k) => (k * 7 + seed) & 0xff);

/** A folder that already has a "Keepsake photos" with the first planned name and an empty file of someone else's in it. */
function setup(n: number, h?: Hooks) {
  const fs = chromiumLikeFs(h);
  for (const p of ['Keepsake photos', 'Keepsake photos/2024', DAY]) fs.dirs.add(p);
  fs.files.set(FINAL, new Uint8Array([1, 1, 1]));
  fs.files.set(`${DAY}/their-empty.jpg`, new Uint8Array(0));
  const before = new Map(fs.files);
  const items = Array.from({ length: n }, (_, k) => ({ r: rec(), file: new File([bytes(1000 + k, k)], `f${k}.jpg`) }));
  const saved: number[] = [];
  const failed: number[] = [];
  const ev = { onSaved: (id: number) => saved.push(id), onFailed: (id: number) => failed.push(id), shouldStop: () => false };
  /** Everything that was there before is still there, byte for byte, and was never removed. */
  const untouched = () => {
    for (const [p, v] of before) expect(fs.files.get(p), p).toBe(v);
    expect(fs.removed.filter((p) => before.has(p))).toEqual([]);
  };
  return { fs, items, saved, failed, ev, session: newFolderSession(fs.root), untouched };
}

describe('QA T56: nothing that was there before is changed or removed', () => {
  for (const noMove of [false, true]) {
    const how = noMove ? ' (no move())' : '';
    it(`normal save${how}`, async () => {
      const t = setup(3, { noMove });
      expect(await saveToFolder(t.session, t.items, t.ev)).toBe('done');
      t.untouched();
      expect([...t.fs.files.keys()].some(isTemp)).toBe(false);
    });
    it(`Stop mid-file${how}: only this save’s own empty file is removed`, async () => {
      let stop = false;
      const t = setup(2, { noMove, onWrite: () => { if (t.saved.length === 1) stop = true; } });
      t.items[1].file = new File([new Uint8Array(2 * 8 * MB + 1)], 'big.mov');
      expect(await saveToFolder(t.session, t.items, { ...t.ev, shouldStop: () => stop })).toBe('stopped');
      t.untouched();
      expect(t.saved).toEqual([t.items[0].r.index]);
      expect([...t.fs.files.keys()].some(isTemp)).toBe(false);
      for (const p of t.fs.removed) expect(t.fs.files.has(p)).toBe(false);
    });
    it(`read error mid-file${how}: skipped, counted, only its own file removed`, async () => {
      const t = setup(3, { noMove });
      class FailsPartway extends File {
        slice(s?: number, e?: number): Blob {
          if ((e ?? this.size) > 8 * MB) return { arrayBuffer: () => Promise.reject(err('NotReadableError')) } as unknown as Blob;
          return super.slice(s, e);
        }
      }
      t.items[1].file = new FailsPartway([new Uint8Array(2 * 8 * MB)], 'bad.jpg');
      expect(await saveToFolder(t.session, t.items, t.ev)).toBe('done');
      t.untouched();
      expect(t.failed).toEqual([t.items[1].r.index]);
      expect([...t.fs.files.values()].filter((v) => v.length === 0)).toHaveLength(1); // theirs only
    });
  }

  it('a name that appears while the copy is written is left alone; the copy takes the next name', async () => {
    const theirs = new Uint8Array([9]);
    const t = setup(1, { onWrite: (p, n) => { if (n === 1 && isTemp(p)) t.fs.files.set(N2, theirs); } });
    expect(await saveToFolder(t.session, t.items, t.ev)).toBe('done');
    t.untouched();
    expect(t.fs.files.get(N2)).toBe(theirs);
    expect(t.fs.files.get(`${DAY}/2024-06-28 14.32 (3).jpg`)).toEqual(bytes(1000, 0));
  });

  it('a folder that appears under the planned name: move() refuses, the save ends "broken", the folder is kept', async () => {
    const t = setup(1, { beforeMove: (to) => { if (to === N2) t.fs.dirs.add(N2); } });
    expect(await saveToFolder(t.session, t.items, t.ev)).toBe('broken');
    t.untouched();
    expect(t.fs.dirs.has(N2)).toBe(true);
  });

  // Residual race: Chromium's move() replaces a file already at the new name, and there is no
  // "only if free" option, so a file made in the instant between the last check and move() is lost.
  it.fails('a file that appears between the last name check and move() is never replaced', async () => {
    const theirs = new Uint8Array([9, 9]);
    const t = setup(1, { beforeMove: (to) => { if (to === N2) t.fs.files.set(N2, theirs); } });
    await saveToFolder(t.session, t.items, t.ev);
    expect(t.fs.files.get(N2)).toBe(theirs);
  });

  // Without move(): getFileHandle({create:true}) on a name another program just made opens THEIR file.
  it.fails('no move(): a file made between the check and the create is never written over', async () => {
    const theirs = new Uint8Array([4, 4, 4, 4]);
    const t = setup(1, { noMove: true, beforeCreate: (p) => { if (p === N2) t.fs.files.set(N2, theirs); } });
    await saveToFolder(t.session, t.items, t.ev);
    expect(t.fs.files.get(N2)).toBe(theirs);
  });
  it.fails('no move(): Stop never removes an empty file another program made under the planned name', async () => {
    let stop = false;
    const t = setup(1, { noMove: true, beforeCreate: (p) => { if (p === N2) t.fs.files.set(N2, new Uint8Array(0)); }, onWrite: () => { stop = true; } });
    t.items[0].file = new File([new Uint8Array(8 * MB + 1)], 'big.jpg');
    expect(await saveToFolder(t.session, t.items, { ...t.ev, shouldStop: () => stop })).toBe('stopped');
    expect(t.fs.files.has(N2)).toBe(true);
  });
});

describe('QA T56: move() failing after the copy is fully written', () => {
  for (const [errName, end] of [['InvalidStateError', 'broken'], ['QuotaExceededError', 'full'], ['NotAllowedError', 'denied']] as const) {
    it(`${errName}: ends "${end}", the file isn't counted as saved, nothing of theirs is touched`, async () => {
      const t = setup(2, { finalMoveThrows: errName });
      expect(await saveToFolder(t.session, t.items, t.ev)).toBe(end);
      t.untouched();
      expect(t.saved).toEqual([]);
      expect(t.failed).toEqual([]);
    });
  }
  it.fails('leaves no full temporary copy behind (today: a hidden .keepsake-partial-*.tmp with the whole file)', async () => {
    const t = setup(1, { finalMoveThrows: 'InvalidStateError' });
    await saveToFolder(t.session, t.items, t.ev);
    expect([...t.fs.files.keys()].filter(isTemp)).toEqual([]);
  });
  it('"Save the rest" afterwards saves the file under the next free name (the earlier temporary copy stays)', async () => {
    const hooks: Hooks = { finalMoveThrows: 'InvalidStateError' };
    const t = setup(1, hooks);
    expect(await saveToFolder(t.session, t.items, t.ev)).toBe('broken');
    hooks.finalMoveThrows = undefined;
    expect(await saveToFolder(t.session, t.items, t.ev)).toBe('done');
    t.untouched();
    // (2) was claimed by the failed attempt, so the retry gets (3); (2) stays free.
    expect(t.fs.files.has(N2)).toBe(false);
    expect(t.fs.files.get(`${DAY}/2024-06-28 14.32 (3).jpg`)).toEqual(bytes(1000, 0));
    const temps = [...t.fs.files].filter(([k]) => isTemp(k));
    expect(temps).toHaveLength(1);
    expect(temps[0][1]).toEqual(bytes(1000, 0));
  });
});
