import { describe, expect, it } from 'vitest';
import { createPreviewQueue, type Decoder } from '../src/ui/previewQueue';
import { HEIC_PREVIEW_MAX_BYTES } from '../src/ui/heicPreview';
import { THUMB_MAX_BYTES } from '../src/ui/thumbs';
import { createUrlPool, planFor, viewable, viewerMaxSide } from '../src/ui/viewerMedia';

describe('large-photo viewer (D24)', () => {
  it('shows photos the browser reads as the file itself, HEIC through our decoder, and says why when it cannot', () => {
    expect(planFor({ kind: 'jpeg', size: 3_000_000 })).toBe('native');
    expect(planFor({ kind: 'avif', size: 3_000_000 })).toBe('native');
    expect(planFor({ kind: 'heic', size: 2_000_000 })).toBe('decode');
    expect(planFor({ kind: 'heic', size: HEIC_PREVIEW_MAX_BYTES + 1 })).toBe('too-large');
    expect(planFor({ kind: 'jpeg', size: THUMB_MAX_BYTES + 1 })).toBe('too-large');
    // The browser refused it: only HEIC has somewhere else to go.
    expect(planFor({ kind: 'jpeg', size: 1000 }, { nativeFailed: true })).toBe('none');
    expect(planFor({ kind: 'avif', size: 1000 }, { nativeFailed: true })).toBe('none');
    expect(planFor({ kind: 'tiff', size: 1000 })).toBe('none');
    expect(planFor({ kind: 'jpeg', size: 0 })).toBe('none');
    expect(planFor({ kind: 'other', size: 1000 })).toBe('none');
  });

  it('plays videos unless the browser says it cannot', () => {
    expect(planFor({ kind: 'mp4', size: 1000 })).toBe('video');
    expect(planFor({ kind: 'mp4', size: 1000 }, { playable: true })).toBe('video');
    expect(planFor({ kind: '3gp', size: 1000 }, { playable: false })).toBe('cant-play');
  });

  it('opens photos and videos only', () => {
    expect(viewable({ kind: 'heic' })).toBe(true);
    expect(viewable({ kind: 'mov' })).toBe(true);
    expect(viewable({ kind: 'other' })).toBe(false);
    expect(viewable({ kind: 'empty' })).toBe(false);
  });

  it('decodes HEIC at the longer screen side in device pixels, at most 2048', () => {
    expect(viewerMaxSide(390, 844, 3)).toBe(2048);
    expect(viewerMaxSide(1280, 800, 1)).toBe(1280);
    expect(viewerMaxSide(800, 1280, 1.5)).toBe(1920);
    expect(viewerMaxSide(0, 0, 0)).toBe(2048);
  });

  it('shares one URL per file between the open photo and the preloaded one, and revokes it when neither uses it', () => {
    const revoked: string[] = [];
    let n = 0;
    const pool = createUrlPool(() => `blob:v-${++n}`, (u) => revoked.push(u));
    const a = new Blob(['a']);
    const preload = pool.take(a);
    const shown = pool.take(a);
    expect(shown).toBe(preload);
    pool.give(a);
    expect(revoked).toEqual([]);
    pool.give(a);
    expect(revoked).toEqual([preload]);
    expect(pool.live()).toBe(0);
  });

  it('gives back every cached copy nobody shows when the viewer closes', async () => {
    const revoked: string[] = [];
    let n = 0;
    const startDecoder = (): Decoder => ({ decode: async () => new Blob(['jpeg']), terminate: () => {} });
    const q = createPreviewQueue({ startDecoder, maxCached: 2, createUrl: () => `blob:h-${++n}`, revokeUrl: (u) => revoked.push(u) });
    const held = await q.preview(new Blob(['a']), () => true, 2048);
    (await q.preview(new Blob(['b']), () => true, 2048)).release();
    q.dropUnused();
    expect(revoked).toEqual(['blob:h-2']); // the one still showing is kept
    held.release();
    q.dropUnused();
    expect(revoked).toEqual(['blob:h-2', 'blob:h-1']);
    expect(q.stats().urls).toBe(0);
  });
});
