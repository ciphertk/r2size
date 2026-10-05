# R2Size release checklist

Run this before and after every public deploy. Everything up to "Deploy" is automated; the device matrix at the end is the only manual part.

## Before deploying

1. `pnpm typecheck && pnpm lint && pnpm format:check`
2. `pnpm test` (unit + component)
3. `pnpm build && pnpm size` (initial JS ≤ 90 KB, CSS ≤ 15 KB, fonts ≤ 30 KB)
4. `pnpm test:e2e`, including offline, update-flow, no-network and axe, on Pixel 7, iPhone 14 and desktop
5. `pnpm lhci` (performance, accessibility and best practices ≥ 0.9 on `wrangler pages dev`)
6. If the engine changed: `pnpm test:mutation` (≥ 90%)

## Deploy (CI, with approval)

Push to `master`. CI runs check, e2e (Chromium and iPhone) and Lighthouse. When **all** are green, the `deploy` job waits in the GitHub environment **production** for the owner's approval: open the run in Actions and click **Review deployments → Approve and deploy**. It then:

1. builds and uploads to the `r2size` Cloudflare Pages project (`wrangler pages deploy`, commit hash attached);
2. checks that the live site serves this build with its security headers (`scripts/verify-production.mjs`);
3. runs the no-network spec against https://r2size.pages.dev.

A red check means no deploy is offered. Secrets: `CLOUDFLARE_API_TOKEN` (repo secret, Cloudflare Pages: Edit only) and `CLOUDFLARE_ACCOUNT_ID` (repo variable).

Manual fallback (same result, from a logged-in machine):

```bash
pnpm build
pnpm exec wrangler pages deploy dist --project-name r2size --branch master
node scripts/verify-production.mjs
```

The project already exists, so no `--force` is needed. (wrangler delegates `pages project create` for a *new* project to Workers unless `--force` is passed; that was a one-time step on 2026-10-05.)

## After deploying (CI does 1 and 2; run 3 by hand when it matters)

1. Headers are live:
   ```bash
   curl -sI https://r2size.pages.dev/ | grep -iE "content-security-policy|strict-transport|x-content-type|referrer-policy"
   curl -sI https://r2size.pages.dev/sw.js | grep -i content-security-policy   # the worker's own policy
   ```
2. Nothing leaves the device on production (also catches anything Cloudflare injects):
   ```bash
   BASE_URL=https://r2size.pages.dev pnpm exec playwright test e2e/no-network.spec.ts
   ```
3. Lighthouse on production:
   ```bash
   pnpm exec lhci collect --url=https://r2size.pages.dev/ --url=https://r2size.pages.dev/guide
   pnpm exec lhci assert
   ```

## Cloudflare dashboard (once, and after any account change)

- **Workers & Pages → r2size → Metrics:** Web Analytics must be **off** (it injects a script).
- With a custom domain only (zone settings, not on `*.pages.dev`):
  - **Speed → Optimization:** Rocket Loader **off**
  - **Scrape Shield:** Email Address Obfuscation **off**
  - **Security → Bots:** Bot Fight Mode / JS challenges **off**

## Manual device matrix

Do this on real devices; Playwright can't drive these parts.

| Device | Check |
|---|---|
| Android, Chrome | Settings → Install app works; the installed app opens standalone; airplane mode: reload, calculate, copy, Guide, export |
| iPhone, Safari | The one-time install hint shows; Share → Add to Home Screen; the installed app opens standalone; set up equity in the installed app (separate storage); airplane mode: cold launch from the home screen, calculate, copy, Guide; Export opens the share sheet |
| iPhone, after a deploy | Open the installed app online: "A new version of R2Size is ready" appears; Reload keeps the setup |
| Desktop, Chrome and Edge | Install from Settings; three-pane layout from 1100 px; ladder drag and ↑↓ keys; C/E/S/T/A copy shortcuts |

## When NSE revises tick bands

Edit `src/engine/tick-bands.ts` (bands, `effectiveFrom`, source) and the band-edge fixtures, run the full checklist, and deploy. The Guide's table updates from the same data.
