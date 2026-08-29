// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// Double-roundtrip fidelity test: diya-gl → Excel → export → Excel → export → compare.
// The first roundtrip normalises data to what each spreadsheet can store.
// The second roundtrip must produce identical output (lossless).
//
// Requires: LibreOffice installed (brew install --cask libreoffice)

import { describe, it, expect, afterEach } from "vitest";
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
  },
];

describe.skipIf(!hasLibreOffice())("Double-roundtrip fidelity", () => {
  for (const product of PRODUCTS) {
    const label = product.label || product.name;
    it(`${label}: pass 2 export equals pass 1 export`, { timeout: STEP_TIMEOUT_MS }, () => {
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

// ── EQ1 scorecard: app/bin/verify-roundtrip.js ─────────────────────────────
//
// Score EQ1 (report equivalence) between an Excel-side report tree and a
// JS-side report tree, both written by report.js. Parses "file # row label
// # occurrence" keys out of the markdown and compares the values at each,
// rather than counting diff -r lines.

import { parseReportFile, readReportTree, valuesEqual, scoreReportTrees, scoreReportTreesByFile } from "../bin/verify-roundtrip.js";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("parseReportFile", () => {
  it("reads a plain label/amount table", () => {
    const content = ["# Profit & Loss", "", "| | Amount |", "|---|------:|", "| Sales Turnover | 150,000 |", "| Cost of Sales | 50,000 |", ""].join(
      "\n",
    );
    expect(parseReportFile("profit-loss.md", content)).toEqual([
      { label: "Sales Turnover", value: "150,000" },
      { label: "Cost of Sales", value: "50,000" },
    ]);
  });

  it("strips indentation markers and bold markup from the label and value", () => {
    const content = [
      "# P&L",
      "",
      "| | Amount |",
      "|---|------:|",
      "| &nbsp;&nbsp;&nbsp;&nbsp;Repairs | 1,200 |",
      "| **Net Profit** | **99,000** |",
      "",
    ].join("\n");
    expect(parseReportFile("profit-loss.md", content)).toEqual([
      { label: "Repairs", value: "1,200" },
      { label: "Net Profit", value: "99,000" },
    ]);
  });

  it("skips a blank spacer row", () => {
    const content = ["# P&L", "", "| | Amount |", "|---|------:|", "| | |", "| Sales | 10 |", ""].join("\n");
    expect(parseReportFile("profit-loss.md", content)).toEqual([{ label: "Sales", value: "10" }]);
  });

  it("takes the last column as the value in a table with more than two columns", () => {
    const content = [
      "# Accounting profit to tax profit bridge",
      "",
      "| Line | Cell | Amount |",
      "|------|------|-------:|",
      "| Net profit | Profit & Loss Acc!C24 | 31,812 |",
      "| **Residue** | | **0** |",
      "",
    ].join("\n");
    expect(parseReportFile("accounting-profit-to-tax-profit-bridge.md", content)).toEqual([
      { label: "Net profit Profit & Loss Acc!C24", value: "31,812" },
      { label: "Residue", value: "0" },
    ]);
  });

  it("keys cell-values.md rows by sheet heading and cell reference", () => {
    const content = [
      "# Cell Values",
      "",
      "## Profit & Loss Acc",
      "",
      "| Cell | DIY Label | Value | diya-gl mapping |",
      "|------|-----------|-------|-----------------|",
      "| C4 | Sales Turnover | 150000 | gl-cor:amount (salesTurnover) |",
      "",
      "## Income Tax",
      "",
      "| Cell | DIY Label | Value | diya-gl mapping |",
      "|------|-----------|-------|-----------------|",
      "| C4 | Some Other Cell | 42 | |",
      "",
    ].join("\n");
    expect(parseReportFile("cell-values.md", content)).toEqual([
      { label: "Profit & Loss Acc!C4", value: "150000" },
      { label: "Income Tax!C4", value: "42" },
    ]);
  });

  it("reads the Actual column of compliance-checks.md, not the Result column", () => {
    const content = [
      "# Compliance Checks",
      "",
      "| Check | Expected | Actual | Diff | Result |",
      "|-------|----------|--------|------|--------|",
      "| Total Sales | 100 | 100 | 0 | PASS |",
      "| Gross Profit | 50 | 45 | -5 | **FAIL** |",
      "",
    ].join("\n");
    expect(parseReportFile("compliance-checks.md", content)).toEqual([
      { label: "Total Sales", value: "100" },
      { label: "Gross Profit", value: "45" },
    ]);
  });
});

describe("readReportTree", () => {
  let dir;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("keys a repeated label within one file by occurrence", () => {
    dir = mkdtempSync(join(tmpdir(), "verify-roundtrip-test-"));
    writeFileSync(join(dir, "profit-loss.md"), ["# P&L", "", "| | Amount |", "|---|------:|", "| Total | 10 |", "| Total | 20 |", ""].join("\n"));

    const values = readReportTree(dir);
    expect(values.get("profit-loss.md # Total # 0")).toBe("10");
    expect(values.get("profit-loss.md # Total # 1")).toBe("20");
  });

  it("keeps two files' rows separate even with the same label", () => {
    dir = mkdtempSync(join(tmpdir(), "verify-roundtrip-test-"));
    writeFileSync(join(dir, "a.md"), ["| | Amount |", "|---|------:|", "| Total | 10 |", ""].join("\n"));
    writeFileSync(join(dir, "b.md"), ["| | Amount |", "|---|------:|", "| Total | 20 |", ""].join("\n"));

    const values = readReportTree(dir);
    expect(values.get("a.md # Total # 0")).toBe("10");
    expect(values.get("b.md # Total # 0")).toBe("20");
  });
});

describe("valuesEqual", () => {
  it("treats comma-grouped and plain numbers the same within tolerance", () => {
    expect(valuesEqual("150,000", "150000")).toBe(true);
    expect(valuesEqual("150,000.00", "149999.996")).toBe(true);
  });

  it("fails outside the tolerance", () => {
    expect(valuesEqual("150,000", "150001")).toBe(false);
  });

  it("compares non-numeric values as text", () => {
    expect(valuesEqual("Precision Code Ltd", "Precision Code Ltd")).toBe(true);
    expect(valuesEqual("Precision Code Ltd", "Precision Code Trading")).toBe(false);
  });

  it("treats a missing-value dash the same on both sides as equal", () => {
    expect(valuesEqual("—", "—")).toBe(true);
  });

  it("a dash against a real number is a difference, not a missing value", () => {
    expect(valuesEqual("—", "100")).toBe(false);
  });

  it("honours a custom tolerance", () => {
    expect(valuesEqual("100", "100.5", 1)).toBe(true);
    expect(valuesEqual("100", "100.5", 0.1)).toBe(false);
  });
});

describe("scoreReportTrees", () => {
  it("counts equal, differing, no JS value and no Excel value", () => {
    const excel = new Map([
      ["f.md # A # 0", "100"],
      ["f.md # B # 0", "200"],
      ["f.md # C # 0", "300"],
    ]);
    const js = new Map([
      ["f.md # A # 0", "100"],
      ["f.md # B # 0", "999"],
      ["f.md # D # 0", "400"],
    ]);
    const score = scoreReportTrees(excel, js);
    expect(score.equal).toBe(1);
    expect(score.differing).toBe(1);
    expect(score.differingKeys).toEqual(["f.md # B # 0"]);
    expect(score.noJsValue).toBe(1);
    expect(score.noJsValueKeys).toEqual(["f.md # C # 0"]);
    expect(score.noExcelValue).toBe(1);
    expect(score.noExcelValueKeys).toEqual(["f.md # D # 0"]);
  });

  it("scores two empty trees as nothing", () => {
    const score = scoreReportTrees(new Map(), new Map());
    expect(score).toMatchObject({ equal: 0, differing: 0, noJsValue: 0, noExcelValue: 0 });
  });

  // Every check here has to be provably breakable: corrupt exactly one value
  // on the JS side and confirm exactly that key, and no other, flips from
  // equal to differing.
  it("flips exactly one key when exactly one value is corrupted", () => {
    const excel = new Map([
      ["f.md # A # 0", "100"],
      ["f.md # B # 0", "200"],
      ["f.md # C # 0", "300"],
    ]);
    const js = new Map(excel);
    const before = scoreReportTrees(excel, js);
    expect(before.differing).toBe(0);

    const corrupted = new Map(js);
    corrupted.set("f.md # B # 0", "201");
    const after = scoreReportTrees(excel, corrupted);
    expect(after.differing).toBe(1);
    expect(after.differingKeys).toEqual(["f.md # B # 0"]);
    expect(after.equal).toBe(before.equal - 1);
  });
});

describe("scoreReportTreesByFile", () => {
  it("groups the same score per source file", () => {
    const excel = new Map([
      ["a.md # X # 0", "1"],
      ["b.md # Y # 0", "2"],
    ]);
    const js = new Map([
      ["a.md # X # 0", "1"],
      ["b.md # Y # 0", "3"],
    ]);
    const byFile = scoreReportTreesByFile(excel, js);
    expect(byFile.get("a.md")).toMatchObject({ equal: 1, differing: 0 });
    expect(byFile.get("b.md")).toMatchObject({ equal: 0, differing: 1 });
  });
});
