// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { calculateIncomeTax, calculateExpectedTax } from "../../lib/tax/income-tax.js";

const RATES_2025_26 = {
  personal_allowance: 12570,
  basic_rate: 0.2,
  higher_rate: 0.4,
  basic_band_end: 37700,
};

const TAX_DATA_2025_26 = {
  income_tax: RATES_2025_26,
  national_insurance: {
    class4_lower_rate: 0.06,
    class4_lower_limit: 12570,
    class4_upper_rate: 0.02,
    class4_upper_limit: 50270,
  },
};

describe("calculateIncomeTax", () => {
  it("returns zero tax for profit below personal allowance", () => {
    const result = calculateIncomeTax(10000, RATES_2025_26);
    expect(result.taxableIncome).toBe(0);
    expect(result.totalIncomeTax).toBe(0);
  });

  it("calculates basic rate only for profit within basic band", () => {
    const profit = 30000;
    const result = calculateIncomeTax(profit, RATES_2025_26);
    expect(result.taxableIncome).toBe(17430);
    expect(result.basicRateTax).toBeCloseTo(3486, 0);
    expect(result.higherRateTax).toBe(0);
    expect(result.totalIncomeTax).toBeCloseTo(3486, 0);
  });

  it("calculates basic + higher rate for profit above basic band", () => {
    // BST precision code scenario: profit 333908
    const profit = 333908;
    const result = calculateIncomeTax(profit, RATES_2025_26);
    expect(result.personalAllowance).toBe(12570);
    expect(result.taxableIncome).toBe(321338);
    expect(result.basicRateTax).toBeCloseTo(7540, 0);
    expect(result.higherRateTax).toBeCloseTo(113455, 0);
    expect(result.totalIncomeTax).toBeCloseTo(120995, 0);
  });

  it("handles exact personal allowance boundary", () => {
    const result = calculateIncomeTax(12570, RATES_2025_26);
    expect(result.taxableIncome).toBe(0);
    expect(result.totalIncomeTax).toBe(0);
  });
});

describe("calculateExpectedTax", () => {
  it("matches reconcile.js output for BST precision code scenario", () => {
    const result = calculateExpectedTax(333908, TAX_DATA_2025_26);
    expect(result.income_tax).toBe(120995);
    expect(result.ni_class4_lower).toBe(2262);
    expect(result.total_tax_and_ni).toBe(128930);
  });

  it("returns zeros for profit below all thresholds", () => {
    const result = calculateExpectedTax(5000, TAX_DATA_2025_26);
    expect(result.income_tax).toBe(0);
    expect(result.ni_class4_lower).toBe(0);
    expect(result.ni_class4_upper).toBe(0);
    expect(result.total_tax_and_ni).toBe(0);
  });
});
