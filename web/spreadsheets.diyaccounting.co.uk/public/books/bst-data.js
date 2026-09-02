// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 DIY Accounting Ltd

// books/bst-data.js
//
// ============================================================================
// W1: live computation, wired
// ============================================================================
// This file was a static stand-in for the diya-gl book (see git history for
// the fixture-derived object it used to export). It now loads the real
// engine bundle (scripts/build-books-bundle.mjs) and computes
// window.DIYA_BST_SNAPSHOT for real, from one of three sources: an uploaded
// .xlsx/.zip, or one of the three BST reconciliation fixtures served as
// static assets. Every view in bst.js still reads book data only through
// window.DIYA_BST_SNAPSHOT -- this file is the extract/recalculate/report
// loop that fills it, not a rewrite of any view.
//
// Upload path: validateBstAnchors -> extractBstTransactions -> a book built
// from the same cells CELL_MAP names (entity, stock, debtors/creditors) ->
// loadTaxDataForBook -> diyaGlToScenario -> calculateFromDiyaGl ->
// checkCompliance. Every calculated cell CELL_MAP carries is also read back
// off the uploaded workbook's own cached value (xlsx-cells.js), canonicalised
// the way verify-roundtrip.js canonicalises a roundtrip comparison (money
// half-up to the penny, rates to 6 dp), and any cell that disagrees becomes a
// drift finding -- EQ1 live in the browser, and the breakability proof: a
// hand-corrupted cached <v> flips exactly that cell's drift and nothing else,
// because the computed side never reads the workbook's cells at all.
//
// Example path: book.toml + lines.jsonl only, no workbook to read a cached
// value from, so there is no as-read layer and no drift -- exactly what the
// data model section says an example carries.
// ============================================================================

(function (global) {
  "use strict";

  var EXAMPLE_BOOKS = {
    "bst-scenario-basic": {
      dir: "precision-code-ltd",
      product: "bst",
      label: "bst-scenario-basic — Precision Code Trading, 2025-04-01 to 2026-03-31",
    },
    "bst-brickwork-pro-nonvat": {
      dir: "brickwork-pro",
      product: "bst-nonvat",
      label: "bst-brickwork-pro-nonvat — BrickWork trade",
    },
    "bst-sp-sixty": {
      dir: "sp-sixty-driving",
      product: "bst",
      label: "bst-sp-sixty — no-ledger, mileage route",
    },
  };

  // The P&L category columns, in the sheet's own left-to-right order --
  // product-fixed, not tied to any one fixture.
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

  // The Basic Sole Trader chart's own account-to-category mapping, mirroring
  // the published chart in app/lib/scenario-extractor.js
  // (BST_PURCHASE_CODE_MAP / BST_SALES_ACCOUNTS). Used only to group the
  // month-by-month breakdown table the workbook has no single cell for --
  // every totals row, check verdict and drift finding comes from the
  // engine's own calculateFromDiyaGl output, never from this table.
  var BST_PURCHASE_CATEGORY = {
    5000: "stock",
    5001: "directCosts",
    5101: "employeeCosts",
    5200: "premisesCosts",
    5201: "premisesCosts",
    5400: "repairs",
    5501: "generalAdmin",
    5601: "motorExpenses",
    5600: "travel",
    5500: "advertising",
    5800: "legalProfessional",
    5803: "interestFinance",
    5801: "badDebts",
    5002: "otherExpenses",
    5300: "otherExpenses",
    5301: "otherExpenses",
    5401: "otherExpenses",
    5700: "otherExpenses",
    5701: "otherExpenses",
    5802: "otherExpenses",
    5100: "otherExpenses",
    5900: "capex",
  };
  var BST_SALES_ACCOUNTS = { 4000: 1, 4001: 1, 4002: 1, 4003: 1, 4004: 1, 4005: 1 };

  // The named debtor/creditor ledger's own column layout on "Debtors &
  // Creditors" (verified against app/products/bst.js's cellWrites and
  // mirrored by CELL_MAP's amount cells): name then amount, three opening and
  // three closing debtor rows from 5, four opening and four closing creditor
  // rows from 12.
  var LEDGER_LAYOUT = {
    debtors: { name: "B", amount: "C", closeName: "E", closeAmount: "F", firstRow: 5, slots: 3 },
    creditors: { name: "B", amount: "C", closeName: "E", closeAmount: "F", firstRow: 12, slots: 4 },
  };

  // ============================== canonicalisation ==============================
  // Mirrors app/bin/verify-roundtrip.js's canonicalForUnit: a money value
  // rounds half up at a working precision finer than a penny first (so
  // binary-float noise never nudges the penny the wrong way), then to the
  // penny; a rate rounds half up to six places. Both operate on the numbers
  // the engine and the workbook already hand back -- there is no string
  // decimal arithmetic here, only enough guard to keep IEEE-754 noise from
  // reading as a genuine difference.
  var WORKING_DECIMALS = 6;
  var MONEY_DECIMALS = 2;
  var RATE_DECIMALS = 6;

  function roundHalfUp(value, decimals) {
    if (typeof value !== "number" || !isFinite(value)) return value;
    var factor = Math.pow(10, decimals);
    var guarded = value + (value >= 0 ? 1 : -1) * Math.max(Math.abs(value), 1) * 1e-9;
    var sign = guarded < 0 ? -1 : 1;
    return (sign * Math.round(Math.abs(guarded) * factor)) / factor;
  }

  function canonicalise(value, unit) {
    if (typeof value !== "number" || !isFinite(value)) return value;
    if (unit === "rate") return roundHalfUp(value, RATE_DECIMALS);
    return roundHalfUp(roundHalfUp(value, WORKING_DECIMALS), MONEY_DECIMALS);
  }

  // ============================== engine loading ==============================

  var enginePromise = null;
  function loadEngine() {
    if (!enginePromise) enginePromise = import("./engine/diya-gl-engine.js");
    return enginePromise;
  }

  var resourcesPromise = null;
  function loadResources() {
    if (!resourcesPromise) resourcesPromise = import("./bundle-resources.js").then((m) => m.browserResourceLoader());
    return resourcesPromise;
  }

  var schemasReady = null;
  function ensureSchemas(engine, resources) {
    if (!schemasReady) schemasReady = engine.loadSchemasFrom(resources);
    return schemasReady;
  }

  // ============================== the diya-gl -> snapshot mapping ==============================

  function monthKeyOf(dateStr) {
    return dateStr.slice(0, 7);
  }

  var MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function buildMonths(periodStartISO) {
    var parts = periodStartISO.split("-").map(Number);
    var startYear = parts[0];
    var startMonth = parts[1]; // 1-12
    var months = [];
    for (var i = 0; i < 12; i++) {
      var total = startMonth - 1 + i;
      var year = startYear + Math.floor(total / 12);
      var monthIndex = total % 12;
      months.push({ key: year + "-" + String(monthIndex + 1).padStart(2, "0"), label: MONTH_LABELS[monthIndex] });
    }
    return months;
  }

  function emptyMonthRow() {
    return {
      sales: 0,
      costOfSales: 0,
      directCosts: 0,
      employeeCosts: 0,
      premisesCosts: 0,
      repairs: 0,
      generalAdmin: 0,
      motorExpenses: 0,
      travel: 0,
      advertising: 0,
      legalProfessional: 0,
      badDebts: 0,
      interestFinance: 0,
      otherExpenses: 0,
      capex: 0,
    };
  }

  // The month-by-month breakdown table has no single workbook cell to read
  // (the sheet only totals the year, on Profit & Loss Acc), so it is
  // aggregated here from the same lines the engine calculated from, grouped
  // by posting month and the BST chart's own category. The year-end stock
  // movement is recognised in the period's last month, exactly as the Stock
  // sheet's own opening-minus-closing chain carries it -- never spread across
  // the months whose ledger lines carry only purchases.
  function buildMonthlyAndEntries(lines, months, stock) {
    var monthly = {};
    var entries = {};
    var i;
    for (i = 0; i < months.length; i++) {
      monthly[months[i].key] = emptyMonthRow();
      entries[months[i].key] = { monthKey: months[i].key, sales: [], purchases: [] };
    }
    var lastKey = months[months.length - 1].key;

    for (i = 0; i < lines.length; i++) {
      var line = lines[i];
      var monthKey = monthKeyOf(line.postingDate);
      if (!monthly[monthKey]) continue; // outside the declared period
      var code = Number(line.accountMainID);
      if (line.sourceJournalID === "sales") {
        if (!BST_SALES_ACCOUNTS[code]) continue;
        monthly[monthKey].sales += line.amount;
        entries[monthKey].sales.push({
          date: line.postingDate,
          account: String(line.accountMainID),
          label: line.detailComment || "",
          detail: line.documentReference || "",
          amount: line.amount,
        });
      } else if (line.sourceJournalID === "purchases") {
        var category = BST_PURCHASE_CATEGORY[code];
        if (!category) continue;
        if (category === "stock") monthly[monthKey].costOfSales += line.amount;
        else monthly[monthKey][category] += line.amount;
        entries[monthKey].purchases.push({
          date: line.postingDate,
          account: String(line.accountMainID),
          label: line.detailComment || "",
          detail: line.documentReference || "",
          amount: line.amount,
        });
      }
    }

    if (stock && monthly[lastKey]) {
      monthly[lastKey].costOfSales += (stock.openingValue || 0) - (stock.closingValue || 0);
    }

    for (i = 0; i < months.length; i++) {
      var row = monthly[months[i].key];
      row.grossProfit = row.sales - row.costOfSales - row.directCosts;
      row.totalExpenses =
        row.employeeCosts +
        row.premisesCosts +
        row.repairs +
        row.generalAdmin +
        row.motorExpenses +
        row.travel +
        row.advertising +
        row.legalProfessional +
        row.badDebts +
        row.interestFinance +
        row.otherExpenses;
      row.netProfit = row.grossProfit - row.totalExpenses;
      entries[months[i].key].sales.sort(function (a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      });
      entries[months[i].key].purchases.sort(function (a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      });
    }

    return { monthly: monthly, entries: entries };
  }

  // The annual totals row: the authoritative figures the checks panel itself
  // reads, straight off calculateFromDiyaGl's own output -- never re-derived
  // from the monthly breakdown above.
  function buildAnnual(results) {
    var pl = results["Profit & Loss Acc"] || {};
    return {
      sales: pl.C4 || 0,
      costOfSales: pl.C6 || 0,
      directCosts: pl.C7 || 0,
      grossProfit: pl.C9 || 0,
      employeeCosts: pl.C11 || 0,
      premisesCosts: pl.C12 || 0,
      repairs: pl.C13 || 0,
      generalAdmin: pl.C14 || 0,
      motorExpenses: pl.C15 || 0,
      travel: pl.C16 || 0,
      advertising: pl.C17 || 0,
      legalProfessional: pl.C18 || 0,
      badDebts: pl.C19 || 0,
      interestFinance: pl.C20 || 0,
      otherExpenses: pl.C21 || 0,
      totalExpenses: pl.C22 || 0,
      netProfit: pl.C24 || 0,
      capex: (results["Fixed Assets"] && results["Fixed Assets"].E1) || 0,
    };
  }

  function buildChecks(checkResults) {
    return checkResults.map(function (c, i) {
      return {
        id:
          "check-" +
          i +
          "-" +
          String(c.name)
            .replace(/[^a-z0-9]+/gi, "-")
            .toLowerCase(),
        label: c.name,
        expected: c.expected,
        actual: c.actual,
        result: c.pass ? "pass" : "fail",
      };
    });
  }

  function buildStock(book) {
    if (!book.stock) return { opening: 0, closing: 0, atCost: 0 };
    return { opening: book.stock.openingValue || 0, closing: book.stock.closingValue || 0, atCost: book.stock.openingValue || 0 };
  }

  function buildLedgers(entries, side) {
    return (entries || []).filter(function (e) {
      return e.timing === side;
    });
  }

  function buildIncomeTax(results) {
    var t = results[TAX_SHEET_NAME] || {};
    return {
      profitFromSelfEmployment: t.E5 || 0,
      personalAllowance: t.E6 || 0,
      taxableIncome: t.E7 || 0,
      bands: [
        { label: "Basic rate", rate: t.D8 || 0, ceiling: t.C9 || null, tax: t.E8 || 0, box: "E8" },
        { label: "Higher rate", rate: t.D9 || 0, ceiling: t.C10 || null, tax: t.E9 || 0, box: "E9" },
        { label: "Additional rate", rate: t.D10 || 0, ceiling: null, tax: t.E10 || 0, box: "E10" },
      ],
      totalIncomeTax: t.E11 || 0,
      cisDeducted: -(t.E12 || 0),
      niClass4Lower: t.E15 || 0,
      niClass4Upper: t.E16 || 0,
      totalTaxAndNi: t.E18 || 0,
    };
  }

  var TAX_SHEET_NAME = "Income Tax";

  // The SA103S box layout: the form's own section order and box numbers,
  // each paired with the SE Short cell the engine's calculateFromDiyaGl
  // writes it to (see CELL_MAP). Box 50 has no cell of its own in this
  // template -- Business premises renovation allowance is a relief this
  // sheet never claims -- so it stays a real, present zero rather than being
  // dropped from the form.
  var SA103S_LAYOUT = [
    { heading: "Business income", rows: [{ box: "8", label: "Turnover", cell: "D38" }] },
    {
      heading: "Allowable business expenses",
      rows: [
        { box: "16", label: "Cost of goods bought for resale or goods used", cell: "D46" },
        { box: "19", label: "Car, van and travel expenses", cell: "D51" },
        { box: "20", label: "Wages, salaries and other staff costs", cell: "D55" },
        { box: "21", label: "Rent, rates, power and insurance costs", cell: "D60" },
        { box: "23", label: "Repairs and renewals of property and equipment", cell: "D64" },
      ],
    },
    {
      heading: "Net profit",
      rows: [
        { box: "31", label: "Net profit", cell: "D71", total: true },
        { box: "32", label: "Or net loss", cell: "O71" },
      ],
    },
    {
      heading: "Capital allowances",
      rows: [
        { box: "49", label: "Annual investment allowance", cell: "D80" },
        { box: "50", label: "Business premises renovation allowance", cell: null },
        { box: "51", label: "All other capital allowances", cell: "O80" },
        { box: "52", label: "Balancing charges", cell: "O85" },
      ],
    },
    {
      heading: "Taxable profit",
      rows: [
        { box: "57", label: "Total taxable profits", cell: "D99", total: true },
        { box: "70", label: "Loss brought forward", cell: "O94" },
        { box: "71", label: "Any other business income", cell: "O99" },
      ],
    },
  ];

  function buildSa103s(results) {
    var se = results["SE Short"] || {};
    return {
      sections: SA103S_LAYOUT.map(function (section) {
        return {
          heading: section.heading,
          rows: section.rows.map(function (row) {
            return { box: row.box, label: row.label, amount: row.cell ? se[row.cell] || 0 : 0, total: row.total };
          }),
        };
      }),
    };
  }

  function buildAdmin(taxData, taxYearName) {
    var it = taxData.income_tax || {};
    var ni = taxData.national_insurance || {};
    var ca = taxData.capital_allowances || {};
    var mil = taxData.mileage || {};
    var vat = taxData.vat || {};
    return {
      year: (taxData.tax_year && taxData.tax_year.label) || taxYearName,
      source: "app/data/" + taxYearName + ".toml",
      rates: [
        { label: "Personal Allowance", value: it.personal_allowance || 0, format: "currency" },
        { label: "Personal Allowance Taper Threshold", value: it.personal_allowance_taper_threshold || 0, format: "currency" },
        { label: "Basic Rate", value: it.basic_rate || 0, format: "rate" },
        { label: "Higher Rate", value: it.higher_rate || 0, format: "rate" },
        { label: "Additional Rate", value: it.additional_rate || 0, format: "rate" },
        { label: "Basic Band End", value: it.basic_band_end || 0, format: "currency" },
        { label: "Higher Band Start", value: it.higher_band_start || 0, format: "currency" },
        { label: "Higher Band End", value: it.higher_band_end || 0, format: "currency" },
        { label: "NI Class 2 Rate", value: ni.class2_rate || 0, format: "rate" },
        { label: "NI Class 4 Lower Rate", value: ni.class4_lower_rate || 0, format: "rate" },
        { label: "NI Class 4 Lower Limit", value: ni.class4_lower_limit || 0, format: "currency" },
        { label: "NI Class 4 Upper Rate", value: ni.class4_upper_rate || 0, format: "rate" },
        { label: "NI Class 4 Upper Limit", value: ni.class4_upper_limit || 0, format: "currency" },
        { label: "Annual Investment Allowance Rate", value: ca.annual_investment_allowance || 0, format: "rate" },
        { label: "Writing Down Allowance Rate", value: ca.writing_down_allowance || 0, format: "rate" },
        { label: "Mileage Higher Rate Limit (miles)", value: mil.higher_rate_limit || 0, format: "number" },
        { label: "Mileage Higher Rate", value: mil.higher_rate_pence || 0, format: "pence" },
        { label: "Mileage Lower Rate Start (miles)", value: mil.lower_rate_start || 0, format: "number" },
        { label: "Mileage Lower Rate", value: mil.lower_rate_pence || 0, format: "pence" },
        { label: "VAT Registration Threshold", value: vat.registration_threshold || 0, format: "currency" },
      ],
    };
  }

  function buildBusinessDetails(book) {
    var entity = book.entityInformation || {};
    var info = book.documentInfo || {};
    return {
      organizationIdentifier: entity.organizationIdentifier || "",
      organizationDescription: entity.organizationDescription || "",
      organizationAddressLine: entity.organizationAddressLine || "",
      organizationTown: entity.organizationTown || "",
      organizationPostcode: entity.organizationPostcode || "",
      periodCoveredStart: isoDate(info.periodCoveredStart),
      periodCoveredEnd: isoDate(info.periodCoveredEnd),
      basisOfAccounting: entity["diya-gl:basisOfAccounting"] || "cash",
      vatRegistered: entity["diya-gl:vatRegistered"] === true,
    };
  }

  function isoDate(value) {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }

  // The fixed-asset additions list. Examples carry the full register on
  // book.fixedAssets; an upload has no such register reconstructed (the
  // calculator itself never reads it -- fixedAssetAdditions derives
  // additions straight from the "f"-coded lines), so the same lines feed the
  // additions list there too.
  function buildFixedAssetsFromBook(book, results) {
    var fa = results["Fixed Assets"] || {};
    var additions = (book.fixedAssets || []).map(function (a) {
      return { description: a.description || "Fixed asset", cost: a.cost || 0 };
    });
    return fixedAssetsSummary(additions, fa);
  }

  function buildFixedAssetsFromLines(lines, results) {
    var fa = results["Fixed Assets"] || {};
    var additions = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.sourceJournalID !== "purchases") continue;
      if (BST_PURCHASE_CATEGORY[Number(line.accountMainID)] !== "capex") continue;
      additions.push({ description: line.detailComment || "Fixed asset", cost: line.amount });
    }
    return fixedAssetsSummary(additions, fa);
  }

  function fixedAssetsSummary(additions, fa) {
    return {
      additions: additions,
      totalCost: fa.E1 || 0,
      aia: fa.K1 || 0,
      wda: fa.L1 || 0,
      writtenDownValue: fa.M1 || 0,
      disposals: fa.Q1 || 0,
      balancingCharge: fa.R1 || 0,
    };
  }

  // Every calculated cell CELL_MAP names, read back off the uploaded
  // workbook's own cached value and compared to what calculateFromDiyaGl
  // computed from the extracted lines -- canonicalised the way
  // verify-roundtrip.js canonicalises a roundtrip comparison. Text cells
  // (entity fields) carry no meaningful "drift" in the pencil-correction
  // sense, so only money/rate/count cells are compared. The Admin sheet's
  // own section is excluded: those cells echo whichever app/data/<year>.toml
  // the CURRENT page fetched, not a figure the accounting process derived
  // from the book's lines, so an older file (generated before a rate table
  // was corrected) would otherwise show a "drift" that is really a tax-data
  // vintage question, not an EQ1 reconciliation finding.
  var DRIFT_UNITS = { money: 1, rate: 1, count: 1 };
  var DRIFT_EXCLUDED_SECTIONS = { "Admin (Generator Injected)": 1 };

  async function buildDriftFromWorkbook(cellMap, workbookCells, results) {
    var drift = [];
    for (var i = 0; i < cellMap.length; i++) {
      var entry = cellMap[i];
      var sheet = entry[0],
        cell = entry[1],
        label = entry[2],
        section = entry[4],
        unit = entry[6];
      if (!DRIFT_UNITS[unit]) continue;
      if (DRIFT_EXCLUDED_SECTIONS[section]) continue;
      if (!workbookCells.hasSheet(sheet)) continue;
      var computedRaw = results[sheet] && results[sheet][cell];
      if (typeof computedRaw !== "number") continue;
      var asReadRaw = await workbookCells.readCell(sheet, cell);
      if (typeof asReadRaw !== "number") continue;
      var computed = canonicalise(computedRaw, unit);
      var asRead = canonicalise(asReadRaw, unit);
      if (Math.abs(computed - asRead) < 1e-9) continue;
      drift.push({ id: sheet + "!" + cell, label: label, computed: computedRaw, asRead: asReadRaw, note: sheet + "!" + cell });
    }
    return drift;
  }

  // ============================== the two loaders ==============================

  function periodFromLines(lines) {
    if (lines.length === 0) throw new Error("This file carries no transaction lines to read an accounting period from.");
    var dates = lines.map(function (l) {
      return l.postingDate;
    });
    dates.sort();
    var first = dates[0];
    var firstYear = Number(first.slice(0, 4));
    var firstMonth = Number(first.slice(5, 7));
    var startYear = firstMonth >= 4 ? firstYear : firstYear - 1;
    return { start: startYear + "-04-01", end: startYear + 1 + "-03-31" };
  }

  function buildAccountsChart(lines) {
    var sales = {};
    var purchases = {};
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var code = String(line.accountMainID);
      if (line.sourceJournalID === "sales") sales[code] = { accountMainDescription: "Account " + code };
      else if (line.sourceJournalID === "purchases") purchases[code] = { accountMainDescription: "Account " + code };
    }
    return { sales: sales, purchases: purchases };
  }

  async function buildLedgersFromWorkbook(workbookCells) {
    var debtors = [];
    var creditors = [];
    for (var ledgerName in LEDGER_LAYOUT) {
      var layout = LEDGER_LAYOUT[ledgerName];
      var target = ledgerName === "debtors" ? debtors : creditors;
      for (var slot = 0; slot < layout.slots; slot++) {
        var row = layout.firstRow + slot;
        var openName = await workbookCells.readCell("Debtors & Creditors", layout.name + row);
        var openAmount = await workbookCells.readCell("Debtors & Creditors", layout.amount + row);
        if (openName && String(openName).trim()) {
          target.push({
            counterparty: String(openName).trim(),
            amount: typeof openAmount === "number" ? openAmount : 0,
            timing: "opening",
          });
        }
        var closeName = await workbookCells.readCell("Debtors & Creditors", layout.closeName + row);
        var closeAmount = await workbookCells.readCell("Debtors & Creditors", layout.closeAmount + row);
        if (closeName && String(closeName).trim()) {
          target.push({
            counterparty: String(closeName).trim(),
            amount: typeof closeAmount === "number" ? closeAmount : 0,
            timing: "closing",
          });
        }
      }
    }
    return { debtors: debtors, creditors: creditors };
  }

  async function buildEntityInformationFromWorkbook(cellMap, workbookCells) {
    var entity = { "diya-gl:product": "BasicSoleTrader", "diya-gl:vatRegistered": false };
    for (var i = 0; i < cellMap.length; i++) {
      var entry = cellMap[i];
      if (entry[0] !== "Business Details") continue;
      var path = entry[3];
      if (path.indexOf("entityInformation.") !== 0) continue;
      var field = path.slice("entityInformation.".length);
      var value = await workbookCells.readCell(entry[0], entry[1]);
      if (value !== undefined && value !== "") entity[field] = String(value);
    }
    return entity;
  }

  async function assembleSnapshot(scenarioLabel, book, lines, results, checks, driftEntries, taxData, taxYearName) {
    var months = buildMonths(isoDate(book.documentInfo.periodCoveredStart));
    var stock = buildStock(book);
    var monthlyAndEntries = buildMonthlyAndEntries(lines, months, book.stock);
    var ledgers =
      book.debtors || book.creditors ? { debtors: book.debtors || [], creditors: book.creditors || [] } : { debtors: [], creditors: [] };

    return {
      scenario: scenarioLabel,
      months: months,
      categories: CATEGORIES,
      monthly: monthlyAndEntries.monthly,
      annual: buildAnnual(results),
      entries: monthlyAndEntries.entries,
      drift: driftEntries,
      checks: buildChecks(checks),
      stock: stock,
      debtors: { opening: buildLedgers(ledgers.debtors, "opening"), closing: buildLedgers(ledgers.debtors, "closing") },
      creditors: { opening: buildLedgers(ledgers.creditors, "opening"), closing: buildLedgers(ledgers.creditors, "closing") },
      fixedAssets: book.fixedAssets ? buildFixedAssetsFromBook(book, results) : buildFixedAssetsFromLines(lines, results),
      incomeTax: buildIncomeTax(results),
      sa103s: buildSa103s(results),
      admin: buildAdmin(taxData, taxYearName),
      businessDetails: buildBusinessDetails(book),
    };
  }

  /**
   * Load one of the three BST reconciliation fixtures: book.toml +
   * lines.jsonl only, no workbook to read an as-read layer from.
   * @param {string} exampleKey - a key of EXAMPLE_BOOKS
   */
  async function loadExample(exampleKey) {
    var meta = EXAMPLE_BOOKS[exampleKey];
    if (!meta) throw new Error('Unknown example "' + exampleKey + '"');

    var engine = await loadEngine();
    var resources = await loadResources();
    await ensureSchemas(engine, resources);

    var base = "examples/" + meta.dir + "/" + meta.product + "/";
    var bookToml = await resources.readText(base + "book.toml");
    var linesRaw = await resources.readText(base + "lines.jsonl");
    var parsed = engine.parseDiyaGlData(bookToml, linesRaw);
    var book = parsed.book;
    var lines = parsed.lines;

    var taxYearName = engine.taxYearFileName(new Date(book.documentInfo.periodCoveredEnd));
    var taxData = await engine.loadTaxDataForBook(book, { resources: resources, taxYearName: taxYearName });
    var scenario = engine.diyaGlToScenario(book, lines, "bst");
    var expected = Object.assign({}, scenario, scenario.expected);
    var results = engine.calculateFromDiyaGl(book, lines, "bst", taxData, expected);
    var checks = engine.checkCompliance(Object.assign({}, results), expected, taxData, engine.calculateExpectedTax);

    return assembleSnapshot(exampleKey, book, lines, results, checks, [], taxData, taxYearName);
  }

  /**
   * Load an uploaded .xlsx or .zip: the anchor guard, the real extraction,
   * live calculation, and the as-read layer read off the same bytes.
   * @param {File} file
   */
  async function loadFromFile(file) {
    var engine = await loadEngine();
    var resources = await loadResources();
    await ensureSchemas(engine, resources);

    var arrayBuffer = await file.arrayBuffer();
    var fileBytes = new Uint8Array(arrayBuffer);
    var xlsxBytes = await global.DiyaGlXlsxCells.xlsxBytesFrom(fileBytes, file.name);

    // validateBstAnchors throws BstAnchorError, named by sheet and header --
    // never a silent short read. Let it propagate; the caller shows it.
    await engine.validateBstAnchors(xlsxBytes);

    var extractionMap = engine.bstExtractionMap();
    var lines = await engine.extractBstTransactions(xlsxBytes, extractionMap);
    if (lines.length === 0) throw new Error("This file carries no transaction lines to build a book from.");

    var workbookCells = await global.DiyaGlXlsxCells.openWorkbookCells(xlsxBytes);
    var entity = await buildEntityInformationFromWorkbook(engine.CELL_MAP, workbookCells);
    var ledgers = await buildLedgersFromWorkbook(workbookCells);
    var openingStock = await workbookCells.readCell("PurchasesStock", "D5");
    var closingStock = await workbookCells.readCell("PurchasesStock", "D30");
    var period = periodFromLines(lines);

    var book = {
      documentInfo: {
        entriesType: "journal",
        language: "en",
        periodCoveredStart: period.start,
        periodCoveredEnd: period.end,
        defaultCurrency: "GBP",
        entriesComment: "Uploaded from " + file.name,
      },
      entityInformation: entity,
      accounts: buildAccountsChart(lines),
    };
    if (typeof openingStock === "number" || typeof closingStock === "number") {
      book.stock = { openingValue: openingStock || 0, closingValue: closingStock || 0 };
    }
    if (ledgers.debtors.length > 0) book.debtors = ledgers.debtors;
    if (ledgers.creditors.length > 0) book.creditors = ledgers.creditors;

    var bookValidation = engine.validateBook(book);
    var linesValidation = engine.validateLines(lines, book);

    var taxYearName = engine.taxYearFileName(new Date(book.documentInfo.periodCoveredEnd));
    var taxData = await engine.loadTaxDataForBook(book, { resources: resources, taxYearName: taxYearName });
    var scenario = engine.diyaGlToScenario(book, lines, "bst");
    var expected = Object.assign({}, scenario, scenario.expected);
    var results = engine.calculateFromDiyaGl(book, lines, "bst", taxData, expected);
    var checks = engine.checkCompliance(Object.assign({}, results), expected, taxData, engine.calculateExpectedTax);
    var drift = await buildDriftFromWorkbook(engine.CELL_MAP, workbookCells, results);

    var snapshot = await assembleSnapshot(file.name, book, lines, results, checks, drift, taxData, taxYearName);
    snapshot.bookValidation = bookValidation;
    snapshot.linesValidation = linesValidation;
    return snapshot;
  }

  global.DiyaGlBooksLoader = { EXAMPLE_BOOKS: EXAMPLE_BOOKS, loadExample: loadExample, loadFromFile: loadFromFile };
})(window);
