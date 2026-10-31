// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { netOfVat } from "../../../lib/product-sheets/vat-rate.js";
import { MONTH_SHEETS } from "../../../lib/scenario-loader.js";
import { TAX_SHEET } from "../cell-map.js";
import { MONTH_KEYS } from "../layout.js";
import { MONTH_COLS, PURCHASES_MONTHLY_TIE_ROWS, SALES_BAD_DEBT_ROW, SALES_MONTHLY_TIE_ROWS } from "../reads.js";

export function checkLedgers(ctx) {
  const { check, expected, monthlyMileageClaims, num, pl, rate, results } = ctx;

  // ── Bank (item 6): each leaf's closing balance vs the scenario's own cash
  // movements for that account. Computed independently from the raw
  // scenario.bank transactions (direction in/out), not read back from a
  // second spreadsheet formula, so a wrong closing balance -- wrong
  // opening balance carried forward, a receipt posted as a payment, a
  // month dropped -- shows up as a mismatch.
  if (expected.bank) {
    const closingBalanceCheck = (fileName, account) => {
      let openingBC = 0;
      let receipts = 0;
      let payments = 0;
      for (const transactions of Object.values(expected.bank)) {
        for (const tx of transactions) {
          if ((tx.account || "1200") !== account) continue;
          if (tx.code === "BC") openingBC += tx.amount;
          else if (tx.direction === "in") receipts += tx.amount;
          else if (tx.direction === "out") payments += tx.amount;
        }
      }
      const mar = results[`${fileName}!Mar`];
      if (mar) check(`${fileName} closing balance (Mar!A2)`, mar.A2 || 0, openingBC + receipts - payments);
    };
    closingBalanceCheck("Bank.xlsx", "1200");
    closingBalanceCheck("Cash.xlsx", "1220");
  }

  // ── Monthly P&L vs monthly Sales/Purchases (item 10) ──
  //
  // Each month's P&L category cell reads a single Sales.xlsx/Purchases.xlsx
  // column via cross-file external link (verified against the template's
  // per-month formulas -- see SALES_MONTHLY_TIE_ROWS/PURCHASES_MONTHLY_TIE_ROWS).
  // Both sides are net of VAT: the P&L cells hold the workbook's own net
  // total, and the "expected" side here converts the scenario's gross
  // transaction amounts to net using the same 20% rate the templates use
  // (VAT_RATE, see the Fixedassets writer above) -- comparing net to net,
  // not the gross scenario amount to the net P&L figure. This catches a
  // month landing in the wrong column or a whole month dropping out.
  if (pl && expected.sales) {
    for (let i = 0; i < MONTH_KEYS.length; i++) {
      const monthTx = expected.sales[MONTH_KEYS[i]] || [];
      const col = MONTH_COLS[i];
      const byCode = {};
      for (const tx of monthTx) byCode[tx.code] = (byCode[tx.code] || 0) + tx.amount;

      for (const [code, row] of Object.entries(SALES_MONTHLY_TIE_ROWS)) {
        const net = netOfVat(byCode[code] || 0, rate);
        check(`P&L ${MONTH_KEYS[i]} col ${col}${row} = Sales.xlsx ${code}-coded net`, pl[`${col}${row}`] || 0, net);
      }
      const badDebtNet = netOfVat(byCode.o || 0, rate);
      check(
        `P&L ${MONTH_KEYS[i]} col ${col}${SALES_BAD_DEBT_ROW} = -(Sales.xlsx o-coded net)`,
        pl[`${col}${SALES_BAD_DEBT_ROW}`] || 0,
        -badDebtNet,
      );
    }
  }
  // Purchases.xlsx side, same shape as the sales-side ties above. Previously
  // unasserted: writing the amount cell (column G) used to silently delete
  // the adjacent VAT formula cell (H) because the cell-replace regex ran up
  // to the next "</c>" rather than stopping at the next cell's own open tag,
  // so every Purchases.xlsx row read net = gross. spreadsheet-runner.js's
  // cellElementPattern now stops at "<c " as well as "</c>", so this ties
  // net to net like the sales side.
  if (pl && expected.purchases) {
    for (let i = 0; i < MONTH_KEYS.length; i++) {
      const monthTx = expected.purchases[MONTH_KEYS[i]] || [];
      const col = MONTH_COLS[i];
      const byCode = {};
      // A mileage-log row states miles, not money, so its own figure reaches
      // no analysis column. The month's claim reaches the motoring one
      // instead, through W2 = IF(F2="v",I2," ").
      for (const tx of monthTx) {
        if (tx.mileage) continue;
        byCode[tx.code] = (byCode[tx.code] || 0) + tx.amount;
      }

      for (const [code, row] of Object.entries(PURCHASES_MONTHLY_TIE_ROWS)) {
        let net = netOfVat(byCode[code] || 0, rate) + (code === "v" ? monthlyMileageClaims[MONTH_KEYS[i]] || 0 : 0);
        // Box 24 combines advertising and business entertainment in one row.
        if (code === "a") net += netOfVat(byCode.e || 0, rate);
        check(`P&L ${MONTH_KEYS[i]} col ${col}${row} = Purchases.xlsx ${code}-coded net`, pl[`${col}${row}`] || 0, net);
      }
    }
  }

  // ── CIS deducted from subcontractors (Purchases.xlsx column AD) ──────────
  //
  // A contractor withholds tax from a subcontractor's invoice and records it
  // on the certificate column beside that invoice. The column has its own
  // monthly total and sits outside the sheet's expense analysis, so both
  // things are asserted: the tax reaches the column it belongs in, and the
  // month's own check total -- gross less VAT less every expense column,
  // which is the nearest this product has to a trial balance -- stays nil
  // with it there. Anchored in the scenario's own entries, so a month whose
  // certificates never reached the sheet fails on that month alone.
  if (expected.purchases) {
    Object.values(MONTH_SHEETS).forEach((tab, i) => {
      const month = results[`Purchases.xlsx!${tab}`];
      if (!month) return;
      const withheld = (expected.purchases[MONTH_KEYS[i]] || []).reduce((total, tx) => total + (tx.cis_deduction || 0), 0);
      check(`Purchases.xlsx ${tab}: CIS tax withheld reaches the certificates column (AD1)`, num(month.AD1), withheld, 0.01);
      check(`Purchases.xlsx ${tab}: the month's expense analysis balances (A1)`, num(month.A1), 0, 0.01);
    });
  }

  // ── CIS suffered on the business's own invoices (Sales.xlsx column W) ────
  //
  // The other side of the scheme: a contractor customer withholds tax from
  // this business's invoice, and the sub-contractor records it beside that
  // sale. W1 totals the month and X1 runs the year to date (Apr!X1 = W1,
  // every later tab = W1 + the month before), which is the figure the return
  // takes off the tax bill -- Income Tax!E12 = -[2]Mar!$X$1 and
  // SE Full!D231 = [2]Mar!$X$1. Both sides of each check are anchored in the
  // scenario's own sales, so a return that agrees with the journals only
  // because every figure is nil fails.
  if (expected.sales) {
    let sufferedToDate = 0;
    Object.values(MONTH_SHEETS).forEach((tab, i) => {
      const suffered = (expected.sales[MONTH_KEYS[i]] || []).reduce((total, tx) => total + (tx.cis_deduction || 0), 0);
      sufferedToDate += suffered;
      const month = results[`Sales.xlsx!${tab}`];
      if (!month) return;
      check(`Sales.xlsx ${tab}: CIS suffered reaches the sub-contractor column (W1)`, num(month.W1), suffered, 0.01);
      check(`Sales.xlsx ${tab}: CIS suffered for the year to date (X1)`, num(month.X1), sufferedToDate, 0.01);
    });
    const taxSheet = results[TAX_SHEET];
    if (taxSheet) {
      check("Tax: CIS deducted (E12) = the year's CIS suffered on the sales journal", num(taxSheet.E12), -sufferedToDate, 0.01);
    }
    const fullReturn = results["SE Full"];
    if (fullReturn) {
      check(
        "SA103F box 81 contractor deductions taken off (D231) = the year's CIS suffered on the sales journal",
        num(fullReturn.D231),
        sufferedToDate,
        0.01,
      );
    }
  }
}
