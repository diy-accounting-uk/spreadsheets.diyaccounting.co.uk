// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi.js — Taxi Driver product definition.
// Owns column mappings, cell references, compliance checks, date-lookup logic.
// Calls shared tools from app/lib/.

import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { generateTaxYearWeeks, groupWeeksIntoMonths, toExcelSerial as dateToSerial } from "../lib/generator.js";
import { parseDate, MONTH_SHEETS, extractTaxYearStart } from "../lib/scenario-loader.js";

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
  if (scenario.fixed_asset_additions) {
    if (!writes["Fixed Assets"]) writes["Fixed Assets"] = {};
    const fa = writes["Fixed Assets"];
    let row = 47;
    for (const asset of scenario.fixed_asset_additions) {
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
  // ── SE Short (SA103S) — formula cells only ──
  ["SE Short", "D38",  "Turnover",                       "gl-cor:amount (sa103s.turnover)",           "Self Assessment (SA103S)", 0],
  ["SE Short", "D71",  "**Net profit/loss**",            "gl-cor:amount (sa103s.netProfit)",          "Self Assessment (SA103S)", 0],
  ["SE Short", "D106", "**Net profit for tax calc**",    "gl-cor:amount (sa103s.profitForTax)",       "Self Assessment (SA103S)", 0],
  // ── Draft Tax Calculation ──
  [TAX_SHEET, "E5",  "Profit from Self Employment",  "gl-cor:amount (profitSE)",             "Draft Tax Calculation", 0],
  [TAX_SHEET, "E6",  "Less: Personal Allowance",     "tax.incomeTax.personalAllowance",      "Draft Tax Calculation", 1],
  [TAX_SHEET, "E7",  "Taxable Income",               "gl-cor:amount (taxableIncome)",        "Draft Tax Calculation", 0],
  [TAX_SHEET, "E8",  "Tax at Basic Rate (20%)",      "tax.incomeTax.basicRate",              "Draft Tax Calculation", 1],
  [TAX_SHEET, "E9",  "Tax at Higher Rate (40%)",     "tax.incomeTax.higherRate",             "Draft Tax Calculation", 1],
  [TAX_SHEET, "E10", "**Total Income Tax**",         "tax.incomeTax (total)",                "Draft Tax Calculation", 0],
  [TAX_SHEET, "E14", "NI Class 4 (lower band)",      "tax.nationalInsurance.class4MainRate", "Draft Tax Calculation", 1],
  [TAX_SHEET, "E15", "NI Class 4 (upper band)",      "tax.nationalInsurance.class4UpperRate","Draft Tax Calculation", 1],
  [TAX_SHEET, "E17", "**Total Tax + NI**",           "gl-cor:taxAmount (totalTaxNI)",        "Draft Tax Calculation", 0],
  // ── Fixed Assets schedule ──
  ["Fixed Assets", "D47", "New Asset Cost (Vehicle under £12,000)", "accounts.assets.fixedAssets (cost)",              "Fixed Assets", 1],
  ["Fixed Assets", "I1",  "Total Annual Investment Allowance",      "tax.capitalAllowances.aia (schedule)",            "Fixed Assets", 0],
  ["Fixed Assets", "J1",  "Total Writing Down Allowance",           "tax.capitalAllowances.wda (schedule)",            "Fixed Assets", 1],
  ["Fixed Assets", "P1",  "Total Capital Allowance on Disposal",    "tax.capitalAllowances.disposals (schedule)",      "Fixed Assets", 1],
  ["Fixed Assets", "Q1",  "Total Balancing Charge",                 "tax.capitalAllowances.balancingCharge (schedule)", "Fixed Assets", 1],
  // ── Admin (generator-injected tax data) ──
  ["Admin", "N4",  "Personal Allowance",                 "tax.incomeTax.personalAllowance",         "Admin (Generator Injected)", 0],
  ["Admin", "N7",  "Basic Rate",                          "tax.incomeTax.basicRate",                 "Admin (Generator Injected)", 0],
  ["Admin", "N8",  "Higher Rate",                         "tax.incomeTax.higherRate",                "Admin (Generator Injected)", 0],
  ["Admin", "M12", "Basic Band End",                      "tax.incomeTax.basicBandEnd",              "Admin (Generator Injected)", 0],
  ["Admin", "N13", "Higher Band Start",                   "tax.incomeTax.higherBandStart",           "Admin (Generator Injected)", 0],
  ["Admin", "L17", "NI Class 2 Rate",                     "tax.nationalInsurance.class2Rate",        "Admin (Generator Injected)", 0],
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

export function standardReads() {
  const reads = {};
  for (const [sheet, cell] of CELL_MAP) {
    if (!reads[sheet]) reads[sheet] = [];
    if (!reads[sheet].includes(cell)) reads[sheet].push(cell);
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
  if (expected.fixed_asset_additions && results["Fixed Assets"]) {
    const fa = results["Fixed Assets"];
    const assetCost = expected.fixed_asset_additions.reduce((s, a) => s + a.cost, 0);
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
    check("Admin: Basic Rate = tax data", admin.N7, it.basic_rate, 0.0001);
    check("Admin: Higher Rate = tax data", admin.N8, it.higher_rate, 0.0001);
    check("Admin: Basic Band End = tax data", admin.M12, it.basic_band_end);
    check("Admin: Higher Band Start = tax data", admin.N13, it.higher_band_start);
    check("Admin: NI Class 2 Rate = tax data", admin.L17, ni.class2_rate, 0.0001);
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

      check("Income Tax", tax.E10 || 0, expectedTax.income_tax);
      check("NI Class 4 (lower)", tax.E14 || 0, expectedTax.ni_class4_lower);
      check("Total Tax + NI", tax.E17 || 0, expectedTax.total_tax_and_ni);

      // Tax calculation chain (6c)
      check("Tax: Taxable = Profit - Allowance", tax.E7, (tax.E5 || 0) - (tax.E6 || 0));
      check("Tax: IT = Basic + Higher", tax.E10, (tax.E8 || 0) + (tax.E9 || 0));
      check("Tax: Total = IT + NI", tax.E17, (tax.E10 || 0) + (tax.E14 || 0) + (tax.E15 || 0));

      if (seShort && seShort.D106 !== undefined) check("SA103S: Profit for tax = Draft Tax E5", seShort.D106, tax.E5);
    }
  }

  return checks;
}
