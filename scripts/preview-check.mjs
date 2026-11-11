// Checks the review screen's tile previews in the built app, in a real Chromium (T53):
// every photo tile shows a small copy (not the full-size file), turned the right way up,
// HEIC photos included, and nothing is requested from anywhere but the app itself.
//
//   npm run build && node scripts/preview-check.mjs <chromium> <folder> [--port 4177]
//
// <folder> should hold a few photos; one of them named *1.jpg (e.g. f0000001.jpg) may be the
// orientation test picture (the only one shaped 1000:1600 upright): stored 1600 x 1000 landscape, red left half and blue right half,
// with Exif orientation 6, so it must show as portrait with red on top.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const [exe, dir] = process.argv.slice(2);
if (!exe || !dir) throw new Error('usage: preview-check.mjs <chromium> <folder> [--port 4177]');
const i = process.argv.indexOf('--port');
const PORT = i < 0 ? 4177 : Number(process.argv[i + 1]);

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stop = () => { try { process.kill(-server.pid); } catch { /* gone */ } };
process.on('exit', stop);
await new Promise((r) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && r()));

const problems = [];
const browser = await chromium.launch({ executablePath: exe });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const outside = [];
  page.on('request', (r) => { if (!/^(http:\/\/localhost:\d+|blob:|data:)/.test(r.url())) outside.push(r.url()); });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  await page.addInitScript(() => {
    for (const k of ['showDirectoryPicker', 'showOpenFilePicker', 'showSaveFilePicker']) { delete window[k]; delete Window.prototype[k]; }
    // Which blob URLs point at a user's file itself (rather than a small copy made from it).
    window.__fileUrls = new Set();
    const create = URL.createObjectURL;
    URL.createObjectURL = (b) => { const u = create(b); if (b instanceof File) window.__fileUrls.add(u); return u; };
  });
  await page.goto(`http://localhost:${PORT}/`);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Sort my recovered files' }).click()]);
  await chooser.setFiles(dir);
  await page.getByText('Files checked').waitFor({ timeout: 120_000 });
  await page.getByRole('button', { name: /^Review my/ }).click();
  await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor();
  // Bring each tile on screen in turn (previews are only made near the screen) and wait for it.
  const count = await page.locator('.tl-tile').count();
  for (let k = 0; k < count; k++) {
    const t0 = Date.now();
    await page.locator('.tl-tile').nth(k).scrollIntoViewIfNeeded();
    await page.waitForFunction((n) => {
      const t = document.querySelectorAll('.tl-tile .tile')[n];
      const img = t.querySelector('img');
      if (img) return img.complete && img.naturalWidth > 0;
      const c = t.querySelector('canvas'); // hidden until a small copy is drawn into it
      return (c && c.style.display !== 'none') || !!t.querySelector('.tile-label[title]') || /MP4|MOV/.test(t.textContent);
    }, k, { timeout: 60_000, polling: 100 }).catch(() => problems.push(`tile ${k + 1}: preview still not shown after 60 s`));
    console.log(`tile ${k + 1}: settled in ${Date.now() - t0} ms`);
  }
  if (process.env.PREVIEW_SHOT) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('.tl-col').screenshot({ path: process.env.PREVIEW_SHOT });
  }
  const tiles = await page.evaluate(async () => {
    const out = [];
    for (const fig of document.querySelectorAll('.tl-tile')) {
      // A small copy drawn into a canvas (T53), or an <img> (the file itself, the old way).
      const img = fig.querySelector('.tile img') ?? [...fig.querySelectorAll('.tile canvas')].find((x) => x.style.display !== 'none');
      const label = fig.querySelector('input')?.getAttribute('aria-label') ?? '';
      if (!img) { out.push({ label, img: false, text: fig.querySelector('.tile-label')?.textContent }); continue; }
      const isImg = img instanceof HTMLImageElement;
      const [w, h] = isImg ? [img.naturalWidth, img.naturalHeight] : [img.width, img.height];
      if (isImg && !(img.complete && w > 0)) { out.push({ label, img: false, text: 'not loaded', src: img.src.slice(0, 40) }); continue; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const at = (fx, fy) => [...g.getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data.slice(0, 3)];
      out.push({ label, img: true, w, h, top: at(0.5, 0.2), bottom: at(0.5, 0.8), file: isImg && window.__fileUrls.has(img.src) });
    }
    return out;
  });
  for (const t of tiles) console.log(JSON.stringify(t));
  const photos = tiles.filter((t) => t.img);
  if (!photos.length) problems.push('no previews shown');
  for (const t of photos) {
    if (t.file) problems.push(`a tile shows the full-size file itself: ${t.label}`);
    // Copies fill the tile (160 px shorter side for a ~140 px tile on this 1x screen); HEIC decodes are 320 px on the longer side.
    if (Math.min(t.w, t.h) > 320) problems.push(`a tile preview is ${t.w} x ${t.h}: bigger than a tile needs`);
  }
  const unavailable = tiles.filter((t) => !t.img && !/MP4|MOV/.test(t.text ?? ''));
  if (unavailable.length) problems.push(`${unavailable.length} photo tiles show no preview: ${unavailable.map((t) => t.text).join(', ')}`);
  // The orientation test picture: portrait, red on top, blue at the bottom.
  const rot = photos.find((t) => Math.abs(t.w / t.h - 1000 / 1600) < 0.01);
  if (!rot) problems.push('orientation test picture not shown as a 1000:1600 portrait');
  else if (!(rot.top[0] > 150 && rot.top[2] < 100 && rot.bottom[2] > 150 && rot.bottom[0] < 100)) problems.push(`orientation test picture is turned the wrong way: top ${rot.top}, bottom ${rot.bottom}`);
  if (outside.length) problems.push(`requests outside the app: ${outside.slice(0, 3).join(', ')}`);
  console.log(`${photos.length} previews; largest ${Math.max(...photos.map((t) => Math.max(t.w, t.h)))} px; ${outside.length} outside requests`);
} finally {
  await browser.close();
  stop();
}
if (problems.length) { console.log(`FAIL\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS');
