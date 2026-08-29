// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-income-tax-bands.test.js — Drives the SE Income Tax sheet across the
// whole band table by writing a profit straight into Income Tax!E5 and
// recalculating Financialaccounts.xlsx on its own. The reconciliation fixtures
// sit at one profit each, so on their own they cannot tell a correct taper
// from a formula that simply zeroes the allowance over 100,000, nor fix where
// one band ends and the next begins. The 110,000 and 121,615.39 rows prove
// the taper; the rows either side of them fix the band boundaries.
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
const SE_DIR = resolve(APP_DIR, "templates", "se");
const DATA_DIR = resolve(APP_DIR, "data");

const TAX_SHEET = "Income Tax";
const READ_CELLS = ["E6", "E7", "E8", "E9", "E10", "E11"];

// profit, allowance, taxable, basic, higher, additional, total
const BAND_TABLE = [
  [8000, 12570, 0, 0, 0, 0, 0],
  [30000, 12570, 17430, 3486, 0, 0, 3486],
  [60000, 12570, 47430, 7540, 3892, 0, 11432],
  [110000, 7570, 102430, 7540, 25892, 0, 33432],
  [121615.391666666, 1762.304166667, 119853.087499999, 7540, 32861.235, 0, 40401.235],
  [125140, 0, 125140, 7540, 34976, 0, 42516],
  [144715.391666666, 0, 144715.391666666, 7540, 34976, 8808.92625, 51324.92625],
  [226508, 0, 226508, 7540, 34976, 45615.6, 88131.6],
];

describeCalc("SE income tax bands", () => {
  let generatedXlsx;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(SE_DIR, "Financialaccounts.xlsx"));
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));
    generatedXlsx = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets.financialaccounts);
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
