// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { toExcelSerial } from "../spreadsheet-runner.js";
import { parseDate } from "../scenario-loader.js";
import {
  PAYE_DUE_DAY,
  PAYE_SCHEDULE_FIRST_ROW,
  PAYE_SCHEDULE_MONTH_TABS,
  PAYSLIPS_EMPLOYEE_BASE_ROWS,
  PAYSLIPS_EMPLOYEE_START_DATE_OFFSET,
  PAYSLIPS_ENTRY_COLUMNS,
  payeTaxMonthDates,
  payslipsMonthEntryRows,
  payslipsStartDate,
  payslipsWagesPaidCell,
} from "../payslips-layout.js";

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
export const PAYSLIPS_WEEKLY_ROWS = [11, 12, 13, 14, 15];
export const PAYSLIPS_JUL_DEAD_CELLS = [...PAYSLIPS_WEEKLY_ROWS.map((row) => `F${row}`), "T41"];
export const PAYSLIPS_AUG_BROUGHT_FORWARD_CELLS = PAYSLIPS_WEEKLY_ROWS.flatMap((row) => {
  const cells = ["H", "I", "J", "L", "M"].map((col) => `${col}${row}`);
  if (row >= 12) cells.push(`K${row}`);
  return cells;
});

// The cells Payslips.xlsx cellWrites populates for a month's payroll, one
// employee a row down the month's own monthly block, plus the wages-paid date
// the block is dated from.
export const payslipsMonthEntryCells = (monthIndex) => [
  payslipsWagesPaidCell(monthIndex),
  ...payslipsMonthEntryRows(monthIndex).flatMap((row) => Object.values(PAYSLIPS_ENTRY_COLUMNS).map((col) => `${col}${row}`)),
];

// The Employee sheet of Payslips.xlsx: the business details and up to five
// employee blocks. payrollStart is the payroll year the package's calendar runs
// on, payrollOpened the date the payroll record opened.
export function writePayslipsEmployee(scenario, { payrollStart, payrollOpened, shiftDate }) {
  // Employee blocks start at rows 13, 39, 65, 91, 117 (26-row intervals)
  const EMP_BASE_ROWS = PAYSLIPS_EMPLOYEE_BASE_ROWS;
  const emp = {};

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
      const onSheet = payslipsStartDate(joined, payrollOpened, shiftDate(joined), payrollStart);
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
  return emp;
}

// The PAYE remittance schedule: one row per tax month, each with the month it
// ends and the day the payment falls due.
export function checkPayeSchedule({ check, num }, paymentSchedule, payrollYearOpens) {
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
}
