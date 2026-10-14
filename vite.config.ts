import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

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

export default defineConfig({
  base: './',
  plugins: [react(), csp()],
  worker: { format: 'es' },
})
