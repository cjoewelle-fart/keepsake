// End-to-end check of the built app in a real browser.
// Usage: npm run build && node scripts/e2e.mjs [chromiumPath]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
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
  const several = days.filter({ has: page.locator('.tl-day-count', { hasText: /^all/ }) });
  const day = (await several.count()) ? several.first() : days.first();
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
  const h = await page.locator('h1').innerText();
  expect(num(h) === s.selected, `save step got ${h}, expected ${s.selected}`);
  await page.getByRole('button', { name: 'Back to choosing' }).click();
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
    await checkTimeline(page, label, keptOnResults);
    await page.close();
  }
} finally {
  await browser.close();
  process.kill(-server.pid); // stop the preview server and its children
}
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'No console errors.');
console.log(requests.length ? `OUTSIDE REQUESTS:\n${requests.join('\n')}` : 'No requests left this computer.');
