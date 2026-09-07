# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Waves 1 to 3 landed with PRs #69, #70 and #71 on 2026-09-07; prod deploys from each. Submit PRs
#149 and #150 are merged and deployed. Wave 4 is LP-17's step 9 on draft PR #72
(`claude/lp-17-ids`, worktree `../.worktrees/spreadsheets/lp-17b`). Sub-agents run no LibreOffice and prove JS calculations against the
committed packages' extraction (`report.js --source-dir`). A fresh worktree needs
`node scripts/build-books-bundle.mjs` before any books browser spec, and a rebuild after merging
engine changes. The generate workflows cancel their own in-progress run on a push to their ref, so
a session pushes nothing to a branch while a generate run is in progress on it.
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
| H7 | Add an npm publish token for the `diy-accounting-uk` org as the `NPM_TOKEN` repository secret | none | human | — | ready-to-start | Settings, Secrets and variables, Actions |
| LP-10 | The Show HN post and the AccountingWEB piece: 15 KB for a year of accounts, recalculates without Excel, byte-identical across CLI, MCP and browser | none | human | H7 | blocked-to-start | the operator writes and posts; the package publishes on a `diya-gl-v*` tag after H7  |
| LP-11 | Docker image (`node:alpine` plus the package, pushed to GHCR from the publish workflow) and the Homebrew formula in the tap | PLAN_DIYA_GL_LAUNCH.md | machine | H8 | blocked-to-start | Haiku, the distribution agent; the publish workflow is on main |
| H8 | Create the `diy-accounting-uk/homebrew-tap` repository for the formula | none | human | — | ready-to-start | an empty public repo; the formula lands by PR |
| LP-17 | Sign-in and "save to my account" on the books pages: hosted-UI redirect, token held in session, the book list, put and get through the storage API, conflict shown not merged; the same page on mobile | PLAN_DIYA_GL_LAUNCH.md | machine | H15 | in-flight | step 9 on draft PR #72 (`claude/lp-17-ids`), checks running; waits on H15; step 10 after the sign-in toggle |
| LP-18 | Billing: the subscribe button carries the Cognito subject to the 99p Payment Link; Submit's billing webhook records the subscription; the storage API's put route checks the entitlement; the customer portal link | PLAN_DIYA_GL_LAUNCH.md | machine | H10, H12 | blocked-to-start | Sonnet, the billing agent; both repos  |
| H10 | Create the 99p a month Stripe Payment Link (one price, monthly) and enable the customer portal | none | human | — | ready-to-start | Stripe dashboard; paste the link id into the LP-18 brief |

| H12 | Decide how the 99p subscription reaches the books user: route the subscribe button through Submit's `POST /api/v1/billing/checkout` (server sets the hashed sub, no Payment Link), or keep the Payment Link and add a route returning the caller's hashed sub | PLAN_DIYA_GL_STORAGE.md | human | — | ready-to-start | the webhook keys on the hashed sub, the Payment Link would carry the raw one |
| H15 | Merge PR #72 (`claude/lp-17-ids`, wave 4) once its checks are green | none | human | — | blocked-to-start | draft until the checks are green |
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
