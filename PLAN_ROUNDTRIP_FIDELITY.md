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
and every value the published reports print. That set is the scope inventory below: 139 BST, 89
Taxi, 549 SE and 845 Ltd values today, and it grows as coverage grows.

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

The markdown reports keep their present shape. `R` is written beside them from the same structures,
before formatting, so nothing has to be recovered by parsing rendered tables.

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

One module owns this form, `app/lib/diya-gl-canonical.js`. The extractor, the exporter and the
comparator all write through it, and the comparator normalises both sides again before comparing,
so a difference in line order, field order or number formatting can never register as a data
difference.

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
  second export. The current double-roundtrip test compares pass 2 with pass 1, so anything the
  first pass loses stays lost and still passes.

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
| `money` | every amount in the P&L, balance sheet, VAT return, tax computation and payroll | round half-up to 2 dp | exact, except the four rows below |

### Where a tolerance reduces noise without hiding a defect

Money is rounded half-up to 2 dp on both sides before comparison. That is canonicalisation, not
tolerance: Excel stores binary floating point and the xls roundtrip re-serialises it, so both sides
carry representation noise below a penny. Rounding removes the noise and keeps every real penny. It
applies to every money value, the filed boxes included: SA103S, SA103F, CT600, the VAT return
boxes, the trial balance totals and `TrialBalance!EJ91`.

A window left open after that rounding is a tolerance, and a key may carry one only where an Excel
check reads that same value and already tolerates the same difference. The comparator reads the
figure from the check rather than restating it, so a comparator tolerance can never be looser than
the check it stands in for. Four rows qualify today, and this is all of them.

| Report value | Tolerance | The check that justifies it |
| --- | --- | --- |
| `Residue` in `accounting-profit-to-tax-profit-bridge.md`, all four products | 0.01 | `check(PROFIT_BRIDGE_CHECK, bridge.residue, 0, 0.01)` at `bst.js:570`, `taxi.js:606`, `se.js:2345`, `ltd.js:3210` |
| `Residue`, one per category row, in `journal-category-vat-netting.md`, SE and Ltd | 0.01 | `check(categoryNettingCheckName(row), row.residue, 0, 0.01)` at `se.js:2352`, `ltd.js:3217` |
| The `Net` column of the same netting table, SE and Ltd | 0.01 | the same check. This is the flat 20/120 case: the table strips VAT at the book's single rate while the journal carries a rate per line, and the netting check is the one place the difference is already allowed for. |
| `SA103S: Net profit` in `self-assessment-sa103s.md`, BST | 1% of `Profit & Loss Acc!C24` | `check("SA103S: Net profit close to P&L Net", seShort.D71, pl.C24, pl.C24 * 0.01)` at `bst.js:556` |

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

**More.** EQ3 runs on no package today. It belongs on every package the `generate-*` matrix
produces, not on one, because those runs already recalculate and the extra cost is one report read.
A year end with renamed month tabs and rewritten external links is exactly where a saved value and
a recalculated value part company.

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

All four run today for BST, SE and Ltd. Taxi has no roundtrip job.

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
| S5 business details template text | **Open.** The root cause is the schema. `entityInformation` has no address, town, postcode or telephone field, so a company address cannot survive a roundtrip whatever the writer does. | the published book schema |
| S6 Ltd journal lines lost | **Open, 4 lines.** 722 in, 718 out. The fixed asset debit and credit collapse to net book value, the stock adjustment is not stored, and two bank opening balances are lost. | EQ2 table |
| S7 fixed assets `cellWrites` layout | **Open.** Still blocks S6 and leaves the Ltd fixed asset note at 11 of 12 rows differing. | EQ1 per-file table |

The single largest JS-side defect is smaller than any of these and fixes several at once.
`app/bin/report.js:99` calls `calculateFromDiyaGl(book, lines, packageName, taxData)` with no fifth
argument. The calculator's whole `scenario` parameter is therefore always `{}`, so opening balances,
stock, debtors, creditors, business details and fixed assets are zero or blank in every JS report.
`diyaGlToScenario()` already builds that object.

---

## Measurement, 2026-08-30, after T0-T2

The comparator now reads the canonical `report.json` from both engines and scores each
value once (a section row that reprints a cell is scored through the cell; absent values
are absent, not dashes; compliance verdicts are in scope on both sides). These counts are
the baseline from here and do not compare to the table above.

EQ1, report half:

| Product | Excel values | JS values | Equal | Differing | No JS value | No Excel value |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BST | 172 | 99 | 77 | 20 | 75 | 2 |
| SE | 1561 | 434 | 119 | 311 | 1131 | 4 |
| Ltd | 2124 | 595 | 259 | 321 | 1544 | 15 |

EQ2, data half, scored against the original fixture:

| Product | Fixture lines | Exported | Same transaction | Same plus account | Same on every carried field | Fields dropped | No home in the encoding |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| BST | 528 | 528 | 528 | 528 | 528 | 0 | 15 |
| SE | 696 | 695 | 694 | 694 | 397 | 0 | 7 |
| Ltd | 722 | 718 | 717 | 717 | 520 | 0 | 6 |

The "no home" fields are declared in `app/data/roundtrip-unrepresentable.json` with reasons.
What keeps SE and Ltd short of a whole-field match is `lineItemComment` and
`documentReference` on bank, payroll and SE sales lines, which have no column in those
blocks; the four Ltd and one SE lines still lost wait on the fixed-asset `cellWrites`
layout (S7), held by a ratchet test.

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

### Decision: `v2` replaces `v1`

Nothing consuming `v1` is live. The only readers are in this repository: the example READMEs, the
schema docs page, and `app/test/diya-gl-schema.test.js`. So there is no second reader to keep
serving, and serving two schemas would mean maintaining two.

Publish `diya-gl-lines-v2.schema.json` and `diya-gl-book-v2.schema.json`, point every reader at
them, and delete the two `v1` files. `diya-gl-docs.md` documents `v2` only.

Three of the changes are not additive, which is why the version number moves rather than the
existing schema being amended in place:

1. `amount` currently has `minimum: 0` and `debitCreditCode` is optional. A journal line's sign is
   therefore ambiguous, and the Ltd calculator already works around it at
   `diya-gl-calculator.js:694`. `v2` makes `debitCreditCode` required on `journal` lines.
2. `accountMainID` is a free string. The book's chart of accounts is the authority, so `v2` binds
   the line to it and the export path can stop guessing an account from a code letter.
3. `book.toml` gains `openingBalances`, `fixedAssets`, `hpAgreements`, `dividends`, `members`,
   `charges` and `stock` as top-level tables. `entityInformation` gains address fields.

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

Eight tracks. File ownership is exclusive within a track so they can share a working tree. Where
two tracks have to touch one file, the ordering below says which lands first.

### T0. Calculator split, scenario pass-through, wider read

Landed. It leaves the files the rest of this plan builds on: `app/lib/calculators/{bst,taxi,se,ltd}.js`
behind the existing `calculateFromDiyaGl` signature, `report.js --data` passing a scenario and
publishing compliance checks, `report.js --source-dir` merging `additionalReads` into the read set,
and `app/bin/verify-roundtrip.js` scoring EQ1.

`verify-roundtrip.js` scores today by parsing the rendered markdown. T2 moves it onto `report.json`
and the declared units, and adds the data half.

### T1. Schema v2, the validator, and the canonical form

**Owns**: `web/spreadsheets.diyaccounting.co.uk/public/schema/diya-gl-{lines,book}-v2.schema.json`,
the two `v1` files it deletes, `web/.../schema/diya-gl-docs.md`, `app/lib/diya-gl-schema.js`,
`app/lib/diya-gl-canonical.js`, `app/test/diya-gl-schema.test.js`, the master data at
`examples/precision-code-ltd/{book.toml,lines.jsonl}`, and the `Conforms to` lines in the
`examples/*/README.md` files.

Runs first and alone. T1b and T2 both need the book shape and the canonical writer.

1. Write the two schemas as set out above. Delete `diya-gl-lines-v1.schema.json` and
   `diya-gl-book-v1.schema.json` and repoint every reader.
2. Add `ajv` at a draft 2020-12 version as a direct dependency, with `ajv-formats`.
3. `app/lib/diya-gl-schema.js` exports `validateBook()` and `validateLines()`, including the two
   referential rules JSON Schema cannot state.
4. `app/lib/diya-gl-canonical.js` exports `canonicalBookToml(book)` and `canonicalLinesJsonl(lines)`,
   writing the form defined under "`D`, the data". Its field order comes from the schemas, read at
   load, so the two cannot drift.
5. `app/test/diya-gl-schema.test.js` validates every `examples/*/book.toml` and `lines.jsonl`, and
   proves each new rule breakable by mutating one field in a copy and asserting the exact error.
6. Fill the Precision Code master with the new `v2` tables: `openingBalances`, `stock`, `debtors`,
   `creditors`, `fixedAssets`, `hpAgreements`, `dividends`, `members`, `charges`, the
   `entityInformation` address fields, and the Class 2 and Class 4 NI rates. Make
   `extractTaxDataFromBook()` read those rates and stop substituting Class 1.
7. Produce the **sections with no master data** list: every table an extracted fixture carries that
   no master states, and every literal `extract-scenarios.js` holds in its own source rather than
   deriving. `openingDebtors`, `bstClosingDebtors` and `openingCreditors` at
   `extract-scenarios.js:88-110` are already on it. Check the list in as
   `app/data/fixture-master-gaps.json`. T1b consumes it.

**Blast radius**: `npx vitest run app/test/diya-gl-schema.test.js app/test/scenario-extractor.test.js`.

**Tier**: Sonnet. The field list is settled above.

### T1b. Fixture masters

**Owns**: `app/bin/extract-scenarios.js`, `app/lib/scenario-extractor.js`, the masters at
`examples/{brickwork-pro,sp-sixty-driving,kestrel-executive-cars}/` and one new taxi master, every
generated subset directory under `examples/*/`, all twelve files under `app/test/fixtures/`, and
the fixture sync step in `.github/workflows/test.yml`.

Depends on T1. Runs concurrently with T2.

#### Decision: every reconciliation fixture derives from diya-gl master data

Today three of the twelve fixtures come from a master and nine are hand-written. A hand-written
fixture states its own answers, so it can hold a figure no double entry supports, and its
`[expected]` block can drift from the transactions above it without anything noticing. It also
means a schema field the fixtures need has no writer exercising it.

After this track the extractor writes all twelve at their existing paths, from a master per
business, and nothing under `app/test/fixtures/` is hand-maintained. The CI sync gate is the proof:
re-running the extractor must leave the tree clean.

#### What each master must gain

| Master | Fixtures it emits | What it must gain |
| --- | --- | --- |
| `examples/precision-code-ltd/` | `bst-scenario-basic`, `se-scenario-advanced`, `ltd-scenario-full` | The `v2` tables and the address fields, which T1 lands. T1b moves the debtor and creditor literals out of `extract-scenarios.js` and derives them from the master's own ledger. |
| `examples/brickwork-pro/` | `bst-brickwork-pro-nonvat`, `se-brickwork-pro-{vat,nonvat}`, `ltd-brickwork-pro-{vat,nonvat}` | A bank journal. The SE fixtures carry 60 and 63 bank rows and the Ltd 49 and 53, and the master has none: customer receipts, supplier payments, net pay, PAYE and CIS remittances, and VAT remittances in the twin. Opening-balance journal lines coded `BB`, so `buildOpeningBalance()` can produce the Ltd `[opening_balance]` table. `openingBalances` and `stock` tables. Debtor and creditor ledgers with counterparty names: 2 opening and 2 closing debtors, 4 opening and 4 closing creditors. `fixedAssets[]` for the £12,000 van and for the BST addition. `members[]` for Mike Brown's 100 shares, beside the existing `directors[]`. Address, town, postcode and telephone on `entityInformation`. |
| `examples/sp-sixty-driving/` | `bst-sp-sixty`, `taxi-scenario-sp-sixty` | `fixedAssets[]` for the £200 dashcam the master already books to account 7000, which the BST fixture states by hand as its only `fixed_asset_additions` row. Address fields. Neither fixture needs a bank or payroll journal, so the master needs neither. |
| `examples/kestrel-executive-cars/` | `taxi-scenario-kestrel` | `fixedAssets[]` for the £900 in-car camera the master books to account 7000 and the hand-written fixture drops. Extracting it gives the fixture a capital allowance it has never had, so the reconciled figures move. Address fields. |
| new taxi master | `taxi-scenario-basic` | The whole master. The fixture has none, and no `[business]` block either. Create `examples/basic-taxi-driver/` with the 180 daily fares totalling 36,000, the 21 purchase rows, the £8,000 vehicle at account 7000, and a full `entityInformation` including the address, which gives the fixture business details for the first time. |

#### The VAT twin

The BrickWork VAT and non-VAT fixtures are the same firm trading half as much again, with VAT at
20% on top, and buying the same van at the same £12,000 net cost. That relation is asserted in both
fixtures' own descriptions and in the master's README.

Keep one BrickWork master, the non-VAT trade as it stands, and derive the twin in a declared build
section that scales the trade by 1.5, adds VAT at 20%, and holds the capital purchase flat. Two
master directories would let the twins drift apart silently, and the relation between them is
exactly what the pair of fixtures exists to test. The build section sits beside
`bstStaffWagesAsPurchases()` and `seDrawingsFromDividends()`, which already derive one fixture's
shape from another's data.

#### Steps

1. Read T1's `app/data/fixture-master-gaps.json`.
2. Extend each master as the table above sets out.
3. Add the build sections: BrickWork's five, SP Sixty's two, Kestrel's one, the new taxi master's
   one. Each writes its subset directory and its fixture TOML through
   `app/lib/diya-gl-canonical.js`, and derives every `[expected]` key rather than stating it.
4. Every added transaction carries its counter-leg, so `TrialBalance!EJ91` stays 0 for both Ltd
   fixtures. Assert it.
5. Widen the sync gate to cover the generated examples as well:
   `node app/bin/extract-scenarios.js && git diff --exit-code app/test/fixtures/ examples/`.
6. Reconcile each of the twelve and compare the figures with the committed reports. Every figure
   that moves is either a fixture gain, which the commit message names, or a regression, which the
   commit fixes.

**Blast radius**: `npx vitest run app/test/scenario-extractor.test.js app/test/diya-gl-schema.test.js`,
then the sync gate, then `npx vitest run --fileParallelism=false` over the per-fixture test files
in `app/test/{bst,se,ltd,taxi}-*.test.js`.

**Tier**: Opus. Writing a bank journal that settles a ledger, remits PAYE, CIS and VAT, and leaves
the trial balance at zero is accounting design.

### T2. The tuple contract and export completeness

**Owns**: `app/lib/xlsx-exporter.js`, `app/bin/export.js`, `app/lib/report-serializer.js`,
`app/bin/verify-roundtrip.js`, `app/test/xlsx-exporter.test.js`,
`app/test/verify-roundtrip.test.js`, and the `report.json` call site in `app/bin/report.js`.

Depends on T1 for the book shape and the canonical writer. Runs concurrently with T1b.

**The report half**

1. `app/lib/report-serializer.js` builds `R` from the structures `reportSections()`,
   `checkCompliance()` and the cell read map already produce, before any formatting. Keys and
   canonical form as defined above. `report.js` writes it as `report.json` in both `--source-dir`
   and `--data` mode, beside the markdown.
2. Each value carries its declared `unit`. A cell key takes it from the product's `cellLabels()`
   entry, which T3 to T5 fill in for their own products. Anything still undeclared is compared
   exactly, so the gate never loosens by omission.
3. A section row that reprints a cell names that cell in `source`, and a value that is the sum of
   other keys names them in `derivedFrom`, so the comparator scores each figure once.

**The data half**

4. `export.js` writes `book.toml` and `lines.jsonl` through `app/lib/diya-gl-canonical.js`.
   `report.js --data` writes its own input the same way into `data/`, so both tuple directories
   have the same layout and EQ2 compares the export against the original fixture.
5. Carry `accountMainID` through the workbook so identity survives. The sheets hold a code letter,
   not an account, so the account has to travel somewhere the sheet already has room for: the
   detail or reference column, or a hidden column the writer owns. Discover the layout from the
   template XML before choosing.
6. Restore the dropped fields. `lineItemComment`, `documentType`, `documentReference`, `taxCode`
   and `taxRate` are all present in the BST sheets and are simply not read. `measurableQuantity`
   and the payroll fields need a home.
7. Write a full `book.toml`: chart of accounts from `Admin` and the journal headers, tax rates from
   `Admin`, employees from `Payslips`, directors and members from `Companysecretary`, opening
   balances from `OpenAccounts` and `TrialBalance` column D, fixed assets from `Fixedassets`, HP
   from `HPfinance`, dividends from `Boardmeeting`, charges from `Charges&Debentures`, stock from
   `Stock` or `StockControl`.
8. Recover the 4 lost Ltd lines and the 1 lost SE line, which S7 unblocks.
9. Name what the Excel encoding genuinely cannot hold in `app/data/roundtrip-unrepresentable.json`,
   one entry per field with the reason. EQ2 counts those separately from losses.

**The comparator**

10. `verify-roundtrip.js` reads `report.json` instead of parsing markdown and applies the unit-keyed
    policy: money at 2 dp exact, and a window only on the four rows named above, each read from the
    check that owns it rather than restated as a number. It refuses a tolerance wider than that
    check allows.
11. It scores the data half too: a multiset join of canonical lines and a field comparison of
    `book.toml`, against the original fixture.
12. Tests assert the exported line count and the per-account population against the fixture, not
    against a second export.

**Blast radius**: `npx vitest run --fileParallelism=false app/test/xlsx-exporter.test.js app/test/verify-roundtrip.test.js`.

**Tier**: Opus. Reverse mapping with template discovery and real ambiguity.

### T3. BST and Taxi calculators

**Owns**: `app/lib/calculators/bst.js`, `app/lib/calculators/taxi.js`, the `cellLabels()` maps in
`app/products/bst.js` and `app/products/taxi.js`, `app/test/calculator-bst.test.js`,
`app/test/calculator-taxi.test.js`.

Depends on T1b, so its assertions anchor to the final fixture figures. Runs concurrently with T4,
T5 and T6.

1. Emit the `Admin` sheet from the tax data. 22 BST and 19 Taxi values, no arithmetic.
2. Implement capital allowances from the fixed asset register: AIA, WDA, the motor restriction, and
   balancing charges, using `app/lib/tax/capital-allowances.js`. `FA!E1`, `K1`, `L1`, `M1`, `Q1`,
   `R1` and `P&L!C26`.
3. Replace the SA103S approximation at `diya-gl-calculator.js:176` with the box map the sheet's own
   formulas define. Read them out of the template XML.
4. Taxi: the mileage claim from `measurableQuantity`, the actual-versus-mileage comparison, the
   VitalTax quarterly grid, and the two-band tax sheet.
5. Declare a `unit` for every key the two products' `cellLabels()` maps name.
6. Tests mirror the Excel checks one for one, anchored to the same fixture figures. 66 BST
   assertions and 54 Taxi, each named for the behaviour and each proved breakable.
7. Add a `roundtrip-taxi` job for `examples/sp-sixty-driving`.

**Blast radius**: `npx vitest run --fileParallelism=false app/test/calculator-bst.test.js app/test/calculator-taxi.test.js`
plus the four commands for both products.

**Tier**: Sonnet.

### T4. SE calculator

**Owns**: `app/lib/calculators/se.js`, `app/lib/tax/vat.js`, the `cellLabels()` map in
`app/products/se.js`, `app/test/calculator-se.test.js`.

Depends on T1b. Runs concurrently with T3, T5 and T6.

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
9. Declare a `unit` for every key `cellLabels()` names.
10. Tests mirror all 637 Excel checks.

**Blast radius**: `npx vitest run --fileParallelism=false app/test/calculator-se.test.js` plus the
four commands for SE.

**Tier**: Opus.

### T5. Ltd calculator

**Owns**: `app/lib/calculators/ltd.js`, `app/lib/tax/corporation-tax.js`,
`app/lib/tax/capital-allowances.js`, the `cellLabels()` map in `app/products/ltd.js`,
`app/test/calculator-ltd.test.js`.

Depends on T1b. Runs concurrently with T3, T4 and T6.

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
11. Declare a `unit` for every key `cellLabels()` names.
12. Tests mirror all 860 Excel checks.

**Blast radius**: `npx vitest run --fileParallelism=false app/test/calculator-ltd.test.js` plus the
four commands for Ltd at a March and a non-March year end.

**Tier**: Opus. The largest single body of work here.

### T6. EQ3 on every package

**Owns**: `app/bin/verify-stability.js`, `app/test/verify-stability.test.js`.

A separate binary rather than a mode flag, so it shares no file with T2. Depends on T2 for
`report.json`. Runs concurrently with T3 to T5.

1. `verify-stability.js` reads a package twice, saved and recalculated, and compares the two `R`
   documents with the same comparator and the same tolerance policy.
2. Any key that moves is either a volatile formula or an unstable conversion. Name each one in
   `app/data/volatile-cells.json` with which of the two it is.
3. Run it on every package the `generate-*` matrix produces, not one. Those runs already
   recalculate, so it costs one report read each.

**Tier**: Haiku.

### T7. CI wiring

**Owns**: `.github/workflows/test.yml` outside the fixture sync step, `.github/workflows/generate-*.yml`,
`app/data/roundtrip-budget.json`.

Lands after T1b, which owns the sync step in the same workflow file. Every other track edits only
its own product's entry in the budget file.

**Tier**: Haiku.

### Concurrency

```
T1  ────►
      T1b ──────►
      T2  ──────────►            (needs T1)
              T3 ─┐
              T4 ─┼── concurrent (need T1b; T6 needs T2)
              T5 ─┤
              T6 ─┘
                        T7 ────►
```

T1 alone, then T1b and T2 together, then T3 to T6 together, then T7.

---

## CI shape

### What EQ1 and EQ2 become

A budget gate, not `continue-on-error`, and not `diff -r`.

```yaml
- name: 'Roundtrip scorecard'
  run: node app/bin/verify-roundtrip.js --package ltd
         --excel target/ltd-excel --js target/ltd-js
         --budget app/data/roundtrip-budget.json
```

Each tuple directory holds `report.json` and `data/`, so one command scores both halves.
`app/data/roundtrip-budget.json` holds one entry per product with today's counts:

```json
{
  "bst": { "differing": 85, "noJsValue": 47, "linesLost": 0, "fieldsDropped": 16 },
  "se": { "differing": 212, "noJsValue": 335, "linesLost": 1, "fieldsDropped": 7 },
  "ltd": { "differing": 222, "noJsValue": 557, "linesLost": 4, "fieldsDropped": 7 }
}
```

The job fails when any count rises. Each track lands a budget cut in the same commit as its fix.
The gate is live from the first commit, so no change can make the divergence worse while the tracks
run.

### How the roundtrip jobs relate to `generate-*`

They answer different questions and both are worth keeping.

The `roundtrip-*` jobs in `test.yml` run on every push, against `examples/`, at one year end each.
They are the fast gate: a JS change that breaks equivalence fails the PR.

The four `generate-*` workflows run the reconciliation matrix over every year end and publish the
reports. They already recalculate every package. Add one scorecard step and one stability step per
matrix entry, reusing the package in `reports/populated/` rather than generating a second one. That
catches drift specific to a year end, which the single year end in `test.yml` cannot see: the
non-March tab renames, the external link sheet-name rewrites, and the VAT stagger.

Add a fourth `roundtrip-taxi` job in T3.

### What has to be true before EQ1 is an exact gate

1. Every cell in `standardReads()` and `additionalReads` has either a JS source or a place on a
   declared not-computed list, and the list is checked in.
2. The `noJsValue` and `noExcelValue` counts are both zero.
3. Both sides write `R` through `report-serializer.js`, so one canonical form serves both and
   neither side formats a value on its way into the comparison.
4. Every scenario-derived input reaches the JS side from `book.toml`, not from a scenario TOML that
   only the Excel path reads.
5. Every key carries a declared unit, and the tolerance policy is applied by unit rather than by
   inspecting the text.
6. The compliance-check verdicts agree, as well as the values.

Where the Excel is the wrong side, the check asserts the sheet's behaviour as it stands and carries
the true figure in a warning. That is the same rule the reconciliation checks already follow. It is
never a reason to soften the gate.
