// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ixbrl-accounts.js — turns the facts ixbrl-reader.js reads into the accounts
// figures a form and the accounts builders take: balance sheet and profit and
// loss for the current and prior year, the fixed asset note, the micro-entity
// lines, and the facts about the company the file states about itself.
//
// Every concept is matched by its FRC local name and, where it needs one, a
// dimension and member (also by local name), never by prefix or by the suite's
// date, so a file on the 2022 suite and one on the 2026 suite read the same.
// MAPPING_TABLE is the one list of what is mapped and where it lands in the
// summary book (ixbrl-summary-book.js); a fact the table does not name goes
// to the unmapped list, marked with whether the suite the file declares
// defines its name, when the caller passes the lists (frc-suite-concepts-node.js).

import { readIxbrl, IxbrlError } from "./ixbrl-reader.js";

export { IxbrlError };

const MATURITY = "MaturitiesOrExpirationPeriodsDimension";
const EQUITY_CLASS = "EquityClassesDimension";
const PPE_CLASS = "PropertyPlantEquipmentClassesDimension";

export const FIXED_ASSET_CLASSES = ["landBuildings", "plantMachinery", "furnitureFittings", "computerEquipment", "motorVehicles"];

const PPE_MEMBER = {
  LandBuildings: "landBuildings",
  PlantMachinery: "plantMachinery",
  FurnitureFittings: "furnitureFittings",
  ComputerEquipment: "computerEquipment",
  MotorVehicles: "motorVehicles",
};

// The diya-gl account each fixed asset class posts to.
export const FIXED_ASSET_ACCOUNTS = {
  landBuildings: "0000",
  plantMachinery: "0010",
  furnitureFittings: "0020",
  computerEquipment: "0030",
  motorVehicles: "0040",
};

/**
 * The mapping, one row per concept and member the reader maps. `figure` is
 * the name the forms and builders use; `account` is where the summary book
 * posts it ("-" where the figure is a check or is not posted).
 */
export const MAPPING_TABLE = [
  { concept: "FixedAssets", figure: "fixedAssets", account: "0000-0040", note: "by class from the note; 0010 when the file has no note" },
  { concept: "PropertyPlantEquipmentGrossCost", dimension: PPE_CLASS, figure: "fixedAssetNote.costAtStart", account: "0000-0040" },
  {
    concept: "AdditionsOtherThanThroughBusinessCombinationsPropertyPlantEquipment",
    dimension: PPE_CLASS,
    figure: "fixedAssetNote.additions",
    account: "5900",
  },
  { concept: "DisposalsPropertyPlantEquipment", dimension: PPE_CLASS, figure: "fixedAssetNote.disposals", account: "-" },
  {
    concept: "AccumulatedDepreciationImpairmentPropertyPlantEquipment",
    dimension: PPE_CLASS,
    figure: "fixedAssetNote.depreciationAtStart",
    account: "0000-0040",
  },
  {
    concept: "IncreaseFromDepreciationChargeForYearPropertyPlantEquipment",
    dimension: PPE_CLASS,
    figure: "fixedAssetNote.depreciationCharge",
    account: "depreciationRate",
  },
  {
    concept: "DisposalsDecreaseInDepreciationImpairmentPropertyPlantEquipment",
    dimension: PPE_CLASS,
    figure: "fixedAssetNote.depreciationOnDisposals",
    account: "-",
  },
  { concept: "TotalInventories", figure: "stocks", account: "1100" },
  { concept: "Debtors", figure: "debtors", account: "1300", note: "with or without WithinOneYear" },
  { concept: "PrepaymentsAccruedIncomeNotExpressedWithinCurrentAssetSubtotal", figure: "debtors", account: "1300" },
  { concept: "CalledUpShareCapitalNotPaidNotExpressedAsCurrentAsset", figure: "debtors", account: "1300" },
  { concept: "CashBankOnHand", figure: "cashAtBank", account: "1200" },
  { concept: "CurrentAssets", figure: "currentAssets", account: "-", note: "a check; the part no line explains posts to 1200" },
  { concept: "TradeCreditorsTradePayables", figure: "tradeCreditors", account: "2100", note: "WithinOneYear" },
  { concept: "CorporationTaxPayable", figure: "corporationTax", account: "2300" },
  {
    concept: "OtherCreditors",
    figure: "otherCreditors",
    account: "2100",
    note: "WithinOneYear; posts as a trade creditor, which the balance sheet shows within one year",
  },
  { concept: "AccruedLiabilitiesNotExpressedWithinCreditorsSubtotal", figure: "otherCreditors", account: "2100", note: "WithinOneYear" },
  {
    concept: "Creditors",
    dimension: MATURITY,
    member: "WithinOneYear",
    figure: "creditorsWithinOneYear",
    account: "-",
    note: "a check; the part no line explains posts to 2100",
  },
  { concept: "Creditors", dimension: MATURITY, member: "AfterOneYear", figure: "creditorsAfterOneYear", account: "2600" },
  {
    concept: "ProvisionsForLiabilitiesBalanceSheetSubtotal",
    figure: "creditorsAfterOneYear",
    account: "2600",
    note: "added to creditorsAfterOneYear and named",
  },
  { concept: "Equity", dimension: EQUITY_CLASS, member: "ShareCapital", figure: "calledUpShareCapital", account: "3000" },
  {
    concept: "Equity",
    dimension: EQUITY_CLASS,
    member: "RetainedEarningsAccumulatedLosses",
    figure: "profitAndLossAccount",
    account: "3100",
  },
  {
    concept: "Equity",
    dimension: EQUITY_CLASS,
    member: "*",
    figure: "profitAndLossAccount",
    account: "3300",
    note: "other reserves, added and named",
  },
  { concept: "Equity", figure: "capitalAndReserves", account: "-", note: "a check" },
  { concept: "NetAssetsLiabilities", figure: "netAssets", account: "-", note: "a check" },
  { concept: "NetCurrentAssetsLiabilities", figure: "netCurrentAssets", account: "-", note: "a check" },
  { concept: "TotalAssetsLessCurrentLiabilities", figure: "totalAssetsLessCurrentLiabilities", account: "-", note: "a check" },
  { concept: "TurnoverRevenue", figure: "turnover", account: "4000" },
  { concept: "CostSales", figure: "costOfSales", account: "5000" },
  { concept: "AdministrativeExpenses", figure: "administrativeExpenses", account: "5501" },
  {
    concept: "OtherInterestReceivableSimilarIncomeFinanceIncome",
    figure: "interestReceivable",
    account: "1200",
    note: "a receipt coded K",
  },
  { concept: "TaxTaxCreditOnProfitOrLossOnOrdinaryActivities", figure: "tax", account: "-", note: "not posted; diya-gl works the tax" },
  { concept: "GrossProfitLoss", figure: "grossProfit", account: "-", note: "a check" },
  { concept: "OperatingProfitLoss", figure: "operatingProfit", account: "-", note: "a check" },
  { concept: "ProfitLossOnOrdinaryActivitiesBeforeTax", figure: "profitBeforeTax", account: "-", note: "a check" },
  { concept: "ProfitLoss", figure: "profit", account: "-", note: "a check" },
  { concept: "OtherOperatingIncomeFormat2", figure: "otherOperatingIncome", account: "4003", note: "micro-entity profit and loss" },
  { concept: "RawMaterialsConsumablesUsed", figure: "rawMaterialsConsumables", account: "5000", note: "micro-entity profit and loss" },
  { concept: "StaffCostsEmployeeBenefitsExpense", figure: "staffCosts", account: "5101", note: "micro-entity profit and loss" },
  {
    concept: "DepreciationAmortisationImpairmentExpense",
    figure: "depreciation",
    account: "depreciationRate",
    note: "micro-entity profit and loss",
  },
  { concept: "OtherOperatingExpensesFormat2", figure: "otherOperatingExpenses", account: "5501", note: "micro-entity profit and loss" },
  {
    concept: "GainLossOnDisposalsPropertyPlantEquipment",
    figure: "gainOnDisposal",
    account: "4006",
    note: "the gain (loss when negative) on the disposals in the fixed asset note",
  },
  { concept: "ProfitLossOnOrdinaryActivitiesAfterTax", figure: "profit", account: "-", note: "a check; read when ProfitLoss is absent" },
  {
    concept: "TotalAdditionsIncludingFromBusinessCombinationsPropertyPlantEquipment",
    dimension: PPE_CLASS,
    figure: "fixedAssetNote.additions",
    account: "5900",
    note: "read when the other additions concept is absent",
  },
  { concept: "StartDateForPriorPeriod", figure: "priorPeriod.start", account: "-" },
  { concept: "AverageNumberEmployeesDuringPeriod", figure: "averageEmployees", account: "-" },
  { concept: "DescriptionPrincipalActivities", figure: "principalActivity", account: "-" },
  { concept: "NameEntityOfficer", dimension: "EntityOfficersDimension", figure: "directors", account: "-" },
  { concept: "DirectorSigningFinancialStatements", figure: "signer", account: "-" },
  { concept: "DateAuthorisationFinancialStatementsForIssue", figure: "approvalDate", account: "-" },
  { concept: "NumberSharesIssuedFullyPaid", figure: "shareNote.shares", account: "-" },
  { concept: "NominalValueAllottedShareCapital", figure: "shareNote.nominalValue", account: "-" },
];

// ============================================================================
// Reading figures
// ============================================================================

const local = (key) => key.slice(key.indexOf("#") + 1);

function dimensionMap(fact) {
  return Object.fromEntries(Object.entries(fact.dimensions).map(([dimension, member]) => [local(dimension), local(member)]));
}

function sameDimensions(fact, want) {
  const have = dimensionMap(fact);
  const wanted = Object.entries(want);
  if (Object.keys(have).length !== wanted.length) return false;
  return wanted.every(([dimension, member]) => have[dimension] === member);
}

const dayBefore = (isoDay) => {
  const date = new Date(`${isoDay}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

const addYears = (isoDay, years) => {
  const date = new Date(`${isoDay}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
};

const addDays = (isoDay, days) => {
  const date = new Date(`${isoDay}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const sumOf = (values) => values.reduce((total, value) => total + value, 0);

// A set of facts of one company, with the lookups the mapping makes.
class FactSet {
  constructor(facts, entityIdentifier) {
    this.facts = facts.filter((fact) => entityIdentifier === null || fact.entity.identifier === entityIdentifier);
    this.consumed = new Set();
  }

  find(localName, want, predicate) {
    return this.facts.filter(
      (fact) =>
        fact.localName === localName && (want === null || sameDimensions(fact, want ?? {})) && (predicate === undefined || predicate(fact)),
    );
  }

  // The one value of a concept at a year's instant or over its duration, or undefined.
  instant(localName, endDay, want) {
    const [fact] = this.find(localName, want, (f) => f.period.instant === endDay);
    if (fact) this.consumed.add(fact);
    return fact?.value;
  }

  duration(localName, endDay, want) {
    const [fact] = this.find(localName, want, (f) => f.period.endDate === endDay);
    if (fact) this.consumed.add(fact);
    return fact?.value;
  }

  // The first stated of several maturity spellings of one line.
  maturity(localName, endDay, members) {
    for (const member of members) {
      const value = this.instant(localName, endDay, member === null ? {} : { [MATURITY]: member });
      if (value !== undefined) return value;
    }
    return undefined;
  }
}

function sumDefined(values) {
  const stated = values.filter((value) => value !== undefined);
  return stated.length === 0 ? undefined : sumOf(stated);
}

function pick(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function balanceSheetAt(set, endDay, notes, label) {
  const debtors = sumDefined([
    set.maturity("Debtors", endDay, ["WithinOneYear", null]),
    set.instant("PrepaymentsAccruedIncomeNotExpressedWithinCurrentAssetSubtotal", endDay),
    set.instant("CalledUpShareCapitalNotPaidNotExpressedAsCurrentAsset", endDay),
  ]);
  const provisions = set.instant("ProvisionsForLiabilitiesBalanceSheetSubtotal", endDay);
  const afterOneYear = set.instant("Creditors", endDay, { [MATURITY]: "AfterOneYear" });
  if (provisions) notes.push(`${label}: provisions for liabilities of ${provisions} are added to creditors after more than one year.`);

  const equityClasses = set.find("Equity", null, (fact) => fact.period.instant === endDay && Object.keys(fact.dimensions).length === 1);
  const classMembers = equityClasses.filter((fact) => local(Object.keys(fact.dimensions)[0]) === EQUITY_CLASS);
  let calledUpShareCapital;
  let retained;
  const otherReserves = [];
  for (const fact of classMembers) {
    set.consumed.add(fact);
    const member = local(Object.values(fact.dimensions)[0]);
    if (member === "ShareCapital") calledUpShareCapital = fact.value;
    else if (member === "RetainedEarningsAccumulatedLosses") retained = fact.value;
    else otherReserves.push([member, fact.value]);
  }
  if (otherReserves.length > 0) {
    notes.push(
      `${label}: ${otherReserves.map(([member, value]) => `${member} ${value}`).join(", ")} are added to the profit and loss account.`,
    );
    retained = (retained ?? 0) + sumOf(otherReserves.map(([, value]) => value));
  }

  return pick({
    fixedAssets: set.instant("FixedAssets", endDay),
    stocks: set.instant("TotalInventories", endDay),
    debtors,
    cashAtBank: set.instant("CashBankOnHand", endDay),
    currentAssets: set.instant("CurrentAssets", endDay),
    tradeCreditors: set.maturity("TradeCreditorsTradePayables", endDay, ["WithinOneYear", null]),
    corporationTax: set.maturity("CorporationTaxPayable", endDay, ["WithinOneYear", null]),
    otherCreditors: sumDefined([
      set.maturity("OtherCreditors", endDay, ["WithinOneYear", null]),
      set.maturity("AccruedLiabilitiesNotExpressedWithinCreditorsSubtotal", endDay, ["WithinOneYear", null]),
    ]),
    creditorsWithinOneYear: set.instant("Creditors", endDay, { [MATURITY]: "WithinOneYear" }),
    creditorsAfterOneYear: sumDefined([afterOneYear, provisions]),
    provisions,
    netAssets: set.instant("NetAssetsLiabilities", endDay),
    netCurrentAssets: set.instant("NetCurrentAssetsLiabilities", endDay),
    totalAssetsLessCurrentLiabilities: set.instant("TotalAssetsLessCurrentLiabilities", endDay),
    calledUpShareCapital,
    profitAndLossAccount: retained,
    capitalAndReserves: set.instant("Equity", endDay),
  });
}

function profitAndLossAt(set, endDay) {
  return pick({
    turnover: set.duration("TurnoverRevenue", endDay),
    costOfSales: set.duration("CostSales", endDay),
    grossProfit: set.duration("GrossProfitLoss", endDay),
    administrativeExpenses: set.duration("AdministrativeExpenses", endDay),
    operatingProfit: set.duration("OperatingProfitLoss", endDay),
    interestReceivable: set.duration("OtherInterestReceivableSimilarIncomeFinanceIncome", endDay),
    profitBeforeTax: set.duration("ProfitLossOnOrdinaryActivitiesBeforeTax", endDay),
    tax: set.duration("TaxTaxCreditOnProfitOrLossOnOrdinaryActivities", endDay),
    profit: set.duration("ProfitLoss", endDay) ?? set.duration("ProfitLossOnOrdinaryActivitiesAfterTax", endDay),
    otherOperatingIncome: set.duration("OtherOperatingIncomeFormat2", endDay),
    rawMaterialsConsumables: set.duration("RawMaterialsConsumablesUsed", endDay),
    staffCosts: set.duration("StaffCostsEmployeeBenefitsExpense", endDay),
    depreciation: set.duration("DepreciationAmortisationImpairmentExpense", endDay),
    otherOperatingExpenses: set.duration("OtherOperatingExpensesFormat2", endDay),
    gainOnDisposal: set.duration("GainLossOnDisposalsPropertyPlantEquipment", endDay),
  });
}

const FIXED_ASSET_NOTE_CONCEPTS = new Set([
  "PropertyPlantEquipment",
  "PropertyPlantEquipmentGrossCost",
  "AccumulatedDepreciationImpairmentPropertyPlantEquipment",
  "AdditionsOtherThanThroughBusinessCombinationsPropertyPlantEquipment",
  "TotalAdditionsIncludingFromBusinessCombinationsPropertyPlantEquipment",
  "DisposalsPropertyPlantEquipment",
  "IncreaseFromDepreciationChargeForYearPropertyPlantEquipment",
  "DisposalsDecreaseInDepreciationImpairmentPropertyPlantEquipment",
]);

function fixedAssetNoteAt(set, endDay, startBalanceDay) {
  const note = {};
  for (const [member, className] of Object.entries(PPE_MEMBER)) {
    const want = { [PPE_CLASS]: member };
    const closingCost = set.instant("PropertyPlantEquipmentGrossCost", endDay, want);
    const costAtStart = set.instant("PropertyPlantEquipmentGrossCost", startBalanceDay, want);
    const additions =
      set.duration("AdditionsOtherThanThroughBusinessCombinationsPropertyPlantEquipment", endDay, want) ??
      set.duration("TotalAdditionsIncludingFromBusinessCombinationsPropertyPlantEquipment", endDay, want);
    const disposals = set.duration("DisposalsPropertyPlantEquipment", endDay, want);
    const closingDepreciation = set.instant("AccumulatedDepreciationImpairmentPropertyPlantEquipment", endDay, want);
    const depreciationAtStart = set.instant("AccumulatedDepreciationImpairmentPropertyPlantEquipment", startBalanceDay, want);
    const depreciationCharge = set.duration("IncreaseFromDepreciationChargeForYearPropertyPlantEquipment", endDay, want);
    const depreciationOnDisposals = set.duration("DisposalsDecreaseInDepreciationImpairmentPropertyPlantEquipment", endDay, want);
    const stated = [
      closingCost,
      costAtStart,
      additions,
      disposals,
      closingDepreciation,
      depreciationAtStart,
      depreciationCharge,
      depreciationOnDisposals,
    ];
    if (stated.every((value) => value === undefined)) continue;
    note[className] = {
      costAtStart: costAtStart ?? Math.max((closingCost ?? 0) - (additions ?? 0) + (disposals ?? 0), 0),
      additions: additions ?? 0,
      disposals: disposals ?? 0,
      depreciationAtStart:
        depreciationAtStart ?? Math.max((closingDepreciation ?? 0) - (depreciationCharge ?? 0) + (depreciationOnDisposals ?? 0), 0),
      depreciationCharge: depreciationCharge ?? 0,
      depreciationOnDisposals: depreciationOnDisposals ?? 0,
    };
  }
  return Object.keys(note).length > 0 ? note : null;
}

// ============================================================================
// What the file says about itself
// ============================================================================

function textFact(set, localName, endDay, want) {
  const [fact] = set.find(localName, want, (f) => endDay === undefined || (f.period.endDate ?? f.period.instant) === endDay);
  if (fact) set.consumed.add(fact);
  return fact?.value;
}

function periodOf(set) {
  const startFact = set.find("StartDateForPeriodCoveredByReport")[0];
  const endFact = set.find("EndDateForPeriodCoveredByReport")[0];
  const balanceSheetDate = set.find("BalanceSheetDate")[0];
  for (const fact of [startFact, endFact, balanceSheetDate]) if (fact) set.consumed.add(fact);
  let end = endFact?.value ?? balanceSheetDate?.value;
  let start = startFact?.value;
  if (!end) {
    // No stated period: the latest date any fact ends on.
    end = set.facts
      .map((fact) => fact.period.endDate ?? fact.period.instant)
      .filter(Boolean)
      .sort()
      .pop();
    start = set.facts.find((fact) => fact.period.endDate === end && fact.period.startDate)?.period.startDate;
  }
  if (!end) throw new IxbrlError("This file states no accounting period.");
  if (!start) {
    const duration = set.facts.find((fact) => fact.period.endDate === end && fact.period.startDate);
    start = duration?.period.startDate ?? addDays(addYears(end, -1), 1);
  }
  return { start, end };
}

function regimeOf(set) {
  const [fact] = set.find("AccountingStandardsApplied", null, (f) => Object.keys(f.dimensions).length === 1);
  const member = fact ? local(Object.values(fact.dimensions)[0]) : "";
  if (fact) set.consumed.add(fact);
  if (/micro/i.test(member)) return "micro";
  return "small";
}

// ============================================================================
// Checks
// ============================================================================

const WITHIN = 1;
const close = (a, b) => Math.abs(a - b) <= WITHIN;

function problem(message) {
  return new IxbrlError(message);
}

function checkBalance(year, label) {
  const s = year;
  const current = s.currentAssets ?? sumOf([s.stocks, s.debtors, s.cashAtBank].map((v) => v ?? 0));
  const within = s.creditorsWithinOneYear ?? sumOf([s.tradeCreditors, s.corporationTax, s.otherCreditors].map((v) => v ?? 0));
  const net = (s.fixedAssets ?? 0) + current - within - (s.creditorsAfterOneYear ?? 0);
  const equity = s.capitalAndReserves ?? s.netAssets;
  if (s.netCurrentAssets !== undefined && !close(current - within, s.netCurrentAssets)) {
    throw problem(
      `The ${label} net current assets are stated as ${s.netCurrentAssets}; current assets less creditors within one year give ${current - within}.`,
    );
  }
  if (
    s.totalAssetsLessCurrentLiabilities !== undefined &&
    !close((s.fixedAssets ?? 0) + current - within, s.totalAssetsLessCurrentLiabilities)
  ) {
    throw problem(
      `The ${label} total assets less current liabilities are stated as ${s.totalAssetsLessCurrentLiabilities}; the lines give ${(s.fixedAssets ?? 0) + current - within}.`,
    );
  }
  if (s.netAssets !== undefined && !close(net, s.netAssets)) {
    throw problem(
      `The ${label} balance sheet does not balance: fixed assets plus current assets less creditors is ${net}, the file states net assets of ${s.netAssets}.`,
    );
  }
  if (equity !== undefined && !close(net, equity)) {
    throw problem(
      `The ${label} balance sheet does not balance: fixed assets plus current assets less creditors is ${net}, the file states capital and reserves of ${equity}.`,
    );
  }
  if (s.capitalAndReserves !== undefined && s.netAssets !== undefined && !close(s.capitalAndReserves, s.netAssets)) {
    throw problem(`The ${label} net assets (${s.netAssets}) differ from capital and reserves (${s.capitalAndReserves}).`);
  }
}

function checkTotals(year, label, regime) {
  const s = year;
  const lines = sumDefined([s.stocks, s.debtors, s.cashAtBank]);
  if (s.currentAssets !== undefined && lines !== undefined) {
    const over = lines - s.currentAssets > WITHIN;
    const under = s.currentAssets - lines > WITHIN && regime === "small";
    if (over || under)
      throw problem(`The ${label} current assets of ${s.currentAssets} differ from the lines under it, which add up to ${lines}.`);
  }
  const creditors = sumDefined([s.tradeCreditors, s.corporationTax, s.otherCreditors]);
  if (s.creditorsWithinOneYear !== undefined && creditors !== undefined) {
    const over = creditors - s.creditorsWithinOneYear > WITHIN;
    const under = s.creditorsWithinOneYear - creditors > WITHIN && regime === "small";
    if (over || under) {
      throw problem(
        `The ${label} creditors within one year of ${s.creditorsWithinOneYear} differ from the lines under it, which add up to ${creditors}.`,
      );
    }
  }
  const reserves = sumDefined([s.calledUpShareCapital, s.profitAndLossAccount]);
  if (s.capitalAndReserves !== undefined && reserves !== undefined && !close(reserves, s.capitalAndReserves)) {
    throw problem(
      `The ${label} capital and reserves of ${s.capitalAndReserves} differ from the lines under it, which add up to ${reserves}.`,
    );
  }
}

function checkProfitAndLoss(pl, label) {
  const n = (value) => value ?? 0;
  const mismatch = (what, expected, stated) => {
    throw problem(`The ${label} ${what} of ${stated} differs from the lines that make it, which give ${expected}.`);
  };
  if (pl.grossProfit !== undefined && pl.turnover !== undefined && !close(pl.turnover - n(pl.costOfSales), pl.grossProfit)) {
    mismatch("gross profit", pl.turnover - n(pl.costOfSales), pl.grossProfit);
  }
  if (
    pl.operatingProfit !== undefined &&
    pl.grossProfit !== undefined &&
    pl.administrativeExpenses !== undefined &&
    pl.otherOperatingIncome === undefined
  ) {
    if (!close(pl.grossProfit - pl.administrativeExpenses, pl.operatingProfit))
      mismatch("operating profit", pl.grossProfit - pl.administrativeExpenses, pl.operatingProfit);
  }
  if (
    pl.profitBeforeTax !== undefined &&
    pl.operatingProfit !== undefined &&
    !close(pl.operatingProfit + n(pl.interestReceivable), pl.profitBeforeTax)
  ) {
    mismatch("profit before tax", pl.operatingProfit + n(pl.interestReceivable), pl.profitBeforeTax);
  }
  if (pl.profit !== undefined && pl.profitBeforeTax !== undefined && !close(pl.profitBeforeTax - n(pl.tax), pl.profit)) {
    mismatch("profit for the year", pl.profitBeforeTax - n(pl.tax), pl.profit);
  }
  const micro = microProfitBeforeTax(pl);
  if (micro !== undefined && pl.profit !== undefined && !close(micro - n(pl.tax), pl.profit)) {
    mismatch("profit for the year", micro - n(pl.tax), pl.profit);
  }
}

// The micro-entity P&L: turnover plus other income less the four expense lines.
export function microProfitBeforeTax(pl) {
  const hasMicroLine = ["otherOperatingIncome", "rawMaterialsConsumables", "staffCosts", "depreciation", "otherOperatingExpenses"].some(
    (key) => pl[key] !== undefined,
  );
  if (!hasMicroLine || pl.turnover === undefined) return undefined;
  const n = (value) => value ?? 0;
  return (
    pl.turnover +
    n(pl.otherOperatingIncome) -
    n(pl.rawMaterialsConsumables) -
    n(pl.staffCosts) -
    n(pl.depreciation) -
    n(pl.otherOperatingExpenses)
  );
}

const hasBalanceSheet = (year) =>
  Object.keys(year).some((key) => ["fixedAssets", "currentAssets", "netAssets", "capitalAndReserves"].includes(key));

// ============================================================================
// The mapping
// ============================================================================

/**
 * Map a read document (or its bytes) to the accounts figures.
 * @param {Uint8Array|string|Object} source - bytes, text or readIxbrl's result
 * @param {Object} [expect] - what the page expects of the file; each given key refuses a mismatch
 * @param {string} [expect.companyNumber]
 * @param {string} [expect.periodStart]
 * @param {string} [expect.periodEnd]
 * @param {"micro"|"small"|"any"} [expect.regime]
 * @param {boolean} [expect.dormant] - whether the page is the dormant case
 * @param {boolean} [expect.firstAccounts] - the company was incorporated inside the period
 * @param {Object} [options]
 * @param {(suiteDate: string) => Set<string>|undefined} [options.suiteConcepts] - the concept names the FRC suite of that date defines
 * @returns {Object} the accounts
 * @throws {IxbrlError}
 */
export function mapIxbrlAccounts(source, expect = {}, { suiteConcepts } = {}) {
  const read = source && typeof source === "object" && Array.isArray(source.facts) ? source : readIxbrl(source);
  const numberFact = read.facts.find((fact) => fact.localName === "UKCompaniesHouseRegisteredNumber");
  const entityIdentifier = numberFact?.entity.identifier ?? read.facts[0]?.entity.identifier ?? null;
  const set = new FactSet(read.facts, entityIdentifier);

  const companyNumber = String(numberFact?.value ?? entityIdentifier ?? "").trim();
  const companyName = textFact(set, "EntityCurrentLegalOrRegisteredName");
  if (numberFact) set.consumed.add(numberFact);
  const period = periodOf(set);
  const regime = regimeOf(set);
  const [dormantFact] = set.find("EntityDormantTruefalse");
  if (dormantFact) set.consumed.add(dormantFact);
  const dormant = dormantFact?.value === "true";
  const [statusFact] = set.find("EntityTradingStatus", null, (f) => Object.keys(f.dimensions).length <= 1);
  if (statusFact) set.consumed.add(statusFact);
  const tradingStatus =
    statusFact && Object.keys(statusFact.dimensions).length === 1 ? local(Object.values(statusFact.dimensions)[0]) : "Trading";

  // Checks that need only the document's own statements.
  if (expect.companyNumber !== undefined && expect.companyNumber !== null) {
    const pad = (value) =>
      String(value)
        .trim()
        .toUpperCase()
        .replace(/^0+(?=\d)/, "");
    if (pad(expect.companyNumber) !== pad(companyNumber)) {
      throw problem(`This file is for company ${companyNumber}; the company looked up is ${expect.companyNumber}.`);
    }
  }
  if (expect.periodEnd && expect.periodEnd !== period.end) {
    throw problem(`This file's accounts end on ${period.end}; the form's period ends on ${expect.periodEnd}.`);
  }
  if (expect.periodStart && period.start && expect.periodStart !== period.start) {
    throw problem(`This file's accounts start on ${period.start}; the form's period starts on ${expect.periodStart}.`);
  }
  if (expect.regime && expect.regime !== "any" && expect.regime !== regime) {
    const label = { micro: "a micro-entity", small: "a small company" };
    throw problem(`This file is ${label[regime]}'s accounts; this page takes ${label[expect.regime]}'s accounts.`);
  }
  if (dormant && expect.dormant === false) throw problem("This file is for a dormant company; use the dormant accounts page.");
  if (!dormant && expect.dormant === true)
    throw problem("This file is not for a dormant company; the dormant accounts page takes a dormant company's file.");

  const priorEnd = period.start ? dayBefore(period.start) : null;
  const notes = [];
  const currentYear = balanceSheetAt(set, period.end, notes, "Current year");
  const priorYear = priorEnd ? balanceSheetAt(set, priorEnd, notes, "Prior year") : {};
  const currentPl = profitAndLossAt(set, period.end);
  const priorPl = priorEnd ? profitAndLossAt(set, priorEnd) : {};
  const fixedAssetNote = priorEnd ? fixedAssetNoteAt(set, period.end, priorEnd) : null;
  // The note's totals and net book values restate what its classes and the balance sheet already say.
  for (const fact of set.facts) {
    if (FIXED_ASSET_NOTE_CONCEPTS.has(fact.localName) && [period.end, priorEnd].includes(fact.period.instant ?? fact.period.endDate))
      set.consumed.add(fact);
  }

  const priorDuration = priorEnd ? set.facts.find((fact) => fact.period.endDate === priorEnd && fact.period.startDate) : null;
  const statedPriorStart = textFact(set, "StartDateForPriorPeriod");
  textFact(set, "EndDateForPriorPeriod");
  const priorPeriod = priorEnd
    ? { start: priorDuration?.period.startDate ?? statedPriorStart ?? addYears(period.start, -1), end: priorEnd }
    : null;

  const currentHasProfitAndLoss = Object.keys(currentPl).length > 0;
  const hasProfitAndLoss = currentHasProfitAndLoss || Object.keys(priorPl).length > 0;
  const [notDelivered] = set.find("StatementThatDirectorsHaveElectedNotToDeliverProfitLossAccountUnderSection4445ACompaniesAct2006");
  const filleted = regime === "small" && (Boolean(notDelivered) || !hasProfitAndLoss);
  if (notDelivered) set.consumed.add(notDelivered);

  // Both years.
  if (!expect.firstAccounts) {
    if (!hasBalanceSheet(currentYear)) throw problem("This file has no balance sheet for its own year.");
    if (!hasBalanceSheet(priorYear))
      throw problem("This file has no prior-year balance sheet; both years are needed unless the company is new.");
    if (currentHasProfitAndLoss !== Object.keys(priorPl).length > 0) {
      throw problem(
        "This file has a profit and loss account for one year but not the other; both years are needed unless the company is new.",
      );
    }
  }

  // Balance and totals.
  if (hasBalanceSheet(currentYear)) {
    checkBalance(currentYear, "current-year");
    checkTotals(currentYear, "current-year", regime);
  }
  if (hasBalanceSheet(priorYear)) {
    checkBalance(priorYear, "prior-year");
    checkTotals(priorYear, "prior-year", regime);
  }
  if (currentHasProfitAndLoss) checkProfitAndLoss(currentPl, "current-year");
  if (Object.keys(priorPl).length > 0) checkProfitAndLoss(priorPl, "prior-year");

  // The company's other statements.
  const officerFacts = set.find("NameEntityOfficer", null, (f) => Object.keys(f.dimensions).length <= 1);
  const directors = [];
  const officerByMember = new Map();
  for (const fact of officerFacts) {
    set.consumed.add(fact);
    const name = fact.value;
    if (!directors.includes(name)) directors.push(name);
    const member = Object.keys(fact.dimensions).length === 1 ? local(Object.values(fact.dimensions)[0]) : "";
    officerByMember.set(member, name);
  }
  const signerFact = set.find("DirectorSigningFinancialStatements", null)[0];
  if (signerFact) set.consumed.add(signerFact);
  const signerMember = signerFact && Object.keys(signerFact.dimensions).length === 1 ? local(Object.values(signerFact.dimensions)[0]) : "";
  const signer = officerByMember.get(signerMember) ?? null;

  const [employeesFact] = set.find(
    "AverageNumberEmployeesDuringPeriod",
    null,
    (fact) => Object.keys(fact.dimensions).length === 0 && (fact.period.endDate ?? fact.period.instant) === period.end,
  );
  for (const fact of set.find("AverageNumberEmployeesDuringPeriod", null, (f) =>
    [period.end, priorEnd].includes(f.period.endDate ?? f.period.instant),
  )) {
    set.consumed.add(fact);
  }
  const averageEmployees = employeesFact?.value;
  const shares = set.find("NumberSharesIssuedFullyPaid", null, (f) => f.period.instant === period.end)[0];
  const nominal = set.find("NominalValueAllottedShareCapital", null)[0];
  for (const fact of [shares, nominal]) if (fact) set.consumed.add(fact);
  const shareClassMember = (fact) => (fact && Object.keys(fact.dimensions).length === 1 ? local(Object.values(fact.dimensions)[0]) : null);

  if (regime === "small" && hasProfitAndLoss && currentPl.costOfSales === undefined && currentPl.turnover === undefined) {
    notes.push("This file's profit and loss account is Format 2, which the small company form does not take.");
  }

  const principalActivity = textFact(set, "DescriptionPrincipalActivities") ?? null;
  const approvalDate = textFact(set, "DateAuthorisationFinancialStatementsForIssue") ?? null;
  const definedBySuite = read.suite.date ? suiteConcepts?.(read.suite.date) : undefined;
  const unmapped = set.facts
    .filter((fact) => !set.consumed.has(fact) && fact.value !== "" && !isBoilerplate(fact))
    .map((fact) => ({
      concept: fact.localName,
      dimensions: dimensionMap(fact),
      period: fact.period,
      value: fact.value,
      inSuite: definedBySuite ? definedBySuite.has(fact.localName) : null,
    }));

  return {
    suite: read.suite,
    company: { number: companyNumber, name: companyName ?? null },
    period,
    priorPeriod,
    regime,
    dormant,
    tradingStatus,
    filleted,
    hasProfitAndLoss,
    balanceSheet: { currentYear, priorYear },
    profitAndLoss: hasProfitAndLoss ? { currentYear: currentPl, priorYear: priorPl } : null,
    fixedAssetNote,
    averageEmployees: averageEmployees ?? null,
    principalActivity,
    directors,
    signer,
    approvalDate,
    shareNote:
      shares || nominal
        ? {
            shares: shares?.value ?? null,
            nominalValue: nominal?.value ?? null,
            shareClass: shareClassMember(shares) ?? shareClassMember(nominal),
          }
        : null,
    firstAccounts: Boolean(expect.firstAccounts),
    notes,
    unmapped,
  };
}

// Facts about the document itself and the address, which no figure uses.
const BOILERPLATE = new Set([
  "VersionProductionSoftware",
  "NameProductionSoftware",
  "CountryFormationOrIncorporation",
  "PrincipalCurrencyUsedInBusinessReport",
  "DescriptionBodyAuthorisingFinancialStatements",
  "LegalFormEntity",
  "AccountsStatusAuditedOrUnaudited",
  "AccountsType",
  "ReportTitle",
  "ApplicableLegislation",
  "DirectorSigningDirectorsReport",
  "AddressLine1",
  "AddressLine2",
  "AddressLine3",
  "PrincipalLocation-CityOrTown",
  "CountyRegion",
  "PostalCodeZip",
  "AccountingStandardsApplied",
]);

function isBoilerplate(fact) {
  return BOILERPLATE.has(fact.localName) || fact.localName.startsWith("StatementThat");
}
