# NEXT — current state & kickoff

Living handover for this repository. Rules and shape: `../NEXT.md` (DONE or OPEN only, nothing
deferred; a bug found fixing item A is A's remainder, not a new item; this file holds ONLY what
to do next — completed work lives in `git log`). Plans of record: `PLAN_*.md` at this root.

## In flight

Coordinator batch dispatched 2026-08-31, worktree-isolated sub-agents, merged here as each
lands:

- FA track (Opus) — T1 + T4: started
- divider track (Haiku) — T3: merged to local main (98ac8a93, 1282 guard tests green);
  pushes with the next batch after the full suite
- judge track (Sonnet) — J1–J5: started
- hyperlink track (Haiku) — C4: started

Queued behind these to avoid product-module collisions: T2 and F22 after T1 lands (disjoint
regions of `app/products/*.js`), F23 after F22, C1+C2+C3 after T2, F24 after F23, C5 after
C1–C4.

## Open items

The reconciliation-bug method in CLAUDE.md applies to any new check, fixture or template item.

Each item names its suggested sub-agent tier; all branch from the post-deploy green main and
follow the reconciliation-bug method.

- [ ] **T1: the Ltd fixed asset reconciliation reads `#REF!`** (Opus) — `FAreconciliation`
  (sheet2) in `app/templates/ltd/Fixedassets.xlsx` ships six error cells in every Ltd package:
  `E13`/`K13` are `t="e"` `#REF!`, dragging `E15`, `K15`, `B15`, `G15` with them, because the
  workbook has one external link (`Financialaccounts.xlsx`) and the ledger reads have nothing to
  point at. SE's working shape: `E13 =[2]Mar!$AB$2`, `K13 =[3]Mar!$V$2`, `E15=E13-E11`, `B15/G15`
  print the reconcile sentence. The Ltd source cells (discovered from the ledgers; Ltd sums twelve
  `Mar` row-1 totals where SE runs cumulative — do NOT copy SE's references): fixed asset
  purchases `Purchases.xlsx!Mar!$AI$2` (column AI, code FA), fixed asset sales
  `Sales.xlsx!Mar!$U$2` (column U, code FS). Repair: add externalLink2/3 XML + rels +
  `[Content_Types]` overrides + workbook rels + `externalReferences`, following SE's plumbing;
  write `E13 =[2]Mar!$AI$2`, `K13 =[3]Mar!$U$2`; strip `t="e"` and cached `#REF!` from the four
  dependents (`E15`/`K15` plain numeric, `B15`/`G15` `t="str"` with the sentence cached). Never
  renumber link 1: `meta.toml`'s `adminExternalLink` and `rollLtdAdminCachedDates` (which throws
  unless externalLink1 targets `Financialaccounts.xlsx`) depend on it — prove the guard still
  throws on a mis-target. In `app/products/ltd.js` widen `additionalReads` FAreconciliation to
  `["E11","E13","E15","K11","K13","K15"]`, add checks "Schedule additions = Purchases.xlsx fixed
  asset total" (E11 vs E13) and "Schedule disposals = Sales.xlsx fixed asset sales total" (K11 vs
  K13), keep the scenario-anchored checks, drop the now-false workaround comment, and add
  E15/K15 = 0 reconcile checks only after both sides are anchored. Breakability via
  `ltd-reconciliation-checks.test.js`'s corrupt-and-recheck: E13 flips exactly the additions +
  reconcile checks, K13 the disposals pair, E11 the two additions checks. Assert no `#REF!`
  anywhere in a GENERATED `Fixedassets.xlsx` read from the zip (the link cache is the trap:
  `refreshExternalLinkCaches` covers the test path, so a green suite proves nothing about the
  shipped file), and check `externalLinkSignature` in `spreadsheet-runner.js` still refreshes with
  three links. Blast radius: generate, ltd/se precision, ltd-reconciliation-checks,
  ltd-trial-balance-audit, se-reconciliation-checks, then the full ladder.
- [ ] **T2: the July and August payslips carry `#REF!`** (Sonnet) — `Payslips.xlsx`, identical in
  SE and Ltd; `Jul` = sheet5.xml, `Aug` = sheet6.xml; 35 broken cells per workbook, shipped
  unnoticed because `additionalReads` asks Payslips for `Payment` and `Admin` only. `Jul`
  `F11:F15` lost the pay-date reference: the working `Jun` shape is
  `IF(E11=" "," ",IF(Employee!F$24>E$9," ",IF(Employee!F$26<E$9," ",Employee!D$15)))` and Jul has
  `#REF!` where `E$9` belongs (5 replacements). `Jul!T41` holds a formula where every other month
  carries a literal `<v>0</v>` — match the neighbours' style, no formula. `Aug`: 29 cells, rows
  11-15, columns H/I/J/L/M plus K on rows 12-15, each a brought-forward read that lost its row —
  the pattern from Jul and Sep is `<same column>41` of the previous month (e.g.
  `Aug!H11 =IF(T$9="Y",Jul!H41,0)`; `M` carries it inside the longer expression). Walk cells for
  the column-aware Aug fix; assert exactly 5 and 29 replacements and zero remaining `#REF!` in
  both workbooks. Then close the coverage hole: add the two month sheets to `additionalReads` in
  both product modules for the rows the fixture populates, check July and August against the
  SCENARIO'S payroll data (never a neighbouring month — two identically wrong months pass), and
  extend `app/test/payslips-calendar-year-end.test.js` to generate a package and read Jul/Aug
  back. Breakability: corrupt `Jul!F12` → only the July employee-line check flips; `Aug!H13` →
  only the August brought-forward check; no Payment/Admin check moves. Blast radius:
  payslips-calendar-year-end + se/ltd precision, then the full ladder. Runs AFTER T1 (both edit
  the product modules).
- [ ] **T4: the SE fixed-asset `K1` label contradicts its formula** (Haiku; folds into T1's
  dispatch since both edit `app/products/se.js`) — `FIXED_ASSET_CELL_LABELS` in `se.js` says
  "Total net book value carried forward (E1 less J1), assets sold in the year still included",
  but the Schedule's `K` column reads `IF(E<r>>0,IF(V<r>>0,0,E<r>-J<r>)," ")` in both products,
  so a sold asset contributes nothing; the wrong label prints in every SE reconciliation report.
  Bring it to Ltd's corrected wording: "Total net book value carried forward, disposals removed".

- [ ] **C1: cover the Payslips print sheet's period join** (Sonnet) — `Payslips.xlsx!Payslips`
  (both products) is the payslip the employer hands over; its month tabs and calendar are
  asserted, but the `LOOKUP`/`INDIRECT` pair that joins them is read by nothing, so a wrong
  resolution prints the wrong period's pay with every upstream check green. Discover the join
  from the sheet XML, add the printed cells to `additionalReads`, and check them against the
  scenario's payroll data for a chosen period (anchored to the fixture, never to the month tabs
  the join reads — a wrong join agreeing with the wrong month must fail). Prove breakable by
  corrupting the join's cached result.
- [ ] **C2: the Salesinvoice VAT rate is a hard-coded 20** (Sonnet) — the five
  `Salesinvoice.xlsx` sheets (both products) compute a customer-facing invoice total and VAT
  with "VAT Rate" hard-coded 20 on every row, no tie to the tax year; the workbook has no
  external link so a wrong figure never reaches the books, but it reaches the customer's
  customer. Have the generator write the tax year's standard rate into the rate cells (follow
  `buildSeCellEdits`' shape; discover the cells from the XML), read the invoice total/VAT cells
  back, and check them against a hand-computed figure on the fixture. Prove breakable.
- [ ] **C3: the Ltd statutory registers are write-only** (Sonnet) — `Directors&Secretary` and
  `DirectorsInterests` in the Ltd package carry no formula and no route to the accounts; a
  missing entry is a Companies House problem, not arithmetic. The scenario data already carries
  the members (name, shares, `acquired`): have `cellWrites` populate the registers from it,
  read the entries back, and check them against the fixture so an empty register fails. Verify
  the sheet layout from the XML first.
- [ ] **C4: the BST and Taxi Home pages are unchecked navigation** (Haiku) — no figure, no
  money risk; the one thing that can rot is the hyperlinks. Add a template-level test that
  walks `Home`'s hyperlink relationships in both workbooks and asserts every target sheet
  exists (the BST Home hyperlink has broken before — see the fixed-hyperlink note in
  `CONTEXT_BASIC_SOLE_TRADER.md`).
- [ ] **C5: regenerate `REPORT_SHEET_COVERAGE_GAPS.md` once C1-C4 land** (Haiku) — re-run the
  report's own method (JSZip sheet enumeration against the pipeline's reads/writes), refresh
  the date and repo-state line, and delete the closed gaps; the count should fall from
  313/16 untouched toward the residue the report says is deliberate.
- [ ] **F22: the fixed-asset `cellWrites` layout loses five lines on export (S7)** (Opus) —
  Ltd's fixed-asset debit and credit legs collapse to net book value, two Ltd bank opening
  balances are lost, and SE loses its stock adjustment; `app/data/roundtrip-budget.json` holds
  `linesLost` at 4 for Ltd and 1 for SE, and `app/test/verify-roundtrip.test.js`'s ratchet holds
  its own run's count at 5 and 2. Redesign the FA/opening-balance write layout so the legs
  survive export (generator write shapes + the exporter's read-back), then take `linesLost` to 0
  for both products and retire the ratchets. The plan's most self-contained remaining defect.
- [ ] **F23: non-March EQ2 is scored on counts only** (Sonnet) — `generate` shifts every posting
  date onto the package's own accounting period, so a non-March export's dates sit a month or
  two from the fixture's by design; the comparator doesn't undo the shift, the `ltd-may` ratchet
  case skips transaction-level assertions, and `roundtrip-matrix-budget.json` gates only
  `linesLost`/`fieldsDropped`. Teach the comparator to reverse the period-frame shift (the rule
  is documented in the runner conventions: dates shift by the gap between the book's declared
  period and the package's, with end-of-month clamping), then assert transactions in `ltd-may`
  and widen the generate matrices' gates. Unlocks real EQ2 across all year-ends.
- [ ] **F24: payroll `lineItemComment` has no declared home** (Sonnet) — the payslip row has no
  spare column (swept A-AG), so the field is a visible whole-line shortfall rather than a
  declared unrepresentable: declaring it today would blank the field out of the blocks that now
  match, because `roundtrip-unrepresentable.json` is per-product, not per-block. Widen the
  inventory schema to per-block granularity and declare payroll's comment, keeping
  every other block matching; re-seed the whole-line ratchets. The per-block widening was
  deliberately deferred once as riskier-than-scope, so prove the schema change with its own
  tests.
- [ ] **J1: memoize the judge by content** (Sonnet) — `app/bin/judge-reconciliation.js` re-judges
  unchanged digests from `deploy.yml` (every web/infra push plus the daily cron) and the four
  `generate-*` workflows. Hash digest + rubric + model id into `judge-verdict-<product>.json`
  and skip the Bedrock call when the committed verdict's hash matches. This also ends the
  double-judging (generate judges fresh reports; the next deploy re-judges the identical
  committed ones) with no workflow conditions. Biggest saving, zero quality change. Test: the
  memoization skip path in `app/test/judge-reconciliation.test.js`.
- [ ] **J2: cap the judge's output** (Haiku) — `MAX_TOKENS` 16000 → ~2000 in
  `judge-reconciliation.js`, and instruct terse one-line-per-concern output in the prompt;
  output tokens cost ~5× input. Test: the verdict still parses on the existing fixtures.
- [ ] **J3: deduplicate the Ltd digest** (Sonnet) — the Ltd digest folds ~94 near-identical
  year-end runs into one prompt. Collapse to the featured run's full indicators plus one delta
  line per other run; a run whose indicators diverge from the featured one still appears in
  full. Test: the delta digest in `judge-reconciliation.test.js`, including a diverging-run
  case that appears unabridged.
- [ ] **J4: judge on Sonnet, escalate to Opus** (Sonnet; after J1 so the hash keys the model) —
  Sonnet judges by default; a pass stands; a fail or unparseable answer escalates the same
  digest to Opus for confirmation before anything blocks. The rubric is never softened. Test:
  the escalation path with a stubbed client.
- [ ] **J5: cache the shared prompt prefix** (Haiku) — the system preamble + rubric are
  identical across the four products' calls; mark them as a cached prefix (Bedrock prompt
  caching) for the cached-token discount on every call after the first.









## Plans not tracked here

- `PLAN_DIYA_GL_BST_SPIKE.md` — a BST package opens, edits, recalculates and saves as diya-gl in a
  browser page, with the opt-in LLM review as its post-phase-5 extension; specified, not started.
- `PLAN_PACKAGES_TO_ARCHIVE.md` — first cut into the archive repository via the `archive-packages` skill; not started.
- `PLAN_VAT_EXPORT_FOR_SUBMIT.md` — a VAT-return export Submit can import; not started.

## Discipline

- Generated `packages/` output is committed; regenerating is a mass binary commit — one
  deliberate, reviewed commit on a branch, never a scheduled/bot pattern. The structural fix is
  `PLAN_PACKAGES_TO_ARCHIVE.md` at this root: packages move to the `diy-accounting-archive`
  repository and stop being tracked here.
