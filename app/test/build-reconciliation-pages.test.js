// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { parseReport, renderFrontMatter } from "../bin/build-reconciliation-pages.js";

const FIXTURE_REPORT = `# Reconciliation Report: GB Accounts Company 2026-03-31 (Mar26) Excel 2007

Scenario: ltd-scenario-full
Status: RECONCILES

Full Ltd-scoped extract from Precision Code Ltd master data. All journals, all accounts.

Trade: IT consultancy and software development

## Compliance Checks

| Check | Expected | Actual | Diff | Result |
|-------|----------|--------|------|--------|
| Total Sales | 100 | 100 | 0 | PASS |
`;

describe("parseReport", () => {
  let workDir;

  afterEach(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  it("carries the text before the first heading as front matter", () => {
    workDir = mkdtempSync(join(tmpdir(), "recon-report-"));
    const path = join(workDir, "report.md");
    writeFileSync(path, FIXTURE_REPORT);

    const report = parseReport(path);

    expect(report.title).toBe("Reconciliation Report: GB Accounts Company 2026-03-31 (Mar26) Excel 2007");
    expect(report.scenario).toBe("ltd-scenario-full");
    expect(report.status).toBe("RECONCILES");
    expect(report.frontMatter).toEqual([
      "Full Ltd-scoped extract from Precision Code Ltd master data. All journals, all accounts.",
      "Trade: IT consultancy and software development",
    ]);
    expect(report.sections).toHaveLength(1);
    expect(report.sections[0].name).toBe("Compliance Checks");
  });

  it("leaves front matter empty when the report has none", () => {
    workDir = mkdtempSync(join(tmpdir(), "recon-report-"));
    const path = join(workDir, "report.md");
    writeFileSync(path, "# Title\n\nScenario: x\nStatus: RECONCILES\n\n## Compliance Checks\n\n| A |\n|---|\n| 1 |\n");

    const report = parseReport(path);

    expect(report.frontMatter).toEqual([]);
  });
});

describe("renderFrontMatter", () => {
  it("renders the scenario description above the rest of the page", () => {
    const html = renderFrontMatter({
      frontMatter: ["Full Ltd-scoped extract from Precision Code Ltd master data.", "Trade: IT consultancy and software development"],
    });

    expect(html).toContain("Full Ltd-scoped extract from Precision Code Ltd master data.");
    expect(html).toContain("Trade: IT consultancy and software development");
    expect(html).toMatch(/^\s*<p>/);
  });

  it("renders nothing when the report has no front matter", () => {
    expect(renderFrontMatter({ frontMatter: [] })).toBe("");
  });
});
