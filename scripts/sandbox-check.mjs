// Sandbox check: runs the shareable preview page the way the claude.ai artifact viewer does, inside
// an iframe with sandbox="allow-scripts allow-same-origin" (no allow-downloads), and checks that
//   1. scanning works through the folder-upload input (no error screen), and
//   2. the save step says calmly that saving isn't available, instead of failing.
// Two variants: the folder picker removed from the frame, and the browser's own (which Chromium
// refuses in sandboxed frames). A control run opens the same page directly (not in a frame),
// where saving must be offered. It also checks that a download really is blocked in that frame.
//
// Usage: npx vite build --mode artifact-test && node scripts/make-artifact.mjs --test <out>
//        node scripts/sandbox-check.mjs <chromiumPath> <out>/keepsake-test.html [--fixture fixtures/recovery] [--port 4195]
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const fixture = resolve(opt('--fixture', 'fixtures/recovery'));
const port = Number(opt('--port', '4195'));
const [exe, pagePath] = args;
if (!pagePath) throw new Error('usage: sandbox-check.mjs <chromiumPath> <keepsake-test.html>');
// The artifact host wraps the page in a document skeleton; do the same.
const app = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n${readFileSync(pagePath, 'utf8')}</body></html>`;
const parent = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Viewer</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe title="Keepsake preview" sandbox="allow-scripts allow-same-origin" src="/app.html"></iframe></body></html>`;

const server = createServer((req, res) => {
  const body = req.url === '/' ? parent : req.url === '/app.html' ? app : null;
  if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
  if (!body) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body);
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));
const origin = `http://127.0.0.1:${port}`;

const failures = [];
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures.push(msg); };

/** Choose the folder (file input expected), scan, open Review, then Save. Returns what Save shows. */
async function run(browser, name, { framed, removePicker }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const outside = [];
  const errors = [];
  context.on('request', (r) => { const u = r.url(); if (!/^(blob|data):/.test(u) && !u.startsWith(origin)) outside.push(u); });
  if (removePicker) {
    // Runs in every frame, the iframe included.
    await context.addInitScript(() => {
      for (const k of ['showDirectoryPicker', 'showOpenFilePicker', 'showSaveFilePicker']) { delete window[k]; delete Window.prototype[k]; }
    });
  }
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(framed ? `${origin}/` : `${origin}/app.html`);
  const f = framed ? page.frameLocator('iframe') : page;
  const appFrame = framed ? page.frames().find((fr) => fr.url().endsWith('/app.html')) : page.mainFrame();
  await f.getByRole('heading', { level: 1 }).first().waitFor();
  const env = await appFrame.evaluate(() => ({ title: document.title, picker: 'showDirectoryPicker' in window, framed: self !== top }));
  console.log(`--- ${name}: framed=${env.framed}, showDirectoryPicker ${env.picker ? 'present' : 'absent'}, title "${env.title}"`);
  check(env.title.includes('Keepsake (test)'), `${name}: title says "Keepsake (test)"`);
  check(await f.getByRole('button', { name: 'Try with example files' }).count() === 0, `${name}: no "Try with example files" button`);
  const note = await f.locator('main .sub-sm').allInnerTexts();
  if (framed) check(note.some((t) => /Upload files to this site/.test(t)), `${name}: start screen explains the browser's "upload" wording`);

  // 1. Scan: the click must open the file input (a file chooser), not fail.
  const chooser = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
  await f.getByRole('button', { name: 'Choose recovery folder' }).click();
  const fc = await chooser;
  check(!!fc, `${name}: "Choose recovery folder" opens the folder-upload dialog (file input)`);
  if (fc) {
    check(await fc.element().evaluate((el) => el.webkitdirectory), `${name}: the dialog takes a whole folder (webkitdirectory)`);
    await fc.setFiles(fixture);
  }
  const outcome = await Promise.race([
    f.getByText('Files checked').waitFor({ timeout: 120_000 }).then(() => 'results'),
    f.getByRole('heading', { level: 1, name: /went wrong|couldn/i }).waitFor({ timeout: 120_000 }).then(() => 'error'),
  ]).catch(() => 'timeout');
  check(outcome === 'results', `${name}: scan finished and shows the results (got: ${outcome})`);
  let save = '';
  if (outcome === 'results') {
    const checked = await appFrame.evaluate(() => document.querySelector('main')?.innerText.match(/Files checked\s*([\d,]+)/)?.[1] ?? '');
    console.log(`      files checked: ${checked}`);
    await f.getByRole('button', { name: /^Review my/ }).click();
    await f.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor();
    await f.locator('.tl-save:visible').click();
    await f.getByRole('heading', { level: 1, name: /Where should we save/ }).waitFor();
    save = (await f.locator('.save-col > .card').first().innerText()).replace(/\s+/g, ' ').trim();
    console.log(`      save step shows: "${save}"`);
    const buttons = await f.locator('.save-col button').allInnerTexts();
    if (framed) {
      check(/Saving isn’t available in this preview\. In the real app, your photos are saved to a folder you choose\./.test(save), `${name}: save step says saving isn't available in this preview`);
      check(buttons.length === 0, `${name}: no save buttons that would fail (${buttons.join(', ') || 'none'})`);
      check(await f.getByRole('alert').count() === 0, `${name}: no error message`);
      await page.screenshot({ path: `${process.env.SHOTS || '/tmp'}/sandbox-${name}-save.png`, fullPage: true }).catch(() => {});
      // The premise: a download from this frame really is blocked.
      const dl = page.waitForEvent('download', { timeout: 3000 }).then(() => true, () => false);
      await appFrame.evaluate(() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['x'])); a.download = 'probe.txt'; document.body.append(a); a.click(); a.remove(); });
      check(!(await dl), `${name}: a download from the sandboxed frame is blocked (so zips couldn't work here)`);
    } else {
      check(buttons.some((b) => /Choose a folder|Download/.test(b)), `${name}: outside a frame, saving is offered (${buttons.join(', ')})`);
    }
  }
  check(outside.length === 0, `${name}: no requests outside the page (${outside.length})`);
  const real = errors.filter((e) => !/Download is disallowed|document\.domain/.test(e));
  check(real.length === 0, `${name}: no page errors${real.length ? `: ${real.slice(0, 3).join(' | ')}` : ''}`);
  await context.close();
  return save;
}

const browser = await chromium.launch({ executablePath: exe });
try {
  await run(browser, 'sandbox-no-picker', { framed: true, removePicker: true });
  await run(browser, 'sandbox-own-picker', { framed: true, removePicker: false });
  await run(browser, 'top-level-control', { framed: false, removePicker: true });
} finally {
  await browser.close();
  server.close();
}
console.log(failures.length ? `\n${failures.length} failed` : '\nAll sandbox checks passed.');
process.exit(failures.length ? 1 : 0);
