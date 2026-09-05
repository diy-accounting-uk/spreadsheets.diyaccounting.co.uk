# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Resumed 2026-09-05.
The three successor plans (`PLAN_DIYA_GL_SE_CLI_MCP_WEB.md`, `PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md`,
`PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md`) are being executed as one coordinated batch on
`claude/diya-gl-products` (draft PR #60; every sub-agent worktree under
`../.worktrees/spreadsheets/<row>` forks from main and merges the batch branch; the coordinator
merges each verified commit into the batch branch and pushes; docs go to main). Each plan carries
a `## Briefs` section, one per row; the cross-plan schedule, shared-file landing order and
regeneration points are in `_developers/WAVES_DIYA_GL_PRODUCTS.md`. R1 and R2 are green on the
branch; generate-bst is green after the Class 2 field fix. The PR's `test` job is red at the head
for two reasons: `books-equivalence` A3 compares the committed `examples/bst-latest` (Admin L17
still 0) with the engine (3.50), which only the bst-latest refresh clears (the operator's main-side
generate-bst after merge, or a commit-mode generate-bst on the branch if the operator prefers the
PR green first); and two `taxi-wages-forecast-checks` expectations predate Taxi T4's other income,
which Taxi T5 corrects. R4 is green (generate-se, -bst, -ltd). R3 is green on its fifth run, so all four generate gates pass on the branch; R5 (generate-se after SE T16's template) is green on its second run, the first having wanted a SA103 mapping entry for the new `D124` label. The page-boot regression after S8 (the loader still read the manifest's examples) is fixed in T7's first commit; the batch head's own browser run is 175 of 176, the one red being the stale committed bst-latest. Operator, 2026-09-05: no further Ltd rows go in flight until the three running (T20, T4a,
T24) land; sub-agents run no LibreOffice, and test the JS calculations against the committed
packages' extraction (`report.js --source-dir` over `packages/` or `examples/*-latest`) instead. PR #61 (the stray Taxi T20 commit on main) merged 2026-09-05; the batch keeps the change. To resume: read the board below; rows marked `ready-to-resume` have a worktree with
committed partial work (its last commit message says what remains); rows marked
`ready-to-start` with a worktree named have a fresh worktree and no agent yet; merge the batch
branch into any worktree before dispatching. `PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue
plan of record; its seven decisions were taken on 2026-09-04 and it carries its own open items
(the Rust port plan and the operator's research for it).

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| SE-T9 | T9 SE examples, deep links, download panel, behaviour probe | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | TX-T16 | blocked-to-start | Sonnet, wave 8 |
| SE-T10 | T10 SE render coverage and unrepresentable list | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet, `.worktrees/spreadsheets/se-t10`, fixing the sweep after a Haiku pass |
| SE-T12 | T12 SE edit and warning proofs in the browser | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet, `.worktrees/spreadsheets/se-t12` |
| SE-T13 | T13 SE UX pass at four viewports, axe, keyboard | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T12 | blocked-to-start | Fable, wave 10 |
| SE-T17 | `diya-gl-loader` gives SE a depreciation table; `extract-scenarios` keeps `total_motor_net` pence; `fmtMoney` rounds as the canonical value does; `Payment!B4:C15` carry a date unit | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet, `.worktrees/spreadsheets/se-t17` |
| SE-T20 | Straddling VAT entries reach the diya-gl books: the extractor keeps `vatPeriodEnd` lines, the loader splits them back out; `reportAmount` rounds in two steps; the generate-se scorecard comment says what the code does | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T17 | blocked-to-start | Opus; rewrites every product's example books, so after SE-T17's regeneration |
| SE-T19 | The SE page accepts the nine-file package: `upload.validate`, `extractLines`, `drift.js` units for element rows; A7 drift and stale-cache proofs | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Opus, `.worktrees/spreadsheets/se-t19` |
| SE-H1 | Merge the batch to main; four `generate-*` on the branch first; generate-se refresh | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | human | SE-T9, SE-T10, SE-T12, SE-T13, SE-T14, SE-T17, SE-T20, SE-T19 | blocked-to-start | after wave 10 and R6 |
| TX-T16 | Taxi T16 example books, `taxi.html`, download panel, behaviour probe | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | LT-T7 | blocked-to-start | Sonnet, wave 7, one worktree with LT-T10 |
| TX-T17 | Taxi T17 equivalence, formats, edits, layouts; `r-sources.js` takes a product | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T16, TX-H1, SE-T12 | blocked-to-start | Sonnet, wave 9 |
| TX-T18 | Taxi T18 the form-box proof on both routes | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T17, SE-T13 | blocked-to-start | Sonnet, wave 10 |
| TX-T24 | BST and Taxi `SE Short` gate the expense boxes on `Admin!F26`, not `30000`; `calculators/bst.js:293` follows; the L111 and L116 tick captions take SE-T16b's text; `CONTEXT_TAXI.md` P&L table verified | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet, `.worktrees/spreadsheets/taxi-t24` |
| BST-T17 | `form-layouts/bst.json` replaces `products/bst.js` `SA103S_BOXES`, whose numbers match no form; the BST SA103S renders through `helpers.form`; `CONTEXT_BASIC_SOLE_TRADER.md` SA103S tables and the `D106` comments verified against the sheet | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet, `.worktrees/spreadsheets/bst-t17` |
| TX-H1 | Merge the batch to main after TX-T6; generate-taxi refresh on main | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | human | — | ready-to-start | all four generate gates green on the branch; merge PR #60 and refresh |
| LT-T2 | Ltd T2 anchor table for thirteen workbooks; input-cell predicate | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet, wave 6; Ltd held by the operator |
| LT-T4b | Ltd T4 `linkCacheReader`, cache-agreement test, stale-cache test | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T2 | blocked-to-start | Opus, wave 7 |
| LT-T6b | Ltd T6 settlement helpers proved on Ltd books | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet, wave 7 |
| LT-T7 | Ltd T7 view manifest, ledger half; `ltd.html`, `ltd.css` | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet, wave 6 |
| LT-T8 | Ltd T8 forms: Accounts, Corporation tax, CT600, VAT, Payroll, Company | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T7 | blocked-to-start | Opus, wave 8 |
| LT-T9 | Ltd T9 unrepresentable list and render coverage | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T7, LT-T8 | blocked-to-start | Haiku, wave 9 |
| LT-T10 | Ltd T10 example rows in `scripts/example-books.json`, bundle assets, deep links | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T7 | blocked-to-start | Sonnet, wave 7, one worktree with TX-T16 |
| LT-T11 | Ltd T11 equivalence suite; S3 from ltd-latest with the seven-month shift | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T2, LT-T4b, LT-T7, LT-T8, TX-T17 | blocked-to-start | Opus, wave 9 |
| LT-T12 | Ltd T12 formats suite: E3 on both year ends, E4, E5 | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T2, LT-T11 | blocked-to-start | Sonnet, wave 10 |
| LT-T13 | Ltd T13 edits and warnings suites | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T6b, LT-T7 | blocked-to-start | Sonnet, wave 8 |
| LT-T14 | Ltd T14 layouts and axe | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T7, LT-T8 | blocked-to-start | Sonnet, wave 9 |
| LT-T15 | Ltd T15 CLI and MCP harness; Ltd edits in the edit map | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T2 | blocked-to-start | Sonnet, wave 7 |
| LT-T17 | Ltd T17 behaviour probe | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T10, LT-T11, SE-T9 | blocked-to-start | Sonnet, wave 10 |
| LT-T18 | Ltd T18 register the Ltd specs in `playwright.config.js` | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T9, LT-T11, LT-T12, LT-T13, LT-T14, TX-T18 | blocked-to-start | Haiku, wave 11 |
| LT-T21 | Ltd T21 the CT600 sheet's capital allowance boxes read the working sheet's empty column H; point AA177, AL177 and AA179 at column I in the template and regenerate | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T8 | blocked-to-start | Sonnet, with R6; a template change, one reviewed binary commit |
| LT-T23 | Ltd T23 the Ltd rule ids take the shared `book-` prefix (`ltd-*` becomes `book-ltd-*`), so all three products name rules one way before the pages hard-code them | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | ready-to-start | Haiku, before SE-T7 and TX-T13 |
| LT-T25 | Ltd T25 the cash top-up's counter leg: the sole-trader adaptation in `extract-scenarios.js` maps Ltd transfer codes to SE's before the leg lands in the master; the VAT settlement twins and `vatBroughtForward` get their own entry numbers | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet, wave 5; touches `se-vat` and `ltd-vat` |
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
