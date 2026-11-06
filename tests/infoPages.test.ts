import { describe, expect, it } from 'vitest';
import { anchors, inline, parse, plain, slug } from '../src/ui/markdown';
import type { Block, Inline } from '../src/ui/markdown';
import { copy } from '../src/ui/copy';

describe('the small Markdown of the in-app pages', () => {
  it('reads bold, code and same-page links; other links stay plain words', () => {
    expect(inline('Click **Yes** in `qphotorec_win.exe`, see [Part 5](#part-5-wait).')).toEqual([
      { t: 'text', v: 'Click ' }, { t: 'b', c: [{ t: 'text', v: 'Yes' }] }, { t: 'text', v: ' in ' },
      { t: 'code', v: 'qphotorec_win.exe' }, { t: 'text', v: ', see ' },
      { t: 'link', href: '#part-5-wait', c: [{ t: 'text', v: 'Part 5' }] }, { t: 'text', v: '.' },
    ]);
    expect(inline('[the code](https://example.com)')).toEqual([{ t: 'text', v: 'the code' }]);
    expect(inline('[x](#)')).toEqual([{ t: 'text', v: 'x' }]);
  });

  it('makes GitHub-style heading ids', () => {
    expect(slug('Part 4A: Search with QPhotoRec (Windows)')).toBe('part-4a-search-with-qphotorec-windows');
    expect(slug('Part 4B: Search with the text version (Mac or Windows)')).toBe('part-4b-search-with-the-text-version-mac-or-windows');
    expect(slug('What Keepsake stores')).toBe('what-keepsake-stores');
  });

  it('keeps line breaks, nests lists and screenshots inside items, and continues numbering', () => {
    const doc = parse([
      '**Watch what your browser sends.**',
      'Browsers have a tool.',
      '1. Press **F12**.',
      '2. Choose:',
      '   - **Whole** searches it all.',
      '   - **Free** is faster.',
      '   [Screenshot: the Free / Whole question]',
      '',
      '**Pick the part**',
      '',
      '3. Choose the biggest one.',
      '   You don’t need Options.',
      '---',
    ].join('\n'));
    expect(doc.map((b) => b.t)).toEqual(['p', 'list', 'p', 'list', 'rule']);
    expect((doc[0] as Extract<Block, { t: 'p' }>).lines).toHaveLength(2);
    const first = doc[1] as Extract<Block, { t: 'list' }>;
    expect(first.ordered).toBe(true);
    expect(first.items).toHaveLength(2);
    expect(first.items[1].map((b) => b.t)).toEqual(['p', 'list', 'shot']);
    const later = doc[3] as Extract<Block, { t: 'list' }>;
    expect(later.start).toBe(3);
    expect(later.items[0].map((b) => b.t)).toEqual(['p', 'p']);
  });
});

describe('privacy page and PhotoRec guide (T67)', () => {
  const pages = { privacy: copy.info.privacy.md, guide: copy.info.guide.md };

  it.each(Object.entries(pages))('%s: one h1, headings in order, every link leads to a heading', (_, md) => {
    const doc = parse(md);
    const heads = doc.filter((b): b is Extract<Block, { t: 'h' }> => b.t === 'h');
    expect(heads.filter((h) => h.level === 1)).toHaveLength(1);
    expect(heads[0].level).toBe(1);
    heads.forEach((h, i) => { if (i) expect(h.level).toBeLessThanOrEqual(heads[i - 1].level + 1); });
    const { links, ids } = anchors(doc);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of links) expect(ids).toContain(l);
  });

  it.each(Object.entries(pages))('%s: no team notes, placeholders or outside addresses', (_, md) => {
    for (const bad of ['[Name]', 'CONFIRM', '<!--', '-->', 'PLACEHOLDER', 'http://', 'https://', 'For the team']) expect(md).not.toContain(bad);
    expect(md).toContain(copy.appName);
  });

  it('privacy page leaves out what isn’t true yet', () => {
    const md = pages.privacy;
    expect(md).not.toMatch(/open source|See the code|Turn off the internet|private window|Is it free/);
    expect(md).toContain('Watch what your browser sends.');
  });

  it('guide says what you should see, as plain text inside its step, with no screenshot placeholders left', () => {
    expect(pages.guide).not.toContain('[Screenshot:');
    const seen: { line: Inline[]; inStep: boolean }[] = [];
    let shots = 0;
    const walk = (bs: Block[], inStep: boolean) => bs.forEach((b) => {
      if (b.t === 'shot') shots++;
      if (b.t === 'p') for (const l of b.lines) if (l[0]?.t === 'text' && l[0].v.startsWith('You should see: ')) seen.push({ line: l, inStep });
      if (b.t === 'list') b.items.forEach((item) => walk(item, inStep || b.ordered));
    });
    walk(parse(pages.guide), false);
    expect(shots).toBe(0);
    expect(seen).toHaveLength(13); // one for each screenshot the draft had
    expect(seen.filter((s) => s.inStep)).toHaveLength(11); // the last two (Parts 5 and 6) are their own paragraphs
    // Bold and code read as they do in the rest of the guide.
    const kinds = seen.flatMap((s) => s.line.map((x) => x.t));
    expect(kinds).toContain('b');
    expect(kinds).toContain('code');
    expect(seen.map((s) => plain(s.line)).join('\n')).not.toMatch(/\*\*|`/);
    // Part 5's line is its own paragraph, not run on from the one before it.
    const doc = parse(pages.guide);
    const part5 = doc.findIndex((b) => b.t === 'h' && b.id === 'part-5-wait');
    const p = doc[part5 + 2] as Extract<Block, { t: 'p' }>;
    expect(p.t).toBe('p');
    expect(p.lines).toHaveLength(1);
    expect(plain(p.lines[0])).toMatch(/^You should see: /);
  });

  it('guide ends PhotoRec’s part with Part 7, which points at the button under it (T83)', () => {
    const doc = parse(pages.guide);
    const heads = doc.filter((b): b is Extract<Block, { t: 'h' }> => b.t === 'h').map((h) => h.id);
    expect(heads.indexOf('part-7-sort-your-photos-with-keepsake')).toBe(heads.indexOf('part-6-what-youll-see') + 1);
    expect(pages.guide).not.toContain('Now open');
    expect(pages.guide).toContain(`**${copy.info.guide.cta}** button at the bottom of this page`);
    expect(pages.guide).toContain(`Click **${copy.start.choose}**`);
  });
});
