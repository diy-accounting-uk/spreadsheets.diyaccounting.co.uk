// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// posting-rules.test.js — the trial balance summed from the posting rules
// ties, account by account, to the calculator's own trial balance rows for
// the Company examples; one bank code moves exactly the two accounts it
// names; a line the rules do not know throws, naming the line.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData, diyaGlToScenario, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { calculateLtdTrialBalance } from "../lib/calculators/ltd.js";
import { postingsOf, yearEndPostings } from "../lib/posting-rules.js";
import { trialBalance } from "../lib/book-queries.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Each account against the calculator's TrialBalance row it feeds. Several
// accounts can feed one row. Retained earnings (3100) feeds rows 43 and 49
// together, because the trial balance stands before the close.
const RETAINED_EARNINGS = "3100";
const CLOSE_ROWS = [43, 49];
const ROW_OF_ACCOUNT = {
  "0000": 6,
  "0010": 7,
  "0020": 8,
  "0030": 9,
  "0040": 10,
  "0000-depreciation": 11,
  "0010-depreciation": 12,
  "0020-depreciation": 13,
  "0030-depreciation": 14,
  "0040-depreciation": 15,
  "5900": 16,
  "4006": 17,
  "1100": 19,
  "1300": 20,
  "1200": 22,
  "1210": 23,
  "1230": 24,
  "1220": 25,
  "bank-transfers": 26,
  "2100": 28,
  "2150": 29,
  "2160": 30,
  "3200": 31,
  "2410": 32,
  "2200": 33,
  "2400": 34,
  "2300": 35,
  "1400": 37,
  "2500": 39,
  "2600": 40,
  "3000": 42,
  "3300": 44,
  "corporation-tax-charge": 47,
  "dividends-declared": 48,
  "4000": 53,
  "4001": 54,
  "4002": 55,
  "4003": 56,
  "4004": 57,
  "interest-received": 58,
  "5000": 60,
  "stock-movement": 60,
  "5001": 61,
  "5002": 62,
  "paye-wages": 64,
  "5101": 65,
  "5100": 66,
  "directors-paye-wages": 66,
  "employers-ni": 67,
  "5200": 68,
  "5201": 69,
  "5300": 70,
  "5301": 71,
  "5400": 72,
  "5401": 73,
  "5500": 74,
  "5501": 75,
  "5600": 76,
  "5601": 77,
  "5700": 78,
  "5701": 79,
  "5800": 80,
  "5803": 80,
  "4005": 81,
  "bank-interest-paid": 82,
  "bank-charges": 83,
  "5801": 84,
  "5802": 85,
  "loss-on-disposal": 86,
  "depreciation": 87,
  "bank-contra-received": 88,
  "bank-contra-paid": 89,
  "5502": 90,
};

const pence = (pounds) => Math.round(pounds * 100);
// Two figures agree to the penny when they part by less than half of one.
const toThePenny = (a, b) => Math.abs(a - b) < 0.005;
const balanceOf = (row) => row.debit - row.credit;

function example(name) {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", name));
  const taxData = extractTaxDataFromBook(book, "ltd");
  const { trialBalance: rows } = calculateLtdTrialBalance(book, lines, taxData, diyaGlToScenario(book, lines, "ltd"));
  return { book, lines, taxData, rows };
}

// Each calculator row against the sum of the closing balances of the accounts that feed it.
function tie({ book, lines, taxData, rows }) {
  const balances = trialBalance(book, lines, { yearEndPostings: yearEndPostings(book, lines, taxData) }).accounts;
  const unmapped = balances.filter((row) => row.account !== RETAINED_EARNINGS && ROW_OF_ACCOUNT[row.account] === undefined);
  const byRow = new Map();
  for (const row of balances) {
    if (row.account === RETAINED_EARNINGS) continue;
    const target = ROW_OF_ACCOUNT[row.account];
    if (target !== undefined) byRow.set(target, (byRow.get(target) ?? 0) + balanceOf(row));
  }
  const tiedRows = new Set([...Object.values(ROW_OF_ACCOUNT), ...CLOSE_ROWS]);
  const calculatorRows = Object.keys(rows)
    .filter((cell) => /^EJ\d+$/.test(cell) && cell !== "EJ91")
    .map((cell) => Number(cell.slice(2)));
  const differences = [];
  for (const row of new Set(Object.values(ROW_OF_ACCOUNT))) {
    const fromLines = byRow.get(row) ?? 0;
    const calculator = rows[`EJ${row}`] ?? 0;
    if (!toThePenny(fromLines, calculator)) differences.push({ row, fromLines, calculator });
  }
  const retained = balances.find((row) => row.account === RETAINED_EARNINGS);
  const closeRows = CLOSE_ROWS.reduce((total, row) => total + (rows[`EJ${row}`] ?? 0), 0);
  if (!toThePenny(retained ? balanceOf(retained) : 0, closeRows)) {
    differences.push({ row: "43+49", fromLines: retained ? balanceOf(retained) : 0, calculator: closeRows });
  }
  const nonNilRows = [...new Set(Object.values(ROW_OF_ACCOUNT))].filter((row) => pence(rows[`EJ${row}`] ?? 0) !== 0).length;
  return { unmapped, untied: calculatorRows.filter((row) => !tiedRows.has(row)), differences, nonNilRows };
}

describe("the trial balance from the posting rules ties to the calculator's trial balance", () => {
  for (const name of ["precision-code-ltd", "brickwork-pro"]) {
    it(`ties every row of ${name} to the penny, rows 43 and 49 together to retained earnings`, () => {
      const outcome = tie(example(name));
      expect(outcome.unmapped).toEqual([]);
      expect(outcome.untied).toEqual([]);
      expect(outcome.differences).toEqual([]);
      expect(outcome.nonNilRows).toBeGreaterThan(15);
    });
  }

  it("holds debits equal to credits for the year with the year-end postings", () => {
    const { book, lines, taxData } = example("precision-code-ltd");
    const { totals } = trialBalance(book, lines, { yearEndPostings: yearEndPostings(book, lines, taxData) });
    expect(toThePenny(totals.debit, totals.credit)).toBe(true);
    expect(totals.debit).toBeGreaterThan(0);
  });
});

describe("a bank code names the two accounts its line moves", () => {
  it("moves exactly the old code's account and the new code's account when one supplier payment is recoded to VAT", () => {
    const { book, lines } = example("precision-code-ltd");
    const payment = lines.find(
      (line) => line.sourceJournalID === "bank" && line["diya-gl:bankCode"] === "CR" && line.debitCreditCode === "C",
    );
    const recoded = lines.map((line) => (line === payment ? { ...line, "diya-gl:bankCode": "RV" } : line));
    const before = new Map(trialBalance(book, lines).accounts.map((row) => [row.account, balanceOf(row)]));
    const after = new Map(trialBalance(book, recoded).accounts.map((row) => [row.account, balanceOf(row)]));
    const moved = {};
    for (const account of new Set([...before.keys(), ...after.keys()])) {
      const change = pence(after.get(account) ?? 0) - pence(before.get(account) ?? 0);
      if (change !== 0) moved[account] = change;
    }
    expect(moved).toEqual({ 2100: -pence(payment.amount), 2200: pence(payment.amount) });
  });
});

describe("postingsOf", () => {
  const { book, lines } = example("precision-code-ltd");

  it("throws, naming the line, on a journal the rules do not know", () => {
    const line = { ...lines.find((entry) => entry.sourceJournalID === "sales"), sourceJournalID: "receipts", entryNumber: "ODD-1" };
    expect(() => postingsOf(book, line)).toThrow(/ODD-1/);
  });

  it("throws, naming the line, on a sale to an account no Sales column takes", () => {
    const line = { ...lines.find((entry) => entry.sourceJournalID === "sales"), accountMainID: "4999", entryNumber: "ODD-2" };
    expect(() => postingsOf(book, line)).toThrow(/ODD-2/);
  });

  it("throws, naming the line, on a bank code the workbook has no column for on its side", () => {
    const line = { ...lines.find((entry) => entry.sourceJournalID === "bank" && entry.debitCreditCode === "C"), "diya-gl:bankCode": "K" };
    expect(() => postingsOf(book, line)).toThrow(new RegExp(line.entryNumber));
  });

  it("lists an in-year journal apart and leaves it out of the totals", () => {
    const inYear = lines.filter((line) => line.sourceJournalID === "journal" && !String(line.documentReference).startsWith("OB-"));
    expect(inYear.length).toBeGreaterThan(0);
    const { apart, accounts } = trialBalance(book, lines);
    for (const line of inYear) expect(apart.map((entry) => entry.entryNumber)).toContain(line.entryNumber);
    const withoutThem = trialBalance(
      book,
      lines.filter((line) => !inYear.includes(line)),
    ).accounts;
    expect(accounts).toEqual(withoutThem);
  });

  it("splits a sale into debtors, income and VAT that balance", () => {
    const sale = lines.find(
      (line) => line.sourceJournalID === "sales" && line.documentType !== "credit-note" && !line["diya-gl:cisDeduction"],
    );
    const postings = postingsOf(book, sale);
    expect(postings.map((posting) => posting.account).sort()).toEqual(["1300", "2200", String(sale.accountMainID)].sort());
    const debit = postings.reduce((total, posting) => total + posting.debit, 0);
    const credit = postings.reduce((total, posting) => total + posting.credit, 0);
    expect(pence(debit)).toBe(pence(sale.amount));
    expect(pence(credit)).toBe(pence(sale.amount));
  });

  it("sums a month on its own, dropping lines dated outside it", () => {
    const month = trialBalance(book, lines, { from: "2025-06-01", to: "2025-06-30" });
    const june = lines.filter((line) => String(line.postingDate).startsWith("2025-06"));
    expect(trialBalance(book, june).accounts).toEqual(month.accounts);
    expect(toThePenny(month.totals.debit, month.totals.credit)).toBe(true);
  });
});
