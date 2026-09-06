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
them) and merge back; until they land, the batch's `overtype-sidecar` BST cases and the committed
half of `ltd-link-caches` read the stale packages and are red. Sub-agents run no LibreOffice and
prove JS calculations against the committed packages' extraction (`report.js --source-dir`). The
wave schedule is in `_developers/WAVES_DIYA_GL_PRODUCTS.md`. `PLAN_DIYA_GL_LAUNCH.md` is the launch
and revenue plan of record and carries its own open items.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| BST-T19 | The BST page renders the profit bridge (nine `section/accounting-profit-to-tax-profit-bridge/` keys declared today) and an `Admin!N17` row | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet; after the BST package refresh carries `Admin!N17` |
| SE-T13 | T13 SE UX pass at four viewports, axe, keyboard | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/se-t13` on `claude/wt-se-t13`; Fable |
| SE-T20 | Straddling VAT entries reach the diya-gl books: the extractor keeps `vatPeriodEnd` lines, the loader splits them back out; `reportAmount` rounds in two steps; the generate-se scorecard comment says what the code does | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | ready-to-start | Opus; after the SE package refresh on the batch |
| SE-H1 | Merge the next batch to main; four `generate-*` on the branch first; generate-se refresh | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | human | SE-T9, SE-T12, SE-T13, SE-T17, SE-T19, SE-T20, SE-T21 | blocked-to-start | after the next batch |
| TX-T17 | Taxi T17 equivalence, formats, edits, layouts; `r-sources.js` takes a product | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/tx-t17` on `claude/wt-tx-t17`; Sonnet |
| TX-T18 | Taxi T18 the form-box proof on both routes | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T17, SE-T13 | blocked-to-start | Sonnet, wave 10 |
| LT-T25 | Ltd T25 the cash top-up's counter leg; the writer's `BC` gate holds under every year end's period shift; the SE and Ltd round trips bring the leg back | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/lt-t25` on `claude/wt-lt-t25`; Sonnet; generate-bst on the refresh branch showed both |
| LT-T9 | Ltd T9 unrepresentable list and render coverage | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/lt-t9` on `claude/wt-lt-t9`; Haiku |
| LT-T11 | Ltd T11 equivalence suite; S3 from ltd-latest with the seven-month shift; the page's drift layer reads all nine link-bearing files, not the hub alone; `examples/ltd-latest` line dates and CT600 `C126`/`C128` sit a year off its Admin period, so S3's shift is settled against the generator | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | TX-T17 | blocked-to-start | Opus, wave 9 |
| LT-T12 | Ltd T12 formats suite: E3 on both year ends, E4, E5 | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T11 | blocked-to-start | Sonnet, wave 10 |
| LT-T13 | Ltd T13 edits and warnings suites | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/lt-t13` on `claude/wt-lt-t13`; Sonnet; plus LT-T7's findings: entity fields reach the calculator, unmatched settlements, class labels |
| LT-T14 | Ltd T14 layouts and axe | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/lt-t14` on `claude/wt-lt-t14`; Sonnet |
| LT-T17 | Ltd T17 behaviour probe | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T11 | blocked-to-start | Sonnet, wave 10 |
| LT-T18 | Ltd T18 register the Ltd specs in `playwright.config.js` | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T9, LT-T11, LT-T12, LT-T13, LT-T14, TX-T18 | blocked-to-start | Haiku, wave 11 |
| LT-T21 | Ltd T21 the CT600 sheet's capital allowance boxes read the working sheet's empty column H; point AA177, AL177 and AA179 at column I in the template and regenerate | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/lt-t21` on `claude/wt-lt-t21`; Sonnet; a template change, one reviewed binary commit |
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
