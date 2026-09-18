<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

`main` is green on `8fd0532e4` (test and codeql, 2026-09-18 11:51 UTC); the prod deploy of that head
succeeded at 12:13 UTC. The three commits since are `NEXT.md` only, which the deploy's path filter
excludes. No branch is ahead of `main`; no watch monitor is armed.

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
| DG-1c | The certificate request workflow for the diya-gl hosts | PLAN_DIYA_GL_HOME.md | machine-only | — | ready-to-start | ~1 files | Haiku | — |
| DG-1h | Submit: the DIYA-GL app client's callback URLs and allowed origins for the new hosts | PLAN_DIYA_GL_HOME.md | machine-only | — | ready-to-start | ~3 files | Sonnet | — |
| DG-3a | Submit: checkout refuses a bundle not listed in the current environment | PLAN_DIYA_GL_HOME.md | machine-only | — | ready-to-start | ~3 files | Sonnet | — |
| DG-1a | Root: hosted zones, aliases and delegate role for diya-gl.co.uk and diya-gl.com | PLAN_DIYA_GL_HOME.md | machine-only | — | ready-to-start | ~4 files | Sonnet | — |
| DG-1d | `DiyaGlSiteStack`: bucket, distribution, headers, redirect function, deploy step | PLAN_DIYA_GL_HOME.md | machine-only | — | ready-to-start | ~6 files | Sonnet | — |
| DG-2a | Submit: retention in the storage routes (24h sandbox, resident), tags, lifecycle rule, tier switch | PLAN_DIYA_GL_HOME.md | machine-only | — | ready-to-start | ~10 files | Opus design, then Sonnet | — |
| DG-1e | Move the DIYA-GL pages to `web/diya-gl.co.uk/public`; re-home builds, redirects and links | PLAN_DIYA_GL_HOME.md | machine-only | — | ready-to-start | ~25 files | Sonnet | — |
| DG-1b | Operator: root deploy, registrar name servers, certificate workflow, variables, GA4 domain | PLAN_DIYA_GL_HOME.md | human-driven | DG-1a, DG-1c | blocked on DG-1a | ~0 files | operator | — |
| DG-1i | `cloud-config.js` generated per environment; the ci behaviour job on Submit's ci role | PLAN_DIYA_GL_HOME.md | machine-ask | DG-1e, DG-1h | blocked on DG-1e | ~4 files | Sonnet | — |
| DG-2b | The 24h sandbox on the pages: labels, expiry per book, 403 path removed, ci behaviour case | PLAN_DIYA_GL_HOME.md | machine-only | DG-2a | blocked on DG-2a | ~4 files | Sonnet | — |
| DG-3b | The upgrade offer beside the sandbox label, the lapsed state, the ci resident behaviour case | PLAN_DIYA_GL_HOME.md | machine-only | DG-2b, DG-1i | blocked on DG-2b | ~3 files | Sonnet | — |
| DG-3c | Submit: the daily sweeper for lapsed subscribers' resident books | PLAN_DIYA_GL_HOME.md | machine-ask | DG-2a | blocked on DG-2a | ~4 files | Sonnet | — |
| DG-1g | The homepage: the Ltd example at year view 2025-04, product nav, tier strip, runner row | PLAN_DIYA_GL_HOME.md | machine-only | DG-1e | blocked on DG-1e | ~8 files | Opus | — |
| DG-4 | The "On this device" row, `storage.persist()`, the three-tier wording | PLAN_DIYA_GL_HOME.md | machine-only | DG-2b, DG-1g | blocked on DG-2b | ~3 files | Sonnet | — |
| DG-5 | `runners.json` with size and stamp, the homepage runner row, the newer-file notice | PLAN_DIYA_GL_HOME.md | machine-only | DG-1g | blocked on DG-1g | ~3 files | Sonnet | — |
| DG-1f | The browser and behaviour tests on the new site root | PLAN_DIYA_GL_HOME.md | machine-only | DG-1e | blocked on DG-1e | ~45 files | Haiku | — |
| DG-1j | Operator: cut-over check on diya-gl.co.uk and the old links | PLAN_DIYA_GL_HOME.md | human-driven | DG-1b, DG-1d, DG-1f, DG-1g, DG-1i | blocked on DG-1b | ~0 files | operator | — |
| DG-1k | Submit: drop the spreadsheets-host callback URLs after the cut-over | PLAN_DIYA_GL_HOME.md | machine-only | DG-1j | blocked on DG-1j | ~2 files | Haiku | — |

## Plans not tracked here

- `PLAN_DIYACCOUNTING_BRAND.md`: the brand in three parts — one source for the marks and tokens,
  the trade mark filings, and what recovering `diyaccounting.com` would take.
- `PLAN_DIYA_GL_LAUNCH.md`: carries the launch posts (LP-10), the Rust port (LP-12 to LP-14), the
  Filing phase as a Submit dependency (LP-19, LP-20), the HMRC licence note (H-LU-9, tracked in Submit's `NEXT.md` under Human-driven from 2026-09-18)
  and SB-1's last task (SB-3, on the board).
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
