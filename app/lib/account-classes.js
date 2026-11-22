// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// account-classes.js — what kind of account each account a product's chart
// declares is, and for a Company account the concept of the filed accounts it
// feeds.
//
// Each account has a class in XBRL GL's mainAccountType words (asset,
// liability, equity, income, expense), the side its balance sits on, and the
// book.toml chart table it is declared in. A Company account also names the
// FRS 102 concept of the published statements it feeds (the Format 1 profit
// and loss account and the Section 1A balance sheet the engine publishes) and
// the FRS 105 micro-entity line it feeds, each by its FRC taxonomy local name
// with the dimension member where the concept takes one.
//
// The classes are built from the tables the engine already keeps, not from a
// second copy of them: the opening balance sheet accounts and their sides
// (OPENING_BALANCE_LINES, OPENING_FIXED_ASSET_CLASSES), each product's sales
// and purchase code maps, the bank workbooks, and the accounts the posting
// rules add (POSTING_ACCOUNTS). The dimension of each member comes from the
// inbound iXBRL table (MAPPING_TABLE).
//
// Where the workbook places an account somewhere other than where a filed
// concept of the same name would land in a book, the entry says so in
// `asFound`, and the placement is the workbook's: the published statements
// are the workbook's formulas, which the engine reproduces.

import {
  LTD_SALES_CODE_MAP,
  LTD_PURCHASE_CODE_MAP,
  BST_PURCHASE_CODE_MAP,
  SE_PURCHASE_CODE_MAP,
  TAXI_PURCHASE_CODE_MAP,
  BST_SALES_ACCOUNTS,
  TAXI_SALES_ACCOUNT,
  TAXI_OTHER_INCOME_ACCOUNT,
  SE_BANK_ACCOUNTS,
  OPENING_BALANCE_LINES,
  OPENING_FIXED_ASSET_CLASSES,
} from "./scenario-extractor.js";
import { BANK_ACCOUNT_FILES } from "./ltd-layout.js";
import { MAPPING_TABLE } from "./ixbrl-accounts.js";
import { POSTING_ACCOUNTS } from "./posting-rules.js";
import { resolveBstPurchaseCodeMap } from "./diya-gl-loader.js";

/** XBRL GL mainAccountType words, the five a trial balance sorts into. */
export const ACCOUNT_CLASSES = ["asset", "liability", "equity", "income", "expense"];

const NORMAL_SIDE_OF_CLASS = { asset: "D", expense: "D", liability: "C", equity: "C", income: "C" };

// The dimension each member belongs to, read off the inbound iXBRL table.
const DIMENSION_OF_MEMBER = Object.fromEntries(
  MAPPING_TABLE.filter((row) => row.dimension && row.member && row.member !== "*").map((row) => [row.member, row.dimension]),
);
const PPE_CLASS_DIMENSION = MAPPING_TABLE.find((row) => row.concept === "PropertyPlantEquipmentGrossCost").dimension;

function concept(name, member) {
  if (member === undefined) return { concept: name };
  const dimension = DIMENSION_OF_MEMBER[member];
  if (!dimension) throw new Error(`No row of the iXBRL mapping table names the member ${member}`);
  return { concept: name, dimension, member };
}

/**
 * The FRS 105 micro-entity lines: the balance sheet the accounts filing takes
 * and the profit and loss account by nature, each with its FRC concept.
 */
export const FRS_105_LINES = {
  fixedAssets: concept("FixedAssets"),
  currentAssets: concept("CurrentAssets"),
  creditorsWithinOneYear: concept("Creditors", "WithinOneYear"),
  creditorsAfterOneYear: concept("Creditors", "AfterOneYear"),
  calledUpShareCapital: concept("Equity", "ShareCapital"),
  profitAndLossAccount: concept("Equity", "RetainedEarningsAccumulatedLosses"),
  turnover: concept("TurnoverRevenue"),
  otherIncome: concept("OtherOperatingIncomeFormat2"),
  rawMaterials: concept("RawMaterialsConsumablesUsed"),
  staffCosts: concept("StaffCostsEmployeeBenefitsExpense"),
  depreciation: concept("DepreciationAmortisationImpairmentExpense"),
  otherCharges: concept("OtherOperatingExpensesFormat2"),
  tax: concept("TaxTaxCreditOnProfitOrLossOnOrdinaryActivities"),
};

// The FRS 102 concepts of the published statements.
const PPE = concept("PropertyPlantEquipment");
const PPE_ADDITIONS = { concept: "AdditionsOtherThanThroughBusinessCombinationsPropertyPlantEquipment", dimension: PPE_CLASS_DIMENSION };
const STOCK = concept("TotalInventories");
const DEBTORS = concept("Debtors");
const CASH = concept("CashBankOnHand");
const TRADE_CREDITORS = concept("TradeCreditorsTradePayables");
const TAXATION_SOCIAL_SECURITY = concept("TaxationSocialSecurityPayable");
const CORPORATION_TAX = concept("CorporationTaxPayable");
const OWED_TO_DIRECTORS = concept("AmountsOwedToDirectors", "AfterOneYear");
const CREDITORS_AFTER_ONE_YEAR = concept("Creditors", "AfterOneYear");
const SHARE_CAPITAL = concept("Equity", "ShareCapital");
const RETAINED_EARNINGS = concept("Equity", "RetainedEarningsAccumulatedLosses");
const TURNOVER = concept("TurnoverRevenue");
const COST_OF_SALES = concept("CostSales");
const ADMINISTRATIVE_EXPENSES = concept("AdministrativeExpenses");
const INTEREST_RECEIVABLE = concept("OtherInterestReceivableSimilarIncomeFinanceIncome");
const TAX_CHARGE = concept("TaxTaxCreditOnProfitOrLossOnOrdinaryActivities");

const LONG_TERM_DEBTORS_UNPUBLISHED =
  "The published balance sheet reads trial balance rows 6 to 35 and 39 to 44, so long-term debtors (row 37) reach no published line";
const DIRECTORS_LOAN_ALWAYS_LONG_TERM =
  "The published balance sheet shows the directors' loan account in creditors due after more than one year whatever its terms";
const CAPITAL_RESERVES_IN_PROFIT_AND_LOSS =
  "The published shareholders' funds carry the capital reserves with no line of their own, and the filed profit and loss account reserve is shareholders' funds less share capital";
const WAGES_AND_DIVIDENDS_IN_TRADE_CREDITORS = "The published trade creditors carry the wages and dividends still owed";

// Each Company account: the FRS 102 concept and the FRS 105 line it feeds,
// and for a balance sheet account the chart table a book declares it in. An
// account the posting rules add, which no chart declares, states its class
// and side. `asFound` names where a filed concept of the same name would land
// in a book instead.
const COMPANY_PLACEMENTS = {
  "0000": { chartTable: "assets", frs102: PPE, frs105: "fixedAssets" },
  "0010": { chartTable: "assets", frs102: PPE, frs105: "fixedAssets" },
  "0020": { chartTable: "assets", frs102: PPE, frs105: "fixedAssets" },
  "0030": { chartTable: "assets", frs102: PPE, frs105: "fixedAssets" },
  "0040": { chartTable: "assets", frs102: PPE, frs105: "fixedAssets" },
  "0000-depreciation": { accountClass: "asset", normalSide: "C", frs102: PPE, frs105: "fixedAssets" },
  "0010-depreciation": { accountClass: "asset", normalSide: "C", frs102: PPE, frs105: "fixedAssets" },
  "0020-depreciation": { accountClass: "asset", normalSide: "C", frs102: PPE, frs105: "fixedAssets" },
  "0030-depreciation": { accountClass: "asset", normalSide: "C", frs102: PPE, frs105: "fixedAssets" },
  "0040-depreciation": { accountClass: "asset", normalSide: "C", frs102: PPE, frs105: "fixedAssets" },
  "1100": { chartTable: "assets", frs102: STOCK, frs105: "currentAssets" },
  "1300": { chartTable: "assets", frs102: DEBTORS, frs105: "currentAssets" },
  "1400": { chartTable: "assets", frs102: null, frs105: null, note: LONG_TERM_DEBTORS_UNPUBLISHED },
  "1200": { chartTable: "bank", frs102: CASH, frs105: "currentAssets" },
  "1210": { chartTable: "bank", frs102: CASH, frs105: "currentAssets" },
  "1220": { chartTable: "bank", frs102: CASH, frs105: "currentAssets" },
  "1230": { chartTable: "bank", frs102: CASH, frs105: "currentAssets" },
  "bank-transfers": { accountClass: "asset", normalSide: "D", frs102: CASH, frs105: "currentAssets" },
  "2100": { chartTable: "liabilities", frs102: TRADE_CREDITORS, frs105: "creditorsWithinOneYear" },
  "2150": {
    chartTable: "liabilities",
    frs102: TRADE_CREDITORS,
    frs105: "creditorsWithinOneYear",
    note: WAGES_AND_DIVIDENDS_IN_TRADE_CREDITORS,
  },
  "2160": {
    chartTable: "liabilities",
    frs102: TRADE_CREDITORS,
    frs105: "creditorsWithinOneYear",
    note: WAGES_AND_DIVIDENDS_IN_TRADE_CREDITORS,
  },
  "3200": {
    chartTable: "capital",
    frs102: TRADE_CREDITORS,
    frs105: "creditorsWithinOneYear",
    note: WAGES_AND_DIVIDENDS_IN_TRADE_CREDITORS,
  },
  "2200": { chartTable: "liabilities", frs102: TAXATION_SOCIAL_SECURITY, frs105: "creditorsWithinOneYear" },
  "2400": { chartTable: "liabilities", frs102: TAXATION_SOCIAL_SECURITY, frs105: "creditorsWithinOneYear" },
  "2410": { chartTable: "liabilities", frs102: TAXATION_SOCIAL_SECURITY, frs105: "creditorsWithinOneYear" },
  "2300": { chartTable: "liabilities", frs102: CORPORATION_TAX, frs105: "creditorsWithinOneYear" },
  "2500": { chartTable: "liabilities", frs102: OWED_TO_DIRECTORS, frs105: "creditorsAfterOneYear", note: DIRECTORS_LOAN_ALWAYS_LONG_TERM },
  "2600": { chartTable: "liabilities", frs102: CREDITORS_AFTER_ONE_YEAR, frs105: "creditorsAfterOneYear" },
  "3000": { chartTable: "capital", frs102: SHARE_CAPITAL, frs105: "calledUpShareCapital" },
  "3100": { chartTable: "capital", frs102: RETAINED_EARNINGS, frs105: "profitAndLossAccount" },
  "3300": { chartTable: "capital", frs102: RETAINED_EARNINGS, frs105: "profitAndLossAccount", note: CAPITAL_RESERVES_IN_PROFIT_AND_LOSS },
  "dividends-declared": { accountClass: "equity", normalSide: "D", frs102: RETAINED_EARNINGS, frs105: "profitAndLossAccount" },

  "4000": { frs102: TURNOVER, frs105: "turnover" },
  "4001": { frs102: TURNOVER, frs105: "turnover" },
  "4002": { frs102: TURNOVER, frs105: "turnover" },
  "4003": {
    frs102: TURNOVER,
    frs105: "turnover",
    asFound: "A filed other operating income posts to 4003; the published turnover (TrialBalance row 56) takes 4003",
  },
  "4004": { frs102: TURNOVER, frs105: "turnover", note: "The published turnover adds the grants received (PubP&L F8 into F9)" },
  "4005": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "4006": {
    frs102: ADMINISTRATIVE_EXPENSES,
    frs105: "otherCharges",
    asFound:
      "A filed gain on disposal posts to 4006; the asset schedule sets the proceeds against the loss on disposal, which the published profit and loss shows within administrative expenses",
    note: "Proceeds the asset schedule does not take stay on TrialBalance row 17, inside fixed assets",
  },
  "interest-received": { accountClass: "income", normalSide: "C", frs102: INTEREST_RECEIVABLE, frs105: "otherIncome" },
  "5000": { frs102: COST_OF_SALES, frs105: "rawMaterials" },
  "stock-movement": { accountClass: "expense", normalSide: "D", frs102: COST_OF_SALES, frs105: "rawMaterials" },
  "5001": {
    frs102: COST_OF_SALES,
    frs105: "otherCharges",
    asFound:
      "A filed other external charges posts to 5001; the published cost of sales (TrialBalance row 61) takes 5001, and the micro-entity format has no line for it",
  },
  "5002": { frs102: COST_OF_SALES, frs105: "otherCharges" },
  "5100": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "staffCosts" },
  "5101": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "staffCosts" },
  "paye-wages": { accountClass: "expense", normalSide: "D", frs102: ADMINISTRATIVE_EXPENSES, frs105: "staffCosts" },
  "directors-paye-wages": { accountClass: "expense", normalSide: "D", frs102: ADMINISTRATIVE_EXPENSES, frs105: "staffCosts" },
  "employers-ni": { accountClass: "expense", normalSide: "D", frs102: ADMINISTRATIVE_EXPENSES, frs105: "staffCosts" },
  "5200": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5201": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5300": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5301": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5400": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5401": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5500": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5501": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5502": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5600": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5601": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5700": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5701": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5800": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5801": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "5802": { frs102: ADMINISTRATIVE_EXPENSES, frs105: "depreciation" },
  "5803": {
    frs102: ADMINISTRATIVE_EXPENSES,
    frs105: "otherCharges",
    asFound:
      "A filed interest payable posts to 5803; the Company chart codes 5803 to the legal and professional column, so the published profit and loss shows loan interest within administrative expenses and not as interest payable",
  },
  "5900": { frs102: PPE_ADDITIONS, frs105: "fixedAssets" },
  "bank-interest-paid": { accountClass: "expense", normalSide: "D", frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "bank-charges": { accountClass: "expense", normalSide: "D", frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "bank-contra-received": { accountClass: "expense", normalSide: "D", frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "bank-contra-paid": { accountClass: "expense", normalSide: "D", frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "loss-on-disposal": { accountClass: "expense", normalSide: "D", frs102: ADMINISTRATIVE_EXPENSES, frs105: "otherCharges" },
  "depreciation": { accountClass: "expense", normalSide: "D", frs102: ADMINISTRATIVE_EXPENSES, frs105: "depreciation" },
  "corporation-tax-charge": { accountClass: "expense", normalSide: "D", frs102: TAX_CHARGE, frs105: "tax" },
};

// A sale on 4005 is a debt written off: every product books it as a credit
// note on that sales account, and the expense it raises is a bad debt.
const BAD_DEBTS_WRITTEN_OFF = "4005";

// The code letter each product's purchase map gives fixed asset purchases,
// which the asset schedule capitalises rather than charges.
const FIXED_ASSET_PURCHASE_CODE = { ltd: "fa", se: "fa", bst: "f", taxi: "f" };

const SALES_ACCOUNTS = {
  ltd: Object.keys(LTD_SALES_CODE_MAP),
  se: Object.keys(LTD_SALES_CODE_MAP),
  bst: [...BST_SALES_ACCOUNTS],
  taxi: [TAXI_SALES_ACCOUNT, TAXI_OTHER_INCOME_ACCOUNT],
};

const PURCHASE_CODE_MAP = {
  ltd: LTD_PURCHASE_CODE_MAP,
  se: SE_PURCHASE_CODE_MAP,
  bst: BST_PURCHASE_CODE_MAP,
  taxi: TAXI_PURCHASE_CODE_MAP,
};

const BANK_ACCOUNTS = { ltd: Object.keys(BANK_ACCOUNT_FILES), se: [...SE_BANK_ACCOUNTS], bst: [], taxi: [] };

// The products whose charts declare fixed asset accounts: the Company's
// opening journal and the Self Employed asset schedule both read them.
const FIXED_ASSET_PRODUCTS = new Set(["ltd", "se"]);

function salesEntry(account) {
  const accountClass = account === BAD_DEBTS_WRITTEN_OFF ? "expense" : "income";
  return { account, accountClass, normalSide: NORMAL_SIDE_OF_CLASS[accountClass], chartTable: "sales" };
}

function purchaseEntry(product, purchaseCodeMap, account) {
  const accountClass = purchaseCodeMap[account] === FIXED_ASSET_PURCHASE_CODE[product] ? "asset" : "expense";
  return { account, accountClass, normalSide: "D", chartTable: "purchases" };
}

// A balance sheet account's class from its side and what it feeds: a debit
// balance is an asset, a credit balance a liability, unless it is equity.
function balanceSheetEntry(account, normalSide, chartTable, frs102) {
  const accountClass = frs102?.concept === "Equity" ? "equity" : normalSide === "D" ? "asset" : "liability";
  return { account, accountClass, normalSide, chartTable };
}

function withPlacement(entry, placement) {
  const { frs102, frs105, note, asFound } = placement;
  const placed = { ...entry, frs102, frs105: frs105 ? { line: frs105, ...FRS_105_LINES[frs105] } : null };
  if (note) placed.note = note;
  if (asFound) placed.asFound = asFound;
  return placed;
}

function build(product, purchaseCodeMap) {
  const entries = new Map();
  const add = (entry) => entries.set(entry.account, entry);
  if (FIXED_ASSET_PRODUCTS.has(product)) {
    for (const account of Object.keys(OPENING_FIXED_ASSET_CLASSES)) add(balanceSheetEntry(account, "D", "assets"));
  }
  if (product === "ltd") {
    for (const [account, { normalSide }] of Object.entries(OPENING_BALANCE_LINES)) {
      const placement = COMPANY_PLACEMENTS[account];
      if (!placement) throw new Error(`Opening balance account ${account} has no Company placement`);
      add(balanceSheetEntry(account, normalSide, placement.chartTable, placement.frs102));
    }
  }
  for (const account of BANK_ACCOUNTS[product]) {
    add(balanceSheetEntry(account, OPENING_BALANCE_LINES[account].normalSide, "bank"));
  }
  for (const account of SALES_ACCOUNTS[product]) add(salesEntry(account));
  for (const account of Object.keys(purchaseCodeMap)) add(purchaseEntry(product, purchaseCodeMap, account));
  if (product !== "ltd") return entries;

  for (const account of Object.keys(POSTING_ACCOUNTS)) {
    const { accountClass, normalSide } = COMPANY_PLACEMENTS[account] || {};
    if (!accountClass) throw new Error(`Posting account ${account} has no Company placement`);
    add({ account, accountClass, normalSide, chartTable: null });
  }
  for (const [account, entry] of entries) {
    const placement = COMPANY_PLACEMENTS[account];
    if (!placement) throw new Error(`Company account ${account} has no placement`);
    entries.set(account, withPlacement(entry, placement));
  }
  const unused = Object.keys(COMPANY_PLACEMENTS).filter((account) => !entries.has(account));
  if (unused.length > 0) throw new Error(`Company placements name accounts no chart declares: ${unused.join(", ")}`);
  return entries;
}

const BUILT = new Map(Object.keys(PURCHASE_CODE_MAP).map((product) => [product, build(product, PURCHASE_CODE_MAP[product])]));

/**
 * Every account a product's chart can declare, by account id: its class, its
 * normal side, the chart table a book declares it in (null for the accounts
 * the posting rules add), and for a Company account `frs102` (the FRS 102
 * concept it feeds) and `frs105` (the FRS 105 line it feeds), each null for an
 * account the published statements leave out.
 * @param {string} product - bst, taxi, se or ltd
 * @param {Object} [options]
 * @param {Object} [options.purchaseCodeMap] - the purchase code map a book's own chart resolves to (a Basic Sole Trader book kept on the Taxi Driver chart)
 * @returns {Map<string, Object>}
 */
export function accountClasses(product, { purchaseCodeMap } = {}) {
  if (!BUILT.has(product)) throw new Error(`Unknown product "${product}"; account classes cover ${[...BUILT.keys()].join(", ")}`);
  if (purchaseCodeMap === undefined || purchaseCodeMap === PURCHASE_CODE_MAP[product]) return BUILT.get(product);
  return build(product, purchaseCodeMap);
}

/**
 * The account classes of one book's chart, with the purchase code map its
 * declared chart resolves to.
 * @param {Object} book
 * @param {string} product - bst, taxi, se or ltd
 * @returns {Map<string, Object>}
 */
export function accountClassesOfBook(book, product) {
  if (product === "bst") return accountClasses(product, { purchaseCodeMap: resolveBstPurchaseCodeMap(book) });
  return accountClasses(product);
}
