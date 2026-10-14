// Scores the engine on real PhotoRec output from a wiped virtual SD card.
// CARD_DIR=<photorec output> CARD_TRUTH=<card-truth.json> npx vitest run eval/card.eval.test.ts --silent=false
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { scanAll } from '../src/engine/scan';
import { fsSource, walk } from '../tests/fs-source';

const DIR = process.env.CARD_DIR ?? '';
const TRUTH = process.env.CARD_TRUTH ?? '';

it.skipIf(!existsSync(TRUTH))('sorts real PhotoRec output correctly', async () => {
  const truth: Record<string, { label: string; note: string }> = JSON.parse(readFileSync(TRUTH, 'utf8'));
  const files = walk(DIR);
  const recs = (await scanAll(files.map((p) => fsSource(DIR, p))))!;
  const seen = new Set<string>();
  const rows: string[] = [];
  let realKeep = 0, wronglyAside = 0, inKeep = 0, junkInKeep = 0, unmatched = 0;
  for (const r of recs) {
    const h = createHash('sha256').update(readFileSync(files[r.index])).digest('hex');
    let expected = truth[h]?.label;
    const note = truth[h]?.note ?? 'no exact original (partial, split or PhotoRec extra)';
    if (expected === 'keep') { if (seen.has(h)) expected = 'duplicate'; seen.add(h); }
    if (!expected) unmatched++;
    if (expected === 'keep') { realKeep++; if (r.group !== 'keep') wronglyAside++; }
    if (r.group === 'keep') { inKeep++; if (expected && expected !== 'keep') junkInKeep++; }
    if (!expected || expected !== r.group) rows.push(`${r.path}  ${r.size}B  ${note}: expected ${expected ?? '?'}, got ${r.group}/${r.reason}`);
  }
  const counts: Record<string, number> = {};
  for (const r of recs) counts[r.group] = (counts[r.group] ?? 0) + 1;
  console.log(`\nRecovered files: ${recs.length}`, counts);
  console.log(`Real photos/videos wrongly set aside: ${wronglyAside}/${realKeep}`);
  console.log(`Known junk left in Keep: ${junkInKeep}/${inKeep}`);
  console.log(`Files with no exact original (judged by hand): ${unmatched}`);
  console.log(rows.join('\n'));
  expect(wronglyAside).toBe(0);
}, 120_000);
