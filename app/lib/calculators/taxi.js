// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi.js — JS calculation engine for the Taxi Driver product.

import {
  TAXI_SALES_ACCOUNT,
  TAXI_OTHER_INCOME_ACCOUNT,
  TAXI_PURCHASE_CODE_MAP,
  MONTH_ORDER,
  getMonthKey,
  buildTaxMonthByDate,
} from "../scenario-extractor.js";
import { fixedAssetAdditions } from "../scenario-loader.js";
import { calculateIncomeTax } from "../tax/income-tax.js";
import { calculateNIClass4 } from "../tax/national-insurance.js";
import { calculateMileageAllowance } from "../tax/mileage.js";
import { aggregateByCode } from "./shared.js";

// P&L monthly columns, Apr through Mar (matches app/products/taxi.js's own
// MONTH_COLS, verified against the template: 'Profit & Loss Acc'!C2:N2 read
// the Admin month-end dates in that order).
const MONTH_COLS = {
  apr: "C",
  may: "D",
  jun: "E",
  jul: "F",
  aug: "G",
  sep: "H",
  oct: "I",
  nov: "J",
  dec: "K",
  jan: "L",
  feb: "M",
  mar: "N",
};

// The Fixed Assets schedule. Every capital addition lands in the "Vehicles
// under £12,000 bought after" block regardless of what it actually is (see
// cellWrites in app/products/taxi.js), and that block only ever claims a
// Writing Down Allowance at the main rate -- never Annual Investment
// Allowance (verified against the template: Fixed Assets!J47 =
// IF(D47>0,D47*J$4*(1-F47)," "), with no AIA formula anywhere on this
// block).
// Business miles a line records: the distance a fare day was driven, or the
// distance a mileage-log entry claims at the approved rate. cellWrites gives
// the sheet the miles, and on a purchase gives them instead of the amount --
// a mileage-log entry buys nothing, its whole expense is the claim.
function carriesBusinessMiles(line) {
  return line.measurableUnitOfMeasure === "miles" && typeof line.measurableQuantity === "number";
}

function calculateFixedAssetSchedule(additions, taxData) {
  const wdaRate = taxData.capital_allowances.writing_down_allowance;
  const schedule = { D47: 0, I1: 0, J1: 0, K1: 0, P1: 0, Q1: 0 };
  additions.forEach((asset, index) => {
    const wda = asset.cost * wdaRate;
    schedule.J1 += wda;
    schedule.K1 += asset.cost - wda;
    if (index === 0) schedule.D47 = asset.cost;
  });
  return schedule;
}

// The SE Short capital allowance chain (verified against the template: 'SE
// Short'!D80 = IF(I1>0,I1,0), O80 = IF((J1+P1)>0,J1+P1,0), D85 =
// IF((K1+J1)<1000,K1,0), O85 = IF(Q1>0,Q1,0)), and the Profit & Loss
// account's own Capital Allowances line (B10 = FixedAssets!I1+J1+P1-Q1,
// when the mileage allowance is not the route taken).
function seShortCapitalAllowances(fa) {
  const d80 = fa.I1 > 0 ? fa.I1 : 0;
  const o80 = fa.J1 + fa.P1 > 0 ? fa.J1 + fa.P1 : 0;
  const d85 = fa.K1 + fa.J1 < 1000 ? fa.K1 : 0;
  const o85 = fa.Q1 > 0 ? fa.Q1 : 0;
  return { d80, o80, d85, o85 };
}

// Group purchase amounts by code letter and month, for the Purchases
// sheets' own year-to-date-by-month structure that the P&L's monthly
// columns and VitalTax's quarterly re-sum both read from. cellWrites writes
// a purchase to the sheet named after its plain calendar month (it groups
// by the same getMonthKey() the scenario's own purchases table uses), not
// the week-based tab sales use, so a purchase dated just before the tax
// year's own 6 April start still lands somewhere.
function aggregateByCodeAndMonth(lines, codeMap) {
  const byMonth = {};
  for (const month of MONTH_ORDER) byMonth[month] = {};
  for (const line of lines) {
    const code = codeMap[line.accountMainID];
    if (!code) continue;
    const month = getMonthKey(line.postingDate);
    byMonth[month][code] = (byMonth[month][code] || 0) + line.amount;
  }
  return byMonth;
}

export function calculateTaxiResults(book, lines, taxData, scenario) {
  const salesLines = lines.filter((l) => l.sourceJournalID === "sales" && String(l.accountMainID) === TAXI_SALES_ACCOUNT);
  // A 4001 line is other business income, never a fare: the P&L keeps it off
  // turnover (B5) and on its own row (B24), so it is gathered separately
  // rather than folded into salesLines the way a second fare account would
  // be on a package with more than one turnover account.
  const otherIncomeLines = lines.filter((l) => l.sourceJournalID === "sales" && String(l.accountMainID) === TAXI_OTHER_INCOME_ACCOUNT);
  const purchaseLines = lines.filter((l) => l.sourceJournalID === "purchases" && TAXI_PURCHASE_CODE_MAP[l.accountMainID] !== undefined);

  const entity = book.entityInformation || {};
  const biz = scenario.business || {};

  // The book's own accounting period always opens on 6 April, so its year
  // is the tax year every posting's week-based month tab is drawn from.
  const startYear = new Date(book.documentInfo.periodCoveredStart).getUTCFullYear();
  const byDate = buildTaxMonthByDate(startYear);

  // A mileage-log entry buys nothing: cellWrites gives the sheet its miles
  // rather than its amount, so it never reaches a running-cost column.
  const cashPurchaseLines = purchaseLines.filter((l) => !carriesBusinessMiles(l));
  const byCode = aggregateByCode(cashPurchaseLines, TAXI_PURCHASE_CODE_MAP);
  const byCodeAndMonth = aggregateByCodeAndMonth(cashPurchaseLines, TAXI_PURCHASE_CODE_MAP);

  const totalSales = Math.floor(salesLines.reduce((s, l) => s + l.amount, 0));
  const monthlySales = {};
  for (const month of MONTH_ORDER) monthlySales[month] = 0;
  for (const line of salesLines) monthlySales[byDate.get(line.postingDate)] += line.amount;

  // Other business income, month by month on the same week-based tab a
  // fare's date falls in -- the Sales tab's rental and other-income rows
  // belong to a week exactly as a fare day does.
  const monthlyOther = {};
  for (const month of MONTH_ORDER) monthlyOther[month] = 0;
  for (const line of otherIncomeLines) monthlyOther[byDate.get(line.postingDate)] += line.amount;

  // Capital allowances, from the fixed asset register cellWrites registers
  // (the same additions cellWrites itself derives via fixedAssetAdditions()).
  const assetAdditions = fixedAssetAdditions(scenario, "f");
  const fa = calculateFixedAssetSchedule(assetAdditions, taxData);
  const seShortCA = seShortCapitalAllowances(fa);
  const capitalAllowances = fa.I1 + fa.J1 + fa.P1 - fa.Q1;

  // Business miles, month by month, on the tabs cellWrites lays the entries
  // out on: a fare day's miles beside its takings on the week-based Sales tab
  // its date falls in, a mileage-log purchase's on the plain calendar month.
  const milesByMonth = {};
  for (const month of MONTH_ORDER) milesByMonth[month] = 0;
  for (const line of salesLines) {
    if (carriesBusinessMiles(line)) milesByMonth[byDate.get(line.postingDate)] += line.measurableQuantity;
  }
  for (const line of purchaseLines) {
    if (carriesBusinessMiles(line)) milesByMonth[getMonthKey(line.postingDate)] += line.measurableQuantity;
  }
  const businessMiles = MONTH_ORDER.reduce((sum, month) => sum + milesByMonth[month], 0);
  const mileageClaim = calculateMileageAllowance(businessMiles, taxData.mileage);

  // Each month's share of that claim, as the sheet bands it off the running
  // mileage total: the claim to date less the claim the months before it
  // already made (verified against the template: PurchasesMay!U4 =
  // IF(A1<Admin!$F$22,(A1-PurchasesApr!A1)*Admin!$G$21, A1*G21-(A1-F21)*(G21-G22)-PurchasesApr!A2)).
  const monthlyMileageClaim = {};
  let milesToDate = 0;
  let claimToDate = 0;
  for (const month of MONTH_ORDER) {
    milesToDate += milesByMonth[month];
    const claim = calculateMileageAllowance(milesToDate, taxData.mileage);
    monthlyMileageClaim[month] = claim - claimToDate;
    claimToDate = claim;
  }

  // The sheet weighs the mileage claim against what the vehicle actually cost
  // to run and charges one of them, never both (verified against the template:
  // 'Profit & Loss Acc'!B1 = ROUND(PurchasesMar!$A$2,0), the year's claim;
  // J1 = ROUND(PurchasesMar!$I$2 + the Fixed Assets allowances,0); C1 =
  // IF(B1>J1,"MILEAGE ALLOWANCE"," "), which every running-cost line reads as
  // IF(C1="mileage allowance",0,...) and the mileage line reads the other way).
  const vehicleRunningCosts = (byCode.d || 0) + (byCode.h || 0) + (byCode.r || 0) + (byCode.t || 0);
  const takesMileageRoute = Math.round(mileageClaim) > Math.round(vehicleRunningCosts + capitalAllowances);

  // Vehicle running costs: fuel, car hire, repairs and servicing, road tax
  // and insurance (verified against the template: Profit & Loss Acc!B6:B9,
  // each ROUNDUP(SUM(...month columns...),0)).
  const fuel = takesMileageRoute ? 0 : Math.ceil(byCode.d || 0);
  const carHire = takesMileageRoute ? 0 : Math.ceil(byCode.h || 0);
  const repairsServicing = takesMileageRoute ? 0 : Math.ceil(byCode.r || 0);
  const roadTaxInsurance = takesMileageRoute ? 0 : Math.ceil(byCode.t || 0);
  const capitalAllowancesCharged = takesMileageRoute ? 0 : capitalAllowances;
  const mileageAllowance = takesMileageRoute ? Math.ceil(mileageClaim) : 0;

  const totalVehicleCosts = fuel + carHire + repairsServicing + roadTaxInsurance;
  const costOfSales = Math.ceil(totalVehicleCosts + capitalAllowancesCharged + mileageAllowance);
  const grossProfit = Math.floor(totalSales - costOfSales);

  // General expenses
  const employee = Math.ceil(byCode.e || 0);
  const premises = Math.ceil(byCode.p || 0);
  const genAdmin = Math.ceil(byCode.g || 0);
  const advertising = Math.ceil(byCode.a || 0);
  const legal = Math.ceil(byCode.l || 0);
  const interest = Math.ceil(byCode.i || 0);
  const bankCharges = Math.ceil(byCode.b || 0);
  const otherExpenses = Math.ceil(byCode.o || 0);
  const totalGenExpenses = Math.ceil(employee + premises + genAdmin + advertising + legal + interest + bankCharges + otherExpenses);
  const netProfit = Math.floor(grossProfit - totalGenExpenses);
  // "Any other business income" (B24), verified against the template:
  // 'Profit & Loss Acc'!B24 = ROUNDDOWN(SUM(C24:N24),0), the same floor the
  // turnover total (B5) takes over its own monthly row.
  const otherBusinessIncome = Math.floor(MONTH_ORDER.reduce((sum, month) => sum + monthlyOther[month], 0));

  // SE Short (SA103S), computed ahead of the Draft Tax calculation sheet
  // because that sheet's own profit input reads this form's box 28
  // (verified against the template: 'Draft Tax calculation'!E5 = 'SE
  // Short'!D106). D71 (box 21, HMRC's pre-capital-allowance profit) adds
  // the capital allowances the P&L already charged inside cost of sales
  // back in (verified: 'SE Short'!O64 = P&L!B12+B22-B10). O38 (box 10) is a
  // manual entry with no formula at all and no cached value on the sheet in
  // any fixture, unlike O99 (box 30), which does carry a real formula
  // reading P&L!B24.
  const o64 = costOfSales + totalGenExpenses - capitalAllowancesCharged;
  const seShortOtherIncomeBox10 = 0;
  const seShortNetProfitRaw = totalSales + seShortOtherIncomeBox10 - o64;
  const seShortNetProfit = Math.max(0, seShortNetProfitRaw);
  const seShortNetLoss = Math.max(0, -seShortNetProfitRaw);
  const seShortD99Raw = seShortNetProfit + seShortCA.o85 + 0 /* box 27 */ - seShortNetLoss - seShortCA.d80 - seShortCA.d85 - seShortCA.o80;
  const seShortD99 = Math.max(0, seShortD99Raw);
  const seShortOtherIncomeBox30 = otherBusinessIncome; // O99 = P&L!B24
  const seShortD106 = Math.max(0, seShortD99 + seShortOtherIncomeBox30 - 0 /* loss brought forward */);

  // Draft Tax calculation
  const { personalAllowance, taxableIncome, basicRateTax, higherRateTax, additionalRateTax, totalIncomeTax } = calculateIncomeTax(
    seShortD106,
    taxData.income_tax,
  );
  const { lowerBand: niLower, upperBand: niUpper } = calculateNIClass4(seShortD106, taxData.national_insurance);
  const totalTaxAndNI = totalIncomeTax + niLower + niUpper;

  const results = {
    "Business Details": {
      C5: biz.name || entity.organizationIdentifier || "",
      C8: biz.description || entity.organizationDescription || "",
      // C17 and O5 are set below, once they are known. D29 and O29 have no
      // book field and stay unset: cellWrites never writes them, so the
      // sheet's own cells are blank rather than nil.
    },
    "Profit & Loss Acc": {
      B5: totalSales,
      B6: fuel,
      B7: carHire,
      B8: repairsServicing,
      B9: roadTaxInsurance,
      B10: Math.round(capitalAllowancesCharged * 100) / 100,
      B11: mileageAllowance,
      B12: costOfSales,
      B13: grossProfit,
      B14: employee,
      B15: premises,
      B16: genAdmin,
      B17: advertising,
      B18: legal,
      B19: interest,
      B20: bankCharges,
      B21: otherExpenses,
      B22: totalGenExpenses,
      B23: netProfit,
      B24: otherBusinessIncome,
      // The sheet's own comparison figure (J1), always present whichever
      // route the sheet takes -- it is what C1 below is decided against.
      J1: Math.round(vehicleRunningCosts + capitalAllowances),
    },
    "VitalTax": {},
    "SE Short": {
      D38: totalSales,
      // O38 (box 10) is a permanently blank manual entry — left unset.
      D71: seShortNetProfit,
      O71: seShortNetLoss,
      D80: Math.round(seShortCA.d80 * 100) / 100,
      O80: Math.round(seShortCA.o80 * 100) / 100,
      D85: Math.round(seShortCA.d85 * 100) / 100,
      O85: Math.round(seShortCA.o85 * 100) / 100,
      // D94 reads 'Business Details'!O29 (goods and services for own use)
      // and O94 reads 'Business Details'!D29 (losses brought forward); the
      // book has no field for either, cellWrites never writes them, and the
      // sheet's own values stay nil, same as here.
      D94: 0,
      D99: seShortD99,
      O94: 0,
      O99: seShortOtherIncomeBox30,
      D106: seShortD106,
    },
    "Draft Tax calculation": {
      E5: seShortD106,
      E6: personalAllowance,
      E7: taxableIncome,
      D8: taxData.income_tax.basic_rate,
      C9: taxData.income_tax.basic_band_end,
      E8: basicRateTax,
      D9: taxData.income_tax.higher_rate,
      E9: higherRateTax,
      C10: taxData.income_tax.higher_band_end,
      D10: taxData.income_tax.additional_rate,
      E10: additionalRateTax,
      E11: totalIncomeTax,
      E14: niLower,
      E15: niUpper,
      E17: totalTaxAndNI,
      E25: totalTaxAndNI / 2,
      E26: totalTaxAndNI / 2,
    },
    "Fixed Assets": {},
    "PurchasesMar": {
      // The running mileage total the comparison is made on, and the claim
      // banded out of it (verified against the template: PurchasesMar!A1 =
      // E1+SalesMar!$D$1+PurchasesFeb!A1, A2 = U1+PurchasesFeb!A2).
      A1: businessMiles,
      A2: Math.round(mileageClaim * 100) / 100,
      I2: vehicleRunningCosts,
      T1: Math.round(assetAdditions.reduce((sum, asset) => sum + asset.cost, 0) * 100) / 100,
    },
    "Admin": {
      N4: taxData.income_tax.personal_allowance,
      N5: taxData.income_tax.personal_allowance_taper_threshold,
      N6: taxData.income_tax.basic_rate,
      N7: taxData.income_tax.higher_rate,
      N8: taxData.income_tax.additional_rate,
      M11: taxData.income_tax.basic_band_end,
      N12: taxData.income_tax.higher_band_start,
      N13: taxData.income_tax.higher_band_end,
      L16: taxData.national_insurance.class2_weekly_rate,
      L20: taxData.national_insurance.class4_lower_rate,
      N20: taxData.national_insurance.class4_lower_limit,
      L23: taxData.national_insurance.class4_upper_rate,
      N23: taxData.national_insurance.class4_upper_limit,
      G4: taxData.capital_allowances.annual_investment_allowance,
      G5: taxData.capital_allowances.writing_down_allowance,
      F21: taxData.mileage.higher_rate_limit,
      G21: taxData.mileage.higher_rate_pence,
      F22: taxData.mileage.lower_rate_start,
      G22: taxData.mileage.lower_rate_pence,
      F26: taxData.vat.registration_threshold,
    },
  };

  if (biz.postcode) results["Business Details"].C17 = biz.postcode;
  if (biz.utr) results["Business Details"].O5 = biz.utr;

  // The sheet's own " " reads as nothing once trimmed, so the route cell is
  // left unset rather than carrying that space across.
  if (takesMileageRoute) results["Profit & Loss Acc"].C1 = "MILEAGE ALLOWANCE";

  if (assetAdditions.length > 0) {
    results["Fixed Assets"].D47 = fa.D47;
    results["Fixed Assets"].I1 = Math.round(fa.I1 * 100) / 100;
    results["Fixed Assets"].J1 = Math.round(fa.J1 * 100) / 100;
    results["Fixed Assets"].K1 = Math.round(fa.K1 * 100) / 100;
    results["Fixed Assets"].P1 = Math.round(fa.P1 * 100) / 100;
    results["Fixed Assets"].Q1 = Math.round(fa.Q1 * 100) / 100;
  }

  // P&L monthly columns (rows 5, 12, 22 and 24 — the four rows VitalTax's
  // quarterly re-sum and the Wages Forecast both read a month at a time).
  const monthlyCapitalAllowance = capitalAllowancesCharged / 12;
  for (const month of MONTH_ORDER) {
    const col = MONTH_COLS[month];
    const codes = byCodeAndMonth[month];
    const monthVehicleCosts = (codes.d || 0) + (codes.h || 0) + (codes.r || 0) + (codes.t || 0);
    const monthGenExpenses =
      (codes.e || 0) + (codes.p || 0) + (codes.g || 0) + (codes.a || 0) + (codes.l || 0) + (codes.i || 0) + (codes.b || 0) + (codes.o || 0);
    results["Profit & Loss Acc"][`${col}5`] = Math.floor(monthlySales[month]);
    const monthCostOfSales = takesMileageRoute ? monthlyMileageClaim[month] : monthVehicleCosts + monthlyCapitalAllowance;
    results["Profit & Loss Acc"][`${col}12`] = Math.round(monthCostOfSales * 100) / 100;
    results["Profit & Loss Acc"][`${col}22`] = Math.ceil(monthGenExpenses);
    // The sheet's own monthly other-income cell reads SalesXxx!$F$1 straight
    // through with no ROUND wrapping it, unlike B24's own floor -- verified
    // against the template: 'Profit & Loss Acc'!C24 = SalesApr!$F$1.
    results["Profit & Loss Acc"][`${col}24`] = Math.round(monthlyOther[month] * 100) / 100;
  }

  // VitalTax's quarterly re-sum (verified against the template: VitalTax!C5
  // = SUM('Profit & Loss Acc'!C5:E5) through F5 = SUM(L5:N5), G5 =
  // SUM(C5:F5); row 29 reduces, over its own internal per-line copies, to
  // the same quarter's Cost of Sales plus Total Expenses).
  const quarterGroups = [
    ["apr", "may", "jun"],
    ["jul", "aug", "sep"],
    ["oct", "nov", "dec"],
    ["jan", "feb", "mar"],
  ];
  const vtCols = ["C", "D", "E", "F"];
  const pl = results["Profit & Loss Acc"];
  let annualTurnover = 0;
  let annualOther = 0;
  let annualExpenses = 0;
  quarterGroups.forEach((months, q) => {
    const turnover = months.reduce((s, m) => s + (pl[`${MONTH_COLS[m]}5`] || 0), 0);
    const other = months.reduce((s, m) => s + (pl[`${MONTH_COLS[m]}24`] || 0), 0);
    const expenses = months.reduce((s, m) => s + (pl[`${MONTH_COLS[m]}12`] || 0) + (pl[`${MONTH_COLS[m]}22`] || 0), 0);
    results.VitalTax[`${vtCols[q]}5`] = turnover;
    results.VitalTax[`${vtCols[q]}6`] = Math.round(other * 100) / 100;
    results.VitalTax[`${vtCols[q]}29`] = Math.round(expenses * 100) / 100;
    annualTurnover += turnover;
    annualOther += other;
    annualExpenses += expenses;
  });
  results.VitalTax.G5 = annualTurnover;
  results.VitalTax.G6 = Math.round(annualOther * 100) / 100;
  results.VitalTax.G29 = Math.round(annualExpenses * 100) / 100;

  // Wages Forecast — the projected year the customer plans drawings
  // against. The sheet repeats a month that traded and spreads the year's
  // own totals across the months that did not, so a driver who traded all
  // twelve months forecasts the year just gone and one who started in
  // October forecasts twice what he took (verified against the template:
  // 'Wages Forecast'!C19 = SUM(D19:O19) over D19 = IF(D5>0,1," "); D20 =
  // IF(C5>0,IF(D5>0,D5,C5/C19),0); D22 = D7; D24 = IF($C5>0,IF(D5>0,D9,
  // ($C9-'Profit & Loss Acc'!$B10)/$C19+'Profit & Loss Acc'!$B10/12),0);
  // D28 = IF($C5>0,IF(D5>0,D13,$C13/$C19),0); D26 = D20+D22-D24; D30 =
  // D26-D28; C20 to C30 each sum their own row).
  const monthTotal = (row) => MONTH_ORDER.reduce((sum, month) => sum + (pl[`${MONTH_COLS[month]}${row}`] || 0), 0);
  const monthsTraded = MONTH_ORDER.filter((month) => (pl[`${MONTH_COLS[month]}5`] || 0) > 0).length;
  results["Wages Forecast"] = { C19: monthsTraded };
  if (monthsTraded > 0) {
    const forecast = results["Wages Forecast"];
    const yearTurnover = monthTotal(5);
    const yearOtherIncome = monthTotal(24);
    const yearCostOfSales = monthTotal(12);
    const yearGenExpenses = monthTotal(22);
    // Capital allowances are the one cost the spread leaves alone. The
    // year claims them once however few months it traded, so the sheet
    // lifts them out of the year's cost of sales, spreads what is left
    // over the months that traded, and gives every month of the projected
    // year a twelfth of the allowance back.
    const spreadCostOfSales = (yearCostOfSales - (pl.B10 || 0)) / monthsTraded + (pl.B10 || 0) / 12;
    let projectedTurnover = 0;
    let projectedCostOfSales = 0;
    let projectedGenExpenses = 0;
    for (const month of MONTH_ORDER) {
      const col = MONTH_COLS[month];
      const traded = (pl[`${col}5`] || 0) > 0;
      projectedTurnover += traded ? pl[`${col}5`] : yearTurnover / monthsTraded;
      projectedCostOfSales += traded ? pl[`${col}12`] : spreadCostOfSales;
      projectedGenExpenses += traded ? pl[`${col}22`] : yearGenExpenses / monthsTraded;
    }
    // Other income is the one row with no spread of its own: the forecast
    // month reads the actual month straight through, so a year that traded
    // six months forecasts the same other income it took.
    forecast.C20 = Math.round(projectedTurnover * 100) / 100;
    forecast.C22 = Math.round(yearOtherIncome * 100) / 100;
    forecast.C24 = Math.round(projectedCostOfSales * 100) / 100;
    forecast.C28 = Math.round(projectedGenExpenses * 100) / 100;
    forecast.C30 = Math.round((projectedTurnover + yearOtherIncome - projectedCostOfSales - projectedGenExpenses) * 100) / 100;
    forecast.C34 = forecast.C30; // C33, the financial-health check's own manual cell, is nil in every fixture
    const forecastIncomeTax = calculateIncomeTax(forecast.C34, taxData.income_tax);
    const forecastNI = calculateNIClass4(forecast.C34, taxData.national_insurance);
    forecast.C35 = forecastIncomeTax.personalAllowance;
    forecast.C36 = forecastIncomeTax.taxableIncome;
    forecast.C37 = forecastIncomeTax.basicRateTax;
    forecast.C38 = forecastIncomeTax.higherRateTax;
    forecast.C39 = forecastIncomeTax.additionalRateTax;
    forecast.C40 = forecastNI.total;
    forecast.C41 = forecastIncomeTax.totalIncomeTax + forecastNI.total;
  }

  return results;
}
