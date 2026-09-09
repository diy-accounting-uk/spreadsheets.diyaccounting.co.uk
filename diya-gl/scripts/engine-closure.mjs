// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// engine-closure.mjs — which files under app/ the packaged engine is made of.
//
// The package's four entry points and everything they import, directly or
// through another module. prepack.mjs copies exactly this set, so a module the
// entry points stop importing leaves the tarball on its own, and a module they
// start importing arrives on its own.

import { existsSync, readFileSync } from "fs";
import { dirname, relative, resolve } from "path";

export const ENTRY_POINTS = ["app/bin/export.js", "app/bin/report.js", "app/bin/write-workbook.js", "app/bin/diya-gl-mcp.js"];

const STATIC_IMPORT = /(?:^|[^\w.])(?:import\s+[\s\S]*?\s+from\s*|import\s*|export\s+[\s\S]*?\s+from\s*)["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /import\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Every file under app/ the four entry points reach, as repository-relative
 * slash-separated paths, sorted.
 *
 * @param {string} repoRoot - the repository root the paths are relative to
 * @returns {string[]}
 */
export function engineClosure(repoRoot) {
  const reached = new Set();
  const pending = ENTRY_POINTS.map((entry) => resolve(repoRoot, entry));

  while (pending.length > 0) {
    const file = pending.pop();
    if (reached.has(file)) continue;
    if (!existsSync(file)) {
      throw new Error(`engineClosure: ${relative(repoRoot, file)} is imported but does not exist`);
    }
    reached.add(file);

    const source = readFileSync(file, "utf8");
    const specifiers = new Set();
    for (const match of source.matchAll(STATIC_IMPORT)) specifiers.add(match[1]);
    for (const match of source.matchAll(DYNAMIC_IMPORT)) specifiers.add(match[1]);
    for (const specifier of specifiers) {
      if (specifier.startsWith(".")) pending.push(resolve(dirname(file), specifier));
    }
  }

  return [...reached].map((file) => relative(repoRoot, file).split("\\").join("/")).sort();
}
