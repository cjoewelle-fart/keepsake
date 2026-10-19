import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { FileRecord } from '../engine/types';
import { bytes, clock, copy, monthName, monthYear, n, runTime, weekdayDayMonth } from './copy';
import { Preview } from './Preview';
import { NO_DATE, blocksOf, buildTimeline, columnsFor, inPlay, mediaType, selectedIds, tally } from './timeline';
import type { Block, Filter, Month, Selection, TriState } from './timeline';
import type { SetAsideGroup } from '../engine/summary';

type Props = {
  records: FileRecord[];
  files: File[];
  movedBack: ReadonlySet<SetAsideGroup>;
  /** Files still set aside (for the ledger). */
  setAside: number;
  selection: Selection;
  onBack: () => void;
  /** Saving is the next step (T25). Gets the selected FileRecord indices, newest first. */
  onSave: (ids: number[]) => void;
};

const t = copy.timeline;
const FILTERS: Filter[] = ['all', 'photos', 'videos', 'unselected'];

/**
 * "Choose what to save": every kept photo and video on a timeline, all selected to start with.
 * Only the days near the screen are drawn; the rest are placeholders of about the same height,
 * so 40,000 files scroll without holding 40,000 tiles (or previews) at once.
 */
export function Timeline({ records, files, movedBack, setAside, selection: sel, onBack, onSave }: Props) {
  // The selection object is mutable; this number re-renders after each change.
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  const [filter, setFilter] = useState<Filter>('all');
  // "Not selected" shows what was unticked when it was chosen, so ticking a file doesn't hide it.
  const [snapshot, setSnapshot] = useState<(id: number) => boolean>();

  const kept = useMemo(() => inPlay(records, movedBack), [records, movedBack]);
  const byIndex = useMemo(() => {
    const a: FileRecord[] = [];
    for (const r of kept) a[r.index] = r;
    return a;
  }, [kept]);
  const mediaOnly = useMemo(() => kept.every((r) => mediaType(r) !== 'other'), [kept]);
  const tl = useMemo(
    () => buildTimeline(kept, filter, filter === 'unselected' && snapshot ? (r) => !snapshot(r.index) : undefined),
    [kept, filter, snapshot],
  );
  // `sel` is mutated in place, so `version` is what tells this to re-count.
  const sum = useMemo(() => { void version; return tally(kept, sel); }, [kept, sel, version]);

  const chooseFilter = (f: Filter) => {
    if (f === 'unselected') setSnapshot(() => sel.snapshot());
    setFilter(f);
  };
  // The group the last change was made to (a day or month), for the announcement.
  const lastGroup = useRef<{ label: string; ids: readonly number[] }>(undefined);
  const set = (ids: readonly number[], on: boolean, group?: string) => {
    lastGroup.current = group ? { label: group, ids } : undefined;
    if (sel.set(ids, on)) bump();
  };
  const toggle = (ids: readonly number[], group: string) => {
    lastGroup.current = { label: group, ids };
    sel.toggle(ids);
    bump();
  };

  // Tell screen-reader users the new count once they pause (not on first render).
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    if (version === 0) return;
    const id = setTimeout(() => {
      const g = lastGroup.current;
      setAnnounce(g ? t.announceGroup(g.label, sel.count(g.ids), g.ids.length, sum.selected, sum.total) : t.announce(sum.selected, sum.total));
    }, 1000);
    return () => clearTimeout(id);
  }, [version, sel, sum.selected, sum.total]);

  // Grid columns follow the column's width (also used to size placeholders).
  const colRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = colRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cols = columnsFor(width);
  const gap = cols === 3 ? 8 : 12;

  // Which month is at the top of the screen, for the year pills and month jump.
  const [current, setCurrent] = useState<string>();
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setCurrent((e.target as HTMLElement).dataset.month);
    }, { rootMargin: '-25% 0px -65% 0px' });
    document.querySelectorAll('.tl-month').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [tl]);
  const currentKey = current && tl.months.some((m) => m.key === current) ? current : tl.months[0]?.key;
  const currentYear = currentKey && currentKey !== NO_DATE ? currentKey.slice(0, 4) : undefined;
  const yearMonths = (currentKey !== NO_DATE && tl.years.find((y) => y.year === (currentYear ?? tl.years[0]?.year))?.months) || [];

  const toolsRef = useRef<HTMLDivElement>(null);
  const jump = (monthKey: string) => {
    const h = document.getElementById(`m-${monthKey}`);
    if (!h) return;
    h.scrollIntoView({ block: 'start' });
    // When the jump bar stays at the top of the window, scroll the heading out from under it.
    const tools = toolsRef.current;
    if (tools && getComputedStyle(tools).position === 'sticky') window.scrollBy(0, -(tools.offsetHeight + 16));
    h.focus({ preventScroll: true });
    setCurrent(monthKey);
  };

  const noDate = tl.months.find((m) => m.key === NO_DATE);
  const none = sum.selected === 0;
  const saveBtn = (reasonId: string) => (
    <button
      type="button"
      className="btn btn-primary tl-save"
      aria-disabled={none || undefined}
      aria-describedby={none ? reasonId : undefined}
      onClick={() => { if (!none) onSave(selectedIds(kept, sel)); }}
    >
      {t.save(sum.selected)}
    </button>
  );
  const everyId = () => kept.map((r) => r.index);

  return (
    <main className="page results timeline">
      <section className="envelope" aria-labelledby="choose-h">
        <h1 id="choose-h" tabIndex={-1}>
          {t.title}
          <span className="bignum">{n(sum.selected)}</span>
          <span className="tl-selected-word">{t.selectedWord}</span>
        </h1>
        <p className="lede">{t.intro}</p>
        <dl className="ledger" aria-label={t.ledgerLabel}>
          <div><dt>{mediaOnly ? t.ledgerTotal : t.ledgerTotalMixed}</dt><dd data-k="total">{n(sum.total)}</dd></div>
          <div><dt>{t.ledgerSelected}</dt><dd data-k="selected">{n(sum.selected)}</dd></div>
          <div className="ledger-total"><dt>{t.ledgerNotSelected}</dt><dd data-k="unselected">{n(sum.notSelected)}</dd></div>
          <div><dt>{t.ledgerSize}</dt><dd data-k="size">{bytes(sum.selectedBytes)}</dd></div>
          <div className="ledger-plain"><dt>{t.ledgerAside}</dt><dd data-k="aside">{n(setAside)}</dd></div>
          <div className="ledger-safe">
            <dt><span aria-hidden="true">{t.ledgerSafe}</span><span className="sr-only">{t.ledgerSafeSr}</span></dt>
            <dd><span aria-hidden="true">{t.ledgerSafeValue}</span><span className="sr-only">{t.ledgerSafeValueSr}</span></dd>
          </div>
        </dl>
        <p id="save-why" className={none ? 'note-box' : 'sub-sm untouched'}>{none ? t.nothingSelected : t.notSelectedMeans}</p>
        <p className="sr-only" role="status" aria-live="polite">{announce}</p>
        <div className="cta">
          <div className="tl-wide">{saveBtn('save-why')}</div>
          <div className="tl-bulk">
            <button type="button" className="btn btn-link" onClick={() => set(everyId(), true)}>{t.selectAll}</button>
            <button type="button" className="btn btn-link" onClick={() => set(everyId(), false)}>{t.selectNone}</button>
          </div>
        </div>
      </section>

      <div className="sheet-col tl-col" ref={colRef} style={{ '--cols': cols, '--gap': `${gap}px` } as CSSProperties}>
        <div className="tl-tools" ref={toolsRef}>
          {(tl.years.length > 1 || (tl.years.length > 0 && noDate)) && (
            <nav className="chips" aria-label={t.jumpYear}>
              {tl.years.map(({ year, months }) => (
                <button key={year} type="button" className="chip" aria-current={year === currentYear || undefined} onClick={() => jump(months[0])}>{year}</button>
              ))}
              {noDate && <button type="button" className="chip" aria-current={currentKey === NO_DATE || undefined} onClick={() => jump(NO_DATE)}>{t.noDatePill(noDate.ids.length)}</button>}
            </nav>
          )}
          <div className="tl-tools-row">
            {yearMonths.length > 1 && (
              <nav className="chips tl-months-pills" aria-label={t.jumpMonthIn(currentYear ?? '')}>
                {yearMonths.map((k) => (
                  <button key={k} type="button" className="chip chip-sm" aria-current={k === currentKey || undefined} onClick={() => jump(k)}>{monthName(k)}</button>
                ))}
              </nav>
            )}
            {tl.months.length > 1 && (
              <label className="tl-month-select">
                <span>{t.jumpMonth}</span>
                <select value={currentKey} onChange={(e) => jump(e.target.value)}>
                  {tl.months.map((m) => (
                    <option key={m.key} value={m.key}>{t.monthOption(m.key === NO_DATE ? t.noDate : monthYear(m.key), sel.count(m.ids), m.ids.length)}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="tl-filter" role="group" aria-label={t.filterLabel}>
              {FILTERS.map((f) => (
                <button key={f} type="button" className="chip chip-sm" aria-pressed={filter === f} onClick={() => chooseFilter(f)}>{t.filters[f]}</button>
              ))}
            </div>
          </div>
        </div>

        {tl.months.length === 0 && (
          <div className="tl-empty">
            <p className="note-box">{t.emptyFilter[filter]}</p>
            {filter !== 'all' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => chooseFilter('all')}>{t.showAll}</button>}
          </div>
        )}

        {tl.months.map((m) => (
          <MonthSection key={m.key} m={m} sel={sel} byIndex={byIndex} files={files} width={width} cols={cols} gap={gap} onSet={set} onToggle={toggle} />
        ))}

        {setAside > 0 && (
          <section className="aside tl-aside" aria-label={copy.results.asideSafeTitle}>
            <p className="sub">{t.asideLine(setAside)}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>{t.back}</button>
          </section>
        )}
        {setAside === 0 && <div><button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>{t.back}</button></div>}
      </div>

      {/* Narrow screens: the count and the button stay at the bottom of the window. */}
      <div className="tl-footer">
        <p className="tl-footer-line" aria-hidden="true"><span>{t.footerCount(sum.selected, sum.total)}</span><span>{t.footerDeleted}</span></p>
        {saveBtn('save-why')}
      </div>
    </main>
  );
}

type SectionProps = {
  m: Month;
  sel: Selection;
  byIndex: FileRecord[];
  files: File[];
  width: number;
  cols: number;
  gap: number;
  onSet: (ids: readonly number[], on: boolean, group?: string) => void;
  onToggle: (ids: readonly number[], group: string) => void;
};

function MonthSection({ m, sel, byIndex, files, width, cols, gap, onSet, onToggle }: SectionProps) {
  const blocks = useMemo(() => blocksOf(m), [m]);
  const isNone = m.key === NO_DATE;
  const title = isNone ? t.noDate : monthYear(m.key);
  const c = sel.count(m.ids);
  const all = c === m.ids.length;
  const tile = width > 0 ? (width - gap * (cols - 1)) / cols : 120;
  const estimate = (b: Block) => {
    const rows = Math.ceil(b.ids.length / cols);
    return (b.first && !isNone ? 54 : 0) + rows * tile + (rows - 1) * gap;
  };
  return (
    <section className="month tl-month" data-month={m.key} aria-labelledby={`m-${m.key}`}>
      <div className="tl-month-head">
        <h2 className="month-h" id={`m-${m.key}`} tabIndex={-1}>
          <span>{title}</span>
          <span className="month-count">{t.monthSelected(c, m.ids.length)}</span>
        </h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSet(m.ids, !all, title)}>
          {isNone ? (all ? t.unselectNoDate : t.selectNoDate) : all ? t.unselectMonth(monthName(m.key)) : t.selectMonth(monthName(m.key))}
        </button>
      </div>
      {isNone && <p className="sub-sm">{t.noDateNote}</p>}
      {c === 0 && <p className="sub-sm">{t.monthNoneNote}</p>}
      <div className="tl-days">
        {blocks.map((b) => (
          <Lazy key={b.key} estimate={estimate(b)} sizeKey={`${cols}:${Math.round(tile)}`}>
            {() => (
              <div className="tl-day">
                {b.first && !isNone && <DayHead ymd={b.day.key} state={sel.state(b.day.ids)} count={sel.count(b.day.ids)} total={b.day.ids.length} onToggle={() => onToggle(b.day.ids, weekdayDayMonth(b.day.key))} />}
                <div className="tl-grid">
                  {b.ids.map((id, k) => (
                    <Tile key={id} r={byIndex[id]} file={files[id]} pos={b.start + k + 1} of={b.day.ids.length} on={sel.has(id)} onChange={(on) => onSet([id], on)} />
                  ))}
                </div>
              </div>
            )}
          </Lazy>
        ))}
      </div>
    </section>
  );
}

function DayHead({ ymd, state, count, total, onToggle }: { ymd: string; state: TriState; count: number; total: number; onToggle: () => void }) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { if (box.current) box.current.indeterminate = state === 'some'; }, [state]);
  return (
    <label className="tl-day-h">
      <input ref={box} type="checkbox" checked={state === 'all'} onChange={onToggle} />
      <span>{weekdayDayMonth(ymd)}</span>
      <span className="tl-day-count">{t.daySelected(count, total)}</span>
    </label>
  );
}

type TileProps = { r: FileRecord; file: File; pos: number; of: number; on: boolean; onChange: (on: boolean) => void };
function Tile({ r, file, pos, of, on, onChange }: TileProps) {
  const type = mediaType(r);
  return (
    <figure className={`print tl-tile${on ? '' : ' off'}`}>
      <Preview file={file} record={r} size="fill" />
      <label className="chk">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} aria-label={t.tileLabel(type, r.takenAt, pos, of, r.durationSec)} />
        <span className="dot" aria-hidden="true">
          {on && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7.2l2.6 2.6L11 4.4" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
      </label>
      {r.takenAt && <figcaption className="tag" aria-hidden="true">{clock(r.takenAt)}</figcaption>}
      {type === 'video' && (
        <span className="vid" aria-hidden="true" title={t.video}>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>
          {r.durationSec !== undefined && <span className="vid-len">{runTime(r.durationSec)}</span>}
        </span>
      )}
    </figure>
  );
}

// One shared observer for every lazy block: drawn when within ~1.5 screens, dropped when far away.
const watchers = new Map<Element, (near: boolean) => void>();
let shared: IntersectionObserver | undefined;
function watch(el: Element, cb: (near: boolean) => void) {
  shared ??= new IntersectionObserver((entries) => {
    for (const e of entries) watchers.get(e.target)?.(e.isIntersecting);
  }, { rootMargin: '1200px 0px' });
  watchers.set(el, cb);
  shared.observe(el);
  return () => { shared?.unobserve(el); watchers.delete(el); };
}

function Lazy({ estimate, sizeKey, children }: { estimate: number; sizeKey: string; children: () => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  // The real height when a block is dropped, so the page doesn't jump (used until the size changes).
  const [held, setHeld] = useState<{ key: string; h: number }>();
  const key = useRef(sizeKey);
  useEffect(() => { key.current = sizeKey; }, [sizeKey]);
  useEffect(() => watch(ref.current!, (v) => {
    const el = ref.current;
    if (!el) return;
    if (!v) {
      if (el.contains(document.activeElement)) return; // never pull the focused checkbox out
      if (el.firstElementChild) setHeld({ key: key.current, h: el.offsetHeight });
    }
    setNear(v);
  }), []);
  const h = held?.key === sizeKey ? held.h : estimate;
  return (
    <div ref={ref} className="tl-block" style={near ? undefined : { height: h }}>
      {near ? children() : null}
    </div>
  );
}
