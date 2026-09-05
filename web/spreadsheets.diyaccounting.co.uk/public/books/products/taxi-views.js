// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/products/taxi-views.js
//
// The five Taxi views that are not the takings journal or a tax form: the
// profit and loss account with the mileage comparison panel and the
// workbook's own health check, the vehicle register, the tax computation in
// the SA110 working sheet's order, the quarterly summary and the forecast.
// books/products/taxi.js registers the view ids against the functions this
// file exposes on window.DiyaGlTaxiViews; it does not call them directly, so
// load order against the manifest does not matter.
//
// Every figure carries the report key of the cell it came from, so the
// shell's drift walker can mark it, and a figure the calculator did not emit
// carries no key at all -- R has no entry to join it to.

(function (global) {
  "use strict";

  var PL_SHEET = "Profit & Loss Acc";
  var PURCHASE_ANALYSIS_SHEET = "PurchasesMar";
  var FIXED_ASSETS_SHEET = "Fixed Assets";

  // The P&L cells the sheet prints in bold: its two subtotals and its two
  // profit lines.
  var PL_TOTAL_CELLS = { B12: 1, B13: 1, B22: 1, B23: 1 };
  // The sheet keeps other income under the net profit line, so the page
  // captions it rather than letting it read as another expense.
  var BELOW_THE_LINE_CELL = "B24";

  // The comparison panel's five figures, in the order the sheet weighs
  // them: what was driven, what that claims, what the car actually cost,
  // the figure the sheet compares the claim against, and what the accounts
  // charged in the end.
  var COMPARISON_FIGURES = [
    { name: "miles", label: "Business miles", sheet: PURCHASE_ANALYSIS_SHEET, cell: "A1", field: "miles", count: true },
    { name: "allowance", label: "Mileage allowance", sheet: PURCHASE_ANALYSIS_SHEET, cell: "A2", field: "allowance" },
    { name: "running", label: "Running the car", sheet: PURCHASE_ANALYSIS_SHEET, cell: "I2", field: "running" },
    { name: "compared", label: "The figure the sheet compares", sheet: PL_SHEET, cell: "J1", field: "compared" },
    { name: "charged", label: "Charged to the accounts", sheet: PL_SHEET, cell: "B12", field: "charged" },
  ];
  // A book with no mileage log has nothing to claim and nothing to compare,
  // so the panel drops the two figures that would both read nil.
  var FIGURES_WITHOUT_MILES = { running: 1, compared: 1, charged: 1 };

  var VEHICLE_ROUTE_CELL = "C1";
  var REGISTER_TOTAL_CELLS = { cost: "T1", wda: "J1", writtenDown: "K1" };
  var PERSONAL_USE_TITLE = "the workbook's F column; the book has no field for it";

  var FORECAST_MONTHS_TRADED_CELL = "C19";
  var FORECAST_TOTAL_CELLS = { C30: 1, C41: 1 };
  var FORECAST_MONTHS_IN_A_YEAR = 12;

  var HEALTH_CHECK_WEEK_LABELS = ["Drawings week 1", "Drawings week 2", "Drawings week 3", "Drawings week 4"];
  var HEALTH_CHECK_DRAWINGS_HINT = "an input on the workbook; the book has no field for it";

  var QUARTER_HEADINGS = ["Apr to Jun", "Jul to Sep", "Oct to Dec", "Jan to Mar", "Year"];

  // The Admin cells the Class 4 labels read their words from, rather than
  // repeating a rate the tax year already decides.
  var CLASS4_MAIN_RATE_CELL = "L20";
  var CLASS4_LOWER_LIMIT_CELL = "N20";
  var CLASS4_UPPER_RATE_CELL = "L23";
  var CLASS4_UPPER_LIMIT_CELL = "N23";

  // ============================== reading the snapshot ==============================

  // The report key for a cell, given only where the snapshot carries a
  // value for it: R holds no entry for a cell the calculator did not emit,
  // and every data-r-key on the page must resolve to a real one.
  function keyed(snapshot, helpers, sheet, cell) {
    var sheetResults = snapshot.results && snapshot.results[sheet];
    return sheetResults && sheetResults[cell] !== undefined ? helpers.rkFor(sheet, cell) : "";
  }

  function v(snapshot, sheet, cell) {
    var sheetResults = snapshot.results && snapshot.results[sheet];
    var value = sheetResults ? sheetResults[cell] : undefined;
    return typeof value === "number" ? value : 0;
  }

  // One of the Admin rates the snapshot already read for the Admin view.
  function adminValue(snapshot, cell) {
    var rates = snapshot.admin.rates;
    for (var i = 0; i < rates.length; i++) {
      if (rates[i].cell === cell) return rates[i].value;
    }
    return 0;
  }

  function count(n) {
    return Math.round(n).toLocaleString("en-GB");
  }

  // ============================== the comparison panel ==============================

  function comparisonFigure(snapshot, helpers, figure) {
    var value = snapshot.vehicle[figure.field];
    return (
      '<div class="comparison-figure" data-figure="' +
      figure.name +
      '"><span class="caps-label">' +
      helpers.esc(figure.label) +
      '</span><span class="figure-value"' +
      keyed(snapshot, helpers, figure.sheet, figure.cell) +
      ">" +
      helpers.esc(figure.count ? count(value) : helpers.fmtMoney(value)) +
      "</span></div>"
    );
  }

  // Which of the two ways of charging a vehicle this year's accounts took,
  // and what the other one would have been worth. The sheet decides it
  // itself, in one cell, and every running-cost row reads that cell.
  function comparisonSentence(snapshot, helpers) {
    var vehicle = snapshot.vehicle;
    if (!vehicle.present) return "This book records no business miles, so the accounts charge the vehicle's running costs.";
    if (vehicle.route === "mileage") {
      return (
        "The mileage allowance is " +
        helpers.fmtMoney(vehicle.allowance) +
        " and running the car cost " +
        helpers.fmtMoney(vehicle.running) +
        ", so this year's accounts claim the allowance; fuel, repairs, road tax and insurance receipts are recorded but not charged."
      );
    }
    return (
      "Running the car cost " +
      helpers.fmtMoney(vehicle.running) +
      " and the mileage allowance would be " +
      helpers.fmtMoney(vehicle.allowance) +
      ", so this year's accounts charge the running costs and the vehicle's capital allowances; the allowance forgone is " +
      helpers.fmtMoney(vehicle.allowance) +
      "."
    );
  }

  function renderComparison(snapshot, helpers) {
    var vehicle = snapshot.vehicle;
    var figures = COMPARISON_FIGURES.filter(function (figure) {
      return vehicle.present || FIGURES_WITHOUT_MILES[figure.name];
    })
      .map(function (figure) {
        return comparisonFigure(snapshot, helpers, figure);
      })
      .join("");
    var routeCell = vehicle.routeText
      ? '<p class="comparison-route-cell">the sheet says: <span' +
        keyed(snapshot, helpers, PL_SHEET, VEHICLE_ROUTE_CELL) +
        ">" +
        helpers.esc(vehicle.routeText) +
        "</span></p>"
      : "";
    return (
      '<section class="panel-card vehicle-comparison" data-route="' +
      helpers.esc(vehicle.route) +
      '"><h3>The vehicle: the mileage allowance or what the car cost</h3><div class="comparison-figures">' +
      figures +
      '</div><p class="comparison-sentence">' +
      helpers.esc(comparisonSentence(snapshot, helpers)) +
      "</p>" +
      routeCell +
      "</section>"
    );
  }

  // ============================== the statement ==============================

  // CELL_MAP indents the sheet's detail rows one step under the subtotal
  // they add into; the annual column is one level deep and no more.
  function statementRow(helpers, label, indent, valueHtml, className) {
    return (
      '<tr class="' +
      (className || "") +
      '"><td class="' +
      (indent ? "statement-indent" : "") +
      '">' +
      helpers.esc(label) +
      "</td>" +
      valueHtml +
      "</tr>"
    );
  }

  // The annual column of the sheet's own profit and loss account: the
  // twenty rows CELL_MAP names, in its order, with the labels the manifest
  // shortens for the four rows whose sheet wording is a sentence.
  function renderStatement(snapshot, helpers) {
    var byCell = {};
    helpers.sectionRows("Profit & Loss Account").forEach(function (row) {
      byCell[row.cell] = row;
    });
    var rows = "";
    snapshot.categories.forEach(function (category) {
      var row = byCell[category.cell];
      var valueHtml = "<td" + keyed(snapshot, helpers, category.sheet, category.cell) + ">" + helpers.fmtMoney(row.value || 0) + "</td>";
      if (category.cell === BELOW_THE_LINE_CELL) {
        rows += '<tr class="below-the-line"><td colspan="2">Below the line</td></tr>';
      }
      rows += statementRow(helpers, category.label, row.indent, valueHtml, PL_TOTAL_CELLS[category.cell] ? "total" : "");
    });
    return '<div class="panel-card panel-form-width"><table class="kv-table">' + rows + "</table></div>";
  }

  // ============================== the health check ==============================

  // The block the sheet keeps beside the P&L: a forecast month's profit
  // against the four weeks of drawings and the month's share of the year's
  // tax. The drawings are the reader's own entry on the workbook and no
  // cell of the book carries them, so the page shows the field and says why
  // it is empty.
  function renderHealthCheck(snapshot, helpers) {
    var health = snapshot.healthCheck;
    var rows = statementRow(
      helpers,
      "Forecast profit",
      0,
      "<td" +
        keyed(snapshot, helpers, snapshot.context.productMod.FORECAST_SHEET, "C30") +
        ">" +
        helpers.fmtMoney(health.forecastProfit) +
        "</td>",
    );
    health.drawings.forEach(function (drawing, index) {
      rows += statementRow(
        helpers,
        HEALTH_CHECK_WEEK_LABELS[index],
        0,
        '<td><input class="readonly-input" disabled value="—" aria-label="' +
          helpers.esc(HEALTH_CHECK_WEEK_LABELS[index]) +
          '" />' +
          (index === 0 ? '<span class="field-hint">' + HEALTH_CHECK_DRAWINGS_HINT + "</span>" : "") +
          "</td>",
      );
    });
    rows += statementRow(
      helpers,
      "Income tax and NI liability, one twelfth",
      0,
      "<td>" + helpers.fmtMoney(health.liabilityTwelfth) + "</td>",
      "derived",
    );
    rows += statementRow(
      helpers,
      "Health check",
      0,
      "<td>" + helpers.fmtMoney(health.forecastProfit - health.liabilityTwelfth) + "</td>",
      "derived total",
    );
    return (
      '<details class="health-check"><summary>Financial business health check</summary><table class="kv-table">' +
      rows +
      "</table></details>"
    );
  }

  function renderProfitLoss(snapshot, state, helpers) {
    return (
      "<h2>Profit &amp; Loss Account</h2>" +
      renderComparison(snapshot, helpers) +
      renderStatement(snapshot, helpers) +
      renderHealthCheck(snapshot, helpers)
    );
  }

  // ============================== the vehicle register ==============================

  function registerRow(snapshot, helpers, asset, index) {
    return (
      '<tr data-asset="' +
      helpers.esc(asset.assetID) +
      '"><td>' +
      helpers.esc(asset.acquiredDate) +
      "</td><td>" +
      helpers.esc(asset.description) +
      '</td><td class="num"' +
      (index === 0 ? keyed(snapshot, helpers, FIXED_ASSETS_SHEET, snapshot.register.cells.firstAssetCost) : "") +
      ">" +
      helpers.fmtMoney(asset.cost) +
      '</td><td class="num" title="' +
      PERSONAL_USE_TITLE +
      '">—</td><td class="num">' +
      helpers.fmtMoney(asset.wda) +
      '</td><td class="num">' +
      helpers.fmtMoney(asset.writtenDown) +
      "</td></tr>"
    );
  }

  function registerFoot(snapshot, helpers) {
    var totals = snapshot.register.totals;
    return (
      '<tfoot><tr class="total"><th colspan="2">Total</th><td class="num"' +
      keyed(snapshot, helpers, PURCHASE_ANALYSIS_SHEET, REGISTER_TOTAL_CELLS.cost) +
      ">" +
      helpers.fmtMoney(totals.capex) +
      '</td><td></td><td class="num"' +
      keyed(snapshot, helpers, FIXED_ASSETS_SHEET, REGISTER_TOTAL_CELLS.wda) +
      ">" +
      helpers.fmtMoney(totals.wda) +
      '</td><td class="num"' +
      keyed(snapshot, helpers, FIXED_ASSETS_SHEET, REGISTER_TOTAL_CELLS.writtenDown) +
      ">" +
      helpers.fmtMoney(totals.writtenDownValue) +
      "</td></tr></tfoot>"
    );
  }

  function renderRegisterTable(snapshot, helpers) {
    var assets = snapshot.register.assets;
    if (!assets.length) return "";
    return (
      '<table class="register-table vehicle-register"><thead><tr><th>Bought</th><th>Vehicle</th><th>Cost</th><th>Personal use</th>' +
      "<th>WDA</th><th>Written down</th></tr></thead><tbody>" +
      assets
        .map(function (asset, index) {
          return registerRow(snapshot, helpers, asset, index);
        })
        .join("") +
      "</tbody>" +
      registerFoot(snapshot, helpers) +
      "</table>"
    );
  }

  function registerNotes(snapshot, helpers) {
    var register = snapshot.register;
    var notes = "";
    if (!register.assets.length && !register.unregistered.length) {
      notes += '<p class="entries-note">This book records no vehicles.</p>';
    }
    if (register.unregistered.length) {
      notes +=
        '<p class="entries-note">' +
        count(register.unregistered.length) +
        " vehicle purchase" +
        (register.unregistered.length === 1 ? " is" : "s are") +
        " not on the register; the checks panel offers to register " +
        (register.unregistered.length === 1 ? "it" : "them") +
        ".</p>";
    }
    return notes;
  }

  function renderVehicles(snapshot, state, helpers) {
    var cells = snapshot.register.cells;
    function allowance(label, field) {
      return {
        label: label,
        value: snapshot.register.totals[field],
        rKeyAttr: keyed(snapshot, helpers, FIXED_ASSETS_SHEET, cells[field]),
      };
    }
    return (
      "<h2>Vehicles</h2>" +
      renderRegisterTable(snapshot, helpers) +
      registerNotes(snapshot, helpers) +
      '<div class="panel-card"><h3>Capital allowances</h3>' +
      helpers.kvRows([
        allowance("Annual Investment Allowance", "aia"),
        allowance("Capital allowance on disposal", "disposals"),
        allowance("Balancing charge", "balancingCharge"),
      ]) +
      "</div>"
    );
  }

  // ============================== the tax computation ==============================

  // A working-sheet line: the SA110 reference it answers to beside its
  // label, and the figure in the form's own money box. The sheet cell the
  // figure came from names the row, so a test can reach one line by cell.
  function computationRow(opts) {
    return (
      '<div class="form-row' +
      (opts.total ? " total-row" : "") +
      (opts.derived ? " derived" : "") +
      '" data-line="' +
      opts.line +
      '"><span class="form-row-label">' +
      opts.label +
      (opts.ref ? '<span class="working-sheet-ref">' + opts.ref + "</span>" : "") +
      (opts.extraHtml || "") +
      '</span><span class="form-amount-box"' +
      (opts.rKeyAttr || "") +
      ">" +
      opts.amount +
      "</span></div>"
    );
  }

  // Class 2 is the flat weekly charge the sheet never prints, so its line
  // carries a sentence where every other line carries a box.
  function class2Row(snapshot, helpers) {
    var class2 = snapshot.computation.class2;
    var sentence =
      class2.amount > 0
        ? helpers.fmtMoney(class2.amount) +
          " voluntary. Profits are below the " +
          helpers.fmtMoney(class2.threshold) +
          " small profits threshold, so Class 2 is a choice, at " +
          helpers.fmtMoney(class2.weekly) +
          " a week."
        : "Nil. Profits are above the " +
          helpers.fmtMoney(class2.threshold) +
          " small profits threshold, so the year is credited without payment.";
    return (
      '<div class="form-row" data-line="class2"><span class="form-row-label">Class 2<span class="working-sheet-ref">D19</span></span>' +
      '<span class="class2-sentence">' +
      helpers.esc(sentence) +
      "</span></div>"
    );
  }

  function bandRow(snapshot, helpers, band) {
    var sheet = snapshot.computation.sheet;
    var ceiling = band.ceiling
      ? " to <span" + keyed(snapshot, helpers, sheet, band.cells.ceiling) + ">" + helpers.esc(helpers.fmtWhole(band.ceiling)) + "</span>"
      : "";
    // The band's own ceiling and rate come between the label and its
    // working-sheet reference, so the line reads as the sheet prints it.
    return computationRow({
      line: band.cells.tax,
      label: helpers.esc(band.label),
      ref: "",
      extraHtml:
        ceiling +
        '<span class="form-rate-pencil"' +
        keyed(snapshot, helpers, sheet, band.cells.rate) +
        ">" +
        helpers.fmtRate(band.rate) +
        '</span><span class="working-sheet-ref">Section 6</span>',
      amount: helpers.fmtBoxMoney(band.tax),
      rKeyAttr: keyed(snapshot, helpers, sheet, band.cells.tax),
    });
  }

  // "Class 4 at 6% on profit between £12,570 and £50,270": the rate and the
  // two limits are the tax year's, read back off the Admin sheet the
  // generator injected them into rather than written here as figures.
  function class4Labels(snapshot, helpers) {
    return [
      "Class 4 at " +
        helpers.fmtRate(adminValue(snapshot, CLASS4_MAIN_RATE_CELL)) +
        " on profit between " +
        helpers.fmtWhole(adminValue(snapshot, CLASS4_LOWER_LIMIT_CELL)) +
        " and " +
        helpers.fmtWhole(adminValue(snapshot, CLASS4_UPPER_LIMIT_CELL)),
      "Class 4 at " +
        helpers.fmtRate(adminValue(snapshot, CLASS4_UPPER_RATE_CELL)) +
        " above " +
        helpers.fmtWhole(adminValue(snapshot, CLASS4_UPPER_LIMIT_CELL)),
    ];
  }

  var LONG_MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  function longDate(iso) {
    var parts = iso.split("-");
    return Number(parts[2]) + " " + LONG_MONTHS[Number(parts[1]) - 1] + " " + parts[0];
  }

  var PAYMENT_LABELS = ["First payment, due ", "Second payment, due "];
  var PAYMENT_REFS = ["SA110 box 11", ""];

  function paymentsSection(snapshot, helpers) {
    var sheet = snapshot.computation.sheet;
    var rows = snapshot.computation.paymentsOnAccount
      .map(function (payment, index) {
        return computationRow({
          line: payment.cell,
          label: PAYMENT_LABELS[index] + longDate(payment.due),
          ref: PAYMENT_REFS[index],
          amount: helpers.fmtBoxMoney(payment.amount),
          rKeyAttr: keyed(snapshot, helpers, sheet, payment.cell),
        });
      })
      .join("");
    return (
      rows +
      '<p class="computation-note">Each payment is half of last year&#39;s liability, which is what the sheet&#39;s E24 copies from E17.</p>'
    );
  }

  function renderComputation(snapshot, state, helpers) {
    var computation = snapshot.computation;
    var sheet = computation.sheet;
    var cells = computation.cells;
    var form = helpers.form;
    function wholeRow(line, label, ref, value, total) {
      return computationRow({
        line: line,
        label: label,
        ref: ref,
        amount: helpers.fmtBoxWhole(value),
        rKeyAttr: keyed(snapshot, helpers, sheet, line),
        total: total,
      });
    }
    var labels = class4Labels(snapshot, helpers);
    var class4Due = computation.class4[0] + computation.class4[1];
    return (
      '<p class="view-lede">Follows HMRC&#39;s SA110 working sheet, top to bottom.</p>' +
      form.render(
        "Tax computation",
        "This section an indication and for your information only",
        form.section("Income", wholeRow(cells.profit, "Profit from self-employment (SA103S box 31)", "D1", computation.profit)) +
          form.section(
            "Allowances",
            wholeRow(cells.allowance, "Personal allowance, tapered above £100,000", "A125", computation.allowance),
          ) +
          form.section("Taxable income", wholeRow(cells.taxable, "Total income on which tax is due", "A131", computation.taxable)) +
          form.section(
            "Income tax",
            computation.bands
              .map(function (band) {
                return bandRow(snapshot, helpers, band);
              })
              .join("") +
              computationRow({
                line: cells.incomeTax,
                label: "Income tax due",
                ref: "A328",
                amount: helpers.fmtBoxMoney(computation.incomeTax),
                rKeyAttr: keyed(snapshot, helpers, sheet, cells.incomeTax),
                total: true,
              }),
          ) +
          form.section(
            "National Insurance",
            computationRow({
              line: cells.class4[0],
              label: helpers.esc(labels[0]),
              ref: "D15",
              amount: helpers.fmtBoxMoney(computation.class4[0]),
              rKeyAttr: keyed(snapshot, helpers, sheet, cells.class4[0]),
            }) +
              computationRow({
                line: cells.class4[1],
                label: helpers.esc(labels[1]),
                ref: "D17",
                amount: helpers.fmtBoxMoney(computation.class4[1]),
                rKeyAttr: keyed(snapshot, helpers, sheet, cells.class4[1]),
              }) +
              computationRow({
                line: "class4-due",
                label: "Class 4 due",
                ref: "D18",
                amount: helpers.fmtBoxMoney(class4Due),
                derived: true,
              }) +
              class2Row(snapshot, helpers),
          ) +
          form.section(
            "Total",
            computationRow({
              line: cells.total,
              label: "Income tax and Class 4 NI",
              ref: "A331",
              amount: helpers.fmtBoxMoney(computation.total),
              rKeyAttr: keyed(snapshot, helpers, sheet, cells.total),
              total: true,
            }),
          ) +
          form.section("Payments on account", paymentsSection(snapshot, helpers)),
      )
    );
  }

  // ============================== the quarterly summary ==============================

  function renderQuarterly(snapshot, state, helpers) {
    var head = QUARTER_HEADINGS.map(function (heading) {
      return "<th>" + heading + "</th>";
    }).join("");
    var rows = snapshot.quarterly.rows
      .map(function (row) {
        return (
          "<tr><th>" +
          helpers.esc(row.label) +
          "</th>" +
          row.cells
            .map(function (cell) {
              return (
                '<td class="num"' + keyed(snapshot, helpers, cell.sheet, cell.cell) + ">" + helpers.fmtMoney(cell.value || 0) + "</td>"
              );
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    return (
      "<h2>Quarterly summary</h2>" +
      '<p class="view-lede">The shape a cumulative period summary takes.</p>' +
      '<div class="quarterly-scroll"><table class="quarterly-table"><thead><tr><th>Quarter</th>' +
      head +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table></div>"
    );
  }

  // ============================== the forecast ==============================

  function renderForecast(snapshot, state, helpers) {
    var forecast = snapshot.forecast;
    var lede =
      forecast.monthsTraded < FORECAST_MONTHS_IN_A_YEAR
        ? '<p class="view-lede">' +
          count(forecast.monthsTraded) +
          " of 12 months traded. The forecast repeats each traded month and spreads the year across the rest.</p>"
        : "";
    var rows = forecast.rows.map(function (row) {
      return {
        label: row.label,
        text: row.cell === FORECAST_MONTHS_TRADED_CELL ? count(row.value || 0) + " of 12 months" : helpers.fmtMoney(row.value || 0),
        rKeyAttr: keyed(snapshot, helpers, row.sheet, row.cell),
        total: !!FORECAST_TOTAL_CELLS[row.cell],
      };
    });
    return "<h2>Forecast</h2>" + lede + '<div class="panel-card panel-form-width">' + helpers.kvRows(rows) + "</div>";
  }

  global.DiyaGlTaxiViews = {
    renderProfitLoss: renderProfitLoss,
    renderVehicles: renderVehicles,
    renderComputation: renderComputation,
    renderQuarterly: renderQuarterly,
    renderForecast: renderForecast,
  };
})(typeof window !== "undefined" ? window : globalThis);
