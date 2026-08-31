# PLAN: shipped-template surgery

Three repairs still open in the shipped Excel templates, worked out against the template XML so a
coding agent can carry each one out without further discovery. Every cell address, formula and
figure below was read out of the current templates with JSZip or `unzip -p`.

Read `CLAUDE.md`'s "Reconciliation-bug method" before starting any track. It is the standard every
check below has to meet.

## How the work splits

Group the tracks so two agents never open the same xlsx. Tracks 1 and 2 both edit the product
modules, so they run one after the other. Track 3 touches no JavaScript and runs in parallel with
either.

| Track | Workbooks it owns | Shared files it edits | Model |
| --- | --- | --- | --- |
| 1. Ltd fixed asset reconciliation | `app/templates/ltd/Fixedassets.xlsx` | `app/products/ltd.js`, `app/products/se.js`, `app/templates/ltd/meta.toml` | Opus |
| 2. Payslips July and August | `app/templates/se/Payslips.xlsx`, `app/templates/ltd/Payslips.xlsx` | `app/products/se.js`, `app/products/ltd.js` | Sonnet |
| 3. Divider-row leftovers | `app/templates/se/Vat.xlsx`, `app/templates/ltd/Vatreturns.xlsx`, `app/templates/ltd/Purchases.xlsx` | none | Haiku |

Track 1 is priced at Opus because it adds two external links to a workbook that has one, and the
link caches are the part of this pipeline that fails silently.

---

# Track 1 — the Ltd fixed asset reconciliation reads `#REF!`

## 1.1 What the sheets do now

`FAreconciliation` is `xl/worksheets/sheet2.xml` in both `Fixedassets.xlsx` workbooks. It is the
workbook's own tie-out: rows 11 re-sum the Schedule's additions and disposals, rows 13 read the
same totals out of the ledgers, and row 15 subtracts one from the other and prints a verdict.

SE works:

```
E11 =SUM(E6:E10)          K11 =SUM(K6:K10)
E13 =[2]Mar!$AB$2         K13 =[3]Mar!$V$2
E15 =E13-E11              K15 =K13-K11
B15 =IF(E15>0,"Purchases exceed Assets listed on Schedule",IF(E15<0,…,"Purchases reconcile with Fixed asset Schedule"))
G15  the same sentence for sales
```

External link 2 targets `Purchases.xlsx` and link 3 targets `Sales.xlsx`.

Ltd is broken. `E13` and `K13` are `<c … t="e"><f>#REF!</f><v>#REF!</v></c>`, so `E15`, `K15`,
`B15` and `G15` all carry `#REF!` behind them. Six cells:
`E13, K13, B15, E15, G15, K15`. Ltd's `Fixedassets.xlsx` has one external link and it points at
`Financialaccounts.xlsx`, so there is nothing for row 13 to read.

Confirmed in a shipped package, not only the template:
`packages/GB Accounts Company 2026-03-31 (Mar26) Excel 2007/Fixedassets.xlsx` carries the same six
cells. Every Ltd customer opens a reconciliation block that says `#REF!` where it should say
"Purchases reconcile with Fixed asset Schedule".

`app/products/ltd.js` already works around it. Its `additionalReads` asks for `E11` and `K11` only,
and the comment above the check says so outright: "the same comparison FAreconciliation is built to
make, made here because the sheet's own cross-file cells (E13/K13) are `#REF!` in the template."
Fix the sheet and that workaround becomes the sheet's own check, as it is on SE.

## 1.2 The source cells, discovered

Both Ltd ledgers carry a whole-year total for the code the Schedule needs. The layout differs from
SE's. SE runs a cumulative total down the months; Ltd sums the twelve `Mar` row-1 totals. The
figure means the same thing.

| Ltd cell | Reads | Source workbook, sheet, cell | What it totals |
| --- | --- | --- | --- |
| `E13` | fixed asset purchases | `Purchases.xlsx`, `Mar`, `$AI$2` | column AI, code `FA`, `=Apr!AI1+May!AI1+…+Mar!AI1` |
| `K13` | fixed asset sales | `Sales.xlsx`, `Mar`, `$U$2` | column U, code `FS`, "Sale of Fixed Assets" |

Verified by reading row 4 (the code letters) and row 2 (the totals) of each `Mar` sheet.

## 1.3 The repair

Add external links 2 and 3 to `app/templates/ltd/Fixedassets.xlsx`, following SE's exactly:

- `xl/externalLinks/externalLink2.xml` and `externalLink3.xml`, each with the sheet names and the
  cached cell the formula reads.
- `xl/externalLinks/_rels/externalLink{2,3}.xml.rels` targeting `Purchases.xlsx` and `Sales.xlsx`.
- The two new `externalLink` overrides in `[Content_Types].xml` and the two relationships in
  `xl/_rels/workbook.xml.rels`, then the `externalReferences` entries in `xl/workbook.xml`.

Then write the four formulas:

```
E13 =[2]Mar!$AI$2
K13 =[3]Mar!$U$2
```

`E15`, `K15`, `B15` and `G15` already hold the right expressions and need no formula change, but
their `t="e"` and cached `#REF!` values have to go. `E15`/`K15` become plain numeric cells and
`B15`/`G15` become `t="str"` with the reconcile sentence cached, matching SE.

**Do not renumber link 1.** `app/templates/ltd/meta.toml` names
`adminExternalLink = "xl/externalLinks/externalLink1.xml"` and `rollLtdAdminCachedDates` in
`app/lib/generator.js` reads `externalLink1.xml.rels` and throws if it does not target
`Financialaccounts.xlsx`. Adding links 2 and 3 leaves that alone. Confirm it still throws on a
deliberate mis-target before trusting the guard.

## 1.4 The SE label that no longer matches its formula

`app/products/se.js`, in `FIXED_ASSET_CELL_LABELS`:

```js
K1: "Total net book value carried forward (E1 less J1), assets sold in the year still included",
```

The Schedule's `K` column now reads `IF(E<r>>0,IF(V<r>>0,0,E<r>-J<r>)," ")` in both products, so a
sold asset contributes nothing. The label describes a formula that is gone, and it prints in every
SE reconciliation report. Ltd's equivalent was already corrected to "Total net book value carried
forward, disposals removed". Bring SE to the same wording.

## 1.5 Checks

Give Ltd the two checks SE already has, once `E13`/`K13` resolve. In `additionalReads`, widen
`FAreconciliation` from `["E11", "K11"]` to `["E11", "E13", "E15", "K11", "K13", "K15"]`, then:

```js
check("Fixed assets: Schedule additions = Purchases.xlsx fixed asset total", num(fr.E11), num(fr.E13));
check("Fixed assets: Schedule disposals = Sales.xlsx fixed asset sales total", num(fr.K11), num(fr.K13));
```

Keep the existing scenario-anchored checks. They are what stops a schedule and a ledger agreeing on
the wrong figure, and the plan's own rule is that a check comparing the sheet to itself can never
fail. Drop the "made here because the sheet's own cross-file cells are `#REF!`" sentence from the
comment above them, because it stops being true.

Add `check("Fixed assets: the reconciliation block reconciles", num(fr.E15), 0)` and the same for
`K15` only after the two sides are anchored, so a zero difference is evidence and not a tautology.

## 1.6 Breakability

Build on `app/test/ltd-reconciliation-checks.test.js`'s corrupt-and-recheck helper.

| Corrupt | Checks that must flip, and only these |
| --- | --- |
| `FAreconciliation!E13` | "Fixed assets: Schedule additions = Purchases.xlsx fixed asset total", "the reconciliation block reconciles" |
| `FAreconciliation!K13` | "Fixed assets: Schedule disposals = Sales.xlsx fixed asset sales total", the `K15` reconcile check |
| `FAreconciliation!E11` | the additions check and the scenario-anchored additions check |

Add a plain assertion that no cell in either `Fixedassets.xlsx` carries `#REF!` after generation,
read straight out of the generated zip rather than out of a recalculated copy.

## 1.7 Pitfalls

- **The link cache is the trap.** A spreadsheet app opening `Fixedassets.xlsx` against closed
  ledgers reads the stored cache and never recalculates. `refreshExternalLinkCaches` in
  `app/lib/spreadsheet-runner.js` handles the test path, so a green suite proves nothing about the
  shipped file. Generate one package and read the cached `<v>` of `E13` out of the zip.
- **`externalLinkSignature` in the runner keys off the set of link files.** Adding two changes that
  signature; check the runner still refreshes rather than reusing a cached recalculation.
- **Ltd's ledgers are twelve-month sums, SE's are running totals.** Do not copy SE's cell
  references. `Mar!$AB$2` and `Mar!$V$2` mean nothing on the Ltd sheets.
- **`t="e"` has to be removed, not just overwritten.** A cell left as `t="e"` with a numeric `<v>`
  is a repair prompt when Excel opens the file.

## 1.8 Blast radius

```
npx vitest run --fileParallelism=false \
  app/test/generate.test.js \
  app/test/ltd-precision-code.test.js \
  app/test/ltd-reconciliation-checks.test.js \
  app/test/ltd-trial-balance-audit.test.js \
  app/test/se-precision-code.test.js \
  app/test/se-reconciliation-checks.test.js \
  2>&1 | tee target/track1.log | tail -40
```

Then `npm test`, then `generate-ltd` and `generate-se` with skip-commit on the branch.

---

# Track 2 — the July and August payslips carry `#REF!`

## 2.1 What the sheets do now

`Payslips.xlsx`, identical in both products. Sheets `Apr` to `Mar` are `sheet2.xml` to `sheet13.xml`,
so `Jul` is `sheet5.xml` and `Aug` is `sheet6.xml`. Every other month is intact; these two are not.

**`Jul`, 6 cells: `F11`, `F12`, `F13`, `F14`, `F15`, `T41`.** The `F` column reads the employee's
start and leave dates against the month's pay date. `Jun` holds the working formula and `Jul` lost
the date reference:

```
Jun F11 =IF(E11=" "," ",IF(Employee!F$24>E$9," ",IF(Employee!F$26<E$9," ",Employee!D$15)))
Jul F11 =IF(E11=" "," ",IF(Employee!F$24>#REF!," ",IF(Employee!F$26<#REF!," ",Employee!D$15)))
```

`E$9` is the same on every month sheet, so the repair is `#REF!` → `E$9` on all five rows.

`Jul!T41` is `=IF(M41=" "," ",IF(M41=0," ",#REF!))`. Every other month carries a literal `<v>0</v>`
in `T41` with no formula at all. Match the neighbours rather than inventing a formula.

**`Aug`, 29 cells.** Rows 11 to 15, columns `H`, `I`, `J`, `L`, `M`, plus `K` on rows 12 to 15 (row
11 has no `K` cell). Each carries a brought-forward read from the previous month that lost its row:

```
Jul H11 =IF(T$9="Y",Jun!H41,0)
Aug H11 =IF(T$9="Y",Jul!#REF!,0)
Sep H11 =IF(T$9="Y",Aug!H41,0)
```

The pattern is unambiguous in both directions: the reference is the same column at row 41 of the
previous month. `M` carries it inside a longer expression:

```
Sep M11 =IF(E11=" "," ",IF(T$9="Y",Aug!M41,IF((H11+K11+L11)>0,H11+K11+L11," ")))
Aug M11 =IF(E11=" "," ",IF(T$9="Y",Jul!#REF!,IF((H11+K11+L11)>0,H11+K11+L11," ")))
```

## 2.2 The repair

Two regexes per workbook, one per sheet, with asserted replacement counts.

```js
// Jul, sheet5.xml — 5 replacements
xml.replace(/#REF!/g, "E$9")   // scoped to the F11:F15 cells only
// Aug, sheet6.xml — 29 replacements
xml.replace(/Jul!#REF!/g, (…) => `Jul!${column}41`)
```

The `Aug` substitution needs the containing cell's column, so walk the cells rather than replacing
blind. Assert 5 and 29, and assert `Jul!T41` ends as `<c r="T41" s="99"><v>0</v></c>` with the style
its neighbours use. Confirm no `#REF!` remains in either workbook afterwards.

## 2.3 Checks

Nothing reads these sheets today. `additionalReads` in both product modules asks `Payslips.xlsx` for
`Payment` and `Admin` only, which is why 70 broken cells have shipped unnoticed. Coverage is the
point of this track, not a side effect.

Add the two month sheets to `additionalReads` for the rows the fixture populates, then check the
July and August payslips against the same expectations the other months already meet. The right
anchor is the scenario's payroll data, not a neighbouring month. A check that compares August to
July passes on two identically wrong months.

Extend `app/test/payslips-calendar-year-end.test.js` with a case that generates a package and reads
`Jul` and `Aug` back, so a regression shows up as a value and not as a blank.

## 2.4 Breakability

Corrupt `Jul!F12` and only the July employee-line check flips. Corrupt `Aug!H13` and only the August
brought-forward check flips. Neither may move any Payment or Admin check.

## 2.5 Blast radius

```
npx vitest run --fileParallelism=false \
  app/test/payslips-calendar-year-end.test.js \
  app/test/se-precision-code.test.js \
  app/test/ltd-precision-code.test.js \
  2>&1 | tee target/track2.log | tail -40
```

Then `npm test`, then `generate-se` and `generate-ltd` with skip-commit.

---

# Track 3 — the divider-row leftovers

Twelve cells, one shape, no downstream reader.

| Workbook | Sheets | Cell |
| --- | --- | --- |
| `app/templates/se/Vat.xlsx` | `P02Y1`, `P03Y1`, `P04Y2`, `P05Y2`, `P06Y2` | `H201` |
| `app/templates/ltd/Vatreturns.xlsx` | `P02Y1`, `P03Y1`, `P04Y2`, `P05Y2`, `P06Y2` | `G201` |
| `app/templates/ltd/Purchases.xlsx` | `OpeningCreditors`, `ClosingCreditors` | `G201` |

Each holds the VAT-extraction formula with its rate reference lost. SE reads column `G`, Ltd reads
column `F`:

```
se/Vat        H201 =IF(G201<>0,G201*#REF!/(100+#REF!)," ")
ltd/Vatreturns G201 =IF(F201<>0,F201*#REF!/(100+#REF!)," ")
ltd/Purchases  G201 =IF(F201<>0,F201*#REF!/(100+#REF!)," ")
```

On the ten VAT sheets, `A201` prints "Entries below this row are not included in Row 1 Totals", and
the intact shared master that governs rows 143 to 200 above it reads:

```
<f t="shared" ref="H143:H200" si="6">IF(H$4="X"," ",IF(G143&lt;&gt;0,G143*H$2/(100+H$2)," "))</f>
```

So the broken cell is a stray copy of that formula sitting one row below the group, on a divider row
that every total deliberately excludes.

The two `Purchases.xlsx` sheets differ and need checking on their own terms. They carry no `A201`
marker and no `X` guard; the shared groups end at `G197` and rows 198 to 200 hold plain formulas
(`IF(F199<>0,F199*G$2/(100+G$2)," ")`). `G201` there is a stray one row past the last data row.

**The repair.** Take the cell out. Leave `<c r="H201" s="90"/>` with its style and no formula, and
the same in each of the other eleven. On the VAT sheets the divider row is not a data row; on the
two creditors sheets row 201 is outside the block the sheet sums. In neither case does restoring a
formula there make the cell mean anything. Assert 12 removals and no remaining `#REF!` in the three
workbooks.

**Checks.** None to add. The evidence is the formula-presence guard's own template sweep in
`app/test/formula-presence-guard.test.js`, which already runs over every workbook under
`app/templates/*/*.xlsx`. Confirm it stays green, and confirm the removal did not make row 201 read
as a gap in a shared group.

**Blast radius.** `npx vitest run app/test/formula-presence-guard.test.js`, then `npm test`.

---

# Verification ladder, every track

Per `CLAUDE.md`:

1. Blast-radius tests for the track, serially, teed to a file under `target/`.
2. The featured scenario reconciles as RECONCILES.
3. Full `npm test` before any push.
4. The four `generate-*` workflows dispatched with skip-commit on the branch, so the deterministic
   gates and the live judge both run.
5. Merge, then let the generate-commit refresh run so the committed reports match.
