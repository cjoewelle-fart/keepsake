import { describe, expect, it } from 'vitest';
import { buildSheet, LIMITS } from '../src/ui/contactSheet';
import { summarize } from '../src/engine/summary';
import type { SetAsideGroup } from '../src/engine/summary';
import type { FileRecord, Group } from '../src/engine/types';
import { dayMonth, monthYear } from '../src/ui/copy';

let i = 0;
const photo = (takenAt?: string): FileRecord => ({ index: i++, path: `f${i}.jpg`, size: 1, kind: 'jpeg', takenAt, group: 'keep', reason: 'photo' });
const days = (ym: string, k: number) => Array.from({ length: k }, (_, d) => photo(`${ym}-${String((d % 28) + 1).padStart(2, '0')}T12:00:00`));

describe('contact sheet', () => {
  it('lists years newest first and shows the newest year by default', () => {
    const s = buildSheet([...days('2019-03', 3), ...days('2024-06', 10), ...days('2024-02', 2)]);
    expect(s.years).toEqual([{ year: '2024', count: 12 }, { year: '2019', count: 3 }]);
    expect(s.groups.map((g) => g.month)).toEqual(['2024-06', '2024-02']);
    expect(s.groups[0]).toMatchObject({ count: 10, big: true });
    expect(s.groups[0].tiles).toHaveLength(LIMITS.firstTiles);
    expect(s.groups[1].big).toBe(false);
  });

  it('every dated photo is either on a tile or counted in "see every month"', () => {
    const photos = [...days('2024-06', 30), ...days('2024-05', 9), ...days('2024-04', 7), ...days('2024-01', 4), ...days('2020-08', 50)];
    for (const y of [undefined, '2020']) {
      const s = buildSheet(photos, y);
      const shown = s.groups.reduce((n, g) => n + g.tiles.length, 0);
      expect(shown + s.moreDated).toBe(photos.length);
      expect(s.groups.length).toBeLessThanOrEqual(LIMITS.months);
    }
    // The last row leaves room for the "see every month" tile.
    expect(buildSheet(photos).groups[2].tiles).toHaveLength(LIMITS.tiles - 1);
    expect(buildSheet(photos, '2020').groups[0].tiles).toHaveLength(LIMITS.firstTiles - 1);
  });

  it('keeps undated photos in their own row, with a "see them all" count when there are many', () => {
    const few = buildSheet([photo(), photo(), ...days('2022-01', 1)]);
    expect(few.undated).toMatchObject({ count: 2, more: 0 });
    const many = buildSheet(Array.from({ length: 12 }, () => photo()));
    expect(many.years).toEqual([]);
    expect(many.groups).toEqual([]);
    expect(many.undated.tiles.length + many.undated.more).toBe(12);
  });

  it('formats camera dates as written, with no time zone shift', () => {
    expect(dayMonth('2024-06-01T00:30:00')).toBe('1 June');
    expect(monthYear('2019-12')).toBe('December 2019');
  });
});

describe('ledger', () => {
  it('kept + set aside always adds up to files checked, whatever is moved back', () => {
    const groups: Group[] = ['keep', 'small', 'small', 'duplicate', 'damaged', 'system', 'keep'];
    const recs = groups.map((group, k) => ({ ...photo(k % 2 ? '2021-01-01T00:00:00' : undefined), group, kind: group === 'system' ? 'other' : 'jpeg' } as FileRecord));
    const all: SetAsideGroup[] = ['small', 'duplicate', 'damaged', 'system'];
    for (let mask = 0; mask < 16; mask++) {
      const moved = new Set(all.filter((_, b) => mask & (1 << b)));
      const s = summarize(recs, moved);
      expect(s.keep + s.setAside).toBe(s.total);
    }
  });
});
