# Excel Sheet Manipulation Techniques

This document catalogues every technique used in this project for programmatic xlsx manipulation, recalculation, and testing.

## XLSX as ZIP Archive

An `.xlsx` file is a ZIP archive containing XML files and supporting resources. The project uses [JSZip](https://stuk.github.io/jszip/) to read and write these archives without ever opening them in a spreadsheet application.

Key paths inside the archive:

| Path | Purpose |
|------|---------|
| `xl/workbook.xml` | Lists all sheets by name and `r:id` |
| `xl/_rels/workbook.xml.rels` | Maps `r:id` to `xl/worksheets/sheetN.xml` targets |
| `xl/worksheets/sheetN.xml` | One XML file per sheet containing rows, cells, formulas |
| `xl/sharedStrings.xml` | Shared string table (strings referenced by index from cells with `t="s"`) |
| `xl/externalLinks/externalLinkN.xml` | Cached values from other workbooks |
| `xl/externalLinks/_rels/externalLinkN.xml.rels` | Maps each external link to its target filename |
| `xl/calcChain.xml` | Pre-computed calculation order (removed for generated Taxi Sales sheets) |

Basic pattern for reading and modifying:

```js
import JSZip from "jszip";

const zip = await JSZip.loadAsync(xlsxBuffer);
let xml = await zip.file("xl/worksheets/sheet1.xml").async("string");
// ... modify xml string via regex ...
const originalDate = zip.file("xl/worksheets/sheet1.xml").date;
zip.file("xl/worksheets/sheet1.xml", xml, { date: originalDate });
const outBuffer = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
});
```

Preserving the original `date` on each file entry prevents spurious ZIP metadata changes. Compression level 6 is used for final output; level 1 is used for temporary files that will be fed to LibreOffice.

## XML Cell Surgery

All cell manipulation works by regex-matching XML elements in the sheet XML string, then replacing them. No DOM parser is used -- regex is sufficient because cell elements have a predictable structure and the project only targets specific known cell references.

### setCellValue(xml, cellRef, value)

Replaces a cell's content with a numeric value. Strips any existing `t="..."` type attribute (making it default to numeric) and replaces the body with `<v>value</v>`.

**In `generator.js`** (for generation -- throws if cell not found):

```js
export function setCellValue(xml, cellRef, value) {
  const match = matchCell(xml, cellRef);
  if (!match) throw new Error(`Cell ${cellRef} not found in XML`);
  const openTag = match.openTag.replace(/\s+t="[^"]*"/, "");
  return xml.replace(match.fullMatch, `${openTag}><v>${value}</v></c>`);
}
```

**In `spreadsheet-runner.js`** (for scenario injection -- inserts cell if not found):

```js
function setCellValue(xml, cellRef, value) {
  const cellPattern = new RegExp(`(<c\\s+r="${cellRef}"\\s[^>]*?)(/?>)((?:(?!</c>).)*(?:</c>)?)`, "s");
  const match = xml.match(cellPattern);
  if (!match) return insertCell(xml, cellRef, value);
  const [fullMatch, openTag] = match;
  const newOpenTag = openTag.replace(/\s+t="[^"]*"/, "");
  return xml.replace(fullMatch, `${newOpenTag}><v>${value}</v></c>`);
}
```

The runner version falls back to `insertCell()` which creates the `<c>` element in the correct column position within the row, or creates the row if it does not exist.

### setCellString(xml, cellRef, str)

Replaces a cell with an inline string. Sets `t="inlineStr"` and wraps the value in `<is><t>...</t></is>`:

```js
export function setCellString(xml, cellRef, str) {
  const match = matchCell(xml, cellRef);
  if (!match) throw new Error(`Cell ${cellRef} not found in XML`);
  let openTag = match.openTag.replace(/\s+t="[^"]*"/, "");
  openTag += ` t="inlineStr"`;
  return xml.replace(match.fullMatch, `${openTag}><is><t>${escapeXml(str)}</t></is></c>`);
}
```

Inline strings are used instead of adding to the shared string table because modifying `sharedStrings.xml` would require updating both the table and the cell's string index, which is more error-prone.

### matchCell(xml, cellRef)

Finds a cell element in XML, handling both forms:
- **Self-closing**: `<c r="B5" s="42"/>` -- common for empty cells with styling
- **Open/close**: `<c r="B5" s="42"><v>100</v></c>` -- cells with values or formulas

```js
function matchCell(xml, cellRef) {
  // Try self-closing first: <c r="X" .../>
  const selfClosing = new RegExp(`<c\\s+r="${cellRef}"\\s[^>]*?/>`, "s");
  let m = xml.match(selfClosing);
  if (m) {
    const openTag = m[0].replace(/\s*\/>$/, "");
    return { fullMatch: m[0], openTag };
  }
  // Try open/close: <c r="X" ...>...</c>
  const withContent = new RegExp(`<c\\s+r="${cellRef}"\\s[^>]*?>[\\s\\S]*?</c>`, "s");
  m = xml.match(withContent);
  if (m) {
    const openTag = m[0].replace(/>[\s\S]*$/, "");
    return { fullMatch: m[0], openTag };
  }
  return null;
}
```

### insertCellIntoRow(xml, cellRef, cellXml)

When a cell does not already exist in the XML (common for empty cells that have no styling), this function inserts it. It handles three cases:
1. **Row does not exist** -- creates a new `<row>` before `</sheetData>`
2. **Row is self-closing** (`<row r="5"/>`) -- converts to open/close form and inserts the cell
3. **Row has content** -- finds the correct insertion point by column letter order (A before B before C, etc.) using `colToNum()` which converts column letters to numeric indices (A=1, AA=27)

### escapeXml(str)

Standard XML entity escaping: `& < > "` become `&amp; &lt; &gt; &quot;`.

## Sheet Map and Navigation

### buildSheetMap(zip)

Maps human-readable sheet names to their XML file paths within the ZIP. This is the key function for navigating a workbook programmatically.

Algorithm:
1. Parse `xl/workbook.xml` to extract `<sheet name="SheetName" r:id="rId3"/>` mappings
2. Parse `xl/_rels/workbook.xml.rels` to extract `<Relationship Id="rId3" Target="worksheets/sheet3.xml"/>` mappings
3. Join on `rId` to produce `Map<string, string>`: `"MnthP&L" -> "xl/worksheets/sheet3.xml"`

Sheet names are XML-encoded in `workbook.xml` (e.g. `MnthP&amp;L`), so the function decodes `&amp;` back to `&` for the map keys.

```js
async function buildSheetMap(zip) {
  const wbXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");

  const sheetEntries = [...wbXml.matchAll(/name="([^"]*)"[^/]*r:id="(rId\d+)"/g)];
  const relEntries = [...relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]*)"/g)];

  const ridToFile = new Map();
  for (const [, rid, target] of relEntries) ridToFile.set(rid, `xl/${target}`);

  const sheetMap = new Map();
  for (const [, name, rid] of sheetEntries) {
    const decodedName = name.replace(/&amp;/g, "&");
    const file = ridToFile.get(rid);
    if (file) sheetMap.set(decodedName, file);
  }
  return sheetMap;
}
```

### readCellValue(xml, cellRef)

Reads a cell's value from sheet XML after recalculation. Handles multiple cell types:

| `t=` attribute | Meaning | Extraction |
|----------------|---------|------------|
| (none) | Numeric | `parseFloat(<v>)` |
| `"s"` | Shared string index | Returns raw index (full lookup would need sharedStrings.xml) |
| `"inlineStr"` | Inline string | Extract from `<is><t>text</t></is>` |
| `"b"` | Boolean | `"1"` = true, `"0"` = false |

After xls roundtrip, formula results are materialized as `<v>` values, so formulas do not need to be evaluated -- just read the cached value.

## Tab Renaming for Non-March Year-Ends

The Ltd template ships with March year-end tab names: Apr, May, Jun, ..., Mar. For other year-end months, tabs must be renamed. Seven files need tab renaming: Sales.xlsx, Purchases.xlsx, Currentaccount.xlsx, Savingaccount.xlsx, Cashaccount.xlsx, Creditcardaccount.xlsx, Payslips.xlsx.

### getMonthTabSequence(yearEndMonth)

Computes the 12-month tab name sequence starting from the month after year-end:

```js
const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function getMonthTabSequence(yearEndMonth) {
  const tabs = [];
  for (let i = 0; i < 12; i++) {
    tabs.push(MONTH_NAMES_SHORT[(yearEndMonth + i) % 12]);
  }
  return tabs;
}
```

For March (M=3): `[Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar]`
For June (M=6): `[Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar, Apr, May, Jun]`

### renameMonthTabs(xlsxBuffer, yearEndMonth)

Renames sheet tab names in `xl/workbook.xml`. Uses a **two-pass placeholder strategy** to avoid collisions when renaming (e.g. "Apr" -> "Jul" and "Jul" -> "Oct" must not produce "Oct" -> "Oct" -> "Jan"):

1. **Pass 1**: Replace all template names with unique placeholders (`__MONTH_0__`, `__MONTH_1__`, ...)
2. **Pass 2**: Replace all placeholders with target names

```js
const placeholders = templateTabs.map((_, i) => `__MONTH_${i}__`);
for (let i = 0; i < 12; i++) {
  wbXml = wbXml.replace(new RegExp(`name="${templateTabs[i]}"`, "g"), `name="${placeholders[i]}"`);
}
for (let i = 0; i < 12; i++) {
  wbXml = wbXml.replace(new RegExp(placeholders[i], "g"), targetTabs[i]);
}
```

### renameExternalLinkSheetNames(xlsxBuffer, yearEndMonth)

Renames month references in **formulas** across all worksheet XMLs and in external link XML files. This covers:

1. **Formula references** like `Apr!G2`, `[2]Apr!$H$1`, `[3]May!$F$1` in worksheet XMLs
2. **Cached sheet names** like `<sheetName val="Apr"/>` in external link XMLs

Uses the same two-pass placeholder strategy (with `__EL_N__` placeholders) to avoid collisions.

**Critical bug that was fixed**: `renameMonthTabs()` renames tab names in `workbook.xml` but does NOT rename intra-workbook cross-tab formula references in the sheet XMLs. For example, in Sales.xlsx the Aug tab has formula `G2: Apr!G2` (a VAT rate chain referencing the previous month). After renaming the "Apr" tab to "Jul", this formula points at a non-existent tab, causing `#VALUE!` errors after xls roundtrip.

The fix: apply `renameExternalLinkSheetNames()` to ALL tab-renamed leaf files (Sales, Purchases, all 4 bank accounts, Payslips), not just the Financialaccounts hub. In `generate.js`:

```js
if (yearEndMonth && templateFile.endsWith(".xlsx") && TAB_RENAME_FILES.has(templateFile)) {
  buffer = await renameMonthTabs(buffer, yearEndMonth);
  buffer = await renameExternalLinkSheetNames(buffer, yearEndMonth);
}
```

Both functions are applied to leaf files. The hub (Financialaccounts) gets only `renameExternalLinkSheetNames()` because it has no month-named tabs itself -- its formulas reference month tabs in other workbooks via external links.

## External Link Cache Management

### How External Links Work in xlsx

When workbook A references workbook B (e.g. `[2]Sales!Apr!$H$1`), Excel stores:

1. **`xl/externalLinks/externalLinkN.xml`**: Contains `<sheetNames>` listing all sheets in the target workbook, and `<sheetData sheetId="N">` blocks with cached cell values
2. **`xl/externalLinks/_rels/externalLinkN.xml.rels`**: Maps the link to the target filename (e.g. `Target="Sales.xlsx"`)

The `sheetId` attribute in `<sheetData>` is a **sequential zero-based index** into the `<sheetNames>` list. It is NOT the `sheetId` from the target workbook's `workbook.xml`. This distinction is critical when looking up sheet names.

### updateExternalLinkCaches(workDir, hubFile)

After leaf files (Sales, Purchases, bank accounts) are recalculated via xls roundtrip, their computed values must be injected into the hub file's (Financialaccounts) external link caches before the hub can be recalculated.

Algorithm:
1. Open the hub xlsx, find all `xl/externalLinks/externalLinkN.xml` files
2. For each external link, read its `.rels` file to find the target filename (e.g. `Sales.xlsx`)
3. Open the recalculated leaf file, build its sheet map
4. For each `<sheetData sheetId="N">` block in the external link XML:
   - Map `sheetId` to sheet name via the sequential `<sheetNames>` index
   - Find each `<cell r="A1">` in the cached data
   - Read the fresh value from the recalculated leaf's sheet XML using `readCellValue()`
   - Replace the cached `<cell>` element with the fresh value
5. Write the updated hub file back

```js
const sheetNames = [...linkXml.matchAll(/<sheetName val="([^"]*)"/g)]
  .map(m => m[1].replace(/&amp;/g, "&"));

// sheetId is a sequential index into sheetNames, NOT workbook sheetId
const sheetName = sheetNames[parseInt(sheetId, 10)];
```

Only numeric values are updated (the accounting workbooks use numbers for all computed totals). String values in the cache are left unchanged.

## Vatinterface Formula Rewriting

The Vatinterface sheet in Vatreturns.xlsx references the Financialaccounts Admin sheet's B-column for monthly dates. The B-column stores month-end dates in consecutive even rows starting from a row that depends on the year-end month.

### Admin Start Row Formula

```
adminStartRow = ((yearEndMonth - 1) % 12) * 2 + 2
```

| Year-End Month | M | adminStartRow | B-column range |
|----------------|---|---------------|----------------|
| January | 1 | 2 | B$2 through B$32 |
| March | 3 | 6 | B$6 through B$36 |
| June | 6 | 12 | B$12 through B$42 |
| September | 9 | 18 | B$18 through B$48 |
| December | 12 | 24 | B$24 through B$54 |

### rewriteVatinterfaceFormulas(xlsxBuffer, yearEndMonth, vatinterfacePath)

Rewrites formula references in the Vatinterface sheet XML. Two kinds of references are rewritten:

**1. B-column Admin references**: `[1]Admin!$B$6` through `[1]Admin!$B$36` are remapped to the correct row range:

```js
const rowMap = {};
for (let i = 0; i < 16; i++) {
  rowMap[templateStartRow + i * 2] = targetStartRow + i * 2;
}
viXml = viXml.replace(/\[1\]Admin!\$B\$(\d+)/g, (match, rowStr) => {
  const row = parseInt(rowStr, 10);
  return rowMap[row] !== undefined ? `[1]Admin!$B$${rowMap[row]}` : match;
});
```

**2. Sales/Purchases tab name references**: D-column and M-column formulas reference `[2]Apr!`, `[3]May!` etc. When tabs are renamed for non-March year-ends, these must be updated:

```js
for (let i = 0; i < 12; i++) {
  if (templateTabs[i] !== targetTabs[i]) {
    viXml = viXml.replace(new RegExp(`\\[2\\]${templateTabs[i]}!`, "g"), `[2]${targetTabs[i]}!`);
    viXml = viXml.replace(new RegExp(`\\[3\\]${templateTabs[i]}!`, "g"), `[3]${targetTabs[i]}!`);
  }
}
```

`[2]` = Purchases, `[3]` = Sales (the external link numbering from the Vatreturns workbook).

## XLS Roundtrip (Recalculation)

### Why

LibreOffice `--convert-to xlsx` (xlsx-to-xlsx) does not recalculate formulas. The project forces recalculation by round-tripping through the legacy `.xls` format:

```
xlsx -> xls (forces formula evaluation) -> xlsx (back to modern format)
```

LibreOffice `--convert-to` also never resolves external links between files, which is why the multi-file pipeline exists.

### How

```js
const userProfile = `file://${resolve(workDir, "lo_profile")}`;
execSync(
  `"${soffice}" --headless --norestore --calc ` +
  `-env:UserInstallation="${userProfile}" ` +
  `--convert-to xls --outdir "${workDir}" "${xlsxPath}"`,
  { stdio: "pipe", timeout: 60000 }
);
execSync(
  `"${soffice}" --headless --norestore --calc ` +
  `-env:UserInstallation="${userProfile}" ` +
  `--convert-to xlsx --outdir "${workDir}" "${xlsPath}"`,
  { stdio: "pipe", timeout: 60000 }
);
```

Key details:
- **Unique `UserInstallation` per invocation**: Each call creates a fresh LibreOffice profile directory inside the temp working directory. This prevents profile lock conflicts when multiple conversions run in parallel.
- **60-second timeout**: Each conversion step has a 60-second timeout to prevent hung LibreOffice processes from blocking the pipeline.
- **`--norestore`**: Suppresses the recovery dialog if a previous LibreOffice instance crashed.
- **`--calc`**: Forces Calc mode (not Writer or Impress).

### Single-File Flow (runSpreadsheet)

Used for BST and Taxi (single-workbook products):
1. Load xlsx, inject scenario data via `setCellValue`/`setCellString`
2. Write modified xlsx to temp dir
3. xls roundtrip (xlsx -> xls -> xlsx)
4. Read back computed values from the recalculated xlsx
5. Clean up temp dir

### Finding LibreOffice

The `findLibreOffice()` function checks four candidate paths in order: `libreoffice`, `soffice`, `/Applications/LibreOffice.app/Contents/MacOS/soffice`, `/usr/bin/libreoffice`. The first one that responds to `--version` is cached for the session.

## Multi-File Recalculation Pipeline

Used for SE and Ltd products where multiple xlsx files have cross-file external links. The hub file (Financialaccounts.xlsx) references leaf files (Sales, Purchases, bank accounts, etc.) via external links.

### Pipeline Steps

```
1. Write scenario data into leaf xlsx files (Sales, Purchases)
   via setCellValue/setCellString

2. Copy all xlsx files to a shared temp directory
   (so relative external link paths resolve)

3. xls roundtrip each LEAF file
   (recalculates internal formulas: VAT, net amounts, row totals)

4. Read computed values from recalculated leaves
   Inject into hub's external link cache XML
   (updateExternalLinkCaches)

5. xls roundtrip the HUB file
   (now has fresh cached values from leaves,
    recalculates TrialBalance, MnthP&L, CorporationTax, etc.)

6. Read final results from recalculated hub
```

### runMultiFileSpreadsheet()

```js
export async function runMultiFileSpreadsheet(
  fileBuffers,    // { "Sales.xlsx": Buffer, "Purchases.xlsx": Buffer, ... }
  fileWrites,     // { "Sales.xlsx": { "Apr": { "A5": value } }, ... }
  cellReads,      // { "MnthP&L": ["B9", "B45"], "CorporationTax": ["K35"] }
  readFile,       // "Financialaccounts.xlsx"
  options         // { saveRecalculatedTo: "/path/to/dir" }
)
```

The `readFile` parameter identifies the hub -- all other files are treated as leaves and recalculated first. The caller decides which cells to read from the hub after the pipeline completes.

When `saveRecalculatedTo` is provided, all recalculated files (both leaves and hub) are copied to the specified directory. This is used by the reconciliation pipeline to save populated files for debugging.

## Known Limitations and Pitfalls

### Shared Formula Flattening Breaks LibreOffice xls Roundtrip

Shared formulas (`<f t="shared" si="N"/>`) are an xlsx optimization where one cell defines a formula and others reference it by index. An approach was tested where these were flattened to explicit per-cell formulas. **This caused LibreOffice's xls roundtrip to corrupt entire sheets** -- producing `styleSheet` XML instead of `worksheet` data. Shared formulas are NOT the root cause of non-March year-end issues. The actual root cause was unrenamed intra-workbook cross-tab formula references.

### ODS Roundtrip Does Not Recalculate

Converting xlsx to ODS and back does not trigger formula recalculation. All computed cells return zero. The xls roundtrip is the only working approach.

### Double xls Roundtrip Compounds Corruption

Running xls roundtrip twice on the same file compounds formatting loss and data corruption. The pipeline is designed to roundtrip each file exactly once.

### LibreOffice Never Resolves External Links

`libreoffice --convert-to` does not resolve external link references between files, even when all files are in the same directory. This is why `updateExternalLinkCaches()` exists -- it manually reads values from recalculated leaves and injects them into the hub's external link XML.

### setup-java with Temurin Does Not Provide JDK 25

In CI (GitHub Actions), the Temurin distribution does not offer JDK 25. Amazon Corretto is used instead, which has been GA since September 2025.

## Print Settings

Print settings are stored in each sheet's XML as a `<printOptions>` element within the `<worksheet>` root. To enable row and column header printing (useful for PDF output with cell references visible), the `headings` attribute is set:

```xml
<printOptions headings="1"/>
```

This is applied by modifying the sheet XML inside the xlsx ZIP. If a `<printOptions>` element already exists, the `headings="1"` attribute is added. If it does not exist, a new `<printOptions headings="1"/>` element is inserted after `<sheetFormatPr>` or another appropriate anchor element.

The `<printOptions>` element supports other attributes like `horizontalCentered="1"` and `verticalCentered="1"`, but `headings="1"` is the primary one used for debugging and verification output.

## CELL_MAP Pattern for Cell-to-Label Mapping

Product modules (`app/products/bst.js`, `se.js`, `ltd.js`) define a CELL_MAP array that maps xlsx cells to English labels and diya-gl GL properties. Each entry specifies: sheet name, cell reference, DIY label (human-readable description), diya-gl property name, report section, and indent level.

This pattern provides a single source of truth for:
- **Which cells to read** after recalculation (`standardReads()` -- derives cell reads from CELL_MAP)
- **How to label cells** in reports (`cellLabels()` -- produces a cell appendix with DIY labels and diya-gl mappings)
- **How to format financial statements** (`reportSections()` -- groups cells by section with proper indentation)

When adding new cells to read from a spreadsheet, add an entry to the product's CELL_MAP array rather than modifying `standardReads()` directly.

## Testing Approaches

### Generating and Reconciling a Single Package

```bash
# Generate a specific product and year-end
node app/bin/generate.js --product ltd --year-end 2026-06-30

# Reconcile against the generated package
node app/bin/reconcile.js --package ltd --scenario full --year-end 2026-06-30
```

Other useful invocations:

```bash
# Generate all products, all years
node app/bin/generate.js

# Generate BST only, specific tax years
node app/bin/generate.js --package bst --years se-2025-2026

# Skip PDF guide generation (faster iteration)
node app/bin/generate.js --skip-guide

# Reconcile all scenarios for all products
node app/bin/reconcile.js

# Reconcile SE only, basic scenario
node app/bin/reconcile.js --package se --scenario basic
```

### Scenario Levels

Scenarios are TOML fixtures in `app/test/fixtures/`. Each product has one or more scenario levels:

- **basic**: Minimal transactions (e.g. sales only), tests core data flow. Available for all products (bst, se, taxi, ltd).
- **extended**: Sales + purchases + bank entries, tests more analysis columns. Available for bst, se, ltd.
- **full**: All transactions from DIYA GL example data, tests complete reconciliation including Corporation Tax computation. Available for ltd only.

Each scenario TOML file contains:
- `[metadata]` -- product name, description
- `[sales.month]` -- array of `{ date, customer, code, amount }` entries per month
- `[purchases.month]` -- array of `{ date, supplier, code, amount }` entries per month
- `[expected]` -- expected totals for compliance checks (total_sales, gross_profit, net_profit)

### Reconciliation Flow

1. **Load scenario** from TOML fixture via `loadScenario()` (uses `smol-toml` parser)
2. **Product module computes `cellWrites()`**: scenario data mapped to `{ "SheetName": { "A5": value, "B5": "string" } }`. Product modules own the column/code mappings (e.g. BST uses `SalesApr` sheet names, SE/Ltd use `Apr` sheet names in separate xlsx files)
3. **Product module defines `standardReads()`**: which cells to read back from the recalculated workbook (e.g. `{ "MnthP&L": ["B9", "B45"], "CorporationTax": ["K35"] }`)
4. **spreadsheet-runner** writes data, recalculates (single-file or multi-file pipeline), reads results
5. **Product module runs `checkCompliance()`**: compares actual values against expected values with tolerance (default +/- 1 for rounding). For SE products, also computes expected income tax and NI using the tax data rates and compares.
6. **Report generated as markdown**: includes pass/fail table, raw output values, and overall RECONCILES/ANOMALYDETECTED status

### CI Matrix Reconciliation

The CI pipeline runs reconciliation in parallel across year-ends:

1. **Generate job** produces all packages (all products, all year-ends within the 14-month cutoff) and computes a year-end matrix
2. **Reconcile jobs** run in parallel (one job per year-end, `fail-fast: false` so all run even if some fail)
3. Each job runs all applicable scenarios for that year-end
4. Reports are uploaded as per-year-end artifacts
5. **Commit job** merges all report artifacts

### Inspecting Recalculated Files

Reconciliation saves populated (data-injected, recalculated) files to `reports/populated/`:

```bash
# After running reconcile.js, populated files are at:
# reports/populated/<package_slug>_<scenario>/  (multi-file)
# reports/populated/<package_slug>_<scenario>.xlsx  (single-file)
```

To inspect cell values in a recalculated xlsx programmatically:

```js
import JSZip from "jszip";
import { readFileSync } from "fs";

const zip = await JSZip.loadAsync(readFileSync("reports/populated/example.xlsx"));
const sheetMap = await buildSheetMap(zip);
const xml = await zip.file(sheetMap.get("MnthP&L")).async("string");
const value = readCellValue(xml, "B9"); // read a specific cell
```

To debug cross-file data flow, inspect the external link cache in the hub file:

```js
const hubZip = await JSZip.loadAsync(readFileSync("reports/populated/.../Financialaccounts.xlsx"));
const linkXml = await hubZip.file("xl/externalLinks/externalLink3.xml").async("string");
// Check <sheetData> blocks for cached values from Sales.xlsx
```
