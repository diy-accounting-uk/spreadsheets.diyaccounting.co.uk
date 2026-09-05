# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Batch `claude/diya-gl-wave-2` (from main `4d0241d9`) works the board top to bottom: the paused
worktrees first, then each product's block. Every worktree lives at
`../.worktrees/spreadsheets/<row>` on `claude/wt-<row>` with a `node_modules` symlink; the
coordinator merges each landed commit into the batch branch, runs the row's non-LibreOffice tests,
and pushes; `NEXT.md` tracking commits ride on the batch branch. Sub-agents run no LibreOffice and
prove JS calculations against the committed packages' extraction (`report.js --source-dir`). The
wave schedule is in `_developers/WAVES_DIYA_GL_PRODUCTS.md`. `PLAN_DIYA_GL_LAUNCH.md` is the launch
and revenue plan of record and carries its own open items.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| SE-T19 | The SE page accepts the nine-file package: `upload.validate`, `extractLines`, `drift.js` units for element rows; A7 drift and stale-cache proofs | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/se-t19` on `claude/wt-se-t19`; Sonnet merges the batch and reruns its tests |
| BST-T17 | `form-layouts/bst.json` replaces `products/bst.js` `SA103S_BOXES`; the BST SA103S renders through `helpers.form`; `CONTEXT_BASIC_SOLE_TRADER.md` SA103S tables and the `D106` comments verified against the sheet | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/bst-t17` on `claude/wt-bst-t17`; Sonnet merges the batch and reruns its tests |
| SE-T17 | `diya-gl-loader` gives SE a depreciation table; `extract-scenarios` keeps `total_motor_net` pence; `fmtMoney` rounds as the canonical value does; `Payment!B4:C15` carry a date unit | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T23 | blocked-to-resume | `../.worktrees/spreadsheets/se-t17` on `claude/wt-se-t17` at `8a0cbbd2`; its A4 shows the `fmt()` rounding |
| TX-T24 | BST and Taxi `SE Short` gate the expense boxes on `Admin!F26`, not `30000`; `calculators/bst.js:293` follows; the L111 and L116 tick captions take the 2026 text | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T25 | blocked-to-resume | `../.worktrees/spreadsheets/taxi-t24` on `claude/wt-taxi-t24` at `8aa340f0`; 14 Node tests read the committed packages |
| UI-1 | The books pages drop the back link to the xlsx download page; a `New` button beside `Save`, equal in prominence on desktop and the mobile bar, returns to the upload-or-example screen | operator | machine | — | in-flight | `../.worktrees/spreadsheets/ui-1` on `claude/wt-ui-1`; Opus designs and builds |
| CQ-2 | CodeQL's twelve remaining alerts: path injection in `web/unit-tests/smoke.test.js`; double escaping and multi-character sanitization in `scripts/generate-knowledge-base-toml.cjs`, `app/test/home-sheet-hyperlinks.test.js` and `public/lib/community-page.js`; URL and hostname checks in `scripts/generate-aws-resources.js`, `behaviour-tests/helpers/playwrightTestWithout.js` and `web/unit-tests/seo-validation.test.js` | none | machine | — | in-flight | `../.worktrees/spreadsheets/cq-2` on `claude/wt-cq-2`; Sonnet |
| TX-T25 | The BST and Taxi sidecar, interchange and roundtrip tests build their package from the template, as the SE ones do, so a template change no longer reads the committed packages as overtyped | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/tx-t25` on `claude/wt-tx-t25`; Sonnet |
| BST-T18 | `products/bst.js` `CELL_MAP` labels for `D99` and `D106` carry the box-28 and box-31 confusion; the judge and nine golden reports key off the label strings | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/bst-t18` on `claude/wt-bst-t18`; Sonnet |
| BST-T19 | The BST page renders the profit bridge (nine `section/accounting-profit-to-tax-profit-bridge/` keys declared today) and an `Admin!N17` row | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | TX-T24 | blocked-to-start | Sonnet |
| LT-T7 | Ltd T7 view manifest, ledger half; `ltd.html`, `ltd.css` | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet, wave 6 |
| TX-T16 | Taxi T16 example books, `taxi.html`, download panel, behaviour probe | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | LT-T7 | blocked-to-start | Sonnet, wave 7, one worktree with LT-T10 |
| SE-T21 | The SE VAT view carries the interface table under a disclosure (T7's spec); `renderBalances` keys every month's opening balance and `renderVatQuarter` keys `G5`; the declared list in `render-unrepresentable/se.json` shrinks from 958 to the true unrepresentables | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/se-t21` on `claude/wt-se-t21`; Opus |
| SE-T22 | `se-2026-2027.toml` Class 2 figures (6845 threshold, 3.50 weekly) verified against HMRC 2026/27 through the package-updates skill | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/se-t22` on `claude/wt-se-t22`; Sonnet |
| SE-T23 | `products/{se,bst,taxi,ltd}.js` `fmt()` formats section values through `canonicalForUnit`; the generated reports re-pin at the refresh | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/se-t23` on `claude/wt-se-t23`; Sonnet |
| SE-T27 | `products/se.js` `checkCompliance` shows four spurious mismatches on a book with no `[expected]` table that nets to a loss | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | `../.worktrees/spreadsheets/se-t27` on `claude/wt-se-t27`; Sonnet |
| SE-T9 | T9 SE examples, deep links, download panel, behaviour probe | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | TX-T16 | blocked-to-start | Sonnet, wave 8 |
| SE-T24 | Extracted entry numbers are unique across an uploaded package: `xlsx-exporter.js` numbers each journal from `EXP-0001`, so sales, bank and payroll rows collide and cannot be edited | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T19 | blocked-to-start | Opus; moves every multi-file `lines.jsonl` |
| SE-T25 | `drift.js` emits two entries with one id when a link cell drifts and the hub cell also reads short | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T19 | blocked-to-start | Haiku |
| SE-T26 | `scenario-extractor.js:824` throws on a bank line whose side is neither D nor C before the book checks run, so `book-bank-line-has-side` never surfaces; `edits.js` `changeAmount` moves no payroll gross because the loader reads `diya-gl:grossPay` first | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T12 | in-flight | `../.worktrees/spreadsheets/se-t26` on `claude/wt-se-t26`; Sonnet |
| SE-T13 | T13 SE UX pass at four viewports, axe, keyboard | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T12, UI-1, SE-T21 | blocked-to-start | Fable; after UI-1 and SE-T21 change the SE page |
| SE-T20 | Straddling VAT entries reach the diya-gl books: the extractor keeps `vatPeriodEnd` lines, the loader splits them back out; `reportAmount` rounds in two steps; the generate-se scorecard comment says what the code does | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | SE-T17 | blocked-to-start | Opus; rewrites every product's example books, so after SE-T17's regeneration |
| SE-H1 | Merge the next batch to main; four `generate-*` on the branch first; generate-se refresh | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | human | SE-T9, SE-T12, SE-T13, SE-T17, SE-T19, SE-T20, SE-T21 | blocked-to-start | after the next batch |
| TX-T17 | Taxi T17 equivalence, formats, edits, layouts; `r-sources.js` takes a product | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T16, SE-T12 | blocked-to-start | Sonnet, wave 9 |
| TX-T18 | Taxi T18 the form-box proof on both routes | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | TX-T17, SE-T13 | blocked-to-start | Sonnet, wave 10 |
| LT-T2 | Ltd T2 anchor table for thirteen workbooks; input-cell predicate | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet, wave 6; Ltd held by the operator |
| LT-T6b | Ltd T6 settlement helpers proved on Ltd books | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet, wave 7 |
| LT-T23 | Ltd T23 the Ltd rule ids take the shared `book-` prefix (`ltd-*` becomes `book-ltd-*`), so all three products name rules one way before the pages hard-code them | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | ready-to-start | Haiku, before SE-T7 and TX-T13 |
| LT-T25 | Ltd T25 the cash top-up's counter leg: the sole-trader adaptation in `extract-scenarios.js` maps Ltd transfer codes to SE's before the leg lands in the master; the VAT settlement twins and `vatBroughtForward` get their own entry numbers | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet, wave 5; touches `se-vat` and `ltd-vat` |
| LT-T4b | Ltd T4 `linkCacheReader`, cache-agreement test, stale-cache test | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | LT-T2 | blocked-to-start | Opus, wave 7 |
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
