# Plan: Correct Sizing Engine

**Source PRD**: `.claude/prds/r2size.prd.md`
**Selected Milestone**: 1 — Correct sizing engine
**Complexity**: Medium
**Also governed by**: `.claude/prds/r2size.architecture.md` (§2 layout, §3 engine, §9 M1 testing, §11 decisions D1–D12), NSE circular NSE/CMTR/67133

## Summary

Build `src/engine`, a pure, framework-free TypeScript module. `computeSizing(raw)` turns the raw form strings into a quantity, risk, caps, binding constraint and R table, using exact BigInt fractions (no floating point anywhere money is involved). The milestone is done when about 30 hand-derived worked examples, property tests and a reference-implementation cross-check all pass, with 100% branch coverage of the engine and a mutation score of at least 90%. There is no UI in this milestone; the Vite/React app is scaffolded in Milestone 2.

## Patterns to Mirror

The repo has no source code yet, so there is no existing pattern to mirror. These conventions are set by the accepted architecture and are established in this milestone:

| Category | Source | Pattern |
|---|---|---|
| Naming | `r2size.architecture.md` §2 | kebab-case files (`tick-bands.ts`), camelCase functions, PascalCase types; one concern per file |
| Errors | `r2size.architecture.md` §3 "Types" | No throwing. Return `SizingOutcome` with `FieldError { field, code, blocking }`; codes only, wording lives in the UI |
| Logging | — | None. The engine is pure and offline, with no console output (lint-enforced) |
| Data access | — | None. The engine has no I/O; the NSE table is a typed constant |
| Tests | `r2size.architecture.md` §9 | Vitest in a `node` environment; tests in `src/engine/__tests__/`; fixtures in `src/engine/__fixtures__/`; table-driven `it.each`; fast-check for properties |

## Files to Change

| File | Action | Why |
|---|---|---|
| `package.json` | CREATE | pnpm scripts: `typecheck`, `lint`, `test`, `test:coverage`, `test:mutation`; dev deps only |
| `pnpm-lock.yaml` | CREATE | Reproducible installs |
| `.nvmrc` | CREATE | Pin Node 24 LTS |
| `tsconfig.json` | CREATE | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `target: ES2022` (BigInt literals) |
| `vitest.config.ts` | CREATE | `node` env for `src/engine`; v8 coverage with 100% thresholds on `src/engine/**` (fixtures and tests excluded) |
| `eslint.config.js` | CREATE | Flat config + typescript-eslint; in `src/engine`, ban `parseFloat`, `Number(`, `Math.*`, `toFixed`, `window`, `document`, `localStorage`, `console`, and any import from outside `src/engine`; ban network APIs in `src/` |
| `.prettierrc`, `.editorconfig` | CREATE | Formatting |
| `.gitattributes` | CREATE | `* text=auto eol=lf` (removes the CRLF warnings seen in earlier commits) |
| `.gitignore` | CREATE | `node_modules`, `coverage`, `reports`, `.stryker-tmp` |
| `stryker.config.mjs` | CREATE | Vitest runner, mutate `src/engine/**/*.ts` except tests/fixtures, `thresholds.break: 90` |
| `.github/workflows/ci.yml` | CREATE | Runs typecheck, lint, test:coverage on push/PR; mutation testing on PRs that touch `src/engine` |
| `src/engine/types.ts` | CREATE | `Rational`, `RawForm`, `SizingInput`, `StopSpec`, `RiskSpec`, `SizingResult`, `RRow`, `SizingOutcome`, `FieldId` |
| `src/engine/errors.ts` | CREATE | `ErrorCode`, `WarningCode`, `FieldError`, `Warning` |
| `src/engine/rational.ts` | CREATE | Exact fractions: `q`, `add`, `sub`, `mul`, `div`, `cmp`, `eq`, `lt`, `min`, `floor`, `isPositive` |
| `src/engine/decimal.ts` | CREATE | Strict decimal-string grammar → `Rational`; `Rational` → fixed-decimal string (for tests and the Guide) |
| `src/engine/tick-bands.ts` | CREATE | `NSE_TICK_TABLE` (circular 67133), `autoTick`, `nearBandEdge`, `floorToTick`, `isOnTick` |
| `src/engine/validate.ts` | CREATE | `RawForm` → `SizingInput` or all `FieldError`s, with bounds and decimal limits |
| `src/engine/stop.ts` | CREATE | Stop by price / % / ATR, tick flooring, `0 < stop < entry` |
| `src/engine/size.ts` | CREATE | Risk per share (D1), budget, three quantities, caps (D3), binding + ties, zero-quantity causes (D9), actuals |
| `src/engine/r-table.ts` | CREATE | R rows (D2, D4, D8) |
| `src/engine/index.ts` | CREATE | `computeSizing(raw: RawForm): SizingOutcome` + re-exports |
| `src/engine/__fixtures__/worked-examples.ts` | CREATE | ~30 hand-derived cases, each with a derivation comment (single source; the Guide reuses it in M4) |
| `src/engine/__tests__/*.test.ts` | CREATE | Unit tests per module, worked examples, properties, reference cross-check |
| `src/engine/__tests__/reference-oracle.ts` | CREATE | Independent, deliberately simple implementation using scaled BigInt (scale 10^18) |
| `docs/sources/CMTR67133.pdf` | MOVE | From the repo root; the cited source for the tick table |
| `.claude/prds/r2size.prd.md` | UPDATE | Milestone 1 row → `in-progress` + plan path (now); → `complete` at the end |

## Tasks

Each engine task is done test-first: write the failing tests, then implement until they pass.

### Task 1: Tooling scaffold
- **Action**: Create `package.json` (`"type": "module"`, `"packageManager": "pnpm@…"`, engines Node ≥ 24), install `typescript`, `vitest`, `@vitest/coverage-v8`, `fast-check`, `eslint`, `typescript-eslint`, `prettier`, `@stryker-mutator/core`, `@stryker-mutator/vitest-runner`. Add `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc`, `.editorconfig`, `.gitattributes`, `.gitignore`, `.nvmrc`, `stryker.config.mjs`. Move the circular PDF to `docs/sources/`.
- **Mirror**: Architecture §1 (stack) and §2 (lint boundary rules).
- **Validate**: `pnpm typecheck && pnpm lint && pnpm test` all succeed on an empty `src/engine/index.ts`. A deliberate `parseFloat` in `src/engine` makes `pnpm lint` fail.

### Task 2: Types and error codes
- **Action**: Write `types.ts` and `errors.ts` from architecture §3. Define `RawForm` (the engine's only input) as raw strings plus mode selectors:
  ```ts
  interface RawForm {
    entry: string;
    stopMode: 'price' | 'percent' | 'atr'; stopPrice: string; stopPct: string; atr: string; atrMultiple: string;
    tick: string;                                   // '' = auto
    riskMode: 'percent' | 'amount'; riskPct: string; riskAmount: string;
    equity: string; availableCash: string; maxAllocationPct: string; costPct: string;
    targets: readonly [string, string, string];
  }
  ```
  The UI merges the saved profile (equity, cash) into `RawForm` before calling the engine. That replaces `computeSizing(form, profile)` from architecture §8, keeping the engine single-input.
- **Mirror**: Architecture §3 type sketch.
- **Validate**: `pnpm typecheck`.

### Task 3: Hand-derived worked examples (before any arithmetic code)
- **Action**: Write `__fixtures__/worked-examples.ts`: about 30 cases of `{ name, raw: RawForm, expect: Partial<expected values as decimal strings / bigint> }`, each with a step-by-step derivation comment. Required cases:
  1. Brief example: equity 20,00,000, 1% risk, entry 100, stop 93 (price), no cost → qty 2,857; investment 2,85,700; allocation 14.285%; actual risk 19,999.
  2. Same with cost 0.25% → cost/share 0.25, total 7.25, qty 2,758, actual risk 19,995.50; R table +1R 107.00 net +18,616.50, stop −19,995.50 (matches the mockup).
  3. PRD cost example: entry 100, stop 95, cost 0.25% → cost/share 0.25.
  4. Float trap: entry 200, 5% stop → stop exactly 190.00 (not 189.99).
  5. Other float traps: entry 1.15 / 0.1-style values; risk % 0.3; cost 0.07%.
  6. Tick band edges (D5, circular 67133): 249.99 → 0.01; 250.00 → 0.05; 1,000.00 → 0.05; 1,000.05 → 0.10; 5,000.00 → 0.10; 5,000.10 → 0.50; 10,000.00 → 0.50; 10,000.50 → 1.00; 20,000.00 → 1.00; 20,001.00 → 5.00.
  7. ATR stop landing exactly on the tick grid; ATR stop off-grid floored (e.g. entry 512.35, ATR 7.3, ×1.5 → raw 501.40 on 0.05 grid; and a case that floors).
  8. Tick override beats auto.
  9. Binding = allocation (with uncapped qty shown); binding = cash (cash ÷ (entry + cost)); risk/cap tie → risk; allocation/cash tie → cash.
  10. Zero quantity from each cause: `qtyZeroRisk`, `qtyZeroAllocation`, `qtyZeroCash`.
  11. Risk as ₹ amount; risk amount > equity → `riskExceedsEquity`.
  12. Validation: stop ≥ entry; derived stop ≤ 0 (e.g. 100% would be rejected by bounds; ATR × multiple ≥ entry → `derivedStopNotPositive`); too many decimals; non-numeric; missing equity.
  13. Targets: user target off-tick (warning, not rounded); target ≤ entry (non-blocking row error, qty still shown); three targets.
  14. Near-band-edge warning at ±10% (e.g. entry 240 → near 250; entry 300 → not near).
- **Mirror**: Architecture §9 "Worked examples".
- **Validate**: The author checks every derivation by hand, or with a spreadsheet using exact arithmetic, before Task 10 is wired up. In Task 11 the reference implementation must also agree on every fixture.

### Task 4: `rational.ts`
- **Action**: Reduced fractions (`gcd`, denominator > 0), arithmetic, comparison, `floor` (for positives, BigInt `/` truncation; reject non-positive with a typed guard), `min`.
- **Mirror**: ADR-002.
- **Validate**: `pnpm test rational`: unit tests plus fast-check properties (associativity, `a/b*b == a`, `floor(x) <= x < floor(x)+1`, results always reduced).

### Task 5: `decimal.ts`
- **Action**: The grammar: digits, at most one `.`; strip `,`, `₹` and spaces; no exponent, no sign; at most 12 integer digits; a per-field decimal limit is passed in (prices 2, % 4, ATR 4, multiple 2). Return `{ ok, value } | { ok: false, code }`. `toFixed(q, places)` uses exact half-up rounding (tests only; display rounding lives in `domain/format.ts`, M2).
- **Mirror**: Architecture §3 "Input precision limits".
- **Validate**: `pnpm test decimal`: accepted/rejected tables (`'1,00,000.50'`, `'₹ 250'`, `'1e3'`, `'-5'`, `'1.234'` with limit 2, `'.5'`, `'5.'`, `''`), and the property parse(format(x)) = x.

### Task 6: `tick-bands.ts`
- **Action**: `NSE_TICK_TABLE` exactly as in architecture §3 (upper-bound + `upToInclusive`, circular 67133). `autoTick(entry)`, `nearBandEdge(entry)` (within ±10% of 250, 1,000, 5,000, 10,000 or 20,000), `floorToTick(p, t)`, `isOnTick(p, t)`.
- **Mirror**: ADR-010.
- **Validate**: `pnpm test tick-bands`: all band-edge fixtures from Task 3 item 6; table invariants (upper bounds and ticks strictly increase; only the last band is open); the effective date string is present.

### Task 7: `validate.ts`
- **Action**: Parse every field and collect *all* errors. Equity is always required (D7). Bounds: 0 < risk% ≤ 100; 0 < stop% < 100; 0 < alloc% ≤ 100; 0 ≤ cost% < 10; positive entry, ATR, multiple, tick, cash. Empty optional fields → absent. `costPct` defaults to 0. Empty targets are skipped.
- **Mirror**: `FieldError` codes from Task 2.
- **Validate**: `pnpm test validate`: one test per error code and per field, plus a test that multiple errors are reported together.

### Task 8: `stop.ts`
- **Action**: Price stop used as typed (warning `priceOffTick` if off grid). Percent stop: `entry × (1 − pct/100)`. ATR stop: `entry − atr × multiple`. Derived stops go through `floorToTick` (D6) and set `adjusted` when the raw value was off grid. Enforce `0 < stop < entry`.
- **Mirror**: Architecture §3 step 3.
- **Validate**: `pnpm test stop`, including the 200 × 5% → 190.00 case.

### Task 9: `size.ts` and `r-table.ts`
- **Action**:
  - Steps 4–10 and the warnings of architecture §3: per-share risk = (entry − stop) + entry × cost% (D1); budget; `byRisk`, `byAllocation`, `byCash` (D3); `quantity` = min; binding with tie rules; `uncappedQuantity`; zero-quantity cause codes (D9); investment, allocation %, actual risk, actual risk %; `highRiskPct` (> 5%) and `cashExceedsEquity` warnings.
  - R table: R = entry − stop; +kR = `floorToTick(entry + kR)` (D4); user targets kept as typed with an `offTick` flag; target ≤ entry gives a non-blocking `targetNotAboveEntry` (D8); P&L = qty × (price − entry) − qty × cost/share; R-multiple = (price − entry)/R.
- **Mirror**: D1–D4, D8, D9.
- **Validate**: `pnpm test size r-table`.

### Task 10: `computeSizing` composition
- **Action**: In `index.ts`: validate → tick → stop → size → R table → warnings. The function is total by construction (no `throw` anywhere in the engine; lint bans `throw` in `src/engine` except in `rational.ts` guard helpers that are unreachable by construction, each covered by a test). Wire the worked-examples test.
- **Mirror**: Architecture §3 "Computation order".
- **Validate**: `pnpm test worked-examples`: every fixture passes.

### Task 11: Property tests + reference cross-check
- **Action**:
  - In `properties.test.ts`, use fast-check generators for valid decimal strings in realistic ranges (entry 0.05–1,00,000; equity 10,000–10 crore; risk 0.01–5%; cost 0–1%) plus arbitrary junk strings. Check every invariant in architecture §9: never throws; ok ⇒ qty ≥ 1; qty × total risk/share ≤ budget; maximality when risk binds; allocation and cash caps respected; qty = min; stop on the grid with raw − tick < stop ≤ raw; monotonicity (risk%↑ ⇒ qty not ↓; wider stop / higher cost / tighter cap ⇒ qty not ↑); stop-row P&L = −actual risk.
  - In `reference-oracle.ts`, write an independent implementation using integers scaled by 10^18 and compare it with the engine on 10,000 random cases and on every fixture.
- **Validate**: `pnpm test properties oracle` with `numRuns` ≥ 1,000 per property (10,000 for the oracle). On failure, fast-check prints a seed so the case can be reproduced.

### Task 12: Coverage + mutation gates, CI
- **Action**: Enforce 100% statements/branches/functions/lines on `src/engine/**` in `vitest.config.ts`. Run Stryker and add tests until the mutation score is ≥ 90%. Add `.github/workflows/ci.yml`.
- **Validate**: `pnpm test:coverage` (thresholds enforced) and `pnpm test:mutation` (break at 90).

### Task 13: Close the milestone
- **Action**: Update the PRD Milestone 1 row to `complete`. Commit, with the fixture file called out for author review in the commit body.
- **Validate**: The full validation block below is green.

## Validation

```bash
pnpm install --frozen-lockfile
pnpm typecheck          # tsc --noEmit
pnpm lint               # eslint . (engine boundary + banned APIs)
pnpm test               # vitest run (unit, worked examples, properties, oracle)
pnpm test:coverage      # 100% thresholds on src/engine
pnpm test:mutation      # stryker run, break < 90
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| A hand-derived fixture is itself wrong, so a test enshrines a bug | Medium | Fixtures are written before the code; every fixture is also checked by the independent reference implementation; the author reviews derivations |
| The engine and the reference implementation share a misunderstanding of a rule (e.g. tie-breaking) | Low | The reference is written from the D1–D12 text, not the engine code; tie and edge cases are explicit fixtures |
| BigInt fractions grow large (big denominators) and slow down property tests | Low | Reduce after every operation; inputs are capped at 4 decimals and 12 integer digits; measure the suite (target < 20 s) |
| Stryker is slow or flaky on Windows | Medium | Mutate only `src/engine`; use `vitest-runner` with `perTest` coverage analysis; run in CI on Linux |
| Lint rule bans (`Number(`, `Math.*`) are too broad (e.g. needed for `bigint` → string) | Low | Allow `String(bigint)` and template literals; narrow exceptions with inline disable comments that need a reason |
| `RawForm` diverges from what the M2 UI needs | Low | `RawForm` mirrors the PRD's inputs one-to-one; M2 adapts the form reducer to it |
| Uncertainty over NSE ticks for ETFs or BSE | Low | Out of scope for the engine: the tick is always overridable; the Guide notes it (M4) |

## Acceptance

- [x] All tasks complete
- [x] Validation passes: typecheck, lint, format, 225 tests, 100% engine coverage (statements, branches, functions, lines), mutation score 98.01%
- [x] All 32 worked examples pass and match the reference implementation (plus 10,000 random setups)
- [x] Band-edge behaviour matches NSE circular NSE/CMTR/67133 exactly
- [x] No floating-point arithmetic on money anywhere in `src/engine` (lint-enforced)
- [x] Patterns established as documented (no existing code to mirror)

## Implementation notes (2026-10-05)

Deviations from the plan, and why:

- **TypeScript pinned to 6.0.x.** TypeScript 7 (the native compiler) is outside typescript-eslint's supported range (< 6.1), and Stryker's TypeScript checker uses the classic compiler API.
- **Vitest pinned to 4.1.x.** Under Vitest 5, Stryker's Vitest runner silently fails to activate mutants: the run "succeeds" with 22.85% because tests never see the mutated code. On Vitest 4.1 the same suite scores 98.01%. Revisit when `@stryker-mutator/vitest-runner` declares Vitest 5 support, and re-check that the score stays above 90%.
- **Stryker plugins are listed explicitly** (`import.meta.resolve`) because pnpm's isolated `node_modules` hides them from auto-discovery.
- **Extra error code `tooManyDigits`** (more than 12 integer digits), separate from `tooManyDecimals`.
- **The R table includes an `entry` row** (P&L = −total cost), as in the design mockup. Rows are sorted highest price first; ties keep the order +kR, targets, entry, stop.
- **Validation owns the cross-field checks** (typed stop ≥ entry, ₹ risk > equity, target ≤ entry), so `stop.ts` only handles derived stops.
- **Surviving mutants (6), all accepted:**
  - 4 equivalent mutants: `<` → `<=` twice in `toDecimalString` (zero has no sign); `t * d` → `t / d` in `floor` (identical for reduced fractions); `blocking: true` for `required` in `validate` (required fields only go to the blocking list).
  - 2 false survivors: `if (true)` / `d !== 0n` in `q()` throw at module load, so every test file fails to import, which Stryker does not count as a kill.
