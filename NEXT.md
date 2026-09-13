<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Batch `claude/b15-board` (worktree `../.worktrees/spreadsheets/b15`), one wave of seven agents,
one PR: CQ-30, CQ-32, CQ-33 (`b15-skills`);   TS-2, TS-1 (`b15-tests`); CQ-28 (`b15-cq28`); SET-11 (`b15-set11`). Sub-agent
worktrees live under `../.worktrees/spreadsheets/<name>` on `claude/<name>`. Cool-down lifted by
the operator 2026-09-13; nothing else is open.

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
| CQ-30 | Each b14 agent ran the full router (~45 min, LibreOffice and Playwright) in its own worktree, four at once, driving load to 32–80, timing out unrelated tests and costing ~4h of the batch. The brief's `npm test` line stays, but `do-next` says: an agent verifies with `npm test` on its own diff only (the router already scopes to the diff against `origin/main`; the escalation to the full set on a shallow or detached tree is what bit), and the coordinator runs the one full pass on the merged batch | none | machine-only | — | in-flight | ~2 files | Sonnet | `b15-skills` on `claude/b15-board` |
| CQ-32 | An agent's `pkill -f vitest` killed a sibling agent's router run (2026-09-13 13:57) and agents spent up to an hour in `sleep 30` poll loops waiting for their own runs. Briefs forbid `pkill`; each worktree's long runs get their own process group (`setsid`/a named session) so a stop targets one worktree; agents wait with a background task notification, not a loop | none | machine-only | — | in-flight | ~3 files | Sonnet | `b15-skills` on `claude/b15-board` |
| TS-2 | `PLAN_TEST_STRATEGY.md` section 9 step 3 names `scripts/blast-radius.mjs` and `npm run blast-radius`; neither exists, the logic lives inside `scripts/test-scope.mjs`. Expose it as a thin wrapper that prints the routed file set and tiers for a diff without running anything (the router's `--plan` already does most of this), or strike the step from the plan | PLAN_TEST_STRATEGY.md | machine-only | — | in-flight | ~2 files | Sonnet | `b15-tests` on `claude/b15-board` |
| CQ-28 | Dependabot #83: `extract-zip` ≤2.0.1 (GHSA-7pqw-9j4j-h8q3, symlink write), dev-only, reached through `@axe-core/cli` → `chromedriver@147` and `pa11y-ci` → `puppeteer@24` → `@puppeteer/browsers@2.13`. No patched `extract-zip` exists; both upstreams have already left it: `chromedriver@153` unzips with `adm-zip`, `@puppeteer/browsers@3.2.2` with `modern-tar`. Refresh the lockfile so `chromedriver` resolves to 153 (`@axe-core/cli` pins `latest`) and add a `package.json` `overrides` entry for `@puppeteer/browsers` at `^3.2.2` (or move `pa11y-ci` to a release that carries it) so the alert closes on its own | none | machine-only | — | in-flight | ~2 files | Haiku | `b15-cq28` on `claude/b15-board` |
| CQ-33 | Six of the session's 22 operator messages were pastes of commands the session could not run: an SSO refresh (2FA on the refresh path), `git branch -D`, `git push --delete`, a Stripe test key. These stay the operator's: they spend money or delete things. Weave into the guidance how to handle them efficiently — size a batch to fit inside the SSO window and take AWS reads early; collect every classifier-blocked command into one block presented once at a natural pause, `!`-prefixed, rather than one paste per occurrence; never pre-authorise them | none | machine-only | — | in-flight | ~3 files | Sonnet | `b15-skills` on `claude/b15-board` |
| SET-11 | Template defect: `SE Full!D219` (box 77) is `O179+E197+D210+P190`, adding box 71 to the loss and reading the blank cells beside the box 68 and 72 dashes (`E197`, `P190`) rather than their printed cells; the engine models the sheet as it is and a warning carries the true figure. Fix the formula on the template, flip the engine assertion and the warning check to the corrected sum, prove it breakable | PLAN_SE_TEMPLATE_GAPS.md | machine-only | — | in-flight | ~4 files | Sonnet | `b15-set11` on `claude/b15-board` |
| TS-1 | `PLAN_TEST_STRATEGY.md` section 9 steps 6 and 7: make the section 5 cuts (`verify-stability.test.js`, `bst-precision-code-reconciliation.test.js`, the export-tuple block of `verify-roundtrip.test.js`, `se-workbook.test.js`'s final `describeCalc`, the five band sweeps trimmed to the taper boundary plus a neighbour) and add the stale-declaration check for `render-unrepresentable/<product>.json` so a declared key that is now rendered fails; then one full `npm test` against section 8's target | PLAN_TEST_STRATEGY.md | machine-only | — | in-flight | ~7 files | Sonnet | `b15-tests` on `claude/b15-board` |
| SET-10 | The small-pools write-off (`SE Full!O144`, box 55) sums `Fixedassets.xlsx!Schedule` `R1+S1` over one S column, so a special-rate balance counts towards the £1,000 test alongside the main pool; HMRC applies the test per pool. Split S into a main-pool and a special-rate written-down column, point O144 and the calculator's small-pools check at each, and anchor the check on the fixture's estate car (tax WDV 9,000, special) | PLAN_SE_TEMPLATE_GAPS.md | machine-only | — | ready-to-start | ~6 files | Sonnet | template + calculator + breakable check |
| SET-8 | Boxes 50 and 51 single-asset pools: a marker column on `Fixedassets.xlsx!Schedule` asset rows plus its book field, `buildSchedule` keeping each marked row its own pool, `capitalAllowanceSingleAssetPool` filed; the Ltd package shares the register, so its schedule and checks move too | PLAN_SE_TEMPLATE_GAPS.md | machine-only | — | ready-to-start | ~10 files | Sonnet | from the 3.4 design; Ltd blast radius |
| SET-9 | Boxes 53 and 53.1 Structures and Buildings Allowance: a claim record (dates, rate, amount, an array), the derivation filing the array, box 53's cell carrying the total, 53.1's label-and-value row pair laid out afresh between `SE Full` rows 146 and 161 | PLAN_SE_TEMPLATE_GAPS.md | machine-only | — | ready-to-start | ~10 files | Sonnet | from the 3.4 design; statutory-form relayout |
| SET-7 | Box 68 basis adjustment and box 73.3 transition profit: a book-level overlap-profit record (brought forward, used, carried across tax years), the derivation filing both from it for a non-6-April year end, 73.3's cell in row 199's slot (`D201:F201`) once the boxes 69/70 notice moves, the box 77 formula (`D219`) reading the real cells | PLAN_SE_TEMPLATE_GAPS.md | machine-only | — | ready-to-start | ~12 files | Sonnet | from the 3.4 design |
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
