// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { toExcelSerial } from "../../../lib/spreadsheet-runner.js";
import { apportionCorporationTax, financialYearRatesFor } from "../../../lib/tax/corporation-tax.js";
import { TAX_SHEET } from "../cell-map.js";
import { OPENACCOUNTS_FRANKED_INVESTMENT_INCOME_CELL } from "../layout.js";
import {
  ADMIN_FINANCIAL_YEAR_ROWS,
  ADMIN_RATE_COLUMNS,
  ADMIN_TAX_DATA_CELLS,
  ENTERTAINMENT_CODE,
  EXPENSES_FORM_MONTHS,
  NOTE_RATE_CELLS,
} from "../reads.js";
import { journalTotalsByCode } from "../report.js";

export function checkAdminFiling(ctx) {
  const { check, expected, notes, num, packageYearEnd, pl, pubBalSht, rate, results, schedule, taxData } = ctx;

  // ── Admin: the rates the generator injected, read back ───────────────────
  //
  // Every downstream figure is arithmetically consistent with whatever rate
  // sits here, so a wrong rate is invisible everywhere else. These compare
  // the sheet against the tax-year TOML the package was generated from.
  const admin = results.Admin;
  if (admin && taxData) {
    for (const [cell, label, fromTaxData] of ADMIN_TAX_DATA_CELLS) {
      check(`Admin ${cell}: ${label}`, num(admin[cell]), fromTaxData(taxData), 0.0001);
    }

    // The associated companies count is a business fact, not a tax-year
    // one, so it is not in ADMIN_TAX_DATA_CELLS -- it comes from the
    // scenario's own business block, defaulting to none.
    check("Admin P14: number of associated companies", num(admin.P14), expected.business?.associated_companies ?? 0, 0);

    // The exempt distributions received are a business fact too, entered on
    // the opening accounts beside the loss brought forward.
    check(
      "Opening accounts: franked investment income = the distributions the scenario received",
      num(results.OpenAccounts?.[OPENACCOUNTS_FRANKED_INVESTMENT_INCOME_CELL]),
      expected.business?.franked_investment_income ?? 0,
    );

    // F21 is the year-end seed every other date in the package cascades
    // from. Its own anchor row and the three published documents that quote
    // the year end all have to land on it. The seed itself is measured
    // against the year end the package was generated for, so a book dated to
    // the wrong year end fails here rather than reading consistent with
    // itself.
    if (packageYearEnd) {
      const [year, month, day] = packageYearEnd.split("-").map(Number);
      check("Admin: year-end seed = the package's own year end", num(admin.F21), toExcelSerial(year, month, day), 0);
    }
    check("Admin: year-end seed drives the accounting period anchor", num(admin.B32), num(admin.F21), 0);
    check("Published P&L: year end = Admin year-end seed", num(results["PubP&L"]?.D3), num(admin.F21), 0);
    check("Published balance sheet: date = Admin year-end seed", num(pubBalSht?.D2), num(admin.F21), 0);
    check("Fixed asset note: year end = Admin year-end seed", num(notes?.A11), num(admin.F21), 0);
    check("Admin: accounting period is twelve months", num(admin.F21) - num(admin.B9) + 1, 365, 1);

    // The Admin rate table's two dated rows are the financial years the
    // accounting period falls in, not the period and the year after it.
    // Everything the corporation tax working sheet and the CT600 say about
    // the period is a copy of these four dates.
    check("Admin: first financial year row starts at the accounting period start", num(admin.L6), num(admin.B9), 0);
    check("Admin: second financial year row starts the day the first one ends", num(admin.L7), num(admin.N6) + 1, 0);
    check("Admin: second financial year row ends at the year end", num(admin.N7), num(admin.F21), 0);
    if (results[TAX_SHEET]) {
      check("CT: working sheet heading starts at the accounting period start", num(results[TAX_SHEET].E5), num(admin.B9), 0);
      check("CT: working sheet heading ends at the year end", num(results[TAX_SHEET].H5), num(admin.F21), 0);
      check("CT: the two tax rows span the accounting period", num(results[TAX_SHEET].A35), num(admin.F21) - num(admin.B9) + 1, 0);
    }
    if (results.CT600) {
      check("CT600: return period starts at the accounting period start", num(results.CT600.B33), num(admin.B9), 0);
      check("CT600: return period ends at the year end", num(results.CT600.M33), num(admin.F21), 0);
    }

    // The expenses claim form carries the same mileage rate the Admin sheet
    // holds. It has no link back to the accounts, so the generator writes
    // the first month and the other eleven read it off that one.
    for (const sheet of EXPENSES_FORM_MONTHS) {
      const form = results[`expensesform.xlsx!${sheet}`];
      if (form) check(`Expenses form ${sheet}: mileage rate = tax data`, num(form.C30), taxData.mileage.higher_rate_pence, 0.0001);
    }

    // The note publishes the depreciation rates from the Schedule, which
    // must agree with the rates injected into Admin.
    if (notes) {
      for (const [noteCell, adminCell, label] of NOTE_RATE_CELLS) {
        check(`Fixed asset note: depreciation rate, ${label}`, num(notes[noteCell]), num(admin[adminCell]), 0.0001);
      }
    }
  }

  // ── The filed documents against the working sheets they derive from ──────
  const corporationTax = results[TAX_SHEET];
  const pubPL = results["PubP&L"];
  if (corporationTax && pubPL) {
    // The published P&L and the management P&L reach operating profit down
    // different formula paths, one from the trial balance's closing column
    // and one from its month-by-month columns.
    check("Published P&L: operating profit = management P&L operating profit", num(pubPL.F46), num(pl.B43));
    check("CT: operating profit = published P&L operating profit", num(corporationTax.K5), num(pubPL.F46));
    check("CT: depreciation add-back = P&L depreciation", num(corporationTax.I8), num(pl.B40));
    check("CT: goodwill add-back = P&L goodwill written off", num(corporationTax.I7), num(pl.B38));
    // The entertainment add-back is anchored in the journal, not in another
    // cell of the sheet: the trial balance row it reads is the only place the
    // figure exists on the hub, so the scenario's own "e"-coded purchases are
    // what prove it. Its trial balance row is checked against the same anchor.
    if (expected.purchases) {
      const entertainmentNet = journalTotalsByCode(expected.purchases, rate, "g").net[ENTERTAINMENT_CODE] || 0;
      check('CT: entertainment add-back = Purchases.xlsx "e" net', num(corporationTax.I9), entertainmentNet);
      if (results.TrialBalance) {
        check('Trial balance: business entertainment = Purchases.xlsx "e" net', num(results.TrialBalance.EJ90), entertainmentNet);
      }
    }
    check(
      "CT: add-backs = depreciation + goodwill + entertainment",
      num(corporationTax.K10),
      num(corporationTax.I7) + num(corporationTax.I8) + num(corporationTax.I9),
    );
    check("CT: profit plus add-backs", num(corporationTax.K12), num(corporationTax.K5) + num(corporationTax.K10));
    // Each allowance line against the schedule column it claims from. The
    // notes behind these lines address Schedule rows one by one, so they
    // only carry figures when every one of those rows reaches the tax
    // computation, and each line is anchored in the schedule rather than in
    // its own total.
    if (schedule) {
      check("CT: annual investment allowance = Schedule annual investment allowance", num(corporationTax.I15), num(schedule.Q1));
      check(
        "CT: writing down allowances = Schedule writing down allowances",
        num(corporationTax.I16) + num(corporationTax.I17),
        num(schedule.R1),
      );
      check(
        "CT: balancing allowance on disposals = Schedule balancing allowance less balancing charge",
        num(corporationTax.I18),
        num(schedule.Y1) - num(schedule.Z1),
      );
    }
    check(
      "CT: capital allowances = the allowance lines",
      num(corporationTax.K20),
      num(corporationTax.I15) + num(corporationTax.I16) + num(corporationTax.I17) + num(corporationTax.I18),
    );
    check("CT: profit after capital allowances", num(corporationTax.K22), num(corporationTax.K12) - num(corporationTax.K20));
    check(
      "CT: chargeable profit = profit after allowances + interest - losses brought forward",
      num(corporationTax.K28),
      num(corporationTax.K22) + num(corporationTax.K24) - num(corporationTax.K26),
    );
    // The whole distance between the profit the accounts report and the
    // profit charged to tax, in one line. This is what a comparison of
    // "chargeable against operating" was reaching for; that one was written
    // with a tolerance as wide as the chargeable profit itself, and it is not
    // true at all of a year whose capital allowances beat its add-backs.
    check(
      "CT: chargeable profit = operating profit + add-backs - capital allowances + interest - losses",
      num(corporationTax.K28),
      num(corporationTax.K5) + num(corporationTax.K10) - num(corporationTax.K20) + num(corporationTax.K24) - num(corporationTax.K26),
    );
  }

  const ct600 = results.CT600;
  if (ct600 && corporationTax && pubPL) {
    // The return has no box for a trading loss. Box 155 carries the working
    // sheet's profit after capital allowances while that is a profit and
    // leaves the cell blank when it is a loss, and the chargeable-profits box
    // follows it down (verified against the template: Z70 =
    // IF(CorporationTax!K22>0,...," "), AJ92 = IF(AJ74>0,...,0)). Comparing
    // against the floor the form applies is what makes a year whose capital
    // allowances beat the profit readable; a box carrying the wrong positive
    // figure, or carrying anything at all against a loss, still fails.
    const onTheForm = (working) => (working > 0 ? working : 0);
    check("CT600: turnover = published P&L turnover", num(ct600.AK66), num(pubPL.F9));
    check("CT600: trading profits = CT profit after capital allowances", num(ct600.Z70), onTheForm(num(corporationTax.K22)));
    check("CT600: losses brought forward = CT losses brought forward", num(ct600.Z72), num(corporationTax.K26));
    check("CT600: trading loss arising = the loss on the working sheet", num(ct600.Q206), Math.max(-num(corporationTax.K22), 0));
    check("CT600: net trading profits = trading profits - losses brought forward", num(ct600.AJ74), num(ct600.Z70) - num(ct600.Z72));
    check("CT600: interest received = CT interest received", num(ct600.AJ76), num(corporationTax.K24));
    // Box 235 is box 165 plus box 170 whatever box 165 is (HMRC rule 9332),
    // so a year with no trading profit and interest still states the interest.
    check("CT600: profits before deductions = trading profits + interest", num(ct600.AJ92), onTheForm(num(ct600.AJ74)) + num(ct600.AJ76));
    check("CT600: profits chargeable = CT chargeable profit", num(ct600.AJ110), onTheForm(num(corporationTax.K28)));
    // The form sets out two financial year rows, boxes 43 to 46 and boxes 53
    // to 56, one for each financial year the accounting period falls in.
    // Boxes 46 and 56 carry the tax at the rate before relief, so box 63,
    // which the form calls the total of the two, is the gross charge and
    // box 65 is what the company bears once box 64's relief comes off.
    check("CT600: financial year = first tax row financial year", num(ct600.C126), num(corporationTax.E33), 0);
    check("CT600: amount of profit = first tax row profit", num(ct600.N126), num(corporationTax.F33));
    check("CT600: tax rate = first tax row rate", num(ct600.AA126), num(corporationTax.G33), 0);
    check("CT600: corporation tax = first tax row gross tax", num(ct600.AJ126), num(corporationTax.J33));
    check("CT600: second financial year tax = second tax row gross tax", num(ct600.AJ128), num(corporationTax.J34));
    if (num(corporationTax.A34) > 0) {
      check("CT600: second financial year = second tax row financial year", num(ct600.C128), num(corporationTax.E34), 0);
      check("CT600: second financial year profit = second tax row profit", num(ct600.N128), num(corporationTax.F34));
      check("CT600: second financial year rate = second tax row rate", num(ct600.AA128), num(corporationTax.G34), 0);
    }
    // Boxes 327 and 328 carry the associated companies count for each
    // financial year row. The product tracks one count for the whole
    // period, so both boxes carry the same figure; box 328 follows box 385
    // and the rest of the second row blank when the period does not
    // straddle two financial years.
    check("CT600: franked investment income = the working sheet's figure", num(ct600.Z114), num(corporationTax.K29));
    check("CT600: associated companies, first financial year = Admin P14", num(ct600.Y118), num(admin.P14));
    if (num(corporationTax.A34) > 0) {
      check("CT600: associated companies, second financial year = Admin P14", num(ct600.Y120), num(admin.P14));
    }
    check("CT600: tax payable = tax chargeable", num(ct600.AJ131), num(ct600.AJ126) + num(ct600.AJ128));
    check("CT600: marginal rate relief = the working sheet's relief", num(ct600.Y133), num(corporationTax.L33) + num(corporationTax.L34));
    check("CT600: tax net of marginal relief = the working sheet's charge", num(ct600.Y135), num(corporationTax.K35));
    check("CT600: corporation tax chargeable = tax net of marginal relief", num(ct600.AJ145), num(ct600.Y135));
    if (num(ct600.AJ110) > 0) {
      check(
        "CT600: underlying rate of corporation tax = the tax it bears over the profits chargeable",
        num(ct600.W137),
        (num(ct600.Y135) * 100) / num(ct600.AJ110),
        0.01,
      );
    }
    check("CT600: tax outstanding", num(ct600.AJ166), num(ct600.AJ159) - num(ct600.AJ163));
  }

  if (notes && corporationTax) {
    check("Fixed asset note: corporation tax for the year = CT charge", num(notes.D41), num(corporationTax.K35));
  }
  if (notes && results.TrialBalance) {
    check("Fixed asset note: directors emoluments = trial balance directors wages", num(notes.D35), num(results.TrialBalance.EJ66));
  }

  if (taxData) {
    const ct = results[TAX_SHEET];
    const profit = ct.K28 || 0;
    if (profit > 0) {
      // How the working sheet builds the charge. Rows 33 and 34 are the one
      // or two UK financial years the accounting period falls in: row 33
      // runs from Admin L6 to N6, the 31 March inside the period, and row 34
      // from the day after that to the year end. A period wholly inside one
      // financial year leaves row 34 empty. A35 is the two together, each
      // row takes its share of the chargeable profit (F33 =
      // IF(K28>0,K28*A33/A35,0)) and charges it at its own rate.
      const days = num(ct.A35);
      check(
        "CT: franked investment income = the exempt distributions entered on the opening accounts",
        num(ct.K29),
        num(results.OpenAccounts?.[OPENACCOUNTS_FRANKED_INVESTMENT_INCOME_CELL]),
      );
      check("CT: augmented profits = the chargeable profit and the franked investment income", num(ct.K30), profit + num(ct.K29));
      check("CT: the two tax rows together span the days the charge is spread over", num(ct.A33) + num(ct.A34), days);
      if (days > 0) {
        check("CT: first tax row profit = chargeable profit by its share of those days", num(ct.F33), (profit * num(ct.A33)) / days);
        check("CT: second tax row profit = chargeable profit by its share of those days", num(ct.F34), (profit * num(ct.A34)) / days);
      }
      check("CT: first tax row gross tax = its profit at its rate", num(ct.J33), (num(ct.F33) * num(ct.G33)) / 100);
      check("CT: second tax row gross tax = its profit at its rate", num(ct.J34), (num(ct.F34) * num(ct.G34)) / 100);
      check("CT: first tax row tax = its gross tax less its marginal relief", num(ct.I33), num(ct.J33) - num(ct.L33));
      check("CT: second tax row tax = its gross tax less its marginal relief", num(ct.I34), num(ct.J34) - num(ct.L34));
      check("CT: charge for the year = the two tax rows", num(ct.K35), num(ct.I33) + num(ct.I34));

      // Which band a row falls in is decided on augmented profits: the
      // chargeable profit plus the exempt distributions received. The row's
      // own financial year states both limits, which are shared out over the
      // period the same way the profit is and then divided by one plus the
      // number of associated companies. Relief tapers the gap up to the upper
      // limit at that year's own fraction and is then scaled by the row's
      // taxable share over its augmented share, so distributions take relief
      // away without ever being taxed.
      const admin = results.Admin;
      if (admin && days > 0) {
        const associatedDivisor = 1 + num(admin.P14);
        const sheetRates = (adminRow) =>
          Object.fromEntries(Object.entries(ADMIN_RATE_COLUMNS).map(([figure, column]) => [figure, num(admin[`${column}${adminRow}`])]));
        const lowerLimit = (rates, rowDays) => (rates.lowerLimit * rowDays) / days / associatedDivisor;
        const upperLimit = (rates, rowDays) => (rates.upperLimit * rowDays) / days / associatedDivisor;
        const augmentedShare = (rowDays) => (num(ct.K30) * rowDays) / days;
        const reliefFor = (rates, rowProfit, rowDays) => {
          const augmented = augmentedShare(rowDays);
          if (!(augmented > lowerLimit(rates, rowDays) && augmented < upperLimit(rates, rowDays))) return 0;
          return ((upperLimit(rates, rowDays) - augmented) * rowProfit * rates.marginalReliefFraction) / augmented;
        };
        const rateFor = (rates, rowDays) =>
          augmentedShare(rowDays) <= lowerLimit(rates, rowDays) ? rates.smallProfitsRatePercent : rates.mainRatePercent;

        check(
          "CT: first tax row rate = the rate its share of the augmented profits falls in",
          num(ct.G33),
          rateFor(sheetRates(6), num(ct.A33)),
          0,
        );
        check(
          "CT: second tax row rate = the rate its share of the augmented profits falls in",
          num(ct.G34),
          rateFor(sheetRates(7), num(ct.A34)),
          0,
        );
        check(
          "CT: first tax row marginal relief = its share of the augmented profits against its share of the limits",
          num(ct.L33),
          reliefFor(sheetRates(6), num(ct.F33), num(ct.A33)),
        );
        check(
          "CT: second tax row marginal relief = its share of the augmented profits against its share of the limits",
          num(ct.L34),
          reliefFor(sheetRates(7), num(ct.F34), num(ct.A34)),
        );

        // Every figure a row charges by is its own financial year's. The year
        // the package was generated for supplies its own; a row whose year is
        // the one before it takes that year's figures from the same file, and
        // a row with no days charges nothing either way.
        // The package is generated from the tax year file named for the
        // financial year its year end falls in: the second row's year when
        // the period straddles 1 April, and the first row's when the year
        // ends on 31 March and the period lies wholly inside one.
        const packageFinancialYear = num(ct.A34) > 0 ? num(admin.K7) : num(admin.K6);
        const ROW_NAMES = { 6: "first", 7: "second" };
        const FIGURE_NAMES = {
          smallProfitsRatePercent: "small profits rate",
          mainRatePercent: "main rate",
          marginalReliefFraction: "marginal relief fraction",
          lowerLimit: "marginal relief lower limit",
          upperLimit: "marginal relief upper limit",
        };
        const statedRates = ADMIN_FINANCIAL_YEAR_ROWS.map((adminRow, index) =>
          financialYearRatesFor(taxData, num(admin[`K${adminRow}`]), packageFinancialYear, num(index === 0 ? ct.A33 : ct.A34)),
        );
        for (const [index, adminRow] of ADMIN_FINANCIAL_YEAR_ROWS.entries()) {
          for (const [figure, column] of Object.entries(ADMIN_RATE_COLUMNS)) {
            check(
              `CT: ${ROW_NAMES[adminRow]} tax row ${FIGURE_NAMES[figure]} = what its own financial year charged`,
              num(admin[`${column}${adminRow}`]),
              statedRates[index][figure],
              0,
            );
          }
        }

        // The charge the period's profit actually bears, against the
        // statutory computation worked from the tax year file rather than
        // from the rate cells the sheet charged by: each financial year's
        // share of the profit at the figures that year's own table states.
        const statutory = apportionCorporationTax(
          profit,
          [
            { year: num(admin.K6), days: num(ct.A33) },
            { year: num(admin.K7), days: num(ct.A34) },
          ],
          days,
          {
            perYear: statedRates,
            associatedCompanies: expected.business?.associated_companies ?? 0,
            frankedInvestmentIncome: expected.business?.franked_investment_income ?? 0,
          },
        ).tax;
        check("CT: charge for the year = the statutory computation with marginal relief", num(ct.K35), statutory, 1);
      }

      // Tax outstanding is the charge less any income tax already deducted
      // at source from bank interest received.
      check("CT: Tax outstanding = CT less tax deducted at source", num(ct.K39), num(ct.K35) - num(ct.K37));
    }
  }
}
