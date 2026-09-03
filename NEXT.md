# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

`PLAN_DIYA_GL_BST_CLI_MCP_WEB.md` is active again (2026-09-03): the spike becomes a usable
ledger. Landing shape: T1 and T2 ship first as their own PR because production is broken;
every other machine row lands on one batch branch, `claude/bst-ledger`, with a draft PR to
main, and starts as soon as its precursors are done.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| T1 | CSP-safe validation: precompiled schema validators in the bundle | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | ready-to-start | production cannot load a book; Sonnet |
| T2 | Production security headers in the test server; prod behaviour probe | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | ready-to-start | disjoint from T1; Sonnet |
| H1 | Merge the T1/T2 PR; confirm the live page loads an example | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | human | T1, T2 | blocked-to-start | deploy runs on merge |
| T3 | Interchange formats: sniffing, diya-gl zip and JSON readers and writers, CLI and MCP | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | ready-to-start | Opus |
| T4 | Headline figures module | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet |
| T5 | Book checks and warnings module, three-state verdicts | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet; rebases onto T3 for the MCP file |
| T10 | Render hooks (`data-r-key`) and the declared-absence file | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | — | ready-to-start | Sonnet; first owner of `bst.js` |
| T7 | Formats on the page: drop zone, widened picker, two new downloads | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T3, T10 | blocked-to-start | Sonnet; next owner of `bst.js` |
| T9 | The strip: four tiles, two pies, redrawn charts | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T4 | blocked-to-start | Opus; palette validated both modes |
| H2 | Look at the strip at four viewports | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | human | T9 | blocked-to-start | identity was rejected on sight once |
| T14 | The equivalence suite (A1–A7, E3–E6), axe at four viewports | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T10 | blocked-to-start | Sonnet; rebases as T13 moves the page |
| T13 | The UX pass: nine changes plus the view corrections | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T7, T9, H2 | blocked-to-start | Opus; owns the page files |
| T11 | Date and account editing on entry rows | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T13 | blocked-to-start | Sonnet |
| T15 | Edit and warning proofs (E1, E2) | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | T5, T11 | blocked-to-start | Sonnet |
| H3 | Merge the batch PR; run `test:spreadsheetsBehaviour-prod` | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | human | H1, T13, T14, T15 | blocked-to-start | closing ladder green first |

## Plans not tracked here

- `PLAN_DIYA_GL_[SE|TAXI|LTD]_CLI_MCP_WEB.md` — not yet drafted; they start from the BST
  plan's as-built notes.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
