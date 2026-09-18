<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

`main` is green on `798c2f0c` (PR #123: the donate GA4 event, the Cognito smoke-test pin, the GA4 CSP
hosts; PR #124: the BST, Taxi and Ltd axe specs settle animations before auditing). Prod serves
`19f717c9` as last known good; `798c2f0c` changed only browser specs, which the deploy's path filter
excludes. No branch but `main`; no watch monitor is armed.

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
| H-LU-9 | One paragraph to `SDSTeam@hmrc.gov.uk`: the licence changed on 2026-09-09 from AGPL-3.0 to free-to-use with source under PolyForm Internal Use 1.0.0 (plus the accountants' grant); the `Gov-Vendor-License-IDs` header, the service, its price and its API calls are unchanged. Its gate, Submit's relabel (LU-8a), landed 2026-09-09; the operator holds the draft | PLAN_DIYA_GL_LAUNCH.md | machine-ask | — | ready-to-start | — | operator | operator sends the email |
| DG-1 | Operator (2026-09-18): "Move these from the download page into a new domain homepage on diya-gl.co.uk with the same branding as https://spreadsheets.diyaccounting.co.uk/diya-gl/bst.html / https://spreadsheets.diyaccounting.co.uk/diya-gl/ltd.html and move all those pages over too as well as the sign in". The DIYA-GL section of `public/download.html` (the four `diya-gl/*.html` viewers and the four `runners/diya-gl-*.html` offline files) becomes the homepage of `diya-gl.co.uk`; the four viewer pages, `cloud.js` and the Cognito sign-in callback move with it; `download.html` keeps one link out. Needs the domain registered and its zone in `root.diyaccounting.co.uk`, a certificate, a distribution here, the app client's callback URL (LP-15) and the CSP hosts on the new origin | NEXT.md | machine, after the operator registers `diya-gl.co.uk` | LP-15, LP-17 | ready-to-start once the domain exists | L | Opus design, then Sonnet | — |
| DG-2 | Operator (2026-09-18): "Add a max 1 day retention for saved data with sign in and use labelling withnto \"24h sandbox\" a (and align the mentions of \"wip\" to \"24hy sandbox\")". A one-day expiry on the signed-in book storage (a Submit PR: the lifecycle rule on the `DiyaGlStack` bucket, the `expires` field in the metadata sidecar and the list response), and the pages say so: the "Work in progress" badge and sentence on `download.html` and every DIYA-GL page label that reads work-in-progress become "24h sandbox", with the expiry shown beside a saved book | NEXT.md | machine | LP-16, LP-17 | ready-to-start | M | Sonnet | — |
| DG-3 | Operator (2026-09-18): "Add paid feature for persistent account". The `resident-diya-gl` bundle (LP-21) lifts DG-2's one-day expiry: an entitled user's saved books keep no expiry, the sidecar and lifecycle rule read the entitlement, and the pages offer the upgrade where the 24h sandbox label sits (LP-18's subscribe button, checkout and portal) | NEXT.md | machine | DG-2, LP-18, LP-21 | blocked on DG-2 | M | Sonnet | — |

## Plans not tracked here

- `PLAN_DIYACCOUNTING_BRAND.md`: the brand in three parts — one source for the marks and tokens,
  the trade mark filings, and what recovering `diyaccounting.com` would take.
- `PLAN_DIYA_GL_LAUNCH.md`: carries the launch posts (LP-10), the Rust port (LP-12 to LP-14), the
  Filing phase as a Submit dependency (LP-19, LP-20), the HMRC licence note (H-LU-9, on the board)
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
