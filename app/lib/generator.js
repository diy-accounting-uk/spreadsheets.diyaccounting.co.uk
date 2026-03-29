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
  const cellPattern = new RegExp(`(<c\\s+r="${cellRef}"\\s[^>]*?)(/?>)((?:(?!</c>).)*(?:</c>)?)`, "s");
  const match = xml.match(cellPattern);
  if (!match) throw new Error(`Cell ${cellRef} not found in XML`);

  const [fullMatch, openTag] = match;
  const newOpenTag = openTag.replace(/\s+t="[^"]*"/, "");
  return xml.replace(fullMatch, `${newOpenTag}><v>${value}</v></c>`);
}

export function setCellString(xml, cellRef, str) {
  const cellPattern = new RegExp(`(<c\\s+r="${cellRef}"\\s[^>]*?)(/?>)((?:(?!</c>).)*(?:</c>)?)`, "s");
  const match = xml.match(cellPattern);
  if (!match) throw new Error(`Cell ${cellRef} not found in XML`);

  const [fullMatch, openTag] = match;
  let newOpenTag = openTag.replace(/\s+t="[^"]*"/, "");
  newOpenTag += ` t="inlineStr"`;
  return xml.replace(fullMatch, `${newOpenTag}><is><t>${escapeXml(str)}</t></is></c>`);
}

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Tax data → cell edits ───────────────────────────────────────────────────

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

// ── Generate one spreadsheet ────────────────────────────────────────────────

export async function generateSpreadsheet(templateBuffer, taxData, adminSheetPath) {
  const startDate = new Date(taxData.tax_year.start);
  const startYear = startDate.getUTCFullYear();

  const zip = await JSZip.loadAsync(templateBuffer);

  let adminXml = await zip.file(adminSheetPath).async("string");

  const { numericEdits, stringEdits } = buildCellEdits(taxData, startYear);

  for (const [cellRef, value] of Object.entries(numericEdits)) {
    adminXml = setCellValue(adminXml, cellRef, value);
  }
  for (const [cellRef, str] of Object.entries(stringEdits)) {
    adminXml = setCellString(adminXml, cellRef, str);
  }

  // Preserve the original entry date so output is deterministic across runs
  const originalDate = zip.file(adminSheetPath).date;
  zip.file(adminSheetPath, adminXml, { date: originalDate });

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
