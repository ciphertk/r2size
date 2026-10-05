import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { headersFile, PAGE_CSP_META } from './config/security-policy';

const BACKGROUND = '#08090a';

/**
 * Production builds only (architecture §7): the CSP as a <meta> tag, and Cloudflare's `_headers`.
 * Dev keeps no CSP: `connect-src 'none'` would block Vite's hot reload.
 */
const securityPolicy = (): Plugin => ({
  name: 'r2size:security-policy',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) =>
      html.replace(
        /<meta charset="utf-8" \/>/,
        `$&\n    <meta http-equiv="Content-Security-Policy" content="${PAGE_CSP_META}" />`,
      ),
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: headersFile() });
  },
});

export default defineConfig({
  // React APIs run on preact/compat (ADR-001 fallback): React + Base UI were 115 KB gzipped,
  // over the 90 KB budget; with Preact the same app is about 61 KB. Code still imports 'react'.
  plugins: [
    preact(),
    // ADR-007: precache everything, no runtime routes, update only when the trader taps Reload.
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false, // registered from src/infra/sw.ts: no inline script
      manifestFilename: 'manifest.webmanifest',
      includeAssets: ['favicon.svg', 'icons/favicon-32.png', 'icons/apple-touch-icon-180.png'],
      manifest: {
        id: '/',
        name: 'R2Size — position size calculator',
        short_name: 'R2Size',
        description:
          'Risk-first position size calculator for Indian swing traders. Works offline; nothing leaves your device.',
        lang: 'en-IN',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: BACKGROUND,
        background_color: BACKGROUND,
        categories: ['finance'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
        globIgnores: ['og.png'], // only social previews fetch it
        // Every path is the app (unknown ones are redirected to "/" by the router), offline too.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // One worker file: no importScripts, so the worker's own CSP stays minimal.
        inlineWorkboxRuntime: true,
        runtimeCaching: [],
      },
    }),
    securityPolicy(),
  ],
  build: {
    target: 'es2022',
    // Nothing inlined as data: URLs, so the CSP can keep img-src/font-src at 'self' (architecture §1).
    assetsInlineLimit: 0,
  },
});
