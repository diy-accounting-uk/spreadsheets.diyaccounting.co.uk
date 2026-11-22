// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// book-checks-warnings.test.js -- the nine report-only warnings on a Company
// book: each passes on a clean example, warns on a corrupted copy with
// exactly the offending lines, and changes no other check and no figure.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData, diyaGlToScenario, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { runBookChecks } from "../lib/book-checks.js";
import { longTermDebtorsClosing } from "../lib/diya-gl-roll-forward.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const WARNING_IDS = [
  "book-journal-balances",
  "book-journal-has-reason",
  "book-journal-reaches-no-report",
  "book-posting-status-counted",
  "book-currency-not-gbp",
  "book-ltd-vat-code-not-applied",
  "book-ltd-long-term-debtors-unpublished",
  "book-ltd-directors-loan-always-long-term",
  "book-ltd-loan-interest-in-administrative-expenses",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resultFor(results, id) {
  return results.find((r) => r.id === id);
}

function loadClean() {
  const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, "examples", "brickwork-pro", "ltd-vat"));
  return { book, lines, taxData: extractTaxDataFromBook(book, "ltd") };
}

function run(fixture) {
  const scenario = diyaGlToScenario(fixture.book, fixture.lines, "ltd");
  const results = calculateFromDiyaGl(fixture.book, fixture.lines, "ltd", fixture.taxData, scenario);
  return { ...runBookChecks({ ...fixture, results }), figures: results };
}

function offendersOf(run, id) {
  return resultFor(run.results, id)
    .offenders.map((o) => o.entryNumber)
    .sort();
}

const CLEAN = loadClean();

function fresh() {
  return clone(CLEAN);
}

function aSalesLine(fixture) {
  return fixture.lines.find((l) => l.sourceJournalID === "sales");
}

// Asserts that only the named warning changed result against the clean
// book, apart from the companions the same corruption trips by its own
// nature, and that no other check or warning moved.
function assertOnlyThisWarningWarns(fixture, id, companions = []) {
  const before = run(fresh());
  const after = run(fixture);
  expect(resultFor(after.results, id).result).toBe("warn");
  for (const result of before.results) {
    if (result.id === id) continue;
    const expected = companions.includes(result.id) ? "warn" : result.result;
    expect(resultFor(after.results, result.id).result, result.id).toBe(expected);
  }
  return after;
}

describe("the clean Company example", () => {
  it("passes all nine warnings", () => {
    const { results } = run(fresh());
    for (const id of WARNING_IDS) expect(resultFor(results, id).result, id).toBe("pass");
  });
});

describe("book-journal-balances", () => {
  it("warns on the lines of a journal entry whose debits differ from its credits", () => {
    const fixture = fresh();
    fixture.lines.push(
      {
        entryNumber: "TXN-9001",
        sourceJournalID: "journal",
        postingDate: "2025-06-30",
        accountMainID: "5000",
        debitCreditCode: "D",
        amount: 100,
        documentReference: "JNL-900",
        detailComment: "Adjustment",
      },
      {
        entryNumber: "TXN-9002",
        sourceJournalID: "journal",
        postingDate: "2025-06-30",
        accountMainID: "1100",
        debitCreditCode: "C",
        amount: 90,
        documentReference: "JNL-900",
        detailComment: "Adjustment",
      },
    );
    const after = assertOnlyThisWarningWarns(fixture, "book-journal-balances", ["book-journal-reaches-no-report"]);
    expect(offendersOf(after, "book-journal-balances")).toEqual(["TXN-9001", "TXN-9002"]);
  });
});

describe("book-journal-has-reason", () => {
  it("warns on a journal line with no detail and no line comment", () => {
    const fixture = fresh();
    const opening = fixture.lines.find((l) => l.sourceJournalID === "journal");
    delete opening.detailComment;
    delete opening.lineItemComment;
    const after = assertOnlyThisWarningWarns(fixture, "book-journal-has-reason", ["book-empty-detail"]);
    expect(offendersOf(after, "book-journal-has-reason")).toEqual([opening.entryNumber]);
  });
});

describe("book-journal-reaches-no-report", () => {
  it("warns on an in-year journal line and leaves the opening journal alone", () => {
    const fixture = fresh();
    fixture.lines.push({
      entryNumber: "TXN-9003",
      sourceJournalID: "journal",
      postingDate: "2025-06-30",
      accountMainID: "5000",
      debitCreditCode: "D",
      amount: 0,
      documentReference: "JNL-901",
      detailComment: "Adjustment",
    });
    const after = assertOnlyThisWarningWarns(fixture, "book-journal-reaches-no-report");
    expect(offendersOf(after, "book-journal-reaches-no-report")).toEqual(["TXN-9003"]);
  });
});

describe("book-posting-status-counted", () => {
  it("warns on a draft line, which the figures still total", () => {
    const fixture = fresh();
    const sale = aSalesLine(fixture);
    sale.postingStatus = "draft";
    const before = run(fresh()).figures;
    const after = assertOnlyThisWarningWarns(fixture, "book-posting-status-counted");
    expect(offendersOf(after, "book-posting-status-counted")).toEqual([sale.entryNumber]);
    expect(after.figures).toEqual(before);
  });

  it("passes a line marked posted", () => {
    const fixture = fresh();
    aSalesLine(fixture).postingStatus = "posted";
    expect(resultFor(run(fixture).results, "book-posting-status-counted").result).toBe("pass");
  });
});

describe("book-currency-not-gbp", () => {
  it("warns on a line in another currency and passes one in GBP", () => {
    const fixture = fresh();
    const sale = aSalesLine(fixture);
    sale.amountCurrency = "EUR";
    const after = assertOnlyThisWarningWarns(fixture, "book-currency-not-gbp");
    expect(offendersOf(after, "book-currency-not-gbp")).toEqual([sale.entryNumber]);

    sale.amountCurrency = "GBP";
    expect(resultFor(run(fixture).results, "book-currency-not-gbp").result).toBe("pass");
  });
});

describe("book-ltd-vat-code-not-applied", () => {
  it("warns on a purchase coded exempt and on a sale carrying another rate", () => {
    const fixture = fresh();
    const purchase = fixture.lines.find((l) => l.sourceJournalID === "purchases");
    const sale = aSalesLine(fixture);
    purchase.taxCode = "E";
    purchase.taxRate = 0;
    sale.taxRate = 0.05;
    const after = assertOnlyThisWarningWarns(fixture, "book-ltd-vat-code-not-applied");
    expect(offendersOf(after, "book-ltd-vat-code-not-applied")).toEqual([purchase.entryNumber, sale.entryNumber].sort());
  });

  it("passes the same lines on a book that is not VAT registered", () => {
    const fixture = fresh();
    aSalesLine(fixture).taxCode = "Z";
    fixture.book.entityInformation["diya-gl:vatRegistered"] = false;
    expect(resultFor(run(fixture).results, "book-ltd-vat-code-not-applied").result).toBe("pass");
  });
});

describe("book-ltd-long-term-debtors-unpublished", () => {
  it("warns with the closing figure when the bank lends out under LDR", () => {
    const fixture = fresh();
    fixture.lines.push({
      "entryNumber": "TXN-9004",
      "sourceJournalID": "bank",
      "postingDate": "2025-06-30",
      "accountMainID": "1200",
      "debitCreditCode": "C",
      "amount": 500,
      "documentReference": "BNK-LDR-900",
      "detailComment": "Loan to a connected company",
      "diya-gl:bankCode": "LDR",
      "diya-gl:bankAccountID": "1200",
    });
    const after = assertOnlyThisWarningWarns(fixture, "book-ltd-long-term-debtors-unpublished");
    const result = resultFor(after.results, "book-ltd-long-term-debtors-unpublished");
    expect(result.actual).toBe(500);
    expect(result.actual).toBe(longTermDebtorsClosing(fixture.lines, "2025-04-01", {}));
    expect(offendersOf(after, "book-ltd-long-term-debtors-unpublished")).toEqual(["TXN-9004"]);
  });
});

describe("book-ltd-directors-loan-always-long-term", () => {
  it("warns with the closing balance when a director lends to the company", () => {
    const fixture = fresh();
    fixture.lines.push({
      "entryNumber": "TXN-9005",
      "sourceJournalID": "bank",
      "postingDate": "2025-06-30",
      "accountMainID": "1200",
      "debitCreditCode": "D",
      "amount": 2000,
      "documentReference": "BNK-DL-900",
      "detailComment": "Director",
      "diya-gl:bankCode": "DL",
      "diya-gl:bankAccountID": "1200",
    });
    const after = assertOnlyThisWarningWarns(fixture, "book-ltd-directors-loan-always-long-term");
    expect(resultFor(after.results, "book-ltd-directors-loan-always-long-term").actual).toBe(2000);
    expect(offendersOf(after, "book-ltd-directors-loan-always-long-term")).toEqual(["TXN-9005"]);
  });
});

describe("book-ltd-loan-interest-in-administrative-expenses", () => {
  it("warns with the total of the lines coded 5803", () => {
    const fixture = fresh();
    const purchase = fixture.lines.find((l) => l.sourceJournalID === "purchases");
    purchase.accountMainID = "5803";
    const after = run(fixture);
    const result = resultFor(after.results, "book-ltd-loan-interest-in-administrative-expenses");
    expect(result.result).toBe("warn");
    expect(result.actual).toBe(purchase.amount);
    expect(offendersOf(after, "book-ltd-loan-interest-in-administrative-expenses")).toEqual([purchase.entryNumber]);
  });
});
