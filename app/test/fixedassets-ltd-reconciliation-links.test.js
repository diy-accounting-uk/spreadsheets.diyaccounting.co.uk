// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// fixedassets-ltd-reconciliation-links.test.js — Proves the Ltd
// Fixedassets.xlsx FAreconciliation sheet reads the two ledgers instead of
// #REF!: the template carries the three external links its formulas address,
// and every generated package's copy points at that package's own final month
// tab, where the year's fixed asset total actually sits. The generated files
// are the ones that matter here — the reconciliation runner refreshes link
// caches before it recalculates, so a green reconciliation says nothing about
// what the customer downloads. Pure JSZip reads plus one generate.js run; no
// LibreOffice needed.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import JSZip from "jszip";
import { execFileSync } from "child_process";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "fs";
import { resolve, dirname, join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { buildSheetMap } from "../lib/spreadsheet-runner.js";
import { generateSpreadsheet } from "../lib/generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const ROOT = resolve(APP_DIR, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");

// The column each ledger analyses its fixed asset lines into, and the row
// that sums the twelve months of it.
const PURCHASES_ASSET_CELL = "AI2";
const SALES_ASSET_CELL = "U2";
const MONTH_TOTAL_ROW = 1;

async function loadTemplate(name) {
  return JSZip.loadAsync(readFileSync(resolve(LTD_DIR, name)));
}

async function part(zip, path) {
  const file = zip.file(path);
  expect(file, path).toBeTruthy();
  return file.async("string");
}

// The [N] a formula uses is the position of the <externalReference> in
// workbook.xml, so this returns the target workbook for [1], [2], [3] in that
// order.
async function linkTargets(zip) {
  const wbXml = await part(zip, "xl/workbook.xml");
  const relsXml = await part(zip, "xl/_rels/workbook.xml.rels");
  const ridToTarget = new Map([...relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]*)"/g)].map((m) => [m[1], m[2]]));

  const block = wbXml.match(/<externalReferences>([\s\S]*?)<\/externalReferences>/);
  expect(block).toBeTruthy();

  const targets = [];
  for (const [, rid] of block[1].matchAll(/<externalReference[^>]*r:id="(rId\d+)"/g)) {
    const linkPath = `xl/${ridToTarget.get(rid)}`;
    const linkNumber = linkPath.match(/externalLink(\d+)\.xml$/)[1];
    const linkRels = await part(zip, `xl/externalLinks/_rels/externalLink${linkNumber}.xml.rels`);
    const relative = [...linkRels.matchAll(/Target="([^"]+)"/g)].map((m) => m[1]).find((t) => !t.includes("/"));
    targets.push({ linkPath, target: relative });
  }
  return targets;
}

function formulaAt(xml, cellRef) {
  const match = xml.match(new RegExp(`<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<f[^>]*>([^<]*)</f>`, "s"));
  return match ? match[1] : null;
}

function cellOpenTag(xml, cellRef) {
  const match = xml.match(new RegExp(`<c r="${cellRef}"[^>]*?>`, "s"));
  return match ? match[0] : null;
}

async function everyXmlPart(zip) {
  const parts = {};
  for (const path of Object.keys(zip.files).filter((f) => f.endsWith(".xml") || f.endsWith(".rels"))) {
    parts[path] = await zip.file(path).async("string");
  }
  return parts;
}

// The month tabs a ledger workbook carries, in workbook order. Its year total
// sits on the last of them whatever the year end.
async function monthTabs(zip) {
  const sheetMap = await buildSheetMap(zip);
  const names = [...sheetMap.keys()];
  return names.slice(1, -1);
}

describe("Ltd Fixedassets.xlsx template: the FAreconciliation ledger links", () => {
  let zip;
  let sheetXml;

  beforeAll(async () => {
    zip = await loadTemplate("Fixedassets.xlsx");
    const sheetMap = await buildSheetMap(zip);
    sheetXml = await zip.file(sheetMap.get("FAreconciliation")).async("string");
  });

  it("addresses the accounts hub, the purchase ledger and the sales ledger as links 1, 2 and 3", async () => {
    expect(await linkTargets(zip)).toEqual([
      { linkPath: "xl/externalLinks/externalLink1.xml", target: "Financialaccounts.xlsx" },
      { linkPath: "xl/externalLinks/externalLink2.xml", target: "Purchases.xlsx" },
      { linkPath: "xl/externalLinks/externalLink3.xml", target: "Sales.xlsx" },
    ]);
  });

  it("declares a content type for each of the three links", async () => {
    const contentTypes = await part(zip, "[Content_Types].xml");
    for (const n of [1, 2, 3]) {
      expect(contentTypes, `externalLink${n}`).toContain(`PartName="/xl/externalLinks/externalLink${n}.xml"`);
    }
  });

  it("reads each ledger's fixed asset total and subtracts the schedule's own", () => {
    expect(formulaAt(sheetXml, "E13")).toBe("[2]Mar!$AI$2");
    expect(formulaAt(sheetXml, "K13")).toBe("[3]Mar!$U$2");
    expect(formulaAt(sheetXml, "E15")).toBe("E13-E11");
    expect(formulaAt(sheetXml, "K15")).toBe("K13-K11");
  });

  it("caches a number on the two ledger reads and their differences, and the sentence on the verdicts", () => {
    for (const cellRef of ["E13", "K13", "E15", "K15"]) {
      expect(cellOpenTag(sheetXml, cellRef), cellRef).not.toContain('t="e"');
      expect(cellOpenTag(sheetXml, cellRef), cellRef).not.toContain("t=");
    }
    for (const cellRef of ["B15", "G15"]) {
      expect(cellOpenTag(sheetXml, cellRef), cellRef).toContain('t="str"');
    }
    expect(sheetXml).toContain("<v>Purchases reconcile with Fixed asset Schedule</v>");
    expect(sheetXml).toContain("<v>Sales reconcile with Fixed asset Schedule</v>");
  });

  it("carries no #REF! in any part of the workbook", async () => {
    for (const [path, xml] of Object.entries(await everyXmlPart(zip))) {
      expect(xml, path).not.toContain("#REF!");
    }
  });

  it.each([
    ["Purchases.xlsx", PURCHASES_ASSET_CELL],
    ["Sales.xlsx", SALES_ASSET_CELL],
  ])("%s holds the year's fixed asset total at %s, summed from all twelve months", async (fileName, totalCell) => {
    const ledger = await loadTemplate(fileName);
    const tabs = await monthTabs(ledger);
    expect(tabs).toHaveLength(12);

    const sheetMap = await buildSheetMap(ledger);
    const lastMonthXml = await ledger.file(sheetMap.get(tabs[11])).async("string");
    const formula = formulaAt(lastMonthXml, totalCell);
    const column = totalCell.replace(/\d+$/, "");
    for (const tab of tabs) {
      expect(formula, tab).toContain(`${tab}!${column}${MONTH_TOTAL_ROW}`);
    }
  });

  it("keeps the accounts hub on link 1, which the Admin date roll refuses to work without", async () => {
    const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data", "ltd-2025.toml"), "utf8"));
    const sheetsConfig = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8")).sheets.fixedassets;
    expect(sheetsConfig.adminExternalLink).toBe("xl/externalLinks/externalLink1.xml");

    const template = readFileSync(resolve(LTD_DIR, "Fixedassets.xlsx"));
    await expect(generateSpreadsheet(template, taxData, sheetsConfig)).resolves.toBeInstanceOf(Buffer);

    // The same generation against a workbook whose link 1 has been swapped
    // for the purchase ledger, which is what renumbering the links would do.
    const misTargeted = await JSZip.loadAsync(template);
    const relsPath = "xl/externalLinks/_rels/externalLink1.xml.rels";
    const rels = (await misTargeted.file(relsPath).async("string")).replace(/Financialaccounts\.xlsx/g, "Purchases.xlsx");
    misTargeted.file(relsPath, rels);
    const swapped = await misTargeted.generateAsync({ type: "nodebuffer" });

    await expect(generateSpreadsheet(swapped, taxData, sheetsConfig)).rejects.toThrow(/does not target Financialaccounts\.xlsx/);
  });
});

describe("Ltd generated packages: the FAreconciliation links follow the year end", () => {
  let outDir;
  let packageDirs;

  beforeAll(() => {
    outDir = mkdtempSync(join(tmpdir(), "ltd-fa-links-"));
    execFileSync(
      process.execPath,
      [resolve(APP_DIR, "bin", "generate.js"), "--package", "ltd", "--years", "ltd-2025", "--skip-guide", "--output-dir", outDir],
      {
        cwd: ROOT,
        encoding: "utf8",
      },
    );
    packageDirs = readdirSync(outDir);
    expect(packageDirs).toHaveLength(12);
  }, 300000);

  afterAll(() => {
    if (outDir) rmSync(outDir, { recursive: true, force: true });
  });

  it("names each package's own final month tab, where its ledgers keep the year total", async () => {
    for (const dirName of packageDirs) {
      const fixedAssets = await JSZip.loadAsync(readFileSync(resolve(outDir, dirName, "Fixedassets.xlsx")));
      const sheetMap = await buildSheetMap(fixedAssets);
      const sheetXml = await fixedAssets.file(sheetMap.get("FAreconciliation")).async("string");

      const purchases = await JSZip.loadAsync(readFileSync(resolve(outDir, dirName, "Purchases.xlsx")));
      const sales = await JSZip.loadAsync(readFileSync(resolve(outDir, dirName, "Sales.xlsx")));
      const lastPurchasesTab = (await monthTabs(purchases))[11];
      const lastSalesTab = (await monthTabs(sales))[11];

      expect(formulaAt(sheetXml, "E13"), dirName).toBe(`[2]${lastPurchasesTab}!$AI$2`);
      expect(formulaAt(sheetXml, "K13"), dirName).toBe(`[3]${lastSalesTab}!$U$2`);

      // The link cache lists the target's tabs in workbook order, and the
      // formula's tab has to be one of them or the read resolves to nothing.
      for (const [n, tab] of [
        [2, lastPurchasesTab],
        [3, lastSalesTab],
      ]) {
        const linkXml = await fixedAssets.file(`xl/externalLinks/externalLink${n}.xml`).async("string");
        const names = [...linkXml.matchAll(/<sheetName val="([^"]*)"/g)].map((m) => m[1]);
        expect(names[12], `${dirName} externalLink${n}`).toBe(tab);
      }
    }
  });

  it("carries no #REF! in any generated Fixedassets.xlsx", async () => {
    for (const dirName of packageDirs) {
      const fixedAssets = await JSZip.loadAsync(readFileSync(resolve(outDir, dirName, "Fixedassets.xlsx")));
      for (const [path, xml] of Object.entries(await everyXmlPart(fixedAssets))) {
        expect(xml, `${dirName} ${path}`).not.toContain("#REF!");
      }
    }
  });
});
