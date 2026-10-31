// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import {
  PAYE_SCHEDULE_FIRST_ROW,
  PAYE_SCHEDULE_MONTH_TABS,
  PAYE_SCHEDULE_MONTH_TAB_CELLS,
  PAYSLIP_PRINT_CELLS,
  PAYSLIP_PRINT_PERIOD,
  PAYSLIP_PRINT_SHEET,
  monthlyPayrollBlockRow,
  payrollYearStart,
  payslipsMonthEntryRows,
  payslipsMonthPeriod,
  payslipsPeriodStartCell,
} from "../../../lib/payslips-layout.js";
import { periodShiftMonths, shiftMonths } from "../../../lib/period-shift.js";
import { PAYSLIPS_WEEKLY_ROWS, checkPayeSchedule } from "../../../lib/product-sheets/payslips.js";
import { excelSerialToUtcDate, formatSerialDate } from "../../../lib/product-sheets/serial-dates.js";
import { netOfVat } from "../../../lib/product-sheets/vat-rate.js";
import { parseDate } from "../../../lib/scenario-loader.js";
import { toExcelSerial } from "../../../lib/spreadsheet-runner.js";
import { PAYSLIPS_CALENDAR_ANCHOR_CELL, SHORT_MONTHS } from "../layout.js";
import {
  PL_DIRECTOR_WAGES_ROW,
  PL_EMPLOYEE_WAGES_ROW,
  WAGES_INTERFACE_DIRECTOR_FIRST_ROW,
  WAGES_INTERFACE_EMPLOYEE_FIRST_ROW,
} from "../reads.js";
import { payrollMonthStarts, payrollYearFromAccountingYearEnd } from "../writes.js";

export function checkPayroll(ctx) {
  const { check, checkText, expected, fiscalTabs, num, packageYearEnd, pl, rate, results, taxData, text } = ctx;

  // ── Payslips!Admin: the payroll calendar every payslip dates from ────────
  //
  // The calendar is written into the package and nothing reads it back, so a
  // wrong week or a month that opens on the wrong day would reach a user's
  // payslips unnoticed. Each payroll month's opening row is compared with the
  // tax calendar, anchored on the one date the whole sheet cascades from.
  const payslipsAdmin = results["Payslips.xlsx!Admin"];
  if (payslipsAdmin) {
    const yearStart = num(payslipsAdmin[PAYSLIPS_CALENDAR_ANCHOR_CELL]);
    checkText(
      "Payslips calendar: the payroll year opens on 6 April",
      yearStart ? formatSerialDate(yearStart) : "",
      (text) => text.startsWith("6 April"),
      "6 April",
    );

    // Column A is headed "Month Sheet" and is the printed payslip's join to a
    // month tab, so it names this package's own tabs in order rather than the
    // calendar months its dates fall in. On a March year end the two read the
    // same, which is why a June package printed a different month's payslip
    // with every figure on it self-consistent.
    const starts = payrollMonthStarts();
    for (const { month, row, daysBefore, week } of starts) {
      const tabName = fiscalTabs[month - 1];
      check(
        `Payslips calendar: payroll month ${month} opens on the first day of tax week ${week}`,
        num(payslipsAdmin[`B${row}`]),
        yearStart + daysBefore,
        0,
      );
      check(`Payslips calendar: payroll month ${month} opens tax week ${week}`, num(payslipsAdmin[`C${row}`]), week, 0);
      checkText(
        `Payslips calendar: payroll month ${month} names the ${tabName} tab`,
        String(payslipsAdmin[`A${row}`] ?? ""),
        (text) => text === tabName,
        tabName,
      );
    }
    check(
      "Payslips calendar: the payroll months are numbered one to twelve in order",
      starts.reduce((sum, { month, row }) => sum + Math.abs(num(payslipsAdmin[`D${row}`]) - month), 0),
      0,
      0,
    );
    check(
      "Payslips calendar: every payroll month opens on its own first week",
      starts.reduce((sum, { row }) => sum + num(payslipsAdmin[`F${row}`]), 0),
      starts.length,
      0,
    );
  }

  // ── Payslips!Payment: the dates on the PAYE remittance schedule ──────────
  //
  // Twelve rows, one per tax month, each with the month it covers and the day
  // the payment falls due. Both come off the payroll calendar at a fixed row,
  // so they are the payroll year's first day plus a fixed count of days --
  // measured here against the year the package's own tax data opens in, not
  // against the calendar the sheet built them from.
  //
  // A --data run's own extracted tax data carries no financial_year (it never
  // reads a tax-year TOML), so this falls back to the accounting period's own
  // year end the same way payrollYearOf() does in app/lib/calculators/ltd.js:
  // the year before the year end's calendar year, unless the year end falls
  // in January to March, when the payroll year already opened the April
  // before that year.
  const paymentSchedule = results["Payslips.xlsx!Payment"];
  const payrollYearOpens = taxData?.financial_year?.start
    ? payrollYearStart(new Date(taxData.financial_year.start).getUTCFullYear())
    : packageYearEnd
      ? payrollYearStart(payrollYearFromAccountingYearEnd(new Date(packageYearEnd)))
      : null;
  checkPayeSchedule({ check, num }, paymentSchedule, payrollYearOpens);

  // ── Payslips month tabs: the day each monthly payroll block opens ────────
  //
  // A month tab is named for its own month of the accounting period, and the
  // block on it opens with the day that month begins. The template dates
  // those blocks from the Payslips calendar, which runs the tax year, and on
  // a March year end the package's twelve months and the payroll year's are
  // the same twelve, so the two frames agree and neither can be told from the
  // other. Rename the tabs for another year end and a block still dated from
  // the payroll calendar shows one month's days under another month's name --
  // on the blank workbook a customer downloads, before any book is entered.
  //
  // The period start comes off the hub's own Admin sheet, so a block dated
  // from the wrong calendar cannot agree with it by construction.
  const periodStartSerial = num(results.Admin?.B9);
  if (periodStartSerial && payslipsAdmin) {
    const periodStart = excelSerialToUtcDate(periodStartSerial);
    const yearStart = excelSerialToUtcDate(num(payslipsAdmin[PAYSLIPS_CALENDAR_ANCHOR_CELL]));
    fiscalTabs.forEach((tab, monthIndex) => {
      const month = results[`Payslips.xlsx!${tab}`];
      if (!month) return;
      const cell = payslipsPeriodStartCell(monthIndex);
      const opens = payslipsMonthPeriod(periodStart, monthIndex, yearStart).first;
      check(
        `Payslips!${tab} ${cell} the monthly payroll opens in the accounting period's ${tab}`,
        num(month[cell]),
        toExcelSerial(opens.getUTCFullYear(), opens.getUTCMonth() + 1, opens.getUTCDate()),
        0,
      );
    });
  }

  if (expected.payroll) {
    // The same date-shift math cellWrites() uses to place each scenario
    // month's payroll on a Payslips.xlsx tab: monthKey's calendar month
    // (e.g. "apr" = 3) shifts by periodShiftMonths' offset, landing on the
    // same tab fiscalTabs already names by index. periodShiftMonths counts
    // years as well as months, so a year end more than twelve months out
    // from the scenario's own period shifts a full year further than a
    // month-only offset would -- the same gap cellWrites moves every
    // posting date by. The year end comes off the book's own Admin sheet,
    // the same as the board minute date shift above, rather than off
    // packageYearEnd: that argument names the year end the check should
    // measure the seed against, which is not always the year end the book
    // in hand was actually built for.
    const bookYearEnd = results.Admin?.F21 ? excelSerialToUtcDate(num(results.Admin.F21)) : null;
    const monthOffset = bookYearEnd ? periodShiftMonths(expected, bookYearEnd.getUTCFullYear() - 1, bookYearEnd.getUTCMonth() + 1) : 0;
    const payrollByTab = Object.fromEntries(fiscalTabs.map((tab) => [tab, []]));
    for (const [monthKey, entries] of Object.entries(expected.payroll)) {
      const sourceMonth = SHORT_MONTHS.findIndex((m) => m.toLowerCase() === monthKey);
      if (sourceMonth === -1) continue;
      const tab = SHORT_MONTHS[(((sourceMonth + monthOffset) % 12) + 12) % 12];
      payrollByTab[tab].push(...entries);
    }

    // A month tab gives an employee their line by position: the first entry
    // in the month's block belongs to the first employee on the Employee
    // sheet, and the directors sub-total the sheet works out for itself picks
    // up the rows whose employee is marked a director. The checks follow the
    // same rule, so a director's pay landing in the employees' block fails
    // here rather than netting out in the P&L.
    const sumPayroll = (entries) =>
      entries.reduce(
        (s, e) => ({
          grossPay: s.grossPay + (e.grossPay || 0),
          incomeTax: s.incomeTax + (e.incomeTax || 0),
          employeeNI: s.employeeNI + (e.employeeNI || 0),
          employerNI: s.employerNI + (e.employerNI || 0),
        }),
        { grossPay: 0, incomeTax: 0, employeeNI: 0, employerNI: 0 },
      );
    const employeeList = expected.employees || [];
    const isDirectorsLine = (index) => Boolean(employeeList[index]?.isDirector);

    let totalEmployeeGross = 0;
    let totalDirectorGross = 0;
    let totalEmployerNI = 0;
    fiscalTabs.forEach((tab, i) => {
      const entries = payrollByTab[tab] || [];
      const employeeSums = sumPayroll(entries.filter((entry, index) => !isDirectorsLine(index)));
      const directorSums = sumPayroll(entries.filter((entry, index) => isDirectorsLine(index)));
      totalEmployeeGross += employeeSums.grossPay;
      totalDirectorGross += directorSums.grossPay;
      totalEmployerNI += employeeSums.employerNI + directorSums.employerNI;

      const wi = results.WagesInterface || {};
      const checkWagesInterfaceRow = (row, block, sums) => {
        check(`WagesInterface ${block} ${tab} C${row} gross pay`, num(wi[`C${row}`]), sums.grossPay);
        check(`WagesInterface ${block} ${tab} D${row} income tax`, num(wi[`D${row}`]), sums.incomeTax);
        check(`WagesInterface ${block} ${tab} E${row} employee NI`, num(wi[`E${row}`]), sums.employeeNI);
        check(`WagesInterface ${block} ${tab} H${row} employer NI`, num(wi[`H${row}`]), sums.employerNI);
      };
      checkWagesInterfaceRow(WAGES_INTERFACE_EMPLOYEE_FIRST_ROW + i, "employees", employeeSums);
      checkWagesInterfaceRow(WAGES_INTERFACE_DIRECTOR_FIRST_ROW + i, "directors", directorSums);

      // Payslips!Payment: the tax month a tab's payroll is paid in, which is
      // the month the tab is named for -- row 4 is April on every package,
      // whatever the year end, because the tax calendar does not move with
      // the accounting period. The row reads the tab's own whole-month totals
      // rather than either side of the split: what the company owes HMRC does
      // not care who was a director. D = NI due (employer + employee), E =
      // income tax due, I = total amount payable = D + E (F/G/H -- statutory
      // pay recovered, NIC compensation, student loan -- stay 0 here).
      const payment = results["Payslips.xlsx!Payment"] || {};
      const row = PAYE_SCHEDULE_FIRST_ROW + PAYE_SCHEDULE_MONTH_TABS.indexOf(tab);
      const monthSums = sumPayroll(entries);
      const niDue = monthSums.employerNI + monthSums.employeeNI;
      check(`Payslips!Payment ${tab} D${row} NI due`, num(payment[`D${row}`]), niDue);
      check(`Payslips!Payment ${tab} E${row} income tax due`, num(payment[`E${row}`]), monthSums.incomeTax);
      check(`Payslips!Payment ${tab} I${row} total amount payable`, num(payment[`I${row}`]), niDue + monthSums.incomeTax);

      // The same figures read off the tab the row is supposed to be reading.
      // The fixture pays several months alike, so a row that has slipped onto
      // a neighbouring tab can still match the scenario; it cannot match both
      // the scenario and the tab it names.
      const monthTab = results[`Payslips.xlsx!${tab}`];
      if (monthTab) {
        const cells = PAYE_SCHEDULE_MONTH_TAB_CELLS;
        check(
          `Payslips!Payment D${row} NI due is the ${tab} tab's own`,
          num(payment[`D${row}`]),
          num(monthTab[cells.employerNI]) + num(monthTab[cells.employeeNI]),
        );
        check(`Payslips!Payment E${row} income tax due is the ${tab} tab's own`, num(payment[`E${row}`]), num(monthTab[cells.incomeTax]));
        check(
          `Payslips!Payment I${row} total payable is the ${tab} tab's own`,
          num(payment[`I${row}`]),
          num(monthTab[cells.employerNI]) +
            num(monthTab[cells.employeeNI]) +
            num(monthTab[cells.incomeTax]) +
            num(monthTab[cells.studentLoan]),
        );
      }
    });

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
      const printedTab = fiscalTabs[PAYSLIP_PRINT_PERIOD - 1];
      const printedEntries = payrollByTab[printedTab] || [];
      checkText(
        `Payslips print: the page reads the ${printedTab} tab`,
        text(printed[PAYSLIP_PRINT_CELLS.tab]),
        (name) => name === printedTab,
        printedTab,
      );
      checkText(
        "Payslips print: the block the page reads is a monthly payroll",
        text(printed.L7),
        (heading) => heading === "MONTHLY PAYROLL",
        "MONTHLY PAYROLL",
      );
      check(`Payslips print: the period printed is payroll month ${PAYSLIP_PRINT_PERIOD}`, num(printed.I10), PAYSLIP_PRINT_PERIOD, 0);
      if (printedEntries.length > 0) {
        const paidOn = shiftMonths(parseDate(printedEntries[0].date), monthOffset);
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
        // over the months printed so far -- the first entry of each tab up to
        // and including the one on the page.
        const toDate = fiscalTabs.slice(0, PAYSLIP_PRINT_PERIOD).flatMap((tab) => (payrollByTab[tab] || []).slice(0, 1));
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

    // ── Payslips template positions 3/4 (Jul/Aug): direct reads against the
    // scenario's own payroll entries for that month ──
    //
    // Payment/Admin never read a month tab directly (see
    // PAYSLIPS_JUL_DEAD_CELLS above), so nothing distinguished one month's
    // payroll figures from another's. A fixture that repeats the same
    // employees' gross pay, tax and NI every month would pass a check
    // anchored only on those numbers with two months' data swapped; the
    // reference column and the wages-paid date both embed the month, so
    // anchoring on them catches a neighbouring-month mix-up the totals
    // cannot.
    const checkMonthPayrollEntries = (monthIndex, entries) => {
      const tab = fiscalTabs[monthIndex];
      const month = results[`Payslips.xlsx!${tab}`];
      if (!month) return;
      const entryRows = payslipsMonthEntryRows(monthIndex);
      entries.slice(0, 5).forEach((e, idx) => {
        const row = entryRows[idx];
        if (e.name) checkText(`Payslips!${tab} F${row} employee name`, text(month[`F${row}`]), (v) => v === e.name, e.name);
        check(`Payslips!${tab} M${row} gross pay`, num(month[`M${row}`]), e.grossPay || 0);
        check(`Payslips!${tab} N${row} income tax`, num(month[`N${row}`]), e.incomeTax || 0);
        check(`Payslips!${tab} O${row} employee NI`, num(month[`O${row}`]), e.employeeNI || 0);
        check(`Payslips!${tab} R${row} net pay`, num(month[`R${row}`]), e.netPay || 0);
        check(`Payslips!${tab} T${row} employer NI`, num(month[`T${row}`]), e.employerNI || 0);
        if (e.reference) checkText(`Payslips!${tab} S${row} reference`, text(month[`S${row}`]), (v) => v === e.reference, e.reference);
      });
      if (entries.length > 0) {
        const d = shiftMonths(parseDate(entries[0].date), monthOffset);
        const dateCell = `M${monthlyPayrollBlockRow(monthIndex) + 1}`;
        check(
          `Payslips!${tab} ${dateCell} wages paid date`,
          num(month[dateCell]),
          toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
          0,
        );
      }
    };
    checkMonthPayrollEntries(3, payrollByTab[fiscalTabs[3]] || []);
    checkMonthPayrollEntries(4, payrollByTab[fiscalTabs[4]] || []);

    // ── Payslips template position 3 (Jul): the weekly-block employee-line
    // pull (rows 11-15) and the period-4 total (T41), the exact cells fixed
    // at rows 11-15's F column and T41 ──
    //
    // Every fixture's employees pay monthly, so each row's own
    // IF(Employee!D$28="m",...) weekly gate never reads true: F11:F15 stay
    // blank regardless of what the row's own date-comparison branch (the
    // one the #REF! sat in) resolves to, and T41 -- the period's own
    // employer-NI total -- stays nil alongside it.
    // The sheet's own blank is a single space (" "); the text() helper
    // above trims every string it reads, so a blank cell reaches this
    // check as "".
    const julPosition = results[`Payslips.xlsx!${fiscalTabs[3]}`];
    if (julPosition) {
      for (const row of PAYSLIPS_WEEKLY_ROWS) {
        checkText(
          `Payslips!${fiscalTabs[3]} F${row} weekly employee line (every employee here pays monthly)`,
          text(julPosition[`F${row}`]),
          (v) => v === "",
          "",
        );
      }
      check(`Payslips!${fiscalTabs[3]} T41 period total (no weekly employer NI to bring forward)`, num(julPosition.T41), 0, 0);
    }

    // ── Payslips template position 4 (Aug): the brought-forward reads at
    // rows 11-15 (H/I/J/L/M, plus K on rows 12-15), the 29 cells fixed at
    // Aug!H11:M15 ──
    //
    // T$9 (the flag that carries an unfinished weekly pay cycle into the
    // next month) is never set by any scenario, so every one of these
    // cells resolves to its "not carried forward" branch -- 0, or blank for
    // the M-column payslip total -- regardless of what the previous
    // month's row 41 itself holds.
    const augPosition = results[`Payslips.xlsx!${fiscalTabs[4]}`];
    if (augPosition) {
      for (const row of PAYSLIPS_WEEKLY_ROWS) {
        for (const col of ["H", "I", "J", "L"]) {
          check(
            `Payslips!${fiscalTabs[4]} ${col}${row} brought forward (no weekly cycle carried over)`,
            num(augPosition[`${col}${row}`]),
            0,
            0,
          );
        }
        if (row >= 12) {
          check(`Payslips!${fiscalTabs[4]} K${row} brought forward (no weekly cycle carried over)`, num(augPosition[`K${row}`]), 0, 0);
        }
        checkText(
          `Payslips!${fiscalTabs[4]} M${row} brought forward (no weekly cycle carried over)`,
          text(augPosition[`M${row}`]),
          (v) => v === "",
          "",
        );
      }
    }

    // P&L route: the payroll reaches the statement on two lines, and the
    // split between them is the whole point of the directors block. MnthP&L
    // B18 (PAYE Wages + Non-PAYE Employee) reads TrialBalance!O64+O65, where
    // row 64 is the WagesInterface employees block's C-I summed across the
    // year (I -- statutory pay -- is always 0 here) and row 65 is
    // Purchases.xlsx's own "w"-coded net total, which this fixture does carry
    // a casual-worker entry for. B19 (Directors Wages) reads
    // TrialBalance!O66, the directors block's C-I plus the "d"-coded
    // purchases net. B20 (Employers NI) reads TrialBalance!O67 = both blocks'
    // H summed across the year. Verified against the template formula chain.
    const purchasesNetForCode = (code) => {
      let total = 0;
      for (const transactions of Object.values(expected.purchases || {})) {
        for (const tx of transactions) if (tx.code === code) total += netOfVat(tx.amount, rate);
      }
      return total;
    };
    check(
      `MnthP&L: PAYE Wages + Non-PAYE Employee (B${PL_EMPLOYEE_WAGES_ROW}) = employees' gross pay + Purchases w-coded net`,
      num(pl[`B${PL_EMPLOYEE_WAGES_ROW}`]),
      totalEmployeeGross + purchasesNetForCode("w"),
    );
    check(
      `MnthP&L: Directors Wages (B${PL_DIRECTOR_WAGES_ROW}) = directors' gross pay + Purchases d-coded net`,
      num(pl[`B${PL_DIRECTOR_WAGES_ROW}`]),
      totalDirectorGross + purchasesNetForCode("d"),
    );
    check("MnthP&L: Employers National Insurance (B20) = payroll employer NI", num(pl.B20), totalEmployerNI);

    // PAYE/NI creditor: TrialBalance row 34's first-fiscal-month movement
    // column (verified against the template: column position L, always the
    // year's first month regardless of year-end) moves by
    // -(WagesInterface!D+E+H) that month -- income tax, employee NI and
    // employer NI due to HMRC. Later months' movement also nets HMRC bank
    // payments (RP-coded), which belongs to the bank workstream, so this
    // localises to the payroll-only first month rather than the year-end
    // balance.
    if (results.TrialBalance && fiscalTabs.length > 0) {
      const firstMonthEntries = payrollByTab[fiscalTabs[0]] || [];
      const firstMonthTax = firstMonthEntries.reduce((s, e) => s + (e.incomeTax || 0) + (e.employeeNI || 0) + (e.employerNI || 0), 0);
      check(
        "Trial Balance: PAYE/NI creditor first-month movement (L34) = that month's payroll tax due",
        num(results.TrialBalance.L34),
        -firstMonthTax,
      );
    }
  }
}
