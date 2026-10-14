import { copy } from './copy';

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="#DCEBE9" />
    <path d="M5 8.2l2 2 4-4.2" stroke="#0D615D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** current = index into copy.steps (0 = Recover). */
export function Header({ current }: { current: number }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="3" y="6" width="22" height="17" rx="4" stroke="#0D615D" strokeWidth="2" />
            <circle cx="14" cy="14.5" r="4.5" stroke="#0D615D" strokeWidth="2" />
            <path d="M10 6l1.5-2.5h5L18 6" stroke="#0D615D" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <span>{copy.appName}</span>
        </div>
        <nav aria-label="Progress">
          <ol className="steps">
            {copy.steps.map((s, i) =>
              i < current ? (
                <li key={s} className="step done"><Check /><span>{s}<span className="sr-only"> (done)</span></span></li>
              ) : i === current ? (
                <li key={s} className="step current" aria-current="step">{i + 1} · {s}</li>
              ) : (
                <li key={s} className="step">{i + 1} · {s}</li>
              ),
            )}
          </ol>
        </nav>
      </div>
    </header>
  );
}
