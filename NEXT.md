<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

**COOL-DOWN is on since 2026-09-15T16:46:02Z.** No new board rows except a degradation. Agents commit
and stop. One branch is driven green at a time. Lifted only by the operator in their own words.

`main` is green on `5eb8a212` (CQ-44); prod serves it and the publish job landed diya-gl 1.2.17 as
`ecd5dafb`. `claude/b16-se`
(branch only) holds SET-10's superseded design scratch. No watch monitor is armed.

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
| CQ-48 | The router prints each tier's duration in its heartbeat and `VERDICT:` line (`scripts/test-scope.mjs`), so a slow tier is measurable: SET-9's pre-push browser tier took 42 min against 20 in the agent's run of the same diff, cause unmeasured | none | machine-only | — | ready-to-start | ~1 file | Haiku | from the 2026-09-15 session report |
| CQ-49 | The `do-next` brief carries the exact `rm` loop for the browser tier's untracked `LICENCE.txt`/`README.txt` byproducts and one background waiter per long run (`.claude/skills/do-next/SKILL.md`); the SET-9 agent ran `git clean -fd packages/` and three agents stopped ~12 times without a report | none | machine-only | — | ready-to-start | ~1 file | Haiku | docs-only, lands on `main` directly |
| CQ-45 | `--tree-hash` in `scripts/test-scope.mjs` ignores the `engineVersion` stamp line in `app/lib/provenance-data.js` (as it ignores docs), or the brief restamps before the final `npm test`: every row's restamp after its GREEN run cost a second routed run before the push (SET-10 33 min, SET-9 62, CQ-44 15) | none | machine-only | — | ready-to-start | ~2 files | Sonnet | 110 wall minutes per three rows |
| CQ-46 | The router stops after a failed gates tier instead of running unit, calc and browser behind it (`scripts/test-scope.mjs`, with a routing test): SET-10's and SET-9's first full runs each ran 35 min to report a prettier failure known at minute 2 | none | machine-only | — | ready-to-start | ~2 files | Sonnet | ~66 wall minutes per two RED runs |
| CQ-47 | `.githooks/pre-push` refuses a branch push whose diff against `main` touches `NEXT.md`, and `do-next` squashes against the fork point (`git merge-base`) rather than `main`: PR #117 opened `CONFLICTING` because the squash carried the fork's `NEXT.md`, 72 job-minutes on the abandoned head | none | machine-only | — | ready-to-start | ~2 files | Haiku | 72 job-minutes and ~45 wall minutes per conflict |
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
