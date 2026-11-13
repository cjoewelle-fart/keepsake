// Owner, Nov 13: the start screen's footer links to the public code, as plain words.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_URL } from '../src/brand';
import { copy } from '../src/ui/copy';

describe('start screen "Source code" link', () => {
  const app = readFileSync(join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
  it('is plain text that opens REPO_URL in a new tab, with no opener or referrer', () => {
    expect(copy.start.sourceCode).toBe('Source code');
    expect(app).toContain('{REPO_URL && <a className="start-foot-code" href={REPO_URL} target="_blank" rel="noopener noreferrer">{copy.start.sourceCode}</a>}');
    expect(REPO_URL).toMatch(/^https:\/\/github\.com\/\S+$/);
  });
  it('sits inside the start footer, after the tagline', () => {
    const foot = app.slice(app.indexOf('<footer className="start-foot">'), app.indexOf('</footer>'));
    expect(foot.indexOf('start-foot-line')).toBeGreaterThan(-1);
    expect(foot.indexOf('start-foot-code')).toBeGreaterThan(foot.indexOf('start-foot-line'));
  });
});
