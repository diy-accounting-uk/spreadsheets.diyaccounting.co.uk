# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

PR #62 (`claude/diya-gl-wave-2`, 54 rows) merged to main on 2026-09-06 at `d235d704`; the batch
branch is deleted on both sides. The four plans are being audited against the tree, one worktree per
plan (`../.worktrees/spreadsheets/audit-{se,taxi,ltd}` on `claude/wt-audit-{se,taxi,ltd}`, docs only,
landing on main directly); no other worktree or local branch exists. Sub-agents run no LibreOffice and
prove JS calculations against the committed packages' extraction (`report.js --source-dir`). The
generate workflows (`generate-all.yml` runs all four in sequence) cancel their own in-progress run on
a push to their ref, so a session pushes nothing to a branch while a generate run is in progress on
it. `PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue plan of record and carries its own open items.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| M1 | The four `generate-*` on main with commit (`generate-all.yml`), then `deploy.yml`, so the committed packages, reports and reconciliation pages match the merged writers, and prod carries the batch | operator | human | — | ready-to-start | the last generate runs were on the batch at `f2c0fdc7`, before the fixes |

## Plans not tracked here

- `PLAN_DIYA_GL_LAUNCH.md` carries its own open items (the Rust port plan and the operator's
  research). Its phase rows are not yet on the board.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
