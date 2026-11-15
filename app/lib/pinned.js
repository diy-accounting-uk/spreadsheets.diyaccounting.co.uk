// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// pinned.js — the year-end and build date of each committed example package
// in examples/<product>-latest. This is the only module that reads or writes
// examples/pinned.json.

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { productModule } from "./products.js";

export const PINNED_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "examples", "pinned.json");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function readPinned(path = PINNED_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// The pins with one product's entry set to a new year-end and build date.
export function withPin(pinned, product, yearEnd, built) {
  if (!(product in pinned)) throw new Error(`withPin: no pinned entry for product "${product}"`);
  return { ...pinned, [product]: { yearEnd, built } };
}

// One line per product, in the layout prettier keeps for this file.
export function formatPinned(pinned) {
  const lines = Object.entries(pinned).map(
    ([product, pin]) =>
      `  ${JSON.stringify(product)}: { "yearEnd": ${JSON.stringify(pin.yearEnd)}, "built": ${JSON.stringify(pin.built)} }`,
  );
  return `{\n${lines.join(",\n")}\n}\n`;
}

export function writePinned(pinned, path = PINNED_PATH) {
  writeFileSync(path, formatPinned(pinned));
}

// The packages/ folder name of a product's package for one year-end,
// e.g. "GB Accounts Company 2027-10-31 (Oct27) Excel 2007".
export function packageDirName(product, yearEnd) {
  const [year, month] = yearEnd.split("-");
  return `${productModule(product).PRODUCT.prefix} ${yearEnd} (${MONTHS[Number(month) - 1]}${year.slice(-2)}) Excel 2007`;
}

// The reports/ file name app/bin/reconcile.js writes for one scenario run
// against that package.
export function reportFileName(product, yearEnd, scenario) {
  return `${packageDirName(product, yearEnd).replace(/[^a-zA-Z0-9]/g, "_")}_${scenario}.md`;
}

// The committed report of one scenario at the product's pinned year-end.
export function pinnedReport(product, scenario) {
  return reportFileName(product, readPinned()[product].yearEnd, scenario);
}

// The label of the UK tax year that ends on an April year-end, e.g. "2027-04-05" -> "2026-27".
export function taxYearLabel(yearEnd) {
  const endYear = Number(yearEnd.slice(0, 4));
  return `${endYear - 1}-${String(endYear).slice(-2)}`;
}

// The app/data file name of a product's tax data for the tax year that ends on an
// April year-end, e.g. ("se", "2027-04-05") -> "se-2026-2027.toml".
export function taxYearDataFile(product, yearEnd) {
  const endYear = Number(yearEnd.slice(0, 4));
  return `${product}-${endYear - 1}-${endYear}.toml`;
}

// The date six calendar months before today, as an ISO date string.
export function sixMonthsBefore(today) {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  d.setUTCMonth(d.getUTCMonth() - 6);
  return d.toISOString().slice(0, 10);
}

// Products whose pinned package was built more than six months before today.
export function stalePins(today = new Date()) {
  const limit = sixMonthsBefore(today);
  return Object.entries(readPinned())
    .filter(([, pin]) => pin.built < limit)
    .map(([product, pin]) => ({ product, built: pin.built, yearEnd: pin.yearEnd }));
}
