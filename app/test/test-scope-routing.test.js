// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// test-scope-routing.test.js — the routing table in scripts/test-scope.mjs
// is pure (no git, no subprocess), so it is exercised directly here rather
// than through the CLI. Each case is a single changed path, matching how
// CQ-36 measured the router's --plan output for the same paths.

import { describe, it, expect } from "vitest";
import { PRODUCTS, REPRESENTATIVE_CALC, select } from "../../scripts/test-scope.mjs";

describe("routing table: docs, skills, lockfile, dependency and router-script paths", () => {
  it("adds nothing for a root markdown file", () => {
    const sel = select(["CLAUDE.md"]);
    expect(sel.calcProducts.size).toBe(0);
    expect(sel.calcRepProducts.size).toBe(0);
    expect(sel.browserAll).toBe(false);
    expect(sel.infra).toBe(false);
    expect(sel.unitAll).toBe(false);
  });

  it("adds nothing for a skill file under .claude/", () => {
    const sel = select([".claude/skills/do-next/SKILL.md"]);
    expect(sel.calcProducts.size).toBe(0);
    expect(sel.calcRepProducts.size).toBe(0);
    expect(sel.browserAll).toBe(false);
    expect(sel.infra).toBe(false);
    expect(sel.unitAll).toBe(false);
  });

  it("forces the full unit tier for package-lock.json, and nothing else", () => {
    const sel = select(["package-lock.json"]);
    expect(sel.unitAll).toBe(true);
    expect(sel.unitAllReasons).toEqual(["lockfile"]);
    expect(sel.calcProducts.size).toBe(0);
    expect(sel.calcRepProducts.size).toBe(0);
    expect(sel.browserAll).toBe(false);
    expect(sel.infra).toBe(false);
  });

  it("keeps package.json escalating every tier", () => {
    const sel = select(["package.json"]);
    expect([...sel.calcProducts].sort()).toEqual([...PRODUCTS].sort());
    expect(sel.browserAll).toBe(true);
    expect(sel.infra).toBe(true);
  });

  it("narrows the router's own file to one representative calc file per product", () => {
    const sel = select(["scripts/test-scope.mjs"]);
    expect(sel.calcProducts.size).toBe(0);
    expect([...sel.calcRepProducts].sort()).toEqual([...PRODUCTS].sort());
    expect(sel.browserAll).toBe(false);
    expect(sel.infra).toBe(false);
  });

  it("adds nothing for a root markdown file other than CLAUDE.md", () => {
    const sel = select(["README.md"]);
    expect(sel.calcProducts.size).toBe(0);
    expect(sel.calcRepProducts.size).toBe(0);
    expect(sel.browserAll).toBe(false);
    expect(sel.infra).toBe(false);
    expect(sel.unitAll).toBe(false);
  });

  it("names one calc file per product, and every named file exists in the repo's test files", async () => {
    const { readFileSync } = await import("fs");
    const { resolve, dirname } = await import("path");
    const { fileURLToPath } = await import("url");
    const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
    expect(Object.keys(REPRESENTATIVE_CALC).sort()).toEqual([...PRODUCTS].sort());
    for (const file of Object.values(REPRESENTATIVE_CALC)) {
      expect(() => readFileSync(resolve(ROOT, file), "utf8")).not.toThrow();
    }
  });
});
