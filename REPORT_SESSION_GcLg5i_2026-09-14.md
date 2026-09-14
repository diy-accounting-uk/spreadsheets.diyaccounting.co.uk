<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# Session report, 2026-09-14

Opus 5 (1M context) coordinator session, 2026-09-14 11:45 UTC to 18:29 UTC. Id `GcLg5i` is the
first six characters of the base64 SHA-256 of the session id.

**Result: 1 PR merged (#113), 4 board rows closed, 2 more code-complete on a held local branch,
prod serving `740b0470`, board current, cool-down on.** 16 non-merge commits carrying the session
id on `main` (4 on the PR, 12 docs-only); the PR is 8 hand-written files (+634/−241), no generated
output. `claude/b16-se` holds SET-12 and SET-8 (9 commits, 56 hand-written files +1665/−1088 plus
17 regenerated), local and unverified at its HEAD. Six rows remain open.

## Method

I use Claude Code as a coordinator. I write the plan and the rules into the repo, it dispatches
several agents in parallel on separate branches, merges what passes the tests, and I make the
decisions it can't: which rows go in a PR, when to cool down and what to hold back, what merges.
In this session that landed four pipeline improvements in one PR in three hours from dispatch to
merge, and two self-employed template fixes onto a held branch, for $120 of tokens at list rates.
I spend my time reviewing evidence and fixing the process when it wastes cycles, not writing code.
Today the pre-push GREEN marker became reliable, skipping its own batch's push, and my next areas to
develop are the cost of one long-context agent carrying four chained rows and the full-suite runs
a narrow change still triggers.

## What worked

| Efficiency | Measured | Mechanism |
| --- | --- | --- |
| Elapsed, dispatch to merge | 3h01m (11:57 to 14:57 UTC); PR open to merge 29 min | `/do-next` one wave, one branch; `/watch` monitor emitting `MERGEABLE`; `/auto-merge` on the event |
| Elapsed, docs rows | CQ-37 and CQ-35 landed 64 min after dispatch | Haiku on a two-file docs workstream; cherry-pick per item onto the batch |
| GitHub Actions | 130.6 job-minutes for 6 runs, public repo so $0 (private rate $1.04); 0 duplicate or superseded runs | `deploy.yml` `paths:` filter: 12 docs commits and the PR's tooling files fired no deploy |
| LLM cost, coordinator | $25.81 (31.4M cache-read, 1.14M cache-write, 120k output at list) | Coordinator wrote no code; sub-agents own the files; 103 tool calls over 6h44m |
| LLM cost, docs and router rows | $0.52 (Haiku, skills) and $12.14 (Sonnet, router) for 4 rows | Lowest tier that fits; the router row's brief carried the diagnosis and the `--plan` proof method |
| Operator input | 6 messages: 3 decisions, 1 command paste, 0 questions, 0 corrections | Board on `main` after every landing; the cool-down split instruction executed without a follow-up |
| Quality | CQ-34's marker skipped this batch's own pre-push (`tree 57cb254e passed GREEN … skipping the run`); CQ-36's false premise measured and recorded, not built on | Brief said "measure first with `--plan`"; the run-dirtied-tree defect found by the coordinator's full pass and folded into the row before push |

## Room for improvement

| Loss | Measured | Cause | Improvement |
| --- | --- | --- | --- |
| One Opus agent carried four chained SE rows | $81.29 for 2 of 4 rows landed, 341 messages at 299k average context; 1h52m; then held unverified | Four rows in one brief share `se.js`, both templates and the fixtures, so one agent took the chain and its context never reset | One agent per row, each fresh from the previous row's commit; at half the average context the same work is about $40 |
| The SE agent's first `npm test` was RED after 66 min | 66 min agent wall time, 8 failures, all stale figures in tests that hard-code fixture-derived numbers (`judge-reconciliation`, `report-depreciation-parity`, three unit files, `se-profit-forecast-checks`) | Tests carry literal figures that every SE fixture change moves | Derive those figures from the fixture at test time, as the reconciliation checks do; a fixture change then moves nothing but the report |
| Full `--all` pass on the batch before its first push | 36m39s local, then the routed run proved the amended tree in 27s | `do-next` requires `npm test -- --all` before the first push regardless of the diff | The router's routed run is the pre-push proof (the hook runs it anyway); `--all` only when the router escalates |
| `test` ran twice on one content | 55 min on the PR head, 57 min on the merge commit: 112 of 130 job-minutes; the trees differ in `.md` files only | `test.yml` runs the full suite on every push to `main` | A GREEN marker keyed by the tree hash of non-docs content, cached across runs, the CI form of CQ-34 |
| Background launch with the 10-minute Bash cap | 1 min: the first `--all` launch stopped and relaunched detached | The coordinator used `run_in_background` for a 36-minute command | The CQ-35 recipe (`nohup … & disown` plus a Monitor) is now in `do-next`; the coordinator reads it before a long run |
| Docs pushes each ran the router | 12 docs commits × ~21s gates = 4 min | Every push runs `test-scope.mjs`; docs route to gates only, and gates still take 20s | The pre-push hook exits before the router when the push's diff is all `.md` |

## Placement, September 2026

Scales are constructed: each anchor is a published figure from the last three months, and the
session's own figure sits beside it.

| Efficiency | Session | Anchor | Placement |
| --- | --- | --- | --- |
| PR cycle time, open to merge | 29 min | Elite median under 24h, best teams under 4h ([GitKraken, 2026](https://gitkraken.com/blog/healthy-pr-lifecycle-time-benchmarks-targets-2026)); median organisations 83h ([LinearB via byteiota, 8.1M PRs](https://byteiota.com/engineering-benchmarks-2026-8-1m-prs-reveal-productivity/)) | Inside the elite band; the coordinator merges on the monitor's event |
| LLM cost per merged PR | $38.47 (coordinator $25.81 plus the two agents on the PR $12.66); $119.76 for the whole session | Sonnet 4.6 on Claude Code $11.99 per mergeable PR, Opus 4.8 about $30 ([Insight, July 2026](https://blog.insight-services-apac.dev/2026/07/06/cost-to-a-merged-feature)) | Above the Opus anchor for a four-row PR; the held SE branch's $81 is the outlier |
| GitHub Actions per PR | 130.6 job-minutes, $0 on a public repo | No published per-PR anchor found this quarter; the previous report's 4 runs per PR head is the internal baseline | 6 runs, none duplicated; the two 55-minute `test` runs dominate |
| Operator input per PR | 6 messages, 0 corrections | No published anchor; the previous session's report is the baseline | Same shape as ytPIRn's: decisions and one paste |

## Suggested improvements, ranked by value

Dollar rows rank above minute rows because the session's tokens are the only cost the operator
pays directly; the minutes are agent and CI time that ran unattended.

1. One agent per SE row, fresh context from the previous row's commit: about $40 of the $81.29
   the chained agent cost. No board row covers it; a `do-next` rule for chained rows on shared
   files would.
2. Fixture-derived figures in `judge-reconciliation.test.js`, `report-depreciation-parity.test.js`,
   `se-profit-forecast-checks.test.js` and the three unit files: 66 min of agent time per SE
   fixture change. No board row.
3. A tree-hash-keyed GREEN cache in `test.yml`, so the merge commit reuses the PR head's run when
   only `.md` differs: 57 job-minutes per merge ($0.46 at the private rate). No board row.
4. `do-next`'s first-push rule reads "the router's routed run, `--all` only on escalation":
   36 min per batch. No board row.
5. `.githooks/pre-push` exits before the router on an all-`.md` push: 4 min per session of docs
   pushes. No board row.
6. The coordinator launches any command it has seen run long with the CQ-35 recipe: 1 min. Landed
   in `do-next` this session (CQ-35).
