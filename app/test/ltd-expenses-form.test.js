// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// The expenses claim form's mileage rate, and the note a form carries when the
// rate changed inside the accounting period. The workbook holds one rate for
// every month, so a period that spans the change tells the customer which two
// cells to type into to give the earlier months the earlier rate.
//
// The recalculation case requires LibreOffice (brew install --cask libreoffice)

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { generateSpreadsheet } from "../lib/generator.js";
import { runSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
const DATA_DIR = resolve(APP_DIR, "data");

const MONTH_01 = "xl/worksheets/sheet1.xml";
const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const sheetPath = (month) => `xl/worksheets/sheet${month}.xml`;
const sheetName = (month) => `Month ${String(month).padStart(2, "0")}`;

async function generateForPeriod(year, yearEnd) {
  const taxData = parseTOML(readFileSync(resolve(DATA_DIR, `ltd-${year}.toml`), "utf8"));
  taxData.financial_year.end = yearEnd;
  const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));
  return generateSpreadsheet(readFileSync(resolve(LTD_DIR, "expensesform.xlsx")), taxData, productMeta.sheets.expensesform);
}

async function generateExpensesForm(mileagePence) {
  const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2026.toml"), "utf8"));
  taxData.mileage.higher_rate_pence = mileagePence;
  const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));
  const buffer = await generateSpreadsheet(readFileSync(resolve(LTD_DIR, "expensesform.xlsx")), taxData, productMeta.sheets.expensesform);
  return JSZip.loadAsync(buffer);
}

describe("Ltd expenses claim form", () => {
  it("writes the tax year's mileage rate into the first month", async () => {
    const zip = await generateExpensesForm(0.52);
    const xml = await zip.file(MONTH_01).async("string");
    expect(xml).toContain('<c r="C30" s="15"><v>0.52</v></c>');
  });

  it("leaves the other eleven months reading the first one", async () => {
    const zip = await generateExpensesForm(0.52);
    for (let month = 2; month <= 12; month++) {
      const xml = await zip.file(`xl/worksheets/sheet${month}.xml`).async("string");
      const previous = `Month ${String(month - 1).padStart(2, "0")}`;
      expect(xml, `month ${month}`).toContain(`<f>'${previous}'!C30</f>`);
    }
  });

  it("names the sheet holding the rate, not one of the months chained from it", async () => {
    const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));
    expect(productMeta.sheets.expensesform.mileageMonths[0]).toBe(MONTH_01);

    const zip = await JSZip.loadAsync(readFileSync(resolve(LTD_DIR, "expensesform.xlsx")));
    const workbook = await zip.file("xl/workbook.xml").async("string");
    expect(workbook).toContain('<sheet name="Month 01" sheetId="1" r:id="rId1"/>');
    const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
    expect(rels).toMatch(/Id="rId1"[^>]*Target="worksheets\/sheet1\.xml"/);
  });
});

describe("Ltd expenses claim form: a rate change inside the period", () => {
  const NOTE_START = "Mileage: this workbook claims";

  it("adds no note to a period that ends before the change", async () => {
    const zip = await JSZip.loadAsync(await generateForPeriod("2025", "2026-03-31"));
    for (let month = 1; month <= 12; month++) {
      const xml = await zip.file(sheetPath(month)).async("string");
      expect(xml, sheetName(month)).not.toContain(NOTE_START);
    }
    expect(await zip.file(MONTH_01).async("string")).toContain('<c r="C30" s="15"><v>0.45</v></c>');
  });

  it("adds no note to a period that starts after the change", async () => {
    const zip = await JSZip.loadAsync(await generateForPeriod("2026", "2027-03-31"));
    for (let month = 1; month <= 12; month++) {
      const xml = await zip.file(sheetPath(month)).async("string");
      expect(xml, sheetName(month)).not.toContain(NOTE_START);
    }
    expect(await zip.file(MONTH_01).async("string")).toContain('<c r="C30" s="15"><v>0.55</v></c>');
  });

  it("puts the note in A31:E31 of every month of a period that spans the change", async () => {
    const zip = await JSZip.loadAsync(await generateForPeriod("2026", "2026-06-30"));
    const note =
      "Mileage: this workbook claims 55p a mile in every month. Before 6 April 2026 the rate was 45p. " +
      "For the months before April 2026, type 0.45 in cell C30 on sheet Month 01, then type 0.55 in cell C30 on sheet Month 10.";
    for (let month = 1; month <= 12; month++) {
      const xml = await zip.file(sheetPath(month)).async("string");
      expect(xml, sheetName(month)).toContain(`<c r="A31" s="40" t="inlineStr"><is><t>${note}</t></is></c>`);
      expect(xml, sheetName(month)).toContain('<mergeCell ref="A31:E31"/>');
      expect(xml, sheetName(month)).toContain('<mergeCells count="28">');
    }
    expect(await zip.file(MONTH_01).async("string")).toContain('<c r="C30" s="15"><v>0.55</v></c>');
  });

  it("names the sheet of the first month that ends on or after the change", async () => {
    const zip = await JSZip.loadAsync(await generateForPeriod("2026", "2026-04-30"));
    const xml = await zip.file(MONTH_01).async("string");
    expect(xml).toContain("then type 0.55 in cell C30 on sheet Month 12.");
  });

  it("keeps the note off the cells the form already uses", async () => {
    const zip = await JSZip.loadAsync(await generateForPeriod("2026", "2026-06-30"));
    const xml = await zip.file(MONTH_01).async("string");
    const row = xml.match(/<row r="31"[^>]*>.*?<\/row>/s)[0];
    expect([...row.matchAll(/<c r="([A-Z]+)31"/g)].map((m) => m[1]).slice(0, 6)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(xml).toContain('<c r="F31" s="8"><f>SUM(F10:F30)</f>');
  });
});

describeCalc("Ltd expenses claim form: the customer's correction for a spanning period", () => {
  const MILES = 100;
  const READS = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [sheetName(i + 1), ["C30", "F30"]]));
  const milesInEveryMonth = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [sheetName(i + 1), { D10: MILES }]));

  it("claims the months before April at 45p and the later months at 55p", async () => {
    const buffer = await generateForPeriod("2026", "2026-06-30");
    const workbook = Buffer.from(buffer);

    const asBuilt = await runSpreadsheet(workbook, milesInEveryMonth, READS);
    for (let month = 1; month <= 12; month++) {
      expect(asBuilt[sheetName(month)].C30, sheetName(month)).toBe(0.55);
    }

    const corrected = await runSpreadsheet(
      workbook,
      { ...milesInEveryMonth, [sheetName(1)]: { D10: MILES, C30: 0.45 }, [sheetName(10)]: { D10: MILES, C30: 0.55 } },
      READS,
    );
    for (let month = 1; month <= 9; month++) {
      expect(corrected[sheetName(month)].C30, sheetName(month)).toBe(0.45);
      expect(corrected[sheetName(month)].F30, sheetName(month)).toBeCloseTo(MILES * 0.45, 6);
    }
    for (let month = 10; month <= 12; month++) {
      expect(corrected[sheetName(month)].C30, sheetName(month)).toBe(0.55);
      expect(corrected[sheetName(month)].F30, sheetName(month)).toBeCloseTo(MILES * 0.55, 6);
    }
  }, 600000);
});
