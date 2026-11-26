// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// calc-chain.js — the integrity of a workbook's xl/calcChain.xml.
//
// The calc chain lists every formula cell in the order Excel last calculated
// them. Excel trusts it on open: an entry that names a cell with no formula
// makes Excel report "We found a problem with some content", repair the file
// ("Removed Records: Formula from /xl/calcChain.xml part"), open it as
// "<name> - Repaired" and refuse a plain Save. A template edit that deletes a
// formula therefore also has to delete that cell's calc chain entry.
//
// Each entry is <c r="A1" i="N"/>. The i attribute is the sheetId from
// xl/workbook.xml, and an entry without one belongs to the sheet of the entry
// before it. Removing an entry that carries i therefore moves that i onto the
// next entry when the next entry has none.

import { parseCells } from "./template-formula-map.js";

export const CALC_CHAIN_PART = "xl/calcChain.xml";
const CALC_CHAIN_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain";

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function calcChainEntries(xml) {
  return [...xml.matchAll(/<c\s([^>]*?)\/>/g)].map((m) => ({ text: m[0], attrs: ` ${m[1]}` }));
}

// sheetId -> { name, path } for every sheet in the workbook.
async function sheetsById(zip) {
  const wbXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const targetById = new Map();
  for (const [rel] of relsXml.matchAll(/<Relationship\s[^>]*\/>/g)) {
    targetById.set(attr(rel, "Id"), attr(rel, "Target"));
  }
  const byId = new Map();
  for (const [sheet] of wbXml.matchAll(/<sheet\s[^>]*\/>/g)) {
    const target = targetById.get(attr(sheet, "r:id"));
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    byId.set(attr(sheet, "sheetId"), { name: attr(sheet, "name").replace(/&amp;/g, "&"), path });
  }
  return byId;
}

// Walk the chain, resolving each entry's sheet, and report whether the cell
// it names carries a formula.
async function walkCalcChain(zip, xml) {
  const sheets = await sheetsById(zip);
  const formulaCellsByPath = new Map();
  const formulaCellsOf = async (path) => {
    if (!formulaCellsByPath.has(path)) {
      const cells = parseCells(await zip.file(path).async("string"));
      formulaCellsByPath.set(path, new Set([...cells].filter(([, c]) => c.hasF).map(([ref]) => ref)));
    }
    return formulaCellsByPath.get(path);
  };

  const walked = [];
  let sheetId = null;
  for (const entry of calcChainEntries(xml)) {
    sheetId = attr(entry.attrs, "i") ?? sheetId;
    const ref = attr(entry.attrs, "r");
    const sheet = sheets.get(sheetId);
    const hasFormula = sheet ? (await formulaCellsOf(sheet.path)).has(ref) : false;
    walked.push({ ...entry, sheetId, ref, sheet, hasFormula });
  }
  return walked;
}

/**
 * Every way a workbook's calc chain disagrees with the workbook: an entry
 * naming a cell without a formula or a sheet that does not exist, and a
 * calc chain part, relationship or content type override present without
 * the other two.
 *
 * @param {Object} zip - a JSZip of an xlsx
 * @returns {Promise<string[]>} one description per problem, empty when clean
 */
export async function calcChainProblems(zip) {
  const problems = [];
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const typesXml = await zip.file("[Content_Types].xml").async("string");
  const hasPart = Boolean(zip.file(CALC_CHAIN_PART));
  const hasRel = [...relsXml.matchAll(/<Relationship\s[^>]*\/>/g)].some(([rel]) => attr(rel, "Type") === CALC_CHAIN_REL_TYPE);
  const hasOverride = typesXml.includes('PartName="/xl/calcChain.xml"');
  if (hasRel && !hasPart) problems.push("xl/_rels/workbook.xml.rels names a calcChain part the package does not hold");
  if (hasOverride && !hasPart) problems.push("[Content_Types].xml declares a calcChain part the package does not hold");
  if (hasPart && !hasRel) problems.push("xl/calcChain.xml is not related from xl/_rels/workbook.xml.rels");
  if (!hasPart) return problems;

  const xml = await zip.file(CALC_CHAIN_PART).async("string");
  for (const entry of await walkCalcChain(zip, xml)) {
    if (!entry.sheet) problems.push(`calcChain entry ${entry.ref} names sheetId ${entry.sheetId}, which the workbook does not have`);
    else if (!entry.hasFormula) problems.push(`calcChain entry ${entry.sheet.name}!${entry.ref} names a cell with no formula`);
  }
  return problems;
}

/**
 * Remove every calc chain entry that names a cell without a formula, keeping
 * the sheet each remaining entry belongs to. Returns the number of entries
 * removed; the zip is changed only when that is above zero.
 *
 * @param {Object} zip - a JSZip of an xlsx
 * @returns {Promise<number>}
 */
export async function removeStaleCalcChainEntries(zip) {
  const part = zip.file(CALC_CHAIN_PART);
  if (!part) return 0;
  const xml = await part.async("string");
  const walked = await walkCalcChain(zip, xml);
  if (walked.every((entry) => entry.sheet && entry.hasFormula)) return 0;

  const kept = [];
  let carried = null; // attributes a removed entry passes to the next kept one
  let lastKeptSheetId = null;
  for (const entry of walked) {
    if (!entry.sheet || !entry.hasFormula) {
      carried = { level: (carried?.level ?? false) || attr(entry.attrs, "l") === "1" };
      continue;
    }
    let text = entry.text;
    if (attr(entry.attrs, "i") === null && entry.sheetId !== lastKeptSheetId) {
      text = text.replace(/\sr="[^"]*"/, (r) => `${r} i="${entry.sheetId}"`);
    }
    if (carried?.level && attr(entry.attrs, "l") === null) text = text.replace(/\/>$/, ' l="1"/>');
    carried = null;
    lastKeptSheetId = entry.sheetId;
    kept.push({ from: entry.text, to: text });
  }

  if (kept.length === 0) {
    await removeCalcChain(zip);
    return walked.length;
  }
  const head = xml.slice(0, xml.indexOf(walked[0].text));
  const tail = xml.slice(xml.lastIndexOf(walked[walked.length - 1].text) + walked[walked.length - 1].text.length);
  zip.file(CALC_CHAIN_PART, head + kept.map((entry) => entry.to).join("") + tail, { date: part.date });
  return walked.length - kept.length;
}

/**
 * Remove the calc chain together with its relationship and its content type
 * override, so that Excel builds a new one on open. Removing the part alone
 * leaves a relationship to a part the package does not hold.
 *
 * @param {Object} zip - a JSZip of an xlsx
 */
export async function removeCalcChain(zip) {
  if (zip.file(CALC_CHAIN_PART)) zip.remove(CALC_CHAIN_PART);

  const relsPath = "xl/_rels/workbook.xml.rels";
  const relsXml = await zip.file(relsPath).async("string");
  const rels = relsXml.replace(/<Relationship\s[^>]*\/>/g, (rel) => (attr(rel, "Type") === CALC_CHAIN_REL_TYPE ? "" : rel));
  if (rels !== relsXml) zip.file(relsPath, rels, { date: zip.file(relsPath).date, createFolders: false });

  const typesPath = "[Content_Types].xml";
  const typesXml = await zip.file(typesPath).async("string");
  const types = typesXml.replace(/<Override\s[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/g, "");
  if (types !== typesXml) zip.file(typesPath, types, { date: zip.file(typesPath).date, createFolders: false });
}
