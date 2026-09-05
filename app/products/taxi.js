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
import { calculateMileageAllowance } from "../lib/tax/mileage.js";

export const PRODUCT = {
  id: "taxi",
  dir: "taxi",
  name: "Taxi Driver",
  taxRegime: "se",
  prefix: "GB Accounts Taxi Driver",
};

// A sales line dated outside the package's own tax year: the Sales grid
// (buildSalesGrid) has no row for it, so nothing in the workbook can hold
// it. Thrown with every off-grid date at once rather than the first one
// found, so a customer fixing a download does not have to run it repeatedly
// to find each bad date in turn.
export class TaxiDateOffGridError extends Error {
  constructor(dates) {
    super(
      `${dates.length} sales ${dates.length === 1 ? "entry is" : "entries are"} dated outside the package's year: ${dates.join(", ")}. Move them into the period or change the book's period.`,
    );
    this.name = "TaxiDateOffGridError";
    this.dates = dates;
  }
}

const round2 = (v) => Math.round(v * 100) / 100;

// ── Date-to-row mapping for pre-filled Sales sheets ────────────────────────

// Every day of the tax year mapped to its row on the month's Sales sheet,
// plus every week's rental and other-income rows, in the same layout
// buildSalesSheetXml (generator.js) writes: a week's days, then its rental
// row, its other-income row and its subtotal, with a blank row between
// weeks. `week` is the index into the returned `weeks` array, shared by
// every day the week covers.
function buildSalesGrid(startYear) {
  const taxYearWeeks = generateTaxYearWeeks(startYear);
  const monthly = groupWeeksIntoMonths(taxYearWeeks);

  const days = new Map();
  const weeks = [];

  for (const [monthKey, monthWeeks] of Object.entries(monthly)) {
    if (!monthWeeks.length) continue;
    let row = 5;

    for (let w = 0; w < monthWeeks.length; w++) {
      const weekDays = monthWeeks[w];
      const week = weeks.length;
      for (const date of weekDays) {
        days.set(dateToSerial(date), { monthKey, row, week });
        row++;
      }
      const rentalRow = row;
      const otherIncomeRow = row + 1;
      weeks.push({ monthKey, lastSerial: dateToSerial(weekDays[weekDays.length - 1]), rentalRow, otherIncomeRow });
      row += 3; // rental + other income + subtotal
      if (w < monthWeeks.length - 1) row += 1; // blank separator
    }
  }

  return { days, weeks };
}

// ── Scenario cell writes ───────────────────────────────────────────────────

export function cellWrites(scenario, targetStartYear = null) {
  const writes = {};

  // Every date this product writes (Sales, Purchases, Fixed Assets) is
  // translated by the same whole-tax-year offset, so a package generated
  // for a different year end still carries the fixture's dates onto its
  // own year rather than leaking the scenario's original dates verbatim.
  const scenarioStartYear = extractTaxYearStart(scenario);
  const startYear = targetStartYear || scenarioStartYear;
  const scenarioEpoch = Date.UTC(scenarioStartYear, 3, 6);
  const targetEpoch = Date.UTC(startYear, 3, 6);
  const dayOffsetMs = targetEpoch - scenarioEpoch;

  // Business Details. 'SE Short'!C13 reads C8 back as box 1, C22/F22 read
  // C17 for box 2, and O8 reads O5 for the UTR box -- C7 (the label row),
  // C10, C12 and O29 are never written, and the address and town stay in
  // the book with no cell of their own.
  if (scenario.business || scenario.metadata) {
    writes["Business Details"] = {};
    const bd = writes["Business Details"];
    const biz = scenario.business || {};
    bd.C5 = biz.name || scenario.metadata?.name || "";
    if (biz.description) bd.C8 = biz.description;
    if (biz.postcode) bd.C17 = biz.postcode;
    if (biz.utr) bd.O5 = biz.utr;
  }

  if (scenario.sales) {
    const grid = buildSalesGrid(startYear);

    // One entry per day carrying a fare or a mileage log, gathered before any
    // write: a day with two lines writes one E cell holding their sum and one
    // C cell joining their names, rather than the second line overwriting the
    // first.
    const days = new Map(); // serial -> { monthKey, row, takings, miles, other, names, hasTakings }
    const rental = new Map(); // week index -> amount (SalesXxx!E<rentalRow>)
    const other = new Map(); // week index -> amount (SalesXxx!F<otherIncomeRow>)
    const offGrid = new Set();

    for (const [, transactions] of Object.entries(scenario.sales)) {
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        const targetDate = new Date(d.getTime() + dayOffsetMs);
        const serial = toExcelSerial(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, targetDate.getUTCDate());

        const cell = grid.days.get(serial);
        if (!cell) {
          offGrid.add(targetDate.toISOString().split("T")[0]);
          continue;
        }

        const caption = String(tx.customer || "").trim();
        const isOther = tx.account === "4001";
        const amount = tx.amount || 0;

        if (!isOther && caption === "Rental due") {
          rental.set(cell.week, (rental.get(cell.week) || 0) + amount);
        } else if (isOther && caption === "Any other income") {
          other.set(cell.week, (other.get(cell.week) || 0) + amount);
        } else {
          if (!days.has(serial))
            days.set(serial, { monthKey: cell.monthKey, row: cell.row, takings: 0, miles: 0, other: 0, names: [], hasTakings: false });
          const day = days.get(serial);
          if (isOther) {
            day.other += amount;
          } else {
            day.takings += amount;
            // The day's business miles, beside the day's takings. SalesApr!D1
            // sums the column into PurchasesApr!A1, the running mileage total
            // the P&L's own vehicle-cost comparison is made on.
            day.miles += tx.mileage || 0;
            day.hasTakings = true;
          }
          if (caption && !day.names.includes(caption)) day.names.push(caption);
        }
      }
    }

    if (offGrid.size) throw new TaxiDateOffGridError([...offGrid].sort());

    for (const day of days.values()) {
      const sheetName = `Sales${MONTH_SHEETS[day.monthKey]}`;
      if (!writes[sheetName]) writes[sheetName] = {};
      const sheet = writes[sheetName];
      // A day driven with no fare still writes a nil fare, so its miles still
      // count towards the year's mileage claim.
      if (day.hasTakings) sheet[`E${day.row}`] = round2(day.takings);
      if (day.miles > 0) sheet[`D${day.row}`] = day.miles;
      if (day.other > 0) sheet[`F${day.row}`] = round2(day.other);
      if (day.names.length) sheet[`C${day.row}`] = day.names.join("; ");
    }

    for (const [week, amount] of rental) {
      const { monthKey, rentalRow } = grid.weeks[week];
      const sheetName = `Sales${MONTH_SHEETS[monthKey]}`;
      if (!writes[sheetName]) writes[sheetName] = {};
      writes[sheetName][`E${rentalRow}`] = round2(amount);
    }

    for (const [week, amount] of other) {
      const { monthKey, otherIncomeRow } = grid.weeks[week];
      const sheetName = `Sales${MONTH_SHEETS[monthKey]}`;
      if (!writes[sheetName]) writes[sheetName] = {};
      writes[sheetName][`F${otherIncomeRow}`] = round2(amount);
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
        const targetDate = new Date(d.getTime() + dayOffsetMs);
        sheet[`A${row}`] = toExcelSerial(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, targetDate.getUTCDate());
        if (tx.supplier) sheet[`B${row}`] = tx.supplier;
        if (tx.reference) sheet[`C${row}`] = tx.reference;
        sheet[`D${row}`] = tx.code;
        // A mileage-log entry buys nothing: its whole expense is the claim the
        // approved rate makes of the miles. Column E takes them (PurchasesApr!E1
        // = SUM(E5:E199), added to the Sales sheet's own column into the running
        // total at A1 and priced at U4), so writing the amount in column F as
        // well would charge the same journey twice.
        if (tx.mileage) sheet[`E${row}`] = tx.mileage;
        else sheet[`F${row}`] = tx.amount;
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
  ["Business Details", "C5",  "Business Name",       "entityInformation.organizationIdentifier",  "Business Details", 0, "text"],
  ["Business Details", "C8",  "Description of business", "entityInformation.organizationDescription", "Business Details", 0, "text"],
  ["Business Details", "C17", "Postcode",            "entityInformation.organizationPostcode",     "Business Details", 0, "text"],
  ["Business Details", "O5",  "UTR",                 "entityInformation.taxRegistrationNumber",   "Business Details", 0, "identifier"],
  ["Business Details", "D29", "Losses brought forward (box 29)", "gl-cor:amount (sa103s.lossBroughtForwardInput)", "Business Details", 0, "money"],
  ["Business Details", "O29", "Goods and services for own use (box 27)", "gl-cor:amount (sa103s.ownUseInput)", "Business Details", 0, "money"],
  // ── Profit & Loss Account (column B) ──
  ["Profit & Loss Acc", "B5",  "Turnover (Total Fares)",           "gl-cor:amount (salesTurnover)",     "Profit & Loss Account", 0, "money"],
  ["Profit & Loss Acc", "B6",  "Fuel",                             "accounts.purchases.5100 (fuel)",    "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B7",  "Car Hire / Rental",                "accounts.purchases.5200 (carHire)", "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B8",  "Repairs & Servicing",              "accounts.purchases.5300 (repairs)", "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B9",  "Road Tax & Insurance",             "accounts.purchases.5400 (taxIns)",  "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B10", "Capital Allowances",               "tax.capitalAllowances",             "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B11", "Mileage Allowance",                "tax.mileage (allowance)",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B12", "Cost of Sales (vehicle costs)",    "gl-cor:amount (costOfSales)",       "Profit & Loss Account", 0, "money"],
  ["Profit & Loss Acc", "B13", "**Gross Profit**",                 "gl-cor:amount (grossProfit)",       "Profit & Loss Account", 0, "money"],
  ["Profit & Loss Acc", "B14", "Employee Costs",                   "accounts.purchases.5500",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B15", "Premises Costs",                   "accounts.purchases.5600",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B16", "General Admin",                    "accounts.purchases.5700",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B17", "Advertising",                      "accounts.purchases.5800",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B18", "Legal & Professional",             "accounts.purchases.5900",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B19", "Interest & Bank Charges",          "accounts.purchases.6000",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B20", "Bank Charges",                     "accounts.purchases.6100",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B21", "Other Expenses",                   "accounts.purchases.6200",           "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "B22", "Total General Expenses",           "gl-cor:amount (totalGeneral)",      "Profit & Loss Account", 0, "money"],
  ["Profit & Loss Acc", "B23", "**Net Profit**",                   "gl-cor:amount (netProfit)",         "Profit & Loss Account", 0, "money"],
  ["Profit & Loss Acc", "B24", "Any Other Business Income",        "gl-cor:amount (otherIncome)",       "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "J1",  "Running costs plus capital allowances", "accounts.purchases (vehicleCostsCompared)", "Profit & Loss Account", 1, "money"],
  ["Profit & Loss Acc", "C1",  "Route the sheet takes",            "gl-cor:amount (vehicleRoute)",      "Profit & Loss Account", 1, "text"],
  // ── Monthly columns C:N of the four P&L rows the sheet fills a month at a
  // time: each Sales tab's own takings and other-income totals, and the
  // month's vehicle and running cost sums. B5, B12, B22 and B24 above are
  // these same rows' year totals. ──
  ["Profit & Loss Acc", "C5",  "Apr", "gl-cor:amount (monthlyTakings.apr)", "Monthly Takings", 0, "money"],
  ["Profit & Loss Acc", "D5",  "May", "gl-cor:amount (monthlyTakings.may)", "Monthly Takings", 0, "money"],
  ["Profit & Loss Acc", "E5",  "Jun", "gl-cor:amount (monthlyTakings.jun)", "Monthly Takings", 0, "money"],
  ["Profit & Loss Acc", "F5",  "Jul", "gl-cor:amount (monthlyTakings.jul)", "Monthly Takings", 0, "money"],
  ["Profit & Loss Acc", "G5",  "Aug", "gl-cor:amount (monthlyTakings.aug)", "Monthly Takings", 0, "money"],
  ["Profit & Loss Acc", "H5",  "Sep", "gl-cor:amount (monthlyTakings.sep)", "Monthly Takings", 0, "money"],
  ["Profit & Loss Acc", "I5",  "Oct", "gl-cor:amount (monthlyTakings.oct)", "Monthly Takings", 0, "money"],
  ["Profit & Loss Acc", "J5",  "Nov", "gl-cor:amount (monthlyTakings.nov)", "Monthly Takings", 0, "money"],
  ["Profit & Loss Acc", "K5",  "Dec", "gl-cor:amount (monthlyTakings.dec)", "Monthly Takings", 0, "money"],
  ["Profit & Loss Acc", "L5",  "Jan", "gl-cor:amount (monthlyTakings.jan)", "Monthly Takings", 0, "money"],
  ["Profit & Loss Acc", "M5",  "Feb", "gl-cor:amount (monthlyTakings.feb)", "Monthly Takings", 0, "money"],
  ["Profit & Loss Acc", "N5",  "Mar", "gl-cor:amount (monthlyTakings.mar)", "Monthly Takings", 0, "money"],
  ["Profit & Loss Acc", "C12", "Apr", "gl-cor:amount (monthlyVehicleCosts.apr)", "Monthly Vehicle Costs", 0, "money"],
  ["Profit & Loss Acc", "D12", "May", "gl-cor:amount (monthlyVehicleCosts.may)", "Monthly Vehicle Costs", 0, "money"],
  ["Profit & Loss Acc", "E12", "Jun", "gl-cor:amount (monthlyVehicleCosts.jun)", "Monthly Vehicle Costs", 0, "money"],
  ["Profit & Loss Acc", "F12", "Jul", "gl-cor:amount (monthlyVehicleCosts.jul)", "Monthly Vehicle Costs", 0, "money"],
  ["Profit & Loss Acc", "G12", "Aug", "gl-cor:amount (monthlyVehicleCosts.aug)", "Monthly Vehicle Costs", 0, "money"],
  ["Profit & Loss Acc", "H12", "Sep", "gl-cor:amount (monthlyVehicleCosts.sep)", "Monthly Vehicle Costs", 0, "money"],
  ["Profit & Loss Acc", "I12", "Oct", "gl-cor:amount (monthlyVehicleCosts.oct)", "Monthly Vehicle Costs", 0, "money"],
  ["Profit & Loss Acc", "J12", "Nov", "gl-cor:amount (monthlyVehicleCosts.nov)", "Monthly Vehicle Costs", 0, "money"],
  ["Profit & Loss Acc", "K12", "Dec", "gl-cor:amount (monthlyVehicleCosts.dec)", "Monthly Vehicle Costs", 0, "money"],
  ["Profit & Loss Acc", "L12", "Jan", "gl-cor:amount (monthlyVehicleCosts.jan)", "Monthly Vehicle Costs", 0, "money"],
  ["Profit & Loss Acc", "M12", "Feb", "gl-cor:amount (monthlyVehicleCosts.feb)", "Monthly Vehicle Costs", 0, "money"],
  ["Profit & Loss Acc", "N12", "Mar", "gl-cor:amount (monthlyVehicleCosts.mar)", "Monthly Vehicle Costs", 0, "money"],
  ["Profit & Loss Acc", "C22", "Apr", "gl-cor:amount (monthlyRunningCosts.apr)", "Monthly Running Costs", 0, "money"],
  ["Profit & Loss Acc", "D22", "May", "gl-cor:amount (monthlyRunningCosts.may)", "Monthly Running Costs", 0, "money"],
  ["Profit & Loss Acc", "E22", "Jun", "gl-cor:amount (monthlyRunningCosts.jun)", "Monthly Running Costs", 0, "money"],
  ["Profit & Loss Acc", "F22", "Jul", "gl-cor:amount (monthlyRunningCosts.jul)", "Monthly Running Costs", 0, "money"],
  ["Profit & Loss Acc", "G22", "Aug", "gl-cor:amount (monthlyRunningCosts.aug)", "Monthly Running Costs", 0, "money"],
  ["Profit & Loss Acc", "H22", "Sep", "gl-cor:amount (monthlyRunningCosts.sep)", "Monthly Running Costs", 0, "money"],
  ["Profit & Loss Acc", "I22", "Oct", "gl-cor:amount (monthlyRunningCosts.oct)", "Monthly Running Costs", 0, "money"],
  ["Profit & Loss Acc", "J22", "Nov", "gl-cor:amount (monthlyRunningCosts.nov)", "Monthly Running Costs", 0, "money"],
  ["Profit & Loss Acc", "K22", "Dec", "gl-cor:amount (monthlyRunningCosts.dec)", "Monthly Running Costs", 0, "money"],
  ["Profit & Loss Acc", "L22", "Jan", "gl-cor:amount (monthlyRunningCosts.jan)", "Monthly Running Costs", 0, "money"],
  ["Profit & Loss Acc", "M22", "Feb", "gl-cor:amount (monthlyRunningCosts.feb)", "Monthly Running Costs", 0, "money"],
  ["Profit & Loss Acc", "N22", "Mar", "gl-cor:amount (monthlyRunningCosts.mar)", "Monthly Running Costs", 0, "money"],
  ["Profit & Loss Acc", "C24", "Apr", "gl-cor:amount (monthlyOtherIncome.apr)", "Monthly Other Income", 0, "money"],
  ["Profit & Loss Acc", "D24", "May", "gl-cor:amount (monthlyOtherIncome.may)", "Monthly Other Income", 0, "money"],
  ["Profit & Loss Acc", "E24", "Jun", "gl-cor:amount (monthlyOtherIncome.jun)", "Monthly Other Income", 0, "money"],
  ["Profit & Loss Acc", "F24", "Jul", "gl-cor:amount (monthlyOtherIncome.jul)", "Monthly Other Income", 0, "money"],
  ["Profit & Loss Acc", "G24", "Aug", "gl-cor:amount (monthlyOtherIncome.aug)", "Monthly Other Income", 0, "money"],
  ["Profit & Loss Acc", "H24", "Sep", "gl-cor:amount (monthlyOtherIncome.sep)", "Monthly Other Income", 0, "money"],
  ["Profit & Loss Acc", "I24", "Oct", "gl-cor:amount (monthlyOtherIncome.oct)", "Monthly Other Income", 0, "money"],
  ["Profit & Loss Acc", "J24", "Nov", "gl-cor:amount (monthlyOtherIncome.nov)", "Monthly Other Income", 0, "money"],
  ["Profit & Loss Acc", "K24", "Dec", "gl-cor:amount (monthlyOtherIncome.dec)", "Monthly Other Income", 0, "money"],
  ["Profit & Loss Acc", "L24", "Jan", "gl-cor:amount (monthlyOtherIncome.jan)", "Monthly Other Income", 0, "money"],
  ["Profit & Loss Acc", "M24", "Feb", "gl-cor:amount (monthlyOtherIncome.feb)", "Monthly Other Income", 0, "money"],
  ["Profit & Loss Acc", "N24", "Mar", "gl-cor:amount (monthlyOtherIncome.mar)", "Monthly Other Income", 0, "money"],
  // ── VitalTax — quarterly re-sum of P&L monthly columns C:N into its own
  // C:F quarter columns and G annual column (verified against the template:
  // C5=SUM(P&L!C5:E5) through F5=SUM(P&L!L5:N5), G5=SUM(C5:F5); the same
  // pattern feeds row 29's re-sum of the P&L's Cost of Sales and Total
  // Expenses rows) ──
  ["VitalTax", "C5",  "Q1 Turnover",                         "gl-cor:amount (vitalTax.q1Turnover)",     "Quarterly Summary", 1, "money"],
  ["VitalTax", "D5",  "Q2 Turnover",                         "gl-cor:amount (vitalTax.q2Turnover)",     "Quarterly Summary", 1, "money"],
  ["VitalTax", "E5",  "Q3 Turnover",                         "gl-cor:amount (vitalTax.q3Turnover)",     "Quarterly Summary", 1, "money"],
  ["VitalTax", "F5",  "Q4 Turnover",                         "gl-cor:amount (vitalTax.q4Turnover)",     "Quarterly Summary", 1, "money"],
  ["VitalTax", "G5",  "**Annual Turnover**",                 "gl-cor:amount (vitalTax.annualTurnover)", "Quarterly Summary", 0, "money"],
  ["VitalTax", "C6",  "Q1 Other income",                     "gl-cor:amount (vitalTax.q1OtherIncome)",     "Quarterly Summary", 1, "money"],
  ["VitalTax", "D6",  "Q2 Other income",                     "gl-cor:amount (vitalTax.q2OtherIncome)",     "Quarterly Summary", 1, "money"],
  ["VitalTax", "E6",  "Q3 Other income",                     "gl-cor:amount (vitalTax.q3OtherIncome)",     "Quarterly Summary", 1, "money"],
  ["VitalTax", "F6",  "Q4 Other income",                     "gl-cor:amount (vitalTax.q4OtherIncome)",     "Quarterly Summary", 1, "money"],
  ["VitalTax", "G6",  "**Annual Other income**",             "gl-cor:amount (vitalTax.annualOtherIncome)", "Quarterly Summary", 0, "money"],
  ["VitalTax", "C29", "Q1 Total Allowable Expenses",         "gl-cor:amount (vitalTax.q1Expenses)",     "Quarterly Summary", 1, "money"],
  ["VitalTax", "D29", "Q2 Total Allowable Expenses",         "gl-cor:amount (vitalTax.q2Expenses)",     "Quarterly Summary", 1, "money"],
  ["VitalTax", "E29", "Q3 Total Allowable Expenses",         "gl-cor:amount (vitalTax.q3Expenses)",     "Quarterly Summary", 1, "money"],
  ["VitalTax", "F29", "Q4 Total Allowable Expenses",         "gl-cor:amount (vitalTax.q4Expenses)",     "Quarterly Summary", 1, "money"],
  ["VitalTax", "G29", "**Annual Total Allowable Expenses**", "gl-cor:amount (vitalTax.annualExpenses)", "Quarterly Summary", 0, "money"],
  // ── SE Short (SA103S) — formula cells only ──
  ["SE Short", "D38",  "Turnover (box 9)",                       "gl-cor:amount (sa103s.turnover)",           "Self Assessment (SA103S)", 0, "money"],
  ["SE Short", "O38",  "Other business income (box 10)",         "gl-cor:amount (sa103s.otherIncome)",        "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D71",  "**Net profit/loss (box 21)**",           "gl-cor:amount (sa103s.netProfit)",          "Self Assessment (SA103S)", 0, "money"],
  ["SE Short", "O71",  "Net loss (box 22)",                      "gl-cor:amount (sa103s.netLoss)",            "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D80",  "Annual investment allowance (box 23)",   "tax.capitalAllowances.aia (sa103s)",        "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D85",  "Small-balance allowance (box 24)",       "tax.capitalAllowances.smallPool (sa103s)",  "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "O80",  "Other capital allowances (box 25)",      "tax.capitalAllowances.wda (sa103s)",        "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "O85",  "Balancing charges (box 26)",             "tax.capitalAllowances.balancingCharge (sa103s)", "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D94",  "Goods and services for own use (box 27)","gl-cor:amount (sa103s.ownUse)",             "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D99",  "**Net business profit (box 28)**",       "gl-cor:amount (sa103s.taxableProfit)",      "Self Assessment (SA103S)", 0, "money"],
  ["SE Short", "O94",  "Loss brought forward (box 29)",          "gl-cor:amount (sa103s.lossBroughtForward)", "Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "O99",  "Other business income (box 30)",         "gl-cor:amount (sa103s.otherBusinessIncome)","Self Assessment (SA103S)", 1, "money"],
  ["SE Short", "D106", "**Net profit for tax calc (box 31)**",   "gl-cor:amount (sa103s.profitForTax)",       "Self Assessment (SA103S)", 0, "money"],
  // ── Draft Tax Calculation ──
  [TAX_SHEET, "E5",  "Profit from Self Employment",  "gl-cor:amount (profitSE)",             "Draft Tax Calculation", 0, "money"],
  [TAX_SHEET, "E6",  "Less: Personal Allowance",     "tax.incomeTax.personalAllowance",      "Draft Tax Calculation", 1, "money"],
  [TAX_SHEET, "E7",  "Taxable Income",               "gl-cor:amount (taxableIncome)",        "Draft Tax Calculation", 0, "money"],
  [TAX_SHEET, "D8",  "Basic rate the sheet applies", "tax.incomeTax.basicRate (applied)",    "Draft Tax Calculation", 1, "rate"],
  [TAX_SHEET, "C9",  "Basic band ceiling the sheet applies", "tax.incomeTax.basicRateLimit (applied)", "Draft Tax Calculation", 1, "money"],
  [TAX_SHEET, "D9",  "Higher rate the sheet applies", "tax.incomeTax.higherRate (applied)",  "Draft Tax Calculation", 1, "rate"],
  [TAX_SHEET, "C10", "Additional rate threshold the sheet applies", "tax.incomeTax.higherRateThreshold (applied)", "Draft Tax Calculation", 1, "money"],
  [TAX_SHEET, "D10", "Additional rate the sheet applies", "tax.incomeTax.additionalRate (applied)", "Draft Tax Calculation", 1, "rate"],
  [TAX_SHEET, "E8",  "Tax at Basic Rate",            "tax.incomeTax.basicRate",              "Draft Tax Calculation", 1, "money"],
  [TAX_SHEET, "E9",  "Tax at Higher Rate",           "tax.incomeTax.higherRate",             "Draft Tax Calculation", 1, "money"],
  [TAX_SHEET, "E10", "Tax at Additional Rate",       "tax.incomeTax.additionalRate",         "Draft Tax Calculation", 1, "money"],
  [TAX_SHEET, "E11", "**Total Income Tax**",         "tax.incomeTax (total)",                "Draft Tax Calculation", 0, "money"],
  [TAX_SHEET, "E14", "NI Class 4 (lower band)",      "tax.nationalInsurance.class4MainRate", "Draft Tax Calculation", 1, "money"],
  [TAX_SHEET, "E15", "NI Class 4 (upper band)",      "tax.nationalInsurance.class4UpperRate","Draft Tax Calculation", 1, "money"],
  [TAX_SHEET, "E17", "**Total Tax + NI**",           "gl-cor:taxAmount (totalTaxNI)",        "Draft Tax Calculation", 0, "money"],
  [TAX_SHEET, "E25", "First payment on account (31 January)", "gl-cor:taxAmount (paymentOnAccount1)", "Draft Tax Calculation", 1, "money"],
  [TAX_SHEET, "E26", "Second payment on account (31 July)",  "gl-cor:taxAmount (paymentOnAccount2)", "Draft Tax Calculation", 1, "money"],
  // ── Wages Forecast — the projected year the customer plans against.
  // The actual half (rows 5 to 15) pulls the P&L's monthly columns; the
  // forecast half (rows 19 to 30) repeats each month that traded and spreads
  // the year's total across the months that did not, counting the trading
  // months in C19. The tax block below it charges the projected profit. ──
  [FORECAST_SHEET, "C19", "Months of actual trade",     "gl-cor:amount (forecast.monthsTraded)",  "Wages Forecast", 1, "count"],
  [FORECAST_SHEET, "C20", "Forecast Sales Turnover",    "gl-cor:amount (forecast.turnover)",      "Wages Forecast", 1, "money"],
  [FORECAST_SHEET, "C22", "Forecast Investment Grants", "gl-cor:amount (forecast.otherIncome)",   "Wages Forecast", 1, "money"],
  [FORECAST_SHEET, "C24", "Forecast Cost of Sales",     "gl-cor:amount (forecast.costOfSales)",   "Wages Forecast", 1, "money"],
  [FORECAST_SHEET, "C28", "Forecast General Expenses",  "gl-cor:amount (forecast.expenses)",      "Wages Forecast", 1, "money"],
  [FORECAST_SHEET, "C30", "**Forecast Profit before Tax**", "gl-cor:amount (forecast.profit)",    "Wages Forecast", 0, "money"],
  [FORECAST_SHEET, "C34", "Profit before Tax",          "gl-cor:amount (forecast.taxableProfit)", "Wages Forecast", 1, "money"],
  [FORECAST_SHEET, "C35", "Personal Allowance",         "tax.incomeTax.personalAllowance",        "Wages Forecast", 1, "money"],
  [FORECAST_SHEET, "C36", "Profit after Allowance",     "gl-cor:amount (forecast.taxableIncome)", "Wages Forecast", 1, "money"],
  [FORECAST_SHEET, "C37", "Tax at standard rate",       "tax.incomeTax.basicRate",                "Wages Forecast", 1, "money"],
  [FORECAST_SHEET, "C38", "Tax at higher rate",         "tax.incomeTax.higherRate",               "Wages Forecast", 1, "money"],
  [FORECAST_SHEET, "C39", "Tax at additional rate",     "tax.incomeTax.additionalRate",           "Wages Forecast", 1, "money"],
  [FORECAST_SHEET, "C40", "National Insurance",         "tax.nationalInsurance.class4",           "Wages Forecast", 1, "money"],
  [FORECAST_SHEET, "C41", "**Forecast Tax & NI Liability**", "gl-cor:taxAmount (forecast.totalTaxNI)", "Wages Forecast", 0, "money"],
  // ── Purchase analysis (year-to-date columns on the last month's sheet) ──
  ["PurchasesMar", "A1", "Business miles for the year",          "gl-bus:measurableQuantity (miles)",         "Purchase Analysis", 0, "count"],
  ["PurchasesMar", "A2", "Mileage claimed for the year",         "tax.mileage (claim)",                       "Purchase Analysis", 0, "money"],
  ["PurchasesMar", "I2", "Vehicle running costs for the year",  "accounts.purchases (vehicleRunningCosts)",  "Purchase Analysis", 0, "money"],
  ["PurchasesMar", "T1", "Vehicle purchases capitalised",       "fixedAssets (purchased, year total)",       "Purchase Analysis", 0, "money"],
  // ── Fixed Assets schedule ──
  ["Fixed Assets", "D47", "New Asset Cost (Vehicle under £12,000)", "fixedAssets[0].cost",              "Fixed Assets", 1, "money"],
  ["Fixed Assets", "I1",  "Total Annual Investment Allowance",      "tax.capitalAllowances.aia (schedule)",            "Fixed Assets", 0, "money"],
  ["Fixed Assets", "J1",  "Total Writing Down Allowance",           "tax.capitalAllowances.wda (schedule)",            "Fixed Assets", 1, "money"],
  ["Fixed Assets", "P1",  "Total Capital Allowance on Disposal",    "tax.capitalAllowances.disposals (schedule)",      "Fixed Assets", 1, "money"],
  ["Fixed Assets", "Q1",  "Total Balancing Charge",                 "tax.capitalAllowances.balancingCharge (schedule)", "Fixed Assets", 1, "money"],
  ["Fixed Assets", "K1",  "Written-down value carried forward",      "fixedAssets (writtenDownValue)",                  "Fixed Assets", 0, "money"],
  // ── Admin (generator-injected tax data) ──
  ["Admin", "N4",  "Personal Allowance",                 "tax.incomeTax.personalAllowance",         "Admin (Generator Injected)", 0, "money"],
  ["Admin", "N5",  "Personal Allowance Taper Threshold",  "tax.incomeTax.personalAllowanceTaperThreshold", "Admin (Generator Injected)", 0, "money"],
  ["Admin", "N6",  "Basic Rate",                          "tax.incomeTax.basicRate",                 "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "N7",  "Higher Rate",                         "tax.incomeTax.higherRate",                "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "N8",  "Additional Rate",                     "tax.incomeTax.additionalRate",            "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "M11", "Basic Band End",                      "tax.incomeTax.basicRateLimit",             "Admin (Generator Injected)", 0, "money"],
  ["Admin", "N12", "Higher Band Start",                   "tax.incomeTax.basicRateLimit (+1)",        "Admin (Generator Injected)", 0, "money"],
  ["Admin", "N13", "Higher Band End",                     "tax.incomeTax.additionalRateThreshold",    "Admin (Generator Injected)", 0, "money"],
  ["Admin", "L16", "NI Class 2 Weekly Rate",              "tax.nationalInsurance.class2WeeklyRate",  "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "L20", "NI Class 4 Lower Rate",                "tax.nationalInsurance.class4MainRate",    "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "N20", "NI Class 4 Lower Limit",               "tax.nationalInsurance.class4LowerProfits","Admin (Generator Injected)", 0, "money"],
  ["Admin", "L23", "NI Class 4 Upper Rate",                "tax.nationalInsurance.class4UpperRate",   "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "N23", "NI Class 4 Upper Limit",               "tax.nationalInsurance.class4UpperProfits","Admin (Generator Injected)", 0, "money"],
  ["Admin", "G4",  "Annual Investment Allowance Rate",     "tax.capitalAllowances.annualInvestmentAllowance", "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "G5",  "Writing Down Allowance Rate",          "tax.capitalAllowances.mainRateWDA",       "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "F21", "Mileage Higher Rate Limit",            "tax.mileage.higherRateLimit",             "Admin (Generator Injected)", 0, "count"],
  ["Admin", "G21", "Mileage Higher Rate Pence",             "tax.mileage.carFirst10000",               "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "F22", "Mileage Lower Rate Start",              "tax.mileage.lowerRateStart",              "Admin (Generator Injected)", 0, "count"],
  ["Admin", "G22", "Mileage Lower Rate Pence",              "tax.mileage.carOver10000",                "Admin (Generator Injected)", 0, "rate"],
  ["Admin", "F26", "VAT Registration Threshold",           "tax.vat.registrationThreshold",           "Admin (Generator Injected)", 0, "money"],
];

// The year-at-a-glance strip's tiles and pies, declared as data rather than
// read as literal cell keys inside headlines.js (see headlinesFromReport()
// there for how a declaration like this one is reduced against R). Taxi has
// no stock and no debtors sheet, so assets carries only the written-down
// value. `pieLines` gives the outgoings pie its full candidate list --
// the six vehicle-cost lines (B10's capital allowances included, so the
// slices sum to B12 plus B22) and the eight general-expense lines -- rather
// than one combined "Cost of sales" slice. `vehicle` is the
// mileage-versus-actual-costs tile: present only on a book that keeps a
// mileage log.
export const HEADLINES = {
  turnover: { key: "cell/Profit & Loss Acc!B5" },
  costOfSales: { key: "cell/Profit & Loss Acc!B12", label: "vehicle costs" },
  runningCosts: { key: "cell/Profit & Loss Acc!B22", label: "running the business" },
  assets: { writtenDown: { key: "cell/Fixed Assets!K1", optional: true } },
  tax: { key: `cell/${TAX_SHEET}!E17`, label: "income tax and Class 4 NI" },
  pieLines: [
    ["cell/Profit & Loss Acc!B6", "Fuel"],
    ["cell/Profit & Loss Acc!B7", "Car hire"],
    ["cell/Profit & Loss Acc!B8", "Repairs and servicing"],
    ["cell/Profit & Loss Acc!B9", "Road tax and insurance"],
    ["cell/Profit & Loss Acc!B10", "Capital allowances"],
    ["cell/Profit & Loss Acc!B11", "Mileage allowance"],
    ["cell/Profit & Loss Acc!B14", "Employee costs"],
    ["cell/Profit & Loss Acc!B15", "Premises"],
    ["cell/Profit & Loss Acc!B16", "General admin"],
    ["cell/Profit & Loss Acc!B17", "Advertising"],
    ["cell/Profit & Loss Acc!B18", "Legal and professional"],
    ["cell/Profit & Loss Acc!B19", "Interest"],
    ["cell/Profit & Loss Acc!B20", "Bank charges"],
    ["cell/Profit & Loss Acc!B21", "Other expenses"],
  ],
  vehicle: {
    miles: "cell/PurchasesMar!A1",
    allowance: "cell/PurchasesMar!A2",
    running: "cell/PurchasesMar!I2",
    compared: "cell/Profit & Loss Acc!J1",
    route: "cell/Profit & Loss Acc!C1",
    charged: "cell/Profit & Loss Acc!B12",
  },
};

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
  for (const cell of monthlyProfitAndLossCells()) {
    if (!reads["Profit & Loss Acc"].includes(cell)) reads["Profit & Loss Acc"].push(cell);
  }

  return reads;
}

const MONTHLY_PROFIT_AND_LOSS_ROWS = [5, 12, 22, 24];

function monthlyProfitAndLossCells() {
  return MONTHLY_PROFIT_AND_LOSS_ROWS.flatMap((row) => MONTH_COLS.map((col) => `${col}${row}`));
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
  for (const [sheet, cell, diyLabel, glMapping, , , unit] of CELL_MAP) {
    const key = `${sheet}!${cell}`;
    labels[key] = { diyLabel, glMapping, unit };
  }
  // The monthly P&L cells read for the VitalTax and Wages Forecast re-sums
  // are money too, so the comparator rounds them to the penny rather than
  // comparing the two engines' float noise exactly.
  for (const cell of monthlyProfitAndLossCells()) {
    const key = `Profit & Loss Acc!${cell}`;
    if (!labels[key]) labels[key] = { diyLabel: "", glMapping: "", unit: "money" };
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
    { label: "Add other business income (box 10)", cell: "SE Short!O38", value: num(seShort.O38) },
    { label: "Less net loss for the year (box 22)", cell: "SE Short!O71", value: -num(seShort.O71) },
    { label: "Less annual investment allowance (box 23)", cell: "SE Short!D80", value: -num(seShort.D80) },
    { label: "Less small-balance allowance (box 24)", cell: "SE Short!D85", value: -num(seShort.D85) },
    { label: "Less other capital allowances (box 25)", cell: "SE Short!O80", value: -num(seShort.O80) },
    { label: "Add balancing charges (box 26)", cell: "SE Short!O85", value: num(seShort.O85) },
    { label: "Add goods and services for own use (box 27)", cell: "SE Short!D94", value: num(seShort.D94) },
    { label: "Add other business income (box 30)", cell: "SE Short!O99", value: num(seShort.O99) },
    { label: "Less loss brought forward (box 29)", cell: "SE Short!O94", value: -num(seShort.O94) },
  ];

  return buildProfitBridge(rows, `${TAX_SHEET}!E5`, num(tax.E5));
}

// ── Compliance checks ──────────────────────────────────────────────────────

export function checkCompliance(results, expected, taxData, calculateExpectedTax) {
  const checks = [];

  function check(name, actual, expectedVal, tolerance = 1) {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal, tolerance });
  }

  // Some of the workbook's own cells hold wording rather than arithmetic.
  // The report shows both sides as text and the diff column stays empty.
  function checkText(name, actual, expectedText) {
    checks.push({ name, actual, expected: expectedText, pass: actual === expectedText, diff: "" });
  }

  const pl = results["Profit & Loss Acc"];
  if (expected.total_sales !== undefined) check("Total Sales", pl.B5, expected.total_sales);
  if (expected.total_other_income !== undefined) check("Other business income", pl.B24, expected.total_other_income);
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
      check(`VitalTax: Q${q + 1} other income = P&L Q${q + 1} other income`, vt[`${vtCol}6`] || 0, plQuarterSum(24, months));
      check(
        `VitalTax: Q${q + 1} total allowable expenses = P&L Q${q + 1} Cost of Sales + Total Expenses`,
        vt[`${vtCol}29`] || 0,
        plQuarterSum(12, months) + plQuarterSum(22, months),
      );
    }
    check("VitalTax: annual turnover = P&L annual turnover", vt.G5 || 0, pl.B5 || 0);
    check("VitalTax: annual other income = P&L annual other income", vt.G6 || 0, pl.B24 || 0);
    check("VitalTax: annual total allowable expenses = P&L Cost of Sales + Total Expenses", vt.G29 || 0, (pl.B12 || 0) + (pl.B22 || 0));
  }

  // Every coded purchase must reach an account. The general expense codes land
  // in the P&L total, the four vehicle running-cost codes accumulate in the
  // Purchases sheets' year-to-date column I2, and code "f" capitalises into T1
  // instead of the P&L. Anything the workbook drops shows up as a shortfall
  // here even though every total on its own still adds up.
  const purchases = results.PurchasesMar;
  if (expected.purchases && purchases) {
    // A mileage-log entry buys nothing, so it is not among the purchases that
    // have to reach a money column: the sheet is given its miles and prices
    // the claim itself, which the mileage checks below cover.
    const cashPurchases = Object.values(expected.purchases)
      .flat()
      .filter((tx) => !tx.mileage);
    const journalTotal = cashPurchases.reduce((s, tx) => s + tx.amount, 0);
    const accountedFor = (pl.B22 || 0) + (purchases.I2 || 0) + (purchases.T1 || 0);
    check("Purchases: cash journal total = general expenses + vehicle running costs + capitalised vehicles", accountedFor, journalTotal);
  }

  // The mileage route. The workbook prices the year's business miles at the
  // approved rates and charges that claim in place of the running costs and
  // capital allowances whenever it comes to more. Both sides are recomputed
  // here from the scenario's own miles and the tax year's rates, so a package
  // that drops the miles on the way in cannot pass.
  const scheduleAllowance = results["Fixed Assets"]
    ? (results["Fixed Assets"].I1 || 0) +
      (results["Fixed Assets"].J1 || 0) +
      (results["Fixed Assets"].P1 || 0) -
      (results["Fixed Assets"].Q1 || 0)
    : 0;
  const businessMiles = expected.total_mileage || 0;
  const mileageClaim = taxData ? calculateMileageAllowance(businessMiles, taxData.mileage) : 0;
  const takesMileageRoute = Math.round(mileageClaim) > Math.round((purchases?.I2 || 0) + scheduleAllowance);
  if (taxData && businessMiles && purchases) {
    check("Purchases: business miles carried = the journals' miles", purchases.A1 || 0, businessMiles, 0);
    check("Purchases: mileage claimed = those miles at the tax year's approved rates", purchases.A2 || 0, mileageClaim, 0.01);
    check(
      "P&L: Mileage Allowance = the claim when it beats running the vehicle",
      pl.B11 || 0,
      takesMileageRoute ? Math.ceil(mileageClaim) : 0,
    );
  }

  // The sheet's own comparison figure (Profit & Loss Acc!J1) and the route
  // cell it drives (C1) are read straight off the sheet here, independently
  // of the fixture's own miles, so corrupting either one, or the Purchases
  // and Fixed Assets cells J1 is built from, breaks its own check and
  // nothing else.
  if (purchases && pl.J1 !== undefined) {
    check(
      "P&L: the comparison figure = running costs plus the schedule's allowances",
      pl.J1,
      Math.round((purchases.I2 || 0) + scheduleAllowance),
      0,
    );
    const sheetRoute = Math.round(purchases.A2 || 0) > pl.J1 ? "MILEAGE ALLOWANCE" : "";
    checkText("P&L: the route follows the comparison", String(pl.C1 ?? "").trim(), sheetRoute);
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
    // Box 30 (verified against the template: 'SE Short'!O99 = 'Profit & Loss
    // Acc'!B24), the same other-business-income figure VitalTax's own
    // annual re-sum is checked against above.
    if (seShort.O99 !== undefined) check("SA103S: Other business income (box 30) = P&L other income", seShort.O99, pl.B24 || 0);
  }

  // Fixed asset chain: Fixed Assets sheet -> P&L Capital Allowances (B10).
  // Taxi vehicles under £12,000 claim a Writing Down Allowance at the main
  // rate, not the 100% AIA BST's non-vehicle assets get -- the expected
  // allowance is recomputed independently from the read-back Admin rate, so
  // this check also stands in as the Admin-echo check for that cell.
  const expectedAdditions = fixedAssetAdditions(expected, "f");
  if (expectedAdditions.length > 0 && results["Fixed Assets"]) {
    const fa = results["Fixed Assets"];
    const assetCost = expectedAdditions.reduce((s, a) => s + a.cost, 0);
    check("Fixed Assets: New asset cost recorded", fa.D47 || 0, expected.fixed_asset_cost ?? assetCost);
    check("Fixed Assets: written-down value = cost less the allowance", fa.K1 || 0, assetCost - (fa.J1 || 0), 0);

    if (results.Admin) {
      const wdaRate = results.Admin.G5;
      const expectedWda = (fa.D47 || 0) * wdaRate;
      check("Fixed Assets: WDA claimed = cost x Admin WDA rate", fa.J1 || 0, expectedWda);
    }

    // The P&L charges the schedule's allowance only on the actual-cost route:
    // on the mileage route B10 reads IF(C1="mileage allowance",0,...) and the
    // claim is charged at B11 instead.
    check(
      "Fixed Assets: Schedule capital allowance total = P&L Capital Allowances",
      pl.B10 || 0,
      takesMileageRoute ? 0 : (fa.I1 || 0) + (fa.J1 || 0) + (fa.P1 || 0) - (fa.Q1 || 0),
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

      // Each payment on account is half the liability the sheet itself
      // charges, read independently of any expected figure so a wrong split
      // between the two halves fails on its own.
      if (tax.E25 !== undefined) check("Tax: first payment on account is half the liability", tax.E25, (tax.E17 || 0) / 2, 0.01);
      if (tax.E26 !== undefined) check("Tax: second payment on account is half the liability", tax.E26, (tax.E17 || 0) / 2, 0.01);

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
      // against the P&L's own monthly turnover, and the fixture states the
      // count the book itself makes so the sheet is not the only witness.
      const monthsTraded = MONTH_COLS.filter((col) => (pl[`${col}5`] || 0) > 0).length;
      check("Forecast: months of actual trade = P&L months with turnover", forecast.C19 || 0, monthsTraded, 0);
      if (expected.months_traded !== undefined)
        check("Forecast: months of actual trade = the fixture's", forecast.C19 || 0, expected.months_traded, 0);

      // A month that traded is repeated as it stands and a month that did not
      // takes the year's own figure divided by the months that did, except
      // for capital allowances: the year claims those once however few months
      // it traded, so the sheet lifts them out of the year's cost of sales
      // before spreading it and gives every projected month a twelfth of the
      // allowance back (verified against the template: 'Wages Forecast'!D24 =
      // IF($C5>0,IF(D5>0,D9,($C9-'Profit & Loss Acc'!$B10)/$C19+'Profit &
      // Loss Acc'!$B10/12),0), against D20's and D28's plain $C/$C19 spread).
      // A year with no turnover at all forecasts nil, which is the outer
      // IF(C5>0,...) on every one of those rows.
      const spread = (row, claimedOnceInTheYear = 0) => {
        if (monthsTraded === 0) return 0;
        const spreadMonth = (monthTotal(row) - claimedOnceInTheYear) / monthsTraded + claimedOnceInTheYear / 12;
        return MONTH_COLS.reduce((sum, col) => sum + ((pl[`${col}5`] || 0) > 0 ? pl[`${col}${row}`] || 0 : spreadMonth), 0);
      };
      check("Forecast: turnover = the traded months plus the year spread over the rest", forecast.C20 || 0, spread(5));
      check("Forecast: cost of sales = the traded months plus the year spread over the rest", forecast.C24 || 0, spread(12, pl.B10 || 0));
      check("Forecast: general expenses = the traded months plus the year spread over the rest", forecast.C28 || 0, spread(22));
      // Other income is the one row the forecast reads straight through, with
      // no spread of its own (verified against the template: D22 = D7).
      check("Forecast: other business income = P&L other business income", forecast.C22 || 0, monthTotal(24));

      if (monthsTraded === MONTH_COLS.length) {
        check("Forecast: turnover = P&L turnover", forecast.C20 || 0, monthTotal(5));
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
