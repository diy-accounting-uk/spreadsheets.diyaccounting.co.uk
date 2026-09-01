// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// se.js — JS calculation engine for the Self Employed product.
//
// The package is nine workbooks joined by external links, and this module
// computes every cell the reconciliation reads, the way those workbooks compute
// it. Each formula here was read out of the template XML: the journal month
// tabs' analysis columns, the profit and loss account's monthly grid, the fixed
// asset schedule, the payroll interface and calendar, the VAT interface and its
// five return forms, and the two self assessment returns.
//
// It works from the scenario, which is what the writer puts into the workbooks,
// so both engines start from the same figures and only the arithmetic between
// them is under test.

import { MONTH_SHEETS, extractTaxYearStart } from "../scenario-loader.js";
import { standardReads, multiFileOptions } from "../../products/se.js";
import { generateAdminDates, seVatPaymentDueDate, generatePayslipsCalendar } from "../generator.js";
import { calculateIncomeTax } from "../tax/income-tax.js";
import { calculateMileageAllowance } from "../tax/mileage.js";
import {
  buildVatinterface,
  splitVat,
  straddlingPeriodTotals,
  vatReturnBoxes,
  vatReturnPeriodEnds,
  VATINTERFACE_FIRST_ROW,
  VATINTERFACE_LAST_ROW,
} from "../tax/vat.js";
import {
  monthlyPayrollBlockRow,
  PAYE_DUE_DATE_DAYS,
  PAYE_MONTH_END_DAYS,
  PAYE_SCHEDULE_MONTH_TAB_CELLS,
  PAYSLIP_PRINT_CELLS,
  PAYSLIP_PRINT_FIRST_PAYROLL_NUMBER,
  PAYSLIP_PRINT_MONTHLY_HEADING,
  PAYSLIP_PRINT_PERIOD,
  PAYSLIP_PRINT_PERIOD_CELLS,
  PAYSLIP_PRINT_SHEET,
  PAYSLIP_PRINT_TO_DATE_CELLS,
  PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES,
  PAYSLIPS_ENTRY_COLUMNS,
  PAYSLIPS_ZERO_FILLED_COLUMNS,
  payslipsMonthEntryRows,
  payslipsWagesPaidCell,
} from "../payslips-layout.js";
import { SHEET_BLANK, sheetNumber, sheetSum, excelSerial, dateFromExcelSerial } from "./shared.js";

// The twelve month tabs, in the order the package lays them out, and the profit
// and loss account column each one feeds.
const MONTH_KEYS = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];
const MONTH_COLS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

// Wagesinterface and Payslips!Payment both hold one row per month, April at row
// 4 through March at row 15.
const WAGES_MONTH_ROWS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// The rate a Sales month tab charges, held in H2 as a percentage. A business
// that is not registered writes nil there and the whole book follows.
const VAT_RATE = 0.2;

// Each Sales month tab's analysis column, by the code letter its own row 4
// carries. Every column holds the row's net figure.
const SALES_ANALYSIS_COLUMNS = { a: "P", b: "Q", c: "R", d: "S", g: "T", o: "U", fs: "V" };

// The same on a Purchases month tab. AD is the CIS certificates column, which
// takes the tax withheld rather than a net figure and sits outside the sheet's
// own analysis check total.
const PURCHASES_ANALYSIS_COLUMNS = {
  s: "P",
  c: "Q",
  o: "R",
  w: "S",
  p: "T",
  m: "U",
  g: "V",
  v: "W",
  h: "X",
  a: "Y",
  l: "Z",
  y: "AA",
  fa: "AB",
};

// Bank.xlsx and Cash.xlsx analyse a receipt and a payment under different code
// letters, and the same letter means opposite things on the two sides, so each
// block carries its own map. Read out of each sheet's own row 5.
const BANK_LAYOUTS = {
  "Bank.xlsx": {
    receiptColumns: { BC: "G", DR: "H", CR: "I", K: "J", RV: "K", DL: "L", X: "M" },
    paymentColumns: { BC: "U", CR: "V", DR: "W", W: "X", B: "Y", J: "Z", RP: "AA", DL: "AB", X: "AC" },
  },
  "Cash.xlsx": {
    receiptColumns: { BB: "G", DR: "H", CR: "I", DL: "J" },
    paymentColumns: { BB: "R", CR: "S", DR: "T", W: "U", J: "V", RP: "W", DL: "X" },
  },
};

// Both Self Employed bank books carry one HMRC payments column, so a payment
// coded for VAT, CIS or corporation tax lands in it beside the PAYE payments.
const SE_HMRC_PAYMENT_CODE = "RP";
const COMPANY_TAX_PAYMENT_CODES = new Set(["RV", "RC", "RT"]);

// The Schedule rows each kind of asset lands on, and the Admin depreciation
// rate the block's own header cell reads.
const EXISTING_ASSET_BLOCKS = {
  computer: { rows: [30, 31, 32, 33, 34], rateKey: "computer_equipment" },
  motor: { rows: [38, 39, 40, 41, 42], rateKey: "motor_vehicles" },
};
const NEW_PLANT_ROW_COUNT = 5;

// The sample carriage charge cellWrites puts on the invoice's Invoice
// Database!E2 for a VAT-registered scenario (app/products/se.js).
const SALESINVOICE_SAMPLE_CARRIAGE_CHARGE = 37.5;

// The Payslips calendar rows the reconciliation samples, and the month names
// the sheet's own TEXT(DATE(...)) formula produces.
const PAYROLL_CALENDAR_SAMPLE_ROWS = [2, 33, 64, 95, 126, 157, 188, 219, 250, 281, 312, 343, 366, 381];
const SHORT_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The StockControl physical-count cells for the two ends of the year.
const STOCK_OPENING_COUNT_CELL = "AB6";
const STOCK_CLOSING_COUNT_CELL = "AB30";

// The two HPfinance rows a scenario's agreements land on.
const HP_AGREEMENT_ROWS = [8, 10];

// The turnover below which the short return leaves its expense analysis blank
// and states one total instead.
const EXPENSE_ANALYSIS_TURNOVER = 30000;

/**
 * A scenario says whether the business is registered in its own metadata.
 * Anything that does not say is registered.
 */
function vatRateFor(scenario) {
  return scenario?.metadata?.vat_registered === false ? 0 : VAT_RATE;
}

function paymentCodeFor(code) {
  return COMPANY_TAX_PAYMENT_CODES.has(code) ? SE_HMRC_PAYMENT_CODE : code;
}

function businessName(scenario) {
  return scenario.business?.name || scenario.metadata?.name || "";
}

function ledgerTotal(entries) {
  return (entries || []).reduce((total, entry) => total + entry.amount, 0);
}

// The schedule holds a cost rounded to the penny, so the writer rounds a gross
// figure to the penny on its way onto a row.
function roundedNetOfVat(gross, rate) {
  return Math.round((gross / (1 + rate)) * 100) / 100;
}

// ── The journal month tabs ─────────────────────────────────────────────────

/**
 * One month tab of a sales or purchase journal: the gross, VAT and net totals
 * its row 1 holds, each analysis column's own total, and the CIS tax withheld.
 */
function journalMonth(transactions, rate, analysisColumns, defaultCode) {
  const totals = { gross: 0, vat: 0, net: 0, byCode: {}, cis: 0 };
  for (const tx of transactions || []) {
    // A mileage-log row states miles where a bought purchase states an
    // amount, and the sheet prices those miles itself. Its own figure never
    // reaches a cell, so it is left out here and the claim added below.
    if (tx.mileage) continue;
    const { vat, net } = splitVat(tx.amount, rate);
    totals.gross += tx.amount;
    totals.vat += vat;
    totals.net += net;
    const code = tx.code || defaultCode;
    if (analysisColumns[code] !== undefined) totals.byCode[code] = (totals.byCode[code] || 0) + net;
    if (tx.cis_deduction) totals.cis += tx.cis_deduction;
  }
  return totals;
}

function journalMonths(journal, rate, analysisColumns, defaultCode) {
  return MONTH_KEYS.map((month) => journalMonth(journal?.[month], rate, analysisColumns, defaultCode));
}

// The business miles one month's transactions carry.
function monthMiles(transactions) {
  return (transactions || []).reduce((miles, tx) => miles + (typeof tx.mileage === "number" ? tx.mileage : 0), 0);
}

/**
 * The mileage cells row 2 of each Purchases month tab holds: C2 the running
 * business miles, which pools the month's own D column with the Sales month's
 * D1 (C2 = <the month before>!C2 + D1 + [1]<month>!$D$1); G2 the claim that
 * month adds, banded at the Admin rates; and A2 the claim to date
 * (A2 = G2 + <the month before>!A2).
 *
 * I2 = G2 puts the claim in the month's net column, W2 = IF(F2="v",I2," ")
 * files it under Motor Expenses, and G1/I1 carry it into the month's own
 * totals, so the claim reaches the profit and loss account with no VAT
 * stripped off it.
 */
function mileageMonths(scenario, mileageRates) {
  let milesToDate = 0;
  let claimedToDate = 0;
  return MONTH_KEYS.map((month) => {
    const miles = monthMiles(scenario.sales?.[month]) + monthMiles(scenario.purchases?.[month]);
    milesToDate += miles;
    const claimToDate = mileageRates ? calculateMileageAllowance(milesToDate, mileageRates) : 0;
    const claim = claimToDate - claimedToDate;
    claimedToDate = claimToDate;
    return { miles: milesToDate, claim, claimToDate };
  });
}

// The year's net total for one code, as the last month tab's own running cell
// holds it.
function journalCodeTotal(journal, code, rate) {
  let total = 0;
  for (const transactions of Object.values(journal || {})) {
    for (const tx of transactions) {
      if (tx.code !== code) continue;
      total += splitVat(tx.amount, rate).net;
    }
  }
  return total;
}

// ── Bank and cash ──────────────────────────────────────────────────────────

/**
 * One bank workbook's twelve month tabs: the receipts and payments each code
 * column carries, and the running balance A1 and A2 hold.
 *
 * An opening balance entry is written straight into its month's A1, replacing
 * the formula that would otherwise carry the month before it forward.
 */
function bankBook(bankJournal, fileName) {
  const layout = BANK_LAYOUTS[fileName];
  const months = MONTH_KEYS.map(() => ({
    receipts: 0,
    payments: 0,
    receiptsByCode: {},
    paymentsByCode: {},
    openingWritten: null,
  }));

  for (const [monthKey, transactions] of Object.entries(bankJournal || {})) {
    const index = MONTH_KEYS.indexOf(monthKey);
    if (index === -1) continue;
    for (const tx of transactions) {
      const file = (tx.account || "1200") === "1220" ? "Cash.xlsx" : "Bank.xlsx";
      if (file !== fileName) continue;
      const month = months[index];
      if (tx.code === "BC") {
        month.openingWritten = (month.openingWritten || 0) + tx.amount;
        continue;
      }
      if (tx.direction === "in") {
        month.receipts += tx.amount;
        if (layout.receiptColumns[tx.code]) month.receiptsByCode[tx.code] = (month.receiptsByCode[tx.code] || 0) + tx.amount;
      } else if (tx.direction === "out") {
        const code = paymentCodeFor(tx.code);
        month.payments += tx.amount;
        if (layout.paymentColumns[code]) month.paymentsByCode[code] = (month.paymentsByCode[code] || 0) + tx.amount;
      }
    }
  }

  let carried = 0;
  for (const month of months) {
    month.opening = month.openingWritten === null ? carried : month.openingWritten;
    month.closing = month.opening + month.receipts - month.payments;
    carried = month.closing;
  }
  return months;
}

const bankPayments = (months, index, code) => months[index].paymentsByCode[code] || 0;
const bankReceipts = (months, index, code) => months[index].receiptsByCode[code] || 0;

// ── Payroll ────────────────────────────────────────────────────────────────

// The rows a month tab's weekly blocks keep for an employee paid weekly, and
// the row the last of them totals into. Every fixture pays monthly, so the
// weekly gate never reads true and these resolve to the sheet's own
// not-carried-forward branch: nil where the template holds a figure, blank
// where it holds text, which is why neither engine carries the M column.
const PAYSLIPS_WEEKLY_ROWS = [11, 12, 13, 14, 15];
const PAYSLIPS_WEEKLY_PERIOD_TOTAL_CELL = "T41";
const PAYSLIPS_BROUGHT_FORWARD_COLUMNS = ["H", "I", "J", "L"];
const PAYSLIPS_BROUGHT_FORWARD_LATE_COLUMN = { column: "K", firstRow: 12 };
// The weekly employee line each row of position 3 keeps, and the payslip
// total position 4 would bring forward: text cells, so the sheet's own
// unfilled branch leaves a blank rather than a nil.
const PAYSLIPS_WEEKLY_TEXT_COLUMN = { 3: PAYSLIPS_ENTRY_COLUMNS.name, 4: PAYSLIPS_ENTRY_COLUMNS.grossPay };
// The five columns of a monthly block row the template ships empty, against
// the three it ships as a literal zero.
const PAYSLIPS_BLANK_COLUMNS = [
  PAYSLIPS_ENTRY_COLUMNS.name,
  PAYSLIPS_ENTRY_COLUMNS.taxCode,
  PAYSLIPS_ENTRY_COLUMNS.grossPay,
  PAYSLIPS_ENTRY_COLUMNS.netPay,
  PAYSLIPS_ENTRY_COLUMNS.reference,
];
// The printed page's figures, all gated on a pay number no scenario gives.
const PAYSLIP_PRINT_BLANK_CELLS = ["M8", "G14", "H14", "I14", "M14", "G16", "H16", "I16", "M16", "M18"];

// One month tab's monthly payroll block: an employee a row from block row +
// 3, with the wages-paid date above them. A row the scenario has no employee
// for keeps the three columns the template ships as a literal zero and stays
// blank in the other five, which is what the workbook itself carries there.
function buildPayslipsMonthTab(monthIndex, entries) {
  const sheet = {};
  const columns = PAYSLIPS_ENTRY_COLUMNS;
  payslipsMonthEntryRows(monthIndex).forEach((row, index) => {
    const entry = entries[index];
    if (!entry) {
      for (const column of PAYSLIPS_ZERO_FILLED_COLUMNS) sheet[`${column}${row}`] = 0;
      for (const column of PAYSLIPS_BLANK_COLUMNS) sheet[`${column}${row}`] = SHEET_BLANK;
      return;
    }
    sheet[`${columns.name}${row}`] = entry.name || SHEET_BLANK;
    sheet[`${columns.taxCode}${row}`] = entry.taxCode || SHEET_BLANK;
    sheet[`${columns.grossPay}${row}`] = entry.grossPay || 0;
    sheet[`${columns.incomeTax}${row}`] = entry.incomeTax || 0;
    sheet[`${columns.employeeNI}${row}`] = entry.employeeNI || 0;
    sheet[`${columns.netPay}${row}`] = entry.netPay || 0;
    sheet[`${columns.employerNI}${row}`] = entry.employerNI || 0;
    sheet[`${columns.reference}${row}`] = entry.reference || SHEET_BLANK;
  });
  if (entries.length > 0) sheet[payslipsWagesPaidCell(monthIndex)] = excelSerial(new Date(entries[0].date));

  // Template position 3 keeps its weekly employee lines and its period total;
  // position 4 keeps the cells that would bring an unfinished weekly cycle in
  // from the month before it.
  if (monthIndex === PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[0]) sheet[PAYSLIPS_WEEKLY_PERIOD_TOTAL_CELL] = 0;
  if (monthIndex === PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[1]) {
    for (const row of PAYSLIPS_WEEKLY_ROWS) {
      for (const column of PAYSLIPS_BROUGHT_FORWARD_COLUMNS) sheet[`${column}${row}`] = 0;
      if (row >= PAYSLIPS_BROUGHT_FORWARD_LATE_COLUMN.firstRow) sheet[`${PAYSLIPS_BROUGHT_FORWARD_LATE_COLUMN.column}${row}`] = 0;
    }
  }
  const weeklyTextColumn = PAYSLIPS_WEEKLY_TEXT_COLUMN[monthIndex];
  if (weeklyTextColumn) for (const row of PAYSLIPS_WEEKLY_ROWS) sheet[`${weeklyTextColumn}${row}`] = SHEET_BLANK;
  return sheet;
}

// The page the employer prints. H3 and H4 are the join -- the tab the chosen
// period lands on and the row its block starts at -- and I9, I10 and L7 the
// heading above the figures. Every figure below the heading is gated on the
// employee's line carrying a pay number, which a month tab gives an employee
// once their starting date has arrived. M8 is that number, and the
// year-to-date row adds the same employee's line over every month up to the
// one printed. A month with no payroll leaves the page blank below the
// heading, which is the sheet's own gated branch.
function buildPayslipsPrintPage(period, payroll) {
  const monthIndex = period - 1;
  const sheet = {
    [PAYSLIP_PRINT_CELLS.tab]: MONTH_SHEETS[MONTH_KEYS[monthIndex]],
    [PAYSLIP_PRINT_CELLS.blockRow]: monthlyPayrollBlockRow(monthIndex),
    [PAYSLIP_PRINT_CELLS.heading]: PAYSLIP_PRINT_MONTHLY_HEADING,
    [PAYSLIP_PRINT_CELLS.periodNumber]: period,
  };
  const entries = payroll[MONTH_KEYS[monthIndex]] || [];
  if (entries.length === 0) {
    for (const cell of PAYSLIP_PRINT_BLANK_CELLS) sheet[cell] = SHEET_BLANK;
    return sheet;
  }

  const entry = entries[0];
  sheet[PAYSLIP_PRINT_CELLS.periodEnd] = excelSerial(new Date(entry.date));
  sheet.M8 = PAYSLIP_PRINT_FIRST_PAYROLL_NUMBER;
  for (const [cell, field] of Object.entries(PAYSLIP_PRINT_PERIOD_CELLS)) sheet[cell] = entry[field] || 0;

  const toDate = MONTH_KEYS.slice(0, period).flatMap((key) => (payroll[key] || []).slice(0, 1));
  for (const [cell, field] of Object.entries(PAYSLIP_PRINT_TO_DATE_CELLS)) {
    sheet[cell] = toDate.reduce((total, line) => total + (line[field] || 0), 0);
  }
  // M18's ADDRESS now points at the same cell I9 does -- the wages-paid date.
  sheet.M18 = sheet[PAYSLIP_PRINT_CELLS.periodEnd];
  return sheet;
}

function payrollMonths(payroll) {
  return MONTH_KEYS.map((month) =>
    (payroll?.[month] || []).reduce(
      (totals, entry) => ({
        grossPay: totals.grossPay + (entry.grossPay || 0),
        incomeTax: totals.incomeTax + (entry.incomeTax || 0),
        employeeNI: totals.employeeNI + (entry.employeeNI || 0),
        employerNI: totals.employerNI + (entry.employerNI || 0),
      }),
      { grossPay: 0, incomeTax: 0, employeeNI: 0, employerNI: 0 },
    ),
  );
}

// ── The fixed asset schedule ───────────────────────────────────────────────

/**
 * One Schedule row's computed columns.
 *
 * An existing asset's opening net book value is a formula, so its depreciation
 * charge is capped at what is still left to write off. A new asset's is an
 * empty cell, and MIN skips an empty cell, so the charge is the whole year's
 * rate on the cost.
 *
 * The blanks matter downstream. A row whose tax written down value is the blank
 * the formula leaves compares as text, so a disposal against it takes the
 * balancing allowance branch and subtracting text puts the schedule in error.
 * That is what the sheet reports for a disposal with no tax value entered, so
 * it is what this reports too.
 */
function scheduleRow({ cost, accDep = 0, taxWdv, depRate, aiaRate, wdaRate, disposal }) {
  const written = cost > 0;
  const isNewAsset = aiaRate !== undefined;
  const row = { E: cost, F: accDep, H: depRate };
  // A New asset block has no opening net book value column at all, so the row
  // shows nothing there and the depreciation charge below is not capped.
  row.G = isNewAsset || !written ? SHEET_BLANK : cost - accDep;
  row.I = written ? (isNewAsset ? cost * depRate : Math.min(cost * depRate, sheetNumber(row.G))) : SHEET_BLANK;
  row.J = written ? accDep + sheetNumber(row.I) : SHEET_BLANK;
  row.K = written ? (disposal ? 0 : cost - sheetNumber(row.J)) : SHEET_BLANK;

  if (!isNewAsset) {
    row.O = taxWdv === undefined ? SHEET_BLANK : taxWdv;
    row.Q = SHEET_BLANK;
    const claimsWritingDown = typeof row.O === "number" && row.O > 0;
    row.R = claimsWritingDown ? row.O * wdaRate : SHEET_BLANK;
    row.S = claimsWritingDown ? row.O - row.R : SHEET_BLANK;
  } else {
    row.O = SHEET_BLANK;
    row.P = aiaRate;
    row.Q = written ? cost * aiaRate : SHEET_BLANK;
    row.R = SHEET_BLANK;
    row.S = written ? cost - sheetNumber(row.Q) : SHEET_BLANK;
  }

  row.V = disposal ? disposal.proceeds : SHEET_BLANK;
  row.W = disposal ? cost : SHEET_BLANK;
  row.X = disposal ? sheetNumber(row.J) : SHEET_BLANK;
  if (!disposal) {
    row.Y = SHEET_BLANK;
    row.Z = SHEET_BLANK;
  } else if (typeof row.S !== "number") {
    row.Y = SHEET_ERROR;
    row.Z = SHEET_BLANK;
  } else {
    row.Y = disposal.proceeds < row.S ? row.S - disposal.proceeds : SHEET_BLANK;
    row.Z = disposal.proceeds > row.S ? disposal.proceeds - row.S : SHEET_BLANK;
  }
  return row;
}

// What a cell reads back as once its own arithmetic has failed. It carries
// through every cell that reads it.
const SHEET_ERROR = "#VALUE!";

/**
 * A cell's value, or the error a cell it reads is already in.
 * @param {Array} inputs - the cells the formula reads
 * @param {function(): *} compute - the formula, run only when all of them hold a value
 */
function carry(inputs, compute) {
  return inputs.some((value) => value === SHEET_ERROR) ? SHEET_ERROR : compute();
}

const SCHEDULE_TOTAL_COLUMNS = ["E", "F", "G", "I", "J", "K", "O", "Q", "R", "S", "V", "W", "X", "Y", "Z"];

function scheduleTotals(rows) {
  const totals = {};
  for (const column of SCHEDULE_TOTAL_COLUMNS) {
    totals[column] = rows.some((row) => row[column] === SHEET_ERROR) ? SHEET_ERROR : sheetSum(rows.map((row) => row[column]));
  }
  return totals;
}

function addScheduleTotals(left, right) {
  const totals = {};
  for (const column of SCHEDULE_TOTAL_COLUMNS) {
    totals[column] = left[column] === SHEET_ERROR || right[column] === SHEET_ERROR ? SHEET_ERROR : left[column] + right[column];
  }
  return totals;
}

function buildSchedule(scenario, taxData, rate) {
  const depreciation = taxData?.depreciation || {};
  const wdaRate = taxData?.capital_allowances?.writing_down_allowance ?? 0;
  const aiaRate = taxData?.capital_allowances?.annual_investment_allowance ?? 0;

  const capitalPurchases = [];
  for (const transactions of Object.values(scenario.purchases || {})) {
    for (const tx of transactions) if (tx.code === "fa") capitalPurchases.push(tx);
  }
  const disposals = [];
  for (const transactions of Object.values(scenario.sales || {})) {
    for (const tx of transactions) if (tx.code === "fs") disposals.push({ proceeds: roundedNetOfVat(tx.amount, rate) });
  }

  // The writer fills each category's rows in declaration order and pairs a
  // disposal with the existing asset row it disposes of, motor rows first.
  const assetsByCategory = { motor: [], computer: [] };
  for (const asset of scenario.opening_fixed_assets || []) {
    if (assetsByCategory[asset.category]) assetsByCategory[asset.category].push(asset);
  }
  const disposalOrder = [...assetsByCategory.motor, ...assetsByCategory.computer];
  const disposalByAsset = new Map();
  disposals.forEach((disposal, index) => {
    if (disposalOrder[index]) disposalByAsset.set(disposalOrder[index], disposal);
  });

  const existingRows = [];
  for (const [category, block] of Object.entries(EXISTING_ASSET_BLOCKS)) {
    for (const asset of assetsByCategory[category].slice(0, block.rows.length)) {
      existingRows.push(
        scheduleRow({
          cost: asset.cost,
          accDep: asset.acc_dep || 0,
          taxWdv: asset.tax_wdv,
          depRate: depreciation[block.rateKey] ?? 0,
          wdaRate,
          disposal: disposalByAsset.get(asset),
        }),
      );
    }
  }

  const newRows = capitalPurchases
    .slice(0, NEW_PLANT_ROW_COUNT)
    .map((tx) => scheduleRow({ cost: roundedNetOfVat(tx.amount, rate), depRate: depreciation.plant_and_machinery ?? 0, aiaRate }));

  const existing = scheduleTotals(existingRows);
  const additions = scheduleTotals(newRows);
  return { existing, additions, totals: addScheduleTotals(existing, additions) };
}

// ── Hire purchase ──────────────────────────────────────────────────────────

function buildHpFinance(scenario) {
  const cells = { E2: 0 };
  const agreements = scenario.hp_agreements || [];
  HP_AGREEMENT_ROWS.forEach((row, index) => {
    const agreement = agreements[index];
    if (!agreement) {
      cells[`I${row}`] = SHEET_BLANK;
      cells[`J${row}`] = SHEET_BLANK;
      cells[`K${row}`] = SHEET_BLANK;
      return;
    }
    const monthly = (agreement.amount_financed + agreement.admin_charges + agreement.total_interest) / agreement.months;
    const interest = agreement.total_interest / agreement.months;
    cells[`I${row}`] = monthly;
    cells[`K${row}`] = interest;
    cells[`J${row}`] = monthly - interest;
    cells.E2 += agreement.amount_financed;
  });
  return cells;
}

// Salesinvoice.xlsx links to nothing else in the book. The generator writes
// the tax year's standard rate down Product Details column D, and the
// invoice page looks its one sample line up from there.
//
// cellWrites only raises the sample invoice line for a VAT-registered
// business with a first sale to anchor it on (rate > 0, a VAT number, and a
// sale) -- the same condition checkCompliance's carriage checks gate on
// (app/products/se.js). A recalculated package proves the two states: with
// the line raised, Invoice Template!N27 through P64 resolve to real figures
// off the sample line and its carriage charge; without it, N27 stays blank
// and every cell downstream of it follows -- P58, P62 and P64 land on their
// formulas' own zero branch, while C38, J38, L38, P38 and the carriage cell
// P60 land on their formulas' own blank-string branch. This mirrors both
// states rather than assuming one.
function buildSalesInvoice(scenario, rate, taxData) {
  const standardRatePercent = Math.round((taxData?.vat?.standard_rate ?? 0) * 100);
  const productDetails = { D2: standardRatePercent };
  const firstInvoiceSale = Object.values(scenario.sales || {}).flat()[0];
  if (!(rate > 0 && scenario.business?.vat_number && firstInvoiceSale)) {
    return {
      "Salesinvoice.xlsx!Product Details": productDetails,
      "Salesinvoice.xlsx!Invoice Template": {
        J38: SHEET_BLANK,
        L38: SHEET_BLANK,
        P38: SHEET_BLANK,
        V38: 0,
        P58: 0,
        P60: SHEET_BLANK,
        P62: 0,
        P64: 0,
      },
    };
  }
  const lineNet = firstInvoiceSale.amount;
  const lineVat = (lineNet * standardRatePercent) / 100;
  const carriageVat = (SALESINVOICE_SAMPLE_CARRIAGE_CHARGE * standardRatePercent) / 100;
  const vatTotal = lineVat + carriageVat;
  return {
    "Salesinvoice.xlsx!Product Details": productDetails,
    "Salesinvoice.xlsx!Invoice Template": {
      J38: lineNet,
      L38: 1,
      P38: lineNet,
      V38: lineVat,
      P58: lineNet,
      P60: SALESINVOICE_SAMPLE_CARRIAGE_CHARGE,
      P62: vatTotal,
      P64: lineNet + SALESINVOICE_SAMPLE_CARRIAGE_CHARGE + vatTotal,
    },
  };
}

// ── The Admin sheet ────────────────────────────────────────────────────────

function adminDateSerials(startYear) {
  const serials = {};
  for (const [cell, date] of Object.entries({ ...generateAdminDates(startYear), ...seVatPaymentDueDate(startYear) })) {
    serials[parseInt(cell.slice(1), 10)] = excelSerial(date);
  }
  return serials;
}

function buildAdmin(taxData, dateSerials) {
  const it = taxData.income_tax;
  const ni = taxData.national_insurance;
  const ca = taxData.capital_allowances;
  const dep = taxData.depreciation || {};
  const mil = taxData.mileage;
  const cells = {};
  for (const [row, serial] of Object.entries(dateSerials)) cells[`B${row}`] = serial;
  if (taxData.tax_year?.label) cells.B23 = taxData.tax_year.label;
  if (taxData.tax_year?.next_label) cells.B24 = taxData.tax_year.next_label;
  cells.N4 = it.personal_allowance;
  cells.N5 = it.personal_allowance_taper_threshold;
  cells.N6 = it.basic_rate;
  cells.N7 = it.higher_rate;
  cells.N8 = it.additional_rate;
  cells.K11 = it.basic_rate;
  cells.N11 = it.starter_band_end;
  cells.M11 = it.basic_band_end;
  cells.K12 = it.higher_rate;
  cells.L12 = it.higher_band_start;
  cells.N12 = it.higher_band_start;
  cells.K13 = it.additional_rate;
  cells.L13 = it.higher_band_end + 1;
  cells.N13 = it.higher_band_end;
  cells.L16 = ni.class2_weekly_rate;
  cells.L20 = ni.class4_lower_rate;
  cells.N20 = ni.class4_lower_limit;
  cells.L23 = ni.class4_upper_rate;
  cells.N23 = ni.class4_upper_limit;
  cells.G4 = ca.annual_investment_allowance;
  cells.G5 = ca.writing_down_allowance;
  cells.G13 = dep.land_and_property;
  cells.G14 = dep.plant_and_machinery;
  cells.G15 = dep.fixtures_and_fittings;
  cells.G16 = dep.computer_equipment;
  cells.G17 = dep.motor_vehicles;
  cells.F21 = mil.higher_rate_limit;
  cells.G21 = mil.higher_rate_pence;
  cells.F22 = mil.lower_rate_start;
  cells.G22 = mil.lower_rate_pence;
  cells.F26 = taxData.vat.registration_threshold;
  cells.F27 = taxData.vat.standard_rate;
  return cells;
}

// ── The payroll calendar ───────────────────────────────────────────────────

function buildPayrollCalendar(startYear, taxYearStartSerial) {
  const calendar = generatePayslipsCalendar(startYear);
  const yearStart = dateFromExcelSerial(taxYearStartSerial);
  const yearEndSerial =
    excelSerial(new Date(Date.UTC(yearStart.getUTCFullYear() + 1, yearStart.getUTCMonth(), yearStart.getUTCDate()))) - 1;
  const yearEnd = dateFromExcelSerial(yearEndSerial);
  const cells = {
    B2: taxYearStartSerial,
    I1: yearEndSerial,
    N1: `${yearEnd.getUTCFullYear() - 1}-${yearEnd.getUTCFullYear() - 2000}`,
  };
  for (const row of PAYROLL_CALENDAR_SAMPLE_ROWS) {
    const monthNumber = calendar[`D${row}`];
    if (monthNumber === undefined) continue;
    cells[`B${row}`] = taxYearStartSerial + row - 2;
    cells[`C${row}`] = calendar[`C${row}`];
    cells[`D${row}`] = monthNumber;
    cells[`A${row}`] = SHORT_MONTH_NAMES[(yearStart.getUTCMonth() + monthNumber - 1) % 12];
  }
  return cells;
}

// ── The whole book ─────────────────────────────────────────────────────────

export function calculateSeResults(book, lines, taxData, scenario = {}) {
  const rate = vatRateFor(scenario);
  const startYear = taxData?.tax_year?.start ? new Date(taxData.tax_year.start).getUTCFullYear() : extractTaxYearStart(scenario);
  const dateSerials = adminDateSerials(startYear);
  const admin = buildAdmin(taxData, dateSerials);

  const salesMonths = journalMonths(scenario.sales, rate, SALES_ANALYSIS_COLUMNS, "a");
  const purchasesMonths = journalMonths(scenario.purchases, rate, PURCHASES_ANALYSIS_COLUMNS);
  const mileage = mileageMonths(scenario, taxData?.mileage);
  purchasesMonths.forEach((month, index) => {
    const claim = mileage[index].claim;
    if (!claim) return;
    month.gross += claim;
    month.net += claim;
    month.byCode.v = (month.byCode.v || 0) + claim;
  });
  const bank = bankBook(scenario.bank, "Bank.xlsx");
  const cash = bankBook(scenario.bank, "Cash.xlsx");
  const payroll = payrollMonths(scenario.payroll);
  const schedule = buildSchedule(scenario, taxData, rate);
  const scheduleNumber = (column) => sheetNumber(schedule.totals[column]);

  // The twelve monthly stock cells telescope, so whatever is counted between
  // them the year's movement is the difference between its two ends. A count at
  // only one end leaves the closing cell's own formula carrying the same figure
  // forward, so the movement is nil.
  const stockOpeningCount = scenario.stock?.opening ?? 0;
  const stockClosingCount = scenario.stock?.closing ?? stockOpeningCount;

  const salesCode = (index, code) => salesMonths[index].byCode[code] || 0;
  const purchasesCode = (index, code) => purchasesMonths[index].byCode[code] || 0;

  // ── Wagesinterface ──
  const wagesinterface = {};
  payroll.forEach((month, index) => {
    const row = WAGES_MONTH_ROWS[index];
    wagesinterface[`B${row}`] = dateSerials[index + 5];
    wagesinterface[`C${row}`] = month.grossPay;
    wagesinterface[`D${row}`] = month.incomeTax;
    wagesinterface[`E${row}`] = month.employeeNI;
    wagesinterface[`F${row}`] = 0;
    wagesinterface[`G${row}`] = month.grossPay - month.incomeTax - month.employeeNI;
    wagesinterface[`H${row}`] = month.employerNI;
    wagesinterface[`I${row}`] = 0;
  });

  // ── Profit and loss account ──
  const scheduleDepreciation = scheduleNumber("I");
  const disposalLoss = -(scheduleNumber("V") - scheduleNumber("W") + scheduleNumber("X"));
  const pl = {};
  MONTH_COLS.forEach((col, index) => {
    const closesTheYear = index === MONTH_COLS.length - 1;
    const wagesRow = WAGES_MONTH_ROWS[index];
    pl[`${col}5`] = salesCode(index, "a");
    pl[`${col}6`] = salesCode(index, "b");
    pl[`${col}7`] = salesCode(index, "c");
    pl[`${col}8`] = salesCode(index, "d");
    pl[`${col}9`] = pl[`${col}5`] + pl[`${col}6`] + pl[`${col}7`] + pl[`${col}8`];
    pl[`${col}11`] = salesCode(index, "g");
    pl[`${col}14`] = purchasesCode(index, "s") + (closesTheYear ? stockOpeningCount - stockClosingCount : 0);
    pl[`${col}15`] = purchasesCode(index, "c");
    pl[`${col}16`] = purchasesCode(index, "o");
    pl[`${col}17`] = pl[`${col}14`] + pl[`${col}15`] + pl[`${col}16`];
    pl[`${col}19`] = pl[`${col}9`] + pl[`${col}11`] - pl[`${col}17`];
    pl[`${col}21`] =
      purchasesCode(index, "w") + wagesinterface[`C${wagesRow}`] + wagesinterface[`H${wagesRow}`] - wagesinterface[`I${wagesRow}`];
    pl[`${col}22`] = purchasesCode(index, "p");
    pl[`${col}23`] = purchasesCode(index, "m");
    pl[`${col}24`] = purchasesCode(index, "g");
    pl[`${col}25`] = purchasesCode(index, "v");
    pl[`${col}26`] = purchasesCode(index, "h");
    pl[`${col}27`] = purchasesCode(index, "a");
    pl[`${col}28`] = purchasesCode(index, "l");
    pl[`${col}29`] = -salesCode(index, "o");
    pl[`${col}30`] = bankPayments(bank, index, "J");
    pl[`${col}31`] = bankPayments(cash, index, "J") + bankPayments(bank, index, "B");
    pl[`${col}32`] = purchasesCode(index, "y");
    pl[`${col}33`] = disposalLoss / 12;
    pl[`${col}34`] = scheduleDepreciation / 12;
    pl[`${col}35`] = sheetSum([21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34].map((row) => pl[`${col}${row}`]));
    pl[`${col}37`] = pl[`${col}19`] - pl[`${col}35`];
    pl[`${col}38`] = bankReceipts(bank, index, "K");
    pl[`${col}39`] = pl[`${col}37`] + pl[`${col}38`];
  });
  const yearTotal = (row) => sheetSum(MONTH_COLS.map((col) => pl[`${col}${row}`]));
  for (const row of [5, 6, 7, 8, 11, 14, 15, 16, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 38]) {
    pl[`B${row}`] = yearTotal(row);
  }
  pl.B9 = pl.B5 + pl.B6 + pl.B7 + pl.B8;
  pl.B17 = pl.B14 + pl.B15 + pl.B16;
  pl.B19 = pl.B9 + pl.B11 - pl.B17;
  pl.B35 = sheetSum([21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34].map((row) => pl[`B${row}`]));
  pl.B37 = pl.B19 - pl.B35;
  pl.B39 = pl.B37 + pl.B38;

  // ── The fixed asset workbook ──
  const scheduleCells = { E57: schedule.existing.E, E110: schedule.additions.E };
  for (const column of SCHEDULE_TOTAL_COLUMNS) scheduleCells[`${column}1`] = schedule.totals[column];
  const faReconciliation = {
    E11: schedule.additions.E,
    E13: journalCodeTotal(scenario.purchases, "fa", rate),
    K11: schedule.totals.V,
    K13: journalCodeTotal(scenario.sales, "fs", rate),
  };
  faReconciliation.E15 = faReconciliation.E13 - faReconciliation.E11;
  faReconciliation.K15 = faReconciliation.K13 - sheetNumber(faReconciliation.K11);

  // ── VAT ──
  const vatinterface = buildVatinterface({
    salesMonths,
    purchasesMonths,
    straddlingSales: straddlingPeriodTotals(scenario.vat_straddling_sales, rate),
    straddlingPurchases: straddlingPeriodTotals(scenario.vat_straddling_purchases, rate),
    adminDateSerials: dateSerials,
  });
  const firstMonthEnd = dateFromExcelSerial(dateSerials[5]);
  const returnPeriodEnds = vatReturnPeriodEnds(
    new Date(Date.UTC(firstMonthEnd.getUTCFullYear(), firstMonthEnd.getUTCMonth(), 1)),
    excelSerial,
  );

  // ── Payslips ──
  // The PAYE remittance schedule: B the tax month end and C the day the
  // payment falls due, both counted off the payroll year's first day; D the
  // National Insurance due, E the income tax and I the whole amount payable.
  const payment = {};
  payroll.forEach((month, index) => {
    const row = WAGES_MONTH_ROWS[index];
    payment[`B${row}`] = dateSerials[4] + PAYE_MONTH_END_DAYS[index];
    payment[`C${row}`] = dateSerials[4] + PAYE_DUE_DATE_DAYS[index];
    payment[`D${row}`] = month.employerNI + month.employeeNI;
    payment[`E${row}`] = month.incomeTax;
    payment[`I${row}`] = payment[`D${row}`] + payment[`E${row}`];
  });

  // ── The two self assessment returns ──
  // Boxes 26, 28, 50, 52, 53, 57 and 61 have no formula behind them: the
  // customer fills them in on the Business Details sheet or on the return, and
  // nothing the scenario carries reaches them.
  const goodsForOwnUse = 0;
  const lossesBroughtForward = 0;
  const analysesExpenses = pl.B9 > EXPENSE_ANALYSIS_TURNOVER;
  const analysed = (value) => (analysesExpenses ? value : SHEET_BLANK);
  const contractorDeductions = sheetSum(salesMonths.map((month) => month.cis));

  const scheduleQ = schedule.totals.Q;
  const scheduleR = schedule.totals.R;
  const scheduleS = schedule.totals.S;
  const scheduleY = schedule.totals.Y;
  const scheduleZ = schedule.totals.Z;

  const seShort = {};
  seShort.Q2 = dateSerials[4];
  seShort.V2 = dateSerials[17];
  // The return prints its business name at C8, its accounting date at S17 and
  // its turnover note at A33. The left-column equivalents (A7, D8, A32) are the
  // empty boxes beside the print locations.
  seShort.A7 = SHEET_BLANK;
  seShort.D8 = SHEET_BLANK;
  seShort.A32 = SHEET_BLANK;
  seShort.C8 = scenario.business?.name || " ";
  seShort.S17 = seShort.Q2;
  seShort.D38 = pl.B9;
  seShort.O38 = pl.B38;
  // Turnover note: conditional message about VAT threshold
  seShort.A33 =
    seShort.D38 > admin.F26
      ? `SELF-EMPLOYMENT FULL RETURN REQUIRED AS TURNOVER EXCEEDS £${admin.F26} VAT threshold`
      : `Business income - if your annual turnover was below £${admin.F26} VAT threshold`;
  seShort.D46 = analysed(pl.B17);
  seShort.O46 = analysed(pl.B28);
  seShort.D51 = analysed(pl.B25 + pl.B26);
  seShort.O51 = analysed(pl.B30 + pl.B31);
  seShort.D55 = analysed(pl.B21);
  seShort.O55 = analysed(pl.B24);
  seShort.D60 = analysed(pl.B22);
  seShort.O60 = analysed(pl.B27 + pl.B29 + pl.B32 + pl.B33);
  seShort.D64 = analysed(pl.B23);
  seShort.O64 = pl.B17 + pl.B35 - pl.B34;
  const shortNetProfit = seShort.D38 + seShort.O38 - seShort.O64;
  seShort.D71 = shortNetProfit >= 0 ? shortNetProfit : 0;
  seShort.O71 = shortNetProfit < 0 ? -shortNetProfit : 0;
  seShort.D80 = carry([scheduleQ], () => (scheduleQ > 0 ? scheduleQ : 0));
  seShort.O80 = carry([scheduleR, scheduleY], () => (scheduleR + scheduleY > 0 ? scheduleR + scheduleY : 0));
  seShort.D85 = carry([scheduleR, scheduleS], () => (scheduleR + scheduleS < 1000 ? scheduleS : 0));
  seShort.O85 = carry([scheduleZ], () => (scheduleZ > 0 ? scheduleZ : 0));
  seShort.D94 = goodsForOwnUse;
  const shortAllowances = [seShort.D71, seShort.O85, seShort.D94, seShort.O71, seShort.D80, seShort.D85, seShort.O80];
  seShort.D99 = carry(shortAllowances, () => {
    const profit = seShort.D71 + seShort.O85 + seShort.D94 - seShort.O71 - seShort.D80 - seShort.D85 - seShort.O80;
    return profit > 0 ? profit : 0;
  });
  seShort.O99 = pl.B11;
  seShort.O106 = carry(shortAllowances, () => {
    const loss = seShort.O71 + seShort.D80 + seShort.D85 + seShort.O80 - seShort.D71 - seShort.O85 - seShort.D94;
    return loss >= 0 ? loss : 0;
  });
  seShort.O94 = carry([seShort.O106, seShort.D99], () =>
    seShort.O106 > 0 || lossesBroughtForward === 0 ? 0 : Math.min(seShort.D99, lossesBroughtForward),
  );
  seShort.D106 = carry([seShort.D99, seShort.O94], () =>
    seShort.D99 + seShort.O99 - seShort.O94 > 0 ? seShort.D99 + seShort.O99 - seShort.O94 : 0,
  );
  seShort.O124 = contractorDeductions;

  const seFull = {};
  // ="COPY DETAILS TO HMRC FORM ... by 31st January "&TEXT(Admin!B21,"yyyy")
  seFull.G1 =
    `COPY DETAILS TO HMRC FORM          Submit HMRC RETURN ONLINE                   by 31st January ` +
    dateFromExcelSerial(admin.B21).getUTCFullYear();
  seFull.Q2 = dateSerials[4];
  seFull.V2 = dateSerials[17];
  seFull.D55 = pl.B9;
  seFull.O55 = pl.B38;
  seFull.D66 = pl.B14 + pl.B16;
  seFull.D70 = pl.B15;
  seFull.D74 = pl.B21;
  seFull.D78 = pl.B25 + pl.B26;
  seFull.D82 = pl.B22;
  seFull.D86 = pl.B23;
  seFull.D90 = pl.B24;
  seFull.D94 = pl.B27;
  seFull.D98 = pl.B30;
  seFull.D102 = pl.B31;
  seFull.D106 = pl.B29;
  seFull.D110 = pl.B28;
  seFull.D114 = pl.B33 + pl.B34;
  seFull.D118 = pl.B32;
  seFull.D122 = pl.B17 + pl.B35;
  seFull.O114 = pl.B34;
  seFull.O122 = pl.B34;
  const fullNetProfit = seFull.D55 + seFull.O55 - seFull.D122;
  seFull.D129 = fullNetProfit >= 0 ? fullNetProfit : 0;
  seFull.O129 = fullNetProfit < 0 ? -fullNetProfit : 0;
  seFull.G141 = admin.G5;
  seFull.D139 = carry([scheduleQ], () => (scheduleQ > 0 ? scheduleQ : 0));
  // Boxes the customer fills in by hand, with no formula to compute them. The
  // schedule keeps one main pool at the 18% writing down rate, so the special
  // rate pool (box 51), the zero-emission and structures-and-buildings claims
  // (boxes 52, 52.1 and 53) and the electric charge-point claim (box 54) have
  // nothing feeding them.
  seFull.D147 = SHEET_BLANK;
  seFull.D152 = SHEET_BLANK;
  seFull.D156 = SHEET_BLANK;
  seFull.D160 = SHEET_BLANK;
  seFull.O139 = SHEET_BLANK;
  seFull.D179 = SHEET_BLANK;
  // Box 50 carries the whole writing down allowance the schedule claims.
  seFull.D144 = carry([scheduleR], () => scheduleR);
  seFull.O144 = carry([scheduleR, scheduleS], () => (scheduleR + scheduleS < 1000 ? scheduleS : 0));
  seFull.O149 = scheduleY;
  seFull.O154 = carry([seFull.D139, seFull.D144, seFull.D152, seFull.O144, seFull.O149], () =>
    sheetSum([seFull.D139, seFull.D144, seFull.D147, seFull.D152, seFull.D156, seFull.D160, seFull.O139, seFull.O144, seFull.O149]),
  );
  seFull.O160 = scheduleZ;
  seFull.D169 = goodsForOwnUse;
  seFull.O169 = carry([seFull.O154], () => sheetNumber(seFull.O154) + sheetNumber(seFull.D179));
  seFull.D174 = carry([seFull.O160], () => sheetNumber(seFull.O122) + sheetNumber(seFull.O160) + sheetNumber(seFull.D169));
  seFull.O174 = carry([seFull.D129, seFull.D174, seFull.O169, seFull.O129], () => {
    const fromNetProfit = seFull.D129 + seFull.D174 - seFull.O169;
    return fromNetProfit > 0 ? fromNetProfit : Math.max(0, -seFull.O129 + seFull.D174 - seFull.O169);
  });
  seFull.O179 = carry([seFull.O174, seFull.D129, seFull.D174, seFull.O169, seFull.O129], () => {
    if (seFull.O174 > 0) return 0;
    const fromNetProfit = seFull.D129 + seFull.D174 - seFull.O169;
    if (fromNetProfit < 0) return -fromNetProfit;
    const fromNetLoss = -seFull.O129 + seFull.D174 - seFull.O169;
    return fromNetLoss < 0 ? -fromNetLoss : 0;
  });
  seFull.O194 = seFull.O174;
  seFull.O204 = pl.B11;
  seFull.O199 = carry([seFull.O194], () => (sheetNumber(seFull.D179) > 0 ? 0 : Math.min(seFull.O194 + seFull.O204, lossesBroughtForward)));
  seFull.O210 = carry([seFull.O194, seFull.O199], () => seFull.O194 - seFull.O199 + seFull.O204);
  seFull.D219 = carry([seFull.O179], () => seFull.O179);
  seFull.O224 = seFull.D219;
  seFull.D231 = contractorDeductions;
  seFull.J280 = admin.N20;

  // ── Income tax ──
  // The sheet charges tax on the full return's own taxable profit, not on the
  // profit and loss account's profit before tax.
  const taxableProfit = seFull.O210;
  const charged = carry([taxableProfit], () => calculateIncomeTax(taxableProfit, taxData.income_tax));
  const chargedOn = (field) => carry([charged], () => charged[field]);
  // The deduction line already holds the contractor deductions negated, and the
  // total below it adds every line up.
  const contractorDeductionLine = -contractorDeductions;
  const niLower = carry([taxableProfit], () =>
    taxableProfit > admin.N20 ? (Math.min(taxableProfit, admin.N23) - admin.N20) * admin.L20 : 0,
  );
  const niUpper = carry([taxableProfit], () => (taxableProfit > admin.N23 ? (taxableProfit - admin.N23) * admin.L23 : 0));
  const incomeTax = {
    E5: taxableProfit,
    E6: chargedOn("personalAllowance"),
    E7: chargedOn("taxableIncome"),
    C8: admin.N11,
    D8: admin.N6,
    E8: chargedOn("basicRateTax"),
    C9: admin.M11,
    D9: admin.N7,
    E9: chargedOn("higherRateTax"),
    C10: admin.N13,
    D10: admin.N8,
    E10: chargedOn("additionalRateTax"),
    E11: chargedOn("totalIncomeTax"),
    E12: contractorDeductionLine,
    C13: dateSerials[21],
    D15: admin.L20,
    E15: niLower,
    D16: admin.L23,
    E16: niUpper,
    E18: carry([charged, niLower, niUpper], () => charged.totalIncomeTax + contractorDeductionLine + niLower + niUpper),
  };

  // ── Profit forecast ──
  // The forecast repeats a month that traded and spreads the year's total
  // across the months that did not.
  const monthsTraded = MONTH_COLS.filter((col) => pl[`${col}9`] > 0).length;
  const projected = (row) =>
    sheetSum(MONTH_COLS.map((col) => (pl.B9 <= 0 ? 0 : pl[`${col}9`] > 0 ? pl[`${col}${row}`] : pl[`B${row}`] / monthsTraded)));
  const forecast = {};
  forecast.C21 = monthsTraded;
  forecast.C22 = projected(9);
  forecast.C24 = yearTotal(11);
  forecast.C26 = projected(17);
  forecast.C28 = forecast.C22 + forecast.C24 - forecast.C26;
  forecast.C30 = projected(35);
  forecast.C32 = forecast.C28 - forecast.C30;
  forecast.C33 = yearTotal(38);
  forecast.C34 = forecast.C32 + forecast.C33;
  forecast.C37 = pl.B33 + pl.B34;
  forecast.C38 = carry([scheduleQ, scheduleR, scheduleY, scheduleZ], () => scheduleQ + scheduleR + scheduleY - scheduleZ);
  forecast.C39 = carry([forecast.C38], () => forecast.C34 + forecast.C37 - forecast.C38);
  forecast.C40 = carry([forecast.C39], () => (forecast.C39 <= 0 ? 0 : Math.max(0, admin.N4 - Math.max(0, forecast.C39 - admin.N5) / 2)));
  forecast.C41 = carry([forecast.C39, forecast.C40], () => (forecast.C39 > forecast.C40 ? forecast.C39 - forecast.C40 : 0));
  forecast.C42 = carry([forecast.C41], () => (forecast.C41 > 0 ? Math.min(forecast.C41, admin.M11) * admin.N6 : 0));
  forecast.C43 = carry([forecast.C41], () => (forecast.C41 > admin.M11 ? (Math.min(forecast.C41, admin.N13) - admin.M11) * admin.N7 : 0));
  forecast.C44 = carry([forecast.C41], () => (forecast.C41 > admin.N13 ? (forecast.C41 - admin.N13) * admin.N8 : 0));
  forecast.C45 = carry(
    [forecast.C39],
    () =>
      (forecast.C39 > admin.N20 ? (Math.min(forecast.C39, admin.N23) - admin.N20) * admin.L20 : 0) +
      (forecast.C39 > admin.N23 ? (forecast.C39 - admin.N23) * admin.L23 : 0),
  );
  forecast.C46 = carry([forecast.C42, forecast.C43, forecast.C44, forecast.C45], () =>
    sheetSum([forecast.C42, forecast.C43, forecast.C44, forecast.C45]),
  );

  // ── VitalTax ──
  // The summary quotes the three product sales rows and the two direct cost
  // rows, nothing else.
  const quarterSum = (row, quarter) => sheetSum(MONTH_COLS.slice(quarter * 3, quarter * 3 + 3).map((col) => pl[`${col}${row}`]));
  const productSales = (quarter) => quarterSum(5, quarter) + quarterSum(6, quarter) + quarterSum(7, quarter);
  const directCosts = (quarter) => quarterSum(14, quarter) + quarterSum(16, quarter);
  const vitalTax = {
    C5: productSales(0),
    D5: productSales(1),
    E5: productSales(2),
    F5: productSales(3),
    C7: directCosts(0),
    D7: directCosts(1),
    E7: directCosts(2),
    F7: directCosts(3),
  };
  vitalTax.G5 = vitalTax.C5 + vitalTax.D5 + vitalTax.E5 + vitalTax.F5;
  vitalTax.G7 = vitalTax.C7 + vitalTax.D7 + vitalTax.E7 + vitalTax.F7;

  // ── The results, keyed the way the reconciliation reads them ──
  const results = {
    "Business Details": { C5: businessName(scenario) },
    "Profit & Loss Account": pl,
    "Income Tax": incomeTax,
    "Profit Forecast": forecast,
    "SE Short": seShort,
    "SE Full": seFull,
    "Wagesinterface": wagesinterface,
    "VitalTax": vitalTax,
    "StockControl": {
      [STOCK_OPENING_COUNT_CELL]: scenario.stock?.opening === undefined ? SHEET_BLANK : scenario.stock.opening,
      [STOCK_CLOSING_COUNT_CELL]: stockClosingCount,
    },
    "Admin": admin,
    "Fixedassets.xlsx!Schedule": scheduleCells,
    "Fixedassets.xlsx!FAreconciliation": faReconciliation,
    "Fixedassets.xlsx!HPfinance": buildHpFinance(scenario),
    ...buildSalesInvoice(scenario, rate, taxData),
    "Payslips.xlsx!Payment": payment,
    "Payslips.xlsx!Admin": buildPayrollCalendar(startYear, dateSerials[4]),
    [`Payslips.xlsx!${PAYSLIP_PRINT_SHEET}`]: buildPayslipsPrintPage(PAYSLIP_PRINT_PERIOD, scenario.payroll || {}),
    "Bank.xlsx!Mar": { A1: bank[11].opening, A2: bank[11].closing },
    "Cash.xlsx!Mar": { A1: cash[11].opening, A2: cash[11].closing },
    "Sales.xlsx!OpeningDebtors": { G1: ledgerTotal(scenario.opening_debtors) },
    "Sales.xlsx!ClosingDebtors": { G1: ledgerTotal(scenario.closing_debtors) },
    "Purchases.xlsx!OpeningCreditors": { G1: ledgerTotal(scenario.opening_creditors) },
    "Purchases.xlsx!ClosingCreditors": { G1: ledgerTotal(scenario.closing_creditors) },
  };

  for (const monthIndex of PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES) {
    const tab = MONTH_SHEETS[MONTH_KEYS[monthIndex]];
    results[`Payslips.xlsx!${tab}`] = buildPayslipsMonthTab(monthIndex, scenario.payroll?.[MONTH_KEYS[monthIndex]] || []);
  }

  // Every month tab carries its own whole-month totals on row 1, which is
  // what the PAYE schedule row for that month reads it through.
  payroll.forEach((month, index) => {
    const key = `Payslips.xlsx!${MONTH_SHEETS[MONTH_KEYS[index]]}`;
    if (!results[key]) results[key] = {};
    results[key][PAYE_SCHEDULE_MONTH_TAB_CELLS.employerNI] = month.employerNI;
    results[key][PAYE_SCHEDULE_MONTH_TAB_CELLS.employeeNI] = month.employeeNI;
    results[key][PAYE_SCHEDULE_MONTH_TAB_CELLS.incomeTax] = month.incomeTax;
    results[key][PAYE_SCHEDULE_MONTH_TAB_CELLS.studentLoan] = 0;
  });

  MONTH_KEYS.forEach((month, index) => {
    const tab = MONTH_SHEETS[month];
    const sales = salesMonths[index];
    const purchases = purchasesMonths[index];
    results[`Sales.xlsx!${tab}`] = { G1: sales.gross, H1: sales.vat, I1: sales.net, H2: rate * 100 };
    results[`Purchases.xlsx!${tab}`] = {
      G1: purchases.gross,
      H1: purchases.vat,
      I1: purchases.net,
      H2: rate * 100,
      AD1: purchases.cis,
      C2: mileage[index].miles,
      G2: mileage[index].claim,
      A2: mileage[index].claimToDate,
      // The month's own check total. Every analysed column is accounted for, so
      // the sheet balances whatever the CIS column carries beside it.
      A1: purchases.gross - purchases.vat - sheetSum(Object.values(purchases.byCode)),
    };
  });

  const vatinterfaceCells = {};
  for (let row = VATINTERFACE_FIRST_ROW; row <= VATINTERFACE_LAST_ROW; row++) {
    for (const [column, value] of Object.entries(vatinterface[row])) vatinterfaceCells[`${column}${row}`] = value;
  }
  results["Vat.xlsx!Vatinterface"] = vatinterfaceCells;
  returnPeriodEnds.forEach((periodEnd, index) => {
    results[`Vat.xlsx!VATQtr${index + 1}`] = vatReturnBoxes(vatinterface, periodEnd);
  });

  return withinReadScope(results);
}

// The report scores one value per cell the reconciliation reads, so a cell
// computed on the way to another one is working, not a reading. Handing back
// only the read scope keeps the two engines' documents the same shape.
function withinReadScope(results) {
  const scope = { ...standardReads() };
  for (const [file, sheets] of Object.entries(multiFileOptions().additionalReads)) {
    for (const [sheet, cells] of Object.entries(sheets)) scope[`${file}!${sheet}`] = cells;
  }
  const scoped = {};
  for (const [sheet, cells] of Object.entries(scope)) {
    const computed = results[sheet];
    if (!computed) continue;
    scoped[sheet] = {};
    for (const cell of cells) if (computed[cell] !== undefined) scoped[sheet][cell] = computed[cell];
  }
  return scoped;
}
