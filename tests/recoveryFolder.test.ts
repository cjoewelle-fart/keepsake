// T55: a save folder inside the recovery folder is always refused. QA's probes on T25 found the
// old check (from the scanned files' folders, at most 200 of them) missed a save folder in a very
// big recovery and in a subfolder with no files in it. These are those probes, plus the rest of
// the rule: same folder, any depth, errors count as "inside", folders beside or above are fine.
import { describe, expect, it } from 'vitest';
import { inRecoveryFolder, insideRecovery, scanFolders } from '../src/ui/savePlan';
import type { RecoveryRootDir } from '../src/ui/savePlan';
import { withPickedFolder } from '../src/ui/recoveryFolder';

/** A folder handle that knows its path and answers isSameEntry/resolve like the real API. */
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
const broken = (what: 'isSameEntry' | 'resolve'): Fake => ({
  ...dir('/home/me/rec'),
  [what]: async () => { throw new DOMException('gone', 'NotFoundError'); },
});

const REC = '/home/me/rec';
/** A PhotoRec output folder with `n` recup_dir.N subfolders, one file each, as the scan sees them. */
function recovery(n: number) {
  const dirs = Array.from({ length: n }, (_, k) => dir(`${REC}/recup_dir.${k + 1}`));
  const files = dirs.map((d, k) => ({ directoryHandle: d, webkitRelativePath: `rec/recup_dir.${k + 1}/f${k}.jpg` }));
  return { root: dir(REC), dirs, files };
}

describe('save folder inside the recovery folder (with the recovery folder’s handle)', () => {
  it('probe: a very big recovery (300 folders), save folder in the 250th', async () => {
    const r = recovery(300);
    expect(await inRecoveryFolder(r.root, dir(`${REC}/recup_dir.250`))).toBe(true);
    expect(await inRecoveryFolder(r.root, dir(`${REC}/recup_dir.300/new folder`))).toBe(true);
  });

  it('probe: an empty subfolder no scanned file is in', async () => {
    const r = recovery(3);
    const empty = dir(`${REC}/empty`);
    // The old check can't see it: no scanned file lives there.
    expect(await insideRecovery(empty, scanFolders(r.files))).toBe(false);
    expect(await inRecoveryFolder(r.root, empty)).toBe(true);
    expect(await inRecoveryFolder(r.root, dir(`${REC}/empty/deeper/still`))).toBe(true);
  });

  it('refuses the recovery folder itself and anything at any depth inside it', async () => {
    const { root } = recovery(2);
    expect(await inRecoveryFolder(root, dir(REC))).toBe(true);
    expect(await inRecoveryFolder(root, dir(`${REC}/recup_dir.1`))).toBe(true);
    expect(await inRecoveryFolder(root, dir(`${REC}/a/b/c/d/e/f/g`))).toBe(true);
  });

  it('refuses when the recovery folder is inside "<chosen>/Upsort photos", where copies go', async () => {
    const root = dir('/home/me/Pictures/Upsort photos/2019');
    expect(await inRecoveryFolder(root, dir('/home/me/Pictures'))).toBe(true);
    const odd = dir('/home/me/Pictures/upsort PHOTOS');
    expect(await inRecoveryFolder(odd, dir('/home/me/Pictures'))).toBe(true);
  });

  it('allows folders beside it, above it, or elsewhere', async () => {
    const { root } = recovery(2);
    expect(await inRecoveryFolder(root, dir('/home/me'))).toBe(false);
    expect(await inRecoveryFolder(root, dir('/home/me/Pictures'))).toBe(false);
    expect(await inRecoveryFolder(root, dir('/home/me/rec2'))).toBe(false);
    expect(await inRecoveryFolder(root, dir('/media/usb'))).toBe(false);
  });

  it('treats any error in the check as "inside"', async () => {
    expect(await inRecoveryFolder(broken('isSameEntry'), dir('/media/usb'))).toBe(true);
    expect(await inRecoveryFolder(broken('resolve'), dir('/media/usb'))).toBe(true);
    const badChosen = { ...dir('/media/usb'), resolve: async () => { throw new Error('x'); } };
    expect(await inRecoveryFolder(dir(REC), badChosen)).toBe(true);
  });
});

describe('fallback without the recovery folder’s handle', () => {
  it('uses every scanned folder (no 200-folder limit)', async () => {
    const r = recovery(300);
    const found = scanFolders(r.files);
    expect(found).toHaveLength(300);
    expect(found.every((f) => f.depth === 1)).toBe(true);
    expect(await insideRecovery(dir(`${REC}/recup_dir.250`), found)).toBe(true);
    expect(await insideRecovery(dir(REC), found)).toBe(true);
    expect(await insideRecovery(dir('/home/me/Pictures'), found)).toBe(false);
  });

  it('files from the file-input fallback carry no folders: nothing to check against', () => {
    expect(scanFolders([{ webkitRelativePath: 'rec/recup_dir.1/f1.jpg' }])).toEqual([]);
  });
});

describe('keeping the recovery folder’s handle when it’s picked', () => {
  it('returns the handle the picker gave, and puts the picker back', async () => {
    const root = dir(REC);
    const real = async () => root;
    const win: { showDirectoryPicker?: (...a: unknown[]) => Promise<unknown> } = { showDirectoryPicker: real };
    const got = await withPickedFolder(async () => { await win.showDirectoryPicker!({ mode: 'read' }); return ['files']; }, win);
    expect(got.result).toEqual(['files']);
    expect(got.root).toBe(root);
    expect(win.showDirectoryPicker).toBe(real);
  });

  it('a picker from the prototype is restored by removing the wrapper', async () => {
    const proto = { showDirectoryPicker: async () => dir(REC) };
    const win = Object.create(proto) as typeof proto;
    await withPickedFolder(async () => win.showDirectoryPicker(), win);
    expect(Object.prototype.hasOwnProperty.call(win, 'showDirectoryPicker')).toBe(false);
    expect(win.showDirectoryPicker).toBe(proto.showDirectoryPicker);
  });

  it('no folder picker (file-input fallback): no handle', async () => {
    expect(await withPickedFolder(async () => 1, {})).toEqual({ result: 1 });
  });

  it('a closed picker still puts the picker back', async () => {
    const real = async () => { throw new DOMException('closed', 'AbortError'); };
    const win: { showDirectoryPicker?: (...a: unknown[]) => Promise<unknown> } = { showDirectoryPicker: real };
    await expect(withPickedFolder(async () => win.showDirectoryPicker!(), win)).rejects.toThrow('closed');
    expect(win.showDirectoryPicker).toBe(real);
  });
});
