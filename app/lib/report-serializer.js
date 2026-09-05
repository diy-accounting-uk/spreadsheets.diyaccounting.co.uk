// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// report-serializer.js — Builds R, the one canonical JSON document a package
// run carries, from the structures the product modules already produce:
// the cell read map, reportSections(), profitBridge(), categoryNetting() and
// checkCompliance(). Both engines write R through this module, so the Excel
// side and the JS side are compared on one form and neither formats a value
// on its way into the comparison.
//
// Three kinds of key, each stable across products, year ends and engines:
//
//   cell/<file>!<sheet>!<A1>      one per cell read; single-file products
//                                 drop the <file>! part
//   section/<section>/<row>[#n]   one per printed report row, in section
//                                 order; #n disambiguates a repeated label
//   check/<check name>            one per compliance check
//
// A value is always a string, never a JSON number, so no reader has to
// re-derive the precision the engine produced. A missing value is an absent
// entry, never null or an em dash: that is what makes "no JS value" a count
// rather than a diff line.

import { PROFIT_BRIDGE_TITLE, CATEGORY_NETTING_TITLE } from "./report-generator.js";

// The hub every multi-file package hangs off. A results key with no "!" in
// it names a sheet on this file; a key that carries one already names its
// own file, which is how additionalReads results arrive.
const MULTI_FILE_HUB = "Financialaccounts.xlsx";

// The em dash report-generator.js prints for a cell the sheet never filled,
// and the single space a populated-but-blank Excel cell reads back as.
const ABSENT_VALUES = new Set(["", " ", "—", "-"]);

/**
 * A label or title as a key segment: lower case, runs of anything that is
 * not a letter or a digit collapsed to one hyphen, no leading or trailing
 * hyphen. Markdown emphasis and the &nbsp; groups an indent is drawn with
 * are presentation, so they come off first.
 * @param {string} text
 * @returns {string}
 */
export function slug(text) {
  return String(text)
    .replace(/(&nbsp;)+/g, " ")
    .replace(/\*\*/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A number as the decimal string R carries: no thousands separator, no
 * currency symbol, no exponent, and no float representation noise. The
 * comparator rounds it further once it knows the value's unit.
 * @param {number} value
 * @returns {string}
 */
export function canonicalNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  // A nil that arrived by negation carries a sign bit and would print "-0".
  if (value === 0) return "0";
  const cleaned = Number(value.toPrecision(15));
  if (Number.isInteger(cleaned)) return String(cleaned);
  // toPrecision(15) can hand back an exponent form for a very small or very
  // large figure; toFixed(12) keeps the same value in plain decimal.
  const plain = Math.abs(cleaned) >= 1e-6 && Math.abs(cleaned) < 1e15 ? String(cleaned) : cleaned.toFixed(12);
  return plain.includes("e") ? cleaned.toFixed(12) : plain;
}

/**
 * Any value a sheet cell, a report row or a check can carry, as the string R
 * holds. Returns null when the value is absent, which the caller writes as
 * no entry at all.
 * @param {*} value
 * @returns {string|null}
 */
export function canonicalValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return Number.isNaN(value) ? null : canonicalNumber(value);
  const text = String(value)
    .replace(/(&nbsp;)+/g, " ")
    .replace(/\*\*/g, "")
    .trim();
  if (ABSENT_VALUES.has(text)) return null;
  // A figure a report row already formatted for a reader: strip the grouping
  // separators back off so both engines' entries carry one form of the number.
  if (/^[-+]?[0-9][0-9,]*(\.[0-9]+)?$/.test(text)) {
    const parsed = Number(text.replace(/,/g, "").replace(/^\+/, ""));
    if (Number.isFinite(parsed)) return canonicalNumber(parsed);
  }
  return text;
}

/**
 * The cell key for one read. The results object a multi-file run produces
 * mixes hub sheet names with "<file>!<sheet>" keys from additionalReads;
 * both reach the same shape here so the two engines join on it.
 * @param {string} resultsKey - a top-level key of the results object
 * @param {string} cell - the A1 reference
 * @param {boolean} multiFile - whether the product spans several workbooks
 * @returns {string}
 */
export function cellKey(resultsKey, cell, multiFile) {
  if (!multiFile) return `cell/${resultsKey}!${cell}`;
  return resultsKey.includes("!") ? `cell/${resultsKey}!${cell}` : `cell/${MULTI_FILE_HUB}!${resultsKey}!${cell}`;
}

/**
 * The cell key for a "<sheet>!<A1>" reference a report row names outright,
 * as the profit bridge's rows do. The A1 reference is the last segment; a
 * sheet name may hold a "!" of its own where it carries a file prefix.
 * @param {string} reference - e.g. "Profit & Loss Acc!C24" or "Sales.xlsx!Apr!G1"
 * @param {boolean} multiFile
 * @returns {string}
 */
export function referenceKey(reference, multiFile) {
  const split = String(reference).lastIndexOf("!");
  if (split === -1) return null;
  return cellKey(reference.slice(0, split), reference.slice(split + 1), multiFile);
}

// A section row reprints a cell the report already carries. Neither
// reportSections() nor the row itself names that cell, so the link is made
// from what both sides do carry: the row's label is the cell's own DIY
// label, and the row's value is that cell formatted. Matching on the pair,
// and consuming each cell once, links a repeated label to the right cell.
function plainLabel(text) {
  return String(text ?? "")
    .replace(/(&nbsp;)+/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

function buildCellIndexByLabel(labels, cellEntries) {
  const byLabel = new Map();
  for (const entry of cellEntries) {
    const label = plainLabel(labels[entry.labelKey]?.diyLabel);
    if (!label) continue;
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push(entry);
  }
  return byLabel;
}

// A printed row and the cell it reprints agree at the penny; the sheet's
// cached float can carry noise past that (417.300000000001 against 417.3).
function sameFigure(a, b) {
  if (a === b) return true;
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.round(x * 100) === Math.round(y * 100);
}

function takeSourceCell(byLabel, consumed, label, value) {
  const candidates = (byLabel.get(label) || []).filter((entry) => !consumed.has(entry.key));
  if (candidates.length === 0) return null;
  const sameValue = candidates.filter((entry) => sameFigure(entry.value, value));
  const chosen = sameValue.length === 1 ? sameValue[0] : candidates.length === 1 ? candidates[0] : null;
  if (!chosen) return null;
  consumed.add(chosen.key);
  return chosen;
}

// Every cell the read set produced, in results order, with the key R uses
// and the key cellLabels() is indexed by. A cell with no value is left out:
// an absent entry is what makes "no JS value" countable.
function collectCellEntries(results, multiFile) {
  const entries = [];
  for (const [resultsKey, cells] of Object.entries(results || {})) {
    if (!cells || typeof cells !== "object") continue;
    for (const [cell, raw] of Object.entries(cells)) {
      const value = canonicalValue(raw);
      if (value === null) continue;
      entries.push({
        key: cellKey(resultsKey, cell, multiFile),
        labelKey: `${resultsKey}!${cell}`,
        value,
      });
    }
  }
  return entries;
}

function sectionRowEntries(sections, byLabel, consumed, labels) {
  const entries = [];
  for (const section of sections) {
    const sectionSlug = slug(section.title);
    const occurrences = new Map();
    for (const row of section.rows) {
      const value = canonicalValue(row.value);
      if (value === null) continue;
      const rowSlug = slug(row.label);
      if (rowSlug === "") continue;
      const seen = (occurrences.get(rowSlug) || 0) + 1;
      occurrences.set(rowSlug, seen);
      const key = `section/${sectionSlug}/${rowSlug}${seen > 1 ? `#${seen}` : ""}`;
      const source = takeSourceCell(byLabel, consumed, plainLabel(row.label), value);
      // A row that reprints a cell carries that cell's own value, not the
      // print: the print is rounded straight to the penny, and a figure a
      // hair under a half-penny rounds one way out of the sheet's cached
      // float and the other way out of the engine's, so two runs of the same
      // figure would disagree at a key the cell's own entry compares clean.
      // The bridge rows already carry their raw number for the same reason.
      // The printed value stands for a row that names no cell.
      const entry = { key, unit: source ? labels[source.labelKey]?.unit : undefined, value: source ? source.value : value };
      if (source) entry.source = source.key;
      entries.push(entry);
    }
  }
  return entries;
}

// The bridge and the netting table are printed as sections of their own, so
// they take section keys too. Both carry a total the report states beside
// its own operands, which is what derivedFrom names: the comparator scores
// the total through the addends rather than a second time.
function bridgeEntries(bridge, multiFile) {
  if (!bridge) return [];
  const sectionSlug = slug(PROFIT_BRIDGE_TITLE);
  const entries = [];
  const operandKeys = [];
  for (const row of bridge.rows) {
    const key = `section/${sectionSlug}/${slug(row.label)}`;
    operandKeys.push(key);
    const entry = { key, unit: "money", value: canonicalNumber(row.value) };
    // A bridge row names the cell it reprints outright, so the link needs no
    // label matching. A row the bridge negates on its way in is still that
    // cell's value; the sign belongs to the bridge, not to the reading.
    const source = row.cell ? referenceKey(row.cell, multiFile) : null;
    if (source) entry.source = source;
    entries.push(entry);
  }
  entries.push({
    key: `section/${sectionSlug}/tax-profit-the-bridge-computes`,
    unit: "money",
    value: canonicalNumber(bridge.computed),
    derivedFrom: operandKeys,
  });
  const sheetSource = bridge.sheetCell ? referenceKey(bridge.sheetCell, multiFile) : null;
  entries.push({
    key: `section/${sectionSlug}/tax-profit-the-sheet-carries`,
    unit: "money",
    value: canonicalNumber(bridge.sheetProfit),
    ...(sheetSource ? { source: sheetSource } : {}),
  });
  entries.push({
    key: `section/${sectionSlug}/residue`,
    unit: "money",
    value: canonicalNumber(bridge.residue),
  });
  return entries;
}

function nettingEntries(netting, multiFile) {
  if (!netting || netting.rows.length === 0) return [];
  const sectionSlug = slug(CATEGORY_NETTING_TITLE);
  const entries = [{ key: `section/${sectionSlug}/rate`, unit: "rate", value: canonicalNumber(netting.rate) }];
  for (const row of netting.rows) {
    const rowSlug = `${slug(row.label)}-${slug(row.code)}`;
    const gross = `section/${sectionSlug}/${rowSlug}/gross`;
    const net = `section/${sectionSlug}/${rowSlug}/net`;
    const downstream = `section/${sectionSlug}/${rowSlug}/downstream`;
    const downstreamSource = row.cell ? referenceKey(row.cell, multiFile) : null;
    entries.push({ key: gross, unit: "money", value: canonicalNumber(row.gross) });
    entries.push({
      key: `section/${sectionSlug}/${rowSlug}/vat`,
      unit: "money",
      value: canonicalNumber(row.vat),
      derivedFrom: [gross, net],
    });
    entries.push({ key: net, unit: "money", value: canonicalNumber(row.net) });
    entries.push({
      key: downstream,
      unit: "money",
      value: canonicalNumber(row.downstream),
      ...(downstreamSource ? { source: downstreamSource } : {}),
    });
    entries.push({
      key: `section/${sectionSlug}/${rowSlug}/residue`,
      unit: "money",
      value: canonicalNumber(row.residue),
      derivedFrom: [net, downstream],
    });
  }
  return entries;
}

function checkEntries(checks) {
  const entries = [];
  const occurrences = new Map();
  for (const check of checks || []) {
    const seen = (occurrences.get(check.name) || 0) + 1;
    occurrences.set(check.name, seen);
    const entry = {
      key: `check/${check.name}${seen > 1 ? `#${seen}` : ""}`,
      unit: "verdict",
      value: check.pass ? "pass" : "fail",
    };
    const expected = canonicalValue(check.expected);
    const actual = canonicalValue(check.actual);
    if (expected !== null) entry.expected = expected;
    if (actual !== null) entry.actual = actual;
    // The window the check itself allows. The comparator reads its
    // tolerances from here rather than restating them, so a comparator
    // window can never be wider than the check standing behind it.
    if (typeof check.tolerance === "number") entry.tolerance = canonicalNumber(check.tolerance);
    entries.push(entry);
  }
  return entries;
}

/**
 * Build R for one package run.
 *
 * @param {Object} options
 * @param {string} options.packageName - bst, taxi, se or ltd
 * @param {string} options.engine - "excel" or "js", the side that produced these values
 * @param {Object} options.results - the cell read map, sheet -> cell -> value
 * @param {Object} options.productMod - the product module (app/products/<name>.js)
 * @param {Object} [options.scenario] - the merged scenario, where the run has one
 * @param {Array} [options.checks] - checkCompliance() output, where the run has one
 * @param {string} [options.scenarioName]
 * @param {string} [options.yearEnd] - YYYY-MM-DD
 * @returns {Object} the R document, entries sorted by key
 */
export function buildReportDocument({ packageName, engine, results, productMod, scenario, checks, scenarioName, yearEnd }) {
  const multiFile = Boolean(productMod.MULTI_FILE);
  const labels = typeof productMod.cellLabels === "function" ? productMod.cellLabels() : {};
  const cellEntries = collectCellEntries(results, multiFile);

  const values = cellEntries.map((entry) => ({
    key: entry.key,
    unit: labels[entry.labelKey]?.unit,
    value: entry.value,
  }));

  const byLabel = buildCellIndexByLabel(labels, cellEntries);
  const consumed = new Set();

  if (typeof productMod.reportSections === "function") {
    values.push(...sectionRowEntries(productMod.reportSections(results), byLabel, consumed, labels));
  }
  if (typeof productMod.profitBridge === "function") {
    values.push(...bridgeEntries(productMod.profitBridge(results), multiFile));
  }
  if (typeof productMod.categoryNetting === "function") {
    values.push(...nettingEntries(productMod.categoryNetting(results, scenario), multiFile));
  }
  values.push(...checkEntries(checks));

  values.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const document = { package: packageName, engine };
  if (scenarioName) document.scenario = scenarioName;
  if (yearEnd) document.yearEnd = yearEnd;
  // An undeclared unit is an absent field, not a null: a value with no unit
  // is compared exactly, and writing the absence explicitly would only
  // invite a reader to treat "null" as a unit of its own.
  document.values = values.map((entry) => {
    const out = { key: entry.key };
    if (entry.unit) out.unit = entry.unit;
    out.value = entry.value;
    if (entry.source) out.source = entry.source;
    if (entry.derivedFrom) out.derivedFrom = entry.derivedFrom;
    if (entry.expected !== undefined) out.expected = entry.expected;
    if (entry.actual !== undefined) out.actual = entry.actual;
    if (entry.tolerance !== undefined) out.tolerance = entry.tolerance;
    return out;
  });
  return document;
}

/**
 * R as the text written to report.json: two-space indented, newline
 * terminated, so two runs that agree produce byte-identical files.
 * @param {Object} document - buildReportDocument() output
 * @returns {string}
 */
export function serializeReportDocument(document) {
  return JSON.stringify(document, null, 2) + "\n";
}
