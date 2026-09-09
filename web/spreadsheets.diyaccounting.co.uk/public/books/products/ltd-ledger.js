// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// books/products/ltd-ledger.js
//
// The Limited Company view renderers: Bank, Ledgers, P&L, Stock, Fixed
// assets, Business details and Admin. Loaded after products/ltd.js, which
// carries the constants and snapshot builders these functions read off
// global.DiyaGlLtdShared -- the manifest wires each render/bind pair into
// VIEWS itself. The Year and Home views are the shell's own shared
// renderers (see ltd.js's yearTable and months declarations); nothing here
// duplicates them.

(function (global) {
  "use strict";

  var S = global.DiyaGlLtdShared;

  function num(value) {
    return S.num(value);
  }

  function cellValue(results, sheet, cell) {
    return S.cellValue(results, sheet, cell);
  }

  function cellRk(snap, helpers, sheet, cell) {
    return S.cellRk(snap, helpers, sheet, cell);
  }

  function unitOf(productMod, sheet, cell) {
    return S.unitOf(productMod, sheet, cell);
  }

  function labelFor(productMod, sheet, cell, fallback) {
    return S.labelFor(productMod, sheet, cell, fallback);
  }

  function formatByUnit(value, unit, helpers) {
    return S.formatByUnit(value, unit, helpers);
  }

  // shell.js's readOnlyField carries no r-key attribute, so a read-only
  // figure that must still carry one (every calculated cell the plan names)
  // builds its own input markup instead.
  function readOnlyFieldWithKey(helpers, label, text, rKeyAttr) {
    return (
      '<div class="editable-field"><label>' + helpers.esc(label) + '</label><input value="' + text + '" readonly' + rKeyAttr + " /></div>"
    );
  }

  // A fixed asset's own class enum, translated to the Schedule block's label
  // through S.SCHEDULE_ASSET_CLASSES -- the same key
  // diya-gl-loader.js's ASSET_CLASS_TO_CATEGORY maps a class onto for the
  // calculator, kept here rather than reached for across the bundle
  // boundary.
  var ASSET_CLASS_KEY_BY_ENUM = {
    landBuildings: "land",
    plantMachinery: "plant",
    fixturesFittings: "fixtures",
    computerTechnology: "computer",
    motorVehicles: "motor",
  };

  function assetClassLabel(rawClass) {
    var key = ASSET_CLASS_KEY_BY_ENUM[rawClass];
    var found = null;
    S.SCHEDULE_ASSET_CLASSES.forEach(function (klass) {
      if (klass.key === key) found = klass;
    });
    return (found && found.label) || rawClass || "";
  }

  // ============================== the bank book ==============================

  function bankViewState(helpers) {
    return helpers.viewState("bank", { account: S.BANK_ACCOUNTS[0].id, settlement: null });
  }

  function accountById(snap, id) {
    return snap.bank.accounts.filter(function (account) {
      return account.id === id;
    })[0];
  }

  function monthLabelOf(snap, monthKey) {
    for (var i = 0; i < snap.months.length; i++) {
      if (snap.months[i].key === monthKey) return snap.months[i].label;
    }
    return monthKey;
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
    return "<h2>Bank</h2>" + switchHtml + renderBalances(snap, helpers, account) + renderSettlements(snap, helpers, view);
  }

  // The month tabs' own opening and closing balances. Only the last month's
  // closing carries two extra keys: the Trial Balance's own echo of that
  // account and the workbook's own last-tab A2, both of which the plan
  // asks to be verified against each other.
  function renderBalances(snap, helpers, account) {
    var months = account.months;
    var rows = months
      .map(function (month, index) {
        var closingRk = "";
        if (index === months.length - 1) {
          var trialBalanceCell = S.TRIAL_BALANCE_BANK_ECHO_CELLS[account.file];
          var echoRk = trialBalanceCell ? cellRk(snap, helpers, S.TRIAL_BALANCE_SHEET, trialBalanceCell) : "";
          var tabRk = cellRk(snap, helpers, account.file + "!" + monthLabelOf(snap, month.month), "A2");
          closingRk = echoRk || tabRk;
        }
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

  var SETTLEMENTS_SHOWN = 8;

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
        var snap = S.liveSnapshot();
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

  // ============================== ledgers ==============================

  // Every CELL_MAP row of one report section, as a label/value/key panel --
  // the Ledgers view's own copy of the same small builder ltd-forms.js uses
  // for Directors' Report and Fixed Asset Note. The Trial Balance carries
  // several opening and closing balances (bank, creditors, share capital,
  // stock, HMRC) that the debtors/creditors panels below do not name; this
  // is where the rest of them render, both directions covered at once.
  function sectionCardFromCellMap(snap, helpers, sectionName, title) {
    var productMod = snap.context.productMod;
    var rows = productMod.CELL_MAP.filter(function (entry) {
      return entry[4] === sectionName;
    }).map(function (entry) {
      return {
        label: labelFor(productMod, entry[0], entry[1], entry[0] + "!" + entry[1]),
        text: formatByUnit(cellValue(snap.results, entry[0], entry[1]), unitOf(productMod, entry[0], entry[1]), helpers),
        rKeyAttr: cellRk(snap, helpers, entry[0], entry[1]),
      };
    });
    return '<div class="panel-card"><h3>' + helpers.esc(title) + "</h3>" + helpers.kvRows(rows) + "</div>";
  }

  function renderLedgers(snap, state, helpers) {
    function total(rows) {
      return rows.reduce(function (sum, entry) {
        return sum + num(entry.amount);
      }, 0);
    }
    // The listing's own total and the trial balance cell named for it are
    // the same figure for the debtors listings and the opening creditors
    // one -- the balance is nothing more than what was outstanding at that
    // moment. The closing creditors listing is not: the trial balance nets
    // a year of invoices, payments, CIS withholding and the hire purchase
    // agreements moved off the row, none of which the listing carries, so
    // it lands on a different figure from EJ28's signed balance. Where the
    // two agree the listing carries the key; where they do not, the listing
    // stays unkeyed (it is not EJ28's figure) and the trial balance's own
    // figure gets a row of its own, keyed to EJ28.
    function side(title, ledger, trialBalanceCell) {
      var listingTotal = total(ledger.rows);
      var trialBalanceValue = cellValue(snap.results, S.TRIAL_BALANCE_SHEET, trialBalanceCell);
      var listingIsTrialBalanceFigure = Math.round(listingTotal * 100) === Math.round(trialBalanceValue * 100);
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
      var totalRow =
        '<tr class="total"><th colspan="2">Total</th><td class="num"' +
        (listingIsTrialBalanceFigure ? cellRk(snap, helpers, S.TRIAL_BALANCE_SHEET, trialBalanceCell) : "") +
        ">" +
        helpers.fmtMoney(listingTotal) +
        "</td></tr>";
      var trialBalanceRow = listingIsTrialBalanceFigure
        ? ""
        : '<tr class="total"><th colspan="2">Per trial balance</th><td class="num"' +
          cellRk(snap, helpers, S.TRIAL_BALANCE_SHEET, trialBalanceCell) +
          ">" +
          helpers.fmtMoney(trialBalanceValue) +
          "</td></tr>";
      return (
        '<div class="panel-card"><h3>' +
        title +
        '</h3><table class="register-table"><thead><tr><th>Contact</th><th>Invoice</th><th>Amount</th></tr></thead><tbody>' +
        body +
        "</tbody><tfoot>" +
        totalRow +
        trialBalanceRow +
        "</tfoot></table></div>"
      );
    }
    var ledgers = snap.ledgers;
    var tb = S.LEDGER_TRIAL_BALANCE_CELLS;
    return (
      "<h2>Ledgers</h2>" +
      '<p class="view-lede">Who owed the business and who it owed, at the start of the year and at the end.</p>' +
      '<div class="panel-grid">' +
      side("Debtors brought forward", ledgers.debtors.opening, tb.debtors.opening) +
      side("Debtors carried forward", ledgers.debtors.closing, tb.debtors.closing) +
      side("Creditors brought forward", ledgers.creditors.opening, tb.creditors.opening) +
      side("Creditors carried forward", ledgers.creditors.closing, tb.creditors.closing) +
      "</div>" +
      sectionCardFromCellMap(snap, helpers, "Trial Balance", "Trial balance, brought and carried forward")
    );
  }

  // ============================== profit and loss ==============================

  var MONTH_COLS = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];

  function rowNumber(cell) {
    return cell.replace(/^[A-Z]+/, "");
  }

  function renderProfitLoss(snap, state, helpers) {
    var view = helpers.viewState("profit-loss", { monthsOpen: false });
    var productMod = snap.context.productMod;
    var rows = snap.categories.filter(function (row) {
      return row.cell;
    });
    var statement =
      '<div class="panel-card panel-form-width">' +
      helpers.kvRows(
        rows.map(function (row) {
          return {
            label: row.label,
            value: cellValue(snap.results, row.sheet, row.cell),
            rKeyAttr: cellRk(snap, helpers, row.sheet, row.cell),
            total: !!row.computed,
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
          .map(function (month, index) {
            var col = MONTH_COLS[index];
            var cell = col + rowNumber(row.cell);
            var value = snap.results[S.PL_SHEET] && snap.results[S.PL_SHEET][cell];
            if (value === undefined) return '<td class="num">—</td>';
            return '<td class="num"' + cellRk(snap, helpers, S.PL_SHEET, cell) + ">" + helpers.fmtMoney(value) + "</td>";
          })
          .join("");
        return "<tr><th>" + helpers.esc(row.label) + "</th>" + cells + "</tr>";
      })
      .join("");
    return (
      '<div class="ltd-months-scroll"><table class="register-table ltd-months-table"><thead>' +
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

  // ============================== stock ==============================

  function renderStock(snap, state, helpers) {
    var productMod = snap.context.productMod;
    var opening = cellValue(snap.results, S.STOCK_SHEET, S.STOCK_CELLS.opening);
    var calculated = cellValue(snap.results, S.STOCK_SHEET, S.STOCK_CELLS.calculated);
    var counted = cellValue(snap.results, S.STOCK_SHEET, S.STOCK_CELLS.counted);
    var adjustment = cellValue(snap.results, S.STOCK_SHEET, S.STOCK_CELLS.adjustment);
    var materialsPercent = snap.stock.materialsPercent;
    return (
      "<h2>Stock</h2>" +
      '<p class="view-lede">The year\'s stock movement, the calculated figure the materials percentage below drives, and the physical count against it.</p>' +
      '<div class="panel-card panel-form-width">' +
      '<div class="editable-field"><label for="ltd-materials-percent">' +
      helpers.esc(labelFor(productMod, S.STOCK_SHEET, S.STOCK_CELLS.materialsPercent, "Materials percentage")) +
      '</label><input id="ltd-materials-percent" type="text" inputmode="decimal" data-stock-field="materialsPercent" value="' +
      (materialsPercent === null ? "" : materialsPercent) +
      '"' +
      cellRk(snap, helpers, S.STOCK_SHEET, S.STOCK_CELLS.materialsPercent) +
      " /></div>" +
      readOnlyFieldWithKey(
        helpers,
        labelFor(productMod, S.STOCK_SHEET, S.STOCK_CELLS.opening, "Opening stock"),
        helpers.fmtMoney(opening),
        cellRk(snap, helpers, S.STOCK_SHEET, S.STOCK_CELLS.opening),
      ) +
      readOnlyFieldWithKey(
        helpers,
        labelFor(productMod, S.STOCK_SHEET, S.STOCK_CELLS.calculated, "Closing stock (calculated)"),
        helpers.fmtMoney(calculated),
        cellRk(snap, helpers, S.STOCK_SHEET, S.STOCK_CELLS.calculated),
      ) +
      readOnlyFieldWithKey(
        helpers,
        labelFor(productMod, S.STOCK_SHEET, S.STOCK_CELLS.counted, "Closing stock (physical count)"),
        helpers.fmtMoney(counted),
        cellRk(snap, helpers, S.STOCK_SHEET, S.STOCK_CELLS.counted),
      ) +
      readOnlyFieldWithKey(
        helpers,
        labelFor(productMod, S.STOCK_SHEET, S.STOCK_CELLS.adjustment, "Stock loss adjustment"),
        helpers.fmtMoney(adjustment),
        cellRk(snap, helpers, S.STOCK_SHEET, S.STOCK_CELLS.adjustment),
      ) +
      "</div>"
    );
  }

  function bindStock(root, state, helpers) {
    var input = root.querySelector('[data-stock-field="materialsPercent"]');
    if (!input) return;
    var committed = input.value;
    input.addEventListener("change", function () {
      var value = Number(String(input.value).replace(/[%\s]/g, ""));
      if (!isFinite(value)) {
        input.value = committed;
        helpers.showToast("That is not a number. The book is unchanged.");
        return;
      }
      var next = JSON.parse(JSON.stringify(S.liveSnapshot().book));
      if (!next.stock) next.stock = {};
      next.stock.materialsPercent = value;
      helpers.commitBook(next, "change the materials percentage", "Changed the materials percentage.");
    });
  }

  // ============================== fixed assets ==============================

  function renderFixedAssets(snap, state, helpers) {
    var productMod = snap.context.productMod;
    var assets = snap.fixedAssets;

    var broughtForward = assets.broughtForward.length
      ? assets.broughtForward
          .map(function (asset) {
            return (
              "<tr><td>" +
              helpers.esc(asset.description) +
              "</td><td>" +
              helpers.esc(assetClassLabel(asset.assetClass)) +
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
      : '<tr><td colspan="5">This book brought no assets into the year.</td></tr>';

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

    // Row 1's own grand totals beyond SCHEDULE_TOTAL_CELLS: written down
    // value carried forward on the existing-assets side (G), accumulated
    // depreciation carried forward on the current-year side (J), and the
    // disposals columns (V sale proceeds, W cost, X depreciation).
    var EXTRA_SCHEDULE_TOTAL_CELLS = ["G1", "J1", "V1", "W1", "X1"];

    var scheduleRows = S.SCHEDULE_TOTAL_CELLS.concat(EXTRA_SCHEDULE_TOTAL_CELLS).map(function (cell) {
      return {
        label: labelFor(productMod, S.SCHEDULE_SHEET, cell, S.SCHEDULE_SHEET + "!" + cell),
        value: cellValue(snap.results, S.SCHEDULE_SHEET, cell),
        rKeyAttr: cellRk(snap, helpers, S.SCHEDULE_SHEET, cell),
      };
    });

    // The depreciation rate sits on each class's own label row, a few rows
    // above its existingTotalRow; the schedule carries no row of its own
    // that names both, so the pairing is made here.
    var SCHEDULE_CLASS_RATE_ROW = { land: 7, plant: 13, fixtures: 24, computer: 32, motor: 43 };
    // Assets of the same class bought during the year total on a second
    // block further down the schedule, at these rows.
    var SCHEDULE_CLASS_NEW_TOTAL_ROW = { land: 64, plant: 75, fixtures: 83, computer: 94, motor: 108 };

    function scheduleFigureCell(cell, unit) {
      return (
        '<td class="num"' +
        cellRk(snap, helpers, S.SCHEDULE_SHEET, cell) +
        ">" +
        formatByUnit(cellValue(snap.results, S.SCHEDULE_SHEET, cell), unit || "money", helpers) +
        "</td>"
      );
    }

    var classRows = S.SCHEDULE_ASSET_CLASSES.map(function (klass) {
      var row = klass.existingTotalRow;
      return (
        "<tr><th>" +
        helpers.esc(klass.label) +
        "</th>" +
        scheduleFigureCell("E" + row) +
        scheduleFigureCell("F" + row) +
        scheduleFigureCell("H" + SCHEDULE_CLASS_RATE_ROW[klass.key], "rate") +
        scheduleFigureCell("I" + row) +
        scheduleFigureCell("W" + row) +
        scheduleFigureCell("X" + row) +
        "</tr>"
      );
    }).join("");

    var newClassRows = S.SCHEDULE_ASSET_CLASSES.map(function (klass) {
      var row = SCHEDULE_CLASS_NEW_TOTAL_ROW[klass.key];
      return (
        "<tr><th>" +
        helpers.esc(klass.label) +
        "</th>" +
        scheduleFigureCell("E" + row) +
        scheduleFigureCell("F" + row) +
        scheduleFigureCell("I" + row) +
        scheduleFigureCell("W" + row) +
        scheduleFigureCell("X" + row) +
        "</tr>"
      );
    }).join("");

    var agreements = assets.agreements.length
      ? assets.agreements
          .map(function (agreement) {
            function figure(field) {
              if (!agreement.row) return '<td class="num">—</td>';
              var cell = S.HP_COLUMNS[field] + agreement.row;
              return (
                '<td class="num"' +
                cellRk(snap, helpers, S.HP_SHEET, cell) +
                ">" +
                helpers.fmtMoney(cellValue(snap.results, S.HP_SHEET, cell)) +
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
      '<table class="register-table"><thead><tr><th>Asset</th><th>Class</th><th>Cost</th><th>Depreciation</th><th>Written down</th></tr></thead><tbody>' +
      broughtForward +
      "</tbody></table></div>" +
      '<div class="panel-card"><h3>Bought during the year</h3>' +
      '<table class="register-table"><thead><tr><th>Date</th><th>Asset</th><th>Cost</th></tr></thead><tbody>' +
      additions +
      "</tbody></table></div>" +
      '<div class="panel-card"><h3>The schedule\'s own totals</h3>' +
      helpers.kvRows(scheduleRows) +
      "</div>" +
      '<div class="panel-card"><h3>Class totals, existing assets</h3><div class="ltd-months-scroll">' +
      '<table class="register-table"><thead><tr><th>Class</th><th>Cost</th><th>Depreciation</th><th>Rate</th><th>Charge this year</th><th>Disposals: cost</th><th>Disposals: depreciation</th></tr></thead><tbody>' +
      classRows +
      "</tbody></table></div></div>" +
      '<div class="panel-card"><h3>Class totals, assets bought this year</h3><div class="ltd-months-scroll">' +
      '<table class="register-table"><thead><tr><th>Class</th><th>Cost</th><th>Depreciation</th><th>Charge this year</th><th>Disposals: cost</th><th>Disposals: depreciation</th></tr></thead><tbody>' +
      newClassRows +
      "</tbody></table></div></div>" +
      '<div class="panel-card"><h3>Hire purchase</h3><div class="ltd-months-scroll">' +
      '<table class="register-table"><thead><tr><th>Agreement</th><th>Finance company</th><th>Financed</th><th>Months</th><th>Monthly</th><th>Capital</th><th>Interest</th></tr></thead><tbody>' +
      agreements +
      '</tbody><tfoot><tr class="total"><th colspan="2">Long-term creditor</th><td class="num"' +
      cellRk(snap, helpers, S.HP_SHEET, S.HP_TOTAL_CELL) +
      ">" +
      helpers.fmtMoney(cellValue(snap.results, S.HP_SHEET, S.HP_TOTAL_CELL)) +
      '</td><td colspan="4"></td></tr></tfoot></table></div></div>'
    );
  }

  // ============================== business details ==============================

  function renderBusinessDetails(snap, state, helpers) {
    var productMod = snap.context.productMod;
    var entity = snap.book.entityInformation || {};
    var director = (snap.book.employees || []).filter(function (employee) {
      return employee.isDirector;
    })[0];

    var entityRows = helpers
      .sectionRows(S.BUSINESS_DETAILS_SECTION)
      .map(function (row) {
        var mapping = S.ENTITY_FIELD_BY_CELL[row.cell];
        if (!mapping) {
          // E5, the first director's name -- the writer takes it from the
          // book's own director list, not from entityInformation, so it
          // renders read-only here.
          return readOnlyFieldWithKey(
            helpers,
            row.label,
            helpers.esc((director && director.name) || ""),
            cellRk(snap, helpers, row.sheet, row.cell),
          );
        }
        var value = mapping.path ? entity[mapping.path.slice(S.ENTITY_PATH_PREFIX.length)] : entity[mapping.field];
        return helpers.field(row.label, mapping.field, value || "", {
          rKeyAttr: cellRk(snap, helpers, row.sheet, row.cell),
          path: mapping.path,
        });
      })
      .join("");

    // Read-only throughout: the opening balance sheet is calculated from the
    // book's own opening journal lines (the "OB-001" lines
    // buildOpeningBalance() reads, diya-gl-loader.js), not from a
    // book.openingBalances field a form could write straight back to -- a
    // book's openingBalances only exists as extractBook()'s own read-back of
    // the same cells, with no path from there into the calculator. Editing
    // an opening balance is a lines edit, not a book-field edit.
    var openingRows = helpers
      .sectionRows(S.OPENING_BALANCE_SECTION)
      .map(function (row) {
        var value = cellValue(snap.results, row.sheet, row.cell);
        var text = formatByUnit(value, unitOf(productMod, row.sheet, row.cell), helpers);
        var rKeyAttr = cellRk(snap, helpers, row.sheet, row.cell);
        return (
          '<div class="editable-field"><label>' +
          helpers.esc(row.label) +
          '</label><input value="' +
          text +
          '" readonly' +
          rKeyAttr +
          " /></div>"
        );
      })
      .join("");

    return (
      "<h2>Business details</h2>" +
      '<div class="panel-card panel-form-width">' +
      entityRows +
      "</div>" +
      "<h3>Opening balance sheet</h3>" +
      '<p class="view-lede">The balance the book opened the year with, read-only: the CELL_MAP composite lines (net book value, cash and bank, tax and social security) are totals of several accounts, and every line here comes from the book\'s own opening journal rather than a field a form could edit directly.</p>' +
      '<div class="panel-card panel-form-width">' +
      openingRows +
      "</div>"
    );
  }

  function bindBusinessDetails(root, state, helpers) {
    helpers.bindBookFields(root);
  }

  // ============================== admin ==============================

  // Every cell in this list already declares unit "rate" (RATE_CELLS.Admin,
  // app/products/ltd.js), which the shared formatByUnit reads as a fraction
  // and multiplies by 100 -- correct for P9 (marginal relief) and G15-G19
  // (depreciation), both genuine fractions. P6/P7/P8 (corporation tax
  // rates), M19 (VAT rate) and G5-G8 (capital allowances) hold a whole
  // percent instead -- the calculator's own Math.round(rate * 100), the
  // same fact ltd-forms.js's own "percent" format documents against the
  // same cells -- so the shared formatter doubles them (P6's 19 becomes
  // "1900%"). Formatted here the way ltd-forms.js already does, rather than
  // widening the shared "rate" unit's own meaning for every other view.
  var ADMIN_WHOLE_PERCENT_CELLS = ["P6", "P7", "P8", "M19", "G5", "G6", "G7", "G8"];

  // O16/O17 hold the mileage rate in pounds per mile (0.45 = 45p), not a
  // rate at all -- fmtRate would print "45%".
  var ADMIN_PENCE_PER_MILE_CELLS = ["O16", "O17"];

  function adminCellText(value, cell, helpers) {
    if (ADMIN_WHOLE_PERCENT_CELLS.indexOf(cell) !== -1) {
      return typeof value === "number" ? String(Math.round(value * 100) / 100) + "%" : helpers.esc(String(value));
    }
    if (ADMIN_PENCE_PER_MILE_CELLS.indexOf(cell) !== -1) {
      return typeof value === "number" ? helpers.fmtPence(value) : helpers.esc(String(value));
    }
    return null;
  }

  function renderAdmin(snap, state, helpers) {
    var productMod = snap.context.productMod;
    function row(cell, label) {
      var value = cellValue(snap.results, S.ADMIN_SECTION, cell);
      return {
        label: label || labelFor(productMod, S.ADMIN_SECTION, cell, S.ADMIN_SECTION + "!" + cell),
        text: adminCellText(value, cell, helpers) || formatByUnit(value, unitOf(productMod, S.ADMIN_SECTION, cell), helpers),
        rKeyAttr: cellRk(snap, helpers, S.ADMIN_SECTION, cell),
      };
    }
    var rateRows = S.ADMIN_RATE_CELLS.map(function (cell) {
      return row(cell);
    });
    var capitalAllowanceRows = S.ADMIN_CAPITAL_ALLOWANCE_CELLS.map(function (cell) {
      return row(cell);
    });
    var depreciationRows = S.ADMIN_DEPRECIATION_CELLS.map(function (cell) {
      return row(cell);
    });
    var mileageRows = S.ADMIN_MILEAGE_CELLS.map(function (cell) {
      return row(cell);
    });
    var vatRow = row(S.ADMIN_VAT_RATE_CELL);

    var straddles = cellValue(snap.results, "CorporationTax", "A34") > 0;
    var financialYearRows = S.ADMIN_FINANCIAL_YEAR_ROWS.filter(function (fyRow, index) {
      return index === 0 || straddles;
    })
      .map(function (fyRow) {
        return (
          "<tr><td" +
          cellRk(snap, helpers, S.ADMIN_SECTION, fyRow.year) +
          ">" +
          formatByUnit(cellValue(snap.results, S.ADMIN_SECTION, fyRow.year), unitOf(productMod, S.ADMIN_SECTION, fyRow.year), helpers) +
          "</td><td" +
          cellRk(snap, helpers, S.ADMIN_SECTION, fyRow.start) +
          ">" +
          formatByUnit(cellValue(snap.results, S.ADMIN_SECTION, fyRow.start), "date", helpers) +
          "</td><td" +
          cellRk(snap, helpers, S.ADMIN_SECTION, fyRow.end) +
          ">" +
          formatByUnit(cellValue(snap.results, S.ADMIN_SECTION, fyRow.end), "date", helpers) +
          "</td></tr>"
        );
      })
      .join("");

    return (
      "<h2>Admin</h2>" +
      '<p class="view-lede rate-provenance">The tax year\'s rates and thresholds as the package was generated with them, read-only.</p>' +
      '<div class="panel-card"><h3>Corporation tax and capital allowance rates</h3>' +
      helpers.kvRows(rateRows.concat(capitalAllowanceRows)) +
      "</div>" +
      '<div class="panel-card"><h3>Depreciation rates</h3>' +
      helpers.kvRows(depreciationRows) +
      "</div>" +
      '<div class="panel-card"><h3>Mileage and VAT</h3>' +
      helpers.kvRows(mileageRows.concat([vatRow])) +
      "</div>" +
      '<div class="panel-card"><h3>Financial years in the period</h3>' +
      '<table class="register-table"><thead><tr><th>Year</th><th>Start</th><th>End</th></tr></thead><tbody>' +
      financialYearRows +
      "</tbody></table></div>"
    );
  }

  global.DiyaGlLtdLedger = {
    renderBank: renderBank,
    bindBank: bindBank,
    renderLedgers: renderLedgers,
    renderProfitLoss: renderProfitLoss,
    bindProfitLoss: bindProfitLoss,
    renderStock: renderStock,
    bindStock: bindStock,
    renderFixedAssets: renderFixedAssets,
    renderBusinessDetails: renderBusinessDetails,
    bindBusinessDetails: bindBusinessDetails,
    renderAdmin: renderAdmin,
  };
})(typeof window !== "undefined" ? window : globalThis);
