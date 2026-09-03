// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 DIY Accounting Ltd

// books/bst.js
//
// The books page shell: view state, rendering, drill interaction and the
// entries grid. Every figure it renders comes from the snapshot bst-data.js
// computes (window.DIYA_BST_SNAPSHOT); every change it makes goes out
// through bst-edits.js, which reaches the engine's own edit functions. This
// file imports no engine module of its own.

(function () {
  "use strict";

  var SNAPSHOT = window.DIYA_BST_SNAPSHOT;

  var VIEWS = [
    { id: "home", label: "Home", sheets: "Home" },
    { id: "year", label: "Year", sheets: "SalesApr–Mar, PurchasesApr–Mar" },
    { id: "profit-loss", label: "P&L", sheets: "Profit & Loss Acc" },
    { id: "stock", label: "Stock", sheets: "PurchasesStock" },
    { id: "debtors-creditors", label: "Debtors/Creditors", sheets: "Debtors & Creditors" },
    { id: "fixed-assets", label: "Fixed Assets", sheets: "Fixed Assets" },
    { id: "income-tax", label: "Income Tax", sheets: "Income Tax" },
    { id: "sa103s", label: "SA103S", sheets: "SE Short" },
    { id: "business-details", label: "Business Details", sheets: "Business Details" },
    { id: "admin", label: "Admin", sheets: "Admin" },
  ];

  var state = {
    loaded: false,
    view: "home",
    openMonth: "2025-04",
    entriesOpen: true,
    drawerOpen: false,
    mobileTab: "books",
    newBookFormOpen: false,
    savedBook: null, // { book, lines, source, savedAt }, once the autosave check resolves
    // The live book: D as the page currently holds it. Every edit replaces
    // state.lines with the array diya-gl-edits.js returned and recomputes
    // the whole book from it -- there is no incremental update.
    book: null,
    lines: null,
    context: null,
    bookChecks: [],
    openHelper: null,
    addDraft: {},
    focusEntry: null,
    committing: false,
  };

  var els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    els.app = document.getElementById("app");
    els.topbarTitle = document.getElementById("app-title");
    els.sheetTabs = document.getElementById("sheet-tabs");
    els.viewRoot = document.getElementById("view-root");
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

    renderSheetTabs();
    bindGlobalControls();
    render();
    checkForSavedBook();
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
    return fmtMoney(n).replace(/^-?\u00a3/, function (m) {
      return m.charAt(0) === "-" ? "-" : "";
    });
  }
  function fmtBoxWhole(n) {
    return fmtWhole(n).replace(/^-?\u00a3/, function (m) {
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
  // Every figure below carries the S2 key(s) report-serializer.js gives the
  // same value: a cell key for the workbook cell CELL_MAP names
  // (app/products/bst.js) and, where CELL_MAP prints the row on a report
  // section, the matching section key. Both name the same value, so a
  // figure the page shows once carries both. A figure CELL_MAP does not
  // name carries neither -- app/data/render-unrepresentable.json says why.
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

  // The signature element: a calculated value in ink, the workbook's as-read
  // value struck through in pencil beneath it, signed drift in the margin.
  // Once the book has been edited the same mark says "recalculated" -- the
  // difference is then the edit's own effect, not a reconciliation finding.
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
      (opts.recalculated ? '<span class="drift-tag">recalculated</span>' : "") +
      "</span>"
    );
  }

  function correctionFor(driftEntry, opts) {
    opts = opts || {};
    return pencilCorrection(driftEntry.computed, driftEntry.asRead, {
      inMargin: opts.inMargin,
      recalculated: driftEntry.recalculated,
      rKeyAttr: opts.rKeyAttr,
    });
  }

  // ============================== rendering ==============================

  function render() {
    document.body.classList.toggle("is-loaded", state.loaded);
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

    var view = state.mobileTab === "charts" && isMobileViewport() ? "charts" : state.view;
    els.viewRoot.innerHTML = renderView(view);
    bindViewInteractions(view);

    els.inspector.innerHTML = renderInspectorFull();
    els.inspectorDrawer.innerHTML =
      '<div class="drawer-handle"></div>' + (state.mobileTab === "checks" ? renderInspectorChecksOnly() : renderInspectorFull());
    bindInspectorInteractions();
    renderMobileTabbar();
    restoreEditFocus();
  }

  // A commit re-renders the whole grid, so the row the reader was working in
  // gets its caret back rather than the page losing focus to the body.
  function restoreEditFocus() {
    if (!state.focusEntry) return;
    var input = els.viewRoot.querySelector('[data-amount-entry="' + state.focusEntry + '"]');
    state.focusEntry = null;
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

  function isMobileViewport() {
    return window.matchMedia("(max-width: 899px)").matches;
  }

  function renderTopbarTitle() {
    if (!state.loaded) {
      els.topbarTitle.textContent = "DIYA-GL — Basic Sole Trader books";
      return;
    }
    var name = SNAPSHOT.businessDetails.organizationIdentifier;
    var viewMeta = VIEWS.filter(function (v) {
      return v.id === state.view;
    })[0];
    els.topbarTitle.textContent = name + (viewMeta ? " — " + viewMeta.label : "");
  }

  function renderSheetTabs() {
    if (!state.loaded) {
      els.sheetTabs.innerHTML = "";
      els.sheetTabs.classList.add("hidden");
      return;
    }
    els.sheetTabs.classList.remove("hidden");
    els.sheetTabs.innerHTML = VIEWS.map(function (v) {
      return (
        '<button type="button" class="tab-btn" role="tab" data-view="' +
        v.id +
        '" aria-selected="' +
        (v.id === state.view ? "true" : "false") +
        '">' +
        esc(v.label) +
        "</button>"
      );
    }).join("");
    Array.prototype.forEach.call(els.sheetTabs.querySelectorAll(".tab-btn"), function (btn) {
      btn.addEventListener("click", function () {
        state.view = btn.getAttribute("data-view");
        state.mobileTab = "books";
        render();
      });
    });
  }

  function renderMobileTabbar() {
    var tabs = [
      { id: "books", label: "Books" },
      { id: "charts", label: "Charts" },
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
    switch (view) {
      case "home":
        return renderHome();
      case "year":
        return renderYear();
      case "profit-loss":
        return renderProfitLoss();
      case "stock":
        return renderStock();
      case "debtors-creditors":
        return renderDebtorsCreditors();
      case "fixed-assets":
        return renderFixedAssets();
      case "income-tax":
        return renderIncomeTaxForm();
      case "sa103s":
        return renderSa103sForm();
      case "business-details":
        return renderBusinessDetails();
      case "admin":
        return renderAdmin();
      case "charts":
        return '<h2>Charts</h2><p class="view-lede">Drawn from the calculated book, never the as-read layer.</p>' + renderChartsBlock();
      default:
        return renderHome();
    }
  }

  function bindViewInteractions(view) {
    if (view === "year") {
      bindYearView();
    }
    if (view === "home") {
      Array.prototype.forEach.call(els.viewRoot.querySelectorAll("[data-goto]"), function (a) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          state.view = a.getAttribute("data-goto");
          render();
        });
      });
    }
  }

  // ============================== empty state ==============================

  function renderEmptyState() {
    return (
      '<div class="empty-state">' +
      "<h2>View your books in DIYA-GL</h2>" +
      "<p>Open a Basic Sole Trader workbook as editable books in your browser. Nothing is uploaded; the file never leaves your machine.</p>" +
      (state.savedBook ? renderContinueOffer() : "") +
      '<div class="empty-state-actions">' +
      '<div class="picker-row">' +
      '<label class="file-picker-label" for="file-picker">' +
      '<span aria-hidden="true">📁</span> Choose a .xlsx or .zip file' +
      "</label>" +
      '<input type="file" id="file-picker" accept=".xlsx,.zip" class="hidden" />' +
      '<button type="button" class="btn" id="new-book-btn" aria-expanded="' +
      (state.newBookFormOpen ? "true" : "false") +
      '">Start a new book</button>' +
      "</div>" +
      (state.newBookFormOpen ? renderNewBookForm() : "") +
      '<div class="example-list">' +
      '<span class="caps-label">Or load an example</span>' +
      '<button type="button" class="btn" data-example="bst-scenario-basic">bst-scenario-basic — Precision Code Trading, full ledger</button>' +
      '<button type="button" class="btn" data-example="bst-brickwork-pro-nonvat">bst-brickwork-pro-nonvat — BrickWork trade</button>' +
      '<button type="button" class="btn" data-example="bst-sp-sixty">bst-sp-sixty — no-ledger, mileage route</button>' +
      "</div>" +
      "</div>" +
      '<p id="empty-state-message" class="view-lede" aria-live="polite"></p>' +
      "</div>"
    );
  }

  // "Start a new book": a short form -- business name, year end -- that
  // builds an empty but valid book (documentInfo/entityInformation
  // populated, the standard chart attached, no lines, no as-read layer) and
  // loads it into the same state path an upload or example uses.
  function renderNewBookForm() {
    return (
      '<form id="new-book-form" class="new-book-form" novalidate>' +
      '<div class="editable-field">' +
      '<label for="new-book-name">Business name</label>' +
      '<input type="text" id="new-book-name" name="businessName" autocomplete="off" />' +
      "</div>" +
      '<div class="editable-field">' +
      '<label for="new-book-year-end">Year end</label>' +
      '<input type="date" id="new-book-year-end" name="yearEnd" />' +
      "</div>" +
      '<p id="new-book-error" class="upload-error hidden" role="alert"></p>' +
      '<div class="new-book-form-actions">' +
      '<button type="submit" class="btn btn-primary">Create book</button>' +
      '<button type="button" class="btn" id="new-book-cancel">Cancel</button>' +
      "</div>" +
      "</form>"
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

  function bindEmptyState() {
    var picker = document.getElementById("file-picker");
    picker.addEventListener("change", function () {
      var file = picker.files && picker.files[0];
      if (!file) return;
      if (/\.xls$/i.test(file.name)) {
        showEmptyStateMessage("That's the older .xls format. Open it in Excel or LibreOffice, save as .xlsx, and try again.", false);
        picker.value = "";
        return;
      }
      loadFromFile(file);
    });

    document.getElementById("new-book-btn").addEventListener("click", function () {
      state.newBookFormOpen = !state.newBookFormOpen;
      render();
      var nameInput = document.getElementById("new-book-name");
      if (nameInput) nameInput.focus();
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

  function handleCreateNewBook() {
    var nameInput = document.getElementById("new-book-name");
    var yearEndInput = document.getElementById("new-book-year-end");
    var errorEl = document.getElementById("new-book-error");
    var businessName = nameInput.value.trim();
    var yearEndISO = parseRealDate(yearEndInput.value);

    var errors = [];
    if (!businessName) errors.push("Enter a business name.");
    if (!yearEndISO) errors.push("Enter a real year-end date.");

    if (errors.length > 0) {
      errorEl.textContent = errors.join(" ");
      errorEl.classList.remove("hidden");
      return;
    }
    errorEl.classList.add("hidden");
    errorEl.textContent = "";

    setPickerBusy(true);
    showEmptyStateMessage("Creating a new book for " + businessName + "…", false);
    window.DiyaGlBooksLoader.createNewBook(businessName, yearEndISO)
      .then(function (snapshot) {
        state.newBookFormOpen = false;
        applyLoadedSnapshot(snapshot);
        showToast("Started a new book for " + businessName + ".");
      })
      .catch(function (error) {
        setPickerBusy(false);
        showEmptyStateMessage(error && error.message ? error.message : String(error), true);
      });
  }

  function handleContinueSavedBook() {
    var saved = state.savedBook;
    if (!saved) return;
    var label = (saved.source && saved.source.label) || "your working book";
    setPickerBusy(true);
    showEmptyStateMessage("Continuing " + label + "…", false);
    window.DiyaGlBooksLoader.loadFromBookAndLines(saved.book, saved.lines, label, saved.source && saved.source.kind)
      .then(function (snapshot) {
        applyLoadedSnapshot(snapshot);
        showToast("Continued where you left off.");
      })
      .catch(function (error) {
        setPickerBusy(false);
        showEmptyStateMessage(error && error.message ? error.message : String(error), true);
      });
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

  function loadExample(exampleKey) {
    setPickerBusy(true);
    showEmptyStateMessage("Loading " + exampleKey + "…", false);
    window.DiyaGlBooksLoader.loadExample(exampleKey)
      .then(function (snapshot) {
        applyLoadedSnapshot(snapshot);
        showToast("Loaded " + snapshot.scenario + ".");
      })
      .catch(function (error) {
        setPickerBusy(false);
        showEmptyStateMessage(error && error.message ? error.message : String(error), true);
      });
  }

  function loadFromFile(file) {
    setPickerBusy(true);
    showEmptyStateMessage("Reading " + file.name + "…", false);
    window.DiyaGlBooksLoader.loadFromFile(file)
      .then(function (snapshot) {
        applyLoadedSnapshot(snapshot);
        showToast("Loaded " + file.name + ".");
      })
      .catch(function (error) {
        setPickerBusy(false);
        showEmptyStateMessage(error && error.message ? error.message : String(error), true);
      });
  }

  function applySnapshot(snapshot) {
    SNAPSHOT = snapshot;
    window.DIYA_BST_SNAPSHOT = snapshot;
    state.book = snapshot.book;
    state.lines = snapshot.lines;
    state.context = snapshot.context;
    state.bookChecks = window.DiyaGlBooksEdits.bookChecks(snapshot);
    autosaveCurrentBook();
  }

  function applyLoadedSnapshot(snapshot) {
    applySnapshot(snapshot);
    state.loaded = true;
    state.view = "year";
    state.openMonth = snapshot.months[0].key;
    state.openHelper = null;
    state.addDraft = {};
    window.DiyaGlBooksEdits.undo.clear();
    setPickerBusy(false);
    render();
  }

  // Called at the one place state.book/state.lines change: applySnapshot,
  // which every book load and every committed edit goes through. Silent by
  // design: a blocked or missing store degrades to no-autosave
  // (autosave.js's own contract) and the page carries on exactly as if
  // autosave were never called.
  function autosaveCurrentBook() {
    if (!state.book || !state.lines) return;
    window.DiyaBooksAutosave.saveWorkingBook({
      book: state.book,
      lines: state.lines,
      source: SNAPSHOT.source || { kind: "unknown", label: SNAPSHOT.scenario },
      savedAt: new Date().toISOString(),
    });
  }

  // ============================== the edit path ==============================
  // One route for every change: the state being replaced goes on the undo
  // stack, the edit function returns the new lines, the whole book is
  // recomputed from them (calculator and checks both), and the page
  // re-renders. A helper's whole plan is one call, so it is one undo step.

  function commit(edit, undoLabel, toastMessage) {
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
        if (toastMessage) showToast(toastMessage);
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

  function undoLastEdit() {
    var previous = window.DiyaGlBooksEdits.undo.pop();
    if (!previous) {
      showToast("Nothing to undo.");
      return;
    }
    state.committing = true;
    window.DiyaGlBooksLoader.recalculate(previous.book, previous.lines, state.context, window.DiyaGlBooksEdits.undo.depth() > 0)
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

  // ============================== home ==============================

  function renderHome() {
    var bd = SNAPSHOT.businessDetails;
    return (
      "<h2>" +
      esc(bd.organizationIdentifier) +
      "</h2>" +
      '<p class="view-lede">' +
      esc(bd.periodCoveredStart) +
      " to " +
      esc(bd.periodCoveredEnd) +
      " — every sheet the reconciliation touches has a view here, the way the workbook's own Home sheet links to each tab.</p>" +
      '<ul class="home-nav-list">' +
      VIEWS.map(function (v) {
        return (
          '<li><a href="#" data-goto="' +
          v.id +
          '"><span class="nav-item-label">' +
          esc(v.label) +
          '</span><span class="nav-item-sheets">' +
          esc(v.sheets) +
          "</span></a></li>"
        );
      }).join("") +
      '<li><a href="#" data-goto="charts"><span class="nav-item-label">Charts</span><span class="nav-item-sheets">Expense mix, monthly trend</span></a></li>' +
      "</ul>"
    );
  }

  // ============================== year table + drill ==============================

  // The Year total row's 17 categories are the Profit & Loss Account
  // section's own annual cells (CELL_MAP, app/products/bst.js); order
  // tracks bst-data.js's CATEGORIES array, which mirrors CELL_MAP already.
  var PL_ANNUAL_CELL = {
    sales: "C4",
    costOfSales: "C6",
    directCosts: "C7",
    grossProfit: "C9",
    employeeCosts: "C11",
    premisesCosts: "C12",
    repairs: "C13",
    generalAdmin: "C14",
    motorExpenses: "C15",
    travel: "C16",
    advertising: "C17",
    legalProfessional: "C18",
    badDebts: "C19",
    interestFinance: "C20",
    otherExpenses: "C21",
    totalExpenses: "C22",
    netProfit: "C24",
  };
  var PL_ANNUAL_ROW_SLUG = {
    sales: "sales-turnover",
    costOfSales: "cost-of-sales-stock-direct",
    directCosts: "direct-costs",
    grossProfit: "gross-profit",
    employeeCosts: "employee-costs",
    premisesCosts: "premises-costs",
    repairs: "repairs-maintenance",
    generalAdmin: "general-admin",
    motorExpenses: "motor-expenses",
    travel: "travel-subsistence",
    advertising: "advertising",
    legalProfessional: "legal-professional",
    badDebts: "bad-debts",
    interestFinance: "interest-finance",
    otherExpenses: "other-expenses",
    totalExpenses: "total-expenses",
    netProfit: "net-profit",
  };
  function plAnnualRk(categoryKey) {
    var cell = PL_ANNUAL_CELL[categoryKey];
    return cell ? rk2("Profit & Loss Acc", cell, "profit-loss-account", PL_ANNUAL_ROW_SLUG[categoryKey]) : "";
  }

  // Of the 17 categories, only Sales has a per-month cell CELL_MAP names
  // (the "Monthly Sales" section, Profit & Loss Acc!D4:O4) -- the rest are
  // this page's own aggregation over the month's lines, with no single
  // workbook cell behind them.
  var MONTH_SALES_CELL = {
    Apr: "D4",
    May: "E4",
    Jun: "F4",
    Jul: "G4",
    Aug: "H4",
    Sep: "I4",
    Oct: "J4",
    Nov: "K4",
    Dec: "L4",
    Jan: "M4",
    Feb: "N4",
    Mar: "O4",
  };
  function monthlySalesRk(monthLabel) {
    var cell = MONTH_SALES_CELL[monthLabel];
    return cell ? rk2("Profit & Loss Acc", cell, "monthly-sales", monthLabel.toLowerCase()) : "";
  }

  function renderYear() {
    return (
      "<h2>Year</h2>" +
      '<p class="view-lede">Twelve month rows, the P&amp;L category columns, totals anchored. Open a month for its summary, open again for its entries.</p>' +
      renderYearSummarySticky() +
      renderYearTableScroll() +
      renderMonthCards()
    );
  }

  function renderYearSummarySticky() {
    var a = SNAPSHOT.annual;
    return (
      '<div class="year-summary-sticky" id="year-summary-sticky">' +
      '<div class="ys-row"><span>Sales Turnover</span><span class="ys-value">' +
      fmtMoney(a.sales) +
      '</span></div><div class="ys-row"><span>Net Profit</span><span class="ys-value">' +
      fmtMoney(a.netProfit) +
      "</span></div></div>"
    );
  }

  function renderYearTableScroll() {
    var cats = SNAPSHOT.categories;
    var head =
      "<tr><th>Month</th>" +
      cats
        .map(function (c) {
          return '<th class="' + (c.computed ? "col-computed" : "") + '">' + esc(c.label) + "</th>";
        })
        .join("") +
      "</tr>";

    var rows = SNAPSHOT.months
      .map(function (m) {
        var row = SNAPSHOT.monthly[m.key];
        var isOpen = state.openMonth === m.key;
        var cells = cats
          .map(function (c) {
            var attr = c.key === "sales" ? monthlySalesRk(m.label) : "";
            return '<td class="' + (c.computed ? "col-computed" : "") + '"' + attr + ">" + fmtMoney(row[c.key]) + "</td>";
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
        var detailRow = isOpen
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
          return '<td class="' + (c.computed ? "col-computed" : "") + '"' + plAnnualRk(c.key) + ">" + fmtMoney(a[c.key]) + "</td>";
        })
        .join("") +
      "</tr>";

    return (
      '<div class="year-table-scroll"><table class="year-table"><thead>' +
      head +
      "</thead><tbody>" +
      rows +
      '</tbody><tfoot class="year-totals">' +
      totals +
      "</tfoot></table></div>"
    );
  }

  function renderMonthDetail(monthKey) {
    var row = SNAPSHOT.monthly[monthKey];
    var monthMeta = SNAPSHOT.months.filter(function (m) {
      return m.key === monthKey;
    })[0];
    var summary =
      '<div class="month-summary-grid">' +
      [
        ["Sales Turnover", row.sales, monthlySalesRk(monthMeta.label)],
        ["Gross Profit", row.grossProfit, ""],
        ["Total Expenses", row.totalExpenses, ""],
        ["Net Profit", row.netProfit, ""],
      ]
        .map(function (pair) {
          return (
            '<div class="month-summary-item"><span class="caps-label">' +
            pair[0] +
            '</span><span class="value"' +
            pair[2] +
            ">" +
            fmtMoney(pair[1]) +
            "</span></div>"
          );
        })
        .join("") +
      "</div>";

    var entries = SNAPSHOT.entries[monthKey];
    var entriesHtml = "";
    if (entries) {
      entriesHtml =
        '<button type="button" class="btn entries-toggle" id="entries-toggle" aria-expanded="' +
        (state.entriesOpen ? "true" : "false") +
        '">' +
        (state.entriesOpen ? "Hide entries" : "Show entries — " + (entries.sales.length + entries.purchases.length) + " lines") +
        "</button>" +
        (state.entriesOpen ? renderEntriesTables(entries, monthKey) : "");
    } else {
      entriesHtml = '<p class="entries-note">' + esc(monthMeta.label) + " carries no entries in this book.</p>";
    }

    return '<div class="month-detail">' + summary + entriesHtml + "</div>";
  }

  // The entries grid: the month's own posted lines, editable in place. An
  // amount commits through changeLineAmount, the row's delete through
  // removeLine, and the row under the rule adds one through
  // addSaleLine/addPurchaseLine. Every commit recomputes the whole book.
  function renderEntriesTables(entries, monthKey) {
    function table(caption, journal, rows) {
      return (
        '<table class="entries-table" data-journal="' +
        journal +
        '"><caption>' +
        caption +
        "</caption><thead><tr><th>Date</th><th>Acct</th><th>Detail</th><th>Amount</th>" +
        '<th><span class="sr-only">Remove</span></th></tr></thead><tbody>' +
        rows.map(entryRow).join("") +
        "</tbody><tfoot>" +
        addEntryRow(journal, monthKey) +
        "</tfoot></table>"
      );
    }
    return (
      '<div class="entries-columns">' +
      table("Sales", "sales", entries.sales) +
      table("Purchases", "purchases", entries.purchases) +
      "</div>" +
      '<p class="entries-note">Change an amount or remove a line and the whole book recalculates. Ctrl+Z (⌘Z) undoes the last change.</p>'
    );
  }

  function entryRow(r) {
    return (
      '<tr class="entry-row' +
      (r.posted ? "" : " is-unposted") +
      '" data-entry="' +
      esc(r.entryNumber) +
      '"><td>' +
      r.date.slice(5) +
      "</td><td>" +
      esc(r.account) +
      (r.posted
        ? ""
        : ' <span class="entry-flag" title="This account is outside the book\'s chart, so the amount reaches no total">no account</span>') +
      '</td><td><input class="entry-cell-editable" value="' +
      esc(r.detail ? r.label + " — " + r.detail : r.label) +
      '" readonly aria-label="Detail" /></td>' +
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
    var draft = state.addDraft[journal] || {};
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
      journal +
      '"><td colspan="5"><div class="entry-add-form">' +
      '<input type="date" class="entry-add-date" data-add-field="date" value="' +
      esc(draft.date || monthKey + "-01") +
      '" aria-label="Date for the new ' +
      journal +
      ' entry" />' +
      '<select class="entry-add-account" data-add-field="account" aria-label="Account for the new ' +
      journal +
      ' entry">' +
      options +
      "</select>" +
      '<input class="entry-add-detail" data-add-field="detail" placeholder="Detail" value="' +
      esc(draft.detail || "") +
      '" aria-label="Detail for the new ' +
      journal +
      ' entry" />' +
      '<input class="entry-add-amount" data-add-field="amount" inputmode="decimal" placeholder="0.00" value="' +
      esc(draft.amount || "") +
      '" aria-label="Amount for the new ' +
      journal +
      ' entry" />' +
      '<button type="button" class="entry-add-btn" data-add-entry="' +
      journal +
      '" title="Add this ' +
      journal +
      ' entry">Add</button>' +
      "</div></td></tr>"
    );
  }

  function renderMonthCards() {
    return (
      '<div class="month-cards">' +
      SNAPSHOT.months
        .map(function (m) {
          var row = SNAPSHOT.monthly[m.key];
          return (
            '<div class="month-card" data-month-card="' +
            m.key +
            '">' +
            '<div class="month-card-head" role="button" tabindex="0"><span class="month-name">' +
            esc(m.label) +
            '</span><span class="mono">' +
            fmtMoney(row.netProfit) +
            "</span></div>" +
            '<div class="month-card-figures">' +
            '<span class="figure-label">Sales</span><span class="figure-value"' +
            monthlySalesRk(m.label) +
            ">" +
            fmtMoney(row.sales) +
            "</span>" +
            '<span class="figure-label">Total expenses</span><span class="figure-value">' +
            fmtMoney(row.totalExpenses) +
            "</span>" +
            "</div></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function bindYearView() {
    Array.prototype.forEach.call(els.viewRoot.querySelectorAll(".year-row"), function (tr) {
      function toggle() {
        var key = tr.getAttribute("data-month");
        if (state.openMonth === key) {
          state.openMonth = null;
        } else {
          state.openMonth = key;
          state.entriesOpen = false;
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
        state.entriesOpen = !state.entriesOpen;
        render();
      });
    }
    Array.prototype.forEach.call(els.viewRoot.querySelectorAll(".month-card-head"), function (head) {
      function toggle() {
        var key = head.closest(".month-card").getAttribute("data-month-card");
        state.openMonth = key;
        state.view = "year";
        render();
      }
      head.addEventListener("click", toggle);
      head.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });
    bindEntriesGrid();
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
        commit(
          function () {
            return window.DiyaGlBooksEdits.changeAmount(state.book, state.lines, entryNumber, amount);
          },
          "change " + entryNumber + " to " + fmtMoney(amount),
          "Changed " + entryNumber + " to " + fmtMoney(amount) + ".",
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
        );
      });
    });

    Array.prototype.forEach.call(els.viewRoot.querySelectorAll(".entry-add-row"), function (row) {
      var journal = row.getAttribute("data-add-journal");
      function fieldValue(name) {
        var field = row.querySelector('[data-add-field="' + name + '"]');
        return field ? field.value : "";
      }
      Array.prototype.forEach.call(row.querySelectorAll("[data-add-field]"), function (field) {
        field.addEventListener("input", function () {
          state.addDraft[journal] = {
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
        state.addDraft[journal] = null;
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

  // ============================== P&L statement ==============================

  function renderProfitLoss() {
    var a = SNAPSHOT.annual;
    var motorDrift = SNAPSHOT.drift.filter(function (d) {
      return d.id === "Profit & Loss Acc!C15";
    })[0];
    function row(label, value, opts) {
      opts = opts || {};
      var valueAttr = opts.drift ? "" : opts.rKeyAttr || "";
      return (
        '<tr class="' +
        (opts.total ? "total" : "") +
        '"><td>' +
        esc(label) +
        "</td><td" +
        valueAttr +
        ">" +
        (opts.drift ? correctionFor(opts.drift, { rKeyAttr: opts.rKeyAttr }) : fmtMoney(value)) +
        "</td></tr>"
      );
    }
    return (
      "<h2>Profit &amp; Loss Account</h2>" +
      '<p class="view-lede">The year totals row from the Year view, rendered as the statement the P&amp;L sheet prints.</p>' +
      '<table class="kv-table">' +
      row("Sales Turnover", a.sales, { rKeyAttr: plAnnualRk("sales") }) +
      row("Cost of Sales", a.costOfSales, { rKeyAttr: plAnnualRk("costOfSales") }) +
      row("Direct Costs", a.directCosts, { rKeyAttr: plAnnualRk("directCosts") }) +
      row("Gross Profit", a.grossProfit, { total: true, rKeyAttr: plAnnualRk("grossProfit") }) +
      row("Employee Costs", a.employeeCosts, { rKeyAttr: plAnnualRk("employeeCosts") }) +
      row("Premises Costs", a.premisesCosts, { rKeyAttr: plAnnualRk("premisesCosts") }) +
      row("Repairs & Maintenance", a.repairs, { rKeyAttr: plAnnualRk("repairs") }) +
      row("General Admin", a.generalAdmin, { rKeyAttr: plAnnualRk("generalAdmin") }) +
      row("Motor Expenses", a.motorExpenses, { drift: motorDrift, rKeyAttr: plAnnualRk("motorExpenses") }) +
      row("Travel & Subsistence", a.travel, { rKeyAttr: plAnnualRk("travel") }) +
      row("Advertising", a.advertising, { rKeyAttr: plAnnualRk("advertising") }) +
      row("Legal & Professional", a.legalProfessional, { rKeyAttr: plAnnualRk("legalProfessional") }) +
      row("Bad Debts", a.badDebts, { rKeyAttr: plAnnualRk("badDebts") }) +
      row("Interest & Finance", a.interestFinance, { rKeyAttr: plAnnualRk("interestFinance") }) +
      row("Other Expenses", a.otherExpenses, { rKeyAttr: plAnnualRk("otherExpenses") }) +
      row("Total Expenses", a.totalExpenses, { total: true, rKeyAttr: plAnnualRk("totalExpenses") }) +
      row("Net Profit", a.netProfit, { total: true, rKeyAttr: plAnnualRk("netProfit") }) +
      // Shown here under the P&L sheet's own "Capital Allowances" and
      // "Taxable Profit" labels, but the figures come from the Fixed
      // Assets schedule's AIA total and the Income Tax sheet's own profit
      // line -- the same cells renderFixedAssets and renderIncomeTaxForm
      // show, not this sheet's own C26/C28 (see render-unrepresentable.json).
      row("Capital Allowances", SNAPSHOT.fixedAssets.aia, {
        rKeyAttr: rk2("Fixed Assets", "K1", "fixed-assets", "total-first-year-allowance-aia"),
      }) +
      row("Taxable Profit", SNAPSHOT.incomeTax.profitFromSelfEmployment, {
        total: true,
        rKeyAttr: rk2("Income Tax", "E5", "income-tax-calculation", "profit-from-self-employment"),
      }) +
      "</table>"
    );
  }

  // ============================== stock / debtors / fixed assets / business / admin ==============================

  function renderStock() {
    var s = SNAPSHOT.stock;
    return (
      "<h2>Stock</h2>" +
      '<p class="view-lede">PurchasesStock: opening/closing values and the cost-of-sales movement.</p>' +
      '<div class="panel-card"><table class="kv-table">' +
      "<tr><td>Opening Stock</td><td" +
      rk2("PurchasesStock", "D5", "stock", "opening-stock") +
      ">" +
      fmtMoney(s.opening) +
      "</td></tr>" +
      "<tr><td>Closing Stock</td><td" +
      rk2("PurchasesStock", "D30", "stock", "closing-stock") +
      ">" +
      fmtMoney(s.closing) +
      "</td></tr>" +
      '<tr class="total"><td>Stock movement (cost of sales adjustment)</td><td>' +
      fmtMoney(s.opening - s.closing) +
      "</td></tr>" +
      "</table></div>"
    );
  }

  // The two sides' cell references (Debtors & Creditors, CELL_MAP): opening
  // at row 3, twelve monthly rows two apart from row 5, the total at row
  // 29. Column C is debtors, column F creditors.
  var LEDGER_R_KEYS = {
    debtors: {
      openingCell: "C3",
      openingSlug: "owed-by-customers-at-start-of-year",
      monthlyCells: ["C5", "C7", "C9", "C11", "C13", "C15", "C17", "C19", "C21", "C23", "C25", "C27"],
      monthlySlugSuffix: "-sales-not-yet-received",
      totalCell: "C29",
      totalSlug: "amount-owed-by-customers",
    },
    creditors: {
      openingCell: "F3",
      openingSlug: "owed-to-suppliers-at-start-of-year",
      monthlyCells: ["F5", "F7", "F9", "F11", "F13", "F15", "F17", "F19", "F21", "F23", "F25", "F27"],
      monthlySlugSuffix: "-purchases-still-to-be-paid",
      totalCell: "F29",
      totalSlug: "amount-owed-to-suppliers",
    },
  };

  function renderDebtorsCreditors() {
    function ledger(title, side, sideKey) {
      var keys = LEDGER_R_KEYS[sideKey];
      var total = side.monthly.reduce(function (sum, amount) {
        return sum + amount;
      }, side.opening);
      return (
        '<div class="panel-card"><h3>' +
        title +
        '</h3><table class="kv-table">' +
        "<tr><td>" +
        esc(side.openingLabel) +
        "</td><td" +
        rk2("Debtors & Creditors", keys.openingCell, "debtors-creditors", keys.openingSlug) +
        ">" +
        fmtMoney(side.opening) +
        "</td></tr>" +
        side.monthly
          .map(function (amount, index) {
            var rowSlug = SNAPSHOT.months[index].label.toLowerCase() + keys.monthlySlugSuffix;
            return (
              "<tr><td>" +
              esc(SNAPSHOT.months[index].label) +
              "</td><td" +
              rk2("Debtors & Creditors", keys.monthlyCells[index], "debtors-creditors", rowSlug) +
              ">" +
              fmtMoney(amount) +
              "</td></tr>"
            );
          })
          .join("") +
        '<tr class="total"><td>' +
        esc(side.totalLabel) +
        "</td><td" +
        rk2("Debtors & Creditors", keys.totalCell, "debtors-creditors", keys.totalSlug) +
        ">" +
        fmtMoney(total) +
        "</td></tr></table>" +
        '<p class="caps-label">' +
        esc(side.monthlyLabel) +
        ", month by month</p></div>"
      );
    }
    return (
      "<h2>Debtors &amp; Creditors</h2>" +
      '<p class="view-lede">What was owed when the year opened, and what each month left outstanding. ' +
      "A sale counts while no receipt is recorded beside it, a purchase while no payment is. " +
      "This sheet names no customer or supplier.</p>" +
      '<div class="panel-grid">' +
      ledger("Debtors", SNAPSHOT.debtors, "debtors") +
      ledger("Creditors", SNAPSHOT.creditors, "creditors") +
      "</div>"
    );
  }

  function renderFixedAssets() {
    var f = SNAPSHOT.fixedAssets;
    return (
      "<h2>Fixed Assets</h2>" +
      '<p class="view-lede">Additions, the register, and the capital allowances the schedule carries.</p>' +
      '<div class="panel-grid">' +
      '<div class="panel-card"><h3>Additions</h3><table class="kv-table">' +
      f.additions
        .map(function (a) {
          return "<tr><td>" + esc(a.description) + "</td><td>" + fmtMoney(a.cost) + "</td></tr>";
        })
        .join("") +
      '<tr class="total"><td>Total Original Cost</td><td' +
      rk2("Fixed Assets", "E1", "fixed-assets", "total-original-cost") +
      ">" +
      fmtMoney(f.totalCost) +
      "</td></tr></table></div>" +
      '<div class="panel-card"><h3>Capital allowances</h3><table class="kv-table">' +
      "<tr><td>Annual Investment Allowance</td><td" +
      rk2("Fixed Assets", "K1", "fixed-assets", "total-first-year-allowance-aia") +
      ">" +
      fmtMoney(f.aia) +
      "</td></tr>" +
      "<tr><td>Writing Down Allowance</td><td" +
      rk2("Fixed Assets", "L1", "fixed-assets", "total-writing-down-allowance") +
      ">" +
      fmtMoney(f.wda) +
      "</td></tr>" +
      "<tr><td>Written Down Tax Value</td><td" +
      rk2("Fixed Assets", "M1", "fixed-assets", "total-written-down-tax-value") +
      ">" +
      fmtMoney(f.writtenDownValue) +
      "</td></tr>" +
      "<tr><td>Disposals</td><td" +
      rk2("Fixed Assets", "Q1", "fixed-assets", "total-capital-allowance-on-disposal") +
      ">" +
      fmtMoney(f.disposals) +
      "</td></tr>" +
      "<tr><td>Balancing Charge</td><td" +
      rk2("Fixed Assets", "R1", "fixed-assets", "total-balancing-charge") +
      ">" +
      fmtMoney(f.balancingCharge) +
      "</td></tr></table></div>" +
      "</div>"
    );
  }

  function renderBusinessDetails() {
    var bd = SNAPSHOT.businessDetails;
    return (
      "<h2>Business Details</h2>" +
      '<p class="view-lede">entityInformation, as the book declares it.</p>' +
      '<div class="panel-card">' +
      field("Business Name", bd.organizationIdentifier, rk2("Business Details", "C5", "business-details", "business-name")) +
      field("Description", bd.organizationDescription, rk2("Business Details", "C7", "business-details", "description")) +
      field("Address", bd.organizationAddressLine, rk2("Business Details", "C8", "business-details", "address")) +
      field("Town", bd.organizationTown, rk2("Business Details", "C10", "business-details", "town")) +
      field("Postcode", bd.organizationPostcode, rk2("Business Details", "C12", "business-details", "postcode")) +
      field("Accounting period", bd.periodCoveredStart + " to " + bd.periodCoveredEnd) +
      field("Basis of accounting", bd.basisOfAccounting) +
      field("VAT registered", bd.vatRegistered ? "Yes" : "No") +
      "</div>"
    );
    function field(label, value, rKeyAttr) {
      return (
        '<div class="editable-field"><label>' +
        esc(label) +
        "</label><input" +
        (rKeyAttr || "") +
        ' value="' +
        esc(value) +
        '" readonly /></div>'
      );
    }
  }

  // buildAdmin() in bst-data.js reads app/data/<year>.toml straight into
  // this array; order tracks it row for row, and each row is the same
  // figure the Admin sheet's own generator-injected cell carries
  // (CELL_MAP, app/products/bst.js).
  var ADMIN_RATE_R_KEYS = [
    ["Admin", "N4", "personal-allowance"],
    ["Admin", "N5", "personal-allowance-taper-threshold"],
    ["Admin", "N7", "basic-rate"],
    ["Admin", "N8", "higher-rate"],
    ["Admin", "N9", "additional-rate"],
    ["Admin", "M12", "basic-band-end"],
    ["Admin", "N13", "higher-band-start"],
    ["Admin", "N14", "higher-band-end"],
    ["Admin", "L17", "ni-class-2-rate"],
    ["Admin", "L20", "ni-class-4-lower-rate"],
    ["Admin", "N20", "ni-class-4-lower-limit"],
    ["Admin", "L23", "ni-class-4-upper-rate"],
    ["Admin", "N23", "ni-class-4-upper-limit"],
    ["Admin", "G4", "annual-investment-allowance-rate"],
    ["Admin", "G5", "writing-down-allowance-rate"],
    ["Admin", "F21", "mileage-higher-rate-limit"],
    ["Admin", "G21", "mileage-higher-rate-pence"],
    ["Admin", "F22", "mileage-lower-rate-start"],
    ["Admin", "G22", "mileage-lower-rate-pence"],
    ["Admin", "F26", "vat-registration-threshold"],
  ];

  function renderAdmin() {
    var a = SNAPSHOT.admin;
    return (
      "<h2>Admin</h2>" +
      '<p class="view-lede rate-provenance">The year’s tax data, read-only, sourced from ' +
      esc(a.source) +
      " (" +
      esc(a.year) +
      ").</p>" +
      '<div class="panel-card"><table class="kv-table">' +
      a.rates
        .map(function (r, i) {
          var val =
            r.format === "rate"
              ? fmtRate(r.value)
              : r.format === "pence"
                ? fmtPence(r.value)
                : r.format === "number"
                  ? r.value.toLocaleString("en-GB")
                  : fmtMoney(r.value);
          var k = ADMIN_RATE_R_KEYS[i];
          var attr = k ? rk2(k[0], k[1], "admin-generator-injected", k[2]) : "";
          return "<tr><td>" + esc(r.label) + "</td><td" + attr + ">" + val + "</td></tr>";
        })
        .join("") +
      "</table></div>"
    );
  }

  // ============================== tax-form renders ==============================

  // t.bands (buildIncomeTax, bst-data.js) is always [Basic, Higher,
  // Additional] -- the rate and band-ceiling cells CELL_MAP names for each,
  // the Additional band carrying no ceiling of its own.
  var INCOME_TAX_BAND_R_KEYS = [
    { rateCell: "D8", rateSlug: "basic-rate-the-sheet-applies", ceilingCell: "C9", ceilingSlug: "basic-band-ceiling-the-sheet-applies" },
    {
      rateCell: "D9",
      rateSlug: "higher-rate-the-sheet-applies",
      ceilingCell: "C10",
      ceilingSlug: "additional-rate-threshold-the-sheet-applies",
    },
    { rateCell: "D10", rateSlug: "additional-rate-the-sheet-applies", ceilingCell: null, ceilingSlug: null },
  ];
  var INCOME_TAX_BAND_TAX_ROW_SLUG = { E8: "tax-at-basic-rate", E9: "tax-at-higher-rate", E10: "tax-at-additional-rate" };

  function renderIncomeTaxForm() {
    var t = SNAPSHOT.incomeTax;
    var itDrift = SNAPSHOT.drift.filter(function (d) {
      return d.id === "Income Tax!E11";
    })[0];
    var totalDrift = SNAPSHOT.drift.filter(function (d) {
      return d.id === "Income Tax!E18";
    })[0];
    return (
      '<div class="form-render">' +
      '<div class="form-masthead"><div class="form-name">Income Tax computation</div>' +
      '<div class="form-microcopy">Check these against your return.</div></div>' +
      '<div class="form-section"><h3>Profit</h3>' +
      formRow(
        "Profit from self employment",
        fmtBoxWhole(t.profitFromSelfEmployment),
        rk2("Income Tax", "E5", "income-tax-calculation", "profit-from-self-employment"),
      ) +
      formRow(
        "Less: Personal Allowance",
        fmtBoxWhole(t.personalAllowance),
        rk2("Income Tax", "E6", "income-tax-calculation", "less-personal-allowance"),
      ) +
      formRow("Taxable income", fmtBoxWhole(t.taxableIncome), rk2("Income Tax", "E7", "income-tax-calculation", "taxable-income")) +
      "</div>" +
      '<div class="form-section"><h3>Tax bands</h3>' +
      t.bands
        .map(function (b, i) {
          var cfg = INCOME_TAX_BAND_R_KEYS[i];
          var ceilingHtml = b.ceiling
            ? " to <span" +
              rk2("Income Tax", cfg.ceilingCell, "income-tax-calculation", cfg.ceilingSlug) +
              ">" +
              fmtWhole(b.ceiling) +
              "</span>"
            : "";
          return (
            '<div class="form-row"><span class="form-row-label">' +
            esc(b.label) +
            ceilingHtml +
            '<span class="form-rate-pencil"' +
            rk2("Income Tax", cfg.rateCell, "income-tax-calculation", cfg.rateSlug) +
            ">" +
            fmtRate(b.rate) +
            '</span></span><span class="form-amount-wrap"><span class="box-chip">' +
            esc(b.box) +
            '</span></span><span class="form-amount-box"' +
            rk2("Income Tax", b.box, "income-tax-calculation", INCOME_TAX_BAND_TAX_ROW_SLUG[b.box]) +
            ">" +
            fmtBoxMoney(b.tax) +
            "</span></div>"
          );
        })
        .join("") +
      '<div class="form-row total-row"><span class="form-row-label">Total Income Tax</span><span class="form-amount-box"' +
      rk2("Income Tax", "E11", "income-tax-calculation", "total-income-tax") +
      ">" +
      fmtBoxMoney(t.totalIncomeTax) +
      '</span><span class="form-row-margin">' +
      (itDrift ? correctionFor(itDrift, { inMargin: true }) : "") +
      "</span></div>" +
      "</div>" +
      '<div class="form-section"><h3>National Insurance</h3>' +
      formRow("Less: CIS deducted", fmtBoxMoney(-t.cisDeducted), rk2("Income Tax", "E12", "income-tax-calculation", "less-cis-deducted")) +
      formRow(
        "NI Class 4 (lower band)",
        fmtBoxMoney(t.niClass4Lower),
        rk2("Income Tax", "E15", "income-tax-calculation", "ni-class-4-lower-band"),
      ) +
      formRow(
        "NI Class 4 (upper band)",
        fmtBoxMoney(t.niClass4Upper),
        rk2("Income Tax", "E16", "income-tax-calculation", "ni-class-4-upper-band"),
      ) +
      "</div>" +
      '<div class="form-row total-row"><span class="form-row-label">Total Tax + NI</span><span class="form-amount-box"' +
      rk2("Income Tax", "E18", "income-tax-calculation", "total-tax-ni") +
      ">" +
      fmtBoxMoney(t.totalTaxAndNi) +
      '</span><span class="form-row-margin">' +
      (totalDrift ? correctionFor(totalDrift, { inMargin: true }) : "") +
      "</span></div>" +
      "</div>"
    );

    function formRow(label, amount, rKeyAttr) {
      return (
        '<div class="form-row"><span class="form-row-label">' +
        esc(label) +
        '</span><span class="form-amount-box"' +
        (rKeyAttr || "") +
        ">" +
        amount +
        "</span></div>"
      );
    }
  }

  // SA103S_LAYOUT (bst-data.js) carries the SE Short cell for every box it
  // prints (row.cell), reaching this page unchanged in SNAPSHOT.sa103s. This
  // names the section row each cell reprints (CELL_MAP); box 50 (Business
  // premises renovation allowance) carries no cell of its own and gets no key.
  // buildSa103s() (bst-data.js) drops SA103S_LAYOUT's own "cell" field on
  // its way into the snapshot, keeping the box number -- so this keys off
  // the box instead, carrying the same cell + row slug that field named.
  // Box 50 (Business premises renovation allowance) carries no cell.
  var SA103S_BOX_R_KEY = {
    8: ["D38", "turnover"],
    16: ["D46", "cost-of-goods"],
    19: ["D51", "motor-travel-expenses"],
    20: ["D55", "employee-costs"],
    21: ["D60", "premises-costs"],
    23: ["D64", "repairs-maintenance"],
    31: ["D71", "net-profit-loss"],
    32: ["O71", "net-loss-box-21"],
    49: ["D80", "capital-allowances"],
    51: ["O80", "wda-capital-allowance-claimed"],
    52: ["O85", "balancing-charge"],
    57: ["D99", "taxable-profit"],
    70: ["O94", "loss-brought-forward-box-28"],
    71: ["O99", "other-business-income-box-29"],
  };

  function renderSa103sForm() {
    return (
      '<div class="form-render">' +
      '<div class="form-masthead"><div class="form-name">SA103S — Self-employment (short)</div>' +
      '<div class="form-microcopy">Check these against your return. Box numbers match the form; nothing here is the actual HMRC document.</div></div>' +
      SNAPSHOT.sa103s.sections
        .map(function (section) {
          return (
            '<div class="form-section"><h3>' +
            esc(section.heading) +
            "</h3>" +
            section.rows
              .map(function (r) {
                var boxKey = SA103S_BOX_R_KEY[r.box];
                var attr = boxKey ? rk2("SE Short", boxKey[0], "self-assessment-sa103s", boxKey[1]) : "";
                return (
                  '<div class="form-row' +
                  (r.total ? " total-row" : "") +
                  '"><span class="box-chip">' +
                  esc(r.box) +
                  '</span><span class="form-row-label">' +
                  esc(r.label) +
                  '</span><span class="form-amount-wrap"><span class="form-amount-box"' +
                  attr +
                  ">" +
                  fmtBoxWhole(r.amount) +
                  '</span><span class="whole-pounds-note">whole pounds</span></span></div>'
                );
              })
              .join("") +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  // ============================== charts ==============================

  function renderChartsBlock() {
    return renderExpenseBar() + renderMonthlyColumns();
  }

  var CHART_COLOR_ORDER = ["#106868", "#158484", "#29c0c0", "#6ed3d3", "#a9e4e4", "#737373"];

  function renderExpenseBar() {
    var a = SNAPSHOT.annual;
    var items = [
      ["Employee Costs", a.employeeCosts],
      ["Premises Costs", a.premisesCosts],
      ["Other Expenses", a.otherExpenses],
      ["Motor Expenses", a.motorExpenses],
      ["Advertising", a.advertising],
      ["Legal & Professional", a.legalProfessional],
    ].sort(function (x, y) {
      return y[1] - x[1];
    });
    var total = items.reduce(function (s, i) {
      return s + i[1];
    }, 0);
    var width = 600;
    var height = 34 * items.length + 10;
    var barMax = width - 190;
    var y = 10;
    var bars = items
      .map(function (item, i) {
        var w = (item[1] / items[0][1]) * barMax;
        var color = CHART_COLOR_ORDER[i % CHART_COLOR_ORDER.length];
        var share = ((item[1] / total) * 100).toFixed(1);
        var row =
          '<text x="0" y="' +
          (y + 14) +
          '" class="chart-bar-label" fill="var(--ink)">' +
          esc(item[0]) +
          "</text>" +
          '<rect x="150" y="' +
          y +
          '" width="' +
          Math.max(w, 1) +
          '" height="20" fill="' +
          color +
          '" rx="2"></rect>' +
          '<text x="' +
          (150 + w + 8) +
          '" y="' +
          (y + 14) +
          '" class="chart-value-label" fill="var(--pencil)">' +
          fmtMoney(item[1]) +
          " (" +
          share +
          "%)" +
          "</text>";
        y += 34;
        return row;
      })
      .join("");
    return (
      '<div class="chart-block"><h3>Where the costs are</h3>' +
      '<svg viewBox="0 0 ' +
      width +
      " " +
      height +
      '" role="img" aria-label="Expense categories by annual total, largest first">' +
      bars +
      "</svg></div>"
    );
  }

  function renderMonthlyColumns() {
    var months = SNAPSHOT.months;
    var width = 600;
    var height = 220;
    var padding = 28;
    var chartW = width - padding * 2;
    var chartH = height - padding * 2 - 20;
    var groupW = chartW / months.length;
    var barW = groupW / 3.2;
    var maxVal = Math.max.apply(
      null,
      months.map(function (m) {
        var r = SNAPSHOT.monthly[m.key];
        return Math.max(r.sales, r.totalExpenses + r.costOfSales + r.directCosts);
      }),
    );
    var cumulative = 0;
    var cumPoints = [];
    var bars = months
      .map(function (m, i) {
        var r = SNAPSHOT.monthly[m.key];
        var x = padding + i * groupW;
        var costs = r.costOfSales + r.directCosts + r.totalExpenses;
        var salesH = (r.sales / maxVal) * chartH;
        var costsH = (costs / maxVal) * chartH;
        var profitH = (Math.max(r.netProfit, 0) / maxVal) * chartH;
        cumulative += r.netProfit;
        cumPoints.push([x + groupW / 2, height - padding - 20 - (cumulative / (maxVal * 3)) * chartH]);
        return (
          '<rect x="' +
          x +
          '" y="' +
          (height - padding - 20 - salesH) +
          '" width="' +
          barW +
          '" height="' +
          salesH +
          '" fill="#2f6b4f"></rect>' +
          '<rect x="' +
          (x + barW + 2) +
          '" y="' +
          (height - padding - 20 - costsH) +
          '" width="' +
          barW +
          '" height="' +
          costsH +
          '" fill="#b3402a"></rect>' +
          '<rect x="' +
          (x + (barW + 2) * 2) +
          '" y="' +
          (height - padding - 20 - profitH) +
          '" width="' +
          barW +
          '" height="' +
          profitH +
          '" fill="#93c4ac"></rect>' +
          '<text x="' +
          (x + groupW / 2) +
          '" y="' +
          (height - 6) +
          '" class="chart-bar-label" fill="var(--pencil)" text-anchor="middle">' +
          esc(m.label) +
          "</text>"
        );
      })
      .join("");
    var linePath = cumPoints
      .map(function (p, i) {
        return (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1);
      })
      .join(" ");
    return (
      '<div class="chart-block"><h3>Through the year</h3>' +
      '<svg viewBox="0 0 ' +
      width +
      " " +
      height +
      '" role="img" aria-label="Monthly turnover, costs and profit, with cumulative profit">' +
      bars +
      '<path d="' +
      linePath +
      '" fill="none" stroke="var(--correction)" stroke-width="2"></path>' +
      "</svg>" +
      '<div class="chart-legend">' +
      '<span><span class="chart-legend-swatch" style="background:#2f6b4f"></span>Turnover</span>' +
      '<span><span class="chart-legend-swatch" style="background:#b3402a"></span>Costs</span>' +
      '<span><span class="chart-legend-swatch" style="background:#93c4ac"></span>Profit</span>' +
      '<span><span class="chart-legend-swatch" style="background:var(--correction)"></span>Cumulative profit</span>' +
      "</div></div>"
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
      '</span><span class="caps-label">Flagged</span></div>' +
      '<div class="drift-summary-item"><span class="count">' +
      driftCount +
      '</span><span class="caps-label">' +
      (SNAPSHOT.edited ? "Recalculated" : "Drift cells") +
      "</span></div>" +
      "</div>"
    );
  }

  // The engine's own checks: checkCompliance, the ones the reconciliation
  // runs. Both sides of each are derived from the same lines, so they follow
  // an edit rather than catching one -- what they catch is the calculator
  // and the book disagreeing.
  function renderChecksList() {
    return (
      '<p class="caps-label checks-group-label">Engine checks</p><ul class="checks-list">' +
      SNAPSHOT.checks
        .map(function (c) {
          var marker = c.result === "pass" ? "✓" : "!";
          return (
            '<li class="check-item ' +
            c.result +
            '"' +
            rk("check/" + c.label) +
            '><span class="check-marker">' +
            marker +
            '</span><span class="check-body"><span class="check-label">' +
            esc(c.label) +
            '</span><br/><span class="check-figures">expected ' +
            fmtMoney(c.expected) +
            " · actual " +
            fmtMoney(c.actual) +
            "</span></span></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  // The book checks: the ones over D itself, where an entry can be wrong
  // while every total still adds up. A failing one carries its fix-it.
  function renderBookChecksList() {
    return (
      '<p class="caps-label checks-group-label">Book checks</p><ul class="book-checks-list">' +
      state.bookChecks
        .map(function (c) {
          var marker = c.result === "pass" ? "✓" : "!";
          return (
            '<li class="check-item ' +
            c.result +
            '" data-book-check="' +
            esc(c.id) +
            '"><span class="check-marker">' +
            marker +
            '</span><span class="check-body"><span class="check-label">' +
            esc(c.label) +
            '</span><br/><span class="check-figures">' +
            (c.result === "pass" ? "every line" : c.actual + (c.actual === 1 ? " line" : " lines")) +
            "</span>" +
            (c.result === "pass" ? "" : renderBookCheckDetail(c)) +
            "</span></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function renderBookCheckDetail(check) {
    var offenders =
      '<ul class="check-offenders">' +
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
    var preview = open ? window.DiyaGlBooksEdits.previewHelper(SNAPSHOT, check.id) : null;
    return (
      '<p class="check-consequence">' +
      esc(check.consequence) +
      "</p>" +
      offenders +
      '<div class="check-helper">' +
      "<p><strong>" +
      esc(check.helper.title) +
      "</strong></p>" +
      (open && preview
        ? '<p class="helper-summary">' +
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
          '">Cancel</button></div>'
        : '<button type="button" class="btn" data-helper-preview="' + esc(check.id) + '">' + esc(check.helper.actionLabel) + "</button>") +
      "</div>"
    );
  }

  function renderHelpersSection() {
    return (
      '<div class="helpers-section"><h3>Helpers</h3>' +
      '<div class="helper-card"><h4>Make a sale/purchase from a bank item</h4>' +
      "<p>Turns an unmatched bank line into a sales or purchases line, category picked from the expense codes. Basic Sole Trader books carry no bank sheet, so there is nothing to act on here — the control ships for products that do.</p>" +
      '<button type="button" class="btn" disabled>Preview</button></div></div>'
    );
  }

  function renderInspectorFull() {
    return (
      "<h3>Checks &amp; drift</h3>" +
      renderDriftSummary() +
      renderBookChecksList() +
      renderChecksList() +
      renderHelpersSection() +
      "<h3>Charts</h3>" +
      renderChartsBlock() +
      '<div style="margin-top:1rem"><button type="button" class="btn btn-primary" id="inspector-save-btn">Save workbook</button></div>'
    );
  }

  function renderInspectorChecksOnly() {
    return "<h3>Checks &amp; drift</h3>" + renderDriftSummary() + renderBookChecksList() + renderChecksList() + renderHelpersSection();
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
          var checkId = control.getAttribute("data-helper-apply");
          var check = state.bookChecks.filter(function (c) {
            return c.id === checkId;
          })[0];
          var snapshotAtPreview = SNAPSHOT;
          state.openHelper = null;
          commit(
            function () {
              return window.DiyaGlBooksEdits.applyHelper(snapshotAtPreview, checkId);
            },
            check ? check.helper.title.toLowerCase() : checkId,
            check ? check.helper.title + " — applied." : "Applied.",
          );
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
      var active = document.activeElement;
      if (active && active.getAttribute && active.getAttribute("data-dirty") === "true") return;
      if (active && (active.tagName === "TEXTAREA" || (active.tagName === "INPUT" && active.hasAttribute("data-add-field")))) return;
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

    window.addEventListener("resize", function () {
      render();
    });
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

    [
      { label: "Download bst-excel.xlsx", format: "xlsx" },
      { label: "Download package (.zip)", format: "zip" },
    ].forEach(function (opt) {
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

  // save.js wraps saveBstWorkbook/saveBstPackageZip -- the same functions
  // the CLI and the MCP server write a workbook through -- behind the
  // engine bundle and a fetch-backed resource loader, then turns the bytes
  // into a download. Dynamic import keeps this a plain script: no engine
  // code loads until a save is actually asked for.
  function runSave(current, format) {
    showToast("Generating " + (format === "zip" ? "the package zip" : "bst-excel.xlsx") + "...");
    import("./save.js")
      .then(function (saveModule) {
        return saveModule.buildSaveArtifact(current.book, current.lines, format).then(function (artifact) {
          saveModule.downloadArtifact(artifact);
          showToast("Saved " + artifact.filename + ".");
        });
      })
      .catch(function (error) {
        showToast("Could not generate the workbook: " + (error && error.message ? error.message : error));
      });
  }

  var toastTimer = null;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove("is-visible");
    }, 4000);
  }

  // What the page answers to from outside itself. setLines is the way a
  // caller that is not the entries grid changes the book; undo is the same
  // stack the topbar button and Ctrl+Z pop.
  window.DiyaGlBooksPage = { setLines: setLines, undo: undoLastEdit };
})();
