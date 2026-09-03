# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

`PLAN_DIYA_GL_BST_CLI_MCP_WEB.md`'s batch (`claude/bst-ledger`, PR #57) merged to main on
2026-09-03 and is deploying to production. Nothing is dispatched.

## Board

| # | Item | Source | Owner | Precursors | State | Status |
|---|---|---|---|---|---|---|
| R4 | Run the main-side generate-bst refresh with commit so `examples/bst-latest` carries the aligned writer and canonical row order | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | human | — | ready-to-start | the workflow commits to main, which a session may not do |
| R4b | Drop the two-cell A3 allowlist in `books-equivalence.browser.test.js` and E3's entry-number normalisation in `books-formats.browser.test.js`; both assert byte equality | PLAN_DIYA_GL_BST_CLI_MCP_WEB.md | machine | R4 | blocked-to-start | Sonnet; a PR |

## Plans not tracked here

- `PLAN_DIYA_GL_[SE|TAXI|LTD]_CLI_MCP_WEB.md` — not yet drafted; they start from the BST
  plan's as-built notes.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
