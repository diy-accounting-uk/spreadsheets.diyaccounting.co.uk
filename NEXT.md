<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Main is `6f6d2077` and green: `test`, `deploy` and `codeql` all pass on the merge commit below
it, the four generate workflows pass with tests enabled, and `diya-gl` publishes again -- 1.2.7
and 1.2.8 both released, tagged and rolled.

No branch holds unlanded work. `claude/docs-test-strategy` is fully on main but `git branch -d`
refuses it, and twelve merged branches sit on the remote; deleting either is the operator's.

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

| # | Item | Source | Needs | Precursors | State | Status |
|---|---|---|---|---|---|---|
| CQ-20 | `app/lib/calculators/ltd.js` carries no disallowable treatment, so the Company computation deducts client entertaining in full. SET-2 and SET-3 have just closed the same gap for Self Employed, and the shared master fixture now carries the £350 client dinner that exercises it | none | machine-only | — | ready-to-start | follow SET-2 and SET-3's landed shape; Sonnet |
| CQ-21 | Code scanning opens `js/prototype-pollution-utility` on `app/lib/calculators/se-derivations.js:76`, a file #97 changed. Read the site and either guard the key or say why the input cannot reach it | none | machine-only | — | ready-to-start | one file; Haiku |
| CQ-25 | Nothing on the Self Employed page shows the disallowable figures SET-2 and SET-3 added. The entertainment memo at `Profit & Loss Account!B49` and its twelve months, box 46's add-back, and the two journal categories are all declared unrenderable in `app/data/render-unrepresentable/se.json`, which is accurate today and is why the render-coverage gate passes: the P&L view renders the statement B5 to B39 and stops, and the page has no profit-bridge or VAT-netting view at all. A trader who enters client entertaining sees the money leave and never sees what it does to the tax. Either the P&L view carries a memo block under the statement, or the SA103F view carries the bridge | PLAN_SE_TEMPLATE_GAPS.md | human and machine | — | ready-to-start | the operator picks which view carries it; building it is a session's |
| SET-4 | Boxes 51, 53.1 and 73.3 are the three that genuinely have no cell. Box 51 needs a second pool on `Fixedassets.xlsx!Schedule` plus a rate cell at the free `Admin!G6`; box 53.1 cannot be dropped in, because `O160` is box 59 today and the rows below need laying out afresh. The other seven of SED-7 and SED-8's twelve already print a cell the engine reads as blank, so they need a book field and a writer, not a template change | PLAN_SE_TEMPLATE_GAPS.md | machine-only | — | ready-to-start | three boxes each need a decision written into the plan's 3.4 |
| H-SB-1a | Fill `donate-links.toml`'s `[ci]` section with real test-mode Payment Links: `STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-spreadsheets-setup.js`, which mints them and writes the section. Until then ci's donate page carries placeholder URLs that 404 rather than live links that take a real payment | PLAN_DIYA_GL_LAUNCH.md | human and machine | — | ready-to-start | the operator holds the test-mode key; the script does the rest |
| SB-2 | Confirm the GA4 e-commerce events `ecommerce-events.js` and `download-page.js` fire on a download and a donation, and that nothing was lost when the pages moved to `/diya-gl/`. Verification, with code changes only if it finds something | PLAN_DIYA_GL_LAUNCH.md | machine-only | H-SB-1a | blocked-to-start | needs real test-mode links before a donation can be driven |


## Plans not tracked here

- `PLAN_DIYACCOUNTING_BRAND.md`: the brand in three parts — one source for the marks and tokens,
  the trade mark filings, and what recovering `diyaccounting.com` would take.
- `PLAN_DIYA_GL_LAUNCH.md`: carries the launch posts, the Rust port, the operator's research, and
  now the two rows the uplift handed over — the domain registrations (H-LU-5, on the board) and the
  HMRC licence note (H-LU-9) — plus the donation sandbox and events, `SB-1` and `SB-2`.
- `PLAN_LTD_MARGINAL_RELIEF.md`: the three gaps in the Corporation Tax relief, on the board as
  `MR-1` to `MR-3`. MR-1 is the one a customer feels.
- `PLAN_ITSA_SE_DERIVATIONS.md`: its section 8 findings carry `SED-n` ids, the same ids the board
  uses. SED-1, 4, 5, 6 and 9 are closed there; SED-2, 3, 7, 8 and 10 are the open ones.
- `BRIEF_OPERATOR_TASKS_2026-09-10.md`: the two that need drafting rather than doing, written out
  with the addresses and the facts.
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
