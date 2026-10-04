// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";

import { analyseCachedValues, refreshCachedValues, shiftFormula } from "../lib/cached-values.js";
import { generateSpreadsheet } from "../lib/generator.js";
import { buildSheetMap, loadSharedStrings, readCellValue } from "../lib/xlsx-parts.js";
import { applyCellWrites } from "../lib/spreadsheet-runner.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATE_JS = resolve(APP_DIR, "bin", "generate.js");

// ── A workbook small enough to read whole ────────────────────────────────

const WORKBOOK_RELS =
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
  "</Relationships>";

async function workbook({ admin, report, names = ["Admin", "Report"] }) {
  const zip = new JSZip();
  zip.file(
    "xl/workbook.xml",
    '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      `<sheet name="${names[0]}" sheetId="1" r:id="rId1"/><sheet name="${names[1]}" sheetId="2" r:id="rId2"/>` +
      '</sheets><calcPr calcId="191029"/></workbook>',
  );
  zip.file("xl/_rels/workbook.xml.rels", WORKBOOK_RELS);
  zip.file("xl/worksheets/sheet1.xml", `<worksheet><sheetData>${admin}</sheetData></worksheet>`);
  zip.file("xl/worksheets/sheet2.xml", `<worksheet><sheetData>${report}</sheetData></worksheet>`);
  return zip.generateAsync({ type: "uint8array" });
}

async function sheetText(bytes, path) {
  return (await JSZip.loadAsync(bytes)).file(path).async("string");
}

async function cell(bytes, sheetName, cellRef) {
  const zip = await JSZip.loadAsync(bytes);
  const path = (await buildSheetMap(zip)).get(sheetName);
  return readCellValue(await zip.file(path).async("string"), cellRef, await loadSharedStrings(zip));
}

describe("refreshing the cached values a write leaves behind", () => {
  it("brings every formula reading a written cell, directly or through another formula, up to date", async () => {
    const report = '<row r="1"><c r="A1"><f>Admin!A1+1</f><v>2026</v></c><c r="B1" t="str"><f>"Year "&amp;A1</f><v>Year 2026</v></c></row>';
    const before = await workbook({ admin: '<row r="1"><c r="A1"><v>2025</v></c></row>', report });
    const after = await workbook({ admin: '<row r="1"><c r="A1"><v>2026</v></c></row>', report });

    const { bytes, changed } = await analyseCachedValues(before, after);

    expect(changed.map((c) => `${c.sheet}!${c.cell}`)).toEqual(["Report!A1", "Report!B1"]);
    expect(await cell(bytes, "Report", "A1")).toBe(2027);
    expect(await cell(bytes, "Report", "B1")).toBe("Year 2027");
  });

  it("leaves a formula no write reaches as it was, even when its cached value disagrees with its inputs", async () => {
    const report = '<row r="1"><c r="A1"><f>Admin!A1*2</f><v>4</v></c><c r="C1"><f>Admin!B1*2</f><v>99</v></c></row>';
    const before = await workbook({ admin: '<row r="1"><c r="A1"><v>2</v></c><c r="B1"><v>1</v></c></row>', report });
    const after = await workbook({ admin: '<row r="1"><c r="A1"><v>3</v></c><c r="B1"><v>1</v></c></row>', report });

    const bytes = await refreshCachedValues(before, after);

    expect(await sheetText(bytes, "xl/worksheets/sheet2.xml")).toBe(
      '<worksheet><sheetData><row r="1"><c r="A1"><f>Admin!A1*2</f><v>6</v></c><c r="C1"><f>Admin!B1*2</f><v>99</v></c></row></sheetData></worksheet>',
    );
  });

  it("reads each follower of a shared formula relative to its own row", async () => {
    const admin = (middle) =>
      `<row r="2"><c r="A2"><v>1</v></c></row><row r="3"><c r="A3"><v>${middle}</v></c></row><row r="4"><c r="A4"><v>3</v></c></row>`;
    const report =
      '<row r="2"><c r="B2"><f t="shared" ref="B2:B4" si="0">Admin!A2*10</f><v>10</v></c></row>' +
      '<row r="3"><c r="B3"><f t="shared" si="0"/><v>20</v></c></row>' +
      '<row r="4"><c r="B4"><f t="shared" si="0"/><v>30</v></c></row>';

    const { bytes, changed } = await analyseCachedValues(
      await workbook({ admin: admin(2), report }),
      await workbook({ admin: admin(5), report }),
    );

    expect(changed.map((c) => c.cell)).toEqual(["B3"]);
    expect(await cell(bytes, "Report", "B3")).toBe(50);
  });

  it("keeps the cached value of a formula it cannot compute, and of every formula reading it, and reports both", async () => {
    const report =
      '<row r="1"><c r="A1"><f>IF(Admin!A1&gt;0,TODAY(),0)</f><v>45000</v></c><c r="B1"><f>A1+1</f><v>45001</v></c>' +
      '<c r="C1"><f>Admin!A1*2</f><v>2</v></c></row>';
    const before = await workbook({ admin: '<row r="1"><c r="A1"><v>1</v></c></row>', report });
    const after = await workbook({ admin: '<row r="1"><c r="A1"><v>2</v></c></row>', report });

    const { bytes, changed, unevaluated } = await analyseCachedValues(before, after);

    expect(changed.map((c) => c.cell)).toEqual(["C1"]);
    expect(unevaluated).toEqual([
      { sheet: "Report", cell: "A1", reason: "function TODAY", tainted: false },
      { sheet: "Report", cell: "B1", reason: "reads Report!A1", tainted: true },
    ]);
    expect(await cell(bytes, "Report", "A1")).toBe(45000);
    expect(await cell(bytes, "Report", "B1")).toBe(45001);
  });

  it("treats a formula rewritten only for a renamed sheet as unchanged", async () => {
    const admin = '<row r="1"><c r="A1"><v>7</v></c></row>';
    const before = await workbook({ admin, report: '<row r="1"><c r="A1"><f>Apr!A1</f><v>7</v></c></row>', names: ["Apr", "Report"] });
    const after = await workbook({ admin, report: '<row r="1"><c r="A1"><f>Oct!A1</f><v>7</v></c></row>', names: ["Oct", "Report"] });

    const { bytes, evaluated } = await analyseCachedValues(before, after);

    expect(evaluated).toBe(0);
    expect(bytes).toBe(after);
  });

  it("hands back the same bytes for a workbook nothing was written into", async () => {
    const bytes = await workbook({
      admin: '<row r="1"><c r="A1"><v>1</v></c></row>',
      report: '<row r="1"><c r="A1"><f>Admin!A1</f><v>1</v></c></row>',
    });
    expect(await refreshCachedValues(bytes, bytes)).toBe(bytes);
  });
});

describe("a shared formula's text read from another cell", () => {
  it("moves every reference without a $ and nothing inside a string", () => {
    expect(shiftFormula("IF((G6<>0),\"Enter A1\",'Profit & Loss'!$D4+SUM($A$1:B2))", 2, 1)).toBe(
      "IF((H8<>0),\"Enter A1\",'Profit & Loss'!$D6+SUM($A$1:C4))",
    );
    expect(shiftFormula("SUM(A:A)+B$2+[1]Admin!$B$5+[2]Mar!C7", 1, 1)).toBe("SUM(B:B)+C$2+[1]Admin!$B$5+[2]Mar!D8");
  });
});

describe("a cell written into a workbook", () => {
  it("replaces a cell that carries no attributes rather than adding a second one", async () => {
    const bytes = await workbook({
      admin: '<row r="1"><c r="A1"><v>1</v></c></row>',
      report: '<row r="1"><c r="A1"><f>Admin!A1</f><v>1</v></c></row>',
    });

    const written = await applyCellWrites(bytes, { Admin: { A1: 2 } });

    expect(await sheetText(written, "xl/worksheets/sheet1.xml")).toBe(
      '<worksheet><sheetData><row r="1"><c r="A1"><v>2</v></c></row></sheetData></worksheet>',
    );
    expect(await cell(written, "Report", "A1")).toBe(2);
  });
});

describe("a value written over the cell that holds a shared formula's text", () => {
  it("leaves every other cell of that formula computing, each with the formula for its own row", async () => {
    const admin = '<row r="1"><c r="A1"><v>1</v></c></row><row r="2"><c r="A2"><v>2</v></c></row><row r="3"><c r="A3"><v>3</v></c></row>';
    const report =
      '<row r="1"><c r="B1"><f t="shared" ref="B1:B3" si="0">Admin!A1*10</f><v>10</v></c></row>' +
      '<row r="2"><c r="B2"><f t="shared" si="0"/><v>20</v></c></row>' +
      '<row r="3"><c r="B3"><f t="shared" si="0"/><v>30</v></c></row>';
    const bytes = await workbook({ admin, report });

    const written = await applyCellWrites(bytes, { Report: { B1: 5 }, Admin: { A3: 4 } });

    expect(await sheetText(written, "xl/worksheets/sheet2.xml")).toBe(
      "<worksheet><sheetData>" +
        '<row r="1"><c r="B1"><v>5</v></c></row>' +
        '<row r="2"><c r="B2"><f>Admin!A2*10</f><v>20</v></c></row>' +
        '<row r="3"><c r="B3"><f>Admin!A3*10</f><v>40</v></c></row>' +
        "</sheetData></worksheet>",
    );
  });
});

// ── The headings a generated package opens on ───────────────────────────

const serial = (iso) => Math.round((Date.parse(iso) - Date.UTC(1899, 11, 30)) / 86400000);

// The cells each product's profit and loss heads its columns with, and what
// a package for the year named must cache in them.
const HEADINGS = [
  {
    product: "Basic Sole Trader",
    args: ["--package", "bst", "--years", "se-2026-2027"],
    workbook: "Financialaccountsto050427.xlsx",
    sheet: "Profit & Loss Acc",
    expected: { C2: "2026-27", D1: serial("2026-04-30"), O1: serial("2027-03-31") },
  },
  {
    product: "Self Employed",
    args: ["--package", "se", "--years", "se-2026-2027"],
    workbook: "Financialaccounts.xlsx",
    sheet: "Profit & Loss Account",
    expected: { B3: serial("2027-04-05"), C2: serial("2026-04-30"), N2: serial("2027-03-31") },
  },
  {
    product: "Company, March year end",
    args: ["--package", "ltd", "--years", "ltd-2026", "--year-end", "2027-03-31"],
    workbook: "Financialaccounts.xlsx",
    sheet: "MnthP&L",
    expected: { B2: serial("2027-03-31"), C1: serial("2026-04-30"), N1: serial("2027-03-31") },
  },
  {
    product: "Company, September year end",
    args: ["--package", "ltd", "--years", "ltd-2026", "--year-end", "2026-09-30"],
    workbook: "Financialaccounts.xlsx",
    sheet: "MnthP&L",
    expected: { B2: serial("2026-09-30"), C1: serial("2025-10-31"), N1: serial("2026-09-30") },
  },
];

// Every heading cell whose cached value is not the one expected.
async function headingMismatches(bytes, sheet, expected) {
  const mismatches = [];
  for (const [cellRef, value] of Object.entries(expected)) {
    const cached = await cell(bytes, sheet, cellRef);
    if (cached !== value) mismatches.push(`${sheet}!${cellRef} caches ${JSON.stringify(cached)}, not ${JSON.stringify(value)}`);
  }
  return mismatches;
}

describe("a generated package caches the year it was generated for", () => {
  let workDir;
  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), "cached-values-"));
  });
  afterAll(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  for (const { product, args, workbook: name, sheet, expected } of HEADINGS) {
    it(`${product}: ${sheet} heads its columns with the package's own year`, async () => {
      const outDir = join(workDir, product.replace(/\W+/g, "_"));
      execFileSync(process.execPath, [GENERATE_JS, ...args, "--skip-guide", "--output-dir", outDir], { stdio: "pipe" });
      const [packageDir] = readdirSync(outDir);
      const bytes = readFileSync(join(outDir, packageDir, name));

      expect(await headingMismatches(bytes, sheet, expected)).toEqual([]);
    }, 300000);
  }

  it("names the heading whose formula reads the wrong cell", async () => {
    const meta = parseTOML(readFileSync(resolve(APP_DIR, "templates/bst/meta.toml"), "utf8"));
    const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data/se-2026-2027.toml"), "utf8"));
    const template = await JSZip.loadAsync(readFileSync(resolve(APP_DIR, "templates/bst", meta.template.spreadsheet)));
    const path = (await buildSheetMap(template)).get("Profit & Loss Acc");
    const xml = await template.file(path).async("string");
    const corrupted = xml.replace('<c r="C2" s="262" t="str"><f>Admin!G2</f>', '<c r="C2" s="262" t="str"><f>Admin!G3</f>');
    expect(corrupted).not.toBe(xml);
    template.file(path, corrupted);
    const corruptedTemplate = await template.generateAsync({ type: "uint8array" });

    const generated = await generateSpreadsheet(corruptedTemplate, taxData, meta.sheets);

    const mismatches = await headingMismatches(generated, "Profit & Loss Acc", HEADINGS[0].expected);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatch(/^Profit & Loss Acc!C2 caches /);
  }, 120000);
});

// ── No generated workbook caches a value its formulas do not produce ────

// Every formula's cached value a workbook holds that the evaluator does not
// reproduce. A formula the evaluator cannot read (TODAY()) keeps its cache and
// is not counted.
async function staleCaches(bytes) {
  const { changed } = await analyseCachedValues(null, bytes);
  return changed.map(
    ({ sheet, cell: ref, from, to }) => `${sheet}!${ref} caches ${JSON.stringify(from)}, formula gives ${JSON.stringify(to)}`,
  );
}

describe("a generated package caches only values its formulas produce", () => {
  let workDir;
  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), "cached-values-stale-"));
  });
  afterAll(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  for (const [product, args] of [
    ["Basic Sole Trader", ["--package", "bst", "--years", "se-2026-2027"]],
    ["Self Employed", ["--package", "se", "--years", "se-2026-2027"]],
    ["Company, March year end", ["--package", "ltd", "--years", "ltd-2026", "--year-end", "2027-03-31"]],
    ["Company, September year end", ["--package", "ltd", "--years", "ltd-2026", "--year-end", "2026-09-30"]],
  ]) {
    it(`${product}: no workbook of the package caches a stale value`, async () => {
      const outDir = join(workDir, product.replace(/\W+/g, "_"));
      execFileSync(process.execPath, [GENERATE_JS, ...args, "--skip-guide", "--output-dir", outDir], { stdio: "pipe" });
      const [packageDir] = readdirSync(outDir);
      const stale = [];
      for (const name of readdirSync(join(outDir, packageDir)).filter((file) => file.endsWith(".xlsx"))) {
        for (const line of await staleCaches(readFileSync(join(outDir, packageDir, name)))) stale.push(`${name}: ${line}`);
      }
      expect(stale).toEqual([]);
    }, 600000);
  }

  it("names the cell whose cached value was changed after generation", async () => {
    const meta = parseTOML(readFileSync(resolve(APP_DIR, "templates/bst/meta.toml"), "utf8"));
    const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data/se-2026-2027.toml"), "utf8"));
    const template = readFileSync(resolve(APP_DIR, "templates/bst", meta.template.spreadsheet));
    const generated = await generateSpreadsheet(template, taxData, meta.sheets);
    expect(await staleCaches(generated)).toEqual([]);

    const zip = await JSZip.loadAsync(generated);
    const path = (await buildSheetMap(zip)).get("Profit & Loss Acc");
    const xml = await zip.file(path).async("string");
    const corrupted = xml.replace(/(<c r="C2"[^>]*><f>[^<]*<\/f><v>)[^<]*(<\/v>)/, "$1corrupted$2");
    expect(corrupted).not.toBe(xml);
    zip.file(path, corrupted);

    const stale = await staleCaches(await zip.generateAsync({ type: "uint8array" }));
    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatch(/^Profit & Loss Acc!C2 caches "corrupted"/);
  }, 120000);
});
