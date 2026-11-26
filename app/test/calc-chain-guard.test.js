// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// Excel repairs a workbook whose calc chain names a cell without a formula:
// it says "We found a problem with some content", removes the record, opens
// the file as "<name> - Repaired" and forces Save As. This guard reads every
// template, every committed package workbook and a freshly generated package
// of each product that carries a calc chain, and fails on any calc chain
// entry without its formula, and on a calc chain part, relationship or
// content type override present without the others.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import JSZip from "jszip";
import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import { CALC_CHAIN_PART, calcChainProblems, removeCalcChain, removeStaleCalcChainEntries } from "../lib/calc-chain.js";
import { buildSheetMap } from "../lib/xlsx-parts.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATES_DIR = join(ROOT, "app", "templates");
const PACKAGES_DIR = join(ROOT, "packages");
const GENERATE_JS = join(ROOT, "app", "bin", "generate.js");

function workbooksUnder(dir, skip = () => false) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !skip(join(dir, entry.name)))
    .map((entry) => entry.name)
    .sort()
    .flatMap((name) =>
      readdirSync(join(dir, name))
        .filter((file) => file.endsWith(".xlsx"))
        .sort()
        .map((file) => ({ label: `${name}/${file}`, path: join(dir, name, file) })),
    );
}

async function problemsOf(path) {
  return calcChainProblems(await JSZip.loadAsync(readFileSync(path)));
}

describe("every template workbook", () => {
  const templates = workbooksUnder(TEMPLATES_DIR);

  it("is found", () => {
    expect(templates.length).toBeGreaterThan(0);
  });

  for (const { label, path } of templates) {
    it(`${label} has a calc chain that names only formula cells`, async () => {
      expect(await problemsOf(path)).toEqual([]);
    });
  }
});

describe("every committed package workbook", () => {
  const packages = workbooksUnder(PACKAGES_DIR, (dir) => existsSync(join(dir, "DO NOT USE - WORK IN PROGRESS.txt")));

  for (const { label, path } of packages) {
    it(`${label} has a calc chain that names only formula cells`, async () => {
      expect(await problemsOf(path)).toEqual([]);
    });
  }
});

// The year end is not March, so the Company package goes through the tab
// rename and the link rewrites as well as the template copy.
const GENERATED = [
  { product: "Company, June year end", args: ["--package", "ltd", "--years", "ltd-2027", "--year-end", "2027-06-30"] },
  { product: "Self Employed", args: ["--package", "se", "--years", "se-2026-2027"] },
  { product: "Taxi Driver", args: ["--package", "taxi", "--years", "se-2026-2027"] },
];

describe("a freshly generated package", () => {
  let workDir;
  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), "calc-chain-guard-"));
  });
  afterAll(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  for (const { product, args } of GENERATED) {
    it(`${product}: every workbook has a calc chain that names only formula cells`, async () => {
      const outDir = join(workDir, product.replace(/\W+/g, "_"));
      execFileSync(process.execPath, [GENERATE_JS, ...args, "--skip-guide", "--output-dir", outDir], { stdio: "pipe" });
      const workbooks = workbooksUnder(outDir);
      expect(workbooks.length).toBeGreaterThan(0);

      const problems = [];
      for (const { label, path } of workbooks) {
        for (const problem of await problemsOf(path)) problems.push(`${label}: ${problem}`);
      }
      expect(problems).toEqual([]);
    }, 300000);
  }
});

// ── The guard can fail ──────────────────────────────────────────────────

const PURCHASES = join(TEMPLATES_DIR, "ltd", "Purchases.xlsx");

async function purchasesTemplate() {
  return JSZip.loadAsync(readFileSync(PURCHASES));
}

// Replace a cell with an empty cell of the same style, which is how a
// template edit that deletes a formula leaves it.
async function dropFormula(zip, sheetName, ref) {
  const path = (await buildSheetMap(zip)).get(sheetName);
  const xml = await zip.file(path).async("string");
  const cell = new RegExp(`<c r="${ref}"([^>]*?)>[\\s\\S]*?</c>`);
  const match = xml.match(cell);
  if (!match || !match[0].includes("<f")) throw new Error(`${sheetName}!${ref} carries no formula to drop`);
  zip.file(path, xml.replace(cell, `<c r="${ref}"${match[1].replace(/\st="[^"]*"/, "")}/>`));
}

describe("calcChainProblems", () => {
  it("names a calc chain entry whose formula a template edit deleted", async () => {
    const zip = await purchasesTemplate();
    await dropFormula(zip, "OpeningCreditors", "G200");

    expect(await calcChainProblems(zip)).toEqual(["calcChain entry OpeningCreditors!G200 names a cell with no formula"]);
  });

  it("names a calc chain entry for a sheet the workbook does not have", async () => {
    const zip = await purchasesTemplate();
    const xml = await zip.file(CALC_CHAIN_PART).async("string");
    zip.file(CALC_CHAIN_PART, xml.replace("</calcChain>", '<c r="A1" i="99"/></calcChain>'));

    expect(await calcChainProblems(zip)).toEqual(["calcChain entry A1 names sheetId 99, which the workbook does not have"]);
  });

  it("names the relationship and the override a removed calc chain part leaves behind", async () => {
    const zip = await purchasesTemplate();
    zip.remove(CALC_CHAIN_PART);

    expect(await calcChainProblems(zip)).toEqual([
      "xl/_rels/workbook.xml.rels names a calcChain part the package does not hold",
      "[Content_Types].xml declares a calcChain part the package does not hold",
    ]);
  });
});

describe("removeCalcChain", () => {
  it("removes the part, its relationship and its content type override", async () => {
    const zip = await purchasesTemplate();
    await removeCalcChain(zip);

    expect(zip.file(CALC_CHAIN_PART)).toBeNull();
    expect(await zip.file("xl/_rels/workbook.xml.rels").async("string")).not.toContain("calcChain");
    expect(await zip.file("[Content_Types].xml").async("string")).not.toContain("calcChain");
    expect(await calcChainProblems(zip)).toEqual([]);
  });
});

describe("removeStaleCalcChainEntries", () => {
  it("leaves a clean calc chain alone", async () => {
    const zip = await purchasesTemplate();
    const before = await zip.file(CALC_CHAIN_PART).async("string");

    expect(await removeStaleCalcChainEntries(zip)).toBe(0);
    expect(await zip.file(CALC_CHAIN_PART).async("string")).toBe(before);
  });

  it("passes a removed entry's sheet and level to the next entry, which carried neither", async () => {
    const zip = await purchasesTemplate();
    const before = await zip.file(CALC_CHAIN_PART).async("string");
    // The first month tab's chain opens <c r="H5" i="4" l="1"/><c r="H6" i="4"/>.
    expect(before).toContain('<c r="H5" i="4" l="1"/><c r="H6" i="4"/>');
    const firstMonth = [...(await buildSheetMap(zip)).keys()][1];
    await dropFormula(zip, firstMonth, "H5");
    const withoutH6Sheet = before.replace('<c r="H6" i="4"/>', '<c r="H6"/>');
    zip.file(CALC_CHAIN_PART, withoutH6Sheet);

    expect(await removeStaleCalcChainEntries(zip)).toBe(1);
    const after = await zip.file(CALC_CHAIN_PART).async("string");
    expect(after).toContain('<c r="C1" i="16" l="1"/><c r="H6" i="4" l="1"/><c r="H7" i="4"/>');
    expect(await calcChainProblems(zip)).toEqual([]);
  });
});
