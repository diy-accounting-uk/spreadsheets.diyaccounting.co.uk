// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// fixedassets-hpfinance-formulas.test.js — Proves the HPfinance sheet's
// #REF! repair in the SE and Ltd Fixedassets.xlsx templates: every agreement
// row's monthly-payment formula (column I) has the same shape as the first
// working row, and no #REF! survives anywhere on the sheet. Pure JSZip reads
// against the shipped template -- no LibreOffice recalculation needed.

import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildSheetMap } from "../lib/spreadsheet-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");

// Normalises a formula's own row number away so two rows' formulas can be
// compared for shape (the same operations on the same relative columns).
function normalise(formula, row) {
  const re = new RegExp(`(?<=[A-Z])${row}(?!\\d)`, "g");
  return formula.replace(re, "<r>");
}

function formulaAt(xml, cellRef) {
  const match = xml.match(new RegExp(`<c r="${cellRef}"[^>]*>(?:(?!</c>).)*?<f[^>]*>([^<]*)</f>`, "s"));
  return match ? match[1] : null;
}

async function readHpFinanceXml(templatePath) {
  const zip = await JSZip.loadAsync(readFileSync(templatePath));
  const sheetMap = await buildSheetMap(zip);
  const sheetPath = sheetMap.get("HPfinance");
  return zip.file(sheetPath).async("string");
}

describe("Fixedassets.xlsx HPfinance: monthly-payment formula shape after the #REF! repair", () => {
  it.each([
    ["SE", resolve(APP_DIR, "templates", "se", "Fixedassets.xlsx"), 8, [10, 12, 14], 22, [24, 26, 28]],
    [
      "Ltd",
      resolve(APP_DIR, "templates", "ltd", "Fixedassets.xlsx"),
      8,
      [10, 12, 14, 16, 18, 20, 22, 24, 26],
      34,
      [36, 38, 40, 42, 44, 46, 48, 50, 52],
    ],
  ])(
    "%s: every agreement row's I/J/K formulas mirror their block's working master",
    async (_label, templatePath, newMaster, newFollowers, existingMaster, existingFollowers) => {
      const xml = await readHpFinanceXml(templatePath);

      expect(xml).not.toContain("#REF!");

      for (const col of ["I", "J", "K"]) {
        const masterFormula = formulaAt(xml, `${col}${newMaster}`);
        expect(masterFormula, `${col}${newMaster}`).toBeTruthy();
        const masterShape = normalise(masterFormula, newMaster);

        for (const row of newFollowers) {
          const formula = formulaAt(xml, `${col}${row}`);
          expect(formula, `${col}${row}`).toBeTruthy();
          expect(normalise(formula, row), `${col}${row}`).toBe(masterShape);
        }
      }

      for (const col of ["I", "J", "K"]) {
        const masterFormula = formulaAt(xml, `${col}${existingMaster}`);
        expect(masterFormula, `${col}${existingMaster}`).toBeTruthy();
        const masterShape = normalise(masterFormula, existingMaster);

        for (const row of existingFollowers) {
          const formula = formulaAt(xml, `${col}${row}`);
          expect(formula, `${col}${row}`).toBeTruthy();
          expect(normalise(formula, row), `${col}${row}`).toBe(masterShape);
        }
      }
    },
  );
});
