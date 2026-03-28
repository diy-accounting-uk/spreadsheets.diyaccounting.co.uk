#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// fix-template.js — One-time template fix using zip-level XML surgery.
//
// Changes:
//   Home (sheet1.xml):
//     - All HYPERLINK formulas: B3&"'Sheet'!Cell" → "#'Sheet'!Cell"
//       (intra-workbook navigation without filename dependency)
//     - B3: clear the cell (no longer needed)
//
//   SE Short (sheet3.xml):
//     - G1: hardcoded deadline string → formula deriving year from Admin!B17
//
// These changes make the template self-updating — the generator only needs to
// write dates and tax data to the Admin sheet.

import JSZip from "jszip";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(__dirname, "..", "templates", "bst-excel.xlsx");

async function main() {
  const buf = readFileSync(TEMPLATE);
  const zip = await JSZip.loadAsync(buf);

  // ── Fix Home sheet (sheet1.xml) ──────────────────────────────────────────
  let homeXml = await zip.file("xl/worksheets/sheet1.xml").async("string");

  // Count replacements for verification
  const before = (homeXml.match(/HYPERLINK\(B3&amp;/g) || []).length;

  // Replace all HYPERLINK(B3&"' → HYPERLINK("#'
  // In the XML, the quotes are literal " not &quot;
  homeXml = homeXml.replace(
    /HYPERLINK\(B3&amp;"/g,
    'HYPERLINK("#',
  );

  const after = (homeXml.match(/HYPERLINK\(B3&amp;/g) || []).length;
  console.log(`Home HYPERLINKs: ${before} found, ${before - after} fixed`);

  // Clear B3 — replace its cell content with an empty cell
  // B3 currently has something like: <c r="B3" s="..."><f>...</f><v>...</v></c>
  // or <c r="B3" s="..." t="str"><v>...</v></c>
  const b3Match = homeXml.match(
    /(<c\s+r="B3"\s[^>]*?)(\/>|>(?:(?!<\/c>).)*<\/c>)/s,
  );
  if (b3Match) {
    const [fullMatch, openTag] = b3Match;
    // Keep the style attribute but make it empty
    homeXml = homeXml.replace(fullMatch, `${openTag.replace(/\s+t="[^"]*"/, "")}/>`);
    console.log("Home B3: cleared");
  }

  zip.file("xl/worksheets/sheet1.xml", homeXml);

  // ── Fix SE Short (sheet3.xml) ────────────────────────────────────────────
  let seXml = await zip.file("xl/worksheets/sheet3.xml").async("string");

  // G1 currently has a hardcoded string or a formula from the previous fix.
  // Replace with a formula that derives the year from Admin!B17.
  const g1Match = seXml.match(
    /(<c\s+r="G1"\s[^>]*?)(\/>|>(?:(?!<\/c>).)*<\/c>)/s,
  );
  if (g1Match) {
    const [fullMatch, openTag] = g1Match;
    // Remove any t= attribute, add t="str" for formula string result
    let newOpen = openTag.replace(/\s+t="[^"]*"/, "");
    newOpen += ` t="str"`;
    const formula =
      '"SUBMIT ONLINE RETURN TO HMRC BY 31ST JANUARY "&amp;TEXT(YEAR(Admin!B17)+1,"0000")';
    const newCell = `${newOpen}><f>${formula}</f></c>`;
    seXml = seXml.replace(fullMatch, newCell);
    console.log("SE Short G1: replaced with formula");
  }

  zip.file("xl/worksheets/sheet3.xml", seXml);

  // ── Write updated template ───────────────────────────────────────────────
  const outBuf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  writeFileSync(TEMPLATE, outBuf);
  console.log(`\nTemplate updated: ${TEMPLATE}`);

  // Verify
  const verifyZip = await JSZip.loadAsync(readFileSync(TEMPLATE));
  const verifyHome = await verifyZip
    .file("xl/worksheets/sheet1.xml")
    .async("string");
  const remaining = (verifyHome.match(/HYPERLINK\(B3&amp;/g) || []).length;
  const hashLinks = (verifyHome.match(/HYPERLINK\("#/g) || []).length;
  console.log(
    `\nVerification: ${remaining} old-style HYPERLINKs remaining, ${hashLinks} #-style HYPERLINKs`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
