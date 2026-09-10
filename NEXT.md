<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Urgency 1 of the licensing uplift has shipped: every repository's PR is merged, the four generate
runs and the prod deploy of 2026-09-09 19:15 UTC rebuilt every package with `LICENCE.txt` and the
workbook properties, and npm carries `diya-gl` 1.1.2 under Apache-2.0. Urgency 1 is closed: npm
1.0.0 to 1.0.5 are deprecated and the pre-Apache GHCR tags are deleted, so GHCR holds 1.1.0, 1.1.1
and 1.1.2 with `latest` on 1.1.2. ITSA-T8 is ready; LP-24's toggle steps are ready to resume with
the variable set. The naming sweep is written up in `../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md`; its
spreadsheets rows NM-2 to NM-5 are on the board and Submit's NM-S1 to NM-S3 on Submit's.

Batches b7 and b8 are merged (PRs #89 and #90), prod is deployed and green, and `diya-gl` 1.2.1
is on npm. That was the naming sweep, the ITSA self-employed derivations, the ci native-auth
toggle, the cloud case fix chain, the self-employed template-defect warnings, the commit-identity
guard and the page globals rename. No worktree is open, no branch but main exists on either side,
no agent is running, and main carries nothing after its last push.

Prod's last green deploy is `41186603`. main's HEAD is a bot version-roll commit that fires no
workflow, which is this repository's normal state after a publish; `PARKED.md` records why chasing
it does not terminate.

One ci environment serves every branch, so only one batch branch can hold the deploy slot. The
deploy group is keyed on the environment with `cancel-in-progress: false`, so a second branch's
push displaces the first's pending deploy rather than racing it. While two batches are live,
push the one whose PR needs to go green and let the draft's deploys wait.

Publishing is automatic: every green prod deploy from a push to main publishes the next `diya-gl`
version, pushes the image and rolls the version; the tap tracks npm hourly. Sub-agents run no
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
| LP-17 | Sign-in and "save to my account" on the DIYA-GL pages: hosted-UI redirect, token held in session, the book list, put and get through the storage API, conflict shown not merged; the same page on mobile | PLAN_DIYA_GL_LAUNCH.md | machine | — | ready-to-resume | steps 1 to 10 on main; the cloud case is green against prod |
| LP-25 | The cloud behaviour case saves a book at roughly 20KB and one at roughly 500KB, two bands above CloudFront's 8KB inspection boundary, as end-to-end evidence for Submit's WAF body-size fix | operator | machine | — | ready-to-start | Submit's WAF fix is on prod; roughly 20KB and 500KB, Sonnet |
| NM-8 | Move the packaged engine's `DEFAULT_TEMPLATE_SOURCE` from `/books/assets/` to `/diya-gl/assets/` once the live site serves the new path, and update the fetch test's expected URL with it | ../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md | machine | — | ready-to-start | prod serves /diya-gl/assets/ now, verified 200; Haiku |
| CQ-4 | Pin the raw-URL fetches of `ensure-cognito-test-user.js` and `toggle-cognito-native-auth.js` so a merge to Submit's main stops being a release to our runners | none | machine | — | ready-to-start | the retry is on their main, verified; pin captures it, Haiku |
| NM-5 | Design and rename the cross-repository "books" identifiers this side touches: `public/books/cloud.js`'s API calls, the Cognito client naming, `PLAN_DIYA_GL_CLOUD_PAGE.md`, against Submit's `BooksStack` and the shared route table | ../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md | machine | S3d | blocked-to-start | Submit's PR #175 is red; their main still serves `books` |

## Plans not tracked here

- `PLAN_LICENSING_UPLIFT.md`: the urgency 2 filings (H-LU-4, H-LU-5) and the brand repository
  (urgency 3) stay in the plan until their turn.
  Submit's share is `../submit.diyaccounting.co.uk/PLAN_LICENSING_UPLIFT_SUBMIT.md`, tracked on
  Submit's own board as B70.
- Submit's `PLAN_ITSA_PHASE_2.md` names track T8 in this repository's package; their B11.T9 waits
  on it.
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
