<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Urgency 1 of the licensing uplift is code complete: PR #86 (`claude/lu-1-terms`) carries LU-1 to
LU-7, LU-8d, LU-10, LU-11, LU-18, LU-19 and CQ-1, with Maven verify and `npm run test:fast` green
(8,517 tests). The sibling repositories' rows are PRs of their own: the tap's #1 (LU-17, after the
rename LU-20), root's #28 and www's #27 (LU-8c), the archive's #31 (LU-8b). No worktree is open.
LU-9, the first release under the new terms, follows the merges and H-LU-3's generate dispatches.

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
| LU-20 | Rename the tap repository to `homebrew-diya-gl` on GitHub (GitHub redirects the old name); the follow-through edits ride LU-17, the spec builder's line rides LU-6 and the package README rides LU-8d | PLAN_LICENSING_UPLIFT.md | human | — | ready-to-start | `gh repo rename homebrew-diya-gl -R diy-accounting-uk/homebrew-tap --yes`; the classifier blocked the session |
| H1 | Merge Submit PR #159 (batch 14, carrying B63: the ci behaviour role may read prod's Identity stack) | operator | human | — | ready-to-start | checks running on the 01:22 UTC push; merge on green |
| H3 | Merge PR #86 (`claude/lu-1-terms`, the licensing batch: groups 1A to 1D, LU-10, CQ-1) | operator | human | — | ready-to-start | Maven verify and `test:fast` green locally; CI on the last push |
| H5 | Merge root PR #28 (LU-8c) | operator | human | — | ready-to-start | headers, LICENSE, README |
| H6 | Merge www PR #27 (LU-8c) | operator | human | — | ready-to-start | headers, LICENSE, footers, local og:image |
| H7 | Merge archive PR #31 (LU-8b) | operator | human | — | ready-to-start | 357 files; one `LICENCE.txt` per package tree |
| H4 | Merge tap PR #1 (LU-17) | operator | human | LU-20 | blocked-to-start | after the rename |
| H-LU-3 | Dispatch the four `generate-*` workflows, then the prod deploy | PLAN_LICENSING_UPLIFT.md | human | H3 | blocked-to-start | rebuilds every package with `LICENCE.txt` and the workbook properties |
| LP-24 | The ci pages target Submit's released environment: one cloud config for every host (prod API, prod hosted UI, prod DIYA-GL client), the ci behaviour run mints its user in the prod pool through the prod role, the sign-in case probes the prod API | operator | machine | H1 | blocked-to-resume | PR #84 open; smoke mint denied until H1; toggle steps follow |
| H2 | Merge PR #84 (`claude/lp-24-prod-target`) | operator | human | LP-24 | blocked-to-start | waits for a green smoke test after H1 |
| LP-17 | Sign-in and "save to my account" on the DIYA-GL pages: hosted-UI redirect, token held in session, the book list, put and get through the storage API, conflict shown not merged; the same page on mobile | PLAN_DIYA_GL_LAUNCH.md | machine | LP-24 | blocked-to-resume | steps 1 to 10 on main; the case's first green run needs LP-24 |
| LU-9 | The first release under the new terms: the package and root at 1.1.0; the prod deploy publishes it under Apache-2.0 with the image; the generate dispatches rebuild every package with `LICENCE.txt` and the workbook properties; then deprecate npm 1.0.0 to 1.0.3 and delete the old GHCR tags | PLAN_LICENSING_UPLIFT.md | machine | H3, H4, H-LU-3 | blocked-to-start | Sonnet; the 1.1.0 bump, the publish check, the deprecations by CLI |
| LU-8a | Submit: canonical PolyForm `LICENSE` with the grant; `terms.html` and `accessibility.html` say free to use, source available; the 28 `-or-later` headers and the battery-pack mix; `info.license` in the OpenAPI generator; the missing headers; the stale simulator copy | PLAN_LICENSING_UPLIFT.md | machine | operator | blocked-on-busy | group 1E; Sonnet, Opus for the terms wording; the Submit repository is paused |

## Plans not tracked here

- `PLAN_LICENSING_UPLIFT.md`: the merges, the generate dispatch and LU-9 are on the board; the
  urgency 2 filings (H-LU-4, H-LU-5), the HMRC note (H-LU-9) and the brand repository (urgency 3)
  stay in the plan until their turn. Everything that
  touches `submit.diyaccounting.co.uk` is blocked on busy until the operator's word.
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
