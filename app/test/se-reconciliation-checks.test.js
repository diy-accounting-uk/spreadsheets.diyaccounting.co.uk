// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-reconciliation-checks.test.js — Proves the SE whole-book cross-check and
// debtors/creditors checks read live formula results, not a fixture value
// compared to itself: each check is asserted to pass against a real
// recalculated package, then a copy of that package is corrupted via JSZip
// (the cached value a formula last wrote is overwritten, the formula left in
// place) and the same check is asserted to fail against the corrupted read.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, mkdtempSync } from "fs";
import { resolve, dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import {
  runMultiFileSpreadsheet,
  hasLibreOffice,
  buildSheetMap,
  readCellValue,
  loadSharedStrings,
  toExcelSerial,
} from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario, MONTH_SHEETS } from "../lib/scenario-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import {
  cellWrites as seCellWrites,
  standardReads as seReads,
  multiFileOptions as seOptions,
  checkCompliance as seCheckCompliance,
  profitBridge as seProfitBridge,
  categoryNetting as seCategoryNetting,
} from "../products/se.js";
import { categoryNettingCheckName, PROFIT_BRIDGE_CHECK } from "../lib/report-generator.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const SE_DIR = resolve(APP_DIR, "templates", "se");
const DATA_DIR = resolve(APP_DIR, "data");
// The year the tax year a package was built for opens in, which is the payroll
// year the Employee sheet's start dates are read against.
const seTaxYearStart = (taxData) => new Date(taxData.tax_year.start).getUTCFullYear();
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

// Overwrites a cell's cached <v> content in place, leaving any <f> formula
// tag untouched -- the way a stale or corrupted cached value would reach a
// reader that only ever sees the last-saved cell, without disturbing the
// formula that produced it.
function corruptCellValue(xml, cellRef, newValue) {
  const pattern = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v>)([^<]*)(</v>)`, "s");
  if (!pattern.test(xml)) throw new Error(`corruptCellValue: cell ${cellRef} not found in sheet XML`);
  return xml.replace(pattern, (_match, pre, _old, post) => `${pre}${newValue}${post}`);
}

// Loads a recalculated package file via JSZip, overwrites one cell's cached
// value, round-trips it back through JSZip (generateAsync + loadAsync), and
// reads the cell back -- a genuine corrupt-a-copy-of-the-workbook mutation,
// not a string edit on the in-memory `results` object.
async function readCorruptedCell(filePath, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheetName);
  if (!sheetPath) throw new Error(`readCorruptedCell: sheet ${sheetName} not found in ${filePath}`);
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

// Moves an Excel date serial on by one calendar year, keeping its month and
// day -- the way the same book's quarter ends fall in the next year's package.
function excelSerialPlusOneYear(serial) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
  return toExcelSerial(d.getUTCFullYear() + 1, d.getUTCMonth() + 1, d.getUTCDate());
}

describeCalc(
  "Self Employed reconciliation checks: whole-book cross-check and debtors/creditors",
  () => {
    let results;
    let scenario;
    let mergedExpected;
    let saveDir;
    let taxDataForFixedAssets;

    beforeAll(async () => {
      const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
      taxDataForFixedAssets = taxData;
      const productMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));

      const fileBuffers = {};
      for (const templateFile of productMeta.template.files) {
        const templateBuffer = readFileSync(resolve(SE_DIR, templateFile));
        const fileKey = templateFile.replace(".xlsx", "").toLowerCase();
        const sheetsConfig = productMeta.sheets?.[fileKey];
        fileBuffers[templateFile] =
          sheetsConfig && Object.keys(sheetsConfig).length > 0
            ? await generateSpreadsheet(templateBuffer, taxData, sheetsConfig)
            : templateBuffer;
      }

      scenario = loadScenario(resolve(FIXTURES_DIR, "se-scenario-advanced.toml"));
      const writes = seCellWrites(scenario, seTaxYearStart(taxData));
      const reads = seReads();

      // reconcile.js currently calls checkCompliance(results, scenario.expected, ...),
      // which only exposes the fixture's [expected] table. The debtors/creditors
      // fixtures are top-level scenario arrays ([[opening_debtors]] etc.), not
      // nested under [expected], so those checks need the merged view below to
      // ever run -- see the final report for the reconcile.js change this implies.
      mergedExpected = { ...scenario, ...scenario.expected };

      saveDir = mkdtempSync(join(tmpdir(), "se-reconciliation-checks-"));
      results = await runMultiFileSpreadsheet(fileBuffers, writes, reads, "Financialaccounts.xlsx", {
        ...seOptions(),
        saveRecalculatedTo: saveDir,
      });
    }, 300000);

    // ── Whole-book cross-check (VitalTax vs P&L) ───────────────────────────

    it("VitalTax: annual product sales carries a real non-zero signal", () => {
      expect(results.VitalTax.G5).toBeGreaterThan(0);
    });

    it("VitalTax: annual product sales matches P&L Products A+B+C on the intact book", () => {
      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const check = checks.find((c) => c.name === "VitalTax: annual product sales = P&L Products A+B+C");
      expect(check).toBeDefined();
      expect(check.pass).toBe(true);
    });

    it("VitalTax: annual product sales check fails when the cached quarterly total is corrupted", async () => {
      const corrupted = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), "VitalTax", "G5", results.VitalTax.G5 + 5000);
      const corruptedResults = { ...results, VitalTax: { ...results.VitalTax, G5: corrupted } };
      const checks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      const check = checks.find((c) => c.name === "VitalTax: annual product sales = P&L Products A+B+C");
      expect(check.pass).toBe(false);
    });

    it("VitalTax: annual direct costs matches P&L Materials + Other Direct Costs on the intact book", () => {
      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const check = checks.find((c) => c.name === "VitalTax: annual direct costs = P&L Materials + Other Direct Costs");
      expect(check).toBeDefined();
      expect(check.pass).toBe(true);
    });

    it("VitalTax: annual direct costs check fails when the cached quarterly total is corrupted", async () => {
      const corrupted = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), "VitalTax", "G7", results.VitalTax.G7 + 5000);
      const corruptedResults = { ...results, VitalTax: { ...results.VitalTax, G7: corrupted } };
      const checks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      const check = checks.find((c) => c.name === "VitalTax: annual direct costs = P&L Materials + Other Direct Costs");
      expect(check.pass).toBe(false);
    });

    // ── Debtors / creditors (real sheet reads, not a fixture compared to itself) ──

    it("Opening Debtors total reads the real OpeningDebtors!G1 invoice-value sum", () => {
      expect(results["Sales.xlsx!OpeningDebtors"].G1).toBe(10800);
    });

    it("Closing Debtors total reads the real ClosingDebtors!G1 invoice-value sum", () => {
      expect(results["Sales.xlsx!ClosingDebtors"].G1).toBe(7900);
    });

    it("Opening Creditors total reads the real OpeningCreditors!G1 invoice-value sum", () => {
      expect(results["Purchases.xlsx!OpeningCreditors"].G1).toBe(2220);
    });

    it("Closing Creditors total reads the real ClosingCreditors!G1 invoice-value sum", () => {
      expect(results["Purchases.xlsx!ClosingCreditors"].G1).toBe(1710);
    });

    it.each([
      ["Opening Debtors total", "OpeningDebtors", "Sales.xlsx"],
      ["Closing Debtors total", "ClosingDebtors", "Sales.xlsx"],
      ["Opening Creditors total", "OpeningCreditors", "Purchases.xlsx"],
      ["Closing Creditors total", "ClosingCreditors", "Purchases.xlsx"],
    ])("%s passes on the intact book and fails when %s!G1 is corrupted", async (checkName, sheetName, fileName) => {
      const intactChecks = seCheckCompliance(results, mergedExpected, null, undefined);
      const intactCheck = intactChecks.find((c) => c.name === checkName);
      expect(intactCheck).toBeDefined();
      expect(intactCheck.pass).toBe(true);

      const resultKey = `${fileName}!${sheetName}`;
      const realValue = results[resultKey].G1;
      const corrupted = await readCorruptedCell(join(saveDir, fileName), sheetName, "G1", realValue + 500);
      const corruptedResults = { ...results, [resultKey]: { ...results[resultKey], G1: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      const corruptedCheck = corruptedChecks.find((c) => c.name === checkName);
      expect(corruptedCheck.pass).toBe(false);
    });

    // ── The finance line: the hire purchase agreements' own charges ───────

    it("carries the hire purchase charges and the ordinary bank charges on the P&L finance line", () => {
      // The two agreements charge 2,000 and 1,100 of admin fees and interest,
      // paid out of the current account under bank code "B" alongside 800 of
      // ordinary bank charges. "B" is the code the P&L's HP interest, lease
      // and bank charges line reads.
      expect(results["Profit & Loss Account"].B31).toBeCloseTo(3900, 6);
    });

    it("fails the finance line ties when the P&L's own finance line is corrupted via JSZip", async () => {
      const pl = results["Profit & Loss Account"];
      const corrupted = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), "Profit & Loss Account", "B31", 0);
      expect(corrupted).toBe(0);
      const corruptedResults = { ...results, "Profit & Loss Account": { ...pl, B31: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      // The line is one of the admin expenses and box 25 of the full return
      // reads it, so both of those move with it.
      expect(corruptedChecks.find((c) => c.name === "P&L: HP interest and charges reach the finance line (B31)").pass).toBe(false);
      expect(failureNames(corruptedChecks)).toEqual([
        "P&L: Admin lines sum = Total",
        "SA103F box 26 bank, credit card and finance charges (D102) = the profit and loss account",
        "P&L: HP interest and charges reach the finance line (B31)",
      ]);
    });

    // ── Fixed assets: Schedule vs Purchases/Sales, and P&L (item 5) ────────

    it("Schedule new-asset additions carry a real non-zero signal (FAreconciliation E11)", () => {
      expect(results["Fixedassets.xlsx!FAreconciliation"].E11).toBeGreaterThan(0);
    });

    it("Schedule disposals carry a real non-zero signal (FAreconciliation K11)", () => {
      expect(results["Fixedassets.xlsx!FAreconciliation"].K11).toBeGreaterThan(0);
    });

    it("P&L depreciation (summed monthly) carries a real non-zero signal", () => {
      const total = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"].reduce(
        (s, col) => s + (results["Profit & Loss Account"][`${col}34`] || 0),
        0,
      );
      expect(total).toBeGreaterThan(0);
    });

    it("reads the ledger side of the reconciliation across the leaf-to-leaf links", () => {
      const fr = results["Fixedassets.xlsx!FAreconciliation"];
      // E13 comes from Purchases.xlsx and K13 from Sales.xlsx; E15/K15 are
      // the sheet's own differences against its schedule totals. All four
      // read blank until those two ledgers reach this workbook's caches.
      expect(fr.E13).toBeGreaterThan(0);
      expect(fr.K13).toBeGreaterThan(0);
      expect(fr.E15).toBe(0);
      expect(fr.K15).toBe(0);
    });

    it.each([
      ["Fixed assets: Schedule new-asset additions = Purchases.xlsx fixed asset total", "FAreconciliation", "E13"],
      ["Fixed assets: Schedule disposals = Sales.xlsx fixed asset sales total", "FAreconciliation", "K13"],
      ["Fixed assets: Schedule new-asset additions (FAreconciliation E11) = scenario fa-coded net total", "FAreconciliation", "E11"],
      ["Fixed assets: Schedule disposals (FAreconciliation K11) = scenario fs-coded net total", "FAreconciliation", "K11"],
      [
        "Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals",
        "Schedule",
        "K1",
      ],
      ["SA103S: Capital allowances (AIA/FYA) = Schedule Q1", "SE Short", "D80"],
    ])("%s passes on the intact book and fails when %s!%s is corrupted", async (checkName, sheetName, cellRef) => {
      const fileName = sheetName === "SE Short" ? "Financialaccounts.xlsx" : "Fixedassets.xlsx";
      const resultKey = sheetName === "SE Short" ? sheetName : `Fixedassets.xlsx!${sheetName}`;

      const intactChecks = seCheckCompliance(results, mergedExpected, taxDataForFixedAssets, calculateExpectedTax);
      const intactCheck = intactChecks.find((c) => c.name === checkName);
      expect(intactCheck).toBeDefined();
      expect(intactCheck.pass).toBe(true);

      const realValue = results[resultKey][cellRef];
      const corrupted = await readCorruptedCell(join(saveDir, fileName), sheetName, cellRef, realValue + 5000);
      const corruptedResults = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, taxDataForFixedAssets, calculateExpectedTax);
      const corruptedCheck = corruptedChecks.find((c) => c.name === checkName);
      expect(corruptedCheck.pass).toBe(false);
    });

    it("corrupting Schedule!W1 fails the closing NBV check and the P&L loss-on-disposal tie, and nothing else", async () => {
      const corrupted = await readCorruptedCell(
        join(saveDir, "Fixedassets.xlsx"),
        "Schedule",
        "W1",
        results["Fixedassets.xlsx!Schedule"].W1 + 5000,
      );
      const corruptedResults = {
        ...results,
        "Fixedassets.xlsx!Schedule": { ...results["Fixedassets.xlsx!Schedule"], W1: corrupted },
      };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, taxDataForFixedAssets, calculateExpectedTax);
      // W1 is read directly in only two JS-level checks: the new closing NBV
      // identity and the P&L loss-on-disposal tie. "Fixed assets: Schedule
      // disposals = Sales.xlsx fixed asset sales total" compares two
      // FAreconciliation cells (K11 vs K13) that are themselves formula
      // results in the real workbook -- corrupting the JS-level results
      // object's Schedule.W1 does not recompute them, so that check is
      // unaffected here even though the live spreadsheet ties the two
      // together.
      expect(failureNames(corruptedChecks)).toEqual([
        "Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals",
        "P&L: Loss on disposal (row 33, summed) = Schedule -(V1-W1+X1)",
      ]);
    });

    it("corrupting Schedule!I1 fails the depreciation ties but leaves the closing NBV check passing", async () => {
      const corrupted = await readCorruptedCell(
        join(saveDir, "Fixedassets.xlsx"),
        "Schedule",
        "I1",
        results["Fixedassets.xlsx!Schedule"].I1 + 5000,
      );
      const corruptedResults = {
        ...results,
        "Fixedassets.xlsx!Schedule": { ...results["Fixedassets.xlsx!Schedule"], I1: corrupted },
      };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, taxDataForFixedAssets, calculateExpectedTax);
      const closingNbvCheck = corruptedChecks.find(
        (c) =>
          c.name === "Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals",
      );
      expect(closingNbvCheck.pass).toBe(true);
    });

    it("P&L depreciation (row 34, summed) = Schedule I1 passes on the intact book and fails when a month's cell is corrupted", async () => {
      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const check = checks.find((c) => c.name === "P&L: Depreciation (row 34, summed) = Schedule I1");
      expect(check).toBeDefined();
      expect(check.pass).toBe(true);

      const realValue = results["Profit & Loss Account"].C34;
      const corrupted = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), "Profit & Loss Account", "C34", realValue + 5000);
      const corruptedResults = {
        ...results,
        "Profit & Loss Account": { ...results["Profit & Loss Account"], C34: corrupted },
      };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      const corruptedCheck = corruptedChecks.find((c) => c.name === "P&L: Depreciation (row 34, summed) = Schedule I1");
      expect(corruptedCheck.pass).toBe(false);
    });

    it("P&L loss on disposal (row 33, summed) = Schedule -(V1-W1+X1) passes on the intact book and fails when a month's cell is corrupted", async () => {
      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const check = checks.find((c) => c.name === "P&L: Loss on disposal (row 33, summed) = Schedule -(V1-W1+X1)");
      expect(check).toBeDefined();
      expect(check.pass).toBe(true);

      const realValue = results["Profit & Loss Account"].C33;
      const corrupted = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), "Profit & Loss Account", "C33", realValue - 5000);
      const corruptedResults = {
        ...results,
        "Profit & Loss Account": { ...results["Profit & Loss Account"], C33: corrupted },
      };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      const corruptedCheck = corruptedChecks.find((c) => c.name === "P&L: Loss on disposal (row 33, summed) = Schedule -(V1-W1+X1)");
      expect(corruptedCheck.pass).toBe(false);
    });

    // ── Bank (item 6): Bank.xlsx and Cash.xlsx closing balances vs the
    // scenario's own cash movements for each account. Both read through
    // checkCompliance() via the file-qualified "<filename>!Mar" result key.

    it.each([
      ["Bank.xlsx closing balance (Mar!A2)", "Bank.xlsx"],
      ["Cash.xlsx closing balance (Mar!A2)", "Cash.xlsx"],
    ])("%s carries a real non-zero signal", (_checkName, fileName) => {
      expect(results[`${fileName}!Mar`].A2).not.toBe(0);
    });

    it.each([
      ["Bank.xlsx closing balance (Mar!A2)", "Bank.xlsx"],
      ["Cash.xlsx closing balance (Mar!A2)", "Cash.xlsx"],
    ])("%s passes on the intact book and fails when corrupted", async (checkName, fileName) => {
      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const check = checks.find((c) => c.name === checkName);
      expect(check).toBeDefined();
      expect(check.pass).toBe(true);

      const resultKey = `${fileName}!Mar`;
      const corrupted = await readCorruptedCell(join(saveDir, fileName), "Mar", "A2", results[resultKey].A2 + 5000);
      const corruptedResults = { ...results, [resultKey]: { ...results[resultKey], A2: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      const corruptedCheck = corruptedChecks.find((c) => c.name === checkName);
      expect(corruptedCheck.pass).toBe(false);
    });

    // ── Monthly P&L vs monthly Sales.xlsx (item 10) ─────────────────────
    // Purchases.xlsx is not asserted here -- see se.js's checkCompliance()
    // comment for the runner bug that makes every Purchases.xlsx net
    // figure read as gross today.

    it.each([
      ["P&L apr col C5 = Sales.xlsx a-coded net", "C5"],
      ["P&L may col D6 = Sales.xlsx b-coded net", "D6"],
      ["P&L mar col N5 = Sales.xlsx a-coded net", "N5"],
      ["P&L aug col G11 = Sales.xlsx g-coded net", "G11"],
    ])("%s carries a real non-zero signal and passes on the intact book", (checkName, cellRef) => {
      const pl = results["Profit & Loss Account"];
      expect(pl[cellRef]).toBeGreaterThan(0);

      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const check = checks.find((c) => c.name === checkName);
      expect(check).toBeDefined();
      expect(check.pass).toBe(true);
    });

    it("P&L apr col C5 = Sales.xlsx a-coded net fails when the P&L cell is corrupted", async () => {
      const realValue = results["Profit & Loss Account"].C5;
      const corrupted = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), "Profit & Loss Account", "C5", realValue + 5000);
      const corruptedResults = {
        ...results,
        "Profit & Loss Account": { ...results["Profit & Loss Account"], C5: corrupted },
      };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      const corruptedCheck = corruptedChecks.find((c) => c.name === "P&L apr col C5 = Sales.xlsx a-coded net");
      expect(corruptedCheck.pass).toBe(false);
    });

    it("P&L mar col N29 = -(Sales.xlsx o-coded net) (Bad Debts) passes on the intact book and fails when corrupted", async () => {
      const pl = results["Profit & Loss Account"];
      expect(pl.N29).not.toBe(0);

      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const check = checks.find((c) => c.name === "P&L mar col N29 = -(Sales.xlsx o-coded net)");
      expect(check).toBeDefined();
      expect(check.pass).toBe(true);

      const corrupted = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), "Profit & Loss Account", "N29", pl.N29 - 5000);
      const corruptedResults = { ...results, "Profit & Loss Account": { ...pl, N29: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      const corruptedCheck = corruptedChecks.find((c) => c.name === "P&L mar col N29 = -(Sales.xlsx o-coded net)");
      expect(corruptedCheck.pass).toBe(false);
    });

    // ── Purchases.xlsx-side monthly P&L ties (item 10, previously unshipped
    // while a runner bug made every Purchases.xlsx net read as gross) ──

    it("P&L apr col C24 = Purchases.xlsx g-coded net carries a real non-zero signal and passes on the intact book", () => {
      const pl = results["Profit & Loss Account"];
      expect(pl.C24).toBeGreaterThan(0);

      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const check = checks.find((c) => c.name === "P&L apr col C24 = Purchases.xlsx g-coded net");
      expect(check).toBeDefined();
      expect(check.pass).toBe(true);
    });

    it("P&L apr col C24 = Purchases.xlsx g-coded net fails when the P&L cell is corrupted", async () => {
      const pl = results["Profit & Loss Account"];
      const corrupted = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), "Profit & Loss Account", "C24", pl.C24 + 5000);
      const corruptedResults = { ...results, "Profit & Loss Account": { ...pl, C24: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      const corruptedCheck = corruptedChecks.find((c) => c.name === "P&L apr col C24 = Purchases.xlsx g-coded net");
      expect(corruptedCheck.pass).toBe(false);
    });

    // ── Payroll: Wagesinterface, Payslips!Payment, and the P&L wages route
    // (item 4) ──

    it("Wagesinterface apr C4 gross pay and H4 employer NI carry the payroll fixture's own totals and pass on the intact book", () => {
      const wi = results.Wagesinterface;
      expect(wi.C4).toBe(6748); // Alice 3500 + Bob 2200 + Carol 1048
      expect(wi.H4).toBeCloseTo(577.2, 5); // 382.5 + 187.5 + 7.2

      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      expect(checks.find((c) => c.name === "Wagesinterface apr C4 gross pay").pass).toBe(true);
      expect(checks.find((c) => c.name === "Wagesinterface apr H4 employer NI").pass).toBe(true);
    });

    it("Wagesinterface apr H4 employer NI fails when the cell is corrupted", async () => {
      const wi = results.Wagesinterface;
      const corrupted = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), "Wagesinterface", "H4", wi.H4 + 500);
      const corruptedResults = { ...results, Wagesinterface: { ...wi, H4: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      expect(corruptedChecks.find((c) => c.name === "Wagesinterface apr H4 employer NI").pass).toBe(false);
    });

    it("Payslips!Payment apr I4 total amount payable = income tax + NI due, and fails when corrupted", async () => {
      const payment = results["Payslips.xlsx!Payment"];
      expect(payment.I4).toBeCloseTo(1673.2, 5); // 800 income tax + 296 employee NI + 577.2 employer NI

      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      expect(checks.find((c) => c.name === "Payslips!Payment apr I4 total amount payable").pass).toBe(true);

      const corrupted = await readCorruptedCell(join(saveDir, "Payslips.xlsx"), "Payment", "I4", payment.I4 + 500);
      const corruptedResults = { ...results, "Payslips.xlsx!Payment": { ...payment, I4: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      expect(corruptedChecks.find((c) => c.name === "Payslips!Payment apr I4 total amount payable").pass).toBe(false);
    });

    it("P&L Wages & Salaries (B21) routes payroll gross pay and employer NI, and fails when corrupted", async () => {
      const pl = results["Profit & Loss Account"];
      expect(pl.B21).toBeGreaterThan(0);

      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const name = "P&L: Wages & Salaries (B21) = Purchases w-coded net + payroll gross + employer NI";
      expect(checks.find((c) => c.name === name).pass).toBe(true);

      const corrupted = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), "Profit & Loss Account", "B21", pl.B21 + 5000);
      const corruptedResults = { ...results, "Profit & Loss Account": { ...pl, B21: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      expect(corruptedChecks.find((c) => c.name === name).pass).toBe(false);
    });

    // ── SE VAT quarter box values (item 9) ──

    it("VAT Q1 box 1/3 output VAT (G9) matches the scenario's own dated sales and fails when corrupted", async () => {
      const qtr = results["Vat.xlsx!VATQtr1"];
      expect(qtr.G9).toBeGreaterThan(0);

      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const name = "VAT Q1: box 1/3 output VAT (G9) = scenario sales VAT for the quarter";
      expect(checks.find((c) => c.name === name).pass).toBe(true);

      const corrupted = await readCorruptedCell(join(saveDir, "Vat.xlsx"), "VATQtr1", "G9", qtr.G9 + 500);
      const corruptedResults = { ...results, "Vat.xlsx!VATQtr1": { ...qtr, G9: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      expect(corruptedChecks.find((c) => c.name === name).pass).toBe(false);
    });

    it("VAT Q1 box 5 net due (G17) = box 3 - box 4 identity holds and fails when box 4 is corrupted", async () => {
      const qtr = results["Vat.xlsx!VATQtr1"];
      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const name = "VAT Q1: box 5 net due (G17) = box 3 (G13) - box 4 (G15)";
      expect(checks.find((c) => c.name === name).pass).toBe(true);

      const corrupted = await readCorruptedCell(join(saveDir, "Vat.xlsx"), "VATQtr1", "G15", qtr.G15 + 500);
      const corruptedResults = { ...results, "Vat.xlsx!VATQtr1": { ...qtr, G15: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      expect(corruptedChecks.find((c) => c.name === name).pass).toBe(false);
    });

    it("VAT Q1-Q5 box values tie to the scenario when the package's year end is a year after the fixture's", () => {
      // Every SE package but the one matching the fixture's own year runs
      // this way: the book carries its own period dates while cellWrites
      // copies the scenario's base-year transaction dates straight through.
      // Advancing the book's tax year start and its quarter dates is exactly
      // that package -- the same book, the same box values, a year later.
      const shifted = { ...results };
      for (let q = 1; q <= 5; q++) {
        const key = `Vat.xlsx!VATQtr${q}`;
        const qtr = results[key];
        shifted[key] = { ...qtr, G5: excelSerialPlusOneYear(qtr.G5), G7: excelSerialPlusOneYear(qtr.G7) };
      }
      shifted.Admin = {
        ...results.Admin,
        B4: excelSerialPlusOneYear(results.Admin.B4),
        B17: excelSerialPlusOneYear(results.Admin.B17),
      };

      const checks = seCheckCompliance(shifted, mergedExpected, null, undefined);
      for (let q = 1; q <= 5; q++) {
        for (const box of [
          `box 1/3 output VAT (G9) = scenario sales VAT for the quarter`,
          `box 4 input VAT (G15) = scenario purchases VAT for the quarter`,
          `box 7 net purchases (G23) = scenario purchases net for the quarter`,
        ]) {
          const check = checks.find((c) => c.name === `VAT Q${q}: ${box}`);
          expect(check).toBeDefined();
          expect(check.expected).toBeGreaterThan(0);
          expect(check.actual).toBeGreaterThan(0);
          expect(check.pass).toBe(true);
        }
      }
    });

    it("the VAT rate read off a Sales month fails when that cell is corrupted", async () => {
      const name = "Sales.xlsx Jul: VAT rate charged (H2)";
      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      expect(checks.find((c) => c.name === name).pass).toBe(true);

      const corrupted = await readCorruptedCell(join(saveDir, "Sales.xlsx"), "Jul", "H2", 0);
      expect(corrupted).toBe(0);
      const corruptedResults = { ...results, "Sales.xlsx!Jul": { ...results["Sales.xlsx!Jul"], H2: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      expect(corruptedChecks.find((c) => c.name === name).pass).toBe(false);
    });

    it("the VAT rate read off a Purchases month fails when that cell is corrupted", async () => {
      const name = "Purchases.xlsx Jul: VAT rate charged (H2)";
      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      expect(checks.find((c) => c.name === name).pass).toBe(true);

      const corrupted = await readCorruptedCell(join(saveDir, "Purchases.xlsx"), "Jul", "H2", 5);
      expect(corrupted).toBe(5);
      const corruptedResults = { ...results, "Purchases.xlsx!Jul": { ...results["Purchases.xlsx!Jul"], H2: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      expect(corruptedChecks.find((c) => c.name === name).pass).toBe(false);
    });

    it("walks the profit before tax to the profit the income tax sheet charges with nothing left over", () => {
      const bridge = seProfitBridge(results);

      // Depreciation is added back and the grants move to box 29, which is
      // the whole of the distance to the return's own net profit.
      expect(bridge.rows[0].value).toBe(results["Profit & Loss Account"].B39);
      expect(bridge.rows[1].value).toBe(results["Profit & Loss Account"].B34);
      expect(bridge.computed).toBeCloseTo(results["Income Tax"].E5, 6);
      expect(bridge.residue).toBeCloseTo(0, 6);
    });

    it("breaks only the bridge, by the allowance it lost, when the box 24 allowance is corrupted", async () => {
      const claimed = results["SE Short"].O80;
      expect(claimed).toBeGreaterThan(0);

      const corrupted = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), "SE Short", "O80", 0);
      expect(corrupted).toBe(0);
      const corruptedResults = { ...results, "SE Short": { ...results["SE Short"], O80: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, taxDataForFixedAssets, calculateExpectedTax);

      // The full return totals the same three allowance boxes, so losing one
      // breaks its box 56 alongside the bridge.
      expect(failureNames(corruptedChecks)).toEqual([
        "SA103F box 57 total capital allowances (O154) = the short return's allowance boxes 23, 24 and 25",
        PROFIT_BRIDGE_CHECK,
      ]);
      expect(seProfitBridge(corruptedResults).residue).toBeCloseTo(claimed, 6);
    });

    it("nets every journal category the report shows to the statement figure it lands as", () => {
      const netting = seCategoryNetting(results, mergedExpected);

      expect(netting.rate).toBeGreaterThan(0);
      expect(netting.rows.length).toBeGreaterThan(0);
      for (const row of netting.rows) {
        expect(row.gross).toBeGreaterThan(0);
        expect(row.vat).toBeCloseTo(row.gross - row.net, 6);
        expect(row.residue).toBeCloseTo(0, 6);
      }

      const capitalised = netting.rows.find((row) => row.code === "purchases fa");
      expect(capitalised.cell).toBe("Fixedassets.xlsx!FAreconciliation!E11");
      expect(capitalised.net).toBeCloseTo(results["Fixedassets.xlsx!FAreconciliation"].E11, 6);

      const subcontractors = netting.rows.find((row) => row.code === "purchases c");
      expect(subcontractors.cell).toBe("Profit & Loss Account!B15");
      expect(subcontractors.net).toBeCloseTo(results["Profit & Loss Account"].B15, 6);
    });

    it("names the residue on the capitalised spend, and fails only the checks reading that cell, when the schedule additions drift", async () => {
      const drift = 500;
      const realValue = results["Fixedassets.xlsx!FAreconciliation"].E11;
      expect(realValue).toBeGreaterThan(0);

      const corrupted = await readCorruptedCell(join(saveDir, "Fixedassets.xlsx"), "FAreconciliation", "E11", realValue + drift);
      expect(corrupted).toBe(realValue + drift);
      const corruptedResults = {
        ...results,
        "Fixedassets.xlsx!FAreconciliation": { ...results["Fixedassets.xlsx!FAreconciliation"], E11: corrupted },
      };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, taxDataForFixedAssets, calculateExpectedTax);

      const nettingRow = seCategoryNetting(corruptedResults, mergedExpected).rows.find((row) => row.code === "purchases fa");
      expect(nettingRow.residue).toBeCloseTo(-drift, 6);
      expect(failureNames(corruptedChecks)).toEqual([
        "Fixed assets: Schedule new-asset additions = Purchases.xlsx fixed asset total",
        "Fixed assets: Schedule new-asset additions (FAreconciliation E11) = scenario fa-coded net total",
        categoryNettingCheckName(nettingRow),
      ]);
    });

    it("names the residue on the subcontractor spend when the profit and loss line drifts", async () => {
      const drift = 250;
      const realValue = results["Profit & Loss Account"].B15;
      expect(realValue).toBeGreaterThan(0);

      const corrupted = await readCorruptedCell(join(saveDir, "Financialaccounts.xlsx"), "Profit & Loss Account", "B15", realValue + drift);
      expect(corrupted).toBe(realValue + drift);
      const corruptedResults = {
        ...results,
        "Profit & Loss Account": { ...results["Profit & Loss Account"], B15: corrupted },
      };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, taxDataForFixedAssets, calculateExpectedTax);

      const nettingRow = seCategoryNetting(corruptedResults, mergedExpected).rows.find((row) => row.code === "purchases c");
      expect(nettingRow.residue).toBeCloseTo(-drift, 6);
      // The subcontractor line is box 17 on the full return, so the drift
      // breaks that box too.
      expect(failureNames(corruptedChecks)).toEqual([
        "SA103F box 18 subcontractor payments (D70) = the profit and loss account",
        categoryNettingCheckName(nettingRow),
      ]);
    });

    // ── CIS certificates (Purchases.xlsx column AD) ────────────────────────

    it("the tax withheld from subcontractors reaches the certificates column, month by month", () => {
      const withheldInTheYear = Object.values(scenario.purchases)
        .flat()
        .reduce((total, tx) => total + (tx.cis_deduction || 0), 0);
      expect(withheldInTheYear).toBeGreaterThan(0);

      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const certificateChecks = checks.filter((c) => c.name.includes("CIS tax withheld reaches the certificates column"));
      expect(certificateChecks).toHaveLength(12);
      expect(certificateChecks.filter((c) => !c.pass)).toEqual([]);

      const onTheSheet = Object.values(MONTH_SHEETS).reduce((total, tab) => total + (results[`Purchases.xlsx!${tab}`]?.AD1 || 0), 0);
      expect(onTheSheet).toBeCloseTo(withheldInTheYear, 2);
    });

    it("the certificates column sits outside the month's own expense analysis, which still balances", () => {
      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const balanceChecks = checks.filter((c) => c.name.includes("the month's expense analysis balances"));
      expect(balanceChecks).toHaveLength(12);
      expect(balanceChecks.filter((c) => !c.pass)).toEqual([]);
      for (const tab of Object.values(MONTH_SHEETS)) expect(results[`Purchases.xlsx!${tab}`].A1).toBeCloseTo(0, 6);
    });

    it("fails only the certificates check for the month whose cached total is corrupted", async () => {
      const month = "Jun";
      const realValue = results[`Purchases.xlsx!${month}`].AD1;
      expect(realValue).toBeGreaterThan(0);

      const corrupted = await readCorruptedCell(join(saveDir, "Purchases.xlsx"), month, "AD1", realValue + 250);
      expect(corrupted).toBe(realValue + 250);
      const corruptedResults = {
        ...results,
        [`Purchases.xlsx!${month}`]: { ...results[`Purchases.xlsx!${month}`], AD1: corrupted },
      };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, taxDataForFixedAssets, calculateExpectedTax);
      expect(failureNames(corruptedChecks)).toEqual([`Purchases.xlsx ${month}: CIS tax withheld reaches the certificates column (AD1)`]);
    });

    // ── CIS suffered (Sales.xlsx columns W and X) ──────────────────────────
    //
    // This trader is nobody's sub-contractor, so both columns stand at nil
    // all year. That is the state the return has to reach honestly: the
    // corruption below moves one cached cell and the check reading it is the
    // only one that turns.

    it("the sales journal's own CIS columns are read on every month", () => {
      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      expect(checks.filter((c) => c.name.includes("CIS suffered reaches the sub-contractor column"))).toHaveLength(12);
      expect(checks.filter((c) => c.name.includes("CIS suffered for the year to date"))).toHaveLength(12);
      expect(checks.filter((c) => c.name.includes("CIS suffered") && !c.pass)).toEqual([]);
    });

    it("fails only the year-to-date check for the month whose cached running total is corrupted", async () => {
      const month = "Mar";
      const corrupted = await readCorruptedCell(join(saveDir, "Sales.xlsx"), month, "X1", 200);
      expect(corrupted).toBe(200);
      const corruptedResults = { ...results, [`Sales.xlsx!${month}`]: { ...results[`Sales.xlsx!${month}`], X1: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, taxDataForFixedAssets, calculateExpectedTax);
      expect(failureNames(corruptedChecks)).toEqual([`Sales.xlsx ${month}: CIS suffered for the year to date (X1)`]);
    });

    it("fails only the month's own check when its cached column total is corrupted", async () => {
      const month = "Jun";
      const corrupted = await readCorruptedCell(join(saveDir, "Sales.xlsx"), month, "W1", 350);
      expect(corrupted).toBe(350);
      const corruptedResults = { ...results, [`Sales.xlsx!${month}`]: { ...results[`Sales.xlsx!${month}`], W1: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, taxDataForFixedAssets, calculateExpectedTax);
      expect(failureNames(corruptedChecks)).toEqual([`Sales.xlsx ${month}: CIS suffered reaches the sub-contractor column (W1)`]);
    });

    it("VAT Q5 (the straddling period) is read and its box identities hold on the intact book", () => {
      const qtr = results["Vat.xlsx!VATQtr5"];
      expect(qtr).toBeDefined();
      expect(qtr.G5).toBeGreaterThan(0);

      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      expect(checks.find((c) => c.name === "VAT Q5: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11)").pass).toBe(true);
      expect(checks.find((c) => c.name === "VAT Q5: box 5 net due (G17) = box 3 (G13) - box 4 (G15)").pass).toBe(true);
    });

    // ── Customer-facing invoice: VAT rate and the sample line's arithmetic ──
    // Salesinvoice.xlsx carries no external link into the rest of the book,
    // so a wrong figure here never reaches the accounts -- it reaches the
    // customer's customer. taxDataForFixedAssets stands in for the tax-year
    // data reconcile.js hands checkCompliance in production.

    it("writes the tax year's standard rate into the sample product row and computes the line correctly", () => {
      const productDetails = results["Salesinvoice.xlsx!Product Details"];
      const invoice = results["Salesinvoice.xlsx!Invoice Template"];
      expect(productDetails.D2).toBe(20);
      // The scenario's first sale (Beta Systems, Apr, 1200) is the sample
      // invoice's one line, quantity 1, plus a sample carriage charge of
      // 37.5 taxed at the same standard rate: carriage VAT 7.5, VAT total
      // 240 + 7.5 = 247.5, gross 1200 + 37.5 + 247.5 = 1485.
      expect(invoice.P58).toBe(1200);
      expect(invoice.V38).toBeCloseTo(240, 6);
      expect(invoice.P60).toBeCloseTo(37.5, 6);
      expect(invoice.P62).toBeCloseTo(247.5, 6);
      expect(invoice.P64).toBeCloseTo(1485, 6);

      const checks = seCheckCompliance(results, mergedExpected, taxDataForFixedAssets, calculateExpectedTax);
      const names = [
        "Salesinvoice Product Details: VAT Rate = the tax year's standard rate",
        "Salesinvoice: line VAT = price x quantity x the tax year's standard rate",
        "Salesinvoice: net total = the invoice's one line",
        "Salesinvoice: carriage charge lands on the invoice",
        "Salesinvoice: VAT total = line VAT plus carriage VAT at the tax year's standard rate",
        "Salesinvoice: amount payable = net plus carriage plus VAT",
      ];
      for (const name of names) {
        const check = checks.find((c) => c.name === name);
        expect(check, name).toBeDefined();
        expect(check.pass, name).toBe(true);
      }
    });

    it.each([
      [
        "Salesinvoice Product Details: VAT Rate = the tax year's standard rate",
        "Salesinvoice.xlsx!Product Details",
        "Product Details",
        "D2",
        17.5,
      ],
      [
        "Salesinvoice: line VAT = price x quantity x the tax year's standard rate",
        "Salesinvoice.xlsx!Invoice Template",
        "Invoice Template",
        "V38",
        0,
      ],
      ["Salesinvoice: net total = the invoice's one line", "Salesinvoice.xlsx!Invoice Template", "Invoice Template", "P58", 0],
      ["Salesinvoice: carriage charge lands on the invoice", "Salesinvoice.xlsx!Invoice Template", "Invoice Template", "P60", 0],
      [
        "Salesinvoice: VAT total = line VAT plus carriage VAT at the tax year's standard rate",
        "Salesinvoice.xlsx!Invoice Template",
        "Invoice Template",
        "P62",
        0,
      ],
      ["Salesinvoice: amount payable = net plus carriage plus VAT", "Salesinvoice.xlsx!Invoice Template", "Invoice Template", "P64", 0],
    ])("fails only %s when %s is corrupted via JSZip", async (checkName, resultKey, sheetName, cellRef, newValue) => {
      const corrupted = await readCorruptedCell(join(saveDir, "Salesinvoice.xlsx"), sheetName, cellRef, newValue);
      const corruptedResults = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, taxDataForFixedAssets, calculateExpectedTax);
      expect(failureNames(corruptedChecks)).toEqual([checkName]);
    });
  },
  300000,
);
