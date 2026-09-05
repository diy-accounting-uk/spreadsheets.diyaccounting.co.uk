// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// Tax rate tables read back by provenance: a package names the app/data/
// <year>.toml its rates came from, and taxTablesForPackage reconstructs
// book.tax from that same file rather than from the Admin sheet's own
// formulas. This file proves two things the reconstruction-by-provenance
// approach does not get for free: that the file it names is the one the
// generator actually used (packageTaxDataFile), and that the rates it
// reconstructs agree with what the sheet's own formulas compute from them
// -- proven breakable by corrupting the sheet's cached result and watching
// the agreement check catch exactly that.

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { packageTaxDataFile, taxTablesForPackage } from "../lib/xlsx-exporter.js";
import { buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { calculateIncomeTax } from "../lib/tax/income-tax.js";
import { calculateCorporationTax } from "../lib/tax/corporation-tax.js";

// ── A workbook built cell by cell (mirrors xlsx-exporter.test.js's own
// construction, kept local so this file has no test-to-test coupling) ──────

function cellXml(reference, value) {
  if (value && typeof value === "object") return `<c r="${reference}"><f>${value.formula}</f><v>${value.value}</v></c>`;
  if (typeof value === "number") return `<c r="${reference}"><v>${value}</v></c>`;
  const escaped = String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<c r="${reference}" t="inlineStr"><is><t>${escaped}</t></is></c>`;
}

function sheetXml(cells) {
  const byRow = new Map();
  for (const [reference, value] of Object.entries(cells)) {
    const row = Number(/\d+$/.exec(reference)[0]);
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push(cellXml(reference, value));
  }
  const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([row, xml]) => `<row r="${row}">${xml.join("")}</row>`);
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`;
}

async function buildWorkbook(sheets) {
  const names = Object.keys(sheets);
  const zip = new JSZip();
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
      .map((name, index) => `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
      .join("")}</sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names
      .map((_, index) => `<Relationship Id="rId${index + 1}" Type="worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
      .join("")}</Relationships>`,
  );
  names.forEach((name, index) => zip.file(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheets[name])));
  return zip.generateAsync({ type: "nodebuffer" });
}

async function adminSheetOf(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);
  const xml = await zip.file(sheetMap.get("Admin")).async("string");
  return { xml, sharedStrings };
}

// ── Discovering the package's declared year from its own Admin sheet ───────

describe("packageTaxDataFile", () => {
  it("names an se-YYYY-YYYY.toml file from BST/Taxi/SE's B23 label", async () => {
    const buffer = await buildWorkbook({ Admin: { B23: "2024-25" } });
    const { xml, sharedStrings } = await adminSheetOf(buffer);
    expect(packageTaxDataFile(xml, sharedStrings, "bst")).toBe("se-2024-2025.toml");
    expect(packageTaxDataFile(xml, sharedStrings, "taxi")).toBe("se-2024-2025.toml");
    expect(packageTaxDataFile(xml, sharedStrings, "se")).toBe("se-2024-2025.toml");
  });

  it("names an ltd-YYYY.toml file from Ltd's F21 year-end date, a March year end", async () => {
    // 45747 is 2025-03-31 as an Excel serial: a January-March year end names
    // the financial year that started the calendar year before.
    const buffer = await buildWorkbook({ Admin: { F21: 45747 } });
    const { xml, sharedStrings } = await adminSheetOf(buffer);
    expect(packageTaxDataFile(xml, sharedStrings, "ltd")).toBe("ltd-2024.toml");
  });

  it("names an ltd-YYYY.toml file from Ltd's F21 year-end date, a non-March year end", async () => {
    // 45808 is 2025-05-31. Admin!K6 answers a different question (the UK
    // financial year the accounting period *starts* in, for apportioning
    // profit across a straddled period) and would name 2024 here -- the
    // generate-ltd.yml reconciliation matrix's own FYSTART rule, which this
    // mirrors, names 2025 instead: an April-December year end names the
    // financial year starting that same calendar year.
    const buffer = await buildWorkbook({ Admin: { F21: 45808 } });
    const { xml, sharedStrings } = await adminSheetOf(buffer);
    expect(packageTaxDataFile(xml, sharedStrings, "ltd")).toBe("ltd-2025.toml");
  });

  it("names nothing for a book filled in by hand, which carries no year label", async () => {
    const buffer = await buildWorkbook({ Admin: { A1: "unrelated" } });
    const { xml, sharedStrings } = await adminSheetOf(buffer);
    expect(packageTaxDataFile(xml, sharedStrings, "bst")).toBeUndefined();
    expect(packageTaxDataFile(xml, sharedStrings, "ltd")).toBeUndefined();
  });
});

// ── The reconstructed table itself ──────────────────────────────────────────

describe("taxTablesForPackage", () => {
  it("reconstructs SE's income tax bands as absolute income thresholds, not the toml's own band-ends", async () => {
    // app/data/se-2024-2025.toml bands profit net of the personal allowance
    // (basic_band_end 37700, higher_band_end 125140); the book schema's
    // higherRateThreshold and additionalRateThreshold are both absolute
    // income points instead, so the reconstruction has to add the personal
    // allowance back onto the basic band rather than copy the toml's field.
    const buffer = await buildWorkbook({ Admin: { B23: "2024-25" } });
    const { xml, sharedStrings } = await adminSheetOf(buffer);
    const tax = taxTablesForPackage(xml, sharedStrings, "se");
    expect(tax.incomeTax).toEqual({
      personalAllowance: 12570,
      personalAllowanceTaperThreshold: 100000,
      basicRate: 0.2,
      basicRateLimit: 37700,
      higherRate: 0.4,
      higherRateThreshold: 50270,
      additionalRate: 0.45,
      additionalRateThreshold: 125140,
    });
  });

  it("reconstructs Ltd's corporation tax and dividend tables from the same year's toml", async () => {
    const buffer = await buildWorkbook({ Admin: { F21: 45747 } });
    const { xml, sharedStrings } = await adminSheetOf(buffer);
    const tax = taxTablesForPackage(xml, sharedStrings, "ltd");
    expect(tax.corporationTax).toEqual({
      smallProfitsRate: 0.19,
      smallProfitsLimit: 50000,
      mainRate: 0.25,
      mainRateThreshold: 250000,
    });
    expect(tax.dividends).toEqual({ allowance: 500, basicRate: 0.0875, higherRate: 0.3375, additionalRate: 0.3935 });
  });

  it("leaves the AIA cap and Class 1 employee NI unmapped -- no app/data/*.toml field carries them", async () => {
    // annual_investment_allowance in app/data/*.toml is the 0-1 relief scale
    // (100% relief up to the cap), not the schema's absolute cap in pounds,
    // and no app/data/*.toml carries the employee side of Class 1 NI at all.
    const buffer = await buildWorkbook({ Admin: { F21: 45747 } });
    const { xml, sharedStrings } = await adminSheetOf(buffer);
    const tax = taxTablesForPackage(xml, sharedStrings, "ltd");
    expect(tax.capitalAllowances.annualInvestmentAllowance).toBeUndefined();
    expect(tax.nationalInsurance?.class1EmployeeMainRate).toBeUndefined();
  });

  it("returns nothing for a year app/data/ has no file for", async () => {
    const buffer = await buildWorkbook({ Admin: { F21: 36250 } });
    const { xml, sharedStrings } = await adminSheetOf(buffer);
    expect(taxTablesForPackage(xml, sharedStrings, "ltd")).toEqual({});
  });

  it("leaves tax.vat unmapped for BST and Taxi -- their sheets carry no VAT rate cell of their own", async () => {
    // app/data/se-2024-2025.toml carries a [vat] block (SE reads it back
    // through its own Sales tab rate cell, VAT_RATE_CELLS.se), but BST and
    // Taxi ship no VAT rate cell at all -- the same absence that leaves
    // entityInformation.diya-gl:vatRegistered declared absent for both in
    // roundtrip-unrepresentable.json. Restating the year file's VAT rates on
    // either book would carry a rate the package never entered.
    const buffer = await buildWorkbook({ Admin: { B23: "2024-25" } });
    const { xml, sharedStrings } = await adminSheetOf(buffer);
    expect(taxTablesForPackage(xml, sharedStrings, "bst").vat).toBeUndefined();
    expect(taxTablesForPackage(xml, sharedStrings, "taxi").vat).toBeUndefined();
    expect(taxTablesForPackage(xml, sharedStrings, "se").vat).toEqual({ standardRate: 0.2, registrationThreshold: 90000 });
  });
});

// ── The guard: the sheet's own formula results agree with the emitted table ─
//
// Reconstructing the table is not enough on its own -- it also has to be the
// table the sheet's formulas actually ran on. Each check below takes a
// rate-dependent cell the package caches a formula result in, recomputes
// that result independently from nothing but the emitted book.tax table (via
// the same calculators the JS engine uses), and asserts the two agree.

describe("the emitted rates agree with the sheet's own formula results", () => {
  it("SE/BST/Taxi: Income Tax!E11 (total due) matches calculateIncomeTax fed by the emitted incomeTax table", async () => {
    // app/data/se-2024-2025.toml at a profit of 60000: personal allowance
    // untapered (60000 < 100000), so pa=12570, taxableIncome=47430; the
    // basic band takes 37700 of it at 20% (7540) and the remaining 9730 at
    // 40% (3892); nothing reaches the additional rate. 7540+3892=11432.
    const profit = 60000;
    const buffer = await buildWorkbook({
      "Admin": { B23: "2024-25" },
      "Income Tax": { E5: profit, E11: { formula: "SUM(E8:E10)", value: 11432 } },
    });

    const zip = await JSZip.loadAsync(buffer);
    const sheetMap = await buildSheetMap(zip);
    const sharedStrings = await loadSharedStrings(zip);
    const adminXml = await zip.file(sheetMap.get("Admin")).async("string");
    const incomeTaxXml = await zip.file(sheetMap.get("Income Tax")).async("string");

    const tax = taxTablesForPackage(adminXml, sharedStrings, "se");
    const taxRates = {
      personal_allowance: tax.incomeTax.personalAllowance,
      personal_allowance_taper_threshold: tax.incomeTax.personalAllowanceTaperThreshold,
      basic_band_end: tax.incomeTax.basicRateLimit,
      higher_band_end: tax.incomeTax.additionalRateThreshold,
      basic_rate: tax.incomeTax.basicRate,
      higher_rate: tax.incomeTax.higherRate,
      additional_rate: tax.incomeTax.additionalRate,
    };

    const sheetProfit = readCellValue(incomeTaxXml, "E5", sharedStrings);
    const cachedTotal = readCellValue(incomeTaxXml, "E11", sharedStrings);
    const recomputed = calculateIncomeTax(sheetProfit, taxRates).totalIncomeTax;

    expect(Math.round(recomputed)).toBe(Math.round(cachedTotal));
    expect(Math.round(cachedTotal)).toBe(11432);

    // Proof of breakability: corrupt the copy's cached E11 alone and the
    // same recompute now disagrees with it -- the check catches exactly
    // this cell, not a check that would pass no matter what the sheet held.
    const corruptedXml = incomeTaxXml.replace(
      /<c r="E11"><f>SUM\(E8:E10\)<\/f><v>11432<\/v><\/c>/,
      `<c r="E11"><f>SUM(E8:E10)</f><v>99999</v></c>`,
    );
    expect(corruptedXml).not.toBe(incomeTaxXml);
    const corruptedCachedTotal = readCellValue(corruptedXml, "E11", sharedStrings);
    expect(Math.round(recomputed)).not.toBe(Math.round(corruptedCachedTotal));
  });

  it("Ltd: CorporationTax!K35 (the charge) matches calculateCorporationTax fed by the emitted corporationTax table", async () => {
    // app/data/ltd-2024.toml at a profit of 100000, inside the marginal
    // relief band (50000, 250000]: mainTax = 100000*0.25 = 25000, relief =
    // (250000-100000)*0.015 = 2250, charge = 22750.
    const profit = 100000;
    const buffer = await buildWorkbook({
      Admin: { F21: 45747 },
      CorporationTax: { K28: profit, K35: { formula: "K33-K34", value: 22750 } },
    });

    const zip = await JSZip.loadAsync(buffer);
    const sheetMap = await buildSheetMap(zip);
    const sharedStrings = await loadSharedStrings(zip);
    const adminXml = await zip.file(sheetMap.get("Admin")).async("string");
    const ctXml = await zip.file(sheetMap.get("CorporationTax")).async("string");

    const tax = taxTablesForPackage(adminXml, sharedStrings, "ltd");
    const ctRates = {
      small_profits_rate: tax.corporationTax.smallProfitsRate,
      main_rate: tax.corporationTax.mainRate,
      small_profits_limit: tax.corporationTax.smallProfitsLimit,
      main_rate_limit: tax.corporationTax.mainRateThreshold,
      // marginal_relief_fraction has no book.tax field -- calculateCorporationTax
      // defaults it to 0.015, the same standing figure diya-gl-loader.js's
      // extractTaxDataFromBook already assumes for the same reason.
    };

    const sheetProfit = readCellValue(ctXml, "K28", sharedStrings);
    const cachedCharge = readCellValue(ctXml, "K35", sharedStrings);
    const recomputed = calculateCorporationTax(sheetProfit, ctRates).corporationTax;

    expect(recomputed).toBeCloseTo(cachedCharge, 2);
    expect(cachedCharge).toBe(22750);

    // Proof of breakability: corrupt the copy's cached K35 alone.
    const corruptedXml = ctXml.replace(/<c r="K35"><f>K33-K34<\/f><v>22750<\/v><\/c>/, `<c r="K35"><f>K33-K34</f><v>18000</v></c>`);
    expect(corruptedXml).not.toBe(ctXml);
    const corruptedCachedCharge = readCellValue(corruptedXml, "K35", sharedStrings);
    expect(recomputed).not.toBeCloseTo(corruptedCachedCharge, 2);
  });
});
