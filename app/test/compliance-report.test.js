// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import {
  parseNpmAudit,
  parseEslintSecurity,
  parsePa11yReport,
  parseAxeResults,
  parseLighthouseResults,
  parseTextSpacingResults,
  parseRetireResults,
  generateReport,
} from "../lib/compliance-report.js";

// ── parseNpmAudit ──────────────────────────────────────────────────────────

describe("parseNpmAudit", () => {
  it("returns not-found for null input", () => {
    expect(parseNpmAudit(null)).toEqual({ critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0, found: false });
  });

  it("parses vulnerability counts", () => {
    const input = { metadata: { vulnerabilities: { critical: 1, high: 2, moderate: 3, low: 4, info: 5, total: 15 } } };
    expect(parseNpmAudit(input)).toEqual({ critical: 1, high: 2, moderate: 3, low: 4, info: 5, total: 15, found: true });
  });

  it("handles empty metadata", () => {
    const result = parseNpmAudit({ metadata: {} });
    expect(result.found).toBe(true);
    expect(result.critical).toBe(0);
  });
});

// ── parseEslintSecurity ────────────────────────────────────────────────────

describe("parseEslintSecurity", () => {
  it("returns not-found for null input", () => {
    expect(parseEslintSecurity(null)).toEqual({ errors: 0, warnings: 0, found: false });
  });

  it("parses summary line", () => {
    const result = parseEslintSecurity("5 problems (2 errors, 3 warnings)");
    expect(result).toEqual({ errors: 2, warnings: 3, found: true });
  });

  it("returns zeros for text without summary", () => {
    const result = parseEslintSecurity("All clear");
    expect(result).toEqual({ errors: 0, warnings: 0, found: true });
  });
});

// ── parsePa11yReport ───────────────────────────────────────────────────────

describe("parsePa11yReport", () => {
  it("returns not-found for null input", () => {
    expect(parsePa11yReport(null).found).toBe(false);
  });

  it("parses page results and summary", () => {
    const text = `> https://example.com/ - 0 errors\n> https://example.com/page - 3 errors\n\n1 of 2 URLs passed`;
    const result = parsePa11yReport(text);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.total).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[1].errorCount).toBe(3);
  });
});

// ── parseAxeResults ────────────────────────────────────────────────────────

describe("parseAxeResults", () => {
  it("returns not-found for null input", () => {
    expect(parseAxeResults(null).found).toBe(false);
  });

  it("returns not-found for non-array input", () => {
    expect(parseAxeResults({ violations: [] }).found).toBe(false);
  });

  it("counts violations, passes, incomplete", () => {
    const input = [
      {
        violations: [{ id: "color-contrast", impact: "serious", description: "Low contrast", nodes: [1, 2] }],
        passes: [{ id: "aria-label" }, { id: "alt-text" }],
        incomplete: [{ id: "tabindex" }],
      },
    ];
    const result = parseAxeResults(input);
    expect(result.violations).toBe(1);
    expect(result.passes).toBe(2);
    expect(result.incomplete).toBe(1);
    expect(result.violationDetails[0].id).toBe("color-contrast");
    expect(result.violationDetails[0].nodes).toBe(2);
  });
});

// ── parseLighthouseResults ─────────────────────────────────────────────────

describe("parseLighthouseResults", () => {
  it("returns not-found for null input", () => {
    expect(parseLighthouseResults(null).found).toBe(false);
  });

  it("converts scores to percentages", () => {
    const input = {
      categories: {
        performance: { score: 0.95 },
        accessibility: { score: 0.88 },
        "best-practices": { score: 1.0 },
        seo: { score: 0.92 },
      },
    };
    const result = parseLighthouseResults(input);
    expect(result).toEqual({ performance: 95, accessibility: 88, bestPractices: 100, seo: 92, found: true });
  });
});

// ── parseTextSpacingResults ────────────────────────────────────────────────

describe("parseTextSpacingResults", () => {
  it("returns not-found for null input", () => {
    expect(parseTextSpacingResults(null).found).toBe(false);
  });

  it("parses summary and failed pages", () => {
    const input = {
      summary: { passed: 4, failed: 1, total: 5, errors: 0 },
      pages: [
        { url: "https://example.com/", passed: true },
        { url: "https://example.com/bad", passed: false, clippedElements: [1, 2, 3] },
      ],
    };
    const result = parseTextSpacingResults(input);
    expect(result.passed).toBe(4);
    expect(result.failed).toBe(1);
    expect(result.failedPages).toHaveLength(1);
    expect(result.failedPages[0].clippedCount).toBe(3);
  });
});

// ── parseRetireResults ─────────────────────────────────────────────────────

describe("parseRetireResults", () => {
  it("returns not-found for null input", () => {
    expect(parseRetireResults(null).found).toBe(false);
  });

  it("counts vulnerabilities by severity", () => {
    const input = [
      {
        results: [
          {
            vulnerabilities: [{ severity: "high" }, { severity: "medium" }, { severity: "low" }, { severity: "critical" }],
          },
        ],
      },
    ];
    const result = parseRetireResults(input);
    expect(result.high).toBe(2); // high + critical
    expect(result.medium).toBe(1);
    expect(result.low).toBe(1);
    expect(result.total).toBe(4);
  });
});

// ── generateReport ─────────────────────────────────────────────────────────

describe("generateReport", () => {
  const allClean = {
    targetUrl: "https://example.com",
    version: "1.0.0",
    sourceFiles: [{ path: "tests/npm-audit.json", exists: true }],
    npmAudit: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0, found: true },
    eslint: { errors: 0, warnings: 0, found: true },
    pa11y: { passed: 5, failed: 0, total: 5, results: [], found: true },
    axe: { violations: 0, passes: 10, incomplete: 0, violationDetails: [], found: true },
    axeWcag22: { violations: 0, passes: 10, incomplete: 0, violationDetails: [], found: true },
    lighthouse: { performance: 95, accessibility: 100, bestPractices: 100, seo: 92, found: true },
    textSpacing: { passed: 5, failed: 0, total: 5, errors: 0, failedPages: [], found: true },
    retire: { total: 0, high: 0, medium: 0, low: 0, found: true },
  };

  it("generates a passing report", () => {
    const report = generateReport(allClean);
    expect(report).toContain("**Overall Status**: PASS");
    expect(report).toContain("**Version**: 1.0.0");
    expect(report).toContain("**Target URL**: https://example.com");
  });

  it("marks overall FAIL when security issues exist", () => {
    const report = generateReport({ ...allClean, npmAudit: { ...allClean.npmAudit, critical: 1 } });
    expect(report).toContain("**Overall Status**: FAIL");
  });

  it("marks overall FAIL when accessibility issues exist", () => {
    const report = generateReport({ ...allClean, pa11y: { ...allClean.pa11y, failed: 2 } });
    expect(report).toContain("**Overall Status**: FAIL");
  });

  it("shows missing report files", () => {
    const report = generateReport({ ...allClean, npmAudit: { ...allClean.npmAudit, found: false } });
    expect(report).toContain("Report not found");
  });
});
