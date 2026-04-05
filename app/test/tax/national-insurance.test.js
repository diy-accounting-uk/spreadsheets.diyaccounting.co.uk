// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { calculateNIClass4, calculateNIClass2 } from "../../lib/tax/national-insurance.js";

const NI_RATES_2025_26 = {
  class4_lower_limit: 12570,
  class4_upper_limit: 50270,
  class4_lower_rate: 0.06,
  class4_upper_rate: 0.02,
};

describe("calculateNIClass4", () => {
  it("returns zero for profit below lower limit", () => {
    const result = calculateNIClass4(10000, NI_RATES_2025_26);
    expect(result.lowerBand).toBe(0);
    expect(result.upperBand).toBe(0);
    expect(result.total).toBe(0);
  });

  it("calculates lower band only for profit between limits", () => {
    const result = calculateNIClass4(30000, NI_RATES_2025_26);
    expect(result.lowerBand).toBeCloseTo((30000 - 12570) * 0.06, 2);
    expect(result.upperBand).toBe(0);
  });

  it("calculates both bands for profit above upper limit", () => {
    const profit = 333908;
    const result = calculateNIClass4(profit, NI_RATES_2025_26);
    expect(result.lowerBand).toBeCloseTo((50270 - 12570) * 0.06, 2);
    expect(result.upperBand).toBeCloseTo((333908 - 50270) * 0.02, 2);
    expect(result.total).toBeCloseTo(result.lowerBand + result.upperBand, 2);
  });

  it("matches BST precision code scenario NI values", () => {
    const result = calculateNIClass4(333908, NI_RATES_2025_26);
    expect(result.lowerBand).toBeCloseTo(2262, 0);
    expect(result.upperBand).toBeCloseTo(5672.76, 2);
  });
});

describe("calculateNIClass2", () => {
  it("returns zero when weekly rate is zero", () => {
    expect(calculateNIClass2(50000, { class2_weekly_rate: 0 })).toBe(0);
  });

  it("calculates annual amount from weekly rate", () => {
    expect(calculateNIClass2(50000, { class2_weekly_rate: 3.45 })).toBeCloseTo(179.4, 1);
  });
});
