// T85: the hosting headers (`_headers`, read by Cloudflare Pages and Netlify) send the same
// privacy lock-down as the <meta> CSP in index.html, and never loosen it.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CSP, CSP_PAGE_PATHS, cspFromHeaders, cspFromHtml, cspMeta, deployFiles, headersFile, workerPaths, workerSplitProblems } from '../vite.deploy';

const directives = (csp: string) => new Map(csp.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
  const [name, ...values] = d.split(/\s+/);
  return [name, values.join(' ')] as const;
}));
const metaFor = (html: string) => {
  const hook = cspMeta().transformIndexHtml as (html: string) => string;
  return cspFromHtml(hook(html));
};
/** `_headers` as path -> [name, value][], keeping a path that appears twice as two entries. */
const parse = (text: string) => {
  const out: [string, [string, string][]][] = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (!/^\s/.test(line)) out.push([line.trim(), []]);
    else { const i = line.indexOf(':'); out.at(-1)![1].push([line.slice(0, i).trim(), line.slice(i + 1).trim()]); }
  }
  return out;
};

const files = {
  'assets/thumb.worker-AAA.js': 'self.onmessage = () => {}',
  'assets/heic.worker-BBB.js': 'const m = new WebAssembly.Module(bytes)',
  'assets/heic.worker-CCC.js': 'function e(e){return new Worker(new URL(`heic.worker-BBB.js`,import.meta.url).href,{type:`module`,name:e?.name})}export{e as default};',
  'assets/index-DDD.js': 'console.log(1)',
};

describe('hosting headers (_headers)', () => {
  const workers = workerPaths(files);
  const text = headersFile(workers);

  it('send exactly the <meta> CSP on the page and the service worker', () => {
    const meta = metaFor('<html><head><title>Keepsake</title></head></html>');
    expect(meta).toEqual([CSP]);
    for (const path of CSP_PAGE_PATHS) expect(cspFromHeaders(text, path), path).toEqual(meta);
  });

  it('keep connect-src exactly \'self\' everywhere (nothing can be sent anywhere else)', () => {
    expect(directives(CSP).get('connect-src')).toBe("'self'");
    const all = text.split('\n').filter((l) => /^\s+Content-Security-Policy:/.test(l));
    expect(all.length).toBe(CSP_PAGE_PATHS.length + workers.locked.length);
    for (const line of all) {
      const value = line.replace(/^\s+Content-Security-Policy:\s*/, '');
      expect(value).toBe(CSP); // no second, looser policy anywhere in the file
      expect(directives(value).get('connect-src')).toBe("'self'");
    }
  });

  it('lock plain workers, leave the WebAssembly decoder as it is today, skip the page-side wrappers', () => {
    expect(workers).toEqual({ locked: ['/assets/thumb.worker-AAA.js'], wasm: ['/assets/heic.worker-BBB.js'] });
    expect(cspFromHeaders(text, '/assets/thumb.worker-AAA.js')).toEqual([CSP]);
    expect(cspFromHeaders(text, '/assets/heic.worker-BBB.js')).toEqual([]);
  });

  it('set each header once per response: nothing doubled on /*, one block per path', () => {
    const rules = parse(text);
    const paths = rules.map(([p]) => p);
    expect(new Set(paths).size).toBe(paths.length);
    const get = (path: string) => new Map(rules.find(([p]) => p === path)?.[1]);
    expect([...get('/*')]).toEqual([
      ['X-Robots-Tag', 'noindex, nofollow'],
      ['Referrer-Policy', 'no-referrer'],
      ['X-Content-Type-Options', 'nosniff'],
      ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
    ]);
    for (const p of ['/', '/index.html', '/sw.js', '/registerSW.js', '/manifest.webmanifest']) expect(get(p).get('Cache-Control'), p).toBe('no-cache');
    expect(get('/assets/*').get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    // A worker in /assets/ gets its CSP from its own rule and its caching from /assets/* only.
    expect(get('/assets/thumb.worker-AAA.js').has('Cache-Control')).toBe(false);
  });

  it('make the build fail if the HEIC decoder would get the CSP header (or goes missing)', () => {
    expect(workerSplitProblems(workers)).toEqual([]);
    // A rebuilt decoder whose WebAssembly call the pattern misses lands in "locked".
    const missed = workerPaths({ ...files, 'assets/heic.worker-BBB.js': 'const W = self["WebAss" + "embly"]; new W.Module(bytes)' });
    expect(missed.locked).toContain('/assets/heic.worker-BBB.js');
    expect(workerSplitProblems(missed)).toEqual([
      '/assets/heic.worker-BBB.js would get the CSP header, which blocks its WebAssembly',
      'no HEIC decoder worker found in the "no CSP header" list',
    ]);
    const gone = workerPaths({ 'assets/thumb.worker-AAA.js': files['assets/thumb.worker-AAA.js'] });
    expect(workerSplitProblems(gone)).toEqual(['no HEIC decoder worker found in the "no CSP header" list']);
    // And the plugin turns that into a failed build.
    const generate = deployFiles().generateBundle as (this: unknown, o: unknown, b: Record<string, unknown>) => void;
    const ctx = { emitFile: () => '' };
    const chunk = (code: string) => ({ type: 'chunk', code });
    expect(() => generate.call(ctx, {}, { 'assets/heic.worker-BBB.js': chunk(files['assets/heic.worker-BBB.js']), 'assets/thumb.worker-AAA.js': chunk('x') })).not.toThrow();
    expect(() => generate.call(ctx, {}, { 'assets/heic.worker-BBB.js': chunk('new self["WebAss" + "embly"].Module(b)'), 'assets/thumb.worker-AAA.js': chunk('x') })).toThrow(/would get the CSP header/);
  });

  it('make the build fail if the page and the headers ever disagree', () => {
    const write = deployFiles().writeBundle as (o: unknown, b: Record<string, unknown>) => void;
    const asset = (source: string) => ({ type: 'asset', source });
    const page = (csp: string) => asset(`<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}" />`);
    expect(() => write({}, { 'index.html': page(CSP), _headers: asset(text) })).not.toThrow();
    expect(() => write({}, { 'index.html': page(CSP.replace("connect-src 'self'", 'connect-src *')), _headers: asset(text) })).toThrow(/CSP mismatch/);
    expect(() => write({}, { 'index.html': page(CSP), _headers: asset(text.replace("connect-src 'self'", "connect-src 'self' https:")) })).toThrow(/CSP mismatch/);
  });

  // The real build output, when there is one (npm run build checks this too, in vite.deploy.ts).
  it.skipIf(!existsSync('dist/_headers') || !existsSync('dist/index.html'))('match in the last build in dist/', () => {
    const built = readFileSync('dist/_headers', 'utf8');
    const meta = cspFromHtml(readFileSync('dist/index.html', 'utf8'));
    expect(meta).toEqual([CSP]);
    for (const path of CSP_PAGE_PATHS) expect(cspFromHeaders(built, path)).toEqual(meta);
    expect(directives(meta[0]).get('connect-src')).toBe("'self'");
    expect(readFileSync('dist/robots.txt', 'utf8')).toBe('User-agent: *\nDisallow: /\n');
  });
});
