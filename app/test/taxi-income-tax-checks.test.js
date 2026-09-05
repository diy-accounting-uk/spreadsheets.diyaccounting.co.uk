// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-income-tax-checks.test.js — Proves the Taxi income tax checks catch a
// broken workbook. The Draft Tax calculation now carries three bands and an
// allowance that tapers away above 100,000, and the generator injects the
// taper threshold, the additional rate and the higher band end into the Admin
// sheet.
//
// The Kestrel Executive Cars fixture is the one whose profit clears both the
// taper threshold and the additional rate threshold, so it is the only fixture
// that exercises the new rows end to end.
//
// Each check runs on a real LibreOffice-recalculated workbook, then again
// after corrupting one cell's cached value in a copy of the xlsx via JSZip.
// The corrupted run has to fail exactly the checks that read the cell and
// nothing else.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { runSpreadsheet, hasLibreOffice, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { cellWrites as taxiCellWrites, standardReads as taxiReads, checkCompliance as taxiCheckCompliance } from "../products/taxi.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const TAXI_DIR = resolve(APP_DIR, "templates", "taxi");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

const TAX_SHEET = "Draft Tax calculation";

// Overwrites a cell's cached <v> in place, leaving any <f> formula untouched --
// the way a stale or corrupted cached value reaches a reader that only ever
// sees the last-saved cell.
function corruptCellValue(xml, cellRef, newValue) {
  const pattern = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v>)([^<]*)(</v>)`, "s");
  if (!pattern.test(xml)) throw new Error(`corruptCellValue: cell ${cellRef} not found in sheet XML`);
  return xml.replace(pattern, (_match, pre, _old, post) => `${pre}${newValue}${post}`);
}

// Loads the recalculated workbook, overwrites one cell's cached value,
// round-trips the archive and reads the cell back -- a real mutation of a copy
// of the workbook, not a string edit on the in-memory results.
async function readCorruptedCell(path, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(readFileSync(path));
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheetName);
  if (!sheetPath) throw new Error(`readCorruptedCell: sheet ${sheetName} not found`);
  const xml = await zip.file(sheetPath).async("string");
  zip.file(sheetPath, corruptCellValue(xml, cellRef, newValue));

  const corruptedBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const reloadedZip = await JSZip.loadAsync(corruptedBuffer);
  const sharedStrings = await loadSharedStrings(reloadedZip);
  const reloadedXml = await reloadedZip.file(sheetPath).async("string");
  return readCellValue(reloadedXml, cellRef, sharedStrings);
}

function failureNames(checks) {
  return checks.filter((c) => !c.pass && c.severity !== "warning").map((c) => c.name);
}

const TAX_CHECK_NAMES = [
  "Income Tax",
  "NI Class 4 (lower)",
  "Total Tax + NI",
  "Tax: Personal allowance after taper",
  "Tax: sheet applies the basic rate to the lower band",
  "Tax: sheet applies the higher rate above the band",
  "Tax: sheet applies the additional rate above the higher band",
  "Tax: sheet splits the basic and higher bands at the basic band end",
  "Tax: sheet splits the higher and additional bands at the higher band end",
  "Tax at basic rate",
  "Tax at higher rate",
  "Tax at additional rate",
  "Tax: Taxable = Profit - Allowance",
  "Tax: IT = Basic + Higher + Additional",
  "Tax: Total = IT + NI",
  "Admin: Personal Allowance Taper Threshold = tax data",
  "Admin: Additional Rate = tax data",
  "Admin: Higher Band End = tax data",
];

describeCalc("Taxi income tax checks catch a broken workbook", () => {
  let results;
  let checks;
  let taxData;
  let expected;
  let populatedPath;

  function checksWithCorruptedCell(resultKey, cellRef, value) {
    const corrupted = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: value } };
    return taxiCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);
  }

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(TAXI_DIR, "taxi-excel.xlsx"));
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(TAXI_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    const scenario = loadScenario(resolve(FIXTURES_DIR, "taxi-scenario-kestrel.toml"));
    expected = { ...scenario, ...scenario.expected };

    populatedPath = join(mkdtempSync(join(tmpdir(), "taxi-income-tax-checks-")), "populated.xlsx");
    results = await runSpreadsheet(xlsxBuffer, taxiCellWrites(scenario), taxiReads(), { saveRecalculatedTo: populatedPath });
    checks = taxiCheckCompliance(results, expected, taxData, calculateExpectedTax);
  }, 120000);

  it("passes every income tax check on the intact book", () => {
    for (const name of TAX_CHECK_NAMES) {
      const check = checks.find((c) => c.name === name);
      expect(check, `missing check: ${name}`).toBeDefined();
      expect(check.pass, `${name}: expected ${check.expected}, actual ${check.actual}`).toBe(true);
    }
  });

  // Hand-computed from the 2025-26 rates on the profit the SA103S carries:
  // the allowance is nil because 144,520 is more than 25,140 above the
  // 100,000 taper threshold; 37,700 at 20% is 7,540; 37,700 to 125,140 at 40%
  // is 34,976; the remaining 19,380 at 45% is 8,721. Class 4 is 2,262 on the
  // band to 50,270 and 2% on the 94,250 above it.
  it("charges the Kestrel profit the statutory amount", () => {
    const tax = results[TAX_SHEET];
    expect(tax.E5).toBeCloseTo(144520, 2);
    expect(tax.E6).toBe(0);
    expect(tax.E7).toBeCloseTo(144520, 2);
    expect(tax.E8).toBeCloseTo(7540, 2);
    expect(tax.E9).toBeCloseTo(34976, 2);
    expect(tax.E10).toBeCloseTo(8721, 2);
    expect(tax.E11).toBeCloseTo(51237, 2);
    expect(tax.E14).toBeCloseTo(2262, 2);
    expect(tax.E15).toBeCloseTo(1885, 2);
    expect(tax.E17).toBeCloseTo(55384, 2);
  });

  it.each([
    [TAX_SHEET, "E6", 5000, ["Tax: Personal allowance after taper", "Tax: Taxable = Profit - Allowance"]],
    [TAX_SHEET, "E10", 1, ["Tax at additional rate", "Tax: IT = Basic + Higher + Additional"]],
    [TAX_SHEET, "E11", 1, ["Income Tax", "Tax: IT = Basic + Higher + Additional", "Tax: Total = IT + NI"]],
    [TAX_SHEET, "C9", 1, ["Tax: sheet splits the basic and higher bands at the basic band end"]],
    [TAX_SHEET, "C10", 1, ["Tax: sheet splits the higher and additional bands at the higher band end"]],
    [TAX_SHEET, "D10", 0.9, ["Tax: sheet applies the additional rate above the higher band"]],
    ["Admin", "N5", 1, ["Admin: Personal Allowance Taper Threshold = tax data"]],
    ["Admin", "N8", 0.9, ["Admin: Additional Rate = tax data"]],
    ["Admin", "N13", 1, ["Admin: Higher Band End = tax data"]],
  ])("corrupting %s!%s via JSZip fails exactly the checks that read it", async (sheet, cellRef, corruptedValue, expectedFailures) => {
    for (const name of expectedFailures) {
      expect(checks.find((c) => c.name === name).pass, `${name} should pass on the intact book`).toBe(true);
    }

    const value = await readCorruptedCell(populatedPath, sheet, cellRef, corruptedValue);
    expect(value).toBe(corruptedValue);
    const corrupted = checksWithCorruptedCell(sheet, cellRef, value);
    expect(failureNames(corrupted).sort()).toEqual([...expectedFailures].sort());
  });
});
