// HEIC previews from the small copy stored in the file (T54), with the real libheif build the
// app bundles, on real phone files (tests/real-phones) and the libheif-made samples (tests/heic).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error: the bundle ships without its own type declarations
import libheifFactory from 'libheif-js/libheif-wasm/libheif-bundle.mjs';
import { decodeForPreview, thumbnailFits, type LibheifC } from '../src/worker/heicDecode';

const file = (p: string) => new Uint8Array(readFileSync(join(__dirname, p)));
let m: LibheifC;
beforeAll(async () => { m = await libheifFactory(); }, 30_000);

/** Bytes libheif's memory has grown to, to check nothing is left allocated. */
const heapUse = () => m._malloc(1);

describe('thumbnailFits', () => {
  it('takes a 320 x 240 copy of a 4032 x 3024 photo for a 320 px preview', () => {
    expect(thumbnailFits(320, 240, 4032, 3024, 320)).toBe(true);
    expect(thumbnailFits(384, 512, 3024, 4032, 320)).toBe(true);
  });
  it('turns down copies that are too small or shaped differently', () => {
    expect(thumbnailFits(160, 120, 4032, 3024, 320)).toBe(false); // too small
    expect(thumbnailFits(320, 240, 4032, 3024, 480)).toBe(false); // too small for a bigger preview
    expect(thumbnailFits(240, 320, 4032, 3024, 320)).toBe(false); // turned the other way
    expect(thumbnailFits(320, 180, 4032, 3024, 320)).toBe(false); // cropped differently
    expect(thumbnailFits(0, 0, 4032, 3024, 320)).toBe(false);
  });
  it('accepts a copy as big as a small main picture', () => {
    expect(thumbnailFits(200, 150, 200, 150, 320)).toBe(true);
  });
});

describe('decodeForPreview', () => {
  it.each([
    ['real-phones/iphone-8_IMG_1034.heic', 320, 240],
    ['real-phones/samsung-galaxy-s10plus_SM-G975F.heic', 384, 512],
    ['heic/iphone.heic', 320, 240],
  ])('%s: decodes the stored small copy, not the 12 MP picture', (p, w, h) => {
    const r = decodeForPreview(m, file(p), 320);
    expect(r).toMatchObject({ from: 'thumbnail', width: w, height: h });
    expect(r.data.length).toBe(w * h * 4);
    // A real picture, not an empty buffer: some pixels differ and every pixel is opaque.
    expect(new Set(r.data.filter((_, i) => i % 4 === 0)).size).toBeGreaterThan(10);
    expect(r.data.filter((_, i) => i % 4 === 3).every((a) => a === 255)).toBe(true);
  });

  it('the small copy looks like the main picture (same colours, same way up)', () => {
    // Average colour of each quarter of the picture, from the copy and from the main picture.
    const quarters = (r: { width: number; height: number; data: Uint8ClampedArray }) => {
      const sums = [0, 0, 0, 0].map(() => [0, 0, 0, 0]);
      for (let y = 0; y < r.height; y += 4) for (let x = 0; x < r.width; x += 4) {
        const q = (y < r.height / 2 ? 0 : 2) + (x < r.width / 2 ? 0 : 1);
        const i = (y * r.width + x) * 4;
        sums[q][0] += r.data[i]; sums[q][1] += r.data[i + 1]; sums[q][2] += r.data[i + 2]; sums[q][3]++;
      }
      return sums.map(([r, g, b, n]) => [r / n, g / n, b / n]);
    };
    const bytes = file('real-phones/iphone-8_IMG_1034.heic');
    const small = quarters(decodeForPreview(m, bytes, 320));
    const main = quarters(decodeForPreview(m, bytes, 5000)); // no copy is big enough: main picture
    for (let q = 0; q < 4; q++) for (let c = 0; c < 3; c++) expect(Math.abs(small[q][c] - main[q][c])).toBeLessThan(12);
  });

  it('decodes the main picture when there is no small copy', () => {
    expect(decodeForPreview(m, file('real-phones/iphone-11-pro_IMG_2927.HEIC'), 320)).toMatchObject({ from: 'main', width: 3024, height: 4032 });
    expect(decodeForPreview(m, file('heic/plain.heic'), 320)).toMatchObject({ from: 'main', width: 2016, height: 1512 });
  });

  it('decodes the main picture when the copy is too small for the preview', () => {
    expect(decodeForPreview(m, file('heic/iphone.heic'), 640)).toMatchObject({ from: 'main', width: 4032, height: 3024 });
  });

  it('throws on files that are not HEIC or are cut off before the picture, and frees its memory', () => {
    const before = heapUse();
    m._free(before);
    expect(() => decodeForPreview(m, new Uint8Array([1, 2, 3, 4]), 320)).toThrow();
    const real = file('real-phones/iphone-11-pro_IMG_2927.HEIC');
    expect(() => decodeForPreview(m, real.subarray(0, 4000), 320)).toThrow();
    for (let i = 0; i < 20; i++) decodeForPreview(m, file('heic/iphone.heic'), 320);
    const after = heapUse();
    m._free(after);
    expect(after).toBe(before); // the same free block is handed out again: nothing leaked in front of it
  });
});
