# R2Size — Risk-First Position Size Calculator

## Problem
Indian swing traders who size trades by fixed-fractional risk calculate quantity by hand (spreadsheet, phone calculator, TradingView tool) before every trade. That's slow at the moment of execution, and it routinely skips details that change the answer: rounding down, valid NSE price steps, available-cash and allocation limits, and charges. If it stays unsolved, entries are delayed and positions are silently oversized, which is the main way retail accounts take outsized losses.

## Evidence
- Author (an active swing trader) experiences slow manual sizing at execution time, observed directly.
- Similar complaints about manual position sizing seen on x.com, but anecdotal and not quantified.
- Demand beyond the author: **Assumption — needs validation via interviews and usage check-ins with 5–10 swing traders.**

## Users
- **Primary**: Indian retail swing or positional trader in cash equity (CNC/delivery), long-only, account roughly ₹5L–₹1Cr, sizing by risk % (e.g. "1% rule"). Trigger: a setup is identified and an order is about to be placed, or a hypothetical trade is being analysed or backtested by hand.
- **Secondary**: the author, as a portfolio showcase of a production-quality, offline-first web app.
- **Not for**: intraday/MIS traders, F&O/options traders, short sellers, long-term investors without stops, non-INR markets.

## Hypothesis
We believe **an offline, installable, India-specific position-size calculator with one-tap copy of the results** will **make trade sizing fast and correct** for **Indian swing traders**.
We'll know we're right when **the author and ≥5 other swing traders use it for every trade, weekly, for 4+ consecutive weeks, and get from opening the app to a copied quantity in under 15 seconds.**

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Repeat use (primary) | ≥5 non-author traders weekly for 4+ weeks | Direct weekly check-ins with recruited users |
| Time to size | < 15 s from app open to copied quantity | Timed sessions with users (target TBD — validate against the first prototype) |
| Sizing correctness | Zero known incorrect quantities | Test suite on the sizing rules + worked examples; user-reported issues |
| Works offline | 100% of features usable with no network after first visit | Airplane-mode test on Android and iOS |
| Installable | Installs as an app on Android, iOS (Add to Home Screen) and desktop Chromium | Manual check per platform |
| Showcase quality | Lighthouse performance, accessibility and best-practices ≥ 90 | Lighthouse audit on the production URL |
| Data stays local | No network requests after load (the only traffic is the browser's own app-update check when the app is opened online) | Automated request-recording E2E test + browser network panel + enforced security policy (`connect-src 'none'`) |

## Scope
**MVP** — a single-screen calculator that is fully offline and installable:
- **Inputs:**
  - Optional symbol label
  - Entry price
  - Stop by price, % below entry, or ATR × multiple (ATR typed in by the user)
  - Risk as % of equity or ₹ amount
  - Account equity, optional available cash, optional max allocation %, optional round-trip cost %, up to 3 optional targets
- **Sizing rules:**
  - Quantity rounds down to whole shares
  - Risk and allocation shown are the actual values for the rounded-down quantity
  - Derived stops are rounded to a valid NSE price step, away from entry
  - Invalid inputs (stop ≥ entry, quantity < 1, missing values) give clear messages
- **NSE price step (tick size):** auto-suggested from the entry price using NSE's price bands (circular NSE/CMTR/67133, effective 15 Apr 2025: below ₹250 → ₹0.01; ≥ ₹250 to ₹1,000 → ₹0.05; > ₹1,000 to ₹5,000 → ₹0.10; > ₹5,000 to ₹10,000 → ₹0.50; > ₹10,000 to ₹20,000 → ₹1.00; > ₹20,000 → ₹5.00), always user-overridable. ETFs are excluded from these bands, so ETF traders must check the tick. NSE assigns ticks monthly from the prior month's close, so the auto value is an estimate near band edges, and the UI must say so.
- **Results:**
  - Headline "Buy N shares"
  - Investment, allocation %, risk ₹ and %, risk per share
  - Which constraint limited the size (risk budget, allocation cap or available cash), showing the uncapped quantity when a cap applies
  - R table (stop hit, +1R/+2R/+3R, user targets) labelled as scenarios, not forecasts
  - Gap-risk reminder
- **Copy:** one-tap copy of quantity, entry, stop and target as plain numbers, plus a "Copy all" summary line (symbol omitted when blank).
- **Account profile:** saved equity and available cash with a last-updated date and a reminder when out of date (default 7 days).
- **Presets:** create, rename, edit, delete, apply (risk %, stop as % below entry or ATR multiple, allocation cap, costs %). A stop price or ATR value is stock-specific and is never stored in a preset.
- **App:** installable, works fully offline, update notice (never reloads mid-calculation), Export/Import backup of local data, reset all data, dark theme only (see [r2size.design.md](r2size.design.md)), Indian number formatting (₹20,00,000), numeric keypad on mobile.
- **Shareable setups:** trade inputs encoded in the URL. The account profile is never included.
- **Guide & trust page:** a glossary explaining every input and output term (entry, stop methods, ATR, risk %, equity vs available cash, allocation, cost %, tick size, R-multiple, binding constraint), formulas with a worked example, tick-band table with its effective date, privacy statement (nothing leaves the device), link to the source code. Every field has a short inline info tip linking to its Guide entry.

**Out of scope**
- Broker API integration (Dhan, Kite, Upstox) — decided 2026-10-05: fully offline product
- Live prices, symbol search, instrument lists, automatic ATR, data-driven recent-low stops — require market data
- Order placement or pre-filled order links — user copies and pastes manually
- User accounts, login, cloud sync, any server-side component — local-only; Export/Import covers moving devices
- Bulk/CSV sizing for backtests — not requested; revisit only if the author asks
- Portfolio heat, pyramiding, stop comparison, trailing-stop helper, detailed Indian charges model, sizing history, multiple accounts, regional languages — Phase 2 candidates, after the MVP is validated
- Intraday/MIS, F&O, options, short selling — different sizing rules, not the target user
- Trade signals, screeners, trade journal — not the job
- Multi-currency or non-Indian markets — INR-only
- Browser extension, native or desktop apps — the installable web app covers mobile and desktop
- Notifications, third-party analytics, ads or tracking — break the offline and privacy promise

## Delivery Milestones
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Correct sizing engine | Every sizing rule (risk, rounding, NSE tick, caps, costs, R values) produces verified-correct results for the worked examples | complete | [.claude/plans/r2size-m1-sizing-engine.plan.md](../plans/r2size-m1-sizing-engine.plan.md) |
| 2 | Usable calculator | A trader can enter a setup and copy the quantity, entry and stop in under 15 s on a phone | complete | [.claude/plans/r2size-m2-usable-calculator.plan.md](../plans/r2size-m2-usable-calculator.plan.md) |
| 3 | Remembers the trader | Account profile with a staleness reminder, presets, shareable URL setups, Export/Import | pending | — |
| 4 | Installable & offline | App installs on Android, iOS and desktop and works in airplane mode; trust page live; publicly deployed | pending | — |
| 5 | Validated with users | Author + ≥5 traders using it weekly for 4 weeks; feedback captured to decide Phase 2 | pending | — |

## Decisions (2026-10-05)
- **Cost % basis:** round-trip cost % is applied to the **entry value only**: cost per share = entry × cost %. It's simpler to explain, and since stop < entry it slightly *overstates* cost, so the risk budget is never exceeded. The difference from an exact buy-and-sell split is negligible (e.g. ₹0.250 vs ₹0.244 per share at ₹100/₹95, 0.25%). Flat DP charges are not modelled in the MVP.
- **Tick-band updates:** NSE tick bands live in one dated table, with the effective date shown in the Guide. When NSE revises the bands, the author updates the table and redeploys. Installed apps pick up the new version the next time they open online (update notice), and the tick stays user-overridable in the meantime. The author checks NSE circulars periodically.
- **BSE and terminology:** no BSE-specific logic. Ticks are labelled "NSE", with a note that BSE may differ and the tick can be overridden. A **Guide** page explains every input and output term, and each field has a short inline info tip linking to it.
- **Validation recruitment:** an x.com post aimed at swing traders, inviting them to try the tool. Respondents become the Milestone 5 cohort.

## Sizing & Architecture Decisions (2026-10-05)
Accepted from the architecture review. Full rationale in [r2size.architecture.md](r2size.architecture.md).

**Sizing rules (Milestone 1 contract):**
- **D1 Cost in risk:** total risk per share = (entry − stop) + entry × cost%. Quantity = floor(risk budget ÷ total risk per share).
- **D2 R definition:** R = entry − stop (price-based). R-table P&L is net of cost per share, so the stop row equals −actual risk (matching the headline) and +1R nets slightly under 1R. The Guide explains this.
- **D3 Caps:** allocation cap = floor(equity × allocation% ÷ entry). Cash cap = floor(available cash ÷ (entry + cost per share)). Final quantity = min(risk, allocation, cash); ties go to "risk", and a tie between the two caps is reported as "cash".
- **D4 Tick rounding of targets:** +1R/+2R/+3R prices are rounded down to the tick (toward entry). User-typed entry, stop and targets are never rounded; a warning shows when they are off the tick grid.
- **D5 Band edges (verified against NSE/CMTR/67133):** a price below ₹250 uses ₹0.01, and exactly ₹250 starts the ₹0.05 band. Every other boundary belongs to the **lower** band: exactly ₹1,000 → ₹0.05, ₹5,000 → ₹0.10, ₹10,000 → ₹0.50, ₹20,000 → ₹1.00.
- **D6 Derived stops:** floored to the tick grid, i.e. "away from entry" for long trades (same as "round down").
- **D7 Equity:** always required, including when risk is entered in ₹.
- **D8 Bad targets:** a target ≤ entry is a non-blocking error on its row; the quantity is still shown.
- **D9 Zero quantity:** a distinct message for each cause (risk budget, allocation cap, available cash).
- **D10 Presets:** store risk %, % stop or ATR multiple, allocation cap and cost % only.
- **D11 Tick estimate warning:** shown when entry is within ±10% of a band boundary.
- **D12 Staleness:** counted in calendar days in the device's local time.
- **Precision:** all money arithmetic is exact (no floating point). Inputs accept at most 2 decimals for prices and 4 for percentages and ATR; extra precision is a validation error, never silently rounded.

**Architecture:**
- Stack: Vite + React 19 + TypeScript (strict), Valibot, vite-plugin-pwa, Vitest + fast-check, Playwright, Lighthouse CI, Cloudflare Pages.
- Security policy uses `connect-src 'none'` (supersedes the brief's `connect-src 'self'`); no telemetry and no update polling.
- Shareable setups live in the URL hash (`#v=1&…`), so they never reach the server; the share format has no field for equity or cash.
- Local data is one versioned document in localStorage with migrations; Import replaces (never merges) and keeps an undo copy.
- Update notice is user-triggered only; trade inputs survive the reload via the URL hash.
- Milestone 1 gate: ~30 hand-checked worked examples, property tests (e.g. actual risk ≤ budget), 100% branch coverage of the engine, mutation score ≥ 90%.

## Open Questions
- [ ] Is the 15-second time-to-size target right? Milestone 2 is built (a scripted run copies in under 5 s); now time real sessions on an iPhone and an Android phone.
- [ ] Default stale-profile reminder interval: 7 days is assumed. Validate with users in Milestone 5.
- [x] NSE tick-band boundaries — resolved 2026-10-05 from circular NSE/CMTR/67133 (see D5).

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sizing error leads a user to enter a wrong quantity | Low | High | Milestone 1 gate: full test coverage of sizing rules, worked examples on the trust page |
| Auto tick size wrong for a stock near a band edge | Medium | Low | Tick always shown and overridable; UI notes it's an estimate |
| Low differentiation (free calculators exist) | High | Medium | Compete on speed, India-specific correctness and verifiable privacy; cheap to test; kill signal is users returning to spreadsheets within 30 days |
| Stale account equity (no broker connection) | Medium | Medium | Last-updated date and staleness reminder |
| Browser clears local data (notably iOS) | Medium | Medium | Encourage install, request persistent storage, Export/Import backup |
| Users see an outdated cached version after a fix | Low | Medium | Visible update notice |
| iOS keeps separate storage for Safari and the installed app | High | Medium | Install hint says to set up the profile after installing; Export/Import bridges the two |
| Cloudflare features (Web Analytics, Rocket Loader) inject scripts | Low | Medium | Keep them off in the dashboard; no-network test runs against the production URL |

---
*Status: DRAFT — requirements and architecture accepted ([r2size.architecture.md](r2size.architecture.md)). Implementation planning pending via /plan.*
*Source: PRODUCT-BRIEF.md v3 (2026-10-05). Tick sizes: [NSE circular NSE/CMTR/67133](https://nsearchives.nseindia.com/content/circulars/CMTR67133.pdf) (13 Mar 2025), effective 15 Apr 2025; broker summaries ([Zerodha bulletin](https://zerodha.com/marketintel/bulletin/408151/revision-in-tick-size-for-nse-derivatives-and-cash-segment-from-april-15-2025), [Fyers notice](https://fyers.in/notice-board/tick-size-revision-for-nse-derivatives-cash-segment-effective-april-15-2025/)).*
