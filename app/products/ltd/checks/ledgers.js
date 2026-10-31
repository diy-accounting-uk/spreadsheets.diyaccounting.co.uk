// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { BANK_ACCOUNT_FILES } from "../../../lib/ltd-layout.js";
import { shiftMonths } from "../../../lib/period-shift.js";
import { netOfVat } from "../../../lib/product-sheets/vat-rate.js";
import { parseDate } from "../../../lib/scenario-loader.js";
import { TAX_SHEET } from "../cell-map.js";
import { SHORT_MONTHS, TRIAL_BALANCE_BANK_ECHO_CELLS } from "../layout.js";
import {
  ENTERTAINMENT_CODE,
  MONTHLY_TURNOVER_ROW,
  MONTH_COLS,
  PURCHASES_MONTHLY_TIE_ROWS,
  PURCHASES_MONTH_TOTAL_CELLS,
  SALES_BAD_DEBT_ROW,
  SALES_MONTHLY_TIE_ROWS,
  SALES_MONTH_TOTAL_CELLS,
  monthTabsFromPeriodStart,
} from "../reads.js";
import { getMonthTabNames } from "../writes.js";

export function checkLedgers(ctx) {
  const { check, expected, hp, netBankPayments, notes, num, pl, pubBalSht, rate, results, schedule } = ctx;

  // ── The creditor rows the bank codes settle ─────────────────────────────
  const finalBalances = results.TrialBalance;

  // Trade creditors (row 28) take every purchase invoiced and give back
  // every payment made under "CR". The year-end journal then moves the hire
  // purchase agreements' amounts financed off the row: EH28 reads
  // [1]HPfinance!$E$2 and EH40 its negative, so the assets those agreements
  // paid for stop being trade creditors and become creditors falling due
  // after more than one year. Every term here comes from the scenario, so a
  // reclassification that moved the wrong figure, or moved nothing, shows up
  // instead of a sheet that only agrees with itself.
  // Everything invoiced through the purchase journal, and the CIS the
  // company withheld from the sub-contractors among those invoices. Both
  // rows below need the pair: what the sub-contractor is owed is the invoice
  // less the tax withheld from it.
  let invoiced = 0;
  let cisWithheld = 0;
  for (const transactions of Object.values(expected.purchases || {})) {
    for (const tx of transactions) {
      invoiced += tx.amount;
      cisWithheld += tx.cis_deduction || 0;
    }
  }

  // Trade creditors (row 28) take every purchase invoiced and give back
  // every payment made under "CR" and every CIS certificate on the journal
  // (G28 = -[2]<Month>!$F$1+[2]<Month>!$AK$1). The year-end journal then
  // moves the hire purchase agreements' amounts financed off the row: EH28
  // reads [1]HPfinance!$E$2 and EH40 its negative, so the assets those
  // agreements paid for stop being trade creditors and become creditors
  // falling due after more than one year. Every term here comes from the
  // scenario, so a reclassification that moved the wrong figure, or moved
  // nothing, shows up instead of a sheet that only agrees with itself.
  if (finalBalances && expected.purchases && expected.bank) {
    const amountsFinanced = (expected.hp_agreements || []).reduce((total, agreement) => total + agreement.amount_financed, 0);
    check(
      "Trial Balance: trade creditors = opening plus purchases, less creditor payments, CIS withheld and the amounts financed",
      -num(finalBalances.EJ28),
      (expected.opening_balance?.trade_creditors || 0) + invoiced - netBankPayments("CR") - cisWithheld - amountsFinanced,
    );
  }

  // The PAYE creditor (row 34) takes the month's income tax and both
  // National Insurance contributions off the payroll and gives back every
  // payment made under "RP" (Currentaccount AH). VAT, corporation tax and
  // CIS have codes and rows of their own, so any of them paid under "RP"
  // leaves this line short by what it paid.
  if (finalBalances && expected.payroll && expected.bank) {
    let payrollDue = 0;
    for (const entries of Object.values(expected.payroll)) {
      for (const entry of entries) payrollDue += entry.incomeTax + entry.employeeNI + entry.employerNI;
    }
    check(
      "Trial Balance: PAYE creditor = the year's payroll deductions less the payments coded RP",
      -num(finalBalances.EJ34),
      payrollDue - netBankPayments("RP"),
    );
  }

  // The VAT creditor (row 33) takes the output VAT off every sales month
  // (-[3]<Month>!$G$1), gives back the input VAT off every purchases month
  // ([2]<Month>!$G$1) and settles what the bank paid under "RV"
  // (Currentaccount AI, net of any refund received in column N). Both
  // journals charge VAT at the book's own rate on every line they carry, so
  // the two sides here are the scenario's own gross totals at that rate.
  //
  // The row moves on the accounting month, not on the VAT quarter. A return
  // is filed and paid weeks after the quarter it covers ends, so the year's
  // payments settle the quarter before the year and the first three within
  // it, and the closing creditor is the fourth quarter still to pay plus
  // whatever the paid quarters' own periods straddle the year by. That
  // timing is why this figure is not any one return's box 5.
  if (finalBalances && expected.sales && expected.purchases && expected.bank) {
    let salesGross = 0;
    for (const transactions of Object.values(expected.sales)) {
      for (const tx of transactions) salesGross += tx.amount;
    }
    const vatOn = (gross) => gross - netOfVat(gross, rate);
    check(
      "Trial Balance: VAT creditor = opening plus output VAT, less input VAT and the payments coded RV",
      -num(finalBalances.EJ33),
      (expected.opening_balance?.vat_due || 0) + vatOn(salesGross) - vatOn(invoiced) - netBankPayments("RV"),
    );
  }

  // The CIS creditor (row 32) takes the tax withheld from sub-contractors
  // out of Purchases!AK (-[2]<Month>!$AK$1), gives back the tax a contractor
  // customer withheld from this company's own invoices ([3]<Month>!$V$1),
  // which is set against the same bill, and gives back the remittances paid
  // under "RC" (Currentaccount AJ). What is withheld in a month is remitted
  // by the 19th of the next one, so the row closes at what the final months
  // withheld and had not yet paid over.
  if (finalBalances && expected.purchases && expected.bank) {
    let cisSuffered = 0;
    for (const transactions of Object.values(expected.sales || {})) {
      for (const tx of transactions) cisSuffered += tx.cis_deduction || 0;
    }
    check(
      "Trial Balance: CIS creditor = the tax withheld from sub-contractors less the CIS suffered and the remittances paid under RC",
      -num(finalBalances.EJ32),
      (expected.opening_balance?.cis_due || 0) + cisWithheld - cisSuffered - netBankPayments("RC"),
    );
  }

  // The corporation tax creditor (row 35): the opening balance and the
  // charge the working sheet computes, less the tax credit the template
  // imputes on interest received (EH35 = -EH58, a gross-up of the year's
  // interest) and less every payment made under "RT" (Currentaccount AK).
  const taxWorkingSheet = results[TAX_SHEET];
  if (finalBalances && taxWorkingSheet && expected.bank && expected.opening_balance) {
    check(
      "Trial Balance: corporation tax creditor = opening plus the year's charge, less the interest tax credit and the payments coded RT",
      -num(finalBalances.EJ35),
      (expected.opening_balance.corporation_tax || 0) + num(taxWorkingSheet.K35) - num(finalBalances.EH35) - netBankPayments("RT"),
    );
  }

  // FAreconciliation is the workbook's own tie-out between the asset
  // schedule and the two ledgers. E11/K11 re-sum the Schedule's New-asset
  // and disposal rows; E13/K13 read the annual fixed asset totals straight
  // out of Purchases.xlsx and Sales.xlsx across a leaf-to-leaf link.
  // Comparing the two sides is the comparison the sheet was built to make.
  const faReconciliation = results["Fixedassets.xlsx!FAreconciliation"];
  if (faReconciliation) {
    check("Fixed assets: Schedule additions = Purchases.xlsx fixed asset total", num(faReconciliation.E11), num(faReconciliation.E13));
    check("Fixed assets: Schedule disposals = Sales.xlsx fixed asset sales total", num(faReconciliation.K11), num(faReconciliation.K13));
  }

  // The scenario's own "fa"/"fs"-coded net totals then anchor the schedule
  // side to what a customer actually typed in, so a schedule and a ledger
  // that agree on the wrong figure still fails.
  if (faReconciliation && expected.purchases) {
    let assetGross = 0;
    for (const transactions of Object.values(expected.purchases)) {
      for (const tx of transactions) if (tx.code === "fa") assetGross += tx.amount;
    }
    check("Fixed assets: Schedule additions = fixed asset purchases net of VAT", num(faReconciliation.E11), netOfVat(assetGross, rate));
  }
  if (faReconciliation && expected.sales) {
    let disposalGross = 0;
    for (const transactions of Object.values(expected.sales)) {
      for (const tx of transactions) if (tx.code === "fs") disposalGross += tx.amount;
    }
    check(
      "Fixed assets: Schedule disposal proceeds = fixed asset sales net of VAT",
      num(faReconciliation.K11),
      netOfVat(disposalGross, rate),
    );
  }

  // Row 15 is the verdict the sheet prints for the reader: the difference
  // between the ledger and the schedule, which B15/G15 turn into the
  // "reconcile" sentence. With both sides anchored above, nil here is the
  // sheet agreeing with the book rather than with itself.
  if (faReconciliation && expected.purchases) {
    check("Fixed assets: the purchases reconciliation reads nil", num(faReconciliation.E15), 0);
  }
  if (faReconciliation && expected.sales) {
    check("Fixed assets: the sales reconciliation reads nil", num(faReconciliation.K15), 0);
  }

  // The P&L depreciation and disposal lines carry the Schedule's annual
  // figures across the same link, one twelfth per month.
  if (schedule) {
    check("P&L: depreciation = fixed asset note charge for the year", num(pl.B40), num(notes?.G15));
    check(
      "P&L: loss on disposal = Schedule cost less depreciation less proceeds",
      num(pl.B39),
      num(schedule.W1) - num(schedule.X1) - num(schedule.V1),
    );
  }

  // ── HP finance agreements (Fixedassets.xlsx HPfinance sheet) ────────────
  // Each check is anchored in the agreement's own fixture fields, not in
  // another cell of the same sheet, so a schedule that is merely
  // self-consistent cannot pass.
  if (hp && expected.hp_agreements) {
    const [agreement1, agreement2] = expected.hp_agreements;
    if (agreement1) {
      check(
        "HP: first agreement monthly payment = the amount financed with charges over its term",
        num(hp.I8),
        (agreement1.amount_financed + agreement1.admin_charges + agreement1.total_interest) / agreement1.months,
      );
      check("HP: first agreement capital and interest split sums to the monthly payment", num(hp.J8) + num(hp.K8), num(hp.I8));
    }
    if (agreement2) {
      check(
        "HP: second agreement monthly payment computes",
        num(hp.I10),
        (agreement2.amount_financed + agreement2.admin_charges + agreement2.total_interest) / agreement2.months,
      );
      check("HP: second agreement capital and interest split sums to the monthly payment", num(hp.J10) + num(hp.K10), num(hp.I10));
    }
    check(
      "HP: long term creditors = the agreements' amounts financed",
      num(hp.E2),
      expected.hp_agreements.reduce((s, a) => s + a.amount_financed, 0),
    );
  }

  // The year's HP interest and admin charges reaching the P&L's own "Bank
  // Charges" line (MnthP&L!B36), through the "B" bank-payment code every
  // other direct bank charge on that line already uses, plus whatever nets
  // through the bank workbooks' "Bank Contra Items Received/Paid" rows
  // (TrialBalance rows 88/89), which the sheet feeds from code "X" -- an
  // uncoded transfer between the company's own accounts, coded "X" on the
  // leg its own workbook has no more specific letter for. Computed from the
  // scenario's own bank transactions, not from the P&L cell it is compared
  // to, so a broken cross-file link shows up here rather than passing by
  // construction.
  if (pl && expected.bank) {
    check("P&L: HP interest and charges reach the Bank Charges line (B36)", num(pl.B36), netBankPayments("B") + netBankPayments("X"));
  }

  // ── Bank: each workbook's closing balance against the scenario's own cash
  // movements for that account. The expectation is computed from the
  // direction-tagged entries, not read back from a second formula, so a
  // receipt posted as a payment, a dropped month or an opening balance that
  // never carried forward shows up here.
  //
  // A "BC"-coded entry only carries the account's opening balance on the
  // day the workbook's own first entry falls on; a "BC"-coded entry any
  // other day is an ordinary transfer statement line, the same as any other
  // code (see BANK_TRANSFER_CODES). tx.date arrives as a plain string from
  // a book loaded straight off disk and as a TOML date object from a parsed
  // fixture, so the day each file's own entries start on is keyed as text
  // either way before the two are compared.
  if (expected.bank) {
    const dateKey = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10));
    const firstDayOf = {};
    for (const transactions of Object.values(expected.bank)) {
      for (const tx of transactions) {
        const fileName = BANK_ACCOUNT_FILES[tx.account || "1200"];
        if (!fileName) continue;
        const key = dateKey(tx.date);
        if (!firstDayOf[fileName] || key < firstDayOf[fileName]) firstDayOf[fileName] = key;
      }
    }
    const movements = {};
    for (const fileName of Object.values(BANK_ACCOUNT_FILES)) {
      movements[fileName] = { opening: 0, receipts: 0, payments: 0 };
    }
    for (const transactions of Object.values(expected.bank)) {
      for (const tx of transactions) {
        const fileName = BANK_ACCOUNT_FILES[tx.account || "1200"];
        if (!fileName) continue;
        const movement = movements[fileName];
        if (tx.code === "BC" && dateKey(tx.date) === firstDayOf[fileName]) movement.opening += tx.amount;
        else if (tx.direction === "in") movement.receipts += tx.amount;
        else if (tx.direction === "out") movement.payments += tx.amount;
      }
    }
    for (const [fileName, movement] of Object.entries(movements)) {
      const closingKey = Object.keys(results).find((k) => k.startsWith(`${fileName}!`));
      if (!closingKey) continue;
      check(
        `${fileName}: closing balance = opening + receipts - payments`,
        num(results[closingKey].A2),
        movement.opening + movement.receipts - movement.payments,
      );
    }

    // TrialBalance echoes each bank workbook's closing balance across the
    // cross-file link (verified against the template: TrialBalance!EJ<n> =
    // -[<link>]<lastMonth>!$F$1-... cascaded from the workbook's own A2).
    // Tie each echo to the same scenario-derived movement the per-workbook
    // check above already computed, so a break in the OpenAccounts ->
    // TrialBalance link is caught at its own link rather than only showing
    // up downstream on the published balance sheet.
    if (results.TrialBalance) {
      const tb = results.TrialBalance;
      for (const [fileName, movement] of Object.entries(movements)) {
        const echoCell = TRIAL_BALANCE_BANK_ECHO_CELLS[fileName];
        check(
          `Trial Balance: ${fileName} closing balance echo (${echoCell})`,
          num(tb[echoCell]),
          movement.opening + movement.receipts - movement.payments,
        );
      }

      // PubBalSht!E12 "Cash at bank and in hand" reproduces the sheet's own
      // aggregation formula exactly (verified against the template: E12 =
      // IF(SUM(EJ22:EJ24)>0, SUM(EJ22:EJ24), 0)+EJ25+EJ26). The three
      // statement-book accounts (Current, Savings, Credit Card) count only
      // when they are in credit together, and Cash and the Intra Cash & Bank
      // Transfers row are added on top either way. EJ26 nets out any receipt
      // or payment analysed under another account's transfer code, so a
      // transfer between the company's own bank accounts never moves the
      // combined total, whether or not both legs were entered.
      const sumFirstThree = num(tb.EJ22) + num(tb.EJ23) + num(tb.EJ24);
      const expectedE12 = Math.max(sumFirstThree, 0) + num(tb.EJ25) + num(tb.EJ26);
      check("Published balance sheet: cash at bank = Trial Balance bank account aggregate", num(pubBalSht?.E12), expectedE12);
      // E19 "Bank Overdraft" carries the same three accounts when they are
      // overdrawn (E19 = IF(SUM(EJ22:EJ24)<0, -SUM(EJ22:EJ24), 0)), so an
      // overdraft leaves current assets and stands among the creditors.
      check(
        "Published balance sheet: bank overdraft = overdrawn Trial Balance statement accounts",
        num(pubBalSht?.E19),
        sumFirstThree < 0 ? -sumFirstThree : 0,
      );
    }
  }

  // ── Monthly P&L against the monthly Sales and Purchases totals ───────────
  //
  // Each month column reads one Sales.xlsx or Purchases.xlsx analysis column
  // through the trial balance. Both sides are net of VAT: the P&L holds the
  // workbook's own net figure, and the expectation converts the scenario's
  // gross amounts at the same rate the templates apply, summing the month
  // first and dividing once. Catches a month landing in the wrong column or
  // dropping out altogether.
  // The writer shifts every transaction date onto the package's month tabs, so
  // the expectation buckets by the shifted date the same way, or every month
  // reads as landing in the wrong column on a non-March year-end.
  const fiscalTabs =
    results.Admin && typeof results.Admin.B9 === "number" ? monthTabsFromPeriodStart(results.Admin.B9) : getMonthTabNames(3);
  const shiftedMonthlyBuckets = (journal) => {
    const targetStartMonth = SHORT_MONTHS.indexOf(fiscalTabs[0]);
    const monthOffset = (targetStartMonth - ((expected.period_start_month || 4) - 1) + 12) % 12;
    const buckets = Object.fromEntries(fiscalTabs.map((tab) => [tab, {}]));
    for (const txs of Object.values(journal)) {
      for (const tx of txs) {
        const shifted = shiftMonths(parseDate(tx.date), monthOffset);
        const bucket = buckets[SHORT_MONTHS[shifted.getUTCMonth()]];
        bucket[tx.code] = (bucket[tx.code] || 0) + tx.amount;
      }
    }
    return buckets;
  };
  if (expected.sales) {
    const buckets = shiftedMonthlyBuckets(expected.sales);
    fiscalTabs.forEach((tab, i) => {
      const col = MONTH_COLS[i];
      for (const [code, row] of Object.entries(SALES_MONTHLY_TIE_ROWS)) {
        check(`P&L ${tab} ${col}${row} = Sales.xlsx "${code}" net`, num(pl[`${col}${row}`]), netOfVat(buckets[tab][code] || 0, rate));
      }
      check(
        `P&L ${tab} ${col}${SALES_BAD_DEBT_ROW} = negated Sales.xlsx "o" net`,
        num(pl[`${col}${SALES_BAD_DEBT_ROW}`]),
        -netOfVat(buckets[tab].o || 0, rate),
      );
    });
  }
  if (expected.purchases) {
    const buckets = shiftedMonthlyBuckets(expected.purchases);
    fiscalTabs.forEach((tab, i) => {
      const col = MONTH_COLS[i];
      for (const [code, row] of Object.entries(PURCHASES_MONTHLY_TIE_ROWS)) {
        let expectedNet = netOfVat(buckets[tab][code] || 0, rate);
        if (code === "a") {
          expectedNet += netOfVat(buckets[tab][ENTERTAINMENT_CODE] || 0, rate);
          check(`P&L ${tab} ${col}${row} = Purchases.xlsx "a" and "e" net`, num(pl[`${col}${row}`]), expectedNet);
          continue;
        }
        check(`P&L ${tab} ${col}${row} = Purchases.xlsx "${code}" net`, num(pl[`${col}${row}`]), expectedNet);
      }
    });
  }

  // The same month columns against the leaf workbooks' own row 1 totals.
  // The checks above prove the scenario landed where it was meant to; these
  // prove the cross-file links carried each month's total into the right
  // column of the P&L, without going through the fixture at all.
  if (results.Admin && typeof results.Admin.B9 === "number") {
    monthTabsFromPeriodStart(results.Admin.B9).forEach((tab, i) => {
      const col = MONTH_COLS[i];
      const salesMonth = results[`Sales.xlsx!${tab}`];
      if (salesMonth) {
        check(
          `P&L ${tab} turnover = Sales.xlsx ${tab} net less bad debts and asset sales`,
          num(pl[`${col}${MONTHLY_TURNOVER_ROW}`]),
          num(salesMonth[SALES_MONTH_TOTAL_CELLS.net]) -
            num(salesMonth[SALES_MONTH_TOTAL_CELLS.badDebts]) -
            num(salesMonth[SALES_MONTH_TOTAL_CELLS.assetSales]),
        );
      }
      const purchasesMonth = results[`Purchases.xlsx!${tab}`];
      if (purchasesMonth) {
        const tiedRows = Object.values(PURCHASES_MONTHLY_TIE_ROWS).reduce((sum, row) => sum + num(pl[`${col}${row}`]), 0);
        check(
          `P&L ${tab} expense lines = Purchases.xlsx ${tab} net less materials, wages and asset purchases`,
          tiedRows,
          num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.net]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.materials]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.directorsWages]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.employeeWages]) -
            num(purchasesMonth[PURCHASES_MONTH_TOTAL_CELLS.assetPurchases]),
        );
      }
    });
  }

  return { fiscalTabs };
}
