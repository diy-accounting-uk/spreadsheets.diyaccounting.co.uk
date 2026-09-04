# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

`PLAN_DIYA_GL_BST_CLI_MCP_WEB.md`'s batch (`claude/bst-ledger`, PR #57) merged to main on
2026-09-03 and is live in production. The generate-bst refresh committed `c3e206d2`; R4b's
fixes merged as PR #58. `PLAN_DIYA_GL_LAUNCH.md` is the launch and revenue
plan of record; its seven decisions were taken on 2026-09-04 and are recorded in it.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| X1 | Draft `PLAN_DIYA_GL_RUST.md`: the port's design wave (type model, the float and half-up rounding contract, module map, the oracle harness diffing `report.json` and `bookchecks.json` byte-for-byte against the JS over the three books, CI parity job), then its code waves and closing ladder, sized from the launch plan's estimate | PLAN_DIYA_GL_LAUNCH.md | machine | — | ready-to-start | Fable design wave, then Sonnet/Opus code waves |
| H6 | Gather Rust porting references, skills and MCP servers for the port's builder | PLAN_DIYA_GL_LAUNCH.md | human | — | ready-to-start | the operator's own research; X1 does not wait on it |
## Plans not tracked here

- `PLAN_DIYA_GL_[SE|TAXI|LTD]_CLI_MCP_WEB.md` — not yet drafted; they start from the BST
  plan's as-built notes. `PLAN_DIYA_GL_LAUNCH.md` recommends SE next.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
