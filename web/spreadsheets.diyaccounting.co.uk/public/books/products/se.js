// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/products/se.js
//
// The Self Employed view manifest: what the shared shell (shell.js) mounts
// for a Self Employed book. Plain data plus functions, loaded as a classic
// script before the engine, so every function that needs the engine or the
// product module receives it in its ctx argument.
//
// Self Employed is a nine-workbook package, so a figure's report key names
// the file as well as the sheet: the hub's own sheets under
// "Financialaccounts.xlsx", every leaf sheet under its own file name. The
// labels, units and cells all come from the product module (app/products/
// se.js) through engine.productModule("se") -- CELL_MAP for the rows the
// report prints as sections, cellLabels() for every other cell the
// calculator produces. The tables kept here name snapshot keys, the sheet's
// own month columns and the code letters its analysis columns carry, none
// of which any cell holds.

(function (global) {
  "use strict";
  global.DiyaGlProducts = global.DiyaGlProducts || {};

  var PRODUCT_ID = "se";
  var SCHEMA_NAME = "SelfEmployed";
  // The workbook every hub sheet belongs to; the same name link-caches.js
  // exports as HUB_FILE and report-serializer.js prefixes a hub cell key with.
  var HUB_FILE = "Financialaccounts.xlsx";

  var PL_SHEET = "Profit & Loss Account";
  var PL_SECTION = "Profit & Loss Account";
  var STOCK_SHEET = "StockControl";
  var WAGES_SHEET = "Wagesinterface";
  var BUSINESS_DETAILS_SHEET = "Business Details";
  var BUSINESS_DETAILS_SECTION = "Business Details";
  var QUARTERLY_SECTION = "Quarterly Summary";
  var FORECAST_SECTION = "Profit Forecast";
  var ADMIN_SECTION = "Admin (Generator Injected)";

  var SCHEDULE_SHEET = "Fixedassets.xlsx!Schedule";
  var HP_SHEET = "Fixedassets.xlsx!HPfinance";
  var PAYE_SCHEDULE_SHEET = "Payslips.xlsx!Payment";
  var OPENING_DEBTORS_SHEET = "Sales.xlsx!OpeningDebtors";
  var CLOSING_DEBTORS_SHEET = "Sales.xlsx!ClosingDebtors";
  var OPENING_CREDITORS_SHEET = "Purchases.xlsx!OpeningCreditors";
  var CLOSING_CREDITORS_SHEET = "Purchases.xlsx!ClosingCreditors";
  var LEDGER_TOTAL_CELL = "G1";

  // Snapshot key per annual profit and loss cell, in the sheet's own row
  // order. Labels, sections and cells come from CELL_MAP; this table names
  // the key a month row and the annual row carry, and which rows the
  // statement rules off as totals.
  var PL_KEYS = {
    B5: { key: "salesProductA" },
    B6: { key: "salesProductB" },
    B7: { key: "salesProductC" },
    B8: { key: "otherIncome" },
    B9: { key: "sales", total: true },
    B11: { key: "grants" },
    B14: { key: "materials" },
    B15: { key: "subcontractors" },
    B16: { key: "otherDirectCosts" },
    B17: { key: "costOfSales", total: true },
    B19: { key: "grossProfit", total: true },
    B21: { key: "wages" },
    B22: { key: "premises" },
    B23: { key: "repairs" },
    B24: { key: "generalAdmin" },
    B25: { key: "motorExpenses" },
    B26: { key: "travel" },
    B27: { key: "advertising" },
    B28: { key: "legalProfessional" },
    B29: { key: "badDebts" },
    B30: { key: "bankInterest" },
    B31: { key: "hpInterest" },
    B32: { key: "otherExpenses" },
    B33: { key: "lossOnDisposal" },
    B34: { key: "depreciation" },
    B35: { key: "totalExpenses", total: true },
    B37: { key: "operatingProfit", total: true },
    B39: { key: "netProfit", total: true },
  };

  // B39 is B37 plus B38, the interest the bank book received. The sheet
  // prints that row and both engines read it, but CELL_MAP does not name
  // it, so the column takes the sheet's own A38 caption and carries no
  // section key of its own.
  var INTEREST_RECEIVED = { after: "B37", cell: "B38", key: "interestReceived", label: "Interest received" };

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

  // The two bank workbooks and the journal each one's entries appear under.
  var BANK_ACCOUNTS = [
    { id: "1200", file: "Bank.xlsx", journal: "bank", label: "Bank" },
    { id: "1220", file: "Cash.xlsx", journal: "cash", label: "Cash" },
  ];

  // The profit and loss account's own month columns, Apr through Mar, which
  // is the only year a Self Employed package covers.
  var MONTH_COLUMNS = {
    Apr: "C",
    May: "D",
    Jun: "E",
    Jul: "F",
    Aug: "G",
    Sep: "H",
    Oct: "I",
    Nov: "J",
    Dec: "K",
    Jan: "L",
    Feb: "M",
    Mar: "N",
  };

  // Wagesinterface and the PAYE remittance schedule both keep one row per
  // tax month, Apr at row 4 through Mar at row 15.
  var PAYROLL_FIRST_ROW = 4;
  var WAGES_COLUMNS = { grossPay: "C", incomeTax: "D", employeeNI: "E", employerNI: "H" };
  var PAYE_SCHEDULE_COLUMNS = { monthEnd: "B", dueDate: "C", nationalInsurance: "D", incomeTax: "E", total: "I" };
  // The schedule's first two columns are the tax month end and the day the
  // payment falls due, both dates the payroll calendar hands over as Excel
  // serials; the rest of the row is money.
  var PAYE_SCHEDULE_DATE_FIELDS = { monthEnd: 1, dueDate: 1 };

  // The stock sheet's own count cells, which the book's opening and closing
  // stock values are written into.
  var STOCK_CELLS = { opening: "AB6", closing: "AB30" };

  // The schedule's totals row, in the order a fixed asset note reads.
  var SCHEDULE_CELLS = ["E57", "E110", "W1", "E1", "I1", "Q1", "K1"];
  // One hire purchase agreement a row, at the two rows the writer fills.
  var HP_ROWS = [8, 10];
  var HP_COLUMNS = { monthlyPayment: "I", capital: "J", interest: "K" };
  var HP_TOTAL_CELL = "E2";

  // The four Admin cells whose unit misdescribes how they print: the
  // mileage rates are pence a mile, not a percentage.
  var ADMIN_PENCE_CELLS = { G21: 1, G22: 1 };

  var ENTITY_PATH_PREFIX = "entityInformation.";

  // The chart a new Self Employed book starts from: one account per profit
  // and loss row the sales and purchase journals feed, so a blank book
  // already has somewhere for every kind of entry to post to, plus the two
  // bank books the package carries. The descriptions are the statement's own
  // captions.
  var STANDARD_NEW_BOOK_CHART = {
    sales: {
      4000: { accountMainDescription: "Sales Product A" },
      4001: { accountMainDescription: "Sales Product B" },
      4002: { accountMainDescription: "Sales Product C" },
      4003: { accountMainDescription: "Other Income" },
      4004: { accountMainDescription: "Investment Grants received" },
      4005: { accountMainDescription: "Bad Debts written off" },
    },
    purchases: {
      5000: { accountMainDescription: "Purchases after stock adjustment" },
      5001: { accountMainDescription: "Sub contractors" },
      5002: { accountMainDescription: "Other Direct Cost of Sales" },
      5101: { accountMainDescription: "Wages and Salaries" },
      5201: { accountMainDescription: "Premises Rent Rates Power" },
      5400: { accountMainDescription: "Repairs & Maintenance" },
      5501: { accountMainDescription: "General Administrative Expenses" },
      5601: { accountMainDescription: "Motor Expenses" },
      5600: { accountMainDescription: "Travel Hotel & Subsistence" },
      5500: { accountMainDescription: "Advertising & Promotion" },
      5800: { accountMainDescription: "Legal & Professional Fees" },
      5801: { accountMainDescription: "Other Expenses" },
      5900: { accountMainDescription: "Fixed asset purchases" },
    },
    bank: {
      1200: { accountMainDescription: "Current account", accountType: "bank" },
      1220: { accountMainDescription: "Cash account", accountType: "bank" },
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

  // Every cell either engine reads, with the label and unit the product
  // module gives it -- CELL_MAP's own rows and the leaf cells beside them.
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
    if (sheet === "Admin" && ADMIN_PENCE_CELLS[cell]) return "pence";
    var entry = labelsOf(productMod)[sheet + "!" + cell];
    return (entry && entry.unit) || "money";
  }

  function sectionRowsOf(productMod, section) {
    return productMod.CELL_MAP.filter(function (row) {
      return row[4] === section;
    });
  }

  // The year table's columns and the month rows' buckets: the statement's
  // own rows as CELL_MAP names them, the interest row the sheet prints
  // beside them, and the one bucket no column shows.
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
      });
      if (row[1] === INTEREST_RECEIVED.after) {
        out.push({
          key: INTEREST_RECEIVED.key,
          label: INTEREST_RECEIVED.label,
          sheet: PL_SHEET,
          cell: INTEREST_RECEIVED.cell,
          computed: false,
        });
      }
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

  // A category's cell on one month's column, the way the statement lays the
  // year out: the same row, the month's own column.
  function monthlyCell(monthLabel, productMod, categoryKey) {
    var column = MONTH_COLUMNS[monthLabel];
    var annualCell = cellByKey(productMod)[categoryKey];
    if (!column || !annualCell) return null;
    return [PL_SHEET, column + rowNumber(annualCell)];
  }

  // ============================== classifying a line ==============================

  var scenarioCache = new WeakMap();

  // The scenario the engine builds from this book and these lines, with its
  // own expected table merged in, which is the shape both the code letters
  // and the unscoped cells below are read from.
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

  function bankAccountOf(line) {
    var id = String(line["diya-gl:bankAccountID"]);
    for (var i = 0; i < BANK_ACCOUNTS.length; i++) {
      if (BANK_ACCOUNTS[i].id === id) return BANK_ACCOUNTS[i];
    }
    return null;
  }

  // Which journal a line belongs to, and whether it reaches a total at all.
  // The month rows' own figures are the statement's own month columns (see
  // derive below), so the key here says only "this line is posted": a sales
  // or purchase line whose account the engine's filter drops reaches
  // nothing, and everything else lands in the month's posted-line total.
  function classify(line, book, ctx) {
    var account = String(line.accountMainID);
    if (line.sourceJournalID === "sales" || line.sourceJournalID === "purchases") {
      var journal = line.sourceJournalID;
      var posted = codeMaps(ctx)[journal][account] !== undefined;
      return { journal: journal, key: posted ? POSTED_TOTAL_KEY : null };
    }
    if (line.sourceJournalID === "bank") {
      var bankAccount = bankAccountOf(line);
      if (!bankAccount) return { journal: null, key: null };
      return { journal: bankAccount.journal, key: POSTED_TOTAL_KEY };
    }
    if (line.sourceJournalID === "payroll") {
      return { journal: "payroll", key: POSTED_TOTAL_KEY };
    }
    return { journal: null, key: null };
  }

  var linkCellsCache = new WeakMap();

  // Every cell the calculator produces, the hub's sheets under their bare
  // names, unscoped by the report's own read list. The statement's month
  // columns are in here and not in the results the report carries, so the
  // year table's month rows come from this rather than from a second sum
  // over the lines: VAT netting, the mileage claim, the payroll addback and
  // the year-end stock movement are all already in them.
  function linkCells(ctx) {
    var found = linkCellsCache.get(ctx);
    if (found) return found;
    var cells = ctx.engine.calculateLinkCells(ctx.book, ctx.lines, PRODUCT_ID, ctx.taxData, scenarioOf(ctx));
    linkCellsCache.set(ctx, cells);
    return cells;
  }

  function monthColumnOf(ctx, monthKey) {
    for (var i = 0; i < ctx.months.length; i++) {
      if (ctx.months[i].key === monthKey) return MONTH_COLUMNS[ctx.months[i].label];
    }
    return null;
  }

  // The statement's own figure for one category in one month.
  function derive(row, monthKey, ctx) {
    var column = monthColumnOf(ctx, monthKey);
    var statement = linkCells(ctx)[PL_SHEET] || {};
    categories(ctx.productMod).forEach(function (category) {
      if (!category.cell) return;
      row[category.key] = column ? num(statement[column + rowNumber(category.cell)]) : 0;
    });
    // The headline strip's monthly chart reads a direct-costs column; this
    // statement folds direct costs into cost of sales.
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
      opening: num(stock.openingValue),
      closing: num(stock.closingValue),
      openingCell: STOCK_CELLS.opening,
      closingCell: STOCK_CELLS.closing,
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
  // the purchase journal bought during it.
  function buildFixedAssets(ctx) {
    var broughtForward = (ctx.book.fixedAssets || []).map(function (asset) {
      return {
        description: asset.description || asset.assetID || "Fixed asset",
        cost: num(asset.cost),
        accumulatedDepreciation: num(asset.accumulatedDepreciation),
        writtenDownValue: num(asset.cost) - num(asset.accumulatedDepreciation),
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
        analysis: analysisByCode(ctx, account),
      };
    });
    return { accounts: accounts, settlements: ctx.engine.settlementSuggestions({ book: ctx.book, lines: ctx.lines }) };
  }

  // One workbook's own analysis columns, month by month: the code letters
  // its month tabs carry as headings, with the month's total under each.
  function analysisByCode(ctx, account) {
    var layout = ctx.productMod.BANK_LAYOUTS[account.file];
    var receiptCodes = Array.from(layout.receiptCodes);
    var paymentCodes = Array.from(layout.paymentCodes);
    var byMonth = {};
    ctx.lines.forEach(function (line) {
      if (line.sourceJournalID !== "bank") return;
      if (String(line["diya-gl:bankAccountID"]) !== account.id) return;
      var monthKey = line.postingDate.slice(0, 7);
      if (!byMonth[monthKey]) byMonth[monthKey] = { receipts: {}, payments: {} };
      var side = line.debitCreditCode === "D" ? "receipts" : "payments";
      var code = line["diya-gl:bankCode"];
      byMonth[monthKey][side][code] = num(byMonth[monthKey][side][code]) + line.amount;
    });
    return { receiptCodes: receiptCodes, paymentCodes: paymentCodes, byMonth: byMonth };
  }

  function buildPayroll(ctx) {
    var employees = (ctx.book.employees || []).map(function (employee) {
      return { employeeID: employee.employeeID, name: employee.name, role: employee.role };
    });
    var rows = ctx.lines
      .filter(function (line) {
        return line.sourceJournalID === "payroll";
      })
      .map(function (line) {
        return {
          monthKey: line.postingDate.slice(0, 7),
          postingDate: line.postingDate,
          employee: line.detailComment || line["diya-gl:employeeID"] || "",
          grossPay: num(line["diya-gl:grossPay"]),
          incomeTax: num(line["diya-gl:incomeTax"]),
          employeeNI: num(line["diya-gl:employeeNI"]),
          employerNI: num(line["diya-gl:employerNI"]),
          netPay: num(line["diya-gl:netPay"]),
        };
      })
      .sort(function (a, b) {
        if (a.postingDate !== b.postingDate) return a.postingDate < b.postingDate ? -1 : 1;
        return a.employee < b.employee ? -1 : a.employee > b.employee ? 1 : 0;
      });
    return { employees: employees, rows: rows };
  }

  function snapshot(ctx) {
    return {
      annual: buildAnnual(ctx),
      stock: buildStock(ctx),
      ledgers: buildLedgers(ctx),
      fixedAssets: buildFixedAssets(ctx),
      bank: buildBank(ctx),
      payroll: buildPayroll(ctx),
    };
  }

  // ============================== report keys ==============================

  // The report keys one calculated cell carries: the section key CELL_MAP
  // gives a row the report prints, and the cell key the serializer writes
  // for every cell in the results. A cell the calculator produced no value
  // for carries neither -- R has no entry for it to join on.
  function cellRk(snap, helpers, sheet, cell) {
    var sheetResults = snap.results[sheet];
    if (!sheetResults) return "";
    var value = sheetResults[cell];
    if (value === undefined || value === null || value === "") return "";
    return helpers.rkFor(sheet, cell) || helpers.rk(helpers.cellKey(qualified(sheet), cell));
  }

  // ============================== formatting ==============================

  // Excel keeps a date as the number of days since 1899-12-30; the schedule
  // and the payroll calendar hand their dates over that way.
  var EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
  var MS_PER_DAY = 86400000;

  function excelDate(serial) {
    return new Date(EXCEL_EPOCH_MS + serial * MS_PER_DAY).toISOString().slice(0, 10);
  }

  function formatByUnit(value, unit, helpers) {
    if (value === undefined || value === null || value === "") return "—";
    if (unit === "text") return helpers.esc(String(value));
    if (typeof value !== "number") return helpers.esc(String(value));
    if (unit === "rate") return helpers.fmtRate(value);
    if (unit === "pence") return helpers.fmtPence(value);
    if (unit === "count") return value.toLocaleString("en-GB");
    if (unit === "date") return helpers.esc(excelDate(value));
    return helpers.fmtMoney(value);
  }

  // A section of CELL_MAP rows as a kv-table, each figure in the unit the
  // product module gives its cell.
  function sectionTable(snap, helpers, section, markTotals) {
    var productMod = snap.context.productMod;
    var rows = helpers.sectionRows(section).map(function (row) {
      return {
        label: row.label,
        text: formatByUnit(row.value, unitOf(productMod, row.sheet, row.cell), helpers),
        rKeyAttr: cellRk(snap, helpers, row.sheet, row.cell),
        total: !!markTotals && row.indent === 0,
      };
    });
    return helpers.kvRows(rows);
  }

  // ============================== the views ==============================

  // The statement's own rows, in the order the sheet prints them: the year
  // table's columns are the same list, so the two views never disagree about
  // which rows the account has.
  function statementRows(productMod) {
    return categories(productMod).filter(function (category) {
      return category.cell;
    });
  }

  function renderProfitLoss(snap, state, helpers) {
    var view = helpers.viewState("profit-loss", { monthsOpen: false });
    var productMod = snap.context.productMod;
    var rows = statementRows(productMod);
    var statement =
      '<div class="panel-card panel-form-width">' +
      helpers.kvRows(
        rows.map(function (row) {
          return {
            label: row.label,
            value: cellValue(snap.results, row.sheet, row.cell),
            rKeyAttr: cellRk(snap, helpers, row.sheet, row.cell),
            total: !!(PL_KEYS[row.cell] || {}).total,
          };
        }),
      ) +
      "</div>";
    return (
      "<h2>Profit &amp; Loss Account</h2>" +
      statement +
      '<button type="button" class="btn" id="pl-months-toggle" aria-expanded="' +
      (view.monthsOpen ? "true" : "false") +
      '">' +
      (view.monthsOpen ? "Hide the months" : "Show the months") +
      "</button>" +
      (view.monthsOpen ? renderProfitLossMonths(snap, helpers, productMod, rows) : "")
    );
  }

  // The statement's own month columns, C through N, for the rows that carry
  // them. The rows the read scope only totals for the year -- cost of sales,
  // the expense total and the profit lines -- have no month cell to print.
  function renderProfitLossMonths(snap, helpers, productMod, rows) {
    var months = snap.months;
    var head =
      "<tr><th>Row</th>" +
      months
        .map(function (month) {
          return "<th>" + helpers.esc(month.label) + "</th>";
        })
        .join("") +
      "</tr>";
    var body = rows
      .map(function (row) {
        var cells = months
          .map(function (month) {
            var pair = monthlyCell(month.label, productMod, row.key);
            if (!pair) return '<td class="num">—</td>';
            var value = snap.results[pair[0]] && snap.results[pair[0]][pair[1]];
            if (value === undefined) return '<td class="num">—</td>';
            return '<td class="num"' + cellRk(snap, helpers, pair[0], pair[1]) + ">" + helpers.fmtMoney(value) + "</td>";
          })
          .join("");
        return "<tr><th>" + helpers.esc(row.label) + "</th>" + cells + "</tr>";
      })
      .join("");
    return (
      '<div class="se-months-scroll"><table class="register-table se-months-table"><thead>' +
      head +
      "</thead><tbody>" +
      body +
      "</tbody></table></div>"
    );
  }

  function bindProfitLoss(root, state, helpers) {
    var toggle = root.querySelector("#pl-months-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", function () {
      var view = helpers.viewState("profit-loss", { monthsOpen: false });
      view.monthsOpen = !view.monthsOpen;
      helpers.render();
    });
  }

  function renderQuarterly(snap, state, helpers) {
    return (
      "<h2>Quarterly summary</h2>" +
      '<p class="view-lede">The three product sales lines and the two direct cost lines only, quarter by quarter, as the VitalTax sheet prints them.</p>' +
      '<div class="panel-card panel-form-width">' +
      sectionTable(snap, helpers, QUARTERLY_SECTION, true) +
      "</div>"
    );
  }

  function renderForecast(snap, state, helpers) {
    return (
      "<h2>Profit forecast</h2>" +
      '<p class="view-lede">The projected year the sheet builds from the months that have traded so far.</p>' +
      '<div class="panel-card panel-form-width">' +
      sectionTable(snap, helpers, FORECAST_SECTION, true) +
      "</div>"
    );
  }

  function renderAdmin(snap, state, helpers) {
    return (
      "<h2>Admin</h2>" +
      '<p class="view-lede rate-provenance">The tax year\'s rates and thresholds as the package was generated with them, read-only.</p>' +
      '<div class="panel-card">' +
      sectionTable(snap, helpers, ADMIN_SECTION) +
      "</div>"
    );
  }

  function renderStock(snap, state, helpers) {
    var stock = snap.stock;
    return (
      "<h2>Stock</h2>" +
      '<p class="view-lede">The stock the year opened and closed with. Changing either recalculates the whole book: the movement lands in the last month\'s purchases row.</p>' +
      '<div class="panel-card panel-form-width">' +
      '<div class="editable-field"><label for="se-stock-opening">' +
      helpers.esc(labelFor(snap.context.productMod, STOCK_SHEET, stock.openingCell, "Opening stock")) +
      '</label><input id="se-stock-opening" type="text" inputmode="decimal" data-stock-field="openingValue" value="' +
      stock.opening.toFixed(2) +
      '"' +
      cellRk(snap, helpers, STOCK_SHEET, stock.openingCell) +
      " /></div>" +
      '<div class="editable-field"><label for="se-stock-closing">' +
      helpers.esc(labelFor(snap.context.productMod, STOCK_SHEET, stock.closingCell, "Closing stock")) +
      '</label><input id="se-stock-closing" type="text" inputmode="decimal" data-stock-field="closingValue" value="' +
      stock.closing.toFixed(2) +
      '"' +
      cellRk(snap, helpers, STOCK_SHEET, stock.closingCell) +
      " /></div>" +
      helpers.readOnlyField("Stock movement (cost of sales adjustment)", helpers.fmtMoney(stock.opening - stock.closing)) +
      "</div>"
    );
  }

  // The stock figures are amounts, so they commit as numbers rather than
  // through the shared text-field binding.
  function bindStock(root, state, helpers) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-stock-field]"), function (input) {
      var field = input.getAttribute("data-stock-field");
      var committed = input.value;
      input.addEventListener("change", function () {
        var value = Number(String(input.value).replace(/[£,\s]/g, ""));
        if (!isFinite(value)) {
          input.value = committed;
          helpers.showToast("That is not an amount. The book is unchanged.");
          return;
        }
        var next = JSON.parse(JSON.stringify(liveSnapshot().book));
        if (!next.stock) next.stock = { openingValue: 0, closingValue: 0 };
        next.stock[field] = value;
        helpers.commitBook(next, "change the " + field, "Changed the stock figures.");
      });
    });
  }

  function renderLedgers(snap, state, helpers) {
    function side(title, ledger) {
      var total = ledger.rows.reduce(function (sum, entry) {
        return sum + num(entry.amount);
      }, 0);
      var body = ledger.rows.length
        ? ledger.rows
            .map(function (entry) {
              return (
                "<tr><td>" +
                helpers.esc(entry.counterparty || "") +
                "</td><td>" +
                helpers.esc(entry.invoice || "") +
                '</td><td class="num">' +
                helpers.fmtMoney(num(entry.amount)) +
                "</td></tr>"
              );
            })
            .join("")
        : '<tr><td colspan="3">This book records none.</td></tr>';
      return (
        '<div class="panel-card"><h3>' +
        title +
        '</h3><table class="register-table"><thead><tr><th>Contact</th><th>Invoice</th><th>Amount</th></tr></thead><tbody>' +
        body +
        '</tbody><tfoot><tr class="total"><th colspan="2">Total</th><td class="num"' +
        cellRk(snap, helpers, ledger.sheet, LEDGER_TOTAL_CELL) +
        ">" +
        helpers.fmtMoney(total) +
        "</td></tr></tfoot></table></div>"
      );
    }
    var ledgers = snap.ledgers;
    return (
      "<h2>Ledgers</h2>" +
      '<p class="view-lede">Who owed the business and who it owed, at the start of the year and at the end.</p>' +
      '<div class="panel-grid">' +
      side("Debtors brought forward", ledgers.debtors.opening) +
      side("Debtors carried forward", ledgers.debtors.closing) +
      side("Creditors brought forward", ledgers.creditors.opening) +
      side("Creditors carried forward", ledgers.creditors.closing) +
      "</div>"
    );
  }

  function renderFixedAssets(snap, state, helpers) {
    var productMod = snap.context.productMod;
    var assets = snap.fixedAssets;

    var broughtForward = assets.broughtForward.length
      ? assets.broughtForward
          .map(function (asset) {
            return (
              "<tr><td>" +
              helpers.esc(asset.description) +
              '</td><td class="num">' +
              helpers.fmtMoney(asset.cost) +
              '</td><td class="num">' +
              helpers.fmtMoney(asset.accumulatedDepreciation) +
              '</td><td class="num">' +
              helpers.fmtMoney(asset.writtenDownValue) +
              "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="4">This book brought no assets into the year.</td></tr>';

    var additions = assets.additions.length
      ? assets.additions
          .map(function (asset) {
            return (
              "<tr><td>" +
              helpers.esc(asset.postingDate) +
              "</td><td>" +
              helpers.esc(asset.description) +
              '</td><td class="num">' +
              helpers.fmtMoney(asset.cost) +
              "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="3">This book bought no assets during the year.</td></tr>';

    var scheduleRows = SCHEDULE_CELLS.map(function (cell) {
      return {
        label: labelFor(productMod, SCHEDULE_SHEET, cell, SCHEDULE_SHEET + "!" + cell),
        value: cellValue(snap.results, SCHEDULE_SHEET, cell),
        rKeyAttr: cellRk(snap, helpers, SCHEDULE_SHEET, cell),
      };
    });

    var agreements = assets.agreements.length
      ? assets.agreements
          .map(function (agreement) {
            function figure(field) {
              if (!agreement.row) return '<td class="num">—</td>';
              var cell = HP_COLUMNS[field] + agreement.row;
              return (
                '<td class="num"' +
                cellRk(snap, helpers, HP_SHEET, cell) +
                ">" +
                helpers.fmtMoney(cellValue(snap.results, HP_SHEET, cell)) +
                "</td>"
              );
            }
            return (
              "<tr><td>" +
              helpers.esc(agreement.agreementID || "") +
              "</td><td>" +
              helpers.esc(agreement.financeCompany || "") +
              '</td><td class="num">' +
              helpers.fmtMoney(agreement.amountFinanced) +
              '</td><td class="num">' +
              helpers.esc(String(agreement.termMonths || "")) +
              "</td>" +
              figure("monthlyPayment") +
              figure("capital") +
              figure("interest") +
              "</tr>"
            );
          })
          .join("")
      : '<tr><td colspan="7">This book carries no hire purchase agreements.</td></tr>';

    return (
      "<h2>Fixed assets</h2>" +
      '<div class="panel-card"><h3>Brought into the year</h3>' +
      '<table class="register-table"><thead><tr><th>Asset</th><th>Cost</th><th>Depreciation</th><th>Written down</th></tr></thead><tbody>' +
      broughtForward +
      "</tbody></table></div>" +
      '<div class="panel-card"><h3>Bought during the year</h3>' +
      '<table class="register-table"><thead><tr><th>Date</th><th>Asset</th><th>Cost</th></tr></thead><tbody>' +
      additions +
      "</tbody></table></div>" +
      '<div class="panel-card"><h3>The schedule\'s own totals</h3>' +
      helpers.kvRows(scheduleRows) +
      "</div>" +
      '<div class="panel-card"><h3>Hire purchase</h3><div class="se-months-scroll">' +
      '<table class="register-table"><thead><tr><th>Agreement</th><th>Finance company</th><th>Financed</th><th>Months</th><th>Monthly</th><th>Capital</th><th>Interest</th></tr></thead><tbody>' +
      agreements +
      '</tbody><tfoot><tr class="total"><th colspan="2">Long-term creditor</th><td class="num"' +
      cellRk(snap, helpers, HP_SHEET, HP_TOTAL_CELL) +
      ">" +
      helpers.fmtMoney(cellValue(snap.results, HP_SHEET, HP_TOTAL_CELL)) +
      '</td><td colspan="4"></td></tr></tfoot></table></div></div>'
    );
  }

  // ============================== the bank book ==============================

  function bankViewState(helpers) {
    return helpers.viewState("bank", { account: BANK_ACCOUNTS[0].id, settlement: null });
  }

  function accountById(snap, id) {
    return snap.bank.accounts.filter(function (account) {
      return account.id === id;
    })[0];
  }

  function renderBank(snap, state, helpers) {
    var view = bankViewState(helpers);
    var account = accountById(snap, view.account) || snap.bank.accounts[0];
    var switchHtml =
      '<div class="account-switch" role="group" aria-label="Bank account">' +
      snap.bank.accounts
        .map(function (candidate) {
          return (
            '<button type="button" class="account-switch-btn" data-account="' +
            helpers.esc(candidate.id) +
            '" aria-pressed="' +
            (candidate.id === account.id ? "true" : "false") +
            '">' +
            helpers.esc(candidate.label + " — " + candidate.id) +
            "</button>"
          );
        })
        .join("") +
      "</div>";
    return (
      "<h2>Bank book</h2>" +
      switchHtml +
      renderBalances(snap, helpers, account) +
      renderAnalysis(snap, helpers, account) +
      renderSettlements(snap, helpers, view)
    );
  }

  function monthLabelOf(snap, monthKey) {
    for (var i = 0; i < snap.months.length; i++) {
      if (snap.months[i].key === monthKey) return snap.months[i].label;
    }
    return monthKey;
  }

  // The month tabs' own opening and closing balances. Only the last month's
  // closing is a figure the report carries -- A2 on the March tab, the one
  // cell the read scope takes off each bank workbook.
  function renderBalances(snap, helpers, account) {
    var months = account.months;
    var rows = months
      .map(function (month, index) {
        var closingRk =
          index === months.length - 1 ? cellRk(snap, helpers, account.file + "!" + monthLabelOf(snap, month.month), "A2") : "";
        return (
          "<tr><th>" +
          helpers.esc(monthLabelOf(snap, month.month)) +
          '</th><td class="num">' +
          helpers.fmtMoney(month.opening) +
          '</td><td class="num">' +
          helpers.fmtMoney(month.receipts) +
          '</td><td class="num">' +
          helpers.fmtMoney(month.payments) +
          '</td><td class="num"' +
          closingRk +
          ">" +
          helpers.fmtMoney(month.closing) +
          "</td></tr>"
        );
      })
      .join("");
    return (
      '<div class="panel-card"><h3>' +
      helpers.esc(account.label + " balances, month by month") +
      "</h3>" +
      '<table class="register-table"><thead><tr><th>Month</th><th>Opening</th><th>Receipts</th><th>Payments</th><th>Closing</th></tr></thead><tbody>' +
      rows +
      "</tbody></table></div>"
    );
  }

  // The workbook's own analysis columns: one column per code letter its
  // month tabs carry as a heading, receipts and payments apart.
  function renderAnalysis(snap, helpers, account) {
    function table(title, codes, side) {
      var head =
        "<tr><th>Month</th>" +
        codes
          .map(function (code) {
            return "<th>" + helpers.esc(code) + "</th>";
          })
          .join("") +
        "</tr>";
      var body = snap.months
        .map(function (month) {
          var byCode = (account.analysis.byMonth[month.key] || {})[side] || {};
          return (
            "<tr><th>" +
            helpers.esc(month.label) +
            "</th>" +
            codes
              .map(function (code) {
                return '<td class="num">' + helpers.fmtMoney(num(byCode[code])) + "</td>";
              })
              .join("") +
            "</tr>"
          );
        })
        .join("");
      return (
        '<div class="panel-card"><h3>' +
        title +
        '</h3><div class="se-months-scroll"><table class="register-table"><thead>' +
        head +
        "</thead><tbody>" +
        body +
        "</tbody></table></div></div>"
      );
    }
    return (
      '<div class="panel-grid">' +
      table("Receipts by code letter", account.analysis.receiptCodes, "receipts") +
      table("Payments by code letter", account.analysis.paymentCodes, "payments") +
      "</div>"
    );
  }

  var SETTLEMENTS_SHOWN = 8;

  // Every half of a settlement the book is missing: a banked receipt with no
  // sale behind it, a payment with no purchase, an invoice that never
  // reached the bank. Applying one adds the missing line as a single
  // undoable step.
  function renderSettlements(snap, helpers, view) {
    var settlements = snap.bank.settlements;
    if (!settlements.length) {
      return '<div class="panel-card"><h3>Settlements</h3><p class="entries-note">Every sale and purchase in this book has its bank line, and every bank line has its invoice.</p></div>';
    }
    var shown = settlements.slice(0, SETTLEMENTS_SHOWN);
    var items = shown
      .map(function (settlement) {
        var open = view.settlement === settlement.id;
        var change = settlement.changes[0];
        var controls = open
          ? '<ul class="helper-changes"><li>' +
            helpers.esc(change.what) +
            " " +
            helpers.esc(change.becomes) +
            " — " +
            helpers.fmtMoney(change.amount) +
            " on " +
            helpers.esc(change.postingDate) +
            "</li></ul>" +
            '<div class="settlement-actions">' +
            '<button type="button" class="btn btn-primary" data-settlement-apply="' +
            helpers.esc(settlement.id) +
            '">' +
            helpers.esc(settlement.actionLabel) +
            "</button>" +
            '<button type="button" class="btn" data-settlement-cancel="' +
            helpers.esc(settlement.id) +
            '">Cancel</button></div>'
          : '<button type="button" class="btn" data-settlement-preview="' + helpers.esc(settlement.id) + '">Preview</button>';
        return (
          '<li class="settlement"><p><strong>' +
          helpers.esc(settlement.title) +
          "</strong> — " +
          helpers.esc(settlement.entryNumber) +
          " · " +
          helpers.esc(change.counterparty) +
          " · " +
          helpers.fmtMoney(change.amount) +
          "</p>" +
          controls +
          "</li>"
        );
      })
      .join("");
    return (
      '<div class="panel-card"><h3>Settlements</h3>' +
      '<p class="view-lede">' +
      settlements.length +
      (settlements.length === 1 ? " half is missing its other side." : " halves are missing their other side.") +
      "</p>" +
      '<ul class="settlement-list">' +
      items +
      "</ul>" +
      (settlements.length > shown.length ? '<p class="entries-note">and ' + (settlements.length - shown.length) + " more</p>" : "") +
      "</div>"
    );
  }

  function bindBank(root, state, helpers) {
    var view = bankViewState(helpers);
    Array.prototype.forEach.call(root.querySelectorAll("[data-account]"), function (button) {
      button.addEventListener("click", function () {
        view.account = button.getAttribute("data-account");
        view.settlement = null;
        helpers.render();
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-settlement-preview]"), function (button) {
      button.addEventListener("click", function () {
        view.settlement = button.getAttribute("data-settlement-preview");
        helpers.render();
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-settlement-cancel]"), function (button) {
      button.addEventListener("click", function () {
        view.settlement = null;
        helpers.render();
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-settlement-apply]"), function (button) {
      button.addEventListener("click", function () {
        var id = button.getAttribute("data-settlement-apply");
        var snap = liveSnapshot();
        var engine = snap.context.engine;
        var book = snap.book;
        var lines = snap.lines;
        view.settlement = null;
        helpers.commit(
          function () {
            return engine.applySettlement({ book: book, lines: lines }, id);
          },
          "settle " + id,
          "Added the missing half of " + id + ".",
        );
      });
    });
  }

  // ============================== payroll ==============================

  function renderPayroll(snap, state, helpers) {
    var rows = snap.payroll.rows;
    var body = rows.length
      ? rows
          .map(function (row) {
            return (
              "<tr><td>" +
              helpers.esc(monthLabelOf(snap, row.monthKey)) +
              "</td><td>" +
              helpers.esc(row.employee) +
              '</td><td class="num">' +
              helpers.fmtMoney(row.grossPay) +
              '</td><td class="num">' +
              helpers.fmtMoney(row.incomeTax) +
              '</td><td class="num">' +
              helpers.fmtMoney(row.employeeNI) +
              '</td><td class="num">' +
              helpers.fmtMoney(row.employerNI) +
              '</td><td class="num">' +
              helpers.fmtMoney(row.netPay) +
              "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="7">This book runs no payroll.</td></tr>';

    return (
      "<h2>Payroll</h2>" +
      renderEmployees(snap, helpers) +
      '<div class="panel-card"><h3>Every payslip</h3><div class="se-months-scroll">' +
      '<table class="register-table"><thead><tr><th>Month</th><th>Employee</th><th>Gross</th><th>PAYE</th><th>Employee NI</th><th>Employer NI</th><th>Net</th></tr></thead><tbody>' +
      body +
      "</tbody></table></div></div>" +
      renderWagesInterface(snap, helpers) +
      renderPayeSchedule(snap, helpers)
    );
  }

  // The people the book declares, which is what the Employee sheet's five
  // blocks hold and what a payslip has to name.
  function renderEmployees(snap, helpers) {
    var employees = snap.payroll.employees;
    if (!employees.length) return "";
    return (
      '<div class="panel-card"><h3>Employees</h3>' +
      '<table class="register-table"><thead><tr><th>Employee</th><th>Reference</th><th>Role</th></tr></thead><tbody>' +
      employees
        .map(function (employee) {
          return (
            "<tr><td>" +
            helpers.esc(employee.name || "") +
            "</td><td>" +
            helpers.esc(employee.employeeID || "") +
            "</td><td>" +
            helpers.esc(employee.role || "") +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>"
    );
  }

  // The month totals the hub reads back across the payroll link, one row a
  // tax month.
  function renderWagesInterface(snap, helpers) {
    var columns = ["grossPay", "incomeTax", "employeeNI", "employerNI"];
    var body = snap.months
      .map(function (month, index) {
        var row = PAYROLL_FIRST_ROW + index;
        return (
          "<tr><th>" +
          helpers.esc(month.label) +
          "</th>" +
          columns
            .map(function (field) {
              var cell = WAGES_COLUMNS[field] + row;
              return (
                '<td class="num"' +
                cellRk(snap, helpers, WAGES_SHEET, cell) +
                ">" +
                helpers.fmtMoney(cellValue(snap.results, WAGES_SHEET, cell)) +
                "</td>"
              );
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    return (
      '<div class="panel-card"><h3>Month totals</h3>' +
      '<table class="register-table"><thead><tr><th>Month</th><th>Gross</th><th>PAYE</th><th>Employee NI</th><th>Employer NI</th></tr></thead><tbody>' +
      body +
      "</tbody></table></div>"
    );
  }

  // What has to reach HMRC each tax month, and the day it falls due.
  function renderPayeSchedule(snap, helpers) {
    var productMod = snap.context.productMod;
    var body = snap.months
      .map(function (month, index) {
        var row = PAYROLL_FIRST_ROW + index;
        function figure(field) {
          var cell = PAYE_SCHEDULE_COLUMNS[field] + row;
          var unit = PAYE_SCHEDULE_DATE_FIELDS[field] ? "date" : unitOf(productMod, PAYE_SCHEDULE_SHEET, cell);
          return (
            '<td class="num"' +
            cellRk(snap, helpers, PAYE_SCHEDULE_SHEET, cell) +
            ">" +
            formatByUnit(snap.results[PAYE_SCHEDULE_SHEET] && snap.results[PAYE_SCHEDULE_SHEET][cell], unit, helpers) +
            "</td>"
          );
        }
        return (
          "<tr><th>" +
          helpers.esc(month.label) +
          "</th>" +
          figure("monthEnd") +
          figure("dueDate") +
          figure("nationalInsurance") +
          figure("incomeTax") +
          figure("total") +
          "</tr>"
        );
      })
      .join("");
    return (
      '<div class="panel-card"><h3>PAYE remittance schedule</h3><div class="se-months-scroll">' +
      '<table class="register-table"><thead><tr><th>Month</th><th>Tax month end</th><th>Due</th><th>National Insurance</th><th>Income Tax</th><th>Total payable</th></tr></thead><tbody>' +
      body +
      "</tbody></table></div></div>"
    );
  }

  // ============================== book details ==============================

  function renderBusinessDetails(snap, state, helpers) {
    var details = snap.businessDetails;
    var entity = snap.book.entityInformation || {};
    var nameRow = helpers
      .sectionRows(BUSINESS_DETAILS_SECTION)
      .filter(function (row) {
        return row.path.indexOf(ENTITY_PATH_PREFIX) === 0;
      })
      .map(function (row) {
        var bookField = row.path.slice(ENTITY_PATH_PREFIX.length);
        return helpers.field(row.label, bookField, details[bookField] || "", { rKeyAttr: cellRk(snap, helpers, row.sheet, row.cell) });
      })
      .join("");
    return (
      "<h2>Book details</h2>" +
      '<div class="panel-card panel-form-width">' +
      nameRow +
      helpers.field("Description", "organizationDescription", details.organizationDescription) +
      helpers.field("Telephone", "organizationTelephone", entity.organizationTelephone || "") +
      helpers.field("VAT number", "vatNumber", entity["diya-gl:vatNumber"] || "", { path: "entityInformation.diya-gl:vatNumber" }) +
      helpers.field("Period start", "periodCoveredStart", details.periodCoveredStart, { type: "date" }) +
      helpers.field("Year end", "periodCoveredEnd", details.periodCoveredEnd, {
        type: "date",
        hint: "Changing this loads that year's tax rates and runs every check again.",
      }) +
      helpers.readOnlyField("Basis of accounting", details.basisOfAccounting) +
      helpers.readOnlyField("VAT registered", details.vatRegistered ? "Yes" : "No") +
      "</div>"
    );
  }

  function bindBusinessDetails(root, state, helpers) {
    helpers.bindBookFields(root);
  }

  // ============================== new book and upload ==============================

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
        "diya-gl:basisOfAccounting": "cash",
      },
      accounts: JSON.parse(JSON.stringify(STANDARD_NEW_BOOK_CHART)),
    };
  }

  global.DiyaGlProducts.se = {
    id: PRODUCT_ID,
    schemaName: SCHEMA_NAME,
    title: "Self Employed",
    page: "se.html",
    stylesheet: "se.css",
    multiFile: true,
    hub: HUB_FILE,
    emptyState: {
      intro: "Open a Self Employed package as editable books in your browser. Nothing is uploaded; the files never leave your machine.",
    },
    views: [
      { id: "home", label: "Home", sheets: "Home", shared: "home" },
      { id: "year", label: "Year", sheets: "Sales, Purchases, Bank, Cash, Payslips Apr–Mar", shared: "year" },
      { id: "bank", label: "Bank book", sheets: "Bank, Cash Apr–Mar", render: renderBank, bind: bindBank },
      { id: "payroll", label: "Payroll", sheets: "Payslips, Payment, Wagesinterface", render: renderPayroll },
      { id: "profit-loss", label: "P&L", sheets: PL_SHEET, render: renderProfitLoss, bind: bindProfitLoss },
      { id: "quarterly", label: "Quarterly", sheets: "VitalTax", render: renderQuarterly },
      { id: "forecast", label: "Forecast", sheets: "Profit Forecast", render: renderForecast },
      { id: "stock", label: "Stock", sheets: STOCK_SHEET, render: renderStock, bind: bindStock },
      { id: "ledgers", label: "Ledgers", sheets: "Opening/Closing Debtors & Creditors", render: renderLedgers },
      { id: "fixed-assets", label: "Fixed assets", sheets: "Schedule, HPfinance", render: renderFixedAssets },
      {
        id: "business-details",
        label: "Book details",
        sheets: BUSINESS_DETAILS_SHEET,
        render: renderBusinessDetails,
        bind: bindBusinessDetails,
      },
      { id: "admin", label: "Admin", sheets: "Admin", render: renderAdmin },
    ],
    months: {
      journals: [
        { id: "sales", label: "Sales" },
        { id: "purchases", label: "Purchases" },
        { id: "bank", label: "Bank" },
        { id: "cash", label: "Cash" },
        { id: "payroll", label: "Payroll" },
      ],
      categories: categories,
      classify: classify,
      derive: derive,
    },
    yearTable: {
      defaultColumns: ["sales", "costOfSales", "totalExpenses", "netProfit"],
      alwaysHidden: [POSTED_TOTAL_KEY],
      composite: [],
      monthlyCell: monthlyCell,
      summary: [
        ["Sales Turnover", "sales", true],
        ["Gross Profit", "grossProfit"],
        ["Administrative Expenses", "totalExpenses"],
        ["Profit before Tax", "netProfit"],
      ],
      sticky: [
        ["Sales Turnover", "sales"],
        ["Profit before Tax", "netProfit"],
      ],
      card: {
        headline: "netProfit",
        figures: [
          ["Sales", "sales", true],
          ["Expenses", "totalExpenses"],
        ],
      },
    },
    snapshot: snapshot,
    newBook: {
      fields: [
        { id: "new-book-name", name: "businessName", label: "Business name", type: "text", required: "Enter a business name." },
        { id: "new-book-year-end", name: "yearEnd", label: "Year end (5 April)", type: "date", required: "Enter a real year-end date." },
        { id: "new-book-vat", name: "vatRegistered", label: "VAT registered", type: "checkbox" },
      ],
      build: buildNewBook,
      label: function (values) {
        return values.businessName;
      },
    },
    upload: {
      validate: function () {
        throw new Error(
          "A Self Employed package is nine workbooks. This page reads one back from a diya-gl zip or a diya-gl JSON file; reading the workbooks themselves is not on this page yet.",
        );
      },
    },
    bookFields: { documentInfo: ["periodCoveredStart", "periodCoveredEnd"] },
    drift: { units: { money: 1, rate: 1, count: 1 }, excludedSections: { "Admin (Generator Injected)": 1 } },
    save: { singleFile: false },
  };
})(typeof window !== "undefined" ? window : globalThis);
