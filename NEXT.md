# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

**Book read-back batch, wave 2** — continues on `claude/book-readback-2` (draft PR back to
main; wave 1 landed via PR #52 with a green branch deploy). Shared exit criterion unchanged:
every product's `bookFieldsMissing` in `app/data/roundtrip-budget.json` reaches zero, with
the decided-out fields (per-contact ledgers, any other structural absence) held as declared
absences with reasons, never silently closed.

- [x] T5 — landed on the batch branch: `Payslips!M18` repointed at the wages-paid cell in
  both products, the warning flipped to a real check; featured scenarios go clean at the
  refresh (the judge re-pin rides the closeout).
- [x] T7 — landed on the batch branch: the monthly payroll calendar on a renamed tab now
  carries that tab's month of the accounting period (generator-only, Ltd non-March, March
  byte-stable), with a breakable per-tab check in both engines.
- [x] weekly-cache roll + Payment realignment + the Mar-2024 leap fix — landed (merged;
  judge test 108/108 and 151 payslips tests green on the merged branch). The leap bug was
  the template's fixed day-counts (no count fits both payroll-year lengths — plus a
  previously unchecked common-year defect, C14/C15 on the 20th); the generator now writes
  the payroll months' real dates. The branch is otherwise stable: re-run `generate-ltd`
  (expect 25/25), then the closeout. Every SE/Ltd `packages/*/Payslips.xlsx` and report is
  stale until the refresh.
- [x] fixture-master rate alignment — landed (`774d52af`, merged; sync gate re-proven on
  the merged masters, zero drift; 244 blast tests green). Budgets unchanged — the gain is
  in the ungated book-level differing counts (BST 53→50, Taxi 13→10).
- [x] labels-track regression — the SE CELL_MAP deletions had emptied the calculators' read
  scope (`withinReadScope()`) and 13 SE checks with it; restored with schema-correct names
  inside the asset-attributes track. Done when this branch merges.
- [ ] batch closeout (operator, decided 2026-09-01): when the branch is otherwise stable,
  the operator re-runs all four generators in CI and commits; one clean serial `npm test`
  sweep rides the same moment. Two riders land WITH that refresh: re-pin
  `app/test/judge-reconciliation.test.js` to the post-fix reports (SE and Ltd go clean —
  947/947 on the Ltd brickwork pair, no payslip warning — the pins deliberately stay on the
  committed pre-fix reports until then, since the reconciliations drive the committed
  `packages/`, which only the refresh rebuilds with the T5/T7 fixes), and the reports will
  then show T7's twelve calendar checks and T5's payment-date check passing.
- [ ] archive `PLAN_ROUNDTRIP_FIDELITY.md` when the full set lands — merged to main,
  regenerated, deployed to prod. The plan is then fully closed (all gates at zero, declared
  absences held); its record moves out of the live plan set.

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.
T5 and T7 landed on the batch branch; nothing is open outside the in-flight block above.








## Plans not tracked here

- `PLAN_DIYA_GL_BST_CLI_MCP_WEB_SPIKE.md` — a BST package opens, edits, recalculates and saves as
  diya-gl, delivered as a CLI, then an MCP server, then a browser page. In delivery on
  `claude/bst-cli-phase-1`; the plan's own tracking blocks carry progress.
- `PLAN_PACKAGES_TO_ARCHIVE.md` — first cut into the archive repository via the `archive-packages` skill; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
