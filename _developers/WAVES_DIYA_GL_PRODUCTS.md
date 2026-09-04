# Cross-plan waves: SE, Taxi, Ltd

Batch branch `claude/diya-gl-products`. Every workstream is one worktree forked from `main`
that opens by merging the batch branch, one agent, one tier. Rows: `S<n>`/`T<n>` are SE
rows unless prefixed `TX-` (Taxi) or `LT-` (Ltd). Wave 1 (running): TX1 = Taxi T1, TX3 =
Taxi T3, TX2 = Taxi T2+T7+T19, LT16 = Ltd T16+T3, LT5 = Ltd T5, LT19 = Ltd T19.

Conventions:

- A wave starts as the previous wave's workstreams merge; a workstream whose "Waits on"
  names a running row starts the moment that row merges.
- Design workstreams (suffix `-design`) are read-only: the output is a coding brief appended
  to the plan under the row's heading (plus the named draft data file). The coordinator
  merges plan-file appends in dispatch order; they sit under distinct headings.
- Two workstreams in one wave never own the same file, with the exceptions in the
  landing-order table below (one-line appends and disjoint regions); there the later-named
  workstream rebases on the earlier one before its merge.
- Before every push of the batch branch: full `npm test` and `npm run test:browser`. The
  per-workstream "Verify on merge" below is the blast radius from the brief, run by the
  coordinator on the merged batch branch.
- Split rows: Ltd T3 (tail `LT-T3b`), Ltd T4 (`LT-T4a` calculator emissions, `LT-T4b`
  reader and agreement), Ltd T6 (`LT-T6a` edits, `LT-T6b` settlement proof). Reasons in
  the rows.

## Shared-file landing order

| File | Order (wave in brackets) |
|---|---|
| `app/lib/books-engine.js` (one re-export line per row) | S3 (2), S5 (2), T5 (3), S2 (4), S6 (4), S7 (5), S4 (6), T6 (6), TX-T13 (6) |
| `app/lib/xlsx-exporter.js` | TX3 (1), S1 (3), TX-T6 (4), S2 (4), T3 (5), S7 one export (5), TX-T9 (6) |
| `app/products/se.js` | T1 exports (5), T3 one line (5), T2 (6), T4 (7), T16 (8) |
| `app/products/taxi.js` | TX1 (1), TX-T4 (2), TX-T5 (3), TX-T6 (4), TX-T12 (5) |
| `app/products/ltd.js` | LT16 (1), LT-T3b (3), LT-T1 (4), LT-T2 (6), LT-T4b (7), LT-T8 six view ids (8) |
| `app/lib/book-checks.js` | TX2 (1), LT5 hook (1), TX-T8 (2), T5 (3), T6 (6) |
| `app/lib/diya-gl-loader.js` | TX1 (1), TX2 (1), TX-T4 (2), T5 export (3), S7 drops its duplicate export (5) |
| `app/lib/calculators/se.js` | T1 exports (5), S4 row-1 block (6), T16 (8) |
| `app/lib/calculators/taxi.js` | TX-T4 (2), TX-T5 (3), TX-T6 (4) |
| `app/lib/books-interchange.js` | S1 (3), S2 (4), T1 SE entry (5), TX-T10 (6), LT-T2 (6) |
| `app/lib/product-workbook.js` | S3 (2), LT-T1 (4), TX-T11 (5), S4 hook (6), T2 (6) |
| `app/lib/headlines.js` | S5 (2), LT-T3b (3), TX-T12 (5) |
| `app/lib/mcp/diya-gl-tools.js` | S3 (2), S6 (4), TX-T11 (5), T6 (6), T14 (7), LT-T15 (7) |
| `app/lib/overtype-sidecar.js` | S2 (4), TX-T9 (6) |
| `app/test/export-file.test.js` | S1 (3), S2 (4), S6 (4), TX-T11 (5), T14 (7) |
| `web/.../books/data.js` | S7 creates (5), S8 (6), S4 imports (6) |
| `web/.../books/products/se.js` | T7 (7), T8 view entries (7), T13 (10) |
| `scripts/build-books-bundle.mjs` | T2 (6), S8 (6), T8 (7), TX-T16+LT-T10 (7) |
| `scripts/example-books.json` | S8 creates (6), T7 (7), TX-T16+LT-T10 (7), T9 (8) |
| `web/browser-tests/r-sources.js` | T7 (7), T11 (8), TX-T17 (9), LT-T11 (9) |
| `playwright.config.js` | T7 (7), T11 (8), T12 (9), TX-T17 (9), T13 (10), TX-T18 (10), LT-T18 (11) |
| `behaviour-tests/spreadsheets.behaviour.test.js` | TX-T16 (7), T9 (8), LT-T17 (10) |
| `web/.../public/download.html` | TX-T16 (7), T9 (8) |
| `PLAN_*.md` appends | one merge per design workstream, in dispatch order |

## Regeneration points

Dispatch with `skip-commit` on the batch branch; read the reconcile matrix, the roundtrip
scorecard and the judge before the next merge into that area.

| # | After | Workflows |
|---|---|---|
| R1 | TX2 merges (Taxi T19's Class 2 rate) | generate-bst, generate-se, generate-taxi (the Admin echo checks) |
| R2 | LT16 merges (CT600 labels 330 to 440 move the pinned reports) | generate-ltd |
| R3 | TX-T6 merges (wave 4) | generate-taxi (seven year ends; scorecard within `roundtrip-budget.json`); then TX-H1 |
| R4 | T3 merges (wave 5; BrickWork subsets regenerated for se, bst, ltd) | generate-se, generate-bst, generate-ltd (`fieldsDropped` 0 for se) |
| R5 | T16 merges (wave 8; the SE Short template change) | generate-se |
| R6 | the last code merge, before SE-H1 / LT-M1 | all four |

## Wave 2

| Workstream | Rows | Tier | Owns | Waits on | Verify on merge |
|---|---|---|---|---|---|
| `se-s1-design` | S1 design | Opus | `PLAN_DIYA_GL_SE_CLI_MCP_WEB.md` (append under S1) | — | the coding brief is appended with signatures, JSON shapes, test list, byte-identity captures, commands, acceptance; `git diff --stat` names only the plan |
| `se-s4-design` | S4 design | Fable | SE plan (append under S4) | — | brief appended with `LINK_ORDER`, the pinned-list count, the drift third state, tests; plan only |
| `se-s7-design` | S7 design | Fable | SE plan (append under S7) | — | brief appended with the manifest shape, the shell surface, the line-range split of `bst.js`/`bst-data.js`, the selector-only test list; plan only |
| `se-s3` | S3 | Opus | `app/lib/product-workbook.js` (from `bst-workbook.js`), `app/lib/generator.js`, `app/lib/books-engine.js`, `app/lib/mcp/diya-gl-tools.js`, `app/bin/export.js` (import), `app/bin/generate.js`, `web/.../books/save.js`, `app/test/bst-workbook*.test.js`, `app/test/product-workbook.test.js`, `app/test/export-file.test.js:20` | — | `npx vitest run --fileParallelism=false app/test/bst-workbook.test.js app/test/product-workbook.test.js app/test/bst-workbook-roundtrip.test.js app/test/diya-gl-mcp.test.js app/test/export-file.test.js app/test/generate.test.js`; `npm run test:browser`; `grep -rn "saveBstWorkbook\|saveBstPackageZip\|bst-workbook" app web scripts --include=*.js --include=*.mjs` empty |
| `se-s5` | S5 | Sonnet | `app/lib/headlines.js` (from `bst-headlines.js`), `app/products/bst.js`, `app/lib/books-engine.js` (one line, after S3), `web/.../books/bst-data.js` (one call), `app/test/bst-headlines.test.js` | — | `npx vitest run --fileParallelism=false app/test/bst-headlines.test.js`; `npm run test:browser`; `grep -c "cell/" app/lib/headlines.js` is 0. Dispatch note: the reducer must take the optional keys Ltd T3 (`dividends`, `taxSecond`, `assetsSecond`) and Taxi T12 (`pieLines`, `vehicle`) declare, BST output byte-identical |
| `se-t15` | T15 | Sonnet | `app/data/hmrc/sa103f_mapping_v3.csv`, `app/data/hmrc/SOURCE.md`, `app/data/hmrc/sa103-mtd-mapping.json`, `app/test/sa103-mtd-mapping.test.js` | — (network) | `npx vitest run --fileParallelism=false app/test/sa103-mtd-mapping.test.js`; SHA-256 recorded |
| `taxi-t4` | TX-T4 | Sonnet | `examples/basic-taxi-driver/`, `examples/kestrel-executive-cars/`, `app/lib/scenario-extractor.js`, `app/lib/diya-gl-loader.js` (the taxi `totalSales` branch), `app/lib/calculators/taxi.js` (income path), `app/products/taxi.js` (`checkCompliance`, VitalTax rows), `app/test/calculator-taxi.test.js`, regenerated `app/test/fixtures/taxi-*.toml` and `examples/*/taxi/` | TX1, TX2 (T7) | `node app/bin/extract-scenarios.js && git diff --stat`; `npx vitest run --fileParallelism=false app/test/calculator-taxi.test.js app/test/diya-gl-loader.test.js app/test/taxi-writer.test.js`; `npm run reconciliation -- --package taxi --year-end 2026-04-05` every report RECONCILES; sync gate clean |
| `taxi-t8` | TX-T8 | Sonnet | `app/lib/book-checks.js` (the Taxi warnings block, `runWarnings`), `app/test/book-checks.test.js` | TX2 (T2), LT5 (hook) | `npx vitest run --fileParallelism=false app/test/book-checks.test.js`; eight rules on a BST book, eleven on Taxi |
| `ltd-t6a` | LT-T6a (`changePayrollLine`, `setDividend`, `setMembers`, `setCharges`; all tests but the settlement proof) | Opus | `app/lib/diya-gl-edits-ltd.js`, `app/test/diya-gl-edits-ltd.test.js` | LT5 (test command only) | `npx vitest run --fileParallelism=false app/test/diya-gl-edits-ltd.test.js app/test/diya-gl-edit-recalc.test.js app/test/book-checks-ltd.test.js`. Split: the settlement half needs T6 and is `LT-T6b` (wave 7) |

## Wave 3

| Workstream | Rows | Tier | Owns | Waits on | Verify on merge |
|---|---|---|---|---|---|
| `se-s1` | S1 code | Opus | `app/lib/workbook-set.js`, `app/lib/xlsx-exporter.js` (six signatures, three openers), `app/lib/books-interchange.js`, `app/bin/export.js` (`--source-dir` path), `web/.../books/xlsx-cells.js`, `app/test/books-interchange.test.js`, `app/test/xlsx-exporter.test.js`, `app/test/se-sales-mileage-checks.test.js`, `app/test/se-purchases-mileage-route.test.js`, `web/browser-tests/books-formats.browser.test.js` (one expectation) | `se-s1-design`, TX3 | BST regression net: `npx vitest run --fileParallelism=false app/test/books-interchange.test.js app/test/export-file.test.js app/test/diya-gl-mcp.test.js app/test/bst-workbook.test.js app/test/bst-workbook-roundtrip.test.js app/test/bst-headlines.test.js app/test/overtype-sidecar.test.js app/test/book-checks.test.js`; `npm run test:browser`; the four `export.js --source-dir` outputs byte-identical to the captures; `grep -n "tmpdir\|rmSync\|mkdirSync" app/lib/books-interchange.js` empty |
| `se-t5` | T5 | Opus | `app/lib/book-checks.js` (SE rules, `bankBalancesByMonth`, `applyBookHelper`), `app/lib/diya-gl-edits.js` (`changeLineBankAccount`), `app/lib/diya-gl-loader.js` (`export PURCHASE_CODE_MAPS`), `app/lib/books-engine.js`, `app/test/book-checks.test.js` | `taxi-t8`, `taxi-t4` (loader) | `npx vitest run --fileParallelism=false app/test/book-checks.test.js app/test/export-file.test.js app/test/diya-gl-mcp.test.js`; `npm run test:browser`; BST `bookchecks.json` bytes unchanged |
| `taxi-t5` | TX-T5 | Opus | `examples/autumn-start-cabs/` and its `taxi/` subset, `app/test/fixtures/taxi-scenario-autumn-start.toml`, `app/bin/extract-scenarios.js`, `app/lib/calculators/taxi.js` (Forecast block), `app/products/taxi.js` (Forecast checks), `app/test/calculator-taxi.test.js`, `app/test/taxi-wages-forecast-checks.test.js` | `taxi-t4` | `node app/bin/extract-scenarios.js && git diff --stat`; `npx vitest run --fileParallelism=false app/test/calculator-taxi.test.js app/test/taxi-wages-forecast-checks.test.js`; `npm run reconciliation -- --package taxi --scenario autumn-start --year-end 2026-04-05` RECONCILES; sync gate clean |
| `ltd-t3b` | LT-T3b (the T3 declaration swaps its local reducer copy for `headlines.js`; the `dividends`/second-line keys land in the reducer if S5 left them out) | Sonnet | `app/products/ltd.js` (declaration only), `app/lib/headlines.js`, `app/test/ltd-headlines.test.js` | LT16, `se-s5` | `npx vitest run --fileParallelism=false app/test/ltd-headlines.test.js app/test/bst-headlines.test.js` |
| `ltd-t4-design` | LT-T4 design | Fable | Ltd plan (append under T4), `app/test/fixtures/ltd-link-cells.json` (first cut) | `se-s4-design` | brief appended naming S4's names, the emitted-cell builders, the tiers of `LT-T4a` and `LT-T4b`; the fixture parses |
| `ltd-t8-design` | LT-T8 design | Opus | Ltd plan (append under T8), `app/data/hmrc/form-layouts/ltd.json` (draft) | `se-s7-design`, LT16 | brief appended with the layout shape shared with T8, the two-source box, the stacked-row margin mark, the voucher; `ltd.json` parses |
| `taxi-t13-design` | TX-T13 design | Fable | Taxi plan (append under T13) | `se-s7-design` | brief appended answering the four design questions and briefing T13 code, T14 and T15 (snapshot fields, `data-*` hooks, CSS classes, selectors) |

## Wave 4

| Workstream | Rows | Tier | Owns | Waits on | Verify on merge |
|---|---|---|---|---|---|
| `se-s2` | S2 | Sonnet | `app/lib/anchors/run.js`, `app/lib/anchors/bst.js`, `app/lib/xlsx-exporter.js` (map recording; after `taxi-t6`), `app/lib/overtype-sidecar.js`, `app/lib/books-interchange.js`, `app/lib/books-engine.js`, `app/test/overtype-sidecar.test.js`, `app/test/books-interchange.test.js`, `app/test/export-file.test.js` | `se-s1` | `npx vitest run --fileParallelism=false app/test/overtype-sidecar.test.js app/test/books-interchange.test.js app/test/export-file.test.js app/test/diya-gl-mcp.test.js app/test/xlsx-exporter.test.js`; `npm run test:browser`; BST `export.js --file` output and `overtyped.json` byte-identical; `grep -n "validateBstAnchors\|BstAnchorError" app/lib/xlsx-exporter.js` empty |
| `se-s6` | S6 | Sonnet | `app/lib/products.js`, `app/lib/books-engine.js` (after S2), `app/lib/mcp/*.js`, `app/bin/diya-gl-mcp.js`, `.mcp.json`, `app/bin/export.js` (file mode), `app/bin/generate.js`, `app/test/diya-gl-mcp.test.js`, `app/test/export-file.test.js` (after S2) | `se-s1`, `se-s3`, `se-s5` | `npx vitest run --fileParallelism=false app/test/export-file.test.js app/test/diya-gl-mcp.test.js app/test/books-interchange.test.js`; `npm run test:browser`; `grep -rn "diya-gl-bst" . --exclude-dir=node_modules --exclude-dir=packages --exclude-dir=target` empty |
| `taxi-t6` | TX-T6 | Sonnet | `app/products/taxi.js` (`CELL_MAP`, Business Details writes, new checks), `app/lib/xlsx-exporter.js` (`ENTITY_CELLS.taxi`, `extractMetadata`; lands before S2), `app/lib/calculators/taxi.js` (Business Details, `J1`, `C1`, `K1`, `E25`, `E26`), `CONTEXT_TAXI.md`, `app/test/calculator-taxi.test.js`, `app/test/xlsx-exporter.test.js`, `app/test/taxi-writer.test.js` | TX1, TX3, `taxi-t4`, `taxi-t5` | `npx vitest run --fileParallelism=false app/test/calculator-taxi.test.js app/test/xlsx-exporter.test.js app/test/taxi-writer.test.js app/test/export-file.test.js`; `npm run reconciliation -- --package taxi --year-end 2026-04-05` RECONCILES; export capture shows only the four `entityInformation` fields moving; **R3** |
| `ltd-t1` | LT-T1 | Opus | `app/products/ltd.js` (`WRITER_PROFILE`, after `ltd-t3b`), `app/lib/product-workbook.js` (Ltd branch: docx copy, twelve-month refusal; S3 already wires the arguments and the year-end sequence, verify before editing), `app/test/ltd-workbook.test.js` | `se-s3` | `npx vitest run --fileParallelism=false app/test/ltd-workbook.test.js app/test/bst-workbook.test.js`; `report.js --package ltd --source-dir <saved> --mode saved` writer-input keys equal `--data` |
| `ltd-t4a` | LT-T4a (the calculator emits every link-addressed leaf cell; the pinned list; no reader, no refresh) | per `ltd-t4-design` (default Fable) | `app/lib/calculators/ltd.js`, `app/test/fixtures/ltd-link-cells.json`, `app/test/ltd-link-caches.test.js` (the coverage test) | `ltd-t4-design` | `npx vitest run --fileParallelism=false app/test/ltd-link-caches.test.js app/test/calculator-ltd.test.js app/test/ltd-precision-code.test.js`; `report.js --package ltd --data examples/precision-code-ltd/full` `check/` values unchanged from main. Split: needs no S4 code |
| `taxi-t14-design` | TX-T14 design | Fable | Taxi plan (append under T14) | `taxi-t13-design` | brief appended: the four levels, the add controls, the selector list T17 needs |
| `taxi-t15-design` | TX-T15 design | Opus | Taxi plan (append under T15) | `taxi-t13-design`, TX2 (T19) | brief appended: the layout module decision (shared with T8 or `form-layouts/taxi.json`), the no-cell box key, the margin placement, the selector list |

## Wave 5

| Workstream | Rows | Tier | Owns | Waits on | Verify on merge |
|---|---|---|---|---|---|
| `se-t1` | T1 | Sonnet | `app/lib/anchors/se.js`, `app/products/se.js` (exports only; lands before T3), `app/lib/books-interchange.js` (SE entry), `app/lib/calculators/se.js` (two exports), `app/test/se-anchors.test.js`, `app/test/books-interchange.test.js`, `app/test/overtype-sidecar.test.js` | `se-s2` | `npx vitest run --fileParallelism=false app/test/se-anchors.test.js app/test/books-interchange.test.js app/test/overtype-sidecar.test.js app/test/export-file.test.js`; BST net |
| `se-t3` | T3 | Opus | `app/lib/xlsx-exporter.js` (SE CIS reads), `app/products/se.js` (one line, after T1), `app/lib/scenario-extractor.js`, `examples/brickwork-pro/lines.jsonl` and regenerated subsets, `app/test/fixtures/{se,bst,ltd}-brickwork-pro-*.toml`, `app/bin/extract-scenarios.js` (if needed), `app/data/roundtrip-unrepresentable.json`, `app/test/xlsx-exporter.test.js`, `app/test/se-reconciliation-checks.test.js` | `se-s2` | `npx vitest run --fileParallelism=false app/test/xlsx-exporter.test.js app/test/scenario-extractor.test.js app/test/se-reconciliation-checks.test.js app/test/se-brickwork-pro-nonvat.test.js app/test/calculator-se.test.js app/test/verify-roundtrip.test.js`; sync gate clean; BST net; **R4** |
| `se-s7` | S7 code | Fable | `web/.../books/shell.js`, `books/data.js` (from `bst-data.js`), `books/products/bst.js`, `books/bst.html`, `books/books.css`, `books/bst.css`, `books/probe.js`, `books/save-probe.js`, `books/headlines-probe.html`, `app/lib/xlsx-exporter.js` (`export STOCK_CELLS`, after T3), `app/lib/diya-gl-loader.js` (only if T5 left `PURCHASE_CODE_MAPS` unexported), `app/lib/books-engine.js`, `app/data/render-unrepresentable/bst.json` (moved), `web/browser-tests/*.browser.test.js` (selectors, two paths), `web/browser-tests/books-shell.browser.test.js` | `se-s7-design`, `se-s6` | `npm run test:browser` green, no spec skipped; `wc -l` gate (4,020 + 10%); `grep -c "Profit & Loss Acc" books/products/bst.js` is 0; behaviour probe local |
| `taxi-t11` | TX-T11 | Sonnet | `app/lib/product-workbook.js` (Taxi entry, only what S3 left), `app/bin/export.js` and `app/lib/mcp/diya-gl-tools.js` (only what S6 left; lands before T6), `app/test/taxi-workbook.test.js`, `app/test/export-file.test.js`, `app/test/diya-gl-mcp.test.js` | `se-s3`, `se-s6`, TX1 | `npx vitest run --fileParallelism=false app/test/taxi-workbook.test.js app/test/export-file.test.js app/test/diya-gl-mcp.test.js app/test/bst-workbook.test.js`; `export.js --package taxi --file examples/taxi-latest/GB_Accounts_Taxi_Driver.xlsx` diff against `--source-dir` silent |
| `taxi-t12` | TX-T12 | Sonnet | `app/products/taxi.js` (`HEADLINES`), `app/lib/headlines.js` (`pieLines`, `vehicle` if S5 lacks them), `app/test/taxi-headlines.test.js` | `se-s5`, `taxi-t6`, `ltd-t3b` | `npx vitest run --fileParallelism=false app/test/taxi-headlines.test.js app/test/bst-headlines.test.js app/test/ltd-headlines.test.js` |

## Wave 6

| Workstream | Rows | Tier | Owns | Waits on | Verify on merge |
|---|---|---|---|---|---|
| `se-s4` | S4 code | Fable | `app/lib/link-caches.js`, `app/lib/spreadsheet-runner.js` (delegates), `app/lib/calculators/se.js` (row-1 block), `app/lib/product-workbook.js` (`writer.refreshLinkCaches` body; lands before T2), `app/lib/books-engine.js`, `app/test/link-cache.test.js`, `web/.../books/drift.js`, `web/.../books/data.js` (import lines; after S8) | `se-s4-design`, `se-s3`, `se-t3`, `se-s7` | `npx vitest run --fileParallelism=false app/test/link-cache.test.js` plus the brief's list; every `externalLinkN.xml` over `examples/se-latest` and `examples/ltd-latest` byte-identical to the captures; advanced scenario RECONCILES through `report.js --mode recalculate`; `npm run test:browser` |
| `se-t2` | T2 | Opus | `app/products/se.js` (`cellWrites` body), `app/lib/product-workbook.js` (SE argument, if S3 left it), `scripts/build-books-bundle.mjs` (SE template rows; lands before S8), `app/test/se-workbook.test.js` | `se-s3`, `se-t1`, `se-t5` | `npx vitest run --fileParallelism=false app/test/se-workbook.test.js app/test/product-workbook.test.js app/test/bst-workbook.test.js`; `node scripts/build-books-bundle.mjs` (ten `templates/se/` files); `npm run test:browser`; `grep -n "throw new Error" app/products/se.js` shows no throw in `cellWrites` |
| `se-t6` | T6 | Opus | `app/lib/diya-gl-edits.js` (`addBankLine`), `app/lib/book-checks.js` (settlement section), `app/lib/mcp/diya-gl-tools.js` (edit map), `app/lib/books-engine.js` (after S4), `app/test/settlement-helpers.test.js` | `se-t5`, `se-s6` | `npx vitest run --fileParallelism=false app/test/settlement-helpers.test.js app/test/book-checks.test.js app/test/diya-gl-mcp.test.js app/test/diya-gl-edit-recalc.test.js`; `EDITS` lists seven |
| `se-s8` | S8 | Haiku | `scripts/example-books.json`, `scripts/build-books-bundle.mjs` (`EXAMPLE_BOOKS`; after T2), `web/.../books/examples.js` (generated, gitignored), `books/shell.js`, `books/data.js` (example lists out), `web/browser-tests/books-deep-links.browser.test.js`, `web/browser-tests/books-bundle-gate.browser.test.js` | `se-s7` | `node scripts/build-books-bundle.mjs`; `npm run test:browser`; `grep -rn "bst-sp-sixty" web/.../books/*.js scripts/*.mjs` finds only the generated file |
| `taxi-t9` | TX-T9 | Sonnet | `app/lib/xlsx-exporter.js` (Taxi extraction-map block, `taxiBookFieldCells`, `isTaxiInputCell`), `app/lib/overtype-sidecar.js` (Taxi baseline), `app/test/overtype-sidecar.test.js`, `app/test/xlsx-exporter.test.js` | `se-s2`, TX3, `taxi-t6` | `npx vitest run --fileParallelism=false app/test/overtype-sidecar.test.js app/test/xlsx-exporter.test.js`; `overtyped.json` for `examples/taxi-latest` is `{}` |
| `taxi-t10` | TX-T10 | Sonnet | `app/lib/anchors/taxi.js`, `app/lib/books-interchange.js` (Taxi entry; lands before LT-T2), `app/test/books-interchange.test.js` | `se-s2` | `npx vitest run --fileParallelism=false app/test/books-interchange.test.js`; 33 sheets, 13 headers |
| `taxi-t13` | TX-T13 code | per `taxi-t13-design` (default Fable) | `web/.../books/products/taxi.js`, `app/data/render-unrepresentable/taxi.json`, `app/lib/books-engine.js` (two exports, after T6), the manifest Node test | `taxi-t13-design`, `se-s7`, `taxi-t6` | `node scripts/build-books-bundle.mjs`; the manifest test; `npm run test:browser` unchanged in count and outcome |
| `ltd-t2` | LT-T2 | Sonnet | `app/lib/anchors/ltd.js`, `app/lib/books-interchange.js` (Ltd entry; after TX-T10), `app/products/ltd.js` (layout exports, after LT-T1), `app/test/ltd-anchors.test.js` | `se-s2`, `se-t1`, `ltd-t1` | `npx vitest run --fileParallelism=false app/test/ltd-anchors.test.js app/test/overtype-sidecar.test.js app/test/xlsx-exporter.test.js` |
| `ltd-t7` | LT-T7 | Sonnet | `web/.../books/products/ltd.js`, `books/products/ltd-ledger.js`, `books/ltd.html`, `books/ltd.css` | `se-s7`, LT16 (T3) | `node scripts/build-books-bundle.mjs`; `npx playwright test --project=browser-tests web/browser-tests/books-bundle-gate.browser.test.js` with `books/ltd.html?example=ltd-scenario-full` booting; every VIEWS id renders with no console error |

## Wave 7

| Workstream | Rows | Tier | Owns | Waits on | Verify on merge |
|---|---|---|---|---|---|
| `se-t7` | T7 | Opus | `web/.../books/products/se.js`, `books/se.html`, `books/se.css`, `scripts/example-books.json` (one row), `web/browser-tests/books-se.browser.test.js`, `web/browser-tests/r-sources.js` (`s2` product argument), `playwright.config.js` (one line) | `se-s7`, `se-s4`, `se-t5`, `se-t6` | `node scripts/build-books-bundle.mjs`; `npx playwright test --project=browser-tests web/browser-tests/books-se.browser.test.js`; `npm run test:browser` |
| `se-t8` | T8 | Sonnet | `web/.../books/products/se-forms.js`, `app/data/hmrc/form-layouts/se.json`, `app/test/se-form-layouts.test.js`, `scripts/build-books-bundle.mjs` (copies the layout; after S8, before TX-T16), `books/products/se.js` (four view entries, after T7) | `se-s7`, `se-t7` | `npx vitest run --fileParallelism=false app/test/se-form-layouts.test.js`; `grep -c '"cell": "' app/data/hmrc/form-layouts/se.json` at least 80; `npm run test:browser` |
| `se-t14` | T14 | Sonnet | `app/bin/export.js` (only if the SE run shows a gap), `app/lib/mcp/diya-gl-tools.js` (description; lands before LT-T15), `app/test/export-file.test.js`, `app/test/diya-gl-mcp.test.js` | `se-s6`, `se-t2` | `npx vitest run --fileParallelism=false app/test/export-file.test.js app/test/diya-gl-mcp.test.js`; `npm run export -- --package se --file <zip>` prints the product and four files |
| `se-t4` | T4 | Sonnet | `app/products/se.js` (`HEADLINES`, after T2), `app/test/se-headlines.test.js` | `se-s5`, `se-t3`, `se-t2` | `npx vitest run --fileParallelism=false app/test/se-headlines.test.js app/test/bst-headlines.test.js` |
| `taxi-t14` | TX-T14 code | per `taxi-t14-design` (default Fable) | `web/.../books/products/taxi-takings.js`, `web/.../books/taxi.css` | `taxi-t14-design`, `taxi-t13` | `node scripts/build-books-bundle.mjs`; bundle-gate spec on `books/taxi.html` (needs TX-T16's page; until then the manifest test); `npm run test:browser` unchanged |
| `taxi-t16-ltd-t10` | TX-T16, LT-T10 | Sonnet | `scripts/example-books.json` (three Taxi rows, three Ltd rows; after T7), `scripts/build-books-bundle.mjs` (Taxi and Ltd template assets, `ltd-*.toml`; after T8), `web/.../books/taxi.html`, `web/.../public/download.html` (Taxi link), `behaviour-tests/spreadsheets.behaviour.test.js` (the Taxi probe, first append after the BST probe), `web/browser-tests/books-ltd-deep-links.browser.test.js` | `se-s8`, TX2 (T7), `taxi-t13`, `ltd-t7` | `npm run build:books-bundle` (Taxi and fourteen Ltd template files present, eight `ltd-*.toml`); `npx playwright test --project=browser-tests web/browser-tests/books-ltd-deep-links.browser.test.js`; `npm run test:browser`; `npm run test:spreadsheetsBehaviour-local` against `npm start` |
| `ltd-t4b` | LT-T4b (`linkCacheReader(results)`, the cache-agreement test, the pure-refresh byte test, the stale-cache test) | per `ltd-t4-design` (default Fable) | `app/products/ltd.js` (`linkCacheReader`, after LT-T2), `app/test/ltd-link-caches.test.js` | `ltd-t4a`, `se-s4`, `ltd-t1` | `npx vitest run --fileParallelism=false app/test/ltd-link-caches.test.js app/test/calculator-ltd.test.js app/test/ltd-workbook.test.js`; the agreement test compares at least 2,334 cells |
| `ltd-t6b` | LT-T6b (the four settlement helpers proved on the Ltd full fixture; the filter widened through T5's hook if SE's specs filter by account) | Sonnet | `app/test/diya-gl-edits-ltd.test.js` (settlement section), `app/lib/book-checks/ltd.js` (filter only) | `ltd-t6a`, `se-t6`, LT5 | `npx vitest run --fileParallelism=false app/test/diya-gl-edits-ltd.test.js app/test/book-checks-ltd.test.js app/test/settlement-helpers.test.js` |
| `ltd-t15` | LT-T15 | Sonnet | `app/test/export-file-ltd.test.js`, `app/test/mcp-ltd.test.js`, `app/lib/mcp/diya-gl-tools.js` (edit map append, `edit_lines` returns `book`, xlsx refusal; after T14) | `se-s1`, `se-s6`, `ltd-t1`, `ltd-t2`, `ltd-t6a` | `npx vitest run --fileParallelism=false app/test/export-file-ltd.test.js app/test/mcp-ltd.test.js app/test/export-file.test.js app/test/diya-gl-mcp.test.js` |

## Wave 8

| Workstream | Rows | Tier | Owns | Waits on | Verify on merge |
|---|---|---|---|---|---|
| `se-t9` | T9 | Sonnet | `scripts/example-books.json` (two rows), `web/.../public/download.html` (SE link; after TX-T16), `behaviour-tests/spreadsheets.behaviour.test.js` (append after the Taxi probe), `web/browser-tests/books-deep-links.browser.test.js` (one SE case) | `se-s8`, `se-t7`, `taxi-t16-ltd-t10` | `npm run test:spreadsheetsBehaviour-local` against `npm start`; `npm run test:browser` |
| `se-t11` | T11 | Opus | `web/browser-tests/books-se-equivalence.browser.test.js`, `books-se-formats.browser.test.js`, `web/browser-tests/r-sources.js` (`SCENARIOS_SE`, `s3Se`, `s2ForPackage`), `playwright.config.js` (two lines) | `se-t7`, `se-t8`, `se-s4`, `se-t3`, `se-t14` | `npx playwright test --project=browser-tests web/browser-tests/books-se-equivalence.browser.test.js web/browser-tests/books-se-formats.browser.test.js`; `npm run test:browser`; no allowlist |
| `se-t16` | T16 | Opus | `app/templates/se/Financialaccounts.xlsx`, `app/lib/calculators/se.js` (threshold, `A33`, `D124`, `O124`), `app/products/se.js` (SE Short labels, two `CELL_MAP` rows, `profitBridge`; after T4), `CONTEXT_SELF_EMPLOYED.md`, `app/test/se-full-return-checks.test.js`, `app/test/calculator-se.test.js`, `packages/GB Accounts Self Employed */Financialaccounts.xlsx` (one reviewed binary commit) | `se-t4` | `node app/bin/generate.js --package se --skip-guide`; `npx vitest run --fileParallelism=false app/test/calculator-se.test.js app/test/se-full-return-checks.test.js app/test/se-reconciliation-checks.test.js app/test/se-precision-code.test.js app/test/se-brickwork-pro-nonvat.test.js app/test/report-serializer.test.js app/test/report-generator.test.js`; the SE Short sheet XML carries no `30000`/`67000`; **R5** |
| `taxi-t15` | TX-T15 code | per `taxi-t15-design` (default Opus) | `web/.../books/products/taxi-views.js`, `web/.../books/products/taxi-forms.js`, `app/data/hmrc/form-layouts/taxi.json` (only if the design chose a per-product layout) | `taxi-t15-design`, `taxi-t13`, `se-t8`, TX2 (T19) | `node scripts/build-books-bundle.mjs`; bundle-gate spec on `books/taxi.html?example=taxi-scenario-basic`; `npm run test:browser` unchanged |
| `ltd-t8` | LT-T8 code | per `ltd-t8-design` (default Opus) | `web/.../books/products/ltd-forms.js`, `app/data/hmrc/form-layouts/ltd.json`, `books/products/ltd.js` (six view ids, after LT-T7) | `ltd-t8-design`, `ltd-t7`, `se-t8` | the A9 Node test the brief carries; `node scripts/build-books-bundle.mjs`; the six views render on `ltd-scenario-full` with no console error; re-run `npx vitest run --fileParallelism=false app/test/filing-data.test.js` (LT19's layout test) |
| `ltd-t13` | LT-T13 | Sonnet | `web/browser-tests/books-ltd-edits.browser.test.js`, `books-ltd-warnings.browser.test.js` | LT5, `ltd-t6b`, `ltd-t7` | `npx playwright test --project=browser-tests web/browser-tests/books-ltd-edits.browser.test.js web/browser-tests/books-ltd-warnings.browser.test.js` |

## Wave 9

| Workstream | Rows | Tier | Owns | Waits on | Verify on merge |
|---|---|---|---|---|---|
| `se-t12` | T12 | Sonnet | `web/browser-tests/books-se-edits.browser.test.js`, `playwright.config.js` (one line; lands before TX-T17) | `se-t5`, `se-t6`, `se-t7`, `se-t11` | `npx playwright test --project=browser-tests web/browser-tests/books-se-edits.browser.test.js`; `expect.poll` only |
| `se-t10` | T10 | Haiku | `app/data/render-unrepresentable/se.json`, `web/browser-tests/books-render-coverage.browser.test.js` (second describe) | `se-t7`, `se-t8`, `se-t16` | `npx playwright test --project=browser-tests web/browser-tests/books-render-coverage.browser.test.js` |
| `taxi-t17` | TX-T17 | Sonnet | `web/browser-tests/books-taxi-{equivalence,formats,edits,layouts}.browser.test.js`, `web/browser-tests/r-sources.js` (Taxi scenarios; after T11, before LT-T11), `playwright.config.js` (four lines, after T12) | `taxi-t11`, `taxi-t14`, `taxi-t15`, `taxi-t16-ltd-t10`, TX-H1 (the refreshed `examples/taxi-latest` for S3) | `npx playwright test --project=browser-tests web/browser-tests/books-taxi-*.browser.test.js`; `npm run test:browser`; the A7 proof names exactly `cell/SalesMay!E1`'s dependants |
| `ltd-t9` | LT-T9 | Haiku | `app/data/render-unrepresentable/ltd.json`, `web/browser-tests/books-ltd-render-coverage.browser.test.js` | `ltd-t7`, `ltd-t8` | `node scripts/build-books-bundle.mjs && npx playwright test --project=browser-tests web/browser-tests/books-ltd-render-coverage.browser.test.js` |
| `ltd-t11` | LT-T11 | Opus | `web/browser-tests/r-sources.js` (Ltd scenarios; after TX-T17), `web/browser-tests/books-ltd-equivalence.browser.test.js` | `ltd-t1`, `ltd-t2`, `ltd-t4b`, `ltd-t7`, `ltd-t8`, `se-t11` | `npx playwright test --project=browser-tests web/browser-tests/books-ltd-equivalence.browser.test.js`; A3's shared-key count equals S3's `cell/` count |
| `ltd-t14` | LT-T14 | Sonnet | `web/browser-tests/books-ltd-layouts.browser.test.js` | `ltd-t7`, `ltd-t8` | `npx playwright test --project=browser-tests web/browser-tests/books-ltd-layouts.browser.test.js`; eight axe runs at zero serious or critical |

## Wave 10

| Workstream | Rows | Tier | Owns | Waits on | Verify on merge |
|---|---|---|---|---|---|
| `se-t13` | T13 | Fable | `web/.../books/products/se.js`, `books/se.css`, `web/browser-tests/books-se-layouts.browser.test.js`, `playwright.config.js` (one line; lands before TX-T18) | `se-t7`, `se-t8`, `se-t12` | `npx playwright test --project=browser-tests web/browser-tests/books-se-layouts.browser.test.js`; `npm run test:browser`; zero serious or critical axe violations at four viewports |
| `taxi-t18` | TX-T18 | Sonnet | `web/browser-tests/books-taxi-forms.browser.test.js`, `playwright.config.js` (one line, after T13) | `taxi-t15`, `taxi-t17` | `npx playwright test --project=browser-tests web/browser-tests/books-taxi-forms.browser.test.js` on both routes |
| `ltd-t12` | LT-T12 | Sonnet | `web/browser-tests/books-ltd-formats.browser.test.js` | `ltd-t1`, `ltd-t2`, `ltd-t11` | `npx playwright test --project=browser-tests web/browser-tests/books-ltd-formats.browser.test.js`; E3 exact |
| `ltd-t17` | LT-T17 | Sonnet | `behaviour-tests/spreadsheets.behaviour.test.js` (append after the SE probe) | `taxi-t16-ltd-t10`, `se-t9`, `ltd-t11` | `npm run test:spreadsheetsBehaviour-local` against `npm start` with the bundle built |

## Wave 11

| Workstream | Rows | Tier | Owns | Waits on | Verify on merge |
|---|---|---|---|---|---|
| `ltd-t18` | LT-T18 | Haiku | `playwright.config.js` (seven Ltd spec names, after TX-T18) | `ltd-t9`, `ltd-t11`, `ltd-t12`, `ltd-t13`, `ltd-t14`, `taxi-t18` | `npm run test:browser 2>&1 | tee <scratch>/browser-all.log` green |

## Close-out (human rows)

| Row | When | What |
|---|---|---|
| TX-H1 | after **R3** (wave 4) is green | merge the batch PR to main; the generate-taxi refresh on main re-pins `reports/*taxi*`, `reports/judge-verdict-taxi.json`, `examples/taxi-latest`; the batch branch rebases. Gates `taxi-t17` |
| SE-H1 | after wave 10 and **R6** | merge; the generate-se refresh on main (re-pins `reports/*se-scenario-advanced.md`, `examples/se-latest`; T11's S3 rides it) |
| LT-M1 | after wave 11 and **R6** | merge; the generate-ltd refresh on main (re-pins `reports/*_ltd-scenario-full.md`) |
