# R2Size — Design Direction: "Three-pane Workbench"

*Status: ACCEPTED (2026-10-05, v2). Dark theme only. Related: [r2size.prd.md](r2size.prd.md), [r2size.architecture.md](r2size.architecture.md).*

*History: v1 ("graphite order ticket": IBM Plex, warm graphite, no accent hue, two columns; mockup in `design/mockup.html`) was built in M2–M3. On 2026-10-05 the owner judged it "not good" and asked for a redesign. Prototype rounds compared Terminal, Native, Workbench, Sentence, Ladder, Living table, Price rail and Three-pane variants. The owner chose **Three-pane**: Workbench's command bar and property list, plus a draggable price ladder. v1's typography and colour rules below are replaced; its number rules, accessibility rules and component choices still stand.*

## Direction

- **Purpose:** turn a setup into a copied quantity in under 15 seconds, without mistakes.
- **Audience:** a swing trader at the moment of execution, at a desk with a chart open or on a phone after hours.
- **Tone:** a precise desktop tool in the Linear mould. It is keyboard-first and dense, with hairline structure and one quiet accent.
- **The memorable details:**
  1. **One typed line fills the form.** `tcs 4012.50 sl 3890 risk 1%`: the command bar colours what it understood and previews each clause as a chip before Enter.
  2. **The trade is drawn, and the drawing is an input.** Stop, entry and target are lines on a price axis. Drag them (snapped to the NSE tick) or nudge them with ↑↓. Hover below entry to preview "stop here → N shares", then click to place it.
  3. **The quantity is the hero.** The order card shows it large, then exactly what each copy action will put on the clipboard, each with its shortcut key (C / E / S / T / A).

## Rules (enforced in review)

| Don't | Do instead |
|---|---|
| A second accent, gradients, glows | One indigo accent (`--accent`) on under 5% of pixels: the R2 mark, focus, the active preset dot, the command prompt |
| Colour as decoration | Green and red only for money and the risk / reward zones; amber only for caution |
| Cards inside cards, drop shadows | One bordered order card; everything else sits flat, separated by hairlines |
| Pure `#000`, cold slate greys | Warm near-black `#08090a` and neutral greys |
| Hover-only affordances | Hover styles only under `(hover: hover) and (pointer: fine)`; every action works by tap and keyboard |
| Decorative or slow motion | Ease-out `cubic-bezier(0.23, 1, 0.32, 1)`, under 300 ms, transform / opacity / blur only; `scale(0.97)` on press; nothing animates on keyboard-repeated changes |
| Tooltips on hover | Info buttons that open a popover (Base UI) |
| Marketing copy, emoji | Labels that name the thing ("Entry", "Stop", "Risk") |

## Typography

**Geist (UI) + Geist Mono (numbers in the command bar, ladder, order line, shortcuts).** OFL, from [vercel/geist-font](https://github.com/vercel/geist-font), v1.7.2.

- **Why now:** v1 rejected Geist as "the Vercel look". The owner then chose a Linear-style workbench, where Geist is the native voice. Its ₹ glyph is present, verified with fontTools.
- **Trade-offs:**
  - Geist's digits are proportional by default, so `tabular-nums` is set on `body` and every number aligns.
  - Geist has no slashed zero, so `0` and `O` rely on context. Numbers never sit next to capital O in this UI.
- **Delivery:** self-hosted, so no Google Fonts request (CSP `font-src 'self'`). Both fonts are variable, cut to wght 400–600 with fontTools `instancer`.
  - **Subset:** Basic Latin, ₹, −, ×, ·, arrows, ⇧, ▴▾, dashes and quotes. ✓ falls back to a system font.
  - **Sizes:** `geist-var-400-600.woff2` is 11.9 KB and `geistmono-var-400-600.woff2` 8.8 KB, about 21 KB together against the 30 KB budget. The licence is in `src/assets/fonts/OFL-Geist.txt`.

**Number rules (unchanged from v1):**
- Minus is U+2212 (−); multiplication is ×.
- Money shows 2 decimals, quantities none.
- Indian grouping comes from `Intl.NumberFormat('en-IN')`.
- Typed values are never reformatted while the field has focus.

**Type scale (px):**

| Role | Size / weight |
|---|---|
| Quantity (order card) | `clamp(44, 5vw, 60)` / 600, tracking −3.5% |
| Quantity (phone dock) | 24 / 600 |
| Input values, command line | 16 / 500, so phones don't zoom on focus |
| Body, labels | 14 / 400 |
| Facts, copy actions | 13 |
| Section titles, hints, captions | 12, `--text-3` |
| Order line, ladder tags, shortcut keys | 10–13, Geist Mono |

## Colour (dark only)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#08090a` | Page |
| `--surface` → `--raised-3` | `#101113` `#16171c` `#1e1f25` `#26272e` | Order card, command bar, chips, hover, kbd |
| `--hair` / `--line` | white at 7% / 12% | Dividers; chip and card borders (decorative) |
| `--field-border` | `#5d6270` | The underline under every editable value (≥ 3:1, WCAG 1.4.11) |
| `--text` / `--text-2` / `--text-3` | `#f7f8f8` / `#a8aebb` / `#858b98` | Primary / labels / meta (`--text-3` ≥ 4.5:1 on every surface) |
| `--accent` / `--accent-text` | `#5e6ad2` / `#9aa3f5` | Mark and fills / accent text, focus ring, numbers in the command line |
| `--gain` / `--loss` / `--caution` | `#4cb782` / `#eb5757` / `#f2c94c` | Money, zones, warnings |

**Rules:**
- The primary action (Copy quantity) is `--text` on `--bg`, never a coloured fill.
- Gain and loss always carry a sign (+ / −), never colour alone.
- `theme-color` is `#08090a`, and there is no light theme.

## Layout

**Wide (≥ 1100 px): three panes**, filling the viewport under a 48 px header.

| Setup (`minmax(340px, 1fr)`) | Ladder (`minmax(340px, 1fr)`) | Order (`320px`) |
|---|---|---|
| Notices, command bar, presets; then the property list (Trade · Risk · Account · Limits), scrolling on its own | The price axis at full height | The order card, a scenarios note and the setup link, scrolling on its own |

The setup and ladder panes are always equal widths; the owner rejected both a wide ladder and a wide setup column. The order pane stays narrow because you only read and copy there.

**Narrow (< 1100 px): one column, max 720 px.** Command bar and presets, then the ladder as a collapsible card (open by default, 340 px tall), then the property list, then the order card. A fixed bottom dock shows "BUY 2,758 · risk ₹…" and a Copy quantity button, and respects `safe-area-inset-bottom`.

**Property row:** a 120 px label column, then the value with its units beside it, sized to its content via `field-sizing: content`. Browsers without `field-sizing` fill the row instead. The value sits on a `--field-border` underline, and focus turns that underline indigo. Enter moves to the next field. A short visible label ("Stop") pairs with a full accessible name ("Stop % below entry").

## Components

| Part | Notes |
|---|---|
| Command bar | `state/command.ts` parses the line. A transparent input sits over a coloured token overlay. Chips preview the clauses, then turn green once applied. ↑ recalls the last line, Esc clears, `/` focuses. Unknown words get a red squiggle and change nothing. Equity and cash typed here are saved like the fields |
| Price ladder | `use-ladder.ts` + `LadderPane`. Stop, entry and target are `role="slider"` lines named "Stop line", "Entry line" and "Target line". Pointer drags track 1:1 on a scale frozen for the drag. ↑↓ moves one tick, ⇧ or PageUp/PageDown moves 10. Values are built from whole paise. Moving the stop switches it to a price. Hover preview and click-to-place work only with a mouse, so a stray tap on a phone never moves a line |
| Order card | Badge (Risk-bound / Allocation cap / Cash cap · N uncapped), quantity, order line, facts. Copy actions each show their value and kbd; the kbd is hidden on touch. Shortcuts are ignored in fields, sliders and dialogs. A visually hidden scenarios table gives screen readers the R levels the ladder draws |
| Pills, presets, info tips, dialogs | Base UI `RadioGroup` / `Popover` / `Dialog`, inside `CSPProvider disableStyleElements` (unchanged from v1) |

## States

- **Empty:** a dashed order card says "Your quantity appears here", lists what is still needed and suggests a command line. The ladder says "Enter an entry and a stop to draw the trade".
- **Error:** the field's underline turns `--loss` and a message sits below it (`aria-describedby`). A zero quantity explains its cause in the card.
- **Capped:** the badge turns amber: "Cash cap · 4,444 uncapped".
- **Near band edge:** the tick note turns amber.
- **Copied:** the action's label cross-fades to "Copied ✓" for 1.4 s, and a polite live region announces it.
