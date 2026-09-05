// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/products/taxi-forms.js
//
// The Taxi SA103S view, rendered from app/data/hmrc/form-layouts/taxi.json
// through the shell's form builders. books/products/taxi.js registers the
// sa103s view id against renderSa103s; it does not call this file directly,
// so load order against the manifest does not matter.
//
// The layout carries the 2026 form's own box numbers. The workbook's SE
// Short sheet prints its own numbers, one behind the form's from turnover
// on, so a box names the sheet cell rather than the sheet's number.
//
// Boxes 11 to 20 are the one place the render follows the form rather than
// the sheet. The sheet's own expense block (D46, D51, D55, D60, D64, O46,
// O51, O55, O60) carries no CELL_MAP row, so R holds no key for any of it
// and a drift mark could never appear there; the Profit & Loss Account
// cells behind the same figures are all keyed. The sheet also blanks that
// block below £30,000 turnover, while the form's own permission is £90,000.
// Each box that files a figure somewhere the sheet does not says so in a
// sheet-placement note beside it.

(function (global) {
  "use strict";

  var LAYOUT_PATH = "assets/data/hmrc/form-layouts/taxi.json";
  var PL_SHEET = "Profit & Loss Acc";

  // The resolvers a box's "derived" may name. "pl:B<n>" and "sum:B<n>,B<m>"
  // are patterns rather than names, so they are not in this list.
  var DERIVED_NAMES = ["goodsForResale", "vehicleTravel", "repairs", "totalExpenses"];

  // The nine boxes whose printed figures box 20 totals.
  var EXPENSE_BOXES = { 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1 };

  // The P&L row each cell a "sum:" rule names is called by on the form's
  // own terms, for the parts line under the box that adds them together.
  var SUM_PART_LABELS = { B17: "advertising", B19: "interest", B20: "bank charges", B21: "other expenses" };

  // The layout is fetched on the first render, never at load: a Node test
  // evaluates this file with neither fetch nor document in its global.
  var layout = null;
  var layoutFailed = false;
  var layoutPending = null;

  function requestLayout() {
    if (layoutPending) return;
    layoutPending = global
      .fetch(LAYOUT_PATH)
      .then(function (response) {
        if (!response.ok) throw new Error('taxi-forms.js: "' + LAYOUT_PATH + '" returned ' + response.status);
        return response.json();
      })
      .then(function (json) {
        layout = json;
        if (global.DiyaGlBooksPage && global.DiyaGlBooksPage.helpers) global.DiyaGlBooksPage.helpers.render();
      })
      .catch(function (error) {
        layoutFailed = true;
        if (global.console && global.console.error) global.console.error(error);
      });
  }

  // ============================== reading the snapshot ==============================

  // The report key for a cell, given only where the snapshot carries a
  // value for it: R holds no entry for a cell the calculator did not emit,
  // and every data-r-key on the page must resolve to a real one.
  function keyed(snapshot, helpers, sheet, cell) {
    var sheetResults = snapshot.results && snapshot.results[sheet];
    return sheetResults && sheetResults[cell] !== undefined ? helpers.rkFor(sheet, cell) : "";
  }

  function present(snapshot, sheet, cell) {
    var sheetResults = snapshot.results && snapshot.results[sheet];
    return !!sheetResults && sheetResults[cell] !== undefined;
  }

  function v(snapshot, sheet, cell) {
    var sheetResults = snapshot.results && snapshot.results[sheet];
    var value = sheetResults ? sheetResults[cell] : undefined;
    return typeof value === "number" ? value : 0;
  }

  // ============================== the form row ==============================

  // The shell's own form-row markup, with two slots helpers.form.row has
  // none for: a parts line inside the label, and a static note in the
  // margin column. The note is a sibling of .form-row-margin rather than a
  // child, because the drift walker rewrites that element's innerHTML the
  // first time the row's own box drifts.
  function boxRow(opts) {
    return (
      '<div class="form-row' +
      (opts.total ? " total-row" : "") +
      '"><span class="box-chip">' +
      opts.box +
      '</span><span class="form-row-label">' +
      opts.label +
      (opts.partsHtml || "") +
      '</span><span class="form-amount-wrap"><span class="form-amount-box"' +
      (opts.rKeyAttr || "") +
      ">" +
      opts.amount +
      '</span><span class="whole-pounds-note">whole pounds</span></span>' +
      (opts.noteHtml || "") +
      "</div>"
    );
  }

  function placementNote(helpers, sentence) {
    return '<span class="sheet-placement">' + helpers.esc(sentence) + "</span>";
  }

  // "fuel £x · car hire £y" under a box's label, each figure in a keyed
  // span of its own so a drift mark replaces the figure and leaves the word
  // in front of it standing.
  function partsLine(snapshot, helpers, pairs) {
    return (
      '<span class="box-parts">' +
      pairs
        .map(function (pair) {
          return (
            '<span class="box-part">' +
            helpers.esc(pair[0]) +
            " <span" +
            keyed(snapshot, helpers, PL_SHEET, pair[1]) +
            ">" +
            helpers.esc(helpers.fmtMoney(v(snapshot, PL_SHEET, pair[1]))) +
            "</span></span>"
          );
        })
        .join(" &middot; ") +
      "</span>"
    );
  }

  // ============================== the derived boxes ==============================

  // What the sheet charges for the vehicle with its capital allowances
  // taken back out: the figure the sheet itself files under its own box 11,
  // whichever route it took.
  function vehicleCharge(snapshot, helpers) {
    return helpers.fmtMoney(v(snapshot, PL_SHEET, "B12") - v(snapshot, PL_SHEET, "B10"));
  }

  function registerDescriptions(snapshot) {
    return snapshot.register.assets
      .map(function (asset) {
        return asset.description;
      })
      .join(", ");
  }

  function sumPairs(cells) {
    return cells.map(function (cell) {
      return [SUM_PART_LABELS[cell], cell];
    });
  }

  // A box the layout gives a derived rule: what it prints, the key it
  // carries, the parts line under its label and the note beside it. A null
  // value prints an empty box with no key.
  function resolveDerived(snapshot, helpers, rule) {
    var mileageRoute = snapshot.vehicle.route === "mileage";
    if (rule.indexOf("pl:") === 0) {
      var cell = rule.slice(3);
      return { value: v(snapshot, PL_SHEET, cell), rKeyAttr: keyed(snapshot, helpers, PL_SHEET, cell) };
    }
    if (rule.indexOf("sum:") === 0) {
      var cells = rule.slice(4).split(",");
      var total = 0;
      for (var i = 0; i < cells.length; i++) total += v(snapshot, PL_SHEET, cells[i]);
      return { value: total, partsHtml: partsLine(snapshot, helpers, sumPairs(cells)) };
    }
    if (rule === "goodsForResale") {
      return {
        value: null,
        noteHtml: placementNote(
          helpers,
          "The sheet prints " + vehicleCharge(snapshot, helpers) + " here: vehicle costs less capital allowances.",
        ),
      };
    }
    if (rule === "vehicleTravel") {
      var placement = placementNote(helpers, "The sheet files this under box 11.");
      if (mileageRoute) {
        return { value: v(snapshot, PL_SHEET, "B11"), rKeyAttr: keyed(snapshot, helpers, PL_SHEET, "B11"), noteHtml: placement };
      }
      return {
        value: v(snapshot, PL_SHEET, "B6") + v(snapshot, PL_SHEET, "B7") + v(snapshot, PL_SHEET, "B9"),
        partsHtml: partsLine(snapshot, helpers, [
          ["fuel", "B6"],
          ["car hire", "B7"],
          ["road tax and insurance", "B9"],
        ]),
        noteHtml: placement,
      };
    }
    if (rule === "repairs") {
      if (!mileageRoute) return { value: v(snapshot, PL_SHEET, "B8"), rKeyAttr: keyed(snapshot, helpers, PL_SHEET, "B8") };
      return {
        value: null,
        noteHtml: placementNote(
          helpers,
          "Repairs are inside the mileage rate this year; the sheet records " + vehicleCharge(snapshot, helpers) + " under box 11.",
        ),
      };
    }
    // The total of boxes 11 to 19 as this render printed them, filled in by
    // the caller once the section's own rows have resolved.
    if (rule === "totalExpenses") return { value: null };
    throw new Error('taxi-forms.js: unknown derived rule "' + rule + '"');
  }

  // ============================== the render ==============================

  // The form allows no capital allowance on a vehicle claimed at the
  // mileage rate, but the schedule still runs its own allowance over
  // anything else on the register, so box 25 names what it holds.
  function registerNoteApplies(snapshot, value) {
    return snapshot.vehicle.route === "mileage" && snapshot.register.assets.length > 0 && value > 0;
  }

  // One box as it prints: a cell box reads the snapshot and keys to it, a
  // derived box goes through resolveDerived, and a box with neither prints
  // present and empty, the paper form's own "leave it blank".
  function renderBox(snapshot, helpers, sheet, box, expenses) {
    var resolved = { value: null };
    if (box.cell && present(snapshot, sheet, box.cell)) {
      resolved = { value: v(snapshot, sheet, box.cell), rKeyAttr: keyed(snapshot, helpers, sheet, box.cell) };
    } else if (box.derived) {
      resolved = resolveDerived(snapshot, helpers, box.derived);
      if (box.derived === "totalExpenses") resolved.value = expenses.total;
    }
    if (box.box === "25" && registerNoteApplies(snapshot, resolved.value)) {
      resolved.noteHtml = placementNote(
        helpers,
        "The form allows no capital allowance on a vehicle claimed at the mileage rate. This register holds " +
          registerDescriptions(snapshot) +
          ".",
      );
    }
    if (EXPENSE_BOXES[box.box]) expenses.total += resolved.value || 0;
    return boxRow({
      box: helpers.esc(box.box),
      label: helpers.esc(box.label),
      amount: resolved.value === null ? "" : helpers.fmtBoxWhole(resolved.value),
      rKeyAttr: resolved.value === null ? "" : resolved.rKeyAttr,
      total: !!box.total,
      partsHtml: resolved.partsHtml,
      noteHtml: resolved.noteHtml,
    });
  }

  function renderSections(snapshot, helpers, form, layoutForm) {
    var expenses = { total: 0 };
    return layoutForm.sections
      .map(function (section) {
        var rows = section.boxes
          .map(function (box) {
            return renderBox(snapshot, helpers, layoutForm.sheet, box, expenses);
          })
          .join("");
        return form.section(section.heading, rows);
      })
      .join("");
  }

  function renderSa103s(snapshot, state, helpers) {
    if (!layout) {
      if (layoutFailed) return '<p class="entries-note">The SA103S layout did not load.</p>';
      requestLayout();
      return '<p class="view-loading">Loading the SA103S…</p>';
    }
    var f = layout.forms.sa103s;
    return helpers.form.render(
      f.form + ", Self-employment (short) " + f.year,
      f.microcopy,
      renderSections(snapshot, helpers, helpers.form, f),
    );
  }

  global.DiyaGlTaxiForms = { renderSa103s: renderSa103s, DERIVED_NAMES: DERIVED_NAMES };
})(typeof window !== "undefined" ? window : globalThis);
