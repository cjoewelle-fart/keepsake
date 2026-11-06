// QA (T89): zip saves across Stop / Save the rest / Back to review / Start over, within one page session.
// Usage: npm run build && LANG=C.UTF-8 node scripts/qa-zip-sequence.mjs --exe <chrome> [--port 4194] [--keep dir] <step> <step> …
// Steps:  scan=<dir>   review   save (open the Save step: a new visit; starts the zip download)
//         stop=<ms> (press Stop after ms, wait for "Saving stopped.")   rest ("Save the rest")
//         back ("Back to review" on the Stopped screen)   results (review → results)   startover
//         untick=<k> (untick the first k tiles in the review)   done (wait for the Done screen and read it)
// Checks: no two downloads in the session share a name; each Done screen's text, list and "again"
// buttons name exactly that visit's zips; the "earlier" note names exactly the unfinished visits'
// zips of the same scan since that scan's last finished save (zips of other scans: no note), and its claim ("Everything in it is also in …" or "some … aren't
// in this save") is true by content (SHA-256 of zip entries); the recovery folders are never written.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const port = String(Number(opt('--port', '4194')));
const exe = opt('--exe', process.env.CHROMIUM_PATH);
const keep = opt('--keep', undefined);
const out = keep ? resolve(keep) : mkdtempSync(join(tmpdir(), 'keepsake-zipseq-'));
mkdirSync(join(out, 'zips'), { recursive: true });
const steps = args;
const problems = [];
const ok = (c, m) => { if (!c) problems.push(m); };
const PY = String.raw`
import hashlib, json, os, sys, zipfile
def shas(p):
    r = set()
    with zipfile.ZipFile(p) as z:
        for i in z.infolist():
            if not i.is_dir():
                h = hashlib.sha256()
                with z.open(i) as f:
                    for b in iter(lambda: f.read(1 << 20), b""): h.update(b)
                r.add(h.hexdigest())
    return r
def tree(d):
    out = {}
    for root, _, fs in os.walk(d):
        for f in fs:
            p = os.path.join(root, f); st = os.stat(p); out[os.path.relpath(p, d)] = [st.st_size, st.st_mtime_ns]
    return out
cmd = sys.argv[1]
if cmd == "tree": print(json.dumps(tree(sys.argv[2])))
else:
    q = json.load(open(sys.argv[2]))
    res = []
    for item in q:
        now = set().union(*[shas(p) for p in item["now"]]) if item["now"] else set()
        old = set().union(*[shas(p) for p in item["old"]]) if item["old"] else set()
        res.append({"old_entries": len(old), "now_entries": len(now), "old_not_in_now": len(old - now)})
    print(json.dumps(res))
`;
const py = (...a) => execFileSync('python3', ['-I', '-c', PY, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });

const server = spawn(join(repo, 'node_modules/.bin/vite'), ['preview', '--port', port, '--strictPort'], { cwd: repo, stdio: 'pipe', detached: true });
let browser;
const log = [];
const downloads = []; // { k, name, visit, file }
const dones = [];
const trees = {};
let visit = 0;
let scanNo = 0; // earlier notes only ever cover zips of the same scan (Lead's call, T89)
try {
  await new Promise((r, j) => { server.stdout.on('data', (d) => String(d).includes(port) && r()); server.on('exit', () => j(new Error('preview exited'))); });
  browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  page.on('request', (q) => { if (!/^(http:\/\/localhost:\d+|blob:|data:)/.test(q.url())) problems.push(`outside request ${q.url()}`); });
  await page.addInitScript(() => { for (const k of ['showDirectoryPicker', 'showOpenFilePicker', 'showSaveFilePicker']) { delete window[k]; delete Window.prototype[k]; } });
  const pending = [];
  page.on('download', (d) => {
    const k = downloads.length + 1;
    const file = join(out, 'zips', `${String(k).padStart(2, '0')} ${d.suggestedFilename()}`);
    downloads.push({ k, name: d.suggestedFilename(), visit, scan: scanNo, file });
    pending.push(d.saveAs(file));
  });
  await page.goto(`http://localhost:${port}/`);
  const h1 = (re) => page.getByRole('heading', { level: 1, name: re });
  for (const step of steps) {
    const [what, val] = step.split('=');
    if (what === 'scan') {
      const dir = resolve(val);
      scanNo++;
      if (!trees[dir]) trees[dir] = py('tree', dir);
      const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose recovery folder' }).click()]);
      await ch.setFiles(dir);
      await page.getByText('Files checked').waitFor({ timeout: 30 * 60_000 });
    } else if (what === 'review') {
      await page.getByRole('button', { name: /^Review my/ }).click();
      await h1(/Choose what to save/).waitFor({ timeout: 120_000 });
    } else if (what === 'untick') {
      for (let i = 0; i < Number(val); i++) await page.locator('.tl-tile input[type=checkbox]:checked').first().uncheck();
    } else if (what === 'save') {
      visit++;
      await page.locator('.tl-save:visible').click();
      await h1(/Where should we save/).waitFor();
      await page.getByRole('button', { name: /^Download (zip file|\d+ zip files)$/ }).click();
    } else if (what === 'stop') {
      await page.waitForTimeout(Number(val));
      await page.getByRole('button', { name: 'Stop saving' }).click();
      await h1('Saving stopped.').waitFor({ timeout: 10 * 60_000 });
      log.push({ step, ended: await page.locator('[data-k=ended-body]').innerText(), again: await page.locator('.zip-again button').allInnerTexts() });
    } else if (what === 'rest') {
      await page.getByRole('button', { name: 'Save the rest' }).click();
    } else if (what === 'back') {
      await page.getByRole('button', { name: 'Back to review' }).click();
      await h1(/Choose what to save/).waitFor();
    } else if (what === 'results') {
      await page.getByRole('button', { name: 'Back to Sort' }).first().click();
      await page.getByText('Files checked').waitFor();
    } else if (what === 'startover') {
      await page.getByRole('button', { name: /Sort a different folder/ }).first().click();
      await page.getByRole('button', { name: 'Choose recovery folder' }).waitFor();
    } else if (what === 'done') {
      await h1(/saved\./).waitFor({ timeout: 60 * 60_000 });
      await Promise.all(pending);
      const find = await page.locator('[data-k=find]');
      const d = {
        visit,
        scan: scanNo,
        findText: await find.innerText(),
        findList: await find.locator('li').allInnerTexts(),
        earlier: (await page.locator('[data-k=earlier]').count()) ? await page.locator('[data-k=earlier]').innerText() : null,
        again: await page.locator('.zip-again button').allInnerTexts(),
        saved: await page.locator('dd[data-k=saved]').innerText(),
        downloadsSoFar: downloads.length,
      };
      dones.push(d);
      log.push({ step, ...d });
    } else throw new Error(`unknown step ${step}`);
  }
  await Promise.all(pending);
} catch (e) {
  problems.push(`run failed: ${e.stack ?? e}`);
} finally {
  await browser?.close();
  try { process.kill(-server.pid); } catch { /* gone */ }
}

// 1. No two downloads share a name.
const names = downloads.map((d) => d.name);
ok(new Set(names).size === names.length, `duplicate download names: ${names.join(' | ')}`);
// 2. Each Done screen names exactly its visit's zips; 3. the earlier note.
const queries = [];
const lastFinished = {};
for (const d of dones) {
  const mine = downloads.filter((z) => z.visit === d.visit && z.k <= d.downloadsSoFar);
  const mineNames = mine.map((z) => z.name);
  const shown = new Set([...d.findText.matchAll(/Keepsake photos[^,:]*?\.zip/g)].map((m) => m[0]).concat(d.findList));
  const range = / to Keepsake photos part/.test(d.findText);
  for (const n of mineNames) ok(shown.has(n) || range, `visit ${d.visit} Done doesn't name ${n}: ${d.findText} ${d.findList}`);
  for (const n of shown) ok(mineNames.includes(n), `visit ${d.visit} Done names ${n}, not a zip of this save`);
  ok(JSON.stringify(d.again) === JSON.stringify(mineNames.map((n) => `Download ${n} again`)), `visit ${d.visit} again buttons ${JSON.stringify(d.again)}`);
  const unfinished = downloads.filter((z) => z.scan === d.scan && z.visit > (lastFinished[d.scan] ?? 0) && z.visit < d.visit);
  const expectNames = unfinished.map((z) => z.name);
  const noteNames = d.earlier ? [...d.earlier.matchAll(/Keepsake photos[^,]*?\.zip/g)].map((m) => m[0]) : [];
  ok(JSON.stringify(noteNames) === JSON.stringify(expectNames), `visit ${d.visit} earlier note names ${JSON.stringify(noteNames)}, want ${JSON.stringify(expectNames)} (${d.earlier})`);
  if (d.earlier) queries.push({ d, now: mine.map((z) => z.file), old: unfinished.map((z) => z.file) });
  lastFinished[d.scan] = d.visit;
}
if (queries.length) {
  const qf = join(out, 'q.json');
  execFileSync('python3', ['-I', '-c', `import json,sys; open(sys.argv[1],'w').write(sys.argv[2])`, qf, JSON.stringify(queries.map(({ now, old }) => ({ now, old })))]);
  const res = JSON.parse(py('cmp', qf));
  res.forEach((r, i) => {
    const { d } = queries[i];
    d.content = r;
    const claimsAll = /Everything in (it|them) is also in/.test(d.earlier);
    const claimsSome = /that aren’t in this save/.test(d.earlier);
    ok(claimsAll !== claimsSome, `visit ${d.visit} note says neither or both: ${d.earlier}`);
    if (claimsAll) ok(r.old_not_in_now === 0, `visit ${d.visit} note says everything is also in this save, but ${r.old_not_in_now} of ${r.old_entries} earlier files aren't`);
    if (claimsSome) ok(r.old_not_in_now > 0, `visit ${d.visit} note says some files aren't in this save, but all ${r.old_entries} are`);
  });
}
// 4. Recovery folders unchanged.
for (const [dir, before] of Object.entries(trees)) ok(py('tree', dir) === before, `recovery folder changed: ${dir}`);
if (!keep) rmSync(out, { recursive: true, force: true });
console.log(JSON.stringify({ steps, downloads: downloads.map(({ k, name, visit: v }) => `${k}: v${v} ${name}`), log, problems }, null, 1));
console.log(problems.length ? 'ZIP SEQUENCE: PROBLEMS' : 'ZIP SEQUENCE: OK');
if (problems.length) process.exitCode = 1;
