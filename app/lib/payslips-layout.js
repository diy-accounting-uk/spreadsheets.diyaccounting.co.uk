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
 * The cell a month tab's monthly payroll block opens its period in, on the
 * same row as the wages-paid date that closes it. Nothing writes to it, so it
 * is the tab's own calendar whether the package carries a book or not.
 * @param {number} monthIndex - 0-11
 * @returns {string}
 */
export const payslipsPeriodStartCell = (monthIndex) => `K${monthlyPayrollBlockRow(monthIndex) + 1}`;

/**
 * The days a month tab's monthly payroll block covers: the tab's own month of
 * the accounting period, index 0 being the month the period opens in. A March
 * year end runs its accounts over the same twelve months as its payroll, and
 * its first block opens with the payroll year on 6 April rather than on the
 * 1st.
 * @param {Date} periodStart - the accounting period's first day
 * @param {number} monthIndex - 0-11
 * @param {Date} payrollYearStart - payrollYearStart() for this package
 * @returns {{first: Date, last: Date}}
 */
export function payslipsMonthPeriod(periodStart, monthIndex, payrollYearStart) {
  const months = periodStart.getUTCFullYear() * 12 + periodStart.getUTCMonth() + monthIndex;
  const first = new Date(Date.UTC(Math.floor(months / 12), months % 12, 1));
  const last = new Date(Date.UTC(Math.floor(months / 12), (months % 12) + 1, 0));
  const opensWithPayrollYear =
    monthIndex === 0 &&
    payrollYearStart.getUTCFullYear() === first.getUTCFullYear() &&
    payrollYearStart.getUTCMonth() === first.getUTCMonth();
  return { first: opensWithPayrollYear ? payrollYearStart : first, last };
}

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

// The Employee sheet keeps one employee per 26-row block, and the start date
// sits eleven rows down each block. The month tab reads it back as a payroll
// month number and prints nothing for an employee whose month has not
// arrived, so the whole printed page hangs off this one cell.
export const PAYSLIPS_EMPLOYEE_BASE_ROWS = [13, 39, 65, 91, 117];
export const PAYSLIPS_EMPLOYEE_START_DATE_OFFSET = 11;

/**
 * The first day of the payroll year the package's Payslips calendar runs on.
 * The workbook follows the tax year rather than the accounting period, so a
 * company with a June year end still dates its payslips from 6 April.
 * @param {number} financialYear - the year the package's tax data opens in
 * @returns {Date}
 */
export const payrollYearStart = (financialYear) => new Date(Date.UTC(financialYear, 3, 6));

/**
 * The start date to put on the Employee sheet. The sheet finds an employee's
 * first payroll month by looking the date up on its own calendar, and the
 * calendar only covers the payroll year, so a date outside it has no month to
 * find. Anyone who was already being paid when the book's payroll record
 * opens gets the payroll year's first day, which is what the sheet's own
 * caption tells the employer to enter for an existing employee; anyone who
 * joined after that keeps their own day, and still never a day before the
 * calendar opens.
 * @param {Date} joined - the day the employee started, in the book's own frame
 * @param {Date} booksOpened - the earliest payroll the book records, or null
 * @param {Date} onSheet - `joined` shifted into the package's frame
 * @param {Date} yearStart - payrollYearStart() for this package
 * @returns {Date}
 */
export const payslipsStartDate = (joined, booksOpened, onSheet, yearStart) =>
  (booksOpened && joined < booksOpened) || onSheet < yearStart ? yearStart : onSheet;

/**
 * The earliest day the scenario's payroll records a payslip on, which is when
 * the book's own payroll record opens.
 * @param {Object} payroll - scenario.payroll, month key to entries
 * @param {(value: string) => Date} parse
 * @returns {Date|null}
 */
export function payrollRecordOpened(payroll, parse) {
  let earliest = null;
  for (const entries of Object.values(payroll || {})) {
    for (const entry of entries) {
      if (!entry.date) continue;
      const day = parse(entry.date);
      if (!earliest || day < earliest) earliest = day;
    }
  }
  return earliest;
}

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

// The payroll number the writer gives the first employee, which is the number
// the page's own join adds to the block row to reach their line. The page
// prints the first employee's payslip, so this is the gate every figure below
// the heading passes through.
export const PAYSLIP_PRINT_FIRST_PAYROLL_NUMBER = 1;

// The printed figures for the period, and the same four accumulated from the
// payroll year's first month, each keyed by the payslip field it carries.
export const PAYSLIP_PRINT_PERIOD_CELLS = { G14: "grossPay", H14: "incomeTax", I14: "employeeNI", M14: "netPay" };
export const PAYSLIP_PRINT_TO_DATE_CELLS = { G16: "grossPay", H16: "incomeTax", I16: "employeeNI", M16: "netPay" };

// The page's payment date reads column R of the block's own header row, where
// the template holds nothing; the date the wages were paid sits a row below
// in column M, which is where the period-end cell finds it. So the page
// prints a nil there whatever the month held.
export const PAYSLIP_PRINT_EMPTY_PAYMENT_DATE = 0;

// Nothing downstream reads the printed page, so the reconciliation asks it
// for a period other than the sheet's own default of 1 -- a join stuck on the
// default prints the wrong period with every other check still green.
export const PAYSLIP_PRINT_PERIOD = 2;
