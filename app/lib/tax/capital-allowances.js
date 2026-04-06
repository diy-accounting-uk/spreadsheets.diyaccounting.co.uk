// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// capital-allowances.js — UK Capital Allowances calculation.

/**
 * Calculate capital allowances for a set of assets.
 * Simplified: assumes AIA covers all new additions.
 * @param {Array} assets - [{ category, cost, acc_dep, description }]
 * @param {Object} rates - { annual_investment_allowance, writing_down_allowance, writing_down_allowance_main }
 * @returns {{ aia, wdaMain, total }}
 */
export function calculateCapitalAllowances(assets, rates) {
  if (!assets || assets.length === 0) return { aia: 0, wdaMain: 0, total: 0 };

  const wdaRate = rates.writing_down_allowance_main || rates.writing_down_allowance || 0.18;
  let totalWDA = 0;

  for (const asset of assets) {
    const wdv = asset.cost - (asset.acc_dep || 0);
    if (wdv > 0) {
      totalWDA += wdv * wdaRate;
    }
  }

  return { aia: 0, wdaMain: Math.round(totalWDA * 100) / 100, total: Math.round(totalWDA * 100) / 100 };
}
