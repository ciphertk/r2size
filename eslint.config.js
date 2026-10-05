import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const networkGlobals = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({
  name,
  message: 'R2Size makes no network requests (ADR-006).',
}));

// The engine is pure and exact: no DOM, no storage, no logging, no floating-point money (ADR-002, ADR-003).
const engineGlobals = [
  ...networkGlobals,
  ...['window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'console'].map(
    (name) => ({
      name,
      message: 'src/engine is pure: no DOM, storage or logging.',
    }),
  ),
  ...['Number', 'Math', 'parseFloat', 'parseInt', 'isNaN', 'isFinite'].map((name) => ({
    name,
    message: 'src/engine uses exact BigInt fractions only (ADR-002).',
  })),
];

const engineSyntax = [
  {
    selector: "CallExpression[callee.property.name='toFixed']",
    message: 'toFixed rounds floats. Use decimal.ts (ADR-002).',
  },
  {
    selector: 'Literal[raw=/^[0-9]*[.][0-9]+$/]',
    message: 'No floating-point literals in src/engine. Parse a decimal string instead (ADR-002).',
  },
  {
    selector: 'ThrowStatement',
    message: 'computeSizing must be total: return a FieldError instead of throwing.',
  },
];

export default tseslint.config(
  { ignores: ['node_modules/', 'coverage/', 'reports/', '.stryker-tmp/', 'dist/', 'design/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{js,mjs,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...networkGlobals],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'sendBeacon', message: 'No network requests (ADR-006).' },
      ],
    },
  },
  {
    files: ['src/engine/**/*.ts'],
    ignores: ['src/engine/__tests__/**'],
    rules: {
      'no-restricted-globals': ['error', ...engineGlobals],
      'no-restricted-syntax': ['error', ...engineSyntax],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '^[^.]', message: 'src/engine has no dependencies.' },
            {
              regex: '^[.][.]/[.][.]/',
              message: 'src/engine must not import from outside src/engine.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/engine/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '^[^.]', message: 'src/engine has no dependencies.' },
            { regex: '^[.][.]/', message: 'src/engine must not import from outside src/engine.' },
          ],
        },
      ],
    },
  },
);
