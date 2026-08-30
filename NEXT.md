# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Nothing. Main is refreshed and deployed through PR #45 (`test` and `deploy` green at `20a18cb9`);
every later PR branch starts from a rebase onto that main, and the operator dispatches CI on
branches.

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

Each item names its suggested sub-agent tier; all branch from the post-deploy green main and
follow the reconciliation-bug method.


- [ ] **F18: give `lineItemComment` and `documentReference` a declared home** (Sonnet) — the bank,
  payroll and SE sales blocks drop both fields on export (they carry a counterparty and an invoice
  reference, and the sheets have no description column beside them); `diya-gl:bankCode` differs on
  a further 7 SE lines. They keep SE at 395 whole-field matches of 694 and Ltd at 507 of 701.
  Either find each block a real cell to carry them (discover from the XML) or declare them in
  `app/data/roundtrip-unrepresentable.json` with what the sheets do instead, and re-seed the
  data-half counts.
- [ ] **F19: derive the straddling VAT entries instead of stating them** (Sonnet) — the extractor
  states the Precision Code master's straddling VAT entries because the master carries no journal
  lines outside the accounting period. Extend the master data with the out-of-period legs, derive
  the entries in `app/bin/extract-scenarios.js`, and re-run the extractor (sync gate).
- [ ] **F20: give `export.js` a Taxi writer** (Opus) — `xlsx-exporter.js`'s `periodCovered()` finds
  no postings on the Taxi package's own sheets, so EQ2 and the double-roundtrip never run for Taxi
  and its `roundtrip-taxi` CI job gates the report half and stability only. Write the Taxi export
  path (discover the sales/purchases sheet layout from the XML), wire EQ2 and the double-roundtrip
  into the `roundtrip-taxi` job, and seed its data-half budget from the first real run.
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
