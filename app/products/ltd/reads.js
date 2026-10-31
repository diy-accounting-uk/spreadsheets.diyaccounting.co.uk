// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { BANK_ACCOUNT_FILES } from "../../lib/ltd-layout.js";
import {
  PAYE_SCHEDULE_FIRST_ROW,
  PAYE_SCHEDULE_MONTH_TABS,
  PAYE_SCHEDULE_MONTH_TAB_CELLS,
  PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES,
  PAYSLIP_PRINT_CELLS,
  PAYSLIP_PRINT_SHEET,
  payslipsPeriodStartCell,
} from "../../lib/payslips-layout.js";
import { PAYSLIPS_AUG_BROUGHT_FORWARD_CELLS, PAYSLIPS_JUL_DEAD_CELLS, payslipsMonthEntryCells } from "../../lib/product-sheets/payslips.js";
import {
  SALESINVOICE_INVOICE_TEMPLATE_CELLS,
  SALESINVOICE_LINE1_CELLS,
  SALESINVOICE_PRODUCT_DETAILS_COLUMNS,
  SALESINVOICE_SAMPLE_PRODUCT_ROW,
} from "../../lib/product-sheets/salesinvoice.js";
import { excelSerialToUtcDate } from "../../lib/product-sheets/serial-dates.js";
import { VATINTERFACE_ROWS } from "../../lib/product-sheets/vat-chain.js";
import { CELL_MAP, TAX_SHEET } from "./cell-map.js";
import {
  CHARGE_REGISTER_ROWS,
  DIRECTORS_INTERESTS_COLUMNS,
  DIRECTORS_INTERESTS_ROWS,
  DIRECTOR_SECRETARY_COLUMNS,
  DIRECTOR_SECRETARY_OFFICER_ROWS,
  PAYSLIPS_CALENDAR_ANCHOR_CELL,
  REGISTER_MEMBER_COLUMNS,
  REGISTER_MEMBER_ROWS,
  SCHEDULE_ASSET_CLASSES,
  SHORT_MONTHS,
  VAT_RATE_CELL,
} from "./layout.js";
import { getMonthTabNames, payrollMonthStarts } from "./writes.js";

// Month tab order (matching the scenario key order) and the MnthP&L column
// each month occupies — verified against the template (C = month 1 .. N =
// month 12).
export const MONTH_COLS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

// WagesInterface holds a month a row in two blocks, employees above
// directors, twelve rows each. The month tab's own directors sub-total is
// what separates them.
export const WAGES_INTERFACE_EMPLOYEE_FIRST_ROW = 4;

export const WAGES_INTERFACE_DIRECTOR_FIRST_ROW = 17;

// The two MnthP&L wages lines the split lands on: row 18 takes the
// employees' block plus the "w"-coded casual wages bought through
// Purchases.xlsx, row 19 the directors' block plus the "d"-coded directors
// payments bought the same way.
export const PL_EMPLOYEE_WAGES_ROW = 18;

export const PL_DIRECTOR_WAGES_ROW = 19;

// MnthP&L rows fed by a single Sales.xlsx or Purchases.xlsx analysis column
// with nothing else mixed in, keyed by the scenario transaction code letter
// (verified against the per-month TrialBalance formulas each row reads).
// Materials (row 11) also carries the stock adjustment, wages (rows 18-20)
// also carry WagesInterface payroll, and the bank and fixed asset rows come
// from elsewhere entirely, so none of those tie 1:1 to a month's code total.
// Row 27 reads two trial balance rows, advertising (74) and business
// entertainment (90), so the places below that read this map add code e's
// figure to code a's rather than the map carrying two codes on one row.
export const SALES_MONTHLY_TIE_ROWS = { a: 4, b: 5, c: 6, d: 7, g: 8 };

// Sales code "o" ("Other") feeds the bad debts row negated — a template
// quirk, verified against the formula chain (MnthP&L C34 = TrialBalance!O81,
// TrialBalance row 81 = -[3]Apr!$T$1).
export const SALES_BAD_DEBT_ROW = 34;

export const ENTERTAINMENT_CODE = "e";

export const PURCHASES_MONTHLY_TIE_ROWS = {
  c: 12,
  o: 13,
  r: 21,
  p: 22,
  t: 23,
  q: 24,
  m: 25,
  u: 26,
  a: 27,
  g: 28,
  h: 29,
  v: 30,
  n: 31,
  f: 32,
  l: 33,
  y: 37,
  z: 38,
};

// The management P&L's own caption for each tied row, taken from column A of
// the template. The netting table names a category the way the statement it
// feeds names it, so a reader can follow the letter to the line.
export const PL_ROW_CAPTIONS = {
  4: "Sales Product A",
  5: "Sales Product B",
  6: "Sales Product C",
  7: "Other Income",
  8: "Investment Grants received",
  12: "Sub contractors",
  13: "Other Direct Cost of Sales",
  18: "Wages and Salaries",
  21: "Premises Rent & Rates",
  22: "Premises Light & Heating",
  23: "Distribution Transport Costs",
  24: "Equipment Tools & Plant Hire",
  25: "Repairs & Maintenance",
  26: "Consumable Materials",
  27: "Advertising, Promotion & Entertainment",
  28: "Telephone Postage & Stationery",
  29: "Travel & Hotel Expenses",
  30: "Motor Vehicle Expenses",
  31: "Insurance Costs",
  32: "Leasing Charges",
  33: "Legal & Professional Fees",
  34: "Bad Debts written off",
  37: "Charitable Donations",
  38: "Goodwill written off",
};

// Admin cells the generator injects from the tax-year TOML, and the TOML
// path each one carries. Whole-number percentages where the sheet holds a
// percentage, fractions where it holds a fraction.
// Rows 6 and 7 of the Admin rate table are not here: every corporation tax
// figure on them belongs to the financial year that row names, so each is
// checked against its own year rather than against one figure from the file.
// Row 6 is the working sheet's first tax row and row 7 its second; each
// column holds one of the five figures its financial year charges by.
export const ADMIN_FINANCIAL_YEAR_ROWS = [6, 7];

export const ADMIN_RATE_COLUMNS = {
  smallProfitsRatePercent: "P",
  mainRatePercent: "R",
  marginalReliefFraction: "S",
  lowerLimit: "T",
  upperLimit: "U",
};

export const ADMIN_TAX_DATA_CELLS = [
  ["G5", "annual investment allowance", (t) => Math.round(t.capital_allowances.annual_investment_allowance * 100)],
  ["G7", "annual investment allowance (new assets)", (t) => Math.round(t.capital_allowances.annual_investment_allowance * 100)],
  ["G6", "writing down allowance", (t) => Math.round(t.capital_allowances.writing_down_allowance_main * 100)],
  ["G8", "writing down allowance (new assets)", (t) => Math.round(t.capital_allowances.writing_down_allowance_main * 100)],
  ["G15", "depreciation rate, land and property", (t) => t.depreciation.land_and_property],
  ["G16", "depreciation rate, plant and machinery", (t) => t.depreciation.plant_and_machinery],
  ["G17", "depreciation rate, fixtures and fittings", (t) => t.depreciation.fixtures_and_fittings],
  ["G18", "depreciation rate, computer equipment", (t) => t.depreciation.computer_equipment],
  ["G19", "depreciation rate, motor vehicles", (t) => t.depreciation.motor_vehicles],
  ["N16", "mileage higher rate limit", (t) => t.mileage.higher_rate_limit],
  ["O16", "mileage higher rate pence", (t) => t.mileage.higher_rate_pence],
  ["N17", "mileage lower rate start", (t) => t.mileage.lower_rate_start],
  ["O17", "mileage lower rate pence", (t) => t.mileage.lower_rate_pence],
  ["M19", "standard VAT rate", (t) => Math.round(t.vat.standard_rate * 100)],
  ["M21", "standard VAT rate (second period)", (t) => Math.round(t.vat.standard_rate * 100)],
];

// Depreciation rates the published note quotes, and the Admin cell each one
// should agree with.
export const NOTE_RATE_CELLS = [
  ["B27", "G15", "land and property"],
  ["B28", "G16", "plant and machinery"],
  ["B29", "G17", "fixtures and fittings"],
  ["B30", "G18", "computer equipment"],
  ["B31", "G19", "motor vehicles"],
];

// MnthP&L row 9 is the month's sales turnover, the sum of the five product
// rows above it.
export const MONTHLY_TURNOVER_ROW = 9;

// Row 1 of a Sales.xlsx month tab totals each analysis column: H1 the whole
// month net of VAT, T1 the bad debts written off and U1 the fixed asset
// sales. Turnover is what is left.
export const SALES_MONTH_TOTAL_CELLS = { net: "H1", badDebts: "T1", assetSales: "U1" };

// Row 1 of a Purchases.xlsx month tab: H1 the whole month net of VAT, and
// the four columns whose P&L rows carry something else as well — materials
// (O1, which the stock adjustment also feeds), directors and employee wages
// (R1 and S1, which the payroll summary also feeds) and fixed asset
// purchases (AI1, which reaches the balance sheet rather than the P&L).
export const PURCHASES_MONTH_TOTAL_CELLS = { net: "H1", materials: "O1", directorsWages: "R1", employeeWages: "S1", assetPurchases: "AI1" };

export const LTD_VAT_LAYOUT = {
  workbook: "Vatreturns.xlsx",
  monthTabs: fiscalMonthTabs,
  salesNetCell: SALES_MONTH_TOTAL_CELLS.net,
  salesVatCell: "G1",
  purchasesNetCell: PURCHASES_MONTH_TOTAL_CELLS.net,
  purchasesVatCell: "G1",
};

// The twelve month tabs a recalculated book actually carries, in accounting
// period order, taken from the period start date on its own Admin sheet.
export function fiscalMonthTabs(results) {
  return results.Admin && typeof results.Admin.B9 === "number" ? monthTabsFromPeriodStart(results.Admin.B9) : getMonthTabNames(3);
}

// Month tab names in accounting-period order, taken from the period start
// date the Admin sheet carries, so a leaf workbook's month totals line up
// with the P&L's month columns whatever the year end.
export function monthTabsFromPeriodStart(startSerial) {
  const firstMonth = excelSerialToUtcDate(startSerial).getUTCMonth();
  return Array.from({ length: 12 }, (_, i) => SHORT_MONTHS[(firstMonth + i) % 12]);
}

// The expenses claim form's twelve month tabs, in the order the workbook
// chains them from the first.
export const EXPENSES_FORM_MONTHS = Array.from({ length: 12 }, (_, i) => `Month ${String(i + 1).padStart(2, "0")}`);

// CT600 boxes the template populates by formula, and where each reads from.
export const CT600_CELLS = [
  "B33",
  "M33",
  "W137",
  "AK66",
  "Z70",
  "Z72",
  "Q206",
  "AJ74",
  "AJ76",
  "AJ92",
  "Z98",
  "AJ110",
  "AJ126",
  "AJ128",
  "AJ131",
  "AJ145",
  "AJ154",
  "AJ159",
  "AJ163",
  "AJ166",
  "AA126",
];

export function standardReads() {
  const reads = {};
  const add = (sheet, cell) => {
    if (!reads[sheet]) reads[sheet] = [];
    if (!reads[sheet].includes(cell)) reads[sheet].push(cell);
  };

  for (const [sheet, cell] of CELL_MAP) add(sheet, cell);

  // Every month column of the rows that tie to a Sales or Purchases month
  // total, plus the fixed asset rows the note anchors.
  const monthlyRows = [
    ...new Set([
      ...Object.values(SALES_MONTHLY_TIE_ROWS),
      SALES_BAD_DEBT_ROW,
      ...Object.values(PURCHASES_MONTHLY_TIE_ROWS),
      MONTHLY_TURNOVER_ROW,
      39,
      40,
    ]),
  ];
  for (const row of monthlyRows) {
    // Column B is the row's own SUM(C:N), the annual figure the netting
    // table compares a journal category against.
    for (const col of ["B", ...MONTH_COLS]) add("MnthP&L", `${col}${row}`);
  }

  // Fixed asset note, class column by class column.
  for (const { noteColumn } of Object.values(SCHEDULE_ASSET_CLASSES)) {
    for (const row of [8, 9, 10, 11, 14, 15, 16, 17, 20]) add("PubNotes", `${noteColumn}${row}`);
  }
  for (const [noteCell] of NOTE_RATE_CELLS) add("PubNotes", noteCell);
  add("PubNotes", "A11");

  // Corporation tax working sheet: the allowance lines, and the two dated
  // tax rows whose day counts, profit shares, rates and tax the charge for
  // the year is built from.
  for (const cell of [
    "E5",
    "H5",
    "I15",
    "I16",
    "I17",
    "I18",
    "A33",
    "A34",
    "A35",
    "E33",
    "E34",
    "F33",
    "F34",
    "G33",
    "G34",
    "J33",
    "J34",
    "L33",
    "L34",
    "I33",
    "I34",
    "K37",
  ])
    add(TAX_SHEET, cell);

  for (const cell of CT600_CELLS) add("CT600", cell);

  for (const [cell] of ADMIN_TAX_DATA_CELLS) add("Admin", cell);
  // The two tax rows' own rates, limits and relief fraction, which are not in
  // that table because each row takes its own financial year's figures.
  for (const row of ADMIN_FINANCIAL_YEAR_ROWS) {
    for (const column of Object.values(ADMIN_RATE_COLUMNS)) add("Admin", `${column}${row}`);
  }
  add("Admin", "P14");
  add("Admin", "F21");
  add("Admin", "B9");
  add("Admin", "B32");
  // The two dated corporation tax rate rows the working sheet copies.
  for (const cell of ["K6", "L6", "N6", "K7", "L7", "N7"]) add("Admin", cell);
  add("PubP&L", "D3");
  add("PubBalSht", "D2");

  // The directors' report quotes the year end, both years' turnover and
  // margin, the dividend the board minuted and the share register. F22 is
  // the only date it takes from the balance sheet rather than the P&L.
  for (const cell of ["F22", "E87", "H87", "D89", "I89", "D94", "I95", "A97", "F97", "A98", "F98"]) add("Report", cell);

  // The published P&L's prior-year column (B) and its own period end date,
  // which the report quotes alongside this year's figures. B14 is the prior
  // year's stock movement, the line OpenAccounts!E48 feeds.
  add("PubP&L", "B9");
  add("PubP&L", "B14");
  add("PubP&L", "B18");
  add("PubP&L", "B54");
  add("PubP&L", "E5");

  // The prior year block's own closing stock line, the one cell in it the
  // template fills with a formula rather than leaving for the reader.
  add("OpenAccounts", "E48");

  // Directors wages, which the emoluments note reads.
  add("TrialBalance", "EJ66");

  // The creditor rows the bank codes settle: EJ28 trade creditors, EJ32 the
  // CIS creditor ("RC"), EJ33 the VAT creditor ("RV"), EJ34 the PAYE creditor
  // ("RP") and EJ35 corporation tax ("RT"). EH35 is the tax credit the
  // template imputes on interest received, the one term of row 35 that comes
  // from neither the opening balance nor the bank.
  for (const cell of ["EJ28", "EJ32", "EJ33", "EJ34", "EJ35", "EH35"]) add("TrialBalance", cell);

  // PAYE/NI creditor -- row 34's first-month movement column. Column L
  // holds the fiscal year's first month regardless of year-end (verified
  // against the template: L34 = -(WagesInterface!D4+E4+H4)-(...director
  // row, always 0...)+(...statutory pay, always 0...)). The row's later
  // months also net HMRC bank payments (RP-coded), which is the bank
  // workstream's territory, not payroll's -- this one movement column
  // isolates the payroll-only contribution.
  add("TrialBalance", "L34");

  // WagesInterface -- one row per month in each of two blocks, Apr-Mar
  // template order, remapped to fiscalTabs the same as every other monthly
  // read here. C=gross pay, D=PAYE income tax, E=employee NI, H=employer NI.
  // Rows 4-15 are the employees' block and rows 17-28 the directors', and
  // the sheet splits the month tab between them: C4=[9]Apr!$M$1-C17 takes
  // the month's whole gross less the directors' sub-total, C17=[9]Apr!$M$2
  // takes that sub-total. Both blocks are read so the split itself is
  // measured, not just the total the P&L would still balance on.
  for (let row = WAGES_INTERFACE_EMPLOYEE_FIRST_ROW; row <= WAGES_INTERFACE_EMPLOYEE_FIRST_ROW + 11; row++) {
    for (const col of ["C", "D", "E", "H"]) add("WagesInterface", `${col}${row}`);
  }
  for (let row = WAGES_INTERFACE_DIRECTOR_FIRST_ROW; row <= WAGES_INTERFACE_DIRECTOR_FIRST_ROW + 11; row++) {
    for (const col of ["C", "D", "E", "H"]) add("WagesInterface", `${col}${row}`);
  }

  return reads;
}

// The Payslips month tabs, by the name this year end gives each one.
//
// Every tab carries the day its monthly payroll block opens on, which is the
// day the month the tab is named for begins. Nothing writes to that cell, so
// it is the tab's own calendar on a blank package and a populated one alike,
// and reading all twelve is what tells a tab dated from the payroll calendar
// apart from one dated from the accounting period.
//
// Template positions 3 and 4 (originally Jul/Aug) are read out in full as
// well (see PAYSLIPS_JUL_DEAD_CELLS and PAYSLIPS_AUG_BROUGHT_FORWARD_CELLS
// above), plus the rows the fixture actually populates, so a break in either
// area is caught on its own month instead of only through the Payment/Admin
// aggregates.
export function payslipsMonthTabReads(tabNames) {
  const reads = {};
  tabNames.forEach((tab, monthIndex) => {
    // The row-1 totals the PAYE schedule reads the tab through, so a schedule
    // row summing the wrong month fails against the tab it should have read
    // rather than only against the scenario.
    reads[tab] = [payslipsPeriodStartCell(monthIndex), ...Object.values(PAYE_SCHEDULE_MONTH_TAB_CELLS)];
  });
  reads[tabNames[PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[0]]].push(
    ...PAYSLIPS_JUL_DEAD_CELLS,
    ...payslipsMonthEntryCells(PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[0]),
  );
  reads[tabNames[PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[1]]].push(
    ...PAYSLIPS_AUG_BROUGHT_FORWARD_CELLS,
    ...payslipsMonthEntryCells(PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[1]),
  );
  return reads;
}

// Leaf-file reads for the VAT chain: each month tab's VAT (G1) and gross
// total (H1) from Sales.xlsx and Purchases.xlsx, plus every VATQtr box from
// Vatreturns.xlsx. Vatreturns links Sales, Purchases and Financialaccounts,
// so it recalculates after the hub.
export function multiFileOptions(yearEndMonth) {
  const tabNames = getMonthTabNames(yearEndMonth || 3);
  const salesMonthReads = {};
  const purchasesMonthReads = {};
  for (const tab of tabNames) {
    salesMonthReads[tab] = ["G1", VAT_RATE_CELL, ...Object.values(SALES_MONTH_TOTAL_CELLS)];
    purchasesMonthReads[tab] = ["G1", VAT_RATE_CELL, ...Object.values(PURCHASES_MONTH_TOTAL_CELLS)];
  }
  const vatQtrReads = {};
  for (let q = 1; q <= 5; q++) {
    vatQtrReads[`VATQtr${q}`] = ["G5", "G7", "G9", "G13", "G15", "G17", "G21", "G23"];
  }

  // The interface rows themselves, so a break in the VAT chain names the
  // period and the side it happened on instead of only showing up as a wrong
  // quarter total.
  const vatinterfaceCells = [];
  for (let row = VATINTERFACE_ROWS.first; row <= VATINTERFACE_ROWS.last; row++) {
    for (const col of ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "M"]) vatinterfaceCells.push(`${col}${row}`);
  }
  vatQtrReads.Vatinterface = vatinterfaceCells;

  // Fixedassets Schedule: row 1 holds the whole-schedule totals, rows 57 and
  // 110 the existing and new sub-totals, and each class's own totals row the
  // figures the published note quotes. Column B on a class totals row is the
  // sheet's own comparison against the opening balance sheet. Q/R carry the
  // annual investment and writing down allowances, Y/Z the balancing
  // allowance and charge a disposal throws off.
  const scheduleReads = ["E1", "F1", "G1", "I1", "J1", "K1", "Q1", "R1", "V1", "W1", "X1", "Y1", "Z1", "E57", "E110"];
  for (const layout of Object.values(SCHEDULE_ASSET_CLASSES)) {
    for (const totalRow of [layout.existingTotalRow, layout.newTotalRow]) {
      for (const col of ["E", "F", "I", "W", "X"]) scheduleReads.push(`${col}${totalRow}`);
    }
    scheduleReads.push(`B${layout.existingTotalRow}`);
    scheduleReads.push(layout.rateCell);
  }
  // Row 50 is the first "Motor Vehicles - Vans & Lorries" row, where a
  // scenario's only motor asset lands. O/V/R/S/Y/Z pin the disposal-year
  // WDA and balancing allowance split against the tax-data rate directly.
  for (const col of ["O", "V", "R", "S", "Y", "Z"]) scheduleReads.push(`${col}50`);

  // Each bank workbook's own reconciliation block on the final month tab:
  // A1 opening balance carried through the year, A2 closing balance.
  const bankReads = {};
  for (const fileName of Object.values(BANK_ACCOUNT_FILES)) {
    bankReads[fileName] = { [tabNames[11]]: ["A1", "A2"] };
  }

  // Payslips!Payment -- the PAYE remittance schedule, one row per tax month
  // from row 4. B is the tax month end and C the day the payment falls due,
  // both off the payroll calendar; D = NI due (employer + employee), E =
  // income tax due, I = total amount payable (verified against the template).
  const paymentCells = [];
  for (let taxMonth = 0; taxMonth < PAYE_SCHEDULE_MONTH_TABS.length; taxMonth++) {
    const row = PAYE_SCHEDULE_FIRST_ROW + taxMonth;
    for (const col of ["B", "C", "D", "E", "I"]) paymentCells.push(`${col}${row}`);
  }

  return {
    postHubRecalc: ["Vatreturns.xlsx"],
    additionalReads: {
      "Sales.xlsx": salesMonthReads,
      "Purchases.xlsx": purchasesMonthReads,
      "Vatreturns.xlsx": vatQtrReads,
      "Fixedassets.xlsx": {
        Schedule: [...new Set(scheduleReads)],
        // The sheet's own tie-out: E11/K11 re-sum the Schedule's rows,
        // E13/K13 read the ledgers' annual fixed asset totals across the
        // two leaf-to-leaf links, E15/K15 are the difference it prints.
        FAreconciliation: ["E11", "E13", "E15", "K11", "K13", "K15"],
        // E2 is the long-term-creditors total for the "New Hire Purchase
        // Agreements" block (SUM(E8:E26)); I/J/K on rows 8 and 10 are the
        // two scenario agreements' own monthly payment, capital and
        // interest split.
        HPfinance: ["E2", "I8", "J8", "K8", "I10", "J10", "K10"],
      },
      "Payslips.xlsx": {
        Payment: paymentCells,
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
        Admin: [
          ...new Set([
            PAYSLIPS_CALENDAR_ANCHOR_CELL,
            ...payrollMonthStarts().flatMap(({ row }) => ["A", "B", "C", "D", "F"].map((col) => `${col}${row}`)),
          ]),
        ],
        ...payslipsMonthTabReads(tabNames),
      },
      "Companysecretary.xlsx": {
        // One member a row: A the name, F the nominal value of a share, G the holding. F1 is the sheet's own
        // nominal-value formula (=F3) and G1 its shares-issued total
        // (=SUM(G3:G19)). The directors' report prints the first two members
        // a line each.
        "RegisterofMembers": [
          "F1",
          "G1",
          ...REGISTER_MEMBER_ROWS.flatMap((row) => [
            `${REGISTER_MEMBER_COLUMNS.name}${row}`,
            `${REGISTER_MEMBER_COLUMNS.nominalValue}${row}`,
            `${REGISTER_MEMBER_COLUMNS.shares}${row}`,
          ]),
        ],
        // F2 is the date the board met and E4 the dividend it declared. The
        // directors' report and the trial balance both read E4 across the
        // cross-file link.
        "Boardmeeting": ["F2", "E4"],
        // A registered charge and the directors' valuation of the asset
        // charged, which the balance sheet has to carry as a creditor
        // falling due after more than one year.
        "Charges&Debentures": CHARGE_REGISTER_ROWS.map((row) => `C${row}`),
        // One officer a row from row 2: A the name, B the address, C the date
        // of appointment, D the capacity they hold.
        "Directors&Secretary": DIRECTOR_SECRETARY_OFFICER_ROWS.flatMap((row) => [
          `${DIRECTOR_SECRETARY_COLUMNS.name}${row}`,
          `${DIRECTOR_SECRETARY_COLUMNS.address}${row}`,
          `${DIRECTOR_SECRETARY_COLUMNS.appointed}${row}`,
          `${DIRECTOR_SECRETARY_COLUMNS.capacity}${row}`,
        ]),
        // One director a row: A the name, B the address, C the date their own
        // shareholding was registered.
        "DirectorsInterests": DIRECTORS_INTERESTS_ROWS.flatMap((row) => [
          `${DIRECTORS_INTERESTS_COLUMNS.name}${row}`,
          `${DIRECTORS_INTERESTS_COLUMNS.address}${row}`,
          `${DIRECTORS_INTERESTS_COLUMNS.registered}${row}`,
        ]),
      },
      // The expenses claim form's mileage rate. Month 01 holds the literal
      // the generator writes and the other eleven chain from it, so reading
      // all twelve proves the write and the chain that carries it.
      "expensesform.xlsx": Object.fromEntries(EXPENSES_FORM_MONTHS.map((sheet) => [sheet, ["C30"]])),
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
      ...bankReads,
    },
  };
}
