#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// scripts/refresh-pinned.mjs
//
// Refresh one product's pinned example package at the newest year-end in packages/:
//
//   1. pick the newest year-end of the product in packages/
//   2. reconcile every scenario whose report the pinned checks read at that year-end
//   3. copy the populated package to examples/<product>-latest
//   4. refresh the parity fixtures (npm run parity:refresh)
//   5. remove the reports of the extra scenarios at the old pinned year-end
//   6. set the product's entry in examples/pinned.json to the new year-end and today
//
// The pinned checks find their reports through app/lib/pinned.js, so step 6 is also
// the step that points them at the new reports.
//
// Usage: node scripts/refresh-pinned.mjs --product <ltd|bst|se|taxi>

import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePackageDir } from "../app/lib/package-builder.js";
import { productModule } from "../app/lib/products.js";
import { packageDirName, readPinned, reportFileName, withPin, writePinned } from "../app/lib/pinned.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The featured scenario is the one copied to examples/<product>-latest; its earlier
// year-ends stay in reports/ as the judge's history. The extra scenarios are kept at
// the pinned year-end only.
export const REFRESH = {
  ltd: { featured: "ltd-scenario-full", extras: ["ltd-brickwork-pro-nonvat", "ltd-brickwork-pro-vat"], workbook: null },
  bst: {
    featured: "bst-scenario-basic",
    extras: ["bst-brickwork-pro-nonvat", "bst-sp-sixty"],
    workbook: "GB_Accounts_Basic_Sole_Trader.xlsx",
  },
  se: { featured: "se-scenario-advanced", extras: ["se-brickwork-pro-nonvat", "se-brickwork-pro-vat"], workbook: null },
  taxi: { featured: "taxi-scenario-basic", extras: ["taxi-scenario-sp-sixty"], workbook: "GB_Accounts_Taxi_Driver.xlsx" },
};

function configOf(product) {
  const config = REFRESH[product];
  if (!config) throw new Error(`Unknown product "${product}". Choose one of: ${Object.keys(REFRESH).join(", ")}`);
  return config;
}

export function parseArgs(argv) {
  const index = argv.indexOf("--product");
  const product = index === -1 ? undefined : argv[index + 1];
  if (!product) throw new Error("Usage: node scripts/refresh-pinned.mjs --product <ltd|bst|se|taxi>");
  configOf(product);
  return { product };
}

// The newest year-end of a product among packages/ folder names.
export function newestYearEnd(product, dirNames) {
  const { name } = productModule(product).PRODUCT;
  const dates = dirNames
    .map((dirName) => parsePackageDir(dirName))
    .filter((parsed) => parsed && parsed.productName === name)
    .map((parsed) => parsed.date)
    .sort();
  const newest = dates.at(-1);
  if (!newest) throw new Error(`No ${name} package in packages/`);
  return newest;
}

// The scenarios to reconcile, featured first.
export function scenariosOf(product) {
  const { featured, extras } = configOf(product);
  return [featured, ...extras];
}

// Where reconcile.js saves the featured scenario's recalculated package, and where
// it goes under examples/. A multi-file product saves a folder; a single-file
// product saves one workbook, which keeps a fixed name in its example folder.
export function latestTarget(product, yearEnd, root = ROOT) {
  const { featured, workbook } = configOf(product);
  const slug = packageDirName(product, yearEnd).replace(/[^a-zA-Z0-9]/g, "_");
  const populated = join(root, "reports", "populated", `${slug}_${featured}${workbook ? ".xlsx" : ""}`);
  const exampleDir = join(root, "examples", `${product}-latest`);
  return { populated, exampleDir, dest: workbook ? join(exampleDir, workbook) : exampleDir };
}

// The reports at the old pinned year-end that the new year-end replaces. The
// featured scenario's old report is history and stays.
export function replacedReports(product, oldYearEnd, newYearEnd) {
  if (oldYearEnd === newYearEnd) return [];
  return configOf(product).extras.map((scenario) => reportFileName(product, oldYearEnd, scenario));
}

function run(command, args) {
  console.log(`$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd: ROOT, stdio: "inherit" });
}

function main() {
  const { product } = parseArgs(process.argv.slice(2));
  const today = new Date().toISOString().slice(0, 10);
  const pinned = readPinned();

  const dirNames = readdirSync(join(ROOT, "packages"));
  const yearEnd = newestYearEnd(product, dirNames);
  const pkgDir = packageDirName(product, yearEnd);
  if (!dirNames.includes(pkgDir)) throw new Error(`packages/ has no folder named "${pkgDir}" for ${product} ${yearEnd}`);
  console.log(`${product}: newest year-end ${yearEnd}, pinned ${pinned[product].yearEnd}`);

  const target = latestTarget(product, yearEnd);
  rmSync(target.populated, { recursive: true, force: true });
  for (const scenario of scenariosOf(product)) {
    run(process.execPath, ["app/bin/reconcile.js", "--package", product, "--scenario", scenario, "--year-end", yearEnd]);
    const report = join(ROOT, "reports", reportFileName(product, yearEnd, scenario));
    if (!existsSync(report)) throw new Error(`reconcile.js wrote no report at ${report}`);
  }

  if (!existsSync(target.populated)) throw new Error(`reconcile.js saved no recalculated package at ${target.populated}`);
  rmSync(target.exampleDir, { recursive: true, force: true });
  if (target.dest === target.exampleDir) {
    cpSync(target.populated, target.exampleDir, { recursive: true });
  } else {
    mkdirSync(target.exampleDir, { recursive: true });
    copyFileSync(target.populated, target.dest);
  }
  console.log(`Copied ${target.populated} to ${target.dest}`);

  run("npm", ["run", "parity:refresh"]);

  for (const name of replacedReports(product, pinned[product].yearEnd, yearEnd)) {
    rmSync(join(ROOT, "reports", name), { force: true });
    console.log(`Removed reports/${name}`);
  }

  writePinned(withPin(pinned, product, yearEnd, today));
  console.log(`examples/pinned.json: ${product} pinned at ${yearEnd}, built ${today}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
