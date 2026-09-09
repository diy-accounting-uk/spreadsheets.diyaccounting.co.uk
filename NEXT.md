# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Waves 1 to 4 landed with PRs #69 to #72 on 2026-09-07; prod deploys from each, and the DIYA-GL
pages' cloud sign-in is live against Submit's storage API. Publishing is automatic: every green prod deploy from a push to main publishes the next
`diya-gl` version, pushes the image and rolls the version; the tap tracks npm hourly. The
billing panel and the ci sign-in case are on main (PR #80); no worktree is open. Sub-agents run no
LibreOffice and prove JS calculations against the committed packages' extraction
(`report.js --source-dir`). A fresh worktree needs `node scripts/build-books-bundle.mjs` before
any DIYA-GL browser spec, and a rebuild after merging engine changes. The generate workflows cancel
their own in-progress run on a push to their ref, so a session pushes nothing to a branch while a
generate run is in progress on it. `PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue plan of
record and carries its own open items.

## Context for the open rows

The `LP` rows are `PLAN_DIYA_GL_LAUNCH.md`'s task list, same ids; each row's
brief lives there under "Briefs". LP-12 to LP-14 (the Rust port) and LP-19, LP-20 (Filing) stay
in the plan until their phase opens. They pack into four workstreams by area of change, each a batch
branch `claude/b<n>-<topic>` with one worktree per row:

- **Workstream A, the DIYA-GL engine and the package** (LP-1 to LP-4): `app/lib` and `app/bin`,
  `package.json`, `scripts/build-books-bundle.mjs`, the workflows. Sonnet throughout; LP-1 first,
  the rest in series on its output.
- **Workstream B, the web pages** (LP-5 to LP-9): `web/spreadsheets.diyaccounting.co.uk/public/`
  and `scripts/`. LP-6, LP-7 and LP-8 share no file and run at once; LP-5 waits on LP-1; LP-9 waits
  on G1. Sonnet, except the spec page on Opus.
- **Workstream C, distribution** (LP-10, LP-11): after the package. Haiku for the mechanical
  half; the launch posts are the operator's.
- **Workstream D, the cloud** (LP-15 to LP-18): the Submit repo's CDK and Lambdas
  (`../submit.diyaccounting.co.uk/infra/main/java/co/uk/diyaccounting/submit/stacks/`,
  `IdentityStack.java`, `ApiStack.java`, `BillingWebhookStack.java`) plus this repo's DIYA-GL
  pages. Two design waves on Opus (LP-16, LP-17), then Sonnet. Every AWS change goes through a
  Submit PR and its deploy workflow (H9), never a console write.


## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| LP-17 | Sign-in and "save to my account" on the DIYA-GL pages: hosted-UI redirect, token held in session, the book list, put and get through the storage API, conflict shown not merged; the same page on mobile | PLAN_DIYA_GL_LAUNCH.md | machine | LP-23 | in-flight | steps 1 to 10 on main; the ci sign-in case's first real run is the dispatched ci deploy |
| LP-23 | The ci behaviour job mints its test user: assume Submit's cross-account role, fetch `scripts/ensure-cognito-test-user.js` from Submit's main, run it for the `spreadsheetsBehaviour` lane, mask its three outputs into the sign-in case | PLAN_DIYA_GL_LAUNCH.md | machine | — | in-flight | role assumed and user minted for real (PR #83); the case reached the books list; Submit's ci API host was down, the case now skips when it is |

## Plans not tracked here

- `PLAN_LICENSING_UPLIFT.md` is a draft awaiting the operator's approval (H-LU-1); its rows join
  the board when approved.
- `PLAN_DIYA_GL_LAUNCH.md` carries its own open items (the launch posts LP-10, the Rust port plan
  and the operator's research); Submit's `NEXT.md` carries B50 (the DIYA-GL app client in the native-auth toggle), B54 (the `resident-diya-gl` bundle, LP-21 there, done) and B55 (checkout and the portal for DIYA-GL tokens). Its phase rows are not yet on the board.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first). A generate workflow's commit job pushes with the default
  `GITHUB_TOKEN`, which fires no workflow, so a package commit deploys only through
  `gh workflow run deploy.yml -f environment-name=prod` or the 07:17 UTC schedule.
