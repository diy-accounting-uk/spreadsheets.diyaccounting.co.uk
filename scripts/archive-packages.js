#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

/**
 * archive-packages.js — copy a cut of the generated packages into the archive repository.
 *
 * A cut is every fully formed directory under packages/ at one commit of this repo,
 * copied into diy-accounting-archive under packages-published/GB Accounts <tax year>/,
 * with provenance recorded in packages-published/MANIFEST.toml.
 *
 * Dry run by default: it prints what it would add, update and leave alone, and writes
 * nothing. --apply performs the copy. It never runs git add, commit or push — the
 * operator reviews the archive working tree and makes the commit.
 *
 * Usage:
 *   node scripts/archive-packages.js                        # dry run, whole catalogue
 *   node scripts/archive-packages.js --tax-year 2026-27     # dry run, one tax year
 *   node scripts/archive-packages.js --product Company      # dry run, one product
 *   node scripts/archive-packages.js --apply                # copy, then review and commit by hand
 *   node scripts/archive-packages.js --verify               # re-check the archive against its manifest
 *   node scripts/archive-packages.js --archive ../elsewhere # non-default archive checkout
 *
 * Reads:  packages/ in this repo, packages-published/ in the archive repo
 * Writes: packages-published/ in the archive repo (only with --apply)
 */

import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { parse as parseToml } from "smol-toml";
import { PRODUCTS, parsePackageDir } from "../app/lib/package-builder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PACKAGES_DIR = join(ROOT, "packages");
const DEST_SUBDIR = "packages-published";
const MANIFEST_NAME = "MANIFEST.toml";
const WIP_MARKER = "DO NOT USE - WORK IN PROGRESS.txt";
const EXPECTED_ARCHIVE_REMOTE = "diy-accounting-uk/diy-accounting-archive";

function fail(message) {
  console.error(`\nerror: ${message}\n`);
  process.exit(1);
}

function flagValue(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) fail(`${name} needs a value`);
  return value;
}

const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const ARCHIVE_ROOT = resolve(flagValue("--archive") ?? join(ROOT, "..", "diy-accounting-archive"));
const ONLY_PRODUCT = flagValue("--product");
const ONLY_TAX_YEAR = flagValue("--tax-year");

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/**
 * The UK tax year containing a package's year-end date, formatted "YYYY-YY".
 * A year-end before 6 April belongs to the tax year that ends on that 5 April.
 */
export function taxYearOf(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const startYear = month > 4 || (month === 4 && day >= 6) ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Filenames carry the year-end date; compare shapes, not literal names. */
function normaliseFilename(name) {
  return name.replace(/\d/g, "#");
}

function filesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (entry.name === ".DS_Store") continue;
    out.push(relative(dir, join(entry.parentPath, entry.name)));
  }
  return out.sort();
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Digest of a package directory: content and layout, independent of mtimes and read order. */
function digestPackage(dir, files) {
  const hash = createHash("sha256");
  for (const file of files) hash.update(`${sha256File(join(dir, file))}  ${file}\n`);
  return hash.digest("hex");
}

function bytesUnder(dir, files) {
  return files.reduce((sum, file) => sum + statSync(join(dir, file)).size, 0);
}

function mb(bytes) {
  return `${(bytes / 1e6).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Discovery and the fully formed gate
// ---------------------------------------------------------------------------

function discoverSource() {
  if (!existsSync(PACKAGES_DIR)) fail(`no packages/ directory at ${PACKAGES_DIR}. Run 'npm run generate' first.`);

  const found = [];
  const rejected = [];

  for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const dir = join(PACKAGES_DIR, entry.name);
    const parsed = parsePackageDir(entry.name);

    if (!parsed) {
      rejected.push({ name: entry.name, reason: "directory name does not match the package pattern" });
      continue;
    }
    if (!PRODUCTS[parsed.productName]) {
      rejected.push({ name: entry.name, reason: `unknown product "${parsed.productName}"` });
      continue;
    }
    if (existsSync(join(dir, WIP_MARKER))) {
      rejected.push({ name: entry.name, reason: "marked work in progress" });
      continue;
    }

    const files = filesUnder(dir);
    if (!files.some((f) => f.toLowerCase().endsWith(".pdf"))) {
      rejected.push({ name: entry.name, reason: "no PDF guide (generated with --skip-guide?)" });
      continue;
    }

    found.push({
      name: entry.name,
      dir,
      product: parsed.productName,
      taxYear: taxYearOf(parsed.date),
      files,
      shape: files.map(normaliseFilename).join("|"),
    });
  }

  // A package whose file shape differs from the rest of its product is half written.
  const shapesByProduct = new Map();
  for (const pkg of found) {
    const counts = shapesByProduct.get(pkg.product) ?? new Map();
    counts.set(pkg.shape, (counts.get(pkg.shape) ?? 0) + 1);
    shapesByProduct.set(pkg.product, counts);
  }
  const modalShape = new Map();
  for (const [product, counts] of shapesByProduct) {
    modalShape.set(product, [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }

  const complete = [];
  for (const pkg of found) {
    if (pkg.shape !== modalShape.get(pkg.product)) {
      const expected = new Set(modalShape.get(pkg.product).split("|"));
      const missing = [...expected].filter((f) => !pkg.shape.split("|").includes(f));
      const extra = pkg.shape.split("|").filter((f) => !expected.has(f));
      rejected.push({
        name: pkg.name,
        reason: `file list differs from other ${pkg.product} packages (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
      });
      continue;
    }
    complete.push(pkg);
  }

  return { complete, rejected };
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

function manifestPath() {
  return join(ARCHIVE_ROOT, DEST_SUBDIR, MANIFEST_NAME);
}

function readManifest() {
  const path = manifestPath();
  if (!existsSync(path)) return new Map();
  const parsed = parseToml(readFileSync(path, "utf8"));
  return new Map((parsed.packages ?? []).map((p) => [p.dir, p]));
}

function writeManifest(entries) {
  const rows = [...entries.values()].sort((a, b) => a.dir.localeCompare(b.dir));
  const lines = [
    "# Provenance for the packages under this directory.",
    "# Written by scripts/archive-packages.js in the spreadsheets repository. Do not edit by hand.",
    "#",
    "# Each entry names the spreadsheets-repo commit its files were generated at. digest is the",
    '# sha256 of the sorted "<sha256 of file>  <relative path>" lines for that package directory.',
    "",
    `source_repo = "diy-accounting-uk/spreadsheets.diyaccounting.co.uk"`,
    `package_count = ${rows.length}`,
    "",
  ];
  for (const row of rows) {
    lines.push("[[packages]]");
    lines.push(`dir = ${JSON.stringify(row.dir)}`);
    lines.push(`tax_year = ${JSON.stringify(row.tax_year)}`);
    lines.push(`product = ${JSON.stringify(row.product)}`);
    lines.push(`files = ${row.files}`);
    lines.push(`bytes = ${row.bytes}`);
    lines.push(`digest = ${JSON.stringify(row.digest)}`);
    lines.push(`source_sha = ${JSON.stringify(row.source_sha)}`);
    lines.push(`cut = ${JSON.stringify(row.cut)}`);
    lines.push("");
  }
  writeFileSync(manifestPath(), lines.join("\n"));
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

function checkArchive() {
  if (!existsSync(join(ARCHIVE_ROOT, ".git"))) fail(`${ARCHIVE_ROOT} is not a git checkout. Pass --archive <path>.`);
  const remote = git(ARCHIVE_ROOT, "remote", "get-url", "origin");
  if (!remote.includes(EXPECTED_ARCHIVE_REMOTE)) fail(`${ARCHIVE_ROOT} points at ${remote}, not ${EXPECTED_ARCHIVE_REMOTE}.`);
  return {
    branch: git(ARCHIVE_ROOT, "rev-parse", "--abbrev-ref", "HEAD"),
    dirty: git(ARCHIVE_ROOT, "status", "--porcelain").length > 0,
  };
}

function runVerify() {
  const archive = checkArchive();
  const manifest = readManifest();
  if (manifest.size === 0) fail(`no ${DEST_SUBDIR}/${MANIFEST_NAME} in ${ARCHIVE_ROOT}. Nothing has been cut yet.`);

  console.log(`Archive: ${ARCHIVE_ROOT} (${archive.branch}${archive.dirty ? ", dirty" : ", clean"})`);
  console.log(`Verifying ${manifest.size} packages against ${DEST_SUBDIR}/${MANIFEST_NAME}\n`);

  const problems = [];
  for (const entry of manifest.values()) {
    const dir = join(ARCHIVE_ROOT, DEST_SUBDIR, `GB Accounts ${entry.tax_year}`, entry.dir);
    if (!existsSync(dir)) {
      problems.push(`${entry.dir}: listed in the manifest, missing from the tree`);
      continue;
    }
    const files = filesUnder(dir);
    const digest = digestPackage(dir, files);
    if (digest !== entry.digest)
      problems.push(`${entry.dir}: digest ${digest.slice(0, 12)} does not match manifest ${entry.digest.slice(0, 12)}`);
  }

  if (problems.length) {
    for (const p of problems) console.error(`  MISMATCH ${p}`);
    fail(`${problems.length} of ${manifest.size} packages do not match the manifest.`);
  }
  console.log(`All ${manifest.size} packages match their recorded digest.`);
}

function runCut() {
  const sourceSha = git(ROOT, "rev-parse", "HEAD");
  const sourceBranch = git(ROOT, "rev-parse", "--abbrev-ref", "HEAD");
  const sourceDirty = git(ROOT, "status", "--porcelain", "--", "packages").length > 0;
  const archive = checkArchive();
  const cutDate = new Date().toISOString().slice(0, 10);

  console.log(`Source:      ${ROOT}`);
  console.log(`             ${sourceSha.slice(0, 8)} on ${sourceBranch}, packages/ ${sourceDirty ? "DIRTY" : "clean"}`);
  console.log(`Archive:     ${ARCHIVE_ROOT}`);
  console.log(`             ${archive.branch}, working tree ${archive.dirty ? "dirty" : "clean"}`);
  console.log(`Destination: ${DEST_SUBDIR}/GB Accounts <tax year>/<package>/\n`);

  const { complete, rejected } = discoverSource();
  console.log(`Fully formed: ${complete.length} of ${complete.length + rejected.length} package directories`);
  for (const r of rejected) console.log(`  EXCLUDED ${r.name} — ${r.reason}`);
  if (rejected.length) console.log("");

  const selected = complete.filter((p) => (!ONLY_PRODUCT || p.product === ONLY_PRODUCT) && (!ONLY_TAX_YEAR || p.taxYear === ONLY_TAX_YEAR));
  if (ONLY_PRODUCT || ONLY_TAX_YEAR) {
    console.log(
      `Filtered to ${selected.length} packages` +
        (ONLY_PRODUCT ? ` for product "${ONLY_PRODUCT}"` : "") +
        (ONLY_TAX_YEAR ? ` in tax year ${ONLY_TAX_YEAR}` : "") +
        "\n",
    );
    if (selected.length === 0) fail("the filter matched no packages");
  }

  const manifest = readManifest();
  const plan = [];
  for (const pkg of selected) {
    const digest = digestPackage(pkg.dir, pkg.files);
    const existing = manifest.get(pkg.name);
    const action = !existing ? "add" : existing.digest === digest ? "same" : "update";
    plan.push({ ...pkg, digest, action, bytes: bytesUnder(pkg.dir, pkg.files) });
  }

  const byYear = new Map();
  for (const p of plan) {
    const row = byYear.get(p.taxYear) ?? { add: 0, update: 0, same: 0, files: 0, bytes: 0 };
    row[p.action] += 1;
    row.files += p.files.length;
    row.bytes += p.bytes;
    byYear.set(p.taxYear, row);
  }

  console.log("  tax year   add  update    same   files        bytes");
  const totals = { add: 0, update: 0, same: 0, files: 0, bytes: 0 };
  for (const year of [...byYear.keys()].sort()) {
    const r = byYear.get(year);
    console.log(
      `  ${year}   ${String(r.add).padStart(3)}  ${String(r.update).padStart(6)}  ${String(r.same).padStart(6)}  ${String(r.files).padStart(6)}  ${mb(r.bytes).padStart(11)}`,
    );
    for (const k of Object.keys(totals)) totals[k] += r[k];
  }
  console.log(
    `  TOTAL      ${String(totals.add).padStart(3)}  ${String(totals.update).padStart(6)}  ${String(totals.same).padStart(6)}  ${String(totals.files).padStart(6)}  ${mb(totals.bytes).padStart(11)}\n`,
  );

  const selectedNames = new Set(selected.map((p) => p.name));
  const stale = [...manifest.values()].filter((e) => !selectedNames.has(e.dir) && !ONLY_PRODUCT && !ONLY_TAX_YEAR);
  if (stale.length) {
    console.log(`In the archive but not in this cut (left in place, never deleted): ${stale.length}`);
    for (const e of stale.slice(0, 10)) console.log(`  ${e.dir}`);
    if (stale.length > 10) console.log(`  … and ${stale.length - 10} more`);
    console.log("");
  }

  if (!APPLY) {
    console.log("Dry run. Nothing written. Re-run with --apply to copy.");
    return;
  }

  if (sourceDirty) fail("packages/ has uncommitted changes, so no commit SHA describes this cut. Commit or restore packages/ first.");
  if (totals.add + totals.update === 0) {
    console.log("Nothing to copy. The archive already holds this cut.");
    return;
  }

  let copied = 0;
  for (const p of plan) {
    if (p.action === "same") continue;
    const dest = join(ARCHIVE_ROOT, DEST_SUBDIR, `GB Accounts ${p.taxYear}`, p.name);
    // Mirror the package directory exactly: a workbook renamed upstream must not linger here.
    if (existsSync(dest)) rmSync(dest, { recursive: true });
    for (const file of p.files) {
      const target = join(dest, file);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(p.dir, file), target);
    }
    manifest.set(p.name, {
      dir: p.name,
      tax_year: p.taxYear,
      product: p.product,
      files: p.files.length,
      bytes: p.bytes,
      digest: p.digest,
      source_sha: sourceSha,
      cut: cutDate,
    });
    copied += 1;
  }

  writeManifest(manifest);
  console.log(`Copied ${copied} packages and rewrote ${DEST_SUBDIR}/${MANIFEST_NAME}.`);
  console.log("\nNothing has been committed. Review and commit in the archive repo:");
  console.log(`  cd ${ARCHIVE_ROOT}`);
  console.log(`  git status --short ${DEST_SUBDIR} | head`);
  console.log(`  git diff --stat -- ${DEST_SUBDIR}/${MANIFEST_NAME}`);
  console.log(`  node ${join(ROOT, "scripts", "archive-packages.js")} --verify`);
  console.log(`  git add ${DEST_SUBDIR}`);
  console.log(`  git commit -m "Cut published packages from spreadsheets ${sourceSha.slice(0, 8)}"`);
}

if (VERIFY) runVerify();
else runCut();
