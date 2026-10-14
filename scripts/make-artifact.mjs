// Turns `vite build --mode artifact` output into one self-contained page plus a sample pack.
// Usage: node scripts/make-artifact.mjs <photorec-output-dir> <out-dir>
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const [samplesDir, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

// 1. Inline the built JS and CSS into the page body.
const dist = 'dist-artifact';
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
writeFileSync(join(outDir, 'keepsake.html'), page);

// 2. Pack the example files (kept under 14 MB by dropping some large photos evenly).
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)])).sort();
let files = walk(samplesDir).map((p) => ({ path: relative(samplesDir, p).split('\\').join('/'), data: readFileSync(p) }));
const LIMIT = 14 * 1024 * 1024;
const total = () => files.reduce((n, f) => n + f.data.length, 0);
let skip = 2;
while (total() > LIMIT) {
  let k = 0;
  files = files.filter((f) => !(f.path.endsWith('.jpg') && f.data.length > 60_000 && ++k % skip === 0));
  skip++;
}
const index = Buffer.from(JSON.stringify(files.map((f) => ({ path: f.path, size: f.data.length }))));
const head = Buffer.alloc(4);
head.writeUInt32BE(index.length);
writeFileSync(join(outDir, 'sample-pack.wasm'), Buffer.concat([head, index, ...files.map((f) => f.data)]));
console.log(`page ${(page.length / 1024).toFixed(0)} KB, sample pack ${files.length} files, ${(total() / 1048576).toFixed(1)} MB`);
