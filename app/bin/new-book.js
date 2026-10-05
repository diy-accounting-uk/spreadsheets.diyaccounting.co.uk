#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// new-book.js — start an empty book for a new business: the product's
// starting chart of accounts, the twelve months to the year end and that tax
// year's rates, with no lines yet.
//
// Usage:
//   node app/bin/new-book.js --product se --name "Lark Lane" --year-end 2027-04-05
//   node app/bin/new-book.js --product ltd --name "Lark Lane Ltd" --year-end 2027-03-31 --vat --output-dir lark-lane
//
// Writes book.toml, lines.jsonl, report.json and bookchecks.json into
// --output-dir, the current directory when none is given. It runs the MCP
// server's new_book tool, so the command and the tool build the same book.

import { resolve } from "path";
import { fileURLToPath } from "url";
import { TOOLS, createSession } from "../lib/mcp/diya-gl-tools.js";
import { writeBookDirectory } from "./export.js";

const USAGE = "Usage: diya-gl new-book --product <bst|se|taxi|ltd> --name <business> --year-end <YYYY-MM-DD> [--vat] [--output-dir <dir>]";

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { vatRegistered: false, outputDir: "." };
  const valueOf = (flag, index) => {
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value. ${USAGE}`);
    return value;
  };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--product") options.product = valueOf(flag, i++);
    else if (flag === "--name") options.businessName = valueOf(flag, i++);
    else if (flag === "--year-end") options.yearEnd = valueOf(flag, i++);
    else if (flag === "--output-dir") options.outputDir = valueOf(flag, i++);
    else if (flag === "--vat") options.vatRegistered = true;
    else throw new Error(`Unknown argument ${flag}. ${USAGE}`);
  }
  if (!options.product || !options.businessName || !options.yearEnd) throw new Error(USAGE);
  return options;
}

async function main() {
  const { outputDir, ...params } = parseArgs(process.argv);
  const { book, lines, bookChecks } = await TOOLS.new_book.handler(createSession(), params);
  const resolvedOutput = resolve(outputDir);
  await writeBookDirectory(resolvedOutput, book, lines);
  const { pass, warn, fail } = bookChecks.summary;
  console.log(
    `New ${params.product} book for ${book.entityInformation.organizationIdentifier}, ${book.documentInfo.periodCoveredStart} to ${book.documentInfo.periodCoveredEnd}, in ${resolvedOutput}: ${pass} checks pass, ${warn} warn, ${fail} fail`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
