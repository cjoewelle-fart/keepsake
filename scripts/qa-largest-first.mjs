// QA (T60 + T89 acceptance): "Largest first" on a real scan, end to end in a real browser.
// Usage: npm run build && LANG=C.UTF-8 node scripts/qa-largest-first.mjs <recoveryDir> <labels.json> --exe <chrome> [--port 4191] [--untick 0,1,2,10]
// Scans through the file input (folder pickers deleted, so the save is the zip branch), then:
// - unticks rows in Largest first and checks the ledger moves the same as it does in By date,
//   and that the rows are the largest (sizes non-increasing);
// - the bar's "… to save" equals the ledger's Size to save and the Save screen's Size to save;
// - saves as zips and checks (Python zipfile + SHA-256) that exactly the unticked files are missing
//   and every other "keep" file in labels.json is in the zips once.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const port = String(Number(opt('--port', '4191')));
const exe = opt('--exe', process.env.CHROMIUM_PATH);
const untick = opt('--untick', '0,1,2,10').split(',').map(Number);
const [recArg, labelsArg] = args;
const rec = resolve(recArg);
const labels = resolve(labelsArg);
const out = mkdtempSync(join(tmpdir(), 'keepsake-largest-'));
mkdirSync(join(out, 'zips'));
const num = (t) => Number(t.replace(/[^0-9]/g, ''));
const problems = [];
const ok = (cond, msg) => { if (!cond) problems.push(msg); };
const toBytes = (s) => { const m = /([\d.,]+)\s*(bytes?|KB|MB|GB|TB)/.exec(s); const u = { byte: 1, bytes: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 }[m[2]]; return Number(m[1].replace(/,/g, '')) * u; };

const server = spawn(join(repo, 'node_modules/.bin/vite'), ['preview', '--port', port, '--strictPort'], { cwd: repo, stdio: 'pipe', detached: true });
let browser;
const r = {};
try {
  await new Promise((res, rej) => { server.stdout.on('data', (d) => String(d).includes(port) && res()); server.on('exit', () => rej(new Error('preview exited'))); });
  browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  page.on('request', (q) => { if (!/^(http:\/\/localhost:\d+|blob:|data:)/.test(q.url())) problems.push(`outside request ${q.url()}`); });
  await page.addInitScript(() => { for (const k of ['showDirectoryPicker', 'showOpenFilePicker', 'showSaveFilePicker']) { delete window[k]; delete Window.prototype[k]; } });
  await page.goto(`http://localhost:${port}/`);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose recovery folder' }).click()]);
  await chooser.setFiles(rec);
  await page.getByText('Files checked').waitFor({ timeout: 30 * 60_000 });
  await page.getByRole('button', { name: /^Review my/ }).click();
  await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor({ timeout: 120_000 });

  const ledger = async () => ({
    selected: num(await page.locator('dl.ledger dd[data-k=selected]').innerText()),
    unselected: num(await page.locator('dl.ledger dd[data-k=unselected]').innerText()),
    size: await page.locator('dl.ledger dd[data-k=size]').innerText(),
  });
  const monthSum = async () => (await page.locator('.tl-month .month-count').allInnerTexts()).reduce((a, t) => a + Number(t.split(' of ')[0].replace(/[^0-9]/g, '')), 0);
  r.start = await ledger();

  // Date view: untick the first tile, then tick it again. Ledger delta = 1.
  const firstTile = page.locator('.tl-tile input[type=checkbox]').first();
  await firstTile.uncheck();
  r.dateUntick = await ledger();
  ok(r.dateUntick.selected === r.start.selected - 1 && r.dateUntick.unselected === r.start.unselected + 1, `date view untick: ${JSON.stringify(r.dateUntick)}`);
  await firstTile.check();
  ok(JSON.stringify(await ledger()) === JSON.stringify(r.start), 'date view re-tick did not restore the ledger');

  await page.getByRole('button', { name: 'Largest first' }).click();
  await page.locator('.tl-row').first().waitFor();
  ok(JSON.stringify(await ledger()) === JSON.stringify(r.start), 'switching order changed the ledger');
  const rowLabels = await page.locator('.tl-row input[type=checkbox]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const rowSizes = rowLabels.map((l) => toBytes(l.split('. ')[0]));
  r.rowsDrawn = rowSizes.length;
  r.topRows = rowLabels.slice(0, 5);
  for (let i = 1; i < rowSizes.length; i++) if (rowSizes[i] > rowSizes[i - 1] * 1.0001) { problems.push(`row ${i} (${rowLabels[i]}) larger than row ${i - 1} (${rowLabels[i - 1]})`); break; }

  r.untickedLabels = [];
  for (const i of untick) {
    const box = page.locator('.tl-row input[type=checkbox]').nth(i);
    r.untickedLabels.push(await box.getAttribute('aria-label'));
    await box.uncheck();
  }
  r.sizeView = await ledger();
  ok(r.sizeView.selected === r.start.selected - untick.length, `size view selected ${r.sizeView.selected}, want ${r.start.selected - untick.length}`);
  ok(r.sizeView.unselected === r.start.unselected + untick.length, `size view unselected ${r.sizeView.unselected}`);
  ok(r.sizeView.selected + r.sizeView.unselected === r.start.selected + r.start.unselected, 'selected + not selected changed');
  r.bar = (await page.locator('.tl-tally-count:visible, .tl-footer-count:visible').first().innerText()).trim();
  const barSize = / · (.+) to save/.exec(r.bar)?.[1];
  r.barSize = barSize;
  ok(barSize === r.sizeView.size, `bar says "${barSize}" to save, ledger Size to save "${r.sizeView.size}"`);
  const expectBytes = toBytes(r.start.size) - r.untickedLabels.reduce((a, l) => a + toBytes(l.split('. ')[0]), 0);
  r.expectApprox = expectBytes;

  await page.getByRole('button', { name: 'By date' }).click();
  await page.locator('.tl-month').first().waitFor();
  r.dateAfter = await ledger();
  ok(JSON.stringify(r.dateAfter) === JSON.stringify(r.sizeView), `date view ledger ${JSON.stringify(r.dateAfter)} != size view ${JSON.stringify(r.sizeView)}`);
  r.monthSum = await monthSum();
  ok(r.monthSum === r.dateAfter.selected, `month counts add up to ${r.monthSum}, ledger ${r.dateAfter.selected}`);
  await page.getByRole('button', { name: 'Largest first' }).click();
  await page.locator('.tl-row').first().waitFor();
  for (const i of untick) ok(!(await page.locator('.tl-row input[type=checkbox]').nth(i).isChecked()), `row ${i} ticked again after switching orders`);
  ok(JSON.stringify((await page.locator('.tl-row input[type=checkbox]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).slice(0, 12)) === JSON.stringify(rowLabels.slice(0, 12)), 'row order changed after ticks / switching');

  await page.locator('.tl-save:visible').click();
  await page.getByRole('heading', { level: 1, name: /Where should we save/ }).waitFor();
  r.saveSelected = num(await page.locator('dd[data-k=selected]').innerText());
  r.saveSize = await page.locator('dd[data-k=size]').innerText();
  ok(r.saveSelected === r.sizeView.selected, `Save screen ${r.saveSelected} selected, review ${r.sizeView.selected}`);
  ok(r.saveSize === barSize, `Save screen Size to save "${r.saveSize}", bar "${barSize}"`);

  const downloads = [];
  page.on('download', (d) => { const k = downloads.length + 1; downloads.push(d.saveAs(join(out, 'zips', `${String(k).padStart(2, '0')} ${d.suggestedFilename()}`))); });
  await page.getByRole('button', { name: /^Download (zip file|\d+ zip files)$/ }).click();
  await page.getByRole('heading', { level: 1, name: /saved\./ }).waitFor({ timeout: 60 * 60_000 });
  await Promise.all(downloads);
  r.saved = num(await page.locator('dd[data-k=saved]').innerText());
  ok(r.saved === r.sizeView.selected, `receipt ${r.saved} saved, ${r.sizeView.selected} selected`);
} catch (e) {
  problems.push(`run failed: ${e.stack ?? e}`);
} finally {
  await browser?.close();
  try { process.kill(-server.pid); } catch { /* gone */ }
}

if (r.saved !== undefined) {
  const py = String.raw`
import hashlib, json, os, sys, zipfile
rec, labels, zdir = sys.argv[1:4]
lab = json.load(open(labels)); lab = {k: (v["label"] if isinstance(v, dict) else v) for k, v in lab.items()}
def sha(f):
    h = hashlib.sha256()
    for b in iter(lambda: f.read(1 << 20), b""): h.update(b)
    return h.hexdigest()
inzip = {}
for z in sorted(os.listdir(zdir)):
    with zipfile.ZipFile(os.path.join(zdir, z)) as zf:
        for i in zf.infolist():
            if not i.is_dir():
                with zf.open(i) as f: inzip.setdefault(sha(f), []).append(i.filename)
keep = [p for p, v in lab.items() if v == "keep"]
missing, twice = [], []
for p in keep:
    with open(os.path.join(rec, p), "rb") as f: h = sha(f)
    n = len(inzip.get(h, []))
    if n == 0: missing.append((p, os.path.getsize(os.path.join(rec, p))))
    if n > 1: twice.append(p)
sizes = sorted((os.path.getsize(os.path.join(rec, p)) for p in keep), reverse=True)
print(json.dumps({"entries": sum(len(v) for v in inzip.values()), "keep": len(keep), "missing": missing, "twice": twice, "top_sizes": sizes[:100]}))
`;
  r.zip = JSON.parse(execFileSync('python3', ['-I', '-c', py, rec, labels, join(out, 'zips')], { encoding: 'utf8' }));
  ok(r.zip.entries === r.saved, `zips hold ${r.zip.entries}, receipt ${r.saved}`);
  ok(r.zip.missing.length === untick.length, `${r.zip.missing.length} keep files missing from the zips, ${untick.length} unticked`);
  ok(r.zip.twice.length === 0, `${r.zip.twice.length} files in the zips twice`);
  const want = untick.map((i) => r.zip.top_sizes[i]).sort((a, b) => b - a);
  const got = r.zip.missing.map(([, s]) => s).sort((a, b) => b - a);
  ok(JSON.stringify(want) === JSON.stringify(got), `missing sizes ${JSON.stringify(got)}, unticked rows (by rank) ${JSON.stringify(want)}`);
}
rmSync(out, { recursive: true, force: true });
console.log(JSON.stringify({ recovery: rec, ...r, problems }, null, 1));
console.log(problems.length ? 'LARGEST FIRST CHECK: PROBLEMS' : 'LARGEST FIRST CHECK: OK');
if (problems.length) process.exitCode = 1;
