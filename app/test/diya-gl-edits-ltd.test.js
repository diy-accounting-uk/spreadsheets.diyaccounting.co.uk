// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-edits-ltd.test.js — The Company edits, each read off R rather than
// off the edit's own return: apply one edit to the Precision Code full
// fixture in memory, run calculateFromDiyaGl and checkCompliance again, and
// compare the two report documents key by key. Every figure asserted here is
// anchored to the fixture's own payroll line or register entry, so a check
// that compares a derived figure to itself never stands in for one that can
// fail.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { buildReportDocument } from "../lib/report-serializer.js";
import { changePayrollLine, setDividend, setMembers, setCharges, LTD_LINE_EDITS, LTD_BOOK_EDITS } from "../lib/diya-gl-edits-ltd.js";
import * as ltd from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");

// The Precision Code full book, on the year and the rates calculator-ltd's
// own first fixture runs: the package is built for the March 2025 year end,
// so the book's dates shift back a year to meet it.
const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "full"), "-P1Y");
const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "ltd-2024.toml"), "utf8"));

// One run of the D -> R loop report.js's diya-gl mode performs. The scenario
// diyaGlToScenario derives is both the calculator's input and checkCompliance's
// expectation, so an edit's verdicts are re-derived from the edited data
// rather than from a stale figure.
function runReport(editedBook, editedLines) {
  const scenario = diyaGlToScenario(editedBook, editedLines, "ltd");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateFromDiyaGl(editedBook, editedLines, "ltd", taxData, scenario);
  const yearEnd = new Date(editedBook.documentInfo.periodCoveredEnd).toISOString().slice(0, 10);
  const checks = ltd.checkCompliance({ ...results }, merged, taxData, calculateExpectedTax, yearEnd);
  const document = buildReportDocument({
    packageName: "ltd",
    engine: "js",
    results,
    productMod: ltd,
    scenario: merged,
    checks,
    yearEnd,
  });
  return { results, checks, document };
}

// Every R key whose value changed between two reports, with the numeric
// delta where both sides parse as a number -- the same comparison the MCP
// edit_lines tool reports an edit's movement with.
function movedFigures(beforeDocument, afterDocument) {
  const before = new Map(beforeDocument.values.map((entry) => [entry.key, entry.value]));
  const after = new Map(afterDocument.values.map((entry) => [entry.key, entry.value]));
  const moved = new Map();
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const beforeValue = before.has(key) ? before.get(key) : null;
    const afterValue = after.has(key) ? after.get(key) : null;
    if (beforeValue === afterValue) continue;
    const beforeNumber = beforeValue === null ? null : Number(beforeValue);
    const afterNumber = afterValue === null ? null : Number(afterValue);
    const delta =
      beforeNumber !== null && afterNumber !== null && Number.isFinite(beforeNumber) && Number.isFinite(afterNumber)
        ? Number((afterNumber - beforeNumber).toFixed(6))
        : null;
    moved.set(key, { before: beforeValue, after: afterValue, delta });
  }
  return moved;
}

function deltaAt(moved, key) {
  const entry = moved.get(key);
  if (!entry) throw new Error(`nothing moved at ${key}`);
  return entry.delta;
}

function failingCheckNames(checks) {
  return checks.filter((check) => !check.pass).map((check) => check.name);
}

function movedKeysMatching(moved, pattern) {
  return [...moved.keys()].filter((key) => pattern.test(key)).sort();
}

const base = runReport(book, lines);

// TXN-0074 is Alice Johnson's April payslip: gross 3,500, income tax 530,
// employee NI 200, employer NI 382.50, net 2,770. It is the first employee
// row of the first month tab, so it lands on WagesInterface row 4 and on the
// PAYE schedule's row 4.
const PAYSLIP = {
  entryNumber: "TXN-0074",
  grossPay: 3500,
  incomeTax: 530,
  employeeNI: 200,
  employerNI: 382.5,
};
const RAISED = { grossPay: 4000, incomeTax: 630, employeeNI: 240, employerNI: 450 };

describe("baseline", () => {
  it("the Precision Code full book reconciles before any edit", () => {
    expect(failingCheckNames(base.checks)).toEqual([]);
  });

  it("names the four Company edits", () => {
    expect(Object.keys(LTD_LINE_EDITS)).toEqual(["changePayrollLine"]);
    expect(Object.keys(LTD_BOOK_EDITS)).toEqual(["setDividend", "setMembers", "setCharges"]);
  });
});

describe("changePayrollLine", () => {
  const edited = changePayrollLine(book, lines, { entryNumber: PAYSLIP.entryNumber, ...RAISED });
  const after = runReport(book, edited);
  const moved = movedFigures(base.document, after.document);
  const changedLine = edited.find((line) => line.entryNumber === PAYSLIP.entryNumber);

  it("recomputes net pay from the figures given and carries the gross as the line's amount", () => {
    expect(changedLine["diya-gl:grossPay"]).toBe(RAISED.grossPay);
    expect(changedLine["diya-gl:incomeTax"]).toBe(RAISED.incomeTax);
    expect(changedLine["diya-gl:employeeNI"]).toBe(RAISED.employeeNI);
    expect(changedLine["diya-gl:employerNI"]).toBe(RAISED.employerNI);
    expect(changedLine["diya-gl:netPay"]).toBe(RAISED.grossPay - RAISED.incomeTax - RAISED.employeeNI);
    expect(changedLine.amount).toBe(RAISED.grossPay);
  });

  it("keeps every figure the caller did not name", () => {
    const grossOnly = changePayrollLine(book, lines, { entryNumber: PAYSLIP.entryNumber, grossPay: 4000 });
    const line = grossOnly.find((entry) => entry.entryNumber === PAYSLIP.entryNumber);
    expect(line["diya-gl:incomeTax"]).toBe(PAYSLIP.incomeTax);
    expect(line["diya-gl:employeeNI"]).toBe(PAYSLIP.employeeNI);
    expect(line["diya-gl:employerNI"]).toBe(PAYSLIP.employerNI);
    expect(line["diya-gl:netPay"]).toBe(4000 - PAYSLIP.incomeTax - PAYSLIP.employeeNI);
  });

  it("moves the wages interface by each figure's own difference", () => {
    expect(deltaAt(moved, "cell/Financialaccounts.xlsx!WagesInterface!C4")).toBe(RAISED.grossPay - PAYSLIP.grossPay);
    expect(deltaAt(moved, "cell/Financialaccounts.xlsx!WagesInterface!D4")).toBe(RAISED.incomeTax - PAYSLIP.incomeTax);
    expect(deltaAt(moved, "cell/Financialaccounts.xlsx!WagesInterface!E4")).toBe(RAISED.employeeNI - PAYSLIP.employeeNI);
    expect(deltaAt(moved, "cell/Financialaccounts.xlsx!WagesInterface!H4")).toBe(RAISED.employerNI - PAYSLIP.employerNI);
  });

  it("moves the PAYE remittance schedule by the tax and the two National Insurance figures", () => {
    const nationalInsurance = RAISED.employeeNI - PAYSLIP.employeeNI + (RAISED.employerNI - PAYSLIP.employerNI);
    const incomeTax = RAISED.incomeTax - PAYSLIP.incomeTax;
    expect(deltaAt(moved, "cell/Payslips.xlsx!Payment!D4")).toBe(nationalInsurance);
    expect(deltaAt(moved, "cell/Payslips.xlsx!Payment!E4")).toBe(incomeTax);
    expect(deltaAt(moved, "cell/Payslips.xlsx!Payment!I4")).toBe(nationalInsurance + incomeTax);
  });

  it("moves the wages line and the employer NI line of the management P&L", () => {
    expect(deltaAt(moved, "cell/Financialaccounts.xlsx!MnthP&L!B18")).toBe(RAISED.grossPay - PAYSLIP.grossPay);
    expect(deltaAt(moved, "cell/Financialaccounts.xlsx!MnthP&L!B20")).toBe(RAISED.employerNI - PAYSLIP.employerNI);
  });

  it("reaches no sales, purchase or register figure", () => {
    expect(movedKeysMatching(moved, /Sales\.xlsx|Purchases\.xlsx|Companysecretary\.xlsx/)).toEqual([]);
  });

  it("leaves the trial balance out of balance, because the bank payment behind the payslip is untouched", () => {
    expect(failingCheckNames(after.checks)).toEqual(["Trial Balance: audit accuracy (EJ91)"]);
  });

  it("rewrites the line in place and leaves the caller's lines array alone", () => {
    expect(edited.length).toBe(lines.length);
    expect(edited.indexOf(changedLine)).toBe(lines.findIndex((line) => line.entryNumber === PAYSLIP.entryNumber));
    expect(lines.find((line) => line.entryNumber === PAYSLIP.entryNumber)["diya-gl:grossPay"]).toBe(PAYSLIP.grossPay);
  });

  it("moves the payslip to another employee and renames the line with them", () => {
    const reassigned = changePayrollLine(book, lines, { entryNumber: PAYSLIP.entryNumber, employeeID: "EMP002" });
    const line = reassigned.find((entry) => entry.entryNumber === PAYSLIP.entryNumber);
    expect(line["diya-gl:employeeID"]).toBe("EMP002");
    expect(line.detailComment).toBe("Bob Williams");
  });

  it("refuses an employee the book does not declare, naming them", () => {
    expect(() => changePayrollLine(book, lines, { entryNumber: PAYSLIP.entryNumber, employeeID: "EMP999" })).toThrow(
      'changePayrollLine expects an employee the book declares, got "EMP999"',
    );
  });

  it("refuses an entryNumber no line carries", () => {
    expect(() => changePayrollLine(book, lines, { entryNumber: "NO-SUCH-LINE", grossPay: 100 })).toThrow(
      "No line carries entryNumber NO-SUCH-LINE",
    );
  });

  it("refuses a negative figure, naming it", () => {
    expect(() => changePayrollLine(book, lines, { entryNumber: PAYSLIP.entryNumber, employeeNI: -1 })).toThrow(
      "changePayrollLine expects employeeNI to be nil or above, got -1",
    );
  });

  it("refuses a line posted to another journal", () => {
    expect(() => changePayrollLine(book, lines, { entryNumber: "TXN-0016", grossPay: 100 })).toThrow(
      'changePayrollLine expects a line with sourceJournalID "payroll", got "sales"',
    );
  });

  it("refuses deductions above the gross, which would leave net pay below nil", () => {
    expect(() => changePayrollLine(book, lines, { entryNumber: PAYSLIP.entryNumber, grossPay: 100 })).toThrow(
      "changePayrollLine would leave line TXN-0074 invalid",
    );
  });
});

describe("setDividend", () => {
  // The board declared 15,000; raising it to 20,000 is the whole edit.
  const raised = setDividend(book, lines, { boardMeetingDate: "2026-03-31", amount: 20000 });
  const after = runReport(raised, lines);
  const moved = movedFigures(base.document, after.document);

  it("moves the appropriation, both trial balance rows and the directors' report", () => {
    expect(deltaAt(moved, "cell/Financialaccounts.xlsx!PubP&L!F52")).toBe(5000);
    expect(deltaAt(moved, "cell/Financialaccounts.xlsx!TrialBalance!EJ48")).toBe(5000);
    // The creditor is the opening balance plus what the board declared less
    // what the bank paid, so a declaration nobody has paid yet owes more.
    expect(deltaAt(moved, "cell/Financialaccounts.xlsx!TrialBalance!EJ31")).toBe(-5000);
    expect(deltaAt(moved, "cell/Financialaccounts.xlsx!Report!D94")).toBe(5000);
  });

  it("reaches nothing on the management P&L, which never carries an appropriation", () => {
    expect(movedKeysMatching(moved, /MnthP&L/)).toEqual([]);
  });

  it("keeps every compliance check green", () => {
    expect(failingCheckNames(after.checks)).toEqual([]);
  });

  it("returns a new book and leaves the caller's book and lines alone", () => {
    expect(raised).not.toBe(book);
    expect(raised.dividends).toEqual([{ boardMeetingDate: "2026-03-31", amount: 20000 }]);
    expect(book.dividends[0].amount).toBe(15000);
    expect(setDividend(book, lines, { boardMeetingDate: "2026-03-31", amount: 20000 })).not.toBe(raised);
  });

  it("takes the declaration off the book when the amount is nil", () => {
    const cleared = setDividend(book, lines, { boardMeetingDate: "2026-03-31", amount: 0 });
    expect(cleared.dividends).toBeUndefined();
    const clearedReport = runReport(cleared, lines);
    const clearedMoved = movedFigures(base.document, clearedReport.document);
    expect(deltaAt(clearedMoved, "cell/Financialaccounts.xlsx!PubP&L!F52")).toBe(-15000);
    // With no declaration the minute carries no figure at all, so the cell
    // leaves R rather than reading nil.
    expect(clearedMoved.get("cell/Companysecretary.xlsx!Boardmeeting!E4")).toMatchObject({ before: "15000", after: null });
    expect(failingCheckNames(clearedReport.checks)).toEqual([]);
  });

  it("refuses a negative amount", () => {
    expect(() => setDividend(book, lines, { boardMeetingDate: "2026-03-31", amount: -1 })).toThrow(
      "setDividend expects an amount of nil or above, got -1",
    );
  });

  it("refuses a board meeting date that is not a date", () => {
    expect(() => setDividend(book, lines, { boardMeetingDate: "2026-02-30", amount: 100 })).toThrow(
      "setDividend would leave the book invalid",
    );
  });
});

describe("setMembers", () => {
  // Carol Smith's holding rises from 60 shares to 70, so the register issues
  // 110 where it issued 100.
  const issued = setMembers(book, lines, {
    members: [
      { memberID: "MEM-1", name: "Carol Smith", shares: 70, acquiredDate: "2020-01-01" },
      { memberID: "MEM-2", name: "David Brown", shares: 25, acquiredDate: "2021-06-15" },
      { memberID: "MEM-3", name: "Emma Wilson", shares: 15, acquiredDate: "2022-03-01" },
    ],
  });
  const after = runReport(issued, lines);
  const moved = movedFigures(base.document, after.document);

  it("moves the shares issued on the register and in the directors' report", () => {
    expect(deltaAt(moved, "cell/Companysecretary.xlsx!RegisterofMembers!G1")).toBe(10);
    expect(deltaAt(moved, "cell/Financialaccounts.xlsx!Report!I95")).toBe(10);
    expect(deltaAt(moved, "cell/Companysecretary.xlsx!RegisterofMembers!G3")).toBe(10);
  });

  it("parts the register from the share capital the balance sheet carries, which no share issue moves on its own", () => {
    expect(failingCheckNames(after.checks)).toEqual(["RegisterofMembers: nominal value x shares issued = PubBalSht share capital"]);
  });

  it("keeps the register and the balance sheet together when the holdings are only redistributed", () => {
    const redistributed = setMembers(book, lines, {
      members: [
        { memberID: "MEM-1", name: "Carol Smith", shares: 50, acquiredDate: "2020-01-01" },
        { memberID: "MEM-2", name: "David Brown", shares: 35, acquiredDate: "2021-06-15" },
        { memberID: "MEM-3", name: "Emma Wilson", shares: 15, acquiredDate: "2022-03-01" },
      ],
    });
    const redistributedReport = runReport(redistributed, lines);
    const redistributedMoved = movedFigures(base.document, redistributedReport.document);
    expect(redistributedMoved.has("cell/Companysecretary.xlsx!RegisterofMembers!G1")).toBe(false);
    expect(deltaAt(redistributedMoved, "cell/Companysecretary.xlsx!RegisterofMembers!G3")).toBe(-10);
    expect(failingCheckNames(redistributedReport.checks)).toEqual([]);
  });

  it("returns a new book and leaves the caller's book alone", () => {
    expect(issued).not.toBe(book);
    expect(book.members[0].shares).toBe(60);
  });

  it("refuses a member the schema will not take", () => {
    expect(() => setMembers(book, lines, { members: [{ name: "Frank Green", shares: 10 }] })).toThrow(
      "setMembers would leave the book invalid",
    );
  });

  it("refuses dropping a member a line names", () => {
    const withDividendPayment = [
      ...lines,
      {
        "entryNumber": "TEST-DIVIDEND-PAYMENT-1",
        "sourceJournalID": "bank",
        "postingDate": "2025-03-31",
        "accountMainID": "1200",
        "amount": 100,
        "detailComment": "Carol Smith",
        "diya-gl:memberID": "MEM-1",
      },
    ];
    expect(() => setMembers(book, withDividendPayment, { members: [{ memberID: "MEM-2", name: "David Brown", shares: 100 }] })).toThrow(
      "setMembers would leave the lines invalid",
    );
  });
});

describe("setCharges", () => {
  const CHARGE = {
    chargeDate: "2023-09-01",
    description: "Motor vehicles, being the company's delivery van",
    holder: "NatWest Bank plc, 250 Bishopsgate, London EC2M 4AA",
    terms: "Fixed charge securing a five year business loan",
    boardMeetingDate: "2023-08-25",
  };
  // The register values the van at 30,000, and the balance sheet's creditor
  // falling due after more than one year is 45,000 -- the charge plus the
  // 20,000 the two hire purchase agreements finance.
  const revalued = setCharges(book, lines, { charges: [{ ...CHARGE, valuation: 42000 }] });
  const after = runReport(revalued, lines);
  const moved = movedFigures(base.document, after.document);

  it("moves the valuation on the register", () => {
    expect(deltaAt(moved, "cell/Companysecretary.xlsx!Charges&Debentures!C2")).toBe(12000);
  });

  it("keeps the charges register check green while the charge still covers the secured creditor", () => {
    expect(failingCheckNames(after.checks)).toEqual([]);
  });

  it("fails the charges register check once the valuation falls short of the secured creditor", () => {
    const undervalued = setCharges(book, lines, { charges: [{ ...CHARGE, valuation: 20000 }] });
    const undervaluedReport = runReport(undervalued, lines);
    expect(failingCheckNames(undervaluedReport.checks)).toEqual([
      "Charges register: the balance sheet carries a creditor falling due after more than one year",
    ]);
  });

  it("returns a new book and leaves the caller's book alone", () => {
    expect(revalued).not.toBe(book);
    expect(book.charges[0].valuation).toBe(30000);
  });

  it("refuses a charge with no valuation", () => {
    expect(() => setCharges(book, lines, { charges: [{ description: "Goodwill" }] })).toThrow("setCharges would leave the book invalid");
  });
});
