# PLAN: Fewer Files -- Merge Workbooks to Eliminate External Links

## Goal

Reduce the number of xlsx files in both the Ltd and SE packages by merging formula-driven/read-only workbooks into the Financialaccounts hub. This eliminates external links, simplifies cross-file recalculation, and gives users fewer files to manage.

- **Ltd**: 15 xlsx + 1 docx --> 11 xlsx + 1 docx (merge 4 workbooks)
- **SE**: 9 xlsx --> 7 xlsx (merge 2 workbooks)

## Current State

### Ltd (15 xlsx + 1 docx)

Financialaccounts.xlsx (216 KB, 12 visible sheets) is the hub with 9 outbound external links `[1]`-`[9]` to leaf workbooks. CT600OnlineLookALike.xlsx has 3 links back to FA/CompSec/Fixedassets. Vatreturns.xlsx has 3 links to FA/Sales/Purchases. The reconciliation pipeline must recalculate leaf files via xls roundtrip, extract values, inject them into the hub's external link caches (`xl/externalLinks/externalLinkN.xml`), then recalculate the hub -- a fragile multi-step process.

**External link map (from template zip inspection):**

```
Financialaccounts.xlsx (hub):
  [1] -> Fixedassets.xlsx
  [2] -> Purchases.xlsx
  [3] -> Sales.xlsx
  [4] -> Currentaccount.xlsx
  [5] -> Savingaccount.xlsx
  [6] -> Creditcardaccount.xlsx
  [7] -> Cashaccount.xlsx
  [8] -> Companysecretary.xlsx
  [9] -> Payslips.xlsx

CT600OnlineLookALike.xlsx:
  [1] -> Financialaccounts.xlsx
  [2] -> Companysecretary.xlsx
  [3] -> Fixedassets.xlsx

Vatreturns.xlsx:
  [1] -> Financialaccounts.xlsx  (Admin dates for Vatinterface B-column)
  [2] -> Sales.xlsx              (monthly VAT/net totals)
  [3] -> Purchases.xlsx          (monthly VAT/net totals)
```

### SE (9 xlsx)

Financialaccounts.xlsx (121 KB, 10 core + ~170 HMRC/quarterly report sheets = 181 total) is the hub with 6 outbound external links `[1]`-`[6]`. Vat.xlsx is standalone (not linked FROM Financialaccounts) with 3 outbound links. Fixedassets.xlsx has 3 outbound links back to FA/Purchases/Sales. Several leaf files (Purchases, Bank, Cash) also link back to Financialaccounts for Admin tax rates.

**External link map (from template zip inspection):**

```
Financialaccounts.xlsx (hub):
  [1] -> Fixedassets.xlsx     (capital allowances from Schedule sheet)
  [2] -> Sales.xlsx           (monthly sales row 1 totals, Apr..Mar)
  [3] -> Purchases.xlsx       (monthly purchase row 1 totals, Apr..Mar)
  [4] -> Bank.xlsx            (monthly bank row 1 totals, Apr..Mar)
  [5] -> Cash.xlsx            (monthly cash row 1 totals, Apr..Mar)
  [6] -> Payslips.xlsx        (payroll summary)

Fixedassets.xlsx:
  [1] -> Financialaccounts.xlsx  (Admin rates: G4/G5 AIA/WDA, etc.)
  [2] -> Purchases.xlsx          (fixed asset purchases)
  [3] -> Sales.xlsx              (fixed asset sales)

Vat.xlsx (standalone -- NOT linked FROM Financialaccounts):
  [1] -> Financialaccounts.xlsx  (Admin dates for Vatinterface B-column)
  [2] -> Sales.xlsx              (monthly VAT/net totals)
  [3] -> Purchases.xlsx          (monthly VAT/net totals)

Purchases.xlsx:
  [1] -> Sales.xlsx              (mileage transfer)
  [2] -> Financialaccounts.xlsx  (Admin tax rates)

Bank.xlsx:
  [1] -> Financialaccounts.xlsx  (Admin tax rates)

Cash.xlsx:
  [1] -> Financialaccounts.xlsx  (Admin tax rates)
```

---

## Ltd Candidate Merges (4 workbooks into Financialaccounts)

### 1. Merge Fixedassets.xlsx into Financialaccounts

- **Source sheets**: Schedule, FAreconciliation, HPfinance (3 visible sheets)
- **Source file size**: 48 KB
- **Current link in hub**: `[1]Fixedassets.xlsx` -- TrialBalance and CorporationTax read capital allowances from `[1]Schedule!`
- **Links FROM Fixedassets**: none (Ltd Fixedassets has no outbound external links in the template)
- **Benefit**: Capital allowances flow directly into CorporationTax sheet without external link cache. Removes `xl/externalLinks/externalLink1.xml` and its `.rels` from hub.
- **Formula rewrites in hub**:
  - `[1]Schedule!$cellRef` --> `Schedule!$cellRef` (in TrialBalance, CorporationTax sheets)
  - `[1]FAreconciliation!$cellRef` --> `FAreconciliation!$cellRef` (if referenced)
- **Complexity**: Low -- no month-specific content, no tab renaming needed
- **Shared strings merge**: Fixedassets has its own `xl/sharedStrings.xml`; indices in the 3 copied sheet XMLs must be offset by the FA shared strings table size (see Techniques section below)

### 2. Merge Companysecretary.xlsx into Financialaccounts

- **Source sheets**: Boardmeeting, Directors&Secretary, RegisterofMembers, DirectorsInterests, Charges&Debentures (5 visible sheets)
- **Source file size**: 20 KB
- **Current link in hub**: `[8]Companysecretary.xlsx`
- **Benefit**: Removes one external link from hub; also simplifies CT600OnlineLookALike merge (which links to CompSec)
- **Formula rewrites in hub**:
  - `[8]Boardmeeting!$cellRef` --> `Boardmeeting!$cellRef`
  - `[8]Directors&amp;Secretary!$cellRef` --> `Directors&amp;Secretary!$cellRef` (note XML-encoded ampersand)
  - Similarly for other CompSec sheets
- **Complexity**: Low -- user-filled statutory records, no formulas, no month-specific content

### 3. Merge CT600OnlineLookALike.xlsx into Financialaccounts

- **Source sheets**: Sheet1 (1 visible sheet, renamed to e.g. "CT600Online" in merged workbook)
- **Source file size**: 208 KB
- **Current outbound links from CT600OnlineLookALike**:
  - `[1]` -> Financialaccounts.xlsx (CorporationTax, CT600, PubP&L, etc.)
  - `[2]` -> Companysecretary.xlsx (Directors&Secretary, RegisterofMembers)
  - `[3]` -> Fixedassets.xlsx (Schedule)
- **Benefit**: All 3 external links become intra-workbook references (since CompSec and Fixedassets are already merged). Removes a file from the package.
- **Formula rewrites in merged sheet**:
  - `[1]CorporationTax!$cellRef` --> `CorporationTax!$cellRef`
  - `[1]CT600!$cellRef` --> `CT600!$cellRef`
  - `[1]PubP&amp;L!$cellRef` --> `PubP&amp;L!$cellRef`
  - `[2]Directors&amp;Secretary!$cellRef` --> `Directors&amp;Secretary!$cellRef`
  - `[2]RegisterofMembers!$cellRef` --> `RegisterofMembers!$cellRef`
  - `[3]Schedule!$cellRef` --> `Schedule!$cellRef`
- **Complexity**: Low -- 134 layout numbers + 36 formulas in Sheet1
- **Dependency**: Must merge after Fixedassets and Companysecretary so all 3 targets are internal

### 4. Merge Vatreturns.xlsx into Financialaccounts

- **Source sheets**: VATQtr1, VATQtr2, VATQtr3, VATQtr4, VATQtr5, Vatinterface, S02Y1, S03Y1, S04Y2, S05Y2, P02Y1, P03Y1, P04Y2, P05Y2 (14 visible sheets)
- **Source file size**: 88 KB
- **Current outbound links from Vatreturns**:
  - `[1]` -> Financialaccounts.xlsx (Admin dates for Vatinterface B-column: `[1]Admin!$B$N`)
  - `[2]` -> Sales.xlsx (monthly VAT/net totals: `[2]Apr!$G$1` etc.)
  - `[3]` -> Purchases.xlsx (monthly VAT/net totals: `[3]Apr!$H$1` etc.)
- **Benefit**: Admin link `[1]` becomes intra-workbook. Sales/Purchases links `[2]`/`[3]` remain external but are renumbered to use the hub's existing link indices for Sales and Purchases.
- **Formula rewrites**:
  - Vatinterface B-column: `[1]Admin!$B$N` --> `Admin!$B$N` (now internal)
  - Vatinterface D/M-column + VATQtr sheets: `[2]MonthName!` and `[3]MonthName!` must be renumbered to the hub's link indices for Sales/Purchases (which are `[3]` and `[2]` respectively in the hub after renumbering)
  - `rewriteVatinterfaceFormulas()` in `generator.js` must be updated to target the merged sheet location
- **Complexity**: Medium -- Vatinterface has month-dependent formula rewriting (`adminStartRow` calculation), and non-March year-end transforms affect the Sales/Purchases tab name references
- **Generator changes**: VATQtr1-5 G5 date writes currently target `sheets.vat.vatQtr1..5` in `meta.toml`; after merge these become sheets within Financialaccounts, requiring `meta.toml` updates

---

## SE Candidate Merges (2 workbooks into Financialaccounts)

### 1. Merge Fixedassets.xlsx into Financialaccounts

- **Source sheets**: Schedule, FAreconciliation, HPfinance (3 visible sheets)
- **Source file size**: 50 KB
- **Current link in hub**: `[1]Fixedassets.xlsx` -- Profit & Loss Account reads capital allowances from `[1]Schedule!`
- **Links FROM Fixedassets (SE)**:
  - `[1]` -> Financialaccounts.xlsx (Admin rates: G4/G5 AIA/WDA, G13-G17 depreciation, E8/G8 motor vehicle)
  - `[2]` -> Purchases.xlsx (fixed asset purchases -- code "fa")
  - `[3]` -> Sales.xlsx (fixed asset sales -- code "fs")
- **Benefit**: Eliminates the `[1]` link from the hub to Fixedassets AND eliminates the `[1]` link from Fixedassets back to FA (Admin rates become intra-workbook). The `[2]`/`[3]` links to Purchases/Sales remain external but are renumbered to use the hub's existing link indices for those files.
- **Formula rewrites in hub**:
  - `[1]Schedule!$cellRef` --> `Schedule!$cellRef` (in Profit & Loss Account)
- **Formula rewrites in merged Fixedassets sheets**:
  - `[1]Admin!$cellRef` --> `Admin!$cellRef` (now internal -- rates are in the same workbook)
  - `[2]Purchases!MonthName!$cellRef` --> renumbered to hub's Purchases link index `[3]`
  - `[3]Sales!MonthName!$cellRef` --> renumbered to hub's Sales link index `[2]`
- **Complexity**: Medium -- Fixedassets has 3 outbound links (unlike Ltd where it has none), so its formulas need both link removal (for Admin) and renumbering (for Sales/Purchases)
- **Shared strings merge**: Same as Ltd -- offset Fixedassets indices by FA table size

### 2. Merge Vat.xlsx into Financialaccounts

- **Source sheets**: VATQtr1, VATQtr2, VATQtr3, VATQtr4, VATQtr5, Vatinterface, S02Y1, S03Y1, S04Y2, S05Y2, P02Y1, P03Y1, P04Y2, P05Y2 (14 visible sheets)
- **Source file size**: 89 KB
- **Current outbound links from Vat.xlsx (SE)**:
  - `[1]` -> Financialaccounts.xlsx (Admin dates for Vatinterface B-column: `[1]Admin!$B$N`)
  - `[2]` -> Sales.xlsx (monthly VAT/net totals)
  - `[3]` -> Purchases.xlsx (monthly VAT/net totals)
- **Note**: Vat.xlsx is NOT linked FROM Financialaccounts in SE (unlike Ltd where Vatreturns is also not linked from FA). It is a standalone consumer of data from FA, Sales, and Purchases.
- **Benefit**: Admin link `[1]` becomes intra-workbook. Sales/Purchases links `[2]`/`[3]` remain external but are renumbered to use the hub's existing link indices (`[2]` for Sales, `[3]` for Purchases in the hub).
- **Formula rewrites**: Identical pattern to Ltd Vatreturns merge (see above)
- **Generator changes**: SE `meta.toml` currently has `[sheets.vat]` section with `vatQtr1..5` paths pointing to Vat.xlsx sheet XMLs. After merge, these become sheets within Financialaccounts and `meta.toml` must be updated.
- **Complexity**: Medium -- same Vatinterface B-column rewriting as Ltd, though SE has no non-March year-end transforms (SE always uses 6 April year-end)

### Why NOT merge other SE files

The remaining SE files are data-entry workbooks that users actively type into:
- **Sales.xlsx** (14 sheets) -- monthly invoice entry
- **Purchases.xlsx** (14 sheets) -- monthly expense entry
- **Bank.xlsx** (12 sheets) -- bank transaction entry
- **Cash.xlsx** (12 sheets) -- petty cash entry
- **Payslips.xlsx** (16 sheets) -- payroll entry
- **Salesinvoice.xlsx** (5 sheets) -- standalone invoice generation, no external links

Merging data-entry files into the hub would create a single enormous file (~2.4 MB) with ~230+ sheets, making it unwieldy. These files are correctly separate.

---

## Architecture After Merge

### Ltd: Financialaccounts.xlsx (12 -> ~34 visible sheets)

```
Financialaccounts.xlsx:
  Existing (12 sheets):
    OpenAccounts, TrialBalance, MnthP&L, PubP&L, PubBalSht,
    PubNotes, Report, CorporationTax, CT600, WagesInterface, Stock, Admin

  From Fixedassets (3 sheets):
    Schedule, FAreconciliation, HPfinance

  From Companysecretary (5 sheets):
    Boardmeeting, Directors&Secretary, RegisterofMembers,
    DirectorsInterests, Charges&Debentures

  From CT600OnlineLookALike (1 sheet):
    Sheet1 (CT600 online preview)

  From Vatreturns (14 sheets):
    VATQtr1-5, Vatinterface, S02Y1, S03Y1, S04Y2, S05Y2,
    P02Y1, P03Y1, P04Y2, P05Y2

  Remaining external links (5, renumbered):
    [1] Purchases.xlsx
    [2] Sales.xlsx
    [3] Currentaccount.xlsx
    [4] Savingaccount.xlsx
    [5] Creditcardaccount.xlsx
    [6] Cashaccount.xlsx
    [7] Payslips.xlsx

Remaining separate files (7 data-entry + 3 standalone):
  Sales.xlsx, Purchases.xlsx, Currentaccount.xlsx, Savingaccount.xlsx,
  Cashaccount.xlsx, Creditcardaccount.xlsx, Payslips.xlsx
  Salesinvoice.xlsx, expensesform.xlsx, Dividend Voucher.docx
```

### SE: Financialaccounts.xlsx (181 -> ~198 visible sheets)

```
Financialaccounts.xlsx:
  Existing (10 core + ~170 HMRC/quarterly report sheets):
    Business Details, SE Short, SE Full, Profit & Loss Account,
    VitalTax, Income Tax, Wagesinterface, StockControl, Profit Forecast, Admin
    Annual_* (33 sheets), Q1_* through Q4_* (132 sheets)

  From Fixedassets (3 sheets):
    Schedule, FAreconciliation, HPfinance

  From Vat (14 sheets):
    VATQtr1-5, Vatinterface, S02Y1, S03Y1, S04Y2, S05Y2,
    P02Y1, P03Y1, P04Y2, P05Y2

  Remaining external links (4, renumbered):
    [1] Sales.xlsx
    [2] Purchases.xlsx
    [3] Bank.xlsx
    [4] Cash.xlsx
    [5] Payslips.xlsx

Remaining separate files (5 data-entry + 1 standalone):
  Sales.xlsx, Purchases.xlsx, Bank.xlsx, Cash.xlsx, Payslips.xlsx
  Salesinvoice.xlsx
```

---

## Implementation Techniques (from SKILL_EXCEL.md)

Each merge step requires several XLSX ZIP manipulation techniques. All are implemented using JSZip for ZIP I/O and regex-based XML surgery (no DOM parser).

### Step 1: Copy sheet XML files

Copy `xl/worksheets/sheetN.xml` files from source workbook ZIP into the Financialaccounts ZIP. Use `JSZip.loadAsync()` on both files, then `zip.file(path, content, { date: originalDate })` to insert.

### Step 2: Add sheet entries to workbook.xml

Add `<sheet name="SheetName" sheetId="N" r:id="rIdN"/>` entries to `xl/workbook.xml` in the hub. The `sheetId` must be unique within the workbook (use max existing + 1). The `r:id` must match a new relationship entry.

### Step 3: Add relationship entries to workbook.xml.rels

Add `<Relationship Id="rIdN" Type="...worksheet" Target="worksheets/sheetN.xml"/>` entries to `xl/_rels/workbook.xml.rels`.

### Step 4: Shared strings table merge

This is the most complex part. Each xlsx has its own `xl/sharedStrings.xml` with zero-based string indices. Cells with `t="s"` reference these indices.

**Algorithm:**
1. Parse the hub's `sharedStrings.xml` to get existing string count (= offset)
2. Parse the source's `sharedStrings.xml` to get all `<si>` entries
3. Append source entries to the hub's shared strings table
4. In every copied sheet XML, find all `<c ... t="s"><v>N</v></c>` cells and replace `N` with `N + offset`
5. Update the `count` and `uniqueCount` attributes on the hub's `<sst>` element

**Regex pattern for shared string cells:**
```js
// Match cells with t="s" and extract their <v> value
/<c\s+r="[A-Z]+\d+"\s[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/g
```

### Step 5: Style definitions merge

If merged sheets reference style indices (`s="N"` on `<c>` or `<row>` elements) that do not exist in the hub's `xl/styles.xml`, those styles must be copied and indices remapped. In practice, most accounting workbooks share a common style set, so this may require no action -- but must be verified per merge.

### Step 6: Formula rewriting -- external link removal

Use regex to replace external link prefixes with empty string:

```js
// Remove [N] prefix from formulas (link N is now internal)
xml = xml.replace(/\[1\]Schedule!/g, "Schedule!");
xml = xml.replace(/\[8\]Boardmeeting!/g, "Boardmeeting!");
// etc.
```

Formula references appear in `<f>` elements within sheet XML:
```xml
<c r="K12"><f>[1]Schedule!$G$15</f><v>0</v></c>
```
After rewrite:
```xml
<c r="K12"><f>Schedule!$G$15</f><v>0</v></c>
```

### Step 7: External link XML removal

Delete the now-unused `xl/externalLinks/externalLinkN.xml` and `xl/externalLinks/_rels/externalLinkN.xml.rels` files from the ZIP. Also remove the corresponding `<Relationship>` entry from `xl/_rels/workbook.xml.rels`.

### Step 8: External link renumbering

After removing some external links, the remaining ones must be renumbered sequentially. All formula references `[N]` in all sheet XMLs must be updated to the new indices.

**Example for Ltd after all merges:**
- Old `[1]` (Fixedassets) -- removed (merged)
- Old `[2]` (Purchases) -- becomes new `[1]`
- Old `[3]` (Sales) -- becomes new `[2]`
- Old `[4]` (Currentaccount) -- becomes new `[3]`
- Old `[5]` (Savingaccount) -- becomes new `[4]`
- Old `[6]` (Creditcardaccount) -- becomes new `[5]`
- Old `[7]` (Cashaccount) -- becomes new `[6]`
- Old `[8]` (Companysecretary) -- removed (merged)
- Old `[9]` (Payslips) -- becomes new `[7]`

Plus Vatreturns' Sales/Purchases links (was `[2]`/`[3]` in Vatreturns) must be mapped to the hub's new indices for Sales/Purchases.

### Step 9: Vatinterface formula adjustment

After merging Vatreturns/Vat into Financialaccounts, `rewriteVatinterfaceFormulas()` in `generator.js` must target the merged Vatinterface sheet within the hub instead of a separate file. The `adminStartRow` calculation and tab name remapping logic stays the same, but `[1]Admin!` references become just `Admin!`.

For Ltd non-March year-ends, the D/M-column formulas referencing `[2]Apr!`/`[3]Apr!` (Sales/Purchases tabs) must use the hub's renumbered external link indices instead of Vatreturns' old indices.

### Step 10: Defined names re-scoping

`<definedName>` elements in `xl/workbook.xml` with `localSheetId` attributes scoped to the source workbook must be re-scoped to the merged workbook. The `localSheetId` is a zero-based sheet index that changes when sheets are added. Print area and print title definitions (`_xlnm.Print_Area`, `_xlnm.Print_Titles`) are the main ones to handle.

### Step 11: meta.toml updates

After merging, sheet XML paths change:
- SE `[sheets.vat]` entries (vatQtr1..5) move from Vat.xlsx to Financialaccounts.xlsx
- SE `[sheets.financialaccounts]` gets new sheet path entries for the merged sheets
- Ltd equivalent changes for Vatreturns sheets

### Step 12: Generator code updates

- `generator.js`: VATQtr date writes and Vatinterface rewriting must target the hub file
- `se.js` / `ltd.js`: File list in `cellWrites()` and `standardReads()` must exclude removed files
- `spreadsheet-runner.js`: `updateExternalLinkCaches()` sees fewer external links; the hub file is larger but the pipeline logic is unchanged
- `meta.toml`: Sheet path mappings updated for new sheet locations

---

## Risks

- **Shared strings table merge** is the most complex part -- every cell with `t="s"` references a zero-based index into the table; copied sheets' indices must be offset by the hub's existing table size. An off-by-one error corrupts all string displays in merged sheets.
- **Defined names** scoped to the source workbook need re-scoping with updated `localSheetId` values. Print areas (`_xlnm.Print_Area`) and print titles (`_xlnm.Print_Titles`) are particularly affected since both SE and Ltd workbooks use them extensively.
- **SE Fixedassets has outbound links** -- unlike Ltd where Fixedassets has no external links, SE Fixedassets links to FA (Admin rates), Purchases, and Sales. The merge must handle both internalising the Admin link AND renumbering the Purchases/Sales links to the hub's indices.
- **External link renumbering cascade** -- after removing merged links, every formula `[N]SheetName!` across ALL sheets in the hub must be updated. Missing a reference produces `#REF!` errors.
- **User experience change** -- users accustomed to opening separate files will navigate to tabs within the larger Financialaccounts.
- **File size growth**:
  - Ltd: Financialaccounts grows from ~216 KB to ~580 KB with all 4 merged
  - SE: Financialaccounts grows from ~121 KB to ~260 KB with both merged

---

## Verification

### Ltd verification

- Generate a March year-end package with merged template
- Reconcile with full scenario -- must still RECONCILE (Total Sales, Gross Profit, Net Profit, Corporation Tax all within tolerance of 1)
- Verify CT600OnlineLookALike formulas resolve (was 3 external links, now 0 -- all references are intra-workbook)
- Verify Vatinterface dates populate from Admin (was external link `[1]Admin!$B$N`, now internal `Admin!$B$N`)
- Verify capital allowances flow from Schedule to CorporationTax (was `[1]Schedule!`, now `Schedule!`)
- Generate and reconcile a non-March year-end (e.g. Jun26) to test formula renaming with merged Vatinterface
- Verify all non-March year-end transforms still work: tab renaming, `renameExternalLinkSheetNames()`, `rewriteVatinterfaceFormulas()`

### SE verification

- Generate an SE package with merged template
- Reconcile with both basic and extended scenarios -- must still RECONCILE (Total Sales within tolerance of 1)
- Verify capital allowances flow from merged Schedule to Profit & Loss Account
- Verify Fixedassets formulas referencing Admin rates resolve (was `[1]Admin!`, now `Admin!`)
- Verify Fixedassets formulas referencing Purchases/Sales resolve (renumbered to hub's external link indices)
- Verify VATQtr1-5 date writes target the correct sheet XML paths after merge
- Verify Vatinterface date formulas resolve (was `[1]Admin!$B$N`, now `Admin!$B$N`)

---

## Suggested Order

### Phase 1: Ltd merges (build the tooling)

1. **Fixedassets** -- simplest; no outbound links in Ltd, no formulas to rewrite beyond removing `[1]` prefix in hub
2. **Companysecretary** -- no formulas at all; just sheet copy + shared strings merge
3. **CT600OnlineLookALike** -- depends on 1 and 2; all 3 external links become internal
4. **Vatreturns** -- most complex due to Vatinterface formula rewriting and non-March year-end interaction

### Phase 2: SE merges (reuse the tooling)

5. **Fixedassets (SE)** -- similar to Ltd but with additional outbound link handling (Admin internalisation + Purchases/Sales renumbering)
6. **Vat (SE)** -- same Vatinterface pattern as Ltd Vatreturns, but simpler since SE has no non-March year-end transforms

---

## Post-Completion: Documentation Updates

After the file reduction is complete, the following context documents must be updated to reflect the new workbook structure:

- **CONTEXT_SELF_EMPLOYED.md** -- Update workbook/sheet map, inter-workbook link diagram, file list, external link counts, and the multi-file recalculation pipeline description
- **CONTEXT_LIMITED_COMPANY.md** -- Update workbook/sheet map, inter-workbook link diagram, file list (15 -> 11 xlsx), external link counts (9 -> 7 from hub), and the multi-file recalculation pipeline description
