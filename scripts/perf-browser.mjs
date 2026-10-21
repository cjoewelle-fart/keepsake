// Speed and memory of a full scan in the built app, in a real Chromium (T27).
//
//   python3 scripts/make_perf_folder.py <dir>/recovery     # ~40,000 files, ~5.3 GB (delete after)
//   npm run build
//   node scripts/perf-browser.mjs <chromium> <dir>/recovery [--runs 3] [--port 4175] [--profile <out-dir>] [--no-previews]
//   node scripts/perf-browser.mjs <chromium> <dir>/recovery --handoff   # only the seconds after picking (T52)
//
// Each run starts a fresh browser, feeds the folder through the app's folder-upload fallback
// (as scripts/e2e.mjs does), and measures: scan time (to the results screen), time to the first
// preview shown, peak JS heap of the page and of the scan worker (Chrome DevTools Protocol),
// peak memory of all browser processes (PSS from /proc, Linux only), long tasks on the page
// while scanning, and how smoothly the review timeline scrolls from top to bottom.
// --profile writes CPU profiles of the scan worker and the page (open in Chrome DevTools).
// Never downloads a browser: pass the path of an installed Chromium.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [exe, dir] = process.argv.slice(2);
if (!exe || !dir) throw new Error('usage: perf-browser.mjs <chromium> <folder> [--runs 3] [--port 4175] [--profile <out-dir>]');
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : process.argv[i + 1]; };
const RUNS = Number(opt('runs', 3));
const PORT = Number(opt('port', 4175));
const PROFILE = opt('profile', null);
// Diagnostic: every preview is a 1-pixel image, to tell picture decoding apart from the page's own work.
const NO_PREVIEWS = process.argv.includes('--no-previews');
// Only the first seconds after picking (T52): is the page responsive, does progress show, does Stop work?
const HANDOFF = process.argv.includes('--handoff');
const DEBUG_PORT = 9400 + (PORT % 100);
const MB = (b) => Math.round(b / 2 ** 20);

// --- memory of every process in the browser's tree (PSS, so shared pages are counted once) ---
function treePss(rootPid, byPid) {
  const kids = new Map();
  for (const p of readdirSync('/proc').filter((n) => /^\d+$/.test(n))) {
    try {
      const ppid = Number(readFileSync(`/proc/${p}/stat`, 'utf8').split(') ')[1].split(' ')[1]);
      (kids.get(ppid) ?? kids.set(ppid, []).get(ppid)).push(Number(p));
    } catch { /* gone */ }
  }
  let total = 0;
  const parts = {};
  const walk = (pid, type) => {
    type = byPid?.get(pid) ?? type;
    try {
      const b = Number(/^Pss:\s+(\d+)/m.exec(readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8'))[1]) * 1024;
      total += b;
      parts[type] = (parts[type] ?? 0) + b;
    } catch { /* gone */ }
    for (const k of kids.get(pid) ?? []) walk(k, type);
  };
  walk(rootPid, 'browser');
  return { total, parts };
}

// --- a raw DevTools connection, to reach the page's dedicated workers (Playwright can't) ---
async function devtools(pageUrlPrefix) {
  const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page' && t.url.startsWith(pageUrlPrefix));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0;
  const waiting = new Map();
  const workers = new Map(); // sessionId -> url
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
    if (msg.method === 'Target.attachedToTarget' && msg.params.targetInfo.type === 'worker') {
      workers.set(msg.params.sessionId, msg.params.targetInfo.url);
      send('Runtime.runIfWaitingForDebugger', {}, msg.params.sessionId);
    }
    if (msg.method === 'Target.detachedFromTarget') workers.delete(msg.params.sessionId);
  };
  // A worker that goes away mid-request never answers: give up after 5 s.
  const send = (method, params = {}, sessionId) => new Promise((ok) => {
    const k = ++id;
    const timer = setTimeout(() => { waiting.delete(k); ok({ error: 'timeout' }); }, 5000);
    waiting.set(k, (r) => { clearTimeout(timer); ok(r.result ?? { error: r.error }); });
    ws.send(JSON.stringify({ id: k, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  return { send, workers, close: () => ws.close() };
}

// --- PERF_MEMDUMP=1: Chrome's own memory breakdown (memory-infra) per process, in MB ---
async function memoryDump(cdp) {
  const events = [];
  const onData = (e) => events.push(...e.value);
  cdp.on('Tracing.dataCollected', onData);
  await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['disabled-by-default-memory-infra'], excludedCategories: ['*'], memoryDumpConfig: { triggers: [] } } });
  await cdp.send('Tracing.requestMemoryDump', { deterministic: true, levelOfDetail: 'detailed' });
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end');
  await done;
  cdp.off('Tracing.dataCollected', onData);
  const out = {};
  for (const e of events) {
    const alloc = e.ph === 'v' && e.args?.dumps?.allocators;
    if (!alloc) continue;
    const row = (out[e.pid] ??= {});
    for (const [name, d] of Object.entries(alloc)) {
      if (name.includes('/')) continue; // top-level allocators only
      const size = d.attrs?.effective_size?.value ?? d.attrs?.size?.value;
      if (size) row[name] = (row[name] ?? 0) + MB(parseInt(size, 16));
    }
  }
  return out;
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stopServer = () => { try { process.kill(-server.pid); } catch { /* already stopped */ } };
process.on('exit', stopServer);
process.on('uncaughtException', (e) => { console.error(e); process.exit(1); });
await new Promise((r) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && r()));
const URL_ = `http://localhost:${PORT}/`;

async function run(n) {
  // A local launch (not launchServer + connect), so the folder is passed by path, not uploaded.
  const browser = await chromium.launch({ executablePath: exe, args: [`--remote-debugging-port=${DEBUG_PORT}`, '--enable-precise-memory-info'] });
  const bcdp = await browser.newBrowserCDPSession();
  const rootPid = (await bcdp.send('SystemInfo.getProcessInfo')).processInfo.find((p) => p.type === 'browser').id;
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const outside = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const failed = {};
  page.on('requestfailed', (r) => { const k = `${r.url().split(':')[0]} ${r.failure()?.errorText}`; failed[k] = (failed[k] ?? 0) + 1; });
  page.on('request', (r) => { if (!/^(http:\/\/localhost:\d+|blob:|data:)/.test(r.url())) outside.push(r.url()); });
  await page.addInitScript(() => {
    for (const k of ['showDirectoryPicker', 'showOpenFilePicker', 'showSaveFilePicker']) { delete window[k]; delete Window.prototype[k]; }
    window.__lt = [];
    // Previews that failed to load (they then show "Preview unavailable").
    window.__imgErr = 0;
    const names = new Map();
    const create = URL.createObjectURL;
    URL.createObjectURL = (b) => { const u = create(b); if (b instanceof File) names.set(u, b.webkitRelativePath || b.name); return u; };
    window.__imgErrNames = [];
    addEventListener('error', (e) => { if (e.target instanceof HTMLImageElement) { window.__imgErr++; if (window.__imgErrNames.length < 2000) window.__imgErrNames.push(names.get(e.target.src) ?? e.target.src.slice(0, 30)); } }, true);
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
    // When the main heading changes (scan stages, results), by page clock.
    window.__h1 = [];
    new MutationObserver(() => {
      const t = document.querySelector('main h1')?.textContent ?? '';
      if (window.__h1.at(-1)?.[1] !== t) window.__h1.push([performance.now(), t]);
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  if (NO_PREVIEWS) await page.addInitScript(() => { URL.createObjectURL = () => 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; URL.revokeObjectURL = () => {}; });
  await page.goto(URL_);
  if (HANDOFF) { const r = await handoff(page, n); await browser.close(); return r; }
  const dt = await devtools(URL_);

  // Sample memory every 250 ms for the whole run.
  const peak = { pss: 0, page: 0, worker: 0, pssAt: '', byPhase: {} };
  let phase = 'start';
  /** Finer step within a phase, for PERF_TRACE only. */
  let step = '';
  const trace = [];
  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      const types = new Map((await bcdp.send('SystemInfo.getProcessInfo')).processInfo.map((p) => [p.id, p.type]));
      const { total: pss, parts } = treePss(rootPid, types);
      peak.byPhase[phase] = Math.max(peak.byPhase[phase] ?? 0, pss);
      if (process.env.PERF_TRACE) trace.push([Date.now(), phase, step, MB(pss), MB(parts.renderer ?? 0), MB(parts.browser ?? 0)]);
      if (pss > peak.pss) { peak.pss = pss; peak.pssAt = phase; peak.parts = Object.entries(parts).map(([k, v]) => `${k} ${MB(v)}`).join(', '); }
      const h = await dt.send('Runtime.getHeapUsage');
      if (h.usedSize > peak.page) peak.page = h.usedSize;
      for (const [s] of dt.workers) {
        const w = await dt.send('Runtime.getHeapUsage', {}, s);
        if (w.usedSize > peak.worker) peak.worker = w.usedSize;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  })();

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose recovery folder' }).click()]);
  const t0 = await page.evaluate(() => performance.now());
  const wall0 = Date.now();
  phase = 'scan';
  let profiling = [];
  if (PROFILE) {
    // The scan worker starts on first scan; profile it (and the page) as soon as it exists.
    await dt.send('Profiler.enable'); await dt.send('Profiler.start');
    profiling.push(['page', undefined]);
    page.once('worker', async () => {
      await new Promise((r) => setTimeout(r, 50));
      for (const [s, url] of dt.workers) if (!profiling.some(([, x]) => x === s)) {
        await dt.send('Profiler.enable', {}, s); await dt.send('Profiler.setSamplingInterval', { interval: 500 }, s); await dt.send('Profiler.start', {}, s);
        profiling.push([`worker-${url.split('/').pop().slice(0, 30)}`, s]);
      }
    });
  }
  await chooser.setFiles(dir);
  const tFed = await page.evaluate(() => performance.now());
  await page.getByText('Files checked').waitFor({ timeout: 30 * 60_000 });
  const tResults = await page.evaluate(() => performance.now());
  const wallScan = (Date.now() - wall0) / 1000;
  phase = 'results';
  if (PROFILE) {
    mkdirSync(PROFILE, { recursive: true });
    for (const [name, s] of profiling.filter(([, x]) => x)) {
      const r = await dt.send('Profiler.stop', {}, s);
      if (r.profile) writeFileSync(join(PROFILE, `run${n}-${name}.cpuprofile`), JSON.stringify(r.profile));
    }
  }
  // First preview actually drawn on the results screen.
  // (A preview is an <img> pointed at the file, or since T53 a small copy drawn into a <canvas>.)
  await page.waitForFunction(() => [...document.querySelectorAll('.tile img, .tile canvas')].some((i) => (i instanceof HTMLImageElement ? i.complete && i.naturalWidth > 0 : i.style.display !== 'none')), null, { timeout: 120_000, polling: 50 }).catch(() => {});
  const tFirstImg = await page.evaluate(() => performance.now());
  const h1 = await page.evaluate(() => window.__h1);
  const copiesAt = h1.find(([, t]) => /exact copies/.test(t))?.[0];
  const ledger = (await page.locator('dl.ledger dd').allInnerTexts()).slice(0, 3).join(' / ');
  const ltScan = await page.evaluate(([a, b]) => window.__lt.filter(([s]) => s >= a && s <= b), [t0, tResults]);

  // Review timeline: open it, then scroll top to bottom, one screen per step.
  const memdumps = {};
  if (process.env.PERF_MEMDUMP) memdumps.beforeReview = await memoryDump(bcdp);
  phase = 'timeline';
  const tReview0 = await page.evaluate(() => performance.now());
  await page.getByRole('button', { name: /^Review my/ }).click();
  await page.getByRole('heading', { level: 1, name: /Choose what to save/ }).waitFor();
  const tReview = await page.evaluate(() => performance.now());
  step = 'scroll';
  const scroll = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(performance.now())));
    window.scrollTo(0, 0);
    await frame();
    const start = performance.now();
    const gaps = [];
    let steps = 0;
    let last = await frame();
    while (window.scrollY + innerHeight < document.documentElement.scrollHeight - 2 && steps < 5000) {
      window.scrollBy(0, Math.round(innerHeight * 0.9));
      steps++;
      const t = await frame();
      gaps.push(t - last);
      last = t;
      await new Promise((r) => setTimeout(r, 60)); // a fast flick, not a jump
      last = await frame();
    }
    gaps.sort((a, b) => a - b);
    return {
      sec: (performance.now() - start) / 1000, steps, height: document.documentElement.scrollHeight,
      p95: gaps[Math.floor(gaps.length * 0.95)] ?? 0, max: gaps.at(-1) ?? 0, from: start,
      tiles: document.querySelectorAll('.tl-tile').length,
    };
  });
  if (PROFILE) {
    const r = await dt.send('Profiler.stop');
    if (r.profile) writeFileSync(join(PROFILE, `run${n}-page.cpuprofile`), JSON.stringify(r.profile));
  }
  const ltScroll = await page.evaluate((a) => window.__lt.filter(([s]) => s >= a), scroll.from);
  // A person stopping to look: jump to 15 places spread down the page and time until every
  // tile on screen shows its preview (or its file-type label, when there's no preview).
  step = 'jumps';
  const settle = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const PHOTO_EXT = /^(JPE?G|PNG|GIF|WEBP|BMP|HEIC|HEIF)$/;
    const H = document.documentElement.scrollHeight;
    const out = [];
    for (let k = 0; k < 15; k++) {
      window.scrollTo(0, Math.round(((k + 0.5) / 15) * (H - innerHeight)));
      const t = performance.now();
      let heic = 0;
      for (;;) {
        await frame();
        const onScreen = [...document.querySelectorAll('.tl-tile .tile')].filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
        // Done = picture shown, or a file type that never has one (videos). A photo still showing
        // its type label is waiting (its first frame, or a HEIC being decoded).
        const pending = onScreen.filter((e) => { const i = e.querySelector('img'); return i ? !(i.complete && i.naturalWidth > 0) : PHOTO_EXT.test(e.querySelector('.tile-label')?.textContent ?? ''); }); // a drawn canvas has no label
        heic = Math.max(heic, onScreen.filter((e) => e.querySelector('.tile-label')?.textContent === 'HEIC').length);
        if (onScreen.length && !pending.length) break;
        if (performance.now() - t > 60_000) { out.push({ ms: 60_000, heic, timedOut: true }); break; }
      }
      const unavailable = [...document.querySelectorAll('.tl-tile .tile-label')].filter((e) => e.title && e.getBoundingClientRect().bottom > 0 && e.getBoundingClientRect().top < innerHeight).map((e) => e.textContent);
      if (!out[k]) out.push({ ms: Math.round(performance.now() - t), heic, unavailable });
    }
    return out;
  });
  const settleMs = settle.map((x) => x.ms).sort((a, b) => a - b);
  // Let previews near the bottom load, then count what's shown.
  await page.waitForTimeout(3000);
  const shown = await page.evaluate(() => {
    window.__imgErrAtEnd = window.__imgErr;
    const pics = [...document.querySelectorAll('.tl-tile img, .tl-tile canvas')].filter((i) => i.style.display !== 'none'); // a canvas is hidden until drawn
    const size = (i) => (i instanceof HTMLImageElement ? (i.complete ? [i.naturalWidth, i.naturalHeight] : [0, 0]) : [i.width, i.height]);
    const imgs = pics.filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    // Biggest picture any drawn tile holds (T53: small copies, not the full-size photo).
    const maxPx = Math.max(0, ...pics.map((i) => Math.max(...size(i))));
    return { errNames: window.__imgErrNames, imgErrors: window.__imgErr, tiles: document.querySelectorAll('.tl-tile').length, imgs: imgs.length, loaded: imgs.filter((i) => size(i)[0] > 0).length, maxPx };
  });
  if (process.env.PERF_DUMP_ERRORS) writeFileSync(process.env.PERF_DUMP_ERRORS, shown.errNames.join('\n'));
  if (process.env.PERF_MEMDUMP) memdumps.end = await memoryDump(bcdp);
  sampling = false;
  await sampler;
  if (process.env.PERF_TRACE) writeFileSync(`${process.env.PERF_TRACE}.run${n}.tsv`, trace.map((r) => r.join('\t')).join('\n'));
  dt.close();
  await browser.close();
  const sum = (l) => l.reduce((a, [, d]) => a + d, 0);
  return {
    run: n,
    loadAvg: loadavg().map((x) => x.toFixed(1)).join(' '),
    scanSec: +((tResults - t0) / 1000).toFixed(1),
    wallScanSec: +wallScan.toFixed(1),
    feedSec: +((tFed - t0) / 1000).toFixed(1),
    checkSec: copiesAt ? +((copiesAt - t0) / 1000).toFixed(1) : null,
    copiesSec: copiesAt ? +((tResults - copiesAt) / 1000).toFixed(1) : null,
    firstPreviewSec: +((tFirstImg - t0) / 1000).toFixed(1),
    ledger,
    peakPssMB: MB(peak.pss), peakPssPhase: peak.pssAt, peakPssParts: peak.parts, peakScanPssMB: MB(peak.byPhase.scan ?? 0), peakReviewPssMB: MB(peak.byPhase.timeline ?? 0), peakPssByPhaseMB: Object.entries(peak.byPhase).map(([k, v]) => `${k} ${MB(v)}`).join(', '), peakPageHeapMB: MB(peak.page), peakWorkerHeapMB: MB(peak.worker),
    scanLongTop: ltScan.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([st, d]) => `${Math.round(d)}ms@${((st - t0) / 1000).toFixed(1)}s`).join(' '),
    scanLongTasks: ltScan.length, scanLongMaxMs: Math.round(Math.max(0, ...ltScan.map(([, d]) => d))), scanLongTotalMs: Math.round(sum(ltScan)),
    openReviewMs: Math.round(tReview - tReview0),
    scrollSec: +scroll.sec.toFixed(1), scrollSteps: scroll.steps, pageHeightPx: scroll.height,
    frameP95Ms: Math.round(scroll.p95), frameMaxMs: Math.round(scroll.max),
    scrollLongTasks: ltScroll.length, scrollLongMaxMs: Math.round(Math.max(0, ...ltScroll.map(([, d]) => d))),
    screenSettleMedMs: settleMs[7], screenSettleMaxMs: settleMs.at(-1), screensWithHeic: settle.filter((x) => x.heic).length, screensTimedOut: settle.filter((x) => x.timedOut).length, settleScreensMs: settle.map((x) => `${x.ms}${x.heic ? `(${x.heic}heic)` : ''}`).join(' '), noPreviewTilesAfterSettle: Object.entries(settle.flatMap((x) => x.unavailable ?? []).reduce((c, e) => ({ ...c, [e]: (c[e] ?? 0) + 1 }), {})).map(([e, c]) => `${c} ${e}`).join(', '),
    // Expected: one per HEIC shown (Chromium can't show HEIC, so the tile falls back to decoding it).
    previewLoadErrors: shown.imgErrors, failedLoads: Object.entries(failed).map(([k, v]) => `${v} ${k}`).join(', '),
    tilesDrawnAtEnd: shown.tiles, previewsOnScreenAtEnd: `${shown.loaded}/${shown.imgs} loaded`, largestTilePicturePx: shown.maxPx,
    errors: errors.length ? errors.slice(0, 3).join(' | ') : '', outsideRequests: outside.length,
    ...(process.env.PERF_MEMDUMP ? { memdumps } : {}),
  };
}

/**
 * The moments right after picking a folder (T52). Times count from the file input's change
 * event (when the browser hands the page the file list; listing the folder before that is the
 * browser's own work). Two passes on one page load:
 *  1. watch for WATCH_MS: the longest main-thread block (long tasks, and gaps in a 20 ms timer)
 *     and when "Checked N of M" first shows N > 0;
 *  2. pick again and press Stop as soon as the button is there: how long until the click is
 *     handled and the start screen says the scan stopped.
 */
async function handoff(page, n) {
  const WATCH_MS = 8000;
  await page.evaluate(() => {
    window.__change = [];
    addEventListener('change', () => window.__change.push(performance.now()), true);
    // A 20 ms timer: any gap much longer than that is time the page couldn't answer input.
    window.__gaps = [];
    let last = performance.now();
    setInterval(() => { const t = performance.now(); if (t - last > 60) window.__gaps.push([last, t - last]); last = t; }, 20);
    window.__firstProgress = 0;
    new MutationObserver(() => {
      if (window.__firstProgress) return;
      const p = document.querySelector('main progress');
      if (p && p.value > 0) window.__firstProgress = performance.now();
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['value'] });
  });
  const pick = async () => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose recovery folder' }).click()]);
    await chooser.setFiles(dir);
  };
  // Blocking between a and b, counting only the part of each block after a. The part before
  // (the browser building its list of 40,000 files before the change event) is reported apart:
  // the page's code can't run then.
  const block = (from, to) => page.evaluate(([a, b]) => {
    const clip = ([s, d]) => [Math.max(s, a), Math.min(s + d, b) - Math.max(s, a)];
    const lt = window.__lt.filter(([s, d]) => s + d > a && s <= b);
    const gaps = window.__gaps.filter(([s, d]) => s + d > a && s <= b);
    const after = [...lt, ...gaps].map(clip).map(([, d]) => d);
    const before = [...lt, ...gaps].filter(([s]) => s < a).map(([s]) => a - s);
    return { longMax: Math.round(Math.max(0, ...lt.map(clip).map(([, d]) => d))), longCount: lt.length, longTotal: Math.round(lt.map(clip).reduce((x, [, d]) => x + d, 0)), gapMax: Math.round(Math.max(0, ...after)), beforeChange: Math.round(Math.max(0, ...before)) };
  }, [from, to]);

  // 1. Responsiveness and first progress.
  await pick();
  const tChange = await page.evaluate(() => window.__change.at(-1));
  await page.waitForTimeout(WATCH_MS);
  const a = await block(tChange, tChange + WATCH_MS);
  const firstProgress = await page.evaluate(() => window.__firstProgress);

  // 2. Stop at once.
  const stopBtn = page.getByRole('button', { name: 'Stop scanning' });
  await stopBtn.click();
  await page.getByText('Scan stopped').waitFor({ timeout: 120_000 });
  await pick();
  const tChange2 = await page.evaluate(() => window.__change.at(-1));
  await stopBtn.click({ timeout: 120_000 });
  const tClicked = await page.evaluate(() => performance.now());
  await page.getByText('Scan stopped').waitFor({ timeout: 120_000 });
  const tStopped = await page.evaluate(() => performance.now());
  const b = await block(tChange2, tStopped);
  return {
    run: n,
    loadAvg: loadavg().map((x) => x.toFixed(1)).join(' '),
    blockMaxMs: Math.max(a.longMax, a.gapMax), longTasks: a.longCount, longTotalMs: a.longTotal,
    firstProgressSec: firstProgress ? +((firstProgress - tChange) / 1000).toFixed(2) : null,
    stopClickSec: +((tClicked - tChange2) / 1000).toFixed(2),
    stoppedSec: +((tStopped - tChange2) / 1000).toFixed(2),
    stopPassBlockMaxMs: Math.max(b.longMax, b.gapMax),
    browserListMs: a.beforeChange,
  };
}

const rows = [];
try {
  for (let n = 1; n <= RUNS; n++) {
    const r = await run(n);
    console.log(JSON.stringify(r));
    rows.push(r);
  }
} finally {
  stopServer();
}
const med = (k) => { const v = rows.map((r) => r[k]).filter((x) => typeof x === 'number').sort((a, b) => a - b); return v.length ? `${v[Math.floor((v.length - 1) / 2)]} (${v[0]}–${v.at(-1)})` : '-'; };
console.log(`\n${rows.length} runs, median (range):`);
if (HANDOFF) {
  for (const k of ['blockMaxMs', 'longTasks', 'longTotalMs', 'firstProgressSec', 'stopClickSec', 'stoppedSec', 'stopPassBlockMaxMs', 'browserListMs']) console.log(`  ${k.padEnd(18)} ${med(k)}`);
  const worst = Math.max(...rows.map((r) => Math.max(r.blockMaxMs, r.stopPassBlockMaxMs)));
  console.log(`T52 (main thread never blocked over ~200 ms after the folder arrives): ${worst <= 250 ? 'PASS' : 'FAIL'} (worst ${worst} ms; browserListMs is the browser's own listing before that)`);
  process.exit(0);
}
for (const k of ['scanSec', 'checkSec', 'copiesSec', 'firstPreviewSec', 'peakPssMB', 'peakScanPssMB', 'peakReviewPssMB', 'peakPageHeapMB', 'peakWorkerHeapMB', 'scanLongTasks', 'scanLongMaxMs', 'openReviewMs', 'scrollSec', 'frameP95Ms', 'frameMaxMs', 'scrollLongTasks', 'scrollLongMaxMs', 'screenSettleMedMs', 'screenSettleMaxMs'])
  console.log(`  ${k.padEnd(18)} ${med(k)}`);
const worst = Math.max(...rows.map((r) => r.scanSec));
console.log(`Gate 4 (40,000 files in under 5 minutes): ${worst < 300 ? 'PASS' : 'FAIL'} (slowest run ${worst}s)`);
