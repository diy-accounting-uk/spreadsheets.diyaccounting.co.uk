// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd.js — JS calculation engine for the Limited Company product.

import { LTD_PURCHASE_CODE_MAP, LTD_SALES_CODE_MAP } from "../scenario-extractor.js";
import { calculateCorporationTax } from "../tax/corporation-tax.js";
import { aggregateByCode, sumValues } from "./shared.js";

export function calculateLtdResults(book, lines, taxData, scenario) {
  const salesLines = lines.filter((l) => l.sourceJournalID === "sales" && LTD_SALES_CODE_MAP[l.accountMainID] !== undefined);
  const purchaseLines = lines.filter((l) => l.sourceJournalID === "purchases" && LTD_PURCHASE_CODE_MAP[l.accountMainID] !== undefined);

  const byCode = aggregateByCode(purchaseLines, LTD_PURCHASE_CODE_MAP);

  // Product breakdown (net = gross / 1.2)
  const productA = salesLines.filter((l) => l.accountMainID == 4000).reduce((s, l) => s + l.amount, 0) / 1.2;
  const productB = salesLines.filter((l) => l.accountMainID == 4001).reduce((s, l) => s + l.amount, 0) / 1.2;
  const productC = salesLines.filter((l) => l.accountMainID == 4002).reduce((s, l) => s + l.amount, 0) / 1.2;
  const otherDirect = salesLines.filter((l) => l.accountMainID == 4003).reduce((s, l) => s + l.amount, 0) / 1.2;
  const grants = salesLines.filter((l) => l.accountMainID == 4004).reduce((s, l) => s + l.amount, 0) / 1.2;
  const totalTurnover = productA + productB + productC + otherDirect + grants;

  // Cost of sales
  const materials = byCode.s || 0;
  const subcontractors = byCode.c || 0;
  const otherDirectCost = byCode.o || 0;
  const costOfSales = materials + subcontractors + otherDirectCost;
  const grossProfit = totalTurnover - costOfSales;

  // Admin expenses
  const payrollLines = lines.filter((l) => l.sourceJournalID === "payroll");
  const payeWages = payrollLines.reduce((s, l) => s + (l["diya-gl:grossPay"] || l.amount || 0), 0);
  const directorsNonPaye = byCode.d || 0;
  const employeeWages = byCode.w || 0;
  const premises = byCode.r || 0;
  const lightHeat = byCode.p || 0;
  const distribution = byCode.t || 0;
  const equipmentHire = byCode.q || 0;
  const repairs = byCode.m || 0;
  const consumables = byCode.u || 0;
  const advertising = byCode.a || 0;
  const genAdmin = byCode.g || 0;
  const travel = byCode.h || 0;
  const motor = byCode.v || 0;
  const insurance = byCode.n || 0;
  const leasing = byCode.f || 0;
  const legal = byCode.l || 0;
  const badDebtsGross = salesLines.filter((l) => l.accountMainID == 4005).reduce((s, l) => s + l.amount, 0);
  const badDebts = -(badDebtsGross / 1.2); // Negative in P&L, net of VAT
  const charitable = byCode.y || 0;
  const goodwill = byCode.z || 0;
  // Bank charges: X-code transfers from current account (1200) appear as negative P&L charges
  const bankLines = lines.filter((l) => l.sourceJournalID === "bank");
  const bankCharges = -bankLines
    .filter((l) => l["diya-gl:bankCode"] === "X" && l["diya-gl:bankAccountID"] === "1200")
    .reduce((s, l) => s + l.amount, 0);

  const totalAdmin =
    payeWages +
    employeeWages +
    directorsNonPaye +
    premises +
    lightHeat +
    distribution +
    equipmentHire +
    repairs +
    consumables +
    advertising +
    genAdmin +
    travel +
    motor +
    insurance +
    leasing +
    legal +
    badDebts +
    bankCharges +
    charitable +
    goodwill;
  const operatingProfit = grossProfit - totalAdmin;
  const interestReceived = 0;
  const profitBeforeTax = operatingProfit + interestReceived;

  // Corporation Tax
  const ctRates = taxData.corporation_tax || {
    small_profits_rate: 0.19,
    main_rate: 0.25,
    small_profits_limit: 50000,
    small_profits_limit_upper: 250000,
    marginal_relief_fraction: 0.015,
  };
  const depreciation = goodwill; // B38 goodwill + B35/B36 depreciation charges (add back non-cash items)
  const addBack = profitBeforeTax + depreciation; // K12
  const capitalAllowances = 0; // Simplified — requires Fixed Assets schedule
  const lessCA = addBack - capitalAllowances; // K22
  const profitChargeable = lessCA; // K28
  const { corporationTax } = calculateCorporationTax(profitChargeable, ctRates);

  const entity = book.entityInformation || {};
  const biz = scenario.business || {};

  // Opening balance sheet values
  const ob = scenario.opening_balance || {};
  const openingCost = sumValues(ob.fixed_asset_cost);
  const openingDepreciation = sumValues(ob.fixed_asset_depreciation);
  const openingFixedAssets = openingCost - openingDepreciation;
  const openingBank = (ob.current_account || 0) + (ob.savings_account || 0) + (ob.credit_card || 0) + (ob.cash || 0);
  const openingTaxAndSocial = (ob.paye_due || 0) + (ob.vat_due || 0) + (ob.cis_due || 0);
  const directors = (scenario.employees || []).filter((e) => e.isDirector);

  // Directors loan movements reach the ledger as bank lines coded DL. A
  // payment out of the bank repays the loan, so it debits the account and
  // moves its (credit) balance towards zero.
  const directorsLoanMovement = lines
    .filter((l) => l.sourceJournalID === "bank" && l["diya-gl:bankCode"] === "DL")
    .reduce((total, l) => total + (l.debitCreditCode === "C" ? l.amount : -l.amount), 0);

  return {
    "OpenAccounts": {
      E2: biz.name || entity.organizationIdentifier || "",
      E3: biz.company_number || "",
      E4: biz.phone || "",
      E5: directors[0]?.name || "",
      E8: biz.description || entity.organizationDescription || "",
      J3: biz.address || "",
      J4: biz.town || "",
      N6: biz.postcode || "",
      O3: biz.utr || "",
      E13: openingFixedAssets,
      E15: ob.stock || 0,
      E16: ob.trade_debtors || 0,
      E18: openingBank,
      E20: ob.trade_creditors || 0,
      E24: ob.corporation_tax || 0,
      E26: openingTaxAndSocial,
      E30: ob.directors_loan || 0,
      E33: ob.share_capital || 0,
      E34: ob.retained_earnings || 0,
      E37: 0, // Opening balance sheet accuracy check
    },
    "MnthP&L": {
      B4: productA,
      B5: productB,
      B6: productC,
      B7: otherDirect,
      B8: grants,
      B9: totalTurnover,
      B11: materials,
      B12: subcontractors,
      B13: otherDirectCost,
      B14: costOfSales,
      B16: grossProfit,
      B18: payeWages + employeeWages, // Combined: payroll gross + code w purchases
      B19: directorsNonPaye,
      B20: payeWages, // Just payroll gross
      B21: premises,
      B22: lightHeat,
      B23: distribution,
      B24: equipmentHire,
      B25: repairs,
      B26: consumables,
      B27: advertising,
      B28: genAdmin,
      B29: travel,
      B30: motor,
      B31: insurance,
      B32: leasing,
      B33: legal,
      B34: badDebts,
      B35: 0, // Bank interest paid
      B36: bankCharges, // Bank charges (X-code transfers from current account)
      B37: charitable,
      B38: goodwill,
      B39: 0, // Depreciation 2
      B40: 0, // Depreciation 3
      B41: totalAdmin,
      B43: operatingProfit,
      B44: interestReceived,
      B45: profitBeforeTax,
    },
    "CorporationTax": {
      K5: operatingProfit,
      K12: addBack,
      K22: lessCA,
      K28: profitChargeable,
      K35: corporationTax,
      K39: corporationTax,
    },
    "PubP&L": {
      D7: totalTurnover - grants, // Sales Turnover (excl. grants)
      D8: grants, // Investment Grants received
      D9: totalTurnover, // Total Sales Turnover
      D16: costOfSales, // Cost of Sales total
      D18: grossProfit, // Gross Profit
    },
    "PubBalSht": {
      D6: openingFixedAssets,
      D9: scenario.stock?.closing ?? 0,
      D13: 0, // Current assets — needs full balance sheet
      D15: 0, // Creditors < 1 year
      D22: 0, // Net current assets
      D26: 0, // Total assets less CL
      D28: 0, // Other creditors
      D29: ob.directors_loan || 0,
    },
    "Stock": {
      B5: scenario.stock?.opening ?? 0,
      B8: scenario.stock?.closing ?? 0,
    },
    "TrialBalance": {
      D6: ob.fixed_asset_cost?.land_buildings || 0,
      D7: ob.fixed_asset_cost?.plant_machinery || 0,
      D8: ob.fixed_asset_cost?.fixtures_fittings || 0,
      D9: ob.fixed_asset_cost?.computer_technology || 0,
      D10: ob.fixed_asset_cost?.motor_vehicles || 0,
      D11: -(ob.fixed_asset_depreciation?.land_buildings || 0),
      D12: -(ob.fixed_asset_depreciation?.plant_machinery || 0),
      D13: -(ob.fixed_asset_depreciation?.fixtures_fittings || 0),
      D14: -(ob.fixed_asset_depreciation?.computer_technology || 0),
      D15: -(ob.fixed_asset_depreciation?.motor_vehicles || 0),
      D19: ob.stock || 0,
      D20: ob.trade_debtors || 0,
      D22: ob.current_account || 0,
      D23: ob.savings_account || 0,
      D24: ob.credit_card || 0,
      D25: ob.cash || 0,
      D28: -(ob.trade_creditors || 0),
      D33: -(ob.vat_due || 0),
      D35: -(ob.corporation_tax || 0),
      D39: -(ob.directors_loan || 0),
      D42: -(ob.share_capital || 0),
      D43: -(ob.retained_earnings || 0),
      D91: 0, // Opening balances audit check — should be ~0
      EJ39: -(ob.directors_loan || 0) + directorsLoanMovement,
      EJ91: 0, // Audit accuracy check — should be ~0
    },
  };
}
