// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-docs-examples.test.js — Validate that JSON examples in the schema
// documentation conform to the published v2 JSON Schema.

import { describe, it, expect } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const SCHEMA_DIR = resolve(PROJECT_ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "schema");
const DOCS_FILE = resolve(SCHEMA_DIR, "diya-gl-docs.md");

function loadSchema(fileName) {
  return JSON.parse(readFileSync(resolve(SCHEMA_DIR, fileName), "utf8"));
}

const linesSchema = loadSchema("diya-gl-lines-v2.schema.json");
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validateLineSchema = ajv.compile(linesSchema);

/**
 * Extract all JSON code blocks from the markdown file that are transaction
 * examples (not schema definitions). Returns an array of
 * { json: string, lineNumber: number } objects.
 */
function extractJsonExamples(markdown) {
  const examples = [];
  const lines = markdown.split("\n");
  let inJsonBlock = false;
  let jsonLines = [];
  let blockStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.match(/^```json\s*$/)) {
      inJsonBlock = true;
      blockStartLine = i + 1;
      jsonLines = [];
    } else if (line.match(/^```\s*$/) && inJsonBlock) {
      inJsonBlock = false;
      const json = jsonLines.join("\n").trim();
      if (json) {
        let parsed;
        try {
          parsed = JSON.parse(json);
        } catch {
          // Skip invalid JSON
          return;
        }
        // Skip schema definitions (they have $schema property)
        // Only extract transaction examples
        if (!parsed.$schema) {
          examples.push({
            json,
            lineNumber: blockStartLine,
          });
        }
      }
    } else if (inJsonBlock) {
      jsonLines.push(line);
    }
  }

  return examples;
}

describe("diya-gl-docs.md examples", () => {
  const markdown = readFileSync(DOCS_FILE, "utf8");
  const examples = extractJsonExamples(markdown);

  it("should extract at least one example", () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  examples.forEach((example, idx) => {
    it(`example ${idx + 1} at line ${example.lineNumber} should be valid JSON`, () => {
      let parsed;
      expect(() => {
        parsed = JSON.parse(example.json);
      }).not.toThrow();
    });

    it(`example ${idx + 1} at line ${example.lineNumber} should validate against diya-gl-lines-v2.schema.json`, () => {
      let parsed;
      try {
        parsed = JSON.parse(example.json);
      } catch (e) {
        throw new Error(`Failed to parse example at line ${example.lineNumber}: ${e.message}`);
      }

      const valid = validateLineSchema(parsed);
      if (!valid) {
        const errors = validateLineSchema.errors
          .map((e) => `  ${e.instancePath || "/"} ${e.message}`)
          .join("\n");
        throw new Error(
          `Example at line ${example.lineNumber} does not validate:\n${errors}\n\nJSON:\n${example.json}`
        );
      }
    });
  });
});
