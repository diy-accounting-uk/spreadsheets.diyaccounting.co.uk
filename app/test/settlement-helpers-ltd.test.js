// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// settlement-helpers-ltd.test.js -- the four settlement suggestions
// (book-checks.js) proved over the Precision Code Ltd Company book, the
// same functions settlement-helpers.test.js proves over Self Employed's
// BrickWork Pro. The suggestion engine reads only the book's own declared
// chart (book.toml's [accounts.*] and [accounts.bank] tables), so running
// it here exercises Ltd's own account numbers -- 4000-4006 sales,
// 5000-5900 purchases, 1200/1210/1220/1230 bank -- rather than SE's, with
// no product branch anywhere in the helpers themselves.
//
// No LibreOffice: this is the JS engine's own D-to-R loop, the same one
// diya-gl-edits-ltd.test.js runs.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { settlementSuggestions, applySettlement } from "../lib/book-checks.js";
import { changeLineAmount } from "../lib/diya-gl-edits.js";
import * as ltd from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");

// The Precision Code full book, on the year and the rates calculator-ltd's
// own first fixture runs -- see diya-gl-edits-ltd.test.js for why the
// dates shift back a year to meet the March 2025 year end.
const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "full"), "-P1Y");
const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "ltd-2024.toml"), "utf8"));
const VAT_RATE = taxData.vat.standard_rate;

function resultsFor(editedLines) {
  const scenario = diyaGlToScenario(book, editedLines, "ltd");
  return calculateFromDiyaGl(book, editedLines, "ltd", taxData, scenario);
}

function checksFor(editedLines) {
  const scenario = diyaGlToScenario(book, editedLines, "ltd");
  const merged = { ...scenario, ...scenario.expected };
  const results = calculateFromDiyaGl(book, editedLines, "ltd", taxData, scenario);
  const yearEnd = new Date(book.documentInfo.periodCoveredEnd).toISOString().slice(0, 10);
  return ltd.checkCompliance({ ...results }, merged, taxData, calculateExpectedTax, yearEnd);
}

function failingCheckNames(checks) {
  return checks.filter((check) => !check.pass).map((check) => check.name);
}

function suggestionIds(currentLines) {
  return settlementSuggestions({ book, lines: currentLines }).map((suggestion) => suggestion.id);
}

// The VAT a gross figure carries at the book's own standard rate, the same
// arithmetic calculators/ltd.js's sheetVat() applies to every sales and
// purchases line.
function vatOf(gross) {
  return (gross * VAT_RATE) / (1 + VAT_RATE);
}

function netOf(gross) {
  return gross - vatOf(gross);
}

const base = resultsFor(lines);

describe("the settlements the Precision Code Ltd book is missing", () => {
  it("finds every kind, over Ltd's own chart rather than SE's", () => {
    const counts = {};
    for (const suggestion of settlementSuggestions({ book, lines })) counts[suggestion.kind] = (counts[suggestion.kind] || 0) + 1;

    expect(counts).toEqual({
      "sale-from-receipt": 25,
      "purchase-from-payment": 19,
      "receipt-for-sale": 96,
      "payment-for-purchase": 367,
    });
  });

  // The bulk of these 507 are not a matching defect: "Various suppliers" and
  // "Various customers" bank lines settle many invoices in one lump the
  // counterparty+amount key cannot decompose, payroll (W), HMRC (RP), the
  // director's loan (DL) and card/cash transfers (X, BC, BB, K) never carry
  // a sales or purchases counterpart at all, and most of the smaller named
  // subscriptions and one-off purchases (GitHub, Costa Coffee, and so on)
  // were never individually reconciled to a bank line in this fixture. This
  // is a one-sided helper by design (T6's own docs: "each settlement helper
  // needs a book with exactly one unsettled half"), not a many-to-one
  // reconciler, so a book this size is expected to carry a long tail of
  // genuinely one-sided lines.
  it("Trainline's credit card charge on 2025-10-18 was Premier Inn's, mislabelled -- fixed at source, not papered over here", () => {
    const ids = settlementSuggestions({ book, lines }).map((s) => s.id);
    // TXN-0407 (credit card, £120, 2025-10-18) and TXN-0405 (a Premier Inn
    // purchase, same amount, same date) matched once the fixture's own
    // narrative was corrected -- before the fix, TXN-0407 carried "Trainline",
    // a name no £120 Trainline invoice exists to pair it with, while TXN-0405
    // sat unmatched under "Premier Inn" for want of a same-named receipt.
    expect(ids).not.toContain("purchase-from-payment:TXN-0407");
    expect(ids).not.toContain("payment-for-purchase:TXN-0405");
  });
});

// ============================== a receipt with no sale ==============================

describe("sale-from-receipt: the receipt from Acme Corp with no sale behind it", () => {
  const suggestion = settlementSuggestions({ book, lines }).find((candidate) => candidate.id === "sale-from-receipt:TXN-0044");

  it("is found, naming Ltd's own sales account rather than SE's", () => {
    expect(suggestion.changes[0]).toEqual({
      what: "sale",
      becomes: "4000 — Product A - Consultancy",
      amount: 7200,
      postingDate: "2024-04-10",
      counterparty: "Acme Corp",
    });
  });

  it("commits a sales line coded 4000, carrying the book's own VAT treatment", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    const added = settled[settled.length - 1];

    expect(added).toMatchObject({
      entryNumber: "SET-0001",
      sourceJournalID: "sales",
      accountMainID: "4000",
      amount: suggestion.changes[0].amount,
      taxCode: "S",
      taxRate: VAT_RATE,
    });
  });

  it("moves trade debtors and the output VAT return by the receipt's own amount", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    const after = resultsFor(settled);
    const amount = suggestion.changes[0].amount;

    expect(after.TrialBalance.EJ20).toBeCloseTo(base.TrialBalance.EJ20 + amount, 6);
    expect(after["Vatreturns.xlsx!VATQtr1"].G9).toBeCloseTo(base["Vatreturns.xlsx!VATQtr1"].G9 + vatOf(amount), 6);
    expect(after["Vatreturns.xlsx!VATQtr1"].G13).toBeCloseTo(base["Vatreturns.xlsx!VATQtr1"].G13 + vatOf(amount), 6);
    expect(after["Vatreturns.xlsx!VATQtr1"].G17).toBeCloseTo(base["Vatreturns.xlsx!VATQtr1"].G17 + vatOf(amount), 6);
    expect(after["Vatreturns.xlsx!VATQtr1"].G21).toBeCloseTo(base["Vatreturns.xlsx!VATQtr1"].G21 + netOf(amount), 6);
  });

  it("parts the balance sheet from the closing-debtors listing, which the new sale never reaches", () => {
    // book.debtors is a separate, declarative register (diya-gl-loader.js's
    // ledgerListing) that no line edit writes to, so the compliance check
    // comparing it to the balance sheet is now the one true mismatch this
    // settlement leaves -- the ledger-derived debtors check beside it
    // (fed straight from the same lines) still holds.
    const settled = applySettlement({ book, lines }, suggestion.id);
    expect(failingCheckNames(checksFor(settled))).toEqual(["Published balance sheet: trade debtors = closing debtors"]);
  });

  it("wants the sale again, and offers the new sale a receipt, once the two are a penny apart", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    const added = settled[settled.length - 1];

    expect(suggestionIds(settled)).not.toContain("sale-from-receipt:TXN-0044");
    expect(suggestionIds(settled)).not.toContain("receipt-for-sale:" + added.entryNumber);

    const shifted = changeLineAmount(book, settled, { entryNumber: added.entryNumber, newAmount: added.amount + 0.01 });
    expect(suggestionIds(shifted)).toContain("sale-from-receipt:TXN-0044");
    expect(suggestionIds(shifted)).toContain("receipt-for-sale:" + added.entryNumber);
  });
});

// ============================== a payment with no purchase ==============================

describe("purchase-from-payment: the payment to Various suppliers with no purchase behind it", () => {
  const suggestion = settlementSuggestions({ book, lines }).find((candidate) => candidate.id === "purchase-from-payment:TXN-0036");

  it("is found, naming Ltd's own purchases account rather than SE's", () => {
    expect(suggestion.changes[0]).toEqual({
      what: "purchase",
      becomes: "5000 — Direct materials for resale",
      amount: 2200,
      postingDate: "2024-04-05",
      counterparty: "Various suppliers",
    });
  });

  it("commits a purchases line coded 5000, carrying the book's own VAT treatment", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    const added = settled[settled.length - 1];

    expect(added).toMatchObject({
      entryNumber: "SET-0001",
      sourceJournalID: "purchases",
      accountMainID: "5000",
      amount: suggestion.changes[0].amount,
      taxCode: "S",
      taxRate: VAT_RATE,
    });
  });

  it("moves trade creditors and the input VAT return by the payment's own amount", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    const after = resultsFor(settled);
    const amount = suggestion.changes[0].amount;

    expect(after.TrialBalance.EJ28).toBeCloseTo(base.TrialBalance.EJ28 - amount, 6);
    expect(after["Vatreturns.xlsx!VATQtr1"].G15).toBeCloseTo(base["Vatreturns.xlsx!VATQtr1"].G15 + vatOf(amount), 6);
    expect(after["Vatreturns.xlsx!VATQtr1"].G17).toBeCloseTo(base["Vatreturns.xlsx!VATQtr1"].G17 - vatOf(amount), 6);
    expect(after["Vatreturns.xlsx!VATQtr1"].G23).toBeCloseTo(base["Vatreturns.xlsx!VATQtr1"].G23 + netOf(amount), 6);
  });

  it("keeps every compliance check green -- Ltd carries no closing-creditors listing check to part from the ledger", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    expect(failingCheckNames(checksFor(settled))).toEqual([]);
  });

  it("wants the purchase again, and offers the new purchase a payment, once the two are a penny apart", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    const added = settled[settled.length - 1];

    expect(suggestionIds(settled)).not.toContain("purchase-from-payment:TXN-0036");
    expect(suggestionIds(settled)).not.toContain("payment-for-purchase:" + added.entryNumber);

    const shifted = changeLineAmount(book, settled, { entryNumber: added.entryNumber, newAmount: added.amount + 0.01 });
    expect(suggestionIds(shifted)).toContain("purchase-from-payment:TXN-0036");
    expect(suggestionIds(shifted)).toContain("payment-for-purchase:" + added.entryNumber);
  });
});

// ============================== a sale that never reached the bank ==============================

describe("receipt-for-sale: the sale to FreshField Ltd that never reached the bank", () => {
  const suggestion = settlementSuggestions({ book, lines }).find((candidate) => candidate.id === "receipt-for-sale:TXN-0029");

  it("is found, naming Ltd's own current account rather than SE's", () => {
    expect(suggestion.changes[0]).toEqual({
      what: "receipt",
      becomes: "1200 — Current account",
      amount: 360,
      postingDate: "2024-04-03",
      counterparty: "FreshField Ltd",
    });
  });

  it("commits a bank receipt on 1200, coded DR", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    const added = settled[settled.length - 1];

    expect(added).toMatchObject({
      entryNumber: "SET-0001",
      sourceJournalID: "bank",
      debitCreditCode: "D",
      "diya-gl:bankCode": "DR",
      "diya-gl:bankAccountID": "1200",
      accountMainID: "1200",
      amount: suggestion.changes[0].amount,
    });
  });

  it("moves trade debtors down and the current account up by the sale's own amount, reaching no VAT return", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    const after = resultsFor(settled);
    const amount = suggestion.changes[0].amount;

    expect(after.TrialBalance.EJ20).toBeCloseTo(base.TrialBalance.EJ20 - amount, 6);
    expect(after.TrialBalance.EJ22).toBeCloseTo(base.TrialBalance.EJ22 + amount, 6);
    expect(after["Vatreturns.xlsx!VATQtr1"].G17).toBeCloseTo(base["Vatreturns.xlsx!VATQtr1"].G17, 6);
  });

  it("parts the balance sheet from the closing-debtors listing, the same one sale-from-receipt parts", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    expect(failingCheckNames(checksFor(settled))).toEqual(["Published balance sheet: trade debtors = closing debtors"]);
  });

  it("wants the receipt again, and offers the new receipt a sale, once the two are a penny apart", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    const added = settled[settled.length - 1];

    expect(suggestionIds(settled)).not.toContain("receipt-for-sale:TXN-0029");
    expect(suggestionIds(settled)).not.toContain("sale-from-receipt:" + added.entryNumber);

    const shifted = changeLineAmount(book, settled, { entryNumber: added.entryNumber, newAmount: added.amount + 0.01 });
    expect(suggestionIds(shifted)).toContain("receipt-for-sale:TXN-0029");
    expect(suggestionIds(shifted)).toContain("sale-from-receipt:" + added.entryNumber);
  });
});

// ============================== a purchase that never reached the bank ==============================

describe("payment-for-purchase: the purchase from GitHub that never reached the bank", () => {
  const suggestion = settlementSuggestions({ book, lines }).find((candidate) => candidate.id === "payment-for-purchase:TXN-0020");

  it("is found, naming Ltd's own current account rather than SE's", () => {
    expect(suggestion.changes[0]).toEqual({
      what: "payment",
      becomes: "1200 — Current account",
      amount: 45,
      postingDate: "2024-04-01",
      counterparty: "GitHub",
    });
  });

  it("commits a bank payment on 1200, coded CR", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    const added = settled[settled.length - 1];

    expect(added).toMatchObject({
      entryNumber: "SET-0001",
      sourceJournalID: "bank",
      debitCreditCode: "C",
      "diya-gl:bankCode": "CR",
      "diya-gl:bankAccountID": "1200",
      accountMainID: "1200",
      amount: suggestion.changes[0].amount,
    });
  });

  it("moves the current account down and trade creditors up by the purchase's own amount, reaching no VAT return", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    const after = resultsFor(settled);
    const amount = suggestion.changes[0].amount;

    expect(after.TrialBalance.EJ22).toBeCloseTo(base.TrialBalance.EJ22 - amount, 6);
    expect(after.TrialBalance.EJ28).toBeCloseTo(base.TrialBalance.EJ28 + amount, 6);
    expect(after["Vatreturns.xlsx!VATQtr1"].G17).toBeCloseTo(base["Vatreturns.xlsx!VATQtr1"].G17, 6);
  });

  it("keeps every compliance check green", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    expect(failingCheckNames(checksFor(settled))).toEqual([]);
  });

  it("wants the payment again, and offers the new payment a purchase, once the two are a penny apart", () => {
    const settled = applySettlement({ book, lines }, suggestion.id);
    const added = settled[settled.length - 1];

    expect(suggestionIds(settled)).not.toContain("payment-for-purchase:TXN-0020");
    expect(suggestionIds(settled)).not.toContain("purchase-from-payment:" + added.entryNumber);

    const shifted = changeLineAmount(book, settled, { entryNumber: added.entryNumber, newAmount: added.amount + 0.01 });
    expect(suggestionIds(shifted)).toContain("payment-for-purchase:TXN-0020");
    expect(suggestionIds(shifted)).toContain("purchase-from-payment:" + added.entryNumber);
  });
});
