# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Nothing. PR #43 (wave 5, the roundtrip fidelity programme T0-T7) is merged; the operator's
generate-* refresh and deploy from main follow. Fidelity is parked: `PLAN_ROUNDTRIP_FIDELITY.md`
holds the state at parking and its remainders, and resumes when a production use of the JS
representation (`PLAN_VAT_EXPORT_FOR_SUBMIT.md`) pulls it back. Every later PR branch starts
from a rebase onto the post-deploy green main; the operator dispatches CI on branches.

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

- [ ] **Bump `ajv` to 8.18.0** — Dependabot alert #79 (medium): ReDoS in `ajv` when the `$data`
  option is used, vulnerable `>= 7.0.0-alpha.0 < 8.18.0`; wave 5 added 8.17.1 as a direct
  dependency. One `package.json`/lock bump on a branch, via PR; the schema validator does
  not use `$data`.


## Plans not tracked here

- `PLAN_PACKAGES_TO_ARCHIVE.md` — generated packages move to the archive repository; paused by the operator, resume when wanted.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
