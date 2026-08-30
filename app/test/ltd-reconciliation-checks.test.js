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
import { calculateCorporationTax } from "../lib/tax/corporation-tax.js";
import {
  cellWrites as ltdCellWrites,
  standardReads as ltdReads,
  multiFileOptions as ltdOptions,
  checkCompliance as ltdCheckCompliance,
  profitBridge as ltdProfitBridge,
  categoryNetting as ltdCategoryNetting,
} from "../products/ltd.js";
import { categoryNettingCheckName, PROFIT_BRIDGE_CHECK } from "../lib/report-generator.js";
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

// Puts a value into a cell the template leaves empty — the box carries no
// <v> to overwrite, so filling one is how a box that should be blank is made
// to read as filled.
function fillEmptyCell(xml, cellRef, newValue) {
  const pattern = new RegExp(`<c r="${cellRef}"([^>]*?)/>`, "s");
  if (!pattern.test(xml)) throw new Error(`fillEmptyCell: empty cell ${cellRef} not found in sheet XML`);
  return xml.replace(pattern, (_match, attrs) => `<c r="${cellRef}"${attrs}><v>${newValue}</v></c>`);
}

// The same round trip as readCorruptedCell, for a cell that starts out empty.
async function readFilledCell(savedDir, fileName, sheetName, cellRef, newValue) {
  const zip = await JSZip.loadAsync(readFileSync(resolve(savedDir, fileName)));
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get(sheetName);
  if (!sheetPath) throw new Error(`readFilledCell: sheet ${sheetName} not found in ${fileName}`);
  const xml = await zip.file(sheetPath).async("string");
  zip.file(sheetPath, fillEmptyCell(xml, cellRef, newValue));

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
    let scenario;

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

      scenario = loadScenario(resolve(FIXTURES_DIR, "ltd-scenario-full.toml"));
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
      expect(schedule.E110).toBe(52500);
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
      expect(notes.G9).toBe(52500);
      expect(notes.G10).toBe(30000);
      expect(notes.G11).toBe(55500);
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

    it("reads the register of members' nominal value, members and shares issued", () => {
      const register = results["Companysecretary.xlsx!RegisterofMembers"];
      expect(register).toBeDefined();
      expect(register.F1).toBe(1);
      expect(register.G1).toBe(100);
      expect([register.A3, register.A4, register.A5]).toEqual(["Carol Smith", "David Brown", "Emma Wilson"]);
      expect([register.G3, register.G4, register.G5]).toEqual([60, 25, 15]);
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

    it("fails the Schedule's own closing NBV identity when Schedule!K1 is corrupted via JSZip", async () => {
      const real = results["Fixedassets.xlsx!Schedule"].K1;
      const value = await readCorruptedCell(savedDir, "Fixedassets.xlsx", "Schedule", "K1", real + 5000);
      const name = "Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals";
      const corrupted = checksWithCorruptedCell("Fixedassets.xlsx!Schedule", "K1", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the closing NBV identity and the note/P&L disposal ties together when Schedule!W1 is corrupted via JSZip", async () => {
      const real = results["Fixedassets.xlsx!Schedule"].W1;
      const value = await readCorruptedCell(savedDir, "Fixedassets.xlsx", "Schedule", "W1", real + 5000);
      const name = "Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals";
      const corrupted = checksWithCorruptedCell("Fixedassets.xlsx!Schedule", "W1", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      // W1 (the Schedule's own grand total for cost of the assets sold) also
      // feeds the fixed asset note's disposals-at-cost row and the P&L's
      // loss-on-disposal tie, so both move with it.
      expect(failureNames(corrupted)).toEqual(
        expect.arrayContaining([
          name,
          "Fixed asset note: total disposals at cost = Schedule",
          "P&L: loss on disposal = Schedule cost less depreciation less proceeds",
        ]),
      );
      expect(failureNames(corrupted)).toHaveLength(3);
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
      expect(results.PubBalSht.E11).toBe(7900);
      expect(results.Stock.D6).toBe(10000);
      expect(results.Stock.AB30).toBe(6000);
      // 10,000 opening plus 5,450 of materials bought, less 3% of the 311,600
      // of net product A sales the stock sheet reckons those materials went
      // out inside, leaves 6,102 calculated against a count of 6,000.
      expect(results.Stock.D30).toBeCloseTo(6102, 6);
      expect(results.Stock.Z30).toBeCloseTo(-102, 6);
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
      // The listing and the ledger both name the same figure, so a corrupted
      // published line parts company with both of them.
      expect(failureNames(corrupted)).toEqual([
        name,
        "Published balance sheet: trade debtors = opening debtors plus invoices less customer receipts",
      ]);
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

    // ── Trial Balance bank echoes and the published cash-at-bank aggregate.
    // TrialBalance!EJ22-EJ25 echo each workbook's closing balance across the
    // cross-file link, and PubBalSht!E12 reproduces the sheet's own formula:
    // IF(SUM(EJ22:EJ24)>0, SUM(EJ22:EJ24)+EJ25+EJ26, EJ25) -- the credit card
    // balance (EJ24) summed straight in, not netted off as a creditor.

    it("reads a non-zero Trial Balance echo for every bank workbook, and a non-zero published cash-at-bank total", () => {
      const tb = results.TrialBalance;
      expect(tb.EJ22).not.toBe(0); // Currentaccount.xlsx
      expect(tb.EJ23).not.toBe(0); // Savingaccount.xlsx
      expect(tb.EJ24).not.toBe(0); // Creditcardaccount.xlsx
      expect(tb.EJ25).not.toBe(0); // Cashaccount.xlsx
      expect(results.PubBalSht.E12).not.toBe(0);
    });

    it("fails the Trial Balance echo (and, downstream, the published cash-at-bank aggregate) when EJ22 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "TrialBalance", "EJ22", 0);
      expect(value).toBe(0);
      const echoName = "Trial Balance: Currentaccount.xlsx closing balance echo (EJ22)";
      const aggregateName = "Published balance sheet: cash at bank = Trial Balance bank account aggregate";
      const corrupted = checksWithCorruptedCell("TrialBalance", "EJ22", value);
      expect(corrupted.find((c) => c.name === echoName).pass).toBe(false);
      expect(corrupted.find((c) => c.name === aggregateName).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([echoName, aggregateName]);
    });

    it("fails only the published cash-at-bank aggregate when PubBalSht E12 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "PubBalSht", "E12", 0);
      expect(value).toBe(0);
      const name = "Published balance sheet: cash at bank = Trial Balance bank account aggregate";
      const corrupted = checksWithCorruptedCell("PubBalSht", "E12", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    it("fails the register tie and the report's share line when RegisterofMembers G1 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Companysecretary.xlsx", "RegisterofMembers", "G1", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("Companysecretary.xlsx!RegisterofMembers", "G1", value);
      expect(failureNames(corrupted)).toEqual([
        "RegisterofMembers: nominal value x shares issued = PubBalSht share capital",
        "Directors' report: ordinary shares issued = register of members total",
      ]);
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

    it("carries the tax year's mileage rate on every month of the expenses claim form", () => {
      for (let month = 1; month <= 12; month++) {
        const sheet = `Month ${String(month).padStart(2, "0")}`;
        expect(results[`expensesform.xlsx!${sheet}`], sheet).toBeDefined();
        expect(results[`expensesform.xlsx!${sheet}`].C30, sheet).toBeCloseTo(taxData.mileage.higher_rate_pence, 6);
      }
    });

    it("fails one month of the expenses claim form when its mileage rate is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "expensesform.xlsx", "Month 05", "C30", 0.4);
      expect(value).toBe(0.4);
      const corrupted = checksWithCorruptedCell("expensesform.xlsx!Month 05", "C30", value);
      expect(failureNames(corrupted)).toEqual(["Expenses form Month 05: mileage rate = tax data"]);
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
      expect(failureNames(corrupted)).toEqual([name, "CT: add-backs = depreciation + goodwill", PROFIT_BRIDGE_CHECK]);
    });

    it("carries the schedule's per-asset capital allowance rows into the tax computation", () => {
      const schedule = results["Fixedassets.xlsx!Schedule"];
      const corporationTax = results.CorporationTax;
      // The five purchases claim the annual investment allowance in full;
      // the van brought forward takes a writing down allowance at the main
      // rate (24,000 x 18% = 4,320) and then a balancing allowance for the
      // shortfall between the remaining pool and its sale proceeds
      // (19,680 - 12,500 = 7,180). WDA plus balancing allowance together
      // still equal the opening tax value less the proceeds either way.
      expect(schedule.Q1).toBe(52500);
      expect(schedule.R1).toBe(4320);
      expect(schedule.Y1).toBe(7180);
      expect(corporationTax.I15).toBe(52500);
      expect(corporationTax.I17).toBe(4320);
      expect(corporationTax.I18).toBe(7180);
      expect(corporationTax.K20).toBe(64000);
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
      expect(failureNames(corrupted)).toEqual([
        "CT: capital allowances = the allowance lines",
        "CT: profit after capital allowances",
        "CT: chargeable profit = operating profit + add-backs - capital allowances + interest - losses",
        PROFIT_BRIDGE_CHECK,
      ]);
    });

    it("fails the schedule's opening balance verdict when it is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Fixedassets.xlsx", "Schedule", "B55", "Check Opening Balance Sheet figures agree");
      expect(value).toBe("Check Opening Balance Sheet figures agree");
      const name = "Fixed asset schedule (motor): opening cost and depreciation agree with the opening balance sheet";
      const corrupted = checksWithCorruptedCell("Fixedassets.xlsx!Schedule", "B55", value);
      expect(corrupted.find((c) => c.name === name).pass).toBe(false);
      expect(failureNames(corrupted)).toEqual([name]);
    });

    // The van's opening tax value is 24,000 and the fixture's 2025-26 tax
    // data claims WDA at 18%: 4,320 WDA, a 19,680 pool, and a 7,180 balancing
    // allowance against the 12,500 net disposal proceeds. Corrupting R50 back
    // to the pre-2009 expensive-car cap's figure (3,000) is what a
    // reintroduced restriction would produce, and proves these checks would
    // catch it: the WDA check fails outright, and the WDA-plus-balancing
    // identity fails alongside it because Y50 is read straight from the
    // sheet and does not move with the corrupted R50. The pool and
    // balancing-allowance checks read S50/Y50 directly rather than deriving
    // them from R50, so neither one moves.
    it("fails the motor vehicle WDA checks when Schedule!R50 is corrupted via JSZip", async () => {
      const intactWda = checks.find((c) => c.name === "Schedule: motor vehicle WDA = opening tax value x the year's WDA rate, uncapped");
      expect(intactWda.pass).toBe(true);
      expect(intactWda.expected).toBe(4320);

      const value = await readCorruptedCell(savedDir, "Fixedassets.xlsx", "Schedule", "R50", 3000);
      expect(value).toBe(3000);
      const corrupted = checksWithCorruptedCell("Fixedassets.xlsx!Schedule", "R50", value);
      expect(failureNames(corrupted)).toEqual([
        "Schedule: motor vehicle WDA = opening tax value x the year's WDA rate, uncapped",
        "Schedule: motor vehicle WDA + balancing allowance = opening tax value less disposal proceeds",
      ]);
    });

    it("fails the motor vehicle pool and balancing allowance checks when Schedule!S50/Y50 are corrupted via JSZip", async () => {
      const intactPool = checks.find((c) => c.name === "Schedule: motor vehicle pool after WDA = opening tax value less WDA");
      const intactBalancing = checks.find(
        (c) => c.name === "Schedule: motor vehicle balancing allowance = pool after WDA less disposal proceeds",
      );
      expect(intactPool.pass).toBe(true);
      expect(intactPool.expected).toBe(19680);
      expect(intactBalancing.pass).toBe(true);
      expect(intactBalancing.expected).toBe(7180);

      const sValue = await readCorruptedCell(savedDir, "Fixedassets.xlsx", "Schedule", "S50", 20000);
      expect(sValue).toBe(20000);
      const corruptedS = checksWithCorruptedCell("Fixedassets.xlsx!Schedule", "S50", sValue);
      expect(failureNames(corruptedS)).toEqual(["Schedule: motor vehicle pool after WDA = opening tax value less WDA"]);

      const yValue = await readCorruptedCell(savedDir, "Fixedassets.xlsx", "Schedule", "Y50", 8000);
      expect(yValue).toBe(8000);
      const corruptedY = checksWithCorruptedCell("Fixedassets.xlsx!Schedule", "Y50", yValue);
      expect(failureNames(corruptedY)).toEqual([
        "Schedule: motor vehicle balancing allowance = pool after WDA less disposal proceeds",
        "Schedule: motor vehicle WDA + balancing allowance = opening tax value less disposal proceeds",
      ]);
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
      // B18 also feeds the admin-lines-sum-to-total identity and the netting
      // row for casual-worker purchases, so both fail alongside the
      // payroll-route check being proven here.
      const corruptedResults = { ...results, "MnthP&L": { ...results["MnthP&L"], B18: value } };
      const wagesNetting = ltdCategoryNetting(corruptedResults, expected).rows.find((row) => row.code === "purchases w");
      expect(failureNames(corrupted)).toEqual(["P&L: Admin lines sum = Total", name, categoryNettingCheckName(wagesNetting)]);
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

    // ── The corporation tax charge and what the CT600 files of it ──

    it("charges the whole chargeable profit in the one financial year the period falls in", () => {
      const ct = results.CorporationTax;
      const admin = results.Admin;
      // A 31 March year end runs 1 April to 31 March, which is one UK
      // financial year, so row 33 takes the whole period and row 34 is empty.
      expect(ct.A33).toBe(365);
      expect(ct.A34).toBe(0);
      expect(ct.A35).toBe(365);
      expect(ct.A35).toBe(admin.F21 - admin.B9 + 1);
      expect(ct.F33).toBeCloseTo(ct.K28, 6);
      expect(ct.F34).toBe(0);
      expect(ct.I33 + ct.I34).toBeCloseTo(ct.K35, 6);
    });

    it("names the accounting period on the working sheet and on the return", () => {
      const admin = results.Admin;
      expect(results.CorporationTax.E5).toBe(admin.B9);
      expect(results.CorporationTax.H5).toBe(admin.F21);
      expect(results.CT600.B33).toBe(admin.B9);
      expect(results.CT600.M33).toBe(admin.F21);
    });

    it("charges the main rate less marginal relief on a profit inside the relief band", () => {
      const ct = results.CorporationTax;
      const statutory = calculateCorporationTax(ct.K28, taxData.corporation_tax).corporationTax;
      // The profit sits between the £50,000 and £250,000 limits, so the
      // charge is the main rate on the whole profit less the relief that
      // tapers it back towards the small profits rate.
      expect(ct.K28).toBeGreaterThan(taxData.corporation_tax.small_profits_limit);
      expect(ct.K28).toBeLessThan(taxData.corporation_tax.main_rate_limit);
      expect(ct.G33).toBe(25);
      expect(ct.J33).toBeCloseTo(ct.K28 * 0.25, 6);
      expect(ct.L33).toBeCloseTo((250000 - ct.K28) * 0.015, 6);
      expect(ct.K35).toBeCloseTo(statutory, 6);
      expect(statutory).toBeCloseTo(ct.K28 * 0.25 - (250000 - ct.K28) * 0.015, 6);
      expect(ct.K35).toBeCloseTo(29221.272927, 4);
    });

    it("files the gross tax in box 63, the relief in box 64 and the charge in box 65", () => {
      const ct = results.CorporationTax;
      const ct600 = results.CT600;
      expect(ct.I34).toBe(0);
      expect(ct600.AJ126).toBeCloseTo(ct.J33, 6);
      expect(ct600.AJ128).toBeCloseTo(0, 6);
      expect(ct600.AJ131).toBeCloseTo(31104.97446, 4);
      expect(ct600.Y133).toBeCloseTo(1883.701532, 4);
      expect(ct600.Y135).toBeCloseTo(ct.K35, 6);
      expect(ct600.AJ145).toBeCloseTo(ct.K35, 6);
      // The period lies in one financial year, so the second row is blank
      // rather than filed as a nil year.
      expect(ct600.C128).toBe("");
      expect(ct600.N128).toBe("");
    });

    it("fails the second tax row and the charge above it when CorporationTax I34 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CorporationTax", "I34", 5000);
      expect(value).toBe(5000);
      const corrupted = checksWithCorruptedCell("CorporationTax", "I34", value);
      expect(failureNames(corrupted)).toEqual([
        "CT: second tax row tax = its gross tax less its marginal relief",
        "CT: charge for the year = the two tax rows",
      ]);
    });

    it("fails the first tax row and the box that files it when CorporationTax I33 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CorporationTax", "I33", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("CorporationTax", "I33", value);
      expect(failureNames(corrupted)).toEqual([
        "CT: first tax row tax = its gross tax less its marginal relief",
        "CT: charge for the year = the two tax rows",
      ]);
    });

    it("fails the box that files the gross tax when CT600 AJ126 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CT600", "AJ126", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("CT600", "AJ126", value);
      expect(failureNames(corrupted)).toEqual(["CT600: corporation tax = first tax row gross tax", "CT600: tax payable = tax chargeable"]);
    });

    it("fails the second financial year box when CT600 AJ128 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CT600", "AJ128", 5000);
      expect(value).toBe(5000);
      const corrupted = checksWithCorruptedCell("CT600", "AJ128", value);
      expect(failureNames(corrupted)).toEqual([
        "CT600: second financial year tax = second tax row gross tax",
        "CT600: tax payable = tax chargeable",
      ]);
    });

    it("fails the relief box when CT600 Y133 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CT600", "Y133", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("CT600", "Y133", value);
      expect(failureNames(corrupted)).toEqual(["CT600: marginal rate relief = the working sheet's relief"]);
    });

    it("fails the box the company pays from when CT600 Y135 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CT600", "Y135", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("CT600", "Y135", value);
      expect(failureNames(corrupted)).toEqual([
        "CT600: tax net of marginal relief = the working sheet's charge",
        "CT600: corporation tax chargeable = tax net of marginal relief",
        "CT600: underlying rate of corporation tax = the tax it bears over the profits chargeable",
      ]);
    });

    it("fails the first row's share of the profit when CorporationTax F33 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CorporationTax", "F33", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("CorporationTax", "F33", value);
      expect(failureNames(corrupted)).toEqual([
        "CT600: amount of profit = first tax row profit",
        "CT: first tax row profit = chargeable profit by its share of those days",
        "CT: first tax row gross tax = its profit at its rate",
        "CT: first tax row rate = the rate its share of the profit falls in",
        "CT: first tax row marginal relief = its share of the profit against its share of the limits",
      ]);
    });

    it("fails the relief and the tax under it when CorporationTax L33 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CorporationTax", "L33", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("CorporationTax", "L33", value);
      expect(failureNames(corrupted)).toEqual([
        "CT600: marginal rate relief = the working sheet's relief",
        "CT: first tax row tax = its gross tax less its marginal relief",
        "CT: first tax row marginal relief = its share of the profit against its share of the limits",
      ]);
    });

    it("fails the gross tax and the tax under it when CorporationTax J33 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CorporationTax", "J33", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("CorporationTax", "J33", value);
      expect(failureNames(corrupted)).toEqual([
        "CT600: corporation tax = first tax row gross tax",
        "CT: first tax row gross tax = its profit at its rate",
        "CT: first tax row tax = its gross tax less its marginal relief",
      ]);
    });

    it("fails the rate the profit is charged at when Admin P8 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Admin", "P8", 19);
      expect(value).toBe(19);
      const corrupted = checksWithCorruptedCell("Admin", "P8", value);
      expect(failureNames(corrupted)).toEqual([
        "Admin P8: corporation tax main rate",
        "CT: first tax row rate = the rate its share of the profit falls in",
      ]);
    });

    it("fails the relief when Admin P9 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Admin", "P9", 0.03);
      expect(value).toBe(0.03);
      const corrupted = checksWithCorruptedCell("Admin", "P9", value);
      expect(failureNames(corrupted)).toEqual([
        "Admin P9: marginal relief fraction",
        "CT: first tax row marginal relief = its share of the profit against its share of the limits",
      ]);
    });

    it("fails the days the charge is spread over when CorporationTax A34 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CorporationTax", "A34", 300);
      expect(value).toBe(300);
      const corrupted = checksWithCorruptedCell("CorporationTax", "A34", value);
      // A second row with days in it makes the form's own second financial
      // year row due, and the boxes the template leaves blank are then wrong.
      expect(failureNames(corrupted)).toEqual([
        "CT600: second financial year = second tax row financial year",
        "CT600: second financial year rate = second tax row rate",
        "CT: the two tax rows together span the days the charge is spread over",
        "CT: second tax row profit = chargeable profit by its share of those days",
      ]);
    });

    it("fails the period span when CorporationTax A35 is corrupted back to two years via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CorporationTax", "A35", 730);
      expect(value).toBe(730);
      const corrupted = checksWithCorruptedCell("CorporationTax", "A35", value);
      expect(failureNames(corrupted)).toEqual([
        "CT: the two tax rows span the accounting period",
        "CT: the two tax rows together span the days the charge is spread over",
        "CT: first tax row profit = chargeable profit by its share of those days",
        "CT: first tax row marginal relief = its share of the profit against its share of the limits",
      ]);
    });

    it("fails the working sheet heading when CorporationTax H5 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CorporationTax", "H5", 46477);
      expect(value).toBe(46477);
      const corrupted = checksWithCorruptedCell("CorporationTax", "H5", value);
      expect(failureNames(corrupted)).toEqual(["CT: working sheet heading ends at the year end"]);
    });

    it("fails the return period when CT600 M33 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "CT600", "M33", 46477);
      expect(value).toBe(46477);
      const corrupted = checksWithCorruptedCell("CT600", "M33", value);
      expect(failureNames(corrupted)).toEqual(["CT600: return period ends at the year end"]);
    });

    it("fails the second financial year row when Admin N7 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Admin", "N7", 46477);
      expect(value).toBe(46477);
      const corrupted = checksWithCorruptedCell("Admin", "N7", value);
      expect(failureNames(corrupted)).toEqual(["Admin: second financial year row ends at the year end"]);
    });

    it("walks the management profit before tax to the profit chargeable to corporation tax", () => {
      const bridge = ltdProfitBridge(results);

      // The accounts carry bank interest net of the tax deducted at source
      // and the computation charges it gross, so the two interest lines
      // differ by exactly that tax.
      const netInterest = -bridge.rows.find((row) => row.cell === "MnthP&L!B44").value;
      const grossInterest = bridge.rows.find((row) => row.cell === "CorporationTax!K24").value;
      expect(grossInterest - netInterest).toBeCloseTo(results.CorporationTax.K37, 6);

      expect(bridge.rows[0].value).toBe(results["MnthP&L"].B45);
      expect(bridge.computed).toBeCloseTo(results.CorporationTax.K28, 6);
      expect(bridge.residue).toBeCloseTo(0, 6);
    });

    it("breaks the bridge, by the interest it lost, when the management interest line is corrupted via JSZip", async () => {
      const netInterest = results["MnthP&L"].B44;
      expect(netInterest).toBeGreaterThan(0);

      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "MnthP&L", "B44", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("MnthP&L", "B44", value);

      // The profit-before-tax identity reads the same cell, so it goes too.
      expect(failureNames(corrupted)).toEqual(["P&L: PBT = Operating + Interest", PROFIT_BRIDGE_CHECK]);
      const corruptedResults = { ...results, "MnthP&L": { ...results["MnthP&L"], B44: value } };
      expect(ltdProfitBridge(corruptedResults).residue).toBeCloseTo(netInterest, 6);
    });

    it("nets every journal category the report shows to the statement figure it lands as", () => {
      const netting = ltdCategoryNetting(results, expected);

      expect(netting.rate).toBeGreaterThan(0);
      expect(netting.rows.length).toBeGreaterThan(0);
      for (const row of netting.rows) {
        expect(row.gross).toBeGreaterThan(0);
        expect(row.vat).toBeCloseTo(row.gross - row.net, 6);
        expect(row.residue).toBeCloseTo(0, 6);
      }

      const capitalised = netting.rows.find((row) => row.code === "purchases fa");
      expect(capitalised.cell).toBe("Fixedassets.xlsx!FAreconciliation!E11");
      expect(capitalised.net).toBeCloseTo(results["Fixedassets.xlsx!FAreconciliation"].E11, 6);

      const subcontractors = netting.rows.find((row) => row.code === "purchases c");
      expect(subcontractors.cell).toBe("MnthP&L!B12");
      expect(subcontractors.net).toBeCloseTo(results["MnthP&L"].B12, 6);
    });

    it("names the residue on the capitalised spend, and fails only the checks reading that cell, when the schedule additions drift via JSZip", async () => {
      const realValue = results["Fixedassets.xlsx!FAreconciliation"].E11;
      expect(realValue).toBeGreaterThan(0);
      const drift = 500;

      const value = await readCorruptedCell(savedDir, "Fixedassets.xlsx", "FAreconciliation", "E11", realValue + drift);
      expect(value).toBe(realValue + drift);
      const corrupted = checksWithCorruptedCell("Fixedassets.xlsx!FAreconciliation", "E11", value);

      const corruptedResults = {
        ...results,
        "Fixedassets.xlsx!FAreconciliation": { ...results["Fixedassets.xlsx!FAreconciliation"], E11: value },
      };
      const nettingRow = ltdCategoryNetting(corruptedResults, expected).rows.find((row) => row.code === "purchases fa");
      expect(nettingRow.residue).toBeCloseTo(-drift, 6);
      expect(failureNames(corrupted)).toEqual([
        "Fixed assets: Schedule additions = fixed asset purchases net of VAT",
        categoryNettingCheckName(nettingRow),
      ]);
    });

    it("names the residue on the subcontractor spend when the management profit and loss line drifts via JSZip", async () => {
      const realValue = results["MnthP&L"].B12;
      expect(realValue).toBeGreaterThan(0);
      const drift = 250;

      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "MnthP&L", "B12", realValue + drift);
      expect(value).toBe(realValue + drift);
      const corrupted = checksWithCorruptedCell("MnthP&L", "B12", value);

      const corruptedResults = { ...results, "MnthP&L": { ...results["MnthP&L"], B12: value } };
      const nettingRow = ltdCategoryNetting(corruptedResults, expected).rows.find((row) => row.code === "purchases c");
      expect(nettingRow.residue).toBeCloseTo(-drift, 6);
      expect(failureNames(corrupted)).toEqual([categoryNettingCheckName(nettingRow)]);
    });

    it("quotes the published statements in the directors' report", () => {
      const report = results.Report;
      const publishedPL = results["PubP&L"];
      expect(report.E87).toBeCloseTo(publishedPL.F9, 6);
      expect(report.H87).toBe(publishedPL.B9);
      expect(report.D89).toBeCloseTo(publishedPL.F18 / publishedPL.F9, 9);
      expect(report.F22).toBe(results.PubBalSht.D2);
      expect(report.I95).toBe(results["Companysecretary.xlsx!RegisterofMembers"].G1);
      expect(report.F97).toBe(results["Companysecretary.xlsx!RegisterofMembers"].G3);
    });

    it("leaves the prior year column and last year's margin empty on a book with no comparatives", () => {
      expect(results["PubP&L"].B9).toBe(0);
      expect(results.OpenAccounts.E48).toBe(0);
      expect(results["PubP&L"].B14).toBe(0);
      expect(results["PubP&L"].B54).toBe(0);
      expect(String(results.Report.I89).trim()).toBe("");
    });

    it("names the shareholders the report prints holdings for", () => {
      expect(results.Report.A97).toBe("Carol Smith");
      expect(results.Report.A98).toBe("David Brown");
      expect(results.Report.F97).toBe(60);
      expect(results.Report.F98).toBe(25);
    });

    it("carries the declared dividend from the board minute to the balance sheet", () => {
      // The board declared 15,000 and the bank paid the same in four
      // instalments, so the creditor opens and closes at nil.
      expect(results["Companysecretary.xlsx!Boardmeeting"].E4).toBe(15000);
      expect(results["Companysecretary.xlsx!Boardmeeting"].F2).toBe(results.Admin.F21);
      expect(results.TrialBalance.EJ48).toBe(15000);
      expect(results["PubP&L"].F52).toBe(15000);
      expect(results.Report.D94).toBe(15000);
      expect(results.TrialBalance.EJ31).toBe(0);
      expect(results["PubP&L"].F54).toBeCloseTo(results["PubP&L"].F51 - 15000, 6);
    });

    it("fails the report's turnover when Report E87 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Report", "E87", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("Report", "E87", value);
      expect(failureNames(corrupted)).toEqual(["Directors' report: sales turnover = published P&L turnover"]);
    });

    it("fails the report's prior year turnover when Report H87 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Report", "H87", 99);
      expect(value).toBe(99);
      const corrupted = checksWithCorruptedCell("Report", "H87", value);
      expect(failureNames(corrupted)).toEqual(["Directors' report: last year's turnover = published P&L prior year column"]);
    });

    it("fails the report's trading margin when the published gross profit is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "PubP&L", "F18", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("PubP&L", "F18", value);
      expect(failureNames(corrupted)).toEqual(["Directors' report: trading margin = published gross profit over turnover"]);
    });

    it("fails the report's year end when Report F22 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Report", "F22", 46000);
      expect(value).toBe(46000);
      const corrupted = checksWithCorruptedCell("Report", "F22", value);
      expect(failureNames(corrupted)).toEqual(["Directors' report: year end = published balance sheet date"]);
    });

    it("fails the report's dividend line when Report D94 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Report", "D94", 5000);
      expect(value).toBe(5000);
      const corrupted = checksWithCorruptedCell("Report", "D94", value);
      expect(failureNames(corrupted)).toEqual(["Directors' report: dividend declared = the board minute"]);
    });

    it("fails the report's dividend and the minute itself when Boardmeeting E4 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Companysecretary.xlsx", "Boardmeeting", "E4", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("Companysecretary.xlsx!Boardmeeting", "E4", value);
      expect(failureNames(corrupted)).toEqual([
        "Directors' report: dividend declared = the board minute",
        "Board minute: dividend declared = the scenario's declaration",
      ]);
    });

    it("fails the minute's date when Boardmeeting F2 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Companysecretary.xlsx", "Boardmeeting", "F2", 40000);
      expect(value).toBe(40000);
      const corrupted = checksWithCorruptedCell("Companysecretary.xlsx!Boardmeeting", "F2", value);
      expect(failureNames(corrupted)).toEqual(["Board minute: meeting date = the scenario's board meeting"]);
    });

    it("fails the appropriation when the published dividend line is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "PubP&L", "F52", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("PubP&L", "F52", value);
      expect(failureNames(corrupted)).toEqual(["Published P&L: dividends appropriated = the dividend the board declared"]);
    });

    it("fails the dividends creditor when TrialBalance EJ31 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "TrialBalance", "EJ31", -15000);
      expect(value).toBe(-15000);
      const corrupted = checksWithCorruptedCell("TrialBalance", "EJ31", value);
      expect(failureNames(corrupted)).toEqual(["Trial Balance: dividends creditor = opening plus declared less paid"]);
    });

    it("fails the register row when RegisterofMembers A3 is corrupted via JSZip", async () => {
      // Shared string 0 is the board minute's own heading, so the register
      // reads back a name that is not the member the scenario carries.
      const value = await readCorruptedCell(savedDir, "Companysecretary.xlsx", "RegisterofMembers", "A3", 0);
      expect(value).not.toBe("Carol Smith");
      const corrupted = checksWithCorruptedCell("Companysecretary.xlsx!RegisterofMembers", "A3", value);
      expect(failureNames(corrupted)).toEqual(["Register of members: row 3 names Carol Smith"]);
    });

    it("fails a register row's holding when RegisterofMembers G5 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Companysecretary.xlsx", "RegisterofMembers", "G5", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("Companysecretary.xlsx!RegisterofMembers", "G5", value);
      expect(failureNames(corrupted)).toEqual(["Register of members: row 5 holds Emma Wilson's shares"]);
    });

    it("fails the report's shareholder line when Report A97 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Report", "A97", "David Brown");
      expect(value).toBe("David Brown");
      const corrupted = checksWithCorruptedCell("Report", "A97", value);
      expect(failureNames(corrupted)).toEqual(["Directors' report: first shareholder named"]);
    });

    it("fails the prior year closing stock when OpenAccounts E48 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "OpenAccounts", "E48", 10000);
      expect(value).toBe(10000);
      const corrupted = checksWithCorruptedCell("OpenAccounts", "E48", value);
      expect(failureNames(corrupted)).toEqual(["Published P&L: prior year closing stock while no comparatives are entered"]);
    });

    it("fails the prior year stock movement when PubP&L B14 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "PubP&L", "B14", -10000);
      expect(value).toBe(-10000);
      const corrupted = checksWithCorruptedCell("PubP&L", "B14", value);
      expect(failureNames(corrupted)).toEqual(["Published P&L: prior year stock movement while no comparatives are entered"]);
    });

    it("fails the prior year retained profit when PubP&L B54 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "PubP&L", "B54", 10000);
      expect(value).toBe(10000);
      const corrupted = checksWithCorruptedCell("PubP&L", "B54", value);
      expect(failureNames(corrupted)).toEqual(["Published P&L: prior year retained profit while no comparatives are entered"]);
    });

    it("fails the published turnover tie when the management turnover is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "MnthP&L", "B9", 300000);
      expect(value).toBe(300000);
      const corrupted = checksWithCorruptedCell("MnthP&L", "B9", value);
      expect(failureNames(corrupted)).toEqual([
        "Total Sales",
        "P&L: Gross = Turnover - CoS",
        "Published P&L: turnover = management P&L turnover",
      ]);
    });

    it("dates the payroll calendar from 6 April and opens each payroll month on its own tax week", () => {
      const calendar = results["Payslips.xlsx!Admin"];
      // Month 6 opens tax week 22, twenty weeks and five days after 6 April.
      expect(calendar.B2).toBe(45753);
      expect(calendar.C147).toBe(22);
      expect(calendar.D147).toBe(6);
      expect(calendar.F147).toBe(1);
      expect(calendar.A147).toBe("Sep");
      expect(calendar.B147).toBe(calendar.B2 + 145);
    });

    it("fails the calendar's tax week when Payslips Admin C147 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Admin", "C147", 21);
      expect(value).toBe(21);
      const corrupted = checksWithCorruptedCell("Payslips.xlsx!Admin", "C147", value);
      expect(failureNames(corrupted)).toEqual(["Payslips calendar: payroll month 6 opens tax week 22"]);
    });

    it("fails the calendar's opening date when Payslips Admin B147 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Admin", "B147", 45000);
      expect(value).toBe(45000);
      const corrupted = checksWithCorruptedCell("Payslips.xlsx!Admin", "B147", value);
      expect(failureNames(corrupted)).toEqual(["Payslips calendar: payroll month 6 opens on the first day of tax week 22"]);
    });

    it("fails the calendar's month numbering when Payslips Admin D147 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Admin", "D147", 7);
      expect(value).toBe(7);
      const corrupted = checksWithCorruptedCell("Payslips.xlsx!Admin", "D147", value);
      expect(failureNames(corrupted)).toEqual(["Payslips calendar: the payroll months are numbered one to twelve in order"]);
    });

    it("fails the calendar's week-in-month column when Payslips Admin F147 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Payslips.xlsx", "Admin", "F147", 2);
      expect(value).toBe(2);
      const corrupted = checksWithCorruptedCell("Payslips.xlsx!Admin", "F147", value);
      expect(failureNames(corrupted)).toEqual(["Payslips calendar: every payroll month opens on its own first week"]);
    });

    it("measures the year-end seed against the year end the package was generated for", () => {
      const onItsOwnYearEnd = ltdCheckCompliance(results, expected, taxData, calculateExpectedTax, "2026-03-31");
      expect(failureNames(onItsOwnYearEnd)).toEqual([]);

      const onAnotherYearEnd = ltdCheckCompliance(results, expected, taxData, calculateExpectedTax, "2026-04-30");
      expect(failureNames(onAnotherYearEnd)).toEqual(["Admin: year-end seed = the package's own year end"]);
    });

    it("registers the charge over the company's assets and carries the loan it secures, plus the hire purchase agreements", () => {
      const charges = results["Companysecretary.xlsx!Charges&Debentures"];
      expect(charges.C2).toBe(30000);
      // 25,000 secured bank loan plus the two hire purchase agreements'
      // amounts financed (13,000 + 7,000), which reach the same TrialBalance
      // row through HPfinance!E2 (verified against the template).
      expect(results.PubBalSht.E30).toBe(45000);
    });

    it("fails the charge coverage when the directors valuation is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Companysecretary.xlsx", "Charges&Debentures", "C2", 10000);
      expect(value).toBe(10000);
      const corrupted = checksWithCorruptedCell("Companysecretary.xlsx!Charges&Debentures", "C2", value);
      expect(failureNames(corrupted)).toEqual([
        "Charges register: the balance sheet carries a creditor falling due after more than one year",
      ]);
    });

    it("fails the secured loan and its coverage when PubBalSht E30 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "PubBalSht", "E30", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("PubBalSht", "E30", value);
      expect(failureNames(corrupted)).toEqual([
        "Published balance sheet: creditors due after more than one year = the secured loan plus hire purchase agreements",
        "Charges register: the balance sheet carries a creditor falling due after more than one year",
      ]);
    });

    it("fails the stock movement when the calculated closing stock is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "Stock", "D30", 10000);
      expect(value).toBe(10000);
      const corrupted = checksWithCorruptedCell("Stock", "D30", value);
      expect(failureNames(corrupted)).toEqual([
        "Stock: loss adjustment = count - calculated",
        "Stock: calculated stock = opening + materials bought - materials sold",
      ]);
    });

    it("fails the opening long-term creditor when TrialBalance D40 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "TrialBalance", "D40", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("TrialBalance", "D40", value);
      expect(failureNames(corrupted)).toEqual(["Trial Balance opening: creditors due after more than one year"]);
    });

    // ── The creditor rows the bank codes settle. Liabilities sit negative on
    // this trial balance, so a positive figure on one of these rows is the
    // account overdrawn.

    it("settles each creditor on the row its bank code names", () => {
      const tb = results.TrialBalance;
      // Trade creditors: 2,400 brought forward plus 134,992.25 invoiced, less
      // 104,960 paid under CR, the 1,600 of CIS the journal's certificates
      // withheld and the 20,000 the two hire purchase agreements finance,
      // which EH28 moves onto the long-term row.
      expect(tb.EJ28).toBeCloseTo(-10832.25, 2);
      // CIS: 1,600 withheld on the two sub-contractor invoices and all of it
      // remitted under RC by the year end.
      expect(tb.EJ32).toBeCloseTo(0, 2);
      // VAT: 1,500 brought forward, 70,816.67 of output VAT less 22,498.71 of
      // input, against 40,682.17 paid under RV. What is left is the fourth
      // quarter, still to pay.
      expect(tb.EJ33).toBeCloseTo(-9135.79, 2);
      // PAYE: 20,078.40 deducted by the payroll and the same paid over under
      // RP, month by month.
      expect(tb.EJ34).toBeCloseTo(0, 2);
      // Corporation tax: 4,500 brought forward and paid off under RT, leaving
      // this year's charge less the tax credit on interest received.
      expect(tb.EJ35).toBeCloseTo(-29156.77, 2);
    });

    it("writes each CIS certificate into the purchase journal's own column", () => {
      const purchases = ltdCellWrites(scenario, 2025, YEAR_END_MONTH)["Purchases.xlsx"];
      const cisCells = {};
      for (const [tab, cells] of Object.entries(purchases)) {
        for (const [ref, value] of Object.entries(cells)) if (/^AK\d+$/.test(ref)) cisCells[tab] = { ref, value };
      }
      expect(Object.keys(cisCells).sort()).toEqual(["Jun", "Nov"]);
      expect(cisCells.Jun.value).toBe(1000);
      expect(cisCells.Nov.value).toBe(600);
      // The certificate sits on the same row as the invoice it was withheld
      // from, so the gross in column F and the tax in AK are one entry.
      for (const [tab, { ref }] of Object.entries(cisCells)) {
        const row = ref.slice(2);
        expect(purchases[tab][`B${row}`]).toBe("BuildTech Solutions");
      }
    });

    it("fails only the trade creditor tie when TrialBalance EJ28 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "TrialBalance", "EJ28", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("TrialBalance", "EJ28", value);
      expect(failureNames(corrupted)).toEqual([
        "Trial Balance: trade creditors = opening plus purchases, less creditor payments, CIS withheld and the amounts financed",
      ]);
    });

    it("fails only the CIS creditor tie when TrialBalance EJ32 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "TrialBalance", "EJ32", 1600);
      expect(value).toBe(1600);
      const corrupted = checksWithCorruptedCell("TrialBalance", "EJ32", value);
      expect(failureNames(corrupted)).toEqual([
        "Trial Balance: CIS creditor = the tax withheld from sub-contractors less the remittances paid under RC",
      ]);
    });

    it("fails only the VAT creditor tie when TrialBalance EJ33 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "TrialBalance", "EJ33", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("TrialBalance", "EJ33", value);
      expect(failureNames(corrupted)).toEqual([
        "Trial Balance: VAT creditor = opening plus output VAT, less input VAT and the payments coded RV",
      ]);
    });

    it("fails only the PAYE creditor tie when TrialBalance EJ34 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "TrialBalance", "EJ34", 40682.17);
      expect(value).toBe(40682.17);
      const corrupted = checksWithCorruptedCell("TrialBalance", "EJ34", value);
      expect(failureNames(corrupted)).toEqual(["Trial Balance: PAYE creditor = the year's payroll deductions less the payments coded RP"]);
    });

    it("fails only the corporation tax creditor tie when TrialBalance EJ35 is corrupted via JSZip", async () => {
      const value = await readCorruptedCell(savedDir, "Financialaccounts.xlsx", "TrialBalance", "EJ35", 0);
      expect(value).toBe(0);
      const corrupted = checksWithCorruptedCell("TrialBalance", "EJ35", value);
      expect(failureNames(corrupted)).toEqual([
        "Trial Balance: corporation tax creditor = opening plus the year's charge, less the interest tax credit and the payments coded RT",
      ]);
    });
  },
  900000,
);
