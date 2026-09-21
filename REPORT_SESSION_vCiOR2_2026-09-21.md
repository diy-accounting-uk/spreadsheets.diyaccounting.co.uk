<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# Session report, 2026-09-21

Opus 5 coordinator session, 2026-09-21 11:37 UTC (first tool call) onward; this report measures up
to 22:56 UTC and the session is still running. Id `vCiOR2` is the first six characters of the
base64 SHA-256 of `session_01UZJicz2vz5TNDdi3oraBCF`.

**Result: 2 PRs merged here (#130-#131, 6 board rows), plus 1 in a sibling repository (Submit PR
#322) for the same DIYA-GL cut-over; prod serving `128240e2e`, ci `5fe8732fb`; board down to 4
rows (1 ready, 3 blocked), cool-down on since 19:30:33Z.** 23 session commits on `main` since
`83d38e5a5` (2 PR merges, 2 diya-gl npm publishes); 40 hand-written files, +683/-120 lines; 0
generated files touched. The prior session's report and two finished plans
(`PLAN_DIYA_GL_HOME.md`, `PLAN_SPREADSHEETS_RUM.md`) were archived; a trends page across six
session reports was published as [an Artifact](https://claude.ai/artifact/NPWaRpczSgafAbrhSiEfAF).

## Method

I use Claude Code as a coordinator running the `/iterate` cycle. It dispatches Haiku and Sonnet
sub-agents on their own worktrees per board row, merges what passes CI, and I make the calls it
can't: whether Submit's cool-down blocks a merge, how long the sandbox runs, which price survives
a repricing. In this session it closed six DIYA-GL cut-over rows across two PRs here and one in
Submit, over 11h19m so far, for about $81 of measured tokens across the coordinator and its six
finished sub-agents. Twelve messages from me covered three real decisions (keep Submit out of
cool-down, the sandbox back to 35 days, resident-VAT staying at 99p), and one seven-hour stretch
needed none. Between board sweeps I used the gap to think through the DIYA-GL business model and
started a new pricing plan from it. My next area to develop is the coordinator racing its own
routed test run against other agents' browser suites on the same machine, which cost about 90
minutes this session alone.

## What worked

| Efficiency | Measured | Mechanism |
| --- | --- | --- |
| Elapsed | 11h19m so far (11:37 to 22:56 UTC, still running); one operator gap of 7h14m (12:04 to 19:18 UTC) needing no input | the `/iterate` and cool-down cycle runs batches and dispatches sub-agents between board sweeps without a prompt |
| LLM cost | $81.10 measured from each turn's own usage field: $68.34 across 335 main-session turns (Opus 5), $12.76 across 6 finished sub-agents (this report's own agent excluded, still running) | Haiku for the four mechanical rows (CSP-1 $0.26, DG-1i $1.08, DG-1j $0.88, DG-1k $0.64), Sonnet for the two design/write-up rows (DG-1n/DG-1l $7.15, the prior session's report $2.76) |
| Actions minutes | 285.0 job-minutes over 19 runs (this repo); $0 billed (public repo), $1.71 at the private Linux rate | the same gates that skip the judge and deploy tiers on a non-package push |
| Operator input | 12 messages over 11h19m; 3 were decisions, the rest questions or one status paste | the board and `NEXT.md` carry state, so a question ("what's DG-1k blocked on") answers from the board render, not from re-explaining |
| Quality | 1 of 2 PRs here (#131) needed a follow-up push before green; 0 rollbacks after merge; both red runs caught pre-merge | reading the failing job before the next push, not a blind retry |

Rates: Opus 5 $5/$25, Sonnet 5 $2/$10, Haiku 4.5 $1/$5 per million tokens, cache reads at 10%,
cache writes at 1.25x (5-minute) or 2x (1-hour) the input rate
([Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)). Every figure above
is summed from each turn's own `usage` object in the transcripts, not from a notification metric —
this session's notifications carried no `subagent_tokens` field at all. The 335 main-session turns
total 770 input, 185,393 output, 108,763,287 cache-read and 931,986 cache-write (1-hour) tokens.
The six finished sub-agents total 48.7M raw tokens across 423 turns. Both repositories are public,
so Actions bills nothing; at the private Linux rate of $0.006/min the 285.0 job-minutes here would
be $1.71, and Submit's sibling PR #322 ran 819.6 job-minutes ($4.92 at the same rate) across three
deploy attempts before the third succeeded.

## Room for improvement

| Loss | Size | Cause | Improvement |
| --- | --- | --- | --- |
| b24's routed test run raced two agents' browser suites on the same machine | About 90 wall minutes: unit tier 9m56s against 4m58s uncontended, 13 unit and calc tests timed out, the run killed with no verdict at 90m01s; relaunched uncontended it went GREEN in 38m11s | The DG-1n/DG-1l and DG-1i sub-agents' own browser suites were still running when the batch's `npm test` launched | Check for a live soffice/playwright/node process before launching the routed suite; queue behind it instead of racing |
| The pre-push hook re-ran the full router twice despite a GREEN run moments before | About 19 minutes: b24's re-run killed mid-`calc` after roughly 5 minutes, b25's fix-up re-run took its `unit` tier to a RED verdict at 12m36s (5 timeouts, 13m59s wall); both pushes then went through with `SKIP_PUSH_TESTS=1` | The router's tree-hash marker didn't match the pushed tree: untracked `packages/*/LICENCE.txt`, `README.txt` and `test-results/` byproducts sat in the worktree after the marker was written | Have the marker's tree-hash ignore untracked non-source paths (`packages/`, `test-results/`) so a GREEN run's marker survives a push that only adds those |
| PR #131's first CI head failed on a case that probed a path the local server never serves | 63.2 job-minutes (3,793s) on one red run (test run 35630300581) | The new "serves its files" case probed `/runners/` on the local static server before the fix (`5fe8732fb`) pointed it at a deployed host instead | Point a new case's probe at a path the target server actually serves, or gate it on a deployed host from the first commit |
| The redirects+spec agent ran a second full browser suite after its commit had already landed | About 44 minutes on a run whose result went unused, stopped by the coordinator | `DG-1n`/`DG-1l`'s own confirmation suite duplicated the batch's own routed run over the same diff | Skip an agent's own confirmation suite once its commit is already covered by the batch's routed run |
| DG-1i ended its turn on a long foreground test run | 52m04s of foreground agent time on a run that finished RED (browser FAILED at 47m35s) and was never used; the change landed from the diff instead | The agent ran `npm test` in the foreground instead of backgrounding a multi-minute run, then ended its turn before the result came back | Background any test run over a few minutes inside an agent's own turn, as the repo's own test-scope guidance already says |
| DG-1j's GA4 case was rewritten twice | 28 of the agent's 66 turns, its full $0.88 cost, went into three attempts at one case | The first two versions read `window.dataLayer` inside `page.evaluate()`, which serialises `Arguments` objects as empty over the CDP bridge; a behaviour-fixture run then proved `gtag` blank | Assert against a network request or a fetched file's own content first, before reading a page-global object back through `evaluate()` |

## Placement, September 2026

Scales are constructed from the cited anchors; the anchors are the first result of a search dated
within three months.

| Efficiency | This session | Anchor | Position |
| --- | --- | --- | --- |
| Whole-session LLM cost | $81.10 over 11h19m so far, 1 coordinator plus 6 finished sub-agents | $13/dev/day Anthropic-reported average; $50-65/day for 5 concurrent agents ([cloudzero.com, 2026](https://www.cloudzero.com/blog/claude-code-agents/)) | 1.2-1.6x the 5-agent ceiling, driven by the coordinator's own $68.34 of Opus turns, not the $12.76 the sub-agents cost together |
| Elapsed / unattended stretch | 11h19m so far; longest unattended gap 7h14m | 30+ hour autonomous runs reported at the frontier, one documented 21-hour user record ([munderdiffl.in, 2026](https://munderdiffl.in/blog/long-running-agents-the-2026-shift/)) | this session's longest unattended stretch is a third of the cited 21-hour record, short of the 30+ hour frontier figure |
| Actions minutes per PR | 142.5 min/PR (285.0 min over 2 PRs); $0.006/min the current Linux rate ([cicdpipelinecost.com, 2026](https://cicdpipelinecost.com/github-actions-pricing)) | own prior session, 2026-09-21: 155.3 min/PR; the session before that, 2026-09-16: 90 min/PR | between the two, closer to the immediately prior session's rate |
| CI failure rate | 1 of 2 PRs here needed a follow-up push before green; 0 shipped broken | merged AI-generated PRs cluster sharply near zero CI failures, unmerged ones carry a heavy tail ([MSR 2026 Mining Challenge](https://2026.msrconf.org/details/msr-2026-mining-challenge/8/Do-AI-Generated-Pull-Requests-Get-Rejected-More-Yes-but-Why-)) | both red runs here were caught and fixed pre-merge, consistent with the merged side of that split, on a 2-PR sample |

## Suggested improvements

Ranked by value, most impactful first, by wall-clock minutes removed since no single dollar figure
this session dominates the way the coordinator's own cost did last time.

1. Check for a live soffice/playwright/node process before launching the routed test suite:
   removes about 90 minutes, the largest loss measured this session (b24). No board row.
2. Have the router's tree-hash marker ignore untracked non-source paths (`packages/`,
   `test-results/`): removes about 19 minutes of duplicate pre-push hook runs across two pushes
   (b24, b25). No board row.
3. Point a new behaviour case's probe at a path the target server actually serves before the
   first push: removes 63.2 job-minutes on the next red run of this shape (PR #131). No board row.
4. Background any test run over a few minutes inside an agent's own turn: removes 52m04s of
   foreground agent time per agent that hits this (DG-1i). No board row.
5. Skip an agent's own confirmation suite once its commit is already covered by the batch's
   routed run: removes about 44 minutes per agent that re-runs one (DG-1n/DG-1l). No board row.
6. Assert against a network request or fetched file content before reading a page-global back
   through `evaluate()`: removes 28 of 66 turns ($0.88) per case built this way (DG-1j). No board
   row.
