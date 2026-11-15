// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// Every folder under packages/ is a package a customer can download. This
// test names no year and no year-end: it reads the folders that exist, parses
// each name with the parser the build script uses, and checks the folder
// holds every file the generator writes for that product. Workbook contents
// are checked in formula-presence-guard.test.js.

import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";

import { parsePackageDir, parseCompanyAnyDir, PRODUCTS } from "../lib/package-builder.js";
import { packageNaming, shortLabel, formatDateYYYYMMDD } from "../lib/generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const ROOT = resolve(APP_DIR, "..");
const PACKAGES_DIR = join(ROOT, "packages");
const TEMPLATES_DIR = join(APP_DIR, "templates");

// build-packages.js writes these into each folder before it zips it; git does not hold them.
const WRITTEN_BY_BUILD = new Set(["LICENCE.txt", "README.txt"]);

const sharedMeta = parseTOML(readFileSync(join(TEMPLATES_DIR, "meta.toml"), "utf8"));

// Products that generate.js builds from a template folder, keyed by the name in the package folder.
const metaByProductName = new Map();
for (const templateDir of readdirSync(TEMPLATES_DIR, { withFileTypes: true }).filter((e) => e.isDirectory())) {
  const metaPath = join(TEMPLATES_DIR, templateDir.name, "meta.toml");
  if (!existsSync(metaPath)) continue;
  const meta = parseTOML(readFileSync(metaPath, "utf8"));
  metaByProductName.set(meta.product.name, meta);
}

// Files generate.js writes for one product at one year end: the template
// workbooks (or the single dated workbook), then each PDF guide.
function filesGenerateWrites(meta, endDate) {
  const { xlsxFilename } = packageNaming(meta, sharedMeta, endDate);
  const workbooks = meta.template.files ?? [xlsxFilename];
  const guides = [];
  if (meta.template.guide) guides.push(meta.output.guide_filename);
  if (meta.template.payslip_guide) guides.push(meta.output.payslip_guide_filename);
  return [...workbooks, ...guides];
}

// The Payslip 05 package is cut from a Self Employed package by the
// "Create Payslip 05 packages" step of generate-se.yml: the payslips workbook
// and the payslip guide.
function filesPayslip05Carries() {
  const se = metaByProductName.get("Self Employed");
  return ["Payslips.xlsx", se.output.payslip_guide_filename];
}

function expectedFiles(productName, endDate) {
  if (productName === "Payslip 05") return filesPayslip05Carries();
  return filesGenerateWrites(metaByProductName.get(productName), endDate);
}

function listPackageFolders() {
  if (!existsSync(PACKAGES_DIR)) return [];
  return readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

const folders = listPackageFolders();
const isWorkInProgress = (name) => existsSync(join(PACKAGES_DIR, name, "DO NOT USE - WORK IN PROGRESS.txt"));
const checked = folders.filter((name) => !isWorkInProgress(name));

describe("the package folders under packages/", () => {
  it("holds at least one folder to check", () => {
    expect(checked.length).toBeGreaterThan(0);
  });

  describe.each(checked)("%s", (folderName) => {
    it("has a name whose product, year-end date and month label agree", () => {
      expect(parseCompanyAnyDir(folderName), "a Company (Any) folder is expanded by the build, not committed").toBeNull();
      const parsed = parsePackageDir(folderName);
      expect(parsed, "folder name matches the package naming pattern").not.toBeNull();

      const endDate = new Date(`${parsed.date}T00:00:00Z`);
      expect(formatDateYYYYMMDD(endDate), "year-end date is a real calendar date").toBe(parsed.date);
      expect(parsed.shortLabel, "the bracketed label is the month and year of the year-end date").toBe(shortLabel(endDate));
      expect(Object.keys(PRODUCTS), "product is one the catalogue knows").toContain(parsed.productName);
      expect(parsed.format).toBe(sharedMeta.package.format);

      const meta = metaByProductName.get(parsed.productName);
      if (meta) {
        expect(packageNaming(meta, sharedMeta, endDate).dirName, "the generator would write this folder name").toBe(folderName);
      }
    });

    it("holds every file the generator writes for its product", () => {
      const { productName, date } = parsePackageDir(folderName);
      const expected = expectedFiles(productName, new Date(`${date}T00:00:00Z`));
      const present = new Set(readdirSync(join(PACKAGES_DIR, folderName)).filter((f) => !WRITTEN_BY_BUILD.has(f)));
      const missing = expected.filter((f) => !present.has(f));
      expect(missing, "files missing from the folder").toEqual([]);
    });
  });
});
