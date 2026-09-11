#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-provenance-data.mjs — Compute the five provenance stamps and write
// them to app/lib/provenance-data.js, a committed, plain-data module.
//
// Node (the CLI, the MCP server) and the browser bundle both import that
// module directly rather than recomputing a hash or reading git at their
// own moment, so a book stamped by any of the three surfaces carries the
// same values by construction: there is only one place the values come
// from, and every surface reads the same generated file.
//
// engineVersion's commit is the last commit that touched a file the shipped
// engine (diya-gl's own packaged closure, see engine-closure.mjs) is built
// from, not literally HEAD. A tracked file that stamped live HEAD would
// change on every unrelated commit in the repository -- including the
// commit that carries the stamped file itself -- so it could never settle;
// every build step that ran this script would dirty it again for no
// engine-relevant reason. Pinning the commit to the closure's own history
// means two runs against the same engine code produce byte-identical
// output regardless of what else happened in between.
//
// Usage:
//   node scripts/build-provenance-data.mjs
//   node scripts/build-provenance-data.mjs --reconciled-commit <sha>
//
// --reconciled-commit is the hook a generate workflow's commit job calls
// with the commit its reconciliation run just passed against (github.sha),
// once one is wired up to do so; run with no flag, reconciledCommit is left
// as whatever this file already carries, so a plain local re-run of this
// script never blanks a value only CI can set.

import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import prettier from "prettier";

import { engineClosure } from "../diya-gl/scripts/engine-closure.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = resolve(ROOT, "app", "lib", "provenance-data.js");
const REPORTS_DIR = resolve(ROOT, "reports");

const FORMAT_VERSION = "diya-gl/1";

// Every product's template files and the reconciliation reports that name
// its own trust claim, keyed the way the rest of the pipeline names a
// product.
const PRODUCTS = {
  bst: { templateDir: "bst", reportPrefix: "GB_Accounts_Basic_Sole_Trader" },
  taxi: { templateDir: "taxi", reportPrefix: "GB_Accounts_Taxi_Driver" },
  se: { templateDir: "se", reportPrefix: "GB_Accounts_Self_Employed" },
  ltd: { templateDir: "ltd", reportPrefix: "GB_Accounts_Company" },
};

function shortHash(buffers) {
  const hash = createHash("sha256");
  for (const buffer of buffers) hash.update(buffer);
  return hash.digest("hex").slice(0, 12);
}

// A hash over every top-level app/data/*.toml file: the tax-year tables
// every product's calculations read. Sorted by name first, so the hash
// depends on content alone, never on directory listing order.
function taxDataHash() {
  const dataDir = resolve(ROOT, "app", "data");
  const files = readdirSync(dataDir)
    .filter((name) => name.endsWith(".toml"))
    .sort();
  return shortHash(files.map((name) => readFileSync(resolve(dataDir, name))));
}

// A hash over one product's own template workbooks: every .xlsx directly
// under app/templates/<product>, sorted by name -- the screenshots
// subdirectory and the guide/meta files carry no figures of their own, so
// they play no part in what this stamp answers ("which workbook does this
// reproduce").
function templateHash(product) {
  const templateDir = resolve(ROOT, "app", "templates", PRODUCTS[product].templateDir);
  const files = readdirSync(templateDir)
    .filter((name) => name.endsWith(".xlsx"))
    .sort();
  return shortHash(files.map((name) => readFileSync(resolve(templateDir, name))));
}

// The published reconciliation checks for one product, summed across every
// committed report under reports/ -- every year end and scenario this
// product has ever reconciled, not just its featured one. Counts the
// Result column of the "## Compliance Checks" table only, so an unrelated
// "PASS"-shaped word elsewhere in a report never counts.
function templateScorecard(product) {
  const prefix = PRODUCTS[product].reportPrefix;
  const files = readdirSync(REPORTS_DIR).filter((name) => name.endsWith(".md") && name.startsWith(`${prefix}_`));

  let passed = 0;
  let warnings = 0;
  let failed = 0;
  for (const file of files) {
    const lines = readFileSync(resolve(REPORTS_DIR, file), "utf8").split("\n");
    let inChecks = false;
    for (const line of lines) {
      if (/^##\s/.test(line)) {
        inChecks = /^##\s+Compliance Checks/.test(line);
        continue;
      }
      if (!inChecks) continue;
      const verdict = /\|\s*(PASS|WARNING|FAIL)\s*\|\s*$/.exec(line);
      if (!verdict) continue;
      if (verdict[1] === "PASS") passed++;
      else if (verdict[1] === "WARNING") warnings++;
      else failed++;
    }
  }
  return `${passed} passed, ${warnings} warnings, ${failed} failed`;
}

// The path this script writes, relative to ROOT and slash-separated the
// same way engineClosure() returns its paths -- excluded from the commit
// lookup below so the stamp never has to reference the commit that carries
// itself.
const OUT_FILE_RELATIVE = "app/lib/provenance-data.js";

// The commit that last touched the shipped engine's own code -- the four
// diya-gl entry points and every file they import, per engine-closure.mjs,
// other than this generated file itself -- not literally HEAD. Stable
// across any commit that doesn't change what the engine does, including
// the commit that carries this file's own regenerated content.
function gitCommit() {
  try {
    const closure = engineClosure(ROOT).filter((file) => file !== OUT_FILE_RELATIVE);
    return execFileSync("git", ["log", "-1", "--format=%h", "--", ...closure], { cwd: ROOT, encoding: "utf8" }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function packageVersion() {
  return JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).version;
}

// The reconciledCommit a previous run of this script already wrote, kept
// unless --reconciled-commit says otherwise -- a plain local re-run (a data
// or template change) must not blank the value only a generate workflow's
// own commit job can set.
function existingReconciledCommit() {
  if (!existsSync(OUT_FILE)) return "";
  // Tolerates both prettier's unquoted key and JSON.stringify's quoted one,
  // since the file on disk can be in either shape between the write below
  // and the next prettier pass.
  const match = /"?reconciledCommit"?:\s*"([^"]*)"/.exec(readFileSync(OUT_FILE, "utf8"));
  return match ? match[1] : "";
}

function parseArgs(argv) {
  const idx = argv.indexOf("--reconciled-commit");
  return { reconciledCommit: idx !== -1 ? argv[idx + 1] : null };
}

async function main() {
  const { reconciledCommit } = parseArgs(process.argv.slice(2));
  const data = {
    formatVersion: FORMAT_VERSION,
    engineVersion: `${packageVersion()}+${gitCommit()}`,
    taxDataHash: taxDataHash(),
    reconciledCommit: reconciledCommit ?? existingReconciledCommit(),
    templates: Object.fromEntries(
      Object.keys(PRODUCTS).map((product) => [product, { hash: templateHash(product), scorecard: templateScorecard(product) }]),
    ),
  };

  const body = `// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// provenance-data.js — generated by scripts/build-provenance-data.mjs.
// Regenerate with that script; do not hand-edit the values below.
//
// The five provenance stamps' current values: the engine's own npm version
// and commit, a hash over every tax-year data file, and each product's own
// template hash and reconciliation scorecard. Node (the CLI, the MCP
// server) and the browser bundle both import this file directly, so a book
// stamped by any of the three surfaces carries the same values.

export const PROVENANCE_DATA = ${JSON.stringify(data, null, 2)};
`;
  // Formatted with this repo's own prettier config, not just JSON.stringify's
  // shape -- so the committed file always matches what "npx prettier --check"
  // expects, and a plain re-run never leaves a formatting-only diff behind.
  const config = await prettier.resolveConfig(OUT_FILE);
  const formatted = await prettier.format(body, { ...config, filepath: OUT_FILE });
  writeFileSync(OUT_FILE, formatted);
  console.log(`provenance data: ${OUT_FILE.replace(ROOT + "/", "")}`);
  console.log(`  engineVersion: ${data.engineVersion}`);
  console.log(`  taxDataHash:   ${data.taxDataHash}`);
  for (const [product, { hash, scorecard }] of Object.entries(data.templates)) {
    console.log(`  ${product}: templateHash ${hash} (${scorecard})`);
  }
  console.log(`  reconciledCommit: ${data.reconciledCommit || "(none yet)"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
