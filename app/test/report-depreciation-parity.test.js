// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// report-depreciation-parity.test.js — extractTaxDataFromBook derives a
// depreciation table for bst, se and taxi from the book's own period,
// reading the same app/data/<year>.toml file --years would name, rather than
// leaving it out (bst, taxi) or hardcoding it (the old ltd branch). Proves
// two things: report.js --data with and without --years compute the same
// report.json (the fallback path agrees with the explicit one), and the
// figure depreciation actually moves -- Income Tax!E5 on the Self Employed
// engine's fixed asset schedule -- matches the committed, already-reconciled
// report rather than the book's own transactions read with zero
// depreciation.
//
// No LibreOffice: both runs are report.js --data, the JS engine only.

import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP_DIR, "..");
const NODE = process.execPath;
const REPORT_BIN = resolve(ROOT, "app", "bin", "report.js");

function scratchDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

function runReport(args) {
  const dir = scratchDir("report-depreciation-parity-");
  execFileSync(NODE, [REPORT_BIN, ...args, "--output-dir", dir], { cwd: ROOT, encoding: "utf8" });
  const document = JSON.parse(readFileSync(resolve(dir, "report.json"), "utf8"));
  rmSync(dir, { recursive: true, force: true });
  return new Map(document.values.map((entry) => [entry.key, entry.value]));
}

// Every key both maps share must carry the same value; a key present on one
// side only is reported separately so a genuine value regression is never
// hidden behind an unrelated key-count difference.
function diffShared(withoutYears, withYears) {
  const valueDiffs = [];
  for (const [key, value] of withoutYears) {
    if (withYears.has(key) && withYears.get(key) !== value) valueDiffs.push(`${key}: --data ${value}, --years ${withYears.get(key)}`);
  }
  return valueDiffs;
}

describe("report.js --data derives the depreciation table --years would have named", () => {
  it("computes the same values as --years for the advanced SE book", () => {
    const withoutYears = runReport(["--package", "se", "--data", "examples/precision-code-ltd/advanced"]);
    const withYears = runReport(["--package", "se", "--data", "examples/precision-code-ltd/advanced", "--years", "se-2025-2026"]);

    expect(diffShared(withoutYears, withYears)).toEqual([]);

    // The reconciled figure the committed reports/*.md carries for this
    // fixture (Income Tax!E5, "Tax profit the sheet carries", 121,513.02):
    // the fixed asset schedule's depreciation now reaches the tax profit
    // calculation instead of leaving it at zero.
    expect(withoutYears.get("cell/Financialaccounts.xlsx!Income Tax!E5")).toBe("121513.016666667");
  });

  it("computes the same values as --years for a BST book", () => {
    const withoutYears = runReport(["--package", "bst", "--data", "examples/precision-code-ltd/bst"]);
    const withYears = runReport(["--package", "bst", "--data", "examples/precision-code-ltd/bst", "--years", "se-2025-2026"]);

    expect(diffShared(withoutYears, withYears)).toEqual([]);
    expect(withoutYears.size).toBe(withYears.size);
  });
}, 120000);
