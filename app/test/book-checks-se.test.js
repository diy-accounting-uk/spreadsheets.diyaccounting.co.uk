// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// book-checks-se.test.js -- the Self Employed book's five checks and three
// warnings beside the shared eight, over the three Self Employed example
// books, with one crafted change per rule proving each of them breakable
// and nothing else moving with it.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { runBookChecks, bookChecksJson, previewHelper, applyHelper, previewBookHelper, applyBookHelper } from "../lib/book-checks.js";
import { bankBalancesByMonth } from "../lib/book-checks/se.js";
import { changeLineBankAccount } from "../lib/diya-gl-edits.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const SHARED_IDS = [
  "book-dates-in-period",
  "book-accounts-in-chart",
  "book-amounts-whole-pence",
  "book-vat-threshold",
  "book-duplicate-entries",
  "book-empty-detail",
  "book-negative-amount",
  "book-empty-month",
];
const SE_IDS = [
  "book-bank-account-has-workbook",
  "book-bank-code-analysed",
  "book-bank-line-has-side",
  "book-payslip-names-employee",
  "book-fixed-asset-rows-fit",
  "book-cash-never-overdrawn",
  "book-bank-overdrawn",
  "book-employee-paid-every-month",
];
const ALL_IDS = SHARED_IDS.concat(SE_IDS);

function resultFor(results, id) {
  return results.find((r) => r.id === id);
}

function loadSe(dir) {
  const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, ...dir.split("/")));
  const taxData = extractTaxDataFromBook(book, "se");
  return { book, lines, taxData };
}

function brickworkNonVat() {
  return loadSe("examples/brickwork-pro/se-nonvat");
}

// ============================== the three example books ==============================
// Read as they stand, not as they are hoped to be.

describe("the three Self Employed example books", () => {
  it("BrickWork Pro not registered: all sixteen rules pass, turnover under the threshold", () => {
    const { results, summary } = runBookChecks(brickworkNonVat());

    expect(results.map((r) => r.id).sort()).toEqual(ALL_IDS.slice().sort());
    expect(summary).toEqual({ pass: 16, warn: 0, fail: 0 });
    expect(resultFor(results, "book-vat-threshold").label).toBe(
      "Turnover for the year is £75,000.00, against a £90,000.00 VAT registration threshold.",
    );
  });

  it("BrickWork Pro registered: turnover is measured net of VAT and the threshold warning passes", () => {
    const { results, summary } = runBookChecks(loadSe("examples/brickwork-pro/se-vat"));

    expect(summary).toEqual({ pass: 16, warn: 0, fail: 0 });
    const vat = resultFor(results, "book-vat-threshold");
    expect(vat.result).toBe("pass");
    expect(vat.label).toBe(
      "Turnover for the year is £112,500.00 net of VAT, against a £90,000.00 VAT registration threshold; the book says the business is registered.",
    );
    expect(vat.consequence).toBeNull();
  });

  it("Precision Code advanced: two bank accounts, three employees, five new assets and two agreements all fit", () => {
    const { results, summary } = runBookChecks(loadSe("examples/precision-code-ltd/advanced"));

    expect(summary).toEqual({ pass: 16, warn: 0, fail: 0 });
    expect(resultFor(results, "book-vat-threshold").label).toBe(
      "Turnover for the year is £354,083.33 net of VAT, against a £90,000.00 VAT registration threshold; the book says the business is registered.",
    );
  });
});

// ============================== bankBalancesByMonth ==============================

describe("bankBalancesByMonth", () => {
  it("carries each month's closing into the next opening, and takes an opening balance entry as the month's opening", () => {
    const { book, lines } = brickworkNonVat();
    const period = { start: book.documentInfo.periodCoveredStart, end: book.documentInfo.periodCoveredEnd };

    const months = bankBalancesByMonth(lines, "1200", period);

    expect(months).toHaveLength(12);
    expect(months[0].month).toBe("2025-04");
    expect(months[11].month).toBe("2026-03");
    // The book's own BC entry on 1 April, not a balance carried from nowhere.
    expect(months[0].opening).toBe(15000);
    for (let index = 0; index < months.length; index++) {
      const month = months[index];
      expect(month.closing).toBeCloseTo(month.opening + month.receipts - month.payments, 8);
      if (index > 0) expect(month.opening).toBeCloseTo(months[index - 1].closing, 8);
    }
  });

  it("reads an account the book never uses as twelve months of nothing", () => {
    const { book, lines } = brickworkNonVat();
    const period = { start: book.documentInfo.periodCoveredStart, end: book.documentInfo.periodCoveredEnd };

    const months = bankBalancesByMonth(lines, "1220", period);

    expect(months).toHaveLength(12);
    expect(months.every((month) => month.opening === 0 && month.closing === 0)).toBe(true);
  });

  it("covers no months when the period names no dates", () => {
    expect(bankBalancesByMonth([], "1200", { start: "", end: "" })).toEqual([]);
  });
});

// ============================== breakability ==============================
// Each crafted change flips the rules named and leaves every other rule
// exactly as the baseline left it.

function assertOnlyTheseRulesFlip(baselineFixture, mutatedFixture, targetIds, expectedResult) {
  const before = runBookChecks(baselineFixture).results;
  const after = runBookChecks(mutatedFixture).results;

  for (const id of targetIds) expect(resultFor(after, id).result, id).toBe(expectedResult);
  for (const id of ALL_IDS) {
    if (targetIds.includes(id)) continue;
    expect(resultFor(after, id).result, id).toBe(resultFor(before, id).result);
  }
}

function bankLine(fields) {
  return {
    "sourceJournalID": "bank",
    "accountMainID": "1200",
    "debitCreditCode": "D",
    "documentType": "bank-statement",
    "diya-gl:bankCode": "DR",
    "diya-gl:bankAccountID": "1200",
    ...fields,
  };
}

function withLine(line) {
  const fixture = brickworkNonVat();
  fixture.lines = fixture.lines.concat([line]);
  return fixture;
}

describe("each Self Employed rule is breakable by one crafted change, and only that rule flips", () => {
  it("book-bank-account-has-workbook: an entry on a savings account the package has no workbook for", () => {
    const mutated = withLine(
      bankLine({
        "entryNumber": "BREAK-BANK-ACCOUNT",
        "postingDate": "2025-07-15",
        "accountMainID": "1210",
        "amount": 500,
        "detailComment": "Savings account interest",
        "diya-gl:bankAccountID": "1210",
      }),
    );

    assertOnlyTheseRulesFlip(brickworkNonVat(), mutated, ["book-bank-account-has-workbook"], "fail");

    const result = resultFor(runBookChecks(mutated).results, "book-bank-account-has-workbook");
    expect(result.offenders).toEqual([
      {
        entryNumber: "BREAK-BANK-ACCOUNT",
        postingDate: "2025-07-15",
        accountMainID: "1210",
        detail: "Savings account interest",
        amount: 500,
      },
    ]);
    expect(result.consequence).toContain("Bank.xlsx and Cash.xlsx");
  });

  it("book-bank-code-analysed: a receipt coded Q, which no Bank.xlsx column analyses", () => {
    const mutated = withLine(
      bankLine({
        "entryNumber": "BREAK-BANK-CODE",
        "postingDate": "2025-07-16",
        "amount": 500,
        "detailComment": "Unrecognised receipt",
        "diya-gl:bankCode": "Q",
      }),
    );

    assertOnlyTheseRulesFlip(brickworkNonVat(), mutated, ["book-bank-code-analysed"], "fail");

    const result = resultFor(runBookChecks(mutated).results, "book-bank-code-analysed");
    expect(result.offenders.map((o) => o.entryNumber)).toEqual(["BREAK-BANK-CODE"]);
    expect(result.consequence).toBe(
      "Bank.xlsx analyses receipts under BC, DR, CR, K, RV, DL, X and payments under BC, CR, DR, W, B, J, RP, DL, X." +
        " An entry coded outside its own workbook's list has no column to land in, and the package cannot be written at all.",
    );
  });

  it("book-bank-line-has-side: an entry that is neither a receipt nor a payment", () => {
    const mutated = withLine(
      bankLine({
        entryNumber: "BREAK-BANK-SIDE",
        postingDate: "2025-07-17",
        amount: 500,
        detailComment: "Direction unknown",
        debitCreditCode: "X",
      }),
    );

    assertOnlyTheseRulesFlip(brickworkNonVat(), mutated, ["book-bank-line-has-side"], "fail");
    expect(resultFor(runBookChecks(mutated).results, "book-bank-line-has-side").offenders.map((o) => o.entryNumber)).toEqual([
      "BREAK-BANK-SIDE",
    ]);
  });

  it("book-cash-never-overdrawn: a cash payment larger than any cash the book ever held", () => {
    const mutated = withLine(
      bankLine({
        "entryNumber": "BREAK-CASH-OVERDRAWN",
        "postingDate": "2025-04-20",
        "accountMainID": "1220",
        "debitCreditCode": "C",
        "amount": 1000000,
        "detailComment": "Cash paid out",
        "diya-gl:bankCode": "CR",
        "diya-gl:bankAccountID": "1220",
      }),
    );

    assertOnlyTheseRulesFlip(brickworkNonVat(), mutated, ["book-cash-never-overdrawn"], "warn");

    const result = resultFor(runBookChecks(mutated).results, "book-cash-never-overdrawn");
    expect(result.actual).toBe(12);
    expect(result.offenders[0]).toEqual({ month: "2025-04", closing: -1000000 });
    expect(result.consequence).toContain("2025-04 closes at -£1,000,000.00");
  });

  it("book-bank-overdrawn: a bank payment larger than the account's balance", () => {
    const mutated = withLine(
      bankLine({
        "entryNumber": "BREAK-BANK-OVERDRAWN",
        "postingDate": "2025-04-20",
        "debitCreditCode": "C",
        "amount": 1000000,
        "detailComment": "Bank paid out",
        "diya-gl:bankCode": "CR",
      }),
    );

    assertOnlyTheseRulesFlip(brickworkNonVat(), mutated, ["book-bank-overdrawn"], "warn");

    const result = resultFor(runBookChecks(mutated).results, "book-bank-overdrawn");
    expect(result.actual).toBe(12);
    expect(result.offenders[0]).toEqual({ month: "2025-04", closing: -982483.3 });
  });

  it("book-payslip-names-employee: a payslip for someone the book does not employ", () => {
    const mutated = withLine({
      "entryNumber": "BREAK-PAYSLIP",
      "sourceJournalID": "payroll",
      "postingDate": "2025-07-28",
      "accountMainID": "5101",
      "amount": 1500,
      "documentType": "payslip",
      "detailComment": "Nobody Here",
      "diya-gl:grossPay": 1500,
    });

    assertOnlyTheseRulesFlip(brickworkNonVat(), mutated, ["book-payslip-names-employee"], "fail");
    expect(resultFor(runBookChecks(mutated).results, "book-payslip-names-employee").offenders.map((o) => o.detail)).toEqual([
      "Nobody Here",
    ]);
  });

  it("book-payslip-names-employee: a sixth employee, past the Employee sheet's last block", () => {
    const mutated = brickworkNonVat();
    mutated.book = {
      ...mutated.book,
      employees: mutated.book.employees.concat(
        [2, 3, 4, 5, 6].map((number) => ({
          employeeID: "EMP00" + number,
          name: "Spare Hand " + number,
          grossPay: 1000,
          payFrequency: "monthly",
          taxCode: "1257L",
        })),
      ),
    };

    assertOnlyTheseRulesFlip(brickworkNonVat(), mutated, ["book-payslip-names-employee"], "fail");
    expect(resultFor(runBookChecks(mutated).results, "book-payslip-names-employee").offenders).toEqual([
      { entryNumber: "EMP006", postingDate: "", accountMainID: "", detail: "Spare Hand 6", amount: 1000 },
    ]);
  });

  it("book-employee-paid-every-month: the labourer's June payslip removed", () => {
    const mutated = brickworkNonVat();
    mutated.lines = mutated.lines.filter((line) => line.entryNumber !== "TXN-0047");

    assertOnlyTheseRulesFlip(brickworkNonVat(), mutated, ["book-employee-paid-every-month"], "warn");

    const result = resultFor(runBookChecks(mutated).results, "book-employee-paid-every-month");
    expect(result.offenders).toEqual([{ employeeID: "EMP002", name: "Tom Davies", month: "2025-06" }]);
    expect(result.consequence).toContain("Tom Davies has no payslip in 2025-06");
  });

  it("book-fixed-asset-rows-fit: a sixth asset purchase, past the Schedule's five new-asset rows", () => {
    const mutated = brickworkNonVat();
    mutated.lines = mutated.lines.concat(
      [
        ["2025-05-06", 1500, "Tool Hire Direct"],
        ["2025-06-09", 2400, "Site Plant Sales"],
        ["2025-08-11", 3100, "Cutting Gear Co"],
        ["2025-10-14", 1900, "Scaffold Systems"],
        ["2026-01-19", 2750, "Mixer Supplies"],
      ].map(([postingDate, amount, detailComment], index) => ({
        entryNumber: "BREAK-FA-" + (index + 1),
        sourceJournalID: "purchases",
        postingDate: postingDate,
        accountMainID: "5900",
        amount: amount,
        documentType: "invoice",
        detailComment: detailComment,
      })),
    );

    assertOnlyTheseRulesFlip(brickworkNonVat(), mutated, ["book-fixed-asset-rows-fit"], "fail");

    const result = resultFor(runBookChecks(mutated).results, "book-fixed-asset-rows-fit");
    expect(result.offenders.map((o) => o.entryNumber)).toEqual(["BREAK-FA-5"]);
    expect(result.consequence).toContain("5 rows for assets bought in the year");
  });

  it("book-fixed-asset-rows-fit: a motor block that fills up, counting only the assets brought forward", () => {
    function withMotorAssets(count) {
      const fixture = brickworkNonVat();
      fixture.book = {
        ...fixture.book,
        fixedAssets: fixture.book.fixedAssets.concat(
          Array.from({ length: count }, (unused, index) => ({
            assetID: "FA-MOTOR-" + (index + 1),
            class: "motorVehicles",
            description: "Flatbed " + (index + 1),
            cost: 9000,
          })),
        ),
      };
      return fixture;
    }

    // The book's own van is claimed by an "fa" purchase line, so it is on
    // the Schedule's New block, not the motor block -- five more still fit.
    assertOnlyTheseRulesFlip(brickworkNonVat(), withMotorAssets(5), [], "pass");
    assertOnlyTheseRulesFlip(brickworkNonVat(), withMotorAssets(6), ["book-fixed-asset-rows-fit"], "fail");
    expect(resultFor(runBookChecks(withMotorAssets(6)).results, "book-fixed-asset-rows-fit").offenders.map((o) => o.entryNumber)).toEqual([
      "FA-MOTOR-6",
    ]);
  });

  it("book-vat-threshold: a sale that lifts turnover past the registration threshold", () => {
    const mutated = withLine({
      entryNumber: "BREAK-TURNOVER",
      sourceJournalID: "sales",
      postingDate: "2026-03-20",
      accountMainID: "4000",
      amount: 20000,
      documentType: "invoice",
      detailComment: "Riverside Homes",
    });

    assertOnlyTheseRulesFlip(brickworkNonVat(), mutated, ["book-vat-threshold"], "warn");
    expect(resultFor(runBookChecks(mutated).results, "book-vat-threshold").actual).toBe(95000);
  });

  it("book-dates-in-period: a sale after the year end fails, unless it names the VAT period it belongs to", () => {
    const straddling = {
      "entryNumber": "BREAK-STRADDLE",
      "sourceJournalID": "sales",
      "postingDate": "2026-04-15",
      "accountMainID": "4000",
      "amount": 1000,
      "documentType": "invoice",
      "detailComment": "Meadow Court",
      "diya-gl:vatPeriodEnd": "2026-04-30",
    };
    const named = withLine(straddling);
    const unnamed = withLine({ ...straddling, "diya-gl:vatPeriodEnd": undefined });

    assertOnlyTheseRulesFlip(brickworkNonVat(), named, [], "pass");
    assertOnlyTheseRulesFlip(brickworkNonVat(), unnamed, ["book-dates-in-period"], "fail");
    expect(resultFor(runBookChecks(unnamed).results, "book-dates-in-period").offenders.map((o) => o.entryNumber)).toEqual([
      "BREAK-STRADDLE",
    ]);
  });
});

// ============================== the two helpers ==============================

describe("the current-account helper", () => {
  function offAccountFixture() {
    return withLine(
      bankLine({
        "entryNumber": "BREAK-BANK-ACCOUNT",
        "postingDate": "2025-07-15",
        "accountMainID": "1210",
        "amount": 500,
        "detailComment": "Savings account interest",
        "diya-gl:bankAccountID": "1210",
      }),
    );
  }

  it("previewHelper names the line and the account it moves to", () => {
    const preview = previewHelper(offAccountFixture(), "book-bank-account-has-workbook");

    expect(preview.title).toBe("Move these entries to the current account");
    expect(preview.summary).toBe("This will change 1 line. Nothing else in the book moves.");
    expect(preview.changes).toEqual([
      { entryNumber: "BREAK-BANK-ACCOUNT", was: "1210", becomes: "1200 — Current account", amount: 500, what: "account" },
    ]);
  });

  it("applyHelper moves the entry onto the current account and the check then passes", () => {
    const fixture = offAccountFixture();
    const moved = applyHelper(fixture, "book-bank-account-has-workbook");

    const line = moved.find((entry) => entry.entryNumber === "BREAK-BANK-ACCOUNT");
    expect(line.accountMainID).toBe("1200");
    expect(line["diya-gl:bankAccountID"]).toBe("1200");
    expect(fixture.lines.find((entry) => entry.entryNumber === "BREAK-BANK-ACCOUNT").accountMainID).toBe("1210");

    const after = runBookChecks({ ...fixture, lines: moved }).results;
    expect(resultFor(after, "book-bank-account-has-workbook").result).toBe("pass");
  });

  it("changeLineBankAccount refuses an account the book's chart does not declare, and a line off the bank journal", () => {
    const { book, lines } = brickworkNonVat();

    expect(() => changeLineBankAccount(book, lines, { entryNumber: "TXN-0001", newBankAccountID: "1220" })).toThrow(
      'changeLineBankAccount expects a bank account declared in the book\'s own chart, got "1220"',
    );
    expect(() => changeLineBankAccount(book, lines, { entryNumber: "TXN-0014", newBankAccountID: "1200" })).toThrow(
      'changeLineBankAccount expects a line on the bank journal, got "sales"',
    );
    expect(() => changeLineBankAccount(book, lines, { entryNumber: "NOPE", newBankAccountID: "1200" })).toThrow(
      "No line carries entryNumber NOPE",
    );
  });
});

describe("the add-the-employee helper", () => {
  function unnamedPayslipFixture() {
    return withLine({
      "entryNumber": "BREAK-PAYSLIP",
      "sourceJournalID": "payroll",
      "postingDate": "2025-07-28",
      "accountMainID": "5101",
      "amount": 1500,
      "documentType": "payslip",
      "detailComment": "Nobody Here",
      "diya-gl:grossPay": 1500,
    });
  }

  it("the failing check carries a book helper rather than a lines one", () => {
    const result = resultFor(runBookChecks(unnamedPayslipFixture()).results, "book-payslip-names-employee");

    expect(result.helper).toEqual({ id: "book-payslip-names-employee", label: "Add these people to the payroll", kind: "book" });
    expect(previewHelper(unnamedPayslipFixture(), "book-payslip-names-employee")).toBeNull();
  });

  it("previewBookHelper names the person the payslip names", () => {
    const preview = previewBookHelper(unnamedPayslipFixture(), "book-payslip-names-employee");

    expect(preview.title).toBe("Add these people to the payroll");
    expect(preview.summary).toBe("This will add 1 entry to the book. Nothing else moves.");
    expect(preview.changes).toEqual([{ entryNumber: "BREAK-PAYSLIP", what: "employee", becomes: "Nobody Here" }]);
  });

  it("applyBookHelper returns a book with the employee added, past the highest id the book already carries", () => {
    const fixture = unnamedPayslipFixture();
    const appliedBook = applyBookHelper(fixture, "book-payslip-names-employee");

    expect(fixture.book.employees).toHaveLength(1);
    expect(appliedBook.employees).toHaveLength(2);
    expect(appliedBook.employees[1]).toEqual({
      employeeID: "EMP003",
      name: "Nobody Here",
      grossPay: 1500,
      payFrequency: "monthly",
      taxCode: "",
      niCategory: "A",
      isDirector: false,
    });

    const after = runBookChecks({ ...fixture, book: appliedBook }).results;
    expect(resultFor(after, "book-payslip-names-employee").result).toBe("pass");
  });

  it("adds one employee per name however many payslips that name carries", () => {
    const fixture = unnamedPayslipFixture();
    fixture.lines = fixture.lines.concat([
      { ...fixture.lines[fixture.lines.length - 1], entryNumber: "BREAK-PAYSLIP-2", postingDate: "2025-08-28" },
    ]);

    expect(applyBookHelper(fixture, "book-payslip-names-employee").employees).toHaveLength(2);
  });

  it("returns null for a passing check and throws for an unknown id", () => {
    const fixture = brickworkNonVat();
    expect(previewBookHelper(fixture, "book-payslip-names-employee")).toBeNull();
    expect(() => applyBookHelper(fixture, "book-payslip-names-employee")).toThrow("Nothing left for this helper to fix.");
    expect(() => applyBookHelper(fixture, "not-a-real-check")).toThrow('No helper called "not-a-real-check"');
  });
});

// ============================== other products are untouched ==============================

describe("a book on another product carries none of the eight Self Employed ids", () => {
  it("a Basic Sole Trader book runs the shared eight alone", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, "examples", "precision-code-ltd", "bst"));
    const taxData = extractTaxDataFromBook(book, "bst");
    const { results } = runBookChecks({ book, lines, taxData });

    expect(results.map((r) => r.id).sort()).toEqual(SHARED_IDS.slice().sort());
  });

  it("a registered Taxi book still measures turnover gross and warns", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, "examples", "kestrel-executive-cars", "taxi"));
    const taxData = extractTaxDataFromBook(book, "taxi");
    const { results } = runBookChecks({ book, lines, taxData });

    expect(resultFor(results, "book-vat-threshold").result).toBe("warn");
  });
});

// ============================== bookChecksJson ==============================

describe("bookChecksJson over a Self Employed book", () => {
  it("stays byte-stable whatever order the lines arrived in, with the eight new ids present", () => {
    const fixture = loadSe("examples/precision-code-ltd/advanced");
    const reversed = { ...fixture, lines: fixture.lines.slice().reverse() };

    const a = bookChecksJson(runBookChecks(fixture).results);
    const b = bookChecksJson(runBookChecks(reversed).results);

    expect(a).toBe(b);
    expect(JSON.parse(a).map((r) => r.id)).toEqual(ALL_IDS.slice().sort());
  });
});
