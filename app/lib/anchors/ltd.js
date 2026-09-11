// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// anchors/ltd.js -- the Limited Company anchor table and input-cell
// predicate.
//
// Ltd ships thirteen workbooks and all twelve year-end months, so a
// customer's own upload can drop, rename or reshuffle any one of the
// workbooks, and the month tabs six of them carry are never "Apr".."Mar" --
// they run from the month after whichever year end the book declares
// (ltd-layout.js's monthTabOrder(), the same sequence generator.js's
// getMonthTabSequence() renames the template's tabs to). Every label below
// was read from the shipped package's own sheet XML (packages/GB Accounts
// Company 2026-03-31 (Mar26) Excel 2007/, cross-checked against the
// 2026-10-31 (Oct26) package and examples/ltd-latest, which is that same
// October year end) on 2026-09-06 -- spaces inside a label are part of it.
//
// isLtdInputCell names every cell app/products/ltd.js's cellWrites() fills,
// derived from that module's own exported layout constants (and
// app/lib/calculators/ltd.js's analysis-column maps, and
// app/lib/payslips-layout.js's payroll layout) rather than restated here --
// a column moves in one place only.

import { validateAnchors, AnchorError } from "./run.js";
import { buildSheetMap } from "../spreadsheet-runner.js";
import { ACCOUNT_ID_COLUMN } from "../xlsx-exporter.js";
import { BANK_LAYOUTS, monthTabOrder, OPENING_FIXED_ASSET_COLUMNS } from "../ltd-layout.js";
import { SALES_ANALYSIS_COLUMNS, PURCHASE_ANALYSIS_COLUMNS } from "../calculators/ltd.js";
import {
  STRADDLING_PERIOD_ROWS,
  STRADDLING_COLUMNS,
  STOCK_MATERIALS_PERCENT_CELL,
  STOCK_FINAL_COUNT_CELL,
  ADMIN_ASSOCIATED_COMPANIES_CELL,
  OPENACCOUNTS_FRANKED_INVESTMENT_INCOME_CELL,
  SCHEDULE_ASSET_CLASSES,
  SCHEDULE_NEW_ASSET_ROWS,
  CHARGE_REGISTER_ROWS,
  CHARGE_REGISTER_COLUMNS,
  REGISTER_MEMBER_ROWS,
  REGISTER_MEMBER_COLUMNS,
  BOARD_MINUTE_CELLS,
  DIRECTOR_SECRETARY_OFFICER_ROWS,
  DIRECTOR_SECRETARY_COLUMNS,
  DIRECTORS_INTERESTS_ROWS,
  DIRECTORS_INTERESTS_COLUMNS,
  SALESINVOICE_VAT_REG_CELL,
  SALESINVOICE_TELEPHONE_CELL,
  SALESINVOICE_PRODUCT_DETAILS_COLUMNS,
  SALESINVOICE_INVOICE_DATABASE_COLUMNS,
  SALESINVOICE_SAMPLE_PRODUCT_ROW,
  OPENING_BALANCE_CELLS,
  OPENING_BANK_COLUMNS,
  OPENING_TAX_COLUMNS,
} from "../../products/ltd.js";
import {
  monthlyPayrollBlockRow,
  PAYSLIPS_ENTRY_COLUMNS,
  PAYSLIPS_EMPLOYEE_BASE_ROWS,
  PAYSLIPS_EMPLOYEE_START_DATE_OFFSET,
  PAYSLIP_PRINT_SHEET,
  PAYSLIP_PRINT_CELLS,
} from "../payslips-layout.js";

// ── column-letter arithmetic and cell-ref parsing (restated from se.js -- a
// column moves in ltd-layout.js/products/ltd.js only, this file never edits
// a column of its own) ──────────────────────────────────────────────────
function columnIndex(col) {
  let index = 0;
  for (const ch of col) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index;
}
function parseCellRef(cellRef) {
  const match = /^([A-Z]+)(\d+)$/.exec(cellRef);
  return match ? { col: match[1], row: Number(match[2]) } : null;
}
function inRange(row, first, last) {
  return row >= first && row <= last;
}

// The code-letter header a Sales or Purchases month tab prints above its
// analysis columns, in column order -- verified against the template
// (Sales.xlsx!Nov!O4:U4, Purchases.xlsx!Nov!O4:AI4) and generated from the
// calculator's own map from then on, so a column added there is a column
// added here.
function analysisColumnHeaders(sheet, row, columnsByCode) {
  return Object.entries(columnsByCode)
    .sort((a, b) => columnIndex(a[1]) - columnIndex(b[1]))
    .map(([code, col]) => ({ sheet, cell: `${col}${row}`, label: code.toUpperCase() }));
}

// Every one of the four bank workbooks prints its own code-letter headers on
// row 5, one block for receipts and one for payments, the column run
// starting straight after each block's own amount column --
// BANK_LAYOUTS[file].receiptColumns/.paymentColumns already carry the
// [code, column] pairs ltd-layout.js's analysisColumns() built, verified
// against the template (Currentaccount.xlsx!Apr!G5:Q5 and Y5:AN5,
// Cashaccount.xlsx!Apr!G5:N5 and V5:AJ5) for every one of the four files.
function bankLayoutHeaders(file, tab) {
  const layout = BANK_LAYOUTS[file];
  const headers = [];
  for (const [code, col] of [...layout.receiptColumns, ...layout.paymentColumns]) {
    headers.push({ sheet: tab, cell: `${col}5`, label: code });
  }
  return headers;
}

/**
 * The Limited Company anchor table for a book whose year end falls in the
 * given month. Six of the thirteen workbooks carry twelve month tabs, named
 * from the month after year end (monthTabOrder()), so the table -- and the
 * "first tab" a package prints its analysis headers on -- is a function of
 * that month rather than the template's own March order.
 * @param {number} yearEndMonth - 1-indexed calendar month (Mar = 3, Oct = 10)
 * @returns {Object} a table in the shape anchors/run.js's validateAnchors() runs
 */
export function ltdAnchors(yearEndMonth) {
  const months = monthTabOrder(yearEndMonth);
  const firstTab = months[0];

  return {
    "Financialaccounts.xlsx": {
      sheets: [
        "OpenAccounts",
        "TrialBalance",
        "MnthP&L",
        "PubP&L",
        "PubBalSht",
        "PubNotes",
        "Report",
        "CorporationTax",
        "CT600",
        "WagesInterface",
        "Stock",
        "Admin",
      ],
      headers: [
        { sheet: "Admin", cell: "D5", label: "Annual Investment Allowance" },
        { sheet: "MnthP&L", cell: "A11", label: "Purchases" },
        { sheet: "MnthP&L", cell: "A18", label: "Wages and Salaries" },
      ],
    },
    "Sales.xlsx": {
      sheets: ["OpeningDebtors", ...months, "ClosingDebtors"],
      headers: [
        { sheet: firstTab, cell: "G3", label: "Vat       Output" }, // six spaces
        { sheet: firstTab, cell: "H2", label: "Sales           Net of Vat" }, // eleven spaces
        { sheet: firstTab, cell: "O3", label: "Product          A" }, // ten spaces
        { sheet: firstTab, cell: "V3", label: "CIS Tax Deducted" },
        { sheet: "OpeningDebtors", cell: "A2", label: "Sales      Date" }, // six spaces
        { sheet: "OpeningDebtors", cell: "G3", label: "Vat       Output" },
        ...analysisColumnHeaders(firstTab, 4, SALES_ANALYSIS_COLUMNS),
      ],
    },
    "Purchases.xlsx": {
      sheets: ["OpeningCreditors", ...months, "ClosingCreditors"],
      headers: [
        { sheet: firstTab, cell: "AK3", label: "CIS Certificates" },
        { sheet: firstTab, cell: "AK4", label: "Tax Paid" },
        ...analysisColumnHeaders(firstTab, 4, PURCHASE_ANALYSIS_COLUMNS),
      ],
    },
    "Currentaccount.xlsx": {
      sheets: months,
      headers: [
        { sheet: firstTab, cell: "F3", label: "Amounts received from each Source" },
        { sheet: firstTab, cell: "G3", label: "Transfers From Savings" },
        { sheet: firstTab, cell: "S4", label: "Payment Date" }, // template carries a trailing space; textAt() trims it
        { sheet: firstTab, cell: "X3", label: "Amounts Paid by invoice number" },
        { sheet: firstTab, cell: "AN3", label: "Bank Contra items" },
        ...bankLayoutHeaders("Currentaccount.xlsx", firstTab),
      ],
    },
    "Savingaccount.xlsx": {
      sheets: months,
      headers: [
        { sheet: firstTab, cell: "F3", label: "Amounts received from each Source" },
        { sheet: firstTab, cell: "G3", label: "Transfers From Current" },
        { sheet: firstTab, cell: "S4", label: "Payment Date" }, // template carries a trailing space; textAt() trims it
        { sheet: firstTab, cell: "X3", label: "Amounts Paid by invoice number" },
        { sheet: firstTab, cell: "AN3", label: "Bank Contra items" },
        ...bankLayoutHeaders("Savingaccount.xlsx", firstTab),
      ],
    },
    "Creditcardaccount.xlsx": {
      sheets: months,
      headers: [
        { sheet: firstTab, cell: "F3", label: "Amounts received from each Source" },
        { sheet: firstTab, cell: "G3", label: "Transfers From Current" },
        { sheet: firstTab, cell: "S4", label: "Payment Date" }, // template carries a trailing space; textAt() trims it
        { sheet: firstTab, cell: "X3", label: "Amounts Paid by invoice number" },
        { sheet: firstTab, cell: "AN3", label: "Bank Contra items" },
        ...bankLayoutHeaders("Creditcardaccount.xlsx", firstTab),
      ],
    },
    "Cashaccount.xlsx": {
      sheets: months,
      headers: [
        { sheet: firstTab, cell: "P4", label: "Payment Date" }, // template carries a trailing space; textAt() trims it
        { sheet: firstTab, cell: "F3", label: "Amounts received from each Source" },
        { sheet: firstTab, cell: "U3", label: "Amount Cash Payment" },
        ...bankLayoutHeaders("Cashaccount.xlsx", firstTab),
      ],
    },
    "Vatreturns.xlsx": {
      sheets: [
        "VATQtr1",
        "VATQtr2",
        "VATQtr3",
        "VATQtr4",
        "VATQtr5",
        "Vatinterface",
        "S02Y1",
        "S03Y1",
        "S04Y2",
        "S05Y2",
        "S06Y2",
        "P02Y1",
        "P03Y1",
        "P04Y2",
        "P05Y2",
        "P06Y2",
      ],
      headers: [
        { sheet: "VATQtr1", cell: "E5", label: "VAT Period ends" },
        { sheet: "VATQtr1", cell: "B9", label: "VAT due on sales" },
        { sheet: "VATQtr1", cell: "B15", label: "VAT reclaimed on purchases" },
        { sheet: "VATQtr1", cell: "B23", label: "Total value of purchases excluding VAT" },
      ],
    },
    "Payslips.xlsx": {
      sheets: ["Employee", ...months, "Payslips", "Payment", "Admin"],
      headers: [
        { sheet: firstTab, cell: "M3", label: "GROSS WAGES" },
        { sheet: firstTab, cell: "N3", label: "Income Tax" },
        { sheet: firstTab, cell: "O3", label: "Employees National Insurance" },
        { sheet: firstTab, cell: "T3", label: "Employers National Insurance" },
        { sheet: "Employee", cell: "D29", label: "1" }, // a literal 1 the template ships; textAt() stringifies a numeric cell the same way
      ],
    },
    "Fixedassets.xlsx": {
      sheets: ["Schedule", "FAreconciliation", "HPfinance"],
      headers: [
        { sheet: "Schedule", cell: "B1", label: "Date Asset Purchased" },
        { sheet: "Schedule", cell: "C1", label: "FIXED ASSETS" },
      ],
    },
    "Companysecretary.xlsx": {
      sheets: ["Boardmeeting", "Directors&Secretary", "RegisterofMembers", "DirectorsInterests", "Charges&Debentures"],
      headers: [
        { sheet: "Directors&Secretary", cell: "D1", label: "Capacity in which appointed" },
        { sheet: "RegisterofMembers", cell: "A2", label: "Full name of Member" },
      ],
    },
    "Salesinvoice.xlsx": {
      sheets: ["Invoice Template", "Invoice Database", "Customer Details", "Product Details", "Business Details"],
      headers: [
        { sheet: "Business Details", cell: "A8", label: "Telephone" },
        { sheet: "Business Details", cell: "A11", label: "VAT Registration Number" },
      ],
    },
    "expensesform.xlsx": {
      sheets: [
        "Month 01",
        "Month 02",
        "Month 03",
        "Month 04",
        "Month 05",
        "Month 06",
        "Month 07",
        "Month 08",
        "Month 09",
        "Month 10",
        "Month 11",
        "Month 12",
      ],
      headers: [{ sheet: "Month 01", cell: "A1", label: "EXPENSES CLAIM FORM" }],
    },
  };
}

// Cells the four multi-file extractors and the reconciliation depend on
// remaining formulas -- not header labels, so validateAnchors' text-equality
// check does not apply (their cached value is package-specific, e.g. the
// accuracy check's own 0, and would wrongly fail a legitimate but unbalanced
// upload). A customer who types a value over one of these breaks the
// cross-file link or the check it feeds, so this guard confirms each still
// carries a formula (an <f> element) before any extractor trusts what is
// downstream of it. Verified against the template on 2026-09-06.
const LTD_FORMULA_ANCHORS = {
  "Financialaccounts.xlsx": [{ sheet: "OpenAccounts", cell: "E37" }], // the opening balance sheet's own accuracy check
  "Fixedassets.xlsx": [
    { sheet: "Schedule", cell: "E1" }, // = E57+E110
    { sheet: "Schedule", cell: "E57" }, // = the five existing-asset class totals
    { sheet: "Schedule", cell: "E110" }, // = the five new-asset class totals
    { sheet: "FAreconciliation", cell: "E13" }, // = [2]<last tab>!$AI$2, the Purchases ledger's own fixed-asset total
    { sheet: "HPfinance", cell: "E2" }, // = SUM(E8:E26)
  ],
  "Companysecretary.xlsx": [
    { sheet: "RegisterofMembers", cell: "F1" }, // = F3
    { sheet: "RegisterofMembers", cell: "G1" }, // = SUM(G3:G19)
  ],
  "Vatreturns.xlsx": [
    { sheet: "VATQtr1", cell: "K2" }, // = Vatinterface!B6
    { sheet: "Vatinterface", cell: "B4" }, // = [1]Admin!$B$6
  ],
};

function cellElement(xml, cellRef) {
  const pattern = new RegExp(`<c\\s+r="${cellRef}"(?=[\\s/>])([^>]*?)(?:/>|>((?:(?!</c>|<c[\\s>]).)*)</c>)`, "s");
  return xml.match(pattern);
}

function hasFormula(xml, cellRef) {
  const match = cellElement(xml, cellRef);
  return !!match && /<f[\s>]/.test(match[2] || "");
}

// Findings for the formula anchors above, in the same shape run.js's own
// findings carry -- a missing file or sheet is already named by
// validateAnchors, so this only reports a cell that exists but no longer
// carries a formula.
async function formulaAnchorFindings(set) {
  const findings = [];
  for (const [file, anchors] of Object.entries(LTD_FORMULA_ANCHORS)) {
    if (!set.has(file)) continue;
    const zip = await set.zip(file);
    const sheetMap = await buildSheetMap(zip);
    for (const { sheet, cell } of anchors) {
      const sheetPath = sheetMap.get(sheet);
      if (!sheetPath) continue;
      const xml = await zip.file(sheetPath).async("string");
      if (!hasFormula(xml, cell)) {
        findings.push({ file, sheet, cell, message: `sheet "${sheet}" cell ${cell}: expected a formula, found none` });
      }
    }
  }
  return findings;
}

/**
 * The year-end month a Ltd package's own hub declares, read directly rather
 * than through the full extraction pipeline: Financialaccounts.xlsx!Admin!F21
 * is the period end date every one of the thirteen workbooks is generated
 * against (generator.js's yearEndMonth = endDate.getUTCMonth() + 1), and its
 * cell address does not move with the year end the way the six month-tabbed
 * workbooks' sheet names do.
 * @param {Object} set - a workbook set
 * @returns {Promise<number>} 1-indexed calendar month (Mar = 3, Oct = 10)
 */
export async function ltdYearEndMonth(set) {
  const zip = await set.zip("Financialaccounts.xlsx");
  const sheetMap = await buildSheetMap(zip);
  const xml = await zip.file(sheetMap.get("Admin")).async("string");
  const match = cellElement(xml, "F21");
  const serial = match && Number((match[2] || "").match(/<v>([^<]*)<\/v>/)?.[1]);
  if (!serial) throw new Error("Financialaccounts.xlsx!Admin!F21 carries no year-end date to read the package's month tabs from");
  const yearEndDate = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return yearEndDate.getUTCMonth() + 1;
}

/**
 * Confirm every sheet and header label the Ltd extractors key on is present,
 * and every formula anchor above still carries a formula, before any of them
 * run. The month-tab order is read from the package's own hub first, so the
 * table checked against the six month-tabbed workbooks matches whatever year
 * end the upload declares. Throws AnchorError naming every anchor that
 * failed; returns nothing on success.
 * @param {Object} set - a workbook set
 */
export async function validateLtdAnchors(set) {
  // A missing hub is validateAnchors' own finding below (file "..." not
  // found); without it there is no Admin!F21 to read a real month order
  // from, so the table falls back to the template's own March order, which
  // still lets every other file's sheets and headers be checked properly.
  const yearEndMonth = set.has("Financialaccounts.xlsx") ? await ltdYearEndMonth(set) : 3;
  const table = ltdAnchors(yearEndMonth);

  let headerFindings = [];
  try {
    await validateAnchors(set, table, "Limited Company");
  } catch (err) {
    if (!(err instanceof AnchorError)) throw err;
    headerFindings = err.findings;
  }

  const extra = await formulaAnchorFindings(set);
  const findings = [...headerFindings, ...extra];
  if (findings.length > 0) throw new AnchorError("Limited Company", findings);
}

// ── isLtdInputCell ───────────────────────────────────────────────────────

// The journals' own columns (Sales.xlsx, Purchases.xlsx): A the entry date,
// B the counterparty, C the reference, D the description, E the code
// letter, F the amount, and the account-carrier column -- see
// app/products/ltd.js's cellWrites() processJournal(). V is Sales' own CIS
// column, AK is Purchases' own CIS column, both written only where a
// transaction carries a cis_deduction.
const JOURNAL_COLUMNS = ["A", "B", "C", "D", "E", "F", ACCOUNT_ID_COLUMN];
const SALES_CIS_COLUMN = "V";
const PURCHASES_CIS_COLUMN = "AK";
// The first Sales month tab's own VAT-rate cell, turned off for a business
// that is not VAT-registered.
const VAT_RATE_CELL = "G2";

// Both journals also keep an opening and a closing ledger sheet, one entry a
// row from row 5, counterparty/invoice/amount in B/C/H (Ltd's ledgers keep H
// for the amount, not SE's G -- see cellWrites()'s opening/closing
// debtor/creditor writers).
const LEDGER_COLUMNS = ["B", "C", "H"];
const LEDGER_LAST_ROW = 54;

function isSalesInputCell(sheet, monthTabs, cellRef) {
  if (sheet === "OpeningDebtors" || sheet === "ClosingDebtors") {
    const ref = parseCellRef(cellRef);
    return !!ref && LEDGER_COLUMNS.includes(ref.col) && inRange(ref.row, 5, LEDGER_LAST_ROW);
  }
  if (!monthTabs.includes(sheet)) return false;
  if (sheet === monthTabs[0] && cellRef === VAT_RATE_CELL) return true;
  const ref = parseCellRef(cellRef);
  if (!ref) return false;
  if (JOURNAL_COLUMNS.includes(ref.col)) return inRange(ref.row, 5, 300);
  if (ref.col === SALES_CIS_COLUMN) return inRange(ref.row, 5, 300);
  return false;
}

function isPurchasesInputCell(sheet, monthTabs, cellRef) {
  if (sheet === "OpeningCreditors" || sheet === "ClosingCreditors") {
    const ref = parseCellRef(cellRef);
    return !!ref && LEDGER_COLUMNS.includes(ref.col) && inRange(ref.row, 5, LEDGER_LAST_ROW);
  }
  if (!monthTabs.includes(sheet)) return false;
  const ref = parseCellRef(cellRef);
  if (!ref) return false;
  if (JOURNAL_COLUMNS.includes(ref.col)) return inRange(ref.row, 5, 300);
  if (ref.col === PURCHASES_CIS_COLUMN) return inRange(ref.row, 5, 300);
  return false;
}

// The four bank workbooks: A1 is the opening balance, written only on the
// first month tab (every later tab's A1 is the roll-forward formula
// Apr!A2); every other write lands on the receipt or payment block's own
// columns, rows 6 to 200 -- see cellWrites()'s bank writer.
function isBankInputCell(file, sheet, monthTabs, cellRef) {
  if (!monthTabs.includes(sheet)) return false;
  if (cellRef === "A1") return sheet === monthTabs[0];
  const layout = BANK_LAYOUTS[file];
  const columns = [...Object.values(layout.receipt), ...Object.values(layout.payment)];
  const ref = parseCellRef(cellRef);
  return !!ref && columns.includes(ref.col) && inRange(ref.row, 6, 200);
}

// The ten straddling VAT entry sheets, one row from row 5, in the columns
// STRADDLING_COLUMNS names (A, B, C, D and F -- E carries no field the
// writer fills).
const STRADDLING_SHEETS = new Set(Object.keys(STRADDLING_PERIOD_ROWS).flatMap((period) => [`S${period}`, `P${period}`]));
const STRADDLING_WRITTEN_COLUMNS = Object.values(STRADDLING_COLUMNS);

function isVatReturnsInputCell(sheet, cellRef) {
  if (!STRADDLING_SHEETS.has(sheet)) return false;
  const ref = parseCellRef(cellRef);
  return !!ref && STRADDLING_WRITTEN_COLUMNS.includes(ref.col) && inRange(ref.row, 5, 300);
}

// The Employee sheet's business-address box and, per employee block, the
// surname, forename, NI number, start date, pay frequency, payroll number
// and NI category/director flag -- see cellWrites()'s Payslips.xlsx writer,
// the same shape SE's own Employee sheet takes (payslips-layout.js is
// shared between the two products).
const EMPLOYEE_FIXED_CELLS = ["D5", "D6", "D7", "D9"];
const EMPLOYEE_BLOCK_CELLS = [
  ["D", 2], // surname
  ["D", 3], // forename(s)
  ["M", 2], // NI number
  ["D", PAYSLIPS_EMPLOYEE_START_DATE_OFFSET], // start date
  ["D", 15], // pay frequency
  ["D", 16], // payroll number
  ["D", 17], // NI category / director
];

function isEmployeeInputCell(cellRef) {
  if (EMPLOYEE_FIXED_CELLS.includes(cellRef)) return true;
  return PAYSLIPS_EMPLOYEE_BASE_ROWS.some((base) => EMPLOYEE_BLOCK_CELLS.some(([col, offset]) => cellRef === `${col}${base + offset}`));
}

// A month tab's monthly payroll block: the wages-paid date one row below the
// block start, and the five employee rows below that in the entry columns
// plus the account-carrier column.
const PAYSLIPS_MONTH_TAB_COLUMNS = [...Object.values(PAYSLIPS_ENTRY_COLUMNS), ACCOUNT_ID_COLUMN];

function isPayslipsMonthInputCell(sheet, monthTabs, cellRef) {
  const monthIndex = monthTabs.indexOf(sheet);
  if (monthIndex === -1) return false;
  const blockRow = monthlyPayrollBlockRow(monthIndex);
  if (cellRef === `M${blockRow + 1}`) return true;
  const ref = parseCellRef(cellRef);
  return !!ref && PAYSLIPS_MONTH_TAB_COLUMNS.includes(ref.col) && inRange(ref.row, blockRow + 3, blockRow + 7);
}

function isPayslipsInputCell(sheet, monthTabs, cellRef) {
  if (sheet === "Employee") return isEmployeeInputCell(cellRef);
  if (sheet === PAYSLIP_PRINT_SHEET) return cellRef === PAYSLIP_PRINT_CELLS.frequency || cellRef === PAYSLIP_PRINT_CELLS.period;
  return isPayslipsMonthInputCell(sheet, monthTabs, cellRef);
}

// Schedule: an opening asset's description/cost/acc-dep/tax-wdv (C, E, F, O)
// on its existingRows, or a disposal's date/proceeds (U, V) on that row --
// Ltd's own disposalRows chain existing rows before new ones, so a disposal
// can land on either set (unlike SE, where a disposal only ever targets an
// existing row). A new purchase takes its date/supplier/cost (B, C, E) on a
// SCHEDULE_NEW_ASSET_ROWS row, plus U/V for the same reason.
const EXISTING_SCHEDULE_ROWS = new Set(Object.values(SCHEDULE_ASSET_CLASSES).flatMap((cls) => cls.existingRows));
const NEW_SCHEDULE_ROWS = new Set(SCHEDULE_NEW_ASSET_ROWS);
const EXISTING_SCHEDULE_COLUMNS = ["C", "E", "F", "O", "U", "V"];
const NEW_SCHEDULE_COLUMNS = ["B", "C", "E", "U", "V"];
// HPfinance keeps only two rows for scenario hire-purchase agreements (row 8,
// the "New" block's own working master, and row 10, the first #REF!-repaired
// row) -- restated here rather than exported, since app/products/ltd.js
// declares it inside cellWrites() itself.
const HP_ROWS = new Set([8, 10]);
const HP_COLUMNS = ["B", "C", "D", "E", "F", "G", "H", "L"];

function isFixedAssetsInputCell(sheet, cellRef) {
  const ref = parseCellRef(cellRef);
  if (!ref) return false;
  if (sheet === "Schedule") {
    if (EXISTING_SCHEDULE_ROWS.has(ref.row)) return EXISTING_SCHEDULE_COLUMNS.includes(ref.col);
    if (NEW_SCHEDULE_ROWS.has(ref.row)) return NEW_SCHEDULE_COLUMNS.includes(ref.col);
    return false;
  }
  if (sheet === "HPfinance") return HP_ROWS.has(ref.row) && HP_COLUMNS.includes(ref.col);
  return false;
}

// Companysecretary.xlsx: the four registers named by their own exported row
// and column constants, plus the board minute's date and dividend cells.
function isCompanysecretaryInputCell(sheet, cellRef) {
  const ref = parseCellRef(cellRef);
  if (sheet === "Charges&Debentures") {
    return !!ref && new Set(CHARGE_REGISTER_ROWS).has(ref.row) && Object.values(CHARGE_REGISTER_COLUMNS).includes(ref.col);
  }
  if (sheet === "RegisterofMembers") {
    return !!ref && new Set(REGISTER_MEMBER_ROWS).has(ref.row) && Object.values(REGISTER_MEMBER_COLUMNS).includes(ref.col);
  }
  if (sheet === "Directors&Secretary") {
    return !!ref && new Set(DIRECTOR_SECRETARY_OFFICER_ROWS).has(ref.row) && Object.values(DIRECTOR_SECRETARY_COLUMNS).includes(ref.col);
  }
  if (sheet === "DirectorsInterests") {
    return !!ref && new Set(DIRECTORS_INTERESTS_ROWS).has(ref.row) && Object.values(DIRECTORS_INTERESTS_COLUMNS).includes(ref.col);
  }
  if (sheet === "Boardmeeting") return cellRef === BOARD_MINUTE_CELLS.date || cellRef === BOARD_MINUTE_CELLS.dividendDeclared;
  return false;
}

// OpenAccounts (Financialaccounts.xlsx): the business-details block, the
// named opening-balance cells, and the fixed-asset/bank/tax column blocks at
// their own rows (13, 18, 26 -- see cellWrites()'s writeOpeningBalance()).
const OPEN_ACCOUNTS_BUSINESS_CELLS = [
  "E2",
  "E3",
  "E4",
  "E5",
  "E6",
  "E8",
  "J3",
  "J4",
  "N6",
  "O3",
  OPENACCOUNTS_FRANKED_INVESTMENT_INCOME_CELL,
];
const OPENING_BALANCE_ROW_CELLS = new Set(Object.values(OPENING_BALANCE_CELLS));

function isOpenAccountsInputCell(cellRef) {
  if (OPEN_ACCOUNTS_BUSINESS_CELLS.includes(cellRef)) return true;
  if (OPENING_BALANCE_ROW_CELLS.has(cellRef)) return true;
  if (cellRef === "E13" || cellRef === "E18" || cellRef === "E26") return true;
  const ref = parseCellRef(cellRef);
  if (!ref) return false;
  if (ref.row === 13)
    return Object.values(OPENING_FIXED_ASSET_COLUMNS).some((cols) => cols.cost === ref.col || cols.depreciation === ref.col);
  if (ref.row === 18) return Object.values(OPENING_BANK_COLUMNS).includes(ref.col);
  if (ref.row === 26) return Object.values(OPENING_TAX_COLUMNS).includes(ref.col);
  return false;
}

// The one sample invoice line a VAT-registered book writes: the letterhead
// phone and VAT number, the Invoice Database's activated first row and the
// sample product's price -- see cellWrites()'s Salesinvoice.xlsx writer.
function isSalesinvoiceInputCell(sheet, cellRef) {
  if (sheet === "Business Details") return cellRef === SALESINVOICE_TELEPHONE_CELL || cellRef === SALESINVOICE_VAT_REG_CELL;
  if (sheet === "Invoice Database") {
    return Object.values(SALESINVOICE_INVOICE_DATABASE_COLUMNS).some((col) => cellRef === `${col}2`);
  }
  if (sheet === "Product Details") return cellRef === `${SALESINVOICE_PRODUCT_DETAILS_COLUMNS.price}${SALESINVOICE_SAMPLE_PRODUCT_ROW}`;
  return false;
}

/**
 * Every cell app/products/ltd.js's cellWrites() actually fills, across the
 * thirteen Ltd workbooks -- the predicate the overtype sidecar skips before
 * flagging a cell as typed over. monthTabs is the package's own tab order
 * (ltdAnchors()'s months, or monthTabOrder(yearEndMonth) directly); it
 * defaults to the template's own March order so a caller checking a single
 * cell against the shipped template need not compute it first.
 * @param {string} file
 * @param {string} sheet
 * @param {string} cellRef
 * @param {string[]} [monthTabs] - the twelve month tab names in order
 * @returns {boolean}
 */
export function isLtdInputCell(file, sheet, cellRef, monthTabs = monthTabOrder(3)) {
  switch (file) {
    case "Sales.xlsx":
      return isSalesInputCell(sheet, monthTabs, cellRef);
    case "Purchases.xlsx":
      return isPurchasesInputCell(sheet, monthTabs, cellRef);
    case "Currentaccount.xlsx":
    case "Savingaccount.xlsx":
    case "Cashaccount.xlsx":
    case "Creditcardaccount.xlsx":
      return isBankInputCell(file, sheet, monthTabs, cellRef);
    case "Vatreturns.xlsx":
      return isVatReturnsInputCell(sheet, cellRef);
    case "Payslips.xlsx":
      return isPayslipsInputCell(sheet, monthTabs, cellRef);
    case "Fixedassets.xlsx":
      return isFixedAssetsInputCell(sheet, cellRef);
    case "Companysecretary.xlsx":
      return isCompanysecretaryInputCell(sheet, cellRef);
    case "Salesinvoice.xlsx":
      return isSalesinvoiceInputCell(sheet, cellRef);
    case "Financialaccounts.xlsx":
      if (sheet === "OpenAccounts") return isOpenAccountsInputCell(cellRef);
      if (sheet === "Stock") return cellRef === STOCK_MATERIALS_PERCENT_CELL || cellRef === STOCK_FINAL_COUNT_CELL;
      if (sheet === "Admin") return cellRef === ADMIN_ASSOCIATED_COMPANIES_CELL;
      return false;
    default:
      return false;
  }
}
