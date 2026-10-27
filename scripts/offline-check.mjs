// Offline check: proves "turn off your Wi-Fi and it still works" in a real browser.
// Loads the production build once, waits for the service worker, cuts the network,
// reloads, and scans the fixture folder (plus a HEIC photo, to load the decoder) offline.
// Usage: npm run build && npm run fixture && npm run offline-check -- [chromiumPath]
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const exe = process.argv[2] || process.env.CHROMIUM_PATH;
const PORT = 4174;
const ORIGIN = `http://localhost:${PORT}`;
if (!existsSync('dist/sw.js')) throw new Error('dist/sw.js missing: run `npm run build` first');
if (!existsSync('fixtures/recovery')) throw new Error('fixtures/recovery missing: run `npm run fixture` first');

// The fixture plus one HEIC photo, so the HEIC decoder (WASM worker) is needed offline too.
const folder = mkdtempSync(join(tmpdir(), 'keepsake-offline-'));
cpSync('fixtures/recovery', join(folder, 'recovery'), { recursive: true });
cpSync('tests/heic/iphone.heic', join(folder, 'recovery', 'recup_dir.1', 'f99999999.heic'));
const fileCount = readdirSync(join(folder, 'recovery'), { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).length;

const failures = [];
const outside = [];
const offlineFromNetwork = [];
const heicLoads = [];
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures.push(msg); };
let offline = false;
// Start the server and the browser inside try/finally, so a failed launch never leaves the port held.
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch { /* already gone */ } }; // the server and its children
process.once('SIGINT', () => { stopServer(); rmSync(folder, { recursive: true, force: true }); process.exit(130); });
let browser;
try {
  await new Promise((r, j) => { server.stdout.on('data', (d) => String(d).includes(String(PORT)) && r()); server.on('exit', () => j(new Error(`preview server exited (port ${PORT} in use?)`))); });
  browser = await chromium.launch({ executablePath: exe });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Watch every request from pages and workers, including the service worker's own fetches.
  context.on('request', (r) => {
    const url = r.url();
    if (url.startsWith('blob:') || url.startsWith('data:')) return;
    if (!url.startsWith(ORIGIN)) outside.push(url);
  });
  context.on('requestfinished', async (r) => {
    if (!offline || !r.url().startsWith(ORIGIN)) return; // blob: URLs are the user's own files, in memory
    const res = await r.response();
    if (/heic\.worker-.*\.js$/.test(r.url())) heicLoads.push({ url: r.url(), ok: res?.ok(), sw: res?.fromServiceWorker() });
    // Offline, every app file must come from the service worker's cache.
    if (res && !res.fromServiceWorker() && !r.serviceWorker()) offlineFromNetwork.push(r.url());
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('requestfailed', (r) => offline && errors.push(`request failed offline: ${r.url()} (${r.failure()?.errorText})`));
  // Force the file-input fallback (the folder picker dialog can't be automated).
  await context.addInitScript(() => {
    for (const k of ['showDirectoryPicker', 'showOpenFilePicker', 'showSaveFilePicker']) {
      delete window[k];
      delete Window.prototype[k];
    }
  });

  // 1. First visit, online: the service worker installs and precaches the app.
  await page.goto(`${ORIGIN}/`);
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
    // `ready` resolves, and clientsClaim() fires controllerchange, while the worker is still
    // 'activating' (its activate handler is cleaning old caches). Wait, up to 10 s, for 'activated'.
    const worker = reg.active;
    if (worker && worker.state !== 'activated') {
      await new Promise((r) => {
        const t = setTimeout(r, 10_000);
        worker.addEventListener('statechange', () => worker.state === 'activated' && (clearTimeout(t), r()));
      });
    }
    const keys = await caches.keys();
    let entries = 0;
    for (const k of keys) entries += (await (await caches.open(k)).keys()).length;
    return { state: reg.active?.state, scope: reg.scope, controlled: !!navigator.serviceWorker.controller, caches: keys, entries };
  });
  check(sw.state === 'activated' && sw.controlled, `service worker active and controlling the page (${sw.scope})`);
  check(sw.entries > 0, `precache holds ${sw.entries} files in ${sw.caches.join(', ')}`);
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  check(manifest.name && manifest.display === 'standalone' && manifest.icons.length >= 3, `manifest "${manifest.name}", ${manifest.display}, ${manifest.icons.length} icons`);

  // 2. Wi-Fi off: reload and use the app.
  offline = true;
  await context.setOffline(true);
  check(!(await page.evaluate(() => navigator.onLine)), 'browser reports offline');
  await page.reload();
  await page.getByRole('button', { name: 'Choose recovery folder' }).waitFor({ timeout: 15_000 });
  check(true, `start screen renders offline: "${await page.locator('h1').innerText()}"`);
  const fontsOk = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').length; });
  check(fontsOk > 0, `${fontsOk} bundled font files loaded offline`);

  // The privacy page and the PhotoRec guide open offline too (T67); they're part of the app.
  for (const [link, heading] of [['How Keepsake keeps your photos private', 'Your privacy'], ['New to PhotoRec? Here’s how to recover your files', 'Get your photos back']]) {
    await page.getByRole('button', { name: link }).click();
    const opened = await page.getByRole('heading', { level: 1, name: heading }).waitFor({ timeout: 5000 }).then(() => true, () => false);
    check(opened, `"${heading}" page opens offline`);
    await page.getByRole('button', { name: 'Back to start' }).last().click();
    await page.getByRole('button', { name: 'Choose recovery folder' }).waitFor({ timeout: 5000 });
  }

  // Every precached file can be fetched with the network off.
  const precache = await page.evaluate(async () => {
    const urls = [];
    for (const k of await caches.keys()) for (const req of await (await caches.open(k)).keys()) {
      const u = new URL(req.url);
      u.searchParams.delete('__WB_REVISION__'); // Workbox's cache key; the app asks for the plain URL
      urls.push(u.href);
    }
    const bad = [];
    for (const u of urls) { try { if (!(await fetch(u)).ok) bad.push(u); } catch { bad.push(u); } }
    return { total: urls.length, bad };
  });
  check(precache.bad.length === 0, `all ${precache.total} precached files load offline${precache.bad.length ? `; missing: ${precache.bad.join(', ')}` : ''}`);

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose recovery folder' }).click()]);
  const t0 = Date.now();
  await chooser.setFiles(join(folder, 'recovery'));
  await page.getByText('Files checked').waitFor({ timeout: 120_000 });
  check(true, `scan of ${fileCount} files finished offline in ${((Date.now() - t0) / 1000).toFixed(1)}s: "${await page.locator('h1').innerText()}"`);

  // The results screen previews the HEIC photo, which needs the HEIC decoder worker
  // (libheif WASM) offline. A HEIC tile shows a "HEIC" label until its picture is decoded,
  // and keeps the label if decoding fails.
  const waiting = page.locator('.tile-label', { hasText: /^HEIC$/ });
  for (let i = 0; i < 40 && (!heicLoads.length || (await waiting.count()) > 0); i++) await page.waitForTimeout(500);
  const workerFiles = [...new Set(heicLoads.map((l) => l.url.replace(ORIGIN, '')))];
  check(workerFiles.length >= 2 && heicLoads.every((l) => l.ok && l.sw), `HEIC decoder files served offline by the service worker: ${workerFiles.join(', ') || 'none'}`);
  check(heicLoads.length > 0 && (await waiting.count()) === 0, 'HEIC photo previewed offline (decoded on this computer)');
  await page.getByRole('button', { name: /^Review my/ }).click();
  await page.locator('h1').filter({ hasText: /\S/ }).waitFor();
  check(true, `review screen renders offline: "${await page.locator('h1').innerText()}"`);
  await page.waitForTimeout(3000);
  check(errors.length === 0, errors.length ? `errors offline:\n  ${errors.join('\n  ')}` : 'no console errors or failed requests offline');
  check(offlineFromNetwork.length === 0, offlineFromNetwork.length ? `served from network while offline: ${offlineFromNetwork.join(', ')}` : 'every offline request was answered by the service worker');
  await context.close();
} finally {
  await browser?.close();
  stopServer();
  rmSync(folder, { recursive: true, force: true });
}
check(outside.length === 0, outside.length ? `requests to other origins:\n  ${outside.join('\n  ')}` : `zero requests to any origin other than ${ORIGIN}`);
console.log(failures.length ? `\nOFFLINE CHECK FAILED (${failures.length})` : '\nOFFLINE CHECK PASSED');
process.exit(failures.length ? 1 : 0);
