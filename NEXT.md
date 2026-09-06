# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Batch `claude/diya-gl-wave-2` (from main `4d0241d9`) works the board top to bottom: the paused
worktrees first, then each product's block. Every worktree lives at
`../.worktrees/spreadsheets/<row>` on `claude/wt-<row>` with a `node_modules` symlink; the
coordinator merges each landed commit into the batch branch, runs the row's non-LibreOffice tests,
and pushes; `NEXT.md` tracking commits ride on the batch branch. The four `generate-*` refreshes ran once on a refresh branch, since merged and deleted; the
operator reruns them on the batch itself (`generate-all.yml`), so no session pushes to the batch
while they run; the operator's own rerun on the batch failed on the writers' date
shift (the scorecard, fixed by PL-4, and the date-bearing compliance checks, SE-T30 and LT-T26).
Closing order once those land: the formatter over the batch's touched files, the full unit and
browser runs (LT-T18), the four generate runs on the batch (`generate-all.yml`), test.yml green,
then the PR leaves draft. Sub-agents run no LibreOffice and
prove JS calculations against the committed packages' extraction (`report.js --source-dir`). The
wave schedule is in `_developers/WAVES_DIYA_GL_PRODUCTS.md`. `PLAN_DIYA_GL_LAUNCH.md` is the launch
and revenue plan of record and carries its own open items.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| LT-T18 | Ltd T18 the closing gate: the full unit and browser runs and CI's test workflow green on the batch head | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | in-flight | local gates green at `23276a43`; CI test.yml running at `85f6b5da` |
| SE-H1 | Merge the batch to main; the four `generate-*` on the branch first; the refresh on main | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | human | LT-T18 | blocked-to-start | PR #62, draft until the CI gate is green |
| LT-M1 | Merge the batch PR; generate-ltd on the branch; the refresh on main | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | human | LT-T18 | blocked-to-start | PR #62, the same merge as SE-H1 |

## Plans not tracked here

- `PLAN_DIYA_GL_LAUNCH.md` carries its own open items (the Rust port plan and the operator's
  research). Its phase rows are not yet on the board.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
