# R2Size — Product Brief

_v3 · 2026-10-05 · **Offline-only.** Supersedes v1/v2 (broker and market-data integrations removed)._

**What it is:** an offline, installable (PWA) position-size calculator for Indian swing traders. You type the numbers, R2Size sizes the trade, and you copy the values into your broker app yourself.

**Verdict: GO.** Small, buildable in 1–2 weeks, no infrastructure beyond static hosting on Cloudflare Pages.

---

## 1. Who and why

**User:** an Indian retail swing trader in cash equity (CNC/delivery), with an account of about ₹5L–₹1Cr, who sizes by fixed-fractional risk ("1% rule"). Long-only, because Indian cash equity can't hold a short overnight.

**Job:** "Given my capital, entry, stop and risk budget, how many shares do I buy?", answered in seconds on a phone, then pasted into Dhan/Kite/Upstox.

**Honest positioning:** without integrations, the math is a commodity. R2Size wins only on these:
1. **Speed:** opens instantly, works offline, live recalculation, one-tap copy.
2. **Correctness details other calculators skip:** tick rounding, floored quantity, available-cash and allocation-cap limits with the binding constraint shown, costs.
3. **Zero data leaves the device**, and this can be *verified*: the page is technically blocked from making any network calls after load (§6).
4. **Built for India:** ₹, lakh/crore formatting, NSE tick sizes, CNC assumptions.

## 2. Architecture (all of it)

```
Cloudflare Pages (static files only)
        │  first visit / updates
        ▼
Browser / installed PWA ── service worker cache ── works offline
        │
        └── localStorage: settings, account profile, presets
            (nothing is sent anywhere)
```

No backend, no APIs, no accounts, no relay, no tokens.

## 3. Features: Phase 1 (MVP)

### 3.1 Calculation core
- Pure, unit-tested `calc` module with no UI dependencies
- Risk ₹ = equity × risk % (or risk entered as ₹, with the % shown)
- Risk/share = entry − stop (+ optional cost per share)
- Quantity = floor(risk ₹ ÷ risk/share)
- Investment, allocation %, **actual** risk ₹ and % (from the floored quantity)
- Validation with clear messages: stop ≥ entry, qty < 1 ("risk budget too small for this stop"), empty or zero inputs

### 3.2 Inputs
| Input | Options |
|---|---|
| Symbol | **Optional** free-text label (auto-uppercased). Not used in any calculation. Shown in the results header and "Copy all" text, and omitted when blank. No search, no lookup. |
| Entry price | Manual |
| Stop | **Price**, **% below entry**, or **ATR × multiple** (ATR typed in from the user's chart) |
| Risk | **% of equity** or **₹ amount** |
| Account equity | Manual. Saved in the account profile (§3.5) |
| Available cash | Manual. Optional, saved in the account profile |
| Max allocation % | Optional cap |
| Round-trip costs % | Optional, default 0 |
| Target price(s) | Optional, up to 3, for the R table |

**Tick rounding:** derived stops (% / ATR) round **down** to a valid tick, so risk never exceeds budget. The tick is auto-suggested from the entry price using NSE's price bands (since 15 Apr 2025: <₹250 → ₹0.01, ₹250–1k → ₹0.05, ₹1k–5k → ₹0.10, ₹5k–10k → ₹0.50, ₹10k–20k → ₹1, >₹20k → ₹5) and is always overridable. NSE reassigns ticks monthly from the prior month's close, so the auto value is an estimate near band edges.

### 3.3 Results
- Headline: **Buy 2,857 shares**
- Under it: investment, allocation %, risk ₹, risk %, risk/share
- **Binding constraint** label: what limited the size, among risk budget, allocation cap and available cash. If a cap applies, show the risk-based quantity too ("Limited by available cash — risk-based size was 4,000"). Nothing is reduced without the user seeing it.
- **R table:** stop hit (−1R), +1R, +2R, +3R, plus any typed target, each with price, ₹ P&L and account %. Labelled "scenarios, not forecasts."
- One-line reminder: gaps can blow through a stop, so the real loss can exceed 1R.

### 3.4 Copy (replaces order placement)
- Separate copy buttons for **Quantity**, **Entry**, **Stop**, **Target**, each showing "Copied ✓"
- **Copy all** as one line: `RAYMOND · BUY 2,857 · LMT ₹100.00 · SL ₹93.00 · TGT ₹114.00`
- Copied numbers are plain digits (`2857`, `100.00`) so they paste cleanly into broker number fields. Commas appear on screen only.

### 3.5 Account profile (replaces the broker fetch)
- Saved equity and available cash, with a **"last updated" date**
- Gentle nudge when older than a set number of days (default 7): "Equity last updated 12 days ago — still ₹20,00,000?"
- One-tap "Update" from the calculator

### 3.6 Presets
- Create / rename / edit / delete / apply
- A preset stores: risk %, stop method + value (e.g. 2× ATR), max allocation %, costs %
- Ships with editable defaults: Conservative (0.5%), Standard (1%)

### 3.7 PWA and app shell
- **Installable:** web app manifest, icons (192/512 + maskable), standalone display, theme colour
- **Offline:** service worker precaches the whole app, so it works with no network after the first visit
- **Install prompt:** an "Install app" button on Android/desktop Chrome and Edge. On iOS Safari, which has no install prompt, a one-time hint: "Share → Add to Home Screen"
- **Updates:** "New version available — Reload" banner. Never auto-reload mid-calculation.
- **Storage durability:** request persistent storage (`navigator.storage.persist()`). Browsers, especially iOS Safari, can clear site data from non-installed sites after inactivity, which is another reason to encourage installing.
- **Backup:** **Export / Import** of settings, profile and presets as a JSON file. That's the only way to move data between devices, and it doesn't need a server.
- Mobile-first layout, keyboard-friendly on desktop, numeric keypad on phones (`inputmode="decimal"`)
- Light/dark (follows the system), ₹ formatting with the Indian grouping `20,00,000`
- Inputs mirrored in the URL, so a setup can be bookmarked and shared. The URL never contains the account profile; equity stays local.
- "Reset all data" in Settings

### 3.8 Trust page
- Plain-language explanation of the formulas, with a worked example
- Privacy statement (§6)
- Link to the source code

## 4. Features: Phase 2

All offline, no integrations.

| Feature | Why later |
|---|---|
| **Portfolio heat** (manual open-positions list: symbol, qty, entry, stop → total open risk; new trade shows heat before → after) | High value for swing traders, but it's a second screen plus data entry |
| **Pyramiding**: size an add-on so the *combined* position stays within risk | Depends on the open-positions list |
| **Compare stops** side by side (e.g. 5% vs 2× ATR vs a price stop) | Nice to have; Phase 1 recalculates live anyway |
| **Breakeven / trailing-stop helper** (new stop → locked-in R) | Post-entry use case, outside the core job |
| **Detailed Indian cost model** (STT, exchange, SEBI, stamp duty, GST, DP charges) replacing the flat % | Rates change; needs upkeep |
| **Recent sizing history** (last ~20 calculations, local only) | Useful, but not needed to prove repeat use |
| **Multiple account profiles** (e.g. two demat accounts) | Most users have one |
| **Hindi / regional language UI** | After product-market fit |

## 5. Out of scope

| Out of scope | Reason |
|---|---|
| Broker API integration (Dhan, Kite, Upstox) | Decided 2026-10-05: everything offline |
| Live prices, symbol search/autocomplete, instrument lists | Needs a market-data API |
| Automatic ATR / historical data | Needs a market-data API (ATR is entered manually) |
| Recent-low / previous-day-low stops from data | Needs data (the user can type the low as a price stop) |
| Order placement, deep links that pre-fill orders | No integrations; the user copies and pastes |
| User accounts, login, cloud sync | No backend; Export/Import covers device moves |
| Backend, relay, server of any kind | Static hosting only |
| Intraday/MIS, F&O, options, short selling | Different sizing math; not the target user |
| Trade ideas, signals, screeners | Not the job |
| Trade journal, P&L tracking | Separate product |
| Multi-currency / non-Indian markets | INR-only until asked |
| Browser extension, native/desktop app | The PWA covers install on mobile and desktop |
| Push notifications, reminders | Nothing to notify about offline |
| Third-party analytics, ads, tracking scripts | Breaks the privacy promise |

## 6. Privacy: now simple and verifiable

> "R2Size runs entirely on your device. After the page loads, it makes no network requests. Your numbers, account size and presets are stored only in your browser, and nothing is sent anywhere. You can check this yourself: the page's security policy blocks all outgoing connections."

How that's enforced:
- **Content-Security-Policy:** `default-src 'self'; connect-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`. No inline scripts, no third-party origins.
- No external fonts or CDNs; everything is bundled
- Usage counting comes only from **Cloudflare's server-side request stats**, which need no script on the page and set no cookies

## 7. How we know it's working

| Signal | Target (60 days post-launch) | Source |
|---|---|---|
| Repeat use | ≥5 recruited swing traders using it weekly for 4+ weeks | Direct check-ins |
| Installs | Recruited users install the PWA rather than bookmarking it | Ask them |
| Copy use | Most sized trades end with a copy action | Ask them / observe a session |
| Organic pull | Issues or requests from strangers | GitHub |
| Traffic | Steady weekly returning visits | Cloudflare request stats |

**Kill signal:** if recruited users go back to their spreadsheet or TradingView within 30 days, the offline calculator isn't enough. Revisit integrations then, armed with what users actually ask for.

## 8. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Commodity, low differentiation | Medium | Win on speed, correctness and verifiable privacy; cheap to test |
| Sizing bug → user enters a wrong quantity | High | Pure calc module + unit and property tests; worked example on the trust page |
| Stale account equity (no broker fetch) | Medium | "Last updated" date + staleness nudge (§3.5) |
| iOS clears local data | Medium | Persistent-storage request, install encouragement, Export/Import |
| Stale cached app after a fix | Low | Update banner; versioned service worker |
| NSE tick-size rules change | Low | Tick is a setting, not hard-coded |

## 9. Stack (no backend)

**Decided (2026-10-05):** **Vite + React**, hosted on **Cloudflare Pages**.

**To be finalised later** (candidates only):
- Language: TypeScript
- PWA: vite-plugin-pwa (Workbox) for the manifest and service worker
- Tests: Vitest for the calc module (unit + property tests), Playwright for an offline end-to-end run
- Styling, state management, form handling: open
- CSP served through Cloudflare Pages' `_headers` file

## 10. Next steps

1. Build the `calc` module + tests first, since everything depends on it.
2. Single-screen calculator UI with copy buttons.
3. Account profile + presets + Settings (tick, staleness days, export/import, reset).
4. PWA: manifest, icons, service worker, install prompt, update banner. Test offline in airplane mode on Android and iOS.
5. CSP headers + trust page, then deploy to Cloudflare Pages.
6. Recruit 5–10 swing traders and check in weekly.
7. When ready to build, hand off to `product-capability` (or `/plan`) for the implementation spec.
