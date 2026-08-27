# PLAN: Reconciliation coverage, published reports, and an LLM judge

Status: scoping approved. Draft PR #27 (VAT data flow) is the vehicle for the first
end-to-end slice; it grows to include item 1 and the Ltd report page before it merges.

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

## Part 2: published reconciliation pages, one per package

Every package (Ltd, SE, BST, Taxi) gets a long HTML report page, linked from the website
and rebuilt on deployment. The raw material is already committed at deploy time, so this
is assembly, no new testing.

Page structure, top to bottom:

1. **Summary.** Status and the checks table from `reports/*.md`.
2. **Input transactions.** Rendered from the scenario TOML fixtures: sales and purchase
   journals, bank entries, opening balances. The "what a customer typed in" half.
3. **Screenshots.** The populated workbooks in `reports/populated/` converted per sheet
   with LibreOffice (`--convert-to pdf` then `pdftoppm -png`). Balance Sheet, Trial
   Balance, P&L, tax computation, VAT quarters.
4. **Comparison tables.** Expected vs actual vs diff from the compliance checks.
5. **Tax review.** Corporation tax for Ltd; income tax for SE, BST, Taxi.

Build step in `deploy.yml` after `reconciliation-check`. Publish either into
`web/spreadsheets.diyaccounting.co.uk/public/reconciliation/` before the CDK deploy
(ships with the site, versioned with the deploy) or `aws s3 sync` to a `reconciliation/`
prefix as `zips/` does (no generated HTML in git). Decide at build time; the first option
is the default.

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

## Sequencing

1. **PR #27 becomes the first end-to-end slice.** Onto its branch: item 1 for Ltd
   (assert `TrialBalance!EJ91`) and the Part 2 report page for Ltd, generated from the
   reconciliation run and published on deployment. Merging #27 then proves the whole
   pipeline once: data-flow checks, reconciliation report, published page.
2. **Batch PRs, each taking several items across every product where they apply.** New
   checks appear on the published pages with no extra page work.
   - Batch 1: items 1 (SE/BST/Taxi self-check cells), 2, 7. The cheap identity and
     real-read checks, all products at once.
   - Batch 2: items 5, 6, 10. Fixed asset tie-outs, bank closing balances, monthly P&L
     vs monthly sales and purchases.
   - Batch 3: items 4, 9, 12. Payroll flow, SE VAT box values, brickwork-pro-vat in CI.
   - Batch 4: items 11, 13, 14. Formula-presence guard, non-March roundtrip, matrix
     shrink.
3. **Pages for SE, BST, and Taxi** ride with Batch 1. Their reports already exist; the
   page build is configuration once the Ltd page is proven.
4. **Part 3 judge** last, reading the stable final report.

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
