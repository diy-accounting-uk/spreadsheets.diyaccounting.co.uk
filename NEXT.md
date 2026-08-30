# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Integration branch `claude/next-wave-2` (one PR). Tracks run in `../wt-spreadsheets/<track>` on
`claude/wt-<track>`; the coordinator merges each into the integration branch as it lands and
pushes in batches.

| Track | Item | Worktree | Tier | Status |
|---|---|---|---|---|
| f19 | F19 derive straddling VAT entries | — | Sonnet | merged `54cb03ac`, sync gate clean, extractor+loader 104/104; Ltd reconcile running |
| f20 | F20 Taxi export writer | — | Opus | landed, EQ2 gated in CI, 264 lines return, exporter 35/35, breakability proven |
| box51 | F9 remainder: SA103F box 51 | — | Opus | landed `86f4dd23`, box 49 carries the WDA, full suite 6377/6377 in-track |
| f14rem | F14 remainder: measurableQuantity entry | — | Haiku | landed, BST scorecard within budget, verify-roundtrip 35/35 |
| wdakey | F9 remainder: per-regime WDA key | — | Haiku | landed `2f13b8d8`, loader 35/35, no-years smoke clean |
| f18 | F18 field homes + taxi column C + sp-sixty mileage | — | Sonnet | landed: whole-line matches Taxi 82→264, SE 395→647, Ltd 507→665; calculators 3039/3039 on the merge |
| guides | F9 remainder: guides teach the dead motor cap | — | Haiku | landed, 5 passages across 3 guides, PDF build green |
| semileage | F18 remainder: SE Sales mileage writer | `../wt-spreadsheets/semileage` | Sonnet | started |
| f21 | F21 Taxi EQ2 in the generate matrix | `../wt-spreadsheets/f21` | Sonnet | started |
| renumber | SE Full renumbering to the current SA103F | `../wt-spreadsheets/renumber` | Opus | started |

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

Each item names its suggested sub-agent tier; all branch from the post-deploy green main and
follow the reconciliation-bug method.




- [ ] **SE Full renumbering against the current SA103F** (Opus; operator commissioned the
  wholesale surgery 2026-08-30) — renumber every box to the current form, rewrite captions,
  delete dead boxes, rework the checks. In flight as the renumber track.

- [ ] **F18 remainder: SE's Sales mileage column has no writer** (Sonnet) — `app/templates/se/Sales.xlsx`
  column D ("Sales Mileage") is read by nothing and written by nothing, so a day's sales miles are
  captured for Taxi and BST but never for SE; give `app/products/se.js` the write and the exporter
  the read, following the Taxi/BST shape, and re-seed SE's data-half counts.
- [ ] **F21: gate Taxi EQ2 in the generate matrix** (Sonnet) — `generate-taxi.yml`'s matrix still
  scores only the report half and stability; now the Taxi writer exists, add the export/EQ2 steps
  and seed a taxi entry in `app/data/roundtrip-matrix-budget.json` from a real matrix run.

## Plans not tracked here

- `PLAN_DIYA_GL_BST_SPIKE.md` — a BST package opens, edits, recalculates and saves as diya-gl in a
  browser page; specified, not started.
- `PLAN_DIYA_GL_LLM_REVIEW.md` — LLM review of a loaded book, opt-in, metered in-page; starts
  after the BST spike's phase 5.
- `PLAN_PACKAGES_TO_ARCHIVE.md` — first cut into the archive repository via the `archive-packages` skill; run when the operator wants it.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
