// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 DIY Accounting Ltd

// books/shell.js
//
// The books page shell: state, the empty state, the file picker and drop
// zone, deep links, autosave, undo, the inspector, the save menu, the toast,
// the mobile bars, the drift walker and the two shared views (home and the
// month-in-a-year table). Which views a page carries, how its month rows
// group and what its snapshot holds come from the product manifest
// (books/products/<id>.js) the page names in body[data-product]; the shell
// mounts that manifest and can mount another when a file sniffs as a
// different product. Every figure it renders comes from the snapshot data.js
// computes (window.DIYA_BOOKS_SNAPSHOT); every change it makes goes out
// through edits.js, which reaches the engine's own edit functions. This
// file imports no engine module of its own.

(function () {
  "use strict";

  var SNAPSHOT = null;
  var active = null;

  var state = {
    loaded: false,
    view: "home",
    openMonth: null,
    drawerOpen: false,
    mobileTab: "books",
    newBookFormOpen: false,
    savedBook: null, // { book, lines, source, savedAt }, once the autosave check resolves
    // The live book: D as the page currently holds it. Every edit replaces
    // state.lines with the array edits.js returned and recomputes the
    // whole book from it -- there is no incremental update.
    book: null,
    lines: null,
    context: null,
    bookChecks: [],
    openHelper: null,
    committing: false,
    focusEntry: null,
    focusField: null,
    // One bag per view id, created on first use and emptied on every load.
    views: {},
  };

  var els = {};

  document.addEventListener("DOMContentLoaded", init);

  // ============================== boot and mount ==============================

  function init() {
    els.app = document.getElementById("app");
    els.topbarTitle = document.getElementById("app-title");
    els.sheetTabs = document.getElementById("sheet-tabs");
    els.viewRoot = document.getElementById("view-root");
    els.appBody = document.querySelector(".app-body");
    els.inspector = document.getElementById("inspector");
    els.inspectorDrawer = document.getElementById("inspector-drawer");
    els.drawerBackdrop = document.getElementById("drawer-backdrop");
    els.mobileTabbar = document.getElementById("mobile-tabbar");
    els.mobileActionBar = document.getElementById("mobile-action-bar");
    els.toast = document.getElementById("toast");
    els.themeToggle = document.getElementById("theme-toggle");
    els.saveBtn = document.getElementById("save-btn");
    els.saveBtnMobile = document.getElementById("save-btn-mobile");
    els.undoBtn = document.getElementById("undo-btn");
    els.undoBtnMobile = document.getElementById("undo-btn-mobile");
    els.drawerToggleBtn = document.getElementById("drawer-toggle-btn");

    bindGlobalControls();

    var productId = document.body.dataset.product;
    var manifest = window.DiyaGlProducts && window.DiyaGlProducts[productId];
    if (!manifest)
      throw new Error("body[data-product] names " + JSON.stringify(productId) + ", and no products/" + productId + ".js is loaded.");
    mount(manifest).then(function () {
      // A link carrying ?example=... loads that book on its own -- it never
      // reads or writes the autosave record, so whatever a reader had saved
      // stays untouched and is still offered the next time they arrive
      // without a link. Any other arrival (no example, or view/month alone)
      // is a plain arrival: the continue offer works exactly as before.
      var deepLink = parseDeepLinkParams();
      if (deepLink.example) {
        bootFromDeepLink(deepLink);
      } else {
        checkForSavedBook();
      }
    });
  }

  var SHARED_VIEWS = { home: 1, year: 1 };

  function validateManifest(manifest) {
    if (!manifest || !Array.isArray(manifest.views) || manifest.views.length === 0) {
      throw new Error("A product manifest needs a views list.");
    }
    manifest.views.forEach(function (view) {
      if (view.shared && SHARED_VIEWS[view.shared]) return;
      if (typeof view.render === "function") return;
      throw new Error('View "' + view.id + '" of manifest "' + manifest.id + '" has neither a shared renderer nor a render() of its own.');
    });
  }

  // Makes the manifest the page's own: its views on the tab strip, its
  // examples and new-book form in the empty state. Rejects, leaving the
  // current manifest in place, when a view has nothing to render it.
  function mount(manifest) {
    try {
      validateManifest(manifest);
    } catch (error) {
      return Promise.reject(error);
    }
    active = manifest;
    render();
    return Promise.resolve(manifest);
  }

  // The manifest for a product id: the one already on the page, else the
  // script products/<id>.js and its stylesheet <id>.css appended to the
  // document, resolving once the global appears. This is how a workbook of
  // another product dropped on this page mounts that product's views, and
  // how a saved book of another product continues.
  function loadManifest(id) {
    if (window.DiyaGlProducts && window.DiyaGlProducts[id]) return Promise.resolve(window.DiyaGlProducts[id]);
    return new Promise(function (resolve, reject) {
      var src = "products/" + id + ".js";
      var script = document.createElement("script");
      script.src = src;
      script.addEventListener("load", function () {
        var manifest = window.DiyaGlProducts && window.DiyaGlProducts[id];
        if (manifest) {
          var link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = manifest.stylesheet || id + ".css";
          document.head.appendChild(link);
          resolve(manifest);
        } else {
          reject(new Error(src + " did not define DiyaGlProducts." + id));
        }
      });
      script.addEventListener("error", function () {
        reject(new Error(src + " did not define DiyaGlProducts." + id));
      });
      document.head.appendChild(script);
    });
  }

  function ensureManifest(id) {
    return loadManifest(id).then(function (manifest) {
      return manifest === active ? manifest : mount(manifest);
    });
  }

  // The saved-book check runs after the first render so the picker appears
  // immediately; the continue-offer joins it the moment the check resolves.
  // A blocked or missing IndexedDB resolves to null (autosave.js's own
  // degrade contract), so this never blocks or errors the empty state --
  // it just never gets an offer to show.
  function checkForSavedBook() {
    window.DiyaBooksAutosave.loadWorkingBook().then(function (record) {
      state.savedBook = record || null;
      if (!state.loaded) render();
    });
  }

  // ============================== view state ==============================

  function viewState(id, init) {
    if (!state.views[id]) state.views[id] = typeof init === "function" ? init() : Object.assign({}, init);
    return state.views[id];
  }

  function yearState() {
    return viewState("year", function () {
      return { entriesOpen: true, allCategories: loadAllCategoriesPreference(), addDraft: {}, journal: null };
    });
  }

  // ============================== deep links ==============================
  // ?example=<id> loads the named example the moment the page boots, using
  // the same loader the example buttons use. &view=<data-view id> and
  // &month=YYYY-MM land on a view or an open month once it has loaded.
  // Unknown view/month values are ignored; an unknown example shows the
  // empty state with a message naming the ids the manifest knows.

  function parseDeepLinkParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      example: params.get("example"),
      view: params.get("view"),
      month: params.get("month"),
    };
  }

  function getExamples() {
    return (window.DiyaGlExamples && window.DiyaGlExamples[active.id]) || [];
  }

  function exampleKeys() {
    return getExamples().map(function (example) {
      return example.key;
    });
  }

  function bootFromDeepLink(deepLink) {
    if (exampleKeys().indexOf(deepLink.example) === -1) {
      showEmptyStateMessage(
        'Unknown example "' +
          deepLink.example +
          '". The ' +
          countWord(getExamples().length) +
          " this page knows are: " +
          exampleKeys().join(", ") +
          ".",
        true,
      );
      return;
    }
    loadExample(deepLink.example, { skipAutosave: true }).then(function (snapshot) {
      if (snapshot) applyDeepLinkViewAndMonth(deepLink, snapshot);
    });
  }

  var COUNT_WORDS = ["none", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  function countWord(n) {
    return COUNT_WORDS[n] || String(n);
  }

  // Applied once the example has loaded: a valid view id lands on that view,
  // a valid month key opens that month (with its entries) in the year view
  // applyLoadedSnapshot already put the reader on by default. Neither
  // overrides the other -- a reader can ask for both.
  function applyDeepLinkViewAndMonth(deepLink, snapshot) {
    var changed = false;
    if (deepLink.view && viewById(deepLink.view)) {
      state.view = deepLink.view;
      changed = true;
    }
    if (
      deepLink.month &&
      snapshot.months.some(function (m) {
        return m.key === deepLink.month;
      })
    ) {
      state.openMonth = deepLink.month;
      yearState().entriesOpen = true;
      changed = true;
    }
    if (changed) {
      render();
      scrollViewToTop();
    }
  }

  // Keeps the URL current with the loaded example, the view and the open
  // month, so the reader's own address bar is a link they can copy back
  // out -- replaceState only, never a history entry per click. An uploaded
  // or freshly-created book carries no example id and the URL is left as
  // the reader navigated it.
  function syncDeepLinkUrl() {
    if (!state.loaded || !SNAPSHOT.source || SNAPSHOT.source.kind !== "example") return;
    var params = new URLSearchParams();
    params.set("example", SNAPSHOT.source.label);
    params.set("view", state.view);
    if (state.openMonth) params.set("month", state.openMonth);
    var next = window.location.pathname + "?" + params.toString() + window.location.hash;
    var current = window.location.pathname + window.location.search + window.location.hash;
    if (next !== current) window.history.replaceState(null, "", next);
  }

  // ============================== formatting ==============================

  var moneyFmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });
  var moneyWholeFmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

  function fmtMoney(n) {
    return moneyFmt.format(n);
  }
  function fmtWhole(n) {
    return moneyWholeFmt.format(Math.round(n));
  }
  /* Inside a form-amount-box the pound sign is the box's own prefix cell,
     so the figure renders bare. */
  function fmtBoxMoney(n) {
    return fmtMoney(n).replace(/^-?£/, function (m) {
      return m.charAt(0) === "-" ? "-" : "";
    });
  }
  function fmtBoxWhole(n) {
    return fmtWhole(n).replace(/^-?£/, function (m) {
      return m.charAt(0) === "-" ? "-" : "";
    });
  }
  function fmtRate(n) {
    return (n * 100).toFixed(n * 100 === Math.round(n * 100) ? 0 : 1) + "%";
  }
  function fmtPence(n) {
    return Math.round(n * 100) + "p";
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ============================== report-key attributes ==============================
  // Every figure a view renders carries the S2 key(s) report-serializer.js
  // gives the same value: a cell key for the workbook cell CELL_MAP names
  // and, where CELL_MAP prints the row on a report section, the matching
  // section key. Both name the same value, so a figure the page shows once
  // carries both. A figure CELL_MAP does not name carries neither --
  // app/data/render-unrepresentable/<product>.json says why.
  var R_KEY_SEP = " || ";
  function rk() {
    var keys = [];
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i]) keys.push(arguments[i]);
    }
    return keys.length ? ' data-r-key="' + esc(keys.join(R_KEY_SEP)) + '"' : "";
  }
  function cellKey(sheet, cell) {
    return "cell/" + sheet + "!" + cell;
  }
  function sectionKey(section, row) {
    return "section/" + section + "/" + row;
  }
  // The pairing every CELL_MAP row makes: its own cell key and the section
  // key report-serializer.js gives the report row that reprints it.
  function rk2(sheet, cell, section, row) {
    return rk(cellKey(sheet, cell), sectionKey(section, row));
  }

  // The same pairing derived from CELL_MAP itself: the cell key in the form
  // the serializer writes (with the hub file's name when the product spans
  // several workbooks) and the section key from the row's section and label
  // slugs, numbered the way the serializer numbers a label repeated inside
  // one section. A cell CELL_MAP does not name gives no key at all.
  function rkFor(sheet, cell) {
    var productMod = SNAPSHOT.context.productMod;
    var slug = SNAPSHOT.context.engine.slug;
    var rows = productMod.CELL_MAP;
    var row = null;
    var seen = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === sheet && rows[i][1] === cell) {
        row = rows[i];
        break;
      }
    }
    if (!row) return "";
    var rowSlug = slug(row[2]);
    for (var j = 0; j <= i; j++) {
      if (rows[j][4] === row[4] && slug(rows[j][2]) === rowSlug) seen++;
    }
    var cellRef = active.hub && sheet.indexOf("!") === -1 ? active.hub + "!" + sheet : sheet;
    return rk(cellKey(cellRef, cell), sectionKey(slug(row[4]), rowSlug + (seen > 1 ? "#" + seen : "")));
  }

  // The CELL_MAP rows of one section joined to the snapshot's results, so a
  // view can print a section the derivations did not copy.
  function sectionRows(section, filter) {
    var results = SNAPSHOT.results;
    var rows = [];
    SNAPSHOT.context.productMod.CELL_MAP.forEach(function (row) {
      if (row[4] !== section) return;
      var joined = {
        sheet: row[0],
        cell: row[1],
        label: String(row[2]).replace(/\*\*/g, ""),
        path: row[3],
        value: results[row[0]] ? results[row[0]][row[1]] : undefined,
        indent: row[5],
        unit: row[6],
      };
      if (!filter || filter(joined)) rows.push(joined);
    });
    return rows;
  }

  // The signature element: a calculated value in ink, the workbook's as-read
  // value struck through in pencil beneath it, signed drift in the margin.
  // Once the book has been edited the same mark says "recalculated" -- the
  // difference is then the edit's own effect, not a reconciliation finding.
  // A hub cache saved before the leaf it quotes changed says so instead, and
  // names the leaf.
  function pencilCorrection(computed, asRead, opts) {
    opts = opts || {};
    var rKeyAttr = opts.rKeyAttr || "";
    var drift = Math.round((computed - asRead) * 100) / 100;
    if (Math.abs(drift) < 0.005) {
      return '<span class="mono num"' + rKeyAttr + ">" + esc(fmtMoney(computed)) + "</span>";
    }
    var sign = drift > 0 ? "+" : "−";
    var driftAbs = Math.abs(drift).toFixed(2);
    return (
      '<span class="pencil-correction' +
      (opts.inMargin ? " in-margin" : "") +
      (opts.recalculated ? " is-recalculated" : "") +
      (opts.state === "stale" ? " is-stale" : "") +
      '">' +
      '<span class="computed-value"' +
      rKeyAttr +
      ">" +
      esc(fmtMoney(computed)) +
      "</span>" +
      '<span class="as-read">' +
      esc(fmtMoney(asRead)) +
      "</span>" +
      '<span class="drift-amount">' +
      sign +
      driftAbs +
      "</span>" +
      (opts.state === "stale"
        ? '<span class="drift-tag is-stale" title="' + esc(opts.leaf || "") + '">the hub was saved before this leaf changed</span>'
        : opts.recalculated
          ? '<span class="drift-tag">recalculated</span>'
          : "") +
      "</span>"
    );
  }

  // Every figure whose own cell disagrees with the workbook carries the
  // mark, on whatever view renders it -- the page walks its own rendered
  // keys rather than each render function knowing which cells might drift.
  // In a form the mark goes to the row's right margin, so a box never shows
  // two numbers; everywhere else the figure itself becomes the correction,
  // keeping its report key on the computed half.
  function applyDriftMarks(root) {
    var byId = {};
    var found = false;
    (SNAPSHOT.drift || []).forEach(function (entry) {
      if (Math.abs(entry.computed - entry.asRead) >= 0.005) {
        byId[entry.id] = entry;
        found = true;
      }
    });
    if (!found) return;

    Array.prototype.forEach.call(root.querySelectorAll("[data-r-key]"), function (el) {
      if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") return;
      if (el.closest(".pencil-correction")) return;
      var entry = null;
      el.getAttribute("data-r-key")
        .split(R_KEY_SEP)
        .forEach(function (key) {
          if (key.indexOf("cell/") === 0 && byId[key.slice(5)]) entry = byId[key.slice(5)];
        });
      if (!entry) return;

      var formRow = el.classList.contains("form-amount-box") ? el.closest(".form-row") : null;
      if (formRow) {
        var margin = formRow.querySelector(".form-row-margin");
        if (!margin) {
          margin = document.createElement("span");
          margin.className = "form-row-margin";
          formRow.appendChild(margin);
        }
        if (!margin.querySelector(".pencil-correction")) {
          margin.innerHTML = correctionFor(entry, { inMargin: true });
        }
        return;
      }

      var rKeyAttr = ' data-r-key="' + esc(el.getAttribute("data-r-key")) + '"';
      el.removeAttribute("data-r-key");
      el.innerHTML = correctionFor(entry, { rKeyAttr: rKeyAttr });
    });
  }

  function correctionFor(driftEntry, opts) {
    opts = opts || {};
    return pencilCorrection(driftEntry.computed, driftEntry.asRead, {
      inMargin: opts.inMargin,
      recalculated: driftEntry.recalculated,
      state: driftEntry.state,
      leaf: driftEntry.leaf,
      rKeyAttr: opts.rKeyAttr,
    });
  }

  // ============================== rendering ==============================

  function render() {
    document.body.classList.toggle("is-loaded", state.loaded);
    // Nothing to save until there is a book: the mobile bar stays away.
    els.mobileActionBar.classList.toggle("hidden", !state.loaded);
    renderTopbarTitle();
    renderSheetTabs();
    renderUndoControls();
    if (!state.loaded) {
      els.viewRoot.innerHTML = renderEmptyState();
      bindEmptyState();
      els.inspector.innerHTML = "";
      els.inspectorDrawer.innerHTML = "";
      return;
    }

    var view = viewById(state.view) || active.views[0];
    els.viewRoot.innerHTML = renderView(view);
    applyDriftMarks(els.viewRoot);
    bindViewInteractions(view);
    mountHeadlinesStrip();

    els.inspector.innerHTML = renderInspectorFull();
    els.inspectorDrawer.innerHTML =
      '<div class="drawer-handle"></div>' + (state.mobileTab === "checks" ? renderInspectorChecksOnly() : renderInspectorFull());
    bindInspectorInteractions();
    renderMobileTabbar();
    restoreEditFocus();
    syncDeepLinkUrl();
  }

  function viewById(id) {
    return active.views.filter(function (v) {
      return v.id === id;
    })[0];
  }

  // A commit re-renders the whole grid, so the row the reader was working in
  // gets its caret back rather than the page losing focus to the body.
  // state.focusField names which of the row's edit controls to return to;
  // it defaults to the amount input. A manifest may name controls of its own
  // in focusFieldAttr.
  var FOCUS_FIELD_ATTR = { amount: "data-amount-entry", date: "data-date-entry", account: "data-account-entry" };
  function restoreEditFocus() {
    if (!state.focusEntry) return;
    var attr =
      (active.focusFieldAttr && active.focusFieldAttr[state.focusField]) || FOCUS_FIELD_ATTR[state.focusField] || FOCUS_FIELD_ATTR.amount;
    var input = els.viewRoot.querySelector("[" + attr + '="' + state.focusEntry + '"]');
    state.focusEntry = null;
    state.focusField = null;
    if (input) input.focus();
  }

  function renderUndoControls() {
    var depth = window.DiyaGlBooksEdits.undo.depth();
    var label = window.DiyaGlBooksEdits.undo.topLabel();
    [els.undoBtn, els.undoBtnMobile].forEach(function (btn) {
      if (!btn) return;
      btn.classList.toggle("hidden", !state.loaded || depth === 0);
      if (depth > 0) btn.title = "Undo: " + label;
    });
  }

  // The year-at-a-glance strip: the first thing every loaded view shows,
  // prepended fresh into view-root on every render (render() has just
  // replaced the whole subtree, so there is never a stale mount to refresh
  // instead). It is fed R itself, the report the snapshot already carries,
  // reduced through the product's own headline declaration. A product whose
  // module declares no headline keys shows no strip.
  function mountHeadlinesStrip() {
    if (!SNAPSHOT.context.productMod.HEADLINES) return;
    var mountEl = document.createElement("div");
    mountEl.id = "headlines-strip-mount";
    els.viewRoot.insertBefore(mountEl, els.viewRoot.firstChild);
    window.DiyaGlHeadlines.mountHeadlines(mountEl, {
      snapshot: SNAPSHOT,
      report: SNAPSHOT.report,
      headlinesFromReport: function (report) {
        return window.DiyaGlBooksLoader.headlinesFor(report, SNAPSHOT.context);
      },
      formatMoney: fmtMoney,
    });
  }

  // The business name is the half a reader needs; the view name gives way
  // to it when the header runs out of room (the tab strip below says which
  // view this is anyway).
  function renderTopbarTitle() {
    if (!state.loaded) {
      els.topbarTitle.textContent = "DIYA-GL — " + active.title + " books";
      return;
    }
    var name = SNAPSHOT.businessDetails.organizationIdentifier;
    var viewMeta = viewById(state.view);
    els.topbarTitle.innerHTML =
      '<span class="title-business">' +
      esc(name) +
      "</span>" +
      (viewMeta ? '<span class="title-view">' + esc(viewMeta.label) + "</span>" : "");
  }

  function renderSheetTabs() {
    if (!state.loaded) {
      els.sheetTabs.innerHTML = "";
      els.sheetTabs.classList.add("hidden");
      return;
    }
    els.sheetTabs.classList.remove("hidden");
    els.sheetTabs.innerHTML = active.views
      .map(function (v) {
        return (
          '<button type="button" class="tab-btn" role="tab" data-view="' +
          v.id +
          '" aria-selected="' +
          (v.id === state.view ? "true" : "false") +
          '">' +
          esc(v.label) +
          "</button>"
        );
      })
      .join("");
    Array.prototype.forEach.call(els.sheetTabs.querySelectorAll(".tab-btn"), function (btn) {
      btn.addEventListener("click", function () {
        state.view = btn.getAttribute("data-view");
        state.mobileTab = "books";
        render();
        scrollViewToTop();
      });
    });
    scrollActiveTabIntoView();
    updateTabStripFades();
  }

  // The strip is narrower than its tabs on a phone, so the view being read
  // is brought into it rather than left off the end. scrollLeft is set
  // directly: scrollIntoView would scroll every ancestor, taking the page
  // with it.
  function scrollActiveTabIntoView() {
    var strip = els.sheetTabs;
    var activeTab = strip.querySelector('.tab-btn[aria-selected="true"]');
    if (!activeTab) return;
    strip.scrollLeft = Math.max(0, activeTab.offsetLeft - (strip.clientWidth - activeTab.offsetWidth) / 2);
  }

  // A new book, or a new view, starts at its own top. The view is its own
  // scroller on a phone, and it keeps whatever position the last thing the
  // reader clicked left it at.
  function scrollViewToTop() {
    if (els.appBody) els.appBody.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  // A fade at whichever edge has more tabs beyond it, so a row that scrolls
  // looks like one.
  function updateTabStripFades() {
    var strip = els.sheetTabs;
    var furthest = strip.scrollWidth - strip.clientWidth;
    strip.classList.toggle("fades-left", strip.scrollLeft > 1);
    strip.classList.toggle("fades-right", strip.scrollLeft < furthest - 1);
  }

  function renderMobileTabbar() {
    var tabs = [
      { id: "books", label: "Books" },
      { id: "checks", label: "Checks" },
    ];
    els.mobileTabbar.innerHTML =
      '<div class="mobile-tabbar-inner" role="tablist" aria-label="Books sections">' +
      tabs
        .map(function (t) {
          return (
            '<button type="button" class="mobile-tab" role="tab" data-tab="' +
            t.id +
            '" aria-selected="' +
            (state.mobileTab === t.id ? "true" : "false") +
            '">' +
            t.label +
            "</button>"
          );
        })
        .join("") +
      "</div>";
    Array.prototype.forEach.call(els.mobileTabbar.querySelectorAll(".mobile-tab"), function (btn) {
      btn.addEventListener("click", function () {
        var tab = btn.getAttribute("data-tab");
        state.mobileTab = tab;
        if (tab === "checks") {
          openDrawer();
        } else {
          closeDrawer();
        }
        render();
      });
    });
  }

  function renderView(view) {
    if (view.shared === "home") return renderHome();
    if (view.shared === "year") return renderYear();
    return view.render(SNAPSHOT, state, helpers);
  }

  function bindViewInteractions(view) {
    if (view.shared === "year") {
      bindYearView();
      return;
    }
    if (view.shared === "home") {
      Array.prototype.forEach.call(els.viewRoot.querySelectorAll("[data-goto]"), function (a) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          state.view = a.getAttribute("data-goto");
          render();
        });
      });
      return;
    }
    if (view.bind) view.bind(els.viewRoot, state, helpers);
  }

  // ============================== empty state ==============================

  var DROP_HINT_RESTING = "or drop one here — .xlsx, .zip or .json";

  // The manifest's example books, loadable without a file. A reader picks a
  // business, not a fixture id, so the name leads and the id follows in
  // small text.
  function exampleButton(example) {
    return (
      '<button type="button" class="btn example-btn" data-example="' +
      esc(example.key) +
      '"><span class="example-name">' +
      esc(example.name) +
      '</span><span class="example-id">' +
      esc(example.key) +
      " — " +
      esc(example.note) +
      "</span></button>"
    );
  }

  function renderEmptyState() {
    return (
      '<div class="empty-state">' +
      "<h2>View your books in DIYA-GL</h2>" +
      "<p>" +
      esc(active.emptyState.intro) +
      "</p>" +
      (state.savedBook ? renderContinueOffer() : "") +
      '<div class="empty-state-actions">' +
      '<div class="picker-row">' +
      '<label class="file-picker-label" for="file-picker">Choose a file</label>' +
      '<input type="file" id="file-picker" accept=".xlsx,.zip,.json" class="hidden" />' +
      "</div>" +
      '<p class="drop-hint" id="drop-hint">' +
      DROP_HINT_RESTING +
      "</p>" +
      '<button type="button" class="btn" id="new-book-btn" aria-expanded="' +
      (state.newBookFormOpen ? "true" : "false") +
      '">Start a new book</button>' +
      (state.newBookFormOpen ? renderNewBookForm() : "") +
      '<div class="example-list">' +
      '<span class="caps-label">Or load an example</span>' +
      getExamples().map(exampleButton).join("") +
      "</div>" +
      "</div>" +
      '<p id="empty-state-message" class="view-lede" aria-live="polite"></p>' +
      "</div>"
    );
  }

  // "Start a new book": the manifest's own short form -- a business name and
  // a year end for a sole trader -- that builds an empty but valid book and
  // loads it into the same state path an upload or example uses.
  function renderNewBookForm() {
    return (
      '<form id="new-book-form" class="new-book-form" novalidate>' +
      active.newBook.fields.map(renderNewBookField).join("") +
      '<p id="new-book-error" class="upload-error hidden" role="alert"></p>' +
      '<div class="new-book-form-actions">' +
      '<button type="submit" class="btn btn-primary">Create book</button>' +
      '<button type="button" class="btn" id="new-book-cancel">Cancel</button>' +
      "</div>" +
      "</form>"
    );
  }

  function renderNewBookField(field) {
    if (field.type === "checkbox") {
      return (
        '<div class="editable-field editable-field-checkbox"><label for="' +
        esc(field.id) +
        '"><input type="checkbox" id="' +
        esc(field.id) +
        '" name="' +
        esc(field.name) +
        '" /> ' +
        esc(field.label) +
        "</label></div>"
      );
    }
    return (
      '<div class="editable-field">' +
      '<label for="' +
      esc(field.id) +
      '">' +
      esc(field.label) +
      "</label>" +
      '<input type="' +
      esc(field.type) +
      '" id="' +
      esc(field.id) +
      '" name="' +
      esc(field.name) +
      '"' +
      (field.type === "text" ? ' autocomplete="off"' : "") +
      " /></div>"
    );
  }

  // The IndexedDB autosave record, offered alongside the fresh options --
  // never loaded without the user choosing to. "Discard" is the only other
  // control that touches it.
  function renderContinueOffer() {
    var saved = state.savedBook;
    var label = (saved.source && saved.source.label) || "your working book";
    var when = formatSavedAt(saved.savedAt);
    return (
      '<div class="continue-offer">' +
      "<h3>Continue where you left off</h3>" +
      "<p>" +
      esc(label) +
      (when ? " — saved " + esc(when) : "") +
      "</p>" +
      '<div class="continue-offer-actions">' +
      '<button type="button" class="btn btn-primary" id="continue-btn">Continue</button>' +
      '<button type="button" class="btn" id="discard-btn">Discard</button>' +
      "</div></div>"
    );
  }

  function formatSavedAt(iso) {
    if (!iso) return "";
    try {
      var date = new Date(iso);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  // A real calendar date, not just a string an <input type="date"> happened
  // to accept -- rejects "2026-02-30" the way a real year end never would.
  function parseRealDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    if (month < 1 || month > 12) return null;
    var date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return match[0];
  }

  // A quick, name-only shortcut for the one format every reader recognises
  // by its extension alone: the legacy .xls this pipeline has no reader
  // for regardless of what the bytes turn out to be. Everything else is
  // sniffed by content in the loader, never by name. Shared by the picker
  // and the drop zone, so a .xls-named file gets the same message through
  // either door.
  var LEGACY_XLS_MESSAGE = "That's the older .xls format. Open it in Excel or LibreOffice, save as .xlsx, and try again.";

  function isLegacyXlsName(name) {
    return /\.xls$/i.test(name);
  }

  function bindEmptyState() {
    var picker = document.getElementById("file-picker");
    picker.addEventListener("change", function () {
      var file = picker.files && picker.files[0];
      if (!file) return;
      if (isLegacyXlsName(file.name)) {
        showEmptyStateMessage(LEGACY_XLS_MESSAGE, false);
        picker.value = "";
        return;
      }
      loadFromAnySource(file);
    });

    document.getElementById("new-book-btn").addEventListener("click", function () {
      state.newBookFormOpen = !state.newBookFormOpen;
      render();
      var firstField = active.newBook.fields[0] && document.getElementById(active.newBook.fields[0].id);
      if (firstField) firstField.focus();
    });

    var newBookForm = document.getElementById("new-book-form");
    if (newBookForm) {
      newBookForm.addEventListener("submit", function (e) {
        e.preventDefault();
        handleCreateNewBook();
      });
      document.getElementById("new-book-cancel").addEventListener("click", function () {
        state.newBookFormOpen = false;
        render();
      });
    }

    var continueBtn = document.getElementById("continue-btn");
    if (continueBtn) continueBtn.addEventListener("click", handleContinueSavedBook);
    var discardBtn = document.getElementById("discard-btn");
    if (discardBtn) discardBtn.addEventListener("click", handleDiscardSavedBook);

    Array.prototype.forEach.call(document.querySelectorAll("[data-example]"), function (btn) {
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        loadExample(btn.getAttribute("data-example"));
      });
    });
  }

  // The form's values by field name, each field's own required message
  // applied and a date field held to a real calendar date.
  function handleCreateNewBook() {
    var errorEl = document.getElementById("new-book-error");
    var values = {};
    var errors = [];
    active.newBook.fields.forEach(function (field) {
      var input = document.getElementById(field.id);
      if (field.type === "checkbox") {
        values[field.name] = !!input.checked;
        return;
      }
      var value = input.value.trim();
      if (field.type === "date") {
        value = parseRealDate(value);
        if (!value) errors.push(field.required);
      } else if (field.required && !value) {
        errors.push(field.required);
      }
      values[field.name] = value;
    });

    if (errors.length > 0) {
      errorEl.textContent = errors.join(" ");
      errorEl.classList.remove("hidden");
      return;
    }
    errorEl.classList.add("hidden");
    errorEl.textContent = "";

    var label = active.newBook.label(values);
    var manifest = active;
    loadThrough("Creating a new book for " + label + "…", Promise.resolve({ productId: manifest.id }), function () {
      return window.DiyaGlBooksLoader.createNewBook(values, manifest);
    }).then(function (snapshot) {
      if (!snapshot) return;
      state.newBookFormOpen = false;
      showToast("Started a new book for " + label + ".");
    });
  }

  function handleContinueSavedBook() {
    var saved = state.savedBook;
    if (!saved) return;
    var label = (saved.source && saved.source.label) || "your working book";
    loadThrough(
      "Continuing " + label + "…",
      window.DiyaGlBooksLoader.productIdOfBook(saved.book).then(idOnly),
      function (sniffed, manifest) {
        return window.DiyaGlBooksLoader.loadFromBookAndLines(saved.book, saved.lines, label, saved.source && saved.source.kind, manifest);
      },
    ).then(function (snapshot) {
      if (snapshot) showToast("Continued where you left off.");
    });
  }

  function idOnly(productId) {
    return { productId: productId };
  }

  function handleDiscardSavedBook() {
    window.DiyaBooksAutosave.clearWorkingBook().then(function () {
      state.savedBook = null;
      render();
      showToast("Discarded the saved working book.");
    });
  }

  function showEmptyStateMessage(text, isError) {
    var msg = document.getElementById("empty-state-message");
    if (!msg) return;
    msg.textContent = text;
    msg.classList.toggle("upload-error", !!isError);
  }

  function setPickerBusy(busy) {
    Array.prototype.forEach.call(document.querySelectorAll(".empty-state button, .empty-state input"), function (el) {
      el.disabled = busy;
    });
  }

  // ============================== loading ==============================
  // Every way in reaches the page through this one path: a sniff names the
  // product, the product's manifest is mounted if it is not the page's own,
  // the loader builds the snapshot with that manifest, and the page shows
  // it. The picker, the drop zone, the example buttons, the deep link, the
  // new-book form and the continue offer all arrive here. Resolves to the
  // snapshot, or to null once the error has been shown.
  function loadThrough(busyMessage, sniffing, loadWith, opts) {
    setPickerBusy(true);
    showEmptyStateMessage(busyMessage, false);
    return sniffing
      .then(function (sniffed) {
        return ensureManifest(sniffed.productId).then(function (manifest) {
          setPickerBusy(true);
          showEmptyStateMessage(busyMessage, false);
          return loadWith(sniffed, manifest);
        });
      })
      .then(function (snapshot) {
        applyLoadedSnapshot(snapshot, opts);
        return snapshot;
      })
      .catch(function (error) {
        setPickerBusy(false);
        showEmptyStateMessage(error && error.message ? error.message : String(error), true);
        return null;
      });
  }

  function loadExample(exampleKey, opts) {
    var manifest = active;
    return loadThrough(
      "Loading " + exampleKey + "…",
      Promise.resolve({ productId: manifest.id }),
      function (sniffed, mounted) {
        return window.DiyaGlBooksLoader.loadExample(exampleKey, mounted);
      },
      opts,
    ).then(function (snapshot) {
      if (snapshot) showToast("Loaded " + snapshot.businessDetails.organizationIdentifier + " (example)");
      return snapshot;
    });
  }

  // The picker's change handler and the drop zone's drop handler both call
  // this. Format and product are sniffed by content inside the loader,
  // never by the name this File carries.
  function loadFromAnySource(file) {
    return loadThrough("Reading " + file.name + "…", window.DiyaGlBooksLoader.sniff(file), function (sniffed, manifest) {
      return window.DiyaGlBooksLoader.loadSniffed(sniffed, manifest);
    }).then(function (snapshot) {
      if (snapshot) showToast("Loaded " + file.name);
      return snapshot;
    });
  }

  // ============================== drop zone ==============================
  // The empty-state card doubles as a drop target while no book is loaded;
  // the whole document listens so a drop still lands correctly when the
  // pointer is not exactly over the card. dragDepth counts nested
  // dragenter/dragleave pairs (every element under the pointer fires its
  // own), so the highlight only clears once the pointer has actually left
  // the page. A drop while a book is loaded is refused -- the toast's own
  // control clears the page back to the empty state without touching the
  // autosave record, exactly what Discard is for.

  var dragDepth = 0;

  function bindDropZone() {
    document.addEventListener("dragenter", function (e) {
      e.preventDefault();
      dragDepth++;
      if (!state.loaded) setDropHighlight(true);
    });
    document.addEventListener("dragover", function (e) {
      e.preventDefault();
    });
    document.addEventListener("dragleave", function () {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) setDropHighlight(false);
    });
    document.addEventListener("drop", function (e) {
      e.preventDefault();
      dragDepth = 0;
      setDropHighlight(false);
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      if (state.loaded) {
        showToast("Close this book first", { label: "Close this book", onClick: closeCurrentBook });
        return;
      }
      if (isLegacyXlsName(file.name)) {
        showEmptyStateMessage(LEGACY_XLS_MESSAGE, false);
        return;
      }
      loadFromAnySource(file);
    });
  }

  function setDropHighlight(on) {
    var card = document.querySelector(".empty-state");
    if (card) card.classList.toggle("is-drag-over", on);
    var hint = document.getElementById("drop-hint");
    if (hint) {
      hint.textContent = on ? "Drop a workbook (.xlsx), a package zip, a diya-gl zip or a diya-gl JSON file" : DROP_HINT_RESTING;
    }
  }

  // The record autosave keeps and the continue offer restores: the live
  // book and lines, where they came from, and which product's manifest
  // they belong to.
  function workingBookRecord() {
    return {
      book: state.book,
      lines: state.lines,
      source: Object.assign({}, SNAPSHOT.source || { kind: "unknown", label: SNAPSHOT.scenario }, { product: active.id }),
      savedAt: new Date().toISOString(),
    };
  }

  // Clears the loaded book back to the empty page without touching the
  // autosave record: the same working book Discard would still remove, and
  // still offered back as "Continue where you left off" the next time the
  // reader opens or loads anything.
  function closeCurrentBook() {
    if (state.book && state.lines) state.savedBook = workingBookRecord();
    state.loaded = false;
    state.book = null;
    state.lines = null;
    state.context = null;
    state.bookChecks = [];
    state.view = "home";
    state.openHelper = null;
    window.DiyaGlBooksEdits.undo.clear();
    render();
  }

  function applySnapshot(snapshot, opts) {
    opts = opts || {};
    SNAPSHOT = snapshot;
    window.DIYA_BOOKS_SNAPSHOT = snapshot;
    state.book = snapshot.book;
    state.lines = snapshot.lines;
    state.context = snapshot.context;
    state.bookChecks = window.DiyaGlBooksEdits.bookChecks(snapshot);
    // A deep link never writes the autosave record -- whatever a reader had
    // saved before following the link stays exactly as it was.
    if (!opts.skipAutosave) autosaveCurrentBook();
  }

  function applyLoadedSnapshot(snapshot, opts) {
    applySnapshot(snapshot, opts);
    state.loaded = true;
    state.view = "year";
    state.openMonth = snapshot.months[0].key;
    state.openHelper = null;
    state.views = {};
    window.DiyaGlBooksEdits.undo.clear();
    setPickerBusy(false);
    render();
    scrollViewToTop();
  }

  // Called at the one place state.book/state.lines change: applySnapshot,
  // which every book load and every committed edit goes through. Silent by
  // design: a blocked or missing store degrades to no-autosave
  // (autosave.js's own contract) and the page carries on exactly as if
  // autosave were never called.
  function autosaveCurrentBook() {
    if (!state.book || !state.lines) return;
    window.DiyaBooksAutosave.saveWorkingBook(workingBookRecord());
  }

  // ============================== the edit path ==============================
  // One route for every change: the state being replaced goes on the undo
  // stack, the edit function returns the new lines, the whole book is
  // recomputed from them (calculator and checks both), and the page
  // re-renders. A helper's whole plan is one call, so it is one undo step.

  function commit(edit, undoLabel, toastMessage, toastAction) {
    if (state.committing) return Promise.resolve();
    state.committing = true;
    var previousBook = state.book;
    var previousLines = state.lines;
    return Promise.resolve()
      .then(edit)
      .then(function (newLines) {
        return window.DiyaGlBooksLoader.recalculate(state.book, newLines, state.context);
      })
      .then(function (snapshot) {
        window.DiyaGlBooksEdits.undo.push(previousBook, previousLines, undoLabel);
        applySnapshot(snapshot);
        state.committing = false;
        render();
        if (toastMessage) showToast(toastMessage, toastAction);
      })
      .catch(function (error) {
        state.committing = false;
        render();
        showToast("That edit did not apply: " + (error && error.message ? error.message : error));
      });
  }

  // The seam for lines that arrive from somewhere other than this page's own
  // grid -- an agent session's edit through the MCP tools, a book built by
  // another surface. It lands on the same commit path, so it recalculates,
  // re-renders and undoes exactly like a hand edit.
  function setLines(lines, label) {
    return commit(
      function () {
        return lines;
      },
      label || "replace the book's lines",
      null,
    );
  }

  // A change to the book itself -- a business detail, the accounting
  // period, a helper that adds to the book rather than the lines. The tax
  // year the book declares is resolved afresh, so the rates the checks use
  // follow the book. One undo step.
  function commitBook(nextBook, undoLabel, toastMessage) {
    if (state.committing) return Promise.resolve();
    state.committing = true;
    var previousBook = state.book;
    var previousLines = state.lines;
    return window.DiyaGlBooksLoader.recalculateWithBook(nextBook, state.lines, state.context)
      .then(function (snapshot) {
        window.DiyaGlBooksEdits.undo.push(previousBook, previousLines, undoLabel);
        applySnapshot(snapshot);
        state.committing = false;
        render();
        if (toastMessage) showToast(toastMessage);
      })
      .catch(function (error) {
        state.committing = false;
        render();
        showToast("That change did not apply: " + (error && error.message ? error.message : error));
      });
  }

  function undoLastEdit() {
    var previous = window.DiyaGlBooksEdits.undo.pop();
    if (!previous) {
      showToast("Nothing to undo.");
      return;
    }
    state.committing = true;
    // recalculateWithBook, not recalculate: undoing a year-end change has to
    // put back the tax year the restored book declares, not keep the one the
    // change brought in.
    window.DiyaGlBooksLoader.recalculateWithBook(previous.book, previous.lines, state.context, window.DiyaGlBooksEdits.undo.depth() > 0)
      .then(function (snapshot) {
        applySnapshot(snapshot);
        state.committing = false;
        render();
        showToast("Undid: " + previous.label + ".");
      })
      .catch(function (error) {
        window.DiyaGlBooksEdits.undo.push(previous.book, previous.lines, previous.label);
        state.committing = false;
        showToast("Could not undo: " + (error && error.message ? error.message : error));
      });
  }

  // A copy of the live book with one dotted path set: "entityInformation.
  // organizationTown", "documentInfo.periodCoveredEnd".
  function bookWithField(book, path, value) {
    var next = JSON.parse(JSON.stringify(book));
    var segments = path.split(".");
    for (var s = 0; s < segments.length; s++) {
      if (segments[s] === "__proto__" || segments[s] === "constructor" || segments[s] === "prototype") {
        throw new Error("A book field path never names " + segments[s] + ": " + path);
      }
    }
    var target = next;
    for (var i = 0; i < segments.length - 1; i++) {
      if (!target[segments[i]]) target[segments[i]] = {};
      target = target[segments[i]];
    }
    target[segments[segments.length - 1]] = value;
    return next;
  }

  // The path a book field lives at: data-book-path when the view names one,
  // else documentInfo for the fields the manifest lists there and
  // entityInformation for everything else.
  function bookPathOf(input) {
    var explicit = input.getAttribute("data-book-path");
    if (explicit) return explicit;
    var field = input.getAttribute("data-book-field");
    var documentInfoFields = (active.bookFields && active.bookFields.documentInfo) || [];
    return (documentInfoFields.indexOf(field) === -1 ? "entityInformation." : "documentInfo.") + field;
  }

  // Every [data-book-field] input under root commits through commitBook on
  // change: a date field held to a real date, any other field to a value.
  function bindBookFields(root) {
    Array.prototype.forEach.call(root.querySelectorAll("[data-book-field]"), function (input) {
      var committed = input.value;
      input.addEventListener("change", function () {
        var value = input.value.trim();
        if (value === committed) return;
        if (input.type === "date") {
          value = parseRealDate(value);
          if (!value) {
            input.value = committed;
            showToast("That is not a real date. The book is unchanged.");
            return;
          }
        } else if (!value) {
          input.value = committed;
          showToast("This detail cannot be empty. The book is unchanged.");
          return;
        }
        var label = input.previousElementSibling ? input.previousElementSibling.textContent : input.getAttribute("data-book-field");
        commitBook(bookWithField(state.book, bookPathOf(input), value), "change " + label, "Changed " + label + ".");
      });
    });
  }

  // ============================== home ==============================

  function renderHome() {
    var bd = SNAPSHOT.businessDetails;
    var productMod = SNAPSHOT.context.productMod;
    return (
      "<h2>" +
      esc(bd.organizationIdentifier) +
      "</h2>" +
      '<p class="view-period">' +
      esc(bd.periodCoveredStart) +
      " to " +
      esc(bd.periodCoveredEnd) +
      "</p>" +
      '<ul class="home-nav-list">' +
      active.views
        .map(function (v) {
          var sheets = typeof v.sheets === "function" ? v.sheets(productMod) : v.sheets;
          return (
            '<li><a href="#" data-goto="' +
            v.id +
            '"><span class="nav-item-label">' +
            esc(v.label) +
            '</span><span class="nav-item-sheets">' +
            esc(sheets) +
            "</span></a></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  // ============================== year table + drill ==============================

  function renderYear() {
    return "<h2>Year</h2>" + renderYearSummarySticky() + renderYearTableScroll() + renderMonthCards();
  }

  function renderYearSummarySticky() {
    var a = SNAPSHOT.annual;
    return (
      '<div class="year-summary-sticky" id="year-summary-sticky">' +
      active.yearTable.sticky
        .map(function (pair) {
          return '<div class="ys-row"><span>' + esc(pair[0]) + '</span><span class="ys-value">' + fmtMoney(a[pair[1]]) + "</span></div>";
        })
        .join("") +
      "</div>"
    );
  }

  // The full set of category columns fits no desktop landscape width
  // without an overflow, so the table shows the manifest's default columns
  // and folds the rest behind an "All categories" toggle. The columns the
  // manifest keeps hidden always are component cells whose sum a visible
  // composite column already carries. Every hidden column is still in the
  // DOM -- CSS hides it, the markup never drops it -- so its r-key stays
  // where the render-coverage and equivalence sweeps expect it, and a
  // composite column (no single cell holds its sum) is appended after every
  // category column rather than spliced among them, so none of their
  // positions move.
  function yearTableColumns() {
    var defaults = active.yearTable.defaultColumns;
    var alwaysHidden = active.yearTable.alwaysHidden;
    var cols = SNAPSHOT.categories.map(function (c) {
      var visibility = alwaysHidden.indexOf(c.key) !== -1 ? "always" : defaults.indexOf(c.key) !== -1 ? "default" : "toggle";
      return { key: c.key, label: c.label, computed: c.computed, visibility: visibility, sheet: c.sheet, cell: c.cell };
    });
    active.yearTable.composite.forEach(function (composite) {
      cols.push({ key: composite.key, label: composite.label, computed: true, visibility: "default", from: composite.from });
    });
    return cols;
  }

  function yearColClass(c) {
    var classes = [];
    if (c.computed) classes.push("col-computed");
    if (c.visibility === "always") classes.push("col-hidden-always");
    if (c.visibility === "toggle") classes.push("col-toggle");
    return classes.join(" ");
  }

  function yearColValue(c, row) {
    if (!c.from) return row[c.key];
    return c.from.reduce(function (sum, key) {
      return sum + row[key];
    }, 0);
  }

  // The month row's cell for one column, keyed when the sheet carries a cell
  // for it: the manifest says which.
  function monthlyRk(monthLabel, categoryKey) {
    var pair = active.yearTable.monthlyCell(monthLabel, SNAPSHOT.context.productMod, categoryKey);
    return pair ? rkFor(pair[0], pair[1]) : "";
  }

  function allCategoriesVisible() {
    return !!yearState().allCategories;
  }

  function loadAllCategoriesPreference() {
    try {
      return window.localStorage.getItem("diya-books-all-categories") === "true";
    } catch (e) {
      return false;
    }
  }

  function saveAllCategoriesPreference(value) {
    try {
      window.localStorage.setItem("diya-books-all-categories", value ? "true" : "false");
    } catch (e) {
      /* private browsing or storage disabled: the toggle just won't persist */
    }
  }

  function renderYearTableScroll() {
    var cats = yearTableColumns();
    var head =
      "<tr><th>Month</th>" +
      cats
        .map(function (c) {
          return '<th class="' + yearColClass(c) + '">' + esc(c.label) + "</th>";
        })
        .join("") +
      "</tr>";

    var rows = SNAPSHOT.months
      .map(function (m) {
        var row = SNAPSHOT.monthly[m.key];
        var isOpen = state.openMonth === m.key;
        var cells = cats
          .map(function (c) {
            return '<td class="' + yearColClass(c) + '"' + monthlyRk(m.label, c.key) + ">" + fmtMoney(yearColValue(c, row)) + "</td>";
          })
          .join("");
        var mainRow =
          '<tr class="year-row' +
          (isOpen ? " is-open" : "") +
          '" data-month="' +
          m.key +
          '" tabindex="0" role="button" aria-expanded="' +
          (isOpen ? "true" : "false") +
          '"><td class="month-cell"><span class="disclosure" aria-hidden="true">▸</span> ' +
          esc(m.label) +
          "</td>" +
          cells +
          "</tr>";
        // Mobile portrait shows the month cards instead of this table and
        // opens the detail inside the card, so only one copy of the
        // entries grid is ever in the document.
        var detailRow =
          isOpen && !isMobilePortrait()
            ? '<tr class="month-detail-row"><td colspan="' + (cats.length + 1) + '">' + renderMonthDetail(m.key) + "</td></tr>"
            : "";
        return mainRow + detailRow;
      })
      .join("");

    var a = SNAPSHOT.annual;
    var totals =
      "<tr><th>Year total</th>" +
      cats
        .map(function (c) {
          var attr = c.from ? "" : rkFor(c.sheet, c.cell);
          return '<td class="' + yearColClass(c) + '"' + attr + ">" + fmtMoney(yearColValue(c, a)) + "</td>";
        })
        .join("") +
      "</tr>";

    return (
      '<div class="year-table-controls"><label class="all-categories-toggle">' +
      '<input type="checkbox" id="all-categories-toggle"' +
      (allCategoriesVisible() ? " checked" : "") +
      " /> All categories</label></div>" +
      '<div class="year-table-scroll' +
      (allCategoriesVisible() ? " show-all-categories" : "") +
      '"><table class="year-table"><thead>' +
      head +
      "</thead><tbody>" +
      rows +
      '</tbody><tfoot class="year-totals">' +
      totals +
      "</tfoot></table></div>"
    );
  }

  // The journals whose lines the shared grid shows; a manifest leaves one
  // out to render its lines through its own month detail instead.
  function gridJournals() {
    return active.months.journals.filter(function (journal) {
      return journal.entriesGrid !== false;
    });
  }

  function renderMonthDetail(monthKey) {
    var row = SNAPSHOT.monthly[monthKey];
    var monthMeta = SNAPSHOT.months.filter(function (m) {
      return m.key === monthKey;
    })[0];
    var summary =
      '<div class="month-summary-grid">' +
      active.yearTable.summary
        .map(function (item) {
          return (
            '<div class="month-summary-item"><span class="caps-label">' +
            esc(item[0]) +
            '</span><span class="value"' +
            (item[2] ? monthlyRk(monthMeta.label, item[1]) : "") +
            ">" +
            fmtMoney(row[item[1]]) +
            "</span></div>"
          );
        })
        .join("") +
      "</div>";

    var detailHtml = active.yearTable.monthDetail ? active.yearTable.monthDetail(monthKey, state, helpers) : "";

    var entries = SNAPSHOT.entries[monthKey];
    var entriesHtml = "";
    if (entries) {
      var open = yearState().entriesOpen;
      var lineCount = gridJournals().reduce(function (sum, journal) {
        return sum + entries[journal.id].length;
      }, 0);
      entriesHtml =
        '<button type="button" class="btn entries-toggle" id="entries-toggle" aria-expanded="' +
        (open ? "true" : "false") +
        '">' +
        (open ? "Hide entries" : "Show entries — " + lineCount + " lines") +
        "</button>" +
        (open ? renderEntriesTables(entries, monthKey) : "");
    } else {
      entriesHtml = '<p class="entries-note">' + esc(monthMeta.label) + " carries no entries in this book.</p>";
    }

    return '<div class="month-detail">' + summary + detailHtml + entriesHtml + "</div>";
  }

  // The entries grid: the month's own posted lines, editable in place. An
  // amount commits through changeLineAmount, the row's delete through
  // removeLine, and the row under the rule adds one through the journal's
  // add edit. Every commit recomputes the whole book. With more than two
  // journals a switch above the grid shows one journal at a time.
  function renderEntriesTables(entries, monthKey) {
    var journals = gridJournals();
    function table(journal) {
      return (
        '<table class="entries-table" data-journal="' +
        esc(journal.id) +
        '"><caption>' +
        esc(journal.label) +
        "</caption><thead><tr><th>Date</th><th>Account</th><th>Detail</th><th>Amount</th>" +
        '<th><span class="sr-only">Remove</span></th></tr></thead><tbody>' +
        entries[journal.id]
          .map(function (r) {
            return entryRow(r, journal.id);
          })
          .join("") +
        "</tbody><tfoot>" +
        addEntryRow(journal.id, monthKey) +
        "</tfoot></table>"
      );
    }
    var switchHtml = "";
    var shown = journals;
    if (journals.length > 2) {
      var chosen = yearState().journal || journals[0].id;
      shown = journals.filter(function (journal) {
        return journal.id === chosen;
      });
      switchHtml =
        '<div class="journal-switch" role="group" aria-label="Journal">' +
        journals
          .map(function (journal) {
            return (
              '<button type="button" class="journal-switch-btn" data-journal-switch="' +
              esc(journal.id) +
              '" aria-pressed="' +
              (journal.id === chosen ? "true" : "false") +
              '">' +
              esc(journal.label) +
              "</button>"
            );
          })
          .join("") +
        "</div>";
    }
    return (
      switchHtml +
      '<div class="entries-columns">' +
      shown.map(table).join("") +
      "</div>" +
      '<p class="entries-note">Change an amount or remove a line and the whole book recalculates. Ctrl+Z (⌘Z) undoes the last change.</p>'
    );
  }

  // The name of the account a code posts to, from the book's own chart. A
  // code the chart does not carry has no name to give.
  function accountDescription(journal, code) {
    var accounts = (SNAPSHOT.chart && SNAPSHOT.chart[journal]) || [];
    for (var i = 0; i < accounts.length; i++) {
      if (accounts[i].code === code) return accounts[i].description;
    }
    return null;
  }

  // A reader knows "Advertising", not 5500, so the name leads and the code
  // follows it in small text. A line the edit functions cannot name on its
  // own (see entryAmountCell) keeps the display only, with no picker to post
  // it under the wrong entry's number.
  function entryAccountCell(r, journal) {
    var description = accountDescription(journal, r.account);
    var display =
      (description ? '<span class="entry-account-name">' + esc(description) + "</span>" : "") +
      '<span class="entry-account-code">' +
      esc(r.account) +
      "</span>" +
      (r.posted
        ? ""
        : ' <span class="entry-flag" title="This account is outside the book\'s chart, so the amount reaches no total">no account</span>');
    if (!r.addressable) return "<td>" + display + "</td>";

    var accounts = (SNAPSHOT.chart && SNAPSHOT.chart[journal]) || [];
    var inChart = accounts.some(function (a) {
      return a.code === String(r.account);
    });
    // An entry already posted outside the chart (an import, not this page's
    // own add row -- that only ever offers chart codes) keeps its own value
    // as the select's first option, so opening the picker never silently
    // reassigns it to whichever account sorts first.
    var options =
      (inChart ? "" : '<option value="' + esc(r.account) + '" selected>' + esc(r.account) + " — outside chart</option>") +
      accounts
        .map(function (account) {
          return (
            '<option value="' +
            esc(account.code) +
            '"' +
            (inChart && String(r.account) === account.code ? " selected" : "") +
            ">" +
            esc(account.code + " — " + account.description) +
            "</option>"
          );
        })
        .join("");
    return (
      "<td>" +
      display +
      '<select class="entry-account-select" data-account-entry="' +
      esc(r.entryNumber) +
      '" aria-label="Account for entry ' +
      esc(r.entryNumber) +
      '">' +
      options +
      "</select></td>"
    );
  }

  // The posting date, editable the same way as the account: a real date
  // input rather than a picker of period-legal choices, because a date
  // outside the accounting period is exactly what book-dates-in-period has
  // to be able to catch when a reader types one in.
  function entryDateCell(r) {
    if (!r.addressable) return "<td>" + esc(r.date) + "</td>";
    return (
      '<td><input type="date" class="entry-date-input" data-date-entry="' +
      esc(r.entryNumber) +
      '" aria-label="Date for entry ' +
      esc(r.entryNumber) +
      '" value="' +
      esc(r.date) +
      '" /></td>'
    );
  }

  function entryRow(r, journal) {
    var detail = r.detail ? r.label + " — " + r.detail : r.label;
    return (
      '<tr class="entry-row' +
      (r.posted ? "" : " is-unposted") +
      '" data-entry="' +
      esc(r.entryNumber) +
      '">' +
      entryDateCell(r) +
      entryAccountCell(r, journal) +
      '<td><span class="entry-detail" title="' +
      esc(detail) +
      '">' +
      esc(detail) +
      "</span></td>" +
      entryAmountCell(r) +
      "</tr>"
    );
  }

  // A line the edit functions cannot name on its own -- no entry number, or
  // one it shares with another line -- shows its figure and no controls,
  // rather than offering an edit that would move two lines at once.
  function entryAmountCell(r) {
    if (!r.addressable) {
      return (
        '<td class="entry-amount">' +
        fmtMoney(r.amount) +
        '</td><td class="entry-actions"><span class="entry-flag" title="This line shares its entry number with another, so it cannot be changed on its own">shared no.</span></td>'
      );
    }
    return (
      '<td class="entry-amount">' +
      '<input class="entry-amount-input" inputmode="decimal" data-amount-entry="' +
      esc(r.entryNumber) +
      '" aria-label="Amount for entry ' +
      esc(r.entryNumber) +
      '" value="' +
      r.amount.toFixed(2) +
      '" /></td><td class="entry-actions">' +
      '<button type="button" class="entry-delete" data-delete-entry="' +
      esc(r.entryNumber) +
      '" title="Remove this entry" aria-label="Remove entry ' +
      esc(r.entryNumber) +
      '">&times;</button></td>'
    );
  }

  function addEntryRow(journal, monthKey) {
    var draft = yearState().addDraft[journal] || {};
    var accounts = (SNAPSHOT.chart && SNAPSHOT.chart[journal]) || [];
    var options = accounts
      .map(function (account) {
        return (
          '<option value="' +
          esc(account.code) +
          '"' +
          (draft.account === account.code ? " selected" : "") +
          ">" +
          esc(account.code + " — " + account.description) +
          "</option>"
        );
      })
      .join("");
    // One full-width cell rather than a row of the grid's own columns: the
    // form's controls are wider than the figures above them, and letting
    // them set the column widths would spread the ledger out.
    return (
      '<tr class="entry-add-row" data-add-journal="' +
      esc(journal) +
      '"><td colspan="5"><div class="entry-add-form">' +
      '<input type="date" class="entry-add-date" data-add-field="date" value="' +
      esc(draft.date || monthKey + "-01") +
      '" aria-label="Date for the new ' +
      esc(journal) +
      ' entry" />' +
      '<select class="entry-add-account" data-add-field="account" aria-label="Account for the new ' +
      esc(journal) +
      ' entry">' +
      options +
      "</select>" +
      '<input class="entry-add-detail" data-add-field="detail" placeholder="Detail" value="' +
      esc(draft.detail || "") +
      '" aria-label="Detail for the new ' +
      esc(journal) +
      ' entry" />' +
      '<input class="entry-add-amount" data-add-field="amount" inputmode="decimal" placeholder="0.00" value="' +
      esc(draft.amount || "") +
      '" aria-label="Amount for the new ' +
      esc(journal) +
      ' entry" />' +
      '<button type="button" class="entry-add-btn" data-add-entry="' +
      esc(journal) +
      '" title="Add this ' +
      esc(journal) +
      ' entry">Add</button>' +
      "</div></td></tr>"
    );
  }

  // The phone's own year table: a card a month, opening in place to the
  // month's summary and its entries -- the same grid, the same commit
  // route, no navigation away from the list.
  function renderMonthCards() {
    var portrait = isMobilePortrait();
    var card = active.yearTable.card;
    return (
      '<div class="month-cards">' +
      SNAPSHOT.months
        .map(function (m) {
          var row = SNAPSHOT.monthly[m.key];
          var isOpen = portrait && state.openMonth === m.key;
          return (
            '<div class="month-card' +
            (isOpen ? " is-open" : "") +
            '" data-month-card="' +
            m.key +
            '">' +
            '<button type="button" class="month-card-head" aria-expanded="' +
            (isOpen ? "true" : "false") +
            '"><span class="month-name">' +
            esc(m.label) +
            '</span><span class="mono">' +
            fmtMoney(row[card.headline]) +
            "</span></button>" +
            '<div class="month-card-figures">' +
            card.figures
              .map(function (figure) {
                return (
                  '<span class="figure-label">' +
                  esc(figure[0]) +
                  '</span><span class="figure-value"' +
                  (figure[2] ? monthlyRk(m.label, figure[1]) : "") +
                  ">" +
                  fmtMoney(row[figure[1]]) +
                  "</span>"
                );
              })
              .join("") +
            "</div>" +
            (isOpen ? renderMonthDetail(m.key) : "") +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function isMobilePortrait() {
    return window.matchMedia("(max-width: 899px) and (orientation: portrait)").matches;
  }

  function bindYearView() {
    var year = yearState();
    Array.prototype.forEach.call(els.viewRoot.querySelectorAll(".year-row"), function (tr) {
      function toggle() {
        var key = tr.getAttribute("data-month");
        if (state.openMonth === key) {
          state.openMonth = null;
        } else {
          state.openMonth = key;
          year.entriesOpen = false;
        }
        render();
      }
      tr.addEventListener("click", toggle);
      tr.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });
    var entriesToggle = document.getElementById("entries-toggle");
    if (entriesToggle) {
      entriesToggle.addEventListener("click", function () {
        year.entriesOpen = !year.entriesOpen;
        render();
      });
    }
    var allCategoriesToggle = document.getElementById("all-categories-toggle");
    if (allCategoriesToggle) {
      allCategoriesToggle.addEventListener("change", function () {
        year.allCategories = allCategoriesToggle.checked;
        saveAllCategoriesPreference(year.allCategories);
        render();
      });
    }
    Array.prototype.forEach.call(els.viewRoot.querySelectorAll(".month-card-head"), function (head) {
      head.addEventListener("click", function () {
        var key = head.closest(".month-card").getAttribute("data-month-card");
        state.openMonth = state.openMonth === key ? null : key;
        year.entriesOpen = true;
        state.view = "year";
        render();
      });
    });
    Array.prototype.forEach.call(els.viewRoot.querySelectorAll("[data-journal-switch]"), function (btn) {
      btn.addEventListener("click", function () {
        year.journal = btn.getAttribute("data-journal-switch");
        render();
      });
    });
    bindEntriesGrid();
    if (active.yearTable.bindMonthDetail) active.yearTable.bindMonthDetail(els.viewRoot, state, helpers);
  }

  // ============================== the entries grid ==============================

  function parseAmount(raw) {
    var cleaned = String(raw).replace(/[£,\s]/g, "");
    if (cleaned === "" || !/^-?\d*(\.\d*)?$/.test(cleaned)) return null;
    var value = Number(cleaned);
    return isFinite(value) ? value : null;
  }

  function bindEntriesGrid() {
    Array.prototype.forEach.call(els.viewRoot.querySelectorAll("[data-amount-entry]"), function (input) {
      var entryNumber = input.getAttribute("data-amount-entry");
      var committed = input.value;
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
      input.addEventListener("change", function () {
        var amount = parseAmount(input.value);
        if (amount === null) {
          input.value = committed;
          showToast("That is not an amount. The line is unchanged.");
          return;
        }
        if (Math.abs(amount - Number(committed)) < 1e-9) {
          input.value = committed;
          return;
        }
        input.setAttribute("data-dirty", "false");
        state.focusEntry = entryNumber;
        state.focusField = "amount";
        commit(
          function () {
            return window.DiyaGlBooksEdits.changeAmount(state.book, state.lines, entryNumber, amount);
          },
          "change " + entryNumber + " to " + fmtMoney(amount),
          "Changed " + entryNumber + " to " + fmtMoney(amount) + ".",
        );
      });
    });

    Array.prototype.forEach.call(els.viewRoot.querySelectorAll("[data-date-entry]"), function (input) {
      var entryNumber = input.getAttribute("data-date-entry");
      var committed = input.value;
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
      input.addEventListener("change", function () {
        var newDate = input.value;
        if (!newDate) {
          input.value = committed;
          showToast("That is not a date. The line is unchanged.");
          return;
        }
        if (newDate === committed) return;
        input.setAttribute("data-dirty", "false");
        state.focusEntry = entryNumber;
        state.focusField = "date";
        commit(
          function () {
            return window.DiyaGlBooksEdits.changeDate(state.book, state.lines, entryNumber, newDate);
          },
          "change " + entryNumber + "'s date to " + newDate,
          "Changed " + entryNumber + "'s date to " + newDate + ".",
        );
      });
    });

    Array.prototype.forEach.call(els.viewRoot.querySelectorAll("[data-account-entry]"), function (select) {
      var entryNumber = select.getAttribute("data-account-entry");
      var committed = select.value;
      select.addEventListener("change", function () {
        var newAccount = select.value;
        if (newAccount === committed) return;
        state.focusEntry = entryNumber;
        state.focusField = "account";
        commit(
          function () {
            return window.DiyaGlBooksEdits.changeAccount(state.book, state.lines, entryNumber, newAccount);
          },
          "change " + entryNumber + "'s account to " + newAccount,
          "Changed " + entryNumber + "'s account to " + newAccount + ".",
        );
      });
    });

    Array.prototype.forEach.call(els.viewRoot.querySelectorAll("[data-delete-entry]"), function (btn) {
      btn.addEventListener("click", function () {
        var entryNumber = btn.getAttribute("data-delete-entry");
        commit(
          function () {
            return window.DiyaGlBooksEdits.deleteEntry(state.book, state.lines, entryNumber);
          },
          "remove " + entryNumber,
          "Removed " + entryNumber + ".",
          { label: "Undo", onClick: undoLastEdit },
        );
      });
    });

    var addDraft = yearState().addDraft;
    Array.prototype.forEach.call(els.viewRoot.querySelectorAll(".entry-add-row"), function (row) {
      var journal = row.getAttribute("data-add-journal");
      function fieldValue(name) {
        var field = row.querySelector('[data-add-field="' + name + '"]');
        return field ? field.value : "";
      }
      Array.prototype.forEach.call(row.querySelectorAll("[data-add-field]"), function (field) {
        field.addEventListener("input", function () {
          addDraft[journal] = {
            date: fieldValue("date"),
            account: fieldValue("account"),
            detail: fieldValue("detail"),
            amount: fieldValue("amount"),
          };
        });
      });
      row.querySelector("[data-add-entry]").addEventListener("click", function () {
        var amount = parseAmount(fieldValue("amount"));
        var date = fieldValue("date");
        var account = fieldValue("account");
        if (amount === null || amount === 0) {
          showToast("Give the new entry an amount first.");
          return;
        }
        if (!date) {
          showToast("Give the new entry a date first.");
          return;
        }
        if (!account) {
          showToast("This book's chart carries no " + journal + " account to post to.");
          return;
        }
        var entry = { journal: journal, date: date, account: account, detail: fieldValue("detail"), amount: amount };
        addDraft[journal] = null;
        commit(
          function () {
            return window.DiyaGlBooksEdits.addEntry(state.book, state.lines, entry);
          },
          "add a " + journal + " entry of " + fmtMoney(amount),
          "Added a " + journal + " entry of " + fmtMoney(amount) + ".",
        );
      });
    });
  }

  // ============================== form and panel builders ==============================
  // The HMRC form idiom a product's tax-form views render through, and the
  // panel pieces the other views share, so every product's views carry the
  // same classes and the layouts, the axe gate and the drift walker apply
  // to all of them.

  var form = {
    render: function (name, microcopy, sectionsHtml) {
      return (
        '<div class="form-render">' +
        '<div class="form-masthead"><div class="form-name">' +
        esc(name) +
        '</div><div class="form-microcopy">' +
        esc(microcopy) +
        "</div></div>" +
        sectionsHtml +
        "</div>"
      );
    },
    section: function (heading, rowsHtml) {
      return '<div class="form-section"><h3>' + esc(heading) + "</h3>" + rowsHtml + "</div>";
    },
    // amount arrives formatted (fmtBoxMoney or fmtBoxWhole); wholePounds
    // adds the form's own note beside the box.
    row: function (opts) {
      var box = '<span class="form-amount-box"' + (opts.rKeyAttr || "") + ">" + opts.amount + "</span>";
      return (
        '<div class="form-row' +
        (opts.total ? " total-row" : "") +
        '">' +
        (opts.box ? '<span class="box-chip">' + esc(opts.box) + "</span>" : "") +
        '<span class="form-row-label">' +
        esc(opts.label) +
        "</span>" +
        (opts.wholePounds ? '<span class="form-amount-wrap">' + box + '<span class="whole-pounds-note">whole pounds</span></span>' : box) +
        "</div>"
      );
    },
    // A tax band: the label, its ceiling where the band has one, the rate in
    // pencil, and the tax it charged in the box.
    rateRow: function (opts) {
      return (
        '<div class="form-row"><span class="form-row-label">' +
        esc(opts.label) +
        (opts.ceiling ? " to <span" + (opts.ceilingRKeyAttr || "") + ">" + opts.ceiling + "</span>" : "") +
        '<span class="form-rate-pencil"' +
        (opts.rateRKeyAttr || "") +
        ">" +
        opts.rate +
        '</span></span><span class="form-amount-box"' +
        (opts.rKeyAttr || "") +
        ">" +
        opts.amount +
        "</span></div>"
      );
    },
  };

  // A book field the shell commits: [data-book-field] names the field,
  // opts.path a dotted path when it lives somewhere other than the
  // manifest's bookFields say.
  function field(label, bookField, value, opts) {
    opts = opts || {};
    var id = "book-field-" + bookField;
    return (
      '<div class="editable-field"><label for="' +
      id +
      '">' +
      esc(label) +
      "</label>" +
      (opts.hint ? '<span class="field-hint" id="' + id + '-hint">' + esc(opts.hint) + "</span>" : "") +
      '<input id="' +
      id +
      '" type="' +
      (opts.type || "text") +
      '" data-book-field="' +
      bookField +
      '"' +
      (opts.path ? ' data-book-path="' + esc(opts.path) + '"' : "") +
      (opts.hint ? ' aria-describedby="' + id + '-hint"' : "") +
      (opts.rKeyAttr || "") +
      ' value="' +
      esc(value) +
      '" /></div>'
    );
  }

  function readOnlyField(label, value) {
    return '<div class="editable-field"><label>' + esc(label) + '</label><input value="' + esc(value) + '" readonly /></div>';
  }

  // A kv-table from [{ label, value | text, rKeyAttr, total }]: value is a
  // money figure, text an already-formatted string.
  function kvRows(rows) {
    return (
      '<table class="kv-table">' +
      rows
        .map(function (row) {
          return (
            '<tr class="' +
            (row.total ? "total" : "") +
            '"><td>' +
            esc(row.label) +
            "</td><td" +
            (row.rKeyAttr || "") +
            ">" +
            (row.text !== undefined ? row.text : fmtMoney(row.value)) +
            "</td></tr>"
          );
        })
        .join("") +
      "</table>"
    );
  }

  // ============================== inspector: checks, drift, helpers ==============================

  function renderDriftSummary() {
    var checks = SNAPSHOT.checks;
    var passCount =
      checks.filter(function (c) {
        return c.result === "pass";
      }).length +
      state.bookChecks.filter(function (c) {
        return c.result === "pass";
      }).length;
    var warnCount =
      checks.filter(function (c) {
        return c.result !== "pass";
      }).length +
      state.bookChecks.filter(function (c) {
        return c.result !== "pass";
      }).length;
    var driftCount = SNAPSHOT.drift.filter(function (d) {
      return Math.abs(d.computed - d.asRead) >= 0.005;
    }).length;
    return (
      '<div class="drift-summary">' +
      '<div class="drift-summary-item pass"><span class="count">' +
      passCount +
      '</span><span class="caps-label">Pass</span></div>' +
      '<div class="drift-summary-item warn"><span class="count">' +
      warnCount +
      '</span><span class="caps-label">Need attention</span></div>' +
      '<div class="drift-summary-item"><span class="count">' +
      driftCount +
      '</span><span class="caps-label">' +
      (SNAPSHOT.edited ? "Recalculated" : "Differ from workbook") +
      "</span></div>" +
      "</div>"
    );
  }

  function checkMarker(result) {
    return result === "pass" ? "✓" : result === "warn" ? "⚠" : "!";
  }

  // A wall of green rows is not reassurance. Everything that passes folds
  // into one line the reader can open; what needs attention stays open.
  function passingDisclosure(count, rowsHtml) {
    return (
      '<li class="checks-passing"><details><summary>' +
      count +
      (count === 1 ? " check passes" : " checks pass") +
      '</summary><ul class="checks-passing-list">' +
      rowsHtml +
      "</ul></details></li>"
    );
  }

  // The engine's own checks: checkCompliance, the ones the reconciliation
  // runs. Both sides of each are derived from the same lines, so they follow
  // an edit rather than catching one -- what they catch is the calculator
  // and the book disagreeing.
  function renderChecksList() {
    function row(c) {
      return (
        '<li class="check-item ' +
        c.result +
        '"' +
        rk("check/" + c.label) +
        '><span class="check-marker" aria-hidden="true">' +
        checkMarker(c.result) +
        '</span><span class="check-body"><span class="check-label">' +
        esc(c.label) +
        '</span><br/><span class="check-figures">' +
        (c.result === "pass" ? "matches" : "expected " + fmtMoney(c.expected) + " · actual " + fmtMoney(c.actual)) +
        "</span></span></li>"
      );
    }
    var passing = SNAPSHOT.checks.filter(isPassing);
    var open = SNAPSHOT.checks.filter(notPassing);
    return (
      '<p class="caps-label checks-group-label">Engine checks</p><ul class="checks-list">' +
      open.map(row).join("") +
      (passing.length ? passingDisclosure(passing.length, passing.map(row).join("")) : "") +
      "</ul>"
    );
  }

  function isPassing(c) {
    return c.result === "pass";
  }
  function notPassing(c) {
    return c.result !== "pass";
  }

  // The book checks and warnings: the ones over D itself, where an entry can
  // be wrong while every total still adds up. A failing check carries its
  // fix-it; a warning is advisory and says so in a word, never in colour
  // alone.
  function renderBookChecksList() {
    function row(c) {
      var isWarning = c.tier === "warning";
      var figures = isWarning ? "" : c.result === "pass" ? "every line" : c.actual + (c.actual === 1 ? " line" : " lines");
      return (
        '<li class="check-item ' +
        c.result +
        (isWarning ? " is-warning" : "") +
        '" data-book-check="' +
        esc(c.id) +
        '"><span class="check-marker" aria-hidden="true">' +
        checkMarker(c.result) +
        '</span><span class="check-body">' +
        (c.result === "warn" ? '<span class="check-tier">Warning</span>' : "") +
        '<span class="check-label">' +
        esc(c.label) +
        "</span>" +
        (figures ? '<br/><span class="check-figures">' + figures + "</span>" : "") +
        (c.result === "pass" ? "" : renderBookCheckDetail(c)) +
        "</span></li>"
      );
    }
    var passing = state.bookChecks.filter(isPassing);
    var open = state.bookChecks.filter(notPassing);
    return (
      '<p class="caps-label checks-group-label">Book checks</p><ul class="book-checks-list">' +
      open.map(row).join("") +
      (passing.length ? passingDisclosure(passing.length, passing.map(row).join("")) : "") +
      "</ul>"
    );
  }

  // A helper's preview: the lines it would change, or the entries it would
  // add to the book, depending on its kind.
  function previewFor(check) {
    if (check.helper.kind === "book") {
      return SNAPSHOT.context.engine.previewBookHelper({ book: SNAPSHOT.book, lines: SNAPSHOT.lines }, check.id);
    }
    return window.DiyaGlBooksEdits.previewHelper(SNAPSHOT, check.id);
  }

  // A focus helper does not change the book; it takes the reader to each
  // offending entry's own row so they can.
  function renderFocusHelper(check) {
    return check.offenders
      .map(function (o) {
        return (
          '<button type="button" class="btn" data-helper-focus="' +
          esc(check.id) +
          '" data-focus-entry="' +
          esc(o.entryNumber) +
          '">Go to ' +
          esc(o.postingDate) +
          "</button>"
        );
      })
      .join("");
  }

  function renderBookCheckDetail(check) {
    var offenders = !check.offenders.length
      ? ""
      : '<ul class="check-offenders">' +
        check.offenders
          .slice(0, 5)
          .map(function (o) {
            return (
              "<li>" + esc(o.entryNumber) + " · " + esc(o.postingDate) + " · " + esc(o.accountMainID) + " · " + fmtMoney(o.amount) + "</li>"
            );
          })
          .join("") +
        (check.offenders.length > 5 ? "<li>and " + (check.offenders.length - 5) + " more</li>" : "") +
        "</ul>";
    if (!check.helper) {
      return '<p class="check-consequence">' + esc(check.consequence) + "</p>" + offenders;
    }
    var open = state.openHelper === check.id;
    var preview = open ? previewFor(check) : null;
    var controls;
    if (check.helper.kind === "focus") {
      controls = '<div class="helper-actions">' + renderFocusHelper(check) + "</div>";
    } else if (open && preview) {
      controls =
        '<p class="helper-summary">' +
        esc(preview.summary) +
        '</p><ul class="helper-changes">' +
        preview.changes
          .map(function (change) {
            return (
              "<li>" + esc(change.entryNumber) + " — " + esc(change.what) + " " + esc(change.was) + " → " + esc(change.becomes) + "</li>"
            );
          })
          .join("") +
        '</ul><div class="helper-actions">' +
        '<button type="button" class="btn btn-primary" data-helper-apply="' +
        esc(check.id) +
        '">Apply</button>' +
        '<button type="button" class="btn" data-helper-cancel="' +
        esc(check.id) +
        '">Cancel</button></div>';
    } else {
      controls =
        '<button type="button" class="btn" data-helper-preview="' + esc(check.id) + '">' + esc(check.helper.actionLabel) + "</button>";
    }
    return (
      '<p class="check-consequence">' +
      esc(check.consequence) +
      "</p>" +
      offenders +
      '<div class="check-helper">' +
      "<p><strong>" +
      esc(check.helper.title) +
      "</strong></p>" +
      controls +
      "</div>"
    );
  }

  function renderInspectorFull() {
    return (
      "<h3>Checks &amp; drift</h3>" +
      renderDriftSummary() +
      renderBookChecksList() +
      renderChecksList() +
      '<div style="margin-top:1rem"><button type="button" class="btn btn-primary" id="inspector-save-btn">Save workbook</button></div>'
    );
  }

  function renderInspectorChecksOnly() {
    return "<h3>Checks &amp; drift</h3>" + renderDriftSummary() + renderBookChecksList() + renderChecksList();
  }

  function bookCheckById(checkId) {
    return state.bookChecks.filter(function (c) {
      return c.id === checkId;
    })[0];
  }

  // Applies a helper's whole plan as one undo step: a lines helper through
  // the edit path, a book helper through commitBook.
  function applyHelper(checkId) {
    var check = bookCheckById(checkId);
    var snapshotAtPreview = SNAPSHOT;
    state.openHelper = null;
    var undoLabel = check ? check.helper.title.toLowerCase() : checkId;
    var toastMessage = check ? check.helper.title + " — applied." : "Applied.";
    if (check && check.helper.kind === "book") {
      var nextBook = snapshotAtPreview.context.engine.applyBookHelper(
        { book: snapshotAtPreview.book, lines: snapshotAtPreview.lines },
        checkId,
      );
      commitBook(nextBook, undoLabel, toastMessage);
      return;
    }
    commit(
      function () {
        return window.DiyaGlBooksEdits.applyHelper(snapshotAtPreview, checkId);
      },
      undoLabel,
      toastMessage,
    );
  }

  // Takes the reader to one offending entry: its month opens in the year
  // view and the helper's field gets the caret.
  function focusOffender(checkId, entryNumber) {
    var check = bookCheckById(checkId);
    var offender = check.offenders.filter(function (o) {
      return String(o.entryNumber) === entryNumber;
    })[0];
    if (!offender) return;
    state.openMonth = active.months.keyOf ? active.months.keyOf(offender) : offender.postingDate.slice(0, 7);
    state.focusEntry = offender.entryNumber;
    state.focusField = check.helper.field;
    state.view = "year";
    yearState().entriesOpen = true;
    closeDrawer();
    render();
  }

  function bindInspectorInteractions() {
    var btn = document.getElementById("inspector-save-btn");
    if (btn) {
      btn.addEventListener("click", handleSave);
    }
    // The inspector is rendered twice -- the desktop rail and the drawer --
    // so the helper controls are bound by data attribute across both copies.
    [els.inspector, els.inspectorDrawer].forEach(function (root) {
      Array.prototype.forEach.call(root.querySelectorAll("[data-helper-preview]"), function (control) {
        control.addEventListener("click", function () {
          state.openHelper = control.getAttribute("data-helper-preview");
          render();
        });
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-helper-cancel]"), function (control) {
        control.addEventListener("click", function () {
          state.openHelper = null;
          render();
        });
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-helper-apply]"), function (control) {
        control.addEventListener("click", function () {
          applyHelper(control.getAttribute("data-helper-apply"));
        });
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-helper-focus]"), function (control) {
        control.addEventListener("click", function () {
          focusOffender(control.getAttribute("data-helper-focus"), control.getAttribute("data-focus-entry"));
        });
      });
    });
  }

  // ============================== global controls ==============================

  function bindGlobalControls() {
    els.themeToggle.addEventListener("click", function () {
      var root = document.documentElement;
      var current = root.getAttribute("data-theme");
      var next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        window.localStorage.setItem("diya-books-theme", next);
      } catch (e) {
        /* private browsing or storage disabled: theme just won't persist */
      }
      els.themeToggle.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
    });
    try {
      var saved = window.localStorage.getItem("diya-books-theme");
      if (saved) {
        document.documentElement.setAttribute("data-theme", saved);
        els.themeToggle.setAttribute("aria-pressed", saved === "dark" ? "true" : "false");
      }
    } catch (e) {
      /* no persisted theme available */
    }

    els.saveBtn.addEventListener("click", handleSave);
    els.saveBtnMobile.addEventListener("click", handleSave);
    els.undoBtn.addEventListener("click", undoLastEdit);
    els.undoBtnMobile.addEventListener("click", undoLastEdit);

    // Ctrl+Z / Cmd+Z undoes the book, except while a field holds typing the
    // reader has not committed yet -- there the browser's own undo is what
    // they meant.
    document.addEventListener("keydown", function (e) {
      if (e.key !== "z" && e.key !== "Z") return;
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      var activeEl = document.activeElement;
      if (activeEl && activeEl.getAttribute && activeEl.getAttribute("data-dirty") === "true") return;
      if (activeEl && (activeEl.tagName === "TEXTAREA" || (activeEl.tagName === "INPUT" && activeEl.hasAttribute("data-add-field"))))
        return;
      if (!state.loaded) return;
      e.preventDefault();
      undoLastEdit();
    });
    els.drawerToggleBtn.addEventListener("click", function () {
      if (state.drawerOpen) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
    els.drawerBackdrop.addEventListener("click", closeDrawer);
    els.sheetTabs.addEventListener("scroll", updateTabStripFades);

    window.addEventListener("resize", function () {
      render();
    });

    bindDropZone();
  }

  function openDrawer() {
    state.drawerOpen = true;
    els.inspectorDrawer.classList.add("is-open");
    els.drawerBackdrop.classList.remove("hidden");
  }
  function closeDrawer() {
    state.drawerOpen = false;
    els.inspectorDrawer.classList.remove("is-open");
    els.drawerBackdrop.classList.add("hidden");
    if (state.mobileTab === "checks") {
      state.mobileTab = "books";
      renderMobileTabbar();
    }
  }

  // The live book and lines, as every edit has left them. Save writes what
  // the page is showing, not what was loaded.
  function currentBookAndLines() {
    if (state.book && state.lines) return { book: state.book, lines: state.lines };
    return null;
  }

  function handleSave(event) {
    if (!state.loaded) return;
    var current = currentBookAndLines();
    if (!current) {
      showToast("Save generates the workbook client-side once a workbook's book and lines are loaded into the page.");
      return;
    }
    openSaveMenu(event && event.currentTarget, current);
  }

  // The four downloads, less the single workbook for a product whose package
  // is several files.
  function saveMenuItems() {
    var items = [];
    if (active.save.singleFile) items.push({ label: "Download " + active.save.workbookName, format: "xlsx" });
    items.push({ label: "Download package (.zip)", format: "zip" });
    items.push({ label: "Download books as diya-gl (.zip)", format: "diya-gl-zip" });
    items.push({ label: "Download books as JSON (.json)", format: "json" });
    return items;
  }

  function openSaveMenu(anchorEl, current) {
    closeSaveMenu();
    var menu = document.createElement("div");
    menu.id = "save-menu";
    menu.setAttribute("role", "menu");
    menu.style.cssText =
      "position:fixed;z-index:1000;background:var(--paper-raised);border:1px solid var(--rule-faint);" +
      "border-radius:var(--radius);box-shadow:var(--shadow);padding:0.25rem;display:flex;flex-direction:column;min-width:210px;";

    var rect =
      anchorEl && anchorEl.getBoundingClientRect ? anchorEl.getBoundingClientRect() : { bottom: 56, left: window.innerWidth - 220 };
    menu.style.top = Math.max(4, Math.min(rect.bottom + 4, window.innerHeight - 100)) + "px";
    menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 220)) + "px";

    saveMenuItems().forEach(function (opt) {
      var item = document.createElement("button");
      item.type = "button";
      item.setAttribute("role", "menuitem");
      item.style.cssText =
        "text-align:left;border:none;background:none;padding:0.5rem 0.75rem;cursor:pointer;color:var(--ink);font:inherit;";
      item.textContent = opt.label;
      item.addEventListener("click", function () {
        closeSaveMenu();
        runSave(current, opt.format);
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);
    els.saveMenu = menu;
    window.setTimeout(function () {
      document.addEventListener("click", onOutsideSaveMenuClick, true);
      document.addEventListener("keydown", onSaveMenuKeydown);
    }, 0);
  }

  function onOutsideSaveMenuClick(event) {
    if (els.saveMenu && !els.saveMenu.contains(event.target)) closeSaveMenu();
  }

  function onSaveMenuKeydown(event) {
    if (event.key === "Escape") closeSaveMenu();
  }

  function closeSaveMenu() {
    if (els.saveMenu) {
      els.saveMenu.remove();
      els.saveMenu = null;
      document.removeEventListener("click", onOutsideSaveMenuClick, true);
      document.removeEventListener("keydown", onSaveMenuKeydown);
    }
  }

  function saveFormatLabel(format) {
    if (format === "xlsx") return active.save.workbookName;
    if (format === "zip") return "the package zip";
    if (format === "diya-gl-zip") return "the diya-gl zip";
    if (format === "json") return "the diya-gl JSON";
    return "the download";
  }

  // save.js wraps saveWorkbook/savePackageZip -- the same functions
  // the CLI and the MCP server write a workbook through -- and
  // writeDiyaGlZip/writeBookJson -- the same functions export.js writes
  // through -- behind the engine bundle and a fetch-backed resource loader,
  // then turns the bytes into a download. Dynamic import keeps this a
  // plain script: no engine code loads until a save is actually asked for.
  // The diya-gl formats need R, already sitting on the live snapshot.
  // The diya-gl zip's fourth file: the same book checks and warnings
  // export.js's --file mode writes as bookchecks.json and the MCP report
  // tool returns alongside R, run over this page's own live book and lines
  // with the tax data the load already resolved (SNAPSHOT.context.taxData --
  // the same field edits.js's own bookChecks() reads for the inspector
  // panel). Round-tripped through bookChecksJson's own sort and stringify, so
  // the bytes writeDiyaGlZip's JSON.stringify produces for bookchecks.json
  // match a CLI export's byte for byte.
  function buildBookChecksForZip(engine, book, lines) {
    var taxData = (SNAPSHOT.context && SNAPSHOT.context.taxData) || null;
    var results = engine.runBookChecks({ book: book, lines: lines, taxData: taxData }).results;
    return JSON.parse(engine.bookChecksJson(results));
  }

  function runSave(current, format) {
    showToast("Generating " + saveFormatLabel(format) + "...");
    Promise.all([import("./save.js"), format === "diya-gl-zip" ? import("./engine/diya-gl-engine.js") : Promise.resolve(null)])
      .then(function (modules) {
        var saveModule = modules[0];
        var engine = modules[1];
        var extras;
        if (format === "diya-gl-zip") {
          extras = { report: SNAPSHOT.report, bookchecks: buildBookChecksForZip(engine, current.book, current.lines) };
        } else if (format === "json") {
          extras = { report: SNAPSHOT.report };
        }
        return saveModule.buildSaveArtifact(current.book, current.lines, format, extras).then(function (artifact) {
          saveModule.downloadArtifact(artifact);
          showToast("Saved " + artifact.filename + ".");
        });
      })
      .catch(function (error) {
        showToast("Could not generate the download: " + (error && error.message ? error.message : error));
      });
  }

  var toastTimer = null;
  // A plain message auto-dismisses after four seconds, as always. One
  // carrying an action (the drop-onto-a-loaded-book refusal) stays until
  // the reader clicks it, or the next showToast call replaces it.
  function showToast(message, action) {
    els.toast.innerHTML = "";
    var text = document.createElement("span");
    text.textContent = message;
    els.toast.appendChild(text);
    if (action) {
      var actionBtn = document.createElement("button");
      actionBtn.type = "button";
      actionBtn.className = "toast-action-btn";
      actionBtn.textContent = action.label;
      // #toast is pointer-events:none so a plain message never blocks a
      // click on the page underneath it; this button opts back in so the
      // one toast that carries a control stays clickable.
      actionBtn.style.cssText =
        "margin-left:0.75rem;border:1px solid currentColor;background:none;color:inherit;" +
        "padding:0.2rem 0.6rem;border-radius:var(--radius);cursor:pointer;font:inherit;pointer-events:auto;";
      actionBtn.addEventListener("click", function () {
        window.clearTimeout(toastTimer);
        els.toast.classList.remove("is-visible");
        action.onClick();
      });
      els.toast.appendChild(actionBtn);
    }
    els.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    if (!action) {
      toastTimer = window.setTimeout(function () {
        els.toast.classList.remove("is-visible");
      }, 4000);
    }
  }

  // ============================== the public surface ==============================

  // What a manifest's views render and bind through. One frozen object,
  // built once, so a snapshot derivation and a render share one rkFor.
  var helpers = Object.freeze({
    rk: rk,
    rk2: rk2,
    rkFor: rkFor,
    cellKey: cellKey,
    sectionKey: sectionKey,
    fmtMoney: fmtMoney,
    fmtWhole: fmtWhole,
    fmtBoxMoney: fmtBoxMoney,
    fmtBoxWhole: fmtBoxWhole,
    fmtRate: fmtRate,
    fmtPence: fmtPence,
    esc: esc,
    commit: commit,
    commitBook: commitBook,
    setLines: setLines,
    showToast: showToast,
    render: render,
    viewState: viewState,
    isMobilePortrait: isMobilePortrait,
    form: form,
    field: field,
    readOnlyField: readOnlyField,
    kvRows: kvRows,
    sectionRows: sectionRows,
    bindBookFields: bindBookFields,
  });

  // What the page answers to from outside itself. setLines is the way a
  // caller that is not the entries grid changes the book; undo is the same
  // stack the topbar button and Ctrl+Z pop; mount and loadManifest are how
  // another product's views reach this page.
  window.DiyaGlBooksPage = {
    setLines: setLines,
    undo: undoLastEdit,
    mount: mount,
    loadManifest: loadManifest,
    helpers: helpers,
    get manifest() {
      return active;
    },
  };
})();
