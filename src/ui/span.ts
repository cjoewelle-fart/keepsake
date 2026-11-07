// How much time a set of files covers, in real numbers (round 2, UX writer): "Photos and videos
// from 214 days, 2019 to 2024." Pure and framework-free so it can be tested in Node.
import type { FileRecord } from '../engine/types';

export type Span = {
  /** Separate calendar dates among the dated files. No-date files aren't counted here. */
  days: number;
  /** First and last month among the dated files ('YYYY-MM'), or undefined when none has a date. */
  first?: string;
  last?: string;
  /** Files with no date. */
  noDate: number;
};

/** One pass, holding only the set of day keys ('YYYY-MM-DD'), so it stays flat on 40,000 files. */
export function spanOf(files: Iterable<Pick<FileRecord, 'takenAt'>>): Span {
  const days = new Set<string>();
  let first: string | undefined;
  let last: string | undefined;
  let noDate = 0;
  for (const r of files) {
    if (!r.takenAt) { noDate++; continue; }
    const ymd = r.takenAt.slice(0, 10);
    days.add(ymd);
    if (first === undefined || ymd < first) first = ymd;
    if (last === undefined || ymd > last) last = ymd;
  }
  return { days: days.size, first: first?.slice(0, 7), last: last?.slice(0, 7), noDate };
}
