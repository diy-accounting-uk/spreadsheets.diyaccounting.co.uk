# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

PR #63, #64 and #65 merged to main on 2026-09-06; every product's packages, reports and
reconciliation pages are regenerated on main from the merged writers, prod deployed from the Ltd
package commit `c97b2c81` through deploy run 34038592549 with the judge on Nova passing all four
products under the actions role, and `test` is green on main at `39f27536`. Batch `claude/b1-board` (worktree `batch`) collects the board rows below as each verifies; its
draft PR is #67. Sub-agents run no LibreOffice and prove JS calculations
against the committed packages' extraction (`report.js --source-dir`). Every worktree lives at
`../.worktrees/spreadsheets/<row>` on a branch named `claude/<ns>-<topic>` (`CLAUDE.md`'s
convention, the distinctive part right after `claude/`) while its row is in flight, and the board
names it. The generate workflows cancel their own in-progress run on a push
to their ref, so a session pushes nothing to a branch while a generate run is in progress on it.
`PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue plan of record and carries its own open items.

## Context for the open rows

- **CQ-4** (CodeQL 12, 19, 20 on main's scan after the merge): `web/unit-tests/smoke.test.js`
  lines 32 and 40 still trip js/path-injection although CQ-2 resolved the request path and checked
  it starts with the public directory; CodeQL wants a sanitiser it recognises, so serve from an
  allowlist built by walking the public directory once, or reject any path whose `path.normalize`
  result contains `..` before joining. `books/shell.js:1337` trips
  js/prototype-pollution-utility: the CQ-1 guard in `bookWithField` refuses `__proto__`,
  `constructor` and `prototype` segments, but the flagged site is a later recursive assignment
  (the property chain set while walking); apply the same segment check there or build the chain
  with `Object.create(null)` objects. Prove with the unit and shell specs; CodeQL re-scans on push.
- **SE-T37**: `web/.../books/edits.js:195` `addEntry` sends every journal but `sales` through
  `addPurchaseLine`, which refuses bank, cash and payroll lines on the `sourceJournalID` guard in
  `app/lib/diya-gl-edits.js`. The add row needs a direction and bank account for bank and cash
  lines and payslip fields for payroll, then a per-journal edit call; the plan's T37 row names the
  files. Design first: the add-row fields are a UI decision.
- **SE-T35**: `app/lib/product-workbook.js:40` `PRODUCT_BY_SCHEMA_NAME` is the inverse of
  `app/lib/xlsx-exporter.js` `SCHEMA_PRODUCT_NAMES`; keep one and derive the other, updating both
  callers, no alias.
- **SE-T36**: `app/bin/generate.js:348` runs `main().catch(...)` at module scope; guard it with the
  `import.meta.url` versus `process.argv[1]` check the other bins use, so tests can import its
  functions; prove by importing it in `app/test/generate.test.js`.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| CQ-4 | CodeQL still flags `web/unit-tests/smoke.test.js` lines 32 and 40 (path injection: the resolve-and-prefix guard is not one it recognises; read the request path from an allowlist) and `books/shell.js:1337` (a property chain assigned without a prototype guard) | none | machine | — | in-flight | code complete in batch PR #67 (`f1ab329a`, `cdd1deb3`); CodeQL scans the batch under `codeql.yml` |
| WB-1 | The books pages' save menu offers only diya-gl (.zip) and JSON; `download.html` loses its own "Download without donating" link, leaving `donate.html`'s bail-out as the only skip; page titles read "DIYA-GL — <Product>" and "Books" stops standing in for the product name anywhere on the site | operator | machine | — | in-flight | Sonnet; worktree save-formats, `claude/ops-save-formats`, lands in batch PR #67 |
| H3 | Merge batch PR #67; all eight rows are code complete | none | human | — | ready-to-start | checks green on `cf5ef7c6`; CodeQL zero on the branch |
| SE-T32 | `REPOST_PREFERRED` in `app/lib/book-checks.js` has no `SelfEmployed` entry, so an SE purchase settlement reposts to the chart's first account rather than a sane default | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | code complete in batch PR #67 (`ea79aed8`); 21 cases pass |
| SE-T33 | The cash and payroll journals render an empty chart in the entries grid | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | code complete in batch PR #67 (`17b39c58`); 13 cases pass |
| SE-T35 | `product-workbook.js`'s `PRODUCT_BY_SCHEMA_NAME` duplicates the inverse of `xlsx-exporter.js`'s `SCHEMA_PRODUCT_NAMES`; one map | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | code complete in batch PR #67 (`b7d2aea1`) |
| SE-T36 | `app/bin/generate.js` calls `main()` on import with no CLI guard, so nothing can import it safely | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | code complete in batch PR #67 (`3e762a5a`) |
| SE-T37 | The entries grid's Add button throws for bank, cash and payroll lines: `addEntry` routes every journal but sales through `addPurchaseLine` | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | H3 | blocked-to-start | Opus design of the add-row fields, then Sonnet |
| TX-T21 | `books-taxi-takings.browser.test.js`: the takings-view cases T17 did not absorb (undo, the mobile-portrait week and day cards, `changeLineDetail` through the page) | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | in-flight | code complete in batch PR #67 (`471d3e99`); 3 cases pass |
| TX-T22 | `books-taxi-views.browser.test.js`: the comparison panel, vehicle register, quarterly and forecast summaries and the drift-survival case at the DOM level | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | in-flight | code complete in batch PR #67 (`0870de04`); 18 cases pass |

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
