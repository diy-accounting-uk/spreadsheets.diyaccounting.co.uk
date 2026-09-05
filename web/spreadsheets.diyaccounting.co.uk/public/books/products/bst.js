// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/products/bst.js
//
// The Basic Sole Trader view manifest: what the shared shell (shell.js) mounts
// for a BST book. Plain data plus functions, loaded as a classic script before
// the engine, so every function that needs the engine or the product module
// receives it in its ctx argument. Every sheet cell it names comes from the
// product module's own CELL_MAP (app/products/bst.js) through
// engine.productModule("bst"); the tables kept here name snapshot keys, form
// wording and box numbers, which no sheet carries.

(function (global) {
  "use strict";
  global.DiyaGlProducts = global.DiyaGlProducts || {};

  var SCHEMA_NAME = "BasicSoleTrader";

  // Snapshot key per annual P&L cell. Labels, sections and units come from
  // CELL_MAP; this table names the key a month row and the annual row carry,
  // the one display label the sheet's own is too long for, and which rows
  // the P&L view rules off as totals.
  var PL_KEYS = {
    C4: { key: "sales" },
    C6: { key: "costOfSales", label: "Cost of Sales" },
    C7: { key: "directCosts" },
    C9: { key: "grossProfit", total: true },
    C11: { key: "employeeCosts" },
    C12: { key: "premisesCosts" },
    C13: { key: "repairs" },
    C14: { key: "generalAdmin" },
    C15: { key: "motorExpenses" },
    C16: { key: "travel" },
    C17: { key: "advertising" },
    C18: { key: "legalProfessional" },
    C19: { key: "badDebts" },
    C20: { key: "interestFinance" },
    C21: { key: "otherExpenses" },
    C22: { key: "totalExpenses", total: true },
    C24: { key: "netProfit", total: true },
    C30: { key: "otherIncome" },
    C32: { key: "incomeTaxLessCis" },
    C33: { key: "niClass4" },
    C35: { key: "netIncomeAfterTax", total: true },
  };
  // The year table's columns stop here; C30 to C35 print below the line.
  var LAST_CATEGORY_CELL = "C24";
  var DERIVED = { grossProfit: 1, totalExpenses: 1, netProfit: 1 };
  var EXPENSE_KEYS = [
    "employeeCosts",
    "premisesCosts",
    "repairs",
    "generalAdmin",
    "motorExpenses",
    "travel",
    "advertising",
    "legalProfessional",
    "badDebts",
    "interestFinance",
    "otherExpenses",
  ];
  // BST code letter (the value resolveBstPurchaseCodeMap gives a code) to
  // snapshot key.
  var LETTER_KEYS = {
    s: "costOfSales",
    d: "directCosts",
    e: "employeeCosts",
    p: "premisesCosts",
    r: "repairs",
    g: "generalAdmin",
    m: "motorExpenses",
    t: "travel",
    a: "advertising",
    l: "legalProfessional",
    i: "interestFinance",
    b: "badDebts",
    o: "otherExpenses",
    f: "capex",
  };

  // The P&L view swaps two of the sheet's own rows for the figures the
  // other views print: the schedule's AIA total and the tax sheet's profit
  // line. render-unrepresentable/bst.json says why.
  var CAPITAL_ALLOWANCES_CELL = "C26";
  var TAXABLE_PROFIT_CELL = "C28";

  var FIXED_ASSETS_SHEET = "Fixed Assets";
  var FIXED_ASSET_CELLS = { totalCost: "E1", aia: "K1", wda: "L1", writtenDownValue: "M1", disposals: "Q1", balancingCharge: "R1" };

  var STOCK_SECTION = "Stock";
  var STOCK_CARRIED_CELL = "D7";

  var LEDGER_SECTION = "Debtors & Creditors";
  var DEBTORS_OPENING_PATH = "openingBalances.tradeDebtors";

  var BUSINESS_DETAILS_SECTION = "Business Details";
  var ENTITY_PATH_PREFIX = "entityInformation.";
  var OPENING_BALANCES_PATH_PREFIX = "openingBalances.";

  var ADMIN_SECTION = "Admin (Generator Injected)";
  // The Admin cells echo whichever app/data/<year>.toml the page fetched, not
  // a figure derived from the book's lines, so they never read as drift.
  var DRIFT_EXCLUDED_SECTIONS = {};
  DRIFT_EXCLUDED_SECTIONS[ADMIN_SECTION] = 1;
  // The four Admin cells whose CELL_MAP unit misdescribes how they print:
  // the mileage limits are miles, the mileage rates are pence.
  var ADMIN_FORMATS = { F21: "number", F22: "number", G21: "pence", G22: "pence" };
  var UNIT_FORMATS = { money: "currency", rate: "rate", count: "number" };

  // The Income Tax sheet's cells, named once so the snapshot and the form
  // read the same ones. The Additional band carries no ceiling of its own.
  var INCOME_TAX_CELLS = {
    profitFromSelfEmployment: "E5",
    personalAllowance: "E6",
    taxableIncome: "E7",
    bands: [
      { label: "Basic rate", rate: "D8", ceiling: "C9", tax: "E8" },
      { label: "Higher rate", rate: "D9", ceiling: "C10", tax: "E9" },
      { label: "Additional rate", rate: "D10", ceiling: null, tax: "E10" },
    ],
    totalIncomeTax: "E11",
    cisDeducted: "E12",
    niClass4Lower: "E15",
    niClass4Upper: "E16",
    totalTaxAndNi: "E18",
  };

  // The standard BST chart of accounts a new book starts from: one sales
  // account (a blank business has no income streams yet to distinguish) and
  // one purchase account per expense category the year table's own columns
  // carry, so a brand-new book already has somewhere for every category of
  // entry to post to. Codes and columns follow the same chart the
  // reconciliation fixtures use (examples/precision-code-ltd and
  // examples/sp-sixty-driving book.toml).
  var STANDARD_NEW_BOOK_CHART = {
    sales: {
      4000: { accountMainDescription: "Sales" },
    },
    purchases: {
      5000: { accountMainDescription: "Cost of sales" },
      5001: { accountMainDescription: "Direct costs" },
      5101: { accountMainDescription: "Employee costs" },
      5200: { accountMainDescription: "Premises costs" },
      5400: { accountMainDescription: "Repairs and maintenance" },
      5501: { accountMainDescription: "General admin" },
      5601: { accountMainDescription: "Motor expenses" },
      5600: { accountMainDescription: "Travel and subsistence" },
      5500: { accountMainDescription: "Advertising" },
      5800: { accountMainDescription: "Legal and professional fees" },
      5803: { accountMainDescription: "Interest and finance charges" },
      5801: { accountMainDescription: "Bad debts written off" },
      5002: { accountMainDescription: "Other expenses" },
      5900: { accountMainDescription: "Fixed asset purchases" },
    },
  };

  // ============================== CELL_MAP readers ==============================

  function plainLabel(label) {
    return String(label).replace(/\*\*/g, "");
  }

  function columnOf(cell) {
    return cell.replace(/[0-9]+/g, "");
  }

  // "cell/<sheet>!<cell>" -> [sheet, cell]
  function sheetAndCellOfKey(key) {
    var reference = key.slice("cell/".length);
    var split = reference.lastIndexOf("!");
    return [reference.slice(0, split), reference.slice(split + 1)];
  }

  function cellMapRow(productMod, sheet, cell) {
    var rows = productMod.CELL_MAP;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === sheet && rows[i][1] === cell) return rows[i];
    }
    return null;
  }

  function sectionRows(productMod, section) {
    return productMod.CELL_MAP.filter(function (row) {
      return row[4] === section;
    });
  }

  // The P&L sheet is the one the turnover headline reads; its annual
  // section is the one that row sits in.
  function plSheetOf(productMod) {
    return sheetAndCellOfKey(productMod.HEADLINES.turnover.key)[0];
  }

  function plSectionOf(productMod) {
    var turnover = sheetAndCellOfKey(productMod.HEADLINES.turnover.key);
    return cellMapRow(productMod, turnover[0], turnover[1])[4];
  }

  function plRows(productMod) {
    var sheet = plSheetOf(productMod);
    return sectionRows(productMod, plSectionOf(productMod)).filter(function (row) {
      return row[0] === sheet;
    });
  }

  function categories(productMod) {
    var rows = plRows(productMod);
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var cell = rows[i][1];
      var meta = PL_KEYS[cell];
      out.push({
        key: meta.key,
        label: meta.label || plainLabel(rows[i][2]),
        sheet: rows[i][0],
        cell: cell,
        computed: !!DERIVED[meta.key],
      });
      if (cell === LAST_CATEGORY_CELL) break;
    }
    return out;
  }

  function classify(line, book, ctx) {
    var code = String(line.accountMainID);
    if (line.sourceJournalID === "sales") {
      return { journal: "sales", key: ctx.engine.BST_SALES_ACCOUNTS.has(code) ? "sales" : null };
    }
    if (line.sourceJournalID === "purchases") {
      var letter = ctx.engine.resolveBstPurchaseCodeMap(book)[code];
      return { journal: "purchases", key: letter ? LETTER_KEYS[letter] || null : null };
    }
    return { journal: null, key: null };
  }

  function derive(row) {
    row.grossProfit = row.sales - row.costOfSales - row.directCosts;
    row.totalExpenses = 0;
    for (var i = 0; i < EXPENSE_KEYS.length; i++) row.totalExpenses += row[EXPENSE_KEYS[i]];
    row.netProfit = row.grossProfit - row.totalExpenses;
    return row;
  }

  // The year-end stock movement is recognised in the period's last month,
  // exactly as the Stock sheet's own opening-minus-closing chain carries it.
  function closeYear(lastRow, book) {
    if (!book.stock) return;
    lastRow.costOfSales += (book.stock.openingValue || 0) - (book.stock.closingValue || 0);
  }

  // Of the categories, only Sales has a per-month cell CELL_MAP names: the
  // row on the P&L sheet, outside the annual section, labelled with the
  // month's short name.
  function monthlyCell(monthLabel, productMod, categoryKey) {
    if (categoryKey !== "sales") return null;
    var sheet = plSheetOf(productMod);
    var section = plSectionOf(productMod);
    var rows = productMod.CELL_MAP;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === sheet && rows[i][4] !== section && rows[i][2] === monthLabel) return [sheet, rows[i][1]];
    }
    return null;
  }

  // ============================== the snapshot's product half ==============================

  function cellValue(results, sheet, cell) {
    return (results[sheet] && results[sheet][cell]) || 0;
  }

  function buildAnnual(ctx) {
    var sheet = plSheetOf(ctx.productMod);
    var annual = {};
    Object.keys(PL_KEYS).forEach(function (cell) {
      annual[PL_KEYS[cell].key] = cellValue(ctx.results, sheet, cell);
    });
    annual.capex = cellValue(ctx.results, FIXED_ASSETS_SHEET, FIXED_ASSET_CELLS.totalCost);
    return annual;
  }

  function buildStock(book) {
    if (!book.stock) return { opening: 0, closing: 0, atCost: 0 };
    return { opening: book.stock.openingValue || 0, closing: book.stock.closingValue || 0, atCost: book.stock.openingValue || 0 };
  }

  // One side of the Debtors & Creditors sheet: the section's rows in one
  // column, the first the opening figure, the last the total, the twelve
  // between them the months. The debtors side is the one whose opening
  // figure is the book's trade debtors.
  function ledgerSides(ctx) {
    var rows = sectionRows(ctx.productMod, LEDGER_SECTION);
    var byColumn = {};
    rows.forEach(function (row) {
      var column = columnOf(row[1]);
      if (!byColumn[column]) byColumn[column] = [];
      byColumn[column].push(row);
    });
    var sides = {};
    Object.keys(byColumn).forEach(function (column) {
      var side = byColumn[column];
      var opening = side[0];
      var total = side[side.length - 1];
      var monthly = side.slice(1, -1);
      var built = {
        sheet: opening[0],
        openingLabel: plainLabel(opening[2]),
        openingCell: opening[1],
        opening: cellValue(ctx.results, opening[0], opening[1]),
        monthlyCells: monthly.map(function (row) {
          return row[1];
        }),
        monthly: monthly.map(function (row) {
          return cellValue(ctx.results, row[0], row[1]);
        }),
        monthlyLabel: monthlyCaption(monthly[0][2]),
        totalLabel: plainLabel(total[2]),
        totalCell: total[1],
      };
      sides[opening[3] === DEBTORS_OPENING_PATH ? "debtors" : "creditors"] = built;
    });
    return sides;
  }

  // "Apr sales not yet received" -> "Sales not yet received"
  function monthlyCaption(label) {
    var rest = plainLabel(label).replace(/^\S+\s+/, "");
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  }

  // The fixed-asset additions list. Examples carry the full register on
  // book.fixedAssets; an upload has no such register reconstructed (the
  // calculator itself never reads it, deriving additions straight from the
  // fixed-asset-coded lines), so the same lines feed the additions list.
  function buildFixedAssets(ctx) {
    var additions = ctx.book.fixedAssets
      ? ctx.book.fixedAssets.map(function (a) {
          return { description: a.description || "Fixed asset", cost: a.cost || 0 };
        })
      : ctx.lines
          .filter(function (line) {
            return classify(line, ctx.book, ctx).key === "capex";
          })
          .map(function (line) {
            return { description: line.detailComment || "Fixed asset", cost: line.amount };
          });
    var summary = { additions: additions, register: assetRegister(additions, ctx.taxData) };
    Object.keys(FIXED_ASSET_CELLS).forEach(function (field) {
      summary[field] = cellValue(ctx.results, FIXED_ASSETS_SHEET, FIXED_ASSET_CELLS[field]);
    });
    return summary;
  }

  // The register a row at a time, the way the schedule's own new-assets
  // block computes it: Annual Investment Allowance at the year's rate on
  // every asset, no Writing Down Allowance on this block at all (the
  // template carries no WDA formula here), and whatever the allowance does
  // not cover left as that asset's written-down value.
  function assetRegister(additions, taxData) {
    var aiaRate = (taxData && taxData.capital_allowances && taxData.capital_allowances.annual_investment_allowance) || 0;
    return additions.map(function (asset) {
      var aia = asset.cost * aiaRate;
      return { description: asset.description, cost: asset.cost, aia: aia, wda: 0, writtenDownValue: asset.cost - aia };
    });
  }

  function buildIncomeTax(ctx) {
    var sheet = ctx.productMod.TAX_SHEET;
    function read(cell) {
      return cellValue(ctx.results, sheet, cell);
    }
    return {
      cells: INCOME_TAX_CELLS,
      profitFromSelfEmployment: read(INCOME_TAX_CELLS.profitFromSelfEmployment),
      personalAllowance: read(INCOME_TAX_CELLS.personalAllowance),
      taxableIncome: read(INCOME_TAX_CELLS.taxableIncome),
      bands: INCOME_TAX_CELLS.bands.map(function (band) {
        return {
          label: band.label,
          rate: read(band.rate),
          ceiling: band.ceiling ? read(band.ceiling) || null : null,
          tax: read(band.tax),
          cells: band,
        };
      }),
      totalIncomeTax: read(INCOME_TAX_CELLS.totalIncomeTax),
      cisDeducted: -read(INCOME_TAX_CELLS.cisDeducted),
      niClass4Lower: read(INCOME_TAX_CELLS.niClass4Lower),
      niClass4Upper: read(INCOME_TAX_CELLS.niClass4Upper),
      totalTaxAndNi: read(INCOME_TAX_CELLS.totalTaxAndNi),
    };
  }

  function buildAdmin(ctx) {
    var rows = sectionRows(ctx.productMod, ADMIN_SECTION);
    return {
      year: (ctx.taxData.tax_year && ctx.taxData.tax_year.label) || ctx.taxYearName,
      rates: rows.map(function (row) {
        return {
          sheet: row[0],
          cell: row[1],
          label: plainLabel(row[2]),
          value: cellValue(ctx.results, row[0], row[1]),
          format: ADMIN_FORMATS[row[1]] || UNIT_FORMATS[row[6]] || "currency",
        };
      }),
    };
  }

  function snapshot(ctx) {
    var sides = ledgerSides(ctx);
    return {
      annual: buildAnnual(ctx),
      stock: buildStock(ctx.book),
      debtors: sides.debtors,
      creditors: sides.creditors,
      fixedAssets: buildFixedAssets(ctx),
      incomeTax: buildIncomeTax(ctx),
      admin: buildAdmin(ctx),
    };
  }

  // ============================== the views ==============================

  function renderProfitLoss(snap, state, helpers) {
    var productMod = snap.context.productMod;
    var rows = helpers.sectionRows(plSectionOf(productMod)).map(function (row) {
      var meta = PL_KEYS[row.cell] || {};
      var label = meta.label || row.label;
      if (row.cell === CAPITAL_ALLOWANCES_CELL) {
        return { label: label, value: snap.fixedAssets.aia, rKeyAttr: helpers.rkFor(FIXED_ASSETS_SHEET, FIXED_ASSET_CELLS.aia) };
      }
      if (row.cell === TAXABLE_PROFIT_CELL) {
        return {
          label: label,
          value: snap.incomeTax.profitFromSelfEmployment,
          rKeyAttr: helpers.rkFor(productMod.TAX_SHEET, INCOME_TAX_CELLS.profitFromSelfEmployment),
          total: true,
        };
      }
      return { label: label, value: row.value || 0, rKeyAttr: helpers.rkFor(row.sheet, row.cell), total: !!meta.total };
    });
    return "<h2>Profit &amp; Loss Account</h2>" + '<div class="panel-card panel-form-width">' + helpers.kvRows(rows) + "</div>";
  }

  function renderStock(snap, state, helpers) {
    var s = snap.stock;
    var rows = helpers
      .sectionRows(STOCK_SECTION)
      .filter(function (row) {
        return row.cell !== STOCK_CARRIED_CELL;
      })
      .map(function (row, index) {
        return { label: row.label, value: index === 0 ? s.opening : s.closing, rKeyAttr: helpers.rkFor(row.sheet, row.cell) };
      });
    rows.push({ label: "Stock movement (cost of sales adjustment)", value: s.opening - s.closing, total: true });
    return "<h2>Stock</h2>" + '<div class="panel-card">' + helpers.kvRows(rows) + "</div>";
  }

  function renderDebtorsCreditors(snap, state, helpers) {
    function ledger(title, side) {
      var total = side.monthly.reduce(function (sum, amount) {
        return sum + amount;
      }, side.opening);
      var rows = [{ label: side.openingLabel, value: side.opening, rKeyAttr: helpers.rkFor(side.sheet, side.openingCell) }];
      side.monthly.forEach(function (amount, index) {
        rows.push({ label: snap.months[index].label, value: amount, rKeyAttr: helpers.rkFor(side.sheet, side.monthlyCells[index]) });
      });
      rows.push({ label: side.totalLabel, value: total, rKeyAttr: helpers.rkFor(side.sheet, side.totalCell), total: true });
      return (
        '<div class="panel-card"><h3>' +
        title +
        "</h3>" +
        helpers.kvRows(rows) +
        '<p class="caps-label">' +
        helpers.esc(side.monthlyLabel) +
        ", month by month</p></div>"
      );
    }
    return (
      "<h2>Debtors &amp; Creditors</h2>" +
      '<div class="panel-grid">' +
      ledger("Debtors", snap.debtors) +
      ledger("Creditors", snap.creditors) +
      "</div>"
    );
  }

  // One row an asset: what it cost, what the allowances take off it, and
  // what is left to carry forward.
  function renderAssetRegister(register, totalCost, helpers) {
    if (!register.length) {
      return '<p class="entries-note">This book records no fixed assets.</p>';
    }
    return (
      '<table class="register-table"><thead><tr><th>Asset</th><th>Cost</th><th>AIA</th><th>WDA</th><th>Written down</th></tr></thead><tbody>' +
      register
        .map(function (asset) {
          return (
            "<tr><td>" +
            helpers.esc(asset.description) +
            '</td><td class="num">' +
            helpers.fmtMoney(asset.cost) +
            '</td><td class="num">' +
            helpers.fmtMoney(asset.aia) +
            '</td><td class="num">' +
            helpers.fmtMoney(asset.wda) +
            '</td><td class="num">' +
            helpers.fmtMoney(asset.writtenDownValue) +
            "</td></tr>"
          );
        })
        .join("") +
      '</tbody><tfoot><tr class="total"><th>Total</th><td class="num"' +
      helpers.rkFor(FIXED_ASSETS_SHEET, FIXED_ASSET_CELLS.totalCost) +
      ">" +
      helpers.fmtMoney(totalCost) +
      '</td><td colspan="3"></td></tr></tfoot></table>'
    );
  }

  function renderFixedAssets(snap, state, helpers) {
    var f = snap.fixedAssets;
    function allowance(label, field) {
      return { label: label, value: f[field], rKeyAttr: helpers.rkFor(FIXED_ASSETS_SHEET, FIXED_ASSET_CELLS[field]) };
    }
    return (
      "<h2>Fixed Assets</h2>" +
      '<div class="panel-card"><h3>The register</h3>' +
      renderAssetRegister(f.register, f.totalCost, helpers) +
      "</div>" +
      '<div class="panel-card"><h3>Capital allowances</h3>' +
      helpers.kvRows([
        allowance("Annual Investment Allowance", "aia"),
        allowance("Writing Down Allowance", "wda"),
        allowance("Written Down Tax Value", "writtenDownValue"),
        allowance("Disposals", "disposals"),
        allowance("Balancing Charge", "balancingCharge"),
      ]) +
      "</div>"
    );
  }

  function renderIncomeTaxForm(snap, state, helpers) {
    var t = snap.incomeTax;
    var sheet = snap.context.productMod.TAX_SHEET;
    var form = helpers.form;
    function key(cell) {
      return helpers.rkFor(sheet, cell);
    }
    return form.render(
      "Income Tax computation",
      "Check these against your return.",
      form.section(
        "Profit",
        form.row({
          label: "Profit from self employment",
          amount: helpers.fmtBoxWhole(t.profitFromSelfEmployment),
          rKeyAttr: key(INCOME_TAX_CELLS.profitFromSelfEmployment),
        }) +
          form.row({
            label: "Less: Personal Allowance",
            amount: helpers.fmtBoxWhole(t.personalAllowance),
            rKeyAttr: key(INCOME_TAX_CELLS.personalAllowance),
          }) +
          form.row({
            label: "Taxable income",
            amount: helpers.fmtBoxWhole(t.taxableIncome),
            rKeyAttr: key(INCOME_TAX_CELLS.taxableIncome),
          }),
      ) +
        form.section(
          "Tax bands",
          t.bands
            .map(function (b) {
              return form.rateRow({
                label: b.label,
                ceiling: b.ceiling ? helpers.fmtWhole(b.ceiling) : null,
                ceilingRKeyAttr: b.cells.ceiling ? key(b.cells.ceiling) : "",
                rate: helpers.fmtRate(b.rate),
                rateRKeyAttr: key(b.cells.rate),
                amount: helpers.fmtBoxMoney(b.tax),
                rKeyAttr: key(b.cells.tax),
              });
            })
            .join("") +
            form.row({
              label: "Total Income Tax",
              amount: helpers.fmtBoxMoney(t.totalIncomeTax),
              rKeyAttr: key(INCOME_TAX_CELLS.totalIncomeTax),
              total: true,
            }) +
            // CIS is tax already paid on the reader's behalf, so it belongs with
            // the tax it comes off, not among the National Insurance lines.
            form.row({
              label: "Less: CIS deducted",
              amount: helpers.fmtBoxMoney(-t.cisDeducted),
              rKeyAttr: key(INCOME_TAX_CELLS.cisDeducted),
            }),
        ) +
        form.section(
          "National Insurance",
          form.row({
            label: "NI Class 4 (lower band)",
            amount: helpers.fmtBoxMoney(t.niClass4Lower),
            rKeyAttr: key(INCOME_TAX_CELLS.niClass4Lower),
          }) +
            form.row({
              label: "NI Class 4 (upper band)",
              amount: helpers.fmtBoxMoney(t.niClass4Upper),
              rKeyAttr: key(INCOME_TAX_CELLS.niClass4Upper),
            }),
        ) +
        form.row({
          label: "Total Tax + NI",
          amount: helpers.fmtBoxMoney(t.totalTaxAndNi),
          rKeyAttr: key(INCOME_TAX_CELLS.totalTaxAndNi),
          total: true,
        }),
    );
  }

  // The book's own details, editable in place. Every change goes through
  // the same route an entry edit takes: one undo step, the whole book
  // recomputed, every check run again. Changing the year end resolves the
  // tax year afresh, so the rates the checks use follow the book.
  function renderBusinessDetails(snap, state, helpers) {
    var bd = snap.businessDetails;
    var entityFields = helpers
      .sectionRows(BUSINESS_DETAILS_SECTION)
      .filter(function (row) {
        return row.path.indexOf(ENTITY_PATH_PREFIX) === 0;
      })
      .map(function (row) {
        var bookField = row.path.slice(ENTITY_PATH_PREFIX.length);
        return helpers.field(row.label, bookField, bd[bookField], { rKeyAttr: helpers.rkFor(row.sheet, row.cell) });
      })
      .join("");
    return (
      "<h2>Business Details</h2>" +
      '<div class="panel-card panel-form-width">' +
      entityFields +
      helpers.field("Period start", "periodCoveredStart", bd.periodCoveredStart, { type: "date" }) +
      helpers.field("Year end", "periodCoveredEnd", bd.periodCoveredEnd, {
        type: "date",
        hint: "Changing this loads that year's tax rates and runs every check again.",
      }) +
      helpers.readOnlyField("Basis of accounting", bd.basisOfAccounting) +
      helpers.readOnlyField("VAT registered", bd.vatRegistered ? "Yes" : "No") +
      "</div>"
    );
  }

  function bindBusinessDetails(root, state, helpers) {
    helpers.bindBookFields(root);
  }

  function renderAdmin(snap, state, helpers) {
    var a = snap.admin;
    var rows = a.rates.map(function (r) {
      var text =
        r.format === "rate"
          ? helpers.fmtRate(r.value)
          : r.format === "pence"
            ? helpers.fmtPence(r.value)
            : r.format === "number"
              ? r.value.toLocaleString("en-GB")
              : helpers.fmtMoney(r.value);
      return { label: r.label, text: text, rKeyAttr: helpers.rkFor(r.sheet, r.cell) };
    });
    return (
      "<h2>Admin</h2>" +
      '<p class="view-lede rate-provenance">Rates for the ' +
      helpers.esc(a.year) +
      " tax year, read-only.</p>" +
      '<div class="panel-card">' +
      helpers.kvRows(rows) +
      "</div>"
    );
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
        "diya-gl:vatRegistered": false,
        "diya-gl:basisOfAccounting": "cash",
      },
      accounts: JSON.parse(JSON.stringify(STANDARD_NEW_BOOK_CHART)),
    };
  }

  // A book built from the same cells CELL_MAP names: the entity fields, the
  // two entered ledger cells (everything else on that sheet is the
  // template's own formula) and the stock figures the exporter reads.
  async function bookFromWorkbook(cells, lines, ctx) {
    var entity = { "diya-gl:product": SCHEMA_NAME, "diya-gl:vatRegistered": false };
    var openingBalances = {};
    var rows = ctx.productMod.CELL_MAP;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var path = row[3];
      if (row[4] === BUSINESS_DETAILS_SECTION && path.indexOf(ENTITY_PATH_PREFIX) === 0) {
        var text = await cells.readCell(row[0], row[1]);
        if (text !== undefined && text !== "") entity[path.slice(ENTITY_PATH_PREFIX.length)] = String(text);
      } else if (path.indexOf(OPENING_BALANCES_PATH_PREFIX) === 0) {
        var balance = await cells.readCell(row[0], row[1]);
        if (typeof balance === "number") openingBalances[path.slice(OPENING_BALANCES_PATH_PREFIX.length)] = balance;
      }
    }
    var stockCells = ctx.engine.STOCK_CELLS.bst;
    var openingStock = await cells.readCell(stockCells.sheet, stockCells.openingValue);
    var closingStock = await cells.readCell(stockCells.sheet, stockCells.closingValue);

    var book = {
      documentInfo: {
        entriesType: "journal",
        language: "en",
        periodCoveredStart: ctx.period.start,
        periodCoveredEnd: ctx.period.end,
        defaultCurrency: "GBP",
        entriesComment: "Uploaded from " + ctx.fileName,
      },
      entityInformation: entity,
      accounts: ctx.accounts,
    };
    if (typeof openingStock === "number" || typeof closingStock === "number") {
      book.stock = { openingValue: openingStock || 0, closingValue: closingStock || 0 };
    }
    if (Object.keys(openingBalances).length > 0) book.openingBalances = openingBalances;
    return book;
  }

  global.DiyaGlProducts.bst = {
    id: "bst",
    schemaName: SCHEMA_NAME,
    title: "Basic Sole Trader",
    page: "bst.html",
    stylesheet: "bst.css",
    multiFile: false,
    emptyState: {
      intro:
        "Open a Basic Sole Trader workbook as editable books in your browser. Nothing is uploaded; the file never leaves your machine.",
    },
    views: [
      { id: "home", label: "Home", sheets: "Home", shared: "home" },
      { id: "year", label: "Year", sheets: "SalesApr–Mar, PurchasesApr–Mar", shared: "year" },
      { id: "profit-loss", label: "P&L", sheets: plSheetOf, render: renderProfitLoss },
      { id: "stock", label: "Stock", sheets: "PurchasesStock", render: renderStock },
      { id: "debtors-creditors", label: "Debtors/Creditors", sheets: "Debtors & Creditors", render: renderDebtorsCreditors },
      { id: "fixed-assets", label: "Fixed Assets", sheets: "Fixed Assets", render: renderFixedAssets },
      { id: "income-tax", label: "Income Tax", sheets: "Income Tax", render: renderIncomeTaxForm },
      {
        id: "sa103s",
        label: "SA103S",
        sheets: "SE Short",
        render: function (snap, state, helpers) {
          return global.DiyaGlBstForms.renderSa103s(snap, state, helpers);
        },
      },
      {
        id: "business-details",
        label: "Business Details",
        sheets: "Business Details",
        render: renderBusinessDetails,
        bind: bindBusinessDetails,
      },
      { id: "admin", label: "Admin", sheets: "Admin", render: renderAdmin },
    ],
    months: {
      journals: [
        { id: "sales", label: "Sales" },
        { id: "purchases", label: "Purchases" },
      ],
      categories: categories,
      classify: classify,
      derive: derive,
      closeYear: closeYear,
    },
    yearTable: {
      defaultColumns: ["sales", "totalExpenses", "netProfit"],
      alwaysHidden: ["costOfSales", "directCosts", "grossProfit"],
      composite: [{ key: "costOfSalesComposite", label: "Cost of Sales", from: ["costOfSales", "directCosts"] }],
      monthlyCell: monthlyCell,
      summary: [
        ["Sales Turnover", "sales", true],
        ["Gross Profit", "grossProfit"],
        ["Total Expenses", "totalExpenses"],
        ["Net Profit", "netProfit"],
      ],
      sticky: [
        ["Sales Turnover", "sales"],
        ["Net Profit", "netProfit"],
      ],
      card: {
        headline: "netProfit",
        figures: [
          ["Sales", "sales", true],
          ["Total expenses", "totalExpenses"],
        ],
      },
    },
    snapshot: snapshot,
    newBook: {
      fields: [
        { id: "new-book-name", name: "businessName", label: "Business name", type: "text", required: "Enter a business name." },
        { id: "new-book-year-end", name: "yearEnd", label: "Year end", type: "date", required: "Enter a real year-end date." },
      ],
      build: buildNewBook,
      label: function (values) {
        return values.businessName;
      },
    },
    upload: {
      validate: function (engine, xlsxBytes) {
        return engine.validateBstAnchors(xlsxBytes);
      },
      extract: function (engine, xlsxBytes) {
        return engine.extractBstTransactions(xlsxBytes, engine.bstExtractionMap());
      },
      bookFromWorkbook: bookFromWorkbook,
    },
    bookFields: { documentInfo: ["periodCoveredStart", "periodCoveredEnd"] },
    drift: { units: { money: 1, rate: 1, count: 1 }, excludedSections: DRIFT_EXCLUDED_SECTIONS },
    save: { singleFile: true, workbookName: "bst-excel.xlsx" },
  };
})(typeof window !== "undefined" ? window : globalThis);
