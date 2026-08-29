// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The Admin rate table's two dated rows, and the cached values a spreadsheet
// app reads out of a closed Financialaccounts.xlsx when it updates its links.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { generateSpreadsheet, ltdAdminFinancialYearRows, toExcelSerial, utcDate } from "../lib/generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
const DATA_DIR = resolve(APP_DIR, "data");

const serial = (y, m, d) => toExcelSerial(utcDate(y, m, d));

function readCachedValue(xml, cellRef) {
  const match = xml.match(new RegExp(`<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<v>([^<]*)</v>`, "s"));
  if (!match) throw new Error(`no cached value for ${cellRef}`);
  return parseFloat(match[1]);
}

describe("ltdAdminFinancialYearRows", () => {
  it("puts a 31 March year end wholly in one financial year", () => {
    const rows = ltdAdminFinancialYearRows(serial(2026, 3, 31));
    expect(rows.L6).toBe(serial(2025, 4, 1));
    expect(rows.N6).toBe(serial(2026, 3, 31));
    expect(rows.L7).toBe(serial(2026, 4, 1));
    expect(rows.N7).toBe(serial(2026, 3, 31));
    // The second row runs from after the year end to the year end, which is
    // no days at all.
    expect(rows.N7 - rows.L7 + 1).toBe(0);
    expect(rows.K6).toBe(2025);
  });

  it("splits a 31 December year end at the 31 March inside it", () => {
    const rows = ltdAdminFinancialYearRows(serial(2025, 12, 31));
    expect(rows.L6).toBe(serial(2025, 1, 1));
    expect(rows.N6).toBe(serial(2025, 3, 31));
    expect(rows.L7).toBe(serial(2025, 4, 1));
    expect(rows.N7).toBe(serial(2025, 12, 31));
    expect(rows.N6 - rows.L6 + 1).toBe(90);
    expect(rows.N7 - rows.L7 + 1).toBe(275);
    // A financial year is named after the calendar year its 1 April falls
    // in, so 1 January to 31 March 2025 belongs to FY2024.
    expect(rows.K6).toBe(2024);
    expect(rows.K7).toBe(2025);
  });

  it("keeps the two rows to the period across a leap year", () => {
    const rows = ltdAdminFinancialYearRows(serial(2020, 4, 30));
    expect(rows.L6).toBe(serial(2019, 5, 1));
    expect(rows.N6).toBe(serial(2020, 3, 31));
    expect(rows.L7).toBe(serial(2020, 4, 1));
    expect(rows.N7).toBe(serial(2020, 4, 30));
    expect(rows.N7 - rows.L6 + 1).toBe(366);
    expect(rows.K6).toBe(2019);
    expect(rows.K7).toBe(2020);
  });

  it("splits the featured September year end in half", () => {
    const rows = ltdAdminFinancialYearRows(serial(2027, 9, 30));
    expect(rows.N6 - rows.L6 + 1).toBe(182);
    expect(rows.N7 - rows.L7 + 1).toBe(183);
    expect(rows.K6).toBe(2026);
    expect(rows.K7).toBe(2027);
  });

  it("names the financial year every year-end month lands in", () => {
    for (let month = 1; month <= 12; month++) {
      const yearEnd = toExcelSerial(new Date(Date.UTC(2026, month, 0)));
      const rows = ltdAdminFinancialYearRows(yearEnd);
      expect(rows.N7 - rows.L6 + 1, `year-end month ${month}`).toBe(365);
      expect(rows.N6 - rows.L6 + 1 + Math.max(0, rows.N7 - rows.L7 + 1), `year-end month ${month}`).toBe(365);
    }
  });
});

describe("Ltd Admin cached rate rows", () => {
  it("writes the package's own financial years into the closed workbook", async () => {
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2025.toml"), "utf8"));
    taxData.financial_year.end = "2025-12-31";
    const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));
    const buffer = await generateSpreadsheet(
      readFileSync(resolve(LTD_DIR, "Financialaccounts.xlsx")),
      taxData,
      productMeta.sheets.financialaccounts,
    );

    const zip = await JSZip.loadAsync(buffer);
    const adminXml = await zip.file(productMeta.sheets.financialaccounts.admin).async("string");
    expect(readCachedValue(adminXml, "F21")).toBe(serial(2025, 12, 31));
    expect(readCachedValue(adminXml, "L6")).toBe(serial(2025, 1, 1));
    expect(readCachedValue(adminXml, "N6")).toBe(serial(2025, 3, 31));
    expect(readCachedValue(adminXml, "L7")).toBe(serial(2025, 4, 1));
    expect(readCachedValue(adminXml, "N7")).toBe(serial(2025, 12, 31));
    expect(readCachedValue(adminXml, "K6")).toBe(2024);
    expect(readCachedValue(adminXml, "K7")).toBe(2025);
  });

  it("rolls the Fixedassets link cache to the same Admin values", async () => {
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2025.toml"), "utf8"));
    taxData.financial_year.end = "2025-12-31";
    const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));
    const buffer = await generateSpreadsheet(readFileSync(resolve(LTD_DIR, "Fixedassets.xlsx")), taxData, productMeta.sheets.fixedassets);

    const zip = await JSZip.loadAsync(buffer);
    const linkXml = await zip.file(productMeta.sheets.fixedassets.adminExternalLink).async("string");
    const cached = Object.fromEntries([...linkXml.matchAll(/<cell r="([A-Z]+\d+)"[^>]*><v>([^<]*)<\/v><\/cell>/g)].map((m) => [m[1], parseFloat(m[2])]));
    expect(cached.L6).toBe(serial(2025, 1, 1));
    expect(cached.N7).toBe(serial(2025, 12, 31));
    expect(cached.N11).toBe(serial(2025, 12, 31));
    expect(cached.E11).toBe(taxData.capital_allowances.motor_vehicle_cost_threshold);
    expect(cached.G5).toBe(Math.round(taxData.capital_allowances.annual_investment_allowance * 100));
  });

  it("refuses a link cache holding an Admin cell the generator does not write", async () => {
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2025.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));
    const linkPath = productMeta.sheets.fixedassets.adminExternalLink;

    const zip = await JSZip.loadAsync(readFileSync(resolve(LTD_DIR, "Fixedassets.xlsx")));
    const linkXml = await zip.file(linkPath).async("string");
    zip.file(linkPath, linkXml.replace(`<cell r="G5">`, `<cell r="ZZ99">`));
    const tampered = await zip.generateAsync({ type: "nodebuffer" });

    await expect(generateSpreadsheet(tampered, taxData, productMeta.sheets.fixedassets)).rejects.toThrow(/caches Admin!ZZ99/);
  });
});
