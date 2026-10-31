// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { excelSerialToUtcDate } from "../../../lib/product-sheets/serial-dates.js";
import { checkVatChain } from "../../../lib/product-sheets/vat-chain.js";
import { parseDate } from "../../../lib/scenario-loader.js";
import { SE_VAT_LAYOUT } from "../layout.js";

export function checkVat(ctx) {
  const { check, expected, monthlyMileageClaims, num, rate, results } = ctx;

  // ── SE VAT quarters: box-level values (item 9) ──
  //
  // Each VATQtr sheet's boxes are LOOKUP formulas against Vatinterface,
  // which in turn reads Sales.xlsx/Purchases.xlsx month totals -- anchored
  // here directly in the scenario's own dated transactions (not a second
  // spreadsheet read) so a break anywhere in that chain shows up as a value
  // mismatch. Each quarter's window is derived from its own G5 (quarter-end)
  // date rather than hard-coded, so the check tracks whatever period the
  // package was generated for and whatever period a reader picks from the
  // dropdown.
  //
  // G5 is dated on the package's own period, the scenario's transactions on
  // the period its own book covers, and cellWrites copies those dates
  // through unchanged. So the window moves onto the scenario by the gap
  // between the two period frames: the whole months from the package's first
  // accounting month to the scenario's. Admin B4 is the book's tax year
  // start, and an SE year starts on 6 April, so the month it falls in is the
  // first of the twelve month tabs. Every window shifts by that one gap,
  // wherever it sits, so a quarter reaching past the year end -- or before it
  // -- is checked on the periods it actually declares.
  const accountingYearOf = (d) => (d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1);
  const scenarioTransactionYears = [...Object.values(expected.sales || {}), ...Object.values(expected.purchases || {})]
    .flat()
    .map((tx) => accountingYearOf(parseDate(tx.date)));
  const scenarioAccountingYear = scenarioTransactionYears.length ? Math.min(...scenarioTransactionYears) : null;
  const bookYearStartSerial = num(results.Admin?.B4);
  const scenarioYearStart = scenarioAccountingYear === null ? null : new Date(Date.UTC(scenarioAccountingYear, 3, 1));
  const monthShift =
    scenarioYearStart && bookYearStartSerial ? monthsBetween(excelSerialToUtcDate(bookYearStartSerial), scenarioYearStart) : null;

  for (let q = 1; q <= 5; q++) {
    const qtr = results[`Vat.xlsx!VATQtr${q}`];
    if (!qtr || !qtr.G5) continue;

    // Box 3 total = box 1 + EU acquisitions (G11, always a static 0 in this
    // template -- no formula, never generator-written), and box 5 = box 3 -
    // box 4.
    check(`VAT Q${q}: box 3 total (G13) = box 1 (G9) + EU acquisitions (G11)`, qtr.G13 || 0, (qtr.G9 || 0) + (qtr.G11 || 0));
    check(`VAT Q${q}: box 5 net due (G17) = box 3 (G13) - box 4 (G15)`, qtr.G17 || 0, (qtr.G13 || 0) - (qtr.G15 || 0));

    // G7 is the payment-due date (LOOKUP into Vatinterface's C column, which
    // is itself just the next row's date), not a value box -- confirmed
    // against the template, contrary to the box-1 label some docs give it.
    // The one provable thing about it without hand-rolling a month-end
    // rollforward is that it falls after the quarter-end.
    check(`VAT Q${q}: payment due date (G7) falls after the quarter end (G5)`, qtr.G7 > qtr.G5 ? 1 : 0, 1, 0);

    // The scenario has to name a period before a window can be moved onto it.
    if (monthShift === null) continue;

    // Quarter window: the three calendar months ending at G5's own month,
    // moved onto the scenario's period frame. Day 0 of the month after is
    // that month's last day, so the shifted window still ends on a month end
    // in a leap year.
    const bookEnd = excelSerialToUtcDate(qtr.G5);
    const qStart = new Date(Date.UTC(bookEnd.getUTCFullYear(), bookEnd.getUTCMonth() + monthShift - 2, 1));
    const qEnd = new Date(Date.UTC(bookEnd.getUTCFullYear(), bookEnd.getUTCMonth() + monthShift + 1, 0));
    const inQuarter = (dateStr) => {
      const d = parseDate(dateStr);
      return d >= qStart && d <= qEnd;
    };

    let outputVat = 0;
    let inputVat = 0;
    let purchasesNet = 0;
    if (expected.sales) {
      for (const txs of Object.values(expected.sales)) {
        for (const tx of txs) if (inQuarter(tx.date)) outputVat += tx.amount - tx.amount / (1 + rate);
      }
    }
    if (expected.purchases) {
      for (const txs of Object.values(expected.purchases)) {
        for (const tx of txs) {
          if (!inQuarter(tx.date)) continue;
          // A mileage-log row states miles, not money. Its own figure reaches
          // no cell, and the claim the sheet makes of those miles is added
          // below, once for the month.
          if (tx.mileage) continue;
          inputVat += tx.amount - tx.amount / (1 + rate);
          purchasesNet += tx.amount / (1 + rate);
        }
      }
    }
    // The month's mileage claim reaches box 7 through that month's own net
    // total (Vatinterface H = Purchases!I1, and I1 sums I2 with the rows) and
    // carries no input VAT. A quarter window spans whole months, so any row of
    // the month settles which quarter its claim falls in.
    for (const [month, claim] of Object.entries(monthlyMileageClaims)) {
      const rows = expected.purchases?.[month] || expected.sales?.[month] || [];
      if (rows.length > 0 && inQuarter(rows[0].date)) purchasesNet += claim;
    }
    // Periods outside the twelve accounting months are entered on the
    // straddling sheets rather than a month tab, so a window that reaches
    // past the year end or before it picks those entries up as well.
    for (const entry of expected.vat_straddling_sales || []) {
      if (inQuarter(entry.date)) outputVat += entry.amount - entry.amount / (1 + rate);
    }
    for (const entry of expected.vat_straddling_purchases || []) {
      if (!inQuarter(entry.date)) continue;
      inputVat += entry.amount - entry.amount / (1 + rate);
      purchasesNet += entry.amount / (1 + rate);
    }
    check(`VAT Q${q}: box 1/3 output VAT (G9) = scenario sales VAT for the quarter`, qtr.G9 || 0, outputVat, 1);
    check(`VAT Q${q}: box 4 input VAT (G15) = scenario purchases VAT for the quarter`, qtr.G15 || 0, inputVat, 1);
    check(`VAT Q${q}: box 7 net purchases (G23) = scenario purchases net for the quarter`, qtr.G23 || 0, purchasesNet, 1);
  }

  checkVatChain({ check, num, rate }, results, expected, SE_VAT_LAYOUT);
}

// Whole months from one date's month to another's, ignoring the day of the
// month. Negative when the second date comes first.
function monthsBetween(from, to) {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}
