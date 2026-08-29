// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se-profit-forecast-bands.test.js — Drives the Profit Forecast tax block
// across the whole band table by writing a taxable profit straight into C39
// and recalculating. The advanced fixture lands in the partial taper but
// never reaches the additional rate, which is what the last two rows are for.
//
// The block reads nothing but C39 and the Admin sheet, so the hub workbook
// recalculates on its own -- no external link has to resolve.
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

const FORECAST_SHEET = "Profit Forecast";
const READ_CELLS = ["C40", "C41", "C42", "C43", "C44", "C45", "C46"];

// profit, allowance, taxable, basic, higher, additional, NI, total
const BAND_TABLE = [
  [8000, 12570, 0, 0, 0, 0, 0, 0],
  [30000, 12570, 17430, 3486, 0, 0, 1045.8, 4531.8],
  [60000, 12570, 47430, 7540, 3892, 0, 2456.6, 13888.6],
  [110000, 7570, 102430, 7540, 25892, 0, 3456.6, 36888.6],
  [121787.391666666, 1676.304166667, 120111.0875, 7540, 32964.435, 0, 3692.347833333, 44196.782833333],
  [125140, 0, 125140, 7540, 34976, 0, 3759.4, 46275.4],
  [226508, 0, 226508, 7540, 34976, 45615.6, 5786.76, 93918.36],
];

describeCalc("Self Employed profit forecast tax bands", () => {
  let generatedHub;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(SE_DIR, "Financialaccounts.xlsx"));
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(SE_DIR, "meta.toml"), "utf8"));
    generatedHub = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets.financialaccounts);
  }, 60000);

  it.each(BAND_TABLE)(
    "charges a projected taxable profit of %s at the statutory rates",
    async (profit, allowance, taxable, basic, higher, additional, ni, total) => {
      const results = await runSpreadsheet(generatedHub, { [FORECAST_SHEET]: { C39: profit } }, { [FORECAST_SHEET]: READ_CELLS });
      const forecast = results[FORECAST_SHEET];
      expect(forecast.C40).toBeCloseTo(allowance, 4);
      expect(forecast.C41).toBeCloseTo(taxable, 4);
      expect(forecast.C42).toBeCloseTo(basic, 2);
      expect(forecast.C43).toBeCloseTo(higher, 2);
      expect(forecast.C44).toBeCloseTo(additional, 2);
      expect(forecast.C45).toBeCloseTo(ni, 2);
      expect(forecast.C46).toBeCloseTo(total, 2);
    },
    180000,
  );
});
