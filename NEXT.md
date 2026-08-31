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
- EQ1 track (Opus) — E1: started; also owns the trio's exportedLines failures (12 payroll
  lines short in every product run — the exporter's fixed-row payslip reads diverged from
  the landed layout-derived writes) and calculator-se's read-scope failure
- CI-fallout track (Sonnet) — the other 23 failures from PR #48's CI run 33425871047:
  started. B2's land fixture rippled into hand-computed expectations (calculator-ltd,
  opening-balance, FA note, NBV, loader count, brickwork sets) and B3's carriage check
  joined corruption flip-sets; the two EQ3 stability failures get root-caused, not parked.
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
- [ ] **E1: the batch's new reads have no JS-engine values — the EQ1 gate fails** (Sonnet) —
  surfaced by B1+B2's track running `test.yml`'s `roundtrip-ltd` steps locally: the budget
  gate fails with `differing: 2` and `noJsValue: 182` on keys from `Companysecretary.xlsx`,
  `Payslips.xlsx`, `FAreconciliation` and the two Schedule additions/disposals checks —
  exactly the reads T1, C1, C2 and C3 added to `additionalReads` without teaching the JS
  engine to emit them. Per the fidelity plan, every read cell needs a JS source or a place
  on a declared blanks list. Reproduction on the branch tip in progress; must be fixed
  before PR #48 leaves draft (CI runs this gate).
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
