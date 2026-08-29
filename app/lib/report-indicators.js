// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// report-indicators.js — pull the headline indicators out of a reconciliation report.
//
// A reconciliation report runs to a hundred kilobytes, most of it an appendix of cell
// values. The judge reads a dozen indicator lines instead: whether the balance sheet
// balances, the turnover and profit, the tax charge, the VAT boxes against the
// registration, and the profit bridge residue. Everything here is read straight out of the
// report markdown, so the judge weighs figures the run actually produced.

const money = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CHECK_HEADER = "Check";
const SEPARATOR = /^:?-+:?$/;

function cleanCell(cell) {
  return cell
    .replace(/&nbsp;/g, " ")
    .replace(/\*\*/g, "")
    .trim();
}

function splitRow(line) {
  return line
    .slice(1, line.endsWith("|") ? -1 : undefined)
    .split("|")
    .map(cleanCell);
}

// "47,516.89" is 47516.89, "—" is a blank the sheet never filled, and "-0" is zero.
export function toNumber(text) {
  if (text === undefined || text === null) return null;
  const trimmed = String(text).trim();
  if (trimmed === "" || trimmed === "—" || trimmed === "-") return null;
  const parsed = Number(trimmed.replace(/,/g, "").replace(/^£/, ""));
  if (Number.isNaN(parsed)) return null;
  return parsed === 0 ? 0 : parsed;
}

// Reads the report into its status line, its compliance check rows, and one label-to-value
// map per top-level section. The appendix's per-sheet cell tables sit under ### headings and
// are skipped: they repeat the same figures cell by cell.
export function parseReport(markdown) {
  const sections = new Map();
  const checks = [];
  let status = "";
  let heading = null;

  for (const line of String(markdown).split("\n")) {
    if (line.startsWith("Status:")) {
      status = line.slice("Status:".length).trim();
      continue;
    }
    if (line.startsWith("### ")) {
      heading = null;
      continue;
    }
    if (line.startsWith("## ")) {
      heading = line.slice(3).trim();
      if (!sections.has(heading)) sections.set(heading, new Map());
      continue;
    }
    if (heading === null || !line.startsWith("|")) continue;

    const cells = splitRow(line);
    if (cells.every((cell) => SEPARATOR.test(cell))) continue;

    if (cells.length === 5) {
      if (cells[0] === CHECK_HEADER) continue;
      checks.push({ check: cells[0], expected: cells[1], actual: cells[2], diff: cells[3], result: cells[4] });
      continue;
    }
    const label = cells[0];
    if (label === "" || label === "Line") continue;
    if (cells.length === 2) sections.get(heading).set(label, cells[1]);
    else if (cells.length === 3) sections.get(heading).set(label, cells[2]);
  }

  return { status, checks, sections };
}

export function checkCounts(report) {
  const counts = { passed: 0, warnings: 0, failed: 0 };
  for (const { result } of report.checks) {
    if (result === "PASS") counts.passed++;
    else if (result.includes("WARN")) counts.warnings++;
    else counts.failed++;
  }
  return counts;
}

export function warningChecks(report) {
  return report.checks.filter((row) => row.result.includes("WARN")).map((row) => row.check);
}

export function failedChecks(report) {
  return report.checks.filter((row) => row.result !== "PASS" && !row.result.includes("WARN")).map((row) => row.check);
}

export function checkActual(report, name) {
  const row = report.checks.find((check) => check.check === name);
  if (!row) throw new Error(`Report has no check named ${name}`);
  return toNumber(row.actual);
}

export function value(report, section, label) {
  return toNumber(report.sections.get(section)?.get(label));
}

// A label the report no longer carries would drop an indicator and leave the judge passing a
// run it never saw the figures for, so a missing one stops the digest instead.
export function requireValue(report, section, label) {
  const found = value(report, section, label);
  if (found === null) throw new Error(`Report has no ${label} under ${section}`);
  return found;
}

function amount(number) {
  return number === null ? "not reported" : money.format(number);
}

// ── Indicator lines ─────────────────────────────────────────────────────────

function runLine(report) {
  const counts = checkCounts(report);
  const parts = [
    `Deterministic run: ${report.status || "no status line"}.`,
    `Checks: ${counts.passed} passed, ${counts.warnings} warning${counts.warnings === 1 ? "" : "s"}, ${counts.failed} failed.`,
  ];
  const warnings = warningChecks(report);
  if (warnings.length > 0) parts.push(`Warned: ${warnings.join("; ")}.`);
  const failures = failedChecks(report);
  if (failures.length > 0) parts.push(`Failed: ${failures.join("; ")}.`);
  return parts.join(" ");
}

function bridgeLine(report) {
  const residue = requireValue(report, "Accounting profit to tax profit bridge", "Residue");
  const computed = value(report, "Accounting profit to tax profit bridge", "Tax profit the bridge computes");
  const carried = value(report, "Accounting profit to tax profit bridge", "Tax profit the sheet carries");
  return `Profit bridge: the bridge computes a tax profit of ${amount(computed)}, the sheet carries ${amount(carried)}, residue ${amount(residue)}.`;
}

function vatLine(report, vatRegistered) {
  const section = report.sections.get("VAT Returns");
  if (!section) return null;
  const boxes = [1, 2, 3, 4].map((quarter) => ({
    quarter,
    output: value(report, "VAT Returns", `Q${quarter} box 1: VAT due on sales`),
    input: value(report, "VAT Returns", `Q${quarter} box 4: VAT reclaimed on purchases`),
  }));
  const nonZero = boxes.filter((box) => box.output || box.input).length;
  const due = value(report, "VAT Returns", "VAT due for the year");
  const registration =
    vatRegistered === true ? "registered for VAT" : vatRegistered === false ? "not registered for VAT" : "of unstated VAT registration";
  return [
    `VAT: the scenario is ${registration}.`,
    `Box 1 output VAT by quarter ${boxes.map((box) => amount(box.output)).join(" / ")};`,
    `box 4 input VAT ${boxes.map((box) => amount(box.input)).join(" / ")};`,
    `VAT due for the year ${amount(due)}.`,
    `${nonZero} of the four quarters carry a non-zero box.`,
  ].join(" ");
}

// The personal allowance is what separates a nil charge on a small profit from a nil charge
// that has lost the profit, so the line carries both ends of the computation.
function incomeTaxLine(report, section) {
  const charged = requireValue(report, section, "Profit from Self Employment");
  const allowance = value(report, section, "Less: Personal Allowance");
  const taxableIncome = value(report, section, "Taxable Income");
  const tax = requireValue(report, section, "Total Income Tax");
  const total = value(report, section, "Total Tax + NI");
  return [
    `Income tax: charged on a profit of ${amount(charged)};`,
    `a personal allowance of ${amount(allowance)} leaves taxable income of ${amount(taxableIncome)};`,
    `income tax ${amount(tax)}, income tax and National Insurance together ${amount(total)}.`,
  ].join(" ");
}

function ltdIndicators(report, vatRegistered) {
  const turnover = requireValue(report, "Published P&L", "Total Sales Turnover");
  const gross = requireValue(report, "Published P&L", "Gross Profit");
  const pbt = requireValue(report, "Published P&L", "Profit Before Tax");
  const netAssets = requireValue(report, "Published Balance Sheet", "Net Assets");
  const funds = requireValue(report, "Published Balance Sheet", "Shareholders' Funds");
  const audit = checkActual(report, "Trial Balance: audit accuracy (EJ91)");
  const chargeable = requireValue(report, "Corporation Tax working sheet", "Profit Chargeable to CT");
  const allowances = value(report, "Corporation Tax working sheet", "Less: Capital Allowances");
  const charge = requireValue(report, "Corporation Tax working sheet", "Corporation Tax");
  const filed = value(report, "CT600 as filed", "Box 63: corporation tax");
  const nbv = value(report, "Fixed Asset Note", "Net book value");
  const depreciation = value(report, "Fixed Asset Note", "Charge for the year");
  const stock = value(report, "Published Balance Sheet", "Stock at cost");

  return [
    runLine(report),
    `Turnover ${amount(turnover)}, gross profit ${amount(gross)}, profit before tax ${amount(pbt)} (published profit and loss account).`,
    `Balance sheet: net assets ${amount(netAssets)} against shareholders' funds ${amount(funds)}, difference ${amount(netAssets - funds)}.`,
    `Trial balance audit accuracy (cell EJ91): ${amount(audit)}.`,
    `Fixed assets: net book value ${amount(nbv)}, depreciation charged for the year ${amount(depreciation)}. Stock at the year end ${amount(stock)}.`,
    `Corporation tax: capital allowances ${amount(allowances)} take the profit chargeable to ${amount(chargeable)}, charge for the year ${amount(charge)}, box 63 as filed ${amount(filed)}.`,
    vatLine(report, vatRegistered),
    bridgeLine(report),
  ];
}

function seIndicators(report, vatRegistered) {
  const turnover = requireValue(report, "Profit & Loss Account", "Sales Turnover");
  const gross = requireValue(report, "Profit & Loss Account", "Gross Profit");
  const pbt = requireValue(report, "Profit & Loss Account", "Profit Before Tax");
  const saNet = requireValue(report, "Self Assessment (SA103S)", "Net profit/loss");
  const allowances = value(report, "Self Assessment (SA103S)", "Capital allowances");
  const taxable = requireValue(report, "Self Assessment (SA103S)", "Taxable profit");
  const grants = value(report, "Self Assessment (SA103S)", "Grants as other business income (box 29)");
  const forTax = requireValue(report, "Self Assessment (SA103S)", "Net profit for tax calc");

  return [
    runLine(report),
    `Turnover ${amount(turnover)}, gross profit ${amount(gross)}, profit before tax ${amount(pbt)}.`,
    `Self assessment: net profit ${amount(saNet)}, capital allowances ${amount(allowances)}, taxable profit ${amount(taxable)}, grants as other business income ${amount(grants)}, net profit for the tax calculation ${amount(forTax)}.`,
    incomeTaxLine(report, "Income Tax Calculation"),
    vatLine(report, vatRegistered),
    bridgeLine(report),
    "This product publishes no balance sheet: a profit and loss account, a self assessment return and the VAT returns are the whole output.",
  ];
}

function bstIndicators(report) {
  const turnover = requireValue(report, "Profit & Loss Account", "Sales Turnover");
  const gross = requireValue(report, "Profit & Loss Account", "Gross Profit");
  const net = requireValue(report, "Profit & Loss Account", "Net Profit");
  const taxable = requireValue(report, "Profit & Loss Account", "Taxable Profit");
  const allowances = value(report, "Profit & Loss Account", "Capital Allowances");
  const capitalised = value(report, "Purchase Analysis", "Purchases capitalised as fixed assets");

  return [
    runLine(report),
    `Turnover ${amount(turnover)}, gross profit ${amount(gross)}, net profit ${amount(net)}.`,
    `Capital allowances ${amount(allowances)} claimed against ${amount(capitalised)} of purchases capitalised as fixed assets, taking the taxable profit to ${amount(taxable)}.`,
    incomeTaxLine(report, "Income Tax Calculation"),
    bridgeLine(report),
    "This product publishes no balance sheet and no VAT returns: a profit and loss account and a self assessment return are the whole output.",
  ];
}

function taxiIndicators(report) {
  const turnover = requireValue(report, "Profit & Loss Account", "Turnover (Total Fares)");
  const gross = requireValue(report, "Profit & Loss Account", "Gross Profit");
  const net = requireValue(report, "Profit & Loss Account", "Net Profit");
  const allowances = value(report, "Profit & Loss Account", "Capital Allowances");
  const mileage = value(report, "Profit & Loss Account", "Mileage Allowance");
  const running = value(report, "Purchase Analysis", "Vehicle running costs for the year");
  const capitalised = value(report, "Purchase Analysis", "Vehicle purchases capitalised");
  const taxable = requireValue(report, "Self Assessment (SA103S)", "Net profit for tax calc");

  return [
    runLine(report),
    `Turnover ${amount(turnover)}, gross profit ${amount(gross)}, net profit ${amount(net)}.`,
    `Vehicle costs: running costs ${amount(running)} charged, mileage allowance ${amount(mileage)}. The workbook takes one of the two and leaves the other at zero.`,
    `Capital allowances ${amount(allowances)} claimed against ${amount(capitalised)} of vehicle purchases capitalised. Taxable profit ${amount(taxable)}.`,
    incomeTaxLine(report, "Draft Tax Calculation"),
    bridgeLine(report),
    "This product publishes no balance sheet and no VAT returns: a profit and loss account and a self assessment return are the whole output.",
  ];
}

const BUILDERS = { ltd: ltdIndicators, se: seIndicators, bst: bstIndicators, taxi: taxiIndicators };

// A dozen or so lines the judge reviews in place of the report. vatRegistered comes from the
// scenario, not the report, so the registration and the VAT boxes are stated side by side.
export function buildIndicators(product, markdown, { vatRegistered = null } = {}) {
  const build = BUILDERS[product];
  if (!build) throw new Error(`No indicators defined for ${product}`);
  return build(parseReport(markdown), vatRegistered).filter(Boolean);
}
