# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Nothing. Main is refreshed and deployed through PRs #46 and #47 (deploy green at `2c560c9c`,
all four generate-commit refreshes in); every later PR branch starts from a rebase onto that
main, and the operator dispatches CI on branches.

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

Each item names its suggested sub-agent tier; all branch from the post-deploy green main and
follow the reconciliation-bug method.

- [ ] **Reconciliation judge flags the ltd VAT run.** The deploy for PR #46's merge
  commit failed at the "judge reconciliation reports" step with a genuine finding, then
  the later green deploy (`2c560c9c`) routed past it, so it stands unaddressed: box 63's
  corporation tax charge is roughly half the working sheet's figure, and capital
  allowances don't match headline capital spend. Follow the reconciliation-bug method;
  check overlap with the fifth-surface population below before treating it as separate.
  Suggested tier: Opus.









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
