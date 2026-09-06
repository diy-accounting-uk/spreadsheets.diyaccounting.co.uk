# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

PR #63 and PR #64 merged to main on 2026-09-06; every product's packages, reports and
reconciliation pages are regenerated on main from the merged writers (Ltd last, at `c97b2c81`), and
prod deployed from that commit through deploy run 34038592549 with the judge on Nova passing all
four products under the actions role. The `test` re-run 34038603329 on the same commit fails one
browser case deterministically (row LT-T29, fix on `claude/ltd-a7-clean`). No worktree exists under
`../.worktrees/spreadsheets/`, and `main` is the only local branch besides that one. Sub-agents run
no LibreOffice and prove JS calculations against the committed packages' extraction
(`report.js --source-dir`). Every worktree lives at `../.worktrees/spreadsheets/<row>` on
`claude/wt-<row>` while its row is in flight, and the board names it. The generate workflows cancel
their own in-progress run on a push to their ref, so a session pushes nothing to a branch while a
generate run is in progress on it. A freeze is in effect from 2026-09-06: no push to origin and no
workflow dispatch until the operator lifts it; sessions work locally and propose fixes.
`PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue plan of record and carries its own open items.

## Freeze (operator, 2026-09-06, verbatim)

> We need to freeze now. Do not push to origin or run a github workflow until the freeze is
> lifted. You may work locally if you see a job fail but propose the fixes to me until the freeze
> is lifted.

Acknowledged in session: no pushes to origin and no workflow dispatches until the operator lifts
it; each fix is built and verified locally and pushed only on the operator's word. The memory
`freeze-no-push-no-workflow` carries the same rule.

## Context for the open rows

- **LT-T29** (SE-T29's remainder, the Ltd twin of SE-T37): `books-ltd-equivalence.browser.test.js`'s
  A7 true-upload case tolerated the period-skew marks the old `ltd-latest` carried and asserted
  there were some; the regenerated package carries none, so the case now asserts an empty drift
  set and the skew helpers are gone. Proved locally on the regenerated `ltd-latest` (three A7
  cases). The commit jobs push with the default `GITHUB_TOKEN`, which fires no workflow, so a
  package push never deploys on its own; prod deploys through `gh workflow run deploy.yml -f
  environment-name=prod` or the 07:17 UTC schedule.
- **CQ-4** (CodeQL 12, 19, 20 on main's scan after the merge): `web/unit-tests/smoke.test.js`
  lines 32 and 40 still trip js/path-injection although CQ-2 resolved the request path and checked
  it starts with the public directory; CodeQL wants a sanitiser it recognises, so serve from an
  allowlist built by walking the public directory once, or reject any path whose `path.normalize`
  result contains `..` before joining. `books/shell.js:1337` trips
  js/prototype-pollution-utility: the CQ-1 guard in `bookWithField` refuses `__proto__`,
  `constructor` and `prototype` segments, but the flagged site is a later recursive assignment
  (the property chain set while walking); apply the same segment check there or build the chain
  with `Object.create(null)` objects. Prove with the unit and shell specs; CodeQL re-scans on push.
- **SE-T32**: `app/lib/book-checks.js` `REPOST_PREFERRED` names `BasicSoleTrader` and
  `TaxiDriver` only; `settlementSuggestions`' repost helper for an SE purchase therefore falls to
  the chart's first account. Add the `SelfEmployed` entry from SE's chart (the account the
  purchase analysis would pick for a payment with no invoice; read `app/products/se.js`'s
  purchase code map) and prove it in `app/test/settlement-helpers.test.js` on the SE advanced book.
- **SE-T33**: the SE manifest's `cash` and `payroll` journals have no chart data, so the entries
  grid renders an empty chart; T7 assigned the fix to T14, which landed without it. Either
  `entriesGrid: false`/`chart: false` for those journals in `web/.../books/products/se.js` or a
  chart from the journal's own categories; prove in `web/browser-tests/books-se.browser.test.js`.
- **SE-T35**: `app/lib/product-workbook.js:40` `PRODUCT_BY_SCHEMA_NAME` is the inverse of
  `app/lib/xlsx-exporter.js` `SCHEMA_PRODUCT_NAMES`; keep one and derive the other, updating both
  callers, no alias.
- **SE-T36**: `app/bin/generate.js:348` runs `main().catch(...)` at module scope; guard it with the
  `import.meta.url` versus `process.argv[1]` check the other bins use, so tests can import its
  functions; prove by importing it in `app/test/generate.test.js`.
- **TX-T21**: T14's brief (Taxi plan, "Takings view") names `books-taxi-takings.browser.test.js`
  with cases T17 did not absorb: undo after a fare edit, the mobile-portrait week and day cards,
  and `changeLineDetail` committed through the page DOM. TX-T17's four specs cover the rest; build
  the file in their shape, expected figures through `web/browser-tests/r-sources.js`.
- **TX-T22**: T15's note says the view-level proofs land as `books-taxi-views.browser.test.js`
  once `taxi.html` exists; TX-T18 landed only the forms spec. Cases: the comparison panel (all five
  vehicle figures on every book after TX-T18), the vehicle register, the quarterly and forecast
  summaries, and drift survival across a re-render at the DOM level.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| CQ-4 | CodeQL still flags `web/unit-tests/smoke.test.js` lines 32 and 40 (path injection: the resolve-and-prefix guard is not one it recognises; read the request path from an allowlist) and `books/shell.js:1337` (a property chain assigned without a prototype guard) | none | machine | — | ready-to-start | Sonnet; alerts 12, 19, 20 on main's scan after PR #62 |
| SE-T32 | `REPOST_PREFERRED` in `app/lib/book-checks.js` has no `SelfEmployed` entry, so an SE purchase settlement reposts to the chart's first account rather than a sane default | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet |
| SE-T33 | The cash and payroll journals render an empty chart in the entries grid | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet |
| SE-T35 | `product-workbook.js`'s `PRODUCT_BY_SCHEMA_NAME` duplicates the inverse of `xlsx-exporter.js`'s `SCHEMA_PRODUCT_NAMES`; one map | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | ready-to-start | Haiku |
| SE-T36 | `app/bin/generate.js` calls `main()` on import with no CLI guard, so nothing can import it safely | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | ready-to-start | Haiku |
| TX-T21 | `books-taxi-takings.browser.test.js`: the takings-view cases T17 did not absorb (undo, the mobile-portrait week and day cards, `changeLineDetail` through the page) | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet |
| TX-T22 | `books-taxi-views.browser.test.js`: the comparison panel, vehicle register, quarterly and forecast summaries and the drift-survival case at the DOM level | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet |
| LT-T29 | The Ltd A7 true-upload case expected the period-skew drift the old `ltd-latest` carried; the regenerated package carries none | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | in-flight | `claude/ltd-a7-clean`: fix built and proved locally, awaiting the operator's push under the freeze |

## Plans not tracked here

- `PLAN_DIYA_GL_LAUNCH.md` carries its own open items (the Rust port plan and the operator's
  research). Its phase rows are not yet on the board.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
