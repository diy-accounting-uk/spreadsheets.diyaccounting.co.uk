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
  zip.file(sheetPath, xml.replace(pattern, (_m, pre, _old, post) => `${pre}${newValue}${post}`));

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
      results = await runMultiFileSpreadsheet(fileBuffers, seCellWrites(scenario), seReads(), "Financialaccounts.xlsx", {
        ...seMultiFileOptions(),
        saveRecalculatedTo: savedDir,
      });
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

  it("carries the same trade, one journal VAT-inclusive and one not", () => {
    const total = (journal) =>
      Object.values(journal)
        .flat()
        .reduce((sum, tx) => sum + tx.amount, 0);
    expect(total(nonVat.sales)).toBe(75000);
    expect(total(vat.sales)).toBe(90000);
  });

  // The two fixtures only mean anything as a pair: same trade, same dates,
  // same codes, one journal stated including VAT and one without. Comparing
  // them line by line is what stops an edit to one of them drifting away
  // from the other.
  it("matches the twins line by line, entry for entry", () => {
    for (const journal of ["sales", "purchases"]) {
      const plain = Object.entries(nonVat[journal]);
      expect(plain.length).toBe(Object.keys(vat[journal]).length);
      for (const [month, entries] of plain) {
        const withVat = vat[journal][month];
        expect(withVat, `${journal}.${month}`).toHaveLength(entries.length);
        entries.forEach((tx, i) => {
          const twin = withVat[i];
          const where = `${journal}.${month}[${i}]`;
          expect(twin.date.getTime(), where).toBe(tx.date.getTime());
          expect(twin.code, where).toBe(tx.code);
          expect(twin.amount, where).toBeCloseTo(tx.amount * 1.2, 2);
        });
      }
    }
  });
});
