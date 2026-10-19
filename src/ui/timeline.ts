// The review timeline ("Choose what to save"): which files are in play, how they're grouped by
// date, and which of them are selected. Pure and framework-free so it can be tested in Node.
//
// Selection is stored as the files the person has *unticked* (everything starts selected), in a
// byte per file keyed by FileRecord.index. That keeps it flat on 40,000+ files, and a group the
// person moves back to Keep on the Clean up step joins the selection without any extra work.
import { PHOTO_KINDS, VIDEO_KINDS } from '../engine/sniff';
import { effectiveGroup } from '../engine/summary';
import type { SetAsideGroup } from '../engine/summary';
import type { FileRecord } from '../engine/types';

export type MediaType = 'photo' | 'video' | 'other';
export const mediaType = (r: FileRecord): MediaType =>
  PHOTO_KINDS.has(r.kind) ? 'photo' : VIDEO_KINDS.has(r.kind) ? 'video' : 'other';

export type Filter = 'all' | 'photos' | 'videos' | 'unselected';

/** 'none' is the "No date" group; it always comes last. */
export const NO_DATE = 'none';

export type Day = {
  /** 'YYYY-MM-DD', or NO_DATE */
  key: string;
  /** FileRecord indices, in the order shown (earliest first within a day, like a film roll). */
  ids: number[];
};

export type Month = {
  /** 'YYYY-MM', or NO_DATE */
  key: string;
  days: Day[];
  /** Every id in the month, in display order. */
  ids: number[];
};

export type Timeline = {
  /** Newest first, then the "No date" month if any. */
  months: Month[];
  /** Years with dated files, newest first, each pointing at its months (newest first). */
  years: { year: string; months: string[] }[];
  /** Number of files shown (after the filter). */
  shown: number;
};

/** Every file that's kept after cleanup (including groups moved back to Keep), in record order. */
export function inPlay(records: readonly FileRecord[], movedBack: ReadonlySet<SetAsideGroup>): FileRecord[] {
  return records.filter((r) => effectiveGroup(r, movedBack) === 'keep');
}

const byTakenAtThenPath = (a: FileRecord, b: FileRecord) =>
  a.takenAt! < b.takenAt! ? -1 : a.takenAt! > b.takenAt! ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
const byPath = (a: FileRecord, b: FileRecord) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/**
 * Group files year → month → day, newest month and day first, "No date" last.
 * @param keep optional extra test (the "Not selected" filter passes a snapshot of the selection,
 *   so a file doesn't vanish from under the pointer the moment it's ticked).
 */
export function buildTimeline(files: readonly FileRecord[], filter: Filter = 'all', keep?: (r: FileRecord) => boolean): Timeline {
  const shownFiles = files.filter((r) => {
    if (filter === 'photos' && mediaType(r) !== 'photo') return false;
    if (filter === 'videos' && mediaType(r) !== 'video') return false;
    return keep ? keep(r) : true;
  });
  const dated = shownFiles.filter((r) => r.takenAt).sort(byTakenAtThenPath);
  const undated = shownFiles.filter((r) => !r.takenAt).sort(byPath);

  // Walk from the newest file back, opening a new day/month as the date changes; then put each
  // day's files back in time order.
  const months: Month[] = [];
  let month: Month | undefined;
  let day: Day | undefined;
  for (let k = dated.length - 1; k >= 0; k--) {
    const r = dated[k];
    const ym = r.takenAt!.slice(0, 7);
    const ymd = r.takenAt!.slice(0, 10);
    if (!month || month.key !== ym) {
      month = { key: ym, days: [], ids: [] };
      months.push(month);
      day = undefined;
    }
    if (!day || day.key !== ymd) {
      day = { key: ymd, ids: [] };
      month.days.push(day);
    }
    day.ids.push(r.index);
  }
  for (const m of months) {
    for (const d of m.days) d.ids.reverse();
    m.ids = m.days.flatMap((d) => d.ids);
  }
  if (undated.length) {
    const ids = undated.map((r) => r.index);
    months.push({ key: NO_DATE, days: [{ key: NO_DATE, ids }], ids });
  }

  const years: Timeline['years'] = [];
  for (const m of months) {
    if (m.key === NO_DATE) continue;
    const y = m.key.slice(0, 4);
    if (years.at(-1)?.year !== y) years.push({ year: y, months: [] });
    years.at(-1)!.months.push(m.key);
  }
  return { months, years, shown: shownFiles.length };
}

/** A piece of a month the screen renders (or holds a placeholder for) as one unit. */
export type Block = {
  /** Unique within the timeline. */
  key: string;
  day: Day;
  /** This block's share of the day's ids. */
  ids: number[];
  /** Position of this block's first id within the day. */
  start: number;
  /** The first block of a day carries the day's heading and checkbox. */
  first: boolean;
};

/** Split a month into blocks: one per day, with very big days (and "No date") cut into chunks. */
export function blocksOf(m: Month, chunk = 60): Block[] {
  const out: Block[] = [];
  for (const d of m.days) {
    for (let s = 0; s < d.ids.length; s += chunk) {
      out.push({ key: `${d.key}:${s}`, day: d, ids: d.ids.slice(s, s + chunk), start: s, first: s === 0 });
    }
  }
  return out;
}

export type TriState = 'all' | 'none' | 'some';

/** Which files are selected. Mutable (for speed); the UI bumps a version number after each change. */
export class Selection {
  /** 1 = unticked. Indexed by FileRecord.index. */
  private off: Uint8Array;
  constructor(size: number) {
    this.off = new Uint8Array(size);
  }
  has(id: number): boolean {
    return this.off[id] === 0;
  }
  /** Tick or untick every id. Returns how many changed. */
  set(ids: Iterable<number>, on: boolean): number {
    const v = on ? 0 : 1;
    let changed = 0;
    for (const id of ids) {
      if (this.off[id] !== v) { this.off[id] = v; changed++; }
    }
    return changed;
  }
  count(ids: readonly number[]): number {
    let c = 0;
    for (const id of ids) if (this.off[id] === 0) c++;
    return c;
  }
  state(ids: readonly number[]): TriState {
    const c = this.count(ids);
    return c === 0 ? 'none' : c === ids.length ? 'all' : 'some';
  }
  /** Tri-state checkbox click: anything less than all → all; all → none. */
  toggle(ids: readonly number[]): void {
    this.set(ids, this.state(ids) !== 'all');
  }
  /** A frozen copy, for the "Not selected" filter. */
  snapshot(): (id: number) => boolean {
    const copy = this.off.slice();
    return (id) => copy[id] === 0;
  }
}

export type Tally = {
  total: number;
  selected: number;
  notSelected: number;
  selectedBytes: number;
  selectedPhotos: number;
  selectedVideos: number;
};

/** The numbers in the ledger. Always: selected + notSelected = total. */
export function tally(files: readonly FileRecord[], sel: Selection): Tally {
  let selected = 0, selectedBytes = 0, selectedPhotos = 0, selectedVideos = 0;
  for (const r of files) {
    if (!sel.has(r.index)) continue;
    selected++;
    selectedBytes += r.size;
    const t = mediaType(r);
    if (t === 'photo') selectedPhotos++;
    else if (t === 'video') selectedVideos++;
  }
  return { total: files.length, selected, notSelected: files.length - selected, selectedBytes, selectedPhotos, selectedVideos };
}

/** The ids to hand to the save step, in timeline order (newest first, "No date" last). */
export function selectedIds(files: readonly FileRecord[], sel: Selection): number[] {
  return buildTimeline(files).months.flatMap((m) => m.ids).filter((id) => sel.has(id));
}

/** Grid columns for a given timeline width (CSS pixels). The CSS reads the same number. */
export const columnsFor = (width: number) => (width >= 600 ? 6 : width >= 460 ? 4 : 3);
