#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// verify-roundtrip.js — Score EQ1 (report equivalence) between an Excel-side
// report tree and a JS-side report tree, both written by report.js.
//
// A diff -r line count moves when a report section is added, when a label
// is reworded, and when a value changes, and the three are indistinguishable.
// This parses both trees into "file # row label # occurrence" keys and
// compares the values at each key instead, giving four counts that can only
// fall: equal, differing, no JS value, no Excel value.
//
// Usage:
//   node app/bin/verify-roundtrip.js --package ltd \
//     --excel target/ltd-excel-reports --js target/ltd-diya-gl-reports \
//     --budget app/data/roundtrip-budget.json

import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

// A markdown table cell as report-generator.js writes it: a bold summary
// row wraps the whole cell in "**", and an indented row's label carries one
// or more "&nbsp;" groups repeated per indent level. Both are presentation,
// not part of the value the sheet computed.
function cleanCell(raw) {
  return raw
    .replace(/(&nbsp;)+/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

// A table row starts and ends with "|". A separator row (the "|---|------:|"
// line under a header) carries only pipes, dashes, colons and whitespace.
function isTableRow(line) {
  return line.startsWith("|") && line.trimEnd().endsWith("|");
}
function isSeparatorRow(line) {
  return isTableRow(line) && /^\|[\s:|-]+\|$/.test(line.trim());
}
function splitRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map(cleanCell);
}

// report.js's own two named files carry a column layout where the value of
// interest is not the last column: cell-values.md prints
// Cell | DIY Label | Value | diya-gl mapping, and compliance-checks.md
// prints Check | Expected | Actual | Diff | Result. Every other file
// report-generator.js writes is a plain label | ... | Amount table, where
// the last column is the value and everything before it names the row.
const NAMED_COLUMN_FILES = {
  "cell-values.md": { valueColumn: 2 },
  "compliance-checks.md": { valueColumn: 2 },
};

/**
 * Parse one report.js markdown file into an ordered list of { label, value }
 * entries. cell-values.md's label carries the sheet name from the "## "
 * heading above its table, so a cell reference stays distinct across sheets.
 * @param {string} filename
 * @param {string} content
 * @returns {Array<{label: string, value: string}>}
 */
export function parseReportFile(filename, content) {
  const named = NAMED_COLUMN_FILES[filename];
  const entries = [];
  const lines = content.split("\n");
  let heading = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      heading = line.slice(3).trim();
      continue;
    }
    if (!isTableRow(line) || isSeparatorRow(line)) continue;
    // A header row is always followed immediately by a separator row; a
    // data row never is, so this is how a row is told from the header
    // naming its own columns.
    if (isSeparatorRow(lines[i + 1] || "")) continue;

    const cells = splitRow(line);
    if (cells.every((c) => c === "")) continue; // spacer row

    if (named) {
      const label = filename === "cell-values.md" ? `${heading}!${cells[0]}` : cells[0];
      entries.push({ label, value: cells[named.valueColumn] });
    } else {
      const value = cells[cells.length - 1];
      const label = cells
        .slice(0, -1)
        .filter((c) => c !== "")
        .join(" ");
      if (label === "" && value === "") continue;
      entries.push({ label, value });
    }
  }

  return entries;
}

/**
 * Parse every .md file in a report.js output directory into one
 * "file # label # occurrence" -> value map. The occurrence index
 * disambiguates a label that repeats within the same file (a label two
 * sections both use).
 * @param {string} dir
 * @returns {Map<string, string>}
 */
export function readReportTree(dir) {
  const values = new Map();
  const counts = new Map();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  for (const filename of files) {
    const content = readFileSync(resolve(dir, filename), "utf8");
    for (const { label, value } of parseReportFile(filename, content)) {
      const countKey = `${filename} # ${label}`;
      const occurrence = counts.get(countKey) || 0;
      counts.set(countKey, occurrence + 1);
      values.set(`${countKey} # ${occurrence}`, value);
    }
  }

  return values;
}

// A value cell strips its own comma grouping and any "+" a diff column
// carries; "—" and "" both mean the row names nothing.
function toNumber(value) {
  if (typeof value !== "string") return NaN;
  const cleaned = value.replace(/,/g, "").replace(/^\+/, "").trim();
  if (cleaned === "" || cleaned === "—" || cleaned === "-") return NaN;
  return Number(cleaned);
}

// Money to the penny: report-generator.js's reportAmount() rounds to 2
// decimal places, and toPrecision(15) on the appendix leaves float noise
// under a thousandth, so 0.005 catches both without passing a real penny.
export const DEFAULT_TOLERANCE = 0.005;

/**
 * Whether two report cell values are the same figure. Both sides parse as
 * numbers: compared with tolerance. Either side does not: compared as text,
 * so a label, a business name or a "—" placeholder still counts.
 */
export function valuesEqual(a, b, tolerance = DEFAULT_TOLERANCE) {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return Math.abs(na - nb) <= tolerance;
  return String(a ?? "").trim() === String(b ?? "").trim();
}

/**
 * Score EQ1 (report equivalence) between an Excel-side and a JS-side report
 * tree, already parsed into "file # label # occurrence" -> value maps.
 */
export function scoreReportTrees(excelValues, jsValues, tolerance = DEFAULT_TOLERANCE) {
  const keys = new Set([...excelValues.keys(), ...jsValues.keys()]);
  let equal = 0;
  const differingKeys = [];
  const noJsValueKeys = [];
  const noExcelValueKeys = [];

  for (const key of keys) {
    const hasExcel = excelValues.has(key);
    const hasJs = jsValues.has(key);
    if (hasExcel && hasJs) {
      if (valuesEqual(excelValues.get(key), jsValues.get(key), tolerance)) equal++;
      else differingKeys.push(key);
    } else if (hasExcel) {
      noJsValueKeys.push(key);
    } else {
      noExcelValueKeys.push(key);
    }
  }

  return {
    equal,
    differing: differingKeys.length,
    noJsValue: noJsValueKeys.length,
    noExcelValue: noExcelValueKeys.length,
    differingKeys: differingKeys.sort(),
    noJsValueKeys: noJsValueKeys.sort(),
    noExcelValueKeys: noExcelValueKeys.sort(),
  };
}

// The file a "file # label # occurrence" key belongs to, for a per-file
// breakdown of the same score.
function keyFile(key) {
  return key.split(" # ")[0];
}

/**
 * The same score, broken down per source file, in the shape the plan's
 * per-file measurement table uses.
 */
export function scoreReportTreesByFile(excelValues, jsValues, tolerance = DEFAULT_TOLERANCE) {
  const byFile = new Map();
  const filesOf = (map) => new Set([...map.keys()].map(keyFile));
  const allFiles = [...new Set([...filesOf(excelValues), ...filesOf(jsValues)])].sort();

  for (const file of allFiles) {
    const excelSubset = new Map([...excelValues].filter(([k]) => keyFile(k) === file));
    const jsSubset = new Map([...jsValues].filter(([k]) => keyFile(k) === file));
    byFile.set(file, scoreReportTrees(excelSubset, jsSubset, tolerance));
  }

  return byFile;
}

function formatScoreTable(packageName, excelDir, jsDir, score, byFile) {
  const excelValues = score.equal + score.differing + score.noJsValue;
  const jsValues = score.equal + score.differing + score.noExcelValue;
  const lines = [
    `=== EQ1 scorecard: ${packageName} ===`,
    `Excel: ${excelDir}`,
    `JS:    ${jsDir}`,
    "",
    `Excel values: ${excelValues}  JS values: ${jsValues}  Equal: ${score.equal}  Differing: ${score.differing}  No JS value: ${score.noJsValue}  No Excel value: ${score.noExcelValue}`,
    "",
    "| File | Equal | Differing | No JS value | No Excel value |",
    "|------|------:|----------:|------------:|---------------:|",
  ];
  for (const [file, fileScore] of byFile) {
    lines.push(`| ${file} | ${fileScore.equal} | ${fileScore.differing} | ${fileScore.noJsValue} | ${fileScore.noExcelValue} |`);
  }
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const packageName = getArg("--package");
  const excelDir = getArg("--excel");
  const jsDir = getArg("--js");
  const budgetPath = getArg("--budget");
  const outPath = getArg("--out");
  const toleranceArg = getArg("--tolerance");

  if (!packageName || !excelDir || !jsDir) {
    console.error(
      "Usage: verify-roundtrip.js --package <name> --excel <dir> --js <dir> [--budget <file>] [--out <file>] [--tolerance <n>]",
    );
    process.exit(1);
  }

  return {
    packageName,
    excelDir,
    jsDir,
    budgetPath,
    outPath,
    tolerance: toleranceArg ? Number(toleranceArg) : DEFAULT_TOLERANCE,
  };
}

async function main() {
  const { packageName, excelDir, jsDir, budgetPath, outPath, tolerance } = parseArgs(process.argv);

  const excelValues = readReportTree(resolve(excelDir));
  const jsValues = readReportTree(resolve(jsDir));

  const score = scoreReportTrees(excelValues, jsValues, tolerance);
  const byFile = scoreReportTreesByFile(excelValues, jsValues, tolerance);

  console.log(formatScoreTable(packageName, excelDir, jsDir, score, byFile));

  const result = {
    package: packageName,
    excelDir,
    jsDir,
    counts: {
      equal: score.equal,
      differing: score.differing,
      noJsValue: score.noJsValue,
      noExcelValue: score.noExcelValue,
    },
    byFile: Object.fromEntries(
      [...byFile].map(([file, fileScore]) => [
        file,
        { equal: fileScore.equal, differing: fileScore.differing, noJsValue: fileScore.noJsValue, noExcelValue: fileScore.noExcelValue },
      ]),
    ),
  };

  if (outPath) {
    writeFileSync(resolve(outPath), JSON.stringify(result, null, 2) + "\n");
    console.log(`\nWritten: ${outPath}`);
  } else {
    console.log(`\n${JSON.stringify(result.counts)}`);
  }

  // The budget holds one entry per product with the counts CI must not let
  // rise, e.g. { "ltd": { "differing": 222, "noJsValue": 557 } }. Only the
  // keys a budget entry actually names are gated, so a track can add a
  // tighter bound (say "noExcelValue") without every other track's entry
  // needing to grow one.
  if (budgetPath) {
    if (!existsSync(budgetPath)) {
      console.error(`Budget file not found: ${budgetPath}`);
      process.exit(1);
    }
    const budget = JSON.parse(readFileSync(resolve(budgetPath), "utf8"));
    const entry = budget[packageName];
    if (!entry) {
      console.log(`\nNo budget entry for "${packageName}" in ${budgetPath}; skipping the gate.`);
    } else {
      const breaches = Object.entries(entry).filter(([metric, limit]) => score[metric] > limit);
      if (breaches.length > 0) {
        console.error(`\nBudget exceeded for "${packageName}":`);
        for (const [metric, limit] of breaches) {
          console.error(`  ${metric}: ${score[metric]} > ${limit}`);
        }
        process.exit(1);
      }
      console.log(`\nWithin budget for "${packageName}".`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
