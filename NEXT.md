<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

**COOL-DOWN is on since 2026-09-13T19:41:41Z.** No new board rows except a degradation. Agents commit
and stop. One branch is driven green at a time. Lifted only by the operator in their own words.

Main is `d1a68377`: PR #111 (`claude/b14-board`) merged with CQ-20, CQ-21, CQ-25, SET-4, SET-5 and
SB-2, the Ltd and SE packages regenerated on the branch, and the parity fixtures refreshed. The
prod deploy of that merge is the next thing to read.

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
| CQ-28 | Dependabot #83: `extract-zip` ≤2.0.1 (GHSA-7pqw-9j4j-h8q3, symlink write), dev-only, reached through `@axe-core/cli` → `chromedriver@147` and `pa11y-ci` → `puppeteer@24` → `@puppeteer/browsers@2.13`. No patched `extract-zip` exists; both upstreams have already left it: `chromedriver@153` unzips with `adm-zip`, `@puppeteer/browsers@3.2.2` with `modern-tar`. Refresh the lockfile so `chromedriver` resolves to 153 (`@axe-core/cli` pins `latest`) and add a `package.json` `overrides` entry for `@puppeteer/browsers` at `^3.2.2` (or move `pa11y-ci` to a release that carries it) so the alert closes on its own | none | machine-only | — | ready-to-start | lockfile plus one override; run the accessibility scripts once to prove the drivers still launch; Haiku |
| CQ-29 | `test.yml` and `codeql.yml` run twice per branch push (push and pull_request events) and on every docs-only board commit to main: 17 `test` runs and 19 `codeql` runs for three PRs on 2026-09-13, 1,524 billable job-minutes. Dedupe to one trigger per branch (pull_request for branches, push for main) and add `paths-ignore: ['**.md']` to `test`, `codeql` and `identity-guard`; the router's `TEST_SCOPE_TIERS` already lets a job run gates alone | none | machine-only | — | ready-to-start | workflow YAML; strict-parse before push; Haiku |
| CQ-30 | Each b14 agent ran the full router (~45 min, LibreOffice and Playwright) in its own worktree, four at once, driving load to 32–80, timing out unrelated tests and costing ~4h of the batch. The brief's `npm test` line stays, but `do-next` says: an agent verifies with `npm test` on its own diff only (the router already scopes to the diff against `origin/main`; the escalation to the full set on a shallow or detached tree is what bit), and the coordinator runs the one full pass on the merged batch | none | machine-only | — | ready-to-start | `.claude/skills/do-next/SKILL.md` and the brief template; Sonnet |
| CQ-31 | `generate-ltd`/`generate-se` run the unit tests before the generate job, so a template change that makes the committed packages stale fails the tests that the regeneration would fix, and the operator has to re-dispatch with `skip-tests`. Order the workflow so the generate job runs first and the test job runs against its fresh output, or have the test job read the freshly generated packages from the artifact | none | machine-only | — | ready-to-start | two workflow files; Sonnet |
| CQ-32 | An agent's `pkill -f vitest` killed a sibling agent's router run (2026-09-13 13:57) and agents spent up to an hour in `sleep 30` poll loops waiting for their own runs. Briefs forbid `pkill`; each worktree's long runs get their own process group (`setsid`/a named session) so a stop targets one worktree; agents wait with a background task notification, not a loop | none | machine-only | — | ready-to-start | `do-next` brief template plus `scripts/test-scope.mjs` process handling; Sonnet |
| CQ-33 | Six of the session's 22 operator messages were pastes of commands the session could not run: an SSO refresh (2FA on the refresh path), `git branch -D`, `git push --delete`, a Stripe test key. These stay the operator's: they spend money or delete things. Weave into the guidance how to handle them efficiently — size a batch to fit inside the SSO window and take AWS reads early; collect every classifier-blocked command into one block presented once at a natural pause, `!`-prefixed, rather than one paste per occurrence; never pre-authorise them | none | machine-only | — | ready-to-start | `CLAUDE.md` and the `do-next`/`board` skills; Sonnet |

## Plans not tracked here

- `PLAN_DIYACCOUNTING_BRAND.md`: the brand in three parts — one source for the marks and tokens,
  the trade mark filings, and what recovering `diyaccounting.com` would take.
- `PLAN_DIYA_GL_LAUNCH.md`: carries the launch posts, the Rust port, the operator's research, and
  now the two rows the uplift handed over — the domain registrations (H-LU-5, on the board) and the
  HMRC licence note (H-LU-9) — plus the donation sandbox and events, `SB-1` and `SB-2`.
- `PLAN_LTD_MARGINAL_RELIEF.md`: describes the relief as built; no open item.
- `PLAN_ITSA_SE_DERIVATIONS.md`: its section 8 findings carry `SED-n` ids. SED-7 and SED-8 are the
  open ones, carried by `SET-4` and `SET-5`; SED-10 is Submit's.
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
