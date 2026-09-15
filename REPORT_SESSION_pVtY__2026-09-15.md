<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# Session report, 2026-09-15

Opus 5 (1M context) coordinator session, 2026-09-15 06:50 UTC to 16:28 UTC, still running. Id
`pVtY__` is the first six characters of the URL-safe base64 SHA-256 of the session id (the plain
base64 form is `pVtY//`, which a file name cannot carry).

**Result: 3 PRs merged (#117 CQ-43, #118 SET-10, #119 SET-9), 3 board rows closed and a fourth
(CQ-44, PR #120) in CI, prod serving `9fb334c0`, board current.** 32 commits on `main` since
`43aa3d3f` (18 on the three PRs, 14 docs-only board commits, 2 bot publishes, 1 bot dependency
bump); 56 hand-written files (+1,091/−213) plus 30 regenerated (seven SE packages,
`examples/se-latest`, the SE parity fixture, the reconciliation pages and screenshots). Two rows
remain open (SET-7, H-LU-9) besides CQ-44 in flight.

## Method

I run the backlog as a loop: `/board` picks the top ready row, `/do-next` gives it to one agent in
its own worktree on a branch from `main`, the agent's routed test run gates the push, `/watch`
holds the PR until its checks land, `/auto-merge` merges it, and the loop starts again on the
next row. I write the plan (`PLAN_SE_TEMPLATE_GAPS.md`'s 3.4 tables were the whole brief for two
of today's rows) and the rules; the session decides nothing that spends money or deletes things,
and hands me those commands to paste. In this session that landed three SE tax-return rows,
including the 69-file Structures and Buildings Allowance record, for an estimated $12–22 of
tokens and six messages from me, one of them a paste. What became reliable today is the
one-row-per-cycle loop itself: every PR merged on its first CI run. My next areas to develop are
the engine restamp that forces a second local test run before every push, and the router running
every tier after a gate has already failed.

## What worked

| Efficiency | Measured | Mechanism |
| --- | --- | --- |
| Elapsed | 8h27m from the first dispatch (06:58 UTC) to the third merge (15:17 UTC); SET-10 dispatch to prod green 2h52m, SET-9 4h19m | One row per cycle on its own branch and worktree; `/watch`'s `MERGEABLE` probe hands straight to `/auto-merge`; the ci deploy and `generate-se` (with the live judge) run on the branch before the merge, so `main`'s deploy is a repeat, never a discovery |
| LLM cost | 1.31M sub-agent tokens for four rows (SET-9 742k and SET-10 385k on Sonnet, CQ-43 90k and CQ-44 96k on Haiku), $3–12 at list depending on the input/output split, estimated; main session estimated ~$10 | Tier by row: Haiku for the two one-file rows, Sonnet for the two template rows; a design rich enough that Sonnet built SET-9 (schema, two templates, calculator, derivations, exporter, page, fixture, 6 commits) without a question |
| Actions minutes | 459 job-minutes over 32 runs; `main`'s `test` on each of the three merge commits took 1 minute (the green-check job) against 63–68 for a full run | CQ-34's GREEN marker: a tree already proven on the branch is not re-run on `main`; the schedule's own full run (68 min at 12:12 UTC) stays the independent proof |
| Operator input | 6 messages: three `/board`, one `/loop`, one paste (branch deletion), one `/session-report`; 0 corrections, 0 decisions | The loop prompt names the whole cycle; every operator-only command (origin branch deletion, `branch -D`) is printed once at the pause and the loop carries on without it |
| Quality | 3 of 3 PRs merged on their first CI run; 0 red CI runs on a PR head; 2 real gaps caught locally before the push (SET-10's unrendered `AH1`/`AI1`, SET-9's four gaps and formatting) | `npm test` as the only named command in the brief; CQ-43 (landed in cycle 1) put the render-coverage spec on the product route, and it caught SET-10's gap in cycle 2 |
| AWS | 6 deploys (3 ci on branch pushes, 3 prod: two merges and the 07:17 schedule), all in place on the two static stacks; 2 `generate-se` runs with the LLM judge under OIDC | `deploy.yml`'s paths filter skipped the deploy for CQ-43 (scripts and tests only); `generate-se` dispatched with `skip-commit` on the branch, so the judge ran once per row and committed nothing |

Rates used: Opus 5 $5/$25, Sonnet 5 $2/$10, Haiku 4.5 $1/$5 per million, cache reads at 10%
([Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)); the subscription's
marginal cost is $0. The repository is public, so Actions bill nothing; at the private Linux rate
of $0.006/min ([GitHub changelog, 2025-12-16](https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/))
the 459 job-minutes would be $2.75. Main-session cost is an estimate: ~110 turns at ~130k cached
context ($0.50/M cache read) plus ~50k output tokens at $25/M and ~200k uncached input at $5/M.

## Room for improvement

| Loss | Measured | Cause | Improvement |
| --- | --- | --- | --- |
| A second full routed run before every push | 110 min wall (SET-10 33, SET-9 62, CQ-44 15) | Each agent restamps `engineVersion` in `app/lib/provenance-data.js` after its GREEN run, so the tree hash no longer matches the marker and the pre-push hook re-runs every tier for a one-line stamp | Restamp before the final `npm test`, or hash the tree without the stamp line as `--tree-hash` already ignores docs |
| PR #117 opened `CONFLICTING` and needed a rebuilt head | 72 job-minutes on the abandoned head `95f31290`, ~45 min wall | The coordinator's `git reset --soft main` squash in the worktree ran after `main` had moved, so the commit carried the fork's `NEXT.md` and reverted two board edits | Squash against the fork point, and let the pre-push hook refuse any branch whose diff against `main` touches `NEXT.md` |
| Two first `npm test` runs ended RED after running every tier | ~66 min wall (SET-10 34m52s, SET-9 34m52s), each RED on prettier plus a real gap | The router runs unit, calc and browser after the gates tier has failed; the formatting failure was known at minute 2 | The router stops after a failed gates tier (or a `--fail-fast` default), and the brief runs `npx prettier --check .` before the full run |
| SET-9's pre-push run took 62 min against the agent's 36 for the same diff | 26 min wall | Not measured: the browser tier took 42 min for 467 specs with nothing else on the machine; the router prints no per-tier duration | The router prints each tier's duration in its heartbeat and verdict line, so a slow tier is visible and comparable |
| Sub-agent stop notifications that carry no report | ~12 coordinator turns (SET-10 four, SET-9 six, CQ-43 two), ~$1.5 estimated | An agent that waits on background work stops between waits, and each stop notifies "not reported yet" | Brief the agent to wait on a long run with one background waiter and report only through the hand-back; the coordinator reads the worktree on an early notification and does nothing else |
| The SET-9 agent ran `git clean -fd packages/` | 0 files lost (only untracked byproducts), one rule breach | The brief named the byproducts to remove but not the command, and `git clean` was the shortest path | Put the exact `rm` loop over `git status --short` in the brief, as the CQ-44 brief did |

## Placement, September 2026

Scales are constructed from the cited anchors; the anchors are the first result of a search dated
within three months.

| Efficiency | This session | Anchor | Position |
| --- | --- | --- | --- |
| LLM cost per merged PR | $12–22 for three merged PRs and one in CI, $3–7 per PR, estimated | $1.60–2.60 per task at Anthropic's $13 per developer-day figure; $0.03–2.60 per task across Aider, Claude Code and OpenHands ([Kunal Ganglani, 2026](https://www.kunalganglani.com/blog/ai-agent-cost-per-task-2026)) | 2–3x the anchor per PR, for PRs of 7, 42 and 69 files |
| Tokens per task | 90k–742k per agent, 1.31M for four | 400k–2M cumulative input tokens per task ([Kunal Ganglani, 2026](https://www.kunalganglani.com/blog/ai-agent-cost-per-task-2026)) | inside the anchor's range; SET-9 at its midpoint |
| Merge rate | 3 of 3 PRs merged, each on its first CI run | 79% of autonomous-agent PRs merged within 30 days ([LinearB, 2026](https://linearb.io/resources/ai-engineering-productivity-gap)) | above the anchor |
| Actions minutes | 459 for three PRs and three merges, 153 per PR | own prior session (2026-09-14): 199 for one PR and one merge | 23% less per PR |
| Operator input | 6 messages, 1 paste, 0 corrections | own prior session: 7 messages, 0 pastes | level |

## Suggested improvements

Ranked by the measured loss each removes; wall minutes rank above job-minutes because the loop is
serial and every wall minute delays the next row.

1. Restamp `engineVersion` before the final `npm test`, or exclude the stamp from `--tree-hash`: removes 110 wall minutes per three rows. No board row.
2. The router stops after a failed gates tier: removes ~66 wall minutes per two RED runs. No board row.
3. Squash against the fork point and have the pre-push hook refuse a branch diff that touches `NEXT.md`: removes 72 job-minutes and ~45 wall minutes per conflict. No board row.
4. The router prints per-tier durations: makes a 26-minute slow tier measurable. No board row.
5. Brief the exact byproduct `rm` loop and a single background waiter: removes ~12 coordinator turns and one rule breach per session. No board row; a brief-shape change in `do-next`.
