// Serves a build folder the way Cloudflare Pages / Netlify would: static files plus the
// response headers from its `_headers` file. Lets the e2e and offline checks run against the
// real hosting headers (CSP as an HTTP header, not just the <meta> tag) before any deploy.
// Usage: node scripts/serve-dist.mjs [dir=dist] [--port 4180]
// Then:  BASE_URL=http://localhost:4180 npm run e2e   (or npm run offline-check)
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const port = Number(opt('--port', '4180'));
const root = resolve(args[0] || 'dist');
if (!existsSync(join(root, 'index.html'))) throw new Error(`${root}/index.html missing: run \`npm run build\` first`);

// `_headers`: a path line (exact, or ending in /* for a prefix), then indented "Name: value" lines.
const rules = [];
const headersPath = join(root, '_headers');
if (existsSync(headersPath)) {
  let current = null;
  for (const line of readFileSync(headersPath, 'utf8').split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) { current = { path: line.trim(), headers: [] }; rules.push(current); continue; }
    const i = line.indexOf(':');
    current?.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
} else console.warn(`no _headers in ${root}: serving without hosting headers`);
const matches = (pattern, path) => (pattern.endsWith('/*') ? path.startsWith(pattern.slice(0, -1)) : pattern === path);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(root, path));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  // Like both hosts' single-page fallback: unknown paths get the app page.
  if (!existsSync(file)) file = join(root, 'index.html');
  const headers = { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' };
  // Same merge rule as the hosts: every matching rule applies; a repeated header is comma-joined.
  for (const r of rules) if (matches(r.path, path)) for (const [k, v] of r.headers) headers[k] = headers[k] ? `${headers[k]}, ${v}` : v;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} with ${rules.length} _headers rules at http://localhost:${port} (this computer only)`));
