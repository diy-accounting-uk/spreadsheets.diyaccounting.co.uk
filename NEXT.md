# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

**diya-gl spike + packages archive** — one batch on `claude/bst-spike-2`, one PR back to
main when the board clears. Phases 1 (CLI) and 2 (MCP) of
`PLAN_DIYA_GL_BST_CLI_MCP_WEB_SPIKE.md` landed with green closing ladders; phase 3's
statics (W-pre) and bundle gate (W0 — the gate held: the browser runs the unforked engine)
are merged. The batch also carries `PLAN_PACKAGES_TO_ARCHIVE.md`.

- [ ] BST ledger alignment (Opus, worktree agent) — in flight, operator decided 2026-09-02:
  the pipeline aligns to the REAL `Debtors & Creditors` sheet (a monthly outstanding table;
  the exporter/generator had shared an invented per-contact layout that round-tripped as
  fiction). Moves BST's book ledger shape, generator writes, fixtures and declared budget
  counts; the sheet joins the anchor guard; the `adminMileageRates` silent-zero fallback
  rides along.
- [x] archive-packages helper — the script, skill and `CLAUDE.md` line were already landed
  (`862d7695`); the track added the missing test file (10 tests, every cut rule proven
  breakable) and ran plan step 2: the dry run over the real catalogue is clean — 119/119
  fully formed, exclusion list empty. The cuts (steps 3-6) are ready for the operator.

## Open items

From `PLAN_DIYA_GL_BST_CLI_MCP_WEB_SPIKE.md`, phase 3 — dispatch after the ledger
alignment lands (its book-shape change moves the page snapshot W1 wires):

- [x] W1 — landed (merged, 43/43 browser tests on the merged tree): upload and all three
  examples through the real engine, drift with the pencil-correction mark proven breakable
  in-browser, the anchor guard surfacing named errors in the page's own styling. Its swap
  put every panel and form render on the live engine, absorbing W2's scope.
- [ ] W3 — edits, checks, helpers (Opus, worktree agent) — in flight: in-place entry edits
  through `diya-gl-edits.js`, recalculation on commit, undo as a book-state stack, the two
  helper classes with preview applying through the same edit path.
- [x] W4 — save — landed (merged, 120 blast tests + 39/39 browser in the track): all 11
  JSZip sites emit `uint8array` with byte-identity proven; the MCP base64 boundary fixed
  (a bare `Uint8Array.toString` silently corrupts); the save controls download real
  workbooks with `fullCalcOnLoad` proven; round-trip 0 mismatches on the two ledger
  fixtures (sp-sixty's divergence is the in-flight ledger alignment's territory).
- [ ] W5 — the two leftovers (Sonnet, worktree agent) — in flight: the new-book form (the
  data model's third way in) and IndexedDB autosave of the working book; entry wiring,
  examples and the layout matrix landed with W-pre/W1.
- [x] phase 2 leftover: the `removeLine` edit op — landed (merged, 55 tests green through
  both the API and the MCP tool layer).

From `PLAN_PACKAGES_TO_ARCHIVE.md`, once the helper lands (operator-driven, no
automation — that is the plan's binding constraint):

- [ ] first cut, one tax year at a time, oldest first — eight reviewable commits pushed to
  the archive repo's main; record the `packages-published/` role in that repo's
  `CLAUDE.md`; delete this repo's unused `ARCHIVE_PACKAGES_TOKEN` secret.

## Plans not tracked here

None — both live plans are on this board.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
