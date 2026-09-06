# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

PR #67 merged to main on 2026-09-06 with the b1 batch (CodeQL fixes, four SE rows, two Taxi
specs, the save-menu, download-page and title changes); prod deploys from that merge. CodeQL
runs from `.github/workflows/codeql.yml` on `test.yml`'s trigger criteria. Sub-agents run no
LibreOffice and prove JS calculations against the committed packages' extraction
(`report.js --source-dir`). Every worktree lives at `../.worktrees/spreadsheets/<row>` on a
branch named `claude/<ns>-<topic>` while its row is in flight, and the board names it; a fresh
worktree needs `node scripts/build-books-bundle.mjs` before any books browser spec, and a rebuild
after merging engine changes. The generate workflows cancel their own in-progress run on a push
to their ref, so a session pushes nothing to a branch while a generate run is in progress on it.
`PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue plan of record and carries its own open items.

## Context for the open rows

- **SE-T37**: `web/.../books/edits.js:195` `addEntry` sends every journal but `sales` through
  `addPurchaseLine`, which refuses bank, cash and payroll lines on the `sourceJournalID` guard in
  `app/lib/diya-gl-edits.js`. The add row needs a direction and bank account for bank and cash
  lines and payslip fields for payroll, then a per-journal edit call; the plan's T37 row names the
  files. Design first: the add-row fields are a UI decision.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| SE-T37 | The entries grid's Add button throws for bank, cash and payroll lines: `addEntry` routes every journal but sales through `addPurchaseLine` | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Opus design of the add-row fields; worktree SE-T37, `claude/se-add-routing` |

## Plans not tracked here

- `PLAN_DIYA_GL_LAUNCH.md` carries its own open items (the Rust port plan and the operator's
  research). Its phase rows are not yet on the board.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first). A generate workflow's commit job pushes with the default
  `GITHUB_TOKEN`, which fires no workflow, so a package commit deploys only through
  `gh workflow run deploy.yml -f environment-name=prod` or the 07:17 UTC schedule.
