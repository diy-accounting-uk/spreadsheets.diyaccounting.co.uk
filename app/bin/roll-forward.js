#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// roll-forward.js — start the next year of a book: the year end moves on a
// year, the closing balances become the opening ones, and the lines hold only
// the opening entries.
//
// Usage:
//   node app/bin/roll-forward.js --data examples/brickwork-pro/ltd-nonvat --output-dir next-year
//   node app/bin/roll-forward.js --data my-book-diya-gl.zip --output-dir next-year
//
// --data is a directory holding book.toml and lines.jsonl, or any diya-gl zip
// or JSON file diya-gl-interchange.js reads. Writes book.toml, lines.jsonl,
// report.json, bookchecks.json and rollchecks.json (each opening figure the
// new year prints against the closing figure the old year printed for it)
// into --output-dir. It runs the MCP server's roll_forward tool, so the
// command and the tool roll the same book. Exits 1 when a roll check fails.

import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { parseDiyaGlData } from "../lib/diya-gl-loader.js";
import { readBookSource } from "../lib/diya-gl-interchange.js";
import { PRODUCTS } from "../lib/products.js";
import { TOOLS, createSession } from "../lib/mcp/diya-gl-tools.js";
import { writeBookDirectory } from "./export.js";

const USAGE = [
  "Usage: diya-gl roll-forward --data <book directory | diya-gl zip | diya-gl JSON file> --output-dir <dir>",
  "Answers: How do I start next year's books? What do I bring forward from last year? Does my opening balance sheet agree with last year's closing one?",
].join("\n");

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    const value = args[i + 1];
    if (flag !== "--data" && flag !== "--output-dir") throw new Error(`Unknown argument ${flag}. ${USAGE}`);
    if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value. ${USAGE}`);
    options[flag === "--data" ? "data" : "outputDir"] = value;
    i++;
  }
  if (!options.data || !options.outputDir) throw new Error(USAGE);
  return options;
}

async function readBook(source) {
  const path = resolve(source);
  if (!existsSync(path)) throw new Error(`${source} does not exist.`);
  if (statSync(path).isDirectory()) {
    return parseDiyaGlData(readFileSync(join(path, "book.toml"), "utf8"), readFileSync(join(path, "lines.jsonl"), "utf8"));
  }
  const { book, lines } = await readBookSource(readFileSync(path), source, { products: PRODUCTS });
  return { book, lines };
}

async function main() {
  const { data, outputDir } = parseArgs(process.argv);
  const prior = await readBook(data);
  const { book, lines, bookChecks, rollChecks } = await TOOLS.roll_forward.handler(createSession(), prior);
  const resolvedOutput = resolve(outputDir);
  await writeBookDirectory(resolvedOutput, book, lines);
  writeFileSync(join(resolvedOutput, "rollchecks.json"), `${JSON.stringify(rollChecks, null, 2)}\n`);
  const failing = rollChecks.filter((check) => check.result === "fail");
  console.log(
    `Rolled forward to ${book.documentInfo.periodCoveredStart} to ${book.documentInfo.periodCoveredEnd} in ${resolvedOutput}: ${lines.length} opening lines, ${bookChecks.summary.fail} book checks failing, ${failing.length} of ${rollChecks.length} roll checks failing`,
  );
  for (const check of failing) console.error(`  ${check.key}: expected ${check.expected}, the new year opens on ${check.actual}`);
  if (failing.length > 0) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
