// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// settlement-helpers.test.js -- the four settlement suggestions over the
// Self Employed BrickWork Pro book: a bank receipt with no sale behind it,
// a bank payment with no purchase, and a sale or purchase that never
// reached the bank. Each is applied through a named edit, and the effect is
// read off the recalculated report rather than off the suggestion that
// asked for it.
//
// No LibreOffice: this is the JS engine's own D-to-R loop, the same one
// export.js --file runs.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { settlementSuggestions, applySettlement, runBookChecks } from "../lib/book-checks.js";
import { addBankLine, changeLineAmount } from "../lib/diya-gl-edits.js";
import { buildFileReportDocument } from "../bin/export.js";
import { productModule } from "../lib/products.js";
import { createMethods } from "../lib/mcp/server.js";
import { createSession, loadIntoSession } from "../lib/mcp/diya-gl-tools.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const SE = productModule("se");

const TURNOVER = "cell/Financialaccounts.xlsx!Profit & Loss Account!B9";
const MATERIALS = "cell/Financialaccounts.xlsx!Profit & Loss Account!B14";
const PROFIT_BEFORE_TAX = "cell/Financialaccounts.xlsx!Profit & Loss Account!B39";
const BANK_CLOSING = "cell/Bank.xlsx!Mar!A2";

function brickworkNonVat() {
  const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, "examples", "brickwork-pro", "se-nonvat"));
  return { book, lines, taxData: extractTaxDataFromBook(book, "se") };
}

function reportOf(book, lines) {
  return buildFileReportDocument(book, lines, "se", SE);
}

function valueAt(document, key) {
  const entry = document.values.find((value) => value.key === key);
  if (!entry) throw new Error(`R carries no value for ${key}`);
  return Number(entry.value);
}

// Every key whose value the edit moved, and by how much.
function movementsBetween(before, after) {
  const was = new Map(before.values.map((value) => [value.key, value.value]));
  const moved = new Map();
  for (const value of after.values) {
    if (was.get(value.key) === value.value) continue;
    moved.set(value.key, Number(value.value) - Number(was.get(value.key)));
  }
  return moved;
}

function countByKind(suggestions) {
  const counts = {};
  for (const suggestion of suggestions) counts[suggestion.kind] = (counts[suggestion.kind] || 0) + 1;
  return counts;
}

function journalCount(lines, journal) {
  return lines.filter((line) => line.sourceJournalID === journal).length;
}

function verdictsOf(results) {
  return results.map((result) => [result.id, result.result]);
}

// A bank receipt from a customer the book has no invoice for. Its
// counterparty and amount match nothing already in the book, so it can only
// pair with a sale someone adds.
function unexplainedReceipt(overrides = {}) {
  return {
    "entryNumber": "TEST-RECEIPT-1",
    "sourceJournalID": "bank",
    "postingDate": "2025-06-15",
    "accountMainID": "1200",
    "amount": 480,
    "debitCreditCode": "D",
    "documentType": "bank-statement",
    "documentReference": "BNK-TEST-1",
    "detailComment": "Acme Builders",
    "lineItemComment": "Money in with no invoice behind it",
    "taxCode": "OS",
    "taxRate": 0,
    "diya-gl:bankCode": "DR",
    "diya-gl:bankAccountID": "1200",
    ...overrides,
  };
}

function unexplainedPayment(overrides = {}) {
  return {
    "entryNumber": "TEST-PAYMENT-1",
    "sourceJournalID": "bank",
    "postingDate": "2025-06-16",
    "accountMainID": "1200",
    "amount": 480,
    "debitCreditCode": "C",
    "documentType": "bank-statement",
    "documentReference": "BNK-TEST-2",
    "detailComment": "Acme Builders",
    "lineItemComment": "Money out with no invoice behind it",
    "taxCode": "OS",
    "taxRate": 0,
    "diya-gl:bankCode": "CR",
    "diya-gl:bankAccountID": "1200",
    ...overrides,
  };
}

// ============================== what the book is missing ==============================

describe("the settlements the BrickWork Pro sole trader book is missing", () => {
  it("banks a month at a time, so no half of any transaction is settled by another", () => {
    const { book, lines } = brickworkNonVat();
    const suggestions = settlementSuggestions({ book, lines });

    expect(countByKind(suggestions)).toEqual({
      "sale-from-receipt": 12,
      "purchase-from-payment": 12,
      "receipt-for-sale": 25,
      "payment-for-purchase": 58,
    });
    expect(suggestions).toHaveLength(107);
    // Every sale and every purchase in the book is unsettled, and so is
    // every receipt and payment: the twelve monthly bankings each cover a
    // month of invoices, which no single invoice can match.
    expect(countByKind(suggestions)["receipt-for-sale"]).toBe(journalCount(lines, "sales"));
    expect(countByKind(suggestions)["payment-for-purchase"]).toBe(journalCount(lines, "purchases"));
  });

  it("gives every suggestion an id its own kind and entry number make stable", () => {
    const { book, lines } = brickworkNonVat();
    const suggestions = settlementSuggestions({ book, lines });

    for (const suggestion of suggestions) {
      expect(suggestion.id).toBe(`${suggestion.kind}:${suggestion.entryNumber}`);
      expect(suggestion.changes).toHaveLength(1);
    }
    expect(new Set(suggestions.map((suggestion) => suggestion.id)).size).toBe(suggestions.length);
  });

  it("offers a book with no bank account in its chart nothing to bank through", () => {
    const { book, lines } = loadDiyaGlData(resolve(REPO_ROOT, "examples", "brickwork-pro", "bst-nonvat"));

    expect(settlementSuggestions({ book, lines })).toEqual([]);
  });
});

// ============================== a receipt with no sale ==============================

describe("making a sale from a receipt", () => {
  it("suggests exactly one sale, naming the receipt that has none", () => {
    const { book, lines } = brickworkNonVat();
    const before = settlementSuggestions({ book, lines });
    const withReceipt = addBankLine(book, lines, { line: unexplainedReceipt() });

    const after = settlementSuggestions({ book, lines: withReceipt });
    const added = after.filter((suggestion) => !before.some((existing) => existing.id === suggestion.id));

    expect(added).toHaveLength(1);
    expect(added[0]).toEqual({
      id: "sale-from-receipt:TEST-RECEIPT-1",
      kind: "sale-from-receipt",
      entryNumber: "TEST-RECEIPT-1",
      title: "Make a sale from this receipt",
      actionLabel: "Add the sale",
      changes: [
        {
          what: "sale",
          becomes: "4000 — Building work",
          amount: 480,
          postingDate: "2025-06-15",
          counterparty: "Acme Builders",
        },
      ],
    });
  });

  it("applying it adds one sales line, takes the suggestion away, and leaves every book check where it was", () => {
    const { book, lines, taxData } = brickworkNonVat();
    const withReceipt = addBankLine(book, lines, { line: unexplainedReceipt() });
    const wereFailing = verdictsOf(runBookChecks({ book, lines: withReceipt, taxData }).results);

    const settled = applySettlement({ book, lines: withReceipt }, "sale-from-receipt:TEST-RECEIPT-1");

    expect(settled).toHaveLength(withReceipt.length + 1);
    expect(journalCount(settled, "sales")).toBe(journalCount(withReceipt, "sales") + 1);
    expect(settled[settled.length - 1]).toMatchObject({
      entryNumber: "SET-0001",
      sourceJournalID: "sales",
      postingDate: "2025-06-15",
      accountMainID: "4000",
      amount: 480,
      detailComment: "Acme Builders",
      taxCode: "NA",
      taxRate: 0,
    });

    const stillSuggested = settlementSuggestions({ book, lines: settled }).map((suggestion) => suggestion.id);
    expect(stillSuggested).not.toContain("sale-from-receipt:TEST-RECEIPT-1");
    expect(stillSuggested).not.toContain("receipt-for-sale:SET-0001");
    expect(verdictsOf(runBookChecks({ book, lines: settled, taxData }).results)).toEqual(wereFailing);
  });

  it("wants the sale again once the receipt is a penny away from it", () => {
    const { book, lines } = brickworkNonVat();
    const withReceipt = addBankLine(book, lines, { line: unexplainedReceipt() });
    const settled = applySettlement({ book, lines: withReceipt }, "sale-from-receipt:TEST-RECEIPT-1");

    const shifted = changeLineAmount(book, settled, { entryNumber: "TEST-RECEIPT-1", newAmount: 480.01 });

    const ids = settlementSuggestions({ book, lines: shifted }).map((suggestion) => suggestion.id);
    expect(ids).toContain("sale-from-receipt:TEST-RECEIPT-1");
    expect(ids).toContain("receipt-for-sale:SET-0001");
  });

  it("moves turnover and profit by the receipt's amount and leaves the bank alone", () => {
    const { book, lines } = brickworkNonVat();
    const withReceipt = addBankLine(book, lines, { line: unexplainedReceipt() });
    const before = reportOf(book, withReceipt);

    const settled = applySettlement({ book, lines: withReceipt }, "sale-from-receipt:TEST-RECEIPT-1");
    const moved = movementsBetween(before, reportOf(book, settled));

    expect(moved.get(TURNOVER)).toBe(480);
    expect(moved.get(PROFIT_BEFORE_TAX)).toBe(480);
    expect(moved.has(BANK_CLOSING)).toBe(false);
  });
});

// ============================== a payment with no purchase ==============================

describe("making a purchase from a payment", () => {
  it("suggests exactly one purchase, naming the payment that has none", () => {
    const { book, lines } = brickworkNonVat();
    const before = settlementSuggestions({ book, lines });
    const withPayment = addBankLine(book, lines, { line: unexplainedPayment() });

    const after = settlementSuggestions({ book, lines: withPayment });
    const added = after.filter((suggestion) => !before.some((existing) => existing.id === suggestion.id));

    expect(added).toHaveLength(1);
    expect(added[0]).toEqual({
      id: "purchase-from-payment:TEST-PAYMENT-1",
      kind: "purchase-from-payment",
      entryNumber: "TEST-PAYMENT-1",
      title: "Make a purchase from this payment",
      actionLabel: "Add the purchase",
      changes: [
        {
          what: "purchase",
          becomes: "5000 — Building materials",
          amount: 480,
          postingDate: "2025-06-16",
          counterparty: "Acme Builders",
        },
      ],
    });
  });

  it("applying it adds one purchases line and takes the suggestion away", () => {
    const { book, lines, taxData } = brickworkNonVat();
    const withPayment = addBankLine(book, lines, { line: unexplainedPayment() });
    const wereFailing = verdictsOf(runBookChecks({ book, lines: withPayment, taxData }).results);

    const settled = applySettlement({ book, lines: withPayment }, "purchase-from-payment:TEST-PAYMENT-1");

    expect(journalCount(settled, "purchases")).toBe(journalCount(withPayment, "purchases") + 1);
    expect(settled[settled.length - 1]).toMatchObject({
      entryNumber: "SET-0001",
      sourceJournalID: "purchases",
      accountMainID: "5000",
      amount: 480,
      detailComment: "Acme Builders",
    });
    expect(settlementSuggestions({ book, lines: settled }).map((suggestion) => suggestion.id)).not.toContain(
      "purchase-from-payment:TEST-PAYMENT-1",
    );
    expect(verdictsOf(runBookChecks({ book, lines: settled, taxData }).results)).toEqual(wereFailing);
  });

  it("moves materials up and profit down by the payment's amount, leaving turnover alone", () => {
    const { book, lines } = brickworkNonVat();
    const withPayment = addBankLine(book, lines, { line: unexplainedPayment() });
    const before = reportOf(book, withPayment);

    const settled = applySettlement({ book, lines: withPayment }, "purchase-from-payment:TEST-PAYMENT-1");
    const moved = movementsBetween(before, reportOf(book, settled));

    expect(moved.get(MATERIALS)).toBe(480);
    expect(moved.get(PROFIT_BEFORE_TAX)).toBe(-480);
    expect(moved.has(TURNOVER)).toBe(false);
    expect(moved.has(BANK_CLOSING)).toBe(false);
  });
});

// ============================== an invoice that never reached the bank ==============================

describe("recording the bank entry an invoice never got", () => {
  it("suggests the receipt for a sale, and banking it moves the closing balance and nothing on the profit and loss", () => {
    const { book, lines } = brickworkNonVat();
    const sale = lines.find((line) => line.entryNumber === "TXN-0014");
    const before = reportOf(book, lines);

    const suggestion = settlementSuggestions({ book, lines }).find((candidate) => candidate.id === "receipt-for-sale:TXN-0014");
    expect(suggestion.title).toBe("Record the receipt for this sale");
    expect(suggestion.changes[0]).toEqual({
      what: "receipt",
      becomes: "1200 — Current account",
      amount: sale.amount,
      postingDate: sale.postingDate,
      counterparty: sale.detailComment,
    });

    const settled = applySettlement({ book, lines }, suggestion.id);
    expect(settled[settled.length - 1]).toMatchObject({
      "sourceJournalID": "bank",
      "debitCreditCode": "D",
      "diya-gl:bankCode": "DR",
      "diya-gl:bankAccountID": "1200",
      "amount": sale.amount,
      "postingDate": sale.postingDate,
    });

    const moved = movementsBetween(before, reportOf(book, settled));
    expect(moved.get(BANK_CLOSING)).toBeCloseTo(sale.amount, 6);
    expect([...moved.keys()].filter((key) => key.includes("Profit & Loss Account"))).toEqual([]);
  });

  it("suggests the payment for a purchase, and paying it takes the closing balance down", () => {
    const { book, lines } = brickworkNonVat();
    const purchase = lines.find((line) => line.entryNumber === "TXN-0009");
    const before = reportOf(book, lines);

    const suggestion = settlementSuggestions({ book, lines }).find((candidate) => candidate.id === "payment-for-purchase:TXN-0009");
    expect(suggestion.title).toBe("Record the payment for this purchase");
    expect(suggestion.changes[0].what).toBe("payment");

    const settled = applySettlement({ book, lines }, suggestion.id);
    expect(settled[settled.length - 1]).toMatchObject({
      "sourceJournalID": "bank",
      "debitCreditCode": "C",
      "diya-gl:bankCode": "CR",
      "amount": purchase.amount,
    });

    const moved = movementsBetween(before, reportOf(book, settled));
    expect(moved.get(BANK_CLOSING)).toBeCloseTo(-purchase.amount, 6);
    expect([...moved.keys()].filter((key) => key.includes("Profit & Loss Account"))).toEqual([]);
  });

  it("numbers a second settlement one past the first", () => {
    const { book, lines } = brickworkNonVat();
    const once = applySettlement({ book, lines }, "receipt-for-sale:TXN-0014");
    const twice = applySettlement({ book, lines: once }, "payment-for-purchase:TXN-0009");

    expect(once[once.length - 1].entryNumber).toBe("SET-0001");
    expect(twice[twice.length - 1].entryNumber).toBe("SET-0002");
  });

  it("refuses an id no suggestion carries", () => {
    const { book, lines } = brickworkNonVat();

    expect(() => applySettlement({ book, lines }, "receipt-for-sale:NOPE")).toThrow('No settlement called "receipt-for-sale:NOPE"');
  });
});

// ============================== addBankLine's own guards ==============================

describe("addBankLine", () => {
  it("names the field that fails", () => {
    const { book, lines } = brickworkNonVat();

    expect(() => addBankLine(book, lines, { line: unexplainedReceipt({ sourceJournalID: "purchases" }) })).toThrow(
      'addBankLine expects a line with sourceJournalID "bank", got "purchases"',
    );
    expect(() => addBankLine(book, lines, { line: unexplainedReceipt({ debitCreditCode: undefined }) })).toThrow(
      'addBankLine expects debitCreditCode "D" or "C", got "undefined"',
    );
    expect(() => addBankLine(book, lines, { line: unexplainedReceipt({ "diya-gl:bankAccountID": "1220" }) })).toThrow(
      'addBankLine expects a diya-gl:bankAccountID declared in the book\'s own chart, got "1220"',
    );
    expect(() => addBankLine(book, lines, { line: unexplainedReceipt({ "diya-gl:bankCode": "" }) })).toThrow(
      "addBankLine expects a diya-gl:bankCode naming the column the entry is analysed under",
    );
    expect(() => addBankLine(book, lines, { line: unexplainedReceipt({ amount: "480" }) })).toThrow(
      'addBankLine expects amount to be a number, got "480"',
    );
  });

  it("appends the line and leaves the book's own lines untouched", () => {
    const { book, lines } = brickworkNonVat();
    const withReceipt = addBankLine(book, lines, { line: unexplainedReceipt() });

    expect(withReceipt).toHaveLength(lines.length + 1);
    expect(withReceipt.slice(0, lines.length)).toEqual(lines);
  });
});

// ============================== through the MCP tool layer ==============================

function toolLayer(book, lines) {
  const session = createSession();
  loadIntoSession(session, book, lines);
  const methods = createMethods(session);
  return async function call(name, args) {
    const response = await methods["tools/call"]({ name, arguments: args });
    return response.structuredContent;
  };
}

describe("edit_lines carrying addBankLine", () => {
  it("is among the edits the tool declares, beside the six it joined", async () => {
    const { book, lines } = brickworkNonVat();
    const session = createSession();
    loadIntoSession(session, book, lines);
    const listed = await createMethods(session)["tools/list"]({});
    const editLines = listed.tools.find((tool) => tool.name === "edit_lines");

    expect(editLines.inputSchema.properties.edit.enum).toEqual(
      expect.arrayContaining([
        "addSaleLine",
        "addPurchaseLine",
        "addBankLine",
        "changeLineAmount",
        "removeLine",
        "changeLinePostingDate",
        "changeLineAccount",
      ]),
    );
  });

  it("banks 500 into the current account: the closing balance moves by 500 and the profit and loss does not", async () => {
    const { book, lines } = brickworkNonVat();
    const call = toolLayer(book, lines);

    const result = await call("edit_lines", {
      edit: "addBankLine",
      params: { line: unexplainedReceipt({ entryNumber: "TEST-BANK-500", amount: 500 }) },
    });

    const moved = result.movedFigures.find((entry) => entry.key === BANK_CLOSING);
    expect(moved.delta).toBe(500);
    expect(result.movedFigures.filter((entry) => entry.key.includes("Profit & Loss Account"))).toEqual([]);
    expect(valueAt(result.report, TURNOVER)).toBe(valueAt(reportOf(book, lines), TURNOVER));
  });

  it("refuses a bank account the book's chart does not declare, by name", async () => {
    const { book, lines } = brickworkNonVat();
    const call = toolLayer(book, lines);

    await expect(
      call("edit_lines", { edit: "addBankLine", params: { line: unexplainedReceipt({ "diya-gl:bankAccountID": "1220" }) } }),
    ).rejects.toThrow('addBankLine expects a diya-gl:bankAccountID declared in the book\'s own chart, got "1220"');
  });
});
