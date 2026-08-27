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
} from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
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

describeCalc(
  "Self Employed reconciliation checks: whole-book cross-check and debtors/creditors",
  () => {
    let results;
    let scenario;
    let mergedExpected;
    let saveDir;

    beforeAll(async () => {
      const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
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
      expect(results.OpeningDebtors.G1).toBe(10800);
    });

    it("Closing Debtors total reads the real ClosingDebtors!G1 invoice-value sum", () => {
      expect(results.ClosingDebtors.G1).toBe(10400);
    });

    it("Opening Creditors total reads the real OpeningCreditors!G1 invoice-value sum", () => {
      expect(results.OpeningCreditors.G1).toBe(2220);
    });

    it("Closing Creditors total reads the real ClosingCreditors!G1 invoice-value sum", () => {
      expect(results.ClosingCreditors.G1).toBe(1710);
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

      const realValue = results[sheetName].G1;
      const corrupted = await readCorruptedCell(join(saveDir, fileName), sheetName, "G1", realValue + 500);
      const corruptedResults = { ...results, [sheetName]: { ...results[sheetName], G1: corrupted } };
      const corruptedChecks = seCheckCompliance(corruptedResults, mergedExpected, null, undefined);
      const corruptedCheck = corruptedChecks.find((c) => c.name === checkName);
      expect(corruptedCheck.pass).toBe(false);
    });
  },
  300000,
);
