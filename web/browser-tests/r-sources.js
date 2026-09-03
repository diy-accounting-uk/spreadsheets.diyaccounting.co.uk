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

const FIXTURE_BY_SCENARIO = new Map(SCENARIOS.map((s) => [s.scenario, s.fixture]));

/**
 * S1: a scenario fixture's own [expected] table -- the totals the fixture
 * was written to produce, independent of either engine.
 * @param {string} scenarioName - one of SCENARIOS[].scenario
 * @returns {Object} the fixture's `expected` table, or {} if it declares none
 */
export function s1(scenarioName) {
  const fixture = FIXTURE_BY_SCENARIO.get(scenarioName);
  if (!fixture) throw new Error(`s1: no fixture known for scenario "${scenarioName}"`);
  const scenario = loadScenario(path.resolve(ROOT, fixture));
  return scenario.expected || {};
}

function readReportMap(outDir) {
  const report = JSON.parse(fs.readFileSync(path.join(outDir, "report.json"), "utf-8"));
  return new Map(report.values.map((entry) => [entry.key, { value: entry.value, unit: entry.unit }]));
}

const s2Cache = new Map();

/**
 * S2: report.json from the JS engine over a book's own diya-gl data --
 * the figures the page itself computes when it loads that example.
 * @param {string} bookDir - a diya-gl data directory, e.g. SCENARIOS[].bookDir
 * @param {string} [name] - a short label for the output directory; derived
 *   from bookDir when omitted
 * @returns {Map<string, {value: string, unit: string}>}
 */
export function s2(bookDir, name) {
  const resolvedBookDir = path.resolve(ROOT, bookDir);
  if (s2Cache.has(resolvedBookDir)) return s2Cache.get(resolvedBookDir);

  const label = name || bookDir.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  const outDir = path.resolve(ROOT, "target", `r-${label}`);
  execFileSync(process.execPath, ["app/bin/report.js", "--package", "bst", "--data", bookDir, "--output-dir", outDir], {
    cwd: ROOT,
    stdio: "pipe",
  });
  const map = readReportMap(outDir);
  s2Cache.set(resolvedBookDir, map);
  return map;
}

let s3Cache = null;

/**
 * S3: report.json read from the cached values of examples/bst-latest, the
 * one Excel package the repository keeps a saved reference of. Reads the
 * workbook's own cached cells -- no LibreOffice, no scenario, so it carries
 * no check/ keys of its own. Exists for bst-scenario-basic only.
 * @returns {Map<string, {value: string, unit: string}>}
 */
export function s3() {
  if (s3Cache) return s3Cache;

  const outDir = path.resolve(ROOT, "target", "r-excel");
  execFileSync(
    process.execPath,
    ["app/bin/report.js", "--package", "bst", "--source-dir", "examples/bst-latest", "--mode", "saved", "--output-dir", outDir],
    { cwd: ROOT, stdio: "pipe" },
  );
  s3Cache = readReportMap(outDir);
  return s3Cache;
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
