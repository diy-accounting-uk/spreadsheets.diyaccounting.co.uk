// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// An overdrawn bank account on a Limited Company book: the published balance
// sheet moves it out of cash at bank and into the creditors as a bank
// overdraft, the way the template's own PubBalSht!E19 does, and the balance
// sheet still balances.

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
const overdrawn = addBankLine(book, lines, { line: { ...payment, entryNumber: "OVERDRAFT-1", amount: PAYMENT } });
const before = resultsOf(lines);
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
    loadIntoSession(session, book, lines);
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
