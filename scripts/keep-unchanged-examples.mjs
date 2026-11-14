#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// keep-unchanged-examples.mjs — Put back the committed bytes of every example
// workbook whose content did not change. A fresh LibreOffice save differs from
// the committed file in zip entry times alone, which would commit all of them
// on every run.
//
// Usage: node scripts/keep-unchanged-examples.mjs examples/ltd-latest

import { execFileSync } from "child_process";
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

import { xlsxSameContent } from "../app/lib/xlsx-same-content.js";

function committedBytes(path) {
  try {
    return execFileSync("git", ["show", `HEAD:${path}`], { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Usage: keep-unchanged-examples.mjs <directory>");
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".xlsx"))) {
    const path = join(dir, name);
    const committed = committedBytes(path);
    if (committed === null) continue;
    if (await xlsxSameContent(readFileSync(path), committed)) {
      writeFileSync(path, committed);
      console.log(`unchanged: ${path}`);
    } else {
      console.log(`changed: ${path}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
