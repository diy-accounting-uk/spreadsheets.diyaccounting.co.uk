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

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

Each item names its suggested sub-agent tier; all branch from the post-deploy green main and
follow the reconciliation-bug method.



- [ ] **F9 remainder: the Ltd/Taxi/BST user guides still teach the £3,000 motor cap** (Haiku) —
  `app/templates/{ltd,taxi,bst}/*-guide.md` tell customers motor vehicles are restricted to
  £3,000 p.a.; the cap is gone from the sheets. Rewrite those passages to the plain WDA rule
  (the SE guide is already clean) and regenerate whatever the guide build derives from them.
- [ ] **SE Full renumbering against the current SA103F** (operator decision first) — the sheet
  carries a pre-2013 numbering throughout (its 48 is today's 49; "Annual Allowances at 10%",
  Agricultural/Industrial Buildings and BPRA boxes no longer exist on the form). Box 49's
  caption still reads "on cars costing £12,000 or less" and box 51's caption sits above a box
  that is now always nil. A wholesale renumber is template surgery across the SE Full sheet and
  its checks — decide whether to do it before dispatching.
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
