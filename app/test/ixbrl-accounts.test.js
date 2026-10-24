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

const CONTEXTS = STANDARD_CONTEXTS + MEMBER_CONTEXTS.join("") + DURATION_MEMBER_CONTEXTS.join("") + OFFICER_CONTEXTS;

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
  ["TotalInventories", money("core:TotalInventories", "CY_END", "500"), "balanceSheet.currentYear.stocks", 500],
  ["Debtors", money("core:Debtors", "CY_END", "2,500"), "balanceSheet.currentYear.debtors", 2500],
  ["Debtors", money("core:Debtors", "WITHIN_CY", "2,400"), "balanceSheet.currentYear.debtors", 2400],
  [
    "PrepaymentsAccruedIncomeNotExpressedWithinCurrentAssetSubtotal",
    money("core:Debtors", "CY_END", "2,000") +
      money("core:PrepaymentsAccruedIncomeNotExpressedWithinCurrentAssetSubtotal", "CY_END", "300"),
    "balanceSheet.currentYear.debtors",
    2300,
  ],
  [
    "CalledUpShareCapitalNotPaidNotExpressedAsCurrentAsset",
    money("core:Debtors", "CY_END", "2,000") + money("core:CalledUpShareCapitalNotPaidNotExpressedAsCurrentAsset", "CY_END", "100"),
    "balanceSheet.currentYear.debtors",
    2100,
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
    "balanceSheet.currentYear.otherCreditors",
    570,
  ],
  ["Creditors", money("core:Creditors", "WITHIN_CY", "3,000"), "balanceSheet.currentYear.creditorsWithinOneYear", 3000],
  ["Creditors", money("core:Creditors", "AFTER_CY", "2,000"), "balanceSheet.currentYear.creditorsAfterOneYear", 2000],
  [
    "ProvisionsForLiabilitiesBalanceSheetSubtotal",
    money("core:Creditors", "AFTER_CY", "2,000") + money("core:ProvisionsForLiabilitiesBalanceSheetSubtotal", "CY_END", "250"),
    "balanceSheet.currentYear.creditorsAfterOneYear",
    2250,
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
    expect(MAPPING_TABLE).toHaveLength(51);
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

  it("names the provisions and the reserves it folds into other lines", () => {
    const provisions = accountsOf(money("core:ProvisionsForLiabilitiesBalanceSheetSubtotal", "CY_END", "250"));
    expect(provisions.notes.join(" ")).toMatch(/provisions for liabilities of 250/);
    const reserves = accountsOf(money("core:Equity", "REVAL_CY", "1,000"));
    expect(reserves.notes.join(" ")).toMatch(/RevaluationReserve 1000/);
  });

  it("lists a fact the table does not name as unmapped", () => {
    const accounts = accountsOf(money("core:GoodwillAndSuch", "CY_END", "77") + money("core:FixedAssets", "CY_END", "10"));
    expect(accounts.unmapped).toEqual([{ concept: "GoodwillAndSuch", dimensions: {}, period: { instant: "2025-03-31" }, value: 77 }]);
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
      debtors: 0,
      currentAssets: 3353,
      otherCreditors: 0,
      creditorsWithinOneYear: 3219,
      creditorsAfterOneYear: 0,
      provisions: 0,
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
