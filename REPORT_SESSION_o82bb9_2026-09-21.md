<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# Session report, 2026-09-21

Opus 5 coordinator session, 2026-09-20 16:48 UTC (first tool call) to 2026-09-21 11:37 UTC (the
DIYA-GL cut-over's second root DNS deploy going green), 18h49m elapsed. Id `o82bb9` is the first
six characters of the base64 SHA-256 of `session_01KTAKECYxsRwisxuCTnBEkU`.

**Result: 5 PRs merged here (#125-#129, 20 board rows), plus 6 in sibling repositories (5 Submit,
1 root) for the same cut-over; prod and ci both serving `c213fe6d`; DIYA-GL live on its own hosts
(`diya-gl.co.uk`, `ci.diya-gl.co.uk`), both `DiyaGlSiteStack`s `CREATE_COMPLETE`; board down to 6
rows (4 ready, 2 blocked).** 58 session commits on `main` since `1ab04c392` (69 total: 5 PR
merges, 6 diya-gl npm publishes); 144 hand-written files, +3,364/-593 lines; 0 generated files
touched.

## Method

I use Claude Code as a coordinator. I write the plan into the repo, it dispatches agents in
parallel on separate worktrees across three repositories, merges what passes CI, and I make the
decisions and writes it can't: approving each AWS write in the DNS cut-over, choosing the CSP
country list, and clicking through GA4 admin, which has no API. In this session that moved
DIYA-GL off the spreadsheets site onto its own `diya-gl.co.uk` and `diya-gl.com` hosts -- DNS, a
certificate, two new CloudFront stacks, cross-account observability, storage retention tiers and
the new homepage -- 20 rows closed across 11 merged PRs in three repositories, over 18h49m for
$360.67 of tokens. I spend my time approving the writes it can't make and running the manual GA4
steps it can't reach, not reading code. This session the cut-over went live end to end with every
write gated on my go and nothing to roll back; my next area to develop is the coordinator's own
running cost, which measured above the combined cost of the 17 delegated agents doing the actual
work.

## What worked

| Efficiency | Measured | Mechanism |
| --- | --- | --- |
| Elapsed | 18h49m end to end across three repositories; one operator gap of about 15.5h (17:37 to 09:01 UTC) needing no input | worktree per row, batch branches per wave (b19-b23); DG-1b's written runbook queued every AWS write behind one "say go" |
| LLM cost | $360.67 total, from each turn's own usage field: $214.13 across 830 main-session turns, $146.54 across 17 sub-agents | model tiered by row: Haiku for the one purely mechanical row (DG-1c, $0.49), Opus for the one design-heavy row (DG-1g), Sonnet for the rest |
| Actions minutes | 776.6 job-minutes over 52 runs (this repo); $0 billed (public repo), $4.66 at the private Linux rate | `params`/`reconciliation-check` gate the judge and deploy so a docs-only or non-package push skips them |
| Quality | 3 of 5 PRs green on first CI run (b19, b22, b23); 0 rollbacks after merge; the cut-over verified live end to end (200 on `/ltd.html` on both new hosts) | a read-back probe before declaring a row done, not just a green CI run |
| AWS | 2 new CloudFront stacks, 1 certificate, 12 alias records, 2 RUM app monitors, 2 OAM links, through 9 deploys to main and 2 root-DNS dispatches, all operator-approved before running | `deploy.yml`'s existing gates carried the new stack unchanged; the runbook printed the exact command at each "go" |

Rates: Opus 5 $5/$25, Sonnet 5 $2/$10, Haiku 4.5 $1/$5 per million tokens, cache reads at 10%,
cache writes at 1.25x (5-minute) or 2x (1-hour) the input rate
([Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)). The main-session
cost is measured directly from each turn's own usage field (830 turns: 1,918 input, 539,531
output, 368,037,177 cache-read, 1,660,871 cache-write tokens, all 1-hour), not estimated. The
17 sub-agents' cost is summed the same way from their own transcripts, 466.2M raw tokens total;
the completion notifications' `subagent_tokens` figure (3.50M summed) undercounts this by
roughly 100-300x per agent -- e.g. DG-1e reported 389,839 `subagent_tokens` against 117,637,513
raw billed tokens. The repository is public, so Actions bills nothing; at the private Linux rate
of $0.006/min the 776.6 job-minutes would be $4.66.

## Room for improvement

| Loss | Size | Cause | Improvement |
| --- | --- | --- | --- |
| The main coordinator's own token cost | $214.13 across 830 turns over 18h49m, 1.5x the combined cost of all 17 delegated agents ($146.54) | One continuous conversation re-reads its own growing cached context every turn for the whole session; by turn 830 each call was reading roughly 440K cached tokens on average | Checkpoint or compact the coordinator's own context at natural boundaries (a batch's merge, a wave's dispatch) instead of running one unbroken 18h49m thread |
| b21's site-move PR burned CI minutes on red runs | 113.8 min across 3 red runs (2 test, 1 deploy) before green | `DG-1e` (the site move) was pushed alone; `DG-1f` (its own test-path fixes) followed as a second commit on the same PR, so the first CI run tested a known-broken intermediate state | Push a chained pair's commits together, or squash them before the first push, when the second commit is already known to fix the first's tests |
| b20's RUM-1 PR burned CI minutes on one red run | 69.3 min, one failed run | The `cwr` loader shipped in the same commit as the pages that fetch `rum-config.js`; the placeholder config file landed in a follow-up commit, so every browser test asserting "no console error" caught the resulting 404 | Commit a null or placeholder config file in the same commit as any new client-side loader that fetches it, before the first push |
| The GA4 walkthrough (DG-1m) took repeated correction | 3 operator corrections ("be helpful" twice, one on a stalled-looking status line) | The first admin URL handed to the operator omitted the account and property IDs, landing on a page with no property to select; a proposed CSP-1 list was hedged with a size caveat before being given | Resolve and embed the concrete IDs (account, property, and so on) in any URL handed to an operator for a human-driven web step; give the proposed content itself before any caveat about its size |
| An operator query interrupted an already-armed wait | 1 operator message ("WHAT ARE YOU WAITING FOR?") | The harness's generic "Agent waiting on user" status line was the only thing visible; the coordinator's own explanation of the armed background DNS poll was two turns earlier | State inline, at the point of the wait, what the background poll is watching and when it fires |

## Placement, September 2026

Scales are constructed from the cited anchors; the anchors are the first result of a search dated
within three months.

| Efficiency | This session | Anchor | Position |
| --- | --- | --- | --- |
| Whole-session LLM cost | $360.67 over 18h49m, 3 repositories, 17 agents plus the coordinator | $5-30 per overnight run of Claude/Codex tokens; $20-80 for 10 parallel agents over 8h ([amux.io, 2026](https://amux.io/blog/ai-coding-tools-pricing-2026/)) | 4.5-18x the single-run anchor's ceiling; the coordinator's own $214.13 is most of the gap |
| Tokens per delegated task | 68K-390K `subagent_tokens` per agent (the notification metric); 2.4M-117.6M raw billed tokens per agent | 50K-500K+ tokens for a non-trivial task, past 1M for long autonomous sessions ([terseai.org, 2026](https://www.terseai.org/how-many-tokens-ai-coding-agents-use)) | the notification metric sits inside the anchor's range; the raw billed figure is 5-300x above it for every agent that ran more than an hour |
| CI failure rate | 2 of 5 PRs (40%) needed a follow-up push before green; both caught pre-merge, 0 shipped broken | one AI-agent adopter's change failure rate rose 83% alongside a 10x deployment-frequency increase ([larridin.com, 2026](https://larridin.com/blog/ai-coding-agent-dora-metrics)) | this session's failures stayed inside CI, short of the failure rate the anchor describes reaching production |
| Actions minutes per PR | 155.3 min/PR (776.6 min over 5 PRs) | own prior session, 2026-09-16: 90 min for 1 PR | 72% more per PR, from DNS, certificate and observability work crossing more infrastructure than one feature PR |

## Suggested improvements

Ranked by value; a dollar figure ranks above a job-minute figure, which ranks above an operator
message, because the coordinator's own cost this session exceeded every other loss combined.

1. Checkpoint the coordinator's own context at batch boundaries instead of one 18h49m thread:
   removes most of the $214.13 measured coordinator cost, the largest single figure in the
   session. No board row.
2. Push a chained commit pair together when the second is already known to fix the first's
   tests: removes 113.8 job-minutes per branch that hits this (b21). No board row.
3. Commit a placeholder config file alongside any new client-side loader that fetches it: removes
   69.3 job-minutes per branch that hits this (b20). No board row.
4. Resolve concrete IDs into any operator-facing web URL before presenting it: removes up to 3
   operator corrections per human-driven walkthrough (DG-1m). No board row.
5. State a background poll's target and timing inline at the point of the wait: removes 1
   operator query per wait that already has a poll armed. No board row.
