# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

`PLAN_DIYA_GL_BST_CLI_MCP_WEB.md` is active again (2026-09-03): the spike becomes a usable
ledger. The plan's audit table says what the page has and lacks; its task list is cut into
five waves for concurrent sub-agents (T1–T15, tiers and file ownership per task).

## Open items

Each wave is machine work to a PR, then a human step (merge, and where named, a review)
that the next wave waits on.

- **W0 (machine, ready)**: production cannot load a book. The site CSP forbids
  `unsafe-eval` and the schema validator compiles with generated code; every load path on
  `https://spreadsheets.diyaccounting.co.uk/books/bst.html` fails while all 63 browser tests
  pass. T1 (precompiled validators in the bundle) and T2 (the test server sends production's
  headers; the behaviour run opens the books page), to a PR.
- **W0-h (human)**: merge the W0 PR, let the deploy run, confirm the live page loads an
  example. Unblocks W1.
- **W1 (machine)**: T3 interchange formats, T4 headline figures, T5 book checks and
  warnings, T10 render hooks. Waits on W0-h. **W1-h (human)**: merge. Unblocks W2.
- **W2 (machine)**: T7 formats on the page, T9 the strip with the two pies. Waits on W1-h.
  **W2-h (human)**: look at the strip at four viewports, then merge. Unblocks W3.
- **W3 (machine)**: T13 the UX pass, T14 the equivalence suite. Waits on W2-h.
  **W3-h (human)**: merge. Unblocks W4.
- **W4 (machine)**: T11 date and account row editing, T15 edit and warning proofs. Waits on
  W3-h. **W4-h (human)**: merge; run `test:spreadsheetsBehaviour-prod`.

## Plans not tracked here

- `PLAN_DIYA_GL_[SE|TAXI|LTD]_CLI_MCP_WEB.md` — not yet drafted; they start from the BST
  plan's as-built notes.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
