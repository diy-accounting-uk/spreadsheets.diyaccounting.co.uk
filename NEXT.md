# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Wave 1 of the launch plan runs as seven worktree agents on batch branch `claude/b3-launch`
(this repo) and per-row Submit PRs. Worktrees: `../.worktrees/spreadsheets/<row>` for G1,
LP-1, LP-6, LP-7 and LP-8; `../.worktrees/submit/<row>` for LP-15 and LP-16, which never touch
the Submit checkout's main tree (another session works there). Each row's Status names its
branch. Sub-agents run no LibreOffice and prove JS calculations against the committed packages'
extraction (`report.js --source-dir`). A fresh worktree needs `node scripts/build-books-bundle.mjs`
before any books browser spec, and a rebuild after merging engine changes. The generate workflows
cancel their own in-progress run on a push to their ref, so a session pushes nothing to a branch
while a generate run is in progress on it. `PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue
plan of record and carries its own open items.

## Context for the open rows

The `LP` and `H7` to `H10` rows are `PLAN_DIYA_GL_LAUNCH.md`'s task list, same ids; each row's
brief lives there under "Briefs". LP-12 to LP-14 (the Rust port) and LP-19, LP-20 (Filing) stay
in the plan until their phase opens. They pack into four workstreams by area of change, each a batch
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


## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| G1 | GA4 `purchase` from `download.html?stripe=success` carries no money: the £45 Company package sale of 2026-09-03 09:38 UTC (Stripe pi_3UBX5pCD0Ld2ukzI0ASK1VDj) reached the BigQuery export as `purchase`, item "Company", revenue 0. Send `value` and `currency` (and the item price) from the Stripe session or price the page already knows, so GA4 reports income; unit-test the event builder. The submit repo's checkout page does this from `amountTotal / 100` and `currency` of the checkout session. | submit session, 2026-09-07 (GA4 export query) | machine | — | in-flight | Sonnet, the analytics agent; `claude/ga4-purchase-value`, worktree g1  |
| LP-1 | The five provenance stamps in `book.toml`'s document info and `report.json`'s header: engine version and commit, tax-data hash, template hash and scorecard, reconciled commit (the format version exists) | PLAN_DIYA_GL_LAUNCH.md | machine | — | in-flight | Sonnet, the stamps agent; `claude/lp-1-stamps`, worktree lp-1  |
| LP-2 | The reconciled-releases page: one row per release with the five stamps, linking the per-product reconciliation scorecards | PLAN_DIYA_GL_LAUNCH.md | machine | LP-1 | blocked-to-start | Sonnet, the releases-page agent; workstream A |
| LP-3 | The npm package `@diy-accounting-uk/diya-gl`: `recalc`, `read-workbook`, `write-workbook` and the MCP server as `bin` entries, built from the engine and published from a reconciled tag | PLAN_DIYA_GL_LAUNCH.md | machine | LP-1, H7 | blocked-to-start | Sonnet, the package agent; workstream A |
| LP-4 | The parity gate in CI: `npx diya-gl recalc` reproduces the committed examples' `report.json` and `bookchecks.json` byte for byte on every product's fixtures | PLAN_DIYA_GL_LAUNCH.md | machine | LP-3 | blocked-to-start | Sonnet, the parity agent; workstream A |
| H7 | Add an npm publish token for the `diy-accounting-uk` org as the `NPM_TOKEN` repository secret | none | human | — | ready-to-start | Settings, Secrets and variables, Actions |
| LP-5 | The single-file HTML runner per product: engine, schemas, tax data and the product's templates inlined into one stamped page, uploaded beside the zips and linked from `download.html` | PLAN_DIYA_GL_LAUNCH.md | machine | LP-1 | blocked-to-start | Sonnet, the runner agent; workstream B |
| LP-6 | The PWA: a web manifest and a service worker caching the books pages, engine, schemas and examples for offline use, installable from the live page | PLAN_DIYA_GL_LAUNCH.md | machine | — | in-flight | Sonnet, the pwa agent; `claude/lp-6-pwa`, worktree lp-6  |
| LP-7 | Two donation prompts on the books pages, each once and dismissable: after a successful save and when a year's figures first appear, pointing at the Stripe links | PLAN_DIYA_GL_LAUNCH.md | machine | — | in-flight | Sonnet, the prompts agent; `claude/lp-7-prompts`, worktree lp-7  |
| LP-8 | The format spec page: the declared subset, every field's XBRL GL 2015 element, every computed figure's SA103S box, the check catalogue, the zip layout, the version, and the reconciliation evidence | PLAN_DIYA_GL_LAUNCH.md | machine | — | in-flight | Opus, the spec-page agent; `claude/lp-8-spec`, worktree lp-8  |
| LP-9 | Phase 1 measurement: GA4 events for a book loaded, a save, a runner download, a donation prompt shown and followed; the downloads-to-donations ratio readable from the export | PLAN_DIYA_GL_LAUNCH.md | machine | G1 | blocked-to-start | Sonnet, the analytics agent; workstream B |
| LP-10 | The Show HN post and the AccountingWEB piece: 15 KB for a year of accounts, recalculates without Excel, byte-identical across CLI, MCP and browser | none | human | LP-3, LP-8 | blocked-to-start | the operator writes and posts |
| LP-11 | Docker image (`node:alpine` plus the package, pushed to GHCR from the publish workflow) and the Homebrew formula in the tap | PLAN_DIYA_GL_LAUNCH.md | machine | LP-3, H8 | blocked-to-start | Haiku, the distribution agent; workstream C |
| H8 | Create the `diy-accounting-uk/homebrew-tap` repository for the formula | none | human | — | ready-to-start | an empty public repo; the formula lands by PR |
| LP-15 | In the Submit repo: a second app client on the shared Cognito pool with Google federation, callback and sign-out URLs on `spreadsheets.diyaccounting.co.uk/books/`, the client id published as a stack output | PLAN_DIYA_GL_LAUNCH.md | machine | — | in-flight | Sonnet, the app-client agent; Submit `claude/books-app-client`, worktree lp-15  |
| LP-16 | In the Submit repo: the storage API in submit-prod: an S3 bucket keyed per user and book, four routes (list, get version, put version, delete) behind the pool's authoriser, a metadata sidecar for optimistic concurrency | PLAN_DIYA_GL_LAUNCH.md | machine | — | in-flight | Opus design wave writing `PLAN_DIYA_GL_STORAGE.md`; Submit `claude/books-storage-api`, worktree lp-16  |
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
