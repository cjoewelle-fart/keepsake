// Release checklist §5: the launch build switch. `npm run build:launch` (vite build --mode launch)
// is indexable and needs SITE_URL; every other build stays the no-index beta build.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHARE_IMAGE, SITE_URL } from '../src/brand';
import { headTags } from '../vite.launch';
import {
  CSP, LAUNCH_NEEDS_SITE_URL, ROBOTS_TXT, ROBOTS_TXT_LAUNCH, deployFiles, headersFile, launchHtmlProblems, launchProblems, workerPaths,
} from '../vite.deploy';

const files = {
  'assets/thumb.worker-AAA.js': 'self.onmessage = () => {}',
  'assets/heic.worker-BBB.js': 'const m = new WebAssembly.Module(bytes)',
  'assets/index-DDD.js': 'console.log(1)',
};
const workers = workerPaths(files);
const ok = { publicRobots: false, shareImage: true };

describe('launch headers', () => {
  it('drop only the X-Robots-Tag line; every other header is the same', () => {
    const beta = headersFile(workers);
    const launch = headersFile(workers, CSP, { indexable: true });
    expect(beta).toContain('  X-Robots-Tag: noindex, nofollow\n');
    expect(launch).not.toMatch(/X-Robots-Tag/i);
    expect(launch).toBe(beta.replace('  X-Robots-Tag: noindex, nofollow\n', ''));
    expect(headersFile(workers, CSP, {})).toBe(beta); // the default stays the beta build
  });
  it('robots.txt allows indexing only in the launch build', () => {
    expect(ROBOTS_TXT).toBe('User-agent: *\nDisallow: /\n');
    expect(ROBOTS_TXT_LAUNCH).toBe('User-agent: *\nAllow: /\n');
  });
});

describe('launch guards', () => {
  it('ships with the launch address (D42, upsort.app), so a launch build is allowed', () => {
    expect(SITE_URL).toBe('https://upsort.app/');
    expect(launchProblems({ siteUrl: '', ...ok })[0]).toContain(LAUNCH_NEEDS_SITE_URL);
  });
  it('need an https address with the trailing slash', () => {
    for (const bad of ['', 'example.org/', 'http://example.org/', 'https://example.org', 'https:///', 'https://exa mple.org/', 'https://example.org/app']) {
      expect(launchProblems({ siteUrl: bad, ...ok }), bad).toEqual([expect.stringContaining('launch build needs SITE_URL in src/brand.ts (D42)')]);
    }
    for (const good of ['https://example.org/', 'https://www.example.org/app/']) expect(launchProblems({ siteUrl: good, ...ok }), good).toEqual([]);
  });
  it('refuse a hand-made public/robots.txt and a missing share image', () => {
    expect(launchProblems({ siteUrl: 'https://example.org/', publicRobots: true, shareImage: true })).toEqual(['public/robots.txt found: the launch build generates robots.txt, remove it']);
    expect(launchProblems({ siteUrl: 'https://example.org/', publicRobots: false, shareImage: false })).toEqual([`public/${SHARE_IMAGE} missing: the og:image tag points at it`]);
  });
  it('need the canonical and og:image tags in the built page', () => {
    const site = 'https://example.org/';
    expect(launchHtmlProblems(`<head>${headTags(site)}</head>`, site)).toEqual([]);
    expect(launchHtmlProblems(`<head>${headTags('')}</head>`, site)).toHaveLength(2);
  });
  it('the beta plugin has no launch step; the launch plugin accepts the launch address', () => {
    expect(() => (deployFiles().config as () => void).call({})).not.toThrow();
    expect(() => (deployFiles({ launch: true }).config as () => void).call({})).not.toThrow();
  });
});

describe('build config', () => {
  const config = readFileSync(join(__dirname, '..', 'vite.config.ts'), 'utf8');
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
  it('has a launch mode writing to dist-launch/, the only one passing launch', () => {
    expect(pkg.scripts['build:launch']).toBe('tsc -b && vite build --mode launch');
    expect(config).toContain("mode === LAUNCH ? { outDir: 'dist-launch' }");
    expect(config.match(/deployFiles\(\{ launch: true \}\)/g)?.length).toBe(1);
    expect(config).toMatch(/mode === LAUNCH \? \[brandHead\(\), react\(\), csp\(\), offline\(\), installTags\(\), deployFiles\(\{ launch: true \}\), precacheGuard\(\)\]/);
    expect(readFileSync(join(__dirname, '..', '.gitignore'), 'utf8')).toMatch(/^dist-launch\/$/m);
  });
});
