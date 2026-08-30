// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { parse as parseTOML } from "smol-toml";
import {
  getMonthKey,
  buildOpeningBalance,
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
  fullAccountFilter,
  TAXI_PURCHASE_CODE_MAP,
  TAXI_BST_PURCHASE_CODE_MAP,
  assertPurchaseCodesCoverChart,
  withoutDirectorPayroll,
  monthlySalesTotals,
  takingsOnlySales,
  fixedAssetAdditions,
  totalsByCode,
  bstExpectedFigures,
  taxiExpectedFigures,
  buildSubsetBook,
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
      { "sourceJournalID": "bank", "diya-gl:bankAccountID": "1200" }, // current
      { "sourceJournalID": "bank", "diya-gl:bankAccountID": "1210" }, // savings, excluded
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
        "sourceJournalID": "bank",
        "diya-gl:bankAccountID": "1200",
        "diya-gl:bankCode": "si",
        "debitCreditCode": "C",
        "postingDate": "2025-06-01",
        "detailComment": "Payment",
        "amount": 200,
        "lineItemComment": "Invoice 123",
      },
    ];
    const { bank } = buildGrouped(lines, BST_PURCHASE_CODE_MAP);
    expect(bank["1200"].jun).toHaveLength(1);
    expect(bank["1200"].jun[0].code).toBe("si");
    expect(bank["1200"].jun[0].direction).toBe("out");
  });

  it("rejects a bank line with no debit/credit code", () => {
    const lines = [
      {
        "sourceJournalID": "bank",
        "diya-gl:bankAccountID": "1200",
        "diya-gl:bankCode": "si",
        "postingDate": "2025-06-01",
        "detailComment": "Payment",
        "amount": 200,
      },
    ];
    expect(() => buildGrouped(lines, BST_PURCHASE_CODE_MAP)).toThrow(/debitCreditCode/);
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
    const expected = { ...minimalExpected, opening_balance: { share_capital: 100 } };
    const toml = formatScenarioToml(minimalMetadata, emptyGrouped, expected);
    expect(toml).toContain("[opening_balance]");
    expect(toml).toContain("share_capital = 100");
  });

  it("writes fixed asset cost and depreciation as separate opening balance sub-tables", () => {
    const expected = {
      ...minimalExpected,
      opening_balance: {
        share_capital: 100,
        fixed_asset_cost: { motor_vehicles: 30000 },
        fixed_asset_depreciation: { motor_vehicles: 9828 },
      },
    };
    const toml = formatScenarioToml(minimalMetadata, emptyGrouped, expected);
    const parsed = parseTOML(toml).opening_balance;
    expect(parsed.share_capital).toBe(100);
    expect(parsed.fixed_asset_cost.motor_vehicles).toBe(30000);
    expect(parsed.fixed_asset_depreciation.motor_vehicles).toBe(9828);
  });

  it("escapes special characters in strings", () => {
    const meta = { ...minimalMetadata, business: { name: 'Smith & "Co"' } };
    const toml = formatScenarioToml(meta, emptyGrouped, minimalExpected);
    expect(toml).toContain('name = "Smith & \\"Co\\""');
  });
});

// ── buildOpeningBalance ────────────────────────────────────────────────────

describe("buildOpeningBalance", () => {
  const openingLine = (accountMainID, amount, debitCreditCode) => ({
    sourceJournalID: "journal",
    documentReference: "OB-001",
    entryNumber: "TXN-0001",
    postingDate: "2025-04-01",
    accountMainID,
    amount,
    debitCreditCode,
  });

  it("splits fixed assets into cost and accumulated depreciation per asset class", () => {
    const ob = buildOpeningBalance([
      openingLine("0040", 30000, "D"),
      openingLine("0040", 9828, "C"),
      openingLine("0030", 3000, "D"),
      openingLine("0030", 270, "C"),
    ]);
    expect(ob.fixed_asset_cost).toEqual({ motor_vehicles: 30000, computer_technology: 3000 });
    expect(ob.fixed_asset_depreciation).toEqual({ motor_vehicles: 9828, computer_technology: 270 });
  });

  it("reports liabilities and capital as positive figures", () => {
    const ob = buildOpeningBalance([openingLine("2500", 20000, "C"), openingLine("3000", 100, "C"), openingLine("3100", 45702, "C")]);
    expect(ob.directors_loan).toBe(20000);
    expect(ob.share_capital).toBe(100);
    expect(ob.retained_earnings).toBe(45702);
  });

  it("ignores in-year journals that are not opening balances", () => {
    const stockAdjustment = {
      sourceJournalID: "journal",
      documentReference: "JNL-001",
      entryNumber: "TXN-0703",
      postingDate: "2026-03-31",
      accountMainID: "1100",
      amount: 4000,
      debitCreditCode: "C",
    };
    const ob = buildOpeningBalance([openingLine("1100", 10000, "D"), stockAdjustment]);
    expect(ob.stock).toBe(10000);
  });

  it("throws when an opening line posts to an account with no balance sheet row", () => {
    expect(() => buildOpeningBalance([openingLine("5000", 1000, "D")])).toThrow(/5000/);
  });

  it("returns an empty object for a book with no opening journal", () => {
    expect(buildOpeningBalance([{ sourceJournalID: "sales", accountMainID: "4000", amount: 100 }])).toEqual({});
  });
});

// ── countGrouped ───────────────────────────────────────────────────────────

describe("countGrouped", () => {
  it("counts sales, purchases, and bank transactions", () => {
    const grouped = {
      sales: { apr: [1, 2], may: [3] },
      purchases: { apr: [1] },
      bank: { 1200: { apr: [1, 2, 3] } },
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
      sales: { 4000: { accountMainDescription: "Sales A" }, 4006: { accountMainDescription: "FA Sales" } },
      purchases: { 5000: { accountMainDescription: "Stock" }, 9999: { accountMainDescription: "Unknown" } },
    };
    const filtered = bstAccountFilter(accounts);
    expect(Object.keys(filtered.sales)).toEqual(["4000"]);
    expect(Object.keys(filtered.purchases)).toEqual(["5000"]);
  });
});

describe("seAccountFilter", () => {
  it("includes all sales but filters purchases and bank", () => {
    const accounts = {
      sales: { 4000: {}, 4006: {} },
      purchases: { 5000: {}, 9999: {} },
      bank: { 1200: {}, 1210: {} },
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

// ── Per-chart purchase code maps ───────────────────────────────────────────

describe("taxi purchase code maps", () => {
  it("reads 5100 as fuel where the builder's chart reads it as wages", () => {
    expect(TAXI_PURCHASE_CODE_MAP[5100]).toBe("d");
    expect(TAXI_BST_PURCHASE_CODE_MAP[5100]).toBe("m");
    expect(SE_PURCHASE_CODE_MAP[5100]).toBe("w");
  });

  it("puts the taxi capital account at 7000, not 5900", () => {
    expect(TAXI_PURCHASE_CODE_MAP[7000]).toBe("f");
    expect(BST_PURCHASE_CODE_MAP[5900]).toBe("f");
    expect(TAXI_PURCHASE_CODE_MAP[5900]).toBe("l");
  });
});

describe("assertPurchaseCodesCoverChart", () => {
  const book = { accounts: { purchases: { 5000: {}, 5001: {} } } };

  it("passes when every purchase account has a code", () => {
    expect(() => assertPurchaseCodesCoverChart(book, BST_PURCHASE_CODE_MAP, "BST_PURCHASE_CODE_MAP")).not.toThrow();
  });

  it("names the accounts the map has no code for", () => {
    expect(() => assertPurchaseCodesCoverChart({ accounts: { purchases: { 5000: {}, 8888: {} } } }, BST_PURCHASE_CODE_MAP, "map")).toThrow(
      /map has no code letter for purchase account 8888/,
    );
  });
});

// ── Sole trader adaptation ─────────────────────────────────────────────────

describe("withoutDirectorPayroll", () => {
  const book = {
    employees: [
      { employeeID: "EMP001", isDirector: true },
      { employeeID: "EMP002", isDirector: false },
    ],
  };
  const lines = [
    { "sourceJournalID": "payroll", "diya-gl:employeeID": "EMP001", "amount": 1048 },
    { "sourceJournalID": "payroll", "diya-gl:employeeID": "EMP002", "amount": 1500 },
    { sourceJournalID: "purchases", amount: 60 },
  ];

  it("drops the director's payslips and keeps the staff's", () => {
    const kept = withoutDirectorPayroll(lines, book);
    expect(kept.map((line) => line.amount)).toEqual([1500, 60]);
  });
});

// ── Takings ────────────────────────────────────────────────────────────────

describe("monthlySalesTotals", () => {
  const salesLines = [
    { postingDate: "2025-04-07", amount: 174 },
    { postingDate: "2025-04-25", amount: 226 },
    { postingDate: "2025-05-06", amount: 100 },
  ];

  it("totals each month and dates it on the month's last taking", () => {
    expect(monthlySalesTotals(salesLines)).toEqual([
      { date: "2025-04-25", amount: 400 },
      { date: "2025-05-06", amount: 100 },
    ]);
  });
});

describe("takingsOnlySales", () => {
  it("leaves a sales row carrying nothing but its date and amount", () => {
    const grouped = { sales: { apr: [{ date: "2025-04-07", customer: "Daily fares", code: "a", amount: 174 }] } };
    expect(takingsOnlySales(grouped).sales.apr).toEqual([{ date: "2025-04-07", amount: 174 }]);
  });
});

// ── Fixed asset additions ──────────────────────────────────────────────────

describe("fixedAssetAdditions", () => {
  const lines = [
    {
      sourceJournalID: "purchases",
      accountMainID: "7000",
      postingDate: "2025-05-10",
      lineItemComment: "Dashcam",
      documentReference: "AMZ-1",
      amount: 200,
    },
    {
      sourceJournalID: "purchases",
      accountMainID: "5100",
      postingDate: "2025-05-11",
      lineItemComment: "Fuel",
      documentReference: "SH-1",
      amount: 52,
    },
  ];

  it("registers only the purchases coded to the capital column", () => {
    expect(fixedAssetAdditions(lines, TAXI_PURCHASE_CODE_MAP, "f")).toEqual([
      { date: "2025-05-10", description: "Dashcam", reference: "AMZ-1", cost: 200 },
    ]);
  });
});

// ── Expected figures ───────────────────────────────────────────────────────

describe("totalsByCode", () => {
  it("adds a code's purchases and ignores every other journal", () => {
    const lines = [
      { sourceJournalID: "purchases", accountMainID: "5000", amount: 800 },
      { sourceJournalID: "purchases", accountMainID: "5000", amount: 450 },
      { sourceJournalID: "sales", accountMainID: "4000", amount: 4550 },
    ];
    expect(totalsByCode(lines, BST_PURCHASE_CODE_MAP)).toEqual({ s: 1250 });
  });
});

describe("bstExpectedFigures", () => {
  const lines = [
    { sourceJournalID: "sales", accountMainID: "4000", amount: 75000 },
    { sourceJournalID: "purchases", accountMainID: "5000", amount: 15000 },
    { sourceJournalID: "purchases", accountMainID: "5001", amount: 20000 },
    { sourceJournalID: "purchases", accountMainID: "5501", amount: 720 },
    { sourceJournalID: "purchases", accountMainID: "5900", amount: 12000 },
  ];

  it("takes the stock movement into cost of sales and capitalises the code f spend", () => {
    const figures = bstExpectedFigures(lines, { openingValue: 3000, closingValue: 2500 });
    expect(figures.gross_profit).toBe(39500);
    expect(figures.net_profit).toBe(38780);
    expect(figures.opening_stock).toBe(3000);
  });

  it("expects nothing of a column the trade never used", () => {
    const figures = bstExpectedFigures(lines, undefined);
    expect(figures.total_gen_admin).toBe(720);
    expect(figures.total_premises).toBeUndefined();
    expect(figures.opening_stock).toBeUndefined();
  });
});

describe("taxiExpectedFigures", () => {
  const tax = { capitalAllowances: { mainRateWDA: 0.18 } };
  const lines = [
    { sourceJournalID: "sales", accountMainID: "4000", amount: 36000 },
    { sourceJournalID: "purchases", accountMainID: "5100", amount: 3600 },
    { sourceJournalID: "purchases", accountMainID: "5400", amount: 1380 },
    { sourceJournalID: "purchases", accountMainID: "5700", amount: 480 },
    { sourceJournalID: "purchases", accountMainID: "5900", amount: 900 },
    { sourceJournalID: "purchases", accountMainID: "7000", amount: 8000 },
  ];

  it("allows the main rate writing down allowance on the year's capital spend", () => {
    expect(taxiExpectedFigures(lines, tax)).toEqual({ total_sales: 36000, gross_profit: 29580, net_profit: 28200 });
  });
});

// ── Subset books ───────────────────────────────────────────────────────────

describe("buildSubsetBook", () => {
  const book = {
    documentInfo: { entriesComment: "Everything", periodCoveredStart: "2025-04-01" },
    entityInformation: { organizationIdentifier: "BrickWork Pro Ltd" },
    accounts: { sales: { 4000: {} }, purchases: { 5000: {}, 9999: {} } },
    tax: { incomeTax: { basicRate: 0.2 }, corporationTax: { mainRate: 0.25 } },
    employees: [{ employeeID: "EMP001" }],
    stock: { openingValue: 3000 },
  };

  it("narrows the chart and the tax tables to what the product carries", () => {
    const subset = buildSubsetBook(book, {
      subsetName: "bst-nonvat",
      entity: { organizationIdentifier: "BrickWork Pro Trading" },
      taxSections: ["incomeTax"],
      accountFilter: bstAccountFilter,
      tables: { stock: book.stock },
    });
    expect(Object.keys(subset.tax)).toEqual(["incomeTax"]);
    expect(Object.keys(subset.accounts.purchases)).toEqual(["5000"]);
    expect(subset.entityInformation.organizationIdentifier).toBe("BrickWork Pro Trading");
    expect(subset.documentInfo.entriesComment).toBe("Subset: bst-nonvat — extracted from BrickWork Pro Ltd master data");
    expect(subset.stock).toEqual({ openingValue: 3000 });
    expect(subset.employees).toBeUndefined();
  });

  it("keeps the period the master book declares", () => {
    const subset = buildSubsetBook(book, {
      subsetName: "full",
      entity: book.entityInformation,
      taxSections: ["incomeTax", "corporationTax"],
      accountFilter: fullAccountFilter,
      employees: book.employees,
    });
    expect(subset.documentInfo.periodCoveredStart).toBe("2025-04-01");
    expect(subset.employees).toHaveLength(1);
  });
});
