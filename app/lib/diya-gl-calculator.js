// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-calculator.js — Pure JS calculation engine that computes financial
// reports from diya-gl data, producing output identical to what Excel formulas compute.
//
// The output shape matches runSpreadsheet results: { "SheetName": { "CellRef": value } }
// so product modules' reportSections() and checkCompliance() work unchanged.
//
// Each product's calculation lives in its own module under app/lib/calculators/,
// so a track working on one product's arithmetic touches only its own file.

import { calculateBstResults } from "./calculators/bst.js";
import { calculateTaxiResults } from "./calculators/taxi.js";
import { calculateSeResults } from "./calculators/se.js";
import { calculateLtdResults } from "./calculators/ltd.js";

export { aggregateByAccountAndMonth, annualTotal, sumValues, aggregateByCode } from "./calculators/shared.js";

/**
 * Main entry point. Calculate financial reports from diya-gl data.
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {string} product - 'bst' | 'taxi' | 'se' | 'ltd'
 * @param {Object} taxData - tax rates from app/data/*.toml format
 * @param {Object} [scenario] - optional scenario with stock/debtors/creditors
 * @returns {Object} { "SheetName": { "CellRef": value, ... }, ... }
 */
export function calculateFromDiyaGl(book, lines, product, taxData, scenario = {}) {
  if (product === "bst") return calculateBstResults(book, lines, taxData, scenario);
  if (product === "taxi") return calculateTaxiResults(book, lines, taxData, scenario);
  if (product === "se") return calculateSeResults(book, lines, taxData, scenario);
  if (product === "ltd") return calculateLtdResults(book, lines, taxData, scenario);
  throw new Error(`Product "${product}" not yet supported by JS calculator`);
}
