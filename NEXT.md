# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Batch `claude/diya-gl-wave-2` (from main `4d0241d9`) works the board top to bottom: the paused
worktrees first, then each product's block. Every worktree lives at
`../.worktrees/spreadsheets/<row>` on `claude/wt-<row>` with a `node_modules` symlink; the
coordinator merges each landed commit into the batch branch, runs the row's non-LibreOffice tests,
and pushes; `NEXT.md` tracking commits ride on the batch branch. The four `generate-*` refreshes run on
`claude/diya-gl-wave-2-refresh` (cut from the batch head, so the batch's own pushes cannot cancel
them) and merge back; all four have landed once, and the rows that change packages or reports
since then need another pass before the PR leaves draft. Sub-agents run no LibreOffice and
prove JS calculations against the committed packages' extraction (`report.js --source-dir`). The
wave schedule is in `_developers/WAVES_DIYA_GL_PRODUCTS.md`. `PLAN_DIYA_GL_LAUNCH.md` is the launch
and revenue plan of record and carries its own open items.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| TX-T27 | The Profit Forecast checks in `products/{se,taxi}.js` compare at the penny while the Forecast sheets round; match the sheets' own rounding (the branch's `se-profit-forecast-checks` fails five forecast checks on the uncorrupted book since TX-T26) | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/tx-t27` on `claude/wt-tx-t27`; Sonnet |
| SE-T30 | `checkCompliance` in `products/se.js` compares date-bearing expectations unshifted against a package whose postings the writer now shifts: the operator's generate-se run fails four checks on every year end but 2026-04-05 (866 of 870) | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/se-t30` on `claude/wt-se-t30`; Sonnet |
| SE-H1 | Merge the next batch to main; four `generate-*` on the branch first; generate-se refresh | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | human | LT-T18 | blocked-to-start | PR #62, draft until the closing gates are green |
| LT-T26 | `checkCompliance` in `products/ltd.js` compares date-bearing expectations (the PAYE schedule and year-end seed checks) unshifted against a package whose postings the writer now shifts by years: the operator's generate-ltd run fails four checks on every year end but 2027-02-28 (1087 of 1091) | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/lt-t26` on `claude/wt-lt-t26`; Sonnet |
| LT-T18 | Ltd T18 register the Ltd specs in `playwright.config.js` | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | TX-T27, SE-T30, LT-T26 | blocked-to-start | the full unit and browser runs and one more four-product refresh, on the batch head |
| LT-M1 | Merge the batch PR; generate-ltd with skip-commit on the branch; refresh on main | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | human | LT-T18 | blocked-to-start | PR #62, the same merge as SE-H1 |

## Plans not tracked here

- `PLAN_DIYA_GL_LAUNCH.md` carries its own open items (the Rust port plan and the operator's
  research). Its phase rows are not yet on the board.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
