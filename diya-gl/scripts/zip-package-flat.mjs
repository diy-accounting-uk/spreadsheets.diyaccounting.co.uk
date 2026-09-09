#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// zip-package-flat.mjs — zip a directory's *.xlsx files flat at the zip
// root, the shape a customer's own multi-file package download ships as
// (diya-gl-interchange.js's "package-set" sniff: several workbook entries,
// the hub workbook among them, no lines.jsonl). Shared by the parity gate
// and the fixture refresh script so both zip a package the same way.
//
// Usage: node zip-package-flat.mjs <sourceDir> <zipPath>

import JSZip from "jszip";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve } from "path";

const [, , sourceDir, zipPath] = process.argv;
if (!sourceDir || !zipPath) {
  console.error("Usage: node zip-package-flat.mjs <sourceDir> <zipPath>");
  process.exit(1);
}

const workbooks = readdirSync(sourceDir).filter((name) => name.endsWith(".xlsx"));
const zip = new JSZip();
for (const name of workbooks) {
  zip.file(name, readFileSync(resolve(sourceDir, name)));
}
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync(resolve(zipPath), buffer);
console.log(`${zipPath}: zipped ${workbooks.length} workbooks flat`);
