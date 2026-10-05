import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // React APIs run on preact/compat (ADR-001 fallback): React + Base UI were 115 KB gzipped,
  // over the 90 KB budget; with Preact the same app is about 61 KB. Code still imports 'react'.
  plugins: [preact()],
  build: {
    target: 'es2022',
    // Nothing inlined as data: URLs, so the CSP can keep img-src/font-src at 'self' (architecture §1).
    assetsInlineLimit: 0,
  },
});
