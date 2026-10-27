// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ixbrl-uk-gaap.js — the translation from the old UK GAAP taxonomy (the
// 2009-09-01 suite: uk-gaap, uk-bus and uk-direp) to the FRS 102 names that
// ixbrl-accounts.js reads. The reader applies it once, after it has found the
// suite, so the mapping, the checks and the summary book read FRS 102 names
// only. A translated fact keeps `sourceConcept`, the UK GAAP name it came
// from. A UK GAAP name this table does not hold keeps its own name and its
// own namespace, and the mapping lists it as unmapped.

export const UK_GAAP_SUITE_DATE = "2009-09-01";

const NS_UK_GAAP = `http://www.xbrl.org/uk/gaap/core/${UK_GAAP_SUITE_DATE}`;
const NS_UK_BUS = `http://www.xbrl.org/uk/cd/business/${UK_GAAP_SUITE_DATE}`;
const NS_UK_DIREP = `http://www.xbrl.org/uk/reports/direp/${UK_GAAP_SUITE_DATE}`;

// The namespaces a translated fact, dimension and member take. The mapping
// matches by local name, so these only say the name is an FRS 102 one.
const FRS_NAMESPACE = {
  "uk-gaap": "http://xbrl.frc.org.uk/fr/2022-01-01/core",
  "uk-bus": "http://xbrl.frc.org.uk/cd/2022-01-01/business",
  "uk-direp": "http://xbrl.frc.org.uk/reports/2022-01-01/direp",
};

const MODULE_OF_NAMESPACE = { [NS_UK_GAAP]: "uk-gaap", [NS_UK_BUS]: "uk-bus", [NS_UK_DIREP]: "uk-direp" };

const MATURITY = "MaturitiesOrExpirationPeriodsDimension";
const EQUITY_CLASS = "EquityClassesDimension";
const WITHIN = "WithinOneYear";
const AFTER = "AfterOneYear";

const row = (module, concept, to = concept, dimension, member) => ({
  module,
  concept,
  to,
  ...(dimension ? { dimension, member } : {}),
});
const gaap = (concept, to, dimension, member) => row("uk-gaap", concept, to, dimension, member);
const bus = (concept, to) => row("uk-bus", concept, to);

/**
 * One row per UK GAAP name: the FRS 102 local name, and the dimension and
 * member the translated fact gains (replacing the fact's own value for that
 * dimension). `OtherOperatingIncome` is the one row whose target depends on
 * the file: `toWithGrossProfit` when the file states `CostSales` or
 * `GrossProfitLoss`, `to` otherwise.
 */
export const UK_GAAP_TO_FRS_102 = [
  gaap("FixedAssets"),
  gaap("TangibleFixedAssets", "PropertyPlantEquipment"),
  gaap("TangibleFixedAssetsCostOrValuation", "PropertyPlantEquipmentGrossCost"),
  gaap("TangibleFixedAssetsAdditions", "AdditionsOtherThanThroughBusinessCombinationsPropertyPlantEquipment"),
  gaap("TangibleFixedAssetsDisposals", "DisposalsPropertyPlantEquipment"),
  gaap("TangibleFixedAssetsDepreciation", "AccumulatedDepreciationImpairmentPropertyPlantEquipment"),
  gaap("TangibleFixedAssetsDepreciationChargedInPeriod", "IncreaseFromDepreciationChargeForYearPropertyPlantEquipment"),
  gaap("TangibleFixedAssetsDepreciationDecreaseIncreaseOnDisposals", "DisposalsDecreaseInDepreciationImpairmentPropertyPlantEquipment"),
  gaap("StocksInventory", "TotalInventories"),
  gaap("Debtors"),
  gaap("DebtorsDueWithinOneYear", "Debtors", MATURITY, WITHIN),
  gaap("PrepaymentsAccruedIncomeNotExpressedWithinCurrentAssetSubtotal"),
  gaap("CashBankInHand", "CashBankOnHand"),
  gaap("CurrentAssets"),
  gaap("NetCurrentAssetsLiabilities"),
  gaap("TotalAssetsLessCurrentLiabilities"),
  gaap("CreditorsDueWithinOneYear", "Creditors", MATURITY, WITHIN),
  gaap("CreditorsDueAfterOneYear", "Creditors", MATURITY, AFTER),
  gaap("TradeCreditors", "TradeCreditorsTradePayables", MATURITY, WITHIN),
  gaap("TradeCreditorsWithinOneYear", "TradeCreditorsTradePayables", MATURITY, WITHIN),
  gaap("CorporationTax", "CorporationTaxPayable"),
  gaap("CorporationTaxDueWithinOneYear", "CorporationTaxPayable"),
  gaap("OtherCreditors", "OtherCreditors", MATURITY, WITHIN),
  gaap("OtherCreditorsDueWithinOneYear", "OtherCreditors", MATURITY, WITHIN),
  gaap("TaxationSocialSecurityDueWithinOneYear", "TaxationSocialSecurityPayable", MATURITY, WITHIN),
  gaap("AccrualsDeferredIncomeWithinOneYear", "AccruedLiabilitiesNotExpressedWithinCreditorsSubtotal", MATURITY, WITHIN),
  gaap("ProvisionsForLiabilitiesCharges", "ProvisionsForLiabilitiesBalanceSheetSubtotal"),
  gaap("NetAssetsLiabilitiesIncludingPensionAssetLiability", "NetAssetsLiabilities"),
  gaap("CalledUpShareCapital", "Equity", EQUITY_CLASS, "ShareCapital"),
  gaap("ProfitLossAccountReserve", "Equity", EQUITY_CLASS, "RetainedEarningsAccumulatedLosses"),
  gaap("RevaluationReserve", "Equity", EQUITY_CLASS, "RevaluationReserve"),
  gaap("ShareholderFunds", "Equity"),
  gaap("TurnoverGrossOperatingRevenue", "TurnoverRevenue"),
  gaap("CostSales"),
  gaap("GrossProfitLoss"),
  gaap("AdministrativeExpenses"),
  gaap("OperatingProfitLoss"),
  gaap("ProfitLossOnOrdinaryActivitiesBeforeTax"),
  gaap("ProfitLossOnOrdinaryActivitiesAfterTax"),
  gaap("OtherInterestReceivableSimilarIncome", "OtherInterestReceivableSimilarIncomeFinanceIncome"),
  gaap("InterestPayableSimilarCharges", "InterestPayableSimilarChargesFinanceCosts"),
  gaap("TaxOnProfitOrLossOnOrdinaryActivities", "TaxTaxCreditOnProfitOrLossOnOrdinaryActivities"),
  gaap("ProfitLossForPeriod", "ProfitLoss"),
  { ...gaap("OtherOperatingIncome", "OtherOperatingIncomeFormat2"), toWithGrossProfit: "OtherOperatingIncomeFormat1" },
  gaap("RawMaterialsConsumables", "RawMaterialsConsumablesUsed"),
  gaap("OtherExternalCharges"),
  gaap("OwnWorkCapitalised"),
  gaap("WagesSalaries"),
  gaap("SocialSecurityCosts"),
  gaap("IncreaseDecreaseInStocksFinishedGoodsWorkInProgress", "IncreaseDecreaseInStocksInventoriesFinishedGoodsWorkInProgress"),
  gaap("StaffCosts", "StaffCostsEmployeeBenefitsExpense"),
  gaap("DepreciationOtherAmountsWrittenOffTangibleIntangibleFixedAssets", "DepreciationAmortisationImpairmentExpense"),
  gaap("OtherOperatingChargesFormat2", "OtherOperatingExpensesFormat2"),
  gaap("AverageNumberEmployeesDuringPeriod"),
  gaap("ParValueShare"),
  gaap("ShareCapitalAllottedCalledUpPaid", "ShareCapital"),
  gaap("TradeDebtors", "TradeDebtorsTradeReceivables"),
  gaap("OtherDebtors"),
  gaap("IntangibleFixedAssets", "IntangibleAssets"),
  gaap("BankBorrowingsOverdrafts"),
  bus("UKCompaniesHouseRegisteredNumber"),
  bus("EntityCurrentLegalOrRegisteredName"),
  bus("BalanceSheetDate"),
  bus("StartDateForPeriodCoveredByReport"),
  bus("EndDateForPeriodCoveredByReport"),
  bus("DescriptionPrincipalActivities"),
  bus("NameEntityOfficer"),
  bus("EntityDormant", "EntityDormantTruefalse"),
  gaap("NameDirectorSigningAccounts", "DirectorSigningFinancialStatements"),
  gaap("DateApprovalAccounts", "DateAuthorisationFinancialStatementsForIssue"),
  gaap("NumberSharesAllotted", "NumberSharesIssuedFullyPaid"),
  gaap("NominalValueSharesIssued", "NominalValueAllottedShareCapital"),
];

// The old suite names some dimensions and members the FRS 102 suite names differently. Members not listed keep their name.
export const UK_GAAP_DIMENSIONS_TO_FRS_102 = {
  MaturitiesDimension: { to: MATURITY, members: {} },
  TangibleFixedAssetClassesDimension: {
    to: "PropertyPlantEquipmentClassesDimension",
    members: { FixturesFittings: "FurnitureFittings" },
  },
};

const ROWS = new Map(UK_GAAP_TO_FRS_102.map((entry) => [`${entry.module}:${entry.concept}`, entry]));

const localOf = (key) => key.slice(key.indexOf("#") + 1);

function translatedDimensions(dimensions, entry, module) {
  const out = {};
  for (const [dimensionKey, memberKey] of Object.entries(dimensions)) {
    const renamed = UK_GAAP_DIMENSIONS_TO_FRS_102[localOf(dimensionKey)];
    if (renamed && MODULE_OF_NAMESPACE[dimensionKey.slice(0, dimensionKey.indexOf("#"))]) {
      const member = localOf(memberKey);
      out[`${FRS_NAMESPACE["uk-gaap"]}#${renamed.to}`] = `${FRS_NAMESPACE["uk-gaap"]}#${renamed.members[member] ?? member}`;
    } else {
      out[dimensionKey] = memberKey;
    }
  }
  if (entry.dimension) {
    out[`${FRS_NAMESPACE[module]}#${entry.dimension}`] = `${FRS_NAMESPACE[module]}#${entry.member}`;
  }
  return out;
}

function factKey(fact) {
  const dimensions = Object.entries(fact.dimensions)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([dimension, member]) => `${dimension}=${member}`)
    .join(",");
  const period = fact.period.instant ?? `${fact.period.startDate}/${fact.period.endDate}`;
  return `${fact.namespace}#${fact.localName}|${fact.entity.scheme}|${fact.entity.identifier}|${period}|${dimensions}|${fact.unit ?? ""}`;
}

/**
 * Translate the UK GAAP facts of a read into FRS 102 names.
 * Two UK GAAP names that translate to the same fact (a total and the same
 * total restated within one year) give one fact when they agree; when they
 * differ the first is translated and the second keeps its UK GAAP name.
 * @param {Array<Object>} facts - facts from the reader
 * @returns {Array<Object>} the facts, translated where the table holds the name
 */
export function translateUkGaapFacts(facts) {
  const grossProfitStated = facts.some(
    (fact) => fact.namespace === NS_UK_GAAP && (fact.localName === "CostSales" || fact.localName === "GrossProfitLoss"),
  );
  const out = [];
  const taken = new Map();
  for (const fact of facts) {
    const module = MODULE_OF_NAMESPACE[fact.namespace];
    const entry = module ? ROWS.get(`${module}:${fact.localName}`) : undefined;
    if (!entry) {
      out.push(fact);
      continue;
    }
    const localName = grossProfitStated && entry.toWithGrossProfit ? entry.toWithGrossProfit : entry.to;
    const translated = {
      ...fact,
      namespace: FRS_NAMESPACE[module],
      localName,
      dimensions: translatedDimensions(fact.dimensions, entry, module),
      sourceConcept: fact.localName,
    };
    const key = factKey(translated);
    const earlier = taken.get(key);
    if (earlier === undefined) {
      taken.set(key, translated);
      out.push(translated);
    } else if (earlier.value !== translated.value) {
      out.push(fact);
    }
  }
  return out;
}
