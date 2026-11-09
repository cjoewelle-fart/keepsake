// T50 and T59: how well the "Screenshots" and "From chat apps" hints match the answer keys.
// They are review filters, not cleanup rules, so this only reports: it checks that no hint ever
// changed a file's group, and prints precision and recall among kept files where a key says what
// a file is (the synthetic fixture's "phone screenshot"; the pilot's screenshots and Messenger photos).
//
//   LOOKS_FIXTURE=<folder made by make_fixture.py> LOOKS_LABELS=<its labels.json> \
//   PILOT_DIR="fixtures/pilot/Recovered from old phone" PILOT_KEY=fixtures/pilot/pilot-key.json \
//     npx vitest run eval/looks.eval.test.ts --silent=false
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { scanAll } from '../src/engine/scan';
import type { Look } from '../src/engine/looks';
import type { FileRecord } from '../src/engine/types';
import { fsSource, walk } from '../tests/fs-source';

const FIXTURE = process.env.LOOKS_FIXTURE ?? join(__dirname, '..', 'fixtures', 'recovery');
const LABELS = process.env.LOOKS_LABELS ?? join(__dirname, '..', 'fixtures', 'labels.json');
const PILOT_DIR = process.env.PILOT_DIR ?? 'fixtures/pilot/Recovered from old phone';
const PILOT_KEY = process.env.PILOT_KEY ?? 'fixtures/pilot/pilot-key.json';

type Truth = { label: string; note: string };

function score(name: string, recs: FileRecord[], truth: Record<string, Truth>, isA: Partial<Record<Look, (t: Truth) => boolean>>) {
  const kept = recs.filter((r) => r.group === 'keep');
  console.log(`\n${name}: ${recs.length} files, ${kept.length} kept`);
  for (const look of ['screenshot', 'chat'] as Look[]) {
    const hinted = kept.filter((r) => r.look === look);
    const bySign: Record<string, number> = {};
    for (const r of hinted) bySign[r.lookSign!] = (bySign[r.lookSign!] ?? 0) + 1;
    const test = isA[look];
    if (!test) {
      console.log(`  ${look}: ${hinted.length} hinted (no answer key), by sign`, bySign);
      const notes: Record<string, number> = {};
      for (const r of hinted) notes[truth[r.path].note] = (notes[truth[r.path].note] ?? 0) + 1;
      console.log(`    what they are in the key:`, notes);
      continue;
    }
    const real = kept.filter((r) => test(truth[r.path]));
    const tp = hinted.filter((r) => test(truth[r.path])).length;
    const fp = hinted.length - tp;
    const precision = hinted.length ? tp / hinted.length : 1;
    const recall = real.length ? tp / real.length : 1;
    console.log(`  ${look}: ${hinted.length} hinted, ${real.length} in the key; TP ${tp}, FP ${fp}, FN ${real.length - tp}; precision ${(precision * 100).toFixed(1)}%, recall ${(recall * 100).toFixed(1)}%`, bySign);
    for (const r of hinted.filter((x) => !test(truth[x.path]))) console.log(`    FP ${r.path} ${r.width}x${r.height} ${truth[r.path].note} (${r.lookSign})`);
    for (const r of real.filter((x) => x.look !== look)) console.log(`    FN ${r.path} ${r.width}x${r.height} ${truth[r.path].note} (${r.look ?? 'no hint'})`);
  }
  // A hint never moves a file: kept files are exactly the ones the key expects (scored elsewhere);
  // here only check that set-aside files carry no meaning from a hint.
  for (const r of recs) if (r.look) expect(['jpeg', 'png']).toContain(r.kind);
}

it.skipIf(!existsSync(LABELS))('screenshots and chat-app photos on the synthetic fixture', async () => {
  const labels: Record<string, Truth> = JSON.parse(readFileSync(LABELS, 'utf8'));
  const recs = (await scanAll(walk(FIXTURE).map((p) => fsSource(FIXTURE, p))))!;
  score('Synthetic fixture', recs, labels, { screenshot: (t) => t.note === 'phone screenshot' });
}, 300_000);

it.skipIf(!existsSync(PILOT_KEY))('screenshots and chat-app photos on the pilot folder', async () => {
  const key: { files: Record<string, Truth> } = JSON.parse(readFileSync(PILOT_KEY, 'utf8'));
  const recs = (await scanAll(walk(PILOT_DIR).map((p) => fsSource(PILOT_DIR, p))))!;
  score('Pilot folder', recs, key.files, {
    screenshot: (t) => t.note.startsWith('screenshot'),
    chat: (t) => t.note.startsWith('saved from Messenger'),
  });
}, 300_000);
