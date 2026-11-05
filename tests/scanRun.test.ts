// T100: a progress update that arrives after the scan's answer must not put the page back on
// the progress screen. (The real race, across two message channels, is checked in a browser by
// scripts/small-scan-check.mjs.)
import { describe, expect, it } from 'vitest';
import { progressFor, type ScanRun } from '../src/ui/scanRun';

describe('progressFor', () => {
  it('shows progress while its scan runs', () => {
    const run: ScanRun = { id: 1, stopped: false };
    const shown: number[] = [];
    const onProgress = progressFor(run, () => run, (p: number) => shown.push(p));
    onProgress(1);
    onProgress(2);
    expect(shown).toEqual([1, 2]);
  });

  it('drops the last update when it arrives after the answer (results already shown)', () => {
    const run: ScanRun = { id: 1, stopped: false };
    let screen = 'scanning 0/1';
    const onProgress = progressFor(run, () => run, (p: string) => { screen = `scanning ${p}`; });
    // The answer comes first: the page marks the run ended and shows the results...
    run.stopped = true;
    screen = 'results';
    // ...then "Checked 1 of 1" arrives on the progress channel.
    onProgress('1/1');
    expect(screen).toBe('results');
  });

  it("drops an earlier scan's progress once a new scan has started", () => {
    let current: ScanRun = { id: 1, stopped: false };
    const first = current;
    const shown: string[] = [];
    const onFirst = progressFor(first, () => current, (p: string) => shown.push(`first ${p}`));
    current = { id: 2, stopped: false };
    const onSecond = progressFor(current, () => current, (p: string) => shown.push(`second ${p}`));
    onFirst('3/3');
    onSecond('0/5');
    expect(shown).toEqual(['second 0/5']);
  });
});
