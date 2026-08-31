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
  extractBook,
  normaliseLine,
} from "../lib/xlsx-exporter.js";
import { findXlsx } from "../lib/xlsx-reader.js";
import { validateBook, validateLines } from "../lib/diya-gl-schema.js";
import { BST_PURCHASE_CODE_MAP, LTD_PURCHASE_CODE_MAP, LTD_SALES_CODE_MAP } from "../lib/scenario-extractor.js";
import { CELL_MAP } from "../products/bst.js";
import { CELL_MAP as TAXI_CELL_MAP } from "../products/taxi.js";

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
    "Admin": { N7: 0.2, N4: 12570, L17: 3.45 },
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
    // The BST cell map names Admin!L17 and its neighbours the way the book
    // schema does (class2WeeklyRate, class4MainRate, ...), so the exported
    // book states them and still validates.
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
