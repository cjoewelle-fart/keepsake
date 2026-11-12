// The in-app reading pages (T67): the privacy page and the PhotoRec guide, opened from the start
// screen. Text lives in copy.info, in the small Markdown of markdown.ts; this draws it.
import { Fragment, useMemo } from 'react';
import type { ReactNode } from 'react';
import { copy } from './copy';
import { parse } from './markdown';
import type { Block, Inline } from './markdown';

// Heading ids get a prefix, so a page's headings can't clash with the app's own ids.
const ID = 'doc-';

function Words({ c }: { c: Inline[] }): ReactNode {
  return c.map((x, i) =>
    x.t === 'text' ? <Fragment key={i}>{x.v}</Fragment>
      : x.t === 'code' ? <code key={i}>{x.v}</code>
        : x.t === 'b' ? <strong key={i}><Words c={x.c} /></strong>
          : x.away
            // An app file or the repository: a new tab, so the page (and anything chosen) stays put.
            ? <a key={i} href={x.href} target="_blank" rel="noopener noreferrer"><Words c={x.c} /></a>
            : <a key={i} href={`#${ID}${x.href.slice(1)}`}><Words c={x.c} /></a>,
  );
}

function Lines({ lines }: { lines: Inline[][] }) {
  return lines.map((l, i) => <Fragment key={i}>{i > 0 && <br />}<Words c={l} /></Fragment>);
}

function Blocks({ blocks }: { blocks: Block[] }): ReactNode {
  return blocks.map((b, i) => {
    switch (b.t) {
      case 'h': {
        const H = `h${b.level}` as const;
        // The h1 takes focus when the page opens (as every screen's heading does).
        return <H key={i} id={ID + b.id} tabIndex={-1}><Words c={b.c} /></H>;
      }
      case 'p':
        return <p key={i}><Lines lines={b.lines} /></p>;
      case 'list': {
        const items = b.items.map((item, j) => (
          <li key={j}>
            {/* The item's first line is its text; anything after it (a sub-list, a screenshot) follows. */}
            {item[0]?.t === 'p' ? <Lines lines={item[0].lines} /> : <Blocks blocks={[item[0]]} />}
            <Blocks blocks={item.slice(1)} />
          </li>
        ));
        return b.ordered ? <ol key={i} start={b.start === 1 ? undefined : b.start}>{items}</ol> : <ul key={i}>{items}</ul>;
      }
      case 'shot':
        return (
          <figure key={i} className="shot-todo">
            <figcaption>{copy.info.shot(b.what)}</figcaption>
          </figure>
        );
      case 'rule':
        return <hr key={i} />;
    }
  });
}

/** `cta`: a primary button after the text that also goes to the start screen (the guide's, T83). */
export function InfoPage({ md, onBack, cta }: { md: string; onBack: () => void; cta?: string }) {
  const doc = useMemo(() => parse(md), [md]);
  return (
    <main className="page narrow info">
      <div><button type="button" className="btn btn-link" onClick={onBack}>{copy.info.back}</button></div>
      <article className="doc">
        <Blocks blocks={doc} />
      </article>
      <div className="actions">
        {cta && <button type="button" className="btn btn-primary" onClick={onBack}>{cta}</button>}
        <button type="button" className="btn btn-secondary" onClick={onBack}>{copy.info.back}</button>
      </div>
    </main>
  );
}
