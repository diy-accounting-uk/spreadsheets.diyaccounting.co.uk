// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The overtype sidecar and the extraction map it attributes through, over
// JSZip copies of examples/bst-latest -- no LibreOffice, nothing on disk
// modified. Every case here breaks exactly one cell of a copy held in memory
// and asserts the exact set the sidecar reports back, which is what makes a
// silent widening of the rule fail rather than pass quietly.

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import JSZip from "jszip";
import { execFileSync } from "child_process";
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { buildSheetMap } from "../lib/spreadsheet-runner.js";
import {
  extractBstTransactions,
  bstExtractionMap,
  bstBookFieldCells,
  isBstInputCell,
  BST_TRANSACTION_REGIONS,
} from "../lib/xlsx-exporter.js";
import { overtypedCells, BST_TEMPLATE_PATH } from "../lib/overtype-sidecar.js";
import { parseCells, formulaCells, sortCellRefs } from "../lib/template-formula-map.js";
import { cellLabels, CELL_MAP } from "../products/bst.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const BST_XLSX = resolve(ROOT, "examples", "bst-latest", "GB_Accounts_Basic_Sole_Trader.xlsx");

let original;
let originalMap;

beforeAll(async () => {
  original = readFileSync(BST_XLSX);
  originalMap = bstExtractionMap();
  await extractBstTransactions(original, originalMap);
});

// One sheet's XML out of a workbook buffer.
async function sheetXml(buffer, sheet) {
  const zip = await JSZip.loadAsync(buffer);
  const sheetMap = await buildSheetMap(zip);
  return zip.file(sheetMap.get(sheet)).async("string");
}

// A copy of the workbook with one cell rewritten. `rewrite` receives the
// cell's whole <c> element and returns what stands in its place -- dropping
// the <f> to leave a typed value, or "" to remove the cell outright.
async function patchedCopy(sheet, cellRef, rewrite) {
  const zip = await JSZip.loadAsync(original);
  const sheetMap = await buildSheetMap(zip);
  const path = sheetMap.get(sheet);
  expect(path, `${sheet} not found in the fixture`).toBeTruthy();
  const xml = await zip.file(path).async("string");
  const element = xml.match(new RegExp(`<c r="${cellRef}"[^>]*(?:/>|>[\\s\\S]*?</c>)`))?.[0];
  expect(element, `${sheet}!${cellRef} has no <c> element in the fixture`).toBeTruthy();
  const patched = xml.replace(element, rewrite(element));
  expect(patched, `${sheet}!${cellRef} was not changed`).not.toBe(xml);
  zip.file(path, patched);
  return zip.generateAsync({ type: "nodebuffer" });
}

const stripFormula = (element) => {
  const stripped = element.replace(/<f[^>]*(?:\/>|>[\s\S]*?<\/f>)/, "");
  expect(stripped, `no <f> to strip from ${element}`).not.toBe(element);
  return stripped;
};

// The sidecar's answer for a copy with one cell typed over, with the copy's
// own extraction map so line attribution reflects that copy.
async function overtypedAfterPatch(sheet, cellRef, rewrite = stripFormula) {
  const buffer = await patchedCopy(sheet, cellRef, rewrite);
  const map = bstExtractionMap();
  await extractBstTransactions(buffer, map);
  return overtypedCells(buffer, { extractionMap: map });
}

describe("overtyped.json on an untouched package", () => {
  it("reports nothing for a package the generator just produced", async () => {
    expect(await overtypedCells(original, { extractionMap: originalMap })).toEqual({});
  });

  // The template prints prompt formulas across the customer's own entry
  // cells, and the generator fills them in exactly as a customer would. Were
  // the input surface not excluded these would be the sidecar's loudest
  // false positives, so they are named rather than left to the count above.
  it.each([
    ["PurchasesApr", "E10", "the expense code letter the analysis columns key on"],
    ["PurchasesJun", "E5", "the first purchase row's expense code letter"],
    ["PurchasesStock", "D30", "the closing stock value"],
  ])("does not count %s!%s, which is %s", async (sheet, cellRef) => {
    const template = formulaCells(parseCells(await sheetXml(readFileSync(BST_TEMPLATE_PATH), sheet)));
    expect(template.has(cellRef), `${sheet}!${cellRef} carries no template formula, so it proves nothing`).toBe(true);
    const upload = parseCells(await sheetXml(original, sheet));
    expect(upload.get(cellRef)?.hasF ?? false, `${sheet}!${cellRef} still computes in the fixture`).toBe(false);

    expect(isBstInputCell(sheet, cellRef)).toBe(true);
    expect(await overtypedCells(original, { extractionMap: originalMap })).not.toHaveProperty(`${sheet}!${cellRef}`);
  });

  // The Debtors & Creditors sheet takes two figures and computes the rest.
  // The writer once filled the month rows and the names beside them, which
  // left sixteen destroyed formulas in every package it produced. The two
  // entered cells carry no template formula of their own, so the sidecar has
  // nothing to say about them either way.
  it("leaves every Debtors & Creditors month row computing, and counts only its two entered cells as input", async () => {
    const upload = parseCells(await sheetXml(original, "Debtors & Creditors"));
    for (const row of [5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27]) {
      expect(upload.get(`C${row}`)?.hasF, `Debtors & Creditors!C${row}`).toBe(true);
      expect(upload.get(`F${row}`)?.hasF, `Debtors & Creditors!F${row}`).toBe(true);
      expect(upload.get(`B${row}`)?.hasF, `Debtors & Creditors!B${row}`).toBe(true);
    }
    expect(upload.get("C29")?.hasF).toBe(true);
    expect(upload.get("F29")?.hasF).toBe(true);

    expect(isBstInputCell("Debtors & Creditors", "C3")).toBe(true);
    expect(isBstInputCell("Debtors & Creditors", "F3")).toBe(true);
    expect(isBstInputCell("Debtors & Creditors", "C5")).toBe(false);
    expect(isBstInputCell("Debtors & Creditors", "B5")).toBe(false);
  });
});

describe("overtyped.json when one template formula is typed over", () => {
  it("reports the Profit & Loss net profit cell and nothing else", async () => {
    expect(await overtypedAfterPatch("Profit & Loss Acc", "C24")).toEqual({
      "Profit & Loss Acc!C24": {
        kind: "literal",
        templateFormula: "ROUND((C9-C22),0)",
        value: 265508,
        attribution: {
          kind: "reportedFigure",
          label: "**Net Profit**",
          glMapping: "gl-cor:amount (netProfit)",
        },
      },
    });
  });

  it("reports the income tax total and nothing else", async () => {
    expect(await overtypedAfterPatch("Income Tax", "E11")).toEqual({
      "Income Tax!E11": {
        kind: "literal",
        templateFormula: "SUM(E8:E10)",
        value: 88131.6,
        attribution: {
          kind: "reportedFigure",
          label: "**Total Income Tax**",
          glMapping: "tax.incomeTax (total)",
        },
      },
    });
  });

  // The analysis column sits on the transaction row but is not read into the
  // line, so the attribution names the line the row produced and says the
  // cell fed none of its fields.
  it("attributes a sales analysis cell to the line its own row produced", async () => {
    expect(await overtypedAfterPatch("SalesApr", "H10")).toEqual({
      "SalesApr!H10": {
        kind: "literal",
        templateFormula: 'IF((F4<>0),IF((D4>0)," ",F4)," ")',
        templateFormulaSharedFrom: "H4",
        value: 2400,
        attribution: {
          kind: "line",
          entryNumber: "EXP-0007",
          sourceJournalID: "sales",
          row: 10,
          readAs: null,
        },
      },
    });
  });

  it("attributes a purchases analysis cell to the line its own row produced", async () => {
    const overtyped = await overtypedAfterPatch("PurchasesApr", "H8");
    expect(Object.keys(overtyped)).toEqual(["PurchasesApr!H8"]);
    expect(overtyped["PurchasesApr!H8"].attribution).toEqual({
      kind: "line",
      entryNumber: "EXP-0115",
      sourceJournalID: "purchases",
      row: 8,
      readAs: null,
    });
  });

  it("names a cell the whole <c> element is gone from as cleared, not typed over", async () => {
    expect(await overtypedAfterPatch("Profit & Loss Acc", "C22", () => "")).toEqual({
      "Profit & Loss Acc!C22": {
        kind: "cleared",
        templateFormula: "SUM(C11:C21)",
        value: null,
        attribution: {
          kind: "reportedFigure",
          label: "Total Expenses",
          glMapping: "gl-cor:amount (totalExpenses)",
        },
      },
    });
  });

  it("names a cell emptied down to its style as cleared too", async () => {
    const emptied = (element) => element.replace(/>[\s\S]*<\/c>$/, "/>").replace(/\/><\/c>$/, "/>");
    const overtyped = await overtypedAfterPatch("Profit & Loss Acc", "C9", emptied);
    expect(Object.keys(overtyped)).toEqual(["Profit & Loss Acc!C9"]);
    expect(overtyped["Profit & Loss Acc!C9"].kind).toBe("cleared");
    expect(overtyped["Profit & Loss Acc!C9"].value).toBeNull();
    expect(overtyped["Profit & Loss Acc!C9"].attribution.glMapping).toBe("gl-cor:amount (grossProfit)");
  });
});

describe("attribution agrees with what CELL_MAP and the extraction map state", () => {
  // Every CELL_MAP cell the template computes, broken one at a time: the
  // entry must carry that row's own label and gl mapping, not a neighbour's.
  const computedReportCells = [];

  beforeAll(async () => {
    const templateBuffer = readFileSync(BST_TEMPLATE_PATH);
    const bySheet = new Map();
    for (const [sheet, cell] of CELL_MAP) {
      if (!bySheet.has(sheet)) bySheet.set(sheet, formulaCells(parseCells(await sheetXml(templateBuffer, sheet))));
      if (bySheet.get(sheet).has(cell) && !isBstInputCell(sheet, cell)) computedReportCells.push([sheet, cell]);
    }
  });

  it("finds report cells the template computes to test against", () => {
    expect(computedReportCells.length).toBeGreaterThan(20);
  });

  it("gives each broken report cell the label and gl mapping CELL_MAP states for it", async () => {
    const labels = cellLabels();
    for (const [sheet, cell] of computedReportCells) {
      const key = `${sheet}!${cell}`;
      const overtyped = await overtypedAfterPatch(sheet, cell);
      expect(Object.keys(overtyped), `breaking ${key} reported more than itself`).toEqual([key]);
      expect(overtyped[key].attribution, key).toEqual({
        kind: "reportedFigure",
        label: labels[key].diyLabel,
        glMapping: labels[key].glMapping,
      });
    }
  }, 120000);

  it("names the line a transaction row produced, matching the exported lines", async () => {
    const lines = await extractBstTransactions(original);
    const recorded = originalMap.lines();
    expect(recorded.length).toBe(lines.length);
    for (const [index, record] of recorded.entries()) {
      expect(record.entryNumber).toBe(lines[index].entryNumber);
      expect(record.sourceJournalID).toBe(lines[index].sourceJournalID);
      const found = originalMap.lineForCell(record.sheet, record.cells.postingDate);
      expect(found.entryNumber).toBe(record.entryNumber);
      expect(found.readAs).toBe("postingDate");
    }
  });

  it("reads a line's own fields out of the cells the map names", async () => {
    const record = originalMap.lines().find((r) => r.sourceJournalID === "sales");
    const xml = await sheetXml(original, record.sheet);
    const cells = parseCells(xml);
    expect(cells.has(record.cells.postingDate)).toBe(true);
    expect(cells.has(record.cells.amount)).toBe(true);
    expect(originalMap.lineForCell(record.sheet, record.cells.amount).readAs).toBe("amount");
    expect(originalMap.lineForCell(record.sheet, `Z${record.row}`).readAs).toBe(null);
  });

  it("has no line for a row that produced none", () => {
    expect(originalMap.lineForCell("SalesApr", "A3")).toBeUndefined();
    expect(originalMap.lineForCell("Profit & Loss Acc", "C24")).toBeUndefined();
  });
});

describe("the extraction map's cell-to-field half", () => {
  it("names the Business Details cells the book's entity information is read from", () => {
    const map = bstExtractionMap();
    expect(map.fieldForCell("Business Details", "C5")).toEqual({
      sheet: "Business Details",
      cell: "C5",
      field: "entityInformation.organizationIdentifier",
    });
    expect(map.fieldForCell("Business Details", "C12").field).toBe("entityInformation.organizationPostcode");
  });

  it("names the ledger, stock and Admin cells too", () => {
    const map = bstExtractionMap();
    expect(map.fieldForCell("Debtors & Creditors", "C3").field).toBe("openingBalances.tradeDebtors");
    expect(map.fieldForCell("Debtors & Creditors", "F3").field).toBe("openingBalances.tradeCreditors");
    expect(map.fieldForCell("Debtors & Creditors", "C5")).toBeUndefined();
    expect(map.fieldForCell("PurchasesStock", "D30").field).toBe("stock.closingValue");
    expect(map.fieldForCell("Admin", "B23").field).toMatch(/^tax /);
    expect(map.fieldForCell("Admin", "G21").field).toMatch(/mileage rate/);
  });

  it("has nothing to say about a cell no extractor reads", () => {
    expect(bstExtractionMap().fieldForCell("Profit & Loss Acc", "C24")).toBeUndefined();
  });

  it("counts every cell it names as an input cell", () => {
    for (const { sheet, cell } of bstBookFieldCells()) {
      expect(isBstInputCell(sheet, cell), `${sheet}!${cell}`).toBe(true);
    }
  });

  it("counts a transaction row's own columns as input cells and the rest of the row as not", () => {
    for (const region of BST_TRANSACTION_REGIONS) {
      for (const column of Object.values(region.columns)) {
        expect(isBstInputCell(region.sheet, `${column}${region.firstRow}`)).toBe(true);
        expect(isBstInputCell(region.sheet, `${column}${region.lastRow}`)).toBe(true);
        expect(isBstInputCell(region.sheet, `${column}${region.firstRow - 1}`)).toBe(false);
        expect(isBstInputCell(region.sheet, `${column}${region.lastRow + 1}`)).toBe(false);
      }
      expect(isBstInputCell(region.sheet, `H${region.firstRow}`)).toBe(false);
    }
  });
});

describe("the shipped Basic Sole Trader packages against the template", () => {
  const PACKAGES_DIR = join(ROOT, "packages");
  const shipped = existsSync(PACKAGES_DIR)
    ? readdirSync(PACKAGES_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name.startsWith("GB Accounts Basic Sole Trader"))
        .map((e) => join(PACKAGES_DIR, e.name))
        .map((dir) => join(dir, readdirSync(dir).find((f) => f.endsWith(".xlsx")) ?? ""))
        .filter((file) => file.endsWith(".xlsx"))
    : [];

  it.skipIf(shipped.length === 0)(
    "reports nothing for any year a customer can download",
    async () => {
      for (const file of shipped) {
        expect(Object.keys(await overtypedCells(readFileSync(file))), file).toEqual([]);
      }
    },
    120000,
  );
});

// export.js runs main() at import time, so the CLI cases run it as a child
// process the way export-file.test.js already does.
describe("export.js --file writes the sidecar beside the rest", () => {
  const tempDirs = [];

  afterEach(() => {
    while (tempDirs.length > 0) rmSync(tempDirs.pop(), { recursive: true, force: true });
  });

  function tempDir() {
    const dir = mkdtempSync(join(tmpdir(), "overtype-sidecar-"));
    tempDirs.push(dir);
    return dir;
  }

  it("writes an empty overtyped.json for a package the generator just produced", () => {
    const outputDir = tempDir();
    const output = execFileSync(
      process.execPath,
      ["app/bin/export.js", "--package", "bst", "--file", BST_XLSX, "--output-dir", outputDir],
      {
        cwd: ROOT,
        encoding: "utf8",
      },
    );
    expect(output).toContain("overtyped.json: 0 cells typed over a template formula");
    expect(JSON.parse(readFileSync(join(outputDir, "overtyped.json"), "utf8"))).toEqual({});
  }, 60000);

  it("writes the one cell typed over in a copy, attributed", async () => {
    const inputDir = tempDir();
    const outputDir = tempDir();
    const input = join(inputDir, "GB_Accounts_Basic_Sole_Trader.xlsx");
    writeFileSync(input, await patchedCopy("Profit & Loss Acc", "C24", stripFormula));

    const output = execFileSync(process.execPath, ["app/bin/export.js", "--package", "bst", "--file", input, "--output-dir", outputDir], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(output).toContain("overtyped.json: 1 cell typed over a template formula");
    const written = JSON.parse(readFileSync(join(outputDir, "overtyped.json"), "utf8"));
    expect(Object.keys(written)).toEqual(["Profit & Loss Acc!C24"]);
    expect(written["Profit & Loss Acc!C24"].attribution.glMapping).toBe("gl-cor:amount (netProfit)");
  }, 60000);
});

describe("the template formula map", () => {
  it("resolves a shared follower's blank <f> to its group master's text", async () => {
    const formulas = formulaCells(parseCells(await sheetXml(readFileSync(BST_TEMPLATE_PATH), "SalesApr")));
    expect(formulas.get("H4")).toEqual({ formula: 'IF((F4<>0),IF((D4>0)," ",F4)," ")', sharedMaster: null });
    expect(formulas.get("H10")).toEqual({ formula: 'IF((F4<>0),IF((D4>0)," ",F4)," ")', sharedMaster: "H4" });
  });

  it("reads a formula back the way the formula bar shows it, not XML-escaped", async () => {
    const formulas = formulaCells(parseCells(await sheetXml(readFileSync(BST_TEMPLATE_PATH), "PurchasesApr")));
    expect(formulas.get("E6").formula).toBe('IF((G6<>0),"Enter Letter"," ")');
  });

  it("orders cell refs by row then column, the way a range reads", () => {
    expect(sortCellRefs(["B2", "AA1", "A10", "A2", "Z1"])).toEqual(["Z1", "AA1", "A2", "B2", "A10"]);
  });
});
