# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

PR #62 (`claude/diya-gl-wave-2`, 54 rows) merged to main on 2026-09-06 at `d235d704`; the batch
branch is deleted on both sides, no worktree exists under `../.worktrees/spreadsheets/`, and `main`
is the only local branch. The four plans were audited against the tree the same day and record every
row as delivered; the audits' remainders are the board's open rows. The operator's `generate-all.yml`
run 34026795912 is regenerating the four packages on main (row M1). Sub-agents run no LibreOffice and
prove JS calculations against the committed packages' extraction (`report.js --source-dir`). Every
worktree lives at `../.worktrees/spreadsheets/<row>` on `claude/wt-<row>` while its row is in flight,
and the board names it. The generate workflows cancel their own in-progress run on a push to their
ref, so a session pushes nothing to a branch while a generate run is in progress on it.
`PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue plan of record and carries its own open items.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| CQ-4 | CodeQL still flags `web/unit-tests/smoke.test.js` lines 32 and 40 (path injection: the resolve-and-prefix guard is not one it recognises; read the request path from an allowlist) and `books/shell.js:1337` (a property chain assigned without a prototype guard) | none | machine | — | ready-to-start | Sonnet; alerts 12, 19, 20 on main's scan after PR #62 |
| SE-T32 | `REPOST_PREFERRED` in `app/lib/book-checks.js` has no `SelfEmployed` entry, so an SE purchase settlement reposts to the chart's first account rather than a sane default | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet |
| SE-T33 | The cash and payroll journals render an empty chart in the entries grid | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet |
| SE-T34 | The reconciliation judge has no indicator for CIS suffered, so a negative Total Tax + NI on a CIS-heavy SE book reads as an unexplained query | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet |
| SE-T35 | `product-workbook.js`'s `PRODUCT_BY_SCHEMA_NAME` duplicates the inverse of `xlsx-exporter.js`'s `SCHEMA_PRODUCT_NAMES`; one map | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | ready-to-start | Haiku |
| SE-T36 | `app/bin/generate.js` calls `main()` on import with no CLI guard, so nothing can import it safely | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | ready-to-start | Haiku |
| TX-T21 | `books-taxi-takings.browser.test.js`: the takings-view cases T17 did not absorb (undo, the mobile-portrait week and day cards, `changeLineDetail` through the page) | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet |
| TX-T22 | `books-taxi-views.browser.test.js`: the comparison panel, vehicle register, quarterly and forecast summaries and the drift-survival case at the DOM level | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet |
| M1 | The four `generate-*` on main with commit (`generate-all.yml`), then `deploy.yml`, so the committed packages, reports and reconciliation pages match the merged writers | operator | human | — | in-flight | `generate-all.yml` run 34026795912: BST at its latest reconcile; prod already deployed from `d235d704` |

## Plans not tracked here

- `PLAN_DIYA_GL_LAUNCH.md` carries its own open items (the Rust port plan and the operator's
  research). Its phase rows are not yet on the board.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
