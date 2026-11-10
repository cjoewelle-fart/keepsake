import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SetAsideGroup } from '../src/engine/summary';
import { summarize } from '../src/engine/summary';
import type { FileRecord, Group } from '../src/engine/types';
import { NO_DATE, Selection, blocksOf, buildTimeline, chunks, columnsFor, filterCounts, inPlay, largestFirst, leftOutKind, selectedIds, tally } from '../src/ui/timeline';
import { bytes, copy, runTime, runTimeWords, weekdayDayMonth } from '../src/ui/copy';

let i = 0;
const rec = (takenAt: string | undefined, kind: FileRecord['kind'] = 'jpeg', group: Group = 'keep', size = 1000): FileRecord =>
  ({ index: i++, path: `recup_dir.1/f${String(i).padStart(7, '0')}.${kind}`, size, kind, takenAt, group, reason: group === 'keep' ? 'photo' : 'copy' });

describe('timeline grouping', () => {
  it('groups year → month → day, newest first, "No date" last; within a day earliest first', () => {
    const a = rec('2024-06-28T14:32:00');
    const b = rec('2024-06-28T09:12:00');
    const c = rec('2024-06-23T08:02:00');
    const d = rec('2019-03-01T10:00:00');
    const e = rec(undefined);
    const v = rec('2024-05-02T11:40:00', 'mp4');
    const tl = buildTimeline([d, e, a, c, b, v]);
    expect(tl.months.map((m) => m.key)).toEqual(['2024-06', '2024-05', '2019-03', NO_DATE]);
    expect(tl.months[0].days.map((x) => x.key)).toEqual(['2024-06-28', '2024-06-23']);
    expect(tl.months[0].days[0].ids).toEqual([b.index, a.index]);
    expect(tl.months[0].ids).toEqual([b.index, a.index, c.index]);
    expect(tl.years).toEqual([{ year: '2024', months: ['2024-06', '2024-05'] }, { year: '2019', months: ['2019-03'] }]);
    expect(tl.shown).toBe(6);
  });

  it('every file is in exactly one day', () => {
    const files = Array.from({ length: 500 }, (_, k) => rec(k % 7 === 0 ? undefined : `20${10 + (k % 12)}-${String((k % 12) + 1).padStart(2, '0')}-${String((k % 28) + 1).padStart(2, '0')}T12:00:00`));
    const tl = buildTimeline(files);
    const all = tl.months.flatMap((m) => m.days.flatMap((d) => d.ids));
    expect(all.length).toBe(files.length);
    expect(new Set(all).size).toBe(files.length);
  });

  it('filters photos, videos and (from a snapshot) not selected', () => {
    const p = rec('2024-01-01T00:00:00');
    const v = rec('2024-01-02T00:00:00', 'mov');
    const o = rec(undefined, 'other', 'keep');
    const files = [p, v, o];
    expect(buildTimeline(files, 'photos').shown).toBe(1);
    expect(buildTimeline(files, 'videos').months[0].ids).toEqual([v.index]);
    const sel = new Selection(i);
    sel.set([v.index], false);
    const snap = sel.snapshot();
    sel.set([v.index], true); // ticking it again later doesn't change the snapshot
    expect(buildTimeline(files, 'unselected', (r) => !snap(r.index)).months.flatMap((m) => m.ids)).toEqual([v.index]);
  });

  it('includes set-aside groups the person moved back to Keep', () => {
    const k = rec('2024-01-01T00:00:00');
    const dup = rec('2024-01-01T00:00:01', 'jpeg', 'duplicate');
    const sys = rec(undefined, 'other', 'system');
    const none = new Set<SetAsideGroup>();
    const back = new Set<SetAsideGroup>(['duplicate', 'system']);
    expect(inPlay([k, dup, sys], none)).toEqual([k]);
    expect(inPlay([k, dup, sys], back)).toEqual([k, dup, sys]);
    // Same number as the Sort screen's "Kept".
    expect(inPlay([k, dup, sys], back).length).toBe(summarize([k, dup, sys], back).keep);
  });

  it('cuts big days into blocks that keep their place in the day', () => {
    const files = Array.from({ length: 130 }, (_, k) => rec(`2024-06-28T10:${String(k % 60).padStart(2, '0')}:00`));
    const [m] = buildTimeline(files).months;
    const blocks = blocksOf(m, 60);
    expect(blocks.map((b) => [b.ids.length, b.start, b.first])).toEqual([[60, 0, true], [60, 60, false], [10, 120, false]]);
    expect(blocks.flatMap((b) => b.ids)).toEqual(m.ids);
  });
});

describe('screenshot and chat-app filters (T50, T59)', () => {
  const shot = { ...rec('2023-02-01T10:00:00', 'png'), look: 'screenshot' as const, lookSign: 'screen-size' as const };
  const chat = { ...rec(undefined), look: 'chat' as const, lookSign: 'jfif-no-exif' as const };
  const plain = rec('2023-02-02T10:00:00');
  const vid = rec('2023-02-03T10:00:00', 'mp4');
  const files = [shot, chat, plain, vid];

  it('show only the files with that hint, in both orders', () => {
    expect(buildTimeline(files, 'screenshots').months.flatMap((m) => m.ids)).toEqual([shot.index]);
    expect(buildTimeline(files, 'chat').months.flatMap((m) => m.ids)).toEqual([chat.index]);
    expect(buildTimeline(files, 'chat').shown).toBe(1);
    expect(largestFirst(files, 'screenshots')).toEqual([shot.index]);
  });

  it('never touch the selection: everything is still selected and saved', () => {
    const sel = new Selection(i);
    buildTimeline(files, 'screenshots');
    buildTimeline(files, 'chat');
    expect(tally(files, sel).selected).toBe(4);
    expect(selectedIds(files, sel)).toHaveLength(4);
  });

  // QA: the active filter never changes what is saved. There's no DOM test setup in this repo, so
  // this drives the same pure functions Timeline.tsx uses: the view comes from buildTimeline /
  // largestFirst with the filter, and Save hands over selectedIds(kept, sel), which has no filter.
  it('with Screenshots or From chat apps on, Save gets every selected kept file, shown or not', () => {
    const allOrder = buildTimeline(files).months.flatMap((m) => m.ids);
    for (const filter of ['screenshots', 'chat'] as const) {
      const sel = new Selection(i);
      const shown = buildTimeline(files, filter).months.flatMap((m) => m.ids);
      expect(shown.length).toBeGreaterThan(0);
      expect(shown.length).toBeLessThan(files.length); // some kept files are hidden by the filter
      expect(selectedIds(files, sel)).toEqual(allOrder); // nothing ticked off: all of them, hidden ones too
      expect(largestFirst(files, filter)).toEqual(shown); // the other order shows the same files
      sel.set([shown[0]], false); // untick one in the filtered view
      const saved = selectedIds(files, sel);
      expect(saved).toEqual(allOrder.filter((id) => id !== shown[0]));
      expect(saved).toEqual(files.map((r) => r.index).filter((id) => sel.has(id)).sort((a, b) => allOrder.indexOf(a) - allOrder.indexOf(b)));
    }
  });
  it('Timeline.tsx saves selectedIds(kept, sel), never the filtered view', () => {
    const src = readFileSync(join(__dirname, '../src/ui/Timeline.tsx'), 'utf8');
    const calls = src.match(/onSave\(([^)]*\)?)\)/g) ?? [];
    expect(calls).toEqual(['onSave(selectedIds(kept, sel))']);
  });

  it('count every filter for the chips; Not selected follows ticks as they happen', () => {
    const sel = new Selection(i);
    expect(filterCounts(files, sel)).toEqual({ all: 4, photos: 3, videos: 1, unselected: 0, screenshots: 1, chat: 1 });
    sel.set([shot.index], false);
    expect(filterCounts(files, sel).unselected).toBe(1);
    expect(filterCounts(files, sel).screenshots).toBe(1); // unticking doesn't take it out of its filter
  });

  it('copy: neutral names, a count, and plain words that nothing is removed', () => {
    const t = copy.timeline;
    expect(t.filters.chat).toBe('From chat apps');
    expect(t.filters.screenshots).toBe('Screenshots');
    expect(t.showing(4, 1234)).toBe('Showing 4 of 1,234.');
    expect(t.filterCountUnit(1)).toBe(' file'); // m4: read after the chip's number, not shown
    expect(t.filterCountUnit(4)).toBe(' files');
    expect(t.filterOnlyShows).toMatch(/only changes what you see/);
    expect(t.filterOnlyShows).toMatch(/Nothing is unselected or deleted/);
    for (const words of [t.filters.chat, t.lookNote.chat]) expect(words).not.toMatch(/junk|spam|clutter|low.quality|remove/i);
    expect(t.lookNote.chat).toMatch(/family photos worth keeping/);
  });
});

describe('selection', () => {
  const files = [rec('2024-06-28T09:00:00', 'jpeg', 'keep', 100), rec('2024-06-28T10:00:00', 'mp4', 'keep', 2000), rec('2024-06-27T10:00:00', 'jpeg', 'keep', 30), rec(undefined, 'jpeg', 'keep', 5)];
  const size = i;

  it('starts with everything selected, and the ledger adds up', () => {
    const sel = new Selection(size);
    expect(tally(files, sel)).toEqual({
      total: 4, selected: 4, notSelected: 0, selectedBytes: 2135, selectedPhotos: 3, selectedVideos: 1,
      notSelectedBytes: 0, notSelectedPhotos: 0, notSelectedVideos: 0,
    });
  });

  it('unticks and ticks a single file', () => {
    const sel = new Selection(size);
    expect(sel.set([files[1].index], false)).toBe(1);
    expect(sel.set([files[1].index], false)).toBe(0);
    const s = tally(files, sel);
    expect([s.selected, s.notSelected, s.selectedBytes, s.selectedVideos]).toEqual([3, 1, 135, 0]);
    sel.set([files[1].index], true);
    expect(tally(files, sel).selected).toBe(4);
  });

  it('a day checkbox is tri-state: some → all, all → none', () => {
    const sel = new Selection(size);
    const day = buildTimeline(files).months[0].days[0].ids;
    expect(sel.state(day)).toBe('all');
    sel.set([day[0]], false);
    expect(sel.state(day)).toBe('some');
    sel.toggle(day);
    expect(sel.state(day)).toBe('all');
    sel.toggle(day);
    expect(sel.state(day)).toBe('none');
    const s = tally(files, sel);
    expect(s.selected + s.notSelected).toBe(s.total);
    expect(s.selected).toBe(2);
  });

  it('round 2: says how much smaller leaving files out makes the save, and what they are', () => {
    const sel = new Selection(size);
    // files: photo 100, video 2000, photo 30, photo (no date) 5
    sel.set([files[0].index, files[2].index], false);
    let s = tally(files, sel);
    expect([s.notSelected, s.notSelectedBytes, s.notSelectedPhotos, s.notSelectedVideos]).toEqual([2, 130, 2, 0]);
    expect(s.selectedBytes + s.notSelectedBytes).toBe(2135);
    expect(leftOutKind(s)).toBe('photo');
    expect(copy.timeline.leftOutSize(s.notSelected, bytes(s.notSelectedBytes), leftOutKind(s))).toBe('Leaving out 2 photos makes your save 130 bytes smaller.');
    sel.set([files[0].index, files[2].index], true);
    sel.set([files[1].index], false);
    s = tally(files, sel);
    expect(leftOutKind(s)).toBe('video');
    expect(copy.timeline.leftOutSize(1, bytes(s.notSelectedBytes), leftOutKind(s))).toBe('Leaving out 1 video makes your save 2 KB smaller.');
    sel.set([files[0].index], false);
    s = tally(files, sel);
    expect(leftOutKind(s)).toBe('file'); // a photo and a video: "files"
    expect(copy.timeline.leftOutSize(18, '12 MB', 'file')).toBe('Leaving out 18 files makes your save 12 MB smaller.');
    expect(copy.timeline.leftOutSize(1, '3 MB', 'photo')).toBe('Leaving out 1 photo makes your save 3 MB smaller.');
  });

  it('select none / select all, and the ids handed to saving are in timeline order', () => {
    const sel = new Selection(size);
    const all = files.map((r) => r.index);
    sel.set(all, false);
    expect(tally(files, sel).selected).toBe(0);
    expect(selectedIds(files, sel)).toEqual([]);
    sel.set(all, true);
    expect(selectedIds(files, sel)).toEqual([files[0].index, files[1].index, files[2].index, files[3].index]);
  });

  it('handles 40,000 files quickly', () => {
    const many = Array.from({ length: 40_000 }, (_, k) => rec(k % 10 === 0 ? undefined : `20${String(10 + (k % 15))}-${String((k % 12) + 1).padStart(2, '0')}-${String((k % 28) + 1).padStart(2, '0')}T${String(k % 24).padStart(2, '0')}:00:00`));
    const t0 = performance.now();
    const tl = buildTimeline(many);
    const sel = new Selection(i);
    sel.toggle(tl.months[0].ids);
    const s = tally(many, sel);
    const ms = performance.now() - t0;
    expect(s.selected + s.notSelected).toBe(40_000);
    expect(s.notSelected).toBe(tl.months[0].ids.length);
    expect(ms).toBeLessThan(1500);
  });
});

describe('largest first (T60)', () => {
  const big = rec('2024-06-28T09:00:00', 'mp4', 'keep', 48_000_000);
  const mid = rec(undefined, 'jpeg', 'keep', 3_400_000);
  const small = rec('2019-01-01T10:00:00', 'jpeg', 'keep', 840_000);
  const tieA = rec('2020-01-01T10:00:00', 'jpeg', 'keep', 3_400_000);
  const vid = rec('2021-05-05T10:00:00', 'mov', 'keep', 120_000_000);
  const files = [small, mid, big, tieA, vid];

  it('sorts every shown file by size, biggest first, with a fixed order for equal sizes', () => {
    const ids = largestFirst(files);
    expect(ids).toEqual([vid.index, big.index, mid.index < tieA.index ? mid.index : tieA.index, mid.index < tieA.index ? tieA.index : mid.index, small.index]);
    // Same files, same order, whatever order they came in.
    expect(largestFirst([...files].reverse())).toEqual(ids);
    // Dated and undated files are in one list (no "No date last" here).
    expect(new Set(ids)).toEqual(new Set(files.map((r) => r.index)));
  });

  it('applies the same filters as the date view', () => {
    expect(largestFirst(files, 'videos')).toEqual([vid.index, big.index]);
    expect(largestFirst(files, 'photos')).toEqual(largestFirst(files).filter((id) => id !== vid.index && id !== big.index));
    const sel = new Selection(i);
    sel.set([small.index, vid.index], false);
    const snap = sel.snapshot();
    sel.set([vid.index], true); // ticked again: still listed under Not selected until the filter changes
    expect(largestFirst(files, 'unselected', (r) => !snap(r.index))).toEqual([vid.index, small.index]);
    // The same files as the date view shows, just in another order.
    for (const f of ['all', 'photos', 'videos'] as const) {
      expect([...largestFirst(files, f)].sort()).toEqual(buildTimeline(files, f).months.flatMap((m) => m.ids).sort());
    }
  });

  it('ticking in the size list keeps the ledger and selected size right, and doesn’t change what is saved otherwise', () => {
    const sel = new Selection(i);
    const ids = largestFirst(files);
    const before = selectedIds(files, sel);
    // Unselect the two biggest, as someone short of space would.
    sel.set([ids[0]], false);
    sel.set([ids[1]], false);
    const s = tally(files, sel);
    expect(s.selected + s.notSelected).toBe(s.total);
    expect(s.selectedBytes).toBe(3_400_000 * 2 + 840_000);
    expect(s.selectedVideos).toBe(0);
    // Saving gets exactly the files still selected, in date order as before.
    expect(selectedIds(files, sel)).toEqual(before.filter((id) => id !== vid.index && id !== big.index));
    sel.set(ids, true);
    expect(tally(files, sel).selectedBytes).toBe(files.reduce((a, r) => a + r.size, 0));
  });

  it('chunks the list for lazy drawing without losing or repeating a file', () => {
    const ids = Array.from({ length: 123 }, (_, k) => k);
    const c = chunks(ids, 50);
    expect(c.map((b) => b.length)).toEqual([50, 50, 23]);
    expect(c.flat()).toEqual(ids);
    expect(chunks([], 50)).toEqual([]);
  });

  it('sorts 40,000 files quickly', () => {
    const many = Array.from({ length: 40_000 }, (_, k) => rec(k % 9 === 0 ? undefined : '2022-02-02T10:00:00', k % 5 === 0 ? 'mp4' : 'jpeg', 'keep', ((k * 7919) % 100_000) * 1000));
    const t0 = performance.now();
    const ids = largestFirst(many);
    const ms = performance.now() - t0;
    expect(ids.length).toBe(40_000);
    const byId = new Map(many.map((r) => [r.index, r.size]));
    for (let k = 1; k < ids.length; k++) expect(byId.get(ids[k - 1])! >= byId.get(ids[k])!).toBe(true);
    expect(ms).toBeLessThan(1000);
  });
});

describe('timeline words', () => {
  it('formats dates, sizes and checkbox names', () => {
    expect(weekdayDayMonth('2024-06-28')).toBe('Friday 28 June');
    expect(bytes(999)).toBe('999 bytes');
    expect(bytes(1_500_000)).toBe('1.5 MB');
    expect(bytes(9_800_000_000)).toBe('9.8 GB');
    // T60: sizes on the Largest first rows.
    expect(bytes(48_000_000)).toBe('48 MB');
    expect(bytes(48_400_000)).toBe('48.4 MB');
    expect(bytes(840_000)).toBe('840 KB');
    expect(bytes(1)).toBe('1 byte');
    expect(bytes(0)).toBe('0 bytes');
    expect(bytes(1_000_000_000_000)).toBe('1 TB');
    expect(bytes(123_456_789)).toBe('123 MB');
    expect(copy.timeline.sizeRowLabel(bytes(48_000_000), copy.timeline.tileLabel('video', '2024-06-28T11:40:00', 1, 1, 42)))
      .toBe('48 MB. Save video from 28 June 2024, 11:40, 42 seconds long');
    expect(copy.timeline.footerSize(bytes(9_800_000_000))).toBe('9.8 GB to save');
    expect(copy.timeline.tileLabel('photo', '2024-06-28T09:12:00', 1, 6)).toBe('Save photo from 28 June 2024, 09:12');
    expect(copy.timeline.tileLabel('video', '2024-06-28T11:40:00', 4, 6)).toBe('Save video from 28 June 2024, 11:40');
    expect(copy.timeline.tileLabel('photo', undefined, 3, 312)).toBe('Save photo with no date (3 of 312)');
    expect(copy.timeline.tileLabel('video', '2024-06-28T11:40:00', 4, 6, 42.4)).toBe('Save video from 28 June 2024, 11:40, 42 seconds long');
    expect(copy.timeline.tileLabel('video', undefined, 1, 2, 65)).toBe('Save video with no date (1 of 2), 1 minute 5 seconds long');
    // Largest first (T60 QA): no place in the date view.
    expect(copy.timeline.sizeRowLabel('6 MB', copy.timeline.tileLabel('video', undefined, undefined, undefined, 42)))
      .toBe('6 MB. Save video with no date, 42 seconds long');
    // T89 QA (a11y): rows with the same size, kind and date differ by the file's own name.
    const same = copy.timeline.tileLabel('video', undefined, undefined, undefined, 42);
    expect(copy.timeline.sizeRowLabel('5.9 MB', same, 'f0012345.mov')).toBe('5.9 MB, f0012345.mov. Save video with no date, 42 seconds long');
    expect(copy.timeline.sizeRowLabel('5.9 MB', same, 'f0012345.mov')).not.toBe(copy.timeline.sizeRowLabel('5.9 MB', same, 'f0012346.mov'));
    expect(copy.viewer.open(copy.timeline.sizeRowOpen(same, 'f0012345.mov'))).toBe('View larger: Save video with no date, 42 seconds long, f0012345.mov');
    expect(copy.timeline.tileLabel('photo', '2024-06-28T09:12:00', 1, 6, 9)).toBe('Save photo from 28 June 2024, 09:12');
    expect([0.2, 42, 59.6, 600, 725, 3723, 7200].map(runTime)).toEqual(['0:01', '0:42', '1:00', '10:00', '12:05', '1:02:03', '2:00:00']);
    expect([1, 60, 61, 3600, 3723].map(runTimeWords)).toEqual(['1 second', '1 minute', '1 minute 1 second', '1 hour', '1 hour 2 minutes']);
    // Round 2: the button says what happens; the number is the footer's selected count.
    expect(copy.timeline.save(0)).toBe('Save my photos and videos');
    expect(copy.timeline.save(1)).toBe('Save my 1 photo or video');
    expect(copy.timeline.save(2224)).toBe('Save my 2,224 photos and videos');
    expect(copy.timeline.save(2224, false)).toBe('Save my 2,224 files');
    expect(copy.timeline.save(0, false)).toBe('Save my files');
  });

  it('chooses columns by width', () => {
    expect([columnsFor(360), columnsFor(500), columnsFor(676)]).toEqual([3, 4, 6]);
  });
});
