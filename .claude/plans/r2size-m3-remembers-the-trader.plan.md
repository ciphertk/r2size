# Plan: Remembers the Trader

**Source PRD**: `.claude/prds/r2size.prd.md`
**Selected Milestone**: 3 — Remembers the trader ("account profile with a staleness reminder, presets, shareable URL setups, Export/Import")
**Complexity**: Large
**Also governed by**: `.claude/prds/r2size.architecture.md` (§4 state and persistence, §5 URL setups, §9 M3 testing, ADR-004/005), `.claude/prds/r2size.design.md` (preset chips, profile strip, dialogs), PRD D10 (preset contents) and D12 (staleness in calendar days)

## Summary

Make R2Size remember the trader on this device:
- the account profile (equity, available cash, last-updated date) with a staleness reminder;
- named presets that fill risk %, stop method and value, allocation cap and cost % in one tap;
- the current setup encoded in the URL hash, so it survives reloads and can be shared without ever including the profile;
- Export/Import of all local data, and Reset.

All storage is one versioned, validated document in localStorage. Nothing leaves the device.

## Scope

**In:**
- **Persistence:** a `StoredDocV1` document under the `r2size` key, with:
  - Valibot validation and step migrations;
  - corrupt or newer-version data handled safely;
  - other open tabs kept in sync;
  - `navigator.storage.persist()` requested after the first profile save.
- **Profile:** equity and cash save when the field is left; "Updated N days ago"; the stale reminder offers "Still correct" (refreshes the date) or editing the figures.
- **Presets:**
  - a chip row (design doc), with create, rename, edit and delete in a Base UI Dialog, and apply;
  - two defaults seeded on first run: Conservative 0.5% and Standard 1%;
  - the last-applied preset is applied again on launch.
- **URL setups:** `#v=1&…` kept in step with the form (`replaceState`, debounced), and read on load; "Share setup" copies the link. Profile fields can never be encoded.
- **Settings sheet:** stale-reminder days, Export, Import (preview, then replace with an undo copy), Reset all data (confirmation).
- **Top bar:** settings button.

**Out:** service worker, install, the update notice, CSP headers, the Guide page and deploy (M4). The iOS-standalone-specific export path is wired (share sheet when available) but only verified on a real device in M4.

## Decisions this plan makes (confirm or change)

| # | Question | Decision |
|---|---|---|
| M3-D1 | When does the profile save, and what counts as "updated"? | Equity/cash save when the field is left with a valid value. `lastUpdated` changes only when a value changes or the trader taps "Still correct". Invalid values are never saved |
| M3-D2 | Stale reminder | When `lastUpdated` is `staleDays` or more calendar days ago (device-local, D12): "Equity last updated 12 days ago — still ₹20,00,000?" with **Still correct** and **Update** (focuses equity) |
| M3-D3 | What does applying a preset do? | Sets risk mode to % and risk %; sets stop mode to % or ATR and its % or multiple (the typed ATR value is kept); sets allocation cap and cost % (blank clears them). Entry, stop price, targets and symbol are untouched |
| M3-D4 | Which preset chip shows as selected? | Derived, not stored: a chip is selected while the form's preset fields equal that preset. Editing a field after applying simply deselects it |
| M3-D5 | What happens on launch? | A setup in the URL hash wins. Otherwise the last-applied preset is applied (stored as `settings.defaultPresetId`). Otherwise the blank form |
| M3-D6 | URL contents | Trade inputs only, per architecture §5: symbol, entry, stop mode + values, tick override, risk mode + value, allocation, cost, targets. Never equity or cash. The ₹ risk amount is included when that mode is used (it's a trade input); the share UI says "Shares trade inputs only — never your equity or cash" |
| M3-D7 | Import behaviour | Validate and migrate, show a preview ("Replace your data with: equity ₹20,00,000 (updated 3 Oct), 4 presets?"), then replace. The previous document is kept under `r2size:pre-import` with an **Undo import** action until the next import or reset |
| M3-D8 | Storage unavailable (private mode, blocked, quota) | The app keeps working in memory, with a one-line notice ("Can't save on this device; your data won't be kept"). Export still works |

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Naming | `src/state/form-reducer.ts:48`, `src/domain/copy-text.ts:24` | kebab-case modules; pure functions in `domain/`; a reducer plus typed action union in `state/` |
| Errors | `src/infra/clipboard.ts:2`, `src/domain/messages.ts:23` | Browser side effects in `infra/` never throw: they return `boolean`/result objects. User-facing text lives in `domain/messages.ts` with `satisfies Record<…>` exhaustiveness |
| Logging | — | None (no console, no telemetry; ADR-006) |
| Data access | `src/ui/calculator/CalculatorScreen.tsx:11`, architecture §4 | One external store (`state/app-store.ts`, `useSyncExternalStore`) over an `infra/storage.ts` repository; the form stays in `useReducer` (`src/state/form-reducer.ts:48`) |
| Tests | `src/state/__tests__/form-reducer.test.ts`, `src/ui/__tests__/CalculatorScreen.test.tsx:8`, `e2e/calculator.spec.ts:4` | `run(...actions)` reducer tests; fast-check properties for codecs; `fixture()` initial states for component tests; Playwright helpers like `enterMockupSetup` |

## Files to Change

| File | Action | Why |
|---|---|---|
| `package.json` | UPDATE | Add `valibot` |
| `src/domain/schema.ts` | CREATE | Valibot schemas: `StoredDocV1`, `Preset`, `Backup`; decimal strings checked with the engine's `parseDecimal` |
| `src/domain/migrations.ts` | CREATE | `migrate(unknown)` → current doc or a reason (`'corrupt'`, `'newer'`); v1 is the first version (the step list is in place for v2) |
| `src/domain/defaults.ts` | CREATE | Default document and seeded presets |
| `src/domain/staleness.ts` | CREATE | `daysSince(iso, now)` in device-local calendar days; `isStale` |
| `src/domain/share-url.ts` | CREATE | `encodeSetup(ShareableSetup)` / `decodeSetup(hash)`, with allowlisted keys, the 512-character cap and per-value grammar |
| `src/domain/presets.ts` | CREATE | `applyPreset(form, preset)`, `presetFromForm(form)`, `matchesPreset(form, preset)` |
| `src/domain/backup.ts` | CREATE | `toBackup(doc, now)`, `parseBackup(text)` (size cap, app/kind check, migrate, validate), `backupFileName(date)` |
| `src/domain/messages.ts` | UPDATE | Wording for the stale reminder, storage notices, import results, preset validation |
| `src/infra/storage.ts` | CREATE | `load()`, `save(doc)`, `snapshotForUndo`, `restoreUndo`, `clearAll()`, `subscribe(onChange)` (the `storage` event); never throws |
| `src/infra/persist.ts` | CREATE | `requestPersistence()` → `'granted' \| 'denied' \| 'unsupported'` |
| `src/infra/download.ts` | CREATE | Save a backup via Blob + `<a download>`, or `navigator.share({ files })` when `canShare` |
| `src/infra/url-hash.ts` | CREATE | Read the hash; `replaceState` writer, debounced 300 ms with `flush()` |
| `src/state/app-store.ts` | CREATE | Store for profile, presets and settings: actions (save profile, confirm still-correct, preset CRUD, set default preset, set stale days, import, undo import, reset); persists through `infra/storage` |
| `src/state/form-reducer.ts` | UPDATE | `applyPreset` and `loadSetup` actions |
| `src/ui/app/App.tsx` | UPDATE | Settings button; startup order (M3-D5) |
| `src/ui/profile/ProfileStrip.tsx` | UPDATE | Saved values, "Updated N days ago", stale reminder, storage notice |
| `src/ui/presets/PresetChips.tsx`, `PresetEditor.tsx` | CREATE | Chip row (Base UI ToggleGroup or the existing `Segmented`), and an editor in a Base UI Dialog |
| `src/ui/settings/SettingsSheet.tsx`, `ImportPreview.tsx`, `ResetDialog.tsx` | CREATE | Base UI Dialog / AlertDialog |
| `src/ui/calculator/ShareButton.tsx` | CREATE | Copies the setup link, with the "trade inputs only" note |
| `src/ui/calculator/CalculatorScreen.tsx` | UPDATE | Wire presets, URL sync and the profile into the form |
| `src/**/__tests__/*` | CREATE | Unit, property and component tests |
| `e2e/remembers.spec.ts` | CREATE | Reload persistence, staleness with a fake clock, presets, sharing, export/import, reset |
| `.claude/prds/r2size.prd.md` | UPDATE | Milestone 3 → `in-progress` now, `complete` at the end |

## Tasks

Test-first throughout. Each `domain` module is pure and gets unit and property tests before the UI uses it.

### Task 1: Schema, defaults, migrations
- **Action**: Add `valibot`. `schema.ts` validates `StoredDocV1` exactly as in architecture §4, minus `theme` (dark only):
  - `schemaVersion: 1`;
  - `profile`: `{ equity, availableCash, lastUpdated }`;
  - `presets` (≤ 50; name 1–40 characters; risk %, stop `{ kind: 'percent', pct } | { kind: 'atr', multiple }`, allocation % or null, cost %);
  - `settings`: `{ staleDays 1–90, defaultPresetId, persistRequested }`.

  Decimal strings are checked with the engine's `parseDecimal` and `PLACES`. `migrate(raw)` returns `{ ok, doc }` or `{ ok: false, reason: 'corrupt' | 'newer' }`.
- **Mirror**: `domain/` purity; engine parser reuse.
- **Validate**: `pnpm test schema migrations`. Covers valid docs, every invalid field, a newer version, junk JSON, and a property that any generated valid doc passes and survives a JSON round trip.

### Task 2: Staleness
- **Action**: `daysSince(lastUpdated, now)` counts device-local calendar days (D12): 23:59 → 00:01 is 1 day, while 00:01 → 23:59 the same day is 0. `isStale(days, staleDays)` is `days >= staleDays`.
- **Validate**: `pnpm test staleness`, with fixed dates across midnight and month ends, and Vitest fake timers with `TZ=Asia/Kolkata`.

### Task 3: Shareable setups
- **Action**: `ShareableSetup` has no equity or cash field (type-level guarantee). Key map from architecture §5:
  - `v`, `sym`, `e`, `sm`, `s`, `sp`, `atr`, `am`, `tk`, `rm`, `r`, `ra`, `al`, `c`, `t` (comma-separated, ≤ 3).

  `decodeSetup` caps input at 512 characters, reads only allowlisted keys, validates each value with the field grammar, and drops invalid values one by one, reporting `{ setup, ignored: string[] }`. An unknown `v` gives `{ newer: true }`.
- **Validate**: `pnpm test share-url`, with properties for:
  - decode(encode(x)) = x;
  - the encoded string never contains `eq`, `cash` or `equity`, and changing the profile never changes it;
  - fuzzed hashes never throw;
  - a symbol must match `^[A-Z0-9&.\-]{1,20}$` after upper-casing.

### Task 4: Presets and backup (domain)
- **Action**: `applyPreset` / `matchesPreset` / `presetFromForm` per M3-D3/D4. `backup.ts`: `toBackup` (`{ app: 'r2size', kind: 'backup', schemaVersion, exportedAt, data }`), `parseBackup` (reject > 256 KB, wrong app/kind, newer version, invalid), `backupFileName` (`r2size-backup-YYYY-MM-DD.json`).
- **Validate**: `pnpm test presets backup`, including the property export → parse returns an identical doc.

### Task 5: Infra
- **Action**:
  - `storage.ts` follows architecture §4's load sequence; a corrupt document is copied to `r2size:corrupt:<ISO time>`.
  - `save` validates first and returns `'ok' | 'quota' | 'unavailable'`.
  - `subscribe` uses the `storage` event.
  - Also write `persist.ts`, `download.ts` and `url-hash.ts`. Every function catches its own exceptions (M3-D8).
- **Mirror**: `src/infra/clipboard.ts:2`.
- **Validate**: `pnpm test storage url-hash` with happy-dom's localStorage, including a throwing localStorage (private mode) and quota errors.

### Task 6: App store
- **Action**: `state/app-store.ts`: an external store holding `{ doc, storage: 'ok' | 'unavailable', notice }`. Actions:
  - `saveProfile`, `confirmProfile`;
  - `createPreset`, `updatePreset`, `deletePreset`, `setDefaultPreset`;
  - `setStaleDays`;
  - `importBackup`, `undoImport`, `resetAll`.

  Each validates, persists and notifies. `useAppStore(selector)` uses `useSyncExternalStore`. Changes from other tabs are applied through `subscribe`.
- **Mirror**: the reducer-style action union in `src/state/form-reducer.ts:18`.
- **Validate**: `pnpm test app-store` covers every action, persistence, a storage failure, and an update from another tab.

### Task 7: Profile UI
- **Action**:
  - `ProfileStrip` loads the saved equity and cash into the form and saves them when a field is left (M3-D1);
  - it shows "Updated today / N days ago";
  - when stale, it shows the reminder with **Still correct** and **Update** (M3-D2);
  - it shows the storage notice when storage is unavailable;
  - it asks for persistent storage after the first save.
- **Validate**: Component tests with a fake clock: the reminder appears at the threshold, "Still correct" clears it, and editing equity updates the date.

### Task 8: Presets UI
- **Action**: `PresetChips` (single row, scrolls sideways on phones; selected = M3-D4) and a "+" chip that opens `PresetEditor` (Base UI Dialog: name, risk %, stop % or ATR multiple, allocation, cost; "Save from current" pre-fills from the form). Long-press is avoided: edit, rename and delete live in the editor, opened from a chip's "Edit" button or the settings sheet. Applying a preset sets `defaultPresetId` (M3-D5).
- **Validate**: Component tests cover create, apply (form fields change; entry is untouched), the chip deselecting after an edit, rename, delete with confirmation, and the 50-preset and 40-character limits.

### Task 9: URL setups UI
- **Action**:
  - On start, a hash setup is loaded into the form (M3-D5), with a notice listing any ignored values or a "newer version" link.
  - The form writes the hash through the debounced writer, flushed before copy or share.
  - `ShareButton` copies `location.href` with the note "Shares trade inputs only — never your equity or cash".
- **Validate**: Component tests for start-up precedence; E2E below.

### Task 10: Settings sheet
- **Action**:
  - `SettingsSheet` (Base UI Dialog) contains:
    - stale-reminder days (1–90);
    - Export (download or share sheet);
    - Import (`<input type="file" accept="application/json">` → `ImportPreview` → replace; Undo import);
    - Reset all data (`AlertDialog`: "Delete your profile, presets and settings from this device?");
    - storage status ("Protected" / "May be cleared by the browser").
  - Reset also clears the form and the hash.
- **Validate**: Component tests for each path, including rejected imports with their message.

### Task 11: E2E and close
- **Action**: `e2e/remembers.spec.ts` on both phone profiles:
  - profile and presets survive a reload;
  - `page.clock` jumps 8 days and the stale reminder appears, then "Still correct" clears it;
  - preset create/apply/edit/delete;
  - the setup survives a reload through the hash;
  - a shared link opened in a **fresh browser context** shows the setup with equity empty, and the hash contains no `eq`/`cash`;
  - export downloads a file, which imports back after a reset and matches;
  - an oversized or foreign file is rejected;
  - undo import works;
  - reset clears everything;
  - axe stays clean with the dialogs open.

  Update the PRD Milestone 3 row to `complete`, then commit.
- **Validate**: The full validation block.

## Validation

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:coverage        # engine gate unchanged; new domain/state/infra/ui tests
pnpm build && pnpm size   # Valibot + dialogs must stay within JS 90 KB
pnpm test:e2e             # Pixel 7 + iPhone 14
```

The engine is not expected to change; if it does, `pnpm test:mutation` runs too.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Base UI Dialog, AlertDialog and ToggleGroup on Preact | Medium | Same proof as M2: component tests on Preact plus E2E on both browsers; fall back to native `<dialog>` if any primitive misbehaves |
| Bundle grows past 90 KB (Valibot + dialogs) | Low | Valibot is tree-shaken (~5 KB); measure after Task 6 and Task 10 |
| Losing a trader's data (bad migration, a crash mid-save, an import mistake) | Low | Validate before every save; never overwrite corrupt data without copying it aside; undo copy on import; property tests on round trips |
| iOS storage eviction, and separate Safari vs. installed-app storage | High (iOS) | Persistence request, Export/Import, and the M4 install hint; the PRD risk table already covers it |
| Hash sync fighting the user (back button, typing lag) | Low | `replaceState` only (never `pushState`), debounced 300 ms |
| Date and timezone bugs in staleness | Medium | Pure `daysSince` with fixed-date tests across midnight; E2E uses `page.clock` |
| Two tabs editing at once | Low | Last write wins; the `storage` event refreshes other tabs' view |

## Acceptance

- [x] All tasks complete
- [x] Validation passes; engine logic untouched (only `cmp` and `isPositive` newly exported), coverage gate still 100%
- [x] Profile, presets and settings survive reloads; the stale reminder follows D12 and M3-D2 (unit tests across midnight; E2E with `page.clock`)
- [x] Presets store only D10 fields; applying never touches entry, stop price, ATR value, targets or symbol
- [x] Shared links never contain equity or cash (type-level + property test + E2E in a fresh browser context)
- [x] Export → reset → import restores byte-identical data; bad files are rejected with a clear message; undo import works
- [x] Storage failures never crash the app (M3-D8; blocked storage and a full quota are tested)
- [x] JS 71.5 KB gzipped (budget 90); axe clean with the settings sheet and the preset editor open
- [x] Patterns mirrored from M1/M2

## Implementation notes (2026-10-05)

- **Default presets:** Standard (1% risk, 5% stop) and Conservative (0.5% risk, 5% stop), with no allocation cap and 0% cost. A preset must have a stop, and 5% was the neutral choice; traders can edit or delete them.
- **Preset editing** lives in the settings sheet (Edit per preset), and "+" on the chip row saves the current setup as a new preset. There is no long-press anywhere. Delete inside the editor needs a second tap ("Tap again to delete") instead of a nested dialog.
- **Startup:**
  - `state/startup.ts` builds the first form from the saved document and the hash (M3-D5).
  - After that, `CalculatorScreen` only applies *changes* to the saved profile (import, reset, another tab), so startup values are never clobbered.
- **Share** is a "Copy setup link" button under the R table, with the note "Shares trade inputs only — never your equity or cash." The link is built at tap time from the current form.
- **"Newer data"** (saved by a later app version) opens read-only: changes work in memory but are never written over the newer data.
- **Base UI dialogs on Preact work.** In happy-dom, Base UI removes its `inert` marker from the page a moment after a dialog closes, so one component test waits for that before querying the page. Real browsers (E2E) need no special handling.
- **Mutation testing was not re-run:** the engine only gained two re-exports, with no logic change.
