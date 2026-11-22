// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ixbrl-accounts.test.js — the mapping from FRC concepts to accounts
// figures, row by row, the facts a file states about itself, every refusal
// the import checks make, and the fixtures read as accounts.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mapIxbrlAccounts, MAPPING_TABLE, IxbrlError } from "../lib/ixbrl-accounts.js";
import { frcSuiteConcepts } from "../lib/frc-suite-concepts-node.js";
import { context, ixbrlDocument, money, words, STANDARD_CONTEXTS } from "./helpers/ixbrl-document.js";

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", "ixbrl");
const fixture = (name) => readFileSync(resolve(FIXTURES, name));

const get = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);

// Contexts a balance sheet line sits on: each dimension member at the year end and the year before it ends.
const MATURITY = "core:MaturitiesOrExpirationPeriodsDimension";
const EQUITY = "core:EquityClassesDimension";
const PPE = "core:PropertyPlantEquipmentClassesDimension";
const OFFICERS = "uk-bus:EntityOfficersDimension";

const MEMBER_CONTEXTS = [
  ["WITHIN_CY", "2025-03-31", MATURITY, "core:WithinOneYear"],
  ["WITHIN_PY", "2024-03-31", MATURITY, "core:WithinOneYear"],
  ["AFTER_CY", "2025-03-31", MATURITY, "core:AfterOneYear"],
  ["SHARE_CY", "2025-03-31", EQUITY, "core:ShareCapital"],
  ["RETAINED_CY", "2025-03-31", EQUITY, "core:RetainedEarningsAccumulatedLosses"],
  ["REVAL_CY", "2025-03-31", EQUITY, "core:RevaluationReserve"],
  ["LAND_CY", "2025-03-31", PPE, "core:LandBuildings"],
  ["LAND_PY", "2024-03-31", PPE, "core:LandBuildings"],
  ["PLANT_CY", "2025-03-31", PPE, "core:PlantMachinery"],
  ["FURN_CY", "2025-03-31", PPE, "core:FurnitureFittings"],
  ["COMP_CY", "2025-03-31", PPE, "core:ComputerEquipment"],
  ["MOTOR_CY", "2025-03-31", PPE, "core:MotorVehicles"],
  ["MOTOR_PY", "2024-03-31", PPE, "core:MotorVehicles"],
].map(([id, instant, dimension, member]) => context(id, { instant, members: [[dimension, member]] }));

const DURATION_MEMBER_CONTEXTS = [
  ["LAND_DUR", PPE, "core:LandBuildings"],
  ["PLANT_DUR", PPE, "core:PlantMachinery"],
  ["FURN_DUR", PPE, "core:FurnitureFittings"],
  ["COMP_DUR", PPE, "core:ComputerEquipment"],
  ["MOTOR_DUR", PPE, "core:MotorVehicles"],
].map(([id, dimension, member]) => context(id, { start: "2024-04-01", end: "2025-03-31", members: [[dimension, member]] }));

const OFFICER_CONTEXTS = [
  context("DIR1", { start: "2024-04-01", end: "2025-03-31", members: [[OFFICERS, "uk-bus:Director1"]] }),
  context("DIR2", { start: "2024-04-01", end: "2025-03-31", members: [[OFFICERS, "uk-bus:Director2"]] }),
  context("SHARES_CY", { instant: "2025-03-31", members: [["uk-bus:EntityShareClassesDimension", "uk-bus:OrdinaryShareClass1"]] }),
].join("");

const ACCRUALS_CONTEXT = context("ACCRUALS_CY", {
  instant: "2025-03-31",
  members: [
    ["core:FinancialInstrumentCurrentNon-currentDimension", "core:CurrentFinancialInstruments"],
    [MATURITY, "core:WithinOneYear"],
  ],
});

const CONTEXTS = STANDARD_CONTEXTS + ACCRUALS_CONTEXT + MEMBER_CONTEXTS.join("") + DURATION_MEMBER_CONTEXTS.join("") + OFFICER_CONTEXTS;

const FIRST = { firstAccounts: true };
const COVER =
  words("uk-bus:StartDateForPeriodCoveredByReport", "CY_END", "1 April 2024", 'format="ixt2:datedaymonthyearen"') +
  words("uk-bus:EndDateForPeriodCoveredByReport", "CY_END", "31 March 2025", 'format="ixt2:datedaymonthyearen"');
const accountsOf = (body, expect = FIRST) => mapIxbrlAccounts(ixbrlDocument({ contexts: CONTEXTS, hidden: COVER, body }), expect);

// concept -> true once a row of the table below has exercised it
const exercised = new Set();

// [concept, facts, path in the result, expected]
const ROWS = [
  ["FixedAssets", money("core:FixedAssets", "CY_END", "1,000"), "balanceSheet.currentYear.fixedAssets", 1000],
  ["FixedAssets", money("core:FixedAssets", "PY_END", "900"), "balanceSheet.priorYear.fixedAssets", 900],
  ["IntangibleAssets", money("core:IntangibleAssets", "CY_END", "300"), "balanceSheet.currentYear.fixedAssets", 300],
  ["PropertyPlantEquipment", money("core:PropertyPlantEquipment", "CY_END", "4,834"), "balanceSheet.currentYear.fixedAssets", 4834],
  ["InvestmentProperty", money("core:InvestmentProperty", "CY_END", "50,000"), "balanceSheet.currentYear.fixedAssets", 50000],
  [
    "InvestmentsFixedAssets",
    money("core:PropertyPlantEquipment", "CY_END", "1,000") + money("core:InvestmentsFixedAssets", "CY_END", "250"),
    "balanceSheet.currentYear.fixedAssets",
    1250,
  ],
  [
    "FixedAssets",
    money("core:FixedAssets", "CY_END", "1,000") + money("core:PropertyPlantEquipment", "CY_END", "800"),
    "balanceSheet.currentYear.fixedAssets",
    1000,
  ],
  ["TotalInventories", money("core:TotalInventories", "CY_END", "500"), "balanceSheet.currentYear.stocks", 500],
  ["Debtors", money("core:Debtors", "CY_END", "2,500"), "balanceSheet.currentYear.debtors", 2500],
  ["Debtors", money("core:Debtors", "WITHIN_CY", "2,400"), "balanceSheet.currentYear.debtors", 2400],
  [
    "PrepaymentsAccruedIncomeNotExpressedWithinCurrentAssetSubtotal",
    money("core:Debtors", "CY_END", "2,000") +
      money("core:PrepaymentsAccruedIncomeNotExpressedWithinCurrentAssetSubtotal", "CY_END", "300"),
    "balanceSheet.currentYear.prepaymentsAccruedIncome",
    300,
  ],
  [
    "CalledUpShareCapitalNotPaidNotExpressedAsCurrentAsset",
    money("core:Debtors", "CY_END", "2,000") + money("core:CalledUpShareCapitalNotPaidNotExpressedAsCurrentAsset", "CY_END", "100"),
    "balanceSheet.currentYear.calledUpShareCapitalNotPaid",
    100,
  ],
  ["CashBankOnHand", money("core:CashBankOnHand", "CY_END", "12,000"), "balanceSheet.currentYear.cashAtBank", 12000],
  ["CurrentAssets", money("core:CurrentAssets", "CY_END", "15,000"), "balanceSheet.currentYear.currentAssets", 15000],
  [
    "TradeCreditorsTradePayables",
    money("core:TradeCreditorsTradePayables", "WITHIN_CY", "1,000"),
    "balanceSheet.currentYear.tradeCreditors",
    1000,
  ],
  ["CorporationTaxPayable", money("core:CorporationTaxPayable", "WITHIN_CY", "1,500"), "balanceSheet.currentYear.corporationTax", 1500],
  ["OtherCreditors", money("core:OtherCreditors", "WITHIN_CY", "500"), "balanceSheet.currentYear.otherCreditors", 500],
  [
    "AccruedLiabilitiesNotExpressedWithinCreditorsSubtotal",
    money("core:OtherCreditors", "WITHIN_CY", "500") +
      money("core:AccruedLiabilitiesNotExpressedWithinCreditorsSubtotal", "WITHIN_CY", "70"),
    "balanceSheet.currentYear.accrualsDeferredIncome",
    70,
  ],
  [
    "TaxationSocialSecurityPayable",
    money("core:OtherCreditors", "WITHIN_CY", "500") + money("core:TaxationSocialSecurityPayable", "WITHIN_CY", "4,451"),
    "balanceSheet.currentYear.taxationSocialSecurity",
    4451,
  ],
  [
    "OtherTaxationSocialSecurityPayable",
    money("core:OtherTaxationSocialSecurityPayable", "WITHIN_CY", "53"),
    "balanceSheet.currentYear.taxationSocialSecurity",
    53,
  ],
  ["AccruedLiabilities", money("core:AccruedLiabilities", "ACCRUALS_CY", "400"), "balanceSheet.currentYear.accruals", 400],
  [
    "AccruedLiabilitiesDeferredIncome",
    money("core:AccruedLiabilitiesDeferredIncome", "WITHIN_CY", "400"),
    "balanceSheet.currentYear.accruals",
    400,
  ],
  [
    "BankBorrowingsOverdrafts",
    money("core:BankBorrowingsOverdrafts", "WITHIN_CY", "900"),
    "balanceSheet.currentYear.bankLoansOverdrafts",
    900,
  ],
  [
    "BankBorrowingsOverdrafts",
    money("core:BankBorrowingsOverdrafts", "AFTER_CY", "1,200"),
    "balanceSheet.currentYear.bankLoansAfterOneYear",
    1200,
  ],
  [
    "BankBorrowingsOverdrafts",
    money("core:BankBorrowingsOverdrafts", "AFTER_CY", "1,200"),
    "balanceSheet.currentYear.creditorsAfterOneYear",
    1200,
  ],
  ["Creditors", money("core:Creditors", "WITHIN_CY", "3,000"), "balanceSheet.currentYear.creditorsWithinOneYear", 3000],
  ["Creditors", money("core:Creditors", "AFTER_CY", "2,000"), "balanceSheet.currentYear.creditorsAfterOneYear", 2000],
  [
    "ProvisionsForLiabilitiesBalanceSheetSubtotal",
    money("core:Creditors", "AFTER_CY", "2,000") + money("core:ProvisionsForLiabilitiesBalanceSheetSubtotal", "CY_END", "250"),
    "balanceSheet.currentYear.provisionsForLiabilities",
    250,
  ],
  ["Equity", money("core:Equity", "SHARE_CY", "100"), "balanceSheet.currentYear.calledUpShareCapital", 100],
  ["Equity", money("core:Equity", "RETAINED_CY", "19,900"), "balanceSheet.currentYear.profitAndLossAccount", 19900],
  [
    "Equity",
    money("core:Equity", "RETAINED_CY", "19,900") + money("core:Equity", "REVAL_CY", "1,000"),
    "balanceSheet.currentYear.profitAndLossAccount",
    20900,
  ],
  [
    "Equity",
    money("core:FixedAssets", "CY_END", "20,000") + money("core:Equity", "CY_END", "20,000"),
    "balanceSheet.currentYear.capitalAndReserves",
    20000,
  ],
  [
    "NetAssetsLiabilities",
    money("core:FixedAssets", "CY_END", "20,000") + money("core:NetAssetsLiabilities", "CY_END", "20,000"),
    "balanceSheet.currentYear.netAssets",
    20000,
  ],
  [
    "NetCurrentAssetsLiabilities",
    money("core:NetCurrentAssetsLiabilities", "CY_END", "12,000"),
    "balanceSheet.currentYear.netCurrentAssets",
    12000,
  ],
  [
    "TotalAssetsLessCurrentLiabilities",
    money("core:TotalAssetsLessCurrentLiabilities", "CY_END", "22,000"),
    "balanceSheet.currentYear.totalAssetsLessCurrentLiabilities",
    22000,
  ],
  ["TurnoverRevenue", money("core:TurnoverRevenue", "CY", "50,000"), "profitAndLoss.currentYear.turnover", 50000],
  ["TurnoverRevenue", money("core:TurnoverRevenue", "PY", "40,000"), "profitAndLoss.priorYear.turnover", 40000],
  ["CostSales", money("core:CostSales", "CY", "20,000"), "profitAndLoss.currentYear.costOfSales", 20000],
  [
    "AdministrativeExpenses",
    money("core:AdministrativeExpenses", "CY", "25,000"),
    "profitAndLoss.currentYear.administrativeExpenses",
    25000,
  ],
  [
    "OtherInterestReceivableSimilarIncomeFinanceIncome",
    money("core:OtherInterestReceivableSimilarIncomeFinanceIncome", "CY", "100"),
    "profitAndLoss.currentYear.interestReceivable",
    100,
  ],
  [
    "TaxTaxCreditOnProfitOrLossOnOrdinaryActivities",
    money("core:TaxTaxCreditOnProfitOrLossOnOrdinaryActivities", "CY", "1,000"),
    "profitAndLoss.currentYear.tax",
    1000,
  ],
  [
    "InterestPayableSimilarChargesFinanceCosts",
    money("core:InterestPayableSimilarChargesFinanceCosts", "CY", "60"),
    "profitAndLoss.currentYear.interestPayable",
    60,
  ],
  ["GrossProfitLoss", money("core:GrossProfitLoss", "CY", "30,000"), "profitAndLoss.currentYear.grossProfit", 30000],
  ["OperatingProfitLoss", money("core:OperatingProfitLoss", "CY", "5,000"), "profitAndLoss.currentYear.operatingProfit", 5000],
  [
    "ProfitLossOnOrdinaryActivitiesBeforeTax",
    money("core:ProfitLossOnOrdinaryActivitiesBeforeTax", "CY", "5,100"),
    "profitAndLoss.currentYear.profitBeforeTax",
    5100,
  ],
  ["ProfitLoss", money("core:ProfitLoss", "CY", "4,100"), "profitAndLoss.currentYear.profit", 4100],
  [
    "ProfitLossOnOrdinaryActivitiesAfterTax",
    money("core:ProfitLossOnOrdinaryActivitiesAfterTax", "CY", "4,100"),
    "profitAndLoss.currentYear.profit",
    4100,
  ],
  [
    "OtherOperatingIncomeFormat2",
    money("core:OtherOperatingIncomeFormat2", "CY", "22"),
    "profitAndLoss.currentYear.otherOperatingIncome",
    22,
  ],
  [
    "RawMaterialsConsumablesUsed",
    money("core:RawMaterialsConsumablesUsed", "CY", "300"),
    "profitAndLoss.currentYear.rawMaterialsConsumables",
    300,
  ],
  [
    "StaffCostsEmployeeBenefitsExpense",
    money("core:StaffCostsEmployeeBenefitsExpense", "CY", "700"),
    "profitAndLoss.currentYear.staffCosts",
    700,
  ],
  [
    "DepreciationAmortisationImpairmentExpense",
    money("core:DepreciationAmortisationImpairmentExpense", "CY", "90"),
    "profitAndLoss.currentYear.depreciation",
    90,
  ],
  [
    "OtherOperatingExpensesFormat2",
    money("core:OtherOperatingExpensesFormat2", "CY", "2,482"),
    "profitAndLoss.currentYear.otherOperatingExpenses",
    2482,
  ],
  [
    "OtherOperatingIncome",
    money("core:RawMaterialsConsumablesUsed", "CY", "300") + money("core:OtherOperatingIncome", "CY", "22"),
    "profitAndLoss.currentYear.otherOperatingIncome",
    22,
  ],
  [
    "IncreaseDecreaseInStocksInventoriesFinishedGoodsWorkInProgress",
    money("core:IncreaseDecreaseInStocksInventoriesFinishedGoodsWorkInProgress", "CY", "30", 'sign="-"'),
    "profitAndLoss.currentYear.changeInStocks",
    -30,
  ],
  ["OwnWorkCapitalised", money("core:OwnWorkCapitalised", "CY", "45"), "profitAndLoss.currentYear.ownWorkCapitalised", 45],
  ["OtherExternalCharges", money("core:OtherExternalCharges", "CY", "60"), "profitAndLoss.currentYear.otherExternalCharges", 60],
  ["WagesSalaries", money("core:WagesSalaries", "CY", "500"), "profitAndLoss.currentYear.wagesSalaries", 500],
  ["SocialSecurityCosts", money("core:SocialSecurityCosts", "CY", "50"), "profitAndLoss.currentYear.socialSecurityCosts", 50],
  [
    "PensionOtherPost-employmentBenefitCostsOtherPensionCosts",
    money("core:PensionOtherPost-employmentBenefitCostsOtherPensionCosts", "CY", "20"),
    "profitAndLoss.currentYear.pensionCosts",
    20,
  ],
  [
    "DepreciationAmortisationExpense",
    money("core:DepreciationAmortisationExpense", "CY", "90"),
    "profitAndLoss.currentYear.depreciation",
    90,
  ],
  [
    "OtherOperatingExpensesByNature",
    money("core:OtherOperatingExpensesByNature", "CY", "2,482"),
    "profitAndLoss.currentYear.otherOperatingExpenses",
    2482,
  ],
  ["ProfitLossBeforeTax", money("core:ProfitLossBeforeTax", "CY", "5,100"), "profitAndLoss.currentYear.profitBeforeTax", 5100],
  [
    "GainLossOnDisposalsPropertyPlantEquipment",
    money("core:GainLossOnDisposalsPropertyPlantEquipment", "CY", "40", 'sign="-"'),
    "profitAndLoss.currentYear.gainOnDisposal",
    -40,
  ],
  [
    "AverageNumberEmployeesDuringPeriod",
    `<ix:nonFraction name="core:AverageNumberEmployeesDuringPeriod" contextRef="CY" unitRef="pure" decimals="0">4</ix:nonFraction>`,
    "averageEmployees",
    4,
  ],
  [
    "DescriptionPrincipalActivities",
    words("uk-bus:DescriptionPrincipalActivities", "CY", "Software consultancy"),
    "principalActivity",
    "Software consultancy",
  ],
  [
    "NameEntityOfficer",
    words("uk-bus:NameEntityOfficer", "DIR1", "Ann Able") + words("uk-bus:NameEntityOfficer", "DIR2", "Bob Baker"),
    "directors",
    ["Ann Able", "Bob Baker"],
  ],
  [
    "DirectorSigningFinancialStatements",
    words("uk-bus:NameEntityOfficer", "DIR1", "Ann Able") +
      words("uk-bus:NameEntityOfficer", "DIR2", "Bob Baker") +
      words("core:DirectorSigningFinancialStatements", "DIR2", ""),
    "signer",
    "Bob Baker",
  ],
  [
    "DateAuthorisationFinancialStatementsForIssue",
    words("core:DateAuthorisationFinancialStatementsForIssue", "CY_END", "15 January 2026", 'format="ixt2:datedaymonthyearen"'),
    "approvalDate",
    "2026-01-15",
  ],
  [
    "NumberSharesIssuedFullyPaid",
    `<ix:nonFraction name="core:NumberSharesIssuedFullyPaid" contextRef="SHARES_CY" unitRef="shares" decimals="0">100</ix:nonFraction>`,
    "shareNote.shares",
    100,
  ],
  [
    "NominalValueAllottedShareCapital",
    `<ix:nonFraction name="core:NominalValueAllottedShareCapital" contextRef="SHARES_CY" unitRef="GBP" decimals="INF">1</ix:nonFraction>`,
    "shareNote.nominalValue",
    1,
  ],
];

const CLASS_ROWS = [
  ["landBuildings", "LAND"],
  ["plantMachinery", "PLANT"],
  ["furnitureFittings", "FURN"],
  ["computerEquipment", "COMP"],
  ["motorVehicles", "MOTOR"],
];

describe("the mapping table", () => {
  it("has a row for each concept and member the reader maps", () => {
    expect(MAPPING_TABLE).toHaveLength(75);
    for (const row of MAPPING_TABLE) {
      expect(row.concept).toMatch(/^[A-Z]/);
      expect(row.figure).toBeTruthy();
      expect(row.account).toBeTruthy();
    }
  });

  it.each(ROWS.map((row) => [`${row[0]} -> ${row[2]}`, ...row]))("%s", (_name, concept, body, path, expected) => {
    const accounts = accountsOf(body);
    expect(get(accounts, path)).toEqual(expected);
    exercised.add(concept);
  });

  const noteConcepts = {
    additions: "AdditionsOtherThanThroughBusinessCombinationsPropertyPlantEquipment",
    disposals: "DisposalsPropertyPlantEquipment",
    depreciationCharge: "IncreaseFromDepreciationChargeForYearPropertyPlantEquipment",
    depreciationOnDisposals: "DisposalsDecreaseInDepreciationImpairmentPropertyPlantEquipment",
  };

  it.each(CLASS_ROWS)("reads the note of %s from its dimension member", (className, prefix) => {
    // Cost and depreciation at the start of the year sit on the prior year-end instant; the other four lines are durations.
    const startContext = context(`${prefix}_START`, {
      instant: "2024-03-31",
      members: [[PPE, `core:${className[0].toUpperCase()}${className.slice(1)}`]],
    });
    const durations = Object.entries(noteConcepts)
      .map(([, concept], index) => money(`core:${concept}`, `${prefix}_DUR`, String((index + 1) * 10)))
      .join("");
    const body =
      money("core:PropertyPlantEquipmentGrossCost", `${prefix}_START`, "5,000") +
      money("core:AccumulatedDepreciationImpairmentPropertyPlantEquipment", `${prefix}_START`, "1,500") +
      durations;
    const accounts = mapIxbrlAccounts(ixbrlDocument({ contexts: CONTEXTS + startContext, body }), FIRST);
    expect(accounts.fixedAssetNote).toEqual({
      [className]: {
        costAtStart: 5000,
        depreciationAtStart: 1500,
        additions: 10,
        disposals: 20,
        depreciationCharge: 30,
        depreciationOnDisposals: 40,
      },
    });
    for (const concept of [
      "PropertyPlantEquipmentGrossCost",
      "AccumulatedDepreciationImpairmentPropertyPlantEquipment",
      ...Object.values(noteConcepts),
    ]) {
      exercised.add(concept);
    }
  });

  it("reads total additions when the file states no additions outside business combinations", () => {
    const body = money("core:TotalAdditionsIncludingFromBusinessCombinationsPropertyPlantEquipment", "COMP_DUR", "750");
    expect(accountsOf(body).fixedAssetNote.computerEquipment.additions).toBe(750);
    exercised.add("TotalAdditionsIncludingFromBusinessCombinationsPropertyPlantEquipment");
  });

  it("works the start of the year from the closing figures when the file states only those", () => {
    const body =
      money("core:PropertyPlantEquipmentGrossCost", "COMP_CY", "6,000") +
      money("core:AdditionsOtherThanThroughBusinessCombinationsPropertyPlantEquipment", "COMP_DUR", "1,000") +
      money("core:AccumulatedDepreciationImpairmentPropertyPlantEquipment", "COMP_CY", "2,000") +
      money("core:IncreaseFromDepreciationChargeForYearPropertyPlantEquipment", "COMP_DUR", "500");
    const note = accountsOf(body).fixedAssetNote;
    expect(note.computerEquipment).toMatchObject({ costAtStart: 5000, depreciationAtStart: 1500 });
  });

  it("states creditors after one year without the provisions, and gives the provisions as a line of their own", () => {
    const accounts = accountsOf(
      money("core:FixedAssets", "CY_END", "5,000") +
        money("core:Creditors", "AFTER_CY", "1,700") +
        money("core:ProvisionsForLiabilitiesBalanceSheetSubtotal", "CY_END", "300") +
        money("core:NetAssetsLiabilities", "CY_END", "3,000"),
    );
    expect(accounts.balanceSheet.currentYear).toMatchObject({ creditorsAfterOneYear: 1700, provisionsForLiabilities: 300 });
    expect(accounts.notes.join(" ")).not.toMatch(/provisions/);
    expect(() =>
      accountsOf(
        money("core:FixedAssets", "CY_END", "5,000") +
          money("core:Creditors", "AFTER_CY", "1,700") +
          money("core:ProvisionsForLiabilitiesBalanceSheetSubtotal", "CY_END", "300") +
          money("core:NetAssetsLiabilities", "CY_END", "3,300"),
      ),
    ).toThrow(/does not balance/);
  });

  it("names the reserves it folds into other lines", () => {
    const reserves = accountsOf(money("core:Equity", "REVAL_CY", "1,000"));
    expect(reserves.notes.join(" ")).toMatch(/RevaluationReserve 1000/);
  });

  it("lists a fact the table does not name as unmapped", () => {
    const accounts = accountsOf(money("core:GoodwillAndSuch", "CY_END", "77") + money("core:FixedAssets", "CY_END", "10"));
    expect(accounts.unmapped).toEqual([
      { concept: "GoodwillAndSuch", dimensions: {}, period: { instant: "2025-03-31" }, value: 77, inSuite: null },
    ]);
  });

  // [suite date, a name the suite defines, a name only a later suite defines]
  it.each([
    ["2014-09-01", "Goodwill", "Agent10"],
    ["2018-01-01", "Goodwill", "AcquiredThroughBusinessCombinationsContractAssets"],
    ["2019-01-01", "Goodwill", "EntityHasClaimedExemptionFromReportingCertainItemsRelatingToImpairmentAssetsInLineWithFRS1018lTruefalse"],
    ["2021-01-01", "Goodwill", "GoodwillAndSuch"],
  ])("marks which unmapped names the %s suite defines", (date, defined, undefinedInSuite) => {
    const schemaRef = `https://xbrl.frc.org.uk/FRS-102/${date}/FRS-102-${date}.xsd`;
    const body = money(`core:${defined}`, "CY_END", "5") + money(`core:${undefinedInSuite}`, "CY_END", "6");
    const accounts = mapIxbrlAccounts(ixbrlDocument({ contexts: CONTEXTS, hidden: COVER, body, schemaRef }), FIRST, {
      suiteConcepts: frcSuiteConcepts,
    });
    expect(accounts.suite.date).toBe(date);
    expect(accounts.unmapped.map((fact) => [fact.concept, fact.inSuite])).toEqual([
      [defined, true],
      [undefinedInSuite, false],
    ]);
  });

  it("leaves the mark null when no resolver is passed", () => {
    const schemaRef = "https://xbrl.frc.org.uk/FRS-102/2021-01-01/FRS-102-2021-01-01.xsd";
    const body = money("core:Goodwill", "CY_END", "5");
    const accounts = mapIxbrlAccounts(ixbrlDocument({ contexts: CONTEXTS, hidden: COVER, body, schemaRef }), FIRST);
    expect(accounts.unmapped.map((fact) => fact.inSuite)).toEqual([null]);
  });

  it("leaves the mark null for a suite with no list", () => {
    const schemaRef = "https://xbrl.frc.org.uk/FRS-102/2024-01-01/FRS-102-2024-01-01.xsd";
    const body = money("core:Goodwill", "CY_END", "5");
    const accounts = mapIxbrlAccounts(ixbrlDocument({ contexts: CONTEXTS, hidden: COVER, body, schemaRef }), FIRST, {
      suiteConcepts: frcSuiteConcepts,
    });
    expect(accounts.unmapped.map((fact) => fact.inSuite)).toEqual([null]);
  });

  it("reads the stated start of the prior period", () => {
    const accounts = accountsOf(words("uk-bus:StartDateForPriorPeriod", "CY", "21 March 2023", 'format="ixt2:datedaymonthyearen"'));
    expect(accounts.priorPeriod.start).toBe("2023-03-21");
    exercised.add("StartDateForPriorPeriod");
  });

  it("has exercised every concept in the table", () => {
    const missing = [...new Set(MAPPING_TABLE.map((row) => row.concept))].filter((concept) => !exercised.has(concept));
    expect(missing).toEqual([]);
  });
});

describe("what a file says about itself", () => {
  const standards = (member) =>
    context("STANDARDS", {
      start: "2024-04-01",
      end: "2025-03-31",
      members: [["uk-bus:AccountingStandardsDimension", `uk-bus:${member}`]],
    });
  const document = (member, extra = "") =>
    ixbrlDocument({
      contexts: STANDARD_CONTEXTS + standards(member),
      hidden:
        words("uk-bus:UKCompaniesHouseRegisteredNumber", "CY", "12345678") +
        words("uk-bus:EntityCurrentLegalOrRegisteredName", "CY", "Test Ltd") +
        words("uk-bus:StartDateForPeriodCoveredByReport", "CY_END", "1 April 2024", 'format="ixt2:datedaymonthyearen"') +
        words("uk-bus:EndDateForPeriodCoveredByReport", "CY_END", "31 March 2025", 'format="ixt2:datedaymonthyearen"') +
        words("uk-bus:BalanceSheetDate", "CY_END", "31 March 2025", 'format="ixt2:datedaymonthyearen"') +
        words("uk-bus:AccountingStandardsApplied", "STANDARDS", "", 'format="ixt2:nocontent"') +
        extra,
    });

  it("gives the company number, name and period", () => {
    const accounts = mapIxbrlAccounts(document("Micro-entities"), FIRST);
    expect(accounts.company).toEqual({ number: "12345678", name: "Test Ltd" });
    expect(accounts.period).toEqual({ start: "2024-04-01", end: "2025-03-31" });
    expect(accounts.priorPeriod).toEqual({ start: "2023-04-01", end: "2024-03-31" });
  });

  it("reads Micro-entities as the micro regime", () => {
    expect(mapIxbrlAccounts(document("Micro-entities"), FIRST).regime).toBe("micro");
  });

  it.each(["SmallEntities", "FRS102"])("reads %s as the small regime", (member) => {
    expect(mapIxbrlAccounts(document(member), FIRST).regime).toBe("small");
  });

  it("reads the dormant and trading statuses", () => {
    const dormant = mapIxbrlAccounts(
      document("Micro-entities", words("uk-bus:EntityDormantTruefalse", "CY", "true", 'format="ixt2:booleantrue"')),
      FIRST,
    );
    expect(dormant.dormant).toBe(true);
    expect(dormant.tradingStatus).toBe("Trading");
    expect(mapIxbrlAccounts(document("Micro-entities"), FIRST).dormant).toBe(false);
  });

  it("reads a filleted file from the statement that the profit and loss account is not delivered", () => {
    const small = (extra) => mapIxbrlAccounts(document("FRS102", extra + money("core:FixedAssets", "CY_END", "5")), FIRST);
    const filleted = small(
      words("direp:StatementThatDirectorsHaveElectedNotToDeliverProfitLossAccountUnderSection4445ACompaniesAct2006", "CY", "elected"),
    );
    expect(filleted.filleted).toBe(true);
    expect(small(money("core:TurnoverRevenue", "CY", "10")).filleted).toBe(false);
  });
});

describe("the checks on import", () => {
  const expectation = (overrides) => ({ firstAccounts: true, ...overrides });
  const diya = () => fixture("diya-2025-accounts.xhtml");

  it("accepts a file for the looked-up company, whatever zeros its number starts with", () => {
    expect(mapIxbrlAccounts(diya(), expectation({ companyNumber: "06846849" })).company.number).toBe("06846849");
    expect(mapIxbrlAccounts(diya(), expectation({ companyNumber: "6846849" })).company.number).toBe("06846849");
  });

  it("refuses another company's number", () => {
    expect(() => mapIxbrlAccounts(diya(), expectation({ companyNumber: "01234567" }))).toThrow(
      "This file is for company 06846849; the company looked up is 01234567.",
    );
  });

  it("refuses a file whose own company number is not the one in its contexts' entity", () => {
    expect(() => mapIxbrlAccounts(fixture("doctored-other-company.xhtml"), { companyNumber: "06846849" })).toThrow(/company 01234567/);
  });

  it("refuses another period's end and start", () => {
    expect(() => mapIxbrlAccounts(diya(), expectation({ periodEnd: "2026-03-31" }))).toThrow(
      /end on 2025-03-31; the form's period ends on 2026-03-31/,
    );
    expect(() => mapIxbrlAccounts(diya(), expectation({ periodStart: "2024-05-01" }))).toThrow(
      /start on 2024-04-01; the form's period starts on 2024-05-01/,
    );
    expect(mapIxbrlAccounts(diya(), expectation({ periodStart: "2024-04-01", periodEnd: "2025-03-31" })).period.end).toBe("2025-03-31");
  });

  it("refuses a micro file on the small page and a small file on the micro page, and takes either where the page takes both", () => {
    expect(() => mapIxbrlAccounts(diya(), expectation({ regime: "small" }))).toThrow(
      /micro-entity's accounts; this page takes a small company's accounts/,
    );
    expect(() => mapIxbrlAccounts(fixture("builder-small-consistent.xhtml"), expectation({ regime: "micro" }))).toThrow(
      /small company's accounts; this page takes a micro-entity's accounts/,
    );
    expect(mapIxbrlAccounts(diya(), expectation({ regime: "any" })).regime).toBe("micro");
    expect(mapIxbrlAccounts(fixture("builder-small-consistent.xhtml"), expectation({ regime: "any" })).regime).toBe("small");
  });

  it("refuses a dormant file anywhere but the dormant case, and the reverse", () => {
    expect(() => mapIxbrlAccounts(fixture("builder-micro-dormant.xhtml"), expectation({ dormant: false }))).toThrow(
      /dormant company; use the dormant accounts page/,
    );
    expect(() => mapIxbrlAccounts(diya(), expectation({ dormant: true }))).toThrow(/not for a dormant company/);
    expect(mapIxbrlAccounts(fixture("builder-micro-dormant.xhtml"), expectation({ dormant: true })).dormant).toBe(true);
  });

  it("refuses a balance sheet that does not balance", () => {
    expect(() => mapIxbrlAccounts(fixture("doctored-unbalanced.xhtml"), { companyNumber: "06846849" })).toThrow(
      /does not balance|net current assets/,
    );
  });

  it("refuses net assets that differ from capital and reserves", () => {
    const body =
      money("core:FixedAssets", "CY_END", "100") +
      money("core:NetAssetsLiabilities", "CY_END", "100") +
      money("core:Equity", "CY_END", "90");
    expect(() => accountsOf(body)).toThrow(/does not balance/);
  });

  it("refuses a total that differs from the lines under it, by more than a pound", () => {
    const small = (cash) =>
      accountsOf(
        words("uk-bus:EntityDormantTruefalse", "CY", "false") +
          money("core:Debtors", "CY_END", "100") +
          money("core:CashBankOnHand", "CY_END", cash) +
          money("core:CurrentAssets", "CY_END", "300"),
        FIRST,
        "",
      );
    expect(() => small("100")).toThrow(/current assets of 300 differ from the lines under it, which add up to 200/);
    expect(small("200").balanceSheet.currentYear.currentAssets).toBe(300);
  });

  it("counts bank loans, taxation and social security and accruals in the creditors within one year", () => {
    const small = (accruals) =>
      accountsOf(
        words("uk-bus:EntityDormantTruefalse", "CY", "false") +
          money("core:FixedAssets", "CY_END", "1,000") +
          money("core:BankBorrowingsOverdrafts", "WITHIN_CY", "60") +
          money("core:TaxationSocialSecurityPayable", "WITHIN_CY", "30") +
          money("core:AccruedLiabilities", "ACCRUALS_CY", accruals) +
          money("core:Creditors", "WITHIN_CY", "150"),
        FIRST,
        "",
      );
    expect(() => small("40")).toThrow(/creditors within one year of 150 differ from the lines under it, which add up to 130/);
    expect(small("60").balanceSheet.currentYear).toMatchObject({
      bankLoansOverdrafts: 60,
      taxationSocialSecurity: 30,
      accruals: 60,
      creditorsWithinOneYear: 150,
    });
  });

  it("takes capital and reserves above the reserves it tags, and refuses reserves that add up to more", () => {
    const reserves = (retained) =>
      accountsOf(
        money("core:FixedAssets", "CY_END", "1,000") +
          money("core:NetAssetsLiabilities", "CY_END", "1,000") +
          money("core:Equity", "SHARE_CY", "100") +
          money("core:Equity", "RETAINED_CY", retained) +
          money("core:Equity", "CY_END", "1,000"),
      );
    expect(reserves("700").balanceSheet.currentYear).toMatchObject({
      calledUpShareCapital: 100,
      profitAndLossAccount: 700,
      capitalAndReserves: 1000,
    });
    expect(() => reserves("1,200")).toThrow(/capital and reserves of 1000 differ from the lines under it, which add up to 1300/);
  });

  it("allows a pound of rounding in a total", () => {
    const body =
      money("core:Debtors", "CY_END", "100") + money("core:CashBankOnHand", "CY_END", "199") + money("core:CurrentAssets", "CY_END", "300");
    expect(() => accountsOf(body)).not.toThrow();
  });

  it("refuses profit lines that do not add up", () => {
    const body =
      money("core:TurnoverRevenue", "CY", "1,000") + money("core:CostSales", "CY", "400") + money("core:GrossProfitLoss", "CY", "700");
    expect(() => accountsOf(body)).toThrow(/gross profit of 700 differs from the lines that make it, which give 600/);
  });

  it("takes interest payable off the operating profit to reach the profit before tax", () => {
    const lines =
      money("core:OperatingProfitLoss", "CY", "5,000") +
      money("core:OtherInterestReceivableSimilarIncomeFinanceIncome", "CY", "100") +
      money("core:InterestPayableSimilarChargesFinanceCosts", "CY", "60");
    expect(() => accountsOf(lines + money("core:ProfitLossOnOrdinaryActivitiesBeforeTax", "CY", "5,040"))).not.toThrow();
    expect(() => accountsOf(lines + money("core:ProfitLossOnOrdinaryActivitiesBeforeTax", "CY", "5,100"))).toThrow(
      /profit before tax of 5100 differs from the lines that make it, which give 5040/,
    );
  });

  it("refuses a micro profit that does not follow from its lines", () => {
    const body =
      money("core:TurnoverRevenue", "CY", "7,639") +
      money("core:OtherOperatingExpensesFormat2", "CY", "2,482") +
      money("core:TaxTaxCreditOnProfitOrLossOnOrdinaryActivities", "CY", "984") +
      money("core:ProfitLoss", "CY", "4,000");
    expect(() => accountsOf(body)).toThrow(/profit for the year of 4000 differs/);
  });

  it("refuses a sign that turns the figures round, once the figures are checked", () => {
    expect(() => mapIxbrlAccounts(fixture("doctored-sign.xhtml"), { companyNumber: "06846849" })).toThrow(/profit for the year/);
  });

  it("refuses a file with no prior year", () => {
    expect(() => mapIxbrlAccounts(fixture("doctored-no-prior-year.xhtml"), { companyNumber: "06846849" })).toThrow(
      /no prior-year balance sheet/,
    );
  });

  it("accepts a file with no prior year for a company incorporated inside the period", () => {
    const accounts = mapIxbrlAccounts(fixture("doctored-no-prior-year.xhtml"), { firstAccounts: true });
    expect(accounts.firstAccounts).toBe(true);
    expect(accounts.balanceSheet.priorYear).toEqual({});
  });

  it("refuses a profit and loss account for one year only", () => {
    const body =
      money("core:FixedAssets", "CY_END", "10") + money("core:FixedAssets", "PY_END", "10") + money("core:TurnoverRevenue", "CY", "10");
    expect(() => accountsOf(body, {})).toThrow(/profit and loss account for one year but not the other/);
  });

  it("refuses a file with no balance sheet of its own", () => {
    expect(() => accountsOf(money("core:TurnoverRevenue", "CY", "10"), {})).toThrow(/no balance sheet for its own year/);
  });

  it("refuses a file that states no period", () => {
    const bare = ixbrlDocument({
      contexts: STANDARD_CONTEXTS.replace(/<xbrli:startDate>.*?<\/xbrli:endDate>/g, "<xbrli:instant>2025-03-31</xbrli:instant>"),
    });
    expect(() => mapIxbrlAccounts(bare, FIRST)).toThrow(/states no accounting period|IxbrlError/);
  });

  it("raises IxbrlError, the class the reader raises", () => {
    expect(() => mapIxbrlAccounts(diya(), { companyNumber: "01234567" })).toThrow(IxbrlError);
  });
});

describe("a micro-entity balance sheet with the headings outside the totals", () => {
  const STANDARDS = context("STANDARDS", {
    start: "2024-04-01",
    end: "2025-03-31",
    members: [["uk-bus:AccountingStandardsDimension", "uk-bus:Micro-entities"]],
  });
  const SHARE_PY = context("SHARE_PY", { instant: "2024-03-31", members: [[EQUITY, "core:ShareCapital"]] });
  const RETAINED_PY = context("RETAINED_PY", { instant: "2024-03-31", members: [[EQUITY, "core:RetainedEarningsAccumulatedLosses"]] });
  const HEADINGS = {
    calledUpShareCapitalNotPaid: "CalledUpShareCapitalNotPaidNotExpressedAsCurrentAsset",
    prepaymentsAccruedIncome: "PrepaymentsAccruedIncomeNotExpressedWithinCurrentAssetSubtotal",
    accrualsDeferredIncome: "AccruedLiabilitiesNotExpressedWithinCreditorsSubtotal",
  };

  // A year's lines and the totals they give: prepayments count in the net current assets, called up
  // share capital not paid in the total assets less current liabilities, and accruals and deferred
  // income come off the net assets.
  function year(headings) {
    const lines = { fixedAssets: 800, currentAssets: 6000, creditorsWithinOneYear: 1968, calledUpShareCapital: 100, ...headings };
    const netCurrentAssets = lines.currentAssets + (lines.prepaymentsAccruedIncome ?? 0) - lines.creditorsWithinOneYear;
    const totalAssetsLessCurrentLiabilities = (lines.calledUpShareCapitalNotPaid ?? 0) + lines.fixedAssets + netCurrentAssets;
    const netAssets = totalAssetsLessCurrentLiabilities - (lines.accrualsDeferredIncome ?? 0);
    return { ...lines, netCurrentAssets, totalAssetsLessCurrentLiabilities, netAssets, capitalAndReserves: netAssets };
  }

  function document(current, prior) {
    const facts = (figures, end, share, retained) =>
      [
        ...Object.entries(HEADINGS)
          .filter(([figure]) => figures[figure] !== undefined)
          .map(([figure, concept]) => money(`core:${concept}`, end, String(figures[figure]))),
        money("core:FixedAssets", end, String(figures.fixedAssets)),
        money("core:CurrentAssets", end, String(figures.currentAssets)),
        money("core:Creditors", end === "CY_END" ? "WITHIN_CY" : "WITHIN_PY", String(figures.creditorsWithinOneYear)),
        money("core:NetCurrentAssetsLiabilities", end, String(figures.netCurrentAssets)),
        money("core:TotalAssetsLessCurrentLiabilities", end, String(figures.totalAssetsLessCurrentLiabilities)),
        money("core:NetAssetsLiabilities", end, String(figures.netAssets)),
        money("core:Equity", share, String(figures.calledUpShareCapital)),
        money("core:Equity", retained, String(figures.capitalAndReserves - figures.calledUpShareCapital)),
        money("core:Equity", end, String(figures.capitalAndReserves)),
      ].join("");
    return ixbrlDocument({
      contexts: CONTEXTS + STANDARDS + SHARE_PY + RETAINED_PY,
      hidden: COVER + words("uk-bus:AccountingStandardsApplied", "STANDARDS", "", 'format="ixt2:nocontent"'),
      body: facts(current, "CY_END", "SHARE_CY", "RETAINED_CY") + facts(prior, "PY_END", "SHARE_PY", "RETAINED_PY"),
    });
  }

  it.each([
    ["called up share capital not paid", { calledUpShareCapitalNotPaid: 50 }, { calledUpShareCapitalNotPaid: 40 }],
    ["prepayments and accrued income", { prepaymentsAccruedIncome: 200 }, { prepaymentsAccruedIncome: 120 }],
    ["accruals and deferred income", { accrualsDeferredIncome: 150 }, { accrualsDeferredIncome: 90 }],
    [
      "all three",
      { calledUpShareCapitalNotPaid: 50, prepaymentsAccruedIncome: 200, accrualsDeferredIncome: 150 },
      { calledUpShareCapitalNotPaid: 40, prepaymentsAccruedIncome: 120, accrualsDeferredIncome: 90 },
    ],
  ])("takes %s in both years and gives each as its own line", (_name, currentHeadings, priorHeadings) => {
    const current = year(currentHeadings);
    const prior = year(priorHeadings);
    const accounts = mapIxbrlAccounts(document(current, prior), { regime: "micro" });
    expect(accounts.regime).toBe("micro");
    expect(accounts.balanceSheet.currentYear).toMatchObject({ ...currentHeadings, netAssets: current.netAssets });
    expect(accounts.balanceSheet.priorYear).toMatchObject({ ...priorHeadings, netAssets: prior.netAssets });
    expect(accounts.balanceSheet.currentYear.debtors).toBeUndefined();
    expect(accounts.balanceSheet.currentYear.otherCreditors).toBeUndefined();
  });

  it("still refuses a balance sheet whose headings do not give its totals", () => {
    const current = { ...year({ prepaymentsAccruedIncome: 200 }), prepaymentsAccruedIncome: 300 };
    expect(() => mapIxbrlAccounts(document(current, year({})), { regime: "micro" })).toThrow(/net current assets are stated as 4232/);
  });
});

describe("creditors stated on no maturity, placed within one year only when the stated totals agree", () => {
  const year = (body) => accountsOf(money("core:CurrentAssets", "CY_END", "1,000") + money("core:Creditors", "CY_END", "400") + body);

  it("places them within one year when the stated net current assets agree", () => {
    const accounts = year(money("core:NetCurrentAssetsLiabilities", "CY_END", "600"));
    expect(accounts.balanceSheet.currentYear.creditorsWithinOneYear).toBe(400);
    expect(accounts.unmapped.map((fact) => fact.concept)).not.toContain("Creditors");
  });

  it("places them within one year when the file states no net current assets and its total assets less current liabilities agree", () => {
    const accounts = year(money("core:FixedAssets", "CY_END", "500") + money("core:TotalAssetsLessCurrentLiabilities", "CY_END", "1,100"));
    expect(accounts.balanceSheet.currentYear.creditorsWithinOneYear).toBe(400);
  });

  it("refuses them, naming the fact, when the stated net current assets disagree", () => {
    expect(() => year(money("core:NetCurrentAssetsLiabilities", "CY_END", "1,000"))).toThrow(
      "Current year: the Creditors fact of 400 states no maturity, and the file's net current assets and total assets less current liabilities do not place it within one year.",
    );
  });

  it("refuses them, naming the fact, when the file states neither total", () => {
    expect(() => year(money("core:NetAssetsLiabilities", "CY_END", "600"))).toThrow(/the Creditors fact of 400 states no maturity/);
  });

  it("leaves them to the stated creditors within one year when the file states those", () => {
    const accounts = year(money("core:Creditors", "WITHIN_CY", "400") + money("core:NetCurrentAssetsLiabilities", "CY_END", "600"));
    expect(accounts.balanceSheet.currentYear.creditorsWithinOneYear).toBe(400);
  });
});

describe("accruals and deferred income on each maturity", () => {
  const AFTER_PY = context("ACCRUALS_AFTER", { instant: "2025-03-31", members: [[MATURITY, "core:AfterOneYear"]] });
  const accountsOn = (body) => mapIxbrlAccounts(ixbrlDocument({ contexts: CONTEXTS + AFTER_PY, hidden: COVER, body }), FIRST);
  const microFace = (accruals, netAssets) =>
    money("core:FixedAssets", "CY_END", "1,000") +
    money("core:CurrentAssets", "CY_END", "500") +
    money("core:Creditors", "WITHIN_CY", "200") +
    money("core:AccruedLiabilitiesDeferredIncome", "CY_END", accruals) +
    money("core:NetAssetsLiabilities", "CY_END", netAssets);

  it("reads them within one year as the accruals line of the creditors", () => {
    const year = accountsOn(money("core:AccruedLiabilitiesDeferredIncome", "WITHIN_CY", "40")).balanceSheet.currentYear;
    expect(year.accruals).toBe(40);
    expect(year.accrualsDeferredIncome).toBeUndefined();
  });

  it("reads them after one year as creditors after one year when the file states no total of those", () => {
    const year = accountsOn(money("core:AccruedLiabilitiesDeferredIncome", "ACCRUALS_AFTER", "90")).balanceSheet.currentYear;
    expect(year.creditorsAfterOneYear).toBe(90);
  });

  it("reads them on no maturity as the heading outside the creditors when the stated net assets take them off once", () => {
    const year = accountsOn(microFace("150", "1,150")).balanceSheet.currentYear;
    expect(year).toMatchObject({ accrualsDeferredIncome: 150, creditorsWithinOneYear: 200, netAssets: 1150 });
    expect(year.accruals).toBeUndefined();
  });

  it("leaves them unmapped on no maturity when the stated net assets do not take them off", () => {
    const accounts = accountsOn(microFace("150", "1,300"));
    expect(accounts.balanceSheet.currentYear.accrualsDeferredIncome).toBeUndefined();
    expect(accounts.unmapped.map((fact) => fact.concept)).toContain("AccruedLiabilitiesDeferredIncome");
  });

  it("reads the accruals and deferred income heading the file names outside the creditors before the plain one", () => {
    const year = accountsOn(microFace("150", "1,230") + money("core:AccruedLiabilitiesNotExpressedWithinCreditorsSubtotal", "CY_END", "70"))
      .balanceSheet.currentYear;
    expect(year.accrualsDeferredIncome).toBe(70);
  });
});

describe("a balance due within or after one year, by the financial instrument members", () => {
  const INSTRUMENT = "core:FinancialInstrumentCurrentNon-currentDimension";
  const MATURITY_CONTEXTS =
    context("CURRENT_CY", { instant: "2025-03-31", members: [[INSTRUMENT, "core:CurrentFinancialInstruments"]] }) +
    context("NONCURRENT_CY", { instant: "2025-03-31", members: [[INSTRUMENT, "core:Non-currentFinancialInstruments"]] }) +
    context("NONCURRENT_AFTER_CY", {
      instant: "2025-03-31",
      members: [
        [INSTRUMENT, "core:Non-currentFinancialInstruments"],
        [MATURITY, "core:AfterOneYear"],
      ],
    });
  const accountsOn = (body) => mapIxbrlAccounts(ixbrlDocument({ contexts: CONTEXTS + MATURITY_CONTEXTS, hidden: COVER, body }), FIRST);

  it("reads creditors on the current financial instruments member as due within one year", () => {
    const accounts = accountsOn(
      money("core:CurrentAssets", "CY_END", "1,000") +
        money("core:Creditors", "CURRENT_CY", "400") +
        money("core:NetCurrentAssetsLiabilities", "CY_END", "600"),
    );
    expect(accounts.balanceSheet.currentYear.creditorsWithinOneYear).toBe(400);
  });

  it("reads creditors on the non-current financial instruments member, alone or with after one year, as due after one year", () => {
    const after = (contextRef) =>
      accountsOn(
        money("core:FixedAssets", "CY_END", "1,000") +
          money("core:Creditors", contextRef, "300") +
          money("core:NetAssetsLiabilities", "CY_END", "700"),
      ).balanceSheet.currentYear.creditorsAfterOneYear;
    expect(after("NONCURRENT_CY")).toBe(300);
    expect(after("NONCURRENT_AFTER_CY")).toBe(300);
  });

  it("reads the creditor lines, accruals and bank loans on the financial instruments members", () => {
    const year = accountsOn(
      money("core:TradeCreditorsTradePayables", "CURRENT_CY", "10") +
        money("core:CorporationTaxPayable", "CURRENT_CY", "20") +
        money("core:OtherCreditors", "CURRENT_CY", "30") +
        money("core:TaxationSocialSecurityPayable", "CURRENT_CY", "40") +
        money("core:AccruedLiabilities", "CURRENT_CY", "50") +
        money("core:BankBorrowingsOverdrafts", "CURRENT_CY", "60") +
        money("core:BankBorrowingsOverdrafts", "NONCURRENT_CY", "70") +
        money("core:Debtors", "CURRENT_CY", "80"),
    ).balanceSheet.currentYear;
    expect(year).toMatchObject({
      tradeCreditors: 10,
      corporationTax: 20,
      otherCreditors: 30,
      taxationSocialSecurity: 40,
      accruals: 50,
      bankLoansOverdrafts: 60,
      bankLoansAfterOneYear: 70,
      creditorsAfterOneYear: 70,
      debtors: 80,
    });
  });
});

describe("the files from the register and the builders, read as accounts", () => {
  it("reads DIY Accounting Limited's 2025 accounts, with the figures as the document shows them", () => {
    const accounts = mapIxbrlAccounts(fixture("diya-2025-accounts.xhtml"), { companyNumber: "06846849", periodEnd: "2025-03-31" });
    expect(accounts.company).toEqual({ number: "06846849", name: "DIY ACCOUNTING LIMITED" });
    expect(accounts.period).toEqual({ start: "2024-04-01", end: "2025-03-31" });
    expect(accounts.priorPeriod).toEqual({ start: "2023-04-01", end: "2024-03-31" });
    expect(accounts.regime).toBe("micro");
    expect(accounts.dormant).toBe(false);
    expect(accounts.filleted).toBe(false);
    expect(accounts.balanceSheet.currentYear).toEqual({
      fixedAssets: 0,
      prepaymentsAccruedIncome: 0,
      calledUpShareCapitalNotPaid: 0,
      currentAssets: 3353,
      accrualsDeferredIncome: 0,
      creditorsWithinOneYear: 3219,
      creditorsAfterOneYear: 0,
      provisionsForLiabilities: 0,
      netAssets: 134,
      netCurrentAssets: 134,
      totalAssetsLessCurrentLiabilities: 134,
      capitalAndReserves: 134,
    });
    expect(accounts.balanceSheet.priorYear).toMatchObject({
      currentAssets: 3409,
      creditorsWithinOneYear: 3307,
      netAssets: 102,
      capitalAndReserves: 102,
    });
    expect(accounts.profitAndLoss.currentYear).toEqual({
      turnover: 7639,
      otherOperatingIncome: 22,
      rawMaterialsConsumables: 0,
      staffCosts: 0,
      depreciation: 0,
      otherOperatingExpenses: 2482,
      tax: 984,
      profit: 4195,
    });
    expect(accounts.profitAndLoss.priorYear).toMatchObject({
      turnover: 8908,
      otherOperatingIncome: 36,
      otherOperatingExpenses: 3014,
      tax: 1127,
      profit: 4803,
    });
    expect(accounts.averageEmployees).toBe(0);
    expect(accounts.principalActivity).toBe("Retailer of Accounting Software");
    expect(accounts.directors).toEqual(["Antony Christopher Cartwright", "Samantha Ashley Cartwright", "Jane Elizabeth Grundy"]);
    expect(accounts.signer).toBe("Antony Christopher Cartwright");
    expect(accounts.approvalDate).toBe("2025-12-31");
    expect(accounts.fixedAssetNote).toBeNull();
    expect(accounts.unmapped.map((fact) => fact.concept)).toEqual([
      "GeneralDescriptionAnyOff-balanceSheetArrangementsIncludingNaturePurposeFinancialImpactOnEntity",
    ]);
  });

  it("reads the builder's bank loans, taxation and social security and accruals back to the figures they were built from", () => {
    const { currentYear } = mapIxbrlAccounts(fixture("builder-small-bank-lines.xhtml"), {
      companyNumber: "02706061",
      regime: "small",
      dormant: false,
    }).balanceSheet;
    expect(currentYear).toMatchObject({
      bankLoansOverdrafts: 300,
      tradeCreditors: 1000,
      corporationTax: 1500,
      taxationSocialSecurity: 200,
      otherCreditors: 300,
      accruals: 400,
      creditorsWithinOneYear: 3700,
      bankLoansAfterOneYear: 1200,
      creditorsAfterOneYear: 2000,
      capitalAndReserves: 9300,
    });
  });

  // The builder's 2026 creditors within one year of 3,700 are bank loans 300, trade creditors 1,000,
  // corporation tax 1,500, taxation and social security 200, other creditors 300 and accruals 400.
  const bankLines = () => fixture("builder-small-bank-lines.xhtml").toString("utf-8");
  const withTaxationSocialSecurity = (value) => {
    const text = bankLines();
    const changed = text.replace(/(name="core:TaxationSocialSecurityPayable" contextRef="e2026-within-one-year"[^>]*>)200</, `$1${value}<`);
    expect(changed).not.toBe(text);
    return mapIxbrlAccounts(changed, { companyNumber: "02706061" });
  };

  it("counts taxation and social security once, as the total that includes the corporation tax, when the creditors total says so", () => {
    const accounts = withTaxationSocialSecurity("1,700");
    expect(accounts.balanceSheet.currentYear).toMatchObject({
      corporationTax: 1500,
      taxationSocialSecurity: 200,
      creditorsWithinOneYear: 3700,
    });
    expect(accounts.notes).toEqual([
      "Current year: the taxation and social security of 1700 include the corporation tax of 1500, as the creditors within one year state; the other taxation and social security is 200.",
    ]);
  });

  it("reads the builder's taxation and social security beside the corporation tax, as its creditors total adds them", () => {
    const accounts = mapIxbrlAccounts(fixture("builder-small-bank-lines.xhtml"), { companyNumber: "02706061" });
    expect(accounts.balanceSheet.currentYear).toMatchObject({ corporationTax: 1500, taxationSocialSecurity: 200 });
    expect(accounts.notes).toEqual([]);
  });

  it("refuses taxation and social security that neither reading of the creditors total explains", () => {
    expect(() => withTaxationSocialSecurity("1,000")).toThrow(
      "The current-year creditors within one year of 3700 differ from the lines under it, which add up to 4500.",
    );
  });

  it("reads the builders' small company accounts back to the figures they were built from", () => {
    const accounts = mapIxbrlAccounts(fixture("builder-small-consistent.xhtml"), {
      companyNumber: "03176906",
      regime: "small",
      dormant: false,
    });
    expect(accounts.company.name).toBe("MILLENNIUM STADIUM PLC");
    expect(accounts.filleted).toBe(false);
    expect(accounts.balanceSheet.currentYear).toMatchObject({
      fixedAssets: 10000,
      stocks: 500,
      debtors: 2500,
      cashAtBank: 10600,
      currentAssets: 13600,
      tradeCreditors: 1000,
      corporationTax: 969,
      otherCreditors: 500,
      creditorsWithinOneYear: 2469,
      creditorsAfterOneYear: 2000,
      calledUpShareCapital: 100,
      profitAndLossAccount: 19031,
      capitalAndReserves: 19131,
    });
    expect(accounts.balanceSheet.priorYear).toMatchObject({
      fixedAssets: 9500,
      cashAtBank: 7100,
      corporationTax: 1000,
      capitalAndReserves: 15000,
    });
    expect(accounts.profitAndLoss.currentYear).toEqual({
      turnover: 50000,
      costOfSales: 20000,
      grossProfit: 30000,
      administrativeExpenses: 25000,
      operatingProfit: 5000,
      interestReceivable: 100,
      profitBeforeTax: 5100,
      tax: 969,
      profit: 4131,
    });
    expect(accounts.fixedAssetNote).toEqual({
      landBuildings: {
        costAtStart: 6000,
        additions: 0,
        disposals: 0,
        depreciationAtStart: 0,
        depreciationCharge: 0,
        depreciationOnDisposals: 0,
      },
      computerEquipment: {
        costAtStart: 5000,
        additions: 1000,
        disposals: 0,
        depreciationAtStart: 1500,
        depreciationCharge: 500,
        depreciationOnDisposals: 0,
      },
    });
    expect(accounts.directors).toEqual(["Maldwyn Beynon", "Alex Jones"]);
    expect(accounts.principalActivity).toBe("Software consultancy");
    expect(accounts.averageEmployees).toBe(4);
  });

  it("reads the builders' filleted accounts as filleted, with no profit and loss account", () => {
    const accounts = mapIxbrlAccounts(fixture("builder-small-filleted.xhtml"), { companyNumber: "03176906" });
    expect(accounts.filleted).toBe(true);
    expect(accounts.profitAndLoss).toBeNull();
    expect(accounts.balanceSheet.currentYear.capitalAndReserves).toBe(20000);
  });

  it("reads the builders' micro-entity and dormant accounts", () => {
    const micro = mapIxbrlAccounts(fixture("builder-micro.xhtml"), { regime: "micro", dormant: false });
    expect(micro.balanceSheet.currentYear).toMatchObject({
      fixedAssets: 1000,
      currentAssets: 5000,
      creditorsWithinOneYear: 2000,
      capitalAndReserves: 4000,
    });
    expect(micro.averageEmployees).toBe(2);
    const dormant = mapIxbrlAccounts(fixture("builder-micro-dormant.xhtml"), { regime: "micro", dormant: true });
    expect(dormant.dormant).toBe(true);
    expect(dormant.tradingStatus).toBe("EntityHasNeverTraded");
    expect(dormant.shareNote).toEqual({ shares: 100, nominalValue: 1, shareClass: "OrdinaryShareClass1" });
  });

  it("reads another vendor's small, filleted, micro and dormant files, on the 2023 to 2026 suites", () => {
    const small = mapIxbrlAccounts(fixture("adp-small-full.xhtml"), { regime: "small" });
    expect(small.company).toEqual({ number: "15582405", name: "NOMAD MAISON LTD" });
    expect(small.suite.date).toBe("2023-01-01");
    expect(small.profitAndLoss.currentYear).toMatchObject({
      turnover: 46099,
      costOfSales: 12000,
      grossProfit: 34099,
      profitBeforeTax: 9064,
    });
    expect(small.fixedAssetNote.landBuildings).toMatchObject({ costAtStart: 16255, depreciationCharge: 3251 });
    expect(small.balanceSheet.currentYear).toMatchObject({
      fixedAssets: 14568,
      stocks: 51000,
      cashAtBank: 21500,
      capitalAndReserves: 87069,
    });
    expect(small.balanceSheet.currentYear.profitAndLossAccount).toBe(87068);

    const filleted = mapIxbrlAccounts(fixture("adp-small-filleted.xhtml"), { regime: "small" });
    expect(filleted.filleted).toBe(true);
    expect(filleted.balanceSheet.currentYear.capitalAndReserves).toBe(100);

    const micro = mapIxbrlAccounts(fixture("adp-micro.xhtml"), { regime: "micro", dormant: false });
    expect(micro.balanceSheet.currentYear).toMatchObject({ currentAssets: 6005, creditorsWithinOneYear: 5791, capitalAndReserves: 214 });

    const dormant = mapIxbrlAccounts(fixture("adp-dormant.xhtml"), { dormant: true });
    expect(dormant.dormant).toBe(true);
    expect(dormant.balanceSheet.currentYear.capitalAndReserves).toBe(100);
  });
});

describe("the profit and loss format", () => {
  const formatOf = (body) => accountsOf(body).profitAndLoss.format;
  const pl = (body) => accountsOf(body).profitAndLoss;
  const turnover = money("core:TurnoverRevenue", "CY", "1,000") + money("core:TurnoverRevenue", "PY", "900");

  it("is 1 when the file states cost of sales or gross profit", () => {
    expect(formatOf(turnover + money("core:CostSales", "CY", "400") + money("core:CostSales", "PY", "300"))).toBe(1);
    expect(
      formatOf(
        turnover +
          money("core:CostSales", "CY", "300") +
          money("core:CostSales", "PY", "300") +
          money("core:GrossProfitLoss", "CY", "700") +
          money("core:GrossProfitLoss", "PY", "600"),
      ),
    ).toBe(1);
    expect(formatOf(turnover + money("core:DistributionCosts", "CY", "10") + money("core:DistributionCosts", "PY", "10"))).toBe(1);
  });

  it("is 2 when the file states a line by nature and none by function", () => {
    expect(
      formatOf(turnover + money("core:RawMaterialsConsumablesUsed", "CY", "300") + money("core:RawMaterialsConsumablesUsed", "PY", "200")),
    ).toBe(2);
    expect(formatOf(turnover + money("core:OtherExternalCharges", "CY", "300") + money("core:OtherExternalCharges", "PY", "200"))).toBe(2);
  });

  it("is 1 when the file states neither, which reads turnover and profit only", () => {
    const accounts = pl(turnover + money("core:ProfitLoss", "CY", "100") + money("core:ProfitLoss", "PY", "90"));
    expect(accounts.format).toBe(1);
    expect(accounts.currentYear).toEqual({ turnover: 1000, profit: 100 });
  });

  it("leaves a Format 2 concept of a Format 1 file in the unmapped list as a note figure", () => {
    const body =
      turnover +
      money("core:CostSales", "CY", "400") +
      money("core:CostSales", "PY", "300") +
      money("core:StaffCostsEmployeeBenefitsExpense", "CY", "200") +
      money("core:StaffCostsEmployeeBenefitsExpense", "PY", "180");
    const accounts = accountsOf(body);
    expect(accounts.profitAndLoss.format).toBe(1);
    expect(accounts.profitAndLoss.currentYear.staffCosts).toBeUndefined();
    expect(accounts.unmapped.map((entry) => entry.concept)).toContain("StaffCostsEmployeeBenefitsExpense");
  });

  it("reads the Format 2 lines of both years, and the staff costs as the sum of their parts when the total is absent", () => {
    const body =
      turnover +
      money("core:IncreaseDecreaseInStocksInventoriesFinishedGoodsWorkInProgress", "CY", "30") +
      money("core:OwnWorkCapitalised", "CY", "20") +
      money("core:RawMaterialsConsumablesUsed", "CY", "300") +
      money("core:OtherExternalCharges", "CY", "60") +
      money("core:WagesSalaries", "CY", "200") +
      money("core:SocialSecurityCosts", "CY", "20") +
      money("core:PensionOtherPost-employmentBenefitCostsOtherPensionCosts", "CY", "10") +
      money("core:OtherOperatingExpensesFormat2", "CY", "100") +
      money("core:OperatingProfitLoss", "CY", "360") +
      money("core:RawMaterialsConsumablesUsed", "PY", "200");
    const accounts = accountsOf(body);
    expect(accounts.profitAndLoss.format).toBe(2);
    expect(accounts.profitAndLoss.currentYear).toMatchObject({
      changeInStocks: 30,
      ownWorkCapitalised: 20,
      rawMaterialsConsumables: 300,
      otherExternalCharges: 60,
      staffCosts: 230,
      wagesSalaries: 200,
      socialSecurityCosts: 20,
      pensionCosts: 10,
      otherOperatingExpenses: 100,
    });
    expect(accounts.profitAndLoss.priorYear).toMatchObject({ turnover: 900, rawMaterialsConsumables: 200 });
    expect(accounts.unmapped).toEqual([]);
  });

  it("refuses an operating profit that does not follow from the Format 2 lines", () => {
    const body =
      turnover +
      money("core:RawMaterialsConsumablesUsed", "CY", "300") +
      money("core:OtherExternalCharges", "CY", "60") +
      money("core:OperatingProfitLoss", "CY", "700");
    expect(() => accountsOf(body)).toThrow(/operating profit of 700 differs from the lines that make it, which give 640/);
  });

  it("takes interest into the Format 2 profit for the year", () => {
    const lines =
      turnover +
      money("core:RawMaterialsConsumablesUsed", "CY", "300") +
      money("core:OtherInterestReceivableSimilarIncomeFinanceIncome", "CY", "10") +
      money("core:TaxTaxCreditOnProfitOrLossOnOrdinaryActivities", "CY", "100");
    expect(() => accountsOf(lines + money("core:ProfitLoss", "CY", "610"))).not.toThrow();
    expect(() => accountsOf(lines + money("core:ProfitLoss", "CY", "600"))).toThrow(/profit for the year of 600 differs/);
  });

  it("reads a small company's Format 2 file from the Accounts Data Product", () => {
    const accounts = mapIxbrlAccounts(fixture("adp-small-format2.xhtml"), { regime: "small", companyNumber: "11134922" });
    expect(accounts.regime).toBe("small");
    expect(accounts.notes).toEqual([]);
    expect(accounts.profitAndLoss.format).toBe(2);
    expect(accounts.profitAndLoss.currentYear).toMatchObject({
      turnover: 32400,
      rawMaterialsConsumables: 1810,
      staffCosts: 16200,
      depreciation: 112,
      otherOperatingExpenses: 5310,
      otherOperatingIncome: 0,
      profitBeforeTax: 8968,
      tax: 1697,
      profit: 7271,
    });
    expect(accounts.profitAndLoss.priorYear).toMatchObject({ turnover: 29800, profitBeforeTax: 7962, profit: 6438 });
  });

  it("gives the Format 1 file of another vendor format 1", () => {
    expect(mapIxbrlAccounts(fixture("adp-small-full.xhtml"), { regime: "small" }).profitAndLoss.format).toBe(1);
  });

  it("keeps the micro-entity lines of a micro-entity file", () => {
    const accounts = mapIxbrlAccounts(fixture("diya-2025-accounts.xhtml"), { companyNumber: "06846849" });
    expect(accounts.profitAndLoss.format).toBe(2);
    expect(accounts.profitAndLoss.currentYear).toMatchObject({ turnover: 7639, otherOperatingIncome: 22, otherOperatingExpenses: 2482 });
  });
});
