import { copy } from './copy';

/** current = index into copy.steps (0 = Recover). `done`: the receipt screen, which says "Done". */
export function Header({ current, done }: { current: number; done?: boolean }) {
  return (
    <header className="topbar">
      <div className="brand">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="24" height="24" rx="6" fill="#FFFFFF" stroke="#23596B" strokeWidth="1.8" />
          <path d="M6.5 15.5c2.5-2.2 5-2.2 7.5 0s5 2.2 7.5 0" stroke="#23596B" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M6.5 21h8" stroke="#8A4B08" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>{copy.appName}</span>
      </div>
      <p className="step-line">{done ? copy.save.doneStep : copy.stepOf(current, copy.steps.length, copy.steps[current])}</p>
    </header>
  );
}
