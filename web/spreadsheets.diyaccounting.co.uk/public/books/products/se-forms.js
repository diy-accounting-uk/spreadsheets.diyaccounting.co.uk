// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/products/se-forms.js
//
// The four SE tax-form views -- SA103S, SA103F, the VAT return and the
// Income Tax computation -- rendered from a layout module keyed by each
// form's own box number (app/data/hmrc/form-layouts/se.json), through the
// shell's form builders (shell.js's `helpers.form`). books/products/se.js
// registers the four view ids against the functions this file exposes on
// window.DiyaGlSeForms; it does not call them directly, so load order
// against se.js does not matter.
//
// A box's "cell" is a full report-key reference, "<file>!<sheet>!<cell>",
// the same shape the Ltd form layout uses: it names the sheet however the
// engine's results object keys it (a hub sheet bare, e.g.
// "Financialaccounts.xlsx!SE Short!D38"; a leaf sheet under its file, e.g.
// "Fixedassets.xlsx!Schedule!K1"), so one splitter works for every box
// regardless of which of the nine workbooks it reads. A box with no cell in
// this template carries "cell": null and renders present and empty, exactly
// as the paper form's own "if a box does not apply, leave it blank" rule.

(function (global) {
  "use strict";

  var HUB_FILE = "Financialaccounts.xlsx";
  var LAYOUT_PATH = "assets/data/hmrc/form-layouts/se.json";

  var layout = null;
  var layoutFailed = null;
  fetch(LAYOUT_PATH)
    .then(function (response) {
      if (!response.ok) throw new Error('se-forms.js: "' + LAYOUT_PATH + '" returned ' + response.status);
      return response.json();
    })
    .then(function (json) {
      layout = json;
      // The fetch is already in flight before the page's first paint; a
      // reader who has switched to one of these views before it resolves
      // gets one re-render once the layout arrives, through the same
      // render() the topbar and every commit already use.
      if (global.DiyaGlBooksPage && global.DiyaGlBooksPage.helpers) global.DiyaGlBooksPage.helpers.render();
    })
    .catch(function (err) {
      layoutFailed = err;
      if (global.console && global.console.error) global.console.error(err);
    });

  // ============================== reading a box's cell ==============================

  // "<file>!<sheet>!<cell>" split at the last "!", the way
  // report-serializer.js's referenceKey() reads the same shape server-side.
  function splitRef(ref) {
    var idx = ref.lastIndexOf("!");
    return [ref.slice(0, idx), ref.slice(idx + 1)];
  }

  // The engine's results object keys a hub sheet by its bare name and a leaf
  // sheet by "<file>!<sheet>"; a box's own reference always carries the hub
  // file, so a hub cell's prefix is stripped back off to reach that key.
  function resultsKeyFor(sheetPart) {
    var prefix = HUB_FILE + "!";
    return sheetPart.indexOf(prefix) === 0 ? sheetPart.slice(prefix.length) : sheetPart;
  }

  function rawValue(ctx, ref) {
    if (!ref) return undefined;
    var parts = splitRef(ref);
    var sheetResults = ctx.results[resultsKeyFor(parts[0])];
    return sheetResults ? sheetResults[parts[1]] : undefined;
  }

  // Every data-r-key on the page must resolve to a real R entry, and R
  // carries no entry for a blank cell (report-serializer.js's
  // canonicalValue() maps "", " ", "-" and "—" to null and
  // collectCellEntries() drops a null). So a blank-valued box gets no key,
  // the same as a box with no cell at all.
  function isBlank(v) {
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  }

  function keyAttrFor(helpers, ref) {
    var parts = splitRef(ref);
    return helpers.rk(helpers.cellKey(parts[0], parts[1]));
  }

  // What one box prints: the amount (already formatted, "" for a blank
  // box) and the data-r-key attribute string ("" where none applies).
  function resolveBox(ctx, helpers, ref, formatFn) {
    if (!ref) return { amount: "", rKeyAttr: "" };
    var value = rawValue(ctx, ref);
    if (isBlank(value)) return { amount: "", rKeyAttr: "" };
    return { amount: formatFn(value), rKeyAttr: keyAttrFor(helpers, ref) };
  }

  function wholeAmount(ctx, helpers, ref) {
    return resolveBox(ctx, helpers, ref, helpers.fmtBoxWhole);
  }

  // ============================== rules (sum / deduct over sibling boxes) ==============================

  // A rule's own numeric value, read straight off the referenced cells with
  // no rounding of its own (the box that reads it applies fmtBoxWhole once,
  // the same as any other box). "#N" names a sibling box in the same
  // section by number rather than a template cell, for a total that is
  // itself built from other totals (box 94 is box 90 less box 91, and box
  // 90 does not sit on the template as a cell of its own).
  function ruleValue(ctx, boxesByNumber, rule) {
    function amountOf(ref) {
      if (ref.charAt(0) === "#") {
        var sibling = boxesByNumber[ref.slice(1)];
        return sibling ? boxAmountValue(ctx, boxesByNumber, sibling) : 0;
      }
      var v = rawValue(ctx, ref);
      return isBlank(v) || typeof v !== "number" ? 0 : v;
    }
    var amounts = rule.cells.map(amountOf);
    function sum(list) {
      var total = 0;
      for (var i = 0; i < list.length; i++) total += list[i];
      return total;
    }
    if (rule.op === "sum") return sum(amounts);
    if (rule.op === "deduct") return amounts.length ? amounts[0] - sum(amounts.slice(1)) : 0;
    throw new Error('se-forms.js: unknown rule op "' + rule.op + '"');
  }

  // A box's resolved amount as a plain number, whether it comes from a
  // template cell or a rule -- the one thing ruleValue() and the render
  // path both need, so a rule referencing another rule resolves the same
  // way a rule referencing a cell does.
  function boxAmountValue(ctx, boxesByNumber, box) {
    if (box.rule) return ruleValue(ctx, boxesByNumber, box.rule);
    var v = rawValue(ctx, box.cell);
    return isBlank(v) || typeof v !== "number" ? 0 : v;
  }

  function boxesByNumberOf(section) {
    var out = {};
    section.boxes.forEach(function (b) {
      out[b.box] = b;
    });
    return out;
  }

  // ============================== SA103S / SA103F row rendering ==============================

  // Every box in a section as one form.row(): a rule box always has a
  // figure (there is nothing to leave blank once its inputs are read), a
  // cell box reads resolveBox, and a box with neither prints present and
  // empty -- the form's own "Not in use" wording where notInUse says so.
  function renderBoxRow(ctx, helpers, form, boxesByNumber, box) {
    if (box.rule) {
      var amount = ruleValue(ctx, boxesByNumber, box.rule);
      return form.row({
        box: box.box,
        label: box.label,
        amount: helpers.fmtBoxWhole(amount),
        rKeyAttr: "",
        total: !!box.total,
        wholePounds: true,
      });
    }
    var resolved = wholeAmount(ctx, helpers, box.cell);
    return form.row({
      box: box.box,
      label: box.label,
      amount: resolved.amount,
      rKeyAttr: resolved.rKeyAttr,
      total: !!box.total,
      wholePounds: true,
    });
  }

  // The "Allowable business expenses" / "Business expenses" section: boxes
  // 11 to 19 (SA103S) print individually unless the section names
  // collapseBelow and the reader's turnover sits under the threshold cell,
  // in which case only the section's own total box prints -- the form's
  // "you may just put your total expenses in [the total box], rather than
  // filling in the whole section" permission, applied the way the sheet
  // itself already computes it (the detail boxes cache blank text once the
  // gate fails, the total box does not).
  function sectionBoxes(ctx, section) {
    if (!section.collapseBelow) return section.boxes;
    var turnover = rawValue(ctx, section.collapseTurnover);
    var threshold = rawValue(ctx, section.collapseBelow);
    if (typeof turnover !== "number" || typeof threshold !== "number" || turnover >= threshold) return section.boxes;
    return section.boxes.filter(function (b) {
      return b.total;
    });
  }

  function renderSections(ctx, helpers, form, sections) {
    return sections
      .map(function (section) {
        var boxesByNumber = boxesByNumberOf(section);
        var rows = sectionBoxes(ctx, section)
          .map(function (box) {
            return renderBoxRow(ctx, helpers, form, boxesByNumber, box);
          })
          .join("");
        return form.section(section.heading, rows);
      })
      .join("");
  }

  function loadingForm(name) {
    return (
      "<h2>" + name + '</h2><p class="entries-note">' + (layoutFailed ? "The form layout failed to load." : "Loading the form…") + "</p>"
    );
  }

  function renderSa103s(snap, state, helpers) {
    if (!layout) return loadingForm("SA103S");
    var f = layout.forms.sa103s;
    var form = helpers.form;
    return (
      "<h2>" +
      f.form +
      "</h2>" +
      form.render(f.form + " — Self-employment (short)", f.microcopy, renderSections(snap, helpers, form, f.sections))
    );
  }

  function renderSa103f(snap, state, helpers) {
    if (!layout) return loadingForm("SA103F");
    var f = layout.forms.sa103f;
    var form = helpers.form;
    return (
      "<h2>" +
      f.form +
      "</h2>" +
      form.render(f.form + " — Self-employment (full)", f.microcopy, renderSections(snap, helpers, form, f.sections))
    );
  }

  // ============================== VAT ==============================

  // One quarter's boxes: the block names its file and sheet prefix once
  // (Ltd's own vat block does the same), so each box carries only the bare
  // cell and the quarter number builds the sheet name here.
  function vatRef(v, quarter, cell) {
    return v.file + "!" + v.sheetPrefix + quarter + "!" + cell;
  }

  var EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
  var MS_PER_DAY = 86400000;
  function excelDate(serial) {
    return new Date(EXCEL_EPOCH_MS + serial * MS_PER_DAY).toISOString().slice(0, 10);
  }

  function renderVatQuarter(snap, helpers, form, v, quarter) {
    var periodValue = rawValue(snap, vatRef(v, quarter, v.period));
    var periodText = typeof periodValue === "number" ? excelDate(periodValue) : "";
    var heading = "Quarter " + quarter + (periodText ? ", period ending " + periodText : "");
    if (quarter === Math.max.apply(null, v.quarters)) heading += " (" + v.fifthQuarterNote + ")";
    var rows = v.boxes
      .map(function (box) {
        if (!box.cell) {
          return form.row({
            box: box.box,
            label: box.label + (box.note ? " (" + box.note + ")" : ""),
            amount: "",
            rKeyAttr: "",
            total: !!box.total,
            wholePounds: true,
          });
        }
        var resolved = wholeAmount(snap, helpers, vatRef(v, quarter, box.cell));
        return form.row({
          box: box.box,
          label: box.label,
          amount: resolved.amount,
          rKeyAttr: resolved.rKeyAttr,
          total: !!box.total,
          wholePounds: true,
        });
      })
      .join("");
    return form.render(heading, v.notice, form.section("", rows));
  }

  function renderVat(snap, state, helpers) {
    if (!layout) return loadingForm("VAT return");
    var v = layout.forms.vat;
    var form = helpers.form;
    return (
      "<h2>VAT return</h2>" +
      v.quarters
        .map(function (quarter) {
          return renderVatQuarter(snap, helpers, form, v, quarter);
        })
        .join("")
    );
  }

  // ============================== Income Tax computation ==============================

  function renderComputationLine(ctx, helpers, form, line) {
    if (line.ref === "band") {
      var rate = rawValue(ctx, line.rateCell);
      var ceiling = line.ceilingCell ? rawValue(ctx, line.ceilingCell) : null;
      var tax = wholeAmount(ctx, helpers, line.cell);
      return form.rateRow({
        label: line.label,
        ceiling: typeof ceiling === "number" ? helpers.fmtWhole(ceiling) : null,
        ceilingRKeyAttr: line.ceilingCell && typeof ceiling === "number" ? keyAttrFor(helpers, line.ceilingCell) : "",
        rate: typeof rate === "number" ? helpers.fmtRate(rate) : "",
        rateRKeyAttr: typeof rate === "number" ? keyAttrFor(helpers, line.rateCell) : "",
        amount: tax.amount,
        rKeyAttr: tax.rKeyAttr,
      });
    }
    if (!line.cell) {
      return form.row({ box: line.ref, label: line.label, amount: line.text || "", rKeyAttr: "", total: false });
    }
    var resolved = wholeAmount(ctx, helpers, line.cell);
    return form.row({ box: line.ref, label: line.label, amount: resolved.amount, rKeyAttr: resolved.rKeyAttr, total: !!line.total });
  }

  function renderComputation(snap, state, helpers) {
    if (!layout) return loadingForm("Income Tax computation");
    var c = layout.forms.computation;
    var form = helpers.form;
    var rows = c.lines
      .map(function (line) {
        return renderComputationLine(snap, helpers, form, line);
      })
      .join("");
    return "<h2>Income Tax computation</h2>" + form.render("Income Tax computation", c.microcopy, form.section("", rows));
  }

  global.DiyaGlSeForms = {
    renderSa103s: renderSa103s,
    renderSa103f: renderSa103f,
    renderVat: renderVat,
    renderComputation: renderComputation,
  };
})(typeof window !== "undefined" ? window : globalThis);
