// Accessibility check of the built app (T30): axe-core (WCAG 2.1 A/AA rules) on every screen and
// state, plus scripted checks axe can't do: a keyboard-only run through the whole flow (reach, order,
// visible focus, no traps), focus on the new heading at each step, live regions, tap targets,
// page titles, headings, reflow at 200% / 320px, reduced motion and forced colours.
//
// Usage: npm run build && node scripts/a11y-check.mjs [chromiumPath] [--fixture fixtures/recovery] [--port 4176] [--shots e2e-shots/a11y]
// Exits 1 when anything serious is found (axe "serious"/"critical", or a scripted check marked serious).
// The folder picker and the save folder are stubbed in the page (see fakeFolder); nothing is written to disk.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { APP_NAME } from '../src/brand.ts';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const fixture = resolve(opt('--fixture', 'fixtures/recovery'));
const port = Number(opt('--port', '4176'));
const out = opt('--shots', 'e2e-shots/a11y');
const exe = args[0] || process.env.CHROMIUM_PATH;
const base = `http://localhost:${port}/`;
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
mkdirSync(out, { recursive: true });

/** Every finding: severity 'serious' fails the run; 'minor' and 'info' are reported only. */
const findings = [];
const passes = [];
const add = (severity, run, screen, what) => findings.push({ severity, run, screen, what });
const ok = (run, screen, what) => passes.push(`[${run}] ${screen}: ${what}`);
const check = (cond, severity, run, screen, what) => (cond ? ok(run, screen, what) : add(severity, run, screen, what));

// Folders for the empty states, made in a temp dir and removed at the end.
const tmp = mkdtempSync(join(tmpdir(), 'keepsake-a11y-'));
const emptyDir = join(tmp, 'empty');
mkdirSync(emptyDir);
writeFileSync(join(emptyDir, '.DS_Store'), 'x'); // filtered out as OS clutter: the folder counts as empty
const junkDir = join(tmp, 'junk');
mkdirSync(junkDir);
for (let i = 0; i < 5; i++) writeFileSync(join(junkDir, `f${1000 + i}.txt`), `not a photo ${i}\n`.repeat(50));

// ---------------------------------------------------------------------------------------------
// In-page helpers

/** Replaces the folder picker with an in-memory folder. window.__save = { delay, failAfter, failName } steers it. */
function fakeFolder() {
  window.__save = { delay: 0, failAfter: Infinity, failName: '' };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  class FFile {
    constructor(name, dir) { this.kind = 'file'; this.name = name; this.dir = dir; this.data = []; }
    // Like Chromium: rename in the same folder, replacing a file already there (Save needs move()).
    async move(n) {
      if (this.dir.m.get(n)?.kind === 'directory') throw new DOMException('dir', 'InvalidModificationError');
      this.dir.m.delete(this.name); this.name = n; this.dir.m.set(n, this);
    }
    async remove() { if (this.dir.m.get(this.name) === this) this.dir.m.delete(this.name); }
    async getFile() { return new File(this.data, this.name); }
    async createWritable() {
      const f = this; const parts = [];
      return {
        async write(c) {
          await sleep(window.__save.delay);
          if (window.__save.failAfter-- <= 0) throw new DOMException('stub failure', window.__save.failName || 'InvalidStateError');
          parts.push(c);
        },
        async close() { f.data = parts; },
        async abort() {},
      };
    }
  }
  class FDir {
    constructor(name) { this.kind = 'directory'; this.name = name; this.m = new Map(); }
    async getDirectoryHandle(n, o = {}) {
      const h = this.m.get(n);
      if (h?.kind === 'directory') return h;
      if (h) throw new DOMException('file', 'TypeMismatchError');
      if (!o.create) throw new DOMException('missing', 'NotFoundError');
      const d = new FDir(n); this.m.set(n, d); return d;
    }
    async getFileHandle(n, o = {}) {
      const h = this.m.get(n);
      if (h?.kind === 'file') return h;
      if (h) throw new DOMException('dir', 'TypeMismatchError');
      if (!o.create) throw new DOMException('missing', 'NotFoundError');
      const f = new FFile(n, this); this.m.set(n, f); return f;
    }
    async removeEntry(n) { this.m.delete(n); }
    async *keys() { yield* this.m.keys(); }
    async queryPermission() { return 'granted'; }
    async requestPermission() { return 'granted'; }
    async resolve() { return null; }
  }
  window.__pick = 'ok'; // 'ok' | 'denied' | 'abort'
  window.showDirectoryPicker = async () => {
    if (window.__pick === 'denied') throw new DOMException('stub', 'NotAllowedError');
    if (window.__pick === 'abort') throw new DOMException('stub', 'AbortError');
    return new FDir('Pictures');
  };
}

/** What has focus, and whether it shows a focus ring and can be seen. */
function focusInfo() {
  const el = document.activeElement;
  if (!el || el === document.body) return { tag: 'body' };
  const visible = (e) => { const s = getComputedStyle(e); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; };
  let ring = visible(el);
  if (!ring && el.matches('.chk input')) ring = visible(el.nextElementSibling);
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  const covered = hit && !el.contains(hit) && !hit.contains(el) && !(el.closest('label')?.contains(hit));
  const name = el.getAttribute('aria-label') || el.closest('label')?.innerText || el.innerText || el.value || '';
  return {
    tag: el.tagName.toLowerCase(),
    type: el.type || '',
    cls: el.className || '',
    name: name.replace(/\s+/g, ' ').trim().slice(0, 70),
    ring,
    inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
    covered: covered ? (hit.closest('[class]')?.className || hit.tagName) : '',
    key: el.id || `${el.tagName}:${name.slice(0, 40)}:${Math.round(r.top + scrollY)}:${Math.round(r.left)}`,
  };
}

// ---------------------------------------------------------------------------------------------
// Node-side helpers

const names = new Map(); // screen -> titles seen
async function axe(page, run, screen) {
  // Let entrance and fade-in animations end first (none of them loops), so colours are checked at rest.
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, 2000)),
  ]));
  await page.evaluate(axeSource);
  const r = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, tags: v.tags, nodes: v.nodes.map((nd) => ({ t: nd.target.join(' '), s: nd.failureSummary?.split('\n').slice(1, 2).join(' ') ?? '' })) }));
  });
  for (const v of r) {
    const wcag = v.tags.filter((t) => /^wcag\d{3,}$/.test(t)).map((t) => t.replace(/^wcag(\d)(\d)(\d+)$/, '$1.$2.$3')).join(', ') || 'best practice';
    const sev = (v.impact === 'serious' || v.impact === 'critical') && wcag !== 'best practice' ? 'serious' : 'minor';
    add(sev, run, screen, `axe ${v.id} (${v.impact}, ${wcag}): ${v.help}. ${v.nodes.length} node(s), e.g. ${v.nodes.slice(0, 3).map((nd) => `${nd.t}${nd.s ? ` [${nd.s.trim().slice(0, 140)}]` : ''}`).join(' | ')}`);
  }
  if (!r.length) ok(run, screen, 'axe: no violations');
  // Title, headings, lang, side scroll on every screen.
  const meta = await page.evaluate(() => ({
    title: document.title,
    lang: document.documentElement.lang,
    heads: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => h.offsetParent || h.getClientRects().length).map((h) => Number(h.tagName[1])),
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  if (!names.has(screen)) names.set(screen, new Set());
  names.get(screen).add(meta.title);
  check(meta.lang === 'en', 'serious', run, screen, `lang="${meta.lang}"`);
  const h1s = meta.heads.filter((h) => h === 1).length;
  const skip = meta.heads.some((h, i) => i > 0 && h > meta.heads[i - 1] + 1);
  check(h1s === 1 && meta.heads[0] === 1 && !skip, 'minor', run, screen, `headings in order (${meta.heads.join(',')})`);
  check(meta.sw <= meta.cw, 'serious', run, screen, `no horizontal scroll (1.4.10): ${meta.sw}px content in ${meta.cw}px`);
  await page.screenshot({ path: `${out}/${run}-${screen.replace(/[^a-z0-9]+/gi, '-')}.png`, fullPage: true }).catch(() => {});
}

/** Focus must be on the screen's h1 after a step change. */
async function focusOnHeading(page, run, screen) {
  await page.waitForTimeout(150);
  const f = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.slice(0, 60) }));
  check(f.tag === 'H1', 'serious', run, screen, `focus moves to the new heading (2.4.3), got ${f.tag} "${f.text ?? ''}"`);
}

/** Every visible control must be at least `min` px in both directions (links in running text exempt). */
async function targets(page, run, screen, min, severity, criterion) {
  const small = await page.evaluate((min) => {
    const els = [...document.querySelectorAll('button, a[href], input, select, summary, [tabindex]:not([tabindex="-1"])')];
    const res = [];
    for (const el of els) {
      if (el.matches('h1,h2') || el.closest('[hidden]') || el.classList.contains('skip')) continue;
      // Links inside running text (the reading pages) are exempt from target size (2.5.8 "inline").
      if (el.matches('.doc p a, .doc li a')) continue;
      // An invisible input inside a bigger label: the label is the target.
      const box = el.matches('.chk input') ? el.parentElement : el.closest('label.tl-day-h') || el;
      const r = box.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
      if (r.width < min - 0.5 || r.height < min - 0.5) res.push(`${(el.getAttribute('aria-label') || el.innerText || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return [...new Set(res)];
  }, min);
  check(!small.length, severity, run, screen, `targets at least ${min}px (${criterion})${small.length ? `: ${small.length} too small, e.g. ${small.slice(0, 6).join('; ')}` : ''}`);
}

/**
 * Tab (or Shift+Tab) through the page from where focus is now. Checks every stop has a focus ring and
 * is on screen, that focus never sticks (a trap), and returns the stops in order.
 */
async function sweep(page, run, screen, { max = 120, back = false, stopAt } = {}) {
  const stops = [];
  let stuck = 0;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    // About 30 presses a second, like holding Tab down: the timeline draws days as they come near,
    // one frame after they scroll into range, so presses faster than a frame can skip undrawn days.
    await page.waitForTimeout(35);
    const f = await page.evaluate(focusInfo);
    if (f.tag === 'body') break;
    if (stops.length && stops[stops.length - 1].key === f.key) { if (++stuck > 2) break; continue; }
    if (stops.some((s) => s.key === f.key)) break; // wrapped around
    stops.push(f);
    if (stopAt && stopAt.test(f.name)) break;
  }
  const noRing = stops.filter((s) => !s.ring);
  check(!noRing.length, 'serious', run, screen, `visible focus on every Tab stop (2.4.7)${noRing.length ? `: none on ${noRing.slice(0, 5).map((s) => `${s.tag} "${s.name}"`).join(', ')}` : ` (${stops.length} stops)`}`);
  const off = stops.filter((s) => !s.inView);
  check(!off.length, 'serious', run, screen, `focused control scrolled into view${off.length ? `: off screen ${off.slice(0, 3).map((s) => s.name).join(', ')}` : ''}`);
  const hidden = stops.filter((s) => s.covered);
  check(!hidden.length, 'info', run, screen, `focused control not covered by sticky bars (2.4.11, WCAG 2.2)${hidden.length ? `: ${hidden.length} covered, e.g. "${hidden[0].name}" under .${hidden[0].covered}` : ''}`);
  check(stuck <= 2, 'serious', run, screen, 'no keyboard trap (2.1.2)');
  return stops;
}

const statusText = (page) => page.locator('main [role=status]').allInnerTexts().then((a) => a.join(' | '));
const h1 = (page, re) => page.getByRole('heading', { level: 1, name: re });

async function scanFolder(page, dir, viaKeyboard = false) {
  const go = viaKeyboard
    ? async () => { await page.getByRole('button', { name: /Sort my recovered files|Choose the folder again/ }).first().focus(); await page.keyboard.press('Enter'); }
    : () => page.getByRole('button', { name: /Sort my recovered files|Choose the folder again/ }).first().click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), go()]);
  await chooser.setFiles(dir);
}

/**
 * The privacy page and the PhotoRec guide (T67), opened from the start screen and back: focus on
 * the page's heading, axe, targets, no side scroll; by keyboard, a Tab sweep too. The guide's
 * same-page links must lead to a heading on it.
 */
const INFO = [
  { link: `How ${APP_NAME} keeps your photos private`, h1: /^Your privacy$/, screen: 'privacy page' },
  { link: 'Read the step-by-step PhotoRec guide', h1: /^Get your photos back/, screen: 'PhotoRec guide' },
];
async function infoPages(page, run, { min = 24, severity = 'minor', criterion = '2.5.8, WCAG 2.2', keyboard = false } = {}) {
  for (const { link, h1: name, screen } of INFO) {
    const open = page.getByRole('button', { name: link });
    check(await open.isVisible().catch(() => false), 'serious', run, 'start', `"${link}" link on the start screen`);
    if (keyboard) { await open.focus(); await page.keyboard.press('Enter'); } else await open.click();
    const shown = await h1(page, name).waitFor({ timeout: 5000 }).then(() => true, () => false);
    check(shown, 'serious', run, screen, 'opens from the start screen');
    if (!shown) continue;
    await focusOnHeading(page, run, screen);
    await axe(page, run, screen);
    await targets(page, run, screen, min, severity, criterion);
    const top = await page.evaluate(() => scrollY);
    check(top === 0, 'minor', run, screen, `opens at the top of the page (scrollY ${top})`);
    if (keyboard) {
      // Focus starts on the h1: Tab goes on through the page to the bottom "Back to start",
      // Shift+Tab goes back to the one above the heading.
      const stops = await sweep(page, run, screen, { max: 60 });
      check(stops.at(-1)?.name === 'Back to start', 'serious', run, screen, `Tab from the heading reaches "Back to start" at the bottom (${stops.map((st) => st.name).join(' → ')})`);
      await page.locator('main h1').focus();
      await page.keyboard.press('Shift+Tab');
      const up = await page.evaluate(focusInfo);
      check(up.name === 'Back to start' && up.ring && up.inView, 'serious', run, screen, `Shift+Tab from the heading reaches "Back to start" at the top ("${up.name}")`);
    }
    // Same-page links (the guide's "Now go to Part 5" and so on) lead to a heading, which gets focus.
    const links = await page.locator('.doc a[href^="#"]').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href'), ok: !!document.getElementById(a.getAttribute('href').slice(1)) })));
    if (links.length) {
      check(links.every((l) => l.ok), 'serious', run, screen, `same-page links lead somewhere (${links.filter((l) => !l.ok).map((l) => l.href).join(', ') || `${links.length} links`})`);
      const a = page.locator('.doc a[href^="#"]').last();
      if (keyboard) { await a.focus(); await page.keyboard.press('Enter'); } else await a.click();
      await page.waitForTimeout(200);
      const at = await page.evaluate(() => { const t = document.getElementById(location.hash.slice(1)); const r = t?.getBoundingClientRect(); return { tag: t?.tagName, inView: !!r && r.top >= -1 && r.top < innerHeight, focused: document.activeElement === t }; });
      check(at.inView && /^H[23]$/.test(at.tag ?? ''), 'serious', run, screen, `a same-page link scrolls to its heading (${at.tag}, in view ${at.inView})`);
      check(at.focused, 'minor', run, screen, 'a same-page link moves focus to its heading');
    }
    // T83: the guide ends with a primary "Sort my recovered files" button, back to the start screen.
    const cta = page.getByRole('button', { name: 'Sort my recovered files' });
    if (/guide/.test(screen)) check((await cta.count()) === 1, 'serious', run, screen, 'guide ends with "Sort my recovered files"');
    const back = /guide/.test(screen) ? cta : page.getByRole('button', { name: 'Back to start' }).last();
    if (keyboard) { await back.focus(); await page.keyboard.press('Enter'); } else await back.click();
    await h1(page, /Recovered photos/).waitFor({ timeout: 5000 });
    await focusOnHeading(page, run, `start (back from the ${screen})`);
  }
}

async function newPage(browser, run, ctx) {
  const context = await browser.newContext({ bypassCSP: true, ...ctx });
  const page = await context.newPage();
  page.on('pageerror', (e) => add('minor', run, 'any', `page error: ${e.message}`));
  // The scan uses the file-input fallback (a real picker can't be automated); saving gets fakeFolder.
  await page.addInitScript(() => {
    for (const k of ['showDirectoryPicker', 'showOpenFilePicker', 'showSaveFilePicker']) { delete window[k]; delete Window.prototype[k]; }
  });
  await page.goto(base);
  await page.waitForLoadState('networkidle');
  return page;
}

// ---------------------------------------------------------------------------------------------
// Runs

/** Every screen and state, by mouse, with axe on each (desktop). */
async function desktop(browser) {
  const run = 'desktop';
  const page = await newPage(browser, run, { viewport: { width: 1280, height: 900 } });
  await axe(page, run, 'start');
  await targets(page, run, 'start', 24, 'minor', '2.5.8, WCAG 2.2');
  await infoPages(page, run);
  const liveBefore = await page.locator('main [role=status]').count();

  await scanFolder(page, emptyDir);
  await page.locator('.note-box').waitFor();
  await axe(page, run, 'start: empty folder note');
  check(liveBefore > 0, 'serious', run, 'start: empty folder note',
    `"This folder is empty" is announced (4.1.3): the status region ${liveBefore ? 'existed' : 'did not exist'} before the note was put in it`);

  // Scanning, then Stop.
  await scanFolder(page, fixture);
  const scanning = await h1(page, /Checking your files|Looking for exact copies/).waitFor({ timeout: 10_000 }).then(() => true, () => false);
  if (scanning) {
    await focusOnHeading(page, run, 'scanning');
    const said = new Set();
    for (let i = 0; i < 6; i++) { said.add(await statusText(page).catch(() => '')); await page.waitForTimeout(150); }
    await axe(page, run, 'scanning').catch(() => add('info', run, 'scanning', 'scan ended before axe finished'));
    check([...said].some((x) => /\d+%/.test(x)), 'serious', run, 'scanning', `scan progress in a live region (4.1.3): heard ${[...said].join(' / ')}`);
    const stop = page.getByRole('button', { name: 'Stop scanning' });
    if (await stop.isVisible().catch(() => false)) {
      await stop.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(50);
      const f = await page.evaluate(() => document.activeElement?.tagName);
      if (await h1(page, /Checking|Looking/).isVisible().catch(() => false)) check(f !== 'BODY', 'minor', run, 'scanning', `focus kept after pressing Stop (2.4.3), went to ${f}`);
      const stopped = await page.getByText(/Scan stopped/).waitFor({ timeout: 30_000 }).then(() => true, () => false);
      if (stopped) {
        await focusOnHeading(page, run, 'start: scan stopped');
        await axe(page, run, 'start: scan stopped');
      } else add('info', run, 'scanning', 'scan finished before Stop took effect');
    }
  } else add('info', run, 'scanning', 'scan finished before the scanning screen could be checked');

  // A folder with nothing worth keeping.
  if (!(await page.getByRole('button', { name: 'Sort my recovered files' }).isVisible().catch(() => false))) await page.goto(base);
  await scanFolder(page, junkDir);
  await h1(page, /didn’t find any photos/).waitFor({ timeout: 30_000 });
  await focusOnHeading(page, run, 'results: nothing to keep');
  await axe(page, run, 'results: nothing to keep');
  await page.getByRole('button', { name: 'Sort a different folder' }).click();

  // The real fixture.
  await scanFolder(page, fixture);
  await page.getByText('Files checked').waitFor({ timeout: 120_000 });
  await page.waitForTimeout(800);
  await focusOnHeading(page, run, 'results');
  await axe(page, run, 'results');
  await targets(page, run, 'results', 24, 'minor', '2.5.8, WCAG 2.2');
  const groups = page.locator('.group-head');
  for (let i = 0; i < (await groups.count()); i++) {
    await groups.nth(i).click();
    await axe(page, run, `results: group ${i + 1} open`);
    // 2.5.3: the accessible name should start with the visible label (the group's title).
    const name = (await groups.nth(i).ariaSnapshot()).match(/"(.*)"/)?.[1] ?? '';
    const title = (await groups.nth(i).locator('.group-text > span').first().innerText()).trim();
    check(name.toLowerCase().startsWith(title.toLowerCase()), 'minor', run, 'results: group row', `name starts with the visible label (2.5.3): label "${title}", name "${name}"`);
  }
  await page.getByRole('button', { name: 'Keep these files' }).click();
  await page.waitForTimeout(200);
  check(/^Now keeping/.test(await statusText(page)), 'serious', run, 'results', 'moving a group back is announced (4.1.3)');
  await page.getByRole('button', { name: 'Set these aside again' }).click();

  // Review timeline.
  await page.getByRole('button', { name: /^Review my/ }).click();
  await h1(page, /Choose what to save/).waitFor();
  await page.waitForTimeout(500);
  await focusOnHeading(page, run, 'review');
  await axe(page, run, 'review');
  await targets(page, run, 'review', 24, 'minor', '2.5.8, WCAG 2.2');
  const h1name = await page.locator('main h1').ariaSnapshot();
  check(!/save\d|\dselected/.test(h1name), 'minor', run, 'review', `heading name has spaces between its parts: ${h1name.trim()}`);
  const tileNames = await page.locator('.tl-grid input[type=checkbox]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const dup = tileNames.length - new Set(tileNames).size;
  check(tileNames.every((x) => /^Save (photo|video|file) /.test(x ?? '')), 'serious', run, 'review', `every tile checkbox has a name (${tileNames.length} drawn)`);
  check(dup === 0, 'minor', run, 'review', `tile names are unique (${dup} of ${tileNames.length} repeat another tile's name)`);
  await page.locator('.tl-grid input[type=checkbox]').first().click();
  await page.waitForTimeout(1300);
  check(/selected/.test(await statusText(page)), 'serious', run, 'review', 'selection count announced (4.1.3)');
  await page.getByRole('button', { name: 'Unselect all', exact: true }).click();
  await page.waitForTimeout(1300);
  await axe(page, run, 'review: nothing selected');
  check(/Nothing selected/.test(await statusText(page)), 'serious', run, 'review: nothing selected', '"Nothing selected" announced');
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  // Filter chips carry their count: "Not selected 0" (T50/T59).
  await page.getByRole('button', { name: /^Not selected \d/ }).click();
  await axe(page, run, 'review: filter with nothing to show');
  await page.getByRole('button', { name: 'Show all' }).click();
  // T50/T59: the Screenshots and From chat apps filters, when this folder has any: pressed state,
  // "Showing N of M" said by the status line, and the page still passes axe.
  for (const name of ['Screenshots', 'From chat apps']) {
    const chip = page.getByRole('button', { name: new RegExp(`^${name} \\d`) });
    if (!(await chip.count())) continue;
    await chip.click();
    check((await chip.getAttribute('aria-pressed')) === 'true', 'serious', run, `review: ${name}`, 'filter chip says it is pressed');
    await page.waitForTimeout(300);
    check(/Showing \d[\d,]* of \d/.test(await statusText(page)), 'serious', run, `review: ${name}`, `"Showing N of M" announced (${await statusText(page)})`);
    await axe(page, run, `review: ${name} filter`);
  }
  await page.getByRole('button', { name: /^All \d/ }).click();

  // Save: the picker fails, then a slow folder, Stop, a full drive, a broken drive, lost permission, done.
  await page.evaluate(fakeFolder);
  await page.locator('.tl-save:visible').click();
  await h1(page, /Where should we save/).waitFor();
  await focusOnHeading(page, run, 'save: choose');
  await axe(page, run, 'save: choose');
  await page.evaluate(() => { window.__pick = 'denied'; });
  await page.getByRole('button', { name: 'Choose a folder' }).click();
  await page.getByRole('alert').waitFor();
  await axe(page, run, 'save: folder refused');
  // T83: the problem is hard to miss: focus goes to its heading, at the top of the choose column.
  await page.waitForTimeout(150);
  const fAfterAlert = await page.evaluate(() => ({ id: document.activeElement?.id, text: document.activeElement?.textContent }));
  check(fAfterAlert.id === 'problem-h', 'serious', run, 'save: folder refused', `focus moves to the problem's heading (now #${fAfterAlert.id} "${fAfterAlert.text}")`);
  await page.evaluate(() => { window.__pick = 'ok'; window.__save.delay = 40; });
  await page.getByRole('button', { name: 'Choose a different folder' }).click();
  await h1(page, /Saving your photos/).waitFor();
  await focusOnHeading(page, run, 'saving');
  await page.waitForTimeout(1500);
  await axe(page, run, 'saving');
  check(/Saved \d+ of \d+/.test(await statusText(page)), 'serious', run, 'saving', `save progress in a live region: "${await statusText(page)}"`);
  await page.getByRole('button', { name: 'Stop saving' }).click();
  await h1(page, /Saving stopped/).waitFor();
  await focusOnHeading(page, run, 'save: stopped');
  await axe(page, run, 'save: stopped');
  for (const [failName, re, screen] of [['QuotaExceededError', /drive is full/, 'save: drive full'], ['InvalidStateError', /stopped partway/, 'save: broke partway'], ['NotAllowedError', /can’t save to that folder anymore/, 'save: permission lost']]) {
    await page.evaluate((n) => { window.__save.delay = 0; window.__save.failAfter = 3; window.__save.failName = n; }, failName);
    await page.getByRole('button', { name: /Save the rest|Choose the folder again/ }).click();
    await h1(page, re).waitFor();
    await focusOnHeading(page, run, screen);
    await axe(page, run, screen);
  }
  await page.evaluate(() => { window.__save.failAfter = Infinity; });
  await page.getByRole('button', { name: 'Choose the folder again' }).click();
  await h1(page, /saved\./).waitFor({ timeout: 60_000 });
  await focusOnHeading(page, run, 'done');
  await axe(page, run, 'done');
  await targets(page, run, 'done', 24, 'minor', '2.5.8, WCAG 2.2');
  // T83: "Sort another folder" goes back to the start screen.
  await page.getByRole('button', { name: 'Sort another folder' }).click();
  await h1(page, /Recovered photos/).waitFor({ timeout: 5000 });
  await focusOnHeading(page, run, 'start (after Sort another folder)');
  await axe(page, run, 'start (after Sort another folder)');
  await page.context().close();
}

/** The whole flow with the keyboard only: Tab, Shift+Tab, Enter, Space. */
async function keyboard(browser) {
  const run = 'keyboard';
  const page = await newPage(browser, run, { viewport: { width: 1280, height: 900 } });
  // The app puts focus on the h1 at load, so Tab from there goes straight into the page.
  const atLoad = await page.evaluate(() => document.activeElement?.tagName);
  ok(run, 'start', `focus at load: ${atLoad}`);
  // The skip link is the only thing before the h1, so Shift+Tab from the h1 lands on it.
  await page.keyboard.press('Shift+Tab');
  const first = await page.evaluate(focusInfo);
  check(/Skip to content/.test(first.name) && first.inView && first.ring, 'serious', run, 'start', `skip link is visible when focused (2.4.1): "${first.name}"`);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  const nextAfterSkip = await page.evaluate(focusInfo);
  check(/Sort my recovered files/.test(nextAfterSkip.name), 'minor', run, 'start', `skip link moves past the header (then Tab reaches "${nextAfterSkip.name}")`);
  await page.locator('main h1').focus();
  const startStops = await sweep(page, run, 'start');
  check(startStops.some((s) => /Sort my recovered files/.test(s.name)), 'serious', run, 'start', 'Sort my recovered files reachable by Tab');
  check(INFO.every((i) => startStops.some((s) => s.name === i.link)), 'serious', run, 'start', 'privacy page and PhotoRec guide links reachable by Tab');
  await infoPages(page, run, { keyboard: true });

  await scanFolder(page, fixture, true);
  await page.getByText('Files checked').waitFor({ timeout: 120_000 });
  await page.waitForTimeout(600);
  await focusOnHeading(page, run, 'results');
  const rStops = await sweep(page, run, 'results', { max: 80 });
  ok(run, 'results', `Tab order: ${rStops.map((s) => s.name).slice(0, 30).join(' → ')}`);
  // Open a group with Space, keep it with Enter, undo.
  const head = rStops.find((s) => / (Show|Hide)$/.test(s.name));
  check(!!head, 'serious', run, 'results', 'set-aside groups reachable by Tab');
  await page.locator('.group-head').first().focus();
  await page.keyboard.press('Space');
  check((await page.locator('.group-head').first().getAttribute('aria-expanded')) === 'true', 'serious', run, 'results', 'Space opens a group');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  check(/^Now keeping/.test(await statusText(page)), 'serious', run, 'results', 'Enter on "Keep these files" works and is announced');
  check(/Set these aside again/.test((await page.evaluate(focusInfo)).name), 'minor', run, 'results', 'focus stays on the group button after it changes');
  await page.keyboard.press('Enter');

  // To the timeline: Shift+Tab back up to Review.
  await page.locator('main h1').focus();
  await sweep(page, run, 'results (to Review)', { stopAt: /^Review my/ });
  await page.keyboard.press('Enter');
  await h1(page, /Choose what to save/).waitFor();
  await focusOnHeading(page, run, 'review');
  await page.waitForTimeout(500);
  const total = Number((await page.locator('dl.ledger dd[data-k=total]').innerText()).replace(/\D/g, ''));
  const tStops = await sweep(page, run, 'review', { max: total * 2 + 200 });
  const tiles = tStops.filter((s) => s.cls === '' && /^Save (photo|video|file) /.test(s.name)).length;
  const days = tStops.filter((s) => s.type === 'checkbox' && !/^Save /.test(s.name)).length;
  check(tiles === total, 'serious', run, 'review', `Tab reaches every photo (${tiles} of ${total} tile checkboxes, ${days} day checkboxes; lazy drawing must not skip any)`);
  const order = tStops.map((s) => s.name);
  const iSave = order.findIndex((x) => /^Save my \d/.test(x));
  const iTile = order.findIndex((x) => /^Save (photo|video|file) /.test(x));
  check(iSave >= 0 && iSave < iTile, 'minor', run, 'review', `Save button comes before the photos in Tab order (at ${iSave}, first photo at ${iTile})`);
  ok(run, 'review', `Tab order start: ${order.slice(0, 22).join(' → ')}`);
  ok(run, 'review', `${total} photos means about ${total + days} Tab stops to get past them; the month jump buttons and "Jump to a month" are the only shortcuts`);
  // Space toggles a photo; Space on a day.
  await page.locator('.tl-grid input[type=checkbox]').first().focus();
  await page.keyboard.press('Space');
  const sel1 = Number((await page.locator('dd[data-k=selected]').innerText()).replace(/\D/g, ''));
  check(sel1 === total - 1, 'serious', run, 'review', 'Space unticks a photo');
  await page.keyboard.press('Space');
  await page.locator('.tl-day-h input').first().focus();
  await page.keyboard.press('Space');
  const sel2 = Number((await page.locator('dd[data-k=selected]').innerText()).replace(/\D/g, ''));
  check(sel2 < total, 'serious', run, 'review', 'Space unticks a day');
  await page.keyboard.press('Space');
  // Month jump with Enter puts focus on the month heading.
  const pill = page.locator('.tl-months-pills .chip').nth(1);
  if (await pill.count()) {
    await pill.focus();
    await page.keyboard.press('Enter');
    const f = await page.evaluate(() => document.activeElement?.tagName);
    check(f === 'H2', 'minor', run, 'review', `month jump moves focus to that month (${f})`);
  }
  // Disabled Save stays put.
  await page.getByRole('button', { name: 'Unselect all', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.locator('.tl-wide .tl-save').focus();
  await page.keyboard.press('Enter');
  check(await h1(page, /Choose what to save/).isVisible(), 'serious', run, 'review', 'Enter on the disabled Save does nothing');
  await page.getByRole('button', { name: 'Select all', exact: true }).focus();
  await page.keyboard.press('Enter');
  // T60: Largest first, by keyboard. Focus stays on the order button, the change is announced,
  // the list is biggest first, Space works on a row, Tab reaches every row, and back to By date.
  {
    const screen = 'review: largest first';
    const sizeBtn = page.getByRole('button', { name: 'Largest first', exact: true });
    await sizeBtn.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const f = await page.evaluate(focusInfo);
    check(f.name === 'Largest first' && f.inView, 'serious', run, screen, `focus stays on the order button after switching ("${f.name}", in view: ${f.inView})`);
    check((await sizeBtn.getAttribute('aria-pressed')) === 'true', 'serious', run, screen, 'order button says it is pressed');
    check(/Showing largest first/.test(await statusText(page)), 'serious', run, screen, `new order announced (4.1.3): "${await statusText(page)}"`);
    await axe(page, run, screen);
    const unit = { bytes: 1, byte: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 };
    const sizes = (await page.locator('.tl-row input[type=checkbox]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? '')))
      .map((x) => { const m = x.match(/^([\d.,]+) (bytes?|KB|MB|GB|TB)(?:, [^]*?)?\. Save /); return m ? Number(m[1].replace(/,/g, '')) * unit[m[2]] : NaN; });
    check(sizes.length > 0 && sizes.every((x, k) => !Number.isNaN(x) && (k === 0 || x <= sizes[k - 1])), 'serious', run, screen, `rows named size first and listed biggest first (${sizes.length} drawn)`);
    const bytesBefore = await page.locator('dd[data-k=size]').innerText();
    await page.locator('.tl-row input[type=checkbox]').first().focus();
    await page.keyboard.press('Space');
    const selR = Number((await page.locator('dd[data-k=selected]').innerText()).replace(/\D/g, ''));
    const bytesAfter = await page.locator('dd[data-k=size]').innerText();
    check(selR === total - 1 && bytesAfter !== bytesBefore, 'serious', run, screen, `Space unticks a row; ledger and size follow (${selR} of ${total}, ${bytesBefore} → ${bytesAfter})`);
    await page.waitForTimeout(1300);
    check(/to save\./.test(await statusText(page)), 'minor', run, screen, `size to save announced with the count: "${await statusText(page)}"`);
    await page.keyboard.press('Space');
    await sizeBtn.focus();
    const rStops = await sweep(page, run, screen, { max: total * 2 + 200 });
    const rows = rStops.filter((s) => /^[\d.,]+ (bytes?|KB|MB|GB|TB)(?:, [^]*?)?\. Save /.test(s.name)).length;
    check(rows === total, 'serious', run, screen, `Tab reaches every row (${rows} of ${total}; lazy drawing must not skip any)`);
    const dateBtn = page.getByRole('button', { name: 'By date', exact: true });
    await dateBtn.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const f2 = await page.evaluate(focusInfo);
    check(f2.name === 'By date' && f2.inView, 'serious', run, screen, `focus stays on "By date" after switching back ("${f2.name}")`);
    check((await page.locator('.tl-grid').count()) > 0 && /Showing by date/.test(await statusText(page)), 'serious', run, screen, 'back to the date view, announced');
  }
  await page.evaluate(fakeFolder);
  await page.locator('.tl-wide .tl-save').focus();
  await page.keyboard.press('Enter');
  await h1(page, /Where should we save/).waitFor();
  await focusOnHeading(page, run, 'save: choose');
  const sStops = await sweep(page, run, 'save: choose');
  ok(run, 'save: choose', `Tab order: ${sStops.map((s) => s.name).join(' → ')}`);
  await page.getByRole('button', { name: 'Choose a folder' }).focus();
  await page.keyboard.press('Enter');
  await h1(page, /saved\./).waitFor({ timeout: 60_000 });
  await focusOnHeading(page, run, 'done');
  const dStops = await sweep(page, run, 'done');
  check(dStops.some((s) => /Save receipt/.test(s.name)) && dStops.some((s) => /^Print/.test(s.name)), 'serious', run, 'done', `receipt buttons reachable (${dStops.map((s) => s.name).join(' → ')})`);
  check(dStops.some((s) => s.name === 'Sort another folder'), 'serious', run, 'done', 'Sort another folder reachable by Tab');
  const back = await sweep(page, run, 'done (Shift+Tab)', { back: true });
  check(back.length >= dStops.length - 1, 'minor', run, 'done', `Shift+Tab goes back through the same stops (${back.length} vs ${dStops.length})`);
  await page.context().close();
}

/** Phone width, touch: every screen, 44px targets, zip saving. Also used for 320px reflow. */
async function narrow(browser, run, viewport, ctx = {}) {
  const page = await newPage(browser, run, { viewport, hasTouch: true, isMobile: true, ...ctx });
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  const min = run === 'phone' ? 44 : 24;
  const crit = run === 'phone' ? '2.5.5 AAA / project rule 44px on phones' : '2.5.8';
  const sev = run === 'phone' ? 'serious' : 'minor';
  if (run === 'phone') ok(run, 'any', `pointer: coarse = ${coarse}`);
  await axe(page, run, 'start');
  await targets(page, run, 'start', min, sev, crit);
  await infoPages(page, run, { min, severity: sev, criterion: crit });
  await scanFolder(page, fixture);
  await page.getByText('Files checked').waitFor({ timeout: 120_000 });
  await page.waitForTimeout(600);
  await axe(page, run, 'results');
  await targets(page, run, 'results', min, sev, crit);
  await page.locator('.group-head').first().click();
  await axe(page, run, 'results: group open');
  await targets(page, run, 'results: group open', min, sev, crit);
  await page.getByRole('button', { name: /^Review my/ }).click();
  await h1(page, /Choose what to save/).waitFor();
  await page.waitForTimeout(500);
  await axe(page, run, 'review');
  await targets(page, run, 'review', min, sev, crit);
  await page.getByRole('button', { name: 'Unselect all', exact: true }).click();
  await axe(page, run, 'review: nothing selected');
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.locator('.tl-save:visible').click();
  await h1(page, /Where should we save/).waitFor();
  await axe(page, run, 'save: choose (zip)');
  await targets(page, run, 'save: choose (zip)', min, sev, crit);
  await page.getByRole('button', { name: /^Download (zip file|\d+ zip files)$/ }).click();
  await h1(page, /saved\./).waitFor({ timeout: 120_000 });
  await axe(page, run, 'done (zip)');
  await targets(page, run, 'done (zip)', min, sev, crit);
  await page.context().close();
}

/** Forced colours (Windows High Contrast) and reduced motion. */
async function forced(browser) {
  const run = 'forced-colors';
  const page = await newPage(browser, run, { viewport: { width: 1280, height: 900 }, forcedColors: 'active', reducedMotion: 'reduce' });
  check(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), 'info', run, 'any', 'forced colours emulated');
  const motion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Warmth: with reduced motion nothing animates, not even the start screen's entrance.
  const startAnims = await page.evaluate(() => document.getAnimations().length + [...document.querySelectorAll('main, main *')].filter((e) => getComputedStyle(e).animationName !== 'none').length);
  check(motion && startAnims === 0, 'serious', run, 'start', `reduced motion: no animation on the start screen (2.3.3 AAA / project rule): ${startAnims} running or set`);
  await page.screenshot({ path: `${out}/${run}-start.png`, fullPage: true });
  await scanFolder(page, fixture);
  if (await h1(page, /Checking|Looking/).waitFor({ timeout: 10_000 }).then(() => true, () => false)) {
    const bar = await page.evaluate(() => { const p = document.querySelector('progress'); return p ? `${getComputedStyle(p).borderTopWidth} ${getComputedStyle(p).forcedColorAdjust}` : ''; });
    check(bar && (!bar.startsWith('0px') || bar.endsWith('none')), 'minor', run, 'scanning', `progress bar visible in forced colours (border/adjust: ${bar})`);
    await page.screenshot({ path: `${out}/${run}-scanning.png` });
  }
  await page.getByText('Files checked').waitFor({ timeout: 120_000 });
  // Warmth: the big number shows its final value at once (no count-up), and nothing else animates.
  const count = await page.evaluate(() => ({ live: document.querySelector('main h1 .count-live')?.textContent, sr: document.querySelector('main h1 .sr-only')?.textContent, anims: document.getAnimations().length }));
  check(!!count.live && count.live === count.sr && count.anims === 0, 'serious', run, 'results', `reduced motion: the number shows ${count.live} at once (final ${count.sr}), ${count.anims} animations running`);
  await page.waitForTimeout(600);
  const tr = await page.evaluate(() => [...document.querySelectorAll('.strip > div')].map((e) => getComputedStyle(e).transitionDuration));
  check(motion && tr.every((d) => d === '0s'), 'serious', run, 'results', `reduced motion turns transitions off (2.3.3 AAA / project rule): ${[...new Set(tr)].join(',')}`);
  await page.screenshot({ path: `${out}/${run}-results.png`, fullPage: true });
  await page.getByRole('button', { name: /^Review my/ }).click();
  await h1(page, /Choose what to save/).waitFor();
  await page.waitForTimeout(500);
  await page.locator('.tl-tile').nth(1).locator('input').click();
  await page.mouse.move(0, 0);
  const st = await page.evaluate(() => {
    const look = (e) => { const c = getComputedStyle(e); return `${c.backgroundColor} ${c.boxShadow} ${c.borderTopWidth} ${c.borderTopColor} ${c.color}`; };
    const dots = document.querySelectorAll('.tl-tile .dot');
    const tick = dots[0].querySelector('path');
    const save = document.querySelector('.tl-wide .tl-save');
    return {
      dotOn: look(dots[0]), dotOff: look(dots[1]),
      tickVisible: !!tick && getComputedStyle(tick).stroke !== getComputedStyle(dots[0]).backgroundColor,
      chipOn: look(document.querySelector('.tl-filter .chip[aria-pressed=true]')), chipOff: look(document.querySelector('.tl-filter .chip[aria-pressed=false]')),
      saveEdge: parseFloat(getComputedStyle(save).borderTopWidth) > 0 || getComputedStyle(save).outlineStyle !== 'none',
    };
  });
  check(st.dotOn !== st.dotOff && st.tickVisible, 'serious', run, 'review', `selected and unselected photo marks differ in forced colours, tick visible (on: ${st.dotOn}; off: ${st.dotOff}; tick ${st.tickVisible ? 'visible' : 'same colour as its circle'})`);
  check(st.chipOn !== st.chipOff, 'serious', run, 'review', `pressed filter pill differs from the others in forced colours (${st.chipOn} vs ${st.chipOff})`);
  check(st.saveEdge, 'minor', run, 'review', 'primary button has a visible edge in forced colours');
  await page.getByRole('button', { name: 'Unselect all', exact: true }).click();
  await page.mouse.move(0, 0);
  const dis = await page.evaluate(() => getComputedStyle(document.querySelector('.tl-wide .tl-save')).color);
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.mouse.move(0, 0);
  const en = await page.evaluate(() => getComputedStyle(document.querySelector('.tl-wide .tl-save')).color);
  check(dis !== en, 'minor', run, 'review', `disabled Save looks disabled in forced colours (${dis} vs ${en})`);
  await page.screenshot({ path: `${out}/${run}-review.png` });
  await page.context().close();
}

// ---------------------------------------------------------------------------------------------

// Start the server and the browser inside try/finally, so a failed launch never leaves the port held.
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'pipe', detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch { /* already gone */ } }; // the server and its children
process.once('SIGINT', () => { stopServer(); rmSync(tmp, { recursive: true, force: true }); process.exit(130); });
let browser;
try {
  await new Promise((r, j) => { server.stdout.on('data', (d) => String(d).includes(String(port)) && r()); server.on('exit', () => j(new Error(`preview server exited (port ${port} in use?)`))); });
  browser = await chromium.launch({ executablePath: exe });
  await desktop(browser);
  await keyboard(browser);
  await narrow(browser, 'phone', { width: 390, height: 844 });
  // 200% zoom on a 1280px window: half the CSS pixels, twice the density.
  await narrow(browser, 'zoom200', { width: 640, height: 450 }, { deviceScaleFactor: 2, hasTouch: false, isMobile: false });
  await narrow(browser, 'reflow320', { width: 320, height: 640 }, { hasTouch: false, isMobile: false });
  await forced(browser);
} finally {
  await browser?.close();
  stopServer();
  rmSync(tmp, { recursive: true, force: true });
}

// Page titles: each step should say where you are (2.4.2).
const titles = new Set([...names.values()].flatMap((s) => [...s]));
check(titles.size > 1, 'minor', 'all', 'page title', `title changes per step (2.4.2): seen ${[...titles].map((t) => `"${t}"`).join(', ')}`);

const order = { serious: 0, minor: 1, info: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity]);
// The same issue on several runs is listed once, with the runs that hit it.
const merged = new Map();
for (const f of findings) {
  const k = `${f.severity}|${f.screen}|${f.what.replace(/\d+ node\(s\).*$/, '')}`;
  if (merged.has(k)) merged.get(k).runs.add(f.run); else merged.set(k, { ...f, runs: new Set([f.run]) });
}
for (const f of merged.values()) console.log(`${f.severity.toUpperCase().padEnd(7)} [${[...f.runs].join(',')}] ${f.screen}: ${f.what}`);
if (process.env.A11Y_PASSES) for (const p of passes) console.log(`PASS    ${p}`);
const count = (s) => [...merged.values()].filter((f) => f.severity === s).length;
console.log(`\n${count('serious')} serious, ${count('minor')} minor, ${count('info')} info; ${passes.length} checks passed.`);
process.exit(count('serious') ? 1 : 0);
