// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// export.js's --file mode over a Company package: examples/ltd-latest, the
// committed thirteen-workbook package, zipped flat the way a customer's own
// download ships it. The harness follows export-file.test.js's own helpers
// (run, runExpectingFailure, tempDir, packageZipOf) rather than restating
// them differently for Ltd.
//
// No LibreOffice: every cached cell value here is read as-is, the way
// --source-dir already reads the same package.

import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "child_process";
import JSZip from "jszip";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync, cpSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const NODE = process.execPath;
const LTD_SOURCE_DIR = resolve(ROOT, "examples", "ltd-latest");

const tempDirs = [];
function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

function run(args) {
  return execFileSync(NODE, args, { cwd: ROOT, encoding: "utf8" });
}

function runExpectingFailure(args) {
  try {
    run(args);
    throw new Error("expected export.js to exit non-zero");
  } catch (err) {
    if (err.status === undefined) throw err; // not the execFileSync failure we're after
    return err;
  }
}

// A multi-file package zipped flat, the way a customer's own download ships
// it -- every workbook in the directory, at the zip root. `skip` leaves one
// workbook out, the shape a customer's own incomplete upload takes.
async function packageZipOf(dir, zipPath, skip) {
  const zip = new JSZip();
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".xlsx") && file !== skip)) {
    zip.file(name, readFileSync(resolve(dir, name)));
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(zipPath, buffer);
  return zipPath;
}

describe("export.js --file mode: a Company package", () => {
  it("reads the ltd-latest package zip to the same book.toml and lines.jsonl as --source-dir, and writes report.json and bookchecks.json alongside them", async () => {
    const zipPath = await packageZipOf(LTD_SOURCE_DIR, resolve(tempDir("export-file-ltd-zip-"), "ltd-package.zip"));

    const sourceDirOutput = tempDir("export-file-ltd-source-out-");
    run(["app/bin/export.js", "--package", "ltd", "--source-dir", LTD_SOURCE_DIR, "--output-dir", sourceDirOutput]);

    const fileOutput = tempDir("export-file-ltd-file-out-");
    run(["app/bin/export.js", "--package", "ltd", "--file", zipPath, "--output-dir", fileOutput]);

    // The two files --source-dir also writes, byte for byte.
    expect(readFileSync(resolve(fileOutput, "book.toml")).equals(readFileSync(resolve(sourceDirOutput, "book.toml")))).toBe(true);
    expect(readFileSync(resolve(fileOutput, "lines.jsonl")).equals(readFileSync(resolve(sourceDirOutput, "lines.jsonl")))).toBe(true);

    // The two files only --file writes.
    expect(existsSync(resolve(fileOutput, "report.json"))).toBe(true);
    expect(existsSync(resolve(fileOutput, "bookchecks.json"))).toBe(true);

    // The fifth file, overtyped.json, does not exist for a Company package
    // yet -- see the test below.
    expect(existsSync(resolve(fileOutput, "overtyped.json"))).toBe(false);

    const document = JSON.parse(readFileSync(resolve(fileOutput, "report.json"), "utf8"));
    expect(document.package).toBe("ltd");
    expect(document.engine).toBe("js");
    expect(document.values.some((entry) => entry.key.startsWith("check/"))).toBe(true);
  }, 30000);

  // The overtype sidecar (app/lib/overtype-sidecar.js) has a bst, se and
  // taxi branch in diya-gl-interchange.js's readWorkbookSource -- no ltd
  // branch exists yet, so source.overtyped is never set for a Company
  // package and export.js's `if (overtyped) writeOvertypedJson(...)` never
  // runs. This asserts that reality rather than the sidecar's eventual
  // shape (keys of the form file!sheet!cell, empty for a pristine package),
  // which cannot be true until diya-gl-interchange.js grows that branch.
  it("writes no overtyped.json for a Company package, since the Ltd overtype sidecar has no branch in readWorkbookSource yet", async () => {
    const zipPath = await packageZipOf(LTD_SOURCE_DIR, resolve(tempDir("export-file-ltd-overtyped-zip-"), "ltd-package.zip"));

    const outputDir = tempDir("export-file-ltd-overtyped-out-");
    run(["app/bin/export.js", "--package", "ltd", "--file", zipPath, "--output-dir", outputDir]);

    expect(existsSync(resolve(outputDir, "overtyped.json"))).toBe(false);
  }, 30000);

  it("rejects a lone Financialaccounts.xlsx, naming it and directing the customer to the package zip", () => {
    const xlsxPath = resolve(tempDir("export-file-ltd-lone-"), "Financialaccounts.xlsx");
    cpSync(resolve(LTD_SOURCE_DIR, "Financialaccounts.xlsx"), xlsxPath);

    const err = runExpectingFailure(["app/bin/export.js", "--package", "ltd", "--file", xlsxPath]);

    expect(err.status).toBe(1);
    expect(err.stderr).toContain('"Financialaccounts.xlsx"');
    expect(err.stderr).toContain("is the hub workbook of a multi-file Company package");
    expect(err.stderr).toContain("upload the package zip");
    expect(existsSync(resolve(dirname(xlsxPath), "book.toml"))).toBe(false);
  }, 30000);

  it("rejects a package zip missing Payslips.xlsx, failing the anchor guard and naming the file", async () => {
    const zipPath = await packageZipOf(
      LTD_SOURCE_DIR,
      resolve(tempDir("export-file-ltd-missing-zip-"), "ltd-package.zip"),
      "Payslips.xlsx",
    );

    const err = runExpectingFailure(["app/bin/export.js", "--package", "ltd", "--file", zipPath]);

    expect(err.status).toBe(1);
    expect(err.stderr).toContain("This file does not match the current Limited Company template");
    expect(err.stderr).toContain('file "Payslips.xlsx" not found in the package');
  }, 30000);
});
