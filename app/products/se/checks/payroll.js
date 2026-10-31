// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import {
  PAYE_SCHEDULE_MONTH_TAB_CELLS,
  PAYSLIP_PRINT_CELLS,
  PAYSLIP_PRINT_PERIOD,
  PAYSLIP_PRINT_SHEET,
  monthlyPayrollBlockRow,
  payslipsMonthEntryRows,
} from "../../../lib/payslips-layout.js";
import { PAYSLIPS_WEEKLY_ROWS } from "../../../lib/product-sheets/payslips.js";
import { MONTH_SHEETS, parseDate } from "../../../lib/scenario-loader.js";
import { toExcelSerial } from "../../../lib/spreadsheet-runner.js";
import { MONTH_KEYS } from "../layout.js";
import { WAGES_MONTH_ROWS } from "../reads.js";

export function checkPayroll(ctx) {
  const { blank, check, checkText, expected, num, pl, rate, results, shiftDate } = ctx;

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
        const paidOn = shiftDate(parseDate(printedEntries[0].date));
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
        const d = shiftDate(parseDate(entries[0].date));
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
}
