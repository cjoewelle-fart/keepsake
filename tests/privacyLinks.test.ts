// D48: the privacy page's links. "Nothing is hidden" and "See the code" appear only once REPO_URL
// (src/brand.ts) is set; the open-source notices link (an app file, same address) is always there.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_NAME, REPO_URL } from '../src/brand';
import { copy, privacyMd } from '../src/ui/copy';
import { FILE_LINKS, OUTSIDE_LINKS, anchors, inline, parse } from '../src/ui/markdown';
import type { Block, Inline } from '../src/ui/markdown';

const links = (doc: Block[]) => {
  const out: Inline[] = [];
  const walkI = (c: Inline[]) => c.forEach((x) => { if (x.t === 'link') out.push(x); if (x.t === 'b' || x.t === 'link') walkI(x.c); });
  const walk = (bs: Block[]) => bs.forEach((b) => { if (b.t === 'h') walkI(b.c); else if (b.t === 'p') b.lines.forEach(walkI); else if (b.t === 'list') b.items.forEach(walk); });
  walk(doc);
  return out as Extract<Inline, { t: 'link' }>[];
};
const headings = (doc: Block[]) => doc.filter((b) => b.t === 'h').map((b) => (b as Extract<Block, { t: 'h' }>).id);

describe('privacy page links', () => {
  it('ships with the public repository (Nov 13, renamed to upsort): "Nothing is hidden" and "See the code" link to it', () => {
    expect(REPO_URL).toBe('https://github.com/cjoewelle-fart/upsort');
    expect(OUTSIDE_LINKS).toEqual([REPO_URL]);
    const doc = parse(copy.info.privacy.md);
    expect(copy.info.privacy.md).toBe(privacyMd(REPO_URL));
    expect(headings(doc)).toContain('nothing-is-hidden');
    expect(links(doc).filter((l) => l.away).map((l) => l.href).sort()).toEqual(['THIRD_PARTY_NOTICES.txt', REPO_URL].sort());
  });

  it('always links the open-source notices, the app\'s own file', () => {
    expect(FILE_LINKS).toEqual(['THIRD_PARTY_NOTICES.txt']);
    for (const md of [privacyMd(''), privacyMd('https://github.com/example/app')]) {
      expect(md).toContain('[Open-source notices](THIRD_PARTY_NOTICES.txt)');
      expect(links(parse(md)).find((l) => l.href === 'THIRD_PARTY_NOTICES.txt')).toMatchObject({ away: true, c: [{ t: 'text', v: 'Open-source notices' }] });
    }
    // The build serves the file (scripts/make_notices.mjs), and it names the LGPL decoder parts.
    const notices = readFileSync(join(__dirname, '..', 'public', 'THIRD_PARTY_NOTICES.txt'), 'utf8');
    expect(notices).toMatch(/libheif/);
    expect(notices).toMatch(/libde265/);
  });

  it('with a repository set: "Nothing is hidden" before "How to check for yourself", with its text and link', () => {
    const md = privacyMd('https://github.com/example/app');
    expect(md).toContain(`## Nothing is hidden\n\n${APP_NAME} is free and open source. That means anyone can read the instructions the app is made from, check what it does, and point out problems.\n[See the code](https://github.com/example/app)\n\n## How to check for yourself`);
    const doc = parse(md);
    expect(headings(doc)).toContain('nothing-is-hidden');
    // Every same-page link still leads to a heading; app files and the repository aren't counted.
    const { links: same, ids } = anchors(doc);
    for (const l of same) expect(ids).toContain(l);
  });

  it('only links the repository that REPO_URL names; any other outside address stays plain words', () => {
    // Only REPO_URL itself is a link; any other repository-looking address is not.
    expect(inline('[See the code](https://github.com/example/app)')).toEqual([{ t: 'text', v: 'See the code' }]);
    expect(inline('[x](https://example.com/THIRD_PARTY_NOTICES.txt)')).toEqual([{ t: 'text', v: 'x' }]);
    expect(inline('[x](../THIRD_PARTY_NOTICES.txt)')).toEqual([{ t: 'text', v: 'x' }]);
    expect(inline('[x](other.txt)')).toEqual([{ t: 'text', v: 'x' }]);
  });

  it('opens app files and the repository in a new tab with no opener or referrer', () => {
    const src = readFileSync(join(__dirname, '..', 'src', 'ui', 'InfoPage.tsx'), 'utf8');
    expect(src).toContain('target="_blank" rel="noopener noreferrer"');
  });

  it('the offline cache leaves the notices out and lets them open as a file', () => {
    const config = readFileSync(join(__dirname, '..', 'vite.config.ts'), 'utf8');
    expect(config).toMatch(/globPatterns: \['\*\*\/\*\.\{html,js,css,woff,woff2,wasm,svg,png,webp\}'\]/); // no .txt
    expect(config).toContain('navigateFallbackDenylist: [/\\.txt$/]');
  });
});
