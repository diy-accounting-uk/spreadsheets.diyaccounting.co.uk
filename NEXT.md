<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Urgency 1 of the licensing uplift is on every main: spreadsheets PR #86 (a6b091b2), the tap's #1,
root's #28, www's #27 and the archive's #31 are merged, and npm carries `diya-gl` 1.1.0 and 1.1.1
under Apache-2.0. PR #84 (LP-24) and Submit's batches 14 and 15 are on their mains; LP-24's
toggle steps and the ci variable remain. No worktree is open. The generate dispatches (H-LU-3)
are the operator's next step; LU-9's publish check and deprecations follow them.

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
| LP-24 | The ci behaviour run switches native sign-in on for the prod DIYA-GL client before the cloud case and off after it, through Submit's `toggle-cognito-native-auth.js enable|disable prod --client books` under the prod role; the case stops skipping once H9 sets the variable | operator | machine | — | ready-to-resume | PR #84 merged; Submit's B63 landed; the toggle steps remain, Sonnet |
| H-LU-3 | Dispatch the four `generate-*` workflows, then the prod deploy | PLAN_LICENSING_UPLIFT.md | human | — | in-flight | the four generate runs dispatched 18:35 UTC; then the prod deploy |
| H9 | Set the repository variable `SUBMIT_TEST_USER_ROLE_ARN` to Submit's prod role `prod-env-spreadsheets-behaviour-role` (account 972912397388) | operator | human | — | ready-to-start | `gh variable set SUBMIT_TEST_USER_ROLE_ARN --body <arn>`; the case skips until then |
| LP-17 | Sign-in and "save to my account" on the DIYA-GL pages: hosted-UI redirect, token held in session, the book list, put and get through the storage API, conflict shown not merged; the same page on mobile | PLAN_DIYA_GL_LAUNCH.md | machine | LP-24, H9 | blocked-to-resume | steps 1 to 10 on main; the case runs against prod after LP-24 |
| LU-9 | The first release under the new terms: the prod deploy from the merge publishes 1.1.0 under Apache-2.0 with the image; the generate dispatches rebuild every package with `LICENCE.txt` and the workbook properties; then deprecate npm 1.0.0 to 1.0.5 and delete the old GHCR tags | PLAN_LICENSING_UPLIFT.md | machine | H-LU-3 | blocked-to-start | Sonnet; the tap formula reads Apache-2.0 for 1.1.1; waits on the generate runs |
| ITSA-T8 | The engine derivations that feed the annual submission (Submit's ITSA phase 2, track T8): what "The books import" says the DIYA-GL package lacks | ../submit.diyaccounting.co.uk/PLAN_ITSA_PHASE_2.md | machine | the operator's go | blocked-to-start | Opus for the mapping, Sonnet for the wiring |
| LU-8a | Submit's share of the uplift: rows S1 to S7 of `../submit.diyaccounting.co.uk/PLAN_LICENSING_UPLIFT_SUBMIT.md` (licence files, terms and footers, headers and the header test, OpenAPI `info.license`, Dockerfile labels, third-party notices, the simulator build) | PLAN_LICENSING_UPLIFT_SUBMIT.md | machine | operator | blocked-on-busy | the Submit repository is paused; landings come back through the inbox |

## Plans not tracked here

- `PLAN_LICENSING_UPLIFT.md`: the generate dispatch and LU-9 are on the board; the urgency 2
  filings (H-LU-4, H-LU-5) and the brand repository (urgency 3) stay in the plan until their turn.
  Submit's share is `../submit.diyaccounting.co.uk/PLAN_LICENSING_UPLIFT_SUBMIT.md`, one row here (LU-8a). Everything that
  touches `submit.diyaccounting.co.uk` is blocked on busy until the operator's word.
- Submit's `PLAN_ITSA_PHASE_2.md` names track T8 in this repository's package; the row waits on the
  operator's go.
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
