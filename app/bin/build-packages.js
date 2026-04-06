#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 DIY Accounting Ltd
//
// build-packages.js — Scan packages/ directories, create zip files, generate catalogue.toml
//
// Usage:
//   node app/bin/build-packages.js              # Build all packages
//   node app/bin/build-packages.js --years 2    # Build only packages from last 2 years
//
// Reads:  packages/   (product directories with Excel workbooks and PDFs)
// Writes: target/zips/          (zip files for S3 upload)
//         web/spreadsheets.diyaccounting.co.uk/public/catalogue.toml

import { existsSync, readdirSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { join, dirname, resolve } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { PRODUCTS, parsePackageDir, parseCompanyAnyDir, generateCompanyVariantNames, generateCatalogue } from "../lib/package-builder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const PACKAGES_DIR = join(ROOT, "packages");
const ZIPS_DIR = join(ROOT, "target", "zips");
const CATALOGUE_PATH = join(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "catalogue.toml");

// Parse --years N argument (default: no filter, build all)
const yearsArg = process.argv.indexOf("--years");
const YEARS_LIMIT = yearsArg !== -1 && process.argv[yearsArg + 1] ? parseInt(process.argv[yearsArg + 1], 10) : null;
const CUTOFF_DATE = YEARS_LIMIT ? new Date(Date.now() - YEARS_LIMIT * 365.25 * 24 * 60 * 60 * 1000) : null;

function zipDirectory(sourceDir, zipPath) {
  const zipDir = dirname(zipPath);
  mkdirSync(zipDir, { recursive: true });
  if (existsSync(zipPath)) unlinkSync(zipPath);
  execSync(`zip -r "${zipPath}" . -q -X -x "*/.git/*" "*.sh"`, {
    cwd: sourceDir,
    stdio: "pipe",
  });
}

function scanAndBuild() {
  if (existsSync(ZIPS_DIR)) rmSync(ZIPS_DIR, { recursive: true });
  mkdirSync(ZIPS_DIR, { recursive: true });

  if (!existsSync(PACKAGES_DIR)) {
    console.error(`packages/ directory not found at ${PACKAGES_DIR}`);
    process.exit(1);
  }

  const entries = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const allPackages = [];
  const now = new Date();

  for (const dirName of entries) {
    const dirPath = join(PACKAGES_DIR, dirName);

    // Skip work-in-progress
    if (existsSync(join(dirPath, "DO NOT USE - WORK IN PROGRESS.txt"))) {
      console.log(`Skipping (WIP): ${dirName}`);
      continue;
    }

    // Try Company (Any) pattern first
    const anyParsed = parseCompanyAnyDir(dirName);
    if (anyParsed) {
      const { startYear, endYear, format } = anyParsed;

      if (CUTOFF_DATE && new Date(`${endYear + 1}-04-01`) < CUTOFF_DATE) {
        console.log(`Skipping (older than ${YEARS_LIMIT}y): ${dirName}`);
        continue;
      }

      console.log(`Company (Any): ${dirName} → generating monthly variants`);
      const { variants, skipped } = generateCompanyVariantNames(startYear, endYear, format, now);

      for (const label of skipped) {
        console.log(`  Skipping Company variant (FY not started): ${label}`);
      }

      for (const v of variants) {
        const zipPath = join(ZIPS_DIR, `${v.zipName}.zip`);
        console.log(`  Zipping Company variant: ${v.zipName}`);
        zipDirectory(dirPath, zipPath);
        allPackages.push({
          product: "Company",
          date: v.date,
          shortLabel: v.shortLabel,
          format: v.format,
          filename: `${v.zipName}.zip`,
        });
      }
      continue;
    }

    // Standard package pattern
    const parsed = parsePackageDir(dirName);
    if (!parsed) {
      console.log(`Skipping (unrecognised): ${dirName}`);
      continue;
    }

    const { productName, date, shortLabel, format } = parsed;

    if (CUTOFF_DATE && new Date(date) < CUTOFF_DATE) {
      console.log(`Skipping (older than ${YEARS_LIMIT}y): ${dirName}`);
      continue;
    }

    if (!PRODUCTS[productName]) {
      console.log(`Skipping (filtered): ${dirName}`);
      continue;
    }

    const zipName = `${dirName}.zip`;
    const zipPath = join(ZIPS_DIR, zipName);

    console.log(`Zipping: ${dirName}`);
    zipDirectory(dirPath, zipPath);

    allPackages.push({ product: productName, date, shortLabel, format, filename: zipName });
  }

  return allPackages;
}

// Main
console.log("=== build-packages ===");
console.log(`Packages dir: ${PACKAGES_DIR}`);
console.log(`Output zips:  ${ZIPS_DIR}`);
if (YEARS_LIMIT) {
  console.log(`Year filter:  last ${YEARS_LIMIT} year(s) (cutoff: ${CUTOFF_DATE.toISOString().split("T")[0]})`);
}
console.log("");

const packages = scanAndBuild();
const generatedDate = new Date().toISOString().split("T")[0];
const toml = generateCatalogue(packages, generatedDate);
mkdirSync(dirname(CATALOGUE_PATH), { recursive: true });
writeFileSync(CATALOGUE_PATH, toml, "utf8");
console.log(`\nCatalogue written to ${CATALOGUE_PATH}`);
console.log(`Total packages: ${packages.length}`);

const zipFiles = readdirSync(ZIPS_DIR).filter((f) => f.endsWith(".zip"));
console.log(`\nGenerated ${zipFiles.length} zip files in target/zips/`);
