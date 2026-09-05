// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/products/taxi-takings.js
//
// The takings grain under the shared year table, for a Taxi book: the
// month's summary line, a strip of its weeks, the days of an open week and
// the fares of an open day, laid out as the Sales sheets lay them out --
// a row per calendar day, then the week's rental row, its other-income row
// and its subtotal. The book holds each fare; the workbook row holds their
// sum and their joined names, and both are on screen at once.
//
// Every figure here is a book figure read off snapshot.takings, which the
// Taxi manifest groups (products/taxi.js, groupTakings). Nothing here reads
// a sheet cell or carries a report key: the month's keyed takings cell is
// the shared summary grid's, above this module's output.
//
// The shared shell binds every amount, date and delete control on the page
// and returns the caret after a commit through state.focusEntry and
// state.focusField; this module binds only the controls the shared grid
// does not have -- a fare's name and miles, the week and day toggles, the
// add controls and their drafts, and the off-grid helper -- and reopens the
// week and day a focused line sits in so the shell finds its input.

(function (global) {
  "use strict";

  var VIEW_ID = "taxi-takings";
  var TAKINGS_ACCOUNT = "4000";
  var OTHER_INCOME_ACCOUNT = "4001";
  var DATES_IN_PERIOD_CHECK = "book-dates-in-period";

  // The two rows a Sales-sheet week carries besides its days, keyed by the
  // draft kind their add control opens.
  var CAPTIONS = {
    "rental": {
      account: TAKINGS_ACCOUNT,
      detail: "Rental due",
      noun: "rental",
      button: "Add rental",
      figure: "rental",
      lines: "rentalLines",
    },
    "other-income": {
      account: OTHER_INCOME_ACCOUNT,
      detail: "Any other income",
      noun: "other income",
      button: "Add other income",
      figure: "otherIncome",
      lines: "otherIncomeLines",
    },
  };

  var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAY_GRID_COLUMNS = 5;
  var WEEK_STRIP_COLUMNS = 7;

  var TAKINGS_NOTE = "The workbook carries one row per day; your fares stay in the book.";
  var MILES_MESSAGE = "Miles must be a whole number.";

  function snapshot() {
    return global.DIYA_BOOKS_SNAPSHOT;
  }

  function bagFor(helpers) {
    return helpers.viewState(VIEW_ID, { openWeek: null, openDay: null, draft: null, pendingFocus: null });
  }

  // ============================== labels and parsing ==============================

  function dateOf(iso) {
    var parts = iso.split("-");
    return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  }

  function dayLabel(iso) {
    var date = dateOf(iso);
    return DAY_NAMES[date.getUTCDay()] + " " + date.getUTCDate() + " " + MONTH_NAMES[date.getUTCMonth()];
  }

  // "w/c Mon 7 Apr" from the week's first day; a week of one day is that
  // day alone, which is how the year's first week reads when 6 April is a
  // Sunday.
  function weekLabel(week) {
    return week.days.length === 1 ? dayLabel(week.start) : "w/c " + dayLabel(week.start);
  }

  function parseAmount(raw) {
    var cleaned = String(raw).replace(/[£,\s]/g, "");
    if (cleaned === "" || !/^-?\d*(\.\d*)?$/.test(cleaned)) return null;
    var value = Number(cleaned);
    return isFinite(value) ? value : null;
  }

  function parseMiles(raw) {
    var cleaned = String(raw).replace(/[,\s]/g, "");
    if (!/^\d+$/.test(cleaned)) return null;
    return Number(cleaned);
  }

  function fmtCount(n) {
    return Math.round(n).toLocaleString("en-GB");
  }

  function plural(n, noun, pluralNoun) {
    return n + " " + (n === 1 ? noun : pluralNoun || noun + "s");
  }

  // ============================== the takings shape ==============================

  function weekByStart(month, start) {
    return month.weeks.filter(function (week) {
      return week.start === start;
    })[0];
  }

  function dayByDate(week, date) {
    return week.days.filter(function (day) {
      return day.date === date;
    })[0];
  }

  function hasEntry(lines, entryNumber) {
    return lines.some(function (line) {
      return line.entryNumber === entryNumber;
    });
  }

  // The week and, for a day line, the day one entry sits in; null when the
  // month does not hold it.
  function locate(month, entryNumber) {
    for (var w = 0; w < month.weeks.length; w++) {
      var week = month.weeks[w];
      for (var d = 0; d < week.days.length; d++) {
        if (hasEntry(week.days[d].lines, entryNumber)) return { week: week, day: week.days[d] };
      }
      if (hasEntry(week.rentalLines, entryNumber) || hasEntry(week.otherIncomeLines, entryNumber)) return { week: week, day: null };
    }
    return null;
  }

  // Which week and day are open. A line the shell is about to return focus
  // to takes precedence over the bag: its week opens, and its day opens when
  // its inputs only exist in the day's list. A day whose one fare is edited
  // in its own row stays as it was, so the input does not jump.
  function levelsFor(state, month, bag) {
    var openWeek = weekByStart(month, bag.openWeek) ? bag.openWeek : null;
    var openDay = bag.openDay;
    var found = state.focusEntry ? locate(month, state.focusEntry) : null;
    if (found) {
      openWeek = found.week.start;
      if (found.day && (found.day.lines.length > 1 || bag.openDay === found.day.date)) openDay = found.day.date;
    }
    if (!openWeek || !dayByDate(weekByStart(month, openWeek), openDay)) openDay = null;
    return { openWeek: openWeek, openDay: openDay };
  }

  // The Sales sheet's two subtotal cells for a week: column E is the days'
  // takings plus the rental row, column F the whole of the other income.
  function subtotals(week) {
    return { takings: week.takings + week.rental, otherIncome: week.otherIncome };
  }

  function missingMilesCount(week) {
    return week.days.filter(function (day) {
      return day.isMissingMiles;
    }).length;
  }

  // The entry addEntry builds a line from. A fare is dated its own day and
  // is a receipt, as the fixtures' fares are; a caption row is dated the
  // week's last day, which is where the sheet prints it.
  function draftLine(draft, week) {
    var amount = parseAmount(draft.amount);
    if (draft.kind === "fare") {
      return {
        journal: "sales",
        date: draft.day,
        account: TAKINGS_ACCOUNT,
        detail: draft.detail || "",
        amount: amount,
        miles: draft.miles === "" || draft.miles === undefined ? 0 : parseMiles(draft.miles),
        documentType: "receipt",
      };
    }
    var caption = CAPTIONS[draft.kind];
    return {
      journal: "sales",
      date: week.end,
      account: caption.account,
      detail: caption.detail,
      amount: amount,
      documentType: "invoice",
    };
  }

  // ============================== shared cells ==============================

  function detailInput(fare, helpers) {
    return (
      '<input class="entry-detail-input" data-detail-entry="' +
      helpers.esc(fare.entryNumber) +
      '" aria-label="Name for entry ' +
      helpers.esc(fare.entryNumber) +
      '" value="' +
      helpers.esc(fare.detail) +
      '" />'
    );
  }

  function milesInput(fare, helpers) {
    return (
      '<input class="entry-miles-input" inputmode="numeric" placeholder="miles" data-miles-entry="' +
      helpers.esc(fare.entryNumber) +
      '" aria-label="Miles for entry ' +
      helpers.esc(fare.entryNumber) +
      '" value="' +
      (fare.miles > 0 ? helpers.esc(fmtCount(fare.miles).replace(/,/g, "")) : "") +
      '" />'
    );
  }

  function amountInput(fare, helpers) {
    return (
      '<input class="entry-amount-input" inputmode="decimal" data-amount-entry="' +
      helpers.esc(fare.entryNumber) +
      '" aria-label="Amount for entry ' +
      helpers.esc(fare.entryNumber) +
      '" value="' +
      fare.amount.toFixed(2) +
      '" />'
    );
  }

  function dateInput(fare, date, helpers) {
    return (
      '<input type="date" class="entry-date-input" data-date-entry="' +
      helpers.esc(fare.entryNumber) +
      '" aria-label="Date for entry ' +
      helpers.esc(fare.entryNumber) +
      '" value="' +
      helpers.esc(date) +
      '" />'
    );
  }

  function deleteButton(fare, helpers) {
    return (
      '<button type="button" class="entry-delete" data-delete-entry="' +
      helpers.esc(fare.entryNumber) +
      '" title="Remove this entry" aria-label="Remove entry ' +
      helpers.esc(fare.entryNumber) +
      '">&times;</button>'
    );
  }

  var SHARED_FLAG =
    '<span class="entry-flag" title="This line shares its entry number with another, so it cannot be changed on its own">shared no.</span>';
  var NO_MILES_FLAG = '<span class="entry-flag">no miles</span>';

  function addFareButton(date, helpers) {
    return '<button type="button" class="btn add-fare" data-add-fare="' + helpers.esc(date) + '">Add a fare</button>';
  }

  function addCaptionButton(kind, week, helpers) {
    return (
      '<button type="button" class="btn add-caption" data-add-caption="' +
      kind +
      '" data-week="' +
      helpers.esc(week.start) +
      '">' +
      CAPTIONS[kind].button +
      "</button>"
    );
  }

  function fareCountText(day) {
    return '<span class="fare-count">' + plural(day.lines.length, "fare") + "</span>";
  }

  function dayTakingsText(day, helpers) {
    return (
      helpers.fmtMoney(day.takings) + (day.other > 0 ? ' <span class="day-other">other ' + helpers.fmtMoney(day.other) + "</span>" : "")
    );
  }

  // ============================== the month summary ==============================

  function renderSummary(month, helpers) {
    var missing = month.weeks.reduce(function (sum, week) {
      return sum + missingMilesCount(week);
    }, 0);
    return (
      '<p class="takings-summary">Miles ' +
      fmtCount(month.miles) +
      " · " +
      plural(month.daysTraded, "day") +
      " traded" +
      (month.caption ? " · " + helpers.esc(month.caption) : "") +
      (missing > 0 ? ' · <span class="entry-flag">' + plural(missing, "fare day") + " without miles</span>" : "") +
      "</p>" +
      '<p id="takings-note" class="entries-note">' +
      TAKINGS_NOTE +
      "</p>"
    );
  }

  function renderOffGrid(offGrid, helpers) {
    if (!offGrid.length) return "";
    var n = offGrid.length;
    return (
      '<div class="takings-offgrid panel-card"><p>' +
      plural(n, "entry", "entries") +
      (n === 1 ? " is" : " are") +
      " dated outside this year's grid (6 April to 5 April), so the workbook cannot hold " +
      (n === 1 ? "it" : "them") +
      ". Give each a date inside the year, or move them all to the year's edge.</p>" +
      '<table class="offgrid-list"><thead><tr><th>Date</th><th>Name</th><th>Amount</th><th><span class="sr-only">Controls</span></th></tr></thead><tbody>' +
      offGrid
        .map(function (line) {
          return (
            '<tr class="offgrid-row" data-entry="' +
            helpers.esc(line.entryNumber) +
            '"><td>' +
            dateInput(line, line.postingDate, helpers) +
            "</td><td>" +
            helpers.esc(line.detail) +
            '</td><td class="num">' +
            helpers.fmtMoney(line.amount) +
            '</td><td class="entry-actions">' +
            deleteButton(line, helpers) +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>" +
      '<button type="button" class="btn" data-offgrid-helper="' +
      DATES_IN_PERIOD_CHECK +
      '">Move them into the period</button></div>'
    );
  }

  // ============================== the week strip and day grid ==============================

  function renderWeekStrip(month, levels, bag, helpers) {
    var rows = month.weeks
      .map(function (week) {
        var open = week.start === levels.openWeek;
        var missing = missingMilesCount(week);
        return (
          '<tr class="week-row' +
          (open ? " is-open" : "") +
          '" data-week="' +
          helpers.esc(week.start) +
          '" tabindex="0" role="button" aria-expanded="' +
          (open ? "true" : "false") +
          '"><td class="week-cell"><span class="disclosure" aria-hidden="true">▸</span> ' +
          weekLabel(week) +
          '</td><td class="num">' +
          week.daysTraded +
          '</td><td class="num">' +
          helpers.fmtMoney(week.takings) +
          '</td><td class="num">' +
          helpers.fmtMoney(week.rental) +
          '</td><td class="num">' +
          helpers.fmtMoney(week.otherIncome) +
          '</td><td class="num"' +
          (missing > 0 ? ' data-missing-miles="' + missing + '"' : "") +
          ">" +
          fmtCount(week.miles) +
          (missing > 0 ? ' <span class="entry-flag">' + missing + " without miles</span>" : "") +
          '</td><td class="num">' +
          helpers.fmtMoney(week.total) +
          "</td></tr>" +
          (open
            ? '<tr class="week-detail-row"><td colspan="' +
              WEEK_STRIP_COLUMNS +
              '"><div class="week-detail">' +
              renderDayGrid(week, levels, bag, helpers) +
              "</div></td></tr>"
            : "")
        );
      })
      .join("");
    return (
      '<div class="week-strip-scroll"><table class="week-strip" data-month="' +
      helpers.esc(month.key) +
      '"><thead><tr><th>Week</th><th>Days</th><th>Takings</th><th>Rental</th><th>Other income</th><th>Miles</th><th>Total</th></tr></thead><tbody>' +
      rows +
      "</tbody></table></div>"
    );
  }

  function renderDayGrid(week, levels, bag, helpers) {
    var draft = bag.draft;
    var body = week.days
      .map(function (day) {
        var open = day.lines.length > 0 && day.date === levels.openDay;
        var dayDraft = draft && draft.kind === "fare" && draft.day === day.date ? draft : null;
        return (
          renderDayRow(day, open, helpers) +
          (open ? renderDayDetailRow(day, dayDraft, helpers) : "") +
          (dayDraft && !open ? renderDraftRow(dayDraft, DAY_GRID_COLUMNS, helpers) : "")
        );
      })
      .join("");
    body += ["rental", "other-income"]
      .map(function (kind) {
        var captionDraft = draft && draft.kind === kind && draft.weekStart === week.start ? draft : null;
        return renderCaptionRow(kind, week, helpers) + (captionDraft ? renderDraftRow(captionDraft, DAY_GRID_COLUMNS, helpers) : "");
      })
      .join("");
    body += renderWeekTotalRow(week, helpers);
    return (
      '<table class="day-grid" data-week="' +
      helpers.esc(week.start) +
      '"><thead><tr><th>Day</th><th>Fares</th><th>Miles</th><th>Takings</th><th><span class="sr-only">Controls</span></th></tr></thead><tbody>' +
      body +
      "</tbody></table>"
    );
  }

  function dayToggle(day, open) {
    return (
      '<button type="button" class="day-toggle" data-day-toggle="' +
      day.date +
      '" aria-expanded="' +
      (open ? "true" : "false") +
      '"><span class="disclosure" aria-hidden="true">▸</span> ' +
      dayLabel(day.date) +
      "</button>"
    );
  }

  function renderDayRow(day, open, helpers) {
    var n = day.lines.length;
    var start =
      '<tr class="day-row' + (day.isMissingMiles ? " is-missing-miles" : "") + '" data-day="' + day.date + '" data-lines="' + n + '">';
    if (n === 0) {
      return (
        start +
        "<td>" +
        dayLabel(day.date) +
        '</td><td></td><td></td><td></td><td class="entry-actions">' +
        addFareButton(day.date, helpers) +
        "</td></tr>"
      );
    }
    var fare = day.lines[0];
    if (n === 1 && !open && fare.addressable) {
      return (
        start +
        "<td>" +
        dayToggle(day, false) +
        "</td><td>" +
        detailInput(fare, helpers) +
        "</td><td>" +
        (fare.other ? "" : milesInput(fare, helpers) + (day.isMissingMiles ? " " + NO_MILES_FLAG : "")) +
        '</td><td class="num">' +
        amountInput(fare, helpers) +
        '</td><td class="entry-actions">' +
        deleteButton(fare, helpers) +
        addFareButton(day.date, helpers) +
        "</td></tr>"
      );
    }
    return (
      start +
      "<td>" +
      dayToggle(day, open) +
      "</td><td>" +
      helpers.esc(day.names.join("; ")) +
      " " +
      fareCountText(day) +
      (n === 1 && !fare.addressable ? " " + SHARED_FLAG : "") +
      '</td><td class="num">' +
      fmtCount(day.miles) +
      (day.isMissingMiles ? " " + NO_MILES_FLAG : "") +
      '</td><td class="num">' +
      dayTakingsText(day, helpers) +
      '</td><td class="entry-actions">' +
      addFareButton(day.date, helpers) +
      "</td></tr>"
    );
  }

  function fareListCaption(day, helpers) {
    return (
      '<caption class="fare-list-caption">' +
      plural(day.lines.length, "fare") +
      " on " +
      dayLabel(day.date) +
      ". The workbook row will carry " +
      helpers.fmtMoney(day.takings) +
      " and '" +
      helpers.esc(day.names.join("; ")) +
      "'.</caption>"
    );
  }

  function renderFareRow(fare, date, helpers) {
    var cells = fare.addressable
      ? "<td>" +
        dateInput(fare, date, helpers) +
        "</td><td>" +
        detailInput(fare, helpers) +
        "</td><td>" +
        (fare.other ? "" : milesInput(fare, helpers)) +
        '</td><td class="num">' +
        amountInput(fare, helpers) +
        '</td><td class="entry-actions">' +
        deleteButton(fare, helpers) +
        "</td>"
      : "<td>" +
        helpers.esc(date) +
        "</td><td>" +
        helpers.esc(fare.detail) +
        '</td><td class="num">' +
        (fare.other ? "" : fmtCount(fare.miles)) +
        '</td><td class="num">' +
        helpers.fmtMoney(fare.amount) +
        '</td><td class="entry-actions">' +
        SHARED_FLAG +
        "</td>";
    return (
      '<tr class="fare-row' + (fare.other ? " is-other" : "") + '" data-entry="' + helpers.esc(fare.entryNumber) + '">' + cells + "</tr>"
    );
  }

  function renderDayDetailRow(day, dayDraft, helpers) {
    return (
      '<tr class="day-detail-row"><td colspan="' +
      DAY_GRID_COLUMNS +
      '"><table class="fare-list" data-day="' +
      day.date +
      '">' +
      fareListCaption(day, helpers) +
      '<thead><tr><th>Date</th><th>Name</th><th>Miles</th><th>Amount</th><th><span class="sr-only">Controls</span></th></tr></thead><tbody>' +
      day.lines
        .map(function (fare) {
          return renderFareRow(fare, day.date, helpers);
        })
        .join("") +
      (dayDraft ? renderDraftRow(dayDraft, DAY_GRID_COLUMNS, helpers) : "") +
      '</tbody><tfoot><tr><td colspan="' +
      DAY_GRID_COLUMNS +
      '">' +
      addFareButton(day.date, helpers) +
      "</td></tr></tfoot></table></td></tr>"
    );
  }

  // A caption line's own date, which the takings shape does not carry: it
  // may sit on any day of its week, and the date field has to show that day.
  function postingDateOf(entryNumber) {
    var line = snapshot().lines.filter(function (candidate) {
      return candidate.entryNumber === entryNumber;
    })[0];
    if (!line) throw new Error("No line carries entryNumber " + entryNumber);
    return line.postingDate;
  }

  function captionLine(fare, week, helpers) {
    if (!fare.addressable) {
      return (
        '<span class="caption-line" data-entry="' +
        helpers.esc(fare.entryNumber) +
        '">' +
        helpers.fmtMoney(fare.amount) +
        " " +
        SHARED_FLAG +
        "</span>"
      );
    }
    return (
      '<span class="caption-line" data-entry="' +
      helpers.esc(fare.entryNumber) +
      '">' +
      dateInput(fare, postingDateOf(fare.entryNumber), helpers) +
      amountInput(fare, helpers) +
      deleteButton(fare, helpers) +
      "</span>"
    );
  }

  function renderCaptionRow(kind, week, helpers) {
    var caption = CAPTIONS[kind];
    return (
      '<tr class="caption-row" data-caption="' +
      kind +
      '"><td>' +
      caption.detail +
      "</td><td>" +
      week[caption.lines]
        .map(function (fare) {
          return captionLine(fare, week, helpers);
        })
        .join("") +
      '</td><td></td><td class="num">' +
      helpers.fmtMoney(week[caption.figure]) +
      '</td><td class="entry-actions">' +
      addCaptionButton(kind, week, helpers) +
      "</td></tr>"
    );
  }

  function weekTotalText(week, helpers) {
    var sub = subtotals(week);
    return (
      helpers.fmtMoney(sub.takings) +
      (sub.takings !== 0 || sub.otherIncome !== 0
        ? ' <span class="week-subtotal-other">other income ' + helpers.fmtMoney(sub.otherIncome) + "</span>"
        : "")
    );
  }

  function renderWeekTotalRow(week, helpers) {
    return (
      '<tr class="week-total-row"><td>Week total</td><td></td><td class="num">' +
      fmtCount(week.miles) +
      '</td><td class="num">' +
      weekTotalText(week, helpers) +
      "</td><td></td></tr>"
    );
  }

  // ============================== the draft ==============================

  function draftFields(draft, helpers) {
    var noun = draft.kind === "fare" ? "fare" : CAPTIONS[draft.kind].noun;
    var fields =
      '<input class="entry-amount-input" data-draft-field="amount" inputmode="decimal" placeholder="0.00" aria-label="Amount for the new ' +
      noun +
      '" value="' +
      helpers.esc(draft.amount || "") +
      '" />';
    if (draft.kind === "fare") {
      fields =
        '<input class="entry-detail-input" data-draft-field="detail" placeholder="Name" aria-label="Name for the new fare" value="' +
        helpers.esc(draft.detail || "") +
        '" />' +
        '<input class="entry-miles-input" data-draft-field="miles" inputmode="numeric" placeholder="miles" aria-label="Miles for the new fare" value="' +
        helpers.esc(draft.miles || "") +
        '" />' +
        fields;
    }
    return (
      '<div class="fare-draft-form">' +
      fields +
      '<button type="button" class="btn" data-draft-commit>Add</button>' +
      '<button type="button" class="btn" data-draft-cancel>Cancel</button></div>'
    );
  }

  function draftAttrs(draft, helpers) {
    return draft.kind === "fare"
      ? ' data-day="' + helpers.esc(draft.day) + '"'
      : ' data-week="' + helpers.esc(draft.weekStart) + '" data-caption="' + draft.kind + '"';
  }

  function renderDraftRow(draft, columns, helpers) {
    return (
      '<tr class="fare-draft"' + draftAttrs(draft, helpers) + '><td colspan="' + columns + '">' + draftFields(draft, helpers) + "</td></tr>"
    );
  }

  function renderDraftCard(draft, helpers) {
    return '<div class="fare-draft"' + draftAttrs(draft, helpers) + ">" + draftFields(draft, helpers) + "</div>";
  }

  // ============================== mobile portrait cards ==============================

  function figurePair(label, value) {
    return '<span class="figure-label">' + label + '</span><span class="figure-value">' + value + "</span>";
  }

  function renderWeekCards(month, levels, bag, helpers) {
    return (
      '<div class="week-cards">' +
      month.weeks
        .map(function (week) {
          var open = week.start === levels.openWeek;
          var missing = missingMilesCount(week);
          return (
            '<div class="week-card' +
            (open ? " is-open" : "") +
            '" data-week-card="' +
            helpers.esc(week.start) +
            '"><button type="button" class="week-card-head" data-week-toggle="' +
            helpers.esc(week.start) +
            '" aria-expanded="' +
            (open ? "true" : "false") +
            '"><span class="week-name">' +
            weekLabel(week) +
            '</span><span class="mono">' +
            helpers.fmtMoney(week.total) +
            "</span></button>" +
            '<div class="week-card-figures">' +
            figurePair("Takings", helpers.fmtMoney(week.takings)) +
            figurePair("Rental", helpers.fmtMoney(week.rental)) +
            figurePair("Other income", helpers.fmtMoney(week.otherIncome)) +
            figurePair(
              "Miles",
              fmtCount(week.miles) + (missing > 0 ? ' <span class="entry-flag">' + missing + " without miles</span>" : ""),
            ) +
            "</div>" +
            (open ? renderWeekCardBody(week, levels, bag, helpers) : "") +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderWeekCardBody(week, levels, bag, helpers) {
    var draft = bag.draft;
    var days = week.days
      .map(function (day) {
        var dayDraft = draft && draft.kind === "fare" && draft.day === day.date ? draft : null;
        return renderDayCard(day, day.lines.length > 0 && day.date === levels.openDay, dayDraft, helpers);
      })
      .join("");
    var captions = ["rental", "other-income"]
      .map(function (kind) {
        var captionDraft = draft && draft.kind === kind && draft.weekStart === week.start ? draft : null;
        return renderCaptionCard(kind, week, captionDraft, helpers);
      })
      .join("");
    return (
      '<div class="day-list">' +
      days +
      "</div>" +
      captions +
      '<div class="week-card-total"><span class="figure-label">Week total</span><span class="figure-value">' +
      weekTotalText(week, helpers) +
      "</span></div>"
    );
  }

  function renderDayCard(day, open, dayDraft, helpers) {
    var n = day.lines.length;
    var head;
    if (n === 0) {
      head = '<div class="day-card-head"><span class="day-name">' + dayLabel(day.date) + "</span></div>";
    } else {
      head =
        '<button type="button" class="day-card-head" data-day-toggle="' +
        day.date +
        '" aria-expanded="' +
        (open ? "true" : "false") +
        '"><span class="day-name">' +
        dayLabel(day.date) +
        '</span><span class="mono">' +
        dayTakingsText(day, helpers) +
        "</span>" +
        fareCountText(day) +
        (day.isMissingMiles ? " " + NO_MILES_FLAG : "") +
        "</button>";
    }
    var body = "";
    if (open) {
      body = day.lines
        .map(function (fare) {
          return renderFareCard(fare, day.date, helpers);
        })
        .join("");
    }
    return (
      '<div class="day-card' +
      (open ? " is-open" : "") +
      (day.isMissingMiles ? " is-missing-miles" : "") +
      '" data-day-card="' +
      day.date +
      '" data-lines="' +
      n +
      '">' +
      head +
      body +
      (dayDraft ? renderDraftCard(dayDraft, helpers) : "") +
      (n === 0 || open ? addFareButton(day.date, helpers) : "") +
      "</div>"
    );
  }

  function labelled(label, control) {
    return '<label class="fare-card-field"><span class="figure-label">' + label + "</span>" + control + "</label>";
  }

  function renderFareCard(fare, date, helpers) {
    if (!fare.addressable) {
      return (
        '<div class="fare-card' +
        (fare.other ? " is-other" : "") +
        '" data-entry="' +
        helpers.esc(fare.entryNumber) +
        '">' +
        figurePair("Name", helpers.esc(fare.detail)) +
        figurePair("Amount", helpers.fmtMoney(fare.amount)) +
        SHARED_FLAG +
        "</div>"
      );
    }
    return (
      '<div class="fare-card' +
      (fare.other ? " is-other" : "") +
      '" data-entry="' +
      helpers.esc(fare.entryNumber) +
      '">' +
      labelled("Date", dateInput(fare, date, helpers)) +
      labelled("Name", detailInput(fare, helpers)) +
      (fare.other ? "" : labelled("Miles", milesInput(fare, helpers))) +
      labelled("Amount", amountInput(fare, helpers)) +
      deleteButton(fare, helpers) +
      "</div>"
    );
  }

  function renderCaptionCard(kind, week, captionDraft, helpers) {
    var caption = CAPTIONS[kind];
    return (
      '<div class="caption-card" data-caption="' +
      kind +
      '"><div class="caption-card-head"><span class="day-name">' +
      caption.detail +
      '</span><span class="mono">' +
      helpers.fmtMoney(week[caption.figure]) +
      "</span></div>" +
      week[caption.lines]
        .map(function (fare) {
          return captionLine(fare, week, helpers);
        })
        .join("") +
      (captionDraft ? renderDraftCard(captionDraft, helpers) : "") +
      addCaptionButton(kind, week, helpers) +
      "</div>"
    );
  }

  // ============================== render ==============================

  function renderMonthDetail(monthKey, state, helpers) {
    var takings = snapshot().takings;
    var month = takings.months[monthKey];
    if (!month) throw new Error("snapshot.takings carries no month " + monthKey);
    var bag = bagFor(helpers);
    var levels = levelsFor(state, month, bag);
    bag.openWeek = levels.openWeek;
    bag.openDay = levels.openDay;
    return (
      '<div class="takings-month" data-month="' +
      helpers.esc(monthKey) +
      '">' +
      renderSummary(month, helpers) +
      renderOffGrid(takings.offGrid, helpers) +
      "</div>" +
      (helpers.isMobilePortrait() ? renderWeekCards(month, levels, bag, helpers) : renderWeekStrip(month, levels, bag, helpers))
    );
  }

  // ============================== bind ==============================

  function each(root, selector, fn) {
    Array.prototype.forEach.call(root.querySelectorAll(selector), fn);
  }

  function openerSelector(draft) {
    return draft.kind === "fare"
      ? '[data-add-fare="' + draft.day + '"]'
      : '[data-add-caption="' + draft.kind + '"][data-week="' + draft.weekStart + '"]';
  }

  // The week a caption draft posts into, found across the months, for the
  // end date its line is dated.
  function weekOfDraft(draft) {
    var months = snapshot().takings.months;
    var keys = Object.keys(months);
    for (var i = 0; i < keys.length; i++) {
      var week = weekByStart(months[keys[i]], draft.weekStart);
      if (week) return week;
    }
    throw new Error("No week starts " + draft.weekStart);
  }

  function bind(root, state, helpers) {
    var bag = bagFor(helpers);

    function toggleWeek(start) {
      if (bag.openWeek === start) {
        bag.openWeek = null;
        bag.openDay = null;
        bag.draft = null;
      } else {
        bag.openWeek = start;
        bag.openDay = null;
        bag.draft = null;
      }
      helpers.render();
    }

    each(root, "tr.week-row", function (tr) {
      tr.addEventListener("click", function () {
        toggleWeek(tr.getAttribute("data-week"));
      });
      tr.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleWeek(tr.getAttribute("data-week"));
        }
      });
    });
    each(root, "[data-week-toggle]", function (btn) {
      btn.addEventListener("click", function () {
        toggleWeek(btn.getAttribute("data-week-toggle"));
      });
    });

    each(root, "[data-day-toggle]", function (btn) {
      btn.addEventListener("click", function () {
        var date = btn.getAttribute("data-day-toggle");
        bag.openDay = bag.openDay === date ? null : date;
        helpers.render();
      });
    });

    each(root, "[data-detail-entry]", function (input) {
      var entryNumber = input.getAttribute("data-detail-entry");
      var committed = input.value;
      bindQuietField(input, committed);
      input.addEventListener("change", function () {
        var value = input.value;
        if (value === committed) return;
        input.setAttribute("data-dirty", "false");
        state.focusEntry = entryNumber;
        state.focusField = "detail";
        helpers.commit(
          function () {
            return global.DiyaGlBooksEdits.changeDetail(state.book, state.lines, entryNumber, value);
          },
          "rename " + entryNumber + " to " + value,
          "Renamed " + entryNumber + ".",
        );
      });
    });

    each(root, "[data-miles-entry]", function (input) {
      var entryNumber = input.getAttribute("data-miles-entry");
      var committed = input.value;
      bindQuietField(input, committed);
      input.addEventListener("change", function () {
        var raw = input.value.trim();
        if (raw === committed) return;
        var miles = raw === "" ? null : parseMiles(raw);
        if (raw !== "" && miles === null) {
          input.value = committed;
          input.setAttribute("data-dirty", "false");
          helpers.showToast(MILES_MESSAGE);
          return;
        }
        input.setAttribute("data-dirty", "false");
        state.focusEntry = entryNumber;
        state.focusField = "miles";
        helpers.commit(
          function () {
            return global.DiyaGlBooksEdits.changeMiles(state.book, state.lines, entryNumber, miles);
          },
          miles === null ? "clear " + entryNumber + "'s miles" : "set " + entryNumber + " to " + fmtCount(miles) + " miles",
          miles === null ? "Cleared " + entryNumber + "'s miles." : "Set " + entryNumber + " to " + fmtCount(miles) + " miles.",
        );
      });
    });

    each(root, "[data-add-fare]", function (btn) {
      btn.addEventListener("click", function () {
        var day = btn.getAttribute("data-add-fare");
        bag.draft = { kind: "fare", day: day, weekStart: null, amount: "", detail: "", miles: "" };
        helpers.render();
      });
    });
    each(root, "[data-add-caption]", function (btn) {
      btn.addEventListener("click", function () {
        bag.draft = { kind: btn.getAttribute("data-add-caption"), day: null, weekStart: btn.getAttribute("data-week"), amount: "" };
        helpers.render();
      });
    });

    function cancelDraft() {
      bag.pendingFocus = openerSelector(bag.draft);
      bag.draft = null;
      helpers.render();
    }

    function commitDraft() {
      var draft = bag.draft;
      var noun = draft.kind === "fare" ? "fare" : CAPTIONS[draft.kind].noun;
      var amount = parseAmount(draft.amount);
      if (amount === null || amount === 0) {
        helpers.showToast("Give the new " + noun + " an amount first.");
        return;
      }
      if (draft.kind === "fare" && String(draft.miles || "").trim() !== "" && parseMiles(draft.miles) === null) {
        helpers.showToast(MILES_MESSAGE);
        return;
      }
      var week = draft.kind === "fare" ? null : weekOfDraft(draft);
      var entry = draftLine(draft, week);
      var where =
        draft.kind === "fare"
          ? "a fare of " + helpers.fmtMoney(amount) + " on " + dayLabel(draft.day)
          : noun + " of " + helpers.fmtMoney(amount) + " for " + weekLabel(week);
      bag.pendingFocus = openerSelector(draft);
      bag.draft = null;
      helpers.commit(
        function () {
          return global.DiyaGlBooksEdits.addEntry(state.book, state.lines, entry);
        },
        "add " + where,
        "Added " + where + ".",
      );
    }

    each(root, "[data-draft-field]", function (input) {
      input.addEventListener("input", function () {
        bag.draft[input.getAttribute("data-draft-field")] = input.value;
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          commitDraft();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          cancelDraft();
        }
      });
    });
    each(root, "[data-draft-commit]", function (btn) {
      btn.addEventListener("click", commitDraft);
    });
    each(root, "[data-draft-cancel]", function (btn) {
      btn.addEventListener("click", cancelDraft);
    });

    each(root, "[data-offgrid-helper]", function (btn) {
      btn.addEventListener("click", function () {
        var n = snapshot().takings.offGrid.length;
        var count = n + (n === 1 ? " entry" : " entries");
        helpers.commit(
          function () {
            return global.DiyaGlBooksEdits.applyHelper({ book: state.book, lines: state.lines }, DATES_IN_PERIOD_CHECK);
          },
          "move " + count + " into the period",
          "Moved " + count + " into the period.",
        );
      });
    });

    if (bag.pendingFocus) {
      var target = root.querySelector(bag.pendingFocus);
      bag.pendingFocus = null;
      if (target) target.focus();
    } else if (bag.draft) {
      var amountField = root.querySelector('[data-draft-field="amount"]');
      if (amountField) amountField.focus();
    }
  }

  // Enter commits by leaving the field, Escape puts the committed value
  // back, and typing marks the field dirty -- the shared grid's own manners.
  function bindQuietField(input, committed) {
    input.addEventListener("input", function () {
      input.setAttribute("data-dirty", input.value === committed ? "false" : "true");
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
      if (e.key === "Escape") {
        input.value = committed;
        input.setAttribute("data-dirty", "false");
      }
    });
  }

  global.DiyaGlTaxiTakings = {
    renderMonthDetail: renderMonthDetail,
    bind: bind,
    internals: {
      weekLabel: weekLabel,
      dayLabel: dayLabel,
      draftLine: draftLine,
      levelsFor: levelsFor,
      subtotals: subtotals,
      parseAmount: parseAmount,
      parseMiles: parseMiles,
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
