// Makes the 1200×630 share image (og:image, D41) from our own hero prints: public/launch/share.png.
// The page is put together from local files only (the hero photos, the paper grain and the bundled
// display font) and photographed with Chromium; nothing is fetched. public/launch/ is kept out of
// the offline cache (vite.config.ts globIgnores, checked by vite.launch.ts precacheGuard).
// Usage: node scripts/make-share-image.mjs [chromium]   (default: $CHROMIUM_PATH or the pinned one)
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { APP_NAME, TAGLINE } from '../src/brand.ts';

const exe = process.argv[2] || process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const root = resolve(import.meta.dirname, '..');
const url = (p) => pathToFileURL(join(root, p)).href;
const out = join(root, 'public/launch/share.png');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Quiet Prints tokens (src/ui/app.css): --bg, --ink, --muted, the print paper and its shadow.
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: 'Bricolage'; src: url('${url('node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2')}') format('woff2'); font-weight: 200 800; }
@font-face { font-family: 'Atkinson'; src: url('${url('node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2')}') format('woff2'); }
@font-face { font-family: 'Atkinson'; src: url('${url('node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2')}') format('woff2'); font-weight: 700; }
html, body { margin: 0; width: 1200px; height: 630px; background: #ECF1F0; overflow: hidden; }
body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 40px; font-family: 'Atkinson', sans-serif; }
.fanbox { position: relative; width: 760px; height: 361px; }
.grain { position: absolute; inset: -40px; background: url('${url('src/assets/grain.png')}') repeat; background-size: 256px; opacity: 0.04;
  -webkit-mask-image: radial-gradient(farthest-side, #000 35%, transparent 100%); }
.fan { position: absolute; left: 0; top: 0; width: 400px; height: 190px; transform: scale(1.9); transform-origin: left top; }
.p { position: absolute; width: 170px; padding: 6px; border-radius: 12px; background: #FFFDF8;
  box-shadow: 0 0 0 1px rgba(31,36,39,.06), 0 1px 2px rgba(31,36,39,.10), 0 12px 24px -8px rgba(31,36,39,.18); }
.p img { display: block; width: 100%; aspect-ratio: 5 / 4; object-fit: cover; border-radius: 6px; }
.l { left: 20px; top: 22px; transform: rotate(-5deg); } .r { left: 206px; top: 16px; transform: rotate(4deg); } .c { left: 106px; top: 36px; width: 186px; }
.tag { position: absolute; left: 10px; bottom: 10px; padding: 2px 9px; border-radius: 999px; background: #FFFFFF; color: #8A4B08; font: 700 13px/1.5 'Atkinson', sans-serif; }
.words { display: flex; align-items: baseline; gap: 18px; }
.name { font: 800 44px/1 'Bricolage', sans-serif; font-variation-settings: 'opsz' 48; letter-spacing: -0.02em; color: #1F2427; }
.line { font-size: 28px; color: #545B5F; }
</style>
<div class="fanbox"><div class="grain"></div><div class="fan">
  <div class="p l"><img src="${url('src/assets/hero/6-beach-480.webp')}"></div>
  <div class="p r"><img src="${url('src/assets/hero/4-roadtrip-480.webp')}"></div>
  <div class="p c"><img src="${url('src/assets/hero/3-candles-480.webp')}"><span class="tag">Mar 2009</span></div>
</div></div>
<div class="words"><span class="name">${esc(APP_NAME)}</span><span class="line">${esc(TAGLINE)}</span></div>`;

const dir = mkdtempSync(join(tmpdir(), 'share-image-'));
const page_ = join(dir, 'share.html');
writeFileSync(page_, html);
const browser = await chromium.launch({ executablePath: exe });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  // Local files only: refuse anything that isn't file://.
  await page.route(/^(?!file:)/, (r) => r.abort());
  await page.goto(pathToFileURL(page_).href);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode())); });
  mkdirSync(join(root, 'public/launch'), { recursive: true });
  await page.screenshot({ path: out, type: 'png' });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
}
