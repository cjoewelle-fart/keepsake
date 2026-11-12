// Beta notes, second batch (Nov 12): rules in app.css that keep the Quiet Prints look the same at
// default settings while fixing UX3 (text size), UX10 (hover after a tap), UX12 and UX13.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { copy } from '../src/ui/copy';

const css = readFileSync(join(__dirname, '..', 'src', 'ui', 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Each rule's selector with the @media conditions around it. */
function rules(text: string): { media: string[]; selector: string; body: string }[] {
  const out: { media: string[]; selector: string; body: string }[] = [];
  const stack: string[] = [];
  let buf = '';
  for (const ch of text) {
    if (ch === '{') {
      const head = buf.trim();
      buf = '';
      stack.push(head);
    } else if (ch === '}') {
      const head = stack.pop() ?? '';
      if (!head.startsWith('@')) out.push({ media: stack.filter((h) => h.startsWith('@media')), selector: head, body: buf.trim() });
      buf = '';
    } else buf += ch;
  }
  return out;
}

describe('app.css', () => {
  const all = rules(css);
  it('reads a real set of rules', () => expect(all.length).toBeGreaterThan(300));

  it('UX10: every :hover rule only applies with a hovering pointer', () => {
    const loose = all.filter((r) => r.selector.includes(':hover') && !r.media.some((m) => /\(hover:\s*hover\)/.test(m)));
    expect(loose.map((r) => r.selector)).toEqual([]);
  });

  it('UX3: font sizes are in rem (or em, %, vw), so the browser\'s text size setting works', () => {
    const px = all.filter((r) => /(^|;)\s*font(-size)?\s*:[^;]*\dpx/.test(r.body)).map((r) => r.selector);
    expect(px).toEqual([]);
    expect(css).toMatch(/--text-small:\s*0\.9375rem/);
    expect(css).toMatch(/--control-text:\s*0\.9375rem/);
    expect(css).toMatch(/--primary-text:\s*1rem/);
  });

  it('UX12: the month picker has the pointer cursor', () => {
    expect(all.find((r) => r.selector === '.tl-month-select select')?.body).toMatch(/cursor:\s*pointer/);
  });

  // UX13 (stack the reassurance box on phones) waits for the owner: it changes the look at 390 px (D46).
  it.skip('UX13: the reassurance box stacks on phones', () => {
    const phone = all.find((r) => r.selector === '.safe-box' && r.media.some((m) => /max-width:\s*640px/.test(m)));
    expect(phone?.body).toMatch(/flex-direction:\s*column/);
  });
});

describe('copy for the second batch', () => {
  it('UX9: the folder button says it is checking while the picker is open', () => {
    expect(copy.save.checkingFolder).toBe('Checking the folder…');
  });
  it('UX11: a tile with no preview says so in its name', () => {
    expect(copy.results.noPreviewName('Save photo from 3 June 2024, 09:12')).toBe('Save photo from 3 June 2024, 09:12. No preview');
  });
});
