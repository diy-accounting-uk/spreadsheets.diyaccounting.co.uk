// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { entryOf, unionOf } from "../../lib/entry-attribution.js";
import { shiftMonths } from "../../lib/period-shift.js";
import { fmt } from "../../lib/product-sheets/format.js";
import { vatSection } from "../../lib/product-sheets/vat-chain.js";
import { netOfVat, sheetNetOfVat, vatRateFor } from "../../lib/product-sheets/vat-rate.js";
import { buildCategoryNetting, buildProfitBridge } from "../../lib/report-generator.js";
import { parseDate } from "../../lib/scenario-loader.js";
import { FIXTURE_CAR_MILEAGE_RATES, calculateMileageAllowance } from "../../lib/tax/mileage.js";
import { CELL_MAP, FORECAST_SHEET, TAX_SHEET } from "./cell-map.js";
import { ACCOUNTING_PERIOD_END_CELL, ACCOUNTING_PERIOD_START_CELL, MONTH_KEYS, SE_VAT_LAYOUT, VAT_RATE_CELL } from "./layout.js";
import {
  PL_ROW_CAPTIONS,
  PURCHASES_MONTHLY_TIE_ROWS,
  SALES_BAD_DEBT_ROW,
  SALES_MONTHLY_TIE_ROWS,
  multiFileOptions,
  standardReads,
} from "./reads.js";

// What a section's cells actually sum, where the caption on the cells alone
// would read as the whole trade. The VitalTax sheet quotes the three product
// sales rows and the two direct cost rows, nothing else, so its annual
// expenses figure is a fraction of the return's total expenses by design.
export const SECTION_CAPTIONS = {
  "Quarterly Summary": [
    "Sales here are the three product lines only (Profit & Loss Account rows 5 to 7), and expenses are the direct cost lines only (Materials and Other Direct Cost of Sales).",
    "Grants, other income and every administrative expense are outside this summary and appear in the profit and loss account and on the SA103S.",
  ],
};

export function reportSections(results) {
  const sectionMap = new Map();
  for (const [sheet, cell, label, , section, indent] of CELL_MAP) {
    if (!sectionMap.has(section)) sectionMap.set(section, []);
    const val = results[sheet]?.[cell];
    sectionMap.get(section).push({ label, value: fmt(val, unitFor(sheet, cell)), indent, cells: [`${sheet}!${cell}`] });
  }
  for (const [section, captions] of Object.entries(SECTION_CAPTIONS)) {
    const rows = sectionMap.get(section);
    if (rows) rows.unshift(...captions.map((label) => ({ label, value: "" })));
  }
  const sections = [...sectionMap.entries()].map(([title, rows]) => ({ title, rows }));
  const fixedAssets = fixedAssetSection(results);
  if (fixedAssets) sections.push(fixedAssets);
  const vat = vatSection(results, SE_VAT_LAYOUT);
  if (vat) sections.push(vat);
  return sections;
}

// The year's asset movement, laid out the way a fixed asset note lays it out.
// The package has no such note, so without this the only closing figure in
// the report is the schedule's own K1 column total.
export function fixedAssetSection(results) {
  const schedule = results["Fixedassets.xlsx!Schedule"];
  if (!schedule) return null;

  const num = (v) => (typeof v === "number" ? v : 0);
  const costBroughtForward = num(schedule.E57);
  const additions = num(schedule.E110);
  const disposalCost = num(schedule.W1);
  const costCarriedForward = costBroughtForward + additions - disposalCost;
  const depreciationBroughtForward = num(schedule.F1);
  const charge = num(schedule.I1);
  const disposalDepreciation = num(schedule.X1);
  const depreciationCarriedForward = depreciationBroughtForward + charge - disposalDepreciation;
  const disposalBookValue = disposalCost - disposalDepreciation;
  const cells = (...refs) => refs.map((ref) => `Fixedassets.xlsx!Schedule!${ref}`);

  return {
    title: "Fixed Asset Schedule",
    rows: [
      { label: "Cost brought forward (Schedule E57)", value: fmt(costBroughtForward), indent: 1, cells: cells("E57") },
      { label: "Additions in the year (Schedule E110)", value: fmt(additions), indent: 1, cells: cells("E110") },
      { label: "Cost of the assets sold in the year (Schedule W1)", value: fmt(disposalCost), indent: 1, cells: cells("W1") },
      {
        label: "**Cost carried forward, disposals removed**",
        value: fmt(costCarriedForward),
        indent: 0,
        cells: cells("E57", "E110", "W1"),
      },
      {
        label: "Accumulated depreciation brought forward (Schedule F1)",
        value: fmt(depreciationBroughtForward),
        indent: 1,
        cells: cells("F1"),
      },
      { label: "Depreciation charged for the year (Schedule I1)", value: fmt(charge), indent: 1, cells: cells("I1") },
      {
        label: "Accumulated depreciation on the assets sold (Schedule X1)",
        value: fmt(disposalDepreciation),
        indent: 1,
        cells: cells("X1"),
      },
      {
        label: "**Accumulated depreciation carried forward, disposals removed**",
        value: fmt(depreciationCarriedForward),
        indent: 0,
        cells: cells("F1", "I1", "X1"),
      },
      {
        label: "**Net book value at the year end (Schedule K1)**",
        value: fmt(costCarriedForward - depreciationCarriedForward),
        indent: 0,
        cells: cells("E57", "E110", "W1", "F1", "I1", "X1"),
      },
      { label: "", value: "" },
      {
        label: "Sale proceeds of the assets sold, net of VAT (Schedule V1)",
        value: fmt(num(schedule.V1)),
        indent: 1,
        cells: cells("V1"),
      },
      {
        label: "Net book value of the assets sold at the date of sale",
        value: fmt(disposalBookValue),
        indent: 1,
        cells: cells("W1", "X1"),
      },
    ],
  };
}

// The asset workbook's totals rows carry no caption of their own, so the
// appendix printed them as bare letters and a reader had to guess which
// column was cost, which was depreciation and which was the disposals.
// Every label here is the column's formula read back from the template.
export const FIXED_ASSET_CELL_LABELS = {
  "Fixedassets.xlsx!Schedule": {
    E1: "Total cost of every asset on the schedule, assets sold in the year included",
    F1: "Total accumulated depreciation brought forward",
    G1: "Total net book value brought forward (cost less depreciation brought forward)",
    I1: "Total depreciation charged for the year",
    J1: "Total accumulated depreciation carried forward (brought forward plus the charge)",
    K1: "Total net book value carried forward, disposals removed",
    Q1: "Total annual investment allowance claimed",
    R1: "Total writing down allowance claimed",
    S1: "Total tax written down value carried forward",
    V1: "Sale proceeds of the assets sold in the year, net of VAT",
    W1: "Cost of the assets sold in the year",
    X1: "Accumulated depreciation on the assets sold in the year",
    Y1: "Balancing allowance on the disposals",
    Z1: "Balancing charge on the disposals",
    AC1: "Total special rate writing down allowance claimed (the rows marked S in column AB)",
    AC4: "Special rate writing down allowance rate, read from Admin",
    AE1: "Single asset pool writing down allowance at the main rate (the rows marked P in column AD)",
    AF1: "Single asset pool writing down allowance at the special rate (the rows marked P and S)",
    AG1: "Single asset pool tax written down value carried forward",
    AH1: "Main pool tax written down value carried forward, single asset pool rows left out",
    AI1: "Special rate pool tax written down value carried forward (the rows marked S), single asset pool rows left out",
    M40: "Private use share of the third motor vehicle brought forward",
    AD40: "Single asset pool marker on the third motor vehicle brought forward (P)",
    AE40: "Single asset pool main rate allowance on the third motor vehicle brought forward",
    AG40: "Single asset pool tax written down value on the third motor vehicle brought forward",
    E57: "Cost of the assets owned at the start of the year",
    E110: "Cost of the assets bought during the year",
    B115: "Date first in qualifying use, the fixture's standard-rate SBA claim",
    C115: "Building name, the fixture's standard-rate SBA claim",
    E115: "Qualifying expenditure, the fixture's standard-rate SBA claim",
    F115: "Postcode, the fixture's standard-rate SBA claim",
    H115: "Structures and Buildings Allowance rate applied to the standard-rate claim",
    J115: "Days claimed this year, the fixture's standard-rate SBA claim",
    K115: "Structures and Buildings Allowance claimed this year, the fixture's standard-rate claim",
    B116: "Date first in qualifying use, the fixture's Freeport SBA claim",
    D116: "Building number, the fixture's Freeport SBA claim",
    E116: "Qualifying expenditure, the fixture's Freeport SBA claim",
    F116: "Postcode, the fixture's Freeport SBA claim",
    G116: "Tax site marker, the fixture's Freeport SBA claim (F)",
    H116: "Structures and Buildings Allowance rate applied to the Freeport claim",
    J116: "Days claimed this year, the fixture's Freeport SBA claim",
    K116: "Structures and Buildings Allowance claimed this year, the fixture's Freeport claim",
    K120: "Structures and Buildings Allowance (SA103F box 53), the non-Freeport claims summed",
    K121: "Freeport and Investment Zone Structures and Buildings Allowance (SA103F box 53.1), the Freeport claims summed",
  },
  "Fixedassets.xlsx!FAreconciliation": {
    E11: "Additions the schedule lists, net of VAT",
    E13: "Fixed asset purchases the purchase journal carries, net of VAT",
    E15: "Purchases less schedule additions",
    K11: "Disposal proceeds the schedule lists, net of VAT",
    K13: "Fixed asset sales the sales journal carries, net of VAT",
    K15: "Sales less schedule disposals",
  },
};

// ── The unit every read cell is compared in ────────────────────────────────
//
// A money value is compared to the penny, a rate to six places, and a date, a
// count, a name and a verdict exactly. Both engines carry binary floating point
// and the xls roundtrip re-serialises it, so a money cell has to be rounded
// before it is compared or a difference far below a penny reads as a defect. A
// cell with no declared unit is compared exactly, so a unit only ever loosens.

// Admin holds rates, thresholds and dates side by side, so its own cells say
// which is which. Everything else on that sheet is an amount.
export const ADMIN_RATE_CELLS = new Set([
  "N6",
  "N7",
  "N8",
  "K11",
  "K12",
  "K13",
  "L20",
  "L23",
  "G4",
  "G5",
  "G6",
  "G9",
  "G10",
  "G13",
  "G14",
  "G15",
  "G16",
  "G17",
  "G21",
  "G22",
  "F27",
]);

export const ADMIN_MILEAGE_BAND_CELLS = new Set(["F21", "F22"]);

export const ADMIN_TAX_YEAR_LABEL_CELLS = new Set(["B23", "B24"]);

export function columnOf(cell) {
  return cell.match(/^[A-Z]+/)[0];
}

/**
 * The unit one cell carries, by the sheet it sits on.
 * @param {string} sheet - a hub sheet name, or "<file>!<sheet>" for a leaf
 * @param {string} cell
 * @returns {string}
 */
export function unitFor(sheet, cell) {
  const column = columnOf(cell);
  // C2 on a Purchases month tab is the business miles claimed to date, the
  // one figure on either journal that is a distance rather than a sum.
  if (sheet.startsWith("Purchases.xlsx!")) return cell === VAT_RATE_CELL ? "rate" : cell === "C2" ? "count" : "money";
  if (sheet.startsWith("Sales.xlsx!")) return cell === VAT_RATE_CELL ? "rate" : "money";
  if (sheet === "Vat.xlsx!Vatinterface") return column === "B" || column === "C" ? "date" : column === "M" ? "rate" : "money";
  if (sheet.startsWith("Vat.xlsx!VATQtr")) return cell === "G5" || cell === "G7" ? "date" : "money";
  // Payslips!Payment: B the tax month end, C the day the payment falls due,
  // both an Excel day serial; D the National Insurance due, E the income
  // tax and I the whole amount payable are money.
  if (sheet === "Payslips.xlsx!Payment") return column === "B" || column === "C" ? "date" : "money";
  if (sheet === "Payslips.xlsx!Admin") {
    if (cell === "N1") return "text";
    if (column === "A") return "text";
    if (column === "B" || cell === "I1") return "date";
    return "count";
  }
  switch (sheet) {
    case "Business Details":
      // Boxes 8 and 9, the book's own accounting period dates.
      if (cell === ACCOUNTING_PERIOD_START_CELL || cell === ACCOUNTING_PERIOD_END_CELL) return "date";
      return "text";
    case "Admin":
      if (ADMIN_TAX_YEAR_LABEL_CELLS.has(cell)) return "text";
      if (column === "B") return "date";
      if (ADMIN_RATE_CELLS.has(cell)) return "rate";
      if (ADMIN_MILEAGE_BAND_CELLS.has(cell)) return "count";
      return "money";
    case TAX_SHEET:
      if (cell === "C13") return "date";
      return column === "D" ? "rate" : "money";
    case FORECAST_SHEET:
      return cell === "C21" ? "count" : "money";
    case "SE Short":
      if (cell === "C8" || cell === "A33") return "text";
      if (cell === "S17" || cell === "Q2" || cell === "V2") return "date";
      return "money";
    case "SE Full":
      if (cell === "Q2" || cell === "V2") return "date";
      if (cell === "G141") return "rate";
      return "money";
    case "VitalTax":
      // Column I, rows 36 to 50, is the disallowable percentage per
      // category (DISALLOWABLE_PERCENT_CELLS); every other column on the
      // sheet is a money figure.
      return column === "I" ? "rate" : "money";
    case "Wagesinterface":
      return column === "B" ? "date" : "money";
    default:
      return "money";
  }
}

export function cellLabels() {
  const named = {};
  for (const [sheet, cell, diyLabel, glMapping] of CELL_MAP) named[`${sheet}!${cell}`] = { diyLabel, glMapping };
  for (const [sheet, cells] of Object.entries(FIXED_ASSET_CELL_LABELS)) {
    for (const [cell, diyLabel] of Object.entries(cells)) named[`${sheet}!${cell}`] = { diyLabel, glMapping: "" };
  }

  // Every cell either side reads carries a unit, whether or not the report
  // prints a caption beside it.
  const readScope = { ...standardReads() };
  for (const [file, sheets] of Object.entries(multiFileOptions().additionalReads)) {
    for (const [sheet, cells] of Object.entries(sheets)) readScope[`${file}!${sheet}`] = cells;
  }

  const labels = {};
  for (const [sheet, cells] of Object.entries(readScope)) {
    for (const cell of cells) {
      const key = `${sheet}!${cell}`;
      labels[key] = { diyLabel: "", glMapping: "", ...named[key], unit: unitFor(sheet, cell) };
    }
  }
  for (const [key, entry] of Object.entries(named)) {
    if (!labels[key]) labels[key] = { ...entry, unit: unitFor(key.slice(0, key.lastIndexOf("!")), key.slice(key.lastIndexOf("!") + 1)) };
  }
  return labels;
}

// ── Accounting profit to tax profit bridge ─────────────────────────────────

// Depreciation is not allowable for income tax, so the return's total
// expenses line takes it back out and the capital allowance boxes stand in
// for it. Grants sit in the accounts above gross profit; on the return they
// are box 30, added after the trade's own taxable profit. Interest received
// stays put: profit before tax carries it and box 10 carries it, so it is
// inside both ends of the bridge and needs no line of its own.
export function profitBridge(results) {
  const pl = results["Profit & Loss Account"];
  const seShort = results["SE Short"];
  const seFull = results["SE Full"];
  const tax = results[TAX_SHEET];
  if (!pl || !seShort || !tax) return null;

  const num = (v) => (typeof v === "number" ? v : 0);

  // A trading loss cannot turn the taxable profit negative -- there is no
  // such thing as negative tax -- so the chain above floors this subtotal at
  // nil and carries the loss forward through SE Full's own box 65 instead
  // (verified against the template: 'SE Full'!O174 = IF((D129+D174-O169)>0,
  // ...,IF((-O129+D174-O169)>0,...,0)) and O179 = IF(O174>0,0,...the same
  // subtotal negated...), so O174 minus O179 restates the unfloored subtotal
  // exactly, in both directions, without the bridge floor having to be
  // rebuilt from the very rows it is meant to prove. Reading it off the
  // sheet, rather than deriving it from the rows above, keeps the row-side
  // figures free to diverge from it if one of them is wrong.
  const rows = [
    { label: "Profit before tax per the profit and loss account", cell: "Profit & Loss Account!B39", value: num(pl.B39) },
    // Depreciation was the only disallowable expense while every other
    // category's percentage sat at nil; now the whole of box 46 (boxes 32
    // to 45, disallowable percentages included) is added back, not
    // depreciation alone.
    { label: "Add disallowable expenses added back (box 46)", cell: "SE Full!O122", value: num(seFull?.O122) },
    { label: "Less grants, taxed as other business income below", cell: "Profit & Loss Account!B11", value: -num(pl.B11) },
    { label: "Less annual investment allowance (box 23)", cell: "SE Short!D80", value: -num(seShort.D80) },
    { label: "Less small-balance allowance (box 24)", cell: "SE Short!D85", value: -num(seShort.D85) },
    { label: "Less other capital allowances (box 25)", cell: "SE Short!O80", value: -num(seShort.O80) },
    { label: "Add balancing charges (box 26)", cell: "SE Short!O85", value: num(seShort.O85) },
    { label: "Add goods and services for own use (box 27)", cell: "SE Short!D94", value: num(seShort.D94) },
    { label: "Less the full return's own zero-emission goods vehicle allowance (box 52)", cell: "SE Full!D150", value: -num(seFull?.D150) },
    { label: "Less the full return's own zero-emission car allowance (box 52.1)", cell: "SE Full!D152", value: -num(seFull?.D152) },
    { label: "Less the full return's own Structures and Buildings Allowance (box 53)", cell: "SE Full!D156", value: -num(seFull?.D156) },
    {
      label: "Less the full return's own Freeport and Investment Zone Structures and Buildings Allowance (box 53.1)",
      cell: "SE Full!D160",
      value: -num(seFull?.D160),
    },
    { label: "Less the full return's own electric charge-point allowance (box 54)", cell: "SE Full!O139", value: -num(seFull?.O139) },
    { label: "Less the full return's own box 62 adjustment", cell: "SE Full!D179", value: -num(seFull?.D179) },
    {
      label: "Add the full return's own box 71 adjustment for change of accounting practice",
      cell: "SE Full!D210",
      value: num(seFull?.D210),
    },
    {
      label: "Add back the year's loss, carried forward rather than reducing tax below nil",
      cell: "SE Full!O179",
      value: num(seFull?.O179),
    },
    { label: "Less loss brought forward (box 29)", cell: "SE Short!O94", value: -num(seShort.O94) },
    { label: "Add grants as other business income (box 30)", cell: "SE Short!O99", value: num(seShort.O99) },
  ];

  return buildProfitBridge(rows, `${TAX_SHEET}!E5`, num(tax.E5));
}

// ── The Schedule's capital allowance pools, from the fixture ───────────────

// The opening tax written-down values that claim a writing down allowance in
// one rate pool, each reduced to its business share: a privately used car
// claims on (1 - M), which the Schedule applies on the car rows.
export function openingPoolAllowance(expected, pool) {
  return (expected.opening_fixed_assets || [])
    .filter((asset) => (asset.pool === "special") === (pool === "special"))
    .reduce((total, asset) => total + (asset.tax_wdv || 0) * (1 - (asset.private_use || 0)), 0);
}

// The small pools write-off the way SE Full!O144 and SE Short!D85 state it:
// IF((R1-AE1+AH1)<1000,AH1,0)+IF((AC1-AF1+AI1)<1000,AI1,0). Each rate pool
// takes the £1,000 test on its own balance before this year's allowance, the
// single asset pool rows left out, and writes off its own written-down value
// when it passes.
export function smallPoolsWriteOff(schedule) {
  const num = (v) => (typeof v === "number" ? v : 0);
  const mainBalance = num(schedule.R1) - num(schedule.AE1) + num(schedule.AH1);
  const specialBalance = num(schedule.AC1) - num(schedule.AF1) + num(schedule.AI1);
  return (mainBalance < 1000 ? num(schedule.AH1) : 0) + (specialBalance < 1000 ? num(schedule.AI1) : 0);
}

// The same figures from the fixture's own assets, pool by pool. A pooled
// opening asset puts its whole tax written-down value into its pool's test
// (allowance plus written-down value is the value brought forward) and its
// written-down balance after this year's allowance into the write-off; a
// single asset pool row puts nothing into either; an asset bought in the
// year puts its cost less the annual investment allowance into the main
// pool's both.
export function fixtureSmallPools(expected, taxData, rate) {
  const wda = taxData.capital_allowances.writing_down_allowance;
  const specialWda = taxData.capital_allowances.writing_down_allowance_special || 0;
  const aia = taxData.capital_allowances.annual_investment_allowance ?? 0;
  const pools = { main: { balance: 0, writtenDown: 0 }, special: { balance: 0, writtenDown: 0 } };
  for (const asset of expected.opening_fixed_assets || []) {
    if (asset.single_asset_pool || !(asset.tax_wdv > 0)) continue;
    const pool = asset.pool === "special" ? pools.special : pools.main;
    const share = 1 - (asset.private_use || 0);
    const allowance = asset.tax_wdv * (asset.pool === "special" ? specialWda : wda) * share;
    pool.balance += asset.tax_wdv;
    pool.writtenDown += asset.tax_wdv - allowance;
  }
  for (const transactions of Object.values(expected.purchases || {})) {
    for (const tx of transactions) {
      if (tx.code !== "fa") continue;
      const cost = netOfVat(tx.amount, rate);
      pools.main.balance += cost - cost * aia;
      pools.main.writtenDown += cost - cost * aia;
    }
  }
  const writeOff = (pool) => (pool.balance < 1000 ? pool.writtenDown : 0);
  return { ...pools, writeOff: writeOff(pools.main) + writeOff(pools.special) };
}

// SA103F boxes 53 and 53.1 the way Fixedassets.xlsx!Schedule!K120 and K121
// state them (Structures and Buildings Allowance), from the fixture's own
// claims rather than from the sheet: each claim's expenditure at its own
// year's rate (standard or the enhanced Freeport/Investment Zone rate),
// over the days of the chargeable period it covers -- the later of the
// period's own start and the claim's qualifying date, to the earlier of the
// period's end, the claim's ceased date and the 33 1/3 (or 10) year limit.
export const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

export function toExcelSerialDate(date) {
  return Math.round((date.getTime() - EXCEL_EPOCH_MS) / 86400000);
}

export function fixtureStructuresAndBuildings(expected, taxData, periodStartSerial, periodEndSerial, shiftDate) {
  const rateStandard = taxData.capital_allowances.structures_and_buildings_allowance ?? 0;
  const rateEnhanced = taxData.capital_allowances.structures_and_buildings_allowance_enhanced ?? 0;
  const periodDays = periodEndSerial - periodStartSerial + 1;
  let box53 = 0;
  let box53_1 = 0;
  for (const claim of expected.sba_claims || []) {
    const enhanced = claim.enhanced === true;
    const qualifyingDate = shiftDate(parseDate(claim.qualifyingDate));
    const qualifyingSerial = toExcelSerialDate(qualifyingDate);
    const rate = enhanced ? rateEnhanced : rateStandard;
    const limitMonths = enhanced ? 120 : 400;
    let upperBound = Math.min(periodEndSerial, toExcelSerialDate(shiftMonths(qualifyingDate, limitMonths)) - 1);
    if (claim.ceasedDate) upperBound = Math.min(upperBound, toExcelSerialDate(shiftDate(parseDate(claim.ceasedDate))));
    const lowerBound = Math.max(periodStartSerial, qualifyingSerial);
    const days = Math.max(0, upperBound - lowerBound + 1);
    const allowance = (claim.qualifyingAmountExpenditure * rate * days) / periodDays;
    if (enhanced) box53_1 += allowance;
    else box53 += allowance;
  }
  return { box53, box53_1 };
}

// ── Journal category VAT netting ───────────────────────────────────────────

// Journal totals by code letter: gross as entered, net the way the journal
// rows net it, and net the way the asset schedule holds it -- the writer
// puts a cost rounded to the penny on a schedule row, so a category that
// lands there is compared against the rounded figure.
export function journalTotalsByCode(journal, rate, defaultCode) {
  const gross = {};
  const net = {};
  const scheduleNet = {};
  const entries = {};
  for (const transactions of Object.values(journal || {})) {
    for (const tx of transactions) {
      // A mileage-log row's own figure never reaches a cell: the sheet prices
      // the miles itself and the claim it makes is added to the motoring
      // category by the caller, with no VAT to strip off it.
      if (tx.mileage) continue;
      const code = tx.code || defaultCode;
      gross[code] = (gross[code] || 0) + tx.amount;
      net[code] = (net[code] || 0) + sheetNetOfVat(tx.amount, rate);
      scheduleNet[code] = (scheduleNet[code] || 0) + netOfVat(tx.amount, rate);
      entries[code] = unionOf(entries[code], [entryOf(tx)]);
    }
  }
  return { gross, net, scheduleNet, entries };
}

// The lines a journal's mileage-log rows came from.
export function journalMileageEntries(journal) {
  return unionOf(...Object.values(journal || {}).map((transactions) => transactions.filter((tx) => typeof tx.mileage === "number")));
}

// The business miles a journal's own rows carry, which is what the Purchases
// month tabs pool into their running mileage total.
export function journalMiles(journal) {
  let miles = 0;
  for (const transactions of Object.values(journal || {})) {
    for (const tx of transactions) if (typeof tx.mileage === "number") miles += tx.mileage;
  }
  return miles;
}

export function monthMiles(transactions) {
  return (transactions || []).reduce((miles, tx) => miles + (typeof tx.mileage === "number" ? tx.mileage : 0), 0);
}

/**
 * The mileage claim each month adds, keyed by scenario month. The Purchases
 * month tab pools its own column D with the Sales month's D1 into C2 and
 * bands the running total in G2, so a month's claim is what that banding adds
 * over every mile claimed in the months ahead of it, sales miles included.
 *
 * @param {Object} scenario - a loaded scenario (or a merged scenario/expected)
 * @param {Object} mileageRates - the tax year's [mileage] table
 * @returns {Object} scenario month key -> the claim that month adds
 */
export function mileageClaimsByMonth(scenario, mileageRates) {
  const claims = {};
  let milesToDate = 0;
  for (const month of MONTH_KEYS) {
    const miles = monthMiles(scenario.sales?.[month]) + monthMiles(scenario.purchases?.[month]);
    if (!miles) continue;
    claims[month] = calculateMileageAllowance(milesToDate + miles, mileageRates) - calculateMileageAllowance(milesToDate, mileageRates);
    milesToDate += miles;
  }
  return claims;
}

// One row per journal category that crosses into another statement, so the
// gross-to-net step is stated where it happens rather than only in total.
export function categoryNetting(results, scenario, taxData) {
  // With no journal there is nothing to net: every row would compare a nil
  // against whatever the sheet holds and read as a category that lost its
  // whole value on the way.
  if (!scenario?.sales && !scenario?.purchases) return null;
  const pl = results["Profit & Loss Account"];
  const fr = results["Fixedassets.xlsx!FAreconciliation"];
  if (!pl && !fr) return null;

  const rate = vatRateFor(scenario);
  const num = (v) => (typeof v === "number" ? v : 0);
  const sales = journalTotalsByCode(scenario.sales, rate, "a");
  const purchases = journalTotalsByCode(scenario.purchases, rate);
  // The year's mileage claim lands on the motoring category whole, so it
  // stands on both sides of that row: nothing was stripped on the way to
  // Motor Expenses because there was no VAT on it to strip.
  const businessMiles = journalMiles(scenario.sales) + journalMiles(scenario.purchases);
  if (businessMiles) {
    const claim = calculateMileageAllowance(businessMiles, taxData?.mileage || FIXTURE_CAR_MILEAGE_RATES);
    purchases.gross.v = (purchases.gross.v || 0) + claim;
    purchases.entries.v = unionOf(purchases.entries.v, journalMileageEntries(scenario.sales), journalMileageEntries(scenario.purchases));
    purchases.net.v = (purchases.net.v || 0) + claim;
  }
  const rows = [];

  const plRow = (journal, side, code, row, sign = 1) => {
    if (!pl) return;
    rows.push({
      code: `${journal} ${code}`,
      label: PL_ROW_CAPTIONS[row],
      gross: side.gross[code] || 0,
      net: side.net[code] || 0,
      cell: sign < 0 ? `Profit & Loss Account!B${row} negated` : `Profit & Loss Account!B${row}`,
      entries: side.entries[code],
      downstream: sign * num(pl[`B${row}`]),
    });
  };

  for (const [code, row] of Object.entries(SALES_MONTHLY_TIE_ROWS)) plRow("sales", sales, code, row);
  plRow("sales", sales, "o", SALES_BAD_DEBT_ROW, -1);
  // Box 24 combines advertising and business entertainment in one row, so
  // the "a" netting row carries both codes' combined gross and net.
  const purchasesRow27 = {
    gross: { a: (purchases.gross.a || 0) + (purchases.gross.e || 0) },
    net: { a: (purchases.net.a || 0) + (purchases.net.e || 0) },
    entries: { a: unionOf(purchases.entries.a, purchases.entries.e) },
  };
  for (const [code, row] of Object.entries(PURCHASES_MONTHLY_TIE_ROWS))
    plRow("purchases", code === "a" ? purchasesRow27 : purchases, code, row);

  // Stock-coded purchases reach the materials line together with the year's
  // stock movement, so the movement comes off the line before the two sides
  // are comparable. Without both counts there is nothing to take off and the
  // row would be measuring the movement, not the netting.
  const openingStock = scenario.stock?.opening ?? scenario.opening_stock;
  const closingStock = scenario.stock?.closing ?? scenario.closing_stock;
  if (pl && openingStock !== undefined && closingStock !== undefined) {
    rows.push({
      code: "purchases s",
      label: "Purchases after stock adjustment, less the year's stock movement",
      gross: purchases.gross.s || 0,
      net: purchases.net.s || 0,
      entries: purchases.entries.s,
      cell: "Profit & Loss Account!B14 less the stock movement",
      downstream: num(pl.B14) - (openingStock - closingStock),
    });
  }

  if (fr) {
    rows.push({
      code: "purchases fa",
      label: "Capitalised fixed asset spend",
      gross: purchases.gross.fa || 0,
      net: purchases.scheduleNet.fa || 0,
      entries: purchases.entries.fa,
      cell: "Fixedassets.xlsx!FAreconciliation!E11",
      downstream: num(fr.E11),
    });
    rows.push({
      code: "sales fs",
      label: "Fixed asset disposal proceeds",
      gross: sales.gross.fs || 0,
      net: sales.scheduleNet.fs || 0,
      entries: sales.entries.fs,
      cell: "Fixedassets.xlsx!FAreconciliation!K11",
      downstream: num(fr.K11),
    });
  }

  return buildCategoryNetting(rate, rows);
}
