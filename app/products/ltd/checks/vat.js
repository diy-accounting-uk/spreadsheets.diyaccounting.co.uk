// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { checkVatChain } from "../../../lib/product-sheets/vat-chain.js";
import { netOfVat } from "../../../lib/product-sheets/vat-rate.js";
import { VAT_RATE_CELL } from "../layout.js";
import { LTD_VAT_LAYOUT, fiscalMonthTabs } from "../reads.js";

export function checkVat(ctx) {
  const { check, expected, num, rate, results } = ctx;

  // VAT chain: Sales/Purchases month VAT totals must flow through the
  // Vatinterface external links into the VATQtr boxes. The month totals are
  // read straight from the leaf workbooks, so a broken link chain shows up
  // as a quarter-sum mismatch here rather than as consistent zeros.
  const salesMonthKeys = Object.keys(results).filter((k) => k.startsWith("Sales.xlsx!"));
  const purchasesMonthKeys = Object.keys(results).filter((k) => k.startsWith("Purchases.xlsx!"));
  const vatQtr = (n) => results[`Vatreturns.xlsx!VATQtr${n}`];
  if (salesMonthKeys.length === 12 && purchasesMonthKeys.length === 12 && vatQtr(1)) {
    const annualOutputVat = salesMonthKeys.reduce((s, k) => s + (results[k].G1 || 0), 0);
    const annualInputVat = purchasesMonthKeys.reduce((s, k) => s + (results[k].G1 || 0), 0);
    const sumBox = (cell) => [1, 2, 3, 4].reduce((s, n) => s + (vatQtr(n)?.[cell] || 0), 0);

    check("VAT: Q1-Q4 box 1 = Sales VAT", sumBox("G9"), annualOutputVat);
    check("VAT: Q1-Q4 box 4 = Purchases VAT", sumBox("G15"), annualInputVat);
    for (const n of [1, 2, 3, 4]) {
      const q = vatQtr(n);
      if (q) check(`VAT Q${n}: box 5 = box 3 - box 4`, q.G17 || 0, (q.G13 || 0) - (q.G15 || 0));
    }
    if (expected.vat_output_total !== undefined) check("VAT: annual output VAT", annualOutputVat, expected.vat_output_total);
    if (expected.vat_input_total !== undefined) check("VAT: annual input VAT", annualInputVat, expected.vat_input_total);

    // Both sides of the year against the journals that fed them, split at the
    // rate the scenario's registration status puts in the book. A business
    // that is not registered has to land on nil here, and it lands there
    // because the rate cell is zero, not because the journals are empty.
    const journalVat = (journal) => {
      let total = 0;
      for (const transactions of Object.values(journal || {})) {
        for (const tx of transactions) total += tx.amount - netOfVat(tx.amount, rate);
      }
      return total;
    };
    if (expected.sales) check("VAT: annual output VAT = the sales journal at the book's rate", annualOutputVat, journalVat(expected.sales));
    if (expected.purchases) {
      check("VAT: annual input VAT = the purchase journal at the book's rate", annualInputVat, journalVat(expected.purchases));
    }
  }

  // The rate cell itself, month by month on both journals. A non-registered
  // scenario writes 0 into the first Sales month and nothing else; every
  // other month has to arrive at the same rate down the template's own chain
  // of references, so a month that broke away from it shows up here.
  fiscalMonthTabs(results).forEach((tab) => {
    for (const journal of ["Sales.xlsx", "Purchases.xlsx"]) {
      const month = results[`${journal}!${tab}`];
      if (month) check(`${journal} ${tab}: VAT rate charged (${VAT_RATE_CELL})`, num(month[VAT_RATE_CELL]), rate * 100, 0);
    }
  });

  checkVatChain({ check, num, rate }, results, expected, LTD_VAT_LAYOUT);
}
