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
//
// What ships is the four entry points' import closure, the runtime data and
// the two schemas. The workbook templates and the repository's build scripts
// stay behind: they are the company's own work under different terms, and the
// engine fetches a template from the site when it first needs one.

import { cpSync, mkdirSync, rmSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { engineClosure } from "./engine-closure.mjs";

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

// The four entry points and every module they reach, one file at a time.
// engineClosure throws on an import that resolves to nothing, so a moved
// file fails here rather than at publish.
const closure = engineClosure(REPO_ROOT);
for (const file of closure) {
  const target = resolve(DIST, file);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(resolve(REPO_ROOT, file), target);
}

// The tax year files, the HMRC form layouts and the filing data the closure
// reads through app-resources.js at run time.
cpSync(resolve(REPO_ROOT, "app", "data"), resolve(DIST, "app", "data"), { recursive: true });

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
console.error(`diya-gl: prepack copied ${closure.length} engine files, app/data and the v2 schemas into dist/`);
