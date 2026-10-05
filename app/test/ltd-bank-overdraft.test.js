// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// An overdrawn bank account on a Limited Company book: the published balance
// sheet moves it out of cash at bank and into the creditors as a bank
// overdraft, the way the template's own PubBalSht!E19 does, keeps cash and
// the intra transfers row in cash at bank, and the balance sheet still
// balances.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData, diyaGlToScenario, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { addBankLine } from "../lib/diya-gl-edits.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { createMethods } from "../lib/mcp/server.js";
import { createSession, loadIntoSession } from "../lib/mcp/diya-gl-tools.js";
import * as ltd from "../products/ltd.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "brickwork-pro", "ltd-nonvat"));
const PAYMENT = 100000;
const OVERDRAFT_CHECK = "Published balance sheet: bank overdraft = overdrawn Trial Balance statement accounts";
const CASH_AT_BANK_CHECK = "Published balance sheet: cash at bank = Trial Balance bank account aggregate";
const BALANCE_CHECK = "Published balance sheet: net assets (F33) = shareholders' funds (F39)";

// The book's year-end sweep to the savings account, entered on the current
// account only: it overdraws the current account and leaves its amount on the
// trial balance's intra transfers row.
const sweep = lines.find((line) => line.documentReference === "BNK-BS-001");
const unswept = lines.filter((line) => line !== sweep);

function resultsOf(bookLines) {
  return calculateFromDiyaGl(book, bookLines, "ltd", extractTaxDataFromBook(book, "ltd"), diyaGlToScenario(book, bookLines, "ltd"));
}

function checksOf(results, bookLines) {
  const scenario = diyaGlToScenario(book, bookLines, "ltd");
  const yearEnd = new Date(book.documentInfo.periodCoveredEnd).toISOString().slice(0, 10);
  return ltd.checkCompliance(
    { ...results },
    { ...scenario, ...scenario.expected },
    extractTaxDataFromBook(book, "ltd"),
    calculateExpectedTax,
    yearEnd,
  );
}

const payment = lines.find(
  (line) => line.sourceJournalID === "bank" && line.debitCreditCode === "C" && line["diya-gl:bankAccountID"] === "1200",
);
const overdrawn = addBankLine(book, unswept, { line: { ...payment, entryNumber: "OVERDRAFT-1", amount: PAYMENT } });
const before = resultsOf(unswept);
const after = resultsOf(overdrawn);
const statementAccounts = (tb) => tb.EJ22 + tb.EJ23 + tb.EJ24;

describe("an overdrawn current account on the Limited Company published balance sheet", () => {
  it("starts in credit, with no overdraft line", () => {
    expect(statementAccounts(before.TrialBalance)).toBeGreaterThan(0);
    expect(statementAccounts(before.TrialBalance)).toBeLessThan(PAYMENT);
    expect(before.PubBalSht.E19).toBe(0);
  });

  it("moves the overdrawn balance out of cash and into the creditors as a bank overdraft", () => {
    const overdraft = PAYMENT - statementAccounts(before.TrialBalance);
    expect(statementAccounts(after.TrialBalance)).toBeCloseTo(-overdraft, 6);
    expect(after.PubBalSht.E12).toBe(after.TrialBalance.EJ25);
    expect(after.PubBalSht.E19).toBeCloseTo(overdraft, 6);
    expect(after.PubBalSht.E20).toBeCloseTo(after.PubBalSht.E16 + after.PubBalSht.E17 + after.PubBalSht.E18 + overdraft, 6);
  });

  it("still balances: net assets equal shareholders' funds", () => {
    expect(after.PubBalSht.F33).toBeCloseTo(after.PubBalSht.F39, 6);
    expect(before.PubBalSht.F33).toBeCloseTo(before.PubBalSht.F39, 6);
  });

  it("passes its own overdraft check, and fails it and the balance when the overdraft line is dropped", () => {
    expect(checksOf(after, overdrawn).find((check) => check.name === OVERDRAFT_CHECK).pass).toBe(true);
    const dropped = { ...after, PubBalSht: { ...after.PubBalSht, E19: 0 } };
    dropped.PubBalSht.E20 = dropped.PubBalSht.E16 + dropped.PubBalSht.E17 + dropped.PubBalSht.E18;
    dropped.PubBalSht.F22 = dropped.PubBalSht.E13 - dropped.PubBalSht.E20;
    dropped.PubBalSht.F26 = dropped.PubBalSht.F6 + dropped.PubBalSht.F22;
    dropped.PubBalSht.F33 = dropped.PubBalSht.F26 - dropped.PubBalSht.F31;
    expect(checksOf(dropped, overdrawn).find((check) => check.name === OVERDRAFT_CHECK).pass).toBe(false);
    expect(dropped.PubBalSht.F33).not.toBeCloseTo(dropped.PubBalSht.F39, 2);
  });

  it("reaches the report through edit_lines as a bank overdraft row carrying the overdrawn account's lines", async () => {
    const session = createSession();
    loadIntoSession(session, book, unswept);
    const response = await createMethods(session)["tools/call"]({
      name: "edit_lines",
      arguments: { edits: [{ edit: "addBankLine", params: { line: { ...payment, entryNumber: "OVERDRAFT-1", amount: PAYMENT } } }] },
    });
    const moved = new Map(response.structuredContent.movedFigures.map((figure) => [figure.key, figure]));
    expect(Number(moved.get("section/published-balance-sheet/bank-overdraft").after)).toBeCloseTo(after.PubBalSht.E19, 2);
    const report = await createMethods(session)["tools/call"]({
      name: "report",
      arguments: { entryNumbers: ["section/published-balance-sheet/bank-overdraft"] },
    });
    const row = report.structuredContent.report.values.find((entry) => entry.key === "section/published-balance-sheet/bank-overdraft");
    expect(row.entryNumbers).toContain("OVERDRAFT-1");
  });
});

// The published balance sheet recomputed downstream of E12, the way the sheet
// totals it.
function withCashAtBank(sheet, cashAtBank) {
  const moved = { ...sheet, E12: cashAtBank };
  moved.E13 = moved.E10 + moved.E11 + moved.E12;
  moved.F22 = moved.E13 - moved.E20;
  moved.F26 = moved.F6 + moved.F22;
  moved.F33 = moved.F26 - moved.F31;
  return moved;
}

describe("an overdrawn current account with a one-legged transfer to savings on the Limited Company published balance sheet", () => {
  const swept = resultsOf(lines);
  const tb = swept.TrialBalance;
  const creditBalance = statementAccounts(before.TrialBalance);

  it("is the book's own year-end sweep: more than the current account holds, entered on the current account only", () => {
    expect(sweep["diya-gl:bankCode"]).toBe("BS");
    expect(sweep["diya-gl:bankAccountID"]).toBe("1200");
    expect(sweep.amount).toBeGreaterThan(creditBalance);
    expect(lines.some((line) => line !== sweep && line["diya-gl:bankAccountID"] === "1210")).toBe(false);
  });

  it("overdraws the current account and leaves the swept amount on the intra transfers row", () => {
    expect(statementAccounts(tb)).toBeCloseTo(creditBalance - sweep.amount, 6);
    expect(tb.EJ26).toBeCloseTo(sweep.amount, 6);
    expect(tb.EJ91).toBeCloseTo(0, 6);
  });

  it("keeps the swept amount in cash at bank and the overdraft among the creditors", () => {
    expect(swept.PubBalSht.E12).toBeCloseTo(tb.EJ25 + sweep.amount, 6);
    expect(swept.PubBalSht.E19).toBeCloseTo(sweep.amount - creditBalance, 6);
  });

  it("balances, at the same net assets as the book without the sweep", () => {
    expect(swept.PubBalSht.F33).toBeCloseTo(swept.PubBalSht.F39, 6);
    expect(swept.PubBalSht.F33).toBeCloseTo(before.PubBalSht.F33, 6);
  });

  it("passes the cash at bank, overdraft and balance checks", () => {
    const checks = checksOf(swept, lines);
    for (const name of [CASH_AT_BANK_CHECK, OVERDRAFT_CHECK, BALANCE_CHECK]) {
      expect(checks.find((check) => check.name === name).pass, name).toBe(true);
    }
  });

  it("fails the cash at bank and balance checks when cash at bank drops the intra transfers row", () => {
    const dropped = { ...swept, PubBalSht: withCashAtBank(swept.PubBalSht, tb.EJ25) };
    expect(dropped.PubBalSht.F33 - dropped.PubBalSht.F39).toBeCloseTo(-sweep.amount, 6);
    const failing = checksOf(dropped, lines)
      .filter((check) => !check.pass && check.severity !== "warning")
      .map((check) => check.name);
    expect(failing).toEqual(expect.arrayContaining([CASH_AT_BANK_CHECK, BALANCE_CHECK]));
    expect(failing).not.toContain(OVERDRAFT_CHECK);
  });
});
