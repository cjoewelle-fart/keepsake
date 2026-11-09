// T50 (screenshots) and T59 (from chat apps): the hints behind the review screen's two new
// "Show only" filters. They never change a file's group (the filters only show photos).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasScreenshotWord, isChatSize, isScreenSize, lookOf, metaSigns } from '../src/engine/looks';
import type { LookInput, MetaSigns } from '../src/engine/looks';
import { inspect } from '../src/engine/scan';
import type { FileSource } from '../src/engine/types';
import { fsSource } from './fs-source';

const enc = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const utf16 = (s: string, le: boolean) => new Uint8Array([...s].flatMap((c) => (le ? [c.charCodeAt(0), 0] : [0, c.charCodeAt(0)])));
const none: MetaSigns = { exif: false, jfif: false, screenshotTag: false };
const look = (p: Partial<LookInput>) => lookOf({ kind: 'jpeg', signs: none, ...p })?.look;

describe('hasScreenshotWord', () => {
  it('finds the word in any case, as ASCII or UTF-16 either way round', () => {
    expect(hasScreenshotWord(enc('ASCII\0\0\0Screenshot'))).toBe(true);
    expect(hasScreenshotWord(enc('gnome-screenshot'))).toBe(true);
    expect(hasScreenshotWord(enc('SCREENSHOT'))).toBe(true);
    expect(hasScreenshotWord(utf16('UNICODE Screenshot', true))).toBe(true);
    expect(hasScreenshotWord(utf16('Screenshot', false))).toBe(true);
  });
  it('needs the whole word, within the range given', () => {
    expect(hasScreenshotWord(enc('Screen shot'))).toBe(false);
    expect(hasScreenshotWord(enc('Screensho'))).toBe(false);
    expect(hasScreenshotWord(enc('xxScreenshot'), 0, 8)).toBe(false);
    expect(hasScreenshotWord(new Uint8Array(0))).toBe(false);
  });
});

describe('screen and chat sizes', () => {
  it('knows common phone screens, either way round', () => {
    for (const [w, h] of [[1080, 2400], [1170, 2532], [1290, 2796], [720, 1280], [1440, 3200], [750, 1334], [540, 1170], [2400, 1080]]) {
      expect(isScreenSize(w, h), `${w}x${h}`).toBe(true);
    }
  });
  it('knows common computer and tablet screens', () => {
    for (const [w, h] of [[1920, 1080], [1366, 768], [2560, 1440], [2880, 1800], [2048, 2732], [1536, 2048]]) {
      expect(isScreenSize(w, h), `${w}x${h}`).toBe(true);
    }
  });
  it('leaves out camera and square sizes', () => {
    for (const [w, h] of [[4032, 3024], [1600, 1200], [2016, 1512], [1000, 1000], [1080, 1080], [1080, 1350], [800, 600], [0, 0]]) {
      expect(isScreenSize(w, h), `${w}x${h}`).toBe(false);
    }
  });
  it('knows the long sides chat apps shrink photos to', () => {
    expect(isChatSize(1600, 1200)).toBe(true);
    expect(isChatSize(960, 1280)).toBe(true);
    expect(isChatSize(2048, 1536)).toBe(true);
    expect(isChatSize(4032, 3024)).toBe(false);
    expect(isChatSize(1024, 768)).toBe(false);
  });
});

describe('lookOf', () => {
  it('calls a photo a screenshot when its own details say so (even a JPEG, even with a date)', () => {
    expect(lookOf({ kind: 'jpeg', width: 100, height: 100, takenAt: '2023-01-01T00:00:00', signs: { ...none, screenshotTag: true } }))
      .toEqual({ look: 'screenshot', sign: 'screenshot-tag' });
  });
  it('calls a PNG of an exact screen size with no camera details a screenshot', () => {
    expect(lookOf({ kind: 'png', width: 1080, height: 2400, signs: none })).toEqual({ look: 'screenshot', sign: 'screen-size' });
    expect(look({ kind: 'png', width: 1000, height: 1000 })).toBeUndefined();
    expect(look({ kind: 'png', width: 1080, height: 2400, camera: 'samsung SM-A525F' })).toBeUndefined();
    expect(look({ kind: 'png' })).toBeUndefined(); // size unknown
  });
  it('never calls a JPEG a screenshot by size alone', () => {
    expect(look({ kind: 'jpeg', width: 1080, height: 2400, signs: { ...none, exif: true } })).toBeUndefined();
  });
  it('never gives a hint to a photo with exposure details (a camera took it)', () => {
    expect(look({ kind: 'png', width: 1080, height: 2400, exposure: true })).toBeUndefined();
    expect(look({ kind: 'jpeg', width: 1600, height: 1200, exposure: true })).toBeUndefined();
    expect(look({ kind: 'jpeg', exposure: true, signs: { ...none, screenshotTag: true } })).toBeUndefined();
  });
  it('calls a JPEG with no camera details or date at a chat size "from a chat app"', () => {
    expect(lookOf({ kind: 'jpeg', width: 1600, height: 1200, signs: { ...none, exif: true } })).toEqual({ look: 'chat', sign: 'chat-size' });
    expect(look({ kind: 'jpeg', width: 1536, height: 2048 })).toBe('chat');
    expect(look({ kind: 'jpeg', width: 1280, height: 720 })).toBe('chat');
  });
  it('calls a JPEG with JFIF and no Exif block at all "from a chat app", whatever its size', () => {
    expect(lookOf({ kind: 'jpeg', width: 960, height: 720, signs: { ...none, jfif: true } })).toEqual({ look: 'chat', sign: 'jfif-no-exif' });
    expect(look({ kind: 'jpeg', width: 1500, height: 1000, signs: { ...none, jfif: true, exif: true } })).toBeUndefined();
    expect(look({ kind: 'jpeg', width: 1500, height: 1000 })).toBeUndefined(); // no JFIF either: no sign
  });
  it('leaves camera photos alone, even at a chat size', () => {
    expect(look({ kind: 'jpeg', width: 1600, height: 1200, camera: 'samsung SM-A525F', signs: { ...none, exif: true } })).toBeUndefined();
    expect(look({ kind: 'jpeg', width: 1600, height: 1200, takenAt: '2022-08-09T10:11:12', signs: { ...none, exif: true } })).toBeUndefined();
  });
  it('gives no hint to other kinds of photo', () => {
    for (const kind of ['heic', 'webp', 'gif', 'tiff'] as const) {
      expect(look({ kind, width: 1080, height: 2400, signs: { ...none, screenshotTag: true } })).toBeUndefined();
    }
  });
});

describe('metaSigns', () => {
  it('stops at the image data: a "Screenshot" in the picture bytes is not a tag', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x04, 0, 0, ...enc('Screenshot'), 0xff, 0xd9]);
    expect(metaSigns('jpeg', jpeg)).toEqual(none);
  });
  it('reads a JPEG comment', () => {
    const c = enc('Screenshot');
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xfe, 0, c.length + 2, ...c, 0xff, 0xda, 0, 2]);
    expect(metaSigns('jpeg', jpeg).screenshotTag).toBe(true);
  });
  it('survives broken and cut-short files', () => {
    expect(metaSigns('jpeg', new Uint8Array([0xff, 0xd8, 0xff]))).toEqual(none);
    expect(metaSigns('png', enc('\x89PNG\r\n\x1a\n\0\0\0'))).toEqual(none);
    expect(metaSigns('gif', enc('GIF89a'))).toEqual(none);
  });
});

const dir = join(__dirname, 'looks');
const sample = (name: string): FileSource => fsSource(dir, join(dir, name));

describe('inspect gives the hint, and never changes the group (tests/looks, made by scripts/make_look_samples.py)', () => {
  const cases: [string, string | undefined, string | undefined][] = [
    ['ios-screenshot.png', 'screenshot', 'screenshot-tag'],
    ['android-screenshot.png', 'screenshot', 'screen-size'],
    ['mac-screenshot.png', 'screenshot', 'screenshot-tag'],
    ['gnome-screenshot.png', 'screenshot', 'screenshot-tag'],
    ['tagged-screenshot.jpg', 'screenshot', 'screenshot-tag'],
    ['graphic.png', undefined, undefined],
    ['camera-screen.png', undefined, undefined],
    ['whatsapp.jpg', 'chat', 'chat-size'],
    ['messenger.jpg', 'chat', 'jfif-no-exif'],
    ['telegram-exif.jpg', 'chat', 'chat-size'],
    ['camera-1600.jpg', undefined, undefined],
    ['exposure-only.jpg', undefined, undefined],
    ['edited.jpg', undefined, undefined],
  ];
  for (const [name, want, sign] of cases) {
    it(`${name}: ${want ?? 'no hint'}`, async () => {
      const r = await inspect(sample(name), 0);
      expect(r.group).toBe('keep');
      expect(r.look).toBe(want);
      expect(r.lookSign).toBe(sign);
      expect(r).not.toHaveProperty('exposure');
    });
  }
  it('a screenshot keeps its date taken', async () => {
    expect((await inspect(sample('ios-screenshot.png'), 0)).takenAt).toBe('2023-05-06T07:08:09');
  });
  it('real phone photos get no hint', async () => {
    const real = join(__dirname, 'real-phones');
    for (const name of ['iphone-4.jpg', 'samsung-galaxy-j3_SM-J327T1.jpg', 'samsung-galaxy-s4_GT-I9505.jpg', 'samsung-galaxy-s_GT-I9000.jpg']) {
      const r = await inspect(fsSource(real, join(real, name)), 0);
      expect(r.look, name).toBeUndefined();
    }
  });
  it('the samples are what they say (sizes)', () => {
    const png = readFileSync(join(dir, 'android-screenshot.png'));
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(2400);
  });
});
