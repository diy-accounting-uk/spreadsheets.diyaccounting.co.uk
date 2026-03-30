// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// spreadsheet-runner.js — Write data into xlsx cells, recalculate via
// LibreOffice headless, and read back computed values.
//
// Prerequisites: LibreOffice installed
//   macOS: brew install --cask libreoffice
//   Ubuntu (GitHub Actions): pre-installed on ubuntu-24.04

import JSZip from "jszip";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

// ── Find LibreOffice binary ─────────────────────────────────────────────────

function findLibreOffice() {
  const candidates = [
    "libreoffice",
    "soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/libreoffice",
  ];
  for (const cmd of candidates) {
    try {
      execSync(`"${cmd}" --version`, { stdio: "pipe" });
      return cmd;
    } catch {
      // try next
    }
  }
  throw new Error(
    "LibreOffice not found. Install: brew install --cask libreoffice (macOS) or apt install libreoffice-calc (Linux)",
  );
}

let cachedBinary = null;
function getLibreOffice() {
  if (!cachedBinary) cachedBinary = findLibreOffice();
  return cachedBinary;
}

// ── Excel serial number helpers ─────────────────────────────────────────────

function toExcelSerial(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((date.getTime() - epoch) / (24 * 60 * 60 * 1000));
}

// ── XML cell editing (same approach as generator.js) ────────────────────────

function setCellValue(xml, cellRef, value) {
  const cellPattern = new RegExp(`(<c\\s+r="${cellRef}"\\s[^>]*?)(/?>)((?:(?!</c>).)*(?:</c>)?)`, "s");
  const match = xml.match(cellPattern);
  if (!match) return insertCell(xml, cellRef, value);

  const [fullMatch, openTag] = match;
  const newOpenTag = openTag.replace(/\s+t="[^"]*"/, "");
  return xml.replace(fullMatch, `${newOpenTag}><v>${value}</v></c>`);
}

function setCellString(xml, cellRef, str) {
  const cellPattern = new RegExp(`(<c\\s+r="${cellRef}"\\s[^>]*?)(/?>)((?:(?!</c>).)*(?:</c>)?)`, "s");
  const match = xml.match(cellPattern);
  if (!match) return insertCellString(xml, cellRef, str);

  const [fullMatch, openTag] = match;
  let newOpenTag = openTag.replace(/\s+t="[^"]*"/, "");
  newOpenTag += ` t="inlineStr"`;
  return xml.replace(fullMatch, `${newOpenTag}><is><t>${escapeXml(str)}</t></is></c>`);
}

// Column letter(s) to numeric index (A=1, B=2, ..., Z=26, AA=27)
function colToNum(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}

// Insert a new cell into a row, respecting column order.
// Handles self-closing rows (<row ... />) by converting to open/close form.
function insertCellIntoRow(xml, cellRef, cellXml) {
  const rowNum = parseInt(cellRef.replace(/[A-Z]+/, ""), 10);
  const colLetters = cellRef.replace(/\d+/, "");
  const colNum = colToNum(colLetters);

  // Match the full row element (self-closing or with content)
  const rowPattern = new RegExp(`<row\\s+r="${rowNum}"[^>]*/\\s*>|<row\\s+r="${rowNum}"[^>]*>.*?</row>`, "s");
  const rowMatch = xml.match(rowPattern);

  if (!rowMatch) {
    // Row doesn't exist — insert before </sheetData>
    const newRow = `<row r="${rowNum}">${cellXml}</row>`;
    return xml.replace("</sheetData>", `${newRow}</sheetData>`);
  }

  const fullRow = rowMatch[0];

  // If self-closing row, convert to open/close and insert cell
  if (fullRow.match(/<row[^>]*\/\s*>/)) {
    const openTag = fullRow.replace(/\/\s*>$/, ">");
    const newRow = `${openTag}${cellXml}</row>`;
    return xml.replace(fullRow, newRow);
  }

  // Row has content — find the right insertion point by column order
  const cellPattern = /<c\s+r="([A-Z]+)\d+"/g;
  let insertBefore = null;
  let lastMatch = null;
  let m;
  while ((m = cellPattern.exec(fullRow)) !== null) {
    const existingCol = colToNum(m[1]);
    if (existingCol > colNum && !insertBefore) {
      insertBefore = m.index;
    }
    lastMatch = m;
  }

  if (insertBefore !== null) {
    // Insert before the first cell with a higher column number
    const newRow = fullRow.slice(0, insertBefore) + cellXml + fullRow.slice(insertBefore);
    return xml.replace(fullRow, newRow);
  }

  // All existing cells have lower column numbers — insert before </row>
  const newRow = fullRow.replace("</row>", `${cellXml}</row>`);
  return xml.replace(fullRow, newRow);
}

function insertCell(xml, cellRef, value) {
  return insertCellIntoRow(xml, cellRef, `<c r="${cellRef}"><v>${value}</v></c>`);
}

function insertCellString(xml, cellRef, str) {
  return insertCellIntoRow(xml, cellRef, `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(str)}</t></is></c>`);
}

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Sheet name → xlsx path mapping ──────────────────────────────────────────

// Reads workbook.xml and workbook.xml.rels to build sheet name → file path map
async function buildSheetMap(zip) {
  const wbXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");

  // Extract sheet name → rId mapping
  const sheetEntries = [...wbXml.matchAll(/name="([^"]*)"[^/]*r:id="(rId\d+)"/g)];
  // Extract rId → target file mapping
  const relEntries = [...relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]*)"/g)];

  const ridToFile = new Map();
  for (const [, rid, target] of relEntries) {
    ridToFile.set(rid, `xl/${target}`);
  }

  const sheetMap = new Map();
  for (const [, name, rid] of sheetEntries) {
    const decodedName = name.replace(/&amp;/g, "&");
    const file = ridToFile.get(rid);
    if (file) sheetMap.set(decodedName, file);
  }

  return sheetMap;
}

// ── Core: write data, recalculate, read results ─────────────────────────────

/**
 * Write cell data into an xlsx buffer, recalculate via LibreOffice, read back values.
 *
 * @param {Buffer} xlsxBuffer - The source xlsx file as a Buffer
 * @param {Object} cellWrites - { "SheetName": { "A5": value, "B5": "string", ... }, ... }
 *   Numbers are written as numeric values. Strings are written as inline strings.
 *   Date-like values should be pre-converted to Excel serial numbers.
 * @param {Object} cellReads - { "SheetName": ["A1", "C4", ...], ... }
 * @returns {Object} - { "SheetName": { "A1": value, "C4": value, ... }, ... }
 */
export async function runSpreadsheet(xlsxBuffer, cellWrites, cellReads) {
  const soffice = getLibreOffice();
  const workDir = resolve(tmpdir(), `bst-test-${randomBytes(4).toString("hex")}`);
  mkdirSync(workDir, { recursive: true });

  try {
    // 1. Write data into the xlsx
    const zip = await JSZip.loadAsync(xlsxBuffer);
    const sheetMap = await buildSheetMap(zip);

    for (const [sheetName, cells] of Object.entries(cellWrites)) {
      const sheetPath = sheetMap.get(sheetName);
      if (!sheetPath) throw new Error(`Sheet "${sheetName}" not found in workbook`);

      let xml = await zip.file(sheetPath).async("string");
      for (const [cellRef, value] of Object.entries(cells)) {
        if (typeof value === "string") {
          xml = setCellString(xml, cellRef, value);
        } else {
          xml = setCellValue(xml, cellRef, value);
        }
      }
      const originalDate = zip.file(sheetPath).date;
      zip.file(sheetPath, xml, { date: originalDate });
    }

    // Write modified xlsx to temp dir
    const inputPath = resolve(workDir, "input.xlsx");
    const outBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 1 },
    });
    writeFileSync(inputPath, outBuffer);

    // 2. Recalculate via LibreOffice headless
    // Direct xlsx→xlsx doesn't recalculate. Roundtrip through xls forces recalc.
    // Use a unique UserInstallation per invocation to avoid profile lock conflicts.
    const userProfile = `file://${resolve(workDir, "lo_profile")}`;
    execSync(
      `"${soffice}" --headless --norestore --calc -env:UserInstallation="${userProfile}" --convert-to xls --outdir "${workDir}" "${inputPath}"`,
      { stdio: "pipe", timeout: 30000 },
    );
    const xlsPath = resolve(workDir, "input.xls");
    execSync(
      `"${soffice}" --headless --norestore --calc -env:UserInstallation="${userProfile}" --convert-to xlsx --outdir "${workDir}" "${xlsPath}"`,
      { stdio: "pipe", timeout: 30000 },
    );

    // 3. Read back computed values
    const recalcPath = resolve(workDir, "input.xlsx");
    const recalcBuffer = readFileSync(recalcPath);
    const recalcZip = await JSZip.loadAsync(recalcBuffer);
    const recalcSheetMap = await buildSheetMap(recalcZip);

    const results = {};
    for (const [sheetName, cellRefs] of Object.entries(cellReads)) {
      const sheetPath = recalcSheetMap.get(sheetName);
      if (!sheetPath) throw new Error(`Sheet "${sheetName}" not found in recalculated workbook`);

      const xml = await recalcZip.file(sheetPath).async("string");
      results[sheetName] = {};

      for (const cellRef of cellRefs) {
        results[sheetName][cellRef] = readCellValue(xml, cellRef);
      }
    }

    return results;
  } finally {
    // Clean up
    rmSync(workDir, { recursive: true, force: true });
  }
}

// Read a cell's value from sheet XML (after recalculation, values are in <v> tags)
function readCellValue(xml, cellRef) {
  const cellPattern = new RegExp(
    `<c\\s+r="${cellRef}"[^>]*(?:/>|>(.*?)</c>)`,
    "s",
  );
  const match = xml.match(cellPattern);
  if (!match) return null;

  const cellContent = match[1] || "";

  // Check for shared string type
  const typeMatch = match[0].match(/\bt="([^"]*)"/);
  const cellType = typeMatch ? typeMatch[1] : null;

  // Extract <v> value
  const vMatch = cellContent.match(/<v>(.*?)<\/v>/s);
  if (!vMatch) return null;

  const raw = vMatch[1].trim();

  if (cellType === "s" || cellType === "inlineStr") {
    // For inline strings, extract from <is><t>
    const isMatch = cellContent.match(/<is><t>(.*?)<\/t><\/is>/s);
    if (isMatch) return isMatch[1];
    return raw; // shared string index — would need lookup
  }

  if (cellType === "b") return raw === "1";

  // Numeric or date
  const num = parseFloat(raw);
  return isNaN(num) ? raw : num;
}

function hasLibreOffice() {
  try {
    getLibreOffice();
    return true;
  } catch {
    return false;
  }
}

export { toExcelSerial, buildSheetMap, readCellValue, getLibreOffice, hasLibreOffice };
