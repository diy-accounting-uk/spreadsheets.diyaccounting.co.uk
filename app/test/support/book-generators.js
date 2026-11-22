// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// book-generators.js — fast-check arbitraries for Company books. A plan is
// plain data that fast-check can shrink; buildBooksFromPlan runs it through the
// engine's own writers (buildNewBook, the named edits, rollForward and
// buildIxbrlSummaryBooks) and returns every book the writers produced along the
// way, so no test ever builds a book object by hand. Amounts are whole pence.

import fc from "fast-check";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { readIxbrl } from "../../lib/ixbrl-reader.js";
import { mapIxbrlAccounts } from "../../lib/ixbrl-accounts.js";
import { buildNewBook } from "../../lib/diya-gl-new-book.js";
import {
  addSaleLine,
  addPurchaseLine,
  addBankLine,
  changeLineAmount,
  removeLine,
  changeLinePostingDate,
  changeLineAccount,
  changeLineBankAccount,
  changeLineDetail,
  setLineReference,
} from "../../lib/diya-gl-edits.js";
import { setDividend, setMembers, setCharges } from "../../lib/diya-gl-edits-ltd.js";
import { rollForward } from "../../lib/diya-gl-roll-forward.js";
import { buildIxbrlSummaryBooks } from "../../lib/ixbrl-summary-book.js";
import { isLtdBookOpeningBankLine } from "../../lib/ltd-layout.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The engine's writers, passed to buildBooksFromPlan so that a test can swap one for a faulty copy. */
export const ENGINE_WRITERS = {
  buildNewBook,
  addSaleLine,
  addPurchaseLine,
  addBankLine,
  changeLineAmount,
  removeLine,
  changeLinePostingDate,
  changeLineAccount,
  changeLineBankAccount,
  changeLineDetail,
  setLineReference,
  setDividend,
  setMembers,
  setCharges,
  rollForward,
  buildIxbrlSummaryBooks,
};

const rateDataCache = new Map();
function rateDataFor(yearEnd) {
  const [year, month] = yearEnd.split("-").map(Number);
  const name = `ltd-${month >= 4 ? year : year - 1}`;
  if (!rateDataCache.has(name)) rateDataCache.set(name, parseTOML(readFileSync(resolve(APP_DIR, "data", `${name}.toml`), "utf8")));
  return rateDataCache.get(name);
}

// An edit the plan asks for that the writers refuse: it must throw, starting with this message.
function expectRefusal(edit, message) {
  try {
    edit();
  } catch (error) {
    if (String(error.message).startsWith(message)) return;
    throw error;
  }
  throw new Error(`Expected the edit to refuse: ${message}`);
}

const isoDay = (value) => (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);

function addDays(day, count) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

const penceAmount = fc.integer({ min: 1, max: 2_000_000 }).map((pence) => pence / 100);
const dayInYear = fc.integer({ min: 0, max: 359 });
const pick = (items, index) => items[index % items.length];

// Bank codes both the current and cash account workbooks analyse in the block they land in.
const RECEIPT_CODES = ["DR", "K", "LDR", "LCR", "DL"];
const PAYMENT_CODES = ["CR", "W", "B", "J", "LDR", "LCR", "RP", "RV", "RC", "RT", "DV", "DL"];
const BANK_ACCOUNTS = ["1200", "1210", "1220", "1230"];

const index = fc.nat({ max: 99 });
const text = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,15}$/);

const ACTION_ARBITRARIES = [
  fc.record({ kind: fc.constant("sale"), account: index, amount: penceAmount, day: dayInYear, taxed: fc.boolean(), who: text }),
  fc.record({ kind: fc.constant("purchase"), account: index, amount: penceAmount, day: dayInYear, taxed: fc.boolean(), who: text }),
  fc.record({
    kind: fc.constant("bank"),
    account: index,
    receipt: fc.boolean(),
    code: index,
    amount: penceAmount,
    day: dayInYear,
    who: text,
  }),
  fc.record({ kind: fc.constant("changeAmount"), target: index, amount: penceAmount }),
  fc.record({ kind: fc.constant("remove"), target: index }),
  fc.record({ kind: fc.constant("changeDate"), target: index, day: dayInYear }),
  fc.record({ kind: fc.constant("changeAccount"), target: index, account: index }),
  fc.record({ kind: fc.constant("changeBankAccount"), target: index, account: index }),
  fc.record({ kind: fc.constant("changeDetail"), target: index, detail: text }),
  fc.record({ kind: fc.constant("setReference"), target: index, reference: text }),
  fc.record({ kind: fc.constant("dividend"), amount: fc.integer({ min: 0, max: 1_000_000 }).map((pence) => pence / 100), day: dayInYear }),
  fc.record({
    kind: fc.constant("members"),
    shares: fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 3 }),
  }),
  fc.record({ kind: fc.constant("charges"), valuation: penceAmount }),
];

const YEAR_ENDS = ["2022-03-31", "2023-03-31", "2022-12-31", "2023-12-31", "2022-09-30"];

const statementsPlan = fc.record({
  kind: fc.constant("statements"),
  yearEnd: fc.constantFrom(...YEAR_ENDS),
  vatRegistered: fc.boolean(),
  stages: fc.array(
    fc.record({
      actions: fc.array(fc.oneof(...ACTION_ARBITRARIES), { maxLength: 8 }),
      rollAfter: fc.boolean(),
    }),
    { minLength: 1, maxLength: 3 },
  ),
});

// Accounts as the iXBRL reader maps them, with the figures replaced by whole pence of a year that balances.
const ixbrlFigures = fc
  .record({
    turnover: fc.integer({ min: 0, max: 50_000_000 }),
    otherIncome: fc.integer({ min: 0, max: 500_000 }),
    expenses: fc.integer({ min: 0, max: 40_000_000 }),
    priorCash: fc.integer({ min: 0, max: 20_000_000 }),
    priorOwed: fc.integer({ min: 0, max: 15_000_000 }),
    currentCash: fc.integer({ min: 0, max: 20_000_000 }),
    currentOwed: fc.integer({ min: 0, max: 15_000_000 }),
  })
  .filter(({ priorCash, priorOwed, currentCash, currentOwed }) => priorCash >= priorOwed && currentCash >= currentOwed);

const ixbrlPlan = fc.record({ kind: fc.constant("ixbrl"), figures: ixbrlFigures });

/** An arbitrary plan for a Company book: a book and edits and roll forwards, or the books an iXBRL file stands for. */
export const companyBookPlans = fc.oneof({ weight: 4, arbitrary: statementsPlan }, { weight: 1, arbitrary: ixbrlPlan });

const pounds = (pence) => pence / 100;
const ixbrlSourceAccounts = () =>
  mapIxbrlAccounts(readIxbrl(readFileSync(resolve(APP_DIR, "test", "fixtures", "ixbrl", "diya-2025-accounts.xhtml"))));

function ixbrlAccountsOf({ figures }) {
  const accounts = structuredClone(ixbrlSourceAccounts());
  const sheet = (cash, owed) => ({
    fixedAssets: 0,
    prepaymentsAccruedIncome: 0,
    calledUpShareCapitalNotPaid: 0,
    currentAssets: pounds(cash),
    accrualsDeferredIncome: 0,
    creditorsWithinOneYear: pounds(owed),
    creditorsAfterOneYear: 0,
    provisionsForLiabilities: 0,
    netAssets: pounds(cash - owed),
    netCurrentAssets: pounds(cash - owed),
    totalAssetsLessCurrentLiabilities: pounds(cash - owed),
    capitalAndReserves: pounds(cash - owed),
  });
  accounts.balanceSheet.currentYear = sheet(figures.currentCash, figures.currentOwed);
  accounts.balanceSheet.priorYear = sheet(figures.priorCash, figures.priorOwed);
  const before = figures.turnover + figures.otherIncome - figures.expenses;
  const tax = Math.max(0, Math.round(before * 0.19));
  accounts.profitAndLoss.currentYear = {
    ...accounts.profitAndLoss.currentYear,
    turnover: pounds(figures.turnover),
    otherOperatingIncome: pounds(figures.otherIncome),
    otherOperatingExpenses: pounds(figures.expenses),
    tax: pounds(tax),
    profit: pounds(before - tax),
  };
  return accounts;
}

function carryOut(plan, writers) {
  const books = [];
  const nextEntryNumber = (() => {
    let count = 0;
    return () => `TXN-${String(++count).padStart(4, "0")}`;
  })();
  let book = writers.buildNewBook(
    { product: "ltd", businessName: "Generated Books Ltd", yearEnd: plan.yearEnd, vatRegistered: plan.vatRegistered },
    rateDataFor(plan.yearEnd),
  );
  let lines = [];
  const snapshot = () => books.push({ book: structuredClone(book), lines: structuredClone(lines) });

  const tradeLine = (action, journal, accounts) => {
    const start = isoDay(book.documentInfo.periodCoveredStart);
    const taxed = plan.vatRegistered && action.taxed;
    return {
      entryNumber: nextEntryNumber(),
      sourceJournalID: journal,
      postingDate: addDays(start, action.day),
      accountMainID: pick(accounts, action.account),
      amount: action.amount,
      documentType: "invoice",
      documentReference: `${journal === "sales" ? "INV" : "PUR"}-${action.account}`,
      detailComment: action.who,
      taxCode: taxed ? "S" : "OS",
      taxRate: taxed ? 0.2 : 0,
    };
  };
  const editable = () => lines.filter((line) => line.sourceJournalID !== "journal");
  const target = (action) => {
    const candidates = editable();
    return candidates.length === 0 ? undefined : pick(candidates, action.target);
  };

  for (const stage of plan.stages) {
    for (const action of stage.actions) {
      const start = isoDay(book.documentInfo.periodCoveredStart);
      const hit = "target" in action ? target(action) : undefined;
      switch (action.kind) {
        case "sale":
          lines = writers.addSaleLine(book, lines, { line: tradeLine(action, "sales", Object.keys(book.accounts.sales)) });
          break;
        case "purchase":
          lines = writers.addPurchaseLine(book, lines, { line: tradeLine(action, "purchases", Object.keys(book.accounts.purchases)) });
          break;
        case "bank": {
          const bankAccount = pick(BANK_ACCOUNTS, action.account);
          lines = writers.addBankLine(book, lines, {
            line: {
              "entryNumber": nextEntryNumber(),
              "sourceJournalID": "bank",
              "postingDate": addDays(start, action.day),
              "accountMainID": bankAccount,
              "debitCreditCode": action.receipt ? "D" : "C",
              "amount": action.amount,
              "documentType": "bank-statement",
              "documentReference": `BNK-${action.account}`,
              "detailComment": action.who,
              "taxCode": "OS",
              "taxRate": 0,
              "diya-gl:bankCode": pick(action.receipt ? RECEIPT_CODES : PAYMENT_CODES, action.code),
              "diya-gl:bankAccountID": bankAccount,
            },
          });
          break;
        }
        case "changeAmount":
          if (hit) lines = writers.changeLineAmount(book, lines, { entryNumber: hit.entryNumber, newAmount: action.amount });
          break;
        case "remove":
          if (hit) lines = writers.removeLine(book, lines, { entryNumber: hit.entryNumber });
          break;
        case "changeDate":
          if (hit && isLtdBookOpeningBankLine(book, hit)) {
            // An opening balance stays on the first day of the year: the edit refuses, and the book is unchanged.
            expectRefusal(
              () =>
                writers.changeLinePostingDate(book, lines, { entryNumber: hit.entryNumber, newPostingDate: addDays(start, action.day) }),
              `changeLinePostingDate refuses ${hit.entryNumber}: it is an opening bank balance line`,
            );
          } else if (hit) {
            lines = writers.changeLinePostingDate(book, lines, {
              entryNumber: hit.entryNumber,
              newPostingDate: addDays(start, action.day),
            });
          }
          break;
        case "changeAccount":
          if (hit && hit.sourceJournalID !== "bank") {
            const section = hit.sourceJournalID === "sales" ? "sales" : "purchases";
            lines = writers.changeLineAccount(book, lines, {
              entryNumber: hit.entryNumber,
              newAccountMainID: pick(Object.keys(book.accounts[section]), action.account),
            });
          }
          break;
        case "changeBankAccount":
          if (hit && hit.sourceJournalID === "bank") {
            lines = writers.changeLineBankAccount(book, lines, {
              entryNumber: hit.entryNumber,
              newBankAccountID: pick(BANK_ACCOUNTS, action.account),
            });
          }
          break;
        case "changeDetail":
          if (hit) lines = writers.changeLineDetail(book, lines, { entryNumber: hit.entryNumber, detailComment: action.detail });
          break;
        case "setReference":
          if (hit) lines = writers.setLineReference(book, lines, { entryNumber: hit.entryNumber, documentReference: action.reference });
          break;
        case "dividend":
          book = writers.setDividend(book, lines, { boardMeetingDate: addDays(start, action.day), amount: action.amount });
          break;
        case "members":
          book = writers.setMembers(book, lines, {
            members: action.shares.map((shares, position) => ({ memberID: `M${position + 1}`, name: `Member ${position + 1}`, shares })),
          });
          break;
        case "charges":
          book = writers.setCharges(book, lines, { charges: [{ description: "Fixed charge", valuation: action.valuation }] });
          break;
        default:
          throw new Error(`Unknown action ${action.kind}`);
      }
    }
    snapshot();
    if (stage.rollAfter) {
      const end = isoDay(book.documentInfo.periodCoveredEnd);
      const rolled = writers.rollForward(book, lines, rateDataFor(addDays(end, 366)));
      book = rolled.book;
      lines = rolled.lines;
      snapshot();
    }
  }
  return books;
}

/**
 * Run a plan through the writers.
 * @param {Object} plan - one value of companyBookPlans
 * @param {Object} [writers] - the engine's writers; a test swaps one to show that a property can fail
 * @returns {Promise<Array<{book: Object, lines: Array}>>} every book the writers produced, in order
 */
export async function buildBooksFromPlan(plan, writers = ENGINE_WRITERS) {
  if (plan.kind === "ixbrl") {
    const summary = await writers.buildIxbrlSummaryBooks(ixbrlAccountsOf(plan));
    return [
      { book: summary.book, lines: summary.lines },
      { book: summary.comparative.book, lines: summary.comparative.lines },
    ];
  }
  return carryOut(plan, writers);
}
