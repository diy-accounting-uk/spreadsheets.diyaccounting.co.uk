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
import { loadScenario } from "../lib/scenario-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import {
  cellWrites as seCellWrites,
  standardReads as seReads,
  multiFileOptions as seOptions,
  checkCompliance as seCheckCompliance,
} from "../products/se.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const SE_DIR = resolve(APP_DIR, "templates", "se");
const DATA_DIR = resolve(APP_DIR, "data");
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
      const writes = seCellWrites(scenario);
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
      expect(results["Sales.xlsx!ClosingDebtors"].G1).toBe(10400);
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
      ["Fixed assets: closing NBV = cost - acc dep c/f (Schedule)", "Schedule", "K1"],
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

    // ── Bank (item 6): Bank.xlsx closing balance vs the scenario's own
    // cash movements. Cash.xlsx is proven directly here (JSZip reads, not
    // through checkCompliance) -- see se.js's multiFileOptions() comment
    // for why Cash.xlsx's closing balance cannot be shipped as a
    // checkCompliance() check with the current runner.

    it("Bank.xlsx closing balance carries a real non-zero signal", () => {
      expect(results["Bank.xlsx!Mar"].A2).not.toBe(0);
    });

    it("Bank.xlsx closing balance (Mar!A2) passes on the intact book and fails when corrupted", async () => {
      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      const check = checks.find((c) => c.name === "Bank.xlsx closing balance (Mar!A2)");
      expect(check).toBeDefined();
      expect(check.pass).toBe(true);

      const corrupted = await readCorruptedCell(join(saveDir, "Bank.xlsx"), "Mar", "A2", results["Bank.xlsx!Mar"].A2 + 5000);
      const corruptedResults = { ...results, "Bank.xlsx!Mar": { ...results["Bank.xlsx!Mar"], A2: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      const corruptedCheck = corruptedChecks.find((c) => c.name === "Bank.xlsx closing balance (Mar!A2)");
      expect(corruptedCheck.pass).toBe(false);
    });

    it("Cash.xlsx closing balance matches the scenario's own petty cash movements", async () => {
      let openingBC = 0;
      let receipts = 0;
      let payments = 0;
      for (const transactions of Object.values(mergedExpected.bank)) {
        for (const tx of transactions) {
          if (tx.account !== "1220") continue;
          if (tx.code === "BC") openingBC += tx.amount;
          else if (tx.direction === "in") receipts += tx.amount;
          else if (tx.direction === "out") payments += tx.amount;
        }
      }
      const expectedClosing = openingBC + receipts - payments;
      expect(expectedClosing).not.toBe(0);

      const zip = await JSZip.loadAsync(readFileSync(join(saveDir, "Cash.xlsx")));
      const sheetMap = await buildSheetMap(zip);
      const sharedStrings = await loadSharedStrings(zip);
      const xml = await zip.file(sheetMap.get("Mar")).async("string");
      const actualClosing = readCellValue(xml, "A2", sharedStrings);
      expect(actualClosing).toBe(expectedClosing);

      const corrupted = await readCorruptedCell(join(saveDir, "Cash.xlsx"), "Mar", "A2", actualClosing + 500);
      expect(corrupted).not.toBe(expectedClosing);
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

    it("VAT Q1-Q4 box values tie to the scenario when the package's year end is a year after the fixture's", () => {
      // Every SE package but the one matching the fixture's own year runs
      // this way: the book carries its own quarter dates while cellWrites
      // copies the scenario's base-year transaction dates straight through.
      // Advancing only the quarter dates is exactly that package -- the same
      // book, the same box values, a year later.
      const shifted = { ...results };
      for (let q = 1; q <= 5; q++) {
        const key = `Vat.xlsx!VATQtr${q}`;
        const qtr = results[key];
        shifted[key] = { ...qtr, G5: excelSerialPlusOneYear(qtr.G5), G7: excelSerialPlusOneYear(qtr.G7) };
      }

      const checks = seCheckCompliance(shifted, mergedExpected, null, undefined);
      for (let q = 1; q <= 4; q++) {
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

    it("VAT Q5 (the straddling period) is read and its box identities hold on the intact book", () => {
      const qtr = results["Vat.xlsx!VATQtr5"];
      expect(qtr).toBeDefined();
      expect(qtr.G5).toBeGreaterThan(0);

      const checks = seCheckCompliance(results, mergedExpected, null, undefined);
      expect(checks.find((c) => c.name === "VAT Q5: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11)").pass).toBe(true);
      expect(checks.find((c) => c.name === "VAT Q5: box 5 net due (G17) = box 3 (G13) - box 4 (G15)").pass).toBe(true);
    });
  },
  300000,
);
