// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-admin-echo-checks.test.js — Proves the SE Admin echo checkCompliance
// additions actually catch a broken workbook: the generator injects the tax
// year's personal allowance, income tax rates and band ends, Class 2/4 NI
// figures, capital allowance rates, mileage bands and VAT threshold/rate into
// Financialaccounts.xlsx!Admin (see buildSeCellEdits() in
// app/lib/generator.js), and every leaf workbook in the package reads from
// there. Before this addition nothing read the cells back, so a wrong rate
// was arithmetically invisible -- the same failure shape as the
// shipped-zeros VAT bug. BST, Taxi and Ltd already carry this check; SE was
// the one product without it (SHEET_COVERAGE_GAPS.md, "Largest gaps by
// risk" item 1).
//
// Each check is exercised on a real LibreOffice-recalculated multi-file
// package, then again after corrupting one Admin cell's cached value
// directly in a copy of Financialaccounts.xlsx via JSZip -- proving the
// check fails on a broken workbook and passes on an intact one, without
// needing a second LibreOffice pass.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

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
// reader that only ever sees the last-saved cell.
function corruptCellValue(xml, cellRef, newValue) {
  const pattern = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v>)([^<]*)(</v>)`, "s");
  if (!pattern.test(xml)) throw new Error(`corruptCellValue: cell ${cellRef} not found in sheet XML`);
  return xml.replace(pattern, (_match, pre, _old, post) => `${pre}${newValue}${post}`);
}

// Loads a recalculated package file via JSZip, overwrites one cell's cached
// value, round-trips the archive and reads the cell back -- a real mutation
// of a copy of the workbook, not a string edit on the in-memory results.
async function readCorruptedCell(savedDir, fileName, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(readFileSync(resolve(savedDir, fileName)));
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheetName);
  if (!sheetPath) throw new Error(`readCorruptedCell: sheet ${sheetName} not found in ${fileName}`);
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

const ADMIN_ECHO_CHECK_NAMES = [
  "Admin: Personal Allowance = tax data",
  "Admin: Basic Rate = tax data",
  "Admin: Higher Rate = tax data",
  "Admin: Basic Band End = tax data",
  "Admin: Higher Band Start = tax data",
  "Admin: NI Class 2 Weekly Rate = tax data",
  "Admin: NI Class 4 Lower Rate = tax data",
  "Admin: NI Class 4 Lower Limit = tax data",
  "Admin: NI Class 4 Upper Rate = tax data",
  "Admin: NI Class 4 Upper Limit = tax data",
  "Admin: AIA Rate = tax data",
  "Admin: WDA Rate = tax data",
  "Admin: Motor Vehicle Cost Threshold = tax data",
  "Admin: Motor Vehicle Restriction = tax data",
  "Admin: Mileage Higher Rate Limit = tax data",
  "Admin: Mileage Higher Rate Pence = tax data",
  "Admin: Mileage Lower Rate Start = tax data",
  "Admin: Mileage Lower Rate Pence = tax data",
  "Admin: VAT Registration Threshold = tax data",
  "Admin: VAT Standard Rate = tax data",
];

describeCalc("SE Admin echo catches a broken workbook", () => {
  let results;
  let checks;
  let taxData;
  let expected;
  let savedDir;

  function checksWithCorruptedCell(resultKey, cellRef, value) {
    const corrupted = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: value } };
    return seCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);
  }

  beforeAll(async () => {
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
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

    savedDir = mkdtempSync(join(tmpdir(), "se-admin-echo-checks-"));
    results = await runMultiFileSpreadsheet(fileBuffers, seCellWrites(scenario), seReads(), "Financialaccounts.xlsx", {
      ...seOptions(),
      saveRecalculatedTo: savedDir,
    });
    checks = seCheckCompliance(results, expected, taxData, calculateExpectedTax);
  }, 300000);

  afterAll(() => {
    if (savedDir) rmSync(savedDir, { recursive: true, force: true });
  });

  it("reads the Admin sheet at all -- a prerequisite the checks below depend on", () => {
    expect(results.Admin).toBeDefined();
    expect(results.Admin.N4).toBeGreaterThan(0);
  });

  it("passes all twenty Admin echo checks on the intact book", () => {
    for (const name of ADMIN_ECHO_CHECK_NAMES) {
      const check = checks.find((c) => c.name === name);
      expect(check, `missing check: ${name}`).toBeDefined();
      expect(check.pass, `${name}: expected ${check.expected}, actual ${check.actual}`).toBe(true);
      // NI Class 2 Weekly Rate is genuinely zero in the 2025-26 tax data
      // (Class 2 was abolished for most self-employed traders); every other
      // cell's tax-data value is non-zero, so this still proves each check
      // isn't a 0 = 0 pass that a broken sheet would sail through too.
      if (name !== "Admin: NI Class 2 Weekly Rate = tax data") {
        expect(check.expected, `${name}: tax-data value was zero, so this check cannot prove anything`).not.toBe(0);
      }
    }
  });

  it.each([
    ["Admin: Personal Allowance = tax data", "N4", 1],
    ["Admin: Basic Rate = tax data", "N6", 0.5],
    ["Admin: Higher Rate = tax data", "N7", 0.5],
    ["Admin: Basic Band End = tax data", "M11", 1],
    ["Admin: Higher Band Start = tax data", "N12", 1],
    ["Admin: NI Class 4 Lower Rate = tax data", "L20", 0.5],
    ["Admin: NI Class 4 Lower Limit = tax data", "N20", 1],
    ["Admin: NI Class 4 Upper Rate = tax data", "L23", 0.5],
    ["Admin: NI Class 4 Upper Limit = tax data", "N23", 1],
    ["Admin: AIA Rate = tax data", "G4", 0.5],
    ["Admin: WDA Rate = tax data", "G5", 0.5],
    ["Admin: Motor Vehicle Cost Threshold = tax data", "E8", 1],
    ["Admin: Motor Vehicle Restriction = tax data", "G8", 1],
    ["Admin: Mileage Higher Rate Limit = tax data", "F21", 1],
    ["Admin: Mileage Higher Rate Pence = tax data", "G21", 0.99],
    ["Admin: Mileage Lower Rate Start = tax data", "F22", 1],
    ["Admin: Mileage Lower Rate Pence = tax data", "G22", 0.99],
    ["Admin: VAT Registration Threshold = tax data", "F26", 1],
    ["Admin: VAT Standard Rate = tax data", "F27", 0.99],
  ])("%s fails, and only that check fails, when Admin!%s is corrupted via JSZip", async (checkName, cellRef, corruptedValue) => {
    const intact = checks.find((c) => c.name === checkName);
    expect(intact.pass).toBe(true);

    const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Admin", cellRef, corruptedValue);
    expect(value).toBe(corruptedValue);
    const corrupted = checksWithCorruptedCell("Admin", cellRef, value);
    expect(corrupted.find((c) => c.name === checkName).pass).toBe(false);
    expect(failureNames(corrupted)).toEqual([checkName]);
  });

  // NI Class 2 Weekly Rate is genuinely zero in the 2025-26 tax data (Class 2
  // was abolished for most self-employed traders), so the corruption above
  // has to move it away from zero rather than toward it -- kept separate
  // from the it.each table above because the intact value can't be
  // multiplied to get a different non-zero corrupted value.
  it("Admin: NI Class 2 Weekly Rate = tax data fails, and only that check fails, when Admin!L16 is corrupted via JSZip", async () => {
    const checkName = "Admin: NI Class 2 Weekly Rate = tax data";
    const intact = checks.find((c) => c.name === checkName);
    expect(intact.pass).toBe(true);
    expect(intact.expected).toBe(0);

    const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Admin", "L16", 0.05);
    expect(value).toBe(0.05);
    const corrupted = checksWithCorruptedCell("Admin", "L16", value);
    expect(corrupted.find((c) => c.name === checkName).pass).toBe(false);
    expect(failureNames(corrupted)).toEqual([checkName]);
  });
});
