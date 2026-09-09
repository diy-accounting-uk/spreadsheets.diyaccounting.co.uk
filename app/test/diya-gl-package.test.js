// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-package.test.js — the publishable @diy-accounting-uk/diya-gl
// package's bin map and prepack output resolve to real files. Runs
// prepack.mjs itself (no npm install needed: it only touches fs/path/url),
// then checks every bin target and the files list's roots exist — so a
// file moved out from under the package fails here, not at publish.
//
// The second suite packs the tarball and reads its listing, which is what
// proves the templates and the build scripts stay out of the published
// package and the licence and notice go into it.

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { engineClosure } from "../../diya-gl/scripts/engine-closure.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const DIYA_GL_DIR = resolve(ROOT, "diya-gl");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("diya-gl package", () => {
  let pkg;

  beforeAll(async () => {
    execFileSync(process.execPath, [resolve(DIYA_GL_DIR, "scripts", "prepack.mjs")], { stdio: "pipe" });
    pkg = await readJson(resolve(DIYA_GL_DIR, "package.json"));
  }, 30000);

  it("carries the same version as the repository root", async () => {
    const rootPkg = await readJson(resolve(ROOT, "package.json"));
    expect(pkg.version).toBe(rootPkg.version);
  });

  it("every bin target resolves to a file that exists after prepack", () => {
    expect(Object.keys(pkg.bin).length).toBeGreaterThan(0);
    for (const [name, relativePath] of Object.entries(pkg.bin)) {
      const target = resolve(DIYA_GL_DIR, relativePath);
      expect(existsSync(target), `bin "${name}" -> ${relativePath}`).toBe(true);
    }
  });

  it("names the four documented commands plus the dispatcher", () => {
    expect(Object.keys(pkg.bin).sort()).toEqual(
      ["diya-gl", "diya-gl-mcp", "diya-gl-read-workbook", "diya-gl-recalc", "diya-gl-write-workbook"].sort(),
    );
  });

  it("every dist target the dispatcher and the direct bins spawn exists", () => {
    const spawned = ["app/bin/report.js", "app/bin/export.js", "app/bin/write-workbook.js", "app/bin/diya-gl-mcp.js"];
    for (const relativePath of spawned) {
      const target = resolve(DIYA_GL_DIR, "dist", relativePath);
      expect(existsSync(target), relativePath).toBe(true);
    }
  });

  it("the published files list's directory roots exist after prepack", () => {
    for (const entry of pkg.files) {
      const target = resolve(DIYA_GL_DIR, entry.replace(/\/$/, ""));
      expect(existsSync(target), entry).toBe(true);
    }
  });

  it("carries the two published v2 schemas at the path app-resources.js expects", () => {
    const schemaDir = resolve(DIYA_GL_DIR, "dist", "web", "spreadsheets.diyaccounting.co.uk", "public", "schema");
    expect(existsSync(resolve(schemaDir, "diya-gl-book-v2.schema.json"))).toBe(true);
    expect(existsSync(resolve(schemaDir, "diya-gl-lines-v2.schema.json"))).toBe(true);
  });

  it("carries no workbook template", () => {
    expect(existsSync(resolve(DIYA_GL_DIR, "dist", "app", "templates"))).toBe(false);
  });

  it("carries every module the four entry points import", () => {
    for (const file of engineClosure(ROOT)) {
      expect(existsSync(resolve(DIYA_GL_DIR, "dist", file)), file).toBe(true);
    }
  });

  it("declares only the npm packages the copied runtime code actually imports", () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["ajv", "ajv-formats", "jszip", "smol-toml"]);
  });
});

// The twelve app/bin scripts that build the site, the packages and the
// reconciliation evidence. None of them is reachable from a package bin, and
// each is the company's own work under different terms from the engine.
const BUILD_SCRIPTS = [
  "build-diya-gl-spec.js",
  "build-packages.js",
  "build-reconciliation-pages.js",
  "build-sitemaps.js",
  "compliance-report.js",
  "cross-package-reconciliation.js",
  "extract-scenarios.js",
  "generate.js",
  "judge-reconciliation.js",
  "reconcile.js",
  "verify-roundtrip.js",
  "verify-stability.js",
];

describe("the packed diya-gl tarball", () => {
  let packedPaths;

  beforeAll(() => {
    const output = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: DIYA_GL_DIR, encoding: "utf8" });
    packedPaths = JSON.parse(output)[0].files.map((file) => file.path);
  }, 180000);

  it("ships the licence and the notice", () => {
    expect(packedPaths).toContain("LICENSE");
    expect(packedPaths).toContain("NOTICE");
  });

  it("ships no workbook template", () => {
    expect(packedPaths.filter((path) => path.includes("templates/"))).toEqual([]);
  });

  it("ships none of the repository's build scripts", () => {
    expect(BUILD_SCRIPTS.filter((name) => packedPaths.includes(`dist/app/bin/${name}`))).toEqual([]);
  });

  it("ships the four entry points and the two schemas", () => {
    for (const name of ["export.js", "report.js", "write-workbook.js", "diya-gl-mcp.js"]) {
      expect(packedPaths, name).toContain(`dist/app/bin/${name}`);
    }
    for (const name of ["diya-gl-book-v2.schema.json", "diya-gl-lines-v2.schema.json"]) {
      expect(packedPaths, name).toContain(`dist/web/spreadsheets.diyaccounting.co.uk/public/schema/${name}`);
    }
  });
});
