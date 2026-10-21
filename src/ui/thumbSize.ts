// Sizes for the small preview copies (T53). Pure, so the worker, the page and the tests share it.

/** Tiles crop their picture to a square ("cover"), so a copy needs its shorter side to fill one. */
export const THUMB_MIN = 160;
export const THUMB_MAX = 480;
/** Very long pictures (panoramas) are capped at this many times the shorter side. */
const LONG_CAP = 3;

/** The error message a worker sends when this browser can't make small copies at all. */
export const UNSUPPORTED = 'small previews unsupported';

/**
 * The shorter side a copy needs for a tile `tilePx` CSS pixels across on a screen with
 * `dpr` device pixels per CSS pixel, in steps of 80 so nearby sizes share one copy.
 * A 140 px tile: 160 on an ordinary screen, 320 on a 2x one.
 */
export function thumbSide(tilePx: number, dpr: number): number {
  const need = Math.ceil(((tilePx > 0 ? tilePx : 140) * (dpr > 0 ? dpr : 1)) / 80) * 80;
  return Math.min(THUMB_MAX, Math.max(THUMB_MIN, need));
}

/**
 * How much a JPEG `width` x `height` can be shrunk while decoding (1, 2, 4 or 8: the steps JPEG
 * decoders offer) and still have a shorter side of at least `side`.
 */
export function jpegScale(width: number, height: number, side: number): 1 | 2 | 4 | 8 {
  const short = Math.min(width, height);
  for (const d of [8, 4, 2] as const) if (short / d >= side) return d;
  return 1;
}

/**
 * Scale `width` x `height` down (never up) so the shorter side is `side` (enough to fill a
 * square tile), with the longer side at most 3 x `side`.
 */
export function thumbSize(width: number, height: number, side: number): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new Error('no picture');
  const scale = Math.min(1, side / Math.min(width, height), (LONG_CAP * side) / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
