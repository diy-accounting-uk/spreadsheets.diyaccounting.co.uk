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
A freeze is in effect from 2026-09-06: no push to origin and no workflow dispatch until the operator
lifts it; sessions work locally and propose fixes. `PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue
plan of record and carries its own open items.

## Freeze (operator, 2026-09-06, verbatim)

> We need to freeze now. Do not push to origin or run a github workflow until the freeze is
> lifted. You may work locally if you see a job fail but propose the fixes to me until the freeze
> is lifted.

Acknowledged in session: no pushes to origin and no workflow dispatches until the operator lifts
it; the operator's `generate-all.yml` run 34026795912 on main is watched read-only; any failure is
diagnosed locally and the fix proposed, not landed. Local `main`'s docs-only commits (the plan
audits, the board updates, the freeze note) push after the lift, rebased onto the run's package
commits. Prod was already deployed from
`d235d704` (the PR #62 merge). The memory `freeze-no-push-no-workflow` carries the same rule.

## Context for the open rows

- **M1** (operator): `generate-all.yml` run 34026795912 committed BST, Taxi and SE to main; Ltd's
  reconcile passed but its unit step failed on the pinned October year end, fixed in PR #63, and
  the operator dispatched `generate-ltd` again as run 34032585902. The commit jobs push with the
  default `GITHUB_TOKEN`, which fires no workflow, so `deploy.yml` never follows a package push.
  The scheduled deploy run 34030850798 then failed at its judge gate: the SE verdict fails on the
  brickwork-pro non-VAT book's negative Total Tax + NI (SE-T34), and every product's Sonnet call
  403s and escalates to Opus (H1). Prod serves `d235d704`'s packages until a deploy passes the
  judge: after SE-T34 lands, `gh workflow run deploy.yml -f environment-name=prod`. If a generate
  product fails at the reconcile job's "Unit tests against the fresh packages and example" step,
  the test names in the log say which product's file. If the reconciliation itself reports
  ANOMALYDETECTED, the failing checks are only in the report file the job writes: reproduce with
  `node app/bin/report.js --package <p> --data <book> --years <year file> --year-end <date>
  --output-dir <scratch>` (no LibreOffice) and read the compliance section.
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
- **SE-T34**: `claude/se-cis-indicator` (local until pushed) makes `incomeTaxLine` state the CIS
  the contractors deducted and the bottom line it leaves; proved in `judge-reconciliation.test.js`
  on the committed brickwork-pro non-VAT report. The judge re-reads the indicators on the next
  deploy run; no report regenerates.
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
| SE-T34 | The reconciliation judge has no indicator for CIS suffered, so a negative Total Tax + NI on a CIS-heavy SE book reads as an unexplained query; the scheduled deploy's judge gate fails SE on it | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | `claude/se-cis-indicator`: fix built, awaiting the operator's push under the freeze |
| SE-T35 | `product-workbook.js`'s `PRODUCT_BY_SCHEMA_NAME` duplicates the inverse of `xlsx-exporter.js`'s `SCHEMA_PRODUCT_NAMES`; one map | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | ready-to-start | Haiku |
| SE-T36 | `app/bin/generate.js` calls `main()` on import with no CLI guard, so nothing can import it safely | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | ready-to-start | Haiku |
| TX-T21 | `books-taxi-takings.browser.test.js`: the takings-view cases T17 did not absorb (undo, the mobile-portrait week and day cards, `changeLineDetail` through the page) | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet |
| TX-T22 | `books-taxi-views.browser.test.js`: the comparison panel, vehicle register, quarterly and forecast summaries and the drift-survival case at the DOM level | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet |
| M1 | The four `generate-*` on main with commit (`generate-all.yml`), then `deploy.yml`, so the committed packages, reports and reconciliation pages match the merged writers | operator | human | SE-T34 | in-flight | `generate-ltd` run 34032585902 after PR #63; deploy waits on the judge passing SE |
| H1 | Accept the Bedrock model agreement for `anthropic.claude-sonnet-5` in the spreadsheets account, us-east-1 (or let the actions role subscribe): every judge call to Sonnet returns 403 on `aws-marketplace:Subscribe` and escalates straight to Opus | none | human | — | ready-to-start | seen on every product in deploy run 34030850798 and the generate runs |

## Plans not tracked here

- `PLAN_DIYA_GL_LAUNCH.md` carries its own open items (the Rust port plan and the operator's
  research). Its phase rows are not yet on the board.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
