// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ltd.js — JS calculation engine for the Limited Company product.
//
// This module answers the question the Excel package answers: given the same
// book, journal and tax year, what does every cell the reconciliation reads
// hold? So it follows the workbook's own arithmetic rather than a tidier
// route to the same statement. Two consequences run through the file.
//
// A journal row takes its own VAT off its own gross and rounds nothing
// (Sales and Purchases column G = F * rate / (100 + rate), column H = F - G),
// and every analysis total is a sum of those row figures. Netting a month's
// gross instead leaves pennies behind, so sheetNet() is used wherever a
// statement line comes off a journal. The writer, by contrast, rounds a
// figure it puts on the Fixed Assets schedule to the penny, so a capital
// purchase or a disposal goes through writerNet().
//
// The workbook only holds what the writer put in it. cellWrites() fills the
// Fixed Assets schedule, the share register, the board minute and the stock
// count from the scenario, so where the scenario carries none of those the
// sheet keeps its own empty layout and every figure downstream follows. This
// engine reads the same scenario and lands in the same place, which is what
// makes the two comparable.

import { toExcelSerial } from "../spreadsheet-runner.js";
import { BANK_ACCOUNT_FILES, BANK_LAYOUTS, OPENING_FIXED_ASSET_COLUMNS } from "../ltd-layout.js";
import { apportionCorporationTax, financialYearsInPeriod } from "../tax/corporation-tax.js";
import { calculateCapitalAllowances } from "../tax/capital-allowances.js";
import {
  monthlyPayrollBlockRow,
  PAYE_SCHEDULE_FIRST_ROW,
  PAYE_SCHEDULE_MONTH_TAB_CELLS,
  PAYE_SCHEDULE_MONTH_TABS,
  payeTaxMonthDates,
  PAYROLL_WEEKS_PER_MONTH,
  PAYSLIP_PRINT_CELLS,
  PAYSLIP_PRINT_FIRST_PAYROLL_NUMBER,
  PAYSLIP_PRINT_MONTHLY_HEADING,
  PAYSLIP_PRINT_PERIOD_CELLS,
  PAYSLIP_PRINT_SHEET,
  PAYSLIP_PRINT_PERIOD,
  PAYSLIP_PRINT_TO_DATE_CELLS,
  PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES,
  PAYSLIPS_ENTRY_COLUMNS,
  PAYSLIPS_ZERO_FILLED_COLUMNS,
  payslipsMonthEntryRows,
  payslipsMonthPeriod,
  payslipsPeriodStartCell,
  payslipsWagesPaidCell,
  payrollYearStart,
} from "../payslips-layout.js";
import { addMonths, endOfMonth, SHEET_BLANK } from "./shared.js";
import { registerOfficers } from "../scenario-loader.js";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_COLS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
const VAT_RATE = 0.2;

// Sales and Purchases analysis columns, code letter by column letter, in the
// order row 5 of each month tab tests them. Column AK of a Purchases month
// tab is the CIS certificates column, which the writer fills from a
// sub-contractor purchase rather than from a code letter.
const SALES_ANALYSIS_COLUMNS = { a: "O", b: "P", c: "Q", d: "R", g: "S", o: "T", fs: "U" };
const PURCHASE_ANALYSIS_COLUMNS = {
  s: "O",
  c: "P",
  o: "Q",
  d: "R",
  w: "S",
  r: "T",
  p: "U",
  t: "V",
  q: "W",
  m: "X",
  u: "Y",
  a: "Z",
  g: "AA",
  h: "AB",
  v: "AC",
  n: "AD",
  f: "AE",
  l: "AF",
  y: "AG",
  z: "AH",
  fa: "AI",
};
const SALES_CIS_COLUMN = "V";
const PURCHASES_CIS_COLUMN = "AK";

// The two ledgers each journal workbook keeps beside its twelve month tabs,
// for the amounts owed at the year start and the year end.
const SALES_LEDGER_SHEETS = ["OpeningDebtors", "ClosingDebtors"];
const PURCHASES_LEDGER_SHEETS = ["OpeningCreditors", "ClosingCreditors"];

// The Admin B column is a chain of dates anchored at B32, the year end. It
// runs from thirteen months before the year end to four months after it.
const ADMIN_DATE_CHAIN_FIRST_ROW = 6;
const ADMIN_DATE_CHAIN_LAST_ROW = 40;

// The management P&L's five turnover rows, and the gap between each and the
// trial balance income row it reads. The trial balance holds income as a
// credit, so the P&L negates it back to a positive turnover.
const SALES_PL_ROWS = [4, 5, 6, 7, 8];
const SALES_ROW_OFFSET = 49;
const SALES_BAD_DEBT_ROW = 34;

// The management P&L's expense rows and the trial balance row each reads.
const EXPENSE_PL_ROWS = { 21: 68, 22: 69, 23: 70, 24: 71, 25: 72, 26: 73, 27: 74, 28: 75, 29: 76, 30: 77, 31: 78, 32: 79, 33: 80 };

// WagesInterface holds a month a row in two blocks, employees above
// directors, twelve rows each.
const WAGES_INTERFACE_EMPLOYEE_FIRST_ROW = 4;
const WAGES_INTERFACE_DIRECTOR_FIRST_ROW = 17;

// Fixed Assets schedule blocks. Each class has a block of rows for assets
// already owned with a totals row, and a second block for assets bought in
// the year with a totals row of its own. The published note reads one column
// per class.
const SCHEDULE_CLASSES = {
  land: {
    existingRows: [8, 9, 10],
    existingTotalRow: 11,
    newRows: [60, 61, 62, 63],
    newTotalRow: 64,
    noteColumn: "B",
    rateCell: "H7",
    openingKey: "land_buildings",
    label: "Land & Property",
  },
  plant: {
    existingRows: [14, 15, 16, 17, 18, 19, 20, 21],
    existingTotalRow: 22,
    newRows: [67, 68, 69, 70, 71, 72, 73, 74],
    newTotalRow: 75,
    noteColumn: "C",
    rateCell: "H13",
    openingKey: "plant_machinery",
    label: "Plant & Machinery",
  },
  fixtures: {
    existingRows: [25, 26, 27, 28, 29],
    existingTotalRow: 30,
    newRows: [78, 79, 80, 81, 82],
    newTotalRow: 83,
    noteColumn: "D",
    rateCell: "H24",
    openingKey: "fixtures_fittings",
    label: "Fixtures & Fittings",
  },
  computer: {
    existingRows: [33, 34, 35, 36, 37, 38, 39, 40],
    existingTotalRow: 41,
    newRows: [86, 87, 88, 89, 90, 91, 92, 93],
    newTotalRow: 94,
    noteColumn: "E",
    rateCell: "H32",
    openingKey: "computer_technology",
    label: "Computers",
  },
  motor: {
    existingRows: [50, 51, 52, 53, 54],
    existingTotalRow: 55,
    newRows: [103, 104, 105, 106, 107],
    newTotalRow: 108,
    noteColumn: "F",
    rateCell: "H43",
    openingKey: "motor_vehicles",
    label: "Motor Vehicles",
  },
};

// The trial balance's own fixed asset rows, class by class.
const SCHEDULE_COST_ROWS = { land: 6, plant: 7, fixtures: 8, computer: 9, motor: 10 };
const SCHEDULE_DEPRECIATION_ROWS = { land: 11, plant: 12, fixtures: 13, computer: 14, motor: 15 };

// Assets bought in the year all land on the New Plant & Machinery rows,
// matching the writer.
const SCHEDULE_NEW_ASSET_CLASS = "plant";

// The classes whose new-asset rows carry a capital allowance formula, and
// their existing-block writing down allowance totals. Land claims none.
const SCHEDULE_ALLOWANCE_CLASSES = ["plant", "fixtures", "computer", "motor"];

// The cars sub-block of the motor class. Its rows carry a writing down
// allowance formula rather than an investment allowance one, and the
// calculator never places an asset on them, so each stays on the sheet's own
// blank branch.
const SCHEDULE_CAR_ROWS = [97, 98, 99, 100, 101];

// A class totals row states whether the schedule and the opening balance
// sheet agree about that class. The computer block's warning carries a
// spelling slip the template has always had, and the reconciliation reads the
// cell as it stands.
const SCHEDULE_DISAGREEMENT_TEXT = "Check Opening Balance Sheet figures agree";
const SCHEDULE_COMPUTER_DISAGREEMENT_TEXT = "Check Opening Balkance Sheet figures agree";

// Vatinterface rows: two VAT periods before the accounting year, its own
// twelve months, then three after. Each row carries one period's figures, and
// columns E, G, I and K carry the rolling three-row sums the return boxes
// read. Row 4 reads the Admin month end two rows above the period start, and
// every row after it is two Admin rows further on.
const VATINTERFACE_FIRST_ROW = 4;
const VATINTERFACE_LAST_ROW = 20;
const VATINTERFACE_FIRST_MONTH_ROW = 6;
const VATINTERFACE_FIRST_ADMIN_ROW = 6;

// A VAT period either side of the accounting year is entered on its own pair
// of sheets rather than reached through a month tab.
const STRADDLING_PERIOD_ROWS = { "02Y1": 4, "03Y1": 5, "04Y2": 18, "05Y2": 19, "06Y2": 20 };

// The payroll calendar: tax week 1 is the five days from 6 April, every week
// after it is seven days, and the payroll months take the weeks the shared
// layout names.
const PAYROLL_FIRST_WEEK_DAYS = 5;
const PAYSLIPS_CALENDAR_FIRST_ROW = 2;

const REGISTER_MEMBER_ROWS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
// The register of directors and secretary runs one officer a row from row 2,
// and the register of directors' interests one a row from row 2 as well.
const DIRECTOR_SECRETARY_OFFICER_ROWS = [2, 3, 4, 5, 6, 7, 8];
const DIRECTORS_INTERESTS_ROWS = [2, 3, 4, 5, 6];
const SHARE_NOMINAL_VALUE = 1;
const CHARGE_REGISTER_ROWS = [2, 3, 4, 5, 6];
const HP_AGREEMENT_ROWS = [8, 10];
const EXPENSES_FORM_MONTHS = Array.from({ length: 12 }, (_, index) => `Month ${String(index + 1).padStart(2, "0")}`);

// The trial balance cells the reconciliation reads. The sheet carries a row
// for every account in the chart and the statements read it whole, so the
// engine builds the whole column and publishes this much of it.
const TRIAL_BALANCE_READS = [
  "D6",
  "D7",
  "D8",
  "D9",
  "D10",
  "D11",
  "D12",
  "D13",
  "D14",
  "D15",
  "D19",
  "D20",
  "D22",
  "D23",
  "D24",
  "D25",
  "D28",
  "D29",
  "D30",
  "D31",
  "D33",
  "D35",
  "D39",
  "D40",
  "D42",
  "D43",
  "D91",
  "EH35",
  "EJ20",
  "EJ22",
  "EJ23",
  "EJ24",
  "EJ25",
  "EJ26",
  "EJ28",
  "EJ29",
  "EJ30",
  "EJ31",
  "EJ32",
  "EJ33",
  "EJ34",
  "EJ35",
  "EJ39",
  "EJ40",
  "EJ48",
  "EJ66",
  "EJ91",
  "L34",
];

// Every trial balance row EJ91 adds up: the balance sheet down to the profit
// distribution, then the income and expense rows.
const AUDIT_ROWS = [
  6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 22, 23, 24, 25, 26, 28, 29, 30, 31, 32, 33, 34, 35, 37, 39, 40, 42, 43, 44, 47, 48,
  49, 53, 54, 55, 56, 57, 58, 60, 61, 62, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87,
  88, 89,
];

// ── Small helpers ──────────────────────────────────────────────────────────

function sheetVat(gross, rate) {
  return (gross * rate) / (1 + rate);
}

function sheetNet(gross, rate) {
  return gross - sheetVat(gross, rate);
}

// The net figure the writer puts on a schedule row, rounded to the penny.
function writerNet(gross, rate) {
  return Math.round((gross / (1 + rate)) * 100) / 100;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function sumValuesOf(object) {
  return object ? sum(Object.values(object)) : 0;
}

function parseDate(value) {
  if (value instanceof Date) return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function serialOf(date) {
  return toExcelSerial(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function fromSerial(serial) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 24 * 60 * 60 * 1000);
}

function zeroMonths() {
  return Array.from({ length: 12 }, () => 0);
}

// The cells of a month's totals the report does not already carry. Those are
// the ones a sibling workbook's link reads and nothing else does.
function linkOnlyCells(all, reported) {
  return Object.fromEntries(Object.entries(all).filter(([cell]) => !(cell in reported)));
}

// ── The accounting period ──────────────────────────────────────────────────

// The twelve month tabs in accounting-period order, and the Admin sheet's own
// B-column month ends. B32 is the year end and every other B entry is two
// rows per month away from it, so a row number alone names a month end either
// side of the year.
function periodFrom(book) {
  const yearEnd = parseDate(book.documentInfo?.periodCoveredEnd);
  const start = addMonths(new Date(Date.UTC(yearEnd.getUTCFullYear(), yearEnd.getUTCMonth(), 1)), -11);
  const tabs = Array.from({ length: 12 }, (_, index) => SHORT_MONTHS[(start.getUTCMonth() + index) % 12]);
  const adminMonthEnd = (row) => endOfMonth(yearEnd, (row - 32) / 2);
  return { yearEnd, start, tabs, adminMonthEnd };
}

// Every journal entry bucketed onto the month tab it lands on. The scenario's
// month keys already sit in the book's own period, and the writer moves each
// entry by the gap between that period and the package's, which is nil when
// both are this book's.
function bucketByTab(journal, tabs) {
  const buckets = Object.fromEntries(tabs.map((tab) => [tab, []]));
  for (const transactions of Object.values(journal || {})) {
    for (const transaction of transactions) {
      const tab = SHORT_MONTHS[parseDate(transaction.date).getUTCMonth()];
      if (buckets[tab]) buckets[tab].push(transaction);
    }
  }
  return buckets;
}

// ── Sales and Purchases month tabs ─────────────────────────────────────────

// Row 1 of a month tab totals every analysis column, and an analysis column
// takes a row's net figure when the row's code letter matches.
function journalMonthTotals(transactions, rate, analysisColumns, defaultCode, cisColumn) {
  const totals = { F1: 0, G1: 0, H1: 0, G2: rate * 100, [`${cisColumn}1`]: 0 };
  for (const column of Object.values(analysisColumns)) totals[`${column}1`] = 0;
  for (const transaction of transactions) {
    const vat = sheetVat(transaction.amount, rate);
    const net = transaction.amount - vat;
    totals.F1 += transaction.amount;
    totals.G1 += vat;
    totals.H1 += net;
    const column = analysisColumns[(transaction.code || defaultCode).toLowerCase()];
    if (column) totals[`${column}1`] += net;
    if (transaction.cis_deduction) totals[`${cisColumn}1`] += transaction.cis_deduction;
  }
  return totals;
}

// ── Bank workbooks ─────────────────────────────────────────────────────────

// Each workbook's month tabs: the receipts and payments totals and each code
// letter's own total. A "BC"-coded entry dated the period's own opening day
// is the account's opening balance, which the workbook takes in A1 rather
// than as a statement line; a "BC"-coded entry any other day is an ordinary
// transfer statement line, the same as any other code (BC also names the
// sibling a Cashaccount.xlsx transfer points at, on every other workbook's
// own tabs -- see BANK_TRANSFER_CODES).
function bankMonthTotals(scenario, tabs, periodStart) {
  const files = {};
  for (const fileName of Object.values(BANK_ACCOUNT_FILES)) {
    files[fileName] = {
      opening: 0,
      months: Object.fromEntries(tabs.map((tab) => [tab, { receipts: 0, payments: 0, receiptCodes: {}, paymentCodes: {} }])),
    };
  }
  for (const transactions of Object.values(scenario.bank || {})) {
    for (const transaction of transactions) {
      const fileName = BANK_ACCOUNT_FILES[transaction.account || "1200"];
      if (!fileName) continue;
      const file = files[fileName];
      if (transaction.code === "BC" && parseDate(transaction.date).getTime() === periodStart.getTime()) {
        file.opening = transaction.amount;
        continue;
      }
      const month = file.months[SHORT_MONTHS[parseDate(transaction.date).getUTCMonth()]];
      if (!month) continue;
      const receipt = transaction.direction === "in";
      month[receipt ? "receipts" : "payments"] += transaction.amount;
      const codes = receipt ? month.receiptCodes : month.paymentCodes;
      codes[transaction.code] = (codes[transaction.code] || 0) + transaction.amount;
    }
  }
  return files;
}

// One bank code's own total for each month of the year, across all four
// workbooks.
function bankCodeMonths(banks, code, side, tabs) {
  return tabs.map((tab) =>
    sum(
      Object.values(banks).map((file) => {
        const month = file.months[tab];
        const codes = side === "receipt" ? month.receiptCodes : month.paymentCodes;
        return codes[code] || 0;
      }),
    ),
  );
}

// ── Fixed Assets schedule ──────────────────────────────────────────────────

// One schedule row per asset, computed the way the sheet's own formulas
// compute it. An asset's depreciation charge is its cost at the class rate,
// capped at the net book value it carries; a disposal drops its net book
// value to nil and pulls its cost and accumulated depreciation into the
// disposal columns.
function buildSchedule(scenario, rate, depreciationRates, investmentAllowancePercent, writingDownPercent) {
  const rows = [];
  const usedByClass = {};
  for (const asset of scenario.opening_fixed_assets || []) {
    const layout = SCHEDULE_CLASSES[asset.category];
    if (!layout) continue;
    const index = (usedByClass[asset.category] = (usedByClass[asset.category] || 0) + 1) - 1;
    const row = layout.existingRows[index];
    if (row === undefined) continue;
    rows.push({
      assetClass: asset.category,
      row,
      acquiredInYear: false,
      cost: asset.cost,
      depreciationBroughtForward: asset.acc_dep || 0,
      taxWrittenDownValue: asset.tax_wdv || 0,
    });
  }

  const newLayout = SCHEDULE_CLASSES[SCHEDULE_NEW_ASSET_CLASS];
  let newIndex = 0;
  for (const transactions of Object.values(scenario.purchases || {})) {
    for (const transaction of transactions) {
      if (transaction.code !== "fa") continue;
      const row = newLayout.newRows[newIndex++];
      if (row === undefined) continue;
      rows.push({
        assetClass: SCHEDULE_NEW_ASSET_CLASS,
        row,
        acquiredInYear: true,
        purchasedOn: serialOf(parseDate(transaction.date)),
        description: transaction.supplier,
        cost: writerNet(transaction.amount, rate),
        depreciationBroughtForward: 0,
        taxWrittenDownValue: 0,
      });
    }
  }

  // A disposal attaches to an asset already on the schedule, assets brought
  // forward first, so the sheet's own disposal formulas resolve that row's
  // cost and accumulated depreciation.
  const disposalOrder = rows.filter((row) => !row.acquiredInYear).concat(rows.filter((row) => row.acquiredInYear));
  let disposalIndex = 0;
  for (const transactions of Object.values(scenario.sales || {})) {
    for (const transaction of transactions) {
      if (transaction.code !== "fs") continue;
      const target = disposalOrder[disposalIndex++];
      if (!target) continue;
      target.disposalProceeds = writerNet(transaction.amount, rate);
    }
  }

  for (const row of rows) {
    const ratePercent = depreciationRates[row.assetClass];
    const netBookValue = row.cost - row.depreciationBroughtForward;
    row.depreciationCharge = row.cost > 0 ? Math.min(row.cost * ratePercent, netBookValue) : 0;
    row.depreciationCarriedForward = row.cost > 0 ? row.depreciationBroughtForward + row.depreciationCharge : 0;
    row.disposed = (row.disposalProceeds || 0) > 0;
    row.netBookValueCarriedForward = row.cost > 0 && !row.disposed ? row.cost - row.depreciationCarriedForward : 0;
    row.disposalCost = row.disposed ? row.cost : 0;
    row.disposalDepreciation = row.disposed ? row.depreciationCarriedForward : 0;

    const claimRates = {
      investmentAllowancePercent: row.acquiredInYear ? investmentAllowancePercent : 0,
      writingDownPercent,
    };
    const claim = calculateCapitalAllowances(
      [
        {
          acquiredInYear: row.acquiredInYear,
          cost: row.cost,
          taxWrittenDownValue: row.taxWrittenDownValue,
          disposalProceeds: row.disposalProceeds || 0,
        },
      ],
      claimRates,
    );
    row.investmentAllowance = claim.investmentAllowance;
    row.writingDownAllowance = claim.writingDownAllowance;
    row.poolCarriedForward = row.acquiredInYear
      ? row.cost > 0
        ? row.cost - claim.investmentAllowance
        : 0
      : row.taxWrittenDownValue > 0
        ? row.taxWrittenDownValue - claim.writingDownAllowance
        : 0;
    row.balancingAllowance = claim.balancingAllowance;
    row.balancingCharge = claim.balancingCharge;
  }

  return rows;
}

// A block's own totals row: E cost, F depreciation brought forward, G net
// book value brought forward, I the charge for the year, J depreciation
// carried forward, K net book value carried forward, O the tax written-down
// value brought forward, Q the investment allowance, R the writing down
// allowance, S the pool carried forward, V disposal proceeds, W disposal
// cost, X disposal depreciation, Y the balancing allowance, Z the balancing
// charge.
function scheduleTotals(rows) {
  return {
    E: sum(rows.map((row) => row.cost)),
    F: sum(rows.map((row) => row.depreciationBroughtForward)),
    G: sum(rows.map((row) => row.cost - row.depreciationBroughtForward)),
    I: sum(rows.map((row) => row.depreciationCharge)),
    J: sum(rows.map((row) => row.depreciationCarriedForward)),
    K: sum(rows.map((row) => row.netBookValueCarriedForward)),
    O: sum(rows.map((row) => row.taxWrittenDownValue)),
    Q: sum(rows.map((row) => row.investmentAllowance)),
    R: sum(rows.map((row) => row.writingDownAllowance)),
    S: sum(rows.map((row) => row.poolCarriedForward)),
    V: sum(rows.map((row) => row.disposalProceeds || 0)),
    W: sum(rows.map((row) => row.disposalCost)),
    X: sum(rows.map((row) => row.disposalDepreciation)),
    Y: sum(rows.map((row) => row.balancingAllowance)),
    Z: sum(rows.map((row) => row.balancingCharge)),
  };
}

function scheduleBlocks(rows) {
  const blocks = {};
  for (const [className, layout] of Object.entries(SCHEDULE_CLASSES)) {
    blocks[className] = {
      layout,
      existing: scheduleTotals(rows.filter((row) => row.assetClass === className && !row.acquiredInYear)),
      newAssets: scheduleTotals(rows.filter((row) => row.assetClass === className && row.acquiredInYear)),
    };
  }
  blocks.allExisting = scheduleTotals(rows.filter((row) => !row.acquiredInYear));
  blocks.allNew = scheduleTotals(rows.filter((row) => row.acquiredInYear));
  blocks.whole = scheduleTotals(rows);
  return blocks;
}

// ── Payroll ────────────────────────────────────────────────────────────────

// One month tab's payslip entries, in the order the writer fills the block.
function payrollEntriesByTab(scenario, tabs) {
  const buckets = Object.fromEntries(tabs.map((tab) => [tab, []]));
  for (const [monthKey, entries] of Object.entries(scenario.payroll || {})) {
    const tab = SHORT_MONTHS.find((month) => month.toLowerCase() === monthKey);
    if (tab === undefined || buckets[tab] === undefined) continue;
    buckets[tab].push(...entries);
  }
  return buckets;
}

// A month tab gives an employee their line by position, so the first entry in
// a month's block belongs to the first employee on the Employee sheet. `keep`
// picks the positions a bucket counts, which is how the employees' and
// directors' halves of the month are told apart.
function payrollByTab(entriesByTab, keep = () => true) {
  const buckets = {};
  for (const [tab, allEntries] of Object.entries(entriesByTab)) {
    const entries = allEntries.filter((entry, index) => keep(index));
    buckets[tab] = entries.reduce(
      (sums, entry) => ({
        grossPay: sums.grossPay + (entry.grossPay || 0),
        incomeTax: sums.incomeTax + (entry.incomeTax || 0),
        employeeNI: sums.employeeNI + (entry.employeeNI || 0),
        employerNI: sums.employerNI + (entry.employerNI || 0),
      }),
      { grossPay: 0, incomeTax: 0, employeeNI: 0, employerNI: 0 },
    );
  }
  return buckets;
}

// The row each payroll month opens on, with the tax week and the days from
// 6 April that put it there.
function payrollMonthStarts() {
  const starts = [];
  let weeksBefore = 0;
  for (let month = 1; month <= 12; month++) {
    const daysBefore = weeksBefore === 0 ? 0 : PAYROLL_FIRST_WEEK_DAYS + (weeksBefore - 1) * 7;
    starts.push({ month, row: PAYSLIPS_CALENDAR_FIRST_ROW + daysBefore, daysBefore, week: weeksBefore + 1 });
    weeksBefore += PAYROLL_WEEKS_PER_MONTH[month - 1];
  }
  return starts;
}

// ── The engine ─────────────────────────────────────────────────────────────

// Every figure the package holds, in two parts: `results`, the cells the
// reconciliation reads, and `linkCells`, the leaf cells a sibling workbook's
// external link addresses and nothing else does. Both come off the same run,
// so a cell in each carries the same value.
function computeLtd(book, lines, taxData, scenario) {
  const rate = scenario?.metadata?.vat_registered === false ? 0 : VAT_RATE;
  const linkCells = {};
  const link = (key, cells) => Object.assign((linkCells[key] ||= {}), cells);
  const period = periodFrom(book);
  const tabs = period.tabs;
  const results = {};

  const admin = buildAdmin(taxData, period);
  results.Admin = admin;
  link("Admin", { ...linkOnlyCells(adminDateChain(period), admin), N11: admin.B32 });

  const salesByTab = bucketByTab(scenario.sales, tabs);
  const purchasesByTab = bucketByTab(scenario.purchases, tabs);
  const salesMonths = {};
  const purchaseMonths = {};
  for (const tab of tabs) {
    salesMonths[tab] = journalMonthTotals(salesByTab[tab], rate, SALES_ANALYSIS_COLUMNS, "a", SALES_CIS_COLUMN);
    purchaseMonths[tab] = journalMonthTotals(purchasesByTab[tab], rate, PURCHASE_ANALYSIS_COLUMNS, "g", PURCHASES_CIS_COLUMN);
    results[`Sales.xlsx!${tab}`] = {
      G1: salesMonths[tab].G1,
      G2: salesMonths[tab].G2,
      H1: salesMonths[tab].H1,
      T1: salesMonths[tab].T1,
      U1: salesMonths[tab].U1,
    };
    results[`Purchases.xlsx!${tab}`] = {
      G1: purchaseMonths[tab].G1,
      G2: purchaseMonths[tab].G2,
      H1: purchaseMonths[tab].H1,
      O1: purchaseMonths[tab].O1,
      R1: purchaseMonths[tab].R1,
      S1: purchaseMonths[tab].S1,
      AI1: purchaseMonths[tab].AI1,
    };
    link(`Sales.xlsx!${tab}`, linkOnlyCells(salesMonths[tab], results[`Sales.xlsx!${tab}`]));
    link(`Purchases.xlsx!${tab}`, linkOnlyCells(purchaseMonths[tab], results[`Purchases.xlsx!${tab}`]));
  }
  // A Sales tab's flat-rate cell is empty on the first tab and reads the tab
  // before it after that, so every tab but the first, and both ledgers, hold
  // nil. The two ledgers echo the first tab's VAT rate.
  for (const tab of tabs.slice(1)) link(`Sales.xlsx!${tab}`, { G4: 0 });
  for (const ledger of SALES_LEDGER_SHEETS) link(`Sales.xlsx!${ledger}`, { G2: salesMonths[tabs[0]].G2, G4: 0 });
  for (const ledger of PURCHASES_LEDGER_SHEETS) link(`Purchases.xlsx!${ledger}`, { G2: purchaseMonths[tabs[0]].G2 });
  const salesMonthly = (column) => tabs.map((tab) => salesMonths[tab][`${column}1`] || 0);
  const purchasesMonthly = (column) => tabs.map((tab) => purchaseMonths[tab][`${column}1`] || 0);

  const banks = bankMonthTotals(scenario, tabs, period.start);
  for (const [fileName, file] of Object.entries(banks)) {
    let balance = file.opening;
    let openingOfLastMonth = balance;
    for (const tab of tabs) {
      openingOfLastMonth = balance;
      const month = file.months[tab];
      balance = balance + month.receipts - month.payments;
      const layout = BANK_LAYOUTS[fileName];
      link(`${fileName}!${tab}`, {
        [`${layout.receipt.amount}1`]: month.receipts,
        [`${layout.payment.amount}1`]: month.payments,
        ...Object.fromEntries(layout.receiptColumns.map(([code, column]) => [`${column}1`, month.receiptCodes[code] || 0])),
        ...Object.fromEntries(layout.paymentColumns.map(([code, column]) => [`${column}1`, month.paymentCodes[code] || 0])),
      });
    }
    results[`${fileName}!${tabs[11]}`] = { A1: openingOfLastMonth, A2: balance };
  }

  const depreciationRates = {
    land: taxData.depreciation?.land_and_property ?? 0,
    plant: taxData.depreciation?.plant_and_machinery ?? 0,
    fixtures: taxData.depreciation?.fixtures_and_fittings ?? 0,
    computer: taxData.depreciation?.computer_equipment ?? 0,
    motor: taxData.depreciation?.motor_vehicles ?? 0,
  };
  const openingBalance = scenario.opening_balance || {};
  const scheduleRows = buildSchedule(scenario, rate, depreciationRates, admin.G5, admin.G6);
  const blocks = scheduleBlocks(scheduleRows);
  const scheduleSheet = buildScheduleSheet(blocks, openingBalance, depreciationRates);
  // The reconciliation checks pin a disposal's WDA and balancing allowance
  // split against the first existing motor row directly, not just the class
  // total, so that row's own O/R/S/V/Y cells need a value here too.
  const firstMotorRow = SCHEDULE_CLASSES.motor.existingRows[0];
  const motorRow = scheduleRows.find((row) => row.row === firstMotorRow && !row.acquiredInYear);
  if (motorRow) {
    scheduleSheet[`O${firstMotorRow}`] = motorRow.taxWrittenDownValue;
    scheduleSheet[`R${firstMotorRow}`] = motorRow.writingDownAllowance;
    scheduleSheet[`S${firstMotorRow}`] = motorRow.poolCarriedForward;
    if (motorRow.disposalProceeds !== undefined) scheduleSheet[`V${firstMotorRow}`] = motorRow.disposalProceeds;
    if (motorRow.disposed) scheduleSheet[`Y${firstMotorRow}`] = motorRow.balancingAllowance;
  }
  results["Fixedassets.xlsx!Schedule"] = scheduleSheet;
  link("Fixedassets.xlsx!Schedule", scheduleLinkCells(blocks, scheduleRows));
  // The workbook's own tie-out between the schedule and the two ledgers. E11
  // re-sums the schedule's New-asset cost totals (E6:E10 = Schedule E64, E75,
  // E83, E94, E108) and K11 the disposal proceeds on both halves of each
  // class (K6:K10 = Schedule V11+V64 and so on down). E13 and K13 read the
  // ledgers' own annual fixed asset totals across a leaf-to-leaf link
  // ([2]Mar!AI2 and [3]Mar!U2), and E15/K15 are the differences the sheet
  // prints. Each side has to come off its own source: deriving both from the
  // ledger leaves the difference nil whatever the schedule holds.
  const purchasesFixedAssetTotal = sum(purchasesMonthly("AI"));
  const salesFixedAssetTotal = sum(salesMonthly("U"));
  link(`Purchases.xlsx!${tabs[11]}`, { AI2: purchasesFixedAssetTotal });
  link(`Sales.xlsx!${tabs[11]}`, { U2: salesFixedAssetTotal });
  results["Fixedassets.xlsx!FAreconciliation"] = {
    E11: blocks.allNew.E,
    E13: purchasesFixedAssetTotal,
    E15: purchasesFixedAssetTotal - blocks.allNew.E,
    K11: blocks.whole.V,
    K13: salesFixedAssetTotal,
    K15: salesFixedAssetTotal - blocks.whole.V,
  };
  const hp = buildHirePurchase(scenario);
  results["Fixedassets.xlsx!HPfinance"] = hp.sheet;

  const payrollEntries = payrollEntriesByTab(scenario, tabs);
  const isDirectorsLine = (index) => Boolean((scenario.employees || [])[index]?.isDirector);
  const payroll = payrollByTab(payrollEntries);
  const employeePayroll = payrollByTab(payrollEntries, (index) => !isDirectorsLine(index));
  const directorPayroll = payrollByTab(payrollEntries, isDirectorsLine);
  results.WagesInterface = buildWagesInterface(employeePayroll, directorPayroll, tabs);
  const yearStart = payrollYearStart(payrollYearOf(taxData, period));
  results["Payslips.xlsx!Payment"] = buildPayslipsPayment(payroll, yearStart);
  results["Payslips.xlsx!Admin"] = buildPayslipsCalendar(taxData, period, tabs);
  for (const monthIndex of PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES) {
    const monthTab = buildPayslipsMonthTab(monthIndex, payrollEntries[tabs[monthIndex]] || []);
    addPayslipsWeeklyRemnants(monthTab, monthIndex);
    results[`Payslips.xlsx!${tabs[monthIndex]}`] = monthTab;
  }
  // Every month tab opens its monthly payroll block with the day the month it
  // is named for begins, and carries its own whole-month totals on row 1 for
  // the PAYE schedule to read, so all twelve carry those cells whether the
  // reconciliation reads the rest of the tab or not.
  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const tab = tabs[monthIndex];
    const key = `Payslips.xlsx!${tab}`;
    if (!results[key]) results[key] = {};
    results[key][payslipsPeriodStartCell(monthIndex)] = serialOf(payslipsMonthPeriod(period.start, monthIndex, yearStart).first);
    results[key][PAYE_SCHEDULE_MONTH_TAB_CELLS.employerNI] = payroll[tab].employerNI;
    results[key][PAYE_SCHEDULE_MONTH_TAB_CELLS.employeeNI] = payroll[tab].employeeNI;
    results[key][PAYE_SCHEDULE_MONTH_TAB_CELLS.incomeTax] = payroll[tab].incomeTax;
    results[key][PAYE_SCHEDULE_MONTH_TAB_CELLS.studentLoan] = 0;
    // Row 1 also totals the month's gross pay, its statutory pay and its
    // other deductions, and row 2 is the directors' block below it.
    link(key, {
      G1: 0,
      M1: payroll[tab].grossPay,
      Q1: 0,
      M2: directorPayroll[tab].grossPay,
      N2: directorPayroll[tab].incomeTax,
      O2: directorPayroll[tab].employeeNI,
      P2: 0,
      Q2: 0,
      T2: directorPayroll[tab].employerNI,
    });
  }
  results[`Payslips.xlsx!${PAYSLIP_PRINT_SHEET}`] = buildPayslipsPrintPage(PAYSLIP_PRINT_PERIOD, tabs, payrollEntries);

  const companySecretary = buildCompanySecretary(scenario);
  Object.assign(results, companySecretary);
  const boardMeeting = companySecretary["Companysecretary.xlsx!Boardmeeting"] || {};
  const dividendDeclared = boardMeeting.E4 || 0;
  const shareIssue = boardMeeting.E6 || 0;

  const stock = buildStock(scenario, openingBalance, rate, salesMonthly("O"), purchasesMonthly("O"));
  results.Stock = stock.sheet;
  results.OpenAccounts = buildOpenAccounts(book, scenario, openingBalance);
  link("OpenAccounts", openingFixedAssetCells(openingBalance));

  const trialBalance = buildTrialBalance({
    openingBalance,
    salesMonthly,
    purchasesMonthly,
    banks,
    payroll,
    employeePayroll,
    directorPayroll,
    blocks,
    stock,
    tabs,
    hp,
    dividendDeclared,
    shareIssue,
    smallProfitsRatePercent: admin.P7,
  });

  const monthlyPl = buildMonthlyProfitAndLoss(trialBalance, tabs);
  const publishedPl = buildPublishedProfitAndLoss(trialBalance, monthlyPl, admin);
  const corporationTax = buildCorporationTax({ admin, trialBalance, blocks, publishedPl });

  // The tax charge closes the books: the trial balance's corporation tax rows
  // read it, the published P&L reads those rows back, and the retained profit
  // that leaves is the reserve movement. That is the order the workbook's own
  // recalculation takes.
  trialBalance.EJ35 = trialBalance.corporationTaxCreditorBeforeCharge - corporationTax.K35 + trialBalance.EH35;
  trialBalance.EJ47 = corporationTax.K35;
  publishedPl.F50 = trialBalance.EJ47;
  publishedPl.F51 = publishedPl.F49 - publishedPl.F50;
  publishedPl.F52 = trialBalance.EJ48;
  publishedPl.F54 = publishedPl.F51 - publishedPl.F52;
  trialBalance.EJ43 = trialBalance.retainedEarningsBroughtForward - publishedPl.F54;
  trialBalance.EJ49 = publishedPl.F54;
  trialBalance.EJ91 = sum(AUDIT_ROWS.map((row) => trialBalance[`EJ${row}`] || 0));

  results["MnthP&L"] = monthlyPl;
  results.TrialBalance = trialBalanceReads(trialBalance);
  results.CorporationTax = corporationTaxReads(corporationTax);
  results.CT600 = buildCt600(corporationTax, monthlyPl, admin);
  results["PubP&L"] = publishedPl;
  results.PubBalSht = buildPublishedBalanceSheet(trialBalance, admin);
  results.PubNotes = buildPublishedNotes(blocks, trialBalance, corporationTax, admin, depreciationRates);
  results.Report = buildDirectorsReport(publishedPl, results.PubBalSht, companySecretary);

  Object.assign(results, buildVatReturns(salesMonths, purchaseMonths, period, scenario, rate));

  const mileageRate = taxData.mileage?.higher_rate_pence ?? 0;
  for (const sheet of EXPENSES_FORM_MONTHS) results[`expensesform.xlsx!${sheet}`] = { C30: mileageRate };

  Object.assign(results, buildSalesInvoice(scenario, rate, taxData));

  return { results, linkCells };
}

// The cells the reconciliation reads.
export function calculateLtdResults(book, lines, taxData, scenario) {
  return computeLtd(book, lines, taxData, scenario).results;
}

// Every cell a sibling workbook's link addresses, on top of the report's
// cells. The link-cache refresh reads its figures from here.
export function calculateLtdCells(book, lines, taxData, scenario) {
  const { results, linkCells } = computeLtd(book, lines, taxData, scenario);
  const cells = Object.fromEntries(Object.entries(results).map(([key, sheet]) => [key, { ...sheet }]));
  for (const [key, sheet] of Object.entries(linkCells)) Object.assign((cells[key] ||= {}), sheet);
  return cells;
}

// ── Admin ──────────────────────────────────────────────────────────────────

// Everything the generator injects from the tax-year data, plus the period
// dates the whole book hangs off. The corporation tax rows split the period
// at 31 March: L6 is the period start, N6 the earlier of the first financial
// year's end and the period end, L7 the day after and N7 the period end.
function buildAdmin(taxData, period) {
  const corporationTax = taxData.corporation_tax || {};
  const capitalAllowances = taxData.capital_allowances || {};
  const depreciation = taxData.depreciation || {};
  const mileage = taxData.mileage || {};
  const vat = taxData.vat || {};

  const yearEndSerial = serialOf(period.yearEnd);
  const periodStartSerial = serialOf(period.start);
  const financialYears = financialYearsInPeriod(period.start, period.yearEnd);

  return {
    B9: periodStartSerial,
    B32: yearEndSerial,
    F21: yearEndSerial,
    P6: Math.round(corporationTax.small_profits_rate * 100),
    P7: Math.round(corporationTax.small_profits_rate * 100),
    P8: Math.round(corporationTax.main_rate * 100),
    P9: corporationTax.marginal_relief_fraction,
    P12: corporationTax.small_profits_limit,
    P13: corporationTax.main_rate_limit,
    G5: Math.round(capitalAllowances.annual_investment_allowance * 100),
    G6: Math.round(capitalAllowances.writing_down_allowance_main * 100),
    G7: Math.round(capitalAllowances.annual_investment_allowance * 100),
    G8: Math.round(capitalAllowances.writing_down_allowance_main * 100),
    G15: depreciation.land_and_property,
    G16: depreciation.plant_and_machinery,
    G17: depreciation.fixtures_and_fittings,
    G18: depreciation.computer_equipment,
    G19: depreciation.motor_vehicles,
    N16: mileage.higher_rate_limit,
    O16: mileage.higher_rate_pence,
    N17: mileage.lower_rate_start,
    O17: mileage.lower_rate_pence,
    M19: Math.round(vat.standard_rate * 100),
    M21: Math.round(vat.standard_rate * 100),
    K6: financialYears.years[0].year,
    K7: financialYears.years[1].year,
    L6: periodStartSerial,
    L7: serialOf(financialYears.years[1].start),
    N6: serialOf(financialYears.years[0].end),
    N7: yearEndSerial,
  };
}

// Every row of the chain: an even row is a month end and the odd row under
// it the day the next month opens.
function adminDateChain(period) {
  const chain = {};
  for (let row = ADMIN_DATE_CHAIN_FIRST_ROW; row <= ADMIN_DATE_CHAIN_LAST_ROW; row++) {
    chain[`B${row}`] = row % 2 === 0 ? serialOf(period.adminMonthEnd(row)) : chain[`B${row - 1}`] + 1;
  }
  return chain;
}

// The opening cost and depreciation the opening balance sheet splits across
// row 13, one column a class, for the classes the book carries a figure for.
function openingFixedAssetCells(openingBalance) {
  const cells = {};
  const cost = openingBalance.fixed_asset_cost || {};
  const depreciation = openingBalance.fixed_asset_depreciation || {};
  for (const [assetClass, columns] of Object.entries(OPENING_FIXED_ASSET_COLUMNS)) {
    if (cost[assetClass] !== undefined) cells[`${columns.cost}13`] = cost[assetClass];
    if (depreciation[assetClass] !== undefined) cells[`${columns.depreciation}13`] = depreciation[assetClass];
  }
  return cells;
}

// ── Fixed Assets schedule sheet ────────────────────────────────────────────

// The schedule cells only the Financialaccounts corporation tax page reads:
// each class's writing down allowance on the existing block, the investment
// allowance an asset bought in the year claims, and the date, description and
// cost the writer put on that asset's row. A new-asset row with no asset on
// it stays on the sheet's own blank branch.
function scheduleLinkCells(blocks, rows) {
  const cells = {};
  for (const className of SCHEDULE_ALLOWANCE_CLASSES) {
    const layout = SCHEDULE_CLASSES[className];
    cells[`R${layout.existingTotalRow}`] = blocks[className].existing.R;
    for (const row of layout.newRows) {
      cells[`Q${row}`] = rows.find((asset) => asset.row === row)?.investmentAllowance ?? SHEET_BLANK;
    }
  }
  for (const row of SCHEDULE_CAR_ROWS) cells[`R${row}`] = SHEET_BLANK;
  for (const asset of rows) {
    if (!asset.acquiredInYear) continue;
    cells[`B${asset.row}`] = asset.purchasedOn;
    cells[`E${asset.row}`] = asset.cost;
    if (asset.description !== undefined) cells[`C${asset.row}`] = asset.description;
  }
  return cells;
}

function buildScheduleSheet(blocks, openingBalance, depreciationRates) {
  const sheet = {};
  for (const [className, layout] of Object.entries(SCHEDULE_CLASSES)) {
    const block = blocks[className];
    for (const column of ["E", "F", "I", "W", "X"]) {
      sheet[`${column}${layout.existingTotalRow}`] = block.existing[column];
      sheet[`${column}${layout.newTotalRow}`] = block.newAssets[column];
    }
    sheet[layout.rateCell] = depreciationRates[className];

    const openingCost = openingBalance.fixed_asset_cost?.[layout.openingKey] || 0;
    const openingDepreciation = openingBalance.fixed_asset_depreciation?.[layout.openingKey] || 0;
    const agrees = block.existing.E - block.existing.F === openingCost - openingDepreciation;
    sheet[`B${layout.existingTotalRow}`] = agrees
      ? `Existing ${layout.label}`
      : className === "computer"
        ? SCHEDULE_COMPUTER_DISAGREEMENT_TEXT
        : SCHEDULE_DISAGREEMENT_TEXT;
  }
  sheet.E57 = blocks.allExisting.E;
  sheet.E110 = blocks.allNew.E;
  for (const column of ["E", "F", "I", "J", "K", "Q", "R", "V", "W", "X", "Y", "Z"]) {
    sheet[`${column}1`] = blocks.whole[column];
  }
  // Net book value brought forward is stated for an asset already owned and
  // left blank for one bought in the year, so the whole-schedule total is the
  // existing blocks alone.
  sheet.G1 = blocks.allExisting.G;
  return sheet;
}

// ── Hire purchase ──────────────────────────────────────────────────────────

// The "New Hire Purchase Agreements" block totals what the agreements
// financed in E2, and each agreement's row splits its monthly payment into
// capital and interest.
function buildHirePurchase(scenario) {
  const agreements = (scenario.hp_agreements || []).slice(0, HP_AGREEMENT_ROWS.length);
  const sheet = { E2: sum(agreements.map((agreement) => agreement.amount_financed || 0)) };
  agreements.forEach((agreement, index) => {
    const row = HP_AGREEMENT_ROWS[index];
    const months = agreement.months || 0;
    const financed = agreement.amount_financed || 0;
    if (months <= 0 || financed <= 0) return;
    const interest = agreement.total_interest || 0;
    const adminCharges = agreement.admin_charges || 0;
    // The whole monthly payment, the interest inside it, and the capital that
    // is left: I = (E + F + G) / H, K = G / H, J = I - K.
    sheet[`I${row}`] = (financed + adminCharges + interest) / months;
    sheet[`K${row}`] = interest / months;
    sheet[`J${row}`] = sheet[`I${row}`] - sheet[`K${row}`];
  });
  return { sheet, longTermCreditor: sheet.E2 };
}

// ── Payroll sheets ─────────────────────────────────────────────────────────

// One month a row in each of two blocks, employees from row 4 and directors
// from row 17. The sheet works the employees' side out as the month's whole
// payroll less the month tab's own directors sub-total, so what reaches the
// P&L's two wages lines depends on which lines belong to a director.
function buildWagesInterface(employeePayroll, directorPayroll, tabs) {
  const sheet = {};
  const block = (firstRow, payroll) =>
    tabs.forEach((tab, index) => {
      const row = firstRow + index;
      sheet[`C${row}`] = payroll[tab].grossPay;
      sheet[`D${row}`] = payroll[tab].incomeTax;
      sheet[`E${row}`] = payroll[tab].employeeNI;
      sheet[`H${row}`] = payroll[tab].employerNI;
    });
  block(WAGES_INTERFACE_EMPLOYEE_FIRST_ROW, employeePayroll);
  block(WAGES_INTERFACE_DIRECTOR_FIRST_ROW, directorPayroll);
  return sheet;
}

// The PAYE remittance schedule, one row per tax month from row 4. B is the
// month end and C the day the payment falls due, both counted off the payroll
// year's first day. D is the National Insurance due, employer and employee, E
// the income tax and I the whole amount payable; the statutory pay and student
// loan columns the total also carries stay nil. A row takes the month tab
// named for the calendar month its tax month ends in, so row 4 is April
// whatever the package's year end.
function buildPayslipsPayment(payroll, payrollYearOpens) {
  const sheet = {};
  PAYE_SCHEDULE_MONTH_TABS.forEach((tab, taxMonth) => {
    const row = PAYE_SCHEDULE_FIRST_ROW + taxMonth;
    const { ends, due } = payeTaxMonthDates(payrollYearOpens, taxMonth);
    sheet[`B${row}`] = serialOf(ends);
    sheet[`C${row}`] = serialOf(due);
    const nationalInsurance = payroll[tab].employerNI + payroll[tab].employeeNI;
    sheet[`D${row}`] = nationalInsurance;
    sheet[`E${row}`] = payroll[tab].incomeTax;
    sheet[`I${row}`] = nationalInsurance + payroll[tab].incomeTax;
  });
  return sheet;
}

// The rows a month tab's weekly blocks keep for an employee paid weekly, and
// the row the last of them totals into. Every fixture pays monthly, so the
// weekly gate never reads true and these resolve to the sheet's own
// not-carried-forward branch: nil where the template holds a figure, blank
// where it holds text.
const PAYSLIPS_WEEKLY_ROWS = [11, 12, 13, 14, 15];
const PAYSLIPS_WEEKLY_PERIOD_TOTAL_CELL = "T41";
// The columns the following month's block brings a part-finished weekly cycle
// forward in. K starts a row lower than the rest, and M -- the payslip total
// -- brings its blank forward rather than a nil, so neither engine carries it.
const PAYSLIPS_BROUGHT_FORWARD_COLUMNS = ["H", "I", "J", "L"];
const PAYSLIPS_BROUGHT_FORWARD_LATE_COLUMN = { column: "K", firstRow: 12 };

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
      return;
    }
    if (entry.name) sheet[`${columns.name}${row}`] = entry.name;
    if (entry.taxCode) sheet[`${columns.taxCode}${row}`] = entry.taxCode;
    sheet[`${columns.grossPay}${row}`] = entry.grossPay || 0;
    sheet[`${columns.incomeTax}${row}`] = entry.incomeTax || 0;
    sheet[`${columns.employeeNI}${row}`] = entry.employeeNI || 0;
    sheet[`${columns.netPay}${row}`] = entry.netPay || 0;
    sheet[`${columns.employerNI}${row}`] = entry.employerNI || 0;
    if (entry.reference) sheet[`${columns.reference}${row}`] = entry.reference;
  });
  if (entries.length > 0) sheet[payslipsWagesPaidCell(monthIndex)] = serialOf(parseDate(entries[0].date));
  return sheet;
}

// Template position 3 keeps its weekly employee lines and its period total;
// position 4 keeps the cells that would bring an unfinished weekly cycle in
// from the month before it.
function addPayslipsWeeklyRemnants(sheet, monthIndex) {
  if (monthIndex === PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[0]) {
    sheet[PAYSLIPS_WEEKLY_PERIOD_TOTAL_CELL] = 0;
    return;
  }
  if (monthIndex !== PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[1]) return;
  for (const row of PAYSLIPS_WEEKLY_ROWS) {
    for (const column of PAYSLIPS_BROUGHT_FORWARD_COLUMNS) sheet[`${column}${row}`] = 0;
    if (row >= PAYSLIPS_BROUGHT_FORWARD_LATE_COLUMN.firstRow) sheet[`${PAYSLIPS_BROUGHT_FORWARD_LATE_COLUMN.column}${row}`] = 0;
  }
}

// The page the employer prints. H3 and H4 are the join -- the tab the chosen
// period lands on and the row its block starts at -- and I9, I10 and L7 the
// heading it prints above the figures. Everything below the heading is the
// first employee's own line on that month tab, gated on M8, the payroll
// number their Employee-sheet block gives them once their starting date has
// arrived. The year-to-date row runs from the payroll year's first month, so
// it adds that employee's line over every month up to the one printed.
function buildPayslipsPrintPage(period, tabs, entriesByTab) {
  const monthIndex = period - 1;
  const sheet = {
    [PAYSLIP_PRINT_CELLS.tab]: tabs[monthIndex],
    [PAYSLIP_PRINT_CELLS.blockRow]: monthlyPayrollBlockRow(monthIndex),
    [PAYSLIP_PRINT_CELLS.heading]: PAYSLIP_PRINT_MONTHLY_HEADING,
    [PAYSLIP_PRINT_CELLS.periodNumber]: period,
  };
  const entries = entriesByTab[tabs[monthIndex]] || [];
  if (entries.length === 0) return sheet;

  const entry = entries[0];
  sheet[PAYSLIP_PRINT_CELLS.periodEnd] = serialOf(parseDate(entry.date));
  sheet.M8 = PAYSLIP_PRINT_FIRST_PAYROLL_NUMBER;
  for (const [cell, field] of Object.entries(PAYSLIP_PRINT_PERIOD_CELLS)) sheet[cell] = entry[field] || 0;

  const toDate = tabs.slice(0, period).flatMap((tab) => (entriesByTab[tab] || []).slice(0, 1));
  for (const [cell, field] of Object.entries(PAYSLIP_PRINT_TO_DATE_CELLS)) {
    sheet[cell] = toDate.reduce((total, line) => total + (line[field] || 0), 0);
  }
  // M18's ADDRESS now points at the same cell I9 does -- the wages-paid date.
  sheet.M18 = sheet[PAYSLIP_PRINT_CELLS.periodEnd];
  return sheet;
}

// The year the package's payroll runs in, which is the year its tax data
// opens in. A book that carries no tax data derives it the way cellWrites
// does: the year before the year end's own calendar year, unless the year
// end falls in January to March, when the payroll year already opened the
// April before that year.
function payrollYearOf(taxData, period) {
  const financialYearStart = taxData.financial_year?.start;
  if (financialYearStart) return new Date(financialYearStart).getUTCFullYear();
  const targetStartYear = period.yearEnd.getUTCFullYear() - 1;
  const yearEndMonth = period.yearEnd.getUTCMonth() + 1;
  return yearEndMonth <= 3 ? targetStartYear : targetStartYear + 1;
}

// The calendar every payslip dates from. B2 carries the payroll year's first
// day and every date under it is the row above plus one, so naming the row a
// month opens on names its date, its tax week and its week within the month.
// The payroll year is the tax year the package was generated for, not the
// accounting period, so a company with a June year end still runs its payroll
// from the 6 April the rates start on. Column A is headed "Month Sheet" and
// is the printed payslip's join, so it names the package's own month tabs in
// order rather than the calendar months the dates beside it fall in.
function buildPayslipsCalendar(taxData, period, tabs) {
  const anchor = serialOf(payrollYearStart(payrollYearOf(taxData, period)));
  const sheet = { B2: anchor };
  for (const { month, row, daysBefore, week } of payrollMonthStarts()) {
    sheet[`A${row}`] = tabs[month - 1];
    sheet[`B${row}`] = anchor + daysBefore;
    sheet[`C${row}`] = week;
    sheet[`D${row}`] = month;
    sheet[`F${row}`] = 1;
  }
  return sheet;
}

// ── Company secretary ──────────────────────────────────────────────────────

// The share register, the board minute and the register of charges. Row 3 of
// the members register carries the template's own fully-paid ordinary share
// placeholder, which is where F1 takes the nominal value from whether or not
// a scenario names any members.
function buildCompanySecretary(scenario) {
  const register = { F1: SHARE_NOMINAL_VALUE };
  const members = scenario.members || [];
  members.forEach((member, index) => {
    const row = REGISTER_MEMBER_ROWS[index];
    if (row === undefined) return;
    register[`A${row}`] = member.name;
    register[`G${row}`] = member.shares;
  });
  // The directors' report prints the first two members a line each, so those
  // two share cells read back as nil rather than as nothing even when the
  // register is empty.
  for (const row of REGISTER_MEMBER_ROWS.slice(0, 2)) if (register[`G${row}`] === undefined) register[`G${row}`] = 0;
  register.G1 = sum(REGISTER_MEMBER_ROWS.map((row) => register[`G${row}`] || 0));

  // The minute and the charges register are read whether or not a scenario
  // fills them: a company that minuted no dividend still has a sheet, and the
  // checks that read it are the ones that would catch a dividend appearing
  // from nowhere.
  const boardMeeting = {};
  if (scenario.dividend) {
    boardMeeting.E4 = scenario.dividend.declared || 0;
    if (scenario.dividend.board_meeting) boardMeeting.F2 = serialOf(parseDate(scenario.dividend.board_meeting));
  }

  const charges = {};
  (scenario.charges || []).forEach((charge, index) => {
    const row = CHARGE_REGISTER_ROWS[index];
    if (row === undefined) return;
    charges[`C${row}`] = charge.valuation;
  });

  // The register of directors and secretary, and the register of directors'
  // interests: every officer the book declares, in the order it declares
  // them, with the business's own address and the capacity each was
  // appointed in. A director's interest is dated from the day the register of
  // members says they acquired their shares.
  const officers = {};
  const interests = {};
  const directors = registerOfficers(scenario);
  const business = scenario.business || {};
  const officerAddress = [business.address, business.town, business.postcode].filter(Boolean).join(", ") || undefined;
  directors.forEach((director, index) => {
    const officerRow = DIRECTOR_SECRETARY_OFFICER_ROWS[index];
    if (officerRow !== undefined) {
      officers[`A${officerRow}`] = director.name;
      if (officerAddress) officers[`B${officerRow}`] = officerAddress;
      if (director.appointed) officers[`C${officerRow}`] = serialOf(parseDate(director.appointed));
      officers[`D${officerRow}`] = director.role || "Director";
    }
    const interestRow = DIRECTORS_INTERESTS_ROWS[index];
    if (interestRow === undefined) return;
    interests[`A${interestRow}`] = director.name;
    if (officerAddress) interests[`B${interestRow}`] = officerAddress;
    const holding = members.find((member) => member.name === director.name);
    if (holding?.acquired) interests[`C${interestRow}`] = serialOf(parseDate(holding.acquired));
  });

  return {
    "Companysecretary.xlsx!RegisterofMembers": register,
    "Companysecretary.xlsx!Boardmeeting": boardMeeting,
    "Companysecretary.xlsx!Charges&Debentures": charges,
    "Companysecretary.xlsx!Directors&Secretary": officers,
    "Companysecretary.xlsx!DirectorsInterests": interests,
  };
}

// ── The customer-facing invoice ────────────────────────────────────────────

// The sample carriage charge cellWrites puts on the invoice's Invoice
// Database!E2 for a VAT-registered scenario (app/products/ltd.js).
const SALESINVOICE_SAMPLE_CARRIAGE_CHARGE = 37.5;

// Salesinvoice.xlsx links to nothing else in the book. The generator writes
// the tax year's standard rate down Product Details column D, and the invoice
// page looks its one sample line up from there.
//
// cellWrites only raises the sample invoice line for a VAT-registered
// business with a first sale to anchor it on (rate > 0, a VAT number, and a
// sale) -- the same condition checkCompliance's carriage checks gate on
// (app/products/ltd.js). A recalculated package proves the two states: with
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

// ── Stock ──────────────────────────────────────────────────────────────────

// The sheet runs a row per month end, carrying the opening figure forward,
// adding the materials bought and taking out the materials its own percentage
// reckons went into the product sales. With no percentage the materials
// column stays switched off and the calculated value is the opening figure
// all the way down. Only the final row takes a physical count, and the
// difference between count and calculation is the year's stock adjustment.
function buildStock(scenario, openingBalance, rate, productASalesMonthly, materialsBoughtMonthly) {
  const opening = openingBalance.stock || 0;
  const materialsPercent = scenario.stock?.materials_percent;
  const active = materialsPercent !== undefined;

  const movements = materialsBoughtMonthly.map((bought, index) => (active ? bought - materialsPercent * productASalesMonthly[index] : 0));
  const calculated = opening + sum(movements);
  const count = scenario.stock?.closing ?? calculated;
  const adjustment = count === calculated ? 0 : count - calculated;
  movements[movements.length - 1] += adjustment;

  return {
    sheet: { D6: opening, D30: calculated, AB30: count, Z30: adjustment },
    opening,
    closing: opening + sum(movements),
    movements,
  };
}

// ── Opening balance sheet ──────────────────────────────────────────────────

function buildOpenAccounts(book, scenario, openingBalance) {
  const entity = book.entityInformation || {};
  const business = scenario.business || {};
  const directors = (scenario.employees || []).filter((employee) => employee.isDirector);

  const cost = sumValuesOf(openingBalance.fixed_asset_cost);
  const depreciation = sumValuesOf(openingBalance.fixed_asset_depreciation);
  const bank =
    (openingBalance.current_account || 0) +
    (openingBalance.savings_account || 0) +
    (openingBalance.credit_card || 0) +
    (openingBalance.cash || 0);
  const taxAndSocial = (openingBalance.paye_due || 0) + (openingBalance.vat_due || 0) + (openingBalance.cis_due || 0);

  const assets =
    cost -
    depreciation +
    (openingBalance.stock || 0) +
    (openingBalance.trade_debtors || 0) +
    bank +
    (openingBalance.long_term_debtors || 0);
  const liabilities =
    (openingBalance.trade_creditors || 0) +
    (openingBalance.net_wages_due || 0) +
    (openingBalance.wage_deductions_due || 0) +
    (openingBalance.dividends_due || 0) +
    (openingBalance.corporation_tax || 0) +
    taxAndSocial +
    (openingBalance.directors_loan || 0) +
    (openingBalance.long_term_creditors || 0) +
    (openingBalance.share_capital || 0) +
    (openingBalance.retained_earnings || 0) +
    (openingBalance.capital_reserves || 0);

  const sheet = {
    E2: business.name || entity.organizationIdentifier || "",
    E13: cost - depreciation,
    E15: openingBalance.stock || 0,
    E16: openingBalance.trade_debtors || 0,
    E18: bank,
    E20: openingBalance.trade_creditors || 0,
    E24: openingBalance.corporation_tax || 0,
    E26: taxAndSocial,
    E30: openingBalance.directors_loan || 0,
    E33: openingBalance.share_capital || 0,
    E34: openingBalance.retained_earnings || 0,
    E37: assets - liabilities,
    E48: 0,
  };
  if (business.company_number) sheet.E3 = business.company_number;
  if (business.phone) sheet.E4 = business.phone;
  const description = business.description || entity.organizationDescription;
  if (description) sheet.E8 = description;
  if (business.address) sheet.J3 = business.address;
  if (business.town) sheet.J4 = business.town;
  if (business.postcode) sheet.N6 = business.postcode;
  if (business.utr) sheet.O3 = business.utr;
  if (directors[0]?.name) sheet.E5 = directors[0].name;
  return sheet;
}

// ── Trial balance ──────────────────────────────────────────────────────────

// Every closing balance the statements read. The workbook builds each one as
// the opening figure plus twelve months of movement plus a year-end
// adjustment, so that is the order here: the opening column first, then the
// journals, the banks and the payroll, then the schedule and the board
// minute. Each income and expense row keeps its twelve monthly figures beside
// its total, because the management P&L reads the months and the published
// statements read the year.
function buildTrialBalance(input) {
  const {
    openingBalance,
    salesMonthly,
    purchasesMonthly,
    banks,
    payroll,
    employeePayroll,
    directorPayroll,
    blocks,
    stock,
    tabs,
    hp,
    dividendDeclared,
    shareIssue,
  } = input;
  const openingCost = openingBalance.fixed_asset_cost || {};
  const openingDepreciation = openingBalance.fixed_asset_depreciation || {};
  const receipts = (code) => bankCodeMonths(banks, code, "receipt", tabs);
  const payments = (code) => bankCodeMonths(banks, code, "payment", tabs);
  const negated = (values) => values.map((value) => -value);
  const added = (...series) => series[0].map((_, index) => sum(series.map((values) => values[index])));

  const tb = { monthly: {} };

  // The opening column, cell by cell from the opening balance sheet.
  tb.D6 = openingCost.land_buildings || 0;
  tb.D7 = openingCost.plant_machinery || 0;
  tb.D8 = openingCost.fixtures_fittings || 0;
  tb.D9 = openingCost.computer_technology || 0;
  tb.D10 = openingCost.motor_vehicles || 0;
  tb.D11 = -(openingDepreciation.land_buildings || 0);
  tb.D12 = -(openingDepreciation.plant_machinery || 0);
  tb.D13 = -(openingDepreciation.fixtures_fittings || 0);
  tb.D14 = -(openingDepreciation.computer_technology || 0);
  tb.D15 = -(openingDepreciation.motor_vehicles || 0);
  tb.D19 = openingBalance.stock || 0;
  tb.D20 = openingBalance.trade_debtors || 0;
  tb.D22 = openingBalance.current_account || 0;
  tb.D23 = openingBalance.savings_account || 0;
  tb.D24 = openingBalance.credit_card || 0;
  tb.D25 = openingBalance.cash || 0;
  tb.D28 = -(openingBalance.trade_creditors || 0);
  tb.D29 = -(openingBalance.net_wages_due || 0);
  tb.D30 = -(openingBalance.wage_deductions_due || 0);
  tb.D31 = -(openingBalance.dividends_due || 0);
  tb.D32 = -(openingBalance.cis_due || 0);
  tb.D33 = -(openingBalance.vat_due || 0);
  tb.D34 = -(openingBalance.paye_due || 0);
  tb.D35 = -(openingBalance.corporation_tax || 0);
  tb.D37 = openingBalance.long_term_debtors || 0;
  tb.D39 = -(openingBalance.directors_loan || 0);
  tb.D40 = -(openingBalance.long_term_creditors || 0);
  tb.D42 = -(openingBalance.share_capital || 0);
  tb.D43 = -(openingBalance.retained_earnings || 0);
  tb.D44 = -(openingBalance.capital_reserves || 0);
  tb.D91 = sum(
    Object.entries(tb)
      .filter(([key]) => /^D\d+$/.test(key))
      .map(([, value]) => value),
  );

  // Income and expense rows, month by month. The sales analysis columns are
  // held as credits, which is why the management P&L negates them back.
  const monthly = tb.monthly;
  monthly[53] = negated(salesMonthly("O"));
  monthly[54] = negated(salesMonthly("P"));
  monthly[55] = negated(salesMonthly("Q"));
  monthly[56] = negated(salesMonthly("R"));
  monthly[57] = negated(salesMonthly("S"));
  monthly[58] = negated(receipts("K"));
  monthly[60] = added(purchasesMonthly("O"), negated(stock.movements));
  monthly[61] = purchasesMonthly("P");
  monthly[62] = purchasesMonthly("Q");
  monthly[64] = tabs.map((tab) => employeePayroll[tab].grossPay);
  monthly[65] = purchasesMonthly("S");
  monthly[66] = added(
    purchasesMonthly("R"),
    tabs.map((tab) => directorPayroll[tab].grossPay),
  );
  monthly[67] = tabs.map((tab) => payroll[tab].employerNI);
  for (const [row, column] of Object.entries({
    68: "T",
    69: "U",
    70: "V",
    71: "W",
    72: "X",
    73: "Y",
    74: "Z",
    75: "AA",
    76: "AB",
    77: "AC",
    78: "AD",
    79: "AE",
    80: "AF",
  })) {
    monthly[row] = purchasesMonthly(column);
  }
  monthly[81] = negated(salesMonthly("T"));
  monthly[82] = payments("J");
  monthly[83] = payments("B");
  monthly[84] = purchasesMonthly("AG");
  monthly[85] = purchasesMonthly("AH");
  // Depreciation and the loss on disposal reach the books a twelfth a month.
  const lossOnDisposal = blocks.whole.W - blocks.whole.X - blocks.whole.V;
  monthly[86] = zeroMonths().map(() => lossOnDisposal / 12);
  monthly[87] = zeroMonths().map(() => blocks.whole.I / 12);
  monthly[88] = negated(receipts("X"));
  monthly[89] = payments("X");
  monthly[19] = stock.movements;
  for (const [row, values] of Object.entries(monthly)) tb[`EJ${row}`] = sum(values) + (tb[`D${row}`] || 0);

  // Interest received arrives net of the tax deducted at source, and the
  // computation charges the gross figure. EH58 is the grossing-up and EH35
  // gives the same tax back as a credit against the charge.
  tb.EH58 = tb.EJ58 / ((100 - input.smallProfitsRatePercent) / 100) - tb.EJ58;
  tb.EJ58 += tb.EH58;
  tb.EH35 = -tb.EH58;

  // The fixed asset rows. Cost carries the additions and drops the disposals,
  // accumulated depreciation carries the year's charge and drops the
  // disposals' own, and the two accrual rows take the additions and the
  // disposal proceeds back out so the year's movement lands once.
  for (const [className, row] of Object.entries(SCHEDULE_COST_ROWS)) {
    const block = blocks[className];
    tb[`EJ${row}`] = (tb[`D${row}`] || 0) + block.newAssets.E - (block.existing.W + block.newAssets.W);
  }
  for (const [className, row] of Object.entries(SCHEDULE_DEPRECIATION_ROWS)) {
    const block = blocks[className];
    tb[`EJ${row}`] = (tb[`D${row}`] || 0) - (block.existing.I + block.newAssets.I) + (block.existing.X + block.newAssets.X);
  }
  tb.EJ16 = sum(purchasesMonthly("AI")) - blocks.allNew.E;
  tb.EJ17 = -sum(salesMonthly("U")) - lossOnDisposal + (blocks.whole.W - blocks.whole.X);

  // Debtors, creditors and the bank.
  tb.EJ20 = tb.D20 + sum(salesMonthly("F")) - sum(salesMonthly(SALES_CIS_COLUMN)) - sum(receipts("DR"));
  tb.EJ22 = tb.D22 + bankNet(banks["Currentaccount.xlsx"]);
  tb.EJ23 = tb.D23 + bankNet(banks["Savingaccount.xlsx"]);
  tb.EJ24 = tb.D24 + bankNet(banks["Creditcardaccount.xlsx"]);
  tb.EJ25 = tb.D25 + bankNet(banks["Cashaccount.xlsx"]) + shareIssue;
  tb.EJ26 = intraTransfers(banks);
  tb.EJ28 = tb.D28 - sum(purchasesMonthly("F")) + sum(purchasesMonthly(PURCHASES_CIS_COLUMN)) + sum(payments("CR")) + hp.longTermCreditor;
  tb.EJ29 = tb.D29;
  tb.EJ30 = tb.D30;
  tb.EJ31 = tb.D31 + sum(payments("DV")) - dividendDeclared;
  tb.EJ32 =
    tb.D32 + sum(salesMonthly(SALES_CIS_COLUMN)) - sum(purchasesMonthly(PURCHASES_CIS_COLUMN)) - sum(receipts("RC")) + sum(payments("RC"));
  tb.EJ33 = tb.D33 - sum(salesMonthly("G")) + sum(purchasesMonthly("G")) - sum(receipts("RV")) + sum(payments("RV"));
  tb.L34 = -sum(tabs.slice(0, 1).map((tab) => payroll[tab].incomeTax + payroll[tab].employeeNI + payroll[tab].employerNI));
  tb.EJ34 =
    tb.D34 + sum(payments("RP")) - sum(tabs.map((tab) => payroll[tab].incomeTax + payroll[tab].employeeNI + payroll[tab].employerNI));
  tb.EJ37 = tb.D37 - sum(receipts("LDR")) + sum(payments("LDR"));
  tb.EJ39 = tb.D39 - sum(receipts("DL")) + sum(payments("DL"));
  tb.EJ40 = tb.D40 - sum(receipts("LCR")) + sum(payments("LCR")) - hp.longTermCreditor;
  tb.EJ42 = tb.D42 - shareIssue;
  tb.EJ44 = tb.D44;
  tb.EJ48 = dividendDeclared;

  tb.corporationTaxCreditorBeforeCharge = tb.D35 + sum(payments("RT"));
  tb.retainedEarningsBroughtForward = tb.D43;
  return tb;
}

function bankNet(file) {
  if (!file) return 0;
  return sum(Object.values(file.months).map((month) => month.receipts - month.payments));
}

// The transfer legs each workbook carries, so a movement between two accounts
// nets to nil across the pair.
function intraTransfers(banks) {
  let total = 0;
  for (const [fileName, file] of Object.entries(banks)) {
    for (const month of Object.values(file.months)) {
      for (const code of BANK_LAYOUTS[fileName].transfers) {
        total += -(month.receiptCodes[code] || 0) + (month.paymentCodes[code] || 0);
      }
    }
  }
  return total;
}

// The cells the reconciliation reads off the trial balance.
function trialBalanceReads(tb) {
  return Object.fromEntries(TRIAL_BALANCE_READS.map((cell) => [cell, tb[cell] || 0]));
}

// ── Management profit and loss ─────────────────────────────────────────────

// Column B is the year and columns C to N the twelve months. A month column
// is that month's own movement on the trial balance row the line reads.
function buildMonthlyProfitAndLoss(tb, tabs) {
  const pl = {};
  const setRow = (row, values) => {
    tabs.forEach((tab, index) => {
      pl[`${MONTH_COLS[index]}${row}`] = values[index];
    });
    pl[`B${row}`] = sum(values);
  };
  const negated = (values) => values.map((value) => -value);

  // The five turnover lines sit 49 rows above their trial balance rows, and
  // the trial balance holds income as a credit, which is why they come back
  // negated.
  for (const row of SALES_PL_ROWS) setRow(row, negated(tb.monthly[row + SALES_ROW_OFFSET]));
  setRow(
    9,
    tabs.map((_, index) => sum(SALES_PL_ROWS.map((row) => pl[`${MONTH_COLS[index]}${row}`]))),
  );

  pl.B11 = tb.EJ60;
  setRow(12, tb.monthly[61]);
  setRow(13, tb.monthly[62]);
  pl.B14 = pl.B11 + pl.B12 + pl.B13;
  pl.B16 = pl.B9 - pl.B14;

  pl.B18 = tb.EJ64 + tb.EJ65;
  pl.B19 = tb.EJ66;
  pl.B20 = tb.EJ67;
  for (const [row, source] of Object.entries(EXPENSE_PL_ROWS)) setRow(row, tb.monthly[source]);
  setRow(SALES_BAD_DEBT_ROW, tb.monthly[81]);
  pl.B35 = tb.EJ82;
  pl.B36 = tb.EJ83 + tb.EJ88 + tb.EJ89;
  setRow(37, tb.monthly[84]);
  setRow(38, tb.monthly[85]);
  setRow(39, tb.monthly[86]);
  setRow(40, tb.monthly[87]);

  pl.B41 = sum(Array.from({ length: 23 }, (_, index) => pl[`B${18 + index}`] || 0));
  pl.B43 = pl.B16 - pl.B41;
  // The month columns carry the interest as the accounts received it. The
  // grossing-up for tax deducted at source is a year-end adjustment the
  // working sheet reads, not a movement any month saw.
  pl.B44 = -sum(tb.monthly[58]);
  pl.B45 = pl.B43 + pl.B44;
  return pl;
}

// ── Published statements ───────────────────────────────────────────────────

function buildPublishedProfitAndLoss(tb, pl, admin) {
  const turnover = -(tb.EJ53 + tb.EJ54 + tb.EJ55 + tb.EJ56);
  const grants = -tb.EJ57;
  const sheet = {
    D3: admin.B32,
    E5: admin.B32,
    B9: 0,
    B14: 0,
    B18: 0,
    B54: 0,
    F7: turnover,
    F8: grants,
    F9: turnover + grants,
    F16: pl.B14,
    F44: pl.B41,
  };
  sheet.F18 = sheet.F9 - sheet.F16;
  sheet.F46 = sheet.F18 - sheet.F44;
  sheet.F49 = sheet.F46 - tb.EJ58;
  return sheet;
}

function buildPublishedBalanceSheet(tb, admin) {
  const fixedAssets = sum([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((row) => tb[`EJ${row}`] || 0));
  const statementAccounts = tb.EJ22 + tb.EJ23 + tb.EJ24;
  const sheet = {
    D2: admin.B32,
    F6: fixedAssets,
    E10: tb.EJ19,
    E11: tb.EJ20,
    E12: statementAccounts > 0 ? statementAccounts + tb.EJ25 + tb.EJ26 : tb.EJ25,
    E16: -(tb.EJ28 + tb.EJ29 + tb.EJ30 + tb.EJ31),
    E17: -tb.EJ35,
    E18: -(tb.EJ32 + tb.EJ33 + tb.EJ34),
    E29: -tb.EJ39,
    E30: -tb.EJ40,
    F36: -tb.EJ42,
  };
  // The reserves rows sit under the share capital and roll into the
  // shareholders' funds total, which is the only one of the three the
  // statements quote.
  const revenueReserve = -tb.EJ43;
  const capitalReserve = -tb.EJ44;
  sheet.E13 = sheet.E10 + sheet.E11 + sheet.E12;
  sheet.E20 = sheet.E16 + sheet.E17 + sheet.E18;
  sheet.F22 = sheet.E13 - sheet.E20;
  sheet.F26 = sheet.F6 + sheet.F22;
  sheet.F31 = sheet.E29 + sheet.E30;
  sheet.F33 = sheet.F26 - sheet.F31;
  sheet.F39 = sheet.F36 + revenueReserve + capitalReserve;
  return sheet;
}

// The fixed asset note reads the schedule class by class, and the emoluments
// and tax notes read the trial balance and the working sheet.
function buildPublishedNotes(blocks, tb, corporationTax, admin, depreciationRates) {
  const sheet = { A11: admin.B32 };
  const columns = [];
  for (const [className, layout] of Object.entries(SCHEDULE_CLASSES)) {
    const { existing, newAssets } = blocks[className];
    const column = layout.noteColumn;
    columns.push(column);
    sheet[`${column}8`] = Math.max(existing.E, 0);
    sheet[`${column}9`] = Math.max(newAssets.E, 0);
    sheet[`${column}10`] = Math.max(existing.W + newAssets.W, 0);
    sheet[`${column}11`] = sheet[`${column}8`] + sheet[`${column}9`] - sheet[`${column}10`];
    sheet[`${column}14`] = Math.max(existing.F, 0);
    sheet[`${column}15`] = Math.max(existing.I + newAssets.I, 0);
    sheet[`${column}16`] = Math.max(existing.X + newAssets.X, 0);
    sheet[`${column}17`] = sheet[`${column}14`] - sheet[`${column}16`] + sheet[`${column}15`];
    sheet[`${column}20`] = sheet[`${column}11`] - sheet[`${column}17`];
  }
  for (const row of [8, 9, 10, 11, 14, 15, 16, 17, 20]) {
    sheet[`G${row}`] = sum(columns.map((column) => sheet[`${column}${row}`]));
  }
  sheet.B27 = depreciationRates.land;
  sheet.B28 = depreciationRates.plant;
  sheet.B29 = depreciationRates.fixtures;
  sheet.B30 = depreciationRates.computer;
  sheet.B31 = depreciationRates.motor;
  sheet.D35 = tb.EJ66;
  sheet.D41 = corporationTax.K35;
  return sheet;
}

function buildDirectorsReport(publishedPl, publishedBalanceSheet, companySecretary) {
  const register = companySecretary["Companysecretary.xlsx!RegisterofMembers"];
  const boardMeeting = companySecretary["Companysecretary.xlsx!Boardmeeting"] || {};
  const sheet = {
    F22: publishedBalanceSheet.D2,
    E87: publishedPl.F9,
    H87: publishedPl.B9,
    D94: boardMeeting.E4 || 0,
    I95: register.G1,
    F97: register.G3 ?? 0,
    F98: register.G4 ?? 0,
  };
  if (publishedPl.F9 > 0) sheet.D89 = publishedPl.F18 / publishedPl.F9;
  if (publishedPl.B9 > 0) sheet.I89 = publishedPl.B18 / publishedPl.B9;
  if (register.A3) sheet.A97 = register.A3;
  if (register.A4) sheet.A98 = register.A4;
  return sheet;
}

// ── Corporation tax working sheet and CT600 ────────────────────────────────

function buildCorporationTax({ admin, trialBalance, blocks, publishedPl }) {
  const goodwill = trialBalance.EJ85 > 0 ? trialBalance.EJ85 : 0;
  const depreciation = trialBalance.EJ87 > 0 ? trialBalance.EJ87 : 0;
  const netBalancingCharge = blocks.whole.W > 0 ? blocks.whole.Z - blocks.whole.Y : 0;

  const sheet = {
    E5: admin.L6,
    H5: admin.N7,
    K5: publishedPl.F46,
    I15: Math.max(blocks.allNew.Q, 0),
    I16: Math.max(blocks.allNew.R, 0),
    I17: Math.max(blocks.allExisting.R, 0),
    I18: netBalancingCharge !== 0 ? -netBalancingCharge : 0,
  };
  if (goodwill > 0) sheet.I7 = goodwill;
  if (depreciation > 0) sheet.I8 = depreciation;
  sheet.K10 = goodwill + depreciation;
  sheet.K12 = sheet.K5 + sheet.K10;
  sheet.K20 = sheet.I15 + sheet.I16 + sheet.I17 + sheet.I18;
  sheet.K22 = sheet.K12 - sheet.K20;
  sheet.K24 = -trialBalance.EJ58;
  sheet.K26 = 0;
  sheet.K28 = sheet.K22 + sheet.K24 - sheet.K26;

  const financialYears = financialYearsInPeriod(fromSerial(admin.L6), fromSerial(admin.N7));
  const charge = apportionCorporationTax(sheet.K28, financialYears.years, financialYears.totalDays, {
    smallProfitsRatePercent: [admin.P6, admin.P7],
    mainRatePercent: admin.P8,
    marginalReliefFraction: admin.P9,
    lowerLimit: admin.P12,
    upperLimit: admin.P13,
  });

  sheet.A33 = financialYears.years[0].days;
  sheet.A34 = financialYears.years[1].days;
  sheet.A35 = financialYears.totalDays;
  sheet.E33 = admin.K6;
  sheet.E34 = admin.K7;
  charge.rows.forEach((row, index) => {
    const sheetRow = 33 + index;
    sheet[`F${sheetRow}`] = row.profitShare;
    sheet[`G${sheetRow}`] = row.ratePercent;
    sheet[`J${sheetRow}`] = row.taxBeforeRelief;
    sheet[`L${sheetRow}`] = row.marginalRelief;
    sheet[`I${sheetRow}`] = row.tax;
  });
  sheet.K35 = charge.tax;
  sheet.K37 = trialBalance.EH35;
  sheet.K39 = sheet.K35 - sheet.K37;
  sheet.marginalRelief = charge.marginalRelief;
  return sheet;
}

function corporationTaxReads(sheet) {
  const reads = {};
  for (const [key, value] of Object.entries(sheet)) if (/^[A-Z]+\d+$/.test(key)) reads[key] = value;
  return reads;
}

// The filed form, box by box, from the working sheet beside it. A form states
// a figure only when there is one to state: a box the sheet leaves blank
// rather than nil is left out here too, and a year that made a loss files
// nothing in the trading profit and chargeable profit boxes.
function buildCt600(corporationTax, pl, admin) {
  const sheet = {
    B33: admin.L6,
    M33: admin.N7,
    AK66: pl.B9,
    C126: corporationTax.E33,
    N126: corporationTax.F33,
    AA126: corporationTax.G33,
    AJ126: corporationTax.J33,
    AJ128: corporationTax.J34,
  };
  // The second financial year's row is stated only when the period reaches
  // into it.
  if (corporationTax.A34 > 0) {
    sheet.C128 = corporationTax.E34;
    sheet.N128 = corporationTax.F34;
    sheet.AA128 = corporationTax.G34;
  }
  if (corporationTax.K22 > 0) sheet.Z70 = corporationTax.K22;
  if (corporationTax.K26 > 0) sheet.Z72 = corporationTax.K26;
  if (corporationTax.K24 > 0) sheet.AJ76 = corporationTax.K24;
  sheet.AJ74 = (sheet.Z70 || 0) - (sheet.Z72 || 0);
  sheet.AJ92 = sheet.AJ74 > 0 ? sheet.AJ74 + (sheet.AJ76 || 0) : 0;
  sheet.AJ110 = sheet.AJ92;
  sheet.AJ131 = sheet.AJ126 + sheet.AJ128;
  sheet.Y133 = corporationTax.marginalRelief;
  sheet.Y135 = sheet.AJ131 - sheet.Y133;
  sheet.AJ145 = sheet.Y135;
  sheet.AJ154 = corporationTax.K37 > 0 ? corporationTax.K37 : 0;
  sheet.AJ159 = sheet.AJ145 > 0 ? sheet.AJ145 - sheet.AJ154 : 0;
  sheet.AJ166 = sheet.AJ159 > 0 ? sheet.AJ159 : 0;
  if (sheet.Y135 > 0 && sheet.AJ110 !== 0) sheet.W137 = (sheet.Y135 * 100) / sheet.AJ110;
  return sheet;
}

// ── VAT interface and returns ──────────────────────────────────────────────

// One interface row per VAT period, in date order: the two periods before the
// accounting year, its own twelve months, then the three after. Columns E, G,
// I and K carry the rolling three-row sums a quarterly return reads, and each
// return looks its own quarter end up in column B.
function buildVatReturns(salesMonths, purchaseMonths, period, scenario, rate) {
  const rows = [];
  for (let row = VATINTERFACE_FIRST_ROW; row <= VATINTERFACE_LAST_ROW; row++) {
    const adminRow = VATINTERFACE_FIRST_ADMIN_ROW + (row - VATINTERFACE_FIRST_ROW) * 2;
    const monthIndex = row - VATINTERFACE_FIRST_MONTH_ROW;
    const tab = monthIndex >= 0 && monthIndex < 12 ? period.tabs[monthIndex] : null;
    const straddling = straddlingTotals(scenario, row, rate);
    rows.push({
      row,
      end: serialOf(period.adminMonthEnd(adminRow)),
      due: serialOf(period.adminMonthEnd(adminRow + 2)),
      salesNet: tab ? salesMonths[tab].H1 : straddling.salesNet,
      salesVat: tab ? salesMonths[tab].G1 : straddling.salesVat,
      purchasesNet: tab ? purchaseMonths[tab].H1 : straddling.purchasesNet,
      purchasesVat: tab ? purchaseMonths[tab].G1 : straddling.purchasesVat,
    });
  }

  const byRow = Object.fromEntries(rows.map((entry) => [entry.row, entry]));
  const rolling = (row, field) => sum([row - 2, row - 1, row].map((index) => (byRow[index] ? byRow[index][field] : 0)));

  const sheet = {};
  for (const entry of rows) {
    sheet[`B${entry.row}`] = entry.end;
    sheet[`C${entry.row}`] = entry.due;
    sheet[`D${entry.row}`] = entry.salesNet;
    sheet[`F${entry.row}`] = entry.salesVat;
    sheet[`H${entry.row}`] = entry.purchasesNet;
    sheet[`J${entry.row}`] = entry.purchasesVat;
    sheet[`M${entry.row}`] = 0;
    if (entry.row < VATINTERFACE_FIRST_MONTH_ROW) continue;
    sheet[`E${entry.row}`] = rolling(entry.row, "salesNet");
    sheet[`G${entry.row}`] = rolling(entry.row, "salesVat");
    sheet[`I${entry.row}`] = rolling(entry.row, "purchasesNet");
    sheet[`K${entry.row}`] = rolling(entry.row, "purchasesVat");
  }

  const results = { "Vatreturns.xlsx!Vatinterface": sheet };
  for (let quarter = 1; quarter <= 5; quarter++) {
    const row = VATINTERFACE_FIRST_MONTH_ROW - 1 + quarter * 3;
    const outputVat = sheet[`G${row}`] || 0;
    const inputVat = sheet[`K${row}`] || 0;
    results[`Vatreturns.xlsx!VATQtr${quarter}`] = {
      G5: byRow[row].end,
      G7: byRow[row].due,
      G9: outputVat,
      G13: outputVat,
      G15: inputVat,
      G17: outputVat - inputVat,
      G21: sheet[`E${row}`] || 0,
      G23: sheet[`I${row}`] || 0,
    };
  }
  return results;
}

function straddlingTotals(scenario, row, rate) {
  const totals = { salesNet: 0, salesVat: 0, purchasesNet: 0, purchasesVat: 0 };
  const period = Object.entries(STRADDLING_PERIOD_ROWS).find(([, entryRow]) => entryRow === row)?.[0];
  if (!period) return totals;
  for (const entry of scenario.vat_straddling_sales || []) {
    if (entry.period !== period) continue;
    totals.salesVat += sheetVat(entry.amount, rate);
    totals.salesNet += sheetNet(entry.amount, rate);
  }
  for (const entry of scenario.vat_straddling_purchases || []) {
    if (entry.period !== period) continue;
    totals.purchasesVat += sheetVat(entry.amount, rate);
    totals.purchasesNet += sheetNet(entry.amount, rate);
  }
  return totals;
}
