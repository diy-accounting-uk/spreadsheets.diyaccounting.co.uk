// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// itsa.js — the two ITSA answers HMRC's Self Employment Business API takes
// from a self-employed (se) book. deriveItsaQuarterlyUpdate answers one
// period: the period's own figures in a tax year filed as dated period
// summaries, a running total from 6 April in a year filed as cumulative
// period summaries. deriveItsaAnnualSubmission answers the year's allowances
// and adjustments. Both call calculators/se-derivations.js and add no
// arithmetic beyond summing quarters.
//
// The field set HMRC accepts changes by tax year (sa103-mtd-mapping.json's
// api.years: allowances gone from 2025-26, an adjustment gone from 2026-27,
// two test-only additions), and every answer here is filtered to the year's
// live fields. A field the template cannot source is omitted, never sent as
// a zero.

import {
  annualFieldsUnavailableForYear,
  buildSelfEmploymentAnnualSubmission,
  buildSelfEmploymentQuarterlyUpdates,
  fieldsOf,
  loadMapping,
  setPath,
} from "../calculators/se-derivations.js";
import { loadTaxDataForBook, productOf } from "../product-workbook.js";

export const QUARTERLY_PERIOD_TYPES = ["standard", "calendar"];

const TAX_YEAR_LABEL = /^(\d{4})-(\d{2})$/;

function requireSelfEmployedBook(book, lines, caller) {
  if (!book || !lines) throw new Error(`${caller} requires a book and its lines`);
  const product = productOf(book);
  if (product !== "se") {
    throw new Error(`The book is a "${product}" book; the ITSA derivations read a self-employed (se) book`);
  }
}

// "2025-26" names the package's se-2025-2026.toml; a label the mapping's
// api.years does not carry is refused before any figure is derived, because
// the field set for that year is unknown.
function taxYearFileNameFor(label) {
  const match = TAX_YEAR_LABEL.exec(label ?? "");
  if (!match) throw new Error(`taxYear must look like 2025-26, not "${label}"`);
  const start = Number(match[1]);
  const end = start + 1;
  if (String(end).slice(-2) !== match[2]) throw new Error(`taxYear "${label}" does not name two consecutive years`);
  return `se-${start}-${end}`;
}

async function taxDataFor(book, taxYear) {
  const options = taxYear ? { taxYearName: taxYearFileNameFor(taxYear) } : {};
  const taxData = await loadTaxDataForBook(book, options);
  const label = taxData?.tax_year?.label;
  if (!label) throw new Error("the tax year file declares no tax_year.label");
  if (!loadMapping().api.years[label]) {
    throw new Error(`sa103-mtd-mapping.json's api.years carries no entry for tax year "${label}"`);
  }
  return taxData;
}

function boxesOnRoute(route) {
  return loadMapping().boxes.filter((entry) => entry.form === "SA103F" && entry.route === route && entry.field);
}

/**
 * The quarterly field slots HMRC's period summary carries, from the mapping:
 * every quarterly-route field (a box shared by two fields counts both) plus
 * the consolidated-expenses election the box 31 caveat names. The mapping
 * varies none of these by tax year; the year decides the shape, not the set.
 * @returns {string[]}
 */
export function quarterlyFieldSlots() {
  const slots = new Set();
  for (const entry of boxesOnRoute("quarterly")) for (const field of fieldsOf(entry)) slots.add(field);
  slots.add("periodExpenses.consolidatedExpenses");
  return [...slots].sort();
}

/**
 * The annual field slots HMRC's schema accepts for one tax year: every
 * annual-route field in the mapping, less those api.years says are gone by
 * that year, less those added only in a later year, less the test-only
 * additions (a fieldsAdded entry carrying a status).
 * @param {string} taxYear - a label such as "2025-26"
 * @returns {string[]}
 */
export function annualFieldSlotsForTaxYear(taxYear) {
  const unavailable = annualFieldsUnavailableForYear(taxYear);
  for (const year of Object.values(loadMapping().api.years)) {
    for (const added of year.fieldsAdded || []) {
      if (typeof added !== "string") unavailable.add(added.field);
    }
  }
  const slots = new Set();
  for (const entry of boxesOnRoute("annual")) for (const field of fieldsOf(entry)) slots.add(field);
  return [...slots].filter((field) => !unavailable.has(field)).sort();
}

function readPath(target, path) {
  let node = target;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object" || !Object.hasOwn(node, part)) return undefined;
    node = node[part];
  }
  return node;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function sumPeriods(periods, slots) {
  const total = {};
  for (const slot of slots) {
    let sum = null;
    for (const period of periods) {
      const value = readPath(period, slot);
      if (typeof value === "number") sum = (sum ?? 0) + value;
    }
    if (sum !== null) setPath(total, slot, round2(sum));
  }
  return total;
}

// Rebuilds a payload from the slots the year accepts, in the mapping's own
// order, so a field the derivation never set stays absent and a field the
// year no longer accepts is dropped. Answers the payload and the slots left
// out of it.
function restrictToSlots(payload, slots) {
  const kept = {};
  const omitted = [];
  for (const slot of slots) {
    const value = readPath(payload, slot);
    if (value === undefined) omitted.push(slot);
    else setPath(kept, slot, value);
  }
  return { kept, omitted };
}

function periodLabel(period) {
  return `${period.periodDates.periodStartDate} to ${period.periodDates.periodEndDate}`;
}

/**
 * One period of the Self Employment Business API from a self-employed book.
 * In a tax year HMRC files as dated period summaries (2023-24, 2024-25) the
 * answer is that period's own figures; in a year filed as cumulative period
 * summaries (2025-26 on) it is the running total from the year's first
 * period through the one named. The period is picked by periodEndDate among
 * the year's four; with no periodEndDate every period is answered.
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {{periodEndDate?: string, quarterlyPeriodType?: "standard"|"calendar", taxYear?: string}} [params] -
 *   quarterlyPeriodType defaults to standard (6 April quarters); taxYear (as 2025-26) overrides the year the
 *   book's dates imply
 * @returns {Promise<Object>} { taxYear, shape, quarterlyPeriodType, fieldSlots, periods, warnings }
 */
export async function deriveItsaQuarterlyUpdate(book, lines, { periodEndDate, quarterlyPeriodType, taxYear } = {}) {
  requireSelfEmployedBook(book, lines, "deriveItsaQuarterlyUpdate");
  const taxData = await taxDataFor(book, taxYear);
  const label = taxData.tax_year.label;
  const shape = loadMapping().api.years[label].quarterly;
  const periodType = quarterlyPeriodType || "standard";
  if (!QUARTERLY_PERIOD_TYPES.includes(periodType)) {
    throw new Error(`quarterlyPeriodType must be one of ${QUARTERLY_PERIOD_TYPES.join(", ")}, not "${periodType}"`);
  }

  const derived = buildSelfEmploymentQuarterlyUpdates(book, lines, taxData, { quarterlyPeriodType: periodType });
  const slots = quarterlyFieldSlots();
  const periods = derived.periods;

  let wanted = periods;
  if (periodEndDate) {
    const index = periods.findIndex((period) => period.periodDates.periodEndDate === periodEndDate);
    if (index === -1) {
      throw new Error(
        `No ${periodType} period of ${label} ends on ${periodEndDate}; the periods end on ${periods.map((p) => p.periodDates.periodEndDate).join(", ")}`,
      );
    }
    wanted = [periods[index]];
  }

  const answers = wanted.map((period) => {
    const index = periods.indexOf(period);
    const covered = shape === "cumulative-period-summary" ? periods.slice(0, index + 1) : [period];
    const figures = shape === "cumulative-period-summary" ? sumPeriods(covered, slots) : period;
    const { kept, omitted } = restrictToSlots(figures, slots);
    return {
      periodDates: {
        periodStartDate: covered[0].periodDates.periodStartDate,
        periodEndDate: period.periodDates.periodEndDate,
      },
      ...kept,
      omitted,
      covers: covered.map(periodLabel),
    };
  });

  return {
    taxYear: label,
    shape,
    quarterlyPeriodType: periodType,
    fieldSlots: slots,
    periods: answers,
    warnings: derived.warnings,
  };
}

/**
 * The year's allowances and adjustments for the Self Employment Business
 * API's annual submission, from a self-employed book, restricted to the
 * fields HMRC's schema accepts for that tax year.
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {{taxYear?: string}} [params] - taxYear (as 2025-26) overrides the year the book's dates imply
 * @returns {Promise<Object>} { taxYear, fieldSlots, allowances, adjustments, omitted, warnings }
 */
export async function deriveItsaAnnualSubmission(book, lines, { taxYear } = {}) {
  requireSelfEmployedBook(book, lines, "deriveItsaAnnualSubmission");
  const taxData = await taxDataFor(book, taxYear);
  const label = taxData.tax_year.label;
  const slots = annualFieldSlotsForTaxYear(label);

  const derived = buildSelfEmploymentAnnualSubmission(book, lines, taxData);
  const { kept, omitted } = restrictToSlots(derived, slots);

  return {
    taxYear: label,
    fieldSlots: slots,
    ...kept,
    omitted,
    warnings: derived.warnings,
  };
}
