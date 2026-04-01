// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// generator.js — Core spreadsheet generation via zip-level XML surgery.
// Modifies only specific cell values in the Admin sheet XML, preserving all
// formatting, charts, conditional formatting, and XML packaging.

import JSZip from "jszip";

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
  numericEdits.N6 = it.basic_rate;           // BST: starting_rate at N6
  numericEdits.N7 = it.higher_rate;          // BST: basic_rate at N7
  // No N8 in SE (BST has higher_rate at N8)
  numericEdits.K11 = it.basic_rate;          // Display-only copy of basic rate
  numericEdits.N11 = it.starter_band_end;
  numericEdits.M11 = it.basic_band_end;      // BST: M12
  numericEdits.K12 = 0;
  numericEdits.L12 = it.higher_band_start;   // BST: L13
  numericEdits.N12 = it.higher_band_start;   // BST: N13

  // NI — L16 not L17 for Class 2
  numericEdits.L16 = ni.class2_weekly_rate;  // BST: class2_rate at L17
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
  const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec"];
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
  sheetXml = sheetXml.replace(
    /<dimension ref="[^"]*"\/>/,
    `<dimension ref="A1:F${lastRow}"/>`,
  );

  // Replace sheetData content
  sheetXml = sheetXml.replace(
    /<sheetData>[\s\S]*<\/sheetData>/,
    `<sheetData>${newData}</sheetData>`,
  );

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
    if (sheetsConfig.cellEditFn === "ltd") {
      const yearEndSerial = toExcelSerial(endDate);
      ({ numericEdits, stringEdits } = buildLtdCellEdits(taxData, yearEndSerial));
    } else {
      const buildFn = sheetsConfig.cellEditFn === "se" ? buildSeCellEdits : buildCellEdits;
      ({ numericEdits, stringEdits } = buildFn(taxData, startYear));
    }

    for (const [cellRef, value] of Object.entries(numericEdits)) {
      adminXml = setCellValue(adminXml, cellRef, value);
    }
    for (const [cellRef, str] of Object.entries(stringEdits)) {
      adminXml = setCellString(adminXml, cellRef, str);
    }

    const originalDate = zip.file(sheetsConfig.admin).date;
    zip.file(sheetsConfig.admin, adminXml, { date: originalDate });
  }

  // Sales sheet generation (Taxi only — when sheetsConfig.sales is present)
  if (sheetsConfig.sales) {
    const weeks = generateTaxYearWeeks(startYear);
    const monthlyData = groupWeeksIntoMonths(weeks);
    const monthKeys = ["apr", "may", "jun", "jul", "aug", "sep",
      "oct", "nov", "dec", "jan", "feb", "mar"];

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

  // Force full recalculation on open so cached formula values (e.g. G2=B23) update
  let wbXml = await zip.file("xl/workbook.xml").async("string");
  wbXml = wbXml.replace(
    /(<calcPr[^/]*)\/?>/,
    '$1 fullCalcOnLoad="1"/>',
  );
  const wbDate = zip.file("xl/workbook.xml").date;
  zip.file("xl/workbook.xml", wbXml, { date: wbDate });

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
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
