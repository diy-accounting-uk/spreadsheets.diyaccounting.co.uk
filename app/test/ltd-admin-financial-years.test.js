// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
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
import { smallProfitsRatePercentFor, apportionCorporationTax, financialYearsInPeriod } from "../lib/tax/corporation-tax.js";

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
    const cached = Object.fromEntries(
      [...linkXml.matchAll(/<cell r="([A-Z]+\d+)"[^>]*><v>([^<]*)<\/v><\/cell>/g)].map((m) => [m[1], parseFloat(m[2])]),
    );
    expect(cached.L6).toBe(serial(2025, 1, 1));
    expect(cached.N7).toBe(serial(2025, 12, 31));
    expect(cached.N11).toBe(serial(2025, 12, 31));
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

// ── The two rows' small profits rates ──────────────────────────────────────
//
// Every financial year from 2019 to 2027 charged 19%, so the two rows agree
// on every shipped package. These build a year whose predecessor charged
// something else, which is the case the sheet's two rate cells exist for.

describe("the small profits rate each tax row charges", () => {
  const FILE_YEAR = 2027;
  const twoRateTaxData = () => {
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, `ltd-${FILE_YEAR}.toml`), "utf8"));
    taxData.corporation_tax_previous_financial_year = { small_profits_rate: 0.16 };
    return taxData;
  };

  it("gives each row its own year's rate when the period straddles a change", () => {
    const taxData = twoRateTaxData();
    // 1 November 2026 to 31 October 2027: 151 days in FY2026, 214 in FY2027.
    expect(smallProfitsRatePercentFor(taxData, 2026, FILE_YEAR, 151)).toBe(16);
    expect(smallProfitsRatePercentFor(taxData, FILE_YEAR, FILE_YEAR, 214)).toBe(19);
  });

  it("charges each row's share at its own rate", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2026, 10, 1)), new Date(Date.UTC(2027, 9, 31)));
    const charge = apportionCorporationTax(36500, years, totalDays, {
      smallProfitsRatePercent: [16, 19],
      mainRatePercent: 25,
      marginalReliefFraction: 0.015,
      lowerLimit: 50000,
      upperLimit: 250000,
    });
    expect(charge.rows[0].days + charge.rows[1].days).toBe(totalDays);
    expect(charge.rows[0].ratePercent).toBe(16);
    expect(charge.rows[1].ratePercent).toBe(19);
    const shareOf = (days) => (36500 * days) / totalDays;
    expect(charge.tax).toBeCloseTo((shareOf(charge.rows[0].days) * 16) / 100 + (shareOf(charge.rows[1].days) * 19) / 100, 6);
    // Both rows at the year end's own rate would charge more, which is what
    // one rate for the whole period used to do.
    expect(charge.tax).toBeLessThan(36500 * 0.19);
  });

  it("takes the year end's own rate for a row with no days rather than a year no file states", () => {
    // A 31 March year end lies wholly in one financial year, so the second
    // row names the year after the file and charges nothing.
    expect(smallProfitsRatePercentFor(twoRateTaxData(), FILE_YEAR + 1, FILE_YEAR, 0)).toBe(19);
  });

  it("refuses a row whose financial year no file states a rate for", () => {
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, `ltd-${FILE_YEAR}.toml`), "utf8"));
    delete taxData.corporation_tax_previous_financial_year;
    expect(() => smallProfitsRatePercentFor(taxData, FILE_YEAR - 1, FILE_YEAR, 151)).toThrow(
      /states no corporation_tax_previous_financial_year/,
    );
    expect(() => smallProfitsRatePercentFor(twoRateTaxData(), FILE_YEAR - 5, FILE_YEAR, 151)).toThrow(/is neither 2027 nor the year/);
  });
});

// Each year file states the year before it, so the two would drift apart the
// first time a rate moved and only one of them was edited.
describe("every year file's previous financial year agrees with that year's own file", () => {
  const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];
  const ownRate = (year) => parseTOML(readFileSync(resolve(DATA_DIR, `ltd-${year}.toml`), "utf8")).corporation_tax.small_profits_rate;

  it.each(YEARS)("ltd-%s states its predecessor's small profits rate", (year) => {
    const stated = parseTOML(readFileSync(resolve(DATA_DIR, `ltd-${year}.toml`), "utf8")).corporation_tax_previous_financial_year;
    expect(stated?.small_profits_rate, `ltd-${year}.toml states no corporation_tax_previous_financial_year`).toBeDefined();
    // FY2019 has no file of its own: it charged a single 19% rate, the small
    // profits rate having been abolished in FY2015.
    expect(stated.small_profits_rate).toBe(YEARS.includes(year - 1) ? ownRate(year - 1) : 0.19);
  });
});
