// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// Every product's package, written by savePackageZip and read back by the
// package reader every caller uses (readBookSource), comes back as the book
// it was written from: the reader accepts it, names the same product, and the
// book it hands back reports every figure the original does. The report is
// the comparison because a package states some things in its own form -- a
// Taxi day's fares as one takings cell, a Company's stock count as a year-end
// adjustment journal -- and the figures are what both forms have to agree on.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

import { savePackageZip } from "../lib/product-workbook.js";
import { readBookSource } from "../lib/diya-gl-interchange.js";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { PRODUCTS, productModule } from "../lib/products.js";
import { buildFileReportDocument } from "../bin/export.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const BOOKS = {
  bst: "examples/brickwork-pro/bst-nonvat",
  taxi: "examples/basic-taxi-driver/taxi",
  se: "examples/brickwork-pro/se-vat",
  ltd: "examples/brickwork-pro/ltd-vat",
};

// The Company package carries the opening stock on its opening balance sheet
// only (roundtrip-unrepresentable.json declares stock.openingValue for ltd),
// so the book read back has no [stock] table and the four checks that run
// only when the book states one are not run.
const CHECKS_ON_UNREPRESENTED_FIELDS = {
  ltd: [
    "check/Published P&L: prior year closing stock while no comparatives are entered",
    "check/Published P&L: prior year retained profit while no comparatives are entered",
    "check/Published P&L: prior year stock movement while no comparatives are entered",
    "check/Stock: opening carried in from the opening balance sheet",
  ],
};

function reportValues(book, lines, product) {
  const document = buildFileReportDocument(book, lines, product, productModule(product));
  return new Map(document.values.map((entry) => [entry.key, entry.value]));
}

// The report keys whose values differ, each as "key: before -> after", and
// the keys only one side reports.
function compareReports(before, after) {
  const moved = [];
  for (const [key, value] of before) {
    if (after.has(key) && after.get(key) !== value) moved.push(`${key}: ${value} -> ${after.get(key)}`);
  }
  const lost = [...before.keys()].filter((key) => !after.has(key)).sort();
  const gained = [...after.keys()].filter((key) => !before.has(key)).sort();
  return { moved, lost, gained };
}

async function roundTrip(product, transformZip = (bytes) => bytes) {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, BOOKS[product]));
  const { zip, filename } = await savePackageZip(book, lines);
  const source = await readBookSource(await transformZip(zip), filename, { products: PRODUCTS });
  return {
    book,
    lines,
    source,
    comparison: compareReports(reportValues(book, lines, product), reportValues(source.book, source.lines, product)),
  };
}

const asDay = (value) => new Date(value).toISOString().slice(0, 10);

describe("a package savePackageZip writes, read back by the package reader", () => {
  for (const product of Object.keys(BOOKS)) {
    it(`gives back the ${product} book it was written from, figure for figure`, async () => {
      const { book, source, comparison } = await roundTrip(product);

      expect(source.product).toBe(product);
      expect(comparison.moved).toEqual([]);
      expect(comparison.lost).toEqual(CHECKS_ON_UNREPRESENTED_FIELDS[product] ?? []);
      expect(comparison.gained).toEqual([]);
      if (product !== "taxi") {
        expect(asDay(source.book.documentInfo.periodCoveredStart)).toBe(asDay(book.documentInfo.periodCoveredStart));
        expect(asDay(source.book.documentInfo.periodCoveredEnd)).toBe(asDay(book.documentInfo.periodCoveredEnd));
      }
    }, 600000);
  }

  it("names the figures that move when one amount in the package is changed", async () => {
    const SALES_ENTRY = /(<c r="G(\d+)"[^>]*>(?:<f>[^<]*<\/f>)?<v>)([0-9.]+)(<\/v>)/g;
    async function raiseFirstAprilSale(bytes) {
      const pkg = await JSZip.loadAsync(bytes);
      const salesPath = Object.keys(pkg.files).find((name) => name.endsWith("/Sales.xlsx"));
      const sales = await JSZip.loadAsync(await pkg.file(salesPath).async("uint8array"));
      const workbookXml = await sales.file("xl/workbook.xml").async("string");
      const relsXml = await sales.file("xl/_rels/workbook.xml.rels").async("string");
      const relId = /<sheet [^>]*name="Apr"[^>]*r:id="([^"]+)"/.exec(workbookXml)[1];
      const target = new RegExp(`Id="${relId}"[^>]*Target="([^"]+)"`).exec(relsXml)[1].replace(/^\/?xl\//, "");
      const sheetXml = await sales.file(`xl/${target}`).async("string");
      const entry = [...sheetXml.matchAll(SALES_ENTRY)].find((match) => Number(match[2]) >= 5);
      const [whole, open, , value, close] = entry;
      const raised = sheetXml.slice(0, entry.index) + `${open}${Number(value) + 100}${close}` + sheetXml.slice(entry.index + whole.length);
      sales.file(`xl/${target}`, raised);
      pkg.file(salesPath, await sales.generateAsync({ type: "uint8array" }));
      return pkg.generateAsync({ type: "uint8array" });
    }

    const { comparison } = await roundTrip("se", raiseFirstAprilSale);

    expect(comparison.moved.length).toBeGreaterThan(0);
    expect(comparison.moved.some((entry) => entry.includes("Sales"))).toBe(true);
  }, 600000);
});
