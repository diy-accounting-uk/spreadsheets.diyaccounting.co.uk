#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// link.js — print the diya-gl.co.uk link that opens a whole book, the book
// carried in the URL fragment.
//
// Usage:
//   node app/bin/link.js examples/basic-taxi-driver
//   node app/bin/link.js my-book-diya-gl.zip
//   node app/bin/link.js my-book.json --base http://localhost:8080
//
// The book is a directory holding book.toml and lines.jsonl, or any diya-gl
// zip or JSON file diya-gl-interchange.js reads. The link goes to stdout;
// its length and any warning go to stderr.

import { existsSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { parseDiyaGlData } from "../lib/diya-gl-loader.js";
import { readBookSource } from "../lib/diya-gl-interchange.js";
import { canonicalBookToml, canonicalLinesJsonl } from "../lib/diya-gl-canonical.js";
import { productIdOf } from "../lib/xlsx-exporter.js";
import { PRODUCTS } from "../lib/products.js";
import { encodeBookFragment, FRAGMENT_KEY } from "../lib/diya-gl-link.js";

const DEFAULT_BASE = "https://diya-gl.co.uk";
const USAGE = "Usage: node app/bin/link.js <book directory | diya-gl zip | diya-gl JSON file> [--base <url>]";

function parseArgs(argv) {
  const args = argv.slice(2);
  let base = DEFAULT_BASE;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base") {
      base = args[++i];
      if (!base) throw new Error(`--base needs a URL. ${USAGE}`);
    } else {
      positional.push(args[i]);
    }
  }
  if (positional.length !== 1) throw new Error(USAGE);
  return { source: positional[0], base: base.replace(/\/+$/, "") };
}

async function readBookText(source) {
  const path = resolve(source);
  if (!existsSync(path)) throw new Error(`${source} does not exist.`);
  if (statSync(path).isDirectory()) {
    const toml = readFileSync(join(path, "book.toml"), "utf8");
    const lines = readFileSync(join(path, "lines.jsonl"), "utf8");
    return { toml, lines, book: parseDiyaGlData(toml, lines).book };
  }
  const { book, lines } = await readBookSource(readFileSync(path), source, { products: PRODUCTS });
  return { toml: canonicalBookToml(book), lines: canonicalLinesJsonl(lines), book };
}

export async function readBookFragment(source) {
  const { toml, lines, book } = await readBookText(source);
  const declared = book.entityInformation && book.entityInformation["diya-gl:product"];
  const product = productIdOf(declared);
  if (!product)
    throw new Error(`The book declares no product with a page: entityInformation."diya-gl:product" is ${JSON.stringify(declared)}.`);
  return { product, ...encodeBookFragment({ toml, lines }) };
}

export async function bookLink(source, base = DEFAULT_BASE) {
  const { product, fragment, length, warning } = await readBookFragment(source);
  return { url: `${base}/${product}.html#${FRAGMENT_KEY}=${fragment}`, length, warning };
}

async function main() {
  const { source, base } = parseArgs(process.argv);
  const { url, length, warning } = await bookLink(source, base);
  console.log(url);
  console.error(`Fragment length: ${length} characters`);
  if (warning) console.error(`Warning: ${warning}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
