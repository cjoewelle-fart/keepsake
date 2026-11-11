// Real-screen capture of the Upsort test build (dist-test) on the pilot folder, via CDP screencast.
// Usage: node capture.mjs <desktop|phone> [--port 4600]
// Expects `node scripts/serve-dist.mjs dist-test --port 4600` running (from the repo).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const REPO = '/home/claude/keepsake';
const PILOT = `${REPO}/fixtures/pilot/Recovered from old phone`;
const OUT = process.env.CAPTURE_OUT || 'video/capture/out';
const EXE = '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const set = process.argv[2] || 'desktop';
const port = process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : '4600';
const base = `http://localhost:${port}`;
const PHONE = set === 'phone';
const VW = PHONE ? 390 : 1920, VH = PHONE ? 844 : 1080, DPR = PHONE ? 3 : 1;
const setDir = join(OUT, set);
const rawDir = join(OUT, 'raw', set);
rmSync(rawDir, { recursive: true, force: true });
mkdirSync(setDir, { recursive: true });
mkdirSync(rawDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const flat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const log = (...a) => console.log(`[${set}]`, ...a);
const info = { set, viewport: { width: VW, height: VH, deviceScaleFactor: DPR, isMobile: PHONE, hasTouch: PHONE }, shots: {}, outside: [], errors: [] };

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: PHONE ? ['--force-device-scale-factor=3'] : [] });
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, isMobile: PHONE, hasTouch: PHONE,
  reducedMotion: 'no-preference', acceptDownloads: true,
});
ctx.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('blob:') && !u.startsWith('data:')) info.outside.push(u); });
// The folder picker stand-in (as pilot-e2e): hands back an OPFS folder. window.__pick picks which.
await ctx.addInitScript((name) => {
  window.__pick = 'rec';
  window.showDirectoryPicker = async () => {
    const desk = await (await navigator.storage.getDirectory()).getDirectoryHandle('Desktop');
    return window.__pick === 'rec' ? desk.getDirectoryHandle(name) : desk.getDirectoryHandle('Pictures');
  };
}, basename(PILOT));
const page = await ctx.newPage();
page.on('pageerror', (e) => info.errors.push(`page error: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && info.errors.push(`console: ${m.text()}`));
const cdp = await ctx.newCDPSession(page);

// ---- screencast recorder ----
let cur = null;
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const arrived = Date.now() / 1000;
  if (cur) {
    const file = join(cur.dir, `f${String(cur.frames.length).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    cur.frames.push({ file, ts: metadata.timestamp, arrived, w: metadata.deviceWidth, h: metadata.deviceHeight });
  }
  try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch { /* stopped */ }
});
const clips = [];
async function startClip(name) {
  const dir = join(rawDir, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cur = { name, dir, frames: [] };
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1, maxWidth: VW * DPR, maxHeight: VH * DPR });
  cur.t0 = Date.now() / 1000;
  await sleep(500); // ~0.5 s before the action
}
async function stopClip(hold = 1500) {
  await sleep(hold);
  cur.t1 = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await sleep(150);
  const c = cur; cur = null;
  writeFileSync(join(c.dir, 'frames.json'), JSON.stringify({ t0: c.t0, t1: c.t1, frames: c.frames.map((f) => ({ ...f, file: basename(f.file) })) }, null, 1));
  clips.push({ name: c.name, n: c.frames.length, dur: +(c.t1 - c.t0).toFixed(2) });
  log(`clip ${c.name}: ${c.frames.length} frames over ${(c.t1 - c.t0).toFixed(2)} s`);
  return c;
}
const still = async (name, fullPage = false) => { await page.screenshot({ path: join(setDir, `${name}.png`), fullPage }); };
const press = async (loc) => { if (PHONE) await loc.tap(); else await loc.click(); };
/** Smooth scroll by the page's own scrolling, eased over `ms`. */
const smoothScroll = (toY, ms) => page.evaluate(async ({ toY, ms }) => {
  const from = scrollY; const t0 = performance.now();
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  await new Promise((done) => {
    const step = (now) => { const p = Math.min(1, (now - t0) / ms); window.scrollTo(0, from + (toY - from) * ease(p)); if (p < 1) requestAnimationFrame(step); else done(); };
    requestAnimationFrame(step);
  });
  return scrollY;
}, { toY, ms });
const mainText = async () => flat(await page.locator('main').innerText());

// ---- setup: copy the pilot folder into OPFS (pilot-e2e's approach), off camera ----
await page.goto(`${base}/`);
await page.evaluate(() => { const i = document.createElement('input'); i.type = 'file'; i.webkitdirectory = true; i.id = 'pilot-up'; i.style.display = 'none'; document.body.appendChild(i); });
await page.setInputFiles('#pilot-up', PILOT);
info.copied = await page.evaluate(async (name) => {
  const root = await navigator.storage.getDirectory();
  for await (const k of root.keys()) await root.removeEntry(k, { recursive: true });
  const desk = await root.getDirectoryHandle('Desktop', { create: true });
  let n = 0;
  for (const f of document.getElementById('pilot-up').files) {
    const parts = f.webkitRelativePath.split('/');
    let d = desk;
    for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
    const w = await (await d.getFileHandle(parts.at(-1), { create: true })).createWritable();
    await w.write(f); await w.close(); n++;
  }
  document.getElementById('pilot-up').remove();
  await desk.getDirectoryHandle('Pictures', { create: true });
  return n;
}, basename(PILOT));
log(`copied ${info.copied} files into OPFS`);

// ---- 1. start (entrance, then at rest) ----
await page.goto('about:blank');
await startClip('start-entrance');
await page.goto(`${base}/`);
await stopClip(3500);
await sleep(500);
await startClip('start');
await stopClip(3500); // 0.5 + 3.5 = 4 s at rest
await still('1-start');
info.shots.start = { h1: flat(await page.locator('main h1').innerText()), title: await page.title(), text: (await mainText()).slice(0, 600) };

// ---- 2. scan ----
await startClip('scan');
const tScan = Date.now();
await press(page.getByRole('button', { name: 'Sort my recovered files' }));
let progressSeen = [];
for (let i = 0; i < 2400; i++) {
  const t = await page.locator('main').innerText().catch(() => '');
  const m = t.match(/([\d,]+)\s+of\s+([\d,]+)\s+files/);
  if (m && progressSeen.at(-1) !== m[0]) progressSeen.push(m[0]);
  if (/Files checked/.test(t)) break;
  await sleep(40);
}
const scanMs = Date.now() - tScan;
await page.waitForFunction(() => { const l = document.querySelector('main h1 .count-live'); const s = document.querySelector('main h1 .sr-only'); return l && s && l.textContent === s.textContent; }, null, { timeout: 5000 }).catch(() => {});
await stopClip(1500);
info.shots.scan = { scanSeconds: +(scanMs / 1000).toFixed(2), progressTexts: progressSeen.slice(0, 5).concat(progressSeen.length > 5 ? ['…', progressSeen.at(-1)] : []) };
log(`scan ${scanMs} ms; progress seen: ${progressSeen.length} states`);

// ---- 3. results ----
await sleep(1000);
await startClip('results');
await stopClip(3500);
await still('3-results');
await still('3-results-full', true);
const ledger = await page.locator('dl.ledger > div').evaluateAll((ds) => ds.map((d) => ({ dt: d.querySelector('dt')?.textContent.replace(/\s+/g, ' ').trim(), dd: d.querySelector('dd')?.textContent.replace(/\s+/g, ' ').trim() })));
const groups = (await page.locator('.group-head').allInnerTexts()).map(flat);
const chips = (await page.locator('main .chips[role=group] .chip').allInnerTexts()).map(flat);
const h1r = await page.locator('main h1').evaluate((el) => { const c = el.cloneNode(true); c.querySelectorAll('[aria-hidden=true]').forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); });
info.shots.results = { h1: h1r, ledger, promise: flat(await page.locator('main .promise-safe').innerText().catch(() => '')), setAsideLine: ((await mainText()).match(/We set aside[^.]*\./) || [''])[0], groups, yearChips: chips };
log(JSON.stringify(info.shots.results));

// ---- 4. setaside: open the small preview copies group ----
const gHead = page.locator('.group-head', { hasText: /Small preview copies/ });
const y = await gHead.evaluate((el) => el.getBoundingClientRect().top + scrollY - innerHeight * (0.18));
await smoothScroll(Math.max(0, y), 900);
await sleep(600);
await startClip('setaside');
await press(gHead);
await sleep(1200);
// "See all" opens the full list of what was set aside
const toggle = page.locator('#aside-small .gf-toggle');
const seeAll = flat(await toggle.innerText().catch(() => ''));
await press(toggle);
await sleep(700);
const yy = await gHead.evaluate((el, ph) => el.getBoundingClientRect().top + scrollY - (ph ? 12 : 24), PHONE);
await smoothScroll(yy, 1400);
await stopClip(3000);
await still('4-setaside');
info.shots.setaside = { group: groups.find((g) => /Small preview/.test(g)), seeAll, text: flat(await page.locator('#aside-small').innerText()).slice(0, 700) };
// close it again, off camera
await press(toggle);
await press(gHead);
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(500);

// ---- 5. review: dated timeline, slow scroll ----
await press(page.getByRole('button', { name: /^Review my/ }));
await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor();
// let the first previews develop, as a person would see after a moment
await sleep(2500);
const docH = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
await startClip('review');
const target = Math.min(docH, Math.round(VH * (PHONE ? 7 : 4)));
await smoothScroll(target, 6500);
await stopClip(1500);
await still('5-review');
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(600);
await still('5-review-top');
const tl = await page.evaluate(() => [...document.querySelectorAll('.tl-month')].map((m) => [m.dataset.month, m.querySelector('.month-count')?.textContent ?? '']));
info.shots.review = { h1: flat(await page.locator('main h1').innerText()), scrolledToY: target, docScrollable: docH,
  filterChips: (await page.locator('.tl-filter[aria-label="Show only"] .chip').allInnerTexts()).map(flat),
  selected: flat(await page.locator('dl.ledger dd[data-k=selected]').innerText().catch(() => '')), months: tl };

// ---- 6. save: save screen, then done ----
await startClip('save');
await press(page.locator('.tl-save:visible').first());
await page.getByRole('heading', { level: 1, name: /Where should we save/ }).waitFor();
await sleep(2500);
info.shots.saveScreen = { h1: flat(await page.locator('main h1').innerText()), text: (await mainText()).slice(0, 900) };
await page.screenshot({ path: join(setDir, '6-save-choose.png') });
await page.evaluate(() => { window.__pick = 'pictures'; });
await press(page.getByRole('button', { name: /Choose (a|a different) folder/ }).first());
await page.getByRole('heading', { level: 1, name: /saved\./ }).waitFor({ timeout: 180_000 });
await sleep(900); // the tick draws
await stopClip(1500);
await startClip('done');
await stopClip(3500);
await still('6-done');
await still('6-done-full', true);
info.shots.done = { h1: flat(await page.locator('main h1').innerText()), lede: flat(await page.locator('main .lede').first().innerText().catch(() => '')),
  find: flat(await page.locator('[data-k=find]').innerText().catch(() => '')), saved: flat(await page.locator('dd[data-k=saved]').innerText().catch(() => '')),
  failed: flat(await page.locator('dd[data-k=failed]').innerText().catch(() => '')), text: (await mainText()).slice(0, 1500) };
// what landed in Pictures (OPFS)
info.saved = await page.evaluate(async () => {
  const pics = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Desktop')).getDirectoryHandle('Pictures');
  const files = [];
  const walk = async (d, p) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, `${p}${n}/`); else files.push(p + n); } };
  await walk(pics, '');
  return { count: files.length, folders: [...new Set(files.map((f) => f.split('/').slice(0, 3).join('/')))].sort() };
});
info.clips = clips;
writeFileSync(join(OUT, 'raw', `${set}-info.json`), JSON.stringify(info, null, 1));
log(`done. saved ${info.saved.count}; errors ${info.errors.length}; outside requests ${info.outside.length}`);
await browser.close();
