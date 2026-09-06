// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// entry-number-uniqueness.test.js — every edit names the line it changes by
// entryNumber, so an extracted package whose lines share a number has lines
// no edit can reach on their own. A multi-file product runs one extractor
// per journal, and each numbers only its own journal, so the numbers stay
// apart across the package and a second extraction of the same package
// reproduces them exactly.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { extractLines } from "../lib/xlsx-exporter.js";
import { workbookSetFromDirectory } from "../lib/workbook-set.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const PACKAGES = [
  { product: "se", dir: "examples/se-latest", journals: ["sales", "purchases", "bank", "payroll", "journal"] },
  { product: "ltd", dir: "examples/ltd-latest", journals: ["sales", "purchases", "bank", "payroll", "journal"] },
  { product: "bst", dir: "examples/bst-latest", journals: ["sales", "purchases"] },
  { product: "taxi", dir: "examples/taxi-latest", journals: ["sales", "purchases"] },
];

async function linesOf(dir, product) {
  return extractLines(await workbookSetFromDirectory(resolve(ROOT, dir)), product);
}

function repeated(lines) {
  const counts = new Map();
  for (const line of lines) counts.set(line.entryNumber, (counts.get(line.entryNumber) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([entryNumber, count]) => `${entryNumber} on ${count} lines`);
}

describe("extracted entry numbers", () => {
  for (const { product, dir, journals } of PACKAGES) {
    it(`gives every line of the ${product} package its own number`, async () => {
      const lines = await linesOf(dir, product);
      expect(lines.length).toBeGreaterThan(0);
      expect([...new Set(lines.map((line) => line.sourceJournalID))].sort()).toEqual([...journals].sort());
      expect(lines.every((line) => typeof line.entryNumber === "string" && line.entryNumber.length > 0)).toBe(true);
      expect(repeated(lines), repeated(lines).join("\n")).toEqual([]);
    }, 120000);

    it(`numbers the ${product} package the same way every time it is extracted`, async () => {
      const first = await linesOf(dir, product);
      const second = await linesOf(dir, product);
      expect(second.map((line) => line.entryNumber)).toEqual(first.map((line) => line.entryNumber));
    }, 120000);
  }
});

// The VAT-registered twin scenarios invent lines of their own on top of the
// BrickWork Pro master's own numbered transactions -- the VAT brought
// forward journal and the four quarterly settlement bank lines -- so these
// two diya-gl subsets are read straight off their own lines.jsonl rather
// than through a workbook.
const DIYA_GL_VAT_TWIN_SUBSETS = ["examples/brickwork-pro/se-vat", "examples/brickwork-pro/ltd-vat"];

function readSubsetLines(dir) {
  return readFileSync(resolve(ROOT, dir, "lines.jsonl"), "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

describe("entry numbers on the VAT-registered twin subsets", () => {
  for (const dir of DIYA_GL_VAT_TWIN_SUBSETS) {
    it(`gives every line of ${dir} its own number`, () => {
      const lines = readSubsetLines(dir);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.every((line) => typeof line.entryNumber === "string" && line.entryNumber.length > 0)).toBe(true);
      expect(repeated(lines), repeated(lines).join("\n")).toEqual([]);
    });
  }
});
