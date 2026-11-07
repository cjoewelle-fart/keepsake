// Writes public/THIRD_PARTY_NOTICES.txt (copied into dist/ by Vite) with the licence text of
// every runtime dependency shipped in the app. Texts come verbatim from node_modules, except
// libde265 and zlib, which are compiled into libheif-js's WebAssembly without their own licence
// files: their upstream texts are kept in licenses/ (see the source URLs below).
// Usage: npm run notices   (re-run after adding or upgrading a runtime dependency)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').trimEnd();
const meta = (name) => JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8'));

/** Runtime packages: our direct dependencies plus their own runtime dependencies. */
const names = new Set();
const add = (name) => {
  if (names.has(name)) return;
  names.add(name);
  for (const d of Object.keys(meta(name).dependencies ?? {})) add(d);
};
for (const d of Object.keys(pkg.dependencies)) add(d);
// Workbox is a build-time package, but its code is bundled into the offline service worker (sw.js).
for (const d of ['workbox-core', 'workbox-precaching', 'workbox-routing', 'workbox-strategies']) add(d);

const RULE = '='.repeat(78);
const sections = [];
for (const name of [...names].sort()) {
  const m = meta(name);
  // Apache-2.0 §4(d): a package's NOTICE file goes along with it (Paper Shaders has one).
  const files = name === 'libheif-js' ? ['LICENSE', 'libheif-wasm/LICENSE'] : existsSync(`node_modules/${name}/NOTICE`) ? ['LICENSE', 'NOTICE'] : ['LICENSE'];
  const note = name === 'libheif-js'
    ? 'Used unmodified. Contains libheif (LGPL-3.0) compiled to WebAssembly; libheif-js/LICENSE is the\nLGPL-3.0 text, libheif-wasm/LICENSE is libheif\'s own licence file (LGPL-3.0, GPL-3.0, MIT).\nSource: https://github.com/catdad-experiments/libheif-js and https://github.com/strukturag/libheif'
    : undefined;
  sections.push([
    RULE,
    `${name} ${m.version}`,
    `License: ${m.license}`,
    ...(note ? [note] : []),
    RULE,
    ...files.map((f) => `--- ${name}/${f} ---\n\n${read(`node_modules/${name}/${f}`)}`),
  ].join('\n'));
}

sections.push([
  RULE,
  'libde265 (bundled inside libheif-js 1.23.2 as the HEVC decoder; version string 1.0.15)',
  'License: LGPL-3.0',
  'Copyright (c) 2013-2014 Struktur AG; Copyright (c) 2013-2026 Dirk Farin (from the upstream README)',
  'Source: https://github.com/strukturag/libde265 (COPYING, copied below unchanged)',
  RULE,
  read('licenses/libde265-COPYING'),
].join('\n'));

sections.push([
  RULE,
  'zlib (may be linked into libheif-js 1.23.2)',
  'License: Zlib',
  'Source: https://github.com/madler/zlib (LICENSE, copied below unchanged)',
  RULE,
  read('licenses/zlib-LICENSE'),
].join('\n'));

const out = `Keepsake: third-party notices

Keepsake ships the following third-party software in the app. Each is listed with its version,
licence and full licence text. Nothing here is fetched at runtime.

${sections.join('\n\n\n')}
`;
writeFileSync('public/THIRD_PARTY_NOTICES.txt', out);
console.log(`wrote public/THIRD_PARTY_NOTICES.txt: ${names.size} packages + libde265 + zlib, ${out.length} bytes`);
