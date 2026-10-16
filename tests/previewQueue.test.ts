import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPreviewQueue, TIMED_OUT, type Decoder } from '../src/ui/previewQueue';

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
