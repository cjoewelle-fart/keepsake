// T85: the hosting headers (`_headers`, read by Cloudflare Pages and Netlify) send the same
// privacy lock-down as the <meta> CSP in index.html, and never loosen it.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CSP, CSP_PAGE_PATHS, cspFromHeaders, cspFromHtml, cspMeta, deployFiles, headersFile, uncoveredWorkers, workerPaths, workerSplitProblems } from '../vite.deploy';

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
    expect(all.length).toBe(CSP_PAGE_PATHS.length + workers.locked.length + workers.wasm.length);
    for (const line of all) {
      const value = line.replace(/^\s+Content-Security-Policy:\s*/, '');
      expect(value).toBe(CSP); // no second, looser policy anywhere in the file
      expect(directives(value).get('connect-src')).toBe("'self'");
    }
  });

  it('allow WebAssembly with exactly \'wasm-unsafe-eval\' and nothing else new (D29)', () => {
    expect(directives(CSP).get('script-src')).toBe("'self' 'wasm-unsafe-eval'");
    expect(CSP).not.toMatch(/'unsafe-eval'/);
    expect(CSP).not.toMatch(/frame-ancestors/);
    expect(directives(CSP)).toEqual(new Map([
      ['default-src', "'self'"],
      ['script-src', "'self' 'wasm-unsafe-eval'"],
      ['style-src', "'self' 'unsafe-inline'"],
      ['img-src', "'self' blob: data:"],
      ['media-src', "'self' blob:"],
      ['font-src', "'self' data:"],
      ['worker-src', "'self' blob:"],
      ['connect-src', "'self'"],
      ['object-src', "'none'"],
      ['base-uri', "'none'"],
      ['form-action', "'none'"],
    ]));
  });

  it('lock every worker body, the WebAssembly decoder included, and skip the page-side wrappers', () => {
    expect(workers).toEqual({ locked: ['/assets/thumb.worker-AAA.js'], wasm: ['/assets/heic.worker-BBB.js'] });
    expect(cspFromHeaders(text, '/assets/thumb.worker-AAA.js')).toEqual([CSP]);
    expect(cspFromHeaders(text, '/assets/heic.worker-BBB.js')).toEqual([CSP]);
    expect(cspFromHeaders(text, '/assets/heic.worker-CCC.js')).toEqual([]); // wrapper: runs on the page
    expect(uncoveredWorkers(text, workers)).toEqual([]);
    expect(text).not.toMatch(/no CSP header/);
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

  it('make the build fail if the decoder is missed, or the CSP would block its WebAssembly', () => {
    expect(workerSplitProblems(workers)).toEqual([]);
    // A rebuilt decoder whose WebAssembly call the pattern misses lands in "locked".
    const missed = workerPaths({ ...files, 'assets/heic.worker-BBB.js': 'const W = self["WebAss" + "embly"]; new W.Module(bytes)' });
    expect(missed.locked).toContain('/assets/heic.worker-BBB.js');
    expect(workerSplitProblems(missed)).toEqual([
      '/assets/heic.worker-BBB.js was not recognised as a WebAssembly worker',
      'no HEIC decoder worker found among the WebAssembly workers',
    ]);
    const gone = workerPaths({ 'assets/thumb.worker-AAA.js': files['assets/thumb.worker-AAA.js'] });
    expect(workerSplitProblems(gone)).toEqual(['no HEIC decoder worker found among the WebAssembly workers']);
    // A CSP without 'wasm-unsafe-eval' and a WebAssembly worker: the header would break HEIC previews.
    const noWasm = CSP.replace(" 'wasm-unsafe-eval'", '');
    expect(workerSplitProblems(workers, noWasm)).toEqual([
      "script-src lacks 'wasm-unsafe-eval', which blocks WebAssembly in /assets/heic.worker-BBB.js",
    ]);
    // Falls back to default-src when script-src is absent, like browsers do.
    expect(workerSplitProblems(workers, "default-src 'self'; connect-src 'self'")).toHaveLength(1);
    expect(workerSplitProblems(workers, "default-src 'self' 'wasm-unsafe-eval'")).toEqual([]);
    // 'unsafe-eval' (JavaScript eval) is never the answer.
    expect(workerSplitProblems(workers, CSP.replace("'wasm-unsafe-eval'", "'unsafe-eval'"))).toEqual([
      "script-src lacks 'wasm-unsafe-eval', which blocks WebAssembly in /assets/heic.worker-BBB.js",
      "script-src must not allow 'unsafe-eval'",
    ]);
    // A `_headers` that leaves a worker body out (or sends it a different policy) is caught.
    const heicRule = `/assets/heic.worker-BBB.js\n  Content-Security-Policy: ${CSP}\n`;
    expect(text).toContain(heicRule);
    expect(uncoveredWorkers(text.replace(heicRule, ''), workers)).toEqual(['/assets/heic.worker-BBB.js']);
    expect(uncoveredWorkers(headersFile(workers, noWasm), workers)).toEqual(['/assets/thumb.worker-AAA.js', '/assets/heic.worker-BBB.js']);
    // And the plugin turns that into a failed build.
    const generate = deployFiles().generateBundle as (this: unknown, o: unknown, b: Record<string, unknown>) => void;
    let emitted = '';
    const ctx = { emitFile: (f: { fileName: string; source: string }) => { if (f.fileName === '_headers') emitted = f.source; return ''; } };
    const chunk = (code: string) => ({ type: 'chunk', code });
    expect(() => generate.call(ctx, {}, { 'assets/heic.worker-BBB.js': chunk(files['assets/heic.worker-BBB.js']), 'assets/thumb.worker-AAA.js': chunk('x') })).not.toThrow();
    expect(cspFromHeaders(emitted, '/assets/heic.worker-BBB.js')).toEqual([CSP]);
    expect(cspFromHeaders(emitted, '/assets/thumb.worker-AAA.js')).toEqual([CSP]);
    expect(() => generate.call(ctx, {}, { 'assets/heic.worker-BBB.js': chunk('new self["WebAss" + "embly"].Module(b)'), 'assets/thumb.worker-AAA.js': chunk('x') })).toThrow(/not recognised as a WebAssembly worker/);
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
    // Every worker body in the build has the CSP header, the HEIC decoder included (D29).
    const assets = Object.fromEntries(readdirSync('dist/assets').filter((f) => f.endsWith('.js')).map((f) => [`assets/${f}`, readFileSync(`dist/assets/${f}`, 'utf8')]));
    const builtWorkers = workerPaths(assets);
    expect(builtWorkers.wasm.some((p) => /heic\.worker-/.test(p))).toBe(true);
    expect(uncoveredWorkers(built, builtWorkers, meta[0])).toEqual([]);
    expect(readFileSync('dist/robots.txt', 'utf8')).toBe('User-agent: *\nDisallow: /\n');
  });
});
