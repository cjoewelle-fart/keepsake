// Times scanAll inside a Web Worker in Chromium, reading real files from disk through a
// file input (as the app's upload fallback does), with different copy-check concurrency (T40).
//
//   node scripts/bench_copies.mjs --dir D --files 4000 --concurrency 1   # make the folder first
//   node scripts/bench_copies_browser.mjs <chromium> D [--concurrency 1,4,4,1]
//
// Never downloads a browser: pass the path of an installed Chromium.
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [exe, dir] = process.argv.slice(2);
if (!exe || !dir) throw new Error('usage: bench_copies_browser.mjs <chromium> <folder> [--concurrency 1,4]');
const i = process.argv.indexOf('--concurrency');
const LEVELS = (i < 0 ? '1,4,4,1' : process.argv[i + 1]).split(',').map(Number);

const out = mkdtempSync(join(tmpdir(), 'keepsake-bench-web-'));
const entry = join(out, 'bench.worker.ts');
writeFileSync(entry, `
import { scanAll } from ${JSON.stringify(join(ROOT, 'src/engine/scan.ts'))};
self.onmessage = async (e) => {
  const { files, copyConcurrency } = e.data;
  const srcs = files.map((f) => ({ path: f.name, size: f.size, read: async (s, z) => new Uint8Array(await f.slice(s, z).arrayBuffer()) }));
  let copiesStart = 0, suspects = 0;
  const t0 = performance.now();
  const recs = await scanAll(srcs, { copyConcurrency, onProgress: (p) => { if (p.stage === 'copies' && !copiesStart) { copiesStart = performance.now(); suspects = p.total; } } });
  const t1 = performance.now();
  const counts = {};
  for (const r of recs) counts[r.group] = (counts[r.group] ?? 0) + 1;
  const sig = recs.map((r) => r.group[0] + (r.copyOf ?? '')).join(',');
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sig)));
  self.postMessage({ copyConcurrency, totalSec: +((t1 - t0) / 1000).toFixed(1), copiesSec: copiesStart ? +((t1 - copiesStart) / 1000).toFixed(1) : 0, suspects, ...counts,
    resultHash: Array.from(h.slice(0, 6), (x) => x.toString(16).padStart(2, '0')).join('') });
};
`);
await build({
  root: ROOT, logLevel: 'warn', configFile: false,
  build: { outDir: join(out, 'web'), emptyOutDir: true, minify: false, rolldownOptions: { input: entry, output: { entryFileNames: 'bench.worker.js', format: 'es' } } },
});
const page = `<!doctype html><meta charset="utf-8"><input type="file" multiple id="f"><script type="module">
window.run = (c) => new Promise((ok) => {
  const w = new Worker('./bench.worker.js', { type: 'module' });
  w.onmessage = (e) => { w.terminate(); ok(e.data); };
  w.postMessage({ files: [...document.getElementById('f').files], copyConcurrency: c });
});
</script>`;
const server = createServer((req, res) => {
  if (req.url === '/' ) { res.setHeader('content-type', 'text/html'); return res.end(page); }
  if (req.url === '/bench.worker.js') { res.setHeader('content-type', 'text/javascript'); return res.end(readFileSync(join(out, 'web', 'bench.worker.js'))); }
  res.statusCode = 404; res.end();
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: exe });
const p = await browser.newPage();
await p.goto(url);
const paths = readdirSync(dir).filter((n) => !n.startsWith('.')).sort().map((n) => join(dir, n));
await p.setInputFiles('#f', paths);
console.log(`Chromium ${browser.version()}: ${paths.length} files from ${dir}`);
const rows = [];
for (const c of LEVELS) {
  const row = await p.evaluate((c) => window.run(c), c);
  console.log(JSON.stringify(row));
  rows.push(row);
}
console.table(rows);
await browser.close();
server.close();
