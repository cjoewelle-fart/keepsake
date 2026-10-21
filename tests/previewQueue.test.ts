import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPreviewQueue, SKIPPED, TIMED_OUT, type Decoder, type Lease } from '../src/ui/previewQueue';
import { jpegScale, thumbSide, thumbSize } from '../src/ui/thumbSize';

const THUMB_SIDE = 160;

/** A fake worker: `hang` files never finish decoding, everything else decodes at once. */
function fakeWorkers(hang: Set<Blob> = new Set()) {
  const started: { terminated: boolean; decoded: number }[] = [];
  const startDecoder = (): Decoder => {
    const w = { terminated: false, decoded: 0 };
    started.push(w);
    return {
      decode: (file) => {
        if (w.terminated) return Promise.reject(new Error('worker is gone'));
        if (hang.has(file)) return new Promise<Blob>(() => {});
        w.decoded++;
        return Promise.resolve(new Blob(['jpeg']));
      },
      terminate: () => { w.terminated = true; },
    };
  };
  return { started, startDecoder };
}

let urls = 0;
const revoked: string[] = [];
const urlOpts = { createUrl: () => `blob:preview-${++urls}`, revokeUrl: (u: string) => { revoked.push(u); } };
const yes = () => true;

describe('HEIC preview time limit', () => {
  beforeEach(() => { vi.useFakeTimers(); revoked.length = 0; });
  afterEach(() => vi.useRealTimers());

  it('abandons a hung decode after 15 s, replaces the worker, and later previews still work', async () => {
    const bad = new Blob(['odd']);
    const w = fakeWorkers(new Set([bad]));
    const q = createPreviewQueue({ startDecoder: w.startDecoder, ...urlOpts });
    const hung = q.preview(bad, yes);
    const next = q.preview(new Blob(['ok']), yes); // queued behind the hung one
    const outcome = hung.then(() => 'shown', (e) => e);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(w.started[0].terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await outcome).toBe(TIMED_OUT); // the tile falls back to its extension label
    expect(w.started[0].terminated).toBe(true);
    const lease = await next;
    expect(lease.url).toMatch(/^blob:/);
    expect(w.started).toHaveLength(2); // a fresh worker did the next one
    expect(w.started[1].decoded).toBe(1);
  });

  it('does not retry a file that timed out', async () => {
    const bad = new Blob(['odd']);
    const w = fakeWorkers(new Set([bad]));
    const q = createPreviewQueue({ startDecoder: w.startDecoder, timeoutMs: 1000, ...urlOpts });
    const first = q.preview(bad, yes).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await first).toBe(TIMED_OUT);
    await expect(q.preview(bad, yes)).rejects.toBe(TIMED_OUT);
    expect(w.started).toHaveLength(1);
  });

  it('stops the worker when idle', async () => {
    const w = fakeWorkers();
    const q = createPreviewQueue({ startDecoder: w.startDecoder, idleMs: 20_000, ...urlOpts });
    (await q.preview(new Blob(['a']), yes)).release();
    expect(q.stats().running).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect([q.stats().running, w.started[0].terminated]).toEqual([false, true]);
  });
});

describe('HEIC preview cache', () => {
  beforeEach(() => { revoked.length = 0; });

  it('keeps at most maxCached previews and revokes the URLs it drops', async () => {
    const w = fakeWorkers();
    const q = createPreviewQueue({ startDecoder: w.startDecoder, maxCached: 200, ...urlOpts });
    const files = Array.from({ length: 1000 }, (_, i) => new Blob([`f${i}`]));
    const shown: string[] = [];
    for (const f of files) {
      const lease = await q.preview(f, yes);
      shown.push(lease.url);
      lease.release(); // scrolled away
    }
    expect(q.stats().cached).toBe(200);
    expect(revoked).toEqual(shown.slice(0, 800)); // oldest first
  });

  it('never revokes a URL a tile is still showing, and reuses recent ones', async () => {
    const w = fakeWorkers();
    const q = createPreviewQueue({ startDecoder: w.startDecoder, maxCached: 2, ...urlOpts });
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((s) => new Blob([s]));
    const onScreen = await q.preview(a, yes); // held
    (await q.preview(b, yes)).release();
    (await q.preview(c, yes)).release();
    (await q.preview(d, yes)).release();
    expect(revoked).not.toContain(onScreen.url);
    expect(q.stats().cached).toBe(2);
    const again = await q.preview(d, yes);
    expect(w.started[0].decoded).toBe(4); // d came from the cache
    again.release();
    onScreen.release();
    expect(revoked).not.toContain(onScreen.url); // still within the cap
    (await q.preview(new Blob(['e']), yes)).release();
    expect(revoked).toContain(onScreen.url); // now the oldest one nobody is showing
  });
});

/** Fake workers whose decodes finish only when the test says so, to watch how many run at once. */
function manualWorkers() {
  const pending: { file: Blob; done: () => void }[] = [];
  let running = 0, most = 0, started = 0;
  const startDecoder = (): Decoder => {
    started++;
    return {
      decode: (file) => new Promise<Blob>((resolve) => {
        running++;
        most = Math.max(most, running);
        pending.push({ file, done: () => { running--; resolve(new Blob(['jpeg'])); } });
      }),
      terminate: () => {},
    };
  };
  return { pending, startDecoder, most: () => most, started: () => started };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('small tile previews (T53)', () => {
  beforeEach(() => { revoked.length = 0; });

  it('runs at most `concurrency` decodes at once, each in its own worker', async () => {
    const w = manualWorkers();
    const q = createPreviewQueue({ startDecoder: w.startDecoder, concurrency: 2, ...urlOpts });
    const jobs = Array.from({ length: 6 }, (_, i) => q.preview(new Blob([`p${i}`]), yes, THUMB_SIDE));
    for (let k = 0; k < 6; k++) {
      await settle();
      expect(w.pending.length).toBeLessThanOrEqual(2);
      w.pending.shift()!.done();
    }
    const leases = await Promise.all(jobs);
    expect(new Set(leases.map((l) => l.url)).size).toBe(6);
    expect(w.most()).toBe(2);
    expect(w.started()).toBe(2);
  });

  it('skips tiles that scrolled away before their turn, and makes them again when they come back', async () => {
    const w = manualWorkers();
    const q = createPreviewQueue({ startDecoder: w.startDecoder, concurrency: 1, ...urlOpts });
    const near = new Map<Blob, boolean>();
    const files = Array.from({ length: 20 }, (_, i) => new Blob([`s${i}`]));
    files.forEach((f) => near.set(f, true));
    const results = files.map((f) => q.preview(f, () => near.get(f)!).then((l) => l, (e) => e));
    await settle();
    // A fast flick: everything after the first has gone off screen before it's started.
    files.slice(1).forEach((f) => near.set(f, false));
    w.pending.shift()!.done();
    const out = await Promise.all(results);
    expect((out[0] as Lease).url).toMatch(/^blob:/);
    expect(out.slice(1).every((x) => x === SKIPPED)).toBe(true);
    expect(w.pending).toHaveLength(0); // no work was done for them
    expect(q.stats().cached).toBe(1);
    near.set(files[5], true);
    const back = q.preview(files[5], () => near.get(files[5])!);
    await settle();
    w.pending.shift()!.done();
    expect((await back).url).toMatch(/^blob:/);
  });

  it('scrolling through 40,000 photos keeps memory flat: only the cap plus what is on screen', async () => {
    const decodes = { n: 0 };
    const startDecoder = (): Decoder => ({ decode: () => { decodes.n++; return Promise.resolve(new Blob(['jpeg'])); }, terminate: () => {} });
    const q = createPreviewQueue({ startDecoder, concurrency: 2, maxCached: 300, ...urlOpts });
    const files = Array.from({ length: 40_000 }, (_, i) => new Blob([`t${i}`]));
    const SCREEN = 60; // tiles near the screen at once
    const shown: Lease[] = [];
    let most = 0;
    for (let i = 0; i < files.length; i++) {
      shown.push(await q.preview(files[i], yes, THUMB_SIDE));
      if (shown.length > SCREEN) shown.shift()!.release(); // scrolled far away
      const s = q.stats();
      most = Math.max(most, s.urls);
      expect(s.inUse).toBeLessThanOrEqual(SCREEN);
    }
    expect(most).toBeLessThanOrEqual(300 + SCREEN);
    expect(q.stats().urls).toBe(300);
    expect(revoked).toHaveLength(40_000 - 300);
    const gone = new Set(revoked);
    for (const l of shown) expect(gone.has(l.url)).toBe(false); // still on screen
    // Scrolling back up a little reuses the cached copies instead of decoding again.
    const before = decodes.n;
    for (const f of files.slice(-200)) (await q.preview(f, yes, THUMB_SIDE)).release();
    expect(decodes.n).toBe(before);
    for (const l of shown) l.release();
  });

  it('sizes copies to fill a square tile: shorter side = the tile in device pixels, never enlarged', () => {
    expect(thumbSide(140, 1)).toBe(160);
    expect(thumbSide(140, 2)).toBe(320);
    expect(thumbSide(290, 1)).toBe(320); // the contact sheet's big print
    expect(thumbSide(34, 1)).toBe(160); // never below 160
    expect(thumbSide(400, 3)).toBe(480); // never above 480
    expect(thumbSide(0, 0)).toBe(160); // not laid out yet: an ordinary tile
    expect(thumbSize(4032, 3024, 160)).toEqual({ width: 213, height: 160 });
    expect(thumbSize(3024, 4032, 160)).toEqual({ width: 160, height: 213 }); // portrait (already turned upright)
    expect(thumbSize(8000, 100, 160)).toEqual({ width: 480, height: 6 }); // panorama: long side capped at 3x
    expect(thumbSize(200, 150, 160)).toEqual({ width: 200, height: 150 }); // already small: kept as is
    expect(() => thumbSize(0, 10, 160)).toThrow();
    // JPEGs decode straight to 1/8, 1/4 or 1/2 size when that still fills the tile.
    expect(jpegScale(4032, 3024, 160)).toBe(8); // 504 x 378
    expect(jpegScale(4032, 3024, 320)).toBe(8); // 378 >= 320
    expect(jpegScale(4032, 3024, 480)).toBe(4);
    expect(jpegScale(1296, 968, 160)).toBe(4);
    expect(jpegScale(640, 480, 320)).toBe(1);
  });

  it('keeps one copy per file and size', async () => {
    const w = fakeWorkers();
    const q = createPreviewQueue({ startDecoder: w.startDecoder, ...urlOpts });
    const f = new Blob(['x']);
    const a = await q.preview(f, yes, 160);
    const b = await q.preview(f, yes, 320);
    const c = await q.preview(f, yes, 160);
    expect(a.url).toBe(c.url);
    expect(a.url).not.toBe(b.url);
    expect(w.started[0].decoded).toBe(2);
  });
});

describe('third-party notices', () => {
  it('lists every runtime dependency and the code compiled into libheif-js', () => {
    const notices = readFileSync(new URL('../public/THIRD_PARTY_NOTICES.txt', import.meta.url), 'utf8');
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    for (const name of Object.keys(pkg.dependencies)) {
      const { version } = JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8'));
      expect(notices, `${name} ${version} missing: run npm run notices`).toContain(`\n${name} ${version}\n`);
    }
    expect(notices).toContain('GNU LESSER GENERAL PUBLIC LICENSE');
    expect(notices).toContain('The library `libde265` is distributed under the terms of the GNU Lesser General Public License.');
    expect(notices).toContain('Jean-loup Gailly        Mark Adler');
  });
});
