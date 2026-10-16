import { useEffect, useRef, useState } from 'react';
import { PREVIEWABLE } from '../engine/sniff';
import type { Kind } from '../engine/sniff';
import type { FileRecord } from '../engine/types';
import { copy } from './copy';
import { HEIC_PREVIEW_MAX_BYTES, heicPreview } from './heicPreview';
import type { Lease } from './previewQueue';

/** Formats some browsers show natively and others don't: try the browser first. */
const MAYBE_NATIVE: ReadonlySet<Kind> = new Set(['heic', 'avif']);
/** Formats we can decode ourselves when the browser can't (libheif has no AV1 decoder here). */
const DECODABLE: ReadonlySet<Kind> = new Set(['heic']);

type Stage = 'native' | 'decode' | 'none';

/**
 * A small square preview made from the local file. Nothing is uploaded: the URL points at the file
 * on this computer. HEIC photos are shown natively where the browser can (Safari); elsewhere a small
 * copy is decoded in a background worker, only once the tile is on screen.
 */
export function Preview({ file, record, size = 'md' }: { file: File; record: FileRecord; size?: 'md' | 'sm' | 'xs' | 'fill' }) {
  const usable = record.size > 0;
  const initial: Stage = usable && (PREVIEWABLE.has(record.kind) || MAYBE_NATIVE.has(record.kind)) ? 'native' : 'none';
  const [stage, setStage] = useState<Stage>(initial);
  const [url, setUrl] = useState<string>();
  const tile = useRef<HTMLDivElement>(null);

  // Native: point an <img> at the file itself.
  useEffect(() => {
    if (stage !== 'native') return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, stage]);

  // Decode: wait until the tile is on screen, then ask the worker for a small JPEG.
  useEffect(() => {
    if (stage !== 'decode' || !tile.current) return;
    let alive = true;
    let visible = false;
    let started = false;
    let lease: Lease | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible || started) return;
      started = true;
      heicPreview(file, () => alive && visible)
        .then((l) => {
          if (!alive) return l.release();
          lease = l;
          setUrl(l.url);
        })
        .catch(() => {
          if (!alive) return;
          if (visible) setStage('none');
          else started = false; // skipped because it scrolled away: try again when it's back
        });
    }, { rootMargin: '200px' });
    observer.observe(tile.current);
    return () => {
      alive = false;
      observer.disconnect();
      lease?.release(); // the shared cache revokes the URL once it's evicted
    };
  }, [file, stage]);

  const onError = () => {
    setUrl(undefined);
    setStage(DECODABLE.has(record.kind) && record.size <= HEIC_PREVIEW_MAX_BYTES ? 'decode' : 'none');
  };

  const ext = record.path.split('.').pop()?.toUpperCase() ?? '';
  return (
    <div className={`tile tile-${size}`} ref={tile}>
      {stage !== 'none' && url ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={stage === 'native' ? onError : () => setStage('none')} />
      ) : (
        <span className="tile-label" title={stage === 'decode' ? undefined : copy.results.previewUnavailable}>{ext || '—'}</span>
      )}
    </div>
  );
}
