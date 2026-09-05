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

// A declared list of `{label, key, optional}` items, each resolved to a
// labelled figure. Used for a tile's second line (SE's grants and
// interest, shown beside turnover but outside the pie), for the assets
// total's extra parts (SE's cash at bank and in hand, summed in), and for
// a turnover-pie's extra bridge slices (Ltd's dividends, optional since a
// company need not have declared any).
function resolveLines(report, lines = []) {
  return lines.map(({ label, key, optional }) => {
    const figure = readOneCell(report, key, optional);
    return { label, value: figure.value, from: figure.from };
  });
}

// A tile's own optional second line: one labelled figure shown beside the
// tile's headline value and excluded from every sum (Ltd's tax-outstanding
// and net-assets figures). Undeclared reads as no second line at all,
// unlike `resolveLines`, whose undeclared list reads as empty.
function resolveSecondLine(report, spec) {
  if (!spec) return undefined;
  const figure = readOneCell(report, spec.key, spec.optional);
  return { label: spec.label, value: figure.value, from: figure.from };
}

// The bridge from turnover to what is left: cost of sales, running costs,
// tax and NI, whatever extra slices the product declares (Ltd's
// dividends), then whatever remains. A negative remainder is a loss year;
// a negative slice is a refund year. Either way a pie cannot show it
// honestly, so the page draws a bar instead. The cost-of-sales, running-
// costs and tax slices carry the label their own declaration names (the
// default "Cost of sales" and "Tax and NI"; Ltd's "Administrative expenses"
// and "Corporation tax", the words its own sheet uses; Taxi's "vehicle
// costs", since its cost of sales is the vehicle-cost total).
function turnoverPie(turnover, costOfSales, costOfSalesLabel, runningCosts, runningCostsLabel, tax, taxLabel, pieExtra = []) {
  const extraTotal = pieExtra.reduce((total, slice) => total + slice.value, 0);
  const kept = turnover.value - costOfSales.value - runningCosts.value - tax.value - extraTotal;
  const slices = [
    { label: costOfSalesLabel, value: costOfSales.value, from: costOfSales.from },
    { label: runningCostsLabel, value: runningCosts.value, from: runningCosts.from },
    { label: taxLabel, value: tax.value, from: tax.from },
    ...pieExtra.map((slice) => ({ label: slice.label, value: slice.value, from: slice.from })),
    {
      label: "Kept",
      value: kept,
      from: [...turnover.from, ...costOfSales.from, ...runningCosts.from, ...tax.from, ...pieExtra.flatMap((slice) => slice.from)],
    },
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

// A declared list of `[key, label]` pairs, each read as a required cell and
// labelled for the outgoings pie. Used for a product's `expenseLines` (the
// pie's own list, added beside its automatic Cost of sales slice) and for
// `pieLines` (see `outgoingsPie` below).
function resolveKeyLabelPairs(report, pairs = []) {
  return pairs.map(([key, label]) => {
    const figure = readOneCell(report, key, false);
    return { label, value: figure.value, from: figure.from };
  });
}

// The largest spending categories, up to five, with everything else folded
// into one "Other" slice. Zero-value categories never reach the candidate
// list, so a book with nothing in a category never shows an empty slice.
// `pieLines`, when declared, replaces the whole candidate list -- Taxi's
// cost of sales is itself a bundle of the sheet's own vehicle-cost lines
// (fuel, car hire, ...), so a product that wants those shown individually
// declares `pieLines` with the full breakdown instead of one combined
// "Cost of sales" slice, and no `expenseLines` at all.
function outgoingsPie(costOfSales, expenseLines, outgoingsTotal, pieLines) {
  const candidates = (pieLines ?? [{ label: "Cost of sales", value: costOfSales.value, from: costOfSales.from }, ...expenseLines]).filter(
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

// A cell whose value is words, not a number -- Taxi's route cell, which the
// sheet leaves blank (so R carries no entry for it at all) on the
// actual-costs route. Read if present; absent reads as no value and an
// empty trail, never an error, since a blank route cell is what the
// sheet's own formula produces on that route.
function readOneTextCell(report, key) {
  const entry = report.values.find((value) => value.key === key);
  return entry ? { value: entry.value, from: [key] } : { value: undefined, from: [] };
}

// Taxi's vehicle-comparison tile: the miles driven, the mileage allowance
// claimed, what the vehicle actually cost to run, the sheet's own
// comparison figure and which route it took, plus whichever of vehicle
// costs or the mileage allowance the P&L actually charged. Present only
// when the product declares `vehicle` and its miles cell is above zero --
// a book that keeps no mileage log has nothing to compare.
function resolveVehicle(report, spec) {
  if (!spec) return undefined;
  const miles = readOneCell(report, spec.miles, false);
  if (miles.value <= 0) return undefined;
  const allowance = readOneCell(report, spec.allowance, false);
  const running = readOneCell(report, spec.running, false);
  const compared = readOneCell(report, spec.compared, false);
  const charged = readOneCell(report, spec.charged, false);
  const routeText = readOneTextCell(report, spec.route);
  const route = routeText.value === "MILEAGE ALLOWANCE" ? "mileage" : "actual";
  return { miles, allowance, running, compared, charged, route };
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
 *   `{label, key}`, shown beside the tile, outside the pie) and `pieExtra`
 *   (an array of `{label, key, optional}`, extra bridge slices folded into
 *   the turnover pie before "Kept" -- Ltd's dividends). assets may add
 *   `extra` (`[{label, key}]`, summed into the assets total). tax and
 *   assets may each add `secondLine` (one `{label, key}`, shown beside that
 *   tile's own value, outside every sum -- Ltd's tax-outstanding and
 *   net-assets figures). costOfSales, runningCosts and tax may each add
 *   `label` (a string, the turnover-pie slice's own name -- default "Cost
 *   of sales", "Running costs" and "Tax and NI"; Ltd names its sheet's own
 *   words, "Administrative expenses" and "Corporation tax"; Taxi names its
 *   own, "vehicle costs"). A product may replace `expenseLines` with
 *   `pieLines` (the same `[key, label]` shape) to give the outgoings pie
 *   its full candidate list directly, with no separate combined Cost of
 *   sales slice -- Taxi's vehicle-cost breakdown. A product may also
 *   declare `vehicle` (`{miles, allowance, running, compared, route,
 *   charged}`, each a cell key) for Taxi's mileage-versus-actual-costs
 *   tile. All default to empty/absent.
 * @returns {{tiles: Object, pies: Object, keys: Object}}
 */
export function headlinesFromReport(report, declaration) {
  if (!declaration) {
    throw new Error("headlinesFromReport: declaration is required");
  }

  const turnoverFigure = readKey(report, declaration.turnover);
  const turnoverSecondLine = resolveLines(report, declaration.turnover.secondLine);
  const turnover = turnoverSecondLine.length > 0 ? { ...turnoverFigure, secondLine: turnoverSecondLine } : turnoverFigure;
  const turnoverPieExtra = resolveLines(report, declaration.turnover.pieExtra);

  const costOfSales = readKey(report, declaration.costOfSales);
  const costOfSalesLabel = declaration.costOfSales.label ?? "Cost of sales";
  const runningCosts = readKey(report, declaration.runningCosts);
  const runningCostsLabel = declaration.runningCosts.label ?? "Running costs";
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
  const assetsTotalFigure = addFigures(writtenDown, stock, ...extra);
  const assetsSecondLine = resolveSecondLine(report, assetsDecl.secondLine);
  const assetsTotal = assetsSecondLine ? { ...assetsTotalFigure, secondLine: assetsSecondLine } : assetsTotalFigure;

  const taxFigure = readKey(report, declaration.tax);
  const taxSecondLine = resolveSecondLine(report, declaration.tax.secondLine);
  const tax = taxSecondLine ? { ...taxFigure, secondLine: taxSecondLine } : taxFigure;
  const taxLabel = declaration.tax.label ?? "Tax and NI";

  const expenseLines = resolveKeyLabelPairs(report, declaration.expenseLines);
  const pieLines = declaration.pieLines ? resolveKeyLabelPairs(report, declaration.pieLines) : undefined;

  const vehicle = resolveVehicle(report, declaration.vehicle);

  const tiles = {
    turnover,
    outgoings: { total: outgoingsTotal, costOfSales, runningCosts },
    assets: { total: assetsTotal, writtenDown, stock, debtors },
    tax,
  };
  if (vehicle) tiles.vehicle = vehicle;

  const pies = {
    turnover: turnoverPie(
      turnoverFigure,
      costOfSales,
      costOfSalesLabel,
      runningCosts,
      runningCostsLabel,
      taxFigure,
      taxLabel,
      turnoverPieExtra,
    ),
    outgoings: outgoingsPie(costOfSales, expenseLines, outgoingsTotal, pieLines),
  };

  const keys = {
    "headline/turnover": turnoverFigure.value,
    "headline/outgoings": outgoingsTotal.value,
    "headline/assets": assetsTotalFigure.value,
    "headline/tax": taxFigure.value,
  };
  if (vehicle) keys["headline/vehicle-costs"] = vehicle.charged.value;

  return { tiles, pies, keys };
}
