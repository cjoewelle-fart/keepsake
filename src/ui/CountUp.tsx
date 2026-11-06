import { useEffect, useState } from 'react';
import { n } from './copy';
import { COUNT_UP_MIN, COUNT_UP_MS, countAt, reducedMotion } from './motion';

/**
 * The big number on the results screen, counting up from 0 when the screen first arrives from
 * scanning (warmth spec §3). Screen readers get only the final value (the sr-only copy); the
 * counting one is hidden from them. An invisible "ghost" of the final value sits in the same grid
 * cell, so the heading never changes size while it counts. It counts only once, only for 20 or
 * more, and not at all when the person has asked for less motion. If the value changes (a group
 * kept or set aside again), the new value shows at once.
 */
export function CountUp({ value, animate }: { value: number; animate: boolean }) {
  // Decided once, when the screen first draws: whether to count, and to what.
  const [plan] = useState(() => ({ to: value, run: animate && value >= COUNT_UP_MIN && !reducedMotion() }));
  const [shown, setShown] = useState(plan.run ? 0 : value);
  const [over, setOver] = useState(!plan.run);

  useEffect(() => {
    if (!plan.run) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const elapsed = now - t0;
      setShown(countAt(plan.to, elapsed));
      if (elapsed < COUNT_UP_MS) raf = requestAnimationFrame(step);
      else setOver(true);
    };
    raf = requestAnimationFrame(step);
    // Leaving the screen stops it (StrictMode's second run in development starts it again).
    return () => cancelAnimationFrame(raf);
  }, [plan]);

  // A changed value (a group kept or set aside again) shows at once.
  const display = over || value !== plan.to ? value : shown;
  return (
    <span className="bignum count" data-final={value}>
      <span className="sr-only">{n(value)}</span>
      <span className="count-vis" aria-hidden="true">
        <span className="count-ghost">{n(value)}</span>
        <span className="count-live">{n(display)}</span>
      </span>
    </span>
  );
}
