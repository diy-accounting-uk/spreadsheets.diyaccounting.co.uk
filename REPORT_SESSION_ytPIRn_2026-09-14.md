<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# Session report, 2026-09-14

Opus 5 (1M context) coordinator session, 2026-09-13 21:00 UTC to 2026-09-14 02:20 UTC. Id `ytPIRn`
is the first six characters of the base64 SHA-256 of the session id.

**Result: 1 PR merged (#112), 11 board rows closed plus one pipeline fix, prod serving `63028313`,
board current, cool-down lifted.** 27 commits (12 on the PR, 15 docs-only on `main`); 52
hand-written files (+955/−738) plus 24 regenerated files (seven SE packages, `examples/se-latest`,
the SE parity and reconciliation fixtures, the lockfile at +532/−292). Six rows remain open.

## Method

I use Claude Code as a coordinator. I keep the plan, the board and the rules in the repository; the
session wakes the board, dispatches one agent per file-owning workstream on separate worktrees,
squashes each task onto one batch branch, runs the full suite once on the merged batch, and hands
the pull request to a watch that calls auto-merge when every check is green. I decide what it
cannot: the order of work, the design direction, and anything that deletes a branch, rewrites
pushed history or spends money. This session landed eleven rows in one PR in five hours: a template
defect in the SE return, a build-ready design for three SE book records, four CI and pipeline
efficiencies from the last session's report, the Dependabot alert, and the test-strategy cuts, for
roughly $14 of tokens at list price and 199 Actions minutes, down from 1,524. My next areas to
develop are the router's escalation on shared files, which still sent four agents through the full
suite, and the coordinator's own long-run plumbing on macOS, which lost an hour to a missing
`setsid`.

## What worked

| Efficiency | Measured | Mechanism |
| --- | --- | --- |
| Elapsed | 4h57m from first dispatch (21:11 UTC) to prod green (02:08 UTC) for 11 rows | One wave, seven agents at once, file-ownership boundaries in every brief; squash per task onto the batch as each report landed |
| LLM cost | 1.47M sub-agent tokens, ~$5.40 at list (Sonnet 944k, Opus 366k, Haiku 163k); main session estimated ~$8 | Tier per workstream: Opus only for the design wave, Haiku for the two one-file rows |
| GitHub Actions | 199 billable minutes over 11 runs (b14: 1,524 over 36) | CQ-29 landed in the batch: one trigger per branch, so the PR's runs fired once per head; one PR, not three |
| AWS | 4 deploys (2 ci, 2 prod, in-place stacks), 1 judge call on the ci reconciliation | The batch shares one deploy per head; no per-branch sets in this account |
| Operator input | 7 messages: 3 skill invocations, 1 instruction, 2 guidance changes, 1 question; 0 pastes of blocked commands, 0 corrections (b14: 22, 6 pastes) | Board rows carried the whole brief; AWS reads taken at 21:00 UTC while the token was fresh (CQ-33); blocked commands collected into one block at the end |
| Quality | Coordinator's full pass GREEN in 51m22s; PR checks green first time on the settled head; box 73 kept out of SET-11 as SET-12 with the measured ripple (+90 taxable, +40.50 tax) | `npm test -- --all` once on the merged tree; the brief's "stop and report the blast radius" instruction |
| Recovery | Repository re-initialised as bare by a test under the hook, recovered in 12 minutes with no lost commit | Reflog plus `git branch --contains`; the fix (hook scrubs `GIT_*`) landed on the same PR, proven with `GIT_DIR=/nonexistent` |

## Room for improvement

| Loss | Measured | Cause | Row |
| --- | --- | --- | --- |
| Four agents ran the full suite | 63–67 minutes each, load 45, ~4 agent-hours wall | The router escalates on `package.json`, `scripts/test-scope.mjs`, `CLAUDE.md` and `.claude/**` by routing table, so CQ-30's "real branch" rule did not reach these rows | CQ-36 |
| The pre-push hook re-ran the suite after the coordinator's full pass | 10 minutes before it was stopped, then the `GIT_DIR` incident | The hook has no memory of a green pass on the same tree; `SKIP_PUSH_TESTS=1` is a hand-typed opt-out | CQ-34 |
| Full pass launched with `setsid`, which macOS lacks | 60 minutes waiting on a monitor over an empty log | No documented launch-and-monitor snippet for a long local run on this host; the watch script also broke on zsh word-splitting for one cycle | CQ-35 |
| PR conflicted with `main` on a skill doc | 1 rebase, 1 extra deploy (9 min), 15 minutes elapsed, the PR's checks did not fire until the rebase | Another session edited `.claude/skills/do-next/SKILL.md` on `main` while CQ-33 edited it on the batch | CQ-37 |
| Test identity written into the repo config | 1 failed identity-guard run, 1 cancelled test run (36 min), 1 extra head; `e0f57538b` on `main` authored `Test` | The same `GIT_DIR` leak; the archive-packages test's `git config user.name` hit the real repository | fixed in #112 (`743ddb37`); the `main` commit is the operator's call |
| Deployments unverified at the closing board | SSO token expired 5h after login | Session ran past the refresh window | none: CQ-33's guidance (reads early) held; the closing check is the only reader after expiry |

## Placement, September 2026

Scales are constructed from the cited anchors; the anchors are the first result of a search dated
within three months.

| Efficiency | This session | Anchor | Position |
| --- | --- | --- | --- |
| LLM cost per merged feature | ~$14 for 11 rows, ~$1.30 per row, estimated | $7–$70 per merged feature across a dozen agents ([Insight, 2026-07-06](https://blog.insight-services-apac.dev/2026/07/06/cost-to-a-merged-feature)); $0.27–$3.25 per PR realistic range ([Ganglani, 2026](https://www.kunalganglani.com/blog/ai-agent-cost-per-task-2026)) | below the low end per row; the batching amortises the coordinator |
| Tokens per task | 79k–366k per agent, 1.47M for eleven | 1–3.5M per agentic task including retries ([Vantage, 2026](https://www.vantage.sh/blog/agentic-coding-costs)) | a tenth of the anchor per task |
| Actions minutes | 199 for one PR and one merge | own prior session: 1,524 for three PRs | 7.7x less, most of it CQ-29 |
| Operator input | 7 messages, 0 pastes | own prior session: 22, 6 pastes | the pastes went to zero |
| List rates used | Opus 5 $5/$25, Sonnet 5 $2/$10, Haiku 4.5 $1/$5 per million, cache reads at 10% ([Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)) | | subscription marginal cost $0 |

Main-session cost is an estimate: ~120 turns at ~100k cached context ($0.50/M cache read) plus
~60k output tokens at $25/M and ~150k uncached input at $5/M, about $8.

## Recommended optimisations, on the board

- CQ-34: the pre-push hook skips the routed run when a green verdict is recorded for HEAD's tree.
- CQ-35: a documented launch-and-monitor snippet for long local runs on macOS.
- CQ-36: the router's escalation for shared files narrows to the tiers those files reach.
- CQ-37: docs-only rows (skills, `CLAUDE.md`, plans) land on `main` directly, not on the batch.
