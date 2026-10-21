// Can this browser play a video? (T61) Asked without loading the video: the scan reads the
// codec from the file's 'stsd' box (engine/video.ts), and the browser's canPlayType answers for
// that codec. Nothing is fetched, nothing is decoded, and the file isn't opened again. (A hidden
// <video> trying the file would need the page's privacy policy to allow blob: media, and would
// read every video near the screen.) The answer only changes a label: every video is saved
// the same way, playable here or not.
import type { FileRecord } from '../engine/types';

/** HTMLMediaElement.canPlayType: '', 'maybe' or 'probably'. */
export type CanPlayType = (type: string) => string;

/**
 * MIME types to try per container. Chromium plays MP4, MOV and 3GP files through one MP4 reader
 * but only answers for 'video/mp4', and Safari also answers for QuickTime and 3GPP, so each is
 * asked as MP4 too. No browser plays AVI; Safari may play MPEG-TS (.mts).
 */
const TYPES: Partial<Record<FileRecord['kind'], string[]>> = {
  mp4: ['video/mp4'],
  mov: ['video/mp4', 'video/quicktime'],
  '3gp': ['video/mp4', 'video/3gpp'],
  avi: ['video/x-msvideo', 'video/avi'],
  mts: ['video/mp2t'],
};

/**
 * False when the browser says it can't play this video; true when it says it can; undefined
 * when we can't tell (no codec found in an MP4/MOV/3GP, or not a video). Unsure stays quiet.
 */
export function playable(r: Pick<FileRecord, 'kind' | 'codec'>, canPlayType: CanPlayType): boolean | undefined {
  const types = TYPES[r.kind];
  if (!types) return undefined;
  const boxed = r.kind === 'mp4' || r.kind === 'mov' || r.kind === '3gp';
  if (boxed && !r.codec) return undefined;
  // A codec string is only letters, digits and dots; anything else isn't asked about.
  if (r.codec && !/^[\w.]+$/.test(r.codec)) return undefined;
  const ask = (t: string) => { try { return canPlayType(t); } catch { return ''; } };
  return types.some((t) => ask(r.codec ? `${t}; codecs="${r.codec}"` : t) !== '');
}

let element: HTMLVideoElement | undefined;
const answers = new Map<string, boolean | undefined>();

/** `playable` for this browser, remembered per container and codec. */
export function playableHere(r: Pick<FileRecord, 'kind' | 'codec'>): boolean | undefined {
  if (typeof document === 'undefined') return undefined;
  const key = `${r.kind} ${r.codec ?? ''}`;
  if (!answers.has(key)) {
    element ??= document.createElement('video'); // never given a source or added to the page
    const v = element;
    answers.set(key, playable(r, (t) => v.canPlayType(t)));
  }
  return answers.get(key);
}
