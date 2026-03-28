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
  formatDateDDMMYY,
  formatDateYYYYMMDD,
  shortLabel,
  utcDate,
  monthEnd,
} from "../lib/generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const BST_DIR = resolve(APP_DIR, "templates", "bst");
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
  const taxData = parseTOML(
    readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"),
  );

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
  const productMeta = parseTOML(
    readFileSync(resolve(BST_DIR, "meta.toml"), "utf8"),
  );
  const templatePath = resolve(BST_DIR, productMeta.template.spreadsheet);
  let templateBuffer;

  beforeAll(() => {
    templateBuffer = readFileSync(templatePath);
  });

  it("generates a valid xlsx buffer for 2025-26", async () => {
    const taxData = parseTOML(
      readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"),
    );
    const buffer = await generateSpreadsheet(
      templateBuffer,
      taxData,
      productMeta.sheets.admin,
    );
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100000); // sanity check size
    // Verify it's a valid zip (xlsx) — starts with PK signature
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });

  it("generates a valid xlsx buffer for 2024-25", async () => {
    const taxData = parseTOML(
      readFileSync(resolve(DATA_DIR, "se-2024-2025.toml"), "utf8"),
    );
    const buffer = await generateSpreadsheet(
      templateBuffer,
      taxData,
      productMeta.sheets.admin,
    );
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100000);
  });

  it("contains correct Admin cell values in generated xlsx", async () => {
    const taxData = parseTOML(
      readFileSync(resolve(DATA_DIR, "se-2024-2025.toml"), "utf8"),
    );
    const buffer = await generateSpreadsheet(
      templateBuffer,
      taxData,
      productMeta.sheets.admin,
    );

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

  it("shared metadata exists", () => {
    expect(existsSync(resolve(APP_DIR, "templates", "meta.toml"))).toBe(true);
  });

  it("tax data files exist with correct naming convention", () => {
    expect(existsSync(resolve(DATA_DIR, "se-2024-2025.toml"))).toBe(true);
    expect(existsSync(resolve(DATA_DIR, "se-2025-2026.toml"))).toBe(true);
  });

  it("tax data files parse correctly", () => {
    const data = parseTOML(
      readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"),
    );
    expect(data.tax_year.label).toBe("2025-26");
    expect(data.income_tax.personal_allowance).toBe(12570);
    expect(data.national_insurance.class4_lower_rate).toBe(0.06);
  });
});
