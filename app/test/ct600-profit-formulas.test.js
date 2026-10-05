// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ct600-profit-formulas.test.js — Proves the Ltd CT600 sheet states box 235
// as box 165 plus box 170 (HMRC rule 9332) and says which mapped boxes the
// template leaves for the company to type. Pure JSZip read against the
// shipped template -- no LibreOffice recalculation needed.

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import { buildSheetMap } from "../lib/spreadsheet-runner.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ct600Boxes = parseTOML(readFileSync(resolve(APP_DIR, "data", "filing", "ct600-v3.toml"), "utf8")).box;

async function ct600SheetXml() {
  const zip = await JSZip.loadAsync(readFileSync(resolve(APP_DIR, "templates", "ltd", "Financialaccounts.xlsx")));
  const sheetMap = await buildSheetMap(zip);
  return zip.file(sheetMap.get("CT600")).async("string");
}

function formulaAt(xml, cellRef) {
  const match = xml.match(new RegExp(`<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<f[^>]*>([^<]*)</f>`, "s"));
  return match ? match[1] : null;
}

describe("Financialaccounts.xlsx CT600: profits before deductions", () => {
  it("AJ92 adds the interest boxes to the trading profit whether or not the trade made one", async () => {
    const xml = await ct600SheetXml();
    expect(formulaAt(xml, "AJ92")).toBe("MAX(AJ74,0)+SUM(AJ76:AJ80)+AJ88");
  });

  it("Z98 sets a trading loss of the year against the interest, and AJ110 takes it off", async () => {
    const xml = await ct600SheetXml();
    expect(formulaAt(xml, "Z98")).toBe(
      'IF(AND(CorporationTax!K22&lt;0,CorporationTax!K24&gt;0),MIN(-CorporationTax!K22,CorporationTax!K24)," ")',
    );
    expect(formulaAt(xml, "AJ110")).toBe("AJ92-SUM(Z96,Z98,Z104,Z106)");
  });
});

describe("ct600-v3.toml boxes mapped to CT600 sheet cells", () => {
  it("a mapped cell without a formula is declared an entry cell", async () => {
    const xml = await ct600SheetXml();
    const entryCellsNotDeclared = [];
    for (const box of ct600Boxes) {
      if (!box.sheetCell) continue;
      const [file, sheet, cells] = box.sheetCell.split("!");
      if (file !== "Financialaccounts.xlsx" || sheet !== "CT600") continue;
      for (const cell of cells.split("+")) {
        if (formulaAt(xml, cell) === null && box.status !== "entry-on-this-template")
          entryCellsNotDeclared.push(`box ${box.number}: ${cell}`);
      }
    }
    expect(entryCellsNotDeclared).toEqual([]);
  });

  it("box 595 is the entry cell AJ163", () => {
    const box = ct600Boxes.find((candidate) => candidate.number === 595);
    expect(box.sheetCell).toBe("Financialaccounts.xlsx!CT600!AJ163");
    expect(box.status).toBe("entry-on-this-template");
  });
});
