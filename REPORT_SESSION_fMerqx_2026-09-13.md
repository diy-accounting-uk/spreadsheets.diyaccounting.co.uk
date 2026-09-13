<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->

# Session report, 2026-09-13

Opus 5 (1M context) coordinator session, 11:40–19:50 UTC. Id `fMerqx` is the first six characters
of the base64 SHA-256 of the session id.

**Result: 3 PRs merged (#107, #108, #111), 8 board rows closed, prod serving `d1a68377`, board
and plans current, cool-down on.** 39 commits; 101 hand-written files (+3,204/−1,106) plus 436
regenerated package files.

## What worked

| Efficiency | Figure | Why it was good |
|---|---|---|
| Elapsed time | 8 items in 8h10m; batch dispatch to prod 6h53m | Four agents ran at once on disjoint file sets; each was merged as it landed, so the batch never waited for the slowest track. Six rows, two of them template surgery on statutory forms, reached prod in one PR |
| LLM cost | ~2.05M sub-agent tokens; whole session ≈ $60–150 at Opus 5 list, ≈ $8–19 per item | Sonnet on the page and site tracks; briefs carried the evidence (commits to read, cells to verify, the £350 dinner) so agents built rather than rediscovered |
| AWS cost | < $2 | Static site, in-place deploys, nothing per-branch |
| Operator input | 22 messages, 5 of them decisions | Plans carried the briefs and the board carried state; every question was answerable from disk |
| Quality | every new check proven breakable; two defects caught before merge (dash percentages; the site spec's catalogue dependency); three real holes found on the way (`setPath` writing to `Object.prototype`, the `VitalTax!I` cells never computed, no 5502 in the standard chart) | The reconciliation-bug method in `CLAUDE.md`, applied by every agent |

## Room for improvement

| Efficiency | Loss | Board row |
|---|---|---|
| Elapsed time | ~4h: four agents each ran the full 45-minute router; load 32–80 timed out unrelated tests and one agent's `pkill` took out another's run; `generate-ltd` needed two extra cycles because its tests gate the regeneration that fixes them | CQ-30, CQ-32, CQ-31 |
| GitHub Actions | 1,524 billable job-minutes for 3 PRs (~500 per PR): `test` and `codeql` fire on both push and PR events, and on docs-only board commits | CQ-29 |
| LLM cost | agents waited in `sleep 30` loops for up to an hour; one rework (~100k tokens) that a screenshot-before-report rule would have caught in the agent | CQ-32, CQ-30 |
| Operator input | 6 of 22 messages were pastes of commands the session cannot run (SSO refresh with 2FA, `git branch -D`, `git push --delete`, a Stripe key). These stay the operator's; the fix is batches sized to the SSO window and blocked commands collected into one block | CQ-33 |

## Placement, September 2026

Constructed scales (no body publishes these axes): elapsed time upper band (~top 15%); LLM cost
per item upper band (~top 25% at list price); AWS top band; Actions minutes per PR median band;
operator input per item median band, upper on decisions alone. Anchors: METR's 2025 RCT (AI slowed
experienced developers 19%), Microsoft's 2026 CLI-agent rollout (+24% merged PRs), Vantage's
$27–39 per merged PR.

## Method

Coordinator plans, briefs, merges, fixes CI and writes status; agents write code in their own
worktrees off one batch branch, never push, never touch `NEXT.md`. Tier per track (Opus for
template and engine, Sonnet for pages). Every "done" is checked with `git status` in the worktree
and a screenshot opened. Status commits land on `main` as each row moves. CI is the second
reviewer, and the package-regeneration dependency is declared in the PR and worked through in
cycles rather than hidden.
