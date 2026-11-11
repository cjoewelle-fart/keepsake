// Small-folder scan check (T100): scans folders of 1, 2 and 3 JPEGs many times in a real
// browser and counts the runs that reach the results screen AND stay there. The bug it guards
// against: a tiny folder's scan showed the results, then fell back to "Checked 1 of 1 files,
// 100%" for good (seen Nov 4, 8 of 16 runs on 3 JPEGs).
// Records every change of the page heading, so a run that bounced back to the progress screen
// shows exactly how.
// Usage: npm run build && node scripts/small-scan-check.mjs [--runs 50] [--sizes 1,2,3] [--base-url URL] [--chromium PATH]
//   (or CHROMIUM_PATH=…, when Playwright's own browser build isn't installed)
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const runs = Number(opt('--runs', '50'));
const sizes = opt('--sizes', '1,2,3').split(',').map(Number);
const baseUrl = opt('--base-url', process.env.BASE_URL);
const PORT = 4183;
const APP_URL = baseUrl ? new URL(baseUrl).href : `http://localhost:${PORT}/`;
if (!baseUrl && !existsSync('dist/index.html')) throw new Error('dist missing: run `npm run build` first');

const SAMPLES = ['tests/real-phones/iphone-4.jpg', 'tests/real-phones/samsung-galaxy-s4_GT-I9505.jpg', 'tests/real-phones/samsung-galaxy-j3_SM-J327T1.jpg'];
const root = mkdtempSync(join(tmpdir(), 'keepsake-small-'));
const folders = Object.fromEntries(sizes.map((n) => {
  const dir = join(root, `${n}-files`, 'recup_dir.1');
  mkdirSync(dir, { recursive: true });
  for (let k = 0; k < n; k++) cpSync(SAMPLES[k % SAMPLES.length], join(dir, `f${1000 + k}.jpg`));
  return [n, join(root, `${n}-files`)];
}));

const server = baseUrl ? null : spawn('node', ['scripts/serve-dist.mjs', 'dist', '--port', String(PORT)], { stdio: 'pipe', detached: true });
const stopServer = () => { try { if (server) process.kill(-server.pid); } catch { /* already gone */ } };
process.once('SIGINT', () => { stopServer(); rmSync(root, { recursive: true, force: true }); process.exit(130); });
let browser;
const results = {};
try {
  if (server) {
    await new Promise((r, j) => {
      server.stdout.on('data', (d) => String(d).includes(String(PORT)) && r());
      server.stderr.on('data', (d) => process.stderr.write(d));
      server.on('exit', () => j(new Error(`server exited (port ${PORT} in use?)`)));
    });
  }
  browser = await chromium.launch({ executablePath: opt('--chromium', process.env.CHROMIUM_PATH) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await context.addInitScript(() => {
    // The file-input fallback (the folder picker dialog can't be automated).
    for (const k of ['showDirectoryPicker', 'showOpenFilePicker', 'showSaveFilePicker']) { delete window[k]; delete Window.prototype[k]; }
    // Every heading change, in order.
    window.__headings = [];
    const note = () => {
      const t = document.querySelector('main h1')?.textContent?.trim();
      if (t && window.__headings[window.__headings.length - 1] !== t) window.__headings.push(t);
    };
    new MutationObserver(note).observe(document, { subtree: true, childList: true, characterData: true });
    // The worker traffic, in arrival order, to tell the causes apart: how many scans the page
    // started (scan calls sent to a worker), when the scan's answer came back, and when each
    // progress update arrived (Comlink calls the page's progress callback over its own channel).
    window.__events = [];
    const log = (e) => window.__events.push(e);
    const send = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (m, ...rest) {
      if (m && m.type === 'APPLY' && m.path?.[0] === 'scan') log('scan call sent');
      return send.call(this, m, ...rest);
    };
    const listen = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, ...rest) {
      if (type === 'message' && (this instanceof Worker || this instanceof MessagePort) && typeof fn === 'function') {
        const from = this instanceof Worker ? 'worker' : 'port';
        const wrapped = function (ev) {
          const d = ev.data;
          if (from === 'port' && d?.type === 'APPLY') {
            const p = d.argumentList?.[0]?.value;
            if (p && 'stage' in p) log(`progress ${p.stage} ${p.done}/${p.total} arrives`);
          } else if (from === 'worker' && Array.isArray(d?.value)) log('scan result arrives');
          return fn.call(this, ev);
        };
        return listen.call(this, type, wrapped, ...rest);
      }
      return listen.call(this, type, fn, ...rest);
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  for (const n of sizes) {
    const r = (results[n] = { finished: 0, stuck: 0, bounced: 0, late: 0, examples: [] });
    for (let i = 0; i < runs; i++) {
      await page.goto(APP_URL);
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Sort my recovered files' }).click()]);
      await chooser.setFiles(folders[n]);
      const review = page.getByRole('button', { name: /^Review my/ });
      const reached = await review.waitFor({ timeout: 15_000 }).then(() => true, () => false);
      // Still there a moment later? (The bug could show the results, then go back to 100%.)
      await page.waitForTimeout(reached ? 800 : 0);
      const stayed = reached && await review.isVisible();
      const { headings, events } = await page.evaluate(() => ({ headings: window.__headings, events: window.__events }));
      // The race itself: a progress update arrived after the scan's answer.
      const answer = events.indexOf('scan result arrives');
      if (answer >= 0 && events.slice(answer).some((e) => e.startsWith('progress'))) r.late++;
      if (stayed) r.finished++;
      else {
        r.stuck++;
        // Showed the results ("We found …"), then went back to the progress screen.
        if (headings.findIndex((h) => h.startsWith('We found')) >= 0 && /^Checking/.test(headings[headings.length - 1])) r.bounced++;
        const progress = await page.locator('.progress-text').innerText().catch(() => '');
        if (r.examples.length < 3) {
          r.examples.push(`run ${i + 1}: ${headings.join(' -> ')}${progress ? ` [${progress.replace(/\s+/g, ' ')}]` : ''}`);
          r.examples.push(`    worker traffic: ${events.join(', ')}`);
        }
      }
    }
    console.log(`${n} file(s): ${r.finished}/${runs} finished, ${r.stuck} stuck (${r.bounced} of them showed the results first, then fell back); progress arrived after the answer in ${r.late}`);
    for (const e of r.examples) console.log(`    ${e}`);
  }
  if (errors.length) console.log(`page errors:\n  ${errors.join('\n  ')}`);
  await context.close();
} finally {
  await browser?.close();
  stopServer();
  rmSync(root, { recursive: true, force: true });
}
const stuck = Object.values(results).reduce((s, r) => s + r.stuck, 0);
console.log(stuck ? `\nSMALL-SCAN CHECK FAILED: ${stuck} stuck run(s)` : '\nSMALL-SCAN CHECK PASSED');
process.exit(stuck ? 1 : 0);
