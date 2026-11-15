// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// pinned.js — the year-end and build date of each committed example package
// in examples/<product>-latest. This is the only reader of examples/pinned.json.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const PINNED_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "examples", "pinned.json");

export function readPinned() {
  return JSON.parse(readFileSync(PINNED_PATH, "utf8"));
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
