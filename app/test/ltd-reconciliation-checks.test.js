// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd-reconciliation-checks.test.js — Proves the Limited Company fixed asset,
// bank, monthly P&L, tax data and filed-document checks read live formula
// results rather than a fixture compared to itself. Each check is asserted to
// pass against a real recalculated package, then one cell's cached value is
// overwritten in a copy of that package via JSZip (the formula left in place)
// and the same check is asserted to fail, with the rest of the book untouched.
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
  cellWrites as ltdCellWrites,
  standardReads as ltdReads,
  multiFileOptions as ltdOptions,
  checkCompliance as ltdCheckCompliance,
} from "../products/ltd.js";
import { parse as parseTOML } from "smol-toml";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
const DATA_DIR = resolve(APP_DIR, "data");
const FIXTURES_DIR = resolve(APP_DIR, "test", "fixtures");

const YEAR_END_MONTH = 3;

// Overwrites a cell's cached <v> content in place, leaving any <f> formula
// tag untouched — the way a stale or corrupted cached value would reach a
// reader that only ever sees the last-saved cell.
function corruptCellValue(xml, cellRef, newValue) {
  const pattern = new RegExp(`(<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v>)([^<]*)(</v>)`, "s");
  if (!pattern.test(xml)) throw new Error(`corruptCellValue: cell ${cellRef} not found in sheet XML`);
  return xml.replace(pattern, (_match, pre, _old, post) => `${pre}${newValue}${post}`);
}

// Loads a recalculated package file via JSZip, overwrites one cell's cached
// value, round-trips the archive and reads the cell back — a real mutation of
// a copy of the workbook, not a string edit on the in-memory results.
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

describeCalc(
  "Limited Company: fixed assets, bank, monthly P&L and the filed documents",
  () => {
    let results;
    let checks;
    let taxData;
    let expected;
    let savedDir;

    // Replays the compliance checks with one result cell replaced by the
    // value read back out of a corrupted copy of the package.
    function checksWithCorruptedCell(resultKey, cellRef, value) {
      const corrupted = { ...results, [resultKey]: { ...results[resultKey], [cellRef]: value } };
      return ltdCheckCompliance(corrupted, expected, taxData, calculateExpectedTax);
    }

    beforeAll(async () => {
      taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2025.toml"), "utf8"));
      const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));

      const fileBuffers = {};
      for (const templateFile of productMeta.template.files) {
        const templateBuffer = readFileSync(resolve(LTD_DIR, templateFile));
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

      savedDir = mkdtempSync(join(tmpdir(), "ltd-reconciliation-checks-"));
      results = await runMultiFileSpreadsheet(
        fileBuffers,
        ltdCellWrites(scenario, 2025, YEAR_END_MONTH),
        ltdReads(),
        "Financialaccounts.xlsx",
        { ...ltdOptions(YEAR_END_MONTH), saveRecalculatedTo: savedDir },
      );
      checks = ltdCheckCompliance(results, expected, taxData, calculateExpectedTax);
    }, 900000);

    afterAll(() => {
      if (savedDir) rmSync(savedDir, { recursive: true, force: true });
    });

    it("passes every check on the intact book", () => {
      expect(failureNames(checks)).toEqual([]);
    });

    it("leaves the whole-book audit check at zero", () => {
      expect(Math.abs(results.TrialBalance.EJ91)).toBeLessThanOrEqual(1);
    });

    it("puts the opening assets, the year's purchases and the disposal on the schedule", () => {
      const schedule = results["Fixedassets.xlsx!Schedule"];
      // Van and laptop brought forward, three purchases in the year.
      expect(schedule.E55).toBe(30000);
      expect(schedule.F55).toBe(9828);
      expect(schedule.E41).toBe(3000);
      expect(schedule.F41).toBe(270);
      expect(schedule.E110).toBe(32500);
      // The van sold: proceeds, original cost and depreciation to the date
      // of sale all come off the schedule.
      expect(schedule.V1).toBe(12500);
      expect(schedule.W1).toBe(30000);
      expect(schedule.X1).toBe(17328);
      expect(schedule.I1).toBeGreaterThan(0);
    });

    it("publishes those figures in the fixed asset note", () => {
      const notes = results.PubNotes;
      expect(notes.G8).toBe(33000);
      expect(notes.G9).toBe(32500);
      expect(notes.G10).toBe(30000);
      expect(notes.G11).toBe(35500);
      expect(notes.G14).toBe(10098);
      expect(notes.G20).toBe(notes.G11 - notes.G17);
      expect(results.PubBalSht.F6).toBe(notes.G20);
    });

    it("reads a closing balance back from every bank workbook", () => {
      for (const fileName of ["Currentaccount.xlsx", "Savingaccount.xlsx", "Cashaccount.xlsx", "Creditcardaccount.xlsx"]) {
        const closing = results[`${fileName}!Mar`];
        expect(closing, fileName).toBeDefined();
        expect(typeof closing.A2, fileName).toBe("number");
      }
    });

    it("reads the injected rates back from the Admin sheet", () => {
      const admin = results.Admin;
      expect(admin.P6).toBe(19);
      expect(admin.M19).toBe(20);
      expect(admin.G18).toBe(0.33);
      expect(admin.F21).toBe(admin.B32);
      expect(results["PubP&L"].D3).toBe(admin.F21);
    });

    it("fails the note's charge for the year when PubNotes F15 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "PubNotes", "F15", 0);
      expect(value).toBe(0);
      const name = "Fixed asset note (motor): charge for the year = Schedule";
      const corrupted = checksWithCorruptedCell("PubNotes", "F15", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      // The class's own carried-forward identity is measured against the
      // charge, so zeroing it moves that row too.
      expect(failureNames(corrupted)).toEqual([name, "Fixed asset note (motor): depreciation carried forward"]);
    });

    it("fails the schedule tie when the Schedule's own depreciation total is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Fixedassets.xlsx", "Schedule", "I1", 0);
      expect(value).toBe(0);
      const name = "Fixed asset note: total charge for the year = Schedule";
      const corrupted = checksWithCorruptedCell("Fixedassets.xlsx!Schedule", "I1", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the balance sheet tie when PubBalSht F6 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "PubBalSht", "F6", 0);
      expect(value).toBe(0);
      const name = "Published balance sheet: fixed assets = fixed asset note net book value";
      const corrupted = checksWithCorruptedCell("PubBalSht", "F6", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the P&L depreciation tie when MnthP&L B40 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "MnthP&L", "B40", 0);
      expect(value).toBe(0);
      const name = "P&L: depreciation = fixed asset note charge for the year";
      const corrupted = checksWithCorruptedCell("MnthP&L", "B40", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      // Depreciation is one of the admin expense lines and the figure the
      // tax computation adds back, so both of those move with it.
      expect(failureNames(corrupted)).toEqual(["P&L: Admin lines sum = Total", name, "CT: depreciation add-back = P&L depreciation"]);
    });

    it("fails the bank tie when the current account closing balance is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Currentaccount.xlsx", "Mar", "A2", 0);
      expect(value).toBe(0);
      const name = "Currentaccount.xlsx: closing balance = opening + receipts - payments";
      const corrupted = checksWithCorruptedCell("Currentaccount.xlsx!Mar", "A2", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails one month's tie when a single MnthP&L month cell is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "MnthP&L", "G21", 0);
      expect(value).toBe(0);
      const name = 'P&L Aug G21 = Purchases.xlsx "r" net';
      const corrupted = checksWithCorruptedCell("MnthP&L", "G21", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      // That month's expense columns are also totalled against the leaf
      // workbook's own row 1, so both ties over the cell move together.
      expect(failureNames(corrupted)).toEqual([
        name,
        "P&L Aug expense lines = Purchases.xlsx Aug net less materials, wages and asset purchases",
      ]);
    });

    it("fails the leaf month tie when a Sales month total is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Sales.xlsx", "Apr", "H1", 0);
      expect(value).toBe(0);
      const name = "P&L Apr turnover = Sales.xlsx Apr net less bad debts and asset sales";
      const corrupted = checksWithCorruptedCell("Sales.xlsx!Apr", "H1", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the tax data echo when the Admin VAT rate is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Admin", "M19", 17.5);
      expect(value).toBe(17.5);
      const name = "Admin M19: standard VAT rate";
      const corrupted = checksWithCorruptedCell("Admin", "M19", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the CT600 turnover box when it is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CT600", "AK66", 0);
      expect(value).toBe(0);
      const name = "CT600: turnover = published P&L turnover";
      const corrupted = checksWithCorruptedCell("CT600", "AK66", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the tax add-back when the corporation tax depreciation line is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CorporationTax", "I8", 0);
      expect(value).toBe(0);
      const name = "CT: depreciation add-back = P&L depreciation";
      const corrupted = checksWithCorruptedCell("CorporationTax", "I8", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name, "CT: add-backs = depreciation + goodwill"]);
    });
  },
  900000,
);
