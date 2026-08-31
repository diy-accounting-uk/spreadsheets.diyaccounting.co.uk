# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Coordinator batch dispatched 2026-08-31, worktree-isolated sub-agents, merged here as each
lands:

- FA track (Opus) — T1 + T4: merged to `claude/next-batch-wave-1` (includes the generate.js
  link-rename fix the track surfaced; June package reconciles 866/866)
- payslip track (Sonnet) — T2: merged to `claude/next-batch-wave-1` (35 cells per workbook
  repaired, coverage checks anchored on payment references, 13 + 197 tests green)
- print-sheet track (Opus) — C1: started
- writes track (Sonnet) — C2 + C3: merged to `claude/next-batch-wave-1` (249/249 on the
  merged state in its worktree; branch-side check re-run in flight)
- roundtrip track (Opus) — F22: merged to `claude/next-batch-wave-1` (linesLost 0 both
  products, ratchets retired, RECONCILES 859/859 and 683/683)
- comparator track (Sonnet) — F23: merged to `claude/next-batch-wave-1` (matrix budgets at
  zero allowances for all four products, 48/48 in its tree; branch-side trio re-run in flight)
- schema track (Sonnet) — F24: started
- divider track (Haiku) — T3: merged to `claude/next-batch-wave-1` (98ac8a93, 1282 guard
  tests green)
- judge track (Sonnet) — J1–J5: merged to `claude/next-batch-wave-1` (8722d901, judge
  tests 108/108 green)
- hyperlink track (Haiku) — C4: merged to `claude/next-batch-wave-1` (08ef2978 + the Taxi
  Home link fix 1ac84f8d its test caught; 8/8 and taxi-only 14/14 green)

Wave 1 collects on the `claude/next-batch-wave-1` branch and goes back to main as a PR
once the wave's tracks are in and the full suite is green.

Queued behind these to avoid product-module collisions: F23 after F22, C1+C2+C3 after T2,
F24 after F23, C5 after C1–C4.

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

Each item names its suggested sub-agent tier; all branch from the post-deploy green main and
follow the reconciliation-bug method.

- [ ] **C1: cover the Payslips print sheet's period join** (Opus) — `Payslips.xlsx!Payslips`
  (both products) is the payslip the employer hands over; its month tabs and calendar are
  asserted, but the `LOOKUP`/`INDIRECT` pair that joins them is read by nothing, so a wrong
  resolution prints the wrong period's pay with every upstream check green. T2's track found
  the sheet is worse than uncovered: after a full generate-and-recalculate pass the print
  sheet (sheet14.xml in both products) carries 65 `#REF!` errors, pre-existing and identical
  before T2's fix. Diagnose and repair those first, then discover the join from the sheet
  XML, add the printed cells to `additionalReads`, and check them against the scenario's
  payroll data for a chosen period (anchored to the fixture, never to the month tabs the
  join reads — a wrong join agreeing with the wrong month must fail). Prove breakable by
  corrupting the join's cached result.
- [ ] **B3: the invoice carriage VAT is a hardcoded `*0.2` in the template formula** (Haiku) —
  surfaced by C2: `Invoice Template!P62` in both products' `Salesinvoice.xlsx` reads
  `IF(P58<>0,SUM(V38:V57)+P60*0.2,0)` — the carriage charge (`P60`) is taxed at a literal 0.2
  independent of the rate C2 now writes into `Product Details`. Template formula surgery:
  point the term at the written rate cell, extend C2's checks with a non-zero carriage case,
  prove breakable.
- [ ] **C5: regenerate `REPORT_SHEET_COVERAGE_GAPS.md` once C1-C4 land** (Haiku) — re-run the
  report's own method (JSZip sheet enumeration against the pipeline's reads/writes), refresh
  the date and repo-state line, and delete the closed gaps; the count should fall from
  313/16 untouched toward the residue the report says is deliberate.
- [ ] **B1: twelve payroll lines come back on the wrong account on the reconcile-populated
  route** (Sonnet) — surfaced by F22's matrix scorecard: £1048/month, account 5100, comes back
  on a different account in the reconcile-populated runs only (`accountMatches` 710 vs
  `coarseMatches` 722 for Ltd, 684 vs 696 for SE); the generate route matches 722/722. The
  matrix job gates neither figure, so nothing fails today. Find where the reconcile-populated
  path loses the account and gate `accountMatches` once it holds.
- [ ] **B2: an opening land & buildings asset would lose both legs symmetrically** (Sonnet) —
  `OA_JOURNAL_MAP` (`app/lib/xlsx-exporter.js`) has no ledger account for land & buildings
  (`G13`/`M13`), and `OPENING_FIXED_ASSET_CLASSES` (`app/lib/scenario-extractor.js`) omits it
  the same way, so no fixture can exercise the gap from either side. Add the class to both
  maps and a fixture line that proves the legs survive.
- [ ] **F24: payroll `lineItemComment` has no declared home** (Sonnet) — the payslip row has no
  spare column (swept A-AG), so the field is a visible whole-line shortfall rather than a
  declared unrepresentable: declaring it today would blank the field out of the blocks that now
  match, because `roundtrip-unrepresentable.json` is per-product, not per-block. Widen the
  inventory schema to per-block granularity and declare payroll's comment, keeping
  every other block matching; re-seed the whole-line ratchets. The per-block widening was
  deliberately deferred once as riskier-than-scope, so prove the schema change with its own
  tests.









## Plans not tracked here

- `PLAN_DIYA_GL_BST_SPIKE.md` — a BST package opens, edits, recalculates and saves as diya-gl in a
  browser page, with the opt-in LLM review as its post-phase-5 extension; specified, not started.
- `PLAN_PACKAGES_TO_ARCHIVE.md` — first cut into the archive repository via the `archive-packages` skill; not started.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
