// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { toExcelSerial } from "../spreadsheet-runner.js";
import { parseDate } from "../scenario-loader.js";
import { vatCycleRows, vatReturnCoverage } from "../report-generator.js";
import { fmt } from "./format.js";
import { formatSerialDate, periodEnding } from "./serial-dates.js";
import { netOfVat } from "./vat-rate.js";

// ── Vatinterface layout ────────────────────────────────────────────────────
// One row per VAT period, in date order. Rows 6-17 are the twelve accounting
// months in period order. Rows 4 and 5 are the two VAT periods before the
// accounting year, rows 18 to 20 the three after it; each is fed by its own
// S/P entry sheet rather than by a month tab. Column B is the period end date
// every VATQtr sheet looks up on, C the payment due date, D/F the period's
// sales net and output VAT, H/J its purchases net and input VAT, and E/G/I/K
// the rolling three-row sums the VAT boxes read. M carries the flat-rate flag
// box 6 switches on.
export const VATINTERFACE_ROWS = { first: 4, last: 20, firstMonth: 6 };

// Straddling VAT period name to the Vatinterface row it feeds, and to the
// pair of entry sheets it is entered on (S<period> and P<period>).
export const STRADDLING_PERIOD_ROWS = { "02Y1": 4, "03Y1": 5, "04Y2": 18, "05Y2": 19, "06Y2": 20 };

// A business that is not registered for VAT turns the rate off on the first
// month's Sales tab, and the rest of the book follows that cell.
export function writeVatRateCell(salesWrites, firstTab, rateCell, rate) {
  if (!salesWrites[firstTab]) salesWrites[firstTab] = {};
  salesWrites[firstTab][rateCell] = rate * 100;
}

// layout names what differs between the products' VAT workbooks:
//   workbook     the VAT workbook's file name
//   monthTabs    (results) => the month tab names, in accounting-year order
//   salesNetCell, salesVatCell, purchasesNetCell, purchasesVatCell
//                the cells of a month tab that hold its net and VAT totals

// Straddling VAT periods: entries on the S<period> and P<period> entry sheets.
export function writeStraddlingPeriod(vatReturnWrites, entries, sheetPrefix, nameField, columns, { workbook, shiftDate }) {
  for (const entry of entries) {
    if (!STRADDLING_PERIOD_ROWS[entry.period]) {
      throw new Error(`Straddling VAT entry names period "${entry.period}", which ${workbook} has no sheet for`);
    }
    const sheetName = `${sheetPrefix}${entry.period}`;
    if (!vatReturnWrites[sheetName]) vatReturnWrites[sheetName] = {};
    const sheet = vatReturnWrites[sheetName];
    // Matching the whole reference rather than its first letter keeps a
    // write further right (AD, say) out of the count of rows already there.
    const amountColumnKey = new RegExp(`^${columns.amount}\\d+$`);
    const entryRow = Object.keys(sheet).filter((k) => amountColumnKey.test(k)).length + 5;
    const d = shiftDate(parseDate(entry.date));
    sheet[`${columns.date}${entryRow}`] = toExcelSerial(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    if (entry[nameField]) sheet[`${columns.name}${entryRow}`] = entry[nameField];
    if (entry.invoice) sheet[`${columns.invoice}${entryRow}`] = entry.invoice;
    if (entry.description && columns.description) sheet[`${columns.description}${entryRow}`] = entry.description;
    sheet[`${columns.amount}${entryRow}`] = entry.amount;
  }
}

// The VAT the books actually charged, taken from the month tabs and from the
// return itself. Every other statement in this report is stated net, so a
// registered trader and an unregistered one carrying the same trade read
// identically without it.
export function vatSection(results, layout) {
  const { workbook, salesVatCell, salesNetCell, purchasesVatCell, purchasesNetCell } = layout;
  const tabs = layout.monthTabs(results).filter((tab) => results[`Sales.xlsx!${tab}`] || results[`Purchases.xlsx!${tab}`]);
  const months = tabs.map((tab) => [results[`Sales.xlsx!${tab}`], results[`Purchases.xlsx!${tab}`]]);
  if (months.length === 0) return null;
  const monthCells = (file, ...refs) => tabs.flatMap((tab) => refs.map((ref) => `${file}!${tab}!${ref}`));

  const num = (v) => (typeof v === "number" ? v : 0);
  const sum = (side, cell) => months.reduce((total, pair) => total + num(pair[side]?.[cell]), 0);
  const salesVat = sum(0, salesVatCell);
  const salesNet = sum(0, salesNetCell);
  const purchasesVat = sum(1, purchasesVatCell);
  const purchasesNet = sum(1, purchasesNetCell);

  const rows = [
    {
      label: "Sales invoiced including VAT",
      value: fmt(salesNet + salesVat),
      indent: 1,
      cells: monthCells("Sales.xlsx", salesVatCell, salesNetCell),
    },
    { label: "VAT charged on sales", value: fmt(salesVat), indent: 1, cells: monthCells("Sales.xlsx", salesVatCell) },
    { label: "Sales net of VAT", value: fmt(salesNet), indent: 1, cells: monthCells("Sales.xlsx", salesNetCell) },
    {
      label: "Purchases invoiced including VAT",
      value: fmt(purchasesNet + purchasesVat),
      indent: 1,
      cells: monthCells("Purchases.xlsx", purchasesVatCell, purchasesNetCell),
    },
    { label: "VAT reclaimed on purchases", value: fmt(purchasesVat), indent: 1, cells: monthCells("Purchases.xlsx", purchasesVatCell) },
    { label: "Purchases net of VAT", value: fmt(purchasesNet), indent: 1, cells: monthCells("Purchases.xlsx", purchasesNetCell) },
    {
      label: "**VAT due for the year**",
      value: fmt(salesVat - purchasesVat),
      indent: 0,
      cells: [...monthCells("Sales.xlsx", salesVatCell), ...monthCells("Purchases.xlsx", purchasesVatCell)],
    },
  ];
  // The package ships five return forms: four quarters from the VAT start
  // month and one more, for a business whose quarter stagger does not line up
  // with those four. Printing four left the fifth out of the report
  // altogether. Each form carries the period it was filled in for, and the
  // cycle rows above the boxes say which months each one reaches.
  const forms = [];
  const quarterRows = [];
  for (let q = 1; q <= 5; q++) {
    const boxes = results[`${workbook}!VATQtr${q}`];
    if (!boxes) continue;
    const end = num(boxes.G5);
    forms.push({ name: `Q${q}`, end: vatinterfaceRowEnding(results, end, layout) });
    const period = periodEnding(end);
    const form = `${workbook}!VATQtr${q}`;
    quarterRows.push({ label: `Q${q}${period} box 1: VAT due on sales`, value: fmt(num(boxes.G9)), indent: 1, cells: [`${form}!G9`] });
    quarterRows.push({
      label: `Q${q}${period} box 4: VAT reclaimed on purchases`,
      value: fmt(num(boxes.G15)),
      indent: 1,
      cells: [`${form}!G15`],
    });
    quarterRows.push({ label: `Q${q}${period} box 5: net VAT due`, value: fmt(num(boxes.G17)), indent: 1, cells: [`${form}!G17`] });
  }
  if (quarterRows.length > 0) {
    rows.push(...vatCycleRows(vatinterfacePeriods(results, layout), forms));
    rows.push({ label: "**The return forms as the package fills them in**", value: "" });
    rows.push(...quarterRows);
  }
  return { title: "VAT Returns", rows };
}

// The VAT periods the interface carries, one per row, with the VAT on each
// side and whether the period is one of the twelve accounting months.
export function vatinterfacePeriods(results, layout) {
  const vatinterface = results[`${layout.workbook}!Vatinterface`];
  if (!vatinterface) return [];
  const num = (v) => (typeof v === "number" ? v : 0);
  const periods = [];
  for (let row = VATINTERFACE_ROWS.first; row <= VATINTERFACE_ROWS.last; row++) {
    const end = num(vatinterface[`B${row}`]);
    if (!end) continue;
    periods.push({
      row,
      endLabel: formatSerialDate(end),
      outputVat: num(vatinterface[`F${row}`]),
      inputVat: num(vatinterface[`J${row}`]),
      inAccountingYear: row >= VATINTERFACE_ROWS.firstMonth && row < VATINTERFACE_ROWS.firstMonth + 12,
      cells: {
        end: `${layout.workbook}!Vatinterface!B${row}`,
        output: `${layout.workbook}!Vatinterface!F${row}`,
        input: `${layout.workbook}!Vatinterface!J${row}`,
      },
    });
  }
  return periods;
}

// The interface row a return form's own period end date lands on, or null
// when the form names a date the interface does not carry.
export function vatinterfaceRowEnding(results, end, layout) {
  const vatinterface = results[`${layout.workbook}!Vatinterface`];
  if (!vatinterface || !end) return null;
  for (let row = VATINTERFACE_ROWS.first; row <= VATINTERFACE_ROWS.last; row++) {
    if (Math.round(typeof vatinterface[`B${row}`] === "number" ? vatinterface[`B${row}`] : 0) === Math.round(end)) return row;
  }
  return null;
}

// The Vatinterface and the five return forms against the month tabs and
// straddling entry sheets that feed them.
export function checkVatChain({ check, num, rate }, results, expected, layout) {
  // ── Vatinterface: where in the VAT chain a break happened ────────────────
  //
  // The box checks above catch a break; these say where it is. Each interface
  // row is compared against the leaf workbook or the straddling entry sheet
  // that feeds it, each quarter column against the three period rows it sums,
  // and each VAT box against the interface row its LOOKUP lands on. A month
  // link that stops carrying fails on that month and side alone.
  const vatinterface = results[`${layout.workbook}!Vatinterface`];
  if (vatinterface) {
    layout.monthTabs(results).forEach((tab, i) => {
      const row = VATINTERFACE_ROWS.firstMonth + i;
      const salesMonth = results[`Sales.xlsx!${tab}`];
      const purchasesMonth = results[`Purchases.xlsx!${tab}`];
      if (salesMonth) {
        check(
          `Vatinterface D${row}: ${tab} sales net = Sales.xlsx ${tab}`,
          num(vatinterface[`D${row}`]),
          num(salesMonth[layout.salesNetCell]),
        );
        check(
          `Vatinterface F${row}: ${tab} output VAT = Sales.xlsx ${tab}`,
          num(vatinterface[`F${row}`]),
          num(salesMonth[layout.salesVatCell]),
        );
      }
      if (purchasesMonth) {
        check(
          `Vatinterface H${row}: ${tab} purchases net = Purchases.xlsx ${tab}`,
          num(vatinterface[`H${row}`]),
          num(purchasesMonth[layout.purchasesNetCell]),
        );
        check(
          `Vatinterface J${row}: ${tab} input VAT = Purchases.xlsx ${tab}`,
          num(vatinterface[`J${row}`]),
          num(purchasesMonth[layout.purchasesVatCell]),
        );
      }
    });

    // The straddling periods, anchored in the entries the scenario put on
    // their own sheets. The sheets compute VAT from the gross figure at the
    // standard rate, so the expectation splits the same gross the same way.
    const straddlingGross = (entries) => {
      const byPeriod = {};
      for (const entry of entries || []) byPeriod[entry.period] = (byPeriod[entry.period] || 0) + entry.amount;
      return byPeriod;
    };
    const straddlingSales = straddlingGross(expected.vat_straddling_sales);
    const straddlingPurchases = straddlingGross(expected.vat_straddling_purchases);
    if (expected.vat_straddling_sales || expected.vat_straddling_purchases) {
      for (const [period, row] of Object.entries(STRADDLING_PERIOD_ROWS)) {
        const salesGross = straddlingSales[period] || 0;
        const purchasesGross = straddlingPurchases[period] || 0;
        check(
          `Vatinterface D${row}: ${period} sales net = the straddling sales entered for that period`,
          num(vatinterface[`D${row}`]),
          netOfVat(salesGross, rate),
        );
        check(
          `Vatinterface F${row}: ${period} output VAT = the straddling sales entered for that period`,
          num(vatinterface[`F${row}`]),
          salesGross - netOfVat(salesGross, rate),
        );
        check(
          `Vatinterface H${row}: ${period} purchases net = the straddling purchases entered for that period`,
          num(vatinterface[`H${row}`]),
          netOfVat(purchasesGross, rate),
        );
        check(
          `Vatinterface J${row}: ${period} input VAT = the straddling purchases entered for that period`,
          num(vatinterface[`J${row}`]),
          purchasesGross - netOfVat(purchasesGross, rate),
        );
      }
    }

    const quarterColumns = [
      ["E", "D", "sales net"],
      ["G", "F", "output VAT"],
      ["I", "H", "purchases net"],
      ["K", "J", "input VAT"],
    ];
    for (let q = 1; q <= 5; q++) {
      const qtr = results[`${layout.workbook}!VATQtr${q}`];
      if (!qtr || typeof qtr.G5 !== "number") continue;
      let row = null;
      for (let r = VATINTERFACE_ROWS.first; r <= VATINTERFACE_ROWS.last; r++) {
        if (Math.round(num(vatinterface[`B${r}`])) === Math.round(qtr.G5)) row = r;
      }
      check(`VAT Q${q}: quarter end date is one of the Vatinterface periods`, row === null ? 0 : 1, 1, 0);
      if (row === null) continue;

      if (row - 2 >= VATINTERFACE_ROWS.first) {
        for (const [total, period, label] of quarterColumns) {
          check(
            `Vatinterface ${total}${row}: quarter ${label} = its three period rows`,
            num(vatinterface[`${total}${row}`]),
            num(vatinterface[`${period}${row - 2}`]) + num(vatinterface[`${period}${row - 1}`]) + num(vatinterface[`${period}${row}`]),
          );
        }
      }

      check(`VAT Q${q}: box 1 (G9) = Vatinterface quarter VAT due (G${row})`, num(qtr.G9), num(vatinterface[`G${row}`]));
      check(`VAT Q${q}: box 4 (G15) = Vatinterface quarter VAT reclaimed (K${row})`, num(qtr.G15), num(vatinterface[`K${row}`]));
      check(`VAT Q${q}: box 7 (G23) = Vatinterface quarter purchases net (I${row})`, num(qtr.G23), num(vatinterface[`I${row}`]));
      // Box 6 is sales net of VAT, or sales including VAT when the flat rate
      // scheme flag in column M is set.
      const flatRate = num(vatinterface[`M${row}`]) > 0;
      check(
        `VAT Q${q}: box 6 (G21) = Vatinterface quarter sales ${flatRate ? "including" : "net of"} VAT`,
        num(qtr.G21),
        num(vatinterface[`E${row}`]) + (flatRate ? num(vatinterface[`G${row}`]) : 0),
      );
      check(
        `VAT Q${q}: payment due date (G7) = Vatinterface final date for payment (C${row})`,
        num(qtr.G7),
        num(vatinterface[`C${row}`]),
        0,
      );
    }

    // ── The five return forms as one cycle ────────────────────────
    //
    // Each form's own date decides which three interface rows it declares, so
    // the five together are checked as a cycle: distinct periods, each a
    // quarter after the one before it, Q1 to Q4 covering the twelve accounting
    // months once each, and the fifth on the last period the interface
    // carries.
    const periods = vatinterfacePeriods(results, layout);
    const returnForms = [];
    for (let q = 1; q <= 5; q++) {
      const qtr = results[`${layout.workbook}!VATQtr${q}`];
      if (qtr && typeof qtr.G5 === "number") returnForms.push({ name: `Q${q}`, end: vatinterfaceRowEnding(results, qtr.G5, layout) });
    }
    const coverage = vatReturnCoverage(periods, returnForms);
    if (coverage.placed.length === 5) {
      const [q1, q2, q3, q4, q5] = coverage.placed;
      check("VAT: the five returns end on five different periods", new Set(coverage.placed.map((form) => form.row)).size, 5, 0);
      for (const [earlier, later] of [
        [q1, q2],
        [q2, q3],
        [q3, q4],
        [q4, q5],
      ]) {
        check(`VAT: ${later.name} ends a quarter after ${earlier.name}`, later.row - earlier.row, 3, 0);
      }
      const quarterlyRows = new Set([q1, q2, q3, q4].flatMap((form) => form.covers));
      check(
        "VAT: Q1-Q4 cover every month of the accounting year",
        periods.filter((period) => period.inAccountingYear && quarterlyRows.has(period.row)).length,
        periods.filter((period) => period.inAccountingYear).length,
        0,
      );
      check("VAT: Q5 ends on the last period the Vatinterface carries", q5.row, VATINTERFACE_ROWS.last, 0);

      // Five consecutive quarters need fifteen periods and the interface
      // carries seventeen, so no two returns reach the same one. A period
      // declared twice would be filed twice, so it fails rather than warns,
      // and the output VAT on it says what the second filing would repeat.
      check("VAT: periods more than one of the five returns declares", coverage.shared.length, 0, 0);
      check(
        "VAT: output VAT declared on more than one of the five returns",
        coverage.shared.reduce((total, period) => total + period.outputVat, 0),
        0,
        0,
      );
    }
  }
}
