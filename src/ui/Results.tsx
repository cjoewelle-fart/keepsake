import { useMemo, useState } from 'react';
import { PHOTO_KINDS } from '../engine/sniff';
import { effectiveGroup, summarize } from '../engine/summary';
import type { SetAsideGroup } from '../engine/summary';
import type { FileRecord } from '../engine/types';
import { SET_ASIDE_GROUPS } from '../engine/types';
import { copy, n } from './copy';
import { Preview } from './Preview';

type Props = {
  records: FileRecord[];
  files: File[];
  movedBack: ReadonlySet<SetAsideGroup>;
  onToggleGroup: (g: SetAsideGroup) => void;
  onReview: () => void;
  onStartOver: () => void;
};

const SEGMENT_SHADES: Record<SetAsideGroup, string> = { small: '#C9D2CF', duplicate: '#B3BEBA', damaged: '#9DAAA6', system: '#8A9894' };

/** Pick k items spread evenly through a list (so previews span the whole date range). */
const spread = <T,>(xs: T[], k: number) =>
  xs.length <= k ? xs : Array.from({ length: k }, (_, i) => xs[Math.floor((i * xs.length) / k)]);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="icon">
    <path d="M10 2l6 2.5v5c0 4-2.6 6.8-6 8.5-3.4-1.7-6-4.5-6-8.5v-5L10 2z" stroke="#0D615D" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

export function Results({ records, files, movedBack, onToggleGroup, onReview, onStartOver }: Props) {
  const s = useMemo(() => summarize(records, movedBack), [records, movedBack]);
  const [open, setOpen] = useState<SetAsideGroup | null>(null);

  const keepers = useMemo(() => {
    const k = records.filter((r) => effectiveGroup(r, movedBack) === 'keep' && PHOTO_KINDS.has(r.kind));
    return k.sort((a, b) => (a.takenAt ?? '9999').localeCompare(b.takenAt ?? '9999'));
  }, [records, movedBack]);
  const previews = spread(keepers, 11);

  const byGroup = useMemo(() => {
    const m = { small: [], duplicate: [], damaged: [], system: [] } as Record<SetAsideGroup, FileRecord[]>;
    for (const r of records) if (r.group !== 'keep') m[r.group].push(r);
    return m;
  }, [records]);

  const visibleGroups = SET_ASIDE_GROUPS.filter((g) => s.groups[g] > 0);
  const pct = (x: number) => (s.total ? Math.max(x > 0 ? 0.6 : 0, (100 * x) / s.total) : 0);
  const years = s.firstYear === undefined ? copy.results.noDates : s.firstYear === s.lastYear ? String(s.firstYear) : `${s.firstYear}–${s.lastYear}`;

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">{copy.results.eyebrow(s.total)}</p>
        {s.keep > 0 ? (
          <h1 tabIndex={-1}>
            {copy.results.titleBefore}
            <span className="accent">{n(s.keep)}</span>
            {copy.results.titleAfter(s.keep)}
          </h1>
        ) : (
          <h1 tabIndex={-1}>{copy.empty.noKeepers}</h1>
        )}
        <p className="lede">{s.keep > 0 ? copy.results.body(s.setAside) : copy.empty.noKeepersBody}</p>
      </section>

      <section className="card breakdown" aria-label="Breakdown of recovered files">
        <div className="bar" role="img" aria-label={`${n(s.keep)} files kept, ${n(s.setAside)} set aside`}>
          <div style={{ width: `${pct(s.keep)}%`, background: '#0D615D' }} />
          {SET_ASIDE_GROUPS.filter((g) => !movedBack.has(g)).map((g) => (
            <div key={g} style={{ width: `${pct(s.groups[g])}%`, background: SEGMENT_SHADES[g] }} />
          ))}
        </div>
        <div className="legend">
          <span className="legend-item"><span className="swatch" style={{ background: '#0D615D' }} /><strong>{copy.results.keepingLegend(s.keep)}</strong></span>
          <span className="legend-item"><span className="swatch" style={{ background: '#9DAAA6' }} />{copy.results.asideLegend(s.setAside)}</span>
          {s.keep > 0 && <span className="muted">{copy.results.ratio(s.total, s.keep)}</span>}
        </div>
      </section>

      <div className="columns">
        <section className="card keep-card" aria-labelledby="keep-h">
          <div>
            <h2 id="keep-h">{copy.results.readyTitle}</h2>
            <p className="sub">{copy.results.readySub}</p>
          </div>
          <div className="stats">
            <div className="stat"><div className="stat-num">{n(s.photos)}</div><div className="stat-label">{copy.results.photos}</div></div>
            <div className="stat"><div className="stat-num">{n(s.videos)}</div><div className="stat-label">{copy.results.videos}</div></div>
            <div className="stat"><div className="stat-num">{years}</div><div className="stat-label">{copy.results.dateRange}</div></div>
          </div>
          {s.others > 0 && <p className="sub">{copy.results.otherFiles}: {n(s.others)}</p>}
          {previews.length > 0 && (
            <div className="grid-previews">
              {previews.map((r) => <Preview key={r.index} file={files[r.index]} record={r} />)}
              {keepers.length > previews.length && (
                <div className="tile tile-md tile-more" aria-label={`${n(keepers.length - previews.length)} more photos`}>
                  {copy.results.morePreviews(keepers.length - previews.length)}
                </div>
              )}
            </div>
          )}
          {s.undated > 0 && (
            <div className="callout">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="icon">
                <circle cx="10" cy="10" r="8" stroke="#8A4B08" strokeWidth="1.8" />
                <path d="M10 6v4.5l3 1.8" stroke="#8A4B08" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <p><strong>{copy.results.undated(s.undated)}</strong> {copy.results.undatedMore}</p>
            </div>
          )}
        </section>

        {visibleGroups.length > 0 && (
          <section className="card aside-card" aria-labelledby="aside-h">
            <div>
              <h2 id="aside-h">{copy.results.asideTitle}</h2>
              <p className="sub">{copy.results.asideSub}</p>
            </div>
            <ul className="groups">
              {visibleGroups.map((g) => {
                const isOpen = open === g;
                const moved = movedBack.has(g);
                const panelId = `group-${g}`;
                return (
                  <li key={g} className={`group ${moved ? 'moved' : ''}`}>
                    <button type="button" className="group-head" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpen(isOpen ? null : g)}>
                      <span className="group-text">
                        <strong>{copy.groups[g].title}</strong>
                        <span className="sub-sm">{copy.results.files(s.groups[g])}{moved ? ` · ${copy.results.movedBack}` : ''}</span>
                      </span>
                      <span className="group-toggle">{isOpen ? copy.results.hide : copy.results.peek}</span>
                    </button>
                    {isOpen && (
                      <div className="group-body" id={panelId}>
                        <p>{copy.groups[g].why}</p>
                        <div className="peek-row">
                          {byGroup[g].slice(0, 6).map((r) => <Preview key={r.index} file={files[r.index]} record={r} size="sm" />)}
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onToggleGroup(g)}>
                          {moved ? copy.results.undo : copy.results.moveBack}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <section className="footer-bar">
        <p className="privacy"><ShieldIcon />{copy.privacy}</p>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onStartOver}>{copy.results.startOver}</button>
          {s.keep > 0 && <button type="button" className="btn btn-primary" onClick={onReview}>{copy.results.review(s.keep, s.others === 0)} →</button>}
        </div>
      </section>
    </main>
  );
}
