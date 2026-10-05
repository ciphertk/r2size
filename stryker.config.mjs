/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // pnpm's isolated node_modules hides plugins from Stryker's auto-discovery, so list them.
  plugins: [
    import.meta.resolve('@stryker-mutator/vitest-runner'),
    import.meta.resolve('@stryker-mutator/typescript-checker'),
  ],
  testRunner: 'vitest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  mutate: ['src/engine/**/*.ts', '!src/engine/__tests__/**', '!src/engine/__fixtures__/**'],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  thresholds: { high: 95, low: 90, break: 90 },
};
