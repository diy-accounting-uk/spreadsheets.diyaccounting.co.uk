// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

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

  it("divides both limits by one plus the number of associated companies", () => {
    // Two associates: the 50000/250000 limits become 16666.67/83333.33, so
    // a profit that sat mid-band against the undivided limits now clears
    // the (divided) upper limit and is charged at the main rate in full.
    const result = calculateCorporationTax(100000, { ...CT_RATES, associated_companies: 2 });
    expect(result.corporationTax).toBe(25000); // 100000 * 0.25, no relief
    expect(result.marginalRelief).toBe(0);
  });

  it("leaves the limits alone when associated_companies is absent or zero", () => {
    const withZero = calculateCorporationTax(100000, { ...CT_RATES, associated_companies: 0 });
    const withoutField = calculateCorporationTax(100000, CT_RATES);
    expect(withZero.corporationTax).toBe(withoutField.corporationTax);
    expect(withZero.corporationTax).toBe(22750);
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

  it("divides both apportioned limits by one plus the associated companies count", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2024, 3, 1)), new Date(Date.UTC(2025, 2, 31)));
    const undivided = apportionCorporationTax(120000, years, totalDays, RATES);
    const withAssociates = apportionCorporationTax(120000, years, totalDays, { ...RATES, associatedCompanies: 3 });
    // Four times the apportioned rate means a quarter of the relief, since
    // the profit sits well clear of the (now much lower) upper limit.
    expect(withAssociates.rows[0].ratePercent).toBe(25);
    expect(withAssociates.marginalRelief).toBe(0);
    expect(withAssociates.marginalRelief).not.toBe(undivided.marginalRelief);
    expect(withAssociates.tax).toBeCloseTo(120000 * 0.25, 6);
  });

  it("leaves apportioned limits alone when associatedCompanies is absent", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2024, 3, 1)), new Date(Date.UTC(2025, 2, 31)));
    const withoutField = apportionCorporationTax(120000, years, totalDays, RATES);
    const withZero = apportionCorporationTax(120000, years, totalDays, { ...RATES, associatedCompanies: 0 });
    expect(withZero.tax).toBe(withoutField.tax);
  });

  it("scales the relief by taxable profits over augmented profits", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2024, 3, 1)), new Date(Date.UTC(2025, 2, 31)));
    const noDistributions = apportionCorporationTax(120000, years, totalDays, RATES);
    const withDistributions = apportionCorporationTax(120000, years, totalDays, { ...RATES, frankedInvestmentIncome: 30000 });

    // Without distributions the relief is (250,000 - 120,000) x 3/200. With
    // 30,000 of them augmented profits are 150,000, so the gap narrows to
    // 100,000 and the relief keeps only 120,000/150,000 of it.
    expect(noDistributions.marginalRelief).toBeCloseTo(1950, 6);
    expect(withDistributions.marginalRelief).toBeCloseTo(1200, 6);
    // The tax is still charged on the 120,000, never on the augmented figure.
    expect(withDistributions.rows[0].taxBeforeRelief).toBeCloseTo(30000, 6);
    expect(withDistributions.augmentedProfits).toBe(150000);
  });

  it("charges the main rate when distributions carry augmented profits over the lower limit", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2024, 3, 1)), new Date(Date.UTC(2025, 2, 31)));
    const smallProfits = apportionCorporationTax(40000, years, totalDays, RATES);
    const carriedOver = apportionCorporationTax(40000, years, totalDays, { ...RATES, frankedInvestmentIncome: 20000 });
    expect(smallProfits.rows[0].ratePercent).toBe(19);
    expect(smallProfits.marginalRelief).toBe(0);
    expect(carriedOver.rows[0].ratePercent).toBe(25);
    expect(carriedOver.marginalRelief).toBeCloseTo(((250000 - 60000) * 40000 * 0.015) / 60000, 6);
  });

  it("charges no relief when distributions carry augmented profits over the upper limit", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2024, 3, 1)), new Date(Date.UTC(2025, 2, 31)));
    const charge = apportionCorporationTax(120000, years, totalDays, { ...RATES, frankedInvestmentIncome: 200000 });
    expect(charge.marginalRelief).toBe(0);
    expect(charge.tax).toBeCloseTo(30000, 6);
  });

  it("leaves the charge alone when frankedInvestmentIncome is absent", () => {
    const { years, totalDays } = financialYearsInPeriod(new Date(Date.UTC(2024, 3, 1)), new Date(Date.UTC(2025, 2, 31)));
    const withoutField = apportionCorporationTax(120000, years, totalDays, RATES);
    const withZero = apportionCorporationTax(120000, years, totalDays, { ...RATES, frankedInvestmentIncome: 0 });
    expect(withZero.tax).toBe(withoutField.tax);
  });
});

describe("calculateCorporationTax with franked investment income", () => {
  it("scales the relief the same way the apportioned computation does", () => {
    const plain = calculateCorporationTax(120000, CT_RATES);
    const withDistributions = calculateCorporationTax(120000, { ...CT_RATES, franked_investment_income: 30000 });
    expect(plain.marginalRelief).toBeCloseTo(1950, 6);
    expect(withDistributions.marginalRelief).toBeCloseTo(1200, 6);
    expect(withDistributions.corporationTax).toBeCloseTo(120000 * 0.25 - 1200, 6);
  });

  it("tests the bands on augmented profits, and taxes only the chargeable profit", () => {
    const carriedOver = calculateCorporationTax(40000, { ...CT_RATES, franked_investment_income: 20000 });
    expect(carriedOver.corporationTax).toBeCloseTo(40000 * 0.25 - ((250000 - 60000) * 40000 * 0.015) / 60000, 6);
    const overTheTop = calculateCorporationTax(120000, { ...CT_RATES, franked_investment_income: 200000 });
    expect(overTheTop.marginalRelief).toBe(0);
    expect(overTheTop.corporationTax).toBeCloseTo(30000, 6);
  });

  it("charges nothing on a loss, whatever distributions came in", () => {
    expect(calculateCorporationTax(-5000, { ...CT_RATES, franked_investment_income: 100000 }).corporationTax).toBe(0);
  });
});
