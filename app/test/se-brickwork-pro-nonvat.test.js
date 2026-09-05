// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-brickwork-pro-nonvat.test.js — E2E test for the SE package with the
// BrickWork Pro scenario, and the twin it is meant to differ from.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import { resolve, dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { runMultiFileSpreadsheet, hasLibreOffice, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import {
  cellWrites as seCellWrites,
  standardReads as seReads,
  multiFileOptions as seMultiFileOptions,
  checkCompliance as seCheckCompliance,
  vatRateFor,
} from "../products/se.js";
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
// tag untouched, then reads the cell back out of the round-tripped archive --
// the way a stale or corrupted cached value reaches a reader.
async function readCorruptedCell(savedDir, fileName, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(readFileSync(join(savedDir, fileName)));
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheetName);
  if (!sheetPath) throw new Error(`readCorruptedCell: sheet ${sheetName} not found in ${fileName}`);
  const xml = await zip.file(sheetPath).async("string");
  const pattern = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v>)([^<]*)(</v>)`, "s");
  if (!pattern.test(xml)) throw new Error(`readCorruptedCell: cell ${cellRef} carries no cached value`);
  zip.file(
    sheetPath,
    xml.replace(pattern, (_m, pre, _old, post) => `${pre}${newValue}${post}`),
  );

  const reloaded = await JSZip.loadAsync(await zip.generateAsync({ type: "nodebuffer" }));
  const sharedStrings = await loadSharedStrings(reloaded);
  return readCellValue(await reloaded.file(sheetPath).async("string"), cellRef, sharedStrings);
}

describeCalc(
  "Self Employed: BrickWork Pro non-VAT scenario",
  () => {
    let results;
    let scenario;
    let expected;
    let taxData;
    let savedDir;

    beforeAll(async () => {
      taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
      const productMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));

      const fileBuffers = {};
      for (const templateFile of productMeta.template.files) {
        const templateBuffer = readFileSync(resolve(SE_DIR, templateFile));
        const fileKey = templateFile.replace(".xlsx", "").toLowerCase();
        const sheetsConfig = productMeta.sheets?.[fileKey];
        if (sheetsConfig && Object.keys(sheetsConfig).length > 0) {
          fileBuffers[templateFile] = await generateSpreadsheet(templateBuffer, taxData, sheetsConfig);
        } else {
          fileBuffers[templateFile] = templateBuffer;
        }
      }

      scenario = loadScenario(resolve(FIXTURES_DIR, "se-brickwork-pro-nonvat.toml"));
      expected = { ...scenario, ...scenario.expected };
      savedDir = mkdtempSync(join(tmpdir(), "se-brickwork-pro-nonvat-"));
      results = await runMultiFileSpreadsheet(
        fileBuffers,
        seCellWrites(scenario, seTaxYearStart(taxData)),
        seReads(),
        "Financialaccounts.xlsx",
        {
          ...seMultiFileOptions(),
          saveRecalculatedTo: savedDir,
        },
      );
    }, 900000);

    afterAll(() => {
      if (savedDir) rmSync(savedDir, { recursive: true, force: true });
    });

    it("P&L: sales turnover is the journal at face value", () => {
      expect(results["Profit & Loss Account"].B9).toBe(75000);
    });

    it("P&L: gross profit > 0", () => {
      expect(results["Profit & Loss Account"].B19).toBeGreaterThan(0);
    });

    it("P&L: operating profit > 0", () => {
      expect(results["Profit & Loss Account"].B37).toBeGreaterThan(0);
    });

    it("P&L: profit before tax > 0", () => {
      expect(results["Profit & Loss Account"].B39).toBeGreaterThan(0);
    });

    it("Sales and Purchases charge no VAT on any month", () => {
      for (const tab of ["Apr", "Jul", "Oct", "Mar"]) {
        expect(results[`Sales.xlsx!${tab}`].H2).toBe(0);
        expect(results[`Purchases.xlsx!${tab}`].H2).toBe(0);
        expect(results[`Sales.xlsx!${tab}`].H1).toBe(0);
        expect(results[`Purchases.xlsx!${tab}`].H1).toBe(0);
      }
    });

    it("every VAT quarter returns nil", () => {
      for (const quarter of [1, 2, 3, 4]) {
        const boxes = results[`Vat.xlsx!VATQtr${quarter}`];
        expect(boxes.G9).toBe(0);
        expect(boxes.G15).toBe(0);
        expect(boxes.G17).toBe(0);
      }
    });

    it("Income Tax: profit > 0", () => {
      expect(results["Income Tax"].E5).toBeGreaterThan(0);
    });

    it("Income Tax: a profit under the personal allowance leaves nothing to pay", () => {
      expect(results["Income Tax"].E5).toBeLessThan(results["Income Tax"].E6 || 12570);
      expect(results["Income Tax"].E18).toBe(0);
    });

    it("passes every compliance check on the intact book", () => {
      const failures = seCheckCompliance(results, expected, taxData, calculateExpectedTax).filter(
        (c) => !c.pass && c.severity !== "warning",
      );
      expect(failures.map((c) => c.name)).toEqual([]);
    });

    it("fails the VAT rate read when a month's rate cell is corrupted back to 20 via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Sales.xlsx", "Jul", "H2", 20);
      expect(value).toBe(20);
      const corrupted = { ...results, "Sales.xlsx!Jul": { ...results["Sales.xlsx!Jul"], H2: value } };
      const failures = seCheckCompliance(corrupted, expected, taxData, calculateExpectedTax).filter(
        (c) => !c.pass && c.severity !== "warning",
      );
      expect(failures.map((c) => c.name)).toEqual(["Sales.xlsx Jul: VAT rate charged (H2)"]);
    });

    // ── CIS both ways ──────────────────────────────────────────────────
    //
    // The business withholds tax from its sub-contractors and a contractor
    // customer withholds tax from it. The second side only reaches the
    // return through Sales.xlsx: W totals the month, X runs the year, and
    // Income Tax!E12 and SE Full!D231 read the March X. With no CIS-suffered
    // sale in the book every one of those cells is nil and the return agrees
    // with the journals by absence, which is what the fixture's own
    // CIS-suffered sale takes away.

    it("carries the year's CIS suffered from the sales journal to both returns", () => {
      const sufferedInTheYear = Object.values(scenario.sales)
        .flat()
        .reduce((total, tx) => total + (tx.cis_deduction || 0), 0);
      expect(sufferedInTheYear).toBeGreaterThan(0);

      expect(results["Sales.xlsx!Mar"].X1).toBeCloseTo(sufferedInTheYear, 2);
      expect(results["Income Tax"].E12).toBeCloseTo(-sufferedInTheYear, 2);
      expect(results["SE Full"].D231).toBeCloseTo(sufferedInTheYear, 2);
      expect(results["SE Short"].O124).toBeCloseTo(sufferedInTheYear, 2);
    });

    it("fails only the tax-return checks that read the deductions line when it is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Income Tax", "E12", 0);
      expect(value).toBe(0);
      const corrupted = { ...results, "Income Tax": { ...results["Income Tax"], E12: value } };
      const failures = seCheckCompliance(corrupted, expected, taxData, calculateExpectedTax).filter(
        (c) => !c.pass && c.severity !== "warning",
      );
      expect(failures.map((c) => c.name)).toEqual([
        "Tax: Total = IT + CIS deduction line + NI",
        "Tax: CIS deducted (E12) = the year's CIS suffered on the sales journal",
      ]);
    });

    it("fails only the box 81 checks when the full return's own deductions box is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "SE Full", "D231", 0);
      expect(value).toBe(0);
      const corrupted = { ...results, "SE Full": { ...results["SE Full"], D231: value } };
      const failures = seCheckCompliance(corrupted, expected, taxData, calculateExpectedTax).filter(
        (c) => !c.pass && c.severity !== "warning",
      );
      expect(failures.map((c) => c.name)).toEqual([
        "SA103F box 81 contractor deductions taken off: full return (D231) = short return (O124)",
        "SA103F box 81 contractor deductions taken off (D231) = the year's CIS suffered on the sales journal",
      ]);
    });

    it("fails the taxable-income floor when a profit under the allowance is given a taxable figure, corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Income Tax", "E7", 4000);
      expect(value).toBe(4000);
      const corrupted = { ...results, "Income Tax": { ...results["Income Tax"], E7: value } };
      const failures = seCheckCompliance(corrupted, expected, taxData, calculateExpectedTax).filter(
        (c) => !c.pass && c.severity !== "warning",
      );
      expect(failures.map((c) => c.name)).toEqual(["Tax: Taxable = Profit - Allowance"]);
    });
  },
  900000,
);

// The registration flag has to reach the workbook, or the two scenarios drive
// the books identically -- which is what they used to do. This runs no
// spreadsheet: it reads the cell writes the two fixtures produce.
describe("Self Employed: the BrickWork Pro twins ask for different VAT rates", () => {
  const nonVat = loadScenario(resolve(FIXTURES_DIR, "se-brickwork-pro-nonvat.toml"));
  const vat = loadScenario(resolve(FIXTURES_DIR, "se-brickwork-pro-vat.toml"));

  it("reads the rate off the scenario's own metadata", () => {
    expect(vatRateFor(nonVat)).toBe(0);
    expect(vatRateFor(vat)).toBe(0.2);
  });

  it("zeroes April's rate cell for the twin that is not registered", () => {
    expect(seCellWrites(nonVat)["Sales.xlsx"].Apr.H2).toBe(0);
  });

  it("leaves the rate cell alone for the twin that is registered", () => {
    expect(seCellWrites(vat)["Sales.xlsx"].Apr).not.toHaveProperty("H2");
  });

  // Two scenarios that report identical accounts cannot be told apart by
  // anyone reading them, so the registered twin trades at a different size --
  // over the registration threshold, which is why it is registered.
  it("trades at a different size from the twin that is not registered", () => {
    const total = (journal) =>
      Object.values(journal)
        .flat()
        .reduce((sum, tx) => sum + tx.amount, 0);
    expect(total(nonVat.sales)).toBe(75000);
    expect(total(vat.sales)).toBe(135000);
    expect(total(vat.purchases)).toBeGreaterThan(total(nonVat.purchases));
  });

  it("splits each journal at its own rate, and declares the split it expects", () => {
    for (const [scenario, rate] of [
      [nonVat, 0],
      [vat, 0.2],
    ]) {
      const total = (journal) =>
        Object.values(journal)
          .flat()
          .reduce((sum, tx) => sum + tx.amount, 0);
      const vatIn = (gross) => Math.round((gross - gross / (1 + rate)) * 100) / 100;
      expect(scenario.expected.total_sales).toBeCloseTo(total(scenario.sales) / (1 + rate), 2);
      if (scenario.expected.vat_output_total !== undefined) {
        expect(scenario.expected.vat_output_total).toBeCloseTo(vatIn(total(scenario.sales)), 2);
        expect(scenario.expected.vat_input_total).toBeCloseTo(vatIn(total(scenario.purchases)), 2);
      }
    }
  });

  it("keeps the same journal shape on both twins: same months, same dates, same codes", () => {
    for (const journal of ["sales", "purchases"]) {
      const plain = Object.entries(nonVat[journal]);
      expect(plain.length).toBe(Object.keys(vat[journal]).length);
      for (const [month, entries] of plain) {
        const withVat = vat[journal][month];
        expect(withVat, `${journal}.${month}`).toHaveLength(entries.length);
        entries.forEach((tx, i) => {
          const where = `${journal}.${month}[${i}]`;
          expect(withVat[i].date.getTime(), where).toBe(tx.date.getTime());
          expect(withVat[i].code, where).toBe(tx.code);
        });
      }
    }
  });
});
