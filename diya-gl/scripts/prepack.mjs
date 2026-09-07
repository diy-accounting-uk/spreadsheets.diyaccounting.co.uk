#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// prepack.mjs — copies the runtime files this package's bins need out of
// the parent repository into dist/, in the same relative layout
// app-resources.js expects (dist/app beside dist/web/.../public/schema),
// so the copied app/lib code resolves its own data files exactly as it
// does inside the parent repo. Run automatically by npm before pack and
// publish; safe to re-run, since it clears dist/ first.

import { cpSync, mkdirSync, rmSync, readFileSync } from "fs";
import { resolve, dirname, sep } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(PKG_ROOT, "..");
const DIST = resolve(PKG_ROOT, "dist");

// The version here and the parent repo's are the one thing this script
// checks rather than derives: bump both together, or prepack refuses to
// build a mismatched tarball.
const ownPkg = JSON.parse(readFileSync(resolve(PKG_ROOT, "package.json"), "utf8"));
const rootPkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
if (ownPkg.version !== rootPkg.version) {
  console.error(
    `diya-gl/package.json is at version ${ownPkg.version} but the repository root is at ${rootPkg.version}. Bump both to the same value.`,
  );
  process.exit(1);
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// app/lib, app/bin, app/products, app/data: copied whole. Nothing here is
// generated; a moved file is caught by the resolvable-paths test this
// package ships (test/bin-paths.test.js) rather than by a silent gap here.
for (const dir of ["lib", "bin", "products", "data"]) {
  cpSync(resolve(REPO_ROOT, "app", dir), resolve(DIST, "app", dir), { recursive: true });
}

// app/templates, minus the screenshots and guide markdown no packaged bin
// ever reads (only the guide PDF pipeline does, which stays in the parent
// repo). Every *.xlsx, meta.toml and the Ltd dividend voucher .docx ship.
const templateExclude = (src) => {
  const parts = src.split(sep);
  return !parts.includes("screenshots") && !src.endsWith(".md");
};
cpSync(resolve(REPO_ROOT, "app", "templates"), resolve(DIST, "app", "templates"), {
  recursive: true,
  filter: templateExclude,
});

// The two published v2 schemas, at the path app-resources.js's
// nodeResourceLoader resolves relative to dist/app: dist/app/../web/....
cpSync(
  resolve(REPO_ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "schema"),
  resolve(DIST, "web", "spreadsheets.diyaccounting.co.uk", "public", "schema"),
  { recursive: true },
);

// stderr, not stdout: `npm pack --json` writes its own result as the last
// line of stdout, and a lifecycle script's stdout output lands ahead of it
// on the same stream, so a caller parsing that line as JSON needs this
// script to stay off stdout entirely.
console.error("diya-gl: prepack copied app/{lib,bin,products,data,templates} and the v2 schemas into dist/");
