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

// A product may print the return's box number after a row's label, as the Taxi
// sheet does ("Net profit/loss (box 20)"), so a label matches with or without
// that suffix.
const BOX_SUFFIX = /\s*\(box [^)]*\)$/;

export function value(report, section, label) {
  const rows = report.sections.get(section);
  if (!rows) return null;
  if (rows.has(label)) return toNumber(rows.get(label));
  for (const [key, cell] of rows) {
    if (key.replace(BOX_SUFFIX, "") === label) return toNumber(cell);
  }
  return null;
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

function count(number) {
  return number === null ? "not reported" : number.toLocaleString("en-GB");
}

// What the vehicle's cost came to and how it was claimed. Both packages price
// the business miles the entries carry: the Taxi P&L charges either that claim
// or the running costs, whichever is larger, while the Basic Sole Trader P&L
// adds the claim to Motor Expenses. Saying which happened stops a nil running
// cost, or a Motor Expenses line larger than the motoring bought, reading as a
// figure gone missing.
function mileageLine(report, { claimed }) {
  const miles = value(report, "Purchase Analysis", "Business miles for the year");
  if (!miles) return "No business miles were recorded, so no mileage claim arises.";
  return `Business miles for the year ${count(miles)}, claimed at the approved rates as ${amount(claimed)}.`;
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
  // quarter after the fourth, for a stagger that runs behind the accounting year, so every
  // period it declares falls past the year end. Without that here the fifth form's boxes
  // read as a quarter that went missing from the four.
  const beyond = [...section.keys()].find((label) => label.includes("outside the accounting year"));
  if (beyond) lines.push(`The fifth return form runs on past the year end: ${beyond.slice(0, beyond.indexOf(".") + 1)}`);
  return lines.join(" ");
}

const SA103S = "Self Assessment (SA103S)";
const SA103F = "Self Assessment (SA103F)";

// The full return carries a disallowable-expenses column the short return has
// not, so its total expenses and net profit differ from the short return's by
// exactly that column, and its capital allowances split across more boxes to
// the same total. Without this the judge reads the two returns' mismatched
// figures as an error rather than the form difference it is.
//
// A report predating the SA103F checks carries no such section; the line is
// left out of that digest rather than failing it, the same way vatLine treats
// a report with no VAT Returns section.
function sa103fLine(report) {
  if (!report.sections.has(SA103F)) return null;
  const shortExpenses = requireValue(report, SA103S, "Total expenses");
  const shortNetProfit = requireValue(report, SA103S, "Net profit/loss");
  const disallowable = requireValue(report, SA103F, "Total disallowable expenses (box 46)");
  const fullExpenses = requireValue(report, SA103F, "Total expenses (box 31)");
  const fullNetProfit = requireValue(report, SA103F, "Net profit (box 47)");
  const capitalAllowances = requireValue(report, SA103F, "Total capital allowances (box 57)");
  return [
    "Self Assessment (SA103F): the full return adds a disallowable-expenses column the short return has not.",
    `Total expenses (box 31) ${amount(fullExpenses)} = the short return's total expenses ${amount(shortExpenses)} plus total disallowable expenses (box 46) ${amount(disallowable)};`,
    `net profit (box 47) ${amount(fullNetProfit)} = the short return's net profit ${amount(shortNetProfit)} less that same ${amount(disallowable)};`,
    `total capital allowances (box 57) ${amount(capitalAllowances)} sums the same allowances split across more boxes than the short return uses.`,
  ].join(" ");
}

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
  const relief = value(report, "CT600 as filed", "Box 64: marginal rate relief");
  const netOfRelief = value(report, "CT600 as filed", "Box 65: corporation tax net of marginal rate relief");
  const nbv = value(report, "Fixed Asset Note", "Net book value");
  const depreciation = value(report, "Fixed Asset Note", "Charge for the year");
  const stock = value(report, "Published Balance Sheet", "Stock at cost");
  const reportTurnover = value(report, "Directors' Report", "Sales turnover in the year");
  const reportPriorTurnover = value(report, "Directors' Report", "Sales turnover last year");
  const reportMargin = value(report, "Directors' Report", "Trading margin");
  const reportDividend = value(report, "Directors' Report", "Dividend declared");
  const reportShares = value(report, "Directors' Report", "Ordinary shares issued");
  const openingCash = value(report, "Opening Balance Sheet", "Cash and Bank Balances");
  const closingCash = value(report, "Published Balance Sheet", "Cash at bank and in hand");
  const taxOwed =
    (value(report, "Published Balance Sheet", "Corporation Tax") || 0) +
    (value(report, "Published Balance Sheet", "Taxation and Social Security") || 0);
  // The dividend cycle: the board declares, the bank pays and the creditor
  // carries whatever is left. The trial balance holds a creditor as a
  // negative balance, so both ends are negated to read as amounts owed.
  const dividendsDeclared = value(report, "Trial Balance", "Final: Dividends declared");
  const dividendsOwedAtStart = -(value(report, "Trial Balance", "Opening: Dividends Creditor") || 0);
  const dividendsOwedAtEnd = -(value(report, "Trial Balance", "Final: Dividends Creditor") || 0);
  const dividendsPaid = dividendsOwedAtStart + (dividendsDeclared || 0) - dividendsOwedAtEnd;
  const openingStock = value(report, "Stock", "Opening Stock");
  const calculatedStock = value(report, "Stock", "Closing Stock (calculated)");
  const countedStock = value(report, "Stock", "Closing Stock (physical count)");
  const lossAdjustment = value(report, "Stock", "Stock loss adjustment");

  return [
    runLine(report),
    `Turnover ${amount(turnover)}, gross profit ${amount(gross)}, profit before tax ${amount(pbt)} (published profit and loss account).`,
    `Balance sheet: net assets ${amount(netAssets)} against shareholders' funds ${amount(funds)}, difference ${amount(netAssets - funds)}.`,
    `Trial balance audit accuracy (cell EJ91): ${amount(audit)}.`,
    `Fixed assets: net book value ${amount(nbv)}, depreciation charged for the year ${amount(depreciation)}. Stock at the year end ${amount(stock)}.`,
    `Corporation tax: capital allowances ${amount(allowances)} take the profit chargeable to ${amount(chargeable)}, charge for the year ${amount(charge)}. The return files ${amount(filed)} in box 63 before marginal relief of ${amount(relief)}, leaving ${amount(netOfRelief)} in box 65.`,
    `Directors' report: turnover ${amount(reportTurnover)} against ${amount(reportPriorTurnover)} last year, trading margin ${amount(reportMargin)}, dividend declared ${amount(reportDividend)} on ${amount(reportShares)} ordinary shares issued.`,
    `Cash at bank and in hand ${amount(closingCash)} at the year end against ${amount(openingCash)} at the start: the year made ${amount(pbt)} before tax, declared ${amount(dividendsDeclared)} of dividends and paid ${amount(dividendsPaid)} of them out of the bank, and still owes ${amount(dividendsOwedAtEnd)} to the members and ${amount(taxOwed)} of tax.`,
    `Stock: ${amount(openingStock)} at the start, ${amount(calculatedStock)} calculated at the year end against ${amount(countedStock)} counted, a loss adjustment of ${amount(lossAdjustment)}.`,
    vatLine(report, vatRegistered),
    bridgeLine(report),
  ];
}

function seIndicators(report, vatRegistered) {
  const turnover = requireValue(report, "Profit & Loss Account", "Sales Turnover");
  const gross = requireValue(report, "Profit & Loss Account", "Gross Profit");
  const pbt = requireValue(report, "Profit & Loss Account", "Profit Before Tax");
  const split = allowances(report, {
    deductions: ["Capital allowances", "AIA / WDA claimed", "Other capital allowances"],
    additions: ["Balancing charges", "Other tax adjustments"],
  });
  const grants = requireValue(report, SA103S, "Grants as other business income");
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
    sa103fLine(report),
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
    mileageLine(report, { claimed: value(report, "Purchase Analysis", "Mileage claimed for the year") }),
    selfAssessmentLine(report, split, {
      from: "Net profit/loss",
      fromLabel: "net profit",
      to: "Taxable profit",
      toLabel: "taxable profit",
    }),
    incomeTaxLine(report, "Income Tax Calculation"),
    bridgeLine(report),
    debtorsCreditorsLine(report),
    "This product publishes no balance sheet and no VAT returns: a profit and loss account and a self assessment return are the whole output.",
  ];
}

// The Debtors & Creditors sheet is a monthly outstanding table over the sales
// and purchases journals, not a list of named balances, and a row stays
// outstanding until its payment column says otherwise. A journal that records
// no receipts at all therefore shows every sale still owing, which reads as an
// implausible debtor figure without this line beside it.
function debtorsCreditorsLine(report) {
  const owedByCustomers = value(report, "Debtors & Creditors", "Amount owed by customers");
  const owedToSuppliers = value(report, "Debtors & Creditors", "Amount owed to suppliers");
  if (owedByCustomers === null && owedToSuppliers === null) return null;
  return (
    `Debtors and creditors: ${amount(owedByCustomers)} owed by customers and ${amount(owedToSuppliers)} owed to suppliers at the year end. ` +
    "This sheet names nobody -- it opens with what was owed at the start of the year and adds each month's sales with no receipt recorded " +
    "and each month's purchases with no payment recorded, so a journal that records no settlements shows the whole year still outstanding."
  );
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

  const vehicleCosts = mileage
    ? `Vehicle costs: the year's mileage claim of ${amount(mileage)} beats the ${amount(running)} the vehicle cost to run, so the workbook charges the claim and leaves the running costs and the capital allowances at zero.`
    : `Vehicle costs: running costs ${amount(running)} charged, mileage allowance ${amount(mileage)}. The workbook takes one of the two and leaves the other at zero.`;

  return [
    runLine(report),
    `Turnover ${amount(turnover)}, gross profit ${amount(gross)}, net profit ${amount(net)}.`,
    vehicleCosts,
    mileageLine(report, { claimed: value(report, "Purchase Analysis", "Mileage claimed for the year") }),
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
