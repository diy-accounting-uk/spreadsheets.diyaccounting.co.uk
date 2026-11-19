#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// build-workbook-screenshots.js — Render one sheet of each product's example workbook to the image
// the product cards on the spreadsheets home page show.
//
// Usage:
//   node app/bin/build-workbook-screenshots.js
//   node app/bin/build-workbook-screenshots.js --product taxi
//
// Each sheet is rendered by LibreOffice to PDF and rasterised by pdftoppm, then ImageMagick trims
// the page margin, crops where a sheet runs past one page and scales the image down to MAX_WIDTH.
// The figures are those of the example workbooks in examples/, never a customer's.

import { execFileSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { renderSheetScreenshot } from "./build-reconciliation-pages.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const EXAMPLES_DIR = resolve(ROOT, "examples");
const OUT_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "images", "spreadsheets");

const MAX_WIDTH = 980;
const PALETTE_COLOURS = 128;

export const WORKBOOK_SHOTS = {
  bst: { examples: "bst-latest", file: "GB_Accounts_Basic_Sole_Trader.xlsx", sheet: "Profit & Loss Acc" },
  se: { examples: "se-latest", file: "Financialaccounts.xlsx", sheet: "Profit & Loss Account" },
  taxi: { examples: "taxi-latest", file: "GB_Accounts_Taxi_Driver.xlsx", sheet: "Profit & Loss Acc" },
  ltd: { examples: "ltd-latest", file: "Financialaccounts.xlsx", sheet: "MnthP&L" },
  payslips: { examples: "se-latest", file: "Payslips.xlsx", sheet: "Payslips", crop: "1169x440+0+50" },
};

export function outputName(product) {
  return `diyaccounting-spreadsheets-workbook-${product}.png`;
}

function finishImage(rawPath, outPath, crop) {
  const args = [rawPath];
  if (crop) args.push("-crop", crop, "+repage");
  args.push(
    "-trim",
    "+repage",
    "-bordercolor",
    "white",
    "-border",
    "8",
    "-resize",
    `${MAX_WIDTH}x>`,
    "-colors",
    String(PALETTE_COLOURS),
    outPath,
  );
  execFileSync("magick", args, { stdio: "pipe", timeout: 60000 });
}

async function buildOne(product) {
  const shot = WORKBOOK_SHOTS[product];
  const workDir = mkdtempSync(join(tmpdir(), "workbook-shot-"));
  try {
    const rawPath = join(workDir, "raw.png");
    await renderSheetScreenshot(join(EXAMPLES_DIR, shot.examples, shot.file), shot.sheet, rawPath);
    const outPath = join(OUT_DIR, outputName(product));
    finishImage(rawPath, outPath, shot.crop);
    console.log(`  ${product}: ${shot.file} ${shot.sheet} -> ${outputName(product)}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const flag = process.argv.indexOf("--product");
  const products = flag > 0 ? [process.argv[flag + 1]] : Object.keys(WORKBOOK_SHOTS);
  for (const product of products) {
    if (!WORKBOOK_SHOTS[product]) throw new Error(`Unknown product ${product}`);
    await buildOne(product);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
