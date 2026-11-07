// Round 2 (UX writer): "Photos and videos from 214 days, 2019 to 2024." Days are separate
// calendar dates among the dated files; no-date files are counted on their own.
import { describe, expect, it } from 'vitest';
import { spanOf } from '../src/ui/span';
import { copy } from '../src/ui/copy';

const at = (...dates: (string | undefined)[]) => dates.map((takenAt) => ({ takenAt }));
const s = copy.save;

describe('span: days and years covered', () => {
  it('counts separate calendar dates, not files, and keeps no-date files apart', () => {
    const sp = spanOf(at('2024-06-28T09:00:00', '2024-06-28T21:30:00', '2024-06-27T10:00:00', undefined, '2019-12-31T23:59:00', undefined));
    expect(sp).toEqual({ days: 3, first: '2019-12', last: '2024-06', noDate: 2 });
  });

  it('works in any order and with nothing dated', () => {
    expect(spanOf(at('2021-03-02T00:00:00', '2020-01-05T00:00:00', '2021-03-02T12:00:00'))).toEqual({ days: 2, first: '2020-01', last: '2021-03', noDate: 0 });
    expect(spanOf(at(undefined, undefined))).toEqual({ days: 0, first: undefined, last: undefined, noDate: 2 });
    expect(spanOf([])).toEqual({ days: 0, first: undefined, last: undefined, noDate: 0 });
  });

  it('several years, one year, one month (save.span)', () => {
    expect(s.span(214, '2019-12', '2024-01', true)).toBe('Photos and videos from 214 days, 2019 to 2024.');
    expect(s.span(38, '2024-02', '2024-11', true)).toBe('Photos and videos from 38 days in 2024.');
    expect(s.span(12, '2024-06', '2024-06', true)).toBe('Photos and videos from 12 days in June 2024.');
    expect(s.span(1, '2024-06', '2024-06', true)).toBe('Photos and videos from 1 day in June 2024.');
    expect(s.span(1234, '2019-01', '2024-01', false)).toBe('Files from 1,234 days, 2019 to 2024.');
  });

  it('no-date line, benefit and the done line (save.spanNoDate, save.doneSpan)', () => {
    expect(s.spanNoDate(40)).toBe('Plus 40 with no date, kept together in their own folder.');
    expect(s.spanNoDate(1)).toBe('Plus 1 with no date, kept in its own folder.');
    expect(s.benefit).toBe('Once saved, they’re all in one place, sorted by date, ready to look through or back up.');
    expect(s.doneSpan(214, '2019-12', '2024-01')).toBe('That’s 214 days, from 2019 to 2024, now in one place.');
    expect(s.doneSpan(38, '2024-02', '2024-11')).toBe('That’s 38 days in 2024, now in one place.');
    expect(s.doneSpan(1, '2024-06', '2024-06')).toBe('That’s 1 day in June 2024, now in one place.');
  });

  it('never claims space comes back: saving makes new copies', () => {
    expect(s.needSpace('3.4 GB')).toBe('This makes new copies, so you’ll need at least 3.4 GB of free space.');
    expect(`${s.progress(1203, 2236)}${s.progressMonth('2021-06')}`).toBe('Saved 1,203 of 2,236 · now June 2021');
  });

  it('the Sort lede names the years (results.sortedLine)', () => {
    expect(copy.results.sortedLine('2019', '2024')).toBe('They’re sorted by the date each one was taken, from 2019 to 2024.');
    expect(copy.results.sortedLine('2024', '2024')).toBe('They’re sorted by the date each one was taken, in 2024.');
    expect(copy.results.sortedLine()).toBe('They’re sorted by the date each one was taken.');
  });
});
