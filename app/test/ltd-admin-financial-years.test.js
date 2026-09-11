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
import { financialYearRatesFor, apportionCorporationTax, financialYearsInPeriod } from "../lib/tax/corporation-tax.js";

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

  it("writes each financial year's own rates, limits and relief fraction into a 2023 straddle", async () => {
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2023.toml"), "utf8"));
    taxData.financial_year.end = "2023-07-31";
    const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));
    const buffer = await generateSpreadsheet(
      readFileSync(resolve(LTD_DIR, "Financialaccounts.xlsx")),
      taxData,
      productMeta.sheets.financialaccounts,
    );

    const adminXml = await (await JSZip.loadAsync(buffer)).file(productMeta.sheets.financialaccounts.admin).async("string");
    expect(readCachedValue(adminXml, "K6")).toBe(2022);
    expect(readCachedValue(adminXml, "K7")).toBe(2023);

    // FY2022 charged 19% flat with no relief, so the first row's main rate is
    // its small profits rate and both its limits are nil.
    const previous = taxData.corporation_tax_previous_financial_year;
    expect(readCachedValue(adminXml, "P6")).toBe(Math.round(previous.small_profits_rate * 100));
    expect(readCachedValue(adminXml, "R6")).toBe(Math.round(previous.main_rate * 100));
    expect(readCachedValue(adminXml, "S6")).toBe(previous.marginal_relief_fraction);
    expect(readCachedValue(adminXml, "T6")).toBe(previous.small_profits_limit);
    expect(readCachedValue(adminXml, "U6")).toBe(previous.main_rate_limit);

    const own = taxData.corporation_tax;
    expect(readCachedValue(adminXml, "P7")).toBe(Math.round(own.small_profits_rate * 100));
    expect(readCachedValue(adminXml, "R7")).toBe(Math.round(own.main_rate * 100));
    expect(readCachedValue(adminXml, "S7")).toBe(own.marginal_relief_fraction);
    expect(readCachedValue(adminXml, "T7")).toBe(own.small_profits_limit);
    expect(readCachedValue(adminXml, "U7")).toBe(own.main_rate_limit);

    // The two rows charging the same figures is the defect this table exists
    // to end, so every figure the change moved has to differ.
    for (const column of ["R", "S", "T", "U"]) {
      expect(readCachedValue(adminXml, `${column}6`), `${column}6 and ${column}7`).not.toBe(readCachedValue(adminXml, `${column}7`));
    }
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

// ── What each of the two rows charges ────────────────────────────────
//
// Rows 6 and 7 of the Admin rate table each carry five figures: the small
// profits rate, the main rate, the marginal relief fraction and the two
// limits the relief tapers between. FY2022 to FY2023 moved all four of the
// last, 19% flat with no relief against 25% with relief between 50,000 and
// 250,000, so an accounting period reaching back over 1 April 2023 charges
// its two parts by different figures.

describe("what each tax row's own financial year charges", () => {
  const ltd2023 = () => parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2023.toml"), "utf8"));

  it("gives the first row FY2022's flat 19% and no relief, and the second FY2023's 25% with relief", () => {
    const taxData = ltd2023();
    // 1 August 2022 to 31 July 2023: 243 days in FY2022, 122 in FY2023.
    expect(financialYearRatesFor(taxData, 2022, 2023, 243)).toEqual({
      smallProfitsRatePercent: 19,
      mainRatePercent: 19,
      marginalReliefFraction: 0,
      lowerLimit: 0,
      upperLimit: 0,
    });
    expect(financialYearRatesFor(taxData, 2023, 2023, 122)).toEqual({
      smallProfitsRatePercent: 19,
      mainRatePercent: 25,
      marginalReliefFraction: 0.015,
      lowerLimit: 50000,
      upperLimit: 250000,
    });
  });

  it("takes the year end's own figures for a row with no days rather than figures no file states", () => {
    // A 31 March year end lies wholly in one financial year, so the second
    // row names the year after the file and charges nothing.
    expect(financialYearRatesFor(ltd2023(), 2024, 2023, 0).mainRatePercent).toBe(25);
  });

  it("charges each row's share by its own year's figures", () => {
    const taxData = ltd2023();
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2022, 7, 1)), new Date(Date.UTC(2023, 6, 31)));
    const charge = apportionCorporationTax(124419.897839506, years, totalDays, {
      perYear: years.map((financialYear) => financialYearRatesFor(taxData, financialYear.year, 2023, financialYear.days)),
    });
    expect(charge.rows[0].days + charge.rows[1].days).toBe(totalDays);
    expect(charge.rows[0].ratePercent).toBe(19);
    expect(charge.rows[1].ratePercent).toBe(25);
    expect(charge.rows[0].marginalRelief).toBe(0);
    // Both rows at the year end's own figures charge more, which is what one
    // set of figures for the whole period used to do.
    const yearEndOnly = apportionCorporationTax(124419.897839506, years, totalDays, {
      perYear: [financialYearRatesFor(taxData, 2023, 2023, 122), financialYearRatesFor(taxData, 2023, 2023, 122)],
    });
    expect(yearEndOnly.tax).toBeGreaterThan(charge.tax);
  });

  it("refuses a row whose financial year no file states figures for", () => {
    const taxData = ltd2023();
    delete taxData.corporation_tax_previous_financial_year;
    expect(() => financialYearRatesFor(taxData, 2022, 2023, 243)).toThrow(/states no corporation_tax_previous_financial_year/);
    expect(() => financialYearRatesFor(ltd2023(), 2018, 2023, 243)).toThrow(/is neither 2023 nor the year/);
  });

  it("names every figure a partly stated previous financial year is missing", () => {
    const taxData = ltd2023();
    delete taxData.corporation_tax_previous_financial_year.main_rate;
    delete taxData.corporation_tax_previous_financial_year.main_rate_limit;
    expect(() => financialYearRatesFor(taxData, 2022, 2023, 243)).toThrow(/\.main_rate,.*\.main_rate_limit/);
  });
});

// Each year file states the year before it, so the two would drift apart the
// first time a figure moved and only one of them was edited.
describe("every year file's previous financial year agrees with that year's own file", () => {
  const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];
  const ownTable = (year) => parseTOML(readFileSync(resolve(DATA_DIR, `ltd-${year}.toml`), "utf8")).corporation_tax;
  // FY2019 has no file of its own: it charged a single 19% rate, the small
  // profits rate having been abolished in FY2015 and marginal relief with it.
  const FY2019 = { main_rate: 0.19, small_profits_rate: 0.19, small_profits_limit: 0, main_rate_limit: 0, marginal_relief_fraction: 0 };

  it.each(YEARS)("ltd-%s states everything its predecessor charged", (year) => {
    const stated = parseTOML(readFileSync(resolve(DATA_DIR, `ltd-${year}.toml`), "utf8")).corporation_tax_previous_financial_year;
    expect(stated, `ltd-${year}.toml states no corporation_tax_previous_financial_year`).toBeDefined();
    const own = YEARS.includes(year - 1) ? ownTable(year - 1) : FY2019;
    for (const field of ["main_rate", "small_profits_rate", "small_profits_limit", "main_rate_limit", "marginal_relief_fraction"]) {
      expect(stated[field], `ltd-${year}.toml previous ${field}`).toBe(own[field]);
    }
  });
});
