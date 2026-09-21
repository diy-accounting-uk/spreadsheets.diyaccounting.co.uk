// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// books/products/ltd-forms.js
//
// The six Limited Company form views -- Accounts, Corporation tax
// computation, CT600, VAT returns, Payroll and Company -- rendered through
// the shell's form builders (helpers.form). products/ltd.js registers the
// six view ids against the functions this file exposes on
// window.DiyaGlLtdForms; it does not call them directly, so load order
// against ltd.js does not matter.
//
// The first four read app/data/hmrc/form-layouts/ltd.json, which carries
// order, source and rules only: a row names its filing row instead of
// repeating it, as "box" (a CT600 Version 3 box number), "line" (a line of
// HMRC's prescribed computation format) or "heading" (an FRS 105 format
// heading), and the label, the format and the sheet cell come from the
// filing TOML the layout points at. A row with none of the three carries
// its own label, format and cell. Where a figure needs more than one cell
// the row carries a rule instead, and every rule says why in plain words.
//
// A cell is a full report-key reference, "<file>!<sheet>!<cell>", the same
// shape the filing TOMLs and the SE layout use, so one splitter reaches a
// hub sheet and a leaf sheet alike. A box with no cell renders present and
// empty, exactly as the paper form's own "if a box does not apply, leave it
// blank" rule.
//
// Payroll and Company render from R and the book with no layout of their
// own: the PAYE schedule and the wages split are sheet reads, the people,
// the members and the dividend voucher are book fields.

(function (global) {
  "use strict";

  var S = global.DiyaGlLtdShared;

  var HUB_FILE = "Financialaccounts.xlsx";
  var ASSET_ROOT = "assets/data/";
  var LAYOUT_PATH = ASSET_ROOT + "hmrc/form-layouts/ltd.json";
  var FILING_PATHS = {
    ct600: ASSET_ROOT + "filing/ct600-v3.toml",
    computation: ASSET_ROOT + "filing/ct-computation-v1.1.toml",
    accounts: ASSET_ROOT + "filing/frs105-formats.toml",
  };

  var layout = null;
  var filing = null;
  var loadFailed = null;

  // ============================== the filing data ==============================

  // The three filing files are flat: a run of [[box]] / [[line]] / [[heading]]
  // tables whose every value is a quoted string or a bare number, with no
  // arrays, no nesting and no multi-line strings. That is all this reads;
  // anything richer belongs in a real parser, and these files are generated,
  // not hand-typed.
  function readFilingTables(text, tableName) {
    var open = "[[" + tableName + "]]";
    var records = [];
    var current = null;
    text.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (line === open) {
        current = {};
        records.push(current);
        return;
      }
      if (line.charAt(0) === "#" || line === "") return;
      if (line.charAt(0) === "[") {
        current = null;
        return;
      }
      if (!current) return;
      var eq = line.indexOf(" = ");
      if (eq === -1) return;
      var key = line.slice(0, eq);
      var value = line.slice(eq + 3);
      if (value.charAt(0) === '"') current[key] = value.slice(1, -1);
      else if (value === "true" || value === "false") current[key] = value === "true";
      else current[key] = Number(value);
    });
    return records;
  }

  // A computation line's key is "<section>.<part>/<label>", unique across
  // the format; a heading's is "<statement>/<format or ->/<letter>". Both
  // split at the first slash, because a label may hold slashes of its own
  // ("Profit/(loss) before tax per statutory accounts").
  function indexFiling(ct600Text, computationText, accountsText) {
    var byBox = {};
    readFilingTables(ct600Text, "box").forEach(function (box) {
      byBox[box.number] = box;
    });
    var byLine = {};
    readFilingTables(computationText, "line").forEach(function (line) {
      byLine[line.section + "." + line.part + "/" + line.label] = line;
    });
    var byHeading = {};
    readFilingTables(accountsText, "heading").forEach(function (heading) {
      byHeading[heading.statement + "/" + (heading.format === undefined ? "-" : heading.format) + "/" + heading.letter] = heading;
    });
    return { box: byBox, line: byLine, heading: byHeading };
  }

  function fetchText(path) {
    return fetch(path).then(function (response) {
      if (!response.ok) throw new Error('ltd-forms.js: "' + path + '" returned ' + response.status);
      return response.text();
    });
  }

  Promise.all([
    fetchText(LAYOUT_PATH),
    fetchText(FILING_PATHS.ct600),
    fetchText(FILING_PATHS.computation),
    fetchText(FILING_PATHS.accounts),
  ])
    .then(function (texts) {
      layout = JSON.parse(texts[0]);
      filing = indexFiling(texts[1], texts[2], texts[3]);
      // The fetches are in flight before the page's first paint; a reader
      // who reached one of these views first gets one re-render once they
      // land, through the same render() every commit already uses.
      if (global.DiyaGlPage && global.DiyaGlPage.helpers && global.document.body.classList.contains("is-loaded")) {
        global.DiyaGlPage.helpers.render();
      }
    })
    .catch(function (err) {
      loadFailed = err;
      if (global.console && global.console.error) global.console.error(err);
    });

  // ============================== reading a cell ==============================

  function splitRef(ref) {
    var idx = ref.lastIndexOf("!");
    return [ref.slice(0, idx), ref.slice(idx + 1)];
  }

  // The engine keys a hub sheet by its bare name and a leaf sheet by
  // "<file>!<sheet>"; a reference always carries the hub file, so a hub
  // cell's prefix comes back off to reach that key.
  function resultsKeyFor(sheetPart) {
    var prefix = HUB_FILE + "!";
    return sheetPart.indexOf(prefix) === 0 ? sheetPart.slice(prefix.length) : sheetPart;
  }

  function rawValue(snap, ref) {
    if (!ref) return undefined;
    var parts = splitRef(ref);
    var sheetResults = snap.results[resultsKeyFor(parts[0])];
    return sheetResults ? sheetResults[parts[1]] : undefined;
  }

  // R carries no entry for a blank cell (report-serializer.js maps "", " ",
  // "-" and an em dash to null and drops it), so a blank-valued box gets no
  // key, the same as a box with no cell at all.
  function isBlank(value) {
    return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
  }

  function numberOf(value) {
    return typeof value === "number" ? value : 0;
  }

  var R_KEY_SEP = " || ";

  function unescapeAttr(text) {
    return text
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  // The keys one cell carries: its own, and the section key CELL_MAP gives
  // the report row that reprints it. rkFor pairs them and hands back a
  // finished attribute, so the keys come back out of it rather than being
  // rebuilt -- a sheet name holding an ampersand ("MnthP&L") must not be
  // escaped twice.
  function keysFor(helpers, ref) {
    var parts = splitRef(ref);
    var attr = helpers.rkFor(resultsKeyFor(parts[0]), parts[1]);
    if (!attr) return [helpers.cellKey(parts[0], parts[1])];
    return unescapeAttr(attr.slice(' data-r-key="'.length, -1)).split(R_KEY_SEP);
  }

  function keyAttrFor(helpers, ref) {
    return helpers.rk.apply(null, keysFor(helpers, ref));
  }

  // A figure built from several cells names all of them, so the drift walker
  // marks the row when any input has moved. A cell reading blank is left out:
  // R carries no entry for it, the same as for a box with no cell at all.
  function keyAttrForAll(snap, helpers, refs) {
    var keys = [];
    refs.forEach(function (ref) {
      if (isBlank(rawValue(snap, ref))) return;
      keys = keys.concat(keysFor(helpers, ref));
    });
    return helpers.rk.apply(null, keys);
  }

  // ============================== rules ==============================

  // A rule's cell may be wrapped: positivePartOf(<ref>) is the cell where it
  // sits above nil and nothing where it sits below, negativePartOf(<ref>) the
  // other way round as a positive figure. The working sheet's disposals line
  // is signed -- above nil a balancing allowance, below nil a balancing
  // charge -- and the form has a box for each.
  var PART_WRAPPERS = ["positivePartOf", "negativePartOf"];

  function unwrapRef(ref) {
    for (var i = 0; i < PART_WRAPPERS.length; i++) {
      var open = PART_WRAPPERS[i] + "(";
      if (ref.indexOf(open) === 0) return { part: PART_WRAPPERS[i], ref: ref.slice(open.length, -1) };
    }
    return { part: null, ref: ref };
  }

  function partOf(part, value) {
    if (part === "positivePartOf") return Math.max(0, value);
    if (part === "negativePartOf") return Math.max(0, -value);
    return value;
  }

  function ruleCells(rule) {
    if (rule.cells)
      return rule.cells.map(function (ref) {
        return unwrapRef(ref).ref;
      });
    if (rule.tests) {
      var refs = [];
      rule.tests.forEach(function (test) {
        refs.push(test.cell);
        if (test.against) refs.push(test.against);
      });
      return refs;
    }
    return [];
  }

  function ruleValue(snap, rule) {
    if (rule.op === "fixed") return rule.value;
    var amounts = (rule.cells || []).map(function (ref) {
      var unwrapped = unwrapRef(ref);
      return partOf(unwrapped.part, numberOf(rawValue(snap, unwrapped.ref)));
    });
    function total(list) {
      var sum = 0;
      for (var i = 0; i < list.length; i++) sum += list[i];
      return sum;
    }
    if (rule.op === "sum") return total(amounts);
    if (rule.op === "deduct") return amounts.length ? amounts[0] - total(amounts.slice(1)) : 0;
    if (rule.op === "negate") return -amounts[0];
    if (rule.op === "positiveDifference") return Math.max(0, amounts[0] - amounts[1]);
    if (rule.op === "tickIfAny") {
      var ticked = rule.tests.some(function (test) {
        var value = rawValue(snap, test.cell);
        if (typeof value !== "number") return false;
        if (test.test === "gt0") return value > 0;
        if (test.test === "lt") return value < numberOf(rawValue(snap, test.against));
        throw new Error('ltd-forms.js: unknown tick test "' + test.test + '"');
      });
      return ticked ? "X" : "";
    }
    throw new Error('ltd-forms.js: unknown rule op "' + rule.op + '"');
  }

  // ============================== formatting ==============================

  var EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
  var MS_PER_DAY = 86400000;

  function excelDate(serial) {
    return new Date(EXCEL_EPOCH_MS + serial * MS_PER_DAY).toISOString().slice(0, 10);
  }

  var MONEY_FORMATS = { whole: 1, pence: 1 };

  function formatValue(value, format, helpers) {
    if (isBlank(value)) return "";
    if (format === "whole") return helpers.fmtBoxWhole(value);
    if (format === "money") return helpers.fmtMoney(value);
    if (format === "pence") return helpers.fmtBoxMoney(value);
    if (format === "rate") return typeof value === "number" ? helpers.fmtRate(value) : helpers.esc(String(value));
    // The sheet's tax-rate cells hold whole percents (Admin!P6 is 19, not
    // 0.19), so a percent box prints the figure the sheet holds with a sign
    // after it rather than multiplying by a hundred.
    if (format === "percent") return typeof value === "number" ? String(Math.round(value * 100) / 100) + "%" : helpers.esc(String(value));
    if (format === "year") return typeof value === "number" ? String(Math.round(value)) : helpers.esc(String(value));
    if (format === "date") return typeof value === "number" ? helpers.esc(excelDate(value)) : helpers.esc(String(value));
    if (format === "count") return typeof value === "number" ? value.toLocaleString("en-GB") : helpers.esc(String(value));
    if (format === "tick") return value ? "X" : "";
    return helpers.esc(String(value));
  }

  // ============================== one row of a form ==============================

  // A row's filing row comes from the file its own form names, so the VAT
  // block -- whose boxes are the nine of the VAT return and name no filing
  // file -- never reads a CT600 box of the same number.
  function filingRowFor(row, form) {
    if (!filing || !form.source) return null;
    if (form.source === "ct600" && row.box !== undefined) return filing.box[row.box] || null;
    if (form.source === "computation" && row.line !== undefined) return filing.line[row.line] || null;
    if (form.source === "accounts" && row.heading !== undefined) return filing.heading[row.heading] || null;
    return null;
  }

  function bookValueAt(book, path) {
    var value = book;
    path.split(".").forEach(function (part) {
      value = value === undefined || value === null ? undefined : value[part];
    });
    return value;
  }

  // What one row prints: the chip, the label, the formatted figure, the
  // data-r-key attribute where the figure is a cell R carries, and the row's
  // own note. A rule's figure names every cell behind it; a fixed rule and a
  // book field name none, because neither is an R key.
  function resolveRow(snap, helpers, form, row) {
    var filingRow = filingRowFor(row, form);
    var label = row.label || (filingRow && filingRow.label) || "";
    var format = row.format || (filingRow && layout.formats[filingRow.format]) || form.defaultFormat || "pence";
    var resolved = {
      chip: row.box !== undefined ? String(row.box) : row.heading !== undefined ? row.heading.split("/").pop() : "",
      label: label,
      format: format,
      amount: "",
      rKeyAttr: "",
      total: !!row.total,
      note: row.note || "",
      xbrl: filingRow && filingRow.xbrl ? filingRow.xbrl : "",
      ct600Box: row.ct600Box === undefined ? "" : String(row.ct600Box),
    };
    if (row.empty) return resolved;
    if (row.from === "book") {
      var bookValue = bookValueAt(snap.book, row.path);
      resolved.amount = formatValue(bookValue, format, helpers);
      return resolved;
    }
    if (row.rule) {
      resolved.amount = formatValue(ruleValue(snap, row.rule), row.rule.op === "tickIfAny" ? "tick" : format, helpers);
      if (row.rule.op !== "fixed") resolved.rKeyAttr = keyAttrForAll(snap, helpers, ruleCells(row.rule));
      return resolved;
    }
    var ref = row.cell || (filingRow && filingRow.sheetCell) || null;
    if (!ref || ref.indexOf("+") !== -1) return resolved;
    var value = rawValue(snap, ref);
    if (isBlank(value)) return resolved;
    resolved.amount = formatValue(value, format, helpers);
    resolved.rKeyAttr = keyAttrFor(helpers, ref);
    return resolved;
  }

  // A money box goes through the shell's own form.row so the drift walker
  // finds it and drops its correction in the row's margin. A box holding a
  // year, a rate, a date or a name keeps the same classes -- so the same
  // margin rule applies -- but drops the pound sign the shared box prints,
  // which ltd.css does through .form-box-plain.
  function rowHtml(helpers, resolved) {
    var attrs =
      (resolved.xbrl ? ' data-xbrl="' + helpers.esc(resolved.xbrl) + '"' : "") +
      (resolved.ct600Box ? ' data-ct600-box="' + helpers.esc(resolved.ct600Box) + '"' : "");
    if (MONEY_FORMATS[resolved.format]) {
      var built = helpers.form.row({
        box: resolved.chip,
        label: resolved.label,
        amount: resolved.amount,
        rKeyAttr: resolved.rKeyAttr,
        total: resolved.total,
        wholePounds: resolved.format === "whole",
      });
      return attrs ? built.replace('<div class="form-row', "<div" + attrs + ' class="form-row') : built;
    }
    return (
      "<div" +
      attrs +
      ' class="form-row' +
      (resolved.total ? " total-row" : "") +
      '">' +
      (resolved.chip ? '<span class="box-chip">' + helpers.esc(resolved.chip) + "</span>" : "") +
      '<span class="form-row-label">' +
      helpers.esc(resolved.label) +
      '</span><span class="form-amount-box form-box-plain"' +
      resolved.rKeyAttr +
      ">" +
      resolved.amount +
      "</span></div>"
    );
  }

  function noteHtml(helpers, note) {
    return note ? '<p class="form-row-note">' + helpers.esc(note) + "</p>" : "";
  }

  // The financial-year rows, and the accounts' two-year rows, as a captioned
  // group with one .form-row per figure. applyDriftMarks fills the first
  // margin it finds in a .form-row, so a row never holds two amount boxes
  // and every box keeps a margin of its own.
  function groupHtml(snap, helpers, form, group) {
    var blank = group.blankWhen && numberOf(rawValue(snap, group.blankWhen)) === 0;
    var rows = group.rows
      .map(function (row) {
        var resolved = resolveRow(snap, helpers, form, blank ? Object.assign({}, row, { empty: true }) : row);
        return rowHtml(helpers, resolved) + noteHtml(helpers, resolved.note);
      })
      .join("");
    return (
      '<div class="fy-group"><p class="fy-caption">' +
      helpers.esc(group.caption) +
      "</p>" +
      rows +
      "</div>" +
      (blank && group.blankNote ? noteHtml(helpers, group.blankNote) : "")
    );
  }

  function sectionHtml(snap, helpers, form, section) {
    if (section.statements) {
      var book = snap.book;
      var director = (book.directors && book.directors[0] && book.directors[0].name) || "the director";
      var text = section.statements
        .map(function (statement) {
          var filled = statement.replace("{periodEnd}", snap.period.end).replace("{directorName}", director);
          return '<p class="form-statement">' + helpers.esc(filled) + "</p>";
        })
        .join("");
      return helpers.form.section(section.heading, text);
    }
    var rows = section.rows
      .map(function (row) {
        if (row.group) return groupHtml(snap, helpers, form, row);
        var resolved = resolveRow(snap, helpers, form, row);
        var html = section.twoYear && row.priorCell ? twoYearHtml(snap, helpers, row, resolved) : rowHtml(helpers, resolved);
        return html + noteHtml(helpers, resolved.note);
      })
      .join("");
    return helpers.form.section(section.heading, noteHtml(helpers, section.note) + rows + noteHtml(helpers, section.priorYearNote));
  }

  // A heading with a comparative: this year and last year as two rows under
  // one caption, so each figure keeps its own margin and the pair stacks at
  // mobile portrait the way the financial-year groups do.
  function twoYearHtml(snap, helpers, row, thisYear) {
    var priorValue = rawValue(snap, row.priorCell);
    var prior = {
      chip: "",
      label: "Last year",
      format: thisYear.format,
      amount: isBlank(priorValue) ? "" : formatValue(priorValue, thisYear.format, helpers),
      rKeyAttr: isBlank(priorValue) ? "" : keyAttrFor(helpers, row.priorCell),
      total: false,
      xbrl: "",
      ct600Box: "",
    };
    return (
      '<div class="fy-group"><p class="fy-caption">' +
      (thisYear.chip ? '<span class="box-chip">' + helpers.esc(thisYear.chip) + "</span> " : "") +
      helpers.esc(thisYear.label) +
      "</p>" +
      rowHtml(helpers, Object.assign({}, thisYear, { chip: "", label: "This year" })) +
      rowHtml(helpers, prior) +
      "</div>"
    );
  }

  function loadingPanel(name) {
    return (
      "<h2>" + name + '</h2><p class="entries-note">' + (loadFailed ? "The form layout failed to load." : "Loading the form…") + "</p>"
    );
  }

  function renderForm(snap, helpers, form) {
    return helpers.form.render(
      form.title,
      form.microcopy,
      form.sections
        .map(function (section) {
          return sectionHtml(snap, helpers, form, section);
        })
        .join(""),
    );
  }

  // ============================== sheet tables ==============================

  function cellText(snap, helpers, sheet, cell, format) {
    var value = (snap.results[sheet] || {})[cell];
    return formatValue(value, format, helpers) || "—";
  }

  function cellCell(snap, helpers, sheet, cell, format, className) {
    var value = (snap.results[sheet] || {})[cell];
    var ref = (sheet.indexOf("!") === -1 ? HUB_FILE + "!" + sheet : sheet) + "!" + cell;
    var attr = isBlank(value) ? "" : keyAttrFor(helpers, ref);
    return "<td" + (className ? ' class="' + className + '"' : "") + attr + ">" + (formatValue(value, format, helpers) || "—") + "</td>";
  }

  // ============================== accounts ==============================

  function sectionCardFromCellMap(snap, helpers, sectionName, title) {
    var productMod = snap.context.productMod;
    var rows = productMod.CELL_MAP.filter(function (entry) {
      return entry[4] === sectionName;
    }).map(function (entry) {
      return {
        label: S.labelFor(productMod, entry[0], entry[1], entry[0] + "!" + entry[1]),
        text: S.formatByUnit(S.cellValue(snap.results, entry[0], entry[1]), S.unitOf(productMod, entry[0], entry[1]), helpers),
        rKeyAttr: S.cellRk(snap, helpers, entry[0], entry[1]),
      };
    });
    return '<div class="panel-card"><h3>' + helpers.esc(title) + "</h3>" + helpers.kvRows(rows) + "</div>";
  }

  function renderAccounts(snap, state, helpers) {
    if (!layout) return loadingPanel("Accounts");
    return (
      "<h2>Accounts</h2>" +
      renderForm(snap, helpers, layout.forms.accounts) +
      '<p class="view-lede">A micro-entity files neither of the two below. The sheet produces both, so they render here for checking.</p>' +
      sectionCardFromCellMap(snap, helpers, "Directors' Report", "Directors' report") +
      sectionCardFromCellMap(snap, helpers, "Fixed Asset Note", "Notes to the accounts") +
      '<p class="view-lede">The FRS 105 form above files the aggregate lines only; the published balance sheet and P&L behind them, in full, render here for checking.</p>' +
      sectionCardFromCellMap(snap, helpers, "Published Balance Sheet", "Published balance sheet, in full") +
      sectionCardFromCellMap(snap, helpers, "Published P&L", "Published P&L, in full")
    );
  }

  // ============================== corporation tax and CT600 ==============================

  function renderComputation(snap, state, helpers) {
    if (!layout) return loadingPanel("Corporation tax computation");
    return (
      "<h2>Corporation tax</h2>" +
      renderForm(snap, helpers, layout.forms.computation) +
      '<p class="view-lede">The HMRC computation above restates the working sheet in the prescribed format; the working sheet itself, in its own order, renders here for checking.</p>' +
      sectionCardFromCellMap(snap, helpers, "Corporation Tax working sheet", "Working sheet")
    );
  }

  function renderCt600(snap, state, helpers) {
    if (!layout) return loadingPanel("CT600");
    return "<h2>CT600</h2>" + renderForm(snap, helpers, layout.forms.ct600);
  }

  // ============================== VAT returns ==============================

  function vatRef(vat, quarter, cell) {
    return vat.file + "!" + vat.sheetPrefix + quarter + "!" + cell;
  }

  function vatDateRow(snap, helpers, vat, quarter, cell, label) {
    var value = rawValue(snap, vatRef(vat, quarter, cell));
    if (typeof value !== "number") return "";
    return (
      '<div class="form-period-row"><span class="form-period-label">' +
      helpers.esc(label) +
      '</span><span class="form-period-date"' +
      keyAttrFor(helpers, vatRef(vat, quarter, cell)) +
      ">" +
      helpers.esc(excelDate(value)) +
      "</span></div>"
    );
  }

  // The interface row a quarter's own period end lands on, and whether that
  // quarter charges the flat rate. Both read the interface the same way
  // app/products/ltd.js's VAT section does.
  function vatinterfaceRowEnding(snap, vat, end) {
    var sheet = snap.results[vat.coverage.sheet];
    if (!sheet || !end) return null;
    for (var row = vat.coverage.firstRow; row <= vat.coverage.lastRow; row++) {
      var value = sheet[vat.coverage.endColumn + row];
      if (typeof value === "number" && Math.round(value) === Math.round(end)) return row;
    }
    return null;
  }

  function vatFlatRateAt(snap, vat, row) {
    var sheet = snap.results[vat.flatRate.sheet];
    if (!sheet || row === null) return 0;
    return numberOf(sheet[vat.flatRate.column + row]);
  }

  // Which months each return covers, and which month no return covers: the
  // same three-month window app/lib/report-generator.js's vatReturnCoverage
  // walks, rendered as prose above the forms.
  function vatCoverageHtml(snap, helpers, vat, quarterRows) {
    var sheet = snap.results[vat.coverage.sheet];
    if (!sheet) return "";
    var covered = {};
    var lines = [];
    vat.quarters.forEach(function (quarter) {
      var end = quarterRows[quarter];
      if (end === null) return;
      var months = [end - 2, end - 1, end].filter(function (row) {
        return row >= vat.coverage.firstRow && row <= vat.coverage.lastRow && typeof sheet[vat.coverage.endColumn + row] === "number";
      });
      months.forEach(function (row) {
        covered[row] = (covered[row] || 0) + 1;
      });
      lines.push(
        "<li>Quarter " +
          quarter +
          " covers the periods ending " +
          months
            .map(function (row) {
              return excelDate(sheet[vat.coverage.endColumn + row]);
            })
            .join(", ") +
          ".</li>",
      );
    });
    var missed = [];
    for (var row = vat.coverage.firstAccountingRow; row < vat.coverage.firstAccountingRow + 12; row++) {
      if (typeof sheet[vat.coverage.endColumn + row] === "number" && !covered[row])
        missed.push(excelDate(sheet[vat.coverage.endColumn + row]));
    }
    if (missed.length > 0) {
      lines.push(
        "<li>No return above covers the " +
          (missed.length === 1 ? "month" : "months") +
          " ending " +
          missed.join(", ") +
          ". That month sat on the previous return of the same cycle, which is why the quarters below fall short of the year's own VAT lines.</li>",
      );
    }
    if (lines.length === 0) return "";
    return '<div class="panel-card"><h3>What the five returns cover</h3><ul class="vat-coverage">' + lines.join("") + "</ul></div>";
  }

  function renderVatQuarter(snap, helpers, vat, quarter, flatRate) {
    var heading = "Quarter " + quarter;
    if (quarter === vat.quarters[vat.quarters.length - 1]) heading += " (" + vat.lastQuarterNote + ")";
    var dates =
      vatDateRow(snap, helpers, vat, quarter, vat.period.endCell, "Period ending") +
      vatDateRow(snap, helpers, vat, quarter, vat.period.dueCell, "Payment due by");
    var rows = vat.boxes
      .map(function (box) {
        var row = {
          box: box.box,
          label: flatRate > 0 && box.labelWhenFlatRate ? box.labelWhenFlatRate : box.label,
          format: box.format,
          total: box.total,
          note: box.note,
          empty: box.empty,
          rule: box.rule,
          cell: box.cell ? vatRef(vat, quarter, box.cell) : undefined,
        };
        var resolved = resolveRow(snap, helpers, vat, row);
        return rowHtml(helpers, resolved) + noteHtml(helpers, resolved.note);
      })
      .join("");
    return helpers.form.render(heading, vat.microcopy, '<div class="form-period">' + dates + "</div>" + helpers.form.section("", rows));
  }

  function renderVatReturns(snap, state, helpers) {
    if (!layout) return loadingPanel("VAT returns");
    var vat = layout.forms.vat;
    var quarterRows = {};
    vat.quarters.forEach(function (quarter) {
      quarterRows[quarter] = vatinterfaceRowEnding(snap, vat, rawValue(snap, vatRef(vat, quarter, vat.period.endCell)));
    });
    return (
      "<h2>VAT returns</h2>" +
      vatCoverageHtml(snap, helpers, vat, quarterRows) +
      vat.quarters
        .map(function (quarter) {
          return renderVatQuarter(snap, helpers, vat, quarter, vatFlatRateAt(snap, vat, quarterRows[quarter]));
        })
        .join("")
    );
  }

  // ============================== payroll ==============================

  var PAYMENT_SHEET = "Payslips.xlsx!Payment";
  var PAYMENT_ROWS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  var PAYMENT_COLUMNS = [
    ["B", "PAYE month", "date"],
    ["C", "Payment due", "date"],
    ["D", "National Insurance", "money"],
    ["E", "Income Tax", "money"],
    ["I", "Total payable", "money"],
  ];

  var WAGES_SHEET = "WagesInterface";
  var WAGES_BLOCKS = [
    { title: "Employees", firstRow: 4 },
    { title: "Directors", firstRow: 17 },
  ];
  var WAGES_COLUMNS = [
    ["C", "Gross"],
    ["D", "PAYE"],
    ["E", "Employee NI"],
    ["H", "Employer NI"],
  ];

  function payeScheduleHtml(snap, helpers) {
    var head = PAYMENT_COLUMNS.map(function (column) {
      return "<th>" + helpers.esc(column[1]) + "</th>";
    }).join("");
    var body = PAYMENT_ROWS.map(function (row) {
      return (
        "<tr>" +
        PAYMENT_COLUMNS.map(function (column) {
          return cellCell(snap, helpers, PAYMENT_SHEET, column[0] + row, column[2]);
        }).join("") +
        "</tr>"
      );
    }).join("");
    return (
      '<div class="panel-card"><h3>PAYE payments to HMRC</h3>' +
      '<div class="ltd-payroll-scroll"><table class="register-table"><thead><tr>' +
      head +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table></div></div>"
    );
  }

  // The wages the hub reads back from the payroll workbook, a month a row,
  // with the employees' block and the directors' block side by side. The
  // sheet keeps no per-employee month figure, so this is the split it does
  // keep; who is on the payroll comes from the book below.
  function wagesGridHtml(snap, helpers) {
    var months = snap.months;
    var head =
      "<tr><th></th>" +
      WAGES_BLOCKS.map(function (block) {
        return '<th colspan="' + WAGES_COLUMNS.length + '">' + helpers.esc(block.title) + "</th>";
      }).join("") +
      "</tr><tr><th>Month</th>" +
      WAGES_BLOCKS.map(function () {
        return WAGES_COLUMNS.map(function (column) {
          return "<th>" + helpers.esc(column[1]) + "</th>";
        }).join("");
      }).join("") +
      "</tr>";
    var body = months
      .map(function (month, index) {
        return (
          "<tr><th>" +
          helpers.esc(month.label) +
          "</th>" +
          WAGES_BLOCKS.map(function (block) {
            return WAGES_COLUMNS.map(function (column) {
              return cellCell(snap, helpers, WAGES_SHEET, column[0] + (block.firstRow + index), "money");
            }).join("");
          }).join("") +
          "</tr>"
        );
      })
      .join("");
    return (
      '<div class="panel-card"><h3>Wages by month</h3>' +
      '<div class="ltd-payroll-scroll"><table class="register-table"><thead>' +
      head +
      "</thead><tbody>" +
      body +
      "</tbody></table></div></div>"
    );
  }

  function payrollPeopleHtml(snap, helpers) {
    var employees = snap.book.employees || [];
    if (employees.length === 0) return "";
    var body = employees
      .map(function (employee) {
        return (
          "<tr><td>" +
          helpers.esc(employee.name || "") +
          "</td><td>" +
          helpers.esc(employee.role || "") +
          "</td><td>" +
          helpers.fmtMoney(numberOf(employee.grossPay)) +
          "</td><td>" +
          helpers.esc(employee.payFrequency || "") +
          "</td><td>" +
          helpers.esc(employee.taxCode || "") +
          "</td><td>" +
          helpers.esc(employee.niCategory || "") +
          "</td><td>" +
          (employee.isDirector ? "Director" : "") +
          "</td></tr>"
        );
      })
      .join("");
    return (
      '<div class="panel-card"><h3>People on the payroll</h3>' +
      '<div class="ltd-payroll-scroll"><table class="register-table"><thead><tr><th>Name</th><th>Role</th><th>Gross pay</th>' +
      "<th>Frequency</th><th>Tax code</th><th>NI category</th><th></th></tr></thead><tbody>" +
      body +
      "</tbody></table></div></div>"
    );
  }

  function renderPayroll(snap, state, helpers) {
    return (
      "<h2>Payroll</h2>" +
      '<p class="view-lede">What the payroll workbook pays over each month, and who it pays.</p>' +
      payeScheduleHtml(snap, helpers) +
      wagesGridHtml(snap, helpers) +
      payrollPeopleHtml(snap, helpers)
    );
  }

  // ============================== company ==============================

  var COMPANY_FILE = "Companysecretary.xlsx";

  // Each register renders the columns the engine actually reads; a column the
  // product does not read is not on the page, rather than an empty one.
  var REGISTERS = [
    {
      sheet: "Directors&Secretary",
      title: "Directors and secretary",
      columns: [
        ["name", "Name", "text"],
        ["address", "Address", "text"],
        ["appointed", "Appointed", "date"],
        ["capacity", "Capacity", "text"],
      ],
      columnsFrom: "DIRECTOR_SECRETARY_COLUMNS",
      rowsFrom: "DIRECTOR_SECRETARY_OFFICER_ROWS",
    },
    {
      sheet: "RegisterofMembers",
      title: "Register of members",
      columns: [
        ["name", "Name", "text"],
        ["shares", "Shares", "count"],
      ],
      columnsFrom: "REGISTER_MEMBER_COLUMNS",
      rowsFrom: "REGISTER_MEMBER_ROWS",
    },
    {
      sheet: "DirectorsInterests",
      title: "Directors' interests",
      columns: [
        ["name", "Name", "text"],
        ["address", "Address", "text"],
        ["registered", "Registered", "text"],
      ],
      columnsFrom: "DIRECTORS_INTERESTS_COLUMNS",
      rowsFrom: "DIRECTORS_INTERESTS_ROWS",
    },
    {
      sheet: "Charges&Debentures",
      title: "Charges and debentures",
      columns: [["valuation", "Valuation", "money"]],
      columnsFrom: "CHARGE_REGISTER_COLUMNS",
      rowsFrom: "CHARGE_REGISTER_ROWS",
    },
  ];

  function registerHtml(snap, helpers, register) {
    var productMod = snap.context.productMod;
    var columns = productMod[register.columnsFrom];
    var rows = productMod[register.rowsFrom];
    var sheet = COMPANY_FILE + "!" + register.sheet;
    var body = rows
      .map(function (row) {
        var filled = register.columns.some(function (column) {
          return !isBlank((snap.results[sheet] || {})[columns[column[0]] + row]);
        });
        if (!filled) return "";
        return (
          "<tr>" +
          register.columns
            .map(function (column) {
              return cellCell(snap, helpers, sheet, columns[column[0]] + row, column[2]);
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    var head = register.columns
      .map(function (column) {
        return "<th>" + helpers.esc(column[1]) + "</th>";
      })
      .join("");
    return (
      '<div class="panel-card"><h3>' +
      helpers.esc(register.title) +
      '</h3><table class="register-table"><thead><tr>' +
      head +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table></div>"
    );
  }

  // A book with no dividend declared writes nothing to Boardmeeting at all,
  // so R carries neither cell -- the key, like cellCell()'s, is left off
  // rather than pointing at a value that is really just cellText()'s "—".
  function boardMinuteRow(snap, helpers, sheet, cell, label, format) {
    var value = rawValue(snap, sheet + "!" + cell);
    return {
      label: label,
      text: cellText(snap, helpers, sheet, cell, format),
      rKeyAttr: isBlank(value) ? "" : keyAttrFor(helpers, sheet + "!" + cell),
    };
  }

  function boardMinuteHtml(snap, helpers) {
    var productMod = snap.context.productMod;
    var cells = productMod.BOARD_MINUTE_CELLS;
    var sheet = COMPANY_FILE + "!Boardmeeting";
    return (
      '<div class="panel-card"><h3>Board minute</h3>' +
      helpers.kvRows([
        boardMinuteRow(snap, helpers, sheet, cells.date, "Meeting date", "date"),
        boardMinuteRow(snap, helpers, sheet, cells.dividendDeclared, "Dividend declared", "money"),
      ]) +
      "</div>"
    );
  }

  // Each member's share of the declared dividend, rounded to pence, with the
  // rounding remainder added to the largest holding so the parts total the
  // declared figure exactly.
  function dividendShares(amount, members) {
    var totalShares = members.reduce(function (total, member) {
      return total + numberOf(member.shares);
    }, 0);
    if (totalShares === 0) return [];
    var parts = members.map(function (member) {
      return { member: member, amount: Math.round((amount * numberOf(member.shares) * 100) / totalShares) / 100 };
    });
    var allocated = parts.reduce(function (total, part) {
      return total + part.amount;
    }, 0);
    var remainder = Math.round((amount - allocated) * 100) / 100;
    if (remainder !== 0) {
      var largest = parts.reduce(function (best, part) {
        return numberOf(part.member.shares) > numberOf(best.member.shares) ? part : best;
      }, parts[0]);
      largest.amount = Math.round((largest.amount + remainder) * 100) / 100;
    }
    return parts.map(function (part) {
      return { member: part.member, amount: part.amount, perShare: part.amount / numberOf(part.member.shares) };
    });
  }

  function isoDate(value) {
    if (!value) return "";
    if (typeof value === "string") return value.slice(0, 10);
    return new Date(value).toISOString().slice(0, 10);
  }

  // The voucher is a book document, not a sheet one: every figure on it comes
  // from book.dividends[0] and book.members, so no per-member figure carries
  // an R key. The declared total does, twice over -- the board minute's own
  // cell and the published account's dividend line.
  function voucherHtml(snap, helpers) {
    var book = snap.book;
    var dividend = (book.dividends || [])[0];
    var members = book.members || [];
    if (!dividend || members.length === 0) return "";
    var entity = book.entityInformation || {};
    var office = [entity.organizationAddressLine, entity.organizationTown, entity.organizationPostcode].filter(Boolean).join(", ");
    var director = (book.directors && book.directors[0]) || {};
    var declaredRef = COMPANY_FILE + "!Boardmeeting!" + snap.context.productMod.BOARD_MINUTE_CELLS.dividendDeclared;
    var plRef = HUB_FILE + "!PubP&L!F52";
    var vouchers = dividendShares(numberOf(dividend.amount), members)
      .map(function (part) {
        return (
          '<div class="dividend-voucher"><h4>' +
          helpers.esc(entity.organizationIdentifier || "") +
          "</h4>" +
          '<p class="voucher-meta">Registered number ' +
          helpers.esc(entity["diya-gl:companyNumber"] || "") +
          (office ? " &middot; " + helpers.esc(office) : "") +
          "</p>" +
          helpers.kvRows([
            { label: "Payment date", text: helpers.esc(isoDate(dividend.boardMeetingDate)) },
            { label: "Member", text: helpers.esc(part.member.name || "") },
            { label: "Shares held", text: numberOf(part.member.shares).toLocaleString("en-GB") + " ordinary shares" },
            { label: "Dividend per share", text: helpers.fmtMoney(part.perShare) },
            { label: "Dividend payable", text: helpers.fmtMoney(part.amount) },
          ]) +
          '<p class="voucher-signature">Signed ' +
          helpers.esc(director.name || "") +
          (director.role ? ", " + helpers.esc(director.role) : "") +
          "</p></div>"
        );
      })
      .join("");
    return (
      '<div class="panel-card"><h3>Dividend vouchers</h3>' +
      helpers.kvRows([
        {
          label: "Declared by the board",
          text: helpers.fmtMoney(numberOf(dividend.amount)),
          rKeyAttr: keyAttrForAll(snap, helpers, [declaredRef, plRef]),
        },
        { label: "Board meeting", text: helpers.esc(isoDate(dividend.boardMeetingDate)) },
      ]) +
      '<p class="entries-note">Split by shareholding. No tax credit is shown: the dividend tax credit ended in April 2016.</p>' +
      vouchers +
      "</div>"
    );
  }

  function renderCompany(snap, state, helpers) {
    return (
      "<h2>Company</h2>" +
      '<p class="view-lede">The statutory registers the company secretary workbook keeps, the board minute behind the dividend, and a voucher for each member.</p>' +
      REGISTERS.map(function (register) {
        return registerHtml(snap, helpers, register);
      }).join("") +
      boardMinuteHtml(snap, helpers) +
      voucherHtml(snap, helpers)
    );
  }

  global.DiyaGlLtdForms = {
    renderAccounts: renderAccounts,
    renderComputation: renderComputation,
    renderCt600: renderCt600,
    renderVatReturns: renderVatReturns,
    renderPayroll: renderPayroll,
    renderCompany: renderCompany,
  };
})(typeof window !== "undefined" ? window : globalThis);
