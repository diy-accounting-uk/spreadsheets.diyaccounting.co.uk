// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se.js — Self Employed product definition.
// Multi-file package: 9 xlsx files with cross-file external links.
// Owns column mappings, cell references, compliance checks.
// Calls shared tools from app/lib/.

import { toExcelSerial } from "../lib/spreadsheet-runner.js";
import { ACCOUNT_ID_COLUMN } from "../lib/xlsx-exporter.js";
import { parseDate, MONTH_SHEETS } from "../lib/scenario-loader.js";
import {
  monthlyPayrollBlockRow,
  PAYE_DUE_DAY,
  PAYE_SCHEDULE_FIRST_ROW,
  PAYE_SCHEDULE_MONTH_TAB_CELLS,
  PAYE_SCHEDULE_MONTH_TABS,
  payeTaxMonthDates,
  PAYSLIP_PRINT_CELLS,
  PAYSLIP_PRINT_PERIOD,
  PAYSLIP_PRINT_SHEET,
  PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES,
  PAYSLIPS_EMPLOYEE_BASE_ROWS,
  PAYSLIPS_EMPLOYEE_START_DATE_OFFSET,
  PAYSLIPS_ENTRY_COLUMNS,
  payrollRecordOpened,
  payrollYearStart,
  payslipsMonthEntryRows,
  payslipsStartDate,
  payslipsWagesPaidCell,
} from "../lib/payslips-layout.js";
import {
  buildCategoryNetting,
  buildProfitBridge,
  categoryNettingCheckName,
  PROFIT_BRIDGE_CHECK,
  vatCycleRows,
  vatReturnCoverage,
} from "../lib/report-generator.js";
import { calculateMileageAllowance, HMRC_CAR_MILEAGE_RATES } from "../lib/tax/mileage.js";

export const PRODUCT = {
  id: "se",
  dir: "se",
  name: "Self Employed",
  taxRegime: "se",
  prefix: "GB Accounts Self Employed",
};

// SE is a multi-file package. Sales and Purchases are separate xlsx files.
export const MULTI_FILE = true;

// ── Scenario cell writes ───────────────────────────────────────────────────
// SE writes to separate xlsx files: Sales.xlsx and Purchases.xlsx.
// Sheet names are "Apr", "May", etc. (not "SalesApr", "PurchasesApr").
//
// Sales.xlsx columns: A=date, B=customer, F=code letter, G=gross amount
//   Code letters: a=Product A, b=Product B, c=Product C, d=Other Income, g=Grants, o=Other
//   H=VAT (auto-calc), I=net (auto-calc), P-V=analysis by code (auto-calc)
//
// Purchases.xlsx columns: A=date, B=supplier, F=code letter, G=gross amount
//   Code letters: s=purchases, c=sub-contractors, o=other direct, w=wages,
//   p=premises, m=repairs, g=general admin, v=motor, h=HP/lease,
//   a=advertising, l=legal, y=other expenses, fa=fixed assets

// Bank/cash entries route to one of two leaf files by account ID.
export const BANK_ACCOUNT_FILES = { 1200: "Bank.xlsx", 1220: "Cash.xlsx" };

// Column layout of the receipts and payments blocks in each workbook's month
// tabs, and the code letters each block has an analysis column for --
// verified against the templates. Bank.xlsx row 5: receipts E/F feed G:M
// under BC/DR/CR/K/RV/DL/X; payments S/T feed U:AC under BC/CR/DR/W/B/J/
// RP/DL/X. Cash.xlsx row 5: receipts E/F feed G:J under BB/DR/CR/DL;
// payments P/Q feed R:X under BB/CR/DR/W/J/RP/DL. A code means opposite
// things on the two sides (CR is a creditor refund received but a
// creditor payment made), so direction cannot be inferred from the code
// alone -- every entry names its own direction. Cash.xlsx has no "X"
// analysis column at all; its own transfer code is "BB".
// reference and comment are two columns both workbooks keep beside the
// receipt or payment block that the writer never used to fill. reference is
// the invoice number column -- Bank.xlsx's receipts carry a "Sales Invoice"
// column at C and its payments an "Enter Purchase Invoice No." column at Q;
// Cash.xlsx keeps the same pair at C and N. comment is the column beside it
// -- Bank.xlsx's D ("Deposit Bank Reference") and R ("Cheque number Direct
// Debit"), Cash.xlsx's D ("Deposit Cash Reference") and O ("Optional cash
// payment reference") -- which the sheet keeps for the payer's own reference
// rather than a description, but is a real, otherwise-empty cell all the
// same, so a line's own free-text comment goes there.
export const BANK_LAYOUTS = {
  "Bank.xlsx": {
    receipt: { date: "A", source: "B", reference: "C", comment: "D", code: "E", amount: "F" },
    payment: { date: "O", source: "P", reference: "Q", comment: "R", code: "S", amount: "T" },
    receiptCodes: new Set(["BC", "DR", "CR", "K", "RV", "DL", "X"]),
    paymentCodes: new Set(["BC", "CR", "DR", "W", "B", "J", "RP", "DL", "X"]),
  },
  "Cash.xlsx": {
    receipt: { date: "A", source: "B", reference: "C", comment: "D", code: "E", amount: "F" },
    payment: { date: "L", source: "M", reference: "N", comment: "O", code: "P", amount: "Q" },
    receiptCodes: new Set(["BB", "DR", "CR", "DL"]),
    paymentCodes: new Set(["BB", "CR", "DR", "W", "J", "RP", "DL"]),
  },
};

// A Company book splits its HMRC payments four ways: PAYE under "RP", VAT
// under "RV", CIS under "RC" and corporation tax under "RT". Both Self
// Employed workbooks carry a single "HMRC Payments" column instead
// (Bank.xlsx AA, Cash.xlsx W), analysed under "RP", so a payment coded for
// any of the other three lands in that one column. Receipts keep their own
// letters -- Bank.xlsx has an "HMRC Refunded" column under "RV".
const SE_HMRC_PAYMENT_CODE = "RP";
const COMPANY_TAX_PAYMENT_CODES = new Set(["RV", "RC", "RT"]);

function paymentCodeFor(code) {
  return COMPANY_TAX_PAYMENT_CODES.has(code) ? SE_HMRC_PAYMENT_CODE : code;
}

// Matches [vat].standard_rate in app/data/se-*.toml (Admin!F27). Used to
// convert a scenario's gross transaction amount to the net-of-VAT figure
// the Sales.xlsx/Purchases.xlsx/Fixedassets.xlsx analysis columns hold --
// all read the I column ("Sales/Purchases Net of Vat"), never the gross G
// column.
const VAT_RATE = 0.2;

// Cell H2 of a Sales.xlsx month tab holds the rate the whole book charges.
// April carries the figure, each later month reads the month before it, and
// every Purchases month reads its own Sales month. Entering 0 there is what
// the Self Employed guide tells a business that is not registered for VAT to
// do, and it is the only lever that turns VAT off end to end.
const VAT_RATE_CELL = "H2";

// A scenario says whether the business is registered in its own metadata.
// Anything that does not say is registered, which is what every fixture
// written before the flag existed means.
export function vatRateFor(scenario) {
  return scenario?.metadata?.vat_registered === false ? 0 : VAT_RATE;
}

// ── Sales invoice sample line (Salesinvoice.xlsx) ───────────────────────────
// The customer-facing invoice template has no external link into the rest of
// the book, so its own VAT rate is proved directly: the generator now writes
// the tax year's standard rate into Product Details!D2:D99 (generator.js),
// and this checks one sample invoice line, anchored to the fixture's own
// first sale, computes the right net, VAT and gross from it. Row 2 of
// Product Details already ships the template's own placeholder product code
// (A2 = 1001); this only sets its selling price. Business Details!B11 is the
// VAT registration number the invoice template itself gates its per-row VAT
// lookup on (verified against the XML: Invoice Template!N38 reads
// 'Product Details'!D:D only when O8, which reads 'Business Details'!B11, is
// not blank) -- an unregistered business is left untouched, the same as the
// template's own guidance for it. The invoice also carries a carriage charge
// (Invoice Database!E, the "Carriage Charge" column), which the template
// taxes separately from the product lines in Invoice Template!P62. That term
// used to read a literal 0.2; it now reads 'Product Details'!$D$2, the same
// cell every row of D2:D99 carries the tax year's rate into, so carriage is
// taxed at the written rate like every other line.
export const SALESINVOICE_VAT_REG_CELL = "B11";
// The same sheet's "Telephone" box, the entry cell beside its A8 label.
export const SALESINVOICE_TELEPHONE_CELL = "B8";
export const SALESINVOICE_SAMPLE_PRODUCT_CODE = 1001;
export const SALESINVOICE_SAMPLE_PRODUCT_ROW = 2;
export const SALESINVOICE_SAMPLE_CARRIAGE_CHARGE = 37.5;
export const SALESINVOICE_PRODUCT_DETAILS_COLUMNS = { code: "A", price: "C", vatRate: "D" };
export const SALESINVOICE_INVOICE_DATABASE_COLUMNS = {
  activate: "A",
  invoiceNumber: "B",
  carriage: "E",
  productCode1: "F",
  quantity1: "G",
};
const SALESINVOICE_INVOICE_TEMPLATE_CELLS = { netTotal: "P58", carriageNet: "P60", vatTotal: "P62", grossTotal: "P64" };
const SALESINVOICE_LINE1_CELLS = { productCode: "C38", unitPrice: "J38", quantity: "L38", lineNet: "P38", lineVat: "V38" };

function netOfVat(gross, rate = VAT_RATE) {
  return Math.round((gross / (1 + rate)) * 100) / 100;
}

// ── Vat.xlsx Vatinterface layout ───────────────────────────────────────────
// One row per VAT period, in date order. Rows 6-17 are the twelve accounting
// months, Apr at row 6 through Mar at row 17. Rows 4 and 5 are the two VAT
// periods before the accounting year, rows 18 to 20 the three after it; each
// is fed by its own S/P entry sheet rather than by a month tab. Column B is
// the period end date every VATQtr sheet looks up on, C the payment due date,
// D/F the period's sales net and output VAT, H/J its purchases net and input
// VAT, and E/G/I/K the rolling three-row sums the VAT boxes read. M carries
// the flat-rate flag box 6 switches on.
const VATINTERFACE_ROWS = { first: 4, last: 20, firstMonth: 6 };

// Straddling VAT period name to the Vatinterface row it feeds, and to the
// pair of entry sheets it is entered on (S<period> and P<period>).
export const STRADDLING_PERIOD_ROWS = { "02Y1": 4, "03Y1": 5, "04Y2": 18, "05Y2": 19, "06Y2": 20 };

// The straddling entry sheets take the same fields as the month tabs but in
// their own columns, and the sales and purchases sheets do not agree on them.
// Both compute VAT and net from the gross figure in the amount column.
export const STRADDLING_SALES_COLUMNS = { date: "A", name: "B", invoice: "C", amount: "E" };
export const STRADDLING_PURCHASES_COLUMNS = { date: "A", name: "B", invoice: "C", description: "E", amount: "G" };

// The StockControl physical-count cells for the two ends of the accounting
// year -- row 6 is the opening count and row 30 the count at the year end.
// The SA103F front page's "Description of business" box, the merged
// C17:J17 entry cell under the label in C16.
export const BUSINESS_DESCRIPTION_CELL = "C17";
export const STOCK_OPENING_COUNT_CELL = "AB6";
export const STOCK_CLOSING_COUNT_CELL = "AB30";

// Fixedassets.xlsx Schedule sheet -- verified against the template:
//   Existing assets (bought before the year start): rows 8-10 land,
//   14-18 plant, 22-26 fixtures, 30-34 computers, 38-54 motor. Each row:
//   C=asset description, D=purchase reference, E=original cost,
//   F=accumulated depreciation brought forward.
//   New assets (bought during the year): rows 61-63 land, 67-71 plant,
//   75-79 fixtures, 83-87 computers, 91-107 motor. Same C/D/E layout;
//   B=date purchased, U=date sold, V=sale value (net of VAT) for an
//   in-year disposal recorded on the same row as the asset it disposes of.
// Row 1 carries the sheet's own column totals (E1=total cost,
// F1=total acc dep b/f, G1=total WDV b/f, I1=total depreciation charge,
// J1=total acc dep c/f, K1=total WDV c/f, Q1/R1/S1=capital allowance
// totals, V1/W1/X1/Y1/Z1=disposal totals) -- these feed both the P&L
// depreciation/disposal lines and the SA103S capital allowance boxes via
// cross-file external links, and FAreconciliation (a second sheet in the
// same workbook) independently sums the New-asset rows and compares the
// total against Purchases.xlsx's and Sales.xlsx's own fa/fs-coded column
// totals -- the workbook's own note-vs-schedule tie-out.
export const EXISTING_ASSET_ROWS = { motor: [38, 39, 40, 41, 42], computer: [30, 31, 32, 33, 34] };
export const NEW_PLANT_ROWS = [67, 68, 69, 70, 71];

// Hire purchase agreements (Fixedassets.xlsx HPfinance sheet). Only two
// rows are available for scenario agreements before the sheet's own
// layout runs out: row 8 (the "New" block's working master, whose
// monthly-payment formula was never broken) and row 10 (the first row
// the #REF! repair fixes). B=agreement date, C=finance company,
// D=reference, E=amount financed, F=admin charges, G=total interest,
// H=term in months, L=supplier. Written left to right per row, matching
// the Schedule writer below.
export const HP_AGREEMENT_ROWS = [8, 10];

// targetStartYear is the year the package's tax year opens in, which for a
// 5 April year end is the year before the one its directory names.
export function cellWrites(scenario, targetStartYear) {
  const rate = vatRateFor(scenario);
  const salesWrites = {};
  const purchasesWrites = {};
  const bankWrites = {};
  const cashWrites = {};

  if (scenario.sales) {
    for (const [monthKey, transactions] of Object.entries(scenario.sales)) {
      const sheetName = MONTH_SHEETS[monthKey];
      if (!salesWrites[sheetName]) salesWrites[sheetName] = {};
      const sheet = salesWrites[sheetName];

      let row = 5;
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        sheet[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.customer) sheet[`B${row}`] = tx.customer;
        if (tx.reference) sheet[`C${row}`] = tx.reference;
        // Column D is the day's sales mileage (SalesApr!D1 = SUM(D5:D300)).
        // PurchasesApr!C2 pools it into the running mileage total alongside
        // that sheet's own D-column entries (=0+D1+[1]Apr!$D$1), and G2
        // bands the total at the Admin mileage rates and files the claim
        // under Motor Expenses (F2="v"). Unlike a Purchases mileage-log row,
        // a sales day's miles sit beside a real sale, so the amount is
        // written as well -- this is not an either/or the way a bought
        // purchase and a mileage claim are. E is "Sales Description", a free
        // column the sheet keeps beside it, for the same field the purchases
        // sheet already carries at its own E.
        if (tx.mileage) sheet[`D${row}`] = tx.mileage;
        if (tx.description) sheet[`E${row}`] = tx.description;
        sheet[`F${row}`] = tx.code || "a";
        sheet[`G${row}`] = tx.amount;
        if (tx.account) sheet[`${ACCOUNT_ID_COLUMN}${row}`] = tx.account;
        row++;
      }
    }
  }

  if (scenario.purchases) {
    for (const [monthKey, transactions] of Object.entries(scenario.purchases)) {
      const sheetName = MONTH_SHEETS[monthKey];
      if (!purchasesWrites[sheetName]) purchasesWrites[sheetName] = {};
      const sheet = purchasesWrites[sheetName];

      let row = 5;
      for (const tx of transactions) {
        const d = parseDate(tx.date);
        sheet[`A${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (tx.supplier) sheet[`B${row}`] = tx.supplier;
        if (tx.reference) sheet[`C${row}`] = tx.reference;
        // A mileage-log entry buys nothing: its whole expense is the claim the
        // approved rates make of the miles, and the sheet makes that claim
        // itself. Column D takes them (PurchasesApr!D1 = SUM(D5:D300), pooled
        // with the Sales sheet's own mileage total into the running total at
        // C2, banded at the Admin rates in G2 and filed under Motor Expenses
        // through W2 = IF(F2="v",I2," ")), so writing the amount in column G
        // as well would charge the same journey twice.
        if (tx.mileage) sheet[`D${row}`] = tx.mileage;
        if (tx.description) sheet[`E${row}`] = tx.description;
        sheet[`F${row}`] = tx.code;
        if (!tx.mileage) sheet[`G${row}`] = tx.amount;
        // AD is the sheet's "CIS Certificates / Tax Paid" column, where a
        // contractor records the tax it withheld from a subcontractor's
        // invoice. It sits outside the month's own analysis check total, so
        // recording it leaves the row's expense analysis where it was.
        // Written after G and before the account column, because a write can
        // only run left to right (see the Schedule writer below).
        if (tx.cis_deduction) sheet[`AD${row}`] = tx.cis_deduction;
        if (tx.account) sheet[`${ACCOUNT_ID_COLUMN}${row}`] = tx.account;
        row++;
      }
    }
  }

  // A business that is not registered for VAT turns the rate off on April's
  // Sales tab, and the rest of the book follows that cell.
  if (rate !== VAT_RATE) {
    const firstTab = MONTH_SHEETS.apr;
    if (!salesWrites[firstTab]) salesWrites[firstTab] = {};
    salesWrites[firstTab][VAT_RATE_CELL] = rate * 100;
  }

  // Bank and Cash entries — routed to a workbook by account, then to the
  // receipt or payment block by the entry's own explicit direction (a code
  // letter alone cannot say which side a line belongs on -- see
  // BANK_LAYOUTS above).
  if (scenario.bank) {
    // Track receipt row and payment row per month per file
    const receiptRows = {};
    const paymentRows = {};

    for (const [monthKey, transactions] of Object.entries(scenario.bank)) {
      const sheetName = MONTH_SHEETS[monthKey];

      for (const tx of transactions) {
        const acct = tx.account || "1200";
        const fileName = BANK_ACCOUNT_FILES[acct];
        if (!fileName) throw new Error(`cellWrites: bank entry dated ${tx.date} names unknown account "${acct}"`);
        const targetWrites = fileName === "Cash.xlsx" ? cashWrites : bankWrites;
        if (!targetWrites[sheetName]) targetWrites[sheetName] = {};
        const sheet = targetWrites[sheetName];

        if (tx.code === "BC") {
          // Opening balance goes in A1, not a receipt row.
          sheet.A1 = tx.amount;
          continue;
        }

        if (tx.direction !== "in" && tx.direction !== "out") {
          throw new Error(`cellWrites: bank entry dated ${tx.date} (${tx.code} ${tx.amount}) has no direction`);
        }
        const layout = BANK_LAYOUTS[fileName];
        const isReceipt = tx.direction === "in";
        const block = isReceipt ? layout.receipt : layout.payment;
        const analysedCodes = isReceipt ? layout.receiptCodes : layout.paymentCodes;
        const code = isReceipt ? tx.code : paymentCodeFor(tx.code);
        if (!analysedCodes.has(code)) {
          throw new Error(`cellWrites: ${fileName} analyses no ${isReceipt ? "receipt" : "payment"} under code "${tx.code}"`);
        }

        const rowKey = `${fileName}:${sheetName}`;
        const rows = isReceipt ? receiptRows : paymentRows;
        if (!rows[rowKey]) rows[rowKey] = 6;
        const row = rows[rowKey]++;
        const d = parseDate(tx.date);
        const serial = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        sheet[`${block.date}${row}`] = serial;
        if (tx.source) sheet[`${block.source}${row}`] = tx.source;
        if (tx.reference) sheet[`${block.reference}${row}`] = tx.reference;
        if (tx.description) sheet[`${block.comment}${row}`] = tx.description;
        sheet[`${block.code}${row}`] = code;
        sheet[`${block.amount}${row}`] = tx.amount;
      }
    }
  }

  // Opening/closing debtors — column G is "Sales Value including Vat", the
  // only column the sheet's own G1 total (SUM(G5:G300)) reads. Column D
  // carries no header and no formula anywhere in the workbook.
  if (scenario.opening_debtors) {
    if (!salesWrites.OpeningDebtors) salesWrites.OpeningDebtors = {};
    let row = 5;
    for (const d of scenario.opening_debtors) {
      salesWrites.OpeningDebtors[`B${row}`] = d.customer;
      salesWrites.OpeningDebtors[`C${row}`] = d.invoice;
      salesWrites.OpeningDebtors[`G${row}`] = d.amount;
      row++;
    }
  }

  if (scenario.closing_debtors) {
    if (!salesWrites.ClosingDebtors) salesWrites.ClosingDebtors = {};
    let row = 5;
    for (const d of scenario.closing_debtors) {
      salesWrites.ClosingDebtors[`B${row}`] = d.customer;
      salesWrites.ClosingDebtors[`C${row}`] = d.invoice;
      salesWrites.ClosingDebtors[`G${row}`] = d.amount;
      row++;
    }
  }

  // Opening/closing creditors — column G is "Total Purchase Value incl Vat",
  // the column the sheet's own G1 total (SUM(G5:G300)) reads.
  if (scenario.opening_creditors) {
    if (!purchasesWrites.OpeningCreditors) purchasesWrites.OpeningCreditors = {};
    let row = 5;
    for (const c of scenario.opening_creditors) {
      purchasesWrites.OpeningCreditors[`B${row}`] = c.supplier;
      purchasesWrites.OpeningCreditors[`C${row}`] = c.invoice;
      purchasesWrites.OpeningCreditors[`G${row}`] = c.amount;
      row++;
    }
  }

  if (scenario.closing_creditors) {
    if (!purchasesWrites.ClosingCreditors) purchasesWrites.ClosingCreditors = {};
    let row = 5;
    for (const c of scenario.closing_creditors) {
      purchasesWrites.ClosingCreditors[`B${row}`] = c.supplier;
      purchasesWrites.ClosingCreditors[`C${row}`] = c.invoice;
      purchasesWrites.ClosingCreditors[`G${row}`] = c.amount;
      row++;
    }
  }

  // Business Details (in Financialaccounts.xlsx hub)
  const hubWrites = {};

  // Stock (StockControl). The sheet takes a physical count against each month
  // end, row 6 for the year's opening through row 30 for its close, and the
  // P&L's materials line takes each month's count off the month before it
  // (C14 = Apr purchases + AB6 - AB8, D14 = May purchases + AB8 - AB10, ...).
  // The twelve months therefore telescope to AB6 - AB30 whatever is entered
  // between them, so the two ends of the year are the whole of the year's
  // stock movement. Without them the movement never reaches cost of sales.
  if (scenario.stock) {
    hubWrites.StockControl = {};
    if (scenario.stock.opening !== undefined) hubWrites.StockControl[STOCK_OPENING_COUNT_CELL] = scenario.stock.opening;
    if (scenario.stock.closing !== undefined) hubWrites.StockControl[STOCK_CLOSING_COUNT_CELL] = scenario.stock.closing;
  }
  if (scenario.business || scenario.metadata) {
    hubWrites["Business Details"] = {};
    const bd = hubWrites["Business Details"];
    const biz = scenario.business || {};
    bd.C5 = biz.name || scenario.metadata?.name || "";
    // The SA103F front page runs label then entry down column C: C16 heads
    // "Description of business" and C17:J17 is the merged box under it, in
    // the same entry style C5 carries.
    if (biz.description) bd[BUSINESS_DESCRIPTION_CELL] = biz.description;
  }

  // Payslips.xlsx employee details
  const payslipsWrites = {};
  if (scenario.employees) {
    // Employee blocks start at rows 13, 39, 65, 91, 117 (26-row intervals)
    const EMP_BASE_ROWS = PAYSLIPS_EMPLOYEE_BASE_ROWS;
    const payrollStart = targetStartYear ? payrollYearStart(targetStartYear) : null;
    const payrollOpened = payrollRecordOpened(scenario.payroll, parseDate);
    payslipsWrites.Employee = {};
    const emp = payslipsWrites.Employee;

    // Business details in Payslips Employee sheet
    const biz = scenario.business || {};
    if (biz.name) emp.D5 = biz.name;
    if (biz.address) emp.D6 = biz.address;
    if (biz.town) emp.D7 = biz.town;
    if (biz.postcode) emp.D9 = biz.postcode;

    for (let i = 0; i < Math.min(scenario.employees.length, 5); i++) {
      const e = scenario.employees[i];
      const base = EMP_BASE_ROWS[i];
      if (e.name) {
        const parts = e.name.split(" ");
        emp[`D${base + 2}`] = parts.slice(-1)[0]; // surname
        emp[`D${base + 3}`] = parts.slice(0, -1).join(" "); // forename(s)
      }
      if (e.niNumber) emp[`M${base + 2}`] = e.niNumber;
      // The date the employee joined, read against the payroll year this
      // package's calendar runs on. Without it the employee's line on every
      // month tab stays blank and the printed payslip prints no figures.
      if (e.startDate && payrollStart) {
        const joined = parseDate(e.startDate);
        const onSheet = payslipsStartDate(joined, payrollOpened, joined, payrollStart);
        emp[`D${base + PAYSLIPS_EMPLOYEE_START_DATE_OFFSET}`] = toExcelSerial(
          onSheet.getUTCFullYear(),
          onSheet.getUTCMonth() + 1,
          onSheet.getUTCDate(),
        );
      }
      emp[`D${base + 15}`] = e.payFrequency === "weekly" ? "W" : "M";
      // The payroll number, not the scenario's own employee id. The printed
      // payslip adds this cell to its block's start row to find the
      // employee's line on the month tab, so a name in it takes the whole
      // page's arithmetic with it.
      emp[`D${base + 16}`] = i + 1;
      emp[`D${base + 17}`] = e.isDirector ? "D" : e.niCategory || "A";
    }
  }

  // Payslips.xlsx monthly payroll data, on the month tab's own monthly block.
  if (scenario.payroll) {
    for (const [monthKey, entries] of Object.entries(scenario.payroll)) {
      const sheetName = MONTH_SHEETS[monthKey];
      if (!sheetName) continue;
      if (!payslipsWrites[sheetName]) payslipsWrites[sheetName] = {};
      const sheet = payslipsWrites[sheetName];
      const blockRow = monthlyPayrollBlockRow(MONTH_KEYS.indexOf(monthKey));
      // Write wages paid date from first entry
      if (entries.length > 0) {
        const d = parseDate(entries[0].date);
        sheet[`M${blockRow + 1}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      }
      for (let i = 0; i < Math.min(entries.length, 5); i++) {
        const row = blockRow + 3 + i;
        const e = entries[i];
        if (e.name) sheet[`F${row}`] = e.name;
        // Column D is the block's own "Tax Code" column, headed in D3 and
        // read by no formula, so the code the employee is taxed under
        // reaches the payslip it belongs on.
        if (e.taxCode) sheet[`D${row}`] = e.taxCode;
        sheet[`M${row}`] = e.grossPay;
        sheet[`N${row}`] = e.incomeTax;
        sheet[`O${row}`] = e.employeeNI;
        sheet[`R${row}`] = e.netPay;
        // Column S is a blank spacer in the template (self-closing, no
        // formula, never summed) -- the payslip's own reference goes there,
        // since nothing else on the row reads it; column T is the real
        // employer-NI data entry cell -- the block's own total row sums it
        // into T1, which Wagesinterface!H reads. Verified against the
        // template.
        if (e.reference) sheet[`S${row}`] = e.reference;
        sheet[`T${row}`] = e.employerNI;
        if (e.accountMainID) sheet[`${ACCOUNT_ID_COLUMN}${row}`] = e.accountMainID;
      }
    }
    payslipsWrites[PAYSLIP_PRINT_SHEET] = {
      [PAYSLIP_PRINT_CELLS.frequency]: "M",
      [PAYSLIP_PRINT_CELLS.period]: PAYSLIP_PRINT_PERIOD,
    };
  }

  const fixedAssetsWrites = {};
  const existingAssetRowsUsed = { motor: [], computer: [] };

  if (scenario.opening_fixed_assets) {
    fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    const nextRow = { motor: 0, computer: 0 };
    for (const asset of scenario.opening_fixed_assets) {
      const rows = EXISTING_ASSET_ROWS[asset.category];
      if (!rows) throw new Error(`cellWrites: unknown opening_fixed_assets category "${asset.category}"`);
      const row = rows[nextRow[asset.category]++];
      if (row === undefined)
        throw new Error(`cellWrites: too many opening ${asset.category} assets for the Schedule template (max ${rows.length})`);
      // Written left-to-right (C, then E, then F). setCellValue/setCellString
      // in spreadsheet-runner.js replaces a matched cell together with every
      // self-closing sibling up to the row's next already-closed cell -- an
      // earlier write onto a later (rightward) column silently deletes any
      // not-yet-written cell in between, template formula cells included.
      // Once a cell has been written it is properly closed, so writing
      // strictly left-to-right, ending on the row's rightmost written
      // column, is the only order that survives every scenario the SE
      // template's row layout throws at it.
      if (asset.description) fa[`C${row}`] = asset.description;
      fa[`E${row}`] = asset.cost;
      if (asset.acc_dep) fa[`F${row}`] = asset.acc_dep;
      // Column O is the written down TAX value brought forward, the figure
      // the capital allowance columns work from. The schedule computes a
      // disposal's balancing allowance as that value less the sale proceeds,
      // so an asset sold in the year without one leaves the whole capital
      // allowance block, and every figure downstream of it, in error.
      if (asset.tax_wdv) fa[`O${row}`] = asset.tax_wdv;
      existingAssetRowsUsed[asset.category].push(row);
    }
  }

  // New fixed asset purchases (Purchases.xlsx code "fa") all land on the
  // New Plant & Machinery rows. FAreconciliation only checks the aggregate
  // New-asset total against Purchases.xlsx's cumulative fa total, not which
  // category holds it, so any category is a faithful, provable tie-out
  // target without inventing an asset-class taxonomy the scenario data
  // doesn't carry.
  const faPurchases = [];
  if (scenario.purchases) {
    for (const transactions of Object.values(scenario.purchases)) {
      for (const tx of transactions) if (tx.code === "fa") faPurchases.push(tx);
    }
  }
  if (faPurchases.length > 0) {
    if (!fixedAssetsWrites.Schedule) fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    if (faPurchases.length > NEW_PLANT_ROWS.length) {
      throw new Error(
        `cellWrites: ${faPurchases.length} "fa" purchase(s) exceed the ${NEW_PLANT_ROWS.length} Schedule New Plant & Machinery rows`,
      );
    }
    faPurchases.forEach((tx, i) => {
      const row = NEW_PLANT_ROWS[i];
      const d = parseDate(tx.date);
      // Left-to-right column order (B, then C, then E) -- see the opening
      // asset writer above for why the order matters.
      fa[`B${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (tx.supplier) fa[`C${row}`] = tx.supplier;
      fa[`E${row}`] = netOfVat(tx.amount, rate);
    });
  }

  // Fixed asset disposals (Sales.xlsx code "fs") pair with the existing
  // asset row they disposed of, in declaration order -- the sale value
  // (net of VAT) lands on the same row as the asset's original cost so the
  // Schedule's own disposal formulas (cost and depreciation at disposal)
  // resolve against the right asset.
  const fsDisposals = [];
  if (scenario.sales) {
    for (const transactions of Object.values(scenario.sales)) {
      for (const tx of transactions) if (tx.code === "fs") fsDisposals.push(tx);
    }
  }
  if (fsDisposals.length > 0) {
    if (!fixedAssetsWrites.Schedule) fixedAssetsWrites.Schedule = {};
    const fa = fixedAssetsWrites.Schedule;
    const disposalRows = [...existingAssetRowsUsed.motor, ...existingAssetRowsUsed.computer];
    if (fsDisposals.length > disposalRows.length) {
      throw new Error(
        `cellWrites: ${fsDisposals.length} "fs" disposal(s) but only ${disposalRows.length} existing fixed asset row(s) to attach them to`,
      );
    }
    fsDisposals.forEach((tx, i) => {
      const row = disposalRows[i];
      const d = parseDate(tx.date);
      fa[`U${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      fa[`V${row}`] = netOfVat(tx.amount, rate);
    });
  }

  if (scenario.hp_agreements) {
    if (!fixedAssetsWrites.HPfinance) fixedAssetsWrites.HPfinance = {};
    const hp = fixedAssetsWrites.HPfinance;
    if (scenario.hp_agreements.length > HP_AGREEMENT_ROWS.length) {
      throw new Error(
        `cellWrites: ${scenario.hp_agreements.length} hp_agreements but only ${HP_AGREEMENT_ROWS.length} HPfinance rows available`,
      );
    }
    scenario.hp_agreements.forEach((agreement, i) => {
      const row = HP_AGREEMENT_ROWS[i];
      const d = parseDate(agreement.date);
      hp[`B${row}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      hp[`C${row}`] = agreement.finance_company;
      hp[`D${row}`] = agreement.reference;
      hp[`E${row}`] = agreement.amount_financed;
      hp[`F${row}`] = agreement.admin_charges;
      hp[`G${row}`] = agreement.total_interest;
      hp[`H${row}`] = agreement.months;
      hp[`L${row}`] = agreement.supplier;
    });
  }

  // Straddling VAT periods (Vat.xlsx). A business registered for VAT on a
  // cycle that does not line up with its accounting year still has to return
  // the periods either side of it, and the workbook keeps a sales and a
  // purchases entry sheet for each. Nothing on these sheets reaches
  // Financialaccounts -- Vat.xlsx reads the hub and the two journals, never
  // the other way -- so an entry here moves the VAT return and leaves the
  // books alone.
  //
  // The purchases sheets carry a completeness warning in B2 that compares the
  // net total against expense analysis columns P:AL. Those columns exist on
  // the twelve month tabs but not on these sheets, so the warning fires for
  // any entry at all. Nothing reads it, so it is left unasserted.
  const vatReturnWrites = {};
  function writeStraddlingPeriod(entries, sheetPrefix, nameField, columns) {
    for (const entry of entries) {
      if (!STRADDLING_PERIOD_ROWS[entry.period]) {
        throw new Error(`Straddling VAT entry names period "${entry.period}", which Vat.xlsx has no sheet for`);
      }
      const sheetName = `${sheetPrefix}${entry.period}`;
      if (!vatReturnWrites[sheetName]) vatReturnWrites[sheetName] = {};
      const sheet = vatReturnWrites[sheetName];
      // Matching the whole reference rather than its first letter keeps a
      // write further right (AD, say) out of the count of rows already there.
      const amountColumnKey = new RegExp(`^${columns.amount}\\d+$`);
      const entryRow = Object.keys(sheet).filter((k) => amountColumnKey.test(k)).length + 5;
      const d = parseDate(entry.date);
      sheet[`${columns.date}${entryRow}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      if (entry[nameField]) sheet[`${columns.name}${entryRow}`] = entry[nameField];
      if (entry.invoice) sheet[`${columns.invoice}${entryRow}`] = entry.invoice;
      if (entry.description && columns.description) sheet[`${columns.description}${entryRow}`] = entry.description;
      sheet[`${columns.amount}${entryRow}`] = entry.amount;
    }
  }
  if (scenario.vat_straddling_sales) writeStraddlingPeriod(scenario.vat_straddling_sales, "S", "customer", STRADDLING_SALES_COLUMNS);
  if (scenario.vat_straddling_purchases)
    writeStraddlingPeriod(scenario.vat_straddling_purchases, "P", "supplier", STRADDLING_PURCHASES_COLUMNS);

  // Salesinvoice.xlsx: one sample invoice line for a VAT-registered business,
  // anchored to the fixture's own first sale so the customer-facing invoice
  // total and VAT can be checked against a real figure (see checkCompliance).
  const salesinvoiceWrites = {};
  // The invoice's own letterhead carries the business telephone number,
  // which no other sheet in these workbooks has a box for.
  if (scenario.business?.phone) salesinvoiceWrites["Business Details"] = { [SALESINVOICE_TELEPHONE_CELL]: scenario.business.phone };
  const firstInvoiceSale = Object.values(scenario.sales || {}).flat()[0];
  if (rate > 0 && scenario.business?.vat_number && firstInvoiceSale) {
    salesinvoiceWrites["Business Details"] = {
      ...salesinvoiceWrites["Business Details"],
      [SALESINVOICE_VAT_REG_CELL]: scenario.business.vat_number,
    };
    salesinvoiceWrites["Invoice Database"] = {
      [`${SALESINVOICE_INVOICE_DATABASE_COLUMNS.activate}2`]: 1,
      [`${SALESINVOICE_INVOICE_DATABASE_COLUMNS.invoiceNumber}2`]: 1,
      [`${SALESINVOICE_INVOICE_DATABASE_COLUMNS.carriage}2`]: SALESINVOICE_SAMPLE_CARRIAGE_CHARGE,
      [`${SALESINVOICE_INVOICE_DATABASE_COLUMNS.productCode1}2`]: SALESINVOICE_SAMPLE_PRODUCT_CODE,
      [`${SALESINVOICE_INVOICE_DATABASE_COLUMNS.quantity1}2`]: 1,
    };
    salesinvoiceWrites["Product Details"] = {
      [`${SALESINVOICE_PRODUCT_DETAILS_COLUMNS.price}${SALESINVOICE_SAMPLE_PRODUCT_ROW}`]: firstInvoiceSale.amount,
    };
  }

  const result = {
    "Sales.xlsx": salesWrites,
    "Purchases.xlsx": purchasesWrites,
  };
  if (Object.keys(vatReturnWrites).length > 0) result["Vat.xlsx"] = vatReturnWrites;
  if (Object.keys(bankWrites).length > 0) result["Bank.xlsx"] = bankWrites;
  if (Object.keys(cashWrites).length > 0) result["Cash.xlsx"] = cashWrites;
  if (Object.keys(hubWrites).length > 0) result["Financialaccounts.xlsx"] = hubWrites;
  if (Object.keys(payslipsWrites).length > 0) result["Payslips.xlsx"] = payslipsWrites;
  if (Object.keys(fixedAssetsWrites).length > 0) result["Fixedassets.xlsx"] = fixedAssetsWrites;
  if (Object.keys(salesinvoiceWrites).length > 0) result["Salesinvoice.xlsx"] = salesinvoiceWrites;
  return result;
}

// ── Standard reads for reconciliation ──────────────────────────────────────
// Reads from Financialaccounts.xlsx after cross-file recalculation.
//
// P&L (Profit & Loss Account) — column C for year totals:
//   C5=Sales Product A, C6=Product B, C7=Product C, C8=Other Income
//   C9=Sales Turnover, C14=Purchases, C15=Sub-contractors, C16=Other direct
//   C17=Cost of Sales, C19=Gross Profit, C21-C34=Admin expenses, C35=Total Admin
//   C37=Operating Profit, C39=Profit before Tax
//
// Income Tax — column E:
//   E5=Profit, E6=Personal Allowance after taper, E7=Taxable Income
//   E8=Basic rate tax, E9=Higher rate tax, E10=Additional rate tax
//   E11=Total Income Tax, E12=CIS deducted
//   E15=NI Class 4 lower, E16=NI Class 4 upper, E18=Total

export const TAX_SHEET = "Income Tax";
export const FORECAST_SHEET = "Profit Forecast";

// prettier-ignore
export const CELL_MAP = [
  // ── Business Details ──
  ["Business Details", "C5",  "Business Name",       "entityInformation.organizationIdentifier",  "Business Details", 0],
  // ── Profit & Loss Account ──
  ["Profit & Loss Account", "B5",  "Product A sales (code a)",  "accounts.sales.4000",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B6",  "Product B sales (code b)",  "accounts.sales.4001",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B7",  "Product C sales (code c)",  "accounts.sales.4002",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B8",  "Other Income",              "accounts.sales.4003",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B9",  "**Sales Turnover**",        "gl-cor:amount (salesTurnover)",  "Profit & Loss Account", 0],
  ["Profit & Loss Account", "B11", "Grants Received",           "accounts.sales.4004",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B14", "Materials / Stock",         "accounts.purchases.5000",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B15", "Sub-Contractors",           "accounts.purchases.5001",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B16", "Other Direct Costs",        "accounts.purchases.5002",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B17", "Cost of Sales",             "gl-cor:amount (costOfSales)",    "Profit & Loss Account", 0],
  ["Profit & Loss Account", "B19", "**Gross Profit**",          "gl-cor:amount (grossProfit)",    "Profit & Loss Account", 0],
  ["Profit & Loss Account", "B21", "Wages & Salaries",          "accounts.purchases.5101",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B22", "Light, Heat, Power",        "accounts.purchases.5201",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B23", "Repairs & Maintenance",     "accounts.purchases.5400",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B24", "General Admin",             "accounts.purchases.5501",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B25", "Motor Expenses",            "accounts.purchases.5601",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B26", "Travel & Subsistence",      "accounts.purchases.5600",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B27", "Advertising",               "accounts.purchases.5500",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B28", "Legal & Professional",      "accounts.purchases.5800",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B29", "Bad Debts",                 "accounts.sales.4005",            "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B30", "Bank Interest Paid",        "accounts.purchases.5701",        "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B31", "HP Interest, Lease, Bank Charges", "accounts.purchases.5702", "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B32", "Other Expenses",            "accounts.purchases (other)",     "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B33", "Loss (Profit) on Disposal of Assets", "gl-cor:amount (lossOnDisposal)", "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B34", "Depreciation",              "gl-cor:amount (depreciation)",   "Profit & Loss Account", 1],
  ["Profit & Loss Account", "B35", "Total Admin Expenses",      "gl-cor:amount (totalAdmin)",     "Profit & Loss Account", 0],
  ["Profit & Loss Account", "B37", "**Operating Profit**",      "gl-cor:amount (operatingProfit)","Profit & Loss Account", 0],
  ["Profit & Loss Account", "B39", "**Profit Before Tax**",     "gl-cor:amount (profitBeforeTax)","Profit & Loss Account", 0],
  // ── Income Tax ──
  [TAX_SHEET, "E5",  "Profit from Self Employment",  "gl-cor:amount (profitSE)",             "Income Tax Calculation", 0],
  [TAX_SHEET, "E6",  "Less: Personal Allowance",     "tax.incomeTax.personalAllowance",      "Income Tax Calculation", 1],
  [TAX_SHEET, "E7",  "Taxable Income",               "gl-cor:amount (taxableIncome)",        "Income Tax Calculation", 0],
  [TAX_SHEET, "E8",  "Tax at Basic Rate (20%)",      "tax.incomeTax.basicRate",              "Income Tax Calculation", 1],
  [TAX_SHEET, "C9",  "Basic band ceiling the sheet applies", "tax.incomeTax.basicBandEnd (applied)", "Income Tax Calculation", 1],
  [TAX_SHEET, "E9",  "Tax at Higher Rate (40%)",     "tax.incomeTax.higherRate",             "Income Tax Calculation", 1],
  [TAX_SHEET, "C10", "Additional rate threshold the sheet applies", "tax.incomeTax.higherBandEnd (applied)", "Income Tax Calculation", 1],
  [TAX_SHEET, "D10", "Additional rate the sheet applies",           "tax.incomeTax.additionalRate (applied)", "Income Tax Calculation", 1],
  [TAX_SHEET, "E10", "Tax at Additional Rate (45%)", "tax.incomeTax.additionalRate",         "Income Tax Calculation", 1],
  [TAX_SHEET, "E11", "**Total Income Tax**",         "tax.incomeTax (total)",                "Income Tax Calculation", 0],
  [TAX_SHEET, "E12", "Less: CIS Deducted",           "diya-gl:cisDeduction (total)",         "Income Tax Calculation", 1],
  [TAX_SHEET, "E15", "NI Class 4 (lower band)",      "tax.nationalInsurance.class4MainRate", "Income Tax Calculation", 1],
  [TAX_SHEET, "E16", "NI Class 4 (upper band)",      "tax.nationalInsurance.class4UpperRate","Income Tax Calculation", 1],
  [TAX_SHEET, "E18", "**Total Tax + NI**",           "gl-cor:taxAmount (totalTaxNI)",        "Income Tax Calculation", 0],
  // ── Profit Forecast — the projected year the customer plans against.
  // The actual half (rows 5 to 17) pulls the P&L's monthly columns; the
  // forecast half (rows 19 to 34) repeats each month that traded and spreads
  // the year's total across the months that did not, counting the trading
  // months in C21. The tax block below it charges the projected profit after
  // adding depreciation back and taking the schedule's capital allowances
  // off, and the P&L's own health check charges a twelfth of it a month.
  [FORECAST_SHEET, "C21", "Months of actual trade",      "gl-cor:amount (forecast.monthsTraded)",   "Profit Forecast", 1],
  [FORECAST_SHEET, "C22", "Forecast Sales Turnover",     "gl-cor:amount (forecast.turnover)",       "Profit Forecast", 1],
  [FORECAST_SHEET, "C24", "Forecast Investment Grants",  "gl-cor:amount (forecast.grants)",         "Profit Forecast", 1],
  [FORECAST_SHEET, "C26", "Forecast Cost of Sales",      "gl-cor:amount (forecast.costOfSales)",    "Profit Forecast", 1],
  [FORECAST_SHEET, "C30", "Forecast General Expenses",   "gl-cor:amount (forecast.expenses)",       "Profit Forecast", 1],
  [FORECAST_SHEET, "C33", "Forecast Interest Received",  "gl-cor:amount (forecast.interest)",       "Profit Forecast", 1],
  [FORECAST_SHEET, "C34", "**Forecast Profit before Tax**", "gl-cor:amount (forecast.profit)",      "Profit Forecast", 0],
  [FORECAST_SHEET, "C37", "Add Depreciation",            "gl-cor:amount (depreciation)",            "Profit Forecast", 1],
  [FORECAST_SHEET, "C38", "Less Capital Allowances",     "tax.capitalAllowances (schedule)",        "Profit Forecast", 1],
  [FORECAST_SHEET, "C39", "Profit before Tax",           "gl-cor:amount (forecast.taxableProfit)",  "Profit Forecast", 1],
  [FORECAST_SHEET, "C40", "Personal Allowance",          "tax.incomeTax.personalAllowance",         "Profit Forecast", 1],
  [FORECAST_SHEET, "C41", "Profit after Allowance",      "gl-cor:amount (forecast.taxableIncome)",  "Profit Forecast", 1],
  [FORECAST_SHEET, "C42", "Tax at standard rate",        "tax.incomeTax.basicRate",                 "Profit Forecast", 1],
  [FORECAST_SHEET, "C43", "Tax at higher rate",          "tax.incomeTax.higherRate",                "Profit Forecast", 1],
  [FORECAST_SHEET, "C44", "Tax at additional rate",      "tax.incomeTax.additionalRate",            "Profit Forecast", 1],
  [FORECAST_SHEET, "C45", "National Insurance",          "tax.nationalInsurance.class4",            "Profit Forecast", 1],
  [FORECAST_SHEET, "C46", "**Forecast Tax & NI Liability**", "gl-cor:taxAmount (forecast.totalTaxNI)", "Profit Forecast", 0],
  // ── SE Short (SA103S) ──
  // ── SE Short (SA103S) — formula cells only ──
  ["SE Short", "C8",   "Business name",                  "entityInformation.organizationIdentifier",  "Self Assessment (SA103S)", 0],
  ["SE Short", "S17",  "Accounting date",                "documentInfo.periodCoveredEnd",             "Self Assessment (SA103S)", 0],
  ["SE Short", "D38",  "Turnover",                       "gl-cor:amount (sa103s.turnover)",           "Self Assessment (SA103S)", 0],
  ["SE Short", "O38",  "Other business income",          "gl-cor:amount (sa103s.otherIncome)",        "Self Assessment (SA103S)", 1],
  // The return sets its expense captions in two columns. Reporting only the
  // left one leaves a reader adding up half the analysis against the whole
  // total, and finding it short.
  ["SE Short", "D46",  "Cost of sales",                  "gl-cor:amount (sa103s.costOfSales)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "D51",  "Car, van and travel",            "gl-cor:amount (sa103s.travel)",             "Self Assessment (SA103S)", 1],
  ["SE Short", "D55",  "Employee costs",                 "gl-cor:amount (sa103s.employeeCosts)",      "Self Assessment (SA103S)", 1],
  ["SE Short", "D60",  "Premises costs",                 "gl-cor:amount (sa103s.premises)",           "Self Assessment (SA103S)", 1],
  ["SE Short", "D64",  "Repairs and renewals",           "gl-cor:amount (sa103s.repairs)",            "Self Assessment (SA103S)", 1],
  ["SE Short", "O46",  "Accountancy, legal and professional", "gl-cor:amount (sa103s.legal)",         "Self Assessment (SA103S)", 1],
  ["SE Short", "O51",  "Interest and bank charges",      "gl-cor:amount (sa103s.interest)",           "Self Assessment (SA103S)", 1],
  ["SE Short", "O55",  "Phone, stationery and office costs", "gl-cor:amount (sa103s.office)",         "Self Assessment (SA103S)", 1],
  ["SE Short", "O60",  "Other business expenses",        "gl-cor:amount (sa103s.otherExpenses)",      "Self Assessment (SA103S)", 1],
  ["SE Short", "O64",  "**Total expenses**",             "gl-cor:amount (sa103s.totalExpenses)",      "Self Assessment (SA103S)", 0],
  ["SE Short", "D71",  "**Net profit/loss**",            "gl-cor:amount (sa103s.netProfit)",          "Self Assessment (SA103S)", 0],
  ["SE Short", "O71",  "Net loss (box 21)",              "gl-cor:amount (sa103s.netLoss)",            "Self Assessment (SA103S)", 1],
  ["SE Short", "D80",  "Capital allowances",             "tax.capitalAllowances (sa103s)",            "Self Assessment (SA103S)", 1],
  ["SE Short", "D85",  "AIA / WDA claimed",              "tax.capitalAllowances.aia (sa103s)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "O80",  "Other capital allowances (box 24)", "tax.capitalAllowances.wda (sa103s)",     "Self Assessment (SA103S)", 1],
  ["SE Short", "O85",  "Balancing charges (box 25)",     "tax.capitalAllowances.balancingCharge (sa103s)", "Self Assessment (SA103S)", 1],
  ["SE Short", "D94",  "Other tax adjustments",          "gl-cor:amount (sa103s.otherAdjust)",        "Self Assessment (SA103S)", 1],
  ["SE Short", "D99",  "**Taxable profit**",             "gl-cor:amount (sa103s.taxableProfit)",      "Self Assessment (SA103S)", 0],
  ["SE Short", "O94",  "Loss brought forward (box 28)",  "gl-cor:amount (sa103s.lossBroughtForward)", "Self Assessment (SA103S)", 1],
  ["SE Short", "O99",  "Grants as other business income (box 29)", "gl-cor:amount (sa103s.otherBusinessIncome)", "Self Assessment (SA103S)", 1],
  ["SE Short", "A33",  "Turnover note",                  "gl-cor:detailComment (sa103s.notes)",       "Self Assessment (SA103S)", 0],
  ["SE Short", "D106", "**Net profit for tax calc**",    "gl-cor:amount (sa103s.profitForTax)",       "Self Assessment (SA103S)", 0],
  // ── SE Full (SA103F) ──
  // The full return, live in the same workbook as the short one and fed from
  // the same profit and loss account and fixed asset schedule. Every cell
  // here carries a formula; the box numbers are the sheet's own, read out of
  // columns A and L beside each value. Nothing read this sheet back before,
  // so the full return could carry a different figure from the short one
  // beside it and no check would notice.
  ["SE Full", "D55",  "Turnover (box 15)",                     "gl-cor:amount (sa103f.turnover)",            "Self Assessment (SA103F)", 0],
  ["SE Full", "O55",  "Other business income (box 16)",        "gl-cor:amount (sa103f.otherIncome)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D66",  "Goods bought for resale (box 17)",      "gl-cor:amount (sa103f.costOfGoods)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D70",  "Subcontractor payments (box 18)",       "gl-cor:amount (sa103f.subcontractors)",      "Self Assessment (SA103F)", 1],
  ["SE Full", "D74",  "Wages, salaries and staff costs (box 19)", "gl-cor:amount (sa103f.staffCosts)",       "Self Assessment (SA103F)", 1],
  ["SE Full", "D78",  "Car, van and travel expenses (box 20)", "gl-cor:amount (sa103f.travel)",              "Self Assessment (SA103F)", 1],
  ["SE Full", "D82",  "Rent, rates, power and insurance (box 21)", "gl-cor:amount (sa103f.premises)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "D86",  "Repairs and maintenance (box 22)",      "gl-cor:amount (sa103f.repairs)",             "Self Assessment (SA103F)", 1],
  ["SE Full", "D90",  "Phone, stationery and office costs (box 23)", "gl-cor:amount (sa103f.office)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "D94",  "Advertising and entertainment (box 24)", "gl-cor:amount (sa103f.advertising)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "D98",  "Interest on bank and other loans (box 25)", "gl-cor:amount (sa103f.interest)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "D102", "Bank, credit card and finance charges (box 26)", "gl-cor:amount (sa103f.bankCharges)", "Self Assessment (SA103F)", 1],
  ["SE Full", "D106", "Irrecoverable debts written off (box 27)", "gl-cor:amount (sa103f.badDebts)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D110", "Accountancy, legal and professional fees (box 28)", "gl-cor:amount (sa103f.legal)",   "Self Assessment (SA103F)", 1],
  ["SE Full", "D114", "Depreciation and loss on sale of assets (box 29)", "gl-cor:amount (sa103f.depreciation)", "Self Assessment (SA103F)", 1],
  ["SE Full", "D118", "Other business expenses (box 30)",      "gl-cor:amount (sa103f.otherExpenses)",       "Self Assessment (SA103F)", 1],
  ["SE Full", "D122", "**Total expenses (box 31)**",           "gl-cor:amount (sa103f.totalExpenses)",       "Self Assessment (SA103F)", 0],
  ["SE Full", "O114", "Disallowable depreciation (box 44)",    "gl-cor:amount (sa103f.disallowableDepreciation)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O122", "**Total disallowable expenses (box 46)**", "gl-cor:amount (sa103f.totalDisallowable)", "Self Assessment (SA103F)", 0],
  ["SE Full", "D129", "**Net profit (box 47)**",               "gl-cor:amount (sa103f.netProfit)",           "Self Assessment (SA103F)", 0],
  ["SE Full", "O129", "Net loss (box 48)",                     "gl-cor:amount (sa103f.netLoss)",             "Self Assessment (SA103F)", 1],
  ["SE Full", "D139", "Annual investment allowance (box 49)",  "tax.capitalAllowances.aia (sa103f)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "D144", "Capital allowances at 18% (box 50)",    "tax.capitalAllowances.wda (sa103f)",         "Self Assessment (SA103F)", 1],
  ["SE Full", "O144", "100% and other enhanced capital allowances (box 55)", "tax.capitalAllowances.enhanced (sa103f)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O149", "Allowances on sale or cessation (box 56)", "tax.capitalAllowances.balancingAllowance (sa103f)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O154", "**Total capital allowances (box 57)**", "tax.capitalAllowances (sa103f)",             "Self Assessment (SA103F)", 0],
  ["SE Full", "O160", "Balancing charge (box 59)",             "tax.capitalAllowances.balancingCharge (sa103f)", "Self Assessment (SA103F)", 1],
  ["SE Full", "D169", "Goods and services for own use (box 60)", "gl-cor:amount (sa103f.ownUse)",            "Self Assessment (SA103F)", 1],
  ["SE Full", "D174", "**Total additions to net profit (box 61)**", "gl-cor:amount (sa103f.totalAdditions)", "Self Assessment (SA103F)", 0],
  ["SE Full", "O169", "**Total deductions from net profit (box 63)**", "gl-cor:amount (sa103f.totalDeductions)", "Self Assessment (SA103F)", 0],
  ["SE Full", "O174", "**Net business profit for tax purposes (box 64)**", "gl-cor:amount (sa103f.taxableProfit)", "Self Assessment (SA103F)", 0],
  ["SE Full", "O179", "Net business loss for tax purposes (box 65)", "gl-cor:amount (sa103f.taxableLoss)",   "Self Assessment (SA103F)", 1],
  ["SE Full", "O194", "**Adjusted profit (box 73)**",          "gl-cor:amount (sa103f.adjustedProfit)",      "Self Assessment (SA103F)", 0],
  ["SE Full", "O199", "Loss brought forward set against this year (box 74)", "gl-cor:amount (sa103f.lossBroughtForward)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O204", "Other business income not in boxes 15, 16 or 60 (box 75)", "gl-cor:amount (sa103f.otherBusinessIncome)", "Self Assessment (SA103F)", 1],
  ["SE Full", "O210", "**Total taxable profits from this business (box 76)**", "gl-cor:amount (sa103f.profitForTax)", "Self Assessment (SA103F)", 0],
  ["SE Full", "D219", "Adjusted loss (box 77)",                "gl-cor:amount (sa103f.adjustedLoss)",        "Self Assessment (SA103F)", 1],
  ["SE Full", "O224", "Total loss to carry forward (box 80)",  "gl-cor:amount (sa103f.lossCarriedForward)",  "Self Assessment (SA103F)", 1],
  ["SE Full", "D231", "Contractor deductions taken off (box 81)", "diya-gl:cisDeduction (sa103f)",           "Self Assessment (SA103F)", 1],
  // ── Wagesinterface (6m) — monthly payroll from Payslips.xlsx via external links ──
  ["Wagesinterface", "C4",  "Apr Gross Pay",    "diya-gl:grossPay (apr)",     "Payroll Summary", 1],
  ["Wagesinterface", "C5",  "May Gross Pay",    "diya-gl:grossPay (may)",     "Payroll Summary", 1],
  ["Wagesinterface", "C6",  "Jun Gross Pay",    "diya-gl:grossPay (jun)",     "Payroll Summary", 1],
  ["Wagesinterface", "C7",  "Jul Gross Pay",    "diya-gl:grossPay (jul)",     "Payroll Summary", 1],
  ["Wagesinterface", "C8",  "Aug Gross Pay",    "diya-gl:grossPay (aug)",     "Payroll Summary", 1],
  ["Wagesinterface", "C9",  "Sep Gross Pay",    "diya-gl:grossPay (sep)",     "Payroll Summary", 1],
  ["Wagesinterface", "C10", "Oct Gross Pay",    "diya-gl:grossPay (oct)",     "Payroll Summary", 1],
  ["Wagesinterface", "C11", "Nov Gross Pay",    "diya-gl:grossPay (nov)",     "Payroll Summary", 1],
  ["Wagesinterface", "C12", "Dec Gross Pay",    "diya-gl:grossPay (dec)",     "Payroll Summary", 1],
  ["Wagesinterface", "C13", "Jan Gross Pay",    "diya-gl:grossPay (jan)",     "Payroll Summary", 1],
  ["Wagesinterface", "C14", "Feb Gross Pay",    "diya-gl:grossPay (feb)",     "Payroll Summary", 1],
  ["Wagesinterface", "C15", "Mar Gross Pay",    "diya-gl:grossPay (mar)",     "Payroll Summary", 1],
  ["Wagesinterface", "D4",  "Apr PAYE",         "diya-gl:incomeTax (apr)",    "Payroll Summary", 1],
  ["Wagesinterface", "H4",  "Apr Employer NI",  "diya-gl:employerNI (apr)",   "Payroll Summary", 1],
  // ── VitalTax (6j partial) — quarterly P&L summary from hub ──
  ["VitalTax", "C5",  "Q1 Sales",         "gl-cor:amount (vitalTax.q1Sales)",    "Quarterly Summary", 1],
  ["VitalTax", "D5",  "Q2 Sales",         "gl-cor:amount (vitalTax.q2Sales)",    "Quarterly Summary", 1],
  ["VitalTax", "E5",  "Q3 Sales",         "gl-cor:amount (vitalTax.q3Sales)",    "Quarterly Summary", 1],
  ["VitalTax", "F5",  "Q4 Sales",         "gl-cor:amount (vitalTax.q4Sales)",    "Quarterly Summary", 1],
  ["VitalTax", "G5",  "**Annual Sales**",  "gl-cor:amount (vitalTax.annualSales)","Quarterly Summary", 0],
  ["VitalTax", "C7",  "Q1 Expenses",      "gl-cor:amount (vitalTax.q1Exp)",      "Quarterly Summary", 1],
  ["VitalTax", "D7",  "Q2 Expenses",      "gl-cor:amount (vitalTax.q2Exp)",      "Quarterly Summary", 1],
  ["VitalTax", "E7",  "Q3 Expenses",      "gl-cor:amount (vitalTax.q3Exp)",      "Quarterly Summary", 1],
  ["VitalTax", "F7",  "Q4 Expenses",      "gl-cor:amount (vitalTax.q4Exp)",      "Quarterly Summary", 1],
  ["VitalTax", "G7",  "**Annual Expenses**","gl-cor:amount (vitalTax.annualExp)", "Quarterly Summary", 0],
  // ── Admin (generator-injected tax data) — cell positions verified against
  // buildSeCellEdits() in app/lib/generator.js and the template's own labels.
  // SE's income tax band cells sit one row above BST's (M11/N12/N13 rather
  // than M12/N13/N14) and NI Class 2 sits at L16 rather than L17. The gl
  // mapping is the book field a cell states where the schema has one; the
  // band start, the AIA scale and the two mileage band edges have no schema
  // field of their own, and the export reconstructs the whole tax table from
  // the year file the package names rather than from any of these cells.
  // They stay in this map because it is also the read scope: both engines
  // publish exactly the cells named here, and checkCompliance reads these
  // against the tax data the package was generated from.
  ["Admin", "N4",  "Personal Allowance",                  "tax.incomeTax.personalAllowance",         "Admin (Generator Injected)", 0],
  ["Admin", "N5",  "Personal Allowance Taper Threshold",  "tax.incomeTax.personalAllowanceTaperThreshold", "Admin (Generator Injected)", 0],
  ["Admin", "N6",  "Basic Rate",                          "tax.incomeTax.basicRate",                 "Admin (Generator Injected)", 0],
  ["Admin", "N7",  "Higher Rate",                         "tax.incomeTax.higherRate",                "Admin (Generator Injected)", 0],
  ["Admin", "N8",  "Additional Rate",                     "tax.incomeTax.additionalRate",            "Admin (Generator Injected)", 0],
  ["Admin", "M11", "Basic Band End",                       "tax.incomeTax.basicRateLimit",            "Admin (Generator Injected)", 0],
  ["Admin", "N12", "Higher Band Start",                    "",                                        "Admin (Generator Injected)", 0],
  ["Admin", "N13", "Higher Band End",                      "tax.incomeTax.additionalRateThreshold",   "Admin (Generator Injected)", 0],
  ["Admin", "L16", "NI Class 2 Weekly Rate",               "tax.nationalInsurance.class2WeeklyRate",  "Admin (Generator Injected)", 0],
  ["Admin", "L20", "NI Class 4 Lower Rate",                "tax.nationalInsurance.class4MainRate",    "Admin (Generator Injected)", 0],
  ["Admin", "N20", "NI Class 4 Lower Limit",               "tax.nationalInsurance.class4LowerProfits", "Admin (Generator Injected)", 0],
  ["Admin", "L23", "NI Class 4 Upper Rate",                "tax.nationalInsurance.class4UpperRate",   "Admin (Generator Injected)", 0],
  ["Admin", "N23", "NI Class 4 Upper Limit",               "tax.nationalInsurance.class4UpperProfits", "Admin (Generator Injected)", 0],
  ["Admin", "G4",  "Annual Investment Allowance Rate",     "",                                        "Admin (Generator Injected)", 0],
  ["Admin", "G5",  "Writing Down Allowance Rate",          "tax.capitalAllowances.mainRateWDA",       "Admin (Generator Injected)", 0],
  ["Admin", "F21", "Mileage Higher Rate Limit",            "",                                        "Admin (Generator Injected)", 0],
  ["Admin", "G21", "Mileage Higher Rate Pence",            "tax.mileage.carFirst10000",               "Admin (Generator Injected)", 0],
  ["Admin", "F22", "Mileage Lower Rate Start",             "",                                        "Admin (Generator Injected)", 0],
  ["Admin", "G22", "Mileage Lower Rate Pence",             "tax.mileage.carOver10000",                "Admin (Generator Injected)", 0],
  ["Admin", "F26", "VAT Registration Threshold",           "tax.vat.registrationThreshold",           "Admin (Generator Injected)", 0],
  ["Admin", "F27", "VAT Standard Rate",                    "tax.vat.standardRate",                    "Admin (Generator Injected)", 0],
];

// Additional reads from leaf files (Bank.xlsx and Cash.xlsx closing
// balances, Vat.xlsx quarterly returns, Fixedassets.xlsx Schedule and
// FAreconciliation totals). Results are keyed "<filename>!<sheetName>", so
// Bank.xlsx!Mar and Cash.xlsx!Mar stay distinct even though both files carry
// a "Mar" sheet.
export function multiFileOptions() {
  // Every VATQtr sheet shares the same box layout (verified against the
  // template): G5 quarter-end date, G7 payment-due date, G9 box 1/3 output
  // VAT, G11 EU acquisitions (always a static 0 -- no formula, never
  // generator-written), G13 box 3 total (=G9+G11), G15 box 4 input VAT
  // reclaimed, G17 box 5 net VAT due (=G13-G15), G23 box 7 net purchases
  // value. Qtr5 is the quarter after Qtr4, for a trader whose stagger runs
  // past the accounting year end.
  const vatQtrCells = ["G5", "G7", "G9", "G11", "G13", "G15", "G17", "G21", "G23"];
  const vatQtrReads = {};
  for (let q = 1; q <= 5; q++) vatQtrReads[`VATQtr${q}`] = vatQtrCells;

  // The interface rows themselves, so a break in the VAT chain names the
  // period and the side it happened on instead of only showing up as a wrong
  // box value.
  const vatinterfaceCells = [];
  for (let row = VATINTERFACE_ROWS.first; row <= VATINTERFACE_ROWS.last; row++) {
    for (const col of ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "M"]) vatinterfaceCells.push(`${col}${row}`);
  }
  vatQtrReads.Vatinterface = vatinterfaceCells;

  // Each month tab's own VAT and net totals, on both journals -- the leaf
  // figures the interface rows are measured against. H1 is the month's VAT
  // and I1 its net total on both the Sales and the Purchases tabs.
  const salesMonthReads = {};
  const purchasesMonthReads = {};
  for (const tab of Object.values(MONTH_SHEETS)) {
    salesMonthReads[tab] = ["H1", "I1", VAT_RATE_CELL];
    // AD1 is the month's CIS certificates total (SUM(AD5:AD300)) and A1 the
    // sheet's own check total, G1 - H1 - SUM(P1:AB1), which is the closest
    // this product has to a trial balance: nil means every row's gross has
    // reached its VAT column and one expense column and nothing else.
    // Row 2 is the sheet's own mileage claim: C2 the business miles to date,
    // pooling this tab's own column D with the Sales month's D1; G2 the claim
    // the month adds, banded at the Admin rates; A2 the claim to date.
    purchasesMonthReads[tab] = ["A1", "A2", "C2", "G2", "H1", "I1", VAT_RATE_CELL, "AD1"];
  }

  // Payslips!Payment — the PAYE remittance schedule, one row per tax month
  // (rows 4-15 = Apr-Mar, same layout as Wagesinterface). B is the tax month
  // end and C the day the payment falls due, both off the payroll calendar;
  // D = NI due (employer + employee), E = income tax due, I = total amount
  // payable (verified against the template: B4=Admin!$B$26, C4=Admin!$B$45,
  // D4=Apr!T1+Apr!O1, E4=Apr!N1, I4=D4+E4-F4-G4+H4, with F/G/H always 0 in
  // this fixture -- no statutory pay or student loan data).
  const paymentCells = {};
  for (const row of WAGES_MONTH_ROWS) paymentCells[row] = ["B", "C", "D", "E", "I"].map((c) => `${c}${row}`);

  // Each month tab's own whole-month totals on row 1, which is what the
  // schedule row above reads it through. Jul and Aug carry more: their dead
  // cells and brought-forward cells (see PAYSLIPS_JUL_DEAD_CELLS and
  // PAYSLIPS_AUG_BROUGHT_FORWARD_CELLS above) plus the rows the fixture
  // populates, so a break in either area is caught on its own month instead
  // of only through the Payment/Admin aggregates.
  const payslipsMonthTabReads = {};
  for (const monthKey of MONTH_KEYS) payslipsMonthTabReads[MONTH_SHEETS[monthKey]] = [...Object.values(PAYE_SCHEDULE_MONTH_TAB_CELLS)];
  payslipsMonthTabReads[MONTH_SHEETS[MONTH_KEYS[PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[0]]]].push(
    ...PAYSLIPS_JUL_DEAD_CELLS,
    ...payslipsMonthEntryCells(PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[0]),
  );
  payslipsMonthTabReads[MONTH_SHEETS[MONTH_KEYS[PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[1]]]].push(
    ...PAYSLIPS_AUG_BROUGHT_FORWARD_CELLS,
    ...payslipsMonthEntryCells(PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[1]),
  );

  return {
    postHubRecalc: ["Vat.xlsx"],
    additionalReads: {
      "Bank.xlsx": { Mar: ["A1", "A2"] },
      "Cash.xlsx": { Mar: ["A1", "A2"] },
      // G1 = SUM(G5:G300), the total gross debtor/creditor value on each sheet.
      "Sales.xlsx": {
        OpeningDebtors: ["G1"],
        ClosingDebtors: ["G1"],
        ...salesMonthReads,
      },
      "Purchases.xlsx": {
        OpeningCreditors: ["G1"],
        ClosingCreditors: ["G1"],
        ...purchasesMonthReads,
      },
      "Vat.xlsx": vatQtrReads,
      "Fixedassets.xlsx": {
        // E57 and E110 are the schedule's own existing-asset and new-asset
        // cost subtotals; row 1 adds the two. Reading both lets the report
        // state the year's asset movement rather than one closing total.
        Schedule: ["E1", "F1", "G1", "I1", "J1", "K1", "Q1", "R1", "S1", "V1", "W1", "X1", "Y1", "Z1", "E57", "E110"],
        FAreconciliation: ["E11", "E13", "E15", "K11", "K13", "K15"],
        // E2 is the long-term-creditors total for the "New Hire Purchase
        // Agreements" block (SUM(E8:E14)); I/J/K on rows 8 and 10 are the
        // two scenario agreements' own monthly payment, capital and
        // interest split.
        HPfinance: ["E2", "I8", "J8", "K8", "I10", "J10", "K10"],
      },
      "Payslips.xlsx": {
        ...payslipsMonthTabReads,
        Payment: Object.values(paymentCells).flat(),
        // The printed payslip. H3/H4 are the join itself; L7, I9 and I10 are
        // the block heading it lands on, and the rest is the first
        // employee's line and its year-to-date row.
        [PAYSLIP_PRINT_SHEET]: [
          PAYSLIP_PRINT_CELLS.tab,
          PAYSLIP_PRINT_CELLS.blockRow,
          "L7",
          "I9",
          "I10",
          "M8",
          "G14",
          "H14",
          "I14",
          "M14",
          "G16",
          "H16",
          "I16",
          "M16",
          "M18",
        ],
        // The payroll calendar the generator writes for the package's tax
        // year: B2 its seed date, I1 (=B366) the year it runs to, N1 the tax
        // year label the payslips print, and the name, date and month number
        // on each sampled row.
        Admin: ["B2", "I1", "N1", ...PAYROLL_CALENDAR_SAMPLE_ROWS.flatMap((row) => [`A${row}`, `B${row}`, `D${row}`])],
      },
      // The customer-facing invoice: the VAT rate the generator wrote into
      // the sample product row, and the one sample line's net, VAT and gross
      // (verified against the XML: P58 = SUM(P38:P57), P62 =
      // IF(P58<>0,SUM(V38:V57)+P60*'Product Details'!$D$2/100,0), P64 =
      // SUM(P58:Q62)).
      "Salesinvoice.xlsx": {
        "Product Details": [`${SALESINVOICE_PRODUCT_DETAILS_COLUMNS.vatRate}${SALESINVOICE_SAMPLE_PRODUCT_ROW}`],
        "Invoice Template": [
          SALESINVOICE_INVOICE_TEMPLATE_CELLS.netTotal,
          SALESINVOICE_INVOICE_TEMPLATE_CELLS.carriageNet,
          SALESINVOICE_INVOICE_TEMPLATE_CELLS.vatTotal,
          SALESINVOICE_INVOICE_TEMPLATE_CELLS.grossTotal,
          SALESINVOICE_LINE1_CELLS.unitPrice,
          SALESINVOICE_LINE1_CELLS.quantity,
          SALESINVOICE_LINE1_CELLS.lineNet,
          SALESINVOICE_LINE1_CELLS.lineVat,
        ],
      },
    },
  };
}

// Month tab order (matches MONTH_SHEETS/scenario key order) and the P&L
// column each occupies -- verified against the template (C=Apr .. N=Mar).
const MONTH_KEYS = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];
const MONTH_COLS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

// P&L rows fed by a single Sales.xlsx/Purchases.xlsx code column with no
// other adjustment mixed in (verified against the template's per-month
// formulas), keyed by the scenario transaction code letter. Materials
// (P&L row 14) also carries a StockControl adjustment and Wages (row 21)
// also carries a Wagesinterface payroll addback, so neither ties 1:1 to a
// single month's code total and both are left out here.
const SALES_MONTHLY_TIE_ROWS = { a: 5, b: 6, c: 7, d: 8, g: 11 };
// Sales code "o" ("Other") feeds P&L row 29 ("Bad Debts written off")
// negated -- a template quirk, not a naming error; verified against the
// formula (`C29 = -[2]Apr!$U$1`).
const SALES_BAD_DEBT_ROW = 29;
const PURCHASES_MONTHLY_TIE_ROWS = { c: 15, o: 16, p: 22, m: 23, g: 24, v: 25, h: 26, a: 27, l: 28, y: 32 };

// The P&L's own caption for each tied row, taken from column A of the
// template. The netting table names a category the way the statement it
// feeds names it, so a reader can follow the letter to the line.
const PL_ROW_CAPTIONS = {
  5: "Sales Product A",
  6: "Sales Product B",
  7: "Sales Product C",
  8: "Other Income",
  11: "Investment Grants received",
  14: "Purchases after stock adjustment",
  15: "Sub contractors",
  16: "Other Direct Cost of Sales",
  22: "Premises Rent Rates Power",
  23: "Repairs & Maintenance",
  24: "General Administrative Expenses",
  25: "Motor Expenses",
  26: "Travel Hotel & Subsistence",
  27: "Advertising & Promotion",
  28: "Legal & Professional Fees",
  29: "Bad Debts written off",
  32: "Other Expenses",
};

// Wagesinterface and Payslips!Payment both hold one row per month, Apr at
// row 4 through Mar at row 15 — verified against the template. SE always
// runs a 6 April year-end, so this row order matches MONTH_KEYS directly
// with no year-end shift (unlike Ltd, which has to remap via fiscalTabs).
const WAGES_MONTH_ROWS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// Payslips.xlsx Jul (sheet5.xml) and Aug (sheet6.xml) shipped with 35 dead
// #REF! cells: Jul!F11:F15 lost the weekly-block pay-date reference
// (Employee!F$24/F$26 compared against E$9), Jul!T41 carried a stray
// formula where every other month has a literal 0, and Aug!H11:M15 (K only
// on rows 12-15) lost the previous month's row-41 brought-forward
// reference. additionalReads never read either tab directly -- only the
// Payment/Admin aggregates -- so none of it ever surfaced. Every fixture's
// employees pay monthly, so the weekly-block gate (Employee!D$28 etc = "m")
// and the carry-forward gate (Aug!T$9 = "Y") are never true: both blocks
// always resolve to their blank/nil branch regardless of what the broken
// formula pointed at, which is exactly why the #REF!s shipped unnoticed.
const PAYSLIPS_WEEKLY_ROWS = [11, 12, 13, 14, 15];
const PAYSLIPS_JUL_DEAD_CELLS = [...PAYSLIPS_WEEKLY_ROWS.map((row) => `F${row}`), "T41"];
const PAYSLIPS_AUG_BROUGHT_FORWARD_CELLS = PAYSLIPS_WEEKLY_ROWS.flatMap((row) => {
  const cells = ["H", "I", "J", "L", "M"].map((col) => `${col}${row}`);
  if (row >= 12) cells.push(`K${row}`);
  return cells;
});

// The cells Payslips.xlsx cellWrites populates for a month's payroll, one
// employee a row down the month's own monthly block, plus the wages-paid date
// the block is dated from.
const payslipsMonthEntryCells = (monthIndex) => [
  payslipsWagesPaidCell(monthIndex),
  ...payslipsMonthEntryRows(monthIndex).flatMap((row) => Object.values(PAYSLIPS_ENTRY_COLUMNS).map((col) => `${col}${row}`)),
];

// Payslips.xlsx!Admin holds a day-by-day payroll calendar: column A the
// payroll month's name, B the date, C the week number, D the payroll month
// number and F the week within that month. Row 2 is the first day of the tax
// year and the sheet runs to row 381. These rows sample it -- one inside each
// of the twelve payroll months, then the last day of the tax year (366) and
// the last row on the sheet. Nothing about a check depends on which month a
// sampled row falls in: each one reads the month number off the sheet itself.
const PAYROLL_CALENDAR_SAMPLE_ROWS = [2, 33, 64, 95, 126, 157, 188, 219, 250, 281, 312, 343, 366, 381];

// The month names the payroll calendar's own formula produces
// (TEXT(DATE(...),"Mmm") on the tax year start plus the month number).
const SHORT_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function standardReads() {
  const reads = {};
  for (const [sheet, cell] of CELL_MAP) {
    if (!reads[sheet]) reads[sheet] = [];
    if (!reads[sheet].includes(cell)) reads[sheet].push(cell);
  }
  const plRows = [
    ...new Set([
      ...Object.values(SALES_MONTHLY_TIE_ROWS),
      SALES_BAD_DEBT_ROW,
      ...Object.values(PURCHASES_MONTHLY_TIE_ROWS),
      33,
      34,
      // The Profit Forecast repeats the P&L's own monthly turnover (row 9)
      // and interest received (row 38), so the forecast checks can count the
      // months that traded and tie the projected year to the actual one.
      9,
      38,
    ]),
  ];
  reads["Profit & Loss Account"] = reads["Profit & Loss Account"] || [];
  for (const row of plRows) {
    // Column B is the row's own SUM(C:N), the annual figure the netting
    // table compares a journal category against.
    for (const col of ["B", ...MONTH_COLS]) {
      const cell = `${col}${row}`;
      if (!reads["Profit & Loss Account"].includes(cell)) reads["Profit & Loss Account"].push(cell);
    }
  }

  // Wagesinterface — one row per month (rows 4-15 = Apr-Mar), columns
  // C=gross pay, D=PAYE income tax, E=employee NI, H=employer NI (verified
  // against the template: C4=[6]Apr!$M$1, D4=$N$1, E4=$O$1, H4=$T$1). CELL_MAP
  // above already carries C4-C15 for the report; the rest are read here so
  // every month is available to check without bloating the report appendix.
  reads.StockControl = [STOCK_OPENING_COUNT_CELL, STOCK_CLOSING_COUNT_CELL];

  // SE Full cells the return quotes without them being boxes of their own,
  // plus the boxes it prints with no formula behind them. The quoted cells
  // are the online filing deadline banner (G1, "...by 31st January "&TEXT
  // (Admin!B21,"yyyy")), the period the return covers (Q2 = Admin!B4, V2 =
  // Admin!B17) and the writing down rate and Class 4 threshold it prints in
  // its captions (G141 = Admin!G5, J280 = Admin!N20). The empty ones are
  // boxes 51, 52, 52.1, 53, 54 and 62, which a customer fills in by hand;
  // reading them lets the box 57 and 63 totals be checked as the exact sums
  // the sheet computes rather than sums with terms left out.
  reads["SE Full"] = reads["SE Full"] || [];
  for (const cell of ["G1", "Q2", "V2", "G141", "J280", "D147", "D152", "D156", "D160", "O139", "D179"]) {
    if (!reads["SE Full"].includes(cell)) reads["SE Full"].push(cell);
  }

  // The Admin sheet's tax year start, end and filing deadline. Everything
  // else the Admin echo checks compares is a rate or a threshold already in
  // CELL_MAP; these are dates, and they anchor the SA103F period, the online
  // filing deadline banner and the payroll calendar.
  reads.Admin = reads.Admin || [];
  for (const cell of ["B4", "B17", "B21"]) if (!reads.Admin.includes(cell)) reads.Admin.push(cell);

  reads.Wagesinterface = reads.Wagesinterface || [];
  for (let i = 0; i < WAGES_MONTH_ROWS.length; i++) {
    for (const col of ["C", "D", "E", "H"]) {
      const cell = `${col}${WAGES_MONTH_ROWS[i]}`;
      if (!reads.Wagesinterface.includes(cell)) reads.Wagesinterface.push(cell);
    }
  }

  return reads;
}

// What a section's cells actually sum, where the caption on the cells alone
// would read as the whole trade. The VitalTax sheet quotes the three product
// sales rows and the two direct cost rows, nothing else, so its annual
// expenses figure is a fraction of the return's total expenses by design.
const SECTION_CAPTIONS = {
  "Quarterly Summary": [
    "Sales here are the three product lines only (Profit & Loss Account rows 5 to 7), and expenses are the direct cost lines only (Materials and Other Direct Cost of Sales).",
    "Grants, other income and every administrative expense are outside this summary and appear in the profit and loss account and on the SA103S.",
  ],
};

export function reportSections(results) {
  const sectionMap = new Map();
  for (const [sheet, cell, label, , section, indent] of CELL_MAP) {
    if (!sectionMap.has(section)) sectionMap.set(section, []);
    const val = results[sheet]?.[cell];
    sectionMap.get(section).push({ label, value: fmt(val), indent });
  }
  for (const [section, captions] of Object.entries(SECTION_CAPTIONS)) {
    const rows = sectionMap.get(section);
    if (rows) rows.unshift(...captions.map((label) => ({ label, value: "" })));
  }
  const sections = [...sectionMap.entries()].map(([title, rows]) => ({ title, rows }));
  const fixedAssets = fixedAssetSection(results);
  if (fixedAssets) sections.push(fixedAssets);
  const vat = vatSection(results);
  if (vat) sections.push(vat);
  return sections;
}

// The year's asset movement, laid out the way a fixed asset note lays it out.
// The package has no such note, so without this the only closing figure in
// the report is the schedule's own K1 column total.
function fixedAssetSection(results) {
  const schedule = results["Fixedassets.xlsx!Schedule"];
  if (!schedule) return null;

  const num = (v) => (typeof v === "number" ? v : 0);
  const costBroughtForward = num(schedule.E57);
  const additions = num(schedule.E110);
  const disposalCost = num(schedule.W1);
  const costCarriedForward = costBroughtForward + additions - disposalCost;
  const depreciationBroughtForward = num(schedule.F1);
  const charge = num(schedule.I1);
  const disposalDepreciation = num(schedule.X1);
  const depreciationCarriedForward = depreciationBroughtForward + charge - disposalDepreciation;
  const disposalBookValue = disposalCost - disposalDepreciation;

  return {
    title: "Fixed Asset Schedule",
    rows: [
      { label: "Cost brought forward (Schedule E57)", value: fmt(costBroughtForward), indent: 1 },
      { label: "Additions in the year (Schedule E110)", value: fmt(additions), indent: 1 },
      { label: "Cost of the assets sold in the year (Schedule W1)", value: fmt(disposalCost), indent: 1 },
      { label: "**Cost carried forward, disposals removed**", value: fmt(costCarriedForward), indent: 0 },
      { label: "Accumulated depreciation brought forward (Schedule F1)", value: fmt(depreciationBroughtForward), indent: 1 },
      { label: "Depreciation charged for the year (Schedule I1)", value: fmt(charge), indent: 1 },
      { label: "Accumulated depreciation on the assets sold (Schedule X1)", value: fmt(disposalDepreciation), indent: 1 },
      { label: "**Accumulated depreciation carried forward, disposals removed**", value: fmt(depreciationCarriedForward), indent: 0 },
      {
        label: "**Net book value at the year end (Schedule K1)**",
        value: fmt(costCarriedForward - depreciationCarriedForward),
        indent: 0,
      },
      { label: "", value: "" },
      { label: "Sale proceeds of the assets sold, net of VAT (Schedule V1)", value: fmt(num(schedule.V1)), indent: 1 },
      { label: "Net book value of the assets sold at the date of sale", value: fmt(disposalBookValue), indent: 1 },
    ],
  };
}

// The VAT the books actually charged, taken from the month tabs and from the
// return itself. Every other statement in this report is stated net, so a
// registered trader and an unregistered one carrying the same trade read
// identically without it.
function vatSection(results) {
  const months = Object.values(MONTH_SHEETS)
    .map((tab) => [results[`Sales.xlsx!${tab}`], results[`Purchases.xlsx!${tab}`]])
    .filter(([sales, purchases]) => sales || purchases);
  if (months.length === 0) return null;

  const num = (v) => (typeof v === "number" ? v : 0);
  const sum = (side, cell) => months.reduce((total, pair) => total + num(pair[side]?.[cell]), 0);
  const salesVat = sum(0, "H1");
  const salesNet = sum(0, "I1");
  const purchasesVat = sum(1, "H1");
  const purchasesNet = sum(1, "I1");

  const rows = [
    { label: "Sales invoiced including VAT", value: fmt(salesNet + salesVat), indent: 1 },
    { label: "VAT charged on sales", value: fmt(salesVat), indent: 1 },
    { label: "Sales net of VAT", value: fmt(salesNet), indent: 1 },
    { label: "Purchases invoiced including VAT", value: fmt(purchasesNet + purchasesVat), indent: 1 },
    { label: "VAT reclaimed on purchases", value: fmt(purchasesVat), indent: 1 },
    { label: "Purchases net of VAT", value: fmt(purchasesNet), indent: 1 },
    { label: "**VAT due for the year**", value: fmt(salesVat - purchasesVat), indent: 0 },
  ];
  // The package ships five return forms: four quarters from the VAT start
  // month and one more, for a business whose quarter stagger does not line up
  // with those four. Printing four left the fifth out of the report
  // altogether. Each form carries the period it was filled in for, and the
  // cycle rows above the boxes say which months each one reaches.
  const forms = [];
  const quarterRows = [];
  for (let q = 1; q <= 5; q++) {
    const boxes = results[`Vat.xlsx!VATQtr${q}`];
    if (!boxes) continue;
    const end = num(boxes.G5);
    forms.push({ name: `Q${q}`, end: vatinterfaceRowEnding(results, end) });
    const period = periodEnding(end);
    quarterRows.push({ label: `Q${q}${period} box 1: VAT due on sales`, value: fmt(num(boxes.G9)), indent: 1 });
    quarterRows.push({ label: `Q${q}${period} box 4: VAT reclaimed on purchases`, value: fmt(num(boxes.G15)), indent: 1 });
    quarterRows.push({ label: `Q${q}${period} box 5: net VAT due`, value: fmt(num(boxes.G17)), indent: 1 });
  }
  if (quarterRows.length > 0) {
    rows.push(...vatCycleRows(vatinterfacePeriods(results), forms));
    rows.push({ label: "**The return forms as the package fills them in**", value: "" });
    rows.push(...quarterRows);
  }
  return { title: "VAT Returns", rows };
}

// The asset workbook's totals rows carry no caption of their own, so the
// appendix printed them as bare letters and a reader had to guess which
// column was cost, which was depreciation and which was the disposals.
// Every label here is the column's formula read back from the template.
const FIXED_ASSET_CELL_LABELS = {
  "Fixedassets.xlsx!Schedule": {
    E1: "Total cost of every asset on the schedule, assets sold in the year included",
    F1: "Total accumulated depreciation brought forward",
    G1: "Total net book value brought forward (cost less depreciation brought forward)",
    I1: "Total depreciation charged for the year",
    J1: "Total accumulated depreciation carried forward (brought forward plus the charge)",
    K1: "Total net book value carried forward, disposals removed",
    Q1: "Total annual investment allowance claimed",
    R1: "Total writing down allowance claimed",
    S1: "Total tax written down value carried forward",
    V1: "Sale proceeds of the assets sold in the year, net of VAT",
    W1: "Cost of the assets sold in the year",
    X1: "Accumulated depreciation on the assets sold in the year",
    Y1: "Balancing allowance on the disposals",
    Z1: "Balancing charge on the disposals",
    E57: "Cost of the assets owned at the start of the year",
    E110: "Cost of the assets bought during the year",
  },
  "Fixedassets.xlsx!FAreconciliation": {
    E11: "Additions the schedule lists, net of VAT",
    E13: "Fixed asset purchases the purchase journal carries, net of VAT",
    E15: "Purchases less schedule additions",
    K11: "Disposal proceeds the schedule lists, net of VAT",
    K13: "Fixed asset sales the sales journal carries, net of VAT",
    K15: "Sales less schedule disposals",
  },
};

// ── The unit every read cell is compared in ────────────────────────────────
//
// A money value is compared to the penny, a rate to six places, and a date, a
// count, a name and a verdict exactly. Both engines carry binary floating point
// and the xls roundtrip re-serialises it, so a money cell has to be rounded
// before it is compared or a difference far below a penny reads as a defect. A
// cell with no declared unit is compared exactly, so a unit only ever loosens.

// Admin holds rates, thresholds and dates side by side, so its own cells say
// which is which. Everything else on that sheet is an amount.
const ADMIN_RATE_CELLS = new Set([
  "N6",
  "N7",
  "N8",
  "K11",
  "K12",
  "K13",
  "L20",
  "L23",
  "G4",
  "G5",
  "G13",
  "G14",
  "G15",
  "G16",
  "G17",
  "G21",
  "G22",
  "F27",
]);
const ADMIN_MILEAGE_BAND_CELLS = new Set(["F21", "F22"]);
const ADMIN_TAX_YEAR_LABEL_CELLS = new Set(["B23", "B24"]);

function columnOf(cell) {
  return cell.match(/^[A-Z]+/)[0];
}

/**
 * The unit one cell carries, by the sheet it sits on.
 * @param {string} sheet - a hub sheet name, or "<file>!<sheet>" for a leaf
 * @param {string} cell
 * @returns {string}
 */
export function unitFor(sheet, cell) {
  const column = columnOf(cell);
  // C2 on a Purchases month tab is the business miles claimed to date, the
  // one figure on either journal that is a distance rather than a sum.
  if (sheet.startsWith("Purchases.xlsx!")) return cell === VAT_RATE_CELL ? "rate" : cell === "C2" ? "count" : "money";
  if (sheet.startsWith("Sales.xlsx!")) return cell === VAT_RATE_CELL ? "rate" : "money";
  if (sheet === "Vat.xlsx!Vatinterface") return column === "B" || column === "C" ? "date" : column === "M" ? "rate" : "money";
  if (sheet.startsWith("Vat.xlsx!VATQtr")) return cell === "G5" || cell === "G7" ? "date" : "money";
  if (sheet === "Payslips.xlsx!Admin") {
    if (cell === "N1") return "text";
    if (column === "A") return "text";
    if (column === "B" || cell === "I1") return "date";
    return "count";
  }
  switch (sheet) {
    case "Business Details":
      return "text";
    case "Admin":
      if (ADMIN_TAX_YEAR_LABEL_CELLS.has(cell)) return "text";
      if (column === "B") return "date";
      if (ADMIN_RATE_CELLS.has(cell)) return "rate";
      if (ADMIN_MILEAGE_BAND_CELLS.has(cell)) return "count";
      return "money";
    case TAX_SHEET:
      if (cell === "C13") return "date";
      return column === "D" ? "rate" : "money";
    case FORECAST_SHEET:
      return cell === "C21" ? "count" : "money";
    case "SE Short":
      if (cell === "C8" || cell === "A33") return "text";
      if (cell === "S17" || cell === "Q2" || cell === "V2") return "date";
      return "money";
    case "SE Full":
      if (cell === "Q2" || cell === "V2") return "date";
      if (cell === "G141") return "rate";
      return "money";
    case "Wagesinterface":
      return column === "B" ? "date" : "money";
    default:
      return "money";
  }
}

export function cellLabels() {
  const named = {};
  for (const [sheet, cell, diyLabel, glMapping] of CELL_MAP) named[`${sheet}!${cell}`] = { diyLabel, glMapping };
  for (const [sheet, cells] of Object.entries(FIXED_ASSET_CELL_LABELS)) {
    for (const [cell, diyLabel] of Object.entries(cells)) named[`${sheet}!${cell}`] = { diyLabel, glMapping: "" };
  }

  // Every cell either side reads carries a unit, whether or not the report
  // prints a caption beside it.
  const readScope = { ...standardReads() };
  for (const [file, sheets] of Object.entries(multiFileOptions().additionalReads)) {
    for (const [sheet, cells] of Object.entries(sheets)) readScope[`${file}!${sheet}`] = cells;
  }

  const labels = {};
  for (const [sheet, cells] of Object.entries(readScope)) {
    for (const cell of cells) {
      const key = `${sheet}!${cell}`;
      labels[key] = { diyLabel: "", glMapping: "", ...named[key], unit: unitFor(sheet, cell) };
    }
  }
  for (const [key, entry] of Object.entries(named)) {
    if (!labels[key]) labels[key] = { ...entry, unit: unitFor(key.slice(0, key.lastIndexOf("!")), key.slice(key.lastIndexOf("!") + 1)) };
  }
  return labels;
}

function fmt(v) {
  if (v === null || v === undefined || v === "" || v === " ") return "—";
  // A nil that arrived by negation carries a sign bit and prints as "-0",
  // which reads as a defect in a statement.
  if (typeof v === "number") return (v === 0 ? 0 : v).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return String(v);
}

// ── Accounting profit to tax profit bridge ─────────────────────────────────

// Depreciation is not allowable for income tax, so the return's total
// expenses line takes it back out and the capital allowance boxes stand in
// for it. Grants sit in the accounts above gross profit; on the return they
// are box 29, added after the trade's own taxable profit. Interest received
// stays put: profit before tax carries it and box 9 carries it, so it is
// inside both ends of the bridge and needs no line of its own.
export function profitBridge(results) {
  const pl = results["Profit & Loss Account"];
  const seShort = results["SE Short"];
  const tax = results[TAX_SHEET];
  if (!pl || !seShort || !tax) return null;

  const num = (v) => (typeof v === "number" ? v : 0);
  const rows = [
    { label: "Profit before tax per the profit and loss account", cell: "Profit & Loss Account!B39", value: num(pl.B39) },
    { label: "Add depreciation charged in the accounts", cell: "Profit & Loss Account!B34", value: num(pl.B34) },
    { label: "Less grants, taxed as other business income below", cell: "Profit & Loss Account!B11", value: -num(pl.B11) },
    { label: "Less net loss for the year (box 21)", cell: "SE Short!O71", value: -num(seShort.O71) },
    { label: "Less annual investment allowance (box 22)", cell: "SE Short!D80", value: -num(seShort.D80) },
    { label: "Less small-balance allowance (box 23)", cell: "SE Short!D85", value: -num(seShort.D85) },
    { label: "Less other capital allowances (box 24)", cell: "SE Short!O80", value: -num(seShort.O80) },
    { label: "Add balancing charges (box 25)", cell: "SE Short!O85", value: num(seShort.O85) },
    { label: "Add goods and services for own use (box 26)", cell: "SE Short!D94", value: num(seShort.D94) },
    { label: "Add grants as other business income (box 29)", cell: "SE Short!O99", value: num(seShort.O99) },
    { label: "Less loss brought forward (box 28)", cell: "SE Short!O94", value: -num(seShort.O94) },
  ];

  return buildProfitBridge(rows, `${TAX_SHEET}!E5`, num(tax.E5));
}

// ── Journal category VAT netting ───────────────────────────────────────────

// A journal row takes its own VAT off its own gross and rounds nothing
// (template: H = G * rate / (100 + rate), I = G - H), and the analysis
// columns the statements read sum those row figures. Netting an annual
// total instead leaves pennies behind, so the netting table sums per entry
// the same way the sheet does.
function sheetNetOfVat(gross, rate) {
  return gross - (gross * rate) / (1 + rate);
}

// Journal totals by code letter: gross as entered, net the way the journal
// rows net it, and net the way the asset schedule holds it -- the writer
// puts a cost rounded to the penny on a schedule row, so a category that
// lands there is compared against the rounded figure.
function journalTotalsByCode(journal, rate, defaultCode) {
  const gross = {};
  const net = {};
  const scheduleNet = {};
  for (const transactions of Object.values(journal || {})) {
    for (const tx of transactions) {
      // A mileage-log row's own figure never reaches a cell: the sheet prices
      // the miles itself and the claim it makes is added to the motoring
      // category by the caller, with no VAT to strip off it.
      if (tx.mileage) continue;
      const code = tx.code || defaultCode;
      gross[code] = (gross[code] || 0) + tx.amount;
      net[code] = (net[code] || 0) + sheetNetOfVat(tx.amount, rate);
      scheduleNet[code] = (scheduleNet[code] || 0) + netOfVat(tx.amount, rate);
    }
  }
  return { gross, net, scheduleNet };
}

// The business miles a journal's own rows carry, which is what the Purchases
// month tabs pool into their running mileage total.
function journalMiles(journal) {
  let miles = 0;
  for (const transactions of Object.values(journal || {})) {
    for (const tx of transactions) if (typeof tx.mileage === "number") miles += tx.mileage;
  }
  return miles;
}

function monthMiles(transactions) {
  return (transactions || []).reduce((miles, tx) => miles + (typeof tx.mileage === "number" ? tx.mileage : 0), 0);
}

/**
 * The mileage claim each month adds, keyed by scenario month. The Purchases
 * month tab pools its own column D with the Sales month's D1 into C2 and
 * bands the running total in G2, so a month's claim is what that banding adds
 * over every mile claimed in the months ahead of it, sales miles included.
 *
 * @param {Object} scenario - a loaded scenario (or a merged scenario/expected)
 * @param {Object} mileageRates - the tax year's [mileage] table
 * @returns {Object} scenario month key -> the claim that month adds
 */
function mileageClaimsByMonth(scenario, mileageRates) {
  const claims = {};
  let milesToDate = 0;
  for (const month of MONTH_KEYS) {
    const miles = monthMiles(scenario.sales?.[month]) + monthMiles(scenario.purchases?.[month]);
    if (!miles) continue;
    claims[month] = calculateMileageAllowance(milesToDate + miles, mileageRates) - calculateMileageAllowance(milesToDate, mileageRates);
    milesToDate += miles;
  }
  return claims;
}

// One row per journal category that crosses into another statement, so the
// gross-to-net step is stated where it happens rather than only in total.
export function categoryNetting(results, scenario) {
  // With no journal there is nothing to net: every row would compare a nil
  // against whatever the sheet holds and read as a category that lost its
  // whole value on the way.
  if (!scenario?.sales && !scenario?.purchases) return null;
  const pl = results["Profit & Loss Account"];
  const fr = results["Fixedassets.xlsx!FAreconciliation"];
  if (!pl && !fr) return null;

  const rate = vatRateFor(scenario);
  const num = (v) => (typeof v === "number" ? v : 0);
  const sales = journalTotalsByCode(scenario.sales, rate, "a");
  const purchases = journalTotalsByCode(scenario.purchases, rate);
  // The year's mileage claim lands on the motoring category whole, so it
  // stands on both sides of that row: nothing was stripped on the way to
  // Motor Expenses because there was no VAT on it to strip.
  const businessMiles = journalMiles(scenario.sales) + journalMiles(scenario.purchases);
  if (businessMiles) {
    const claim = calculateMileageAllowance(businessMiles, HMRC_CAR_MILEAGE_RATES);
    purchases.gross.v = (purchases.gross.v || 0) + claim;
    purchases.net.v = (purchases.net.v || 0) + claim;
  }
  const rows = [];

  const plRow = (journal, side, code, row, sign = 1) => {
    if (!pl) return;
    rows.push({
      code: `${journal} ${code}`,
      label: PL_ROW_CAPTIONS[row],
      gross: side.gross[code] || 0,
      net: side.net[code] || 0,
      cell: sign < 0 ? `Profit & Loss Account!B${row} negated` : `Profit & Loss Account!B${row}`,
      downstream: sign * num(pl[`B${row}`]),
    });
  };

  for (const [code, row] of Object.entries(SALES_MONTHLY_TIE_ROWS)) plRow("sales", sales, code, row);
  plRow("sales", sales, "o", SALES_BAD_DEBT_ROW, -1);
  for (const [code, row] of Object.entries(PURCHASES_MONTHLY_TIE_ROWS)) plRow("purchases", purchases, code, row);

  // Stock-coded purchases reach the materials line together with the year's
  // stock movement, so the movement comes off the line before the two sides
  // are comparable. Without both counts there is nothing to take off and the
  // row would be measuring the movement, not the netting.
  const openingStock = scenario.stock?.opening ?? scenario.opening_stock;
  const closingStock = scenario.stock?.closing ?? scenario.closing_stock;
  if (pl && openingStock !== undefined && closingStock !== undefined) {
    rows.push({
      code: "purchases s",
      label: "Purchases after stock adjustment, less the year's stock movement",
      gross: purchases.gross.s || 0,
      net: purchases.net.s || 0,
      cell: "Profit & Loss Account!B14 less the stock movement",
      downstream: num(pl.B14) - (openingStock - closingStock),
    });
  }

  if (fr) {
    rows.push({
      code: "purchases fa",
      label: "Capitalised fixed asset spend",
      gross: purchases.gross.fa || 0,
      net: purchases.scheduleNet.fa || 0,
      cell: "Fixedassets.xlsx!FAreconciliation!E11",
      downstream: num(fr.E11),
    });
    rows.push({
      code: "sales fs",
      label: "Fixed asset disposal proceeds",
      gross: sales.gross.fs || 0,
      net: sales.scheduleNet.fs || 0,
      cell: "Fixedassets.xlsx!FAreconciliation!K11",
      downstream: num(fr.K11),
    });
  }

  return buildCategoryNetting(rate, rows);
}

// ── Compliance checks ──────────────────────────────────────────────────────

export function checkCompliance(results, expected, taxData, calculateExpectedTax) {
  const checks = [];

  function check(name, actual, expectedVal, tolerance = 1) {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal, tolerance });
  }

  // Some of the workbook's own cells hold wording rather than arithmetic.
  // The report shows both sides as text and the diff column stays empty.
  function checkText(name, actual, expectedText) {
    checks.push({ name, actual, expected: expectedText, pass: actual === expectedText, diff: "" });
  }

  const rate = vatRateFor(expected);

  // A template cell that resolves to blank reads back as the string the
  // formula puts there (" "), so every arithmetic read goes through this.
  const num = (v) => (typeof v === "number" ? v : 0);

  // The same cell as text. The sheet's blank is a space and an engine that
  // computes the cell holds nothing there, so both sides have to reach a
  // blank comparison as "".
  const blank = (v) => String(v ?? "").trim();

  // The approved rates the generator injected into the Admin sheet, which is
  // what the Purchases sheets band their running mileage total by. The rates
  // have held since 2011/12, so a book checked without a tax year's data
  // still has them.
  const mileageRates = taxData?.mileage || HMRC_CAR_MILEAGE_RATES;
  const monthlyMileageClaims = mileageClaimsByMonth(expected, mileageRates);

  // The rate cell itself, month by month on both journals. A non-registered
  // scenario writes 0 into April's Sales tab and nothing else; every other
  // month has to arrive at the same rate down the template's own chain of
  // references, so a month that broke away from it shows up here.
  for (const tab of Object.values(MONTH_SHEETS)) {
    for (const journal of ["Sales.xlsx", "Purchases.xlsx"]) {
      const month = results[`${journal}!${tab}`];
      if (month) {
        const read = month[VAT_RATE_CELL];
        check(`${journal} ${tab}: VAT rate charged (${VAT_RATE_CELL})`, typeof read === "number" ? read : 0, rate * 100, 0);
      }
    }
  }

  const pl = results["Profit & Loss Account"];
  if (expected.total_sales !== undefined) check("Total Sales", pl.B9, expected.total_sales);
  if (expected.gross_profit !== undefined) check("Gross Profit", pl.B19, expected.gross_profit);
  if (expected.net_profit !== undefined) check("Net Profit", pl.B39, expected.net_profit);

  // P&L internal consistency (6a)
  check("P&L: Gross = Turnover + Grants - CoS", pl.B19, pl.B9 + (pl.B11 || 0) - (pl.B17 || 0));
  check("P&L: Operating = Gross - Admin", pl.B37, pl.B19 - (pl.B35 || 0));
  check("P&L: PBT = Operating", pl.B39, pl.B37);

  // Total expenses cross-check (6b)
  const seAdminSum = [
    pl.B21,
    pl.B22,
    pl.B23,
    pl.B24,
    pl.B25,
    pl.B26,
    pl.B27,
    pl.B28,
    pl.B29,
    pl.B30,
    pl.B31,
    pl.B32,
    pl.B33,
    pl.B34,
  ].reduce((s, v) => s + (v || 0), 0);
  check("P&L: Admin lines sum = Total", pl.B35, seAdminSum);

  // Whole-book cross-check. SE's Financialaccounts.xlsx carries no
  // double-entry trial balance or audit cell (unlike Ltd's TrialBalance!EJ91)
  // and its SE Full "Balance Sheet Optional" boxes are unlinked manual-entry
  // cells the generator never populates -- there is no live balance sheet
  // identity available to assert for this product. VitalTax independently
  // re-sums the same P&L monthly cells through a second formula path
  // (quarterly SUMs of 'Profit & Loss Account' columns C:N), so comparing
  // its annual total against the P&L's own row-sum annual total is the
  // closest live whole-book closure signal this workbook set supports.
  const vt = results.VitalTax;
  if (vt) {
    check("VitalTax: annual product sales = P&L Products A+B+C", vt.G5 || 0, (pl.B5 || 0) + (pl.B6 || 0) + (pl.B7 || 0));
    check("VitalTax: annual direct costs = P&L Materials + Other Direct Costs", vt.G7 || 0, (pl.B14 || 0) + (pl.B16 || 0));
  }

  // Expense line totals (6f)
  if (expected.total_motor_net) check("Motor Expenses", pl.B25 || 0, expected.total_motor_net);
  if (expected.total_legal_net) check("Legal & Professional", pl.B28 || 0, expected.total_legal_net);

  // The mileage route. A mileage-log entry buys nothing: it states the miles
  // and the sheet prices them. Each Purchases month tab pools its own column
  // D with the Sales month's D1 into the running total at C2, bands that
  // total at the Admin rates in G2 and carries the claim to date at A2, and
  // W2 = IF(F2="v",I2," ") files the claim under Motor Expenses. This P&L
  // makes no choice between the claim and the running costs the way the taxi
  // one does -- the claim simply adds to the motoring the business paid cash
  // for.
  //
  // Both journals' miles count, because that is what C2 pools -- not the
  // scenario's declared mileage total, which counts the purchase journal
  // alone.
  const businessMiles = journalMiles(expected.sales) + journalMiles(expected.purchases);
  const yearEndPurchases = results[`Purchases.xlsx!${MONTH_SHEETS.mar}`];
  if (businessMiles && yearEndPurchases) {
    const mileageClaim = calculateMileageAllowance(businessMiles, mileageRates);
    check("Purchases: business miles pooled for the year", num(yearEndPurchases.C2), businessMiles, 0);
    check("Purchases: mileage claimed = those miles at the tax year's approved rates", num(yearEndPurchases.A2), mileageClaim, 0.01);
    let cashMotorNet = 0;
    for (const transactions of Object.values(expected.purchases || {})) {
      for (const tx of transactions) if (tx.code === "v" && !tx.mileage) cashMotorNet += netOfVat(tx.amount, rate);
    }
    check("P&L: Motor Expenses = motoring paid for + the mileage claimed", num(pl.B25), cashMotorNet + mileageClaim);
  }

  // Stock check
  // Stock. The counts at the two ends of the year, read back from the sheet
  // they were entered on, and the movement between them reaching cost of
  // sales. The materials line carries the year's stock-coded purchases plus
  // the fall in stock across it, so a stock movement that never reaches the
  // accounts shows up here and nowhere else.
  const stockControl = results.StockControl;
  // A fixture states its stock either as its own table or among the totals it
  // declares, so both spellings are read here.
  const openingStock = expected.stock?.opening ?? expected.opening_stock;
  const closingStock = expected.stock?.closing ?? expected.closing_stock;
  if (stockControl && openingStock !== undefined) {
    check("Stock: opening count", num(stockControl[STOCK_OPENING_COUNT_CELL]), openingStock);
  }
  if (stockControl && closingStock !== undefined) {
    check("Stock: count at the year end", num(stockControl[STOCK_CLOSING_COUNT_CELL]), closingStock);
  }
  if (openingStock !== undefined && closingStock !== undefined && expected.purchases) {
    let stockPurchasesNet = 0;
    for (const transactions of Object.values(expected.purchases)) {
      for (const tx of transactions) if (tx.code === "s") stockPurchasesNet += netOfVat(tx.amount, rate);
    }
    check("P&L: materials = stock purchases net + the year's stock movement", num(pl.B14), stockPurchasesNet + openingStock - closingStock);
  }

  // Debtors/creditors checks — read the real G1 total (SUM(G5:G300) of the
  // gross invoice value column) from the OpeningDebtors/ClosingDebtors sheet
  // in Sales.xlsx and the OpeningCreditors/ClosingCreditors sheet in
  // Purchases.xlsx, not a fixture total compared to itself.
  if (expected.opening_debtors) {
    const total = expected.opening_debtors.reduce((s, d) => s + d.amount, 0);
    if (total > 0) check("Opening Debtors total", results["Sales.xlsx!OpeningDebtors"]?.G1 || 0, total);
  }
  if (expected.closing_debtors) {
    const total = expected.closing_debtors.reduce((s, d) => s + d.amount, 0);
    if (total > 0) check("Closing Debtors total", results["Sales.xlsx!ClosingDebtors"]?.G1 || 0, total);
  }
  if (expected.opening_creditors) {
    const total = expected.opening_creditors.reduce((s, c) => s + c.amount, 0);
    if (total > 0) check("Opening Creditors total", results["Purchases.xlsx!OpeningCreditors"]?.G1 || 0, total);
  }
  if (expected.closing_creditors) {
    const total = expected.closing_creditors.reduce((s, c) => s + c.amount, 0);
    if (total > 0) check("Closing Creditors total", results["Purchases.xlsx!ClosingCreditors"]?.G1 || 0, total);
  }

  if (taxData) {
    const tax = results[TAX_SHEET];
    const profit = tax.E5 || 0;
    const expectedTax = calculateExpectedTax(profit, taxData);

    check("Income Tax", tax.E11 || 0, expectedTax.income_tax);
    check("NI Class 4 (lower)", tax.E15 || 0, expectedTax.ni_class4_lower);
    check("Total Tax + NI", tax.E18 || 0, expectedTax.total_tax_and_ni);

    // The allowance the sheet hands out, not the headline one. Above 100,000
    // of profit it falls by a pound for every two, and reaches nil at 125,140.
    check("Tax: Personal allowance after taper", tax.E6 || 0, expectedTax.personal_allowance);
    check("Tax at additional rate", tax.E10 || 0, expectedTax.income_tax_additional);

    // The bands and rates the sheet actually applies, not the ones it is
    // captioned with. A total that happens to be right because the whole
    // taxable income sits in one band hides a wrong rate in the others.
    check("Tax: sheet splits the basic and higher bands at the basic band end", tax.C9 || 0, taxData.income_tax.basic_band_end);
    check("Tax: sheet splits the higher and additional bands at the higher band end", tax.C10 || 0, taxData.income_tax.higher_band_end);
    check("Tax: sheet applies the additional rate above the higher band", tax.D10 || 0, taxData.income_tax.additional_rate, 0.0001);

    // Tax calculation chain (6c)
    // The sheet has no negative taxable income: a profit under the personal
    // allowance leaves it nil (verified against the template: E7 =
    // IF(E5>E6,E5-E6,0)), and the tax bands below it fall to nil with it.
    check("Tax: Taxable = Profit - Allowance", tax.E7, Math.max(0, (tax.E5 || 0) - (tax.E6 || 0)));
    check("Tax: IT = Basic + Higher + Additional", tax.E11, (tax.E8 || 0) + (tax.E9 || 0) + (tax.E10 || 0));
    // E12 already holds the contractor deductions negated (=-[2]Mar!$X$1) and
    // the sheet's own total is SUM(E11:E17), so the deduction line is added,
    // not subtracted. Every fixture so far carries nil CIS, which is why
    // subtracting it here passed.
    check("Tax: Total = IT + CIS deduction line + NI", tax.E18, (tax.E11 || 0) + (tax.E12 || 0) + (tax.E15 || 0) + (tax.E16 || 0));

    // SA103S cross-check (6g)
    const seShort = results["SE Short"];
    if (seShort) {
      if (seShort.D38) check("SA103S: Turnover = P&L Sales", seShort.D38, pl.B9);
      // The return's total expenses line and the profit it carries, each
      // against the accounts they are built from. Depreciation is not an
      // allowable expense for income tax -- capital allowances stand in for
      // it -- so the total the return works from takes it back out, which is
      // the whole of the difference between the two profits. Both are exact
      // identities; the profit was previously compared to a rebuilt figure
      // with a one per cent tolerance.
      const plDepreciation = MONTH_COLS.reduce((s, col) => s + (pl[`${col}34`] || 0), 0);
      check(
        "SA103S: total expenses = cost of sales + admin expenses less depreciation",
        num(seShort.O64),
        num(pl.B17) + num(pl.B35) - plDepreciation,
      );
      check(
        "SA103S: net profit = turnover + other business income - total expenses",
        num(seShort.D71),
        num(seShort.D38) + num(seShort.O38) - num(seShort.O64),
      );
      if (seShort.D106) check("SA103S: Profit for tax = Income Tax E5", seShort.D106, tax.E5);

      // Capital allowances carry from Schedule to SA103S across the
      // cross-file external link (Fixedassets.xlsx -> Financialaccounts.xlsx).
      // Mirrors the SA103S cells' own formulas so the check is a genuine
      // "did the link carry the right value" proof, not a fixture compared
      // to itself.
      // WDA (SE Short D85) has no live signal in this scenario: every new
      // asset claims 100% AIA (Schedule's P flag defaults to 1) and no
      // opening tax-written-down-value is fed into the Schedule's O column
      // for existing assets, so both sides of that identity are always 0 --
      // asserting it would be a check that can only ever pass on 0 = 0. Not
      // added; see the final report for what scenario data would give it
      // real signal.
      const sched = results["Fixedassets.xlsx!Schedule"];
      if (sched) {
        const expectedAIA = (sched.Q1 || 0) > 0 ? sched.Q1 : 0;
        check("SA103S: Capital allowances (AIA/FYA) = Schedule Q1", seShort.D80 || 0, expectedAIA);
      }
    }

    // The Profit Forecast prints its own tax and NI liability, and the P&L's
    // financial health check charges a twelfth of it every month. It runs off
    // its own chain from the P&L, the fixed asset schedule and Admin, so
    // nothing above proves any of it.
    const forecast = results[FORECAST_SHEET];
    if (forecast) {
      // The forecast repeats a month that traded and spreads the year's total
      // across the months that did not, so the projected year only equals the
      // actual one when every month traded. C21 counts the trading months
      // against the P&L's own monthly turnover.
      const monthsTraded = MONTH_COLS.filter((col) => num(pl[`${col}9`]) > 0).length;
      check("Forecast: months of actual trade = P&L months with turnover", num(forecast.C21), monthsTraded, 0);

      if (monthsTraded === MONTH_COLS.length) {
        check("Forecast: turnover = P&L turnover", num(forecast.C22), num(pl.B9));
        check("Forecast: investment grants = P&L investment grants", num(forecast.C24), num(pl.B11));
        check("Forecast: cost of sales = P&L cost of sales", num(forecast.C26), num(pl.B17));
        check("Forecast: general expenses = P&L administrative expenses", num(forecast.C30), num(pl.B35));
        check("Forecast: interest received = P&L interest received", num(forecast.C33), num(pl.B38));
        check("Forecast: profit before tax = P&L profit before tax", num(forecast.C34), num(pl.B39));
      }

      // The two adjustments between the accounting profit and the profit tax
      // is charged on, each against the book it comes from.
      check("Forecast: depreciation added back = P&L disposal loss + depreciation", num(forecast.C37), num(pl.B33) + num(pl.B34));
      const schedule = results["Fixedassets.xlsx!Schedule"];
      if (schedule) {
        check(
          "Forecast: capital allowances = the fixed asset schedule",
          num(forecast.C38),
          num(schedule.Q1) + num(schedule.R1) + num(schedule.Y1) - num(schedule.Z1),
        );
      }
      check(
        "Forecast: taxable profit = profit + depreciation - capital allowances",
        num(forecast.C39),
        num(forecast.C34) + num(forecast.C37) - num(forecast.C38),
      );

      const expectedForecastTax = calculateExpectedTax(num(forecast.C39), taxData);
      check("Forecast: personal allowance after taper", num(forecast.C40), expectedForecastTax.personal_allowance);
      check("Forecast: tax at standard rate", num(forecast.C42), expectedForecastTax.income_tax_basic);
      check("Forecast: tax at higher rate", num(forecast.C43), expectedForecastTax.income_tax_higher);
      check("Forecast: tax at additional rate", num(forecast.C44), expectedForecastTax.income_tax_additional);
      check("Forecast: National Insurance", num(forecast.C45), expectedForecastTax.ni_class4_lower + expectedForecastTax.ni_class4_upper);
      check("Forecast: tax and NI liability", num(forecast.C46), expectedForecastTax.total_tax_and_ni);
    }
  }

  // ── SE Full (SA103F): the full return against the accounts and against the
  // short return beside it ─────────────────────────────────────────────────
  //
  // SE Full is a live HMRC return sharing a workbook with SE Short, every box
  // formula-fed from the profit and loss account, the fixed asset schedule or
  // the Admin sheet. Nothing read it back, so it could carry a different
  // figure from the short return and no check would notice. Cell addresses,
  // box numbers and formulas are read out of the template's own sheet XML.
  const seFull = results["SE Full"];
  const sa103s = results["SE Short"];
  if (seFull && pl) {
    // Each box against the profit and loss figure its own formula names.
    const sa103fPlSources = [
      ["D55", "box 15 turnover", num(pl.B9)],
      ["O55", "box 16 other business income", num(pl.B38)],
      ["D66", "box 17 goods bought for resale", num(pl.B14) + num(pl.B16)],
      ["D70", "box 18 subcontractor payments", num(pl.B15)],
      ["D74", "box 19 wages, salaries and staff costs", num(pl.B21)],
      ["D78", "box 20 car, van and travel expenses", num(pl.B25) + num(pl.B26)],
      ["D82", "box 21 rent, rates, power and insurance", num(pl.B22)],
      ["D86", "box 22 repairs and maintenance", num(pl.B23)],
      ["D90", "box 23 phone, stationery and office costs", num(pl.B24)],
      ["D94", "box 24 advertising and entertainment", num(pl.B27)],
      ["D98", "box 25 interest on bank and other loans", num(pl.B30)],
      ["D102", "box 26 bank, credit card and finance charges", num(pl.B31)],
      ["D106", "box 27 irrecoverable debts written off", num(pl.B29)],
      ["D110", "box 28 accountancy, legal and professional fees", num(pl.B28)],
      ["D114", "box 29 depreciation and loss on sale of assets", num(pl.B33) + num(pl.B34)],
      ["D118", "box 30 other business expenses", num(pl.B32)],
      ["D122", "box 31 total expenses", num(pl.B17) + num(pl.B35)],
      ["O114", "box 44 disallowable depreciation", num(pl.B34)],
      ["O122", "box 46 total disallowable expenses", num(pl.B34)],
      ["O204", "box 75 other business income", num(pl.B11)],
    ];
    for (const [cell, caption, plFigure] of sa103fPlSources) {
      check(`SA103F ${caption} (${cell}) = the profit and loss account`, num(seFull[cell]), plFigure);
    }

    // The form's own arithmetic, each total against the boxes it adds up.
    check(
      "SA103F box 57 total capital allowances (O154) = boxes 49 to 56",
      num(seFull.O154),
      num(seFull.D139) +
        num(seFull.D144) +
        num(seFull.D147) +
        num(seFull.D152) +
        num(seFull.D156) +
        num(seFull.D160) +
        num(seFull.O139) +
        num(seFull.O144) +
        num(seFull.O149),
    );
    check(
      "SA103F box 47 net profit (D129) = boxes 15 and 16 less box 31",
      num(seFull.D129),
      Math.max(0, num(seFull.D55) + num(seFull.O55) - num(seFull.D122)),
    );
    check(
      "SA103F box 61 total additions to net profit (D174) = boxes 46, 59 and 60",
      num(seFull.D174),
      num(seFull.O122) + num(seFull.O160) + num(seFull.D169),
    );
    check("SA103F box 63 total deductions from net profit (O169) = boxes 57 and 62", num(seFull.O169), num(seFull.O154) + num(seFull.D179));
    // Box 64 works from the net profit when there is one and from the net
    // loss when there is not, which is what the box's own nested IF says.
    const taxProfitFromNetProfit = num(seFull.D129) + num(seFull.D174) - num(seFull.O169);
    const taxProfitFromNetLoss = -num(seFull.O129) + num(seFull.D174) - num(seFull.O169);
    check(
      "SA103F box 64 net business profit for tax purposes (O174) = box 47 or box 48, plus box 61, less box 63",
      num(seFull.O174),
      taxProfitFromNetProfit > 0 ? taxProfitFromNetProfit : Math.max(0, taxProfitFromNetLoss),
    );
    check("SA103F box 73 adjusted profit (O194) = box 64", num(seFull.O194), num(seFull.O174));
    check(
      "SA103F box 76 total taxable profits (O210) = box 73 less box 74 plus box 75",
      num(seFull.O210),
      num(seFull.O194) - num(seFull.O199) + num(seFull.O204),
    );

    // The capital allowance boxes have no profit and loss source: they read
    // the fixed asset schedule across the cross-file external link.
    const returnSchedule = results["Fixedassets.xlsx!Schedule"];
    if (returnSchedule) {
      check("SA103F box 49 annual investment allowance (D139) = Schedule Q1", num(seFull.D139), Math.max(0, num(returnSchedule.Q1)));
      check("SA103F box 50 capital allowances at 18% (D144) = Schedule R1", num(seFull.D144), num(returnSchedule.R1));
      check(
        "SA103F box 55 100% and other enhanced capital allowances (O144) = Schedule S1 while the small pool balance is under £1,000",
        num(seFull.O144),
        num(returnSchedule.R1) + num(returnSchedule.S1) < 1000 ? num(returnSchedule.S1) : 0,
      );
      check("SA103F box 56 allowances on sale or cessation (O149) = Schedule Y1", num(seFull.O149), num(returnSchedule.Y1));
      check("SA103F box 59 balancing charge (O160) = Schedule Z1", num(seFull.O160), num(returnSchedule.Z1));
    }

    // Box 50 against the scenario's own assets and the year's own rate,
    // neither of them read back out of the workbook. Every existing asset
    // claims the writing down allowance on the tax written-down value it was
    // brought forward at, whatever it cost, so a car whose allowance is capped
    // again, or diverted into another allowance box, leaves box 50 short of
    // what the scenario's assets are entitled to.
    if (taxData?.capital_allowances && expected.opening_fixed_assets) {
      const openingTaxWdv = expected.opening_fixed_assets.reduce((total, asset) => total + (asset.tax_wdv || 0), 0);
      check(
        "SA103F box 50 capital allowances at 18% (D144) = the scenario's opening tax written-down values at the year's writing down rate",
        num(seFull.D144),
        openingTaxWdv * taxData.capital_allowances.writing_down_allowance,
      );
    }

    // Box 51 takes the special rate pool at 6%. The fixed asset schedule
    // keeps a single main pool at the 18% rate, so the box carries nothing
    // and box 50 carries the whole writing down claim.
    check("SA103F box 51 capital allowances at 6% (D147) is nil", num(seFull.D147), 0);

    if (sa103s) {
      // Boxes the two returns carry identically.
      const sa103fCounterparts = [
        ["D55", "D38", "box 15 turnover"],
        ["O55", "O38", "box 16 other business income"],
        ["D74", "D55", "box 19 wages, salaries and staff costs"],
        ["D78", "D51", "box 20 car, van and travel expenses"],
        ["D82", "D60", "box 21 rent, rates, power and insurance"],
        ["D86", "D64", "box 22 repairs and maintenance"],
        ["D90", "O55", "box 23 phone, stationery and office costs"],
        ["D110", "O46", "box 28 accountancy, legal and professional fees"],
        ["O129", "O71", "box 48 net loss"],
        ["D139", "D80", "box 49 annual investment allowance"],
        ["O144", "D85", "box 55 100% and other enhanced capital allowances"],
        ["O160", "O85", "box 59 balancing charge"],
        ["D169", "D94", "box 60 goods and services for own use"],
        ["O174", "D99", "box 64 net business profit for tax purposes"],
        ["O179", "O106", "box 65 net business loss for tax purposes"],
        ["O199", "O94", "box 74 loss brought forward set against this year"],
        ["O204", "O99", "box 75 other business income"],
        ["O210", "D106", "box 76 total taxable profits"],
        ["D231", "O124", "box 81 contractor deductions taken off"],
      ];
      for (const [fullCell, shortCell, caption] of sa103fCounterparts) {
        check(`SA103F ${caption}: full return (${fullCell}) = short return (${shortCell})`, num(seFull[fullCell]), num(sa103s[shortCell]));
      }

      // Where the two forms differ by design. The full return has a
      // disallowable column, so it totals expenses before the add-back and
      // carries a net profit that much lower; the short return has no such
      // column and takes depreciation out of the total instead. The two
      // allowance layouts also split differently: the full return separates
      // the allowances on sale that the short return rolls into its own boxes.
      check(
        "SA103F box 31 total expenses (D122) = the short return's total expenses with box 46 disallowable depreciation added back",
        num(seFull.D122),
        num(sa103s.O64) + num(seFull.O122),
      );
      check(
        "SA103F box 47 net profit (D129) = the short return's net profit less box 46 disallowable depreciation",
        num(seFull.D129),
        num(sa103s.D71) - num(seFull.O122),
      );
      check(
        "SA103F box 57 total capital allowances (O154) = the short return's allowance boxes 22, 23 and 24",
        num(seFull.O154),
        num(sa103s.D80) + num(sa103s.D85) + num(sa103s.O80),
      );
    }

    // The period and the rates the return prints on its own face, against the
    // Admin sheet cells each one reads.
    if (results.Admin) {
      check("SA103F: the period the return covers starts on the Admin tax year start (Q2 = B4)", num(seFull.Q2), num(results.Admin.B4), 0);
      check("SA103F: the period the return covers ends on the Admin tax year end (V2 = B17)", num(seFull.V2), num(results.Admin.B17), 0);
      check(
        "SA103F: the writing down allowance rate the return prints (G141) = the Admin rate (G5)",
        num(seFull.G141),
        num(results.Admin.G5),
        0.0001,
      );
      check(
        "SA103F: the Class 4 threshold the return prints (J280) = the Admin Class 4 lower limit (N20)",
        num(seFull.J280),
        num(results.Admin.N20),
      );
    }

    // The online filing deadline printed at the top of the return (G1) is
    // always 31 January the year after the tax year ends, whatever year the
    // package was generated for -- a check anchored on the tax year end
    // rather than on the sheet's own Admin!B21 echo, so a wrong date on both
    // sides of that link would still be caught.
    if (taxData?.tax_year?.end) {
      const deadlineYear = new Date(taxData.tax_year.end).getUTCFullYear() + 1;
      checkText(
        "SA103F: the online filing deadline banner (G1) names 31 January the year after the tax year ends",
        seFull.G1,
        `COPY DETAILS TO HMRC FORM          Submit HMRC RETURN ONLINE                   by 31st January ${deadlineYear}`,
      );
    }
  }

  // ── Fixed assets (Fixedassets.xlsx Schedule vs Purchases/Sales, and P&L) ──
  //
  // 1. Note vs schedule. FAreconciliation is the workbook's own tie-out
  //    between the asset schedule and the two ledgers. E11/K11 re-sum the
  //    Schedule's New-asset and disposal rows; E13/K13 read the cumulative
  //    fixed asset totals straight out of Purchases.xlsx and Sales.xlsx
  //    across a leaf-to-leaf external link. Comparing the two sides is the
  //    comparison the sheet was built to make. The scenario's own
  //    "fa"/"fs"-coded net totals then anchor both sides to what a customer
  //    actually typed in, so a schedule and a ledger that agree on the wrong
  //    figure still fails.
  const fr = results["Fixedassets.xlsx!FAreconciliation"];
  if (fr) {
    check("Fixed assets: Schedule new-asset additions = Purchases.xlsx fixed asset total", fr.E11 || 0, fr.E13 || 0);
    check("Fixed assets: Schedule disposals = Sales.xlsx fixed asset sales total", fr.K11 || 0, fr.K13 || 0);
  }
  if (fr && expected.purchases) {
    let faGross = 0;
    for (const transactions of Object.values(expected.purchases)) {
      for (const tx of transactions) if (tx.code === "fa") faGross += tx.amount;
    }
    const faNet = netOfVat(faGross, rate);
    check("Fixed assets: Schedule new-asset additions (FAreconciliation E11) = scenario fa-coded net total", fr.E11 || 0, faNet);
  }
  if (fr && expected.sales) {
    let fsGross = 0;
    for (const transactions of Object.values(expected.sales)) {
      for (const tx of transactions) if (tx.code === "fs") fsGross += tx.amount;
    }
    const fsNet = netOfVat(fsGross, rate);
    check("Fixed assets: Schedule disposals (FAreconciliation K11) = scenario fs-coded net total", fr.K11 || 0, fsNet);
  }

  const sched = results["Fixedassets.xlsx!Schedule"];
  if (sched) {
    // 2. Closing NBV identity within the Schedule itself: cost less
    //    disposals, less depreciation carried forward less depreciation on
    //    the disposals. (The equivalent opening identity does not hold in
    //    this template: the "New Fixed Assets" rows have no opening-WDV
    //    formula at all -- G is blank for a New row regardless of E -- so
    //    G1 is the existing-assets figure alone while E1/F1 include in-year
    //    additions. Asserting G1 = E1-F1 would be checking a false
    //    identity, not the workbook's own logic.)
    check(
      "Fixed assets: closing NBV = cost less disposals, less depreciation carried forward less depreciation on disposals",
      sched.K1 || 0,
      (sched.E1 || 0) - (sched.W1 || 0) - ((sched.J1 || 0) - (sched.X1 || 0)),
    );

    // The schedule's cost total against its own two halves, so the Fixed
    // Asset Schedule section's opening and additions lines are the sheet's
    // figures rather than a total split by the report.
    check(
      "Fixed assets: Schedule total cost = existing assets plus assets bought in the year",
      sched.E1 || 0,
      (sched.E57 || 0) + (sched.E110 || 0),
    );

    // 3. P&L depreciation and disposal lines carry the Schedule's own
    //    annual totals across the cross-file link (each month books 1/12
    //    of the annual figure, so the 12 months' P&L cells sum back to it).
    if (pl) {
      const plDepreciation = MONTH_COLS.reduce((s, col) => s + (pl[`${col}34`] || 0), 0);
      check("P&L: Depreciation (row 34, summed) = Schedule I1", plDepreciation, sched.I1 || 0);
      const plDisposalLoss = MONTH_COLS.reduce((s, col) => s + (pl[`${col}33`] || 0), 0);
      const expectedDisposalLoss = -((sched.V1 || 0) - (sched.W1 || 0) + (sched.X1 || 0));
      check("P&L: Loss on disposal (row 33, summed) = Schedule -(V1-W1+X1)", plDisposalLoss, expectedDisposalLoss);
    }
  }

  // ── HP finance agreements (Fixedassets.xlsx HPfinance sheet) ────────────
  // Each check is anchored in the agreement's own fixture fields, not in
  // another cell of the same sheet, so a schedule that is merely
  // self-consistent cannot pass.
  const hp = results["Fixedassets.xlsx!HPfinance"];
  if (hp && expected.hp_agreements) {
    const [agreement1, agreement2] = expected.hp_agreements;
    if (agreement1) {
      check(
        "HP: first agreement monthly payment = the amount financed with charges over its term",
        hp.I8 || 0,
        (agreement1.amount_financed + agreement1.admin_charges + agreement1.total_interest) / agreement1.months,
      );
      check("HP: first agreement capital and interest split sums to the monthly payment", (hp.J8 || 0) + (hp.K8 || 0), hp.I8 || 0);
    }
    if (agreement2) {
      check(
        "HP: second agreement monthly payment computes",
        hp.I10 || 0,
        (agreement2.amount_financed + agreement2.admin_charges + agreement2.total_interest) / agreement2.months,
      );
      check("HP: second agreement capital and interest split sums to the monthly payment", (hp.J10 || 0) + (hp.K10 || 0), hp.I10 || 0);
    }
    check(
      "HP: long term creditors = the agreements' amounts financed",
      hp.E2 || 0,
      expected.hp_agreements.reduce((s, a) => s + a.amount_financed, 0),
    );
  }

  // The year's HP interest and admin charges reaching the P&L's own "HP
  // Interest, Lease, Bank Charges" line, through Bank.xlsx/Cash.xlsx code
  // "B" -- the same bank-charges code every other direct payment on that
  // line already uses. Computed from the scenario's own bank transactions,
  // not from the P&L cell it is compared to, so a broken cross-file link
  // shows up here rather than passing by construction.
  if (pl && expected.bank) {
    let bankChargesTotal = 0;
    for (const transactions of Object.values(expected.bank)) {
      for (const tx of transactions) {
        if (tx.code !== "B") continue;
        bankChargesTotal += tx.direction === "out" ? tx.amount : -tx.amount;
      }
    }
    check("P&L: HP interest and charges reach the finance line (B31)", pl.B31 || 0, bankChargesTotal);
  }

  // ── Bank (item 6): each leaf's closing balance vs the scenario's own cash
  // movements for that account. Computed independently from the raw
  // scenario.bank transactions (direction in/out), not read back from a
  // second spreadsheet formula, so a wrong closing balance -- wrong
  // opening balance carried forward, a receipt posted as a payment, a
  // month dropped -- shows up as a mismatch.
  if (expected.bank) {
    const closingBalanceCheck = (fileName, account) => {
      let openingBC = 0;
      let receipts = 0;
      let payments = 0;
      for (const transactions of Object.values(expected.bank)) {
        for (const tx of transactions) {
          if ((tx.account || "1200") !== account) continue;
          if (tx.code === "BC") openingBC += tx.amount;
          else if (tx.direction === "in") receipts += tx.amount;
          else if (tx.direction === "out") payments += tx.amount;
        }
      }
      const mar = results[`${fileName}!Mar`];
      if (mar) check(`${fileName} closing balance (Mar!A2)`, mar.A2 || 0, openingBC + receipts - payments);
    };
    closingBalanceCheck("Bank.xlsx", "1200");
    closingBalanceCheck("Cash.xlsx", "1220");
  }

  // ── Monthly P&L vs monthly Sales/Purchases (item 10) ──
  //
  // Each month's P&L category cell reads a single Sales.xlsx/Purchases.xlsx
  // column via cross-file external link (verified against the template's
  // per-month formulas -- see SALES_MONTHLY_TIE_ROWS/PURCHASES_MONTHLY_TIE_ROWS).
  // Both sides are net of VAT: the P&L cells hold the workbook's own net
  // total, and the "expected" side here converts the scenario's gross
  // transaction amounts to net using the same 20% rate the templates use
  // (VAT_RATE, see the Fixedassets writer above) -- comparing net to net,
  // not the gross scenario amount to the net P&L figure. This catches a
  // month landing in the wrong column or a whole month dropping out.
  if (pl && expected.sales) {
    for (let i = 0; i < MONTH_KEYS.length; i++) {
      const monthTx = expected.sales[MONTH_KEYS[i]] || [];
      const col = MONTH_COLS[i];
      const byCode = {};
      for (const tx of monthTx) byCode[tx.code] = (byCode[tx.code] || 0) + tx.amount;

      for (const [code, row] of Object.entries(SALES_MONTHLY_TIE_ROWS)) {
        const net = netOfVat(byCode[code] || 0, rate);
        check(`P&L ${MONTH_KEYS[i]} col ${col}${row} = Sales.xlsx ${code}-coded net`, pl[`${col}${row}`] || 0, net);
      }
      const badDebtNet = netOfVat(byCode.o || 0, rate);
      check(
        `P&L ${MONTH_KEYS[i]} col ${col}${SALES_BAD_DEBT_ROW} = -(Sales.xlsx o-coded net)`,
        pl[`${col}${SALES_BAD_DEBT_ROW}`] || 0,
        -badDebtNet,
      );
    }
  }
  // Purchases.xlsx side, same shape as the sales-side ties above. Previously
  // unasserted: writing the amount cell (column G) used to silently delete
  // the adjacent VAT formula cell (H) because the cell-replace regex ran up
  // to the next "</c>" rather than stopping at the next cell's own open tag,
  // so every Purchases.xlsx row read net = gross. spreadsheet-runner.js's
  // cellElementPattern now stops at "<c " as well as "</c>", so this ties
  // net to net like the sales side.
  if (pl && expected.purchases) {
    for (let i = 0; i < MONTH_KEYS.length; i++) {
      const monthTx = expected.purchases[MONTH_KEYS[i]] || [];
      const col = MONTH_COLS[i];
      const byCode = {};
      // A mileage-log row states miles, not money, so its own figure reaches
      // no analysis column. The month's claim reaches the motoring one
      // instead, through W2 = IF(F2="v",I2," ").
      for (const tx of monthTx) {
        if (tx.mileage) continue;
        byCode[tx.code] = (byCode[tx.code] || 0) + tx.amount;
      }

      for (const [code, row] of Object.entries(PURCHASES_MONTHLY_TIE_ROWS)) {
        const net = netOfVat(byCode[code] || 0, rate) + (code === "v" ? monthlyMileageClaims[MONTH_KEYS[i]] || 0 : 0);
        check(`P&L ${MONTH_KEYS[i]} col ${col}${row} = Purchases.xlsx ${code}-coded net`, pl[`${col}${row}`] || 0, net);
      }
    }
  }

  // ── CIS deducted from subcontractors (Purchases.xlsx column AD) ──────────
  //
  // A contractor withholds tax from a subcontractor's invoice and records it
  // on the certificate column beside that invoice. The column has its own
  // monthly total and sits outside the sheet's expense analysis, so both
  // things are asserted: the tax reaches the column it belongs in, and the
  // month's own check total -- gross less VAT less every expense column,
  // which is the nearest this product has to a trial balance -- stays nil
  // with it there. Anchored in the scenario's own entries, so a month whose
  // certificates never reached the sheet fails on that month alone.
  if (expected.purchases) {
    Object.values(MONTH_SHEETS).forEach((tab, i) => {
      const month = results[`Purchases.xlsx!${tab}`];
      if (!month) return;
      const withheld = (expected.purchases[MONTH_KEYS[i]] || []).reduce((total, tx) => total + (tx.cis_deduction || 0), 0);
      check(`Purchases.xlsx ${tab}: CIS tax withheld reaches the certificates column (AD1)`, num(month.AD1), withheld, 0.01);
      check(`Purchases.xlsx ${tab}: the month's expense analysis balances (A1)`, num(month.A1), 0, 0.01);
    });
  }

  // ── Payroll: Wagesinterface monthly ties (item 4) ──
  //
  // Wagesinterface reads Payslips.xlsx directly (no subtraction/second row
  // the way Ltd's does -- verified against the template), so each month's
  // gross pay, income tax, employee NI and employer NI ties straight to the
  // scenario's payroll entries for that month.
  if (expected.payroll) {
    let totalGross = 0;
    let totalEmployerNI = 0;
    for (let i = 0; i < MONTH_KEYS.length; i++) {
      const entries = expected.payroll[MONTH_KEYS[i]] || [];
      const sums = entries.reduce(
        (s, e) => ({
          grossPay: s.grossPay + (e.grossPay || 0),
          incomeTax: s.incomeTax + (e.incomeTax || 0),
          employeeNI: s.employeeNI + (e.employeeNI || 0),
          employerNI: s.employerNI + (e.employerNI || 0),
        }),
        { grossPay: 0, incomeTax: 0, employeeNI: 0, employerNI: 0 },
      );
      totalGross += sums.grossPay;
      totalEmployerNI += sums.employerNI;
      const row = WAGES_MONTH_ROWS[i];
      const wi = results.Wagesinterface || {};
      check(`Wagesinterface ${MONTH_KEYS[i]} C${row} gross pay`, wi[`C${row}`] || 0, sums.grossPay);
      check(`Wagesinterface ${MONTH_KEYS[i]} D${row} income tax`, wi[`D${row}`] || 0, sums.incomeTax);
      check(`Wagesinterface ${MONTH_KEYS[i]} E${row} employee NI`, wi[`E${row}`] || 0, sums.employeeNI);
      check(`Wagesinterface ${MONTH_KEYS[i]} H${row} employer NI`, wi[`H${row}`] || 0, sums.employerNI);

      // Payslips!Payment: the monthly PAYE/NI remittance schedule, same row
      // layout as Wagesinterface (verified against the template). D = NI
      // due (employer + employee), E = income tax due, I = total amount
      // payable = D + E (F/G/H -- statutory pay recovered, NIC
      // compensation, student loan -- stay 0, no such data in this fixture).
      const payment = results["Payslips.xlsx!Payment"] || {};
      const niDue = sums.employerNI + sums.employeeNI;
      check(`Payslips!Payment ${MONTH_KEYS[i]} D${row} NI due`, payment[`D${row}`] || 0, niDue);
      check(`Payslips!Payment ${MONTH_KEYS[i]} E${row} income tax due`, payment[`E${row}`] || 0, sums.incomeTax);
      check(`Payslips!Payment ${MONTH_KEYS[i]} I${row} total amount payable`, payment[`I${row}`] || 0, niDue + sums.incomeTax);

      // The same figures read off the tab the row is supposed to be reading.
      // The fixture pays several months alike, so a row that has slipped onto
      // a neighbouring tab can still match the scenario; it cannot match both
      // the scenario and the tab it names.
      const monthTab = results[`Payslips.xlsx!${MONTH_SHEETS[MONTH_KEYS[i]]}`];
      if (monthTab) {
        const cells = PAYE_SCHEDULE_MONTH_TAB_CELLS;
        const tabNI = (monthTab[cells.employerNI] || 0) + (monthTab[cells.employeeNI] || 0);
        check(`Payslips!Payment D${row} NI due is the ${MONTH_KEYS[i]} tab's own`, payment[`D${row}`] || 0, tabNI);
        check(
          `Payslips!Payment E${row} income tax due is the ${MONTH_KEYS[i]} tab's own`,
          payment[`E${row}`] || 0,
          monthTab[cells.incomeTax] || 0,
        );
        check(
          `Payslips!Payment I${row} total payable is the ${MONTH_KEYS[i]} tab's own`,
          payment[`I${row}`] || 0,
          tabNI + (monthTab[cells.incomeTax] || 0) + (monthTab[cells.studentLoan] || 0),
        );
      }
    }

    // ── Payslips!Payslips: the page the employer prints and hands over ─────
    //
    // The page joins itself to a month tab -- H3 names the tab, H4 the row
    // its block starts on -- and every printed figure is an INDIRECT through
    // that pair. Nothing downstream reads the page, so a join landing on the
    // wrong period prints one month's pay under another month's heading with
    // every other check here still green. cellWrites asks for a period other
    // than the sheet's own default, and the heading is measured against the
    // scenario's own entries for that period rather than against the tab the
    // join chose.
    const printed = results[`Payslips.xlsx!${PAYSLIP_PRINT_SHEET}`];
    if (printed) {
      const printedTab = MONTH_SHEETS[MONTH_KEYS[PAYSLIP_PRINT_PERIOD - 1]];
      const printedEntries = expected.payroll[MONTH_KEYS[PAYSLIP_PRINT_PERIOD - 1]] || [];
      checkText(`Payslips print: the page reads the ${printedTab} tab`, String(printed[PAYSLIP_PRINT_CELLS.tab] ?? "").trim(), printedTab);
      checkText("Payslips print: the block the page reads is a monthly payroll", String(printed.L7 ?? "").trim(), "MONTHLY PAYROLL");
      check(`Payslips print: the period printed is payroll month ${PAYSLIP_PRINT_PERIOD}`, num(printed.I10), PAYSLIP_PRINT_PERIOD, 0);
      if (printedEntries.length > 0) {
        const paidOn = parseDate(printedEntries[0].date);
        check(
          "Payslips print: the period ends the day the scenario paid that month's wages",
          num(printed.I9),
          toExcelSerial(paidOn.getUTCFullYear(), paidOn.getUTCMonth() + 1, paidOn.getUTCDate()),
          0,
        );
        // Every figure below the heading is gated on the employee's line
        // carrying a pay number, which a month tab gives only to an employee
        // whose starting date has arrived. M8 is that gate read straight off
        // the page: it holds the payroll number the Employee sheet gave the
        // first employee, and the whole page goes blank the moment it does
        // not.
        const printedEmployee = printedEntries[0];
        check("Payslips print: the page's join to the employee's line carries their payroll number", num(printed.M8), 1, 0);
        check("Payslips print: gross pay is the pay the scenario recorded", num(printed.G14), printedEmployee.grossPay || 0);
        check("Payslips print: income tax is the tax the scenario recorded", num(printed.H14), printedEmployee.incomeTax || 0);
        check(
          "Payslips print: national insurance is the employee NI the scenario recorded",
          num(printed.I14),
          printedEmployee.employeeNI || 0,
        );
        check("Payslips print: net pay is the net pay the scenario recorded", num(printed.M14), printedEmployee.netPay || 0);

        // The year-to-date row runs from the payroll year's first month to
        // this one, so it is the scenario's own entries for that employee
        // over the months printed so far -- the first entry of each month up
        // to and including the one on the page.
        const toDate = MONTH_KEYS.slice(0, PAYSLIP_PRINT_PERIOD).flatMap((key) => (expected.payroll[key] || []).slice(0, 1));
        const toDateSum = (field) => toDate.reduce((total, entry) => total + (entry[field] || 0), 0);
        check("Payslips print: gross pay to date is every month printed so far", num(printed.G16), toDateSum("grossPay"));
        check("Payslips print: income tax to date is every month printed so far", num(printed.H16), toDateSum("incomeTax"));
        check("Payslips print: national insurance to date is every month printed so far", num(printed.I16), toDateSum("employeeNI"));
        check("Payslips print: net pay to date is every month printed so far", num(printed.M16), toDateSum("netPay"));

        // The payment date the page prints joins to the same cell I9 above
        // does -- the wages-paid date a row below the block's header row.
        check(
          "Payslips print: the payment date is the day the scenario paid that month's wages",
          num(printed.M18),
          toExcelSerial(paidOn.getUTCFullYear(), paidOn.getUTCMonth() + 1, paidOn.getUTCDate()),
          0,
        );
      }
    }

    // P&L route: Wages & Salaries (row 21) = Purchases.xlsx "w"-coded net
    // (directors/employee wages posted as ordinary purchases, if any) plus
    // the payroll route's gross pay and employer NI (verified against the
    // template formula: C21 = [3]Apr!$S$1 + Wagesinterface!C4 +
    // Wagesinterface!H4 - Wagesinterface!I4, and I -- statutory pay -- is
    // always 0 here).
    if (pl) {
      let wCodeNet = 0;
      if (expected.purchases) {
        for (const transactions of Object.values(expected.purchases)) {
          for (const tx of transactions) if (tx.code === "w") wCodeNet += tx.amount / (1 + rate);
        }
      }
      check(
        "P&L: Wages & Salaries (B21) = Purchases w-coded net + payroll gross + employer NI",
        pl.B21 || 0,
        wCodeNet + totalGross + totalEmployerNI,
      );
    }

    // ── Payslips Jul/Aug: direct reads against the scenario's own payroll
    // entries for that month ──
    //
    // Payment/Admin never read a month tab directly (see
    // PAYSLIPS_JUL_DEAD_CELLS above), so nothing distinguished one month's
    // payroll figures from another's. This fixture repeats the same three
    // employees' gross pay, tax and NI every month, so a check anchored only
    // on those numbers would pass with July and August's data swapped; the
    // reference column and the wages-paid date both embed the month, so
    // anchoring on them catches a neighbouring-month mix-up the totals
    // cannot.
    const checkMonthPayrollEntries = (monthIndex, entries) => {
      const tab = MONTH_SHEETS[MONTH_KEYS[monthIndex]];
      const month = results[`Payslips.xlsx!${tab}`];
      if (!month) return;
      const entryRows = payslipsMonthEntryRows(monthIndex);
      entries.slice(0, 5).forEach((e, idx) => {
        const row = entryRows[idx];
        if (e.name) checkText(`Payslips!${tab} F${row} employee name`, month[`F${row}`], e.name);
        check(`Payslips!${tab} M${row} gross pay`, num(month[`M${row}`]), e.grossPay || 0);
        check(`Payslips!${tab} N${row} income tax`, num(month[`N${row}`]), e.incomeTax || 0);
        check(`Payslips!${tab} O${row} employee NI`, num(month[`O${row}`]), e.employeeNI || 0);
        check(`Payslips!${tab} R${row} net pay`, num(month[`R${row}`]), e.netPay || 0);
        check(`Payslips!${tab} T${row} employer NI`, num(month[`T${row}`]), e.employerNI || 0);
        if (e.reference) checkText(`Payslips!${tab} S${row} reference`, month[`S${row}`], e.reference);
      });
      if (entries.length > 0) {
        const d = parseDate(entries[0].date);
        const dateCell = `M${monthlyPayrollBlockRow(monthIndex) + 1}`;
        check(
          `Payslips!${tab} ${dateCell} wages paid date`,
          num(month[dateCell]),
          toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
          0,
        );
      }
    };
    checkMonthPayrollEntries(3, expected.payroll.jul || []);
    checkMonthPayrollEntries(4, expected.payroll.aug || []);

    // ── Payslips Jul: the weekly-block employee-line pull (rows 11-15) and
    // the period-4 total (T41), the exact cells fixed at Jul!F11:F15 and
    // Jul!T41 ──
    //
    // Every fixture's employees pay monthly, so each row's own
    // IF(Employee!D$28="m",...) weekly gate never reads true: F11:F15 stay
    // blank regardless of what the row's own date-comparison branch (the
    // one the #REF! sat in) resolves to, and T41 -- the period's own
    // employer-NI total -- stays nil alongside it. The sheet's own blank is
    // a single space (" ") and the JS engine holds nothing there at all, so
    // both reach this check as "" once trimmed.
    const jul = results["Payslips.xlsx!Jul"];
    if (jul) {
      for (const row of PAYSLIPS_WEEKLY_ROWS) {
        checkText(`Payslips!Jul F${row} weekly employee line (every employee here pays monthly)`, blank(jul[`F${row}`]), "");
      }
      check("Payslips!Jul T41 period total (no weekly employer NI to bring forward)", num(jul.T41), 0, 0);
    }

    // ── Payslips Aug: the brought-forward reads at rows 11-15 (H/I/J/L/M,
    // plus K on rows 12-15), the 29 cells fixed at Aug!H11:M15 ──
    //
    // T$9 (the flag that carries an unfinished weekly pay cycle into the
    // next month) is never set by any scenario, so every one of these
    // cells resolves to its "not carried forward" branch -- 0, or blank for
    // the M-column payslip total -- regardless of what Jul!<col>41 itself
    // holds.
    const aug = results["Payslips.xlsx!Aug"];
    if (aug) {
      for (const row of PAYSLIPS_WEEKLY_ROWS) {
        for (const col of ["H", "I", "J", "L"]) {
          check(`Payslips!Aug ${col}${row} brought forward from Jul (no weekly cycle carried over)`, num(aug[`${col}${row}`]), 0, 0);
        }
        if (row >= 12) check(`Payslips!Aug K${row} brought forward from Jul (no weekly cycle carried over)`, num(aug[`K${row}`]), 0, 0);
        checkText(`Payslips!Aug M${row} brought forward from Jul (no weekly cycle carried over)`, blank(aug[`M${row}`]), "");
      }
    }
  }

  // ── SE VAT quarters: box-level values (item 9) ──
  //
  // Each VATQtr sheet's boxes are LOOKUP formulas against Vatinterface,
  // which in turn reads Sales.xlsx/Purchases.xlsx month totals -- anchored
  // here directly in the scenario's own dated transactions (not a second
  // spreadsheet read) so a break anywhere in that chain shows up as a value
  // mismatch. Each quarter's window is derived from its own G5 (quarter-end)
  // date rather than hard-coded, so the check tracks whatever period the
  // package was generated for and whatever period a reader picks from the
  // dropdown.
  //
  // G5 is dated on the package's own period, the scenario's transactions on
  // the period its own book covers, and cellWrites copies those dates
  // through unchanged. So the window moves onto the scenario by the gap
  // between the two period frames: the whole months from the package's first
  // accounting month to the scenario's. Admin B4 is the book's tax year
  // start, and an SE year starts on 6 April, so the month it falls in is the
  // first of the twelve month tabs. Every window shifts by that one gap,
  // wherever it sits, so a quarter reaching past the year end -- or before it
  // -- is checked on the periods it actually declares.
  const accountingYearOf = (d) => (d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1);
  const scenarioTransactionYears = [...Object.values(expected.sales || {}), ...Object.values(expected.purchases || {})]
    .flat()
    .map((tx) => accountingYearOf(parseDate(tx.date)));
  const scenarioAccountingYear = scenarioTransactionYears.length ? Math.min(...scenarioTransactionYears) : null;
  const bookYearStartSerial = num(results.Admin?.B4);
  const scenarioYearStart = scenarioAccountingYear === null ? null : new Date(Date.UTC(scenarioAccountingYear, 3, 1));
  const monthShift =
    scenarioYearStart && bookYearStartSerial ? monthsBetween(excelSerialToUtcDate(bookYearStartSerial), scenarioYearStart) : null;

  for (let q = 1; q <= 5; q++) {
    const qtr = results[`Vat.xlsx!VATQtr${q}`];
    if (!qtr || !qtr.G5) continue;

    // Box 3 total = box 1 + EU acquisitions (G11, always a static 0 in this
    // template -- no formula, never generator-written), and box 5 = box 3 -
    // box 4.
    check(`VAT Q${q}: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11)`, qtr.G13 || 0, (qtr.G9 || 0) + (qtr.G11 || 0));
    check(`VAT Q${q}: box 5 net due (G17) = box 3 (G13) - box 4 (G15)`, qtr.G17 || 0, (qtr.G13 || 0) - (qtr.G15 || 0));

    // G7 is the payment-due date (LOOKUP into Vatinterface's C column, which
    // is itself just the next row's date), not a value box -- confirmed
    // against the template, contrary to the box-1 label some docs give it.
    // The one provable thing about it without hand-rolling a month-end
    // rollforward is that it falls after the quarter-end.
    check(`VAT Q${q}: payment due date (G7) falls after the quarter end (G5)`, qtr.G7 > qtr.G5 ? 1 : 0, 1, 0);

    // The scenario has to name a period before a window can be moved onto it.
    if (monthShift === null) continue;

    // Quarter window: the three calendar months ending at G5's own month,
    // moved onto the scenario's period frame. Day 0 of the month after is
    // that month's last day, so the shifted window still ends on a month end
    // in a leap year.
    const bookEnd = excelSerialToUtcDate(qtr.G5);
    const qStart = new Date(Date.UTC(bookEnd.getUTCFullYear(), bookEnd.getUTCMonth() + monthShift - 2, 1));
    const qEnd = new Date(Date.UTC(bookEnd.getUTCFullYear(), bookEnd.getUTCMonth() + monthShift + 1, 0));
    const inQuarter = (dateStr) => {
      const d = parseDate(dateStr);
      return d >= qStart && d <= qEnd;
    };

    let outputVat = 0;
    let inputVat = 0;
    let purchasesNet = 0;
    if (expected.sales) {
      for (const txs of Object.values(expected.sales)) {
        for (const tx of txs) if (inQuarter(tx.date)) outputVat += tx.amount - tx.amount / (1 + rate);
      }
    }
    if (expected.purchases) {
      for (const txs of Object.values(expected.purchases)) {
        for (const tx of txs) {
          if (!inQuarter(tx.date)) continue;
          // A mileage-log row states miles, not money. Its own figure reaches
          // no cell, and the claim the sheet makes of those miles is added
          // below, once for the month.
          if (tx.mileage) continue;
          inputVat += tx.amount - tx.amount / (1 + rate);
          purchasesNet += tx.amount / (1 + rate);
        }
      }
    }
    // The month's mileage claim reaches box 7 through that month's own net
    // total (Vatinterface H = Purchases!I1, and I1 sums I2 with the rows) and
    // carries no input VAT. A quarter window spans whole months, so any row of
    // the month settles which quarter its claim falls in.
    for (const [month, claim] of Object.entries(monthlyMileageClaims)) {
      const rows = expected.purchases?.[month] || expected.sales?.[month] || [];
      if (rows.length > 0 && inQuarter(rows[0].date)) purchasesNet += claim;
    }
    // Periods outside the twelve accounting months are entered on the
    // straddling sheets rather than a month tab, so a window that reaches
    // past the year end or before it picks those entries up as well.
    for (const entry of expected.vat_straddling_sales || []) {
      if (inQuarter(entry.date)) outputVat += entry.amount - entry.amount / (1 + rate);
    }
    for (const entry of expected.vat_straddling_purchases || []) {
      if (!inQuarter(entry.date)) continue;
      inputVat += entry.amount - entry.amount / (1 + rate);
      purchasesNet += entry.amount / (1 + rate);
    }
    check(`VAT Q${q}: box 1/3 output VAT (G9) = scenario sales VAT for the quarter`, qtr.G9 || 0, outputVat, 1);
    check(`VAT Q${q}: box 4 input VAT (G15) = scenario purchases VAT for the quarter`, qtr.G15 || 0, inputVat, 1);
    check(`VAT Q${q}: box 7 net purchases (G23) = scenario purchases net for the quarter`, qtr.G23 || 0, purchasesNet, 1);
  }

  // ── Vatinterface: where in the VAT chain a break happened ────────────────
  //
  // The box checks above catch a break; these say where it is. Each interface
  // row is compared against the leaf workbook or the straddling entry sheet
  // that feeds it, each quarter column against the three period rows it sums,
  // and each VAT box against the interface row its LOOKUP lands on. A month
  // link that stops carrying fails on that month and side alone.
  const vatinterface = results["Vat.xlsx!Vatinterface"];
  if (vatinterface) {
    Object.values(MONTH_SHEETS).forEach((tab, i) => {
      const row = VATINTERFACE_ROWS.firstMonth + i;
      const salesMonth = results[`Sales.xlsx!${tab}`];
      const purchasesMonth = results[`Purchases.xlsx!${tab}`];
      if (salesMonth) {
        check(`Vatinterface D${row}: ${tab} sales net = Sales.xlsx ${tab}`, num(vatinterface[`D${row}`]), num(salesMonth.I1));
        check(`Vatinterface F${row}: ${tab} output VAT = Sales.xlsx ${tab}`, num(vatinterface[`F${row}`]), num(salesMonth.H1));
      }
      if (purchasesMonth) {
        check(`Vatinterface H${row}: ${tab} purchases net = Purchases.xlsx ${tab}`, num(vatinterface[`H${row}`]), num(purchasesMonth.I1));
        check(`Vatinterface J${row}: ${tab} input VAT = Purchases.xlsx ${tab}`, num(vatinterface[`J${row}`]), num(purchasesMonth.H1));
      }
    });

    // The straddling periods, anchored in the entries the scenario put on
    // their own sheets. The sheets compute VAT from the gross figure at the
    // standard rate, so the expectation splits the same gross the same way.
    const straddlingGross = (entries) => {
      const byPeriod = {};
      for (const entry of entries || []) byPeriod[entry.period] = (byPeriod[entry.period] || 0) + entry.amount;
      return byPeriod;
    };
    const straddlingSales = straddlingGross(expected.vat_straddling_sales);
    const straddlingPurchases = straddlingGross(expected.vat_straddling_purchases);
    if (expected.vat_straddling_sales || expected.vat_straddling_purchases) {
      for (const [period, row] of Object.entries(STRADDLING_PERIOD_ROWS)) {
        const salesGross = straddlingSales[period] || 0;
        const purchasesGross = straddlingPurchases[period] || 0;
        check(
          `Vatinterface D${row}: ${period} sales net = the straddling sales entered for that period`,
          num(vatinterface[`D${row}`]),
          netOfVat(salesGross, rate),
        );
        check(
          `Vatinterface F${row}: ${period} output VAT = the straddling sales entered for that period`,
          num(vatinterface[`F${row}`]),
          salesGross - netOfVat(salesGross, rate),
        );
        check(
          `Vatinterface H${row}: ${period} purchases net = the straddling purchases entered for that period`,
          num(vatinterface[`H${row}`]),
          netOfVat(purchasesGross, rate),
        );
        check(
          `Vatinterface J${row}: ${period} input VAT = the straddling purchases entered for that period`,
          num(vatinterface[`J${row}`]),
          purchasesGross - netOfVat(purchasesGross, rate),
        );
      }
    }

    const quarterColumns = [
      ["E", "D", "sales net"],
      ["G", "F", "output VAT"],
      ["I", "H", "purchases net"],
      ["K", "J", "input VAT"],
    ];
    for (let q = 1; q <= 5; q++) {
      const qtr = results[`Vat.xlsx!VATQtr${q}`];
      if (!qtr || typeof qtr.G5 !== "number") continue;
      let row = null;
      for (let r = VATINTERFACE_ROWS.first; r <= VATINTERFACE_ROWS.last; r++) {
        if (Math.round(num(vatinterface[`B${r}`])) === Math.round(qtr.G5)) row = r;
      }
      check(`VAT Q${q}: quarter end date is one of the Vatinterface periods`, row === null ? 0 : 1, 1, 0);
      if (row === null) continue;

      if (row - 2 >= VATINTERFACE_ROWS.first) {
        for (const [total, period, label] of quarterColumns) {
          check(
            `Vatinterface ${total}${row}: quarter ${label} = its three period rows`,
            num(vatinterface[`${total}${row}`]),
            num(vatinterface[`${period}${row - 2}`]) + num(vatinterface[`${period}${row - 1}`]) + num(vatinterface[`${period}${row}`]),
          );
        }
      }

      check(`VAT Q${q}: box 1 (G9) = Vatinterface quarter VAT due (G${row})`, num(qtr.G9), num(vatinterface[`G${row}`]));
      check(`VAT Q${q}: box 4 (G15) = Vatinterface quarter VAT reclaimed (K${row})`, num(qtr.G15), num(vatinterface[`K${row}`]));
      check(`VAT Q${q}: box 7 (G23) = Vatinterface quarter purchases net (I${row})`, num(qtr.G23), num(vatinterface[`I${row}`]));
      // Box 6 is sales net of VAT, or sales including VAT when the flat rate
      // scheme flag in column M is set.
      const flatRate = num(vatinterface[`M${row}`]) > 0;
      check(
        `VAT Q${q}: box 6 (G21) = Vatinterface quarter sales ${flatRate ? "including" : "net of"} VAT`,
        num(qtr.G21),
        num(vatinterface[`E${row}`]) + (flatRate ? num(vatinterface[`G${row}`]) : 0),
      );
      check(
        `VAT Q${q}: payment due date (G7) = Vatinterface final date for payment (C${row})`,
        num(qtr.G7),
        num(vatinterface[`C${row}`]),
        0,
      );
    }

    // ── The five return forms as one cycle ────────────────────────
    //
    // Each form's own date decides which three interface rows it declares, so
    // the five together are checked as a cycle: distinct periods, each a
    // quarter after the one before it, Q1 to Q4 covering the twelve accounting
    // months once each, and the fifth on the last period the interface
    // carries.
    const periods = vatinterfacePeriods(results);
    const returnForms = [];
    for (let q = 1; q <= 5; q++) {
      const qtr = results[`Vat.xlsx!VATQtr${q}`];
      if (qtr && typeof qtr.G5 === "number") returnForms.push({ name: `Q${q}`, end: vatinterfaceRowEnding(results, qtr.G5) });
    }
    const coverage = vatReturnCoverage(periods, returnForms);
    if (coverage.placed.length === 5) {
      const [q1, q2, q3, q4, q5] = coverage.placed;
      check("VAT: the five returns end on five different periods", new Set(coverage.placed.map((form) => form.row)).size, 5, 0);
      for (const [earlier, later] of [
        [q1, q2],
        [q2, q3],
        [q3, q4],
        [q4, q5],
      ]) {
        check(`VAT: ${later.name} ends a quarter after ${earlier.name}`, later.row - earlier.row, 3, 0);
      }
      const quarterlyRows = new Set([q1, q2, q3, q4].flatMap((form) => form.covers));
      check(
        "VAT: Q1-Q4 cover every month of the accounting year",
        periods.filter((period) => period.inAccountingYear && quarterlyRows.has(period.row)).length,
        periods.filter((period) => period.inAccountingYear).length,
        0,
      );
      check("VAT: Q5 ends on the last period the Vatinterface carries", q5.row, VATINTERFACE_ROWS.last, 0);

      // Five consecutive quarters need fifteen periods and the interface
      // carries seventeen, so no two returns reach the same one. A period
      // declared twice would be filed twice, so it fails rather than warns,
      // and the output VAT on it says what the second filing would repeat.
      check("VAT: periods more than one of the five returns declares", coverage.shared.length, 0, 0);
      check(
        "VAT: output VAT declared on more than one of the five returns",
        coverage.shared.reduce((total, period) => total + period.outputVat, 0),
        0,
        0,
      );
    }
  }

  // Admin echo: the generator injects the tax year's rates, bands and
  // thresholds from the TOML into the Admin sheet, and every workbook in
  // the package reads from there. Nothing else asserts the injected values
  // equal what the run was generated from -- a wrong rate here is
  // arithmetically invisible to every downstream check, the same failure
  // shape as the shipped-zeros VAT bug. BST, Taxi and Ltd already carry this
  // check; SE's cell positions differ (buildSeCellEdits() in
  // app/lib/generator.js), so the comparisons are repeated here rather than
  // shared.
  if (taxData && results.Admin) {
    const admin = results.Admin;
    const it = taxData.income_tax;
    const ni = taxData.national_insurance;
    const ca = taxData.capital_allowances;
    const mil = taxData.mileage;
    check("Admin: Personal Allowance = tax data", admin.N4, it.personal_allowance);
    check("Admin: Personal Allowance Taper Threshold = tax data", admin.N5, it.personal_allowance_taper_threshold);
    check("Admin: Basic Rate = tax data", admin.N6, it.basic_rate, 0.0001);
    check("Admin: Higher Rate = tax data", admin.N7, it.higher_rate, 0.0001);
    check("Admin: Additional Rate = tax data", admin.N8, it.additional_rate, 0.0001);
    check("Admin: Basic Band End = tax data", admin.M11, it.basic_band_end);
    check("Admin: Higher Band Start = tax data", admin.N12, it.higher_band_start);
    check("Admin: Higher Band End = tax data", admin.N13, it.higher_band_end);
    check("Admin: NI Class 2 Weekly Rate = tax data", admin.L16, ni.class2_weekly_rate, 0.0001);
    check("Admin: NI Class 4 Lower Rate = tax data", admin.L20, ni.class4_lower_rate, 0.0001);
    check("Admin: NI Class 4 Lower Limit = tax data", admin.N20, ni.class4_lower_limit);
    check("Admin: NI Class 4 Upper Rate = tax data", admin.L23, ni.class4_upper_rate, 0.0001);
    check("Admin: NI Class 4 Upper Limit = tax data", admin.N23, ni.class4_upper_limit);
    check("Admin: AIA Rate = tax data", admin.G4, ca.annual_investment_allowance, 0.0001);
    check("Admin: WDA Rate = tax data", admin.G5, ca.writing_down_allowance, 0.0001);
    check("Admin: Mileage Higher Rate Limit = tax data", admin.F21, mil.higher_rate_limit);
    check("Admin: Mileage Higher Rate Pence = tax data", admin.G21, mil.higher_rate_pence, 0.0001);
    check("Admin: Mileage Lower Rate Start = tax data", admin.F22, mil.lower_rate_start);
    check("Admin: Mileage Lower Rate Pence = tax data", admin.G22, mil.lower_rate_pence, 0.0001);
    check("Admin: VAT Registration Threshold = tax data", admin.F26, taxData.vat.registration_threshold);
    check("Admin: VAT Standard Rate = tax data", admin.F27, taxData.vat.standard_rate, 0.0001);
    if (taxData?.tax_year?.end) {
      const deadlineYear = new Date(taxData.tax_year.end).getUTCFullYear() + 1;
      check(
        "Admin: Amounts Payable By date (B21) = 31 January the year after the tax year ends",
        admin.B21,
        toExcelSerial(deadlineYear, 1, 31),
        0,
      );
    }
  }

  // Payslips calendar echo: Payslips.xlsx's own Admin sheet carries a
  // day-by-day payroll calendar the generator writes for the package's tax
  // year (generatePayslipsCalendar in app/lib/generator.js seeds B2 and fills
  // the week and month columns; every later date cascades from B2 and every
  // month name is that many months on from B2's own month). Nothing read it
  // back, so a package could ship a payroll year starting on the wrong date,
  // dating every payslip in it to another year, with no check failing. Both
  // ends are anchored on the accounts workbook's own tax year dates.
  const payrollCalendar = results["Payslips.xlsx!Admin"];
  if (payrollCalendar && results.Admin) {
    const yearStartSerial = num(results.Admin.B4);
    check(
      "Payslips calendar: the payroll year starts on the accounts tax year start (B2 = Admin B4)",
      num(payrollCalendar.B2),
      yearStartSerial,
      0,
    );
    check(
      "Payslips calendar: the year the calendar runs to (I1) = the accounts tax year end (Admin B17)",
      num(payrollCalendar.I1),
      num(results.Admin.B17),
      0,
    );
    if (taxData?.tax_year) {
      checkText(
        "Payslips calendar: the tax year the payslips print (N1) = the tax year the package was generated for",
        payrollCalendar.N1,
        taxData.tax_year.label,
      );
    }

    const yearStartMonthIndex = excelSerialToUtcDate(yearStartSerial).getUTCMonth();
    for (const row of PAYROLL_CALENDAR_SAMPLE_ROWS) {
      check(
        `Payslips calendar row ${row}: the date runs on unbroken from the tax year start`,
        num(payrollCalendar[`B${row}`]),
        yearStartSerial + row - 2,
        0,
      );
      const monthsIn = num(payrollCalendar[`D${row}`]) - 1;
      checkText(
        `Payslips calendar row ${row}: the month name is its payroll month counted from the tax year start`,
        payrollCalendar[`A${row}`],
        SHORT_MONTH_NAMES[(yearStartMonthIndex + monthsIn) % 12],
      );
    }
  }

  // ── Payslips!Payment: the dates on the PAYE remittance schedule ──────────
  //
  // Twelve rows, one per tax month, each with the month it covers and the day
  // the payment falls due. Both come off the payroll calendar at a fixed row,
  // so they are the payroll year's first day plus a fixed count of days --
  // measured here against the year the package's own tax data opens in, not
  // against the calendar the sheet built them from.
  const paymentSchedule = results["Payslips.xlsx!Payment"];
  const payrollYearOpens = taxData?.tax_year?.start ? payrollYearStart(new Date(taxData.tax_year.start).getUTCFullYear()) : null;
  if (paymentSchedule && payrollYearOpens) {
    const asSerial = (day) => toExcelSerial(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate());
    PAYE_SCHEDULE_MONTH_TABS.forEach((tab, taxMonth) => {
      const row = PAYE_SCHEDULE_FIRST_ROW + taxMonth;
      const { ends, due } = payeTaxMonthDates(payrollYearOpens, taxMonth);
      check(
        `Payslips!Payment B${row} tax month ${taxMonth + 1} ends on the last day of ${tab}`,
        num(paymentSchedule[`B${row}`]),
        asSerial(ends),
        0,
      );
      check(
        `Payslips!Payment C${row} tax month ${taxMonth + 1} is due on the ${PAYE_DUE_DAY}th after it`,
        num(paymentSchedule[`C${row}`]),
        asSerial(due),
        0,
      );
    });
  }

  // The whole distance from the accounting profit to the profit tax is
  // charged on, adjustment by adjustment, with nothing left over.
  const bridge = profitBridge(results);
  if (bridge) check(PROFIT_BRIDGE_CHECK, bridge.residue, 0, 0.01);

  // Every journal category the report nets, one residue at a time. The
  // monthly ties above prove each month landed in the right column; these
  // prove the year's gross figure reaches the statement with the VAT taken
  // off and nothing else lost on the way.
  const netting = categoryNetting(results, expected);
  for (const row of netting?.rows || []) check(categoryNettingCheckName(row), row.residue, 0, 0.01);

  // ── The customer-facing invoice against the tax year's own VAT rate ──────
  //
  // Salesinvoice.xlsx carries no external link to the rest of the book, so a
  // wrong figure here never reaches the accounts -- it reaches the
  // customer's customer. The generator writes the tax year's standard rate
  // into Product Details!D2:D99 (generator.js); this checks the rate landed
  // and that the one sample invoice line, plus the invoice's carriage
  // charge, both compute their VAT correctly from it, hand-computed from the
  // fixture's own first sale and the sample carriage charge.
  const invoiceProductDetails = results["Salesinvoice.xlsx!Product Details"];
  const invoiceTemplate = results["Salesinvoice.xlsx!Invoice Template"];
  if (invoiceProductDetails && invoiceTemplate && taxData) {
    const standardRatePercent = Math.round(taxData.vat.standard_rate * 100);
    check(
      "Salesinvoice Product Details: VAT Rate = the tax year's standard rate",
      num(invoiceProductDetails[`${SALESINVOICE_PRODUCT_DETAILS_COLUMNS.vatRate}${SALESINVOICE_SAMPLE_PRODUCT_ROW}`]),
      standardRatePercent,
      0,
    );

    // cellWrites only puts the sample invoice line and carriage charge on the
    // sheet for a VAT-registered business (rate > 0 and a VAT number) --
    // otherwise Salesinvoice.xlsx keeps its blank template state, and these
    // five figures would have nothing to compare against.
    const firstInvoiceSale = Object.values(expected.sales || {}).flat()[0];
    if (rate > 0 && expected.business?.vat_number && firstInvoiceSale) {
      const expectedNet = firstInvoiceSale.amount;
      const expectedLineVat = (expectedNet * standardRatePercent) / 100;
      const expectedCarriageVat = (SALESINVOICE_SAMPLE_CARRIAGE_CHARGE * standardRatePercent) / 100;
      const expectedVatTotal = expectedLineVat + expectedCarriageVat;
      check(
        "Salesinvoice: line VAT = price x quantity x the tax year's standard rate",
        num(invoiceTemplate[SALESINVOICE_LINE1_CELLS.lineVat]),
        expectedLineVat,
        0.01,
      );
      check(
        "Salesinvoice: net total = the invoice's one line",
        num(invoiceTemplate[SALESINVOICE_INVOICE_TEMPLATE_CELLS.netTotal]),
        expectedNet,
        0.01,
      );
      check(
        "Salesinvoice: carriage charge lands on the invoice",
        num(invoiceTemplate[SALESINVOICE_INVOICE_TEMPLATE_CELLS.carriageNet]),
        SALESINVOICE_SAMPLE_CARRIAGE_CHARGE,
        0.01,
      );
      check(
        "Salesinvoice: VAT total = line VAT plus carriage VAT at the tax year's standard rate",
        num(invoiceTemplate[SALESINVOICE_INVOICE_TEMPLATE_CELLS.vatTotal]),
        expectedVatTotal,
        0.01,
      );
      check(
        "Salesinvoice: amount payable = net plus carriage plus VAT",
        num(invoiceTemplate[SALESINVOICE_INVOICE_TEMPLATE_CELLS.grossTotal]),
        expectedNet + SALESINVOICE_SAMPLE_CARRIAGE_CHARGE + expectedVatTotal,
        0.01,
      );
    }
  }

  return checks;
}

function excelSerialToUtcDate(serial) {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.round(serial) * 24 * 60 * 60 * 1000);
}

// Whole months from one date's month to another's, ignoring the day of the
// month. Negative when the second date comes first.
function monthsBetween(from, to) {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}

// The VAT periods the interface carries, one per row, with the VAT on each
// side and whether the period is one of the twelve accounting months.
function vatinterfacePeriods(results) {
  const vatinterface = results["Vat.xlsx!Vatinterface"];
  if (!vatinterface) return [];
  const num = (v) => (typeof v === "number" ? v : 0);
  const periods = [];
  for (let row = VATINTERFACE_ROWS.first; row <= VATINTERFACE_ROWS.last; row++) {
    const end = num(vatinterface[`B${row}`]);
    if (!end) continue;
    periods.push({
      row,
      endLabel: periodEnding(end).replace(" (period ending ", "").replace(")", ""),
      outputVat: num(vatinterface[`F${row}`]),
      inputVat: num(vatinterface[`J${row}`]),
      inAccountingYear: row >= VATINTERFACE_ROWS.firstMonth && row < VATINTERFACE_ROWS.firstMonth + 12,
    });
  }
  return periods;
}

// The interface row a return form's own period end date lands on, or null
// when the form names a date the interface does not carry.
function vatinterfaceRowEnding(results, end) {
  const vatinterface = results["Vat.xlsx!Vatinterface"];
  if (!vatinterface || !end) return null;
  for (let row = VATINTERFACE_ROWS.first; row <= VATINTERFACE_ROWS.last; row++) {
    if (Math.round(typeof vatinterface[`B${row}`] === "number" ? vatinterface[`B${row}`] : 0) === Math.round(end)) return row;
  }
  return null;
}

// The " (period ending d Month yyyy)" a VAT return line carries, or nothing
// at all when the form has no date on it.
function periodEnding(serial) {
  if (!serial) return "";
  const date = excelSerialToUtcDate(serial);
  return ` (period ending ${date.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })})`;
}
