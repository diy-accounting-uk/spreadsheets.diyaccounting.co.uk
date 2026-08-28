// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { generateReport, generateSectionReports, buildProfitBridge, PROFIT_BRIDGE_TITLE } from "../lib/report-generator.js";

const mockProductMod = {
  reportSections: (results) => [
    {
      title: "Profit & Loss",
      rows: [
        { label: "Sales Turnover", value: "150,000", indent: 0 },
        { label: "Cost of Sales", value: "50,000", indent: 1 },
        { label: "**Gross Profit**", value: "100,000", indent: 0 },
      ],
    },
    {
      title: "Income Tax",
      rows: [{ label: "Total Tax", value: "20,000", indent: 0 }],
    },
  ],
  cellLabels: () => ({
    "Profit & Loss Acc!C4": { diyLabel: "Sales Turnover", glMapping: "gl-cor:amount (salesTurnover)" },
  }),
};

const bridgeRows = [
  { label: "Net profit per the profit and loss account", cell: "Profit & Loss Acc!C24", value: 31812 },
  { label: "Less annual investment allowance (box 22)", cell: "SE Short!D80", value: -200 },
];

const mockProductModWithBridge = {
  ...mockProductMod,
  profitBridge: () => buildProfitBridge(bridgeRows, "Income Tax!E5", 31612),
};

const mockResults = {
  "Profit & Loss Acc": { C4: 150000, C9: 100000 },
  "Income Tax": { E5: 100000, E10: 20000 },
};

const passingChecks = [
  { name: "Total Sales", expected: 150000, actual: 150000, diff: 0, pass: true },
  { name: "Gross Profit", expected: 100000, actual: 100000, diff: 0, pass: true },
];

describe("generateReport", () => {
  it("produces RECONCILES status when all checks pass", () => {
    const { content, compliant } = generateReport("TestPackage", "test-scenario", mockResults, passingChecks, mockProductMod);
    expect(compliant).toBe(true);
    expect(content).toContain("Status: RECONCILES");
    expect(content).not.toContain("ANOMALYDETECTED");
  });

  it("produces ANOMALYDETECTED when a check fails", () => {
    const failChecks = [{ name: "Total Sales", expected: 150000, actual: 140000, diff: -10000, pass: false }];
    const { content, compliant } = generateReport("Pkg", "scen", mockResults, failChecks, mockProductMod);
    expect(compliant).toBe(false);
    expect(content).toContain("Status: ANOMALYDETECTED");
  });

  it("produces RECONCILES (with warnings) for warning-only failures", () => {
    const warnChecks = [
      { name: "Total Sales", expected: 150000, actual: 150000, diff: 0, pass: true },
      { name: "Minor Issue", expected: 100, actual: 99, diff: -1, pass: false, severity: "warning" },
    ];
    const { content, compliant } = generateReport("Pkg", "scen", mockResults, warnChecks, mockProductMod);
    expect(compliant).toBe(true);
    expect(content).toContain("Status: RECONCILES (with warnings)");
  });

  it("includes compliance checks table", () => {
    const { content } = generateReport("Pkg", "scen", mockResults, passingChecks, mockProductMod);
    expect(content).toContain("## Compliance Checks");
    expect(content).toContain("| Total Sales | 150000 | 150000 | 0 | PASS |");
  });

  it("includes report sections from product module", () => {
    const { content } = generateReport("Pkg", "scen", mockResults, passingChecks, mockProductMod);
    expect(content).toContain("## Profit & Loss");
    expect(content).toContain("Sales Turnover");
    expect(content).toContain("## Income Tax");
  });

  it("includes the profit bridge, its cell references and a nil residue", () => {
    const { content } = generateReport("Pkg", "scen", mockResults, passingChecks, mockProductModWithBridge);
    expect(content).toContain(`## ${PROFIT_BRIDGE_TITLE}`);
    expect(content).toContain("| Net profit per the profit and loss account | Profit & Loss Acc!C24 | 31,812 |");
    expect(content).toContain("| Less annual investment allowance (box 22) | SE Short!D80 | -200 |");
    expect(content).toContain("| **Tax profit the bridge computes** | | **31,612** |");
    expect(content).toContain("| Tax profit the sheet carries | Income Tax!E5 | 31,612 |");
    expect(content).toContain("| **Residue** | | **0** |");
  });

  it("states a residue the adjustments do not explain", () => {
    const productMod = {
      ...mockProductMod,
      profitBridge: () => buildProfitBridge(bridgeRows, "Income Tax!E5", 31112),
    };
    const { content } = generateReport("Pkg", "scen", mockResults, passingChecks, productMod);
    expect(content).toContain("| **Residue** | | **500** |");
  });

  it("prints float noise in the residue as nil rather than a negative zero", () => {
    const productMod = {
      ...mockProductMod,
      profitBridge: () => buildProfitBridge(bridgeRows, "Income Tax!E5", 31612 + 1e-11),
    };
    const { content } = generateReport("Pkg", "scen", mockResults, passingChecks, productMod);
    expect(content).toContain("| **Residue** | | **0** |");
    expect(content).not.toContain("-0");
  });

  it("leaves the bridge out for a product that does not supply one", () => {
    const { content } = generateReport("Pkg", "scen", mockResults, passingChecks, mockProductMod);
    expect(content).not.toContain(PROFIT_BRIDGE_TITLE);
  });

  it("includes cell appendix with labels and mappings", () => {
    const { content } = generateReport("Pkg", "scen", mockResults, passingChecks, mockProductMod);
    expect(content).toContain("## Appendix: Cell Values");
    expect(content).toContain("| C4 | Sales Turnover | 150000 | gl-cor:amount (salesTurnover) |");
  });

  it("skips empty/null cell values in appendix", () => {
    const results = { Sheet1: { A1: 100, A2: null, A3: "", A4: " " } };
    const { content } = generateReport("Pkg", "scen", results, [], { reportSections: () => [], cellLabels: () => ({}) });
    expect(content).toContain("| A1 |");
    expect(content).not.toContain("| A2 |");
    expect(content).not.toContain("| A3 |");
    expect(content).not.toContain("| A4 |");
  });
});

describe("generateSectionReports", () => {
  it("returns one file per section plus cell-values.md", () => {
    const reports = generateSectionReports(mockResults, mockProductMod);
    expect(Object.keys(reports)).toContain("profit-loss.md");
    expect(Object.keys(reports)).toContain("income-tax.md");
    expect(Object.keys(reports)).toContain("cell-values.md");
  });

  it("section files contain the section title", () => {
    const reports = generateSectionReports(mockResults, mockProductMod);
    expect(reports["profit-loss.md"]).toContain("# Profit & Loss");
    expect(reports["profit-loss.md"]).toContain("Sales Turnover");
  });

  it("cell-values.md contains all sheet cell values", () => {
    const reports = generateSectionReports(mockResults, mockProductMod);
    expect(reports["cell-values.md"]).toContain("## Profit & Loss Acc");
    expect(reports["cell-values.md"]).toContain("| C4 |");
  });

  it("gives the bridge its own file", () => {
    const reports = generateSectionReports(mockResults, mockProductModWithBridge);
    const bridge = reports["accounting-profit-to-tax-profit-bridge.md"];
    expect(bridge).toBeDefined();
    expect(bridge).toContain(`# ${PROFIT_BRIDGE_TITLE}`);
    expect(bridge).toContain("| Tax profit the sheet carries | Income Tax!E5 | 31,612 |");
  });

  it("returns empty object when product has no reportSections", () => {
    const reports = generateSectionReports(mockResults, {});
    expect(Object.keys(reports)).toHaveLength(0);
  });
});
