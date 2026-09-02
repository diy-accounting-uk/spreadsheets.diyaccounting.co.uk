# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

The diya-gl spike delivered in full — CLI, MCP server and the live books page — across
PRs #55 and #56, regenerated, tested and deployed. Its plan lives at the root again as the
as-built record and template: the four product plans
(`PLAN_DIYA_GL_[BST|SE|TAXI|LTD]_CLI_MCP_WEB.md`) may evolve together.

## Open items

Nothing.

## Plans not tracked here

- `PLAN_DIYA_GL_BST_CLI_MCP_WEB.md` — delivered; live at the root as the as-built record
  and the template for the SE/Taxi/Ltd successors.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
