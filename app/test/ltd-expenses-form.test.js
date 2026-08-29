// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The expenses claim form's mileage rate. Every tax year in the data set
// carries 45p today, so the generator write is only visible against a rate
// the template does not already hold.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { generateSpreadsheet } from "../lib/generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const LTD_DIR = resolve(APP_DIR, "templates", "ltd");
const DATA_DIR = resolve(APP_DIR, "data");

const MONTH_01 = "xl/worksheets/sheet1.xml";

async function generateExpensesForm(mileagePence) {
  const taxData = parseTOML(readFileSync(resolve(DATA_DIR, "ltd-2026.toml"), "utf8"));
  taxData.mileage.higher_rate_pence = mileagePence;
  const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));
  const buffer = await generateSpreadsheet(readFileSync(resolve(LTD_DIR, "expensesform.xlsx")), taxData, productMeta.sheets.expensesform);
  return JSZip.loadAsync(buffer);
}

describe("Ltd expenses claim form", () => {
  it("writes the tax year's mileage rate into the first month", async () => {
    const zip = await generateExpensesForm(0.52);
    const xml = await zip.file(MONTH_01).async("string");
    expect(xml).toContain('<c r="C30" s="15"><v>0.52</v></c>');
  });

  it("leaves the other eleven months reading the first one", async () => {
    const zip = await generateExpensesForm(0.52);
    for (let month = 2; month <= 12; month++) {
      const xml = await zip.file(`xl/worksheets/sheet${month}.xml`).async("string");
      const previous = `Month ${String(month - 1).padStart(2, "0")}`;
      expect(xml, `month ${month}`).toContain(`<f>'${previous}'!C30</f>`);
    }
  });

  it("names the sheet holding the rate, not one of the months chained from it", async () => {
    const productMeta = parseTOML(readFileSync(resolve(LTD_DIR, "meta.toml"), "utf8"));
    expect(productMeta.sheets.expensesform.mileageMonth).toBe(MONTH_01);

    const zip = await JSZip.loadAsync(readFileSync(resolve(LTD_DIR, "expensesform.xlsx")));
    const workbook = await zip.file("xl/workbook.xml").async("string");
    expect(workbook).toContain('<sheet name="Month 01" sheetId="1" r:id="rId1"/>');
    const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
    expect(rels).toMatch(/Id="rId1"[^>]*Target="worksheets\/sheet1\.xml"/);
  });
});
