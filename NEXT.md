# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

PR #68 merged to main on 2026-09-06 with the T37 batch: the entries grid's add row works on the
bank, cash and payroll journals for SE and Ltd, with the SE and Ltd proofs in the browser specs.
PR #67 landed earlier the same day with the b1 batch. Prod deploys from each merge. CodeQL runs
from `.github/workflows/codeql.yml` on `test.yml`'s trigger criteria. Sub-agents run no
LibreOffice and prove JS calculations against the committed packages' extraction
(`report.js --source-dir`). Every worktree lives at `../.worktrees/spreadsheets/<row>` on a
branch named `claude/<ns>-<topic>` while its row is in flight, and the board names it; a fresh
worktree needs `node scripts/build-books-bundle.mjs` before any books browser spec, and a rebuild
after merging engine changes. The generate workflows cancel their own in-progress run on a push
to their ref, so a session pushes nothing to a branch while a generate run is in progress on it.
`PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue plan of record and carries its own open items.

## Context for the open rows

The fifteen `LP` rows are the launch plan's phases 0 to 3 (`PLAN_DIYA_GL_LAUNCH.md`, section 7);
X1 and H6 stay in the plan. They pack into four workstreams by area of change, each a batch
branch `claude/b<n>-<topic>` with one worktree per row:

- **Workstream A, the engine and the package** (LP-1 to LP-4): `app/lib` and `app/bin`,
  `package.json`, `scripts/build-books-bundle.mjs`, the workflows. Sonnet throughout; LP-1 first,
  the rest in series on its output.
- **Workstream B, the web pages** (LP-5 to LP-9): `web/spreadsheets.diyaccounting.co.uk/public/`
  and `scripts/`. LP-6, LP-7 and LP-8 share no file and run at once; LP-5 waits on LP-1; LP-9 waits
  on G1. Sonnet, except the spec page on Opus.
- **Workstream C, distribution** (LP-10, LP-11): after the package. Haiku for the mechanical
  half; the launch posts are the operator's.
- **Workstream D, the cloud** (LP-15 to LP-18): the Submit repo's CDK and Lambdas
  (`../submit.diyaccounting.co.uk/infra/main/java/co/uk/diyaccounting/submit/stacks/`,
  `IdentityStack.java`, `ApiStack.java`, `BillingWebhookStack.java`) plus this repo's books
  pages. Two design waves on Opus (LP-16, LP-17), then Sonnet. Every AWS change goes through a
  Submit PR and its deploy workflow (H9), never a console write.

- **LP-1**: `book.toml` is written by `app/lib/books-interchange.js` and `report.json` by
  `app/lib/report-serializer.js`; the format version is already `diya-gl-books` 1 in the JSON
  envelope. Add `engineVersion` (package version and commit, injected at build by
  `scripts/build-books-bundle.mjs` and read from `package.json` in Node), `taxDataHash` (a hash
  over `app/data/*.toml`), `templateHash` per product (over `app/templates/<product>/*.xlsx`, with
  the scorecard figure from `reports/`), and `reconciledCommit` (the commit whose CI
  reconciliations passed, from the generate workflow). Byte identity across CLI, MCP and browser
  must hold, so the stamps are part of the canonical form: prove in `app/test` and in
  `books-equivalence` that all three surfaces write the same stamps.
- **LP-2**: `app/bin/build-reconciliation-pages.js` writes `public/reconciliation/<product>.html`
  from `reports/*.md`; add a `releases.html` beside them listing each tagged release with its five
  stamps and links to the scorecards, built in the same step and covered by the SEO unit test.
- **LP-3**: this repo's `package.json` is private; the publishable package is a second
  `package.json` (a `diya-gl/` directory or an npm workspace) whose `bin` map wraps
  `app/bin/report.js` (`recalc`), the extractors (`read-workbook`), `app/bin/export.js`
  (`write-workbook`) and `app/bin/diya-gl-mcp.js`; `_developers/PLAN_DIYA_CLOUD.md` section 3
  is the design for what it exposes. A `publish-diya-gl.yml` workflow publishes on a tag
  `diya-gl-v*` with `NPM_TOKEN` (H7) and provenance attestation. Prove with `npm pack` and a
  smoke run of each bin in CI.
- **LP-4**: a `test.yml` job (or the publish workflow's gate) runs the packed CLI over
  `examples/<product>-latest` for all four products and diffs the output against the committed
  `report.json` and `bookchecks.json`; any byte difference fails.
- **LP-5**: a `scripts/build-runner.mjs` that inlines the engine bundle, the two schemas under
  `public/schema/`, the tax TOMLs and the product's `app/templates/<product>/*.xlsx` (base64)
  into one `diya-gl-<product>.html`, stamped with LP-1's values, written to `target/runners/` and
  uploaded by `deploy.yml` beside the zips; `download.html` gains the link. Prove by opening the
  file from disk in Playwright and loading an example book.
- **LP-6**: `public/books/manifest.webmanifest`, `public/books/sw.js` caching the shell, engine,
  schemas, CSS and `examples.js`, the link and registration tags in the four books pages, and
  the response-headers policy (the CSP the BST plan's T2 centralised; find its source by grepping
  for `Content-Security-Policy` in `infra/` and `scripts/`) allowing the worker. Prove with a
  Playwright case that loads a page, goes offline and loads it again.
- **LP-7**: in `books/shell.js`, a prompt after the save toast and one when the year view first
  renders figures, each shown once per browser (`localStorage`), dismissable, linking the
  `buy.stripe.com` links `donate.html` already carries; styling in `books/books.css`; one browser
  spec `books-donation.browser.test.js`.
- **LP-8**: a `public/diya-gl.html` (the spec page) generated or hand-written: the field table
  from the two schemas' descriptions (both cite XBRL GL 2015), the SA103S box table from
  `app/data/hmrc/sa103-mtd-mapping.json`, the check catalogue from `app/lib/book-checks.js` and
  the engine checks, the zip layout, the version, and links to the reconciliation pages; added to
  `app/bin/build-sitemaps.js` and the SEO test. Opus because the declared-subset wording is a
  judgment the launch plan's section 1 constrains.
- **LP-9**: `public/lib/analytics.js` and `ecommerce-events.js` carry the GA4 senders; add events
  from `books/shell.js` (book loaded with its product and source kind, save with its format,
  prompt shown and prompt followed) and from `download.html` for the runner; unit-test the event
  builders under `web/unit-tests/`. G1 fixes the purchase event's value first, so this row waits
  on it and shares its builder.
- **LP-11**: a root `Dockerfile` (`node:alpine`, `npm i -g @diy-accounting-uk/diya-gl`,
  entrypoint `diya-gl`) built and pushed to GHCR by `publish-diya-gl.yml`; a
  `Formula/diya-gl.rb` in the tap repo (H8) pointing at the npm tarball.
- **LP-15**: in the Submit repo's `IdentityStack.java`, a second `UserPoolClient` on the shared
  pool with the Google identity provider, callback `https://spreadsheets.diyaccounting.co.uk/books/`
  (and the ci host), sign-out URL the same, PKCE, no secret; the client id as a stack output and
  an SSM parameter the spreadsheets deploy can read; its Java test; lands by Submit PR (H9).
- **LP-16**: design wave first (Opus): the S3 key layout `users/<sub>/books/<bookId>/<version>.zip`
  with `metadata.json` per book (`_developers/PLAN_DIYA_CLOUD.md` sections 2.3, 2.4 and 4), the
  four Lambda handlers, the API Gateway routes under the existing `ApiStack` with the pool's
  authoriser, the ETag-based optimistic concurrency, and the entitlement hook LP-18 fills. Then
  Sonnet builds it with unit tests per handler and a behaviour probe against submit-ci.
- **LP-17**: design wave (Opus) for the page's cloud state: hosted-UI redirect with PKCE, the
  token in `sessionStorage`, a "My books" panel listing versions, put on save and get on open,
  a conflict card when the ETag mismatches. Then Sonnet in `books/shell.js` and a new
  `books/cloud.js`, the CSP `connect-src` for the API host, a browser spec with the API stubbed
  through Playwright routes, and a behaviour case against ci once LP-16 is deployed.
- **LP-18**: the Submit repo's `BillingWebhookStack` already receives Stripe events; record the
  99p subscription against the Cognito subject carried as `client_reference_id`, expose the
  entitlement to LP-16's put route, and add the subscribe button and the portal link to the
  books pages' account panel. H10 supplies the link.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| G1 | GA4 `purchase` from `download.html?stripe=success` carries no money: the £45 Company package sale of 2026-09-03 09:38 UTC (Stripe pi_3UBX5pCD0Ld2ukzI0ASK1VDj) reached the BigQuery export as `purchase`, item "Company", revenue 0. Send `value` and `currency` (and the item price) from the Stripe session or price the page already knows, so GA4 reports income; unit-test the event builder. The submit repo's checkout page does this from `amountTotal / 100` and `currency` of the checkout session. | submit session, 2026-09-07 (GA4 export query) | machine | — | ready-to-start | Sonnet, the analytics agent |
| LP-1 | The five provenance stamps in `book.toml`'s document info and `report.json`'s header: engine version and commit, tax-data hash, template hash and scorecard, reconciled commit (the format version exists) | PLAN_DIYA_GL_LAUNCH.md | machine | — | ready-to-start | Sonnet, the stamps agent; workstream A |
| LP-2 | The reconciled-releases page: one row per release with the five stamps, linking the per-product reconciliation scorecards | PLAN_DIYA_GL_LAUNCH.md | machine | LP-1 | blocked-to-start | Sonnet, the releases-page agent; workstream A |
| LP-3 | The npm package `@diy-accounting-uk/diya-gl`: `recalc`, `read-workbook`, `write-workbook` and the MCP server as `bin` entries, built from the engine and published from a reconciled tag | PLAN_DIYA_GL_LAUNCH.md | machine | LP-1, H7 | blocked-to-start | Sonnet, the package agent; workstream A |
| LP-4 | The parity gate in CI: `npx diya-gl recalc` reproduces the committed examples' `report.json` and `bookchecks.json` byte for byte on every product's fixtures | PLAN_DIYA_GL_LAUNCH.md | machine | LP-3 | blocked-to-start | Sonnet, the parity agent; workstream A |
| H7 | Add an npm publish token for the `diy-accounting-uk` org as the `NPM_TOKEN` repository secret | none | human | — | ready-to-start | Settings, Secrets and variables, Actions |
| LP-5 | The single-file HTML runner per product: engine, schemas, tax data and the product's templates inlined into one stamped page, uploaded beside the zips and linked from `download.html` | PLAN_DIYA_GL_LAUNCH.md | machine | LP-1 | blocked-to-start | Sonnet, the runner agent; workstream B |
| LP-6 | The PWA: a web manifest and a service worker caching the books pages, engine, schemas and examples for offline use, installable from the live page | PLAN_DIYA_GL_LAUNCH.md | machine | — | ready-to-start | Sonnet, the pwa agent; workstream B |
| LP-7 | Two donation prompts on the books pages, each once and dismissable: after a successful save and when a year's figures first appear, pointing at the Stripe links | PLAN_DIYA_GL_LAUNCH.md | machine | — | ready-to-start | Sonnet, the prompts agent; workstream B |
| LP-8 | The format spec page: the declared subset, every field's XBRL GL 2015 element, every computed figure's SA103S box, the check catalogue, the zip layout, the version, and the reconciliation evidence | PLAN_DIYA_GL_LAUNCH.md | machine | — | ready-to-start | Opus, the spec-page agent; workstream B |
| LP-9 | Phase 1 measurement: GA4 events for a book loaded, a save, a runner download, a donation prompt shown and followed; the downloads-to-donations ratio readable from the export | PLAN_DIYA_GL_LAUNCH.md | machine | G1 | blocked-to-start | Sonnet, the analytics agent; workstream B |
| LP-10 | The Show HN post and the AccountingWEB piece: 15 KB for a year of accounts, recalculates without Excel, byte-identical across CLI, MCP and browser | none | human | LP-3, LP-8 | blocked-to-start | the operator writes and posts |
| LP-11 | Docker image (`node:alpine` plus the package, pushed to GHCR from the publish workflow) and the Homebrew formula in the tap | PLAN_DIYA_GL_LAUNCH.md | machine | LP-3, H8 | blocked-to-start | Haiku, the distribution agent; workstream C |
| H8 | Create the `diy-accounting-uk/homebrew-tap` repository for the formula | none | human | — | ready-to-start | an empty public repo; the formula lands by PR |
| LP-15 | In the Submit repo: a second app client on the shared Cognito pool with Google federation, callback and sign-out URLs on `spreadsheets.diyaccounting.co.uk/books/`, the client id published as a stack output | PLAN_DIYA_GL_LAUNCH.md | machine | — | ready-to-start | Sonnet, the app-client agent; workstream D, Submit repo |
| LP-16 | In the Submit repo: the storage API in submit-prod: an S3 bucket keyed per user and book, four routes (list, get version, put version, delete) behind the pool's authoriser, a metadata sidecar for optimistic concurrency | PLAN_DIYA_GL_LAUNCH.md | machine | — | ready-to-start | Opus design wave, then Sonnet, the storage-api agent; workstream D, Submit repo |
| LP-17 | Sign-in and "save to my account" on the books pages: hosted-UI redirect, token held in session, the book list, put and get through the storage API, conflict shown not merged; the same page on mobile | PLAN_DIYA_GL_LAUNCH.md | machine | LP-15, LP-16, H9 | blocked-to-start | Opus design wave, then Sonnet, the cloud-page agent; workstream D |
| LP-18 | Billing: the subscribe button carries the Cognito subject to the 99p Payment Link; Submit's billing webhook records the subscription; the storage API's put route checks the entitlement; the customer portal link | PLAN_DIYA_GL_LAUNCH.md | machine | LP-16, H10 | blocked-to-start | Sonnet, the billing agent; workstream D, both repos |
| H9 | Merge the Submit repo PRs for LP-15, LP-16 and LP-18 and let its deploy workflow apply them to submit-prod | none | human | LP-15, LP-16 | blocked-to-start | the CDK path is the AWS write; no console step |
| H10 | Create the 99p a month Stripe Payment Link (one price, monthly) and enable the customer portal | none | human | — | ready-to-start | Stripe dashboard; paste the link id into the LP-18 brief |

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
