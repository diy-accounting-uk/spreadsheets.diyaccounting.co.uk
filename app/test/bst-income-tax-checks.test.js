// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst-income-tax-checks.test.js — Proves the BST income tax checks catch a
// broken workbook. The sheet now carries three bands and an allowance that
// tapers away above 100,000, and the generator injects the taper threshold,
// the additional rate and the higher band end into the Admin sheet.
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
import { cellWrites as bstCellWrites, standardReads as bstReads, checkCompliance as bstCheckCompliance } from "../products/bst.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const BST_DIR = resolve(APP_DIR, "templates", "bst");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

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
  "Tax: Total = IT + CIS deduction line + NI",
  "P&L: tax charged = Income Tax sheet total less CIS deducted",
  "Admin: Personal Allowance Taper Threshold = tax data",
  "Admin: Additional Rate = tax data",
  "Admin: Higher Band End = tax data",
];

describeCalc("BST income tax checks catch a broken workbook", () => {
  let results;
  let checks;
  let taxData;
  let expected;
  let populatedPath;

  function checksWithCorruptedCell(resultKey, cellRef, value) {
    const corrupted = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: value } };
    return bstCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);
  }

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(BST_DIR, "bst-excel.xlsx"));
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(BST_DIR, "meta.toml"), "utf8"));
    const xlsxBuffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    const scenario = loadScenario(resolve(FIXTURES_DIR, "bst-scenario-basic.toml"));
    expected = { ...scenario, ...scenario.expected };

    populatedPath = join(mkdtempSync(join(tmpdir(), "bst-income-tax-checks-")), "populated.xlsx");
    results = await runSpreadsheet(xlsxBuffer, bstCellWrites(scenario), bstReads(), { saveRecalculatedTo: populatedPath });
    checks = bstCheckCompliance(results, expected, taxData, calculateExpectedTax);
  }, 120000);

  it("passes every income tax check on the intact book", () => {
    for (const name of TAX_CHECK_NAMES) {
      const check = checks.find((c) => c.name === name);
      expect(check, `missing check: ${name}`).toBeDefined();
      expect(check.pass, `${name}: expected ${check.expected}, actual ${check.actual}`).toBe(true);
    }
  });

  it.each([
    ["Income Tax", "E6", 5000, ["Tax: Personal allowance after taper", "Tax: Taxable = Profit - Allowance"]],
    ["Income Tax", "E10", 1, ["Tax at additional rate", "Tax: IT = Basic + Higher + Additional"]],
    [
      "Income Tax",
      "E11",
      1,
      [
        "Income Tax",
        "P&L: tax charged = Income Tax sheet total less CIS deducted",
        "Tax: IT = Basic + Higher + Additional",
        "Tax: Total = IT + CIS deduction line + NI",
      ],
    ],
    [
      "Income Tax",
      "E12",
      500,
      ["P&L: tax charged = Income Tax sheet total less CIS deducted", "Tax: Total = IT + CIS deduction line + NI"],
    ],
    ["Income Tax", "C9", 1, ["Tax: sheet splits the basic and higher bands at the basic band end"]],
    ["Income Tax", "C10", 1, ["Tax: sheet splits the higher and additional bands at the higher band end"]],
    ["Income Tax", "D10", 0.9, ["Tax: sheet applies the additional rate above the higher band"]],
    ["Admin", "N5", 1, ["Admin: Personal Allowance Taper Threshold = tax data"]],
    ["Admin", "N9", 0.9, ["Admin: Additional Rate = tax data"]],
    ["Admin", "N14", 1, ["Admin: Higher Band End = tax data"]],
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
