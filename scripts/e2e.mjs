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

    await page.getByRole('button', { name: /^Review my/ }).click();
    await page.screenshot({ path: `${out}/${label}-4-review.png`, fullPage: true });
    await checkNoSideScroll(page, label, 'review');
    await page.close();
  }
} finally {
  await browser.close();
  process.kill(-server.pid); // stop the preview server and its children
}
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'No console errors.');
console.log(requests.length ? `OUTSIDE REQUESTS:\n${requests.join('\n')}` : 'No requests left this computer.');
