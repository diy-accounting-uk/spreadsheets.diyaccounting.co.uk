// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-spec-page.test.js — the published format spec page is the one the
// generator builds today, and it names every field the two schemas declare.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildDiyaGlSpecHtml } from "../bin/build-diya-gl-spec.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const PUBLIC_DIR = resolve(REPO_ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public");

const published = readFileSync(resolve(PUBLIC_DIR, "diya-gl.html"), "utf8");

function fieldNames(schemaFile) {
  const schema = JSON.parse(readFileSync(resolve(PUBLIC_DIR, "schema", schemaFile), "utf8"));
  const names = [];
  const walk = (node) => {
    for (const [key, child] of Object.entries(node.properties || {})) {
      names.push(key);
      const resolved = child.$ref ? schema.$defs[child.$ref.replace("#/$defs/", "")] : child;
      if (resolved.properties) walk(resolved);
      const items = resolved.items && resolved.items.$ref ? schema.$defs[resolved.items.$ref.replace("#/$defs/", "")] : resolved.items;
      if (items && items.properties) walk(items);
    }
  };
  walk(schema);
  return names;
}

describe("the diya-gl spec page", () => {
  it("is the page the generator builds from the schemas, the mappings and the checks", () => {
    expect(buildDiyaGlSpecHtml()).toBe(published);
  });

  it("names every field the book schema declares", () => {
    for (const field of fieldNames("diya-gl-book-v2.schema.json")) {
      expect(published, `book schema field ${field} is missing from the page`).toContain(`${field}<`);
    }
  });

  it("names every field the lines schema declares", () => {
    for (const field of fieldNames("diya-gl-lines-v2.schema.json")) {
      expect(published, `lines schema field ${field} is missing from the page`).toContain(`${field}<`);
    }
  });
});
