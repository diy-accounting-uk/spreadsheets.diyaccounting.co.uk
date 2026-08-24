// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// Catalogue-wide guard for the VATQtr "VAT Period ends" dropdown (see
// PLAN_VAT_QUARTER_DROPDOWN.md). Walks every packages/*/Vatreturns.xlsx
// (Ltd) and packages/*/Vat.xlsx (SE) via JSZip only -- no LibreOffice -- and
// asserts, per workbook:
//
//   1. each VATQtr sheet's G5 data-validation is type="list" over
//      $K$2:$K$15, and G5's cached serial is a member of the K2:K15 cached
//      serials;
//   2. chain consistency: each K cell's cached value equals the cached
//      value of the cell its formula names (Vatinterface!B{n}, Ltd, or
//      [n]Admin!$B$r, SE), each Vatinterface [n]Admin!$B$r cached value
//      equals the resolved external link's cached B{r}, and every
//      referenced external row exists in that cache;
//   3. fourth link: every externalLink1.xml cached B{r} equals the sibling
//      Financialaccounts.xlsx's own STORED Admin!B{r} value (the cached <v>
//      of a formula cell for Ltd, a literal <v> for SE) -- a spreadsheet
//      app "updating links" against a closed Financialaccounts.xlsx reads
//      those stored bytes, never a recalculation, so they must already
//      agree with what the external-link cache claims.
//
// Sheet names resolve to files via xl/workbook.xml + xl/_rels/workbook.xml.rels
// (buildSheetMap) rather than hardcoded sheetN.xml paths; external [n]
// references resolve via xl/workbook.xml's <externalReferences> order +
// workbook rels, rather than a hardcoded externalLink1.xml.

import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { buildSheetMap } from "../lib/spreadsheet-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const PACKAGES_DIR = join(ROOT, "packages");

const VAT_FILENAMES = ["Vatreturns.xlsx", "Vat.xlsx"];
const VATQTR_SHEET_NAMES = ["VATQtr1", "VATQtr2", "VATQtr3", "VATQtr4", "VATQtr5"];

// ── Discovery ────────────────────────────────────────────────────────────

function findVatWorkbooks() {
  const found = [];
  if (!existsSync(PACKAGES_DIR)) return found;
  const entries = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const dirName of entries) {
    const dirPath = join(PACKAGES_DIR, dirName);
    if (existsSync(join(dirPath, "DO NOT USE - WORK IN PROGRESS.txt"))) continue;
    for (const filename of VAT_FILENAMES) {
      const filePath = join(dirPath, filename);
      if (existsSync(filePath)) found.push({ dirName, filename, filePath });
    }
  }
  return found;
}

// ── XML helpers (regex cell surgery, per SKILL_EXCEL.md idioms) ───────────

// Reads a cell's formula (if any) and cached <v> (if any). Handles both
// open/close (`<c r="X" ...><f>...</f><v>...</v></c>`) and self-closing
// (`<c r="X" .../>`) forms; returns null if the cell element isn't found at
// all.
function getCellFormulaAndValue(xml, cellRef) {
  const openClose = new RegExp(`<c r="${cellRef}"[^>]*>(?:<f>([^<]*)</f>)?(?:<v>([^<]*)</v>)?</c>`, "s");
  let m = xml.match(openClose);
  if (m) {
    return {
      formula: m[1] ?? null,
      value: m[2] != null ? parseFloat(m[2]) : null,
    };
  }
  const selfClosing = new RegExp(`<c r="${cellRef}"[^>]*/>`);
  m = xml.match(selfClosing);
  if (m) return { formula: null, value: null };
  return null;
}

// Finds the dataValidation element whose sqref token list includes the
// given cell, returning its type and formula1 text.
function findDataValidation(sheetXml, cellRef) {
  const blocks = sheetXml.matchAll(/<dataValidation\b([^>]*)>[\s\S]*?<formula1>([^<]*)<\/formula1>[\s\S]*?<\/dataValidation>/g);
  for (const [, attrs, formula1] of blocks) {
    const sqrefMatch = attrs.match(/sqref="([^"]*)"/);
    if (sqrefMatch && sqrefMatch[1].split(/\s+/).includes(cellRef)) {
      const typeMatch = attrs.match(/type="([^"]*)"/);
      return { type: typeMatch ? typeMatch[1] : null, formula1 };
    }
  }
  return null;
}

// Maps external reference index (the "[n]" in formulas like
// "[1]Admin!$B$24", 1-based, per the *order* <externalReference> elements
// appear in xl/workbook.xml's <externalReferences>) to the external link's
// zip path (e.g. "xl/externalLinks/externalLink1.xml"). Resolved via the
// workbook rels, not assumed from the formula's bracket number.
async function buildExternalRefMap(zip) {
  const wbXml = await zip.file("xl/workbook.xml").async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");

  const relEntries = [...relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]*)"/g)];
  const ridToFile = new Map();
  for (const [, rid, target] of relEntries) ridToFile.set(rid, `xl/${target}`);

  const refMap = new Map();
  const refsBlock = wbXml.match(/<externalReferences>([\s\S]*?)<\/externalReferences>/);
  if (refsBlock) {
    const refEntries = [...refsBlock[1].matchAll(/r:id="(rId\d+)"/g)];
    refEntries.forEach(([, rid], i) => {
      const file = ridToFile.get(rid);
      if (file) refMap.set(i + 1, file);
    });
  }
  return refMap;
}

function relsPathFor(filePath) {
  const idx = filePath.lastIndexOf("/");
  return `${filePath.slice(0, idx)}/_rels/${filePath.slice(idx + 1)}.rels`;
}

// Loads the cached Admin!B-column values from external reference [extIdx],
// verifying the link's rels target Financialaccounts.xlsx. Returns either
// { cellMap } (cellRef -> cached numeric value, or null if the cache has no
// <v> for that cell) or { error } describing why the cache is unusable.
async function loadAdminCache(zip, externalRefMap, extIdx) {
  const filePath = externalRefMap.get(extIdx);
  if (!filePath) {
    return { error: `external reference [${extIdx}] not declared in xl/workbook.xml <externalReferences>` };
  }
  const relsFile = zip.file(relsPathFor(filePath));
  if (!relsFile) return { error: `${relsPathFor(filePath)} not found` };
  const relsXml = await relsFile.async("string");
  const targets = [...relsXml.matchAll(/Target="([^"]*)"/g)].map((m) => decodeURIComponent(m[1]));
  if (!targets.some((t) => t.endsWith("Financialaccounts.xlsx"))) {
    return { error: `${filePath} does not target Financialaccounts.xlsx (targets: ${targets.join(", ")})` };
  }

  const linkFile = zip.file(filePath);
  if (!linkFile) return { error: `${filePath} not found in zip` };
  const linkXml = await linkFile.async("string");

  const sheetNames = [...linkXml.matchAll(/<sheetName val="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  const adminSheetIndex = sheetNames.indexOf("Admin");
  if (adminSheetIndex === -1) return { error: `${filePath} has no "Admin" entry in <sheetNames>` };

  let cellMap = null;
  for (const m of linkXml.matchAll(/<sheetData sheetId="(\d+)"(?:\/>|>([\s\S]*?)<\/sheetData>)/g)) {
    if (parseInt(m[1], 10) === adminSheetIndex) {
      cellMap = new Map();
      const inner = m[2] || "";
      for (const cm of inner.matchAll(/<cell r="([^"]+)"[^>]*(?:\/>|>(?:<v>([^<]*)<\/v>)?<\/cell>)/g)) {
        cellMap.set(cm[1], cm[2] != null ? parseFloat(cm[2]) : null);
      }
      break;
    }
  }
  if (!cellMap) return { error: `${filePath} has no <sheetData sheetId="${adminSheetIndex}"> block for Admin` };
  return { cellMap };
}

// Loads the sibling Financialaccounts.xlsx's Admin sheet XML (resolved via
// its own workbook.xml + rels, same as any other sheet). Returns either
// { xml } or { error } describing why it couldn't be loaded -- a missing
// package file is a named test failure, not a crash. Ltd Financialaccounts
// hold Admin!B as formula cells with cached values; SE holds them as
// literals -- getCellFormulaAndValue handles both, so callers just compare
// against `.value`.
async function loadFinancialaccountsAdmin(dirPath) {
  const filePath = join(dirPath, "Financialaccounts.xlsx");
  if (!existsSync(filePath)) return { error: `no Financialaccounts.xlsx found in ${dirPath}` };
  const faZip = await JSZip.loadAsync(readFileSync(filePath));
  const faSheetMap = await buildSheetMap(faZip);
  const adminFile = faSheetMap.get("Admin");
  if (!adminFile) return { error: `${filePath}: no "Admin" sheet resolved via workbook.xml/rels` };
  const xml = await faZip.file(adminFile).async("string");
  return { xml };
}

// ── Test catalogue ──────────────────────────────────────────────────────

const workbooks = findVatWorkbooks();

describe("VAT quarter dropdown catalogue guard", () => {
  it("finds VAT workbooks under packages/", () => {
    expect(workbooks.length, "no packages/*/Vatreturns.xlsx or Vat.xlsx found -- is PACKAGES_DIR correct?").toBeGreaterThan(0);
  });
});

for (const wb of workbooks) {
  const label = `${wb.dirName}/${wb.filename}`;

  describe(label, () => {
    let zip;
    let sheetMap;
    let externalRefMap;
    let viXml;
    let vatQtrSheetNames;
    let sheetXmlCache;
    let adminCacheCache;
    let financialaccountsAdmin;

    beforeAll(async () => {
      const buffer = readFileSync(wb.filePath);
      zip = await JSZip.loadAsync(buffer);
      sheetMap = await buildSheetMap(zip);
      externalRefMap = await buildExternalRefMap(zip);
      sheetXmlCache = new Map();
      adminCacheCache = new Map();

      const viFile = sheetMap.get("Vatinterface");
      viXml = viFile ? await zip.file(viFile).async("string") : null;

      vatQtrSheetNames = VATQTR_SHEET_NAMES.filter((n) => sheetMap.has(n));

      financialaccountsAdmin = await loadFinancialaccountsAdmin(join(PACKAGES_DIR, wb.dirName));
    });

    async function getSheetXml(name) {
      if (!sheetXmlCache.has(name)) {
        const file = sheetMap.get(name);
        sheetXmlCache.set(name, file ? await zip.file(file).async("string") : null);
      }
      return sheetXmlCache.get(name);
    }

    async function getAdminCache(extIdx) {
      if (!adminCacheCache.has(extIdx)) {
        adminCacheCache.set(extIdx, await loadAdminCache(zip, externalRefMap, extIdx));
      }
      return adminCacheCache.get(extIdx);
    }

    it("has all five VATQtr sheets and a Vatinterface sheet", () => {
      expect(
        vatQtrSheetNames,
        `${label}: found VATQtr sheets [${vatQtrSheetNames.join(", ")}], expected all of [${VATQTR_SHEET_NAMES.join(", ")}]`,
      ).toEqual(VATQTR_SHEET_NAMES);
      expect(viXml, `${label}: no "Vatinterface" sheet resolved via workbook.xml/rels`).not.toBeNull();
    });

    for (const sheetName of VATQTR_SHEET_NAMES) {
      it(`${sheetName} G5 dropdown selects a listed quarter-end`, async () => {
        expect(sheetMap.has(sheetName), `${label}: sheet ${sheetName} not found in workbook.xml`).toBe(true);
        const sheetXml = await getSheetXml(sheetName);

        const dv = findDataValidation(sheetXml, "G5");
        expect(dv, `${label} ${sheetName}: no dataValidation with sqref including G5`).not.toBeNull();
        expect(dv.type, `${label} ${sheetName}: G5 dataValidation type`).toBe("list");
        expect(dv.formula1, `${label} ${sheetName}: G5 dataValidation formula1`).toBe("$K$2:$K$15");

        const g5 = getCellFormulaAndValue(sheetXml, "G5");
        expect(g5 && g5.value != null, `${label} ${sheetName}: G5 cell/cached value not found`).toBe(true);

        const kValues = [];
        for (let row = 2; row <= 15; row++) {
          const k = getCellFormulaAndValue(sheetXml, `K${row}`);
          if (k && k.value != null) kValues.push(k.value);
        }
        expect(kValues, `${label} ${sheetName}: K2:K15 has ${kValues.length} cached values, expected 14`).toHaveLength(14);

        expect(
          kValues,
          `${label} ${sheetName}: G5 default (serial ${g5.value}) is not a member of the shipped K2:K15 list [${kValues.join(", ")}]`,
        ).toContain(g5.value);
      });
    }

    it("K2:K15 cached values chain consistently to Vatinterface/Admin cache", async () => {
      const failures = [];

      // 1. Every Vatinterface cell whose formula is [n]Admin!$B$r: its own
      //    cached value must equal the resolved external Admin!B{r} cache.
      if (viXml) {
        const adminRefs = [...viXml.matchAll(/<c r="([A-Z]+\d+)"[^>]*><f>\[(\d+)\]Admin!\$B\$(\d+)<\/f><v>([^<]*)<\/v><\/c>/g)].map(
          ([, cellRef, extIdx, row, value]) => ({
            cellRef,
            extIdx: parseInt(extIdx, 10),
            row: parseInt(row, 10),
            value: parseFloat(value),
          }),
        );

        for (const ref of adminRefs) {
          const cache = await getAdminCache(ref.extIdx);
          if (cache.error) {
            failures.push(`Vatinterface!${ref.cellRef} (-> [${ref.extIdx}]Admin!$B$${ref.row}): ${cache.error}`);
            continue;
          }
          const externalValue = cache.cellMap.get(`B${ref.row}`);
          if (externalValue === undefined) {
            failures.push(
              `Vatinterface!${ref.cellRef} references [${ref.extIdx}]Admin!$B$${ref.row}, but the external link cache has no row ${ref.row}`,
            );
          } else if (externalValue !== ref.value) {
            failures.push(
              `Vatinterface!${ref.cellRef} cached ${ref.value} but [${ref.extIdx}]Admin!$B$${ref.row} external cache is ${externalValue}`,
            );
          }
        }
      }

      // 2. Every K2:K15 cell in every VATQtr sheet: its own cached value
      //    must equal the cached value of the cell its formula names,
      //    either Vatinterface!B{n} (Ltd) or [n]Admin!$B$r directly (SE).
      for (const sheetName of vatQtrSheetNames) {
        const sheetXml = await getSheetXml(sheetName);
        for (let row = 2; row <= 15; row++) {
          const cellRef = `K${row}`;
          const cell = getCellFormulaAndValue(sheetXml, cellRef);
          if (!cell || cell.formula == null || cell.value == null) {
            failures.push(`${sheetName}!${cellRef}: cell, formula or cached value not found`);
            continue;
          }

          const viMatch = cell.formula.match(/^Vatinterface!B(\d+)$/);
          const adminMatch = cell.formula.match(/^\[(\d+)\]Admin!\$B\$(\d+)$/);

          if (viMatch) {
            const n = viMatch[1];
            const viCell = viXml ? getCellFormulaAndValue(viXml, `B${n}`) : null;
            if (!viCell || viCell.value == null) {
              failures.push(`${sheetName}!${cellRef} references Vatinterface!B${n}, but that cell has no cached value`);
            } else if (viCell.value !== cell.value) {
              failures.push(`${sheetName}!${cellRef} cached ${cell.value} but Vatinterface!B${n} cache is ${viCell.value}`);
            }
          } else if (adminMatch) {
            const extIdx = parseInt(adminMatch[1], 10);
            const adminRow = adminMatch[2];
            const cache = await getAdminCache(extIdx);
            if (cache.error) {
              failures.push(`${sheetName}!${cellRef} (-> [${extIdx}]Admin!$B$${adminRow}): ${cache.error}`);
            } else {
              const externalValue = cache.cellMap.get(`B${adminRow}`);
              if (externalValue === undefined) {
                failures.push(
                  `${sheetName}!${cellRef} references [${extIdx}]Admin!$B$${adminRow}, but the external link cache has no row ${adminRow}`,
                );
              } else if (externalValue !== cell.value) {
                failures.push(
                  `${sheetName}!${cellRef} cached ${cell.value} but [${extIdx}]Admin!$B$${adminRow} external cache is ${externalValue}`,
                );
              }
            }
          } else {
            failures.push(`${sheetName}!${cellRef} has an unrecognized formula shape: ${cell.formula}`);
          }
        }
      }

      expect(failures, `${label}:\n${failures.join("\n")}`).toEqual([]);
    });

    it("Financialaccounts' stored Admin!B matches the externalLink1.xml cache (fourth link)", async () => {
      const failures = [];

      if (financialaccountsAdmin.error) {
        failures.push(`${label}: ${financialaccountsAdmin.error}`);
      } else {
        // Every B{r} cached in every external reference that resolves to
        // Financialaccounts.xlsx (loadAdminCache's non-error results;
        // references to unrelated externals, e.g. Sales/Purchases, are
        // skipped) must equal what Financialaccounts itself has stored for
        // Admin!B{r} -- the bytes a spreadsheet app reads when it updates
        // links against the closed workbook without recalculating it.
        for (const extIdx of externalRefMap.keys()) {
          const cache = await getAdminCache(extIdx);
          if (cache.error) continue;

          for (const [cellRef, cachedValue] of cache.cellMap) {
            if (!/^B\d+$/.test(cellRef) || cachedValue == null) continue;

            const stored = getCellFormulaAndValue(financialaccountsAdmin.xml, cellRef);
            if (!stored || stored.value == null) {
              failures.push(
                `${label} Financialaccounts.xlsx!Admin!${cellRef}: no stored cached value (externalLink1.xml [${extIdx}] caches ${cachedValue})`,
              );
            } else if (stored.value !== cachedValue) {
              failures.push(
                `${label} row ${cellRef}: Financialaccounts.xlsx!Admin!${cellRef} stored ${stored.value} but externalLink1.xml [${extIdx}] caches ${cachedValue}`,
              );
            }
          }
        }
      }

      expect(failures, `${label}:\n${failures.join("\n")}`).toEqual([]);
    });
  });
}
