// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// The basis period record (SA103F boxes 68, 69 and 73.3) for a book whose
// accounting date is not 31 March to 5 April. The other SE calc-tier tests
// run the advanced book as it ships -- a 31 March year end, so box 68
// (D197) is nil throughout (s.7A, s.7C) and this apportionment never fires.
// This file overrides the book's own accounting period to 1 July to 30
// June and proves the s.7A apportionment against a hand computation, with
// a real LibreOffice recalculation underneath it.
//
// Requires: LibreOffice installed (brew install --cask libreoffice).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import { resolve, dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { runMultiFileSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import {
  cellWrites as seCellWrites,
  standardReads as seReads,
  multiFileOptions as seOptions,
  checkCompliance as seCheckCompliance,
} from "../products/se.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const REPO_DIR = resolve(APP_DIR, "..");
const SE_DIR = resolve(APP_DIR, "templates", "se");
const DATA_DIR = resolve(APP_DIR, "data");
const ADVANCED_DIR = resolve(REPO_DIR, "examples", "precision-code-ltd", "advanced");

describeCalc("SA103F box 68: the s.7A apportionment for a non-31-March accounting date", () => {
  let results;
  let checks;
  let taxData;
  let savedDir;

  beforeAll(async () => {
    // The 2026-27 tax year: the book's own 1 July 2025 to 30 June 2026
    // period already sits inside it (taxYearFileName(2026-06-30) names
    // "se-2026-2027"), so cellWrites' whole-year shift is nil and boxes 8
    // and 9 print the period unmoved.
    taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2026-2027.toml"), "utf8"));
    const targetStartYear = new Date(taxData.tax_year.start).getUTCFullYear();

    // +P3M: the book's own 1 April to 31 March year, shifted three whole
    // months so every posting and VAT period marker moves with it -- the
    // straddling-period check refuses a book whose documentInfo names a
    // period its own lines fall outside, so the accounting date cannot be
    // overridden on its own without carrying the postings along with it.
    const { book, lines: shiftedLines } = loadDiyaGlData(ADVANCED_DIR, "+P3M");
    expect(book.documentInfo.periodCoveredStart.toISOString().slice(0, 10)).toBe("2025-07-01");
    expect(book.documentInfo.periodCoveredEnd.toISOString().slice(0, 10)).toBe("2026-06-30");
    book.tax.selfEmployment.basisPeriod.followingPeriodProfit = 36500;
    // The advanced book's own straddling VAT entries are written to fixed
    // calendar-month sheets (STRADDLING_PERIOD_ROWS) sized for a 31 March
    // year end; shifted three months they land on a month the writer has
    // no sheet for. Box 68 has nothing to do with VAT straddling, so this
    // test drops those few lines rather than widen a sheet this change
    // does not own.
    const lines = shiftedLines.filter((line) => line["diya-gl:vatPeriodEnd"] === undefined);
    const scenario = diyaGlToScenario(book, lines, "se");

    const productMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));
    const fileBuffers = {};
    for (const templateFile of productMeta.template.files) {
      const templateBuffer = readFileSync(resolve(SE_DIR, templateFile));
      const fileKey = templateFile.replace(".xlsx", "").toLowerCase();
      const sheetsConfig = productMeta.sheets?.[fileKey];
      fileBuffers[templateFile] =
        sheetsConfig && Object.keys(sheetsConfig).length > 0
          ? await generateSpreadsheet(templateBuffer, taxData, sheetsConfig)
          : templateBuffer;
    }

    savedDir = mkdtempSync(join(tmpdir(), "se-basis-period-checks-"));
    results = await runMultiFileSpreadsheet(fileBuffers, seCellWrites(scenario, targetStartYear), seReads(), "Financialaccounts.xlsx", {
      ...seOptions(),
      saveRecalculatedTo: savedDir,
    });
    checks = seCheckCompliance(results, { ...scenario, ...scenario.expected }, taxData, calculateExpectedTax);
  }, 300000);

  afterAll(() => {
    if (savedDir) rmSync(savedDir, { recursive: true, force: true });
  });

  it("prints the book's own accounting period on boxes 8 and 9, unmoved", () => {
    const businessDetails = results["Business Details"];
    expect(businessDetails.N27).toBeCloseTo(45839, 0); // 2025-07-01
    expect(businessDetails.N32).toBeCloseTo(46203, 0); // 2026-06-30
  });

  it("computes box 68 (D197) as (following period's profit less this period's) x 279/365", () => {
    const seFull = results["SE Full"];
    const periodProfit = seFull.O174 - seFull.O179;
    const expectedD197 = ((36500 - periodProfit) * 279) / 365;
    expect(seFull.D197).toBeCloseTo(expectedD197, 2);
    // Neither this period's own dates (31 March to 5 April) nor a book
    // with no following period profit, so this is the one fixture that
    // exercises the non-nil branch at all.
    expect(seFull.D197).not.toBeCloseTo(0, 2);
  });

  it("moves box 73 (O194) by the same amount box 68 (D197) carries", () => {
    const seFull = results["SE Full"];
    const periodProfit = seFull.O174 - seFull.O179;
    expect(seFull.O194).toBeCloseTo(Math.max(0, periodProfit + seFull.D197 + seFull.D210), 2);
  });

  // The rest of the SA103F suite runs unshifted in se-full-return-checks.test.js.
  // Dropping the straddling VAT lines above moves the short return's own
  // figures out of step with the full return's (their cross-tie is not
  // part of box 68's own chain), and shifting the dates genuinely moves
  // the Freeport SBA claim's day count -- neither is what this file
  // proves, so only the three checks box 68 itself feeds are re-asserted
  // here, by name.
  it("passes the self-referential form box 68 feeds -- boxes 68, 73 and 77", () => {
    const box68Chain = [
      "SA103F box 68 adjustment where the accounting period was not 12 months long (D197) = the s.7A apportionment",
      "SA103F box 73 adjusted profit (O194) = box 64 less box 65 plus boxes 68 and 71, floored at nil",
      "SA103F box 77 adjusted loss (D219) = box 65 less box 64, 68 and 71, floored at nil",
    ];
    for (const name of box68Chain) {
      const check = checks.find((c) => c.name === name);
      expect(check, `no check named "${name}"`).toBeDefined();
      expect(check.pass, `${name}: expected ${check.expected}, actual ${check.actual}`).toBe(true);
    }
  });
});
