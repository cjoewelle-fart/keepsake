// T61: which videos get "Can't play in this browser. It can still be saved.", from the codec the scan read
// and the browser's canPlayType answers. The answer tables below stand in for real browsers.
import { describe, expect, it } from 'vitest';
import type { FileRecord } from '../src/engine/types';
import { copy } from '../src/ui/copy';
import { playable, type CanPlayType } from '../src/ui/playable';

/** A browser that says "probably" to the listed codecs (in any of `mimes`), and "maybe" to bare `bare` types. */
const browser = (mimes: string[], codecs: RegExp, bare: string[] = ['video/mp4']): CanPlayType => (t) => {
  const m = t.match(/^([^;]+)(?:; codecs="(.+)")?$/);
  if (!m) return '';
  const [, mime, codec] = m;
  if (!codec) return bare.includes(mime) ? 'maybe' : '';
  return mimes.includes(mime) && codecs.test(codec) ? 'probably' : '';
};
/** Chrome on a computer without HEVC decoding: H.264, VP9, AV1 in MP4; nothing for QuickTime or 3GPP types. */
const chromeNoHevc = browser(['video/mp4'], /^(avc1|avc3|vp09|av01)\./);
/** Chrome on a computer with HEVC decoding. */
const chromeHevc = browser(['video/mp4'], /^(avc1|avc3|vp09|av01|hvc1|hev1)\./);
/** Safari: H.264 and HEVC in MP4, QuickTime and 3GPP; MPEG-TS maybe. */
const safari = browser(['video/mp4', 'video/quicktime', 'video/3gpp'], /^(avc1|hvc1|hev1|mp4v)/, ['video/mp4', 'video/quicktime', 'video/mp2t']);
/** What the Playwright Chromium used by scripts/e2e.mjs answers (open-source codecs only: no H.264). */
const testChromium: CanPlayType = (t) =>
  t === 'video/mp4' ? 'maybe' : /codecs="(av01|vp09)\./.test(t) && t.startsWith('video/mp4') ? 'probably' : '';

const v = (kind: FileRecord['kind'], codec?: string) => ({ kind, codec });

describe('playable', () => {
  it('a phone H.264 video plays in Chrome and Safari, whatever the container', () => {
    for (const b of [chromeNoHevc, chromeHevc, safari]) {
      expect(playable(v('mp4', 'avc1.640028'), b)).toBe(true);
      expect(playable(v('mov', 'avc1.42001E'), b)).toBe(true); // Chrome only answers for video/mp4
      expect(playable(v('3gp', 'avc1.42C01E'), b)).toBe(true);
    }
  });

  it('HEVC plays only where the browser has it', () => {
    expect(playable(v('mov', 'hvc1.2.4.L123.B0'), chromeNoHevc)).toBe(false);
    expect(playable(v('mp4', 'hvc1.1.6.L93.B0'), chromeNoHevc)).toBe(false);
    expect(playable(v('mov', 'hvc1.2.4.L123.B0'), chromeHevc)).toBe(true);
    expect(playable(v('mov', 'hvc1.2.4.L123.B0'), safari)).toBe(true);
  });

  it('old phone and camera formats: H.263 3GP, Motion JPEG, AVI', () => {
    expect(playable(v('3gp', 's263'), chromeNoHevc)).toBe(false);
    expect(playable(v('3gp', 's263'), safari)).toBe(false);
    expect(playable(v('mov', 'jpeg'), chromeHevc)).toBe(false);
    expect(playable(v('mp4', 'mp4v.20'), chromeHevc)).toBe(false);
    expect(playable(v('mp4', 'mp4v.20'), safari)).toBe(true);
    expect(playable(v('avi'), chromeHevc)).toBe(false);
    expect(playable(v('avi'), safari)).toBe(false);
  });

  it('MPEG-TS (.mts) follows the browser', () => {
    expect(playable(v('mts'), chromeHevc)).toBe(false);
    expect(playable(v('mts'), safari)).toBe(true);
  });

  it('says nothing when it can\'t tell', () => {
    expect(playable(v('mp4'), chromeNoHevc)).toBeUndefined(); // no codec found
    expect(playable(v('mov'), () => '')).toBeUndefined();
    expect(playable(v('jpeg'), chromeNoHevc)).toBeUndefined(); // not a video
    expect(playable(v('mp4', 'avc1"; x="'), chromeNoHevc)).toBeUndefined(); // odd text isn't passed on
  });

  it('a browser that throws counts as "no" for that type only', () => {
    const throwsOnQt: CanPlayType = (t) => { if (t.startsWith('video/quicktime')) throw new Error('x'); return chromeHevc(t); };
    expect(playable(v('mov', 'avc1.42001E'), throwsOnQt)).toBe(true);
  });

  it('in the Chromium the end-to-end checks use, the real phone videos are labelled', () => {
    expect(playable(v('mov', 'avc1.42001E'), testChromium)).toBe(false);
    expect(playable(v('mp4', 'av01.0.08M.10'), testChromium)).toBe(true);
  });
});

describe('copy', () => {
  it('adds the note to the tile\'s name', () => {
    expect(copy.timeline.cantPlay).toBe('Can’t play in this browser. It can still be saved.');
    expect(copy.timeline.tileLabel('video', '2009-08-15T10:20:30', 1, 3, 2, true))
      .toBe('Save video from 15 August 2009, 10:20, 2 seconds long. Can’t play in this browser. It can still be saved.');
    expect(copy.timeline.tileLabel('video', undefined, 2, 3, undefined, true))
      .toBe('Save video with no date (2 of 3). Can’t play in this browser. It can still be saved.');
    expect(copy.timeline.tileLabel('video', undefined, 2, 3)).toBe('Save video with no date (2 of 3)');
  });
});
