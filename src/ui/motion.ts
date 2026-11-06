// Motion helpers (warmth spec §3–4). The CSS side is in app.css (--dur-*, --ease-*); this is the
// part that runs in script: the count-up of the big number on the results screen.

/** The person asked for less motion (their system setting). Everything then shows its final state at once. */
export const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of progress 0..1 (the same curve the stylesheet uses). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const x = (t: number) => ((ax * t + bx) * t + cx) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const y = (t: number) => ((ay * t + by) * t + cy) * t;
  return (p: number) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    // Newton's method for the t whose x is p, then bisection if it stalls.
    let t = p;
    for (let i = 0; i < 8; i++) {
      const err = x(t) - p;
      if (Math.abs(err) < 1e-6) return y(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = p;
    for (let i = 0; i < 40; i++) {
      if (x(t) < p) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return y(t);
  };
}

/** --ease-out: cubic-bezier(.2, .8, .2, 1). */
export const easeOut = cubicBezier(0.2, 0.8, 0.2, 1);

export const COUNT_UP_MS = 800;
/** Below this the number counts too few steps to read as counting; it's shown as it is. */
export const COUNT_UP_MIN = 20;

/** The number to show `elapsed` ms into a count-up to `to`: whole numbers, never past `to`, exactly `to` at the end. */
export function countAt(to: number, elapsed: number, ms = COUNT_UP_MS) {
  if (elapsed >= ms) return to;
  return Math.min(to, Math.max(0, Math.round(to * easeOut(elapsed / ms))));
}
