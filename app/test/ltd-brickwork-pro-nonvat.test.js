// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd-brickwork-pro-nonvat.test.js — E2E test for the Ltd package with the
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
  cellWrites as ltdCellWrites,
  standardReads as ltdReads,
  multiFileOptions as ltdMultiFileOptions,
  checkCompliance as ltdCheckCompliance,
  vatRateFor,
} from "../products/ltd.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

// Overwrites a cell's cached <v> content in place, leaving any <f> formula
// tag untouched, then reads the cell back out of the round-tripped archive --
// the way a stale or corrupted cached value reaches a reader.
async function readCorruptedCell(savedDir, fileName, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(readFileSync(resolve(savedDir, fileName)));
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
  "Ltd Company: BrickWork Pro non-VAT scenario",
  () => {
    let results;
    let scenario;
    let expected;
    let taxData;
    let savedDir;

    beforeAll(async () => {
      taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2025.toml"), "utf8"));
      const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));

      const fileBuffers = {};
      for (const templateFile of productMeta.template.files) {
        const templatePath = resolve(LTD_DIR, templateFile);
        const templateBuffer = readFileSync(templatePath);
        const fileKey = templateFile.replace(".xlsx", "").replace(".docx", "").toLowerCase();
        const sheetsConfig = productMeta.sheets?.[fileKey];
        if (sheetsConfig && Object.keys(sheetsConfig).length > 0) {
          fileBuffers[templateFile] = await generateSpreadsheet(templateBuffer, taxData, sheetsConfig);
        } else {
          fileBuffers[templateFile] = templateBuffer;
        }
      }

      scenario = loadScenario(resolve(FIXTURES_DIR, "ltd-brickwork-pro-nonvat.toml"));
      expected = { ...scenario, ...scenario.expected };
      savedDir = mkdtempSync(join(tmpdir(), "ltd-brickwork-pro-nonvat-"));
      results = await runMultiFileSpreadsheet(fileBuffers, ltdCellWrites(scenario, 2025, 3), ltdReads(), "Financialaccounts.xlsx", {
        ...ltdMultiFileOptions(3),
        saveRecalculatedTo: savedDir,
      });
    }, 900000);

    afterAll(() => {
      if (savedDir) rmSync(savedDir, { recursive: true, force: true });
    });

    it("MnthP&L: sales turnover is the journal at face value", () => {
      expect(results["MnthP&L"].B9).toBe(75000);
    });

    it("MnthP&L: gross profit > 0", () => {
      expect(results["MnthP&L"].B16).toBeGreaterThan(0);
    });

    it("MnthP&L: operating profit > 0", () => {
      expect(results["MnthP&L"].B43).toBeGreaterThan(0);
    });

    it("MnthP&L: profit before tax > 0", () => {
      expect(results["MnthP&L"].B45).toBeGreaterThan(0);
    });

    it("Sales and Purchases charge no VAT on any month", () => {
      for (const tab of ["Apr", "Jul", "Oct", "Mar"]) {
        expect(results[`Sales.xlsx!${tab}`].G2).toBe(0);
        expect(results[`Purchases.xlsx!${tab}`].G2).toBe(0);
        expect(results[`Sales.xlsx!${tab}`].G1).toBe(0);
        expect(results[`Purchases.xlsx!${tab}`].G1).toBe(0);
      }
    });

    it("every VAT quarter returns nil", () => {
      for (const quarter of [1, 2, 3, 4]) {
        const boxes = results[`Vatreturns.xlsx!VATQtr${quarter}`];
        expect(boxes.G9).toBe(0);
        expect(boxes.G15).toBe(0);
        expect(boxes.G17).toBe(0);
      }
    });

    it("CorporationTax: the van's annual investment allowance leaves no tax to pay", () => {
      expect(results["CorporationTax"].K20).toBe(12000);
      expect(results["CorporationTax"].K35).toBe(0);
    });

    it("CorporationTax: profit within small profits rate", () => {
      expect(results["CorporationTax"].K28).toBeLessThan(50000);
    });

    it("passes every compliance check on the intact book", () => {
      const failures = ltdCheckCompliance(results, expected, taxData, calculateExpectedTax).filter(
        (c) => !c.pass && c.severity !== "warning",
      );
      expect(failures.map((c) => c.name)).toEqual([]);
    });

    it("fails the VAT rate read when a month's rate cell is corrupted back to 20 via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Sales.xlsx", "Jul", "G2", 20);
      expect(value).toBe(20);
      const corrupted = { ...results, "Sales.xlsx!Jul": { ...results["Sales.xlsx!Jul"], G2: value } };
      const failures = ltdCheckCompliance(corrupted, expected, taxData, calculateExpectedTax).filter(
        (c) => !c.pass && c.severity !== "warning",
      );
      expect(failures.map((c) => c.name)).toEqual(["Sales.xlsx Jul: VAT rate charged (G2)"]);
    });

    it("fails the year's output VAT when a month starts charging VAT again, corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Sales.xlsx", "Jul", "G1", 1000);
      expect(value).toBe(1000);
      const corrupted = { ...results, "Sales.xlsx!Jul": { ...results["Sales.xlsx!Jul"], G1: value } };
      const failures = ltdCheckCompliance(corrupted, expected, taxData, calculateExpectedTax).filter(
        (c) => !c.pass && c.severity !== "warning",
      );
      expect(failures.map((c) => c.name)).toEqual([
        "VAT: Q1-Q4 box 1 = Sales VAT",
        "VAT: annual output VAT",
        "VAT: annual output VAT = the sales journal at the book's rate",
        "Vatinterface F9: Jul output VAT = Sales.xlsx Jul",
      ]);
    });

    // The form leaves its trading profits box blank against a loss, so the
    // corruption goes on the working sheet the box reads: turn the loss into a
    // profit there and the box that stayed blank is no longer right.
    it("fails the CT600 trading profits box when the working sheet's loss is corrupted into a profit via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CorporationTax", "K22", 5000);
      expect(value).toBe(5000);
      const corrupted = { ...results, CorporationTax: { ...results.CorporationTax, K22: value } };
      const failures = ltdCheckCompliance(corrupted, expected, taxData, calculateExpectedTax).filter(
        (c) => !c.pass && c.severity !== "warning",
      );
      expect(failures.map((c) => c.name)).toEqual([
        "CT: profit after capital allowances",
        "CT: chargeable profit = profit after allowances + interest - losses brought forward",
        "CT600: trading profits = CT profit after capital allowances",
      ]);
    });
  },
  900000,
);

// The registration flag has to reach the workbook, or the two scenarios drive
// the books identically -- which is what they used to do. This runs no
// spreadsheet: it reads the cell writes the two fixtures produce.
describe("Ltd Company: the BrickWork Pro twins ask for different VAT rates", () => {
  const nonVat = loadScenario(resolve(FIXTURES_DIR, "ltd-brickwork-pro-nonvat.toml"));
  const vat = loadScenario(resolve(FIXTURES_DIR, "ltd-brickwork-pro-vat.toml"));

  it("reads the rate off the scenario's own metadata", () => {
    expect(vatRateFor(nonVat)).toBe(0);
    expect(vatRateFor(vat)).toBe(0.2);
  });

  it("zeroes the first month's rate cell for the twin that is not registered", () => {
    expect(ltdCellWrites(nonVat, 2025, 3)["Sales.xlsx"].Apr.G2).toBe(0);
    expect(ltdCellWrites(nonVat, 2025, 9)["Sales.xlsx"].Oct.G2).toBe(0);
  });

  it("leaves the rate cell alone for the twin that is registered", () => {
    expect(ltdCellWrites(vat, 2025, 3)["Sales.xlsx"].Apr).not.toHaveProperty("G2");
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
