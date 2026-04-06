// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { calculateCorporationTax } from "../../lib/tax/corporation-tax.js";

const CT_RATES = {
  small_profits_rate: 0.19,
  main_rate: 0.25,
  small_profits_limit: 50000,
  small_profits_limit_upper: 250000,
  marginal_relief_fraction: 0.015,
};

describe("calculateCorporationTax", () => {
  it("applies small profits rate for profit <= 50000", () => {
    const result = calculateCorporationTax(40000, CT_RATES);
    expect(result.corporationTax).toBe(7600); // 40000 * 0.19
  });

  it("applies main rate for profit > 250000", () => {
    const result = calculateCorporationTax(300000, CT_RATES);
    expect(result.corporationTax).toBe(75000); // 300000 * 0.25
  });

  it("applies marginal relief in the band 50001-250000", () => {
    const result = calculateCorporationTax(100000, CT_RATES);
    // Main tax: 100000 * 0.25 = 25000
    // Relief: (250000 - 100000) * 0.015 = 2250
    // Net: 25000 - 2250 = 22750
    expect(result.corporationTax).toBe(22750);
    expect(result.marginalRelief).toBe(2250);
  });

  it("handles zero profit", () => {
    expect(calculateCorporationTax(0, CT_RATES).corporationTax).toBe(0);
  });

  it("handles boundary at small profits limit", () => {
    const result = calculateCorporationTax(50000, CT_RATES);
    expect(result.corporationTax).toBe(9500); // 50000 * 0.19
  });
});
