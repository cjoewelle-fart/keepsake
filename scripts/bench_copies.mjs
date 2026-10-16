// Times the whole scan (scanAll) in Node with different copy-check concurrency (T40).
//
//   node scripts/bench_copies.mjs [--dir D] [--files 40000] [--big 0.1] [--concurrency 1,4] [--rounds 1] [--keep]
//
// Builds a PhotoRec-like folder in a temp dir (or D): --files files, of which a --big share are
// ~3 MB JPEG-like files drawn from a few dozen byte sizes (so many same-size copy suspects,
// about 1 in 5 an exact copy). The rest are small junk files and small photos with mostly
// unique sizes. The folder is deleted afterwards unless --keep or --dir was given; with --dir
// an existing folder made by this script is reused. Files are read with async file handles,
// like the browser reads File slices, so reads really overlap.
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { open, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? dflt : args[i + 1];
};
const FILES = Number(opt('files', 40000));
const BIG_SHARE = Number(opt('big', 0.1));
const LEVELS = String(opt('concurrency', '1,4')).split(',').map(Number);
const ROUNDS = Number(opt('rounds', 1));
const givenDir = opt('dir', null);
const keep = args.includes('--keep') || !!givenDir;

// --- the engine, bundled for Node (it's TypeScript with extensionless imports) ---
async function loadEngine() {
  const out = mkdtempSync(join(tmpdir(), 'keepsake-bench-engine-'));
  await build({
    root: ROOT, logLevel: 'warn', configFile: false,
    build: { ssr: join(ROOT, 'src/engine/scan.ts'), outDir: out, emptyOutDir: true, rolldownOptions: { output: { entryFileNames: 'scan.mjs' } } },
    ssr: { noExternal: true },
  });
  return import(pathToFileURL(join(out, 'scan.mjs')).href);
}

// --- the test folder ---
const jpegHead = (w, h) => Buffer.from([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x10, ...Buffer.from('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0,
  0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1,
  0xff, 0xda, 0x00, 0x0c, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0,
]);

function makeFolder(dir) {
  mkdirSync(dir, { recursive: true });
  const nBig = Math.round(FILES * BIG_SHARE);
  const sizes = Array.from({ length: Math.max(1, Math.min(40, Math.floor(nBig / 10))) }, (_, i) => 3 * 1024 * 1024 + i * 4099);
  // Entropy-like filler without 0xFF bytes (so no stray JPEG markers before the end).
  const filler = randomBytes(sizes.at(-1)).map((b) => (b === 0xff ? 0xfe : b));
  let made = 0;
  let lastUnique = [];
  const t0 = performance.now();
  for (let i = 0; i < nBig; i++) {
    const size = sizes[i % sizes.length];
    let buf;
    if (i % 5 === 4 && lastUnique[i % sizes.length]) {
      buf = lastUnique[i % sizes.length]; // exact copy of an earlier file of this size
    } else {
      const head = jpegHead(4000, 3000);
      buf = Buffer.alloc(size);
      head.copy(buf, 0);
      filler.copy(buf, head.length, 0, size - head.length - 2);
      buf.writeUInt32BE(i, head.length + 8); // unique content, same size
      buf.writeUInt32BE(i * 2654435761 >>> 0, size - 64);
      buf[size - 2] = 0xff; buf[size - 1] = 0xd9;
      lastUnique[i % sizes.length] = buf;
    }
    writeFileSync(join(dir, `f${String(made++).padStart(8, '0')}.jpg`), buf);
  }
  for (let i = 0; made < FILES; i++) {
    const size = 2000 + ((i * 7919) % 60000) + (i % 3);
    let buf;
    if (i % 4 === 0) {
      const head = jpegHead(160, 120); // app thumbnail
      buf = Buffer.alloc(size, 0x55);
      head.copy(buf, 0);
      buf.writeUInt32BE(i, head.length + 4);
      buf[size - 2] = 0xff; buf[size - 1] = 0xd9;
    } else {
      buf = Buffer.alloc(size, 0x20);
      buf.write(`log line ${i}\n`);
    }
    writeFileSync(join(dir, `f${String(made++).padStart(8, '0')}.${i % 4 === 0 ? 'jpg' : 'txt'}`), buf);
  }
  writeFileSync(join(dir, '.bench.json'), JSON.stringify({ files: FILES, big: nBig }));
  console.log(`Made ${FILES} files (${nBig} ~3 MB) in ${((performance.now() - t0) / 1000).toFixed(1)}s at ${dir}`);
}

async function sources(dir) {
  const names = (await readdir(dir)).filter((n) => !n.startsWith('.')).sort();
  return Promise.all(names.map(async (name) => {
    const p = join(dir, name);
    const { size } = await stat(p);
    return {
      path: name, size,
      async read(start, end) {
        const len = Math.max(0, end - start);
        const buf = new Uint8Array(len);
        const fh = await open(p, 'r');
        try {
          let at = 0;
          while (at < len) {
            const { bytesRead } = await fh.read(buf, at, len - at, start + at);
            if (!bytesRead) break;
            at += bytesRead;
          }
        } finally {
          await fh.close();
        }
        return buf;
      },
    };
  }));
}

const dir = givenDir ?? mkdtempSync(join(tmpdir(), 'keepsake-bench-'));
if (!existsSync(join(dir, '.bench.json'))) makeFolder(dir);
const { scanAll } = await loadEngine();
const srcs = await sources(dir);
const info = JSON.parse(readFileSync(join(dir, '.bench.json'), 'utf8'));
console.log(`Folder: ${srcs.length} files, ${info.big} big; node ${process.version}`);

const results = [];
for (let round = 0; round < ROUNDS; round++) {
  for (const c of LEVELS) {
    let copiesStart = 0;
    let suspects = 0;
    const t0 = performance.now();
    const recs = await scanAll(srcs, {
      copyConcurrency: c,
      onProgress: (p) => { if (p.stage === 'copies' && !copiesStart) { copiesStart = performance.now(); suspects = p.total; } },
    });
    const t1 = performance.now();
    const copyStage = copiesStart ? t1 - copiesStart : 0;
    const counts = {};
    for (const r of recs) counts[r.group] = (counts[r.group] ?? 0) + 1;
    const digest = createHash('sha256').update(JSON.stringify(recs.map((r) => [r.group, r.reason, r.copyOf ?? -1]))).digest('hex').slice(0, 12);
    const row = { round: round + 1, copyConcurrency: c, totalSec: +((t1 - t0) / 1000).toFixed(1), copiesSec: +(copyStage / 1000).toFixed(1), suspects, ...counts, resultHash: digest, rssMB: Math.round(process.memoryUsage().rss / 2 ** 20) };
    results.push(row);
    console.log(JSON.stringify(row));
  }
}
console.table(results);
if (!keep) rmSync(dir, { recursive: true, force: true });
