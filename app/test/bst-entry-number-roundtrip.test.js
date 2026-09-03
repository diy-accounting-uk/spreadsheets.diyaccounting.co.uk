// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// bst-entry-number-roundtrip.test.js — a Basic Sole Trader workbook carries
// no entry-number cell, so extractBstTransactions (xlsx-exporter.js) assigns
// each line's entryNumber from where it lands on the sheet. That only stays
// stable across a workbook -> diya-gl -> workbook -> diya-gl cycle if the
// generator always lands a given transaction on the same row, whatever order
// the caller's lines array happened to arrive in -- diyaGlToScenario
// (diya-gl-loader.js) sorts every Basic Sole Trader line into that order
// before generateSpreadsheet ever sees it. This proves the cycle holds: once
// through generation, a second generate-and-extract pass reproduces the same
// lines.jsonl byte for byte, whether or not a diya-gl zip's canonical sort
// sits between the two passes.

import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { saveBstWorkbook } from "../lib/bst-workbook.js";
import { extractBstTransactions } from "../lib/xlsx-exporter.js";
import { canonicalLinesJsonl } from "../lib/diya-gl-canonical.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP_DIR, "..");

const EXAMPLE_BOOKS = [
  ["precision-code-ltd", "examples/precision-code-ltd/bst"],
  ["sp-sixty-driving", "examples/sp-sixty-driving/bst"],
  ["brickwork-pro", "examples/brickwork-pro/bst-nonvat"],
];

async function generateAndExtract(book, lines) {
  const { workbook } = await saveBstWorkbook(book, lines);
  return extractBstTransactions(Buffer.from(workbook));
}

// What a save-to-diya-gl-zip-then-reload does to a lines array: the zip's
// lines.jsonl is canonicalLinesJsonl(lines) (books-interchange.js), and
// parseDiyaGlData reads a lines.jsonl file back in plain file order, so a
// reload hands the next generate call this canonically sorted array rather
// than whatever order the previous extraction produced.
function throughADiyaGlZip(lines) {
  return canonicalLinesJsonl(lines)
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

describe("Basic Sole Trader entry-number round trip", () => {
  for (const [name, dir] of EXAMPLE_BOOKS) {
    it(`reproduces the same lines.jsonl after two generate-and-extract cycles for ${name}`, async () => {
      const { book, lines } = loadDiyaGlData(resolve(ROOT, dir));

      const cycle1 = await generateAndExtract(book, lines);
      const cycle2 = await generateAndExtract(book, cycle1);

      expect(canonicalLinesJsonl(cycle2)).toBe(canonicalLinesJsonl(cycle1));
    }, 120000);

    it(`reproduces the same lines.jsonl when a diya-gl zip's canonical sort sits between the two cycles for ${name}`, async () => {
      const { book, lines } = loadDiyaGlData(resolve(ROOT, dir));

      const cycle1 = await generateAndExtract(book, lines);
      const reloaded = throughADiyaGlZip(cycle1);
      const cycle2 = await generateAndExtract(book, reloaded);
      const reloadedAgain = throughADiyaGlZip(cycle2);
      const cycle3 = await generateAndExtract(book, reloadedAgain);

      expect(canonicalLinesJsonl(cycle2), "stable after the first zip-mediated cycle").toBe(canonicalLinesJsonl(cycle1));
      expect(canonicalLinesJsonl(cycle3), "stable after a second zip-mediated cycle").toBe(canonicalLinesJsonl(cycle2));
    }, 180000);
  }

  it("lands the same rows whichever order the caller's lines array carries them in", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/precision-code-ltd/bst"));
    const cycle1 = await generateAndExtract(book, lines);

    // A copy of the book's lines with two entries -- different dates,
    // different accounts -- swapped in the array, so the swap is a real
    // change of input order rather than a no-op. Before diyaGlToScenario
    // sorted its own input, this alone was enough to move both entries to
    // different rows and renumber every line that shared a sheet with them.
    const i = cycle1.findIndex((line) => line.accountMainID === "4000");
    const j = cycle1.findIndex((line) => line.accountMainID !== cycle1[i].accountMainID || line.postingDate !== cycle1[i].postingDate);
    expect(i, "the fixture carries a sales line to swap").toBeGreaterThanOrEqual(0);
    expect(j, "the fixture carries a second, differently-dated or -accounted line to swap").toBeGreaterThanOrEqual(0);

    const shuffled = [...cycle1];
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    expect(shuffled.map((l) => l.entryNumber)).not.toEqual(cycle1.map((l) => l.entryNumber));

    const fromShuffled = await generateAndExtract(book, shuffled);
    expect(canonicalLinesJsonl(fromShuffled)).toBe(canonicalLinesJsonl(cycle1));
  }, 120000);

  it("sorts a Basic Sole Trader book's lines into the same order regardless of input order (diyaGlToScenario)", () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/precision-code-ltd/bst"));

    const forward = diyaGlToScenario(book, lines, "bst");
    const shuffled = [...lines].reverse();
    const reversed = diyaGlToScenario(book, shuffled, "bst");

    expect(reversed.sales).toEqual(forward.sales);
    expect(reversed.purchases).toEqual(forward.purchases);
  });
});
