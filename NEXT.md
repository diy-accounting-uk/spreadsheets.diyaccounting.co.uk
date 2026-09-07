# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Wave 1 landed with PR #69 on 2026-09-07; prod deploys from it. Wave 2 is batch branch
`claude/b4-launch` (draft PR #70) carrying LP-3 and LP-17, worktree `../.worktrees/spreadsheets/b4-launch`.
Submit PR #149 (LP-15) merged; LP-16 is on Submit PR #150 for H9. Sub-agents run no
LibreOffice and prove JS calculations against the committed packages' extraction
(`report.js --source-dir`). Every worktree lives at `../.worktrees/spreadsheets/<row>` on a
branch named `claude/<ns>-<topic>` while its row is in flight, and the board names it; a fresh
worktree needs `node scripts/build-books-bundle.mjs` before any books browser spec, and a rebuild
after merging engine changes. The generate workflows cancel their own in-progress run on a push
to their ref, so a session pushes nothing to a branch while a generate run is in progress on it.
`PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue plan of record and carries its own open items.

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
| LP-3 | The npm package `@diy-accounting-uk/diya-gl`: `recalc`, `read-workbook`, `write-workbook` and the MCP server as `bin` entries, built from the engine and published from a reconciled tag | PLAN_DIYA_GL_LAUNCH.md | machine | LP-1 | in-flight | code complete, merged to `claude/b4-launch` (PR #70); waits on H13; the first publish needs H7  |
| LP-4 | The parity gate in CI: `npx diya-gl recalc` reproduces the committed examples' `report.json` and `bookchecks.json` byte for byte on every product's fixtures | PLAN_DIYA_GL_LAUNCH.md | machine | LP-3, H13 | blocked-to-start | Sonnet, the parity agent; workstream A  |
| H7 | Add an npm publish token for the `diy-accounting-uk` org as the `NPM_TOKEN` repository secret | none | human | — | ready-to-start | Settings, Secrets and variables, Actions |
| LP-10 | The Show HN post and the AccountingWEB piece: 15 KB for a year of accounts, recalculates without Excel, byte-identical across CLI, MCP and browser | none | human | LP-3, LP-8 | blocked-to-start | the operator writes and posts |
| LP-11 | Docker image (`node:alpine` plus the package, pushed to GHCR from the publish workflow) and the Homebrew formula in the tap | PLAN_DIYA_GL_LAUNCH.md | machine | LP-3, H8, H13 | blocked-to-start | Haiku, the distribution agent; workstream C  |
| H8 | Create the `diy-accounting-uk/homebrew-tap` repository for the formula | none | human | — | ready-to-start | an empty public repo; the formula lands by PR |
| LP-16 | In the Submit repo: the storage API in submit-prod: an S3 bucket keyed per user and book, four routes (list, get version, put version, delete) behind the pool's authoriser, a metadata sidecar for optimistic concurrency | PLAN_DIYA_GL_LAUNCH.md | machine | — | in-flight | code complete, Submit PR #150 (Maven and npm green); waits on H9  |
| LP-17 | Sign-in and "save to my account" on the books pages: hosted-UI redirect, token held in session, the book list, put and get through the storage API, conflict shown not merged; the same page on mobile | PLAN_DIYA_GL_LAUNCH.md | machine | LP-16, H9 | in-flight | steps 1 to 8 code complete (dark), merged to `claude/b4-launch` (PR #70); waits on H13; ids and the ci case after H9  |
| LP-18 | Billing: the subscribe button carries the Cognito subject to the 99p Payment Link; Submit's billing webhook records the subscription; the storage API's put route checks the entitlement; the customer portal link | PLAN_DIYA_GL_LAUNCH.md | machine | LP-16, H10, H12 | blocked-to-start | Sonnet, the billing agent; workstream D, both repos  |
| H9 | Merge the Submit repo PRs for LP-15, LP-16 and LP-18 and let its deploy workflow apply them to submit-prod | none | human | LP-16 | ready-to-start | PR #149 merged, its deploy failed (Submit run 34074004794, the Submit session fixes it); PR #150 remains |
| H10 | Create the 99p a month Stripe Payment Link (one price, monthly) and enable the customer portal | none | human | — | ready-to-start | Stripe dashboard; paste the link id into the LP-18 brief |

| H12 | Decide how the 99p subscription reaches the books user: route the subscribe button through Submit's `POST /api/v1/billing/checkout` (server sets the hashed sub, no Payment Link), or keep the Payment Link and add a route returning the caller's hashed sub | PLAN_DIYA_GL_STORAGE.md | human | — | ready-to-start | the webhook keys on the hashed sub, the Payment Link would carry the raw one |
| H13 | Merge PR #70 (`claude/b4-launch`, wave 2 batch) once its checks are green | none | human | LP-3, LP-17 | blocked-to-start | draft until the batch is green |
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
