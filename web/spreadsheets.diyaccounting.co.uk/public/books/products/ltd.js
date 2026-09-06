// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/products/ltd.js
//
// The Limited Company view manifest: what the shared shell (shell.js) mounts
// for a Ltd book. Plain data plus functions, loaded as a classic script
// before the engine, so every function that needs the engine or the product
// module receives it in its ctx argument. The render functions themselves
// live in products/ltd-ledger.js, loaded after this file; this file wires
// them into VIEWS and carries the constants and snapshot builders both this
// file and ltd-ledger.js read, exposed on global.DiyaGlLtdShared.
//
// Ltd is a thirteen-workbook package, so a figure's report key names the
// file as well as the sheet: the hub's own sheets under
// "Financialaccounts.xlsx", every leaf sheet under its own file name. The
// labels, units and cells all come from the product module (app/products/
// ltd.js) through engine.productModule("ltd") -- CELL_MAP for the rows the
// report prints as sections, cellLabels() for every other cell the
// calculator produces. The layout tables kept here (which file a bank
// account lives in, the Schedule's asset-class rows, the opening balance
// sheet's own columns) mirror app/lib/ltd-layout.js and app/products/ltd.js,
// which do not yet re-export them for a browser reader (Ltd:T2 adds that);
// until then this manifest keeps its own copies, verified against the same
// source the CLAUDE.md skill names.

(function (global) {
  "use strict";
  global.DiyaGlProducts = global.DiyaGlProducts || {};

  var PRODUCT_ID = "ltd";
  var SCHEMA_NAME = "Company";
  // The workbook every hub sheet belongs to; the same name link-caches.js
  // exports as HUB_FILE and report-serializer.js prefixes a hub cell key
  // with.
  var HUB_FILE = "Financialaccounts.xlsx";

  var PL_SHEET = "MnthP&L";
  var PL_SECTION = "Profit & Loss Account";
  var STOCK_SHEET = "Stock";
  var BUSINESS_DETAILS_SHEET = "OpenAccounts";
  var BUSINESS_DETAILS_SECTION = "Business Details";
  var OPENING_BALANCE_SECTION = "Opening Balance Sheet";
  var ADMIN_SECTION = "Admin";
  var TRIAL_BALANCE_SHEET = "TrialBalance";

  var SCHEDULE_SHEET = "Fixedassets.xlsx!Schedule";
  var HP_SHEET = "Fixedassets.xlsx!HPfinance";
  var OPENING_DEBTORS_SHEET = "Sales.xlsx!OpeningDebtors";
  var CLOSING_DEBTORS_SHEET = "Sales.xlsx!ClosingDebtors";
  var OPENING_CREDITORS_SHEET = "Purchases.xlsx!OpeningCreditors";
  var CLOSING_CREDITORS_SHEET = "Purchases.xlsx!ClosingCreditors";
  var LEDGER_TOTAL_CELL = "H1";

  // Snapshot key per row of the management P&L (MnthP&L), in the sheet's
  // own row order. Labels, sections and cells come from CELL_MAP; this
  // table names the key a month column and the annual column carry, and
  // which rows the statement rules off as totals. Two of these keys --
  // "costOfSales" and "totalExpenses", "sales" and "netProfit" -- are also
  // the names the shared inspector's monthly chart (headlines.js) expects
  // on every product's monthly row; "netProfit" here is Profit Before Tax
  // (B45), the closest a Company book comes to the sole trader statement's
  // bottom line inside one file.
  var PL_KEYS = {
    B4: { key: "salesProductA" },
    B5: { key: "salesProductB" },
    B6: { key: "salesProductC" },
    B7: { key: "otherDirectIncome" },
    B8: { key: "grantsReceived" },
    B9: { key: "sales", total: true },
    B11: { key: "materials" },
    B12: { key: "subContractors" },
    B13: { key: "otherDirectCosts" },
    B14: { key: "costOfSales", total: true },
    B16: { key: "grossProfit", total: true },
    B18: { key: "payeWages" },
    B19: { key: "directorsWages" },
    B20: { key: "employersNI" },
    B21: { key: "premises" },
    B22: { key: "lightHeatPower" },
    B23: { key: "distribution" },
    B24: { key: "equipmentHire" },
    B25: { key: "repairs" },
    B26: { key: "consumables" },
    B27: { key: "advertising" },
    B28: { key: "telephonePostage" },
    B29: { key: "travel" },
    B30: { key: "motorVehicle" },
    B31: { key: "insurance" },
    B32: { key: "leasing" },
    B33: { key: "legalProfessional" },
    B34: { key: "badDebts" },
    B35: { key: "bankInterestPaid" },
    B36: { key: "bankCharges" },
    B37: { key: "charitableDonations" },
    B38: { key: "goodwillWrittenOff" },
    B39: { key: "lossOnDisposal" },
    B40: { key: "depreciation" },
    B41: { key: "totalExpenses", total: true },
    B43: { key: "operatingProfit", total: true },
    B44: { key: "interestReceived" },
    B45: { key: "netProfit", total: true },
  };

  // One month-row key that is not a column of the year table: the month's
  // own posted line total, the gross of every line that reached a total
  // somewhere. The columns themselves are the statement's own figures, so
  // this is the only bucket the lines fill.
  var POSTED_TOTAL_KEY = "postedTotal";
  var HIDDEN_KEYS = [{ key: POSTED_TOTAL_KEY, label: "Posted line total" }];

  var DERIVED = {
    sales: 1,
    costOfSales: 1,
    grossProfit: 1,
    totalExpenses: 1,
    operatingProfit: 1,
    netProfit: 1,
  };

  // The purchase code letter a fixed asset buy carries; the register lists
  // those lines as the year's additions.
  var FIXED_ASSET_PURCHASE_CODE = "fa";

  // The four bank workbooks, the file each keeps its statement in, and the
  // journal every one of their lines carries (one journal, "bank", unlike
  // Self Employed's separate bank/cash ids -- the plan's Year view carries
  // one "Bank" switch for all four accounts). Verified against
  // app/lib/ltd-layout.js's BANK_ACCOUNT_FILES.
  var BANK_ACCOUNTS = [
    { id: "1200", file: "Currentaccount.xlsx", label: "Current account" },
    { id: "1210", file: "Savingaccount.xlsx", label: "Savings account" },
    { id: "1230", file: "Creditcardaccount.xlsx", label: "Credit card account" },
    { id: "1220", file: "Cashaccount.xlsx", label: "Cash account" },
  ];

  // The Trial Balance's own echo of each bank account's closing balance,
  // which the last month tab's own A2 also carries. Verified against
  // app/products/ltd.js's TRIAL_BALANCE_BANK_ECHO_CELLS.
  var TRIAL_BALANCE_BANK_ECHO_CELLS = {
    "Currentaccount.xlsx": "EJ22",
    "Savingaccount.xlsx": "EJ23",
    "Creditcardaccount.xlsx": "EJ24",
    "Cashaccount.xlsx": "EJ25",
  };

  // The Trial Balance's own debtors and creditors totals, opening and
  // closing, that the Ledgers view reports beside the named entries.
  var LEDGER_TRIAL_BALANCE_CELLS = {
    debtors: { opening: "D20", closing: "EJ20" },
    creditors: { opening: "D28", closing: "EJ28" },
  };

  // The management P&L's own month columns, in period order -- first month
  // of the accounting year is C, the twelfth is N, whichever calendar month
  // the year actually starts in.
  var MONTH_COLS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

  // The stock sheet's own cells: H4 the materials percentage a reader can
  // edit, D6 opening, D30 the calculated closing figure, AB30 the physical
  // count, Z30 the adjustment between them.
  var STOCK_CELLS = { opening: "D6", calculated: "D30", counted: "AB30", adjustment: "Z30", materialsPercent: "H4" };

  // The Schedule's own totals row, in the order the plan's fixed-assets
  // view reads it. Labels come from FIXED_ASSET_CELL_LABELS in the product
  // module.
  var SCHEDULE_TOTAL_CELLS = ["E1", "F1", "I1", "K1", "Q1", "R1", "Y1", "Z1"];

  // One class of asset a row: the existing-assets block's own totals row
  // (cost E, depreciation F), verified against app/products/ltd.js's
  // SCHEDULE_ASSET_CLASSES.
  var SCHEDULE_ASSET_CLASSES = [
    { key: "land", label: "Land & property", existingTotalRow: 11 },
    { key: "plant", label: "Plant & machinery", existingTotalRow: 22 },
    { key: "fixtures", label: "Fixtures & fittings", existingTotalRow: 30 },
    { key: "computer", label: "Computer & technology", existingTotalRow: 41 },
    { key: "motor", label: "Motor vehicles", existingTotalRow: 55 },
  ];

  // Two hire purchase agreements a book can carry a figure for on the
  // Schedule sheet -- the first two rows of the "New Hire Purchase
  // Agreements" block, which is as far as the report's own read scope
  // reaches (app/products/ltd.js's multiFileOptions()).
  var HP_ROWS = [8, 10];
  var HP_COLUMNS = { monthlyPayment: "I", capital: "J", interest: "K" };
  var HP_TOTAL_CELL = "E2";

  // The entityInformation field an OpenAccounts business-details cell reads
  // back into, verified against xlsx-exporter.js's ENTITY_CELLS.ltd. E5 (the
  // first director's name) is not one of these -- the writer takes it from
  // the first director among the book's employees, not from
  // entityInformation, so the view shows it read-only.
  var ENTITY_FIELD_BY_CELL = {
    E2: { field: "organizationIdentifier" },
    E3: { field: "companyNumber", path: "entityInformation.diya-gl:companyNumber" },
    E4: { field: "organizationTelephone" },
    E8: { field: "organizationDescription" },
    J3: { field: "organizationAddressLine" },
    J4: { field: "organizationTown" },
    N6: { field: "organizationPostcode" },
    O3: { field: "taxRegistrationNumber" },
  };

  // The two financial-year rows the Admin view reads, the second shown only
  // when the accounting period straddles 1 April.
  var ADMIN_FINANCIAL_YEAR_ROWS = [
    { year: "K6", start: "L6", end: "N6" },
    { year: "K7", start: "L7", end: "N7" },
  ];
  var ADMIN_RATE_CELLS = ["P6", "P7", "P8", "P9", "P12", "P13"];
  var ADMIN_CAPITAL_ALLOWANCE_CELLS = ["G5", "G6", "G7", "G8"];
  var ADMIN_DEPRECIATION_CELLS = ["G15", "G16", "G17", "G18", "G19"];
  var ADMIN_MILEAGE_CELLS = ["N16", "O16", "N17", "O17"];
  var ADMIN_VAT_RATE_CELL = "M19";

  var ENTITY_PATH_PREFIX = "entityInformation.";

  // The chart a new Limited Company book starts from: one account per P&L
  // row the sales and purchase journals feed, plus the four bank books the
  // package carries. The descriptions are the statement's own captions.
  var STANDARD_NEW_BOOK_CHART = {
    sales: {
      4000: { accountMainDescription: "Sales Product A" },
      4001: { accountMainDescription: "Sales Product B" },
      4002: { accountMainDescription: "Sales Product C" },
      4003: { accountMainDescription: "Other Direct Income" },
      4004: { accountMainDescription: "Grants Received" },
    },
    purchases: {
      5000: { accountMainDescription: "Materials / Stock" },
      5100: { accountMainDescription: "Directors Wages" },
      5200: { accountMainDescription: "Premises" },
      5400: { accountMainDescription: "Repairs & Maintenance" },
      5500: { accountMainDescription: "Advertising" },
      5600: { accountMainDescription: "Travel & Hotel" },
      5700: { accountMainDescription: "Insurance" },
      5800: { accountMainDescription: "Legal & Professional" },
      5900: { accountMainDescription: "Fixed asset purchases" },
    },
    bank: {
      1200: { accountMainDescription: "Current account", accountType: "bank" },
      1210: { accountMainDescription: "Savings account", accountType: "bank" },
      1220: { accountMainDescription: "Cash account", accountType: "bank" },
      1230: { accountMainDescription: "Credit card account", accountType: "bank" },
    },
  };

  // ============================== product module readers ==============================

  function plainLabel(label) {
    return String(label).replace(/\*\*/g, "");
  }

  function rowNumber(cell) {
    return cell.replace(/^[A-Z]+/, "");
  }

  function num(value) {
    return typeof value === "number" ? value : 0;
  }

  // The results key for a hub sheet is the bare sheet name; the report key
  // names the hub file it sits in. A leaf sheet already carries its file.
  function qualified(sheet) {
    return sheet.indexOf("!") === -1 ? HUB_FILE + "!" + sheet : sheet;
  }

  // The snapshot the shell is currently showing. A bind() runs after the
  // render that produced it, and every commit replaces this global before
  // re-rendering, so a listener reads the live book here rather than closing
  // over the one its own render saw.
  function liveSnapshot() {
    return global.DIYA_BOOKS_SNAPSHOT;
  }

  var labelCache = new WeakMap();

  function labelsOf(productMod) {
    var found = labelCache.get(productMod);
    if (!found) {
      found = productMod.cellLabels();
      labelCache.set(productMod, found);
    }
    return found;
  }

  function labelFor(productMod, sheet, cell, fallbackLabel) {
    var entry = labelsOf(productMod)[sheet + "!" + cell];
    var label = entry && entry.diyLabel ? plainLabel(entry.diyLabel) : "";
    return label || fallbackLabel;
  }

  function unitOf(productMod, sheet, cell) {
    var entry = labelsOf(productMod)[sheet + "!" + cell];
    return (entry && entry.unit) || "money";
  }

  function sectionRowsOf(productMod, section) {
    return productMod.CELL_MAP.filter(function (row) {
      return row[4] === section;
    });
  }

  // The statement's own rows, in the order CELL_MAP prints them: the year
  // table's columns are the same list, so the two views never disagree
  // about which rows the account has.
  function categories(productMod) {
    var out = [];
    sectionRowsOf(productMod, PL_SECTION).forEach(function (row) {
      var meta = PL_KEYS[row[1]];
      if (!meta) return;
      out.push({
        key: meta.key,
        label: plainLabel(row[2]),
        sheet: row[0],
        cell: row[1],
        computed: !!DERIVED[meta.key],
        indent: row[5],
      });
    });
    HIDDEN_KEYS.forEach(function (bucket) {
      out.push({ key: bucket.key, label: bucket.label, sheet: null, cell: null, computed: false });
    });
    return out;
  }

  var cellByKeyCache = new WeakMap();

  function cellByKey(productMod) {
    var found = cellByKeyCache.get(productMod);
    if (!found) {
      found = {};
      categories(productMod).forEach(function (category) {
        if (category.cell) found[category.key] = category.cell;
      });
      cellByKeyCache.set(productMod, found);
    }
    return found;
  }

  // A category's cell on one month's column: the same row, the column at
  // that month's position in the accounting year (first month is C,
  // whichever calendar month that is).
  function monthColumnOf(ctx, monthKey) {
    for (var i = 0; i < ctx.months.length; i++) {
      if (ctx.months[i].key === monthKey) return MONTH_COLS[i];
    }
    return null;
  }

  // shell.js's yearTable.monthlyCell contract passes a month label alone,
  // not the snapshot's own months array, so this reads the shell's own live
  // snapshot for the current book's month order -- set before any render
  // runs (shell.js's applySnapshot), so it is always the render's own.
  function monthlyCell(monthLabel, productMod, categoryKey) {
    var snap = liveSnapshot();
    var months = (snap && snap.months) || [];
    var column = null;
    for (var i = 0; i < months.length; i++) {
      if (months[i].label === monthLabel) column = MONTH_COLS[i];
    }
    var annualCell = cellByKey(productMod)[categoryKey];
    if (!column || !annualCell) return null;
    return [PL_SHEET, column + rowNumber(annualCell)];
  }

  // ============================== classifying a line ==============================

  var scenarioCache = new WeakMap();

  function scenarioOf(ctx) {
    var found = scenarioCache.get(ctx);
    if (found) return found;
    var scenario = ctx.engine.diyaGlToScenario(ctx.book, ctx.lines, PRODUCT_ID);
    var merged = Object.assign({}, scenario, scenario.expected);
    scenarioCache.set(ctx, merged);
    return merged;
  }

  var codeMapCache = new WeakMap();

  // The code letter each account posts under, read back off the scenario the
  // engine itself builds from these lines rather than restated here. An
  // account the scenario never carries is one the engine's own filter drops,
  // so a line posted to it reaches no total.
  function codeMaps(ctx) {
    var found = codeMapCache.get(ctx);
    if (found) return found;
    var scenario = scenarioOf(ctx);
    var maps = { sales: {}, purchases: {} };
    ["sales", "purchases"].forEach(function (journal) {
      var byMonth = scenario[journal] || {};
      Object.keys(byMonth).forEach(function (month) {
        byMonth[month].forEach(function (transaction) {
          if (transaction.account !== undefined) maps[journal][String(transaction.account)] = transaction.code;
        });
      });
    });
    codeMapCache.set(ctx, maps);
    return maps;
  }

  // Which journal a line belongs to, and whether it reaches a total at all.
  // The four bank accounts share one journal id here, unlike Self Employed's
  // separate bank/cash ids, because the plan's Year view carries a single
  // "Bank" switch for all four.
  function classify(line, book, ctx) {
    var account = String(line.accountMainID);
    if (line.sourceJournalID === "sales" || line.sourceJournalID === "purchases") {
      var journal = line.sourceJournalID;
      var posted = codeMaps(ctx)[journal][account] !== undefined;
      return { journal: journal, key: posted ? POSTED_TOTAL_KEY : null };
    }
    if (line.sourceJournalID === "bank") {
      return { journal: "bank", key: POSTED_TOTAL_KEY };
    }
    if (line.sourceJournalID === "payroll") {
      return { journal: "payroll", key: POSTED_TOTAL_KEY };
    }
    return { journal: null, key: null };
  }

  var linkCellsCache = new WeakMap();

  // Every cell the calculator produces, the hub's sheets under their bare
  // names, unscoped by the report's own read list -- the statement's month
  // columns are in here and not in the results the report carries, so the
  // year table's month rows come from this rather than from a second sum
  // over the lines.
  function linkCells(ctx) {
    var found = linkCellsCache.get(ctx);
    if (found) return found;
    var cells = ctx.engine.calculateLinkCells(ctx.book, ctx.lines, PRODUCT_ID, ctx.taxData, scenarioOf(ctx));
    linkCellsCache.set(ctx, cells);
    return cells;
  }

  // The statement's own figure for one category in one month.
  function derive(row, monthKey, ctx) {
    var column = monthColumnOf(ctx, monthKey);
    var statement = linkCells(ctx)[PL_SHEET] || {};
    categories(ctx.productMod).forEach(function (category) {
      if (!category.cell) return;
      row[category.key] = column ? num(statement[column + rowNumber(category.cell)]) : 0;
    });
    // Ltd has no separate direct-costs row: everything not payroll or admin
    // is already inside cost of sales. Kept at zero for the shared
    // inspector's monthly chart, which sums it alongside cost of sales.
    row.directCosts = 0;
    return row;
  }

  // ============================== the snapshot's product half ==============================

  function cellValue(results, sheet, cell) {
    return num(results[sheet] && results[sheet][cell]);
  }

  function buildAnnual(ctx) {
    var annual = {};
    categories(ctx.productMod).forEach(function (category) {
      annual[category.key] = category.cell ? cellValue(ctx.results, category.sheet, category.cell) : 0;
    });
    annual.capex = cellValue(ctx.results, SCHEDULE_SHEET, "E110");
    annual.directCosts = 0;
    return annual;
  }

  function buildStock(ctx) {
    var stock = ctx.book.stock || {};
    return {
      materialsPercent: stock.materialsPercent === undefined ? null : num(stock.materialsPercent),
    };
  }

  function ledgerSide(entries, timing) {
    return (entries || []).filter(function (entry) {
      return entry.timing === timing;
    });
  }

  function buildLedgers(ctx) {
    return {
      debtors: {
        opening: { sheet: OPENING_DEBTORS_SHEET, rows: ledgerSide(ctx.book.debtors, "opening") },
        closing: { sheet: CLOSING_DEBTORS_SHEET, rows: ledgerSide(ctx.book.debtors, "closing") },
      },
      creditors: {
        opening: { sheet: OPENING_CREDITORS_SHEET, rows: ledgerSide(ctx.book.creditors, "opening") },
        closing: { sheet: CLOSING_CREDITORS_SHEET, rows: ledgerSide(ctx.book.creditors, "closing") },
      },
    };
  }

  // The register: the assets the book brought into the year, then the ones
  // the purchase journal bought during it, plus the two hire purchase
  // agreements the Schedule's own read scope reaches a figure for.
  function buildFixedAssets(ctx) {
    var broughtForward = (ctx.book.fixedAssets || []).map(function (asset) {
      var cost = num(asset.cost);
      var dep = num(asset.accumulatedDepreciation);
      return {
        description: asset.description || asset.assetID || "Fixed asset",
        assetClass: asset.class || "",
        cost: cost,
        accumulatedDepreciation: dep,
        writtenDownValue: cost - dep,
      };
    });
    var additions = ctx.lines
      .filter(function (line) {
        return line.sourceJournalID === "purchases" && codeMaps(ctx).purchases[String(line.accountMainID)] === FIXED_ASSET_PURCHASE_CODE;
      })
      .map(function (line) {
        return { description: line.detailComment || "Fixed asset", cost: line.amount, postingDate: line.postingDate };
      });
    var agreements = (ctx.book.hpAgreements || []).map(function (agreement, index) {
      return {
        agreementID: agreement.agreementID,
        financeCompany: agreement.financeCompany,
        amountFinanced: num(agreement.amountFinanced),
        termMonths: agreement.termMonths,
        row: HP_ROWS[index] || null,
      };
    });
    return { broughtForward: broughtForward, additions: additions, agreements: agreements };
  }

  function buildBank(ctx) {
    var accounts = BANK_ACCOUNTS.map(function (account) {
      return {
        id: account.id,
        file: account.file,
        label: account.label,
        months: ctx.engine.bankBalancesByMonth(ctx.lines, account.id, {
          start: ctx.book.documentInfo.periodCoveredStart,
          end: ctx.book.documentInfo.periodCoveredEnd,
        }),
      };
    });
    return { accounts: accounts, settlements: ctx.engine.settlementSuggestions({ book: ctx.book, lines: ctx.lines }) };
  }

  function snapshot(ctx) {
    return {
      annual: buildAnnual(ctx),
      stock: buildStock(ctx),
      ledgers: buildLedgers(ctx),
      fixedAssets: buildFixedAssets(ctx),
      bank: buildBank(ctx),
    };
  }

  // ============================== report keys ==============================

  // The report keys one calculated cell carries: the section key CELL_MAP
  // gives a row the report prints, and the cell key the serializer writes
  // for every cell in the results. A cell CELL_MAP does not name (a leaf
  // read, or a Trial Balance total the report tracks but the section table
  // never prints) carries a plain cell key with no section pairing.
  function cellRk(snap, helpers, sheet, cell) {
    var sheetResults = snap.results[sheet];
    if (!sheetResults) return "";
    var value = sheetResults[cell];
    if (value === undefined || value === null || value === "") return "";
    return helpers.rkFor(sheet, cell) || helpers.rk(helpers.cellKey(qualified(sheet), cell));
  }

  // ============================== formatting ==============================

  var EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
  var MS_PER_DAY = 86400000;

  function excelDate(serial) {
    return new Date(EXCEL_EPOCH_MS + serial * MS_PER_DAY).toISOString().slice(0, 10);
  }

  function formatByUnit(value, unit, helpers) {
    if (value === undefined || value === null || value === "" || value === " ") return "—";
    if (unit === "text" || unit === "identifier") return helpers.esc(String(value));
    if (typeof value !== "number") return helpers.esc(String(value));
    if (unit === "rate") return helpers.fmtRate(value);
    if (unit === "count") return value.toLocaleString("en-GB");
    if (unit === "date") return helpers.esc(excelDate(value));
    return helpers.fmtMoney(value);
  }

  // ============================== new book and upload ==============================

  // The thirteen workbooks read back as one book, through the same
  // extractBook the CLI's --file mode runs.
  async function bookFromWorkbook(set, lines, ctx) {
    var book = await ctx.engine.extractBook(set, PRODUCT_ID, lines, ctx.productMod.CELL_MAP, {
      readRateData: function (fileName) {
        return ctx.resources.readText("data/" + fileName);
      },
    });
    book.documentInfo.entriesComment = "Uploaded from " + ctx.fileName;
    return book;
  }

  function buildNewBook(values, ctx) {
    var name = values.businessName;
    return {
      documentInfo: {
        entriesType: "journal",
        language: "en",
        periodCoveredStart: ctx.period.start,
        periodCoveredEnd: ctx.period.end,
        defaultCurrency: "GBP",
        entriesComment: "New book for " + name,
      },
      entityInformation: {
        "organizationIdentifier": name,
        "diya-gl:product": SCHEMA_NAME,
        "diya-gl:vatRegistered": !!values.vatRegistered,
      },
      accounts: JSON.parse(JSON.stringify(STANDARD_NEW_BOOK_CHART)),
    };
  }

  // A package carries no anchor table of its own yet (Ltd:T2), so the only
  // check made before extraction is that the hub workbook the multi-file
  // extractor requires is actually in the set -- extraction itself already
  // throws its own clear error on a missing sheet or cell.
  function validateUpload(engine, set) {
    if (!set.has(HUB_FILE)) {
      throw new Error('This does not look like a Limited Company package: no "' + HUB_FILE + '".');
    }
    return Promise.resolve();
  }

  // ============================== shared surface for ltd-ledger.js ==============================

  global.DiyaGlLtdShared = {
    PL_SHEET: PL_SHEET,
    STOCK_SHEET: STOCK_SHEET,
    STOCK_CELLS: STOCK_CELLS,
    BUSINESS_DETAILS_SECTION: BUSINESS_DETAILS_SECTION,
    OPENING_BALANCE_SECTION: OPENING_BALANCE_SECTION,
    ADMIN_SECTION: ADMIN_SECTION,
    TRIAL_BALANCE_SHEET: TRIAL_BALANCE_SHEET,
    SCHEDULE_SHEET: SCHEDULE_SHEET,
    HP_SHEET: HP_SHEET,
    LEDGER_TRIAL_BALANCE_CELLS: LEDGER_TRIAL_BALANCE_CELLS,
    BANK_ACCOUNTS: BANK_ACCOUNTS,
    TRIAL_BALANCE_BANK_ECHO_CELLS: TRIAL_BALANCE_BANK_ECHO_CELLS,
    SCHEDULE_TOTAL_CELLS: SCHEDULE_TOTAL_CELLS,
    SCHEDULE_ASSET_CLASSES: SCHEDULE_ASSET_CLASSES,
    HP_COLUMNS: HP_COLUMNS,
    HP_TOTAL_CELL: HP_TOTAL_CELL,
    ENTITY_FIELD_BY_CELL: ENTITY_FIELD_BY_CELL,
    ADMIN_FINANCIAL_YEAR_ROWS: ADMIN_FINANCIAL_YEAR_ROWS,
    ADMIN_RATE_CELLS: ADMIN_RATE_CELLS,
    ADMIN_CAPITAL_ALLOWANCE_CELLS: ADMIN_CAPITAL_ALLOWANCE_CELLS,
    ADMIN_DEPRECIATION_CELLS: ADMIN_DEPRECIATION_CELLS,
    ADMIN_MILEAGE_CELLS: ADMIN_MILEAGE_CELLS,
    ADMIN_VAT_RATE_CELL: ADMIN_VAT_RATE_CELL,
    ENTITY_PATH_PREFIX: ENTITY_PATH_PREFIX,
    liveSnapshot: liveSnapshot,
    labelFor: labelFor,
    unitOf: unitOf,
    num: num,
    cellValue: cellValue,
    cellRk: cellRk,
    formatByUnit: formatByUnit,
  };

  // ============================== the product manifest ==============================

  global.DiyaGlProducts.ltd = {
    id: PRODUCT_ID,
    schemaName: SCHEMA_NAME,
    title: "Limited Company",
    page: "ltd.html",
    stylesheet: "ltd.css",
    multiFile: true,
    hub: HUB_FILE,
    emptyState: {
      intro: "Open a Limited Company package as editable books in your browser. Nothing is uploaded; the files never leave your machine.",
    },
    views: [
      { id: "home", label: "Home", sheets: "Home", shared: "home" },
      {
        id: "year",
        label: "Year",
        sheets: "Sales, Purchases, Currentaccount, Savingaccount, Creditcardaccount, Cashaccount, Payslips",
        shared: "year",
      },
      {
        id: "bank",
        label: "Bank",
        sheets: "Currentaccount, Savingaccount, Creditcardaccount, Cashaccount",
        render: function (snap, state, helpers) {
          return global.DiyaGlLtdLedger.renderBank(snap, state, helpers);
        },
        bind: function (root, state, helpers) {
          return global.DiyaGlLtdLedger.bindBank(root, state, helpers);
        },
      },
      {
        id: "ledgers",
        label: "Ledgers",
        sheets: "OpeningDebtors, ClosingDebtors, OpeningCreditors, ClosingCreditors",
        render: function (snap, state, helpers) {
          return global.DiyaGlLtdLedger.renderLedgers(snap, state, helpers);
        },
      },
      {
        id: "profit-loss",
        label: "P&L",
        sheets: PL_SHEET,
        render: function (snap, state, helpers) {
          return global.DiyaGlLtdLedger.renderProfitLoss(snap, state, helpers);
        },
        bind: function (root, state, helpers) {
          return global.DiyaGlLtdLedger.bindProfitLoss(root, state, helpers);
        },
      },
      {
        id: "stock",
        label: "Stock",
        sheets: STOCK_SHEET,
        render: function (snap, state, helpers) {
          return global.DiyaGlLtdLedger.renderStock(snap, state, helpers);
        },
        bind: function (root, state, helpers) {
          return global.DiyaGlLtdLedger.bindStock(root, state, helpers);
        },
      },
      {
        id: "fixed-assets",
        label: "Fixed assets",
        sheets: "Schedule, HPfinance",
        render: function (snap, state, helpers) {
          return global.DiyaGlLtdLedger.renderFixedAssets(snap, state, helpers);
        },
      },
      {
        id: "business-details",
        label: "Business details",
        sheets: "OpenAccounts",
        render: function (snap, state, helpers) {
          return global.DiyaGlLtdLedger.renderBusinessDetails(snap, state, helpers);
        },
        bind: function (root, state, helpers) {
          return global.DiyaGlLtdLedger.bindBusinessDetails(root, state, helpers);
        },
      },
      {
        id: "admin",
        label: "Admin",
        sheets: "Admin",
        render: function (snap, state, helpers) {
          return global.DiyaGlLtdLedger.renderAdmin(snap, state, helpers);
        },
      },
    ],
    months: {
      journals: [
        { id: "sales", label: "Sales" },
        { id: "purchases", label: "Purchases" },
        { id: "bank", label: "Bank" },
        { id: "payroll", label: "Payroll" },
      ],
      categories: categories,
      classify: classify,
      derive: derive,
    },
    yearTable: {
      defaultColumns: ["sales", "costOfSales", "totalExpenses", "operatingProfit"],
      alwaysHidden: [POSTED_TOTAL_KEY],
      composite: [],
      monthlyCell: monthlyCell,
      summary: [
        ["Sales Turnover", "sales", true],
        ["Gross Profit", "grossProfit"],
        ["Total Admin Expenses", "totalExpenses"],
        ["Operating Profit", "operatingProfit"],
      ],
      sticky: [
        ["Sales Turnover", "sales"],
        ["Operating Profit", "operatingProfit"],
      ],
      card: {
        headline: "operatingProfit",
        figures: [
          ["Sales", "sales", true],
          ["Admin expenses", "totalExpenses"],
        ],
      },
    },
    snapshot: snapshot,
    newBook: {
      fields: [
        { id: "new-book-name", name: "businessName", label: "Company name", type: "text", required: "Enter a company name." },
        { id: "new-book-year-end", name: "yearEnd", label: "Year end", type: "date", required: "Enter a real year-end date." },
        { id: "new-book-vat", name: "vatRegistered", label: "VAT registered", type: "checkbox" },
      ],
      build: buildNewBook,
      label: function (values) {
        return values.businessName;
      },
    },
    upload: {
      validate: validateUpload,
      extract: function (engine, set) {
        return engine.extractLines(set, PRODUCT_ID);
      },
      bookFromWorkbook: bookFromWorkbook,
    },
    bookFields: { documentInfo: ["periodCoveredStart", "periodCoveredEnd"] },
    drift: { units: { money: 1, rate: 1, count: 1 }, excludedSections: {} },
    save: { singleFile: false },
  };
})(typeof window !== "undefined" ? window : globalThis);
