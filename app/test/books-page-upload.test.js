// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// books-page-upload.test.js — the two page-side pieces an upload runs
// through, exercised from Node against the real example packages.
//
// The books page cannot import app/lib, so books/xlsx-cells.js opens the
// workbook set itself and books/drift.js reads the as-read layer off it.
// Both are plain scripts over a window global, so this file runs each one in
// a vm context with the globals the page gives it. What it proves is the
// seam: the set the page opens is a workbook set the engine's own
// sniffProduct, anchor guard and extractors accept, and the layer drift.js
// captures carries a unit for every cell the product declares one for --
// whether the product declares it as a column of CELL_MAP (Basic Sole
// Trader, Taxi Driver) or as a function of the sheet (Self Employed).

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createContext, runInContext } from "vm";
import JSZip from "jszip";
import { sniffProduct, PackagePartError } from "../lib/books-interchange.js";
import { validateAnchors } from "../lib/anchors/run.js";
import { SE_ANCHORS } from "../lib/anchors/se.js";
import { extractLines, bstExtractionMap } from "../lib/xlsx-exporter.js";
import { readXlsxCellValues } from "../lib/xlsx-reader.js";
import * as bstProduct from "../products/bst.js";
import * as seProduct from "../products/se.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const BOOKS_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "books");
const SE_PACKAGE_DIR = resolve(ROOT, "examples", "se-latest");
const BST_WORKBOOK = resolve(ROOT, "examples", "bst-latest", "GB_Accounts_Basic_Sole_Trader.xlsx");
const HUB_FILE = "Financialaccounts.xlsx";

// The page's own scripts, in one context with the two globals books.html
// gives them: JSZip, vendored beside the page, and the window they hang
// themselves off.
let page;

beforeAll(() => {
  const context = createContext({ JSZip, console });
  context.window = context;
  for (const script of ["xlsx-cells.js", "drift.js", "products/bst.js", "products/se.js"]) {
    runInContext(readFileSync(resolve(BOOKS_DIR, script), "utf-8"), context, { filename: script });
  }
  page = context;
});

async function sePackageZip() {
  const zip = new JSZip();
  for (const name of readdirSync(SE_PACKAGE_DIR).filter((file) => file.endsWith(".xlsx"))) {
    zip.file(name, readFileSync(resolve(SE_PACKAGE_DIR, name)));
  }
  return zip.generateAsync({ type: "uint8array" });
}

describe("the set books/xlsx-cells.js opens is a workbook set the engine reads", () => {
  it("sniffs a package set as Self Employed and passes it to the SE anchor table and extractors", async () => {
    const set = await page.DiyaGlXlsxCells.openWorkbookSet(await sePackageZip());

    expect(set.names()).toEqual(
      readdirSync(SE_PACKAGE_DIR)
        .filter((file) => file.endsWith(".xlsx"))
        .sort(),
    );
    expect(await sniffProduct(set, "se-latest.zip")).toBe("se");
    await expect(validateAnchors(set, SE_ANCHORS, "Self Employed")).resolves.toBeUndefined();
    expect((await extractLines(set, "se")).length).toBeGreaterThan(0);
  }, 120000);

  it("sniffs a single workbook as Basic Sole Trader, over the same set contract", async () => {
    const set = await page.DiyaGlXlsxCells.openWorkbookSetFromWorkbook("GB_Accounts_Basic_Sole_Trader.xlsx", readFileSync(BST_WORKBOOK));

    expect(set.names()).toEqual(["GB_Accounts_Basic_Sole_Trader.xlsx"]);
    expect(await sniffProduct(set, "GB_Accounts_Basic_Sole_Trader.xlsx")).toBe("bst");
    expect((await extractLines(set, "bst", bstExtractionMap("bst"))).length).toBeGreaterThan(0);
  }, 60000);

  it("addresses a workbook that arrived under some other extension as a workbook", async () => {
    const set = await page.DiyaGlXlsxCells.openWorkbookSetFromWorkbook("accounts.dat", readFileSync(BST_WORKBOOK));
    expect(set.names()).toEqual(["workbook.xlsx"]);
  });

  it("refuses one workbook of a package by the part it is, not by the product it is nearest", async () => {
    const set = await page.DiyaGlXlsxCells.openWorkbookSetFromWorkbook(HUB_FILE, readFileSync(resolve(SE_PACKAGE_DIR, HUB_FILE)));

    await expect(sniffProduct(set, HUB_FILE)).rejects.toThrow(PackagePartError);
    await expect(sniffProduct(set, HUB_FILE)).rejects.toThrow(
      '"Financialaccounts.xlsx" is the hub workbook of a nine-file Self Employed package; upload the package zip.',
    );
  }, 60000);
});

describe("books/drift.js reads a unit for every cell the product declares one for", () => {
  async function capture(productMod, manifest, set, file) {
    return page.DiyaGlDrift.captureAsReadLayer(productMod.CELL_MAP, productMod.cellLabels(), set, file, manifest);
  }

  it("captures the Self Employed hub's figures, whose rows carry no unit column at all", async () => {
    const set = await page.DiyaGlXlsxCells.openWorkbookSet(await sePackageZip());
    const layer = await capture(seProduct, page.DiyaGlProducts.se, set, HUB_FILE);

    const labels = seProduct.cellLabels();
    const wrongUnit = layer.filter((entry) => entry.unit !== labels[`${entry.sheet}!${entry.cell}`].unit);
    expect(wrongUnit, "every captured cell carries the unit the product declares").toEqual([]);
    expect(new Set(layer.map((entry) => entry.unit))).toEqual(new Set(["money", "rate", "count"]));
    expect(layer.length).toBeGreaterThan(100);

    // Anchored in the uploaded file: the layer holds what the hub caches.
    const turnover = layer.find((entry) => entry.sheet === "Profit & Loss Account" && entry.cell === "B9");
    const cached = await readXlsxCellValues(readFileSync(resolve(SE_PACKAGE_DIR, HUB_FILE)), { "Profit & Loss Account": ["B9"] });
    expect(turnover.value).toBe(cached["Profit & Loss Account"].B9);
  }, 120000);

  it("captures the same Basic Sole Trader cells the row's own unit column names", async () => {
    const set = await page.DiyaGlXlsxCells.openWorkbookSetFromWorkbook("bst.xlsx", readFileSync(BST_WORKBOOK));
    const manifest = page.DiyaGlProducts.bst;
    const layer = await capture(bstProduct, manifest, set, "bst.xlsx");

    const fromUnitColumn = new Set(
      bstProduct.CELL_MAP.filter((row) => manifest.drift.units[row[6]] && !manifest.drift.excludedSections[row[4]]).map(
        (row) => `${row[0]}!${row[1]}`,
      ),
    );
    const captured = layer.map((entry) => `${entry.sheet}!${entry.cell}`);
    expect(captured.filter((key) => !fromUnitColumn.has(key))).toEqual([]);
    expect(captured.length).toBeGreaterThan(50);
  }, 60000);
});

describe("drift.js emits unique ids", () => {
  it("emits unique ids when a hub cell reads an external link and the cell itself also drifts", () => {
    // Test scenario: a hub cell reads an external link that drifts,
    // and the hub cell itself also drifts
    const asReadLayer = [
      {
        sheet: "Sheet1",
        cell: "A1",
        label: "Test Cell",
        unit: "money",
        value: 100, // cached value
      },
    ];

    const results = {
      Sheet1: {
        A1: 105, // computed value differs from cached
      },
    };

    const linkLayer = [
      {
        file: "Leaf.xlsx",
        sheet: "Data",
        cell: "B5",
        key: "Leaf.xlsx!Data!B5",
        hubCache: 50,
        leafValue: 55, // leaf drifted
        sources: ["Sheet1!A1"], // the hub cell that reads this leaf
      },
    ];

    const classify = () => ({ stale: false, drift: true });
    const linkCells = {
      Sheet1: {
        A1: 105, // same as engine results for the hub cell
      },
      "Leaf.xlsx!Data": {
        B5: 105, // engine result for the leaf cell
      },
    };

    const drift = page.DiyaGlDrift.driftFromAsRead(asReadLayer, results, false, {
      layer: linkLayer,
      cells: linkCells,
      hubFile: "Financialaccounts.xlsx",
      classify: classify,
    });

    const ids = drift.map((e) => e.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });
});
