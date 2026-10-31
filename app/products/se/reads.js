// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import {
  PAYE_SCHEDULE_MONTH_TAB_CELLS,
  PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES,
  PAYSLIP_PRINT_CELLS,
  PAYSLIP_PRINT_SHEET,
} from "../../lib/payslips-layout.js";
import { PAYSLIPS_AUG_BROUGHT_FORWARD_CELLS, PAYSLIPS_JUL_DEAD_CELLS, payslipsMonthEntryCells } from "../../lib/product-sheets/payslips.js";
import {
  SALESINVOICE_INVOICE_TEMPLATE_CELLS,
  SALESINVOICE_LINE1_CELLS,
  SALESINVOICE_PRODUCT_DETAILS_COLUMNS,
  SALESINVOICE_SAMPLE_PRODUCT_ROW,
} from "../../lib/product-sheets/salesinvoice.js";
import { VATINTERFACE_ROWS } from "../../lib/product-sheets/vat-chain.js";
import { MONTH_SHEETS } from "../../lib/scenario-loader.js";
import { CELL_MAP } from "./cell-map.js";
import { DISALLOWABLE_PERCENT_CELLS, MONTH_KEYS, STOCK_CLOSING_COUNT_CELL, STOCK_OPENING_COUNT_CELL, VAT_RATE_CELL } from "./layout.js";

// Additional reads from leaf files (Bank.xlsx and Cash.xlsx closing
// balances, Vat.xlsx quarterly returns, Fixedassets.xlsx Schedule and
// FAreconciliation totals). Results are keyed "<filename>!<sheetName>", so
// Bank.xlsx!Mar and Cash.xlsx!Mar stay distinct even though both files carry
// a "Mar" sheet.
export function multiFileOptions() {
  // Every VATQtr sheet shares the same box layout (verified against the
  // template): G5 quarter-end date, G7 payment-due date, G9 box 1/3 output
  // VAT, G11 EU acquisitions (always a static 0 -- no formula, never
  // generator-written), G13 box 3 total (=G9+G11), G15 box 4 input VAT
  // reclaimed, G17 box 5 net VAT due (=G13-G15), G23 box 7 net purchases
  // value. Qtr5 is the quarter after Qtr4, for a trader whose stagger runs
  // past the accounting year end.
  const vatQtrCells = ["G5", "G7", "G9", "G11", "G13", "G15", "G17", "G21", "G23"];
  const vatQtrReads = {};
  for (let q = 1; q <= 5; q++) vatQtrReads[`VATQtr${q}`] = vatQtrCells;

  // The interface rows themselves, so a break in the VAT chain names the
  // period and the side it happened on instead of only showing up as a wrong
  // box value.
  const vatinterfaceCells = [];
  for (let row = VATINTERFACE_ROWS.first; row <= VATINTERFACE_ROWS.last; row++) {
    for (const col of ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "M"]) vatinterfaceCells.push(`${col}${row}`);
  }
  vatQtrReads.Vatinterface = vatinterfaceCells;

  // Each month tab's own VAT and net totals, on both journals -- the leaf
  // figures the interface rows are measured against. H1 is the month's VAT
  // and I1 its net total on both the Sales and the Purchases tabs.
  const salesMonthReads = {};
  const purchasesMonthReads = {};
  for (const tab of Object.values(MONTH_SHEETS)) {
    // W1 is the month's own CIS suffered total (SUM(W5:W300)) and X1 the year
    // to date (Apr!X1 = W1, every later tab = W1 + the month before), which
    // is the figure Income Tax!E12 and SE Full!D231 read off Mar.
    salesMonthReads[tab] = ["H1", "I1", VAT_RATE_CELL, "W1", "X1"];
    // AD1 is the month's CIS certificates total (SUM(AD5:AD300)) and A1 the
    // sheet's own check total, G1 - H1 - SUM(P1:AB1), which is the closest
    // this product has to a trial balance: nil means every row's gross has
    // reached its VAT column and one expense column and nothing else.
    // Row 2 is the sheet's own mileage claim: C2 the business miles to date,
    // pooling this tab's own column D with the Sales month's D1; G2 the claim
    // the month adds, banded at the Admin rates; A2 the claim to date.
    purchasesMonthReads[tab] = ["A1", "A2", "C2", "G2", "H1", "I1", VAT_RATE_CELL, "AD1"];
  }

  // Payslips!Payment — the PAYE remittance schedule, one row per tax month
  // (rows 4-15 = Apr-Mar, same layout as Wagesinterface). B is the tax month
  // end and C the day the payment falls due, both off the payroll calendar;
  // D = NI due (employer + employee), E = income tax due, I = total amount
  // payable (verified against the template: B4=Admin!$B$26, C4=Admin!$B$45,
  // D4=Apr!T1+Apr!O1, E4=Apr!N1, I4=D4+E4-F4-G4+H4, with F/G/H always 0 in
  // this fixture -- no statutory pay or student loan data).
  const paymentCells = {};
  for (const row of WAGES_MONTH_ROWS) paymentCells[row] = ["B", "C", "D", "E", "I"].map((c) => `${c}${row}`);

  // Each month tab's own whole-month totals on row 1, which is what the
  // schedule row above reads it through. Jul and Aug carry more: their dead
  // cells and brought-forward cells (see PAYSLIPS_JUL_DEAD_CELLS and
  // PAYSLIPS_AUG_BROUGHT_FORWARD_CELLS above) plus the rows the fixture
  // populates, so a break in either area is caught on its own month instead
  // of only through the Payment/Admin aggregates.
  const payslipsMonthTabReads = {};
  for (const monthKey of MONTH_KEYS) payslipsMonthTabReads[MONTH_SHEETS[monthKey]] = [...Object.values(PAYE_SCHEDULE_MONTH_TAB_CELLS)];
  payslipsMonthTabReads[MONTH_SHEETS[MONTH_KEYS[PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[0]]]].push(
    ...PAYSLIPS_JUL_DEAD_CELLS,
    ...payslipsMonthEntryCells(PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[0]),
  );
  payslipsMonthTabReads[MONTH_SHEETS[MONTH_KEYS[PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[1]]]].push(
    ...PAYSLIPS_AUG_BROUGHT_FORWARD_CELLS,
    ...payslipsMonthEntryCells(PAYSLIPS_DIRECTLY_READ_MONTH_INDEXES[1]),
  );

  return {
    postHubRecalc: ["Vat.xlsx"],
    additionalReads: {
      "Bank.xlsx": { Mar: ["A1", "A2"] },
      "Cash.xlsx": { Mar: ["A1", "A2"] },
      // G1 = SUM(G5:G300), the total gross debtor/creditor value on each sheet.
      "Sales.xlsx": {
        OpeningDebtors: ["G1"],
        ClosingDebtors: ["G1"],
        ...salesMonthReads,
      },
      "Purchases.xlsx": {
        OpeningCreditors: ["G1"],
        ClosingCreditors: ["G1"],
        ...purchasesMonthReads,
      },
      "Vat.xlsx": vatQtrReads,
      "Fixedassets.xlsx": {
        // E57 and E110 are the schedule's own existing-asset and new-asset
        // cost subtotals; row 1 adds the two. Reading both lets the report
        // state the year's asset movement rather than one closing total.
        // AE1, AF1 and AG1 are the single asset pool totals; AH1 and AI1 the
        // pooled written-down value by rate pool, which the small pools test
        // now runs over per pool; M40, AD40, AE40 and AG40 are the fixture's
        // marked car row (van 38, estate car 39, hatchback 40), read so its
        // marker and private use share are proved on the row itself. B115 to
        // K116 are the fixture's two SBA claim rows; K120 and K121 the SBA
        // block's box 53 and box 53.1 totals.
        Schedule: [
          "E1",
          "F1",
          "G1",
          "I1",
          "J1",
          "K1",
          "Q1",
          "R1",
          "S1",
          "V1",
          "W1",
          "X1",
          "Y1",
          "Z1",
          "AC1",
          "AC4",
          "AE1",
          "AF1",
          "AG1",
          "AH1",
          "AI1",
          "E57",
          "E110",
          "M40",
          "AD40",
          "AE40",
          "AG40",
          "B115",
          "C115",
          "E115",
          "F115",
          "H115",
          "J115",
          "K115",
          "B116",
          "D116",
          "E116",
          "F116",
          "G116",
          "H116",
          "J116",
          "K116",
          "K120",
          "K121",
        ],
        FAreconciliation: ["E11", "E13", "E15", "K11", "K13", "K15"],
        // E2 is the long-term-creditors total for the "New Hire Purchase
        // Agreements" block (SUM(E8:E14)); I/J/K on rows 8 and 10 are the
        // two scenario agreements' own monthly payment, capital and
        // interest split.
        HPfinance: ["E2", "I8", "J8", "K8", "I10", "J10", "K10"],
      },
      "Payslips.xlsx": {
        ...payslipsMonthTabReads,
        Payment: Object.values(paymentCells).flat(),
        // The printed payslip. H3/H4 are the join itself; L7, I9 and I10 are
        // the block heading it lands on, and the rest is the first
        // employee's line and its year-to-date row.
        [PAYSLIP_PRINT_SHEET]: [
          PAYSLIP_PRINT_CELLS.tab,
          PAYSLIP_PRINT_CELLS.blockRow,
          "L7",
          "I9",
          "I10",
          "M8",
          "G14",
          "H14",
          "I14",
          "M14",
          "G16",
          "H16",
          "I16",
          "M16",
          "M18",
        ],
        // The payroll calendar the generator writes for the package's tax
        // year: B2 its seed date, I1 (=B366) the year it runs to, N1 the tax
        // year label the payslips print, and the name, date and month number
        // on each sampled row.
        Admin: ["B2", "I1", "N1", ...PAYROLL_CALENDAR_SAMPLE_ROWS.flatMap((row) => [`A${row}`, `B${row}`, `D${row}`])],
      },
      // The customer-facing invoice: the VAT rate the generator wrote into
      // the sample product row, and the one sample line's net, VAT and gross
      // (verified against the XML: P58 = SUM(P38:P57), P62 =
      // IF(P58<>0,SUM(V38:V57)+P60*'Product Details'!$D$2/100,0), P64 =
      // SUM(P58:Q62)).
      "Salesinvoice.xlsx": {
        "Product Details": [`${SALESINVOICE_PRODUCT_DETAILS_COLUMNS.vatRate}${SALESINVOICE_SAMPLE_PRODUCT_ROW}`],
        "Invoice Template": [
          SALESINVOICE_INVOICE_TEMPLATE_CELLS.netTotal,
          SALESINVOICE_INVOICE_TEMPLATE_CELLS.carriageNet,
          SALESINVOICE_INVOICE_TEMPLATE_CELLS.vatTotal,
          SALESINVOICE_INVOICE_TEMPLATE_CELLS.grossTotal,
          SALESINVOICE_LINE1_CELLS.unitPrice,
          SALESINVOICE_LINE1_CELLS.quantity,
          SALESINVOICE_LINE1_CELLS.lineNet,
          SALESINVOICE_LINE1_CELLS.lineVat,
        ],
      },
    },
  };
}

export const MONTH_COLS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

// P&L rows fed by a single Sales.xlsx/Purchases.xlsx code column with no
// other adjustment mixed in (verified against the template's per-month
// formulas), keyed by the scenario transaction code letter. Materials
// (P&L row 14) also carries a StockControl adjustment and Wages (row 21)
// also carries a Wagesinterface payroll addback, so neither ties 1:1 to a
// single month's code total and both are left out here.
export const SALES_MONTHLY_TIE_ROWS = { a: 5, b: 6, c: 7, d: 8, g: 11 };

// Sales code "o" ("Other") feeds P&L row 29 ("Bad Debts written off")
// negated -- a template quirk, not a naming error; verified against the
// formula (`C29 = -[2]Apr!$U$1`).
export const SALES_BAD_DEBT_ROW = 29;

// Row 27 combines codes a (advertising) and e (business entertainment) -- box
// 24's own caption -- so both places below that read this map special-case
// code a to add code e's figure, rather than the map carrying two codes on
// one row.
export const PURCHASES_MONTHLY_TIE_ROWS = { c: 15, o: 16, p: 22, m: 23, g: 24, v: 25, h: 26, a: 27, l: 28, y: 32, e: 49 };

// The P&L's own caption for each tied row, taken from column A of the
// template. The netting table names a category the way the statement it
// feeds names it, so a reader can follow the letter to the line.
export const PL_ROW_CAPTIONS = {
  5: "Sales Product A",
  6: "Sales Product B",
  7: "Sales Product C",
  8: "Other Income",
  11: "Investment Grants received",
  14: "Purchases after stock adjustment",
  15: "Sub contractors",
  16: "Other Direct Cost of Sales",
  22: "Premises Rent Rates Power",
  23: "Repairs & Maintenance",
  24: "General Administrative Expenses",
  25: "Motor Expenses",
  26: "Travel Hotel & Subsistence",
  27: "Advertising Promotion & Entertainment",
  28: "Legal & Professional Fees",
  29: "Bad Debts written off",
  32: "Other Expenses",
  49: "Business Entertainment (memo)",
};

// Wagesinterface and Payslips!Payment both hold one row per month, Apr at
// row 4 through Mar at row 15 — verified against the template. SE always
// runs a 6 April year-end, so this row order matches MONTH_KEYS directly
// with no year-end shift (unlike Ltd, which has to remap via fiscalTabs).
export const WAGES_MONTH_ROWS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// Payslips.xlsx!Admin holds a day-by-day payroll calendar: column A the
// payroll month's name, B the date, C the week number, D the payroll month
// number and F the week within that month. Row 2 is the first day of the tax
// year and the sheet runs to row 381. These rows sample it -- one inside each
// of the twelve payroll months, then the last day of the tax year (366) and
// the last row on the sheet. Nothing about a check depends on which month a
// sampled row falls in: each one reads the month number off the sheet itself.
export const PAYROLL_CALENDAR_SAMPLE_ROWS = [2, 33, 64, 95, 126, 157, 188, 219, 250, 281, 312, 343, 366, 381];

// The month names the payroll calendar's own formula produces
// (TEXT(DATE(...),"Mmm") on the tax year start plus the month number).
export const SHORT_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function standardReads() {
  const reads = {};
  for (const [sheet, cell] of CELL_MAP) {
    if (!reads[sheet]) reads[sheet] = [];
    if (!reads[sheet].includes(cell)) reads[sheet].push(cell);
  }
  const plRows = [
    ...new Set([
      ...Object.values(SALES_MONTHLY_TIE_ROWS),
      SALES_BAD_DEBT_ROW,
      ...Object.values(PURCHASES_MONTHLY_TIE_ROWS),
      33,
      34,
      // The Profit Forecast repeats the P&L's own monthly turnover (row 9)
      // and interest received (row 38), so the forecast checks can count the
      // months that traded and tie the projected year to the actual one.
      9,
      38,
      // Materials after the stock adjustment, wages and staff costs, bank
      // interest paid and finance charges: the only rows an ITSA quarterly
      // update needs a monthly split for that the netting table above does
      // not already carry (row 14 mixes a stock movement into its own
      // closing-month cell, row 21 mixes a payroll addback, and rows 30/31
      // come off the bank books rather than a purchases analysis column).
      14,
      21,
      30,
      31,
    ]),
  ];
  reads["Profit & Loss Account"] = reads["Profit & Loss Account"] || [];
  for (const row of plRows) {
    // Column B is the row's own SUM(C:N), the annual figure the netting
    // table compares a journal category against.
    for (const col of ["B", ...MONTH_COLS]) {
      const cell = `${col}${row}`;
      if (!reads["Profit & Loss Account"].includes(cell)) reads["Profit & Loss Account"].push(cell);
    }
  }

  // Wagesinterface — one row per month (rows 4-15 = Apr-Mar), columns
  // C=gross pay, D=PAYE income tax, E=employee NI, H=employer NI (verified
  // against the template: C4=[6]Apr!$M$1, D4=$N$1, E4=$O$1, H4=$T$1). CELL_MAP
  // above already carries C4-C15 for the report; the rest are read here so
  // every month is available to check without bloating the report appendix.
  reads.StockControl = [STOCK_OPENING_COUNT_CELL, STOCK_CLOSING_COUNT_CELL];

  // SE Full cells the return quotes without them being boxes of their own,
  // plus the boxes it prints with no formula behind them. The quoted cells
  // are the online filing deadline banner (G1, "...by 31st January "&TEXT
  // (Admin!B21,"yyyy")), the period the return covers (Q2 = Admin!B4, V2 =
  // Admin!B17) and the writing down rate and Class 4 threshold it prints in
  // its captions (G141 = Admin!G5, J280 = Admin!N20).
  reads["SE Full"] = reads["SE Full"] || [];
  for (const cell of ["G1", "Q2", "V2", "G141", "J280"]) {
    if (!reads["SE Full"].includes(cell)) reads["SE Full"].push(cell);
  }

  // Boxes 32 to 45, the cells box 46 (O122) totals. VitalTax's disallowable
  // percentages give each one a source; reading them lets the box 46 total
  // be checked as the exact sum the sheet computes rather than a sum with
  // terms left out.
  for (const cell of ["O66", "O70", "O74", "O78", "O82", "O86", "O90", "O94", "O98", "O102", "O106", "O110", "O118"]) {
    if (!reads["SE Full"].includes(cell)) reads["SE Full"].push(cell);
  }

  // VitalTax column I, the percentage per category behind the boxes just
  // above, and Profit & Loss Account row 49, the business entertainment
  // memo behind box 39's share of box 24. Neither is a box or a CELL_MAP
  // row of its own, so nothing else in this file reads them; the page's
  // disallowable-expenses memo (products/se.js on the DIYA-GL page) is the
  // only consumer.
  reads.VitalTax = reads.VitalTax || [];
  for (const cell of Object.values(DISALLOWABLE_PERCENT_CELLS)) {
    if (!reads.VitalTax.includes(cell)) reads.VitalTax.push(cell);
  }
  for (const cell of ["B49", ...MONTH_COLS.map((col) => `${col}49`)]) {
    if (!reads["Profit & Loss Account"].includes(cell)) reads["Profit & Loss Account"].push(cell);
  }

  // The Admin sheet's tax year start, end and filing deadline. Everything
  // else the Admin echo checks compares is a rate or a threshold already in
  // CELL_MAP; these are dates, and they anchor the SA103F period, the online
  // filing deadline banner and the payroll calendar.
  reads.Admin = reads.Admin || [];
  for (const cell of ["B4", "B17", "B21"]) if (!reads.Admin.includes(cell)) reads.Admin.push(cell);

  reads.Wagesinterface = reads.Wagesinterface || [];
  for (let i = 0; i < WAGES_MONTH_ROWS.length; i++) {
    for (const col of ["C", "D", "E", "H"]) {
      const cell = `${col}${WAGES_MONTH_ROWS[i]}`;
      if (!reads.Wagesinterface.includes(cell)) reads.Wagesinterface.push(cell);
    }
  }

  return reads;
}
