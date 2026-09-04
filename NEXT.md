# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

The three successor plans (`PLAN_DIYA_GL_SE_CLI_MCP_WEB.md`, `PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md`,
`PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md`) are being executed as one coordinated batch, started
2026-09-04. Batch branch: `claude/diya-gl-products` (from main; every sub-agent worktree forks
from main and opens by merging the batch branch; the coordinator merges each verified commit
into the batch branch and pushes in batches; a draft PR to main opens with the first merge).
Wave 0 is the refinement: each plan gains a `## Briefs` section rich enough for Sonnet and Haiku
agents, then one wave plan across the three. `PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue
plan of record; its seven decisions were taken on 2026-09-04 and it carries its own open items
(the Rust port plan and the operator's research for it).

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| TX1 | Taxi T1 writer: day sums, joined names, caption rows, off-grid refusal | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet, `.worktrees/spreadsheets/taxi-t1`, `claude/wt-taxi-t1` |
| TX3 | Taxi T3 extractor: rental and other-income rows, column F | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet, `.worktrees/spreadsheets/taxi-t3` |
| TX2 | Taxi T2 reposting account, T7 Kestrel fixture date, T19 Class 2 threshold | PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet, `.worktrees/spreadsheets/taxi-t2-t7-t19` |
| LT16 | Ltd T16 CONTEXT corrections and CT600 labels, then T3 headline declaration | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet, `.worktrees/spreadsheets/ltd-t16-t3` |
| LT5 | Ltd T5 book checks and warnings with breakability proofs | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | in-flight | Opus, `.worktrees/spreadsheets/ltd-t5` |
| LT19 | Ltd T19 filing data: CT600 v3 boxes, computation categories, FRS 105 headings | PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet, `.worktrees/spreadsheets/ltd-t19` |
| R1 | Refine the SE plan into per-row briefs and a per-plan wave table | PLAN_DIYA_GL_SE_CLI_MCP_WEB.md | machine | — | in-flight | Fable agent, edits the plan in the main tree |
| W0 | Cross-plan wave schedule: concurrent workstreams by repository area, design waves first | operator | machine | R1 | blocked-to-start | Fable agent; writes the schedule into NEXT.md's board |
## Plans not tracked here

- `PLAN_DIYA_GL_SE_CLI_MCP_WEB.md`, `PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md`,
  `PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md` — drafted 2026-09-04; their task rows are not on the
  board. The SE plan owns the shared generalisation rows S1 to S8 that the other two name
  as precursors. `PLAN_DIYA_GL_LAUNCH.md` decides SE next.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
