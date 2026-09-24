// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// reconcile-book.test.js -- reconcileBook checks a populated package against
// the book it was written from, in place of a scenario fixture. A package
// saveWorkbookFiles wrote from the Taxi Driver example book reconciles
// clean; a package with one cell altered shows exactly that one anomaly and
// no other. The altered cell is the Admin sheet's own copy of a tax-data
// constant (the VAT registration threshold) -- a value nothing else in this
// book's accounts reads, so the one change stays the one anomaly rather than
// cascading through every figure the turnover feeds.

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { saveWorkbookFiles } from "../lib/product-workbook.js";
import { applyCellWrites } from "../lib/spreadsheet-runner.js";
import { reconcileBook } from "../bin/reconcile.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const BOOK_DIR = resolve(ROOT, "examples/basic-taxi-driver/taxi");

// Writes a fresh copy of the book's own package into a scratch packages/
// directory, exactly as saveWorkbookFiles hands it to a caller: no
// LibreOffice recalculation, fullCalcOnLoad="1" only, the same as a real
// write_finance_package call leaves on disk.
async function writeBookPackage(packagesDir) {
  const { book, lines } = loadDiyaGlData(BOOK_DIR);
  const { dirName, files } = await saveWorkbookFiles(book, lines);
  const pkgDir = resolve(packagesDir, dirName);
  mkdirSync(pkgDir, { recursive: true });
  for (const file of files) writeFileSync(resolve(pkgDir, file.name), file.bytes);
  return pkgDir;
}

describe("reconcileBook", () => {
  it("reconciles clean against the package it was written from", async () => {
    const packagesDir = mkdtempSync(resolve(tmpdir(), "reconcile-book-"));
    await writeBookPackage(packagesDir);

    const { checks, compliant } = await reconcileBook(BOOK_DIR, packagesDir);

    expect(checks.length).toBeGreaterThan(0);
    expect(checks.filter((c) => !c.pass)).toEqual([]);
    expect(compliant).toBe(true);
  }, 180000);

  it("shows exactly the anomaly one altered cell introduces", async () => {
    const packagesDir = mkdtempSync(resolve(tmpdir(), "reconcile-book-"));
    const pkgDir = await writeBookPackage(packagesDir);

    const xlsxFile = readdirSync(pkgDir).find((f) => f.endsWith(".xlsx"));
    const xlsxPath = resolve(pkgDir, xlsxFile);
    const tampered = await applyCellWrites(readFileSync(xlsxPath), { Admin: { F26: 12345 } });
    writeFileSync(xlsxPath, tampered);

    const { checks, compliant } = await reconcileBook(BOOK_DIR, packagesDir);
    const failing = checks.filter((c) => !c.pass);

    expect(failing).toHaveLength(1);
    expect(failing[0].name).toBe("Admin!F26");
    expect(compliant).toBe(false);
  }, 180000);
});
