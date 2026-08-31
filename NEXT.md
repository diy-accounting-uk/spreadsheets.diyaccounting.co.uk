# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Nothing. Main is refreshed and deployed through PRs #46 and #47; the six documentation
re-alignment tracks (template-surgery plan, four CONTEXT docs, the sheet-coverage report)
are merged to main as docs-only commits.

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

Each item names its suggested sub-agent tier; all branch from the post-deploy green main and
follow the reconciliation-bug method.

- [ ] **Cut the LLM judge's Bedrock spend** (Sonnet) — `app/bin/judge-reconciliation.js` runs
  `anthropic.claude-opus-5` per product from the four `generate-*` workflows and from
  `deploy.yml` (every web/infra push plus the daily cron), re-judging unchanged digests. Do,
  in order of effect:
  1. Memoize by content: hash digest + rubric + model id into `judge-verdict-<product>.json`
     and skip the Bedrock call when the committed verdict's hash matches. This also ends the
     double-judging (generate judges fresh reports, the next deploy re-judges the identical
     committed ones) with no workflow conditions.
  2. Cap output: `MAX_TOKENS` 16000 → ~2000 and instruct terse one-line-per-concern output;
     output tokens cost ~5× input.
  3. Deduplicate the Ltd digest: 94 near-identical year-end runs collapse to the featured
     run's full indicators plus one delta line per other run (a diverging run still appears
     in full).
  4. Model cascade: Sonnet judges by default; a pass stands; a fail or unparseable answer
     escalates the same digest to Opus for confirmation before anything blocks. The rubric is
     never softened.
  5. Prompt caching: the system preamble + rubric are identical across the four products'
     calls — mark them as a cached prefix for the cached-token discount.
  Extend the judge's existing tests (`app/test/judge-reconciliation.test.js`) to cover the
  memoization skip, the cascade's escalation path, and the Ltd delta digest.









## Plans not tracked here

- `PLAN_DIYA_GL_BST_SPIKE.md` — a BST package opens, edits, recalculates and saves as diya-gl in a
  browser page, with the opt-in LLM review as its post-phase-5 extension; specified, not started.
- `PLAN_PACKAGES_TO_ARCHIVE.md` — first cut into the archive repository via the `archive-packages` skill; run when the operator wants it.
- `PLAN_TEMPLATE_SURGERY.md` — re-aligned 2026-08-31: the original four tracks all landed; the
  plan now holds the three verified live defects (Ltd FAreconciliation `#REF!`s, Payslips
  Jul/Aug cells, divider-row leftovers) plus the SE `K1` label remainder.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
