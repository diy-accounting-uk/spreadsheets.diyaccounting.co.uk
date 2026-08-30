// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// corporation-tax.js — UK Corporation Tax calculation.

/**
 * Calculate corporation tax with marginal relief.
 *
 * The upper limit arrives as main_rate_limit in the ltd-<year>.toml rate
 * tables and as small_profits_limit_upper from callers that build the rates
 * by hand, so both names are read. The relief fraction is taken as it comes:
 * the financial years before 2023 carry a zero fraction and a zero upper
 * limit because there was one rate and no relief, and defaulting either of
 * those away invents a relief those years never had.
 *
 * @param {number} profit - profit chargeable to CT
 * @param {Object} ctRates - { small_profits_rate, main_rate, small_profits_limit, main_rate_limit, marginal_relief_fraction }
 * @returns {{ profitChargeable, smallProfitsRate, mainRate, corporationTax, marginalRelief }}
 */
export function calculateCorporationTax(profit, ctRates) {
  const spr = ctRates.small_profits_rate;
  const mr = ctRates.main_rate;
  const spl = ctRates.small_profits_limit;
  const splu = ctRates.main_rate_limit ?? ctRates.small_profits_limit_upper ?? 250000;
  const mrf = ctRates.marginal_relief_fraction ?? 0.015;

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

/**
 * The financial years an accounting period falls across.
 *
 * A UK financial year runs from 1 April, and it is named for the calendar
 * year it starts in. A period can span at most two of them, and the second
 * one is empty whenever the period ends on or before the first one does.
 *
 * @param {Date} periodStart
 * @param {Date} periodEnd
 * @returns {{ years: Array<{ year: number, start: Date, end: Date, days: number }>, totalDays: number }}
 */
export function financialYearsInPeriod(periodStart, periodEnd) {
  const firstYearEnd = financialYearEndOnOrAfter(periodStart);
  const firstEnd = firstYearEnd.getTime() < periodEnd.getTime() ? firstYearEnd : periodEnd;
  const secondStart = addDays(firstEnd, 1);

  const first = {
    year: financialYearNumber(periodStart),
    start: periodStart,
    end: firstEnd,
    days: dayCount(periodStart, firstEnd),
  };
  const second = {
    year: financialYearNumber(secondStart),
    start: secondStart,
    end: periodEnd,
    days: Math.max(0, dayCount(secondStart, periodEnd)),
  };
  return { years: [first, second], totalDays: dayCount(periodStart, periodEnd) };
}

/**
 * Corporation tax charged financial year by financial year, the way the
 * working sheet charges it: the chargeable profit is split across the two
 * years by day count, each share meets its own year's rate, and marginal
 * relief applies to a share that sits between the two limits, with both
 * limits apportioned by the same day count.
 *
 * @param {number} profitChargeable
 * @param {Array<{ year: number, days: number }>} financialYears - two entries, the second possibly nil
 * @param {number} totalDays
 * @param {Object} rates
 * @param {number[]} rates.smallProfitsRatePercent - one whole-number rate per financial year
 * @param {number} rates.mainRatePercent
 * @param {number} rates.marginalReliefFraction
 * @param {number} rates.lowerLimit
 * @param {number} rates.upperLimit
 * @returns {{ rows: Array<{ year, days, profitShare, ratePercent, taxBeforeRelief, marginalRelief, tax }>, tax: number, marginalRelief: number, taxBeforeRelief: number }}
 */
export function apportionCorporationTax(profitChargeable, financialYears, totalDays, rates) {
  const rows = financialYears.map((financialYear, index) => {
    const share = totalDays > 0 ? financialYear.days / totalDays : 0;
    const profitShare = profitChargeable > 0 ? profitChargeable * share : 0;
    const lowerLimit = rates.lowerLimit * share;
    const upperLimit = rates.upperLimit * share;
    const ratePercent = profitShare <= lowerLimit ? rates.smallProfitsRatePercent[index] : rates.mainRatePercent;
    const taxBeforeRelief = (profitShare * ratePercent) / 100;
    const marginalRelief =
      profitShare > lowerLimit && profitShare < upperLimit ? (upperLimit - profitShare) * rates.marginalReliefFraction : 0;
    return {
      year: financialYear.year,
      days: financialYear.days,
      profitShare,
      ratePercent,
      taxBeforeRelief,
      marginalRelief,
      tax: taxBeforeRelief - marginalRelief,
    };
  });

  return {
    rows,
    taxBeforeRelief: rows.reduce((total, row) => total + row.taxBeforeRelief, 0),
    marginalRelief: rows.reduce((total, row) => total + row.marginalRelief, 0),
    tax: rows.reduce((total, row) => total + row.tax, 0),
  };
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function financialYearEndOnOrAfter(date) {
  const sameYear = new Date(Date.UTC(date.getUTCFullYear(), 2, 31));
  return sameYear.getTime() >= date.getTime() ? sameYear : new Date(Date.UTC(date.getUTCFullYear() + 1, 2, 31));
}

function financialYearNumber(date) {
  return date.getUTCFullYear() - (date.getUTCMonth() < 3 ? 1 : 0);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * MILLISECONDS_PER_DAY);
}

function dayCount(start, end) {
  return Math.round((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY) + 1;
}
