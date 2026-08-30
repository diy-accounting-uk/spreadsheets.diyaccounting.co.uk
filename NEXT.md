# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

PR #45 merged as `740da9ae`. The main-side `test`, `deploy` and four `generate-*` runs are in
progress; the generate-commit runs refresh the committed reports for the mileage route and the
new Purchase Analysis rows. Every later PR branch rebases onto that main.

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

Each item names its suggested sub-agent tier; all branch from the post-deploy green main and
follow the reconciliation-bug method.


- [ ] **F9 remainder: SE Full box 51 after the cap removal** (Opus) — `app/templates/se/Financialaccounts.xlsx!SE Full!D152` ("Restricted allowances for expensive cars", SA103F box 51) sums `Schedule!R38:R42 + R91:R95`, the WDA the cap removal just un-capped, and box 49 (`D144 = R1 - D152`) is only checked against that identity. Confirm from the current SA103F what box 51 expects now the restriction is gone, then repoint D152/D144 and anchor a check to the fixture.
- [ ] **F14 remainder: `measurableQuantity` is now exported for BST and Taxi** (Haiku) — the
  BST/Taxi exporters emit it since the mileage route landed, but
  `app/data/roundtrip-unrepresentable.json` still excuses it for both products. Drop "bst" and
  "taxi" from that entry, re-run the two roundtrip scorecards, and re-seed any data-half count
  that moves. SE and Ltd `cellWrites` still fill no mileage column (`carriesMileage: "none"`).
- [ ] **F9 remainder: `extractTaxDataFromBook` builds the SE-shaped WDA key for Ltd** (Haiku) — `app/lib/diya-gl-loader.js` fallback emits `capital_allowances.writing_down_allowance`, which Ltd reads as `writing_down_allowance_main`; reachable when `report.js` runs without `--years`. Emit the per-regime key and add a loader test.






## Plans not tracked here

- `PLAN_PACKAGES_TO_ARCHIVE.md` — first cut into the archive repository via the `archive-packages` skill; run when the operator wants it.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
