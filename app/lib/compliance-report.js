// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// compliance-report.js — Pure parsers and report generator for compliance reports.

export function parseNpmAudit(auditJson) {
  if (!auditJson) return { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0, found: false };
  const vuln = auditJson.metadata?.vulnerabilities || {};
  return {
    critical: vuln.critical || 0,
    high: vuln.high || 0,
    moderate: vuln.moderate || 0,
    low: vuln.low || 0,
    info: vuln.info || 0,
    total: vuln.total || 0,
    found: true,
  };
}

export function parseEslintSecurity(eslintText) {
  if (eslintText === null || eslintText === undefined) return { errors: 0, warnings: 0, found: false };
  const summaryMatch = eslintText.match(/(\d+)\s+problems?\s+\((\d+)\s+errors?,\s*(\d+)\s+warnings?\)/);
  if (summaryMatch) return { errors: parseInt(summaryMatch[2], 10), warnings: parseInt(summaryMatch[3], 10), found: true };
  return { errors: 0, warnings: 0, found: true };
}

export function parsePa11yReport(pa11yText) {
  if (!pa11yText) return { passed: 0, failed: 0, total: 0, results: [], found: false };
  const results = [];
  const urlPattern = />\s+(https?:\/\/[^\s]+)\s+-\s+(\d+)\s+errors?/g;
  let match;
  while ((match = urlPattern.exec(pa11yText)) !== null) {
    results.push({ url: match[1], errorCount: parseInt(match[2], 10) });
  }
  const summaryMatch = pa11yText.match(/(\d+)\s+of\s+(\d+)\s+URLs?\s+passed/);
  const passed = summaryMatch ? parseInt(summaryMatch[1], 10) : results.filter((r) => r.errorCount === 0).length;
  const total = summaryMatch ? parseInt(summaryMatch[2], 10) : results.length;
  return { passed, failed: total - passed, total, results, found: true };
}

export function parseAxeResults(axeJson) {
  if (!axeJson || !Array.isArray(axeJson)) return { violations: 0, passes: 0, incomplete: 0, found: false };
  let totalViolations = 0,
    totalPasses = 0,
    totalIncomplete = 0;
  const violationDetails = [];
  for (const result of axeJson) {
    totalViolations += (result.violations || []).length;
    totalPasses += (result.passes || []).length;
    totalIncomplete += (result.incomplete || []).length;
    for (const v of result.violations || []) {
      violationDetails.push({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes?.length || 0 });
    }
  }
  return { violations: totalViolations, passes: totalPasses, incomplete: totalIncomplete, violationDetails, found: true };
}

export function parseLighthouseResults(lighthouseJson) {
  if (!lighthouseJson || !lighthouseJson.categories) return { performance: 0, accessibility: 0, bestPractices: 0, seo: 0, found: false };
  const categories = lighthouseJson.categories;
  return {
    performance: Math.round((categories.performance?.score || 0) * 100),
    accessibility: Math.round((categories.accessibility?.score || 0) * 100),
    bestPractices: Math.round((categories["best-practices"]?.score || 0) * 100),
    seo: Math.round((categories.seo?.score || 0) * 100),
    found: true,
  };
}

export function parseTextSpacingResults(textSpacingJson) {
  if (!textSpacingJson || !textSpacingJson.pages) return { passed: 0, failed: 0, total: 0, errors: 0, failedPages: [], found: false };
  const summary = textSpacingJson.summary || {};
  const failedPages = textSpacingJson.pages
    .filter((p) => !p.passed && !p.error)
    .map((p) => ({ url: p.url, clippedCount: p.clippedElements?.length || 0 }));
  return {
    passed: summary.passed || 0,
    failed: summary.failed || 0,
    total: summary.total || 0,
    errors: summary.errors || 0,
    failedPages,
    found: true,
  };
}

export function parseRetireResults(retireJson) {
  if (!retireJson) return { total: 0, high: 0, medium: 0, low: 0, found: false };
  let high = 0,
    medium = 0,
    low = 0;
  const results = Array.isArray(retireJson) ? retireJson : retireJson.data || [];
  for (const result of results) {
    for (const vuln of result.results || []) {
      for (const v of vuln.vulnerabilities || []) {
        const severity = (v.severity || "").toLowerCase();
        if (severity === "high" || severity === "critical") high++;
        else if (severity === "medium" || severity === "moderate") medium++;
        else low++;
      }
    }
  }
  return { total: high + medium + low, high, medium, low, found: true };
}

export function generateReport({
  targetUrl,
  version,
  sourceFiles,
  npmAudit,
  eslint,
  pa11y,
  axe,
  axeWcag22,
  lighthouse,
  textSpacing,
  retire,
}) {
  const sourceFilesSection = sourceFiles.map((sf) => `  ${sf.exists ? "+" : "-"} ${sf.path}`).join("\n");
  const securityPass = npmAudit.critical === 0 && npmAudit.high === 0 && eslint.errors === 0;
  const accessibilityPass = pa11y.failed === 0 && axe.violations === 0 && textSpacing.failed === 0;
  const overallPass = securityPass && accessibilityPass;
  const statusIcon = (pass) => (pass ? "PASS" : "FAIL");

  return `# Compliance Report

**Application**: DIY Accounting Spreadsheets
**Version**: ${version}
**Target URL**: ${targetUrl}
**Overall Status**: ${statusIcon(overallPass)}

**Source Files**:
\`\`\`
${sourceFilesSection}
\`\`\`

---

## Summary

| Check | Status | Summary |
|-------|--------|---------|
| npm audit (prod) | ${statusIcon(npmAudit.critical === 0 && npmAudit.high === 0)} | ${npmAudit.found ? `${npmAudit.critical} critical, ${npmAudit.high} high, ${npmAudit.moderate} moderate` : "Report not found"} |
| ESLint Security | ${statusIcon(eslint.errors === 0)} | ${eslint.found ? `${eslint.errors} errors, ${eslint.warnings} warnings` : "Report not found"} |
| retire.js | ${statusIcon(retire.high === 0)} | ${retire.found ? `${retire.high} high, ${retire.medium} medium, ${retire.low} low` : "Report not found"} |
| Pa11y (WCAG AA) | ${statusIcon(pa11y.failed === 0)} | ${pa11y.found ? `${pa11y.passed}/${pa11y.total} pages passed` : "Report not found"} |
| axe-core | ${statusIcon(axe.violations === 0)} | ${axe.found ? `${axe.violations} violations, ${axe.passes} passes` : "Report not found"} |
| axe-core (WCAG 2.2) | ${statusIcon(axeWcag22.violations === 0)} | ${axeWcag22.found ? `${axeWcag22.violations} violations, ${axeWcag22.passes} passes` : "Report not found"} |
| Lighthouse | ${statusIcon(lighthouse.accessibility >= 90)} | ${lighthouse.found ? `A11y: ${lighthouse.accessibility}%, Perf: ${lighthouse.performance}%, BP: ${lighthouse.bestPractices}%` : "Report not found"} |
| Text Spacing (1.4.12) | ${statusIcon(textSpacing.failed === 0)} | ${textSpacing.found ? `${textSpacing.passed}/${textSpacing.total} pages passed` : "Report not found"} |

---

## 1. Security Checks

### 1.1 npm audit (Production Dependency Vulnerabilities)

Scanned with \`--omit=dev\` — only production dependencies affect compliance status.

${
  npmAudit.found
    ? `| Severity | Count |
|----------|-------|
| Critical | ${npmAudit.critical} |
| High | ${npmAudit.high} |
| Moderate | ${npmAudit.moderate} |
| Low | ${npmAudit.low} |
| **Total** | **${npmAudit.total}** |

**Status**: ${statusIcon(npmAudit.critical === 0 && npmAudit.high === 0)} ${npmAudit.critical === 0 && npmAudit.high === 0 ? "No critical/high vulnerabilities in production dependencies" : "Critical/high vulnerabilities in production dependencies require attention"}`
    : "Report not found: `web/spreadsheets.diyaccounting.co.uk/public/tests/penetration/npm-audit.json`"
}

### 1.2 ESLint Security Analysis

${
  eslint.found
    ? `| Metric | Count |
|--------|-------|
| Errors | ${eslint.errors} |
| Warnings | ${eslint.warnings} |

**Status**: ${statusIcon(eslint.errors === 0)} ${eslint.errors === 0 ? "No security errors" : "Security errors require attention"}`
    : "Report not found: `web/spreadsheets.diyaccounting.co.uk/public/tests/penetration/eslint-security.txt`"
}

### 1.3 retire.js (Known Vulnerabilities)

${
  retire.found
    ? `| Severity | Count |
|----------|-------|
| High | ${retire.high} |
| Medium | ${retire.medium} |
| Low | ${retire.low} |

**Status**: ${statusIcon(retire.high === 0)} ${retire.high === 0 ? "No high severity vulnerabilities" : "High severity vulnerabilities require attention"}`
    : "Report not found: `web/spreadsheets.diyaccounting.co.uk/public/tests/penetration/retire.json`"
}

---

## 2. Accessibility Checks

### 2.1 Pa11y (WCAG 2.1 Level AA)

${
  pa11y.found
    ? `| Metric | Value |
|--------|-------|
| Pages Tested | ${pa11y.total} |
| Pages Passed | ${pa11y.passed} |
| Pages Failed | ${pa11y.failed} |

**Status**: ${statusIcon(pa11y.failed === 0)} ${pa11y.failed === 0 ? "All pages comply with WCAG AA" : "Some pages have accessibility issues"}
${
  pa11y.results.length > 0
    ? `
#### Page Results

| Page | Errors |
|------|--------|
${pa11y.results.map((r) => `| ${r.url.replace(targetUrl, "") || "/"} | ${r.errorCount} |`).join("\n")}`
    : ""
}`
    : "Report not found: `web/spreadsheets.diyaccounting.co.uk/public/tests/accessibility/pa11y-report.txt`"
}

### 2.2 axe-core (Automated Accessibility)

${
  axe.found
    ? `| Metric | Count |
|--------|-------|
| Violations | ${axe.violations} |
| Passes | ${axe.passes} |
| Incomplete | ${axe.incomplete} |

**Status**: ${statusIcon(axe.violations === 0)} ${axe.violations === 0 ? "No accessibility violations" : "Accessibility violations require attention"}
${
  axe.violationDetails.length > 0
    ? `
#### Violations

| Rule | Impact | Description | Nodes |
|------|--------|-------------|-------|
${axe.violationDetails.map((v) => `| ${v.id} | ${v.impact} | ${v.description} | ${v.nodes} |`).join("\n")}`
    : ""
}`
    : "Report not found: `web/spreadsheets.diyaccounting.co.uk/public/tests/accessibility/axe-results.json`"
}

### 2.3 axe-core (WCAG 2.2 Level AA)

${
  axeWcag22.found
    ? `| Metric | Count |
|--------|-------|
| Violations | ${axeWcag22.violations} |
| Passes | ${axeWcag22.passes} |
| Incomplete | ${axeWcag22.incomplete} |

**Status**: ${statusIcon(axeWcag22.violations === 0)} ${axeWcag22.violations === 0 ? "No WCAG 2.2 violations" : "WCAG 2.2 violations detected"}
${
  axeWcag22.violationDetails.length > 0
    ? `
#### Violations

| Rule | Impact | Description | Nodes |
|------|--------|-------------|-------|
${axeWcag22.violationDetails.map((v) => `| ${v.id} | ${v.impact} | ${v.description} | ${v.nodes} |`).join("\n")}`
    : ""
}`
    : "Report not found: `web/spreadsheets.diyaccounting.co.uk/public/tests/accessibility/axe-wcag22-results.json`"
}

### 2.4 Lighthouse

${
  lighthouse.found
    ? `| Category | Score |
|----------|-------|
| Accessibility | ${lighthouse.accessibility}% |
| Performance | ${lighthouse.performance}% |
| Best Practices | ${lighthouse.bestPractices}% |
| SEO | ${lighthouse.seo}% |

**Status**: ${statusIcon(lighthouse.accessibility >= 90)} ${lighthouse.accessibility >= 90 ? "Accessibility score meets threshold (90%+)" : "Accessibility score below 90% threshold"}`
    : "Report not found: `web/spreadsheets.diyaccounting.co.uk/public/tests/accessibility/lighthouse-results.json`"
}

### 2.5 Text Spacing (WCAG 1.4.12)

${
  textSpacing.found
    ? `| Metric | Value |
|--------|-------|
| Pages Tested | ${textSpacing.total} |
| Pages Passed | ${textSpacing.passed} |
| Pages Failed | ${textSpacing.failed} |
| Errors | ${textSpacing.errors} |

**Status**: ${statusIcon(textSpacing.failed === 0)} ${textSpacing.failed === 0 ? "All pages pass text spacing test" : "Some pages have text spacing issues"}

**Test Parameters** (WCAG 1.4.12 minimum values):
- Line height: 1.5 times font size
- Letter spacing: 0.12 times font size
- Word spacing: 0.16 times font size
- Paragraph spacing: 2 times font size
${
  textSpacing.failedPages.length > 0
    ? `
#### Pages with Clipped Content

| Page | Clipped Elements |
|------|------------------|
${textSpacing.failedPages.map((p) => `| ${p.url.replace(targetUrl, "") || "/"} | ${p.clippedCount} |`).join("\n")}`
    : ""
}`
    : "Report not found: `web/spreadsheets.diyaccounting.co.uk/public/tests/accessibility/text-spacing-results.json`"
}

---

## 3. Report Files

| Report | Path | Status |
|--------|------|--------|
| npm audit | web/spreadsheets.diyaccounting.co.uk/public/tests/penetration/npm-audit.json | ${npmAudit.found ? "Found" : "Missing"} |
| ESLint Security | web/spreadsheets.diyaccounting.co.uk/public/tests/penetration/eslint-security.txt | ${eslint.found ? "Found" : "Missing"} |
| retire.js | web/spreadsheets.diyaccounting.co.uk/public/tests/penetration/retire.json | ${retire.found ? "Found" : "Missing"} |
| Pa11y | web/spreadsheets.diyaccounting.co.uk/public/tests/accessibility/pa11y-report.txt | ${pa11y.found ? "Found" : "Missing"} |
| axe-core | web/spreadsheets.diyaccounting.co.uk/public/tests/accessibility/axe-results.json | ${axe.found ? "Found" : "Missing"} |
| axe-core (WCAG 2.2) | web/spreadsheets.diyaccounting.co.uk/public/tests/accessibility/axe-wcag22-results.json | ${axeWcag22.found ? "Found" : "Missing"} |
| Lighthouse | web/spreadsheets.diyaccounting.co.uk/public/tests/accessibility/lighthouse-results.json | ${lighthouse.found ? "Found" : "Missing"} |
| Text Spacing | web/spreadsheets.diyaccounting.co.uk/public/tests/accessibility/text-spacing-results.json | ${textSpacing.found ? "Found" : "Missing"} |

---

*Generated by \`node app/bin/compliance-report.js --target ${targetUrl}\`*
`;
}
