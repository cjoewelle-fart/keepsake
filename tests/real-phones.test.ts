import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { inspect, scanAll } from '../src/engine/scan';
import type { FileRecord, FileSource } from '../src/engine/types';
import { fsSource, walk } from './fs-source';

// Real iPhone and Samsung files from the public metadata-extractor-images collection
// (see tests/real-phones/README.md for source, licence and what each file is).
const ROOT = fileURLToPath(new URL('./real-phones/', import.meta.url));
const media = () => walk(ROOT).filter((p) => !p.endsWith('.md'));

type Expect = Pick<FileRecord, 'kind' | 'group' | 'reason' | 'takenAt'> & Partial<Pick<FileRecord, 'width' | 'height' | 'camera'>>;

// Dates from the collection's metadata dumps (<type>/metadata/java/<name>.txt).
const EXPECTED: Record<string, Expect & { size: number }> = {
  'iphone-8_IMG_1034.heic': { size: 1_499_892, kind: 'heic', group: 'keep', reason: 'photo', width: 4032, height: 3024, camera: 'Apple iPhone 8', takenAt: '2018-02-05T15:11:44' },
  // Its grid 'ispe' is 3024x4032 (Exif says 4032x3024); the engine reports the container's own size.
  'iphone-11-pro_IMG_2927.HEIC': { size: 721_093, kind: 'heic', group: 'keep', reason: 'photo', width: 3024, height: 4032, camera: 'Apple iPhone 11 Pro', takenAt: '2020-05-04T18:39:11' },
  // 'mdat' first, 'meta' after it, then a Samsung 'sefd' trailer box.
  'samsung-galaxy-s10plus_SM-G975F.heic': { size: 1_622_642, kind: 'heic', group: 'keep', reason: 'photo', width: 4032, height: 3024, camera: 'samsung SM-G975F', takenAt: '2020-06-30T11:27:59' },
  'iphone-4.jpg': { size: 338_025, kind: 'jpeg', group: 'keep', reason: 'photo', width: 1296, height: 968, camera: 'Apple iPhone 4', takenAt: '2011-01-13T14:33:39' },
  // 640x480 is small, but it has camera details and a date: an old phone's real photo.
  'samsung-galaxy-s_GT-I9000.jpg': { size: 101_329, kind: 'jpeg', group: 'keep', reason: 'photo', width: 640, height: 480, camera: 'SAMSUNG GT-I9000', takenAt: '2011-04-02T18:30:10' },
  'samsung-galaxy-s4_GT-I9505.jpg': { size: 1_936_020, kind: 'jpeg', group: 'keep', reason: 'photo', width: 4128, height: 2322, camera: 'SAMSUNG GT-I9505', takenAt: '2014-11-27T17:52:49' },
  'samsung-galaxy-j3_SM-J327T1.jpg': { size: 945_207, kind: 'jpeg', group: 'keep', reason: 'photo', width: 2576, height: 1932, camera: 'samsung SM-J327T1', takenAt: '2019-09-26T16:38:00' },
  // creationdate 2019-07-24T11:25:40+0300 (local time wins over mvhd's UTC).
  'iphone-6_video.mov': { size: 439_391, kind: 'mov', group: 'keep', reason: 'video', takenAt: '2019-07-24T11:25:40' },
  // No local-time tag: mvhd (UTC). metadata-extractor shows it as 19:20:28 AEDT = 08:20:28 UTC.
  'samsung-android_video.mp4': { size: 242_752, kind: 'mp4', group: 'keep', reason: 'video', takenAt: '2017-02-22T08:20:28' },
};

const mem = (path: string, data: Uint8Array): FileSource => ({ path, size: data.length, read: async (s, e) => data.slice(s, e) });
const bytesOf = (name: string) => new Uint8Array(readFileSync(ROOT + name));
const cut = (name: string, frac: number) => bytesOf(name).slice(0, Math.floor(bytesOf(name).length * frac));
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

describe('real phone files', () => {
  let records: FileRecord[];
  let before: Map<string, string>;
  let sources: FileSource[];
  const extras = {
    cutHeic: mem('recup_dir.1/f0100001.heic', cut('iphone-8_IMG_1034.heic', 0.6)),
    cutJpeg: mem('recup_dir.1/f0100002.jpg', cut('samsung-galaxy-s4_GT-I9505.jpg', 0.6)),
    copy: mem('recup_dir.2/f0200003.jpg', bytesOf('samsung-galaxy-j3_SM-J327T1.jpg')),
  };

  beforeAll(async () => {
    before = new Map(media().map((p) => [p, sha(p)]));
    sources = [...media().map((p) => fsSource(ROOT, p)), extras.cutHeic, extras.cutJpeg, extras.copy];
    const r = await scanAll(sources);
    expect(r).not.toBeNull();
    records = r!;
  });

  const byPath = (path: string) => records.find((r) => r.path === path)!;

  it('has exactly the files the README lists', () => {
    expect(media().map((p) => basename(p)).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const [name, { size, ...want }] of Object.entries(EXPECTED)) {
    it(`keeps ${name} with the right date`, () => {
      const r = byPath(name);
      expect(r.size).toBe(size);
      expect(r).toMatchObject(want);
    });
  }

  it('puts every real photo and video in Keep', () => {
    const real = records.filter((r) => r.path in EXPECTED);
    expect(real).toHaveLength(9);
    expect(real.filter((r) => r.group !== 'keep').map((r) => [r.path, r.group, r.reason])).toEqual([]);
  });

  it('sets aside a real iPhone HEIC cut to 60% as damaged', () => {
    expect(byPath(extras.cutHeic.path)).toMatchObject({ kind: 'heic', group: 'damaged', reason: 'cut-off' });
  });

  it('sets aside a real Samsung JPEG cut to 60% as damaged', () => {
    expect(byPath(extras.cutJpeg.path)).toMatchObject({ kind: 'jpeg', group: 'damaged', reason: 'cut-off' });
  });

  it('marks an exact copy of a real Samsung JPEG as a copy and keeps the original', () => {
    const original = byPath('samsung-galaxy-j3_SM-J327T1.jpg');
    expect(original.group).toBe('keep');
    expect(byPath(extras.copy.path)).toMatchObject({ group: 'duplicate', reason: 'copy', copyOf: original.index });
  });

  it('sets aside only the three made-up files', () => {
    expect(records.filter((r) => r.group !== 'keep').map((r) => r.path).sort())
      .toEqual([extras.cutHeic.path, extras.cutJpeg.path, extras.copy.path].sort());
  });

  // T49: a recovered video that stops early has no playable end. The real files are whole
  // (their boxes end exactly at the end of the file), so they stay in Keep (above).
  for (const name of ['iphone-6_video.mov', 'samsung-android_video.mp4']) {
    it(`sets aside ${name} cut off at any point as damaged, cut off`, async () => {
      for (const frac of [0.05, 0.2, 0.4, 0.6, 0.8, 0.95, 0.999]) {
        const f = cut(name, frac);
        const r = await inspect(mem(`recup_dir.9/${frac}.${name.split('.').pop()}`, f), 0);
        expect([frac, r.group, r.reason]).toEqual([frac, 'damaged', 'cut-off']);
      }
    });
  }

  it('leaves the files on disk unchanged', () => {
    expect(new Map(media().map((p) => [p, sha(p)]))).toEqual(before);
  });
});
