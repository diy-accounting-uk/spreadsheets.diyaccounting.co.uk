# Feature Spec: Basic Sole Trader Import/Export CLI

## Summary

A Node.js command-line tool (`diy-accounting-cli`) that converts bidirectionally between
the DIY Accounting Basic Sole Trader Excel workbook and a plain-text representation
using TOML for configuration/metadata and JSONL for transaction data. Field names
align with the XBRL Global Ledger (GL) taxonomy where applicable.

## Motivation

- Enable programmatic test scenario generation against the spreadsheet product
- Provide a diffable, version-controllable representation of a set of books
- Support round-trip testing: generate → import → export → diff
- Lay groundwork for import/export across the full product range
- Give users a migration/backup path outside of Excel

## Scope

This spec covers the Basic Sole Trader product only. It is the simplest product
(no VAT, no employees, no balance sheet, no double-entry) making it the right
starting point. Later specs will extend to Self Employed, Company Accounts,
Taxi Driver and Payslip products.

---

## 1. Workbook Structure (source of truth)

The Basic Sole Trader workbook contains:

### Sales Workbook

One worksheet per month (Apr, May, Jun, ... Mar), each with columns:

| Column | Content                        | GL alignment               |
|--------|--------------------------------|-----------------------------|
| A      | Date                           | `postingDate`               |
| B      | Customer name                  | `detailComment` (payee)     |
| C      | Invoice number                 | `documentReference`         |
| D      | Description / source           | `detailComment`             |
| E      | Gross amount (£)               | `amount`                    |
| F      | VAT (zero for non-VAT reg)     | `taxAmount`                 |
| G      | Net amount (formula: E - F)    | derived                     |

Monthly totals are summed at the bottom of each sheet.
An annual summary sheet collects the twelve monthly totals.

### Purchases Workbook

One worksheet per month, each with columns:

| Column | Content                        | GL alignment               |
|--------|--------------------------------|-----------------------------|
| A      | Date                           | `postingDate`               |
| B      | Supplier / payee name          | `detailComment` (payee)     |
| C      | Invoice / receipt reference    | `documentReference`         |
| D      | Total amount (£)               | `amount`                    |
| E–K+   | Expense analysis columns       | `accountMainID` determines  |

The analysis columns break the total into expense categories. Typical
categories (which vary by year-end configuration):

- Cost of sales / materials
- Motor expenses
- Travel & subsistence
- Telephone
- Stationery & postage
- Advertising
- Insurance
- Repairs & maintenance
- Accountancy fees
- Other expenses
- Fixed asset purchases (separated for capital allowances)

### Profit & Loss (computed)

Not directly imported/exported as transaction data — it is a formula-driven
summary sheet that reads from Sales and Purchases totals. The CLI reconstructs
it on build by inserting the correct formulae.

### Tax Return Figures (computed)

Self-assessment short return figures (SA103S boxes) derived from the P&L.
Also formula-driven, reconstructed on build.

---

## 2. Plain-Text Representation

A single directory containing:

```
my-books-2025-26/
├── book.toml              # Metadata, chart of accounts, tax config
├── sales.jsonl             # Sales transactions
├── purchases.jsonl         # Purchase transactions
└── expected.toml           # Optional: expected outputs for test assertion
```

### 2.1 book.toml

```toml
[book]
product = "BasicSoleTrader"
version = "2025-26"
periodStart = "2025-04-06"
periodEnd = "2026-04-05"
currency = "GBP"
vatRegistered = false
basisOfAccounting = "cash"
entriesType = "journal"           # XBRL GL: cor:entriesType

[entity]
name = "Jane Smith Trading"
utr = ""                          # Unique Taxpayer Reference (optional)
nino = ""                         # National Insurance Number (optional)

[accounts.sales]
# accountMainID → description
"4000" = "Sales income"

[accounts.purchases]
# accountMainID → description, mapped to analysis column positions
"5000" = { description = "Cost of sales / materials", column = "E" }
"5100" = { description = "Motor expenses",            column = "F" }
"5200" = { description = "Travel & subsistence",      column = "G" }
"5300" = { description = "Telephone",                 column = "H" }
"5400" = { description = "Stationery & postage",      column = "I" }
"5500" = { description = "Advertising",               column = "J" }
"5600" = { description = "Insurance",                 column = "K" }
"5700" = { description = "Repairs & maintenance",      column = "L" }
"5800" = { description = "Accountancy fees",           column = "M" }
"5900" = { description = "Other expenses",             column = "N" }
"7000" = { description = "Fixed asset purchases",      column = "O" }

[taxYear]
personalAllowance = 12570
basicRate = 0.20
basicRateLimit = 37700
higherRate = 0.40
higherRateThreshold = 50270
additionalRate = 0.45
additionalRateThreshold = 125140
niClass2WeeklyRate = 3.45
niClass4MainRate = 0.06
niClass4UpperRate = 0.02
niClass4LowerProfits = 12570
niClass4UpperProfits = 50270
```

### 2.2 sales.jsonl

One JSON object per line. Field names from XBRL GL core module (`gl-cor`):

```jsonl
{"postingDate":"2025-04-15","detailComment":"Acme Corp","documentReference":"INV-001","description":"Web design services","amount":1500.00,"taxAmount":0,"accountMainID":"4000","sourceJournalID":"sales","entryNumber":"S-001"}
{"postingDate":"2025-04-28","detailComment":"Beta Ltd","documentReference":"INV-002","description":"Consultancy Apr","amount":2000.00,"taxAmount":0,"accountMainID":"4000","sourceJournalID":"sales","entryNumber":"S-002"}
```

**Field definitions:**

| Field                | Type    | Required | GL element              | Notes                                    |
|----------------------|---------|----------|--------------------------|------------------------------------------|
| `entryNumber`        | string  | yes      | `cor:entryNumber`        | Unique ID, generated if absent on import |
| `postingDate`        | string  | yes      | `cor:postingDate`        | ISO 8601 date `YYYY-MM-DD`               |
| `detailComment`      | string  | yes      | `cor:detailComment`      | Customer/supplier name                   |
| `documentReference`  | string  | no       | `cor:documentReference`  | Invoice/receipt number                   |
| `description`        | string  | no       | `cor:lineItemComment`    | What was sold/bought                     |
| `amount`             | number  | yes      | `cor:amount`             | Gross amount, always positive            |
| `taxAmount`          | number  | no       | `cor:taxAmount`          | VAT amount, 0 for non-VAT-reg           |
| `accountMainID`      | string  | yes      | `cor:accountMainID`      | Nominal code from chart in book.toml     |
| `sourceJournalID`    | string  | yes      | `cor:sourceJournalID`    | `"sales"` or `"purchases"`               |

### 2.3 purchases.jsonl

Same schema as sales.jsonl. The `accountMainID` determines which analysis
column the amount lands in when building the workbook:

```jsonl
{"postingDate":"2025-04-10","detailComment":"BP Garage","documentReference":"RCT-0041","description":"Diesel","amount":62.50,"taxAmount":0,"accountMainID":"5100","sourceJournalID":"purchases","entryNumber":"P-001"}
{"postingDate":"2025-04-12","detailComment":"Screwfix","documentReference":"INV-88431","description":"Materials","amount":145.00,"taxAmount":0,"accountMainID":"5000","sourceJournalID":"purchases","entryNumber":"P-002"}
```

### 2.4 expected.toml (optional, for test scenarios)

```toml
[profitAndLoss]
turnover = 42000.00
costOfSales = 8500.00
grossProfit = 33500.00
totalExpenses = 12400.00
netProfit = 21100.00

[sa103s]
# Self-Assessment short return box numbers
box9  = 42000.00   # Turnover
box10 = 21100.00   # Net profit
box11 = 0          # Tax adjustments

[incomeTax]
taxableIncome = 21100.00
personalAllowance = 12570.00
taxDue = 1706.00   # (21100 - 12570) * 0.20

[nationalInsurance]
class2 = 179.40    # 52 * 3.45
class4 = 511.80    # (21100 - 12570) * 0.06
```

---

## 3. CLI Interface

### Installation

```bash
npm install -g @diyaccounting/cli
```

Or used via `npx`:

```bash
npx @diyaccounting/cli extract ...
npx @diyaccounting/cli build ...
```

### Commands

#### 3.1 extract — Workbook → TOML + JSONL

```bash
diy-accounting extract \
  --sales ./BasicSoleTrader-Sales-2025-26.xlsx \
  --purchases ./BasicSoleTrader-Purchases-2025-26.xlsx \
  --output ./my-books-2025-26/
```

**Behaviour:**

1. Read the sales workbook, iterate each monthly sheet (Apr–Mar)
2. For each row with a date value, emit one line to `sales.jsonl`
3. Map column positions to GL field names (date → `postingDate`, etc.)
4. Generate `entryNumber` as `S-{month}-{row}` if not present
5. Repeat for purchases workbook → `purchases.jsonl`
6. Infer `accountMainID` from which analysis column contains the amount
7. Generate `book.toml` from workbook metadata:
   - Period dates from sheet names / workbook properties
   - Chart of accounts from purchase analysis column headers
   - Tax year rates from the P&L / tax computation sheet if present
8. Write all files to `--output` directory

**Flags:**

| Flag              | Default         | Description                              |
|-------------------|-----------------|------------------------------------------|
| `--sales`         | (required)      | Path to sales .xlsx workbook             |
| `--purchases`     | (required)      | Path to purchases .xlsx workbook         |
| `--output`, `-o`  | `./`            | Output directory                         |
| `--overwrite`     | `false`         | Overwrite existing output files          |
| `--year-end`      | inferred        | Year-end date if not inferrable          |
| `--format`        | `jsonl`         | Output format for transactions           |
| `--pretty`        | `false`         | Pretty-print TOML (wider tables)         |

#### 3.2 build — TOML + JSONL → Workbook

```bash
diy-accounting build \
  --input ./my-books-2025-26/ \
  --output ./BasicSoleTrader-2025-26/
```

**Behaviour:**

1. Read `book.toml` for metadata, chart of accounts, period dates
2. Read `sales.jsonl`, group transactions by month using `postingDate`
3. Create the sales workbook:
   - One sheet per month named "Apr", "May", ... "Mar"
   - Populate rows from JSONL records, mapping GL fields to columns
   - Add SUM formulae for monthly totals
   - Create annual summary sheet with references to monthly totals
4. Read `purchases.jsonl`, group by month
5. Create the purchases workbook:
   - Map `accountMainID` → column position via `book.toml` chart
   - Populate the correct analysis column for each transaction
   - Add SUM formulae
6. Create P&L sheet with formulae referencing sales/purchases totals
7. Create tax return sheet with formulae referencing P&L figures
8. Write workbooks to `--output` directory

**Flags:**

| Flag              | Default         | Description                              |
|-------------------|-----------------|------------------------------------------|
| `--input`, `-i`   | `./`            | Input directory containing toml + jsonl  |
| `--output`, `-o`  | `./output`      | Output directory for .xlsx files         |
| `--template`      | (none)          | Path to template workbook to use as base |
| `--overwrite`     | `false`         | Overwrite existing output files          |
| `--validate`      | `true`          | Validate against expected.toml if present|

#### 3.3 validate — Check JSONL against expected.toml

```bash
diy-accounting validate --input ./my-books-2025-26/
```

**Behaviour:**

1. Read `book.toml` and transaction JSONL files
2. Compute P&L totals, SA103S boxes, income tax and NI figures
3. Compare against `expected.toml` values
4. Exit 0 if all match, exit 1 with diff if any mismatch
5. Output is TAP (Test Anything Protocol) compatible

```
TAP version 14
1..6
ok 1 - profitAndLoss.turnover = 42000.00
ok 2 - profitAndLoss.netProfit = 21100.00
ok 3 - sa103s.box9 = 42000.00
ok 4 - sa103s.box10 = 21100.00
ok 5 - incomeTax.taxDue = 1706.00
not ok 6 - nationalInsurance.class4 expected 511.80 got 511.79
  ---
  expected: 511.80
  actual: 511.79
  tolerance: 0.01
  ...
```

#### 3.4 generate — Create a test scenario from a business profile

```bash
diy-accounting generate \
  --profile side-hustle \
  --year-end 2026-04-05 \
  --output ./test-scenario-side-hustle/
```

**Behaviour:**

1. Read the named business profile (built-in or from a TOML file)
2. Generate synthetic but realistic transactions:
   - Randomised dates spread across the tax year
   - Amounts drawn from distributions matching the profile ratios
   - Realistic supplier/customer names and descriptions
   - Deterministic when seeded (`--seed 42`)
3. Write `book.toml`, `sales.jsonl`, `purchases.jsonl`
4. Compute and write `expected.toml` with correct tax figures
5. The output is a complete test fixture: build → extract → diff

**Flags:**

| Flag              | Default              | Description                           |
|-------------------|----------------------|---------------------------------------|
| `--profile`       | (required)           | Profile name or path to profile TOML  |
| `--year-end`      | `2026-04-05`         | Tax year end date                     |
| `--output`, `-o`  | `./`                 | Output directory                      |
| `--seed`          | random               | RNG seed for deterministic generation |
| `--transactions`  | `120`                | Approximate number of transactions    |
| `--turnover`      | from profile         | Override annual turnover              |

---

## 4. Round-Trip Integrity

The key invariant:

```bash
# Start with a workbook
diy-accounting extract --sales Sales.xlsx --purchases Purchases.xlsx -o ./extracted/
diy-accounting build   --input ./extracted/ -o ./rebuilt/
diy-accounting extract --sales ./rebuilt/Sales.xlsx --purchases ./rebuilt/Purchases.xlsx -o ./re-extracted/

# These must be identical
diff ./extracted/sales.jsonl ./re-extracted/sales.jsonl
diff ./extracted/purchases.jsonl ./re-extracted/purchases.jsonl
diff ./extracted/book.toml ./re-extracted/book.toml
```

**Allowed differences:**
- `entryNumber` values may be regenerated (but must be stable within a run)
- Floating point amounts must round-trip to 2 decimal places (penny precision)
- Row ordering within a month is preserved; ordering across months is by `postingDate`
- Empty rows in the workbook are skipped on extract and not regenerated on build

---

## 5. XBRL GL Alignment

The JSONL field names are drawn from the XBRL GL Core (gl-cor) module
with the following conventions:

- XML element names are used as-is in camelCase (matching the GL taxonomy)
- The GL namespace prefix is dropped (`cor:postingDate` → `postingDate`)
- Only the flat subset of GL is used (no nested tuples in JSONL)
- The `accountMainID` values in `book.toml` are local nominal codes, not
  GL-standardised — but the field name and semantics match GL
- The `sourceJournalID` uses values `"sales"` and `"purchases"` matching
  GL's concept of journal identification
- Tax fields (`taxAmount`, `taxCode`) are from GL core, ready for the
  Self Employed product extension which adds VAT

This alignment means:
- Field names are self-documenting by reference to a published standard
- Extending to double-entry (Company Accounts) means adding
  `debitCreditCode` and nesting `entryDetail` arrays — not renaming fields
- If HMRC or a regulator ever mandates GL-based reporting, the data model
  is already aligned

---

## 6. Dependencies

| Package          | Purpose                              | Licence     |
|------------------|--------------------------------------|-------------|
| `xlsx`/`exceljs` | Read/write .xlsx workbooks           | MIT/MIT     |
| `@iarna/toml`    | Parse and stringify TOML             | ISC         |
| `commander`      | CLI argument parsing                 | MIT         |
| `readline`       | Stream JSONL (Node built-in)         | —           |

No database. No network calls. Pure file-in, file-out.

---

## 7. Project Structure

```
packages/
└── cli/
    ├── package.json
    ├── bin/
    │   └── diy-accounting.mjs           # Entry point
    ├── src/
    │   ├── extract.mjs                  # xlsx → toml + jsonl
    │   ├── build.mjs                    # toml + jsonl → xlsx
    │   ├── validate.mjs                 # jsonl + expected.toml → TAP
    │   ├── generate.mjs                 # profile → scenario
    │   ├── workbook/
    │   │   ├── sales-reader.mjs         # Parse sales xlsx sheets
    │   │   ├── sales-writer.mjs         # Build sales xlsx sheets
    │   │   ├── purchases-reader.mjs     # Parse purchases xlsx sheets
    │   │   ├── purchases-writer.mjs     # Build purchases xlsx sheets
    │   │   └── formulae.mjs             # P&L and tax return formulae
    │   ├── schema/
    │   │   ├── transaction.mjs          # JSONL record validation
    │   │   └── book.mjs                 # book.toml validation
    │   ├── tax/
    │   │   ├── income-tax.mjs           # IT calculation from rates
    │   │   ├── national-insurance.mjs   # NI Class 2 + 4 calculation
    │   │   └── sa103s.mjs               # SA103S box mapping
    │   └── profiles/
    │       ├── side-hustle.toml
    │       ├── self-employed-consultant.toml
    │       └── taxi-driver.toml
    └── test/
        ├── extract.test.mjs
        ├── build.test.mjs
        ├── round-trip.test.mjs
        └── fixtures/
            ├── minimal/                 # Smallest valid scenario
            ├── side-hustle/             # Generated test scenario
            └── real-workbook/           # Actual BST workbook sample
```

---

## 8. Future Extensions

Each adds fields to the JSONL schema and sections to `book.toml` without
breaking the core structure:

| Product            | Additions                                              |
|--------------------|--------------------------------------------------------|
| Self Employed      | `taxCode`, `taxAmount`, `vatRate` fields; VAT return    |
|                    | boxes in expected.toml; `[vat]` section in book.toml   |
| Taxi Driver        | `measurableQuantity` + `measurableUnitOfMeasure` for   |
|                    | mileage; mileage-vs-actual comparison in validate      |
| Company Accounts   | `debitCreditCode`, nested `entryDetail` arrays,         |
|                    | `[balanceSheet]` in expected.toml, CT600 boxes          |
| Payslip            | Separate `payroll.jsonl` with employee records          |

---

## 9. Acceptance Criteria

1. `extract` on an unmodified Basic Sole Trader workbook (any year-end)
   produces valid `book.toml` and well-formed JSONL
2. `build` from the extracted output produces a workbook that opens in
   Excel and LibreOffice Calc with working formulae
3. Round-trip `extract → build → extract` produces byte-identical JSONL
4. `generate --seed 42` produces identical output on every run
5. `validate` correctly computes income tax and NI for known test vectors:
   - £0 profit → £0 tax, £0 NI
   - £20,000 profit → £1,486 IT, £445.80 Class 4 NI
   - £60,000 profit → £11,432 IT, £2,451.80 Class 4 NI
   - £130,000 profit → tests personal allowance taper
6. All commands exit 0 on success, non-zero on failure, stderr for errors
7. No network calls, no temp files outside the output directory
