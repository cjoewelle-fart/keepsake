import { describe, expect, it } from 'vitest';
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
