// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// vat-return.js — the nine VAT boxes for one obligation period, read from the
// Ltd engine's own Vatreturns.xlsx!Vatinterface results, with HMRC's field
// names, HMRC's rounding, and the journal lines that fed each box. Nothing
// here computes VAT the engine has not already computed: the boxes are the
// interface's quarter columns, and the lines are attributed with the same
// split the journal rows use, then reconciled against those columns.

import { calculateFromDiyaGl } from "../diya-gl-calculator.js";
import { diyaGlToScenario } from "../diya-gl-loader.js";
import { loadTaxDataForBook, productOf } from "../product-workbook.js";
import { isStraddlingLine, LTD_PURCHASE_CODE_MAP, LTD_SALES_CODE_MAP } from "../scenario-extractor.js";
import { dateFromExcelSerial } from "../calculators/shared.js";
import { VAT_RATE } from "../calculators/ltd.js";
import { splitVat, VATINTERFACE_FIRST_MONTH_ROW, VATINTERFACE_FIRST_ROW, VATINTERFACE_LAST_ROW } from "../tax/vat.js";

const INTERFACE_SHEET = "Vatreturns.xlsx!Vatinterface";
const MONTHS_IN_QUARTER = 3;

/**
 * The ISO day an Excel serial names.
 * @param {number} serial
 * @returns {string}
 */
export function isoFromSerial(serial) {
  return dateFromExcelSerial(serial).toISOString().slice(0, 10);
}

function isoDate(value) {
  if (value === undefined || value === null) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function firstOfMonthsBefore(isoMonthEnd, monthsBefore) {
  const [year, month] = isoMonthEnd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 - monthsBefore, 1)).toISOString().slice(0, 10);
}

function monthKey(isoDay) {
  return isoDay.slice(0, 7);
}

function pence(value) {
  return Math.round(value * 100) / 100;
}

function pounds(value) {
  return Math.round(value);
}

function splitGross(gross) {
  return splitVat(gross, VAT_RATE);
}

/**
 * The interface rows the engine built for a book: one per period end, with
 * the month figures and, from the first accounting month on, the quarter sums
 * the return boxes read.
 * @param {Object} results - calculateFromDiyaGl() output for a Company (ltd) book
 * @returns {Array<{row: number, periodEnd: string, dueDate: string, month: Object, quarter: Object|null, flatRate: number}>}
 */
export function interfaceRows(results) {
  const sheet = results[INTERFACE_SHEET];
  if (!sheet) throw new Error("The book's product carries no VAT interface; only a Company (ltd) book answers a VAT return");
  const rows = [];
  for (let row = VATINTERFACE_FIRST_ROW; row <= VATINTERFACE_LAST_ROW; row++) {
    const hasQuarter = row >= VATINTERFACE_FIRST_MONTH_ROW;
    rows.push({
      row,
      periodEnd: isoFromSerial(sheet[`B${row}`]),
      dueDate: isoFromSerial(sheet[`C${row}`]),
      month: {
        salesNet: sheet[`D${row}`] || 0,
        salesVat: sheet[`F${row}`] || 0,
        purchasesNet: sheet[`H${row}`] || 0,
        purchasesVat: sheet[`J${row}`] || 0,
      },
      quarter: hasQuarter
        ? {
            salesNet: sheet[`E${row}`] || 0,
            salesVat: sheet[`G${row}`] || 0,
            purchasesNet: sheet[`I${row}`] || 0,
            purchasesVat: sheet[`K${row}`] || 0,
          }
        : null,
      flatRate: sheet[`M${row}`] || 0,
    });
  }
  return rows;
}

function lineContribution(line, box) {
  const { vat, net } = splitGross(line.amount);
  return {
    entryNumber: line.entryNumber,
    lineNumber: line.lineNumber ?? null,
    date: line.postingDate,
    account: line.accountMainID,
    reference: line.documentReference ?? null,
    counterparty: line.detailComment ?? null,
    gross: pence(line.amount),
    contributes: pence(box === "vat" ? vat : net),
  };
}

// The journal lines behind one quarter, bucketed the way the engine's month
// tabs and straddling sheets take them: a line without diya-gl:vatPeriodEnd
// lands on the month its postingDate names; a line with it lands on the
// interface row carrying that period end.
function linesForQuarter(lines, quarterRows) {
  const monthEnds = new Set(quarterRows.map((r) => r.periodEnd));
  const months = new Set(quarterRows.map((r) => monthKey(r.periodEnd)));
  const inQuarter = (line) => {
    if (isStraddlingLine(line)) return monthEnds.has(isoDate(line["diya-gl:vatPeriodEnd"]));
    return months.has(monthKey(line.postingDate));
  };
  const sales = lines.filter((l) => l.sourceJournalID === "sales" && LTD_SALES_CODE_MAP[l.accountMainID] && inQuarter(l));
  const purchases = lines.filter((l) => l.sourceJournalID === "purchases" && LTD_PURCHASE_CODE_MAP[l.accountMainID] && inQuarter(l));
  return { sales, purchases };
}

function sumContributions(lines, part) {
  return lines.reduce((total, line) => total + splitGross(line.amount)[part], 0);
}

function reconcile(label, attributed, engine) {
  if (Math.abs(attributed - engine) > 0.005) {
    throw new Error(
      `The lines attributed to ${label} sum to ${pence(attributed)} but the book's VAT interface carries ${pence(engine)}; ` +
        "a line is dated outside the accounting year or posts to a month the interface does not carry, so this return cannot be derived",
    );
  }
}

/**
 * The nine VAT return boxes for the quarter ending on periodEnd, from a
 * Company (ltd) book that declares itself VAT registered.
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {{periodEnd: string, periodStart?: string, periodKey?: string}} params - periodEnd is the
 *   obligation's period end (YYYY-MM-DD); periodStart, when given, must open that quarter; periodKey is
 *   echoed back untouched
 * @returns {Promise<Object>} { vatRegistrationNumber, periodKey, periodStart, periodEnd, dueDate, scheme,
 *   months, boxes, hmrc, lines, notes }
 */
export async function deriveVatReturn(book, lines, { periodEnd, periodStart, periodKey } = {}) {
  if (!book || !lines) throw new Error("deriveVatReturn requires a book and its lines");
  if (!periodEnd) throw new Error("deriveVatReturn requires periodEnd (the obligation's period end, YYYY-MM-DD)");
  const entity = book.entityInformation ?? {};
  if (entity["diya-gl:vatRegistered"] !== true) {
    throw new Error(
      "The book does not declare the company VAT registered (entityInformation diya-gl:vatRegistered), so it carries no VAT return",
    );
  }

  const product = productOf(book);
  const taxData = await loadTaxDataForBook(book);
  const results = calculateFromDiyaGl(book, lines, product, taxData, diyaGlToScenario(book, lines, product));
  const rows = interfaceRows(results);
  const wantedEnd = isoDate(periodEnd);
  const index = rows.findIndex((r) => r.periodEnd === wantedEnd);
  if (index < 0) {
    throw new Error(
      `The book carries no VAT period ending ${wantedEnd}; it answers periods ending ${rows.map((r) => r.periodEnd).join(", ")}`,
    );
  }
  const row = rows[index];
  if (!row.quarter) {
    throw new Error(
      `The period ending ${wantedEnd} is before the book's accounting year; the earliest quarter this book answers ends ${rows[VATINTERFACE_FIRST_MONTH_ROW - VATINTERFACE_FIRST_ROW].periodEnd}`,
    );
  }
  const expectedStart = firstOfMonthsBefore(wantedEnd, MONTHS_IN_QUARTER - 1);
  if (periodStart && isoDate(periodStart) !== expectedStart) {
    throw new Error(
      `The book answers three-month periods ending on a month end; ${isoDate(periodStart)} to ${wantedEnd} is not one, the quarter ending ${wantedEnd} starts ${expectedStart}`,
    );
  }

  const quarterRows = rows.slice(index - (MONTHS_IN_QUARTER - 1), index + 1);
  const { sales, purchases } = linesForQuarter(lines, quarterRows);
  reconcile("box 1", sumContributions(sales, "vat"), row.quarter.salesVat);
  reconcile("box 4", sumContributions(purchases, "vat"), row.quarter.purchasesVat);
  reconcile("box 6", sumContributions(sales, "net"), row.quarter.salesNet);
  reconcile("box 7", sumContributions(purchases, "net"), row.quarter.purchasesNet);

  const flatRate = row.flatRate > 0;
  const box1 = pence(row.quarter.salesVat);
  const box2 = 0;
  const box3 = pence(box1 + box2);
  const box4 = pence(row.quarter.purchasesVat);
  const box5 = pence(box3 - box4);
  const box6 = pounds(row.quarter.salesNet + (flatRate ? row.quarter.salesVat : 0));
  const box7 = pounds(row.quarter.purchasesNet);
  const box8 = 0;
  const box9 = 0;

  return {
    vatRegistrationNumber: entity["diya-gl:vatNumber"] ?? null,
    periodKey: periodKey ?? null,
    periodStart: expectedStart,
    periodEnd: wantedEnd,
    dueDate: row.dueDate,
    scheme: flatRate ? "flat-rate" : "standard",
    months: quarterRows.map((r) => ({
      periodEnd: r.periodEnd,
      salesNet: pence(r.month.salesNet),
      salesVat: pence(r.month.salesVat),
      purchasesNet: pence(r.month.purchasesNet),
      purchasesVat: pence(r.month.purchasesVat),
    })),
    boxes: { box1, box2, box3, box4, box5, box6, box7, box8, box9 },
    hmrc: {
      vatDueSales: box1,
      vatDueAcquisitions: box2,
      totalVatDue: box3,
      vatReclaimedCurrPeriod: box4,
      netVatDue: box5,
      totalValueSalesExVAT: box6,
      totalValuePurchasesExVAT: box7,
      totalValueGoodsSuppliedExVAT: box8,
      totalAcquisitionsExVAT: box9,
    },
    lines: {
      box1: sales.map((l) => lineContribution(l, "vat")),
      box4: purchases.map((l) => lineContribution(l, "vat")),
      box6: sales.map((l) => lineContribution(l, "net")),
      box7: purchases.map((l) => lineContribution(l, "net")),
    },
    notes: [
      `The engine applies ${VAT_RATE * 100}% to every sales and purchases journal line; the lines' own taxCode and taxRate are not read.`,
      "Boxes 2, 8 and 9 are nil: the book carries no EU acquisitions or supplies.",
      "Boxes 1 to 5 are to the penny and boxes 6 to 9 whole pounds; box 5 is the rounded box 3 less the rounded box 4.",
    ],
  };
}
