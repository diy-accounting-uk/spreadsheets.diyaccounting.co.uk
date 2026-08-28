# PLAN: Reconciliation coverage, published reports, and an LLM judge

Status: scoping approved. Draft PR #27 (VAT data flow) grows to include item 1 before
it merges; the pages for all four products are their own independent PR.

## User assertions (verbatim)

> what I want is to model actual customer experiences where the Balance Sheet is the sheet
> of interest but data entry in Sales, Purchases or a cash and bank sheet and to the
> balance sheet via the trial balance and picking up interactions with fixed assets,
> payroll and VAT. I want the testimg top be pragmatic in determining where a path is not
> materially different from another (e.g. a mechanical repetition in generation) but we
> still need general in sheet cover (like a "unit test") that makes sure we don't have
> rows with missing formulae.

> think about a publishable reconciliation page we can link to on the website that is
> updated on deployment with a long HTML pages showing a summary, then the input
> transactions, followed by screenshots and comparison tables showing the actual
> reconciliation and a review of the corporation tax.

> I am thinking we use the same mechanism for an LLM as judge on the final reconciliation
> report and publish it's summary, and a pass or fail verdict where failure is a
> deployment workflow job failure.

> for item 5 I would like the financial accounts fixed assets in the directors report to
> be compared with the fixed assets sheets. I would also like the P&L checked and the
> coproration tax.

> plus one more the monthly P& L should match the monthly sales and purchases. Also expand
> this to include all the other packages and they should have a report too.

> Do we have a reconciliation page for each product? - If not do that, the structures
> should be the same so we can see Taxi, BST to SE to LTD have the same features
> reconciled and the larger packages have more.

## Part 1: test improvements

Applies to all four packages where the feature exists: Ltd (Company), SE (Self Employed),
BST (Basic Sole Trader), Taxi. The Products column names where each check lands.

| # | Improvement | Products | What it covers | Effort |
|---|---|---|---|---|
| 1 | Assert the trial balance audit cell (Ltd: `TrialBalance!EJ91`; find each product's equivalent self-check cell) | all | Whole-book closure. Any posting that does not balance, anywhere. Read today, never asserted. | S |
| 2 | Balance sheet identities (net current assets, total assets less current liabilities, balance vs capital and reserves) | Ltd, SE | The customer's sheet of interest. Ltd `PubBalSht` is read today with zero assertions. | S |
| 3 | Fixture-anchored balance sheet expected values in scenarios | all | Catches output that is self-consistent but wrong on both sides of an identity. | M |
| 4 | Monthly payroll entries in scenarios plus WagesInterface reads | Ltd, SE | Payslips to hub wages flow and PAYE/NI creditor lines. Written today, never verified downstream. | M |
| 5 | Fixed assets tie-outs (detail below) | Ltd, SE | Fixed asset note vs schedule, P&L depreciation, corporation tax treatment. | M |
| 6 | Read bank closing balances, reconcile to scenario cash movements | Ltd, SE | Bank files to balance sheet cash lines. Ltd has four bank files, none read. | M |
| 7 | Replace self-comparing debtors/creditors checks with real sheet reads | Ltd, SE | Current checks compare a fixture total to itself and can never fail. | S |
| 8 | VAT chain: Sales/Purchases through Vatinterface to the VATQtr boxes | Ltd | Parked as draft PR #27. The bug class that shipped in #24. | parked |
| 9 | SE VAT box-level value checks (needs the runner fix in #27) | SE | SE Vat.xlsx is checked for presence only today. | S |
| 10 | Monthly P&L matches monthly sales and purchases | all | Each month column in the P&L ties to that month's totals in Sales.xlsx and Purchases.xlsx (or the equivalent single-file month sheets). Catches a month landing in the wrong column or dropping out. | M |
| 11 | In-sheet formula-presence guard (shared-formula gap scan, JSZip, every shipped package) | all | The "unit test" tier. A row missing its formula anywhere in the catalogue, in seconds, no LibreOffice. | M |
| 12 | Run `brickwork-pro-vat` in CI reconciliation alongside `full` | Ltd, SE | Purchase VAT signal. The `full` scenario has zero input VAT. | S |
| 13 | Roundtrip fidelity on one non-March year-end | Ltd | Export/import on the rewritten-formula path the March-only run never exercises. | S |
| 14 | Shrink the LibreOffice year-end matrix to 2 or 3 representative year-ends | Ltd | Recovers CI minutes. The year-ends are mechanical rotations; the JSZip guards cover the per-year-end variation across all packages. | S |

### Item 5 in detail: fixed assets, P&L, corporation tax

One naming finding. The `Report` sheet (directors' report page) carries no fixed asset
figures. In this template the published fixed asset numbers live in `PubNotes` (the full
note) and `PubBalSht` (the NBV line). The tie-outs below target those. Open question for
the operator: should figures also appear on `Report` itself? That would be a template
change, decided separately.

Three tie-outs, all anchored in the leaf files so consistent zeros cannot pass:

1. **Fixed asset note vs the schedule.** `PubNotes` rows 8-16 (cost brought forward,
   additions, disposals, depreciation brought forward, charge for the year, on disposals)
   are fed by `[1]Schedule` cells per asset class (E64/E75/E83 additions, I-column
   charge, W/X disposal columns, H7-H43 rates). Read the Schedule totals from
   Fixedassets.xlsx directly and assert the note agrees. Also assert NBV = cost minus
   accumulated depreciation, and `PubBalSht!D6` equals the note NBV total.
2. **P&L depreciation.** `MnthP&L` B35/B36/B39/B40 are the depreciation lines. Their sum
   must equal the note's charge for the year across asset classes.
3. **Corporation tax.** The CT sheet reads `[1]Schedule!E86-E99` (capital allowance
   pools) and adds back depreciation at K12. Assert K12 equals the P&L depreciation
   total, and that chargeable profit = operating profit + depreciation - capital
   allowances holds as an identity.

Scenario side: `ltd-scenario-full` has two opening fixed assets, enough for non-zero
signal on tie-outs 1 and 2. In-year additions and disposals need new scenario entries or
those note rows check 0 = 0.

## Part 2: published reconciliation pages, one per product, identical structure

No pages exist today; only the 50 markdown reports are committed. Every product (Taxi,
BST, SE, Ltd) gets a long HTML page with the same section structure in the same order,
so the ladder is visible: the same features reconciled from product to product, larger
packages filling more of them. An index page carries a product-by-feature matrix.

Page structure, identical for all four, top to bottom:

1. **Summary.** Status, the featured scenario, and a runs table listing every
   reconciliation report for the product with its status.
2. **Reconciliation checks.** The expected vs actual vs diff table.
3. **Input transactions.** Rendered from the scenario TOML fixtures: sales and purchase
   journals, bank entries, payroll, opening balances. The "what a customer typed in"
   half.
4. **Screenshots.** Key sheets of the populated workbooks: P&L, balance sheet, tax
   computation, VAT quarters where the product has them.
5. **Accounting statements.** The report's own sections (business details, P&L, notes).
6. **Tax review.** Corporation tax for Ltd; income tax for SE, BST, Taxi.

A product without a feature keeps the section heading order and simply has fewer
sections. Featured report per product: the fullest scenario at the latest year-end
(ltd-scenario-full, se-scenario-advanced, bst-scenario-basic, taxi-scenario-basic).

Mechanics, settled by a local spike (2026-08-27):

- The report markdown parses cleanly by structure: `Status:` line, `## Section`
  headings, pipe tables. No markdown library needed.
- Screenshots work per sheet: copy the workbook, mark every other sheet hidden in
  `xl/workbook.xml` via JSZip, LibreOffice `--convert-to pdf`, `pdftoppm -png` page 1.
  Verified locally against `examples/ltd-latest`. One LibreOffice run per shot, a few
  seconds each.
- Build in the `generate-*.yml` reconcile job for the latest year-end, where LibreOffice
  and `reports/populated/` already exist. Upload the page as an artifact; the existing
  commit job downloads it and commits into
  `web/spreadsheets.diyaccounting.co.uk/public/reconciliation/` alongside packages and
  reports. `deploy.yml` needs no change; the docroot ships committed content.
- Each product build writes a `<product>.json` metadata file (features, status,
  updated); the index page regenerates from all metadata files present, so the four
  product workflows update it incrementally.
- Report filename prefixes map products: `GB_Accounts_Company` (Ltd),
  `GB_Accounts_Self_Employed`, `GB_Accounts_Basic_Sole_Trader`,
  `GB_Accounts_Taxi_Driver`.
- The first build can run locally to seed all four pages (Ltd with screenshots from the
  committed `examples/ltd-latest`; the others gain screenshots on their next workflow
  run).

## Part 3: LLM as judge on the final reconciliation report

No workflow calls an LLM today in any of the five repos. The submit repo's security
review assigns issues to the GitHub Copilot agent; there is no Bedrock call anywhere. The
deploy job already assumes an AWS role via OIDC, and that same credential works for
Bedrock.

Design:

- Keep the deterministic `reconciliation-check` gate exactly as it is. It stays
  authoritative for arithmetic.
- Add a judge step after it. Feed the final reports to Claude on Bedrock (Node SDK
  `@anthropic-ai/bedrock-sdk`, `AnthropicBedrockMantle` client, model
  `anthropic.claude-opus-5`, region from the workflow). Request a JSON verdict:
  `{verdict, summary, concerns[]}`.
- Publish the summary onto the reconciliation page. On `fail`, exit 1; the existing
  `needs: reconciliation-check` chain blocks `deploy-spreadsheets`.
- The judge catches what deterministic checks structurally cannot: numbers that
  reconcile but make no sense. The VAT bug is the canonical case. Every check passed
  for months because zeros are self-consistent; a reader sees "VAT-registered
  construction company, all four VAT quarters £0.00" and flags it at once.
- Give the judge a written rubric and publish its reasoning with the verdict, so a
  blocking fail is explainable and a human can override with the existing
  `skip-reconciliation-check` input.
- Prerequisites: `bedrock:InvokeModel` scoped to Anthropic model ARNs on the deploy
  role, and a one-time model access grant in the account and region. Cost is one call
  per deploy on a report of tens of kilobytes.

## Sequencing: waves of sub-agent workstreams, one PR per wave

Each wave is dispatched as concurrent worktree-isolated sub-agents with strict file
ownership, integrated by the coordinator into a single PR. Shared files (reconcile.js,
report-generator.js, spreadsheet-runner.js) stay with the coordinator; each sub-agent
edits only the files its row names. Model tiers follow the workspace ladder: page and
judge design at the top tier, product check implementation on Sonnet, mechanical
extension of a proven check to more products on Haiku.

**Wave 0 — PR #27 completes the first end-to-end slice.**

| Workstream | Owns | Work |
|---|---|---|
| Checks | `app/products/ltd.js` | Item 1 for Ltd: assert `TrialBalance!EJ91` |

**Pages PR — all four products at once, independent of Wave 0.** The uniform page
structure in Part 2 makes this one builder plus per-product configuration, so it does
not stagger product by product.

| Workstream | Owns | Work |
|---|---|---|
| Builder | new `app/bin/build-reconciliation-pages.js`, npm script | Parse reports, render fixtures, per-sheet screenshots, per-product metadata, index matrix |
| Workflows | `generate-*.yml` (all four) | Build step in the latest-year-end reconcile job, artifact, commit-job path |
| Seed | site docroot | First local build of all four pages so the site gains them on next deploy |

**Wave 1 — Batch 1 PR: items 1 (remaining products), 2, 7.**

| Workstream | Owns | Work |
|---|---|---|
| SE checks | `app/products/se.js` | Self-check cell discovery, balance sheet identities, real debtor/creditor reads |
| BST + Taxi checks | `app/products/bst.js`, `app/products/taxi.js` | Same, single-file variants |

**Wave 2 — Batch 2 PR: items 5, 6, 10.**

| Workstream | Owns | Work |
|---|---|---|
| Fixed assets | ltd.js/se.js FA sections, scenario fixtures | Three tie-outs; in-year additions and disposals scenario data |
| Bank | ltd.js/se.js bank sections, scenario fixtures | Closing balance reads and cash-movement anchors |
| Monthly P&L | ltd.js/se.js monthly sections | `MnthP&L` C..N columns vs month tabs (columns confirmed present); resolve net vs gross per row |

**Wave 3 — Batch 3 PR: items 4, 9, 12.** Payroll workstream (scenario payroll months +
WagesInterface reads), SE VAT values workstream, CI scenario workstream
(brickwork-pro-vat in reconciliation).

**Wave 4 — Batch 4 PR: items 11, 13, 14.** Formula-presence guard (new catalogue test),
non-March roundtrip, LibreOffice matrix shrink.

**Wave 5 — coverage-gaps PR: resolve SHEET_COVERAGE_GAPS.md's risk list.** One PR
closing every gap in the report's "Largest gaps by risk", except the two legs already
owned elsewhere (bank read-backs land with item 6 in Wave 2; WagesInterface with item 4
in Wave 3 — this wave verifies both landed and covers what they left).

| Workstream | Owns | Work |
|---|---|---|
| Bank leg completion | ltd.js/se.js bank sections | Closing-balance reads for all four Ltd bank workbooks and SE Cash.xlsx (file-qualified result keys make the same-named month tabs readable); reconcile each to the scenario's cash movements |
| Admin echo | all four product modules | Read back the injected rates, bands, thresholds, VAT rate, and Ltd's year-end seed (Admin!F21) from every product's Admin sheet and assert against the tax-data TOML — a wrong rate is otherwise arithmetically invisible |
| Published documents | ltd.js | CT600 box values tied to the CorporationTax working sheet; PubNotes fixed-asset note tied to the Schedule (with item 5 if that lands first) |
| VAT localisation | ltd.js/se.js, scenario fixtures | Vatinterface mid-chain reads so a break is localised, not just caught; SE VATQtr box values including VATQtr5; a fixture exercising the straddling-period S/P sheets in both products |
| Payroll remainder | ltd.js/se.js | Payslips!Payment monthly PAYE/NI-due figures tied to the payroll fixture |
| Below the line | ltd.js, bst/taxi fixtures | RegisterofMembers nominal value × shares issued = balance sheet share capital; BST and Taxi scenario fixed assets so their capital-allowance lines carry non-zero signal |

**Wave 6 — the judge**, once the pages are stable input.

Every wave proves its checks by breaking a copy before the PR opens, the way the
month-links guard was proven against the pre-fix packages.

## Gaps and open questions

1. **Scenario data.** Several checks have no signal without new fixture data: in-year
   fixed asset additions and disposals (item 5), bank cash anchors (item 6), monthly
   payroll (item 4), purchase VAT (item 12). Each wave carries its own scenario
   additions; a check that would pass on 0 = 0 is not done.
2. **Populated workbooks at deploy time — resolved.** Pages build inside the
   `generate-*.yml` reconcile jobs, where `reports/populated/` and LibreOffice already
   exist, and the built pages are committed to the docroot. The deploy job stays
   unchanged and needs neither LibreOffice nor populated workbooks.
3. **Net vs gross in item 10.** P&L turnover is net of VAT for registered scenarios;
   Sales month totals are gross with a VAT split. The tie must compare like with like.
   Anatomy task inside Wave 2.
4. **Self-check cells outside Ltd.** Unknown whether SE/BST/Taxi workbooks carry an
   `EJ91` equivalent. Wave 1 discovers; if absent, the balance identities are the
   whole-book check for those products.
5. **Directors' report figures.** The `Report` sheet carries no fixed asset numbers;
   the published figures live in PubNotes and PubBalSht. Operator decision pending on
   whether Report itself should show figures (a template change).
6. **Judge prerequisites.** Bedrock model access grant in the spreadsheets account,
   Claude availability in the chosen region, a written rubric, and a flaky-verdict
   policy (retry once, then fail with the reasoning published).
7. **CI runtime.** Each wave adds reads and recalculations to reconcile. If the
   year-end matrix cost bites before Wave 4, pull item 14 forward.

Related plan: PLAN_ROUNDTRIP_FIDELITY.md proves a different property (the JS engine and
Excel agree; data survives export and import) and stays live for that work. Its S1
(cross-file external links) is largely fixed by PR #27's runner changes, so re-measure
the EQ1 diffs after #27 merges. Its S7 (fixed asset cellWrites vs Schedule layout) is
absorbed by item 5 here.

## Verification criteria

- Every Part 1 check demonstrably fails when its target is broken (verified by breaking
  a copy, as the month-links guard was verified against the pre-fix packages).
- Reconciliation pages exist for all four packages, rebuilt by a deploy run, linked from
  the site.
- A deploy with a judge `fail` verdict stops before `deploy-spreadsheets`; the verdict
  and reasoning are visible on the page and in the workflow log.
