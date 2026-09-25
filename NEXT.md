<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Nothing. Prod serves `05c887750` (PR #135, PU-8, with PR #134's Google Drive store under it),
every run green. `main`'s head `46c09ca82` is the scheduled dependency update, a bot push that
fires no workflow; the 07:17 UTC deploy picks it up. The board's open rows are the operator's
(LP-24a, LP-25a) or wait on one (LP-25b).

## Context for the open rows

The `LP` rows are `PLAN_DIYA_GL_LAUNCH.md`'s task list, same ids; each row's
brief lives there under "Briefs". LP-12 to LP-14 (the Rust port) and LP-19, LP-20 (Filing) stay
in the plan until their phase opens. They pack into four workstreams by area of change, each a batch
branch `claude/b<n>-<topic>` with one worktree per row:

- **Workstream A, the DIYA-GL engine and the package** (LP-1 to LP-4): `app/lib` and `app/bin`,
  `package.json`, `scripts/build-diya-gl-bundle.mjs`, the workflows. Sonnet throughout; LP-1 first,
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

| # | Item | Source | Needs | Precursors | State | Size | Model | Status |
|---|---|---|---|---|---|---|---|---|
| CQ-57 | Problem: a batch that forks from `main` while an open PR touches the same files pushes a head that the other PR's merge then supersedes (PR #135), or asserts a fact that PR has already changed (PR #134). To be: before a batch's first push, `do-next` forks it from, or merges into it, the merged tip of any open PR sharing its files, and the board's Status names the overlap. Anchors: `do-next/SKILL.md` "taken from `main`" (line 84) and "Before the first push of a batch" (line 318); `iterate/SKILL.md` "One batch branch per wave" (line 65) | REPORT_SESSION_dn+mHL_2026-09-23.md | machine-only | — | ready-to-start | ~2 files | Haiku | removes 65 plus 53 job-minutes and a 35-minute fix cycle per overlap |
| CQ-58 | Problem: the scheduled test run repeats every tier on a head whose code the last push run already proved green, because the publish roll changes `diya-gl/package.json`, `package.json` and `app/data/releases.json` after that run, so `test.yml`'s `green-check` (line 95) computes a hash with no `green-<hash>` record; `--code-tree-hash` also ignores `--rev` (`scripts/test-scope.mjs` line 835), so the hash cannot be checked for a commit. To be: the code-tree hash normalises the rolled version fields as `normaliseEngineVersion` (line 264) does, `--rev` applies to it, and a scheduled run on a proven tree reuses the record and skips the tiers | REPORT_SESSION_dn+mHL_2026-09-23.md | machine-only | — | ready-to-start | ~3 files | Sonnet | run 35827958993: 61.5 job-minutes to remove per docs-only or post-publish day |
| LP-24a | Google Drive store: the seven console steps under "Operator steps" in the LP-24 design (`PLAN_DIYA_GL_LAUNCH.md` line 777), then post the OAuth client id here; it lands in `cloud-config.js` `googleClientId` (line 25) per host | PLAN_DIYA_GL_LAUNCH.md | human-driven | — | ready-to-start | ~0 files | operator | the Drive item and Connect row are on prod and inert until the id is set |
| LP-25a | Bank referral: pick the partner programme, sign up, supply the link and the disclosure wording | PLAN_DIYA_GL_LAUNCH.md | human-driven | — | ready-to-start | ~0 files | operator | added 2026-09-21 on the operator's instruction |
| LP-25b | Bank referral: the placement on the homepage tier strip (`index.html` lines 66 to 75) and the signed-out panel (`cloud.js` `renderSignedOut`, line 784), the disclosure line, a `referral_clicked` builder in `diya-gl-events.js` after `buildCloudDriveOpenEvent` (line 77) with its case in `web/unit-tests/diya-gl-events.test.js`, and the cloud browser spec | PLAN_DIYA_GL_LAUNCH.md | machine-only | LP-25a | blocked-to-start | ~5 files | Sonnet | the link and the disclosure wording are LP-25a's output |
| LP-26 | Saving the example book offers to update the copy already in the account. Prod has one owner with 7 cloud copies of the sole-trader example "Precision Code Trading", all saved 2026-09-13, and another with 2 (2026-09-22). `cloud.js` `saveCurrentBook` (line 1352) updates the linked book when a link exists and otherwise asks "Update it, or save as a new book?" on a same-title, same-period match (`findNearDuplicate`, line 1256; the panel at line 905), shipped 2026-09-07, before those saves. Diagnose first which path made the copies: "New book" chosen, no match (the example's period fields, a failed list call), or the link lost between saves (`getLink`, line 298, in session storage); then make an example save land on the existing copy by default, with a test in `web/browser-tests/diya-gl-cloud.browser.test.js` | operator 2026-09-25 | machine-only | — | ready-to-start | ~2 files | Sonnet | added 2026-09-25 |
| LP-27 | DIYA-GL as a product on the spreadsheets site, and links from DIYA-GL back. (1) A DIYA-GL entry in `web/spreadsheets.diyaccounting.co.uk/public/index.html`'s "DIY Accounting Products" section (line 56) linking https://diya-gl.co.uk/. (2) A "DIYA-GL" item in the top nav (Products, Download, Knowledge Base, Community, Submit VAT MTD, Donate; `index.html` lines 41 to 46), on all 10 pages that carry it and in the generators that write it (`app/bin/build-diya-gl-spec.js`, `app/bin/build-reconciliation-pages.js`; `git grep -l 'Submit VAT MTD'`). (3) DIYA-GL's pages (`web/diya-gl.co.uk/public/*.html`, the home's strip at `index.html` line 58 and the footer at line 183) link to https://submit.diyaccounting.co.uk/ and https://spreadsheets.diyaccounting.co.uk/. Browser tests for the nav and the links; the gateway's G-1 and Submit's X-1 are the same change on the other sites | operator 2026-09-25 | machine-only | — | ready-to-start | ~14 files | Sonnet | added 2026-09-25 |

## Plans not tracked here

- `PLAN_DIYA_GL_INDIA.md`: carries its own board (India as a third jurisdiction; the core/uk
  split first) at the top of the plan.
- `PLAN_DIYACCOUNTING_BRAND.md`: the brand in three parts — one source for the marks and tokens,
  the trade mark filings, and what recovering `diyaccounting.com` would take.
- `PLAN_DIYA_GL_LAUNCH.md`: carries the launch posts (LP-10), the Rust port (LP-12 to LP-14), the
  Filing phase as a Submit dependency (LP-19, LP-20), the HMRC licence note (H-LU-9, tracked as Submit's BACKLOG row 75)
  and SB-1's last task (SB-3, on the board).
- `../developers/submit/archive/PLAN_PRICE_UPDATE.md`: one Resident bundle at £39 a year, annual
  first, the practice licence, the 35-day sandbox; its Submit tasks PU-1 to PU-7 and PU-9 sit on
  Submit's board, PU-8 here.
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
