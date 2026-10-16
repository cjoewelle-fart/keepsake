import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// `npm run build:test` (vite build --mode testbuild): the production build for usability
// sessions, in dist-test/. Same privacy lock-down and offline install, but the example-files
// button is forced off and the page title says "(test)" so sessions can be told apart.
const TEST_BUILD = 'testbuild'

// The app's name in one place (a rename is pending): install name and home-screen label.
const APP_NAME = 'Keepsake'
const APP_SHORT_NAME = 'Keepsake'
const THEME = '#23596B'
const BACKGROUND = '#ECF1F0'

// The privacy lock-down: the built app may only load its own files and may not
// send data to any other address. Added at build time only, because the dev
// server needs inline scripts and a live-reload connection.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const csp = (): Plugin => ({
  name: 'keepsake-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
})

// Test build only: mark the page title, and refuse to finish if the example-files code
// (which fetches ./sample-pack.wasm) made it into the bundle.
const testBuild = (): Plugin => ({
  name: 'keepsake-test-build',
  apply: 'build',
  transformIndexHtml: (html) => {
    if (!html.includes(`<title>${APP_NAME}</title>`)) throw new Error('test build: <title> not found in index.html')
    return html.replace(`<title>${APP_NAME}</title>`, `<title>${APP_NAME} (test)</title>`)
  },
  generateBundle(_, bundle) {
    for (const [name, chunk] of Object.entries(bundle)) {
      const text = chunk.type === 'chunk' ? chunk.code : typeof chunk.source === 'string' ? chunk.source : ''
      if (text.includes('sample-pack')) throw new Error(`test build: example files code found in ${name}`)
    }
  },
})

// Home-screen icon and theme colour for the installed app (not in the artifact build).
const installTags = (): Plugin => ({
  name: 'keepsake-install-tags',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '</head>',
      `  <meta name="theme-color" content="${THEME}" />\n    <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />\n  </head>`,
    ),
})

// Offline install: a web app manifest and a service worker (Workbox, generated at build time)
// that precaches the app's own built files, so after the first visit the app opens and
// scans with the network off. It has no runtime caching rules: it never fetches or stores
// anything except the files listed in its precache manifest (all same-origin), and user
// files never pass through it (they're read with the File API, not fetched).
// Updates: skipWaiting + clientsClaim, so a new deploy takes over on the next visit.
const offline = () =>
  VitePWA({
    registerType: 'autoUpdate',
    includeManifestIcons: false, // already matched by globPatterns below
    injectRegister: 'script', // an external registerSW.js file, allowed by script-src 'self'
    manifest: {
      name: APP_NAME,
      short_name: APP_SHORT_NAME,
      description: 'Sort photos recovered by PhotoRec into a clean, dated library. Works entirely on your computer.',
      theme_color: THEME,
      background_color: BACKGROUND,
      display: 'standalone',
      start_url: './',
      scope: './',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{html,js,css,woff,woff2,wasm,svg,png}'], // public/ files included; the manifest is added by the plugin,
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // the HEIC decoder worker is ~2 MB
      navigateFallback: 'index.html',
      cleanupOutdatedCaches: true,
      skipWaiting: true,
      clientsClaim: true,
      inlineWorkboxRuntime: true, // one sw.js file, no separate Workbox chunk
      sourcemap: false,
    },
  })

// `vite build --mode artifact` makes the shareable preview: everything inlined into one
// page (fonts included), and the example-files button on. The preview host applies its
// own network lock, so this build skips the meta CSP. It also has no service worker.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'artifact' ? [react()]
    : mode === TEST_BUILD ? [react(), csp(), offline(), installTags(), testBuild()]
    : [react(), csp(), offline(), installTags()],
  // The test build never shows the example-files button, whatever the environment says.
  define: mode === TEST_BUILD ? { 'import.meta.env.VITE_SAMPLES': JSON.stringify('0') } : {},
  worker: { format: 'es' },
  build: mode === 'artifact'
    ? {
        outDir: 'dist-artifact', assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false,
        rolldownOptions: { output: { codeSplitting: false } }, // one script (the HEIC decoder is loaded lazily otherwise)
      }
    : mode === TEST_BUILD ? { outDir: 'dist-test' } : {},
}))
