// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { payrollYearStart } from "../../../lib/payslips-layout.js";
import { checkPayeSchedule } from "../../../lib/product-sheets/payslips.js";
import { excelSerialToUtcDate } from "../../../lib/product-sheets/serial-dates.js";
import { toExcelSerial } from "../../../lib/spreadsheet-runner.js";
import { PAYROLL_CALENDAR_SAMPLE_ROWS, SHORT_MONTH_NAMES } from "../reads.js";

export function checkAdmin(ctx) {
  const { check, checkText, num, results, taxData } = ctx;

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
    check("Admin: NI Class 2 Small Profits Threshold = tax data", admin.N16, ni.class2_small_profits_threshold);
    check("Admin: NI Class 4 Lower Rate = tax data", admin.L20, ni.class4_lower_rate, 0.0001);
    check("Admin: NI Class 4 Lower Limit = tax data", admin.N20, ni.class4_lower_limit);
    check("Admin: NI Class 4 Upper Rate = tax data", admin.L23, ni.class4_upper_rate, 0.0001);
    check("Admin: NI Class 4 Upper Limit = tax data", admin.N23, ni.class4_upper_limit);
    check("Admin: AIA Rate = tax data", admin.G4, ca.annual_investment_allowance, 0.0001);
    check("Admin: WDA Rate = tax data", admin.G5, ca.writing_down_allowance, 0.0001);
    check("Admin: special rate WDA = tax data", admin.G6, ca.writing_down_allowance_special, 0.0001);
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
  checkPayeSchedule({ check, num }, paymentSchedule, payrollYearOpens);
}
