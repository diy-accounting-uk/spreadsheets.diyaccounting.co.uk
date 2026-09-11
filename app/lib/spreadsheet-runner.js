// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// spreadsheet-runner.js — Write data into xlsx cells, recalculate via
// LibreOffice headless, and read back computed values.
//
// Prerequisites: LibreOffice installed
//   macOS: brew install --cask libreoffice
//   Ubuntu (GitHub Actions): pre-installed on ubuntu-24.04

import JSZip from "jszip";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, rmSync, existsSync, cpSync, renameSync, readdirSync, statSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import { randomBytes, createHash } from "crypto";
import { buildSheetMap, loadSharedStrings, readCellValue, escapeXml } from "./xlsx-parts.js";
import { refreshLinkCaches } from "./link-caches.js";

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
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 1 },
  });
}

// Writes the scenario data into the workbook, recalculates it, and leaves the
// finished xlsx in `destination`.
async function recalculateWorkbook(xlsxBuffer, cellWrites, destination) {
  const soffice = getLibreOffice();
  const workDir = resolve(tmpdir(), `spreadsheet-test-${randomBytes(4).toString("hex")}`);
  mkdirSync(workDir, { recursive: true });

  try {
    const inputPath = resolve(workDir, CACHE_WORKBOOK);
    writeFileSync(inputPath, await applyCellWrites(xlsxBuffer, cellWrites));

    // Direct xlsx→xlsx doesn't recalculate. Roundtrip through xls forces recalc.
    // Use a unique UserInstallation per invocation to avoid profile lock conflicts.
    const userProfile = `file://${resolve(workDir, "lo_profile")}`;
    xslRoundtrip(soffice, userProfile, workDir, inputPath);

    mkdirSync(destination, { recursive: true });
    cpSync(inputPath, resolve(destination, CACHE_WORKBOOK));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

export async function runSpreadsheet(xlsxBuffer, cellWrites, cellReads, options = {}) {
  const material = { kind: "single-file", workbook: bufferDigest(xlsxBuffer), writes: cellWrites };
  const handle = await withRecalculatedFiles(material, CACHE_WORKBOOK, (destination) =>
    recalculateWorkbook(xlsxBuffer, cellWrites, destination),
  );

  try {
    const recalcPath = resolve(handle.dir, CACHE_WORKBOOK);

    if (options.saveRecalculatedTo) {
      mkdirSync(dirname(options.saveRecalculatedTo), { recursive: true });
      cpSync(recalcPath, options.saveRecalculatedTo);
    }

    return await readWorkbookCells(recalcPath, cellReads, (sheetName) => `Sheet "${sheetName}" not found in recalculated workbook`);
  } finally {
    handle.release();
  }
}

function hasLibreOffice() {
  if (process.env.SKIP_LIBREOFFICE) return false;
  try {
    getLibreOffice();
    return true;
  } catch {
    return false;
  }
}

// ── Recalculation cache ─────────────────────────────────────────────────────
//
// Test files recalculate the same fixture over and over and then only read the
// result: nine of them recalculate the SE advanced scenario, six the Ltd full
// scenario. The recalculation is a pure function of its inputs, so the first
// caller pays for it and the rest read the files it produced.
//
// The cache is content addressed. Its key is a digest of everything the
// recalculation reads: the workbook bytes handed in (which already carry the
// template, the tax data, the generator's output and the year end), the cell
// writes (the fixture and its period shift), the recalculation order, the
// driving code in this module and the two it recalculates through, the
// LibreOffice build, the host, and the calendar day, because the templates
// carry TODAY() and a workbook recalculated yesterday holds yesterday's dates.
// Change any of those and the key changes with them.
//
// A miss always recalculates. Nothing here can make a test skip or fail: if
// the entry is absent the work happens, if another worker holds the lock this
// one waits, and if that wait runs out or the lock goes stale it recalculates
// on its own into a temporary directory. Callers only ever read the directory
// they are handed, and anything that mutates a package copies it out first.

const CACHE_FORMAT = "v1";
const CACHE_WORKBOOK = "input.xlsx";
const CACHE_READY = ".complete";
const CACHE_HEARTBEAT = "heartbeat";
const CACHE_WAIT_MS = Number(process.env.CALC_CACHE_WAIT_MS || 20 * 60 * 1000);
const CACHE_POLL_MS = 250;
const CACHE_HEARTBEAT_MS = 2000;
const CACHE_LOCK_STALE_MS = 30000;
const CACHE_ENTRY_TTL_MS = 24 * 60 * 60 * 1000;

// On under vitest, off everywhere else. The product pipeline recalculates once
// per package and has nothing to share, so it keeps the behaviour it had.
function cacheEnabled() {
  const flag = process.env.CALC_CACHE;
  if (flag === "off" || flag === "0") return false;
  if (flag === "on" || flag === "1") return true;
  return Boolean(process.env.VITEST || process.env.VITEST_WORKER_ID);
}

function cacheRoot() {
  return process.env.CALC_CACHE_DIR || resolve(tmpdir(), "diya-recalculation-cache", CACHE_FORMAT);
}

let cachedVersion = null;
function libreOfficeVersion() {
  if (cachedVersion === null) {
    try {
      cachedVersion = execSync(`"${getLibreOffice()}" --version`, { stdio: "pipe" }).toString().trim();
    } catch {
      // No LibreOffice means no recalculation can reach the cache at all, and
      // an install later changes this string, which changes every key with it.
      cachedVersion = "absent";
    }
  }
  return cachedVersion;
}

// The code that decides how a workbook is recalculated: this module drives the
// roundtrip and the settling sweep, xlsx-parts reads and writes the cells, and
// link-caches rewrites what each workbook believes about its siblings.
let cachedDriverDigest = null;
function driverDigest() {
  if (cachedDriverDigest === null) {
    const libDir = dirname(fileURLToPath(import.meta.url));
    const hash = createHash("sha256");
    for (const file of ["spreadsheet-runner.js", "xlsx-parts.js", "link-caches.js"]) {
      hash.update(file);
      hash.update(readFileSync(resolve(libDir, file)));
    }
    cachedDriverDigest = hash.digest("hex");
  }
  return cachedDriverDigest;
}

// Object key order carries no meaning in a write map -- no two keys address
// the same cell -- so sorting it keeps two call sites that build the same
// writes in a different order on the same cache entry.
function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function bufferDigest(buffer) {
  return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

function recalculationKey(material) {
  const payload = {
    format: CACHE_FORMAT,
    inputs: canonical(material),
    engine: libreOfficeVersion(),
    driver: driverDigest(),
    host: `${process.platform}-${process.arch}-node${process.versions.node.split(".")[0]}`,
    day: new Date().toISOString().slice(0, 10),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

// Every hit and every recalculation, appended where a later run can count
// them. Vitest swallows a worker's console output, so a file is the only place
// this evidence survives. CALC_CACHE_LOG turns it on with the cache off, which
// is how a before-and-after comparison counts the recalculations it saved.
function noteCacheEvent(outcome, key, label) {
  if (!cacheEnabled() && !process.env.CALC_CACHE_LOG) return;
  try {
    const root = cacheRoot();
    mkdirSync(root, { recursive: true });
    const line = `${new Date().toISOString()} pid=${process.pid} ${outcome} ${key.slice(0, 12)} ${label}\n`;
    appendFileSync(resolve(root, "recalculations.log"), line);
  } catch {
    // bookkeeping only
  }
}

let sweptThisProcess = false;
function sweepStaleEntries(root) {
  if (sweptThisProcess) return;
  sweptThisProcess = true;
  try {
    const cutoff = Date.now() - CACHE_ENTRY_TTL_MS;
    for (const name of readdirSync(root)) {
      if (name === "recalculations.log") continue;
      const path = resolve(root, name);
      if (statSync(path).mtimeMs < cutoff) rmSync(path, { recursive: true, force: true });
    }
  } catch {
    // a cache that cannot be swept still works
  }
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

// A lock whose holder died leaves a directory nothing will ever complete. The
// holder touches a heartbeat while it works, so a waiter can tell the two
// apart instead of waiting out the whole timeout on a corpse.
function lockIsAbandoned(lock) {
  try {
    return Date.now() - statSync(resolve(lock, CACHE_HEARTBEAT)).mtimeMs > CACHE_LOCK_STALE_MS;
  } catch {
    return !existsSync(lock);
  }
}

async function recalculateIntoTemporary(label, produce) {
  const dir = resolve(tmpdir(), `recalculated-${randomBytes(6).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  noteCacheEvent("miss", "uncached", label);
  try {
    await produce(dir);
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
  return { dir, fromCache: false, release: () => rmSync(dir, { recursive: true, force: true }) };
}

// Hands back a directory holding the recalculated files, either from the cache
// or freshly produced. `produce(destination)` must write the finished files
// into the directory it is given.
async function withRecalculatedFiles(material, label, produce) {
  if (!cacheEnabled()) return recalculateIntoTemporary(label, produce);

  const root = cacheRoot();
  const key = recalculationKey(material);
  const entry = resolve(root, key);
  const lock = resolve(root, `${key}.lock`);
  mkdirSync(root, { recursive: true });
  sweepStaleEntries(root);

  const deadline = Date.now() + CACHE_WAIT_MS;
  for (;;) {
    if (existsSync(resolve(entry, CACHE_READY))) {
      noteCacheEvent("hit", key, label);
      return { dir: entry, fromCache: true, release: () => {} };
    }

    let held = true;
    try {
      mkdirSync(lock);
    } catch {
      held = false;
    }

    if (held) {
      const building = resolve(root, `${key}.building-${randomBytes(4).toString("hex")}`);
      const beat = setInterval(() => {
        try {
          writeFileSync(resolve(lock, CACHE_HEARTBEAT), `${Date.now()}`);
        } catch {
          // the lock is gone; the build still finishes
        }
      }, CACHE_HEARTBEAT_MS);
      beat.unref();
      writeFileSync(resolve(lock, CACHE_HEARTBEAT), `${Date.now()}`);
      try {
        // The holder before us may have finished between the check above and
        // the lock: an entry already complete is never rebuilt or replaced,
        // so nothing can pull the files out from under a reader.
        if (existsSync(resolve(entry, CACHE_READY))) {
          noteCacheEvent("hit", key, label);
          return { dir: entry, fromCache: true, release: () => {} };
        }
        mkdirSync(building, { recursive: true });
        noteCacheEvent("miss", key, label);
        await produce(building);
        writeFileSync(resolve(building, CACHE_READY), `${label}\n`);
        rmSync(entry, { recursive: true, force: true });
        renameSync(building, entry);
        return { dir: entry, fromCache: false, release: () => {} };
      } catch (error) {
        rmSync(building, { recursive: true, force: true });
        throw error;
      } finally {
        clearInterval(beat);
        rmSync(lock, { recursive: true, force: true });
      }
    }

    if (lockIsAbandoned(lock)) {
      rmSync(lock, { recursive: true, force: true });
      continue;
    }
    if (Date.now() > deadline) return recalculateIntoTemporary(label, produce);
    await sleep(CACHE_POLL_MS);
  }
}

// ── Reading computed values back ────────────────────────────────────────────

async function readWorkbookCells(filePath, cellReads, missingSheet) {
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);

  const results = {};
  for (const [sheetName, cellRefs] of Object.entries(cellReads)) {
    const sheetPath = sheetMap.get(sheetName);
    if (!sheetPath) throw new Error(missingSheet(sheetName));

    const xml = await zip.file(sheetPath).async("string");
    results[sheetName] = {};
    for (const cellRef of cellRefs) {
      results[sheetName][cellRef] = readCellValue(xml, cellRef, sharedStrings);
    }
  }
  return results;
}

// Reads from additional recalculated files (e.g. Vat.xlsx, Bank.xlsx).
// additionalReads = { "Vat.xlsx": { "VATQtr1": ["G7","G15","G17"] }, "Bank.xlsx": { "Mar": ["A2"] } }
// Results are keyed "<filename>!<sheetName>" -- several leaf files carry
// identically named sheets (Bank.xlsx Mar, Cash.xlsx Mar, every month tab in
// Sales.xlsx and Purchases.xlsx), and a bare sheet-name key would silently
// merge them.
async function readPackageResults(packageDir, cellReads, readFile, additionalReads) {
  const results = await readWorkbookCells(
    resolve(packageDir, readFile),
    cellReads,
    (sheetName) => `Sheet "${sheetName}" not found in recalculated ${readFile}`,
  );

  if (!additionalReads) return results;

  for (const [filename, sheetReads] of Object.entries(additionalReads)) {
    const filePath = resolve(packageDir, filename);
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
  return results;
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

// A reader over the sibling workbooks on disk beside `fileName`. Each sibling
// is opened once and its sheets are read as they are first asked for.
function siblingReader(workDir, fileName) {
  const siblings = new Map();
  const open = (file) => {
    if (!siblings.has(file)) {
      siblings.set(
        file,
        (async () => {
          const zip = await JSZip.loadAsync(readFileSync(resolve(workDir, file)));
          return { zip, sheetMap: await buildSheetMap(zip), sharedStrings: await loadSharedStrings(zip), sheetXml: new Map() };
        })(),
      );
    }
    return siblings.get(file);
  };
  return {
    hasTarget: (file) => file !== fileName && existsSync(resolve(workDir, file)),
    async hasSheet(file, sheetName) {
      return (await open(file)).sheetMap.has(sheetName);
    },
    async readTargetCell(file, sheetName, cellRef) {
      const sibling = await open(file);
      if (!sibling.sheetXml.has(sheetName)) {
        const sheetPath = sibling.sheetMap.get(sheetName);
        sibling.sheetXml.set(sheetName, sheetPath ? await sibling.zip.file(sheetPath).async("string") : null);
      }
      const xml = sibling.sheetXml.get(sheetName);
      return xml === null ? null : readCellValue(xml, cellRef, sibling.sharedStrings);
    },
  };
}

// Rewrites every external link cache in `fileName` from the current contents
// of the sibling workbooks it points at. Returns true when a cache changed,
// which is the caller's signal that the workbook needs recalculating again.
async function refreshExternalLinkCaches(workDir, fileName) {
  const filePath = resolve(workDir, fileName);
  if (!existsSync(filePath)) return false;

  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const { changed } = await refreshLinkCaches(zip, siblingReader(workDir, fileName));
  if (!changed) return false;

  const outBuffer = await zip.generateAsync({
    type: "uint8array",
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
  const material = {
    kind: "multi-file",
    readFile,
    postHubRecalc: options.postHubRecalc || [],
    files: Object.keys(fileBuffers)
      .sort()
      .map((filename) => [filename, bufferDigest(fileBuffers[filename])]),
    writes: fileWrites,
  };

  const handle = await withRecalculatedFiles(material, readFile, (destination) =>
    recalculatePackage(fileBuffers, fileWrites, readFile, options, destination),
  );

  try {
    if (options.saveRecalculatedTo) {
      mkdirSync(options.saveRecalculatedTo, { recursive: true });
      for (const filename of Object.keys(fileBuffers)) {
        cpSync(resolve(handle.dir, filename), resolve(options.saveRecalculatedTo, filename));
      }
    }
    return await readPackageResults(handle.dir, cellReads, readFile, options.additionalReads);
  } finally {
    handle.release();
  }
}

// Writes the scenario data across the package, recalculates it until the
// cross-file links settle, and leaves the finished workbooks in `destination`.
async function recalculatePackage(fileBuffers, fileWrites, readFile, options, destination) {
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
          type: "uint8array",
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

    // 3. Hand the finished package over
    mkdirSync(destination, { recursive: true });
    for (const filename of filenames) {
      cpSync(resolve(workDir, filename), resolve(destination, filename));
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

export {
  toExcelSerial,
  buildSheetMap,
  readCellValue,
  loadSharedStrings,
  getLibreOffice,
  hasLibreOffice,
  refreshExternalLinkCaches,
  withRecalculatedFiles,
};
