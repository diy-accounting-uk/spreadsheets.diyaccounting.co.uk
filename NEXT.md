# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

`PLAN_DIYA_GL_BST_CLI_MCP_WEB.md`'s batch (`claude/bst-ledger`, PR #57) merged to main on
2026-09-03 and is live in production. Its two follow-ons landed after it: R4, byte equality
with no test allowances (PR #58, 2026-09-03, after the generate-bst refresh `c3e206d2`), and
T16, deep links into the example books (PR #59, 2026-09-04). The plan has no open rows.
`PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue plan of record; its seven decisions were taken on 2026-09-04 and are recorded in it, and it carries its
own open items (the Rust port plan and the operator's research for it).

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| P1 | Draft `PLAN_DIYA_GL_SE_CLI_MCP_WEB.md`, carrying the shared generalisation rows S1 to S8 | operator | machine | — | in-flight | Fable agent drafting; form research folds in |
| P2 | Draft `PLAN_DIYA_GL_TAXI_CLI_MCP_WEB.md` | operator | machine | — | in-flight | Fable agent drafting; form research folds in |
| P3 | Draft `PLAN_DIYA_GL_LTD_CLI_MCP_WEB.md` | operator | machine | — | in-flight | Fable agent drafting; CT600 research folds in |
## Plans not tracked here

- `PLAN_DIYA_GL_[SE|TAXI|LTD]_CLI_MCP_WEB.md` — being drafted (P1 to P3) from the BST
  plan's as-built notes. `PLAN_DIYA_GL_LAUNCH.md` decides SE next.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
