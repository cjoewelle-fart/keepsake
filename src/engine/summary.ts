import { PHOTO_KINDS, VIDEO_KINDS } from './sniff';
import type { FileRecord, Group } from './types';
import { SET_ASIDE_GROUPS } from './types';

export type SetAsideGroup = Exclude<Group, 'keep'>;

/** The group a file is shown in, after the user's "Move back to Keep" choices. */
export const effectiveGroup = (r: FileRecord, movedBack: ReadonlySet<SetAsideGroup>): Group =>
  r.group !== 'keep' && movedBack.has(r.group) ? 'keep' : r.group;

export type Summary = {
  total: number;
  keep: number;
  photos: number;
  videos: number;
  /** Non-photo, non-video files the user moved back to Keep. */
  others: number;
  undated: number;
  firstYear?: number;
  lastYear?: number;
  setAside: number;
  groups: Record<SetAsideGroup, number>;
};

export function summarize(records: FileRecord[], movedBack: ReadonlySet<SetAsideGroup> = new Set()): Summary {
  const groups = { small: 0, duplicate: 0, damaged: 0, system: 0 } as Record<SetAsideGroup, number>;
  let photos = 0, videos = 0, others = 0, undated = 0;
  let firstYear: number | undefined, lastYear: number | undefined;
  for (const r of records) {
    if (r.group !== 'keep') groups[r.group]++;
    if (effectiveGroup(r, movedBack) !== 'keep') continue;
    if (PHOTO_KINDS.has(r.kind)) photos++;
    else if (VIDEO_KINDS.has(r.kind)) videos++;
    else others++;
    // Year range counts photos only, matching the Review-by-year rows (videos have their own row
    // there until the review timeline places them by date).
    if (r.takenAt && PHOTO_KINDS.has(r.kind)) {
      const y = Number(r.takenAt.slice(0, 4));
      firstYear = firstYear === undefined ? y : Math.min(firstYear, y);
      lastYear = lastYear === undefined ? y : Math.max(lastYear, y);
    } else if (PHOTO_KINDS.has(r.kind)) {
      undated++;
    }
  }
  const keep = photos + videos + others;
  const setAside = SET_ASIDE_GROUPS.reduce((n, g) => n + (movedBack.has(g) ? 0 : groups[g]), 0);
  return { total: records.length, keep, photos, videos, others, undated, firstYear, lastYear, setAside, groups };
}
