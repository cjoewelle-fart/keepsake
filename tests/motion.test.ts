import { describe, expect, it } from 'vitest';
import { COUNT_UP_MS, countAt, cubicBezier, easeOut } from '../src/ui/motion';
import { copy } from '../src/ui/copy';

describe('the count-up of the big number (warmth spec §3)', () => {
  it('follows the CSS curve: linear stays linear, ease-out runs ahead', () => {
    const linear = cubicBezier(0, 0, 1, 1);
    for (const p of [0, 0.1, 0.5, 0.9, 1]) expect(linear(p)).toBeCloseTo(p, 4);
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.25)).toBeGreaterThan(0.5);
    // Never goes back down.
    let last = 0;
    for (let i = 1; i <= 100; i++) {
      const v = easeOut(i / 100);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it('counts whole numbers from 0, never past the value, and lands exactly on it', () => {
    expect(countAt(214, 0)).toBe(0);
    expect(countAt(214, COUNT_UP_MS)).toBe(214);
    expect(countAt(214, COUNT_UP_MS + 500)).toBe(214);
    let last = 0;
    for (let t = 0; t < COUNT_UP_MS; t += 16) {
      const v = countAt(214, t);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v).toBeLessThanOrEqual(214);
      last = v;
    }
  });
});

describe('the step indicator (warmth spec §1)', () => {
  it('has the four steps inside the app, and no "clean" (voice guide)', () => {
    expect(copy.steps).toEqual(['Scan', 'Sort', 'Choose', 'Save']);
    expect(copy.stepOf(0, copy.steps.length, copy.steps[0])).toBe('Step 1 of 4 · Scan');
    expect(copy.timeline.back).toBe('Back to Sort');
    expect(copy.timeline.asideLine(3)).toMatch(/go back to Sort\.$/);
    const all = JSON.stringify(copy, (_k, v) => (typeof v === 'function' ? String(v) : v));
    expect(all).not.toMatch(/Clean up/);
  });
});
