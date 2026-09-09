<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Urgency 1 of the licensing uplift has shipped: every repository's PR is merged, the four generate
runs and the prod deploy of 2026-09-09 19:15 UTC rebuilt every package with `LICENCE.txt` and the
workbook properties, and npm carries `diya-gl` 1.1.2 under Apache-2.0. LU-9 (the publish check and
the deprecations) and ITSA-T8 are ready; LP-24's toggle steps are ready to resume with the variable
set. The naming sweep is written up in `../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md`; its
spreadsheets rows NM-2 to NM-5 are on the board and Submit's NM-S1 to NM-S3 on Submit's. No
worktree is open.

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
| NM-2 | Rename "books" to "DIYA-GL" in prose: docs, comments, page copy and 46 test files' titles | ../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md | machine | — | ready-to-start | Haiku; ~563 hits |
| NM-3 | Rename the `/books/*` public URL namespace to DIYA-GL: `public/books/**`, `download.html`'s hrefs, the manifest and service worker, with `redirects.toml` and CloudFront function entries for every old path | ../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md | machine | — | ready-to-start | Sonnet; ~15 references, ~40 served files |
| NM-4 | Rename the same-repo "books" code identifiers: `books-engine.js`, `books-interchange.js`, `build-books-bundle.mjs`, 46 test filenames, `download.html`'s DOM ids, `books-events.js`, `books.css`, and the `"diya-gl-books"` format string (decided: `diya-gl/1`, the reader keeps accepting the old stamps; needs a version bump and a back-compat reader) | ../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md | machine | — | ready-to-start | Sonnet; the stamp decision is made: `diya-gl/1` |
| NM-5 | Design and rename the cross-repository "books" identifiers this side touches: `public/books/cloud.js`'s API calls, the Cognito client naming, `PLAN_DIYA_GL_CLOUD_PAGE.md`, against Submit's `BooksStack` and the shared route table | ../submit.diyaccounting.co.uk/PLAN_DIYA_GL_NAMING.md | machine | NM-S3 | blocked-to-start | Opus to design, then Sonnet; in step with Submit's B71.S3c and S3d |
| LP-24 | The ci behaviour run switches native sign-in on for the prod DIYA-GL client before the cloud case and off after it, through Submit's `toggle-cognito-native-auth.js enable|disable prod --client books` under the prod role | operator | machine | — | ready-to-resume | PR #84 merged; the variable is set; the toggle steps remain, Sonnet |
| LU-9 | The first release under the new terms: the prod deploy from the merge publishes 1.1.0 under Apache-2.0 with the image; the generate dispatches rebuild every package with `LICENCE.txt` and the workbook properties; then deprecate npm 1.0.0 to 1.0.5 and delete the old GHCR tags | PLAN_LICENSING_UPLIFT.md | machine | — | ready-to-start | Sonnet; the generate runs and prod deploy are green; 1.1.2 is on npm |
| ITSA-T8 | The two self-employed derivations in the DIYA-GL package, `buildSelfEmploymentQuarterlyUpdates` and `buildSelfEmploymentAnnualSubmission` (Submit's ITSA phase 2, track T8): `app/lib/calculators/se-derivations.js` and its tests, proved cell by cell against the self-employed package's own report over every example | ../submit.diyaccounting.co.uk/PLAN_ITSA_PHASE_2.md | machine | — | ready-to-start | the go given 2026-09-09; Opus for the mapping, Sonnet for the wiring |
| LP-17 | Sign-in and "save to my account" on the DIYA-GL pages: hosted-UI redirect, token held in session, the book list, put and get through the storage API, conflict shown not merged; the same page on mobile | PLAN_DIYA_GL_LAUNCH.md | machine | LP-24 | blocked-to-resume | steps 1 to 10 on main; the case runs against prod after LP-24 |
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
