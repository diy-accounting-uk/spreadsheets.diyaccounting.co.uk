// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// ct600-capital-allowances-formulas.test.js — Proves the Ltd CT600 sheet's
// capital-allowance schedule (boxes 107/108, 109) reads the corporation tax
// working sheet's column I, where the allowances actually sit, rather than
// column H, which the working sheet never populates. Pure JSZip read against
// the shipped template -- no LibreOffice recalculation needed.

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildSheetMap } from "../lib/spreadsheet-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = resolve(__dirname, "..", "templates", "ltd", "Financialaccounts.xlsx");

function formulaAt(xml, cellRef) {
  const match = xml.match(new RegExp(`<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<f[^>]*>([^<]*)</f>`, "s"));
  return match ? match[1] : null;
}

describe("Financialaccounts.xlsx CT600: capital-allowance schedule reads CorporationTax column I", () => {
  it("AA177, AL177 and AA179 reference column I rows 15 to 18, never column H", async () => {
    const zip = await JSZip.loadAsync(readFileSync(TEMPLATE_PATH));
    const sheetMap = await buildSheetMap(zip);
    const ct600Xml = await zip.file(sheetMap.get("CT600")).async("string");

    const aa177 = formulaAt(ct600Xml, "AA177");
    const al177 = formulaAt(ct600Xml, "AL177");
    const aa179 = formulaAt(ct600Xml, "AA179");

    expect(aa177).toBe('IF((CorporationTax!I15+CorporationTax!I17)&gt;0,CorporationTax!I15+CorporationTax!I17," ")');
    expect(al177).toBe('IF(CorporationTax!I18&lt;&gt;0,CorporationTax!I18," ")');
    expect(aa179).toBe('IF(CorporationTax!I16&gt;0,CorporationTax!I16," ")');

    for (const formula of [aa177, al177, aa179]) {
      expect(formula).not.toMatch(/CorporationTax!H1[5-8]/);
    }
  });

  it("CorporationTax rows 15 to 18 keep column H empty and hold the allowances in column I", async () => {
    const zip = await JSZip.loadAsync(readFileSync(TEMPLATE_PATH));
    const sheetMap = await buildSheetMap(zip);
    const corpTaxXml = await zip.file(sheetMap.get("CorporationTax")).async("string");

    for (const row of [15, 16, 17, 18]) {
      const hCell = corpTaxXml.match(new RegExp(`<c r="H${row}"[^>]*/>|<c r="H${row}"[^>]*>(?:(?!</c>).)*?</c>`, "s"));
      expect(hCell, `H${row}`).toBeTruthy();
      expect(hCell[0]).not.toMatch(/<f>/);
      expect(hCell[0]).not.toMatch(/<v>/);

      const iFormula = formulaAt(corpTaxXml, `I${row}`);
      expect(iFormula, `I${row}`).toBeTruthy();
    }
  });
});
