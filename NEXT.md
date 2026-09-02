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

- [ ] W1 — the viewer goes live (Sonnet, worktree agent) — in flight: the shell swaps its
  static snapshot for the bundled engine; upload, drill, drift annotations; the in-browser
  breakability proof. Renders ledgers from the engine's current shape; the ledger
  alignment reconciles at merge.
- [ ] W2 — panels and form renders live (Sonnet): checks panel, drift summary, the SA103S
  and Income Tax renders fed by the engine instead of static figures.
- [ ] W3 — edits, checks, helpers (Opus): in-place entry edits through
  `diya-gl-edits.js`, recalculation, the two helper classes with preview and undo.
- [ ] W4 — save (Sonnet, worktree agent) — in flight: client-side xlsx/zip via
  `bst-workbook.js`. Output-type decision made (coordinator): the JSZip sites normalise to
  `uint8array` with `Buffer.from` only at boundaries an API demands, byte-identity proven.
- [ ] W5 — entry panel wiring, the other two example books, autosave, the four-layout
  Playwright matrix (Sonnet).
- [ ] phase 2 leftover: the `removeLine` edit op for the MCP `edit_lines` tool (Haiku,
  worktree agent) — in flight.

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
