// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-roll-forward.js — the next year of a book: the year end moves on a
// year, the closing balances become the opening ones, and the lines hold only
// the opening entries the product reads.
//
// The roll reads the closing position from the lines through the engine, not
// from the report: the report states tax and social security as one figure,
// where the next year needs VAT, PAYE and CIS apart; it gives cost and
// depreciation per asset class, where the register needs them per asset; and
// it nets the bank accounts and their transfers into one cash figure, where
// each bank sheet needs its own opening balance.

import { extractTaxDataFromBook, diyaGlToScenario, bookAssetOf } from "./diya-gl-loader.js";
import { calculateFromDiyaGl } from "./diya-gl-calculator.js";
import { ltdScheduleRows } from "./calculators/ltd.js";
import { seScheduleRegister } from "./calculators/se.js";
import { bstAdditionsWrittenDown } from "./calculators/bst.js";
import { taxiAdditionsWrittenDown } from "./calculators/taxi.js";
import { BANK_ACCOUNT_FILES, BANK_TRANSFER_CODES, isLtdOpeningBankLine } from "./ltd-layout.js";
import { buildOpeningBalance, toV2OpeningBalances, isOpeningBalanceLine, OPENING_BALANCE_LINES } from "./scenario-extractor.js";
import { taxTablesForProduct, productIdOf } from "./xlsx-exporter.js";
import { periodFromYearEnd } from "./diya-gl-new-book.js";

const OPENING_DOCUMENT_REFERENCE = "OB-001";
const OPENING_BANK_REFERENCE = "BNK-BC-001";
const PENNY = 0.005;

function isoDay(value) {
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

// Every date the book carries as YYYY-MM-DD. A book parsed from TOML holds
// its dates (a director's appointment, a member's shares, an asset's
// purchase) as Date objects, which reach JSON as date-times; the book
// schema and the next read want the day.
function withDayDates(value) {
  if (value instanceof Date) return isoDay(value);
  if (Array.isArray(value)) return value.map(withDayDates);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withDayDates(item)]));
  return value;
}

function roundPence(value) {
  return Math.round(value * 100) / 100;
}

/**
 * The year end a year after a book's own, on the same day of the same month
 * (the last day of February where the book's falls on the 29th).
 * @param {Object} book
 * @returns {string} YYYY-MM-DD
 */
export function rolledYearEnd(book) {
  const [year, month, day] = isoDay(book.documentInfo.periodCoveredEnd).split("-").map(Number);
  const end = new Date(Date.UTC(year + 1, month - 1, day));
  if (end.getUTCMonth() !== month - 1) end.setUTCDate(0);
  return end.toISOString().slice(0, 10);
}

function productOfBook(book) {
  const product = productIdOf(book.entityInformation?.["diya-gl:product"]);
  if (!product)
    throw new Error(
      `The book declares no product: entityInformation."diya-gl:product" is ${JSON.stringify(book.entityInformation?.["diya-gl:product"])}`,
    );
  return product;
}

// The year's calculated cells, through the same D -> R loop the report runs,
// so the closing figures read here are the figures the report printed.
function closingPosition(book, lines, product) {
  const taxData = extractTaxDataFromBook(book, product);
  const scenario = diyaGlToScenario(book, lines, product);
  const results = calculateFromDiyaGl(book, lines, product, taxData, scenario);
  return { taxData, scenario, results };
}

// ── The fixed asset register ───────────────────────────────────────────────

const ASSET_CLASS_OF_SCHEDULE_CATEGORY = {
  land: "landBuildings",
  plant: "plantMachinery",
  fixtures: "fixturesFittings",
  computer: "computerTechnology",
  motor: "motorVehicles",
};

// The register entry for an asset the year bought: the book's own entry when
// the purchase line names one by diya-gl:assetID, otherwise one made from the
// purchase line itself.
function assetBoughtBy(entryNumber, book, linesByEntry, scheduleCategory) {
  const line = linesByEntry.get(entryNumber);
  if (!line) throw new Error(`The fixed asset schedule names entry ${entryNumber}, which the lines do not carry`);
  const assetID = line["diya-gl:assetID"];
  const declared = assetID ? (book.fixedAssets || []).find((asset) => asset.assetID === assetID) : undefined;
  if (declared) return { ...declared };
  const asset = {
    assetID: assetID || `FA-${line.entryNumber}`,
    class: ASSET_CLASS_OF_SCHEDULE_CATEGORY[scheduleCategory] || "plantMachinery",
    description: line.lineItemComment || line.detailComment || line.entryNumber,
    acquiredDate: isoDay(line.postingDate),
  };
  return asset;
}

function carriedAsset(asset, { cost, accumulatedDepreciation, taxWrittenDownValue }) {
  const { disposedDate, disposalProceeds, ...kept } = asset;
  const carried = { ...kept, cost: roundPence(cost) };
  if (accumulatedDepreciation !== undefined) carried.accumulatedDepreciation = roundPence(accumulatedDepreciation);
  else delete carried.accumulatedDepreciation;
  if (taxWrittenDownValue !== undefined) carried.taxWrittenDownValue = roundPence(Math.max(0, taxWrittenDownValue));
  else delete carried.taxWrittenDownValue;
  return carried;
}

// Ltd: one register entry per Schedule row still held at the year end, with
// that row's cost, depreciation carried forward and pool carried forward.
function ltdFixedAssets(book, linesByEntry, taxData, scenario) {
  const assets = [];
  for (const row of ltdScheduleRows(book, taxData, scenario)) {
    if (row.disposed || !(row.cost > 0)) continue;
    const source = row.acquiredInYear ? assetBoughtBy(row.entryNumber, book, linesByEntry, row.assetClass) : bookAssetOf(row.openingAsset);
    assets.push(
      carriedAsset(source, {
        cost: row.cost,
        accumulatedDepreciation: row.depreciationCarriedForward,
        taxWrittenDownValue: row.poolCarriedForward,
      }),
    );
  }
  return assets;
}

// SE: the same from the Self Employed Schedule's own rows. A row whose
// disposal moved its net book value off the register is left behind.
function seFixedAssets(book, linesByEntry, taxData, scenario) {
  const number = (value) => (typeof value === "number" ? value : 0);
  const assets = [];
  for (const { openingAsset, entryNumber, row } of seScheduleRegister(scenario, taxData)) {
    if (!(number(row.E) > 0) || typeof row.V === "number") continue;
    const source = openingAsset ? bookAssetOf(openingAsset) : assetBoughtBy(entryNumber, book, linesByEntry, "plant");
    assets.push(
      carriedAsset(source, {
        cost: number(row.E),
        accumulatedDepreciation: number(row.J),
        taxWrittenDownValue: number(row.S),
      }),
    );
  }
  return assets;
}

// BST and Taxi: the sheet keeps no depreciation, only the tax pool, so the
// register carries each asset's written-down value. Assets brought into the
// year keep what they carried.
function soleTraderFixedAssets(book, linesByEntry, additions) {
  const bought = new Set();
  const assets = additions.map(({ entryNumber, cost, writtenDownValue }) => {
    const source = assetBoughtBy(entryNumber, book, linesByEntry, "plant");
    bought.add(source.assetID);
    return carriedAsset(source, { cost, taxWrittenDownValue: writtenDownValue });
  });
  const held = (book.fixedAssets || []).filter((asset) => !bought.has(asset.assetID) && !asset.disposedDate).map((asset) => ({ ...asset }));
  return [...held, ...assets];
}

// ── Company bank balances ──────────────────────────────────────────────────

const FILE_OF_TRANSFER_CODE = Object.fromEntries(Object.entries(BANK_TRANSFER_CODES).map(([file, code]) => [code, file]));
const ACCOUNT_OF_FILE = Object.fromEntries(Object.entries(BANK_ACCOUNT_FILES).map(([account, file]) => [file, account]));

// The transfer legs the year's bank lines carry, as what each sheet says it
// sent to each other sheet: a payment coded with another sheet's letter is
// money sent there, a receipt so coded money that came back.
function transfersSent(lines, periodStart) {
  const sent = {};
  for (const line of lines) {
    if (line.sourceJournalID !== "bank") continue;
    const code = line["diya-gl:bankCode"];
    const target = FILE_OF_TRANSFER_CODE[code];
    if (!target) continue;
    if (isLtdOpeningBankLine(code, new Date(line.postingDate), periodStart)) continue;
    const file = BANK_ACCOUNT_FILES[line["diya-gl:bankAccountID"] || line.accountMainID];
    if (!file || file === target) continue;
    const amount = line.debitCreditCode === "C" ? line.amount : -line.amount;
    sent[file] ??= {};
    sent[file][target] = (sent[file][target] || 0) + amount;
  }
  return sent;
}

// Each Company bank sheet's closing balance: the trial balance's own echo of
// the sheet, plus whatever transfer the sheet at the other end recorded and
// this one did not. The trial balance keeps that unmatched part on its intra
// transfers row; the next year has no such row to open, so it lands on the
// sheet that missed its leg.
function ltdBankClosings(tb, lines, periodStart) {
  const closings = {
    "Currentaccount.xlsx": tb.EJ22 || 0,
    "Savingaccount.xlsx": tb.EJ23 || 0,
    "Creditcardaccount.xlsx": tb.EJ24 || 0,
    "Cashaccount.xlsx": tb.EJ25 || 0,
  };
  const sent = transfersSent(lines, periodStart);
  const files = Object.keys(closings);
  let allocated = 0;
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const [a, b] = [files[i], files[j]];
      const aToB = sent[a]?.[b] || 0;
      const bToA = sent[b]?.[a] || 0;
      const unmatched = aToB + bToA;
      if (Math.abs(unmatched) < PENNY) continue;
      closings[Math.abs(aToB) >= Math.abs(bToA) ? b : a] += unmatched;
      allocated += unmatched;
    }
  }
  if (Math.abs(allocated - (tb.EJ26 || 0)) >= PENNY) {
    throw new Error(
      `The bank transfers leave ${roundPence(tb.EJ26 || 0)} on the intra transfers row, of which the lines account for ${roundPence(allocated)}`,
    );
  }
  return Object.fromEntries(Object.entries(closings).map(([file, value]) => [ACCOUNT_OF_FILE[file], roundPence(value)]));
}

// ── Opening entries ────────────────────────────────────────────────────────

const ACCOUNT_OF_OPENING_KEY = Object.fromEntries(Object.entries(OPENING_BALANCE_LINES).map(([account, { key }]) => [key, account]));
const NORMAL_SIDE_OF_ACCOUNT = Object.fromEntries(
  Object.entries(OPENING_BALANCE_LINES).map(([account, { normalSide }]) => [account, normalSide]),
);

const FIXED_ASSET_ACCOUNT_OF_CLASS = {
  landBuildings: "0000",
  plantMachinery: "0010",
  fixturesFittings: "0020",
  computerTechnology: "0030",
  motorVehicles: "0040",
};

const ACCOUNT_DESCRIPTIONS = {
  "0000": "Land and buildings",
  "0010": "Plant and machinery",
  "0020": "Fixtures and fittings",
  "0030": "Computer equipment",
  "0040": "Motor vehicles",
  "1100": "Stock",
  "1200": "Current account",
  "1210": "Savings account",
  "1220": "Cash account",
  "1230": "Credit card account",
  "1300": "Trade debtors",
  "1400": "Long term debtors",
  "2100": "Trade creditors",
  "2150": "Net wages due",
  "2160": "Deductions from wages due",
  "2200": "VAT liability",
  "2300": "Corporation Tax liability",
  "2400": "PAYE/NI liability",
  "2410": "CIS liability",
  "2500": "Directors loan account",
  "2600": "Long term creditors",
  "3000": "Share capital",
  "3100": "Retained earnings",
  "3200": "Dividends",
  "3300": "Capital reserves",
};

function chartGroupOf(account) {
  if (/^12[0-3]0$/.test(account)) return "bank";
  if (account.startsWith("0") || account.startsWith("1")) return "assets";
  if (account.startsWith("2")) return "liabilities";
  return "capital";
}

// One line of the opening journal: the account's balance on its natural
// side, or on the other side where the balance has turned (an overdrawn
// bank, a director who owes the company).
function journalLine(account, balance, normalSide, comment) {
  const onNaturalSide = balance >= 0;
  const side = onNaturalSide ? normalSide : normalSide === "D" ? "C" : "D";
  return { account, side, amount: roundPence(Math.abs(balance)), comment };
}

function linesFrom(entries, startDate) {
  return entries.map((entry, index) => {
    const line = {
      entryNumber: `OB-${String(index + 1).padStart(4, "0")}`,
      sourceJournalID: entry.journal,
      postingDate: startDate,
      accountMainID: entry.account,
      debitCreditCode: entry.side,
      amount: entry.amount,
      documentType: entry.journal === "bank" ? "bank-statement" : "journal",
      documentReference: entry.journal === "bank" ? OPENING_BANK_REFERENCE : OPENING_DOCUMENT_REFERENCE,
      detailComment: entry.journal === "bank" ? "Balance brought forward" : "Opening balances",
      lineItemComment: entry.comment,
      taxCode: "OS",
      taxRate: 0,
    };
    if (entry.journal === "journal") line.lineNumber = index + 1;
    if (entry.journal === "bank") {
      line["diya-gl:bankCode"] = "BC";
      line["diya-gl:bankAccountID"] = entry.account;
    }
    return line;
  });
}

function bankEntries(bankBalances) {
  return Object.entries(bankBalances)
    .filter(([, balance]) => Math.abs(balance) >= PENNY)
    .map(([account, balance]) => ({
      journal: "bank",
      ...journalLine(account, balance, "D", `${ACCOUNT_DESCRIPTIONS[account] || account} brought forward`),
    }));
}

// The Company's opening journal: every balance sheet account the trial
// balance closes with, the fixed assets per class from the register, and the
// retained profit as the figure that balances it.
function ltdOpeningEntries({ results, lines, fixedAssets, periodStart, priorOpening }) {
  const tb = results.TrialBalance || {};
  const pub = results.PubBalSht || {};
  const balances = {};
  const set = (key, value) => {
    if (Math.abs(value) >= PENNY) balances[key] = roundPence(value);
  };
  set("stock", pub.E10 || 0);
  set("trade_debtors", tb.EJ20 || 0);
  const bankBalances = ltdBankClosings(tb, lines, periodStart);
  for (const [account, balance] of Object.entries(bankBalances)) set(OPENING_BALANCE_LINES[account].key, balance);
  set("long_term_debtors", longTermDebtorsClosing(lines, periodStart, priorOpening));
  set("trade_creditors", -(tb.EJ28 || 0));
  set("net_wages_due", -(tb.EJ29 || 0));
  set("wage_deductions_due", -(tb.EJ30 || 0));
  set("dividends_due", -(tb.EJ31 || 0));
  set("cis_due", -(tb.EJ32 || 0));
  set("vat_due", -(tb.EJ33 || 0));
  set("paye_due", -(tb.EJ34 || 0));
  set("corporation_tax", -(tb.EJ35 || 0));
  set("directors_loan", -(tb.EJ39 || 0));
  set("long_term_creditors", -(tb.EJ40 || 0));
  set("share_capital", pub.F36 || 0);
  set("capital_reserves", priorOpening.capital_reserves || 0);

  const entries = [];
  const costByClass = {};
  const depreciationByClass = {};
  for (const asset of fixedAssets) {
    const account = FIXED_ASSET_ACCOUNT_OF_CLASS[asset.class];
    costByClass[account] = (costByClass[account] || 0) + asset.cost;
    depreciationByClass[account] = (depreciationByClass[account] || 0) + (asset.accumulatedDepreciation || 0);
  }
  for (const account of Object.keys(costByClass).sort()) {
    entries.push({ journal: "journal", ...journalLine(account, costByClass[account], "D", `${ACCOUNT_DESCRIPTIONS[account]} cost`) });
    if (Math.abs(depreciationByClass[account]) >= PENNY) {
      entries.push({
        journal: "journal",
        ...journalLine(account, depreciationByClass[account], "C", `${ACCOUNT_DESCRIPTIONS[account]} accumulated depreciation`),
      });
    }
  }
  for (const [key, balance] of Object.entries(balances)) {
    const account = ACCOUNT_OF_OPENING_KEY[key];
    entries.push({ journal: "journal", ...journalLine(account, balance, NORMAL_SIDE_OF_ACCOUNT[account], ACCOUNT_DESCRIPTIONS[account]) });
  }
  const debits = entries.reduce((sum, entry) => sum + (entry.side === "D" ? entry.amount : -entry.amount), 0);
  entries.push({ journal: "journal", ...journalLine("3100", debits, "C", "Retained earnings brought forward") });
  return { entries: [...entries, ...bankEntries(bankBalances)], bankBalances };
}

// Long term debtors close on the opening figure plus what the bank lent out
// under LDR less what came back under it; the trial balance row is not among
// the cells the year reports.
function longTermDebtorsClosing(lines, periodStart, priorOpening) {
  let balance = priorOpening.long_term_debtors || 0;
  for (const line of lines) {
    if (line.sourceJournalID !== "bank" || line["diya-gl:bankCode"] !== "LDR") continue;
    balance += line.debitCreditCode === "C" ? line.amount : -line.amount;
  }
  return balance;
}

// The Self Employed bank sheets' closing balances, each sheet's own last
// month's A2.
function seBankClosings(results) {
  const closings = {};
  for (const [account, file] of [
    ["1200", "Bank.xlsx"],
    ["1220", "Cash.xlsx"],
  ]) {
    const key = Object.keys(results).find((name) => name.startsWith(`${file}!`) && typeof results[name]?.A2 === "number");
    if (key) closings[account] = roundPence(results[key].A2);
  }
  return closings;
}

// ── The book ───────────────────────────────────────────────────────────────

// What the next year keeps of the book's tax tables beside the new year's
// rates: the facts about the business (associated companies, the
// disallowable shares, the Structures and Buildings Allowance claims that run
// for years, the basis period record with its transition profit moved on),
// and nothing the year itself stated by hand.
function rolledTax(book, rateData, product, results) {
  const tax = taxTablesForProduct(rateData, product);
  const associated = book.tax?.corporationTax?.associatedCompanies;
  if (associated !== undefined) tax.corporationTax = { ...(tax.corporationTax || {}), associatedCompanies: associated };
  const selfEmployment = book.tax?.selfEmployment;
  if (selfEmployment) {
    const { allowances, adjustments, basisPeriod, ...disallowable } = selfEmployment;
    const kept = { ...disallowable };
    const claims = {};
    if (allowances?.structuredBuildingAllowance) claims.structuredBuildingAllowance = allowances.structuredBuildingAllowance;
    if (allowances?.enhancedStructuredBuildingAllowance)
      claims.enhancedStructuredBuildingAllowance = allowances.enhancedStructuredBuildingAllowance;
    if (Object.keys(claims).length > 0) kept.allowances = claims;
    if (basisPeriod) {
      const { transitionProfitAccelerationAmount, ...period } = basisPeriod;
      const carried = results["Business Details"]?.O74;
      if (typeof carried === "number") {
        if (carried > PENNY) period.transitionProfitBroughtForward = roundPence(carried);
        else delete period.transitionProfitBroughtForward;
      }
      if (Object.keys(period).length > 0) kept.basisPeriod = period;
    }
    if (Object.keys(kept).length > 0) tax.selfEmployment = kept;
  }
  return tax;
}

function rolledLedger(entries) {
  if (!entries) return undefined;
  const carried = entries.filter((entry) => entry.timing === "closing").map((entry) => ({ ...entry, timing: "opening" }));
  return carried.length > 0 ? carried : undefined;
}

// Hire purchase on a Company book reaches the balance sheet as the amount
// financed moving from trade to long term creditors in the year the agreement
// is listed, so a listed agreement would move it again; the balance carries
// on the long term creditors line instead. A Self Employed book keeps the
// agreements still running into the next year.
function rolledHireAgreements(book, product, startDate) {
  if (product === "ltd" || !book.hpAgreements) return undefined;
  const running = book.hpAgreements.filter((agreement) => {
    const [year, month, day] = isoDay(agreement.startDate).split("-").map(Number);
    const ends = new Date(Date.UTC(year, month - 1 + agreement.termMonths, day));
    return ends.toISOString().slice(0, 10) > startDate;
  });
  return running.length > 0 ? running : undefined;
}

function ensureAccounts(accounts, codes) {
  const chart = structuredClone(accounts || {});
  for (const code of codes) {
    const group = chartGroupOf(code);
    const declared = Object.values(chart).some((table) => table && Object.hasOwn(table, code));
    if (declared) continue;
    chart[group] ??= {};
    chart[group][code] = { accountMainDescription: ACCOUNT_DESCRIPTIONS[code] || code };
    if (group === "bank") chart[group][code].accountType = "bank";
  }
  return chart;
}

function setOrDelete(target, key, value) {
  if (value === undefined) delete target[key];
  else target[key] = value;
}

/**
 * The next year of a book.
 * @param {Object} book - the year's book
 * @param {Array} lines - the year's lines
 * @param {Object} rateData - the parsed app/data/<year>.toml the next year end falls in
 * @returns {{book: Object, lines: Array}}
 */
export function rollForward(book, lines, rateData) {
  const product = productOfBook(book);
  const { taxData, scenario, results } = closingPosition(book, lines, product);
  const priorStart = new Date(isoDay(book.documentInfo.periodCoveredStart));
  const priorEnd = isoDay(book.documentInfo.periodCoveredEnd);
  const period = periodFromYearEnd(rolledYearEnd(book));
  const linesByEntry = new Map(lines.filter((line) => line.entryNumber !== undefined).map((line) => [line.entryNumber, line]));

  const rolled = structuredClone(book);
  const { creationDate, ...documentInfo } = rolled.documentInfo;
  documentInfo.periodCoveredStart = period.start;
  documentInfo.periodCoveredEnd = period.end;
  documentInfo.entriesComment = `Rolled forward from the year to ${priorEnd}`;
  if (documentInfo["diya-gl:payrollYearStart"] !== undefined) {
    const [year, month, day] = isoDay(documentInfo["diya-gl:payrollYearStart"]).split("-").map(Number);
    documentInfo["diya-gl:payrollYearStart"] = new Date(Date.UTC(year + 1, month - 1, day)).toISOString().slice(0, 10);
  }
  rolled.documentInfo = documentInfo;
  rolled.tax = rolledTax(book, rateData, product, results);
  delete rolled.dividends;
  setOrDelete(rolled, "debtors", rolledLedger(book.debtors));
  setOrDelete(rolled, "creditors", rolledLedger(book.creditors));
  setOrDelete(rolled, "hpAgreements", rolledHireAgreements(book, product, period.start));

  let fixedAssets;
  if (product === "ltd") fixedAssets = ltdFixedAssets(book, linesByEntry, taxData, scenario);
  else if (product === "se") fixedAssets = seFixedAssets(book, linesByEntry, taxData, scenario);
  else if (product === "bst") fixedAssets = soleTraderFixedAssets(book, linesByEntry, bstAdditionsWrittenDown(scenario, taxData));
  else fixedAssets = soleTraderFixedAssets(book, linesByEntry, taxiAdditionsWrittenDown(scenario, taxData));
  setOrDelete(rolled, "fixedAssets", fixedAssets.length > 0 ? fixedAssets : undefined);

  let closingStock;
  if (product === "ltd") closingStock = results.PubBalSht?.E10;
  else if (book.stock) closingStock = book.stock.closingValue ?? 0;
  if (book.stock) {
    const stock = { ...book.stock, openingValue: roundPence(closingStock ?? book.stock.closingValue ?? 0) };
    stock.closingValue = stock.openingValue;
    if (book.stock.closingCount !== undefined) stock.openingCount = book.stock.closingCount;
    rolled.stock = stock;
  }

  let rolledLines = [];
  if (product === "ltd") {
    const priorOpening = buildOpeningBalance(lines.filter(isOpeningBalanceLine));
    const { entries, bankBalances } = ltdOpeningEntries({ results, lines, fixedAssets, periodStart: priorStart, priorOpening });
    rolledLines = linesFrom(entries, period.start);
    rolled.accounts = ensureAccounts(rolled.accounts, [...new Set(entries.map((entry) => entry.account))]);
    rolled.openingBalances = toV2OpeningBalances(buildOpeningBalance(rolledLines));
    if (Object.keys(bankBalances).length === 0) delete rolled.openingBalances.bankAccounts;
  } else if (product === "se") {
    const bankBalances = seBankClosings(results);
    const entries = bankEntries(bankBalances);
    rolledLines = linesFrom(entries, period.start);
    rolled.accounts = ensureAccounts(
      rolled.accounts,
      entries.map((entry) => entry.account),
    );
    const openingBalances = {};
    if (entries.length > 0)
      openingBalances.bankAccounts = Object.fromEntries(entries.map((entry) => [entry.account, bankBalances[entry.account]]));
    if (rolled.stock) openingBalances.stock = rolled.stock.openingValue;
    setOrDelete(rolled, "openingBalances", Object.keys(openingBalances).length > 0 ? openingBalances : undefined);
  } else if (product === "bst") {
    const ledger = results["Debtors & Creditors"] || {};
    const openingBalances = { tradeDebtors: roundPence(ledger.C29 || 0), tradeCreditors: roundPence(ledger.F29 || 0) };
    if (rolled.stock) openingBalances.stock = rolled.stock.openingValue;
    rolled.openingBalances = openingBalances;
  } else {
    delete rolled.openingBalances;
  }

  return { book: withDayDates(rolled), lines: rolledLines };
}

// ── The roll's own check ───────────────────────────────────────────────────

function valuesOf(report) {
  return new Map(report.values.map((entry) => [entry.key, Number(entry.value)]));
}

const OBS = "section/opening-balance-sheet/";
const PBS = "section/published-balance-sheet/";
const TB = "section/trial-balance/";

// Each opening figure the next year prints, against the figure the year
// printed for the same balance. The published trade creditors also carry
// the wages and dividends still owed, which the opening sheet keeps on rows
// of their own outside its printed figures, and the published shareholders'
// funds carry the capital reserves.
function ltdPairs(prior, rolled, priorLines) {
  const at = (map, key) => map.get(key) ?? 0;
  const reserves = buildOpeningBalance(priorLines.filter(isOpeningBalanceLine)).capital_reserves || 0;
  return [
    [`${OBS}tangible-assets-net-book-value`, at(prior, `${PBS}fixed-assets-nbv`)],
    [`${OBS}stock-at-cost`, at(prior, `${PBS}stock-at-cost`)],
    [`${OBS}trade-debtors`, at(prior, `${PBS}trade-debtors`)],
    [`${OBS}cash-and-bank-balances`, at(prior, `${PBS}cash-at-bank-and-in-hand`) - at(prior, `${PBS}bank-overdraft`)],
    [
      `${OBS}trade-creditors`,
      at(prior, `${PBS}trade-creditors`) +
        at(prior, `${TB}final-net-wages-creditor`) +
        at(prior, `${TB}final-other-deductions-from-wages`) +
        at(prior, `${TB}final-dividends-creditor`),
    ],
    [`${OBS}corporation-tax`, at(prior, `${PBS}corporation-tax`)],
    [`${OBS}taxation-and-social-security`, at(prior, `${PBS}taxation-and-social-security`)],
    [`${OBS}directors-loan-account`, at(prior, `${PBS}directors-loan`)],
    [`${OBS}called-up-share-capital`, at(prior, `${PBS}called-up-share-capital`)],
    [
      `${OBS}retained-profit-and-loss-account`,
      at(prior, `${PBS}shareholders-funds`) - at(prior, `${PBS}called-up-share-capital`) - reserves,
    ],
    [`${OBS}accuracy-check`, 0],
  ].map(([key, expected]) => [key, expected, at(rolled, key)]);
}

// The Self Employed sheets have no balance sheet of their own; what carries
// is each bank sheet's balance, the stock, and the fixed asset schedule's
// cost, depreciation and net book value. A freshly rolled book has no
// movement, so its last month opens on the balance the year closed on.
function sePairs(prior, rolled) {
  const pairs = [];
  for (const file of ["Bank.xlsx", "Cash.xlsx"]) {
    const closing = [...prior.keys()].find((key) => key.startsWith(`cell/${file}!`) && key.endsWith("!A2"));
    const opening = [...rolled.keys()].find((key) => key.startsWith(`cell/${file}!`) && key.endsWith("!A1"));
    if (closing && opening) pairs.push([opening, prior.get(closing), rolled.get(opening)]);
  }
  const stock = "cell/Financialaccounts.xlsx!StockControl!";
  const schedule = "cell/Fixedassets.xlsx!Schedule!";
  const at = (map, key) => map.get(key) ?? 0;
  pairs.push([`${stock}AB6`, at(prior, `${stock}AB30`), at(rolled, `${stock}AB6`)]);
  pairs.push([`${schedule}E57`, at(prior, `${schedule}E1`) - at(prior, `${schedule}W1`), at(rolled, `${schedule}E57`)]);
  pairs.push([`${schedule}F1`, at(prior, `${schedule}J1`) - at(prior, `${schedule}X1`), at(rolled, `${schedule}F1`)]);
  pairs.push([`${schedule}G1`, at(prior, `${schedule}K1`), at(rolled, `${schedule}G1`)]);
  return pairs;
}

function bstPairs(prior, rolled) {
  const dc = "section/debtors-creditors/";
  const at = (map, key) => map.get(key) ?? 0;
  return [
    [
      `${dc}owed-by-customers-at-start-of-year`,
      at(prior, `${dc}amount-owed-by-customers`),
      at(rolled, `${dc}owed-by-customers-at-start-of-year`),
    ],
    [
      `${dc}owed-to-suppliers-at-start-of-year`,
      at(prior, `${dc}amount-owed-to-suppliers`),
      at(rolled, `${dc}owed-to-suppliers-at-start-of-year`),
    ],
    ["section/stock/opening-stock", at(prior, "section/stock/closing-stock"), at(rolled, "section/stock/opening-stock")],
  ];
}

// The Basic Sole Trader and Taxi Driver sheets take only the year's
// additions, so the pool the year carried forward is held on the register:
// the year's carried forward value plus whatever the assets held before the
// year already carried.
const POOL_CARRIED_FORWARD = {
  bst: "section/fixed-assets/total-written-down-tax-value",
  taxi: "section/fixed-assets/written-down-value-carried-forward",
};

function poolPair(product, prior, priorBook, priorLines, rolledBook) {
  const bought = new Set(priorLines.map((line) => line["diya-gl:assetID"]).filter(Boolean));
  const heldBefore = (priorBook.fixedAssets || []).filter((asset) => !bought.has(asset.assetID) && !asset.disposedDate);
  const sum = (assets) => assets.reduce((total, asset) => total + (asset.taxWrittenDownValue || 0), 0);
  return [
    "fixedAssets.taxWrittenDownValue",
    (prior.get(POOL_CARRIED_FORWARD[product]) ?? 0) + sum(heldBefore),
    sum(rolledBook.fixedAssets || []),
  ];
}

/**
 * The roll's own check: each opening figure the next year's report prints
 * against the closing figure the year's report printed for the same balance,
 * and for the two products whose sheets take no pool brought forward, the
 * register's tax written-down value against the pool the year carried
 * forward. The year's published figures carry fractions of a penny the
 * opening journal rounds away, so a figure passes within a penny.
 * @param {Object} params
 * @param {Object} params.priorBook - the year's book
 * @param {Array} params.priorLines - the year's lines
 * @param {Object} params.priorReport - the year's R
 * @param {Object} params.rolledBook - the next year's book
 * @param {Object} params.rolledReport - the next year's R
 * @returns {Array<{key: string, expected: number, actual: number, result: "pass"|"fail"}>}
 */
export function rollForwardChecks({ priorBook, priorLines, priorReport, rolledBook, rolledReport }) {
  const product = productOfBook(priorBook);
  const prior = valuesOf(priorReport);
  const rolled = valuesOf(rolledReport);
  let pairs = [];
  if (product === "ltd") pairs = ltdPairs(prior, rolled, priorLines);
  else if (product === "se") pairs = sePairs(prior, rolled);
  else if (product === "bst") pairs = [...bstPairs(prior, rolled), poolPair(product, prior, priorBook, priorLines, rolledBook)];
  else pairs = [poolPair(product, prior, priorBook, priorLines, rolledBook)];
  return pairs.map(([key, expected, actual]) => ({
    key,
    expected: roundPence(expected) + 0,
    actual: roundPence(actual) + 0,
    result: Math.abs(expected - actual) < 2 * PENNY ? "pass" : "fail",
  }));
}
