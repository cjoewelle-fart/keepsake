import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { PHOTO_KINDS } from '../engine/sniff';
import { effectiveGroup, summarize } from '../engine/summary';
import type { SetAsideGroup } from '../engine/summary';
import type { FileRecord } from '../engine/types';
import { SET_ASIDE_GROUPS } from '../engine/types';
import { buildSheet, spread } from './contactSheet';
import { copy, dayMonth, monthYear, n } from './copy';
import { GroupFiles } from './GroupFiles';
import { Preview } from './Preview';

type Props = {
  records: FileRecord[];
  files: File[];
  movedBack: ReadonlySet<SetAsideGroup>;
  onToggleGroup: (g: SetAsideGroup) => void;
  onReview: () => void;
  onStartOver: () => void;
};

/** Decorative shades for the set-aside strip and row swatches (never the only way a group is named). */
const SHADES: Record<SetAsideGroup, string> = { small: '#B8C9C5', duplicate: '#93AAA5', damaged: '#6F8A85', system: '#4F6965' };

/**
 * "Contact sheet with a ledger": the numbers that add up on the left, the photos themselves on the
 * right, and everything that was set aside below them, each group with its reason and an undo.
 */
export function Results({ records, files, movedBack, onToggleGroup, onReview, onStartOver }: Props) {
  const s = useMemo(() => summarize(records, movedBack), [records, movedBack]);
  const [open, setOpen] = useState<SetAsideGroup | null>(null);
  /** The chosen view of the Kept card: a year, or 'none' for the photos with no date (T77). */
  const [view, setView] = useState<string>();

  const photos = useMemo(
    () => records.filter((r) => effectiveGroup(r, movedBack) === 'keep' && PHOTO_KINDS.has(r.kind)),
    [records, movedBack],
  );
  const sheet = useMemo(() => buildSheet(photos, view === 'none' ? undefined : view), [photos, view]);
  // No date is shown on its own: when chosen, or when no photo has a date at all.
  const showNoDate = sheet.undated.count > 0 && (view === 'none' || sheet.years.length === 0);
  const chosenYear = showNoDate ? undefined : sheet.groups[0]?.month.slice(0, 4);

  const byGroup = useMemo(() => {
    const m = { small: [], duplicate: [], damaged: [], system: [] } as Record<SetAsideGroup, FileRecord[]>;
    for (const r of records) if (r.group !== 'keep') m[r.group].push(r);
    return m;
  }, [records]);
  const visibleGroups = SET_ASIDE_GROUPS.filter((g) => s.groups[g] > 0);
  const stripGroups = visibleGroups.filter((g) => !movedBack.has(g));

  // Tell screen-reader users when the ledger changes (not on first render).
  const [announce, setAnnounce] = useState('');
  // The ledger rows that changed are tinted until the next change (T77); no motion.
  const [changed, setChanged] = useState(false);
  const last = useRef(`${s.keep}/${s.setAside}`);
  useEffect(() => {
    const key = `${s.keep}/${s.setAside}`;
    if (key === last.current) return;
    last.current = key;
    setAnnounce(copy.results.ledgerChanged(s.keep, s.setAside));
    setChanged(true);
  }, [s.keep, s.setAside]);
  /** The group last kept or set aside again here, for the "Added … to Kept" note under its button. */
  const [lastToggled, setLastToggled] = useState<SetAsideGroup>();
  const toggleGroup = (g: SetAsideGroup) => {
    setLastToggled(g);
    onToggleGroup(g);
  };
  // QA m2: on a phone the "Added … to Kept" note can end below the window; bring it into view.
  const addedNote = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!lastToggled || !movedBack.has(lastToggled)) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    addedNote.current?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }, [lastToggled, movedBack]);
  /** D23: the groups whose list of every file is open (closed to start with). */
  const [listed, setListed] = useState<ReadonlySet<SetAsideGroup>>(new Set());
  const toggleList = (g: SetAsideGroup) => setListed((now) => {
    const next = new Set(now);
    if (!next.delete(g)) next.add(g);
    return next;
  });

  const jumpToUndated = () => {
    flushSync(() => setView('none'));
    document.getElementById('no-date-h')?.focus();
  };

  const allUndated = s.photos > 0 && s.undated === s.photos;
  const r = copy.results;

  return (
    <main className="page results">
      <section className="envelope" aria-labelledby="found-h">
        {s.keep > 0 ? (
          <h1 id="found-h" tabIndex={-1}>
            {r.titleBefore}
            <span className="bignum">{n(s.keep)}</span>
            {r.titleAfter(s.keep)}
          </h1>
        ) : (
          <h1 id="found-h" tabIndex={-1}>{copy.empty.noKeepers}</h1>
        )}
        <p className="lede">{s.keep > 0 ? (allUndated ? r.noDatesLine : r.sortedLine) : copy.empty.noKeepersBody}</p>

        <dl className="ledger" aria-label={r.ledgerLabel}>
          <div><dt>{r.ledgerChecked}</dt><dd>{n(s.total)}</dd></div>
          <div className={changed ? 'changed' : undefined}><dt>{r.ledgerKept}</dt><dd>{n(s.keep)}</dd></div>
          <div className={`ledger-total${changed ? ' changed' : ''}`}><dt>{r.ledgerAside}</dt><dd>{n(s.setAside)}</dd></div>
          <div className="ledger-safe">
            <dt><span aria-hidden="true">{r.ledgerSafe}</span><span className="sr-only">{r.ledgerSafeSr}</span></dt>
            <dd><span aria-hidden="true">{r.ledgerSafeValue}</span><span className="sr-only">{r.ledgerSafeValueSr}</span></dd>
          </div>
        </dl>
        <p className="sub-sm untouched">{r.untouched}</p>
        <p className="sr-only" role="status" aria-live="polite">{announce}</p>

        <div className="cta">
          {s.keep > 0 && (
            <>
              <button type="button" className="btn btn-primary" onClick={onReview}>{r.review(s.keep, s.others === 0)}</button>
              <span className="sub-sm">{r.takeYourTime}</span>
            </>
          )}
          <button type="button" className="btn btn-link" onClick={onStartOver}>{r.startOver}</button>
        </div>
      </section>

      <div className="sheet-col">
        {photos.length > 0 && (
          <section className="sheet" aria-labelledby="kept-h">
            <div className="aside-intro">
              <h2 id="kept-h" className="month-h">
                <span>{r.ledgerKept}</span>
                <span className="month-count">{n(s.keep)}</span>
              </h2>
              <p className="sub">{r.keptPhotosOnly(s.videos > 0)}</p>
            </div>
            {sheet.years.length > 0 && (sheet.years.length > 1 || sheet.undated.count > 0) && (
              <div className="chips" role="group" aria-label={r.jumpLabel}>
                {sheet.years.map(({ year: y }) => (
                  <button key={y} type="button" className="chip" aria-pressed={y === chosenYear} aria-controls="kept-view" onClick={() => setView(y)}>{y}</button>
                ))}
                {sheet.undated.count > 0 && (
                  <button type="button" className="chip" aria-pressed={showNoDate} aria-controls="kept-view" onClick={jumpToUndated}>{r.undatedChip(sheet.undated.count)}</button>
                )}
              </div>
            )}

            <div id="kept-view" className="months">
              {!showNoDate && sheet.groups.map((g, gi) => (
                <div key={g.month} className="month">
                  <h3 className="month-h">
                    <span>{monthYear(g.month)}</span>
                    <span className="month-count">{r.monthCount(g.count)}</span>
                  </h3>
                  <div className="prints">
                    {g.tiles.map((t, ti) => (
                      <figure key={t.index} className={`print${g.big && ti === 0 ? ' print-big' : ''}`}>
                        <Preview file={files[t.index]} record={t} size="fill" />
                        <figcaption className="tag">{dayMonth(t.takenAt!)}</figcaption>
                      </figure>
                    ))}
                    {gi === sheet.groups.length - 1 && sheet.moreDated > 0 && (
                      <button type="button" className="print print-more" onClick={onReview}>
                        <b>+{n(sheet.moreDated)}</b><span>{r.seeEveryMonth}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {showNoDate && (
                <div className="month">
                  <h3 className="month-h" id="no-date-h" tabIndex={-1}>
                    <span>{r.noDateTitle}</span>
                    <span className="month-count">{r.noDateCount(sheet.undated.count)}</span>
                  </h3>
                  <p className="sub-sm">{copy.timeline.noDateNote}</p>
                  <div className="prints">
                    {sheet.undated.tiles.map((t) => (
                      <figure key={t.index} className="print">
                        <Preview file={files[t.index]} record={t} size="fill" />
                        <figcaption className="tag tag-n">{r.noDateTag}</figcaption>
                      </figure>
                    ))}
                    {sheet.undated.more > 0 && (
                      <button type="button" className="print print-more" onClick={onReview}>
                        <b>+{n(sheet.undated.more)}</b><span>{r.seeThemAll}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {visibleGroups.length > 0 && (
          <section className="aside" aria-labelledby="aside-h">
            <div className="aside-intro">
              <h2 id="aside-h">{r.asideSafeTitle}</h2>
              <p className="sub">{r.asideIntro(s.setAside)}</p>
            </div>
            {stripGroups.length > 0 && (
              <div className="strip" aria-hidden="true">
                {stripGroups.map((g) => <div key={g} style={{ flex: s.groups[g], background: SHADES[g] }} />)}
              </div>
            )}
            <ul className="groups">
              {visibleGroups.map((g) => {
                const isOpen = open === g;
                const moved = movedBack.has(g);
                const panelId = `aside-${g}`;
                return (
                  <li key={g} className={`group${moved ? ' moved' : ''}`}>
                    <button
                      type="button"
                      className="group-head"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpen(isOpen ? null : g)}
                    >
                      <span className="swatch" aria-hidden="true" style={{ background: SHADES[g] }} />
                      <span className="samples" aria-hidden="true">
                        {spread(byGroup[g], 3).map((x) => <Preview key={x.index} file={files[x.index]} record={x} size="xs" />)}
                      </span>
                      <span className="group-text">
                        <span>{copy.groups[g].title}</span>
                        {moved && <span className="kept-note">{r.movedBack}</span>}
                      </span>
                      <span className="group-count">{n(s.groups[g])}</span>
                      <span className="group-toggle">{isOpen ? r.hide : r.peek}</span>
                    </button>
                    <div className="group-body" id={panelId} hidden={!isOpen}>
                      <p>{copy.groups[g].why}</p>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleGroup(g)}>
                        {moved ? r.undo : r.moveBack}
                      </button>
                      {!moved && <p className="sub-sm">{r.moveBackNote}</p>}
                      {moved && lastToggled === g && <p className="note-box" ref={addedNote}>{r.keptAdded(s.groups[g], s.keep)}</p>}
                      <button type="button" className="btn btn-link gf-toggle" aria-expanded={listed.has(g)} aria-controls={`all-${g}`} onClick={() => toggleList(g)}>
                        {listed.has(g) ? r.hideAll : r.seeAll(byGroup[g].length)}
                      </button>
                      <div className="gf" id={`all-${g}`} hidden={!listed.has(g)}>
                        {listed.has(g) && <GroupFiles records={byGroup[g]} files={files} />}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
