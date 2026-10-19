import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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

  // Which month is at the top of the screen (just under the jump bar when it stays in view),
  // for the year pills and month jump (T51). Measured on scroll rather than with an
  // IntersectionObserver band: a band partway down the screen lagged a month behind what
  // was showing at the top, and missed months shorter than the band or gaps between months.
  const [current, setCurrent] = useState<string>();
  const toolsRef = useRef<HTMLDivElement>(null);
  /** The month last jumped to: kept when the page can't scroll far enough to bring it to the top. */
  const jumped = useRef<string | undefined>(undefined);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setCurrent(monthAtTop(toolsRef.current, jumped));
    };
    const soon = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', soon, { passive: true });
    window.addEventListener('resize', soon);
    // Previews and lazy blocks change the page's height without a scroll event.
    const ro = new ResizeObserver(soon);
    if (colRef.current) ro.observe(colRef.current);
    return () => {
      window.removeEventListener('scroll', soon);
      window.removeEventListener('resize', soon);
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [tl]);
  const currentKey = current && tl.months.some((m) => m.key === current) ? current : tl.months[0]?.key;
  const currentYear = currentKey && currentKey !== NO_DATE ? currentKey.slice(0, 4) : undefined;
  const yearMonths = (currentKey !== NO_DATE && tl.years.find((y) => y.year === (currentYear ?? tl.years[0]?.year))?.months) || [];

  const jump = (monthKey: string) => {
    jumped.current = monthKey;
    const h = document.getElementById(`m-${monthKey}`);
    if (!h) return;
    h.scrollIntoView({ block: 'start' });
    // When the jump bar stays at the top of the window, scroll the heading out from under it.
    // scrollIntoView already left the heading's 16px scroll margin, so it ends 16px below the bar.
    const tools = toolsRef.current;
    if (tools && getComputedStyle(tools).position === 'sticky') window.scrollBy(0, -tools.offsetHeight);
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

        {filter === 'unselected' && tl.months.length > 0 && <p className="note-box">{t.unselectedNote}</p>}

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

/**
 * How far below the jump bar (or the top of the window) a month's top may be and still count
 * as "at the top". A jump leaves the heading 16px below the bar (see jump), so this must be more.
 */
const SPY_SLACK = 32;

/**
 * The month at the top of the screen: the last month section whose top has reached the line
 * just under the jump bar (the bar's bottom when it's on screen, else the window's top).
 * After a jump to a month the page can't bring up to the top (near the end), that month stays.
 */
function monthAtTop(tools: HTMLElement | null, jumped: { current?: string }): string | undefined {
  const line = Math.max(0, tools?.getBoundingClientRect().bottom ?? 0) + SPY_SLACK;
  let key: string | undefined;
  for (const el of document.querySelectorAll<HTMLElement>('.tl-month')) {
    if (el.getBoundingClientRect().top > line) break;
    key = el.dataset.month;
  }
  const target = jumped.current && document.querySelector<HTMLElement>(`.tl-month[data-month="${jumped.current}"]`);
  if (target && key !== jumped.current) {
    const top = target.getBoundingClientRect().top;
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    if (atBottom && top > line && top < window.innerHeight) return jumped.current;
  }
  jumped.current = undefined;
  return key;
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
              <div className="tl-day" data-day={b.day.key}>
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
  // A one-photo day's checkbox does exactly what the photo's own does (whose name has the date),
  // so it's left out of the Tab order and hidden from screen readers: one Tab stop, not two.
  const single = total === 1;
  return (
    <label className="tl-day-h" aria-hidden={single || undefined}>
      <input ref={box} type="checkbox" checked={state === 'all'} onChange={onToggle} tabIndex={single ? -1 : undefined} />
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

// Keyboard: Tab moves focus to the next control in the page, and skips a block that isn't drawn
// yet. So whenever focus is in the timeline, the blocks just before and after it are drawn at
// once, whatever the observer says, and Tab (even held down) always lands on the next photo.
const KEY_AHEAD = 3;
const forcers = new Map<Element, (on: boolean) => void>();
let forced = new Set<Element>();
function drawAroundFocus(target: EventTarget | null) {
  const next = new Set<Element>();
  if (target instanceof Element && target.closest('.tl-col')) {
    const blocks = [...document.querySelectorAll('.tl-block')].filter((b) => forcers.has(b)); // in page order
    // First block that is (or follows) the focused element.
    let lo = 0;
    let hi = blocks.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const b = blocks[mid];
      if (b === target || b.contains(target) || target.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) hi = mid; else lo = mid + 1;
    }
    const inside = blocks[lo]?.contains(target) ? 1 : 0;
    for (let i = Math.max(0, lo - KEY_AHEAD); i < Math.min(blocks.length, lo + inside + KEY_AHEAD); i++) next.add(blocks[i]);
  }
  if (!next.size && !forced.size) return;
  // Drawn before this event ends, so the very next Tab already sees them.
  flushSync(() => {
    for (const el of forced) if (!next.has(el)) forcers.get(el)?.(false);
    for (const el of next) if (!forced.has(el)) forcers.get(el)?.(true);
  });
  forced = next;
}
if (typeof document !== 'undefined') document.addEventListener('focusin', (e) => drawAroundFocus(e.target));

function Lazy({ estimate, sizeKey, children }: { estimate: number; sizeKey: string; children: () => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [observed, setNear] = useState(false);
  const [pinned, setPinned] = useState(false);
  const near = observed || pinned;
  // The real height when a block is dropped, so the page doesn't jump (used until the size changes).
  const [held, setHeld] = useState<{ key: string; h: number }>();
  const key = useRef(sizeKey);
  useEffect(() => { key.current = sizeKey; }, [sizeKey]);
  useEffect(() => {
    const el = ref.current!;
    forcers.set(el, (on) => {
      if (!on && el.firstElementChild) setHeld({ key: key.current, h: el.offsetHeight });
      setPinned(on);
    });
    return () => { forcers.delete(el); forced.delete(el); };
  }, []);
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
