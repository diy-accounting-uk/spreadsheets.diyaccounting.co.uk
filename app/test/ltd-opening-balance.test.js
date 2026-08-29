// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd-opening-balance.test.js — Proves the opening balance sheet posts and
// reaches the trial balance. An unposted opening balance sheet is still a
// balanced one, so the whole-book check (TrialBalance!EJ91) cannot see it
// missing; these checks gate on the opening balance sheet's own accuracy
// check and on each trial balance row the openings feed. Each is shown to
// fail when its cell's cached value is corrupted via JSZip, with nothing
// else in the recalculated results touched.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import { resolve, dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { runMultiFileSpreadsheet, hasLibreOffice, buildSheetMap, readCellValue } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import {
  cellWrites as ltdCellWrites,
  standardReads as ltdReads,
  checkCompliance as ltdCheckCompliance,
  multiFileOptions as ltdMultiFileOptions,
} from "../products/ltd.js";
import { parse as parseTOML } from "smol-toml";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

const ACCURACY_CHECK = "Opening balance sheet: accuracy check (E37)";
const DIRECTORS_LOAN_OPENING = "Trial Balance opening: directors loan";
const DIRECTORS_LOAN_FINAL = "Trial Balance: directors loan final = opening + movement";

describeCalc(
  "Ltd Company: opening balance sheet",
  () => {
    let results;
    let checks;
    let taxData;
    let expected;
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

      const scenario = loadScenario(resolve(FIXTURES_DIR, "ltd-scenario-full.toml"));
      expected = { ...scenario, ...scenario.expected };

      savedDir = mkdtempSync(join(tmpdir(), "ltd-opening-balance-"));
      results = await runMultiFileSpreadsheet(fileBuffers, ltdCellWrites(scenario), ltdReads(), "Financialaccounts.xlsx", {
        ...ltdMultiFileOptions(3),
        saveRecalculatedTo: savedDir,
      });
      checks = ltdCheckCompliance(results, expected, taxData, calculateExpectedTax);
    }, 300000);

    afterAll(() => {
      rmSync(savedDir, { recursive: true, force: true });
    });

    it("balances its own accuracy check", () => {
      expect(Math.abs(results.OpenAccounts.E37)).toBeLessThanOrEqual(1);
    });

    it("splits fixed assets into cost and accumulated depreciation, netting to book value", () => {
      const oa = results.OpenAccounts;
      expect(oa.E13).toBe(22902);
      expect(results.TrialBalance.D9 + results.TrialBalance.D10).toBe(33000);
      expect(results.TrialBalance.D14 + results.TrialBalance.D15).toBe(-10098);
    });

    it("posts every bank balance into its own trial balance row", () => {
      const tb = results.TrialBalance;
      expect(tb.D22).toBe(25000);
      expect(tb.D23).toBe(5000);
      expect(tb.D25).toBe(500);
      expect(results.OpenAccounts.E18).toBe(30500);
    });

    it("posts stock, debtors and reserves into the trial balance", () => {
      const tb = results.TrialBalance;
      expect(tb.D19).toBe(10000);
      expect(tb.D20).toBe(10800);
      expect(tb.D42).toBe(-100);
      expect(tb.D43).toBe(-20702);
    });

    it("posts the secured bank loan as a creditor falling due after more than one year", () => {
      // D40 is the opening balance sheet column, unaffected by the year's
      // hire purchase agreements. E30 is the year-end published figure,
      // which also carries the two agreements' amounts financed (13,000 +
      // 7,000) through HPfinance!E2 (verified against the template).
      expect(results.TrialBalance.D40).toBe(-25000);
      expect(results.PubBalSht.E30).toBe(45000);
    });

    it("carries the directors loan opening credit into the final balance", () => {
      const tb = results.TrialBalance;
      expect(tb.D39).toBe(-20000);
      expect(tb.EJ39).toBe(-13000);
    });

    it("leaves the whole-book audit check at zero", () => {
      expect(Math.abs(results.TrialBalance.EJ91)).toBeLessThanOrEqual(1);
    });

    it("passes every opening balance check on the intact book", () => {
      const openingChecks = checks.filter((c) => c.name === ACCURACY_CHECK || c.name.startsWith("Trial Balance opening:"));
      expect(openingChecks.length).toBeGreaterThan(10);
      expect(openingChecks.filter((c) => !c.pass)).toEqual([]);
    });

    it("fails the accuracy check when E37's cached value is corrupted via JSZip", async () => {
      const corruptedValue = await corruptCell(savedDir, "OpenAccounts", "E37", 1815);
      const corrupted = { ...results, OpenAccounts: { ...results.OpenAccounts, E37: corruptedValue } };
      const corruptedChecks = ltdCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);

      const check = corruptedChecks.find((c) => c.name === ACCURACY_CHECK);
      expect(check.pass).toBe(false);
      expect(check.actual).toBe(1815);
      expect(failureNames(corruptedChecks)).toEqual([ACCURACY_CHECK]);
    });

    it("fails the directors loan opening check when D39's cached value is corrupted via JSZip", async () => {
      const corruptedValue = await corruptCell(savedDir, "TrialBalance", "D39", 0);
      const corrupted = { ...results, TrialBalance: { ...results.TrialBalance, D39: corruptedValue } };
      const corruptedChecks = ltdCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);

      const check = corruptedChecks.find((c) => c.name === DIRECTORS_LOAN_OPENING);
      expect(check.pass).toBe(false);
      expect(check.actual).toBe(0);
      // The final balance is measured against the opening plus the year's
      // movement, so zeroing the opening moves that check too.
      expect(failureNames(corruptedChecks)).toEqual([DIRECTORS_LOAN_OPENING, DIRECTORS_LOAN_FINAL]);
    });

    it("fails the bank opening check when D22's cached value is corrupted via JSZip", async () => {
      const corruptedValue = await corruptCell(savedDir, "TrialBalance", "D22", 0);
      const corrupted = { ...results, TrialBalance: { ...results.TrialBalance, D22: corruptedValue } };
      const corruptedChecks = ltdCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);

      const check = corruptedChecks.find((c) => c.name === "Trial Balance opening: bank current account");
      expect(check.pass).toBe(false);
      expect(check.actual).toBe(0);
      expect(failureNames(corruptedChecks)).toEqual(["Trial Balance opening: bank current account"]);
    });
  },
  300000,
);

function failureNames(checks) {
  return checks.filter((c) => !c.pass && c.severity !== "warning").map((c) => c.name);
}

// Replace one cell's cached value in a saved, recalculated workbook and read
// the replacement back, so the corruption is proven to have landed.
async function corruptCell(savedDir, sheetName, cellRef, value) {
  const zip = await JSZip.loadAsync(readFileSync(resolve(savedDir, "Financialaccounts.xlsx")));
  const sheetMap = await buildSheetMap(zip);
  const xml = await zip.file(sheetMap.get(sheetName)).async("string");

  const cellPattern = new RegExp(`(<c\\s+r="${cellRef}"[^>]*>(?:<f[^>]*>[^<]*</f>)?)<v>[^<]*</v>(</c>)`);
  expect(xml).toMatch(cellPattern);
  const corrupted = xml.replace(cellPattern, `$1<v>${value}</v>$2`);

  const readBack = readCellValue(corrupted, cellRef);
  expect(readBack).toBe(value);
  return readBack;
}
