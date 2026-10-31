// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { checkSalesinvoice } from "../../../lib/product-sheets/salesinvoice.js";
import { vatRateFor } from "../../../lib/product-sheets/vat-rate.js";
import { PROFIT_BRIDGE_CHECK, categoryNettingCheckName } from "../../../lib/report-generator.js";
import { STOCK_FINAL_ADJUSTMENT_CELL, STOCK_FINAL_CALCULATED_CELL, STOCK_FINAL_COUNT_CELL } from "../layout.js";
import { categoryNetting, journalTotalsByCode, profitBridge } from "../report.js";
import { checkVat } from "./vat.js";
import { checkFixedAssets } from "./fixed-assets.js";
import { checkCompanyRegisters } from "./company-registers.js";
import { checkLedgers } from "./ledgers.js";
import { checkPayroll } from "./payroll.js";
import { checkAdminFiling } from "./admin-filing.js";

export function checkCompliance(results, expected, taxData, calculateExpectedTax, packageYearEnd) {
  const checks = [];

  function check(name, actual, expectedVal, tolerance = 1) {
    const pass = Math.abs(actual - expectedVal) <= tolerance;
    checks.push({ name, actual, expected: expectedVal, pass, diff: actual - expectedVal, tolerance });
  }

  // Some of the workbook's own verdicts are wording, not arithmetic: the
  // cell either names what it found or tells the reader to go and fix
  // something. The report shows both sides as text and the diff column stays
  // empty.
  function checkText(name, actual, accepts, expectedDescription) {
    checks.push({ name, actual, expected: expectedDescription, pass: accepts(actual), diff: "" });
  }

  // A template cell that resolves to blank reads back as the string the
  // formula puts there (" "), so every arithmetic read goes through this.
  const num = (v) => (typeof v === "number" ? v : 0);

  // The same cell read as wording. An unwritten cell reads back as null and a
  // formula's blank as " ", and both mean the sheet names nobody.
  const text = (v) => (v === null || v === undefined ? "" : String(v).trim());

  const rate = vatRateFor(expected);

  const pl = results["MnthP&L"];
  if (expected.total_sales !== undefined) check("Total Sales", pl.B9, expected.total_sales);
  if (expected.gross_profit !== undefined) check("Gross Profit", pl.B16, expected.gross_profit);
  if (expected.net_profit !== undefined) check("Net Profit", pl.B45, expected.net_profit);

  // Trial balance audit accuracy check -- the workbook's own whole-book
  // self-check. EJ91 sums every account's year-end closing balance across
  // the full chart (balance sheet items, income, cost of sales, expenses),
  // so any posting that does not balance shows up here even when nothing
  // else in this file reads that account.
  check("Trial Balance: audit accuracy (EJ91)", results.TrialBalance.EJ91, 0);

  // The published balance sheet balances on its own: net assets against
  // shareholders' funds. EJ91 stays at 0 when the published sheet leaves a
  // trial balance row out, so the two tests are separate.
  if (results.PubBalSht) {
    check("Published balance sheet: net assets (F33) = shareholders' funds (F39)", num(results.PubBalSht.F33), num(results.PubBalSht.F39));
  }

  // Opening balances. A balance sheet that never posts is still balanced, so
  // EJ91 alone cannot tell an unposted opening from a posted one. The next
  // two checks tie the sheet's own opening balance sheet and trial balance
  // audit rows to zero; both need only the calculated results, not a
  // fixture's [opening_balance] table, so they run whether or not one is
  // there -- a book loaded straight from a diya-gl file carries no such
  // table.
  const oa = results.OpenAccounts;
  const tb = results.TrialBalance;
  check("Opening balance sheet: accuracy check (E37)", oa.E37 || 0, 0);
  check("Trial Balance: opening balances audit check (D91)", tb.D91 || 0, 0);

  // The rest tie each opening figure to the trial balance row it feeds, so
  // they run only where the fixture states an [opening_balance] table.
  if (expected.opening_balance) {
    const ob = expected.opening_balance;
    const cost = ob.fixed_asset_cost || {};
    const depreciation = ob.fixed_asset_depreciation || {};
    const sum = (o) => Object.values(o).reduce((s, v) => s + v, 0);

    check("Trial Balance opening: fixed asset cost", (tb.D6 || 0) + (tb.D7 || 0) + (tb.D8 || 0) + (tb.D9 || 0) + (tb.D10 || 0), sum(cost));
    check(
      "Trial Balance opening: accumulated depreciation",
      (tb.D11 || 0) + (tb.D12 || 0) + (tb.D13 || 0) + (tb.D14 || 0) + (tb.D15 || 0),
      -sum(depreciation),
    );
    check("Trial Balance opening: stock", tb.D19 || 0, ob.stock || 0);
    check("Trial Balance opening: trade debtors", tb.D20 || 0, ob.trade_debtors || 0);
    check("Trial Balance opening: bank current account", tb.D22 || 0, ob.current_account || 0);
    check("Trial Balance opening: bank savings account", tb.D23 || 0, ob.savings_account || 0);
    check("Trial Balance opening: credit card account", tb.D24 || 0, ob.credit_card || 0);
    check("Trial Balance opening: cash account", tb.D25 || 0, ob.cash || 0);
    check("Trial Balance opening: trade creditors", tb.D28 || 0, -(ob.trade_creditors || 0));
    check("Trial Balance opening: HMRC VAT creditor", tb.D33 || 0, -(ob.vat_due || 0));
    check("Trial Balance opening: HMRC corporation tax creditor", tb.D35 || 0, -(ob.corporation_tax || 0));
    check("Trial Balance opening: directors loan", tb.D39 || 0, -(ob.directors_loan || 0));
    check("Trial Balance opening: creditors due after more than one year", tb.D40 || 0, -(ob.long_term_creditors || 0));
    check("Trial Balance opening: share capital", tb.D42 || 0, -(ob.share_capital || 0));
    check("Trial Balance opening: revenue reserve", tb.D43 || 0, -(ob.retained_earnings || 0));

    // The directors loan is the one opening balance the year also moves, so
    // its final balance proves the opening survived into the closing column
    // rather than being overwritten by the in-year postings.
    if (expected.bank) {
      let loanMovement = 0;
      for (const transactions of Object.values(expected.bank)) {
        for (const tx of transactions) {
          if (tx.code !== "DL") continue;
          loanMovement += tx.direction === "out" ? tx.amount : -tx.amount;
        }
      }
      check("Trial Balance: directors loan final = opening + movement", tb.EJ39 || 0, (tb.D39 || 0) + loanMovement);
    }
  }

  // P&L internal consistency (6a)
  check("P&L: Gross = Turnover - CoS", pl.B16, pl.B9 - (pl.B14 || 0));
  check("P&L: Operating = Gross - Admin", pl.B43, pl.B16 - (pl.B41 || 0));
  check("P&L: PBT = Operating + Interest", pl.B45, (pl.B43 || 0) + (pl.B44 || 0));

  // Total expenses cross-check (6b)
  const ltdAdminSum = [
    pl.B18,
    pl.B19,
    pl.B20,
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
    pl.B35,
    pl.B36,
    pl.B37,
    pl.B38,
    pl.B39,
    pl.B40,
  ].reduce((s, v) => s + (v || 0), 0);
  check("P&L: Admin lines sum = Total", pl.B41, ltdAdminSum);

  // Expense line totals (6f) — Ltd P&L keeps purchases at gross (same as SE)
  if (expected.total_premises_net) check("Premises", pl.B21 || 0, expected.total_premises_net);
  if (expected.total_legal_net) check("Legal & Professional", pl.B33 || 0, expected.total_legal_net);
  if (expected.total_bad_debts_net) check("Bad Debts written off", pl.B34 || 0, expected.total_bad_debts_net);

  // Stock and debtors on the published balance sheet. Both are derived: stock
  // comes from the physical count against the calculated value, debtors from
  // opening debtors plus everything invoiced less everything banked as a
  // customer receipt. A balance sheet stays balanced whichever figure those
  // chains land on, so anchoring the published lines to the scenario's own
  // closing figures is the only way a stale opening balance or a year of
  // uncollected sales shows up.
  // What the banks paid out under one code, less anything they took back in
  // under it. The debtor and creditor rows below each net their own code off
  // what the ledgers charged to the account.
  const netBankPayments = (code) => {
    let total = 0;
    for (const transactions of Object.values(expected.bank || {})) {
      for (const tx of transactions) {
        if (tx.code !== code) continue;
        total += tx.direction === "out" ? tx.amount : -tx.amount;
      }
    }
    return total;
  };

  const stock = results.Stock;
  const pubBS = results.PubBalSht;
  const openingStock = expected.stock?.opening ?? expected.opening_stock;
  const closingStock = expected.stock?.closing ?? expected.closing_stock;
  if (openingStock !== undefined && stock) {
    check("Stock: opening carried in from the opening balance sheet", stock.D6 || 0, openingStock);
  }
  if (closingStock !== undefined && stock) {
    check("Stock: physical count at the year end", stock[STOCK_FINAL_COUNT_CELL] || 0, closingStock);
    check(
      "Stock: loss adjustment = count - calculated",
      stock[STOCK_FINAL_ADJUSTMENT_CELL] || 0,
      (stock[STOCK_FINAL_COUNT_CELL] || 0) - (stock[STOCK_FINAL_CALCULATED_CELL] || 0),
    );
    if (pubBS) check("Published balance sheet: stock = year-end stock", pubBS.E10 || 0, closingStock);

    // What the sheet works the year-end stock out to be, before anyone counts
    // it: the opening figure, plus the materials bought in the year, less the
    // materials its stock percentage reckons went out inside the product
    // sales. Both sides come from the scenario, so a month of materials that
    // never reached the sheet, or a percentage that never reached H4, shows
    // up here instead of being absorbed into the count adjustment.
    const materialsPercent = expected.stock?.materials_percent;
    if (materialsPercent !== undefined) {
      const bought = journalTotalsByCode(expected.purchases, rate, "g").net.s || 0;
      const sold = materialsPercent * (journalTotalsByCode(expected.sales, rate, "a").net.a || 0);
      check(
        "Stock: calculated stock = opening + materials bought - materials sold",
        num(stock[STOCK_FINAL_CALCULATED_CELL]),
        num(stock.D6) + bought - sold,
      );
    }
  }
  if (expected.closing_debtors && pubBS) {
    const total = expected.closing_debtors.reduce((s, d) => s + d.amount, 0);
    check("Published balance sheet: trade debtors = closing debtors", pubBS.E11 || 0, total);
  }

  // The same figure again, from the ledger rather than the listing: the
  // debtors brought forward, plus everything invoiced, less every receipt
  // the banks took under code "DR" (Currentaccount J). The listing is worked
  // out from the same journals, so a receipt coded to some other ledger --
  // a customer's money credited to the VAT creditor, say -- moves the
  // balance sheet and this expectation together with it and leaves the
  // listing behind.
  if (pubBS && expected.sales && expected.bank && expected.opening_debtors) {
    let invoiced = 0;
    let cisSuffered = 0;
    for (const transactions of Object.values(expected.sales)) {
      for (const tx of transactions) {
        invoiced += tx.amount;
        cisSuffered += tx.cis_deduction || 0;
      }
    }
    const broughtForward = expected.opening_debtors.reduce((total, d) => total + d.amount, 0);
    check(
      "Published balance sheet: trade debtors = opening debtors plus invoices less customer receipts and the CIS suffered",
      num(pubBS.E11),
      broughtForward + invoiced - cisSuffered + netBankPayments("DR"),
    );
  }

  const ctx = { check, checkText, checks, expected, netBankPayments, num, packageYearEnd, pl, rate, results, taxData, text };
  checkVat(ctx);
  Object.assign(ctx, checkFixedAssets(ctx));
  Object.assign(ctx, checkCompanyRegisters(ctx));
  Object.assign(ctx, checkLedgers(ctx));
  checkPayroll(ctx);
  checkAdminFiling(ctx);

  // The whole distance from the accounting profit to the profit tax is
  // charged on, adjustment by adjustment, with nothing left over.
  const bridge = profitBridge(results);
  if (bridge) check(PROFIT_BRIDGE_CHECK, bridge.residue, 0, 0.01);

  // Every journal category the report nets, one residue at a time. The
  // monthly ties above prove each month landed in the right column; these
  // prove the year's gross figure reaches the statement with the VAT taken
  // off and nothing else lost on the way.
  const netting = categoryNetting(results, expected);
  for (const row of netting?.rows || []) check(categoryNettingCheckName(row), row.residue, 0, 0.01);

  checkSalesinvoice({ check, num }, results, expected, taxData, rate);

  return checks;
}
