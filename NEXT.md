# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Batch branch `claude/bst-ledger` (pushed; deploys to ci on every push). Wave 1 dispatched
2026-09-03: T1, T2, T3, T4, T5, T10 as worktree sub-agents under `.claude/worktrees/`, one
per task; the coordinator merges each landed commit into the batch branch and pushes.
Landed on the batch: T4 (`cbebf3f8`), T5 (`80d25fc1`).

`PLAN_DIYA_GL_BST_CLI_MCP_WEB.md` is active again (2026-09-03): the spike becomes a usable
ledger. Landing shape: one batch branch, `claude/bst-ledger`, draft PR to main; every row lands
on it as soon as its precursors are done and the branch deploys to the ci environment
after each landing. No row waits on a merge.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| T1 | CSP-safe validation: precompiled schema validators in the bundle | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | in-flight | production cannot load a book; Sonnet |
| T2 | Production security headers in the test server; prod behaviour probe | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | in-flight | disjoint from T1; Sonnet |
| T3 | Interchange formats: sniffing, diya-gl zip and JSON readers and writers, CLI and MCP | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | in-flight | Opus |
| T10 | Render hooks (`data-r-key`) and the declared-absence file | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | in-flight | Sonnet; first owner of `bst.js` |
| T7 | Formats on the page: drop zone, widened picker, two new downloads | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T3, T10 | blocked-to-start | Sonnet; next owner of `bst.js` |
| T9 | The strip: four tiles, two pies, redrawn charts | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T14 | The equivalence suite (A1–A7, E3–E6), axe at four viewports | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T10 | blocked-to-start | Sonnet; rebases as T13 moves the page |
| T13 | The UX pass: nine changes plus the view corrections | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T7, T9 | blocked-to-start | Opus; owns the page files |
| T11 | Date and account editing on entry rows | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T13 | blocked-to-start | Sonnet |
| T15 | Edit and warning proofs (E1, E2) | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T5, T11 | blocked-to-start | Sonnet |
| R1 | Wire `book-checks.js` into `export.js` (`bookchecks.json`), the MCP `report` tool, the diya-gl zip writer and `books-engine.js`; `bst-edits.js` calls the module instead of its own `CHECKS` | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T3 | blocked-to-start | Sonnet; T5's remainder |
| R2 | SP Sixty example: `TXN-0181` is dated 2025-04-01, before the book's period start 2025-04-06; decide whether the date or the period is wrong and fix at source | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | in-flight | found by T5's date check; Sonnet |
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
