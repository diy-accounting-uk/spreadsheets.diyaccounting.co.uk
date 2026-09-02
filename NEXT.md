# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

- [ ] books page site-design integration (Fable fork, worktree agent) — in flight, operator
  instructed 2026-09-02: the download.html panel moves to the bottom below Documentation &
  User Guides marked Work in Progress; the page restyles to the site's own look (background
  grid, floating panels) with forms strictly following ../submit's HMRC form guidance and
  dark mode within the site design; the production engine-fetch failure fixes by wiring
  `build:books-bundle` into deploy.yml. Lands locally for the operator's visual review
  BEFORE any push to main (direct-to-main authorized after that look).

The diya-gl spike delivered in full — CLI, MCP server and the live books page — across
PRs #55 and #56, regenerated, tested and deployed. Its plan lives at the root again as the
as-built record and template: the four product plans
(`PLAN_DIYA_GL_[BST|SE|TAXI|LTD]_CLI_MCP_WEB.md`) may evolve together.

## Open items

Nothing.

## Plans not tracked here

- `PLAN_DIYA_GL_BST_CLI_MCP_WEB_SPIKE.md` — delivered; kept live at the root as the
  as-built record and the template for the SE/Taxi/Ltd successors.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
