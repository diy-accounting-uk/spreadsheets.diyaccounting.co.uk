// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// run-dist-bin.js — every wrapper below spawns the real entry point under
// dist/ as a child process rather than importing it, so each one runs the
// same way regardless of whether the target file guards its own main() on
// import.meta.url (report.js does not; export.js and write-workbook.js do)
// -- an import would silently skip the guarded ones. stdio is inherited,
// so the MCP server's stdin/stdout JSON-RPC transport passes straight
// through to whatever spawned this wrapper.

import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const BIN_DIR = dirname(fileURLToPath(import.meta.url));

export function runDistBin(relativePath, args) {
  const target = resolve(BIN_DIR, "..", "dist", relativePath);
  const result = spawnSync(process.execPath, [target, ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
