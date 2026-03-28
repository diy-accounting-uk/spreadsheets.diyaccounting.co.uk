#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// spike-roundtrip.js — Spike 1: verify ExcelJS can round-trip a Basic Sole Trader xlsx
//
// Usage:
//   node scripts/spike-roundtrip.js
//
// Reads the Apr26 Basic Sole Trader spreadsheet, writes it back, then compares
// every cell value and defined name to verify no data loss.

import ExcelJS from "exceljs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const { Workbook } = ExcelJS;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SRC = resolve(
  ROOT,
  "packages",
  "GB Accounts Basic Sole Trader 2026-04-05 (Apr26) Excel 2007",
  "Financialaccountsto050426.xlsx",
);
const DST = resolve(ROOT, "target", "spike-roundtrip.xlsx");

async function loadWorkbook(path) {
  const wb = new Workbook();
  await wb.xlsx.readFile(path);
  return wb;
}

function getDefinedNames(wb) {
  const names = new Map();
  for (const entry of wb.definedNames.model) {
    names.set(entry.name, entry.ranges.join(","));
  }
  return names;
}

function normaliseCellValue(val) {
  if (val === null || val === undefined) return null;

  // Normalise richText — compare text content only (font property ordering varies)
  if (typeof val === "object" && val.richText) {
    return {
      richText: val.richText.map((segment) => ({
        text: segment.text,
        fontKeys: segment.font ? Object.keys(segment.font).sort().join(",") : "",
      })),
    };
  }

  return val;
}

function compareCells(origWb, rtWb) {
  let totalChecked = 0;
  let totalDiffs = 0;
  const diffs = [];

  for (const origSheet of origWb.worksheets) {
    const rtSheet = rtWb.getWorksheet(origSheet.name);
    if (!rtSheet) {
      diffs.push({ sheet: origSheet.name, type: "MISSING_SHEET" });
      continue;
    }

    const maxR = Math.max(origSheet.rowCount, rtSheet.rowCount);
    const maxC = Math.max(origSheet.columnCount, rtSheet.columnCount);

    for (let r = 1; r <= maxR; r++) {
      for (let c = 1; c <= maxC; c++) {
        totalChecked++;
        const oVal = origSheet.getRow(r).getCell(c).value;
        const rVal = rtSheet.getRow(r).getCell(c).value;

        const oNorm = JSON.stringify(normaliseCellValue(oVal));
        const rNorm = JSON.stringify(normaliseCellValue(rVal));

        if (oNorm !== rNorm) {
          totalDiffs++;
          if (diffs.length < 20) {
            diffs.push({
              sheet: origSheet.name,
              row: r,
              col: c,
              original: oNorm?.substring(0, 100),
              roundtrip: rNorm?.substring(0, 100),
            });
          }
        }
      }
    }
  }

  return { totalChecked, totalDiffs, diffs };
}

async function main() {
  console.log("=== Spike 1: ExcelJS Round-Trip Test ===\n");
  console.log("Source:", SRC);
  console.log("Output:", DST);

  // Step 1: Read original
  console.log("\n--- Reading original ---");
  const orig = await loadWorkbook(SRC);
  console.log(
    "Sheets:",
    orig.worksheets.map((s) => s.name),
  );
  console.log("Sheet count:", orig.worksheets.length);

  const origNames = getDefinedNames(orig);
  console.log("Defined names:", origNames.size);

  // Step 2: Write round-tripped copy
  console.log("\n--- Writing round-trip copy ---");
  const { mkdirSync } = await import("fs");
  mkdirSync(dirname(DST), { recursive: true });
  await orig.xlsx.writeFile(DST);
  console.log("Written to:", DST);

  // Step 3: Read it back
  console.log("\n--- Reading round-trip copy ---");
  const rt = await loadWorkbook(DST);
  console.log("Sheet count:", rt.worksheets.length);

  const rtNames = getDefinedNames(rt);
  console.log("Defined names:", rtNames.size);

  // Step 4: Compare defined names
  console.log("\n--- Comparing defined names ---");
  const missingNames = [...origNames.keys()].filter((n) => !rtNames.has(n));
  const extraNames = [...rtNames.keys()].filter((n) => !origNames.has(n));
  const changedNames = [...origNames.keys()].filter(
    (n) => rtNames.has(n) && origNames.get(n) !== rtNames.get(n),
  );

  if (missingNames.length)
    console.log("LOST defined names:", missingNames.join(", "));
  if (extraNames.length)
    console.log("EXTRA defined names:", extraNames.join(", "));
  if (changedNames.length)
    console.log("CHANGED defined names:", changedNames.join(", "));
  if (!missingNames.length && !extraNames.length && !changedNames.length) {
    console.log("All", origNames.size, "defined names preserved.");
  }

  // Step 5: Compare cell values
  console.log("\n--- Comparing cell values ---");
  const { totalChecked, totalDiffs, diffs } = compareCells(orig, rt);
  console.log("Cells checked:", totalChecked);
  console.log("Cell diffs (after richText normalisation):", totalDiffs);

  if (totalDiffs > 0) {
    console.log("\nFirst diffs:");
    for (const d of diffs) {
      if (d.type === "MISSING_SHEET") {
        console.log(`  MISSING SHEET: ${d.sheet}`);
      } else {
        console.log(
          `  ${d.sheet}!R${d.row}C${d.col}: ${d.original} -> ${d.roundtrip}`,
        );
      }
    }
  }

  // Step 6: Spot-check key cells
  console.log("\n--- Spot-check key cells ---");
  const checks = [
    { sheet: "Admin", row: 4, col: 2, label: "Tax year start (B4)" },
    { sheet: "Admin", row: 17, col: 2, label: "Tax year end (B17)" },
    { sheet: "Admin", row: 23, col: 2, label: "Tax year label (B23)" },
    { sheet: "Admin", row: 4, col: 14, label: "Personal allowance (N4)" },
    { sheet: "Admin", row: 7, col: 14, label: "Basic rate (N7)" },
    { sheet: "Admin", row: 20, col: 12, label: "NI Class 4 rate (L20)" },
    { sheet: "Admin", row: 20, col: 14, label: "NI Class 4 limit (N20)" },
    { sheet: "Admin", row: 26, col: 6, label: "VAT threshold (F26)" },
    {
      sheet: "Income Tax",
      row: 6,
      col: 5,
      label: "Personal allowance formula (E6)",
    },
    { sheet: "Income Tax", row: 8, col: 5, label: "Tax band formula (E8)" },
    {
      sheet: "Profit & Loss Acc",
      row: 4,
      col: 4,
      label: "SalesApr ref (D4)",
    },
    { sheet: "Home", row: 3, col: 2, label: "Filename ref (B3)" },
    { sheet: "SE Short", row: 1, col: 7, label: "HMRC deadline (G1)" },
  ];

  let allPass = true;
  for (const check of checks) {
    const oVal = orig
      .getWorksheet(check.sheet)
      .getRow(check.row)
      .getCell(check.col).value;
    const rVal = rt
      .getWorksheet(check.sheet)
      .getRow(check.row)
      .getCell(check.col).value;
    const oStr = JSON.stringify(oVal);
    const rStr = JSON.stringify(rVal);
    const match = oStr === rStr ? "PASS" : "FAIL";
    if (match === "FAIL") allPass = false;
    console.log(`  ${match} ${check.label}: ${oStr.substring(0, 80)}`);
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  console.log(
    "Sheets:",
    orig.worksheets.length === rt.worksheets.length ? "PASS" : "FAIL",
    `(${orig.worksheets.length} -> ${rt.worksheets.length})`,
  );
  console.log(
    "Defined names:",
    missingNames.length === 0 && extraNames.length === 0 ? "PASS" : "FAIL",
    `(${origNames.size} -> ${rtNames.size})`,
  );
  console.log(
    "Cell values:",
    totalDiffs === 0 ? "PASS" : "FAIL",
    `(${totalDiffs} diffs out of ${totalChecked})`,
  );
  console.log("Key cells:", allPass ? "PASS" : "FAIL");

  const overallPass =
    orig.worksheets.length === rt.worksheets.length &&
    missingNames.length === 0 &&
    totalDiffs === 0 &&
    allPass;

  console.log("\nSpike 1 result:", overallPass ? "PASS" : "FAIL");
  process.exit(overallPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
