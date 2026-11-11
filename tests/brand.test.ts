// The product name lives in one setting (src/brand.ts), so a rename is a code-only change. This
// fails if the name is written out anywhere else the app, its build or its scripts read it from.
// Comments may still mention it. Old internal "Keepsake" ids are a separate matter (L56).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_NAME, LAUNCH_VIDEO, SITE_URL, TAGLINE } from '../src/brand';
import { copy } from '../src/ui/copy';

const ROOT = join(__dirname, '..');
const CODE = /\.(ts|tsx|mts|js|mjs|cjs|html|py|css)$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(p).isDirectory() ? walk(p) : CODE.test(name) ? [p] : [];
  });
}

/** The file's text without comments (line, block, JSX, HTML, Python and docstrings). */
export function stripComments(text: string, file: string): string {
  if (file.endsWith('.py')) return text.replace(/"""[\s\S]*?"""/g, '').replace(/(^|\s)#.*$/gm, '$1');
  let out = text.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // A line comment starts the line or follows a space, so "https://" in a string isn't one.
  out = out.replace(/(^|\s)\/\/.*$/gm, '$1');
  return out;
}

const files = [
  ...walk(join(ROOT, 'src')),
  ...walk(join(ROOT, 'scripts')),
  join(ROOT, 'index.html'),
  ...readdirSync(ROOT).filter((n) => /^vite.*\.ts$/.test(n)).map((n) => join(ROOT, n)),
].filter((f) => relative(ROOT, f) !== join('src', 'brand.ts'));

describe('the product name is one setting (src/brand.ts)', () => {
  it('is not written out in src/, scripts/, index.html or vite*.ts outside comments', () => {
    const name = new RegExp(`\\b${APP_NAME}\\b`, 'i');
    const hits = files.flatMap((f) =>
      stripComments(readFileSync(f, 'utf8'), f).split('\n').flatMap((line, i) => (name.test(line) ? [`${relative(ROOT, f)}:${i + 1}: ${line.trim()}`] : [])),
    );
    expect(hits).toEqual([]);
  });

  it('checks a real set of files', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith('index.html'))).toBe(true);
    expect(files.some((f) => f.endsWith('vite.config.ts'))).toBe(true);
  });

  it('feeds the copy, the save folder and the footer', () => {
    expect(copy.appName).toBe(APP_NAME);
    expect(copy.start.how.steps[1].panel[0]).toBe(`${APP_NAME} photos/`);
    expect(copy.start.tagline).toBe(TAGLINE);
  });

  it('ships with the launch settings off (D42: no address yet, D43: no video yet)', () => {
    expect(SITE_URL).toBe('');
    expect(LAUNCH_VIDEO).toBeNull();
  });

  it('strips comments without eating addresses', () => {
    expect(stripComments("const a = 'https://x' // Name\n/* Name */ b", 'a.ts')).toBe("const a = 'https://x' \n b");
    expect(stripComments('x = 1  # Name\n"""Name"""', 'a.py')).toBe('x = 1  \n');
  });
});
