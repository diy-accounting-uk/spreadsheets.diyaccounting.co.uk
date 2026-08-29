// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-income-tax-bands.test.js — Drives the Taxi Draft Tax calculation across
// the whole band table by writing a profit straight into E5 and recalculating.
// The 110,000 row is the one that proves the taper's partial branch, which no
// fixture reaches; the rows either side of it fix the band boundaries.
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
const TAXI_DIR = resolve(APP_DIR, "templates", "taxi");
const DATA_DIR = resolve(APP_DIR, "data");

const TAX_SHEET = "Draft Tax calculation";
const READ_CELLS = ["E6", "E7", "E8", "E9", "E10", "E11"];

// profit, allowance, taxable, basic, higher, additional, total
const BAND_TABLE = [
  [8000, 12570, 0, 0, 0, 0, 0],
  [30000, 12570, 17430, 3486, 0, 0, 3486],
  [60000, 12570, 47430, 7540, 3892, 0, 11432],
  [110000, 7570, 102430, 7540, 25892, 0, 33432],
  [125140, 0, 125140, 7540, 34976, 0, 42516],
  [144140, 0, 144140, 7540, 34976, 8550, 51066],
  [226508, 0, 226508, 7540, 34976, 45615.6, 88131.6],
];

describeCalc("Taxi income tax bands", () => {
  let generatedXlsx;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(TAXI_DIR, "taxi-excel.xlsx"));
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(TAXI_DIR, "meta.toml"), "utf8"));
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
