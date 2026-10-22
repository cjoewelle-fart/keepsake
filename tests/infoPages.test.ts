import { describe, expect, it } from 'vitest';
import { anchors, inline, parse, slug } from '../src/ui/markdown';
import type { Block } from '../src/ui/markdown';
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

  it('guide marks every screenshot as one to come', () => {
    const shots: string[] = [];
    const walk = (bs: Block[]) => bs.forEach((b) => { if (b.t === 'shot') shots.push(b.what); if (b.t === 'list') b.items.forEach(walk); });
    walk(parse(pages.guide));
    expect(shots.length).toBe(13); // every [Screenshot: …] in the draft
    expect(copy.info.shot(shots[0])).toMatch(/^Screenshot to come: /);
  });
});
