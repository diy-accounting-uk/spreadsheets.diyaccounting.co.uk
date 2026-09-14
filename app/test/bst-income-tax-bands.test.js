// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// bst-income-tax-bands.test.js — Drives the BST Income Tax sheet across the
// whole band table by writing a profit straight into Income Tax!E5 and
// recalculating. The reconciliation fixtures all sit above 125,140, where the
// personal allowance is already nil, so on their own they cannot tell a
// correct taper from a formula that simply zeroes the allowance over 100,000.
// The 110,000 row is the one that proves the taper; the rows either side of it
// fix the band boundaries.
//
// Every expected figure below is hand-computed from the 2025-26 rates, not
// read back from the sheet.
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { runSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";

const SKIP = !hasLibreOffice();
const describeCalc = SKIP ? describe.skip : describe;

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const BST_DIR = resolve(APP_DIR, "templates", "bst");
const DATA_DIR = resolve(APP_DIR, "data");

const TAX_SHEET = "Income Tax";
const READ_CELLS = ["E6", "E7", "E8", "E9", "E10", "E11"];

// profit, allowance, taxable, basic, higher, additional, total
//
// Trimmed to the 110,000 row and its two neighbours: the basic/higher/
// additional band arithmetic away from the taper is proved wherever a real
// fixture lands (the reconciliation and precision-code checks), so this
// table's remaining job is the partial taper and the two figures that fix
// where it starts and ends.
const BAND_TABLE = [
  [60000, 12570, 47430, 7540, 3892, 0, 11432],
  [110000, 7570, 102430, 7540, 25892, 0, 33432],
  [125140, 0, 125140, 7540, 34976, 0, 42516],
];

describeCalc("BST income tax bands", () => {
  let generatedXlsx;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(BST_DIR, "bst-excel.xlsx"));
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(BST_DIR, "meta.toml"), "utf8"));
    generatedXlsx = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);
  }, 60000);

  it.each(BAND_TABLE)(
    "charges a profit of %s at the statutory rates",
    async (profit, allowance, taxable, basic, higher, additional, total) => {
      const results = await runSpreadsheet(generatedXlsx, { [TAX_SHEET]: { E5: profit } }, { [TAX_SHEET]: READ_CELLS });
      const tax = results[TAX_SHEET];
      expect(tax.E6).toBeCloseTo(allowance, 4);
      expect(tax.E7).toBeCloseTo(taxable, 4);
      expect(tax.E8).toBeCloseTo(basic, 2);
      expect(tax.E9).toBeCloseTo(higher, 2);
      expect(tax.E10).toBeCloseTo(additional, 2);
      expect(tax.E11).toBeCloseTo(total, 2);
    },
    180000,
  );
});
