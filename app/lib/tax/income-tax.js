// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// income-tax.js — UK income tax calculation for self-employed individuals.

/**
 * Calculate income tax from profit and tax rates.
 * @param {number} profit - taxable profit before personal allowance
 * @param {Object} taxRates - { personal_allowance, basic_band_end, basic_rate, higher_rate }
 * @returns {{ personalAllowance, taxableIncome, basicRateTax, higherRateTax, totalIncomeTax }}
 */
export function calculateIncomeTax(profit, taxRates) {
  const pa = taxRates.personal_allowance;
  const taxableIncome = Math.max(0, profit - pa);
  const basicBand = taxRates.basic_band_end;
  const basicRateTax = Math.min(taxableIncome, basicBand) * taxRates.basic_rate;
  const higherRateTax = Math.max(0, taxableIncome - basicBand) * taxRates.higher_rate;
  const totalIncomeTax = basicRateTax + higherRateTax;

  return {
    personalAllowance: pa,
    taxableIncome,
    basicRateTax,
    higherRateTax,
    totalIncomeTax,
  };
}

/**
 * Backward-compatible wrapper matching reconcile.js calculateExpectedTax signature.
 * Computes income tax + NI Class 4 from profit and full tax data.
 * @param {number} profit - taxable profit
 * @param {Object} taxData - full tax data object (from app/data/*.toml)
 * @returns {{ income_tax, ni_class4_lower, ni_class4_upper, total_tax_and_ni }}
 */
export function calculateExpectedTax(profit, taxData) {
  const { totalIncomeTax } = calculateIncomeTax(profit, taxData.income_tax);

  const lowerLimit = taxData.national_insurance.class4_lower_limit;
  const upperLimit = taxData.national_insurance.class4_upper_limit;
  const lowerRate = taxData.national_insurance.class4_lower_rate;
  const upperRate = taxData.national_insurance.class4_upper_rate;
  const niLower = profit > lowerLimit ? (Math.min(profit, upperLimit) - lowerLimit) * lowerRate : 0;
  const niUpper = profit > upperLimit ? (profit - upperLimit) * upperRate : 0;

  return {
    income_tax: Math.round(totalIncomeTax),
    ni_class4_lower: Math.round(niLower * 10) / 10,
    ni_class4_upper: Math.round(niUpper * 10) / 10,
    total_tax_and_ni: Math.round(totalIncomeTax + niLower + niUpper),
  };
}
