# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## Open items

- [ ] **VAT quarter-end dropdown does not roll with the package year** — plan approved, IN
  EXECUTION on branch `claude/vat-quarter-dropdown`. Plan: `PLAN_VAT_QUARTER_DROPDOWN.md`
  (three surfaces: dropdown list, stale caches, wrong-figures remap). Customer waiting
  (Philippe Clavier; draft reply held at `../tmp/reply-to-philippe-clavier.md`).

  In flight:

  State: surfaces 1–3 merged, regenerated, and deployed live (Mar27 artefact
  verified). Surface 4 found live (closed-workbook link update reads stale
  Financialaccounts Admin caches) — fix at
  **PR 4: https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk/pull/4**
  (whole-dir Mar26 byte-identity; also heals the four bank-account workbooks).

  All four surfaces are deployed and live-verified (Aug27 artefact checked on
  both failure paths, 2026-08-24). Remaining: extend guard test with the 4th
  chain link (Vatreturns external cache ≡ Financialaccounts stored Admin) →
  determinism dispatch → behaviour-prod re-run (earlier failure was local
  Playwright setup) → send Philippe's reply (`../tmp/reply-to-philippe-clavier.md`,
  unblocked — fixed package is live) → operator: six-donor decision → close.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_ARTEFACTS_OUT_OF_GIT.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
