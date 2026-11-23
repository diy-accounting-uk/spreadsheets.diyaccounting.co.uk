// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// vat-return.js — the nine VAT boxes for one obligation period, with HMRC's
// field names, HMRC's rounding, and the journal lines that fed each box. The
// lines are first attributed the way the Ltd engine's journal rows take them
// (20% off every line) and reconciled against its Vatreturns.xlsx!Vatinterface
// quarter columns. A quarter whose lines are all standard rated answers the
// interface's figures. Any other quarter answers each line's VAT from its own
// taxCode and taxRate, by HMRC's rules for the boxes (VAT Notice 700/12
// sections 3.2 to 3.10 and 4.6), and states the difference from the workbook.

import { calculateFromDiyaGl } from "../diya-gl-calculator.js";
import { diyaGlToScenario } from "../diya-gl-loader.js";
import { loadTaxDataForBook, productOf } from "../product-workbook.js";
import { isStraddlingLine, LTD_PURCHASE_CODE_MAP, LTD_SALES_CODE_MAP, signedAmount } from "../scenario-extractor.js";
import { dateFromExcelSerial } from "../calculators/shared.js";
import { VAT_RATE } from "../calculators/ltd.js";
import { splitVat, VATINTERFACE_FIRST_MONTH_ROW, VATINTERFACE_FIRST_ROW, VATINTERFACE_LAST_ROW } from "../tax/vat.js";

const INTERFACE_SHEET = "Vatreturns.xlsx!Vatinterface";
const MONTHS_IN_QUARTER = 3;
const RATE_TOLERANCE = 1e-9;
const BOXES_THAT_CAN_DIFFER = ["box1", "box3", "box4", "box5", "box6", "box7"];

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

function lineContribution(line, contributes) {
  return {
    entryNumber: line.entryNumber,
    lineNumber: line.lineNumber ?? null,
    date: line.postingDate,
    account: line.accountMainID,
    reference: line.documentReference ?? null,
    counterparty: line.detailComment ?? null,
    taxCode: taxCodeOf(line),
    gross: pence(signedAmount(line)),
    contributes: pence(contributes),
  };
}

function taxCodeOf(line) {
  return line.taxCode ?? "S";
}

function hasRate(line) {
  return typeof line.taxRate === "number";
}

/**
 * The VAT rates a book's tax data states.
 * @param {Object} taxData - the parsed tax data file for the book's year
 * @returns {{standard: number, reduced: number|undefined}}
 */
function ratesOf(taxData) {
  const vat = taxData?.vat ?? {};
  if (typeof vat.standard_rate !== "number") throw new Error("The book's tax data carries no standard rate of VAT (vat.standard_rate)");
  return { standard: vat.standard_rate, reduced: vat.reduced_rate };
}

function isStandardRated(line, rates) {
  return taxCodeOf(line) === "S" && (!hasRate(line) || Math.abs(line.taxRate - rates.standard) < RATE_TOLERANCE);
}

// A purchase under the domestic reverse charge for building and construction
// services carries the CIS fields of a sub-contractor payment.
function isConstructionReverseCharge(line) {
  return line["diya-gl:cisRate"] !== undefined || line["diya-gl:cisDeduction"] !== undefined;
}

function rateFor(line, rates) {
  if (hasRate(line)) return line.taxRate;
  if (taxCodeOf(line) === "R") {
    if (typeof rates.reduced !== "number") {
      throw new Error(
        `Line ${line.entryNumber} is reduced rated, but the book's tax data carries no reduced rate of VAT (vat.reduced_rate)`,
      );
    }
    return rates.reduced;
  }
  return rates.standard;
}

/**
 * What one sales or purchases line puts in each box under its tax code.
 * Sales: S and R put their VAT in box 1 and their net in box 6; Z, E, OS and
 * RC put their whole amount in box 6 (VAT Notice 700/12 section 3.7 counts
 * zero-rated, exempt, outside the scope and reverse charge supplies); NA is
 * not a supply. Purchases: S and R put their VAT in box 4 and their net in
 * box 7; Z and E put their whole amount in box 7; OS and NA are left out of
 * box 7 (section 3.8 leaves out expenditure outside the scope of VAT because
 * it is not consideration for a supply, and wages, PAYE and rates); RC is the
 * customer's reverse charge of section 4.6: the VAT on the amount goes in
 * box 1 and box 4 and the amount in box 7, and in box 6 too unless it is a
 * construction service under the domestic reverse charge.
 * @param {Object} line - a sales or purchases journal line
 * @param {{standard: number, reduced: number|undefined}} rates
 * @returns {{box1?: number, box4?: number, box6?: number, box7?: number}}
 */
function boxesOfLine(line, rates) {
  const sale = line.sourceJournalID === "sales";
  const gross = signedAmount(line);
  const code = taxCodeOf(line);
  switch (code) {
    case "S":
    case "R": {
      const { vat, net } = splitVat(gross, rateFor(line, rates));
      return sale ? { box1: vat, box6: net } : { box4: vat, box7: net };
    }
    case "Z":
    case "E":
      return sale ? { box6: gross } : { box7: gross };
    case "OS":
      return sale ? { box6: gross } : {};
    case "NA":
      return {};
    case "RC": {
      if (sale) return { box6: gross };
      const vat = gross * rateFor(line, rates);
      return isConstructionReverseCharge(line) ? { box1: vat, box4: vat, box7: gross } : { box1: vat, box4: vat, box6: gross, box7: gross };
    }
    default:
      throw new Error(`Line ${line.entryNumber} carries tax code ${code}, which is not one a VAT return knows`);
  }
}

function percent(rate) {
  return `${Math.round(rate * 1000) / 10}%`;
}

function money(value) {
  return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function wholePounds(value) {
  return value.toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function codeCounts(lines) {
  const counts = new Map();
  for (const line of lines) counts.set(taxCodeOf(line), (counts.get(taxCodeOf(line)) || 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, count]) => `${count} ${code}`)
    .join(", ");
}

// The sentence that tells a reader how the boxes part from the workbook's
// VAT return, or null when no box does.
function workbookDifferenceOf(boxes, workbookBoxes, departing, standardRate) {
  const differing = BOXES_THAT_CAN_DIFFER.filter((box) => Math.abs(boxes[box] - workbookBoxes[box]) >= 0.005);
  if (differing.length === 0) return null;
  const figure = (box, value) => (box === "box6" || box === "box7" ? wholePounds(value) : money(value));
  const parts = differing.map((box) => `box ${box.slice(3)} £${figure(box, boxes[box])} (workbook £${figure(box, workbookBoxes[box])})`);
  return (
    `${departing.length} sales and purchases ${departing.length === 1 ? "line is" : "lines are"} not standard rated (${codeCounts(departing)}), ` +
    `so the boxes follow each line's tax code and differ from the workbook's VAT return, which takes ${percent(standardRate)} VAT off every line: ` +
    `${parts.join(", ")}.`
  );
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
  return lines.reduce((total, line) => total + splitGross(signedAmount(line))[part], 0);
}

function sumBox(treated, box) {
  return treated.reduce((total, { boxes }) => total + (boxes[box] ?? 0), 0);
}

function linesOfBox(treated, box) {
  return treated.filter(({ boxes }) => box in boxes).map(({ line, boxes }) => lineContribution(line, boxes[box]));
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
 *   obligation's period end (YYYY-MM-DD); resources is the loader the tax data reads through (defaults to reading app/); periodStart, when given, must open that quarter; periodKey is
 *   echoed back untouched
 * @returns {Promise<Object>} { vatRegistrationNumber, periodKey, periodStart, periodEnd, dueDate, scheme,
 *   months, boxes, hmrc, followsTaxCodes, workbookBoxes, workbookDifference, lines, notes }:
 *   workbookBoxes are the package's own VAT return, which takes 20% off every line; followsTaxCodes
 *   is true when a line in the quarter is not standard rated, and workbookDifference then names
 *   each box that differs from the package's (null when none does)
 */
export async function deriveVatReturn(book, lines, { periodEnd, periodStart, periodKey, resources } = {}) {
  if (!book || !lines) throw new Error("deriveVatReturn requires a book and its lines");
  if (!periodEnd) throw new Error("deriveVatReturn requires periodEnd (the obligation's period end, YYYY-MM-DD)");
  const entity = book.entityInformation ?? {};
  if (entity["diya-gl:vatRegistered"] !== true) {
    throw new Error(
      "The book does not declare the company VAT registered (entityInformation diya-gl:vatRegistered), so it carries no VAT return",
    );
  }

  const product = productOf(book);
  const taxData = await loadTaxDataForBook(book, { resources });
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
  const workbookBox1 = pence(row.quarter.salesVat);
  const workbookBox4 = pence(row.quarter.purchasesVat);
  const workbookBoxes = {
    box1: workbookBox1,
    box2: 0,
    box3: workbookBox1,
    box4: workbookBox4,
    box5: pence(workbookBox1 - workbookBox4),
    box6: pounds(row.quarter.salesNet + (flatRate ? row.quarter.salesVat : 0)),
    box7: pounds(row.quarter.purchasesNet),
    box8: 0,
    box9: 0,
  };

  const rates = ratesOf(taxData);
  const quarterLines = [...sales, ...purchases];
  const treated = quarterLines.map((line) => ({ line, boxes: boxesOfLine(line, rates) }));
  const departing = quarterLines.filter((line) => !isStandardRated(line, rates));
  const followsTaxCodes = departing.length > 0;

  let boxes = workbookBoxes;
  if (followsTaxCodes) {
    const box1 = pence(sumBox(treated, "box1"));
    const box3 = pence(box1);
    const box4 = pence(sumBox(treated, "box4"));
    boxes = {
      box1,
      box2: 0,
      box3,
      box4,
      box5: pence(box3 - box4),
      box6: pounds(sumBox(treated, "box6")),
      box7: pounds(sumBox(treated, "box7")),
      box8: 0,
      box9: 0,
    };
  }
  const workbookDifference = followsTaxCodes ? workbookDifferenceOf(boxes, workbookBoxes, departing, VAT_RATE) : null;
  const reverseCharged = purchases.filter((line) => taxCodeOf(line) === "RC");

  const notes = followsTaxCodes
    ? [
        `Each line's VAT follows its tax code: S at ${percent(rates.standard)} and R at ${typeof rates.reduced === "number" ? percent(rates.reduced) : "the reduced rate"}, unless the line states its own taxRate; Z, E, OS and NA carry no VAT.`,
        ...(workbookDifference ? [workbookDifference] : []),
        "Box 6 counts zero-rated, exempt, outside the scope and reverse charge sales, and leaves out sales coded NA (VAT Notice 700/12 section 3.7).",
        "Box 7 leaves out purchases coded OS or NA: expenditure outside the scope of VAT because it is not consideration for a supply, such as wages, PAYE and rates (VAT Notice 700/12 section 3.8).",
        ...(reverseCharged.length > 0
          ? [
              "A reverse charge purchase puts the VAT on its amount in boxes 1 and 4 and its amount in box 7, and in box 6 too unless it carries CIS fields and so is a construction service under the domestic reverse charge (VAT Notice 700/12 section 4.6).",
            ]
          : []),
      ]
    : [
        `Every sales and purchases line in the quarter is standard rated at ${percent(VAT_RATE)}, so the boxes are the workbook's VAT return.`,
      ];
  notes.push(
    "Boxes 2, 8 and 9 are nil: they carry goods moved between Northern Ireland and the EU (VAT Notice 700/12 sections 3.3, 3.9 and 3.10), which the book does not record.",
    "Boxes 1 to 5 are to the penny and boxes 6 to 9 whole pounds; box 5 is the rounded box 3 less the rounded box 4.",
  );

  const { box1, box2, box3, box4, box5, box6, box7, box8, box9 } = boxes;
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
    boxes,
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
    followsTaxCodes,
    workbookBoxes,
    workbookDifference,
    lines: {
      box1: linesOfBox(treated, "box1"),
      box4: linesOfBox(treated, "box4"),
      box6: linesOfBox(treated, "box6"),
      box7: linesOfBox(treated, "box7"),
    },
    notes,
  };
}
