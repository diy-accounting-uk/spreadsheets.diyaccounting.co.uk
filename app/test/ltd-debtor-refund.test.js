// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ltd-debtor-refund.test.js -- a refund to a customer on a Limited Company
// book: a bank payment coded DR, behind a sales credit note. No Company bank
// workbook has a DR column on its payments block, so the refund lands in the
// receipts block under DR as a negative receipt (Dr trade debtors, Cr bank).
// The book check, the writer, the calculator and the workbook reader all
// agree on that one placement, and LibreOffice's own recalculation keeps the
// trial balance audit at zero.
//
// The LibreOffice block requires LibreOffice installed (brew install --cask libreoffice).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import { resolve, dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { loadDiyaGlData, diyaGlToScenario, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { calculateLtdCells } from "../lib/calculators/ltd.js";
import { addSaleLine, addBankLine } from "../lib/diya-gl-edits.js";
import { runBookChecks, settlementSuggestions } from "../lib/book-checks.js";
import { BANK_ACCOUNT_FILES, BANK_LAYOUTS, ltdBankPlacement, ltdBankEntryOfRow } from "../lib/ltd-layout.js";
import { runMultiFileSpreadsheet, hasLibreOffice } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { calculateExpectedTax } from "../lib/tax/income-tax.js";
import { cellWrites, standardReads, checkCompliance } from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(__dirname, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");

const REFUND = 4550;
const AUDIT_CHECK = "Trial Balance: audit accuracy (EJ91)";

const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "brickwork-pro", "ltd-nonvat"));
const invoice = lines.find((line) => line.entryNumber === "TXN-0014");

const creditNote = {
  ...invoice,
  entryNumber: "CN-REFUND-1",
  postingDate: "2025-05-14",
  documentType: "credit-note",
  documentReference: "CN-100",
  lineItemComment: "Credit note for the bricklaying work",
};
const refund = {
  "entryNumber": "REFUND-1",
  "sourceJournalID": "bank",
  "postingDate": "2025-05-15",
  "accountMainID": "1200",
  "debitCreditCode": "C",
  "amount": REFUND,
  "documentType": "bank-statement",
  "documentReference": "BNK-DR-REFUND",
  "detailComment": invoice.detailComment,
  "lineItemComment": "Refund of the credit note",
  "taxCode": "OS",
  "taxRate": 0,
  "diya-gl:bankCode": "DR",
  "diya-gl:bankAccountID": "1200",
};
const refunded = addBankLine(book, addSaleLine(book, lines, { line: creditNote }), { line: refund });

function resultsOf(bookLines) {
  return calculateFromDiyaGl(book, bookLines, "ltd", extractTaxDataFromBook(book, "ltd"), diyaGlToScenario(book, bookLines, "ltd"));
}

// The cell writes for one Currentaccount.xlsx month tab, and the receipt
// row carrying the refund.
function refundRowOf(writes) {
  const sheet = writes["Currentaccount.xlsx"].May;
  const { receipt } = BANK_LAYOUTS["Currentaccount.xlsx"];
  const row = Object.keys(sheet)
    .filter((key) => key.startsWith(receipt.amount) && /^\d+$/.test(key.slice(receipt.amount.length)))
    .map((key) => Number(key.slice(receipt.amount.length)))
    .find((r) => sheet[`${receipt.amount}${r}`] === -REFUND);
  return { sheet, row, receipt };
}

describe("where a refund lands in each Company bank workbook", () => {
  it("puts a DR payment in the receipts block, negated, on all four workbooks", () => {
    for (const fileName of Object.values(BANK_ACCOUNT_FILES)) {
      expect(ltdBankPlacement(fileName, false, "DR", REFUND)).toEqual({ receipt: true, amount: -REFUND, analysed: true });
    }
  });

  it("puts a CR receipt in the payments block, negated, on all four workbooks", () => {
    for (const fileName of Object.values(BANK_ACCOUNT_FILES)) {
      expect(ltdBankPlacement(fileName, true, "CR", REFUND)).toEqual({ receipt: false, amount: -REFUND, analysed: true });
    }
  });

  it("leaves every other code on its own side, and an unanalysed one unanalysed", () => {
    expect(ltdBankPlacement("Currentaccount.xlsx", true, "DR", REFUND)).toEqual({ receipt: true, amount: REFUND, analysed: true });
    expect(ltdBankPlacement("Currentaccount.xlsx", false, "CR", REFUND)).toEqual({ receipt: false, amount: REFUND, analysed: true });
    expect(ltdBankPlacement("Cashaccount.xlsx", true, "RV", REFUND).analysed).toBe(false);
  });

  it("reads a negative DR receipt row back as the refund, and a positive one as a receipt", () => {
    expect(ltdBankEntryOfRow(true, "DR", -REFUND)).toEqual({ debitCreditCode: "C", amount: REFUND });
    expect(ltdBankEntryOfRow(false, "CR", -REFUND)).toEqual({ debitCreditCode: "D", amount: REFUND });
    expect(ltdBankEntryOfRow(true, "DR", REFUND)).toEqual({ debitCreditCode: "D", amount: REFUND });
    expect(ltdBankEntryOfRow(true, "K", -REFUND)).toEqual({ debitCreditCode: "D", amount: -REFUND });
  });
});

describe("a debtor refund on the BrickWork Pro Company book", () => {
  it("passes book-ltd-bank-code-analysed", () => {
    const result = runBookChecks({ book, lines: refunded }).results.find((check) => check.id === "book-ltd-bank-code-analysed");
    expect(result.result).toBe("pass");
  });

  it("fails book-ltd-bank-code-analysed when a payment carries a code neither block analyses", () => {
    const unanalysed = refunded.map((line) => (line.entryNumber === "REFUND-1" ? { ...line, "diya-gl:bankCode": "K" } : line));
    const result = runBookChecks({ book, lines: unanalysed }).results.find((check) => check.id === "book-ltd-bank-code-analysed");
    expect(result.result).toBe("fail");
  });

  it("is written into the receipts block under DR with a negated amount", () => {
    const writes = cellWrites(diyaGlToScenario(book, refunded, "ltd"), 2025);
    const { sheet, row, receipt } = refundRowOf(writes);
    expect(row).toBeDefined();
    expect(sheet[`${receipt.code}${row}`]).toBe("DR");
  });

  it("lowers the month's DR receipts by the refund and keeps the trial balance audit at zero", () => {
    const cellsOf = (bookLines) =>
      calculateLtdCells(book, bookLines, extractTaxDataFromBook(book, "ltd"), diyaGlToScenario(book, bookLines, "ltd"))[
        "Currentaccount.xlsx!May"
      ];
    const after = resultsOf(refunded);
    const drColumn = Object.fromEntries(BANK_LAYOUTS["Currentaccount.xlsx"].receiptColumns).DR;
    const beforeMay = cellsOf(lines);
    const afterMay = cellsOf(refunded);
    expect(afterMay[`${drColumn}1`] - beforeMay[`${drColumn}1`]).toBeCloseTo(-REFUND, 6);
    expect(afterMay.F1 - beforeMay.F1).toBeCloseTo(-REFUND, 6);
    expect(Math.abs(after.TrialBalance.EJ91)).toBeLessThanOrEqual(1);
  });

  it("asks for no receipt against the credit note, and none for the refund", () => {
    const kinds = (bookLines) => settlementSuggestions({ book, lines: bookLines }).map((suggestion) => suggestion.id);
    const ids = kinds(refunded);
    expect(ids).not.toContain("receipt-for-sale:CN-REFUND-1");
    expect(ids.filter((id) => id.endsWith(":REFUND-1"))).toEqual([]);
  });
});

const describeCalc = hasLibreOffice() ? describe : describe.skip;

// The refund as it lands when the writer does not know DR is a refund: in
// the payments block, under a code that block has no column for. The bank
// is credited and nothing is debited, so the trial balance is out by the
// refund.
function writtenAsUnanalysedPayment(writes) {
  const { sheet, row, receipt } = refundRowOf(writes);
  const { payment } = BANK_LAYOUTS["Currentaccount.xlsx"];
  const paymentRows = Object.keys(sheet)
    .filter((key) => key.startsWith(payment.amount) && /^\d+$/.test(key.slice(payment.amount.length)))
    .map((key) => Number(key.slice(payment.amount.length)));
  const freeRow = Math.max(5, ...paymentRows) + 1;
  const broken = { ...writes, "Currentaccount.xlsx": { ...writes["Currentaccount.xlsx"], May: { ...sheet } } };
  const brokenSheet = broken["Currentaccount.xlsx"].May;
  for (const field of ["date", "source", "reference", "comment", "code", "amount"]) {
    if (brokenSheet[`${receipt[field]}${row}`] !== undefined)
      brokenSheet[`${payment[field]}${freeRow}`] = brokenSheet[`${receipt[field]}${row}`];
  }
  brokenSheet[`${payment.amount}${freeRow}`] = REFUND;
  // Close the gap the moved row leaves, so the receipts block stays contiguous.
  const receiptRows = Object.keys(sheet)
    .filter((key) => key.startsWith(receipt.amount) && /^\d+$/.test(key.slice(receipt.amount.length)))
    .map((key) => Number(key.slice(receipt.amount.length)))
    .sort((a, b) => a - b);
  const last = receiptRows[receiptRows.length - 1];
  for (let r = row; r < last; r++) {
    for (const field of ["date", "source", "reference", "comment", "code", "amount"]) {
      const next = sheet[`${receipt[field]}${r + 1}`];
      if (next === undefined) delete brokenSheet[`${receipt[field]}${r}`];
      else brokenSheet[`${receipt[field]}${r}`] = next;
    }
  }
  for (const field of ["date", "source", "reference", "comment", "code", "amount"]) delete brokenSheet[`${receipt[field]}${last}`];
  return broken;
}

describeCalc(
  "a debtor refund recalculated by LibreOffice",
  () => {
    let taxData;
    let scenario;
    let results;
    let brokenResults;
    const dirs = [];

    beforeAll(async () => {
      taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "ltd-2025.toml"), "utf8"));
      const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));
      const fileBuffers = {};
      for (const templateFile of productMeta.template.files) {
        const templateBuffer = readFileSync(resolve(LTD_DIR, templateFile));
        const fileKey = templateFile.replace(".xlsx", "").replace(".docx", "").toLowerCase();
        const sheetsConfig = productMeta.sheets?.[fileKey];
        fileBuffers[templateFile] =
          sheetsConfig && Object.keys(sheetsConfig).length > 0
            ? await generateSpreadsheet(templateBuffer, taxData, sheetsConfig)
            : templateBuffer;
      }
      scenario = diyaGlToScenario(book, refunded, "ltd");
      const writes = cellWrites(scenario, new Date(taxData.financial_year.start).getUTCFullYear());
      const run = (cellWritesToRun) => {
        const dir = mkdtempSync(join(tmpdir(), "ltd-debtor-refund-"));
        dirs.push(dir);
        return runMultiFileSpreadsheet(fileBuffers, cellWritesToRun, standardReads(), "Financialaccounts.xlsx", {
          saveRecalculatedTo: dir,
        });
      };
      [results, brokenResults] = await Promise.all([run(writes), run(writtenAsUnanalysedPayment(writes))]);
    }, 600000);

    afterAll(() => {
      for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    });

    const checksOf = (recalculated) =>
      checkCompliance(recalculated, { ...scenario, ...scenario.expected }, taxData, calculateExpectedTax).filter(
        (check) => check.name === AUDIT_CHECK,
      );

    it("keeps the trial balance audit at zero", () => {
      expect(Math.abs(results.TrialBalance.EJ91)).toBeLessThanOrEqual(1);
      const checks = checksOf(results);
      expect(checks.map((check) => check.name)).toEqual([AUDIT_CHECK]);
      expect(checks.every((check) => check.pass)).toBe(true);
    });

    it("leaves the trial balance audit out by the refund when it is written as an unanalysed payment", () => {
      expect(Math.abs(brokenResults.TrialBalance.EJ91)).toBeCloseTo(REFUND, 0);
      const failing = checksOf(brokenResults)
        .filter((check) => !check.pass)
        .map((check) => check.name);
      expect(failing).toEqual([AUDIT_CHECK]);
    });
  },
  600000,
);
