// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// web/browser-tests/r-sources.js
//
// The five sources of a figure the books-equivalence spec joins on a report
// key, S1 through S3 (S4 and S5 are the page's own zip export and its DOM,
// out of this module's reach). Each function is a thin read: S1 parses a
// fixture's own [expected] table, S2 and S3 spawn report.js and read back
// its report.json. canonical() and parseFigure() turn a raw value and a
// rendered string into the same comparable shape.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadScenario } from "../../app/lib/scenario-loader.js";
import { canonicalForUnit } from "../../app/bin/verify-roundtrip.js";
import { loadDiyaGlData, diyaGlToScenario, extractTaxDataFromBook } from "../../app/lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../../app/lib/diya-gl-calculator.js";
import { calculateExpectedTax } from "../../app/lib/tax/income-tax.js";
import { buildReportDocument, serializeReportDocument } from "../../app/lib/report-serializer.js";
import * as bst from "../../app/products/bst.js";
import { productModule } from "../../app/lib/products.js";

const ROOT = process.cwd();

// The three example books the page's own buttons load, each paired with its
// fixture (S1) and its report.js --data directory (S2).
export const SCENARIOS = [
  {
    scenario: "bst-scenario-basic",
    fixture: "app/test/fixtures/bst-scenario-basic.toml",
    bookDir: "examples/precision-code-ltd/bst",
    button: /bst-scenario-basic/,
  },
  {
    scenario: "bst-brickwork-pro-nonvat",
    fixture: "app/test/fixtures/bst-brickwork-pro-nonvat.toml",
    bookDir: "examples/brickwork-pro/bst-nonvat",
    button: /bst-brickwork-pro-nonvat/,
  },
  {
    scenario: "bst-sp-sixty",
    fixture: "app/test/fixtures/bst-sp-sixty.toml",
    bookDir: "examples/sp-sixty-driving/bst",
    button: /bst-sp-sixty/,
  },
];

// The three Self Employed books, each paired with its fixture (S1) and its
// report.js --data directory (S2). Only the advanced book is served as an
// example the page has a button for; the two BrickWork books reach the page
// as a diya-gl zip built from the same directory, so `example` is null for
// them.
export const SCENARIOS_SE = [
  {
    scenario: "se-scenario-advanced",
    fixture: "app/test/fixtures/se-scenario-advanced.toml",
    bookDir: "examples/precision-code-ltd/advanced",
    example: "se-scenario-advanced",
  },
  {
    scenario: "se-brickwork-pro-nonvat",
    fixture: "app/test/fixtures/se-brickwork-pro-nonvat.toml",
    bookDir: "examples/brickwork-pro/se-nonvat",
    example: null,
  },
  {
    scenario: "se-brickwork-pro-vat",
    fixture: "app/test/fixtures/se-brickwork-pro-vat.toml",
    bookDir: "examples/brickwork-pro/se-vat",
    example: null,
  },
];

const FIXTURE_BY_SCENARIO = new Map([...SCENARIOS, ...SCENARIOS_SE].map((s) => [s.scenario, s.fixture]));

/**
 * S1: a scenario fixture's own [expected] table -- the totals the fixture
 * was written to produce, independent of either engine.
 * @param {string} scenarioName - one of SCENARIOS[].scenario or SCENARIOS_SE[].scenario
 * @returns {Object} the fixture's `expected` table, or {} if it declares none
 */
export function s1(scenarioName) {
  const fixture = FIXTURE_BY_SCENARIO.get(scenarioName);
  if (!fixture) throw new Error(`s1: no fixture known for scenario "${scenarioName}"`);
  const scenario = loadScenario(path.resolve(ROOT, fixture));
  return scenario.expected || {};
}

function readReport(outDir) {
  const report = JSON.parse(fs.readFileSync(path.join(outDir, "report.json"), "utf-8"));
  return { map: new Map(report.values.map((entry) => [entry.key, { value: entry.value, unit: entry.unit }])), yearEnd: report.yearEnd };
}

function readReportMap(outDir) {
  return readReport(outDir).map;
}

const s2Cache = new Map();

/**
 * S2: report.json from the JS engine over a book's own diya-gl data --
 * the figures the page itself computes when it loads that example.
 * @param {string} bookDir - a diya-gl data directory, e.g. SCENARIOS[].bookDir
 * @param {string} [name] - a short label for the output directory; derived
 *   from bookDir when omitted
 * @param {string} [product] - the package report.js computes the book under
 * @returns {Map<string, {value: string, unit: string}>}
 */
export function s2(bookDir, name, product = "bst") {
  const cacheKey = `${path.resolve(ROOT, bookDir)}@${product}`;
  if (s2Cache.has(cacheKey)) return s2Cache.get(cacheKey);

  const label = name || bookDir.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  const outDir = path.resolve(ROOT, "target", `r-${label}`);
  execFileSync(process.execPath, ["app/bin/report.js", "--package", product, "--data", bookDir, "--output-dir", outDir], {
    cwd: ROOT,
    stdio: "pipe",
  });
  const map = readReportMap(outDir);
  s2Cache.set(cacheKey, map);
  return map;
}

const s2ForPackageCache = new Map();

/**
 * S2, computed for a stated year-end rather than the book's own -- the tax
 * tables report.js's --years names, in the <regime>-<start>-<end> form
 * generate-bst.yml's own scorecard step derives from a year-end, plus
 * --year-end itself so the two sides' report.json name the same year. A
 * book's [tax] section carries only its own year's rates (extractTaxDataFromBook
 * reads it as-is), so reaching another year's Admin figures takes an
 * explicit --years override, not just a later --year-end.
 * @param {string} bookDir - a diya-gl data directory, e.g. SCENARIOS[].bookDir
 * @param {string} yearEnd - YYYY-MM-DD, the UK tax year-end convention (5 April)
 * @param {string} [name] - a short label for the output directory; derived
 *   from bookDir when omitted
 * @param {string} [product] - the package report.js computes the book under
 * @returns {Map<string, {value: string, unit: string}>}
 */
export function s2ForPackage(bookDir, yearEnd, name, product = "bst") {
  const cacheKey = `${path.resolve(ROOT, bookDir)}@${yearEnd}@${product}`;
  if (s2ForPackageCache.has(cacheKey)) return s2ForPackageCache.get(cacheKey);

  const label = name || bookDir.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  const outDir = path.resolve(ROOT, "target", `r-${label}-${yearEnd}`);
  const taxYearEnd = Number(yearEnd.slice(0, 4));
  const years = `${productModule(product).PRODUCT.taxRegime}-${taxYearEnd - 1}-${taxYearEnd}`;
  execFileSync(
    process.execPath,
    ["app/bin/report.js", "--package", product, "--data", bookDir, "--years", years, "--year-end", yearEnd, "--output-dir", outDir],
    { cwd: ROOT, stdio: "pipe" },
  );
  const map = readReportMap(outDir);
  s2ForPackageCache.set(cacheKey, map);
  return map;
}

const BST_SCENARIO_BASIC_REPORT = /^GB_Accounts_Basic_Sole_Trader_(\d{4})_(\d{2})_(\d{2})__.*_bst-scenario-basic\.md$/;

let s3Cache = null;

/**
 * The year-end examples/bst-latest was built for. generate-bst.yml only
 * refreshes examples/bst-latest for the matrix's highest year-end, and
 * commits that same run's reports/*.md alongside it, so the highest
 * year-end named among the committed bst-scenario-basic reports is
 * bst-latest's own -- read off the fixture rather than assumed.
 * @returns {string} YYYY-MM-DD
 */
function latestBstYearEnd() {
  const reportsDir = path.resolve(ROOT, "reports");
  const yearEnds = fs
    .readdirSync(reportsDir)
    .map((name) => BST_SCENARIO_BASIC_REPORT.exec(name))
    .filter(Boolean)
    .map((m) => `${m[1]}-${m[2]}-${m[3]}`)
    .sort();
  const latest = yearEnds.at(-1);
  if (!latest) throw new Error("latestBstYearEnd: no reports/*_bst-scenario-basic.md found to read bst-latest's year-end from");
  return latest;
}

/**
 * S3: report.json read from the cached values of examples/bst-latest, the
 * one Excel package the repository keeps a saved reference of. Reads the
 * workbook's own cached cells -- no LibreOffice, no scenario, so it carries
 * no check/ keys of its own. Exists for bst-scenario-basic only. --year-end
 * names the year-end the fixture was actually built for (latestBstYearEnd),
 * so the returned report.json carries it, ready for s2ForPackage to match.
 * @returns {Map<string, {value: string, unit: string}>}
 */
export function s3() {
  if (s3Cache) return s3Cache.map;

  const outDir = path.resolve(ROOT, "target", "r-excel");
  execFileSync(
    process.execPath,
    [
      "app/bin/report.js",
      "--package",
      "bst",
      "--source-dir",
      "examples/bst-latest",
      "--mode",
      "saved",
      "--year-end",
      latestBstYearEnd(),
      "--output-dir",
      outDir,
    ],
    { cwd: ROOT, stdio: "pipe" },
  );
  s3Cache = readReport(outDir);
  return s3Cache.map;
}

/**
 * The year-end S3's report.json carries, for a caller (A3) that wants S2
 * built to match it. Reading it back off the document rather than calling
 * latestBstYearEnd() a second time keeps the two sides tied to whatever
 * year-end S3 actually reported under.
 * @returns {string} YYYY-MM-DD
 */
export function s3YearEnd() {
  s3();
  return s3Cache.yearEnd;
}

/**
 * A report value in the form its unit is compared in, byte-identical to
 * verify-roundtrip.js's own canonicalForUnit: money rounds half up to a
 * working precision then to the penny; a rate rounds half up to six places;
 * anything else compares as the trimmed string.
 * @param {string|number} value
 * @param {string} [unit]
 * @returns {string}
 */
export function canonical(value, unit) {
  return canonicalForUnit(String(value), unit);
}

/**
 * Apply one edit to a diya-gl book directory's own lines in Node, then build
 * report.json exactly the way report.js's --data path and the page's own
 * buildReport (data.js) both do: the same package name, engine, merged
 * scenario, checks, scenarioName and yearEnd. A browser edit's report.json
 * is expected to equal this function's `text`, byte for byte, for the same
 * edit applied to the same book.
 * @param {string} bookDir - a diya-gl data directory, e.g. examples/precision-code-ltd/bst
 * @param {(book: Object, lines: Array) => Array} edit - applies one edit to
 *   (book, lines) and returns the new lines array; typically one of
 *   diya-gl-edits.js's named edits, or book-checks.js's applyHelper wrapped
 *   to take (book, lines)
 * @returns {{text: string, document: Object, book: Object, lines: Array}}
 */
export function applyNamedEdit(bookDir, edit) {
  const resolvedBookDir = path.resolve(ROOT, bookDir);
  const { book, lines } = loadDiyaGlData(resolvedBookDir);
  const newLines = edit(book, lines);

  const taxData = extractTaxDataFromBook(book, "bst");
  const scenario = diyaGlToScenario(book, newLines, "bst");
  const results = calculateFromDiyaGl(book, newLines, "bst", taxData, scenario);
  const mergedScenario = { ...scenario, ...scenario.expected };
  const periodEnd = book.documentInfo?.periodCoveredEnd;
  const yearEnd = periodEnd ? new Date(periodEnd).toISOString().slice(0, 10) : null;
  const checks = bst.checkCompliance({ ...results }, mergedScenario, taxData, calculateExpectedTax, yearEnd);

  const document = buildReportDocument({
    packageName: "bst",
    engine: "js",
    results,
    productMod: bst,
    scenario: mergedScenario,
    checks,
    scenarioName: book.documentInfo?.entriesComment,
    yearEnd,
  });

  return { text: serializeReportDocument(document), document, book, lines: newLines };
}

/**
 * Turns a figure as the page renders it into a number in the same scale R
 * stores, plus a guessed unit. A percentage or a pence-per-mile figure is
 * shown scaled by 100, so both divide back down; a plain or currency-prefixed
 * number does not. The guess is informational only -- a caller comparing
 * against R already knows the true unit and should canonicalise under that
 * instead of this one, since "10,000" and a whole-pound box figure render
 * identically and only R's own unit tells them apart.
 * @param {string} text - an element's rendered text or input value
 * @returns {{value: number, unit: "money"|"rate"|"count"|"text"}}
 */
export function parseFigure(text) {
  const trimmed = String(text ?? "").trim();

  const percent = /^(-?[\d,]+(?:\.\d+)?)%$/.exec(trimmed);
  if (percent) return { value: Number(percent[1].replace(/,/g, "")) / 100, unit: "rate" };

  const pence = /^(-?[\d,]+(?:\.\d+)?)p$/.exec(trimmed);
  if (pence) return { value: Number(pence[1].replace(/,/g, "")) / 100, unit: "rate" };

  const hasCurrency = trimmed.includes("£");
  const bare = trimmed.replace(/£/g, "");
  const numeric = /^-?[\d,]+(?:\.\d+)?$/.exec(bare);
  if (numeric) {
    return {
      value: Number(bare.replace(/,/g, "")),
      unit: hasCurrency || bare.includes(".") ? "money" : "count",
    };
  }

  return { value: NaN, unit: "text" };
}

const SE_SCENARIO_ADVANCED_REPORT = /^GB_Accounts_Self_Employed_(\d{4})_(\d{2})_(\d{2})__.*_se-scenario-advanced\.md$/;

let s3SeCache = null;

/**
 * The year-end examples/se-latest was built for, read off the committed
 * report names the same run wrote, exactly as latestBstYearEnd reads
 * bst-latest's.
 * @returns {string} YYYY-MM-DD
 */
function latestSeYearEnd() {
  const reportsDir = path.resolve(ROOT, "reports");
  const yearEnds = fs
    .readdirSync(reportsDir)
    .map((name) => SE_SCENARIO_ADVANCED_REPORT.exec(name))
    .filter(Boolean)
    .map((m) => `${m[1]}-${m[2]}-${m[3]}`)
    .sort();
  const latest = yearEnds.at(-1);
  if (!latest) throw new Error("latestSeYearEnd: no reports/*_se-scenario-advanced.md found to read se-latest's year-end from");
  return latest;
}

/**
 * S3 for Self Employed: report.json read from the cached values of the nine
 * workbooks in examples/se-latest, the saved Excel reference the repository
 * keeps for this product. Reads each workbook's own cached cells -- no
 * LibreOffice, no scenario, so it carries no check/ keys and none of the
 * journal-category netting the --data path derives from the lines. Exists
 * for se-scenario-advanced only.
 * @returns {Map<string, {value: string, unit: string}>}
 */
export function s3Se() {
  if (s3SeCache) return s3SeCache.map;

  const outDir = path.resolve(ROOT, "target", "r-se-excel");
  execFileSync(
    process.execPath,
    [
      "app/bin/report.js",
      "--package",
      "se",
      "--source-dir",
      "examples/se-latest",
      "--mode",
      "saved",
      "--year-end",
      latestSeYearEnd(),
      "--output-dir",
      outDir,
    ],
    { cwd: ROOT, stdio: "pipe" },
  );
  s3SeCache = readReport(outDir);
  return s3SeCache.map;
}

/**
 * The year-end S3's Self Employed report.json carries, for a caller (A3)
 * that wants S2 built to match it.
 * @returns {string} YYYY-MM-DD
 */
export function s3SeYearEnd() {
  s3Se();
  return s3SeCache.yearEnd;
}
