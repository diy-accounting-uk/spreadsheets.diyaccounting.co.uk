# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

**Batch closeout** — the book read-back batch merged to main in PR #53 with the four
generator refreshes on board; the judge test 108/108 everywhere the pins match their
reports.

- [x] PR #54 merged — the judge parser pins match the refreshed reports; main's `test.yml`
  is coherent again.
- [ ] one clean serial `npm test` sweep on main — running.
- [ ] refresh `claude/bst-spike-2` from main and purge merged branches — queued behind the
  sweep (the working tree is busy); merged branches to purge, local and origin:
  `claude/book-readback`, `claude/book-readback-2`, `claude/bst-cli-phase-1` (fully
  contained in `claude/bst-spike-2`), `claude/judge-repin`.
- [x] `PLAN_ROUNDTRIP_FIDELITY.md` archived to `_developers/archive/` — the prod deploy
  from the PR #53 merge went green, closing the plan's full set.

**diya-gl spike delivery** — on `claude/bst-spike-2` (from the merged batch tree). Phases 1
(CLI) and 2 (MCP) landed with green closing ladders; tracking moved here from the plan doc
(operator, 2026-09-02).

- [ ] BST ledger alignment (Opus, worktree agent) — in flight, operator decided 2026-09-02:
  the pipeline aligns to the REAL `Debtors & Creditors` sheet (a monthly outstanding table;
  the exporter/generator had shared an invented per-contact layout that round-tripped as
  fiction). Moves BST's book ledger shape, generator writes, fixtures and declared budget
  counts; the sheet joins the anchor guard; the `adminMileageRates` silent-zero fallback
  rides along.
- [ ] W0, the phase-3 bundle gate — **the gate holds: CONTINUE.** Agent complete (8 commits,
  awaiting coordinator merge once the main closeout sweep frees the tree): the browser runs
  the unforked engine — 9 sheets cell-identical, 61/61 verdicts matching, breakability
  proven, 422.7 KiB reproducible bundle, the shared `app-resources.js` seam. Two riders for
  the merge: prettier on W-pre's three books files (CI formatting gate), and W4 inherits a
  decision — the generator asks JSZip for `nodebuffer` (~10 sites), which no browser
  produces, so browser save needs an output-type choice.
- [ ] phase 3 tracks W1-W5 (viewer, panels + form renders, edits/checks/helpers, save,
  entry/examples/layouts) — W0's gate held, so these dispatch next; the designed shell,
  form renders and entry panel are already landed (W-pre).

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.
Nothing is open outside the in-flight blocks above.

## Plans not tracked here

- `PLAN_PACKAGES_TO_ARCHIVE.md` — first cut into the archive repository via the `archive-packages` skill; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
