// Turns `vite build --mode artifact` output into one self-contained page plus a sample pack.
// Usage: node scripts/make-artifact.mjs <photorec-output-dir> <out-dir>
//
// Pilot test page (no example files, title "Keepsake (test)"), from `vite build --mode artifact-test`:
//        node scripts/make-artifact.mjs --test <out-dir>    (writes <out-dir>/keepsake-test.html only)
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const test = process.argv[2] === '--test';
const [samplesDir, outDir] = test ? [undefined, process.argv[3]] : process.argv.slice(2);
if (!outDir) throw new Error('usage: make-artifact.mjs <photorec-output-dir> <out-dir> | --test <out-dir>');
mkdirSync(outDir, { recursive: true });

// 1. Inline the built JS and CSS into the page body.
const dist = test ? 'dist-artifact-test' : 'dist-artifact';
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const assets = readdirSync(join(dist, 'assets'));
const js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dist, 'assets', f), 'utf8'));
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dist, 'assets', f), 'utf8'));
if (js.length !== 1) throw new Error(`expected one script, got ${js.length}`);
const title = html.match(/<title>.*?<\/title>/)[0];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(/<script[^>]*src=[^>]*><\/script>/, '');
const favicon = readFileSync('public/favicon.svg', 'base64');
const page = `${title}
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${favicon}">
<style>${css.join('\n').replaceAll('</style', '<\\/style')}</style>
${body.trim()}
<script type="module">${js[0].replaceAll('</script', '<\\/script')}</script>
`;
if (test) {
  // The test page must not offer the example files (testers use a real recovery folder).
  if (!title.includes('(test)')) throw new Error(`test page: title is ${title}, run vite build --mode artifact-test`);
  if (page.includes('sample-pack')) throw new Error('test page: example files code found');
  writeFileSync(join(outDir, 'keepsake-test.html'), page);
  console.log(`test page ${(page.length / 1024).toFixed(0)} KB, ${title}, no sample pack`);
  process.exit(0);
}
writeFileSync(join(outDir, 'keepsake.html'), page);

// 2. Pack the example files (kept under 14 MB by dropping some large photos evenly).
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)])).sort();
let files = walk(samplesDir).map((p) => ({ path: relative(samplesDir, p).split('\\').join('/'), data: readFileSync(p) }));
const LIMIT = 14 * 1024 * 1024;
const total = () => files.reduce((n, f) => n + f.data.length, 0);
// Drop every other large JPEG until it fits; if that runs out, drop the largest files of any kind.
let size = total();
while (size > LIMIT) {
  let k = 0;
  const before = files.length;
  files = files.filter((f) => {
    const drop = size > LIMIT && f.path.endsWith('.jpg') && f.data.length > 60_000 && ++k % 2 === 0;
    if (drop) size -= f.data.length;
    return !drop;
  });
  if (files.length === before) {
    const biggest = files.reduce((a, b) => (b.data.length > a.data.length ? b : a));
    files = files.filter((f) => f !== biggest);
    size -= biggest.data.length;
  }
}
const index = Buffer.from(JSON.stringify(files.map((f) => ({ path: f.path, size: f.data.length }))));
const head = Buffer.alloc(4);
head.writeUInt32BE(index.length);
writeFileSync(join(outDir, 'sample-pack.wasm'), Buffer.concat([head, index, ...files.map((f) => f.data)]));
console.log(`page ${(page.length / 1024).toFixed(0)} KB, sample pack ${files.length} files, ${(total() / 1048576).toFixed(1)} MB`);
