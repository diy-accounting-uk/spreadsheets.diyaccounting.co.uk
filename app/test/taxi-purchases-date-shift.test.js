// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi-purchases-date-shift.test.js — Proves Purchases posting dates carry
// the same targetStartYear translation as Sales, so a package generated for
// a different year end does not leak the fixture's own calendar dates.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { cellWrites as taxiCellWrites } from "../products/taxi.js";
import { loadScenario, parseDate, MONTH_SHEETS } from "../lib/scenario-loader.js";
import { toExcelSerial } from "../lib/spreadsheet-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "fixtures");

const scenario = loadScenario(resolve(FIXTURES_DIR, "taxi-scenario-basic.toml"));

// The fixture's own first Purchases entry (examples/basic-taxi-driver's DVLA
// vehicle excise line, mirrored here): 2025-04-06, filed on PurchasesApr!A5.
const FIRST_PURCHASE_MONTH_KEY = "apr";
const FIRST_PURCHASE_SHEET = `Purchases${MONTH_SHEETS[FIRST_PURCHASE_MONTH_KEY]}`;
const FIRST_PURCHASE_CELL = "A5";
const FIRST_PURCHASE_DATE = parseDate(scenario.purchases[FIRST_PURCHASE_MONTH_KEY][0].date);

function serialFor(date) {
  return toExcelSerial(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

describe("taxi Purchases date translation", () => {
  it("writes the fixture's own date when no target year is given", () => {
    const writes = taxiCellWrites(scenario);
    expect(writes[FIRST_PURCHASE_SHEET][FIRST_PURCHASE_CELL]).toBe(serialFor(FIRST_PURCHASE_DATE));
  });

  it("shifts the Purchases date by the same day offset as Sales for a different target year", () => {
    const scenarioStartYear = FIRST_PURCHASE_DATE.getUTCFullYear();
    const targetStartYear = scenarioStartYear - 3;
    const writes = taxiCellWrites(scenario, targetStartYear);

    const dayOffsetMs = Date.UTC(targetStartYear, 3, 6) - Date.UTC(scenarioStartYear, 3, 6);
    const expectedDate = new Date(FIRST_PURCHASE_DATE.getTime() + dayOffsetMs);

    expect(writes[FIRST_PURCHASE_SHEET][FIRST_PURCHASE_CELL]).toBe(serialFor(expectedDate));
    // The whole-year offset moves the date's year, not its month or day.
    expect(expectedDate.getUTCFullYear()).toBe(targetStartYear);
    expect(expectedDate.getUTCMonth()).toBe(FIRST_PURCHASE_DATE.getUTCMonth());
    expect(expectedDate.getUTCDate()).toBe(FIRST_PURCHASE_DATE.getUTCDate());
  });

  it("would have failed the shift assertion had Purchases kept writing the fixture's raw date (the bug this proves fixed)", () => {
    const scenarioStartYear = FIRST_PURCHASE_DATE.getUTCFullYear();
    const targetStartYear = scenarioStartYear - 3;
    const writes = taxiCellWrites(scenario, targetStartYear);

    // The pre-fix behaviour: Purchases wrote parseDate(tx.date) straight
    // through, ignoring targetStartYear entirely.
    const unshiftedSerial = serialFor(FIRST_PURCHASE_DATE);

    expect(writes[FIRST_PURCHASE_SHEET][FIRST_PURCHASE_CELL]).not.toBe(unshiftedSerial);
  });

  it("shifts every Purchases line in the month, not just the first", () => {
    const scenarioStartYear = FIRST_PURCHASE_DATE.getUTCFullYear();
    const targetStartYear = scenarioStartYear + 1;
    const dayOffsetMs = Date.UTC(targetStartYear, 3, 6) - Date.UTC(scenarioStartYear, 3, 6);

    const writes = taxiCellWrites(scenario, targetStartYear);
    const sheet = writes[FIRST_PURCHASE_SHEET];
    const transactions = scenario.purchases[FIRST_PURCHASE_MONTH_KEY];

    let row = 5;
    for (const tx of transactions) {
      const expectedDate = new Date(parseDate(tx.date).getTime() + dayOffsetMs);
      expect(sheet[`A${row}`]).toBe(serialFor(expectedDate));
      row++;
    }
  });
});
