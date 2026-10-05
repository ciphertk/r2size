// Renders the PNG app icons and the social preview from the SVG sources in scripts/brand
// (written by scripts/brand/make_brand.py). Uses Playwright's Chromium, already a dev dependency.
//   node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';

const OUTPUTS = [
  { source: 'icon-any.svg', file: 'public/icons/icon-192.png', width: 192, height: 192 },
  { source: 'icon-any.svg', file: 'public/icons/icon-512.png', width: 512, height: 512 },
  {
    source: 'icon-maskable.svg',
    file: 'public/icons/icon-maskable-512.png',
    width: 512,
    height: 512,
  },
  {
    source: 'icon-any.svg',
    file: 'public/icons/apple-touch-icon-180.png',
    width: 180,
    height: 180,
  },
  { source: 'icon-small.svg', file: 'public/icons/favicon-32.png', width: 32, height: 32 },
  { source: 'og.svg', file: 'public/og.png', width: 1200, height: 630 },
];

await mkdir('public/icons', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const { source, file, width, height } of OUTPUTS) {
  const svg = await readFile(`scripts/brand/${source}`, 'utf8');
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">` +
      svg.replace('<svg ', `<svg width="${width}" height="${height}" style="display:block" `) +
      `</body></html>`,
  );
  await page.screenshot({ path: file, omitBackground: true });
  console.log(file);
}
await browser.close();
