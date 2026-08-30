# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Wave 5 is on `claude/wave-5` as PR #43 (16 track merges, merged with main at `4369f879`; the
merged tree passes 3,582 tests and the post-merge checks, sync gate clean). The double-roundtrip failures on its first test.yml
run (the exporter dropped the fixed-asset register, the VAT flag, the CT reference and the
entered stock) are fixed at `c5233f6c`, and the operator's generate-* runs on the earlier head failed only because
the new stability suite called LibreOffice in the generate job (guarded at `f177cb3c`); test.yml is green on `f177cb3c`. On the generate-* runs, se, ltd and taxi pass; bst fails every
reconcile leg on T7's matrix scorecard (`fieldsDropped 1`: the fixture TOMLs carry no
`documentReference`, so the reconcile-populated package has an empty reference column and
the export cannot carry it back); fix in flight (Sonnet, worktree `sp-fidelity-refs`): the
extractor emits reference/description/account on every transaction, the matrix budget is
re-seeded from measurement. After the merge, fidelity
parks (`PLAN_ROUNDTRIP_FIDELITY.md`, "Parked").
The fidelity items below close with that merge; their remainders are in the plan's "What stays
open" and are not re-listed here.

## Open items

Method for every check/fixture/template item below: "Reconciliation-bug method" in
CLAUDE.md — discover cells from the template XML, assert anchored to the fixture, prove
each check breakable via JSZip corruption with an exact failure set, blast radius
serially, then the four generate dispatches (skip-commit) green including the live judge.

Checks, indicators and docs:


Shipped-template surgery (binary xlsx edits plus a regeneration pass):


Fixture:


- [ ] **Roundtrip fidelity: merge PR #43, then park** — T0-T7 delivered; the plan of record
  `PLAN_ROUNDTRIP_FIDELITY.md` holds the state at parking and its 17 remainders (the ratchet
  to an exact gate, the Excel-side `--data` flag, S7 and the lost lines, the unrepresentable
  fields, the stale caches on blank packages, the SE 2023-24 forecast failures, and the rest).
  Fidelity resumes when a production use of the JS representation
  (`PLAN_VAT_EXPORT_FOR_SUBMIT.md`) pulls it back.

## Plans not tracked here

- `PLAN_PACKAGES_TO_ARCHIVE.md` — generated packages move to the archive repository; paused by the operator, resume when wanted.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
