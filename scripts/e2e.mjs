// End-to-end check of the built app in a real browser.
// Usage: npm run build && node scripts/e2e.mjs [chromiumPath]
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const exe = process.argv[2] || process.env.CHROMIUM_PATH;
const out = 'e2e-shots';
mkdirSync(out, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'pipe', detached: true });
await new Promise((r) => server.stdout.on('data', (d) => String(d).includes('4173') && r()));

const num = (t) => Number(t.replace(/[^0-9]/g, ''));
/** The ledger must always add up: kept + set aside = files checked. */
async function checkLedger(page, label, when) {
  const v = await page.locator('dl.ledger dd').allInnerTexts();
  const [checked, kept, aside] = v.map(num);
  const ok = kept + aside === checked;
  console.log(`[${label}] ledger (${when}): ${checked} checked = ${kept} kept + ${aside} set aside ${ok ? 'OK' : 'MISMATCH'}`);
  if (!ok) problems.push(`[${label}] ledger does not add up (${when})`);
}
async function checkNoSideScroll(page, label, where) {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  if (sw > cw) problems.push(`[${label}] horizontal scroll on ${where}: ${sw}px > ${cw}px`);
}

/** Timeline ledger: selected + not selected = kept, and kept matches the Clean up screen. */
async function timelineLedger(page, label, when, expectTotal) {
  const get = async (k) => num(await page.locator(`dl.ledger dd[data-k=${k}]`).innerText());
  const [total, selected, unselected] = [await get('total'), await get('selected'), await get('unselected')];
  const ok = selected + unselected === total && (expectTotal === undefined || total === expectTotal);
  console.log(`[${label}] timeline ledger (${when}): ${selected} selected + ${unselected} not selected = ${total} kept ${ok ? 'OK' : 'MISMATCH'}`);
  if (!ok) problems.push(`[${label}] timeline ledger does not add up (${when}): ${selected} + ${unselected} vs ${total}, expected ${expectTotal}`);
  return { total, selected, unselected };
}
async function checkTimeline(page, label, keptOnResults) {
  const start = await timelineLedger(page, label, 'start', keptOnResults);
  if (start.selected !== start.total) problems.push(`[${label}] timeline: not everything starts selected`);
  const expect = (cond, what) => { if (!cond) problems.push(`[${label}] timeline: ${what}`); };

  // Untick a whole day (one with several photos, if there is one).
  const days = page.locator('.tl-day');
  // Pinned by position: a filter on "all … selected" would move to another day once this one is unticked.
  const key = await days.evaluateAll((els) => (els.find((e) => /^all/.test(e.querySelector('.tl-day-count')?.textContent ?? '')) ?? els[0]).dataset.day);
  const day = page.locator(`.tl-day[data-day="${key}"]`).first();
  const dayBox = day.locator('.tl-day-h input');
  const dayTotal = num((await day.locator('.tl-day-count').innerText()).replace(/selected/, ''));
  await dayBox.click();
  let s = await timelineLedger(page, label, 'day unticked', keptOnResults);
  expect(s.selected === start.selected - dayTotal, `unticking a day of ${dayTotal} left ${s.selected} of ${start.selected}`);
  expect(!(await dayBox.isChecked()), 'day checkbox still ticked after unticking the day');
  const tiles = day.locator('.tl-grid input[type=checkbox]');
  expect((await tiles.evaluateAll((els) => els.filter((e) => e.checked).length)) === 0, 'tiles still ticked after unticking the day');
  await page.waitForTimeout(1300);
  const said = await page.locator('main [role=status]').innerText();
  expect(/selected/.test(said), `selection change not announced (got "${said}")`);
  await page.screenshot({ path: `${out}/${label}-5-day-unticked.png` });

  // Tick one photo back: the day becomes mixed; clicking the day selects it all again.
  if (dayTotal > 1) {
    await tiles.first().click();
    expect(await dayBox.evaluate((e) => e.indeterminate), 'day checkbox not mixed after ticking one photo');
  }
  await dayBox.click();
  s = await timelineLedger(page, label, 'day ticked again', keptOnResults);
  expect(s.selected === start.selected, 'ticking the day again did not select all of it');

  // A whole month.
  const month = page.locator('.tl-month').first();
  const monthTotal = num((await month.locator('.month-count').innerText()).replace(/^.* of /, ''));
  await month.getByRole('button', { name: /^Unselect all of/ }).click();
  s = await timelineLedger(page, label, 'month unticked', keptOnResults);
  expect(s.selected === start.selected - monthTotal, `unticking a month of ${monthTotal} left ${s.selected}`);
  await month.getByRole('button', { name: /^Select all of/ }).click();
  s = await timelineLedger(page, label, 'month ticked again', keptOnResults);
  expect(s.selected === start.selected, 'ticking the month again did not select all of it');

  // A single photo.
  const one = page.locator('.tl-grid input[type=checkbox]').nth(0);
  const name = await one.getAttribute('aria-label');
  expect(/^Save (photo|video|file) /.test(name ?? ''), `tile checkbox has no useful name ("${name}")`);
  await one.click();
  s = await timelineLedger(page, label, 'one unticked', keptOnResults);
  expect(s.selected === start.selected - 1, 'unticking one photo did not change the count by 1');

  // Nothing selected: Save explains why it can't go on.
  await page.getByRole('button', { name: 'Unselect all', exact: true }).click();
  s = await timelineLedger(page, label, 'none', keptOnResults);
  const save = page.locator('.tl-save:visible');
  expect(s.selected === 0, 'Unselect all left files selected');
  expect((await save.getAttribute('aria-disabled')) === 'true', 'Save not disabled with nothing selected');
  expect(/nothing to save/.test(await page.locator('#save-why').innerText()), 'no reason shown for the disabled Save');
  await save.click({ force: true });
  expect(await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).isVisible(), 'disabled Save still moved on');
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  s = await timelineLedger(page, label, 'all again', keptOnResults);
  expect(s.selected === s.total, 'Select all did not select everything');

  // Choices survive a trip back to Clean up.
  await page.locator('.tl-grid input[type=checkbox]').nth(0).click();
  await page.getByRole('button', { name: 'Back to Clean up' }).click();
  await page.getByRole('button', { name: /^Review my/ }).click();
  s = await timelineLedger(page, label, 'after Clean up and back', keptOnResults);
  expect(s.selected === s.total - 1, 'selection lost after going back to Clean up');

  await page.locator('.tl-save:visible').click();
  await page.getByRole('heading', { level: 1, name: /Where should we save/ }).waitFor();
  const h = await page.locator('h1').innerText();
  expect(num(h) === s.selected, `save step got ${h}, expected ${s.selected}`);
  const onLedger = num(await page.locator('dl.ledger dd[data-k=selected]').innerText());
  expect(onLedger === s.selected, `save ledger says ${onLedger} selected, timeline said ${s.selected}`);
  return s.selected;
}

/**
 * T51: the highlighted month (pill, and the month picker's value) is the month showing at the
 * top of the screen, just under the jump bar when it stays in view, whichever way you scroll.
 */
async function checkScrollSpy(page, label) {
  const keys = await page.locator('.tl-month').evaluateAll((els) => els.map((e) => e.dataset.month));
  if (keys.length < 2) { console.log(`[${label}] month highlight: only ${keys.length} month, skipped`); return; }
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  /** Scroll so month `i`'s top sits `dy` px below the jump bar (or the window's top). */
  const place = async (i, dy) => {
    for (let k = 0; k < 3; k++) { // lazy blocks above can change size once drawn: settle, then place again
      await page.evaluate(([i, dy]) => {
        const tools = document.querySelector('.tl-tools');
        const sticky = getComputedStyle(tools).position === 'sticky';
        const el = document.querySelectorAll('.tl-month')[i];
        window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - (sticky ? tools.offsetHeight : 0) - dy);
      }, [i, dy]);
      await page.waitForTimeout(120);
      await settle();
    }
  };
  /** What's showing at the top, and what the page highlights. */
  const read = () => page.evaluate(() => {
    const tools = document.querySelector('.tl-tools');
    const line = Math.max(0, tools.getBoundingClientRect().bottom) + 1;
    let showing;
    for (const el of document.querySelectorAll('.tl-month')) { if (el.getBoundingClientRect().top <= line) showing = el.dataset.month; else break; }
    const pill = document.querySelector('.tl-months-pills .chip[aria-current]')?.textContent ?? null;
    return { showing, picked: document.querySelector('.tl-month-select select')?.value, pill };
  });
  const bad = [];
  const order = keys.length > 8 ? [0, 1, 2, Math.floor(keys.length / 2), keys.length - 2] : keys.slice(0, -1).map((_, i) => i);
  // Down the page, then back up: the month at the top, and the one before it while it's still showing.
  for (const i of [...order, ...[...order].reverse()]) {
    for (const dy of [-8, i > 0 ? 40 : null]) {
      if (dy === null) continue;
      await place(i, dy);
      const { showing, picked } = await read();
      const want = dy < 0 ? keys[i] : keys[i - 1];
      if (showing !== want) continue; // couldn't scroll there (end of the page): nothing to judge
      if (picked !== showing) bad.push(`${showing} at the top but ${picked} highlighted`);
    }
  }
  // Jumping with a pill highlights that month, even near the end of the page.
  const pills = page.locator('.tl-months-pills .chip:visible');
  if (await pills.count()) {
    const last = pills.last();
    const name = await last.innerText();
    await last.click();
    await page.waitForTimeout(150);
    const { pill, showing, picked } = await read();
    const geo = await page.evaluate(() => {
      const t = document.querySelector('.tl-tools').getBoundingClientRect();
      const ms = [...document.querySelectorAll('.tl-month')].map((e) => [e.dataset.month, Math.round(e.getBoundingClientRect().top)]).filter(([, y]) => y > -400 && y < 400);
      return { toolsBottom: Math.round(t.bottom), ms, y: scrollY, max: document.documentElement.scrollHeight - innerHeight };
    });
    if (pill !== name) bad.push(`jumped to ${name} but ${pill} highlighted (showing ${showing}, picker ${picked}) ${JSON.stringify(geo)}`);
  }
  console.log(`[${label}] month highlight: ${bad.length ? 'WRONG' : 'OK'} (${keys.length} months)`);
  for (const b of new Set(bad)) { console.log(`  ${b}`); problems.push(`[${label}] month highlight: ${b}`); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400); // let the days at the top draw again
  await settle();
}

/** The receipt: Saved matches what was selected, nothing failed; returns the saved count. */
async function checkReceipt(page, label, selected) {
  await page.getByRole('heading', { level: 1, name: /saved\./ }).waitFor({ timeout: 120_000 });
  const saved = num(await page.locator('dd[data-k=saved]').innerText());
  const failed = num(await page.locator('dd[data-k=failed]').innerText());
  console.log(`[${label}] receipt: ${saved} saved, ${failed} couldn't save (selected ${selected})`);
  if (saved !== selected || failed !== 0) problems.push(`[${label}] receipt says ${saved} saved + ${failed} failed, but ${selected} were selected`);
  const header = await page.locator('.step-line').innerText();
  if (header !== 'Done') problems.push(`[${label}] header on the receipt says "${header}"`);
  // "Save receipt" downloads a small text file with the same numbers.
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save receipt' }).click()]);
  const txt = readFileSync(await dl.path(), 'utf8');
  if (!new RegExp(`Saved\\s+${saved.toLocaleString('en')} `).test(txt)) problems.push(`[${label}] receipt file does not say ${saved} saved:\n${txt}`);
  if (!/Recovery folder\s+Untouched/.test(txt)) problems.push(`[${label}] receipt file has no recovery-folder line`);
  return saved;
}

/** Chromium: save into a folder. The picker is replaced by a folder in the origin-private file system (OPFS). */
async function saveToFolder(page, label, selected) {
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    for await (const k of root.keys()) await root.removeEntry(k, { recursive: true });
    const picked = await root.getDirectoryHandle('Pictures', { create: true });
    // A "Keepsake photos" folder that's already there: it must be added to, and this file left alone.
    const old = await picked.getDirectoryHandle('Keepsake photos', { create: true });
    const w = await (await old.getFileHandle('keep-me.txt', { create: true })).createWritable();
    await w.write('mine');
    await w.close();
    window.showDirectoryPicker = async () => picked;
  });
  await page.screenshot({ path: `${out}/${label}-6-choose.png`, fullPage: true });
  await checkNoSideScroll(page, label, 'choose where to save');
  await page.getByRole('button', { name: 'Choose a folder' }).click();
  const saved = await checkReceipt(page, label, selected);
  const disk = await page.evaluate(async () => {
    const files = [];
    const walk = async (d, path) => {
      for await (const [name, h] of d.entries()) {
        if (h.kind === 'directory') await walk(h, `${path}${name}/`);
        else files.push({ path: `${path}${name}`, size: (await h.getFile()).size, text: name === 'keep-me.txt' ? await (await h.getFile()).text() : undefined });
      }
    };
    await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle('Pictures'), '');
    return files;
  });
  const copies = disk.filter((f) => f.path !== 'Keepsake photos/keep-me.txt');
  const keep = disk.find((f) => f.path === 'Keepsake photos/keep-me.txt');
  console.log(`[${label}] folder: ${copies.length} copies written, e.g. ${copies.slice(0, 3).map((f) => f.path).join(' | ')}`);
  if (copies.length !== saved) problems.push(`[${label}] ${copies.length} files in the folder, receipt says ${saved}`);
  if (keep?.text !== 'mine') problems.push(`[${label}] the existing file in Keepsake photos was changed or removed`);
  const bad = copies.filter((f) => !/^Keepsake photos\/(\d{4}\/\d{2} [A-Z][a-z]+\/\d{4}-\d{2}-\d{2} \d{2}\.\d{2}( \(\d+\))?\.[a-z0-9]+|No date\/[^/]+)$/.test(f.path));
  if (bad.length) problems.push(`[${label}] badly named copies: ${bad.slice(0, 5).map((f) => f.path).join(', ')}`);
  if (copies.some((f) => f.size === 0)) problems.push(`[${label}] empty copies in the folder`);
  const find = await page.locator('[data-k=find]').innerText();
  if (!find.includes('Pictures › Keepsake photos')) problems.push(`[${label}] done screen doesn't say where the photos are ("${find}")`);
  await page.screenshot({ path: `${out}/${label}-7-done.png`, fullPage: true });
  await checkNoSideScroll(page, label, 'done');
}

/** Safari/Firefox path (no folder picker): zip downloads, checked with unzip -t. */
async function saveAsZip(page, label, selected) {
  await page.screenshot({ path: `${out}/${label}-6-choose-zip.png`, fullPage: true });
  await checkNoSideScroll(page, label, 'choose (zip)');
  const dir = mkdtempSync(join(tmpdir(), 'keepsake-e2e-zip-'));
  const zips = [];
  const saving = [];
  page.on('download', (d) => { if (d.suggestedFilename().endsWith('.zip')) saving.push(d.saveAs(join(dir, d.suggestedFilename())).then(() => zips.push(d.suggestedFilename()))); });
  try {
    await page.getByRole('button', { name: /^Download (zip file|\d+ zip files)$/ }).click();
    const saved = await checkReceipt(page, label, selected);
    await Promise.all(saving);
    let entries = 0;
    for (const z of zips) {
      const test = execFileSync('unzip', ['-t', join(dir, z)]).toString();
      if (!/No errors detected/.test(test)) problems.push(`[${label}] ${z} failed unzip -t`);
      const names = execFileSync('unzip', ['-Z1', join(dir, z)]).toString().trim().split('\n');
      if (names.some((n) => !n.startsWith('Keepsake photos/'))) problems.push(`[${label}] ${z} has files outside Keepsake photos/`);
      entries += names.length;
    }
    console.log(`[${label}] zip: ${zips.join(', ')}: ${entries} files, unzip -t OK`);
    if (!zips.length) problems.push(`[${label}] no zip downloaded`);
    if (entries !== saved) problems.push(`[${label}] zips hold ${entries} files, receipt says ${saved}`);
    await page.screenshot({ path: `${out}/${label}-7-done-zip.png`, fullPage: true });
    await checkNoSideScroll(page, label, 'done (zip)');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const browser = await chromium.launch({ executablePath: exe });
const problems = [];
const requests = [];
try {
  // 'zoom200' is the desktop window at 200% browser zoom: half the CSS pixels, twice the density.
  const runs = [['desktop', { width: 1280, height: 900 }, 1], ['phone', { width: 390, height: 844 }, 1], ['zoom200', { width: 640, height: 450 }, 2]];
  for (const [label, viewport, deviceScaleFactor] of runs) {
    const page = await browser.newPage({ viewport, deviceScaleFactor });
    page.on('console', (m) => m.type() === 'error' && problems.push(`[${label}] console: ${m.text()}`));
    page.on('pageerror', (e) => problems.push(`[${label}] page error: ${e.message}`));
    page.on('request', (r) => { if (!r.url().startsWith('http://localhost:4173') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) requests.push(r.url()); });
    // Force the file-input fallback (the folder picker dialog can't be automated).
    await page.addInitScript(() => {
      for (const k of ['showDirectoryPicker', 'showOpenFilePicker', 'showSaveFilePicker']) {
        delete window[k];
        delete Window.prototype[k];
      }
    });
    await page.goto('http://localhost:4173/');
    await page.screenshot({ path: `${out}/${label}-1-start.png`, fullPage: true });
    await checkNoSideScroll(page, label, 'start');

    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose recovery folder' }).click()]);
    const t0 = Date.now();
    await chooser.setFiles('fixtures/recovery');
    await page.getByRole('heading', { level: 1, name: /Checking your files|Looking for exact copies/ }).waitFor({ timeout: 10_000 }).catch(() => {});
    await page.screenshot({ path: `${out}/${label}-1b-scanning.png` }).catch(() => {});
    await page.getByText('Files checked').waitFor({ timeout: 120_000 });
    // The scan used the file-input fallback; from here on the desktop run has a folder picker (see saveToFolder).
    if (label === 'desktop') await page.evaluate(() => { window.showDirectoryPicker = async () => { throw new DOMException('stub', 'AbortError'); }; });
    console.log(`[${label}] scan + render: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    await page.waitForTimeout(800); // let previews decode
    console.log(`[${label}] heading: ${await page.locator('h1').innerText()}`);
    await page.screenshot({ path: `${out}/${label}-2-results.png`, fullPage: true });
    await checkLedger(page, label, 'results');
    await checkNoSideScroll(page, label, 'results');

    await page.getByRole('button', { name: /preview copies/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Keep these files' }).click();
    console.log(`[${label}] after moving previews back: ${await page.locator('h1').innerText()}`);
    await checkLedger(page, label, 'moved back');
    const said = await page.locator('main [role=status]').innerText();
    if (!/^Now keeping/.test(said)) problems.push(`[${label}] ledger change not announced (got "${said}")`);
    await page.screenshot({ path: `${out}/${label}-3-moved-back.png`, fullPage: true });
    await page.getByRole('button', { name: 'Set these aside again' }).click();
    console.log(`[${label}] after undo: ${await page.locator('h1').innerText()}`);

    const keptOnResults = num((await page.locator('dl.ledger dd').allInnerTexts())[1]);
    await page.getByRole('button', { name: /^Review my/ }).click();
    await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${label}-4-review.png`, fullPage: true });
    await checkNoSideScroll(page, label, 'review');
    await checkScrollSpy(page, label);
    const selected = await checkTimeline(page, label, keptOnResults);
    if (label === 'desktop') await saveToFolder(page, label, selected);
    else await saveAsZip(page, label, selected);
    await page.close();
  }
} finally {
  await browser.close();
  process.kill(-server.pid); // stop the preview server and its children
}
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'No console errors.');
console.log(requests.length ? `OUTSIDE REQUESTS:\n${requests.join('\n')}` : 'No requests left this computer.');
if (problems.length || requests.length) process.exitCode = 1;
