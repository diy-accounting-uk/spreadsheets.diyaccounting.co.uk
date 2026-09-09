// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, cpSync } from "fs";
import { tmpdir } from "os";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  pad2,
  isLeapYear,
  monthEndDate,
  parsePackageDir,
  parseCompanyAnyDir,
  generateCompanyVariantNames,
  dateToLabel,
  generateCatalogue,
  buildReadmeText,
  licenceNameFromText,
  SOURCE_URL,
  DOWNLOAD_URL,
  COPYRIGHT_LINE,
  SPDX_LICENSE_ID,
  PRODUCTS,
} from "../lib/package-builder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = resolve(__dirname, "..", "..");

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

// ── licenceNameFromText ────────────────────────────────────────────────────

describe("licenceNameFromText", () => {
  it("takes the first non-blank line as the licence name", () => {
    expect(licenceNameFromText("\n\nPolyForm Internal Use License 1.0.0\n\nBody text\n")).toBe("PolyForm Internal Use License 1.0.0");
  });

  it("trims surrounding whitespace", () => {
    expect(licenceNameFromText("   GNU Affero General Public License   \nmore text")).toBe("GNU Affero General Public License");
  });

  it("returns an empty string for blank text", () => {
    expect(licenceNameFromText("\n\n\n")).toBe("");
  });
});

// ── buildReadmeText ────────────────────────────────────────────────────────

describe("buildReadmeText", () => {
  it("names the product, the year and the licence", () => {
    const text = buildReadmeText("Basic Sole Trader", "2025-04-05", "PolyForm Internal Use License 1.0.0");
    expect(text).toContain("Basic Sole Trader");
    expect(text).toContain("April 2025");
    expect(text).toContain("Licence: PolyForm Internal Use License 1.0.0");
  });

  it("states the permitted use and carries the copyright, source and download lines", () => {
    const text = buildReadmeText("Company", "2026-03-31", "PolyForm Internal Use License 1.0.0");
    expect(text).toContain("your clients' accounts if you are an accountant");
    expect(text).toContain("Do not redistribute this package");
    expect(text).toContain("under another name");
    expect(text).toContain(COPYRIGHT_LINE);
    expect(text).toContain(SOURCE_URL);
    expect(text).toContain(DOWNLOAD_URL);
  });
});

// ── generateCatalogue ──────────────────────────────────────────────────────

describe("generateCatalogue", () => {
  it("generates valid TOML with header", () => {
    const toml = generateCatalogue([], "2026-04-05");
    expect(toml).toContain('generated = "2026-04-05"');
    expect(toml).toContain("Auto-generated");
  });

  it("starts with the SPDX and copyright header", () => {
    const toml = generateCatalogue([], "2026-04-05");
    const lines = toml.split("\n");
    expect(lines[0]).toBe(`# SPDX-License-Identifier: ${SPDX_LICENSE_ID}`);
    expect(lines[1]).toBe(`# ${COPYRIGHT_LINE}`);
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
    const packages = [{ product: "Self Employed", date: "2025-04-05", shortLabel: "Apr25", format: "Excel 2007", filename: "se.zip" }];
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

// ── build-packages.js: LICENCE.txt and README.txt land in the built zip ────
//
// Runs the real script against a throwaway tree standing in for this repo
// (only build-packages.js, package-builder.js, a root LICENSE and one
// synthetic package), the way archive-packages.test.js already does for
// archive-packages.js, so the real packages/ and LICENSE are never read.

describe("build-packages.js package docs", () => {
  const tempDirs = [];

  afterEach(() => {
    while (tempDirs.length > 0) rmSync(tempDirs.pop(), { recursive: true, force: true });
  });

  function makeRepo(licenseText) {
    const root = mkdtempSync(join(tmpdir(), "build-packages-"));
    tempDirs.push(root);
    mkdirSync(join(root, "app", "bin"), { recursive: true });
    mkdirSync(join(root, "app", "lib"), { recursive: true });
    mkdirSync(join(root, "web", "spreadsheets.diyaccounting.co.uk", "public"), { recursive: true });
    cpSync(join(REAL_ROOT, "app", "bin", "build-packages.js"), join(root, "app", "bin", "build-packages.js"));
    cpSync(join(REAL_ROOT, "app", "lib", "package-builder.js"), join(root, "app", "lib", "package-builder.js"));
    writeFileSync(join(root, "LICENSE"), licenseText);
    const pkgName = "GB Accounts Basic Sole Trader 2025-04-05 (Apr25) Excel 2007";
    const pkgDir = join(root, "packages", pkgName);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "Accounts.xlsx"), "xlsx-content");
    writeFileSync(join(pkgDir, "Guide.pdf"), "pdf-content");
    return { root, pkgDir };
  }

  it("writes LICENCE.txt and README.txt into a built zip, naming the licence in force", () => {
    const licenseText = "Test Licence 1.0.0\n\nBody of the test licence.\n";
    const { root } = makeRepo(licenseText);

    execFileSync(process.execPath, [join(root, "app", "bin", "build-packages.js")], { cwd: root, encoding: "utf8" });

    const zipPath = join(root, "target", "zips", "GB Accounts Basic Sole Trader 2025-04-05 (Apr25) Excel 2007.zip");
    const listing = execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" });
    expect(listing).toContain("LICENCE.txt");
    expect(listing).toContain("README.txt");

    const licenceOut = execFileSync("unzip", ["-p", zipPath, "LICENCE.txt"], { encoding: "utf8" });
    expect(licenceOut).toBe(licenseText);

    const readmeOut = execFileSync("unzip", ["-p", zipPath, "README.txt"], { encoding: "utf8" });
    expect(readmeOut).toContain("Basic Sole Trader");
    expect(readmeOut).toContain("Licence: Test Licence 1.0.0");
    expect(readmeOut).toContain(COPYRIGHT_LINE);
    expect(readmeOut).toContain(SOURCE_URL);
    expect(readmeOut).toContain(DOWNLOAD_URL);
  });

  it("gains a header comment naming the licence in force in catalogue.toml", () => {
    const { root } = makeRepo("PolyForm Internal Use License 1.0.0\n\nBody.\n");

    execFileSync(process.execPath, [join(root, "app", "bin", "build-packages.js")], { cwd: root, encoding: "utf8" });

    const catalogue = execFileSync("cat", [join(root, "web", "spreadsheets.diyaccounting.co.uk", "public", "catalogue.toml")], {
      encoding: "utf8",
    });
    expect(catalogue).toContain(`# SPDX-License-Identifier: ${SPDX_LICENSE_ID}`);
    expect(catalogue).toContain(`# ${COPYRIGHT_LINE}`);
  });
});
