// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect, beforeAll } from "vitest";
import { parse as parseTOML } from "smol-toml";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  generateSpreadsheet,
  generateAdminDates,
  toExcelSerial,
  buildCellEdits,
  buildLtdCellEdits,
  formatDateDDMMYY,
  formatDateYYYYMMDD,
  shortLabel,
  utcDate,
  monthEnd,
  generateTaxYearWeeks,
  groupWeeksIntoMonths,
  buildSalesSheetXml,
} from "../lib/generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const BST_DIR = resolve(APP_DIR, "templates", "bst");
const TAXI_DIR = resolve(APP_DIR, "templates", "taxi");
const DATA_DIR = resolve(APP_DIR, "data");

// ── Date helpers ────────────────────────────────────────────────────────────

describe("date helpers", () => {
  it("toExcelSerial converts known dates correctly", () => {
    // 1 Jan 2024 = serial 45292
    expect(toExcelSerial(utcDate(2024, 1, 1))).toBe(45292);
    // 6 Apr 2025 = serial 45753
    expect(toExcelSerial(utcDate(2025, 4, 6))).toBe(45753);
  });

  it("monthEnd handles leap years", () => {
    const feb2024 = monthEnd(2024, 2);
    expect(feb2024.getUTCDate()).toBe(29); // 2024 is a leap year

    const feb2025 = monthEnd(2025, 2);
    expect(feb2025.getUTCDate()).toBe(28); // 2025 is not
  });

  it("formatDateDDMMYY formats correctly", () => {
    expect(formatDateDDMMYY(utcDate(2026, 4, 5))).toBe("050426");
    expect(formatDateDDMMYY(utcDate(2025, 4, 5))).toBe("050425");
  });

  it("formatDateYYYYMMDD formats correctly", () => {
    expect(formatDateYYYYMMDD(utcDate(2026, 4, 5))).toBe("2026-04-05");
  });

  it("shortLabel formats correctly", () => {
    expect(shortLabel(utcDate(2026, 4, 5))).toBe("Apr26");
    expect(shortLabel(utcDate(2025, 4, 5))).toBe("Apr25");
  });
});

// ── Admin dates ─────────────────────────────────────────────────────────────

describe("generateAdminDates", () => {
  it("generates correct dates for 2024-25 tax year", () => {
    const dates = generateAdminDates(2024);
    expect(dates.B4.toISOString()).toBe("2024-04-06T00:00:00.000Z"); // tax year start
    expect(dates.B17.toISOString()).toBe("2025-04-05T00:00:00.000Z"); // tax year end
    expect(dates.B2.getUTCDate()).toBe(29); // Feb 2024 leap year
    expect(dates.B21.toISOString()).toBe("2026-01-31T00:00:00.000Z"); // payment date
    expect(dates.B22.toISOString()).toBe("2026-07-31T00:00:00.000Z"); // payment date
  });

  it("generates correct dates for 2025-26 tax year", () => {
    const dates = generateAdminDates(2025);
    expect(dates.B4.toISOString()).toBe("2025-04-06T00:00:00.000Z");
    expect(dates.B17.toISOString()).toBe("2026-04-05T00:00:00.000Z");
    expect(dates.B15.getUTCDate()).toBe(28); // Feb 2026 not leap
    expect(dates.B21.toISOString()).toBe("2027-01-31T00:00:00.000Z");
    expect(dates.B22.toISOString()).toBe("2027-07-31T00:00:00.000Z");
  });
});

// ── Cell edits ──────────────────────────────────────────────────────────────

describe("buildCellEdits", () => {
  const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));

  it("produces numeric edits for all expected cells", () => {
    const { numericEdits } = buildCellEdits(taxData, 2025);
    // Dates
    expect(numericEdits.B4).toBe(toExcelSerial(utcDate(2025, 4, 6)));
    expect(numericEdits.B17).toBe(toExcelSerial(utcDate(2026, 4, 5)));
    // Tax rates
    expect(numericEdits.N4).toBe(12570);
    expect(numericEdits.N7).toBe(0.2);
    expect(numericEdits.G4).toBe(1);
    expect(numericEdits.F26).toBe(90000);
  });

  it("produces string edits for tax year labels", () => {
    const { stringEdits } = buildCellEdits(taxData, 2025);
    expect(stringEdits.B23).toBe("2025-26");
    expect(stringEdits.B24).toBe("2026-27");
  });
});

// ── Spreadsheet generation ──────────────────────────────────────────────────

describe("generateSpreadsheet", () => {
  const productMeta = parseTOML(readFileSync(resolve(BST_DIR, "meta.toml"), "utf8"));
  const templatePath = resolve(BST_DIR, productMeta.template.spreadsheet);
  let templateBuffer;

  beforeAll(() => {
    templateBuffer = readFileSync(templatePath);
  });

  it("generates a valid xlsx buffer for 2025-26", async () => {
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const buffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100000); // sanity check size
    // Verify it's a valid zip (xlsx) — starts with PK signature
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });

  it("generates a valid xlsx buffer for 2024-25", async () => {
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2024-2025.toml"), "utf8"));
    const buffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100000);
  });

  it("contains correct Admin cell values in generated xlsx", async () => {
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2024-2025.toml"), "utf8"));
    const buffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);

    // Read back the Admin sheet XML from the generated zip
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const adminXml = await zip.file(productMeta.sheets.admin).async("string");

    // Check B4 contains the 2024-25 tax year start serial
    const b4Serial = toExcelSerial(utcDate(2024, 4, 6));
    expect(adminXml).toContain(`r="B4"`);
    expect(adminXml).toContain(`<v>${b4Serial}</v>`);

    // Check B23 contains the tax year label as inline string
    expect(adminXml).toContain(`r="B23"`);
    expect(adminXml).toContain("<t>2024-25</t>");

    // Check N4 contains personal allowance
    expect(adminXml).toContain(`<v>12570</v>`);
  });
});

// ── SE cell edits ─────────────────────────────────────────────────────────

import { buildSeCellEdits, generatePayslipsCalendar } from "../lib/generator.js";

const SE_DIR = resolve(APP_DIR, "templates", "se");

describe("buildSeCellEdits", () => {
  const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));

  it("uses SE-specific cell positions for income tax", () => {
    const { numericEdits } = buildSeCellEdits(taxData, 2025);
    // SE puts basic rate at N6 (BST puts starting_rate there)
    expect(numericEdits.N6).toBe(0.2);
    // SE puts higher rate at N7 (BST puts basic_rate there)
    expect(numericEdits.N7).toBe(0.4);
    // SE has no N8 (BST puts higher_rate there)
    expect(numericEdits.N8).toBeUndefined();
    // SE basic band end at M11 (BST uses M12)
    expect(numericEdits.M11).toBe(37700);
    expect(numericEdits.M12).toBeUndefined();
    // SE higher band start at L12/N12 (BST uses L13/N13)
    expect(numericEdits.L12).toBe(37701);
    expect(numericEdits.N12).toBe(37701);
  });

  it("uses L16 for NI Class 2 (not L17)", () => {
    const { numericEdits } = buildSeCellEdits(taxData, 2025);
    expect(numericEdits.L16).toBe(0);
    expect(numericEdits.L17).toBeUndefined();
  });

  it("includes VAT standard rate at F27", () => {
    const { numericEdits } = buildSeCellEdits(taxData, 2025);
    expect(numericEdits.F27).toBe(0.2);
  });

  it("handles non-zero NI Class 2 for older years", () => {
    const taxData2021 = parseTOML(readFileSync(resolve(DATA_DIR, "se-2020-2021.toml"), "utf8"));
    const { numericEdits } = buildSeCellEdits(taxData2021, 2020);
    expect(numericEdits.L16).toBe(3.05);
  });
});

describe("generatePayslipsCalendar", () => {
  it("generates 380 rows of C, D, F values", () => {
    const edits = generatePayslipsCalendar(2025);
    // 380 rows * 3 columns = 1140 cells
    expect(Object.keys(edits).length).toBe(1140);
    // First row
    expect(edits.C2).toBe(1);
    expect(edits.D2).toBe(1);
    expect(edits.F2).toBe(1);
    // Last row
    expect(edits.C381).toBe(53);
    expect(edits.D381).toBe(12);
    expect(edits.F381).toBe(6);
  });

  it("week 1 is always 5 days (rows 2-6)", () => {
    const edits = generatePayslipsCalendar(2025);
    for (let row = 2; row <= 6; row++) {
      expect(edits[`C${row}`]).toBe(1);
    }
    expect(edits.C7).toBe(2); // week 2 starts at row 7
  });

  it("follows 4-4-5 month pattern", () => {
    const edits = generatePayslipsCalendar(2025);
    // Count weeks per month
    const weeksPerMonth = {};
    for (let row = 2; row <= 381; row++) {
      const month = edits[`D${row}`];
      const week = edits[`C${row}`];
      if (!weeksPerMonth[month]) weeksPerMonth[month] = new Set();
      weeksPerMonth[month].add(week);
    }
    const counts = Array.from({ length: 12 }, (_, i) => weeksPerMonth[i + 1].size);
    expect(counts).toEqual([4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 6]);
  });

  it("produces same values for different years", () => {
    // The algorithm is deterministic regardless of day-of-week
    const edits2020 = generatePayslipsCalendar(2020);
    const edits2025 = generatePayslipsCalendar(2025);
    // Both should have identical week/month/weekInMonth patterns
    expect(edits2020.C2).toBe(edits2025.C2);
    expect(edits2020.C7).toBe(edits2025.C7);
    expect(edits2020.D381).toBe(edits2025.D381);
  });
});

describe("SE generateSpreadsheet", () => {
  it("generates valid SE Financialaccounts.xlsx", async () => {
    if (!existsSync(resolve(SE_DIR, "Financialaccounts.xlsx"))) return;

    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const seMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));
    const templateBuffer = readFileSync(resolve(SE_DIR, "Financialaccounts.xlsx"));

    const buffer = await generateSpreadsheet(templateBuffer, taxData, seMeta.sheets.financialaccounts);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer[0]).toBe(0x50); // PK zip signature

    // Verify SE-specific cell values in Admin
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const adminXml = await zip.file(seMeta.sheets.financialaccounts.admin).async("string");

    // N6 should be 0.2 (basic_rate in SE, not starting_rate like BST)
    expect(adminXml).toMatch(/<c\s+r="N6"[^>]*><v>0\.2<\/v><\/c>/);
    // F27 should be 0.2 (VAT rate, SE only)
    expect(adminXml).toMatch(/<c\s+r="F27"[^>]*><v>0\.2<\/v><\/c>/);
  });

  it("generates valid SE Payslips.xlsx with calendar", async () => {
    if (!existsSync(resolve(SE_DIR, "Payslips.xlsx"))) return;

    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const seMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));
    const templateBuffer = readFileSync(resolve(SE_DIR, "Payslips.xlsx"));

    const buffer = await generateSpreadsheet(templateBuffer, taxData, seMeta.sheets.payslips);
    expect(buffer).toBeInstanceOf(Buffer);

    // Verify B2 = tax year start serial (45753 for Apr 6, 2025)
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const payslipsXml = await zip.file(seMeta.sheets.payslips.payslipsAdmin).async("string");
    expect(payslipsXml).toMatch(/<c\s+r="B2"[^>]*><v>45753<\/v><\/c>/);
  });
});

// ── Ltd cell edits ────────────────────────────────────────────────────────

const LTD_DIR = resolve(APP_DIR, "templates", "ltd-mar");

describe("buildLtdCellEdits", () => {
  const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2025.toml"), "utf8"));

  it("sets F21 to the year-end date serial", () => {
    const yearEndSerial = toExcelSerial(utcDate(2026, 3, 31));
    const { numericEdits } = buildLtdCellEdits(taxData, yearEndSerial);
    expect(numericEdits.F21).toBe(yearEndSerial);
  });

  it("sets CT rate as whole-number percentage", () => {
    const { numericEdits } = buildLtdCellEdits(taxData, 46112);
    expect(numericEdits.P6).toBe(19);
    expect(numericEdits.P7).toBe(19);
  });

  it("sets VAT rate as whole-number percentage", () => {
    const { numericEdits } = buildLtdCellEdits(taxData, 46112);
    expect(numericEdits.M19).toBe(20);
    expect(numericEdits.M21).toBe(20);
  });

  it("sets capital allowances as whole-number percentages", () => {
    const { numericEdits } = buildLtdCellEdits(taxData, 46112);
    expect(numericEdits.G5).toBe(100);
    expect(numericEdits.G6).toBe(18);
  });

  it("sets depreciation rates as fractions", () => {
    const { numericEdits } = buildLtdCellEdits(taxData, 46112);
    expect(numericEdits.G16).toBe(0.1);
    expect(numericEdits.G17).toBe(0.2);
    expect(numericEdits.G18).toBe(0.33);
    expect(numericEdits.G19).toBe(0.25);
  });

  it("has no string edits (all dates are formula-driven)", () => {
    const { stringEdits } = buildLtdCellEdits(taxData, 46112);
    expect(Object.keys(stringEdits).length).toBe(0);
  });
});

describe("Ltd generateSpreadsheet", () => {
  it("generates valid Ltd Financialaccounts.xlsx", async () => {
    if (!existsSync(resolve(LTD_DIR, "Financialaccounts.xlsx"))) return;

    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2025.toml"), "utf8"));
    const ltdMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));
    const templateBuffer = readFileSync(resolve(LTD_DIR, "Financialaccounts.xlsx"));

    const buffer = await generateSpreadsheet(templateBuffer, taxData, ltdMeta.sheets.financialaccounts);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer[0]).toBe(0x50);

    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const adminXml = await zip.file(ltdMeta.sheets.financialaccounts.admin).async("string");

    expect(adminXml).toMatch(/<c\s+r="F21"[^>]*><v>46112<\/v><\/c>/);
    expect(adminXml).toMatch(/<c\s+r="P6"[^>]*><v>19<\/v><\/c>/);
  });
});

// ── Tax year weeks ─────────────────────────────────────────────────────────

describe("generateTaxYearWeeks", () => {
  it("generates 53 weeks for 2025-26 (Apr 6 = Sunday)", () => {
    const weeks = generateTaxYearWeeks(2025);
    // First week: just Sunday Apr 6 (1 day)
    expect(weeks[0]).toHaveLength(1);
    expect(weeks[0][0].getUTCDay()).toBe(0); // Sunday
    // Second week: Mon Apr 7 - Sun Apr 13 (7 days)
    expect(weeks[1]).toHaveLength(7);
    expect(weeks[1][0].getUTCDay()).toBe(1); // Monday
    // Total days = 365
    const totalDays = weeks.reduce((sum, w) => sum + w.length, 0);
    expect(totalDays).toBe(365);
  });

  it("generates 53 weeks for 2020-21 (Apr 6 = Monday)", () => {
    const weeks = generateTaxYearWeeks(2020);
    // First week: Mon-Sun (full 7 days)
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[0][0].getUTCDay()).toBe(1); // Monday
    // Last week: just Mon Apr 5 (1 day)
    expect(weeks[weeks.length - 1]).toHaveLength(1);
    expect(weeks[weeks.length - 1][0].getUTCDay()).toBe(1); // Monday
    const totalDays = weeks.reduce((sum, w) => sum + w.length, 0);
    expect(totalDays).toBe(365);
  });

  it("handles leap year 2023-24 (366 days)", () => {
    const weeks = generateTaxYearWeeks(2023);
    const totalDays = weeks.reduce((sum, w) => sum + w.length, 0);
    expect(totalDays).toBe(366);
  });
});

describe("groupWeeksIntoMonths", () => {
  it("groups 2025-26 weeks correctly", () => {
    const weeks = generateTaxYearWeeks(2025);
    const months = groupWeeksIntoMonths(weeks);

    // SalesApr: 4 weeks (1 partial + 3 full)
    expect(months.apr).toHaveLength(4);
    // SalesMay: 4 weeks
    expect(months.may).toHaveLength(4);
    // SalesJun: 5 weeks
    expect(months.jun).toHaveLength(5);
    // SalesMar: 6 weeks (last month collects remaining)
    expect(months.mar).toHaveLength(6);

    // Total weeks across all months = total weeks
    const totalWeeks = Object.values(months).reduce((sum, m) => sum + m.length, 0);
    expect(totalWeeks).toBe(weeks.length);
  });

  it("groups 2020-21 weeks correctly (Apr 6 = Monday)", () => {
    const weeks = generateTaxYearWeeks(2020);
    const months = groupWeeksIntoMonths(weeks);

    // First week is full Mon-Sun (Apr 6-12), Sunday Apr 12 → April
    // Weeks: Apr 6-12, Apr 13-19, Apr 20-26. Apr 27 Sunday = May 3 → goes to May
    expect(months.apr).toHaveLength(3);
    // Last partial week (1 day: Mon Apr 5) goes to March
    expect(months.mar[months.mar.length - 1]).toHaveLength(1);
  });
});

describe("buildSalesSheetXml", () => {
  it("generates correct XML for a single full week", () => {
    // One full week: Mon-Sun
    const week = [
      utcDate(2025, 4, 7), utcDate(2025, 4, 8), utcDate(2025, 4, 9),
      utcDate(2025, 4, 10), utcDate(2025, 4, 11), utcDate(2025, 4, 12),
      utcDate(2025, 4, 13),
    ];
    const { xml, lastRow } = buildSalesSheetXml([week]);

    // Header (rows 1-4) + 7 days (5-11) + rental (12) + other income (13) + subtotal (14)
    expect(lastRow).toBe(14);
    // Contains date serials
    expect(xml).toContain(`<v>${toExcelSerial(utcDate(2025, 4, 7))}</v>`);
    expect(xml).toContain(`<v>${toExcelSerial(utcDate(2025, 4, 13))}</v>`);
    // Contains "Rental due" shared string reference
    expect(xml).toContain(`t="s"><v>234</v>`);
    // Contains "Any other income" shared string reference
    expect(xml).toContain(`t="s"><v>233</v>`);
    // Contains subtotal formula
    expect(xml).toContain(`SUM(E5:E13)`);
    // Contains column total formula with /2
    expect(xml).toContain(`SUM(E4:E14)/2`);
  });

  it("generates correct XML for a partial week (1 day)", () => {
    const week = [utcDate(2025, 4, 6)]; // Sunday only
    const { xml, lastRow } = buildSalesSheetXml([week]);

    // Header (rows 1-4) + 1 day (5) + rental (6) + other income (7) + subtotal (8)
    expect(lastRow).toBe(8);
    expect(xml).toContain(`SUM(E5:E7)`); // subtotal covers rows 5-7
    expect(xml).toContain(`SUM(E4:E8)/2`); // column total
  });

  it("generates correct row count for 4 weeks", () => {
    const weeks = generateTaxYearWeeks(2025);
    const months = groupWeeksIntoMonths(weeks);
    const { lastRow } = buildSalesSheetXml(months.apr);

    // Apr 2025-26: 4 weeks (1-day partial + 3 full weeks)
    // Header: rows 1-4 (4 rows)
    // Week 1: 1 day + rental + other income + subtotal = 4 rows (5-8)
    // Separator: 1 row (9)
    // Week 2: 7 days + rental + other + subtotal = 10 rows (10-19)
    // Separator: 1 row (20)
    // Week 3: 7 days + rental + other + subtotal = 10 rows (21-30)
    // Separator: 1 row (31)
    // Week 4: 7 days + rental + other + subtotal = 10 rows (32-41) — no trailing separator
    expect(lastRow).toBe(41);
  });
});

// ── Taxi spreadsheet generation ───────────────────────────────────────────

describe("generateSpreadsheet (taxi)", () => {
  const productMeta = parseTOML(readFileSync(resolve(TAXI_DIR, "meta.toml"), "utf8"));
  const templatePath = resolve(TAXI_DIR, productMeta.template.spreadsheet);
  let templateBuffer;

  beforeAll(() => {
    templateBuffer = readFileSync(templatePath);
  });

  it("generates a valid xlsx with Sales sheet dates for 2025-26", async () => {
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const buffer = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100000);

    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);

    // Verify SalesApr has the correct dates
    const salesAprXml = await zip.file("xl/worksheets/sheet9.xml").async("string");
    const apr6Serial = toExcelSerial(utcDate(2025, 4, 6));
    expect(salesAprXml).toContain(`<v>${apr6Serial}</v>`); // April 6 date

    // Verify SalesMar extends to April 5
    const salesMarXml = await zip.file("xl/worksheets/sheet31.xml").async("string");
    const apr5Serial = toExcelSerial(utcDate(2026, 4, 5));
    expect(salesMarXml).toContain(`<v>${apr5Serial}</v>`); // April 5 date
  });

  it("generates different row layouts for different years", async () => {
    const JSZip = (await import("jszip")).default;

    const taxData25 = parseTOML(readFileSync(resolve(DATA_DIR, "se-2024-2025.toml"), "utf8"));
    const buffer25 = await generateSpreadsheet(templateBuffer, taxData25, productMeta.sheets);
    const zip25 = await JSZip.loadAsync(buffer25);
    const apr25Xml = await zip25.file("xl/worksheets/sheet9.xml").async("string");

    const taxData26 = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const buffer26 = await generateSpreadsheet(templateBuffer, taxData26, productMeta.sheets);
    const zip26 = await JSZip.loadAsync(buffer26);
    const apr26Xml = await zip26.file("xl/worksheets/sheet9.xml").async("string");

    // Different years have different dimension ranges (different number of rows)
    const dim25 = apr25Xml.match(/<dimension ref="([^"]*)"/)[1];
    const dim26 = apr26Xml.match(/<dimension ref="([^"]*)"/)[1];
    // Apr 2024-25 (Apr 6 = Saturday, 2-day first week) vs Apr 2025-26 (Apr 6 = Sunday, 1-day first week)
    // Both have 4 weeks in April but different row counts due to different partial week sizes
    expect(dim25).not.toBe(dim26);
  });
});

// ── Template and data file existence ────────────────────────────────────────

describe("file structure", () => {
  it("BST template spreadsheet exists", () => {
    expect(existsSync(resolve(BST_DIR, "bst-excel.xlsx"))).toBe(true);
  });

  it("BST guide markdown exists", () => {
    expect(existsSync(resolve(BST_DIR, "bst-guide.md"))).toBe(true);
  });

  it("BST product metadata exists", () => {
    expect(existsSync(resolve(BST_DIR, "meta.toml"))).toBe(true);
  });

  it("Taxi template spreadsheet exists", () => {
    expect(existsSync(resolve(TAXI_DIR, "taxi-excel.xlsx"))).toBe(true);
  });

  it("Taxi product metadata exists", () => {
    expect(existsSync(resolve(TAXI_DIR, "meta.toml"))).toBe(true);
  });

  it("shared metadata exists", () => {
    expect(existsSync(resolve(APP_DIR, "templates", "meta.toml"))).toBe(true);
  });

  it("tax data files exist with correct naming convention", () => {
    expect(existsSync(resolve(DATA_DIR, "se-2024-2025.toml"))).toBe(true);
    expect(existsSync(resolve(DATA_DIR, "se-2025-2026.toml"))).toBe(true);
  });

  it("tax data files parse correctly", () => {
    const data = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    expect(data.tax_year.label).toBe("2025-26");
    expect(data.income_tax.personal_allowance).toBe(12570);
    expect(data.national_insurance.class4_lower_rate).toBe(0.06);
  });
});
