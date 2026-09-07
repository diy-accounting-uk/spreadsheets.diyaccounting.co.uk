#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// parity-compare.mjs — one product's report.json and bookchecks.json,
// compared byte for byte against a committed fixture. The only thing
// normalised is report.json's provenance.engineVersion: the one stamp that
// changes on every commit by construction (the package version plus the
// short commit hash). The other four stamps, and everything in
// bookchecks.json, only change when a deliberate edit moves them -- tax
// data, a template, the reconciled-commit hook, or the figures themselves
// -- which is exactly when the fixture is meant to be refreshed too
// (`npm run parity:refresh`), not silently allowed through.
//
// Usage: node parity-compare.mjs <expectedDir> <actualDir> <label>

import { readFileSync, writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { spawnSync } from "child_process";

const [, , expectedDir, actualDir, label] = process.argv;
if (!expectedDir || !actualDir || !label) {
  console.error("Usage: node parity-compare.mjs <expectedDir> <actualDir> <label>");
  process.exit(1);
}

const ENGINE_VERSION = /("engineVersion":\s*")[^"]*(")/;

function normalisedReport(path) {
  return readFileSync(path, "utf8").replace(ENGINE_VERSION, "$1<normalised>$2");
}

function reportDiff(name, expectedText, actualText) {
  const dir = mkdtempSync(join(tmpdir(), "diya-gl-parity-"));
  const expectedFile = join(dir, "expected");
  const actualFile = join(dir, "actual");
  writeFileSync(expectedFile, expectedText);
  writeFileSync(actualFile, actualText);
  const result = spawnSync("diff", ["-u", "--label", `expected/${name}`, "--label", `actual/${name}`, expectedFile, actualFile], {
    encoding: "utf8",
  });
  return result.stdout;
}

function compare(name, expectedText, actualText) {
  if (expectedText === actualText) return true;
  console.error(`${label}: ${name} does not match examples/parity/${label}/${name}`);
  console.error(reportDiff(name, expectedText, actualText));
  return false;
}

const reportOk = compare(
  "report.json",
  normalisedReport(resolve(expectedDir, "report.json")),
  normalisedReport(resolve(actualDir, "report.json")),
);
const checksOk = compare(
  "bookchecks.json",
  readFileSync(resolve(expectedDir, "bookchecks.json"), "utf8"),
  readFileSync(resolve(actualDir, "bookchecks.json"), "utf8"),
);

if (!reportOk || !checksOk) {
  console.error(`\n${label}: parity gate failed. If this change is deliberate, run \`npm run parity:refresh\` and commit the result.`);
  process.exit(1);
}

console.log(`${label}: report.json and bookchecks.json match the committed fixture byte for byte (engineVersion excepted)`);
