// Screen-reader pre-check (T30): drives the TEST build in Chromium and prints what a screen reader
// would get for each of the 12 checks in team/research/screen-reader-pass.md: page titles, where
// focus lands, the accessibility tree (ARIA snapshot) in reading order, headings, and every change
// to a live region (role=status/alert, aria-live) with its time. It does not judge wording; compare
// the output with the script. It can't tell how a real reader voices or times things.
// The pilot folder is copied into the browser's private file system (OPFS) and picked through a
// stubbed folder picker, as in pilot-e2e.mjs; the big folder goes through the file-input fallback.
// Nothing on disk is written; no request leaves localhost (any that tries is printed and fails the run).
// Usage: npm run build:test && node scripts/sr-precheck.mjs --big <folder of a few thousand files>
//        [--folder "fixtures/pilot/Recovered from old phone"] [--port 4192] [chromiumPath]
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const pilotDir = resolve(opt('--folder', 'fixtures/pilot/Recovered from old phone'));
const bigDir = opt('--big', '');
const port = String(Number(opt('--port', '4192')));
const base = `http://localhost:${port}`;
const exe = args[0] || process.env.CHROMIUM_PATH;
if (!existsSync(pilotDir) || !existsSync('dist-test/index.html')) {
  console.error('Needs the pilot folder (scripts/make_pilot_folder.py) and dist-test/ (npm run build:test).');
  process.exit(2);
}
const outside = [];
const say = (n, k, v) => console.log(`[${n}] ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);

/** In the page: log focus moves, title changes and live-region text, with a timestamp. */
function recorder() {
  window.__log = [];
  const rec = (k, v) => window.__log.push({ t: Math.round(performance.now()), k, v });
  const name = (el) => (el.getAttribute?.('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  const LIVE = '[role=status],[role=alert],[aria-live]';
  document.addEventListener('focusin', (e) => rec('focus', `${e.target.tagName.toLowerCase()} "${name(e.target)}"`));
  document.addEventListener('focusout', () => setTimeout(() => { if (document.activeElement === document.body) rec('focus', 'BODY (focus lost)'); }, 0));
  const last = new Map();
  new MutationObserver((muts) => {
    for (const m of muts) {
      const nodes = [m.target, ...m.addedNodes];
      for (const n of nodes) {
        const el = n.nodeType === 1 ? n : n.parentElement;
        if (!el) continue;
        const r = el.closest(LIVE) || (el.querySelector?.(LIVE));
        if (!r) continue;
        const txt = (r.textContent || '').replace(/\s+/g, ' ').trim();
        const isNew = !last.has(r);
        if (last.get(r) === txt) continue;
        last.set(r, txt);
        // "new": the region arrived with its text already in it (readers often stay silent then; role=alert is the exception).
        if (txt) rec('live', `${r.getAttribute('role') || 'aria-live'}${isNew && m.addedNodes.length && [...m.addedNodes].some((a) => a === r || a.contains?.(r)) ? ' (new region)' : ''}: ${txt}`);
      }
    }
    if (document.title !== window.__title) { window.__title = document.title; rec('title', document.title); }
  }).observe(document, { subtree: true, childList: true, characterData: true });
  // Pre-existing regions count as known (empty).
  addEventListener('DOMContentLoaded', () => { for (const r of document.querySelectorAll(LIVE)) last.set(r, (r.textContent || '').replace(/\s+/g, ' ').trim()); });
}
const takeLog = (page) => page.evaluate(() => window.__log.splice(0));
const focused = (page) => page.locator('*:focus').ariaSnapshot().then((s) => s.replace(/\s+/g, ' ').trim(), () => page.evaluate(() => document.activeElement?.tagName));
/** Headings as Chromium's own accessibility tree has them (what a screen reader gets), via CDP. */
async function axHeadings(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  await cdp.detach();
  return nodes.filter((n) => !n.ignored && n.role?.value === 'heading').map((n) => `${n.name?.value} [${n.properties?.find((p) => p.name === 'level')?.value.value}]`);
}
const pick = (page, which) => page.evaluate(async (w) => { window.showDirectoryPicker = async () => (w === 'rec' ? window.__rec : await window.__desk.getDirectoryHandle(w)); }, which);
const wait = (page, ms) => page.waitForTimeout(ms);

async function pilot(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  ctx.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(blob|data):/.test(u)) outside.push(u); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => say('-', 'page error', e.message));
  await page.addInitScript(recorder);
  await page.goto(`${base}/`);
  // Copy the pilot folder into OPFS: Desktop/<folder>, Desktop/Empty, Desktop/Pictures.
  await page.evaluate(() => { const i = Object.assign(document.createElement('input'), { type: 'file', id: 'up', webkitdirectory: true }); i.style.display = 'none'; document.body.append(i); });
  await page.setInputFiles('#up', pilotDir);
  await page.evaluate(async (name) => {
    const root = await navigator.storage.getDirectory();
    for await (const k of root.keys()) await root.removeEntry(k, { recursive: true });
    const desk = await root.getDirectoryHandle('Desktop', { create: true });
    for (const f of document.getElementById('up').files) {
      const parts = f.webkitRelativePath.split('/');
      let d = desk;
      for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
      const w = await (await d.getFileHandle(parts.at(-1), { create: true })).createWritable();
      await w.write(f); await w.close();
    }
    document.getElementById('up').remove();
    await desk.getDirectoryHandle('Pictures', { create: true });
    await desk.getDirectoryHandle('Empty', { create: true });
    window.__rec = await desk.getDirectoryHandle(name);
    window.__desk = desk;
  }, basename(pilotDir));
  await page.reload(); // a fresh start screen, as the owner would see it (OPFS stays)
  await page.evaluate(async (name) => { const desk = await (await navigator.storage.getDirectory()).getDirectoryHandle('Desktop'); window.__desk = desk; window.__rec = await desk.getDirectoryHandle(name); }, basename(pilotDir));
  await wait(page, 300);

  // 1. Start screen.
  say(1, 'title', await page.title());
  say(1, 'focus', await focused(page));
  say(1, 'reading order (body)', (await page.locator('body').ariaSnapshot()).replace(/\n\s*/g, ' | '));
  await takeLog(page);

  // 2. Empty folder, twice (the second pick must be announced too).
  for (const round of [1, 2]) {
    await pick(page, 'Empty');
    await page.getByRole('button', { name: 'Choose recovery folder' }).click();
    await wait(page, 800);
    say(2, `pick ${round}: live/focus log`, (await takeLog(page)).map((e) => `${e.k}: ${e.v}`));
    say(2, `pick ${round}: focus now`, await focused(page));
  }

  // 3. Info pages.
  for (const link of ['How Keepsake keeps your photos private', 'New to PhotoRec? Here’s how to recover your files']) {
    await page.getByRole('button', { name: link }).click();
    await wait(page, 300);
    say(3, `${link}: title`, await page.title());
    say(3, `${link}: focus`, await focused(page));
    // Chromium's tree, not Playwright's ariaSnapshot: the snapshot leaves out the guide's "Part 1…6" h2s.
    say(3, `${link}: headings (Chromium AX tree)`, (await axHeadings(page)).join(' / '));
    if (/PhotoRec/.test(link)) {
      const see = await page.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => /^You should see/.test(e.textContent.trim()) && ![...e.children].some((c) => /^You should see/.test(c.textContent.trim()))).map((e) => `${e.tagName}${e.closest('li') ? ' in li' : ''}${/^H\d/.test(e.tagName) ? ' HEADING' : ''}`));
      say(3, '"You should see" elements', see.join(', '));
      say(3, 'headings in the DOM (h1-h3)', await page.evaluate(() => [...document.querySelectorAll('main h1,main h2,main h3')].map((h) => `${h.tagName} ${h.textContent}${h.closest('[aria-hidden=true],[hidden]') ? ' (HIDDEN)' : ''}`).join(' / ')));
    }
    const backs = page.getByRole('button', { name: 'Back to start' });
    say(3, `${link}: "Back to start" buttons`, String(await backs.count()));
    await backs.last().click();
    await wait(page, 300);
    say(3, 'after Back to start (bottom): title / focus', `${await page.title()} / ${await focused(page)}`);
  }
  await page.getByRole('button', { name: 'How Keepsake keeps your photos private' }).click();
  await wait(page, 200);
  await page.getByRole('button', { name: 'Back to start' }).first().click();
  await wait(page, 300);
  say(3, 'after Back to start (top): focus', await focused(page));
  await takeLog(page);

  // 6. Results.
  await pick(page, 'rec');
  await page.getByRole('button', { name: 'Choose recovery folder' }).click();
  await page.getByText('Files checked').waitFor({ timeout: 120_000 });
  await wait(page, 1000);
  say(6, 'title', await page.title());
  say(6, 'focus', await focused(page));
  say(6, 'reading order (main)', (await page.locator('main').ariaSnapshot()).replace(/\n\s*/g, ' | '));
  say(6, 'group buttons', await page.locator('.group-head').evaluateAll((b) => b.map((x) => `${x.textContent.replace(/\s+/g, ' ').trim()} [expanded=${x.getAttribute('aria-expanded')}]`)));
  await takeLog(page);

  // 7. Keep these files (keyboard), then set aside again.
  const g = page.locator('.group-head', { hasText: 'Small preview copies' });
  await g.focus(); await page.keyboard.press('Space'); await wait(page, 200);
  say(7, 'group after opening', await focused(page));
  const keep = page.getByRole('button', { name: 'Keep these files' });
  await keep.focus(); await page.keyboard.press('Enter'); await wait(page, 2000);
  say(7, 'within 2 s', (await takeLog(page)).map((e) => `${e.t} ${e.k}: ${e.v}`));
  say(7, 'focus now', await focused(page));
  say(7, 'h1 / ledger', `${await page.locator('main h1').ariaSnapshot()} / ${(await page.locator('dl.ledger').ariaSnapshot()).replace(/\n\s*/g, ' | ')}`);
  say(7, 'group row', await g.ariaSnapshot());
  await page.keyboard.press('Enter'); await wait(page, 2000);
  say(7, 'after "Set these aside again"', (await takeLog(page)).map((e) => `${e.k}: ${e.v}`));

  // 8. No date.
  const nd = page.getByRole('group', { name: 'Jump to a year' }).getByRole('button', { name: /^No date/ });
  say(8, 'button', await nd.ariaSnapshot().catch(() => 'not found'));
  await nd.focus(); await page.keyboard.press('Enter'); await wait(page, 500);
  say(8, 'focus after Enter', await focused(page));
  await takeLog(page);

  // 9. Review: title, focus, Tab order, names; months far down before scrolling (M3).
  await page.getByRole('button', { name: /^Review my/ }).click();
  await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor();
  await wait(page, 600);
  say(9, 'title', await page.title());
  say(9, 'focus', await focused(page));
  const far = await page.evaluate(() => { const ms = [...document.querySelectorAll('.tl-month')]; const m = ms[Math.floor(ms.length * 0.8)]; return { month: m.dataset.month, boxes: m.querySelectorAll('input[type=checkbox]').length, text: m.innerText.replace(/\s+/g, ' ').slice(0, 120) }; });
  say(9, 'a month 80% down, before scrolling to it (what browse mode would meet)', far);
  const stops = [];
  for (let i = 0; i < 700; i++) {
    await page.keyboard.press('Tab'); await wait(page, 25);
    const f = await focused(page);
    if (stops.at(-1) === f || /Back to Sort/.test(f)) break;
    stops.push(f);
  }
  say(9, `first 32 of ${stops.length} Tab stops`, stops.slice(0, 32).join(' → '));
  const ex = (re) => stops.find((s) => re.test(s)) ?? 'none';
  say(9, 'examples', { month: ex(/button "(Unselect|Select) all of/), day: ex(/checkbox "(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day/), photo: ex(/checkbox "Save photo from/), video: ex(/checkbox "Save video/), nodate: ex(/checkbox "Save (photo|video) with no date/), photoStops: stops.filter((s) => /checkbox "Save (photo|video)/.test(s)).length });
  const total = Number((await page.locator('dd[data-k=total]').innerText()).replace(/\D/g, ''));
  say(9, 'photos in the timeline', String(total));
  await takeLog(page);

  // 10. Unselect all, the disabled Save, then 2022 month by month, then one photo.
  await page.locator('main h1').focus();
  await page.getByRole('button', { name: 'Unselect all', exact: true }).click(); await wait(page, 1500);
  say(10, 'after Unselect all', (await takeLog(page)).filter((e) => e.k === 'live').map((e) => e.v));
  say(10, 'Save button', `${await page.locator('.tl-wide .tl-save').ariaSnapshot()} aria-disabled=${await page.locator('.tl-wide .tl-save').getAttribute('aria-disabled')} description="${await page.locator('.tl-wide .tl-save').evaluate((b) => document.getElementById(b.getAttribute('aria-describedby'))?.textContent ?? '')}"`);
  const year = '2022';
  await page.getByRole('navigation', { name: 'Jump to a year' }).getByRole('button', { name: year }).click(); await wait(page, 400);
  const months = await page.locator(`.tl-month[data-month^="${year}-"]`).evaluateAll((m) => m.map((x) => x.dataset.month).reverse());
  const said10 = [];
  for (const k of months) {
    const b = page.locator(`.tl-month[data-month="${k}"]`).getByRole('button', { name: /^Select all of/ });
    const nm = await b.textContent();
    await b.click(); await wait(page, 1400);
    said10.push(`${nm} → ${(await takeLog(page)).filter((e) => e.k === 'live').map((e) => e.v).join(' // ')}`);
  }
  say(10, `${year} months (newest first)`, said10);
  const box = page.locator(`.tl-month[data-month="${months.at(-1)}"] .tl-grid input[type=checkbox]`).first();
  await box.click(); await wait(page, 1400);
  say(10, 'untick one', (await takeLog(page)).filter((e) => e.k === 'live').map((e) => e.v));
  await box.click(); await wait(page, 1400);
  say(10, 'tick it again', (await takeLog(page)).filter((e) => e.k === 'live').map((e) => e.v));

  // 11. Save: choose; the recovery folder is refused.
  await page.locator('.tl-wide .tl-save').click();
  await page.getByRole('heading', { level: 1, name: /Where should we save/ }).waitFor();
  await wait(page, 300);
  say(11, 'title', await page.title());
  say(11, 'focus', await focused(page));
  say(11, 'reading order (main)', (await page.locator('main').ariaSnapshot()).replace(/\n\s*/g, ' | '));
  await takeLog(page);
  await pick(page, 'rec');
  const choose = page.getByRole('button', { name: 'Choose a folder' });
  await choose.focus(); await page.keyboard.press('Enter'); await wait(page, 800);
  say(11, 'after picking the recovery folder', (await takeLog(page)).map((e) => `${e.k}: ${e.v}`));
  say(11, 'focus now', await focused(page));

  // 12. Save into Pictures; the receipt.
  await pick(page, 'Pictures');
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { level: 1, name: /saved\./ }).waitFor({ timeout: 60_000 });
  await wait(page, 500);
  say(12, 'log while saving', (await takeLog(page)).map((e) => `${e.k}: ${e.v}`));
  say(12, 'title', await page.title());
  say(12, 'focus', await focused(page));
  say(12, 'headings (Chromium AX tree)', (await axHeadings(page)).join(' / '));
  say(12, 'reading order (main)', (await page.locator('main').ariaSnapshot()).replace(/\n\s*/g, ' | '));
  await ctx.close();
}

async function big(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  ctx.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !/^(blob|data):/.test(u)) outside.push(u); });
  const page = await ctx.newPage();
  await page.addInitScript(recorder);
  await page.addInitScript(() => { for (const k of ['showDirectoryPicker']) { delete window[k]; delete Window.prototype[k]; } });
  await page.goto(`${base}/`);
  const scanBig = async () => {
    const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose recovery folder' }).click()]);
    await ch.setFiles(bigDir);
  };
  // 4. Progress announcements over a whole scan.
  await takeLog(page);
  await scanBig();
  await page.getByText('Files checked').waitFor({ timeout: 600_000 });
  const log = await takeLog(page);
  const live = log.filter((e) => e.k === 'live');
  say(4, 'focus moves', log.filter((e) => e.k === 'focus').map((e) => e.v));
  say(4, `${live.length} live-region changes`, live.map((e) => `${e.t} ${e.v}`));
  // 5. Stop keeps focus.
  await page.getByRole('button', { name: 'Sort a different folder' }).click();
  await wait(page, 300); await takeLog(page);
  await scanBig();
  const stop = page.getByRole('button', { name: 'Stop scanning' });
  await stop.waitFor();
  await page.getByRole('heading', { level: 1, name: /Checking your files/ }).waitFor();
  await wait(page, 1500);
  await stop.focus(); await takeLog(page);
  await page.keyboard.press('Enter');
  await wait(page, 30);
  say(5, 'right after Enter: focus', await focused(page).catch(() => 'gone'));
  say(5, 'right after Enter: aria-disabled', String(await page.locator('.scanning button').getAttribute('aria-disabled').catch(() => 'gone')));
  await page.getByText(/Scan stopped/).waitFor({ timeout: 60_000 });
  await wait(page, 500);
  say(5, 'log from Enter on', (await takeLog(page)).map((e) => `${e.t} ${e.k}: ${e.v}`));
  say(5, 'focus at end', await focused(page));
  await ctx.close();
}

const server = spawn('npx', ['vite', 'preview', '--outDir', 'dist-test', '--port', port, '--strictPort'], { stdio: 'pipe', detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch { /* gone */ } };
let browser;
try {
  await new Promise((r, j) => { server.stdout.on('data', (d) => String(d).includes(port) && r()); server.on('exit', () => j(new Error(`preview server exited (port ${port} in use?)`))); });
  browser = await chromium.launch({ executablePath: exe });
  await pilot(browser);
  if (bigDir) await big(browser); else console.log('[4,5] skipped: pass --big <folder>');
} finally {
  await browser?.close();
  stopServer();
}
console.log(outside.length ? `REQUESTS OUTSIDE localhost: ${outside.join(', ')}` : 'No request left localhost.');
process.exit(outside.length ? 1 : 0);
