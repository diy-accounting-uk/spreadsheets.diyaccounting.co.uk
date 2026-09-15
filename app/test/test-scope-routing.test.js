// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// test-scope-routing.test.js — the routing table in scripts/test-scope.mjs
// is pure (no git, no subprocess), so it is exercised directly here rather
// than through the CLI. Each case is a single changed path, matching how
// CQ-36 measured the router's --plan output for the same paths.

import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  MARKER_DIR,
  PRODUCTS,
  REPRESENTATIVE_CALC,
  select,
  chooseBrowserSpecs,
  workingTreeHash,
  writeGreenMarker,
  tiersAfterGates,
} from "../../scripts/test-scope.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

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

  it("names one calc file per product, and every named file exists in the repo's test files", () => {
    expect(Object.keys(REPRESENTATIVE_CALC).sort()).toEqual([...PRODUCTS].sort());
    for (const file of Object.values(REPRESENTATIVE_CALC)) {
      expect(() => readFileSync(resolve(ROOT, file), "utf8")).not.toThrow();
    }
  });
});

describe("browser spec routing: un-tokened specs that cover multiple products", () => {
  it("chooseBrowserSpecs selects diya-gl-render-coverage for se.js changes", () => {
    const sel = select(["app/products/se.js"]);
    const allSpecs = [
      "web/browser-tests/diya-gl-render-coverage.browser.test.js",
      "web/browser-tests/diya-gl-se.browser.test.js",
      "web/browser-tests/diya-gl-bst.browser.test.js",
      "web/browser-tests/diya-gl-ltd-render-coverage.browser.test.js",
    ];
    const chosen = chooseBrowserSpecs(sel, allSpecs);
    expect(chosen).toContain("web/browser-tests/diya-gl-render-coverage.browser.test.js");
    expect(chosen).toContain("web/browser-tests/diya-gl-se.browser.test.js");
    expect(chosen).not.toContain("web/browser-tests/diya-gl-bst.browser.test.js");
    expect(chosen).not.toContain("web/browser-tests/diya-gl-ltd-render-coverage.browser.test.js");
  });

  it("chooseBrowserSpecs does not select diya-gl-render-coverage for ltd.js changes", () => {
    const sel = select(["app/products/ltd.js"]);
    const allSpecs = [
      "web/browser-tests/diya-gl-render-coverage.browser.test.js",
      "web/browser-tests/diya-gl-se.browser.test.js",
      "web/browser-tests/diya-gl-bst.browser.test.js",
      "web/browser-tests/diya-gl-ltd-render-coverage.browser.test.js",
    ];
    const chosen = chooseBrowserSpecs(sel, allSpecs);
    expect(chosen).not.toContain("web/browser-tests/diya-gl-render-coverage.browser.test.js");
    expect(chosen).toContain("web/browser-tests/diya-gl-ltd-render-coverage.browser.test.js");
    expect(chosen).not.toContain("web/browser-tests/diya-gl-se.browser.test.js");
  });
});

// CQ-46: the router stops after a failed gates tier instead of running
// unit, calc, browser and infra behind it. tiersAfterGates is the pure
// decision main() acts on; it is tested directly here rather than by
// forcing a real gates failure through a subprocess.
describe("tiersAfterGates", () => {
  it("lists only the tiers flagged to run, in tier order, excluding gates", () => {
    expect(tiersAfterGates({ unit: true, calc: false, browser: true, infra: false })).toEqual(["unit", "browser"]);
  });

  it("returns nothing when nothing after gates was going to run", () => {
    expect(tiersAfterGates({ unit: false, calc: false, browser: false, infra: false })).toEqual([]);
  });

  it("returns every tier when everything was going to run", () => {
    expect(tiersAfterGates({ unit: true, calc: true, browser: true, infra: true })).toEqual(["unit", "calc", "browser", "infra"]);
  });
});

// CQ-34: the GREEN marker .githooks/pre-push looks up before re-running a
// suite that just passed on this exact tree.
describe("writeGreenMarker", () => {
  let written = null;

  afterEach(() => {
    if (written && existsSync(written)) rmSync(written);
    written = null;
  });

  it("writes target/test-scope/green-<hash> with the base and tiers on one line", () => {
    // workingTreeHash() runs a real `git add -A` into a throwaway index,
    // which walks this repo's whole tree (examples/, packages/) and can
    // take several seconds -- the default 5s test timeout is too tight.
    const hash = writeGreenMarker({ hash: workingTreeHash(), mergeBase: "deadbeef", ranTierNames: ["gates", "unit"] });
    written = join(MARKER_DIR, `green-${hash}`);
    expect(existsSync(written)).toBe(true);
    const body = readFileSync(written, "utf8");
    expect(body).toContain("mergeBase=deadbeef");
    expect(body).toContain("tiers=gates,unit");
    expect(body.split("\n").filter(Boolean)).toHaveLength(1);
  }, 20_000);

  const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim().length > 0;

  it.skipIf(dirty)(
    "equals the rev-based hash of HEAD on a clean tree, so a marker the router writes from the working tree still matches what --tree-hash --rev HEAD (used by .githooks/pre-push) reports for the same commit",
    () => {
      // Regression case for a real bug: seeding the throwaway index empty
      // (rather than from the real index) silently dropped paths that are
      // tracked but also match .gitignore (reports/judge-verdict-*.json,
      // *.svg under web/.../diya-gl/ in this repo) and re-hashed mvnw.cmd
      // through its text-conversion filter, producing a hash that could
      // never equal HEAD^{tree} even on a perfectly clean tree. The
      // rev-based path (git read-tree) is not built through `git add -A`
      // at all, so it is not exposed to that bug the same way -- a
      // regression in the working-tree path alone still shows up here as
      // a mismatch between the two.
      const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
      expect(workingTreeHash()).toBe(workingTreeHash({ rev: headSha }));
    },
    20_000,
  );

  it("is only ever called from main() behind a GREEN verdict check, never for RED or PARTIAL", () => {
    // writeGreenMarker itself has no notion of verdict; main() is what must
    // never call it except on the GREEN branch. Asserted at the source
    // level because exercising main()'s RED/PARTIAL branches means running
    // the calc/browser/infra tiers for real, which belongs in the router's
    // own end-to-end verification, not the unit tier.
    const src = readFileSync(resolve(ROOT, "scripts/test-scope.mjs"), "utf8");
    // The assignment form, not `function writeGreenMarker(`, which would
    // match the definition rather than the call site.
    const callSite = src.indexOf("= writeGreenMarker(");
    expect(callSite).toBeGreaterThan(-1);
    const guard = src.slice(Math.max(0, callSite - 120), callSite);
    expect(guard).toMatch(/verdict === "GREEN"/);
  });
});

// CQ-40: test.yml's green-check job hashes a commit with workingTreeHash({
// withoutDocs: true }) so a docs-only diff between a PR's merge ref and the
// merge commit later pushed to main (NEXT.md board lines, landed on main
// directly under the docs exception) hashes the same and reuses one GREEN
// record instead of paying for the suite twice.
describe("workingTreeHash({ withoutDocs: true })", () => {
  const rootDoc = join(ROOT, "cq-40-scratch.md");
  const nestedDoc = join(ROOT, "app", "test", "cq-40-scratch-nested.md");

  afterEach(() => {
    for (const f of [rootDoc, nestedDoc]) if (existsSync(f)) rmSync(f);
  });

  it("prints a 40-hex hash, the same shape as --tree-hash", () => {
    expect(workingTreeHash({ withoutDocs: true })).toMatch(/^[0-9a-f]{40}$/);
  }, 20_000);

  it("holds the hash steady across a root and a nested Markdown file, but not a non-Markdown one", () => {
    const docsBefore = workingTreeHash({ withoutDocs: true });
    const plainBefore = workingTreeHash();

    writeFileSync(rootDoc, "scratch\n");
    writeFileSync(nestedDoc, "scratch\n");
    const docsAfterMd = workingTreeHash({ withoutDocs: true });
    const plainAfterMd = workingTreeHash();
    expect(docsAfterMd).toBe(docsBefore);
    expect(plainAfterMd).not.toBe(plainBefore);

    rmSync(rootDoc);
    rmSync(nestedDoc);
    writeFileSync(rootDoc.replace(/\.md$/, ".txt"), "scratch\n");
    try {
      const docsAfterTxt = workingTreeHash({ withoutDocs: true });
      expect(docsAfterTxt).not.toBe(docsBefore);
    } finally {
      rmSync(rootDoc.replace(/\.md$/, ".txt"));
    }
  }, 30_000);
});
