import { copy } from './copy';
import { LogoMark } from './icons';

/**
 * The logo and the step indicator (warmth spec §1). `current` = index into copy.steps (0 = Scan).
 * `done`: the receipt screen, where every step is finished and the line says "Done".
 * The steps are not links: jumping around would lose work. Each step's name is always read by
 * screen readers; on wide screens it shows under its dot, on phones (and at 200% zoom) only the
 * dots and the "Step 1 of 4 · Scan" line show.
 */
export function Header({ current, done }: { current: number; done?: boolean }) {
  const line = done ? copy.save.doneStep : copy.stepOf(current, copy.steps.length, copy.steps[current]);
  return (
    <header className="topbar">
      <div className="brand">
        <LogoMark />
        <span>{copy.appName}</span>
      </div>
      <div className={`stepper${done ? ' stepper-done' : ''}`}>
        <ol className="steps" aria-label={copy.stepsLabel}>
          {copy.steps.map((name, i) => {
            const state = done || i < current ? 'done' : i === current ? 'current' : 'todo';
            return (
              <li key={name} className={`step step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                <span className="step-dot" aria-hidden="true" />
                <span className="step-name">{name}{state === 'done' && <span className="sr-only"> {copy.stepDone}</span>}</span>
              </li>
            );
          })}
        </ol>
        {/* What the list says, in one line (screen readers have the list itself). */}
        <p className="step-line" aria-hidden="true">{line}</p>
      </div>
    </header>
  );
}
