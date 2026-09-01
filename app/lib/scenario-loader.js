// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// scenario-loader.js — Shared utilities for loading TOML scenario fixtures.
// Product-specific cell writes, reads, and compliance checks live in app/products/.

import { parse as parseTOML } from "smol-toml";
import { readFileSync } from "fs";

export const MONTH_SHEETS = {
  apr: "Apr",
  may: "May",
  jun: "Jun",
  jul: "Jul",
  aug: "Aug",
  sep: "Sep",
  oct: "Oct",
  nov: "Nov",
  dec: "Dec",
  jan: "Jan",
  feb: "Feb",
  mar: "Mar",
};

export function parseDate(d) {
  if (d instanceof Date) return d;
  const [y, m, day] = String(d).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

// Extract tax year start year from scenario dates.
// Tax year runs April 6 to April 5: month >= 4 means this year, else last year.
export function extractTaxYearStart(scenario) {
  for (const section of [scenario.sales, scenario.purchases]) {
    if (!section) continue;
    for (const transactions of Object.values(section)) {
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        const month = d.getUTCMonth() + 1;
        return month >= 4 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
      }
    }
  }
  return null;
}

// The assets a year bought, for the products whose asset schedule is a
// separate sheet from the purchase journal. A purchase coded as capital
// reaches the journal's own fixed asset analysis column and stops there, so a
// scenario that lists no additions of its own would leave that spend
// capitalised in one book and absent from the other, earning no capital
// allowance at all. A scenario that does list them is taken at its word --
// that is where an asset's description, reference and its own cost live.
export function fixedAssetAdditions(scenario, capitalCode) {
  if (scenario.fixed_asset_additions) return scenario.fixed_asset_additions;
  const additions = [];
  for (const transactions of Object.values(scenario.purchases || {})) {
    for (const tx of transactions) {
      if (tx.code !== capitalCode) continue;
      additions.push({ date: tx.date, description: tx.supplier, reference: tx.supplier, cost: tx.amount });
    }
  }
  return additions;
}

/**
 * The officers the company registers carry: the book's own directors table
 * where it declares one, and otherwise the employees the payroll marks as
 * directors. A company officer is not always on the payroll -- a company
 * secretary or a non-executive director draws no salary -- so a register
 * built from the payroll alone leaves those officers off the record.
 * @param {Object} scenario
 * @returns {Array<{name: string, role: string, appointed?: string, resigned?: string}>}
 */
export function registerOfficers(scenario) {
  if (scenario?.directors?.length > 0) return scenario.directors;
  return (scenario?.employees || []).filter((employee) => employee.isDirector).map((employee) => ({ name: employee.name, role: "Director" }));
}

export function loadScenario(path) {
  return parseTOML(readFileSync(path, "utf8"));
}
