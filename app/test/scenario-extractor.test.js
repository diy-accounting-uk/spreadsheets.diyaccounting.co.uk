// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import {
  getMonthKey,
  escapeTomlString,
  computeNetSales,
  computeSpreadsheetNetSales,
  computeGrossSales,
  filterBst,
  filterAdvanced,
  filterFull,
  buildGrouped,
  formatScenarioToml,
  countGrouped,
  LTD_SALES_CODE_MAP,
  BST_PURCHASE_CODE_MAP,
  SE_PURCHASE_CODE_MAP,
  LTD_PURCHASE_CODE_MAP,
  MONTH_ORDER,
  bstAccountFilter,
  seAccountFilter,
} from "../lib/scenario-extractor.js";

// ── getMonthKey ────────────────────────────────────────────────────────────

describe("getMonthKey", () => {
  it("maps April dates to apr", () => {
    expect(getMonthKey("2025-04-15")).toBe("apr");
  });

  it("maps January dates to jan", () => {
    expect(getMonthKey("2026-01-10")).toBe("jan");
  });

  it("maps March dates to mar", () => {
    expect(getMonthKey("2026-03-31")).toBe("mar");
  });

  it("maps December dates to dec", () => {
    expect(getMonthKey("2025-12-25")).toBe("dec");
  });
});

// ── escapeTomlString ───────────────────────────────────────────────────────

describe("escapeTomlString", () => {
  it("escapes backslashes", () => {
    expect(escapeTomlString("a\\b")).toBe("a\\\\b");
  });

  it("escapes double quotes", () => {
    expect(escapeTomlString('say "hello"')).toBe('say \\"hello\\"');
  });

  it("leaves clean strings unchanged", () => {
    expect(escapeTomlString("hello world")).toBe("hello world");
  });
});

// ── computeGrossSales ──────────────────────────────────────────────────────

describe("computeGrossSales", () => {
  it("sums amounts directly", () => {
    const lines = [{ amount: 100 }, { amount: 200 }, { amount: 300 }];
    expect(computeGrossSales(lines)).toBe(600);
  });

  it("returns 0 for empty array", () => {
    expect(computeGrossSales([])).toBe(0);
  });
});

// ── computeSpreadsheetNetSales ─────────────────────────────────────────────

describe("computeSpreadsheetNetSales", () => {
  it("divides all amounts by 1.2", () => {
    const lines = [{ amount: 1200 }, { amount: 2400 }];
    // 1200/1.2 + 2400/1.2 = 1000 + 2000 = 3000
    expect(computeSpreadsheetNetSales(lines)).toBe(3000);
  });
});

// ── computeNetSales ────────────────────────────────────────────────────────

describe("computeNetSales", () => {
  it("uses per-line taxRate", () => {
    const lines = [
      { amount: 120, taxRate: 0.2 },
      { amount: 100, taxRate: 0 },
    ];
    // 120/1.2 + 100/1.0 = 100 + 100 = 200
    expect(computeNetSales(lines)).toBe(200);
  });

  it("defaults to 0 taxRate when missing", () => {
    const lines = [{ amount: 500 }];
    expect(computeNetSales(lines)).toBe(500);
  });
});

// ── filterBst ──────────────────────────────────────────────────────────────

describe("filterBst", () => {
  it("includes BST sales accounts", () => {
    const lines = [
      { sourceJournalID: "sales", accountMainID: "4000" },
      { sourceJournalID: "sales", accountMainID: "4006" }, // FA sales, excluded
    ];
    expect(filterBst(lines)).toHaveLength(1);
  });

  it("includes BST purchase accounts", () => {
    const lines = [
      { sourceJournalID: "purchases", accountMainID: "5000" },
      { sourceJournalID: "purchases", accountMainID: "9999" }, // unknown
    ];
    expect(filterBst(lines)).toHaveLength(1);
  });

  it("excludes bank and payroll", () => {
    const lines = [
      { sourceJournalID: "bank", accountMainID: "1200" },
      { sourceJournalID: "payroll", accountMainID: "2200" },
    ];
    expect(filterBst(lines)).toHaveLength(0);
  });
});

// ── filterAdvanced ─────────────────────────────────────────────────────────

describe("filterAdvanced", () => {
  it("includes sales with LTD sales code map", () => {
    const lines = [{ sourceJournalID: "sales", accountMainID: 4000 }];
    expect(filterAdvanced(lines)).toHaveLength(1);
  });

  it("includes bank for current and cash accounts only", () => {
    const lines = [
      { sourceJournalID: "bank", "diya-gl:bankAccountID": "1200" }, // current
      { sourceJournalID: "bank", "diya-gl:bankAccountID": "1210" }, // savings, excluded
    ];
    expect(filterAdvanced(lines)).toHaveLength(1);
  });

  it("includes payroll", () => {
    const lines = [{ sourceJournalID: "payroll" }];
    expect(filterAdvanced(lines)).toHaveLength(1);
  });
});

// ── filterFull ─────────────────────────────────────────────────────────────

describe("filterFull", () => {
  it("returns all lines", () => {
    const lines = [{ a: 1 }, { b: 2 }];
    const result = filterFull(lines);
    expect(result).toHaveLength(2);
    expect(result).not.toBe(lines); // returns a copy
  });
});

// ── buildGrouped ───────────────────────────────────────────────────────────

describe("buildGrouped", () => {
  it("groups sales by month with code from LTD_SALES_CODE_MAP", () => {
    const lines = [{ sourceJournalID: "sales", accountMainID: 4000, postingDate: "2025-04-15", detailComment: "Client A", amount: 1000 }];
    const { sales } = buildGrouped(lines, BST_PURCHASE_CODE_MAP);
    expect(sales.apr).toHaveLength(1);
    expect(sales.apr[0].code).toBe("a");
    expect(sales.apr[0].customer).toBe("Client A");
  });

  it("groups purchases by month with code from provided map", () => {
    const lines = [
      { sourceJournalID: "purchases", accountMainID: 5000, postingDate: "2025-05-10", detailComment: "Supplier X", amount: 500 },
    ];
    const { purchases } = buildGrouped(lines, BST_PURCHASE_CODE_MAP);
    expect(purchases.may).toHaveLength(1);
    expect(purchases.may[0].code).toBe("s");
  });

  it("groups bank transactions by account and month", () => {
    const lines = [
      {
        sourceJournalID: "bank",
        "diya-gl:bankAccountID": "1200",
        "diya-gl:bankCode": "si",
        postingDate: "2025-06-01",
        detailComment: "Payment",
        amount: 200,
        lineItemComment: "Invoice 123",
      },
    ];
    const { bank } = buildGrouped(lines, BST_PURCHASE_CODE_MAP);
    expect(bank["1200"].jun).toHaveLength(1);
    expect(bank["1200"].jun[0].code).toBe("si");
  });
});

// ── formatScenarioToml ─────────────────────────────────────────────────────

describe("formatScenarioToml", () => {
  const minimalMetadata = {
    name: "Test scenario",
    description: "A test",
    product: "bst",
    tax_regime: "se",
  };
  const emptyGrouped = { sales: {}, purchases: {}, bank: {} };
  const minimalExpected = { total_sales: 1000 };

  it("includes metadata section", () => {
    const toml = formatScenarioToml(minimalMetadata, emptyGrouped, minimalExpected);
    expect(toml).toContain("[metadata]");
    expect(toml).toContain('name = "Test scenario"');
    expect(toml).toContain('product = "bst"');
  });

  it("includes expected section", () => {
    const toml = formatScenarioToml(minimalMetadata, emptyGrouped, minimalExpected);
    expect(toml).toContain("[expected]");
    expect(toml).toContain("total_sales = 1000");
  });

  it("includes business details when provided", () => {
    const meta = { ...minimalMetadata, business: { name: "Acme", postcode: "SW1A 1AA" } };
    const toml = formatScenarioToml(meta, emptyGrouped, minimalExpected);
    expect(toml).toContain("[business]");
    expect(toml).toContain('name = "Acme"');
  });

  it("includes sales transactions by month", () => {
    const grouped = {
      sales: { apr: [{ date: "2025-04-15", customer: "Client", code: "a", amount: 500 }] },
      purchases: {},
      bank: {},
    };
    const toml = formatScenarioToml(minimalMetadata, grouped, minimalExpected);
    expect(toml).toContain("[[sales.apr]]");
    expect(toml).toContain("date = 2025-04-15");
    expect(toml).toContain('customer = "Client"');
  });

  it("includes stock section when opening_stock is set", () => {
    const expected = { ...minimalExpected, opening_stock: 10000, closing_stock: 6000 };
    const toml = formatScenarioToml(minimalMetadata, emptyGrouped, expected);
    expect(toml).toContain("[stock]");
    expect(toml).toContain("opening = 10000");
    expect(toml).toContain("closing = 6000");
  });

  it("includes opening balance for Ltd", () => {
    const expected = { ...minimalExpected, opening_balance: { fixed_assets: 21087, share_capital: 100 } };
    const toml = formatScenarioToml(minimalMetadata, emptyGrouped, expected);
    expect(toml).toContain("[opening_balance]");
    expect(toml).toContain("fixed_assets = 21087");
  });

  it("escapes special characters in strings", () => {
    const meta = { ...minimalMetadata, business: { name: 'Smith & "Co"' } };
    const toml = formatScenarioToml(meta, emptyGrouped, minimalExpected);
    expect(toml).toContain('name = "Smith & \\"Co\\""');
  });
});

// ── countGrouped ───────────────────────────────────────────────────────────

describe("countGrouped", () => {
  it("counts sales, purchases, and bank transactions", () => {
    const grouped = {
      sales: { apr: [1, 2], may: [3] },
      purchases: { apr: [1] },
      bank: { "1200": { apr: [1, 2, 3] } },
    };
    const counts = countGrouped(grouped);
    expect(counts.s).toBe(3);
    expect(counts.p).toBe(1);
    expect(counts.b).toBe(3);
  });

  it("returns zeros for empty grouped data", () => {
    const counts = countGrouped({ sales: {}, purchases: {}, bank: {} });
    expect(counts).toEqual({ s: 0, p: 0, b: 0 });
  });
});

// ── Code map coverage ──────────────────────────────────────────────────────

describe("code maps", () => {
  it("LTD_SALES_CODE_MAP covers accounts 4000-4006", () => {
    expect(Object.keys(LTD_SALES_CODE_MAP)).toHaveLength(7);
    expect(LTD_SALES_CODE_MAP[4000]).toBe("a");
    expect(LTD_SALES_CODE_MAP[4006]).toBe("fs");
  });

  it("BST_PURCHASE_CODE_MAP maps 5900 to f (fixed assets)", () => {
    expect(BST_PURCHASE_CODE_MAP[5900]).toBe("f");
  });

  it("SE_PURCHASE_CODE_MAP maps 5100 to w (directors wages -> employee)", () => {
    expect(SE_PURCHASE_CODE_MAP[5100]).toBe("w");
  });

  it("LTD_PURCHASE_CODE_MAP maps 5803 to l (loan interest -> legal)", () => {
    expect(LTD_PURCHASE_CODE_MAP[5803]).toBe("l");
  });
});

// ── Account filters ────────────────────────────────────────────────────────

describe("bstAccountFilter", () => {
  it("filters to BST sales and purchase accounts", () => {
    const accounts = {
      sales: { "4000": { accountMainDescription: "Sales A" }, "4006": { accountMainDescription: "FA Sales" } },
      purchases: { "5000": { accountMainDescription: "Stock" }, "9999": { accountMainDescription: "Unknown" } },
    };
    const filtered = bstAccountFilter(accounts);
    expect(Object.keys(filtered.sales)).toEqual(["4000"]);
    expect(Object.keys(filtered.purchases)).toEqual(["5000"]);
  });
});

describe("seAccountFilter", () => {
  it("includes all sales but filters purchases and bank", () => {
    const accounts = {
      sales: { "4000": {}, "4006": {} },
      purchases: { "5000": {}, "9999": {} },
      bank: { "1200": {}, "1210": {} },
    };
    const filtered = seAccountFilter(accounts);
    expect(Object.keys(filtered.sales)).toHaveLength(2); // all sales
    expect(Object.keys(filtered.purchases)).toEqual(["5000"]);
    expect(Object.keys(filtered.bank)).toEqual(["1200"]);
  });
});

// ── MONTH_ORDER ────────────────────────────────────────────────────────────

describe("MONTH_ORDER", () => {
  it("starts with apr and ends with mar", () => {
    expect(MONTH_ORDER[0]).toBe("apr");
    expect(MONTH_ORDER[11]).toBe("mar");
    expect(MONTH_ORDER).toHaveLength(12);
  });
});
