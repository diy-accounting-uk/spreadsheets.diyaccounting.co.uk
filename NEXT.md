# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

The three successor plans (`PLAN_DIYA_GL_SE_CLI_MCP_WEB.md`, `PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md`,
`PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md`) are being executed as one coordinated batch, started
2026-09-04. Batch branch: `claude/diya-gl-products` (from main; every sub-agent worktree forks
from main and opens by merging the batch branch; the coordinator merges each verified commit
into the batch branch and pushes in batches; a draft PR to main opens with the first merge).
Each plan carries a `## Briefs` section, one per row; the cross-plan schedule, shared-file landing
order and regeneration points are in `_developers/WAVES_DIYA_GL_PRODUCTS.md`. Draft PR #60. `PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue
plan of record; its seven decisions were taken on 2026-09-04 and it carries its own open items
(the Rust port plan and the operator's research for it).

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| SE-S1 | S1 the workbook set: adapters, `package-set`, product sniff, `openWorkbookSet` | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Opus, wave 3, `.worktrees/spreadsheets/se-s1` |
| SE-S2 | S2 anchor runner over per-product tables; extraction map keyed by file | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-S1 | blocked-to-start | Sonnet, wave 4, after TX-T6 in `xlsx-exporter.js` |
| SE-S3 | S3 `product-workbook.js`: any product, `fullCalcOnLoad` on every file, package zip | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Opus, wave 2, `.worktrees/spreadsheets/se-s3` |
| SE-S4d | S4 design: the pure link-cache refresh's coding brief | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Fable, wave 2, `.worktrees/spreadsheets/se-s4-design` |
| SE-S4 | S4 `link-caches.js`, the calculator's leaf cells, the stale-cache state | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-S4d, SE-S3, SE-T3, SE-S7 | blocked-to-start | Fable, wave 6 |
| SE-S5 | S5 headline keys declared per product; `headlinesFromReport(report, declaration)` | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet, wave 2, `.worktrees/spreadsheets/se-s5`, lands after SE-S3 |
| SE-S6 | S6 engine product map; MCP server becomes `diya-gl` | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-S1, SE-S3, SE-S5 | blocked-to-start | Sonnet, wave 4, after SE-S2 |
| SE-S7d | S7 design: shell and per-product manifest coding brief | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Fable, wave 2, `.worktrees/spreadsheets/se-s7-design` |
| SE-S7 | S7 the shell, `data.js`, `products/bst.js`, `books.css` | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-S6 | blocked-to-start | Fable, wave 5 |
| SE-S8 | S8 example books per product from `scripts/example-books.json` | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-S7 | blocked-to-start | Haiku, wave 6, after SE-T2 in the bundle script |
| SE-T1 | T1 SE anchor table and input-cell predicate | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-S2 | blocked-to-start | Sonnet, wave 5 |
| SE-T2 | T2 SE writer inputs; five throws become skips; nine-file package reconciles | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-S3, SE-T1, SE-T5 | blocked-to-start | Opus, wave 6 |
| SE-T3 | T3 CIS both ways; BrickWork CIS-suffered sale; regeneration point | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-S2 | blocked-to-start | Opus, wave 5, R4 after merge |
| SE-T4 | T4 SE headline declaration | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-S5, SE-T3, SE-T2 | blocked-to-start | Sonnet, wave 7 |
| SE-T5 | T5 SE book checks, warnings, helpers, `bankBalancesByMonth` | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | TX-T4 | blocked-to-start | Opus, wave 3 |
| SE-T6 | T6 settlement helpers and `addBankLine` | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T5, SE-S6 | blocked-to-start | Opus, wave 6 |
| SE-T7 | T7 SE view manifest, renders, new-book form | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-S7, SE-S4, SE-T5, SE-T6 | blocked-to-start | Opus, wave 7 |
| SE-T8 | T8 SE forms as layout modules: SA103S, SA103F, VAT, computation | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-S7, SE-T7 | blocked-to-start | Sonnet, wave 7, after SE-T7 |
| SE-T9 | T9 SE examples, deep links, download panel, behaviour probe | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-S8, SE-T7, TX-T16 | blocked-to-start | Sonnet, wave 8 |
| SE-T10 | T10 SE render coverage and unrepresentable list | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T7, SE-T8, SE-T16 | blocked-to-start | Haiku, wave 9 |
| SE-T11 | T11 SE equivalence, formats, round trips (A1–A9, E3–E5) | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T7, SE-T8, SE-S4, SE-T3, SE-T14 | blocked-to-start | Opus, wave 8 |
| SE-T12 | T12 SE edit and warning proofs in the browser | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T5, SE-T6, SE-T7, SE-T11 | blocked-to-start | Sonnet, wave 9 |
| SE-T13 | T13 SE UX pass at four viewports, axe, keyboard | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T7, SE-T8, SE-T12 | blocked-to-start | Fable, wave 10 |
| SE-T14 | T14 CLI and MCP on SE | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-S6, SE-T2 | blocked-to-start | Sonnet, wave 7 |
| SE-T16 | T16 `SE Short` prints the 2026 numbers; gates on `Admin!F26`; regenerated | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T4 | blocked-to-start | Opus, wave 8, R5 after merge |
| SE-H1 | Merge the batch to main; four `generate-*` on the branch first; generate-se refresh | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | human | SE-T9, SE-T10, SE-T11, SE-T12, SE-T13, SE-T14, SE-T15, SE-T16 | blocked-to-start | after wave 10 and R6 |
| TX-T4 | Taxi T4 other income end to end: 4001, fixtures, calculator, checks | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet, wave 2, `.worktrees/spreadsheets/taxi-t4` |
| TX-T5 | Taxi T5 partial-year Wages Forecast, autumn-start master | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T4 | blocked-to-start | Opus, wave 3 |
| TX-T6 | Taxi T6 `CELL_MAP` additions, Business Details move, CONTEXT doc; regeneration point | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T4, TX-T5 | blocked-to-start | Sonnet, wave 4, R3 after merge |
| TX-T20 | Taxi T20 SP Sixty's last fifteen fare days carry their miles in the master; fixtures regenerated | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T4 | blocked-to-start | Haiku, wave 3, after TX-T4 in `examples/` |
| TX-T9 | Taxi T9 extraction map and the sidecar's Taxi baseline | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | SE-S2, TX-T6 | blocked-to-start | Sonnet, wave 6 |
| TX-T10 | Taxi T10 anchor table in `anchors/taxi.js` | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | SE-S2 | blocked-to-start | Sonnet, wave 6, before LT-T2 in `books-interchange.js` |
| TX-T11 | Taxi T11 through the product writer, CLI and MCP | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | SE-S3, SE-S6 | blocked-to-start | Sonnet, wave 5 |
| TX-T12 | Taxi T12 headline declaration and the comparison tile | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | SE-S5, TX-T6, LT-T3b | blocked-to-start | Sonnet, wave 5 |
| TX-T13d | Taxi T13 design: manifest brief plus T14 and T15 briefs | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | in-flight | Fable, wave 3, `.worktrees/spreadsheets/taxi-t13-design` |
| TX-T13 | Taxi T13 view manifest, derivations, `render-unrepresentable/taxi.json` | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T13d, SE-S7, TX-T6 | blocked-to-start | tier per brief, wave 6 |
| TX-T14d | Taxi T14 design: the takings view brief | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T13d | blocked-to-start | Fable, wave 4, brief appended under T14 |
| TX-T14 | Taxi T14 the takings view: year, month, week, day, fares | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T14d, TX-T13 | blocked-to-start | tier per brief, wave 7 |
| TX-T15d | Taxi T15 design: comparison panel, computation, SA103S brief | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T13d, TX2 | blocked-to-start | Opus, wave 4, brief appended under T15 |
| TX-T15 | Taxi T15 the remaining views and the SA103S render | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T15d, TX-T13, SE-T8, TX2 | blocked-to-start | tier per brief, wave 8 |
| TX-T16 | Taxi T16 example books, `taxi.html`, download panel, behaviour probe | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | SE-S8, TX2, TX-T13, LT-T7 | blocked-to-start | Sonnet, wave 7, one worktree with LT-T10 |
| TX-T17 | Taxi T17 equivalence, formats, edits, layouts; `r-sources.js` takes a product | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T11, TX-T14, TX-T15, TX-T16, TX-H1, SE-T12 | blocked-to-start | Sonnet, wave 9 |
| TX-T18 | Taxi T18 the form-box proof on both routes | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T15, TX-T17, SE-T13 | blocked-to-start | Sonnet, wave 10 |
| TX-H1 | Merge the batch to main after TX-T6; generate-taxi refresh on main | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | human | TX-T6 | blocked-to-start | after R3 is green |
| LT-T1 | Ltd T1 writer profile: docx copy, twelve-month refusal, Ltd branch | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | SE-S3, LT-T3b | blocked-to-start | Opus, wave 4 |
| LT-T2 | Ltd T2 anchor table for thirteen workbooks; input-cell predicate | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | SE-S2, SE-T1, LT-T1, TX-T10 | blocked-to-start | Sonnet, wave 6 |
| LT-T3b | Ltd T3 tail: declaration swaps to `headlines.js`; `dividends` and second-line keys | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | SE-S5 | blocked-to-start | Sonnet, wave 3 |
| LT-T4d | Ltd T4 design: link-cache feed brief, first cut of `ltd-link-cells.json` | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | SE-S4d | blocked-to-start | Fable, wave 3, brief appended under T4 |
| LT-T4a | Ltd T4 calculator emits every link-addressed leaf cell; pinned list | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T4d | blocked-to-start | tier per brief, wave 4, needs no S4 code |
| LT-T4b | Ltd T4 `linkCacheReader`, cache-agreement test, stale-cache test | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T4a, SE-S4, LT-T1, LT-T2 | blocked-to-start | tier per brief, wave 7 |
| LT-T7 | Ltd T7 view manifest, ledger half; `ltd.html`, `ltd.css` | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | SE-S7 | blocked-to-start | Sonnet, wave 6 |
| LT-T8d | Ltd T8 design: forms half brief, `form-layouts/ltd.json` draft | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | in-flight | Opus, wave 3, `.worktrees/spreadsheets/ltd-t8-design` |
| LT-T8 | Ltd T8 forms: Accounts, Corporation tax, CT600, VAT, Payroll, Company | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T8d, LT-T7, SE-T8 | blocked-to-start | tier per brief, wave 8 |
| LT-T9 | Ltd T9 unrepresentable list and render coverage | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T7, LT-T8 | blocked-to-start | Haiku, wave 9 |
| LT-T10 | Ltd T10 example rows in `scripts/example-books.json`, bundle assets, deep links | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | SE-S8, LT-T7, SE-T8 | blocked-to-start | Sonnet, wave 7, one worktree with TX-T16 |
| LT-T11 | Ltd T11 equivalence suite; S3 from ltd-latest with the seven-month shift | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T1, LT-T2, LT-T4b, LT-T7, LT-T8, SE-T11, TX-T17 | blocked-to-start | Opus, wave 9 |
| LT-T12 | Ltd T12 formats suite: E3 on both year ends, E4, E5 | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T1, LT-T2, LT-T11 | blocked-to-start | Sonnet, wave 10 |
| LT-T13 | Ltd T13 edits and warnings suites | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T6b, LT-T7 | blocked-to-start | Sonnet, wave 8 |
| LT-T14 | Ltd T14 layouts and axe | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T7, LT-T8 | blocked-to-start | Sonnet, wave 9 |
| LT-T15 | Ltd T15 CLI and MCP harness; Ltd edits in the edit map | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | SE-S1, SE-S6, LT-T1, LT-T2, SE-T14 | blocked-to-start | Sonnet, wave 7 |
| LT-T17 | Ltd T17 behaviour probe | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T10, LT-T11, SE-T9 | blocked-to-start | Sonnet, wave 10 |
| LT-T18 | Ltd T18 register the Ltd specs in `playwright.config.js` | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T9, LT-T11, LT-T12, LT-T13, LT-T14, TX-T18 | blocked-to-start | Haiku, wave 11 |
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
