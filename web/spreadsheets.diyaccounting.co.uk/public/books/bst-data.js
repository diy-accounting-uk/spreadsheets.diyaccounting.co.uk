// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 DIY Accounting Ltd

// books/bst-data.js
//
// ============================================================================
// W1 REPLACEMENT POINT
// ============================================================================
// This file is a static stand-in for the diya-gl book the real engine bundle
// (scripts/build-books-bundle.mjs, phase 3 track W0/W1) extracts from an
// uploaded workbook, recalculates, and reports on. Nothing here imports
// app/lib or app/products -- W-pre is pure web/ markup proving the design.
//
// When W1 wires the engine, this whole object is replaced by the bundle's
// live output: extractBook() -> calculateFromDiyaGl() -> checkCompliance().
// Every view in bst.js reads book data only through window.DIYA_BST_SNAPSHOT,
// so wiring the engine is a matter of replacing this file's contents with a
// loader call, not rewriting the views.
//
// The figures below are not invented. They are the "bst-scenario-basic"
// fixture (examples/precision-code-ltd/bst/book.toml + lines.jsonl), the
// same fixture behind the committed, verified RECONCILES report:
//   reports/GB_Accounts_Basic_Sole_Trader_2026_04_05__Apr26__Excel_2007_bst-scenario-basic.md
// Annual totals below match that report's Compliance Checks table exactly.
// Monthly figures are aggregated by hand from the fixture's own ledger lines
// (lines.jsonl), grouped by posting month and account code per the report's
// own cell-to-account mapping (its "Appendix: Cell Values" section). The
// stock movement (opening 10,000 - closing 6,000 = 4,000) is recognised in
// March, the accounting year end, exactly as the real Stock sheet does it --
// not spread across the months whose ledger lines never carry it.
// ============================================================================

(function (global) {
  "use strict";

  var MONTHS = [
    { key: "2025-04", label: "Apr" },
    { key: "2025-05", label: "May" },
    { key: "2025-06", label: "Jun" },
    { key: "2025-07", label: "Jul" },
    { key: "2025-08", label: "Aug" },
    { key: "2025-09", label: "Sep" },
    { key: "2025-10", label: "Oct" },
    { key: "2025-11", label: "Nov" },
    { key: "2025-12", label: "Dec" },
    { key: "2026-01", label: "Jan" },
    { key: "2026-02", label: "Feb" },
    { key: "2026-03", label: "Mar" },
  ];

  // P&L category columns, in the sheet's own left-to-right order.
  var CATEGORIES = [
    { key: "sales", label: "Sales Turnover" },
    { key: "costOfSales", label: "Cost of Sales" },
    { key: "directCosts", label: "Direct Costs" },
    { key: "grossProfit", label: "Gross Profit", computed: true },
    { key: "employeeCosts", label: "Employee Costs" },
    { key: "premisesCosts", label: "Premises Costs" },
    { key: "repairs", label: "Repairs & Maintenance" },
    { key: "generalAdmin", label: "General Admin" },
    { key: "motorExpenses", label: "Motor Expenses" },
    { key: "travel", label: "Travel & Subsistence" },
    { key: "advertising", label: "Advertising" },
    { key: "legalProfessional", label: "Legal & Professional" },
    { key: "badDebts", label: "Bad Debts" },
    { key: "interestFinance", label: "Interest & Finance" },
    { key: "otherExpenses", label: "Other Expenses" },
    { key: "totalExpenses", label: "Total Expenses", computed: true },
    { key: "netProfit", label: "Net Profit", computed: true },
  ];

  var MONTHLY = {
    "2025-04": {
      sales: 33400,
      costOfSales: 600,
      directCosts: 0,
      employeeCosts: 5700,
      premisesCosts: 1200,
      repairs: 120,
      generalAdmin: 135,
      motorExpenses: 602.25,
      travel: 92,
      advertising: 0,
      legalProfessional: 300,
      badDebts: 0,
      interestFinance: 0,
      otherExpenses: 2062,
      capex: 0,
      grossProfit: 32800,
      totalExpenses: 10211.25,
      netProfit: 22588.75,
    },
    "2025-05": {
      sales: 32920,
      costOfSales: 720,
      directCosts: 0,
      employeeCosts: 5700,
      premisesCosts: 1200,
      repairs: 0,
      generalAdmin: 153,
      motorExpenses: 666,
      travel: 152,
      advertising: 600,
      legalProfessional: 300,
      badDebts: 0,
      interestFinance: 0,
      otherExpenses: 784,
      capex: 1800,
      grossProfit: 32200,
      totalExpenses: 9555,
      netProfit: 22645,
    },
    "2025-06": {
      sales: 35200,
      costOfSales: 360,
      directCosts: 5000,
      employeeCosts: 5700,
      premisesCosts: 1560,
      repairs: 0,
      generalAdmin: 231,
      motorExpenses: 654,
      travel: 272,
      advertising: 0,
      legalProfessional: 300,
      badDebts: 0,
      interestFinance: 250,
      otherExpenses: 430,
      capex: 0,
      grossProfit: 29840,
      totalExpenses: 9397,
      netProfit: 20443,
    },
    "2025-07": {
      sales: 33760,
      costOfSales: 720,
      directCosts: 0,
      employeeCosts: 5700,
      premisesCosts: 1200,
      repairs: 180,
      generalAdmin: 159,
      motorExpenses: 584.25,
      travel: 92,
      advertising: 480,
      legalProfessional: 300,
      badDebts: 0,
      interestFinance: 0,
      otherExpenses: 4144,
      capex: 1200,
      grossProfit: 33040,
      totalExpenses: 12839.25,
      netProfit: 20200.75,
    },
    "2025-08": {
      sales: 36020,
      costOfSales: 540,
      directCosts: 0,
      employeeCosts: 6500,
      premisesCosts: 1200,
      repairs: 240,
      generalAdmin: 135,
      motorExpenses: 602.25,
      travel: 140,
      advertising: 0,
      legalProfessional: 300,
      badDebts: 0,
      interestFinance: 0,
      otherExpenses: 448,
      capex: 0,
      grossProfit: 35480,
      totalExpenses: 9565.25,
      netProfit: 25914.75,
    },
    "2025-09": {
      sales: 33760,
      costOfSales: 240,
      directCosts: 0,
      employeeCosts: 5700,
      premisesCosts: 1500,
      repairs: 0,
      generalAdmin: 147,
      motorExpenses: 708,
      travel: 92,
      advertising: 0,
      legalProfessional: 1260,
      badDebts: 0,
      interestFinance: 208,
      otherExpenses: 820,
      capex: 0,
      grossProfit: 33520,
      totalExpenses: 10435,
      netProfit: 23085,
    },
    "2025-10": {
      sales: 35560,
      costOfSales: 480,
      directCosts: 0,
      employeeCosts: 5700,
      premisesCosts: 1200,
      repairs: 96,
      generalAdmin: 135,
      motorExpenses: 606.75,
      travel: 212,
      advertising: 3000,
      legalProfessional: 300,
      badDebts: 0,
      interestFinance: 0,
      otherExpenses: 976,
      capex: 36000,
      grossProfit: 35080,
      totalExpenses: 12225.75,
      netProfit: 22854.25,
    },
    "2025-11": {
      sales: 35320,
      costOfSales: 840,
      directCosts: 3000,
      employeeCosts: 5700,
      premisesCosts: 1200,
      repairs: 0,
      generalAdmin: 165,
      motorExpenses: 645,
      travel: 164,
      advertising: 0,
      legalProfessional: 300,
      badDebts: 0,
      interestFinance: 0,
      otherExpenses: 604,
      capex: 0,
      grossProfit: 31480,
      totalExpenses: 8778,
      netProfit: 22702,
    },
    "2025-12": {
      sales: 32800,
      costOfSales: 480,
      directCosts: 0,
      employeeCosts: 5700,
      premisesCosts: 1620,
      repairs: 0,
      generalAdmin: 255,
      motorExpenses: 613.5,
      travel: 92,
      advertising: 0,
      legalProfessional: 300,
      badDebts: 500,
      interestFinance: 167,
      otherExpenses: 5424,
      capex: 0,
      grossProfit: 32320,
      totalExpenses: 14671.5,
      netProfit: 17648.5,
    },
    "2026-01": {
      sales: 35440,
      costOfSales: 600,
      directCosts: 0,
      employeeCosts: 5700,
      premisesCosts: 1200,
      repairs: 144,
      generalAdmin: 153,
      motorExpenses: 638.25,
      travel: 92,
      advertising: 480,
      legalProfessional: 300,
      badDebts: 0,
      interestFinance: 0,
      otherExpenses: 904,
      capex: 0,
      grossProfit: 34840,
      totalExpenses: 9611.25,
      netProfit: 25228.75,
    },
    "2026-02": {
      sales: 34360,
      costOfSales: 660,
      directCosts: 0,
      employeeCosts: 5700,
      premisesCosts: 1200,
      repairs: 360,
      generalAdmin: 135,
      motorExpenses: 595.5,
      travel: 368,
      advertising: 0,
      legalProfessional: 300,
      badDebts: 0,
      interestFinance: 0,
      otherExpenses: 778,
      capex: 0,
      grossProfit: 33700,
      totalExpenses: 9436.5,
      netProfit: 24263.5,
    },
    "2026-03": {
      sales: 31360,
      // Includes the 4,000 year-end stock movement adjustment (opening
      // 10,000 - closing 6,000); see the module comment above.
      costOfSales: 4300,
      directCosts: 0,
      employeeCosts: 5700,
      premisesCosts: 1560,
      repairs: 0,
      generalAdmin: 159,
      motorExpenses: 682.5,
      travel: 92,
      advertising: 0,
      legalProfessional: 300,
      badDebts: 0,
      interestFinance: 125,
      otherExpenses: 508,
      capex: 0,
      grossProfit: 27060,
      totalExpenses: 9126.5,
      netProfit: 17933.5,
    },
  };

  // Annual totals row -- matches the reconciliation report's Compliance
  // Checks table exactly (net profit and total expenses carry the same
  // 0.25 mileage-rounding residue the report itself records as PASS).
  var ANNUAL = {
    sales: 409900,
    costOfSales: 10540,
    directCosts: 8000,
    employeeCosts: 69200,
    premisesCosts: 15840,
    repairs: 1140,
    generalAdmin: 1962,
    motorExpenses: 7598.25,
    travel: 1860,
    advertising: 4560,
    legalProfessional: 4560,
    badDebts: 500,
    interestFinance: 750,
    otherExpenses: 17882,
    capex: 39000,
    grossProfit: 391360,
    totalExpenses: 125852.25,
    netProfit: 265507.75,
  };

  // April 2025 entries -- the month drilled open by default in the year
  // table. Real lines from lines.jsonl, unedited.
  var APRIL_ENTRIES = {
    monthKey: "2025-04",
    sales: [
      { date: "2025-04-01", account: "4001", label: "Beta Systems", detail: "Software licence renewal", amount: 1200 },
      { date: "2025-04-03", account: "4001", label: "FreshField Ltd", detail: "Software monitoring licence", amount: 360 },
      { date: "2025-04-05", account: "4001", label: "CloudNine Ltd", detail: "SaaS licence fee", amount: 600 },
      { date: "2025-04-08", account: "4000", label: "Cedar Systems", detail: "Managed services", amount: 480 },
      { date: "2025-04-10", account: "4000", label: "Pinnacle Group", detail: "Monthly support contract", amount: 720 },
      { date: "2025-04-15", account: "4000", label: "Acme Corp", detail: "IT consultancy services", amount: 25000 },
      { date: "2025-04-18", account: "4000", label: "TechStart Ltd", detail: "IT consultancy retainer", amount: 2400 },
      { date: "2025-04-20", account: "4000", label: "DataFlow Inc", detail: "Ad-hoc consultancy project", amount: 1800 },
      { date: "2025-04-28", account: "4003", label: "Horizon Analytics", detail: "Data analytics commission", amount: 840 },
    ],
    purchases: [
      { date: "2025-04-01", account: "5200", label: "WorkSpace Ltd", detail: "Monthly office rent", amount: 1200 },
      { date: "2025-04-01", account: "5501", label: "Microsoft", detail: "Microsoft 365 subscription", amount: 30 },
      { date: "2025-04-01", account: "5501", label: "Slack", detail: "Slack team subscription", amount: 15 },
      { date: "2025-04-01", account: "5002", label: "GitHub", detail: "GitHub Team subscription", amount: 45 },
      { date: "2025-04-01", account: "5700", label: "Hiscox", detail: "Professional indemnity insurance", amount: 1440 },
      { date: "2025-04-01", account: "5002", label: "Cloudflare", detail: "CDN and DNS services", amount: 24 },
      { date: "2025-04-01", account: "5501", label: "Zoom", detail: "Video conferencing subscription", amount: 18 },
      { date: "2025-04-03", account: "5002", label: "AWS", detail: "Cloud hosting charges", amount: 180 },
      { date: "2025-04-03", account: "5401", label: "Argos", detail: "Miscellaneous office items", amount: 22 },
      { date: "2025-04-05", account: "5401", label: "Ryman", detail: "Stationery supplies", amount: 24 },
      { date: "2025-04-05", account: "5601", label: "BP", detail: "Fuel for company vehicle", amount: 180 },
      { date: "2025-04-05", account: "5002", label: "DigitalOcean", detail: "Cloud VPS hosting", amount: 36 },
      { date: "2025-04-08", account: "5600", label: "National Rail", detail: "Train ticket client meeting", amount: 48 },
      { date: "2025-04-10", account: "5401", label: "Amazon", detail: "Office supplies", amount: 36 },
      { date: "2025-04-10", account: "5701", label: "Xerox", detail: "Printer lease payment", amount: 180 },
      { date: "2025-04-10", account: "5000", label: "TechParts", detail: "Hardware components for resale", amount: 600 },
      { date: "2025-04-12", account: "5601", label: "NCP", detail: "Parking charges", amount: 18 },
      { date: "2025-04-14", account: "5401", label: "Toolstation", detail: "Assorted fixings and parts", amount: 42 },
      { date: "2025-04-14", account: "5600", label: "Uber", detail: "Taxi to client site", amount: 24 },
      { date: "2025-04-14", account: "5600", label: "Costa Coffee", detail: "Client meeting refreshments", amount: 12 },
      { date: "2025-04-15", account: "5601", label: "Shell", detail: "Fuel for company vehicle", amount: 150 },
      { date: "2025-04-15", account: "5501", label: "Royal Mail", detail: "Postage", amount: 12 },
      { date: "2025-04-18", account: "5601", label: "Jet", detail: "Fuel for company vehicle", amount: 96 },
      { date: "2025-04-20", account: "5501", label: "BT", detail: "Business telephone line rental", amount: 60 },
      { date: "2025-04-20", account: "5400", label: "Office Maintenance Ltd", detail: "Premises maintenance and repairs", amount: 120 },
      { date: "2025-04-21", account: "5600", label: "Greggs", detail: "Working lunch", amount: 8 },
      { date: "2025-04-22", account: "5401", label: "Screwfix", detail: "Miscellaneous supplies", amount: 18 },
      { date: "2025-04-25", account: "5401", label: "Wilko", detail: "Cleaning and kitchen supplies", amount: 15 },
      { date: "2025-04-25", account: "5601", label: "Mileage claim", detail: "Business mileage to Manchester", amount: 38.25 },
      { date: "2025-04-28", account: "5601", label: "Shell", detail: "Additional fuel purchase", amount: 120 },
      { date: "2025-04-30", account: "5800", label: "Smith & Co", detail: "Monthly accountancy retainer", amount: 300 },
      { date: "2025-04-30", account: "5101", label: "Alice Johnson", detail: "Salary Apr 2025", amount: 3500 },
      { date: "2025-04-30", account: "5101", label: "Bob Williams", detail: "Salary Apr 2025", amount: 2200 },
    ],
  };

  // Illustrative pencil-correction pairs -- real expected/actual pairs lifted
  // from the RECONCILES report's own Compliance Checks table (the same small
  // mileage-rate rounding residue the report records as PASS). W1 replaces
  // these with the true as-read-vs-recalculated pairing computed live from
  // the uploaded workbook's cached <v> values.
  var DRIFT = [
    {
      id: "motor-expenses",
      label: "P&L: Motor Expenses",
      view: "profit-loss",
      computed: 7598.25,
      asRead: 7598.0,
      note: "motoring paid for + the mileage claimed",
    },
    {
      id: "purchases-cash-journal",
      label: "Purchases: cash journal total",
      view: "year",
      computed: 178777.75,
      asRead: 178778.0,
      note: "expenses + direct costs + stock purchases + capitalised assets",
    },
    {
      id: "income-tax-total",
      label: "Income Tax",
      view: "income-tax",
      computed: 88131.6,
      asRead: 88132.0,
      note: "basic + higher + additional rate bands",
    },
    {
      id: "total-tax-ni",
      label: "Total Tax + NI",
      view: "income-tax",
      computed: 93918.36,
      asRead: 93918.0,
      note: "Income Tax + NI Class 4",
    },
  ];

  var CHECKS = [
    { id: "total-sales", label: "Total Sales", expected: 409900, actual: 409900, result: "pass" },
    { id: "gross-profit", label: "Gross Profit", expected: 391360, actual: 391360, result: "pass" },
    { id: "net-profit", label: "Net Profit", expected: 265508, actual: 265507.75, result: "pass" },
    { id: "premises-costs", label: "Premises Costs", expected: 15840, actual: 15840, result: "pass" },
    { id: "purchases-cash-journal", label: "Purchases: cash journal total", expected: 178778, actual: 178777.75, result: "pass" },
    { id: "motor-expenses", label: "P&L: Motor Expenses", expected: 7598.25, actual: 7598, result: "pass" },
    { id: "stock-cost-of-sales", label: "Stock: cost of sales", expected: 10540, actual: 10540, result: "pass" },
    { id: "fixed-assets-schedule", label: "Fixed Assets: schedule total cost = additions", expected: 39000, actual: 39000, result: "pass" },
    { id: "income-tax", label: "Income Tax", expected: 88132, actual: 88131.6, result: "pass" },
    { id: "total-tax-ni", label: "Total Tax + NI", expected: 93918, actual: 93918.36, result: "pass" },
    { id: "sa103s-turnover", label: "SA103S: Turnover = P&L Sales", expected: 409900, actual: 409900, result: "pass" },
    {
      id: "bridge-residue",
      label: "Accounting profit to tax profit bridge closes to zero",
      expected: 0,
      actual: 0,
      result: "pass",
    },
    {
      id: "mileage-rounding",
      label: "Motor expenses ledger vs mileage-rate recalculation",
      expected: 7598.25,
      actual: 7598.0,
      result: "warn",
      helper: {
        title: "Mileage rate rounding",
        preview:
          "The mileage claim was posted at a rounded pence-per-mile rate. Recalculating from the year's approved rates moves Motor Expenses by +0.25.",
        actionLabel: "Preview fix",
      },
    },
  ];

  var STOCK = { opening: 10000, closing: 6000, atCost: 10000 };

  var DEBTORS = {
    opening: [
      { counterparty: "Acme Corp", invoice: "INV-0901", amount: 7200 },
      { counterparty: "Beta Systems", invoice: "INV-0902", amount: 1200 },
      { counterparty: "Gamma Ltd", invoice: "INV-0903", amount: 2400 },
    ],
    closing: [
      { counterparty: "Acme Corp", invoice: "INV-1012", amount: 6100 },
      { counterparty: "WidgetWorks", invoice: "INV-2104", amount: 1440 },
      { counterparty: "Zeta Corp", invoice: "CN-1801", amount: 360 },
    ],
  };

  var CREDITORS = {
    opening: [
      { counterparty: "WorkSpace Ltd", invoice: "WS-2403", amount: 1200 },
      { counterparty: "Hiscox", invoice: "HX-1190", amount: 300 },
      { counterparty: "Smith & Co", invoice: "SC-0087", amount: 600 },
      { counterparty: "BT", invoice: "BT-5521", amount: 120 },
    ],
    closing: [
      { counterparty: "WorkSpace Ltd", invoice: "WS-2988", amount: 1200 },
      { counterparty: "Hiscox", invoice: "HX-1244", amount: 300 },
      { counterparty: "Smith & Co", invoice: "SC-0112", amount: 60 },
      { counterparty: "BT", invoice: "BT-5602", amount: 150 },
    ],
  };

  var FIXED_ASSETS = {
    additions: [{ description: "New Asset Cost (Plant & Machinery)", cost: 1800 }],
    totalCost: 39000,
    aia: 39000,
    wda: 0,
    writtenDownValue: 0,
    disposals: 0,
    balancingCharge: 0,
  };

  var INCOME_TAX = {
    profitFromSelfEmployment: 226508,
    personalAllowance: 0,
    taxableIncome: 226508,
    bands: [
      { label: "Basic rate", rate: 0.2, ceiling: 37700, tax: 7540, box: "E8" },
      { label: "Higher rate", rate: 0.4, ceiling: 125140, tax: 34976, box: "E9" },
      { label: "Additional rate", rate: 0.45, ceiling: null, tax: 45615.6, box: "E10" },
    ],
    totalIncomeTax: 88131.6,
    cisDeducted: 0,
    niClass4Lower: 2262,
    niClass4Upper: 3524.76,
    totalTaxAndNi: 93918.36,
  };

  var SA103S = {
    sections: [
      {
        heading: "Business income",
        rows: [{ box: "8", label: "Turnover", amount: 409900 }],
      },
      {
        heading: "Allowable business expenses",
        rows: [
          { box: "16", label: "Cost of goods bought for resale or goods used", amount: 18540 },
          { box: "19", label: "Car, van and travel expenses", amount: 9458 },
          { box: "20", label: "Wages, salaries and other staff costs", amount: 69200 },
          { box: "21", label: "Rent, rates, power and insurance costs", amount: 15840 },
          { box: "23", label: "Repairs and renewals of property and equipment", amount: 1140 },
        ],
      },
      {
        heading: "Net profit",
        rows: [
          { box: "31", label: "Net profit", amount: 265508, total: true },
          { box: "32", label: "Or net loss", amount: 0 },
        ],
      },
      {
        heading: "Capital allowances",
        rows: [
          { box: "49", label: "Annual investment allowance", amount: 39000 },
          { box: "50", label: "Business premises renovation allowance", amount: 0 },
          { box: "51", label: "All other capital allowances", amount: 0 },
          { box: "52", label: "Balancing charges", amount: 0 },
        ],
      },
      {
        heading: "Taxable profit",
        rows: [
          { box: "57", label: "Total taxable profits", amount: 226508, total: true },
          { box: "70", label: "Loss brought forward", amount: 0 },
          { box: "71", label: "Any other business income", amount: 0 },
        ],
      },
    ],
  };

  var ADMIN = {
    year: "2025/26",
    source: "app/data/2026.toml",
    rates: [
      { label: "Personal Allowance", value: 12570, format: "currency" },
      { label: "Personal Allowance Taper Threshold", value: 100000, format: "currency" },
      { label: "Basic Rate", value: 0.2, format: "rate" },
      { label: "Higher Rate", value: 0.4, format: "rate" },
      { label: "Additional Rate", value: 0.45, format: "rate" },
      { label: "Basic Band End", value: 37700, format: "currency" },
      { label: "Higher Band Start", value: 37701, format: "currency" },
      { label: "Higher Band End", value: 125140, format: "currency" },
      { label: "NI Class 2 Rate", value: 0, format: "rate" },
      { label: "NI Class 4 Lower Rate", value: 0.06, format: "rate" },
      { label: "NI Class 4 Lower Limit", value: 12570, format: "currency" },
      { label: "NI Class 4 Upper Rate", value: 0.02, format: "rate" },
      { label: "NI Class 4 Upper Limit", value: 50270, format: "currency" },
      { label: "Annual Investment Allowance Rate", value: 1, format: "rate" },
      { label: "Writing Down Allowance Rate", value: 0.18, format: "rate" },
      { label: "Mileage Higher Rate Limit (miles)", value: 10000, format: "number" },
      { label: "Mileage Higher Rate", value: 0.45, format: "pence" },
      { label: "Mileage Lower Rate Start (miles)", value: 10001, format: "number" },
      { label: "Mileage Lower Rate", value: 0.25, format: "pence" },
      { label: "VAT Registration Threshold", value: 90000, format: "currency" },
    ],
  };

  var BUSINESS_DETAILS = {
    organizationIdentifier: "Precision Code Trading",
    organizationDescription: "IT consultancy and software development",
    organizationAddressLine: "123 High Street",
    organizationTown: "Manchester",
    organizationPostcode: "M1 1AA",
    periodCoveredStart: "2025-04-01",
    periodCoveredEnd: "2026-03-31",
    basisOfAccounting: "cash",
    vatRegistered: false,
  };

  global.DIYA_BST_SNAPSHOT = {
    scenario: "bst-scenario-basic",
    sourceReport: "GB_Accounts_Basic_Sole_Trader_2026_04_05__Apr26__Excel_2007_bst-scenario-basic.md",
    months: MONTHS,
    categories: CATEGORIES,
    monthly: MONTHLY,
    annual: ANNUAL,
    entries: { "2025-04": APRIL_ENTRIES },
    drift: DRIFT,
    checks: CHECKS,
    stock: STOCK,
    debtors: DEBTORS,
    creditors: CREDITORS,
    fixedAssets: FIXED_ASSETS,
    incomeTax: INCOME_TAX,
    sa103s: SA103S,
    admin: ADMIN,
    businessDetails: BUSINESS_DETAILS,
  };
})(window);
