// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// report-generator.js — Shared report formatting for reconciliation and standalone report commands.
// Extracted from app/bin/reconcile.js.

// The bridge walks the accounting profit to the profit the tax computation
// charges, one named adjustment at a time, and states what is left over. A
// product supplies the rows through profitBridge(results); the title, the
// check name and the table shape are the same for all four so a reader who
// has seen one has seen them all.
export const PROFIT_BRIDGE_TITLE = "Accounting profit to tax profit bridge";
export const PROFIT_BRIDGE_CHECK = "Accounting profit to tax profit bridge closes to zero";

// Lines print to the penny. The residue asks for more places than that, so a
// difference under a penny is shown rather than rounded into a nil. A negated
// nil line, and a residue that is float noise, both land on -0, which prints
// as "-0" and reads as a defect.
function bridgeAmount(value, fractionDigits = 2) {
  if (typeof value !== "number") return "—";
  const rounded = Number(value.toFixed(fractionDigits));
  const amount = rounded === 0 ? 0 : rounded;
  return amount.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits });
}

export function profitBridgeLines(bridge) {
  if (!bridge) return [];
  const lines = ["", `## ${PROFIT_BRIDGE_TITLE}`, "", "| Line | Cell | Amount |", "|------|------|-------:|"];
  for (const row of bridge.rows) {
    lines.push(`| ${row.label} | ${row.cell} | ${bridgeAmount(row.value)} |`);
  }
  lines.push(`| **Tax profit the bridge computes** | | **${bridgeAmount(bridge.computed)}** |`);
  lines.push(`| Tax profit the sheet carries | ${bridge.sheetCell} | ${bridgeAmount(bridge.sheetProfit)} |`);
  lines.push(`| **Residue** | | **${bridgeAmount(bridge.residue, 4)}** |`);
  return lines;
}

// Sums a bridge's rows and states the residue against the sheet's own tax
// profit. Products build the rows; the arithmetic lives here so all four
// close the same way.
export function buildProfitBridge(rows, sheetCell, sheetProfit) {
  const computed = rows.reduce((total, row) => total + row.value, 0);
  return { rows, computed, sheetCell, sheetProfit, residue: computed - sheetProfit };
}

export function generateReport(packageName, scenarioName, results, checks, productMod) {
  const hasFail = checks.some((c) => !c.pass && c.severity !== "warning");
  const hasWarning = checks.some((c) => !c.pass && c.severity === "warning");
  const status = hasFail ? "ANOMALYDETECTED" : hasWarning ? "RECONCILES (with warnings)" : "RECONCILES";
  const lines = [
    `# Reconciliation Report: ${packageName}`,
    ``,
    `Scenario: ${scenarioName}`,
    `Status: ${status}`,
    ``,
    `## Compliance Checks`,
    ``,
    `| Check | Expected | Actual | Diff | Result |`,
    `|-------|----------|--------|------|--------|`,
  ];

  for (const c of checks) {
    const result = c.pass ? "PASS" : c.severity === "warning" ? "**WARNING**" : "**FAIL**";
    lines.push(`| ${c.name} | ${c.expected} | ${c.actual} | ${c.diff > 0 ? "+" : ""}${c.diff} | ${result} |`);
  }

  // The bridge sits straight under the checks: it is the one section that
  // explains a difference the checks only prove correct.
  if (typeof productMod.profitBridge === "function") {
    lines.push(...profitBridgeLines(productMod.profitBridge(results)));
  }

  // Formatted accounting statements (if product module provides them)
  if (typeof productMod.reportSections === "function") {
    const sections = productMod.reportSections(results);
    for (const section of sections) {
      lines.push("");
      lines.push(`## ${section.title}`);
      lines.push("");
      lines.push("| | Amount |");
      lines.push("|---|------:|");
      for (const row of section.rows) {
        if (!row.label && !row.value) {
          lines.push("| | |");
        } else {
          const indent = row.indent ? "&nbsp;&nbsp;&nbsp;&nbsp;".repeat(row.indent) : "";
          lines.push(`| ${indent}${row.label} | ${row.value} |`);
        }
      }
    }
  }

  // Cell-by-cell appendix with DIY labels and diya-gl mappings
  const labels = typeof productMod.cellLabels === "function" ? productMod.cellLabels() : {};

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Appendix: Cell Values");
  lines.push("");

  for (const [sheetName, cells] of Object.entries(results)) {
    if (!cells || typeof cells !== "object") continue;
    const entries = Object.entries(cells).filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== " ");
    if (entries.length === 0) continue;
    lines.push(`### ${sheetName}`);
    lines.push("");
    lines.push("| Cell | DIY Label | Value | diya-gl mapping |");
    lines.push("|------|-----------|-------|-----------------|");
    for (const [cell, val] of entries) {
      const key = `${sheetName}!${cell}`;
      const lbl = labels[key];
      const diyLabel = lbl?.diyLabel || "";
      const glMapping = lbl?.glMapping || "";
      lines.push(`| ${cell} | ${diyLabel} | ${val} | ${glMapping} |`);
    }
    lines.push("");
  }

  return { content: lines.join("\n"), compliant: !hasFail };
}

/**
 * Generate individual report files, one per reportSections() section.
 * Returns { "filename.md": content } map.
 */
export function generateSectionReports(results, productMod) {
  const reports = {};

  if (typeof productMod.reportSections !== "function") return reports;

  const sections = productMod.reportSections(results);
  for (const section of sections) {
    const lines = [];
    lines.push(`# ${section.title}`);
    lines.push("");
    lines.push("| | Amount |");
    lines.push("|---|------:|");
    for (const row of section.rows) {
      if (!row.label && !row.value) {
        lines.push("| | |");
      } else {
        const indent = row.indent ? "&nbsp;&nbsp;&nbsp;&nbsp;".repeat(row.indent) : "";
        lines.push(`| ${indent}${row.label} | ${row.value} |`);
      }
    }
    lines.push("");

    const filename =
      section.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+$/, "") + ".md";
    reports[filename] = lines.join("\n");
  }

  if (typeof productMod.profitBridge === "function") {
    const bridgeLines = profitBridgeLines(productMod.profitBridge(results));
    if (bridgeLines.length > 0) {
      reports["accounting-profit-to-tax-profit-bridge.md"] = [`# ${PROFIT_BRIDGE_TITLE}`, ...bridgeLines.slice(2), ""].join("\n");
    }
  }

  // Cell appendix
  const labels = typeof productMod.cellLabels === "function" ? productMod.cellLabels() : {};
  const appendixLines = ["# Cell Values", ""];
  for (const [sheetName, cells] of Object.entries(results)) {
    if (!cells || typeof cells !== "object") continue;
    const entries = Object.entries(cells).filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== " ");
    if (entries.length === 0) continue;
    appendixLines.push(`## ${sheetName}`);
    appendixLines.push("");
    appendixLines.push("| Cell | DIY Label | Value | diya-gl mapping |");
    appendixLines.push("|------|-----------|-------|-----------------|");
    for (const [cell, val] of entries) {
      const key = `${sheetName}!${cell}`;
      const lbl = labels[key];
      const diyLabel = lbl?.diyLabel || "";
      const glMapping = lbl?.glMapping || "";
      const displayVal = typeof val === "number" ? parseFloat(val.toPrecision(15)) : val;
      appendixLines.push(`| ${cell} | ${diyLabel} | ${displayVal} | ${glMapping} |`);
    }
    appendixLines.push("");
  }
  reports["cell-values.md"] = appendixLines.join("\n");

  return reports;
}
