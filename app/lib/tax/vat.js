// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// vat.js — The VAT interface and the return forms a package carries, computed
// the way Vat.xlsx computes them.
//
// Vatinterface holds one row per VAT period in date order. Rows 6 to 17 are the
// twelve accounting months, each fed by its own Sales and Purchases month tab.
// Rows 4 and 5 are the two periods before the accounting year and rows 18 to 20
// the three after it, each fed by its own straddling entry sheet. Column B is
// the period end, C the payment due date, D/F the period's sales net and output
// VAT, H/J its purchases net and input VAT, and E/G/I/K the rolling
// three-period sums the return boxes read.
//
// A return form names a period end in G5 and looks every box up against the
// interface row carrying that date.

import { VAT_RETURN_END_MONTHS } from "../generator.js";

export { VAT_RETURN_END_MONTHS };

// The interface's first and last row, and the row the first accounting month
// lands on.
export const VATINTERFACE_FIRST_ROW = 4;
export const VATINTERFACE_LAST_ROW = 20;
export const VATINTERFACE_FIRST_MONTH_ROW = 6;

// Each interface row's period end, as the Admin B-column row its formula reads.
// Rows 4 and 5 take the two months before the accounting year, rows 6 to 17 the
// twelve month ends within it, and rows 18 to 20 the three that follow.
const PERIOD_END_ADMIN_ROWS = [2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20];

// The straddling entry sheet feeding each interface row outside the accounting
// year. Every other row is fed by a month tab.
export const STRADDLING_PERIOD_ROWS = { "02Y1": 4, "03Y1": 5, "04Y2": 18, "05Y2": 19, "06Y2": 20 };

/**
 * Take VAT off a gross figure the way a journal row does: the rate is held as a
 * percentage and the row divides by 100 plus it, rounding nothing.
 * @param {number} gross
 * @param {number} rate - a fraction, 0.2 for 20%
 * @returns {{ vat: number, net: number }}
 */
export function splitVat(gross, rate) {
  const percent = rate * 100;
  const vat = (gross * percent) / (100 + percent);
  return { vat, net: gross - vat };
}

/**
 * Sum straddling entries into the period totals their own sheet holds. Each
 * sheet takes VAT off each entry, so the totals are sums of row figures.
 * @param {Array} entries - scenario entries carrying { period, amount }
 * @param {number} rate
 * @returns {Object} period name -> { vat, net }
 */
export function straddlingPeriodTotals(entries, rate) {
  const totals = {};
  for (const entry of entries || []) {
    const { vat, net } = splitVat(entry.amount, rate);
    const period = (totals[entry.period] ||= { vat: 0, net: 0 });
    period.vat += vat;
    period.net += net;
  }
  return totals;
}

/**
 * Build the Vatinterface rows.
 *
 * @param {Object} options
 * @param {Array<{ vat: number, net: number }>} options.salesMonths - twelve month tabs, the first accounting month first
 * @param {Array<{ vat: number, net: number }>} options.purchasesMonths - the same, on the purchase journal
 * @param {Object} options.straddlingSales - period name -> { vat, net }
 * @param {Object} options.straddlingPurchases - the same, on the purchase side
 * @param {Object} options.adminDateSerials - Admin B-column row -> Excel serial
 * @param {number} [options.flatRateFlag] - the flat rate percentage column M carries
 * @returns {Object} row number -> { B, C, D, E, F, G, H, I, J, K, M }
 */
export function buildVatinterface({
  salesMonths,
  purchasesMonths,
  straddlingSales = {},
  straddlingPurchases = {},
  adminDateSerials,
  flatRateFlag = 0,
}) {
  const periodByRow = {};
  for (const [period, row] of Object.entries(STRADDLING_PERIOD_ROWS)) periodByRow[row] = period;

  const rows = {};
  for (let row = VATINTERFACE_FIRST_ROW; row <= VATINTERFACE_LAST_ROW; row++) {
    const adminRow = PERIOD_END_ADMIN_ROWS[row - VATINTERFACE_FIRST_ROW];
    const period = periodByRow[row];
    const monthIndex = row - VATINTERFACE_FIRST_MONTH_ROW;
    const sales = period ? straddlingSales[period] || { vat: 0, net: 0 } : salesMonths[monthIndex] || { vat: 0, net: 0 };
    const purchases = period ? straddlingPurchases[period] || { vat: 0, net: 0 } : purchasesMonths[monthIndex] || { vat: 0, net: 0 };
    rows[row] = {
      B: adminDateSerials[adminRow],
      D: sales.net,
      F: sales.vat,
      H: purchases.net,
      J: purchases.vat,
      M: flatRateFlag,
    };
  }

  // The payment due date is the next period's end, and the last row takes the
  // extra date the Admin sheet carries for it.
  for (let row = VATINTERFACE_FIRST_ROW; row < VATINTERFACE_LAST_ROW; row++) {
    rows[row].C = rows[row + 1].B;
  }
  rows[VATINTERFACE_LAST_ROW].C = adminDateSerials[25];

  // A quarter column sums its own period row and the two before it. The first
  // two rows close no quarter, so they carry no quarter columns.
  for (let row = VATINTERFACE_FIRST_MONTH_ROW; row <= VATINTERFACE_LAST_ROW; row++) {
    const window = [rows[row - 2], rows[row - 1], rows[row]];
    rows[row].E = window.reduce((total, r) => total + r.D, 0);
    rows[row].G = window.reduce((total, r) => total + r.F, 0);
    rows[row].I = window.reduce((total, r) => total + r.H, 0);
    rows[row].K = window.reduce((total, r) => total + r.J, 0);
  }

  return rows;
}

/**
 * The interface row a period end date lands on, or null when no row carries it.
 * @param {Object} interfaceRows - buildVatinterface() output
 * @param {number} periodEndSerial
 * @returns {number|null}
 */
export function vatinterfaceRowFor(interfaceRows, periodEndSerial) {
  for (const [row, values] of Object.entries(interfaceRows)) {
    if (Math.round(values.B) === Math.round(periodEndSerial)) return Number(row);
  }
  return null;
}

/**
 * The nine cells a VATQtr form carries, looked up against the interface the way
 * the form's own LOOKUP formulas do.
 *
 * @param {Object} interfaceRows - buildVatinterface() output
 * @param {number} periodEndSerial - the period the form is filled in for
 * @returns {Object} { G5, G7, G9, G11, G13, G15, G17, G21, G23 }
 */
export function vatReturnBoxes(interfaceRows, periodEndSerial) {
  const row = vatinterfaceRowFor(interfaceRows, periodEndSerial);
  const period = row === null ? { C: 0, E: 0, G: 0, I: 0, K: 0, M: 0 } : interfaceRows[row];
  const flatRate = (period.M || 0) > 0;
  const outputVat = period.G || 0;
  const inputVat = period.K || 0;
  // Box 2, VAT due on acquisitions from other EU states, is a nil the form
  // never computes and the customer overwrites by hand.
  const euAcquisitions = 0;
  return {
    G5: periodEndSerial,
    G7: period.C || 0,
    G9: outputVat,
    G11: euAcquisitions,
    G13: outputVat + euAcquisitions,
    G15: inputVat,
    G17: outputVat + euAcquisitions - inputVat,
    G21: (period.E || 0) + (flatRate ? outputVat : 0),
    G23: period.I || 0,
  };
}

/**
 * The period end each of the five return forms defaults to: a quarter apart,
 * counted in months from the book's first accounting month.
 * @param {Date} firstMonthStart - any day in the book's first month tab
 * @param {function(Date): number} toSerial
 * @returns {Array<number>} five Excel serials
 */
export function vatReturnPeriodEnds(firstMonthStart, toSerial) {
  return VAT_RETURN_END_MONTHS.map((months) => {
    const year = firstMonthStart.getUTCFullYear();
    const month = firstMonthStart.getUTCMonth() + months;
    return toSerial(new Date(Date.UTC(year, month, 0)));
  });
}
