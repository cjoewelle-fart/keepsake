import { describe, expect, it } from 'vitest';
import { inspect } from '../src/engine/scan';
import { mvhdDate, quicktimeDate, videoDate } from '../src/engine/video';
import type { FileSource } from '../src/engine/types';

// Tiny synthetic MP4/MOV files built box by box.
const enc = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
const be32 = (n: number) => new Uint8Array([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const be64 = (n: number) => cat(be32(Math.floor(n / 2 ** 32)), be32(n >>> 0));
const box = (type: string, ...body: Uint8Array[]) => {
  const b = cat(...body);
  return cat(be32(8 + b.length), enc(type), b);
};
/** Box with a 64-bit size field (size32 == 1). */
const box64 = (type: string, ...body: Uint8Array[]) => {
  const b = cat(...body);
  return cat(be32(1), enc(type), be64(16 + b.length), b);
};

const MAC = 2_082_844_800; // seconds from 1904 to 1970
const secs1904 = (iso: string) => Date.parse(iso + 'Z') / 1000 + MAC;
const NOW = Date.parse('2026-10-16T00:00:00Z');

const mvhd0 = (t: number) => box('mvhd', new Uint8Array([0, 0, 0, 0]), be32(t), be32(t), be32(600), be32(6000), new Uint8Array(80));
const mvhd1 = (t: number) => box('mvhd', new Uint8Array([1, 0, 0, 0]), be64(t), be64(t), be32(600), be64(6000), new Uint8Array(80));
const ftyp = (brand = 'isom') => box('ftyp', enc(brand), be32(0), enc(brand));
const mdat = (n: number) => box('mdat', new Uint8Array(n));
const trak = box('trak', box('tkhd', new Uint8Array(84)));

/** QuickTime 'meta' with keys/ilst holding a creationdate (no version/flags, like iPhones). */
const qtMeta = (date: string, iso = false) => {
  const key = enc('com.apple.quicktime.creationdate');
  return box('meta',
    iso ? new Uint8Array(4) : new Uint8Array(0),
    box('hdlr', new Uint8Array(4), be32(0), enc('mdta'), new Uint8Array(13)),
    box('keys', new Uint8Array(4), be32(2),
      cat(be32(8 + 24), enc('mdta'), enc('com.apple.quicktime.make')),
      cat(be32(8 + key.length), enc('mdta'), key)),
    box('ilst',
      cat(be32(8 + 16 + 5), be32(1), box('data', be32(1), be32(0), enc('Apple'))),
      (() => { const d = box('data', be32(1), be32(0), enc(date)); return cat(be32(8 + d.length), be32(2), d); })()),
  );
};

const mem = (data: Uint8Array, path = 'v.mp4') => {
  const reads: [number, number][] = [];
  const src: FileSource = { path, size: data.length, read: async (s, e) => { reads.push([s, e]); return data.slice(s, e); } };
  return { src, reads, read: src.read };
};
const date = (f: Uint8Array, headLen = 64) => videoDate((s, e) => Promise.resolve(f.slice(s, e)), f.length, f.slice(0, headLen), NOW);

describe('video dates', () => {
  it('reads mvhd when moov is at the start', async () => {
    const f = cat(ftyp(), box('moov', mvhd0(secs1904('2019-07-04T18:30:05')), trak), mdat(50_000));
    expect(await date(f, f.length)).toBe('2019-07-04T18:30:05');
  });

  it('reads moov at the end without reading the video data', async () => {
    const f = cat(ftyp(), mdat(2_000_000), box('moov', mvhd0(secs1904('2021-12-25T09:00:00')), trak));
    const { src, reads } = mem(f);
    expect(await videoDate(src.read, f.length, f.slice(0, 64), NOW)).toBe('2021-12-25T09:00:00');
    expect(Math.max(...reads.map(([s, e]) => e - s))).toBeLessThanOrEqual(64);
  });

  it('reads a version 1 (64-bit) mvhd', async () => {
    const f = cat(ftyp('qt  '), box('moov', mvhd1(secs1904('2024-02-29T23:59:59'))));
    expect(await date(f)).toBe('2024-02-29T23:59:59');
  });

  it('treats zero, 1904, 1970, 2000-ish defaults and future dates as no date', async () => {
    for (const t of [0, 1, secs1904('1970-01-01T00:00:00'), secs1904('2000-01-01T00:00:00'), secs1904('2010-01-01T00:00:00'), secs1904('1994-12-31T23:59:59'), secs1904('2026-10-18T00:00:00')]) {
      const f = cat(ftyp(), box('moov', mvhd0(t)));
      expect(await date(f)).toBeUndefined();
    }
    expect(mvhdDate(cat(new Uint8Array([1, 0, 0, 0]), be64(0)), NOW)).toBeUndefined();
    expect(mvhdDate(cat(new Uint8Array([1, 0, 0, 0]), new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])), NOW)).toBeUndefined();
    expect(mvhdDate(cat(new Uint8Array([7, 0, 0, 0]), be32(secs1904('2020-01-01T00:00:00'))), NOW)).toBeUndefined();
    // A day of slack for clocks and time zones.
    expect(mvhdDate(cat(new Uint8Array(4), be32(secs1904('2026-10-16T12:00:00'))), NOW)).toBe('2026-10-16T12:00:00');
  });

  it('gives no date and does not throw for a truncated file with no moov', async () => {
    const whole = cat(ftyp(), mdat(30_000), box('moov', mvhd0(secs1904('2020-05-05T05:05:05'))));
    for (const cut of [0, 5, 20, 40, 1000, 30_000, whole.length - 140]) {
      const f = whole.slice(0, cut);
      await expect(date(f)).resolves.toBeUndefined();
    }
    await expect(date(enc('garbage that is not a box at all'))).resolves.toBeUndefined();
  });

  it('handles 64-bit box sizes (size 1) and size 0 (to end of file)', async () => {
    const t = secs1904('2018-03-03T03:03:03');
    const big = cat(ftyp(), box64('mdat', new Uint8Array(40_000)), box64('moov', mvhd0(t)));
    expect(await date(big)).toBe('2018-03-03T03:03:03');
    const moovToEnd = cat(ftyp(), mdat(1000), be32(0), enc('moov'), mvhd0(t));
    expect(await date(moovToEnd)).toBe('2018-03-03T03:03:03');
    // mdat running to the end of the file: no moov after it, so no date.
    const mdatToEnd = cat(ftyp(), be32(0), enc('mdat'), new Uint8Array(5000), box('moov', mvhd0(t)));
    expect(await date(mdatToEnd)).toBeUndefined();
  });

  it('prefers the QuickTime creationdate (local time) over mvhd (UTC)', async () => {
    const f = cat(ftyp('qt  '), mdat(1000), box('moov', mvhd0(secs1904('2023-03-11T11:45:20')), trak, qtMeta('2023-03-11T12:45:20+0100')));
    expect(await date(f)).toBe('2023-03-11T12:45:20');
    const iso = cat(ftyp('qt  '), box('moov', mvhd0(0), qtMeta('2022-08-01T07:00:00-0700', true)));
    expect(await date(iso)).toBe('2022-08-01T07:00:00');
  });

  it('falls back to mvhd when the creationdate is unusable', async () => {
    const f = cat(ftyp('qt  '), box('moov', mvhd0(secs1904('2020-01-02T03:04:05')), qtMeta('2000-01-01T00:00:00Z')));
    expect(await date(f)).toBe('2020-01-02T03:04:05');
    expect(quicktimeDate('not a date', NOW)).toBeUndefined();
    expect(quicktimeDate('2023-13-01T00:00:00Z', NOW)).toBeUndefined();
    expect(quicktimeDate('2023-03-11T12:45:20+01:00', NOW)).toBe('2023-03-11T12:45:20');
  });
});

describe('videos in the scan', () => {
  const t = secs1904('2017-06-01T10:00:00');
  it('stores the date on a kept video', async () => {
    const f = cat(ftyp(), mdat(30_000), box('moov', mvhd0(t)));
    const r = await inspect(mem(f).src, 0);
    expect([r.group, r.reason, r.kind, r.takenAt]).toEqual(['keep', 'video', 'mp4', '2017-06-01T10:00:00']);
  });
  it('keeps a whole video with no readable date exactly as before', async () => {
    const f = cat(ftyp(), mdat(30_000), box('moov', mvhd0(0), trak));
    const r = await inspect(mem(f).src, 0);
    expect(r).toMatchObject({ index: 0, path: 'v.mp4', size: f.length, kind: 'mp4', group: 'keep', reason: 'video' });
    expect(r.takenAt).toBeUndefined();
  });
  it('keeps a video whose date read fails', async () => {
    const f = cat(ftyp(), mdat(300_000), box('moov', mvhd0(t)));
    const src: FileSource = { path: 'v.mov', size: f.length, read: async (s, e) => { if (s > 0) throw new Error('card error'); return f.slice(s, e); } };
    const r = await inspect(src, 0);
    expect([r.group, r.reason, r.takenAt]).toEqual(['keep', 'video', undefined]);
  });
  it('still flags a tiny video as cut off', async () => {
    const f = cat(ftyp(), box('moov', mvhd0(t)));
    const r = await inspect(mem(f).src, 0);
    expect([r.group, r.reason, r.takenAt]).toEqual(['damaged', 'cut-off', undefined]);
  });
});

describe('cut-off videos (T49)', () => {
  const t = secs1904('2017-06-01T10:00:00');
  const moov = box('moov', mvhd0(t), trak);
  const verdict = async (f: Uint8Array) => {
    const r = await inspect(mem(f).src, 0);
    return [r.group, r.reason];
  };

  it('sets aside a video whose boxes run cleanly to the end with no moov', async () => {
    expect(await verdict(cat(ftyp(), mdat(30_000)))).toEqual(['damaged', 'cut-off']);
    expect(await verdict(cat(ftyp(), box('free', new Uint8Array(100)), mdat(30_000)))).toEqual(['damaged', 'cut-off']);
    // mdat "to the end of the file" (size 0) and nothing else: the recording never finished.
    expect(await verdict(cat(ftyp(), be32(0), enc('mdat'), new Uint8Array(30_000)))).toEqual(['damaged', 'cut-off']);
  });

  it('sets aside a video whose mdat says it is longer than the file', async () => {
    const whole = cat(ftyp(), mdat(30_000), moov);
    expect(await verdict(whole.slice(0, 25_000))).toEqual(['damaged', 'cut-off']);
  });

  it('sets aside a moov-first video cut off in its mdat, and keeps its date', async () => {
    const whole = cat(ftyp(), moov, mdat(60_000));
    const r = await inspect(mem(whole.slice(0, 40_000)).src, 0);
    expect(r).toMatchObject({ group: 'damaged', reason: 'cut-off', takenAt: '2017-06-01T10:00:00' });
  });

  it('sets aside a video cut off inside its moov', async () => {
    const whole = cat(ftyp(), mdat(30_000), box('moov', mvhd0(t), trak, box('free', new Uint8Array(500))));
    expect(await verdict(whole.slice(0, whole.length - 100))).toEqual(['damaged', 'cut-off']);
  });

  it('keeps whole videos: moov first, moov last, 64-bit sizes, trailing padding', async () => {
    expect(await verdict(cat(ftyp(), moov, mdat(30_000)))).toEqual(['keep', 'video']);
    expect(await verdict(cat(ftyp('qt  '), box('wide'), mdat(30_000), moov))).toEqual(['keep', 'video']);
    expect(await verdict(cat(ftyp(), box64('mdat', new Uint8Array(30_000)), box64('moov', mvhd0(t))))).toEqual(['keep', 'video']);
    expect(await verdict(cat(ftyp(), moov, be32(0), enc('mdat'), new Uint8Array(30_000)))).toEqual(['keep', 'video']);
    // Zeros or a few stray bytes after the last box (common in recovered files) aren't a cut.
    expect(await verdict(cat(ftyp(), mdat(30_000), moov, new Uint8Array(4096)))).toEqual(['keep', 'video']);
    expect(await verdict(cat(ftyp(), mdat(30_000), moov, new Uint8Array(5)))).toEqual(['keep', 'video']);
  });

  it('keeps a video when the walk is unsure (bytes that are not a box)', async () => {
    const junk = new Uint8Array(30_000).fill(0x01);
    expect(await verdict(cat(ftyp(), box('free', new Uint8Array(10)), junk))).toEqual(['keep', 'video']);
  });

  const mvex = box('mvex', box('mehd', new Uint8Array(4), be32(600 * 90)), box('trex', new Uint8Array(24)));
  const fragment = (n: number) => cat(box('moof', box('mfhd', new Uint8Array(4), be32(n)), box('traf', new Uint8Array(40))), mdat(8_000));
  const fragmented = cat(ftyp('iso6'), box('moov', mvhd0(t), trak, mvex), fragment(1), fragment(2), fragment(3), fragment(4),
    box('mfra', box('mfro', new Uint8Array(8))));

  it('keeps a whole fragmented MP4 (moov first, then moof/mdat pairs)', async () => {
    const r = await inspect(mem(fragmented).src, 0);
    expect(r).toMatchObject({ group: 'keep', reason: 'video', takenAt: '2017-06-01T10:00:00' });
  });

  it('sets aside a fragmented MP4 cut off in a fragment', async () => {
    expect(await verdict(fragmented.slice(0, fragmented.length - 9_000))).toEqual(['damaged', 'cut-off']);
  });
});
