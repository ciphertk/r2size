import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Same runtime as production: React APIs on preact/compat (see vite.config.ts).
  plugins: [preact()],
  resolve: {
    alias: {
      // The PWA plugin's virtual module only exists in Vite builds; tests get a stub.
      'virtual:pwa-register': new URL('./src/infra/__tests__/pwa-register.stub.ts', import.meta.url)
        .pathname,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'engine', environment: 'node', include: ['src/engine/**/*.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'config', environment: 'node', include: ['config/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'happy-dom',
          include: ['src/{domain,state,infra,ui}/**/*.test.{ts,tsx}'],
          setupFiles: ['src/test-setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/__fixtures__/**',
        'src/main.tsx',
        'src/test-setup.ts',
      ],
      reporter: ['text', 'html'],
      // The sizing engine is the correctness gate (PRD Milestone 1): every line and branch.
      thresholds: {
        'src/engine/**/*.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
