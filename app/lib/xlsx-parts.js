// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// xlsx-parts.js — reading the parts of an xlsx with JSZip and regex: the
// sheet name to path map, the shared strings table, one cell's value, and
// the XML escaping a written cell needs. Nothing here touches the file
// system, so the browser bundle and the LibreOffice runner share it.

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

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

// One pass, so an entity the text spells out ("&amp;lt;") stays spelled out.
function decodeXmlEntities(s) {
  return s.replace(/&(amp|lt|gt|quot|apos);/g, (entity, name) => XML_ENTITIES[name]);
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

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export { buildSheetMap, loadSharedStrings, readCellValue, decodeXmlEntities, escapeXml };
