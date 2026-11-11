import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { cspMeta as csp, deployFiles } from './vite.deploy.ts'
import { brandHead, precacheGuard } from './vite.launch.ts'
import { APP_NAME, APP_SHORT_NAME, DESCRIPTION } from './src/brand.ts'

// `npm run build:test` (vite build --mode testbuild): the production build for usability
// sessions, in dist-test/. Same privacy lock-down and offline install, but the example-files
// button is forced off and the page title says "(test)" so sessions can be told apart.
const TEST_BUILD = 'testbuild'
// `npm run build:artifact-test` (vite build --mode artifact-test): the shareable preview page for
// usability sessions, in dist-artifact-test/. Like the artifact build, but with no example files
// and "(test)" in the title, checked the same way as the test build.
const ARTIFACT_TEST = 'artifact-test'
const isArtifact = (mode: string) => mode === 'artifact' || mode === ARTIFACT_TEST

// The app's name, install name and home-screen label come from src/brand.ts (one setting).
// Test builds keep a short, marked title ("<name> (test)") so sessions can be told apart.
const TEST_TITLE = `${APP_NAME} (test)`
const THEME = '#23596B'
const BACKGROUND = '#ECF1F0'

// The privacy lock-down (CSP) and the hosting headers live in vite.deploy.ts: one policy,
// sent both as a <meta> tag and as the `_headers` file read by Cloudflare Pages and Netlify.

// Test build only: check the page title is the marked one (brandHead(TEST_TITLE) writes it), and
// refuse to finish if the example-files code (which fetches ./sample-pack.wasm) made it into the bundle.
const testBuild = (): Plugin => ({
  name: 'keepsake-test-build',
  apply: 'build',
  transformIndexHtml: (html) => {
    if (!html.includes(`<title>${TEST_TITLE}</title>`)) throw new Error(`test build: <title>${TEST_TITLE}</title> not found in index.html`)
    return html
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
      description: DESCRIPTION,
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
      globPatterns: ['**/*.{html,js,css,woff,woff2,wasm,svg,png,webp}'], // public/ files included; the manifest is added by the plugin,
      // The launch video, its captions and the share image (public/launch/) are never cached
      // offline; precacheGuard() fails the build if sw.js lists any of them.
      globIgnores: ['launch/**'],
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
  plugins: mode === 'artifact' ? [brandHead(), react()]
    : mode === ARTIFACT_TEST ? [brandHead(TEST_TITLE), react(), testBuild()]
    : mode === TEST_BUILD ? [brandHead(TEST_TITLE), react(), csp(), offline(), installTags(), testBuild(), deployFiles(), precacheGuard()]
    : [brandHead(), react(), csp(), offline(), installTags(), deployFiles(), precacheGuard()],
  // Test builds never show the example-files button, whatever the environment says.
  define: mode === TEST_BUILD || mode === ARTIFACT_TEST ? { 'import.meta.env.VITE_SAMPLES': JSON.stringify('0') } : {},
  worker: { format: 'es' },
  // Agents' leftover worktrees (.claude/worktrees/…) hold copies of tests/ without node_modules.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
  build: isArtifact(mode)
    ? {
        outDir: mode === ARTIFACT_TEST ? 'dist-artifact-test' : 'dist-artifact',
        assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false,
        rolldownOptions: { output: { codeSplitting: false } }, // one script (the HEIC decoder is loaded lazily otherwise)
      }
    : mode === TEST_BUILD ? { outDir: 'dist-test' } : {},
}))
