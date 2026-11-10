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
/**
 * The main heading's words as a screen reader gets them: the parts hidden from screen readers are
 * left out (the results number counts up on screen, with its final value in an sr-only copy).
 */
const h1Text = (page) => page.locator('main h1').evaluate((el) => {
  const c = el.cloneNode(true);
  c.querySelectorAll('[aria-hidden=true]').forEach((x) => x.remove());
  return c.textContent.replace(/\s+/g, ' ').trim();
});

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
  // D24: watch every blob: URL the page makes and gives back, noting which were made while the viewer is in the page.
  await ctx.addInitScript(() => {
    const made = new Map();
    window.__urls = made;
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (b) => {
      const u = create(b);
      made.set(u, { name: b instanceof File ? b.name : '', type: b.type, size: b.size, viewer: !!document.querySelector('dialog.viewer'), live: true });
      return u;
    };
    URL.revokeObjectURL = (u) => { const m = made.get(u); if (m) m.live = false; revoke(u); };
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.goto(`${base}/`);
  const title = await page.title();
  check(/Upsort \(test\)$/.test(title), `test build: title "${title}"`);
  check((await page.getByRole('button', { name: /example files/i }).count()) === 0, 'test build: no "Try with example files" button');

  // T83: the start screen says what it does, keeps the promise in view, and answers three questions.
  const startScreen = async () => ({
    h1: await h1Text(page),
    promise: flat(await page.locator('main .privacy-line').innerText().catch(() => '')),
    faqH: flat(await page.locator('main .know h2').innerText().catch(() => '')),
    faq: (await page.locator('main .know dt').allInnerTexts()).map(flat),
    howH: flat(await page.locator('main .how h2').innerText().catch(() => '')),
    how: await page.locator('main .how h3').evaluateAll((els) => els.map((el) => {
      const c = el.cloneNode(true);
      c.querySelectorAll('[aria-hidden=true]').forEach((x) => x.remove());
      return c.textContent.replace(/\s+/g, ' ').trim();
    })),
    oldNote: await page.getByText(/Upsort runs in your browser|never leave this computer/).count(),
  });
  const st0 = await startScreen();
  check(st0.h1 === 'Recovered photos, sorted by date.', `Warmth start title: "${st0.h1}"`);
  const steps = await page.evaluate(() => ({
    names: [...document.querySelectorAll('ol.steps li')].map((li) => li.textContent),
    current: document.querySelector('ol.steps [aria-current=step]')?.textContent,
    line: document.querySelector('.step-line')?.textContent,
    label: document.querySelector('ol.steps')?.getAttribute('aria-label'),
    guide: !!document.evaluate("//button[normalize-space()='No recovery folder yet? Here’s how to make one']", document, null, 9, null).singleNodeValue,
  }));
  check(steps.names.join('|') === 'Scan|Sort|Choose|Save' && steps.current === 'Scan' && steps.line === 'Step 1 of 4 · Scan' && steps.label === 'Steps' && steps.guide,
    `Warmth stepper: ${steps.names.join(', ')}; current "${steps.current}"; "${steps.line}"; guide line under the button ${steps.guide}`);
  check(st0.promise === 'Your photos stay on your computer. Nothing is uploaded or deleted.', `T83 start promise: "${st0.promise}"`);
  check(st0.faqH === 'Good to know' && st0.faq.join(' | ') === 'Do you see my photos? | Do I need an account? | Will it change my files?' && st0.oldNote === 0,
    `T83 start Q&A: "${st0.faqH}": ${st0.faq.join(' | ')}; old privacy lines left: ${st0.oldNote}`);
  // Round 6: How it works, three numbered steps (the number is decorative; the list gives the order).
  check(st0.howH === 'How it works' && st0.how.join(' | ') === 'Files come back unsorted | We sort them by date | You choose what to keep',
    `Round 6 How it works: "${st0.howH}": ${st0.how.join(' | ')}`);

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
  // Warmth: the big number counts up on screen; screen readers get only the final value, and the heading doesn't change size.
  const countAt = () => page.evaluate(() => ({
    live: document.querySelector('main h1 .count-live')?.textContent,
    sr: document.querySelector('main h1 .sr-only')?.textContent,
    h: Math.round(document.querySelector('main h1').getBoundingClientRect().height),
    w: Math.round(document.querySelector('main h1 .count-vis').getBoundingClientRect().width),
  }));
  const c0 = await countAt();
  await page.waitForFunction(() => document.querySelector('main h1 .count-live')?.textContent === '214', null, { timeout: 3000 }).catch(() => {});
  const c1 = await countAt();
  check(num(c0.live) < 214 && c1.live === '214' && c0.sr === '214' && c1.sr === '214' && c0.h === c1.h && c0.w === c1.w,
    `Warmth count-up: showed ${c0.live} then ${c1.live}; screen readers "${c0.sr}"; heading ${c0.h}px → ${c1.h}px, number ${c0.w}px → ${c1.w}px`);
  await page.waitForTimeout(800); // let previews decode
  await page.screenshot({ path: `${out}/1-results.png`, fullPage: true });
  const h1 = await h1Text(page);
  check(h1 === 'We found 214 photos and videos.', `G1 title: "${h1}"`);
  const led = (await page.locator('dl.ledger dd').allInnerTexts()).map(flat);
  check(num(led[0]) === 523 && num(led[1]) === 214 && num(led[2]) === 309, `G1 ledger: checked ${led[0]}, kept ${led[1]}, set aside ${led[2]} (key 523/214/309)`);
  // Warmth: the promise is one note under the ledger (no ledger row, no separate paragraph).
  const safeNote = flat(await page.locator('main .promise-safe').innerText());
  const oldSafe = await page.locator('main .ledger-safe, main .untouched').count();
  check(safeNote === 'None of your files were deleted or sent anywhere. They’re all still in your recovery folder, just as they were.' && oldSafe === 0 && led.length === 3 && !/0 · 0|[Uu]pload/.test(flat(await page.locator('main').innerText())),
    `T6/T76 promise in words, no "0 · 0" or "upload": "${safeNote}" (old rows left: ${oldSafe}, ledger rows ${led.length})`);
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

  // D23: "See all" in a set-aside group lists every file in it (drawn as it comes near the screen).
  const listAll = (id) => page.evaluate(async (id) => {
    const seen = new Set();
    const list = document.querySelector(`#all-${id} .gf-list`);
    const opens = new Set();
    let boxes = 0;
    for (const b of list.querySelectorAll(':scope > .tl-block')) {
      b.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 60));
      for (const it of list.querySelectorAll('.gf-item')) seen.add(it.dataset.id);
      for (const o of list.querySelectorAll('.gf-open')) opens.add(o.dataset.view);
      boxes += list.querySelectorAll('input[type=checkbox]').length;
    }
    const text = list.closest('.gf').innerText;
    list.closest('.group').scrollIntoView({ block: 'start' });
    await new Promise((r) => setTimeout(r, 100));
    return { n: seen.size, boxes, open: opens.size, text };
  }, id);
  for (const [g, c, id] of [['Small preview copies', 204, 'small'], ['App and system files', 81, 'system']]) {
    await page.locator('.group-head', { hasText: g }).click();
    const toggle = page.locator(`#aside-${id} .gf-toggle`);
    const label = flat(await toggle.innerText());
    const closed = (await toggle.getAttribute('aria-expanded')) === 'false' && await page.locator(`#all-${id}`).isHidden();
    await toggle.click();
    const l = await listAll(id);
    check(closed && label === `See all ${c} files` && l.n === c && l.boxes === 0 && /These files stay in your recovery folder\. Nothing has been deleted\./.test(l.text),
      `D23 "${g}": collapsed at first, "${label}" lists ${l.n} files (key ${c}), ${l.boxes} checkboxes, "stay in your recovery folder" line`);
    if (id === 'small') {
      check(l.open === 204, `D23 every file in "${g}" opens the viewer (${l.open} of 204 found while scrolling)`);
      const firstOpen = page.locator(`#all-${id} .gf-open`).first();
      const firstView = await firstOpen.getAttribute('data-view');
      await firstOpen.click();
      await page.locator('dialog.viewer[open] img.viewer-media').waitFor({ timeout: 5000 }).catch(() => {});
      const vv = await page.evaluate(() => ({ pos: document.querySelector('dialog.viewer .viewer-pos')?.textContent, img: document.querySelector('dialog.viewer img.viewer-media')?.naturalWidth ?? 0 }));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      const back = await page.evaluate((v) => document.activeElement?.matches(`#all-small .gf-open[data-view="${v}"]`), firstView);
      check(vv.pos === '1 of 204' && vv.img > 0 && back, `D23 a group photo opens in the viewer ("${vv.pos}", picture ${vv.img}px wide), Esc returns focus to it: ${back}`);
    } else {
      check(l.open === 0 && /App settings/.test(l.text) && /Log or text/.test(l.text), `D23 "${g}": no file opens a viewer (${l.open}); kinds named ("App settings", "Log or text")`);
    }
    await toggle.click();
  }
  await page.locator('.group-head', { hasText: 'App and system files' }).click(); // close it again
  await page.evaluate(() => window.scrollTo(0, 0));

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
  check(/Adds them to the files you review and save\. Nothing moves on your computer\./.test(keepNote), 'T78 the line under "Keep these files" says what it does');
  await page.getByRole('button', { name: 'Keep these files' }).click();
  // The tint is set by an effect after the ledger's numbers change (a second render), so wait for it.
  await page.waitForFunction(() => document.querySelectorAll('dl.ledger > div.changed').length >= 2, null, { timeout: 2000 }).catch(() => {});
  const after = await page.evaluate(() => ({
    focus: document.activeElement?.textContent,
    note: document.querySelector('#aside-small .note-box')?.textContent,
    tinted: [...document.querySelectorAll('dl.ledger > div.changed dt')].map((d) => d.textContent),
    hint: /Adds them to the files/.test(document.querySelector('#aside-small').textContent),
  }));
  check(after.focus === 'Set these aside again' && after.note === 'Added 204 to Kept. Kept is now 418.' && !after.hint, `T77 after Keep: focus on "${after.focus}", note "${after.note}"`);
  check(after.tinted.join('|') === 'Kept, sorted by date|Set aside, kept safe below', `T77 changed ledger rows tinted: ${after.tinted.join(', ')}`);
  const h3 = await h1Text(page);
  const led3 = (await page.locator('dl.ledger dd').allInnerTexts()).map(num);
  check(h3 === 'We found 418 photos and videos.' && led3[1] === 418 && led3[2] === 105, `T3 after Keep these files: "${h3}", ledger kept ${led3[1]}, set aside ${led3[2]} (key 418/105)`);
  const status = page.locator('main [role=status]');
  await status.filter({ hasText: /^Now keeping/ }).waitFor({ timeout: 2000 }).catch(() => {});
  const said = await status.innerText();
  check(/^Now keeping 418/.test(said), `T3 announced: "${said}"`);
  await page.screenshot({ path: `${out}/2-previews-kept.png`, fullPage: true });

  // The timeline in that state.
  await page.getByRole('button', { name: /^Review my/ }).click();
  await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor();
  const st2 = await page.evaluate(() => ({
    names: [...document.querySelectorAll('ol.steps li')].map((li) => li.textContent),
    current: document.querySelector('ol.steps [aria-current=step]')?.textContent,
    title: document.title,
  }));
  check(st2.names.join('|') === 'Scan (done)|Sort (done)|Choose|Save' && st2.current === 'Choose' && /^Choose · /.test(st2.title),
    `Warmth stepper on review: ${st2.names.join(', ')}; title "${st2.title}"`);
  let tl = await timeline(page);
  check(sumYear(tl, '2022') === 44 && monthTotal(tl.none) === 224, `T3→T4 timeline with previews kept: 2022 ${sumYear(tl, '2022')}, No date ${tl.none} (key 44 / 224)`);
  await page.getByRole('button', { name: 'Back to Sort' }).click();
  if (!(await page.getByRole('button', { name: 'Set these aside again' }).isVisible())) await page.getByRole('button', { name: /preview copies/i }).click();
  await page.getByRole('button', { name: 'Set these aside again' }).click();
  const hu = await h1Text(page);
  const liveBack = await page.locator('main h1 .count-live').innerText();
  check(hu === 'We found 214 photos and videos.' && liveBack === '214', `T3 undo: "${hu}" (no count-up after coming back: shows ${liveBack})`);

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

  // T50 and T59: the Screenshots and From chat apps filters (key: 4 screenshots, 16 photos saved
  // from Messenger). They only show files: nothing is unticked or set aside by choosing one.
  const chipTexts = (await page.locator('.tl-filter[aria-label="Show only"] .chip').allInnerTexts()).map(flat);
  check(chipTexts.join('|') === 'All 214 files|Photos 208 files|Videos 6 files|Not selected 0 files|Screenshots 4 files|From chat apps 16 files', `T50/T59 filter chips with counts: ${chipTexts.join(', ')}`);
  const filterState = () => page.evaluate(() => ({
    pressed: [...document.querySelectorAll('.tl-filter-show .chip[aria-pressed=true]')].map((c) => c.textContent.replace(/\s+/g, ' ')),
    tiles: document.querySelectorAll('.tl-tile').length,
    ticked: document.querySelectorAll('.tl-tile input:checked').length,
    showing: document.querySelector('.tl-showing')?.textContent ?? '',
    note: document.querySelector('.tl-showing .note-box')?.textContent ?? '',
    selected: document.querySelector('dd[data-k=selected]')?.textContent,
    status: document.querySelector('main [role=status]')?.textContent,
    focus: document.activeElement?.textContent?.replace(/\s+/g, ' '),
  }));
  for (const [name, count, word] of [['Screenshots', 4, /look like screenshots/], ['From chat apps', 16, /chat apps.*family photos worth keeping/]]) {
    await page.locator('.tl-filter .chip', { hasText: name }).click();
    await page.waitForFunction((c) => document.querySelector('main [role=status]')?.textContent?.startsWith(`Showing ${c} of`), count, { timeout: 2000 }).catch(() => {});
    // QA m3: tiles are drawn lazily, so wait for them too before counting.
    await page.waitForFunction((c) => document.querySelectorAll('.tl-tile').length === c, count, { timeout: 3000 }).catch(() => {});
    const f = await filterState();
    // m4: each chip's number is followed by a visually hidden " files".
    check(f.pressed.join() === `${name} ${count} files` && f.focus === `${name} ${count} files` && f.tiles === count && f.ticked === count,
      `T50/T59 ${name}: pressed "${f.pressed.join()}", focus stays on it, ${f.tiles} tiles shown, ${f.ticked} still ticked (key ${count})`);
    check(f.status === `Showing ${count} of 214.` && /^Showing \d+ of 214\. A filter only changes what you see\. Nothing is unselected or deleted\./.test(f.showing) && word.test(f.note),
      `T50/T59 ${name}: said "${f.status}"; shown "${f.showing.slice(0, 90)}…"`);
    check(f.selected === '214', `T50/T59 ${name}: choosing it changes nothing (selected ${f.selected} of 214)`);
  }
  // Unticking one by hand works as anywhere else, and the file stays in the filter.
  await page.locator('.tl-tile input[type=checkbox]').first().click();
  let f1 = await filterState();
  check(f1.selected === '213' && f1.tiles === 16 && f1.ticked === 15, `T59 untick one chat photo by hand: selected ${f1.selected}, still ${f1.tiles} shown`);
  await page.locator('.tl-tile input[type=checkbox]').first().click();
  await page.locator('.tl-filter .chip', { hasText: /^All/ }).click();
  await page.waitForFunction(() => document.querySelector('main [role=status]')?.textContent === 'Showing all 214.', null, { timeout: 2000 }).catch(() => {});
  f1 = await filterState();
  check(f1.selected === '214' && f1.showing === '' && f1.status === 'Showing all 214.', `T50/T59 back to All: selected ${f1.selected}, said "${f1.status}"`);

  // D24: the viewer in Review.
  const vstate = () => page.evaluate(() => {
    const d = document.querySelector('dialog.viewer');
    const a = document.activeElement;
    const img = d?.querySelector('img.viewer-media');
    return {
      open: !!d?.open, pos: d?.querySelector('.viewer-pos')?.textContent, h: d?.querySelector('h2')?.textContent,
      labelled: d && document.getElementById(d.getAttribute('aria-labelledby'))?.textContent,
      focus: a?.textContent || a?.getAttribute('aria-label') || a?.tagName, view: a?.dataset?.view,
      inView: a ? (() => { const r = a.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })() : false,
      img: img ? { w: img.naturalWidth, src: img.src } : null, box: d?.querySelector('.viewer-chk input')?.checked,
    };
  });
  const firstTile = page.locator('.tile-open').first();
  const firstId = await firstTile.getAttribute('data-view');
  await firstTile.click();
  await page.locator('dialog.viewer[open]').waitFor();
  let vs = await vstate();
  check(vs.open && vs.focus === 'Close' && vs.pos === '1 of 214' && vs.labelled === vs.h && vs.h.length > 0, `D24 mouse: tile opens the viewer, focus on Close, "${vs.pos}", labelled by "${vs.h}"`);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  vs = await vstate();
  const pos3 = vs.pos;
  await page.keyboard.press('ArrowLeft');
  const pos2 = (await vstate()).pos;
  check(pos3 === '3 of 214' && pos2 === '2 of 214', `D24 → → ← steps through: "${pos3}", then "${pos2}"`);
  // Its own checkbox: unticking it changes the count, and the tile's.
  await page.locator('dialog.viewer .viewer-chk input').click();
  const afterUntick = { sel: num(await page.locator('dl.ledger dd[data-k=selected]').innerText()), box: (await vstate()).box };
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  vs = await vstate();
  const secondId = await page.locator('.tile-open').nth(1).getAttribute('data-view');
  const tileBox = await page.locator('.tl-tile').nth(1).locator('.chk input').isChecked();
  check(afterUntick.sel === 213 && afterUntick.box === false && !tileBox, `D24 checkbox in the viewer: ${afterUntick.sel} selected (was 214), tile unticked too: ${!tileBox}`);
  check(!vs.open && vs.view === secondId, `D24 Esc closes and focus returns to the last photo shown (tile ${vs.view}, expected ${secondId})`);
  // Keyboard: Enter on "View larger", then Tab goes on to the tile's checkbox.
  await page.locator('.tl-tile').nth(1).locator('.chk input').check();
  await page.locator('.tl-tile').nth(1).locator('.tile-open').focus();
  await page.keyboard.press('Tab');
  const afterTab = await page.evaluate(() => document.activeElement?.closest('.tl-tile') === document.querySelectorAll('.tl-tile')[1] && document.activeElement.matches('.chk input'));
  await page.locator(`.tile-open[data-view="${firstId}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator('dialog.viewer[open]').waitFor();
  vs = await vstate();
  check(afterTab && vs.open && vs.focus === 'Close' && vs.pos === '1 of 214', `D24 keyboard: Tab goes View larger → its checkbox (${afterTab}); Enter opens the viewer ("${vs.pos}")`);
  check(num(await page.locator('dl.ledger dd[data-k=selected]').innerText()) === 214, 'D24 ticking it again: 214 selected');
  // Step through every file: find a HEIC (shown via our decoder: "Opening…" first) and go far down the list.
  let heic = null;
  for (let k = 1; k < 214; k++) {
    await page.keyboard.press('ArrowRight');
    const loading = await page.locator('dialog.viewer .viewer-msg[role=status]').count();
    if (loading && !heic) {
      await page.locator('dialog.viewer img.viewer-media').waitFor({ timeout: 20_000 }).catch(() => {});
      const st = await vstate();
      const made = await page.evaluate((src) => window.__urls.get(src), st.img?.src);
      heic = { k, w: st.img?.w ?? 0, made, id: await page.evaluate(() => document.querySelector('dialog.viewer h2').textContent) };
    }
    if (k >= 150 && heic) break;
  }
  vs = await vstate();
  check(!!heic && heic.w > 0 && heic.made && !heic.made.name && heic.made.type === 'image/jpeg', `D24 a HEIC opens (item ${heic?.k + 1}, "${heic?.id}"): decoded on this computer to a ${heic?.w}px-wide JPEG`);
  const farPos = vs.pos;
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  vs = await vstate();
  check(!vs.open && vs.view && vs.inView && vs.view !== firstId, `D24 Esc after stepping to "${farPos}": focus back on that photo's tile (${vs.view}), drawn and on screen`);
  // A video plays in the built app (blob: media allowed by the privacy lock-down, nothing fetched).
  const vid = page.locator('.tile-open', { hasText: 'Save video' }).first();
  await vid.scrollIntoViewIfNeeded();
  await vid.click();
  // Playwright's bundled Chromium has no H.264, so the viewer rightly shows its "can't play here" note.
  // Then check that note instead of playback (real Chrome and Edge play these videos).
  const h264 = await page.evaluate(() => document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"') !== '');
  if (!h264) {
    await page.locator('dialog.viewer[open]').waitFor();
    await page.waitForTimeout(1500);
    const note = await page.evaluate(() => !document.querySelector('dialog.viewer video.viewer-media') && (document.querySelector('dialog.viewer')?.textContent ?? '').length > 0);
    check(note, 'D24 a video in a browser without H.264 shows the can\'t-play note instead of a player (playback itself needs real Chrome or Edge)');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
  await page.locator('dialog.viewer[open] video.viewer-media').waitFor();
  const played = await page.evaluate(async () => {
    const v = document.querySelector('dialog.viewer video.viewer-media');
    const auto = !v.paused;
    v.muted = true;
    try { await v.play(); } catch (e) { return { err: String(e) }; }
    await new Promise((r) => setTimeout(r, 1200));
    return { auto, t: v.currentTime, ready: v.readyState, controls: v.controls, preload: v.preload, err: v.error?.code };
  });
  check(!played.err && played.auto === false && played.controls && played.preload === 'metadata' && (played.t > 0 || played.ready >= 2), `D24 a video plays in the built app: not on its own (${played.auto === false}), currentTime ${played.t?.toFixed?.(2)}, readyState ${played.ready}${played.err ? `, error ${played.err}` : ''}`);
  await page.locator('dialog.viewer .viewer-close').click();
  await page.waitForTimeout(100);
  check((await vstate()).view === (await vid.getAttribute('data-view')), 'D24 Close returns focus to the video tile');
  }
  // Open and close 50 times (stepping, and through the HEIC): every blob: URL the viewer made is given back.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { for (const m of window.__urls.values()) m.before = true; });
  for (let c = 0; c < 50; c++) {
    await page.locator(`.tile-open[data-view="${firstId}"]`).click();
    await page.locator('dialog.viewer[open]').waitFor();
    if (c % 10 === 0) for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
    if (c % 2) await page.keyboard.press('Escape'); else await page.locator('dialog.viewer .viewer-close').click();
    await page.locator('dialog.viewer').waitFor({ state: 'detached' });
    if (c % 10 === 0) await page.evaluate(() => window.scrollTo(0, 0));
  }
  // Through the HEIC decoder too, closed while decoding and after.
  for (let c = 0; c < 4; c++) {
    await page.locator(`.tile-open[data-view="${firstId}"]`).click();
    for (let k = 0; k < heic.k; k++) await page.keyboard.press('ArrowRight');
    if (c % 2) await page.locator('dialog.viewer img.viewer-media').waitFor({ timeout: 20_000 }).catch(() => {});
    await page.keyboard.press('Escape');
    await page.locator('dialog.viewer').waitFor({ state: 'detached' });
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.waitForTimeout(2500);
  const leak = await page.evaluate(() => {
    const mine = [...window.__urls.values()].filter((m) => !m.before && m.viewer);
    return { made: mine.length, live: mine.filter((m) => m.live).map((m) => `${m.name || m.type} ${m.size}`) };
  });
  check(leak.made > 50 && leak.live.length === 0, `D24 50+ opens and closes: the viewer made ${leak.made} blob: URLs, ${leak.live.length} still live${leak.live.length ? ` (${leak.live.slice(0, 5).join(', ')})` : ''}`);

  // QA m1: the sticky bar stays under 30% of the window; at 1280×800 the bar doesn't stick (the count and Save sit at the bottom instead).
  const barAt = async (h) => {
    await page.setViewportSize({ width: 1280, height: h });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 3));
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      const el = document.querySelector('.tl-tools');
      const foot = document.querySelector('.tl-footer');
      return { sticky: getComputedStyle(el).position === 'sticky', share: el.offsetHeight / innerHeight, foot: getComputedStyle(foot).display !== 'none' ? foot.offsetHeight / innerHeight : 0 };
    });
  };
  for (const h of [800, 880, 900]) {
    const bs = await barAt(h);
    check(bs.sticky ? bs.share < 0.3 : bs.foot > 0 && bs.foot < 0.3, `QA m1 at 1280×${h}: ${bs.sticky ? `sticky bar ${(bs.share * 100).toFixed(0)}%` : `bar not sticky, bottom bar ${(bs.foot * 100).toFixed(0)}%`} of the window (under 30%)`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));

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
  check(/Your choices here are kept if you go back\./.test(keepsLine), `T79 next to Back to Sort: "${keepsLine}"`);
  await page.getByRole('button', { name: 'Back to Sort' }).click();
  await page.getByRole('button', { name: /^Review my/ }).click();
  await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor();
  const selBack = num(await page.locator('dl.ledger dd[data-k=selected]').innerText());
  check(selBack === 44, `T79 choices kept after Back to Sort and back: ${selBack} selected (key 44)`);
  await page.locator('.tl-save:visible').click();
  await page.getByRole('heading', { level: 1, name: /Where should we save/ }).waitFor();

  // Data safety: the recovery folder and a folder inside it are refused.
  for (const p of ['', 'recup_dir.2']) {
    await page.evaluate(async (p) => { const d = p ? await window.__rec.getDirectoryHandle(p) : window.__rec; window.showDirectoryPicker = async () => d; }, p);
    await page.getByRole('button', { name: /Choose (a|a different) folder/ }).first().click();
    await page.waitForTimeout(600);
    const alert = (await page.locator('[role=alert] h2').allInnerTexts()).join(' | ');
    const still = /Where should we save/.test(await page.locator('h1').innerText());
    const focus = await page.evaluate(() => document.activeElement?.id);
    check(still && alert === 'That folder is part of your recovery folder.' && focus === 'problem-h',
      `save into recovery folder${p ? `/${p}` : ''} refused: "${alert}", focus on #${focus}`);
  }

  // G2: save into Pictures.
  await page.evaluate(async () => { const d = await window.__desk.getDirectoryHandle('Pictures'); window.showDirectoryPicker = async () => d; });
  await page.getByRole('button', { name: /Choose (a|a different) folder/ }).first().click();
  await page.getByRole('heading', { level: 1, name: /saved\./ }).waitFor({ timeout: 120_000 });
  const saved = num(await page.locator('dd[data-k=saved]').innerText());
  const failed = num(await page.locator('dd[data-k=failed]').innerText());
  check(saved === 44 && failed === 0, `G2 receipt: ${saved} saved, ${failed} couldn't save`);
  const find = await page.locator('[data-k=find]').innerText();
  check(find.includes('Pictures › Upsort photos'), `G2 done screen says where: "${flat(find)}"`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save receipt' }).click()]);
  const receipt = readFileSync(await dl.path(), 'utf8');
  check(/Recovery folder\s+Untouched/.test(receipt), `T6 receipt file: "${(receipt.match(/Recovery folder.*/) || ['(missing)'])[0]}"`);
  check(/Your files\s+None deleted, none sent anywhere\n/.test(receipt) && !/0 · 0|upload/i.test(receipt), `T76 receipt file: "${(receipt.match(/Your files.*/) || ['(missing)'])[0]}"`);
  const rRow = (await page.locator('.receipt .ledger-safe [aria-hidden=true]').allInnerTexts()).join(' · ');
  check(rRow === 'Your files · None deleted, none sent anywhere', `T76 receipt screen: "${rRow}"`);
  const pics = await listIn(page, 'pictures');
  const months = new Set(pics.map((f) => f.p.split('/').slice(0, 3).join('/')));
  check(pics.length === 44 && pics.every((f) => f.p.startsWith('Upsort photos/2022/') && f.s > 0), `G2 Pictures holds ${pics.length} files, all under Upsort photos/2022/, none empty`);
  check(months.size === 12, `G2 month folders: ${[...months].map((m) => m.split('/')[2]).join(', ')}`);
  console.log(`e.g. ${pics.slice(0, 3).map((f) => f.p).join(' | ')}`);

  // Data safety: the recovery folder is unchanged.
  const recAfter = await listRec(page);
  const same = recAfter.join('\n') === recBefore.join('\n');
  check(recAfter.length === 523 && same, `recovery folder after: ${recAfter.length} files, names and sizes ${same ? 'unchanged' : 'CHANGED'}`);
  await page.screenshot({ path: `${out}/4-done.png`, fullPage: true });

  // T83: "Sort another folder" goes back to the start screen with this tab's results cleared.
  const again = page.getByRole('button', { name: 'Sort another folder' });
  const againNote = flat(await page.locator('#start-over-note').innerText());
  check(await again.isVisible() && againNote === 'Your saved photos stay where they are. This receipt will close, so save or print it first.', `T83 done screen: Sort another folder, "${againNote}"`);
  await again.click();
  await page.getByRole('heading', { level: 1, name: /Recovered photos/ }).waitFor();
  await page.waitForTimeout(300);
  const st1 = await startScreen();
  const afterOver = await page.evaluate(() => ({
    focus: document.activeElement?.tagName,
    livePreviews: [...window.__urls.values()].filter((m) => m.live && (m.name || m.type.startsWith('image/'))).length,
  }));
  check(st1.h1 === st0.h1 && afterOver.focus === 'H1', `T83 back on the start screen, focus on the heading (${afterOver.focus})`);
  check(afterOver.livePreviews === 0, `T83 start over gives back every preview URL (${afterOver.livePreviews} still live)`);
  const recAgain = await listRec(page);
  const pics2 = await listIn(page, 'pictures');
  check(recAgain.join('\n') === recBefore.join('\n') && pics2.length === 44, `T83 start over touches nothing on disk: recovery folder ${recAgain.length} files unchanged, Pictures still ${pics2.length}`);
  // A second scan from here works as the first did.
  await page.evaluate(() => { window.showDirectoryPicker = async () => window.__rec; });
  await page.getByRole('button', { name: 'Choose recovery folder' }).click();
  await page.getByText('Files checked').waitFor({ timeout: 120_000 });
  const h1b = await h1Text(page);
  check(h1b === 'We found 214 photos and videos.', `T83 second scan after start over: "${h1b}"`);
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
