// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-edits-payroll.test.js — addPayrollLine, proved against the SE
// Precision Code advanced book: every guard throws on its own bad field, a
// good line lands with lines.length up by one, and the net-and-amount
// derivation it shares with changePayrollLine (diya-gl-edits-ltd.js) reads
// off the fixture's own employee and wage account.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { addPayrollLine } from "../lib/diya-gl-edits.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "advanced"));

function payslip(overrides = {}) {
  return {
    "entryNumber": "TEST-PAYROLL-1",
    "sourceJournalID": "payroll",
    "postingDate": "2025-05-31",
    "accountMainID": "5101",
    "documentType": "payslip",
    "documentReference": "PAY-EMP001-2025-05",
    "detailComment": "Alice Johnson",
    "lineItemComment": "Salary May 2025",
    "taxCode": "OS",
    "taxRate": 0,
    "diya-gl:employeeID": "EMP001",
    "diya-gl:grossPay": 2000,
    "diya-gl:incomeTax": 300,
    "diya-gl:employeeNI": 100,
    "diya-gl:employerNI": 138,
    ...overrides,
  };
}

describe("addPayrollLine", () => {
  it("adds a line, deriving net pay and amount from gross, income tax and employee NI", () => {
    const added = addPayrollLine(book, lines, { line: payslip() });
    expect(added.length).toBe(lines.length + 1);
    const line = added.find((entry) => entry.entryNumber === "TEST-PAYROLL-1");
    expect(line["diya-gl:netPay"]).toBe(1600);
    expect(line.amount).toBe(2000);
  });

  it("leaves the caller's lines array alone", () => {
    const before = lines.length;
    addPayrollLine(book, lines, { line: payslip() });
    expect(lines.length).toBe(before);
  });

  it("refuses a line posted to another journal", () => {
    expect(() => addPayrollLine(book, lines, { line: payslip({ sourceJournalID: "purchases" }) })).toThrow(
      `addPayrollLine expects a line with sourceJournalID "payroll", got "purchases"`,
    );
  });

  it("refuses an employee the book does not declare", () => {
    expect(() => addPayrollLine(book, lines, { line: payslip({ "diya-gl:employeeID": "EMP999" }) })).toThrow(
      `addPayrollLine expects a diya-gl:employeeID declared in the book's own employees, got "EMP999"`,
    );
  });

  it("refuses a non-numeric gross", () => {
    expect(() => addPayrollLine(book, lines, { line: payslip({ "diya-gl:grossPay": "2000" }) })).toThrow(
      `addPayrollLine expects diya-gl:grossPay to be a number, got "2000"`,
    );
  });

  it("refuses an account the book's chart does not declare", () => {
    expect(() => addPayrollLine(book, lines, { line: payslip({ accountMainID: "9999" }) })).toThrow(
      `addPayrollLine expects an accountMainID declared in the book's own chart, got "9999"`,
    );
  });
});
