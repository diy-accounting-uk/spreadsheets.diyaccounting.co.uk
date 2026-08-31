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
- print track (Opus) — R1 + P1: merged to `claude/next-batch-wave-1`. R1 needed no source
  change — the committed packages are stale derived artifacts; a regenerated package
  RECONCILES (residue closes with the post-merge generate-commit refresh). P1: gate open
  via start dates, ten printed-figure checks per product, the WagesInterface
  employees/directors split, a twelve-suite harness fix, and the M49 volatiles fixed at
  source (EQ3 0 moved). RECONCILES 1015/1016 and 782/783 (the one warning is T5).
- exporter-comments track (Sonnet) — B4: merged to `claude/next-batch-wave-1` (only the
  bank opening-balance line is a genuine no-home case, declared under a narrower
  bank-opening-balance scope proven not to blank ordinary rows; 60/60 trio green. The
  journal-OB wording differences and SE bankCode collapse stay measured by ratchets.)
- taxi-dates track (Sonnet) — T6: started. The operator's generate-taxi dispatch failed
  its 2023/2027 scorecards: 21 purchases lines are written with unshifted fixture dates
  in non-featured-year packages (taxi.js translates sales by day offset, one purchases
  path not at all). The comparator gained `--date-shift-days` (b20d6813); the track fixes
  the purchases translation and wires the taxi scorecard's computed shift. SE and BST
  matrices pass by design (unshifted dates); ltd's dispatch is in progress.
- loader track (Sonnet) — B5: merged to `claude/next-batch-wave-1` (one-line mapping,
  gate proven firing, both CI chains within budget, 3604 tests green in its tree)
- divider track (Haiku) — T3: merged to `claude/next-batch-wave-1` (98ac8a93, 1282 guard
  tests green)
- judge track (Sonnet) — J1–J5: merged to `claude/next-batch-wave-1` (8722d901, judge
  tests 108/108 green)
- hyperlink track (Haiku) — C4: merged to `claude/next-batch-wave-1` (08ef2978 + the Taxi
  Home link fix 1ac84f8d its test caught; 8/8 and taxi-only 14/14 green)

Wave 1 collects on the `claude/next-batch-wave-1` branch and goes back to main as a PR
once the wave's tracks are in and the full suite is green.

- calc track (Sonnet): merged to `claude/next-batch-wave-1` (the calculators now mirror
  cellWrites' VAT gate with real invoice figures; 3377/3377 in its tree, both CI chains
  within budget; 3183/3183 calculator tests re-verified on the branch). The full suite's
  other 20 failed files were soffice-contention hook timeouts — clean re-run at close.

After B4 and B5 land: the clean full-suite re-run, then PR #48 leaves draft.

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

Each item names its suggested sub-agent tier; all branch from the post-deploy green main and
follow the reconciliation-bug method.

- [ ] **T5: the printed payslip's payment date reads an empty header cell** (Haiku) —
  surfaced by P1: `Payslips!M18` ("Payment date") in both products reads
  `INDIRECT(ADDRESS($H$4,18,...))` — column R of the month block's header row, which the
  template leaves empty — while the wages-paid date actually sits one row below (the cell
  `I9` correctly reads). The check currently asserts the behaviour as it stands (`M18 = 0`)
  with a warning carrying the true date (`app/products/ltd.js:3541`, `se.js:2487`).
  Template surgery: point M18's column/row at the paid-date cell, flip the warning into a
  real check, prove breakable.








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
