// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { parseReport, renderFrontMatter, loadReleases, recordRelease } from "../bin/build-reconciliation-pages.js";

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

describe("loadReleases", () => {
  it("returns an empty list when the file does not exist yet", () => {
    expect(loadReleases(join(tmpdir(), "releases-that-do-not-exist.json"))).toEqual({ releases: [] });
  });
});

describe("recordRelease", () => {
  let workDir;

  afterEach(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  const provenanceData = {
    formatVersion: "diya-gl-books/1",
    engineVersion: "1.0.0+abc123def456",
    taxDataHash: "942a6388a226",
    reconciledCommit: "abc123def456",
    templates: { bst: { hash: "06fdcd072930", scorecard: "810 passed, 0 warnings, 0 failed" } },
  };

  it("creates the file and appends the tagged release under a given date", () => {
    workDir = mkdtempSync(join(tmpdir(), "releases-record-"));
    const path = join(workDir, "releases.json");

    const data = recordRelease(path, "diya-gl-v1.0.0", provenanceData, "2026-09-10");

    expect(data.releases).toEqual([{ tag: "diya-gl-v1.0.0", date: "2026-09-10", ...provenanceData }]);
    expect(existsSync(path)).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(data);
  });

  it("appends to an already-recorded release rather than replacing it", () => {
    workDir = mkdtempSync(join(tmpdir(), "releases-record-"));
    const path = join(workDir, "releases.json");
    recordRelease(path, "diya-gl-v1.0.0", provenanceData, "2026-09-10");

    const data = recordRelease(path, "diya-gl-v1.1.0", { ...provenanceData, engineVersion: "1.1.0+def456abc123" }, "2026-10-01");

    expect(data.releases).toHaveLength(2);
    expect(data.releases[0].tag).toBe("diya-gl-v1.0.0");
    expect(data.releases[1].tag).toBe("diya-gl-v1.1.0");
  });

  it("defaults the date to today when none is given", () => {
    workDir = mkdtempSync(join(tmpdir(), "releases-record-"));
    const path = join(workDir, "releases.json");

    const data = recordRelease(path, "diya-gl-v1.0.0", provenanceData);

    expect(data.releases[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
