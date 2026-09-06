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
| BST-T19 | The BST page renders the profit bridge (nine `section/accounting-profit-to-tax-profit-bridge/` keys declared today) and an `Admin!N17` row | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet; after the BST package refresh carries `Admin!N17` |
| SE-T20 | Straddling VAT entries reach the diya-gl books: the extractor keeps `vatPeriodEnd` lines, the loader splits them back out; `reportAmount` rounds in two steps; the generate-se scorecard comment says what the code does | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | ready-to-start | Opus; after the SE package refresh on the batch |
| SE-H1 | Merge the next batch to main; four `generate-*` on the branch first; generate-se refresh | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | human | SE-T9, SE-T12, SE-T13, SE-T17, SE-T19, SE-T20, SE-T21 | blocked-to-start | after the next batch |
| BST-T20 | BST's `Total Tax + NI` check subtracts the CIS already deducted, as SE's does, proved on a CIS-bearing BST book (`brickwork-pro/bst-nonvat`) | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/bst-t20` on `claude/wt-bst-t20`; Sonnet |
| SE-T29 | The SE writer shifts posting dates into the package's period as the Ltd writer now does (`products/se.js:266` writes them unshifted, so `se-latest` stamped 2027-04-05 carries 2025/26 dates); the SE A7 re-render case makes its own drift instead of relying on the shipped package's | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/se-t29` on `claude/wt-se-t29`; Sonnet |
| LT-T12 | Ltd T12 formats suite: E3 on both year ends, E4, E5 | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/lt-t12` on `claude/wt-lt-t12`; Sonnet; plus LT-T11's finding: the ledger view prints the creditor listing's total under `TrialBalance!EJ28` |
| LT-T18 | Ltd T18 register the Ltd specs in `playwright.config.js` | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T12 | blocked-to-start | Haiku, wave 11 |
| LT-M1 | Merge the batch PR; generate-ltd with skip-commit on the branch; refresh on main | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | human | LT-T9, LT-T11, LT-T12, LT-T13, LT-T14, LT-T15, LT-T17, LT-T18 | blocked-to-start | after wave 11 and R6 |

## Plans not tracked here

- `PLAN_DIYA_GL_LAUNCH.md` carries its own open items (the Rust port plan and the operator's
  research). Its phase rows are not yet on the board.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
