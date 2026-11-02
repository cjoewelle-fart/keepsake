import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { FileRecord } from '../engine/types';
import { copy } from './copy';
import { playableHere } from './playable';
import { SKIPPED, type Lease } from './previewQueue';
import { createUrlPool, heicLarge, planFor, releaseLarge, viewerMaxSide, viewerOpened, type Plan, type UrlPool } from './viewerMedia';

const v = copy.viewer;

export type ViewerProps = {
  /** The files to step through, in the order shown behind the viewer. */
  ids: readonly number[];
  /** The one opened. */
  startId: number;
  record: (id: number) => FileRecord;
  files: readonly File[];
  /** The file's name on its tile: the photo's alt text, and (in Review) its checkbox's name. */
  label: (id: number) => string;
  /** A line under the date (in a set-aside group: the file's name and size). */
  detail?: (id: number) => string;
  /** Review: the file's own checkbox, doing exactly what the one on its tile does. */
  selected?: (id: number) => boolean;
  onSelect?: (id: number, on: boolean) => void;
  /** In a set-aside group: files there are not saved unless the group is kept, so notes say so. */
  aside?: boolean;
  /** Closed (Esc or Close). Gets the last file shown, so focus can go back to its tile. */
  onClose: (lastId: number) => void;
};

/**
 * "Click to see larger" (D24): one file at a time in a modal dialog, with Previous and Next.
 * Only the open file is decoded (and the next one made ready); everything it held is given back
 * as soon as it moves on or closes. Photos are the file itself, or for HEIC a screen-sized copy
 * from our own decoder; videos play from the file with the browser's controls, never on their own.
 */
export function Viewer({ ids, startId, record, files, label, detail, selected, onSelect, aside = false, onClose }: ViewerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState(() => Math.max(0, ids.indexOf(startId)));
  const i = Math.min(at, ids.length - 1);
  const id = ids[i];
  const shown = useRef(id);
  useEffect(() => { shown.current = id; }, [id]);
  const closed = useRef(onClose);
  useEffect(() => { closed.current = onClose; }, [onClose]);
  const pool = useMemo(() => createUrlPool(), []);
  // HEIC copies are made for this screen: its longer side in device pixels, at most 2048.
  const side = useMemo(() => viewerMaxSide(screen.width, screen.height, window.devicePixelRatio), []);

  useEffect(() => {
    const d = dialog.current!;
    const done = viewerOpened();
    if (!d.open) d.showModal();
    closeBtn.current?.focus();
    // A close event from an earlier open (React's development double mount) arrives once it's open again: ignore it.
    const onClosed = () => { if (!d.open) closed.current(shown.current); };
    d.addEventListener('close', onClosed);
    return () => {
      d.removeEventListener('close', onClosed);
      if (d.open) d.close();
      done();
    };
  }, []);

  // Make the next file ready while this one is looked at (photos only; a video loads when shown).
  const nextId = ids[i + 1];
  useEffect(() => {
    if (nextId === undefined) return;
    const r = record(nextId);
    const f = files[nextId];
    const plan = planFor(r, { playable: playableHere(r) });
    if (plan === 'native') {
      const img = new Image();
      img.decoding = 'async';
      img.src = pool.take(f);
      return () => { img.removeAttribute('src'); pool.give(f); };
    }
    if (plan === 'decode') {
      let alive = true;
      let lease: Lease | undefined;
      heicLarge(f, () => alive, side).then((l) => { if (alive) lease = l; else releaseLarge(l); }, () => {});
      return () => { alive = false; if (lease) releaseLarge(lease); };
    }
    return undefined;
  }, [nextId, record, files, pool, side]);

  const go = (to: number) => { if (to >= 0 && to < ids.length) setAt(to); };
  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    // Arrow keys on the video's own controls seek or change the volume.
    if (e.target instanceof HTMLMediaElement || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
  };

  if (id === undefined) return null;
  const r = record(id);
  const first = i === 0;
  const last = i === ids.length - 1;
  const arrow = (d: string) => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="icon"><path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return (
    // Keys are handled on the dialog so ← and → work wherever focus is inside it.
    <dialog ref={dialog} className="viewer" aria-labelledby="viewer-h" onKeyDown={onKeyDown}>
      <div className="viewer-top">
        <div className="viewer-title">
          <h2 id="viewer-h">{r.takenAt ? v.date(r.takenAt) : v.noDate}</h2>
          {detail && <p className="sub-sm">{detail(id)}</p>}
        </div>
        <p className="viewer-pos" aria-live="polite" aria-atomic="true">{v.position(i + 1, ids.length)}</p>
        <button ref={closeBtn} type="button" className="btn btn-secondary viewer-close" onClick={() => dialog.current?.close()}>{v.close}</button>
      </div>
      <div className="viewer-stage">
        <Media key={id} record={r} file={files[id]} alt={label(id)} pool={pool} side={side} aside={aside} />
      </div>
      <div className="viewer-bottom">
        <button type="button" className="btn btn-secondary viewer-step" aria-disabled={first || undefined} onClick={() => go(i - 1)}>
          {arrow('M10 3 5 8l5 5')}{v.previous}
        </button>
        {selected && onSelect && (
          <label className="viewer-chk">
            <input type="checkbox" checked={selected(id)} onChange={(e) => onSelect(id, e.target.checked)} aria-label={label(id)} />
            <span>{v.save}</span>
          </label>
        )}
        <button type="button" className="btn btn-secondary viewer-step" aria-disabled={last || undefined} onClick={() => go(i + 1)}>
          {v.next}{arrow('m6 3 5 5-5 5')}
        </button>
      </div>
    </dialog>
  );
}

type MediaProps = { record: FileRecord; file: File; alt: string; pool: UrlPool; side: number; aside: boolean };

/** One file in the viewer. Mounted per file, so moving on gives everything back. */
function Media({ record, file, alt, pool, side, aside }: MediaProps) {
  const [plan, setPlan] = useState<Plan>(() => planFor(record, { playable: playableHere(record) }));
  const [url, setUrl] = useState<string>();
  const video = useRef<HTMLVideoElement>(null);

  // The file itself (a photo the browser reads, or a video). A layout effect, so the URL is taken
  // before the preloader lets go of it, and the video is stopped and emptied before it's revoked.
  useLayoutEffect(() => {
    if (plan !== 'native' && plan !== 'video') return;
    const u = pool.take(file);
    const el = video.current;
    if (plan === 'video' && el) el.src = u;
    else setUrl(u);
    return () => {
      if (el) {
        el.pause();
        el.removeAttribute('src');
        el.load();
      }
      setUrl(undefined);
      pool.give(file);
    };
  }, [file, plan, pool]);

  // HEIC: a screen-sized copy from the viewer's own decoder.
  useEffect(() => {
    if (plan !== 'decode') return;
    let alive = true;
    let lease: Lease | undefined;
    const start = () => {
      heicLarge(file, () => alive, side).then(
        (l) => {
          if (!alive) return releaseLarge(l);
          lease = l;
          setUrl(l.url);
        },
        (err) => {
          if (!alive) return;
          if (err === SKIPPED) start(); // the preloader's request was dropped as it moved on: ask again
          else setPlan('none');
        },
      );
    };
    start();
    return () => {
      alive = false;
      if (lease) releaseLarge(lease);
      setUrl(undefined);
    };
  }, [file, plan, side]);

  const onImgError = () => setPlan(planFor(record, { nativeFailed: true }));

  if (plan === 'video') {
    // Never plays on its own; the browser's controls start it.
    return <video ref={video} className="viewer-media" controls preload="metadata" playsInline aria-label={alt} onError={() => setPlan('cant-play')} />;
  }
  if ((plan === 'native' || plan === 'decode') && url) {
    return <img className="viewer-media" src={url} alt={alt} decoding="async" onError={plan === 'native' ? onImgError : () => setPlan('none')} />;
  }
  if (plan === 'native' || plan === 'decode') {
    return <p className="viewer-msg" role="status">{v.loading}</p>;
  }
  const ext = record.path.split('.').pop()?.toUpperCase() ?? '';
  const note = plan === 'too-large' ? v.tooLarge(aside) : plan === 'cant-play' ? v.cantPlay(aside) : v.cantShow(aside);
  return (
    <div className="viewer-msg">
      <span className="tile-label">{ext || '—'}</span>
      <p>{note}</p>
    </div>
  );
}
