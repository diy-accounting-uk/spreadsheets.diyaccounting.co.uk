#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// enable-print-headers.cjs — Enable row/column header printing in xlsx files.
// Modifies <printOptions> in each sheet to include headings="1".
//
// Usage: node scripts/enable-print-headers.cjs FILE.xlsx [FILE2.xlsx ...]
//        Modifies files in-place.

const JSZip = require("jszip");
const fs = require("fs");

async function enableHeaders(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);

  const sheetFiles = Object.keys(zip.files).filter(
    (f) => f.startsWith("xl/worksheets/sheet") && f.endsWith(".xml")
  );

  let modified = 0;
  for (const path of sheetFiles) {
    let xml = await zip.file(path).async("string");

    if (xml.includes("<printOptions")) {
      if (!xml.includes('headings="1"')) {
        xml = xml.replace(/<printOptions/, '<printOptions headings="1"');
        zip.file(path, xml, { date: zip.file(path).date });
        modified++;
      }
    } else {
      xml = xml.replace("</worksheet>", '<printOptions headings="1"/></worksheet>');
      zip.file(path, xml, { date: zip.file(path).date });
      modified++;
    }
  }

  if (modified > 0) {
    const out = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    fs.writeFileSync(filePath, out);
  }

  console.log(`${filePath}: ${modified}/${sheetFiles.length} sheets updated`);
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node scripts/enable-print-headers.cjs FILE.xlsx [...]");
    process.exit(1);
  }
  for (const f of files) {
    await enableHeaders(f);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
