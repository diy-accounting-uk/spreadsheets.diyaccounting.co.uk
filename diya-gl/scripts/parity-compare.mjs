#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// parity-compare.mjs — one product's report.json and bookchecks.json,
// compared against a committed fixture. Every byte of both files must
// match except report.json's whole provenance object: a generate
// workflow's commit job refreshes provenance-data.js with every package
// build (build-provenance-data.mjs --reconciled-commit), so all five
// stamps -- format version, engine version, tax-data hash, template hash
// and scorecard, reconciled commit -- move on an ordinary run that changes
// none of the figures this gate exists to check. The stamps' own
// correctness is proven by app/test/provenance.test.js and the
// diya-gl-equivalence specs, not by this gate. Comparing through a JSON
// parse-and-reserialise (rather than a text substitution) means a change
// to any other value anywhere in the document -- however deeply nested,
// however the stamps themselves are shaped -- still fails the gate.
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

// The same 2-space-indented, newline-terminated form report-serializer.js
// writes report.json in, so parsing out the provenance object and putting
// the placeholder back leaves every other byte exactly as report.json's
// own writer produced it.
function normalisedReport(path) {
  const document = JSON.parse(readFileSync(path, "utf8"));
  document.provenance = "<normalised>";
  return `${JSON.stringify(document, null, 2)}\n`;
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

console.log(`${label}: report.json and bookchecks.json match the committed fixture byte for byte (provenance excepted)`);
