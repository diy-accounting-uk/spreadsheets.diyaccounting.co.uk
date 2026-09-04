// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// income-tax.js — UK income tax calculation for self-employed individuals.

/**
 * Calculate income tax from profit and tax rates.
 *
 * The personal allowance falls by one pound for every two pounds of income
 * above the taper threshold (ITA 2007 s35). That divisor has not moved since
 * 2010, so it sits in the formula rather than in the tax data.
 *
 * @param {number} profit - taxable profit before personal allowance
 * @param {Object} taxRates - { personal_allowance, personal_allowance_taper_threshold, basic_band_end,
 *   higher_band_end, basic_rate, higher_rate, additional_rate }
 * @returns {{ personalAllowance, taxableIncome, basicRateTax, higherRateTax, additionalRateTax, totalIncomeTax }}
 */
export function calculateIncomeTax(profit, taxRates) {
  const withdrawn = Math.max(0, profit - taxRates.personal_allowance_taper_threshold) / 2;
  const pa = Math.max(0, taxRates.personal_allowance - withdrawn);
  const taxableIncome = Math.max(0, profit - pa);
  const basicBandEnd = taxRates.basic_band_end;
  const higherBandEnd = taxRates.higher_band_end;
  const basicRateTax = Math.min(taxableIncome, basicBandEnd) * taxRates.basic_rate;
  const higherRateTax = Math.max(0, Math.min(taxableIncome, higherBandEnd) - basicBandEnd) * taxRates.higher_rate;
  const additionalRateTax = Math.max(0, taxableIncome - higherBandEnd) * taxRates.additional_rate;
  const totalIncomeTax = basicRateTax + higherRateTax + additionalRateTax;

  return {
    personalAllowance: pa,
    taxableIncome,
    basicRateTax,
    higherRateTax,
    additionalRateTax,
    totalIncomeTax,
  };
}

// Half up to the penny, for the voluntary Class 2 figure below.
function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Backward-compatible wrapper matching reconcile.js calculateExpectedTax signature.
 * Computes income tax + NI Class 4 from profit and full tax data.
 * @param {number} profit - taxable profit
 * @param {Object} taxData - full tax data object (from app/data/*.toml)
 * @returns {{ income_tax, personal_allowance, income_tax_basic, income_tax_higher, income_tax_additional,
 *   ni_class4_lower, ni_class4_upper, total_tax_and_ni, ni_class2_weekly, ni_class2_threshold, ni_class2 }}
 */
export function calculateExpectedTax(profit, taxData) {
  const { totalIncomeTax, personalAllowance, basicRateTax, higherRateTax, additionalRateTax } = calculateIncomeTax(
    profit,
    taxData.income_tax,
  );

  const lowerLimit = taxData.national_insurance.class4_lower_limit;
  const upperLimit = taxData.national_insurance.class4_upper_limit;
  const lowerRate = taxData.national_insurance.class4_lower_rate;
  const upperRate = taxData.national_insurance.class4_upper_rate;
  const niLower = profit > lowerLimit ? (Math.min(profit, upperLimit) - lowerLimit) * lowerRate : 0;
  const niUpper = profit > upperLimit ? (profit - upperLimit) * upperRate : 0;

  // Class 2 is voluntary below the small profits threshold (a customer may
  // choose to pay it to protect their state pension record) and nil above
  // it, where the NI record is credited without payment. Both fields stay
  // undefined for a tax year with no declared threshold.
  const class2Weekly = taxData.national_insurance.class2_weekly_rate;
  const class2Threshold = taxData.national_insurance.class2_small_profits_threshold;
  const hasClass2Threshold = class2Threshold !== undefined;

  return {
    income_tax: Math.round(totalIncomeTax),
    personal_allowance: personalAllowance,
    income_tax_basic: basicRateTax,
    income_tax_higher: higherRateTax,
    income_tax_additional: additionalRateTax,
    ni_class4_lower: Math.round(niLower * 10) / 10,
    ni_class4_upper: Math.round(niUpper * 10) / 10,
    total_tax_and_ni: Math.round(totalIncomeTax + niLower + niUpper),
    ni_class2_weekly: hasClass2Threshold ? class2Weekly : undefined,
    ni_class2_threshold: hasClass2Threshold ? class2Threshold : undefined,
    ni_class2: hasClass2Threshold ? (profit < class2Threshold && class2Threshold > 0 ? round2(class2Weekly * 52) : 0) : undefined,
  };
}
