// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd-trial-balance-audit.test.js — Proves the trial balance audit check
// (TrialBalance!EJ91) actually gates on the workbook's own whole-book
// self-check: it passes on a genuinely balanced, recalculated book, and it
// fails when that cell's cached value is corrupted via JSZip, without
// touching anything else in the recalculated results.
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
import { cellWrites as ltdCellWrites, standardReads as ltdReads, checkCompliance as ltdCheckCompliance } from "../products/ltd.js";
import { parse as parseTOML } from "smol-toml";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");
const CHECK_NAME = "Trial Balance: audit accuracy (EJ91)";

describeCalc(
  "Ltd Company: trial balance audit accuracy check (EJ91)",
  () => {
    let results;
    let checks;
    let taxData;
    let scenario;
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

      // BrickWork Pro non-VAT posts no directors-loan movements, so its
      // recalculated trial balance is a genuinely balanced book to test
      // "passes when intact" against.
      scenario = loadScenario(resolve(FIXTURES_DIR, "ltd-brickwork-pro-nonvat.toml"));
      const writes = ltdCellWrites(scenario);
      const reads = ltdReads();

      savedDir = mkdtempSync(join(tmpdir(), "ltd-trial-balance-audit-"));
      results = await runMultiFileSpreadsheet(fileBuffers, writes, reads, "Financialaccounts.xlsx", {
        saveRecalculatedTo: savedDir,
      });
      checks = ltdCheckCompliance(results, { ...scenario, ...scenario.expected }, taxData, calculateExpectedTax);
    }, 300000);

    afterAll(() => {
      rmSync(savedDir, { recursive: true, force: true });
    });

    it("EJ91 reads as (near) zero on a genuinely balanced, recalculated book", () => {
      expect(Math.abs(results.TrialBalance.EJ91)).toBeLessThanOrEqual(1);
    });

    it("passes on the intact book", () => {
      const check = checks.find((c) => c.name === CHECK_NAME);
      expect(check).toBeDefined();
      expect(check.pass).toBe(true);
    });

    it("fails when EJ91's cached value is corrupted via JSZip, all else unchanged", async () => {
      const financialAccountsPath = resolve(savedDir, "Financialaccounts.xlsx");
      const zip = await JSZip.loadAsync(readFileSync(financialAccountsPath));
      const sheetMap = await buildSheetMap(zip);
      const sheetPath = sheetMap.get("TrialBalance");

      let xml = await zip.file(sheetPath).async("string");
      const cellPattern = /(<c\s+r="EJ91"[^>]*>(?:<f[^>]*>[^<]*<\/f>)?)<v>[^<]*<\/v>(<\/c>)/;
      expect(xml).toMatch(cellPattern);
      xml = xml.replace(cellPattern, "$1<v>-1782472</v>$2");

      const corruptedValue = readCellValue(xml, "EJ91");
      expect(corruptedValue).toBe(-1782472);

      const corruptedResults = { ...results, TrialBalance: { ...results.TrialBalance, EJ91: corruptedValue } };
      const corruptedChecks = ltdCheckCompliance(corruptedResults, scenario.expected, taxData, calculateExpectedTax);
      const check = corruptedChecks.find((c) => c.name === CHECK_NAME);

      expect(check).toBeDefined();
      expect(check.pass).toBe(false);
      expect(check.actual).toBe(-1782472);

      // Every other check computed from the same results is untouched --
      // only the corrupted cell's own check flips.
      const otherFailures = corruptedChecks.filter((c) => c.name !== CHECK_NAME && !c.pass && c.severity !== "warning");
      expect(otherFailures).toEqual([]);
    });
  },
  300000,
);
