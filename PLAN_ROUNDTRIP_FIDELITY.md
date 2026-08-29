# PLAN: Roundtrip fidelity

Bringing the JS calculation engine, the export path and the diya-gl schema up to the scope the
Excel reconciliation already covers.

## Context documents

- [CONTEXT_BASIC_SOLE_TRADER.md](CONTEXT_BASIC_SOLE_TRADER.md), [CONTEXT_TAXI.md](CONTEXT_TAXI.md),
  [CONTEXT_SELF_EMPLOYED.md](CONTEXT_SELF_EMPLOYED.md), [CONTEXT_LIMITED_COMPANY.md](CONTEXT_LIMITED_COMPANY.md)
  hold the per-product sheet maps and CI pipelines.
- [SHEET_COVERAGE_GAPS.md](SHEET_COVERAGE_GAPS.md) lists the template sheets no check touches.
- [CLAUDE.md](CLAUDE.md) holds the reconciliation-bug method every change here follows.

## What roundtrip fidelity means

Three properties. Each has a name, a command that produces it, and a number that measures it.

| | Property | Statement |
|---|---|---|
| **EQ1** | Report equivalence | `report(JS(D))` equals `report(Excel(generate(D)))` for the same diya-gl data `D` |
| **EQ2** | Data equivalence | `export(Excel(generate(D)))` equals `D` |
| **EQ3** | Stability | `report(saved xlsx)` equals `report(recalculated xlsx)` for the same package |

The Excel packages are the reference. The JS engine is the production implementation. CI proves
they agree on every push, so the two never drift.

## The four commands

```bash
node app/bin/generate.js --package ltd --years ltd-2024 --year-end 2025-03-31 \
  --data examples/precision-code-ltd/full --offset '-P1Y' --output-dir target/ltd-pkg --skip-guide

node app/bin/report.js --package ltd --source-dir target/ltd-pkg --output-dir target/ltd-excel-reports
node app/bin/report.js --package ltd --data examples/precision-code-ltd/full --offset '-P1Y' \
  --years ltd-2024 --output-dir target/ltd-diya-gl-reports
node app/bin/export.js --package ltd --source-dir target/ltd-pkg --output-dir target/ltd-exported-data
```

All four run today for BST, SE and Ltd. Taxi has no roundtrip job.

## How we measure it

A `diff -r` line count is not a metric. It moves when a report section is added, when a label is
reworded, and when a number changes, and the three are indistinguishable. It also cannot fall to
a target, because a value the JS never computes prints as a row in one file and as nothing in
another.

Score EQ1 per value instead. Parse both report trees into `file # row label # occurrence` keys and
compare the amounts. That gives four counts a CI gate can hold: **equal**, **differing**,
**no JS value**, **no Excel value**. Each is a number that can only fall.

Score EQ2 the same way, as a multiset comparison of lines against the original fixture rather than
against a second export of the same package. The current double-roundtrip test compares pass 2
with pass 1, so anything the first pass loses stays lost and still passes.

## Measurement, 2026-08-29

Run on `main` at `418bec4b`, macOS LibreOffice, the CI commands above.

### EQ1: report equivalence

| Product | Report files both sides | Excel values | JS values | Equal | Differing | No JS value | `diff -r` lines |
|---|---:|---:|---:|---:|---:|---:|---:|
| BST | 12 | 250 | 204 | 118 | 85 | 47 | 319 |
| SE | 10 | 584 | 253 | 37 | 212 | 335 | 839 |
| Ltd | 13 | 829 | 274 | 50 | 222 | 557 | 1103 |

The April measurement recorded 107 / 203 / 93 `diff -r` lines. Those numbers and today's measure
different things: the reports have grown a profit bridge, a VAT netting table and a VAT cycle
section since. The per-value counts above are the baseline from here.

Where the values sit, per report file:

| Product | File | Rows | Equal | Differing | No JS value |
|---|---|---:|---:|---:|---:|
| BST | cell-values | 111 | 48 | 16 | 47 |
| BST | admin-generator-injected | 23 | 1 | 22 | 0 |
| BST | income-tax-calculation | 17 | 5 | 12 | 0 |
| BST | self-assessment-sa103s | 22 | 12 | 10 | 0 |
| BST | debtors-creditors | 15 | 7 | 8 | 0 |
| BST | fixed-assets | 8 | 1 | 7 | 0 |
| BST | profit-loss-account | 25 | 19 | 6 | 0 |
| BST | bridge, purchase-analysis | 16 | 12 | 4 | 0 |
| BST | business-details, monthly-sales, stock | 23 | 23 | 0 | 0 |
| SE | cell-values | 411 | 13 | 63 | 335 |
| SE | self-assessment-sa103f | 41 | 1 | 40 | 0 |
| SE | admin-generator-injected | 24 | 1 | 23 | 0 |
| SE | self-assessment-sa103s | 27 | 5 | 22 | 0 |
| SE | profit-loss-account | 29 | 9 | 20 | 0 |
| SE | payroll-summary | 15 | 1 | 14 | 0 |
| SE | income-tax-calculation | 15 | 2 | 13 | 0 |
| SE | quarterly-summary | 13 | 3 | 10 | 0 |
| SE | bridge | 15 | 8 | 7 | 0 |
| SE | business-details | 2 | 2 | 0 | 0 |
| Ltd | cell-values | 652 | 18 | 77 | 557 |
| Ltd | profit-loss-account | 39 | 9 | 30 | 0 |
| Ltd | trial-balance | 36 | 10 | 26 | 0 |
| Ltd | published-balance-sheet | 18 | 1 | 17 | 0 |
| Ltd | corporation-tax-working-sheet | 13 | 1 | 12 | 0 |
| Ltd | published-p-l | 13 | 1 | 12 | 0 |
| Ltd | fixed-asset-note | 12 | 1 | 11 | 0 |
| Ltd | opening-balance-sheet | 12 | 2 | 10 | 0 |
| Ltd | bridge | 11 | 2 | 9 | 0 |
| Ltd | ct600-as-filed | 12 | 4 | 8 | 0 |
| Ltd | directors-report, stock, business-details | 22 | 12 | 10 | 0 |

The named sections show "no JS value" as zero because `reportSections()` builds every row from
`CELL_MAP` and prints an em dash for a missing cell. Those rows land in the differing column. Only
`cell-values.md` drops empty cells, so it carries the true count of cells the JS never produces.

### EQ2: data equivalence

Compared against the original fixture, not against a second export.

| Product | Fixture lines | Exported lines | Same date, amount, journal | Same, plus `accountMainID` | Field kinds dropped | Pass 2 equals pass 1 |
|---|---:|---:|---:|---:|---:|---|
| BST | 528 | 528 | 528 | 396 | 16 | yes, 0 diff lines |
| SE | 696 | 695 | 694 | 592 | 7 | yes, 0 diff lines |
| Ltd | 722 | 718 | 701 | 685 | 7 | yes, 0 diff lines |

Not one exported line matches its fixture line on the full field set, in any product. The
double-roundtrip passes for all three, which is what makes it the wrong measurement: it is stable
on data the first pass has already changed.

The Ltd figures are measured with the CI job's `--offset '-P1Y'` undone. Without that correction
every date is a year out and only 16 of 722 lines match anything.

Fields the export drops: `measurableQuantity`, `measurableUnitOfMeasure`, `measurableDescription`,
`diya-gl:employeeID`, `diya-gl:cisDeduction`, `diya-gl:cisRate`, `diya-gl:hpAgreement` in SE and
Ltd; BST drops those plus `lineItemComment`, `documentType`, `documentReference`, `taxCode`,
`taxRate`, `diya-gl:grossPay`, `diya-gl:incomeTax`, `diya-gl:employeeNI`, `diya-gl:employerNI`,
`diya-gl:netPay`.

Account identity collapses because the exporter reverses a code letter to one representative
account. SE loses `5501` (68 lines), `5301` (5), `5201` (4), `5803` (4), `5701` (4), `5700` (2),
`5802`, `5801`, `5101` (1 each), and folds them into `5300`, which goes from 6 lines to 78. Payroll
splits the same way: `5100` (12 lines) becomes `5101`. Ltd loses `5803` (4) and `5100` (12), and
the bank opening-balance lines on accounts `1210` and `1220`.

The exported `book.toml` carries seven lines: `documentInfo` and two `entityInformation` fields. It
has no chart of accounts, no tax rates, no directors, no employees. It fails the published book
schema, which requires `accounts`. So the operator's stated goal, that
`examples/precision-code-ltd/full` and the exported directory are equal, is not measured at all
today for `book.toml` and is measured against the wrong side for `lines.jsonl`.

### EQ3: stability

No command runs it and no job measures it. `report.js` has `--mode saved` and `--mode recalculate`,
which is the machinery, but nothing compares the two.

### Status of the seven open items

| Item | State | Evidence |
|---|---|---|
| S1 cross-file external links | **Changed shape.** LibreOffice now resolves them and the Excel side is right. The JS side is the wrong one: `MnthP&L!B20` employer NI reads 6,926.40 in Excel and 80,976 in JS (the JS sums payroll gross), `B40` depreciation reads 5,250 in Excel and 0 in JS, `CorporationTax!I7`/`I8` add-backs read 2,500 / 5,250 in Excel and 0 in JS. | `target/fid/ltd-valuediff.txt` |
| S2 BST debtors and creditors | **Open, root cause found.** The Excel values are not template examples. `diyaGlToScenario()` never sets `opening_debtors`, `closing_debtors` or `stock`, so `cellWrites` leaves the blocks unwritten and the sheet keeps its own monthly analysis figures. `Debtors & Creditors!C5` reads 33,400, which is April's sales. | `app/lib/diya-gl-loader.js`, `app/products/bst.js:90-105` |
| S3 SE `B31` bank charges | **Open.** The JS hardcodes 0 at `diya-gl-calculator.js:442`. The value is derivable from the bank journal's `B`-coded lines, the same way Ltd derives `B36`. | `app/lib/diya-gl-calculator.js:442` |
| S4 SE SA103S mapping | **Open and wider than recorded.** SA103F is also unmapped: 40 of 41 SA103F rows differ. SA103S: 22 of 27 differ. | EQ1 per-file table |
| S5 business details template text | **Open.** The root cause is the schema. `entityInformation` has no address, town, postcode or telephone field, so a company address cannot survive a roundtrip whatever the writer does. | `diya-gl-book-v1.schema.json` |
| S6 Ltd journal lines lost | **Open, 4 lines.** 722 in, 718 out. The fixed asset debit and credit collapse to net book value, the stock adjustment is not stored, and two bank opening balances are lost. | EQ2 table |
| S7 fixed assets `cellWrites` layout | **Open.** Still blocks S6 and leaves the Ltd fixed asset note at 11 of 12 rows differing. | EQ1 per-file table |

The single largest JS-side defect is smaller than any of these and fixes several at once.
`app/bin/report.js:99` calls `calculateFromDiyaGl(book, lines, packageName, taxData)` with no fifth
argument. The calculator's whole `scenario` parameter is therefore always `{}`, so opening balances,
stock, debtors, creditors, business details and fixed assets are zero or blank in every JS report.
`diyaGlToScenario()` already builds that object.

---

## Scope inventory

What the Excel side covers, and how far the other three paths reach.

### The read scope, measured

| Product | `CELL_MAP` | `standardReads()` cells | `additionalReads` cells | Report sections | Checks in the published report |
|---|---:|---:|---:|---:|---:|
| BST | 125 | 125 in 9 sheets | 0 | 10 | 66 |
| Taxi | 87 | 123 in 8 sheets | 0 | 8 | 54 |
| SE | 156 | 420 in 9 sheets | 422 in 41 `file!sheet` keys | 10 | 637 |
| Ltd | 166 | 666 in 12 sheets | 614 in 54 `file!sheet` keys | 12 | 860 |

The JS calculator's reach against that scope:

| Product | JS emits | `standardReads` cells the JS supplies | `additionalReads` cells the JS supplies |
|---|---:|---:|---:|
| BST | 65 cells in 6 sheets | 65 / 125 (52%) | n/a |
| Taxi | 35 cells in 3 sheets | 35 / 123 (28%) | n/a |
| SE | 80 cells in 7 sheets | 78 / 420 (19%) | 0 / 422 |
| Ltd | 104 cells in 7 sheets | 89 / 666 (13%) | 0 / 614 |

`report.js` reads `standardReads()` only. It never calls `multiFileOptions()`, so the whole
`additionalReads` set is outside EQ1 for both SE and Ltd. That is why the roundtrip reports carry
no VAT Returns section and no Fixed Asset Schedule section, while the published reconciliation
reports carry both.

### BST

| Area | Report values | Excel checks | JS computes | `report.js` prints | `export.js` exports inputs | Schema represents inputs | JS test asserts | Gaps |
|---|---:|---:|---|---|---|---|---|---:|
| P&L trading and expense lines | 24 | 10 | yes | yes | yes | yes | 9 of 24 | 15 |
| Monthly sales | 12 | 1 | yes | yes | yes | yes | 2 of 12 | 10 |
| Income tax and NI | 16 | 16 | partial, no CIS | yes | n/a | rates yes | 5 of 16 | 11 |
| SA103S boxes | 21 | 4 | approximation, see `diya-gl-calculator.js:176` | yes | n/a | box map in `diya-gl:sa103sBox` | 0 | 21 |
| Stock | 3 | 3 | needs a scenario it never gets | yes | no | **no** | 1 of 3 | 3 |
| Debtors and creditors | 14 | 4 | needs a scenario it never gets | yes | no | **no** | 1 of 14 | 14 |
| Fixed assets and capital allowances | 7 | 4 | returns 0 | yes | additions only | **no register** | 0 | 7 |
| Purchase analysis | 1 | 1 | no | yes | yes | yes | 0 | 1 |
| Admin injected rates | 22 | 22 | **no Admin sheet at all** | yes | no | yes | 0 | 22 |
| Business details | 5 | 0 | name and description only | yes | name and description only | **no address fields** | 1 of 5 | 4 |
| Profit bridge | 14 | 1 | derived | yes | n/a | n/a | 0 | 3 |
| **Total** | **139** | **66** | | | | | **19** | **111** |

### Taxi

Taxi has no roundtrip job, no `report --data` run and no calculator test. Every row is a gap.

| Area | Report values | Excel checks | JS computes | Gaps |
|---|---:|---:|---|---:|
| P&L vehicle cost block | 6 | 3 | fuel and repairs only, car hire hardcoded 0 | 4 |
| P&L trading and general expenses | 14 | 6 | yes | 14 |
| Quarterly summary (VitalTax) | 10 | 10 | no | 10 |
| SA103S boxes | 13 | 3 | no | 13 |
| Draft tax calculation | 12 | 11 | partial, two bands only | 12 |
| Fixed assets | 5 | 3 | returns 0 | 5 |
| Purchase analysis | 2 | 1 | no | 2 |
| Admin injected rates | 19 | 19 | no | 19 |
| Business details | 6 | 0 | partial | 6 |
| Mileage comparison | 2 | 1 | `mileageAllowance` hardcoded 0 | 2 |
| **Total** | **89** | **54** | | **87** |

`measurableQuantity` and `measurableUnitOfMeasure` already carry miles in the fixtures. The mileage
claim is computable; nothing computes it.

### SE

| Area | Report values | Excel checks | JS computes | `report.js` prints | `export.js` exports inputs | Schema represents inputs | JS test asserts | Gaps |
|---|---:|---:|---|---|---|---|---|---:|
| P&L lines | 28 | 9 | yes, `B31` hardcoded 0 | yes | yes | yes | 3 soft | 20 |
| Monthly P&L ties | 234 | 192 | **no** | appendix only | yes | yes | 0 | 234 |
| Income tax and NI | 14 | 11 | yes | yes | n/a | rates yes | 2 soft | 13 |
| SA103S boxes | 26 | 5 | 12 approximated | yes | n/a | partial | 0 | 22 |
| SA103F boxes | 40 | 59 | **none** | yes | n/a | **no** | 0 | 40 |
| Payroll (Wagesinterface) | 14 | 48 | emits zeros | yes | gross, tax, NI | yes | 1 soft | 14 |
| Payslips payment and calendar | 81 | 67 | **no** | **no** | no | **no** | 0 | 81 |
| Quarterly summary (VitalTax) | 10 | 2 | approximated | yes | yes | yes | 1 soft | 10 |
| Admin injected rates | 23 | 23 | **no Admin sheet** | yes | no | yes | 0 | 23 |
| Fixed asset schedule | 12 | 6 | **no** | **no** | no | **no register** | 0 | 12 |
| HP finance | 7 | 5 | **no** | **no** | `hpAgreement` tag only | **no** | 0 | 7 |
| VAT returns and interface | 32 | 154 | **no** | **no** | net and VAT per line | rate and code yes, straddling no | 0 | 32 |
| Stock counts | 2 | 2 | needs a scenario it never gets | **no** | no | **no** | 0 | 2 |
| Debtors and creditors | 4 | 4 | **no** | **no** | no | **no** | 0 | 4 |
| Bank and cash closing | 2 | 2 | **no** | **no** | yes | yes | 0 | 2 |
| Business details | 1 | 0 | yes | yes | yes | yes | 0 | 0 |
| Category netting | 19 | 19 | **no** | **no** | n/a | n/a | 0 | 19 |
| **Total** | **549** | **637** | | | | | **7 soft** | **535** |

### Ltd

| Area | Report values | Excel checks | JS computes | `report.js` prints | `export.js` exports inputs | Schema represents inputs | JS test asserts | Gaps |
|---|---:|---:|---|---|---|---|---|---:|
| P&L lines | 38 | 9 | yes, `B20`, `B35`, `B39`, `B40` wrong or zero | yes | yes | yes | 3 soft | 30 |
| Monthly P&L ties | 325 | 300 | **no** | appendix only | yes | yes | 0 | 325 |
| Opening balance sheet | 11 | 17 | needs a scenario it never gets | yes | opening journal only | **no opening balance section** | 0 | 11 |
| Trial balance | 35 | 12 | opening column only | yes | partial | **no** | 1 soft | 26 |
| Corporation tax working sheet | 12 | 30 | 6 of 12, no capital allowances | yes | n/a | rates yes | 2 soft | 12 |
| CT600 boxes | 11 | 20 | **none** | yes | n/a | `diya-gl:ct600Box` unused | 0 | 11 |
| Published P&L | 12 | 6 | 5 of 12 | yes | n/a | n/a | 1 soft | 12 |
| Published balance sheet | 17 | 6 | 3 of 17 | yes | n/a | **no** | 1 soft | 17 |
| Fixed asset note and schedule | 85 | 67 | **no** | note only | **no** | **no register** | 0 | 85 |
| Directors' report and share register | 13 | 18 | **no** | report only | **no** | `directors[]` has shares, no register | 0 | 13 |
| Dividends and board minute | 4 | 5 | **no** | **no** | **no** | **no** | 0 | 4 |
| Charges register | 1 | 1 | **no** | **no** | **no** | **no** | 0 | 1 |
| HP finance | 7 | 5 | **no** | **no** | `hpAgreement` tag only | **no** | 0 | 7 |
| VAT returns and interface | 30 | 159 | **no** | **no** | net and VAT per line | rate and code yes, straddling no | 0 | 30 |
| Payroll (WagesInterface, Payslips) | 144 | 123 | gross pay only | interface only | gross, tax, NI | yes | 0 | 144 |
| Stock | 4 | 4 | needs a scenario it never gets | yes | **no** | **no** | 1 soft | 4 |
| Creditors and bank closing | 16 | 16 | directors loan only | trial balance only | yes | yes | 0 | 15 |
| Admin injected rates and dates | 32 | 31 | **no Admin sheet** | **no** | no | rates yes, dates no | 0 | 32 |
| Expenses form mileage | 12 | 12 | **no** | **no** | miles per line | rate yes | 0 | 12 |
| Business details | 9 | 0 | 3 of 9 | yes | 2 of 9 | **no address fields** | 0 | 6 |
| Category netting | 26 | 26 | **no** | **no** | n/a | n/a | 0 | 26 |
| Profit bridge | 11 | 1 | derived | yes | n/a | n/a | 0 | 9 |
| **Total** | **845** | **860** | | | | | **9 soft** | **832** |

### Gap counts

| Product | Report values in scope | Values with no correct JS source | Excel checks with no JS unit-test mirror |
|---|---:|---:|---:|
| BST | 139 | 111 | 47 of 66 |
| Taxi | 89 | 87 | 54 of 54 |
| SE | 549 | 535 | 630 of 637 |
| Ltd | 845 | 832 | 851 of 860 |
| **Total** | **1,622** | **1,565** | **1,582 of 1,617** |

The 35 JS assertions that exist are in `app/test/diya-gl-calculator.test.js`. Twenty of them, all
BST, are anchored to fixture figures and can fail. The other fifteen compare a JS value with
another JS value ("K5 matches MnthP&L B43") or assert a range ("is positive and reasonable"). A
check that compares a value with itself cannot fail, so it does not exist.

The test also hardcodes a `bstScenario` literal with stock, debtors and creditors, duplicating what
`extract-scenarios.js` derives. Fixture figures belong in one place.

---

## Schema gaps

### What the fixtures already break

Nothing validates the published schemas. `ajv` is present only as a transitive dependency, at a
version that cannot read draft 2020-12. Running a conformance check by hand finds:

| File | Violation |
|---|---|
| `examples/precision-code-ltd/{full,advanced}/lines.jsonl` | `diya-gl:hpAgreement` on 2 lines. The schema sets `additionalProperties: false`, so the field is forbidden. |
| same | `diya-gl:bankCode` values `BB`, `RC`, `RT` on 4 lines. The enum lists 12 codes and none of these. |
| `examples/precision-code-ltd/book.toml` | a `[dividend]` table with `boardMeeting` and `declared`. The schema sets `additionalProperties: false` at the top level. |
| every exported `book.toml` | no `accounts` table, which the schema requires. |

### What the writers need and the schema cannot express

| Concept | Who needs it | Where it lives today |
|---|---|---|
| Opening balances (fixed asset cost and depreciation by class, stock, trade debtors, trade creditors, four bank accounts, PAYE, VAT, CIS, corporation tax, directors loan, long-term creditors, share capital, retained earnings, dividends due) | Ltd `OpenAccounts`, `TrialBalance` column D, 17 checks | reverse-engineered from an opening journal by `buildOpeningBalance()` |
| Opening and closing stock, and the physical count | BST, SE, Ltd, 9 checks | a hardcoded 10,000 / 6,000 in `diya-gl-loader.js:187` |
| Debtor and creditor ledgers with counterparty names | BST 14 cells, SE 4 checks, Ltd published balance sheet | scenario TOML only |
| Fixed asset register: class, description, cost, accumulated depreciation, acquisition date, disposal date, proceeds, depreciation rate | BST, Taxi, SE, Ltd, 67 Ltd checks and 12 SE | partly derived from code `f` purchases, partly from the opening journal |
| HP agreements: amount financed, admin charges, total interest, term in months | SE 5 checks, Ltd 5 | a `diya-gl:hpAgreement` string the schema forbids |
| Dividends: declaration date, board meeting date, amount | Ltd 5 checks | a `[dividend]` table the schema forbids |
| Members register: name and shareholding | Ltd 7 checks | `directors[].shares`, which is not the same list |
| Charges and debentures: valuation per charge | Ltd 1 check | nothing |
| VAT straddling entries: amounts belonging to a period outside the accounting year | SE 20 checks, Ltd 20 | scenario TOML only |
| VAT return periods and stagger | SE and Ltd VAT cycle, 9 checks each | derived from the sheet's own dates |
| Registered office address, town, postcode, telephone, first director's name | BST 5 cells, Ltd 9 | nothing, which is the whole of S5 |
| Class 2 and Class 4 NI rates | every sole-trader tax check | the schema has the fields; the fixtures do not set them, and `extractTaxDataFromBook()` substitutes Class 1 rates |
| Accounting period start month for the payroll calendar | SE 31 checks, Ltd 39 | `documentInfo.periodCoveredStart` |
| Stock materials percentage | Ltd stock calculation check | scenario TOML only |
| Mileage claim basis (actual cost or mileage allowance) | Taxi | nothing |

### Decision: `v2`, with `v1` left served

Amend `v1` for nothing. Publish `diya-gl-lines-v2.schema.json` and `diya-gl-book-v2.schema.json`
alongside, and point the tooling at `v2`.

Three of the changes are not additive, so a `v1` amendment would change what an existing document
means:

1. `amount` currently has `minimum: 0` and `debitCreditCode` is optional. A journal line's sign is
   therefore ambiguous, and the Ltd calculator already works around it at
   `diya-gl-calculator.js:694`. `v2` makes `debitCreditCode` required on `journal` lines.
2. `accountMainID` is a free string. The book's chart of accounts is the authority, so `v2` binds
   the line to it and the export path can stop guessing an account from a code letter.
3. `book.toml` gains `openingBalances`, `fixedAssets`, `hpAgreements`, `dividends`, `members`,
   `charges` and `stock` as top-level tables. `entityInformation` gains address fields. A `v1`
   reader would reject a `v2` book, so the version has to say so.

`v1` stays at its URL. Files that declare `v1` keep validating against it.

### `v2` additions, field by field

**`diya-gl-lines-v2.schema.json`**

- `diya-gl:hpAgreement` (string): the `hpAgreements[]` id this line settles.
- `diya-gl:bankCode`: add `BB` (opening balance brought forward), `RC` (CIS remittance), `RT`
  (corporation tax remittance), `LCR` (long-term creditor receipt). Move the code descriptions into
  `oneOf` branches so a reader can tell a receipt code from a payment code.
- `diya-gl:vatPeriodEnd` (date): the VAT period the line is declared on, when that differs from the
  period `postingDate` falls in. This is what makes a straddling entry representable.
- `diya-gl:assetID` (string): the `fixedAssets[]` id a capital purchase or disposal moves.
- `diya-gl:memberID` (string): the `members[]` id a dividend line pays.
- `debitCreditCode`: required when `sourceJournalID` is `journal`.
- `accountMainID`: keep as a string, and add a note that it must name an account the book declares.
  Enforcement belongs in the validator, not in JSON Schema.

**`diya-gl-book-v2.schema.json`**

- `entityInformation`: add `organizationAddressLine`, `organizationTown`, `organizationPostcode`,
  `organizationTelephone`, `diya-gl:companiesHouseName`.
- `documentInfo`: add `diya-gl:vatStaggerGroup` (integer 1 to 3) and `diya-gl:payrollYearStart`
  (date).
- `openingBalances` (object): `fixedAssetCost` and `fixedAssetDepreciation`, each keyed by asset
  class (`landBuildings`, `plantMachinery`, `fixturesFittings`, `computerTechnology`,
  `motorVehicles`); then `stock`, `tradeDebtors`, `tradeCreditors`, `bankAccounts` keyed by account
  code, `payeDue`, `vatDue`, `cisDue`, `corporationTaxDue`, `dividendsDue`, `directorsLoan`,
  `longTermCreditors`, `shareCapital`, `retainedEarnings`.
- `stock` (object): `openingValue`, `closingValue`, `openingCount`, `closingCount`,
  `materialsPercent`.
- `debtors` and `creditors` (arrays): `{ counterparty, amount, timing: "opening" | "closing" }`.
- `fixedAssets` (array): `{ assetID, class, description, cost, accumulatedDepreciation,
  acquiredDate, depreciationRate, disposedDate, disposalProceeds }`.
- `hpAgreements` (array): `{ agreementID, description, amountFinanced, adminCharges, totalInterest,
  termMonths, startDate }`.
- `dividends` (array): `{ declaredDate, boardMeetingDate, amount }`.
- `members` (array): `{ memberID, name, shares, nominalValue }`. Keep `directors[]` for the
  officers; a member is not always a director.
- `charges` (array): `{ description, valuation, createdDate }`.
- `tax.nationalInsurance`: keep the Class 2 and Class 4 fields already declared, and make the
  fixtures set them. `extractTaxDataFromBook()` must read them and stop substituting Class 1 rates.
- `tax.vat`: add `staggerGroup` and `firstPeriodEnd` so the return cycle is data, not inference.
- `tax.mileage`: already present; Taxi needs `basis: "actual" | "mileage"` on
  `entityInformation`.

`app/lib/diya-gl-schema.js` becomes the one validator: draft 2020-12, plus the two rules JSON
Schema cannot state, that every `accountMainID` names a declared account and that every
`diya-gl:hpAgreement` / `assetID` / `memberID` names a declared entry.

---

## Implementation tracks

Seven tracks. File ownership is exclusive within a track so they can share a working tree.

### T0. Split the calculator, pass the scenario, widen the read

**Owns**: `app/bin/report.js`, `app/lib/report-generator.js`, `app/lib/diya-gl-calculator.js`,
new `app/lib/calculators/{bst,taxi,se,ltd}.js`, `app/bin/verify-roundtrip.js`,
`app/test/verify-roundtrip.test.js`.

Every other track depends on this one. Run it first, alone.

1. `report.js --data` builds a scenario with `diyaGlToScenario(book, lines, packageName)` and passes
   it to `calculateFromDiyaGl` and to `generateSectionReports`. That alone lights up opening
   balances, stock, debtors, creditors and business details.
2. `report.js --source-dir` merges `productMod.multiFileOptions(yearEndMonth).additionalReads` into
   the read set, in both `saved` and `recalculate` mode, keyed `<filename>!<sheetName>`. The VAT
   Returns and Fixed Asset Schedule sections then appear on the Excel side, which is what the JS
   side has to match.
3. `generateSectionReports` gains a compliance-checks file, produced by calling
   `productMod.checkCompliance(results, scenario, taxData, calculateExpectedTax, yearEnd)`. Both
   sides then publish the same 66 / 54 / 637 / 860 checks, and EQ1 compares verdicts as well as
   values.
4. Split `diya-gl-calculator.js` into one module per product behind the existing
   `calculateFromDiyaGl` signature, so T2 to T5 own separate files.
5. `app/bin/verify-roundtrip.js` implements the scorecard: parse both report trees, emit
   `{ equal, differing, noJsValue, noExcelValue }` as JSON and as a table, and exit non-zero when a
   count exceeds the budget in `app/data/roundtrip-budget.json`.
6. The vitest double-roundtrip compares pass 1 against the **original fixture** as well as against
   pass 2, on a per-field multiset, with an explicit allow-list of fields the Excel cannot hold.
   The allow-list shrinks as T1 lands.

**Blast radius**: `npx vitest run --fileParallelism=false app/test/verify-roundtrip.test.js app/test/diya-gl-calculator.test.js`
plus the four commands for one product.

**Tier**: Sonnet. Well-specified plumbing.

### T1. Schema v2 and a validator

**Owns**: `web/spreadsheets.diyaccounting.co.uk/public/schema/diya-gl-{lines,book}-v2.schema.json`,
`web/.../schema/diya-gl-docs.md`, `app/lib/diya-gl-schema.js`, `app/test/diya-gl-schema.test.js`,
`app/bin/extract-scenarios.js`, the generated `examples/*/book.toml` and `lines.jsonl`.

1. Write the two schemas as set out above.
2. Add `ajv` at a draft 2020-12 version as a direct dependency, with `ajv-formats`.
3. `app/lib/diya-gl-schema.js` exports `validateBook()` and `validateLines()`, including the two
   referential rules.
4. `app/test/diya-gl-schema.test.js` validates every `examples/*/book.toml` and `lines.jsonl`, and
   proves each new rule breakable by mutating one field in a copy and asserting the exact error.
5. Extend the extractor's build sections so the master data emits `openingBalances`, `stock`,
   `debtors`, `creditors`, `fixedAssets`, `hpAgreements`, `dividends`, `members` and `charges`, then
   re-run `node app/bin/extract-scenarios.js`. Every new transaction carries its counter-leg so
   `TrialBalance!EJ91` stays 0.
6. Set the Class 2 and Class 4 NI fields in every fixture book, and make
   `extractTaxDataFromBook()` read them.

**Blast radius**: `npx vitest run app/test/diya-gl-schema.test.js app/test/extract-scenarios.test.js`
then the CI fixture sync gate.

**Tier**: Sonnet. The field list is settled above.

### T2. Export completeness

**Owns**: `app/lib/xlsx-exporter.js`, `app/bin/export.js`, `app/test/xlsx-exporter.test.js`.

Depends on T1 for the book shape.

1. Carry `accountMainID` through the workbook so identity survives. The sheets hold a code letter,
   not an account, so the account has to travel somewhere the sheet already has room for: the
   detail or reference column, or a hidden column the writer owns. Discover the layout from the
   template XML before choosing.
2. Restore the dropped fields. `lineItemComment`, `documentType`, `documentReference`, `taxCode`
   and `taxRate` are all present in the BST sheets and are simply not read. `measurableQuantity`
   and the payroll fields need a home.
3. Write a full `book.toml`: chart of accounts from `Admin` and the journal headers, tax rates from
   `Admin`, employees from `Payslips`, directors and members from `Companysecretary`, opening
   balances from `OpenAccounts` and `TrialBalance` column D, fixed assets from `Fixedassets`, HP
   from `HPfinance`, dividends from `Boardmeeting`, charges from `Charges&Debentures`, stock from
   `Stock` or `StockControl`.
4. Recover the 4 lost Ltd lines and the 1 lost SE line, which T3 and S7 unblock.
5. Tests assert the exported line count and the per-account population against the fixture, not
   against a second export.

**Blast radius**: `npx vitest run --fileParallelism=false app/test/xlsx-exporter.test.js app/test/verify-roundtrip.test.js`.

**Tier**: Opus. Reverse mapping with template discovery and real ambiguity.

### T3. BST and Taxi calculators

**Owns**: `app/lib/calculators/bst.js`, `app/lib/calculators/taxi.js`,
`app/test/calculator-bst.test.js`, `app/test/calculator-taxi.test.js`.

Depends on T0. Runs concurrently with T4 and T5.

1. Emit the `Admin` sheet from the tax data. 22 BST and 19 Taxi values, no arithmetic.
2. Implement capital allowances from the fixed asset register: AIA, WDA, the motor restriction, and
   balancing charges, using `app/lib/tax/capital-allowances.js`. `FA!E1`, `K1`, `L1`, `M1`, `Q1`,
   `R1` and `P&L!C26`.
3. Replace the SA103S approximation at `diya-gl-calculator.js:176` with the box map the sheet's own
   formulas define. Read them out of the template XML.
4. Taxi: the mileage claim from `measurableQuantity`, the actual-versus-mileage comparison, the
   VitalTax quarterly grid, and the two-band tax sheet.
5. Tests mirror the Excel checks one for one, anchored to the same fixture figures. 66 BST
   assertions and 54 Taxi, each named for the behaviour and each proved breakable.
6. Add a `roundtrip-taxi` job for `examples/sp-sixty-driving`.

**Blast radius**: `npx vitest run --fileParallelism=false app/test/calculator-bst.test.js app/test/calculator-taxi.test.js`
plus the four commands for both products.

**Tier**: Sonnet.

### T4. SE calculator

**Owns**: `app/lib/calculators/se.js`, `app/lib/tax/vat.js`, `app/test/calculator-se.test.js`.

Depends on T0. Runs concurrently with T3 and T5.

1. The monthly P&L grid: 18 rows across 13 columns, matching the 192 monthly tie checks.
2. SA103F: all 40 boxes and the 7 form-arithmetic totals.
3. SA103S: replace the approximation, and assert the 19 full-versus-short counterparts.
4. VAT: the Vatinterface month rows, the five quarter forms, the straddling periods, and the cycle
   coverage. `app/lib/tax/vat.js` grows from a quarterly aggregator into the full interface.
5. Payroll: Wagesinterface gross, PAYE, employee NI and employer NI, Payslips payment rows, and the
   payroll calendar.
6. The fixed asset schedule, HP finance, stock counts, debtors and creditors, and bank and cash
   closing balances, from the `v2` book.
7. `B31` from the bank journal's `B`-coded lines, closing S3.
8. Category netting rows, 19 of them.
9. Tests mirror all 637 Excel checks.

**Blast radius**: `npx vitest run --fileParallelism=false app/test/calculator-se.test.js` plus the
four commands for SE.

**Tier**: Opus.

### T5. Ltd calculator

**Owns**: `app/lib/calculators/ltd.js`, `app/lib/tax/corporation-tax.js`,
`app/lib/tax/capital-allowances.js`, `app/test/calculator-ltd.test.js`.

Depends on T0. Runs concurrently with T3 and T4.

1. Fix the three wrong P&L lines first: `B20` employer NI (currently payroll gross), `B40`
   depreciation (currently 0), and the goodwill line, which reads 3,000 against Excel's 2,500.
2. The monthly P&L grid: 25 rows across 13 columns, 300 checks.
3. The fixed asset schedule and note: 5 classes, 9 rows each, plus 6 totals and the NBV identity.
4. Capital allowances feeding `CorporationTax!K20`, then the whole CT working sheet including the
   two financial-year rows, marginal relief and the day apportionment.
5. CT600: all 11 boxes plus the 19 derived cells.
6. The published balance sheet: 17 rows, from opening balances plus movements.
7. Trial balance: the closing `EJ` column as well as the opening `D` column.
8. Directors' report, share register, dividends, charges, HP.
9. VAT, as T4, against the Ltd interface.
10. The `Admin` sheet, 32 values including the dates.
11. Tests mirror all 860 Excel checks.

**Blast radius**: `npx vitest run --fileParallelism=false app/test/calculator-ltd.test.js` plus the
four commands for Ltd at a March and a non-March year end.

**Tier**: Opus. The largest single body of work here.

### T6. EQ3 and stability

**Owns**: `app/bin/report.js` `--mode` handling after T0 lands, `app/test/report-modes.test.js`.

Runs after T0, concurrently with T3 to T5.

1. Compare `--mode saved` against `--mode recalculate` for a package `generate --data` has already
   recalculated.
2. Any cell that moves is either a volatile formula or an unstable conversion. Name each one.
3. Add the comparison as a CI step in each roundtrip job. It costs one extra recalculation.

**Tier**: Haiku.

### T7. CI wiring

**Owns**: `.github/workflows/test.yml`, `.github/workflows/generate-*.yml`,
`app/data/roundtrip-budget.json`.

Runs last, or alongside T3 to T5 once `verify-roundtrip.js` exists.

**Tier**: Haiku.

### Concurrency

```
T0  ────────────►
      T1 ──────────►
           T2 ──────────►        (needs T1)
           T3 ──┐
           T4 ──┼── concurrent   (all need T0)
           T5 ──┤
           T6 ──┘
                     T7 ────►
```

T0 alone, then T1, then T2 through T6 together, then T7.

---

## CI shape

### What EQ1 becomes

A budget gate, not `continue-on-error`, and not `diff -r`.

```yaml
- name: 'Equivalence 1: report scorecard'
  run: node app/bin/verify-roundtrip.js --package ltd
         --excel target/ltd-excel-reports --js target/ltd-diya-gl-reports
         --budget app/data/roundtrip-budget.json
```

`app/data/roundtrip-budget.json` holds one entry per product with today's counts:

```json
{
  "bst": { "differing": 85, "noJsValue": 47 },
  "se":  { "differing": 212, "noJsValue": 335 },
  "ltd": { "differing": 222, "noJsValue": 557 }
}
```

The job fails when either count rises. Each track lands a budget cut in the same commit as its fix.
The gate is live from the first commit, so no change can make the divergence worse while the
tracks run.

Tolerance policy, once values start matching:

| Kind | Tolerance |
|---|---|
| Money | to the penny, 0.005 |
| Rates and percentages | 1e-6 |
| Dates and counts | exact |
| Bridge and netting residues | 0.01, as the reconciliation checks already use |

### How the roundtrip jobs relate to `generate-*`

They answer different questions and both are worth keeping.

The three `roundtrip-*` jobs in `test.yml` run on every push, against `examples/`, at one year end
each. They are the fast gate: a JS change that breaks equivalence fails the PR.

The four `generate-*` workflows run the reconciliation matrix over every year end and publish the
reports. They already recalculate every package. Add one EQ1 step per matrix entry, reusing the
package in `reports/populated/` rather than generating a second one. That catches drift specific to
a year end, which the single year end in `test.yml` cannot see: the non-March tab renames, the
external link sheet-name rewrites, and the VAT stagger.

Add a fourth `roundtrip-taxi` job in T3.

### What has to be true before EQ1 is an exact gate

1. Every cell in `standardReads()` and `additionalReads` has either a JS source or a place on a
   declared not-computed list, and the list is checked in.
2. The `noJsValue` and `noExcelValue` counts are both zero.
3. Both sides format a value the same way. `generateSectionReports` runs a value through
   `fmt()` on one path and `toPrecision(15)` on the other; one formatter has to serve both.
4. Every scenario-derived input reaches the JS side from `book.toml`, not from a scenario TOML that
   only the Excel path reads.
5. The tolerance policy above is implemented in `verify-roundtrip.js`, not left to string equality.
6. The compliance-check verdicts agree, as well as the values.

Where the Excel is the wrong side, the check asserts the sheet's behaviour as it stands and carries
the true figure in a warning. That is the same rule the reconciliation checks already follow. It is
never a reason to soften the gate.
