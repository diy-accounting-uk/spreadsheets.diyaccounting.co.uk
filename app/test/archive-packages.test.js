// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// scripts/archive-packages.js runs its CLI at import time (dry run or --apply, then
// process.exit on failure), so every case here spawns it as a child process, the way
// export-file.test.js already does for export.js. Each test builds a throwaway "source
// repo" (a git checkout standing in for this repo, holding only scripts/archive-
// packages.js, app/lib/package-builder.js and a synthetic packages/) and a throwaway
// "archive repo" (a git checkout standing in for diy-accounting-archive), so the real
// packages/ is never written to and the real ../diy-accounting-archive is never touched.

import { describe, it, expect, afterEach, vi } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, rmSync, cpSync, writeFileSync, readFileSync, symlinkSync, utimesSync } from "fs";
import { tmpdir } from "os";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { parse as parseToml } from "smol-toml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = resolve(__dirname, "..", "..");
const NODE = process.execPath;
const SCRIPT_SRC = join(REAL_ROOT, "scripts", "archive-packages.js");
const PACKAGE_BUILDER_SRC = join(REAL_ROOT, "app", "lib", "package-builder.js");

// Each case spawns node twice or more (once per script invocation, plus several git
// subprocesses to build the throwaway repos), comfortably over vitest's 5s default.
vi.setConfig({ testTimeout: 30000 });

const tempDirs = [];
function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function gitInit(dir) {
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
}

function gitCommitAll(dir, message) {
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", message);
}

/** A throwaway checkout standing in for this repo: only what archive-packages.js reads. */
function makeSourceRepo() {
  const root = tempDir("archive-src-");
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "app", "lib"), { recursive: true });
  mkdirSync(join(root, "packages"), { recursive: true });
  cpSync(SCRIPT_SRC, join(root, "scripts", "archive-packages.js"));
  cpSync(PACKAGE_BUILDER_SRC, join(root, "app", "lib", "package-builder.js"));
  symlinkSync(join(REAL_ROOT, "node_modules"), join(root, "node_modules"));
  gitInit(root);
  gitCommitAll(root, "initial");
  return root;
}

/** A throwaway checkout standing in for diy-accounting-archive. */
function makeArchiveRepo() {
  const root = tempDir("archive-dst-");
  gitInit(root);
  git(root, "remote", "add", "origin", "git@github.com:diy-accounting-uk/diy-accounting-archive.git");
  writeFileSync(join(root, "README.md"), "stand-in archive repo\n");
  gitCommitAll(root, "initial");
  return root;
}

function standardFiles(label) {
  return { "Accounts.xlsx": `xlsx-content-${label}`, "Guide.pdf": `pdf-content-${label}` };
}

function makePackage(sourceRoot, name, files) {
  const dir = join(sourceRoot, "packages", name);
  mkdirSync(dir, { recursive: true });
  for (const [relPath, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, relPath)), { recursive: true });
    writeFileSync(join(dir, relPath), content);
  }
  return dir;
}

function bst(date, shortLabel) {
  return `GB Accounts Basic Sole Trader ${date} (${shortLabel}) Excel 2007`;
}

function run(sourceRoot, args) {
  try {
    const stdout = execFileSync(NODE, [join(sourceRoot, "scripts", "archive-packages.js"), ...args], { cwd: sourceRoot, encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

function readManifestEntries(archiveRoot) {
  const text = readFileSync(join(archiveRoot, "packages-published", "MANIFEST.toml"), "utf8");
  return parseToml(text).packages;
}

// ---------------------------------------------------------------------------
// The four fully-formed rules, each proven breakable
// ---------------------------------------------------------------------------

describe("the fully-formed gate", () => {
  it("excludes a directory whose name does not parse, and names it, and keeps going", () => {
    const source = makeSourceRepo();
    makePackage(source, "Not A Package At All", standardFiles("bad-name"));
    makePackage(source, bst("2020-04-05", "Apr20"), standardFiles("a"));
    makePackage(source, bst("2021-04-05", "Apr21"), standardFiles("b"));
    gitCommitAll(source, "packages");
    const archive = makeArchiveRepo();

    const result = run(source, ["--archive", archive]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("EXCLUDED Not A Package At All — directory name does not match the package pattern");
    expect(result.stdout).toContain("Fully formed: 2 of 3");
  });

  it("excludes a directory naming a product outside PRODUCTS, and keeps going", () => {
    const source = makeSourceRepo();
    const badProduct = "GB Accounts Nonexistent Product 2020-04-05 (Apr20) Excel 2007";
    makePackage(source, badProduct, standardFiles("unknown-product"));
    makePackage(source, bst("2020-04-05", "Apr20"), standardFiles("a"));
    makePackage(source, bst("2021-04-05", "Apr21"), standardFiles("b"));
    gitCommitAll(source, "packages");
    const archive = makeArchiveRepo();

    const result = run(source, ["--archive", archive]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`EXCLUDED ${badProduct} — unknown product "Nonexistent Product"`);
    expect(result.stdout).toContain("Fully formed: 2 of 3");
  });

  it("excludes a directory marked work in progress, and keeps going", () => {
    const source = makeSourceRepo();
    const wipName = bst("2022-04-05", "Apr22");
    makePackage(source, wipName, { ...standardFiles("wip"), "DO NOT USE - WORK IN PROGRESS.txt": "wip" });
    makePackage(source, bst("2020-04-05", "Apr20"), standardFiles("a"));
    makePackage(source, bst("2021-04-05", "Apr21"), standardFiles("b"));
    gitCommitAll(source, "packages");
    const archive = makeArchiveRepo();

    const result = run(source, ["--archive", archive]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`EXCLUDED ${wipName} — marked work in progress`);
    expect(result.stdout).toContain("Fully formed: 2 of 3");
  });

  it("excludes a directory with no PDF guide, and keeps going", () => {
    const source = makeSourceRepo();
    const noGuideName = bst("2023-04-05", "Apr23");
    makePackage(source, noGuideName, { "Accounts.xlsx": "xlsx-only" });
    makePackage(source, bst("2020-04-05", "Apr20"), standardFiles("a"));
    makePackage(source, bst("2021-04-05", "Apr21"), standardFiles("b"));
    gitCommitAll(source, "packages");
    const archive = makeArchiveRepo();

    const result = run(source, ["--archive", archive]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`EXCLUDED ${noGuideName} — no PDF guide (generated with --skip-guide?)`);
    expect(result.stdout).toContain("Fully formed: 2 of 3");
  });

  it("excludes a directory whose file shape differs from its product's other packages, and keeps going", () => {
    const source = makeSourceRepo();
    const oddOneOut = bst("2023-04-05", "Apr23");
    makePackage(source, bst("2020-04-05", "Apr20"), standardFiles("a"));
    makePackage(source, bst("2021-04-05", "Apr21"), standardFiles("b"));
    makePackage(source, bst("2022-04-05", "Apr22"), standardFiles("c"));
    makePackage(source, oddOneOut, { ...standardFiles("odd"), "Extra.xlsx": "extra" });
    gitCommitAll(source, "packages");
    const archive = makeArchiveRepo();

    const result = run(source, ["--archive", archive]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`EXCLUDED ${oddOneOut} — file list differs from other Basic Sole Trader packages (missing: none; extra: Extra.xlsx)`);
    expect(result.stdout).toContain("Fully formed: 3 of 4");
  });
});

// ---------------------------------------------------------------------------
// Tax-year bucketing, including the 5-April boundary
// ---------------------------------------------------------------------------

describe("tax-year bucketing", () => {
  it("puts 2027-03-31, 2027-04-05 and 2026-12-31 all in GB Accounts 2026-27", () => {
    const source = makeSourceRepo();
    makePackage(source, bst("2027-03-31", "Mar27"), standardFiles("mar"));
    makePackage(source, bst("2027-04-05", "Apr27"), standardFiles("apr"));
    makePackage(source, bst("2026-12-31", "Dec26"), standardFiles("dec"));
    gitCommitAll(source, "packages");
    const archive = makeArchiveRepo();

    const result = run(source, ["--archive", archive]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Fully formed: 3 of 3");
    const row = result.stdout.split("\n").find((l) => l.trim().startsWith("2026-27"));
    expect(row).toBeDefined();
    const cols = row.trim().split(/\s+/);
    expect(cols[1]).toBe("3"); // add
    expect(cols[3]).toBe("0"); // same
    expect(cols[4]).toBe("6"); // files: 3 packages x 2 files
    // no other tax-year row appears
    expect(result.stdout).not.toMatch(/^\s*2027-28/m);
  });
});

// ---------------------------------------------------------------------------
// Digest independence from mtime and read order
// ---------------------------------------------------------------------------

describe("the digest", () => {
  it("is independent of file write order and mtime", () => {
    const sourceA = makeSourceRepo();
    const dirA = makePackage(sourceA, bst("2020-04-05", "Apr20"), {});
    writeFileSync(join(dirA, "Accounts.xlsx"), "same-bytes-accounts");
    writeFileSync(join(dirA, "Guide.pdf"), "same-bytes-guide");
    utimesSync(join(dirA, "Accounts.xlsx"), new Date("2020-01-01"), new Date("2020-01-01"));
    utimesSync(join(dirA, "Guide.pdf"), new Date("2020-01-02"), new Date("2020-01-02"));
    gitCommitAll(sourceA, "packages");
    const archiveA = makeArchiveRepo();
    const resultA = run(sourceA, ["--archive", archiveA, "--apply"]);
    expect(resultA.status).toBe(0);

    const sourceB = makeSourceRepo();
    // Same product/date so the dir name (and manifest key) matches, but write the files
    // in the opposite order with different mtimes and different absolute paths.
    const dirB = makePackage(sourceB, bst("2020-04-05", "Apr20"), {});
    writeFileSync(join(dirB, "Guide.pdf"), "same-bytes-guide");
    writeFileSync(join(dirB, "Accounts.xlsx"), "same-bytes-accounts");
    utimesSync(join(dirB, "Guide.pdf"), new Date("2026-06-06"), new Date("2026-06-06"));
    utimesSync(join(dirB, "Accounts.xlsx"), new Date("2026-06-07"), new Date("2026-06-07"));
    gitCommitAll(sourceB, "packages");
    const archiveB = makeArchiveRepo();
    const resultB = run(sourceB, ["--archive", archiveB, "--apply"]);
    expect(resultB.status).toBe(0);

    const digestA = readManifestEntries(archiveA)[0].digest;
    const digestB = readManifestEntries(archiveB)[0].digest;
    expect(digestA).toBe(digestB);
  });
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

describe("idempotency", () => {
  it("writes nothing on a second --apply over an unchanged tree", () => {
    const source = makeSourceRepo();
    makePackage(source, bst("2020-04-05", "Apr20"), standardFiles("a"));
    makePackage(source, bst("2021-04-05", "Apr21"), standardFiles("b"));
    gitCommitAll(source, "packages");
    const archive = makeArchiveRepo();

    const first = run(source, ["--archive", archive, "--apply"]);
    expect(first.status).toBe(0);
    expect(first.stdout).toContain("Copied 2 packages");
    gitCommitAll(archive, "first cut");

    const second = run(source, ["--archive", archive, "--apply"]);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("Nothing to copy. The archive already holds this cut.");
    expect(git(archive, "status", "--porcelain").trim()).toBe("");
  });
});

// ---------------------------------------------------------------------------
// --apply refuses a dirty packages/
// ---------------------------------------------------------------------------

describe("--apply guard", () => {
  it("refuses to run when packages/ has uncommitted changes", () => {
    const source = makeSourceRepo();
    makePackage(source, bst("2020-04-05", "Apr20"), standardFiles("a"));
    gitCommitAll(source, "packages");
    // Dirty packages/ after the commit that established the source SHA.
    writeFileSync(join(source, "packages", bst("2020-04-05", "Apr20"), "Accounts.xlsx"), "changed-after-commit");
    const archive = makeArchiveRepo();

    const result = run(source, ["--archive", archive, "--apply"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("packages/ has uncommitted changes");
    expect(() => readManifestEntries(archive)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// --verify catches corruption
// ---------------------------------------------------------------------------

describe("--verify", () => {
  it("catches a one-byte corruption and names the package", () => {
    const source = makeSourceRepo();
    const goodName = bst("2020-04-05", "Apr20");
    const otherName = bst("2021-04-05", "Apr21");
    makePackage(source, goodName, standardFiles("a"));
    makePackage(source, otherName, standardFiles("b"));
    gitCommitAll(source, "packages");
    const archive = makeArchiveRepo();

    const cut = run(source, ["--archive", archive, "--apply"]);
    expect(cut.status).toBe(0);
    gitCommitAll(archive, "cut");

    const clean = run(source, ["--archive", archive, "--verify"]);
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain("All 2 packages match their recorded digest.");

    // A year-end of 2020-04-05 is on the 5 April boundary itself, so it belongs to the
    // tax year ending that day: 2019-20.
    const corruptedFile = join(archive, "packages-published", "GB Accounts 2019-20", goodName, "Accounts.xlsx");
    writeFileSync(corruptedFile, readFileSync(corruptedFile, "utf8") + "X");

    const corrupted = run(source, ["--archive", archive, "--verify"]);
    expect(corrupted.status).toBe(1);
    expect(corrupted.stderr).toContain(`MISMATCH ${goodName}: digest`);
    expect(corrupted.stderr).toContain("does not match manifest");
    expect(corrupted.stderr).not.toContain(otherName);
    expect(corrupted.stderr).toContain("1 of 2 packages do not match the manifest.");
  });
});
