// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// se-derivations.js — the two named ITSA derivations for the Self Employed
// product: the quarterly update HMRC's Self Employment Business API expects
// four times a year, and the annual submission that closes the year. Both
// sit beside the Ltd derivations in this directory and follow the same
// shape: read the engine's own cells, add no arithmetic beyond summing and
// picking boxes, and let a caller with only a book and lines get an answer.
//
// Every HMRC field name comes from app/data/hmrc/sa103-mtd-mapping.json --
// this module never restates a box's API field name in code, so a mapping
// correction there reaches both derivations with no code change.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { diyaGlToScenario } from "../diya-gl-loader.js";
import { calculateSeCells } from "./se.js";
import { SE_YEAR_END_MONTH } from "../../products/se.js";
import { extractTaxYearStart, parseDate } from "../scenario-loader.js";
import { shiftMonths, periodShiftMonths } from "../period-shift.js";
import { splitVat } from "../tax/vat.js";

let cachedMapping = null;

// Resolved on first use, not at import: the engine bundle loads in the browser,
// where import.meta.url is an http URL and fileURLToPath throws.
function loadMapping() {
  if (!cachedMapping) {
    const here = dirname(fileURLToPath(import.meta.url));
    const mappingPath = resolve(here, "..", "..", "data", "hmrc", "sa103-mtd-mapping.json");
    cachedMapping = JSON.parse(readFileSync(mappingPath, "utf8"));
  }
  return cachedMapping;
}

function sa103fBoxes() {
  return loadMapping().boxes.filter((entry) => entry.form === "SA103F");
}

function boxEntry(boxes, boxNumber) {
  const entry = boxes.find((candidate) => candidate.box === boxNumber);
  if (!entry) throw new Error(`sa103-mtd-mapping.json carries no SA103F box ${boxNumber}`);
  if (!entry.field) throw new Error(`SA103F box ${boxNumber} carries no API field in sa103-mtd-mapping.json`);
  return entry;
}

// A box HMRC's own mapping shares between two fields lists them "a | b". The
// first is the one this template's cell actually answers -- section 8 of the
// design records which, box by box -- so a caller asking for "the field this
// box answers" gets that one unless told to reach past it.
function fieldsOf(entry) {
  return entry.field.split("|").map((field) => field.trim());
}

function primaryField(boxes, boxNumber) {
  return fieldsOf(boxEntry(boxes, boxNumber))[0];
}

// "__proto__", "constructor" and "prototype" are not field names, they are
// the prototype chain -- a path carrying one would write onto Object.prototype
// rather than the object this call meant to build. Every path here comes from
// sa103-mtd-mapping.json's own "field" column, so a segment like this is a
// defect in that mapping file and must fail loudly rather than land quietly
// on some other object.
const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

export function setPath(target, path, value) {
  const parts = path.split(".");
  for (const part of parts) {
    if (UNSAFE_PATH_SEGMENTS.has(part)) throw new Error(`setPath: "${part}" is not a field name, in path "${path}"`);
  }
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]] ||= {};
  node[parts[parts.length - 1]] = value;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// Every quarter is rounded to the penny and the fourth carries whatever the
// first three left behind, so the four always sum to the annual box exactly
// -- the invariant the reconciliation tests below hold the derivation to.
function quartersWithResidue(values, annual) {
  const q1 = round2(values[0]);
  const q2 = round2(values[1]);
  const q3 = round2(values[2]);
  const q4 = round2(round2(annual) - q1 - q2 - q3);
  return [q1, q2, q3, q4];
}

function vatRateFor(scenario) {
  return scenario?.metadata?.vat_registered === false ? 0 : 0.2;
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// HMRC's standard quarterly periods, published guidance (the phase 2 plan
// names these). Confirmed.
function standardQuarterBoundaries(startYear) {
  return [
    { start: isoDate(startYear, 4, 6), end: isoDate(startYear, 7, 5) },
    { start: isoDate(startYear, 7, 6), end: isoDate(startYear, 10, 5) },
    { start: isoDate(startYear, 10, 6), end: isoDate(startYear + 1, 1, 5) },
    { start: isoDate(startYear + 1, 1, 6), end: isoDate(startYear + 1, 4, 5) },
  ];
}

// The calendar election's exact dates are understood but not confirmed
// against a live filing (no spec in this repository states them). Isolated
// here so a confirmed change is a one-line edit. They only affect the dates
// reported back to the caller -- the calendar quarters are computed as three
// whole P&L month columns regardless of the exact day either boundary falls
// on, so a correction here changes no figure.
function calendarQuarterBoundaries(startYear) {
  return [
    { start: isoDate(startYear, 4, 6), end: isoDate(startYear, 6, 30) },
    { start: isoDate(startYear, 7, 1), end: isoDate(startYear, 9, 30) },
    { start: isoDate(startYear, 10, 1), end: isoDate(startYear, 12, 31) },
    { start: isoDate(startYear + 1, 1, 1), end: isoDate(startYear + 1, 4, 5) },
  ];
}

// A book's own first and last postings can fall a few days either side of
// the nominal 6 April / 5 April boundary (the fixtures carry lines dated 1
// to 5 April). The first quarter's lower edge and the last quarter's upper
// edge are widened to unbounded so those postings always land inside the
// year rather than being dropped as before-the-period or after-it; the two
// boundaries in between stay exactly as given.
function widenOuterEdges(boundaries) {
  return boundaries.map((boundary, index) => ({
    start: index === 0 ? null : boundary.start,
    end: index === boundaries.length - 1 ? null : boundary.end,
  }));
}

function withinBoundary(dateIso, boundary) {
  if (boundary.start !== null && dateIso < boundary.start) return false;
  if (boundary.end !== null && dateIso > boundary.end) return false;
  return true;
}

function quarterIndexFor(dateIso, boundaries) {
  const index = boundaries.findIndex((boundary) => withinBoundary(dateIso, boundary));
  if (index === -1) throw new Error(`no quarter boundary covers ${dateIso}`);
  return index;
}

function flatten(journal) {
  return Object.values(journal || {}).flat();
}

function taxYearLabel(taxData, book) {
  if (taxData?.tax_year?.label) return taxData.tax_year.label;
  const periodEnd = book?.documentInfo?.periodCoveredEnd;
  if (!periodEnd) throw new Error("no tax year: taxData.tax_year.label is absent and book.documentInfo.periodCoveredEnd is missing");
  const year = parseDate(periodEnd).getUTCFullYear();
  return `${year - 1}-${String(year).slice(-2)}`;
}

const MONTH_COLS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

function quarterSumOverRows(pl, rows, quarterIndex) {
  const columns = MONTH_COLS.slice(quarterIndex * 3, quarterIndex * 3 + 3);
  let total = 0;
  for (const column of columns) for (const row of rows) total += pl[`${column}${row}`] || 0;
  return total;
}

// The calendar election is three whole P&L month columns a quarter, so the
// quarterly figures come straight off the monthly grid the engine already
// computes -- the same grid app/test/se-anchors.test.js and the committed
// reports check against the Excel package. This path carries every mixed
// row's own addback (the payroll addition to row 21, the mileage claim in
// row 25, the stock movement in row 14's March cell) automatically, because
// the engine already folded each into the month it belongs to.
function quarterlyFromMonthlyGrid(pl) {
  const perQuarter = (rows) => [0, 1, 2, 3].map((quarter) => quarterSumOverRows(pl, rows, quarter));
  return {
    turnover: perQuarter([5, 6, 7, 8]),
    other: perQuarter([38]),
    costOfGoods: perQuarter([14, 16]),
    paymentsToSubcontractors: perQuarter([15]),
    wagesAndStaffCosts: perQuarter([21]),
    carVanTravelExpenses: perQuarter([25, 26]),
    premisesRunningCosts: perQuarter([22]),
    maintenanceCosts: perQuarter([23]),
    adminCosts: perQuarter([24]),
    advertisingCosts: perQuarter([27]),
    interestOnBankOtherLoans: perQuarter([30]),
    financeCharges: perQuarter([31]),
    irrecoverableDebts: perQuarter([29]),
    professionalFees: perQuarter([28]),
    depreciation: perQuarter([33, 34]),
    otherExpenses: perQuarter([32]),
    depreciationDisallowable: perQuarter([34]),
  };
}

// Sales and purchases code letters that feed a P&L row with no other
// adjustment mixed in, read off app/lib/scenario-extractor.js's own account
// maps by way of the code letters scenario transactions already carry.
const SALES_QUARTERLY_ROW = { a: 5, b: 6, c: 7, d: 8 };
const PURCHASES_QUARTERLY_ROW = { s: 14, c: 15, o: 16, w: 21, p: 22, m: 23, g: 24, v: 25, h: 26, a: 27, l: 28, y: 32 };

const MONTH_KEYS = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];
const MONTH_SHEET_NAMES = {
  apr: "Apr",
  may: "May",
  jun: "Jun",
  jul: "Jul",
  aug: "Aug",
  sep: "Sep",
  oct: "Oct",
  nov: "Nov",
  dec: "Dec",
  jan: "Jan",
  feb: "Feb",
  mar: "Mar",
};

// HMRC's standard periods cut three month tabs mid-month, so no cell in the
// package holds either half of a cut month and the quarterly figures come
// off the dated lines instead: each line goes through the same code-to-row
// map the engine uses, splits VAT at the book's own rate, and lands in
// whichever quarter its (period-shifted) posting date falls in. Two things
// the lines cannot carry are added separately: the depreciation pair, which
// the schedule spreads evenly across the year regardless of period type, and
// the stock movement, which sits wholly in the quarter holding the
// accounting period end. The mileage claim is banded monthly rather than
// per line, so its month's whole claim is bucketed by the calendar quarter
// its month falls in either way, the same routing the calendar election uses.
function quarterlyFromLines(scenario, rawResults, rate, monthOffset, boundaries) {
  const rows = {};
  for (const row of [5, 6, 7, 8, 14, 15, 16, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 38]) rows[row] = [0, 0, 0, 0];

  const shiftedIso = (dateValue) => {
    const shifted = shiftMonths(parseDate(dateValue), monthOffset);
    return isoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
  };

  for (const tx of flatten(scenario.sales)) {
    if (tx.mileage) continue;
    const net = splitVat(tx.amount, rate).net;
    const quarter = quarterIndexFor(shiftedIso(tx.date), boundaries);
    if (tx.code in SALES_QUARTERLY_ROW) rows[SALES_QUARTERLY_ROW[tx.code]][quarter] += net;
    else if (tx.code === "o") rows[29][quarter] -= net;
  }
  for (const tx of flatten(scenario.purchases)) {
    if (tx.mileage) continue;
    const row = PURCHASES_QUARTERLY_ROW[tx.code];
    if (!row) continue;
    const net = splitVat(tx.amount, rate).net;
    const quarter = quarterIndexFor(shiftedIso(tx.date), boundaries);
    rows[row][quarter] += net;
  }
  for (const entry of flatten(scenario.payroll)) {
    const quarter = quarterIndexFor(shiftedIso(entry.date), boundaries);
    rows[21][quarter] += (entry.grossPay || 0) + (entry.employerNI || 0);
  }
  for (const tx of flatten(scenario.bank)) {
    if (tx.code === "BC") continue;
    const quarter = quarterIndexFor(shiftedIso(tx.date), boundaries);
    const isCash = tx.account === "1220";
    if (!isCash && tx.direction === "out" && tx.code === "J") rows[30][quarter] += tx.amount;
    if (!isCash && tx.direction === "out" && tx.code === "B") rows[31][quarter] += tx.amount;
    if (isCash && tx.direction === "out" && tx.code === "J") rows[31][quarter] += tx.amount;
    if (!isCash && tx.direction === "in" && tx.code === "K") rows[38][quarter] += tx.amount;
  }

  const mileageByQuarter = [0, 0, 0, 0];
  MONTH_KEYS.forEach((key, index) => {
    const claim = rawResults[`Purchases.xlsx!${MONTH_SHEET_NAMES[key]}`]?.G2 || 0;
    mileageByQuarter[Math.floor(index / 3)] += claim;
  });

  // The stock movement sits only in the closing month's own cell, which
  // carries no code of its own to bucket by line. Isolating it as the gap
  // between the engine's own annual row 14 and this quarter table's own
  // code-s total keeps it out of the per-line loop above and lets it land
  // wholly on the quarter that holds the accounting period end.
  const annualCodeSNet = rows[14].reduce((total, value) => total + value, 0);
  const stockMovement = rawResults["Profit & Loss Account"].B14 - annualCodeSNet;
  rows[14][3] += stockMovement;

  const depreciationQuarter = rawResults["SE Full"].D114 / 4;
  const depreciationDisallowableQuarter = rawResults["SE Full"].O114 / 4;

  return {
    turnover: [0, 1, 2, 3].map((q) => rows[5][q] + rows[6][q] + rows[7][q] + rows[8][q]),
    other: rows[38],
    costOfGoods: [0, 1, 2, 3].map((q) => rows[14][q] + rows[16][q]),
    paymentsToSubcontractors: rows[15],
    wagesAndStaffCosts: rows[21],
    carVanTravelExpenses: [0, 1, 2, 3].map((q) => rows[25][q] + rows[26][q] + mileageByQuarter[q]),
    premisesRunningCosts: rows[22],
    maintenanceCosts: rows[23],
    adminCosts: rows[24],
    advertisingCosts: rows[27],
    interestOnBankOtherLoans: rows[30],
    financeCharges: rows[31],
    irrecoverableDebts: rows[29],
    professionalFees: rows[28],
    depreciation: [depreciationQuarter, depreciationQuarter, depreciationQuarter, depreciationQuarter],
    otherExpenses: rows[32],
    depreciationDisallowable: [
      depreciationDisallowableQuarter,
      depreciationDisallowableQuarter,
      depreciationDisallowableQuarter,
      depreciationDisallowableQuarter,
    ],
  };
}

/**
 * The four quarterly period summaries HMRC's Self Employment Business API
 * expects, built off the same engine the reconciliation runs.
 *
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {Object} taxData - the tax year file (or extractTaxDataFromBook's
 *   result) the package is generated against
 * @param {Object} [options]
 * @param {Object} [options.scenario] - a scenario already built by
 *   diyaGlToScenario; built from book and lines when absent
 * @param {"calendar"|"standard"} [options.quarterlyPeriodType] - which
 *   quarter boundaries to fall back to when options.periods is absent.
 *   Defaults to "calendar".
 * @param {Array<{periodStartDate: string, periodEndDate: string}>} [options.periods] -
 *   the four periods HMRC's own obligations response named. Overrides
 *   quarterlyPeriodType.
 */
export function buildSelfEmploymentQuarterlyUpdates(book, lines, taxData, options = {}) {
  const scenario = options.scenario || diyaGlToScenario(book, lines, "se");
  const rate = vatRateFor(scenario);
  const startYear = taxData?.tax_year?.start ? new Date(taxData.tax_year.start).getUTCFullYear() : extractTaxYearStart(scenario);
  if (!startYear) throw new Error("buildSelfEmploymentQuarterlyUpdates: no tax year could be read from taxData or scenario");
  const monthOffset = periodShiftMonths(scenario, startYear, SE_YEAR_END_MONTH);

  const rawResults = calculateSeCells(book, lines, taxData, scenario);
  const pl = rawResults["Profit & Loss Account"];
  const seFull = rawResults["SE Full"];
  const boxes = sa103fBoxes();

  const explicitPeriods = options.periods ? options.periods.map((p) => ({ start: p.periodStartDate, end: p.periodEndDate })) : null;
  const quarterlyPeriodType = options.quarterlyPeriodType || "calendar";
  const nominalBoundaries =
    explicitPeriods || (quarterlyPeriodType === "standard" ? standardQuarterBoundaries(startYear) : calendarQuarterBoundaries(startYear));

  const usesMonthlyGrid = !explicitPeriods && quarterlyPeriodType === "calendar";
  const quarterly = usesMonthlyGrid
    ? quarterlyFromMonthlyGrid(pl)
    : quarterlyFromLines(scenario, rawResults, rate, monthOffset, widenOuterEdges(nominalBoundaries));

  const annualAnchor = {
    turnover: seFull.D55,
    other: seFull.O55,
    costOfGoods: seFull.D66,
    paymentsToSubcontractors: seFull.D70,
    wagesAndStaffCosts: seFull.D74,
    carVanTravelExpenses: seFull.D78,
    premisesRunningCosts: seFull.D82,
    maintenanceCosts: seFull.D86,
    adminCosts: seFull.D90,
    advertisingCosts: seFull.D94,
    interestOnBankOtherLoans: seFull.D98,
    financeCharges: seFull.D102,
    irrecoverableDebts: seFull.D106,
    professionalFees: seFull.D110,
    depreciation: seFull.D114,
    otherExpenses: seFull.D118,
    depreciationDisallowable: seFull.O114,
  };

  const quarters = {};
  for (const key of Object.keys(annualAnchor)) quarters[key] = quartersWithResidue(quarterly[key], annualAnchor[key]);

  const incomeField = { turnover: primaryField(boxes, "15"), other: primaryField(boxes, "16") };
  const expenseField = {
    costOfGoods: primaryField(boxes, "17"),
    paymentsToSubcontractors: primaryField(boxes, "18"),
    wagesAndStaffCosts: primaryField(boxes, "19"),
    carVanTravelExpenses: primaryField(boxes, "20"),
    premisesRunningCosts: primaryField(boxes, "21"),
    maintenanceCosts: primaryField(boxes, "22"),
    adminCosts: primaryField(boxes, "23"),
    advertisingCosts: primaryField(boxes, "24"),
    interestOnBankOtherLoans: primaryField(boxes, "25"),
    financeCharges: primaryField(boxes, "26"),
    irrecoverableDebts: primaryField(boxes, "27"),
    professionalFees: primaryField(boxes, "28"),
    depreciation: primaryField(boxes, "29"),
    otherExpenses: primaryField(boxes, "30"),
  };
  const disallowableField = primaryField(boxes, "44");

  const periods = nominalBoundaries.map((boundary, index) => {
    // Each mapping field name already carries its own top-level branch
    // ("periodIncome.turnover", "periodExpenses.costOfGoods", ...), so every
    // field for this quarter lands on one shared root and the three
    // branches fall out of that root rather than being built separately and
    // then walked into again.
    const period = { periodDates: { periodStartDate: boundary.start, periodEndDate: boundary.end } };
    setPath(period, incomeField.turnover, quarters.turnover[index]);
    setPath(period, incomeField.other, quarters.other[index]);
    for (const [key, field] of Object.entries(expenseField)) setPath(period, field, quarters[key][index]);
    setPath(period, disallowableField, quarters.depreciationDisallowable[index]);
    return period;
  });

  const warnings = [];
  const box24 = boxEntry(boxes, "24");
  warnings.push({
    field: fieldsOf(box24)[1],
    reason: "SA103F box 24 combines advertising and business entertainment in one Profit & Loss Account row; the template cannot separate them.",
  });
  warnings.push({
    field: "periodExpenses.consolidatedExpenses",
    reason: "a customer election for turnover at or below the VAT threshold, offered on the filing page; never derived from the books.",
  });
  warnings.push({
    field: disallowableField,
    reason:
      'SA103F box 44 is Profit & Loss Account row 34 alone; a loss on disposal (row 33) stays inside box 29\'s allowable total, ' +
      "which is not an allowable deduction, with nothing moved to a disallowable box.",
    handComputed: round2(pl.B33 || 0),
  });
  for (const entry of boxes) {
    if (entry.route !== "quarterly" || !entry.field) continue;
    if (!entry.field.includes("periodDisallowableExpenses.")) continue;
    if (entry.box === "44") continue;
    for (const field of fieldsOf(entry)) {
      warnings.push({
        field,
        reason: `SA103F box ${entry.box} is printed with no formula behind it ("Not captured in DIY Accounting" on the VitalTax sheet); no book field carries it.`,
      });
    }
  }

  return {
    taxYear: taxYearLabel(taxData, book),
    quarterlyPeriodType: explicitPeriods ? options.quarterlyPeriodType : quarterlyPeriodType,
    periods,
    warnings,
  };
}

// Every annual field this book can source, and a warning naming the box for
// every one it cannot -- section 8 of the design records why each is out of
// reach today: no cell in the template, a cell the customer fills by hand,
// or a box the schema has no field for. Three of these boxes (52, 54, 69)
// carry a field that also moves in and out of HMRC's own schema by tax
// year -- annualFieldsUnavailableForYear() below is what keeps a year that
// no longer accepts a field from warning about it as if it still did.
const NO_SOURCE_ANNUAL_BOXES = [
  { box: "51", pick: 0 }, // allowances.capitalAllowanceSpecialRatePool
  { box: "51", pick: 1 }, // allowances.capitalAllowanceSingleAssetPool (shared with box 50)
  { box: "52", pick: 0 }, // allowances.zeroEmissionsGoodsVehicleAllowance -- gone from 2025-26
  { box: "52.1", pick: 0 }, // allowances.zeroEmissionsCarAllowance
  { box: "53", pick: 0 }, // allowances.structuredBuildingAllowance
  { box: "53.1", pick: 0 }, // allowances.enhancedStructuredBuildingAllowance
  { box: "54", pick: 1 }, // allowances.electricChargePointAllowance -- gone from 2025-26 (shared with box 55's enhancedCapitalAllowance)
  { box: "55", pick: 1 }, // allowances.businessPremisesRenovationAllowance (shared with enhancedCapitalAllowance)
  { box: "59", pick: 1 }, // adjustments.balancingChargeBpra (shared with balancingChargeOther)
  { box: "62", pick: 0 }, // adjustments.includedNonTaxableProfits
  { box: "68", pick: 0 }, // adjustments.basisAdjustment
  { box: "69", pick: 0 }, // adjustments.overlapReliefUsed -- gone from 2026-27
  { box: "71", pick: 0 }, // adjustments.accountingAdjustment
  { box: "73.3", pick: 0 }, // adjustments.transitionProfitAmount -- added in 2024-25
  { box: "73.3", pick: 1 }, // adjustments.transitionProfitAccelerationAmount -- added in 2024-25
];

// api.years in sa103-mtd-mapping.json is the source of which annual fields
// HMRC's schema accepts in a given tax year: a field named in an earlier
// year's own fieldsAdded is not yet live before that year, and a field
// named in that year's or an earlier year's fieldsGone is no longer live
// from that year on. A fieldsAdded entry that carries a "status" (the two
// 2026-27 additions, gated behind HMRC test flags) is not treated as a
// live field here -- neither has a cell in this template regardless, so
// the payload does not change, only whether the gap is worth warning about.
function annualFieldsUnavailableForYear(taxYear) {
  const years = loadMapping().api.years;
  const order = Object.keys(years);
  const index = order.indexOf(taxYear);
  if (index === -1) throw new Error(`sa103-mtd-mapping.json's api.years carries no entry for tax year "${taxYear}"`);
  const unavailable = new Set();
  for (let i = index + 1; i < order.length; i++) {
    for (const added of years[order[i]].fieldsAdded || []) {
      if (typeof added === "string") unavailable.add(added);
    }
  }
  for (let i = 0; i <= index; i++) {
    for (const gone of years[order[i]].fieldsGone || []) unavailable.add(gone);
  }
  return unavailable;
}

/**
 * The annual submission that closes the year, built off the same engine the
 * reconciliation runs.
 *
 * @param {Object} book - parsed book.toml
 * @param {Array} lines - parsed lines.jsonl entries
 * @param {Object} taxData - the tax year file (or extractTaxDataFromBook's
 *   result) the package is generated against
 * @param {Object} [options]
 * @param {Object} [options.scenario] - a scenario already built by
 *   diyaGlToScenario; built from book and lines when absent
 */
export function buildSelfEmploymentAnnualSubmission(book, lines, taxData, options = {}) {
  const scenario = options.scenario || diyaGlToScenario(book, lines, "se");
  const rawResults = calculateSeCells(book, lines, taxData, scenario);
  const seFull = rawResults["SE Full"];
  const boxes = sa103fBoxes();
  const taxYear = taxYearLabel(taxData, book);
  const unavailableFields = annualFieldsUnavailableForYear(taxYear);

  // Each mapping field name already carries its own top-level branch
  // ("allowances.annualInvestmentAllowance", "adjustments.balancingChargeOther",
  // ...), so both branches land on one shared root and fall out of it rather
  // than being built separately and then walked into again.
  const root = {};
  setPath(root, primaryField(boxes, "49"), round2(seFull.D139));
  setPath(root, primaryField(boxes, "50"), round2(seFull.D144));
  setPath(root, primaryField(boxes, "55"), round2(seFull.O144));
  setPath(root, primaryField(boxes, "56"), round2(seFull.O149));

  setPath(root, primaryField(boxes, "59"), round2(seFull.O160));
  const ownUseField = primaryField(boxes, "60");
  setPath(root, ownUseField, round2(seFull.D169));
  setPath(root, primaryField(boxes, "75"), round2(seFull.O204));

  const allowances = root.allowances || {};
  const adjustments = root.adjustments || {};

  const enhancedCapitalAllowanceField = primaryField(boxes, "55");
  const warnings = [
    {
      field: ownUseField,
      reason: "Business Details!O50 is a customer input cell the book schema has no field for; the template always carries nil here.",
    },
    {
      field: enhancedCapitalAllowanceField,
      reason:
        "SA103F box 55 is the small pools write-off (Schedule S1, once the pool balance and the writing down allowance together are under £1,000), not a genuine 100% or enhanced capital allowance; HMRC's own field mapping still files it here.",
    },
  ];
  for (const { box: boxNumber, pick } of NO_SOURCE_ANNUAL_BOXES) {
    const entry = boxEntry(boxes, boxNumber);
    const field = fieldsOf(entry)[pick];
    if (unavailableFields.has(field)) continue;
    warnings.push({
      field,
      reason: `SA103F box ${boxNumber} has no cell the template computes; the customer fills it in by hand.`,
    });
  }

  const result = { taxYear };
  if (Object.keys(allowances).length > 0) result.allowances = allowances;
  if (Object.keys(adjustments).length > 0) result.adjustments = adjustments;
  result.warnings = warnings;
  return result;
}
