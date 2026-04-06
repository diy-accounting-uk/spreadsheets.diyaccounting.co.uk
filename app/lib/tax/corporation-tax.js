// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// corporation-tax.js — UK Corporation Tax calculation.

/**
 * Calculate corporation tax with marginal relief.
 * @param {number} profit - profit chargeable to CT
 * @param {Object} ctRates - { small_profits_rate, main_rate, small_profits_limit, small_profits_limit_upper, marginal_relief_fraction }
 * @returns {{ profitChargeable, smallProfitsRate, mainRate, corporationTax, marginalRelief }}
 */
export function calculateCorporationTax(profit, ctRates) {
  const spr = ctRates.small_profits_rate;
  const mr = ctRates.main_rate;
  const spl = ctRates.small_profits_limit;
  const splu = ctRates.small_profits_limit_upper || 250000;
  const mrf = ctRates.marginal_relief_fraction || 0.015;

  if (profit <= 0) {
    return { profitChargeable: profit, smallProfitsRate: spr, mainRate: mr, corporationTax: 0, marginalRelief: 0 };
  }

  if (profit <= spl) {
    // Small profits rate
    return { profitChargeable: profit, smallProfitsRate: spr, mainRate: mr, corporationTax: profit * spr, marginalRelief: 0 };
  }

  if (profit > splu) {
    // Main rate
    return { profitChargeable: profit, smallProfitsRate: spr, mainRate: mr, corporationTax: profit * mr, marginalRelief: 0 };
  }

  // Marginal relief band
  const mainTax = profit * mr;
  const relief = (splu - profit) * mrf;
  const corporationTax = mainTax - relief;

  return { profitChargeable: profit, smallProfitsRate: spr, mainRate: mr, corporationTax, marginalRelief: relief };
}
