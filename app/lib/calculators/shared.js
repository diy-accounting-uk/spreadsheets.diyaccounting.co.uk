// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// shared.js — Aggregation helpers used by more than one product calculator.

import { getMonthKey } from "../scenario-extractor.js";

/**
 * Group lines by accountMainID and month, computing totals.
 * @param {Array} lines
 * @returns {Map<string, Map<string, number>>} accountMainID → month → total
 */
export function aggregateByAccountAndMonth(lines) {
  const result = new Map();
  for (const line of lines) {
    const acct = String(line.accountMainID);
    const month = getMonthKey(line.postingDate);
    if (!result.has(acct)) result.set(acct, new Map());
    const acctMap = result.get(acct);
    acctMap.set(month, (acctMap.get(month) || 0) + line.amount);
  }
  return result;
}

/**
 * Sum the values of an object, treating a missing object as zero.
 */
export function sumValues(obj) {
  if (!obj) return 0;
  return Object.values(obj).reduce((total, value) => total + value, 0);
}

/**
 * Sum all amounts for a given accountMainID across all months.
 */
export function annualTotal(aggregated, accountMainID) {
  const acctMap = aggregated.get(String(accountMainID));
  if (!acctMap) return 0;
  let total = 0;
  for (const val of acctMap.values()) total += val;
  return total;
}

/**
 * Sum amounts for a set of accountMainIDs, mapped through a code map to group by code.
 * @returns {Object} { code: total, ... }
 */
export function aggregateByCode(lines, codeMap) {
  const byCode = {};
  for (const line of lines) {
    const code = codeMap[line.accountMainID];
    if (code) byCode[code] = (byCode[code] || 0) + line.amount;
  }
  return byCode;
}
