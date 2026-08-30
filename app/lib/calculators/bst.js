// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst.js — JS calculation engine for the Basic Sole Trader product.
// Produces the same { "SheetName": { "CellRef": value } } shape a spreadsheet
// read returns, so app/products/bst.js's reportSections() and
// checkCompliance() work unchanged on either source.

import { BST_PURCHASE_CODE_MAP, BST_SALES_ACCOUNTS, MONTH_ORDER, getMonthKey } from "../scenario-extractor.js";
import { fixedAssetAdditions } from "../scenario-loader.js";
import { calculateIncomeTax } from "../tax/income-tax.js";
import { calculateNIClass4 } from "../tax/national-insurance.js";
import { calculateMileageAllowance, scenarioBusinessMiles } from "../tax/mileage.js";
import { aggregateByCode } from "./shared.js";

const BST_MONTH_COLS = {
  apr: "D",
  may: "E",
  jun: "F",
  jul: "G",
  aug: "H",
  sep: "I",
  oct: "J",
  nov: "K",
  dec: "L",
  jan: "M",
  feb: "N",
  mar: "O",
};

// The Fixed Assets schedule, for the additions cellWrites registers there.
// BST's new-assets block claims Annual Investment Allowance on every asset
// (verified against the template: Fixed Assets!K67 =
// IF(E67>0,E67*J67," ") where J67 = J$4 = Admin!G4, the AIA rate; there is
// no Writing Down Allowance formula on this block at all, unlike Taxi's
// vehicle block, so a cost the AIA rate does not fully cover is left as the
// schedule's own written down value and never separately claimed as WDA).
function calculateFixedAssetSchedule(additions, taxData) {
  const aiaRate = taxData.capital_allowances.annual_investment_allowance;
  const schedule = { E1: 0, K1: 0, L1: 0, M1: 0, Q1: 0, R1: 0 };
  additions.forEach((asset, index) => {
    const aia = asset.cost * aiaRate;
    schedule.E1 += asset.cost;
    schedule.K1 += aia;
    schedule.M1 += asset.cost - aia;
    if (index === 0) schedule.E67 = asset.cost;
  });
  return schedule;
}

// The SE Short capital allowance chain (verified against the template: 'SE
// Short'!D80 = IF(K1>0,K1,0), O80 = IF((L1+Q1)>0,L1+Q1,0), D85 =
// IF((M1+L1)<1000,M1,0), O85 = IF(R1>0,R1,0)), and the Profit & Loss
// account's own Capital Allowances line (C26 = -O85+D80+D85+O80), which
// this same chain feeds.
function seShortCapitalAllowances(fa) {
  const d80 = fa.K1 > 0 ? fa.K1 : 0;
  const o80 = fa.L1 + fa.Q1 > 0 ? fa.L1 + fa.Q1 : 0;
  const d85 = fa.M1 + fa.L1 < 1000 ? fa.M1 : 0;
  const o85 = fa.R1 > 0 ? fa.R1 : 0;
  return { d80, o80, d85, o85, total: -o85 + d80 + d85 + o80 };
}

// Business miles a line records. On a purchase that makes it a mileage-log
// entry: it buys nothing, its whole expense is the claim the approved rate
// makes of the miles, and cellWrites gives the sheet the miles instead of the
// amount so the sheet can make that claim itself.
function carriesBusinessMiles(line) {
  return line.measurableUnitOfMeasure === "miles" && typeof line.measurableQuantity === "number";
}

export function calculateBstResults(book, lines, taxData, scenario) {
  // Filter to BST lines only
  const salesLines = lines.filter((l) => l.sourceJournalID === "sales" && BST_SALES_ACCOUNTS.has(String(l.accountMainID)));
  const purchaseLines = lines.filter((l) => l.sourceJournalID === "purchases" && BST_PURCHASE_CODE_MAP[l.accountMainID] !== undefined);

  // Total sales (BST: gross, no VAT split)
  const totalSales = Math.round(salesLines.reduce((s, l) => s + l.amount, 0));

  // Monthly sales
  const monthlySales = {};
  for (const month of MONTH_ORDER) monthlySales[month] = 0;
  for (const line of salesLines) {
    const month = getMonthKey(line.postingDate);
    monthlySales[month] += line.amount;
  }

  // Purchase expenses by code. A mileage-log entry is left out: it buys
  // nothing, and cellWrites gives the sheet its miles rather than its amount
  // so the sheet can price the claim at its own Admin rates.
  const cashPurchaseLines = purchaseLines.filter((l) => !carriesBusinessMiles(l));
  const byCode = aggregateByCode(cashPurchaseLines, BST_PURCHASE_CODE_MAP);

  // The mileage claim the sheet makes of those miles. It reaches Motor
  // Expenses (verified against the template: PurchasesApr!G4 bands the running
  // mileage total at C1, P3 = IF(E$4="m",G$4," ") files it under the motor
  // code, and P&L!D15 reads that month's P1) -- alongside any motoring the
  // trade did pay cash for, because this P&L has no either/or.
  const businessMiles = scenarioBusinessMiles(scenario);
  const mileageAllowance = calculateMileageAllowance(businessMiles, taxData.mileage);

  // Stock (verified against the template: Profit & Loss Acc!D6:O6 each read
  // PurchasesStock!$D$5-PurchasesStock!$D$7 alongside that month's own
  // purchases, and the sheet's own D7:D30 chain of "=previous cell" copies
  // telescopes the twelve months' worth of that pair back down to a single
  // opening-minus-closing difference).
  const openingStock = scenario.stock?.opening ?? 0;
  const closingStock = scenario.stock?.closing ?? 0;
  const stockPurchases = byCode.s || 0;
  const stockAdjustment = openingStock - closingStock;
  const costOfSales = stockPurchases + stockAdjustment;
  const directCosts = byCode.d || 0;

  // P&L
  const grossProfit = Math.round(totalSales - costOfSales - directCosts);
  const employee = Math.round(byCode.e || 0);
  const premises = Math.round(byCode.p || 0);
  const repairs = Math.round(byCode.r || 0);
  const genAdmin = Math.round(byCode.g || 0);
  const motor = Math.round((byCode.m || 0) + mileageAllowance);
  const travel = Math.round(byCode.t || 0);
  const advertising = Math.round(byCode.a || 0);
  const legal = Math.round(byCode.l || 0);
  const badDebts = Math.round(byCode.b || 0);
  const interest = Math.round(byCode.i || 0);
  const other = Math.round(byCode.o || 0);
  // Fixed assets (code f) flow to Fixed Assets sheet → capital allowances, NOT to P&L expense total
  const totalExpenses = employee + premises + repairs + genAdmin + motor + travel + advertising + legal + badDebts + interest + other;
  const netProfit = Math.round(grossProfit - totalExpenses);

  // Capital allowances, from the fixed asset register cellWrites registers
  // on the Fixed Assets sheet (the same additions cellWrites itself derives
  // via fixedAssetAdditions()).
  const assetAdditions = fixedAssetAdditions(scenario, "f");
  const fa = calculateFixedAssetSchedule(assetAdditions, taxData);
  const seShortCA = seShortCapitalAllowances(fa);
  const capitalAllowances = seShortCA.total;
  const taxableProfit = netProfit - capitalAllowances;

  // SE Short (SA103S), computed ahead of the Income Tax sheet because that
  // sheet's own profit input reads this form's box 27 (verified against the
  // template: Income Tax!E5 = 'SE Short'!D106). O38, D94 and O94 are each a
  // manual entry on Business Details the diya-gl pipeline never sets, so
  // they and the loss/carry-forward boxes they feed are nil in every fixture.
  const otherBusinessIncomeBox9 = 0;
  const seShortNetProfitRaw = totalSales + otherBusinessIncomeBox9 - (Math.round(costOfSales) + directCosts + totalExpenses);
  const seShortNetProfit = Math.max(0, Math.round(seShortNetProfitRaw * 100) / 100);
  const seShortNetLoss = Math.max(0, Math.round(-seShortNetProfitRaw * 100) / 100);
  const seShortD99Raw =
    seShortNetProfit + seShortCA.o85 + 0 /* box 26 */ - seShortNetLoss - seShortCA.d80 - seShortCA.d85 - seShortCA.o80;
  const seShortD99 = Math.max(0, Math.round(seShortD99Raw * 100) / 100);
  // Other business income received (verified against the template: Profit &
  // Loss Acc!C30 = ROUND(SUM(D30:O30),0), each month reading that month's own
  // Sales sheet "other income" column G1; the diya-gl pipeline has no
  // transaction that reaches that column, so this is nil for every fixture,
  // but the cell is a real, present zero on the sheet rather than a blank).
  const otherIncomeReceived = 0;
  const seShortD106 = Math.max(0, Math.round((seShortD99 + otherIncomeReceived - 0 /* loss brought forward */) * 100) / 100);

  // Income Tax
  const { personalAllowance, taxableIncome, basicRateTax, higherRateTax, additionalRateTax, totalIncomeTax } = calculateIncomeTax(
    seShortD106,
    taxData.income_tax,
  );
  const cisDeducted = 0;
  const { lowerBand: niLower, upperBand: niUpper } = calculateNIClass4(seShortD106, taxData.national_insurance);
  const totalTaxAndNI = totalIncomeTax - cisDeducted + niLower + niUpper;
  const niClass4Combined = niLower + niUpper;
  // Neither E11 (SUM(E8:E10)) nor C32 (E11+E12) rounds in the template, so
  // this stays raw: rounding it to the nearest pound is what put the profit
  // bridge's residue and the net-income line a fraction of a pound adrift.
  const incomeTaxLessCis = totalIncomeTax - cisDeducted;
  const niCombinedRounded = Math.round(niClass4Combined * 100) / 100;
  // Net income after tax (verified against the template: Profit & Loss
  // Acc!C35 = C28+C30-C32-C33, the taxable profit and other income received
  // less both tax lines -- not the pre-capital-allowance net profit less tax,
  // which double-counts the capital allowance already taken out of C28).
  const netIncomeAfterTax = taxableProfit + otherIncomeReceived - incomeTaxLessCis - niCombinedRounded;

  const results = {
    "Business Details": {},
    "Profit & Loss Acc": {
      C4: totalSales,
      C6: Math.round(costOfSales),
      C7: directCosts,
      C9: grossProfit,
      C11: employee,
      C12: premises,
      C13: repairs,
      C14: genAdmin,
      C15: motor,
      C16: travel,
      C17: advertising,
      C18: legal,
      C19: badDebts,
      C20: interest,
      C21: other,
      C22: totalExpenses,
      C24: netProfit,
      C26: Math.round(capitalAllowances * 100) / 100,
      C28: Math.round(taxableProfit * 100) / 100,
      C30: otherIncomeReceived,
      C32: incomeTaxLessCis,
      C33: niCombinedRounded,
      C35: Math.round(netIncomeAfterTax * 100) / 100,
    },
    "Income Tax": {
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
      E12: -cisDeducted,
      E15: niLower,
      E16: niUpper,
      E18: totalTaxAndNI,
    },
    "SE Short": {},
    "PurchasesStock": {},
    "Debtors & Creditors": {},
    "Fixed Assets": {},
    "PurchasesMar": {},
    Admin: {
      N4: taxData.income_tax.personal_allowance,
      N5: taxData.income_tax.personal_allowance_taper_threshold,
      N7: taxData.income_tax.basic_rate,
      N8: taxData.income_tax.higher_rate,
      N9: taxData.income_tax.additional_rate,
      M12: taxData.income_tax.basic_band_end,
      N13: taxData.income_tax.higher_band_start,
      N14: taxData.income_tax.higher_band_end,
      L17: taxData.national_insurance.class2_rate,
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

  // Monthly sales columns
  for (const month of MONTH_ORDER) {
    const col = BST_MONTH_COLS[month];
    results["Profit & Loss Acc"][`${col}4`] = Math.round(monthlySales[month]);
  }

  // Business details (from book.toml or scenario)
  const entity = book.entityInformation || {};
  const biz = scenario.business || {};
  results["Business Details"].C5 = biz.name || entity.organizationIdentifier || "";
  results["Business Details"].C7 = biz.description || entity.organizationDescription || "";
  if (biz.address) results["Business Details"].C8 = biz.address;
  if (biz.town) results["Business Details"].C10 = biz.town;
  if (biz.postcode) results["Business Details"].C12 = biz.postcode;

  // SE Short (SA103S) — every formula cell the template defines (verified
  // against the template XML). D46, D51, D55, D60 and D64 are the form's own
  // detailed-expenses boxes, and the sheet only fills them once turnover
  // reaches the £30,000 threshold below which HMRC accepts one combined
  // total instead (Profit & Loss Acc!C4<30000 => " "); D71's net profit is
  // computed from the turnover and total-expenses lines directly and never
  // reads those boxes at all.
  const seShort = results["SE Short"];
  seShort.D38 = totalSales;
  const showExpenseBoxes = totalSales >= 30000;
  if (showExpenseBoxes) {
    seShort.D46 = Math.round(costOfSales) + directCosts; // Box: cost of goods bought
    seShort.D51 = motor + travel; // Box: car, van and travel expenses
    seShort.D55 = employee; // Box: wages, salaries and other staff costs
    seShort.D60 = premises; // Box: rent, rates, power and insurance costs
    seShort.D64 = repairs; // Box: repairs and renewals of property and equipment
  }
  // O38 is a manual entry with no formula at all, and every fixture leaves it
  // genuinely blank on the sheet (no cached value, not a zero) rather than
  // reading back as nil, so it stays unset here to match.
  seShort.D71 = seShortNetProfit;
  seShort.O71 = seShortNetLoss;
  seShort.D80 = Math.round(seShortCA.d80 * 100) / 100;
  seShort.O80 = Math.round(seShortCA.o80 * 100) / 100;
  seShort.D85 = Math.round(seShortCA.d85 * 100) / 100;
  seShort.O85 = Math.round(seShortCA.o85 * 100) / 100;
  seShort.D94 = 0; // Business Details' own "other business income" cell, unset in every fixture
  seShort.D99 = seShortD99;
  seShort.O94 = 0; // Loss brought forward — Business Details' own carry-forward cell, unset in every fixture
  seShort.O99 = otherIncomeReceived;
  seShort.D106 = seShortD106;
  // O106 (the loss carried forward) is not in CELL_MAP or any check, so it is
  // left uncomputed rather than adding a value the Excel side's read set
  // never covers.
  // A7, D8 and A32 are permanently blank in the template: A7 is a spacer row
  // (the business name actually sits at 'Business Details'!C5, not this
  // sheet), D8 is a spacer beside it, and A32 is one row above the caption
  // it looks like it should hold. Left unset here, matching the sheet.

  // Stock — always output (even zeros) to match Excel sections
  results.PurchasesStock.D5 = openingStock;
  results.PurchasesStock.D7 = openingStock;
  results.PurchasesStock.D30 = closingStock;

  // Debtors & Creditors (pass-through from scenario)
  if (scenario.opening_debtors) {
    scenario.opening_debtors.forEach((d, i) => {
      results["Debtors & Creditors"][`C${5 + i}`] = d.amount;
    });
  }
  if (scenario.closing_debtors) {
    scenario.closing_debtors.forEach((d, i) => {
      results["Debtors & Creditors"][`F${5 + i}`] = d.amount;
    });
  }
  if (scenario.opening_creditors) {
    scenario.opening_creditors.forEach((c, i) => {
      results["Debtors & Creditors"][`C${12 + i}`] = c.amount;
    });
  }
  if (scenario.closing_creditors) {
    scenario.closing_creditors.forEach((c, i) => {
      results["Debtors & Creditors"][`F${12 + i}`] = c.amount;
    });
  }

  // Fixed Assets schedule
  if (assetAdditions.length > 0) {
    results["Fixed Assets"].E1 = Math.round(fa.E1 * 100) / 100;
    results["Fixed Assets"].E67 = fa.E67;
    results["Fixed Assets"].K1 = Math.round(fa.K1 * 100) / 100;
    results["Fixed Assets"].L1 = Math.round(fa.L1 * 100) / 100;
    results["Fixed Assets"].M1 = Math.round(fa.M1 * 100) / 100;
    results["Fixed Assets"].Q1 = Math.round(fa.Q1 * 100) / 100;
    results["Fixed Assets"].R1 = Math.round(fa.R1 * 100) / 100;
  }

  // Purchase analysis: the fixed-asset-coded purchases' own year-to-date
  // total (verified against the template: PurchasesMar!X1 =
  // W1+PurchasesFeb!X1, a running sum of every month's code-"f" total).
  results.PurchasesMar.X1 = Math.round(assetAdditions.reduce((sum, asset) => sum + asset.cost, 0) * 100) / 100;

  // The year's mileage, as the last month's sheet carries it: the running
  // mileage total (verified against the template: PurchasesMar!C1 =
  // PurchasesFeb!C1+PurchasesMar!F1+SalesMar!$E$1) and the claim made of it
  // (A1 = G4+PurchasesFeb!A1).
  results.PurchasesMar.C1 = businessMiles;
  results.PurchasesMar.A1 = Math.round(mileageAllowance * 100) / 100;

  return results;
}
