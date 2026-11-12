import { useEffect, useRef, useState } from 'react';
import { PREVIEWABLE } from '../engine/sniff';
import type { Kind } from '../engine/sniff';
import type { FileRecord } from '../engine/types';
import { copy } from './copy';
import { HEIC_PREVIEW_MAX_BYTES, heicPreview } from './heicPreview';
import { SKIPPED, type Lease } from './previewQueue';
import { THUMB_MAX_BYTES, thumbnail, thumbsSupported } from './thumbs';
import { thumbSide } from './thumbSize';

/** Formats some browsers show natively and others don't: try the browser first. */
const MAYBE_NATIVE: ReadonlySet<Kind> = new Set(['heic', 'avif']);
/** Formats we can decode ourselves when the browser can't (libheif has no AV1 decoder here). */
const DECODABLE: ReadonlySet<Kind> = new Set(['heic']);

/**
 * - thumb: a small copy made by the browser's own decoder in a worker (T53). The usual case.
 * - native: an <img> pointed at the file itself (when the browser can't make small copies, or
 *   its decoder refused the file but an <img> might still show it).
 * - decode: HEIC decoded by our own libheif worker (Chrome, Edge, Firefox).
 */
type Stage = 'thumb' | 'native' | 'decode' | 'none';

const canDecode = (r: FileRecord) => DECODABLE.has(r.kind) && r.size <= HEIC_PREVIEW_MAX_BYTES;

function firstStage(r: FileRecord): Stage {
  if (!(r.size > 0) || !(PREVIEWABLE.has(r.kind) || MAYBE_NATIVE.has(r.kind))) return 'none';
  return thumbsSupported() && r.size <= THUMB_MAX_BYTES ? 'thumb' : 'native';
}

// One shared observer for every tile waiting on a preview: start once within ~half a screen.
const NEAR = '600px 0px';
const watchers = new Map<Element, (near: boolean, tilePx: number) => void>();
let shared: IntersectionObserver | undefined;
function watch(el: Element, cb: (near: boolean, tilePx: number) => void) {
  shared ??= new IntersectionObserver((entries) => {
    for (const e of entries) watchers.get(e.target)?.(e.isIntersecting, Math.max(e.boundingClientRect.width, e.boundingClientRect.height));
  }, { rootMargin: NEAR });
  watchers.set(el, cb);
  shared.observe(el);
  return () => { shared?.unobserve(el); watchers.delete(el); };
}

/**
 * A small square preview made from the local file. Nothing is uploaded: photos are scaled down
 * on this computer in a background worker, only once the tile is near the screen, and the copy
 * is given back (to a capped cache) when the tile goes away. The full-size photo is never kept
 * in the page. HEIC photos the browser can't read are decoded by our own worker instead.
 */
export function Preview({ file, record, size = 'md', note, noteShort, onNoPreview }: {
  file: File; record: FileRecord; size?: 'md' | 'sm' | 'xs' | 'fill';
  /** UX11: told whether the tile ended up with no preview, so its owner can say so in the tile's name. */
  onNoPreview?: (none: boolean) => void;
  /** A short line under the file type when there's no picture (e.g. "Can’t play in this browser"). Hidden from screen readers: say it in the tile's name too. */
  note?: string;
  /** A shorter `note` for small timeline tiles (under 120 px wide), switched in by CSS (T69). */
  noteShort?: string;
}) {
  const [stage, setStage] = useState<Stage>(() => firstStage(record));
  // Callers pass a state setter, which keeps its identity, so this runs when the stage changes.
  useEffect(() => { onNoPreview?.(stage === 'none'); }, [stage, onNoPreview]);
  const [url, setUrl] = useState<string>();
  /** A small copy has been drawn into the canvas. */
  const [drawn, setDrawn] = useState(false);
  const tile = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // Native: point an <img> at the file itself.
  useEffect(() => {
    if (stage !== 'native') return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, stage]);

  // Thumb or decode: wait until the tile is near the screen, then ask a worker for a small copy
  // and draw it into the tile's canvas. A canvas, not an <img>: the browser keeps decoded copies
  // of every <img> it has shown (up to ~1,000 of them), but a canvas's pixels go when it does.
  useEffect(() => {
    const c = canvas.current;
    if ((stage !== 'thumb' && stage !== 'decode') || !tile.current || !c) return;
    let alive = true;
    let near = false;
    let started = false;
    let side = 0;
    let lease: Lease | undefined;
    const wanted = () => alive && near;
    // Small copies are sized to the tile on this screen. HEIC decodes stay 320 px on the longer
    // side: the size of the copy iPhones store in the file, which is what makes them quick (T54).
    const make = () => stage === 'thumb' ? thumbnail(file, wanted, side) : heicPreview(file, wanted);
    const start = () => {
      if (!alive || !near || started) return;
      started = true;
      make()
        .then(async (l) => {
          if (!alive) return l.release();
          lease = l;
          const bitmap = await createImageBitmap(l.blob); // a few kB of JPEG, decoded off the main thread
          if (!alive) return bitmap.close();
          c.width = bitmap.width;
          c.height = bitmap.height;
          // A plain in-memory canvas: a GPU one per tile would make hundreds of layers to scroll.
          c.getContext('2d', { willReadFrequently: true })?.drawImage(bitmap, 0, 0);
          bitmap.close();
          setDrawn(true);
        })
        .catch((err) => {
          if (!alive) return;
          // Scrolled away before its turn: try again when it's back (or now, if it already is).
          if (err === SKIPPED) { started = false; start(); return; }
          if (stage === 'decode') setStage('none');
          else if (!thumbsSupported()) setStage('native'); // this browser can't make copies: as before T53
          // The browser's decoder refused it: HEIC goes to our own decoder; anything else gets one
          // try as a plain <img>, which can still show some files (a cut-off JPEG's top part).
          else setStage(canDecode(record) ? 'decode' : 'native');
        });
    };
    const stop = watch(tile.current, (v, px) => {
      near = v;
      side ||= thumbSide(px, window.devicePixelRatio);
      start();
    });
    return () => {
      alive = false;
      stop();
      lease?.release(); // the shared cache drops the copy once it's evicted
      c.width = 0; // give the canvas's pixels back now, not at the next garbage collection
      c.height = 0;
      setDrawn(false);
    };
  }, [file, record, stage]);

  const onError = () => {
    setUrl(undefined);
    setStage(canDecode(record) ? 'decode' : 'none');
  };

  const ext = record.path.split('.').pop()?.toUpperCase() ?? '';
  const small = stage === 'thumb' || stage === 'decode';
  const showing = small ? drawn : stage === 'native' && !!url;
  return (
    <div className={`tile tile-${size}`} ref={tile}>
      {small && <canvas ref={canvas} aria-hidden="true" style={drawn ? undefined : { display: 'none' }} />}
      {stage === 'native' && url && <img src={url} alt="" loading="lazy" decoding="async" onError={onError} />}
      {!showing && <span className="tile-label" title={stage === 'none' ? copy.results.previewUnavailable : undefined}>{ext || '—'}{stage === 'none' && <span className="sr-only">{copy.results.noPreviewAfterType}</span>}</span>}
      {!showing && note && (noteShort
        ? <span className="tile-note" aria-hidden="true"><span className="tile-note-long">{note}</span><span className="tile-note-short">{noteShort}</span></span>
        : <span className="tile-note" aria-hidden="true">{note}</span>)}
    </div>
  );
}
