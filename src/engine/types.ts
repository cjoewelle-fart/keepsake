import type { Kind } from './sniff';
import type { Look, LookSign } from './looks';

/** Where a file ended up after cleanup. Order here = display order of set-aside groups. */
export type Group = 'keep' | 'small' | 'duplicate' | 'damaged' | 'system';
export const SET_ASIDE_GROUPS: readonly Exclude<Group, 'keep'>[] = ['small', 'duplicate', 'damaged', 'system'];

/** Why a file was put in its group. The UI turns these into plain words. */
export type Reason =
  | 'photo' | 'video'
  /** Kept because it couldn't be read; we never hide a file we couldn't check. */
  | 'not-checked'
  | 'not-media' | 'empty-file' | 'cut-off' | 'unreadable'
  | 'tiny-file' | 'low-resolution'
  | 'copy';

export type FileRecord = {
  /** Position in the list of files the scan was given. */
  index: number;
  path: string;
  size: number;
  kind: Kind;
  width?: number;
  height?: number;
  /** Camera make and model from the photo's own details, if any. */
  camera?: string;
  /**
   * When the photo or video was taken, as 'YYYY-MM-DDTHH:mm:ss'. Photos: camera local time.
   * Videos: local time from QuickTime's creationdate when present, otherwise the container's
   * creation time, which is meant to be UTC (some cameras write local time there instead).
   */
  takenAt?: string;
  /** Videos: length in seconds, from the container's 'mvhd' (or 'mehd'). Not set for cut-off videos. */
  durationSec?: number;
  /**
   * Videos: the codec of the picture track, as a 'codecs' string (RFC 6381) the page can pass
   * to the browser's canPlayType, e.g. 'avc1.64001F' or 'hvc1.2.4.L123.B0' (T61).
   */
  codec?: string;
  /**
   * T50/T59: what the photo looks like it is (a screenshot, or a photo sent through a chat app),
   * for the review screen's "Show only" filters. A hint, never a cleanup rule: it never changes
   * the group or the selection. `lookSign` says which sign gave it (see engine/looks.ts).
   */
  look?: Look;
  lookSign?: LookSign;
  group: Group;
  reason: Reason;
  /** For copies: the index of the file that was kept. */
  copyOf?: number;
};

/** Anything the scanner can read bytes from: a browser File or a file on disk in tests. */
export type FileSource = {
  path: string;
  size: number;
  read(start: number, end: number): Promise<Uint8Array>;
};

export type Rules = {
  /** Photos smaller than this many bytes are treated as previews (unless they have camera details). */
  smallBytes: number;
  /** Photos whose shorter side is under this many pixels are treated as previews (same exception). */
  minShortSide: number;
};

export const DEFAULT_RULES: Rules = { smallBytes: 20_000, minShortSide: 400 };

export type Progress = { stage: 'checking' | 'copies'; done: number; total: number };
