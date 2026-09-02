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
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync } from "fs";
import { resolve, dirname, basename } from "path";
import { tmpdir } from "os";
import { randomBytes, createHash } from "crypto";

// ── Find LibreOffice binary ─────────────────────────────────────────────────

function findLibreOffice() {
  const candidates = ["libreoffice", "soffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice", "/usr/bin/libreoffice"];
  for (const cmd of candidates) {
    try {
      execSync(`"${cmd}" --version`, { stdio: "pipe" });
      return cmd;
    } catch {
      // try next
    }
  }
  throw new Error("LibreOffice not found. Install: brew install --cask libreoffice (macOS) or apt install libreoffice-calc (Linux)");
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

// Matches exactly the target cell's element: either self-closing, or an open
// tag whose content may not run into a sibling's <c start or another cell's
// </c> close. A greedier scan here swallows the self-closing siblings after
// the target (they carry no </c> to stop at) and with them the row boundary.
function cellElementPattern(cellRef) {
  return new RegExp(`(<c\\s+r="${cellRef}"\\s[^>]*?)(/>|>(?:(?!</c>|<c[\\s>]).)*</c>)`, "s");
}

function setCellValue(xml, cellRef, value) {
  const match = xml.match(cellElementPattern(cellRef));
  if (!match) return insertCell(xml, cellRef, value);

  const [fullMatch, openTag] = match;
  const newOpenTag = openTag.replace(/\s+t="[^"]*"/, "");
  return xml.replace(fullMatch, `${newOpenTag}><v>${value}</v></c>`);
}

function setCellString(xml, cellRef, str) {
  const match = xml.match(cellElementPattern(cellRef));
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
 * @param {Object} [options] - { saveRecalculatedTo: "/path/to/save.xlsx" }
 * @returns {Object} - { "SheetName": { "A1": value, "C4": value, ... }, ... }
 */
export async function applyCellWrites(xlsxBuffer, cellWrites) {
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

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 1 },
  });
}

export async function runSpreadsheet(xlsxBuffer, cellWrites, cellReads, options = {}) {
  const soffice = getLibreOffice();
  const workDir = resolve(tmpdir(), `spreadsheet-test-${randomBytes(4).toString("hex")}`);
  mkdirSync(workDir, { recursive: true });

  try {
    // 1. Write data into the xlsx
    const inputPath = resolve(workDir, "input.xlsx");
    writeFileSync(inputPath, await applyCellWrites(xlsxBuffer, cellWrites));

    // 2. Recalculate via LibreOffice headless
    // Direct xlsx→xlsx doesn't recalculate. Roundtrip through xls forces recalc.
    // Use a unique UserInstallation per invocation to avoid profile lock conflicts.
    const userProfile = `file://${resolve(workDir, "lo_profile")}`;
    xslRoundtrip(soffice, userProfile, workDir, inputPath);

    // 3. Read back computed values
    const recalcPath = resolve(workDir, "input.xlsx");
    const recalcBuffer = readFileSync(recalcPath);
    const recalcZip = await JSZip.loadAsync(recalcBuffer);
    const recalcSheetMap = await buildSheetMap(recalcZip);

    const sharedStrings = await loadSharedStrings(recalcZip);

    const results = {};
    for (const [sheetName, cellRefs] of Object.entries(cellReads)) {
      const sheetPath = recalcSheetMap.get(sheetName);
      if (!sheetPath) throw new Error(`Sheet "${sheetName}" not found in recalculated workbook`);

      const xml = await recalcZip.file(sheetPath).async("string");
      results[sheetName] = {};

      for (const cellRef of cellRefs) {
        results[sheetName][cellRef] = readCellValue(xml, cellRef, sharedStrings);
      }
    }

    // Optionally save the recalculated xlsx
    if (options.saveRecalculatedTo) {
      const saveDir = dirname(options.saveRecalculatedTo);
      mkdirSync(saveDir, { recursive: true });
      cpSync(recalcPath, options.saveRecalculatedTo);
    }

    return results;
  } finally {
    // Clean up
    rmSync(workDir, { recursive: true, force: true });
  }
}

function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Load shared strings table from xlsx zip
async function loadSharedStrings(zip) {
  const ssFile = zip.file("xl/sharedStrings.xml");
  if (!ssFile) return [];
  const xml = await ssFile.async("string");
  // Match <si> elements — handle both <t>text</t> and <r><t>text</t></r> (rich text) forms
  const strings = [];
  const siMatches = [...xml.matchAll(/<si>(.*?)<\/si>/gs)];
  for (const m of siMatches) {
    const inner = m[1];
    // Concatenate all <t> elements within this <si> (handles rich text with multiple <r><t> runs)
    const parts = [...inner.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => decodeXmlEntities(t[1]));
    strings.push(parts.join(""));
  }
  return strings;
}

// Read a cell's value from sheet XML (after recalculation, values are in <v> tags).
// An empty cell is written self-closing and carries no </c>, so the content
// group must stop at the next cell's opening or closing tag; scanning past it
// would hand back a later cell's value under this cell's reference.
function readCellValue(xml, cellRef, sharedStrings = []) {
  const cellPattern = new RegExp(`<c\\s+r="${cellRef}"(?=[\\s/>])([^>]*?)(?:/>|>((?:(?!</c>|<c[\\s>]).)*)</c>)`, "s");
  const match = xml.match(cellPattern);
  if (!match) return null;

  const cellContent = match[2] || "";

  // Check for shared string type
  const typeMatch = match[1].match(/\bt="([^"]*)"/);
  const cellType = typeMatch ? typeMatch[1] : null;

  // An inline string keeps its text in <is><t>, with no <v> beside it, so it
  // is read before the <v> every other kind of cell carries.
  if (cellType === "inlineStr") {
    const isMatch = cellContent.match(/<is><t[^>]*>(.*?)<\/t><\/is>/s);
    if (isMatch) return decodeXmlEntities(isMatch[1]);
  }

  // Extract <v> value
  const vMatch = cellContent.match(/<v>(.*?)<\/v>/s);
  if (!vMatch) return null;

  const raw = vMatch[1].trim();

  if (cellType === "inlineStr") return decodeXmlEntities(raw);

  if (cellType === "s") {
    // Shared string — resolve index to actual text
    const idx = parseInt(raw, 10);
    if (sharedStrings.length > 0 && idx >= 0 && idx < sharedStrings.length) {
      return sharedStrings[idx];
    }
    return raw; // fallback if no shared strings table provided
  }

  if (cellType === "b") return raw === "1";
  if (cellType === "str") return decodeXmlEntities(raw); // formula result is a string

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

// ── Helpers for multi-file recalculation ────────────────────────────────────

// LibreOffice exits 0 when it declines to convert -- another instance holding
// the profile, a crash while loading the document -- and writes nothing. The
// input is still sitting where the output belongs, so reading it back hands
// the caller the workbook's shipped cached values as though they had just been
// computed. Each leg clears its output first and then insists on it, so a run
// that did not recalculate fails instead of reporting a stale cache.
export function xslRoundtrip(soffice, userProfile, workDir, xlsxPath) {
  const xlsName = basename(xlsxPath).replace(".xlsx", ".xls");
  const xlsPath = resolve(workDir, xlsName);
  rmSync(xlsPath, { force: true });
  execSync(
    `"${soffice}" --headless --norestore --calc -env:UserInstallation="${userProfile}" --convert-to xls --outdir "${workDir}" "${xlsxPath}"`,
    { stdio: "pipe", timeout: 60000 },
  );
  if (!existsSync(xlsPath)) {
    throw new Error(`LibreOffice wrote no ${xlsName}: ${basename(xlsxPath)} was not recalculated`);
  }
  rmSync(xlsxPath, { force: true });
  execSync(
    `"${soffice}" --headless --norestore --calc -env:UserInstallation="${userProfile}" --convert-to xlsx --outdir "${workDir}" "${xlsPath}"`,
    { stdio: "pipe", timeout: 60000 },
  );
  if (!existsSync(xlsxPath)) {
    throw new Error(`LibreOffice wrote no ${basename(xlsxPath)} back from ${xlsName}: the workbook was not recalculated`);
  }
}

// ── External link caches ────────────────────────────────────────────────────
//
// A workbook that reads another workbook stores a copy of every cell it reads
// in xl/externalLinks/externalLinkN.xml. LibreOffice never re-resolves those
// links, so it computes from whatever the cache holds. Keeping the cache in
// step with the recalculated sibling files is what makes cross-file formulas
// produce real numbers here.
//
// Three things the cache does not give us for free. It only lists the cells the
// workbook happened to hold values for when it was last saved in Excel, so a
// formula addressing a cell the cache never carried reads blank forever; the
// target filename in the .rels file is rewritten to a path by a LibreOffice
// save, so it has to be matched on its basename; and LibreOffice ignores a
// cache injected into a workbook it wrote itself, so every recalculation
// starts again from the pristine file the scenario data was written into.

// Maps the [N] prefix a formula uses to the externalLinkN.xml that defines it.
// The prefix is the position of the <externalReference> in workbook.xml, one
// based; the file it names comes from the workbook rels.
async function buildExternalLinkIndex(zip) {
  const wbFile = zip.file("xl/workbook.xml");
  const relsFile = zip.file("xl/_rels/workbook.xml.rels");
  if (!wbFile || !relsFile) return new Map();

  const wbXml = await wbFile.async("string");
  const relsXml = await relsFile.async("string");

  const ridToTarget = new Map();
  for (const [, rid, target] of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]*)"/g)) {
    ridToTarget.set(rid, target);
  }

  const index = new Map();
  const referencesBlock = wbXml.match(/<externalReferences>([\s\S]*?)<\/externalReferences>/);
  if (!referencesBlock) return index;

  let position = 0;
  for (const [, rid] of referencesBlock[1].matchAll(/<externalReference[^>]*r:id="(rId\d+)"/g)) {
    position += 1;
    const target = ridToTarget.get(rid);
    if (!target) continue;
    const linkPath = `xl/${target.replace(/^\.?\//, "")}`;
    index.set(position, linkPath);
  }
  return index;
}

function decodeFormulaText(xml) {
  return xml
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function numToCol(n) {
  let col = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function expandRange(fromRef, toRef) {
  const [, fromCol, fromRow] = /^([A-Z]+)(\d+)$/.exec(fromRef);
  const [, toCol, toRow] = /^([A-Z]+)(\d+)$/.exec(toRef);
  const colStart = Math.min(colToNum(fromCol), colToNum(toCol));
  const colEnd = Math.max(colToNum(fromCol), colToNum(toCol));
  const rowStart = Math.min(Number(fromRow), Number(toRow));
  const rowEnd = Math.max(Number(fromRow), Number(toRow));
  const cells = [];
  for (let row = rowStart; row <= rowEnd; row++) {
    for (let col = colStart; col <= colEnd; col++) cells.push(`${numToCol(col)}${row}`);
  }
  return cells;
}

// External references appear in formulas as [3]Mar!$AB$2 or '[1]Mnth P&L'!A1,
// singly or as the ends of a range.
const EXTERNAL_REFERENCE_PATTERN =
  /'\[(\d+)\]([^']+)'!(\$?[A-Z]{1,3}\$?\d{1,7})(?::(\$?[A-Z]{1,3}\$?\d{1,7}))?|\[(\d+)\]([A-Za-z0-9_.&$ -]+?)!(\$?[A-Z]{1,3}\$?\d{1,7})(?::(\$?[A-Z]{1,3}\$?\d{1,7}))?/g;

// Every external cell this workbook's formulas and defined names address,
// keyed "<link index>|<sheet name>".
async function collectExternalCellRefs(zip) {
  const refs = new Map();

  const add = (linkIndex, sheetName, cellRefs) => {
    const key = `${linkIndex}|${sheetName}`;
    if (!refs.has(key)) refs.set(key, new Set());
    const set = refs.get(key);
    for (const cellRef of cellRefs) set.add(cellRef);
  };

  const scan = (text) => {
    for (const match of decodeFormulaText(text).matchAll(EXTERNAL_REFERENCE_PATTERN)) {
      const quoted = match[1] !== undefined;
      const linkIndex = Number(quoted ? match[1] : match[5]);
      const sheetName = quoted ? match[2] : match[6];
      const first = (quoted ? match[3] : match[7]).replace(/\$/g, "");
      const last = (quoted ? match[4] : match[8])?.replace(/\$/g, "");
      add(linkIndex, sheetName, last ? expandRange(first, last) : [first]);
    }
  };

  const sheetMap = await buildSheetMap(zip);
  for (const sheetPath of new Set(sheetMap.values())) {
    const sheetFile = zip.file(sheetPath);
    if (!sheetFile) continue;
    const xml = await sheetFile.async("string");
    for (const formula of xml.matchAll(/<f[^>]*>([\s\S]*?)<\/f>/g)) scan(formula[1]);
  }

  const wbFile = zip.file("xl/workbook.xml");
  if (wbFile) {
    const wbXml = await wbFile.async("string");
    for (const name of wbXml.matchAll(/<definedName[^>]*>([\s\S]*?)<\/definedName>/g)) scan(name[1]);
  }

  return refs;
}

// The sibling workbook a link points at. A LibreOffice save rewrites the
// target to a path (absolute, relative or file:// URL), so match on basename.
function resolveLinkTarget(relsXml, workDir) {
  for (const [, rawTarget] of relsXml.matchAll(/Target="([^"]+)"/g)) {
    let target = rawTarget;
    try {
      target = decodeURIComponent(target);
    } catch {
      // leave the raw target alone if it is not percent-encoded
    }
    const fileName = target
      .replace(/^file:\/+/, "")
      .split(/[/\\]/)
      .pop();
    if (!fileName || !fileName.endsWith(".xlsx")) continue;
    if (existsSync(resolve(workDir, fileName))) return fileName;
  }
  return null;
}

const ERROR_VALUE_PATTERN = /^#(NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A)$/;

function externalCacheCell(cellRef, value) {
  if (typeof value === "number") return `<cell r="${cellRef}"><v>${value}</v></cell>`;
  if (typeof value === "boolean") return `<cell r="${cellRef}" t="b"><v>${value ? 1 : 0}</v></cell>`;
  const text = String(value);
  if (ERROR_VALUE_PATTERN.test(text)) return `<cell r="${cellRef}" t="e"><v>${text}</v></cell>`;
  const space = text.trim() === text ? "" : ` xml:space="preserve"`;
  return `<cell r="${cellRef}" t="str"><v${space}>${escapeXml(text)}</v></cell>`;
}

function cellSortKey(cellRef) {
  const [, column, row] = /^([A-Z]+)(\d+)$/.exec(cellRef);
  return [Number(row), colToNum(column)];
}

// Rewrites every external link cache in `fileName` from the current contents
// of the sibling workbooks it points at. Returns true when a cache changed,
// which is the caller's signal that the workbook needs recalculating again.
async function refreshExternalLinkCaches(workDir, fileName) {
  const filePath = resolve(workDir, fileName);
  if (!existsSync(filePath)) return false;

  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const linkIndex = await buildExternalLinkIndex(zip);
  if (linkIndex.size === 0) return false;

  const referencedCells = await collectExternalCellRefs(zip);
  let changed = false;

  for (const [index, linkPath] of linkIndex) {
    const linkFile = zip.file(linkPath);
    if (!linkFile) continue;

    const linkNumber = linkPath.match(/externalLink(\d+)\.xml$/)?.[1];
    const relsFile = linkNumber && zip.file(`xl/externalLinks/_rels/externalLink${linkNumber}.xml.rels`);
    if (!relsFile) continue;

    const targetFile = resolveLinkTarget(await relsFile.async("string"), workDir);
    if (!targetFile || targetFile === fileName) continue;

    const targetZip = await JSZip.loadAsync(readFileSync(resolve(workDir, targetFile)));
    const targetSheetMap = await buildSheetMap(targetZip);
    const targetSharedStrings = await loadSharedStrings(targetZip);

    const linkXml = await linkFile.async("string");
    // sheetId is the position in <sheetNames>, not the workbook's own sheetId.
    const sheetNames = [...linkXml.matchAll(/<sheetName val="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));

    const sheetXmlCache = new Map();
    const readTargetCell = async (sheetName, cellRef) => {
      if (!sheetXmlCache.has(sheetName)) {
        const sheetPath = targetSheetMap.get(sheetName);
        sheetXmlCache.set(sheetName, sheetPath ? await targetZip.file(sheetPath).async("string") : null);
      }
      const xml = sheetXmlCache.get(sheetName);
      return xml === null ? null : readCellValue(xml, cellRef, targetSharedStrings);
    };

    const rewrites = [];
    for (const block of linkXml.matchAll(/<sheetData\s+sheetId="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/sheetData>)/g)) {
      const sheetId = Number(block[1]);
      const sheetName = sheetNames[sheetId];
      if (!sheetName || !targetSheetMap.has(sheetName)) continue;

      const cachedCells = new Map();
      for (const cell of (block[2] || "").matchAll(/<cell r="([A-Z]+\d+)"[^>]*(?:\/>|>[\s\S]*?<\/cell>)/g)) {
        cachedCells.set(cell[1], cell[0]);
      }

      const wanted = new Set([...cachedCells.keys(), ...(referencedCells.get(`${index}|${sheetName}`) || [])]);
      // The cache groups its cells into <row> elements, exactly like a
      // worksheet. Emitting bare <cell> elements makes LibreOffice discard
      // the whole link and compute the formulas as blanks.
      const rows = new Map();
      for (const cellRef of [...wanted].sort((a, b) => {
        const [rowA, colA] = cellSortKey(a);
        const [rowB, colB] = cellSortKey(b);
        return rowA - rowB || colA - colB;
      })) {
        const value = await readTargetCell(sheetName, cellRef);
        let cellXml;
        if (value === null || value === undefined) {
          if (!cachedCells.has(cellRef)) continue;
          cellXml = cachedCells.get(cellRef);
        } else {
          cellXml = externalCacheCell(cellRef, value);
        }
        const [row] = cellSortKey(cellRef);
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row).push(cellXml);
      }

      const rendered = [...rows.entries()].map(([row, cells]) => `<row r="${row}">${cells.join("")}</row>`);
      const replacement = rendered.length
        ? `<sheetData sheetId="${sheetId}">${rendered.join("")}</sheetData>`
        : `<sheetData sheetId="${sheetId}"/>`;
      if (replacement !== block[0]) rewrites.push({ from: block[0], to: replacement });
    }

    if (rewrites.length === 0) continue;

    let updated = linkXml;
    for (const { from, to } of rewrites) updated = updated.replace(from, to);
    zip.file(linkPath, updated, { date: linkFile.date });
    changed = true;
  }

  if (!changed) return false;

  const outBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 1 },
  });
  writeFileSync(filePath, outBuffer);
  return true;
}

// A fingerprint of everything a workbook currently believes about its
// siblings. Two passes that end on the same fingerprint would recalculate to
// the same numbers, so the second one can be skipped.
async function externalLinkSignature(filePath) {
  if (!existsSync(filePath)) return "";
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const linkPaths = Object.keys(zip.files)
    .filter((f) => /xl\/externalLinks\/externalLink\d+\.xml$/.test(f))
    .sort();
  const hash = createHash("sha256");
  for (const linkPath of linkPaths) {
    hash.update(linkPath);
    hash.update(await zip.file(linkPath).async("string"));
  }
  return hash.digest("hex");
}

async function hasExternalLinks(filePath) {
  if (!existsSync(filePath)) return false;
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  return Object.keys(zip.files).some((f) => /xl\/externalLinks\/externalLink\d+\.xml$/.test(f));
}

// A leaf can quote another leaf, so the settling sweep runs more than once.
// Every workbook in these packages is at most three links from the hub, and
// each sweep costs only the workbooks whose inputs actually moved, so a small
// cap is enough to reach a fixed point and still stop a cycle that will not.
const MAX_SETTLE_ROUNDS = 4;

// ── Multi-file: write data, recalculate across files, read results ──────────
//
// For multi-file products like Self Employed where cross-file external links
// must resolve. All xlsx files are placed in the same directory so relative
// external link paths work.
//
// @param {Object} fileBuffers - { "Sales.xlsx": Buffer, "Purchases.xlsx": Buffer, "Financialaccounts.xlsx": Buffer, ... }
// @param {Object} fileWrites - { "Sales.xlsx": { "Apr": { "A5": value, ... } }, "Purchases.xlsx": { ... } }
// @param {Object} cellReads - { "Profit & Loss Account": ["C5", ...], ... } — reads from the readFile
// @param {string} readFile - filename to read results from (e.g. "Financialaccounts.xlsx")
// @param {Object} [options] - { saveRecalculatedTo: "/path/to/dir" }
// @returns {Object} - { "SheetName": { "A1": value, ... }, ... }

export async function runMultiFileSpreadsheet(fileBuffers, fileWrites, cellReads, readFile, options = {}) {
  const soffice = getLibreOffice();
  const workDir = resolve(tmpdir(), `spreadsheet-multi-${randomBytes(4).toString("hex")}`);
  const sourceDir = resolve(workDir, "source");
  mkdirSync(sourceDir, { recursive: true });

  try {
    // 1. Write all files to the work directory
    for (const [filename, buffer] of Object.entries(fileBuffers)) {
      const writes = fileWrites[filename];
      if (writes && Object.keys(writes).length > 0) {
        // This file has scenario data to inject
        const zip = await JSZip.loadAsync(buffer);
        const sheetMap = await buildSheetMap(zip);

        for (const [sheetName, cells] of Object.entries(writes)) {
          const sheetPath = sheetMap.get(sheetName);
          if (!sheetPath) throw new Error(`Sheet "${sheetName}" not found in ${filename}`);

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

        const outBuffer = await zip.generateAsync({
          type: "nodebuffer",
          compression: "DEFLATE",
          compressionOptions: { level: 1 },
        });
        writeFileSync(resolve(workDir, filename), outBuffer);
      } else {
        // Copy unchanged
        writeFileSync(resolve(workDir, filename), buffer);
      }
      // Every recalculation starts again from this pristine copy: LibreOffice
      // ignores an external link cache injected into a file it wrote itself.
      cpSync(resolve(workDir, filename), resolve(sourceDir, filename));
    }

    // 2. Recalculate via LibreOffice xls roundtrip
    // LibreOffice --convert-to doesn't resolve external links between files.
    // Strategy: recalculate leaf files first, then propagate their computed
    // totals into the hub file's external link cache before recalculating it.
    const userProfile = `file://${resolve(workDir, "lo_profile")}`;
    const filenames = Object.keys(fileBuffers);

    // The files form a cycle: leaves feed the hub, and several leaves read
    // back from the hub or from each other. Recalculation walks that cycle in
    // four passes, refreshing each workbook's external link caches from its
    // siblings' current values before recalculating it.
    const postHub = options.postHubRecalc || [];
    const leafFiles = filenames.filter((f) => f !== readFile && !postHub.includes(f) && f.endsWith(".xlsx"));

    // What each workbook's caches held the last time it was recalculated, so
    // a later pass can skip a workbook whose siblings have not moved.
    const cacheSignatures = new Map();

    async function recalculate(filename) {
      const target = resolve(workDir, filename);
      const source = resolve(sourceDir, filename);
      if (!existsSync(source)) return false;

      const alreadyComputed = existsSync(target) ? readFileSync(target) : null;
      cpSync(source, target);
      await refreshExternalLinkCaches(workDir, filename);

      const signature = await externalLinkSignature(target);
      if (alreadyComputed && cacheSignatures.get(filename) === signature) {
        writeFileSync(target, alreadyComputed);
        return false;
      }
      cacheSignatures.set(filename, signature);
      xslRoundtrip(soffice, userProfile, workDir, target);
      return true;
    }

    // Pass 1: the leaves, on the scenario data just written into them. Their
    // siblings hold nothing computed yet, so this pass takes each workbook's
    // caches as they ship.
    for (const filename of leafFiles) {
      const xlsxPath = resolve(workDir, filename);
      if (!existsSync(xlsxPath)) continue;
      cacheSignatures.set(filename, await externalLinkSignature(xlsxPath));
      xslRoundtrip(soffice, userProfile, workDir, xlsxPath);
    }

    // Pass 2: the hub, on the leaves' computed totals.
    await recalculate(readFile);

    // Passes 3 and 4: the leaves again, now that the hub and their sibling
    // leaves hold final values, then the hub once more on whatever moved.
    // Fixedassets reads the opening balance sheet and the tax rates from the
    // hub and the year's asset purchases from Purchases and Sales, and
    // Purchases reads the VAT rate from Sales -- one sweep in file-name order
    // can refresh a workbook from a sibling that has not settled yet, so the
    // pair of passes repeats until nothing moves. The cache-signature guard
    // makes each repeat cost only the workbooks whose own inputs changed.
    for (let round = 0; round < MAX_SETTLE_ROUNDS; round++) {
      let leafRecalculated = false;
      for (const filename of leafFiles) {
        if (!(await hasExternalLinks(resolve(sourceDir, filename)))) continue;
        if (await recalculate(filename)) leafRecalculated = true;
      }
      if (!leafRecalculated) break;
      await recalculate(readFile);
    }

    // Files that read FROM the hub and the leaves (e.g. Vat.xlsx) go last, so
    // every workbook they quote is already final.
    for (const filename of postHub) {
      await recalculate(filename);
    }

    // 3. Read results from the specified readFile
    const recalcPath = resolve(workDir, readFile);
    const recalcBuffer = readFileSync(recalcPath);
    const recalcZip = await JSZip.loadAsync(recalcBuffer);
    const recalcSheetMap = await buildSheetMap(recalcZip);

    const sharedStrings = await loadSharedStrings(recalcZip);

    const results = {};
    for (const [sheetName, cellRefs] of Object.entries(cellReads)) {
      const sheetPath = recalcSheetMap.get(sheetName);
      if (!sheetPath) throw new Error(`Sheet "${sheetName}" not found in recalculated ${readFile}`);

      const xml = await recalcZip.file(sheetPath).async("string");
      results[sheetName] = {};

      for (const cellRef of cellRefs) {
        results[sheetName][cellRef] = readCellValue(xml, cellRef, sharedStrings);
      }
    }

    // Read from additional recalculated files (e.g. Vat.xlsx, Bank.xlsx).
    // options.additionalReads = { "Vat.xlsx": { "VATQtr1": ["G7","G15","G17"] }, "Bank.xlsx": { "Mar": ["A2"] } }
    // Results are keyed "<filename>!<sheetName>" — several leaf files carry
    // identically named sheets (Bank.xlsx Mar, Cash.xlsx Mar, every month
    // tab in Sales.xlsx and Purchases.xlsx), and a bare sheet-name key would
    // silently merge them.
    if (options.additionalReads) {
      for (const [filename, sheetReads] of Object.entries(options.additionalReads)) {
        const filePath = resolve(workDir, filename);
        if (!existsSync(filePath)) continue;
        const fileZip = await JSZip.loadAsync(readFileSync(filePath));
        const fileSheetMap = await buildSheetMap(fileZip);
        const fileSharedStrings = await loadSharedStrings(fileZip);

        for (const [sheetName, cellRefs] of Object.entries(sheetReads)) {
          const sheetPath = fileSheetMap.get(sheetName);
          if (!sheetPath) continue;
          const xml = await fileZip.file(sheetPath).async("string");
          const resultKey = `${filename}!${sheetName}`;
          if (!results[resultKey]) results[resultKey] = {};
          for (const cellRef of cellRefs) {
            results[resultKey][cellRef] = readCellValue(xml, cellRef, fileSharedStrings);
          }
        }
      }
    }

    // Optionally save recalculated files
    if (options.saveRecalculatedTo) {
      mkdirSync(options.saveRecalculatedTo, { recursive: true });
      for (const filename of filenames) {
        cpSync(resolve(workDir, filename), resolve(options.saveRecalculatedTo, filename));
      }
    }

    return results;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

export { toExcelSerial, buildSheetMap, readCellValue, loadSharedStrings, getLibreOffice, hasLibreOffice, refreshExternalLinkCaches };
