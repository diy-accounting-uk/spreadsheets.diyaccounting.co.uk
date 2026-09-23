<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# Session report dn+mHL, 2026-09-23

Session `session_01PHiTeU19fb58Kx66kqYA3F`, 2026-09-22 15:50 UTC to 2026-09-23 10:10 UTC, the
active delivery cycle 15:50 to 21:10 UTC on the 22nd.

## Result

3 PRs merged (#132, #134, #135) plus the other session's #133 merged through this one's
auto-merge; 10 board rows closed (CQ-50 to CQ-56, LP-24, LP-24b, PU-8); 41 commits, 22 of them
`NEXT.md` board write-backs; 2,082 hand-written lines across 33 files in the three PRs, 171 lines
of design and skill prose direct to main, no generated package output; prod serves `05c887750`
(the 35-day sandbox, the £39 offer, the Google Drive store, the router's guard and tree hash,
the resident-tier smoke test); the board has 0 rows in flight, 0 machine-only rows startable,
2 operator rows (LP-24a, LP-25a) and 1 blocked (LP-25b).

## Method

I use Claude Code as a coordinator. I keep the plan and the working rules in the repository; the
session reads the board, dispatches one agent per row on its own worktree, lands what passes the
routed test run, opens the PRs, watches CI and merges through the auto-merge gates; I make the
calls it cannot: which design, what merges when it hesitates, anything that deletes or spends. In
this session that landed seven process rows, the Google Drive store for the books and the
35-day sandbox pricing on prod in five hours and twenty minutes, for an estimated $36 of tokens
and 674 GitHub Actions job-minutes on a public repository. I spent my messages on the board's
shape and one dependency the session had invented, and on removing worktrees. The routed test
router became stricter this session (it refuses to start beside a live suite and keys its GREEN
marker by source only); my next areas are the local machine's test contention between agents
and sessions, and the branch that forks before the fix it needs has merged.

## What worked

| Efficiency | Measured | Mechanism |
| --- | --- | --- |
| Elapsed, dispatch to prod | 73 min for wave b26 (dispatch 16:05 UTC, prod last-known-good 17:18 UTC) | three agents on separate worktrees, cherry-picked per row onto one batch, one routed run, one PR, the watch monitor's MERGEABLE event driving auto-merge |
| Elapsed, red-to-fixed on prod | the smoke test red since the 12:36 UTC scheduled deploy was green on prod at 17:18 UTC, 5h from the board that opened CQ-56 | the board's GitHub scan reads the failed run's own log; the row carries run id and line |
| LLM cost | 1,292,423 sub-agent tokens, estimated $6; main session estimated $30 (see LLM below) | Haiku for the four guidance rows, Sonnet for every build, Opus for one design section only |
| GitHub Actions | 674 job-minutes, billed at $0 on a public repository ($5.39 at the private rate) | `deploy.yml`'s paths filter fired no deploy for PR #133 or the board commits; test tiers split across jobs |
| AWS | 8 deploys (7 green, 1 red), two static in-place stacks per environment, no metered LLM call | in-place deploys, no per-branch sets |
| Operator input | 27 messages: 11 skill invocations, 6 command pastes, 5 corrections, 1 question, 2 new requirements, 1 fact, 1 loop stop | the removal block printed with `!` after each merge; the loop's push notification naming the two operator rows |
| Quality | 0 reds on main after merge; the one ci red on a PR was fixed on the branch in one push | the routed run as the first-push proof; the watch's red diagnosed from the job log before any fix |

## Room for improvement

| Loss | Measured | Cause | Improvement |
| --- | --- | --- | --- |
| b27's routed run RED, re-run of two files | 47 min of machine time, 4 min re-run, verdict never GREEN | the coordinator ran b29's gates-only push beside b27's suite; two LibreOffice-backed cases timed out (30 s, 120 s) | the coordinator waits for a live suite the way an agent does: one queue on the machine, every routed run and every gates push behind it |
| PU-8 agent's own routed run RED | 212 unit assertions timed out, browser 481 of 482, about 50 min | the LP-24b agent ran its spec files directly (outside the router, so outside the guard) while PU-8's router ran | the guard is a shared helper every test entry point calls, so `npx vitest run <file>` and `npx playwright test <file>` refuse beside a live suite too |
| b29's routed run idle behind a Submit agent | 28 min (queued 17:45 UTC, started 18:13 UTC) | one machine, two repositories' agents, no shared queue | a machine-wide lock file the router takes (`/tmp/diya-test.lock`), honoured by both repositories' routers |
| PR #134's first ci deploy red | 573 s deploy plus a 2,614 s cancelled test run, one fix cycle of 35 min | b29 forked from main before CQ-56 merged, so its behaviour test asserted `tier-disabled`; and its new case reused the previous case's TOTP inside one 30 s period | the wave forks every batch from the merged tip after the preceding PR lands, or merges main in before the routed run; a shared hosted-UI sign-in helper with the fresh-period retry |
| CQ-50's guard matched its own launching shell | one refused routed run, about 15 min of coordinator time | the first cut matched the word `vitest` anywhere in a command line, and the Bash tool's wrapper quoted it | landed in the row's commit (match on the executable, skip the ancestor chain); nothing further |
| Scheduled test run on a docs-only head | 61.5 job-minutes (`test`, schedule, on `b519856c9`, a board write-back) plus 5.7 of codeql | `test.yml`'s schedule runs the full router on whatever `main`'s head is | the schedule job reads `--code-tree-hash` and skips when the code tree equals the last green run's |
| PR #135's first head superseded | about 65 job-minutes on `420d43226` (deploy 10, test 55) before the merged head replaced it | the merge of main for the `cloud.js` overlap came after the first push | merge main into the batch before its first push when an open PR touches the same files; the board's Status names the overlap |
| The board table rendered as a list | 5 operator messages, 3 replies | the terminal degrades a wide markdown table to a key-value list; the coordinator shortened cells by hand in the first render and re-sent the same table twice | landed in the board skill (tokens under 20 characters in the chat render) and memory; a Claude Code feedback draft is queued for the fallback itself |

## Placement

Constructed scales; anchors dated within three months where the search found them.

| Efficiency | This session | Anchor | Placement |
| --- | --- | --- | --- |
| Deployment frequency | 4 prod deploys in 5h20m, all from merges | DORA "elite" deploys on demand, multiple times a day ([CI/CD Watch, 2026](https://cicd.watch/blog/dora-metrics-benchmarks-2026); [DevX, 2026](https://www.devx.com/uncategorized/dora-metrics-2026-benchmarks-high-performing-teams/)) | elite band |
| Lead time for changes | 73 min dispatch to prod for wave b26; 35 min from a ci red to the fixed head deployed | elite under one hour; high one day to one week ([Gitrecap, 2026](https://www.gitrecap.com/blog/dora-metrics-benchmarks)) | between elite and high; the routed run (64 min for b29) is the floor |
| Change failure rate | 0 of 4 prod deploys failed; 1 of 4 PR ci deploys red before merge | elite 0 to 15% ([Taskade, 2026](https://www.taskade.com/blog/dora-metrics-explained)) | elite band on prod |
| LLM cost per merged PR | estimated $12 per PR ($36 over 3) | $0.28 to $89.32 per merged PR across 12,000 developers ([Jellyfish, July 2026](https://jellyfish.co/library/ai-token-usage-monitoring/)); $7 to $70 per merged feature across a dozen agents ([Insight, July 2026](https://blog.insight-services-apac.dev/2026/07/06/cost-to-a-merged-feature)) | low-to-middle of both ranges; Anthropic's own $13 per developer per active day ([Morph, 2026](https://www.morphllm.com/ai-coding-costs)) is below this session's day |
| Actions minutes per PR | 225 job-minutes per merged PR | no published anchor found within three months | unplaced |

## LLM

Sub-agent tokens from each completion notification (input and output together, as reported):

| Agent | Model | Tokens |
| --- | --- | --- |
| LP-24b build | Sonnet 5 | 416,072 |
| PU-8 pages | Sonnet 5 | 218,477 |
| CQ-51, CQ-50 router | Sonnet 5 | 192,477 |
| LP-24 design | Opus 5 | 160,863 |
| CQ-56 smoke test | Sonnet 5 | 132,169 |
| CQ-52 to CQ-55 guidance | Haiku 4.5 | 88,247 |
| table-fallback guide | claude-code-guide, default model | 84,118 |
| Total | | 1,292,423 |

Priced at the list rates the search returned for September 2026 (Haiku 4.5 $1/$5, Sonnet 5
$2/$10, Opus $4/$20 per million input/output; [platform docs](https://platform.claude.com/docs/en/about-claude/pricing),
[BenchLM](https://benchlm.ai/anthropic/api-pricing)) with the notifications' totals taken as
85% input, 15% output: about $6. The main session's usage is not exposed; estimated from about
130 turns at an average context near 120k tokens on Fable 5.1 ($10/$50, cache reads at a tenth
of input): about $30. Under a subscription the marginal cost of both is nil until the plan's
limit; the figures are the API price of the same work.

## Suggested improvements

1. One machine-wide test lock honoured by every entry point (router, direct vitest, direct
   playwright, both repositories): removes about 125 minutes of machine time and the 28 minute
   idle wait. Covered by no row; CQ-50 landed the router half.
2. Fork or merge from the merged tip before a batch's first push when an open PR shares its
   files: removes the 65 job-minutes of PR #135's superseded head and the 53 job-minutes of PR
   #134's red cycle, and the 35 minute fix cycle. No row.
3. The scheduled test job skips a head whose code tree hash matches the last green run: removes
   67 job-minutes per docs-only day. No row.
4. A shared hosted-UI sign-in helper for the behaviour cases, carrying the fresh-period TOTP
   retry: removes one red ci deploy per new signed-in case. No row.

Ranked by minutes of wall time first, then job-minutes, because wall time on the one machine is
what bounds a wave here and job-minutes bill nothing on this repository.
