# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

`PLAN_DIYA_GL_BST_CLI_MCP_WEB.md` is active again (2026-09-03): the spike becomes a usable
ledger. The plan's audit table says what the page has and lacks; its task list is cut into
five waves for concurrent sub-agents (T1–T15, tiers and file ownership per task).

## Open items

- **Wave 0, first and as its own PR**: production cannot load a book. The site CSP forbids
  `unsafe-eval` and the schema validator compiles with generated code; every load path on
  `https://spreadsheets.diyaccounting.co.uk/books/bst.html` fails while all 63 browser tests
  pass. T1 (precompiled validators in the bundle) and T2 (the test server sends production's
  headers; the behaviour run opens the books page). Then deploy and confirm on the live page.
- Waves 1–4 in the plan's order: engine foundations (T3 interchange formats, T4 headline
  figures, T5 book checks and warnings, T10 render hooks), page features (T7 formats on the
  page, T9 the strip with the two pies), verification and the UX pass (T13, T14), row editing
  and the behaviour proofs (T11, T15).

## Plans not tracked here

- `PLAN_DIYA_GL_[SE|TAXI|LTD]_CLI_MCP_WEB.md` — not yet drafted; they start from the BST
  plan's as-built notes.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
