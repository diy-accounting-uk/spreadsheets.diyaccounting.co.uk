# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

`PLAN_DIYA_GL_BST_CLI_MCP_WEB.md`'s batch (`claude/bst-ledger`, PR #57) merged to main on
2026-09-03 and is live in production. The generate-bst refresh committed `c3e206d2`; R4b's
fixes merged as PR #58. `PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue
plan of record, drafted 2026-09-03 with sources; its decisions are the operator's.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| T16 | Deep links into the example data sets: `books/bst.html?example=<id>` loads that example on arrival (`bst-scenario-basic`, `bst-brickwork-pro-nonvat`, `bst-sp-sixty`, the ids the example buttons already carry as `data-example`), optionally `&view=<data-view id>` and `&month=YYYY-MM` to land on a view or an open month; an unknown id shows the empty state with a plain message; the URL updates as the user switches views so a link can be copied back out; a spec proves each | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet; a PR |
| L1 | Take the seven decisions in `PLAN_DIYA_GL_LAUNCH.md` ("Decisions for the operator"): Cognito tier, sign-in domain, where the runner builds, the next product, when to apply for Income Tax recognition, the Rust port, the company's VAT position | PLAN_DIYA_GL_LAUNCH.md | human | — | ready-to-start | the plan's phases start from these |
## Plans not tracked here

- `PLAN_DIYA_GL_[SE|TAXI|LTD]_CLI_MCP_WEB.md` — not yet drafted; they start from the BST
  plan's as-built notes. `PLAN_DIYA_GL_LAUNCH.md` recommends SE next.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
