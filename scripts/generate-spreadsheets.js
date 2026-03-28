#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// generate-spreadsheets.js — Generate tax-year-specific spreadsheets from
// templates and tax-data TOML files.
//
// Uses zip-level XML surgery to modify only the cells we need, preserving all
// formatting, charts, conditional formatting, and XML packaging that ExcelJS
// would otherwise corrupt.
//
// Usage:
//   node scripts/generate-spreadsheets.js                    # all tax-data files
//   node scripts/generate-spreadsheets.js --years 2024-25 2025-26  # specific years
//
// Reads:  templates/bst-excel.xlsx, tax-data/*.toml
// Writes: packages-generated/GB Accounts Basic Sole Trader {date} ({label}) Excel 2007/

import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TEMPLATES_DIR = resolve(ROOT, "templates");
const TAX_DATA_DIR = resolve(ROOT, "tax-data");
const OUTPUT_DIR = resolve(ROOT, "packages-generated");

// xlsx internal paths (determined from workbook.xml.rels mapping)
const ADMIN_SHEET = "xl/worksheets/sheet33.xml";
const SHARED_STRINGS = "xl/sharedStrings.xml";

// ── Date helpers ────────────────────────────────────────────────────────────

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthEnd(year, month) {
  const day = lastDayOfMonth(year, month);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

// Excel serial number: days since 1900-01-01, with the Excel 1900 leap year
// bug (Excel incorrectly treats 1900 as a leap year, so dates after Feb 28 1900
// are off by one).
function toExcelSerial(date) {
  const epoch = Date.UTC(1899, 11, 30); // 1899-12-30 (Excel epoch)
  return Math.round((date.getTime() - epoch) / (24 * 60 * 60 * 1000));
}

// ── Admin date generation ───────────────────────────────────────────────────

function generateAdminDates(startYear) {
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
//
// Finds a cell element like <c r="B2" s="330"><v>45716</v></c> and replaces
// the <v> content. Handles both self-closing cells (<c ... />) and cells
// with existing <v> or <f> elements.

function setCellValue(xml, cellRef, value) {
  // Match the cell element for this ref
  // Pattern: <c r="B2" ...>...</c> or <c r="B2" ... />
  const cellPattern = new RegExp(`(<c\\s+r="${cellRef}"\\s[^>]*?)(/?>)((?:(?!</c>).)*(?:</c>)?)`, "s");
  const match = xml.match(cellPattern);

  if (!match) {
    throw new Error(`Cell ${cellRef} not found in XML`);
  }

  const [fullMatch, openTag, closeChar, rest] = match;

  // Remove any t="s" or t="str" type attribute (we're writing a plain number)
  let newOpenTag = openTag.replace(/\s+t="[^"]*"/, "");

  // Build the new cell content
  const newCell = `${newOpenTag}><v>${value}</v></c>`;

  return xml.replace(fullMatch, newCell);
}

function setCellString(xml, cellRef, str) {
  // For inline strings, use t="inlineStr" with <is><t>...</t></is>
  const cellPattern = new RegExp(`(<c\\s+r="${cellRef}"\\s[^>]*?)(/?>)((?:(?!</c>).)*(?:</c>)?)`, "s");
  const match = xml.match(cellPattern);

  if (!match) {
    throw new Error(`Cell ${cellRef} not found in XML`);
  }

  const [fullMatch, openTag] = match;

  // Remove any existing t= attribute and add t="inlineStr"
  let newOpenTag = openTag.replace(/\s+t="[^"]*"/, "");
  newOpenTag += ` t="inlineStr"`;

  const newCell = `${newOpenTag}><is><t>${escapeXml(str)}</t></is></c>`;

  return xml.replace(fullMatch, newCell);
}

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Tax data cell mapping ───────────────────────────────────────────────────

function buildCellEdits(taxData, startYear) {
  const dates = generateAdminDates(startYear);
  const ty = taxData.tax_year;
  const it = taxData.income_tax;
  const ni = taxData.national_insurance;
  const ca = taxData.capital_allowances;
  const dep = taxData.depreciation;
  const mil = taxData.mileage;

  // Numeric cells: { cellRef: numericValue }
  const numericEdits = {};

  // Date cells → Excel serial numbers
  for (const [cell, date] of Object.entries(dates)) {
    numericEdits[cell] = toExcelSerial(date);
  }

  // Income tax
  numericEdits.N4 = it.personal_allowance;
  numericEdits.N6 = it.starting_rate;
  numericEdits.N7 = it.basic_rate;
  numericEdits.N8 = it.higher_rate;
  numericEdits.N11 = it.starter_band_end;
  numericEdits.M12 = it.basic_band_end;
  numericEdits.N12 = 0;
  numericEdits.L13 = it.higher_band_start;
  numericEdits.N13 = it.higher_band_start;

  // National insurance
  numericEdits.L17 = ni.class2_rate;
  numericEdits.L20 = ni.class4_lower_rate;
  numericEdits.N20 = ni.class4_lower_limit;
  numericEdits.L23 = ni.class4_upper_rate;
  numericEdits.N23 = ni.class4_upper_limit;

  // Capital allowances
  numericEdits.G4 = ca.annual_investment_allowance;
  numericEdits.G5 = ca.writing_down_allowance;
  numericEdits.E8 = ca.motor_vehicle_cost_threshold;
  numericEdits.G8 = ca.motor_vehicle_restriction;

  // Depreciation
  numericEdits.G13 = dep.land_and_property;
  numericEdits.G14 = dep.plant_and_machinery;
  numericEdits.G15 = dep.fixtures_and_fittings;
  numericEdits.G16 = dep.computer_equipment;
  numericEdits.G17 = dep.motor_vehicles;

  // Mileage
  numericEdits.F21 = mil.higher_rate_limit;
  numericEdits.G21 = mil.higher_rate_pence;
  numericEdits.F22 = mil.lower_rate_start;
  numericEdits.G22 = mil.lower_rate_pence;

  // VAT
  numericEdits.F26 = taxData.vat.registration_threshold;

  // String cells
  const stringEdits = {
    B23: ty.label,
    B24: ty.next_label,
  };

  return { numericEdits, stringEdits };
}

// ── Output naming ───────────────────────────────────────────────────────────

function formatDateDDMMYY(date) {
  const d = date.getUTCDate().toString().padStart(2, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const y = (date.getUTCFullYear() % 100).toString().padStart(2, "0");
  return `${d}${m}${y}`;
}

function formatDateYYYYMMDD(date) {
  const y = date.getUTCFullYear();
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shortLabel(date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getUTCMonth()]}${(date.getUTCFullYear() % 100).toString().padStart(2, "0")}`;
}

// ── Generate one spreadsheet ────────────────────────────────────────────────

async function generateBST(templateZipBuffer, taxDataPath) {
  const tomlText = readFileSync(taxDataPath, "utf8");
  const taxData = parseTOML(tomlText);
  const ty = taxData.tax_year;

  const startDate = new Date(ty.start);
  const startYear = startDate.getUTCFullYear();
  const endDate = new Date(ty.end);

  console.log(`\nGenerating Basic Sole Trader for ${ty.label}...`);

  // Load a fresh copy of the template zip
  const zip = await JSZip.loadAsync(templateZipBuffer);

  // Read the Admin sheet XML
  let adminXml = await zip.file(ADMIN_SHEET).async("string");

  // Build all cell edits
  const { numericEdits, stringEdits } = buildCellEdits(taxData, startYear);

  // Apply numeric edits
  for (const [cellRef, value] of Object.entries(numericEdits)) {
    adminXml = setCellValue(adminXml, cellRef, value);
  }

  // Apply string edits (inline strings)
  for (const [cellRef, str] of Object.entries(stringEdits)) {
    adminXml = setCellString(adminXml, cellRef, str);
  }

  // Write modified Admin sheet back into the zip
  zip.file(ADMIN_SHEET, adminXml);

  // Generate the output zip buffer
  const outBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  // Output directory and filename
  const dateStr = formatDateYYYYMMDD(endDate);
  const label = shortLabel(endDate);
  const dirName = `GB Accounts Basic Sole Trader ${dateStr} (${label}) Excel 2007`;
  const outDir = resolve(OUTPUT_DIR, dirName);
  mkdirSync(outDir, { recursive: true });

  const ddmmyy = formatDateDDMMYY(endDate);
  const outFilename = `Financialaccountsto${ddmmyy}.xlsx`;
  const outPath = resolve(outDir, outFilename);

  writeFileSync(outPath, outBuffer);
  console.log(`  Written: ${dirName}/`);
  console.log(`           ${outFilename}`);

  // Copy PDFs from the template product directory
  const pdfSrcDir = resolve(ROOT, "packages", "GB Accounts Basic Sole Trader 2026-04-05 (Apr26) Excel 2007");
  for (const file of readdirSync(pdfSrcDir)) {
    if (file.endsWith(".pdf")) {
      cpSync(resolve(pdfSrcDir, file), resolve(outDir, file));
      console.log(`  Copied:  ${file}`);
    }
  }

  return { dirName, outFilename, taxYear: ty.label };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== generate-spreadsheets.js ===");
  console.log("Templates:", TEMPLATES_DIR);
  console.log("Tax data: ", TAX_DATA_DIR);
  console.log("Output:   ", OUTPUT_DIR);

  // Determine which years to generate
  const yearsArgIdx = process.argv.indexOf("--years");
  let tomlFiles;
  if (yearsArgIdx !== -1) {
    const years = process.argv.slice(yearsArgIdx + 1);
    tomlFiles = years.map((y) => resolve(TAX_DATA_DIR, `${y}.toml`));
  } else {
    tomlFiles = readdirSync(TAX_DATA_DIR)
      .filter((f) => f.endsWith(".toml"))
      .sort()
      .map((f) => resolve(TAX_DATA_DIR, f));
  }

  console.log(
    "Tax years:",
    tomlFiles.map((f) => f.split("/").pop().replace(".toml", "")),
  );

  // Read template once, reuse for each year
  const templatePath = resolve(TEMPLATES_DIR, "bst-excel.xlsx");
  const templateBuffer = readFileSync(templatePath);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = [];
  for (const tomlFile of tomlFiles) {
    const result = await generateBST(templateBuffer, tomlFile);
    results.push(result);
  }

  console.log(`\n=== Generated ${results.length} packages ===`);
  for (const r of results) {
    console.log(`  ${r.taxYear}: ${r.dirName}/`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
