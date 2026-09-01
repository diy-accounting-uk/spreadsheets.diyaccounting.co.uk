// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// generator.js — Core spreadsheet generation via zip-level XML surgery.
// Modifies only specific cell values in the Admin sheet XML, preserving all
// formatting, charts, conditional formatting, and XML packaging.

import JSZip from "jszip";
import { buildSheetMap } from "./spreadsheet-runner.js";
import { PAYSLIP_PRINT_CELLS, PAYSLIP_PRINT_SHEET } from "./payslips-layout.js";

// ── Deterministic zip output ───────────────────────────────────────────────
//
// When JSZip creates parent directory entries (e.g. "xl/") via zip.file(), it
// sets their date to new Date(). This makes output non-deterministic between
// process runs. stabilizeDirDates() normalises all auto-created directory
// entry timestamps to the DOS epoch (1980-01-01) before generateAsync().

const DOS_EPOCH = new Date("1980-01-01T00:00:00Z");

function stabilizeDirDates(zip) {
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) {
      entry.date = DOS_EPOCH;
    }
  }
}

// ── VAT return cycle ────────────────────────────────────────────────────────

// Months from the book's first month to each of the five return forms' default
// period ends. Every form steps a quarter on from the one before it, so Q1-Q4
// cover the twelve accounting months once each and Q5 is the quarter that
// follows them, ending three months past the year end. The fifth form is the
// one a business files when its VAT stagger runs behind its accounting year,
// and it lands on the last of the twenty periods the Vatinterface carries.
export const VAT_RETURN_END_MONTHS = [3, 6, 9, 12, 15];

// Salesinvoice.xlsx Product Details: one row a product, column D the VAT
// Rate the row's invoice lines charge (verified against the XML: dimension
// A1:H99, row 1 the header, D2:D99 every product row).
const SALESINVOICE_PRODUCT_DETAILS_VAT_RATE_COLUMN = "D";
const SALESINVOICE_PRODUCT_DETAILS_FIRST_ROW = 2;
const SALESINVOICE_PRODUCT_DETAILS_LAST_ROW = 99;

// ── Date helpers ────────────────────────────────────────────────────────────

export function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthEnd(year, month) {
  return new Date(Date.UTC(year, month - 1, lastDayOfMonth(year, month)));
}

export function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

// Excel serial number: days since 1899-12-30 (Excel epoch, includes the
// intentional 1900 leap year bug).
export function toExcelSerial(date) {
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((date.getTime() - epoch) / (24 * 60 * 60 * 1000));
}

export function fromExcelSerial(serial) {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + serial * 24 * 60 * 60 * 1000);
}

// ── Admin date generation ───────────────────────────────────────────────────

export function generateAdminDates(startYear) {
  return {
    B2: monthEnd(startYear, 2),
    B3: monthEnd(startYear, 3),
    B4: utcDate(startYear, 4, 6),
    B5: monthEnd(startYear, 4),
    B6: monthEnd(startYear, 5),
    B7: monthEnd(startYear, 6),
    B8: monthEnd(startYear, 7),
    B9: monthEnd(startYear, 8),
    B10: monthEnd(startYear, 9),
    B11: monthEnd(startYear, 10),
    B12: monthEnd(startYear, 11),
    B13: monthEnd(startYear, 12),
    B14: monthEnd(startYear + 1, 1),
    B15: monthEnd(startYear + 1, 2),
    B16: monthEnd(startYear + 1, 3),
    B17: utcDate(startYear + 1, 4, 5),
    B18: monthEnd(startYear + 1, 4),
    B19: monthEnd(startYear + 1, 5),
    B20: monthEnd(startYear + 1, 6),
    B21: utcDate(startYear + 2, 1, 31),
    B22: utcDate(startYear + 2, 7, 31),
  };
}

// The Self Employed Vatinterface's last period ends three months past the tax
// year and its payment falls due a month after that, which is later than any
// date the Admin list above carries. Vat.xlsx reads it from Admin B25 across
// the external link. The BST and Taxi Admin sheets share the list above but
// have no VAT workbook, so the extra date is written only on the SE hub.
export function seVatPaymentDueDate(startYear) {
  return { B25: monthEnd(startYear + 1, 7) };
}

// ── XML cell editing ────────────────────────────────────────────────────────

export function setCellValue(xml, cellRef, value) {
  const match = matchCell(xml, cellRef);
  if (!match) throw new Error(`Cell ${cellRef} not found in XML`);

  const openTag = match.openTag.replace(/\s+t="[^"]*"/, "");
  return xml.replace(match.fullMatch, `${openTag}><v>${value}</v></c>`);
}

// Replace only a formula cell's cached <v> value, preserving the <f> element.
// Writing a value equal to the existing one leaves the XML byte-identical.
export function setCellCachedValue(xml, cellRef, value) {
  const match = matchCell(xml, cellRef);
  if (!match) throw new Error(`Cell ${cellRef} not found in XML`);

  const vMatch = match.fullMatch.match(/<v>[^<]*<\/v>/);
  if (!vMatch) throw new Error(`Cell ${cellRef} has no cached <v> value`);

  const newCell = match.fullMatch.replace(vMatch[0], `<v>${value}</v>`);
  return xml.replace(match.fullMatch, newCell);
}

export function setCellString(xml, cellRef, str) {
  const match = matchCell(xml, cellRef);
  if (!match) throw new Error(`Cell ${cellRef} not found in XML`);

  let openTag = match.openTag.replace(/\s+t="[^"]*"/, "");
  openTag += ` t="inlineStr"`;
  return xml.replace(match.fullMatch, `${openTag}><is><t>${escapeXml(str)}</t></is></c>`);
}

// Match a cell element — handles both self-closing (<c .../>) and open/close (<c ...>...</c>).
function matchCell(xml, cellRef) {
  // Try self-closing first: <c r="X" .../>
  const selfClosing = new RegExp(`<c\\s+r="${cellRef}"\\s[^>]*?/>`, "s");
  let m = xml.match(selfClosing);
  if (m) {
    const openTag = m[0].replace(/\s*\/>$/, "");
    return { fullMatch: m[0], openTag };
  }
  // Try open/close: <c r="X" ...>...</c>
  const withContent = new RegExp(`<c\\s+r="${cellRef}"\\s[^>]*?>[\\s\\S]*?</c>`, "s");
  m = xml.match(withContent);
  if (m) {
    const openTag = m[0].replace(/>[\s\S]*$/, "");
    return { fullMatch: m[0], openTag };
  }
  return null;
}

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Tax data → cell edits (BST/Taxi Admin) ─────────────────────────────────

export function buildCellEdits(taxData, startYear) {
  const dates = generateAdminDates(startYear);
  const ty = taxData.tax_year;
  const it = taxData.income_tax;
  const ni = taxData.national_insurance;
  const ca = taxData.capital_allowances;
  const dep = taxData.depreciation;
  const mil = taxData.mileage;

  const numericEdits = {};

  for (const [cell, date] of Object.entries(dates)) {
    numericEdits[cell] = toExcelSerial(date);
  }

  numericEdits.N4 = it.personal_allowance;
  numericEdits.N5 = it.personal_allowance_taper_threshold;
  numericEdits.N6 = it.starting_rate;
  numericEdits.N7 = it.basic_rate;
  numericEdits.N8 = it.higher_rate;
  numericEdits.N9 = it.additional_rate;
  numericEdits.N11 = it.starter_band_end;
  numericEdits.M12 = it.basic_band_end;
  numericEdits.N12 = 0;
  numericEdits.L13 = it.higher_band_start;
  numericEdits.N13 = it.higher_band_start;
  // K12 and K13 are a shared-formula group (=N7, =N8); writing a value into
  // K12 would orphan its follower. K14 sits outside the group.
  numericEdits.K14 = it.additional_rate;
  numericEdits.L14 = it.higher_band_end + 1;
  numericEdits.N14 = it.higher_band_end;

  numericEdits.L17 = ni.class2_rate;
  numericEdits.L20 = ni.class4_lower_rate;
  numericEdits.N20 = ni.class4_lower_limit;
  numericEdits.L23 = ni.class4_upper_rate;
  numericEdits.N23 = ni.class4_upper_limit;

  numericEdits.G4 = ca.annual_investment_allowance;
  numericEdits.G5 = ca.writing_down_allowance;

  numericEdits.G13 = dep.land_and_property;
  numericEdits.G14 = dep.plant_and_machinery;
  numericEdits.G15 = dep.fixtures_and_fittings;
  numericEdits.G16 = dep.computer_equipment;
  numericEdits.G17 = dep.motor_vehicles;

  numericEdits.F21 = mil.higher_rate_limit;
  numericEdits.G21 = mil.higher_rate_pence;
  numericEdits.F22 = mil.lower_rate_start;
  numericEdits.G22 = mil.lower_rate_pence;

  numericEdits.F26 = taxData.vat.registration_threshold;

  const stringEdits = {
    B23: ty.label,
    B24: ty.next_label,
  };

  return { numericEdits, stringEdits };
}

// ── Tax data → cell edits (Taxi Admin) ─────────────────────────────────────
//
// The Taxi Admin income tax block opens on the basic rate, where BST opens on
// the starting rate. Every band row therefore sits one row higher than its BST
// counterpart, and NI Class 2 is on L16 rather than L17. The Taxi workbook
// reads Admin N4, N5, N6, N7, N8, N11, M11 and N13 for tax: writing the BST
// positions here leaves N6 holding the starting rate and M11 holding zero,
// which charges every pound above the personal allowance at the basic rate and
// never reaches the higher band.

export function buildTaxiCellEdits(taxData, startYear) {
  const dates = generateAdminDates(startYear);
  const ty = taxData.tax_year;
  const it = taxData.income_tax;
  const ni = taxData.national_insurance;
  const ca = taxData.capital_allowances;
  const dep = taxData.depreciation;
  const mil = taxData.mileage;

  const numericEdits = {};

  // Dates — same positions as BST
  for (const [cell, date] of Object.entries(dates)) {
    numericEdits[cell] = toExcelSerial(date);
  }

  // Income tax — one row above the BST positions
  numericEdits.N4 = it.personal_allowance;
  numericEdits.N5 = it.personal_allowance_taper_threshold;
  numericEdits.N6 = it.basic_rate; // BST: starting_rate at N6
  numericEdits.N7 = it.higher_rate; // BST: basic_rate at N7
  numericEdits.N8 = it.additional_rate; // BST: higher_rate at N8
  numericEdits.K11 = it.basic_rate; // Display-only copy of the basic rate
  numericEdits.N11 = it.starter_band_end;
  numericEdits.M11 = it.basic_band_end; // BST: M12
  numericEdits.K12 = it.higher_rate; // Display-only copy of the higher rate
  numericEdits.L12 = it.higher_band_start; // BST: L13
  numericEdits.N12 = it.higher_band_start; // BST: N13
  numericEdits.K13 = it.additional_rate; // Display-only copy of the additional rate
  numericEdits.L13 = it.higher_band_end + 1; // BST: L14
  numericEdits.N13 = it.higher_band_end; // BST: N14

  // NI — L16 not L17 for Class 2
  numericEdits.L16 = ni.class2_weekly_rate; // BST: class2_rate at L17
  numericEdits.L20 = ni.class4_lower_rate;
  numericEdits.N20 = ni.class4_lower_limit;
  numericEdits.L23 = ni.class4_upper_rate;
  numericEdits.N23 = ni.class4_upper_limit;

  // Capital allowances — same as BST
  numericEdits.G4 = ca.annual_investment_allowance;
  numericEdits.G5 = ca.writing_down_allowance;

  // Depreciation — same as BST
  numericEdits.G13 = dep.land_and_property;
  numericEdits.G14 = dep.plant_and_machinery;
  numericEdits.G15 = dep.fixtures_and_fittings;
  numericEdits.G16 = dep.computer_equipment;
  numericEdits.G17 = dep.motor_vehicles;

  // Mileage — same as BST
  numericEdits.F21 = mil.higher_rate_limit;
  numericEdits.G21 = mil.higher_rate_pence;
  numericEdits.F22 = mil.lower_rate_start;
  numericEdits.G22 = mil.lower_rate_pence;

  numericEdits.F26 = taxData.vat.registration_threshold;

  const stringEdits = {
    B23: ty.label,
    B24: ty.next_label,
  };

  return { numericEdits, stringEdits };
}

// ── Tax data → cell edits (SE Financialaccounts Admin) ──────────────────────
//
// The SE Admin sheet has different cell positions from BST for income tax bands,
// NI Class 2, and VAT rate. Dates and other rates use the same positions.

export function buildSeCellEdits(taxData, startYear) {
  const dates = { ...generateAdminDates(startYear), ...seVatPaymentDueDate(startYear) };
  const ty = taxData.tax_year;
  const it = taxData.income_tax;
  const ni = taxData.national_insurance;
  const ca = taxData.capital_allowances;
  const dep = taxData.depreciation;
  const mil = taxData.mileage;

  const numericEdits = {};

  // Dates — same positions as BST
  for (const [cell, date] of Object.entries(dates)) {
    numericEdits[cell] = toExcelSerial(date);
  }

  // Income tax — DIFFERENT cell positions from BST
  numericEdits.N4 = it.personal_allowance;
  numericEdits.N5 = it.personal_allowance_taper_threshold;
  numericEdits.N6 = it.basic_rate; // BST: starting_rate at N6
  numericEdits.N7 = it.higher_rate; // BST: basic_rate at N7
  numericEdits.N8 = it.additional_rate; // BST: higher_rate at N8
  numericEdits.K11 = it.basic_rate; // Display-only copy of basic rate
  numericEdits.N11 = it.starter_band_end;
  numericEdits.M11 = it.basic_band_end; // BST: M12
  numericEdits.K12 = it.higher_rate; // Display-only copy of the higher rate
  numericEdits.L12 = it.higher_band_start; // BST: L13
  numericEdits.N12 = it.higher_band_start; // BST: N13
  numericEdits.K13 = it.additional_rate; // Display-only copy of the additional rate
  numericEdits.L13 = it.higher_band_end + 1; // BST: L14
  numericEdits.N13 = it.higher_band_end; // BST: N14

  // NI — L16 not L17 for Class 2
  numericEdits.L16 = ni.class2_weekly_rate; // BST: class2_rate at L17
  numericEdits.L20 = ni.class4_lower_rate;
  numericEdits.N20 = ni.class4_lower_limit;
  numericEdits.L23 = ni.class4_upper_rate;
  numericEdits.N23 = ni.class4_upper_limit;

  // Capital allowances — same as BST
  numericEdits.G4 = ca.annual_investment_allowance;
  numericEdits.G5 = ca.writing_down_allowance;

  // Depreciation — same as BST
  numericEdits.G13 = dep.land_and_property;
  numericEdits.G14 = dep.plant_and_machinery;
  numericEdits.G15 = dep.fixtures_and_fittings;
  numericEdits.G16 = dep.computer_equipment;
  numericEdits.G17 = dep.motor_vehicles;

  // Mileage — same as BST
  numericEdits.F21 = mil.higher_rate_limit;
  numericEdits.G21 = mil.higher_rate_pence;
  numericEdits.F22 = mil.lower_rate_start;
  numericEdits.G22 = mil.lower_rate_pence;

  // VAT — threshold same, standard rate is SE-only
  numericEdits.F26 = taxData.vat.registration_threshold;
  numericEdits.F27 = taxData.vat.standard_rate;

  const stringEdits = {
    B23: ty.label,
    B24: ty.next_label,
  };

  return { numericEdits, stringEdits };
}

// ── Tax data → cell edits (Ltd Company Financialaccounts Admin) ─────────────
//
// The Ltd Admin is much simpler than BST/SE: F21 (year-end date) is the ONLY
// date cell to set — all other dates cascade via formulas. Tax rate cells use
// whole-number percentages (19 = 19%, 20 = 20%), not fractions.

export function buildLtdCellEdits(taxData, yearEndSerial) {
  const ca = taxData.capital_allowances;
  const dep = taxData.depreciation;
  const mil = taxData.mileage;
  const ct = taxData.corporation_tax;

  const numericEdits = {};

  // Year-end date — the ONE date cell. All others are formula-driven from F21.
  numericEdits.F21 = yearEndSerial;

  // Corporation Tax rates (stored as whole-number percentages in the spreadsheet)
  numericEdits.P6 = Math.round(ct.small_profits_rate * 100);
  numericEdits.P7 = Math.round(ct.small_profits_rate * 100);
  numericEdits.P8 = Math.round(ct.main_rate * 100);

  // Marginal relief: the fraction and the two profit limits it tapers between
  numericEdits.P9 = ct.marginal_relief_fraction;
  numericEdits.P12 = ct.small_profits_limit;
  numericEdits.P13 = ct.main_rate_limit;

  // Capital allowances (stored as whole-number percentages)
  numericEdits.G5 = Math.round(ca.annual_investment_allowance * 100);
  numericEdits.G7 = Math.round(ca.annual_investment_allowance * 100);
  numericEdits.G6 = Math.round(ca.writing_down_allowance_main * 100);
  numericEdits.G8 = Math.round(ca.writing_down_allowance_main * 100);

  // Depreciation (stored as fractions — same as BST/SE)
  numericEdits.G15 = dep.land_and_property;
  numericEdits.G16 = dep.plant_and_machinery;
  numericEdits.G17 = dep.fixtures_and_fittings;
  numericEdits.G18 = dep.computer_equipment;
  numericEdits.G19 = dep.motor_vehicles;

  // Mileage
  numericEdits.N16 = mil.higher_rate_limit;
  numericEdits.O16 = mil.higher_rate_pence;
  numericEdits.N17 = mil.lower_rate_start;
  numericEdits.O17 = mil.lower_rate_pence;

  // VAT rate (stored as whole-number percentage)
  numericEdits.M19 = Math.round(taxData.vat.standard_rate * 100);
  numericEdits.M21 = Math.round(taxData.vat.standard_rate * 100);

  return { numericEdits, stringEdits: {} };
}

// ── Ltd Admin cached B-column date roll ─────────────────────────────────────
//
// The Ltd Admin B-column is a chain of formula cells anchored at B32 = F21:
// even rows cache monthEnd(yearEnd + (r-32)/2 months), odd rows cache the
// following day (the first of the next month). Spreadsheet apps updating
// links against a closed Financialaccounts.xlsx read these STORED cached
// values — they never recalculate — so the cached serials must agree with
// the F21 year-end literal, not the template's snapshot. Rolls every B-cell
// whose cached value matches the template's year-end-relative rule value;
// non-matching cached cells (labels, non-date content) are left untouched.

export function ltdAdminBColumnSerial(yearEndSerial, row) {
  const monthsOffset = (row - (row % 2 === 0 ? 32 : 33)) / 2;
  const anchor = fromExcelSerial(yearEndSerial);
  const monthIndex = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + monthsOffset;
  const serial = toExcelSerial(monthEnd(Math.floor(monthIndex / 12), (monthIndex % 12) + 1));
  // Odd rows hold the first day of the month after the preceding even row.
  return row % 2 === 0 ? serial : serial + 1;
}

export function rollLtdAdminCachedDates(adminXml, templateYearEndSerial, yearEndSerial) {
  const ruleValue = ltdAdminBColumnSerial;

  const rows = new Set();
  for (const [, rowStr] of adminXml.matchAll(/<c r="B(\d+)"/g)) {
    rows.add(parseInt(rowStr, 10));
  }

  for (const row of rows) {
    const match = matchCell(adminXml, `B${row}`);
    const vMatch = match.fullMatch.match(/<v>([^<]*)<\/v>/);
    if (!vMatch) continue;
    if (parseFloat(vMatch[1]) !== ruleValue(templateYearEndSerial, row)) continue;
    adminXml = setCellCachedValue(adminXml, `B${row}`, ruleValue(yearEndSerial, row));
  }

  const b32 = matchCell(adminXml, "B32");
  const b32Value = b32 && b32.fullMatch.match(/<v>([^<]*)<\/v>/);
  if (!b32Value || parseFloat(b32Value[1]) !== yearEndSerial) {
    throw new Error(
      `Admin B32 cached value ${b32Value ? b32Value[1] : "(missing)"} does not equal the F21 year-end serial ${yearEndSerial}`,
    );
  }

  return adminXml;
}

// ── Ltd Admin corporation tax rate rows ─────────────────────────────────────
//
// The Admin rate table sets out the accounting period as the one or two UK
// financial years it falls in. Row 6 runs from the period start to the 31
// March inside the period (or to the year end, whichever comes first) and row
// 7 runs from the day after that to the year end, so a period wholly inside
// one financial year leaves row 7 empty. K6 and K7 name each row's financial
// year, which is the calendar year the 1 April before it started in.
//
// Fixedassets.xlsx reads Admin!N7 across the external link, and a spreadsheet
// app updating that link against a closed Financialaccounts.xlsx reads the
// STORED cached value rather than recalculating, so these six formula cells
// need their cached values rolled to the package's own year end.

export function ltdAdminFinancialYearRows(yearEndSerial) {
  const yearEnd = fromExcelSerial(yearEndSerial);
  const periodStart = fromExcelSerial(toExcelSerial(monthEnd(yearEnd.getUTCFullYear() - 1, yearEnd.getUTCMonth() + 1)) + 1);

  let firstYearEnd = utcDate(periodStart.getUTCFullYear(), 3, 31);
  if (firstYearEnd < periodStart) firstYearEnd = utcDate(periodStart.getUTCFullYear() + 1, 3, 31);
  if (firstYearEnd > yearEnd) firstYearEnd = yearEnd;

  const secondYearStart = fromExcelSerial(toExcelSerial(firstYearEnd) + 1);
  const financialYearOf = (date) => date.getUTCFullYear() - (date.getUTCMonth() + 1 < 4 ? 1 : 0);

  return {
    K6: financialYearOf(periodStart),
    L6: toExcelSerial(periodStart),
    N6: toExcelSerial(firstYearEnd),
    K7: financialYearOf(secondYearStart),
    L7: toExcelSerial(secondYearStart),
    N7: yearEndSerial,
  };
}

export function rollLtdAdminCachedRateRows(adminXml, yearEndSerial) {
  for (const [cellRef, value] of Object.entries(ltdAdminFinancialYearRows(yearEndSerial))) {
    adminXml = setCellCachedValue(adminXml, cellRef, value);
  }
  return adminXml;
}

// Every Ltd Admin cell another workbook can cache across an external link,
// resolved to the value this package's Admin sheet holds: the rates and
// thresholds the generator writes, the two financial year rows, the B-column
// date chain, and the date cells that echo it.

export function ltdAdminCachedValues(taxData, yearEndSerial) {
  const { numericEdits } = buildLtdCellEdits(taxData, yearEndSerial);
  const values = { ...numericEdits, ...ltdAdminFinancialYearRows(yearEndSerial) };
  for (let row = 2; row <= 56; row++) values[`B${row}`] = ltdAdminBColumnSerial(yearEndSerial, row);
  values.F5 = values.B8;
  values.F6 = values.B8;
  values.F7 = values.B32;
  values.F8 = values.B32;
  values.L10 = values.B8;
  values.N10 = values.B8;
  values.L11 = values.B32;
  values.N11 = values.B32;
  return values;
}

// ── Ltd Financialaccounts cross-sheet cached values ─────────────────────────
//
// Several report sheets in the same Financialaccounts.xlsx workbook cache a
// formula result that reads the local Admin sheet directly (not across an
// external link): CorporationTax, CT600, PubP&L, PubBalSht, PubNotes and
// Report all echo the accounting period Admin!F21 and the two financial-year
// rows Admin!K6/L6/N6/K7/L7/N7 compute. Grouped by sheet name for
// rollDependentSheetCaches().

export function ltdFinancialaccountsDependentCaches(yearEndSerial) {
  const rows = ltdAdminFinancialYearRows(yearEndSerial);
  return {
    "CorporationTax": {
      E5: rows.L6, // =Admin!L6
      H5: rows.N7, // =Admin!N7
      E33: rows.K6, // =Admin!K6
      E34: rows.K7, // =Admin!K7
      A33: rows.N6 - rows.L6 + 1, // =D33-C33+1, D33=Admin!N6, C33=Admin!L6
      A34: Math.max(0, rows.N7 - rows.L7 + 1), // =MAX(0,D34-C34+1), D34=Admin!N7, C34=Admin!L7
    },
    "CT600": {
      B33: rows.L6, // =Admin!L6
      M33: rows.N7, // =Admin!N7
      C126: rows.K6, // =CorporationTax!E33
    },
    "PubP&L": {
      D3: yearEndSerial, // =Admin!B32 (=F21)
      E5: yearEndSerial, // =D3
    },
    "PubBalSht": { D2: yearEndSerial }, // ='PubP&L'!D3
    "PubNotes": { A11: yearEndSerial }, // ='PubP&L'!D3
    "Report": { F22: yearEndSerial }, // =PubBalSht!D2
  };
}

// ── SE Financialaccounts cross-sheet cached values ──────────────────────────
//
// SE Full!G1 is "...by 31st January "&TEXT(Admin!B21,"yyyy") — B21 is always
// 31 January of the second calendar year after the tax year's start, so only
// the year needs rolling. G141, Q2 and V2 echo the local Admin sheet's
// writing-down allowance rate and tax-year start/end dates; SE Short!Q2
// echoes the same Admin!B4 date and S17 echoes SE Short!Q2 in turn.
// Profit Forecast!C40 is
// IF(C39<=0,0,MAX(0,Admin!N$4-MAX(0,C39-Admin!N$5)/2)); the generator never
// writes to Profit Forecast, 'Profit & Loss Account' or the Fixedassets
// external link C39's own formula reads, so C39 keeps the template's shipped
// 0 and C40 always resolves to the IF's first branch. SE Short!A33 is
// IF(D38>67000,"...exceeds...","...below £"&Admin!F26&" VAT threshold"): D38
// (turnover) is 'Profit & Loss Account'!B9, untouched by the generator and so
// always the template's shipped 0, which keeps A33 on the "below" branch;
// only the VAT threshold Admin!F26 echoes needs rolling. SE Short!C8 reads
// 'Business Details'!C5, which the generator never writes either, so it
// keeps the template's shipped blank and needs no roll.

export function seFinancialaccountsDependentCaches(numericEdits) {
  return {
    "SE Full": {
      G1: `COPY DETAILS TO HMRC FORM          Submit HMRC RETURN ONLINE                   by 31st January ${fromExcelSerial(numericEdits.B21).getUTCFullYear()}`,
      G141: numericEdits.G5, // =Admin!G5
      Q2: numericEdits.B4, // =Admin!B4
      V2: numericEdits.B17, // =Admin!B17
    },
    "SE Short": {
      Q2: numericEdits.B4, // =Admin!B4
      S17: numericEdits.B4, // =Q2 (=Admin!B4)
      A33: `Business income - if your annual turnover was below £${numericEdits.F26} VAT threshold`,
    },
    "Profit Forecast": {
      C40: 0,
    },
  };
}

// Write a { SheetName: { cellRef: value } } map of cached formula results
// into their sheets within an already-loaded workbook zip.
async function rollDependentSheetCaches(zip, sheetMap, editsBySheet) {
  for (const [sheetName, cellEdits] of Object.entries(editsBySheet)) {
    const sheetPath = sheetMap.get(sheetName);
    if (!sheetPath) throw new Error(`Sheet ${sheetName} not found while rolling dependent caches`);
    let sheetXml = await zip.file(sheetPath).async("string");
    for (const [cellRef, value] of Object.entries(cellEdits)) {
      sheetXml = setCellCachedValue(sheetXml, cellRef, value);
    }
    const originalDate = zip.file(sheetPath).date;
    zip.file(sheetPath, sheetXml, { date: originalDate });
  }
}

// ── Payslips Admin calendar generation ──────────────────────────────────────
//
// Generates the C (week), D (month), F (week-in-month) columns for the
// Payslips Admin sheet. These are hardcoded values — no formulas.
//
// Algorithm (verified against all 9 existing packages with zero mismatches):
//   Week 1 = always 5 days (Apr 6–10)
//   Weeks 2–52 = 7 days each (starting Apr 11)
//   Week 53 = remainder (18 days, extending ~15 days past tax year end)
//   Month pattern = fixed [4,4,5, 4,4,5, 4,4,5, 4,4,6] totalling 53 weeks

export function generatePayslipsCalendar(startYear) {
  const WEEKS_PER_MONTH = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 6];
  const TOTAL_ROWS = 380; // Apr 6 through ~Apr 20 next year

  const edits = {};
  let week = 1;
  let month = 1;
  let weekInMonth = 1;
  let dayInWeek = 1;
  let weeksInCurrentMonth = WEEKS_PER_MONTH[0];

  for (let i = 0; i < TOTAL_ROWS; i++) {
    const row = i + 2; // rows start at 2
    edits[`C${row}`] = week;
    edits[`D${row}`] = month;
    edits[`F${row}`] = weekInMonth;

    dayInWeek++;

    // Week 1 = 5 days, all other weeks = 7 days (week 53 = 18 days)
    const weekLength = week === 1 ? 5 : week < 53 ? 7 : 18;
    if (dayInWeek > weekLength) {
      dayInWeek = 1;
      week++;

      // Check if we've completed enough weeks for this month
      if (weekInMonth >= weeksInCurrentMonth && month < 12) {
        month++;
        weekInMonth = 1;
        weeksInCurrentMonth = WEEKS_PER_MONTH[month - 1];
      } else {
        weekInMonth++;
      }
    }
  }

  return edits;
}

// ── Payslips Admin cached date chain ────────────────────────────────────────
//
// The Payslips Admin sheet anchors a daily date chain at B2 (the tax year
// start, a generator-written literal): B3 = B2+1, B4 = B3+1, and so on down
// to B381, plus I1 = the day before the following year's B2 (the tax year
// end) and N1 = the "YYYY-YY" label built from I1's year. All of these are
// formula cells whose cached values still carry the template's own year
// until rolled to the package's own tax year.

export function rollPayslipsAdminCachedDates(payslipsXml, startYear) {
  const startSerial = toExcelSerial(utcDate(startYear, 4, 6));

  const rows = new Set();
  for (const [, rowStr] of payslipsXml.matchAll(/<c r="B(\d+)"/g)) {
    const row = parseInt(rowStr, 10);
    if (row >= 3) rows.add(row);
  }
  for (const row of rows) {
    const match = matchCell(payslipsXml, `B${row}`);
    if (!match || !match.fullMatch.includes("<v>")) continue;
    payslipsXml = setCellCachedValue(payslipsXml, `B${row}`, startSerial + (row - 2));
  }

  const endSerial = toExcelSerial(utcDate(startYear + 1, 4, 5));
  payslipsXml = setCellCachedValue(payslipsXml, "I1", endSerial);
  payslipsXml = setCellCachedValue(payslipsXml, "N1", `${startYear}-${startYear + 1 - 2000}`);

  return payslipsXml;
}

// The daily chain's first and last rows. Rolling stops at the last because a
// reference past it reads a cell the chain never reaches.
const PAYSLIPS_ADMIN_FIRST_CALENDAR_ROW = 2;
const PAYSLIPS_ADMIN_CHAIN_LAST_ROW = 381;

// Every sheet in the Payslips workbook reads dates back off the Admin chain
// -- the month tabs their wages-paid and period dates, the Payment schedule
// its due dates, the Employee sheet its calendar column. Each of those cells
// keeps its own cached copy, which rolling the Admin sheet alone does not
// reach, so they would still print the template's year until the workbook was
// recalculated.
export function rollPayslipsAdminDateReads(sheetXml, startYear) {
  const startSerial = toExcelSerial(utcDate(startYear, 4, 6));
  let xml = sheetXml;
  for (const [, cellRef, rowStr] of [...xml.matchAll(/<c\s+r="([A-Z]+\d+)"[^>]*><f>Admin!\$?B\$?(\d+)<\/f><v>[^<]*<\/v><\/c>/g)]) {
    const row = parseInt(rowStr, 10);
    if (row < 2 || row > PAYSLIPS_ADMIN_CHAIN_LAST_ROW) continue;
    xml = setCellCachedValue(xml, cellRef, startSerial + (row - 2));
  }
  return xml;
}

// ── Sales date generation (Taxi Driver) ────────────────────────────────────

// Generate all weeks of the tax year as arrays of Date objects.
// First week: April 6 to first Sunday. Full weeks: Mon-Sun.
// Last week: last Monday to April 5 (may be partial).
export function generateTaxYearWeeks(startYear) {
  const taxYearStart = utcDate(startYear, 4, 6);
  const taxYearEnd = utcDate(startYear + 1, 4, 5);

  const weeks = [];
  const current = new Date(taxYearStart);

  // First week: April 6 to first Sunday (inclusive)
  const firstWeek = [];
  do {
    firstWeek.push(new Date(current));
    if (current.getUTCDay() === 0) break; // Sunday
    current.setUTCDate(current.getUTCDate() + 1);
  } while (current <= taxYearEnd);
  weeks.push(firstWeek);
  current.setUTCDate(current.getUTCDate() + 1);

  // Full Monday-Sunday weeks (last week may be partial ending Apr 5)
  while (current <= taxYearEnd) {
    const week = [];
    for (let d = 0; d < 7 && current <= taxYearEnd; d++) {
      week.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

// Group weeks into monthly Sales sheets.
// Rule: a week belongs to the month containing its Sunday (last day if full).
// SalesMar collects all remaining weeks after February.
export function groupWeeksIntoMonths(weeks) {
  const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const result = {};
  for (const k of monthKeys) result[k] = [];

  // Process Apr(3) through Feb(1) in tax-year order
  const monthOrder = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1];
  let weekIdx = 0;

  for (const monthIndex of monthOrder) {
    while (weekIdx < weeks.length) {
      const week = weeks[weekIdx];
      const lastDay = week[week.length - 1];
      if (lastDay.getUTCDay() !== 0) break; // no Sunday — partial last week
      if (lastDay.getUTCMonth() !== monthIndex) break;
      result[monthKeys[monthIndex]].push(week);
      weekIdx++;
    }
  }

  // All remaining weeks go to March (SalesMar)
  while (weekIdx < weeks.length) {
    result.mar.push(weeks[weekIdx]);
    weekIdx++;
  }

  return result;
}

// Build the <sheetData> XML for one monthly Sales sheet.
// Returns { xml, lastRow } where xml is the inner content of <sheetData>.
export function buildSalesSheetXml(monthWeeks) {
  const rows = [];
  const weekCount = monthWeeks.length;

  // Calculate total last row for column total formulas
  let lastRow = 4; // start after header rows
  for (let w = 0; w < weekCount; w++) {
    const days = monthWeeks[w].length;
    lastRow += days + 3; // days + rental + other income + subtotal
    if (w < weekCount - 1) lastRow += 1; // blank separator (not after last week)
  }

  // Row 1: Column totals
  rows.push(
    `<row r="1" spans="1:6" s="302" customFormat="1" ht="12.75" customHeight="1" x14ac:dyDescent="0.15">` +
      `<c r="A1" s="486" t="s"><v>241</v></c>` +
      `<c r="B1" s="484" t="s"><v>240</v></c>` +
      `<c r="C1" s="303" t="s"><v>239</v></c>` +
      `<c r="D1" s="304"><f>SUM(D4:D${lastRow})</f><v>0</v></c>` +
      `<c r="E1" s="303"><f>SUM(E4:E${lastRow})/2</f><v>0</v></c>` +
      `<c r="F1" s="303"><f>SUM(F4:F${lastRow})/2</f><v>0</v></c>` +
      `</row>`,
  );

  // Row 2: Column headers
  rows.push(
    `<row r="2" spans="1:6" s="302" customFormat="1" ht="12.75" customHeight="1" x14ac:dyDescent="0.15">` +
      `<c r="A2" s="487"/><c r="B2" s="485"/>` +
      `<c r="C2" s="482" t="s"><v>238</v></c>` +
      `<c r="D2" s="488" t="s"><v>237</v></c>` +
      `<c r="E2" s="482" t="s"><v>236</v></c>` +
      `<c r="F2" s="482" t="s"><v>235</v></c>` +
      `</row>`,
  );

  // Row 3: Column headers continued (merged)
  rows.push(
    `<row r="3" spans="1:6" s="301" customFormat="1" ht="24" customHeight="1" x14ac:dyDescent="0.15">` +
      `<c r="A3" s="487"/><c r="B3" s="485"/>` +
      `<c r="C3" s="490"/><c r="D3" s="489"/>` +
      `<c r="E3" s="483"/><c r="F3" s="483"/>` +
      `</row>`,
  );

  // Row 4: Blank separator
  rows.push(`<row r="4" spans="1:6" ht="14" thickBot="1" x14ac:dyDescent="0.2"/>`);

  let currentRow = 5;

  for (let w = 0; w < weekCount; w++) {
    const days = monthWeeks[w];
    const firstDayRow = currentRow;

    // Day rows
    for (let d = 0; d < days.length; d++) {
      const serial = toExcelSerial(days[d]);
      const r = currentRow;
      if (d === 0) {
        // First day of week — special styles with empty editable cells
        rows.push(
          `<row r="${r}" spans="1:6" x14ac:dyDescent="0.15">` +
            `<c r="A${r}" s="298"><v>${serial}</v></c>` +
            `<c r="B${r}" s="297"><v>${serial}</v></c>` +
            `<c r="C${r}" s="296"/><c r="D${r}" s="295"/>` +
            `<c r="E${r}" s="294"/><c r="F${r}" s="293"/>` +
            `</row>`,
        );
      } else {
        rows.push(
          `<row r="${r}" spans="1:6" x14ac:dyDescent="0.15">` +
            `<c r="A${r}" s="292"><v>${serial}</v></c>` +
            `<c r="B${r}" s="285"><v>${serial}</v></c>` +
            `<c r="F${r}" s="291"/>` +
            `</row>`,
        );
      }
      currentRow++;
    }

    // Rental due row — date = last day of the week
    const lastDaySerial = toExcelSerial(days[days.length - 1]);
    rows.push(
      `<row r="${currentRow}" spans="1:6" x14ac:dyDescent="0.15">` +
        `<c r="A${currentRow}" s="292"><v>${lastDaySerial}</v></c>` +
        `<c r="B${currentRow}" s="285" t="s"><v>234</v></c>` +
        `<c r="F${currentRow}" s="291"/>` +
        `</row>`,
    );
    currentRow++;

    // Any other income row
    rows.push(
      `<row r="${currentRow}" spans="1:6" x14ac:dyDescent="0.15">` +
        `<c r="A${currentRow}" s="292"><v>${lastDaySerial}</v></c>` +
        `<c r="B${currentRow}" s="285" t="s"><v>233</v></c>` +
        `<c r="F${currentRow}" s="291"/>` +
        `</row>`,
    );
    const lastDataRow = currentRow;
    currentRow++;

    // Subtotal row
    rows.push(
      `<row r="${currentRow}" spans="1:6" ht="14" thickBot="1" x14ac:dyDescent="0.2">` +
        `<c r="A${currentRow}" s="290"/><c r="B${currentRow}" s="289"/>` +
        `<c r="C${currentRow}" s="287"/><c r="D${currentRow}" s="288"/>` +
        `<c r="E${currentRow}" s="300"><f>SUM(E${firstDayRow}:E${lastDataRow})</f><v>0</v></c>` +
        `<c r="F${currentRow}" s="299"><f>SUM(F${firstDayRow}:F${lastDataRow})</f><v>0</v></c>` +
        `</row>`,
    );
    currentRow++;

    // Blank separator (not after last week)
    if (w < weekCount - 1) {
      rows.push(`<row r="${currentRow}" spans="1:6" ht="14" thickBot="1" x14ac:dyDescent="0.2"/>`);
      currentRow++;
    }
  }

  return { xml: rows.join(""), lastRow: currentRow - 1 };
}

// Replace the <sheetData> and <dimension> in a Sales sheet XML.
function replaceSalesSheetData(sheetXml, monthWeeks) {
  const { xml: newData, lastRow } = buildSalesSheetXml(monthWeeks);

  // Update dimension
  sheetXml = sheetXml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:F${lastRow}"/>`);

  // Replace sheetData content
  sheetXml = sheetXml.replace(/<sheetData>[\s\S]*<\/sheetData>/, `<sheetData>${newData}</sheetData>`);

  return sheetXml;
}

// ── Generate one spreadsheet ────────────────────────────────────────────────

export async function generateSpreadsheet(templateBuffer, taxData, sheetsConfig) {
  // SE/BST use tax_year, Ltd uses financial_year
  const yearInfo = taxData.tax_year || taxData.financial_year;
  const startDate = new Date(yearInfo.start);
  const startYear = startDate.getUTCFullYear();
  const endDate = new Date(yearInfo.end);

  const zip = await JSZip.loadAsync(templateBuffer);

  // Admin sheet edits — dispatch to product-specific cell edit function
  if (sheetsConfig.admin) {
    let adminXml = await zip.file(sheetsConfig.admin).async("string");

    let numericEdits, stringEdits;
    let templateYearEndSerial;
    if (sheetsConfig.cellEditFn === "ltd") {
      const yearEndSerial = toExcelSerial(endDate);
      ({ numericEdits, stringEdits } = buildLtdCellEdits(taxData, yearEndSerial));
      // Capture the template's own year-end before the F21 edit overwrites it —
      // it anchors the cached B-column roll below.
      const templateF21 = matchCell(adminXml, "F21");
      const templateF21Value = templateF21 && templateF21.fullMatch.match(/<v>([^<]*)<\/v>/);
      if (!templateF21Value) throw new Error("Admin F21 has no year-end value in the template");
      templateYearEndSerial = parseFloat(templateF21Value[1]);
    } else {
      const buildFn = { se: buildSeCellEdits, taxi: buildTaxiCellEdits }[sheetsConfig.cellEditFn] ?? buildCellEdits;
      ({ numericEdits, stringEdits } = buildFn(taxData, startYear));
    }

    for (const [cellRef, value] of Object.entries(numericEdits)) {
      adminXml = setCellValue(adminXml, cellRef, value);
    }
    for (const [cellRef, str] of Object.entries(stringEdits)) {
      adminXml = setCellString(adminXml, cellRef, str);
    }

    if (sheetsConfig.cellEditFn === "ltd") {
      adminXml = rollLtdAdminCachedDates(adminXml, templateYearEndSerial, toExcelSerial(endDate));
      adminXml = rollLtdAdminCachedRateRows(adminXml, toExcelSerial(endDate));
    }

    const originalDate = zip.file(sheetsConfig.admin).date;
    zip.file(sheetsConfig.admin, adminXml, { date: originalDate });

    // Other report sheets in this same workbook cache a formula result that
    // reads the local Admin sheet directly; roll those to match.
    if (sheetsConfig.cellEditFn === "ltd" || sheetsConfig.cellEditFn === "se") {
      const sheetMap = await buildSheetMap(zip);
      const editsBySheet =
        sheetsConfig.cellEditFn === "ltd"
          ? ltdFinancialaccountsDependentCaches(toExcelSerial(endDate))
          : seFinancialaccountsDependentCaches(numericEdits);
      await rollDependentSheetCaches(zip, sheetMap, editsBySheet);
    }
  }

  // Fixedassets reads the Admin sheet's allowance rates and the accounting
  // period across its external link. A spreadsheet app updating that link
  // against a closed Financialaccounts.xlsx reads this cache until the user
  // refreshes it, so it has to carry this package's values, not the
  // template's snapshot.
  if (sheetsConfig.adminExternalLink) {
    const linkPath = sheetsConfig.adminExternalLink;
    const relsPath = linkPath.replace(/externalLinks\/(externalLink\d+)\.xml$/, "externalLinks/_rels/$1.xml.rels");
    const relsXml = await zip.file(relsPath).async("string");
    if (!relsXml.includes('Target="Financialaccounts.xlsx"')) {
      throw new Error(`${linkPath} does not target Financialaccounts.xlsx`);
    }

    const adminValues = ltdAdminCachedValues(taxData, toExcelSerial(endDate));
    const linkXmlOriginal = await zip.file(linkPath).async("string");
    const sheetNames = [...linkXmlOriginal.matchAll(/<sheetName val="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    const adminSheetId = sheetNames.indexOf("Admin");
    if (adminSheetId < 0) throw new Error(`${linkPath} lists no Admin sheet`);

    const block = linkXmlOriginal.match(new RegExp(`<sheetData sheetId="${adminSheetId}">[\\s\\S]*?</sheetData>`));
    if (!block) throw new Error(`${linkPath} caches no Admin cells`);
    const rolledBlock = block[0].replace(/<cell r="([A-Z]+\d+)"([^>]*)><v>[^<]*<\/v><\/cell>/g, (_match, cellRef, attrs) => {
      if (adminValues[cellRef] === undefined) {
        throw new Error(`${linkPath} caches Admin!${cellRef}, which has no generated value`);
      }
      return `<cell r="${cellRef}"${attrs}><v>${adminValues[cellRef]}</v></cell>`;
    });

    const linkXml = linkXmlOriginal.replace(block[0], rolledBlock);
    if (linkXml !== linkXmlOriginal) {
      zip.file(linkPath, linkXml, { date: zip.file(linkPath).date, createFolders: false });
    }
  }

  // Sales sheet generation (Taxi only — when sheetsConfig.sales is present)
  if (sheetsConfig.sales) {
    const weeks = generateTaxYearWeeks(startYear);
    const monthlyData = groupWeeksIntoMonths(weeks);
    const monthKeys = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"];

    for (const monthKey of monthKeys) {
      const sheetPath = sheetsConfig.sales[monthKey];
      if (!sheetPath || !monthlyData[monthKey].length) continue;

      let sheetXml = await zip.file(sheetPath).async("string");
      sheetXml = replaceSalesSheetData(sheetXml, monthlyData[monthKey]);

      const origDate = zip.file(sheetPath).date;
      zip.file(sheetPath, sheetXml, { date: origDate });
    }

    // Remove calcChain.xml — the generated Sales sheets have different formulas
    // than the template, so the cached chain is stale. fullCalcOnLoad="1" ensures
    // Excel rebuilds it from scratch on first open.
    if (zip.file("xl/calcChain.xml")) {
      zip.remove("xl/calcChain.xml");
    }
  }

  // Fix Home sheet HYPERLINKs: replace filename-based links (HYPERLINK(B3&"'Sheet'!Cell"))
  // with intra-workbook # links (HYPERLINK("#'Sheet'!Cell")) so they work regardless of filename.
  if (sheetsConfig.home) {
    let homeXml = await zip.file(sheetsConfig.home).async("string");
    if (homeXml.includes('B3&amp;"')) {
      homeXml = homeXml.replace(/HYPERLINK\(B3&amp;"'/g, `HYPERLINK("#'`);
      const homeDate = zip.file(sheetsConfig.home).date;
      zip.file(sheetsConfig.home, homeXml, { date: homeDate });
    }
  }

  // Payslips Admin calendar generation (when sheetsConfig.payslipsAdmin is present)
  if (sheetsConfig.payslipsAdmin) {
    let payslipsXml = await zip.file(sheetsConfig.payslipsAdmin).async("string");

    // Set B2 = tax year start date (all other dates cascade via shared formulas)
    const taxYearStartSerial = toExcelSerial(utcDate(startYear, 4, 6));
    payslipsXml = setCellValue(payslipsXml, "B2", taxYearStartSerial);

    // Regenerate C (week), D (month), F (week-in-month) — hardcoded values
    const calendarEdits = generatePayslipsCalendar(startYear);
    for (const [cellRef, value] of Object.entries(calendarEdits)) {
      payslipsXml = setCellValue(payslipsXml, cellRef, value);
    }

    // Roll the B3:B381 daily date chain and its I1/N1 dependents to this
    // package's tax year.
    payslipsXml = rollPayslipsAdminCachedDates(payslipsXml, startYear);

    const payslipsDate = zip.file(sheetsConfig.payslipsAdmin).date;
    zip.file(sheetsConfig.payslipsAdmin, payslipsXml, { date: payslipsDate });

    // Roll the cached copies the workbook's other sheets keep of the same
    // chain, so a package that is never recalculated still shows its own
    // year's dates on the month tabs and the PAYE payment schedule.
    for (const file of zip.file(/^xl\/worksheets\/sheet\d+\.xml$/)) {
      if (file.name === sheetsConfig.payslipsAdmin) continue;
      const rolled = rollPayslipsAdminDateReads(await file.async("string"), startYear);
      zip.file(file.name, rolled, { date: file.date });
    }
  }

  // Expenses claim form (Ltd only — when sheetsConfig.mileageMonth is
  // present). The mileage rate is a literal on the first month's sheet and
  // every other month chains from it, so one write moves the caption, the
  // rate and the claim on all twelve.
  if (sheetsConfig.mileageMonth) {
    let monthXml = await zip.file(sheetsConfig.mileageMonth).async("string");
    monthXml = setCellValue(monthXml, "C30", taxData.mileage.higher_rate_pence);
    const monthDate = zip.file(sheetsConfig.mileageMonth).date;
    zip.file(sheetsConfig.mileageMonth, monthXml, { date: monthDate });
  }

  // Sales invoice VAT rate (Salesinvoice.xlsx Product Details, SE and Ltd
  // only, when sheetsConfig.productDetails is present). The template hard-
  // codes every product row's "VAT Rate" column at a literal 20, with no tie
  // to the tax year the invoice is raised in (discovered from the XML:
  // Product Details!D2:D99, header D1 the shared string "VAT Rate"). This
  // workbook has no external link into the rest of the book, so the wrong
  // figure never reached the accounts -- it reached the customer's customer.
  if (sheetsConfig.productDetails) {
    let productDetailsXml = await zip.file(sheetsConfig.productDetails).async("string");
    const vatRatePercent = Math.round(taxData.vat.standard_rate * 100);
    for (let row = SALESINVOICE_PRODUCT_DETAILS_FIRST_ROW; row <= SALESINVOICE_PRODUCT_DETAILS_LAST_ROW; row++) {
      productDetailsXml = setCellValue(productDetailsXml, `${SALESINVOICE_PRODUCT_DETAILS_VAT_RATE_COLUMN}${row}`, vatRatePercent);
    }
    const productDetailsDate = zip.file(sheetsConfig.productDetails).date;
    zip.file(sheetsConfig.productDetails, productDetailsXml, { date: productDetailsDate });
  }

  // VAT quarter dates (when sheetsConfig has vatQtr1..vatQtr5): write each
  // return form's default G5 from VAT_RETURN_END_MONTHS, then roll the whole
  // cached date chain — the externalLink1 Admin cache, the Vatinterface cached
  // values, and each form's K2:K16 dropdown list — to this package's year.
  if (sheetsConfig.vatQtr1) {
    if (!sheetsConfig.vatinterface) {
      throw new Error("sheetsConfig has vatQtr sheets but no vatinterface path");
    }

    // The first of the book's twelve month tabs, which is also the first
    // accounting-year period the Vatinterface carries. A year that ends on a
    // month end starts the month after, so year-end Mar 2026 gives Apr 2025.
    // A Self Employed year ends on 5 April, mid-month, and its tabs still run
    // April to March, so it takes the month its own start date falls in.
    const yearEndMonth = endDate.getUTCMonth() + 1; // 1-indexed
    const yearEndYear = endDate.getUTCFullYear();
    const yearEndsOnMonthEnd = endDate.getUTCDate() === lastDayOfMonth(yearEndYear, yearEndMonth);
    const vatStartMonth = yearEndsOnMonthEnd ? (yearEndMonth % 12) + 1 : startDate.getUTCMonth() + 1;
    const vatStartYear = yearEndsOnMonthEnd ? (vatStartMonth > yearEndMonth ? yearEndYear - 1 : yearEndYear) : startYear;

    // Admin B-column serials this package's Financialaccounts will hold.
    const adminB = {};
    if (taxData.financial_year) {
      // Ltd: the generated Admin B-column is year-end-relative around the
      // B32 = F21 anchor — B{r} = month end of (yearEnd + (r-32)/2 months).
      for (let r = 6; r <= 40; r += 2) {
        const monthIndex = yearEndYear * 12 + (yearEndMonth - 1) + (r - 32) / 2;
        adminB[r] = toExcelSerial(monthEnd(Math.floor(monthIndex / 12), (monthIndex % 12) + 1));
      }
    } else {
      // SE: the same B-column dates buildSeCellEdits writes into the
      // Financialaccounts Admin sheet.
      for (const [cell, date] of Object.entries({ ...generateAdminDates(startYear), ...seVatPaymentDueDate(startYear) })) {
        adminB[parseInt(cell.slice(1), 10)] = toExcelSerial(date);
      }
    }

    // Roll the externalLink1.xml Admin cache (the [1]Financialaccounts link).
    const extLinkPath = "xl/externalLinks/externalLink1.xml";
    const extRelsXml = await zip.file("xl/externalLinks/_rels/externalLink1.xml.rels").async("string");
    if (!extRelsXml.includes('Target="Financialaccounts.xlsx"')) {
      throw new Error("externalLink1.xml.rels does not target Financialaccounts.xlsx");
    }
    const extXmlOriginal = await zip.file(extLinkPath).async("string");
    const extXml = extXmlOriginal.replace(/<cell r="B(\d+)"([^>]*)><v>[^<]*<\/v><\/cell>/g, (m, rowStr, attrs) => {
      const row = parseInt(rowStr, 10);
      if (adminB[row] === undefined) {
        throw new Error(`externalLink1.xml caches Admin!B${row}, which has no generated value`);
      }
      return `<cell r="B${rowStr}"${attrs}><v>${adminB[row]}</v></cell>`;
    });
    // Rewrite only on change: an untouched entry keeps its original compressed
    // bytes, which keeps template-year output byte-identical.
    if (extXml !== extXmlOriginal) {
      zip.file(extLinkPath, extXml, { date: zip.file(extLinkPath).date, createFolders: false });
    }

    // Roll the Vatinterface cached values by resolving each cell's own formula.
    const viPath = sheetsConfig.vatinterface;
    const viXmlOriginal = await zip.file(viPath).async("string");
    let viXml = viXmlOriginal;
    const viValues = {}; // Vatinterface cell ref → serial just written
    for (const [, cellRef, rowStr] of viXml.matchAll(/<c r="([A-Z]+\d+)"[^>]*><f>\[1\]Admin!\$B\$(\d+)<\/f>/g)) {
      const row = parseInt(rowStr, 10);
      if (adminB[row] === undefined) {
        throw new Error(`Vatinterface ${cellRef} references [1]Admin!$B$${row}, which has no generated value`);
      }
      viXml = setCellCachedValue(viXml, cellRef, adminB[row]);
      viValues[cellRef] = adminB[row];
    }
    for (const [, rowStr] of viXml.matchAll(/\[1\]Admin!\$B\$(\d+)/g)) {
      if (adminB[parseInt(rowStr, 10)] === undefined) {
        throw new Error(`Vatinterface has an unresolved [1]Admin!$B$${rowStr} reference`);
      }
    }

    // Roll the Vatinterface C4:C18 column, which reads the next row's B
    // column rather than the external link directly: C4's own formula is
    // "B5", and C5:C18 share that same +1 row offset via a shared formula
    // anchored at C5 = "B6". Read both anchors from the XML rather than
    // assuming the offset.
    const c4Formula = matchCell(viXml, "C4")?.fullMatch.match(/<f[^>]*>B(\d+)<\/f>/);
    const c5Formula = matchCell(viXml, "C5")?.fullMatch.match(/<f[^>]*>B(\d+)<\/f>/);
    if (!c4Formula || !c5Formula) {
      throw new Error("Vatinterface C4/C5 do not have the expected B-column formula");
    }
    const cToBOffset = parseInt(c4Formula[1], 10) - 4;
    if (parseInt(c5Formula[1], 10) - 5 !== cToBOffset) {
      throw new Error("Vatinterface C4 and C5 formulas do not share the same row offset to column B");
    }
    for (let r = 4; r <= 18; r++) {
      const sourceRef = `B${r + cToBOffset}`;
      if (viValues[sourceRef] === undefined) {
        throw new Error(`Vatinterface C${r} resolves to ${sourceRef}, which has no generated value`);
      }
      viXml = setCellCachedValue(viXml, `C${r}`, viValues[sourceRef]);
      viValues[`C${r}`] = viValues[sourceRef];
    }

    if (viXml !== viXmlOriginal) {
      zip.file(viPath, viXml, { date: zip.file(viPath).date, createFolders: false });
    }

    // Vatinterface B4:B20/C4:C20 as (b, c) pairs, ascending by date, for
    // simulating each quarter's G7 = LOOKUP(G$5, Vatinterface!B:B, C:C).
    const lookupRows = [];
    for (let r = 4; r <= 20; r++) {
      const b = viValues[`B${r}`];
      const c = viValues[`C${r}`];
      if (b !== undefined && c !== undefined) lookupRows.push({ b, c });
    }
    lookupRows.sort((a, b) => a.b - b.b);

    for (let q = 1; q <= 5; q++) {
      const sheetPath = sheetsConfig[`vatQtr${q}`];
      if (!sheetPath) continue;

      const monthsFromStart = VAT_RETURN_END_MONTHS[q - 1];
      const totalMonth = vatStartMonth + monthsFromStart - 1;
      const qMonth = ((totalMonth - 1) % 12) + 1;
      const qYear = vatStartYear + Math.floor((totalMonth - 1) / 12);
      const quarterEnd = monthEnd(qYear, qMonth);
      const serial = toExcelSerial(quarterEnd);

      let sheetXml = await zip.file(sheetPath).async("string");
      sheetXml = setCellValue(sheetXml, "G5", serial);

      // Roll G7 = LOOKUP(G$5, Vatinterface!B:B, Vatinterface!C:C): the C
      // value paired with the largest B at or before this quarter's G5.
      let g7Value;
      for (const { b, c } of lookupRows) {
        if (b <= serial) g7Value = c;
      }
      if (g7Value === undefined) {
        throw new Error(`VATQtr${q} G5 serial ${serial} is before every Vatinterface row`);
      }
      sheetXml = setCellCachedValue(sheetXml, "G7", g7Value);

      // Roll the K2:K16 dropdown source list (cached formula values).
      const kValues = [];
      for (let k = 2; k <= 16; k++) {
        const cellRef = `K${k}`;
        const match = matchCell(sheetXml, cellRef);
        if (!match) throw new Error(`Cell ${cellRef} not found in ${sheetPath}`);
        const fMatch = match.fullMatch.match(/<f[^>]*>([\s\S]*?)<\/f>/);
        if (!fMatch) throw new Error(`Cell ${cellRef} in ${sheetPath} has no formula`);
        const formula = fMatch[1];

        let value;
        const viRef = formula.match(/^Vatinterface!B(\d+)$/);
        const adminRef = formula.match(/^\[1\]Admin!\$B\$(\d+)$/);
        if (viRef) value = viValues[`B${viRef[1]}`];
        else if (adminRef) value = adminB[parseInt(adminRef[1], 10)];
        if (value === undefined) {
          throw new Error(`Cell ${cellRef} in ${sheetPath} has unresolvable formula ${formula}`);
        }
        sheetXml = setCellCachedValue(sheetXml, cellRef, value);
        kValues.push(value);
      }

      if (!kValues.includes(serial)) {
        throw new Error(`VATQtr${q} default G5 serial ${serial} is not in the K2:K16 list [${kValues.join(", ")}]`);
      }

      const origDate = zip.file(sheetPath).date;
      zip.file(sheetPath, sheetXml, { date: origDate });
    }
  }

  // Force full recalculation on open so cached formula values (e.g. G2=B23) update
  let wbXml = await zip.file("xl/workbook.xml").async("string");
  wbXml = wbXml.replace(/(<calcPr[^/]*)\/?>/, '$1 fullCalcOnLoad="1"/>');
  const wbDate = zip.file("xl/workbook.xml").date;
  zip.file("xl/workbook.xml", wbXml, { date: wbDate });

  stabilizeDirDates(zip);
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

// ── Month tab renaming (Ltd Company all year-end months) ────────────────────

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getMonthTabSequence(yearEndMonth) {
  const tabs = [];
  for (let i = 0; i < 12; i++) {
    tabs.push(MONTH_NAMES_SHORT[(yearEndMonth + i) % 12]);
  }
  return tabs;
}

export async function renameMonthTabs(xlsxBuffer, yearEndMonth) {
  const zip = await JSZip.loadAsync(xlsxBuffer);
  let wbXml = await zip.file("xl/workbook.xml").async("string");

  const templateTabs = getMonthTabSequence(3);
  const targetTabs = getMonthTabSequence(yearEndMonth);

  if (templateTabs.join(",") === targetTabs.join(",")) {
    return xlsxBuffer;
  }

  const placeholders = templateTabs.map((_, i) => `__MONTH_${i}__`);
  for (let i = 0; i < 12; i++) {
    wbXml = wbXml.replace(new RegExp(`name="${templateTabs[i]}"`, "g"), `name="${placeholders[i]}"`);
  }
  for (let i = 0; i < 12; i++) {
    wbXml = wbXml.replace(new RegExp(placeholders[i], "g"), targetTabs[i]);
  }

  const origDate = zip.file("xl/workbook.xml").date;
  zip.file("xl/workbook.xml", wbXml, { date: origDate });

  stabilizeDirDates(zip);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

// ── Payslips Admin month-sheet column (Ltd Company all year-end months) ─────
//
// Payslips Admin column A is headed "Month Sheet": for each day of the tax
// calendar it names the month tab that day's payroll belongs on, and the
// printed payslip joins through it -- H3 is LOOKUP(F4, Admin!D, Admin!A),
// month number to tab name. The column builds the name from the calendar's
// own 6 April anchor, so it names Apr, May, Jun ..., which is the tab order
// only the March template ships. Rename the tabs for another year end and the
// column still hands month 1 to "Apr", so the page reads whichever tab now
// carries that name -- a different month of the year, printed under its own
// period number, with nothing else on the sheet disagreeing.
//
// The tabs themselves are the frame everything else follows: each carries its
// place in the package's own year in E, its block starts on the row that place
// gives it, and the writers fill it by that place. So the name column is what
// moves.
export async function reorientPayslipsAdminMonthSheets(xlsxBuffer, yearEndMonth, adminSheetPath) {
  const templateTabs = getMonthTabSequence(3);
  const targetTabs = getMonthTabSequence(yearEndMonth);

  if (templateTabs.join(",") === targetTabs.join(",")) {
    return xlsxBuffer;
  }

  const zip = await JSZip.loadAsync(xlsxBuffer);
  let adminXml = await zip.file(adminSheetPath).async("string");

  // The column's month name is the calendar anchor's month plus the payroll
  // month's distance from it, so the whole column moves by the distance from
  // the template's first tab to this package's.
  const monthShift = (yearEndMonth - 3 + 12) % 12;
  const monthSheetFormula = /TEXT\(DATE\(YEAR\(B\$2\),MONTH\(B\$2\)\+\(D(\d+)-1\),1\),"Mmm"\)/g;
  let formulasMoved = 0;
  adminXml = adminXml.replace(monthSheetFormula, (_, row) => {
    formulasMoved++;
    return `TEXT(DATE(YEAR(B$2),MONTH(B$2)+(D${row}-1)+${monthShift},1),"Mmm")`;
  });
  if (formulasMoved === 0) {
    throw new Error(`No Payslips Admin month-sheet formulas found in ${adminSheetPath}`);
  }

  // The cached names each of those cells carries, so a package that is never
  // recalculated still joins to the right tab.
  for (let row = PAYSLIPS_ADMIN_FIRST_CALENDAR_ROW; row <= PAYSLIPS_ADMIN_CHAIN_LAST_ROW; row++) {
    const monthCell = matchCell(adminXml, `D${row}`);
    if (!monthCell) throw new Error(`Payslips Admin D${row} not found in ${adminSheetPath}`);
    const monthNumber = parseInt((monthCell.fullMatch.match(/<v>([^<]*)<\/v>/) || [])[1], 10);
    if (!(monthNumber >= 1 && monthNumber <= 12)) {
      throw new Error(`Payslips Admin D${row} holds ${monthNumber}, not a payroll month number`);
    }
    adminXml = setCellCachedValue(adminXml, `A${row}`, targetTabs[monthNumber - 1]);
  }

  const origDate = zip.file(adminSheetPath).date;
  zip.file(adminSheetPath, adminXml, { date: origDate });

  // The printed page keeps its own cached copy of the name the lookup returns,
  // and a package is read before it is ever recalculated. The sheet ships
  // asking for period 1, which both the weekly and the monthly lookup column
  // answer with the calendar's first row, so that row's new name is the answer
  // whichever frequency the page ships set to.
  const printSheetPath = (await buildSheetMap(zip)).get(PAYSLIP_PRINT_SHEET);
  if (!printSheetPath) throw new Error(`No ${PAYSLIP_PRINT_SHEET} sheet in the Payslips workbook`);
  let printXml = await zip.file(printSheetPath).async("string");
  const periodCell = matchCell(printXml, PAYSLIP_PRINT_CELLS.period);
  if (!periodCell) throw new Error(`Payslips ${PAYSLIP_PRINT_CELLS.period} not found in ${printSheetPath}`);
  const shippedPeriod = parseInt((periodCell.fullMatch.match(/<v>([^<]*)<\/v>/) || [])[1], 10);
  if (shippedPeriod !== 1) {
    throw new Error(`Payslips ${PAYSLIP_PRINT_CELLS.period} ships asking for period ${shippedPeriod}, not the calendar's first row`);
  }
  printXml = setCellCachedValue(printXml, PAYSLIP_PRINT_CELLS.tab, targetTabs[0]);
  zip.file(printSheetPath, printXml, { date: zip.file(printSheetPath).date });

  stabilizeDirDates(zip);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

// ── Vatinterface formula rewriting (Ltd Company all year-end months) ────────

// Renames the [2]Purchases/[3]Sales month-tab references in the Vatinterface
// D and M column formulas for non-March year-ends. The [1]Admin!$B$ references
// are left at the template rows: the generated Financialaccounts Admin keeps
// the template's year-end-relative B-column (anchored at B32 = F21), so the
// template rows are correct for every year-end.
export async function rewriteVatinterfaceFormulas(xlsxBuffer, yearEndMonth, vatinterfacePath) {
  const templateTabs = getMonthTabSequence(3);
  const targetTabs = getMonthTabSequence(yearEndMonth);

  if (templateTabs.join(",") === targetTabs.join(",")) {
    return xlsxBuffer;
  }

  const zip = await JSZip.loadAsync(xlsxBuffer);
  let viXml = await zip.file(vatinterfacePath).async("string");

  // Two passes via placeholders: a direct in-place rename cascades (Apr→May,
  // then May→Jun re-hits the cells just renamed, collapsing every month onto
  // the final target).
  const placeholders = templateTabs.map((_, i) => `__VI_MONTH_${i}__`);
  for (let i = 0; i < 12; i++) {
    viXml = viXml.replace(new RegExp(`\\[2\\]${templateTabs[i]}!`, "g"), `[2]${placeholders[i]}!`);
    viXml = viXml.replace(new RegExp(`\\[3\\]${templateTabs[i]}!`, "g"), `[3]${placeholders[i]}!`);
  }
  for (let i = 0; i < 12; i++) {
    viXml = viXml.replace(new RegExp(placeholders[i], "g"), targetTabs[i]);
  }

  const origDate = zip.file(vatinterfacePath).date;
  zip.file(vatinterfacePath, viXml, { date: origDate });

  stabilizeDirDates(zip);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

// ── External link sheet name renaming (Ltd Company) ─────────────────────────

export async function renameExternalLinkSheetNames(xlsxBuffer, yearEndMonth) {
  const zip = await JSZip.loadAsync(xlsxBuffer);
  const templateTabs = getMonthTabSequence(3);
  const targetTabs = getMonthTabSequence(yearEndMonth);

  if (templateTabs.join(",") === targetTabs.join(",")) return xlsxBuffer;

  const placeholders = templateTabs.map((_, i) => `__EL_${i}__`);

  function renameTabs(xml) {
    for (let i = 0; i < 12; i++) {
      xml = xml.replace(new RegExp(`${templateTabs[i]}!`, "g"), `${placeholders[i]}!`);
      xml = xml.replace(new RegExp(`sheetName val="${templateTabs[i]}"`, "g"), `sheetName val="${placeholders[i]}"`);
    }
    for (let i = 0; i < 12; i++) {
      xml = xml.replace(new RegExp(`${placeholders[i]}!`, "g"), `${targetTabs[i]}!`);
      xml = xml.replace(new RegExp(`sheetName val="${placeholders[i]}"`, "g"), `sheetName val="${targetTabs[i]}"`);
    }
    return xml;
  }

  // Rename in external link XML files (cached sheet names)
  const linkFiles = Object.keys(zip.files).filter((f) => /xl\/externalLinks\/externalLink\d+\.xml$/.test(f));
  for (const path of linkFiles) {
    let xml = await zip.file(path).async("string");
    xml = renameTabs(xml);
    zip.file(path, xml, { date: zip.file(path).date });
  }

  // Rename in ALL worksheet XMLs (TrialBalance, MnthP&L, etc. reference [2]Apr! [3]Apr!)
  const sheetFiles = Object.keys(zip.files).filter((f) => /xl\/worksheets\/sheet\d+\.xml$/.test(f));
  for (const path of sheetFiles) {
    let xml = await zip.file(path).async("string");
    const orig = xml;
    xml = renameTabs(xml);
    if (xml !== orig) {
      zip.file(path, xml, { date: zip.file(path).date });
    }
  }

  stabilizeDirDates(zip);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

// ── Output naming ───────────────────────────────────────────────────────────

export function formatDateDDMMYY(date) {
  const d = date.getUTCDate().toString().padStart(2, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const y = (date.getUTCFullYear() % 100).toString().padStart(2, "0");
  return `${d}${m}${y}`;
}

export function formatDateYYYYMMDD(date) {
  const y = date.getUTCFullYear();
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shortLabel(date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getUTCMonth()]}${(date.getUTCFullYear() % 100).toString().padStart(2, "0")}`;
}
