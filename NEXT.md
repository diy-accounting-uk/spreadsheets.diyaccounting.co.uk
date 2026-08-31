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
- print-sheet track (Opus) — C1: merged to `claude/next-batch-wave-1` (151 error cells
  resolved via ADDRESS-form INDIRECT, join checked against the fixture, two write-map bugs
  fixed; 27 + 213 + 94 green in its tree; branch-side re-run in flight)
- coverage-report track (Haiku) — C5: merged to `claude/next-batch-wave-1` (313/313 sheets
  touched, the 16 gaps closed by C1-C4)
- writes track (Sonnet) — C2 + C3: merged to `claude/next-batch-wave-1` (249/249 on the
  merged state in its worktree; branch-side check re-run in flight)
- roundtrip track (Opus) — F22: merged to `claude/next-batch-wave-1` (linesLost 0 both
  products, ratchets retired, RECONCILES 859/859 and 683/683)
- comparator track (Sonnet) — F23: merged to `claude/next-batch-wave-1` (matrix budgets at
  zero allowances for all four products, 48/48 in its tree; branch-side trio re-run in flight)
- schema track (Sonnet) — F24: merged to `claude/next-batch-wave-1` (per-block inventory
  with loud stale-name failure, payroll comment declared, ratchets re-seeded, 57/57 in its
  tree; branch-side trio re-run in flight as the first F24+C1 combination)
- exporter-accounts track (Sonnet) — B1 + B2: started
- invoice-carriage track — B3: first attempt (Haiku) failed verification (P62 vanished
  from the recalculated sheet, no breakability, carriage check dropped); not merged.
  Sonnet retry started with the failure as evidence.
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

- [ ] **P1: the payslip print page prints no figures — no fixture carries a start date**
  (Opus) — surfaced by C1: every printed field is gated on the employee's line showing a pay
  number, and a month tab only assigns one to an employee whose starting date is on
  `Payslips!Employee` (`F24 = " "` compares greater than any month number, so the gate is
  always shut); a warning-severity check currently carries the gross the page would print.
  Opening the gate is source-derived fixture work (start dates in the master data plus
  re-extract) and is asymmetric: SE is ripple-free; Ltd's directors block goes live (`B53`
  resolves "D", `M2` stops being 0, `WagesInterface!C4` splits), so the four per-month
  WagesInterface checks need an employees/directors split. TrialBalance sums both blocks, so
  P&L and CT are unaffected.
- [ ] **B3: the invoice carriage VAT is a hardcoded `*0.2` in the template formula** (Haiku) —
  surfaced by C2: `Invoice Template!P62` in both products' `Salesinvoice.xlsx` reads
  `IF(P58<>0,SUM(V38:V57)+P60*0.2,0)` — the carriage charge (`P60`) is taxed at a literal 0.2
  independent of the rate C2 now writes into `Product Details`. Template formula surgery:
  point the term at the written rate cell, extend C2's checks with a non-zero carriage case,
  prove breakable.
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
- [ ] **B4: opening-balance lines never write `lineItemComment`** (Sonnet) — surfaced by F24:
  the bank opening-balance line (`app/lib/xlsx-exporter.js:636-648`) and the
  `OA_JOURNAL_MAP`-driven journal opening-balance lines (~972-1023) omit the field, unlike
  ordinary bank rows and sales/purchases, leaving 13 SE and 6 Ltd whole-line mismatches the
  re-seeded ratchets hold steady. Either read the comment from a real cell if one exists, or
  declare the field per-block for those lines under the new inventory schema — discover
  which is true from the sheets first.









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
