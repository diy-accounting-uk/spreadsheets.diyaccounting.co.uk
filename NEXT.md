# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Batch branch `claude/bst-ledger` (pushed; deploys to ci on every push). Wave 1 dispatched
2026-09-03: T1, T2, T3, T4, T5, T10 as worktree sub-agents under `.claude/worktrees/`, one
per task; the coordinator merges each landed commit into the batch branch and pushes.
Landed on the batch: T4 (`cbebf3f8`), T5 (`80d25fc1`), T2 (`e0c8518f`), R2 (`f5f28df8`), T1
(`8e37e594`; 42/42 books specs green under production's headers), T10 (`ddf23204`; render keys
join as `cell/… || section/…` on one attribute), T3 (`2267852d`; workbook kinds stage through
Node in `readBookSource`, the page keeps its in-memory workbook reader), T14 (`2c3f5f75`; A3 carries
a two-cell allowlist because `examples/bst-latest` predates the fixture's tax-table and description
edits; the axe gate fails on `color-contrast` at three viewports until T13), T9 (`63ce7e64`; the strip
module is built but not yet mounted in `bst.js`).

`PLAN_DIYA_GL_BST_CLI_MCP_WEB.md` is active again (2026-09-03): the spike becomes a usable
ledger. Landing shape: one batch branch, `claude/bst-ledger`, draft PR to main; every row lands
on it as soon as its precursors are done and the branch deploys to the ci environment
after each landing. No row waits on a merge.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| T7 | Formats on the page: drop zone, widened picker, two new downloads | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T3, T10 | in-flight | Sonnet; next owner of `bst.js` |
| T15 | Edit and warning proofs (E1, E2) | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T5, T11 | blocked-to-start | Sonnet |
| R1 | Wire `book-checks.js` into `export.js` (`bookchecks.json`), the MCP `report` tool, the diya-gl zip writer and `books-engine.js`; `bst-edits.js` calls the module instead of its own `CHECKS` | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | R3 | Mount the strip in `bst.js` (prepend to the view root in `render()`), delete the old chart functions and their two call sites, pass `headlinesFromReport` from the engine export; the mobile Charts tab and the rail's Charts heading go | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T7, R1 | blocked-to-start | Sonnet; T9's integration note names the lines |
| R4 | Refresh `examples/bst-latest` through the generate-bst workflow on main so the A3 allowlist in `books-equivalence.browser.test.js` empties | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | H3 | blocked-to-start | the operator's main-side generate refresh; then drop the allowlist |
| H3 | Merge the batch PR to main | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | human | T13, T14, T15 | blocked-to-start | nothing waits on it |

## Plans not tracked here

- `PLAN_DIYA_GL_[SE|TAXI|LTD]_CLI_MCP_WEB.md` — not yet drafted; they start from the BST
  plan's as-built notes.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
