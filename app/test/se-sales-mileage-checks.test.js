// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-sales-mileage-checks.test.js — the Self Employed Sales sheet's own
// mileage column (D), which cellWrites now fills and the exporter now reads
// back. Proves both the write and the pooling the sheet does with it:
// PurchasesApr!C2 = 0 + D1 + [1]Apr!$D$1 folds the Sales sheet's own
// mileage total into the running claim alongside any Purchases mileage of
// its own, and G2 bands that total at the Admin mileage rates.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, mkdtempSync, rmSync, cpSync, mkdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { runMultiFileSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet, setCellValue } from "../lib/generator.js";
import { cellWrites as seCellWrites, standardReads as seReads, multiFileOptions as seOptions } from "../products/se.js";
import { extractMultiFileTransactions } from "../lib/xlsx-exporter.js";
import { calculateMileageAllowance } from "../lib/tax/mileage.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const SE_DIR = resolve(APP_DIR, "templates", "se");
const DATA_DIR = resolve(APP_DIR, "data");

const SALES_MILEAGE = 40;

describeCalc("Self Employed: Sales sheet mileage column", () => {
  let results;
  let taxData;
  let savedDir;
  let workDirs = [];

  beforeAll(async () => {
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));

    const fileBuffers = {};
    for (const templateFile of productMeta.template.files) {
      const templateBuffer = readFileSync(resolve(SE_DIR, templateFile));
      const fileKey = templateFile.replace(".xlsx", "").toLowerCase();
      const sheetsConfig = productMeta.sheets?.[fileKey];
      fileBuffers[templateFile] =
        sheetsConfig && Object.keys(sheetsConfig).length > 0 ? await generateSpreadsheet(templateBuffer, taxData, sheetsConfig) : templateBuffer;
    }

    // Two April sales: one carries the day's business miles beside a real
    // sale (not a mileage-log entry -- the amount and the miles both stand),
    // the other has none, so the write is proven optional as well as present.
    const scenario = {
      metadata: { name: "Mileage Sales Test" },
      sales: {
        apr: [
          { date: "2025-04-10", customer: "Acme", code: "a", amount: 100, mileage: SALES_MILEAGE },
          { date: "2025-04-15", customer: "Bravo", code: "a", amount: 50 },
        ],
      },
    };

    const writes = seCellWrites(scenario);
    const options = seOptions();
    const additionalReads = {
      ...options.additionalReads,
      "Sales.xlsx": { ...options.additionalReads["Sales.xlsx"], Apr: [...options.additionalReads["Sales.xlsx"].Apr, "D1"] },
      "Purchases.xlsx": {
        ...options.additionalReads["Purchases.xlsx"],
        Apr: [...options.additionalReads["Purchases.xlsx"].Apr, "C2", "G2", "I2"],
      },
    };

    savedDir = mkdtempSync(join(tmpdir(), "se-sales-mileage-"));
    workDirs.push(savedDir);

    results = await runMultiFileSpreadsheet(fileBuffers, writes, seReads(), "Financialaccounts.xlsx", {
      ...options,
      additionalReads,
      saveRecalculatedTo: savedDir,
    });
  }, 300000);

  afterAll(() => {
    for (const dir of workDirs) rmSync(dir, { recursive: true, force: true });
  });

  it("SalesApr!D1 sums the day's business miles the writer put in D5", () => {
    expect(results["Sales.xlsx!Apr"].D1).toBe(SALES_MILEAGE);
  });

  it("PurchasesApr!C2 pools the Sales sheet's own mileage total via its external link", () => {
    expect(results["Purchases.xlsx!Apr"].C2).toBeCloseTo(SALES_MILEAGE, 6);
  });

  it("PurchasesApr!G2 bands that pooled total at the Admin mileage rates", () => {
    const claim = calculateMileageAllowance(SALES_MILEAGE, {
      higher_rate_limit: taxData.mileage.higher_rate_limit,
      higher_rate_pence: taxData.mileage.higher_rate_pence,
      lower_rate_pence: taxData.mileage.lower_rate_pence,
    });
    expect(results["Purchases.xlsx!Apr"].G2).toBeCloseTo(claim, 2);
    expect(results["Purchases.xlsx!Apr"].I2).toBeCloseTo(claim, 2);
  });

  it("the exporter reads the mileage day's line back as a measured quantity in miles", async () => {
    const lines = await extractMultiFileTransactions(savedDir, "se");
    const sale = lines.find((l) => l.sourceJournalID === "sales" && l.detailComment === "Acme");
    expect(sale.measurableQuantity).toBe(SALES_MILEAGE);
    expect(sale.measurableUnitOfMeasure).toBe("miles");
    // The sale still carries its own amount -- a Sales day's miles are not
    // an either/or the way a Purchases mileage-log row's are.
    expect(sale.amount).toBe(100);

    const noMileageSale = lines.find((l) => l.sourceJournalID === "sales" && l.detailComment === "Bravo");
    expect(noMileageSale.measurableQuantity).toBeUndefined();
    expect(noMileageSale.measurableUnitOfMeasure).toBeUndefined();
  });

  it("is broken by corrupting the cell -- the exporter reads the sheet, not a fixed value", async () => {
    const corruptedDir = mkdtempSync(join(tmpdir(), "se-sales-mileage-corrupt-"));
    workDirs.push(corruptedDir);
    mkdirSync(corruptedDir, { recursive: true });
    // The whole recalculated package: the export reads the approved mileage
    // rates off Financialaccounts.xlsx to price a Purchases mileage-log row,
    // so a directory holding only the two journals is not one it can read.
    cpSync(savedDir, corruptedDir, { recursive: true });

    const zip = await JSZip.loadAsync(readFileSync(join(savedDir, "Sales.xlsx")));
    const sheetPath = "xl/worksheets/sheet2.xml"; // Apr, verified against xl/workbook.xml
    const originalDate = zip.file(sheetPath).date;
    let xml = await zip.file(sheetPath).async("string");
    xml = setCellValue(xml, "D5", 999);
    zip.file(sheetPath, xml, { date: originalDate });
    const corruptedBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const { writeFileSync } = await import("fs");
    writeFileSync(join(corruptedDir, "Sales.xlsx"), corruptedBuffer);

    const lines = await extractMultiFileTransactions(corruptedDir, "se");
    const sale = lines.find((l) => l.sourceJournalID === "sales" && l.detailComment === "Acme");
    expect(sale.measurableQuantity).toBe(999);
    expect(sale.measurableQuantity).not.toBe(SALES_MILEAGE);
  });
});
