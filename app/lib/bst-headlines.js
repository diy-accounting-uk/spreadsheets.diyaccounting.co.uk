// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst-headlines.js — the year-at-a-glance strip's own arithmetic: four tiles
// and two pies, derived once from R (the report document report-serializer.js
// builds) so the Node test and the browser page compute the same figures.
//
// Pure and browser-safe: no imports, no DOM, no formatting. A caller turns
// the numbers into "£12,000" or an SVG; this module only says what the
// figures are and which R keys they came from.

const EXPENSE_LINES = [
  ["cell/Profit & Loss Acc!C11", "Employee Costs"],
  ["cell/Profit & Loss Acc!C12", "Premises Costs"],
  ["cell/Profit & Loss Acc!C13", "Repairs & Maintenance"],
  ["cell/Profit & Loss Acc!C14", "General Admin"],
  ["cell/Profit & Loss Acc!C15", "Motor Expenses"],
  ["cell/Profit & Loss Acc!C16", "Travel & Subsistence"],
  ["cell/Profit & Loss Acc!C17", "Advertising"],
  ["cell/Profit & Loss Acc!C18", "Legal & Professional"],
  ["cell/Profit & Loss Acc!C19", "Bad Debts"],
  ["cell/Profit & Loss Acc!C20", "Interest & Finance"],
  ["cell/Profit & Loss Acc!C21", "Other Expenses"],
];

const OUTGOINGS_SLICE_CAP = 5;

// One figure read off R, carrying the key it came from so a caller can trace
// it back to the cell. A required key that R does not carry is an error
// naming the key; an optional one reads as zero with an empty trail and
// missing:true, which is how a book with no assets, stock or debtors reads.
function readCell(report, key, { optional = false } = {}) {
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
 * The year-at-a-glance strip's tiles and pies, derived from R.
 *
 * @param {{values: Array<{key: string, value: string}>}} report - R, as
 *   report-serializer.js's buildReportDocument() returns it
 * @returns {{tiles: Object, pies: Object, keys: Object}}
 */
export function headlinesFromReport(report) {
  const turnover = readCell(report, "cell/Profit & Loss Acc!C4");
  const costOfSalesCell = readCell(report, "cell/Profit & Loss Acc!C6");
  const directCosts = readCell(report, "cell/Profit & Loss Acc!C7");
  const costOfSales = addFigures(costOfSalesCell, directCosts);
  const runningCosts = readCell(report, "cell/Profit & Loss Acc!C22");
  const outgoingsTotal = addFigures(costOfSales, runningCosts);

  const writtenDown = readCell(report, "cell/Fixed Assets!M1", { optional: true });
  const stock = readCell(report, "cell/PurchasesStock!D30", { optional: true });
  const debtors = readCell(report, "cell/Debtors & Creditors!C29", { optional: true });
  const assetsTotal = addFigures(writtenDown, stock, debtors);

  const tax = readCell(report, "cell/Income Tax!E18");

  const expenseLines = EXPENSE_LINES.map(([key, label]) => {
    const figure = readCell(report, key);
    return { label, value: figure.value, from: figure.from };
  });

  const tiles = {
    turnover,
    outgoings: { total: outgoingsTotal, costOfSales, runningCosts },
    assets: { total: assetsTotal, writtenDown, stock, debtors },
    tax,
  };

  const pies = {
    turnover: turnoverPie(turnover, costOfSales, runningCosts, tax),
    outgoings: outgoingsPie(costOfSales, expenseLines, outgoingsTotal),
  };

  const keys = {
    "headline/turnover": turnover.value,
    "headline/outgoings": outgoingsTotal.value,
    "headline/assets": assetsTotal.value,
    "headline/tax": tax.value,
  };

  return { tiles, pies, keys };
}
