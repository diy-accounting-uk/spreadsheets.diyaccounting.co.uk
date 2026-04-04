// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import {
  pad2,
  isLeapYear,
  monthEndDate,
  parsePackageDir,
  parseCompanyAnyDir,
  generateCompanyVariantNames,
  dateToLabel,
  generateCatalogue,
  PRODUCTS,
} from "../lib/package-builder.js";

// ── pad2 ───────────────────────────────────────────────────────────────────

describe("pad2", () => {
  it("pads single digits", () => {
    expect(pad2(1)).toBe("01");
    expect(pad2(9)).toBe("09");
  });

  it("leaves double digits unchanged", () => {
    expect(pad2(10)).toBe("10");
    expect(pad2(31)).toBe("31");
  });
});

// ── isLeapYear ─────────────────────────────────────────────────────────────

describe("isLeapYear", () => {
  it("identifies leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
  });

  it("identifies non-leap years", () => {
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
  });
});

// ── monthEndDate ───────────────────────────────────────────────────────────

describe("monthEndDate", () => {
  it("returns 31 for January", () => {
    expect(monthEndDate(2025, 1)).toBe(31);
  });

  it("returns 28 for Feb in non-leap year", () => {
    expect(monthEndDate(2025, 2)).toBe(28);
  });

  it("returns 29 for Feb in leap year", () => {
    expect(monthEndDate(2024, 2)).toBe(29);
  });

  it("returns 30 for April", () => {
    expect(monthEndDate(2025, 4)).toBe(30);
  });
});

// ── parsePackageDir ────────────────────────────────────────────────────────

describe("parsePackageDir", () => {
  it("parses a standard BST directory name", () => {
    const result = parsePackageDir("GB Accounts Basic Sole Trader 2025-04-05 (Apr25) Excel 2007");
    expect(result).toEqual({
      productName: "Basic Sole Trader",
      date: "2025-04-05",
      shortLabel: "Apr25",
      format: "Excel 2007",
    });
  });

  it("parses a Taxi Driver directory name", () => {
    const result = parsePackageDir("GB Accounts Taxi Driver 2026-04-05 (Apr26) Excel 2007");
    expect(result).toEqual({
      productName: "Taxi Driver",
      date: "2026-04-05",
      shortLabel: "Apr26",
      format: "Excel 2007",
    });
  });

  it("returns null for unrecognised names", () => {
    expect(parsePackageDir("some random folder")).toBeNull();
  });

  it("returns null for Company (Any) names", () => {
    expect(parsePackageDir("GB Accounts Company 2024-2025 (Any) Excel 2007")).toBeNull();
  });
});

// ── parseCompanyAnyDir ─────────────────────────────────────────────────────

describe("parseCompanyAnyDir", () => {
  it("parses a Company (Any) directory name", () => {
    const result = parseCompanyAnyDir("GB Accounts Company 2024-2025 (Any) Excel 2007");
    expect(result).toEqual({ startYear: 2024, endYear: 2025, format: "Excel 2007" });
  });

  it("returns null for standard package names", () => {
    expect(parseCompanyAnyDir("GB Accounts Basic Sole Trader 2025-04-05 (Apr25) Excel 2007")).toBeNull();
  });
});

// ── generateCompanyVariantNames ────────────────────────────────────────────

describe("generateCompanyVariantNames", () => {
  it("generates variants for months whose FY has started", () => {
    // Use a date far in the future so all variants are included
    const now = new Date("2027-06-01");
    const { variants, skipped } = generateCompanyVariantNames(2024, 2025, "Excel 2007", now);
    expect(variants.length).toBe(11); // Apr-Feb (Mar excluded from MONTHS)
    expect(skipped).toHaveLength(0);
  });

  it("skips variants whose FY has not started", () => {
    // April 2025: only Apr25's FY (May 2024–Apr 2025) has started
    const now = new Date("2025-04-15");
    const { variants, skipped } = generateCompanyVariantNames(2024, 2025, "Excel 2007", now);
    expect(variants.length).toBeGreaterThan(0);
    expect(variants.length + skipped.length).toBe(11);
  });

  it("produces correct zip names", () => {
    const now = new Date("2027-06-01");
    const { variants } = generateCompanyVariantNames(2024, 2025, "Excel 2007", now);
    const apr = variants.find((v) => v.shortLabel === "Apr25");
    expect(apr).toBeDefined();
    expect(apr.date).toBe("2025-04-30");
    expect(apr.zipName).toBe("GB Accounts Company 2025-04-30 (Apr25) Excel 2007");
  });

  it("handles Feb leap year correctly", () => {
    const now = new Date("2027-06-01");
    const { variants } = generateCompanyVariantNames(2023, 2024, "Excel 2007", now);
    const feb = variants.find((v) => v.shortLabel === "Feb25");
    expect(feb).toBeDefined();
    expect(feb.date).toBe("2025-02-28");
  });
});

// ── dateToLabel ────────────────────────────────────────────────────────────

describe("dateToLabel", () => {
  it("converts date to human-readable label", () => {
    expect(dateToLabel("2025-04-30")).toBe("April 2025");
    expect(dateToLabel("2026-01-31")).toBe("January 2026");
    expect(dateToLabel("2025-12-31")).toBe("December 2025");
  });
});

// ── generateCatalogue ──────────────────────────────────────────────────────

describe("generateCatalogue", () => {
  it("generates valid TOML with header", () => {
    const toml = generateCatalogue([], "2026-04-05");
    expect(toml).toContain('generated = "2026-04-05"');
    expect(toml).toContain("Auto-generated");
  });

  it("groups packages by product in stable order", () => {
    const packages = [
      { product: "Company", date: "2025-04-30", shortLabel: "Apr25", format: "Excel 2007", filename: "company.zip" },
      { product: "Basic Sole Trader", date: "2025-04-05", shortLabel: "Apr25", format: "Excel 2007", filename: "bst.zip" },
    ];
    const toml = generateCatalogue(packages, "2026-04-05");
    // BST should appear before Company (product order)
    const bstPos = toml.indexOf('name = "Basic Sole Trader"');
    const companyPos = toml.indexOf('name = "Company"');
    expect(bstPos).toBeLessThan(companyPos);
  });

  it("sorts periods newest-first within a product", () => {
    const packages = [
      { product: "Basic Sole Trader", date: "2024-04-05", shortLabel: "Apr24", format: "Excel 2007", filename: "old.zip" },
      { product: "Basic Sole Trader", date: "2025-04-05", shortLabel: "Apr25", format: "Excel 2007", filename: "new.zip" },
    ];
    const toml = generateCatalogue(packages, "2026-04-05");
    const newPos = toml.indexOf('date = "2025-04-05"');
    const oldPos = toml.indexOf('date = "2024-04-05"');
    expect(newPos).toBeLessThan(oldPos);
  });

  it("includes product metadata from PRODUCTS", () => {
    const packages = [
      { product: "Self Employed", date: "2025-04-05", shortLabel: "Apr25", format: "Excel 2007", filename: "se.zip" },
    ];
    const toml = generateCatalogue(packages, "2026-04-05");
    expect(toml).toContain('id = "SelfEmployed"');
    expect(toml).toContain(PRODUCTS["Self Employed"].description);
  });

  it("skips unknown products", () => {
    const packages = [{ product: "Unknown Product", date: "2025-04-05", shortLabel: "Apr25", format: "Excel 2007", filename: "x.zip" }];
    const toml = generateCatalogue(packages, "2026-04-05");
    expect(toml).not.toContain("Unknown Product");
  });
});
