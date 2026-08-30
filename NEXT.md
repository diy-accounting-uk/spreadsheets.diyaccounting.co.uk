# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Integration branch `claude/next-fidelity-wave`, PR #45; CI green at `aaaf2967`. Tracks run in
`../wt-spreadsheets/<track>` on `claude/wt-<track>`; the coordinator merges each into the
integration branch as it lands and pushes in batches.

| Track | Item | Worktree | Tier | Status |
|---|---|---|---|---|
| f2 | F2 Excel-side CI `--data` | — | Sonnet | landed `cb459cf2`, noExcelValue 66/700/892 → 0, CI roundtrip jobs green |
| f8 | F8 6 dp pre-round | — | Sonnet | landed `f5c4d20b`, rounding 5/5, SE differing 2 → 0 |
| f9 | F9 expensive-car cap removal | — | Sonnet | landed `322eb2d7`, four products, Ltd differing 4 → 0, featured scenarios RECONCILE |
| f7 | F7 roll dependent caches | — | Sonnet | landed, allowlist deleted, stability 0 moved on all four products; also rolls the SE Short cells F10 reads (CI stability fix) |
| f16 | F16 BST Debtors block | — | Sonnet | landed `bbc48a3b`, calculator-bst 203/203, sp-sixty RECONCILES 59/59 |
| f10 | F10 SE Short CELL_MAP | — | Haiku | landed `18dc83b3`, SE calculator+precision 68/68 |
| f12 | F12 BrickWork acquiredDate | — | Haiku | landed `53304cdf`, loader 32/32 |
| f17 | F17 diya-gl docs examples | — | Haiku | landed `0ad80afc`, docs-examples 9/9 |
| f13 | F13 SE forecast 2023-24 | — | Opus | landed: premise did not reproduce (679/679 at 2024-04-05); real defect was the runner reading shipped caches when LibreOffice silently did not recalculate, now throws; forecast suite 38/38 on both rates years |
| f14 | F14 mileage quantity | `../wt-spreadsheets/f14` | Opus | started |
| archive | `PLAN_PACKAGES_TO_ARCHIVE.md` review, archive-cut skill | — | Opus | landed `c3b97742`, dry run 118/118 fully formed |
| f1 | F1 exact EQ1 gate | `../wt-spreadsheets/f1` | Sonnet | started |

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.


Fidelity remainders promoted from `PLAN_ROUNDTRIP_FIDELITY.md` ("What stays open"). Each names
its suggested sub-agent tier; all branch from the post-deploy green main and follow the
reconciliation-bug method.

- [ ] **F2: give the Excel-side CI report command `--data`** (Sonnet) — in `.github/workflows/test.yml`
  the `roundtrip-bst` (line ~178), `roundtrip-se` (~272) and `roundtrip-ltd` (~322) steps run
  `report.js --package <p> --source-dir target/<p>-pkg --output-dir target/<p>-excel` with no
  journal, so the Excel side publishes no compliance verdicts and no netting rows and every
  check key lands in `noExcelValue` (BST 66 / SE 700 / Ltd 892); `toleranceByKey()` then finds no
  check-owned windows. `roundtrip-taxi` (~228) already passes `--data examples/... --years ...`.
  Add the same `--data`/`--years` (and the Ltd `--offset '-P1Y'`) to the three steps, re-run
  the scorecards, and re-seed `noExcelValue` in `app/data/roundtrip-budget.json` to the new
  figure (expected 0). Test: `verify-roundtrip.test.js`'s scorecard case asserts the Excel
  document carries `check/` keys.
- [ ] **F1: make EQ1 an exact gate** (Sonnet, after F2 and F8/F9) — the six conditions in the
  plan hold except `noExcelValue = 0`; once F2 lands and F8/F9 take `differing` to 0, set every
  report-half count in `app/data/roundtrip-budget.json` to 0 and add a comparator test that a
  single differing money key fails the budget. Until then the ratchet stands.


- [ ] **F9 remainder: SE Full box 51 after the cap removal** (Opus) — `app/templates/se/Financialaccounts.xlsx!SE Full!D152` ("Restricted allowances for expensive cars", SA103F box 51) sums `Schedule!R38:R42 + R91:R95`, the WDA the cap removal just un-capped, and box 49 (`D144 = R1 - D152`) is only checked against that identity. Confirm from the current SA103F what box 51 expects now the restriction is gone, then repoint D152/D144 and anchor a check to the fixture.
- [ ] **F9 remainder: `extractTaxDataFromBook` builds the SE-shaped WDA key for Ltd** (Haiku) — `app/lib/diya-gl-loader.js` fallback emits `capital_allowances.writing_down_allowance`, which Ltd reads as `writing_down_allowance_main`; reachable when `report.js` runs without `--years`. Emit the per-regime key and add a loader test.
- [ ] **F14: write the mileage quantity so a package can take the mileage route** (Opus) — the
  BST and Taxi calculators compute the mileage claim from `measurableQuantity`, but
  `cellWrites` never writes it to the Purchases sheet's mileage column, so every generated
  package takes the actual-cost route. Discover the column from the XML (`PurchasesApr..Mar`),
  allocate the write per month alongside the purchase rows (cross-sheet: sales/journal miles
  into the purchases tab), extend the sp-sixty master with a mileage-coded month, and assert
  the P&L mileage line and `Income Tax` reflect it on both engines.





## Plans not tracked here

- `PLAN_PACKAGES_TO_ARCHIVE.md` — first cut into the archive repository via the `archive-packages` skill; run when the operator wants it.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
