<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

**COOL-DOWN is on since 2026-09-21T19:30:33Z.** No new board rows except a degradation. Agents commit
and stop. One branch is driven green at a time. Lifted only by the operator in their own words.

DG-1k, in Submit: the callbacks agent on `claude/diya-gl-drop-spreadsheets-hosts` (worktree
`../submit.diyaccounting.co.uk/.claude/worktrees/dg-1k`), one Submit PR to follow; the operator
lifted the cool-down question at 19:12Z (Submit is not cooling down). Nothing else open here;
`main`'s last code head `128240e2e` is on prod.

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

| # | Item | Source | Needs | Precursors | State | Size | Model | Status |
|---|---|---|---|---|---|---|---|---|
| DG-1k | Submit: drop the spreadsheets-host callback URLs after the cut-over | PLAN_DIYA_GL_HOME.md | machine-only | — | in-flight | 5 files | Haiku | Submit PR #322 `a7e22a958`; test and deploy running; cool-down holds the merge |
| LP-25a | Bank referral: pick the partner programme, sign up, supply the link and the disclosure wording | PLAN_DIYA_GL_LAUNCH.md | human-driven | — | ready-to-start | ~0 files | operator | added 2026-09-21 on the operator's instruction |
| LP-25b | Bank referral: the placement, the disclosure line, the `referral_clicked` event | PLAN_DIYA_GL_LAUNCH.md | machine-only | LP-25a | blocked-to-start | ~4 files | Haiku | after the operator supplies the link |
| LP-24 | Google Drive as a second store for the book, in the Resident bundle with S3 | PLAN_DIYA_GL_LAUNCH.md | machine-only | PU-1 | blocked-to-start | ~6 files | Opus design, then Sonnet | after Submit's `resident` bundle (PU-1) |
| PU-8 | The pages: "35-day sandbox" labels, the countdown in days, the offer at £39/year first, `sandbox_expired_seen` | ../submit.diyaccounting.co.uk/PLAN_PRICE_UPDATE.md | machine-only | PU-2, PU-4 | blocked-to-start | ~9 files | Sonnet | after Submit's two prices and 35-day retention |

## Plans not tracked here

- `PLAN_DIYA_GL_INDIA.md`: carries its own board (India as a third jurisdiction; the core/uk
  split first) at the top of the plan.
- `PLAN_DIYACCOUNTING_BRAND.md`: the brand in three parts — one source for the marks and tokens,
  the trade mark filings, and what recovering `diyaccounting.com` would take.
- `PLAN_DIYA_GL_LAUNCH.md`: carries the launch posts (LP-10), the Rust port (LP-12 to LP-14), the
  Filing phase as a Submit dependency (LP-19, LP-20), the HMRC licence note (H-LU-9, tracked in Submit's `NEXT.md` under Human-driven from 2026-09-18)
  and SB-1's last task (SB-3, on the board).
- `../submit.diyaccounting.co.uk/PLAN_PRICE_UPDATE.md`: one Resident bundle at £39 a year, annual
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
