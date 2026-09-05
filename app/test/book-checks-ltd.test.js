// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// book-checks-ltd.test.js -- the Company book's eight rules beside the
// shared eight, over the Ltd example books, with one crafted change per
// rule proving each of them breakable and nothing else moving with it.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData, diyaGlToScenario, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { runBookChecks, bookChecksJson, previewHelper, applyHelper } from "../lib/book-checks.js";
import { buildFileReportDocument } from "../bin/export.js";
import * as ltdProduct from "../products/ltd.js";

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
const LTD_IDS = [
  "ltd-bank-line-has-side",
  "ltd-bank-code-analysed",
  "ltd-straddling-line-has-vat-period",
  "ltd-payroll-line-names-employee",
  "ltd-fixed-asset-rows-fit-schedule",
  "ltd-transfer-has-counter-leg",
  "ltd-dividend-within-distributable-profits",
  "ltd-cis-on-subcontractor-line",
];
const ALL_IDS = SHARED_IDS.concat(LTD_IDS);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resultFor(results, id) {
  return results.find((r) => r.id === id);
}

function loadLtd(dir) {
  const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, ...dir.split("/")));
  const taxData = extractTaxDataFromBook(book, "ltd");
  const scenario = diyaGlToScenario(book, lines, "ltd");
  const results = calculateFromDiyaGl(book, lines, "ltd", taxData, scenario);
  return { book, lines, taxData, results };
}

const FULL = loadLtd("examples/precision-code-ltd/full");

// ============================== the Ltd example books ==============================
// Read as they stand, not as they are hoped to be.

describe("the Ltd example books", () => {
  it("Precision Code Ltd runs sixteen rules: every check passes, and the cash top-up has no counter leg", () => {
    const { results, summary } = runBookChecks(clone(FULL));

    expect(results.map((r) => r.id).sort()).toEqual(ALL_IDS.slice().sort());
    for (const id of ["book-dates-in-period", "book-accounts-in-chart", "book-amounts-whole-pence"]) {
      expect(resultFor(results, id).result, id).toBe("pass");
    }
    for (const id of LTD_IDS) {
      const expected = id === "ltd-transfer-has-counter-leg" ? "warn" : "pass";
      expect(resultFor(results, id).result, id).toBe(expected);
    }

    // The book's one BB-coded transfer tops the cash float up from the
    // current account, and the current account never gives the money up.
    const transfers = resultFor(results, "ltd-transfer-has-counter-leg");
    expect(transfers.offenders).toEqual([
      { entryNumber: "TXN-0155", postingDate: "2025-06-10", accountMainID: "1220", detail: "Cash top-up", amount: 100 },
    ]);

    // The other two warnings are the shared rules reading a Company book:
    // turnover well over the VAT threshold on a book that says it is
    // registered, and the opening, transfer and stock journals, whose two
    // legs share a journal, date, amount and detail by construction.
    expect(resultFor(results, "book-vat-threshold").result).toBe("warn");
    expect(resultFor(results, "book-duplicate-entries").actual).toBe(6);
    expect(summary).toEqual({ pass: 13, warn: 3, fail: 0 });
  });

  it("BrickWork Pro (Company, non-VAT): all sixteen rules pass", () => {
    const { results, summary } = runBookChecks(loadLtd("examples/brickwork-pro/ltd-nonvat"));
    for (const id of ALL_IDS) expect(resultFor(results, id).result, id).toBe("pass");
    expect(summary).toEqual({ pass: 16, warn: 0, fail: 0 });
  });

  it("BrickWork Pro (Company, VAT): every rule but the shared VAT threshold passes", () => {
    const { results } = runBookChecks(loadLtd("examples/brickwork-pro/ltd-vat"));
    for (const id of ALL_IDS) {
      const expected = id === "book-vat-threshold" ? "warn" : "pass";
      expect(resultFor(results, id).result, id).toBe(expected);
    }
  });

  it("a book naming another product runs the shared eight alone", () => {
    const fixture = clone(FULL);
    fixture.book.entityInformation["diya-gl:product"] = "BasicSoleTrader";
    const { results } = runBookChecks(fixture);
    expect(results.map((r) => r.id).sort()).toEqual(SHARED_IDS.slice().sort());
  });
});

// ============================== a Company book that starts clean ==============================
// The full fixture with the cash top-up's counter leg entered on the
// current account, so every Ltd rule starts passing and one crafted change
// can be shown to flip one rule.

const COUNTER_LEG = {
  "entryNumber": "TXN-0155B",
  "sourceJournalID": "bank",
  "postingDate": "2025-06-10",
  "accountMainID": "1200",
  "debitCreditCode": "C",
  "amount": 100.0,
  "documentType": "bank-statement",
  "documentReference": "BNK-0155B",
  "detailComment": "Cash float withdrawal",
  "lineItemComment": "Cash drawn for the cash float",
  "taxCode": "OS",
  "taxRate": 0.0,
  "diya-gl:bankCode": "BC",
  "diya-gl:bankAccountID": "1200",
};

function baseline() {
  const fixture = clone(FULL);
  fixture.lines.push(clone(COUNTER_LEG));
  return fixture;
}

function lineIn(fixture, entryNumber) {
  return fixture.lines.find((l) => l.entryNumber === entryNumber);
}

// Runs the clean baseline and a mutated variant, and asserts that exactly
// the named rules changed result -- every other rule keeps the result it
// had on the baseline.
function assertOnlyTheseRulesFlip(mutated, targetIds, expectedResult) {
  const before = runBookChecks(baseline()).results;
  const after = runBookChecks(mutated).results;

  for (const id of targetIds) expect(resultFor(after, id).result, id).toBe(expectedResult);
  for (const id of ALL_IDS) {
    if (targetIds.includes(id)) continue;
    expect(resultFor(after, id).result, id).toBe(resultFor(before, id).result);
  }
}

describe("the Company baseline starts clean", () => {
  it("entering the counter leg clears the transfer warning and every Ltd rule passes", () => {
    const { results } = runBookChecks(baseline());
    for (const id of LTD_IDS) expect(resultFor(results, id).result, id).toBe("pass");
  });
});

describe("each Ltd rule is breakable by one crafted change, and only that rule flips", () => {
  it("ltd-bank-line-has-side: a bank entry with no debit or credit code", () => {
    const fixture = baseline();
    delete lineIn(fixture, "TXN-0026").debitCreditCode;
    assertOnlyTheseRulesFlip(fixture, ["ltd-bank-line-has-side"], "fail");
  });

  it("ltd-bank-code-analysed: a cash receipt coded RV, which only the statement books analyse", () => {
    const fixture = baseline();
    const line = lineIn(fixture, "TXN-0026");
    line.accountMainID = "1220";
    line["diya-gl:bankAccountID"] = "1220";
    line["diya-gl:bankCode"] = "RV";
    line.debitCreditCode = "D";
    assertOnlyTheseRulesFlip(fixture, ["ltd-bank-code-analysed"], "fail");
  });

  it("ltd-bank-code-analysed: a bank entry on an account with no workbook", () => {
    const fixture = baseline();
    const line = lineIn(fixture, "TXN-0026");
    line.accountMainID = "1240";
    line["diya-gl:bankAccountID"] = "1240";
    assertOnlyTheseRulesFlip(fixture, ["ltd-bank-code-analysed"], "fail");
  });

  it("ltd-transfer-has-counter-leg: the transfer's other leg removed", () => {
    const fixture = baseline();
    fixture.lines = fixture.lines.filter((l) => l.entryNumber !== "TXN-0155B");
    assertOnlyTheseRulesFlip(fixture, ["ltd-transfer-has-counter-leg"], "warn");
  });

  it("ltd-straddling-line-has-vat-period: a purchase after the year end with no VAT period", () => {
    const fixture = baseline();
    lineIn(fixture, "TXN-0164").postingDate = "2026-04-15";
    assertOnlyTheseRulesFlip(fixture, ["ltd-straddling-line-has-vat-period", "book-dates-in-period"], "fail");
  });

  it("ltd-payroll-line-names-employee: a payslip for someone the book never employed", () => {
    const fixture = baseline();
    const line = lineIn(fixture, "TXN-0074");
    line["diya-gl:employeeID"] = "EMP999";
    line.detailComment = "Nobody";
    assertOnlyTheseRulesFlip(fixture, ["ltd-payroll-line-names-employee"], "fail");
  });

  it("ltd-dividend-within-distributable-profits: a dividend far above the year's profits", () => {
    const fixture = baseline();
    fixture.book.dividends[0].amount = 10000000;
    assertOnlyTheseRulesFlip(fixture, ["ltd-dividend-within-distributable-profits"], "warn");
  });

  it("ltd-cis-on-subcontractor-line: a CIS deduction on a materials purchase", () => {
    const fixture = baseline();
    const materials = fixture.lines.find((l) => l.sourceJournalID === "purchases" && l.accountMainID === "5000");
    materials["diya-gl:cisDeduction"] = 100.0;
    assertOnlyTheseRulesFlip(fixture, ["ltd-cis-on-subcontractor-line"], "warn");
  });

  it("ltd-fixed-asset-rows-fit-schedule: nine assets bought in a year with eight new-asset rows", () => {
    const fixture = baseline();
    const existing = fixture.lines.filter((l) => l.sourceJournalID === "purchases" && l.accountMainID === "5900").length;
    for (let i = existing; i < 9; i++) {
      fixture.lines.push({
        entryNumber: `BREAK-FA-${i}`,
        sourceJournalID: "purchases",
        postingDate: "2025-09-1" + (i % 10),
        accountMainID: "5900",
        amount: 1200.0 + i,
        detailComment: "Toolshed Ltd asset " + i,
        taxCode: "S",
        taxRate: 0.2,
      });
    }
    assertOnlyTheseRulesFlip(fixture, ["ltd-fixed-asset-rows-fit-schedule"], "fail");
  });

  it("ltd-fixed-asset-rows-fit-schedule: a sixth motor vehicle in a block of five rows", () => {
    const fixture = baseline();
    for (let i = 0; i < 5; i++) {
      fixture.book.fixedAssets.push({
        assetID: `BREAK-VAN-${i}`,
        class: "motorVehicles",
        description: "Second van " + i,
        cost: 12000.0,
        accumulatedDepreciation: 1000.0,
      });
    }
    assertOnlyTheseRulesFlip(fixture, ["ltd-fixed-asset-rows-fit-schedule"], "fail");
  });

  it("ltd-fixed-asset-rows-fit-schedule: more disposals than there are asset rows to attach them to", () => {
    const fixture = baseline();
    for (let i = 0; i < 9; i++) {
      fixture.lines.push({
        entryNumber: `BREAK-FS-${i}`,
        sourceJournalID: "sales",
        postingDate: "2025-10-1" + (i % 10),
        accountMainID: "4006",
        amount: 500.0 + i,
        detailComment: "Asset sold to buyer " + i,
        taxCode: "S",
        taxRate: 0.2,
      });
    }
    assertOnlyTheseRulesFlip(fixture, ["ltd-fixed-asset-rows-fit-schedule"], "fail");
  });

  it("ltd-fixed-asset-rows-fit-schedule: a third hire purchase agreement in two rows", () => {
    const fixture = baseline();
    fixture.book.hpAgreements.push({
      agreementID: "HP-2025-03",
      financeCompany: "Close Brothers Asset Finance",
      supplier: "Precision Tooling Supplies",
      amountFinanced: 4000.0,
      adminCharges: 50.0,
      totalInterest: 500.0,
      termMonths: 20,
      startDate: "2025-11-01",
    });
    assertOnlyTheseRulesFlip(fixture, ["ltd-fixed-asset-rows-fit-schedule"], "fail");
  });
});

// ============================== the shared checks a Company book reads differently ==============================

describe("the shared checks a Company book reads differently", () => {
  it("a straddling purchase carrying a VAT period end passes both date rules", () => {
    const fixture = baseline();
    const line = lineIn(fixture, "TXN-0164");
    line.postingDate = "2026-04-15";
    line["diya-gl:vatPeriodEnd"] = "2026-05-31";
    const { results } = runBookChecks(fixture);
    expect(resultFor(results, "ltd-straddling-line-has-vat-period").result).toBe("pass");
    expect(resultFor(results, "book-dates-in-period").result).toBe("pass");
  });

  it("bank, payroll and journal lines never fail the chart check on a Company book", () => {
    const fixture = baseline();
    const offJournalLines = fixture.lines.filter((l) => l.sourceJournalID !== "sales" && l.sourceJournalID !== "purchases");
    expect(offJournalLines).toHaveLength(218);
    expect(resultFor(runBookChecks(fixture).results, "book-accounts-in-chart").result).toBe("pass");

    // The same lines against the shared rule alone: the chart declares a
    // sales and a purchases table, and nothing those 218 lines post to.
    const asAnotherProduct = clone(fixture);
    asAnotherProduct.book.entityInformation["diya-gl:product"] = "BasicSoleTrader";
    const shared = resultFor(runBookChecks(asAnotherProduct).results, "book-accounts-in-chart");
    expect(shared.result).toBe("fail");
    expect(shared.actual).toBe(218);
  });

  it("the straddling rule offers the shared move-into-the-period helper", () => {
    const fixture = baseline();
    lineIn(fixture, "TXN-0164").postingDate = "2026-04-15";
    const preview = previewHelper(fixture, "ltd-straddling-line-has-vat-period");
    expect(preview.title).toBe("Move these entries into the period");
    expect(preview.changes).toEqual([{ entryNumber: "TXN-0164", was: "2026-04-15", becomes: "2026-03-31", amount: 5000, what: "date" }]);

    const applied = applyHelper(fixture, "ltd-straddling-line-has-vat-period");
    const after = runBookChecks({ ...fixture, lines: applied });
    expect(resultFor(after.results, "ltd-straddling-line-has-vat-period").result).toBe("pass");
  });

  it("a rule with no helper offers none", () => {
    const fixture = baseline();
    delete lineIn(fixture, "TXN-0026").debitCreditCode;
    expect(resultFor(runBookChecks(fixture).results, "ltd-bank-line-has-side").helper).toBeUndefined();
    expect(previewHelper(fixture, "ltd-bank-line-has-side")).toBeNull();
    expect(() => applyHelper(fixture, "ltd-bank-line-has-side")).toThrow('No helper called "ltd-bank-line-has-side"');
  });
});

// ============================== the writer behind the bank code rule ==============================

describe("the bank code rule and the writer agree", () => {
  it("a code the rule rejects is a code cellWrites refuses to lay a column out for", () => {
    const fixture = baseline();
    const line = lineIn(fixture, "TXN-0026");
    line.accountMainID = "1220";
    line["diya-gl:bankAccountID"] = "1220";
    line["diya-gl:bankCode"] = "RV";
    line.debitCreditCode = "D";

    expect(resultFor(runBookChecks(fixture).results, "ltd-bank-code-analysed").result).toBe("fail");

    const scenario = diyaGlToScenario(fixture.book, fixture.lines, "ltd");
    expect(() => ltdProduct.cellWrites(scenario, 2025, 3)).toThrow("Cashaccount.xlsx analyses no receipt under code RV");
  });
});

// ============================== bookchecks.json ==============================

describe("bookChecksJson over a Company book", () => {
  it("is the same bytes whatever order the lines arrived in", () => {
    const fixture = baseline();
    const reversed = { ...fixture, lines: fixture.lines.slice().reverse() };
    expect(bookChecksJson(runBookChecks(reversed).results)).toBe(bookChecksJson(runBookChecks(fixture).results));
  });

  it("lists the sixteen ids in id order", () => {
    const parsed = JSON.parse(bookChecksJson(runBookChecks(baseline()).results));
    expect(parsed.map((r) => r.id)).toEqual(ALL_IDS.slice().sort());
  });
});

// ============================== the engine checks a book field can fail ==============================
// These are not book checks: they live in the product's checkCompliance and
// reach a surface through the D-to-R loop, so a page edit that lands a book
// field wrong shows up here rather than in bookchecks.json.

describe("the engine checks a book field can fail", () => {
  function engineChecksFailing(lines) {
    const document = buildFileReportDocument(FULL.book, lines, "ltd", ltdProduct);
    return document.values.filter((v) => v.key.startsWith("check/") && v.value !== "pass").map((v) => v.key.slice("check/".length));
  }

  it("an opening balance sheet entry a pound out fails the trial balance's own audit check", () => {
    expect(engineChecksFailing(FULL.lines)).toEqual([]);

    const lines = clone(FULL.lines);
    lines.find((l) => l.documentReference === "OB-001" && l.accountMainID === "1100").amount = 10001;
    expect(engineChecksFailing(lines)).toEqual(["Trial Balance: audit accuracy (EJ91)"]);
  });
});
