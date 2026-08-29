// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// generator.js — Core spreadsheet generation via zip-level XML surgery.
// Modifies only specific cell values in the Admin sheet XML, preserving all
// formatting, charts, conditional formatting, and XML packaging.

import JSZip from "jszip";

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
// period ends. Q1-Q4 step a quarter at a time, so together they cover the
// twelve accounting months once each. The fifth form is the spare a business
// files when its VAT stagger runs behind its accounting year: it takes the
// last period the Vatinterface carries, two months on from Q4 rather than
// three, because the quarter one further on has no interface row to total it
// and no entry in the K2:K15 dropdown to select it. That leaves Q4 and Q5
// sharing their one overlapping period, which the reconciliation reports.
export const VAT_RETURN_END_MONTHS = [3, 6, 9, 12, 14];

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
  numericEdits.N6 = it.starting_rate;
  numericEdits.N7 = it.basic_rate;
  numericEdits.N8 = it.higher_rate;
  numericEdits.N11 = it.starter_band_end;
  numericEdits.M12 = it.basic_band_end;
  numericEdits.N12 = 0;
  numericEdits.L13 = it.higher_band_start;
  numericEdits.N13 = it.higher_band_start;

  numericEdits.L17 = ni.class2_rate;
  numericEdits.L20 = ni.class4_lower_rate;
  numericEdits.N20 = ni.class4_lower_limit;
  numericEdits.L23 = ni.class4_upper_rate;
  numericEdits.N23 = ni.class4_upper_limit;

  numericEdits.G4 = ca.annual_investment_allowance;
  numericEdits.G5 = ca.writing_down_allowance;
  numericEdits.E8 = ca.motor_vehicle_cost_threshold;
  numericEdits.G8 = ca.motor_vehicle_restriction;

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
// The Taxi Admin income tax block lists two bands (basic, higher), where BST
// lists three (starter, basic, higher). Every band row therefore sits one row
// higher than its BST counterpart, and NI Class 2 is on L16 rather than L17.
// The Taxi workbook reads Admin N4, N6, N7, N11 and N12 for tax: writing the
// BST positions here leaves N6 holding the starting rate and N12 holding zero,
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

  // Income tax — two bands, one row above the BST positions
  numericEdits.N4 = it.personal_allowance;
  numericEdits.N6 = it.basic_rate; // BST: starting_rate at N6
  numericEdits.N7 = it.higher_rate; // BST: basic_rate at N7
  numericEdits.K11 = it.basic_rate; // Display-only copy of the basic rate
  numericEdits.N11 = it.starter_band_end;
  numericEdits.M11 = it.basic_band_end; // BST: M12
  numericEdits.K12 = it.higher_rate; // Display-only copy of the higher rate
  numericEdits.L12 = it.higher_band_start; // BST: L13
  numericEdits.N12 = it.higher_band_start; // BST: N13

  // NI — L16 not L17 for Class 2
  numericEdits.L16 = ni.class2_weekly_rate; // BST: class2_rate at L17
  numericEdits.L20 = ni.class4_lower_rate;
  numericEdits.N20 = ni.class4_lower_limit;
  numericEdits.L23 = ni.class4_upper_rate;
  numericEdits.N23 = ni.class4_upper_limit;

  // Capital allowances — same as BST
  numericEdits.G4 = ca.annual_investment_allowance;
  numericEdits.G5 = ca.writing_down_allowance;
  numericEdits.E8 = ca.motor_vehicle_cost_threshold;
  numericEdits.G8 = ca.motor_vehicle_restriction;

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

  // Income tax — DIFFERENT cell positions from BST
  numericEdits.N4 = it.personal_allowance;
  numericEdits.N6 = it.basic_rate; // BST: starting_rate at N6
  numericEdits.N7 = it.higher_rate; // BST: basic_rate at N7
  // No N8 in SE (BST has higher_rate at N8)
  numericEdits.K11 = it.basic_rate; // Display-only copy of basic rate
  numericEdits.N11 = it.starter_band_end;
  numericEdits.M11 = it.basic_band_end; // BST: M12
  numericEdits.K12 = 0;
  numericEdits.L12 = it.higher_band_start; // BST: L13
  numericEdits.N12 = it.higher_band_start; // BST: N13

  // NI — L16 not L17 for Class 2
  numericEdits.L16 = ni.class2_weekly_rate; // BST: class2_rate at L17
  numericEdits.L20 = ni.class4_lower_rate;
  numericEdits.N20 = ni.class4_lower_limit;
  numericEdits.L23 = ni.class4_upper_rate;
  numericEdits.N23 = ni.class4_upper_limit;

  // Capital allowances — same as BST
  numericEdits.G4 = ca.annual_investment_allowance;
  numericEdits.G5 = ca.writing_down_allowance;
  numericEdits.E8 = ca.motor_vehicle_cost_threshold;
  numericEdits.G8 = ca.motor_vehicle_restriction;

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

  // Capital allowances (stored as whole-number percentages)
  numericEdits.G5 = Math.round(ca.annual_investment_allowance * 100);
  numericEdits.G7 = Math.round(ca.annual_investment_allowance * 100);
  numericEdits.G6 = Math.round(ca.writing_down_allowance_main * 100);
  numericEdits.G8 = Math.round(ca.writing_down_allowance_main * 100);

  // Motor vehicle
  numericEdits.E11 = ca.motor_vehicle_cost_threshold;
  numericEdits.G11 = ca.motor_vehicle_restriction;

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

export function rollLtdAdminCachedDates(adminXml, templateYearEndSerial, yearEndSerial) {
  const ruleValue = (anchorSerial, row) => {
    const monthsOffset = (row - (row % 2 === 0 ? 32 : 33)) / 2;
    const anchor = fromExcelSerial(anchorSerial);
    const monthIndex = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + monthsOffset;
    const serial = toExcelSerial(monthEnd(Math.floor(monthIndex / 12), (monthIndex % 12) + 1));
    // Odd rows hold the first day of the month after the preceding even row.
    return row % 2 === 0 ? serial : serial + 1;
  };

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
    }

    const originalDate = zip.file(sheetsConfig.admin).date;
    zip.file(sheetsConfig.admin, adminXml, { date: originalDate });
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

  // Payslips Admin calendar generation (SE only — when sheetsConfig.payslipsAdmin is present)
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

    const payslipsDate = zip.file(sheetsConfig.payslipsAdmin).date;
    zip.file(sheetsConfig.payslipsAdmin, payslipsXml, { date: payslipsDate });
  }

  // VAT quarter dates (when sheetsConfig has vatQtr1..vatQtr5): write each
  // return form's default G5 from VAT_RETURN_END_MONTHS, then roll the whole
  // cached date chain — the externalLink1 Admin cache, the Vatinterface cached
  // values, and each form's K2:K15 dropdown list — to this package's year.
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
      for (let r = 6; r <= 38; r += 2) {
        const monthIndex = yearEndYear * 12 + (yearEndMonth - 1) + (r - 32) / 2;
        adminB[r] = toExcelSerial(monthEnd(Math.floor(monthIndex / 12), (monthIndex % 12) + 1));
      }
    } else {
      // SE: the same B-column dates buildSeCellEdits writes into the
      // Financialaccounts Admin sheet.
      for (const [cell, date] of Object.entries(generateAdminDates(startYear))) {
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
    if (viXml !== viXmlOriginal) {
      zip.file(viPath, viXml, { date: zip.file(viPath).date, createFolders: false });
    }

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

      // Roll the K2:K15 dropdown source list (cached formula values).
      const kValues = [];
      for (let k = 2; k <= 15; k++) {
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
        throw new Error(`VATQtr${q} default G5 serial ${serial} is not in the K2:K15 list [${kValues.join(", ")}]`);
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
