// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// link-caches.js — the external link caches of one workbook, as a pure
// function over its JSZip.
//
// A workbook that reads another workbook stores a copy of every cell it reads
// in xl/externalLinks/externalLinkN.xml. A spreadsheet application computes
// from that cache until it re-resolves the link, and LibreOffice never does,
// so a package whose caches disagree with its leaves shows wrong figures on
// open. Refreshing the caches from a reader is what keeps them in step: in CI
// the reader is the recalculated sibling on disk (spreadsheet-runner.js), in
// the writer and the browser it is the calculator's own results.
//
// Nothing here touches the file system. The one JSZip import is for the
// byte-level helper at the bottom; the bundle already carries JSZip.

import JSZip from "jszip";
import { buildSheetMap, decodeXmlEntities, escapeXml } from "./xlsx-parts.js";
import { colToNum, parseCellRef, parseCells, rangeCells, sortCellRefs } from "./template-formula-map.js";
import { canonicalValue } from "./report-serializer.js";

export const HUB_FILE = "Financialaccounts.xlsx";

// The files of each product that carry external links, in dependency order.
export const LINK_ORDER = {
  se: ["Purchases.xlsx", "Bank.xlsx", "Cash.xlsx", "Fixedassets.xlsx", "Financialaccounts.xlsx", "Vat.xlsx"],
};

// External references appear in formulas as [3]Mar!$AB$2 or '[1]Mnth P&L'!A1,
// singly or as the ends of a range.
const EXTERNAL_REFERENCE_PATTERN =
  /'\[(\d+)\]([^']+)'!(\$?[A-Z]{1,3}\$?\d{1,7})(?::(\$?[A-Z]{1,3}\$?\d{1,7}))?|\[(\d+)\]([A-Za-z0-9_.&$ -]+?)!(\$?[A-Z]{1,3}\$?\d{1,7})(?::(\$?[A-Z]{1,3}\$?\d{1,7}))?/g;

const SHEET_DATA_BLOCK_PATTERN = /<sheetData\s+sheetId="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/sheetData>)/g;
const CACHE_CELL_PATTERN = /<cell r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/cell>)/g;
const ERROR_VALUE_PATTERN = /^#(NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A)$/;

function decodeFormulaText(xml) {
  return xml
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// The sibling workbook a link's rels point at, by basename. Excel writes the
// bare file name and a percent-encoded absolute path; a LibreOffice save
// leaves one relative path; either way the file states its own target.
function linkTargetFile(relsXml) {
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
    if (fileName && fileName.endsWith(".xlsx")) return fileName;
  }
  return null;
}

/**
 * Every external link a workbook declares. `index` is the [N] a formula uses,
 * the one-based position of the <externalReference> in workbook.xml; the link
 * part it names comes from the workbook rels, and the target file from that
 * part's own rels. A link whose part or rels is missing is left out.
 *
 * @param {Object} zip - one workbook's JSZip
 * @returns {Promise<Array<{index: number, path: string, relsPath: string, targetFile: string|null, sheetNames: string[]}>>}
 */
export async function externalLinks(zip) {
  const wbFile = zip.file("xl/workbook.xml");
  const relsFile = zip.file("xl/_rels/workbook.xml.rels");
  if (!wbFile || !relsFile) return [];

  const wbXml = await wbFile.async("string");
  const relsXml = await relsFile.async("string");

  const ridToTarget = new Map();
  for (const [, rid, target] of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]*)"/g)) {
    ridToTarget.set(rid, target);
  }

  const referencesBlock = wbXml.match(/<externalReferences>([\s\S]*?)<\/externalReferences>/);
  if (!referencesBlock) return [];

  const links = [];
  let position = 0;
  for (const [, rid] of referencesBlock[1].matchAll(/<externalReference[^>]*r:id="(rId\d+)"/g)) {
    position += 1;
    const target = ridToTarget.get(rid);
    if (!target) continue;
    const path = `xl/${target.replace(/^\.?\//, "")}`;
    const linkFile = zip.file(path);
    if (!linkFile) continue;
    const linkNumber = path.match(/externalLink(\d+)\.xml$/)?.[1];
    const relsPath = `xl/externalLinks/_rels/externalLink${linkNumber}.xml.rels`;
    const linkRels = linkNumber && zip.file(relsPath);
    if (!linkRels) continue;

    const linkXml = await linkFile.async("string");
    // sheetId is the position in <sheetNames>, not the workbook's own sheetId.
    const sheetNames = [...linkXml.matchAll(/<sheetName val="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    links.push({ index: position, path, relsPath, targetFile: linkTargetFile(await linkRels.async("string")), sheetNames });
  }
  return links;
}

// Every external reference in a workbook's formulas and defined names, one
// entry per match, with the cell (or "definedName") whose formula carries it.
async function externalReferences(zip) {
  const references = [];
  const scan = (text, source) => {
    for (const match of decodeFormulaText(text).matchAll(EXTERNAL_REFERENCE_PATTERN)) {
      const quoted = match[1] !== undefined;
      const index = Number(quoted ? match[1] : match[5]);
      const sheet = quoted ? match[2] : match[6];
      const first = (quoted ? match[3] : match[7]).replace(/\$/g, "");
      const last = (quoted ? match[4] : match[8])?.replace(/\$/g, "");
      references.push({ index, sheet, cells: last ? rangeCells(`${first}:${last}`) : [first], source });
    }
  };

  const sheetMap = await buildSheetMap(zip);
  for (const [sheetName, sheetPath] of sheetMap) {
    const sheetFile = zip.file(sheetPath);
    if (!sheetFile) continue;
    const xml = await sheetFile.async("string");
    for (const [cellRef, cell] of parseCells(xml)) {
      if (cell.formula) scan(cell.formula, `${sheetName}!${cellRef}`);
    }
  }

  const wbFile = zip.file("xl/workbook.xml");
  if (wbFile) {
    const wbXml = await wbFile.async("string");
    for (const name of wbXml.matchAll(/<definedName[^>]*>([\s\S]*?)<\/definedName>/g)) scan(name[1], "definedName");
  }

  return references;
}

/**
 * Every external cell this workbook's formulas and defined names address,
 * keyed "<link index>|<sheet name>".
 *
 * @param {Object} zip - one workbook's JSZip
 * @returns {Promise<Map<string, Set<string>>>}
 */
export async function collectExternalCellRefs(zip) {
  const refs = new Map();
  for (const { index, sheet, cells } of await externalReferences(zip)) {
    const key = `${index}|${sheet}`;
    if (!refs.has(key)) refs.set(key, new Set());
    const set = refs.get(key);
    for (const cell of cells) set.add(cell);
  }
  return refs;
}

/**
 * The same, one entry per addressed cell with the link resolved to its target
 * file and the workbook's own cells that address it.
 *
 * @param {Object} zip - one workbook's JSZip
 * @returns {Promise<Array<{index: number, targetFile: string|null, sheet: string, cell: string, sources: string[]}>>}
 */
export async function linkAddressedCells(zip) {
  const targetByIndex = new Map((await externalLinks(zip)).map((link) => [link.index, link.targetFile]));
  const byKey = new Map();
  for (const { index, sheet, cells, source } of await externalReferences(zip)) {
    for (const cell of cells) {
      const key = `${index}|${sheet}|${cell}`;
      if (!byKey.has(key)) byKey.set(key, { index, targetFile: targetByIndex.get(index) ?? null, sheet, cell, sources: [] });
      const entry = byKey.get(key);
      if (!entry.sources.includes(source)) entry.sources.push(source);
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const cellA = parseCellRef(a.cell);
    const cellB = parseCellRef(b.cell);
    return a.index - b.index || a.sheet.localeCompare(b.sheet) || cellA.row - cellB.row || colToNum(cellA.col) - colToNum(cellB.col);
  });
}

function cachedCellValue(attributes, body) {
  const valueMatch = body.match(/<v[^>]*>([\s\S]*?)<\/v>/);
  if (!valueMatch) return undefined;
  const raw = valueMatch[1];
  const type = attributes.match(/\bt="([^"]*)"/)?.[1];
  if (type === undefined) return Number(raw);
  if (type === "b") return raw === "1";
  if (type === "e") return raw;
  return decodeXmlEntities(raw);
}

/**
 * Every value a workbook's link caches hold, keyed "file!sheet!cell". A cache
 * cell with no value is left out.
 *
 * @param {Object} zip - one workbook's JSZip
 * @returns {Promise<Map<string, number|string|boolean>>}
 */
export async function linkCacheValues(zip) {
  const values = new Map();
  for (const link of await externalLinks(zip)) {
    if (!link.targetFile) continue;
    const linkXml = await zip.file(link.path).async("string");
    for (const block of linkXml.matchAll(SHEET_DATA_BLOCK_PATTERN)) {
      const sheetName = link.sheetNames[Number(block[1])];
      if (!sheetName) continue;
      for (const cell of (block[2] || "").matchAll(CACHE_CELL_PATTERN)) {
        const value = cachedCellValue(cell[2], cell[3] || "");
        if (value !== undefined) values.set(`${link.targetFile}!${sheetName}!${cell[1]}`, value);
      }
    }
  }
  return values;
}

/**
 * One cached cell as the link part writes it. A text that returns a space is
 * written the way Excel writes it, with the space preserved.
 */
export function externalCacheCell(cellRef, value) {
  if (typeof value === "number") return `<cell r="${cellRef}"><v>${value}</v></cell>`;
  if (typeof value === "boolean") return `<cell r="${cellRef}" t="b"><v>${value ? 1 : 0}</v></cell>`;
  const text = String(value);
  if (ERROR_VALUE_PATTERN.test(text)) return `<cell r="${cellRef}" t="e"><v>${text}</v></cell>`;
  const space = text.trim() === text ? "" : ` xml:space="preserve"`;
  return `<cell r="${cellRef}" t="str"><v${space}>${escapeXml(text)}</v></cell>`;
}

/**
 * Rewrites every link cache in a workbook from a reader, in place.
 *
 * The reader is `{ readTargetCell, hasTarget, hasSheet }`. `readTargetCell(file,
 * sheet, cell)` returns a number, a string, a boolean, an error text such as
 * "#VALUE!", or null/undefined, and may return a promise. Null and undefined
 * both mean: keep the cached cell if the cache has one, write nothing if it
 * does not, so a blank leaf cell stays absent and a spreadsheet reads it as
 * blank. `hasTarget(file)` false leaves that link alone; `hasSheet(file, sheet)`
 * false skips that sheet's block. Both default to true.
 *
 * Each block's cells are the union of what it already caches and what the
 * workbook's formulas address, grouped into <row> elements as a worksheet is:
 * bare <cell> elements make LibreOffice discard the whole link.
 *
 * @param {Object} zip - one workbook's JSZip, mutated
 * @param {{readTargetCell: Function, hasTarget?: Function, hasSheet?: Function}} reader
 * @returns {Promise<{changed: boolean, cells: number}>} whether any part was
 *   rewritten, and how many cache cells the processed blocks carry
 */
export async function refreshLinkCaches(zip, reader) {
  const hasTarget = reader.hasTarget || (() => true);
  const hasSheet = reader.hasSheet || (() => true);

  const links = await externalLinks(zip);
  if (links.length === 0) return { changed: false, cells: 0 };

  const referencedCells = await collectExternalCellRefs(zip);
  let changed = false;
  let cells = 0;

  for (const link of links) {
    if (!link.targetFile || !(await hasTarget(link.targetFile))) continue;

    const linkFile = zip.file(link.path);
    const linkXml = await linkFile.async("string");

    const rewrites = [];
    for (const block of linkXml.matchAll(SHEET_DATA_BLOCK_PATTERN)) {
      const sheetId = Number(block[1]);
      const sheetName = link.sheetNames[sheetId];
      if (!sheetName || !(await hasSheet(link.targetFile, sheetName))) continue;

      const cachedCells = new Map();
      for (const cell of (block[2] || "").matchAll(CACHE_CELL_PATTERN)) cachedCells.set(cell[1], cell[0]);

      const wanted = new Set([...cachedCells.keys(), ...(referencedCells.get(`${link.index}|${sheetName}`) || [])]);
      const rows = new Map();
      for (const cellRef of sortCellRefs(wanted)) {
        const value = await reader.readTargetCell(link.targetFile, sheetName, cellRef);
        let cellXml;
        if (value === null || value === undefined) {
          if (!cachedCells.has(cellRef)) continue;
          cellXml = cachedCells.get(cellRef);
        } else {
          cellXml = externalCacheCell(cellRef, value);
        }
        const { row } = parseCellRef(cellRef);
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row).push(cellXml);
        cells += 1;
      }

      const rendered = [...rows.entries()].map(([row, rowCells]) => `<row r="${row}">${rowCells.join("")}</row>`);
      const replacement = rendered.length
        ? `<sheetData sheetId="${sheetId}">${rendered.join("")}</sheetData>`
        : `<sheetData sheetId="${sheetId}"/>`;
      if (replacement !== block[0]) rewrites.push({ from: block[0], to: replacement });
    }

    if (rewrites.length === 0) continue;

    let updated = linkXml;
    for (const { from, to } of rewrites) updated = updated.replace(from, to);
    zip.file(link.path, updated, { date: linkFile.date });
    changed = true;
  }

  return { changed, cells };
}

/**
 * The same over a workbook's bytes. The bytes come back untouched when no
 * cache moved; otherwise the zip is regenerated with the entry dates it
 * already carries, so two saves of the same book stay byte-identical.
 *
 * @param {Uint8Array} bytes
 * @param {Object} reader - as refreshLinkCaches takes it
 * @returns {Promise<{bytes: Uint8Array, changed: boolean, cells: number}>}
 */
export async function refreshWorkbookLinkCaches(bytes, reader) {
  const zip = await JSZip.loadAsync(bytes);
  const { changed, cells } = await refreshLinkCaches(zip, reader);
  if (!changed) return { bytes, changed, cells };
  const refreshed = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return { bytes: refreshed, changed, cells };
}

/**
 * A reader over a calculator results object: the hub's sheets under their
 * bare names, every leaf sheet under "File.xlsx!Sheet". Every figure is known
 * before the first file is refreshed, so order does not matter to it.
 *
 * @param {Object} results - { "Admin": { B4: ... }, "Sales.xlsx!Apr": { G1: ... } }
 * @param {{hub?: string}} [options]
 */
export function resultsReader(results, { hub = HUB_FILE } = {}) {
  return {
    hasTarget: () => true,
    hasSheet: () => true,
    readTargetCell(file, sheet, cell) {
      const value = results[file === hub ? sheet : `${file}!${sheet}`]?.[cell];
      if (value instanceof Date) {
        throw new Error(`${file}!${sheet}!${cell} is a Date; a cache holds dates as Excel serials`);
      }
      return value;
    },
  };
}

/**
 * Whether a hub's cached copy of a leaf cell is stale, and whether the leaf's
 * own figure has drifted from the engine's. Stale needs the cache to disagree
 * with both, so a corrupted leaf never reads as a stale hub.
 *
 * @param {{hubCache: *, leafValue: *, engineValue: *}} values
 * @param {Function} [canonical] - the comparison form; canonicalValue by default
 * @returns {{stale: boolean, drift: boolean}}
 */
export function classifyLinkCell({ hubCache, leafValue, engineValue }, canonical = canonicalValue) {
  const hub = canonical(hubCache);
  const leaf = canonical(leafValue);
  const engine = canonical(engineValue);
  return { stale: hub !== leaf && hub !== engine, drift: leaf !== engine };
}
