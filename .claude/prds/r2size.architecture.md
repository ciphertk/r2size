# R2Size — System Architecture

*Status: ACCEPTED (2026-10-05). All recommendations below were accepted by the author. Source requirements: [r2size.prd.md](r2size.prd.md), [PRODUCT-BRIEF.md](../../PRODUCT-BRIEF.md).*

**Main decisions:**
- **Exact arithmetic:** the sizing engine uses fractions built on BigInt. No floating-point number ever touches a price, and the only rounding happens at a few named steps.
- **Strict security policy:** the page's policy uses `connect-src 'none'`, so the app cannot make network calls. This supersedes the brief's `connect-src 'self'`.
- **No update polling:** the app never checks for updates on a timer, which keeps "no network requests after load" literally true.
- **Shared setups go after the `#`** in the URL, so trade inputs are never sent to the server or written to its logs.
- **Storage:** one versioned document in localStorage.
- **Validation:** Valibot checks every untrusted input (stored data, imported files, URL params).

The sizing-rule decisions (D1–D12) are in [section 11](#11-sizing-decisions-and-risks) and are mirrored in the PRD's Decisions section.

---

## 1. Stack

| Concern | Choice | Why | Rejected |
|---|---|---|---|
| Language | TypeScript 6.0, strict, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` | The engine's types are its contract. Not 7.x yet: typescript-eslint and Stryker's checker need the classic compiler | JS + JSDoc (weaker guarantees for the engine) |
| UI | **React API on Preact** (`react` = `npm:@preact/compat`, since M2: React 19 + Base UI was 115 KB gzipped, Preact 59 KB), with no state, form or router libraries | One screen plus a Guide page. `useReducer`, `useSyncExternalStore` and a ~30-line path switch cover it | Preact (fallback: alias `react` to `preact/compat` if the JS budget is exceeded; only `src/ui` touches React). Svelte/Solid (reopens a decided question). Vanilla/Lit (more hand-written DOM code). Next.js/Astro (server/static rendering adds nothing) |
| Build | **Vite** (current major) | Fast, first-class PWA plugin, emits no inline scripts | webpack, Parcel |
| Styling | Plain CSS with custom properties and CSS Modules, **dark theme only** (`color-scheme: dark`), tokens from [r2size.design.md](r2size.design.md), `font-variant-numeric: tabular-nums slashed-zero` | No runtime cost, works under `style-src 'self'` | Tailwind (one more toolchain), CSS-in-JS (needs a runtime and fights the security policy) |
| Fonts | **IBM Plex Sans** (variable 400–600) + **IBM Plex Mono** (400), subset to Latin + ₹ + symbols, self-hosted woff2 (≈ 26 KB total) | ₹ glyph, digits equal-width by default, slashed zero; verified with fontTools (see design doc) | Inter, Geist (generic look; Inter needs `tnum`), JetBrains/Martian/DM/Red Hat Mono (no ₹) |
| UI primitives | **Base UI** (`@base-ui/react`, MIT): Popover, Dialog, AlertDialog, Toast, Collapsible, RadioGroup/ToggleGroup, inside `<CSPProvider disableStyleElements>` | Headless, accessible, can run with no injected `<style>` tags | Radix (Select/ScrollArea inject `<style>`, breaking CSP and Trusted Types), shadcn/ui (Tailwind + generic look), React Aria (heavier; its NumberField uses floats) |
| Icons | **Phosphor Icons** (`@phosphor-icons/react`, MIT), per-icon imports, about 6 icons | Consistent stroke, tree-shakable | Lucide (the default shadcn look) |
| Validation of untrusted data | **Valibot** | A few KB after tree-shaking. Used for stored data, backups and URL params | Zod (larger), hand-written checks |
| PWA | **vite-plugin-pwa**, `generateSW` mode, `registerType: 'prompt'`, registered from a module (no inline script) | Full Workbox precache and a "reload when the user asks" update flow | Hand-written service worker, `autoUpdate` (breaks "never reload mid-calculation") |
| Unit and component tests | **Vitest 4.1** (`node` env for the engine, `happy-dom` for UI), **fast-check**, **Testing Library** | One runner for everything. Pinned to 4.1: Stryker's Vitest runner silently fails to activate mutants under Vitest 5 (see the M1 plan's implementation notes) | Jest |
| Mutation tests (M1 gate) | **StrykerJS** on `src/engine` only | Proves the tests catch wrong arithmetic | — |
| End-to-end tests | **Playwright** + `@axe-core/playwright` | Simulates offline, records every request, catches CSP violations | Cypress |
| Lighthouse | **@lhci/cli** against `wrangler pages dev` (applies `_headers`) and the production URL | | |
| Hosting | **Cloudflare Pages** (decided), headers in `public/_headers` | Real CSP headers including `frame-ancestors` | GitHub Pages (no custom headers), Netlify/Vercel (no reason to switch) |
| Tooling | pnpm, Node LTS, ESLint flat config with import-boundary rules, Prettier | | |

**Budgets, enforced in CI:**
- Initial JS ≤ 90 KB gzipped (React is about 60 KB).
- CSS ≤ 15 KB.
- Fonts ≤ 30 KB woff2 total, self-hosted (subset IBM Plex Sans + Mono); Plex Sans preloaded.
- `build.assetsInlineLimit: 0`, so nothing is inlined as a `data:` URL and `img-src` stays `'self'`.

## 2. Module and layer layout

```
r2size/
  index.html                      # no inline script or style
  public/
    _headers                      # security policy + caching rules
    fonts/                        # plexsans-var-400-600.woff2, plexmono-400.woff2 (subset)
    icons/ (192, 512, maskable-512, apple-touch-icon-180), favicon.svg, robots.txt
  src/
    engine/                       # PURE: no DOM, no storage, no Intl, no Number arithmetic on money
      rational.ts                 # exact fractions on BigInt: add/sub/mul/div/cmp/floor/min
      decimal.ts                  # decimal string -> fraction (exact), fraction -> fixed-decimal string
      tick-bands.ts               # dated NSE table + autoTick() + nearBandEdge()
      stop.ts                     # stop by price/%/ATR + rounding to the tick grid
      size.ts                     # budget, quantities, caps, binding constraint, actuals
      r-table.ts
      validate.ts                 # raw strings -> SizingInput | FieldError[]
      types.ts, errors.ts (codes only, no wording), index.ts (computeSizing)
      __fixtures__/worked-examples.ts   # single source, also rendered in the Guide
      __tests__/  worked-examples.test.ts, properties.test.ts, reference-oracle.ts, decimal.test.ts
    domain/                       # PURE, may import engine only
      schema.ts                   # Valibot schemas: stored data, backup, share URL
      migrations.ts               # step functions v(n) -> v(n+1)
      share-url.ts                # encode/decode ShareableSetup
      backup.ts                   # build and parse export files
      staleness.ts                # days since update, in device-local calendar days
      format.ts                   # en-IN display formatting (Intl; no DOM)
      copy-text.ts                # plain-digit copies + "Copy all" line
      presets-defaults.ts
    infra/                        # browser side effects, no React
      storage.ts                  # localStorage repository with fallback on corrupt data
      persist.ts                  # navigator.storage.persist()
      clipboard.ts, download.ts (Blob / navigator.share with files), url-sync.ts, sw.ts
    state/                        # stores built on useSyncExternalStore + form reducer
      app-store.ts, form-reducer.ts, selectors.ts
    ui/
      app/ App.tsx, router.ts (paths "/" and "/guide"; Guide loaded on demand)
      calculator/ CalculatorScreen, InputsPanel, StopField, RiskField, ResultsPanel, RTable, BindingNotice, CopyBar
      profile/ ProfileBar (staleness prompt, one-tap Update)
      presets/ PresetPicker, PresetEditor
      settings/ SettingsSheet (stale days, export/import, reset)
      guide/ GuidePage, glossary.ts, WorkedExample.tsx (runs the engine on the fixture)
      shared/ NumberField, Segmented (radio group), InfoTip, CopyButton, Banner, LiveRegion
      styles/ tokens.css, base.css
    main.tsx
  e2e/ calculator.spec.ts, offline.spec.ts, no-network.spec.ts, update-flow.spec.ts, share-url.spec.ts, backup.spec.ts, a11y.spec.ts
  lighthouserc.cjs, stryker.config.mjs, vitest.config.ts (with projects), playwright.config.ts
```

**Boundary rules (ESLint `no-restricted-imports` / `eslint-plugin-boundaries`):**
- `engine` imports nothing outside `engine`.
- `domain` imports only `engine`.
- `infra` and `state` never import `ui`.

**Extra lint rules on `src/engine`:** ban `parseFloat`, `Number(`, `Math.*`, `toFixed`, `window`, `document`, `localStorage`.

**Banned network APIs everywhere in `src/`:** `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`.

## 3. Sizing engine

### Numeric precision: exact fractions on BigInt (ADR-002)

- Raw input strings are parsed straight into fractions with BigInt numerator and denominator. A user's number is never converted to a float.
- All arithmetic is exact. The only roundings are named steps:
  - derived stop → tick grid
  - +kR target prices → tick grid
  - flooring each quantity
  - display rounding, in `format.ts` only
- **Why not floats:** entry ₹200 with a 5% stop. `200 * 0.95` is not exactly 190 in floating point, so the stop floors to 189.99 instead of 190.00. Every percentage stop has this hazard.
- **Why not integer paise in Numbers:** cost % and risk % create fractions of a paisa; scaled integers either truncate silently or overflow 2^53.
- **Why not decimal.js/big.js:** division needs a rounding mode, which reintroduces unrequested rounding. BigInt is built in, so fractions cost no download.
- **Input precision limits (validation errors, never silent rounding):**
  - prices: ≤ 2 decimals
  - percentages: ≤ 4 decimals
  - ATR: ≤ 4 decimals
  - ATR multiple: ≤ 2 decimals
  - accepted characters: digits, one `.`, and optional `,`, `₹` or spaces (stripped)
  - no exponents, no negatives, ≤ 12 integer digits
- **Rounding to a tick:** `floorToTick(p, t) = floor(p / t) * t`, exact. For positive values BigInt `/` truncation equals floor; the engine checks positivity before every floor.

### Types (sketch)

```ts
type Q = Rational;                                  // { n: bigint; d: bigint }, reduced, d > 0
type StopSpec = { kind: 'price'; price: Q } | { kind: 'percent'; pct: Q } | { kind: 'atr'; atr: Q; multiple: Q };
type RiskSpec = { kind: 'percent'; pct: Q } | { kind: 'amount'; rupees: Q };
interface SizingInput {
  entry: Q; stop: StopSpec; tickOverride?: Q; risk: RiskSpec;
  equity: Q; availableCash?: Q; maxAllocationPct?: Q; costPct: Q;   // costPct defaults to 0
  targets: readonly Q[];                                              // at most 3
}
type FieldId = 'entry'|'stopPrice'|'stopPct'|'atr'|'atrMultiple'|'tick'|'riskPct'|'riskAmount'
             |'equity'|'availableCash'|'maxAllocationPct'|'costPct'|'target1'|'target2'|'target3';
type ErrorCode = 'required'|'notANumber'|'tooManyDecimals'|'mustBePositive'|'outOfRange'
  |'stopNotBelowEntry'|'derivedStopNotPositive'|'riskExceedsEquity'
  |'qtyZeroRisk'|'qtyZeroAllocation'|'qtyZeroCash'|'targetNotAboveEntry';
interface FieldError { field: FieldId | 'form'; code: ErrorCode; blocking: boolean; params?: Record<string, string> }
type Warning = { code: 'tickEstimateNearBandEdge'|'priceOffTick'|'targetOffTick'|'highRiskPct'|'cashExceedsEquity'; field?: FieldId; params?: Record<string,string> };

interface SizingResult {
  tick: { value: Q; source: 'auto'|'override'; bandsEffectiveFrom: string; nearBandEdge: boolean };
  stop: { price: Q; raw: Q; derived: boolean; adjusted: boolean };   // adjusted = raw was not on the tick grid
  perShare: { priceRisk: Q; cost: Q; total: Q };
  riskBudget: Q;
  qty: { byRisk: bigint; byAllocation: bigint | null; byCash: bigint | null };
  quantity: bigint; binding: 'risk'|'allocation'|'cash'; uncappedQuantity: bigint;   // = byRisk
  investment: Q; allocationPct: Q; actualRisk: Q; actualRiskPct: Q;
  rTable: readonly RRow[];
  warnings: readonly Warning[];
}
interface RRow { kind: 'stop'|'r1'|'r2'|'r3'|'target'; index?: 1|2|3; price: Q; rMultiple: Q; pnl: Q; pnlPctOfEquity: Q; offTick: boolean }
type SizingOutcome = { ok: true; result: SizingResult; fieldErrors: FieldError[] }   // non-blocking target errors
                   | { ok: false; errors: FieldError[]; partial?: Partial<SizingResult> };
```

- Entry point: `computeSizing(raw: RawForm): SizingOutcome`. Total: never throws, whatever the input.
- The engine returns error codes only; the UI words them.

### Computation order

1. **Parse and validate every field**, collecting all errors at once. Equity is always required (D7). Bounds:
   - 0 < risk % ≤ 100
   - 0 < stop % < 100
   - 0 < allocation % ≤ 100
   - 0 ≤ cost % < 10
2. **Tick** = user override if given, else `autoTick(entry)`. Flag `nearBandEdge` when entry is within ±10% of a band boundary (D11).
3. **Stop:**
   - by price: used as typed; warn if off the tick grid; not rounded.
   - by %: raw = entry × (1 − pct/100).
   - by ATR: raw = entry − atr × multiple.
   - derived stops: `stop = floorToTick(raw, tick)`, i.e. away from entry for a long (D6).
   - require 0 < stop < entry.
4. **Risk per share (D1):** price risk = entry − stop; cost per share = entry × cost%/100; total = price risk + cost.
5. **Budget:** equity × risk%/100, or the ₹ amount. Error if it exceeds equity; warn if risk % > 5.
6. **Quantity by risk:** floor(budget / total risk per share).
7. **Caps:**
   - allocation cap: floor(equity × alloc%/100 / entry)
   - cash cap (D3): floor(cash / (entry + cost per share))
8. **Final quantity** = min of the three. Binding constraint:
   - "risk" if the risk quantity ≤ both caps (ties go to risk).
   - otherwise the smaller cap; if the two caps tie, "cash".
   - uncapped quantity = risk quantity.
9. **Quantity < 1:** error naming the cause (`qtyZeroRisk`, `qtyZeroAllocation`, `qtyZeroCash`), each with its own message (D9).
10. **Actuals:** investment = qty × entry; allocation % = investment / equity; actual risk = qty × total risk per share; actual risk %.
11. **R table (D2, D4, D8):**
    - R = entry − stop (price-based).
    - +kR price = floorToTick(entry + k·R), rounded toward entry (conservative).
    - user targets used as typed; warn if off tick; a target ≤ entry is a non-blocking error on that row only.
    - P&L = qty × (price − entry) − qty × cost per share, so the stop row's P&L = −actual risk, matching the headline.
    - each row shows R-multiple = (price − entry) / R.
12. **Warnings.**

**Display rounding (`format.ts` only):**
- Money: 2 decimals, half-up, except risk figures, which round up so risk is never understated.
- Percentages: 2 decimals.
- Format by passing exact decimal strings to `Intl.NumberFormat('en-IN')` (or format the BigInt rupee part and append paise).

### Tick-band data module (`engine/tick-bands.ts`)

```ts
export const NSE_TICK_TABLE = {
  effectiveFrom: '2025-04-15',
  source: 'NSE circular NSE/CMTR/67133 (Circular Ref. 33/2025), 13 Mar 2025',
  sourceUrl: 'https://nsearchives.nseindia.com/content/circulars/CMTR67133.pdf',
  verifiedOn: '2026-10-05',
  // Ordered by upper bound. A price belongs to the first band whose upper bound admits it.
  // Boundaries exactly as in the circular: "Below 250", "≥ 250 – 1,000", "> 1,000 – 5,000",
  // "> 5,000 – 10,000", "> 10,000 – 20,000", "> 20,000". Only 250 starts a band inclusively;
  // 1,000 / 5,000 / 10,000 / 20,000 belong to the LOWER band.
  bands: [
    { upTo: '250',   upToInclusive: false, tick: '0.01' },  // price < 250
    { upTo: '1000',  upToInclusive: true,  tick: '0.05' },  // 250 ≤ price ≤ 1,000
    { upTo: '5000',  upToInclusive: true,  tick: '0.10' },  // 1,000 < price ≤ 5,000
    { upTo: '10000', upToInclusive: true,  tick: '0.50' },  // 5,000 < price ≤ 10,000
    { upTo: '20000', upToInclusive: true,  tick: '1.00' },  // 10,000 < price ≤ 20,000
    { upTo: null,    upToInclusive: false, tick: '5.00' },  // price > 20,000
  ],
} as const;
```

- Values are decimal strings, parsed by `decimal.ts`.
- The Guide renders this table with the circular's own boundary wording, its effective date and a link to the circular.
- Tests check that upper bounds strictly increase, ticks strictly increase, only the last band is open-ended, and every boundary fixture (D5) resolves as in the circular.
- **Scope, from the circular:** applies to securities in the EQ, T0, BE, BZ, BO, RL and AF series (and their BL series) and their stock futures. **ETFs are excluded**, so the Guide tells ETF traders to check and override the tick.
- **How NSE assigns the tick:** reviewed monthly, from the closing price on the last trading day of the previous month, and applied from the first trading day of the month. The auto tick from today's entry price is therefore an estimate near band edges (D11). The authoritative per-security tick is in NSE's daily security file; the app has no market data, so it is never used.

## 4. State and persistence

**Storage:** localStorage (ADR-004). A few KB of data, synchronous reads avoid a loading state, and `navigator.storage.persist()` protects the whole origin's storage. IndexedDB adds async complexity for no gain.

**Key:** a single key, `r2size`, holding one document:

```ts
interface StoredDocV1 {
  schemaVersion: 1;
  profile: { equity: string | null; availableCash: string | null; lastUpdated: string | null }; // decimal strings; ISO datetime
  presets: Array<{ id: string; name: string;               // name 1..40 chars
    riskPct: string; stop: { kind: 'percent'; pct: string } | { kind: 'atr'; multiple: string };
    maxAllocationPct: string | null; costPct: string; createdAt: string; updatedAt: string }>;   // at most 50
  settings: { staleDays: number /* 1..90, default 7 */;          // no theme: dark only
    defaultPresetId: string | null; installHintDismissed: boolean; persistRequested: boolean };
}
```

- Numbers are stored as decimal strings, never floats.
- Presets store only a % stop or an ATR multiple (D10); a stop price or ATR value is stock-specific.
- Default presets seeded on first run: Conservative 0.5%, Standard 1%.

**Loading:**
1. Read the key; `JSON.parse` inside `try`.
2. Check `schemaVersion`. If newer than the app's, open read-only with a notice.
3. Run migrations `[v1→v2, …]` in order.
4. Validate with Valibot.
5. On failure, copy the raw string to `r2size:corrupt:<timestamp>`, start with defaults and show a notice.

**Saving:** one `save(doc)` that validates first; `QuotaExceededError` is surfaced. Other tabs sync via the `storage` event.

**Trade draft:** not stored. The URL hash holds the current inputs (section 5), which also makes the update reload safe.

**Persistence request:** call `navigator.storage.persist()` the first time the profile is saved, and after install (`appinstalled` / standalone display mode). Settings shows "Storage: protected / may be cleared".

**Export format:**

```json
{ "app": "r2size", "kind": "backup", "schemaVersion": 1, "exportedAt": "2026-10-05T10:00:00+05:30", "data": { "profile": {}, "presets": [], "settings": {} } }
```

- File name `r2size-backup-YYYY-MM-DD.json`, saved via Blob + `<a download>`; in iOS standalone mode use `navigator.share({ files })` when `canShare` allows.

**Import:**
1. `<input type=file accept=application/json>`; reject files over 256 KB.
2. Parse, check `app`/`kind`, migrate, validate.
3. Preview: "Replace current data with: equity ₹20,00,000 (updated 3 Oct), 4 presets?"
4. **Replace, never merge.** Keep the previous document under `r2size:pre-import` so the import can be undone.

**Reset:** confirmation dialog, remove every `r2size*` key, reset the in-memory store. The service worker cache is app code, not user data, so it stays.

## 5. URL-encoded shareable setups

- **Format:** in the **hash fragment**, never sent to the server. Example: `/#v=1&sym=RAYMOND&e=100&sm=atr&atr=3.5&am=2&tk=0.05&rm=pct&r=1&al=20&c=0.25&t=114,120`
  - stop modes: `sm=price&s=93`, `sm=pct&sp=5`, `sm=atr&atr=…&am=…`
  - risk modes: `rm=pct&r=1`, `rm=amt&ra=5000`
- **Updating the URL:** `history.replaceState` on input change, debounced 300 ms, flushed before any reload or copy. Never `pushState`.
- **Versioning:** `v=1` required; unknown/higher `v` shows "This link is from a newer version" and is ignored; future versions decode through migrations.
- **Untrusted params:**
  - whole hash capped at 512 characters
  - only allowlisted keys read; unknown keys ignored
  - values must match the field decimal grammar
  - symbol must match `^[A-Z0-9&.\-]{1,20}$` after upper-casing
  - at most 3 targets
  - invalid values dropped individually, with "Some shared values were ignored"
  - values reach the form only as strings and render as text, never HTML
- **Profile never included:**
  - `encodeSetup` takes a `ShareableSetup` type with no `equity`/`availableCash` field, built from an explicit allowlist.
  - The decoder's allowlist has no profile keys.
  - Tests: changing the profile never changes the encoded string; `eq`, `cash`, `equity` never appear. An E2E test opens a shared link in a fresh browser profile and confirms equity is empty.
- **Disclosure:** the share UI says "Shares trade inputs only — never your equity or cash". A ₹ risk amount is a trade input, so it is shared.

## 6. PWA and offline

- **Caching:** Workbox precaches every build asset (HTML, JS, CSS, fonts, icons, manifest, Guide chunk). Navigations fall back to `index.html`. No runtime caching routes. Outdated caches cleaned up.
- **Update flow (ADR-007):**
  - `registerType: 'prompt'` with `useRegisterSW`. A waiting worker shows a non-blocking banner: "New version available — Reload".
  - On tap: flush the URL update, send `SKIP_WAITING`, reload on `controllerchange` only if a user-initiated flag is set.
  - No automatic reload and no timed polling; the browser checks on each launch/navigation.
- **Manifest:** `name`/`short_name` R2Size; `start_url`, `scope`, `id` = `/`; `display: standalone`; `theme_color` and `background_color` `#121110` (dark only); icons 192, 512, maskable 512; `categories: ["finance"]`; screenshots.
- **Install button:** capture `beforeinstallprompt` on Chromium; show "Install app".
- **iOS caveats:**
  - No install prompt: show a one-time "Share → Add to Home Screen" hint in Safari when not standalone.
  - `apple-touch-icon` and `apple-mobile-web-app-*` meta tags.
  - The home-screen app has separate storage from Safari; the hint says "set up your profile after installing" (or use Export/Import).
  - Safari can clear storage for non-installed sites.
  - Shared links open in Safari, not the installed app.
  - Blob downloads are unreliable in standalone mode; use the share sheet.
  - Test the service worker updates on a cold launch.

## 7. Security and privacy

**Document policy** (`public/_headers`, `/*`):

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; manifest-src 'self'; worker-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests; require-trusted-types-for 'script'; trusted-types 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

- **`/sw.js` gets its own policy:** `default-src 'none'; connect-src 'self'` — precache downloads follow the worker's own policy, not the page's.
- **Trusted Types:** keep `trusted-types 'none'` only if the offline E2E shows zero violations; otherwise relax to a named policy.
- **Cache headers:** `/assets/*` `immutable, max-age=31536000`; `/`, `/index.html`, `/sw.js`, `/manifest.webmanifest` `no-cache`.
- **Defence in depth:** a Vite plugin injects the same policy as `<meta>` **in production builds only** (meta can't set `frame-ancestors`; `connect-src 'none'` would break dev HMR).
- **No inline scripts:** `injectRegister: false` and import the register module. Dark only, so no pre-paint theme script is needed.
- **No injected styles:** Base UI runs inside `<CSPProvider disableStyleElements>`; `ScrollArea` and `Select` with `alignItemWithTrigger` are not used.
- **Cloudflare dashboard:** turn off Web Analytics auto-injection, Rocket Loader, Email Obfuscation and JS challenges. Server-side request stats (the brief's usage signal) remain available and need nothing in the page.
- **Enforcing "no network requests after load":**
  1. Browser enforces `connect-src 'none'`.
  2. Lint bans every network API in `src/`.
  3. No third-party origins and no `report-uri`/`report-to` (reporting would itself send a request).
  4. `no-network.spec` records every request after `load` while exercising every feature (calculate, copy, presets, share, export, import, reset, Guide) and asserts zero; a `securitypolicyviolation` listener fails the test on any violation.
  5. The Guide explains how to verify this in DevTools.
- **Privacy wording:** "makes no network requests after the page loads; when you reopen it online, it only checks this site for app updates". Cloudflare sees IP and user agent at load; trade inputs are in the hash, so it never sees them.

## 8. UI architecture

- **Routing:** `/` and `/guide` via a tiny `history` switch. Guide is lazily loaded and precached. Info tips link to `/guide#term-<id>`; the share hash exists only on `/`. Unknown paths fall back to the app (Cloudflare Pages online, service worker offline).
- **State:** the form reducer holds **raw strings**; `result = useMemo(() => computeSizing(form, profile))` recalculates on every keystroke. Profile, presets and settings live in one external store. No form library.
- **Inputs:**
  - `type="text" inputmode="decimal"`, `autocomplete="off"`, `enterkeyhint="next"`, `spellcheck=false`.
  - Never `type=number` (breaks with commas, changes on scroll, hides invalid raw values).
  - Format with commas only on blur.
  - Stop method and risk mode are segmented controls built as native radio groups.
  - Tick field shows "NSE estimate — editable", a stronger note near band edges, and "BSE may differ".
- **Layout:** on mobile the "Buy N shares" headline stays pinned above the fold while inputs scroll. Profile bar shows equity, "updated N days ago" and Update. Order optimised for 15 s: preset → entry → stop → Copy.
- **Formatting:** `Intl.NumberFormat('en-IN')` instances created once and reused; currency `INR`; quantities like 2,857. All formatting in `domain/format.ts`; no `toLocaleString` elsewhere.
- **Copy:**
  - `navigator.clipboard.writeText`, falling back to hidden textarea + `execCommand('copy')`.
  - Individual values are plain digits (`2857`, `100.00`, always 2 decimals) for broker fields.
  - "Copy all" is a human-readable line (₹ and commas allowed) for notes/chat; symbol omitted when blank.
  - Each button shows "Copied ✓" and announces via a polite live region.
- **Theme:** dark only (`color-scheme: dark`, `<meta name="color-scheme" content="dark">`). No toggle. Visual direction, tokens, type scale and layout are in [r2size.design.md](r2size.design.md); reference mockup in `design/mockup.html`.
- **Components:** Base UI primitives styled with our tokens (see the design doc's component table). Numeric inputs are our own `NumberField` on a native input, because Base UI's and React Aria's NumberField parse to floats.
- **Accessibility:**
  - every input has a `<label>`; errors linked via `aria-describedby` + `aria-invalid`
  - headline in a polite live region, debounced ~500 ms
  - info tips are buttons with `aria-expanded` (not hover-only tooltips)
  - tap targets ≥ 44 px, visible focus, `prefers-reduced-motion` respected, AA contrast in both themes
  - R table is a real `<table>` with caption "Scenarios, not forecasts"
- **Guide:** glossary from `glossary.ts` with the same IDs as info tips; worked example computed live by the engine from `__fixtures__`; tick table with date; privacy statement; source-code link (`rel="noopener noreferrer"`).

## 9. Testing strategy by milestone

**M1 — sizing engine**

Worked examples (fixtures, each with a hand derivation in a comment):
- brief example: ₹20,00,000 equity, 1% risk, entry 100, stop 93 → 2,857 shares, investment ₹2,85,700, allocation 14.285%
- PRD cost example: ₹100 / ₹95 at 0.25% → ₹0.25 cost per share
- float traps: 200 with 5% stop → 190.00; 1.15-style values
- every band edge, per the NSE circular (D5): 249.99 → 0.01; 250.00 → 0.05; 1,000.00 → 0.05; 1,000.05 → 0.10; 5,000.00 → 0.10; 5,000.10 → 0.50; 10,000.00 → 0.50; 10,000.50 → 1.00; 20,000.00 → 1.00; 20,001.00 → 5.00
- ATR stops landing exactly on and just off the tick grid
- each binding constraint (risk, allocation, cash) and tie cases
- each zero-quantity cause
- R table rows with and without costs

Property tests (fast-check, generated decimal strings):
- never throws for any input
- ok ⇒ quantity ≥ 1
- qty × total risk per share ≤ budget
- risk binding ⇒ (qty + 1) × total risk per share > budget (maximal)
- qty × entry ≤ equity × alloc%
- qty × (entry + cost per share) ≤ cash
- qty = min of three quantities; uncapped ≥ qty
- stop on tick grid, raw − tick < stop ≤ raw
- monotonicity: higher risk % never lowers qty; wider stop, higher cost or tighter cap never raises it
- stop row P&L = −actual risk
- decimal parse → format round-trips

Other:
- **Reference oracle:** a simple scaled-BigInt implementation in tests, compared on 10k random cases.
- **Gate:** 100% branch coverage of `engine`; Stryker mutation score ≥ 90%.

**M2 — usable calculator**
- Component tests: typing updates the result; error messages and linkage; switching stop/risk modes; exact copy text; binding-constraint wording; axe checks.
- Playwright happy path on Pixel and iPhone viewports, plus a scripted time-to-copy benchmark as a regression signal (human timing is the real metric).

**M3 — remembers the trader**
- Migration fixtures for each past version; corrupt/foreign data falls back safely.
- Export → import round-trips (property test); import rejects oversized, wrong-app, future-version and malformed files.
- Share URL round-trips; "profile never included" property; fuzzed hash never throws.
- Staleness with fake timers across IST midnight.
- Presets full create/edit/delete/apply cycle.

**M4 — installable and offline**
- Playwright (Chromium): wait for SW control → `context.setOffline(true)` → reload, open `/guide`, compute, copy, export.
- `no-network.spec` + CSP violation listener (also run against the production URL to catch Cloudflare injection).
- `update-flow.spec`: build A then build B → banner appears, inputs survive the user-initiated reload, never a reload without a click.
- Lighthouse CI on `wrangler pages dev` per PR (assert ≥ 0.9, aim 0.95+) and on the production URL after deploy.
- Lighthouse 12 dropped the PWA category: manifest-validity test plus manual matrix — Android Chrome, iOS Safari (Add to Home Screen, airplane mode, cold launch), desktop Chrome and Edge.

**M5 — validated with users:** no automated tests (no analytics by design). Re-run the manual offline/install matrix before each release; keep a short release checklist.

## 10. ADRs

- **ADR-001 React 19 + Vite + TypeScript, no extra state/form/router libraries.** Decided in the brief; React confined to `src/ui`. Fallback: `preact/compat` alias if initial JS > 90 KB gzipped.
- **ADR-002 Exact BigInt fractions in the engine; no floats for money.** Gain: provably exact tick rounding and floored quantities. Cost: more verbose code; BigInt needs Safari 14+ (acceptable).
- **ADR-003 Pure engine with lint-enforced boundaries,** tested in a `node` environment; errors are codes, the UI words them.
- **ADR-004 One versioned JSON document in localStorage,** validated with Valibot, step migrations. Alternative: IndexedDB (idb-keyval).
- **ADR-005 Shared setups in the URL hash,** `v=1`, allowlisted keys, a type that cannot hold the profile. Query string rejected because it is logged.
- **ADR-006 `connect-src 'none'`, no telemetry, no update polling.** Makes the privacy claim enforceable; updates noticed only on launch. Supersedes the brief's `connect-src 'self'`.
- **ADR-007 vite-plugin-pwa (`generateSW`, prompt), full precache, no runtime routes, reload only on user request;** the URL hash preserves inputs.
- **ADR-008 Guide is a lazily loaded route; its worked example is computed by the engine from shared fixtures,** so it cannot drift.
- **ADR-009 Cloudflare Pages with `_headers`, a production meta-tag policy, and script-injecting dashboard features off.**
- **ADR-010 Dated, source-cited tick-band data module** with a contiguity test; updating bands = edit data + fixtures, redeploy.

## 11. Sizing decisions and risks

All accepted 2026-10-05 (mirrored in the PRD).

| # | Item | Decision |
|---|---|---|
| D1 | Cost % in the risk-per-share divisor | **Yes**: total risk per share = (entry − stop) + entry × cost% |
| D2 | R definition | R = entry − stop (price-based). P&L columns are net of cost per share, so the stop row = −actual risk and +1R nets slightly under 1R. The Guide explains this |
| D3 | Cash cap and costs | cash ÷ (entry + cost per share). Allocation cap uses entry only |
| D4 | Target rounding | +kR prices rounded **down** to the tick (toward entry). User-typed entry, stop and targets are not rounded; warn when off tick ("your broker may reject") |
| D5 | NSE band boundary inclusivity | **Verified 2026-10-05 against NSE/CMTR/67133:** price < 250 → 0.01; 250 ≤ price ≤ 1,000 → 0.05; then each band is (lower, upper]: 1,000 → 0.05, 5,000 → 0.10, 10,000 → 0.50, 20,000 → 1.00. Fixtures cover every edge |
| D6 | "Round down" vs "away from entry" | Same thing for long-only: floor to the tick grid, documented as "away from entry" |
| D7 | Equity when risk is in ₹ | Always required |
| D8 | Target ≤ entry | Non-blocking error on that row; quantity still shown |
| D9 | Quantity 0 | Three distinct messages: risk budget, allocation cap, cash |
| D10 | Preset contents | Risk %, % stop or ATR **multiple**, allocation cap, cost %. No stop price or ATR value |
| D11 | Near-band-edge threshold | ±10% of a boundary |
| D12 | Staleness unit | Calendar days in device-local time |

**Other risks:**
- **"No network requests after load" wording:** the browser's own update check happens when the app is opened; nothing happens during use. The PRD metric reflects this.
- **iOS storage split:** Safari and the installed app have separate storage, and Safari may clear non-installed sites. Encourage installing before entering the profile; Export/Import is the only bridge. Expect support questions in M5.
- **Updates only on launch:** an installed app left open for days won't see a fix until reopened. Acceptable under ADR-006; documented in the Guide.
- **Trusted Types with React/Workbox** may surface a violation; the E2E check catches it; fallback is removing `trusted-types 'none'`.
- **Cloudflare script injection** (Web Analytics, Rocket Loader) would hurt Lighthouse and the privacy story; `no-network.spec` runs against the live URL.
- **Shared links reveal the sharer's trade** (entry, stop, ₹ risk amount if used). Disclosed in the share UI.
- **Lighthouse has no PWA category**; "Installable" relies on the manual matrix.
- **No worked-example set exists yet.** M1 starts by writing and peer-checking ~30 hand-derived fixtures covering every item above; they are the M1 acceptance gate and feed the Guide.
