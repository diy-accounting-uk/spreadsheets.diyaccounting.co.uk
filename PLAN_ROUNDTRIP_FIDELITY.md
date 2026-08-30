# PLAN: Roundtrip fidelity

The JS calculation engine, the export path and the diya-gl schema, brought up to the scope the
Excel reconciliation covers. The work is done and the programme is parked. This document is its
record: what the property is, how we measure it, where the measurement stands, and what is left
open.

## Context documents

- [CONTEXT_BASIC_SOLE_TRADER.md](CONTEXT_BASIC_SOLE_TRADER.md), [CONTEXT_TAXI.md](CONTEXT_TAXI.md),
  [CONTEXT_SELF_EMPLOYED.md](CONTEXT_SELF_EMPLOYED.md), [CONTEXT_LIMITED_COMPANY.md](CONTEXT_LIMITED_COMPANY.md)
  hold the per-product sheet maps and CI pipelines.
- [SHEET_COVERAGE_GAPS.md](SHEET_COVERAGE_GAPS.md) lists the template sheets no check touches.
- [CLAUDE.md](CLAUDE.md) holds the reconciliation-bug method every change here follows.

## What roundtrip fidelity means

### The export contract is a tuple

Every path through the system carries the same pair: the data that went in, and the report that
comes out of it. Write that pair as a tuple and the contract is one line each way.

```
export(excelReport(generate(D)))  =  (D, R)
export(jsReport(D))               =  (D, R)
```

Take some diya-gl data `D`. Produce a report from it either way. Ask the export path for the
(data, report) tuple. Both sides hand back the same `D` and the same `R`. The report an Excel
package carries and the report the JS engine computes are the same report. The data we put in is
the data we get back.

`D` and `R` are exact documents, defined below. Neither line means "the numbers broadly agree".

On the JS side the data half is an identity. The engine never leaves memory, so `D` comes back
because it never left. That side of the claim carries no weight and we do not present it as
evidence. What the JS run supplies is the canonical form of `D`, and that is what the Excel side's
export gets measured against. The data half is a claim about the Excel path.

### The property: one commuting square

The plan verifies a single property. Both routes out of `D` reach the same `(D, R)`, so it does not
matter which one you take.

```
             generate            export
        D ─────────────► package ───────► D
        │                   │
    jsReport            excelReport
        ▼                   ▼
        R ═══════════════════R
```

EQ1, EQ2 and EQ3 are its edges, not three separate goals.

| | Edge | Statement | What it compares |
| --- | --- | --- | --- |
| **EQ2** | the top row, out and back | `export(generate(D))` yields `D` | the data halves of the two tuples |
| **EQ1** | the bottom identity | `excelReport(generate(D))` and `jsReport(D)` yield the same `R` | the report halves of the two tuples |
| **EQ3** | the right column with itself | reading a package saved and reading it recalculated yield the same `R` | two report halves from one package |

The Excel packages are the reference. The JS engine is the implementation under test. CI proves the
square commutes on every push, so the two never drift.

**The top row is a round-trip property**, the shape a property-based tester writes as
`decode(encode(x)) == x`. In categorical terms `generate` is a section and `export` its retraction:
`export ∘ generate = id`, so the encoding is lossless. It holds only up to canonicalisation, since
line order, field order and number formatting are free choices the encoding does not have to
preserve, so the comparator normalises both sides before comparing them. Anything the Excel
encoding genuinely cannot hold goes on a checked-in list, and the length of that list is the
measure of how lossy the encoding still is.

**The bottom identity is observational, or functional, equivalence of two implementations, checked
by differential testing.** The Excel formulas are the reference implementation and the JS engine is
the implementation under test. Two programs are equivalent at the observations you can make of
them, and `R` is the observation. Widening the scope inventory therefore strengthens the property,
and narrowing it weakens the property without changing a single number.

**EQ3 is idempotence of recalculation**: the values cached in a saved package are a fixed point of
recalculating it. It runs on one package and one report path, so it needs no second engine.

### `R`, the report

`R` is one JSON document per package run. It holds every value the Excel reconciliation checks read
and every value the published reports print. That set is the read scope below.

Each entry has a key, a declared unit, and a value.

```json
{
  "package": "ltd",
  "scenario": "ltd-scenario-full",
  "yearEnd": "2026-03-31",
  "values": [
    { "key": "cell/Financialaccounts.xlsx!Profit & Loss Acc!B20", "unit": "money", "value": "6926.40" },
    {
      "key": "section/profit-loss-account/employers-national-insurance",
      "unit": "money",
      "value": "6926.40",
      "source": "cell/Financialaccounts.xlsx!Profit & Loss Acc!B20"
    },
    {
      "key": "check/Employer NI ties to the payroll",
      "unit": "verdict",
      "value": "pass",
      "expected": "6926.40",
      "actual": "6926.40"
    }
  ]
}
```

Three kinds of key, each stable across products, year ends and engines:

| Key | One per | Comes from |
| --- | --- | --- |
| `cell/<file>!<sheet>!<A1>` | cell read | `standardReads()` and `multiFileOptions().additionalReads`. Single-file products drop the `<file>!` part. |
| `section/<section-slug>/<row-slug>[#n]` | printed report row | `reportSections()`, in section order. `#n` disambiguates a label the section repeats. |
| `check/<check name>` | compliance check | `checkCompliance()`, carrying `expected`, `actual` and the verdict. |

Rules that make the document canonical:

- Entries sort by key. The file is UTF-8, two-space indented, newline terminated.
- A value is a string, never a JSON number. Money and rates are decimal strings at the precision
  the engine produced. No thousands separators, no currency symbol, no locale formatting.
- Dates are `YYYY-MM-DD`. Booleans are `"true"` and `"false"`.
- A missing value is an absent entry, never `null`, `""` or an em dash. That is what makes
  "no JS value" a count instead of a diff line.
- `unit` is declared, never guessed from the text. It comes from the product's `cellLabels()` entry
  for a cell key and from the section or check definition otherwise. A value with no declared unit
  is compared exactly, so declaring a unit can only loosen a comparison and never tighten one.
- `source` names the cell key a section row reprints. `derivedFrom` names the keys a value is the
  sum of. Either one tells the comparator the entry is not independent evidence.

`app/lib/report-serializer.js` owns this form and both engines write through it. The markdown
reports keep their own shape and are rendered from the same structures, so nothing has to be
recovered by parsing a table.

### `D`, the data

`D` is a diya-gl book and journal in canonical form: `book.toml` plus `lines.jsonl`.

- Lines sort by `postingDate`, then `sourceJournalID`, `accountMainID`, `entryNumber`,
  `lineNumber`, `documentReference`, `amount`.
- Each line's fields appear in schema property order. An absent field is omitted, never written as
  `null` or `""`.
- Money is a decimal string with exactly two decimal places. Rates are decimal strings at the
  precision the schema declares. Dates are `YYYY-MM-DD`.
- `book.toml` writes its tables in schema order, keys in schema order within each table, and sorts
  every array by its id field.

One module owns this form, `app/lib/diya-gl-canonical.js`. Its field order comes from the published
v2 schemas, read at load, so the two cannot drift. The extractor, the exporter and the comparator
all write through it, and the comparator normalises both sides again before comparing, so a
difference in line order, field order or number formatting can never register as a data difference.

## How we measure it

A `diff -r` line count is not a metric. It moves when a report section is added, when a label is
reworded, and when a number changes, and the three are indistinguishable. It also cannot fall to a
target, because a value the JS never computes prints as a row in one file and as nothing in
another.

Score per value instead. One comparator, `app/bin/verify-roundtrip.js`, takes two tuple directories
and scores both halves.

- **EQ1** joins the two `R` documents on key and returns four counts: **equal**, **differing**,
  **no JS value**, **no Excel value**. Each is a number that can only fall.
- **EQ2** joins the two `D` documents as a multiset of canonical lines, plus a field-by-field
  comparison of `book.toml`. It compares the export against the original fixture, not against a
  second export, so a field the first pass loses cannot pass by staying lost.

`app/bin/verify-stability.js` scores EQ3 with the same comparator and the same policy.

### Where exact equality is right

Identifiers, account ids, document references, dates, text and counts are compared exactly. There
is no such thing as a nearly-right account code or a nearly-right posting date, so any disagreement
is a defect and the comparator says so.

| Unit | Report values it covers | Canonical form | Compared |
| --- | --- | --- | --- |
| `identifier` | account ids, `entryNumber`, `documentReference`, asset, member and employee ids, company, VAT and UTR numbers | trimmed string | exact |
| `date` | posting, period, board meeting, acquisition and disposal dates, the Admin sheet's injected dates | `YYYY-MM-DD` | exact |
| `text` | labels, names, addresses, descriptions, business details | trimmed string | exact |
| `count` | journal line counts, share counts, stock counts, employee counts, whole miles | integer | exact |
| `rate` | tax rates, VAT rates, depreciation rates, percentages | round half-up to 6 dp | exact |
| `verdict` | compliance check results | `pass` or `fail` | exact |
| `money` | every amount in the P&L, balance sheet, VAT return, tax computation and payroll | round half-up to 2 dp | exact, except the rows below |

### Where a tolerance reduces noise without hiding a defect

Money is rounded half-up to 2 dp on both sides before comparison. That is canonicalisation, not
tolerance: Excel stores binary floating point and the xls roundtrip re-serialises it, so both sides
carry representation noise below a penny. Rounding removes the noise and keeps every real penny. It
applies to every money value, the filed boxes included: SA103S, SA103F, CT600, the VAT return
boxes, the trial balance totals and `TrialBalance!EJ91`.

A window left open after that rounding is a tolerance, and a key may carry one only where an Excel
check reads that same value and already tolerates the same difference. `toleranceByKey()` reads the
figure from the check in `R` rather than restating it, so a comparator tolerance can never be
looser than the check it stands in for. Three checks own a window, covering four report values, and
this is all of them.

| Report value | Window the check carries | The check that owns it |
| --- | --- | --- |
| `Residue` in `accounting-profit-to-tax-profit-bridge.md`, all four products | 0.01 | `check(PROFIT_BRIDGE_CHECK, bridge.residue, 0, 0.01)` at `bst.js:581`, `taxi.js:610`, `se.js:2484`, `ltd.js:3341` |
| `Residue`, one per category row, in `journal-category-vat-netting.md`, SE and Ltd | 0.01 | `check(categoryNettingCheckName(row), row.residue, 0, 0.01)` at `se.js:2491`, `ltd.js:3348` |
| The `Net` column of the same netting table, SE and Ltd | 0.01 | the same check. This is the flat 20/120 case: the table strips VAT at the book's single rate while the journal carries a rate per line, and the netting check is the one place the difference is already allowed for. |
| `SA103S: Net profit` in `self-assessment-sa103s.md`, BST | 0 | `check("SA103S: Net profit close to P&L Net", seShort.D71, pl.C24, 0)` at `bst.js:567`. The check compares exactly, so the comparator does too. |

Two consequences worth stating.

The flat 20/120 extraction gets a window in the netting rows and nowhere else. Everywhere else a
sheet derives VAT as 20/120 of a gross figure while the true answer is the sum of per-line rates,
the JS mirrors the sheet and the true figure goes in a warning. That is the rule the reconciliation
checks already follow, and it stays a warning rather than becoming a window.

The `check()` helper in all four products defaults to a £1 tolerance. That window exists to absorb
a sheet rounding a filed box to the pound, not to absorb a difference between two engines, so the
comparator does not inherit it. Money keys compare at 2 dp exact whatever their check allows. When
a box rounds to the pound on one side, the fix is to make the JS round the same way.

### Where less work is enough, and where more is needed

**Less.** A value that is the sum of values already in `R` is not compared twice. It carries
`derivedFrom`, and the comparator scores it through its operands: if every addend agrees, so does
the total, and a disagreement in an addend has already failed. A section row that reprints a cell
is the same case with one operand, and carries `source`. The exception is a total whose operands
are not all in `R`. That total is evidence in its own right and keeps its own key.

**More.** EQ3 runs on every package the four `generate-*` matrices produce, not on one. Those runs
already recalculate, so the extra cost is one report read each. A year end with renamed month tabs
and rewritten external links is exactly where a saved value and a recalculated value part company.

## The four commands

```bash
node app/bin/generate.js --package ltd --years ltd-2024 --year-end 2025-03-31 \
  --data examples/precision-code-ltd/full --offset '-P1Y' --output-dir target/ltd-pkg --skip-guide

node app/bin/report.js --package ltd --source-dir target/ltd-pkg --output-dir target/ltd-excel
node app/bin/export.js --package ltd --source-dir target/ltd-pkg --output-dir target/ltd-excel/data
node app/bin/report.js --package ltd --data examples/precision-code-ltd/full --offset '-P1Y' \
  --years ltd-2024 --output-dir target/ltd-js
```

The two `report.js` runs each write `report.json` beside their markdown. `export.js` writes the
Excel side's `data/`, and `report.js --data` writes the JS side's `data/` by canonicalising its own
input. Each output directory is then one tuple, and `verify-roundtrip.js` compares a pair of them.

BST, SE and Ltd run all four. Taxi runs three of them, because `export.js` has no Taxi writer, so
the Taxi job gates the report half and stability only.

## State at parking, 2026-08-30

Measured on the merged tree at `694641c1`, macOS LibreOffice, running each product's CI commands
exactly as `test.yml` runs them.

### EQ1, the report half

| Product | Excel values | JS values | Equal | Differing | No JS value | No Excel value |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BST | 122 | 188 | 122 | 0 | 0 | 66 |
| Taxi | 230 | 230 | 230 | 0 | 0 | 0 |
| SE | 933 | 1633 | 931 | 2 | 0 | 700 |
| Ltd | 1277 | 2169 | 1273 | 4 | 0 | 892 |

Every cell either engine reads has a value on both sides. `noJsValue` is zero for all four
products, which is the count the whole programme was scored on.

The `noExcelValue` column is a CI wiring gap. The Excel-side command is `report.js --source-dir`
with no `--data`, so it reads cells out of the workbook and cannot reach the journal. It therefore
publishes no compliance verdicts and no journal-category netting rows. BST's 66 are all verdicts. SE's 700 are 659 verdicts and 41 netting rows, Ltd's 892 are 837
and 55. The Taxi job passes `--data` to the same command and its column is zero, with all 73
verdicts agreeing between the engines. One flag on the other three commands closes the column.

### EQ2, the data half, against the original fixture

| Product | Fixture lines | Exported | Same transaction | Same plus account | Same on every field | Fields dropped | No home in the encoding |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| BST | 528 | 528 | 528 | 528 | 528 | 0 | 15 |
| Taxi | — | — | — | — | — | — | — |
| SE | 696 | 695 | 694 | 694 | 395 | 0 | 7 |
| Ltd | 722 | 718 | 701 | 701 | 507 | 0 | 6 |

`book.toml`, field by field:

| Product | Equal | Differing | Missing | Extra |
| --- | ---: | ---: | ---: | ---: |
| BST | 27 | 53 | 90 | 1 |
| SE | 37 | 65 | 124 | 2 |
| Ltd | 90 | 44 | 168 | 1 |

`Fields dropped` is zero everywhere. Every field the export leaves out is one
`app/data/roundtrip-unrepresentable.json` names a reason for, and the ratchet test in
`app/test/verify-roundtrip.test.js` fails if a new one appears.

### EQ3, stability of a saved package against its recalculation

| Product | Keys compared | Moved | Stale cached value | Unstable conversion | Volatile formula |
| --- | ---: | ---: | ---: | ---: | ---: |
| BST | 122 | 0 | 0 | 0 | 0 |
| Taxi | 157 | 0 | 0 | 0 | 0 |
| SE | 933 | 0 | 0 | 0 | 0 |
| Ltd | 1277 | 0 | 0 | 0 | 0 |

No key moves on any of the four packages, and none appears on one side only. That is because
`generate --data` recalculates the package as it injects the fixture and saves the recalculated
workbooks, so a populated package is already a fixed point.

`app/data/volatile-cells.json` allows 84 cells to move, all of them stale cached values the
generator writes a seed for and never refreshes. Thirty-nine are in the SE read set and forty-five
in the Ltd read set. They move on a package generated without `--data`, which is the blank package
a customer downloads. A blank SE package at the 2027 year end scores 917 keys compared, 876 equal,
39 moved, all 39 on the allowlist, plus 2 keys with no saved value.

### BST

Every read cell, every printed row and every derived figure agrees. The export brings all 528
fixture lines back as the same transaction, on the same account, on every field it carries. Fifteen
field kinds have no home in the single-file encoding, `roundtrip-unrepresentable.json` names each
one, and the payroll fields lead that list because the BST template has no Payslips workbook. The
66 unmatched values are the compliance verdicts the Excel-side command never publishes.

### Taxi

Every one of the 230 values agrees, verdicts included, because the Taxi job is the one that passes
`--data` to the Excel-side command. The data half goes unmeasured. `app/bin/export.js` has no Taxi
writer, so EQ2 and the double-roundtrip do not run for this product.

### SE

Two values differ, both on the same figure. `Income Tax!E9` is the higher-rate band charge and
`E11` the income tax it feeds. Excel carries 32,861.2349999998 and the JS carries 32,861.235, which
is the same number arrived at by two routes that land either side of a half-penny boundary. Rounding
half-up to 2 dp sends one to 32,861.23 and the other to 32,861.24, so the canonicalisation that
absorbs sub-penny noise everywhere else does not absorb this one. `E11` inherits it.

One of the 696 fixture lines does not come back: the stock adjustment, which the SE workbooks store
as a count and a value rather than as a journal line. Of the 694 that match as the same
transaction, 395 match on every field they carry. Three fields account for the rest.
`lineItemComment` differs on 299 lines and `documentReference` on 183, neither of which has a
column on the bank, payroll or sales blocks. `diya-gl:bankCode` differs on 7.

### Ltd

Four values differ, and they are two figures read twice. `Fixedassets.xlsx!Schedule!R1` is the total
writing down allowance claimed and `Y1` the balancing allowance on disposals.
`CorporationTax!I17` and `I18` read those two across the cross-file link. Excel splits 11,500
between them as 3,000 and 8,500; the JS splits the same 11,500 as 4,800 and 6,700. The total
capital allowance agrees and the split does not.

Four of the 722 fixture lines do not come back at all: the fixed asset debit and credit, which the
export collapses to net book value, and two bank opening balances. Twenty-one do not come back as
the same transaction, and they are one block: the eighteen lines of the opening journal and the
three bank opening balances, all on the first day of the period. The opening balance sheet is a
grid of figures rather than a numbered journal, so the export re-derives them from the grid instead
of replaying the fixture's own lines. Of the 701 that do match, 507 match on every field;
`documentReference` and `lineItemComment` each differ on 194.

## What each track delivered

**T0. Calculator split, scenario pass-through, wider read.** Split `diya-gl-calculator.js` into
`app/lib/calculators/{bst,taxi,se,ltd}.js` behind the existing `calculateFromDiyaGl` signature.
Made `report.js --data` pass a scenario into the calculator and publish compliance checks, and made
`report.js --source-dir` merge `additionalReads` into the read set. Added the first version of
`app/bin/verify-roundtrip.js`, scoring EQ1 by parsing the rendered markdown. Before it, the
calculator's `scenario` parameter was always `{}`, so opening balances, stock, debtors, creditors,
business details and fixed assets were zero or blank in every JS report.

**T1. Schema v2, the validator, the canonical form.** Published
`diya-gl-{lines,book}-v2.schema.json` and deleted the two v1 files, repointing every reader. Added
`ajv` and `ajv-formats` as direct dependencies so draft 2020-12 can be compiled. Built
`app/lib/diya-gl-schema.js` as the one validator, carrying the two referential rules JSON Schema
cannot state. Built `app/lib/diya-gl-canonical.js`, whose field order the schemas supply. Filled
the Precision Code master with the v2 tables and made `extractTaxDataFromBook()` read the Class 2
and Class 4 rates instead of substituting Class 1. Left `app/data/fixture-master-gaps.json` for
T1b. Before it nothing validated the schemas at all, and the fixtures broke them in four ways.

**T1b. Fixture masters.** Made all twelve reconciliation fixtures derive from diya-gl master data,
where nine had been hand-written. Gave the BrickWork master a bank journal, opening balances,
ledgers, a fixed asset register and a members register, and derived the VAT twin from the non-VAT
trade in a build section rather than keeping two masters. Registered SP Sixty's dashcam and
Kestrel's camera. Added the Basic Taxi Driver master, which the `taxi-scenario-basic` fixture had
never had. Widened the CI sync gate to cover `examples/` as well as `app/test/fixtures/`, so
re-running the extractor must leave the tree clean.

**T2. The tuple contract and export completeness.** Built `app/lib/report-serializer.js`, so both
engines write `R` through one module. Moved `verify-roundtrip.js` off parsing markdown onto
`report.json` and the declared units, added the unit-keyed comparison policy and the data half, and
settled which keys are scored across both documents at once. Carried `accountMainID` through the
workbook on each account's own analysis column, so account identity survives the export where it
used to collapse to one representative account per code letter. Made `export.js` write a full
`book.toml` instead of seven lines. Declared the fields the Excel encoding cannot hold in
`app/data/roundtrip-unrepresentable.json`, 18 of them, and anchored the end-to-end tuple test to
the fixture as a ratchet.

**T3. BST and Taxi calculators.** Gave both calculators a source for every cell their
reconciliation reads: the Admin sheet from the tax data, capital allowances from the fixed asset
register through `app/lib/tax/capital-allowances.js`, the SA103S box map read out of the template
XML, the Taxi mileage claim, the actual-versus-mileage comparison, the VitalTax quarterly grid and
the tax sheet. Declared a unit for every key both `cellLabels()` maps name. Mirrored the Excel
checks one for one in `app/test/calculator-{bst,taxi}.test.js`. Added the `roundtrip-taxi` job.
Took the hardcoded stock and ledger guesses out of the loader.

**T4. SE calculator.** Computed every cell the SE reconciliation reads: the monthly P&L grid, all
40 SA103F boxes, SA103S, the payroll interface and calendar, the fixed asset schedule, HP finance,
stock counts, ledgers, bank and cash closing balances, and the category netting rows. Grew
`app/lib/tax/vat.js` from a quarterly aggregator into the full Vatinterface and return forms,
including the straddling periods. Recorded CIS deductions on the purchase journal. Carried a
workbook's empty cells as the blanks they are rather than as nil, and asserted that set exactly.
Declared a unit for every read cell.

**T5. Ltd calculator.** Computed every cell the Ltd reconciliation reads: the monthly P&L grid, the
fixed asset schedule and note, the whole CT working sheet with marginal relief and day
apportionment, the CT600 boxes, the published P&L and balance sheet, both trial balance columns,
the directors' report, share register, dividends, charges and HP, the VAT interface and the Admin
sheet. Added `app/lib/tax/corporation-tax.js` and `app/lib/tax/capital-allowances.js`. Split a hire
purchase payment the way the sheet splits it. Mirrored every Ltd check in
`app/test/calculator-ltd.test.js`.

**T6. EQ3 on every package.** Added `app/bin/verify-stability.js`, which reads a package saved and
recalculated and compares the two `R` documents with the same comparator and the same policy. Its
rework rebuilt `app/data/volatile-cells.json` from this tree after T1b changed the fixtures: all 84
entries are stale cached values, each carrying the cell's formula and the seed cell it traces back
to. No cell any product reads carries a volatile `TODAY`/`NOW`/`RAND` formula. The rework also
scoped the Ltd test to the latest tax year, which had been generating 90-odd populated packages to
read one.

**T7. CI wiring.** Turned the four `roundtrip-*` jobs into a budget gate on
`app/data/roundtrip-budget.json`, seeded from a real run, and added the stability step to each.
Added a scorecard and a stability step to every entry of the four `generate-*` matrices, reusing
the package in `reports/populated/` rather than generating a second one. The matrix gate reads
`app/data/roundtrip-matrix-budget.json` and holds `linesLost` and `fieldsDropped` only.

**The loader track.** Made `app/lib/diya-gl-loader.js` carry the v2 book's own registers into the
scenario both writers read: opening balances, stock, ledgers, fixed assets, HP agreements and
members. Stopped stripping VAT from a book that never charged it. That is what let the Ltd fixed
asset and register-of-members checks assert a pass, and it pinned the Ltd depreciation to the
register rather than to a derivation.

## The read scope, measured

What each product's `R` carries, measured on the packages above.

| Product | `CELL_MAP` | Cells read | Report rows | Checks | Values in `R` |
| --- | ---: | ---: | ---: | ---: | ---: |
| BST | 121 | 120 | 133 | 66 | 319 |
| Taxi | 107 | 153 | 119 | 73 | 345 |
| SE | 173 | 891 | 320 | 659 | 1870 |
| Ltd | 166 | 1233 | 330 | 837 | 2400 |

BST and Taxi are single-file products, so every cell key names a sheet and a cell. Every SE and Ltd
cell key names a file as well, because `report.js --source-dir` merges `multiFileOptions()`'s
`additionalReads` into the read set. That is what puts the VAT returns and the fixed asset schedule
in the roundtrip reports.

## The diya-gl v2 schema

### Decision: v2 replaced v1

Nothing consumed v1 outside this repository, so there was no second reader to keep serving and
serving two schemas would have meant maintaining two.
`web/spreadsheets.diyaccounting.co.uk/public/schema/` publishes
`diya-gl-lines-v2.schema.json` and `diya-gl-book-v2.schema.json`, and `diya-gl-docs.md` documents
v2 only.

Three of the changes are not additive, which is why the version number moved rather than the
existing schema being amended in place.

1. `amount` is always positive and `debitCreditCode` was optional, so a journal line's sign was
   ambiguous. v2 requires `debitCreditCode` on a `journal` line, through an `if`/`then` on
   `sourceJournalID`.
2. `accountMainID` binds to the book's chart of accounts, so the export path stops guessing an
   account from a code letter. JSON Schema cannot state that rule, so the validator carries it.
3. `book.toml` gained `openingBalances`, `stock`, `debtors`, `creditors`, `fixedAssets`,
   `hpAgreements`, `dividends`, `members` and `charges` as top-level tables, and
   `entityInformation` gained address fields.

Both schemas set `additionalProperties: false`. `book.toml` requires `documentInfo`,
`entityInformation` and `accounts`; a line requires `postingDate`, `amount`, `accountMainID` and
`sourceJournalID`.

### v2, field by field

**`diya-gl-lines-v2.schema.json`** carries the gl-cor fields plus these `diya-gl:` extensions.
The last three are the ones v2 introduced, and they are what tie a line to a register the book
declares.

- `diya-gl:bankCode`: nineteen codes matching the analysis columns of the bank workbooks, including
  `BB` (opening balance brought forward), `RC` (CIS remittance), `RT` (corporation tax remittance)
  and `LCR` (long-term creditor receipt).
- `diya-gl:bankAccountID`, `diya-gl:employeeID`, `diya-gl:grossPay`, `diya-gl:incomeTax`,
  `diya-gl:employeeNI`, `diya-gl:employerNI`, `diya-gl:netPay`, `diya-gl:cisDeduction`,
  `diya-gl:cisRate`, `diya-gl:hpAgreement`.
- `diya-gl:vatPeriodEnd` (date): the VAT period the line is declared on, when that differs from the
  period `postingDate` falls in. This is what makes a straddling entry representable.
- `diya-gl:assetID` (string): the `fixedAssets[]` id a capital purchase or disposal moves.
- `diya-gl:memberID` (string): the `members[]` id a dividend line pays.

**`diya-gl-book-v2.schema.json`** gained:

- `entityInformation`: `organizationAddressLine`, `organizationTown`, `organizationPostcode`,
  `organizationTelephone`, `diya-gl:companiesHouseName`, `diya-gl:mileageBasis`.
- `documentInfo`: `diya-gl:vatStaggerGroup` (1 to 3) and `diya-gl:payrollYearStart`.
- `openingBalances`: `fixedAssetCost` and `fixedAssetDepreciation`, each keyed by asset class
  (`landBuildings`, `plantMachinery`, `fixturesFittings`, `computerTechnology`, `motorVehicles`);
  then `stock`, `tradeDebtors`, `tradeCreditors`, `longTermDebtors`, `bankAccounts` keyed by
  account code, `payeDue`, `vatDue`, `cisDue`, `netWagesDue`, `wageDeductionsDue`,
  `corporationTaxDue`, `dividendsDue`, `directorsLoan`, `longTermCreditors`, `shareCapital`,
  `retainedEarnings`, `capitalReserves`.
- `stock`: `openingValue`, `closingValue`, `openingCount`, `closingCount`, `materialsPercent`.
- `debtors` and `creditors`: arrays of `{ counterparty, invoice, amount, timing }`, where `timing`
  is `opening` or `closing`.
- `fixedAssets`: `{ assetID, class, description, cost, accumulatedDepreciation,
  taxWrittenDownValue, acquiredDate, depreciationRate, disposedDate, disposalProceeds }`.
- `hpAgreements`: `{ agreementID, description, financeCompany, supplier, amountFinanced,
  adminCharges, totalInterest, termMonths, startDate }`.
- `dividends`: `{ declaredDate, boardMeetingDate, amount }`.
- `members`: `{ memberID, name, shares, nominalValue, acquiredDate }`. `directors[]` stays for the
  officers, because a member is not always a director.
- `charges`: `{ chargeDate, description, valuation, holder, terms, boardMeetingDate }`.
- `tax.vat`: `staggerGroup` and `firstPeriodEnd`, so the return cycle is data rather than
  inference.

`tax.nationalInsurance` already declared the Class 2 and Class 4 fields. What T1 changed is that
the fixtures set them and `extractTaxDataFromBook()` reads them, instead of substituting Class 1
rates in their place.

`app/lib/diya-gl-schema.js` compiles both with ajv and adds the two rules JSON Schema cannot state:
every `accountMainID` names a declared account, and every `diya-gl:hpAgreement`, `diya-gl:assetID`
and `diya-gl:memberID` names a declared entry.

## What stays open

**EQ1 is an exact gate.** Every read cell has a JS source or a place on a declared blanks list.
Both engines write `R` through `report-serializer.js`. Every scenario-derived input reaches the JS
side from `book.toml`. Every key carries a declared unit. `noJsValue` and `noExcelValue` are zero
for all four products, now that every CI job passes `--data` to the Excel-side `report.js` command.
`app/data/roundtrip-budget.json` holds `differing`, `noJsValue` and `noExcelValue` at zero for every
product, and `budgetBreaches()` fails the run on a single differing money key.

**`book.toml` comes back short.** Missing fields run 90 for BST, 110 for SE and 156 for Ltd, and
the budget holds each at that number. The largest blocks are the debtor and creditor ledgers, the
fixed asset register, the HP agreements, the tax rate tables and the employee details, none of
which the sheets hold in a form the exporter reads back yet.

**S7, the fixed-asset `cellWrites` layout.** Four Ltd lines and one SE line do not survive the
export. The Ltd fixed asset debit and credit collapse to net book value and two bank opening
balances are lost; SE loses its stock adjustment. `app/data/roundtrip-budget.json` holds
`linesLost` at 4 for Ltd and 1 for SE, and the ratchet in `app/test/verify-roundtrip.test.js` holds
its own run's count at 5 and 2. Both can fall and neither can rise.

**Non-March EQ2 is scored on counts only.** `generate` shifts every posting date onto the package's
own accounting period, so for a non-March year end the exported dates sit a month or two from the
fixture's by design. Anchoring the comparison needs that shift undone first and the comparator does
not do it, so the `ltd-may` ratchet case skips the transaction-level assertions. The same shape
appears in the `generate-*` matrices: the fixture's transactions carry the master's own calendar
dates into every year-end directory, so only `linesLost` and `fieldsDropped` are portable across
year ends, and `app/data/roundtrip-matrix-budget.json` gates those two alone.

**Two fields are dropped without a declared home.** `lineItemComment` and `documentReference` on
the bank, payroll and SE sales blocks, which carry a counterparty and an invoice reference and no
description column beside them. They are what keeps SE at 395 whole-field matches of 694 and Ltd at
507 of 701. `diya-gl:bankCode` differs on a further 7 SE lines. The 18 fields the encoding
genuinely cannot hold are declared in `app/data/roundtrip-unrepresentable.json`, each with the
product it applies to and what the sheets do instead, and those are counted apart.

**The Precision Code master's straddling VAT entries are stated in the extractor.** Deriving them
needs journal lines outside the accounting period, which the master does not carry.

**Mileage is computed and never written.** The Taxi and BST calculators work the mileage claim out
of `measurableQuantity`, but `cellWrites` never writes that quantity to the Purchases mileage
column, so no generated package can take the mileage route rather than the actual-cost route.

**`export.js` has no Taxi writer.** `xlsx-exporter.js`'s `periodCovered()` finds no postings on the
Taxi package's own sheets, so EQ2 and the double-roundtrip do not run for Taxi and its
`roundtrip-taxi` job gates the report half and stability only.

One declared list closes the section, so nobody counts it as an open item. Thirteen SE read cells
are computed as the blanks the workbook itself holds, and `app/test/calculator-se.test.js` asserts
that set exactly: `SE Full!D147`, `D156`, `D160`, `D179`, `O154` and
`Vat.xlsx!Vatinterface!E4/E5/G4/G5/I4/I5/K4/K5`. Both engines carry nothing there, so both
agree.

## Parked

Fidelity stops here by the operator's decision. The square commutes on every product's main
fixture, the four `roundtrip-*` jobs gate it on every push, and the four `generate-*` matrices
score it and stability on every year end. Nothing consumes the JS representation in production yet,
so the remaining items above buy nothing until something does.

The VAT export in [PLAN_VAT_EXPORT_FOR_SUBMIT.md](PLAN_VAT_EXPORT_FOR_SUBMIT.md) is the first
production use in prospect. When it starts, reread this document's "What roundtrip fidelity means"
and "How we measure it" first, then `app/bin/verify-roundtrip.js` and `app/lib/report-serializer.js`
for the comparison, `app/lib/tax/vat.js` for what the engine already computes, and the `book.toml` item above.
