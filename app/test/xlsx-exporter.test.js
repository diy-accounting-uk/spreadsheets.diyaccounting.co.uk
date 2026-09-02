// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  ACCOUNT_ID_COLUMN,
  analysisHeadings,
  buildReverseCodeMap,
  extractBstTransactions,
  extractTaxiTransactions,
  extractBankTransactions,
  extractJournalEntries,
  extractPayrollTransactions,
  extractBook,
  normaliseLine,
  AdminSheetMissingError,
} from "../lib/xlsx-exporter.js";
import { buildSheetMap } from "../lib/spreadsheet-runner.js";
import { findXlsx } from "../lib/xlsx-reader.js";
import { validateBook, validateLines } from "../lib/diya-gl-schema.js";
import { BST_PURCHASE_CODE_MAP, LTD_PURCHASE_CODE_MAP, LTD_SALES_CODE_MAP } from "../lib/scenario-extractor.js";
import { CELL_MAP } from "../products/bst.js";
import { CELL_MAP as TAXI_CELL_MAP } from "../products/taxi.js";
import { CELL_MAP as LTD_CELL_MAP } from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const BST_LATEST = resolve(ROOT, "examples", "bst-latest");

// ── A workbook built cell by cell ──────────────────────────────────────────
//
// The exporter reads xlsx XML, so a test can hand it a workbook assembled
// here rather than one LibreOffice took a minute to produce. Values are
// written as literals: a number as <v>, a string inline, the same shape
// spreadsheet-runner's own writer produces.

function cellXml(reference, value) {
  // A cell the sheet works out for itself, carrying its formula and the
  // result cached beside it, which is what the exporter has to tell apart
  // from a figure somebody entered.
  if (value && typeof value === "object") return `<c r="${reference}"><f>${value.formula}</f><v>${value.value}</v></c>`;
  if (typeof value === "number") return `<c r="${reference}"><v>${value}</v></c>`;
  const escaped = String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<c r="${reference}" t="inlineStr"><is><t>${escaped}</t></is></c>`;
}

function sheetXml(cells) {
  const byRow = new Map();
  for (const [reference, value] of Object.entries(cells)) {
    const row = Number(/\d+$/.exec(reference)[0]);
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push(cellXml(reference, value));
  }
  const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([row, xml]) => `<row r="${row}">${xml.join("")}</row>`);
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`;
}

async function buildWorkbook(sheets) {
  const names = Object.keys(sheets);
  const zip = new JSZip();
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
      .map((name, index) => `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
      .join("")}</sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names
      .map((_, index) => `<Relationship Id="rId${index + 1}" Type="worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
      .join("")}</Relationships>`,
  );
  names.forEach((name, index) => zip.file(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheets[name])));
  return zip.generateAsync({ type: "nodebuffer" });
}

// 2025-04-07 as an Excel serial, the date every row below is posted on.
const APRIL_SEVENTH = 45754;

// The analysis block a BST purchases tab carries: one code letter a column in
// row 4, that column's heading in row 2.
const BST_PURCHASE_ANALYSIS = { J2: "Stock Purchases", K2: "Direct other costs", V2: "Other Expenses", J4: "S", K4: "D", V4: "O" };

function bstSheets({ purchaseRows = {}, salesRows = {} } = {}) {
  return {
    "Business Details": { C5: "BrickWork Pro", C7: "Bricklaying", C8: "12 Kiln Lane", C10: "Bakewell", C12: "DE45 1AA" },
    // B23 is the tax year label the generator writes as literal text
    // (buildCellEdits in generator.js); the export reads it back to find
    // which app/data/se-YYYY-YYYY.toml the tax tables below come from.
    // "2023-24" names app/data/se-2023-2024.toml, whose personal_allowance,
    // basic_rate and class2_weekly_rate feed the expectations below.
    "Admin": { B23: "2023-24" },
    "SalesApr": { A4: APRIL_SEVENTH, B4: "Beta Systems", F4: 1200, ...salesRows },
    "PurchasesApr": { ...BST_PURCHASE_ANALYSIS, A5: APRIL_SEVENTH, B5: "Acme Supplies", E5: "o", G5: 240, ...purchaseRows },
    "PurchasesStock": { D5: 10000, D30: 6000 },
  };
}

// ── Code maps ──────────────────────────────────────────────────────────────

describe("buildReverseCodeMap", () => {
  it("inverts BST purchase code map", () => {
    const reverse = buildReverseCodeMap(BST_PURCHASE_CODE_MAP);
    expect(reverse.s).toBe("5000");
    expect(reverse.d).toBe("5001");
    expect(reverse.f).toBe("5900");
  });

  it("uses first account for ambiguous codes", () => {
    const reverse = buildReverseCodeMap(BST_PURCHASE_CODE_MAP);
    // "o" maps from multiple accounts; should use the first one found
    expect(reverse.o).toBeDefined();
  });

  it("inverts Ltd sales code map", () => {
    const reverse = buildReverseCodeMap(LTD_SALES_CODE_MAP);
    expect(reverse.a).toBe("4000");
    expect(reverse.fs).toBe("4006");
  });

  it("inverts Ltd purchase code map", () => {
    const reverse = buildReverseCodeMap(LTD_PURCHASE_CODE_MAP);
    expect(reverse.s).toBe("5000");
    expect(reverse.fa).toBe("5900");
  });
});

describe("normaliseLine", () => {
  it("normalises a line for comparison", () => {
    const line = {
      sourceJournalID: "sales",
      postingDate: "2025-04-01",
      accountMainID: 4000,
      amount: 1234.567,
      detailComment: "Test",
      extra: "ignored",
    };
    const normalised = normaliseLine(line);
    expect(normalised.accountMainID).toBe("4000"); // string
    expect(normalised.amount).toBe(1234.57); // rounded to 2dp
    expect(normalised.extra).toBeUndefined(); // stripped
  });
});

// ── Account identity ───────────────────────────────────────────────────────

describe("account identity through the workbook", () => {
  it("keeps the account a row was written with, not the first its code letter names", async () => {
    // 5300, 5301 and 5002 all reach BST as the code letter "o". Without the
    // carrier column each row comes back as whichever account the reverse map
    // met first, and the three become one.
    const buffer = await buildWorkbook(
      bstSheets({
        purchaseRows: {
          [`${ACCOUNT_ID_COLUMN}5`]: "5301",
          A6: APRIL_SEVENTH,
          B6: "Bell Hire",
          E6: "o",
          G6: 90,
          [`${ACCOUNT_ID_COLUMN}6`]: "5300",
          A7: APRIL_SEVENTH,
          B7: "Cove Ltd",
          E7: "o",
          G7: 60,
        },
      }),
    );
    const purchases = (await extractBstTransactions(buffer)).filter((line) => line.sourceJournalID === "purchases");
    expect(purchases.map((line) => line.accountMainID)).toEqual(["5301", "5300", "5002"]);
  });

  it("falls back to the code letter for a book filled in by hand", async () => {
    const buffer = await buildWorkbook(bstSheets());
    const purchases = (await extractBstTransactions(buffer)).filter((line) => line.sourceJournalID === "purchases");
    expect(purchases[0].accountMainID).toBe(buildReverseCodeMap(BST_PURCHASE_CODE_MAP).o);
  });

  it("keeps a sales row's own income account", async () => {
    const buffer = await buildWorkbook(bstSheets({ salesRows: { [`${ACCOUNT_ID_COLUMN}4`]: "4003" } }));
    const sales = (await extractBstTransactions(buffer)).filter((line) => line.sourceJournalID === "sales");
    expect(sales[0].accountMainID).toBe("4003");
  });
});

describe("fields the sheets carry", () => {
  it("reads back the invoice reference both journals have a column for", async () => {
    const buffer = await buildWorkbook(bstSheets({ purchaseRows: { C5: "INV-4471" }, salesRows: { C4: "SI-0012" } }));
    const lines = await extractBstTransactions(buffer);
    expect(lines.find((line) => line.sourceJournalID === "sales").documentReference).toBe("SI-0012");
    expect(lines.find((line) => line.sourceJournalID === "purchases").documentReference).toBe("INV-4471");
  });

  it("leaves a field the sheet holds nothing for off the line rather than writing it empty", async () => {
    const buffer = await buildWorkbook(bstSheets());
    const line = (await extractBstTransactions(buffer))[0];
    expect(line).not.toHaveProperty("documentReference");
    expect(Object.values(line).every((value) => value !== null)).toBe(true);
  });
});

// ── The settlement column (D) ──────────────────────────────────────────────
//
// Sales!D and Purchases!D are the free-text "Receipt record Cash, Bank
// deposit, Dr Cr Card" column the outstanding formula (Sales!H4 = IF(D4>0,
// " ", F4) shaped) only ever tests for blank-or-not. The writer puts one of
// two words there (paymentLabel() in scenario-extractor.js), and the export
// reads the same two-way split back into a diya-gl:paymentMethod rather than
// guessing a finer value from whatever word a hand-filled book carries.
describe("the settlement column (Sales/Purchases D)", () => {
  it("reads the writer's own Bank label back as bank-transfer", async () => {
    const buffer = await buildWorkbook(bstSheets({ salesRows: { D4: "Bank" }, purchaseRows: { D5: "Bank" } }));
    const lines = await extractBstTransactions(buffer);
    expect(lines.find((line) => line.sourceJournalID === "sales").paymentMethod).toBe("bank-transfer");
    expect(lines.find((line) => line.sourceJournalID === "purchases").paymentMethod).toBe("bank-transfer");
  });

  it("reads the writer's own Cash label back as cash", async () => {
    const buffer = await buildWorkbook(bstSheets({ salesRows: { D4: "Cash" }, purchaseRows: { D5: "Cash" } }));
    const lines = await extractBstTransactions(buffer);
    expect(lines.find((line) => line.sourceJournalID === "sales").paymentMethod).toBe("cash");
    expect(lines.find((line) => line.sourceJournalID === "purchases").paymentMethod).toBe("cash");
  });

  it("leaves paymentMethod off a row still outstanding, whose D cell is blank", async () => {
    const buffer = await buildWorkbook(bstSheets());
    const lines = await extractBstTransactions(buffer);
    expect(lines.find((line) => line.sourceJournalID === "sales")).not.toHaveProperty("paymentMethod");
    expect(lines.find((line) => line.sourceJournalID === "purchases")).not.toHaveProperty("paymentMethod");
  });

  it("coarse-maps a hand-typed finer word to bank-transfer rather than guessing a finer diya-gl:paymentMethod", async () => {
    const buffer = await buildWorkbook(bstSheets({ salesRows: { D4: "Dr Cr Card" }, purchaseRows: { D5: "Cheque" } }));
    const lines = await extractBstTransactions(buffer);
    expect(lines.find((line) => line.sourceJournalID === "sales").paymentMethod).toBe("bank-transfer");
    expect(lines.find((line) => line.sourceJournalID === "purchases").paymentMethod).toBe("bank-transfer");
  });

  it("is driven by D alone: breaking only that cell moves only paymentMethod on that one line", async () => {
    const unpaid = await extractBstTransactions(await buildWorkbook(bstSheets()));
    const paid = await extractBstTransactions(await buildWorkbook(bstSheets({ salesRows: { D4: "Bank" } })));
    const [unpaidSale] = unpaid.filter((line) => line.sourceJournalID === "sales");
    const [paidSale] = paid.filter((line) => line.sourceJournalID === "sales");
    const changedKeys = new Set([...Object.keys(unpaidSale), ...Object.keys(paidSale)].filter((key) => unpaidSale[key] !== paidSale[key]));
    expect(changedKeys).toEqual(new Set(["paymentMethod"]));
    // Every other line on the workbook -- the purchase row D5 was never
    // touched -- is untouched too.
    expect(unpaid.filter((line) => line.sourceJournalID === "purchases")).toEqual(paid.filter((line) => line.sourceJournalID === "purchases"));
  });
});

// ── The chart of accounts ──────────────────────────────────────────────────

describe("analysisHeadings", () => {
  it("reads each code letter's own column heading off the sheet", () => {
    const xml = sheetXml({ J2: "Stock Purchases", K3: "Direct Materials", J4: "S", K4: "D", A4: 45754 });
    expect(analysisHeadings(xml, [])).toEqual({
      s: { column: "J", heading: "Stock Purchases" },
      d: { column: "K", heading: "Direct Materials" },
    });
  });

  it("prefers the more specific heading row where the sheet carries both", () => {
    const xml = sheetXml({ T2: "Premises ", T3: "Rent & Rates", T4: "R" });
    expect(analysisHeadings(xml, []).r).toEqual({ column: "T", heading: "Rent & Rates" });
  });
});

// ── The exported book ──────────────────────────────────────────────────────

describe("extractBook", () => {
  async function exportedBook() {
    const dir = mkdtempSync(join(tmpdir(), "xlsx-exporter-book-"));
    const buffer = await buildWorkbook(bstSheets({ purchaseRows: { [`${ACCOUNT_ID_COLUMN}5`]: "5301" } }));
    writeFileSync(join(dir, "book.xlsx"), buffer);
    const lines = await extractBstTransactions(buffer);
    return { book: await extractBook(dir, "bst", lines, CELL_MAP), lines };
  }

  it("conforms to the published v2 book schema", async () => {
    const { book } = await exportedBook();
    const result = validateBook(book);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("declares every account the exported lines name", async () => {
    const { book, lines } = await exportedBook();
    expect(validateLines(lines, book).errors).toEqual([]);
    expect(book.accounts.purchases["5301"]).toBeDefined();
    expect(book.accounts.sales["4000"]).toBeDefined();
  });

  it("names each account from the sheet's own analysis column heading", async () => {
    const { book } = await exportedBook();
    expect(book.accounts.purchases["5301"]).toEqual({ "accountMainDescription": "Other Expenses", "diya-gl:column": "V" });
  });

  it("carries the company's own details off the sheet it keeps them on", async () => {
    const { book } = await exportedBook();
    expect(book.entityInformation).toMatchObject({
      organizationIdentifier: "BrickWork Pro",
      organizationDescription: "Bricklaying",
      organizationAddressLine: "12 Kiln Lane",
      organizationTown: "Bakewell",
      organizationPostcode: "DE45 1AA",
    });
  });

  it("reads the year's tax data back off the Admin sheet", async () => {
    const { book } = await exportedBook();
    expect(book.tax.incomeTax.basicRate).toBe(0.2);
    expect(book.tax.incomeTax.personalAllowance).toBe(12570);
  });

  it("carries the National Insurance rates under the book schema's own names", async () => {
    // app/data/se-2023-2024.toml's national_insurance fields land under the
    // book schema's own names (class2WeeklyRate, class4MainRate, ...), so
    // the exported book states them and still validates.
    const { book } = await exportedBook();
    expect(book.tax.nationalInsurance).toMatchObject({ class2WeeklyRate: 3.45 });
    expect(validateBook(book).valid).toBe(true);
  });

  it("carries the stock the sheet was filled in with", async () => {
    const { book } = await exportedBook();
    expect(book.stock).toEqual({ openingValue: 10000, closingValue: 6000 });
  });

  it("states the accounting period the postings fall in", async () => {
    const { book } = await exportedBook();
    expect(book.documentInfo.periodCoveredStart).toBe("2025-04-01");
    expect(book.documentInfo.periodCoveredEnd).toBe("2026-03-31");
  });
});

// ── The figures the sheets carry undated ───────────────────────────────────
//
// An opening balance and a year-end stock count are entered as bare amounts,
// with no date cell beside either one. Both are dated by the period the
// package covers, so a workbook that banks nothing in its first month, or
// banks late, still brings its opening balance back on the day it was
// brought forward.

const LTD_PERIOD = { start: "2025-04-01", end: "2026-03-31" };
// 2025-04-22 as an Excel serial: a receipt three weeks into the first month.
const APRIL_TWENTY_SECOND = 45769;

async function writePackage(workbooks) {
  const dir = mkdtempSync(join(tmpdir(), "xlsx-exporter-period-"));
  for (const [name, sheets] of Object.entries(workbooks)) {
    writeFileSync(join(dir, name), await buildWorkbook(sheets));
  }
  return dir;
}

describe("extractBankTransactions — the opening balance in A1", () => {
  it("dates the balance by the period, not by the first row the account banks", async () => {
    const dir = await writePackage({
      "Currentaccount.xlsx": {
        Apr: { A1: 25000, A6: APRIL_TWENTY_SECOND, B6: "Acme Corp", E6: "DR", F6: 8000 },
        May: { A1: { formula: "Apr!A1+Apr!F1", value: 33000 } },
      },
    });
    const lines = await extractBankTransactions(dir, "ltd", LTD_PERIOD);

    const opening = lines.filter((line) => line["diya-gl:bankCode"] === "BC");
    expect(opening).toHaveLength(1);
    expect(opening[0]).toMatchObject({ postingDate: "2025-04-01", accountMainID: "1200", amount: 25000, debitCreditCode: "D" });
    expect(lines.find((line) => line["diya-gl:bankCode"] === "DR").postingDate).toBe("2025-04-22");
  });

  it("brings back the balance of an account that banks nothing in the period's first month", async () => {
    const dir = await writePackage({
      "Savingaccount.xlsx": { Apr: { A1: 5000 }, May: { A1: { formula: "Apr!A1", value: 5000 } } },
      "Cashaccount.xlsx": { Apr: { A1: 500 }, May: { A1: { formula: "Apr!A1", value: 500 } } },
    });
    const lines = await extractBankTransactions(dir, "ltd", LTD_PERIOD);

    expect(lines.map((line) => [line.accountMainID, line.amount, line.postingDate])).toEqual([
      ["1210", 5000, "2025-04-01"],
      ["1220", 500, "2025-04-01"],
    ]);
  });

  it("takes no balance from a tab that only carries the one before it forward", async () => {
    const dir = await writePackage({
      "Creditcardaccount.xlsx": { Apr: {}, May: { A1: { formula: "Apr!A1", value: 500 } } },
    });
    expect(await extractBankTransactions(dir, "ltd", LTD_PERIOD)).toEqual([]);
  });
});

describe("extractJournalEntries — the Ltd stock movement", () => {
  const openAccounts = { E15: 10000, E33: 100 };

  it("posts the fall from the opening figure to the year-end count against cost of sales", async () => {
    const dir = await writePackage({
      "Financialaccounts.xlsx": { OpenAccounts: openAccounts, Stock: { AB30: 6000 } },
    });
    const movement = (await extractJournalEntries(dir, "ltd", LTD_PERIOD)).filter((line) => line.documentReference === "JNL-001");

    expect(movement.map((line) => [line.accountMainID, line.debitCreditCode, line.amount, line.postingDate])).toEqual([
      ["1100", "C", 4000, "2026-03-31"],
      ["5000", "D", 4000, "2026-03-31"],
    ]);
  });

  it("turns the pair round when the year ends holding more stock than it opened with", async () => {
    const dir = await writePackage({
      "Financialaccounts.xlsx": { OpenAccounts: openAccounts, Stock: { AB30: 14000 } },
    });
    const movement = (await extractJournalEntries(dir, "ltd", LTD_PERIOD)).filter((line) => line.documentReference === "JNL-001");

    expect(movement.map((line) => [line.accountMainID, line.debitCreditCode, line.amount])).toEqual([
      ["1100", "D", 4000],
      ["5000", "C", 4000],
    ]);
  });

  it("posts nothing where the count matches the opening figure", async () => {
    const dir = await writePackage({
      "Financialaccounts.xlsx": { OpenAccounts: openAccounts, Stock: { AB30: 10000 } },
    });
    const lines = await extractJournalEntries(dir, "ltd", LTD_PERIOD);

    expect(lines.some((line) => line.documentReference === "JNL-001")).toBe(false);
    expect(lines.map((line) => line.postingDate)).toEqual(["2025-04-01", "2025-04-01"]);
  });
});

describe("extractJournalEntries — the Ltd opening balance sheet's land and buildings", () => {
  it("carries both the cost and the accumulated depreciation leg", async () => {
    const dir = await writePackage({
      "Financialaccounts.xlsx": { OpenAccounts: { G13: 200000, M13: 40000 } },
    });
    const lines = await extractJournalEntries(dir, "ltd", LTD_PERIOD);

    expect(lines.map((line) => [line.accountMainID, line.debitCreditCode, line.amount])).toEqual([
      ["0000", "D", 200000],
      ["0000", "C", 40000],
    ]);
  });

  it("drops the accumulated depreciation leg alone when the account holds nothing but cost", async () => {
    const dir = await writePackage({
      "Financialaccounts.xlsx": { OpenAccounts: { G13: 200000 } },
    });
    const lines = await extractJournalEntries(dir, "ltd", LTD_PERIOD);

    expect(lines.map((line) => [line.accountMainID, line.debitCreditCode, line.amount])).toEqual([["0000", "D", 200000]]);
  });
});

// ── The shipped example ────────────────────────────────────────────────────

const hasBstLatest = existsSync(BST_LATEST) && findXlsx(BST_LATEST) !== null;

describe.skipIf(!hasBstLatest)("extractBstTransactions — BST latest example", () => {
  it("extracts sales and purchase lines from populated xlsx", async () => {
    const xlsxBuffer = readFileSync(resolve(BST_LATEST, findXlsx(BST_LATEST)));
    const lines = await extractBstTransactions(xlsxBuffer);

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((line) => line.sourceJournalID === "sales").length).toBeGreaterThan(0);
    expect(lines.filter((line) => line.sourceJournalID === "purchases").length).toBeGreaterThan(0);
  });

  it("extracts valid dates and amounts", async () => {
    const xlsxBuffer = readFileSync(resolve(BST_LATEST, findXlsx(BST_LATEST)));
    const lines = await extractBstTransactions(xlsxBuffer);

    for (const line of lines.slice(0, 5)) {
      expect(line.postingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof line.amount).toBe("number");
      expect(line.amount).toBeGreaterThan(0);
    }
  });
});

// ── Taxi Driver transactions ───────────────────────────────────────────────

// 2025-04-06, the first day of the tax year the Taxi Sales tabs are laid out
// against, and the day the week below opens on.
const TAXI_FIRST_DAY = 45753;

// The approved mileage rates the generator injects into the Taxi Admin sheet:
// the first ten thousand business miles at 45p, the rest at 25p.
const TAXI_MILEAGE_RATES = { F21: 10000, G21: 0.45, F22: 10000, G22: 0.25 };

// The analysis block a Taxi purchases tab carries: one code letter a column
// in row 4, that column's heading in row 2 or 3.
const TAXI_PURCHASE_ANALYSIS = { G3: "Fuel & Oil Expenses", S2: "Fixed Assets Motor Vehicles", G4: "D", S4: "F" };

// One week of a Taxi Sales tab: two days of trade, then the rental and
// other-income rows the week is summed with, then the subtotal row. The
// subtotal's date cells carry a formula the sheet works out, which is what
// stops it reading as a third day.
function taxiSheets({ salesRows = {}, purchaseRows = {} } = {}) {
  const carried = { formula: "SUM(E5:E8)", value: TAXI_FIRST_DAY };
  return {
    "Business Details": { C5: "SP Sixty Driving", C7: "Private hire and taxi driving services" },
    "Admin": { ...TAXI_MILEAGE_RATES },
    "SalesApr": {
      A5: TAXI_FIRST_DAY,
      B5: TAXI_FIRST_DAY,
      D5: 94,
      E5: 174,
      A6: TAXI_FIRST_DAY + 1,
      B6: TAXI_FIRST_DAY + 1,
      D6: 112,
      E6: 198,
      A7: TAXI_FIRST_DAY + 1,
      B7: "Rental due",
      E7: 300,
      A8: TAXI_FIRST_DAY + 1,
      B8: "Any other income",
      E8: 50,
      A9: carried,
      B9: carried,
      E9: { formula: "SUM(E5:E8)", value: 722 },
      ...salesRows,
    },
    "PurchasesApr": {
      ...TAXI_PURCHASE_ANALYSIS,
      A5: TAXI_FIRST_DAY,
      B5: "Shell",
      D5: "d",
      F5: 52,
      ...purchaseRows,
    },
  };
}

const taxiJournal = async (sheets, journal) =>
  (await extractTaxiTransactions(await buildWorkbook(sheets))).filter((line) => line.sourceJournalID === journal);

describe("extractTaxiTransactions — the Sales week", () => {
  it("takes a day's takings and the miles driven to earn them", async () => {
    const sales = await taxiJournal(taxiSheets(), "sales");
    expect(sales.map((line) => [line.postingDate, line.amount, line.measurableQuantity, line.measurableUnitOfMeasure])).toEqual([
      ["2025-04-06", 174, 94, "miles"],
      ["2025-04-07", 198, 112, "miles"],
    ]);
  });

  it("leaves the rental, other-income and subtotal rows to the week's own arithmetic", async () => {
    const sales = await taxiJournal(taxiSheets(), "sales");
    expect(sales.map((line) => line.amount)).not.toContain(300);
    expect(sales.map((line) => line.amount)).not.toContain(50);
    expect(sales.map((line) => line.amount)).not.toContain(722);
  });

  it("counts a day driven with no fare as a posting carrying its miles", async () => {
    const sheets = taxiSheets();
    delete sheets.SalesApr.E6;
    const sales = await taxiJournal(sheets, "sales");
    expect(sales[1]).toMatchObject({ amount: 0, measurableQuantity: 112 });
  });

  it("posts the day to the one income account the taxi chart keeps", async () => {
    const sales = await taxiJournal(taxiSheets(), "sales");
    expect(sales.every((line) => line.accountMainID === "4000")).toBe(true);
  });

  it("keeps a row's own income account where the sheet carries one", async () => {
    const sales = await taxiJournal(taxiSheets({ salesRows: { [`${ACCOUNT_ID_COLUMN}5`]: "4001" } }), "sales");
    expect(sales[0].accountMainID).toBe("4001");
  });
});

describe("extractTaxiTransactions — the Purchases block", () => {
  it("reads the date, supplier, code letter and amount off the row", async () => {
    const purchases = await taxiJournal(taxiSheets(), "purchases");
    expect(purchases).toEqual([
      {
        sourceJournalID: "purchases",
        postingDate: "2025-04-06",
        accountMainID: "5100",
        amount: 52,
        detailComment: "Shell",
        entryNumber: "EXP-0003",
      },
    ]);
  });

  it("reads back the invoice reference the purchases tab has a column for", async () => {
    const purchases = await taxiJournal(taxiSheets({ purchaseRows: { C5: "AMZ-0510" } }), "purchases");
    expect(purchases[0].documentReference).toBe("AMZ-0510");
  });

  it("falls to other expenses for a code letter the chart does not name", async () => {
    const purchases = await taxiJournal(taxiSheets({ purchaseRows: { D5: "z" } }), "purchases");
    expect(purchases[0].accountMainID).toBe("6200");
  });

  it("prices a mileage claim against every mile claimed ahead of it, the Sales tab's included", async () => {
    // 206 miles come off the Sales tab first, so 9,900 more cross the
    // higher-rate limit at 10,000: 9,794 at 45p and 106 at 25p. Priced on
    // the purchase journal alone the same row would claim 9,900 at 45p.
    const purchases = await taxiJournal(
      taxiSheets({ purchaseRows: { A6: TAXI_FIRST_DAY + 2, B6: "Mileage claim", D6: "d", E6: 9900 } }),
      "purchases",
    );
    expect(purchases[1]).toMatchObject({
      amount: 4433.8,
      documentType: "mileage-log",
      measurableQuantity: 9900,
      measurableUnitOfMeasure: "miles",
    });
  });

  it("claims a later mileage row wholly at the lower rate once the limit is passed", async () => {
    const purchases = await taxiJournal(
      taxiSheets({
        purchaseRows: {
          A6: TAXI_FIRST_DAY + 2,
          B6: "Mileage claim",
          D6: "d",
          E6: 9900,
          A7: TAXI_FIRST_DAY + 3,
          B7: "Mileage claim",
          D7: "d",
          E7: 100,
        },
      }),
      "purchases",
    );
    expect(purchases[2].amount).toBe(25);
  });

  it("leaves the sheet's own analysis total out of the journal", async () => {
    // The analysis columns restate a row's amount under its code letter, and
    // a mileage claim is priced in a column of its own. Neither is an entry.
    const purchases = await taxiJournal(taxiSheets({ purchaseRows: { F5: { formula: 'IF(D5="d",F5," ")', value: 52 } } }), "purchases");
    expect(purchases).toEqual([]);
  });
});

describe("extractTaxiTransactions — the exported book", () => {
  async function exportedTaxiBook(sheets = taxiSheets()) {
    const dir = mkdtempSync(join(tmpdir(), "xlsx-exporter-taxi-"));
    const buffer = await buildWorkbook(sheets);
    writeFileSync(join(dir, "book.xlsx"), buffer);
    const lines = await extractTaxiTransactions(buffer);
    return { book: await extractBook(dir, "taxi", lines, TAXI_CELL_MAP), lines };
  }

  it("conforms to the published v2 book schema and declares every account its lines name", async () => {
    const { book, lines } = await exportedTaxiBook();
    expect(validateBook(book).errors).toEqual([]);
    expect(validateLines(lines, book).errors).toEqual([]);
  });

  it("keeps the taxi chart's fixed assets among the purchases, not the assets", async () => {
    // The taxi chart codes fixed assets to 7000, which is outside the range
    // the other three products' purchase accounts sit in.
    const { book } = await exportedTaxiBook(taxiSheets({ purchaseRows: { A6: TAXI_FIRST_DAY + 2, B6: "Amazon", D6: "f", F6: 200 } }));
    expect(book.accounts.purchases["7000"]).toEqual({ "accountMainDescription": "Fixed Assets Motor Vehicles", "diya-gl:column": "S" });
    expect(book.accounts.assets).toBeUndefined();
  });
});

// ── The payslip block a month tab puts under its weekly blocks ─────────────
//
// A month tab stacks one ten-row block per tax week from row 8, then the
// monthly payroll block below them, so the block starts at row 48 in a
// four-week month, 58 in a five-week one and 68 in the six-week last month.
// The exporter has to follow the month's own layout: a fixed-row read brings
// back the four-week months and silently loses the rest.

const PAYSLIP_MONTH_TABS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

// One employee's line on a month's block, plus the wages-paid date above it.
function payslipBlock(blockRow, { paidOn, name, grossPay, incomeTax, employeeNI, netPay, employerNI, reference }) {
  return {
    [`M${blockRow + 1}`]: paidOn,
    [`F${blockRow + 3}`]: name,
    [`M${blockRow + 3}`]: grossPay,
    [`N${blockRow + 3}`]: incomeTax,
    [`O${blockRow + 3}`]: employeeNI,
    [`R${blockRow + 3}`]: netPay,
    [`S${blockRow + 3}`]: reference,
    [`T${blockRow + 3}`]: employerNI,
  };
}

async function exportedPayroll(blocksByTab) {
  const dir = mkdtempSync(join(tmpdir(), "xlsx-exporter-payslips-"));
  const sheets = { Employee: {} };
  for (const tab of PAYSLIP_MONTH_TABS) sheets[tab] = blocksByTab[tab] || {};
  writeFileSync(join(dir, "Payslips.xlsx"), await buildWorkbook(sheets));
  return extractPayrollTransactions(dir);
}

describe("extractPayrollTransactions — the month's own block row", () => {
  const employee = {
    name: "Alice Johnson",
    grossPay: 3500,
    incomeTax: 530,
    employeeNI: 200,
    netPay: 2770,
    employerNI: 382.5,
    reference: "PAY-EMP001",
  };

  it("reads a four-week month's block from row 48", async () => {
    const lines = await exportedPayroll({ Apr: payslipBlock(48, { paidOn: 45777, ...employee }) });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      "sourceJournalID": "payroll",
      "postingDate": "2025-04-30",
      "amount": 3500,
      "detailComment": "Alice Johnson",
      "documentReference": "PAY-EMP001",
      "diya-gl:employerNI": 382.5,
      "diya-gl:netPay": 2770,
    });
  });

  it("reads a five-week month's block from row 58, where a fixed-row read finds nothing", async () => {
    const lines = await exportedPayroll({ Jun: payslipBlock(58, { paidOn: 45838, ...employee }) });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ postingDate: "2025-06-30", amount: 3500, detailComment: "Alice Johnson" });
  });

  it("reads the six-week last month's block from row 68", async () => {
    const lines = await exportedPayroll({ Mar: payslipBlock(68, { paidOn: 46112, ...employee }) });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ postingDate: "2026-03-31", amount: 3500 });
  });

  it("brings every month back whatever the weeks each one holds", async () => {
    const blocksByTab = {};
    // 4, 4 and 5 weeks a quarter, with a sixth on the last month.
    const weeks = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 6];
    PAYSLIP_MONTH_TABS.forEach((tab, index) => {
      blocksByTab[tab] = payslipBlock(8 + 10 * weeks[index], { paidOn: 45777 + index * 30, ...employee, reference: `PAY-${tab}` });
    });
    const lines = await exportedPayroll(blocksByTab);
    expect(lines).toHaveLength(12);
    expect(lines.map((line) => line.documentReference)).toEqual(PAYSLIP_MONTH_TABS.map((tab) => `PAY-${tab}`));
  });

  it("takes no line from a block row the sheet holds no pay on", async () => {
    const lines = await exportedPayroll({ Jun: { M59: 45838, N61: 0, O61: 0, T61: 0 } });
    expect(lines).toEqual([]);
  });
});

// ── The Ltd company registers and payroll: members, directors, employees ──
//
// RegisterofMembers, Directors&Secretary and the Payslips Employee sheet each
// carry one of the book's registers. A director who also holds shares is
// dated and counted from the register of members, the same link the writer
// draws when it fills DirectorsInterests.

const LTD_APRIL_THIRTIETH = 45777; // 2025-04-30
const LTD_MAY_THIRTY_FIRST = 45808; // 2025-05-31
const CAROL_ACQUIRED = 43831; // 2020-01-01
const DAVID_ACQUIRED = 44362; // 2021-06-15
const BOB_JOINED = 45809; // 2025-06-01, after the payroll year opens on 2025-04-06

// periodCovered() takes the accounting period from a posting; a register
// test that carries no transaction of its own still needs one to date the
// package by.
const DUMMY_POSTING = { sourceJournalID: "sales", postingDate: "2025-04-01", accountMainID: "4000", amount: 1 };

function employeeSheetBlock(base, { surname, forenames, startDateSerial, weekly = false, niCategory = "A" }) {
  const cells = {
    [`D${base + 2}`]: surname,
    [`D${base + 3}`]: forenames,
    [`D${base + 15}`]: weekly ? "W" : "M",
    [`D${base + 16}`]: 1,
    [`D${base + 17}`]: niCategory,
  };
  if (startDateSerial !== undefined) cells[`D${base + 11}`] = startDateSerial;
  return cells;
}

async function ltdRegistersPackage({
  registerofMembers = {},
  directorsAndSecretary = {},
  payslipsApril = {},
  payslipsMay = {},
  employee = {},
} = {}) {
  return writePackage({
    "Financialaccounts.xlsx": { OpenAccounts: { E2: "Precision Code Ltd" } },
    "Sales.xlsx": { Apr: { G2: 20 } },
    "Purchases.xlsx": { Apr: {} },
    "Payslips.xlsx": { Employee: employee, Apr: payslipsApril, May: payslipsMay },
    "Companysecretary.xlsx": { "RegisterofMembers": registerofMembers, "Directors&Secretary": directorsAndSecretary },
  });
}

describe("extractBook — the Ltd registers of members and directors", () => {
  const registerofMembers = {
    A3: "Carol Smith",
    C3: CAROL_ACQUIRED,
    F3: 1,
    G3: 60,
    A4: "David Brown",
    C4: DAVID_ACQUIRED,
    F4: 1,
    G4: 25,
  };
  const directorsAndSecretary = {
    A2: "Carol Smith",
    D2: "Managing Director",
    // Row 3 is the template's own secretary placeholder: a capacity with no
    // name, exactly the shape the shipped Directors&Secretary sheet carries
    // for an officer the generator never wrote.
    D3: "Company Secretary",
  };

  async function exportedRegisters() {
    const dir = await ltdRegistersPackage({ registerofMembers, directorsAndSecretary, employee: {} });
    return extractBook(dir, "ltd", [DUMMY_POSTING], LTD_CELL_MAP);
  }

  it("reads the register of members back with the shares and the date each holding was acquired", async () => {
    const book = await exportedRegisters();
    expect(book.members).toEqual([
      { memberID: "M1", name: "Carol Smith", shares: 60, acquiredDate: "2020-01-01" },
      { memberID: "M2", name: "David Brown", shares: 25, acquiredDate: "2021-06-15" },
    ]);
  });

  it("does not carry the register's single company-wide nominal value back onto a member", async () => {
    // The register prices every holding at the same £1 nominal value; the
    // book schema keeps a per-member field for it but the loader never fills
    // one, so reading it back would only ever be an extra field no fixture
    // declares.
    const book = await exportedRegisters();
    expect(book.members.some((member) => "nominalValue" in member)).toBe(false);
  });

  it("names a director from Directors&Secretary and dates and counts their holding off the register of members", async () => {
    const book = await exportedRegisters();
    expect(book.directors).toEqual([{ name: "Carol Smith", role: "Managing Director", shares: 60, appointed: "2020-01-01" }]);
  });

  it("takes no director from a capacity-only row the writer never put a name on", async () => {
    const book = await exportedRegisters();
    expect(book.directors.find((director) => director.role === "Company Secretary")).toBeUndefined();
  });

  it("leaves shares and appointed off a director who holds no shares", async () => {
    const dir = await ltdRegistersPackage({
      registerofMembers: {},
      directorsAndSecretary: { A2: "Priya Patel", D2: "Finance Director" },
    });
    const book = await extractBook(dir, "ltd", [DUMMY_POSTING], LTD_CELL_MAP);
    expect(book.directors).toEqual([{ name: "Priya Patel", role: "Finance Director" }]);
  });

  it("breaks only the shares a corrupted RegisterofMembers cell carries, on both the member and the director it names", async () => {
    const dir = await ltdRegistersPackage({ registerofMembers, directorsAndSecretary, employee: {} });
    const before = await extractBook(dir, "ltd", [DUMMY_POSTING], LTD_CELL_MAP);

    const path = resolve(dir, "Companysecretary.xlsx");
    const zip = await JSZip.loadAsync(readFileSync(path));
    const sheetPath = "xl/worksheets/sheet1.xml";
    const xml = await zip.file(sheetPath).async("string");
    zip.file(sheetPath, xml.replace(`<c r="G3"><v>60</v></c>`, `<c r="G3"><v>99</v></c>`));
    writeFileSync(path, await zip.generateAsync({ type: "nodebuffer" }));

    const after = await extractBook(dir, "ltd", [DUMMY_POSTING], LTD_CELL_MAP);
    expect(after.members[0].shares).toBe(99);
    expect(after.directors[0].shares).toBe(99);
    expect(after.members[1]).toEqual(before.members[1]);
    expect(after.directors[0].name).toBe(before.directors[0].name);
    expect(after.directors[0].appointed).toBe(before.directors[0].appointed);
  });
});

describe("extractBook — the Ltd payroll register", () => {
  async function payrollLinesFor(dir) {
    return extractPayrollTransactions(dir);
  }

  it("recovers the book's own employee id from the payslip reference, not the sheet's payroll number", async () => {
    const dir = await ltdRegistersPackage({
      employee: employeeSheetBlock(13, { surname: "Johnson", forenames: "Alice", startDateSerial: BOB_JOINED }),
      payslipsApril: payslipBlock(48, {
        paidOn: LTD_APRIL_THIRTIETH,
        name: "Alice Johnson",
        grossPay: 3500,
        incomeTax: 530,
        employeeNI: 200,
        netPay: 2770,
        employerNI: 382.5,
        reference: "PAY-EMP007-2025-04",
      }),
    });
    const lines = await payrollLinesFor(dir);
    const book = await extractBook(dir, "ltd", lines, LTD_CELL_MAP);
    expect(book.employees[0].employeeID).toBe("EMP007");
  });

  it("falls back to the sheet's own payroll number when no payslip names the employee", async () => {
    const dir = await ltdRegistersPackage({
      employee: employeeSheetBlock(13, { surname: "Johnson", forenames: "Alice", startDateSerial: BOB_JOINED }),
      payslipsApril: {},
    });
    const lines = [...(await payrollLinesFor(dir)), DUMMY_POSTING];
    const book = await extractBook(dir, "ltd", lines, LTD_CELL_MAP);
    expect(book.employees[0].employeeID).toBe("1");
  });

  it("takes the first month's gross pay as the book's per-period figure, not the year's running total", async () => {
    const dir = await ltdRegistersPackage({
      employee: employeeSheetBlock(13, { surname: "Johnson", forenames: "Alice", startDateSerial: BOB_JOINED }),
      payslipsApril: payslipBlock(48, {
        paidOn: LTD_APRIL_THIRTIETH,
        name: "Alice Johnson",
        grossPay: 3500,
        incomeTax: 530,
        employeeNI: 200,
        netPay: 2770,
        employerNI: 382.5,
        reference: "PAY-EMP001-2025-04",
      }),
      payslipsMay: payslipBlock(48, {
        paidOn: LTD_MAY_THIRTY_FIRST,
        name: "Alice Johnson",
        grossPay: 4000,
        incomeTax: 600,
        employeeNI: 220,
        netPay: 3180,
        employerNI: 430,
        reference: "PAY-EMP001-2025-05",
      }),
    });
    const lines = await payrollLinesFor(dir);
    const book = await extractBook(dir, "ltd", lines, LTD_CELL_MAP);
    expect(book.employees[0].grossPay).toBe(3500);
  });

  it("reads an employee's start date off the Employee sheet's own cell", async () => {
    const dir = await ltdRegistersPackage({
      employee: employeeSheetBlock(13, { surname: "Johnson", forenames: "Alice", startDateSerial: BOB_JOINED }),
      payslipsApril: payslipBlock(48, {
        paidOn: LTD_APRIL_THIRTIETH,
        name: "Alice Johnson",
        grossPay: 3500,
        incomeTax: 530,
        employeeNI: 200,
        netPay: 2770,
        employerNI: 382.5,
        reference: "PAY-EMP001-2025-04",
      }),
    });
    const lines = await payrollLinesFor(dir);
    const book = await extractBook(dir, "ltd", lines, LTD_CELL_MAP);
    expect(book.employees[0].startDate).toBe("2025-06-01");
  });

  it("recovers isDirector but not a real NI category from the sheet's shared director-flag cell", async () => {
    const dir = await ltdRegistersPackage({
      employee: employeeSheetBlock(39, { surname: "Smith", forenames: "Carol", startDateSerial: CAROL_ACQUIRED, niCategory: "D" }),
      payslipsApril: payslipBlock(48, {
        paidOn: LTD_APRIL_THIRTIETH,
        name: "Carol Smith",
        grossPay: 1048,
        incomeTax: 0,
        employeeNI: 0,
        netPay: 1048,
        employerNI: 7.2,
        reference: "PAY-EMP003-2025-04",
      }),
    });
    const lines = await payrollLinesFor(dir);
    const book = await extractBook(dir, "ltd", lines, LTD_CELL_MAP);
    expect(book.employees[0]).toMatchObject({ isDirector: true });
    expect(book.employees[0].niCategory).toBeUndefined();
  });

  it("breaks only the employee id a corrupted payslip reference carries", async () => {
    const dir = await ltdRegistersPackage({
      employee: employeeSheetBlock(13, { surname: "Johnson", forenames: "Alice", startDateSerial: BOB_JOINED }),
      payslipsApril: payslipBlock(48, {
        paidOn: LTD_APRIL_THIRTIETH,
        name: "Alice Johnson",
        grossPay: 3500,
        incomeTax: 530,
        employeeNI: 200,
        netPay: 2770,
        employerNI: 382.5,
        reference: "PAY-EMP007-2025-04",
      }),
    });
    const before = await extractBook(dir, "ltd", await payrollLinesFor(dir), LTD_CELL_MAP);
    expect(before.employees[0].employeeID).toBe("EMP007");

    const path = resolve(dir, "Payslips.xlsx");
    const zip = await JSZip.loadAsync(readFileSync(path));
    const sheetMap = await buildSheetMap(zip);
    const sheetPath = sheetMap.get("Apr");
    const xml = await zip.file(sheetPath).async("string");
    zip.file(
      sheetPath,
      xml.replace(`t="inlineStr"><is><t>PAY-EMP007-2025-04</t></is>`, `t="inlineStr"><is><t>not a payslip reference</t></is>`),
    );
    writeFileSync(path, await zip.generateAsync({ type: "nodebuffer" }));

    const lines = await payrollLinesFor(dir);
    const after = await extractBook(dir, "ltd", lines, LTD_CELL_MAP);
    expect(after.employees[0].employeeID).toBe("1");
    expect(after.employees[0].name).toBe(before.employees[0].name);
    expect(after.employees[0].grossPay).toBe(before.employees[0].grossPay);
  });
});

// ── The registers the Fixed Assets workbook carries ────────────────────────
//
// A single-file package records an in-year asset purchase on its own Fixed
// Assets sheet, and the multi-file packages keep their hire purchase
// agreements on Fixedassets.xlsx's HPfinance sheet. Both are registers the
// book declares, so both have to survive the export.

const HP_JUNE_FIRST = 45809; // 2025-06-01
const HP_SEPTEMBER_FIRST = 45901; // 2025-09-01

function hpAgreementRow(row, { started, financeCompany, reference, financed, admin, interest, months, supplier }) {
  return {
    [`B${row}`]: started,
    [`C${row}`]: financeCompany,
    [`D${row}`]: reference,
    [`E${row}`]: financed,
    [`F${row}`]: admin,
    [`G${row}`]: interest,
    [`H${row}`]: months,
    // The sheet works the monthly payment out for itself, so a cached
    // formula result sits beside the entered figures.
    [`I${row}`]: { formula: `IF(E${row}>0,(E${row}+F${row}+G${row})/H${row}," ")`, value: 750 },
    [`L${row}`]: supplier,
  };
}

const HP_FINANCE_SHEET = {
  ...hpAgreementRow(8, {
    started: HP_JUNE_FIRST,
    financeCompany: "Close Brothers Asset Finance",
    reference: "HP-2025-01",
    financed: 13000,
    admin: 200,
    interest: 1800,
    months: 20,
    supplier: "Precision Tooling Supplies",
  }),
  ...hpAgreementRow(10, {
    started: HP_SEPTEMBER_FIRST,
    financeCompany: "Close Brothers Asset Finance",
    reference: "HP-2025-02",
    financed: 7000,
    admin: 100,
    interest: 1000,
    months: 20,
    supplier: "Precision Tooling Supplies",
  }),
};

async function ltdPackageWithFixedAssets(fixedAssetsSheets) {
  return writePackage({
    "Financialaccounts.xlsx": { OpenAccounts: { E2: "Precision Code Ltd" } },
    "Sales.xlsx": { Apr: { G2: 20 } },
    "Purchases.xlsx": { Apr: {} },
    "Fixedassets.xlsx": fixedAssetsSheets,
  });
}

describe("extractBook — the hire purchase agreements", () => {
  it("reads every agreement the HPfinance block names", async () => {
    const dir = await ltdPackageWithFixedAssets({ Schedule: {}, HPfinance: HP_FINANCE_SHEET });
    const book = await extractBook(dir, "ltd", [DUMMY_POSTING], LTD_CELL_MAP);
    expect(book.hpAgreements).toEqual([
      {
        agreementID: "HP-2025-01",
        amountFinanced: 13000,
        adminCharges: 200,
        totalInterest: 1800,
        termMonths: 20,
        startDate: "2025-06-01",
        financeCompany: "Close Brothers Asset Finance",
        supplier: "Precision Tooling Supplies",
      },
      {
        agreementID: "HP-2025-02",
        amountFinanced: 7000,
        adminCharges: 100,
        totalInterest: 1000,
        termMonths: 20,
        startDate: "2025-09-01",
        financeCompany: "Close Brothers Asset Finance",
        supplier: "Precision Tooling Supplies",
      },
    ]);
  });

  it("breaks only the agreement whose amount financed a corrupted cell carries", async () => {
    const dir = await ltdPackageWithFixedAssets({ Schedule: {}, HPfinance: HP_FINANCE_SHEET });
    const before = await extractBook(dir, "ltd", [DUMMY_POSTING], LTD_CELL_MAP);

    const path = resolve(dir, "Fixedassets.xlsx");
    const zip = await JSZip.loadAsync(readFileSync(path));
    const sheetPath = (await buildSheetMap(zip)).get("HPfinance");
    const xml = await zip.file(sheetPath).async("string");
    zip.file(sheetPath, xml.replace(`<c r="E8"><v>13000</v></c>`, `<c r="E8"><v>99</v></c>`));
    writeFileSync(path, await zip.generateAsync({ type: "nodebuffer" }));

    const after = await extractBook(dir, "ltd", [DUMMY_POSTING], LTD_CELL_MAP);
    expect(after.hpAgreements[0].amountFinanced).toBe(99);
    expect({ ...after.hpAgreements[0], amountFinanced: 13000 }).toEqual(before.hpAgreements[0]);
    expect(after.hpAgreements[1]).toEqual(before.hpAgreements[1]);
  });

  it("leaves a row with no amount financed out of the register", async () => {
    const dir = await ltdPackageWithFixedAssets({
      Schedule: {},
      HPfinance: { ...HP_FINANCE_SHEET, E10: 0 },
    });
    const book = await extractBook(dir, "ltd", [DUMMY_POSTING], LTD_CELL_MAP);
    expect(book.hpAgreements.map((agreement) => agreement.agreementID)).toEqual(["HP-2025-01"]);
  });
});

describe("extractBook — the single-file fixed asset register", () => {
  const LAPTOP_BOUGHT = 45792; // 2025-05-15
  const VAN_BOUGHT = 45955; // 2025-10-25

  async function bstAssetPackage(fixedAssets) {
    const dir = mkdtempSync(join(tmpdir(), "xlsx-exporter-assets-"));
    writeFileSync(join(dir, "Financialaccounts.xlsx"), await buildWorkbook({ ...bstSheets(), "Fixed Assets": fixedAssets }));
    return dir;
  }

  it("reads the Basic Sole Trader addition block back as the book's asset register", async () => {
    const dir = await bstAssetPackage({
      B67: LAPTOP_BOUGHT,
      C67: "New laptop for development",
      D67: "PUR-FA-001",
      E67: 1800,
      B69: VAN_BOUGHT,
      C69: "Ford Transit Custom van",
      D69: "PUR-FA-002",
      E69: 36000,
    });
    const book = await extractBook(dir, "bst", [DUMMY_POSTING], CELL_MAP);
    expect(book.fixedAssets).toEqual([
      { assetID: "FA-0001", cost: 1800, description: "New laptop for development", acquiredDate: "2025-05-15" },
      { assetID: "FA-0002", cost: 36000, description: "Ford Transit Custom van", acquiredDate: "2025-10-25" },
    ]);
  });

  it("breaks only the asset whose cost a corrupted cell carries", async () => {
    const dir = await bstAssetPackage({
      B67: LAPTOP_BOUGHT,
      C67: "New laptop for development",
      E67: 1800,
      B68: VAN_BOUGHT,
      C68: "Ford Transit Custom van",
      E68: 36000,
    });
    const before = await extractBook(dir, "bst", [DUMMY_POSTING], CELL_MAP);

    const path = resolve(dir, findXlsx(dir));
    const zip = await JSZip.loadAsync(readFileSync(path));
    const sheetPath = (await buildSheetMap(zip)).get("Fixed Assets");
    const xml = await zip.file(sheetPath).async("string");
    zip.file(sheetPath, xml.replace(`<c r="E67"><v>1800</v></c>`, `<c r="E67"><v>7</v></c>`));
    writeFileSync(path, await zip.generateAsync({ type: "nodebuffer" }));

    const after = await extractBook(dir, "bst", [DUMMY_POSTING], CELL_MAP);
    expect(after.fixedAssets[0].cost).toBe(7);
    expect(after.fixedAssets[0].description).toBe(before.fixedAssets[0].description);
    expect(after.fixedAssets[1]).toEqual(before.fixedAssets[1]);
  });
});

// ── The named debtor and creditor ledgers ──────────────────────────────────

describe("extractBook — the named ledgers", () => {
  it("reads the Ltd opening and closing sheets back in that order", async () => {
    const dir = await writePackage({
      "Financialaccounts.xlsx": { OpenAccounts: { E2: "Precision Code Ltd" } },
      "Sales.xlsx": {
        Apr: { G2: 20 },
        OpeningDebtors: { B5: "Acme Corp", C5: "INV-0901", H5: 7200 },
        ClosingDebtors: { B5: "WidgetWorks", C5: "INV-2104", H5: 1440 },
      },
      "Purchases.xlsx": {
        Apr: {},
        OpeningCreditors: { B5: "WorkSpace Ltd", C5: "WS-2403", H5: 1200 },
        ClosingCreditors: { B5: "BT Business", C5: "BT-2603", H5: 60 },
      },
    });
    const book = await extractBook(dir, "ltd", [DUMMY_POSTING], LTD_CELL_MAP);
    expect(book.debtors).toEqual([
      { counterparty: "Acme Corp", invoice: "INV-0901", amount: 7200, timing: "opening" },
      { counterparty: "WidgetWorks", invoice: "INV-2104", amount: 1440, timing: "closing" },
    ]);
    expect(book.creditors).toEqual([
      { counterparty: "WorkSpace Ltd", invoice: "WS-2403", amount: 1200, timing: "opening" },
      { counterparty: "BT Business", invoice: "BT-2603", amount: 60, timing: "closing" },
    ]);
  });

  // The Basic Sole Trader sheet names nobody. It takes one figure a side --
  // what was owed when the year opened -- and computes every month row off
  // the Sales and Purchases tabs, so a book read back from it carries the two
  // opening balances and no named ledger at all.
  it("reads the two Owed start year figures off the single-file Debtors & Creditors sheet", async () => {
    const dir = mkdtempSync(join(tmpdir(), "xlsx-exporter-ledger-"));
    writeFileSync(
      join(dir, "Financialaccounts.xlsx"),
      await buildWorkbook({ ...bstSheets(), "Debtors & Creditors": { C3: 10800, F3: 2220 } }),
    );
    const book = await extractBook(dir, "bst", [DUMMY_POSTING], CELL_MAP);
    expect(book.openingBalances).toEqual({ tradeDebtors: 10800, tradeCreditors: 2220 });
    expect(book.debtors).toBeUndefined();
    expect(book.creditors).toBeUndefined();
  });

  it("leaves the opening balances off a sheet that states neither figure", async () => {
    const dir = mkdtempSync(join(tmpdir(), "xlsx-exporter-ledger-"));
    writeFileSync(join(dir, "Financialaccounts.xlsx"), await buildWorkbook({ ...bstSheets(), "Debtors & Creditors": {} }));
    const book = await extractBook(dir, "bst", [DUMMY_POSTING], CELL_MAP);
    expect(book.openingBalances).toBeUndefined();
  });

  it("breaks only the side whose Owed start year cell is corrupted", async () => {
    const dir = mkdtempSync(join(tmpdir(), "xlsx-exporter-ledger-"));
    writeFileSync(
      join(dir, "Financialaccounts.xlsx"),
      await buildWorkbook({ ...bstSheets(), "Debtors & Creditors": { C3: 10800, F3: 2220 } }),
    );
    const before = await extractBook(dir, "bst", [DUMMY_POSTING], CELL_MAP);

    const path = resolve(dir, findXlsx(dir));
    const zip = await JSZip.loadAsync(readFileSync(path));
    const sheetPath = (await buildSheetMap(zip)).get("Debtors & Creditors");
    const xml = await zip.file(sheetPath).async("string");
    zip.file(sheetPath, xml.replace(`<c r="C3"><v>10800</v></c>`, `<c r="C3"><v>1</v></c>`));
    writeFileSync(path, await zip.generateAsync({ type: "nodebuffer" }));

    const after = await extractBook(dir, "bst", [DUMMY_POSTING], CELL_MAP);
    expect(after.openingBalances.tradeDebtors).toBe(1);
    expect(after.openingBalances.tradeCreditors).toBe(before.openingBalances.tradeCreditors);
  });
});

// The Admin sheet prices every mileage-log row. A workbook without it used to
// export a book whose mileage claims were all nil and say nothing about why.
describe("the Admin sheet the mileage rates are priced from", () => {
  it("throws by name rather than pricing the claims at zero", async () => {
    const sheets = bstSheets({ purchaseRows: { A6: APRIL_SEVENTH, B6: "Shell", E6: "m", F6: 120 } });
    delete sheets.Admin;
    const buffer = await buildWorkbook(sheets);

    await expect(extractBstTransactions(buffer)).rejects.toThrow(AdminSheetMissingError);
    await expect(extractBstTransactions(buffer)).rejects.toThrow(/sheet "Admin" not found/);
  });

  it("prices them from the sheet when it is there", async () => {
    const buffer = await buildWorkbook(bstSheets({ purchaseRows: { A6: APRIL_SEVENTH, B6: "Shell", E6: "m", F6: 120 } }));
    const lines = await extractBstTransactions(buffer);
    const mileageLine = lines.find((line) => line.measurableUnitOfMeasure === "miles");
    expect(mileageLine.measurableQuantity).toBe(120);
  });
});

describe("extractBook — the Schedule's asset attributes and disposals", () => {
  const VAN_BOUGHT = 44562; // 2022-01-01
  const VAN_SOLD = 45777; // 2025-04-30
  const MOTOR_EXISTING_ROW = 50;

  function scheduleWithVan(overrides = {}) {
    return {
      // The class block's own rate cell, which every asset row in the block
      // reads (H50 = H$43 on the shipped template).
      H43: 0.25,
      B50: VAN_BOUGHT,
      C50: "Van (2.5 years old)",
      E50: 30000,
      F50: 9828,
      H50: { formula: "H$43", value: 0.25 },
      O50: 24000,
      U50: VAN_SOLD,
      V50: 12500,
      ...overrides,
    };
  }

  it("reads an asset's purchase date, depreciation rate and disposal back off its own row", async () => {
    const dir = await ltdPackageWithFixedAssets({ Schedule: scheduleWithVan() });
    const book = await extractBook(dir, "ltd", [DUMMY_POSTING], LTD_CELL_MAP);
    expect(book.fixedAssets).toEqual([
      {
        assetID: "FA-0001",
        class: "motorVehicles",
        cost: 30000,
        description: "Van (2.5 years old)",
        accumulatedDepreciation: 9828,
        taxWrittenDownValue: 24000,
        acquiredDate: "2022-01-01",
        depreciationRate: 0.25,
        disposedDate: "2025-04-30",
        disposalProceeds: 12500,
      },
    ]);
  });

  it("breaks only the disposal proceeds a corrupted cell carries", async () => {
    const dir = await ltdPackageWithFixedAssets({ Schedule: scheduleWithVan() });
    const before = await extractBook(dir, "ltd", [DUMMY_POSTING], LTD_CELL_MAP);

    const path = resolve(dir, "Fixedassets.xlsx");
    const zip = await JSZip.loadAsync(readFileSync(path));
    const sheetPath = (await buildSheetMap(zip)).get("Schedule");
    const xml = await zip.file(sheetPath).async("string");
    zip.file(sheetPath, xml.replace(`<c r="V${MOTOR_EXISTING_ROW}"><v>12500</v></c>`, `<c r="V${MOTOR_EXISTING_ROW}"><v>3</v></c>`));
    writeFileSync(path, await zip.generateAsync({ type: "nodebuffer" }));

    const after = await extractBook(dir, "ltd", [DUMMY_POSTING], LTD_CELL_MAP);
    expect(after.fixedAssets[0].disposalProceeds).toBe(3);
    expect({ ...after.fixedAssets[0], disposalProceeds: 12500 }).toEqual(before.fixedAssets[0]);
  });

  it("leaves the disposal fields off an asset the year did not sell", async () => {
    const dir = await ltdPackageWithFixedAssets({ Schedule: scheduleWithVan({ U50: undefined, V50: undefined }) });
    const book = await extractBook(dir, "ltd", [DUMMY_POSTING], LTD_CELL_MAP);
    expect("disposedDate" in book.fixedAssets[0]).toBe(false);
    expect("disposalProceeds" in book.fixedAssets[0]).toBe(false);
    expect(book.fixedAssets[0].depreciationRate).toBe(0.25);
  });
});
