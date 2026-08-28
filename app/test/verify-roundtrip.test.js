// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// Double-roundtrip fidelity test: diya-gl → Excel → export → Excel → export → compare.
// The first roundtrip normalises data to what each spreadsheet can store.
// The second roundtrip must produce identical output (lossless).
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { hasLibreOffice } from "../lib/spreadsheet-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const NODE = process.execPath;

// A multi-file generate drives roughly thirty LibreOffice conversions, and macOS
// LibreOffice runs several times slower than the Linux build CI uses. Give each
// child the whole test budget so a slow host reports a fidelity diff rather than
// killing the generate before anything is compared.
const STEP_TIMEOUT_MS = 900_000;

function run(args) {
  return execFileSync(NODE, args, { cwd: ROOT, encoding: "utf8", timeout: STEP_TIMEOUT_MS });
}

function readLines(dir) {
  const content = readFileSync(resolve(dir, "lines.jsonl"), "utf8");
  return content
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

const PRODUCTS = [
  {
    name: "bst",
    data: "examples/precision-code-ltd/bst",
    years: "se-2025-2026",
    yearEnd: "2026-04-05",
  },
  {
    name: "se",
    data: "examples/precision-code-ltd/advanced",
    years: "se-2025-2026",
    yearEnd: "2026-04-05",
  },
  {
    name: "ltd",
    data: "examples/precision-code-ltd/full",
    years: "ltd-2025",
    yearEnd: "2026-03-31",
  },
  {
    // A non-March year-end exercises the tab-rename and formula-rewrite path
    // (getMonthTabSequence, renameMonthTabs, renameExternalLinkSheetNames,
    // rewriteVatinterfaceFormulas) that the March-only run above never
    // touches, since March is the template's native tab order. label is
    // distinct from the CLI --package value (still "ltd") so it gets its own
    // target/ directories instead of colliding with the March run's.
    name: "ltd",
    label: "ltd-may",
    data: "examples/precision-code-ltd/full",
    years: "ltd-2025",
    // ltd-2025's financial_year runs 2025-04-01..2026-03-31, so the year-end
    // must be a month-end inside that window.
    yearEnd: "2025-05-31",
    // Known-broken: pass 1's export rolls the calendar year backwards for
    // postings dated after this year-end (e.g. a line dated 2026-05-31 is
    // followed by one dated 2025-06-01 instead of 2026-06-01), and pass 2
    // then "corrects" the dates back onto the true calendar -- the two
    // passes disagree because pass 1 is wrong, not because pass 2 is lossy.
    // Reproducible locally by running this product's two generate+export
    // passes and diffing lines.jsonl. Confirmed to be a real defect in the
    // export/generate date arithmetic for non-March year-ends, not a
    // test-setup issue -- out of scope for this file (it only adds year-end
    // coverage to the roundtrip check). Left as an expected failure so the
    // regression stays visible without breaking CI; it starts failing loudly
    // (an unexpected pass) once the underlying date bug is fixed, which is
    // the cue to drop knownBroken.
    knownBroken: true,
  },
];

describe.skipIf(!hasLibreOffice())("Double-roundtrip fidelity", () => {
  for (const product of PRODUCTS) {
    const label = product.label || product.name;
    const test = product.knownBroken ? it.fails : it;
    test(`${label}: pass 2 export equals pass 1 export`, { timeout: STEP_TIMEOUT_MS }, () => {
      const pkg1 = resolve(ROOT, "target", `${label}-rt-pkg1`);
      const data1 = resolve(ROOT, "target", `${label}-rt-data1`);
      const pkg2 = resolve(ROOT, "target", `${label}-rt-pkg2`);
      const data2 = resolve(ROOT, "target", `${label}-rt-data2`);

      // Pass 1: original diya-gl → Excel → export
      run([
        "app/bin/generate.js",
        "--package",
        product.name,
        "--years",
        product.years,
        "--year-end",
        product.yearEnd,
        "--data",
        product.data,
        "--output-dir",
        pkg1,
        "--skip-guide",
      ]);
      run(["app/bin/export.js", "--package", product.name, "--source-dir", pkg1, "--output-dir", data1]);

      const lines1 = readLines(data1);
      expect(lines1.length).toBeGreaterThan(0);

      // Pass 2: exported diya-gl → Excel → export
      run([
        "app/bin/generate.js",
        "--package",
        product.name,
        "--years",
        product.years,
        "--year-end",
        product.yearEnd,
        "--data",
        data1,
        "--output-dir",
        pkg2,
        "--skip-guide",
      ]);
      run(["app/bin/export.js", "--package", product.name, "--source-dir", pkg2, "--output-dir", data2]);

      const lines2 = readLines(data2);

      // Compare line by line
      expect(lines2.length).toBe(lines1.length);
      for (let i = 0; i < lines1.length; i++) {
        expect(lines2[i], `Line ${i} mismatch`).toEqual(lines1[i]);
      }

      // Also compare book.toml
      const book1 = readFileSync(resolve(data1, "book.toml"), "utf8");
      const book2 = readFileSync(resolve(data2, "book.toml"), "utf8");
      expect(book2).toBe(book1);
    });
  }
});
