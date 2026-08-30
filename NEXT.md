# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Integration branch `claude/next-wave-2` (one PR). Tracks run in `../wt-spreadsheets/<track>` on
`claude/wt-<track>`; the coordinator merges each into the integration branch as it lands and
pushes in batches.

| Track | Item | Worktree | Tier | Status |
|---|---|---|---|---|
| f19 | F19 derive straddling VAT entries | — | Sonnet | merged `54cb03ac`, sync gate clean, extractor+loader 104/104; Ltd reconcile running |
| f20 | F20 Taxi export writer | — | Opus | landed, EQ2 gated in CI, 264 lines return, exporter 35/35, breakability proven |
| box51 | F9 remainder: SA103F box 51 | `../wt-spreadsheets/box51` | Opus | started |
| f14rem | F14 remainder: measurableQuantity entry | — | Haiku | landed, BST scorecard within budget, verify-roundtrip 35/35 |
| wdakey | F9 remainder: per-regime WDA key | — | Haiku | landed `2f13b8d8`, loader 35/35, no-years smoke clean |
| f18 | F18 lineItemComment/documentReference home + taxi column C + sp-sixty mileage | `../wt-spreadsheets/f18` | Sonnet | started |

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

Each item names its suggested sub-agent tier; all branch from the post-deploy green main and
follow the reconciliation-bug method.


- [ ] **F18: give `lineItemComment` and `documentReference` a declared home** (Sonnet) — the bank,
  payroll and SE sales blocks drop both fields on export (they carry a counterparty and an invoice
  reference, and the sheets have no description column beside them); `diya-gl:bankCode` differs on
  a further 7 SE lines. Either find each block a real cell to carry them (discover from the XML) or
  declare them in `app/data/roundtrip-unrepresentable.json` with what the sheets do instead, and
  re-seed the data-half counts. Fold in the Taxi gaps the export writer measured: `app/products/taxi.js`
  never writes `tx.reference` to Purchases column C (the whole of taxi's `fieldsDropped: 1`) nor
  `tx.customer` to Sales column C (180 of 264 sales lines miss on `detailComment`); write both,
  re-seed taxi's data-half counts, and retire the ratchet's `dropped: ["documentReference"]`. Also
  fix the sp-sixty master's March mileage claim (TXN-0264 prices 1,674 miles at 45p = 753.30 where
  HMRC and the sheet band them at 25p past 10,000 miles = 418.50; extractor re-run, sync gate).
- [ ] **F21: gate Taxi EQ2 in the generate matrix** (Sonnet) — `generate-taxi.yml`'s matrix still
  scores only the report half and stability; now the Taxi writer exists, add the export/EQ2 steps
  and seed a taxi entry in `app/data/roundtrip-matrix-budget.json` from a real matrix run.
- [ ] **F9 remainder: SE Full box 51 after the cap removal** (Opus) — `app/templates/se/Financialaccounts.xlsx!SE Full!D152` ("Restricted allowances for expensive cars", SA103F box 51) sums `Schedule!R38:R42 + R91:R95`, the WDA the cap removal just un-capped, and box 49 (`D144 = R1 - D152`) is only checked against that identity. Confirm from the current SA103F what box 51 expects now the restriction is gone, then repoint D152/D144 and anchor a check to the fixture.

## Plans not tracked here

- `PLAN_DIYA_GL_BST_SPIKE.md` — a BST package opens, edits, recalculates and saves as diya-gl in a
  browser page; specified, not started.
- `PLAN_DIYA_GL_LLM_REVIEW.md` — LLM review of a loaded book, opt-in, metered in-page; starts
  after the BST spike's phase 5.
- `PLAN_PACKAGES_TO_ARCHIVE.md` — first cut into the archive repository via the `archive-packages` skill; run when the operator wants it.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
