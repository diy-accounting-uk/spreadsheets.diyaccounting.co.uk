<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

DG-1b, the cut-over runbook, is in progress: root deploy done (both zones exist), both
registrations point at the new zones and resolve, the certificate is `ISSUED`
(`ada2b2aa-…`), `DIYA_GL_CERTIFICATE_ARN` is set, `ci-spreadsheets-DiyaGlSiteStack` is
`CREATE_COMPLETE` (run 35590445983), and the prod deploy (run 35592882247) is running; the second
root deploy for the alias records follows. The last code head on `main`, `c213fe6d`, is on prod.
No batch, worktree agent or PR is open here; no watch monitor of this session is armed.

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
| DG-1a | Root: hosted zones, aliases and delegate role for diya-gl.co.uk and diya-gl.com | PLAN_DIYA_GL_HOME.md | machine-only | — | in-flight | ~6 files | Sonnet | root PR #33, gates green; operator merges |
| DG-1b | Cut-over runbook: root deploy, name servers, certificate, variable, site stacks, second root deploy | PLAN_DIYA_GL_HOME.md | machine-ask | — | in-flight | ~0 files | Sonnet | steps 1-6 done through the ci deploy; prod deploy run 35592882247 running; then the second root deploy |
| CSP-1 | `img-src` of both CSPs admits the twenty-one Google ccTLD hosts the operator chose (2026-09-21), `connect-src` unchanged; a unit test asserts both files and the quota | none | machine-only | — | ready-to-start | ~3 files | Haiku | operator chose the list; 1,537 and 1,132 chars against the 1,783 quota |
| DG-1l | The format spec page moves to diya-gl.co.uk/spec.html: builder, links, sitemaps, redirect | PLAN_DIYA_GL_HOME.md | machine-only | DG-1b | blocked-to-start | ~18 files | Sonnet | its links and redirect point at the new host; after DG-1b |
| DG-1i | The deploy's behaviour job on the new host: `DIYA_GL_BASE_URL`, sign-in on ci.diya-gl.co.uk against Submit prod | PLAN_DIYA_GL_HOME.md | machine-only | DG-1b | blocked-to-start | ~3 files | Haiku | needs the ci host; after DG-1b |
| DG-1n | Retarget `/books/` and `/diya-gl/` on the spreadsheets host onto diya-gl.co.uk once the host resolves | PLAN_DIYA_GL_HOME.md | machine-only | DG-1b | blocked-to-start | ~1 files | Haiku | after DG-1b |
| DG-1j | Cut-over probes on diya-gl.co.uk and the old links, as prod behaviour cases | PLAN_DIYA_GL_HOME.md | machine-only | DG-1b, DG-1d, DG-1f, DG-1g, DG-1i, DG-1l, DG-1n | blocked-to-start | ~1 files | Haiku | after DG-1b |
| DG-1k | Submit: drop the spreadsheets-host callback URLs after the cut-over | PLAN_DIYA_GL_HOME.md | machine-only | DG-1j | blocked-to-start | ~3 files | Haiku | after DG-1j |

## Plans not tracked here

- `PLAN_DIYA_GL_INDIA.md`: carries its own board (India as a third jurisdiction; the core/uk
  split first) at the top of the plan.
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
