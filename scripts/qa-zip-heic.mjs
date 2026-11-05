// QA (T89, "HEIC in a zip"): iPhone/Samsung HEIC photos saved through the zip branch (the one
// Firefox and Safari take: no folder picker), end to end in a real Chromium.
// Usage: npm run build && LANG=C.UTF-8 node scripts/qa-zip-heic.mjs [--fixture dir] [--out dir] [--port 4191] [--keep] [--exe chromiumPath]
//   Browser: --exe (or CHROMIUM_PATH); else the repo's Playwright; if that has no browser downloaded,
//   the globally installed Playwright and its browser.
//   --fixture: a scripts/make_fixture.py output folder (recovery/ + labels.json); made in --out if left out.
// Steps:
//  1. scripts/qa-zip-heic.py build: fixture + real HEICs from tests/real-phones (iPhone 8, iPhone 11 Pro
//     named .mov, Samsung S10+), synthetic ones from tests/heic, a same-minute twin, and HEICs that
//     should be set aside (320 px preview, cut-off, 0-byte, exact copy), plus 4 real phone JPEGs.
//  2. Snapshot the folder (size, mtime, SHA-256 of every file); serve a copy of dist/ so a rebuild
//     elsewhere can't change the app mid-run.
//  3. In Chromium with the folder pickers deleted: scan through the file input, check HEIC previews
//     on the review screen (By date tiles and Largest first rows), save everything as zip downloads.
//  4. scripts/qa-zip-check.py check (zip integrity, counts vs receipt, bytes, layout, recovery folder
//     unchanged) and scripts/qa-zip-heic.py verify (every HEIC that should be kept: in the zip once,
//     byte-identical, expected folder and name; set-aside HEICs not in it).
// Any request to an origin other than the local app server is a failure.
// Deleting the pickers in Chromium makes the app take the Firefox/Safari branch; it is not the same
// as testing those browsers (Safari decodes HEIC itself, so its previews take another path).
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = join(here, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const flag = (k) => { const i = args.indexOf(k); if (i >= 0) args.splice(i, 1); return i >= 0; };
const port = String(Number(opt('--port', '4191')));
const keep = flag('--keep');
const exe = opt('--exe', process.env.CHROMIUM_PATH);
const out = resolve(opt('--out', mkdtempSync(join(tmpdir(), 'keepsake-zipheic-'))));
let fixture = opt('--fixture', undefined);
const base = `http://localhost:${port}`;
const num = (t) => Number(t.replace(/[^0-9]/g, ''));
const run = (script, ...a) => execFileSync('python3', ['-I', join(here, script), ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });

mkdirSync(join(out, 'zips'), { recursive: true });
if (!fixture) {
  fixture = join(out, 'fixture');
  if (!existsSync(join(fixture, 'labels.json'))) console.log(run('make_fixture.py', join(fixture, 'recovery')).trim());
}
fixture = resolve(fixture);
console.log(run('qa-zip-heic.py', 'build', join(fixture, 'recovery'), join(fixture, 'labels.json'), out).trim());
const rec = join(out, 'recovery');
const expect = JSON.parse(readFileSync(join(out, 'heic-expect.json'), 'utf8'));
const snap = join(out, 'before.json');
console.log(run('qa-zip-check.py', 'snapshot', rec, snap).trim());

// HEIC dates as the review screen's checkbox names write them ("5 February 2018, 15:11").
const HEIC_TILE_DATES = ['5 February 2018, 15:11', '30 June 2020, 11:27', '4 May 2020, 18:39', '14 July 2023, 18:22'];
const heicNames = expect.map((e) => e.path.split('/').pop());

const dist = join(out, 'dist');
rmSync(dist, { recursive: true, force: true });
cpSync(join(repo, 'dist'), dist, { recursive: true });

const problems = [];
const outside = [];
const requests = new Set();
const app = { previews: { tiles: [], rows: [] } };
const server = spawn(join(repo, 'node_modules/.bin/vite'), ['preview', '--port', port, '--strictPort', '--outDir', dist], { cwd: repo, stdio: 'pipe', detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch { /* gone */ } };
let browser;

// What a tile/row's preview ended up as: 'img' (browser decoded it), 'canvas' (small copy drawn,
// HEIC through our libheif worker in Chromium), 'none' ("No preview"), or 'timeout'.
async function previewState(page, item, view) {
  return page.waitForFunction(([s, v]) => {
    const t = document.querySelector(`${s} [data-view="${v}"]`)?.closest(s)?.querySelector('.tile');
    if (!t) return 'gone';
    const img = t.querySelector('img');
    if (img && img.complete && img.naturalWidth > 0) return `img ${img.naturalWidth}x${img.naturalHeight}`;
    const c = t.querySelector('canvas');
    if (c && c.style.display !== 'none') return `canvas ${c.width}x${c.height}`;
    if (t.querySelector('.tile-label[title]')) return 'none';
    return false;
  }, [item, view], { timeout: 60_000, polling: 100 }).then((h) => h.jsonValue()).catch(() => 'timeout');
}

// Days and rows are only drawn near the screen: walk down the page and check each matching item
// (by its checkbox name) as it is drawn. Items are told apart by their data-view (the file's index).
async function sweep(page, item, match) {
  const found = new Map();
  await page.evaluate(() => window.scrollTo(0, 0));
  for (let guard = 0; guard < 2000; guard++) {
    const items = await page.locator(item).evaluateAll((els) => els.map((e) => ({ view: e.querySelector('[data-view]')?.dataset.view, label: e.querySelector('input[type=checkbox]')?.getAttribute('aria-label') ?? '' })));
    for (const it of items) {
      if (found.has(it.view) || !match(it.label)) continue;
      const loc = page.locator(`${item}:has([data-view="${it.view}"])`);
      await loc.scrollIntoViewIfNeeded();
      found.set(it.view, { label: it.label, state: await previewState(page, item, it.view) });
    }
    const before = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.8)));
    await page.waitForTimeout(80);
    if (await page.evaluate(() => window.scrollY) === before) break;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return [...found.values()];
}

async function launch() {
  if (exe) return chromium.launch({ executablePath: exe });
  try {
    return await chromium.launch();
  } catch (e) {
    if (!/Executable doesn't exist/.test(String(e))) throw e;
    const global = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    const pw = createRequire(join(global, 'noop.js'))('playwright');
    app.playwright = `global ${join(global, 'playwright')} (the repo's has no browser downloaded)`;
    return pw.chromium.launch();
  }
}

try {
  await new Promise((r, j) => { server.stdout.on('data', (d) => String(d).includes(port) && r()); server.on('exit', () => j(new Error(`preview exited (port ${port} in use?)`))); });
  browser = await launch();
  app.browser = `chromium ${browser.version()}`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  // Page and workers (service worker included): anything not from the local app server.
  ctx.on('request', (r) => { const u = r.url(); requests.add(u.replace(/\?.*$/, '').slice(0, 120)); if (!u.startsWith(`${base}/`) && !/^(blob|data):/.test(u)) outside.push(u); });
  await page.addInitScript(() => {
    for (const k of ['showDirectoryPicker', 'showOpenFilePicker', 'showSaveFilePicker']) { delete window[k]; delete Window.prototype[k]; }
  });
  await page.goto(`${base}/`);
  app.hasPicker = await page.evaluate(() => 'showDirectoryPicker' in window);

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose recovery folder' }).click()]);
  let t0 = Date.now();
  await chooser.setFiles(rec);
  await page.getByText('Files checked').waitFor({ timeout: 20 * 60_000 });
  app.scanSeconds = (Date.now() - t0) / 1000;
  [app.checked, app.kept] = (await page.locator('dl.ledger dd').allInnerTexts()).map(num);
  app.resultsText = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 1500);
  await page.screenshot({ path: join(out, '1-results.png'), fullPage: true });

  await page.getByRole('button', { name: /^Review my/ }).click();
  await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor({ timeout: 120_000 });
  app.selected = num(await page.locator('dl.ledger dd[data-k=selected]').innerText());
  app.months = Object.fromEntries(await page.locator('.tl-month').evaluateAll((els) => els.map((e) => [e.dataset.month, Number((e.querySelector('.month-count')?.textContent ?? '').replace(/^.* of /, '').replace(/[^0-9]/g, ''))])));

  // HEIC previews, By date: the tiles whose name carries a HEIC's date.
  app.previews.tiles = await sweep(page, '.tl-tile', (l) => HEIC_TILE_DATES.some((d) => l.includes(d)));
  // HEIC previews, Largest first: rows name the file itself, so the undated HEIC is covered too.
  await page.getByRole('button', { name: 'Largest first' }).click();
  await page.locator('.tl-row').first().waitFor();
  app.previews.rows = (await sweep(page, '.tl-row', (l) => heicNames.some((n) => l.includes(`, ${n}.`)))).map((r) => ({ file: heicNames.find((n) => r.label.includes(`, ${n}.`)), ...r }));
  await page.screenshot({ path: join(out, '2-review-largest-first.png') });
  await page.getByRole('button', { name: 'By date' }).click();
  await page.locator('.tl-month').first().waitFor();

  await page.locator('.tl-save:visible').click();
  await page.getByRole('heading', { level: 1, name: /Where should we save/ }).waitFor();
  app.zipCard = await page.locator('#zip-h').count() > 0;
  if (!app.zipCard) problems.push('save screen has no zip card: the folder branch was taken');

  const downloads = [];
  page.on('download', (d) => { const k = downloads.length + 1; downloads.push((async () => {
    const name = d.suggestedFilename();
    await d.saveAs(join(out, 'zips', `${String(k).padStart(2, '0')} ${name}`));
    return name;
  })()); });
  t0 = Date.now();
  await page.getByRole('button', { name: /^Download (zip file|\d+ zip files)$/ }).click();
  await page.getByRole('heading', { level: 1, name: /saved\./ }).waitFor({ timeout: 30 * 60_000 });
  app.zipNames = await Promise.all(downloads);
  app.saveSeconds = (Date.now() - t0) / 1000;
  app.saved = num(await page.locator('dd[data-k=saved]').innerText());
  app.failed = num(await page.locator('dd[data-k=failed]').innerText());
  app.sorted = await page.locator('.receipt-rows div:nth-child(4) dd').innerText();
  if (app.saved !== app.selected) problems.push(`receipt says ${app.saved} saved, ${app.selected} were selected`);
  await page.screenshot({ path: join(out, '3-done.png'), fullPage: true });
} catch (e) {
  problems.push(`run failed: ${e.stack ?? e}`);
} finally {
  await browser?.close();
  stopServer();
}

// Previews: every HEIC tile/row should show a picture, not "No preview" or a stuck label.
const allPrev = [...app.previews.tiles, ...app.previews.rows];
const badPrev = allPrev.filter((p) => !/^(img|canvas) /.test(p.state));
app.previewSummary = { checked: allPrev.length, shown: allPrev.length - badPrev.length, notShown: badPrev };

writeFileSync(join(out, 'app.json'), JSON.stringify(app));
let general = {};
let heic = {};
let generalOk = false;
let heicOk = false;
if (app.saved !== undefined) {
  try { general = JSON.parse(run('qa-zip-check.py', 'check', rec, snap, join(out, 'zips'), join(out, 'app.json'), join(out, 'labels.json'))); generalOk = true; } catch (e) { general = e.stdout ? JSON.parse(e.stdout) : { error: String(e) }; }
  try { heic = JSON.parse(run('qa-zip-heic.py', 'verify', rec, join(out, 'zips'), join(out, 'heic-expect.json'))); heicOk = true; } catch (e) { heic = e.stdout ? JSON.parse(e.stdout) : { error: String(e) }; }
}
const { resultsText, ...shown } = app;
console.log(JSON.stringify({ out, recovery: rec, app: shown, resultsText, outsideRequests: outside, requestsSeen: [...requests], problems, check: general, heic }, null, 1));
if (!keep) rmSync(join(out, 'zips'), { recursive: true, force: true });
const ok = !problems.length && !outside.length && generalOk && heicOk;
console.log(`HEIC: ${heic.heic_in_folder} HEIC in folder (by bytes), ${heic.heic_should_keep} should be kept, ${heic.heic_kept_in_zip} in zip, ${heic.heic_byte_identical} byte-identical, ${heic.heic_expected_name_and_folder} in the expected folder/name; previews shown ${app.previewSummary.shown}/${app.previewSummary.checked}`);
console.log(ok ? 'ZIP HEIC CHECK: OK' : 'ZIP HEIC CHECK: PROBLEMS (see above)');
if (!ok) process.exitCode = 1;
