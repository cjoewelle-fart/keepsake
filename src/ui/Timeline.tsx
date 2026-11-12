import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import type { FileRecord } from '../engine/types';
import { bytes, clock, copy, dateTime, monthName, monthYear, n, runTime, weekdayDayMonth } from './copy';
import { Preview } from './Preview';
import { Viewer } from './Viewer';
import { SafeNote } from './Results';
import { playableHere } from './playable';
import { NO_DATE, blocksOf, buildTimeline, chunks, columnsFor, filterCounts, inPlay, largestFirst, leftOutKind, mediaType, selectedIds, tally } from './timeline';
import type { Block, Filter, Month, Order, Selection, TriState } from './timeline';
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
const FILTERS: Filter[] = ['all', 'photos', 'videos', 'unselected', 'screenshots', 'chat'];
/** T50/T59: filters from the scan's hints, shown only when some file has that hint (or the filter is on). */
const HINT_FILTERS: ReadonlySet<Filter> = new Set(['screenshots', 'chat']);
const ORDERS: Order[] = ['date', 'size'];
/** Largest first: rows per lazily drawn block, and one row's height with its gap (a 56 px preview and 8 px). */
const ROW_CHUNK = 50;
const ROW = 64;

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
  // T60: "By date" (default) or "Largest first".
  const [order, setOrder] = useState<Order>('date');
  const bySize = order === 'size';

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
  // T60: sorted once per filter (or order) change, never on a tick: `version` isn't a dependency.
  const sizeIds = useMemo(
    () => (bySize ? largestFirst(kept, filter, filter === 'unselected' && snapshot ? (r) => !snapshot(r.index) : undefined) : []),
    [bySize, kept, filter, snapshot],
  );
  const sizeBlocks = useMemo(() => chunks(sizeIds, ROW_CHUNK), [sizeIds]);
  // `sel` is mutated in place, so `version` is what tells this to re-count.
  const sum = useMemo(() => { void version; return tally(kept, sel); }, [kept, sel, version]);
  // The count in each filter chip ("Not selected" follows ticks as they happen).
  const counts = useMemo(() => { void version; return filterCounts(kept, sel); }, [kept, sel, version]);
  const shownCount = bySize ? sizeIds.length : tl.shown;
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

  // Read by the announcement below when it fires, without making a switch of order re-announce the count.
  const bySizeNow = useRef(bySize);
  useEffect(() => { bySizeNow.current = bySize; }, [bySize]);
  // Tell screen-reader users the new count once they pause (not on first render).
  const [announce, setAnnounce] = useState('');
  /** The count waiting to be said; choosing an order or filter cancels it, so the newest news is what's heard. */
  const countTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (version === 0) return;
    const id = countTimer.current = setTimeout(() => {
      const g = lastGroup.current;
      const said = g ? t.announceGroup(g.label, sel.count(g.ids), g.ids.length, sum.selected, sum.total) : t.announce(sum.selected, sum.total);
      setAnnounce(bySizeNow.current && sum.selected > 0 ? said + t.announceSize(bytes(sum.selectedBytes)) : said);
    }, 1000);
    return () => clearTimeout(id);
  }, [version, sel, sum.selected, sum.total, sum.selectedBytes]);

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
  // T60: switching the order. The order buttons stay where they are, so focus stays on the one
  // pressed; the new order is said by the status line; and if the list had been scrolled, it goes
  // back to its start (the bar with the buttons stays in view).
  const scrollOnSwitch = useRef(false);
  const chooseOrder = (o: Order) => {
    if (o === order) return;
    clearTimeout(countTimer.current);
    scrollOnSwitch.current = (colRef.current?.getBoundingClientRect().top ?? 0) < 0;
    setOrder(o);
    setAnnounce(t.orderAnnounce[o]);
  };
  // Filters (T50/T59 for the status line): like the order, focus stays on the chip pressed, the
  // status line says how many are showing, and a scrolled list goes back to its start.
  const chooseFilter = (f: Filter) => {
    if (f === 'unselected') setSnapshot(() => sel.snapshot());
    if (f === filter) return;
    clearTimeout(countTimer.current);
    scrollOnSwitch.current = (colRef.current?.getBoundingClientRect().top ?? 0) < 0;
    setFilter(f);
    // The chip's own count is what the new list shows (for Not selected, the snapshot just taken).
    setAnnounce(f === 'all' ? t.showingAll(kept.length) : t.showing(counts[f], kept.length));
  };
  useLayoutEffect(() => {
    if (!scrollOnSwitch.current) return;
    scrollOnSwitch.current = false;
    colRef.current?.scrollIntoView({ block: 'start' });
  }, [order, filter]);

  const cols = columnsFor(width);
  const gap = cols === 3 ? 8 : 12;

  // Which month is at the top of the screen (just under the jump bar when it stays in view),
  // for the year pills and month jump (T51). Measured on scroll rather than with an
  // IntersectionObserver band: a band partway down the screen lagged a month behind what
  // was showing at the top, and missed months shorter than the band or gaps between months.
  const [current, setCurrent] = useState<string>();
  const toolsRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const envRef = useRef<HTMLElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  // T79: "Back to top" in the bar is hidden while the summary (the envelope) is still on screen.
  // The envelope can be sticky, so this uses where its bottom would be in the page, not where it's drawn.
  const [atTop, setAtTop] = useState(true);
  const atTopNow = useRef(true);
  /** The month last jumped to: kept when the page can't scroll far enough to bring it to the top. */
  const jumped = useRef<string | undefined>(undefined);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setCurrent(monthAtTop(toolsRef.current, jumped));
      const main = mainRef.current;
      const env = envRef.current;
      if (main && env) {
        const top = main.getBoundingClientRect().top + parseFloat(getComputedStyle(main).paddingTop || '0');
        const next = top + env.offsetHeight > 0;
        if (next !== atTopNow.current) { atTopNow.current = next; setAtTop(next); }
      }
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
  // T80: while a bar sticks to the top or bottom of the window, keep what Tab moves to clear of it
  // (WCAG 2.4.11), and jumps to a month land just under the bar.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const set = () => {
      const tools = toolsRef.current;
      const foot = footRef.current;
      const top = tools && getComputedStyle(tools).position === 'sticky' ? tools.offsetHeight : 0;
      const bottom = foot && getComputedStyle(foot).display !== 'none' ? foot.offsetHeight : 0;
      html.style.scrollPaddingTop = top ? `${top}px` : '';
      html.style.scrollPaddingBottom = bottom ? `${bottom}px` : '';
    };
    set();
    const ro = new ResizeObserver(set);
    if (toolsRef.current) ro.observe(toolsRef.current);
    if (footRef.current) ro.observe(footRef.current);
    window.addEventListener('resize', set);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', set);
      html.style.scrollPaddingTop = '';
      html.style.scrollPaddingBottom = '';
    };
  }, []);

  const currentKey = current && tl.months.some((m) => m.key === current) ? current : tl.months[0]?.key;
  const currentYear = currentKey && currentKey !== NO_DATE ? currentKey.slice(0, 4) : undefined;
  const yearMonths = (currentKey !== NO_DATE && tl.years.find((y) => y.year === (currentYear ?? tl.years[0]?.year))?.months) || [];

  const jump = (monthKey: string) => {
    jumped.current = monthKey;
    const h = document.getElementById(`m-${monthKey}`);
    if (!h) return;
    h.scrollIntoView({ block: 'start' });
    // The page's scroll padding (above) already keeps the heading clear of a sticky jump bar,
    // 16px below it (its scroll margin). If the heading still ended up under the bar, move it out.
    const tools = toolsRef.current;
    if (tools && getComputedStyle(tools).position === 'sticky' && h.getBoundingClientRect().top < tools.getBoundingClientRect().bottom) {
      window.scrollBy(0, -tools.offsetHeight);
    }
    h.focus({ preventScroll: true });
    setCurrent(monthKey);
  };

  // D24: "View larger" on each tile opens the viewer on the files showing now (the filter applies).
  const [viewing, setViewing] = useState<number>();
  /** A file whose day must be drawn now (focus is going back to it after the viewer closes). */
  const [hold, setHold] = useState<number>();
  const shownIds = useMemo(() => (bySize ? sizeIds : tl.months.flatMap((m) => m.ids)), [bySize, sizeIds, tl]);
  const place = useMemo(() => {
    const at = new Map<number, { pos: number; of: number; month: string }>();
    for (const m of tl.months) for (const d of m.days) d.ids.forEach((id, k) => at.set(id, { pos: k + 1, of: d.ids.length, month: m.key }));
    return at;
  }, [tl]);
  // In Largest first, a no-date file's place in the date view ("207 of 460") means nothing, so it's left out (T60 QA).
  const labelOf = (id: number) => {
    const p = bySize ? undefined : place.get(id);
    return tileName(byIndex[id], p?.pos, p?.of);
  };
  /** Back to the opening control of the last file shown, drawing its day (and jumping to its month) if it isn't drawn. */
  const closeViewer = (lastId: number) => {
    flushSync(() => setViewing(undefined));
    const find = () => colRef.current?.querySelector<HTMLElement>(`[data-view="${lastId}"]`);
    let el = find();
    if (!el) {
      const m = place.get(lastId)?.month;
      if (m && !bySize) jump(m);
      flushSync(() => setHold(lastId));
      el = find();
    }
    el?.focus();
    setHold(undefined);
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
      {t.save(sum.selected, mediaOnly)}
    </button>
  );
  const everyId = () => kept.map((r) => r.index);
  const backToTop = () => {
    window.scrollTo(0, 0);
    document.getElementById('choose-h')?.focus({ preventScroll: true });
  };
  /** In the bars, hidden while the summary is on screen; at the end of the list, always there. */
  const topBtn = (inBar: boolean) => (
    <button type="button" className="btn btn-link tl-top" style={inBar && atTop ? { visibility: 'hidden' } : undefined} onClick={backToTop}>{t.backToTop}</button>
  );
  const backBtn = (
    <div className="tl-back">
      <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>{t.back}</button>
      <p className="sub-sm">{t.backKeeps}</p>
    </div>
  );

  return (
    <main className="page results timeline" ref={mainRef}>
      <section className="envelope" aria-labelledby="choose-h" ref={envRef}>
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
        </dl>
        {/* Round 2: the true version of "smaller": only leaving files out shrinks the save. */}
        {sum.notSelected > 0 && <p className="sub-sm" data-k="left-out">{t.leftOutSize(sum.notSelected, bytes(sum.notSelectedBytes), leftOutKind(sum))}</p>}
        <SafeNote h={t.safeH} line={t.safeLine} />
        {none && <p id="save-why" className="note-box">{t.nothingSelected}</p>}
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
          {/* T80: wide, tall windows. The count is announced by the live region above, so it's hidden here. */}
          <div className="tl-tally">
            <span className="tl-tally-count" aria-hidden="true">{t.footerCount(sum.selected, sum.total)}{bySize && <span className="tl-size-total"> · {t.footerSize(bytes(sum.selectedBytes))}</span>}</span>
            {topBtn(true)}
          </div>
          {!bySize && (tl.years.length > 1 || (tl.years.length > 0 && noDate)) && (
            <nav className="chips" aria-label={t.jumpYear}>
              {tl.years.map(({ year, months }) => (
                <button key={year} type="button" className="chip" aria-current={year === currentYear || undefined} onClick={() => jump(months[0])}>{year}</button>
              ))}
              {noDate && <button type="button" className="chip" aria-current={currentKey === NO_DATE || undefined} onClick={() => jump(NO_DATE)}>{t.noDatePill(noDate.ids.length)}</button>}
            </nav>
          )}
          <div className="tl-tools-row">
            {!bySize && yearMonths.length > 1 && (
              <nav className="chips tl-months-pills" aria-label={t.jumpMonthIn(currentYear ?? '')}>
                {yearMonths.map((k) => (
                  <button key={k} type="button" className="chip chip-sm" aria-current={k === currentKey || undefined} onClick={() => jump(k)}>{monthName(k)}</button>
                ))}
              </nav>
            )}
            {!bySize && tl.months.length > 1 && (
              <label className="tl-month-select">
                <span>{t.jumpMonth}</span>
                <select value={currentKey} onChange={(e) => jump(e.target.value)}>
                  {tl.months.map((m) => (
                    <option key={m.key} value={m.key}>{t.monthOption(m.key === NO_DATE ? t.noDate : monthYear(m.key), sel.count(m.ids), m.ids.length)}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="tl-filter" role="group" aria-label={t.orderLabel}>
              {ORDERS.map((o) => (
                <button key={o} type="button" className="chip chip-sm" aria-pressed={order === o} onClick={() => chooseOrder(o)}>{t.orders[o]}</button>
              ))}
            </div>
          </div>
        </div>

        {/* T50/T59: "Show only" sits under the sticky bar, not in it, so the bar stays short (QA m1). */}
        <div className="tl-show">
          <div className="tl-filter tl-filter-show" role="group" aria-label={t.filterLabel}>
            {FILTERS.filter((f) => !HINT_FILTERS.has(f) || counts[f] > 0 || filter === f).map((f) => (
              <button key={f} type="button" className="chip chip-sm" aria-pressed={filter === f} onClick={() => chooseFilter(f)}>
                {t.filters[f]} <span className="chip-n">{t.filterCount(counts[f])}</span><span className="sr-only">{t.filterCountUnit(counts[f])}</span>
              </button>
            ))}
          </div>
          {filter !== 'all' && (
            <div className="tl-showing">
              <p className="sub-sm"><strong>{t.showing(shownCount, kept.length)}</strong> {t.filterOnlyShows}</p>
              {(filter === 'screenshots' || filter === 'chat') && shownCount > 0 && <p className="note-box">{t.lookNote[filter]}</p>}
            </div>
          )}
        </div>

        {tl.months.length === 0 && (
          <div className="tl-empty">
            <p className="note-box">{t.emptyFilter[filter]}</p>
            {filter !== 'all' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => chooseFilter('all')}>{t.showAll}</button>}
          </div>
        )}

        {filter === 'unselected' && tl.months.length > 0 && <p className="note-box">{t.unselectedNote}</p>}

        {bySize && sizeIds.length > 0 && <p className="sub-sm">{t.sizeNote}</p>}

        {!bySize && tl.months.map((m) => (
          <MonthSection key={m.key} m={m} sel={sel} byIndex={byIndex} files={files} width={width} cols={cols} gap={gap} onSet={set} onToggle={toggle} onOpen={setViewing} hold={hold} />
        ))}

        {bySize && sizeIds.length > 0 && (
          <div className="tl-rows">
            {sizeBlocks.map((b) => (
              <Lazy key={b[0]} estimate={b.length * ROW - 8} sizeKey="size" hold={hold !== undefined && b.includes(hold)}>
                {() => (
                  <div className="tl-rows-block">
                    {b.map((id) => (
                      <SizeRow key={id} r={byIndex[id]} file={files[id]} name={labelOf(id)} on={sel.has(id)} onChange={(on) => set([id], on)} onOpen={() => setViewing(id)} />
                    ))}
                  </div>
                )}
              </Lazy>
            ))}
          </div>
        )}

        <div>{topBtn(false)}</div>

        {setAside > 0 && (
          <section className="aside tl-aside" aria-label={copy.results.asideSafeTitle}>
            <p className="sub">{t.asideLine(setAside)}</p>
            {backBtn}
          </section>
        )}
        {setAside === 0 && backBtn}
      </div>

      {/* Narrow screens, and wide ones too short for the sticky jump bar: the count and the button stay at the bottom of the window. */}
      <div className="tl-footer" ref={footRef}>
        <div className="tl-footer-line"><span className="tl-footer-count" aria-hidden="true">{t.footerCount(sum.selected, sum.total)}{bySize && <span className="tl-size-total"> · {t.footerSize(bytes(sum.selectedBytes))}</span>}</span><span>{t.footerDeleted}</span>{topBtn(true)}</div>
        {saveBtn('save-why')}
      </div>

      {viewing !== undefined && (
        <Viewer
          ids={shownIds}
          startId={viewing}
          record={(id) => byIndex[id]}
          files={files}
          label={labelOf}
          detail={bySize ? (id) => bytes(byIndex[id].size) : undefined}
          selected={(id) => sel.has(id)}
          onSelect={(id, on) => set([id], on)}
          onClose={closeViewer}
        />
      )}
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
  onOpen: (id: number) => void;
  hold?: number;
};

function MonthSection({ m, sel, byIndex, files, width, cols, gap, onSet, onToggle, onOpen, hold }: SectionProps) {
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
          <Lazy key={b.key} estimate={estimate(b)} sizeKey={`${cols}:${Math.round(tile)}`} hold={hold !== undefined && b.ids.includes(hold)}>
            {() => (
              <div className="tl-day" data-day={b.day.key}>
                {b.first && !isNone && <DayHead ymd={b.day.key} state={sel.state(b.day.ids)} count={sel.count(b.day.ids)} total={b.day.ids.length} onToggle={() => onToggle(b.day.ids, weekdayDayMonth(b.day.key))} />}
                <div className="tl-grid">
                  {b.ids.map((id, k) => (
                    <Tile key={id} r={byIndex[id]} file={files[id]} pos={b.start + k + 1} of={b.day.ids.length} on={sel.has(id)} onChange={(on) => onSet([id], on)} onOpen={() => onOpen(id)} />
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

/** A tile's name (its checkbox's, and in the viewer the photo's). */
function tileName(r: FileRecord, pos?: number, of?: number) {
  const type = mediaType(r);
  return t.tileLabel(type, r.takenAt, pos, of, r.durationSec, type === 'video' && playableHere(r) === false);
}

type TileProps = { r: FileRecord; file: File; pos: number; of: number; on: boolean; onChange: (on: boolean) => void; onOpen: () => void };
function Tile({ r, file, pos, of, on, onChange, onOpen }: TileProps) {
  const type = mediaType(r);
  // The tick animates only on the tile the person just ticked or unticked (never on mount: tiles
  // mount as they scroll in, and Select all would animate them all). A new number restarts it.
  const [just, setJust] = useState(0);
  useEffect(() => {
    if (!just) return;
    const timer = setTimeout(() => setJust(0), 300);
    return () => clearTimeout(timer);
  }, [just]);
  // Only a label: a video this browser can't play is selected and saved like any other (T61).
  const cantPlay = type === 'video' && playableHere(r) === false;
  const [noPreview, setNoPreview] = useState(false);
  const name = noPreview ? copy.results.noPreviewName(tileName(r, pos, of)) : tileName(r, pos, of);
  return (
    <figure className={`print tl-tile${on ? '' : ' off'}`} data-just={just ? '' : undefined}>
      {/* D24: the whole tile opens the viewer; the checkbox sits on top of it (and comes after it in Tab order). */}
      {/* Named by hidden text, not aria-label: the picture's own words (file type, can't-play note) are hidden from screen readers here (2.5.3). */}
      <button type="button" className="tile-open" data-view={r.index} onClick={onOpen}>
        <span className="sr-only">{copy.viewer.open(name)}</span>
        <span className="tile-open-pic" aria-hidden="true">
          <Preview file={file} record={r} size="fill" note={cantPlay ? t.cantPlay : undefined} noteShort={cantPlay ? t.cantPlayShort : undefined} onNoPreview={setNoPreview} />
        </span>
      </button>
      <label className="chk">
        <input type="checkbox" checked={on} onChange={(e) => { setJust((k) => k + 1); onChange(e.target.checked); }} aria-label={name} />
        <span className="dot" aria-hidden="true" key={just}>
          {on && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.4l2.9 2.9 6.1-6.3" stroke="#FFFFFF" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" pathLength={1} /></svg>}
        </span>
      </label>
      {type === 'video' ? (
        // T63: the length pill and the time share one row. When a tile is too narrow for both
        // (desktop tiles are ~90-110 px), the time drops out whole rather than being cut to "10:";
        // the checkbox name always has both.
        <div className="vid-row" aria-hidden="true">
          <span className="vid" title={t.video}>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>
            {r.durationSec !== undefined && <span className="vid-len">{runTime(r.durationSec)}</span>}
          </span>
          {r.takenAt && <span className="tag">{clock(r.takenAt)}</span>}
        </div>
      ) : (
        r.takenAt && <figcaption className="tag" aria-hidden="true">{clock(r.takenAt)}</figcaption>
      )}
    </figure>
  );
}

/** The file's own name, for telling rows apart by ear (T89 QA); a very long one is cut to 40 characters. */
function shortFileName(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const chars = Array.from(name);
  return chars.length > 40 ? `${chars.slice(0, 39).join('')}…` : name;
}

type RowProps = { r: FileRecord; file: File; name: string; on: boolean; onChange: (on: boolean) => void; onOpen: () => void };
/**
 * T60: one file in the Largest first list: its checkbox, a small preview (which opens the viewer,
 * like a tile), its size and its date. The checkbox's name has all of it, size first.
 */
function SizeRow({ r, file, name: ownName, on, onChange, onOpen }: RowProps) {
  const type = mediaType(r);
  const [noPreview, setNoPreview] = useState(false);
  const name = noPreview ? copy.results.noPreviewName(ownName) : ownName;
  const cantPlay = type === 'video' && playableHere(r) === false;
  const size = bytes(r.size);
  const own = shortFileName(r.path);
  return (
    <div className={`tl-row${on ? '' : ' off'}`}>
      <label className="tl-row-chk">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} aria-label={t.sizeRowLabel(size, name, own)} />
      </label>
      <button type="button" className="gf-open" data-view={r.index} onClick={onOpen}>
        <span className="sr-only">{copy.viewer.open(t.sizeRowOpen(name, own))}</span>
        <span aria-hidden="true"><Preview file={file} record={r} size="sm" onNoPreview={setNoPreview} /></span>
      </button>
      <div className="gf-text" aria-hidden="true">
        <span className="tl-row-size">{size}</span>
        <span className="sub-sm">
          {r.takenAt ? dateTime(r.takenAt) : t.noDate} · {t.rowKind[type]}
          {type === 'video' && r.durationSec !== undefined && ` · ${runTime(r.durationSec)}`}
          {cantPlay && ` · ${t.cantPlayShort}`}
        </span>
      </div>
    </div>
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
  // The review timeline, or a set-aside group's list of every file (D23).
  const scope = target instanceof Element ? target.closest('.tl-col, .gf-list') : null;
  if (target instanceof Element && scope) {
    const blocks = [...scope.querySelectorAll('.tl-block')].filter((b) => forcers.has(b)); // in page order
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

/** Draws its children only near the screen (or when `hold` is set). Also used by the set-aside lists (GroupFiles). */
export function Lazy({ estimate, sizeKey, hold = false, children }: { estimate: number; sizeKey: string; hold?: boolean; children: () => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [observed, setNear] = useState(false);
  const [pinned, setPinned] = useState(false);
  const near = observed || pinned || hold;
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
