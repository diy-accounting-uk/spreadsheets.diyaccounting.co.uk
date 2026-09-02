# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

**diya-gl spike** — delivered: PR #55 merged to main with all four packages regenerated,
tested and deployed. `PLAN_DIYA_GL_BST_CLI_MCP_WEB_SPIKE.md` archives when its one
remainder lands:

- [ ] the settlement flag — **PR #56 awaits operator merge** (122 blast tests on the
  merged branch): column D round-trips as the coarse payment method; the generate pipeline
  gains the settlement write it never had; SE/Ltd declared with empirical proof; double
  round trip byte-identical. On merge, `PLAN_DIYA_GL_BST_CLI_MCP_WEB_SPIKE.md` archives —
  the spike is then fully delivered.

## Open items

Nothing outside the in-flight block above.

## Plans not tracked here

None — the one live plan is on this board.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
