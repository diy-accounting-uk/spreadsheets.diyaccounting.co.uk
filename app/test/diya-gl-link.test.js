// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-link.test.js — a whole book survives the trip into a URL fragment
// and back, the fragment stays near its measured size, a large book earns the
// length warning, and the CLI prints a link whose fragment decodes to the
// book it was given.

import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { encodeBookFragment, decodeBookFragment, WARNING_LENGTH } from "../lib/diya-gl-link.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LINK_CLI = resolve(ROOT, "app", "bin", "link.js");

function readExample(dir) {
  return {
    toml: readFileSync(resolve(ROOT, "examples", dir, "book.toml"), "utf8"),
    lines: readFileSync(resolve(ROOT, "examples", dir, "lines.jsonl"), "utf8"),
  };
}

const MEASURED = [
  { dir: "basic-taxi-driver", length: 4000 },
  { dir: "sp-sixty-driving", length: 6500 },
  { dir: "precision-code-ltd", length: 23300 },
];

describe("diya-gl link fragment", () => {
  for (const { dir, length } of MEASURED) {
    it(`round-trips ${dir} within 20% of its measured length`, () => {
      const book = readExample(dir);
      const encoded = encodeBookFragment(book);
      expect(decodeBookFragment(encoded.fragment)).toEqual(book);
      expect(encoded.length).toBe(encoded.fragment.length);
      expect(encoded.length).toBeGreaterThan(length * 0.8);
      expect(encoded.length).toBeLessThan(length * 1.2);
      expect(encoded.warning).toBeNull();
    });
  }

  it("writes base64url without padding", () => {
    expect(encodeBookFragment(readExample("basic-taxi-driver")).fragment).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("warns when the fragment passes 64 KB, and only then", () => {
    const { toml } = readExample("basic-taxi-driver");
    const lines = Array.from({ length: 3000 }, (_, i) =>
      JSON.stringify({ entry: i, ref: Math.random().toString(36).slice(2), amount: Math.random() * 1e6 }),
    ).join("\n");
    const large = encodeBookFragment({ toml, lines });
    expect(large.length).toBeGreaterThan(WARNING_LENGTH);
    expect(large.warning).toContain("64 KB");
    expect(encodeBookFragment(readExample("basic-taxi-driver")).warning).toBeNull();
  });

  it("refuses a fragment that is not base64url", () => {
    expect(() => decodeBookFragment("not base64!")).toThrow(/base64url/);
  });

  it("refuses an encoded book without both texts", () => {
    expect(() => encodeBookFragment({ toml: "x" })).toThrow(/toml/);
  });
});

describe("diya-gl link CLI", () => {
  it("prints the product page URL whose fragment decodes to the directory's book", () => {
    const book = readExample("sp-sixty-driving");
    const output = execFileSync(process.execPath, [LINK_CLI, resolve(ROOT, "examples", "sp-sixty-driving")], { encoding: "utf8" }).trim();
    const [page, fragment] = output.split("#book=");
    expect(page).toBe("https://diya-gl.co.uk/taxi.html");
    expect(decodeBookFragment(fragment)).toEqual(book);
  });

  it("takes the origin from --base and the product page from the book", () => {
    const output = execFileSync(
      process.execPath,
      [LINK_CLI, resolve(ROOT, "examples", "precision-code-ltd"), "--base", "http://localhost:8080/"],
      { encoding: "utf8" },
    ).trim();
    expect(output.startsWith("http://localhost:8080/ltd.html#book=")).toBe(true);
  });

  it("names a missing book", () => {
    expect(() => execFileSync(process.execPath, [LINK_CLI, "no-such-book"], { encoding: "utf8", stdio: "pipe" })).toThrow(/does not exist/);
  });
});
