// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-tools.js — the MCP tools, each a thin call into a function
// tested on its own: extract_book wraps export.js's --file pipeline
// (diya-gl-interchange.js underneath, so every kind it reads loads here too),
// report and edit_lines wrap the diya-gl-calculator/report-serializer loop
// and diya-gl-edits.js, save_workbook wraps product-workbook.js for a workbook
// or package zip and diya-gl-interchange.js for the two diya-gl formats, and
// lines, chart, book and checks wrap book-queries.js, and new_book wraps
// diya-gl-new-book.js. No engine code lives here.
//
// extract_book and report both carry a bookChecks field alongside report --
// the same app/lib/book-checks.js results and summary export.js writes as
// bookchecks.json, run with the book's own tax year's data from
// loadTaxDataForBook. save_workbook's diya-gl-zip format writes that same
// data into the zip as its fifth file.
//
// State: one loaded book per session (a plain object this module owns the
// shape of), held in memory. extract_book replaces it outright. edit_lines
// applies a batch of named edits to the session's current book and lines and
// keeps the result as the session's new state, so a second edit_lines call
// composes onto the first the way undo-less in-memory editing implies -- report and
// save_workbook always see whatever the most recent extract_book or
// edit_lines left behind. report and edit_lines also accept an explicit
// {book, lines} pair, bypassing the session, for a caller (a test replaying
// a fixture with no .xlsx behind it) that wants the D-to-R loop without an
// extract_book call first.

import { resolve as resolvePath } from "path";
import { extractBookFromFile, buildFileReportDocument, calculatedResultsFor } from "../../bin/export.js";
import { canonicalBookToml, canonicalLinesJsonl } from "../diya-gl-canonical.js";
import { stampBook } from "../provenance.js";
import { writeDiyaGlZip, writeBookJson } from "../diya-gl-interchange.js";
import { saveWorkbook, savePackageZip, loadTaxDataForBook, productOf } from "../product-workbook.js";
import { productModule } from "../products.js";
import {
  addSaleLine,
  addPurchaseLine,
  addBankLine,
  addPayrollLine,
  changeLineAmount,
  removeLine,
  changeLinePostingDate,
  changeLineAccount,
  changeLineBankAccount,
  changeLineDetail,
  changeLineQuantity,
  setLineReference,
} from "../diya-gl-edits.js";
import { LTD_LINE_EDITS, LTD_BOOK_EDITS } from "../diya-gl-edits-ltd.js";
import { runBookChecks, bookChecksJson } from "../book-checks.js";
import { queryLines, chartOfAccounts, bookProfile, checksWithEntries, LINE_GROUPINGS } from "../book-queries.js";
import { buildNewBook } from "../diya-gl-new-book.js";
import { taxYearFileName } from "../tax-year.js";

// Every edit fn takes (book, lines, params); a line edit returns a new
// lines array and a book edit (Ltd's own dividend, members and charges
// registers) returns a new book instead -- BOOK_EDIT_NAMES is how
// editLines() below tells which one it is holding.
const EDITS = {
  addSaleLine,
  addPurchaseLine,
  addBankLine,
  addPayrollLine,
  changeLineAmount,
  removeLine,
  changeLinePostingDate,
  changeLineAccount,
  changeLineBankAccount,
  changeLineDetail,
  changeLineQuantity,
  setLineReference,
  ...LTD_LINE_EDITS,
  ...LTD_BOOK_EDITS,
};
const BOOK_EDIT_NAMES = new Set(Object.keys(LTD_BOOK_EDITS));

/**
 * A fresh, empty session: no book loaded.
 * @returns {{book: Object|null, lines: Array|null, sourcePath: string|null}}
 */
export function createSession() {
  return { book: null, lines: null, sourcePath: null };
}

/**
 * Not an MCP tool: seed a session's book+lines directly from an
 * already-parsed diya-gl pair, for a caller that has D without a workbook to
 * run extract_book against (a fixture's own book.toml + lines.jsonl).
 * @param {Object} session
 * @param {Object} book
 * @param {Array} lines
 * @param {string|null} [sourcePath]
 */
export function loadIntoSession(session, book, lines, sourcePath = null) {
  session.book = book;
  session.lines = lines;
  session.sourcePath = sourcePath;
}

function requireLoaded(session) {
  if (!session.book || !session.lines) {
    throw new Error("No book is loaded. Call extract_book first.");
  }
}

// entryNumbers: true gives every attributed figure the entryNumbers of the
// lines behind it; an array of R keys gives them to those keys alone, so a
// caller drilling into one figure is not handed every line under every
// total.
function reportFor(book, lines, entryNumbers) {
  const product = productOf(book);
  const document = buildFileReportDocument(book, lines, product, productModule(product), { attribute: Boolean(entryNumbers) });
  if (Array.isArray(entryNumbers)) {
    const wanted = new Set(entryNumbers);
    for (const entry of document.values) if (!wanted.has(entry.key)) delete entry.entryNumbers;
  }
  return document;
}

// The book checks and warnings, with the book's own tax year's data behind
// the VAT threshold warning -- the same loadTaxDataForBook call export.js's
// --file mode makes, so a session's report and a CLI export of the same
// book carry the same bookchecks.json content -- and R alongside it, so a
// product's own warning that reads the calculated accounts (Ltd's dividend
// warning against distributable profits) sees them here too.
async function bookChecksFor(book, lines) {
  const taxData = await loadTaxDataForBook(book);
  const results = calculatedResultsFor(book, lines, taxData);
  return runBookChecks({ book, lines, taxData, results });
}

// Every R key whose canonicalised value changed between two reports, with
// the numeric delta where both sides parse as a number -- the "moved
// figures" an edit's own effect is read off, generically, for whichever
// keys that particular edit happens to touch.
function diffFigures(beforeDocument, afterDocument) {
  const before = new Map(beforeDocument.values.map((entry) => [entry.key, entry.value]));
  const after = new Map(afterDocument.values.map((entry) => [entry.key, entry.value]));
  const keys = new Set([...before.keys(), ...after.keys()]);
  const moved = [];
  for (const key of keys) {
    const beforeValue = before.has(key) ? before.get(key) : null;
    const afterValue = after.has(key) ? after.get(key) : null;
    if (beforeValue === afterValue) continue;
    const beforeNumber = beforeValue === null ? null : Number(beforeValue);
    const afterNumber = afterValue === null ? null : Number(afterValue);
    const delta =
      beforeNumber !== null && afterNumber !== null && Number.isFinite(beforeNumber) && Number.isFinite(afterNumber)
        ? Number((afterNumber - beforeNumber).toFixed(6))
        : null;
    moved.push({ key, before: beforeValue, after: afterValue, delta });
  }
  moved.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return moved;
}

/**
 * extract_book: a .xlsx or .zip path in, D (book + lines, canonical and
 * parsed) and the overtype sidecar out. Replaces the session's loaded book.
 * `product` is optional; given, it is checked against the file's own sniff
 * and a disagreement is refused by name rather than read as the wrong
 * product.
 */
async function extractBook(session, { path, product }) {
  if (!path) throw new Error("extract_book requires a path");
  const resolved = resolvePath(path);
  const { book, lines, document, overtyped } = await extractBookFromFile(resolved, { product });
  loadIntoSession(session, book, lines, resolved);
  return {
    book,
    lines,
    bookToml: canonicalBookToml(stampBook(book)),
    linesJsonl: canonicalLinesJsonl(lines),
    report: document,
    overtyped,
    bookChecks: await bookChecksFor(book, lines),
  };
}

// The rate data for the tax year a book's own period end falls in, refused by
// name where app/data carries no file for that year.
async function rateDataForBook(book) {
  try {
    return await loadTaxDataForBook(book);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const { taxRegime } = productModule(productOf(book)).PRODUCT;
    const fileName = taxYearFileName(new Date(book.documentInfo.periodCoveredEnd), taxRegime);
    throw new Error(`No tax tables for a year ending ${book.documentInfo.periodCoveredEnd}: app/data/${fileName}.toml is not carried yet`);
  }
}

/**
 * new_book: an empty book for a new business -- the product's starting chart
 * of accounts, the twelve months to the year end and that year's tax tables
 * -- with no lines, its R and its book checks. Replaces the session's loaded
 * book, so edit_lines can add the first transactions straight away.
 */
async function newBook(session, params = {}) {
  const book = buildNewBook(params, await rateDataForBook(buildNewBook(params)));
  const lines = [];
  loadIntoSession(session, book, lines);
  return {
    book,
    lines,
    bookToml: canonicalBookToml(stampBook(book)),
    report: reportFor(book, lines),
    bookChecks: await bookChecksFor(book, lines),
  };
}

/**
 * report: D in (the session's loaded book, or an explicit {book, lines}), R
 * out, alongside bookChecks (the book checks and warnings over D itself,
 * with the book's own tax year's data behind the VAT threshold warning).
 * Never caches R -- always a fresh run of calculateFromDiyaGl and
 * checkCompliance over whichever D is in play.
 */
async function report(session, params = {}) {
  const book = params.book ?? session.book;
  const lines = params.lines ?? session.lines;
  if (!book || !lines) requireLoaded(session);
  return { report: reportFor(book, lines, params.entryNumbers), bookChecks: await bookChecksFor(book, lines) };
}

/**
 * edit_lines: a batch of named edits from diya-gl-edits.js or
 * diya-gl-edits-ltd.js, each { edit, params }, applied in order to the
 * session's book and lines. Returns the edited book and lines, one R for
 * the end state, and the figures that moved between the report before the
 * first edit and the report after the last. A line edit replaces the lines
 * and a book edit (Ltd's setDividend, setMembers, setCharges) replaces the
 * book; the session takes the result only when every edit succeeded, so a
 * refusal at any index leaves the session as it was before the batch. A
 * second edit_lines call builds on the first.
 */
function editLines(session, { edits, book: explicitBook, lines: explicitLines } = {}) {
  if (!Array.isArray(edits) || edits.length === 0) throw new Error("edit_lines requires a non-empty edits array");

  const startBook = explicitBook ?? session.book;
  const startLines = explicitLines ?? session.lines;
  if (!startBook || !startLines) requireLoaded(session);

  edits.forEach(({ edit } = {}, index) => {
    if (!edit) throw new Error(`edits[${index}] requires an edit name`);
    if (!EDITS[edit]) throw new Error(`edits[${index}] "${edit}": unknown edit. Known edits: ${Object.keys(EDITS).join(", ")}`);
  });

  const before = reportFor(startBook, startLines);

  let book = startBook;
  let lines = startLines;
  edits.forEach(({ edit, params }, index) => {
    try {
      if (BOOK_EDIT_NAMES.has(edit)) book = EDITS[edit](book, lines, params ?? {});
      else lines = EDITS[edit](book, lines, params ?? {});
    } catch (error) {
      throw new Error(`edits[${index}] "${edit}": ${error.message}`);
    }
  });

  const after = reportFor(book, lines);
  if (!explicitBook) session.book = book;
  if (!explicitLines) session.lines = lines;

  return {
    book,
    lines,
    linesJsonl: canonicalLinesJsonl(lines),
    report: after,
    movedFigures: diffFigures(before, after),
  };
}

/**
 * save_workbook: D in (the session's loaded book, or an explicit {book,
 * lines}), one of four downloads out, as base64 alongside its filename: a
 * recalculating workbook, its package zip, or D (and the R and the book
 * checks just computed from it) as a diya-gl zip or a single JSON file.
 */
async function buildDownload(session, params = {}) {
  const book = params.book ?? session.book;
  const lines = params.lines ?? session.lines;
  if (!book || !lines) requireLoaded(session);

  const format = ["zip", "diya-gl-zip", "json"].includes(params.format) ? params.format : "xlsx";
  if (format === "zip") {
    const { zip, filename } = await savePackageZip(book, lines);
    return { filename, format, base64: Buffer.from(zip).toString("base64") };
  }
  if (format === "diya-gl-zip") {
    const { results } = await bookChecksFor(book, lines);
    // Round-tripped through bookChecksJson's own sort and stringify, so the
    // bytes writeDiyaGlZip's own JSON.stringify produces for bookchecks.json
    // match export.js --file's output exactly.
    const bookchecks = JSON.parse(bookChecksJson(results));
    const zip = await writeDiyaGlZip({ book, lines, report: reportFor(book, lines), bookchecks });
    return { filename: "book-diya-gl.zip", format, base64: Buffer.from(zip).toString("base64") };
  }
  if (format === "json") {
    const json = writeBookJson(book, lines);
    return { filename: "book-diya-gl.json", format, base64: Buffer.from(json, "utf8").toString("base64") };
  }
  const { workbook, filename } = await saveWorkbook(book, lines);
  return { filename, format, base64: Buffer.from(workbook).toString("base64") };
}

// The book and lines a read tool answers over: an explicit pair, or the
// session's.
function bookAndLines(session, params) {
  const book = params.book ?? session.book;
  const lines = params.lines ?? session.lines;
  if (!book || !lines) requireLoaded(session);
  return { book, lines };
}

function lines(session, params = {}) {
  const { book, lines: bookLines } = bookAndLines(session, params);
  return queryLines(book, bookLines, params);
}

function chart(session, params = {}) {
  const { book, lines: bookLines } = bookAndLines(session, params);
  return { product: productOf(book), accounts: chartOfAccounts(book, bookLines, reportFor(book, bookLines, true)) };
}

function profile(session, params = {}) {
  const { book, lines: bookLines } = bookAndLines(session, params);
  return bookProfile(book, bookLines, productOf(book));
}

async function checks(session, params = {}) {
  const { book, lines: bookLines } = bookAndLines(session, params);
  return checksWithEntries(await bookChecksFor(book, bookLines));
}

const BYPASS_PROPERTIES = {
  book: { type: "object", description: "Optional: a diya-gl book, bypassing the session" },
  lines: { type: "array", description: "Optional: diya-gl lines, bypassing the session" },
};

const ONE_OR_MANY = (description) => ({
  anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
  description,
});

/**
 * The tools, keyed by their MCP name: schema plus handler. tools/list
 * reads name/description/inputSchema straight off this table; tools/call
 * looks the name up and calls handler(session, arguments).
 */
export const TOOLS = {
  extract_book: {
    name: "extract_book",
    description:
      "Extract a diya-gl book from a DIY Accounting workbook or package zip: D (book.toml + lines.jsonl, canonical and parsed), R (the computed report), the book checks and warnings over D, and the overtype sidecar (every template formula the upload carries as a typed value instead). Replaces the session's loaded book.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to a workbook or package zip" },
        product: {
          type: "string",
          enum: ["bst", "taxi", "se", "ltd"],
          description:
            "Optional: the product the file is expected to be; checked against the file's own content and refused by name on a disagreement",
        },
      },
      required: ["path"],
    },
    handler: extractBook,
  },
  new_book: {
    name: "new_book",
    description:
      "Start an empty book for a new business: the product's starting chart of accounts (sales, purchases and bank accounts), the twelve months to the year end, and that tax year's rates, with no lines yet, its report and its book checks. Replaces the session's loaded book, so edit_lines can add the first sales and purchases straight away. Answers: How do I start books for a new business? What accounts does a new sole trader or company book start with? Which tax rates apply to my first year?",
    inputSchema: {
      type: "object",
      properties: {
        product: {
          type: "string",
          enum: ["bst", "taxi", "se", "ltd"],
          description: "bst (Basic Sole Trader), taxi (Taxi Driver), se (Self Employed) or ltd (Limited Company)",
        },
        businessName: { type: "string", description: "The business or company name" },
        yearEnd: { type: "string", description: "The last day of the first accounting year, YYYY-MM-DD (e.g. 2027-04-05)" },
        vatRegistered: { type: "boolean", description: "Optional, se and ltd only: the business is VAT registered" },
      },
      required: ["product", "businessName", "yearEnd"],
    },
    handler: newBook,
  },
  report: {
    name: "report",
    description:
      "Compute R (figures, report sections and compliance check verdicts) and the book checks and warnings from the session's currently loaded book. Each report-section figure carries the label the spreadsheet prints for it. Answers: What was my profit? What is my turnover, my tax bill, my VAT due? Which lines make up this figure (entryNumbers)?",
    inputSchema: {
      type: "object",
      properties: {
        book: { type: "object", description: "Optional: a diya-gl book, bypassing the session" },
        lines: { type: "array", description: "Optional: diya-gl lines, bypassing the session" },
        entryNumbers: {
          anyOf: [{ type: "boolean" }, { type: "array", items: { type: "string" } }],
          description:
            "Optional: true gives every figure the calculator attributes its entryNumbers, the sorted entryNumbers of the ledger lines behind it; an array of R keys (e.g. section/profit-loss-account/sales-turnover) gives them to those figures only.",
        },
      },
    },
    handler: report,
  },
  edit_lines: {
    name: "edit_lines",
    description:
      "Apply a batch of named edits from app/lib/diya-gl-edits.js (" +
      Object.keys(EDITS).join(", ") +
      ") in order to the session's currently loaded book and lines, and return the edited book and lines, one recomputed R for the end state, and the figures that moved between before the first edit and after the last. A refusal names the edit's index and name and leaves the session as it was before the batch.",
    inputSchema: {
      type: "object",
      properties: {
        edits: {
          type: "array",
          minItems: 1,
          description: "The edits to apply, in order",
          items: {
            type: "object",
            properties: {
              edit: { type: "string", enum: Object.keys(EDITS), description: "The named edit to apply" },
              params: { type: "object", description: "Parameters for the named edit; see app/lib/diya-gl-edits.js" },
            },
            required: ["edit", "params"],
          },
        },
        book: { type: "object", description: "Optional: a diya-gl book, bypassing the session" },
        lines: { type: "array", description: "Optional: diya-gl lines, bypassing the session" },
      },
      required: ["edits"],
    },
    handler: editLines,
  },
  save_workbook: {
    name: "save_workbook",
    description:
      "Write the session's currently loaded book into a DIY Accounting workbook or package zip, a diya-gl zip (book.toml, lines.jsonl, report.json, bookchecks.json), or a single diya-gl JSON file, returned as base64 alongside its filename. Format xlsx is refused by name for a product whose package is more than one workbook.",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["xlsx", "zip", "diya-gl-zip", "json"], default: "xlsx" },
        book: { type: "object", description: "Optional: a diya-gl book, bypassing the session" },
        lines: { type: "array", description: "Optional: diya-gl lines, bypassing the session" },
      },
    },
    handler: buildDownload,
  },
  lines: {
    name: "lines",
    description:
      "Read every ledger line of the loaded book (every sale, purchase, bank movement, payslip and journal entry, with its entryNumber, journal, accountMainID, postingDate, amount, detailComment naming the customer, supplier or payee, lineItemComment, documentReference and VAT fields), filtered and optionally grouped with a count and a total in pence. Answers: Who is my best customer? Which suppliers cost most? What did I spend on fuel in June? How much did I invoice each month? What are my five largest purchases? Which lines carry invoice INV-0012? Filters combine: journal, accountMainID, from/to posting dates, text in detailComment or lineItemComment, documentReference. groupBy detailComment (customer or supplier) or accountMainID gives groups largest total first; groupBy month gives them in date order. top keeps the first N groups, or without groupBy the N largest lines. Totals are signed: credit notes reduce their sale or purchase (a bad debt written off reduces that customer's sales), and credits on the bank or journal (money out) are negative.",
    inputSchema: {
      type: "object",
      properties: {
        journal: ONE_OR_MANY("Optional: sourceJournalID to keep, e.g. sales, purchases, bank, payroll, journal"),
        accountMainID: ONE_OR_MANY("Optional: account ids to keep, e.g. 4000 (see the chart tool)"),
        from: { type: "string", description: "Optional: earliest postingDate kept, YYYY-MM-DD inclusive" },
        to: { type: "string", description: "Optional: latest postingDate kept, YYYY-MM-DD inclusive" },
        text: { type: "string", description: "Optional: case-insensitive text found in detailComment or lineItemComment" },
        documentReference: { type: "string", description: "Optional: case-insensitive text found in documentReference" },
        groupBy: {
          type: "string",
          enum: LINE_GROUPINGS,
          description: "Optional: detailComment (customer or supplier), accountMainID or month (YYYY-MM)",
        },
        top: { type: "integer", minimum: 1, description: "Optional: keep at most this many groups, or the largest lines" },
        ...BYPASS_PROPERTIES,
      },
    },
    handler: lines,
  },
  chart: {
    name: "chart",
    description:
      "The loaded book's chart of accounts: each account's id, name, group (sales, purchases, bank, capital, assets, liabilities), its declared fields (the workbook column it lands in), how many lines post to it and their total in pence, and feeds, the report rows (key and printed label) its lines reach. Answers: Which account is fuel? Where does rent show in my accounts? What accounts can I post to? Which accounts have no activity this year?",
    inputSchema: { type: "object", properties: { ...BYPASS_PROPERTIES } },
    handler: chart,
  },
  book: {
    name: "book",
    description:
      "The loaded book's profile from book.toml: product (bst, taxi, se, ltd), accounting period, the business (name, trade, address, UTR, VAT registration, cash or accruals basis), tax settings (income tax, NI, VAT, corporation tax, capital allowances, mileage rates), bank accounts, the journals present with their line counts and date range, and every register the book carries (directors, employees, debtors, creditors, fixed assets, HP agreements, dividends, members, charges, opening balances, stock). Answers: What period do these accounts cover? Am I VAT registered? Who are the directors and employees? What fixed assets do I own? Who owes me money at the year end?",
    inputSchema: { type: "object", properties: { ...BYPASS_PROPERTIES } },
    handler: profile,
  },
  checks: {
    name: "checks",
    description:
      "Every book check and warning over the loaded book, each with its verdict (pass, warn or fail), what it means, and the entryNumbers of the lines that fail it, plus the pass/warn/fail summary. Answers: Is anything wrong with my books? Which entries are dated outside the year? Which sales have no invoice number? Are there duplicate entries? Am I near the VAT threshold?",
    inputSchema: { type: "object", properties: { ...BYPASS_PROPERTIES } },
    handler: checks,
  },
};
