// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// posting-rules.js — the balanced postings each line of a Company book stands
// for, and the year-end postings the calculator takes from the book's
// registers rather than from its lines.
//
// A daybook line (sales, purchases, bank, payroll) is one-sided: its contra
// legs live in the Limited Company workbook's formulas, which the calculator
// (calculators/ltd.js, buildTrialBalance) reproduces. This module states
// those legs as postings to accounts, read off the same formulas:
//
// - a sale debits trade debtors with the gross less any CIS the customer
//   withheld, debits the CIS creditor with that CIS, and credits its income
//   account with the net and VAT with the VAT the row takes off its own gross
//   (Sales column G = F * rate / (100 + rate); TrialBalance F20, F32, F33 and
//   F53 to F57, F81, F17);
// - a purchase is the mirror of a sale on trade creditors (G28, G32, G33 and
//   the expense rows G60 to G90, G16);
// - a bank line debits or credits its bank account (H22 to K25) and posts
//   the contra to the account its bank code names (the H to K columns of
//   rows 20 to 40 and 58 to 89); a transfer's contra is the transfer
//   clearing account (row 26), which nets to nil when both legs are in the
//   book;
// - a payroll line debits gross pay and the employer's National Insurance,
//   credits PAYE with the income tax and both National Insurance figures,
//   and credits net wages with the rest (L29, L34, L64, L66, L67 off
//   WagesInterface, whose G column is C - D - E - F);
// - an opening journal line (documentReference "OB-") posts itself; a credit
//   on a fixed asset account is that class's accumulated depreciation (D11
//   to D15 read the depreciation half of OpenAccounts row 13).
//
// A journal line that is not an opening line reaches no calculator row, and
// neither does a VAT-straddling line (its return sits outside the year) or a
// bank line coded BC on the period's first day (the account's opening
// balance, which the opening journal already carries). Those are listed
// apart and not totalled. Any other line the table does not know throws.

import { BANK_ACCOUNT_FILES, isLtdBookOpeningBankLine, ltdBankPlacement } from "./ltd-layout.js";
import {
  LTD_PURCHASE_CODE_MAP,
  LTD_SALES_CODE_MAP,
  OPENING_BALANCE_LINES,
  OPENING_FIXED_ASSET_CLASSES,
  CIS_DEDUCTION_FIELD,
  isOpeningBalanceLine,
  isStraddlingLine,
  signedAmount,
} from "./scenario-extractor.js";
import { calculateLtdTrialBalance, VAT_RATE } from "./calculators/ltd.js";
import { diyaGlToScenario } from "./diya-gl-loader.js";

const COMPANY_PRODUCT = "Company";

// The accounts a posting can reach that the Company chart does not declare.
// Each stands for one trial balance row the workbook keeps with no account of
// its own in the book.
export const POSTING_ACCOUNTS = {
  "0000-depreciation": "Accumulated depreciation, land and property",
  "0010-depreciation": "Accumulated depreciation, plant and machinery",
  "0020-depreciation": "Accumulated depreciation, fixtures and fittings",
  "0030-depreciation": "Accumulated depreciation, computers",
  "0040-depreciation": "Accumulated depreciation, motor vehicles",
  "bank-transfers": "Transfers between the bank accounts",
  "interest-received": "Interest received",
  "bank-interest-paid": "Bank interest paid",
  "bank-charges": "Bank charges",
  "bank-contra-received": "Bank contra items received",
  "bank-contra-paid": "Bank contra items paid",
  "paye-wages": "Employees' wages through PAYE",
  "directors-paye-wages": "Directors' wages through PAYE",
  "employers-ni": "Employer's National Insurance",
  "stock-movement": "Stock movement",
  "depreciation": "Depreciation",
  "loss-on-disposal": "Loss on disposal of fixed assets",
  "corporation-tax-charge": "Corporation tax charge",
  "dividends-declared": "Dividends declared",
};

const TRADE_DEBTORS = "1300";
const TRADE_CREDITORS = "2100";
const VAT = "2200";
const CIS = "2410";
const PAYE = "2400";
const NET_WAGES = "2150";
const CORPORATION_TAX = "2300";
const DIVIDENDS_CREDITOR = "3200";
const STOCK = "1100";
const LONG_TERM_DEBTORS = "1400";
const LONG_TERM_CREDITORS = "2600";
const FIXED_ASSET_PURCHASES = "5900";
const FIXED_ASSET_SALES = "4006";

// The account each bank code's contra posts to, by the block the line lands
// in. Read off the bank columns of TrialBalance rows 20 to 40 and 58 to 89.
// X is analysed on both blocks and the two land on two rows (88 received, 89
// paid); every other code reaches one account whichever block it lands in.
const BANK_CODE_ACCOUNTS = {
  DR: { receipt: TRADE_DEBTORS, payment: TRADE_DEBTORS },
  CR: { receipt: TRADE_CREDITORS, payment: TRADE_CREDITORS },
  K: { receipt: "interest-received", payment: "interest-received" },
  W: { receipt: NET_WAGES, payment: NET_WAGES },
  B: { receipt: "bank-charges", payment: "bank-charges" },
  J: { receipt: "bank-interest-paid", payment: "bank-interest-paid" },
  LDR: { receipt: LONG_TERM_DEBTORS, payment: LONG_TERM_DEBTORS },
  LCR: { receipt: LONG_TERM_CREDITORS, payment: LONG_TERM_CREDITORS },
  RP: { receipt: PAYE, payment: PAYE },
  RV: { receipt: VAT, payment: VAT },
  RC: { receipt: CIS, payment: CIS },
  RT: { receipt: CORPORATION_TAX, payment: CORPORATION_TAX },
  DV: { receipt: DIVIDENDS_CREDITOR, payment: DIVIDENDS_CREDITOR },
  DL: { receipt: "2500", payment: "2500" },
  X: { receipt: "bank-contra-received", payment: "bank-contra-paid" },
  BB: { receipt: "bank-transfers", payment: "bank-transfers" },
  BS: { receipt: "bank-transfers", payment: "bank-transfers" },
  BD: { receipt: "bank-transfers", payment: "bank-transfers" },
  BC: { receipt: "bank-transfers", payment: "bank-transfers" },
};

// The Schedule's asset classes against the fixed asset account each posts to.
const SCHEDULE_CLASS_ACCOUNTS = { land: "0000", plant: "0010", fixtures: "0020", computer: "0030", motor: "0040" };

/**
 * The rules, line kind by line kind: what each debits and credits, and where
 * the workbook states it. A reader's summary of what postingsOf does.
 */
export const POSTING_RULES = [
  {
    kind: "sale",
    debit: ["1300 trade debtors: gross less CIS withheld", "2410 CIS: CIS withheld"],
    credit: ["the line's income account: net", "2200 VAT: VAT"],
    source: "TrialBalance F17, F20, F32, F33, F53:F57, F81; Sales row 1",
  },
  {
    kind: "purchase",
    debit: ["the line's expense account: net", "2200 VAT: VAT"],
    credit: ["2100 trade creditors: gross less CIS withheld", "2410 CIS: CIS withheld"],
    source: "TrialBalance G16, G28, G32, G33, G60:G90; Purchases row 1",
  },
  {
    kind: "bank",
    debit: ["money in: the bank account", "money out: the account the bank code names"],
    credit: ["money in: the account the bank code names", "money out: the bank account"],
    source: "TrialBalance H:K of rows 20 to 40 and 58 to 89; calculators/ltd.js buildTrialBalance, intraTransfers",
  },
  {
    kind: "payroll",
    debit: ["paye-wages or directors-paye-wages: gross pay", "employers-ni: employer's NI"],
    credit: ["2400 PAYE: income tax and both NI figures", "2150 net wages: gross less income tax and employee's NI"],
    source: "TrialBalance L29, L34, L64, L66, L67; WagesInterface C:H",
  },
  {
    kind: "opening journal",
    debit: ["its own account (a debit on a fixed asset account is cost)"],
    credit: ["its own account (a credit on a fixed asset account is accumulated depreciation)"],
    source: "TrialBalance D6:D44; OpenAccounts",
  },
];

function isoDay(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

function lineName(line) {
  return `Line ${line.entryNumber ?? "(no entryNumber)"}`;
}

function assertCompany(book) {
  const product = book?.entityInformation?.["diya-gl:product"];
  if (product !== COMPANY_PRODUCT) throw new Error(`Posting rules cover Company books; this book is "${product}"`);
}

function vatRateOf(book) {
  return book.entityInformation?.["diya-gl:vatRegistered"] === true ? VAT_RATE : 0;
}

// A signed figure, debit positive, as a posting. A nil figure posts nothing.
function post(postings, account, signed) {
  if (!signed) return;
  postings.push(signed > 0 ? { account, debit: signed, credit: 0 } : { account, debit: 0, credit: -signed });
}

function salePostings(book, line) {
  if (LTD_SALES_CODE_MAP[line.accountMainID] === undefined) {
    throw new Error(`${lineName(line)} is a sale on account ${line.accountMainID}, which no Sales analysis column takes`);
  }
  const rate = vatRateOf(book);
  const gross = signedAmount(line);
  const vat = (gross * rate) / (1 + rate);
  const cis = line[CIS_DEDUCTION_FIELD] || 0;
  const postings = [];
  post(postings, TRADE_DEBTORS, gross - cis);
  post(postings, CIS, cis);
  post(postings, String(line.accountMainID), -(gross - vat));
  post(postings, VAT, -vat);
  return postings;
}

function purchasePostings(book, line) {
  if (LTD_PURCHASE_CODE_MAP[line.accountMainID] === undefined) {
    throw new Error(`${lineName(line)} is a purchase on account ${line.accountMainID}, which no Purchases analysis column takes`);
  }
  const rate = vatRateOf(book);
  const gross = signedAmount(line);
  const vat = (gross * rate) / (1 + rate);
  const cis = line[CIS_DEDUCTION_FIELD] || 0;
  const postings = [];
  post(postings, String(line.accountMainID), gross - vat);
  post(postings, VAT, vat);
  post(postings, TRADE_CREDITORS, -(gross - cis));
  post(postings, CIS, -cis);
  return postings;
}

function bankPostings(line) {
  const bankAccount = line["diya-gl:bankAccountID"];
  const fileName = BANK_ACCOUNT_FILES[bankAccount];
  if (!fileName) throw new Error(`${lineName(line)} is a bank line on bank account ${bankAccount}, which no bank workbook keeps`);
  const side = line.debitCreditCode;
  if (side !== "D" && side !== "C") throw new Error(`${lineName(line)} is a bank line with neither D nor C`);
  const code = line["diya-gl:bankCode"];
  const placement = ltdBankPlacement(fileName, side === "D", code, line.amount);
  if (!placement.analysed || !BANK_CODE_ACCOUNTS[code]) {
    throw new Error(`${lineName(line)} is coded ${code} in ${fileName}, which has no column for it on the side it lands`);
  }
  const contra = BANK_CODE_ACCOUNTS[code][placement.receipt ? "receipt" : "payment"];
  const signed = side === "D" ? line.amount : -line.amount;
  const postings = [];
  post(postings, String(bankAccount), signed);
  post(postings, contra, -signed);
  return postings;
}

function isDirector(book, line) {
  const employees = book.employees || [];
  const named =
    employees.find((employee) => employee.employeeID !== undefined && employee.employeeID === line["diya-gl:employeeID"]) ||
    employees.find((employee) => employee.name === line.detailComment);
  return Boolean(named?.isDirector);
}

function payrollPostings(book, line) {
  const gross = line["diya-gl:grossPay"] || line.amount;
  const incomeTax = line["diya-gl:incomeTax"] || 0;
  const employeeNI = line["diya-gl:employeeNI"] || 0;
  const employerNI = line["diya-gl:employerNI"] || 0;
  const postings = [];
  post(postings, isDirector(book, line) ? "directors-paye-wages" : "paye-wages", gross);
  post(postings, "employers-ni", employerNI);
  post(postings, PAYE, -(incomeTax + employeeNI + employerNI));
  post(postings, NET_WAGES, -(gross - incomeTax - employeeNI));
  return postings;
}

function openingPostings(line) {
  const account = String(line.accountMainID);
  const side = line.debitCreditCode;
  if (side !== "D" && side !== "C") throw new Error(`${lineName(line)} is an opening journal line with neither D nor C`);
  if (OPENING_FIXED_ASSET_CLASSES[account]) {
    return side === "D"
      ? [{ account, debit: line.amount, credit: 0 }]
      : [{ account: `${account}-depreciation`, debit: 0, credit: line.amount }];
  }
  if (!OPENING_BALANCE_LINES[account]) {
    throw new Error(`${lineName(line)} is an opening journal line on account ${account}, which has no opening balance sheet row`);
  }
  return [side === "D" ? { account, debit: line.amount, credit: 0 } : { account, debit: 0, credit: line.amount }];
}

/**
 * Why a line posts nothing to the trial balance, or undefined when it posts.
 * @param {Object} book
 * @param {Object} line
 * @returns {string|undefined}
 */
export function reasonApart(book, line) {
  if (isStraddlingLine(line)) return "A VAT-straddling line: its return sits outside the year";
  if (line.sourceJournalID === "journal" && !isOpeningBalanceLine(line)) return "An in-year journal line: no calculator row reads it";
  if (isLtdBookOpeningBankLine(book, line)) return "The bank account's opening balance: the opening journal carries it";
  return undefined;
}

/**
 * The balanced postings one line stands for. A line listed apart (see
 * reasonApart) posts nothing.
 * @param {Object} book - a Company book
 * @param {Object} line
 * @returns {Array<{account: string, debit: number, credit: number}>}
 */
export function postingsOf(book, line) {
  assertCompany(book);
  if (reasonApart(book, line)) return [];
  switch (line.sourceJournalID) {
    case "sales":
      return salePostings(book, line);
    case "purchases":
      return purchasePostings(book, line);
    case "bank":
      return bankPostings(line);
    case "payroll":
      return payrollPostings(book, line);
    case "journal":
      return openingPostings(line);
    default:
      throw new Error(`${lineName(line)} is on journal "${line.sourceJournalID}", which the posting rules do not know`);
  }
}

/**
 * The postings the calculator takes from the book's registers at the year
 * end, each naming its register: fixed asset additions, depreciation and
 * disposals from the asset schedule, the stock movement from the stock
 * count, hire purchase finance from the agreements, the dividend the board
 * declared, the corporation tax charge and the gross-up of interest received
 * from the tax computation. The close (TrialBalance rows 43 and 49) is not
 * among them: the trial balance stands before it.
 * @param {Object} book - a Company book
 * @param {Array} lines
 * @param {Object} taxData - extractTaxDataFromBook(book, "ltd") or the equivalent
 * @returns {Array<{register: string, description: string, date: string, postings: Array}>}
 */
export function yearEndPostings(book, lines, taxData) {
  assertCompany(book);
  const scenario = diyaGlToScenario(book, lines, "ltd");
  const { trialBalance, workings } = calculateLtdTrialBalance(book, lines, taxData, scenario);
  const { blocks, stock, hp, dividendDeclared, corporationTaxCharge } = workings;
  const date = isoDay(book.documentInfo?.periodCoveredEnd);
  const entries = [];
  const entry = (register, description, signedByAccount) => {
    const postings = [];
    for (const [account, signed] of signedByAccount) post(postings, account, signed);
    if (postings.length > 0) entries.push({ register, description, date, postings });
  };

  const classes = Object.entries(SCHEDULE_CLASS_ACCOUNTS);
  // TrialBalance EH6:EH10 and EH16: the cost of the assets bought in the year
  // moves from the purchases account to each class's cost.
  entry("fixedAssets", "Fixed assets bought in the year, to cost", [
    ...classes.map(([className, account]) => [account, blocks[className].newAssets.E]),
    [FIXED_ASSET_PURCHASES, -blocks.allNew.E],
  ]);
  // M87 and EH11:EH15 (the year's charge on Schedule column I).
  entry("fixedAssets", "Depreciation for the year", [
    ["depreciation", blocks.whole.I],
    ...classes.map(([className, account]) => [`${account}-depreciation`, -(blocks[className].existing.I + blocks[className].newAssets.I)]),
  ]);
  // EH6:EH17 and M86: a disposal takes out its cost (W) and its accumulated
  // depreciation (X) and sets the proceeds (V) against the sale account;
  // what is left is the loss on disposal.
  entry("fixedAssets", "Fixed assets disposed of", [
    [FIXED_ASSET_SALES, blocks.whole.V],
    ...classes.map(([className, account]) => [`${account}-depreciation`, blocks[className].existing.X + blocks[className].newAssets.X]),
    ["loss-on-disposal", blocks.whole.W - blocks.whole.X - blocks.whole.V],
    ...classes.map(([className, account]) => [account, -(blocks[className].existing.W + blocks[className].newAssets.W)]),
  ]);
  // M19 and M60: the stock sheet's movement for the year, count included.
  const stockMovement = stock.movements.reduce((total, value) => total + value, 0);
  entry("stock", "Stock movement for the year", [
    [STOCK, stockMovement],
    ["stock-movement", -stockMovement],
  ]);
  // EH28 and EH40: the amount financed moves from trade creditors to long-term finance.
  entry("hpAgreements", "Hire purchase finance", [
    [TRADE_CREDITORS, hp.longTermCreditor],
    [LONG_TERM_CREDITORS, -hp.longTermCreditor],
  ]);
  // EH31 and EH48: the dividend the board minuted.
  entry("dividends", "Dividends declared", [
    ["dividends-declared", dividendDeclared],
    [DIVIDENDS_CREDITOR, -dividendDeclared],
  ]);
  // EH58 and EH35: interest received arrives net of tax deducted at source;
  // the computation charges the gross and gives the tax back against the charge.
  entry("tax.corporationTax", "Tax deducted from interest received", [
    ["interest-received", trialBalance.EH58],
    [CORPORATION_TAX, trialBalance.EH35],
  ]);
  // EJ47 and EJ35: the corporation tax charge for the year.
  entry("tax.corporationTax", "Corporation tax charge", [
    ["corporation-tax-charge", corporationTaxCharge],
    [CORPORATION_TAX, -corporationTaxCharge],
  ]);
  return entries;
}

/** The account names a trial balance prints: the book's chart, then the accounts the posting rules add. */
export function postingAccountNames(book) {
  const names = { ...POSTING_ACCOUNTS };
  for (const accounts of Object.values(book?.accounts || {})) {
    for (const [id, account] of Object.entries(accounts || {})) names[id] = account?.accountMainDescription ?? names[id];
  }
  return names;
}
