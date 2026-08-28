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

    it("reads the register of members' nominal value and shares issued", () => {
      const register = results["Companysecretary.xlsx!RegisterofMembers"];
      expect(register).toBeDefined();
      expect(register.F1).toBe(1);
      expect(register.G1).toBe(100);
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

    it("publishes the year-end stock and only the debtors left uncollected", () => {
      expect(results.PubBalSht.E10).toBe(6000);
      expect(results.PubBalSht.E11).toBe(10400);
      expect(results.Stock.D6).toBe(10000);
      expect(results.Stock.AB30).toBe(6000);
      expect(results.Stock.Z30).toBe(-4000);
    });

    it("fails the published stock tie when PubBalSht E10 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "PubBalSht", "E10", 10000);
      expect(value).toBe(10000);
      const name = "Published balance sheet: stock = year-end stock";
      const corrupted = checksWithCorruptedCell("PubBalSht", "E10", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the published debtors tie when PubBalSht E11 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "PubBalSht", "E11", 237100);
      expect(value).toBe(237100);
      const name = "Published balance sheet: trade debtors = closing debtors";
      const corrupted = checksWithCorruptedCell("PubBalSht", "E11", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the stock count and its loss adjustment when the Stock sheet's count is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Stock", "AB30", 9000);
      expect(value).toBe(9000);
      const corrupted = checksWithCorruptedCell("Stock", "AB30", value);
      expect(failureNames(corrupted)).toEqual(["Stock: physical count at the year end", "Stock: loss adjustment = count - calculated"]);
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

    it("fails the register tie when RegisterofMembers G1 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Companysecretary.xlsx", "RegisterofMembers", "G1", 0);
      expect(value).toBe(0);
      const name = "RegisterofMembers: nominal value x shares issued = PubBalSht share capital";
      const corrupted = checksWithCorruptedCell("Companysecretary.xlsx!RegisterofMembers", "G1", value);
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
      // April's own row on the VAT interface is measured against the same
      // leaf total, so it moves with it.
      expect(failureNames(corrupted)).toEqual(["Vatinterface D6: Apr sales net = Sales.xlsx Apr", name]);
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

    it("carries the schedule's per-asset capital allowance rows into the tax computation", () => {
      const schedule = results["Fixedassets.xlsx!Schedule"];
      const corporationTax = results.CorporationTax;
      // The three purchases claim the annual investment allowance in full;
      // the van brought forward takes a restricted writing down allowance and
      // then a balancing allowance for the shortfall on its sale.
      expect(schedule.Q1).toBe(32500);
      expect(schedule.R1).toBe(3000);
      expect(schedule.Y1).toBe(8500);
      expect(corporationTax.I15).toBe(32500);
      expect(corporationTax.I17).toBe(3000);
      expect(corporationTax.I18).toBe(8500);
      expect(corporationTax.K20).toBe(44000);
    });

    it("fails the investment allowance tie when the Schedule total is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Fixedassets.xlsx", "Schedule", "Q1", 0);
      expect(value).toBe(0);
      const name = "CT: annual investment allowance = Schedule annual investment allowance";
      const corrupted = checksWithCorruptedCell("Fixedassets.xlsx!Schedule", "Q1", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    // ── Payroll: WagesInterface, the PAYE/NI creditor, Payslips!Payment,
    // and the P&L wages route (item 4) ──

    it("WagesInterface Apr gross pay and employer NI carry the payroll fixture's own totals", () => {
      const wi = results.WagesInterface;
      expect(wi.C4).toBe(6748); // Alice 3500 + Bob 2200 + Carol 1048
      expect(wi.H4).toBeCloseTo(577.2, 5); // 382.5 + 187.5 + 7.2
    });

    it("fails the gross pay tie when WagesInterface C4 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "WagesInterface", "C4", 0);
      expect(value).toBe(0);
      const name = "WagesInterface Apr C4 gross pay";
      const corrupted = checksWithCorruptedCell("WagesInterface", "C4", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the writing down allowance tie when the Schedule total is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Fixedassets.xlsx", "Schedule", "R1", 0);
      expect(value).toBe(0);
      const name = "CT: writing down allowances = Schedule writing down allowances";
      const corrupted = checksWithCorruptedCell("Fixedassets.xlsx!Schedule", "R1", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the employer NI tie when WagesInterface H4 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "WagesInterface", "H4", 0);
      expect(value).toBe(0);
      const name = "WagesInterface Apr H4 employer NI";
      const corrupted = checksWithCorruptedCell("WagesInterface", "H4", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the balancing allowance tie when the Schedule disposal total is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Fixedassets.xlsx", "Schedule", "Y1", 0);
      expect(value).toBe(0);
      const name = "CT: balancing allowance on disposals = Schedule balancing allowance less balancing charge";
      const corrupted = checksWithCorruptedCell("Fixedassets.xlsx!Schedule", "Y1", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the PAYE/NI creditor tie when TrialBalance L34 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "TrialBalance", "L34", 0);
      expect(value).toBe(0);
      const name = "Trial Balance: PAYE/NI creditor first-month movement (L34) = that month's payroll tax due";
      const corrupted = checksWithCorruptedCell("TrialBalance", "L34", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the capital allowance total and the profit below it when CorporationTax K20 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CorporationTax", "K20", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("CorporationTax", "K20", value);
      expect(failureNames(corrupted)).toEqual(["CT: capital allowances = the allowance lines", "CT: profit after capital allowances"]);
    });

    it("fails the schedule's opening balance verdict when it is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Fixedassets.xlsx", "Schedule", "B55", "Check Opening Balance Sheet figures agree");
      expect(value).toBe("Check Opening Balance Sheet figures agree");
      const name = "Fixed asset schedule (motor): opening cost and depreciation agree with the opening balance sheet";
      const corrupted = checksWithCorruptedCell("Fixedassets.xlsx!Schedule", "B55", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });
    it("fails the total-payable tie when Payslips!Payment I4 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Payment", "I4", 0);
      expect(value).toBe(0);
      const name = "Payslips!Payment Apr I4 total amount payable";
      const corrupted = checksWithCorruptedCell("Payslips.xlsx!Payment", "I4", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the P&L PAYE-wages route when MnthP&L B18 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "MnthP&L", "B18", 0);
      expect(value).toBe(0);
      const name = "MnthP&L: PAYE Wages + Non-PAYE Employee (B18) = payroll gross pay + Purchases w-coded net";
      const corrupted = checksWithCorruptedCell("MnthP&L", "B18", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      // B18 also feeds the admin-lines-sum-to-total identity, so that check
      // fails alongside the payroll-route check being proven here.
      expect(failureNames(corrupted)).toEqual(["P&L: Admin lines sum = Total", name]);
    });

    it("fails the VAT rate read when a Sales month's rate cell is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Sales.xlsx", "Jul", "G2", 0);
      expect(value).toBe(0);
      const name = "Sales.xlsx Jul: VAT rate charged (G2)";
      const corrupted = checksWithCorruptedCell("Sales.xlsx!Jul", "G2", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the VAT rate read when a Purchases month's rate cell is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Purchases.xlsx", "Jul", "G2", 5);
      expect(value).toBe(5);
      const name = "Purchases.xlsx Jul: VAT rate charged (G2)";
      const corrupted = checksWithCorruptedCell("Purchases.xlsx!Jul", "G2", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the year's output VAT against the sales journal when a Sales month's VAT total is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Sales.xlsx", "Jul", "G1", 0);
      expect(value).toBe(0);
      const name = "VAT: annual output VAT = the sales journal at the book's rate";
      const corrupted = checksWithCorruptedCell("Sales.xlsx!Jul", "G1", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      // The same cell is the month's own interface tie and part of the
      // quarter sum, so both move with it.
      expect(failureNames(corrupted)).toEqual(["VAT: Q1-Q4 box 1 = Sales VAT", name, "Vatinterface F9: Jul output VAT = Sales.xlsx Jul"]);
    });

    it("fails the year's input VAT against the purchase journal when a Purchases month's VAT total is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Purchases.xlsx", "Jul", "G1", 0);
      expect(value).toBe(0);
      const name = "VAT: annual input VAT = the purchase journal at the book's rate";
      const corrupted = checksWithCorruptedCell("Purchases.xlsx!Jul", "G1", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([
        "VAT: Q1-Q4 box 4 = Purchases VAT",
        name,
        "Vatinterface J9: Jul input VAT = Purchases.xlsx Jul",
      ]);
    });

    it("fails the CT600 trading profits box when it is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CT600", "Z70", 1);
      expect(value).toBe(1);
      const name = "CT600: trading profits = CT profit after capital allowances";
      const corrupted = checksWithCorruptedCell("CT600", "Z70", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      // The box is also one side of the form's own net-trading-profits sum.
      expect(failureNames(corrupted)).toEqual([name, "CT600: net trading profits = trading profits - losses brought forward"]);
    });
  },
  900000,
);
