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

const browser = await chromium.launch({ executablePath: exe });
const problems = [];
const requests = [];
try {
  for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
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

    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose recovery folder' }).click()]);
    const t0 = Date.now();
    await chooser.setFiles('fixtures/recovery');
    await page.getByText('Ready to review').waitFor({ timeout: 120_000 });
    console.log(`[${label}] scan + render: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    await page.waitForTimeout(800); // let previews decode
    console.log(`[${label}] heading: ${await page.locator('h1').innerText()}`);
    await page.screenshot({ path: `${out}/${label}-2-results.png`, fullPage: true });

    await page.getByRole('button', { name: /Small preview copies/ }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Keep these files' }).click();
    console.log(`[${label}] after moving previews back: ${await page.locator('h1').innerText()}`);
    await page.screenshot({ path: `${out}/${label}-3-moved-back.png`, fullPage: true });
    await page.getByRole('button', { name: 'Set these aside again' }).click();
    console.log(`[${label}] after undo: ${await page.locator('h1').innerText()}`);

    await page.getByRole('button', { name: /^Review my/ }).click();
    await page.screenshot({ path: `${out}/${label}-4-review.png`, fullPage: true });
    await page.close();
  }
} finally {
  await browser.close();
  process.kill(-server.pid); // stop the preview server and its children
}
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'No console errors.');
console.log(requests.length ? `OUTSIDE REQUESTS:\n${requests.join('\n')}` : 'No requests left this computer.');
