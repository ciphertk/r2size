# Plan: Usable Calculator

**Source PRD**: `.claude/prds/r2size.prd.md`
**Selected Milestone**: 2 — Usable calculator ("a trader can enter a setup and copy the quantity, entry and stop in under 15 s on a phone")
**Complexity**: Large
**Also governed by**: `.claude/prds/r2size.architecture.md` (§1 stack, §2 layout, §8 UI, §9 M2 testing), `.claude/prds/r2size.design.md` (dark theme, tokens, type, layout, components), `design/mockup.html`

## Summary

Scaffold the Vite + React 19 app and build the single-screen calculator from the design spec: inputs, the result ticket, the price ladder, the mobile dock and one-tap copy, all driven live by the M1 engine (`computeSizing`). Add the `domain` layer for en-IN formatting, copy text and error/warning wording. Equity and cash are typed on screen in this milestone; saving them, presets and shareable URLs are Milestone 3, and offline/install/CSP headers/Guide are Milestone 4. Done when component and Playwright tests pass on phone viewports, a scripted run copies the quantity well within the 15 s budget, and the JS budget (≤ 90 KB gzipped) holds.

## Scope

**In:**
- App scaffold (Vite, React 19, CSS Modules), self-hosted IBM Plex fonts, design tokens
- Calculator screen per the design doc:
  - inputs: symbol, entry, stop (price / % / ATR ×) with derived stop and tick hint, tick override, risk (% / ₹)
  - "Limits, costs & targets" disclosure: max allocation, cost %, 3 targets
  - an editable equity/cash strip (in-memory only)
  - ticket: BUY quantity, binding constraint (and uncapped quantity), ticket line, facts grid
  - copy buttons: quantity, entry, stop, target, "Copy all"
  - the price ladder (R table) and the gap-risk note
  - the fixed mobile dock
- Clear messages for every engine error and warning code; empty and zero-quantity states
- Info tips (Base UI Popover) with a short explanation per field. The "Read more in the Guide" link arrives in M4

**Out (later milestones):** saving the profile and staleness reminder, presets, URL-hash setups, Export/Import, reset (M3); service worker, manifest, install, CSP headers, Guide page, Lighthouse CI, deploy (M4). Preset chips from the mockup are not rendered until M3.

## Decisions this plan makes (confirm or change)

| # | Question | Decision |
|---|---|---|
| M2-D1 | What does "Copy all" use for TGT? | Target 1 if typed; otherwise TGT is omitted. Format from the brief: `RAYMOND · BUY 2,857 · LMT ₹100.00 · SL ₹93.00 · TGT ₹118.40`; the symbol segment is dropped when blank |
| M2-D2 | Which target does the "Target" copy button copy? | The first valid typed target; the button is hidden when there is none |
| M2-D3 | Plain-digit copy format | Quantity as an integer (`2758`); prices with exactly 2 decimals (`100.00`, `93.00`), no commas or ₹ (brief §3.4) |
| M2-D4 | Display rounding | Money and prices 2 decimals, half away from zero; **risk figures (₹ risk, risk %) round up** so risk is never understated; percentages 2 decimals |
| M2-D5 | When is the result shown? | Live on every keystroke. Field errors appear after the field loses focus or when the form first has a result, so a half-typed entry doesn't flash red |
| M2-D6 | Equity/cash before M3 | Editable in the profile strip, kept in memory only; a "not saved yet" hint until M3 adds persistence |

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Naming | `src/engine/index.ts:36`, `src/engine/validate.ts:38` | kebab-case files, camelCase functions; one concern per file. React components: PascalCase `.tsx`, one per file, co-located `Component.module.css` |
| Errors | `src/engine/errors.ts:4`, `src/engine/index.ts:30` | The engine returns codes only; the UI maps every `ErrorCode`/`WarningCode` to wording in one table (`domain/messages.ts`) with an exhaustiveness check (`satisfies Record<ErrorCode, …>`) |
| Logging | — | None: no console output (lint) and no telemetry (ADR-006) |
| Data access | `src/engine/index.ts:36` | UI state holds the raw strings of a `RawForm`; the result is derived with `useMemo(() => computeSizing(form))`. No form library, no store library |
| Tests | `src/engine/__fixtures__/worked-examples.ts:34`, `src/engine/__tests__/compute.test.ts:7` | `form({...})` builder over `BLANK_FORM`; table-driven `it.each`; fixtures reused across layers (the mockup case drives a UI test and an E2E test) |

## Files to Change

| File | Action | Why |
|---|---|---|
| `package.json` | UPDATE | Add `react`, `react-dom`, `@base-ui/react`, `@phosphor-icons/react`; dev: `vite`, `@vitejs/plugin-react`, `@types/react(-dom)`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `happy-dom`, `@playwright/test`, `@axe-core/playwright`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`. Scripts: `dev`, `build`, `preview`, `test:e2e`, `size` |
| `index.html` | CREATE | No inline script or style; `lang="en-IN"`, `color-scheme` + `theme-color` meta, font preload |
| `vite.config.ts` | CREATE | React plugin, `build.assetsInlineLimit: 0`, `build.target: 'es2022'` |
| `tsconfig.json` | UPDATE | `jsx: react-jsx`, add `DOM` + `DOM.Iterable` to `lib`, `types: ["vite/client"]` (the engine stays DOM-free by lint) |
| `vitest.config.ts` | UPDATE | Two projects: `engine` (node, existing 100% gate) and `ui` (happy-dom, `src/{domain,state,ui}`), setup file for jest-dom |
| `eslint.config.js` | UPDATE | react-hooks + jsx-a11y rules for `.tsx`; boundaries: `domain` → engine only; `state` → engine/domain; `ui` → anything but not vice versa; ban `toLocaleString`/`Intl` outside `domain/format.ts` |
| `playwright.config.ts` | CREATE | Projects: Pixel 7 (Chromium) and iPhone 14 (WebKit); `webServer: pnpm build && pnpm preview` |
| `scripts/check-size.mjs` | CREATE | Fail if initial JS > 90 KB or CSS > 15 KB gzipped, or fonts > 30 KB |
| `src/main.tsx` | CREATE | Mount `<App />` inside `<CSPProvider disableStyleElements>` |
| `src/assets/fonts/*.woff2` | CREATE | Copy the subset Plex fonts from `design/fonts/` |
| `src/ui/styles/tokens.css`, `base.css`, `fonts.css` | CREATE | Tokens and type scale exactly as in the design doc |
| `src/domain/format.ts` | CREATE | `formatMoney`, `formatPrice`, `formatQty`, `formatPct`, `formatRisk` (rounds up) via cached `Intl.NumberFormat('en-IN')` fed exact decimal strings |
| `src/domain/copy-text.ts` | CREATE | Plain-digit copies and the "Copy all" line (M2-D1/D3) |
| `src/domain/messages.ts` | CREATE | Wording for every `ErrorCode` and `WarningCode`, plus per-field labels and info-tip text |
| `src/engine/decimal.ts` | UPDATE | Add a rounding mode (`'halfUp' \| 'up'`) to `toDecimalString` for M2-D4, keeping the 100% coverage and mutation gates |
| `src/state/form-reducer.ts` | CREATE | `RawForm` + symbol in state; actions: set field, set stop mode, set risk mode, reset field errors' "touched" state |
| `src/infra/clipboard.ts` | CREATE | `navigator.clipboard.writeText` with a hidden-textarea fallback; returns success |
| `src/ui/app/App.tsx` | CREATE | Layout shell: top bar, profile strip, calculator |
| `src/ui/shared/NumberField.tsx` | CREATE | Native `<input type="text" inputmode="decimal">`, prefix/suffix, label, error/hint linkage; commas only on blur |
| `src/ui/shared/Segmented.tsx` | CREATE | Base UI `RadioGroup` styled as a segmented control |
| `src/ui/shared/InfoTip.tsx` | CREATE | Base UI `Popover` trigger (an "i" button) with the field's explanation |
| `src/ui/shared/CopyButton.tsx`, `LiveRegion.tsx` | CREATE | "Copied ✓" for 1.5 s, announced politely |
| `src/ui/profile/ProfileStrip.tsx` | CREATE | Equity and cash fields (M2-D6) |
| `src/ui/calculator/CalculatorScreen.tsx`, `InputsPanel.tsx`, `StopField.tsx`, `RiskField.tsx`, `MoreFields.tsx` | CREATE | Inputs per the design layout |
| `src/ui/calculator/ResultTicket.tsx`, `BindingNotice.tsx`, `CopyBar.tsx`, `PriceLadder.tsx`, `Dock.tsx`, `EmptyState.tsx` | CREATE | Results per the design anatomy |
| `src/**/__tests__/*.test.ts(x)` | CREATE | Unit tests for domain/state, component tests for ui |
| `e2e/calculator.spec.ts`, `e2e/a11y.spec.ts` | CREATE | Phone-viewport happy path, copy, errors, time-to-copy, axe |
| `.github/workflows/ci.yml` | UPDATE | Add `build`, `size` and an `e2e` job (Playwright Chromium + WebKit) |
| `.claude/prds/r2size.prd.md` | UPDATE | Milestone 2 → `in-progress` now, `complete` at the end |

## Tasks

Test-first for `domain`, `state` and `ui` behaviour; layout and styling are verified by screenshots against the mockup.

### Task 1: App scaffold and tooling
- **Action**: Add the dependencies; create `index.html`, `vite.config.ts`, `src/main.tsx` and a placeholder `App`; update `tsconfig.json`, `vitest.config.ts` (projects) and `eslint.config.js` (React rules, layer boundaries); add `playwright.config.ts` and `scripts/check-size.mjs`. Copy the fonts and write `tokens.css`, `base.css` and `fonts.css`.
- **Mirror**: Architecture §1–2; the existing engine lint block stays unchanged.
- **Validate**: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm size`. The engine tests still run in `node`, and the engine still fails lint if it touches `window`.

### Task 2: Display rounding in the engine
- **Action**: Extend `toDecimalString(value, places, mode = 'halfUp')` with `'up'` (away from zero) for risk figures.
- **Mirror**: `src/engine/decimal.ts`, `src/engine/__tests__/decimal.test.ts` table style.
- **Validate**: `pnpm test:coverage` (100% kept) and `pnpm test:mutation` (≥ 90% kept).

### Task 3: `domain/format.ts`
- **Action**: Exact → en-IN strings: `formatMoney` (₹2,75,800.00), `formatPrice` (100.00), `formatQty` (2,758), `formatPct` (13.79%), `formatRisk` (₹19,995.50, rounded up), signed P&L with U+2212 minus. Formatting goes through exact decimal strings into `Intl.NumberFormat('en-IN')`, never through a float.
- **Mirror**: Engine test tables.
- **Validate**: `pnpm test format`, with cases from the mockup (₹20,00,000; ₹2,75,800.00; −19,995.50; +50,057.70; 0.999775% → "1.00%" for risk), crore values, and a property that formatting never changes the value when parsed back without separators.

### Task 4: `domain/copy-text.ts` and `domain/messages.ts`
- **Action**: Plain-digit copies (M2-D3) and the "Copy all" line (M2-D1). Wording for every error and warning code, written for traders (e.g. `qtyZeroCash`: "Not enough available cash for 1 share at ₹1,500.00").
- **Mirror**: `satisfies Record<ErrorCode, …>` so a new engine code fails the typecheck until it's worded.
- **Validate**: `pnpm test copy-text messages`, including the brief's exact example line and a blank symbol.

### Task 5: `state/form-reducer.ts`
- **Action**: State = `RawForm` plus `symbol` and a per-field "touched" set (M2-D5). The default form has stop mode `percent`, risk mode `percent` and empty values. Switching modes keeps each mode's typed value.
- **Mirror**: `src/engine/__fixtures__/worked-examples.ts:34` (`form()` builder) for test setup.
- **Validate**: `pnpm test form-reducer`.

### Task 6: Shared components
- **Action**: `NumberField` (decimal keypad, prefix/suffix, label, `aria-describedby` for hint and error, `aria-invalid`, commas on blur only, never reformats while focused), `Segmented` (Base UI RadioGroup), `InfoTip` (Base UI Popover; opens on tap/click), `CopyButton` + `LiveRegion`, and `infra/clipboard.ts`. Wrap the app in `CSPProvider disableStyleElements`.
- **Mirror**: Design doc component table and tokens.
- **Validate**: Component tests: typing `1,00,000.50` keeps the raw value; blur shows grouping; error text is linked; arrow keys move the segmented selection; the copy button writes the right text and announces "Copied".

### Task 7: Inputs
- **Action**: `ProfileStrip` (equity, cash), `InputsPanel` (symbol auto-uppercased, entry), `StopField` (mode + value + derived stop in `--loss` + tick hint "Tick 0.05 · NSE estimate, editable", stronger near a band edge, "BSE may differ"), tick override, `RiskField`, and `MoreFields` (`<details>`: allocation, cost, targets 1–3).
- **Mirror**: `design/mockup.html` structure and class names translated to CSS Modules.
- **Validate**: Component tests with the mockup setup reach the expected derived stop 93.00 and tick 0.01; switching to ATR shows the ATR fields; field-level errors match `messages.ts`.

### Task 8: Results
- **Action**: `ResultTicket` (BUY tag, quantity, ticket line, facts grid: risk ₹ and % rounded up, investment and allocation %, risk/share incl. cost, cap room), `BindingNotice` ("Limited by risk budget" or "Limited by cash · uncapped 4,444" in `--caution`), `CopyBar` (Copy qty primary + Entry, Stop, T1, All), `PriceLadder` (a real `<table>` with caption "Scenarios, not forecasts", rows from `rTable`, signed P&L, coloured rail, off-tick marker), gap-risk note, `Dock` (mobile only; hidden until there is a quantity), `EmptyState` and the zero-quantity state.
- **Mirror**: Design doc "Ticket anatomy" and "States to design".
- **Validate**: Component tests drive the M1 fixtures through the UI: the mockup case shows "2,758", "₹19,995.50", "13.79%", +1R "+18,616.50", T1 "+50,057.70"; the cash-cap case shows "Limited by cash · uncapped 4,444"; each zero-quantity case shows its own message.

### Task 9: Responsive layout and visual check
- **Action**: Mobile: inputs first, ticket and ladder below, dock fixed with `safe-area-inset-bottom`. Desktop ≥ 880 px: two columns with the result column staying in place. Check against the mockup at 390 × 844 and 1280 × 860.
- **Validate**: Playwright screenshots at both sizes (attached as CI artifacts; reviewed by eye, not pixel-diffed in M2). No horizontal scroll at 320 px.

### Task 10: E2E, accessibility, time-to-copy
- **Action**:
  - In `e2e/calculator.spec.ts` on Pixel 7 and iPhone 14: enter the mockup setup, check the numbers, tap Copy qty and read the clipboard (Chromium) or the copied state (WebKit); test errors and the zero-quantity message; check the numeric keypad attribute.
  - In `e2e/a11y.spec.ts`: axe with no serious or critical violations, keyboard-only flow, visible focus.
  - Time-to-copy benchmark: a scripted run from page load to copied quantity, asserted < 5 s as a regression guard. Human timing against the 15 s target happens in the PRD's open question.
- **Validate**: `pnpm test:e2e`.

### Task 11: CI, budgets, close
- **Action**: Add `build`, `size` and Playwright jobs to CI. Update the PRD Milestone 2 row to `complete`. Record the timed human sessions as a follow-up in the PRD's open question. Commit.
- **Validate**: The full validation block is green.

## Validation

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:coverage        # engine 100% gate + ui/domain/state tests
pnpm test:mutation        # engine ≥ 90% (Task 2 touches the engine)
pnpm build && pnpm size   # JS ≤ 90 KB, CSS ≤ 15 KB, fonts ≤ 30 KB gzipped
pnpm test:e2e             # Pixel 7 (Chromium) + iPhone 14 (WebKit)
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| React 19 + Base UI exceed the 90 KB JS budget | Medium | Per-component Base UI imports; measure after Task 6; fallback is `preact/compat` (ADR-001), or native `<details>`/`<dialog>` instead of some primitives |
| Base UI injects `<style>` or needs `unsafe-inline` | Low | `CSPProvider disableStyleElements`; no ScrollArea or aligned Select; M4's CSP tests confirm |
| `Intl.NumberFormat` given decimal strings rounds differently across browsers | Low | Round exactly in `toDecimalString` first, then pass a string that already has the final digits; Playwright runs Chromium and WebKit |
| iOS Safari quirks: numeric keypad without a decimal point, clipboard in WebKit, zoom on focus | Medium | `inputmode="decimal"`; font-size ≥ 16 px in inputs to prevent zoom; clipboard fallback; WebKit E2E project |
| Live recalculation on every keystroke flashes errors | Medium | Touched-field rule (M2-D5); tests cover partial input like `100.` and `.` |
| Playwright WebKit is not real iOS Safari | Medium | Manual check on a real iPhone before closing the milestone (also needed for the timed sessions) |
| Scope creep into M3/M4 features | Medium | The Scope "Out" list; preset chips and Guide links are deliberately absent |

## Acceptance

- [x] All tasks complete
- [x] Validation passes, including engine gates (100% coverage; mutation score in the commit message)
- [x] The mockup setup, entered through the UI, shows the M1 fixture numbers exactly (component test + E2E on Chromium and WebKit)
- [x] Copy qty / entry / stop / target / all produce the M2-D1 and M2-D3 formats (clipboard read back in E2E)
- [x] Every engine error and warning code has wording (typecheck-enforced)
- [x] Axe: no serious or critical violations, empty and filled; keyboard reaches every field in order; arrow keys switch the stop method
- [x] JS 58.9 KB, CSS 3.2 KB, fonts 25.9 KB gzipped (budgets 90 / 15 / 30)
- [x] Matches `design/mockup.html` at phone and desktop sizes (screenshots reviewed; `e2e/screenshots.spec.ts` saves them as CI artifacts)
- [x] Patterns mirrored from M1, not reinvented
- [ ] Follow-up, not a code task: timed sessions on a real iPhone and Android phone against the 15 s target (PRD open question)

## Implementation notes (2026-10-05)

Deviations from the plan, and why:

- **Preact instead of React at runtime (ADR-001 fallback, triggered).** React 19 + Base UI built to 115.5 KB gzipped, over the 90 KB budget. `react` and `react-dom` are now installed as `npm:@preact/compat`, and Vite uses `@preact/preset-vite`. Code still imports `react`, so moving back is a dependency change only. Result: 58.9 KB. Base UI (RadioGroup, Popover) works on Preact: proven by the component tests and the E2E suite on both browsers.
- **`@testing-library/preact`** replaces `@testing-library/react`, so component tests run the same runtime as production.
- **`eslint-plugin-jsx-a11y` dropped:** it does not support ESLint 10. Accessibility is checked with axe in the E2E suite (empty and filled states) instead.
- **Engine additions** (M1 gates still apply):
  - `previewStop(raw)` shows the tick and derived stop as soon as entry and stop are valid, before equity and risk are filled in.
  - `SizingResult.entry`.
  - `toDecimalString(..., 'up')` for risk figures (M2-D4).
  - `PLACES` exported for messages.
- **Number grouping:** `Intl.NumberFormat('en-IN')` formats only the integer part, as a BigInt, after exact rounding. This avoids passing decimal strings to `Intl`, which the ES2022 TypeScript types don't allow; the result is the same.
- **Fewer component files than listed:** stop, risk and "more" sections live in `InputsPanel.tsx`; binding notice, copy bar and empty/zero states live in `ResultPanel.tsx`.
- **The "Quantity copied" announcement sits outside the copy button,** so the button's accessible name stays short ("Copied ✓", not "Copied ✓ Quantity copied").
- **Fonts are not preloaded:** Vite hashes the font file names. The fonts load with `font-display: swap`, and preloading can come with M4's build plugins.
- **No Guide link or settings button in the top bar yet** (M3/M4); the bar shows the wordmark and a one-line description.
