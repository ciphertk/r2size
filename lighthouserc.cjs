// Lighthouse CI (architecture §9, M4-D9): the production build served by `wrangler pages dev`,
// which applies dist/_headers exactly as Cloudflare Pages will. Run with `pnpm lhci`.
// LHCI_URL=https://r2size.pages.dev pnpm exec lhci autorun audits production instead.
const base = process.env.LHCI_URL;

module.exports = {
  ci: {
    collect: {
      ...(base
        ? {}
        : {
            startServerCommand: 'pnpm exec wrangler pages dev dist --port 8788 --ip 127.0.0.1',
            startServerReadyPattern: 'Ready on',
            startServerReadyTimeout: 60000,
          }),
      url: [`${base ?? 'http://127.0.0.1:8788'}/`, `${base ?? 'http://127.0.0.1:8788'}/guide`],
      // Median of three: one run on a shared CI machine is too noisy to gate on.
      numberOfRuns: 3,
      settings: { chromeFlags: '--headless=new --no-sandbox' },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
      },
    },
    upload: { target: 'filesystem', outputDir: 'reports/lighthouse' },
  },
};
