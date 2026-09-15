<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

SET-9 on `claude/set-9-sba` (worktree `set-9`), six commits to `6eda986c`, the routed run before the push
in progress; no PR yet. `main` is green on
`978781fb` (SET-10); prod serves it and the publish job landed diya-gl 1.2.15 as `034d3838`. `claude/b16-se` (branch only) holds SET-10's superseded design scratch. No
watch monitor is armed.

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
| SET-9 | Boxes 53 and 53.1 Structures and Buildings Allowance: a claim record (dates, rate, amount, an array), the derivation filing the array, box 53's cell carrying the total, 53.1's label-and-value row pair laid out afresh between `SE Full` rows 146 and 161 | PLAN_SE_TEMPLATE_GAPS.md | machine-only | — | in-flight | ~10 files | Sonnet | `claude/set-9-sba` at `6eda986c`, pre-push run; PR to follow |
| SET-7 | Box 68 basis adjustment and box 73.3 transition profit: a book-level overlap-profit record (brought forward, used, carried across tax years), the derivation filing both from it for a non-6-April year end, 73.3's cell in row 199's slot (`D201:F201`) once the boxes 69/70 notice moves, the box 77 formula (`D219`) reading the real cells | PLAN_SE_TEMPLATE_GAPS.md | machine-only | — | ready-to-start | ~12 files | Sonnet | SET-12 landed `c692a372`; shares `O194` |
| H-LU-9 | One paragraph to `SDSTeam@hmrc.gov.uk`: the licence changed on 2026-09-09 from AGPL-3.0 to free-to-use with source under PolyForm Internal Use 1.0.0 (plus the accountants' grant); the `Gov-Vendor-License-IDs` header, the service, its price and its API calls are unchanged. Facts and the two source documents are in `BRIEF_OPERATOR_TASKS_2026-09-10.md`; its gate, Submit's relabel (LU-8a), landed 2026-09-09 | PLAN_DIYA_GL_LAUNCH.md | human-only | — | ready-to-start | — | operator | operator sends the email; the draft is in the brief |

## Plans not tracked here

- `PLAN_DIYACCOUNTING_BRAND.md`: the brand in three parts — one source for the marks and tokens,
  the trade mark filings, and what recovering `diyaccounting.com` would take.
- `PLAN_DIYA_GL_LAUNCH.md`: carries the launch posts (LP-10), the Rust port (LP-12 to LP-14), the
  Filing phase as a Submit dependency (LP-19, LP-20), the HMRC licence note (H-LU-9, on the board)
  and SB-1's last task (SB-3, on the board).
- `PLAN_ITSA_SE_DERIVATIONS.md`: its section 8 findings carry `SED-n` ids. SED-7 and SED-8's
  remainder (boxes 68, 73.3, 50/51, 53/53.1) is `SET-6` to `SET-9`; SED-10 is Submit's.
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
