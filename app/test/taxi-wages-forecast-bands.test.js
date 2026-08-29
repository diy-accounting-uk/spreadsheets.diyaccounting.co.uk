// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-wages-forecast-bands.test.js — Drives the Wages Forecast tax block
// across the whole band table by writing a projected profit straight into C34
// and recalculating. The fixtures reach the full taper and the additional
// rate but never the partial taper, which is what the 110,000 row is for.
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

const FORECAST_SHEET = "Wages Forecast";
const READ_CELLS = ["C35", "C36", "C37", "C38", "C39", "C40", "C41"];

// profit, allowance, taxable, basic, higher, additional, NI, total
const BAND_TABLE = [
  [8000, 12570, 0, 0, 0, 0, 0, 0],
  [30000, 12570, 17430, 3486, 0, 0, 1045.8, 4531.8],
  [60000, 12570, 47430, 7540, 3892, 0, 2456.6, 13888.6],
  [110000, 7570, 102430, 7540, 25892, 0, 3456.6, 36888.6],
  [125140, 0, 125140, 7540, 34976, 0, 3759.4, 46275.4],
  [144878, 0, 144878, 7540, 34976, 8882.1, 4154.16, 55552.26],
  [226508, 0, 226508, 7540, 34976, 45615.6, 5786.76, 93918.36],
];

describeCalc("Taxi wages forecast tax bands", () => {
  let generatedXlsx;

  beforeAll(async () => {
    const templateBuffer = readFileSync(resolve(TAXI_DIR, "taxi-excel.xlsx"));
    const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "se-2025-2026.toml"), "utf8"));
    const productMeta = parseTOML(readFileSync(resolve(TAXI_DIR, "meta.toml"), "utf8"));
    generatedXlsx = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);
  }, 60000);

  it.each(BAND_TABLE)(
    "charges a projected profit of %s at the statutory rates",
    async (profit, allowance, taxable, basic, higher, additional, ni, total) => {
      const results = await runSpreadsheet(generatedXlsx, { [FORECAST_SHEET]: { C34: profit } }, { [FORECAST_SHEET]: READ_CELLS });
      const forecast = results[FORECAST_SHEET];
      expect(forecast.C35).toBeCloseTo(allowance, 4);
      expect(forecast.C36).toBeCloseTo(taxable, 4);
      expect(forecast.C37).toBeCloseTo(basic, 2);
      expect(forecast.C38).toBeCloseTo(higher, 2);
      expect(forecast.C39).toBeCloseTo(additional, 2);
      expect(forecast.C40).toBeCloseTo(ni, 2);
      expect(forecast.C41).toBeCloseTo(total, 2);
    },
    180000,
  );
});
