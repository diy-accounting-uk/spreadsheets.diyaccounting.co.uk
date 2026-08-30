// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { apportionCorporationTax, calculateCorporationTax, financialYearsInPeriod } from "../../lib/tax/corporation-tax.js";

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

  it("reads the upper limit from main_rate_limit, the name the rate tables use", () => {
    const rates = {
      small_profits_rate: 0.19,
      main_rate: 0.25,
      small_profits_limit: 50000,
      main_rate_limit: 250000,
      marginal_relief_fraction: 0.015,
    };
    const result = calculateCorporationTax(100000, rates);
    expect(result.corporationTax).toBe(22750);
    expect(result.marginalRelief).toBe(2250);
  });

  it("charges one rate and no relief for a year whose relief fraction is zero", () => {
    // FY2020 to FY2022: one rate of 19%, no small profits limit, no relief.
    const rates = {
      small_profits_rate: 0.19,
      main_rate: 0.19,
      small_profits_limit: 0,
      main_rate_limit: 0,
      marginal_relief_fraction: 0,
    };
    const result = calculateCorporationTax(147519.897839506, rates);
    expect(result.corporationTax).toBeCloseTo(28028.7806, 4);
    expect(result.marginalRelief).toBe(0);
  });
});

describe("financialYearsInPeriod", () => {
  it("puts a whole April-to-March year in one financial year", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2024, 3, 1)), new Date(Date.UTC(2025, 2, 31)));
    expect(totalDays).toBe(365);
    expect(years[0]).toMatchObject({ year: 2024, days: 365 });
    expect(years[1].days).toBe(0);
  });

  it("splits a June year end across the two financial years it falls in", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2023, 6, 1)), new Date(Date.UTC(2024, 5, 30)));
    expect(totalDays).toBe(366);
    expect(years[0]).toMatchObject({ year: 2023, days: 275 });
    expect(years[1]).toMatchObject({ year: 2024, days: 91 });
  });

  it("names a financial year for the calendar year it starts in", () => {
    const { years } = financialYearsInPeriod(new Date(Date.UTC(2025, 0, 1)), new Date(Date.UTC(2025, 11, 31)));
    expect(years[0].year).toBe(2024);
    expect(years[1].year).toBe(2025);
  });
});

describe("apportionCorporationTax", () => {
  const RATES = {
    smallProfitsRatePercent: [19, 19],
    mainRatePercent: 25,
    marginalReliefFraction: 0.015,
    lowerLimit: 50000,
    upperLimit: 250000,
  };

  it("charges the main rate less marginal relief on a year inside one financial year", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2024, 3, 1)), new Date(Date.UTC(2025, 2, 31)));
    const charge = apportionCorporationTax(163741.897839506, years, totalDays, RATES);
    expect(charge.rows[0].ratePercent).toBe(25);
    expect(charge.taxBeforeRelief).toBeCloseTo(40935.47446, 5);
    expect(charge.marginalRelief).toBeCloseTo(1293.87153, 5);
    expect(charge.tax).toBeCloseTo(39641.60293, 5);
  });

  it("apportions the profit and both relief limits by day count across two financial years", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2023, 6, 1)), new Date(Date.UTC(2024, 5, 30)));
    const charge = apportionCorporationTax(120000, years, totalDays, RATES);
    expect(charge.rows[0].profitShare).toBeCloseTo((120000 * 275) / 366, 6);
    expect(charge.rows[1].profitShare).toBeCloseTo((120000 * 91) / 366, 6);
    // Each share sits between its own apportioned limits, so both meet the
    // main rate and both take relief on the gap to the upper limit.
    expect(charge.rows[0].ratePercent).toBe(25);
    expect(charge.rows[1].ratePercent).toBe(25);
    expect(charge.rows[0].marginalRelief).toBeCloseTo(((250000 - 120000) * 275) / 366 / (1 / 0.015), 6);
    expect(charge.rows[1].marginalRelief).toBeCloseTo(((250000 - 120000) * 91) / 366 / (1 / 0.015), 6);
    expect(charge.marginalRelief).toBeCloseTo((250000 - 120000) * 0.015, 6);
  });

  it("charges the small profits rate on a share under its own apportioned lower limit", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2023, 6, 1)), new Date(Date.UTC(2024, 5, 30)));
    const charge = apportionCorporationTax(30000, years, totalDays, RATES);
    expect(charge.rows[0].ratePercent).toBe(19);
    expect(charge.rows[1].ratePercent).toBe(19);
    expect(charge.tax).toBeCloseTo(5700, 6);
  });

  it("charges the small profits rate on a whole year under the lower limit", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2024, 3, 1)), new Date(Date.UTC(2025, 2, 31)));
    const charge = apportionCorporationTax(40000, years, totalDays, RATES);
    expect(charge.rows[0].ratePercent).toBe(19);
    expect(charge.tax).toBe(7600);
  });

  it("charges nothing on a loss", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2024, 3, 1)), new Date(Date.UTC(2025, 2, 31)));
    expect(apportionCorporationTax(-5000, years, totalDays, RATES).tax).toBe(0);
  });
});
