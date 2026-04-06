// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// vat.js — UK VAT quarterly computation.

import { MONTH_ORDER } from "../scenario-extractor.js";

const QUARTERS = [
  { months: ["apr", "may", "jun"], label: "Q1" },
  { months: ["jul", "aug", "sep"], label: "Q2" },
  { months: ["oct", "nov", "dec"], label: "Q3" },
  { months: ["jan", "feb", "mar"], label: "Q4" },
];

/**
 * Calculate quarterly VAT from monthly sales and purchase totals.
 * @param {Object} salesByMonth - { apr: grossTotal, may: grossTotal, ... }
 * @param {Object} purchasesByMonth - { apr: grossTotal, ... }
 * @param {number} vatRate - e.g. 0.2 for 20%
 * @returns {{ quarters: Array<{ label, salesGross, salesVat, salesNet, purchasesGross, purchasesVat, purchasesNet, netVat }>, annual }}
 */
export function calculateQuarterlyVat(salesByMonth, purchasesByMonth, vatRate) {
  const vatFraction = vatRate / (1 + vatRate); // e.g. 0.2/1.2 = 1/6

  const quarters = QUARTERS.map((q) => {
    let salesGross = 0;
    let purchasesGross = 0;

    for (const m of q.months) {
      salesGross += salesByMonth[m] || 0;
      purchasesGross += purchasesByMonth[m] || 0;
    }

    const salesVat = salesGross * vatFraction;
    const salesNet = salesGross - salesVat;
    const purchasesVat = purchasesGross * vatFraction;
    const purchasesNet = purchasesGross - purchasesVat;
    const netVat = salesVat - purchasesVat;

    return { label: q.label, salesGross, salesVat, salesNet, purchasesGross, purchasesVat, purchasesNet, netVat };
  });

  const annual = {
    salesGross: quarters.reduce((s, q) => s + q.salesGross, 0),
    salesVat: quarters.reduce((s, q) => s + q.salesVat, 0),
    salesNet: quarters.reduce((s, q) => s + q.salesNet, 0),
    purchasesGross: quarters.reduce((s, q) => s + q.purchasesGross, 0),
    purchasesVat: quarters.reduce((s, q) => s + q.purchasesVat, 0),
    purchasesNet: quarters.reduce((s, q) => s + q.purchasesNet, 0),
    netVat: quarters.reduce((s, q) => s + q.netVat, 0),
  };

  return { quarters, annual };
}
