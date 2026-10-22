// Checks the usability pilot's recovery folder (T65) against its answer key: every file lands in
// the expected group, no real photo or video is set aside, and the numbers the facilitator reads
// off the screens (team/research/pilot-folder.md) are what the app shows.
// python3 scripts/make_pilot_folder.py fixtures/pilot
// PILOT_DIR="fixtures/pilot/Recovered from old phone" PILOT_KEY=fixtures/pilot/pilot-key.json \
//   npx vitest run eval/pilot.eval.test.ts --silent=false
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { scanAll } from '../src/engine/scan';
import { summarize } from '../src/engine/summary';
import { PHOTO_KINDS } from '../src/engine/sniff';
import { buildSheet } from '../src/ui/contactSheet';
import { buildTimeline, inPlay } from '../src/ui/timeline';
import { fsSource, walk } from '../tests/fs-source';

const DIR = process.env.PILOT_DIR ?? 'fixtures/pilot/Recovered from old phone';
const KEY = process.env.PILOT_KEY ?? 'fixtures/pilot/pilot-key.json';

type Entry = { label: string; note: string; kind?: string; year?: number | null };
type Key = {
  summary: {
    files: number; groups: Record<string, number>; keep_photos: number; keep_videos: number;
    undated_photos: number; by_year: Record<string, { photos: number; videos: number }>;
  };
  files: Record<string, Entry>;
};

it.skipIf(!existsSync(KEY))('sorts the pilot folder exactly as its answer key says', async () => {
  const key: Key = JSON.parse(readFileSync(KEY, 'utf8'));
  const paths = walk(DIR);
  const recs = (await scanAll(paths.map((p) => fsSource(DIR, p))))!;

  const wrong: string[] = [];
  let realKeep = 0, wronglyAside = 0, inKeep = 0, junkInKeep = 0;
  for (const r of recs) {
    const e = key.files[r.path];
    if (!e) { wrong.push(`${r.path}: not in the answer key`); continue; }
    if (e.label === 'keep') { realKeep++; if (r.group !== 'keep') wronglyAside++; }
    if (r.group === 'keep') { inKeep++; if (e.label !== 'keep') junkInKeep++; }
    if (e.label !== r.group) wrong.push(`${r.path} ${r.size}B ${e.note}: expected ${e.label}, got ${r.group}/${r.reason}`);
    else if (e.label === 'keep' && (e.year ? Number(r.takenAt?.slice(0, 4)) !== e.year : r.takenAt !== undefined)) {
      wrong.push(`${r.path} ${e.note}: expected year ${e.year ?? 'none'}, got ${r.takenAt ?? 'none'}`);
    }
  }

  const s = summarize(recs);
  const withSmall = summarize(recs, new Set(['small']));
  const sheet = buildSheet(recs.filter((r) => r.group === 'keep' && PHOTO_KINDS.has(r.kind)));
  const tl = buildTimeline(inPlay(recs, new Set()));
  const inYear = (y: string) => tl.months.filter((m) => m.key.startsWith(y)).reduce((n, m) => n + m.ids.length, 0);
  const noDate = tl.months.filter((m) => m.key === 'none').reduce((n, m) => n + m.ids.length, 0);
  // If the tester kept "Small preview copies" in T3, those (undated) previews join the timeline too.
  const tl3 = buildTimeline(inPlay(recs, new Set(['small'])));
  const count3 = (y: string) => tl3.months.filter((m) => m.key.startsWith(y)).reduce((n, m) => n + m.ids.length, 0);
  const months2022 = tl.months.filter((m) => m.key.startsWith('2022')).map((m) => `${m.key}:${m.ids.length}`).reverse().join(' ');

  console.log(`\nFiles checked: ${s.total}; kept ${s.keep} (${s.photos} photos, ${s.videos} videos); set aside ${s.setAside}`, s.groups);
  console.log(`Real photos/videos wrongly set aside: ${wronglyAside}/${realKeep}`);
  console.log(`Known junk left in Keep: ${junkInKeep}/${inKeep}`);
  console.log(`Results screen: years ${sheet.years.map((y) => `${y.year}:${y.count}`).join(' ')}; No date chip ${sheet.undated.count}`);
  console.log(`After keeping Small preview copies: ${withSmall.keep} kept, ${withSmall.setAside} set aside`);
  console.log(`Review timeline: 2022 has ${inYear('2022')} files (${months2022}); No date has ${noDate}`);
  console.log(`Review timeline after keeping Small preview copies: 2022 has ${count3('2022')}; No date has ${count3('none')}`);
  if (wrong.length) console.log(wrong.join('\n'));

  const k = key.summary;
  expect(wrong).toEqual([]);
  expect(wronglyAside).toBe(0);
  expect(recs.length).toBe(k.files);
  expect(s.keep).toBe(k.groups.keep);
  expect(s.photos).toBe(k.keep_photos);
  expect(s.videos).toBe(k.keep_videos);
  expect(s.undated).toBe(k.undated_photos);
  expect(sheet.undated.count).toBe(k.undated_photos);
  for (const g of ['small', 'duplicate', 'damaged', 'system'] as const) expect(s.groups[g]).toBe(k.groups[g] ?? 0);
  expect(withSmall.keep).toBe(k.groups.keep + (k.groups.small ?? 0));
  for (const [y, c] of Object.entries(k.by_year)) {
    if (y === 'no date') { expect(noDate).toBe(c.photos + c.videos); continue; }
    expect(sheet.years.find((x) => x.year === y)?.count ?? 0).toBe(c.photos);
    expect(inYear(y)).toBe(c.photos + c.videos);
  }
}, 300_000);
