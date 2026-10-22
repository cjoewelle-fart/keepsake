// A small Markdown for the in-app pages (privacy page, PhotoRec guide), so the UX writer can keep
// writing them the way the drafts are written. Pure: text in, a tree out; InfoPage.tsx draws it
// with React elements (no HTML strings). The syntax it knows is listed at copy.info.
//
// Links may only point at a heading on the same page ("#…"): anything else stays plain text, so
// a page can never make the browser go to, or fetch from, another address.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'b'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; c: Inline[] };

export type Block =
  | { t: 'h'; level: 1 | 2 | 3; id: string; c: Inline[] }
  /** One entry per line: a line break inside a paragraph stays a line break. */
  | { t: 'p'; lines: Inline[][] }
  | { t: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { t: 'shot'; what: string }
  | { t: 'rule' };

/** A heading's id, GitHub style: "Part 4A: Search with QPhotoRec (Windows)" → "part-4a-search-with-qphotorec-windows". */
export const slug = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-');

const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function inline(s: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  for (const m of s.matchAll(INLINE)) {
    if (m.index > at) out.push({ t: 'text', v: s.slice(at, m.index) });
    if (m[1] !== undefined) out.push({ t: 'b', c: inline(m[1]) });
    else if (m[2] !== undefined) out.push({ t: 'code', v: m[2] });
    else if (m[4].startsWith('#') && m[4].length > 1) out.push({ t: 'link', href: m[4], c: inline(m[3]) });
    else out.push({ t: 'text', v: m[3] }); // not a same-page link: its words only
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push({ t: 'text', v: s.slice(at) });
  return out;
}

/** Plain words of some inline content (for heading ids). */
export const plain = (c: Inline[]): string => c.map((x) => (x.t === 'text' || x.t === 'code' ? x.v : plain(x.c))).join('');

const ITEM = /^( *)(-|\d+\.) (.*)$/;
const HEADING = /^(#{1,3}) (.+)$/;
const SHOT = /^\[Screenshot: (.+)\]$/;
const indentOf = (line: string) => line.length - line.trimStart().length;

export function parse(md: string): Block[] {
  return blocks(md.replace(/\r\n?/g, '\n').split('\n'));
}

function blocks(lines: string[]): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const text = line.trim();
    if (!text) { i++; continue; }
    const h = HEADING.exec(text);
    if (h && indentOf(line) === 0) {
      const c = inline(h[2]);
      out.push({ t: 'h', level: h[1].length as 1 | 2 | 3, id: slug(plain(c)), c });
      i++;
      continue;
    }
    if (text === '---') { out.push({ t: 'rule' }); i++; continue; }
    const shot = SHOT.exec(text);
    if (shot) { out.push({ t: 'shot', what: shot[1] }); i++; continue; }
    if (ITEM.test(line)) { i = list(lines, i, out); continue; }
    // A paragraph: lines up to a blank line or the start of another kind of block.
    const para: Inline[][] = [];
    while (i < lines.length) {
      const l = lines[i];
      const tl = l.trim();
      if (!tl || HEADING.test(tl) || tl === '---' || SHOT.test(tl) || ITEM.test(l)) break;
      para.push(inline(tl));
      i++;
    }
    out.push({ t: 'p', lines: para });
  }
  return out;
}

/** A list starting at lines[i]; returns the index after it. Lines indented past the marker belong to its item. */
function list(lines: string[], i: number, out: Block[]): number {
  const first = ITEM.exec(lines[i])!;
  const indent = first[1].length;
  const ordered = first[2] !== '-';
  const items: Block[][] = [];
  while (i < lines.length) {
    const m = ITEM.exec(lines[i]);
    if (!m || m[1].length !== indent || (m[2] !== '-') !== ordered) break;
    const inner = indent + m[2].length + 1;
    const body = [m[3]];
    i++;
    // The item's own lines: indented past this list's markers, until a blank line or a line that isn't.
    while (i < lines.length && lines[i].trim() && indentOf(lines[i]) > indent) {
      body.push(lines[i].slice(Math.min(inner, indentOf(lines[i]))));
      i++;
    }
    // The first line is the item's text; the rest are blocks inside it (a sub-list, a screenshot, more text).
    const rest = body.slice(1);
    const own: Block = { t: 'p', lines: [inline(body[0])] };
    items.push([own, ...blocks(rest)]);
  }
  out.push({ t: 'list', ordered, start: ordered ? Number(first[2].slice(0, -1)) : 1, items });
  return i;
}

/** Every same-page link target, and every heading id, for checking a page's links all lead somewhere. */
export function anchors(doc: Block[]): { links: string[]; ids: string[] } {
  const links: string[] = [];
  const ids: string[] = [];
  const walkInline = (c: Inline[]) => c.forEach((x) => { if (x.t === 'link') links.push(x.href.slice(1)); if (x.t === 'b' || x.t === 'link') walkInline(x.c); });
  const walk = (bs: Block[]) => bs.forEach((b) => {
    if (b.t === 'h') { ids.push(b.id); walkInline(b.c); }
    else if (b.t === 'p') b.lines.forEach(walkInline);
    else if (b.t === 'list') b.items.forEach(walk);
  });
  walk(doc);
  return { links, ids };
}
