// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// payslips-layout.js — where a month tab's monthly payroll block sits on
// Payslips.xlsx, and the cells the printed payslip joins through. One rule in
// one module, because the writers that fill the block, the JS engine that
// recomputes it and the exporter that reads it back all have to agree on the
// row. Separate copies drifted once and the export silently lost every month
// the copies disagreed on.

// The payroll months take four, four and five weeks a quarter, with a sixth
// week on the last. The tax calendar fixes this, so it is the same array
// whatever the package's year end.
export const PAYROLL_WEEKS_PER_MONTH = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 6];

/**
 * The row a month tab's monthly payroll block starts on. The tab stacks one
 * ten-row block per tax week from row 8, then the monthly block below them,
 * so the start follows the weeks that month holds. The layout belongs to the
 * sheet, so it is indexed by the month's place in the package's own year --
 * index 0 is the first month tab, whatever month that tab is named.
 * @param {number} monthIndex - 0-11
 * @returns {number}
 */
export const monthlyPayrollBlockRow = (monthIndex) => 8 + 10 * PAYROLL_WEEKS_PER_MONTH[monthIndex];

/**
 * The cell holding the date the month's wages were paid, one row below the
 * block start. It is the only date a month tab carries.
 * @param {number} monthIndex - 0-11
 * @returns {string}
 */
export const payslipsWagesPaidCell = (monthIndex) => `M${monthlyPayrollBlockRow(monthIndex) + 1}`;

/**
 * The five employee rows of a month's monthly block, from block row + 3.
 * @param {number} monthIndex - 0-11
 * @returns {number[]}
 */
export const payslipsMonthEntryRows = (monthIndex) => [0, 1, 2, 3, 4].map((i) => monthlyPayrollBlockRow(monthIndex) + 3 + i);

// The columns one employee's payslip row carries: F the name, M gross pay, N
// income tax, O employee NI, R net pay, S the payslip's own reference (a
// blank spacer in the template that no formula reads) and T employer NI, the
// entry cell the block's own total row sums.
export const PAYSLIPS_ENTRY_COLUMNS = {
  name: "F",
  grossPay: "M",
  incomeTax: "N",
  employeeNI: "O",
  netPay: "R",
  reference: "S",
  employerNI: "T",
};

// The columns the template ships as a literal zero on every row of a monthly
// block, filled or not. An unused row keeps them, so both engines carry a nil
// there and neither carries anything in the other four columns.
export const PAYSLIPS_ZERO_FILLED_COLUMNS = [
  PAYSLIPS_ENTRY_COLUMNS.incomeTax,
  PAYSLIPS_ENTRY_COLUMNS.employeeNI,
  PAYSLIPS_ENTRY_COLUMNS.employerNI,
];

// The two template positions the reconciliation reads a month tab at
// directly, by the month's place in the package's year. Both shipped with
// dead #REF! cells the Payment and Admin aggregates never touch, so each is
// read on its own month rather than only through a total. Both engines follow
// this list, so a month tab reaches R from one side only if it reaches R from
// the other.
export const PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES = [3, 4];

// The Payslips sheet is the page an employer prints and hands over. F3 picks
// weekly or monthly payslips and F4 the period; H3 and H4 turn that pair into
// a month tab name and a block start row, and every printed figure is an
// INDIRECT through them.
export const PAYSLIP_PRINT_SHEET = "Payslips";
export const PAYSLIP_PRINT_CELLS = {
  frequency: "F3",
  period: "F4",
  tab: "H3",
  blockRow: "H4",
  heading: "L7",
  periodEnd: "I9",
  periodNumber: "I10",
};
export const PAYSLIP_PRINT_MONTHLY_HEADING = "MONTHLY PAYROLL";

// Nothing downstream reads the printed page, so the reconciliation asks it
// for a period other than the sheet's own default of 1 -- a join stuck on the
// default prints the wrong period with every other check still green.
export const PAYSLIP_PRINT_PERIOD = 2;
