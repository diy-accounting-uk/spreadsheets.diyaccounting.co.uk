// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/products/bst-forms.js
//
// The BST SA103S view, rendered from app/data/hmrc/form-layouts/bst.json
// through the shell's form builders. products/bst.js registers the sa103s
// view id against renderSa103s; it does not call this file directly, so
// load order against the manifest does not matter.
//
// The layout carries the 2026 form's own box numbers. The workbook's SE
// Short sheet prints its own numbers, one behind the form's from turnover
// on, so a box names the sheet cell rather than the sheet's number.
//
// Boxes 11 to 15 are SE Short's own detailed-expense cells. Boxes 16 to 19
// read the Profit & Loss Account instead, because the matching SE Short
// cells (O46, O51, O55, O60) carry no CELL_MAP row and no calculator value
// -- the sheet's own IF() blanks all nine cells below £30,000 turnover, so
// boxes 16 to 19 are held back the same way box 11's own cell (D46) is.
// Box 20's SE Short cell (O64) carries no such gate at all, so its derived
// figure prints regardless of turnover.

(function (global) {
  "use strict";

  var LAYOUT_PATH = "assets/data/hmrc/form-layouts/bst.json";
  var SA103S_SHEET = "SE Short";
  var PL_SHEET = "Profit & Loss Acc";

  // The nine boxes the sheet's own £30,000 gate blanks together; box 11's
  // cell (D46) stands in for the gate itself, since it shares the exact
  // same condition ('Profit & Loss Acc'!C4<30000) as boxes 12 to 19.
  var GATE_CELL = "D46";
  var GATED_BOXES = { 16: 1, 17: 1, 18: 1, 19: 1 };

  // The P&L row each cell a "sum:" rule names is called by on the form's
  // own terms, for the parts line under the box that adds them together.
  var SUM_PART_LABELS = {
    C6: "cost of sales",
    C7: "direct costs",
    C17: "advertising",
    C19: "bad debts",
    C21: "other expenses",
    C22: "total expenses",
  };

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
        if (!response.ok) throw new Error('bst-forms.js: "' + LAYOUT_PATH + '" returned ' + response.status);
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

  // The shell's own form-row markup, with one slot helpers.form.row has
  // none for: a parts line inside the label, for the "sum:" boxes.
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
      "</div>"
    );
  }

  // "cost of sales £x · direct costs £y" under a box's label, each figure
  // in a keyed span of its own so a drift mark replaces the figure and
  // leaves the word in front of it standing.
  function partsLine(snapshot, helpers, cells) {
    return (
      '<span class="box-parts">' +
      cells
        .map(function (cell) {
          return (
            '<span class="box-part">' +
            helpers.esc(SUM_PART_LABELS[cell]) +
            " <span" +
            keyed(snapshot, helpers, PL_SHEET, cell) +
            ">" +
            helpers.esc(helpers.fmtMoney(v(snapshot, PL_SHEET, cell))) +
            "</span></span>"
          );
        })
        .join(" &middot; ") +
      "</span>"
    );
  }

  // ============================== the derived boxes ==============================

  // A box the layout gives a derived rule: what it prints, the key it
  // carries and the parts line under its label. A null value prints an
  // empty box with no key.
  function resolveDerived(snapshot, helpers, rule) {
    if (rule.indexOf("pl:") === 0) {
      var cell = rule.slice(3);
      return { value: v(snapshot, PL_SHEET, cell), rKeyAttr: keyed(snapshot, helpers, PL_SHEET, cell) };
    }
    if (rule.indexOf("sum:") === 0) {
      var cells = rule.slice(4).split(",");
      var total = 0;
      for (var i = 0; i < cells.length; i++) total += v(snapshot, PL_SHEET, cells[i]);
      return { value: total, partsHtml: partsLine(snapshot, helpers, cells) };
    }
    throw new Error('bst-forms.js: unknown derived rule "' + rule + '"');
  }

  // ============================== the render ==============================

  // One box as it prints: a cell box reads the snapshot and keys to it, a
  // derived box goes through resolveDerived unless the sheet's own £30,000
  // gate holds it back, and a box with neither prints present and empty,
  // the paper form's own "leave it blank".
  function renderBox(snapshot, helpers, sheet, box) {
    var resolved = { value: null };
    if (box.cell && present(snapshot, sheet, box.cell)) {
      resolved = { value: v(snapshot, sheet, box.cell), rKeyAttr: keyed(snapshot, helpers, sheet, box.cell) };
    } else if (box.derived && !(GATED_BOXES[box.box] && !present(snapshot, sheet, GATE_CELL))) {
      resolved = resolveDerived(snapshot, helpers, box.derived);
    }
    return boxRow({
      box: helpers.esc(box.box),
      label: helpers.esc(box.label),
      amount: resolved.value === null ? "" : helpers.fmtBoxWhole(resolved.value),
      rKeyAttr: resolved.value === null ? "" : resolved.rKeyAttr,
      total: !!box.total,
      partsHtml: resolved.partsHtml,
    });
  }

  function renderSections(snapshot, helpers, form, layoutForm) {
    return layoutForm.sections
      .map(function (section) {
        var rows = section.boxes
          .map(function (box) {
            return renderBox(snapshot, helpers, layoutForm.sheet, box);
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

  global.DiyaGlBstForms = { renderSa103s: renderSa103s };
})(typeof window !== "undefined" ? window : globalThis);
