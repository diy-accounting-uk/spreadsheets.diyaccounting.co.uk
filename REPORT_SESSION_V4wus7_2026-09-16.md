<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# Session report, 2026-09-16

Opus 5 (1M context) coordinator session, 2026-09-15 about 17:25 UTC (estimated: the first tool call
preceded the wake commit at 17:32 UTC by one board render) to 23:22 UTC, idle since. Id `V4wus7` is
the first six characters of the base64 SHA-256 of `session_01Qtv6emWazdgr3q7VbXnL8k`.

**Result: 1 PR merged (#121, batch 18), 6 board rows closed (CQ-45, CQ-46, CQ-47, CQ-48, CQ-49,
SET-7), 3 plans archived, prod serving `af41a87a`, board down to one operator row.** 19 commits on
`main` since `d288781e` (9 on the PR, 8 docs-only board and archive commits, 1 bot publish of
diya-gl 1.2.18); 55 hand-written files, +1,358/−317 lines; 16 generated files (the SE packages,
`examples/se-latest`, parity fixtures, reconciliation reports and page).

## Method

I use Claude Code as a coordinator. I write the plan and the rules into the repo, it dispatches
agents in parallel on separate worktrees, squashes what passes onto one batch branch, and I make
the decisions it can't: which rows go in the batch, what gets archived, anything that deletes or
spends. In this session that landed the SE basis period record (SA103F boxes 68, 69 and 73.3) and
five test-router fixes in one PR, six hours from wake to prod, for roughly $15 of tokens. I spend
my time reading the board and pasting the four commands the session is not allowed to run, not
reading code. This session the GREEN marker became restamp-proof, so a push after a proven run
costs nothing, and my next area to develop is the routed run itself: the merged tree re-ran a
36-minute browser tier whose inputs had not changed since the agent's own run.

## What worked

| Efficiency | Measured | Mechanism |
| --- | --- | --- |
| Elapsed | 5h45m from the first dispatch (17:37 UTC) to prod green (23:20 UTC); PR open to merge 39 min | One batch branch, three worktrees dispatched in one wave; `/watch`'s `MERGEABLE` probe handed straight to `/auto-merge`; `main`'s `test` run reused the PR's GREEN record (all 13 jobs skipped, 0 job-minutes) |
| LLM cost | 1.19M sub-agent tokens for six rows (SET-7 890k on Sonnet, the router's four rows 216k on Sonnet, the skill's two rows 87k on Haiku), $3–11 at list depending on the input/output split, estimated; main session estimated ~$9 | Rows sharing a file went to one agent (the router's three plus the hook half of CQ-47; the skill's two); tier by row, Haiku for the docs pair |
| Actions minutes | 90 job-minutes over 7 runs: 66 for the PR's `test`, 8 + 8 for the ci and prod deploys, 8 for two codeql runs, 0 for `main`'s `test` and identity-guard | The green-check job's `--code-tree-hash` matched the PR head's record on the merge commit; no duplicate deploy on one head; CQ-47's hook kept `NEXT.md` off the branch so the PR opened `CLEAN` |
| Operator input | 15 messages: 7 skill invocations, 3 questions, 3 instructions, 2 pastes (worktree removals), 0 corrections | Every operator-only command printed once at the pause with `!`; the two archive instructions folded into the merge's board commit |
| Quality | 1 of 1 PR merged on its first CI run; 0 red CI runs; 8 real gaps caught locally (SET-7's first routed run) before the push; CQ-45 proven live on its own push (marker `444b164b` matched after the restamp commit, the hook skipped the run) | `npm test` as the only named command in every brief; the merged tree got its own routed run before the first push |
| AWS | 2 deploys (1 ci on the branch push, 1 prod on the merge), both in place on the two static stacks; 1 Bedrock judge call (Amazon Nova) in the prod deploy, 2 minutes | `deploy.yml` on push; the judge runs inside the deploy, once |

Rates used: Opus 5 $5/$25, Sonnet 5 $2/$10, Haiku 4.5 $1/$5 per million, cache reads at 10%
([Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)); the subscription's
marginal cost is $0. The repository is public, so Actions bill nothing; at the private Linux rate
of $0.006/min the 90 job-minutes would be $0.54. Main-session cost is an estimate: ~90 turns at
~150k cached context ($0.50/M cache read) plus ~40k output tokens at $25/M and ~200k uncached
input at $5/M.

## Room for improvement

| Loss | Size | Cause | Improvement |
| --- | --- | --- | --- |
| The merged tree's routed run repeated the browser tier | 36 min wall (37m32s run, browser 31m22s of it, on a tree whose `web/` and product inputs were identical to the SET-7 agent's GREEN run) | The GREEN marker is one key for the whole tree; the router and skill changes invalidated it, so every tier ran again | Key the marker per tier on the tier's own input closure, so an unchanged tier's earlier GREEN vouches and only the router's own unit tier re-runs |
| SET-7's first routed run went RED after 35 min | ~30 min wall (unit 6 failures and calc 2 at minute 6; the browser tier ran 29 min behind them before `VERDICT: RED`) | CQ-46 stops the run after a failed gates tier only; unit and calc failures still let browser and infra run to completion | Extend CQ-46 to stop after any failed tier by default (`--keep-going` to opt out); the one-run-reports-everything case is the opt-out, not the default |
| Four worktree removals refused to the session | 4 operator pastes (2 done, 2 still pending), 4 turns of the operator's | The auto-mode classifier reads `git worktree remove` as irreversible destruction, however clean the tree | An allow rule scoped to `git worktree remove ../.worktrees/spreadsheets/*` in `.claude/settings.local.json`, the operator's call; until then, one fenced block per wave, as now |
| SET-7's size estimate | ~12 files on the row, 53 in the commit; 890k tokens, 661 tool uses, 4h15m for one Sonnet agent | The row's `Size` came from the plan's prose, not from counting its design table's rows (14 rows, each a file or more) | Take `Size` from the design table's row count when a plan has one; a 50-file row is two agents in a chain (schema+template, then checks+regeneration) per the chain rule |
| The last board render's deployments part went unverified | 1 render's Part 3 from the previous render's figures | SSO token expired at about 05:00 UTC after 12 hours | Take the AWS reads at the start of every render, as now, and print the login command inline; no other remedy is the session's |

## Placement, September 2026

Scales are constructed from the cited anchors; the anchors are the first result of a search dated
within three months.

| Efficiency | This session | Anchor | Position |
| --- | --- | --- | --- |
| LLM cost per merged PR | $12–20 for one PR of 62 files carrying six rows, estimated | $1.60–2.60 per task, $0.03–2.60 across tools ([Kunal Ganglani, 2026](https://www.kunalganglani.com/blog/ai-agent-cost-per-task-2026)); $35.20 per coding day at the 90th percentile of spend ([DX, 2026](https://getdx.com/blog/ai-coding-assistant-pricing/)) | $2–3.30 per row, inside the per-task anchor; under half the 90th-percentile day |
| Tokens per task | 87k, 216k and 890k per agent; 1.19M for six rows | 400k–2M cumulative input tokens per task ([Kunal Ganglani, 2026](https://www.kunalganglani.com/blog/ai-agent-cost-per-task-2026)) | the two small agents below the range, SET-7 at its lower third |
| Merge rate | 1 of 1 PR merged, first CI run | 79% of autonomous-agent PRs merged within 30 days ([LinearB, 2026](https://linearb.io/resources/ai-engineering-productivity-gap)) | above the anchor |
| Actions minutes | 90 for one PR and one merge | own prior sessions: 153 per PR (2026-09-15), 199 (2026-09-14) | 41% less than yesterday's per-PR figure |
| Operator input | 15 messages, 2 pastes, 0 corrections | own prior session: 6 messages, 1 paste, 0 corrections | more messages, all questions and instructions; the pastes doubled with the worktree count |

## Suggested improvements

Ranked by the wall minutes each removes; the operator-message item ranks last because a paste
costs seconds where a tier costs half an hour.

1. Per-tier GREEN markers keyed on each tier's input closure: removes 36 wall minutes per batch
   whose merged tree differs from the agents' runs only outside a tier's inputs. No board row.
2. The router stops after any failed tier by default: removes ~30 wall minutes per RED run that
   fails in unit or calc. Extends CQ-46; no board row.
3. `Size` from the design table's row count, and a two-agent chain for any row over ~25 files:
   removes an unmeasured share of SET-7's 4h15m (the prior chain measurement was about $40 per
   chained batch). No board row.
4. An allow rule for `git worktree remove` under `../.worktrees/spreadsheets/`: removes 2–4
   operator pastes per batch. The operator's call; no board row.
