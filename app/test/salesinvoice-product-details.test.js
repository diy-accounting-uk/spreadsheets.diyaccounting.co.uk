// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// Covers the Salesinvoice Product Details G6/H6 repair: the Gross Profit
// Margin column (G) had carried the percentage formula instead of the
// margin, and the Gross Profit Margin % column (H) was empty, across every
// product row in both se/Salesinvoice.xlsx and ltd/Salesinvoice.xlsx.

import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";
import { readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { runSpreadsheet, buildSheetMap, hasLibreOffice } from "../lib/spreadsheet-runner.js";

const describeCalc = hasLibreOffice() ? describe : describe.skip;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const TEMPLATES = {
  se: join(ROOT, "app", "templates", "se", "Salesinvoice.xlsx"),
  ltd: join(ROOT, "app", "templates", "ltd", "Salesinvoice.xlsx"),
};

async function readProductDetailsXml(templatePath) {
  const zip = await JSZip.loadAsync(readFileSync(templatePath));
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get("Product Details");
  return zip.file(sheetPath).async("string");
}

describe.each(Object.entries(TEMPLATES))("%s/Salesinvoice.xlsx Product Details formulas", (product, templatePath) => {
  let xml;

  beforeAll(async () => {
    xml = await readProductDetailsXml(templatePath);
  });

  it("carries the margin formula, not the percentage, on the G6:G66 shared master", () => {
    expect(xml).toContain(
      `<c r="G6" s="63" t="str"><f t="shared" ref="G6:G66" si="0">IF(F6&gt;0,C6-F6," ")</f><v xml:space="preserve"> </v></c>`,
    );
  });

  it("carries the percentage formula on the new H6:H66 shared master", () => {
    expect(xml).toContain(
      `<c r="H6" s="64" t="str"><f t="shared" ref="H6:H66" si="2">IF(F6&gt;0,(C6-F6)*100/C6," ")</f><v xml:space="preserve"> </v></c>`,
    );
  });

  it("gives every H7:H66 follower a shared formula body", () => {
    for (let r = 7; r <= 66; r++) {
      expect(xml, `H${r}`).toContain(`<c r="H${r}" s="64" t="str"><f t="shared" si="2"/><v xml:space="preserve"> </v></c>`);
    }
  });

  it("carries no *100/ term anywhere in the G6:G66 shared group", () => {
    for (let r = 6; r <= 66; r++) {
      const cellMatch = xml.match(new RegExp(`<c r="G${r}"[^>]*>(?:(?!</c>).)*</c>`));
      expect(cellMatch, `G${r}`).toBeTruthy();
      expect(cellMatch[0], `G${r}`).not.toMatch(/\*100\//);
    }
  });

  // The template ships a second shared group one row block down, G67:G99
  // (si=1), with the identical defect. The repair plan's write-up of 4.1/4.2
  // named only the G6:G66 group; fixed both because the XML carries both.

  it("carries the margin formula, not the percentage, on the G67:G99 shared master", () => {
    expect(xml).toContain(
      `<c r="G67" s="63" t="str"><f t="shared" ref="G67:G99" si="1">IF(F67&gt;0,C67-F67," ")</f><v xml:space="preserve"> </v></c>`,
    );
  });

  it("carries the percentage formula on the new H67:H99 shared master", () => {
    expect(xml).toContain(
      `<c r="H67" s="64" t="str"><f t="shared" ref="H67:H99" si="3">IF(F67&gt;0,(C67-F67)*100/C67," ")</f><v xml:space="preserve"> </v></c>`,
    );
  });

  it("gives every H68:H98 follower a shared formula body", () => {
    for (let r = 68; r <= 98; r++) {
      expect(xml, `H${r}`).toContain(`<c r="H${r}" s="64" t="str"><f t="shared" si="3"/><v xml:space="preserve"> </v></c>`);
    }
  });

  it("gives the footer row H99 a shared formula body in its own footer style", () => {
    expect(xml).toContain(`<c r="H99" s="66" t="str"><f t="shared" si="3"/><v xml:space="preserve"> </v></c>`);
  });

  it("carries no *100/ term anywhere in the G67:G99 shared group", () => {
    for (let r = 67; r <= 99; r++) {
      const cellMatch = xml.match(new RegExp(`<c r="G${r}"[^>]*>(?:(?!</c>).)*</c>`));
      expect(cellMatch, `G${r}`).toBeTruthy();
      expect(cellMatch[0], `G${r}`).not.toMatch(/\*100\//);
    }
  });
});

// ── LibreOffice recalculation ────────────────────────────────────────────
// The JSZip assertions above prove the formula text is right; this proves
// LibreOffice actually recalculates it. One sample row from each shared
// group (the si=0/si=2 group at row 6-66, and the si=1/si=3 group at
// row 67-99), in each product's template.
describeCalc.each(Object.entries(TEMPLATES))(
  "%s/Salesinvoice.xlsx Product Details recalculation",
  (product, templatePath) => {
    it(
      "computes the margin in G and the percentage in H for sample rows in both shared groups",
      async () => {
        const buffer = readFileSync(templatePath);
        const results = await runSpreadsheet(
          buffer,
          {
            "Product Details": { C6: 200, F6: 150, C80: 100, F80: 80 },
          },
          {
            "Product Details": ["G6", "H6", "G80", "H80"],
          },
        );
        const productDetails = results["Product Details"];
        expect(productDetails.G6, "G6 margin (200-150)").toBeCloseTo(50, 6);
        expect(productDetails.H6, "H6 percentage (50*100/200)").toBeCloseTo(25, 6);
        expect(productDetails.G80, "G80 margin (100-80)").toBeCloseTo(20, 6);
        expect(productDetails.H80, "H80 percentage (20*100/100)").toBeCloseTo(20, 6);
      },
      60000,
    );
  },
);
