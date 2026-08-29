// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// taxi.js — JS calculation engine for the Taxi Driver product.

import { BST_PURCHASE_CODE_MAP, BST_SALES_ACCOUNTS } from "../scenario-extractor.js";
import { calculateIncomeTax } from "../tax/income-tax.js";
import { calculateNIClass4 } from "../tax/national-insurance.js";
import { aggregateByCode } from "./shared.js";

export function calculateTaxiResults(book, lines, taxData, scenario) {
  // Taxi uses BST-level filtering (sales + purchases only, no bank/payroll)
  const salesLines = lines.filter((l) => l.sourceJournalID === "sales" && BST_SALES_ACCOUNTS.has(String(l.accountMainID)));
  const purchaseLines = lines.filter((l) => l.sourceJournalID === "purchases" && BST_PURCHASE_CODE_MAP[l.accountMainID] !== undefined);

  // Taxi purchase codes: d=fuel, h=car hire, r=repairs, t=road tax/insurance,
  // e=employee, p=premises, g=general admin, a=advertising, l=legal, i=interest, b=bank charges, o=other, f=fixed assets
  const byCode = aggregateByCode(purchaseLines, BST_PURCHASE_CODE_MAP);

  const totalSales = Math.round(salesLines.reduce((s, l) => s + l.amount, 0));

  // Vehicle costs. The taxi fixture's scenario TOML writes purchases with the
  // same single-letter codes BST_PURCHASE_CODE_MAP maps to, so this table
  // reads them directly: d=fuel, r=repairs, t=road tax/insurance. Code h (car
  // hire) has no entry in BST_PURCHASE_CODE_MAP, so it always reads zero
  // until the Taxi calculator gets its own code map.
  const fuel = Math.round(byCode.d || 0);
  const carHire = 0; // code h — not in BST_PURCHASE_CODE_MAP
  const repairsServicing = Math.round(byCode.r || 0);
  const roadTaxInsurance = Math.round(byCode.t || 0);
  const totalVehicleCosts = fuel + carHire + repairsServicing + roadTaxInsurance;
  const capitalAllowances = 0; // Simplified
  const mileageAllowance = 0; // Computed from mileage data, not yet

  // Taxi P&L: uses max(vehicleCosts + capAllow, mileageAllowance)
  // For simplicity, use vehicle costs (mileage comparison not implemented in JS yet)
  const vehicleDeduction = totalVehicleCosts + capitalAllowances;
  const grossProfit = totalSales - vehicleDeduction;

  // General expenses
  const employee = Math.round(byCode.e || 0);
  const premises = Math.round(byCode.p || 0);
  const genAdmin = Math.round(byCode.g || 0);
  const advertising = Math.round(byCode.a || 0);
  const legal = Math.round(byCode.l || 0);
  const interest = Math.round(byCode.i || 0);
  const bankCharges = Math.round(byCode.b || 0);
  const otherExpenses = Math.round(byCode.o || 0);
  const totalGenExpenses = employee + premises + genAdmin + advertising + legal + interest + bankCharges + otherExpenses;
  const netProfit = grossProfit - totalGenExpenses;

  // Tax
  const { personalAllowance, taxableIncome, basicRateTax, totalIncomeTax } = calculateIncomeTax(netProfit, taxData.income_tax);
  const { lowerBand: niLower, upperBand: niUpper } = calculateNIClass4(netProfit, taxData.national_insurance);
  const totalTaxAndNI = totalIncomeTax + niLower + niUpper;

  const entity = book.entityInformation || {};
  const biz = scenario.business || {};

  return {
    "Business Details": {
      C5: biz.name || entity.organizationIdentifier || "",
      C7: biz.description || entity.organizationDescription || "",
      C8: biz.address || "",
      C10: biz.town || "",
      C12: biz.postcode || "",
      O29: biz.utr || "",
    },
    "Profit & Loss Acc": {
      B5: totalSales,
      B6: fuel,
      B7: carHire,
      B8: repairsServicing,
      B9: roadTaxInsurance,
      B10: totalVehicleCosts,
      B11: capitalAllowances,
      B12: mileageAllowance,
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
      B24: 0, // Taxable profit (placeholder)
    },
    "Draft Tax calculation": {
      E5: netProfit,
      E6: personalAllowance,
      E7: taxableIncome,
      E8: 0, // Taxi E8 layout may differ
      E9: basicRateTax,
      E10: totalIncomeTax,
      E14: niLower,
      E15: niUpper,
      E17: totalTaxAndNI,
    },
  };
}
