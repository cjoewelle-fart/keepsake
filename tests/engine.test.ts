import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exifTiff, heifLayout, heifSize, parseHeifMeta, readBoxHeader } from '../src/engine/heif';
import { endsCleanly, jpegSize, sniff } from '../src/engine/sniff';
import { inspect, normalizeDate, scanAll } from '../src/engine/scan';
import { summarize } from '../src/engine/summary';
import type { FileSource } from '../src/engine/types';

const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])));

const mem = (path: string, data: Uint8Array): FileSource => ({
  path, size: data.length, read: async (s, e) => data.slice(s, e),
});

// A minimal valid JPEG skeleton: SOI, APP0, SOF0 (w x h), SOS, EOI.
const jpeg = (w: number, h: number, end = true) => {
  const parts = [
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, ...'JFIF\0'.split('').map((c) => c.charCodeAt(0)), 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1,
    0xff, 0xda, 0x00, 0x0c, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0,
    ...new Array(30_000).fill(0x55),
  ];
  if (end) parts.push(0xff, 0xd9);
  return new Uint8Array(parts);
};

describe('sniff', () => {
  it('identifies formats by content, not extension', () => {
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(sniff(bytes(0x89, 'PNG'))).toBe('png');
    expect(sniff(bytes(0, 0, 0, 24, 'ftypheic'))).toBe('heic');
    expect(sniff(bytes(0, 0, 0, 24, 'ftypqt  '))).toBe('mov');
    expect(sniff(bytes(0, 0, 0, 24, 'ftypisom'))).toBe('mp4');
    expect(sniff(bytes('SQLite format 3'))).toBe('other');
    expect(sniff(new Uint8Array())).toBe('empty');
  });
});

describe('jpeg structure', () => {
  it('reads the pixel size', () => expect(jpegSize(jpeg(640, 480))).toEqual({ width: 640, height: 480 }));
  it('flags garbage after the header', () => expect(jpegSize(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 4, 1, 2, 0x13, 0x37, 9, 9))).toBe('invalid'));
  it('detects a cut-off ending', () => {
    expect(endsCleanly('jpeg', bytes(1, 2, 0xff, 0xd9))).toBe(true);
    expect(endsCleanly('jpeg', bytes(1, 2, 0xff, 0xd9, 0, 0, 0))).toBe(true);
    expect(endsCleanly('jpeg', bytes(1, 2, 3, 4))).toBe(false);
  });
});

describe('dates', () => {
  it('normalizes camera dates and rejects zeroed ones', () => {
    expect(normalizeDate('2023:03:11 12:45:20')).toBe('2023-03-11T12:45:20');
    expect(normalizeDate('0000:00:00 00:00:00')).toBeUndefined();
    expect(normalizeDate(undefined)).toBeUndefined();
  });
});

describe('inspect', () => {
  it('keeps a full-size photo', async () => {
    expect((await inspect(mem('a.jpg', jpeg(1200, 900)), 0)).group).toBe('keep');
  });
  it('sets aside a low-resolution image with no camera details', async () => {
    const r = await inspect(mem('t.jpg', jpeg(160, 120)), 0);
    expect([r.group, r.reason]).toEqual(['small', 'low-resolution']);
  });
  it('sets aside a cut-off photo as damaged', async () => {
    const r = await inspect(mem('c.jpg', jpeg(1200, 900, false)), 0);
    expect([r.group, r.reason]).toEqual(['damaged', 'cut-off']);
  });
  it('treats non-media as system files and empty files as damaged', async () => {
    expect((await inspect(mem('x.txt', bytes('hello world')), 0)).group).toBe('system');
    expect((await inspect(mem('e.jpg', new Uint8Array()), 0)).reason).toBe('empty-file');
  });
});

// Regression cases found by QA review (Oct 2026).
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

describe('real-world photos are not mistaken for damaged ones', () => {
  it('keeps a Samsung photo with a trailer after the end marker', async () => {
    const r = await inspect(mem('s.jpg', concat(jpeg(1200, 900), bytes('SEFH', ...new Array(500).fill(7), 'SEFT'))), 0);
    expect(r.group).toBe('keep');
  });
  it('keeps a Motion Photo with a video attached after the picture', async () => {
    // Real Motion Photos declare the attached video in an XMP block near the start.
    const xmp = bytes('http://ns.adobe.com/xap/1.0/', 0, '<x:xmpmeta><rdf:Description Camera:MotionPhoto="1"/></x:xmpmeta>');
    const app1 = concat(bytes(0xff, 0xe1, (xmp.length + 2) >> 8, (xmp.length + 2) & 255), xmp);
    const photo = jpeg(1200, 900);
    const withXmp = concat(photo.slice(0, 2), app1, photo.slice(2));
    const video = concat(bytes(0, 0, 0, 24, 'ftypmp42'), new Uint8Array(200_000).fill(3));
    expect((await inspect(mem('m.jpg', concat(withXmp, video)), 0)).group).toBe('keep');
  });
  it('flags a file with a photo header but scrambled contents', async () => {
    const junk = new Uint8Array(60_000);
    for (let i = 0; i < junk.length; i++) junk[i] = (i * 2654435761) >>> 24;
    junk.set([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff], 0);
    junk.set([0xff, 0xd9], 40_000); // a stray end marker in the noise must not fool the check
    expect((await inspect(mem('g.jpg', junk), 0)).group).toBe('damaged');
  });
  it('keeps a photo padded with 4 KB of zeros', async () => {
    expect((await inspect(mem('p.jpg', concat(jpeg(1200, 900), new Uint8Array(4096))), 0)).group).toBe('keep');
  });
  it('still flags a photo cut off mid-way', async () => {
    const whole = jpeg(1200, 900);
    expect((await inspect(mem('c.jpg', whole.slice(0, 20_000)), 0)).reason).toBe('cut-off');
  });
});

describe('small files that are real photos', () => {
  it('keeps a full-size image even when the file is tiny', async () => {
    const tiny = jpeg(1080, 2340).slice(0, 400);
    const r = await inspect(mem('shot.jpg', concat(tiny, bytes(0xff, 0xd9))), 0);
    expect(r.group).toBe('keep');
  });
});

describe('more formats', () => {
  it('recognises camera video and raw formats, and sends audio to system', () => {
    expect(sniff(bytes('RIFF', 0, 0, 0, 0, 'AVI '))).toBe('avi');
    expect(sniff(bytes(0, 0, 0, 8, 'wide'))).toBe('mov');
    expect(sniff(bytes(0, 0, 0, 24, 'ftypcrx '))).toBe('raw');
    expect(sniff(bytes('II*', 0))).toBe('tiff');
    expect(sniff(bytes(0, 0, 0, 24, 'ftypM4A '))).toBe('other');
  });
});

describe('read errors', () => {
  const flaky = (path: string, data: Uint8Array, failFrom: number): FileSource => ({
    path, size: data.length,
    read: async (s, e) => { if (e - s >= failFrom) throw new Error('NotReadableError'); return data.slice(s, e); },
  });
  it('keeps a file it cannot read instead of calling it damaged', async () => {
    const recs = await scanAll([flaky('x.jpg', jpeg(1200, 900), 0)]);
    expect([recs![0].group, recs![0].reason]).toEqual(['keep', 'not-checked']);
  });
  it('a failed copy check does not lose the whole scan', async () => {
    const a = jpeg(1200, 900);
    const recs = await scanAll([mem('1.jpg', a), flaky('2.jpg', a.slice(), a.length)]);
    expect(recs).not.toBeNull();
    expect(recs!.map((r) => r.group)).toEqual(['keep', 'keep']);
  });
});

describe('copies', () => {
  it('keeps one of each identical file and points copies at it', async () => {
    const a = jpeg(1200, 900);
    const recs = await scanAll([mem('1.jpg', a), mem('2.jpg', a.slice()), mem('3.jpg', jpeg(1000, 800))]);
    expect(recs!.map((r) => r.group)).toEqual(['keep', 'duplicate', 'keep']);
    expect(recs![1].copyOf).toBe(0);
  });
});

describe('summary', () => {
  it('moving a group back to Keep updates every count', async () => {
    const recs = (await scanAll([mem('1.jpg', jpeg(1200, 900)), mem('2.jpg', jpeg(100, 100)), mem('3.txt', bytes('log'))]))!;
    const before = summarize(recs);
    expect([before.keep, before.setAside, before.groups.small]).toEqual([1, 2, 1]);
    const after = summarize(recs, new Set(['small']));
    expect([after.keep, after.setAside, after.total]).toEqual([2, 1, 3]);
  });
});

// ---- HEIC / AVIF (T18) ----
// tests/heic/*.heic are made by scripts/make_heic_samples.py (libheif + x265), laid out like
// iPhone photos: a grid of 512 px tiles, a thumbnail item, and an Exif item found through 'iloc'.

const heicFile = (name: string) => new Uint8Array(readFileSync(new URL(`./heic/${name}`, import.meta.url)));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n: number) => [(n >>> 8) & 255, n & 255];
const box = (type: string, ...body: Uint8Array[]) => {
  const len = body.reduce((n, b) => n + b.length, 8);
  return concat(bytes(...be32(len), type), ...body);
};
const fullBox = (type: string, version: number, flags: number, ...body: Uint8Array[]) =>
  box(type, bytes(version, 0, 0, flags), ...body);

/** Build a minimal HEIF: item 1 = picture (with a decoy 160x120 'ispe' listed first), item 2 = Exif. */
function synthHeif(o: { w: number; h: number; exif?: Uint8Array; pad?: number; mdatFirst?: boolean; ilocVersion?: 0 | 1; pixels?: number }) {
  const pixels = new Uint8Array(o.pixels ?? 2000).fill(0x42);
  const exif = o.exif ?? new Uint8Array();
  const ftyp = box('ftyp', bytes('heic', 0, 0, 0, 0, 'mif1heic'));
  const meta = (picAt: number, exifAt: number) => {
    const v = o.ilocVersion ?? 0;
    const item = (id: number, at: number, len: number) =>
      bytes(...be16(id), ...(v === 1 ? be16(0) : []), ...be16(0), ...be16(1), ...be32(at), ...be32(len));
    const items = [item(1, picAt, pixels.length), ...(exif.length ? [item(2, exifAt, exif.length)] : [])];
    return fullBox('meta', 0, 0,
      fullBox('hdlr', 0, 0, bytes(0, 0, 0, 0, 'pict', ...new Array(13).fill(0))),
      fullBox('pitm', 0, 0, bytes(...be16(1))),
      fullBox('iinf', 0, 0, bytes(...be16(2)),
        fullBox('infe', 2, 0, bytes(...be16(1), 0, 0, 'hvc1', 0)),
        fullBox('infe', 2, 0, bytes(...be16(2), 0, 0, 'Exif', 0))),
      fullBox('iloc', v, 0, bytes(0x44, 0x00, ...be16(items.length)), ...items),
      box('iprp',
        box('ipco',
          fullBox('ispe', 0, 0, bytes(...be32(160), ...be32(120))),
          fullBox('ispe', 0, 0, bytes(...be32(o.w), ...be32(o.h)))),
        fullBox('ipma', 0, 0, bytes(...be32(1), ...be16(1), 1, 0x82))));
  };
  const pad = o.pad ? box('free', new Uint8Array(o.pad)) : new Uint8Array();
  const metaLen = meta(0, 0).length;
  const mdatAt = o.mdatFirst ? ftyp.length : ftyp.length + metaLen + pad.length;
  const picAt = mdatAt + 8;
  const exifAt = picAt + pixels.length;
  const mdat = box('mdat', pixels, exif);
  return o.mdatFirst ? concat(ftyp, mdat, pad, meta(picAt, exifAt)) : concat(ftyp, meta(picAt, exifAt), pad, mdat);
}

/** The Exif item from the iPhone-like sample, to embed in synthetic files. */
const sampleExif = () => {
  const f = heicFile('iphone.heic');
  const metaAt = 28;
  const h = readBoxHeader(f, metaAt, 0, f.length)!;
  const m = parseHeifMeta(f.subarray(metaAt, h.end), metaAt);
  return f.slice(m.exif![0].start, m.exif![0].end);
};

describe('HEIF box parser', () => {
  it('reads the main picture size, not the thumbnail or a tile', () => {
    expect(heifSize(heicFile('iphone.heic'))).toEqual({ width: 4032, height: 3024 });
    expect(heifSize(heicFile('thumb.heic'))).toEqual({ width: 320, height: 240 });
  });
  it('follows ipma to the right ispe, with iloc versions 0 and 1', () => {
    for (const ilocVersion of [0, 1] as const) {
      expect(heifSize(synthHeif({ w: 3000, h: 4000, ilocVersion }))).toEqual({ width: 3000, height: 4000 });
    }
  });
  it('finds the Exif item and its TIFF header', () => {
    const tiff = exifTiff(sampleExif());
    expect(tiff && String.fromCharCode(tiff[0], tiff[1])).toMatch(/II|MM/);
  });
  it('reads box headers, including 64-bit sizes', () => {
    expect(readBoxHeader(bytes(0, 0, 0, 1, 'mdat', 0, 0, 0, 0, 0, 0, 0x10, 0), 0, 100, 0)).toEqual({ type: 'mdat', headerLen: 16, end: 100 + 4096 });
    expect(readBoxHeader(bytes(0, 0, 0, 0, 'mdat'), 0, 50, 999)).toEqual({ type: 'mdat', headerLen: 8, end: 999 });
    expect(readBoxHeader(bytes(0, 0, 0, 3, 'mdat'), 0, 0, 99)).toBeNull();
    expect(readBoxHeader(bytes(0, 0, 0, 9, 0, 1, 2, 3), 0, 0, 99)).toBeNull();
  });
  it('finds meta after a large mdat by reading only box headers', async () => {
    const f = synthHeif({ w: 1200, h: 900, mdatFirst: true, pixels: 500_000 });
    const reads: number[] = [];
    const read = async (s: number, e: number) => { reads.push(e - s); return f.slice(s, e); };
    const l = await heifLayout(read, f.length, f.slice(0, 64));
    expect([l.size, l.cutOff]).toEqual([{ width: 1200, height: 900 }, false]);
    expect(Math.max(...reads)).toBeLessThan(10_000); // never read the picture data
  });
});

describe('HEIC photos', () => {
  it('keeps an iPhone-style photo and reads its camera and date', async () => {
    const r = await inspect(mem('IMG_0001.heic', heicFile('iphone.heic')), 0);
    expect(r).toMatchObject({ kind: 'heic', group: 'keep', width: 4032, height: 3024, camera: 'Apple iPhone 13', takenAt: '2023-07-14T18:22:05' });
  });
  it('reads the date even when the Exif block is past the first 256 KB', async () => {
    const f = synthHeif({ w: 4032, h: 3024, exif: sampleExif(), pad: 400_000 });
    const r = await inspect(mem('far.heic', f), 0);
    expect(r).toMatchObject({ group: 'keep', camera: 'Apple iPhone 13', takenAt: '2023-07-14T18:22:05' });
  });
  it('sets aside a small HEIC thumbnail with no details', async () => {
    const r = await inspect(mem('t.heic', heicFile('thumb.heic')), 0);
    expect([r.group, r.reason, r.width]).toEqual(['small', 'low-resolution', 320]);
  });
  it('keeps a full-size HEIC with no details even though the file is under 20 KB', async () => {
    const f = heicFile('plain.heic');
    expect(f.length).toBeLessThan(20_000);
    const r = await inspect(mem('p.heic', f), 0);
    expect([r.group, r.width, r.height]).toEqual(['keep', 2016, 1512]);
  });
  it('flags a cut-off HEIC as damaged at any cut point, without crashing', async () => {
    const f = heicFile('iphone.heic');
    for (const n of [12, 40, 500, 3000, 3100, 10_000, f.length - 1]) {
      const r = await inspect(mem('cut.heic', f.slice(0, n)), 0);
      expect([n, r.group]).toEqual([n, 'damaged']);
    }
    expect((await inspect(mem('cut.heic', f.slice(0, 10_000)), 0)).reason).toBe('cut-off');
  });
  it('keeps a HEIC with leftover bytes after the end', async () => {
    const f = concat(heicFile('iphone.heic'), new Uint8Array(4096), bytes('garbage!'));
    expect((await inspect(mem('x.heic', f), 0)).group).toBe('keep');
  });
  it('flags a HEIC whose structure is scrambled after the header', async () => {
    const junk = concat(heicFile('iphone.heic').slice(0, 28), bytes(0, 0, 0, 2, 0xff, 0xfe, 0x01, 0x02), new Uint8Array(30_000).fill(9));
    expect((await inspect(mem('j.heic', junk), 0)).reason).toBe('unreadable');
  });
  it('does not call a HEIF image sequence (moov, no meta) damaged', async () => {
    const seq = concat(box('ftyp', bytes('msf1', 0, 0, 0, 0, 'msf1hevc')), box('moov', new Uint8Array(500)), box('mdat', new Uint8Array(40_000)));
    expect((await inspect(mem('burst.heic', seq), 0)).group).toBe('keep');
  });
  it('reads AVIF sizes from the same boxes', async () => {
    const f = synthHeif({ w: 1920, h: 1080 });
    f.set([...'avif'].map((c) => c.charCodeAt(0)), 8);
    const r = await inspect(mem('a.avif', f), 0);
    expect([r.kind, r.group, r.width]).toEqual(['avif', 'keep', 1920]);
  });
});
