// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// vitest-error-reporter.test.js -- runs a throwaway vitest project through
// the router's own reporter arguments and checks that a failed beforeAll hook
// reaches the output with its message and file, and that a pass stays quiet.

import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { VITEST_REPORTERS } from "../../scripts/test-scope.mjs";

const repoRoot = resolve(import.meta.dirname, "../..");
let scratch;

function runFixture(name, source) {
  const dir = join(scratch, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "vitest.config.js"), "export default {};\n");
  writeFileSync(join(dir, "case.test.js"), source);
  const run = spawnSync("npx", ["vitest", "run", "--root", dir, "--config", "vitest.config.js", ...VITEST_REPORTERS], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return { code: run.status, output: `${run.stdout}${run.stderr}` };
}

describe("router vitest reporters", () => {
  beforeAll(() => {
    mkdirSync(join(repoRoot, "target"), { recursive: true });
    scratch = mkdtempSync(join(repoRoot, "target", "reporter-fixture-"));
  });

  it("prints the message and file of a beforeAll that throws", () => {
    const { code, output } = runFixture(
      "hook",
      `import { beforeAll, it } from "vitest";
beforeAll(() => { throw new Error("libreoffice timed out after 60s"); });
it("one", () => {});
`,
    );
    expect(code).toBe(1);
    expect(output).toContain("ok 1 - case.test.js > one # SKIP");
    expect(output).toContain("libreoffice timed out after 60s");
    expect(output).toContain("case.test.js");
  }, 60000);

  it("prints a file that fails to import", () => {
    const { code, output } = runFixture(
      "import",
      `import "./does-not-exist.js";
import { it } from "vitest";
it("one", () => {});
`,
    );
    expect(code).toBe(1);
    expect(output).toContain("does-not-exist");
  }, 60000);

  it("stays silent on a pass", () => {
    const { code, output } = runFixture(
      "pass",
      `import { it, expect } from "vitest";
it("one", () => { expect(1).toBe(1); });
`,
    );
    expect(code).toBe(0);
    expect(output).not.toContain("outside any test");
  }, 60000);
});
