# PLAN: shipped-template surgery

Eight repairs to the shipped Excel templates, worked out against the template XML so a coding
agent can carry each one out without further discovery. Every cell address, formula and figure
below was read out of the template with JSZip or `unzip -p`, and every expected figure was
hand-computed on a named fixture.

Read `CLAUDE.md`'s "Reconciliation-bug method" before starting any track. It is the standard
every check below has to meet.

## How the work splits

Group the tracks so two agents never open the same xlsx. Three tracks also share JavaScript
files, so those have to run in sequence or in one agent.

| Track | Workbooks it owns | Shared files it edits | Model |
| --- | --- | --- | --- |
| 1. Income tax bands | `app/templates/se/Financialaccounts.xlsx`, `app/templates/bst/bst-excel.xlsx` | `app/data/se-*.toml`, `app/lib/tax/income-tax.js`, `app/lib/generator.js`, `app/products/se.js`, `app/products/bst.js`, `app/bin/judge-reconciliation.js` | Opus |
| 2. Ltd corporation tax and CT600 | `app/templates/ltd/Financialaccounts.xlsx`, `app/templates/ltd/expensesform.xlsx`, `app/templates/ltd/meta.toml` | `app/lib/generator.js`, `app/products/ltd.js`, `app/bin/judge-reconciliation.js` | Opus |
| 3. Fixed assets | `app/templates/se/Fixedassets.xlsx`, `app/templates/ltd/Fixedassets.xlsx` | `app/products/se.js`, `app/products/ltd.js`, `app/lib/scenario-extractor.js`, `examples/precision-code-ltd/**` | Sonnet |
| 4. Sales invoice | `app/templates/se/Salesinvoice.xlsx`, `app/templates/ltd/Salesinvoice.xlsx` | `app/test/formula-presence-guard.test.js` | Sonnet |

Tracks 1, 2 and 3 all edit `app/lib/generator.js` or a product module. Land them one after
another. Track 4 touches nothing the others touch and can run in parallel with any of them.

The Ltd mileage item (item 8) folds into track 2 because it edits the same generator and the
same product module.

## Two figures in NEXT.md are wrong

Correct these when you close the items.

- The BST profit is **£226,508**, not £265,508. Confirmed on every
  `reports/GB_Accounts_Basic_Sole_Trader_*_bst-scenario-basic.md` (`Income Tax!E5`).
- Box 63 on the 31 March 2026 Ltd package files **£14,014.39**, not £13,995.22. The £13,995.22
  is `CorporationTax!I34` on the 30 April 2020 package, which is a leap year run where the two
  rows split 366/365 instead of 365/365. Box 63 there is £14,033.56.

---

# Track 1 — SE and BST income tax: taper and additional rate

Both products read their bands from the same `app/data/se-*.toml` files and both run through
`calculateIncomeTax` in `app/lib/tax/income-tax.js`. Do them together.

## 1.1 What the sheets do now

**SE**, `app/templates/se/Financialaccounts.xlsx`, sheet `Income Tax`,
`xl/worksheets/sheet6.xml`:

```
E5   ='SE Full'!O210
E6   =IF((E5>0),Admin!N$4,0)
E7   =IF((E5>E6),(E5-E6),0)
C8   =Admin!N$11        D8 =Admin!N$6
E8   =IF((E7>0),(IF((E7<C9),E7*D8,C9*D8)),0)
C9   =Admin!N$12        D9 =Admin!N$7
E9   =IF((E7>C9),((E7-C9)*D9),0)
E10  =SUM(E8:E9)
E11  =-[2]Mar!$X$1
E18  =SUM(E10:E17)
```

**BST**, `app/templates/bst/bst-excel.xlsx`, sheet `Income Tax`, `xl/worksheets/sheet5.xml`:

```
E5   ='SE Short'!D106
E6   =IF((E5>0),Admin!N$4,0)
E7   =IF((E5>Admin!N4),(E5-E6),0)
C8   =Admin!N12         D8 =Admin!N7
E8   =IF((E7>0),(IF((E7<C9),E7*D8,C9*D8)),0)
C9   =Admin!N13         D9 =Admin!N8
E9   =IF((E7>C9),((E7-C9)*D9),0)
E10  =SUM(E8:E9)
E11  =-SalesMar!$K$1
E18  =SUM(E10:E17)
```

E6 hands out the whole personal allowance at any profit. There is no third band. Above the
higher-rate threshold both sheets charge 40% on everything.

## 1.2 The statutory figures, hand-computed

Rules for 2025-26: the allowance falls by £1 for every £2 of income over £100,000; the basic
rate limit is £37,700 of taxable income; the higher rate limit is £125,140; income above it
bears 45%. Because the allowance reaches nil at exactly £125,140 of income, the £125,140 limit
reads the same whether you apply it to income or to income after the allowance.

**SE advanced fixture, 2025-26.** `Income Tax!E5` = 144,715.391666666 (read from
`reports/GB_Accounts_Self_Employed_2026_04_05__Apr26__Excel_2007_se-scenario-advanced.md`).

```
excess over 100,000        44,715.391666666
allowance withdrawn        22,357.695833333   (excess / 2)
personal allowance                  0.00      (12,570 - 22,357.70, floored at 0)
taxable income            144,715.391666666
basic     37,700.000000 x 0.20  =  7,540.000000
higher    87,440.000000 x 0.40  = 34,976.000000   (125,140 - 37,700)
addl      19,575.391667 x 0.45  =  8,808.926250   (144,715.391667 - 125,140)
statutory income tax            = 51,324.926250
```

The sheet gives 45,317.9566666665, so it understates by **£6,006.97**. NEXT.md's "~£5,028" is
the taper on its own with no additional rate; both effects together give the figure above.

NI is unchanged: E15 = 2,262.00, E16 = (144,715.391666666 − 50,270) × 0.02 = 1,888.907833.
Statutory total tax and NI = **55,475.83**.

**BST basic fixture, 2025-26.** `Income Tax!E5` = 226,508.

```
excess over 100,000       126,508
personal allowance              0
taxable income            226,508
basic     37,700 x 0.20  =  7,540.00
higher    87,440 x 0.40  = 34,976.00
addl     101,368 x 0.45  = 45,615.60
statutory income tax     = 88,131.60
```

The sheet gives 78,035, so it understates by **£10,096.60**.

NI: E15 = 2,262.00, E16 = (226,508 − 50,270) × 0.02 = 3,524.76. Statutory total tax and NI =
**£93,918.36**.

## 1.3 New TOML fields

Add to `[income_tax]` in every `app/data/se-*.toml`. BST, SE and Taxi all read these files
(`tax_regime = "se"` in each product's `meta.toml`).

| Field | 2020-21 | 2021-22 | 2022-23 | 2023-24 | 2024-25 | 2025-26 | 2026-27 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `personal_allowance_taper_threshold` | 100000 | 100000 | 100000 | 100000 | 100000 | 100000 | 100000 |
| `higher_band_end` | 150000 | 150000 | 150000 | 125140 | 125140 | 125140 | 125140 |
| `additional_rate` | 0.45 | 0.45 | 0.45 | 0.45 | 0.45 | 0.45 | 0.45 |

`higher_band_end` is the top of the higher-rate band measured on taxable income, so it pairs
with the existing `basic_band_end`. The additional band starts one pound above it; the sheet
never needs that number as an input, only as a display value.

Do not add a field for the £1-in-£2 withdrawal rate. It sits in ITA 2007 s35 and has not moved
since 2010, so it goes in the formula the same way `/100` does in the Ltd tax rows. If a later
year changes it, the field can be added then.

## 1.4 New Admin cells

Every cell named here already exists in the template XML as an empty styled cell, so
`setCellValue` will find it. The labels are static text, so bake them into the template as
`t="inlineStr"` rather than routing them through `stringEdits`.

**SE Admin**, `xl/worksheets/sheet10.xml`:

| Cell | Current XML | New content | Style to use | Fed by |
| --- | --- | --- | --- | --- |
| `I5` | `<c r="I5" s="147"/>` | label "Personal allowance taper threshold" | `s="450"` (copy I4) | static |
| `N5` | `<c r="N5" s="146"/>` | 100000 | `s="152"` (copy N20) | `personal_allowance_taper_threshold` |
| `O5` | `<c r="O5" s="146"/>` | "£" | keep `s="146"` | static |
| `I8` | `<c r="I8" s="147"/>` | label "Additional rate applicable above the higher rate limit" | `s="450"` (copy I7) | static |
| `N8` | `<c r="N8" s="146"/>` | 0.45 | `s="148"` (copy N7) | `additional_rate` |
| `O8` | `<c r="O8" s="146"/>` | "%" | keep `s="146"` | static |
| `I13` | `<c r="I13" s="147"/>` | label "Additional rate" | keep `s="147"` (matches I11/I12) | static |
| `K13` | `<c r="K13" s="147"/>` | 0.45 | `s="151"` (copy K11) | `additional_rate` |
| `L13` | `<c r="L13" s="147"/>` | 125141 | `s="146"` (copy L12) | `higher_band_end + 1` |
| `N13` | `<c r="N13" s="147"/>` | 125140 | `s="152"` (copy N12) | `higher_band_end` |

Add `<mergeCell ref="I5:M5"/>` and `<mergeCell ref="I8:M8"/>` to the sheet's `<mergeCells>`
element and raise its `count` attribute from 10 to 12. Rows 4, 6 and 7 already carry
`I4:M4`, `I6:M6` and `I7:M7`, so the new rows match them.

**BST Admin**, `xl/worksheets/sheet33.xml`:

| Cell | Current XML | New content | Style to use | Fed by |
| --- | --- | --- | --- | --- |
| `I5` | `<c r="I5" s="23"/>` | label "Personal allowance taper threshold" | `s="522"` (copy I4) | static |
| `N5` | `<c r="N5" s="29"/>` | 100000 | `s="34"` (copy N20) | `personal_allowance_taper_threshold` |
| `O5` | `<c r="O5" s="29"/>` | "£" | keep | static |
| `I9` | `<c r="I9" s="23"/>` | label "Additional rate applicable above the higher rate limit" | `s="522"` (copy I8) | static |
| `N9` | `<c r="N9" s="29"/>` | 0.45 | `s="32"` (copy N8) | `additional_rate` |
| `O9` | `<c r="O9" s="29"/>` | "%" | keep | static |
| `I14` | `<c r="I14" s="23"/>` | label "Additional rate" | keep `s="23"` (matches I11/I12/I13) | static |
| `K14` | `<c r="K14" s="23"/>` | 0.45 | `s="37"` (copy K13) | `additional_rate` |
| `L14` | `<c r="L14" s="23"/>` | 125141 | `s="29"` (copy L13) | `higher_band_end + 1` |
| `N14` | `<c r="N14" s="23"/>` | 125140 | `s="34"` (copy N13) | `higher_band_end` |

Add `<mergeCell ref="I5:M5"/>` and `<mergeCell ref="I9:M9"/>` and raise the `count` from 10 to
12. Rows 4, 7 and 8 already carry `I4:M4`, `I7:M7`, `I8:M8`.

**Generator write map**, `app/lib/generator.js`:

- `buildCellEdits` (BST and the fallback), around line 153, add:
  `numericEdits.N5 = it.personal_allowance_taper_threshold; numericEdits.N9 = it.additional_rate;
  numericEdits.K14 = it.additional_rate; numericEdits.L14 = it.higher_band_end + 1;
  numericEdits.N14 = it.higher_band_end;`
- `buildSeCellEdits`, around line 290, add:
  `numericEdits.N5 = it.personal_allowance_taper_threshold; numericEdits.N8 = it.additional_rate;
  numericEdits.K13 = it.additional_rate; numericEdits.L13 = it.higher_band_end + 1;
  numericEdits.N13 = it.higher_band_end;`
- `buildTaxiCellEdits` gets nothing. The Taxi Admin has its own row positions and its Income Tax
  sheet carries the same two-band limitation. That sheet is a separate item; the new TOML fields
  do not disturb it because nothing writes them into the Taxi Admin.

## 1.5 Rewriting the Income Tax sheets

The two sheets need three band rows where they have two. Neither sheet has any conditional
formatting, data validation or hyperlinks, and no merge covers rows 8 to 12 (SE merges: D2:F3,
D21:F21, D23:D24, E23:E24, B5:D5, B7:D7, C13:D13, B15:C15, B16:C16, B18:C18; BST is the same
set). Rows 10, 11 and 12 already exist with B, C, D and E cells present. So the change is a
rewrite of what rows 9 to 12 hold, with no row renumbering anywhere.

New layout, both products:

| Row | Holds | Was |
| --- | --- | --- |
| 8 | first band, basic rate | same |
| 9 | second band, higher rate | same |
| 10 | third band, additional rate | "Income Tax payable" |
| 11 | "Income Tax payable" | "Deductions by contractors" |
| 12 | "Deductions by contractors" | blank |

**SE formulas after the change** (`xl/worksheets/sheet6.xml`):

```
E6   =IF(E5<=0,0,MAX(0,Admin!N$4-MAX(0,E5-Admin!N$5)/2))
E7   =IF((E5>E6),(E5-E6),0)                      unchanged
C8   =Admin!N$11                                  unchanged, the band start (0)
D8   =Admin!N$6                                   unchanged
E8   =IF(E7>0,IF(E7<C9,E7*D8,C9*D8),0)            unchanged
C9   =Admin!M$11                                  was Admin!N$12
D9   =Admin!N$7                                   unchanged
E9   =IF(E7>C9,(MIN(E7,C10)-C9)*D9,0)
B10  "Income Tax third band"  (inline string)
C10  =Admin!N$13
D10  =Admin!N$8
E10  =IF(E7>C10,(E7-C10)*D10,0)
B11  shared string 101, "Income Tax payable"
E11  =SUM(E8:E10)
B12  shared string 4, "Deductions by contractors"
E12  =-[2]Mar!$X$1
E18  =SUM(E11:E17)                                was SUM(E10:E17)
```

`C9` moves to `Admin!M$11`. That cell holds `basic_band_end` (37,700) and the generator already
writes it. The template used `Admin!N$12`, which holds `higher_band_start` (37,701), so the
shipped sheet charges the pound at 37,701 at 20% where statute charges it at 40%. Twenty pence
on the SE fixture, and it also puts the sheet a pound out of step with `calculateIncomeTax`,
which already uses `basic_band_end`. Fix it here rather than asserting it. `C9` serves as both
the top of the basic band and the start of the higher band, which is what the two formulas
either side of it need.

**BST formulas after the change** (`xl/worksheets/sheet5.xml`):

```
E6   =IF(E5<=0,0,MAX(0,Admin!N$4-MAX(0,E5-Admin!N$5)/2))
E7   =IF((E5>E6),(E5-E6),0)                       was IF((E5>Admin!N4),(E5-E6),0)
C8   =Admin!N12                                   unchanged, the band start (0)
D8   =Admin!N7                                    unchanged
E8   =IF(E7>0,IF(E7<C9,E7*D8,C9*D8),0)            unchanged
C9   =Admin!M12                                   was Admin!N13
D9   =Admin!N8                                    unchanged
E9   =IF(E7>C9,(MIN(E7,C10)-C9)*D9,0)
B10  "Income Tax third band"  (inline string)
C10  =Admin!N14
D10  =Admin!N9
E10  =IF(E7>C10,(E7-C10)*D10,0)
B11  shared string 85, "Income Tax payable"
E11  =SUM(E8:E10)
B12  shared string 17, "Deductions by contractors"
E12  =-SalesMar!$K$1
E18  =SUM(E11:E17)                                was SUM(E10:E17)
```

BST's `E7` guard has to change. It tests `E5 > Admin!N4` where SE tests `E5 > E6`. Once the
allowance tapers, `E6` is no longer `Admin!N4`, and the old guard lets a partly tapered
allowance produce the wrong taxable income. `Admin!M12` is BST's `basic_band_end` cell, written
by `buildCellEdits` line 158.

**Styles to carry across.** In SE, band rows use `B s="108"`, `C s="108"`, `D s="144"`,
`E s="99"`; the payable row uses `B s="114"`, `C s="139"`, `D s="136"`, `E s="292"`; the CIS row
uses `B s="108"`, `C s="108"`, `D s="101"`, `E s="99"`. In BST, band rows use `B s="53"`,
`C s="71"`, `D s="57"`, `E s="47"`; the payable row uses `B s="59"`, `C s="60"`, `D s="61"`,
`E s="167"`; the CIS row uses `B s="53"`, `C s="53"`, `D s="62"`, `E s="47"`. Move the styles
with the content. Also move `ht="14" thickBot="1"` from the `<row r="9">` element to
`<row r="10">` so the rule under the bands stays under the last band.

**Shared strings.** Reuse the existing indices by writing `t="s"` with the index in `<v>`, as
listed above. Write the one new caption as `t="inlineStr"`, the convention `setCellString`
already follows, so `sharedStrings.xml` never has to change.

## 1.6 Downstream references

BST's `Profit & Loss Acc` sheet (`xl/worksheets/sheet4.xml`) is the only sheet outside the
Income Tax sheet that reads it. It references `'Income Tax'!E10`, `'Income Tax'!E11`,
`'Income Tax'!E15` and `'Income Tax'!E16`. Rewrite `E11` to `E12` **first**, then `E10` to
`E11`. E15 and E16 do not move. SE has no external reference to its Income Tax sheet at all
(checked across all nine SE workbooks).

`bst-excel.xlsx` sheet1 (`Home`) references `'Income Tax'!D2`, which does not move.

## 1.7 JavaScript

**`app/lib/tax/income-tax.js`.** Extend `calculateIncomeTax` with the taper and the third band:

```js
const fullAllowance = taxRates.personal_allowance;
const withdrawn = Math.max(0, profit - taxRates.personal_allowance_taper_threshold) / 2;
const pa = Math.max(0, fullAllowance - withdrawn);
const taxableIncome = Math.max(0, profit - pa);
const basicBand = taxRates.basic_band_end;
const higherBandEnd = taxRates.higher_band_end;
const basicRateTax = Math.min(taxableIncome, basicBand) * taxRates.basic_rate;
const higherRateTax = Math.max(0, Math.min(taxableIncome, higherBandEnd) - basicBand) * taxRates.higher_rate;
const additionalRateTax = Math.max(0, taxableIncome - higherBandEnd) * taxRates.additional_rate;
```

Return `additionalRateTax` alongside the other two and surface it from `calculateExpectedTax`
as `income_tax_additional`. `calculateExpectedTax` also has to report the tapered allowance so
the product checks can assert `E6`; add `personal_allowance: pa` to its return.

**`app/products/se.js`.** Cell addresses in `CELL_MAP` (lines 567 to 576) move:

- `E10` "**Total Income Tax**" becomes `E11`
- `E11` "Less: CIS Deducted" becomes `E12`
- add `E10` "Tax at Additional Rate (45%)" between the existing E9 and the new E11
- add `C10` and `D10` rows so the report states the band and rate the sheet applies, matching
  what BST already does at its C9/D9

Checks in `checkCompliance` (lines 1265 to 1279):

```js
check("Income Tax", tax.E11 || 0, expectedTax.income_tax);
check("Tax: Personal allowance after taper", tax.E6, expectedTax.personal_allowance);
check("Tax: Taxable = Profit - Allowance", tax.E7, Math.max(0, (tax.E5 || 0) - (tax.E6 || 0)));
check("Tax: IT = Basic + Higher + Additional", tax.E11, (tax.E8 || 0) + (tax.E9 || 0) + (tax.E10 || 0));
check("Tax: sheet splits the basic and higher bands at the basic band end", tax.C9, taxData.income_tax.basic_band_end);
check("Tax: sheet splits the higher and additional bands at the higher band end", tax.C10, taxData.income_tax.higher_band_end);
check("Tax: sheet applies the additional rate above the higher band", tax.D10, taxData.income_tax.additional_rate, 0.0001);
check("Tax at additional rate", tax.E10 || 0, expectedTax.income_tax_additional);
check("Tax: Total = IT + CIS deduction line + NI", tax.E18, (tax.E11 || 0) + (tax.E12 || 0) + (tax.E15 || 0) + (tax.E16 || 0));
```

Add the three new Admin echo rows to the SE `CELL_MAP` Admin block (line 638 onwards) and the
matching `check("Admin: ...", ...)` calls, following the existing pattern:
`N5` taper threshold, `N8` additional rate, `N13` higher band end.

**`app/products/bst.js`.** Same shape. `CELL_MAP` lines 183 to 195 shift `E10`/`E11` to
`E11`/`E12` and gain `C10`, `D10`, `E10`. In `checkCompliance` (lines 501 to 540),
`computedIncomeTax` becomes `(tax.E11 || 0) - (tax.E12 || 0)` and every `tax.E10`/`tax.E11`
reference moves with it. Add the same additional-rate and taper checks. Add Admin echo rows for
`N5`, `N9` and `N14`.

While you are in `bst.js`, note that its "Tax: Total = IT - CIS + NI" check subtracts `E11`
where `se.js` adds it, and both claim to reproduce the same `SUM` formula. `E11` already holds
the CIS figure negated (`=-SalesMar!$K$1`), so adding is right and subtracting is wrong. Every
fixture carries nil CIS, which is why neither has ever failed. Fix the BST check to add, and
say so in the commit message.

**`app/bin/judge-reconciliation.js`.** Delete the second `bst` note at line 83 ("The shipped
income tax sheet works two bands..."). Leave the first one.

## 1.8 Anchoring and breakability

`checkCompliance` compares the sheet against `calculateExpectedTax` run on the sheet's own `E5`,
so on its own it cannot catch a fixture-independent error in both. Anchor it in the test files.

In `app/test/se-precision-code.test.js`, add:

```js
it("charges the statutory 2025-26 tax on the advanced fixture profit", () => {
  const tax = results["Income Tax"];
  expect(tax.E5).toBeCloseTo(144715.391666666, 4);
  expect(tax.E6).toBe(0);
  expect(tax.E8).toBeCloseTo(7540, 2);
  expect(tax.E9).toBeCloseTo(34976, 2);
  expect(tax.E10).toBeCloseTo(8808.92625, 2);
  expect(tax.E11).toBeCloseTo(51324.92625, 2);
  expect(tax.E18).toBeCloseTo(55475.834083, 2);
});
```

In `app/test/bst-precision-code.test.js`, the same with 226508 / 0 / 7540 / 34976 / 45615.60 /
88131.60 / 93918.36.

**The taper's partial branch has no fixture.** Both fixtures sit above £125,140, where the
allowance is nil. A check anchored only to them cannot tell a correct taper from a formula that
zeroes the allowance over £100,000. Prove the branch with a band-table test rather than a new
fixture. Write `app/test/se-income-tax-bands.test.js`:

- Generate `Financialaccounts.xlsx` from the SE template and `se-2025-2026.toml` exactly as
  `se-precision-code.test.js` does.
- For each profit in `[8000, 30000, 60000, 110000, 125140, 144715.391666666, 226508]`, call
  `runSpreadsheet(buffer, { "Income Tax": { E5: profit } }, { "Income Tax": ["E6","E7","E8","E9","E10","E11"] })`.
  The runner's `setCellValue` drops `E5`'s formula and leaves a literal, which is what you want.
- Assert each result against a hand-computed table written out in the test. £110,000 is the one
  that proves the taper: allowance = 12,570 − 5,000 = 7,570, taxable = 102,430, basic = 7,540,
  higher = (102,430 − 37,700) × 0.40 = 25,892, additional = 0, total = 33,432.
- Do the same for BST in `app/test/bst-income-tax-bands.test.js` with `E5` written into the
  `Income Tax` sheet of `bst-excel.xlsx`.

Each profit costs one LibreOffice pass, so give the file a generous `beforeAll` timeout and run
it with `--fileParallelism=false`.

**Breakability proof.** Follow `app/test/se-admin-echo-checks.test.js` exactly. It already has
`corruptCellValue` and `readCorruptedCell` and the `checksWithCorruptedCell` helper. Add cases
that corrupt, one at a time:

| Corrupt | Checks that must flip, and only these |
| --- | --- |
| `Income Tax!E6` | "Tax: Personal allowance after taper", "Tax: Taxable = Profit - Allowance" |
| `Income Tax!E10` | "Tax at additional rate", "Tax: IT = Basic + Higher + Additional" |
| `Income Tax!E11` | "Income Tax", "Tax: IT = Basic + Higher + Additional", "Tax: Total = IT + CIS deduction line + NI" |
| `Income Tax!C10` | "Tax: sheet splits the higher and additional bands at the higher band end" |
| `Income Tax!D10` | "Tax: sheet applies the additional rate above the higher band" |
| `Admin!N5` | "Admin: Personal Allowance Taper Threshold = tax data" |
| `Admin!N8` (SE) / `Admin!N9` (BST) | "Admin: Additional Rate = tax data" |
| `Admin!N13` (SE) / `Admin!N14` (BST) | "Admin: Higher Band End = tax data" |

## 1.9 Pitfalls specific to this track

- **BST `Admin!K12` is a shared-formula master**, `<f t="shared" ref="K12:K13" si="0">N7</f>`,
  with `K13` as its follower. `setCellValue` replaces a cell's whole body, so writing a value
  into `K12` would orphan `K13`. Do not write `K12`. `K14` is outside the group and safe.
- **Do not touch `sharedStrings.xml`.** Reuse existing indices or write inline strings.
- **`mergeCells` carries a `count` attribute.** Raise it when you add merges, or Excel repairs
  the file on open.
- **`setCellValue` throws when a cell is missing.** Every cell in the tables above already
  exists, but confirm with `matchCell` before adding a generator write for anything else.
- The SE Admin sheet's `<dimension ref="A1:O28"/>` and the BST sheet's `<dimension ref="A1:O27"/>`
  already cover every cell used here.

## 1.10 Blast radius

```
npx vitest run --fileParallelism=false \
  app/test/tax/income-tax.test.js \
  app/test/generate.test.js \
  app/test/se-precision-code.test.js \
  app/test/se-reconciliation-checks.test.js \
  app/test/se-admin-echo-checks.test.js \
  app/test/se-income-tax-bands.test.js \
  app/test/bst-precision-code.test.js \
  app/test/bst-closure-checks.test.js \
  app/test/bst-fixed-assets-admin-checks.test.js \
  app/test/bst-income-tax-bands.test.js \
  app/test/taxi-sp-sixty.test.js \
  2>&1 | tee target/track1.log | tail -40
```

Taxi is in the list because it reads the same TOML files. Then `npm test`, then the
`generate-se`, `generate-bst` and `generate-taxi` workflows with skip-commit on the branch.

## 1.11 Risk

The row rewrite is the riskiest part of this track, and it is the reason the track is priced at
Opus. It is not a row insertion (every row already exists and no reference outside the sheet
moves except BST's two P&L cells), but it moves four rows of content and their styles at once.
Rewrite the rows as whole `<row>` elements rather than cell by cell, and diff the recalculated
`Income Tax` sheet against the old one cell by cell before trusting it.

If the row rewrite turns out to be more than it looks, the fallback is to leave rows 10 to 12
alone and put the third band's inputs and result in `G9`, `H9` and `I9`, with
`E9 = IF(E7>C9,(MIN(E7,G9)-C9)*D9,0)+I9`. That keeps every downstream reference and every total
untouched at the cost of a band that does not read as a band. Take it only if the rewrite
fails, and record why.

---

# Track 2 — Ltd corporation tax, the CT600, and the mileage rate

All three items live in `app/templates/ltd/Financialaccounts.xlsx` or in files the same agent
has to edit anyway. The marginal relief step and the CT600 row 128 wiring are the same fix seen
from two ends, and a third defect sits underneath both of them.

## 2.1 The defect underneath: the two tax rows do not describe the accounting period

`Admin` (`xl/worksheets/sheet12.xml`) holds the corporation tax rate table:

```
K6 =YEAR(L6)   L6 =B9    N6 =B32    P6 = 19
K7 =YEAR(L7)   L7 =B33   N7 =B56    P7 = 19
```

For a 31 March 2026 year end, `B9` = 1 Apr 2025, `B32` = 31 Mar 2026, `B33` = 1 Apr 2026 and
`B56` = 31 Mar 2027. So row 6 describes the accounting period and row 7 describes **the year
after it**.

`CorporationTax` (`xl/worksheets/sheet8.xml`) builds the charge from those dates:

```
A33 =D33-C33+1                             C33 =Admin!L6   D33 =Admin!N6   E33 =Admin!K6
A34 =D34-C34+1                             C34 =Admin!L7   D34 =Admin!N7   E34 =Admin!K7
A35 =D34-C33+1
F33 =IF(K28>0,K28*A33/A35,0)   G33 =Admin!P6   I33 =F33*G33/100
F34 =IF(K28>0,K28*A34/A35,0)   G34 =Admin!P7   I34 =F34*G34/100
K35 =SUM(I33:I34)
```

On the 31 March 2026 Ltd package the reconciliation report reads A33 = 365, A34 = 365,
A35 = 730, F33 = F34 = 73,759.9489 and I33 = I34 = 14,014.3903. The chargeable profit of
147,519.897839506 is split in half and half of it is charged in a period the accounts do not
cover. The total `K35` = 28,028.78 comes out right only because both rows carry the same rate.

The same bug shows in the working sheet's own heading. `E5 = Admin!L6` and `H5 = Admin!N7`, so
"Operating profit before tax for the 12 months" prints 01/04/2025 to 31/03/2027.

Repair the dates before doing anything else, because both the marginal relief step (the limits
are apportioned per row) and box 63 depend on the rows being right.

**New Admin formulas.** `L6` stays `=B9`, the period start.

```
N6 =MIN(IF(DATE(YEAR(L6),3,31)>=L6,DATE(YEAR(L6),3,31),DATE(YEAR(L6)+1,3,31)),F21)
L7 =N6+1
N7 =F21
K6 =YEAR(L6)-IF(MONTH(L6)<4,1,0)
K7 =YEAR(L7)-IF(MONTH(L7)<4,1,0)
```

`N6` is the 31 March inside the accounting period, clamped to the year end. For a 31 March year
end that lands on the year end itself, so row 7 collapses to nothing. For a 31 December 2025
year end (period 1 Jan 2025 to 31 Dec 2025) it gives N6 = 31 Mar 2025, L7 = 1 Apr 2025,
N7 = 31 Dec 2025, A33 = 90, A34 = 275, A35 = 365.

`K6`/`K7` change because a financial year is named after the calendar year it starts in. The
slice 1 Jan to 31 Mar 2025 belongs to FY2024, and CT600 box 43 wants that number.

**New CorporationTax formula.** `A34 =MAX(0,D34-C34+1)`, so a period wholly inside one financial
year gives a zero second row instead of a negative day count.

**The cached-value trap, and the biggest risk in this track.** `Admin!N7` is read across the
external link by `Fixedassets.xlsx` (`Schedule!J4`, `K4` and `S4` all read `[1]Admin!$N$7`).
Spreadsheet apps updating links against a closed `Financialaccounts.xlsx` read the *stored*
cached value and never recalculate, which is exactly why `rollLtdAdminCachedDates` exists for
the B column. `L6`, `N6`, `L7`, `N7`, `K6` and `K7` are formula cells whose cached values come
from the template snapshot, so after this change the generator has to write their cached values
too. Extend `rollLtdAdminCachedDates` in `app/lib/generator.js` (line 401) or add a sibling
function that computes the six values from the year-end serial and calls `setCellCachedValue`.
Do not skip this. Without it the shipped packages carry stale dates in every one of them while
every test passes, because the test path recalculates.

## 2.2 Marginal relief

Plan of record: `_developers/backlog/PLAN_LTD_MARGINAL_RELIEF.md`. The TOML fields it lists
already exist in every `app/data/ltd-*.toml`:

```
main_rate = 0.25
small_profits_rate = 0.19
small_profits_limit = 50000
main_rate_limit = 250000
marginal_relief_fraction = 0.015
```

**Hand-computed on the Ltd full fixture, 31 March 2026.** `CorporationTax!K28` =
147,519.897839506 (read from the report's CT600 box 315 line).

```
main rate charge   147,519.897839506 x 0.25          = 36,879.974460
relief             (250,000 - 147,519.897840) x 0.015 =  1,537.201532
statutory charge                                      = 35,342.772927
```

The sheet charges 28,028.78, so it understates by **£7,313.99**. That matches the figure the
existing warning already carries.

**New Admin cells.** All four already exist as empty styled cells. Labels are static text, so
write them into the template as inline strings.

| Cell | Current XML | New content | Style | Fed by |
| --- | --- | --- | --- | --- |
| `I8` | `<c r="I8" s="253"/>` | label "Main rate" | `s="185"` (copy I6) | static |
| `P8` | `<c r="P8" s="255"/>` | 25 | `s="310"` (copy P6) | `round(main_rate * 100)` |
| `Q8` | `<c r="Q8" s="255"/>` | "%" | keep | static |
| `I9` | `<c r="I9" s="253"/>` | label "Marginal relief fraction" | `s="185"` | static |
| `P9` | `<c r="P9" s="264"/>` | 0.015 | `s="310"` | `marginal_relief_fraction` |
| `I12` | `<c r="I12" s="253"/>` | label "Marginal relief lower limit" | `s="185"` | static |
| `P12` | `<c r="P12" s="255"/>` | 50000 | `s="262"` (copy E11) | `small_profits_limit` |
| `I13` | `<c r="I13" s="253"/>` | label "Marginal relief upper limit" | `s="185"` | static |
| `P13` | `<c r="P13" s="255"/>` | 250000 | `s="262"` | `main_rate_limit` |

The sheet's `<dimension ref="A1:Q57"/>` and every row's `spans="1:17"` already reach column Q,
so nothing structural changes. Rows 9, 12 and 13 hold other content in the L to N range
(`L9` "Date", `N9` "Number", `L10`/`N10`, `L11`/`N11`); keep the labels merged no wider than
`I:K` on row 9 and `I:O` on rows 8, 12 and 13, and check the sheet's existing `<mergeCells>`
before adding.

Extend `buildLtdCellEdits` (`app/lib/generator.js` line 345) with the four numeric writes.

**New CorporationTax formulas.** Rows 33 and 34 gain three helper cells each. Confirm `H`, `J`,
`L` and `M` exist as styled blanks on those rows before writing; if any is absent, insert it
with `insertCellIntoRow`.

```
L33 =Admin!$P$12*A33/365          apportioned lower limit for this financial year slice
M33 =Admin!$P$13*A33/365          apportioned upper limit
G33 =IF(F33<=L33,Admin!P6,Admin!$P$8)          rate before relief
H33 =IF(AND(F33>L33,F33<M33),(M33-F33)*Admin!$P$9,0)    marginal relief
J33 =F33*G33/100                  tax at the rate before relief
I33 =J33-H33                      tax after relief
```

Row 34 is the same with `A34`, `F34`, `Admin!P7` in place of `Admin!P6`, and `L34`/`M34`/`G34`/
`H34`/`J34`/`I34`.

`K35 = SUM(I33:I34)` is unchanged and now gives the statutory charge.

The apportionment uses `A33/365` rather than `A33/A35` so the limits scale correctly for a
period that is not twelve months. For a twelve-month period the two are the same.

**What this design leaves open.** Marginal relief is strictly `(U − A) × N/A × F`, where A is
augmented profits and N is taxable total profits. The working sheet has no input for franked
investment income, so A = N and the ratio is 1. It also has no associated-companies count, so
the limits are not divided. The CT600's own associated-company boxes (38 and 41) carry no
formula either. Add a `P14` associated-companies cell and a `/(1+Admin!$P$14)` divisor on `L33`
and `M33` in a later pass, together with the CT600 boxes. Say that in the commit message rather
than in a comment.

**The straddle limit.** `Admin!P8` and `P9` are period-wide, and `P6`/`P7` both come from the
one `ltd-<FY>.toml` the package is generated from. FY2023 onwards the rates and limits are
identical in consecutive years, and FY2020 to FY2022 are a flat 19% with no relief, so a single
year's figures are right for both rows everywhere in the current data set except a period
straddling 31 March 2023. Assert that the two rows carry the same rate and record the straddle
as the open question. Do not build a two-TOML loader in this pass.

**Zero-fraction years.** Check `app/data/ltd-2020.toml` through `ltd-2022.toml` before writing
`P9`. Where the fraction and the limits are zero, `L33` and `M33` come out zero, `F33 <= L33`
is false and `F33 < M33` is false, so `G33` picks the main rate and `H33` is zero. If those
files carry `main_rate = 0.19` the answer is right. If they carry a different main rate, the
formula would charge it. Read them and, if needed, guard with
`IF(M33<=0,Admin!P6,...)`.

## 2.3 CT600 row 128 and the relief boxes

`CT600` is `xl/worksheets/sheet9.xml`. Row 126 is wired, row 128 is not, and there are no merges
on rows 124 to 136.

Row 126 as shipped:

```
C126  s="545"  =CorporationTax!E33      box 43, financial year
N126  s="522"  =CorporationTax!F33      box 44, amount of profit
AA126 s="548"  =CorporationTax!G33      box 45, rate of tax
AJ126 s="535"  =CorporationTax!I33      box 46, tax
AJ131 s="535"  =AJ126+AJ128             box 63, total of boxes 46 and 56
```

Row 128 as shipped, every value cell present and empty:

```
C128  s="483"   D128..H128 s="483"
N128  s="483"   O128..T128 s="483"
AA128 s="483"   AB128      s="483"
AJ128 s="535"   AK128..AP128 s="468"
```

**The wiring.** Give row 128 the formulas and the styles of row 126:

```
C128  =CorporationTax!E34    restyle to s="545";  D128..G128 to s="546";  H128 to s="547"
N128  =CorporationTax!F34    restyle to s="522";  O128..S128 to s="468";  T128 to s="534"
AA128 =CorporationTax!G34    restyle to s="548";  AB128 to s="549"
AJ128 =CorporationTax!J34    keep s="535";        AK128..AP128 to s="535"
```

Every style index used here already exists in the workbook's `styles.xml` because row 126 uses
them, so no style table change is needed.

**Box 46 changes source.** With marginal relief in the working sheet, box 46 is the tax at the
gross rate and box 64 carries the relief. So `AJ126` moves from `CorporationTax!I33` to
`CorporationTax!J33`, and `AJ128` reads `CorporationTax!J34`.

**Boxes 64 and 65.** Row 133 is box 64 "Marginal rate relief" and row 135 is box 65
"Corporation tax net of marginal rate relief". Both carry the box number at `V`, the "£" marker
at `W` and the "p" marker at `AE`, and neither has a value cell with a formula. The value cell
is the one immediately right of the "£" marker, matching `AI126` to `AJ126` and `AI131` to
`AJ131` on the wired rows, so:

```
X133 =CorporationTax!H33+CorporationTax!H34    box 64, marginal relief
X135 =AJ131-X133                                box 65, tax net of relief
```

`X133` and `X135` currently carry `s="225"` with `Y..AC` at `s="514"`. Leave the styles alone
unless the recalculated sheet renders the number in the wrong place; check it before changing
anything.

**What the boxes then say** on the Ltd full fixture at 31 March 2026, after both the date repair
and marginal relief:

```
box 43  2025            box 53  (blank, A34 = 0)
box 44  147,519.90      box 54  0
box 45  25              box 55  19 or 25 with a zero profit; assert nothing but its presence
box 46  36,879.97       box 56  0
box 63  36,879.97
box 64   1,537.20
box 65  35,342.77   = CorporationTax!K35
```

## 2.4 The Ltd expensesform mileage rate

`app/templates/ltd/expensesform.xlsx` has twelve sheets, `Month 01` through `Month 12`, at
`xl/worksheets/sheet1.xml` to `sheet12.xml`. Only `Month 01` holds a literal:

```
Month 01  C30  <c r="C30" s="15"><v>0.45</v></c>
Month 02  C30  <c r="C30" s="15"><f>'Month 01'!C30</f><v>0.45</v></c>
```

Months 02 to 12 all chain from `Month 01`. `B30` prints the caption from it
(`="Mileage Claim @ " & TEXT(C30*100,0) & "p"`) and `F30` computes the claim
(`=IF(D30>0,D30*C30," ")`), so writing `Month 01!C30` moves everything.

**Generator.** `app/templates/ltd/meta.toml` has no `[sheets.expensesform]` block, so
`generate.js` copies the file through untouched (line 112 only calls `generateSpreadsheet` when
`sheetsConfig` is non-empty). Add:

```toml
[sheets.expensesform]
mileageMonth = "xl/worksheets/sheet1.xml"
```

and a branch in `generateSpreadsheet` that writes `C30 = mil.higher_rate_pence` when
`sheetsConfig.mileageMonth` is present, following the shape of the existing `payslipsAdmin`
branch (`app/lib/generator.js` line 771).

Do not try to link `expensesform.xlsx` to the Financialaccounts Admin sheet. The workbook has no
external links at all, and adding one would mean a new `externalLinks` part, a new relationship,
and a cache the runner has to refresh. A generator write into a workbook that already has none
is the cheaper and safer echo.

**Check.** `app/products/ltd.js`, in `multiFileOptions().additionalReads` (line 1174):

```js
"expensesform.xlsx": Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [`Month ${String(i + 1).padStart(2, "0")}`, ["C30"]]),
),
```

and in `checkCompliance`, alongside the other Admin echoes:

```js
for (let m = 1; m <= 12; m++) {
  const sheet = `Month ${String(m).padStart(2, "0")}`;
  const form = results[`expensesform.xlsx!${sheet}`];
  if (form) check(`Expenses form ${sheet}: mileage rate = tax data`, form.C30, mil.higher_rate_pence, 0.0001);
}
```

Twelve checks, of which eleven prove the chain from `Month 01` carries and one proves the
generator wrote the right figure. Add `Month 01!C30` to `CELL_MAP` so the report states it.

## 2.5 Anchoring and breakability

Anchor the corporation tax figure in `app/test/ltd-precision-code.test.js`:

```js
it("charges the statutory corporation tax on the full fixture profit", () => {
  const ct = results.CorporationTax;
  expect(ct.K28).toBeCloseTo(147519.897839506, 4);
  expect(ct.A33).toBe(365);
  expect(ct.A34).toBe(0);
  expect(ct.A35).toBe(365);
  expect(ct.F33).toBeCloseTo(147519.897839506, 4);
  expect(ct.H33).toBeCloseTo(1537.201532, 4);
  expect(ct.K35).toBeCloseTo(35342.772927, 4);
  expect(results.CT600.AJ131).toBeCloseTo(36879.974460, 4);
  expect(results.CT600.X133).toBeCloseTo(1537.201532, 4);
  expect(results.CT600.X135).toBeCloseTo(35342.772927, 4);
});
```

Add a second case on a non-March year end so the two-row split is exercised. Generate the same
fixture at a 31 December year end and assert A33 = 90, A34 = 275, A35 = 365, and that
`I33 + I34` equals the statutory charge on the whole chargeable profit. That is the only test
that proves the date repair, because the 31 March package collapses row 34 to nothing.

Also add a profit-level table so the relief band's three branches all get exercised. Write
literal values into `CorporationTax!K28` on a recalculated copy the way track 1 writes `E5`, at
£40,000 (small profits rate, £7,600), £147,519.90 (relief, £35,342.77) and £300,000 (main rate,
£75,000), and assert `K35` each time.

**Convert the warnings to hard checks.** In `app/products/ltd.js`:

- Line 2264: `check("CT600: second financial year tax box is blank", num(ct600.AJ128), 0)`
  inverts to `check("CT600: second financial year tax = second tax row gross tax", num(ct600.AJ128), num(corporationTax.J34))`.
- Lines 2270 to 2277: the "CT600: tax payable against the working sheet's charge for the year"
  warning becomes `check("CT600: tax net of marginal relief = the working sheet's charge", num(ct600.X135), num(corporationTax.K35))`.
- Lines 2333 to 2344: the "CT: charge for the year against the statutory computation with
  marginal relief" warning becomes a plain `check` at tolerance 1.
- Line 2306: "CT: first tax row tax = its profit at its rate" becomes
  `check("CT: first tax row tax = its gross tax less its marginal relief", num(ct.I33), num(ct.J33) - num(ct.H33))`,
  and the same for row 34.
- Line 2327: "CT: charge for the year = chargeable profit at the Admin corporation tax rate"
  no longer holds and has to go. Replace it with a check that the two rows carry the same
  small-profits rate (`num(ct.G33)` against `num(ct.G34)` when `A34 > 0`), which is the
  assumption the single-TOML generation rests on.
- Add `check("CT: the two tax rows span the accounting period", num(ct.A35), yearEndSerial - periodStartSerial + 1)`
  once the year end is available. NEXT.md already carries "Pass the package year-end into
  `checkCompliance`" as an open item; if it has not landed, assert `A35` against
  `Admin!N7 - Admin!L6 + 1` instead.

**`app/bin/judge-reconciliation.js`.** Delete the second and third `ltd` notes (the marginal
relief note and the box 53-to-56 note). Leave the first.

**Breakability proof.** New file `app/test/ltd-corporation-tax-checks.test.js`, built on
`app/test/ltd-brickwork-pro-nonvat.test.js`'s corrupt-and-recheck helper.

| Corrupt | Checks that must flip, and only these |
| --- | --- |
| `CorporationTax!H33` | "CT: first tax row tax = its gross tax less its marginal relief", "CT: charge for the year against the statutory computation", "CT600: tax net of marginal relief = the working sheet's charge" |
| `CorporationTax!J33` | "CT: first tax row tax = ...", "CT600: corporation tax = first tax row gross tax" |
| `CorporationTax!A34` | "CT: the two tax rows span the accounting period" |
| `CT600!AJ128` | "CT600: second financial year tax = second tax row gross tax", "CT600: tax payable = tax chargeable" |
| `CT600!X133` | "CT600: tax net of marginal relief = the working sheet's charge" |
| `Admin!P8` | "Admin: main rate = tax data" |
| `Admin!P9` | "Admin: marginal relief fraction = tax data" |
| `expensesform.xlsx!Month 05!C30` | "Expenses form Month 05: mileage rate = tax data" |

## 2.6 Pitfalls specific to this track

- **The cached-date trap in 2.1 is the one that will bite.** Nothing in the test suite catches
  it because the runner recalculates. Verify by generating a package with
  `node app/bin/generate.js --skip-guide` for one year end and reading the stored `<v>` of
  `Admin!N7` straight out of the zip.
- **`Fixedassets.xlsx` cached values move with `Admin!N7`.** `Schedule!J4`, `K4` and `S4` all
  read `[1]Admin!$N$7` through external link 1. After the date repair the schedule's column
  headers change from "31/03/2027" to the year end, which is right, and the external link cache
  in `Financialaccounts.xlsx` has to agree. `refreshExternalLinkCaches` in the runner handles the
  test path; check the generated package by hand once.
- **`CorporationTax!G33` must not reference `I33`.** The design above keeps `G33` as the rate
  before relief precisely to avoid a circular reference. Do not make it an effective rate.
- **Confirm `H`, `J`, `L` and `M` cells exist on rows 33 and 34** before writing formulas into
  them. The row elements carry `spans` attributes that may need widening.
- **CT600 style indices are workbook-wide.** Reusing row 126's indices on row 128 needs no
  `styles.xml` change.
- **`app/lib/tax/corporation-tax.js` already computes marginal relief correctly** and is what
  the current warning compares against. Do not rewrite it; the sheet is coming to meet it.

## 2.7 Blast radius

```
npx vitest run --fileParallelism=false \
  app/test/tax/corporation-tax.test.js \
  app/test/generate.test.js \
  app/test/ltd-precision-code.test.js \
  app/test/ltd-reconciliation-checks.test.js \
  app/test/ltd-trial-balance-audit.test.js \
  app/test/ltd-opening-balance.test.js \
  app/test/ltd-brickwork-pro-nonvat.test.js \
  app/test/ltd-vat-localisation.test.js \
  app/test/ltd-corporation-tax-checks.test.js \
  app/test/judge-reconciliation.test.js \
  2>&1 | tee target/track2.log | tail -40
```

Then `npm test`, then `generate-ltd` with skip-commit on the branch across several year ends,
including at least one December and one leap-year February.

## 2.8 Risk

Highest of the four tracks. The date repair changes what every Ltd package says its accounting
period is, it reaches `Fixedassets.xlsx` through an external link, and it depends on cached
values the test path never exercises. Land the date repair on its own commit with its own
generated-package inspection before adding marginal relief on top.

---

# Track 3 — Fixed assets: closing book value and the HP finance rows

Both repairs live in `app/templates/se/Fixedassets.xlsx` and `app/templates/ltd/Fixedassets.xlsx`,
which are separate files with near-identical layouts. One agent takes both.

## 3.1 The Schedule keeps sold assets in its closing book value

Sheet `Schedule`, `xl/worksheets/sheet1.xml` in both workbooks. Per asset row `r`:

```
E   original cost                       (entered)
F   accumulated depreciation b/f        (entered)
G   =IF(Er>0,Er-Fr," ")                 book value b/f
H   depreciation rate
I   =IF(Er>0,MIN(Er*Hr,Gr)," ")         charge for the year
J   =IF(Er>0,Fr+Ir," ")                 accumulated depreciation c/f
K   =IF(Er>0,Er-Jr," ")                 book value c/f
U   date sold                           (entered)
V   sale proceeds                       (entered)
W   =IF(Vr>0,Er," ")                    cost of the asset sold
X   =IF(Vr>0,Jr," ")                    accumulated depreciation on it
```

`K` never looks at `V`, so a sold asset keeps a closing book value. On both the SE advanced and
the Ltd full fixture:

```
E1 = 65,500   J1 = 21,838   K1 = E1 - J1 = 43,662
W1 = 30,000   X1 = 17,328
true closing NBV = (E1 - W1) - (J1 - X1) = 35,500 - 4,510 = 30,990
```

**Which design to take, and why.** Nothing outside the Schedule sheet reads any `K` cell. A
sweep of every formula in every SE and Ltd workbook finds `Schedule!$K$` nowhere;
`Financialaccounts.xlsx` reads `E`, `F`, `I`, `Q`, `R`, `S`, `V`, `W`, `X`, `Y` and `Z` from the
Schedule and builds the Ltd fixed asset note from those. So the `K` column is presentation
inside the Schedule and can be corrected without touching the balance sheet, the note, the
capital allowance chain or the profit and loss account.

Take the row-level netting. A separate disposals row at the totals level would leave every
per-asset `K` cell wrong on the printed schedule, which is the sheet a customer reads, and it
would not fix `K1` unless the block subtotals were rewritten anyway.

**The change.** One formula, applied everywhere the `K` column carries it:

```
K<r> =IF(E<r>>0,IF(V<r>>0,0,E<r>-J<r>)," ")
```

A sold row contributes nothing to the closing book value, which is exactly right: its closing
cost is `E − W = 0` and its closing depreciation is `J − X = 0`. The block subtotals
(`K11 = SUM(K8:K10)` and so on) and `K1 = K57+K110` need no change, because summing the
corrected rows gives `(ΣE − ΣW) − (ΣJ − ΣX)`.

Leave `I` and `J` alone. `I1` is the depreciation charge the profit and loss account reads
(`Schedule!$I$1` from SE sheet4 and Ltd sheet2), and `X = J` on a sold row is what lets the Ltd
note net the disposal out. Changing either breaks a tie that currently holds.

**Doing it in the XML.** The `K` formulas appear as plain formulas on some rows and as shared
masters on others; shared followers inherit the master with the row offsets adjusted, so only
masters need editing. Ltd has six `K` shared masters (`K14` ref `K14:K21` si 4, `K33` ref
`K33:K40` si 15, `K44` ref `K44:K54` si 26, `K67` ref `K67:K74` si 35, `K86` ref `K86:K93` si 45,
`K97` ref `K97:K107` si 55); SE has two (`K44` ref `K44:K54` si 4, `K97` ref `K97:K107` si 12).

One regex over the sheet XML covers both cases:

```js
xml.replace(
  /<f( t="shared" ref="K\d+:K\d+" si="\d+")?>IF\(E(\d+)&gt;0,E\2-J\2," "\)<\/f>/g,
  (_m, sharedAttrs, row) =>
    `<f${sharedAttrs || ""}>IF(E${row}&gt;0,IF(V${row}&gt;0,0,E${row}-J${row})," ")</f>`,
);
```

The pattern `E<n>-J<n>` appears only in the `K` column. `G` uses `E-F` and `J` uses `F+I`, so
there is no collision. Assert the replacement count and print it; if it does not match the
number of asset rows on the sheet, stop and look.

**Checks.** `app/products/se.js` line 1367 currently reads:

```js
check("Fixed assets: closing NBV = cost - acc dep c/f (Schedule)", sched.K1 || 0, (sched.E1 || 0) - (sched.J1 || 0));
```

Convert it to:

```js
check(
  "Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals",
  sched.K1 || 0,
  (sched.E1 || 0) - (sched.W1 || 0) - ((sched.J1 || 0) - (sched.X1 || 0)),
);
```

Add the same check to `app/products/ltd.js`, which has no equivalent today. Both product modules
already read `E1`, `J1`, `W1` and `X1` in `additionalReads` (`se.js` line 725, `ltd.js` line
1150), so no read changes are needed.

`fixedAssetSection` in `se.js` (lines 855 to 897) exists to state the true figure the sheet does
not. After the repair its last row, "Schedule column total for net book value carried forward
(K1), which keeps the assets sold on the sheet", is no longer true. Drop that row and rename the
"Net book value at the year end, disposals removed" row to "Net book value at the year end
(Schedule K1)". Update the `K1` indicator text in `se.js` line 960 and `ltd.js` line 1313 from
"assets sold in the year still included" to what it now means.

**Hand-computed anchor.** SE advanced and Ltd full both give `K1 = 30,990` after the repair.
Assert that literal in `app/test/se-precision-code.test.js` and
`app/test/ltd-precision-code.test.js`, alongside `E1 = 65,500`, `W1 = 30,000`, `J1 = 21,838` and
`X1 = 17,328`, so a change in any input shows up as a different failure.

**Breakability.** Corrupt `Schedule!K1` and the new check must fail on its own. Corrupt
`Schedule!W1` and both the new check and "Fixed assets: Schedule disposals = Sales.xlsx fixed
asset sales total" must fail. Corrupt `Schedule!I1` and the depreciation checks must fail while
the new one passes, which proves the closing figure no longer depends on the charge in the way
it used to.

## 3.2 HPfinance `#REF!`

Sheet `HPfinance`, `xl/worksheets/sheet3.xml` in both workbooks. The first agreement row works
and every row after it is broken.

```
SE  I8  <c r="I8"  s="82" t="str"><f>IF(E8&gt;0,(E8+F8+G8)/H8," ")</f><v xml:space="preserve"> </v></c>
SE  I10 <c r="I10" s="82" t="str"><f>IF(H10&gt;0,#REF!/H10," ")</f><v xml:space="preserve"> </v></c>
```

Broken rows, SE: 10, 12, 14 in the new-agreement block and 24, 26, 28 in the existing-agreement
block. Ltd: 10 to 26 even in the new block, 36 to 52 even in the existing block. Row 8 (new) and
rows 22 (SE) / 34 (Ltd) (existing) are the working masters.

**The repair.** One regex over the sheet XML, both files:

```js
xml.replace(
  /IF\(H(\d+)&gt;0,#REF!\/H\1," "\)/g,
  (_m, r) => `IF(E${r}&gt;0,(E${r}+F${r}+G${r})/H${r}," ")`,
);
```

The cached `<v xml:space="preserve"> </v>` stays as it is, which is correct while the row is
blank. Assert the replacement count: 6 for SE, 18 for Ltd. Confirm no `#REF!` remains anywhere
in the sheet afterwards.

`J` and `K` on those rows are already right (`J<r> =IF(H<r>>0,I<r>-K<r>," ")`,
`K<r> =IF(H<r>>0,G<r>/H<r>," ")`) and need no change.

**The fixture.** `E2` is the only cell anything outside the sheet reads. SE: nothing reads it.
Ltd: `TrialBalance!EH28 = [1]HPfinance!$E$2` and `TrialBalance!EH40 = -[1]HPfinance!$E$2`, so
the total appears twice with opposite signs and cancels in `EJ91` by construction. `E2` is
`SUM(E8:E14)` in SE and `SUM(E8:E26)` in Ltd.

Add two agreements to the master data so the second one lands on a repaired row.

- Add an `[[hp_agreements]]` array to `examples/precision-code-ltd/book.toml` with fields
  `date`, `finance_company`, `reference`, `amount_financed`, `admin_charges`, `total_interest`,
  `months`, `supplier`. Two entries: one that lands on row 8 and one that lands on row 10.
- Extend `formatScenarioToml` in `app/lib/scenario-extractor.js` to emit the array, following
  the `fixed_asset_additions` and `vat_straddling_*` blocks at lines 588 to 617.
- Extend `extract-scenarios.js` to carry the array into the `advanced` and `full` subsets.
- Regenerate with `node app/bin/extract-scenarios.js`. Never hand-edit the generated fixture
  TOMLs; the CI sync gate reverts them.
- Extend `cellWrites()` in `app/products/se.js` and `app/products/ltd.js` to write
  `B`, `C`, `D`, `E`, `F`, `G`, `H` and `L` on HPfinance rows 8 and 10.

**The counter-leg.** The interest an agreement charges has to reach the profit and loss finance
line, and the capital repayments have to reach the bank. Give each agreement matching purchase
and bank entries in `lines.jsonl` so `TrialBalance!EJ91` stays 0. Confirm with the trial balance
audit test before adding any HP check.

**Checks.** Add `"Fixedassets.xlsx": { HPfinance: ["E2", "I8","J8","K8", "I10","J10","K10"] }`
to each product's `additionalReads`, then:

```js
check("HP: first agreement monthly payment = the amount financed with charges over its term",
      hp.I8, (agreement1.amount_financed + agreement1.admin_charges + agreement1.total_interest) / agreement1.months);
check("HP: first agreement capital and interest split sums to the monthly payment", hp.J8 + hp.K8, hp.I8);
check("HP: second agreement monthly payment computes", hp.I10, (a2.amount_financed + a2.admin_charges + a2.total_interest) / a2.months);
check("HP: second agreement capital and interest split sums to the monthly payment", hp.J10 + hp.K10, hp.I10);
check("HP: long term creditors = the agreements' amounts financed", hp.E2, a1.amount_financed + a2.amount_financed);
```

The second-agreement checks are the ones the `#REF!` repair makes possible; before it they read
an error. Anchor every expected figure in the fixture's own numbers, as written above, not in
the sheet's other cells.

Add the interest-to-profit-and-loss tie once the counter-legs exist: the year's interest on the
agreements has to appear on the finance line the fixture posts it to. State the expected figure
in the test.

**Breakability.** Corrupt `HPfinance!I10` and only the two second-agreement checks fail.
Corrupt `HPfinance!E2` and only the long-term-creditors check fails. Corrupt `Schedule!K1` and
none of the HP checks move.

## 3.3 Pitfalls specific to this track

- **Shared-formula masters carry relative references.** Editing a `K` master rewrites every
  follower in its `ref` range. That is what you want here; confirm it by reading a follower's
  computed value after recalculation, not by reading the XML.
- **`<v xml:space="preserve"> </v>` matters.** The blank these cells hold is a single space, not
  an empty string. Keep it.
- **`#REF!` sits in the formula text, not in a cached error value.** The cells are `t="str"`
  with a space cached, so there is no `t="e"` to clean up.
- **The Ltd HPfinance total reaches the trial balance twice.** A fixture that adds an agreement
  without its bank and purchase legs will still show `EJ91 = 0` because `EH28` and `EH40`
  cancel. Do not treat a green audit cell as proof the fixture is complete; assert the profit
  and loss finance line as well.
- **Regenerate the fixtures, never edit them.** `app/test/fixtures/se-scenario-advanced.toml`
  and `ltd-scenario-full.toml` are generated.

## 3.4 Blast radius

```
npx vitest run --fileParallelism=false \
  app/test/scenario-extractor.test.js \
  app/test/se-precision-code.test.js \
  app/test/se-reconciliation-checks.test.js \
  app/test/ltd-precision-code.test.js \
  app/test/ltd-reconciliation-checks.test.js \
  app/test/ltd-trial-balance-audit.test.js \
  app/test/bst-fixed-assets-admin-checks.test.js \
  app/test/taxi-fixed-assets-admin-checks.test.js \
  2>&1 | tee target/track3.log | tail -40
```

Then `npm test` and the `generate-se` and `generate-ltd` workflows with skip-commit.

---

# Track 4 — Salesinvoice Product Details G6, and formula-presence coverage

`app/templates/se/Salesinvoice.xlsx` and `app/templates/ltd/Salesinvoice.xlsx`, sheet
`Product Details`, `xl/worksheets/sheet4.xml`. The two files are identical in this sheet.

## 4.1 What is wrong

Column headers: `G1` "Gross Profit Margin", `H1` "Gross Profit Margin %". Rows 2 to 5 are right:

```
<c r="G5" s="63" t="str"><f>IF(F5&gt;0,C5-F5," ")</f><v xml:space="preserve"> </v></c>
<c r="H5" s="64" t="str"><f>IF(F5&gt;0,(C5-F5)*100/C5," ")</f><v xml:space="preserve"> </v></c>
```

Row 6 carries the percentage formula in the margin column, as a shared master reaching to
row 66:

```
<c r="G6" s="63" t="str"><f t="shared" ref="G6:G66" si="0">IF(F6&gt;0,(C6-F6)*100/C6," ")</f><v xml:space="preserve"> </v></c>
<c r="H6" s="64"/>
```

Rows 7 to 66 follow it (`<f t="shared" si="0"/>`) and their `H` cells are all present and empty
(`<c r="H7" s="64"/>`). So sixty-one product rows print a percentage where the money belongs and
nothing where the percentage belongs.

## 4.2 The repair

**Column G.** Change the master's formula text only. Keep the shared attributes exactly as they
are, so every follower from `G7` to `G66` picks up the corrected formula with no follower edit:

```
<c r="G6" s="63" t="str"><f t="shared" ref="G6:G66" si="0">IF(F6&gt;0,C6-F6," ")</f><v xml:space="preserve"> </v></c>
```

**Column H.** Make `H6` a shared master over `H6:H66` and give every follower a body. The sheet
uses `si="0"` and `si="1"` today, so `si="2"` is free:

```
<c r="H6" s="64" t="str"><f t="shared" ref="H6:H66" si="2">IF(F6&gt;0,(C6-F6)*100/C6," ")</f><v xml:space="preserve"> </v></c>
<c r="H7" s="64" t="str"><f t="shared" si="2"/><v xml:space="preserve"> </v></c>
   ... through H66
```

Use the shared group rather than sixty-one plain formulas. The catalogue guard only inspects
cells inside a shared group's bounding box, so the shared group is what brings the `H` column
under coverage. That is the point of the second half of this item.

The sheet's `<dimension ref="A1:H99"/>` already covers column H, and every `<row>` carries
`spans="1:8"`, so nothing structural changes.

## 4.3 Checks

`Salesinvoice.xlsx` is a standalone workbook. No product module reads it and no reconciliation
run recalculates it, so the coverage here is the formula-presence guard rather than a
`checkCompliance` check.

`app/test/formula-presence-guard.test.js` walks `packages/*/*.xlsx`. It will not see the
repaired template until CI regenerates the catalogue, so add a second `describe` block in the
same file that runs `parseCells` and `findFormulaGaps` over the templates directly:

```js
const TEMPLATE_WORKBOOKS = [
  ["se", "Salesinvoice.xlsx"],
  ["ltd", "Salesinvoice.xlsx"],
];
```

Before settling on that list, run the same sweep over every workbook in
`app/templates/*/*.xlsx` once and read what it reports. If it comes back clean, widen the block
to all templates, which is the better guard. If it reports gaps in other workbooks, keep the
block scoped to Salesinvoice and open a NEXT.md item naming exactly what the wider sweep found.
Do not silence a gap to make the sweep green.

**The direct assertion.** The guard proves the `H` column is covered but not that it holds the
right formula. Add a small test that reads the two templates with JSZip and asserts:

- `G6`'s formula text is `IF(F6&gt;0,C6-F6," ")` and it still carries `ref="G6:G66" si="0"`
- `H6`'s formula text is `IF(F6&gt;0,(C6-F6)*100/C6," ")` with `ref="H6:H66"`
- every cell from `H7` to `H66` carries `<f t="shared" si="2"/>`
- no cell in `G6:G66` carries a `*100/` term

**Breakability.** The guard's own breakability proof at the bottom of the file already covers
the mechanism. Add one case for this change: strip `<f>` from `H30`, run `findFormulaGaps`, and
assert it names `H30`. Before the repair that deletion is invisible, because `H30` is not inside
any shared group's box.

## 4.4 Pitfalls specific to this track

- **Shared `si` values are per sheet, not per workbook.** `si="2"` is free on this sheet. Check
  it again in each file rather than assuming.
- **Keep `t="str"` and `<v xml:space="preserve"> </v>` on every cell you write.** Rows 2 to 5
  show the shape.
- **Followers carry no formula text.** `<f t="shared" si="2"/>` is self-closing. Writing the
  formula text into a follower is legal but makes the group pointless and the guard will not
  read it as a member.
- **`G2` to `G5` are plain formulas, not part of si 0.** Leave them alone; they are already
  right, and the guard's calibrated rule treats a cell with its own formula as never a gap.

## 4.5 Blast radius

```
npx vitest run app/test/formula-presence-guard.test.js 2>&1 | tee target/track4.log | tail -40
```

The guard needs no LibreOffice, so this one runs fast and in parallel. Then `npm test`.

## 4.6 Risk

Lowest of the four. One formula text change, sixty-one follower cells, and no downstream reader.
The one thing to watch is that LibreOffice's xls roundtrip may rewrite the shared groups into
plain formulas when the catalogue is regenerated. If it does, the guard's coverage of the `H`
column disappears with them. Check one regenerated package before closing the item.

---

# Verification ladder, every track

Per `CLAUDE.md`:

1. Blast-radius tests for the track, serially, teed to a file under `target/`.
2. The featured scenario reconciles as RECONCILES.
3. Full `npm test` before any push.
4. The four `generate-*` workflows dispatched with skip-commit on the branch, so the
   deterministic gates and the live judge both run.
5. Merge, then let the generate-commit refresh run so the committed reports match.
