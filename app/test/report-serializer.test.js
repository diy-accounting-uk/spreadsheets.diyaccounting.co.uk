// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import {
  buildReportDocument,
  serializeReportDocument,
  canonicalNumber,
  canonicalValue,
  cellKey,
  referenceKey,
  slug,
} from "../lib/report-serializer.js";

// A stand-in product with two sheets, a section that reprints one of them,
// a bridge and a netting table. Small enough that every key the serializer
// writes can be named in an assertion.
function stubProduct({ multiFile = false } = {}) {
  return {
    MULTI_FILE: multiFile,
    cellLabels: () => ({
      "Profit & Loss Acc!C4": { diyLabel: "Total sales", glMapping: "", unit: "money" },
      "Profit & Loss Acc!C24": { diyLabel: "**Net profit**", glMapping: "", unit: "money" },
      "Admin!N7": { diyLabel: "Basic rate", glMapping: "", unit: "rate" },
      "Business Details!C5": { diyLabel: "Business name", glMapping: "" },
    }),
    reportSections: (results) => [
      {
        title: "Profit & Loss Account",
        rows: [
          { label: "Total sales", value: "12,000", indent: 0 },
          { label: "**Net profit**", value: "3,500.5", indent: 0 },
          { label: "Not a cell", value: "99", indent: 1 },
          { label: "Blank row", value: "—", indent: 1 },
        ],
      },
      {
        title: "Business Details",
        rows: [{ label: "Business name", value: results["Business Details"].C5, indent: 0 }],
      },
    ],
    profitBridge: () => ({
      rows: [
        { label: "Net profit per the profit and loss account", cell: "Profit & Loss Acc!C24", value: 3500.5 },
        { label: "Add other business income", cell: "SE Short!O38", value: 0 },
      ],
      computed: 3500.5,
      sheetCell: "Income Tax Calc!E5",
      sheetProfit: 3500.5,
      residue: 0,
    }),
    categoryNetting: () => ({
      rate: 0.2,
      rows: [{ code: "s", label: "Stock", gross: 1200, net: 1000, vat: 200, cell: "Profit & Loss Acc!C6", downstream: 1000, residue: 0 }],
    }),
  };
}

const RESULTS = {
  "Profit & Loss Acc": { C4: 12000, C24: 3500.5, C6: 1000 },
  "Admin": { N7: 0.2 },
  "Business Details": { C5: "Precision Code Ltd", C7: " " },
};

function build(overrides = {}) {
  return buildReportDocument({
    packageName: "bst",
    engine: "excel",
    results: RESULTS,
    productMod: stubProduct(),
    yearEnd: "2026-04-05",
    ...overrides,
  });
}

function byKey(document) {
  return new Map(document.values.map((entry) => [entry.key, entry]));
}

describe("slug", () => {
  it("collapses punctuation, emphasis and indent markup to one hyphen", () => {
    expect(slug("**Net profit/loss**")).toBe("net-profit-loss");
    expect(slug("&nbsp;&nbsp;Employer's NI (box 20)")).toBe("employer-s-ni-box-20");
    expect(slug("Profit & Loss Account")).toBe("profit-loss-account");
  });
});

describe("canonicalNumber", () => {
  it("writes a plain decimal with no grouping, sign bit or float noise", () => {
    expect(canonicalNumber(1234567.5)).toBe("1234567.5");
    expect(canonicalNumber(-0)).toBe("0");
    expect(canonicalNumber(0.1 + 0.2)).toBe("0.3");
    expect(canonicalNumber(6926.4)).toBe("6926.4");
  });
});

describe("canonicalValue", () => {
  it("treats an em dash, a blank and a template space as absent", () => {
    expect(canonicalValue("—")).toBeNull();
    expect(canonicalValue(" ")).toBeNull();
    expect(canonicalValue("")).toBeNull();
    expect(canonicalValue(null)).toBeNull();
    expect(canonicalValue(undefined)).toBeNull();
  });

  it("strips a formatted figure's grouping back to one number form", () => {
    expect(canonicalValue("12,000")).toBe("12000");
    expect(canonicalValue("3,500.50")).toBe("3500.5");
  });

  it("keeps text as trimmed text and a date as YYYY-MM-DD", () => {
    expect(canonicalValue("  Precision Code Ltd ")).toBe("Precision Code Ltd");
    expect(canonicalValue(new Date(Date.UTC(2026, 2, 31)))).toBe("2026-03-31");
    expect(canonicalValue(true)).toBe("true");
  });
});

describe("cellKey", () => {
  it("drops the file segment for a single-file product", () => {
    expect(cellKey("Profit & Loss Acc", "C24", false)).toBe("cell/Profit & Loss Acc!C24");
  });

  it("names the hub for a multi-file product's own sheet", () => {
    expect(cellKey("Profit & Loss Acc", "C24", true)).toBe("cell/Financialaccounts.xlsx!Profit & Loss Acc!C24");
  });

  it("keeps the file an additionalReads key already carries", () => {
    expect(cellKey("Vatreturns.xlsx!VATQtr1", "G9", true)).toBe("cell/Vatreturns.xlsx!VATQtr1!G9");
  });

  it("splits a sheet-and-cell reference at the last separator", () => {
    expect(referenceKey("Profit & Loss Acc!C24", false)).toBe("cell/Profit & Loss Acc!C24");
    expect(referenceKey("Sales.xlsx!Apr!G1", true)).toBe("cell/Sales.xlsx!Apr!G1");
  });
});

describe("buildReportDocument keys", () => {
  it("writes one cell entry per read value, absent cells left out", () => {
    const keys = byKey(build());
    expect(keys.get("cell/Profit & Loss Acc!C4").value).toBe("12000");
    expect(keys.get("cell/Business Details!C5").value).toBe("Precision Code Ltd");
    expect(keys.has("cell/Business Details!C7")).toBe(false);
  });

  it("writes one section entry per printed row, in section-slug form", () => {
    const keys = byKey(build());
    expect(keys.get("section/profit-loss-account/total-sales").value).toBe("12000");
    expect(keys.get("section/profit-loss-account/net-profit").value).toBe("3500.5");
    expect(keys.get("section/profit-loss-account/not-a-cell").value).toBe("99");
    expect(keys.has("section/profit-loss-account/blank-row")).toBe(false);
  });

  it("disambiguates a label a section repeats", () => {
    const productMod = stubProduct();
    productMod.reportSections = () => [
      {
        title: "Fixed assets",
        rows: [
          { label: "Cost", value: "10" },
          { label: "Cost", value: "20" },
          { label: "Cost", value: "30" },
        ],
      },
    ];
    const keys = byKey(build({ productMod }));
    expect(keys.get("section/fixed-assets/cost").value).toBe("10");
    expect(keys.get("section/fixed-assets/cost#2").value).toBe("20");
    expect(keys.get("section/fixed-assets/cost#3").value).toBe("30");
  });

  it("writes one check entry carrying its verdict, both sides and its own window", () => {
    const checks = [{ name: "Total Sales", actual: 12000, expected: 12000, pass: true, diff: 0, tolerance: 1 }];
    const keys = byKey(build({ checks }));
    const entry = keys.get("check/Total Sales");
    expect(entry).toEqual({ key: "check/Total Sales", unit: "verdict", value: "pass", expected: "12000", actual: "12000", tolerance: "1" });
  });

  it("sorts every entry by key and terminates the serialized file with a newline", () => {
    const document = build();
    const keys = document.values.map((entry) => entry.key);
    expect(keys).toEqual([...keys].sort());
    const text = serializeReportDocument(document);
    expect(text.endsWith("\n")).toBe(true);
    expect(text.split("\n")[1]).toBe('  "package": "bst",');
  });
});

describe("buildReportDocument units", () => {
  it("takes a cell's unit from the product's own cellLabels entry", () => {
    const keys = byKey(build());
    expect(keys.get("cell/Profit & Loss Acc!C4").unit).toBe("money");
    expect(keys.get("cell/Admin!N7").unit).toBe("rate");
  });

  it("leaves an undeclared unit absent rather than guessing one from the text", () => {
    const keys = byKey(build());
    expect(keys.get("cell/Business Details!C5")).not.toHaveProperty("unit");
    expect(keys.get("section/profit-loss-account/not-a-cell")).not.toHaveProperty("unit");
  });

  it("gives a section row the unit of the cell it reprints", () => {
    const keys = byKey(build());
    expect(keys.get("section/profit-loss-account/total-sales").unit).toBe("money");
  });

  it("gives a section row the value of the cell it reprints, not the penny the row prints", () => {
    const productMod = stubProduct();
    productMod.cellLabels = () => ({ "Profit & Loss Acc!C30": { diyLabel: "Taxable income", glMapping: "", unit: "money" } });
    productMod.reportSections = () => [
      { title: "Profit & Loss Account", rows: [{ label: "Taxable income", value: "119,699.52", indent: 0 }] },
    ];
    const keys = byKey(build({ productMod, results: { "Profit & Loss Acc": { C30: 119699.524999999 } } }));
    expect(keys.get("section/profit-loss-account/taxable-income").value).toBe("119699.524999999");
  });

  it("declares every check a verdict", () => {
    const checks = [{ name: "A", actual: 1, expected: 1, pass: true, diff: 0 }];
    expect(byKey(build({ checks })).get("check/A").unit).toBe("verdict");
  });
});

describe("buildReportDocument source and derivedFrom", () => {
  it("names the cell a section row reprints, matching through markdown emphasis", () => {
    const keys = byKey(build());
    expect(keys.get("section/profit-loss-account/total-sales").source).toBe("cell/Profit & Loss Acc!C4");
    expect(keys.get("section/profit-loss-account/net-profit").source).toBe("cell/Profit & Loss Acc!C24");
  });

  it("leaves a row that reprints no cell without a source", () => {
    expect(byKey(build()).get("section/profit-loss-account/not-a-cell")).not.toHaveProperty("source");
  });

  it("takes a bridge row's source from the cell the row itself names", () => {
    const keys = byKey(build());
    expect(keys.get("section/accounting-profit-to-tax-profit-bridge/net-profit-per-the-profit-and-loss-account").source).toBe(
      "cell/Profit & Loss Acc!C24",
    );
    expect(keys.get("section/accounting-profit-to-tax-profit-bridge/tax-profit-the-sheet-carries").source).toBe("cell/Income Tax Calc!E5");
  });

  it("names a bridge total's operands so it is scored through them", () => {
    const entry = byKey(build()).get("section/accounting-profit-to-tax-profit-bridge/tax-profit-the-bridge-computes");
    expect(entry.derivedFrom).toEqual([
      "section/accounting-profit-to-tax-profit-bridge/net-profit-per-the-profit-and-loss-account",
      "section/accounting-profit-to-tax-profit-bridge/add-other-business-income",
    ]);
  });

  it("leaves the bridge residue as evidence in its own right", () => {
    const entry = byKey(build()).get("section/accounting-profit-to-tax-profit-bridge/residue");
    expect(entry).not.toHaveProperty("derivedFrom");
    expect(entry).not.toHaveProperty("source");
  });

  it("derives a netting row's VAT and residue from the figures they come off", () => {
    const keys = byKey(build());
    const prefix = "section/journal-category-vat-netting/stock-s";
    expect(keys.get(`${prefix}/vat`).derivedFrom).toEqual([`${prefix}/gross`, `${prefix}/net`]);
    expect(keys.get(`${prefix}/residue`).derivedFrom).toEqual([`${prefix}/net`, `${prefix}/downstream`]);
    expect(keys.get(`${prefix}/downstream`).source).toBe("cell/Profit & Loss Acc!C6");
  });
});

describe("buildReportDocument across engines", () => {
  it("gives a multi-file product's hub sheet the same key from either engine", () => {
    const excel = buildReportDocument({
      packageName: "ltd",
      engine: "excel",
      results: { "Profit & Loss Acc": { B20: 6926.4 }, "Vatreturns.xlsx!VATQtr1": { G9: 100 } },
      productMod: { MULTI_FILE: true, cellLabels: () => ({}) },
    });
    const js = buildReportDocument({
      packageName: "ltd",
      engine: "js",
      results: { "Profit & Loss Acc": { B20: 6926.4 } },
      productMod: { MULTI_FILE: true, cellLabels: () => ({}) },
    });
    expect(excel.values[0].key).toBe("cell/Financialaccounts.xlsx!Profit & Loss Acc!B20");
    expect(js.values[0].key).toBe(excel.values[0].key);
    expect(excel.values.map((entry) => entry.key)).toContain("cell/Vatreturns.xlsx!VATQtr1!G9");
  });
});
