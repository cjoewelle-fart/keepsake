// Pilot-folder browser run (gate step P, T72/T73): the six pilot tasks (G1, T2, T3, T4, G2, T6) on the
// pilot folder, in the TEST build (dist-test/, the one the owner's sessions use), in Chromium.
// Every on-screen number is checked against the answer key in team/research/pilot-folder.md.
// The pilot folder is copied into the browser's private file system (OPFS) and picked through a
// stubbed folder picker; the folder on disk is only read.
// Usage: npm run build:test && node scripts/pilot-e2e.mjs [chromiumPath] [--port 4190]
//        [--folder "fixtures/pilot/Recovered from old phone"] [--shots e2e-shots/pilot]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
// Its own port, so it can run beside the other browser scripts.
const port = String(Number(opt('--port', '4190')));
const pilotDir = resolve(opt('--folder', 'fixtures/pilot/Recovered from old phone'));
const out = opt('--shots', 'e2e-shots/pilot');
const base = `http://localhost:${port}`;
const exe = args[0] || process.env.CHROMIUM_PATH;

if (!existsSync(pilotDir)) {
  console.error(`Pilot folder not found: ${pilotDir}
Build it once (about 5 min, needs PhotoRec 7.1; see team/research/gate-check.md step 0):
  python3 scripts/make_pilot_folder.py fixtures/pilot --zip fixtures/Recovered-from-old-phone.zip`);
  process.exit(2);
}
if (!existsSync('dist-test/index.html')) {
  console.error('dist-test/index.html missing: run `npm run build:test` first.');
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const fails = [];
const outside = [];
const errors = [];
let checks = 0;
const check = (ok, msg) => { checks++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails.push(msg); };
const num = (t) => Number(String(t).replace(/[^0-9]/g, ''));
const flat = (s) => s.replace(/\s+/g, ' ');

/** Walk an OPFS folder in the page: [{ p: path, s: size }]. `which` is 'rec' or 'pictures'. */
const listIn = (page, which) => page.evaluate(async (which) => {
  const dir = which === 'rec' ? window.__rec : await window.__desk.getDirectoryHandle('Pictures');
  const files = [];
  const walk = async (d, p) => {
    for await (const [n, h] of d.entries()) {
      if (h.kind === 'directory') await walk(h, `${p}${n}/`);
      else files.push({ p: p + n, s: (await h.getFile()).size });
    }
  };
  await walk(dir, '');
  return files;
}, which);
const listRec = async (page) => (await listIn(page, 'rec')).map((f) => `${f.p}:${f.s}`).sort();

/** The review timeline: { 'YYYY-MM' | 'none': '… of N' }. */
const timeline = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.tl-month')].map((m) => [m.dataset.month, m.querySelector('.month-count')?.textContent ?? ''])));
const monthTotal = (v) => num((v ?? '').replace(/^.* of /, ''));
const sumYear = (tl, y) => Object.entries(tl).filter(([k]) => k.startsWith(y)).reduce((n, [, v]) => n + monthTotal(v), 0);

async function run(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  ctx.on('request', (r) => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('blob:') && !u.startsWith('data:')) outside.push(u); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(`${base}/`);
  const title = await page.title();
  check(/Keepsake \(test\)$/.test(title), `test build: title "${title}"`);
  check((await page.getByRole('button', { name: /example files/i }).count()) === 0, 'test build: no "Try with example files" button');

  // Copy the pilot folder into OPFS: Desktop/<pilot folder>, plus an empty Desktop/Pictures to save into.
  await page.evaluate(() => {
    const i = document.createElement('input');
    i.type = 'file';
    i.webkitdirectory = true;
    i.id = 'pilot-up';
    i.style.display = 'none';
    document.body.appendChild(i);
  });
  await page.setInputFiles('#pilot-up', pilotDir);
  const copied = await page.evaluate(async (name) => {
    const root = await navigator.storage.getDirectory();
    for await (const k of root.keys()) await root.removeEntry(k, { recursive: true });
    const desk = await root.getDirectoryHandle('Desktop', { create: true });
    let n = 0;
    for (const f of document.getElementById('pilot-up').files) {
      const parts = f.webkitRelativePath.split('/');
      let d = desk;
      for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
      const w = await (await d.getFileHandle(parts.at(-1), { create: true })).createWritable();
      await w.write(f);
      await w.close();
      n++;
    }
    document.getElementById('pilot-up').remove();
    await desk.getDirectoryHandle('Pictures', { create: true });
    window.__rec = await desk.getDirectoryHandle(name);
    window.__desk = desk;
    window.showDirectoryPicker = async () => window.__rec;
    return n;
  }, basename(pilotDir));
  console.log(`copied ${copied} files into the browser's private folder`);
  const recBefore = await listRec(page);
  check(recBefore.length === 523, `recovery folder holds ${recBefore.length} files before (key: 523)`);

  // G1: scan.
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Choose recovery folder' }).click();
  let sawTotal = '';
  for (let i = 0; i < 100 && !sawTotal; i++) {
    const t = await page.locator('main').innerText().catch(() => '');
    const m = t.match(/of\s+([\d,]+)\s+files/);
    if (m) sawTotal = m[1];
    if (/Files checked/.test(t)) break;
    await page.waitForTimeout(50);
  }
  await page.getByText('Files checked').waitFor({ timeout: 120_000 });
  console.log(`scan took ${((Date.now() - t0) / 1000).toFixed(1)}s; progress showed "of ${sawTotal || '(missed)'} files"`);
  await page.waitForTimeout(800); // let previews decode
  await page.screenshot({ path: `${out}/1-results.png`, fullPage: true });
  const h1 = flat(await page.locator('h1').innerText());
  check(h1 === 'We found 214 photos and videos worth keeping.', `G1 title: "${h1}"`);
  const led = (await page.locator('dl.ledger dd').allInnerTexts()).map(flat);
  check(num(led[0]) === 523 && num(led[1]) === 214 && num(led[2]) === 309, `G1 ledger: checked ${led[0]}, kept ${led[1]}, set aside ${led[2]} (key 523/214/309)`);
  // What's on screen (the screen-reader copies say the same words).
  const safeRow = (await page.locator('dl.ledger .ledger-safe [aria-hidden=true]').allInnerTexts()).join(' · ');
  check(safeRow === 'Your files · Not deleted, not sent anywhere' && !/0 · 0|[Uu]pload/.test(flat(await page.locator('main').innerText())), `T6/T76 ledger in words, no "0 · 0" or "upload": "${safeRow}"`);
  const chips = (await page.locator('main .chips[role=group] .chip').allInnerTexts()).map(flat);
  check(chips.join(',') === '2024,2023,2022,2021,2020,2019,No date · 20', `G1 year chips: ${chips.join(', ')}`);

  // T2: what was set aside.
  const main = flat(await page.locator('main').innerText());
  check(/We set aside 309 files/.test(main), `T2 set-aside line: "${(main.match(/We set aside[^.]*\./) || ['(missing)'])[0]}"`);
  const groups = (await page.locator('.group-head').allInnerTexts()).map((s) => flat(s).trim());
  console.log(`groups: ${groups.join(' | ')}`);
  for (const [g, c] of [['Small preview copies', 204], ['Exact copies', 22], ['Damaged or incomplete files', 2], ['App and system files', 81]]) {
    const h = groups.find((x) => x.includes(g));
    check(h && new RegExp(`\\b${c}\\b`).test(h), `T2 group "${g}" shows ${c}: "${h ?? 'missing'}"`);
  }

  // T77: Kept is its own card, named by its heading.
  const keptH = flat(await page.locator('#kept-h').innerText());
  check(keptH === 'Kept, sorted by date 214' && (await page.locator('section.sheet').getAttribute('aria-labelledby')) === 'kept-h', `T77 Kept card heading: "${keptH}" (key 214)`);
  check(!(await page.locator('#no-date-h').count()), 'T77 a year is showing: no No date block under it');

  // T4 on results: the No date chip is a view of its own (T77), and its heading gets focus.
  const ndChip = page.locator('main .chips[role=group] .chip', { hasText: /^No date/ });
  await ndChip.click();
  await page.waitForTimeout(300);
  const nd = flat(await page.locator('main').innerText());
  check(/No date:? ?20 photos, kept together so none get lost/.test(nd), `T4 results: "${(nd.match(/No date[^.]{0,60}kept together so none get lost/) || ['(missing)'])[0]}"`);
  const ndState = await page.evaluate(() => ({
    focus: document.activeElement?.id,
    months: document.querySelectorAll('#kept-view .month').length,
    pressed: [...document.querySelectorAll('main .chips[role=group] .chip[aria-pressed=true]')].map((c) => c.textContent),
  }));
  check(ndState.focus === 'no-date-h' && ndState.months === 1 && ndState.pressed.join() === 'No date · 20', `T77 No date view: focus ${ndState.focus}, ${ndState.months} block shown, pressed "${ndState.pressed.join()}"`);
  await page.locator('main .chips[role=group] .chip', { hasText: '2022' }).click();
  check(!(await page.locator('#no-date-h').count()) && (await page.locator('#kept-view .month').count()) > 0, 'T77 choosing 2022 hides No date and shows its months');

  // T3: keep the Small preview copies; the change is announced (filled in after render, so wait for it).
  await page.getByRole('button', { name: /preview copies/i }).click();
  await page.waitForTimeout(300);
  const keepNote = flat(await page.locator('#aside-small').innerText());
  check(/Adds them to the photos you review and save\. Nothing moves on your computer\./.test(keepNote), 'T78 the line under "Keep these files" says what it does');
  await page.getByRole('button', { name: 'Keep these files' }).click();
  const after = await page.evaluate(() => ({
    focus: document.activeElement?.textContent,
    note: document.querySelector('#aside-small .note-box')?.textContent,
    tinted: [...document.querySelectorAll('dl.ledger > div.changed dt')].map((d) => d.textContent),
    hint: /Adds them to the photos/.test(document.querySelector('#aside-small').textContent),
  }));
  check(after.focus === 'Set these aside again' && after.note === 'Added 204 to Kept. Kept is now 418.' && !after.hint, `T77 after Keep: focus on "${after.focus}", note "${after.note}"`);
  check(after.tinted.join('|') === 'Kept, sorted by date|Set aside, kept safe below', `T77 changed ledger rows tinted: ${after.tinted.join(', ')}`);
  const h3 = flat(await page.locator('h1').innerText());
  const led3 = (await page.locator('dl.ledger dd').allInnerTexts()).map(num);
  check(h3 === 'We found 418 photos and videos worth keeping.' && led3[1] === 418 && led3[2] === 105, `T3 after Keep these files: "${h3}", ledger kept ${led3[1]}, set aside ${led3[2]} (key 418/105)`);
  const status = page.locator('main [role=status]');
  await status.filter({ hasText: /^Now keeping/ }).waitFor({ timeout: 2000 }).catch(() => {});
  const said = await status.innerText();
  check(/^Now keeping 418/.test(said), `T3 announced: "${said}"`);
  await page.screenshot({ path: `${out}/2-previews-kept.png`, fullPage: true });

  // The timeline in that state.
  await page.getByRole('button', { name: /^Review my/ }).click();
  await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor();
  let tl = await timeline(page);
  check(sumYear(tl, '2022') === 44 && monthTotal(tl.none) === 224, `T3→T4 timeline with previews kept: 2022 ${sumYear(tl, '2022')}, No date ${tl.none} (key 44 / 224)`);
  await page.getByRole('button', { name: 'Back to Clean up' }).click();
  if (!(await page.getByRole('button', { name: 'Set these aside again' }).isVisible())) await page.getByRole('button', { name: /preview copies/i }).click();
  await page.getByRole('button', { name: 'Set these aside again' }).click();
  const hu = flat(await page.locator('h1').innerText());
  check(hu === 'We found 214 photos and videos worth keeping.', `T3 undo: "${hu}"`);

  // T4 + G2 in the review timeline.
  await page.getByRole('button', { name: /^Review my/ }).click();
  await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor();
  tl = await timeline(page);
  const m22 = Object.entries(tl).filter(([k]) => k.startsWith('2022')).map(([k, v]) => `${k.slice(5)}:${monthTotal(v)}`).sort();
  check(sumYear(tl, '2022') === 44 && m22.length === 12, `G2 timeline 2022: ${sumYear(tl, '2022')} in ${m22.length} months (${m22.join(' ')}) (key 44 in 12)`);
  check(monthTotal(tl.none) === 20, `T4 timeline No date: "${tl.none}" (key 20)`);
  const years = { 2024: 28, 2023: 38, 2022: 44, 2021: 33, 2020: 29, 2019: 22 };
  const got = Object.keys(years).map((y) => `${y}:${sumYear(tl, y)}`).join(' ');
  check(Object.entries(years).every(([y, c]) => sumYear(tl, y) === c), `G1/G2 timeline per year: ${got} (key 2024:28 2023:38 2022:44 2021:33 2020:29 2019:22)`);
  console.log(`timeline year chips: ${(await page.locator('nav.chips').first().locator('.chip').allInnerTexts()).join(', ')}`);
  await page.screenshot({ path: `${out}/3-review.png` });

  // G2: select only 2022.
  await page.getByRole('button', { name: 'Unselect all', exact: true }).click();
  for (const k of Object.keys(tl).filter((k) => k.startsWith('2022'))) await page.locator(`.tl-month[data-month="${k}"]`).getByRole('button', { name: /^Select all of/ }).click();
  const sel = num(await page.locator('dl.ledger dd[data-k=selected]').innerText());
  check(sel === 44, `G2 selected only 2022: ${sel} selected (key 44)`);

  // T80/T79 (1280×900, where the jump bar sticks): the count stays in view; Back to top; choices kept.
  const bar = async () => page.evaluate(() => {
    const tally = document.querySelector('.tl-tally');
    const r = tally.getBoundingClientRect();
    const top = tally.querySelector('.tl-top');
    return { text: tally.querySelector('.tl-tally-count').textContent, inView: r.top >= 0 && r.bottom <= innerHeight, topShown: getComputedStyle(top).visibility === 'visible', pad: document.documentElement.style.scrollPaddingTop };
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  let b = await bar();
  check(b.text === '44 of 214 selected' && b.inView && !b.topShown, `T80 count on the jump bar at the top: "${b.text}", Back to top hidden: ${!b.topShown}`);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
  await page.waitForTimeout(300);
  b = await bar();
  check(b.text === '44 of 214 selected' && b.inView && b.topShown && /px$/.test(b.pad), `T80 halfway down: count still in view ("${b.text}"), Back to top shown, scroll padding ${b.pad}`);
  await page.locator('.tl-tally .tl-top').click();
  await page.waitForTimeout(100);
  const up = await page.evaluate(() => ({ y: scrollY, focus: document.activeElement?.id }));
  check(up.y === 0 && up.focus === 'choose-h', `T79 Back to top: scrollY ${up.y}, focus on #${up.focus}`);
  check((await page.locator('.tl-col > div > .tl-top').count()) === 1, 'T79 a second Back to top at the end of the list');
  const keepsLine = flat(await page.locator('.tl-back').innerText());
  check(/Your choices here are kept if you go back\./.test(keepsLine), `T79 next to Back to Clean up: "${keepsLine}"`);
  await page.getByRole('button', { name: 'Back to Clean up' }).click();
  await page.getByRole('button', { name: /^Review my/ }).click();
  await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor();
  const selBack = num(await page.locator('dl.ledger dd[data-k=selected]').innerText());
  check(selBack === 44, `T79 choices kept after Back to Clean up and back: ${selBack} selected (key 44)`);
  await page.locator('.tl-save:visible').click();
  await page.getByRole('heading', { level: 1, name: /Where should we save/ }).waitFor();

  // Data safety: the recovery folder and a folder inside it are refused.
  for (const p of ['', 'recup_dir.2']) {
    await page.evaluate(async (p) => { const d = p ? await window.__rec.getDirectoryHandle(p) : window.__rec; window.showDirectoryPicker = async () => d; }, p);
    await page.getByRole('button', { name: /Choose (a|a different) folder/ }).first().click();
    await page.waitForTimeout(600);
    const alert = (await page.locator('[role=alert] h2').allInnerTexts()).join(' | ');
    const still = /Where should we save/.test(await page.locator('h1').innerText());
    check(still && /That’s your recovery folder\./.test(alert), `save into recovery folder${p ? `/${p}` : ''} refused: "${alert}"`);
  }

  // G2: save into Pictures.
  await page.evaluate(async () => { const d = await window.__desk.getDirectoryHandle('Pictures'); window.showDirectoryPicker = async () => d; });
  await page.getByRole('button', { name: /Choose (a|a different) folder/ }).first().click();
  await page.getByRole('heading', { level: 1, name: /saved\./ }).waitFor({ timeout: 120_000 });
  const saved = num(await page.locator('dd[data-k=saved]').innerText());
  const failed = num(await page.locator('dd[data-k=failed]').innerText());
  check(saved === 44 && failed === 0, `G2 receipt: ${saved} saved, ${failed} couldn't save`);
  const find = await page.locator('[data-k=find]').innerText();
  check(find.includes('Pictures › Keepsake photos'), `G2 done screen says where: "${flat(find)}"`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save receipt' }).click()]);
  const receipt = readFileSync(await dl.path(), 'utf8');
  check(/Recovery folder\s+Untouched/.test(receipt), `T6 receipt file: "${(receipt.match(/Recovery folder.*/) || ['(missing)'])[0]}"`);
  check(/Your files\s+None deleted, none sent anywhere\n/.test(receipt) && !/0 · 0|upload/i.test(receipt), `T76 receipt file: "${(receipt.match(/Your files.*/) || ['(missing)'])[0]}"`);
  const rRow = (await page.locator('.receipt .ledger-safe [aria-hidden=true]').allInnerTexts()).join(' · ');
  check(rRow === 'Your files · None deleted, none sent anywhere', `T76 receipt screen: "${rRow}"`);
  const pics = await listIn(page, 'pictures');
  const months = new Set(pics.map((f) => f.p.split('/').slice(0, 3).join('/')));
  check(pics.length === 44 && pics.every((f) => f.p.startsWith('Keepsake photos/2022/') && f.s > 0), `G2 Pictures holds ${pics.length} files, all under Keepsake photos/2022/, none empty`);
  check(months.size === 12, `G2 month folders: ${[...months].map((m) => m.split('/')[2]).join(', ')}`);
  console.log(`e.g. ${pics.slice(0, 3).map((f) => f.p).join(' | ')}`);

  // Data safety: the recovery folder is unchanged.
  const recAfter = await listRec(page);
  const same = recAfter.join('\n') === recBefore.join('\n');
  check(recAfter.length === 523 && same, `recovery folder after: ${recAfter.length} files, names and sizes ${same ? 'unchanged' : 'CHANGED'}`);
  await page.screenshot({ path: `${out}/4-done.png`, fullPage: true });
  await ctx.close();
}

const server = spawn('npx', ['vite', 'preview', '--outDir', 'dist-test', '--port', port, '--strictPort'], { stdio: 'pipe', detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch { /* already gone */ } }; // the server and its children
process.once('SIGINT', () => { stopServer(); process.exit(130); });
let browser;
try {
  await new Promise((r, j) => { server.stdout.on('data', (d) => String(d).includes(port) && r()); server.on('exit', () => j(new Error(`preview server exited (port ${port} in use?)`))); });
  browser = await chromium.launch({ executablePath: exe });
  await run(browser);
} finally {
  await browser?.close();
  stopServer();
}
check(errors.length === 0, errors.length ? `console errors:\n  ${errors.join('\n  ')}` : 'No console errors.');
check(outside.length === 0, outside.length ? `outside requests:\n  ${outside.join('\n  ')}` : `Zero requests to any origin other than ${base}.`);
console.log(`\nPILOT E2E: ${checks - fails.length}/${checks} checks passed${fails.length ? `, ${fails.length} FAILED` : ''}.`);
if (fails.length) process.exitCode = 1;
