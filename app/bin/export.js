#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// export.js — Extract diya-gl data from a populated Excel package.
//
// Usage:
//   node app/bin/export.js --package bst --source-dir examples/bst-latest --output-dir /tmp/exported
//   node app/bin/export.js --package se --source-dir examples/se-latest --output-dir /tmp/exported

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  extractBstTransactions,
  extractMultiFileTransactions,
  extractMetadata,
  normaliseLine,
} from "../lib/xlsx-exporter.js";
import { findXlsx } from "../lib/xlsx-reader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = argv.slice(2);
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const packageName = getArg("--package");
  const sourceDir = getArg("--source-dir");
  const outputDir = getArg("--output-dir");

  if (!packageName || !sourceDir || !outputDir) {
    console.error("Usage: node app/bin/export.js --package <bst|taxi|se|ltd> --source-dir <path> --output-dir <path>");
    process.exit(1);
  }

  return { packageName, sourceDir, outputDir };
}

async function main() {
  const { packageName, sourceDir, outputDir } = parseArgs(process.argv);
  const resolvedSource = resolve(sourceDir);
  const resolvedOutput = resolve(outputDir);

  console.log(`=== export.js ===`);
  console.log(`Package:    ${packageName}`);
  console.log(`Source:     ${resolvedSource}`);
  console.log(`Output:     ${resolvedOutput}`);

  let lines;
  let metadata;

  if (packageName === "bst" || packageName === "taxi") {
    const xlsxFile = findXlsx(resolvedSource);
    if (!xlsxFile) {
      console.error(`No xlsx file found in ${resolvedSource}`);
      process.exit(1);
    }
    const xlsxBuffer = readFileSync(resolve(resolvedSource, xlsxFile));
    lines = await extractBstTransactions(xlsxBuffer);
    metadata = await extractMetadata(xlsxBuffer, packageName);
  } else {
    lines = await extractMultiFileTransactions(resolvedSource, packageName);
    const hubPath = resolve(resolvedSource, "Financialaccounts.xlsx");
    metadata = await extractMetadata(readFileSync(hubPath), packageName);
  }

  mkdirSync(resolvedOutput, { recursive: true });

  // Write lines.jsonl
  const jsonlContent = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
  writeFileSync(resolve(resolvedOutput, "lines.jsonl"), jsonlContent);
  console.log(`  lines.jsonl: ${lines.length} entries`);

  // Write minimal book.toml
  const bookLines = [
    "[documentInfo]",
    'entriesType = "journal"',
    'language = "en"',
    'defaultCurrency = "GBP"',
    `entriesComment = "Exported from ${packageName} package"`,
    "",
    "[entityInformation]",
    `organizationIdentifier = "${metadata.organizationIdentifier || ""}"`,
    `organizationDescription = "${metadata.organizationDescription || ""}"`,
    "",
  ];
  writeFileSync(resolve(resolvedOutput, "book.toml"), bookLines.join("\n"));
  console.log(`  book.toml: metadata written`);

  console.log(`\nExported ${lines.length} transactions to ${resolvedOutput}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
