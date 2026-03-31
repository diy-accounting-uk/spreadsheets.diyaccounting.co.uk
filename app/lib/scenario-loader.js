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

export function loadScenario(path) {
  return parseTOML(readFileSync(path, "utf8"));
}
