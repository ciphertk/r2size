# R2Size — Design Direction

*Status: ACCEPTED (2026-10-05). Dark theme only. Mockup: [`design/mockup.html`](../../design/mockup.html) + `design/mockup.css` (open locally in a browser). Related: [r2size.prd.md](r2size.prd.md), [r2size.architecture.md](r2size.architecture.md).*

## Direction

- **Purpose:** turn a setup into a copied quantity in under 15 seconds, without mistakes.
- **Audience:** a swing trader at the moment of execution, often on a phone, usually after market hours or with a chart open beside it.
- **Tone:** a quiet instrument, like an order ticket on a trading desk at night. It's dense, calm and precise, with no decoration.
- **The memorable details:**
  1. **The quantity is the hero.** "2,758 shares" is set big in tabular figures, like a printed ticket.
  2. **The R table is a price ladder.** Rows run top to bottom from +3R down to the stop, with a coloured rail on the left: green above entry, paper-white at entry, vermilion at the stop. It reads like a chart's price axis.
  3. **Colour means something or it isn't there.** The interface is graphite and paper. Colour appears only for gain, loss and caution.

## Anti-slop rules (enforced in review)

| Don't | Do instead |
|---|---|
| Purple, indigo or blue-violet accents, gradients, glows | No accent hue at all. The primary action is paper-white on graphite |
| Tailwind slate/zinc greys, pure `#000` backgrounds | Warm graphite neutrals (hue ~60–80, very low chroma) |
| Inter, Geist or Space Grotesk (the default "AI app" faces) | IBM Plex Sans + IBM Plex Mono (see Typography) |
| Glassmorphism, blur, drop-shadow cards, cards inside cards | One bordered "ticket" surface; everything else sits flat on the background, separated by hairlines |
| Emoji, sparkles, illustrations, vague hero copy | Labels that name the thing ("Entry", "Stop", "Risk"); no marketing copy in the app |
| Pill-shaped everything, 16 px+ radii | 4–6 px radii, rectangular chips |
| Tooltip-on-hover only | Info buttons that open a popover with a Guide link (works on touch) |
| Decorative animation | Only 120 ms colour/border transitions on interaction, disabled under `prefers-reduced-motion` |
| shadcn/ui default look | Headless primitives (Base UI) styled with our own tokens |

## Typography

**Choice: IBM Plex Sans (UI and all numbers) + IBM Plex Mono (ticket line, symbol, R-table labels, wordmark).** Both are open source (OFL), from [github.com/IBM/plex](https://github.com/IBM/plex).

**Why: checked by inspecting the font files, not taken from blogs.** I downloaded 24 open-source candidates from the Google Fonts repo and checked their glyph tables with fontTools:

| Font | ₹ glyph | Digits equal-width by default | Slashed zero (`zero`) | Verdict |
|---|---|---|---|---|
| **IBM Plex Sans** | ✓ | ✓ | ✓ | **Chosen.** Clear `I l 1` and `0 O` distinction; numbers align in columns with no CSS needed |
| **IBM Plex Mono** | ✓ | ✓ | ✓ | **Chosen** as the companion |
| Inter | ✓ | ✗ (needs `tnum`) | ✓ | Rejected: the default AI-app face; `I` and `l` are identical |
| Geist / Geist Mono | ✓ | ✗ / ✓ | ✗ | Rejected: the Vercel/shadcn look; no slashed zero |
| Fragment Mono | ✓ | ✓ | ✓ | Runner-up for the mono role |
| Schibsted Grotesk, Mona Sans, Hubot Sans, Public Sans, Manrope, Figtree | ✓ | ✗ | mixed | Proportional digits by default; fine faces, weaker for numbers |
| JetBrains Mono, Martian Mono, DM Mono, Red Hat Mono, Spline Sans Mono, Azeret Mono | **✗** | ✓ | mixed | **Rejected: no ₹.** The rupee would fall back to a different font mid-number |
| Recursive | ✓ | ✓ | ✓ | Rejected: 2.3 MB source, too heavy |

**Bonus:** the Plex family includes IBM Plex Sans Devanagari, which leaves a clean path to Hindi and other regional languages (a Phase 2 candidate).

**Delivery (self-hosted, no Google Fonts request, CSP `font-src 'self'`):**
- **Subset:** Basic Latin, ₹, ×, −, en/em dash, arrows, ≤ ≥, ✓, curly quotes.
- **Plex Sans:** variable, weights 400–600, 18 KB woff2 (`design/fonts/plexsans-var-400-600.woff2`).
- **Plex Mono:** Regular, 8 KB woff2 (`design/fonts/plexmono-400.woff2`).
- **Total ≈ 26 KB.** Preload the Plex Sans file; use `font-display: swap`; keep the system fallbacks `system-ui` and `ui-monospace`.
- **Kept OpenType features:** `kern liga calt tnum lnum zero case ss01–03`.

**Number rules:**
- Every number uses `font-variant-numeric: tabular-nums lining-nums slashed-zero`, so digits never jitter as you type and columns align.
- Minus is U+2212 (−), not a hyphen. Multiplication is ×.
- Money shows 2 decimals, quantities none. Indian grouping comes from `Intl.NumberFormat('en-IN')`.
- Typed values are never reformatted while the field has focus.

**Type scale (px):**

| Role | Size / weight | Font |
|---|---|---|
| Quantity (ticket) | `clamp(52, 15vw, 72)` / 500, tracking −2% | Plex Sans |
| Quantity (mobile dock) | 26 / 500 | Plex Sans |
| Input values | 20 / 400 | Plex Sans (symbol field in Plex Mono, uppercase) |
| Facts, ladder, body | 14–16 / 400 | Plex Sans |
| Labels | 13 / 400, `--text-2` | Plex Sans |
| Meta, hints, captions | 12 / 400, `--text-3` | Plex Sans |
| Ticket line, ladder levels, BUY tag | 12–14 / 400 | Plex Mono |

## Colour (dark only)

Neutrals are warm graphite with paper-white text. Contrast ratios were computed with the WCAG formula.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--bg` | `#121110` | Page | — |
| `--surface` | `#1a1916` | Ticket, dock | — |
| `--raised` | `#23211d` | Selected segment, hover | — |
| `--field` | `#0d0c0b` | Input wells (recessed, darker than the page) | — |
| `--line` | `#36332d` | Hairlines, dividers (decorative) | — |
| `--field-border` | `#706a5e` | Input, segment and button borders | ≥ 3.0:1 on every surface (WCAG 1.4.11) |
| `--text` | `#ece6d9` | Primary text; primary-button fill | 12.9–15.7:1 |
| `--text-2` | `#aba392` | Labels, secondary | 6.4–7.8:1 |
| `--text-3` | `#948c7c` | Meta, hints, captions | ≥ 4.8:1 on every surface |
| `--gain` | `#6cc08e` | BUY tag, positive P&L, ladder rail above entry | ≥ 7.3:1 |
| `--loss` | `#ef7a5e` | Stop price, negative P&L, stop rail (vermilion, not pink) | ≥ 5.8:1 |
| `--caution` | `#e8b04a` | Stale profile, tick near a band edge, off-tick warnings | ≥ 8.2:1 |
| `--focus` | `#9cc3e6` | Focus ring only (the one cool hue, so focus is never confused with meaning) | ≥ 8.7:1 |

**Rules:**
- **The primary button is `--text` on `--bg`** (15:1), not a coloured fill. There is one primary button per view.
- **Gain and loss are never shown by colour alone.** Every value carries a sign (+ / −), and the ladder rows are labelled.
- **No alpha-blended text.** Every text colour is solid, so its contrast can be verified.
- **Browser chrome:** `<meta name="color-scheme" content="dark">` and `theme-color #121110`. No light theme and no theme toggle.

## Layout

**Mobile (≤ 879 px): inputs first, result docked.**
1. **Top bar:** "R2Size" wordmark (Plex Mono), Guide link, settings button.
2. **Profile strip:** equity, cash and "Updated N days ago" (caution colour when stale), plus an Update button.
3. **Preset chips:** a single row that scrolls sideways. The selected chip has a paper border.
4. **Inputs:**
   - Symbol and Entry share a row.
   - Stop: method as a segmented control, then the value with the derived stop shown in vermilion beside it, then the tick hint.
   - Risk: unit as a segmented control, then the value.
   - "Limits, costs & targets" is a disclosure.
5. **Ticket:** facts and the full set of copy buttons.
6. **Price ladder,** then the gap-risk note.
7. **Fixed bottom dock:** "BUY 2,758 · risk ₹19,995.50" and a **Copy qty** button within thumb reach. It updates live while you type, so the 15-second path is preset → entry → stop → Copy without scrolling. It respects `safe-area-inset-bottom`.

**Desktop (≥ 880 px):** two columns, max 1080 px wide. Inputs on the left. The ticket and ladder sit in a 440 px column on the right that stays in place as you scroll. The dock is hidden.

**Spacing and touch:**
- Spacing scale is 4 / 8 / 12 / 16 / 24 / 32.
- Inputs and buttons are ≥ 48 px tall; chips 36 px (within a 44 px tap area including the gap); icon buttons 44 px.

**Ticket anatomy:**
- BUY tag (left) and the binding constraint (right).
- The quantity.
- Mono ticket line: `RAYMOND @ 100.00 SL 93.00`.
- A dashed tear line, then a 2 × 2 facts grid: Risk, Investment, Risk/share, Cap room.
- A full-width **Copy qty** button, then four equal buttons: Entry, Stop, T1, All.

## Components: open source, headless, styled by us

The architecture's strict CSP (`style-src 'self'`, Trusted Types) rules out libraries that inject `<style>` tags or CSS-in-JS at runtime. That decided the choice.

| Need | Component | Source | Notes |
|---|---|---|---|
| Info tips (glossary popovers) | `Popover` | **Base UI** — [github.com/mui/base-ui](https://github.com/mui/base-ui) (MIT) | Opens on tap or click, not hover |
| Reset confirmation | `AlertDialog` | Base UI | |
| Import preview, preset editor, settings sheet | `Dialog` | Base UI | |
| "Copied ✓" confirmation, update-available banner | `Toast` | Base UI | The update toast stays until dismissed |
| "Limits, costs & targets" disclosure | `Collapsible` | Base UI | Or native `<details>`, as in the mockup |
| Stop method, risk unit, preset chips | `RadioGroup` / `ToggleGroup` | Base UI | Real radio semantics, arrow-key navigation |
| Icons | Phosphor Icons | [github.com/phosphor-icons/react](https://github.com/phosphor-icons/react) (MIT) | Regular weight, 20 px, per-icon imports; about 6 icons total (settings, info, copy, check, plus, warning) |
| Numeric inputs | **Our own `NumberField`** on a native `<input inputmode="decimal">` | — | Base UI's `NumberField` and React Aria's `NumberField` both parse to a JS float, which breaks the engine's exact-decimal rule (ADR-002) |
| Preset picker on mobile | Chips (above) | — | Faster than a dropdown for 2–5 presets |

**Base UI setup:** wrap the app in `<CSPProvider disableStyleElements>` (from `@base-ui/react/csp-provider`). We don't use `ScrollArea` or the `Select` option that aligns the list with its trigger (`alignItemWithTrigger`), which are the only parts that inject `<style>`. Base UI sets positioning through `element.style` (the CSSOM), which `style-src 'self'` allows.

**Why not the alternatives:**
- **Radix Primitives:** `Select` and `ScrollArea` inject `<style>` through `dangerouslySetInnerHTML`. That breaks `style-src 'self'` and Trusted Types (radix-ui/primitives #2057, #3117).
- **shadcn/ui:** requires Tailwind and produces the most recognisable "AI app" look.
- **React Aria:** excellent accessibility, but larger per component, and its `NumberField` uses floats.
- **MUI, Mantine, Chakra:** runtime CSS-in-JS or large bundles.

## States to design in implementation

- **Empty (first run):** the profile strip says "Add your equity to start". The ticket shows "—" and a one-line hint. The dock is hidden until there's a quantity.
- **Error:**
  - The field border turns `--loss` and a message sits below the field (`aria-describedby`).
  - A zero quantity shows its cause in the ticket ("Risk budget too small for 1 share at this stop"), and the quantity shows "0" in `--text-3`.
- **Capped:** the binding constraint reads "Limited by cash · uncapped 4,120" in `--caution`.
- **Near band edge:** the tick hint turns `--caution`: "Tick 0.05 · near ₹250 band edge — check your broker".
- **Copied:** the button label swaps to "Copied ✓" for 1.5 s and a polite live region announces it. No toast is needed for copies on mobile.

## Changes this makes to the architecture

- **Dark only:**
  - remove the theme setting, `theme-init.js` and `light-dark()`
  - `settings.theme` is dropped from `StoredDocV1`
  - `color-scheme: dark` is set in CSS and in a meta tag
- **Self-hosted subset fonts (≈ 26 KB):** this replaces "no web fonts". The CSS budget stays ≤ 15 KB; the fonts get their own ≤ 30 KB budget.
- **Base UI + Phosphor added to the stack;** Base UI runs inside `CSPProvider disableStyleElements`.
