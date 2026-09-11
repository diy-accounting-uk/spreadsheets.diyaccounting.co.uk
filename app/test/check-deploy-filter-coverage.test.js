// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// check-deploy-filter-coverage.test.js — the matcher against GitHub's own
// documented examples (Workflow syntax for GitHub Actions, "Patterns to
// match file paths"), then the real tree: deploy.yml's push paths filter
// must cover everything scripts/build-diya-gl-bundle.mjs reads, and this
// scanner must actually go blind loudly (an "unresolved" line), never
// silently, on the handful of call sites it cannot follow statically.
//
// A gate nobody has watched fail is not a gate (CQ-17): the last suite here
// mutates a scratch copy of deploy.yml, removes a pattern, and asserts the
// checker names exactly the call sites that pattern was covering.

import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  checkCoverage,
  extractSources,
  isCovered,
  matchesPattern,
  parseDeployPushPaths,
} from "../../scripts/check-deploy-filter-coverage.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const DEPLOY_YML = resolve(ROOT, ".github", "workflows", "deploy.yml");
const BUNDLE_SCRIPT = resolve(ROOT, "scripts", "build-diya-gl-bundle.mjs");

describe("patternToRegExp / matchesPattern", () => {
  // Every row is taken from GitHub's own "Patterns to match file paths"
  // cheat sheet, not guessed: a pattern without "**" never crosses a "/",
  // "**" crosses freely, and "**/" also collapses to zero path segments.
  const cases = [
    ["*", "README.md", true],
    ["*", "docs/README.md", false],
    ["*.jsx?", "page.js", true],
    ["*.jsx?", "page.jsx", true],
    ["**", "all/the/files.md", true],
    ["*.js", "app.js", true],
    ["*.js", "js/index.js", false], // *.js is root-only: * never crosses "/"
    ["**.js", "index.js", true],
    ["**.js", "js/index.js", true], // "**.js" has no "/" yet still crosses one
    ["**.js", "src/js/app.js", true],
    ["docs/*", "docs/README.md", true],
    ["docs/*", "docs/mona/octocat.txt", false], // docs/* is one level only
    ["docs/**", "docs/mona/octocat.txt", true],
    ["docs/**/*.md", "docs/README.md", true], // "**/" also matches zero segments
    ["docs/**/*.md", "docs/a/markdown/file.md", true],
    ["**/docs/**", "dir/docs/my-file.txt", true],
    ["**/README.md", "README.md", true],
    ["**/README.md", "js/README.md", true],
    ["**/*src/**", "my-src/code/js/app.js", true],
    ["**/migrate-*.sql", "db/sept/migrate-v1.sql", true],
    // the two cases the brief calls out explicitly
    ["app/data/**", "app/data/filing/ct600-v3.toml", true],
    ["app/lib/**", "app/test/calculator-ltd.test.js", false],
    // this repo's own deploy.yml patterns, both directions
    ["**/cdk.json", "cdk.json", true],
    ["**/cdk.json", "cdk-spreadsheets/cdk.json", true],
    ["LICENSE", "LICENSE", true],
    ["LICENSE", "sub/LICENSE", false], // a bare literal is a whole-path match, not any-depth
  ];

  for (const [pattern, path, expected] of cases) {
    it(`${JSON.stringify(pattern)} ${expected ? "matches" : "does not match"} ${JSON.stringify(path)}`, () => {
      expect(matchesPattern(path, pattern)).toBe(expected);
    });
  }
});

describe("isCovered", () => {
  it("matches against any pattern in the list", () => {
    expect(isCovered("app/data/ltd-2027.toml", ["web/**", "app/data/**"])).toBe(true);
    expect(isCovered("app/bin/report.js", ["web/**", "app/data/**"])).toBe(false);
  });

  it("lets a later negative pattern exclude an earlier positive match", () => {
    expect(isCovered("docs/hello.md", ["docs/**", "!docs/hello.md"])).toBe(false);
  });

  it("lets a later positive pattern re-include what a negative pattern excluded", () => {
    expect(isCovered("README.md", ["*.md", "!README.md", "README*"])).toBe(true);
  });
});

describe("parseDeployPushPaths", () => {
  it("reads deploy.yml's on.push.paths list", () => {
    const patterns = parseDeployPushPaths(readFileSync(DEPLOY_YML, "utf8"));
    expect(patterns).toContain("app/data/**");
    expect(patterns).toContain("app/lib/**");
    expect(patterns).toContain("scripts/build-diya-gl-bundle.mjs");
  });

  it("throws if the paths list is missing", () => {
    expect(() => parseDeployPushPaths("on:\n  push:\n    branches: [main]\n")).toThrow();
  });
});

describe("extractSources against the real build-diya-gl-bundle.mjs", () => {
  const { items, unresolved } = extractSources(BUNDLE_SCRIPT, ROOT);

  it("finds the copy-pipeline, own-import and esbuild-closure call sites", () => {
    expect(items.length).toBeGreaterThan(60); // the ~56-file diya-gl-engine.js closure dwarfs the rest
    expect(items.some((i) => i.probe.startsWith("app/data/"))).toBe(true);
    expect(items.some((i) => i.probe === "app/lib/diya-gl-schema.js")).toBe(true); // its own import
    expect(items.some((i) => i.probe === "app/lib/diya-gl-engine.js")).toBe(true); // the entry point itself
  });

  it("names exactly the call sites it cannot resolve statically, rather than dropping them", () => {
    // These four are the PWA precache manifest re-reading its own already-copied
    // output (a function parameter, not a resolve() chain) -- if this list ever
    // grows, a real generator source may have become unresolvable too, silently.
    const calls = unresolved.map((u) => u.call).sort();
    expect(calls).toEqual(["readFileSync(cssPath)", "readFileSync(htmlPath)", "readFileSync(urlToPath(url))", "readdirSync(dir)"]);
  });

  it("routes a node_modules read through package-lock.json, since node_modules is never a diffable path", () => {
    const jszip = items.find((i) => i.label.includes("jszip"));
    expect(jszip.probe).toBe("package-lock.json");
  });
});

describe("checkCoverage against the real tree", () => {
  it("finds no gap: deploy.yml's filter covers everything the bundle script reads", () => {
    const { gaps } = checkCoverage({ deployYmlText: readFileSync(DEPLOY_YML, "utf8"), bundleScriptPath: BUNDLE_SCRIPT, repoRoot: ROOT });
    expect(gaps).toEqual([]);
  });
});

describe("checkCoverage proves it actually fails", () => {
  function withPatternRemoved(pattern) {
    const text = readFileSync(DEPLOY_YML, "utf8");
    const line = `      - '${pattern}'\n`;
    if (!text.includes(line)) throw new Error(`fixture assumption broke: deploy.yml no longer has the line ${JSON.stringify(line)}`);
    return text.replace(line, "");
  }

  it("names exactly the app/data call sites when app/data/** is removed", () => {
    const { gaps } = checkCoverage({ deployYmlText: withPatternRemoved("app/data/**"), bundleScriptPath: BUNDLE_SCRIPT, repoRoot: ROOT });
    const gapLines = gaps.map((g) => g.label);
    // Matched on the call, not on its line: the line number moves whenever
    // anything above it in the bundle script grows, which says nothing about
    // whether the gap was found.
    expect(gapLines.some((l) => l.includes("readdirSync(app/data)"))).toBe(true);
    expect(gapLines.some((l) => l.includes("cpSync(app/data/hmrc/form-layouts)"))).toBe(true);
    expect(gapLines.some((l) => l.includes("cpSync(app/data/filing)"))).toBe(true);
    // nothing outside app/data should have broken
    expect(gaps.every((g) => g.probe.startsWith("app/data/"))).toBe(true);
  });

  it("names the vendored jszip call site when package-lock.json is removed", () => {
    const { gaps } = checkCoverage({
      deployYmlText: withPatternRemoved("package-lock.json"),
      bundleScriptPath: BUNDLE_SCRIPT,
      repoRoot: ROOT,
    });
    expect(gaps).toHaveLength(1);
    expect(gaps[0].label).toContain("jszip");
    expect(gaps[0].note).toContain("package-lock.json");
  });

  it("names every closed-over app/lib file when app/lib/** is removed", () => {
    const { gaps } = checkCoverage({ deployYmlText: withPatternRemoved("app/lib/**"), bundleScriptPath: BUNDLE_SCRIPT, repoRoot: ROOT });
    expect(gaps.length).toBeGreaterThan(40);
    expect(gaps.some((g) => g.probe === "app/lib/diya-gl-calculator.js")).toBe(true);
  });
});

describe("the CLI itself, run as a subprocess", () => {
  it("exits 0 on the real tree", () => {
    // Throws (non-zero exit) if the gate fails -- that's the assertion.
    execFileSync("node", [resolve(ROOT, "scripts", "check-deploy-filter-coverage.mjs")], { cwd: ROOT });
  });

  it("exits non-zero and names the gap on a scratch copy missing app/data/**", () => {
    const dir = mkdtempSync(join(tmpdir(), "cq17-deploy-filter-"));
    const scratchYml = join(dir, "deploy.yml");
    try {
      const text = readFileSync(DEPLOY_YML, "utf8").replace("      - 'app/data/**'\n", "");
      writeFileSync(scratchYml, text);
      let threw = null;
      let output = "";
      try {
        output = execFileSync("node", [resolve(ROOT, "scripts", "check-deploy-filter-coverage.mjs"), "--deploy-yml", scratchYml], {
          cwd: ROOT,
          encoding: "utf8",
        });
      } catch (err) {
        threw = err;
        output = `${err.stdout || ""}${err.stderr || ""}`;
      }
      expect(threw).not.toBeNull();
      expect(threw.status).toBe(1);
      expect(output).toContain("readdirSync(app/data)");
      expect(output).toContain("cpSync(app/data/filing)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
