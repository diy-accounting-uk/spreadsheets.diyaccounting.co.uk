// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// package-version.js — the version of the engine that is running, read from
// the nearest package.json above this file: the package's own in an install,
// the repository's in a checkout. Both carry the same version, and the caches
// of files fetched from the site are keyed on it.
//
// Node's own modules load on the call rather than with this file, so a bundle
// that never asks for the version never pulls them in.

/**
 * @returns {Promise<string>}
 */
export async function packageVersion() {
  const { existsSync, readFileSync } = await import("fs");
  const { dirname, join } = await import("path");
  const { fileURLToPath } = await import("url");

  let directory = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = join(directory, "package.json");
    if (existsSync(candidate)) return JSON.parse(readFileSync(candidate, "utf8")).version;
    const parent = dirname(directory);
    if (parent === directory) throw new Error("No package.json found above " + import.meta.url);
    directory = parent;
  }
}
