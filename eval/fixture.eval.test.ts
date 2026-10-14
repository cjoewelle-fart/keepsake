// Scores the engine against the answer key made by scripts/make_fixture.py.
// Run: npm run fixture && npm run eval
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { scanAll } from '../src/engine/scan';
import { fsSource, walk } from '../tests/fs-source';

const ROOT = join(__dirname, '..', 'fixtures', 'recovery');
const LABELS = join(__dirname, '..', 'fixtures', 'labels.json');

it.skipIf(!existsSync(LABELS))('meets the phase 1 gate on the fixture', async () => {
  const labels: Record<string, { label: string; note: string }> = JSON.parse(readFileSync(LABELS, 'utf8'));
  const sources = walk(ROOT).map((p) => fsSource(ROOT, p));
  const t0 = performance.now();
  const recs = (await scanAll(sources))!;
  const secs = (performance.now() - t0) / 1000;

  const groups = ['keep', 'small', 'duplicate', 'damaged', 'system'];
  const confusion: Record<string, Record<string, number>> = {};
  const wrong: string[] = [];
  for (const r of recs) {
    const truth = labels[r.path].label;
    confusion[truth] ??= Object.fromEntries(groups.map((g) => [g, 0]));
    confusion[truth][r.group]++;
    if (truth !== r.group) wrong.push(`${r.path} (${labels[r.path].note}): expected ${truth}, got ${r.group}/${r.reason}`);
  }
  const realKeep = recs.filter((r) => labels[r.path].label === 'keep');
  const wronglySetAside = realKeep.filter((r) => r.group !== 'keep').length;
  const inKeep = recs.filter((r) => r.group === 'keep');
  const junkInKeep = inKeep.filter((r) => labels[r.path].label !== 'keep').length;

  console.log(`\nScanned ${recs.length} files in ${secs.toFixed(2)}s`);
  console.log('Rows = truth, columns = result');
  console.table(confusion);
  console.log(`Real photos/videos wrongly set aside: ${wronglySetAside}/${realKeep.length} (${(100 * wronglySetAside / realKeep.length).toFixed(2)}%) — gate < 1%`);
  console.log(`Junk left in Keep: ${junkInKeep}/${inKeep.length} (${(100 * junkInKeep / inKeep.length).toFixed(2)}%) — target < 5%`);
  if (wrong.length) console.log('Mistakes:\n' + wrong.slice(0, 30).join('\n'));

  expect(wronglySetAside / realKeep.length).toBeLessThan(0.01);
  expect(junkInKeep / inKeep.length).toBeLessThan(0.05);
}, 120_000);
