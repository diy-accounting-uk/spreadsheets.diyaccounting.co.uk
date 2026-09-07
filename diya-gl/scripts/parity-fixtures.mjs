#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// parity-fixtures.mjs — regenerate examples/parity/<product>/{report.json,
// bookchecks.json}: the fixtures the parity gate (diya-gl/parity.sh) checks
// the packed CLI's output against. The gate ignores report.json's whole
// provenance object (its five stamps are proven elsewhere, and every one of
// them moves on an ordinary generate run), so a refresh is only needed when
// this actually changes the figures or checks themselves -- a tax data
// update, a template change, or an engine change that changes the numbers
// on purpose. Run it deliberately and commit the result; never run it to
// make a gate failure go away without reading why first.
//
// Runs the source CLI (app/bin/export.js), not the packed tarball: the
// fixture records what the engine is supposed to produce, independent of
// how it is packaged.
//
// Usage: node diya-gl/scripts/parity-fixtures.mjs   (from anywhere)
//    or: npm run parity:refresh

import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const NODE = process.execPath;

function runInRepo(args) {
  execFileSync(NODE, args, { cwd: REPO_ROOT, stdio: "inherit" });
}

function refresh(product, inputFile, scratch) {
  const out = join(scratch, product);
  mkdirSync(out, { recursive: true });
  runInRepo(["app/bin/export.js", "--package", product, "--file", inputFile, "--output-dir", out]);
  const fixtureDir = resolve(REPO_ROOT, "examples", "parity", product);
  mkdirSync(fixtureDir, { recursive: true });
  copyFileSync(join(out, "report.json"), join(fixtureDir, "report.json"));
  copyFileSync(join(out, "bookchecks.json"), join(fixtureDir, "bookchecks.json"));
  console.log(`examples/parity/${product}: report.json and bookchecks.json refreshed`);
}

const scratch = mkdtempSync(join(tmpdir(), "diya-gl-parity-refresh-"));
try {
  const seZip = join(scratch, "se-package.zip");
  const ltdZip = join(scratch, "ltd-package.zip");
  runInRepo([resolve(__dirname, "zip-package-flat.mjs"), resolve(REPO_ROOT, "examples", "se-latest"), seZip]);
  runInRepo([resolve(__dirname, "zip-package-flat.mjs"), resolve(REPO_ROOT, "examples", "ltd-latest"), ltdZip]);

  refresh("bst", resolve(REPO_ROOT, "examples", "bst-latest", "GB_Accounts_Basic_Sole_Trader.xlsx"), scratch);
  refresh("taxi", resolve(REPO_ROOT, "examples", "taxi-latest", "GB_Accounts_Taxi_Driver.xlsx"), scratch);
  refresh("se", seZip, scratch);
  refresh("ltd", ltdZip, scratch);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log("\nDone.");
