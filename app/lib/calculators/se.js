// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se.js — JS calculation engine for the Self Employed product.

import { SE_PURCHASE_CODE_MAP, LTD_SALES_CODE_MAP, MONTH_ORDER, getMonthKey } from "../scenario-extractor.js";
import { calculateIncomeTax } from "../tax/income-tax.js";
import { calculateNIClass4 } from "../tax/national-insurance.js";
import { aggregateByCode } from "./shared.js";

export function calculateSeResults(book, lines, taxData, scenario) {
  // SE: all sales accounts, SE purchase codes, bank + payroll
  const salesLines = lines.filter((l) => l.sourceJournalID === "sales" && LTD_SALES_CODE_MAP[l.accountMainID] !== undefined);
  const purchaseLines = lines.filter((l) => l.sourceJournalID === "purchases" && SE_PURCHASE_CODE_MAP[l.accountMainID] !== undefined);

  const byCode = aggregateByCode(purchaseLines, SE_PURCHASE_CODE_MAP);

  // SE sales: net = gross / 1.2 (VAT-registered)
  const SE_TURNOVER_ACCOUNTS = new Set(["4000", "4001", "4002", "4003"]);
  const turnoverLines = salesLines.filter((l) => SE_TURNOVER_ACCOUNTS.has(String(l.accountMainID)));

  // Monthly gross sales for turnover accounts
  const monthlySalesGross = {};
  for (const m of MONTH_ORDER) monthlySalesGross[m] = 0;
  for (const l of turnoverLines) {
    monthlySalesGross[getMonthKey(l.postingDate)] += l.amount;
  }

  // Product breakdown (net = gross / 1.2)
  const productA = salesLines.filter((l) => l.accountMainID == 4000).reduce((s, l) => s + l.amount, 0) / 1.2;
  const productB = salesLines.filter((l) => l.accountMainID == 4001).reduce((s, l) => s + l.amount, 0) / 1.2;
  const productC = salesLines.filter((l) => l.accountMainID == 4002).reduce((s, l) => s + l.amount, 0) / 1.2;
  const otherIncome = salesLines.filter((l) => l.accountMainID == 4003).reduce((s, l) => s + l.amount, 0) / 1.2;
  const grants = salesLines.filter((l) => l.accountMainID == 4004).reduce((s, l) => s + l.amount, 0) / 1.2;

  const totalSalesTurnover = productA + productB + productC + otherIncome;

  // Purchases — amounts from diya-gl are gross values written to column F.
  // The Excel P&L aggregates these through the TrialBalance.
  const materials = byCode.s || 0;
  const subcontractors = byCode.c || 0;
  const otherDirect = byCode.o || 0;
  const costOfSales = materials + subcontractors + otherDirect;
  const grossProfit = totalSalesTurnover + grants - costOfSales;

  const payrollLines = lines.filter((l) => l.sourceJournalID === "payroll");
  const payrollGross = payrollLines.reduce((s, l) => s + (l["diya-gl:grossPay"] || l.amount || 0), 0);
  const wages = (byCode.w || 0) + payrollGross;
  const lightHeat = byCode.p || 0;
  const repairs = byCode.m || 0;
  const genAdmin = byCode.g || 0;
  const motor = byCode.v || 0;
  const travel = byCode.h || 0;
  const advertising = byCode.a || 0;
  const legal = byCode.l || 0;
  // Bad debts from Sales account 4005: shown as negative (loss), netted to net amount
  const badDebtsGross = salesLines.filter((l) => l.accountMainID == 4005).reduce((s, l) => s + l.amount, 0);
  const badDebts = -(badDebtsGross / 1.2); // Negative in P&L (cost), net of VAT
  const charitable = byCode.y || 0;
  // B31 "HP Interest Lease Bank Charges" comes from bank/cash sheet V1+Y1 summary cells via external links
  // Cannot compute from diya-gl data without the bank sheet formulas
  const bankCharges = 0;
  // Note: codes t,q,u,n,f,z flow through external links to non-admin P&L sections, NOT to totalAdminExpenses
  const totalAdminExpenses =
    wages + lightHeat + repairs + genAdmin + motor + travel + advertising + legal + badDebts + bankCharges + charitable;
  const operatingProfit = grossProfit - totalAdminExpenses;
  const profitBeforeTax = operatingProfit; // No interest income for SE

  // Income Tax
  const { personalAllowance, taxableIncome, basicRateTax, higherRateTax, additionalRateTax, totalIncomeTax } = calculateIncomeTax(
    profitBeforeTax,
    taxData.income_tax,
  );
  const cisDeducted = 0;
  const { lowerBand: niLower, upperBand: niUpper } = calculateNIClass4(profitBeforeTax, taxData.national_insurance);
  const totalTaxAndNI = totalIncomeTax - cisDeducted + niLower + niUpper;

  const entity = book.entityInformation || {};
  const biz = scenario.business || {};

  // Quarterly sales/expenses for VitalTax
  const qSales = [0, 0, 0, 0];
  const qExpenses = [0, 0, 0, 0];
  const qMonths = [
    ["apr", "may", "jun"],
    ["jul", "aug", "sep"],
    ["oct", "nov", "dec"],
    ["jan", "feb", "mar"],
  ];
  for (let qi = 0; qi < 4; qi++) {
    for (const m of qMonths[qi]) {
      qSales[qi] += (monthlySalesGross[m] || 0) / 1.2;
    }
  }
  // Approximate quarterly expenses from annual / 4 per quarter
  for (let qi = 0; qi < 4; qi++) {
    const monthPurchases = purchaseLines.filter((l) => qMonths[qi].includes(getMonthKey(l.postingDate)));
    qExpenses[qi] = monthPurchases.reduce((s, l) => s + l.amount, 0);
  }

  return {
    "Business Details": {
      C5: biz.name || entity.organizationIdentifier || "",
    },
    "Profit & Loss Account": {
      B5: productA,
      B6: productB,
      B7: productC,
      B8: otherIncome,
      B9: totalSalesTurnover,
      B11: grants,
      B14: materials,
      B15: subcontractors,
      B16: otherDirect,
      B17: costOfSales,
      B19: grossProfit,
      B21: wages,
      B22: lightHeat,
      B23: repairs,
      B24: genAdmin,
      B25: motor,
      B26: travel,
      B27: advertising,
      B28: legal,
      B29: badDebts,
      B30: 0, // Bank interest paid
      B31: bankCharges, // HP/lease/bank charges (X-code transfers)
      B32: charitable,
      B33: 0, // Loss on disposal
      B34: 0, // Loss on disposal
      B35: totalAdminExpenses,
      B37: operatingProfit,
      B39: profitBeforeTax,
    },
    "Income Tax": {
      E5: profitBeforeTax,
      E6: personalAllowance,
      E7: taxableIncome,
      E8: basicRateTax,
      E9: higherRateTax,
      E10: additionalRateTax,
      E11: totalIncomeTax,
      E12: cisDeducted,
      E15: niLower,
      E16: niUpper,
      E18: totalTaxAndNI,
    },
    "SE Short": {
      A7: biz.name || entity.organizationIdentifier || "",
      D38: totalSalesTurnover,
      D46: costOfSales,
      D51: motor + travel,
      D55: wages,
      D60: lightHeat,
      D64: repairs,
      D71: operatingProfit - charitable, // Approximate net profit
      D80: 0,
      D85: 0,
      D94: 0,
      D99: operatingProfit - charitable,
      A32:
        totalSalesTurnover > (taxData.vat?.registration_threshold || 90000)
          ? `SELF-EMPLOYMENT FULL RETURN REQUIRED AS TURNOVER EXCEEDS £${taxData.vat?.registration_threshold || 90000} VAT threshold`
          : "",
      D106: profitBeforeTax,
    },
    "Wagesinterface": {
      C4: 0,
      C5: 0,
      C6: 0,
      C7: 0,
      C8: 0,
      C9: 0,
      C10: 0,
      C11: 0,
      C12: 0,
      C13: 0,
      C14: 0,
      C15: 0,
      D4: 0,
      H4: 0,
    },
    "VitalTax": {
      C5: qSales[0],
      D5: qSales[1],
      E5: qSales[2],
      F5: qSales[3],
      G5: totalSalesTurnover,
      C7: qExpenses[0],
      D7: qExpenses[1],
      E7: qExpenses[2],
      F7: qExpenses[3],
      G7: qExpenses[0] + qExpenses[1] + qExpenses[2] + qExpenses[3],
    },
    "Stock": {
      B5: scenario.stock?.opening ?? 0,
      B8: scenario.stock?.closing ?? 0,
    },
  };
}
