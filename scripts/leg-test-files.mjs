// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// leg-test-files.mjs — the unit test files one product's generate leg can satisfy.
//
// A generate leg regenerates one product and copies it over that product's
// committed example, so it can only run tests whose committed-output reads stay
// inside that product. A file reading two products' examples, or the committed
// reports (which carry every product's), can never pass in any single leg: the
// other product's output is whatever was last committed, and only that other
// product's leg renews it. Those belong to the push-side test workflow, which
// runs every file against a tree where all four products are settled.
//
// The reads are found in the files themselves rather than listed here, because a
// hand-kept list goes stale the moment a test starts reading another example and
// the failure then looks like the product, not the filter.

import { readFileSync } from "fs";
import { globSync } from "fs";
import { basename } from "path";

const PRODUCTS = ["bst", "taxi", "se", "ltd"];

const SOURCES = ["app/test/*.test.js", "web/unit-tests/*.test.js"];

// examples/<product>-latest, however the path is spelled: a literal path, or the
// segments passed to resolve()/join().
const EXAMPLE_PATTERNS = [/["'](bst|taxi|se|ltd)-latest["']/g, /examples\/(bst|taxi|se|ltd)-latest/g];

// The committed reports directory holds a report per product per scenario.
const REPORTS_PATTERN = /["']reports["']|examples\/reports\b/;

export function productsRead(source) {
  const found = new Set();
  for (const re of EXAMPLE_PATTERNS) {
    for (const m of source.matchAll(re)) found.add(m[1]);
  }
  if (REPORTS_PATTERN.test(source)) for (const p of PRODUCTS) found.add(p);
  return found;
}

// The product token in a file's own name, which says whose leg it belongs to.
export function productOf(name) {
  const m = name.match(/(?:^|\/|-)(bst|taxi|se|ltd)(?:-|\.)/);
  return m ? m[1] : null;
}

export function filesForLeg(product, files, read) {
  return files.filter((f) => {
    const named = productOf(basename(f));
    if (named && named !== product) return false;
    const reads = productsRead(read(f));
    for (const p of reads) if (p !== product) return false;
    return true;
  });
}

const product = process.argv[2];
if (!PRODUCTS.includes(product)) {
  console.error(`usage: node scripts/leg-test-files.mjs <${PRODUCTS.join("|")}>`);
  process.exit(2);
}

const files = SOURCES.flatMap((pattern) => globSync(pattern)).sort();
if (files.length === 0) {
  console.error("leg-test-files: no test files matched; run this from the repository root");
  process.exit(2);
}

const chosen = filesForLeg(product, files, (f) => readFileSync(f, "utf8"));
if (chosen.length === 0) {
  console.error(`leg-test-files: no files left for ${product}, which cannot be right`);
  process.exit(2);
}
console.log(chosen.join("\n"));
