// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// payslips-print-sheet-checks.test.js — The Payslips sheet is the payslip an
// employer prints and hands over. It joins itself to a month tab through H3
// (the tab's name) and H4 (the row its block starts on), and every printed
// field is an INDIRECT through that pair. Nothing downstream reads the page,
// so this proves two things against a real recalculated package: the join
// resolves at all, and each check on it breaks when the cached value it reads
// is corrupted.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, mkdtempSync } from "fs";
import { resolve, dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { runMultiFileSpreadsheet, hasLibreOffice, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadScenario } from "../lib/scenario-loader.js";
import {
  cellWrites as seCellWrites,
  standardReads as seReads,
  multiFileOptions as seOptions,
  checkCompliance as seCheckCompliance,
} from "../products/se.js";
import {
  cellWrites as ltdCellWrites,
  standardReads as ltdReads,
  multiFileOptions as ltdOptions,
  checkCompliance as ltdCheckCompliance,
} from "../products/ltd.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const SE_DIR = resolve(APP_DIR, "templates", "se");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");
const LTD_YEAR_END_MONTH = 3;

const PRINT_SHEET = "Payslips";
const PRINT_RESULT_KEY = "Payslips.xlsx!Payslips";

// The four checks the printed page carries, keyed by the cached value each
// one reads. Corrupting that value must flip that check and no other.
const PRINT_CHECKS = {
  H3: "Payslips print: the page reads the May tab",
  L7: "Payslips print: the block the page reads is a monthly payroll",
  I10: "Payslips print: the period printed is payroll month 2",
  I9: "Payslips print: the period ends the day the scenario paid that month's wages",
};

function corruptCellValue(xml, cellRef, newValue) {
  const pattern = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v>)([^<]*)(</v>)`, "s");
  if (!pattern.test(xml)) throw new Error(`corruptCellValue: cell ${cellRef} not found in sheet XML`);
  return xml.replace(pattern, (_match, pre, _old, post) => `${pre}${newValue}${post}`);
}

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

describeCalc(
  "Self Employed printed payslip: the month-tab join",
  () => {
    let results;
    let expected;
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

      const scenario = loadScenario(resolve(FIXTURES_DIR, "se-scenario-advanced.toml"));
      expected = { ...scenario, ...scenario.expected };

      saveDir = mkdtempSync(join(tmpdir(), "payslips-print-checks-"));
      results = await runMultiFileSpreadsheet(fileBuffers, seCellWrites(scenario), seReads(), "Financialaccounts.xlsx", {
        ...seOptions(),
        saveRecalculatedTo: saveDir,
      });
    }, 300000);

    it("the recalculated page holds no error cells", async () => {
      const zip = await JSZip.loadAsync(readFileSync(join(saveDir, "Payslips.xlsx")));
      const sheetMap = await buildSheetMap(zip);
      const xml = await zip.file(sheetMap.get(PRINT_SHEET)).async("string");
      const errorCells = [...xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*\bt="e"/g)].map((m) => m[1]);
      expect(errorCells).toEqual([]);
    });

    it("the join names the month tab and the block the asked-for period sits on", () => {
      const printed = results[PRINT_RESULT_KEY];
      expect(printed.H3).toBe("May");
      expect(printed.L7).toBe("MONTHLY PAYROLL");
      expect(printed.I10).toBe(2);
      expect(printed.H4).toBe(48);
    });

    it("every print check passes on the intact book", () => {
      const checks = seCheckCompliance(results, expected, null, undefined);
      for (const name of Object.values(PRINT_CHECKS)) {
        const check = checks.find((c) => c.name === name);
        expect(check, name).toBeDefined();
        expect(check.pass, name).toBe(true);
      }
    });

    it.each([
      ["H3", "Apr"],
      ["L7", "WEEKLY PAYROLL"],
      ["I10", 1],
      ["I9", 40000],
    ])("corrupting the cached %s fails its own check and no other", async (cellRef, newValue) => {
      const intactFailures = failureNames(seCheckCompliance(results, expected, null, undefined));
      const corrupted = await readCorruptedCell(join(saveDir, "Payslips.xlsx"), PRINT_SHEET, cellRef, newValue);
      const corruptedResults = {
        ...results,
        [PRINT_RESULT_KEY]: { ...results[PRINT_RESULT_KEY], [cellRef]: corrupted },
      };
      const failures = failureNames(seCheckCompliance(corruptedResults, expected, null, undefined));
      expect(failures.filter((name) => !intactFailures.includes(name))).toEqual([PRINT_CHECKS[cellRef]]);
    });
  },
  600000,
);

describeCalc(
  "Limited Company printed payslip: the month-tab join",
  () => {
    let results;
    let expected;
    let taxData;
    let saveDir;

    const checksFor = (r) => ltdCheckCompliance(r, expected, taxData, calculateExpectedTax);

    beforeAll(async () => {
      taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2025.toml"), "utf8"));
      const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));

      const fileBuffers = {};
      for (const templateFile of productMeta.template.files) {
        const templateBuffer = readFileSync(resolve(LTD_DIR, templateFile));
        const fileKey = templateFile.replace(".xlsx", "").replace(".docx", "").toLowerCase();
        const sheetsConfig = productMeta.sheets?.[fileKey];
        fileBuffers[templateFile] =
          sheetsConfig && Object.keys(sheetsConfig).length > 0
            ? await generateSpreadsheet(templateBuffer, taxData, sheetsConfig)
            : templateBuffer;
      }

      const scenario = loadScenario(resolve(FIXTURES_DIR, "ltd-scenario-full.toml"));
      expected = { ...scenario, ...scenario.expected };

      saveDir = mkdtempSync(join(tmpdir(), "ltd-payslips-print-checks-"));
      results = await runMultiFileSpreadsheet(
        fileBuffers,
        ltdCellWrites(scenario, 2025, LTD_YEAR_END_MONTH),
        ltdReads(),
        "Financialaccounts.xlsx",
        { ...ltdOptions(LTD_YEAR_END_MONTH), saveRecalculatedTo: saveDir },
      );
    }, 900000);

    it("the recalculated page holds no error cells", async () => {
      const zip = await JSZip.loadAsync(readFileSync(join(saveDir, "Payslips.xlsx")));
      const sheetMap = await buildSheetMap(zip);
      const xml = await zip.file(sheetMap.get(PRINT_SHEET)).async("string");
      const errorCells = [...xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*\bt="e"/g)].map((m) => m[1]);
      expect(errorCells).toEqual([]);
    });

    it("the join names the month tab and the block the asked-for period sits on", () => {
      const printed = results[PRINT_RESULT_KEY];
      expect(printed.H3).toBe("May");
      expect(printed.L7).toBe("MONTHLY PAYROLL");
      expect(printed.I10).toBe(2);
      expect(printed.H4).toBe(48);
    });

    it("every print check passes on the intact book", () => {
      const checks = checksFor(results);
      for (const name of Object.values(PRINT_CHECKS)) {
        const check = checks.find((c) => c.name === name);
        expect(check, name).toBeDefined();
        expect(check.pass, name).toBe(true);
      }
    });

    it.each([
      ["H3", "Apr"],
      ["L7", "WEEKLY PAYROLL"],
      ["I10", 1],
      ["I9", 40000],
    ])("corrupting the cached %s fails its own check and no other", async (cellRef, newValue) => {
      const intactFailures = failureNames(checksFor(results));
      const corrupted = await readCorruptedCell(join(saveDir, "Payslips.xlsx"), PRINT_SHEET, cellRef, newValue);
      const corruptedResults = {
        ...results,
        [PRINT_RESULT_KEY]: { ...results[PRINT_RESULT_KEY], [cellRef]: corrupted },
      };
      const failures = failureNames(checksFor(corruptedResults));
      expect(failures.filter((name) => !intactFailures.includes(name))).toEqual([PRINT_CHECKS[cellRef]]);
    });
  },
  900000,
);
