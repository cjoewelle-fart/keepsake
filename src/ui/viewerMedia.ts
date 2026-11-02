// The large-photo viewer's media (D24): what to show for one file, how big a HEIC decode to ask
// for, and the viewer's own small decode queue and URL pool. Kept apart from the tile previews so
// a large decode never pushes small ones out of their cache (or waits behind them), and so the
// viewer's memory can be given back in full when it closes. Nothing here fetches anything: every
// URL is a blob: URL for a file already on this computer.
import { PHOTO_KINDS, PREVIEWABLE, VIDEO_KINDS } from '../engine/sniff';
import type { FileRecord } from '../engine/types';
import { HEIC_PREVIEW_MAX_BYTES, startHeicDecoder } from './heicPreview';
import { createPreviewQueue, type Lease } from './previewQueue';
import { THUMB_MAX_BYTES } from './thumbs';

/** The longest side the viewer asks the HEIC decoder for, in device pixels. */
export const VIEWER_MAX_SIDE = 2048;

/**
 * How the viewer shows a file:
 * - native: the file itself in an <img> (photos the browser reads; on error, `decode` if it's HEIC).
 * - decode: HEIC through our own decoder, scaled to the screen.
 * - video: the file itself in a <video> with controls.
 * - too-large: a photo over the size limit for its path (the type label and a note instead).
 * - cant-play: a video this browser says it can't play.
 * - none: anything else (not a picture, or empty).
 */
export type Plan = 'native' | 'decode' | 'video' | 'too-large' | 'cant-play' | 'none';

export function planFor(r: Pick<FileRecord, 'kind' | 'size'>, opts: { nativeFailed?: boolean; playable?: boolean } = {}): Plan {
  if (!(r.size > 0)) return 'none';
  if (VIDEO_KINDS.has(r.kind)) return opts.playable === false ? 'cant-play' : 'video';
  if (!PHOTO_KINDS.has(r.kind)) return 'none';
  if (r.kind === 'heic' || opts.nativeFailed) {
    if (r.kind !== 'heic') return 'none';
    return r.size <= HEIC_PREVIEW_MAX_BYTES ? 'decode' : 'too-large';
  }
  if (!PREVIEWABLE.has(r.kind) && r.kind !== 'avif') return 'none'; // TIFF, RAW: no browser shows them
  return r.size <= THUMB_MAX_BYTES ? 'native' : 'too-large';
}

/** Is this file opened in the viewer at all (a photo or video, not a log or settings file)? */
export const viewable = (r: Pick<FileRecord, 'kind'>) => PHOTO_KINDS.has(r.kind) || VIDEO_KINDS.has(r.kind);

/** The HEIC decode size: the screen's longer side in device pixels, at most 2048. */
export function viewerMaxSide(screenW: number, screenH: number, dpr: number): number {
  const side = Math.round(Math.max(screenW || 0, screenH || 0) * (dpr > 0 ? dpr : 1));
  return Math.min(VIEWER_MAX_SIDE, Math.max(320, side || VIEWER_MAX_SIDE));
}

// The viewer's own decode queue: one decode at a time (the open photo, then the next one), and at
// most two finished copies kept. Everything it holds is given back when the viewer closes.
const queue = createPreviewQueue({ startDecoder: startHeicDecoder, concurrency: 1, maxCached: 2, timeoutMs: 30_000, idleMs: 20_000 });
let openViewers = 0;

/** A screen-sized JPEG of a HEIC photo, as a lease the viewer releases when it moves on. */
export const heicLarge = (file: Blob, isWanted: () => boolean, maxSide: number): Promise<Lease> =>
  queue.preview(file, isWanted, maxSide);

/** Release a lease; once no viewer is open, also give back every copy the queue still caches. */
export function releaseLarge(l: Lease) {
  l.release();
  if (openViewers === 0) queue.dropUnused();
}

/** Call when a viewer opens; the returned function when it closes. */
export function viewerOpened(): () => void {
  openViewers++;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    openViewers--;
    // After the media's own cleanups have released their leases.
    setTimeout(() => { if (openViewers === 0) queue.dropUnused(); }, 0);
  };
}

/**
 * blob: URLs for files the viewer shows, shared between the open item and the one preloaded next
 * to it, counted, and revoked as soon as neither uses it.
 */
export function createUrlPool(make: (b: Blob) => string = (b) => URL.createObjectURL(b), revoke: (u: string) => void = (u) => URL.revokeObjectURL(u)) {
  const urls = new Map<Blob, { url: string; users: number }>();
  return {
    take(b: Blob): string {
      let e = urls.get(b);
      if (!e) urls.set(b, (e = { url: make(b), users: 0 }));
      e.users++;
      return e.url;
    },
    give(b: Blob) {
      const e = urls.get(b);
      if (!e || --e.users > 0) return;
      urls.delete(b);
      revoke(e.url);
    },
    /** For tests: how many URLs are live. */
    live: () => urls.size,
  };
}
export type UrlPool = ReturnType<typeof createUrlPool>;
