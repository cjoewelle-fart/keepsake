// Isolated real-UI component captures of the Upsort test build (dist-test) on the pilot folder.
// Usage: node video/capture/parts.mjs [--port 4600]   (expects `node scripts/serve-dist.mjs dist-test --port 4600`)
// Read-only: never edits the DOM/CSS/text; only crops page screenshots / screencast frames to real elements.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';

const REPO = '/home/claude/keepsake';
const PILOT = `${REPO}/fixtures/pilot/Recovered from old phone`;
const OUT = `${REPO}/video/capture/out/parts`;
const RAW = `${REPO}/video/capture/out/raw/parts`;
const EXE = '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const port = process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : '4600';
const base = `http://localhost:${port}`;
const VW = 1440, VH = 900, DPR = 2, PAD = 24;
rmSync(RAW, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true }); mkdirSync(RAW, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const flat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const log = (...a) => console.log('[parts]', ...a);
const manifest = { viewport: { width: VW, height: VH, deviceScaleFactor: DPR }, padCssPx: PAD, build: 'dist-test', stills: [], clips: [], notes: [], errors: [], outside: [] };

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--force-device-scale-factor=2'] }) // 2x screencast frames;
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, reducedMotion: 'no-preference' });
ctx.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('blob:') && !u.startsWith('data:')) manifest.outside.push(u); });
await ctx.addInitScript((name) => {
  window.__pick = 'rec';
  window.showDirectoryPicker = async () => {
    const desk = await (await navigator.storage.getDirectory()).getDirectoryHandle('Desktop');
    return window.__pick === 'rec' ? desk.getDirectoryHandle(name) : desk.getDirectoryHandle('Pictures');
  };
}, basename(PILOT));
const page = await ctx.newPage();
page.on('pageerror', (e) => manifest.errors.push(`page error: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && manifest.errors.push(`console: ${m.text()}`));
const cdp = await ctx.newCDPSession(page);

// ---- helpers ----
/** Viewport rect (CSS px) of the union of the selectors' first matches. */
const rectOf = (sels) => page.evaluate((sels) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of [].concat(sels)) {
    const el = typeof s === 'string' ? document.querySelector(s) : null;
    if (!el) continue;
    const r = el.getBoundingClientRect();
    x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}, sels);
const rectOfLoc = async (loc) => { const b = await loc.boundingBox(); return b && { x: b.x, y: b.y, w: b.width, h: b.height }; };
const padRect = (r, pad = PAD) => {
  const x = Math.max(0, Math.floor(r.x - pad)), y = Math.max(0, Math.floor(r.y - pad));
  return { x, y, width: Math.min(VW, Math.ceil(r.x + r.w + pad)) - x, height: Math.min(VH, Math.ceil(r.y + r.h + pad)) - y };
};
/** Scroll so the rect's top sits `top` px below the viewport top (page's own scroll). */
const scrollToTop = async (loc, top = 80) => {
  const y = await loc.evaluate((el, top) => el.getBoundingClientRect().top + scrollY - top, top);
  await page.evaluate((y) => window.scrollTo(0, Math.max(0, y)), y);
  await sleep(400);
};
const parkMouse = () => page.mouse.move(VW - 2, VH - 2);
/** Padded clip of a real element (or union), within the viewport. */
async function still(file, shows, selector, rect) {
  if (!rect) throw new Error(`no rect for ${file}`);
  const clip = padRect(rect);
  if (rect.y - PAD < 0 || rect.y + rect.h + PAD > VH) manifest.notes.push(`${file}: element+padding exceeds the viewport; clipped to it`);
  await page.screenshot({ path: join(OUT, file), clip });
  const e = { file, shows, selector, cssRect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) }, pixelSize: [clip.width * DPR, clip.height * DPR] };
  manifest.stills.push(e); log('still', file, e.pixelSize.join('x'));
}
const previewsReady = (sel, ms = 8000) => page.waitForFunction((sel) => {
  const el = document.querySelector(sel); return el && el.querySelectorAll('.tile-label').length === 0;
}, sel, { timeout: ms }).catch(() => manifest.notes.push(`previews not all shown within wait for ${sel}`));

// ---- screencast recorder (full viewport; cropped later to the element rect) ----
let cur = null;
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  if (cur) {
    const file = `f${String(cur.frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(join(cur.dir, file), Buffer.from(data, 'base64'));
    cur.frames.push({ file, ts: metadata.timestamp, scrollY: metadata.scrollOffsetY, w: metadata.deviceWidth });
  }
  try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch { /* stopped */ }
});
async function startClip(name, lead = 500) {
  const dir = join(RAW, name); mkdirSync(dir, { recursive: true });
  cur = { name, dir, frames: [] };
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1, maxWidth: VW * DPR, maxHeight: VH * DPR });
  cur.t0 = Date.now() / 1000;
  await sleep(lead);
}
async function stopClip(meta, hold = 1500) {
  await sleep(hold);
  cur.t1 = Date.now() / 1000;
  await cdp.send('Page.stopScreencast'); await sleep(150);
  const c = cur; cur = null;
  const crop = padRect(meta.rect);
  const rec = { name: c.name, t0: meta.from ?? c.t0, t1: meta.to ?? c.t1, crop, dpr: DPR, frames: c.frames };
  writeFileSync(join(c.dir, 'frames.json'), JSON.stringify(rec, null, 1));
  manifest.clips.push({ file: `${c.name}.mp4`, lastFrame: `${c.name}-last.png`, shows: meta.shows, selector: meta.selector, cssCrop: crop, pixelSize: [crop.width * DPR, crop.height * DPR], seconds: +(rec.t1 - rec.t0).toFixed(2), framesCaptured: c.frames.length, ...(meta.extra || {}) });
  log(`clip ${c.name}: ${c.frames.length} frames, ${(rec.t1 - rec.t0).toFixed(2)} s`);
}
const unionR = (a, b) => (!a ? b : !b ? a : { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x), h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y) });

// ---- setup: copy the pilot folder into OPFS, off camera ----
await page.goto(`${base}/`);
await page.evaluate(() => { const i = document.createElement('input'); i.type = 'file'; i.webkitdirectory = true; i.id = 'pilot-up'; i.style.display = 'none'; document.body.appendChild(i); });
await page.setInputFiles('#pilot-up', PILOT);
manifest.copied = await page.evaluate(async () => {
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
});
log(`copied ${manifest.copied} files into OPFS`);

// ---- start ----
const goStart = async () => { await page.goto(`${base}/`); await page.locator('main.start').waitFor(); await sleep(3500); await parkMouse(); };
await goStart();
const sortBtn = page.getByRole('button', { name: 'Sort my recovered files' });
await still('P1-start-sort-button.png', 'Start: main button "Sort my recovered files"', 'main.start .start-cta .btn-primary', await rectOfLoc(sortBtn));
await still('P2-start-heading.png', 'Start: h1 with the three-print fan', 'main.start h1.hero-h', await rectOf('main.start h1.hero-h'));
await still('P3-start-privacy-line.png', 'Start: privacy line (lock icon + promise)', 'main.start .privacy-line', await rectOf('main.start .privacy-line'));
manifest.notes.push(`start texts: button "${flat(await sortBtn.innerText())}"; privacy "${flat(await page.locator('.privacy-line').innerText())}"`);

const SCAN_SELS = ['main.scanning h1', 'main.scanning .progress-wrap', 'main.scanning ol.stages'];
const SCAN_SEL_TXT = 'main.scanning > h1 ∪ .progress-wrap ∪ ol.stages';
/** Runs a scan, polling the progress block; returns timing, union rect, texts. onTick(pct) may act. */
async function scan(onTick) {
  await page.locator('main.start').waitFor();
  await sortBtn.click();
  await parkMouse();
  let first = null, last = null, rect = null; const seen = [];
  for (let i = 0; i < 6000; i++) {
    const st = await page.evaluate((sels) => {
      const m = document.querySelector('main.scanning'); if (!m) return { on: false, res: !!document.querySelector('main.results') };
      return { on: true, t: Date.now() / 1000, txt: m.querySelector('.progress-text')?.textContent ?? '', h1: m.querySelector('h1')?.textContent ?? '' };
    }, SCAN_SELS);
    if (st.on) {
      first ??= st.t; last = st.t;
      rect = unionR(rect, await rectOf(SCAN_SELS));
      const k = `${st.h1} | ${st.txt}`; if (seen.at(-1) !== k) seen.push(k);
      const pct = +(st.txt.match(/(\d+)%/)?.[1] ?? 0);
      if (onTick) await onTick(pct, st);
    } else if (st.res || first) break;
    await sleep(15);
  }
  await page.locator('main.results').waitFor({ timeout: 120000 });
  return { first, last, rect, seen };
}
const startOver = async () => {
  await page.getByRole('button', { name: /Sort a different folder/ }).first().click();
  const confirm = page.getByRole('button', { name: /Start over|Yes/ });
  await sleep(400);
  if (!(await page.locator('main.start').count())) await confirm.last().click().catch(() => {});
  await page.locator('main.start').waitFor({ timeout: 10000 });
  await sleep(3000); await parkMouse();
};

// ---- C1a: real scan, no throttling ----
await startClip('C1a-scan-progress-realtime', 300);
let s1 = await scan();
await stopClip({ rect: s1.rect, from: s1.first - 0.05, to: s1.last + 0.05, shows: 'Scanning progress block during a real scan, start to finish (no CPU throttling, real speed)', selector: SCAN_SEL_TXT, extra: { throttle: 1, states: s1.seen.length, firstState: s1.seen[0], lastState: s1.seen.at(-1) } }, 300);
manifest.notes.push(`real scan visible for ${(s1.last - s1.first).toFixed(2)} s, ${s1.seen.length} progress states`);

// ---- results stills (from scan 1) ----
await sleep(3500); await parkMouse();
manifest.results = {
  groups: (await page.locator('.group-head').allInnerTexts()).map(flat),
  chips: (await page.locator('.sheet .chips .chip').allInnerTexts()).map(flat),
  sheetH: flat(await page.locator('#kept-h').innerText()),
};
log(JSON.stringify(manifest.results));
const aside = page.locator('section.aside');
await scrollToTop(aside, 40); await parkMouse();
const asideR = await rectOfLoc(aside);
await still('P5-results-setaside-card.png', `Results: whole "Set aside, kept safe" card (${manifest.results.groups.length} groups, collapsed)`, 'main.results section.aside', asideR);
const groupNames = ['Small preview copies', 'Exact copies', 'Damaged or incomplete files', 'App and system files'];
for (const [i, g] of groupNames.entries()) {
  const li = page.locator('li.group', { has: page.locator('.group-head', { hasText: g }) });
  if (!(await li.count())) { manifest.notes.push(`group row "${g}" not present`); continue; }
  await still(`P5-results-group-${i + 1}-${g.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '')}.png`, `Results: set-aside group row collapsed: "${flat(await li.innerText())}"`, `li.group:has(.group-head:has-text("${g}"))`, await rectOfLoc(li));
}
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(500);
const safe = page.locator('main.results .promise-safe');
await safe.scrollIntoViewIfNeeded(); await sleep(300);
await still('P6-results-safe-box.png', `Results: "${flat(await safe.innerText())}"`, 'main.results .promise-safe', await rectOfLoc(safe));

// ---- C2: results kept card, year chips 2024 -> 2022 -> 2019 ----
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(400);
const sheet = page.locator('section.sheet');
const sheetTop = await sheet.evaluate((el) => el.getBoundingClientRect().top + scrollY);
if (sheetTop > 40) { await page.evaluate((y) => window.scrollTo(0, y), sheetTop - 40); await sleep(400); }
await parkMouse();
let c2rect = await rectOfLoc(sheet); const c2scroll = [await page.evaluate(() => scrollY)];
const wantYears = ['2024', '2022', '2019'].filter((y) => manifest.results.chips.some((c) => c.startsWith(y)));
const c2Shown = [];
await startClip('C2-results-year-chips', 800);
for (const y of wantYears) {
  await page.locator('section.sheet .chips .chip', { hasText: new RegExp(`^${y}`) }).click();
  await page.mouse.move(VW - 2, VH - 2, { steps: 1 });
  await sleep(1900);
  c2rect = unionR(c2rect, await rectOfLoc(sheet)); c2scroll.push(await page.evaluate(() => scrollY));
  c2Shown.push(`${y}: ${(await page.locator('#kept-view .month-h').allInnerTexts()).map(flat).join(' / ')}`);
}
await stopClip({ rect: c2rect, shows: `Results "${manifest.results.sheetH}" card: year chips clicked ${wantYears.join(' -> ')} (real mouse clicks; tiles change)`, selector: 'main.results section.sheet', extra: { scrollYDuring: c2scroll, monthsShown: c2Shown } }, 1200);
if (new Set(c2scroll).size > 1) manifest.notes.push(`C2: page scrolled during chip clicks (${c2scroll.join(',')}); crop is fixed`);

// ---- C3: set-aside group opening (Damaged, then Small preview copies) ----
for (const [tag, g] of [['damaged', 'Damaged or incomplete files'], ['small', 'Small preview copies']]) {
  const li = page.locator('li.group', { has: page.locator('.group-head', { hasText: g }) });
  if (!(await li.count())) continue;
  await scrollToTop(li, 120); await parkMouse();
  let r = await rectOfLoc(li);
  await startClip(`C3-setaside-open-${tag}`, 800);
  await li.locator('.group-head').click();
  await page.mouse.move(VW - 2, VH - 2);
  await sleep(1600);
  r = unionR(r, await rectOfLoc(li));
  const body = flat(await li.locator('.group-body').innerText()).slice(0, 300);
  await stopClip({ rect: r, shows: `Results: set-aside group "${g}" opened by clicking its row, revealing its explanation`, selector: `li.group:has(.group-head:has-text("${g}"))`, extra: { revealed: body } }, 1500);
  await li.locator('.group-head').click(); await sleep(500);
}

// ---- C1b + P4: throttled scans ----
await page.evaluate(() => window.scrollTo(0, 0));
await startOver();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await startClip('C1b-scan-progress-cpu4x', 300);
const s2 = await scan();
await stopClip({ rect: s2.rect, from: s2.first - 0.05, to: s2.last + 0.05, shows: 'Scanning progress block during a real scan, start to finish, with CDP CPU throttling x4 (slower than real)', selector: SCAN_SEL_TXT, extra: { throttle: 4, states: s2.seen.length, firstState: s2.seen[0], lastState: s2.seen.at(-1) } }, 300);
manifest.notes.push(`x4-throttled scan visible for ${(s2.last - s2.first).toFixed(2)} s, ${s2.seen.length} progress states`);
await sleep(1500);
await startOver();
// The scan runs in a worker, which CDP CPU throttling barely slows. To catch ~40% and ~90%, the scan
// worker is held still for a moment (a busy-wait evaluated in the worker, like a debugger pause) while
// the real page is screenshotted; nothing in the page is changed.
const workers = new Set(); page.on('worker', (w) => workers.add(w)); page.on('worker', (w) => w.on('close', () => workers.delete(w)));
// One scan per target: after a hold the scan catches up in a jump, so each still gets a fresh scan.
const got = {};
for (const [k, want] of [40, 90, 90, 90, 90, 90, 90, 90].entries()) {
  if (got[want]) continue;
  if (k > 0) { await sleep(1500); await startOver(); }
  const sN = await scan(async (pct, st) => {
    if (got[want] || !/^Checked/.test(st.txt) || pct < (want === 90 ? (k === 7 ? 75 : 82) : 35)) return;
    for (const w of workers) w.evaluate(() => { const t = Date.now(); while (Date.now() - t < 2500); }).catch(() => {});
    await sleep(250);
    const txt = flat(await page.locator('main.scanning .progress-text').innerText().catch(() => ''));
    const r = await rectOf(SCAN_SELS);
    if (!/^Checked/.test(txt) || !r) { manifest.notes.push(`P4 ${want}: hold landed after the checking stage ("${txt}"); retrying`); got[want] = undefined; return; }
    got[want] = txt;
    await still(`P4-scanning-progress-${want}.png`, `Scanning progress block at ~${want}% target (shown: "${txt}"; scan worker briefly held to catch it)`, SCAN_SEL_TXT, r);
  });
  manifest.notes.push(`P4 scan ${want}: states ${JSON.stringify(sN.seen)}`);
}
if (!got[40] || !got[90]) manifest.notes.push(`P4: caught ${JSON.stringify(got)}`);

// ---- review ----
await sleep(2500);
await page.getByRole('button', { name: /^Review my/ }).click();
await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor();
await sleep(2500); await parkMouse();
const months = await page.evaluate(() => [...document.querySelectorAll('.tl-month')].map((m) => ({ key: m.dataset.month, n: m.querySelectorAll('.tl-tile').length, h: m.getBoundingClientRect().height })));
manifest.reviewMonths = months;
const yearRow = page.locator('.tl-tools nav.chips').first();
await still('P7-review-year-chips.png', `Review: year chip row (${(await yearRow.locator('.chip').allInnerTexts()).map(flat).join(' · ')})`, '.tl-tools nav.chips (first)', await rectOfLoc(yearRow));
const toolsH = await page.locator('.tl-tools').evaluate((el) => el.getBoundingClientRect().height);
const footH = await page.locator('.tl-footer').evaluate((el) => el.getBoundingClientRect().height);
const room = VH - toolsH - footH - 2 * PAD - 40;
// Measure each month once rendered (tiles render lazily as they come into view).
const measured = [];
for (const mo of months.filter((m) => /^(2024|2022|2019)/.test(m.key ?? ''))) {
  const sec = page.locator(`.tl-month[data-month="${mo.key}"]`);
  await scrollToTop(sec, toolsH + PAD + 12); await sleep(300);
  measured.push({ key: mo.key, n: await sec.locator('figure.tl-tile').count(), h: (await rectOfLoc(sec)).h });
}
manifest.reviewMonthsMeasured = measured;
for (const y of ['2024', '2022', '2019']) {
  const cands = measured.filter((m) => m.key.startsWith(y));
  const fit = cands.filter((c) => c.h <= room);
  const m = fit.sort((a, b) => b.n - a.n)[0] ?? cands.sort((a, b) => a.h - b.h)[0];
  if (!m) { manifest.notes.push(`no ${y} month in review`); continue; }
  const sec = page.locator(`.tl-month[data-month="${m.key}"]`);
  await scrollToTop(sec, toolsH + PAD + 12); await parkMouse();
  await previewsReady(`.tl-month[data-month="${m.key}"]`); await sleep(800);
  const r = await rectOfLoc(sec);
  await still(`P7-review-month-${m.key}.png`, `Review: month section "${flat(await sec.locator('.month-h').innerText())}" with its ${m.n} tiles`, `.tl-month[data-month="${m.key}"]`, r);
  if (r.h > room) manifest.notes.push(`month ${m.key} taller than the clear area; may include sticky bar/footer`);
}
// single tiles: one ticked, one unticked via the real checkbox
{
  const sec = page.locator('.tl-month').nth(1);
  await scrollToTop(sec, toolsH + PAD + 12);
  const tiles = sec.locator('figure.tl-tile');
  await previewsReady('.tl-month:nth-of-type(2)', 3000);
  await sleep(800); await parkMouse();
  const a = tiles.nth(0), b = tiles.nth(1);
  await still('P7-review-tile-ticked.png', `Review: single tile, checkbox ticked ("${await a.locator('input[type=checkbox]').getAttribute('aria-label')}")`, '.tl-month figure.tl-tile (ticked)', await rectOfLoc(a));
  await b.locator('label.chk').click();
  await parkMouse(); await sleep(900);
  const on = await b.locator('input[type=checkbox]').isChecked();
  if (on) manifest.notes.push('untick did not take');
  await still('P7-review-tile-unticked.png', `Review: single tile after unticking its real checkbox ("${await b.locator('input[type=checkbox]').getAttribute('aria-label')}")`, '.tl-month figure.tl-tile.off', await rectOfLoc(b));
  // re-tick so the save count is the full set
  await b.locator('label.chk').click(); await parkMouse(); await sleep(500);
}

// ---- save ----
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
await page.locator('.tl-save:visible').first().click();
await page.getByRole('heading', { level: 1, name: /Where should we save/ }).waitFor();
await sleep(2500); await parkMouse();
const tree = page.locator('section.card-quiet', { has: page.locator('#tree-h') });
await tree.scrollIntoViewIfNeeded(); await sleep(300);
await still('P8-save-tree-card.png', `Save: "${flat(await tree.locator('h2,h3').first().innerText())}" tree card`, 'main.save section.card-quiet[aria-labelledby=tree-h]', await rectOfLoc(tree));
const folderCard = page.locator('section.card[aria-labelledby=folder-h]');
await folderCard.scrollIntoViewIfNeeded(); await sleep(300);
await still('P8-save-folder-card.png', `Save: "${flat(await folderCard.locator('#folder-h').innerText())}" card with its button`, 'main.save section.card[aria-labelledby=folder-h]', await rectOfLoc(folderCard));

// ---- done ----
await page.evaluate(() => { window.__pick = 'pictures'; window.scrollTo(0, 0); });
await folderCard.getByRole('button', { name: /Choose (a|a different) folder/ }).click();
await page.getByRole('heading', { level: 1, name: /saved\./ }).waitFor({ timeout: 300_000 });
await sleep(3000); await parkMouse();
await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
await still('P9-done-heading.png', `Done: "${flat(await page.locator('main.done h1').innerText())}" with its prints`, 'main.done .done-side > .no-print ∪ h1', await rectOf(['main.done .done-side > .no-print', 'main.done h1']));
const safeRow = page.locator('main.done .ledger-safe');
await safeRow.scrollIntoViewIfNeeded(); await sleep(300);
await still('P9-done-receipt-safe-row.png', `Done: receipt row "${flat(await safeRow.locator('dt [aria-hidden]').innerText())} — ${flat(await safeRow.locator('dd [aria-hidden]').innerText())}"`, 'main.done .receipt .ledger-safe', await rectOfLoc(safeRow));

writeFileSync(join(RAW, 'manifest.partial.json'), JSON.stringify(manifest, null, 1));
log(`done. errors ${manifest.errors.length}; outside ${manifest.outside.length}`);
await browser.close();
