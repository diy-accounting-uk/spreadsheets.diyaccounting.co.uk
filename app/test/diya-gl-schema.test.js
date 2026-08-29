// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-schema.test.js — Holds the published lines schema to what the
// example books actually carry. Every lines.jsonl under examples/ is
// validated against it, so a field or a code letter added to a fixture
// without being added to the schema fails here rather than being discovered
// by whoever downloads the schema and tries to validate their own book.

import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const EXAMPLES_DIR = resolve(ROOT, "examples");
const SCHEMA_PATH = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "schema", "diya-gl-lines-v1.schema.json");

// The bundled validator predates the 2020-12 draft the schema declares. Every
// keyword the schema uses is draft-07 too, so dropping the meta-schema
// reference is what lets it compile; nothing in the schema body changes.
function compileLinesSchema() {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  delete schema.$schema;
  return new Ajv({ allErrors: true, format: "full" }).compile(schema);
}

function findLinesFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...findLinesFiles(path));
    else if (entry === "lines.jsonl") found.push(path);
  }
  return found.sort();
}

function readLines(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

const linesFiles = findLinesFiles(EXAMPLES_DIR);

describe("diya-gl lines schema", () => {
  const validate = compileLinesSchema();

  it("finds the example books to validate", () => {
    expect(linesFiles.length).toBeGreaterThan(0);
    expect(linesFiles.map((path) => relative(ROOT, path))).toContain("examples/precision-code-ltd/lines.jsonl");
  });

  it.each(linesFiles.map((path) => [relative(ROOT, path), path]))("validates %s", (_name, path) => {
    const failures = [];
    readLines(path).forEach((line, index) => {
      if (!validate(line)) {
        failures.push(`line ${index + 1} (${line.entryNumber}): ${validate.errors.map((e) => `${e.dataPath} ${e.message}`).join("; ")}`);
      }
    });
    expect(failures).toEqual([]);
  });

  // The two ways a fixture drifts away from the schema: a new extension field
  // that additionalProperties would reject, and a code letter outside an
  // enum. Both have to bite for the sweep above to mean anything.
  it("rejects an extension field the schema does not declare", () => {
    const line = { ...readLines(linesFiles[0])[0], "diya-gl:notAField": "x" };
    expect(validate(line)).toBe(false);
  });

  it("rejects a bank code outside the analysis columns", () => {
    const banked = readLines(resolve(EXAMPLES_DIR, "precision-code-ltd", "lines.jsonl")).find((l) => l["diya-gl:bankCode"]);
    expect(validate({ ...banked, "diya-gl:bankCode": "ZZ" })).toBe(false);
    expect(validate(banked)).toBe(true);
  });

  // Every letter the Company and Self Employed bank workbooks analyse, and
  // every field the example books carry, has to be in the schema. Listing
  // them here is what makes a schema that quietly loses one fail.
  it("declares every bank code the bank workbooks analyse", () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    const declared = new Set(schema.properties["diya-gl:bankCode"].enum);
    for (const code of ["BB", "BS", "BC", "BD", "DR", "CR", "K", "LDR", "LCR", "RV", "RC", "RT", "RP", "W", "B", "J", "DV", "DL", "X"]) {
      expect(declared, code).toContain(code);
    }
  });

  it("declares every field the example books carry", () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    const declared = new Set(Object.keys(schema.properties));
    const used = new Set();
    for (const path of linesFiles) for (const line of readLines(path)) for (const key of Object.keys(line)) used.add(key);
    expect([...used].filter((key) => !declared.has(key))).toEqual([]);
  });
});
