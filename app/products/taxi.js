// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi.js — Taxi Driver product definition.
// Owns column mappings, cell references, compliance checks, date-lookup logic.
// Calls shared tools from app/lib/.

import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { generateTaxYearWeeks, groupWeeksIntoMonths, toExcelSerial as dateToSerial } from "../lib/generator.js";
import { parseDate, MONTH_SHEETS, extractTaxYearStart, fixedAssetAdditions } from "../lib/scenario-loader.js";
import { buildProfitBridge, PROFIT_BRIDGE_CHECK } from "../lib/report-generator.js";

export const PRODUCT = {
  id: "taxi",
  dir: "taxi",
  name: "Taxi Driver",
  taxRegime: "se",
  prefix: "GB Accounts Taxi Driver",
};

// ── Date-to-row mapping for pre-filled Sales sheets ────────────────────────

function buildDateRowMap(startYear) {
  const weeks = generateTaxYearWeeks(startYear);
  const monthly = groupWeeksIntoMonths(weeks);

  const map = {};
  for (const [monthKey, monthWeeks] of Object.entries(monthly)) {
    if (!monthWeeks.length) continue;
    const dateMap = {};
    let row = 5;

    for (let w = 0; w < monthWeeks.length; w++) {
      for (const date of monthWeeks[w]) {
        dateMap[dateToSerial(date)] = row;
        row++;
      }
      row += 3; // rental + other income + subtotal
      if (w < monthWeeks.length - 1) row += 1; // blank separator
    }

    map[monthKey] = dateMap;
  }

  return map;
}

function findRowInDateMap(dateRowMap, serial) {
  for (const [monthKey, dateMap] of Object.entries(dateRowMap)) {
    if (dateMap[serial] !== undefined) {
      return { monthKey, row: dateMap[serial] };
    }
  }
  return null;
}

// ── Scenario cell writes ───────────────────────────────────────────────────

export function cellWrites(scenario, targetStartYear = null) {
  const writes = {};

  // Business Details
  if (scenario.business || scenario.metadata) {
    writes["Business Details"] = {};
    const bd = writes["Business Details"];
    const biz = scenario.business || {};
    bd.C5 = biz.name || scenario.metadata?.name || "";
    if (biz.description) bd.C7 = biz.description;
    if (biz.address) bd.C8 = biz.address;
    if (biz.town) bd.C10 = biz.town;
    if (biz.postcode) bd.C12 = biz.postcode;
  }

  if (scenario.sales) {
    const scenarioStartYear = extractTaxYearStart(scenario);
    const startYear = targetStartYear || scenarioStartYear;
    const dateRowMap = buildDateRowMap(startYear);

    const scenarioEpoch = Date.UTC(scenarioStartYear, 3, 6);
    const targetEpoch = Date.UTC(startYear, 3, 6);
    const dayOffsetMs = targetEpoch - scenarioEpoch;

    for (const [, transactions] of Object.entries(scenario.sales)) {
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        const targetDate = new Date(d.getTime() + dayOffsetMs);
        const serial = toExcelSerial(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, targetDate.getUTCDate());

        const match = findRowInDateMap(dateRowMap, serial);
        if (!match)
          throw new Error(
            `Date ${targetDate.toISOString().split("T")[0]} (from ${d.toISOString().split("T")[0]}) not found in any Sales sheet row map`,
          );

        const sheetName = `Sales${MONTH_SHEETS[match.monthKey]}`;
        if (!writes[sheetName]) writes[sheetName] = {};
        writes[sheetName][`E${match.row}`] = tx.amount;
        if (tx.other_income) writes[sheetName][`F${match.row}`] = tx.other_income;
      }
    }
  }

  if (scenario.purchases) {
    for (const [monthKey, transactions] of Object.entries(scenario.purchases)) {
      const sheetName = `Purchases${MONTH_SHEETS[monthKey]}`;
      if (!writes[sheetName]) writes[sheetName] = {};
      const sheet = writes[sheetName];

      let row = 5;
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        sheet[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.supplier) sheet[`B${row}`] = tx.supplier;
        sheet[`D${row}`] = tx.code;
        sheet[`F${row}`] = tx.amount;
        row++;
      }
    }
  }

  // Fixed asset additions go on the "Fixed Assets" sheet's "Vehicles under
  // £12,000 bought after" block (rows 47-51, 5 slots). A Purchases entry
  // coded "f" only reaches the analysis column S, which no P&L formula
  // reads -- it does not register the asset on the capital-allowance
  // schedule, so this write is a separate, deliberate step modelling the
  // same real-world double entry (cash purchase in Purchases, asset
  // registered in the Fixed Assets book).
  const assetAdditions = fixedAssetAdditions(scenario, "f");
  if (assetAdditions.length > 0) {
    if (!writes["Fixed Assets"]) writes["Fixed Assets"] = {};
    const fa = writes["Fixed Assets"];
    let row = 47;
    for (const asset of assetAdditions) {
      const d = parseDate(asset.date);
      fa[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (asset.description) fa[`B${row}`] = asset.description;
      if (asset.reference) fa[`C${row}`] = asset.reference;
      fa[`D${row}`] = asset.cost;
      row++;
    }
  }

  return writes;
}

// ── Standard reads for reconciliation ──────────────────────────────────────

export const TAX_SHEET = "Draft Tax calculation";
export const FORECAST_SHEET = "Wages Forecast";

// prettier-ignore
export const CELL_MAP = [
  // ── Business Details ──
  ["Business Details", "C5",  "Business Name",       "entityInformation.organizationIdentifier",  "Business Details", 0],
  ["Business Details", "C7",  "Description",         "entityInformation.organizationDescription", "Business Details", 0],
  ["Business Details", "C8",  "Address",             "gl-bus:organizationAddress",                "Business Details", 0],
  ["Business Details", "C10", "Town",                "gl-bus:organizationAddress (town)",         "Business Details", 0],
  ["Business Details", "C12", "Postcode",            "gl-bus:organizationAddress (postcode)",     "Business Details", 0],
  ["Business Details", "O29", "UTR",                 "gl-taf:taxRegistrationNumber",              "Business Details", 0],
  // ── Profit & Loss Account (column B) ──
  ["Profit & Loss Acc", "B5",  "Turnover (Total Fares)",           "gl-cor:amount (salesTurnover)",     "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "B6",  "Fuel",                             "accounts.purchases.5100 (fuel)",    "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B7",  "Car Hire / Rental",                "accounts.purchases.5200 (carHire)", "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B8",  "Repairs & Servicing",              "accounts.purchases.5300 (repairs)", "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B9",  "Road Tax & Insurance",             "accounts.purchases.5400 (taxIns)",  "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B10", "Capital Allowances",               "tax.capitalAllowances",             "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B11", "Mileage Allowance",                "tax.mileage (allowance)",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B12", "Cost of Sales (vehicle costs)",    "gl-cor:amount (costOfSales)",       "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "B13", "**Gross Profit**",                 "gl-cor:amount (grossProfit)",       "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "B14", "Employee Costs",                   "accounts.purchases.5500",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B15", "Premises Costs",                   "accounts.purchases.5600",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B16", "General Admin",                    "accounts.purchases.5700",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B17", "Advertising",                      "accounts.purchases.5800",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B18", "Legal & Professional",             "accounts.purchases.5900",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B19", "Interest & Bank Charges",          "accounts.purchases.6000",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B20", "Bank Charges",                     "accounts.purchases.6100",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B21", "Other Expenses",                   "accounts.purchases.6200",           "Profit & Loss Account", 1],
  ["Profit & Loss Acc", "B22", "Total General Expenses",           "gl-cor:amount (totalGeneral)",      "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "B23", "**Net Profit**",                   "gl-cor:amount (netProfit)",         "Profit & Loss Account", 0],
  ["Profit & Loss Acc", "B24", "Any Other Business Income",        "gl-cor:amount (otherIncome)",       "Profit & Loss Account", 1],
  // ── VitalTax — quarterly re-sum of P&L monthly columns C:N into its own
  // C:F quarter columns and G annual column (verified against the template:
  // C5=SUM(P&L!C5:E5) through F5=SUM(P&L!L5:N5), G5=SUM(C5:F5); the same
  // pattern feeds row 29's re-sum of the P&L's Cost of Sales and Total
  // Expenses rows) ──
  ["VitalTax", "C5",  "Q1 Turnover",                         "gl-cor:amount (vitalTax.q1Turnover)",     "Quarterly Summary", 1],
  ["VitalTax", "D5",  "Q2 Turnover",                         "gl-cor:amount (vitalTax.q2Turnover)",     "Quarterly Summary", 1],
  ["VitalTax", "E5",  "Q3 Turnover",                         "gl-cor:amount (vitalTax.q3Turnover)",     "Quarterly Summary", 1],
  ["VitalTax", "F5",  "Q4 Turnover",                         "gl-cor:amount (vitalTax.q4Turnover)",     "Quarterly Summary", 1],
  ["VitalTax", "G5",  "**Annual Turnover**",                 "gl-cor:amount (vitalTax.annualTurnover)", "Quarterly Summary", 0],
  ["VitalTax", "C29", "Q1 Total Allowable Expenses",         "gl-cor:amount (vitalTax.q1Expenses)",     "Quarterly Summary", 1],
  ["VitalTax", "D29", "Q2 Total Allowable Expenses",         "gl-cor:amount (vitalTax.q2Expenses)",     "Quarterly Summary", 1],
  ["VitalTax", "E29", "Q3 Total Allowable Expenses",         "gl-cor:amount (vitalTax.q3Expenses)",     "Quarterly Summary", 1],
  ["VitalTax", "F29", "Q4 Total Allowable Expenses",         "gl-cor:amount (vitalTax.q4Expenses)",     "Quarterly Summary", 1],
  ["VitalTax", "G29", "**Annual Total Allowable Expenses**", "gl-cor:amount (vitalTax.annualExpenses)", "Quarterly Summary", 0],
  // ── SE Short (SA103S) — formula cells only ──
  ["SE Short", "D38",  "Turnover",                               "gl-cor:amount (sa103s.turnover)",           "Self Assessment (SA103S)", 0],
  ["SE Short", "O38",  "Other business income (box 9)",          "gl-cor:amount (sa103s.otherIncome)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "D71",  "**Net profit/loss**",                    "gl-cor:amount (sa103s.netProfit)",          "Self Assessment (SA103S)", 0],
  ["SE Short", "O71",  "Net loss (box 21)",                      "gl-cor:amount (sa103s.netLoss)",            "Self Assessment (SA103S)", 1],
  ["SE Short", "D80",  "Annual investment allowance (box 22)",   "tax.capitalAllowances.aia (sa103s)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "D85",  "Small-balance allowance (box 23)",       "tax.capitalAllowances.smallPool (sa103s)",  "Self Assessment (SA103S)", 1],
  ["SE Short", "O80",  "Other capital allowances (box 24)",      "tax.capitalAllowances.wda (sa103s)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "O85",  "Balancing charges (box 25)",             "tax.capitalAllowances.balancingCharge (sa103s)", "Self Assessment (SA103S)", 1],
  ["SE Short", "D94",  "Goods and services for own use (box 26)","gl-cor:amount (sa103s.ownUse)",             "Self Assessment (SA103S)", 1],
  ["SE Short", "D99",  "**Net business profit (box 27)**",       "gl-cor:amount (sa103s.taxableProfit)",      "Self Assessment (SA103S)", 0],
  ["SE Short", "O94",  "Loss brought forward (box 28)",          "gl-cor:amount (sa103s.lossBroughtForward)", "Self Assessment (SA103S)", 1],
  ["SE Short", "O99",  "Other business income (box 29)",         "gl-cor:amount (sa103s.otherBusinessIncome)","Self Assessment (SA103S)", 1],
  ["SE Short", "D106", "**Net profit for tax calc**",            "gl-cor:amount (sa103s.profitForTax)",       "Self Assessment (SA103S)", 0],
  // ── Draft Tax Calculation ──
  [TAX_SHEET, "E5",  "Profit from Self Employment",  "gl-cor:amount (profitSE)",             "Draft Tax Calculation", 0],
  [TAX_SHEET, "E6",  "Less: Personal Allowance",     "tax.incomeTax.personalAllowance",      "Draft Tax Calculation", 1],
  [TAX_SHEET, "E7",  "Taxable Income",               "gl-cor:amount (taxableIncome)",        "Draft Tax Calculation", 0],
  [TAX_SHEET, "D8",  "Basic rate the sheet applies", "tax.incomeTax.basicRate (applied)",    "Draft Tax Calculation", 1],
  [TAX_SHEET, "C9",  "Basic band ceiling the sheet applies", "tax.incomeTax.basicBandEnd (applied)", "Draft Tax Calculation", 1],
  [TAX_SHEET, "D9",  "Higher rate the sheet applies", "tax.incomeTax.higherRate (applied)",  "Draft Tax Calculation", 1],
  [TAX_SHEET, "C10", "Additional rate threshold the sheet applies", "tax.incomeTax.higherBandEnd (applied)", "Draft Tax Calculation", 1],
  [TAX_SHEET, "D10", "Additional rate the sheet applies", "tax.incomeTax.additionalRate (applied)", "Draft Tax Calculation", 1],
  [TAX_SHEET, "E8",  "Tax at Basic Rate",            "tax.incomeTax.basicRate",              "Draft Tax Calculation", 1],
  [TAX_SHEET, "E9",  "Tax at Higher Rate",           "tax.incomeTax.higherRate",             "Draft Tax Calculation", 1],
  [TAX_SHEET, "E10", "Tax at Additional Rate",       "tax.incomeTax.additionalRate",         "Draft Tax Calculation", 1],
  [TAX_SHEET, "E11", "**Total Income Tax**",         "tax.incomeTax (total)",                "Draft Tax Calculation", 0],
  [TAX_SHEET, "E14", "NI Class 4 (lower band)",      "tax.nationalInsurance.class4MainRate", "Draft Tax Calculation", 1],
  [TAX_SHEET, "E15", "NI Class 4 (upper band)",      "tax.nationalInsurance.class4UpperRate","Draft Tax Calculation", 1],
  [TAX_SHEET, "E17", "**Total Tax + NI**",           "gl-cor:taxAmount (totalTaxNI)",        "Draft Tax Calculation", 0],
  // ── Wages Forecast — the projected year the customer plans against.
  // The actual half (rows 5 to 15) pulls the P&L's monthly columns; the
  // forecast half (rows 19 to 30) repeats each month that traded and spreads
  // the year's total across the months that did not, counting the trading
  // months in C19. The tax block below it charges the projected profit. ──
  [FORECAST_SHEET, "C19", "Months of actual trade",     "gl-cor:amount (forecast.monthsTraded)",  "Wages Forecast", 1],
  [FORECAST_SHEET, "C20", "Forecast Sales Turnover",    "gl-cor:amount (forecast.turnover)",      "Wages Forecast", 1],
  [FORECAST_SHEET, "C22", "Forecast Investment Grants", "gl-cor:amount (forecast.otherIncome)",   "Wages Forecast", 1],
  [FORECAST_SHEET, "C24", "Forecast Cost of Sales",     "gl-cor:amount (forecast.costOfSales)",   "Wages Forecast", 1],
  [FORECAST_SHEET, "C28", "Forecast General Expenses",  "gl-cor:amount (forecast.expenses)",      "Wages Forecast", 1],
  [FORECAST_SHEET, "C30", "**Forecast Profit before Tax**", "gl-cor:amount (forecast.profit)",    "Wages Forecast", 0],
  [FORECAST_SHEET, "C34", "Profit before Tax",          "gl-cor:amount (forecast.taxableProfit)", "Wages Forecast", 1],
  [FORECAST_SHEET, "C35", "Personal Allowance",         "tax.incomeTax.personalAllowance",        "Wages Forecast", 1],
  [FORECAST_SHEET, "C36", "Profit after Allowance",     "gl-cor:amount (forecast.taxableIncome)", "Wages Forecast", 1],
  [FORECAST_SHEET, "C37", "Tax at standard rate",       "tax.incomeTax.basicRate",                "Wages Forecast", 1],
  [FORECAST_SHEET, "C38", "Tax at higher rate",         "tax.incomeTax.higherRate",               "Wages Forecast", 1],
  [FORECAST_SHEET, "C39", "Tax at additional rate",     "tax.incomeTax.additionalRate",           "Wages Forecast", 1],
  [FORECAST_SHEET, "C40", "National Insurance",         "tax.nationalInsurance.class4",           "Wages Forecast", 1],
  [FORECAST_SHEET, "C41", "**Forecast Tax & NI Liability**", "gl-cor:taxAmount (forecast.totalTaxNI)", "Wages Forecast", 0],
  // ── Purchase analysis (year-to-date columns on the last month's sheet) ──
  ["PurchasesMar", "I2", "Vehicle running costs for the year",  "accounts.purchases (vehicleRunningCosts)",  "Purchase Analysis", 0],
  ["PurchasesMar", "T1", "Vehicle purchases capitalised",       "accounts.assets.fixedAssets (purchased)",   "Purchase Analysis", 0],
  // ── Fixed Assets schedule ──
  ["Fixed Assets", "D47", "New Asset Cost (Vehicle under £12,000)", "accounts.assets.fixedAssets (cost)",              "Fixed Assets", 1],
  ["Fixed Assets", "I1",  "Total Annual Investment Allowance",      "tax.capitalAllowances.aia (schedule)",            "Fixed Assets", 0],
  ["Fixed Assets", "J1",  "Total Writing Down Allowance",           "tax.capitalAllowances.wda (schedule)",            "Fixed Assets", 1],
  ["Fixed Assets", "P1",  "Total Capital Allowance on Disposal",    "tax.capitalAllowances.disposals (schedule)",      "Fixed Assets", 1],
  ["Fixed Assets", "Q1",  "Total Balancing Charge",                 "tax.capitalAllowances.balancingCharge (schedule)", "Fixed Assets", 1],
  // ── Admin (generator-injected tax data) ──
  ["Admin", "N4",  "Personal Allowance",                 "tax.incomeTax.personalAllowance",         "Admin (Generator Injected)", 0],
  ["Admin", "N5",  "Personal Allowance Taper Threshold",  "tax.incomeTax.personalAllowanceTaperThreshold", "Admin (Generator Injected)", 0],
  ["Admin", "N6",  "Basic Rate",                          "tax.incomeTax.basicRate",                 "Admin (Generator Injected)", 0],
  ["Admin", "N7",  "Higher Rate",                         "tax.incomeTax.higherRate",                "Admin (Generator Injected)", 0],
  ["Admin", "N8",  "Additional Rate",                     "tax.incomeTax.additionalRate",            "Admin (Generator Injected)", 0],
  ["Admin", "M11", "Basic Band End",                      "tax.incomeTax.basicBandEnd",              "Admin (Generator Injected)", 0],
  ["Admin", "N12", "Higher Band Start",                   "tax.incomeTax.higherBandStart",           "Admin (Generator Injected)", 0],
  ["Admin", "N13", "Higher Band End",                     "tax.incomeTax.higherBandEnd",             "Admin (Generator Injected)", 0],
  ["Admin", "L16", "NI Class 2 Weekly Rate",              "tax.nationalInsurance.class2WeeklyRate",  "Admin (Generator Injected)", 0],
  ["Admin", "L20", "NI Class 4 Lower Rate",                "tax.nationalInsurance.class4LowerRate",   "Admin (Generator Injected)", 0],
  ["Admin", "N20", "NI Class 4 Lower Limit",               "tax.nationalInsurance.class4LowerLimit",  "Admin (Generator Injected)", 0],
  ["Admin", "L23", "NI Class 4 Upper Rate",                "tax.nationalInsurance.class4UpperRate",   "Admin (Generator Injected)", 0],
  ["Admin", "N23", "NI Class 4 Upper Limit",               "tax.nationalInsurance.class4UpperLimit",  "Admin (Generator Injected)", 0],
  ["Admin", "G4",  "Annual Investment Allowance Rate",     "tax.capitalAllowances.aiaRate",           "Admin (Generator Injected)", 0],
  ["Admin", "G5",  "Writing Down Allowance Rate",          "tax.capitalAllowances.wdaRate",           "Admin (Generator Injected)", 0],
  ["Admin", "E8",  "Motor Vehicle Cost Threshold",         "tax.capitalAllowances.motorVehicleCostThreshold", "Admin (Generator Injected)", 0],
  ["Admin", "G8",  "Motor Vehicle Restriction",            "tax.capitalAllowances.motorVehicleRestriction",   "Admin (Generator Injected)", 0],
  ["Admin", "F21", "Mileage Higher Rate Limit",            "tax.mileage.higherRateLimit",             "Admin (Generator Injected)", 0],
  ["Admin", "G21", "Mileage Higher Rate Pence",             "tax.mileage.higherRatePence",             "Admin (Generator Injected)", 0],
  ["Admin", "F22", "Mileage Lower Rate Start",              "tax.mileage.lowerRateStart",              "Admin (Generator Injected)", 0],
  ["Admin", "G22", "Mileage Lower Rate Pence",              "tax.mileage.lowerRatePence",              "Admin (Generator Injected)", 0],
  ["Admin", "F26", "VAT Registration Threshold",           "tax.vat.registrationThreshold",           "Admin (Generator Injected)", 0],
];

// P&L monthly columns, Apr through Mar (verified against the template:
// 'Profit & Loss Acc'!C2:N2 read the Admin month-end dates in that order).
const MONTH_COLS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
// The three P&L monthly columns VitalTax sums into each of its own quarter
// columns C:F (verified against the template: VitalTax!C5=SUM('Profit &
// Loss Acc'!C5:E5), D5=SUM(F5:H5), E5=SUM(I5:K5), F5=SUM(L5:N5)).
const QUARTER_MONTH_GROUPS = [
  ["C", "D", "E"],
  ["F", "G", "H"],
  ["I", "J", "K"],
  ["L", "M", "N"],
];

export function standardReads() {
  const reads = {};
  for (const [sheet, cell] of CELL_MAP) {
    if (!reads[sheet]) reads[sheet] = [];
    if (!reads[sheet].includes(cell)) reads[sheet].push(cell);
  }

  // VitalTax's quarterly re-sum reads P&L!C5:N5 (Turnover), C12:N12 (Cost
  // of Sales) and C22:N22 (Total General Expenses) a month at a time. Read
  // every monthly cell here so the checks below can verify the re-sum
  // against the P&L's own figures rather than against itself.
  // The Wages Forecast repeats the P&L's own monthly turnover, other income,
  // cost of sales and expenses, so row 24 joins the three VitalTax needs.
  reads["Profit & Loss Acc"] = reads["Profit & Loss Acc"] || [];
  for (const row of [5, 12, 22, 24]) {
    for (const col of MONTH_COLS) {
      const cell = `${col}${row}`;
      if (!reads["Profit & Loss Acc"].includes(cell)) reads["Profit & Loss Acc"].push(cell);
    }
  }

  return reads;
}

export function reportSections(results) {
  const sectionMap = new Map();
  for (const [sheet, cell, label, , section, indent] of CELL_MAP) {
    if (!sectionMap.has(section)) sectionMap.set(section, []);
    const val = results[sheet]?.[cell];
    sectionMap.get(section).push({ label, value: fmt(val), indent });
  }
  return [...sectionMap.entries()].map(([title, rows]) => ({ title, rows }));
}

export function cellLabels() {
  const labels = {};
  for (const [sheet, cell, diyLabel, glMapping] of CELL_MAP) {
    const key = `${sheet}!${cell}`;
    labels[key] = { diyLabel, glMapping };
  }
  return labels;
}

function fmt(v) {
  if (v === null || v === undefined || v === "" || v === " ") return "—";
  if (typeof v === "number") return v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return String(v);
}

const num = (v) => (typeof v === "number" ? v : 0);

// ── Accounting profit to tax profit bridge ─────────────────────────────────

// The P&L charges the year's capital allowances inside cost of sales (B10),
// so its net profit is already after them. The SA103S works the other way:
// box 19 takes them back out of total expenses, box 20 is the profit before
// any allowance, and boxes 22 to 25 then claim the allowances the schedule
// actually gives. The bridge walks that route one box at a time and ends on
// the profit the Draft Tax calculation charges.
export function profitBridge(results) {
  const pl = results["Profit & Loss Acc"];
  const seShort = results["SE Short"];
  const tax = results[TAX_SHEET];
  if (!pl || !seShort || !tax) return null;

  const rows = [
    { label: "Net profit per the profit and loss account", cell: "Profit & Loss Acc!B23", value: num(pl.B23) },
    { label: "Add capital allowances charged in cost of sales", cell: "Profit & Loss Acc!B10", value: num(pl.B10) },
    { label: "Add other business income (box 9)", cell: "SE Short!O38", value: num(seShort.O38) },
    { label: "Less net loss for the year (box 21)", cell: "SE Short!O71", value: -num(seShort.O71) },
    { label: "Less annual investment allowance (box 22)", cell: "SE Short!D80", value: -num(seShort.D80) },
    { label: "Less small-balance allowance (box 23)", cell: "SE Short!D85", value: -num(seShort.D85) },
    { label: "Less other capital allowances (box 24)", cell: "SE Short!O80", value: -num(seShort.O80) },
    { label: "Add balancing charges (box 25)", cell: "SE Short!O85", value: num(seShort.O85) },
    { label: "Add goods and services for own use (box 26)", cell: "SE Short!D94", value: num(seShort.D94) },
    { label: "Add other business income (box 29)", cell: "SE Short!O99", value: num(seShort.O99) },
    { label: "Less loss brought forward (box 28)", cell: "SE Short!O94", value: -num(seShort.O94) },
  ];

  return buildProfitBridge(rows, `${TAX_SHEET}!E5`, num(tax.E5));
}

// ── Compliance checks ──────────────────────────────────────────────────────

export function checkCompliance(results, expected, taxData, calculateExpectedTax) {
  const checks = [];

  function check(name, actual, expectedVal, tolerance = 1) {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal });
  }

  const pl = results["Profit & Loss Acc"];
  if (expected.total_sales !== undefined) check("Total Sales", pl.B5, expected.total_sales);
  if (expected.gross_profit !== undefined) check("Gross Profit", pl.B13, expected.gross_profit);
  if (expected.net_profit !== undefined) check("Net Profit", pl.B23, expected.net_profit);
  if (expected.total_gen_admin !== undefined) check("Gen Admin", pl.B16, expected.total_gen_admin);

  // P&L internal consistency (6a)
  check("P&L: Net = Gross - General Expenses", pl.B23, pl.B13 - (pl.B22 || 0));

  // Whole-book closure: no dedicated audit-accuracy cell exists in this
  // single-file workbook (unlike Ltd's TrialBalance!EJ91), so the P&L's own
  // totals rows are the closest whole-book check available.
  const vehicleCostLines = [pl.B6, pl.B7, pl.B8, pl.B9, pl.B10, pl.B11].reduce((s, v) => s + (v || 0), 0);
  check("P&L: Cost of Sales = vehicle cost lines", pl.B12, vehicleCostLines);
  check("P&L: Gross = Turnover - Cost of Sales", pl.B13, (pl.B5 || 0) - (pl.B12 || 0));

  // The workbook selects actual vehicle running costs (B10, capital
  // allowances) or the mileage allowance (B11), never both -- one formula
  // zeroes when the other applies. A nonzero product means the selection
  // logic has been broken and both are being claimed at once.
  check("P&L: Capital Allowances / Mileage Allowance mutually exclusive", (pl.B10 || 0) * (pl.B11 || 0), 0, 0);

  // Total expenses cross-check (6b)
  const taxiExpenseSum = [pl.B14, pl.B15, pl.B16, pl.B17, pl.B18, pl.B19, pl.B20, pl.B21].reduce((s, v) => s + (v || 0), 0);
  check("P&L: General expense lines sum = Total", pl.B22, taxiExpenseSum);
  if (expected.total_legal !== undefined) check("Legal & Professional", pl.B18, expected.total_legal);

  // VitalTax quarterly re-sum. Every P&L expense row VitalTax's row 29
  // touches (rows 6-11 via row 7's mileage line plus rows 12-19, 21 and 26)
  // covers the vehicle-cost block (rows 6-11, i.e. P&L!row 12) and the
  // general-expense block (rows 14-21, i.e. P&L!row 22) exactly once each,
  // so row 29 should equal P&L's own Cost of Sales plus Total Expenses,
  // quarter by quarter and annually -- the MTD quarterly re-summing path
  // this sheet exists for.
  const vt = results.VitalTax;
  if (vt) {
    const plQuarterSum = (row, months) => months.reduce((s, col) => s + (pl[`${col}${row}`] || 0), 0);
    const vtQuarterCols = ["C", "D", "E", "F"];
    for (let q = 0; q < 4; q++) {
      const vtCol = vtQuarterCols[q];
      const months = QUARTER_MONTH_GROUPS[q];
      check(`VitalTax: Q${q + 1} turnover = P&L Q${q + 1} turnover`, vt[`${vtCol}5`] || 0, plQuarterSum(5, months));
      check(
        `VitalTax: Q${q + 1} total allowable expenses = P&L Q${q + 1} Cost of Sales + Total Expenses`,
        vt[`${vtCol}29`] || 0,
        plQuarterSum(12, months) + plQuarterSum(22, months),
      );
    }
    check("VitalTax: annual turnover = P&L annual turnover", vt.G5 || 0, pl.B5 || 0);
    check("VitalTax: annual total allowable expenses = P&L Cost of Sales + Total Expenses", vt.G29 || 0, (pl.B12 || 0) + (pl.B22 || 0));
  }

  // Every coded purchase must reach an account. The general expense codes land
  // in the P&L total, the four vehicle running-cost codes accumulate in the
  // Purchases sheets' year-to-date column I2, and code "f" capitalises into T1
  // instead of the P&L. Anything the workbook drops shows up as a shortfall
  // here even though every total on its own still adds up.
  const purchases = results.PurchasesMar;
  if (expected.purchases && purchases) {
    const journalTotal = Object.values(expected.purchases)
      .flat()
      .reduce((s, tx) => s + tx.amount, 0);
    const accountedFor = (pl.B22 || 0) + (purchases.I2 || 0) + (purchases.T1 || 0);
    check("Purchases: journal total = general expenses + vehicle running costs + capitalised vehicles", accountedFor, journalTotal);
  }

  // SA103S cross-check: SE Short is fed entirely from the P&L and, in turn,
  // feeds the Draft Tax calculation -- an independent formula chain that
  // should land on the same figures.
  //
  // D71 (SA103S "Net profit") is HMRC's pre-capital-allowance box: its own
  // formula is turnover minus (P&L!B12 + P&L!B22 - P&L!B10), i.e. total
  // expenses with capital allowances subtracted back out. P&L!B23 folds
  // capital allowances into cost of sales instead, so the two figures are
  // identical only when B10 is zero -- they differ by exactly B10 otherwise.
  // Add it back before comparing.
  const seShort = results["SE Short"];
  if (seShort) {
    if (seShort.D38 !== undefined) check("SA103S: Turnover = P&L Sales", seShort.D38, pl.B5);
    if (seShort.D71 !== undefined)
      check("SA103S: Net profit (pre-capital-allowance) = P&L Net + Capital Allowances", seShort.D71, (pl.B23 || 0) + (pl.B10 || 0));
  }

  // Fixed asset chain: Fixed Assets sheet -> P&L Capital Allowances (B10).
  // Taxi vehicles under £12,000 claim a Writing Down Allowance restricted to
  // Admin!G8, not the 100% AIA BST's non-vehicle assets get -- the expected
  // allowance is recomputed independently from the read-back Admin rate and
  // restriction, so this check also stands in as the Admin-echo check for
  // those two cells.
  const expectedAdditions = fixedAssetAdditions(expected, "f");
  if (expectedAdditions.length > 0 && results["Fixed Assets"]) {
    const fa = results["Fixed Assets"];
    const assetCost = expectedAdditions.reduce((s, a) => s + a.cost, 0);
    check("Fixed Assets: New asset cost recorded", fa.D47 || 0, expected.fixed_asset_cost ?? assetCost);

    if (results.Admin) {
      const wdaRate = results.Admin.G5;
      const restriction = results.Admin.G8;
      const expectedWda = Math.min((fa.D47 || 0) * wdaRate, restriction);
      check("Fixed Assets: WDA claimed = min(cost x Admin WDA rate, Admin restriction)", fa.J1 || 0, expectedWda);
    }

    check(
      "Fixed Assets: Schedule capital allowance total = P&L Capital Allowances",
      pl.B10 || 0,
      (fa.I1 || 0) + (fa.J1 || 0) + (fa.P1 || 0) - (fa.Q1 || 0),
    );
  }

  // Admin echo: the generator injects the tax year's rates, bands and
  // thresholds from the TOML into the Admin sheet, and the Draft Tax
  // calculation reads from there. Nothing else asserts the injected values
  // equal what the run was generated from.
  if (taxData && results.Admin) {
    const admin = results.Admin;
    const it = taxData.income_tax;
    const ni = taxData.national_insurance;
    const ca = taxData.capital_allowances;
    const mil = taxData.mileage;
    check("Admin: Personal Allowance = tax data", admin.N4, it.personal_allowance);
    check("Admin: Personal Allowance Taper Threshold = tax data", admin.N5, it.personal_allowance_taper_threshold);
    check("Admin: Basic Rate = tax data", admin.N6, it.basic_rate, 0.0001);
    check("Admin: Higher Rate = tax data", admin.N7, it.higher_rate, 0.0001);
    check("Admin: Additional Rate = tax data", admin.N8, it.additional_rate, 0.0001);
    check("Admin: Basic Band End = tax data", admin.M11, it.basic_band_end);
    check("Admin: Higher Band Start = tax data", admin.N12, it.higher_band_start);
    check("Admin: Higher Band End = tax data", admin.N13, it.higher_band_end);
    check("Admin: NI Class 2 Weekly Rate = tax data", admin.L16, ni.class2_weekly_rate, 0.0001);
    check("Admin: NI Class 4 Lower Rate = tax data", admin.L20, ni.class4_lower_rate, 0.0001);
    check("Admin: NI Class 4 Lower Limit = tax data", admin.N20, ni.class4_lower_limit);
    check("Admin: NI Class 4 Upper Rate = tax data", admin.L23, ni.class4_upper_rate, 0.0001);
    check("Admin: NI Class 4 Upper Limit = tax data", admin.N23, ni.class4_upper_limit);
    check("Admin: AIA Rate = tax data", admin.G4, ca.annual_investment_allowance, 0.0001);
    check("Admin: WDA Rate = tax data", admin.G5, ca.writing_down_allowance, 0.0001);
    check("Admin: Motor Vehicle Cost Threshold = tax data", admin.E8, ca.motor_vehicle_cost_threshold);
    check("Admin: Motor Vehicle Restriction = tax data", admin.G8, ca.motor_vehicle_restriction);
    check("Admin: Mileage Higher Rate Limit = tax data", admin.F21, mil.higher_rate_limit);
    check("Admin: Mileage Higher Rate Pence = tax data", admin.G21, mil.higher_rate_pence, 0.0001);
    check("Admin: Mileage Lower Rate Start = tax data", admin.F22, mil.lower_rate_start);
    check("Admin: Mileage Lower Rate Pence = tax data", admin.G22, mil.lower_rate_pence, 0.0001);
    check("Admin: VAT Registration Threshold = tax data", admin.F26, taxData.vat.registration_threshold);
  }

  if (taxData) {
    const tax = results[TAX_SHEET];
    if (tax) {
      const profit = tax.E5 || 0;
      const expectedTax = calculateExpectedTax(profit, taxData);

      check("Income Tax", tax.E11 || 0, expectedTax.income_tax);
      check("NI Class 4 (lower)", tax.E14 || 0, expectedTax.ni_class4_lower);
      check("Total Tax + NI", tax.E17 || 0, expectedTax.total_tax_and_ni);

      // The allowance the sheet hands out, not the headline one. Above
      // 100,000 of profit it falls by a pound for every two, and reaches nil
      // at 125,140.
      check("Tax: Personal allowance after taper", tax.E6 || 0, expectedTax.personal_allowance);

      // The rates and bands the sheet actually applies, not the ones it is
      // captioned with. A total that happens to be right because the whole
      // taxable income sits in one band hides a wrong rate in the others.
      check("Tax: sheet applies the basic rate to the lower band", tax.D8 || 0, taxData.income_tax.basic_rate, 0.0001);
      check("Tax: sheet applies the higher rate above the band", tax.D9 || 0, taxData.income_tax.higher_rate, 0.0001);
      check("Tax: sheet applies the additional rate above the higher band", tax.D10 || 0, taxData.income_tax.additional_rate, 0.0001);
      check("Tax: sheet splits the basic and higher bands at the basic band end", tax.C9 || 0, taxData.income_tax.basic_band_end);
      check("Tax: sheet splits the higher and additional bands at the higher band end", tax.C10 || 0, taxData.income_tax.higher_band_end);
      check("Tax at basic rate", tax.E8 || 0, expectedTax.income_tax_basic);
      check("Tax at higher rate", tax.E9 || 0, expectedTax.income_tax_higher);
      check("Tax at additional rate", tax.E10 || 0, expectedTax.income_tax_additional);

      // Tax calculation chain (6c)
      // The sheet has no negative taxable income: a profit under the personal
      // allowance leaves it nil (E7 = IF(E5>E6,E5-E6,0)), and the bands below
      // it fall to nil with it.
      check("Tax: Taxable = Profit - Allowance", tax.E7, Math.max(0, (tax.E5 || 0) - (tax.E6 || 0)));
      check("Tax: IT = Basic + Higher + Additional", tax.E11, (tax.E8 || 0) + (tax.E9 || 0) + (tax.E10 || 0));
      check("Tax: Total = IT + NI", tax.E17, (tax.E11 || 0) + (tax.E14 || 0) + (tax.E15 || 0));

      if (seShort && seShort.D106 !== undefined) check("SA103S: Profit for tax = Draft Tax E5", seShort.D106, tax.E5);
    }

    // The Wages Forecast prints its own tax and NI liability, and the P&L's
    // financial health check charges a twelfth of it every month. It runs off
    // its own chain from Admin, so nothing above proves any of it.
    const forecast = results[FORECAST_SHEET];
    if (forecast) {
      const monthTotal = (row) => MONTH_COLS.reduce((sum, col) => sum + (pl[`${col}${row}`] || 0), 0);

      // The forecast repeats a month that traded and spreads the year's total
      // across the months that did not, so the projected year only equals the
      // actual one when every month traded. C19 counts the trading months
      // against the P&L's own monthly turnover.
      const monthsTraded = MONTH_COLS.filter((col) => (pl[`${col}5`] || 0) > 0).length;
      check("Forecast: months of actual trade = P&L months with turnover", forecast.C19 || 0, monthsTraded, 0);

      if (monthsTraded === MONTH_COLS.length) {
        check("Forecast: turnover = P&L turnover", forecast.C20 || 0, monthTotal(5));
        check("Forecast: other business income = P&L other business income", forecast.C22 || 0, monthTotal(24));
        check("Forecast: cost of sales = P&L cost of sales", forecast.C24 || 0, monthTotal(12));
        check("Forecast: general expenses = P&L general expenses", forecast.C28 || 0, monthTotal(22));
      }

      check(
        "Forecast: profit = turnover + other income - cost of sales - expenses",
        forecast.C30 || 0,
        (forecast.C20 || 0) + (forecast.C22 || 0) - (forecast.C24 || 0) - (forecast.C28 || 0),
      );

      const forecastProfit = forecast.C34 || 0;
      const expectedForecastTax = calculateExpectedTax(forecastProfit, taxData);
      check("Forecast: personal allowance after taper", forecast.C35 || 0, expectedForecastTax.personal_allowance);
      check("Forecast: tax at standard rate", forecast.C37 || 0, expectedForecastTax.income_tax_basic);
      check("Forecast: tax at higher rate", forecast.C38 || 0, expectedForecastTax.income_tax_higher);
      check("Forecast: tax at additional rate", forecast.C39 || 0, expectedForecastTax.income_tax_additional);
      check("Forecast: National Insurance", forecast.C40 || 0, expectedForecastTax.ni_class4_lower + expectedForecastTax.ni_class4_upper);
      check("Forecast: tax and NI liability", forecast.C41 || 0, expectedForecastTax.total_tax_and_ni);
    }
  }

  // The whole distance from the accounting profit to the profit tax is
  // charged on, adjustment by adjustment, with nothing left over.
  const bridge = profitBridge(results);
  if (bridge) check(PROFIT_BRIDGE_CHECK, bridge.residue, 0, 0.01);

  return checks;
}
