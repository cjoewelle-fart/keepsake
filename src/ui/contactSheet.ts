// Lays out the results screen's contact sheet: which photos get a tile, grouped by month.
// Pure and framework-free so it can be tested in Node. Tile counts are capped so the screen
// never holds more than a couple of dozen previews, however many photos were found.
import type { FileRecord } from '../engine/types';

export type MonthGroup = {
  /** 'YYYY-MM' */
  month: string;
  /** Every kept photo taken that month. */
  count: number;
  tiles: FileRecord[];
  /** The first group opens with one large (2x2) tile. */
  big: boolean;
};

export type Sheet = {
  /** Years that have dated photos, newest first, with how many each has. */
  years: { year: string; count: number }[];
  /** Month groups for the chosen year, newest first. */
  groups: MonthGroup[];
  /** Dated photos (any year) that have no tile on screen. */
  moreDated: number;
  undated: { count: number; tiles: FileRecord[]; more: number };
};

export const LIMITS = { months: 3, firstTiles: 7, tiles: 5 } as const;

/** Pick k items spread evenly through a list (so tiles span the whole month). */
export const spread = <T>(xs: readonly T[], k: number): T[] =>
  xs.length <= k ? [...xs] : Array.from({ length: k }, (_, i) => xs[Math.floor((i * xs.length) / k)]);

/**
 * @param photos kept photos only (no videos or other files)
 * @param year the year chip that's selected; defaults to the newest year
 */
export function buildSheet(photos: readonly FileRecord[], year?: string): Sheet {
  const byMonth = new Map<string, FileRecord[]>();
  const undated: FileRecord[] = [];
  for (const r of photos) {
    if (!r.takenAt) { undated.push(r); continue; }
    const m = r.takenAt.slice(0, 7);
    const list = byMonth.get(m);
    if (list) list.push(r); else byMonth.set(m, [r]);
  }
  const months = [...byMonth.keys()].sort().reverse();
  const yearCounts = new Map<string, number>();
  for (const m of months) yearCounts.set(m.slice(0, 4), (yearCounts.get(m.slice(0, 4)) ?? 0) + byMonth.get(m)!.length);
  const years = [...yearCounts.entries()].map(([y, count]) => ({ year: y, count }));
  const chosen = year && yearCounts.has(year) ? year : years[0]?.year;

  const datedTotal = photos.length - undated.length;
  const groups: MonthGroup[] = months
    .filter((m) => m.startsWith(chosen ?? '-'))
    .slice(0, LIMITS.months)
    .map((m, i) => {
      const list = byMonth.get(m)!.slice().sort((a, b) => a.takenAt!.localeCompare(b.takenAt!));
      return { month: m, count: list.length, tiles: spread(list, i === 0 ? LIMITS.firstTiles : LIMITS.tiles), big: i === 0 };
    });
  let shown = groups.reduce((n, g) => n + g.tiles.length, 0);
  // Room for the "see every month" tile at the end of the last row.
  const last = groups[groups.length - 1];
  if (last && datedTotal > shown && last.tiles.length === (last.big ? LIMITS.firstTiles : LIMITS.tiles)) {
    last.tiles = last.tiles.slice(0, -1);
    shown--;
  }

  const undatedTiles = undated.length <= LIMITS.tiles ? undated : spread(undated, LIMITS.tiles - 1);
  return {
    years,
    groups,
    moreDated: datedTotal - shown,
    undated: { count: undated.length, tiles: undatedTiles, more: undated.length - undatedTiles.length },
  };
}
