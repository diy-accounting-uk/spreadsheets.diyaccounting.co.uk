// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// period-shift.js — the whole-month, whole-year gap between the accounting
// period a scenario's dates sit in and the period a package covers, and the
// primitive that moves a date across it. Shared by every product whose
// writer dates postings onto a package generated for a year other than the
// scenario's own.

import { parseDate } from "./scenario-loader.js";

// Move a date forward by whole months. A day the shifted month does not have
// clamps to that month's end, so each of the period's twelve months lands on
// its own tab: a 31st shifted into a 30-day month stays in that month rather
// than rolling into the next one and doubling up with the month after it.
export function shiftMonths(d, monthOffset) {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + monthOffset;
  const lastDayOfShiftedMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(d.getUTCDate(), lastDayOfShiftedMonth)));
}

// The year the scenario's own accounting period opens in, read off the
// earliest date its posting journals carry. A date outside the period is not
// a posting -- a charge registered years before it, a straddling VAT entry
// after it -- so only the four journals whose entries belong to the period
// are read. A scenario with no postings at all has no period to read.
export function postingPeriodStartYear(scenario, startMonth) {
  let earliest = null;
  for (const journal of ["sales", "purchases", "bank", "payroll"]) {
    for (const entries of Object.values(scenario[journal] || {})) {
      for (const entry of entries) {
        const date = parseDate(entry.date);
        if (earliest === null || date < earliest) earliest = date;
      }
    }
  }
  if (earliest === null) return null;
  return earliest.getUTCFullYear() - (earliest.getUTCMonth() < startMonth ? 1 : 0);
}

/**
 * The whole-month gap between the accounting period a scenario's dates sit in
 * and the period a package covers, counting years as well as months. The
 * package's period opens the day after its year-end month, eleven months
 * back; the scenario states the month its own period opens in, and its year
 * comes from the book that declared it or from the earliest date its journals
 * post. A scenario already in the package's period has a zero gap and is
 * written as it stands, which is what makes exporting a package and
 * generating from the export reproduce the same cells.
 *
 * @param {Object} scenario
 * @param {number} targetStartYear - the year the package's period opens in
 *   for every year end but December's, which generate.js still names as the
 *   year before the year end
 * @param {number} yearEndMonth - 1-indexed month the package's year end falls in
 * @returns {number} months to shift each of the scenario's dates by
 */
export function periodShiftMonths(scenario, targetStartYear, yearEndMonth) {
  const sourceStartMonth = (scenario.period_start_month || 4) - 1;
  const sourceStartYear = scenario.period_start_year || postingPeriodStartYear(scenario, sourceStartMonth);
  if (sourceStartYear === null) return 0;
  if (!targetStartYear) {
    throw new Error("cellWrites: a package needs the calendar year its accounting period opens in");
  }
  const targetStartIndex = (targetStartYear + 1) * 12 + (yearEndMonth - 1) - 11;
  return targetStartIndex - (sourceStartYear * 12 + sourceStartMonth);
}
