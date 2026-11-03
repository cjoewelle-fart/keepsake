// QA (T89): the zip save path (Safari/Firefox have no folder picker) end to end in a real browser.
// Usage: npm run build && LANG=C.UTF-8 node scripts/qa-zip-check.mjs <recoveryDir> [--labels labels.json]
//          [--browser chromium|firefox|webkit] [--exe chromiumPath] [--port 4190] [--out dir] [--keep]
//          [--stop-after ms]   (press "Stop saving" after ms, then "Save the rest")
// Run with a UTF-8 locale: under LANG=C/POSIX, Chromium on Linux can't read files with non-ASCII
// names (NotReadableError), and the app sets them aside as damaged.
// Scans <recoveryDir> through the file-input fallback, saves every kept file as zip downloads,
// then scripts/qa-zip-check.py checks the zips (unzip -t, Python zipfile, counts vs the receipt,
// bytes vs the source by SHA-256, year/month layout vs the receipt and the timeline, safe names)
// and that the recovery folder is unchanged (size, mtime, SHA-256 of every file).
// In Chromium the folder pickers are deleted by an init script, so the app takes the same branch
// as Firefox and Safari; that is not the same as testing those browsers.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pw from 'playwright';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = join(here, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const flag = (k) => { const i = args.indexOf(k); if (i >= 0) args.splice(i, 1); return i >= 0; };
const port = String(Number(opt('--port', '4190')));
const which = opt('--browser', 'chromium');
const exe = opt('--exe', which === 'chromium' ? process.env.CHROMIUM_PATH : undefined);
const labels = opt('--labels', undefined);
const keep = flag('--keep');
const stopAfter = opt('--stop-after', undefined);
const out = resolve(opt('--out', mkdtempSync(join(tmpdir(), 'keepsake-zipcheck-'))));
const rec = resolve(args[0] ?? 'fixtures/recovery');
const base = `http://localhost:${port}`;
const num = (t) => Number(t.replace(/[^0-9]/g, ''));
const MB = (b) => Math.round(b / 1048576);
const py = (...a) => execFileSync('python3', ['-I', join(here, 'qa-zip-check.py'), ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });

// PSS of this process's whole tree (the browser and its children), from /proc.
function treePss() {
  const kids = new Map();
  for (const p of readdirSync('/proc').filter((n) => /^\d+$/.test(n))) {
    try {
      const ppid = Number(readFileSync(`/proc/${p}/stat`, 'utf8').split(') ')[1].split(' ')[1]);
      (kids.get(ppid) ?? kids.set(ppid, []).get(ppid)).push(Number(p));
    } catch { /* gone */ }
  }
  let total = 0;
  const walk = (pid) => {
    if (pid !== process.pid) try { total += Number(/^Pss:\s+(\d+)/m.exec(readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8'))[1]) * 1024; } catch { /* gone */ }
    for (const k of kids.get(pid) ?? []) walk(k);
  };
  walk(process.pid);
  return total;
}

mkdirSync(join(out, 'zips'), { recursive: true });
const snap = join(out, 'before.json');
console.log(py('snapshot', rec, snap).trim());

const problems = [];
const outside = [];
const peak = { scan: 0, save: 0 };
let phase = 'scan';
let sampling = true;
const sampler = (async () => { while (sampling) { const p = treePss(); if (p > peak[phase]) peak[phase] = p; await new Promise((r) => setTimeout(r, 500)); } })();

const server = spawn(join(repo, 'node_modules/.bin/vite'), ['preview', '--port', port, '--strictPort'], { cwd: repo, stdio: 'pipe', detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch { /* gone */ } };
let browser;
const app = {};
const t = {};
try {
  await new Promise((r, j) => { server.stdout.on('data', (d) => String(d).includes(port) && r()); server.on('exit', () => j(new Error(`preview exited (port ${port} in use?)`))); });
  browser = await pw[which].launch(exe ? { executablePath: exe } : {});
  t.version = browser.version();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  page.on('request', (r) => { if (!/^(http:\/\/localhost:\d+|blob:|data:)/.test(r.url())) outside.push(r.url()); });
  // No folder pickers: the Firefox/Safari branch (harmless in browsers that never had them).
  await page.addInitScript(() => {
    for (const k of ['showDirectoryPicker', 'showOpenFilePicker', 'showSaveFilePicker']) { delete window[k]; delete Window.prototype[k]; }
  });
  await page.goto(`${base}/`);
  app.hasPicker = await page.evaluate(() => 'showDirectoryPicker' in window);

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose recovery folder' }).click()]);
  let t0 = Date.now();
  await chooser.setFiles(rec);
  await page.getByText('Files checked').waitFor({ timeout: 30 * 60_000 });
  t.scan = (Date.now() - t0) / 1000;
  const [checked, kept] = (await page.locator('dl.ledger dd').allInnerTexts()).map(num);
  app.checked = checked;
  app.kept = kept;

  await page.getByRole('button', { name: /^Review my/ }).click();
  await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor({ timeout: 120_000 });
  app.selected = num(await page.locator('dl.ledger dd[data-k=selected]').innerText());
  // The timeline's months (what the app shows), all selected at this point.
  app.months = Object.fromEntries(await page.locator('.tl-month').evaluateAll((els) => els.map((e) => [e.dataset.month, Number((e.querySelector('.month-count')?.textContent ?? '').replace(/^.* of /, '').replace(/[^0-9]/g, ''))])));
  const monthSum = Object.values(app.months).reduce((a, b) => a + b, 0);
  if (monthSum !== app.selected) problems.push(`timeline months add up to ${monthSum}, ${app.selected} selected`);

  await page.locator('.tl-save:visible').click();
  await page.getByRole('heading', { level: 1, name: /Where should we save/ }).waitFor();
  app.zipCard = await page.locator('#zip-h').count() > 0;
  if (!app.zipCard) problems.push('save screen has no zip card: the folder branch was taken');
  app.button = await page.getByRole('button', { name: /^Download (zip file|\d+ zip files)$/ }).innerText();
  app.zipBody = await page.locator('section.card:has(#zip-h) .card-body').first().innerText();

  // Saved under a numbered name: a resumed save may suggest a name that was already used.
  const downloads = [];
  page.on('download', (d) => { const k = downloads.length + 1; downloads.push((async () => {
    const name = d.suggestedFilename();
    await d.saveAs(join(out, 'zips', `${String(k).padStart(2, '0')} ${name}`));
    return name;
  })()); });
  phase = 'save';
  t0 = Date.now();
  await page.getByRole('button', { name: /^Download (zip file|\d+ zip files)$/ }).click();
  if (stopAfter !== undefined) {
    await page.waitForTimeout(Number(stopAfter));
    await page.getByRole('button', { name: 'Stop saving' }).click();
    await page.getByRole('heading', { level: 1, name: 'Saving stopped.' }).waitFor({ timeout: 10 * 60_000 });
    app.stoppedBody = await page.locator('[data-k=ended-body]').innerText();
    await Promise.all(downloads);
    app.zipsAtStop = downloads.length;
    await page.getByRole('button', { name: 'Save the rest' }).click();
  }
  await page.getByRole('heading', { level: 1, name: /saved\./ }).waitFor({ timeout: 60 * 60_000 });
  t.build = (Date.now() - t0) / 1000;
  app.zipNames = await Promise.all(downloads);
  t.saveToDisk = (Date.now() - t0) / 1000;
  app.saved = num(await page.locator('dd[data-k=saved]').innerText());
  app.failed = num(await page.locator('dd[data-k=failed]').innerText());
  app.savedTo = await page.locator('dd[data-k=saved-to]').innerText();
  app.sorted = await page.locator('.receipt-rows div:nth-child(4) dd').innerText();
  app.find = await page.locator('[data-k=find]').innerText();
  app.againButtons = await page.locator('.zip-again button').allInnerTexts();
  const dupNames = app.zipNames.filter((n, i) => app.zipNames.indexOf(n) !== i);
  if (dupNames.length) problems.push(`the app gave two downloads the same name: ${[...new Set(dupNames)].join(', ')} (all: ${app.zipNames.join(' | ')})`);
  if (app.saved !== app.selected) problems.push(`receipt says ${app.saved} saved, ${app.selected} were selected`);
  // T89 acceptance: the Done text and the "download again" buttons name the real downloads.
  for (const n of app.zipNames) if (!app.find.includes(n) && !/\.zip to Keepsake/.test(app.find)) problems.push(`Done text doesn't name ${n}: ${app.find}`);
  for (const m of app.find.matchAll(/Keepsake photos[^,.]*?\.zip/g)) if (!app.zipNames.includes(m[0])) problems.push(`Done text names ${m[0]}, which wasn't downloaded`);
  const wantAgain = app.zipNames.map((n) => `Download ${n} again`);
  if (JSON.stringify(app.againButtons) !== JSON.stringify(wantAgain)) problems.push(`download-again buttons ${JSON.stringify(app.againButtons)} != ${JSON.stringify(wantAgain)}`);
} catch (e) {
  problems.push(`run failed: ${e.stack ?? e}`);
} finally {
  await browser?.close();
  stopServer();
  sampling = false;
  await sampler;
}

writeFileSync(join(out, 'app.json'), JSON.stringify(app));
let report = {};
let checkOk = false;
if (app.saved !== undefined) {
  try {
    report = JSON.parse(py('check', rec, snap, join(out, 'zips'), join(out, 'app.json'), ...(labels ? [resolve(labels)] : [])));
    checkOk = true;
  } catch (e) {
    report = e.stdout ? JSON.parse(e.stdout) : { error: String(e) };
  }
}
console.log(JSON.stringify({ browser: `${which} ${t.version ?? ''}`, folderPicker: app.hasPicker, recovery: rec, app, time_s: t, peakPssMB: { scan: MB(peak.scan), save: MB(peak.save) }, outsideRequests: outside, problems, check: report }, null, 1));
if (!keep) rmSync(join(out, 'zips'), { recursive: true, force: true });
console.log(problems.length || outside.length || !checkOk ? 'ZIP CHECK: PROBLEMS (see above)' : 'ZIP CHECK: OK');
if (problems.length || outside.length || !checkOk) process.exitCode = 1;
