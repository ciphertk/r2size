# Plan: Installable & Offline

**Source PRD**: `.claude/prds/r2size.prd.md`
**Selected Milestone**: 4 — Installable & offline ("App installs on Android, iOS and desktop and works in airplane mode; trust page live; publicly deployed")
**Complexity**: Large
**Also governed by**: `.claude/prds/r2size.architecture.md` (§6 PWA, §7 security, §8 routing and Guide, §9 M4 testing, ADR-006/007/008/009), `.claude/prds/r2size.design.md` v2 (Three-pane Workbench), the PRD decision "Unknown paths" (2026-10-05)

## Summary

Turn the working calculator into a product people can rely on:
- installable on Android, iOS and desktop, and fully usable in airplane mode after the first visit;
- updated only when the trader taps Reload, never mid-calculation;
- explained by a Guide & trust page (glossary, formulas with a live worked example, the dated tick table, the privacy promise and how to verify it);
- locked down by a strict security policy;
- carrying a redesigned brand mark: a typographic logo that doesn't look generated (it replaces the indigo "R2" square);
- published as open source on GitHub, so the Guide can link to it;
- deployed publicly on Cloudflare Pages. **The deploy step stops for your go-ahead.**

*Revised 2026-10-05 after review: you asked for a logo redesign, a public GitHub repo created with `gh`, and a step-by-step guide for anything you have to do on Cloudflare.*

## Scope

**In:**
- **Brand mark:** research, then several genuinely different typographic directions shown side by side for you to pick. The chosen mark becomes the header wordmark, favicon, app icons and social preview.
- **Source:** a public `ciphertk/r2size` GitHub repo, created and pushed with `gh`.
- **Routing:**
  - two routes, `/` and `/guide`;
  - any other path is replaced with `/`, keeping the `#v=1&…` setup (the PRD's unknown-path decision);
  - the Guide is lazy-loaded and precached.
- **Guide & trust page:**
  - **Glossary:** every input and output term, using the same IDs as the info tips.
  - **Formulas:** with a worked example computed live by the engine from the M1 fixtures.
  - **Tick bands:** the NSE table from `engine/tick-bands.ts` with its effective date and source, plus the "BSE may differ" note.
  - **Privacy:** the statement, plus how to check it in DevTools.
  - **Source code link:** see M4-D10.
- **Info tips:** each gains a "More in the Guide" link to `/guide#term-<id>`.
- **PWA:**
  - vite-plugin-pwa (`generateSW`, `registerType: 'prompt'`, `injectRegister: false`, registered from a module) with a full precache and no runtime routes;
  - a navigation fallback to `index.html` that agrees with the redirect;
  - the manifest and icons.
- **Update notice:** a non-blocking "New version available — Reload" bar. The current setup is written to the URL before reloading, and the app only reloads when the trader asks.
- **Install:**
  - **Chromium:** an "Install app" action in Settings (from `beforeinstallprompt`).
  - **iOS Safari:** a one-time "Share → Add to Home Screen" hint (`settings.installHintDismissed`, already in the stored document), which says to set up the profile after installing.
  - **Persistent storage:** requested after install.
- **Security:**
  - one policy source used for both the production `<meta>` CSP and a generated `_headers` (with its own `/sw.js` policy and cache rules);
  - `connect-src 'none'` and Trusted Types `'none'` (if it holds, see M4-D7);
  - no inline scripts or styles.
- **Tests:**
  - offline, no-network (every feature, with a CSP-violation listener) and update-flow e2e specs;
  - a manifest validity test;
  - Lighthouse CI, as a local script and a CI job.
- **Deploy:** Cloudflare Pages by direct upload with wrangler, plus a release checklist (dashboard toggles, header check, no-network spec and Lighthouse against the production URL).

**Out:**
- **Not automatable:** the manual device matrix (Android Chrome, iOS Safari install + airplane mode + cold launch, desktop Chrome/Edge). I prepare the checklist; **you** run it on real phones.
- **Not in M4:** a custom domain (it can follow later) and anything in Milestone 5.

## Decisions this plan makes (confirm or change)

| # | Question | Decision |
|---|---|---|
| M4-D1 | Unknown paths | On startup, if the path isn't `/` or `/guide`, `history.replaceState` to `/` (or `/guide` for `/guide/…` and trailing-slash variants), keeping the hash. The service worker's navigation fallback serves `index.html` for every path, so offline behaves the same |
| M4-D2 | Moving between calculator and Guide | In-app links use `pushState`, so Back returns to the calculator with its setup. The setup lives only in `/`'s hash. Opening `/guide` directly shows a "Back to calculator" link to `/` |
| M4-D3 | Where the Guide link lives | An "i" tip's popover ends with "More in the Guide →". There is also a Guide link in the header (icon button, 44 px) |
| M4-D4 | Update notice | A bar above the setup pane: "New version available." with **Reload** and a dismiss. Reload flushes the URL hash, sends `SKIP_WAITING`, and reloads on `controllerchange` only if the trader tapped. No polling: the browser checks on launch/navigation |
| M4-D5 | Install entry points | **Chromium:** "Install app" in Settings when the prompt is available. **iOS Safari, not standalone:** a one-time dismissible notice. Nothing is shown when already installed |
| M4-D6 | Icons | Generated by a committed script from **the logo you pick (M4-D13)**, drawn as SVG paths (glyph outlines via fontTools, or hand-drawn geometry), so no font is needed at runtime. Outputs: `favicon.svg`, 192, 512, maskable 512 (safe zone), `apple-touch-icon` 180 |
| M4-D7 | Trusted Types | Keep `require-trusted-types-for 'script'; trusted-types 'none'` if the offline and no-network e2e show zero violations in Chromium. Otherwise use a named policy, and I'll say which code needed it |
| M4-D8 | One security policy | `config/security-policy.ts` holds the CSP and headers. A small Vite plugin injects the `<meta>` CSP (build only; meta can't set `frame-ancestors`, and `connect-src 'none'` would break dev HMR) and writes `dist/_headers`. One source, no drift; a test checks both outputs |
| M4-D9 | Lighthouse | `@lhci/cli` against `wrangler pages dev dist` (which applies `_headers`), asserting ≥ 0.9 for performance, accessibility and best practices. It runs as `pnpm lhci` and as a CI job, and again against the production URL after deploy |
| M4-D10 | Source code | **Decided:** I create a **public** repo `github.com/ciphertk/r2size` with `gh repo create` and push `master`, together with the M4 work. GitHub Actions CI starts running there. Before the push I scan for secrets and personal data. The repo contains `src/`, tests, configs and `.claude/` (PRD, architecture, design doc, plans); the untracked skill folders (`.agents/`, `.claude/skills/`, `skills-lock.json`) are not pushed. The Guide links to the repo |
| M4-D11 | Deploy | Cloudflare Pages **direct upload** (`wrangler pages deploy dist --project-name r2size`), giving `r2size.pages.dev`. I keep direct upload even with a GitHub repo: Git integration would publish every push automatically, while direct upload keeps each release a deliberate step. **Your steps** are in "Cloudflare: what you do" below |
| M4-D13 | Brand mark | Research first (typographic marks from trading terminals, Swiss/type-led brand systems, ticker and order-ticket typography), then 5–6 directions on one comparison page, each shown at 16 px favicon, 180 px app icon, header wordmark and on light and dark. Each direction has a named idea, not a style. **Banned:** gradient blobs, glowing letters, an "R2" in a rounded square, generic sparkle or arrow-up-chart marks, initials in a circle. You pick; I refine the pick |
| M4-D12 | Manifest colours | `theme_color` / `background_color` are `#08090a` (the design-doc v2 background; the architecture's `#121110` is v1). The architecture doc is updated to match |

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Naming | `src/infra/url-hash.ts:1`, `src/infra/persist.ts:1`, `src/ui/calculator/CalculatorScreen.tsx` | kebab-case `infra/` modules that wrap one browser API; PascalCase component files with a sibling `.module.css` |
| Errors | `src/infra/persist.ts:3`, `src/infra/clipboard.ts` | Browser side effects never throw: `try/catch` returning a result union (`'granted' \| 'denied' \| 'unsupported'`); sandboxed environments degrade silently |
| User text | `src/domain/messages.ts:114` (`INFO_TEXT`) | All wording in `domain/messages.ts`, exhaustive with `satisfies Record<…>`; the glossary reuses the info-tip IDs |
| Logging | — | None. No console, no telemetry (ADR-006); reporting endpoints are banned too |
| Data | `src/state/app-store.ts:134` (`persistRequested`), `src/domain/schema.ts` | New persistent flags go through the app store and the existing `settings` fields (`installHintDismissed` already exists, so no migration) |
| Tests | `src/ui/__tests__/workbench.test.tsx`, `e2e/workbench.spec.ts`, `e2e/a11y.spec.ts:4` | Component tests with `renderWithStore`; Playwright specs with small helpers; axe scans filtered to serious/critical; Chromium-only steps use `test.skip(browserName !== 'chromium', reason)` |

## Files to Change

| File | Action | Why |
|---|---|---|
| `config/security-policy.ts` | CREATE | The single source of the CSP and response headers (M4-D8) |
| `vite.config.ts` | UPDATE | vite-plugin-pwa (manifest, precache, navigation fallback, prompt); the security-policy plugin (meta + `_headers`) |
| `public/` (`favicon.svg`, `icons/*`, `robots.txt`) | CREATE | Icons and static files (M4-D6) |
| `scripts/make-icons.mjs` | CREATE | Regenerates the icons from the mark |
| `prototypes/logo/` | CREATE, then DELETE | Temporary comparison page for the brand mark (Task 0) |
| `src/ui/app/App.tsx` (header) | UPDATE | The new wordmark replaces the indigo "R2" square |
| `index.html` | UPDATE | Icons, `apple-touch-icon`, `apple-mobile-web-app-*` meta, manifest link (added by the plugin) |
| `src/infra/sw.ts` | CREATE | Registers the worker from a module; exposes "update waiting" and `applyUpdate()` |
| `src/infra/install.ts` | CREATE | `beforeinstallprompt` capture, standalone detection, iOS Safari detection, `appinstalled` → persist |
| `src/infra/url-hash.ts` | UPDATE | Canonicalise unknown paths (M4-D1) and flush pending writes before an update reload |
| `src/ui/app/router.ts`, `App.tsx`, `App.module.css` | CREATE / UPDATE | `/` and `/guide`, the lazy Guide, the header Guide link, the update bar, the install hint |
| `src/ui/guide/GuidePage.tsx`, `.module.css`, `glossary.ts`, `WorkedExample.tsx`, `TickTable.tsx` | CREATE | The Guide & trust page (ADR-008) |
| `src/ui/shared/InfoTip.tsx` | UPDATE | Add "More in the Guide →" with a term ID |
| `src/ui/shared/UpdateBar.tsx`, `src/ui/settings/SettingsSheet.tsx` | CREATE / UPDATE | The update notice; the "Install app" action and storage status after install |
| `src/domain/messages.ts` | UPDATE | Guide, update, install and privacy wording |
| `e2e/offline.spec.ts`, `e2e/no-network.spec.ts`, `e2e/update-flow.spec.ts`, `e2e/guide.spec.ts`, `e2e/routing.spec.ts` | CREATE | The M4 test plan (architecture §9) |
| `src/**/__tests__/*` (router, install, security policy, manifest, glossary ↔ info-tip IDs) | CREATE | Unit checks |
| `lighthouserc.cjs`, `package.json`, `.github/workflows/ci.yml` | CREATE / UPDATE | `pnpm lhci`, a Lighthouse CI job, a Chromium step for the offline specs |
| `docs/release-checklist.md` | CREATE | Dashboard toggles, header curl checks, the production no-network run, the manual device matrix |
| `.claude/prds/r2size.architecture.md`, `.claude/prds/r2size.prd.md` | UPDATE | Manifest colour, unknown-path behaviour, M4 status and notes |

## Cloudflare: what you do

Everything else is scripted. These are the only manual steps, in order:

1. **Now (any time before Task 10):** create a free account at `https://dash.cloudflare.com/sign-up` and verify your email. You don't need a domain, a payment method, or any project setup; `wrangler` creates the project.
2. **When I ask in Task 10:** type `! pnpm wrangler login` in this chat. A browser tab opens; click **Allow**. That lets wrangler create and deploy the `r2size` Pages project on your account.
3. **After the first deploy:** in the dashboard, open **Workers & Pages → r2size → Metrics**, and make sure **Web Analytics** is *not* enabled (it injects a script, which the security policy would block and the privacy promise forbids).
   - Rocket Loader, Email Obfuscation and Bot Fight Mode are settings for a custom domain (zone). On `r2size.pages.dev` they don't apply, so you have nothing to turn off now. If you add your own domain later, the release checklist lists them.
4. **Then:** tell me it's done, and I run the production checks (headers, no-network, Lighthouse).

## Tasks

### Task 0: Brand mark (checkpoint — you pick)
- **Action:**
  - research typographic marks and wordmarks (WebSearch), and note concrete references with links;
  - build a temporary comparison page in `prototypes/logo/` (prototype skill rules: isolated, a picker with keys 1–N) with 5–6 directions;
  - **stop for your pick**, refine it, then delete `prototypes/logo/`.
- **Validate:** each direction is legible at 16 px and reads as a mark at 180 px; you choose.

### Task 1: Routing and unknown paths
- **Action:** add `router.ts` (a `useSyncExternalStore` over `popstate` plus `navigate()`), and canonicalise unknown paths at startup (M4-D1). Render the Guide with `lazy()` and a fallback.
- **Mirror:** `infra/url-hash.ts` (never throws, `replaceState` only for canonicalisation).
- **Validate:** unit tests for the path cases (`/`, `/guide`, `/guide/`, `/anything#v=1&e=100` → `/#v=1&e=100`); `e2e/routing.spec.ts` on the preview build.

### Task 2: Guide & trust page
- **Action:**
  - **Glossary:** `glossary.ts` with one entry per info-tip ID plus the output terms (R-multiple, binding constraint, allocation, risk per share).
  - **Worked example:** `WorkedExample` runs `computeSizing` on the "mockup" fixture and shows each formula step.
  - **Tick bands:** `TickTable` reads the band table with its `effectiveFrom` date and circular reference.
  - **Privacy:** the statement and the DevTools how-to.
  - **Source link:** M4-D10.
  - **Info tips:** each links to `/guide#term-<id>`.
- **Mirror:** design doc v2 (property-list typography, hairlines, no new colours); `domain/messages.ts` for wording.
- **Validate:**
  - a unit test that every `INFO_TEXT` key has a glossary entry, and that the worked example's numbers equal the fixture's expectations;
  - `e2e/guide.spec.ts` (an info tip opens the right term; Back keeps the setup);
  - axe.

### Task 3: Icons and manifest
- **Action:** `scripts/make-icons.mjs` turns the chosen mark (Task 0) into paths and renders the PNGs with Playwright Chromium. Commit the outputs, then add the manifest (via the plugin) and the iOS meta tags.
- **Validate:** a manifest test (required fields, icon files exist with the right sizes, `id`/`scope`/`start_url` = `/`, `display: standalone`, colours `#08090a`, a maskable icon present).

### Task 4: Service worker and update notice
- **Action:**
  - configure vite-plugin-pwa per ADR-007;
  - add `infra/sw.ts` (register on load; "update waiting" as a subscribable flag; `applyUpdate()` flushes the hash writer, posts `SKIP_WAITING`, and reloads on `controllerchange` only after the tap);
  - add the `UpdateBar` (M4-D4).
- **Validate:** `e2e/update-flow.spec.ts` (Chromium):
  - load and fill a setup;
  - serve a changed `sw.js`; the bar appears;
  - wait without tapping: no reload happens;
  - tap Reload: the page reloads and the setup is back from the hash.

### Task 5: Install
- **Action:**
  - add `infra/install.ts`;
  - add "Install app" to Settings (Chromium);
  - show the one-time iOS hint via `NoticeBar`, saving the dismissal to `installHintDismissed`;
  - request persistent storage on `appinstalled` or when running standalone.
- **Validate:** component tests with a faked `beforeinstallprompt` event and faked iOS user agent and standalone states.

### Task 6: Security policy
- **Action:**
  - add `config/security-policy.ts`;
  - add the Vite plugin (build only) that injects the meta CSP and emits `dist/_headers`, including the `/sw.js` rule `default-src 'none'; connect-src 'self'`, the cache headers and HSTS;
  - confirm there are no inline scripts or styles in the built `index.html`.
- **Validate:** unit tests (meta and `_headers` carry the same CSP; `frame-ancestors` only in headers); `pnpm build` then a check of `dist/index.html` for inline `<script>`/`style=`.

### Task 7: Offline and no-network
- **Action:**
  - **`e2e/offline.spec.ts` (Chromium):** wait for service-worker control, go offline, reload `/`, open `/guide`, compute, copy, export, open an unknown path.
  - **`e2e/no-network.spec.ts`:** record every request after `load` while using every feature (calculate, command bar, ladder drag, copy, presets, share link, export, import, reset, Guide), and assert zero requests and zero `securitypolicyviolation` events.
  - **Production run:** a `BASE_URL` override lets the same spec run against the production URL.
- **Validate:** both specs green. Resolve Trusted Types (M4-D7) from their results.

### Task 8: Lighthouse
- **Action:** add `@lhci/cli` and `wrangler` (dev dependencies), `lighthouserc.cjs` (desktop and mobile presets, assertions ≥ 0.9), the `pnpm lhci` script and a CI job.
- **Validate:** `pnpm lhci` passes locally.

### Task 9: Docs and release checklist
- **Action:**
  - write `docs/release-checklist.md` (dashboard toggles, `curl -I` header checks, the production no-network run, Lighthouse on production, and the manual device matrix with steps);
  - update the architecture doc (M4-D1/D12) and the PRD (M4 notes, open questions).
- **Validate:** formatting check; links resolve.

### Task 9b: Publish the source
- **Action:**
  - scan the history for secrets and personal data (tokens, `.env`, keys, emails beyond the commit author);
  - `gh repo create ciphertk/r2size --public --source . --remote origin --description "…"`;
  - push `master` and set it as the default branch;
  - watch the first CI run.
- **Validate:** `gh run list` shows CI green; the Guide's source link opens the repo.

### Task 10: Deploy (checkpoint — needs your go-ahead)
- **Action:**
  - you have a Cloudflare account and run `! pnpm wrangler login` (see "Cloudflare: what you do");
  - I create the `r2size` Pages project and **show you exactly what will go public**;
  - **after you say yes:** `wrangler pages deploy dist`;
  - you switch off the listed dashboard features;
  - I run the production checks.
- **Validate:**
  - `curl -I` shows every header;
  - `BASE_URL=https://r2size.pages.dev pnpm exec playwright test e2e/no-network.spec.ts` is green;
  - Lighthouse on production is ≥ 0.9.

### Task 11: Close
- **Action:** run the full validation, write the implementation notes in this plan, mark the PRD row complete (pending your device matrix), and commit.

## Validation

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test                 # unit + component, incl. router, glossary, manifest, security policy
pnpm build && pnpm size   # JS ≤ 90 KB (Guide is a separate lazy chunk), CSS ≤ 15 KB, fonts ≤ 30 KB
pnpm test:e2e             # Pixel 7, iPhone 14, desktop; offline/update/no-network specs on Chromium
pnpm lhci                 # Lighthouse ≥ 0.9 on wrangler pages dev (applies _headers)
# after deploy (with your go-ahead):
curl -sI https://r2size.pages.dev/ | grep -iE "content-security-policy|strict-transport|x-content-type"
BASE_URL=https://r2size.pages.dev pnpm exec playwright test e2e/no-network.spec.ts --project=desktop
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Trusted Types `'none'` breaks something (Preact, Base UI or Workbox writes a string to an HTML sink) | Medium | The e2e CSP listener finds it; fall back to a named policy (M4-D7) and record why |
| The update-flow test can't swap `sw.js` through `page.route` (Chromium may fetch worker scripts outside routing) | Medium | Fallback: a tiny test server that serves build A, then build B from a second `dist` folder |
| Service-worker e2e is flaky in WebKit under Playwright | High | Run offline/update specs on Chromium (desktop + Pixel); iOS is covered by the manual device matrix |
| The JS budget is exceeded by workbox-window and the router | Low | The Guide is a lazy chunk; the register module is small; `pnpm size` gates it |
| Cloudflare injects scripts (analytics, Rocket Loader) | Low | Dashboard checklist, plus the no-network spec against production with the CSP listener |
| iOS keeps separate storage for Safari and the installed app | High | The install hint tells the trader to set up the profile after installing (Export/Import bridges them) |
| wrangler / Lighthouse are heavy dev dependencies on Windows | Low | Dev-only; CI uses Ubuntu; `wrangler pages dev` replaces a custom headers server |
| A public deploy happens before you're ready | — | Task 10 stops for your explicit yes; nothing is published before it |
| The new mark still reads as generic | Medium | Research-backed directions, each with a named idea; banned clichés listed in M4-D13; you pick, and I iterate if none land |
| Something private ends up in the public repo | Low | Secret and personal-data scan before `gh repo create`; untracked skill folders stay local |

## Acceptance

- [ ] `/` and `/guide` work online and offline; any other path lands on `/` with the setup intact
- [ ] The Guide explains every term, shows a worked example the engine computes and the dated tick table, and says how to verify the privacy promise
- [ ] Installable on Chromium (prompt) and iOS (hint); after install, storage is requested to persist
- [ ] Updates only apply when the trader taps Reload, and the setup survives
- [ ] No requests after load and no CSP violations, on preview and on production
- [ ] Lighthouse performance, accessibility and best practices ≥ 0.9 on production
- [ ] A new typographic brand mark, chosen by you, used in the header, favicon and app icons
- [ ] Source public at `github.com/ciphertk/r2size`, CI green, linked from the Guide
- [ ] Deployed publicly at `r2size.pages.dev` **with your go-ahead**; the release checklist is written
- [ ] Manual device matrix run by you on Android and iOS (the only part I can't automate)
- [ ] All tasks complete, validation passes, patterns mirrored rather than reinvented

## Implementation notes (2026-10-05)

Tasks 0–9 are done; 9b (publish) and 10 (deploy) follow, with the deploy stopping for the owner's go-ahead.

- **Brand mark (Task 0):** two rounds (Floor, Ligature, Stop line, Ticket, Fraction; then Floor ticket, Ticker field, Stub). The owner chose **Ticker field**: `⌊R2⌋SIZE`, R2 in Geist Mono 600 inside floor brackets, SIZE in Geist Mono 400. `scripts/brand/make_brand.py` (fontTools) converts it to outlines in `src/ui/app/brand-paths.ts`; `pnpm icons` renders the PNGs. The favicon uses a heavier cut (weight 800, thicker brackets) to stay crisp at 16 px.
- **`installHintDismissed` didn't exist** (the plan assumed it did). Added as `v.optional(v.boolean(), false)`, so v1 documents and backups need no migration; a test loads an old document.
- **Trusted Types (M4-D7) resolved:** `'none'` blocked `navigator.serviceWorker.register('/sw.js')`, so the worker never registered and offline was broken. Fix: a single `default` policy that allows exactly this origin's `/sw.js` and nothing else (no `createHTML`/`createScript`); the CSP now says `trusted-types default`. The no-network spec asserts zero violations on all three devices.
- **`upgrade-insecure-requests` is header-only.** In a `<meta>` policy, WebKit also upgrades `http://localhost`, so the iPhone tests couldn't load any script. Production is HTTPS-only, so the header copy is enough.
- **Worker policy needs `script-src 'self'`,** and `_headers` must detach the page policy (`! Content-Security-Policy`) because Cloudflare merges matching rules. Verified on `wrangler pages dev`; `inlineWorkboxRuntime` keeps the worker to one file.
- **Update-flow test:** `page.route` doesn't see the browser's own worker update check (the risk the plan listed), so the spec uses its fallback, a small test-only static server (`e2e/support/static-server.ts`) that "deploys" a byte-different `/sw.js`.
- **Size budget now measures initial JS** (what `index.html` loads): 80.5 KB / 90. The Guide (6.2 KB) and the Workbox helper (2.1 KB) load on demand and are listed separately.
- **Lighthouse on `wrangler pages dev`:** calculator 96 / 100 / 100 (performance / accessibility / best practices), Guide 91 / 100 / 100.
- **Floating update bar** instead of a bar above the setup pane: inserting a bar would shift the three panes mid-calculation.
- **Tests:** 394 unit and component tests; 94 end-to-end tests on Pixel 7, iPhone 14 and desktop (new: routing, Guide, offline, no-network, update-flow). The offline and update-flow specs run on Chromium only, and the phone dock test is skipped on desktop.
