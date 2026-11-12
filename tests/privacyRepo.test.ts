// D48, the other state: once REPO_URL is set (the repo is public), the privacy page shows
// "Nothing is hidden" and links the repository, and only that outside address.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/brand', async (orig) => ({ ...(await orig<typeof import('../src/brand')>()), REPO_URL: 'https://github.com/example/app' }));

describe('privacy page with REPO_URL set', () => {
  it('shows "Nothing is hidden" with a "See the code" link to the repository', async () => {
    const { copy } = await import('../src/ui/copy');
    const { OUTSIDE_LINKS, inline, parse } = await import('../src/ui/markdown');
    expect(OUTSIDE_LINKS).toEqual(['https://github.com/example/app']);
    const md = copy.info.privacy.md;
    expect(md).toContain('## Nothing is hidden');
    expect(md).toContain('[See the code](https://github.com/example/app)');
    expect(md).toContain('[Open-source notices](THIRD_PARTY_NOTICES.txt)');
    const doc = parse(md);
    expect(doc.some((b) => b.t === 'h' && b.id === 'nothing-is-hidden')).toBe(true);
    expect(inline('[See the code](https://github.com/example/app)')).toEqual([{ t: 'link', href: 'https://github.com/example/app', c: [{ t: 'text', v: 'See the code' }], away: true }]);
    expect(inline('[x](https://github.com/someone/else)')).toEqual([{ t: 'text', v: 'x' }]);
  });
});
