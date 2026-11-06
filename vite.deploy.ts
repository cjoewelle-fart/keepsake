// Build-time security headers for the hosted app (T85, D27).
//
// One CSP, used twice: as a <meta> tag in index.html (works on any host, and offline from the
// service worker's cache) and as a real HTTP header in `_headers`, the file that both Cloudflare
// Pages and Netlify read to set response headers. Change the policy here, nowhere else.
import { existsSync } from 'node:fs'
import type { Plugin } from 'vite'

// The privacy lock-down: the built app may only load its own files and may not
// send data to any other address. Added at build time only, because the dev
// server needs inline scripts and a live-reload connection.
// 'wasm-unsafe-eval' (D29) lets the HEIC decoder compile its bundled WebAssembly under the
// lock-down. It allows WebAssembly only, not JavaScript eval ('unsafe-eval' stays out), and
// the WebAssembly code is our own file, loaded under script-src 'self' like every other script.
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

/** Adds the CSP as the first tag in <head>. */
export const cspMeta = (): Plugin => ({
  name: 'keepsake-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
})

// Files that must be checked for a new version on every visit: the page, the service worker,
// the script that registers it, and the install manifest. Everything in /assets/ has a content
// hash in its name, so it can be cached for a year.
export const NO_CACHE_PATHS = ['/', '/index.html', '/sw.js', '/registerSW.js', '/manifest.webmanifest']

// Where the header CSP goes. A CSP only does anything on a page or a worker script. Workers
// started from a blob: URL (the scan and save workers, built `?worker&inline`) inherit the page's
// policy. Workers loaded from their own URL (thumb, heic) take their policy from their own
// response instead, and the page's <meta> tag never reaches them. So the header goes on the page,
// the service worker and every URL-loaded worker file the build emits, the HEIC decoder included
// (D29): its WebAssembly runs because script-src has 'wasm-unsafe-eval'.
export const CSP_PAGE_PATHS = ['/', '/index.html', '/sw.js']

/**
 * The build's worker bodies, split into plain workers and those that compile WebAssembly. Both
 * get the CSP header; the split lets the build prove the CSP still allows WebAssembly when a
 * worker needs it.
 */
export function workerPaths(files: Record<string, string>): { locked: string[]; wasm: string[] } {
  const locked: string[] = []
  const wasm: string[] = []
  for (const [name, code] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    if (!/\.worker-[^/]*\.js$/.test(name)) continue
    // The tiny "new Worker(url)" wrapper chunks run on the page; only the worker bodies matter.
    if (/^function \w+\(\w+\)\{return new Worker\(/.test(code)) continue
    ;(/\bWebAssembly\.(Module|instantiate|compile|instantiateStreaming|compileStreaming)\b/.test(code) ? wasm : locked).push(`/${name}`)
  }
  return { locked, wasm }
}

/** The HEIC decoder's worker body: it compiles WebAssembly. */
export const WASM_WORKER = /^\/assets\/heic\.worker-[^/]*\.js$/

/** The values of one CSP directive (e.g. script-src), or null if the policy doesn't set it. */
export function cspSources(csp: string, directive: string): string[] | null {
  for (const d of csp.split(';')) {
    const [name, ...values] = d.trim().split(/\s+/)
    if (name.toLowerCase() === directive) return values.map((v) => v.toLowerCase()) // CSP keywords are case-insensitive
  }
  return null
}

/**
 * Guard for the worker split and the policy. The HEIC worker must be found and recognised as
 * a WebAssembly worker (if a rebuilt decoder calls WebAssembly in a way the pattern misses, the
 * check below would stop protecting it). Any WebAssembly worker needs 'wasm-unsafe-eval' in
 * script-src, or the header would break iPhone photo previews. 'unsafe-eval' is never allowed.
 * Returns the problems (empty = fine).
 */
export function workerSplitProblems(workers: { locked: string[]; wasm: string[] }, csp: string = CSP): string[] {
  const problems = workers.locked.filter((p) => WASM_WORKER.test(p)).map((p) => `${p} was not recognised as a WebAssembly worker`)
  if (!workers.wasm.some((p) => WASM_WORKER.test(p))) problems.push('no HEIC decoder worker found among the WebAssembly workers')
  const script = cspSources(csp, 'script-src') ?? cspSources(csp, 'default-src') ?? []
  if (workers.wasm.length && !script.includes("'wasm-unsafe-eval'")) {
    problems.push(`script-src lacks 'wasm-unsafe-eval', which blocks WebAssembly in ${workers.wasm.join(', ')}`)
  }
  if (script.includes("'unsafe-eval'")) problems.push("script-src must not allow 'unsafe-eval'")
  return problems
}

/** Worker bodies that a `_headers` file leaves without exactly one copy of the CSP (empty = fine). */
export function uncoveredWorkers(text: string, workers: { locked: string[]; wasm: string[] }, csp: string = CSP): string[] {
  return [...workers.locked, ...workers.wasm].filter((p) => {
    const set = cspFromHeaders(text, p)
    return set.length !== 1 || set[0] !== csp
  })
}

/** The `_headers` file (Cloudflare Pages and Netlify share this format). */
export function headersFile(workers: { locked: string[]; wasm: string[] }, csp: string = CSP): string {
  // One block per path, in first-seen order.
  const rules = new Map<string, [string, string][]>()
  const add = (path: string, name: string, value: string) => rules.set(path, [...(rules.get(path) ?? []), [name, value]])
  add('/*', 'X-Robots-Tag', 'noindex, nofollow')
  add('/*', 'Referrer-Policy', 'no-referrer')
  add('/*', 'X-Content-Type-Options', 'nosniff')
  add('/*', 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  for (const p of [...CSP_PAGE_PATHS, ...workers.locked, ...workers.wasm]) add(p, 'Content-Security-Policy', csp)
  for (const p of NO_CACHE_PATHS) add(p, 'Cache-Control', 'no-cache')
  add('/assets/*', 'Cache-Control', 'public, max-age=31536000, immutable')
  return [
    '# Generated by `npm run build` from vite.deploy.ts. Do not edit by hand.',
    '# Read by Cloudflare Pages and Netlify. Both hosts apply every rule whose path matches and',
    '# comma-join a header that two rules set, so Cache-Control and the CSP are never on /*.',
    ...[...rules].map(([path, hs]) => [path, ...hs.map(([k, v]) => `  ${k}: ${v}`)].join('\n')),
    '',
  ].join('\n')
}

export const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n'

/** Every Content-Security-Policy value set for `path` in a `_headers` file. */
export function cspFromHeaders(text: string, path: string): string[] {
  const out: string[] = []
  let current: string | null = null
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    if (!/^\s/.test(line)) { current = line.trim(); continue }
    const m = /^\s+Content-Security-Policy:\s*(.*)$/i.exec(line)
    if (m && current === path) out.push(m[1].trim())
  }
  return out
}

/** The content of every CSP <meta> tag in an HTML page. */
export function cspFromHtml(html: string): string[] {
  return [...html.matchAll(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/gi)].map((m) => m[1])
}

/**
 * Emits `_headers` and `robots.txt` into the build output, then checks that the header CSP
 * matches the <meta> CSP actually written into index.html. A `public/_headers` file would be
 * a second, hand-kept copy of the policy, so the build refuses it; a `public/robots.txt` that
 * already exists wins over the generated one.
 */
export const deployFiles = (): Plugin => ({
  name: 'keepsake-deploy-files',
  apply: 'build',
  generateBundle(_, bundle) {
    if (existsSync('public/_headers')) throw new Error('public/_headers found: headers are generated from vite.deploy.ts, remove it')
    const files: Record<string, string> = {}
    for (const [name, f] of Object.entries(bundle)) files[name] = f.type === 'chunk' ? f.code : typeof f.source === 'string' ? f.source : new TextDecoder().decode(f.source)
    const workers = workerPaths(files)
    if (!workers.locked.length && !workers.wasm.length) throw new Error('deploy files: no worker files found in the build')
    const problems = workerSplitProblems(workers)
    if (problems.length) throw new Error(`deploy files: ${problems.join('; ')}`)
    const headers = headersFile(workers)
    const uncovered = uncoveredWorkers(headers, workers)
    if (uncovered.length) throw new Error(`deploy files: no CSP header for ${uncovered.join(', ')}`)
    this.emitFile({ type: 'asset', fileName: '_headers', source: headers })
    if (!existsSync('public/robots.txt')) this.emitFile({ type: 'asset', fileName: 'robots.txt', source: ROBOTS_TXT })
  },
  writeBundle(_, bundle) {
    const html = bundle['index.html']
    const headers = bundle['_headers']
    if (html?.type !== 'asset' || headers?.type !== 'asset') throw new Error('deploy files: index.html or _headers missing from the build')
    const meta = cspFromHtml(String(html.source))
    for (const path of CSP_PAGE_PATHS) {
      const header = cspFromHeaders(String(headers.source), path)
      if (meta.length !== 1 || header.length !== 1 || meta[0] !== header[0] || meta[0] !== CSP) {
        throw new Error(`deploy files: CSP mismatch on ${path}\n  meta:    ${meta.join(' | ')}\n  header:  ${header.join(' | ')}`)
      }
    }
  },
})
