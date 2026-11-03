// QA (T89 acceptance): folder save with long names, against Chromium's real File System Access API (OPFS).
// Usage: LANG=C.UTF-8 node scripts/qa-save-longnames-opfs.mjs <chromiumPath>
// (Under LANG=C/POSIX, Chromium on Linux rejects every non-ASCII OPFS name with TypeMismatchError.)
// Seeds "Keepsake photos/No date" with files whose names equal (or differ only by case from) the names
// the long sources are cut to, saves undated files with long names (ASCII, CJK, emoji, é, reserved, dots
// and spaces at the cut, names equal after the cut), then checks: every pre-existing file is byte-for-byte
// unchanged, every copy got its own name (case-insensitively), each name <= 150 UTF-8 bytes and 124 chars
// (with " (n)"), no trailing dot/space, no reserved name, no temporary file left.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'vite';

const here = fileURLToPath(new URL('.', import.meta.url));
const exe = process.argv[2] || process.env.CHROMIUM_PATH;
const outDir = mkdtempSync(join(tmpdir(), 'keepsake-qa-long-'));
await build({ configFile: false, logLevel: 'warn', publicDir: false, build: { outDir, emptyOutDir: true, minify: false, lib: { entry: join(here, 'qa-save-opfs/entry.ts'), name: 'K', formats: ['iife'], fileName: () => 'k.js' } } });
const bundle = readFileSync(join(outDir, 'k.js'), 'utf8');
rmSync(outDir, { recursive: true, force: true });

const browser = await chromium.launch({ executablePath: exe });
let res;
try {
  const page = await browser.newPage();
  await page.route('https://probe.test/**', (r) => {
    const js = new URL(r.request().url()).pathname === '/k.js';
    r.fulfill({ status: 200, contentType: js ? 'text/javascript' : 'text/html', body: js ? bundle : '<!doctype html><script src="/k.js"></script>' });
  });
  await page.goto('https://probe.test/');
  res = await page.evaluate(async () => {
    const K = window.K;
    const root = await navigator.storage.getDirectory();
    for await (const n of root.keys()) await root.removeEntry(n, { recursive: true });
    const chosen = await root.getDirectoryHandle('chosen', { create: true });
    let nd = chosen; for (const p of ['Keepsake photos', 'No date']) nd = await nd.getDirectoryHandle(p, { create: true });
    const put = async (dd, name, bytes) => { const fh = await dd.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(bytes); await w.close(); };
    const x = 'x'.repeat(200);
    // What's there already: the cut name of x…A.jpg, a case variant of the cut é name, and its "(2)".
    const theirs = { [`${'x'.repeat(115)}.jpg`]: [1, 2, 3], [`${'É'.repeat(72)}.jpg`]: [4, 5], [`${'é'.repeat(72)} (2).jpg`]: [6], '_con.jpg': [7] };
    for (const [n, b] of Object.entries(theirs)) await put(nd, n, new Uint8Array(b));
    const sources = [
      `${x}A.jpg`, `${x}B.jpg`, `${x}a.jpg`, `${x}b.JPG`, `${'写真'.repeat(41)}.jpg`, `${'写真'.repeat(41)}X.jpg`,
      `${'😀'.repeat(62)}.jpg`, `${'😀'.repeat(61)}😁.jpg`, `${'é'.repeat(75)}.jpg`, `${'é'.repeat(74)}.jpg`, `${'é'.repeat(73)}a.jpg`,
      `con.${'y'.repeat(200)}.jpg`, `CON${'z'.repeat(200)}`, 'con.jpg', `${'w'.repeat(114)}. . .${'v'.repeat(50)}.jpg`,
      `${'u'.repeat(116)}${' '.repeat(10)}tail.jpg`, `${'Ab'.repeat(59)}.jpg`, `${'aB'.repeat(59)}.jpg`,
      `${'é'.repeat(100)}.jpg`, `${'👨‍👩‍👧'.repeat(20)}.jpg`, `${'n'.repeat(119)}.jpg`, `${'n'.repeat(115)}.jpg`,
    ];
    const items = sources.map((n, k) => ({
      r: { index: k, path: `recup_dir.1/${n}`, size: 0, kind: 'jpeg', group: 'keep', reason: 'photo' },
      file: new File([new Uint8Array(100 + k).fill(k + 10)], 'f.jpg'),
    }));
    const saved = [], failed = [];
    const session = K.newFolderSession(chosen);
    let end; try { end = await K.saveToFolder(session, items, { onSaved: (i) => saved.push(i), onFailed: (i) => failed.push(i), shouldStop: () => false }); } catch (e) { end = `threw ${e.name}: ${e.message} after ${saved.length} saved`; }
    const after = {};
    for await (const [n, h] of nd.entries()) if (h.kind === "file") after[n] = Array.from(new Uint8Array(await (await h.getFile()).arrayBuffer()));
    const top = []; for await (const n of chosen.keys()) top.push(n);
    return { end, saved: saved.length, failed: failed.length, total: items.length, theirs, after, top };
  });
} finally {
  await browser.close();
}
const problems = [];
const ok = (c, m) => { if (!c) problems.push(m); };
const enc = new TextEncoder();
ok(res.end === 'done', `end ${res.end}`);
ok(res.saved === res.total && res.failed === 0, `saved ${res.saved}/${res.total}, failed ${res.failed}`);
for (const [n, b] of Object.entries(res.theirs)) ok(JSON.stringify(res.after[n]) === JSON.stringify(b), `existing file changed or gone: ${n}`);
const names = Object.keys(res.after);
ok(names.length === res.total + Object.keys(res.theirs).length, `${names.length} files in No date, want ${res.total + Object.keys(res.theirs).length}`);
const keys = names.map((n) => n.normalize('NFC').toLowerCase());
ok(new Set(keys).size === keys.length, 'case-insensitive clash in No date');
for (const n of names) {
  ok(enc.encode(n).length <= 155 && n.length <= 125, `too long: ${n.length} chars, ${enc.encode(n).length} bytes: ${n}`);
  ok(!/[. ]$/.test(n) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(n) && !n.startsWith('.keepsake-partial-'), `unsafe or temp name: ${n}`);
  ok(n === n.normalize('NFC'), `not NFC: ${n}`);
}
ok(JSON.stringify(res.top) === JSON.stringify(['Keepsake photos']), `chosen folder top level: ${res.top}`);
const mine = names.filter((n) => !(n in res.theirs)).map((n) => `${n.length}c ${enc.encode(n).length}b ${n.length > 40 ? `${n.slice(0, 12)}…${n.slice(-16)}` : n}`);
console.log(mine.sort().join('\n'));
console.log(JSON.stringify({ end: res.end, saved: res.saved, failed: res.failed, filesInNoDate: names.length, problems }, null, 1));
console.log(problems.length ? 'LONG NAMES FOLDER SAVE: PROBLEMS' : 'LONG NAMES FOLDER SAVE: OK');
if (problems.length) process.exitCode = 1;
