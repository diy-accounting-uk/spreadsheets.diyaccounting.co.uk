// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// headlines.js — the year-at-a-glance strip's own arithmetic: four tiles
// and two pies, derived once from R (the report document report-serializer.js
// builds) and a product's own HEADLINES declaration (the key names beside
// its CELL_MAP), so the Node test and the browser page compute the same
// figures from the same declared keys.
//
// Pure and browser-safe: no imports, no DOM, no formatting. A caller turns
// the numbers into "£12,000" or an SVG; this module only says what the
// figures are and which R keys they came from.

const OUTGOINGS_SLICE_CAP = 5;

// One figure read off R for a single cell key, carrying the key it came
// from so a caller can trace it back to the cell. A required key that R
// does not carry is an error naming the key; an optional one reads as zero
// with an empty trail and missing:true, which is how a book with no
// assets, stock or debtors reads.
function readOneCell(report, key, optional) {
  const entry = report.values.find((value) => value.key === key);
  if (!entry) {
    if (optional) return { value: 0, from: [], missing: true };
    throw new Error(`headlinesFromReport: report carries no value for ${key}`);
  }
  const value = Number(entry.value);
  if (!Number.isFinite(value)) {
    throw new Error(`headlinesFromReport: ${key} is "${entry.value}", not a number`);
  }
  return { value, from: [key] };
}

// Add two or more figures, keeping the union of the keys each one traces to.
function addFigures(...figures) {
  return {
    value: figures.reduce((total, figure) => total + figure.value, 0),
    from: figures.flatMap((figure) => figure.from),
  };
}

// One declared figure: `{key, optional}` reads a single cell; `{keys,
// optional}` reads several and sums them. This is how a HEADLINES
// declaration names both a single-cell tile (turnover) and a multi-cell one
// (BST and SE's cost of sales, which is stock plus direct costs).
function readKey(report, spec) {
  if (spec.keys) {
    return addFigures(...spec.keys.map((key) => readOneCell(report, key, spec.optional)));
  }
  return readOneCell(report, spec.key, spec.optional);
}

// A declared part of a tile that a product may not carry at all (Taxi
// declares no stock or debtors part for its assets tile). Undeclared reads
// the same as a declared-but-absent optional cell: zero, empty trail,
// missing:true.
function readDeclaredPart(report, spec) {
  if (!spec) return { value: 0, from: [], missing: true };
  return readKey(report, spec);
}

// A declared list of `{label, key}` pairs, each resolved to a labelled
// figure. Used for a tile's second line (SE's grants and interest, shown
// beside turnover but outside the pie) and for the assets total's extra
// parts (SE's cash at bank and in hand, summed in).
function resolveLines(report, lines = []) {
  return lines.map(({ label, key }) => {
    const figure = readOneCell(report, key, false);
    return { label, value: figure.value, from: figure.from };
  });
}

// The four-slice bridge from turnover to what is left: cost of sales,
// running costs, tax and NI, then whatever remains. A negative remainder is
// a loss year; a negative slice is a refund year. Either way a pie cannot
// show it honestly, so the page draws a bar instead.
function turnoverPie(turnover, costOfSales, runningCosts, tax) {
  const kept = turnover.value - costOfSales.value - runningCosts.value - tax.value;
  const slices = [
    { label: "Cost of sales", value: costOfSales.value, from: costOfSales.from },
    { label: "Running costs", value: runningCosts.value, from: runningCosts.from },
    { label: "Tax and NI", value: tax.value, from: tax.from },
    { label: "Kept", value: kept, from: [...turnover.from, ...costOfSales.from, ...runningCosts.from, ...tax.from] },
  ];
  const withShares = slices.map((slice) => ({ ...slice, share: turnover.value === 0 ? 0 : slice.value / turnover.value }));
  const negative = withShares.filter((slice) => slice.value < 0);
  if (negative.length > 0) {
    const reason =
      kept < 0
        ? "the year ran at a loss, so turnover cannot be split into positive slices"
        : "one of the turnover slices is negative, so it cannot be split into positive slices";
    return { mode: "bar", reason, slices: withShares };
  }
  return { mode: "pie", slices: withShares };
}

// The largest spending categories, up to five, with everything else folded
// into one "Other" slice. Zero-value categories never reach the candidate
// list, so a book with nothing in a category never shows an empty slice.
function outgoingsPie(costOfSales, expenseLines, outgoingsTotal) {
  const candidates = [{ label: "Cost of sales", value: costOfSales.value, from: costOfSales.from }, ...expenseLines].filter(
    (candidate) => candidate.value !== 0,
  );
  const ranked = [...candidates].sort((a, b) => b.value - a.value);
  const shown = ranked.slice(0, OUTGOINGS_SLICE_CAP);
  const rest = ranked.slice(OUTGOINGS_SLICE_CAP);
  const slices = [...shown];
  if (rest.length > 0) {
    slices.push({
      label: "Other",
      value: rest.reduce((total, candidate) => total + candidate.value, 0),
      from: rest.flatMap((candidate) => candidate.from),
    });
  }
  return {
    slices: slices
      .filter((slice) => slice.value !== 0)
      .map((slice) => ({ ...slice, share: outgoingsTotal.value === 0 ? 0 : slice.value / outgoingsTotal.value })),
  };
}

/**
 * The year-at-a-glance strip's tiles and pies, derived from R and a
 * product's HEADLINES declaration (see app/products/bst.js).
 *
 * @param {{values: Array<{key: string, value: string}>}} report - R, as
 *   report-serializer.js's buildReportDocument() returns it
 * @param {Object} declaration - the product's HEADLINES export: turnover,
 *   costOfSales, runningCosts, tax (each a `{key}` or `{keys}` spec),
 *   expenseLines (`[key, label]` pairs) and assets (writtenDown, stock,
 *   debtors, each optional). turnover may add `secondLine` (an array of
 *   `{label, key}`, shown beside the tile, outside the pie); assets may add
 *   `extra` (`[{label, key}]`, summed into the assets total). Both default
 *   to empty.
 * @returns {{tiles: Object, pies: Object, keys: Object}}
 */
export function headlinesFromReport(report, declaration) {
  if (!declaration) {
    throw new Error("headlinesFromReport: declaration is required");
  }

  const turnoverFigure = readKey(report, declaration.turnover);
  const turnoverSecondLine = resolveLines(report, declaration.turnover.secondLine);
  const turnover = turnoverSecondLine.length > 0 ? { ...turnoverFigure, secondLine: turnoverSecondLine } : turnoverFigure;

  const costOfSales = readKey(report, declaration.costOfSales);
  const runningCosts = readKey(report, declaration.runningCosts);
  const outgoingsTotal = addFigures(costOfSales, runningCosts);

  const assetsDecl = declaration.assets || {};
  const writtenDown = readDeclaredPart(report, assetsDecl.writtenDown);
  const stock = readDeclaredPart(report, assetsDecl.stock);
  // What the business holds is the written-down value of its assets, plus
  // its stock and whatever else the product declares as `extra` (SE sums in
  // cash at bank and in hand). What customers owe is a different kind of
  // figure and is reported beside the total, never inside it: on BST and SE
  // the sheet's "Amount owed by customers" counts every invoiced-and-
  // unsettled sale across the year, so in a book that records few
  // settlements it approaches turnover and a sum that includes it reads as
  // nonsense.
  const debtors = readDeclaredPart(report, assetsDecl.debtors);
  const extra = resolveLines(report, assetsDecl.extra);
  const assetsTotal = addFigures(writtenDown, stock, ...extra);

  const tax = readKey(report, declaration.tax);

  const expenseLines = declaration.expenseLines.map(([key, label]) => {
    const figure = readOneCell(report, key, false);
    return { label, value: figure.value, from: figure.from };
  });

  const tiles = {
    turnover,
    outgoings: { total: outgoingsTotal, costOfSales, runningCosts },
    assets: { total: assetsTotal, writtenDown, stock, debtors },
    tax,
  };

  const pies = {
    turnover: turnoverPie(turnoverFigure, costOfSales, runningCosts, tax),
    outgoings: outgoingsPie(costOfSales, expenseLines, outgoingsTotal),
  };

  const keys = {
    "headline/turnover": turnoverFigure.value,
    "headline/outgoings": outgoingsTotal.value,
    "headline/assets": assetsTotal.value,
    "headline/tax": tax.value,
  };

  return { tiles, pies, keys };
}
