// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/headlines.js
//
// The "year at a glance" strip: four stat tiles and two pies, mounted once
// at the top of the books page's main column, plus the "through the year"
// charts (the outgoings-by-category bar, the monthly columns and the
// cumulative-profit line) collapsed underneath.
//
// mountHeadlines(container, opts) paints the strip into container and
// returns { refresh(snapshot) } so a caller can repaint after every load or
// edit without re-mounting. opts carries three things this module never
// computes for itself: the books-page snapshot data.js builds
// (window.DIYA_BOOKS_SNAPSHOT's shape), the pure headlinesFromReport()
// function from app/lib/headlines.js (so the browser and the Node test
// derive the same tiles from the same R keys), and formatMoney (the page's
// own currency formatter, so the strip's figures render exactly like every
// other figure on the page).
//
// This module builds its own minimal R document from the snapshot's
// already-calculated sub-objects (annual, fixedAssets, stock, debtors,
// incomeTax) rather than from a raw sheet/cell results map, because the
// snapshot data.js assembles carries only those derived views, not the
// full results object the R keys nominally come from. Every value the
// adapter reads traces back to the same calculated figures those keys
// name -- see reportFromSnapshot() below.

(function (global) {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtPercent(share) {
    return (share * 100).toFixed(1) + "%";
  }

  // ============================== R adapter ==============================

  // The Debtors & Creditors sheet's "Amount owed by customers" total (C29)
  // is the year's opening debtor balance plus every month's new sales not
  // yet received -- not a running balance that falls as customers pay, but
  // a cumulative count of invoiced-and-outstanding sales across the year.
  // The snapshot's debtors object carries the same opening figure and the
  // same twelve monthly figures the sheet does, so summing them here
  // reproduces C29 exactly.
  function debtorsTotal(debtors) {
    var total = (debtors && debtors.opening) || 0;
    var monthly = (debtors && debtors.monthly) || [];
    for (var i = 0; i < monthly.length; i++) total += monthly[i];
    return total;
  }

  var EXPENSE_CELL_KEYS = [
    ["C11", "employeeCosts"],
    ["C12", "premisesCosts"],
    ["C13", "repairs"],
    ["C14", "generalAdmin"],
    ["C15", "motorExpenses"],
    ["C16", "travel"],
    ["C17", "advertising"],
    ["C18", "legalProfessional"],
    ["C19", "badDebts"],
    ["C20", "interestFinance"],
    ["C21", "otherExpenses"],
  ];

  function cell(sheet, ref, value) {
    return { key: "cell/" + sheet + "!" + ref, value: String(value) };
  }

  // The minimal R document headlinesFromReport() needs: every P&L cell the
  // four expense lines and the outgoings bridge read, the three optional
  // year-end asset cells, and the tax total -- each traced back to the
  // snapshot's own annual/fixedAssets/stock/debtors/incomeTax figures.
  function reportFromSnapshot(snapshot) {
    var a = snapshot.annual || {};
    var values = [
      cell("Profit & Loss Acc", "C4", a.sales || 0),
      cell("Profit & Loss Acc", "C6", a.costOfSales || 0),
      cell("Profit & Loss Acc", "C7", a.directCosts || 0),
      cell("Profit & Loss Acc", "C22", a.totalExpenses || 0),
      cell("Fixed Assets", "M1", (snapshot.fixedAssets && snapshot.fixedAssets.writtenDownValue) || 0),
      cell("PurchasesStock", "D30", (snapshot.stock && snapshot.stock.closing) || 0),
      cell("Debtors & Creditors", "C29", debtorsTotal(snapshot.debtors)),
      cell("Income Tax", "E18", (snapshot.incomeTax && snapshot.incomeTax.totalTaxAndNi) || 0),
    ];
    EXPENSE_CELL_KEYS.forEach(function (pair) {
      values.push(cell("Profit & Loss Acc", pair[0], a[pair[1]] || 0));
    });
    return { values: values };
  }

  // ============================== palette ==============================
  // One hue -- the site's teal -- stepped light to dark from the largest
  // slice, defined as CSS custom properties (see the /* headlines */
  // section of bst.css) so dark mode swaps the ramp without this module
  // knowing which theme is active. Validated with the dataviz skill's
  // validate_palette.js in --ordinal mode: the check for a single hue
  // stepped by magnitude, not the categorical checks that exist to keep
  // unrelated series apart from each other. Running the categorical checks
  // on a one-hue ramp fails by design and is not a real failure, per the
  // skill's own color-formula reference. Five steps: six failed the
  // dark-mode ramp's adjacent-lightness-gap check at this hue (teal's sRGB
  // gamut narrows sharply below OKLCH L ~0.6), so the cap dropped to five,
  // and the strip folds a sixth outgoings-pie slice into "Other" before
  // assigning colour.
  var PALETTE_SIZE = 5;

  function paletteVar(rank) {
    return "var(--headline-pie-" + (Math.min(rank, PALETTE_SIZE - 1) + 1) + ")";
  }

  // Colour by rank of |value|, largest first -- the ordinal job -- while
  // the slices themselves stay in whatever order the caller wants to draw
  // and list them in (the bridge's narrative order for turnover, ranked
  // order for outgoings).
  function colorsByRank(slices) {
    var order = slices
      .map(function (s, i) {
        return { i: i, v: Math.abs(s.value) };
      })
      .sort(function (a, b) {
        return b.v - a.v;
      });
    var colors = new Array(slices.length);
    order.forEach(function (entry, rank) {
      colors[entry.i] = paletteVar(rank);
    });
    return colors;
  }

  // Folds every slice past the four largest into one merged "Other" slice,
  // by value rather than by array position (the outgoings pie's own
  // "Other" bucket is appended last but is not always the smallest), so
  // the strip never asks the five-step palette to colour a sixth slice.
  function capSlicesForPalette(slices) {
    if (slices.length <= PALETTE_SIZE) return slices;
    var ranked = slices
      .map(function (s, i) {
        return i;
      })
      .sort(function (a, b) {
        return Math.abs(slices[b].value) - Math.abs(slices[a].value);
      });
    var kept = {};
    ranked.slice(0, PALETTE_SIZE - 1).forEach(function (i) {
      kept[i] = true;
    });
    var result = [];
    var mergedValue = 0,
      mergedShare = 0,
      mergedFrom = [];
    slices.forEach(function (s, i) {
      if (kept[i]) {
        result.push(s);
      } else {
        mergedValue += s.value;
        mergedShare += s.share;
        mergedFrom = mergedFrom.concat(s.from || []);
      }
    });
    result.push({ label: "Other", value: mergedValue, share: mergedShare, from: mergedFrom });
    return result;
  }

  // ============================== pie / bar geometry ==============================

  function polarToCartesian(cx, cy, r, angleDeg) {
    var rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
    var so = polarToCartesian(cx, cy, rOuter, endAngle);
    var eo = polarToCartesian(cx, cy, rOuter, startAngle);
    var si = polarToCartesian(cx, cy, rInner, startAngle);
    var ei = polarToCartesian(cx, cy, rInner, endAngle);
    var large = endAngle - startAngle > 180 ? 1 : 0;
    return (
      "M " +
      so.x.toFixed(2) +
      " " +
      so.y.toFixed(2) +
      " A " +
      rOuter +
      " " +
      rOuter +
      " 0 " +
      large +
      " 0 " +
      eo.x.toFixed(2) +
      " " +
      eo.y.toFixed(2) +
      " L " +
      si.x.toFixed(2) +
      " " +
      si.y.toFixed(2) +
      " A " +
      rInner +
      " " +
      rInner +
      " 0 " +
      large +
      " 1 " +
      ei.x.toFixed(2) +
      " " +
      ei.y.toFixed(2) +
      " Z"
    );
  }

  // The pie draws at its own size: one user unit is one rendered pixel, so
  // an 11px label is 11px on screen. The legend sits beside the chart, so
  // the canvas is only as wide as the circle plus the room a direct label
  // needs on either side.
  var PIE_W = 210;
  var PIE_H = 186;
  var PIE_CX = 105;
  var PIE_CY = 90;
  var PIE_R_OUTER = 58;
  var PIE_R_INNER = 29;
  var DIRECT_LABEL_SHARE = 0.08;
  var DIRECT_LABEL_FONT_PX = 11;

  function sliceInfoText(slice, formatMoney) {
    return slice.label + " " + formatMoney(slice.value) + " (" + fmtPercent(slice.share) + ")";
  }

  // A direct on-chart label is drawn whole or not at all. "Running cos…"
  // tells a reader less than no label does, and the legend and the tooltip
  // carry the full name either way. Arial's average glyph runs a little
  // over half the font size wide, near enough to say whether a name clears
  // the canvas edge.
  function labelFits(label, roomPx) {
    return label.length * DIRECT_LABEL_FONT_PX * 0.56 <= roomPx;
  }

  function truncateLabel(label, maxChars) {
    if (label.length <= maxChars) return label;
    return label.slice(0, maxChars - 1) + "…";
  }

  function renderPieSvg(id, slices, colors, formatMoney) {
    // A ~1.2deg gap in the surface colour between wedges (a real gap, not a
    // stroke -- a stroke drawn around a mark adds ink that isn't data) --
    // the arc-length equivalent of about 2px at this radius.
    var gapDeg = (2 / PIE_R_OUTER) * (180 / Math.PI);
    var total = slices.reduce(function (s, sl) {
      return s + Math.abs(sl.value);
    }, 0);
    var angle = 0;
    var wedges = "";
    var labels = "";
    slices.forEach(function (slice, i) {
      var span = total === 0 ? 360 / slices.length : (Math.abs(slice.value) / total) * 360;
      var start = angle + gapDeg / 2;
      var end = angle + span - gapDeg / 2;
      if (end < start) end = start;
      var mid = (start + end) / 2;
      var info = sliceInfoText(slice, formatMoney);
      wedges +=
        '<path data-slice-info="' +
        esc(info) +
        '" data-slice-index="' +
        i +
        '" d="' +
        arcPath(PIE_CX, PIE_CY, PIE_R_OUTER, PIE_R_INNER, start, end) +
        '" fill="' +
        colors[i] +
        '"><title>' +
        esc(info) +
        "</title></path>";
      var textPoint = polarToCartesian(PIE_CX, PIE_CY, PIE_R_OUTER + 14, mid);
      var anchor = textPoint.x >= PIE_CX ? "start" : "end";
      var room = anchor === "start" ? PIE_W - textPoint.x - 2 : textPoint.x - 2;
      if (slice.share >= DIRECT_LABEL_SHARE && labelFits(slice.label, room)) {
        var leaderStart = polarToCartesian(PIE_CX, PIE_CY, PIE_R_OUTER + 2, mid);
        var leaderEnd = polarToCartesian(PIE_CX, PIE_CY, PIE_R_OUTER + 11, mid);
        labels +=
          '<line x1="' +
          leaderStart.x.toFixed(1) +
          '" y1="' +
          leaderStart.y.toFixed(1) +
          '" x2="' +
          leaderEnd.x.toFixed(1) +
          '" y2="' +
          leaderEnd.y.toFixed(1) +
          '" class="headline-pie-leader"></line>' +
          '<text x="' +
          textPoint.x.toFixed(1) +
          '" y="' +
          textPoint.y.toFixed(1) +
          '" text-anchor="' +
          anchor +
          '" class="headline-pie-direct-label">' +
          esc(slice.label) +
          "</text>";
      }
      angle += span;
    });
    return (
      '<svg viewBox="0 0 ' +
      PIE_W +
      " " +
      PIE_H +
      '" class="headline-pie-svg" role="img" aria-label="' +
      esc(id) +
      '">' +
      wedges +
      labels +
      "</svg>"
    );
  }

  var BAR_WIDTH = 320;
  var BAR_ROW_H = 40;

  function renderBarSvg(slices, colors, formatMoney) {
    var total = slices.reduce(function (s, sl) {
      return s + Math.abs(sl.value);
    }, 0);
    var gap = 2;
    var innerWidth = BAR_WIDTH - gap * (slices.length - 1);
    var x = 0;
    var segments = "";
    slices.forEach(function (slice, i) {
      var w = total === 0 ? innerWidth / slices.length : (Math.abs(slice.value) / total) * innerWidth;
      var info = sliceInfoText(slice, formatMoney);
      segments +=
        '<rect data-slice-info="' +
        esc(info) +
        '" data-slice-index="' +
        i +
        '" x="' +
        x.toFixed(1) +
        '" y="0" width="' +
        Math.max(w, 0).toFixed(1) +
        '" height="' +
        BAR_ROW_H +
        '" rx="4" fill="' +
        colors[i] +
        '"><title>' +
        esc(info) +
        "</title></rect>";
      x += w + gap;
    });
    return (
      '<svg viewBox="0 0 ' +
      BAR_WIDTH +
      " " +
      BAR_ROW_H +
      '" class="headline-bar-svg" role="img" aria-label="A horizontal bar, since the year cannot be split into positive slices">' +
      segments +
      "</svg>"
    );
  }

  function renderLegend(id, slices, colors, formatMoney) {
    return (
      '<ul class="headline-legend" data-pie-legend="' +
      id +
      '">' +
      slices
        .map(function (slice, i) {
          var info = sliceInfoText(slice, formatMoney);
          return (
            '<li><button type="button" class="headline-legend-item" data-slice-info="' +
            esc(info) +
            '" data-slice-index="' +
            i +
            '"><span class="headline-legend-swatch" style="background:' +
            colors[i] +
            '"></span><span class="headline-legend-text">' +
            esc(info) +
            "</span></button></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function renderSliceTable(id, slices, formatMoney) {
    return (
      '<table class="headline-pie-table visually-hidden" data-pie-table="' +
      id +
      '"><caption class="visually-hidden">' +
      esc(id) +
      ', as a table</caption><thead><tr><th scope="col">Category</th><th scope="col">Amount</th><th scope="col">Share</th></tr></thead><tbody>' +
      slices
        .map(function (slice) {
          return (
            '<tr><th scope="row">' +
            esc(slice.label) +
            "</th><td>" +
            esc(formatMoney(slice.value)) +
            "</td><td>" +
            esc(fmtPercent(slice.share)) +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>"
    );
  }

  // slices.length === 2 is never a pie (a two-slice pie says nothing a
  // single percentage doesn't) -- treated the same as the bar-mode branch.
  function isBarMode(pie) {
    return pie.mode === "bar" || pie.slices.length === 2;
  }

  function renderPieBlock(id, title, pie, formatMoney) {
    var slices = capSlicesForPalette(pie.slices);
    var colors = colorsByRank(slices);
    var bar = isBarMode(pie);
    var chrome = bar ? renderBarSvg(slices, colors, formatMoney) : renderPieSvg(title, slices, colors, formatMoney);
    var reason = bar && pie.reason ? '<p class="headline-pie-reason">' + esc(pie.reason) + "</p>" : "";
    return (
      '<div class="headline-pie-block" data-pie-block="' +
      id +
      '"><h3>' +
      esc(title) +
      "</h3>" +
      reason +
      '<div class="headline-pie-chrome">' +
      chrome +
      renderLegend(id, slices, colors, formatMoney) +
      "</div>" +
      '<button type="button" class="headline-table-toggle" data-pie-table-toggle="' +
      id +
      '" aria-expanded="false">Show as table</button>' +
      renderSliceTable(id, slices, formatMoney) +
      '<div class="headline-tooltip" role="tooltip" hidden></div>' +
      "</div>"
    );
  }

  // ============================== tiles ==============================

  function tile(label, key, valueText, sub) {
    return (
      '<div class="headline-tile"><div class="headline-tile-label">' +
      esc(label) +
      '</div><div class="headline-tile-value" data-r-key="' +
      key +
      '">' +
      esc(valueText) +
      "</div>" +
      (sub ? '<div class="headline-tile-sub">' + sub + "</div>" : "") +
      "</div>"
    );
  }

  function renderTiles(headlines, formatMoney) {
    var t = headlines.tiles;
    return (
      '<div class="headline-tiles">' +
      tile("Turnover", "headline/turnover", formatMoney(t.turnover.value), "") +
      tile(
        "Outgoings",
        "headline/outgoings",
        formatMoney(t.outgoings.total.value),
        "cost of sales " +
          esc(formatMoney(t.outgoings.costOfSales.value)) +
          " &middot; running costs " +
          esc(formatMoney(t.outgoings.runningCosts.value)),
      ) +
      tile(
        "Assets",
        "headline/assets",
        formatMoney(t.assets.total.value),
        "written-down " +
          esc(formatMoney(t.assets.writtenDown.value)) +
          " &middot; stock " +
          esc(formatMoney(t.assets.stock.value)) +
          '<span class="headline-tile-aside">owed to you ' +
          esc(formatMoney(t.assets.debtors.value)) +
          ", counted separately</span>",
      ) +
      tile("Tax", "headline/tax", formatMoney(t.tax.value), "income tax and Class 4 NI, less CIS") +
      "</div>"
    );
  }

  // ============================== through the year ==============================

  var THROUGH_YEAR_KEY = "diyaGlHeadlinesThroughYearOpen";
  // The monthly columns chart carries twelve categories and stays legible
  // scrolled on a mobile card, matching the year table's own horizontal
  // scroll elsewhere in this app. The outgoings bar and the cumulative
  // line carry far less per row, so they fit a mobile card's width
  // natively -- no scroll, no risk of the value label running past the
  // canvas edge (the earlier bug here: a value label's x-position tracked
  // its own bar's width, so the widest bar pushed its label straight past
  // the viewBox and it was silently clipped).
  var CHART_W_WIDE = 480;
  var CHART_W_COMPACT = 300;

  // Closed until the reader asks for it, so the year table starts within
  // the first screen; the choice is then remembered.
  function readStoredOpen() {
    try {
      return global.localStorage.getItem(THROUGH_YEAR_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function writeStoredOpen(open) {
    try {
      global.localStorage.setItem(THROUGH_YEAR_KEY, open ? "1" : "0");
    } catch (e) {
      // localStorage unavailable (private browsing, blocked storage) --
      // the through-year block just stops remembering its state.
    }
  }

  var OUTGOINGS_BAR_LEFT_COL = 108;
  var OUTGOINGS_BAR_RIGHT_ZONE = 78;
  var OUTGOINGS_BAR_LABEL_MAX_CHARS = 15;

  // The category name sits at a fixed left column and the value at a
  // fixed right-anchored position -- both independent of the bar's own
  // length, so neither can ever run past the canvas edge the way a
  // length-tracking label could.
  function renderOutgoingsBarChart(headlines, formatMoney) {
    var slices = capSlicesForPalette(headlines.pies.outgoings.slices);
    var colors = colorsByRank(slices);
    var rowH = 32;
    var height = rowH * slices.length + 8;
    var barMaxWidth = CHART_W_COMPACT - OUTGOINGS_BAR_LEFT_COL - OUTGOINGS_BAR_RIGHT_ZONE - 6;
    var largest = slices.reduce(function (m, s) {
      return Math.max(m, Math.abs(s.value));
    }, 1);
    var y = 6;
    var rows = slices
      .map(function (slice, i) {
        var w = Math.max((Math.abs(slice.value) / largest) * barMaxWidth, 1);
        var row =
          '<text x="0" y="' +
          (y + 14) +
          '" class="headline-chart-label">' +
          esc(truncateLabel(slice.label, OUTGOINGS_BAR_LABEL_MAX_CHARS)) +
          "</text>" +
          '<rect x="' +
          OUTGOINGS_BAR_LEFT_COL +
          '" y="' +
          y +
          '" width="' +
          w.toFixed(1) +
          '" height="18" rx="3" fill="' +
          colors[i] +
          '"></rect>' +
          '<text x="' +
          (CHART_W_COMPACT - 4) +
          '" y="' +
          (y + 14) +
          '" text-anchor="end" class="headline-chart-value">' +
          esc(formatMoney(slice.value)) +
          "</text>";
        y += rowH;
        return row;
      })
      .join("");
    return (
      '<div class="headline-chart-block"><h4>Where the costs are</h4>' +
      '<svg viewBox="0 0 ' +
      CHART_W_COMPACT +
      " " +
      height +
      '" class="headline-chart-svg headline-chart-svg--compact" role="img" aria-label="Outgoings by category, largest first">' +
      rows +
      "</svg></div>"
    );
  }

  var MONTH_COLORS = { turnover: "#2f6b4f", costs: "#b3402a", profit: "#93c4ac" };

  function renderMonthlyColumnsChart(snapshot) {
    var months = snapshot.months;
    var width = CHART_W_WIDE;
    var height = 240;
    var padding = 34;
    var chartW = width - padding * 2;
    var chartH = height - padding - 30;
    var groupW = chartW / months.length;
    var barW = groupW / 3.6;
    var maxVal = Math.max.apply(
      null,
      months.map(function (m) {
        var r = snapshot.monthly[m.key];
        return Math.max(r.sales, r.totalExpenses + r.costOfSales + r.directCosts);
      }),
    );
    var bars = months
      .map(function (m, index) {
        var r = snapshot.monthly[m.key];
        var x = padding + index * groupW;
        var costs = r.costOfSales + r.directCosts + r.totalExpenses;
        var salesH = maxVal === 0 ? 0 : (r.sales / maxVal) * chartH;
        var costsH = maxVal === 0 ? 0 : (costs / maxVal) * chartH;
        var profitH = maxVal === 0 ? 0 : (Math.max(r.netProfit, 0) / maxVal) * chartH;
        var base = height - padding - 20;
        return (
          '<rect x="' +
          x.toFixed(1) +
          '" y="' +
          (base - salesH).toFixed(1) +
          '" width="' +
          barW.toFixed(1) +
          '" height="' +
          salesH.toFixed(1) +
          '" fill="' +
          MONTH_COLORS.turnover +
          '"></rect>' +
          '<rect x="' +
          (x + barW + 2).toFixed(1) +
          '" y="' +
          (base - costsH).toFixed(1) +
          '" width="' +
          barW.toFixed(1) +
          '" height="' +
          costsH.toFixed(1) +
          '" fill="' +
          MONTH_COLORS.costs +
          '"></rect>' +
          '<rect x="' +
          (x + (barW + 2) * 2).toFixed(1) +
          '" y="' +
          (base - profitH).toFixed(1) +
          '" width="' +
          barW.toFixed(1) +
          '" height="' +
          profitH.toFixed(1) +
          '" fill="' +
          MONTH_COLORS.profit +
          '"></rect>' +
          '<text x="' +
          (x + groupW / 2).toFixed(1) +
          '" y="' +
          (height - 8) +
          '" text-anchor="middle" class="headline-chart-label">' +
          esc(m.label) +
          "</text>"
        );
      })
      .join("");
    return (
      '<div class="headline-chart-block"><h4>Turnover, costs and profit by month</h4>' +
      // The one chart wider than a phone card scrolls, so it is a focus
      // stop of its own: a keyboard has to be able to reach and move it.
      '<div class="headline-chart-scroll" tabindex="0" role="group" aria-label="Monthly turnover, costs and profit, scrollable"><svg viewBox="0 0 ' +
      width +
      " " +
      height +
      '" class="headline-chart-svg" role="img" aria-label="Monthly turnover, costs and profit">' +
      bars +
      "</svg></div>" +
      '<div class="headline-legend headline-legend--static">' +
      '<span><span class="headline-legend-swatch" style="background:' +
      MONTH_COLORS.turnover +
      '"></span>Turnover</span>' +
      '<span><span class="headline-legend-swatch" style="background:' +
      MONTH_COLORS.costs +
      '"></span>Costs</span>' +
      '<span><span class="headline-legend-swatch" style="background:' +
      MONTH_COLORS.profit +
      '"></span>Profit</span>' +
      "</div></div>"
    );
  }

  // Its own small chart on its own axis -- never a second scale bolted onto
  // the monthly columns above, which would invent a false alignment between
  // two measures of different size (see the dataviz method's dual-axis
  // anti-pattern).
  function renderCumulativeProfitChart(snapshot, formatMoney) {
    var months = snapshot.months;
    var width = CHART_W_COMPACT;
    var height = 130;
    var leftPadding = 10;
    var rightPadding = 100; // room for the end-of-line value label
    var topPadding = 16;
    var bottomPadding = 16;
    var chartW = width - leftPadding - rightPadding;
    var chartH = height - topPadding - bottomPadding;
    var cumulative = 0;
    var values = months.map(function (m) {
      cumulative += snapshot.monthly[m.key].netProfit;
      return cumulative;
    });
    var maxAbs = Math.max.apply(
      null,
      values.map(function (v) {
        return Math.abs(v);
      }),
    );
    if (maxAbs === 0) maxAbs = 1;
    var zeroY = topPadding + chartH / 2;
    var points = months.map(function (m, i) {
      var x = leftPadding + (chartW / (months.length - 1 || 1)) * i;
      var y = zeroY - (values[i] / maxAbs) * (chartH / 2);
      return { x: x, y: y };
    });
    var linePath = points
      .map(function (p, i) {
        return (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1);
      })
      .join(" ");
    var dots = points
      .map(function (p, i) {
        var info = "Cumulative profit to " + esc(months[i].label) + ": " + esc(formatMoney(values[i]));
        return (
          '<circle cx="' +
          p.x.toFixed(1) +
          '" cy="' +
          p.y.toFixed(1) +
          '" r="4" fill="var(--rule)" stroke="var(--paper-raised)" stroke-width="2"><title>' +
          info +
          "</title></circle>"
        );
      })
      .join("");
    var last = points[points.length - 1];
    var endLabel = last
      ? '<text x="' +
        (last.x + 8).toFixed(1) +
        '" y="' +
        (last.y + 4).toFixed(1) +
        '" class="headline-chart-value">' +
        esc(formatMoney(values[values.length - 1])) +
        "</text>"
      : "";
    return (
      '<div class="headline-chart-block"><h4>Cumulative profit</h4>' +
      '<svg viewBox="0 0 ' +
      width +
      " " +
      height +
      '" class="headline-chart-svg headline-chart-svg--compact" role="img" aria-label="Cumulative profit, month by month">' +
      '<line x1="' +
      leftPadding +
      '" y1="' +
      zeroY.toFixed(1) +
      '" x2="' +
      (leftPadding + chartW).toFixed(1) +
      '" y2="' +
      zeroY.toFixed(1) +
      '" class="headline-chart-zero-line"></line>' +
      '<path d="' +
      linePath +
      '" fill="none" stroke="var(--rule)" stroke-width="2"></path>' +
      dots +
      endLabel +
      "</svg></div>"
    );
  }

  function renderThroughYear(headlines, snapshot, formatMoney) {
    var open = readStoredOpen();
    return (
      '<details class="headline-through-year"' +
      (open ? " open" : "") +
      "><summary>Through the year</summary>" +
      '<div class="headline-through-year-body">' +
      renderOutgoingsBarChart(headlines, formatMoney) +
      renderMonthlyColumnsChart(snapshot) +
      renderCumulativeProfitChart(snapshot, formatMoney) +
      "</div></details>"
    );
  }

  // ============================== interaction ==============================

  function bindTooltip(block) {
    var tooltip = block.querySelector(".headline-tooltip");
    if (!tooltip) return;

    function place(el) {
      var elRect = el.getBoundingClientRect();
      var blockRect = block.getBoundingClientRect();
      tooltip.style.left = elRect.left - blockRect.left + elRect.width / 2 + "px";
      tooltip.style.top = elRect.top - blockRect.top + "px";
    }
    function show(el) {
      tooltip.textContent = el.getAttribute("data-slice-info") || "";
      tooltip.hidden = false;
      place(el);
      highlight(block, el.getAttribute("data-slice-index"));
    }
    function hide() {
      tooltip.hidden = true;
      highlight(block, null);
    }

    var targets = block.querySelectorAll("[data-slice-info]");
    Array.prototype.forEach.call(targets, function (el) {
      el.addEventListener("mouseenter", function () {
        show(el);
      });
      el.addEventListener("mouseleave", hide);
      el.addEventListener("focus", function () {
        show(el);
      });
      el.addEventListener("blur", hide);
    });
  }

  function highlight(block, index) {
    var marks = block.querySelectorAll("[data-slice-index]");
    Array.prototype.forEach.call(marks, function (el) {
      var active = index !== null && el.getAttribute("data-slice-index") === index;
      el.classList.toggle("is-active", active);
      el.classList.toggle("is-dimmed", index !== null && !active);
    });
  }

  function bindTableToggle(root) {
    var buttons = root.querySelectorAll("[data-pie-table-toggle]");
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-pie-table-toggle");
        var table = root.querySelector('[data-pie-table="' + id + '"]');
        if (!table) return;
        var willShow = table.classList.contains("visually-hidden");
        table.classList.toggle("visually-hidden", !willShow);
        btn.setAttribute("aria-expanded", willShow ? "true" : "false");
        btn.textContent = willShow ? "Hide table" : "Show as table";
      });
    });
  }

  function bindThroughYear(root) {
    var details = root.querySelector(".headline-through-year");
    if (!details) return;
    details.addEventListener("toggle", function () {
      writeStoredOpen(details.open);
    });
  }

  function bindInteractions(root) {
    var pieBlocks = root.querySelectorAll("[data-pie-block]");
    Array.prototype.forEach.call(pieBlocks, bindTooltip);
    bindTableToggle(root);
    bindThroughYear(root);
  }

  // ============================== mount ==============================

  function renderStrip(headlines, snapshot, formatMoney) {
    return (
      '<section class="headlines-strip" aria-label="Year at a glance">' +
      renderTiles(headlines, formatMoney) +
      '<div class="headline-pies">' +
      renderPieBlock("turnover", "Where the turnover went", headlines.pies.turnover, formatMoney) +
      renderPieBlock("outgoings", "Outgoings by category", { mode: "pie", slices: headlines.pies.outgoings.slices }, formatMoney) +
      "</div>" +
      renderThroughYear(headlines, snapshot, formatMoney) +
      "</section>"
    );
  }

  // opts.report is R itself when the caller has it (the page passes the
  // report its snapshot already carries); otherwise the minimal R above is
  // rebuilt from the snapshot's derived figures.
  function mountHeadlines(container, opts) {
    var formatMoney = opts.formatMoney;
    function paint(snapshot) {
      var report = opts.report || reportFromSnapshot(snapshot);
      var headlines = opts.headlinesFromReport(report);
      container.innerHTML = renderStrip(headlines, snapshot, formatMoney);
      bindInteractions(container);
      return headlines;
    }
    paint(opts.snapshot);
    return { refresh: paint };
  }

  global.DiyaGlHeadlines = {
    mountHeadlines: mountHeadlines,
    reportFromSnapshot: reportFromSnapshot,
  };
})(window);
