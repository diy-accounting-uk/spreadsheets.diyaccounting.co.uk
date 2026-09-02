// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/bst-edits.js
//
// The edit path, the undo stack and the fix-it helpers. Every change to the
// book -- a hand edit in the entries grid, a delete, an added entry, or a
// helper applying its whole plan -- goes through the four functions
// app/lib/diya-gl-edits.js exports (addSaleLine, addPurchaseLine,
// changeLineAmount, removeLine), reached through the engine bundle. Nothing
// here reimplements an edit, so the page, the CLI and the MCP server change
// a book the same way.
//
// Two kinds of check share the panel, and they answer different questions:
//
//   Engine checks   checkCompliance, exactly as the reconciliation runs it:
//                   does R agree with what the book's own figures imply?
//                   Both sides are derived from the same lines, so an edit
//                   moves both together and these stay green -- that is the
//                   point of them.
//   Book checks     the ones below, over D itself: is every entry dated
//                   inside the period, does every entry reach an account
//                   the chart carries, is every amount a whole number of
//                   pence? An entry can fail these while every total on
//                   every sheet still adds up, because the money quietly
//                   never arrives. These are the failures a fix-it action
//                   can mechanically repair.

(function (global) {
  "use strict";

  var ENGINE_MODULE = "./engine/diya-gl-engine.js";

  var enginePromise = null;
  function engine() {
    if (!enginePromise) enginePromise = import(ENGINE_MODULE);
    return enginePromise;
  }

  // Half up away from zero at the penny, guarded against binary-float noise
  // the same way bst-data.js canonicalises a figure before comparing it.
  function round2(value) {
    var scaled = value * 100;
    var guarded = scaled + (scaled >= 0 ? 1 : -1) * Math.max(Math.abs(scaled), 1) * 1e-9;
    var sign = guarded < 0 ? -1 : 1;
    return (sign * Math.round(Math.abs(guarded))) / 100;
  }

  function isWholePence(amount) {
    return typeof amount === "number" && isFinite(amount) && Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;
  }

  // ============================== the book checks ==============================

  function outOfPeriodLines(book, lines, period) {
    return lines.filter(function (line) {
      return line.postingDate < period.start || line.postingDate > period.end;
    });
  }

  function unpostedLines(book, lines) {
    return lines.filter(function (line) {
      return !global.DiyaGlBooksLoader.reachesAnAccount(line);
    });
  }

  function subPennyLines(book, lines) {
    return lines.filter(function (line) {
      return !isWholePence(line.amount);
    });
  }

  // The account an unposted line is reposted to: the book's own chart for
  // that journal, preferring the general code the sheet files miscellaneous
  // spend under, falling back to whichever chart account does reach a
  // column. A book whose chart carries nothing usable gets no fix-it.
  function repostAccount(chart, journal) {
    var side = journal === "sales" ? chart.sales : chart.purchases;
    var preferred = journal === "sales" ? "4000" : "5002";
    var candidates = (side || []).filter(function (account) {
      return global.DiyaGlBooksLoader.reachesAnAccount({ sourceJournalID: journal, accountMainID: account.code });
    });
    var chosen = candidates.filter(function (account) {
      return account.code === preferred;
    })[0];
    return chosen || candidates[0] || null;
  }

  function clampIntoPeriod(date, period) {
    if (date < period.start) return period.start;
    if (date > period.end) return period.end;
    return date;
  }

  var CHECKS = [
    {
      id: "book-dates-in-period",
      label: "Every entry is dated inside the accounting period",
      offenders: function (snapshot) {
        return outOfPeriodLines(snapshot.book, snapshot.lines, snapshot.period);
      },
      consequence: function (snapshot) {
        return (
          "An entry dated outside " +
          snapshot.period.start +
          " to " +
          snapshot.period.end +
          " still lands on the month tab of the same calendar month, so it is counted in a year it does not belong to."
        );
      },
      helper: function (snapshot, offenders) {
        var period = snapshot.period;
        return {
          title: "Move these entries into the period",
          actionLabel: "Move " + offenders.length + (offenders.length === 1 ? " entry" : " entries") + " into the period",
          changes: offenders.map(function (line) {
            return {
              entryNumber: line.entryNumber,
              was: line.postingDate,
              becomes: clampIntoPeriod(line.postingDate, period),
              amount: line.amount,
              what: "date",
            };
          }),
        };
      },
      apply: function (api, snapshot, offenders) {
        var period = snapshot.period;
        return offenders.reduce(function (chain, line) {
          return chain.then(function (currentLines) {
            return replaceLine(api, snapshot.book, currentLines, line, {
              postingDate: clampIntoPeriod(line.postingDate, period),
            });
          });
        }, Promise.resolve(snapshot.lines));
      },
    },
    {
      id: "book-accounts-in-chart",
      label: "Every entry reaches an account in the book's chart",
      offenders: function (snapshot) {
        return unpostedLines(snapshot.book, snapshot.lines);
      },
      consequence: function () {
        return "An entry posted to an account outside the chart is filtered out before any sheet totals it, so its amount reaches no column at all.";
      },
      helper: function (snapshot, offenders) {
        var changes = [];
        for (var i = 0; i < offenders.length; i++) {
          var line = offenders[i];
          var account = repostAccount(snapshot.chart, line.sourceJournalID);
          if (!account) return null;
          changes.push({
            entryNumber: line.entryNumber,
            was: line.accountMainID,
            becomes: account.code + " — " + account.description,
            amount: line.amount,
            what: "account",
          });
        }
        return {
          title: "Repost these entries to the chart",
          actionLabel: "Repost " + offenders.length + (offenders.length === 1 ? " entry" : " entries"),
          changes: changes,
        };
      },
      apply: function (api, snapshot, offenders) {
        return offenders.reduce(function (chain, line) {
          return chain.then(function (currentLines) {
            var account = repostAccount(snapshot.chart, line.sourceJournalID);
            return replaceLine(api, snapshot.book, currentLines, line, { accountMainID: account.code });
          });
        }, Promise.resolve(snapshot.lines));
      },
    },
    {
      id: "book-amounts-whole-pence",
      label: "Every amount is a whole number of pence",
      offenders: function (snapshot) {
        return subPennyLines(snapshot.book, snapshot.lines);
      },
      consequence: function () {
        return "An amount finer than a penny is carried in full through the totals but shown rounded, so the sheet's own figures stop adding up to what is printed.";
      },
      helper: function (snapshot, offenders) {
        return {
          title: "Round these amounts to the penny",
          actionLabel: "Round " + offenders.length + (offenders.length === 1 ? " amount" : " amounts"),
          changes: offenders.map(function (line) {
            return {
              entryNumber: line.entryNumber,
              was: String(line.amount),
              becomes: round2(line.amount).toFixed(2),
              amount: line.amount,
              what: "amount",
            };
          }),
        };
      },
      apply: function (api, snapshot, offenders) {
        return offenders.reduce(function (chain, line) {
          return chain.then(function (currentLines) {
            return api.changeLineAmount(snapshot.book, currentLines, {
              entryNumber: line.entryNumber,
              newAmount: round2(line.amount),
            });
          });
        }, Promise.resolve(snapshot.lines));
      },
    },
  ];

  // A field a line carries that changeLineAmount cannot reach -- its date or
  // its account -- moves by removing the line and adding it back corrected.
  // Both halves are diya-gl-edits.js's own functions, so the fix travels the
  // same path as a hand edit and the same undo covers it.
  function replaceLine(api, book, lines, line, changes) {
    var corrected = Object.assign({}, line, changes);
    var without = api.removeLine(book, lines, { entryNumber: line.entryNumber });
    if (corrected.sourceJournalID === "sales") return api.addSaleLine(book, without, { line: corrected });
    return api.addPurchaseLine(book, without, { line: corrected });
  }

  /**
   * The book checks over the snapshot's own D, each with its fix-it action
   * where one exists. A passing check is reported too -- the panel says what
   * it looked at, not only what it found.
   */
  function bookChecks(snapshot) {
    return CHECKS.map(function (spec) {
      var offenders = spec.offenders(snapshot);
      var pass = offenders.length === 0;
      var helper = pass ? null : spec.helper(snapshot, offenders);
      return {
        id: spec.id,
        label: spec.label,
        actual: offenders.length,
        result: pass ? "pass" : "fail",
        consequence: pass ? null : spec.consequence(snapshot),
        offenders: offenders.map(function (line) {
          return {
            entryNumber: line.entryNumber,
            postingDate: line.postingDate,
            accountMainID: line.accountMainID,
            detail: line.detailComment || "",
            amount: line.amount,
          };
        }),
        helper: helper,
      };
    });
  }

  /** The preview a helper shows before it is applied: exactly which lines change, and how. */
  function previewHelper(snapshot, checkId) {
    var check = bookChecks(snapshot).filter(function (c) {
      return c.id === checkId;
    })[0];
    if (!check || !check.helper) return null;
    return {
      title: check.helper.title,
      summary:
        "This will change " +
        check.helper.changes.length +
        (check.helper.changes.length === 1 ? " line" : " lines") +
        ". Nothing else in the book moves.",
      changes: check.helper.changes,
    };
  }

  /** Apply a helper's whole plan through the edit path, as one undoable step. */
  async function applyHelper(snapshot, checkId) {
    var api = await engine();
    var spec = CHECKS.filter(function (c) {
      return c.id === checkId;
    })[0];
    if (!spec) throw new Error('No helper called "' + checkId + '"');
    var offenders = spec.offenders(snapshot);
    if (offenders.length === 0) throw new Error("Nothing left for this helper to fix.");
    return spec.apply(api, snapshot, offenders);
  }

  // ============================== hand edits ==============================

  async function changeAmount(book, lines, entryNumber, newAmount) {
    var api = await engine();
    return api.changeLineAmount(book, lines, { entryNumber: entryNumber, newAmount: newAmount });
  }

  async function deleteEntry(book, lines, entryNumber) {
    var api = await engine();
    return api.removeLine(book, lines, { entryNumber: entryNumber });
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
   * journal -- so a sale can never arrive under the purchases name.
   */
  async function addEntry(book, lines, entry) {
    var api = await engine();
    var line = {
      entryNumber: nextEntryNumber(lines),
      sourceJournalID: entry.journal,
      postingDate: entry.date,
      accountMainID: String(entry.account),
      amount: entry.amount,
      documentType: "invoice",
      detailComment: entry.detail || "",
    };
    if (entry.journal === "sales") return api.addSaleLine(book, lines, { line: line });
    return api.addPurchaseLine(book, lines, { line: line });
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
    deleteEntry: deleteEntry,
    undo: undo,
  };
})(window);
