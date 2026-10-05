// Stand-in for vite-plugin-pwa's `virtual:pwa-register` in unit tests (aliased in
// vitest.config.ts). The real update flow is covered by e2e/update-flow.spec.ts.
export const registerSW = () => async () => undefined;
