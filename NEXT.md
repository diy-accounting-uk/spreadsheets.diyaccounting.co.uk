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
- exporter-accounts track (Sonnet) — B1 + B2: merged to `claude/next-batch-wave-1`
  (payroll accountMatches 722/722 under the zero gate; land & buildings survives both legs,
  Ltd RECONCILES 950/950)
- invoice-carriage track — B3: Sonnet retry merged to `claude/next-batch-wave-1` (root
  cause of the failed first attempt was unescaped `<>` corrupting the sheet XML; the fix
  uses the sheet's own rate idiom, 194/194 with breakability). The failed Haiku attempt is
  discarded.
- EQ1 track (Opus) — E1: merged to `claude/next-batch-wave-1` (ltd CI chain fully clean:
  0 differing / 0 noJsValue / 0 linesLost, 724/724; shared payslips-layout module; 3327
  tests green in its tree). SE budget one-char fix and prettier landed as coordinator
  pipeline fixes.
- CI-fallout track (Sonnet): merged to `claude/next-batch-wave-1` (land ripple re-derived
  by hand across six test files, carriage checks gated on VAT registration like their
  writes, stability failures root-caused onto the listed-volatiles mechanism; 2696 tests
  green in its tree).
- print track (Opus) — R1 + P1: started. R1 first: the featured Ltd reconciliation is
  ANOMALYDETECTED 949/955 in the reconcile-populated package (FAreconciliation E13/K13
  link caches read 0; three print-page INDIRECTs read #REF!) — must print RECONCILES.
  Then P1 opens the print-page gate with source-derived start dates.
- divider track (Haiku) — T3: merged to `claude/next-batch-wave-1` (98ac8a93, 1282 guard
  tests green)
- judge track (Sonnet) — J1–J5: merged to `claude/next-batch-wave-1` (8722d901, judge
  tests 108/108 green)
- hyperlink track (Haiku) — C4: merged to `claude/next-batch-wave-1` (08ef2978 + the Taxi
  Home link fix 1ac84f8d its test caught; 8/8 and taxi-only 14/14 green)

Wave 1 collects on the `claude/next-batch-wave-1` branch and goes back to main as a PR
once the wave's tracks are in and the full suite is green.

- calc track (Sonnet): started — the full suite's 13 real failures (calculator-se 10,
  calculator-ltd 3): the EQ1 track's calculator expectations predate the carriage rename
  (+1 check) and the VAT-registration gating (−4 or 5 for non-VAT scenarios), and the
  calculators don't emit the carriage cell yet. The suite's other 20 failed files were
  soffice-contention hook timeouts (everything skipped, 300-900s) — clean re-run at close.

Queued: B4 dispatches after the print track lands (both touch the exporter).

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

Each item names its suggested sub-agent tier; all branch from the post-deploy green main and
follow the reconciliation-bug method.

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
