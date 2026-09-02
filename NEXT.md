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

- [x] BST ledger alignment — landed (merged; 368 engine + 22/22 books browser tests on the
  merged tree). Only C3/F3 are entered on the real sheet — they map to
  `openingBalances.tradeDebtors`/`tradeCreditors`, no schema change; the monthly
  outstanding table is report output, carried as 28 new reads and checks; the named
  ledgers are declared absent (measured, not hidden; bst declared 36→78). The old writer
  had been destroying 16 template formulas — the sidecar went 16→0 on a fresh package. All
  nine BST reports RECONCILE; the sheet (plus PurchasesStock and Fixed Assets) joined the
  anchor guard; `adminMileageRates` now throws by name.
- [ ] the settlement flag (Sonnet, worktree agent) — in flight, operator decided
  2026-09-02: coarse map both ways — column D reads back as bank-transfer/cash, finer
  values declared unrepresentable per block; Taxi aligned, SE/Ltd checked; the
  regenerate-from-export ledger flip proven fixed by a double round trip.
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
- [x] W3 — landed (merged, 42/42 books specs on the merged tree): one commit route for
  every change (edits, deletes, adds, helpers), undo covering them all, drift relabelling
  as recalculated, and a two-group checks panel — engine checks untouched, new book-level
  checks whose three fix-it helpers preview and apply as one undoable step, each proven on
  a deliberately broken book. Also repaired the D&C view crash at the W1/ledger merge seam.
- [x] bst-latest refresh + upload openings — landed (merged; 27/27 sidecar and 41 blast
  tests on the merged tree): the package regenerated against the aligned writer
  (RECONCILES 91/91, sidecar 0), uploads read C3/F3 into `openingBalances` (the root of
  the 12 spurious drift findings), the zero-drift spec asserts the whole drift collection.
  The branch CI sidecar failure traced entirely to the stale fixture — no map bug.
- [x] `changeLinePostingDate` / `changeLineAccount` — landed (merged; 81 unit + 15 helper
  specs green on the merged tree): position-preserving, date and chart validation with
  named errors, MCP-registered, the page's remove+add composition retired.
- [x] W4 — save — landed (merged, 120 blast tests + 39/39 browser in the track): all 11
  JSZip sites emit `uint8array` with byte-identity proven; the MCP base64 boundary fixed
  (a bare `Uint8Array.toString` silently corrupts); the save controls download real
  workbooks with `fullCalcOnLoad` proven; round-trip 0 mismatches on the two ledger
  fixtures (sp-sixty's divergence is the in-flight ledger alignment's territory).
- [x] W5 — landed (merged, 26/26 books specs on the merged tree): the new-book form
  producing an empty valid book through the same load path; IndexedDB autosave with a
  never-auto-load continue offer, discard, and proven degradation when the store is
  blocked; plus the fix that wired `state.book`/`state.lines` so the live page's save
  controls actually work.
- [x] phase 2 leftover: the `removeLine` edit op — landed (merged, 55 tests green through
  both the API and the MCP tool layer).

- [x] the eight tax-year cuts — done and independently verified: nine commits on the
  archive repo's main (119/119 digests match), the `packages-published/` role recorded
  there, the unused secret deleted. `PLAN_PACKAGES_TO_ARCHIVE.md` reached its end state
  and is archived to `_developers/archive/`; future cuts run through the
  `archive-packages` skill.

## Plans not tracked here

None — both live plans are on this board.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. Cuts of the
  finished catalogue land in the archive repository through the `archive-packages` skill;
  untracking `packages/` here remains an open question (the deploy and catalogue-sweep
  readers need another source first).
