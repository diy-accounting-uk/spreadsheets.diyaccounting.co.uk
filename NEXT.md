# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

`PLAN_DIYA_GL_BST_CLI_MCP_WEB.md`'s batch (`claude/bst-ledger`, PR #57) merged to main on
2026-09-03 and is live in production. The generate-bst refresh committed `c3e206d2`; R4b's
fixes are PR #58 (`claude/byte-equality`). `PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue
plan of record, drafted 2026-09-03 with sources; its decisions are the operator's.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| H4 | Merge PR #58 (`claude/byte-equality`) to main | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | human | — | ready-to-start | CI on the PR is the gate; nothing waits on it |
| L1 | Take the eight decisions in `PLAN_DIYA_GL_LAUNCH.md` ("Decisions for the operator"): billing shape, Cognito tier, sign-in domain, where the runner builds, the next product, when to apply for Income Tax recognition, the Rust port, the company's VAT position | PLAN_DIYA_GL_LAUNCH.md | human | — | ready-to-start | the plan's phases start from these |
## Plans not tracked here

- `PLAN_DIYA_GL_[SE|TAXI|LTD]_CLI_MCP_WEB.md` — not yet drafted; they start from the BST
  plan's as-built notes. `PLAN_DIYA_GL_LAUNCH.md` recommends SE next.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
