// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/edits.js
//
// The edit path, the undo stack and the fix-it helpers. Every change to the
// book -- a hand edit in the entries grid, a delete, an added entry, or a
// helper applying its whole plan -- goes through the named edits
// app/lib/diya-gl-edits.js exports (addSaleLine, addPurchaseLine,
// changeLineAmount, removeLine, changeLinePostingDate, changeLineAccount,
// changeLineDetail, changeLineQuantity), reached through the engine bundle. Nothing here reimplements an edit, so
// the page, the CLI and the MCP server change a book the same way.
//
// The book checks themselves -- which lines offend, why it matters, and how
// to fix them -- live in app/lib/book-checks.js and are reached the same
// way, through the engine bundle's runBookChecks/previewHelper/applyHelper.
// Nothing here reimplements a rule either, so a check that fails on the
// page fails the same way for the CLI and the MCP server.
//
// Two kinds of check share the panel, and they answer different questions:
//
//   Engine checks   checkCompliance, exactly as the reconciliation runs it:
//                   does R agree with what the book's own figures imply?
//                   Both sides are derived from the same lines, so an edit
//                   moves both together and these stay green -- that is the
//                   point of them.
//   Book checks     the ones book-checks.js runs, over D itself: is every
//                   entry dated inside the period, does every entry reach
//                   an account the chart carries, is every amount a whole
//                   number of pence? An entry can fail these while every
//                   total on every sheet still adds up, because the money
//                   quietly never arrives. These are the failures a fix-it
//                   action can mechanically repair.

(function (global) {
  "use strict";

  var ENGINE_MODULE = "./engine/diya-gl-engine.js";

  var enginePromise = null;
  var engineModule = null;
  function engine() {
    if (!enginePromise) {
      enginePromise = import(ENGINE_MODULE).then(function (module) {
        engineModule = module;
        return module;
      });
    }
    return enginePromise;
  }
  // Kicked off immediately, not on first use: bookChecks and previewHelper
  // below are called synchronously from the page's own render path, with no
  // room for a promise, so the module has to be resolved by the time a book
  // is actually loaded. Loading a book needs a fetch and a user's own click
  // first, ample time for one dynamic import of an already-built bundle to
  // settle.
  engine();

  function requireEngine() {
    if (!engineModule) throw new Error("The books engine has not finished loading yet.");
    return engineModule;
  }

  // The button text before a helper's preview opens, for the checks whose
  // text counts the offenders. The rule that decides an offender and the fix
  // it applies live in book-checks.js; this is presentation text only, keyed
  // off the count that module's own result already carries. A helper this
  // table does not list uses its own label.
  var ACTION_LABELS = {
    "book-dates-in-period": function (n) {
      return "Move " + n + (n === 1 ? " entry" : " entries") + " into the period";
    },
    "book-accounts-in-chart": function (n) {
      return "Repost " + n + (n === 1 ? " entry" : " entries");
    },
    "book-amounts-whole-pence": function (n) {
      return "Round " + n + (n === 1 ? " amount" : " amounts");
    },
  };

  /**
   * The book checks and warnings over the snapshot's own D, run by
   * book-checks.js through the engine bundle, each with its fix-it action
   * where one exists. Both tiers reach the panel: a check fails, a warning
   * warns, and a passing one is reported too -- the panel says what it
   * looked at, not only what it found.
   */
  function bookChecks(snapshot) {
    var api = requireEngine();
    var taxData = (snapshot.context && snapshot.context.taxData) || null;
    var results = api.runBookChecks({ book: snapshot.book, lines: snapshot.lines, taxData: taxData }).results;
    return results.map(function (r) {
      var helper = r.helper
        ? {
            title: r.helper.label,
            actionLabel: ACTION_LABELS[r.id] ? ACTION_LABELS[r.id](r.actual) : r.helper.label,
            kind: r.helper.kind,
            field: r.helper.field,
          }
        : null;
      return {
        id: r.id,
        tier: r.tier,
        label: r.label,
        actual: r.actual,
        result: r.result,
        consequence: r.consequence,
        offenders: r.offenders,
        helper: helper,
      };
    });
  }

  /** The preview a helper shows before it is applied: exactly which lines change, and how. */
  function previewHelper(snapshot, checkId) {
    var api = requireEngine();
    return api.previewHelper({ book: snapshot.book, lines: snapshot.lines }, checkId);
  }

  /** Apply a helper's whole plan through the edit path, as one undoable step. */
  async function applyHelper(snapshot, checkId) {
    var api = await engine();
    return api.applyHelper({ book: snapshot.book, lines: snapshot.lines }, checkId);
  }

  // ============================== hand edits ==============================

  async function changeAmount(book, lines, entryNumber, newAmount) {
    var api = await engine();
    return api.changeLineAmount(book, lines, { entryNumber: entryNumber, newAmount: newAmount });
  }

  async function changeDate(book, lines, entryNumber, newPostingDate) {
    var api = await engine();
    return api.changeLinePostingDate(book, lines, { entryNumber: entryNumber, newPostingDate: newPostingDate });
  }

  async function changeAccount(book, lines, entryNumber, newAccountMainID) {
    var api = await engine();
    return api.changeLineAccount(book, lines, { entryNumber: entryNumber, newAccountMainID: newAccountMainID });
  }

  async function deleteEntry(book, lines, entryNumber) {
    var api = await engine();
    return api.removeLine(book, lines, { entryNumber: entryNumber });
  }

  async function changeDetail(book, lines, entryNumber, detail) {
    var api = await engine();
    return api.changeLineDetail(book, lines, { entryNumber: entryNumber, detailComment: detail });
  }

  // null clears the line's miles along with the unit and description they
  // came with.
  async function changeMiles(book, lines, entryNumber, miles) {
    var api = await engine();
    return api.changeLineQuantity(book, lines, { entryNumber: entryNumber, quantity: miles, unit: "miles" });
  }

  function nextEntryNumber(lines) {
    var taken = {};
    for (var i = 0; i < lines.length; i++) taken[lines[i].entryNumber] = 1;
    var n = 1;
    while (taken["NEW-" + String(n).padStart(4, "0")]) n++;
    return "NEW-" + String(n).padStart(4, "0");
  }

  /**
   * A new entry typed into the open month. The line is built here and added
   * by addSaleLine/addPurchaseLine, which refuse a line posted to the other
   * journal -- so a sale can never arrive under the purchases name. A fare
   * arrives as a receipt with the day's miles; the shared add row passes
   * neither, so its lines are invoices measuring nothing.
   */
  async function addEntry(book, lines, entry) {
    var api = await engine();
    var line = {
      entryNumber: nextEntryNumber(lines),
      sourceJournalID: entry.journal,
      postingDate: entry.date,
      accountMainID: String(entry.account),
      amount: entry.amount,
      documentType: entry.documentType || "invoice",
      detailComment: entry.detail || "",
    };
    var added = entry.journal === "sales" ? api.addSaleLine(book, lines, { line: line }) : api.addPurchaseLine(book, lines, { line: line });
    if (!(entry.miles > 0)) return added;
    return api.changeLineQuantity(book, added, { entryNumber: line.entryNumber, quantity: entry.miles, unit: "miles" });
  }

  // ============================== undo ==============================
  // A stack of book states. Every commit pushes the state it replaces, so
  // undo restores the exact lines the page held before -- a hand edit and a
  // helper's whole plan each being one step.

  var UNDO_LIMIT = 50;
  var undoStack = [];

  var undo = {
    push: function (book, lines, label) {
      undoStack.push({ book: book, lines: lines, label: label });
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    },
    pop: function () {
      return undoStack.pop() || null;
    },
    depth: function () {
      return undoStack.length;
    },
    topLabel: function () {
      return undoStack.length ? undoStack[undoStack.length - 1].label : null;
    },
    clear: function () {
      undoStack = [];
    },
  };

  global.DiyaGlBooksEdits = {
    bookChecks: bookChecks,
    previewHelper: previewHelper,
    applyHelper: applyHelper,
    addEntry: addEntry,
    changeAmount: changeAmount,
    changeDate: changeDate,
    changeAccount: changeAccount,
    changeDetail: changeDetail,
    changeMiles: changeMiles,
    deleteEntry: deleteEntry,
    undo: undo,
  };
})(window);
