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

- **SE-T37a to T37g**: the design is `PLAN_DIYA_GL_SE_CLI_MCP_WEB.md`'s "T37 design" section:
  bank already has `addBankLine`; SE's cash grid is a view of bank lines on account 1220; only payroll
  needs a new edit; Ltd's payroll chart section is T33's gap on Ltd; the bank row's account select must
  commit `changeLineBankAccount`, not `changeLineAccount`.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| SE-T37a | `addPayrollLine` beside `addBankLine`, the net-and-amount derivation shared with `changePayrollLine`; bundle and MCP edit map | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | code complete in batch PR #68 (`f46c7eba`); 326 cases pass |
| SE-T37b | The add row renders the controls the journal's `add` descriptor names; the draft store reads them; a bank row's account select routes by journal | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet; worktree SE-T37b, `claude/se-add-row`, batch PR #68 |
| SE-T37c | `addEntry` routes on the descriptor's kind and builds the bank and payroll line shapes | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet; worktree SE-T37c, `claude/se-add-routing`, batch PR #68 |
| SE-T37d | The SE manifest's bank, cash and payroll `add` descriptors | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | code complete in batch PR #68 (`294f978f`); 13 SE cases pass |
| SE-T37e | The Ltd manifest's bank and payroll descriptors and its payroll chart section | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet; worktree SE-T37e, `claude/ltd-add-descriptors`, batch PR #68 |
| SE-T37f | The SE proof: add rows render; a bank receipt, a cash payment and a payslip land with anchored figures | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T37b, SE-T37c, SE-T37d | blocked-to-start | Sonnet |
| SE-T37g | The Ltd proof: the bank add and the transfer pair with its counter-leg | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T37b, SE-T37c, SE-T37e, SE-T37f | blocked-to-start | Haiku |
| H4 | Merge the b2 batch PR once T37a to T37g are code complete and its checks are green | none | human | SE-T37g | blocked-to-start | draft PR #68 on `claude/b2-add-row` |

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
