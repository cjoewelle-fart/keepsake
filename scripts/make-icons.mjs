// Makes the install icons (public/icons/*.png) from public/favicon.svg, drawn by Chromium.
// Usage: node scripts/make-icons.mjs [chromiumPath]   (rerun after changing the favicon)
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const exe = process.argv[2] || process.env.CHROMIUM_PATH;
const svg = readFileSync('public/favicon.svg', 'utf8');
const BG = '#F3F5F4';
mkdirSync('public/icons', { recursive: true });

// Regular icons: the glyph on a rounded light tile. Maskable: full-bleed background with the
// glyph inside the central 60% so any platform mask shape (circle, squircle) keeps it whole.
const icons = [
  { file: 'icon-192.png', size: 192, glyph: 0.72, radius: 0.22 },
  { file: 'icon-512.png', size: 512, glyph: 0.72, radius: 0.22 },
  { file: 'icon-maskable-512.png', size: 512, glyph: 0.56, radius: 0 },
  { file: 'apple-touch-icon.png', size: 180, glyph: 0.68, radius: 0 },
];

const browser = await chromium.launch({ executablePath: exe });
try {
  for (const { file, size, glyph, radius } of icons) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const g = Math.round(size * glyph);
    await page.setContent(`<html><body style="margin:0;background:transparent">
      <div style="width:${size}px;height:${size}px;background:${BG};border-radius:${radius * size}px;display:grid;place-items:center">
        <img style="width:${g}px;height:${g}px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">
      </div></body></html>`);
    await page.locator('img').evaluate((img) => img.decode());
    await page.screenshot({ path: `public/icons/${file}`, omitBackground: true });
    await page.close();
    console.log(`public/icons/${file}`);
  }
} finally {
  await browser.close();
}
