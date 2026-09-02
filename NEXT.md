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
- [ ] archive-packages helper (Sonnet, worktree agent) — dispatched:
  `scripts/archive-packages.js`, `.claude/skills/archive-packages/SKILL.md` and the
  `CLAUDE.md` skills line, per `PLAN_PACKAGES_TO_ARCHIVE.md` step 1. Steps 2-6 (the cuts)
  are the operator's, below.

## Open items

From `PLAN_DIYA_GL_BST_CLI_MCP_WEB_SPIKE.md`, phase 3 — dispatch after the ledger
alignment lands (its book-shape change moves the page snapshot W1 wires):

- [ ] W1 — the viewer goes live (Sonnet): the shell swaps its static snapshot
  (`books/bst-data.js`, the marked replacement point) for the bundled engine; upload,
  drill, drift annotations; the in-browser breakability proof.
- [ ] W2 — panels and form renders live (Sonnet): checks panel, drift summary, the SA103S
  and Income Tax renders fed by the engine instead of static figures.
- [ ] W3 — edits, checks, helpers (Opus): in-place entry edits through
  `diya-gl-edits.js`, recalculation, the two helper classes with preview and undo.
- [ ] W4 — save (Sonnet, one decision first): client-side xlsx/zip via `bst-workbook.js`.
  The generator's ~10 JSZip call sites ask for `nodebuffer`, which browsers cannot
  produce — decide pipeline-wide output type vs a caller parameter before dispatch.
- [ ] W5 — entry panel wiring, the other two example books, autosave, the four-layout
  Playwright matrix (Sonnet).
- [ ] phase 2 leftover: a `remove line` edit op for the MCP `edit_lines` tool, left out of
  Track D's rung — add when a consumer needs it.

From `PLAN_PACKAGES_TO_ARCHIVE.md`, once the helper lands (operator-driven, no
automation — that is the plan's binding constraint):

- [ ] dry-run the whole catalogue and read the excluded list — it should be empty;
  anything listed is a generation bug to fix before cutting.
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
