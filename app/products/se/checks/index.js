// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { periodShiftMonths, shiftMonths } from "../../../lib/period-shift.js";
import { checkSalesinvoice } from "../../../lib/product-sheets/salesinvoice.js";
import { netOfVat, vatRateFor } from "../../../lib/product-sheets/vat-rate.js";
import { PROFIT_BRIDGE_CHECK, categoryNettingCheckName } from "../../../lib/report-generator.js";
import { MONTH_SHEETS } from "../../../lib/scenario-loader.js";
import { checkForecastTaxAndNi } from "../../../lib/tax/income-tax.js";
import { FIXTURE_CAR_MILEAGE_RATES, calculateMileageAllowance, mileageClaimChangeFromFixture } from "../../../lib/tax/mileage.js";
import { FORECAST_SHEET, TAX_SHEET } from "../cell-map.js";
import { SE_YEAR_END_MONTH, STOCK_CLOSING_COUNT_CELL, STOCK_OPENING_COUNT_CELL, VAT_RATE_CELL } from "../layout.js";
import { MONTH_COLS } from "../reads.js";
import { categoryNetting, journalMiles, mileageClaimsByMonth, profitBridge } from "../report.js";
import { checkSa103f } from "./sa103f.js";
import { checkFixedAssets } from "./fixed-assets.js";
import { checkLedgers } from "./ledgers.js";
import { checkPayroll } from "./payroll.js";
import { checkVat } from "./vat.js";
import { checkAdmin } from "./admin.js";

export function checkCompliance(results, expected, taxData, calculateExpectedTax, packageYearEnd) {
  const checks = [];

  // A fourth, optional argument marks a check "warning": the shipped
  // template genuinely diverges from the figure named here and no fixture
  // closes the gap, so the report is asked to carry the divergence rather
  // than fail outright. The diff column is what a hand computation would
  // call the size of that gap.
  function check(name, actual, expectedVal, tolerance = 1, severity) {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal, tolerance, severity });
  }

  // The same whole-year shift cellWrites applies before writing a posting
  // date onto the package. packageYearEnd is the YYYY-MM-DD the package's own
  // directory name carries; its year, minus one, is the year the package's
  // tax year opens in, the targetStartYear cellWrites derives from the
  // package it is writing into.
  const packageStartYear = packageYearEnd ? parseInt(packageYearEnd.slice(0, 4), 10) - 1 : null;
  const monthOffset = packageStartYear ? periodShiftMonths(expected, packageStartYear, SE_YEAR_END_MONTH) : 0;
  const shiftDate = (d) => shiftMonths(d, monthOffset);

  // Some of the workbook's own cells hold wording rather than arithmetic.
  // The report shows both sides as text and the diff column stays empty.
  function checkText(name, actual, expectedText) {
    checks.push({ name, actual, expected: expectedText, pass: actual === expectedText, diff: "" });
  }

  const rate = vatRateFor(expected);

  // A template cell that resolves to blank reads back as the string the
  // formula puts there (" "), so every arithmetic read goes through this.
  const num = (v) => (typeof v === "number" ? v : 0);

  // The same cell as text. The sheet's blank is a space and an engine that
  // computes the cell holds nothing there, so both sides have to reach a
  // blank comparison as "".
  const blank = (v) => String(v ?? "").trim();

  // The approved rates the generator injected into the Admin sheet, which is
  // what the Purchases sheets band their running mileage total by. A book
  // checked without a tax year's data is priced at the fixture year's rates.
  const mileageRates = taxData?.mileage || FIXTURE_CAR_MILEAGE_RATES;
  const monthlyMileageClaims = mileageClaimsByMonth(expected, mileageRates);

  // The rate cell itself, month by month on both journals. A non-registered
  // scenario writes 0 into April's Sales tab and nothing else; every other
  // month has to arrive at the same rate down the template's own chain of
  // references, so a month that broke away from it shows up here.
  for (const tab of Object.values(MONTH_SHEETS)) {
    for (const journal of ["Sales.xlsx", "Purchases.xlsx"]) {
      const month = results[`${journal}!${tab}`];
      if (month) {
        const read = month[VAT_RATE_CELL];
        check(`${journal} ${tab}: VAT rate charged (${VAT_RATE_CELL})`, typeof read === "number" ? read : 0, rate * 100, 0);
      }
    }
  }

  const pl = results["Profit & Loss Account"];
  if (expected.total_sales !== undefined) check("Total Sales", pl.B9, expected.total_sales);
  if (expected.gross_profit !== undefined) check("Gross Profit", pl.B19, expected.gross_profit);
  if (expected.net_profit !== undefined) check("Net Profit", pl.B39, expected.net_profit);

  // P&L internal consistency (6a)
  check("P&L: Gross = Turnover + Grants - CoS", pl.B19, pl.B9 + (pl.B11 || 0) - (pl.B17 || 0));
  check("P&L: Operating = Gross - Admin", pl.B37, pl.B19 - (pl.B35 || 0));
  check("P&L: PBT = Operating", pl.B39, pl.B37);

  // Total expenses cross-check (6b)
  const seAdminSum = [
    pl.B21,
    pl.B22,
    pl.B23,
    pl.B24,
    pl.B25,
    pl.B26,
    pl.B27,
    pl.B28,
    pl.B29,
    pl.B30,
    pl.B31,
    pl.B32,
    pl.B33,
    pl.B34,
  ].reduce((s, v) => s + (v || 0), 0);
  check("P&L: Admin lines sum = Total", pl.B35, seAdminSum);

  // Whole-book cross-check. SE's Financialaccounts.xlsx carries no
  // double-entry trial balance or audit cell (unlike Ltd's TrialBalance!EJ91)
  // and its SE Full "Balance Sheet Optional" boxes are unlinked manual-entry
  // cells the generator never populates -- there is no live balance sheet
  // identity available to assert for this product. VitalTax independently
  // re-sums the same P&L monthly cells through a second formula path
  // (quarterly SUMs of 'Profit & Loss Account' columns C:N), so comparing
  // its annual total against the P&L's own row-sum annual total is the
  // closest live whole-book closure signal this workbook set supports.
  const vt = results.VitalTax;
  if (vt) {
    check("VitalTax: annual product sales = P&L Products A+B+C", vt.G5 || 0, (pl.B5 || 0) + (pl.B6 || 0) + (pl.B7 || 0));
    check("VitalTax: annual direct costs = P&L Materials + Other Direct Costs", vt.G7 || 0, (pl.B14 || 0) + (pl.B16 || 0));
  }

  // Expense line totals (6f)
  if (expected.total_motor_net) {
    const fixtureMotorNet = expected.total_motor_net;
    check(
      "Motor Expenses",
      pl.B25 || 0,
      fixtureMotorNet + (expected.total_mileage ? mileageClaimChangeFromFixture(expected.total_mileage, mileageRates) : 0),
    );
  }
  if (expected.total_legal_net) check("Legal & Professional", pl.B28 || 0, expected.total_legal_net);
  if (expected.total_bad_debts_net) check("Bad Debts written off", pl.B29 || 0, expected.total_bad_debts_net);

  // The mileage route. A mileage-log entry buys nothing: it states the miles
  // and the sheet prices them. Each Purchases month tab pools its own column
  // D with the Sales month's D1 into the running total at C2, bands that
  // total at the Admin rates in G2 and carries the claim to date at A2, and
  // W2 = IF(F2="v",I2," ") files the claim under Motor Expenses. This P&L
  // makes no choice between the claim and the running costs the way the taxi
  // one does -- the claim simply adds to the motoring the business paid cash
  // for.
  //
  // Both journals' miles count, because that is what C2 pools -- not the
  // scenario's declared mileage total, which counts the purchase journal
  // alone.
  const businessMiles = journalMiles(expected.sales) + journalMiles(expected.purchases);
  const yearEndPurchases = results[`Purchases.xlsx!${MONTH_SHEETS.mar}`];
  if (businessMiles && yearEndPurchases) {
    const mileageClaim = calculateMileageAllowance(businessMiles, mileageRates);
    check("Purchases: business miles pooled for the year", num(yearEndPurchases.C2), businessMiles, 0);
    check("Purchases: mileage claimed = those miles at the tax year's approved rates", num(yearEndPurchases.A2), mileageClaim, 0.01);
    let cashMotorNet = 0;
    for (const transactions of Object.values(expected.purchases || {})) {
      for (const tx of transactions) if (tx.code === "v" && !tx.mileage) cashMotorNet += netOfVat(tx.amount, rate);
    }
    check("P&L: Motor Expenses = motoring paid for + the mileage claimed", num(pl.B25), cashMotorNet + mileageClaim);
  }

  // Stock check
  // Stock. The counts at the two ends of the year, read back from the sheet
  // they were entered on, and the movement between them reaching cost of
  // sales. The materials line carries the year's stock-coded purchases plus
  // the fall in stock across it, so a stock movement that never reaches the
  // accounts shows up here and nowhere else.
  const stockControl = results.StockControl;
  // A fixture states its stock either as its own table or among the totals it
  // declares, so both spellings are read here.
  const openingStock = expected.stock?.opening ?? expected.opening_stock;
  const closingStock = expected.stock?.closing ?? expected.closing_stock;
  if (stockControl && openingStock !== undefined) {
    check("Stock: opening count", num(stockControl[STOCK_OPENING_COUNT_CELL]), openingStock);
  }
  if (stockControl && closingStock !== undefined) {
    check("Stock: count at the year end", num(stockControl[STOCK_CLOSING_COUNT_CELL]), closingStock);
  }
  if (openingStock !== undefined && closingStock !== undefined && expected.purchases) {
    let stockPurchasesNet = 0;
    for (const transactions of Object.values(expected.purchases)) {
      for (const tx of transactions) if (tx.code === "s") stockPurchasesNet += netOfVat(tx.amount, rate);
    }
    check("P&L: materials = stock purchases net + the year's stock movement", num(pl.B14), stockPurchasesNet + openingStock - closingStock);
  }

  // Debtors/creditors checks — read the real G1 total (SUM(G5:G300) of the
  // gross invoice value column) from the OpeningDebtors/ClosingDebtors sheet
  // in Sales.xlsx and the OpeningCreditors/ClosingCreditors sheet in
  // Purchases.xlsx, not a fixture total compared to itself.
  if (expected.opening_debtors) {
    const total = expected.opening_debtors.reduce((s, d) => s + d.amount, 0);
    if (total > 0) check("Opening Debtors total", results["Sales.xlsx!OpeningDebtors"]?.G1 || 0, total);
  }
  if (expected.closing_debtors) {
    const total = expected.closing_debtors.reduce((s, d) => s + d.amount, 0);
    if (total > 0) check("Closing Debtors total", results["Sales.xlsx!ClosingDebtors"]?.G1 || 0, total);
  }
  if (expected.opening_creditors) {
    const total = expected.opening_creditors.reduce((s, c) => s + c.amount, 0);
    if (total > 0) check("Opening Creditors total", results["Purchases.xlsx!OpeningCreditors"]?.G1 || 0, total);
  }
  if (expected.closing_creditors) {
    const total = expected.closing_creditors.reduce((s, c) => s + c.amount, 0);
    if (total > 0) check("Closing Creditors total", results["Purchases.xlsx!ClosingCreditors"]?.G1 || 0, total);
  }

  if (taxData) {
    const tax = results[TAX_SHEET];
    const profit = tax.E5 || 0;
    const expectedTax = calculateExpectedTax(profit, taxData);
    // Class 4 NIC follows the income tax charge onto box 73.3's own spread
    // (FA 2022 Sch 1 para 72(3), SSCBA 1992 s.15(1)), even though the spread
    // sits outside box 76 and net income for income tax purposes.
    const transitionProfitSpread = num(results["SE Full"]?.D201);
    const expectedTaxWithSpread = calculateExpectedTax(profit + transitionProfitSpread, taxData);
    // Box 73.3's own top-slice charge (para 75(2)-(3)): the three bands run
    // again over taxable income (E7) plus the spread, less the tax already
    // charged on taxable income alone -- the personal allowance taper is
    // left untouched, since the spread never reaches E5/E6.
    const expectedTransitionProfitTax = (() => {
      if (transitionProfitSpread <= 0) return 0;
      const it = taxData.income_tax;
      const spreadTop = (tax.E7 || 0) + transitionProfitSpread;
      const basic = spreadTop < it.basic_band_end ? spreadTop * it.basic_rate : it.basic_band_end * it.basic_rate;
      const higher = spreadTop > it.basic_band_end ? (Math.min(spreadTop, it.higher_band_end) - it.basic_band_end) * it.higher_rate : 0;
      const additional = spreadTop > it.higher_band_end ? (spreadTop - it.higher_band_end) * it.additional_rate : 0;
      return basic + higher + additional - expectedTax.income_tax;
    })();

    check("Income Tax", tax.E11 || 0, expectedTax.income_tax, 0.01);
    check("Income Tax on transition profit (box 73.3)", tax.E14 || 0, expectedTransitionProfitTax, 0.01);
    check("NI Class 4 (lower)", tax.E15 || 0, expectedTaxWithSpread.ni_class4_lower, 0.01);
    check("NI Class 4 (upper)", tax.E16 || 0, expectedTaxWithSpread.ni_class4_upper, 0.01);
    // E18 is the sheet's own SUM(E11:E17), and E12 (the CIS already deducted,
    // carried negative) sits inside that range, so the sheet's total is the
    // computed tax and NI less what the contractors have already paid over.
    const cisSuffered = Object.values(expected.sales || {})
      .flat()
      .reduce((total, tx) => total + (tx.cis_deduction || 0), 0);
    check(
      "Total Tax + NI, less the CIS already deducted",
      tax.E18 || 0,
      expectedTax.income_tax +
        expectedTransitionProfitTax +
        expectedTaxWithSpread.ni_class4_lower +
        expectedTaxWithSpread.ni_class4_upper -
        cisSuffered,
      0.01,
    );

    // The allowance the sheet hands out, not the headline one. Above 100,000
    // of profit it falls by a pound for every two, and reaches nil at 125,140.
    // E6 = IF(E5<=0,0,MAX(0,Admin!N$4-MAX(0,E5-Admin!N$5)/2)): a loss year
    // has no taxable profit to set an allowance against, so the sheet floors
    // this at nil rather than showing the allowance unused. calculateExpectedTax
    // has no such floor, so the comparison applies it, the same as the
    // Profit Forecast's own personal allowance check below.
    check("Tax: Personal allowance after taper", tax.E6 || 0, profit <= 0 ? 0 : expectedTax.personal_allowance);
    check("Tax at additional rate", tax.E10 || 0, expectedTax.income_tax_additional);

    // The bands and rates the sheet actually applies, not the ones it is
    // captioned with. A total that happens to be right because the whole
    // taxable income sits in one band hides a wrong rate in the others.
    check("Tax: sheet splits the basic and higher bands at the basic band end", tax.C9 || 0, taxData.income_tax.basic_band_end);
    check("Tax: sheet splits the higher and additional bands at the higher band end", tax.C10 || 0, taxData.income_tax.higher_band_end);
    check("Tax: sheet applies the additional rate above the higher band", tax.D10 || 0, taxData.income_tax.additional_rate, 0.0001);

    // Tax calculation chain (6c)
    // The sheet has no negative taxable income: a profit under the personal
    // allowance leaves it nil (verified against the template: E7 =
    // IF(E5>E6,E5-E6,0)), and the tax bands below it fall to nil with it.
    check("Tax: Taxable = Profit - Allowance", tax.E7, Math.max(0, (tax.E5 || 0) - (tax.E6 || 0)));
    check("Tax: IT = Basic + Higher + Additional", tax.E11, (tax.E8 || 0) + (tax.E9 || 0) + (tax.E10 || 0));
    // E12 already holds the contractor deductions negated (=-[2]Mar!$X$1) and
    // the sheet's own total is SUM(E11:E17), so the deduction line is added,
    // not subtracted. Every fixture so far carries nil CIS, which is why
    // subtracting it here passed.
    check(
      "Tax: Total = IT + transition profit tax + CIS deduction line + NI",
      tax.E18,
      (tax.E11 || 0) + (tax.E14 || 0) + (tax.E12 || 0) + (tax.E15 || 0) + (tax.E16 || 0),
    );

    // SA103S cross-check (6g)
    const seShort = results["SE Short"];
    if (seShort) {
      if (seShort.D38) check("SA103S: Turnover = P&L Sales", seShort.D38, pl.B9);
      // The return's total expenses line and the profit it carries, each
      // against the accounts they are built from. Depreciation is not an
      // allowable expense for income tax -- capital allowances stand in for
      // it -- so the total the return works from takes it back out, which is
      // the whole of the difference between the two profits. Both are exact
      // identities; the profit was previously compared to a rebuilt figure
      // with a one per cent tolerance.
      // Box 20 (O64) reads 'SE Full'!O122 now, boxes 32 to 45 summed -- the
      // depreciation charge plus every other disallowable category's own
      // percentage. Depreciation alone was the whole of that total before
      // any category had a percentage.
      const sa103fBoxesTotal = num(results["SE Full"]?.O122);
      check(
        "SA103S: total expenses = cost of sales + admin expenses less depreciation",
        num(seShort.O64),
        num(pl.B17) + num(pl.B35) - sa103fBoxesTotal,
      );
      // D71 only ever carries a profit (verified against the template: D71 =
      // IF((D38+O38-O64)>=0,D38+O38-O64,0)) -- a loss-making year floors it
      // at nil and states the loss in O71 instead, so the identity has to be
      // clamped the same way or a loss year fails it on the sheet's own
      // design rather than on a defect.
      check(
        "SA103S: net profit = turnover + other business income - total expenses",
        num(seShort.D71),
        Math.max(0, num(seShort.D38) + num(seShort.O38) - num(seShort.O64)),
      );
      // O71's mirror identity (verified against the template: O71 =
      // IF((D38+O38-O64)<0,O64-D38-O38,0)), so a loss year still has a live
      // check on the same figure rather than the clamp above passing on 0=0.
      check(
        "SA103S: net loss = total expenses - turnover - other business income",
        num(seShort.O71),
        Math.max(0, num(seShort.O64) - num(seShort.D38) - num(seShort.O38)),
      );
      // Income Tax!E5 reads 'SE Full'!O210, so the short return's box 31
      // reaches it only through the full return: the two agree exactly when
      // no box the trader states or claims on SE Full alone (52, 52.1, 53,
      // 53.1, 54, 62 and 71) carries a figure, and stand apart by those
      // figures otherwise.
      const fullOnly = results["SE Full"] || {};
      const fullReturnOnlyBoxes =
        num(fullOnly.D150) +
        num(fullOnly.D152) +
        num(fullOnly.D156) +
        num(fullOnly.D160) +
        num(fullOnly.O139) +
        num(fullOnly.D179) -
        num(fullOnly.D210);
      if (seShort.D106) {
        check(
          "SA103S: Profit for tax (D106) less the SE Full-only boxes 52, 52.1, 53, 53.1, 54 and 62 plus box 71 = Income Tax E5",
          Math.max(0, num(seShort.D106) - fullReturnOnlyBoxes),
          tax.E5,
        );
      }

      // Capital allowances carry from Schedule to SA103S across the
      // cross-file external link (Fixedassets.xlsx -> Financialaccounts.xlsx).
      // Mirrors the SA103S cells' own formulas so the check is a genuine
      // "did the link carry the right value" proof, not a fixture compared
      // to itself.
      // WDA (SE Short D85) has no live signal in this scenario: every new
      // asset claims 100% AIA (Schedule's P flag defaults to 1) and no
      // opening tax-written-down-value is fed into the Schedule's O column
      // for existing assets, so both sides of that identity are always 0 --
      // asserting it would be a check that can only ever pass on 0 = 0. Not
      // added; see the final report for what scenario data would give it
      // real signal.
      const sched = results["Fixedassets.xlsx!Schedule"];
      if (sched) {
        const expectedAIA = (sched.Q1 || 0) > 0 ? sched.Q1 : 0;
        check("SA103S: Capital allowances (AIA/FYA) = Schedule Q1", seShort.D80 || 0, expectedAIA);
      }
    }

    // The Profit Forecast prints its own tax and NI liability, and the P&L's
    // financial health check charges a twelfth of it every month. It runs off
    // its own chain from the P&L, the fixed asset schedule and Admin, so
    // nothing above proves any of it.
    const forecast = results[FORECAST_SHEET];
    if (forecast) {
      // The forecast repeats a month that traded and spreads the year's total
      // across the months that did not, so the projected year only equals the
      // actual one when every month traded. C21 counts the trading months
      // against the P&L's own monthly turnover.
      const monthsTraded = MONTH_COLS.filter((col) => num(pl[`${col}9`]) > 0).length;
      check("Forecast: months of actual trade = P&L months with turnover", num(forecast.C21), monthsTraded, 0);

      if (monthsTraded === MONTH_COLS.length) {
        check("Forecast: turnover = P&L turnover", num(forecast.C22), num(pl.B9));
        check("Forecast: investment grants = P&L investment grants", num(forecast.C24), num(pl.B11));
        check("Forecast: cost of sales = P&L cost of sales", num(forecast.C26), num(pl.B17));
        check("Forecast: general expenses = P&L administrative expenses", num(forecast.C30), num(pl.B35));
        check("Forecast: interest received = P&L interest received", num(forecast.C33), num(pl.B38));
        check("Forecast: profit before tax = P&L profit before tax", num(forecast.C34), num(pl.B39));
      }

      // The two adjustments between the accounting profit and the profit tax
      // is charged on, each against the book it comes from.
      check("Forecast: depreciation added back = P&L disposal loss + depreciation", num(forecast.C37), num(pl.B33) + num(pl.B34));
      const schedule = results["Fixedassets.xlsx!Schedule"];
      if (schedule) {
        check(
          "Forecast: capital allowances = the fixed asset schedule",
          num(forecast.C38),
          num(schedule.Q1) + num(schedule.R1) + num(schedule.AC1) + num(schedule.Y1) - num(schedule.Z1),
        );
      }
      check(
        "Forecast: taxable profit = profit + depreciation - capital allowances",
        num(forecast.C39),
        num(forecast.C34) + num(forecast.C37) - num(forecast.C38),
      );

      checkForecastTaxAndNi(
        check,
        num(forecast.C39),
        {
          personalAllowance: num(forecast.C40),
          standard: num(forecast.C42),
          higher: num(forecast.C43),
          additional: num(forecast.C44),
          ni: num(forecast.C45),
          total: num(forecast.C46),
        },
        taxData,
        calculateExpectedTax,
      );
    }
  }

  const ctx = { blank, check, checkText, expected, monthlyMileageClaims, num, pl, rate, results, shiftDate, taxData, vt };
  checkSa103f(ctx);
  checkFixedAssets(ctx);
  checkLedgers(ctx);
  checkPayroll(ctx);
  checkVat(ctx);
  checkAdmin(ctx);

  // The whole distance from the accounting profit to the profit tax is
  // charged on, adjustment by adjustment, with nothing left over.
  const bridge = profitBridge(results);
  if (bridge) check(PROFIT_BRIDGE_CHECK, bridge.residue, 0, 0.01);

  // Every journal category the report nets, one residue at a time. The
  // monthly ties above prove each month landed in the right column; these
  // prove the year's gross figure reaches the statement with the VAT taken
  // off and nothing else lost on the way.
  const netting = categoryNetting(results, expected, taxData);
  for (const row of netting?.rows || []) check(categoryNettingCheckName(row), row.residue, 0, 0.01);

  checkSalesinvoice({ check, num }, results, expected, taxData, rate);

  return checks;
}
