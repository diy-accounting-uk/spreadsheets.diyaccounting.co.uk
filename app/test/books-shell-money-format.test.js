// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// books-shell-money-format.test.js — the books page's fmtMoney formats the
// same value the reconciliation reads, not the raw double Intl.NumberFormat
// would round on its own.
//
// The Self Employed engine's own Profit Forecast!C41 (forecast.taxableIncome,
// the advanced fixture) lands on 119957.52499999986: close enough to the
// exact 119957.525 that Excel's own recalculation prints that a naive
// Intl.NumberFormat rounds it down to the penny below, while canonicalForUnit
// (which every reconciliation comparison already goes through) rounds it up
// to 119957.53, matching the sheet. shell.js's fmtMoney calls canonicalForUnit
// before formatting for exactly this reason; this test proves the gap it
// closes and pins the value it must resolve to.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadScenario } from "../lib/scenario-loader.js";
import { calculateSeCells } from "../lib/calculators/se.js";
import { canonicalForUnit } from "../lib/money-canonical.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const TAX_DATA = parseTOML(readFileSync(resolve(APP_DIR, "data", "se-2025-2026.toml"), "utf8"));

// The same currency formatter shell.js's moneyFmt is built with.
const moneyFmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });

// shell.js's fmtMoney: moneyFmt.format(Number(engine.canonicalForUnit(String(n), "money"))).
function fmtMoney(n) {
  return moneyFmt.format(Number(canonicalForUnit(String(n), "money")));
}

describe("the books page formats a money figure at the reconciliation's own precision", () => {
  it("Profit Forecast!C41 on the advanced SE fixture carries float noise below the penny", () => {
    const scenario = loadScenario(resolve(APP_DIR, "test", "fixtures", "se-scenario-advanced.toml"));
    const c41 = calculateSeCells({}, [], TAX_DATA, scenario)["Profit Forecast"].C41;

    expect(c41).toBe(119957.52499999986);
    // A naive Intl.NumberFormat reads that noise as a genuine value just
    // below the half-penny boundary and rounds down.
    expect(moneyFmt.format(c41)).toBe("£119,957.52");
    // canonicalForUnit absorbs the noise at a working precision first, so it
    // rounds the same way the reconciliation's own Excel-side figure does.
    expect(canonicalForUnit(String(c41), "money")).toBe("119957.53");
    expect(fmtMoney(c41)).toBe("£119,957.53");
  });

  it("still resolves a clean value the same way with or without the working-precision pass", () => {
    expect(fmtMoney(100.5)).toBe("£100.50");
    expect(fmtMoney(-42.005)).toBe("-£42.01");
  });
});
