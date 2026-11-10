// QA probe (T25/T55/T56): the Save code against Chromium's real File System Access API in OPFS.
// Usage: node scripts/qa-save-opfs/run.mjs <chromiumPath> [--port 4184]
// Part 1 bundles savePlan/saveRun and runs API-semantics, recovery-folder and race probes on a
// fake https origin (no server). Part 2 runs the built app (npm run build first) under vite
// preview, picks an OPFS recovery folder through the stubbed folder picker, and tries save
// folders in and around it. Prints results; exits 1 if a refusal or safety expectation fails.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'vite';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = join(here, '../..');
const args = process.argv.slice(2);
const pi = args.indexOf('--port');
const port = pi >= 0 ? args.splice(pi, 2)[1] : '4184';
const exe = args[0] || process.env.CHROMIUM_PATH;
const problems = [];
const expect = (ok, what) => { if (!ok) problems.push(what); };

const outDir = mkdtempSync(join(tmpdir(), 'keepsake-qa-opfs-'));
await build({ configFile: false, logLevel: 'warn', publicDir: false, build: { outDir, emptyOutDir: true, minify: false, lib: { entry: join(here, 'entry.ts'), name: 'K', formats: ['iife'], fileName: () => 'k.js' } } });
const bundle = readFileSync(join(outDir, 'k.js'), 'utf8') + '\n' + readFileSync(join(here, 'page.js'), 'utf8');
rmSync(outDir, { recursive: true, force: true });

const browser = await chromium.launch({ executablePath: exe });
let server;
try {
  const page = await browser.newPage();
  await page.route('https://probe.test/**', (r) => {
    const js = new URL(r.request().url()).pathname === '/k.js';
    r.fulfill({ status: 200, contentType: js ? 'text/javascript' : 'text/html', body: js ? bundle : '<!doctype html><script src="/k.js"></script>' });
  });
  await page.goto('https://probe.test/');
  const p = await page.evaluate(() => window.runProbes());
  console.log(JSON.stringify(p, null, 1));
  const B = p.B;
  for (const k of ['same', 'depth1 recup_dir.1', 'depth1 recup_dir.300', 'depth5 a/b/c/d/e', 'empty subfolder']) expect(B[k].withHandle === true, `not refused with handle: ${k}`);
  for (const k of ['parent home (contains rec)', 'sibling rec2', 'Pictures', 'usb']) expect(B[k].withHandle === false, `wrongly refused: ${k}`);
  expect(B['rec inside Pictures/Upsort photos, chosen=Pictures'].withHandle === true, 'not refused: recovery inside <chosen>/Upsort photos');
  expect(B['fallback: rec inside Pictures/Upsort photos, chosen=Pictures'].fallback === true, 'fallback not refused: recovery inside <chosen>/Upsort photos');
  const saves = {};
  for (const s of ['normal', 'race-at-move', 'stop-mid-file', 'read-error-mid-file', 'move-unsupported', 'move-fails-after-write', 'move-quota-after-write', 'no-move-race-create', 'no-move-race-create-then-stop']) {
    saves[s] = await page.evaluate((x) => window.runSave(x), s);
    console.log(s, JSON.stringify(saves[s]));
    const after = saves[s].after;
    expect(after.includes('Upsort photos/2024/06 June/2024-06-28 14.32.jpg:3') && after.includes('Upsort photos/2024/06 June/empty-theirs.jpg:0'), `${s}: a file that was there before changed or went`);
    expect(!after.some((x) => x.includes('.keepsake-partial-')), `${s}: a temporary file was left behind`);
    if (s.startsWith('no-move') || s === 'move-unsupported') expect(saves[s].end === 'unsupported' && saves[s].saved.length === 0, `${s}: without move() the save should end 'unsupported' with nothing written`);
  }

  // Part 2: the built app.
  server = spawn(join(repo, 'node_modules/.bin/vite'), ['preview', '--port', port, '--strictPort'], { cwd: repo, stdio: 'pipe' });
  await new Promise((r, j) => { server.stdout.on('data', (d) => String(d).includes(port) && r()); server.on('exit', () => j(new Error(`preview exited (port ${port} in use?)`))); });
  const app = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await app.goto(`http://localhost:${port}/`);
  await app.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    for await (const k of root.keys()) await root.removeEntry(k, { recursive: true });
    const mk = async (d, path) => { for (const x of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(x, { create: true }); return d; };
    const rec = await mk(root, 'home/rec');
    const jpeg = async (seed) => { const c = new OffscreenCanvas(1600, 1200); const g = c.getContext('2d'); for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${(i * 37 + seed * 11) % 360} 70% 50%)`; g.fillRect((i * 97) % 1600, (i * 53) % 1200, 120, 90); } return c.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); };
    for (let k = 1; k <= 3; k++) { const d = await mk(rec, `recup_dir.${k}`); const w = await (await d.getFileHandle(`f${k}.jpg`, { create: true })).createWritable(); await w.write(await jpeg(k)); await w.close(); }
    await mk(rec, 'empty'); await mk(rec, 'a/b/c/d/e'); await mk(root, 'usb');
    window.__root = root; window.__rec = rec;
    window.showDirectoryPicker = async () => rec;
  });
  await app.getByRole('button', { name: 'Choose recovery folder' }).click();
  await app.getByText('Files checked').waitFor({ timeout: 60_000 });
  await app.getByRole('button', { name: /^Review my/ }).click();
  await app.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor();
  await app.locator('.tl-save:visible').click();
  await app.getByRole('heading', { level: 1, name: /Where should we save/ }).waitFor();
  const tryFolder = async (path, throws) => {
    await app.evaluate(async ({ path, throws }) => {
      let d = window.__root; for (const x of path.split('/')) d = await d.getDirectoryHandle(x);
      if (throws) d = new Proxy(d, { get(t, k) { if (k === 'resolve' || k === 'isSameEntry') return async () => { throw new DOMException('x', 'NotFoundError'); }; const v = Reflect.get(t, k); return typeof v === 'function' ? v.bind(t) : v; } });
      window.showDirectoryPicker = async () => d;
    }, { path, throws });
    await app.getByRole('button', { name: /Choose (a|a different) folder/ }).first().click();
    await app.waitForTimeout(600);
    return { h1: await app.locator('h1').innerText(), alert: (await app.locator('[role=alert] h2').allInnerTexts()).join(' | ') };
  };
  for (const [path, throws] of [['home/rec'], ['home/rec/recup_dir.2'], ['home/rec/a/b/c/d/e'], ['home/rec/empty'], ['usb', true]]) {
    const r = await tryFolder(path, throws);
    console.log(`app: save to ${path}${throws ? ' (check throws)' : ''}:`, JSON.stringify(r));
    // A folder whose check threw is refused with its own message, not "That's your recovery folder."
    const want = throws ? /couldn’t check that folder/ : /recovery folder/;
    expect(/Where should we save/.test(r.h1) && want.test(r.alert), `app did not refuse ${path} with the right message`);
  }
  const r = await tryFolder('home');
  console.log('app: save to home (contains rec):', JSON.stringify(r));
  expect(/saved\./.test(r.h1), 'app refused or failed a folder that only contains the recovery folder');
  const extra = await app.evaluate(async () => { const out = []; const walk = async (d, p) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, `${p}${n}/`); else out.push(p + n); } }; await walk(window.__rec, ''); return out.filter((x) => !/^recup_dir\.\d\/f\d\.jpg$/.test(x)); });
  expect(extra.length === 0, `files appeared in the recovery folder: ${extra.join(', ')}`);
} finally {
  await browser.close();
  if (server) process.kill(server.pid);
}
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'OPFS probes: all refusal and safety expectations met');
process.exit(problems.length ? 1 : 0);
