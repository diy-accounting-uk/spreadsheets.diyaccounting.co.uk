<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Cool-down lifted 2026-09-14 by the operator's instruction: CQ-38, CQ-41, CQ-42, CQ-40 and CQ-39 on
one branch and one PR, then SET-12 and SET-8 each on a branch over `main` once that PR merges.

`claude/b17-cq` (worktree `b17-cq`) carries the five CQ rows; CQ-38, CQ-41 and CQ-42 landed
(`09dd84c8`, `6d20002f`, `70fedc39`), CQ-40 and CQ-39 are with their agents (worktrees
`cq-40-green-cache`, `cq-39-se-literals`). Not yet pushed; no PR. `claude/b16-se` (worktree
`b16-se`) holds SET-12 and SET-8, nine commits on `main` `8c065650`, local; it splits into two
branches over `main` after `claude/b17-cq` merges. No watch monitor is armed. Prod serves `740b0470`.

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
| SET-12 | Template defect: `SE Full!O194` (box 73, adjusted profit) is `=O174`, box 64 alone; HMRC's working sheet adds boxes 68, 71 and 72. Fix the formula, the engine (`app/lib/calculators/se.js:1178`), turn the box 73 warning check into a hard check, and refresh the SE fixtures: on the advanced scenario box 73 and box 76 move +90 and income tax +40.50, so `se-full-return-checks.test.js`, the SE report, `examples/se-latest` and the SE parity fixture all move | PLAN_SE_TEMPLATE_GAPS.md | machine-only | — | in-flight | ~8 files | Opus | on `claude/b16-se` (`879793e9`..`365f7933`); own branch over `main` after `claude/b17-cq` merges |
| SET-8 | Boxes 50 and 51 single-asset pools: a marker column on `Fixedassets.xlsx!Schedule` asset rows plus its book field, `buildSchedule` keeping each marked row its own pool, `capitalAllowanceSingleAssetPool` filed; the Ltd package shares the register, so its schedule and checks move too | PLAN_SE_TEMPLATE_GAPS.md | machine-only | — | in-flight | ~10 files | Opus | on `claude/b16-se` (`d40c79b4`..`7f9858da`); own branch over `main` after SET-12 |
| CQ-38 | The b16 SE agent carried four chained rows in one brief and cost $81.29 for two of them, 341 messages at 299k average context (session GcLg5i). `do-next` says: rows that share files and land in series get one agent each, dispatched fresh from the previous row's commit on the batch, never one agent for the chain | none | machine-only | — | in-flight | ~1 file | Haiku | landed on `claude/b17-cq` `09dd84c8`; PR pending |
| CQ-41 | `do-next` requires `npm test -- --all` before a batch's first push (36m39s on b16) when the router's routed run is what the pre-push hook runs and what proved the amended tree in 27s. The rule becomes: the routed run is the first-push proof; `--all` only when the router escalates | none | machine-only | — | in-flight | ~1 file | Haiku | landed on `claude/b17-cq` `6d20002f`; PR pending |
| CQ-42 | Twelve docs-only pushes to `main` each ran the router's gates tier (~21s, 4 min in session GcLg5i). `.githooks/pre-push` exits before the router when every path the push adds is `.md`, and says so | none | machine-only | — | in-flight | ~1 file | Haiku | landed on `claude/b17-cq` `70fedc39`; PR pending |
| CQ-40 | PR #113's `test` ran 55 min on the head and 57 min again on the merge commit, whose tree differs in `.md` files only (112 of 130 job-minutes). `test.yml` keys a GREEN cache entry by the tree hash of the non-`.md` content (the router's `--tree-hash` over a filtered index) and reuses the PR head's run on the merge commit; a miss runs as today | none | machine-only | — | in-flight | ~2 files | Sonnet | agent on `claude/cq-40-green-cache`, worktree `cq-40-green-cache` |
| CQ-39 | The SE agent's first `npm test` was RED after 66 min on eight stale literals: `judge-reconciliation.test.js`, `report-depreciation-parity.test.js`, `se-profit-forecast-checks.test.js`, `diya-gl-shell-money-format.test.js`, `se-warning-checks.test.js` and `se-full-return-checks.test.js` hard-code figures every SE fixture change moves. Derive them from the fixture at test time, as the reconciliation checks do, so a fixture change moves the report and nothing else | none | machine-only | — | in-flight | ~6 files | Sonnet | agent on `claude/cq-39-se-literals`, worktree `cq-39-se-literals` |
| H-LU-9 | One paragraph to `SDSTeam@hmrc.gov.uk`: the licence changed on 2026-09-09 from AGPL-3.0 to free-to-use with source under PolyForm Internal Use 1.0.0 (plus the accountants' grant); the `Gov-Vendor-License-IDs` header, the service, its price and its API calls are unchanged. Facts and the two source documents are in `BRIEF_OPERATOR_TASKS_2026-09-10.md`; its gate, Submit's relabel (LU-8a), landed 2026-09-09 | PLAN_DIYA_GL_LAUNCH.md | human-only | — | ready-to-start | — | operator | operator sends the email; the draft is in the brief |
| SET-10 | The small-pools write-off (`SE Full!O144`, box 55) sums `Fixedassets.xlsx!Schedule` `R1+S1` over one S column, so a special-rate balance counts towards the £1,000 test alongside the main pool; HMRC applies the test per pool. Split S into a main-pool and a special-rate written-down column, point O144 and the calculator's small-pools check at each, and anchor the check on the fixture's estate car (tax WDV 9,000, special) | PLAN_SE_TEMPLATE_GAPS.md | machine-only | SET-8 | blocked-to-start | ~6 files | Sonnet | design scratch on `claude/b16-se` `9cca0ceb`: columns AH/AI after AG |
| SET-9 | Boxes 53 and 53.1 Structures and Buildings Allowance: a claim record (dates, rate, amount, an array), the derivation filing the array, box 53's cell carrying the total, 53.1's label-and-value row pair laid out afresh between `SE Full` rows 146 and 161 | PLAN_SE_TEMPLATE_GAPS.md | machine-only | SET-8 | blocked-to-start | ~10 files | Sonnet | from the 3.4 design; lands on the Schedule SET-8 widened |
| SET-7 | Box 68 basis adjustment and box 73.3 transition profit: a book-level overlap-profit record (brought forward, used, carried across tax years), the derivation filing both from it for a non-6-April year end, 73.3's cell in row 199's slot (`D201:F201`) once the boxes 69/70 notice moves, the box 77 formula (`D219`) reading the real cells | PLAN_SE_TEMPLATE_GAPS.md | machine-only | SET-12 | blocked-to-start | ~12 files | Sonnet | from the 3.4 design; shares `O194` with SET-12 |

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
