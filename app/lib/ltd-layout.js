// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd-layout.js — where the Limited Company package keeps things: which file
// each bank account is kept in, which columns a bank month tab analyses, and
// which columns the opening balance sheet splits fixed assets across.
//
// The writer (app/products/ltd.js) and the calculation engine
// (app/lib/calculators/ltd.js) both need this layout, and the engine runs in
// the browser bundle, so the layout cannot live in the writer: that module
// reaches the filesystem through spreadsheet-runner.js and xlsx-exporter.js.
// Nothing here touches the filesystem.

const BANK_ACCOUNT_FILES = {
  1200: "Currentaccount.xlsx",
  1210: "Savingaccount.xlsx",
  1220: "Cashaccount.xlsx",
  1230: "Creditcardaccount.xlsx",
};

// Transfer code letter each bank workbook stands for. A workbook analyses
// transfers under the other three letters; it never transfers to itself.
const BANK_TRANSFER_CODES = {
  "Currentaccount.xlsx": "BB",
  "Savingaccount.xlsx": "BS",
  "Cashaccount.xlsx": "BC",
  "Creditcardaccount.xlsx": "BD",
};

// The order the four transfer codes take across row 5 of every bank month
// tab, which is not the order BANK_TRANSFER_CODES declares them in. A book
// keeps this order with its own code dropped out.
const BANK_TRANSFER_COLUMN_ORDER = ["BB", "BS", "BD", "BC"];

export function nextColumn(column) {
  const letters = column.split("");
  let index = letters.length - 1;
  while (index >= 0) {
    if (letters[index] !== "Z") {
      letters[index] = String.fromCharCode(letters[index].charCodeAt(0) + 1);
      return letters.join("");
    }
    letters[index] = "A";
    index -= 1;
  }
  return `A${letters.join("")}`;
}

// The analysis columns a block runs across, one per code, starting at the
// column after the block's amount column.
function analysisColumns(amountColumn, codes) {
  let column = amountColumn;
  return codes.map((code) => {
    column = nextColumn(column);
    return [code, column];
  });
}

// Column layout of the receipts and payments blocks in each bank workbook's
// month tabs, and the code letters each block has an analysis column for.
// Cashaccount analyses fewer receipt codes than the three statement books,
// which shifts its payments block four columns to the left.
//
// reference and comment are two columns every one of the four workbooks
// keeps beside its receipts and payments that the writer never used to fill.
// reference is the invoice number column -- "Sales Invoice" on receipts (C),
// "Enter Purchase Invoice No." on payments. comment is the column beside it
// -- "Deposit Bank Reference" on receipts (D), "Cheque number Direct Debit"
// on Cashaccount's and the statement books' payments -- which the sheet
// keeps for the payer's own reference rather than a description, but is a
// real, otherwise-empty cell all the same, so a line's own free-text comment
// goes there.
//
// receiptCodes and paymentCodes are the codes a block analyses; receiptColumns
// and paymentColumns pair each with the column row 1 totals it in.
function bankLayout(fileName) {
  const transfers = BANK_TRANSFER_COLUMN_ORDER.filter((code) => code !== BANK_TRANSFER_CODES[fileName]);
  const cash = fileName === "Cashaccount.xlsx";
  const receipt = { date: "A", source: "B", reference: "C", comment: "D", code: "E", amount: "F" };
  const payment = cash
    ? { date: "P", source: "Q", reference: "R", comment: "S", code: "T", amount: "U" }
    : { date: "S", source: "T", reference: "U", comment: "V", code: "W", amount: "X" };
  const receiptCodes = cash
    ? [...transfers, "DR", "K", "LDR", "LCR", "DL"]
    : [...transfers, "DR", "K", "LDR", "LCR", "RV", "RC", "DL", "X"];
  const paymentCodes = cash
    ? [...transfers, "CR", "W", "B", "J", "LDR", "LCR", "RP", "RV", "RC", "RT", "DV", "DL"]
    : [...transfers, "CR", "W", "B", "J", "LDR", "LCR", "RP", "RV", "RC", "RT", "DV", "DL", "X"];
  return {
    receipt,
    payment,
    transfers,
    receiptCodes,
    paymentCodes,
    receiptColumns: analysisColumns(receipt.amount, receiptCodes),
    paymentColumns: analysisColumns(payment.amount, paymentCodes),
  };
}

const BANK_LAYOUTS = Object.fromEntries(Object.values(BANK_ACCOUNT_FILES).map((fileName) => [fileName, bankLayout(fileName)]));

// OpenAccounts row 13 splits opening fixed assets across cost (G:K) and
// depreciation (M:Q), one column per asset class.
const OPENING_FIXED_ASSET_COLUMNS = {
  land_buildings: { cost: "G", depreciation: "M" },
  plant_machinery: { cost: "H", depreciation: "N" },
  fixtures_fittings: { cost: "I", depreciation: "O" },
  computer_technology: { cost: "J", depreciation: "P" },
  motor_vehicles: { cost: "K", depreciation: "Q" },
};

export { BANK_ACCOUNT_FILES, BANK_LAYOUTS, BANK_TRANSFER_CODES, BANK_TRANSFER_COLUMN_ORDER, bankLayout, OPENING_FIXED_ASSET_COLUMNS };
