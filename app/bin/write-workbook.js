#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// write-workbook.js — diya-gl data in, an Excel package out. The other
// direction from export.js: this takes a book.toml + lines.jsonl (or any of
// the kinds diya-gl-interchange.js reads) and writes the workbook(s) the
// template composes them onto, through product-workbook.js's saveWorkbook
// path. No LibreOffice: the writes land as cached formula results the same
// way the books page's client-side export does, never a recalculation pass.
//
// Usage:
//   node app/bin/write-workbook.js --data examples/precision-code-ltd/bst --output-dir /tmp/out
//   node app/bin/write-workbook.js --file my-book-diya-gl.zip --output-dir /tmp/out
//   node app/bin/write-workbook.js --data examples/precision-code-ltd/full --zip --output-dir /tmp/out

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { readBookSource } from "../lib/diya-gl-interchange.js";
import { saveWorkbook, saveWorkbookFiles, savePackageZip, productOf } from "../lib/product-workbook.js";
import { productModule, PRODUCTS } from "../lib/products.js";

function parseArgs(argv) {
  const args = argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const dataDir = getArg("--data");
  const file = getArg("--file");
  const outputDir = getArg("--output-dir");
  const offset = getArg("--offset");
  const asZip = args.includes("--zip");

  const usage =
    "Usage: node app/bin/write-workbook.js --data <dir> --output-dir <dir> [--zip] [--offset <duration>]\n" +
    "   or: node app/bin/write-workbook.js --file <path> --output-dir <dir> [--zip]";

  if (!dataDir && !file) {
    console.error(usage);
    process.exit(1);
  }
  if (dataDir && file) {
    console.error("Error: --data and --file are mutually exclusive");
    process.exit(1);
  }
  if (!outputDir) {
    console.error("Error: --output-dir is required");
    process.exit(1);
  }

  return { dataDir, file, outputDir, offset, asZip };
}

async function loadBookAndLines(dataDir, file, offset) {
  if (dataDir) {
    return loadDiyaGlData(resolve(dataDir), offset);
  }
  const bytes = readFileSync(resolve(file));
  const { book, lines } = await readBookSource(bytes, file, { products: PRODUCTS });
  return { book, lines };
}

async function main() {
  const { dataDir, file, outputDir, offset, asZip } = parseArgs(process.argv);
  const resolvedOutput = resolve(outputDir);

  console.log(`=== write-workbook.js ===`);
  console.log(`Source:     ${dataDir ? resolve(dataDir) : resolve(file)}`);
  console.log(`Output:     ${resolvedOutput}`);

  const { book, lines } = await loadBookAndLines(dataDir, file, offset);
  const product = productModule(productOf(book));

  mkdirSync(resolvedOutput, { recursive: true });

  if (asZip) {
    const { zip, filename } = await savePackageZip(book, lines);
    writeFileSync(resolve(resolvedOutput, filename), zip);
    console.log(`  Written: ${filename}`);
    return;
  }

  if (product.MULTI_FILE) {
    const { files } = await saveWorkbookFiles(book, lines);
    for (const { name, bytes } of files) {
      writeFileSync(resolve(resolvedOutput, name), bytes);
      console.log(`  Written: ${name}`);
    }
  } else {
    const { workbook, filename } = await saveWorkbook(book, lines);
    writeFileSync(resolve(resolvedOutput, filename), workbook);
    console.log(`  Written: ${filename}`);
  }

  console.log(`\nWritten to ${resolvedOutput}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
