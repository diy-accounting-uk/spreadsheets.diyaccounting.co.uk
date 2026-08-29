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
  // The box values live in the compliance-check rows, whose names are anchored by
  // the product tests; the VAT Returns section's own layout is presentation and moves.
  const boxCheck = (quarter, box, cell) => {
    const pattern = new RegExp(`^VAT Q${quarter}: box ${box}(/3)?\\s*\\(${cell}\\)`);
    const row = report.checks.find((entry) => pattern.test(entry.check));
    if (!row) throw new Error(`no compliance check row for VAT Q${quarter} box ${box} (${cell})`);
    return toNumber(row.actual);
  };
  const boxes = [1, 2, 3, 4].map((quarter) => ({
    quarter,
    output: boxCheck(quarter, 1, "G9"),
    input: boxCheck(quarter, 4, "G15"),
  }));
  const nonZero = boxes.filter((box) => box.output || box.input).length;
  const due = value(report, "VAT Returns", "VAT due for the year");
  const registration =
    vatRegistered === true ? "registered for VAT" : vatRegistered === false ? "not registered for VAT" : "of unstated VAT registration";
  const lines = [
    `VAT: the scenario is ${registration}.`,
    `Box 1 output VAT by quarter ${boxes.map((box) => amount(box.output)).join(" / ")};`,
    `box 4 input VAT ${boxes.map((box) => amount(box.input)).join(" / ")};`,
    `VAT due for the year ${amount(due)}.`,
    `${nonZero} of the four quarters carry a non-zero box.`,
  ];
  // The return cycle need not align with the accounting year; when the report names a
  // month no shown return covers, carry that with the boxes so the annual line's excess
  // over the quarters reads as period coverage, not a discrepancy.
  const uncovered = [...section.keys()].find((label) => label.startsWith("No return above covers"));
  if (uncovered && toNumber(due) !== 0) {
    const outputOnIt = value(report, "VAT Returns", "Output VAT on it");
    lines.push(
      `The quarters shown sum below the annual line because ${uncovered.charAt(0).toLowerCase()}${uncovered.slice(1, uncovered.indexOf("."))}` +
        ` (output VAT on it ${amount(outputOnIt)}); that month sat on the previous return of the same cycle.`,
    );
  }
  // The package ships a fifth return form as well as the four quarters above. It is the
  // spare a stagger that runs behind the accounting year needs, and it sits on the last
  // period the book carries, which the fourth return already reaches. Without that here
  // the fifth form's boxes read as a quarter that went missing from the four.
  const spare = [...section.keys()].find((label) => label.includes("both cover the period"));
  if (spare) lines.push(`The fifth return form is a spare: ${spare.slice(0, spare.indexOf(".") + 1)}`);
  return lines.join(" ");
}

const SA103S = "Self Assessment (SA103S)";

// The SA103S splits capital allowances across several boxes. Naming the first one alone
// leaves the drop from net profit to taxable profit looking wider than the figure beside it,
// so every component is itemised and the total is stated with them.
function allowances(report, { deductions, additions }) {
  const claimed = deductions.map((label) => ({ label, figure: requireValue(report, SA103S, label) }));
  return {
    claimed,
    total: claimed.reduce((sum, part) => sum + part.figure, 0),
    added: additions.map((label) => `${label.toLowerCase()} ${amount(requireValue(report, SA103S, label))}`),
  };
}

function selfAssessmentLine(report, split, { from, fromLabel, to, toLabel }) {
  const opening = requireValue(report, SA103S, from);
  const closing = requireValue(report, SA103S, to);
  return [
    `Self assessment: ${fromLabel} ${amount(opening)},`,
    `less ${amount(split.total)} of capital allowances (${split.claimed.map((part) => `${part.label} ${amount(part.figure)}`).join(", ")}),`,
    `plus ${split.added.join(" and ")},`,
    `gives a ${toLabel} of ${amount(closing)}.`,
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
  const split = allowances(report, {
    deductions: ["Capital allowances", "AIA / WDA claimed", "Other capital allowances (box 24)"],
    additions: ["Balancing charges (box 25)", "Other tax adjustments"],
  });
  const grants = requireValue(report, SA103S, "Grants as other business income (box 29)");
  const forTax = requireValue(report, SA103S, "Net profit for tax calc");

  return [
    runLine(report),
    `Turnover ${amount(turnover)}, gross profit ${amount(gross)}, profit before tax ${amount(pbt)}.`,
    selfAssessmentLine(report, split, {
      from: "Net profit/loss",
      fromLabel: "net profit",
      to: "Taxable profit",
      toLabel: "taxable profit",
    }),
    `Grants as other business income ${amount(grants)} take that to a net profit for the tax calculation of ${amount(forTax)}, which is the profit the income tax computation charges.`,
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
  const capitalised = value(report, "Purchase Analysis", "Purchases capitalised as fixed assets");
  const split = allowances(report, {
    deductions: ["Capital allowances", "AIA / WDA claimed", "WDA + Capital Allowance claimed"],
    additions: ["Balancing Charge", "Other tax adjustments"],
  });

  return [
    runLine(report),
    `Turnover ${amount(turnover)}, gross profit ${amount(gross)}, net profit ${amount(net)}.`,
    `Capital allowances of ${amount(split.total)} claimed against ${amount(capitalised)} of purchases capitalised as fixed assets.`,
    selfAssessmentLine(report, split, {
      from: "Net profit/loss",
      fromLabel: "net profit",
      to: "Taxable profit",
      toLabel: "taxable profit",
    }),
    incomeTaxLine(report, "Income Tax Calculation"),
    bridgeLine(report),
    "This product publishes no balance sheet and no VAT returns: a profit and loss account and a self assessment return are the whole output.",
  ];
}

function taxiIndicators(report) {
  const turnover = requireValue(report, "Profit & Loss Account", "Turnover (Total Fares)");
  const gross = requireValue(report, "Profit & Loss Account", "Gross Profit");
  const net = requireValue(report, "Profit & Loss Account", "Net Profit");
  const mileage = value(report, "Profit & Loss Account", "Mileage Allowance");
  const running = value(report, "Purchase Analysis", "Vehicle running costs for the year");
  const capitalised = value(report, "Purchase Analysis", "Vehicle purchases capitalised");
  const split = allowances(report, {
    deductions: ["Annual investment allowance (box 22)", "Small-balance allowance (box 23)", "Other capital allowances (box 24)"],
    additions: ["Balancing charges (box 25)", "Goods and services for own use (box 26)"],
  });

  return [
    runLine(report),
    `Turnover ${amount(turnover)}, gross profit ${amount(gross)}, net profit ${amount(net)}.`,
    `Vehicle costs: running costs ${amount(running)} charged, mileage allowance ${amount(mileage)}. The workbook takes one of the two and leaves the other at zero.`,
    `Capital allowances of ${amount(split.total)} claimed against ${amount(capitalised)} of vehicle purchases capitalised.`,
    selfAssessmentLine(report, split, {
      from: "Net profit/loss",
      fromLabel: "net profit",
      to: "Net business profit (box 27)",
      toLabel: "net business profit",
    }),
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
