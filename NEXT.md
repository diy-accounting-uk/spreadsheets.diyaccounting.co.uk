# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

**Batch closeout** — the book read-back batch merged to main in PR #53 with the four
generator refreshes on board; the judge test 108/108 everywhere the pins match their
reports.

- [ ] PR #54 (`claude/judge-repin`) awaits operator merge: the judge parser re-pinned to
  the refreshed reports (Ltd brickwork now RECONCILES clean at 1020 checks); 108/108 on
  the file. Until it merges, `test.yml` on main fails those three pins.
- [ ] one clean serial `npm test` sweep on main — running.
- [ ] archive `PLAN_ROUNDTRIP_FIDELITY.md` when the prod deploy from the PR #53 merge goes
  green (in progress at writing). The plan is then fully closed; its record moves out of
  the live plan set.

**diya-gl spike delivery** — on `claude/bst-spike-2` (from the merged batch tree). Phases 1
(CLI) and 2 (MCP) landed with green closing ladders; tracking moved here from the plan doc
(operator, 2026-09-02).

- [ ] BST ledger alignment (Opus, worktree agent) — in flight, operator decided 2026-09-02:
  the pipeline aligns to the REAL `Debtors & Creditors` sheet (a monthly outstanding table;
  the exporter/generator had shared an invented per-contact layout that round-tripped as
  fiction). Moves BST's book ledger shape, generator writes, fixtures and declared budget
  counts; the sheet joins the anchor guard; the `adminMileageRates` silent-zero fallback
  rides along.
- [ ] W0, the phase-3 bundle gate (Opus, worktree agent) — in flight: the injected resource
  loader across the re-measured `fs` call sites (Track E's seam is the pattern), the
  esbuild bundle, the bare page, and the automated continue-or-stop gate — the bundle's
  figures and verdicts against `reconcile.js` on sp-sixty.
- [ ] phase 3 tracks W1-W5 (viewer, panels + form renders, edits/checks/helpers, save,
  entry/examples/layouts) — dispatch as W0's gate holds; the designed shell, form renders
  and entry panel are already landed (W-pre).

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
