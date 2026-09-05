// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2025-2026 DIY Accounting Ltd

// books/data.js
//
// The extract/recalculate/report loop behind the page. It loads the engine
// bundle (scripts/build-books-bundle.mjs) and computes
// window.DIYA_BOOKS_SNAPSHOT from one of four sources: an uploaded workbook or
// package, one of the product's example books served as static assets, a
// blank book from the new-book form, or the working book autosave handed
// back. Every view in the shell reads book data only through the snapshot --
// this file fills it, and is no view's rewrite.
//
// Every function here takes the mounted product manifest (books/products/
// <id>.js) and reaches the product module through engine.productModule(id):
// the manifest says how lines group into month rows, how an upload becomes a
// book and which product-specific figures join the snapshot; this file owns
// the shared half.
//
// Upload path: manifest.upload.validate -> manifest.upload.extract -> a book
// built from the same cells CELL_MAP names -> loadTaxDataForBook ->
// diyaGlToScenario -> calculateFromDiyaGl -> checkCompliance. Every
// calculated cell CELL_MAP carries is also read back off the uploaded
// workbook's own cached value (xlsx-cells.js), canonicalised the way
// verify-roundtrip.js canonicalises a roundtrip comparison (money half-up to
// the penny, rates to 6 dp), and any cell that disagrees becomes a drift
// finding -- EQ1 live in the browser, and the breakability proof: a
// hand-corrupted cached <v> flips exactly that cell's drift and nothing else,
// because the computed side never reads the workbook's cells at all.
//
// Example path: book.toml + lines.jsonl only, no workbook to read a cached
// value from, so there is no as-read layer and no drift -- exactly what the
// data model section says an example carries.
// ============================================================================

(function (global) {
  "use strict";

  // The as-read layer, the link layer and the drift they show live in
  // drift.js (window.DiyaGlDrift); this file captures them at load and hands
  // them to every snapshot.

  // A single uploaded workbook read through the set contract, so both kinds
  // of upload capture their layers through one reader.
  function singleWorkbookSet(workbookCells) {
    return {
      has: function () {
        return true;
      },
      hasSheet: function (file, sheetName) {
        return workbookCells.hasSheet(sheetName);
      },
      readCell: function (file, sheetName, cellRef) {
        return workbookCells.readCell(sheetName, cellRef);
      },
    };
  }

  // ============================== engine loading ==============================

  var enginePromise = null;
  function loadEngine() {
    if (!enginePromise) enginePromise = import("./engine/diya-gl-engine.js");
    return enginePromise;
  }

  var resourcesPromise = null;
  function loadResources() {
    if (!resourcesPromise) resourcesPromise = import("./bundle-resources.js").then((m) => m.browserResourceLoader());
    return resourcesPromise;
  }

  var schemasReady = null;
  // Two caches, loaded together: diya-gl-schema.js's (validateBook/
  // validateLines, what readBookSource checks a diya-gl zip or JSON
  // against) and diya-gl-canonical.js's own separate one (what
  // canonicalBookToml/canonicalLinesJsonl/writeBookJson read field order
  // and money-vs-rate typing from -- used by the diya-gl zip and JSON
  // downloads). Both are Promise.all'd once and cached the same way.
  function ensureSchemas(engine, resources) {
    if (!schemasReady) {
      schemasReady = Promise.all([engine.loadSchemasFrom(resources), engine.loadCanonicalSchemasFrom(resources)]);
    }
    return schemasReady;
  }

  async function loadEngineAndResources() {
    var engine = await loadEngine();
    var resources = await loadResources();
    await ensureSchemas(engine, resources);
    return { engine: engine, resources: resources };
  }

  // The headlines strip (headlines.js) needs the headline figures
  // synchronously inside the shell's own render(), so this reads the engine
  // the snapshot's context already carries rather than importing again.
  function headlinesFor(report, context) {
    return context.engine.headlinesFromReport(report, context.productMod.HEADLINES);
  }

  // ============================== the diya-gl -> snapshot mapping ==============================

  function monthKeyOf(dateStr) {
    return dateStr.slice(0, 7);
  }

  var MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function buildMonths(periodStartISO) {
    var parts = periodStartISO.split("-").map(Number);
    var startYear = parts[0];
    var startMonth = parts[1]; // 1-12
    var months = [];
    for (var i = 0; i < 12; i++) {
      var total = startMonth - 1 + i;
      var year = startYear + Math.floor(total / 12);
      var monthIndex = total % 12;
      months.push({ key: year + "-" + String(monthIndex + 1).padStart(2, "0"), label: MONTH_LABELS[monthIndex] });
    }
    return months;
  }

  // A manifest may group by its own calendar (Taxi's tab months); the
  // calendar month of the posting date is the default.
  function monthsFor(book, manifest) {
    return manifest.months.build ? manifest.months.build(book) : buildMonths(isoDate(book.documentInfo.periodCoveredStart));
  }

  function monthKeyFor(line, manifest) {
    return manifest.months.keyOf ? manifest.months.keyOf(line) : monthKeyOf(line.postingDate);
  }

  function entryOf(line, posted, addressable) {
    return {
      entryNumber: line.entryNumber,
      date: line.postingDate,
      account: String(line.accountMainID),
      label: line.detailComment || "",
      detail: line.documentReference || "",
      amount: line.amount,
      posted: posted,
      addressable: addressable,
    };
  }

  // The edit functions name a line by its entryNumber, so a line sharing one
  // with another (or carrying none) cannot be changed on its own. Those rows
  // render as figures rather than fields rather than quietly editing two
  // lines at once.
  function addressableEntryNumbers(lines) {
    var seen = {};
    for (var i = 0; i < lines.length; i++) {
      var key = lines[i].entryNumber;
      seen[key] = (seen[key] || 0) + 1;
    }
    return seen;
  }

  function byDate(a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  }

  // The month-by-month breakdown table has no single workbook cell to read
  // (the sheet only totals the year), so it is aggregated here from the same
  // lines the engine calculated from, grouped by month and by the category
  // the manifest's classify() gives each line. closeYear runs on the last
  // month (the year-end stock movement, for a product that carries one) and
  // derive() fills every row's computed figures.
  function buildMonthlyAndEntries(lines, months, book, ctx) {
    var manifest = ctx.manifest;
    var categories = manifest.months.categories(ctx.productMod);
    var journals = manifest.months.journals;
    var monthly = {};
    var entries = {};
    var i, j;

    function emptyRow() {
      var row = {};
      for (var c = 0; c < categories.length; c++) row[categories[c].key] = 0;
      row.capex = 0;
      return row;
    }

    for (i = 0; i < months.length; i++) {
      monthly[months[i].key] = emptyRow();
      var monthEntries = { monthKey: months[i].key };
      for (j = 0; j < journals.length; j++) monthEntries[journals[j].id] = [];
      entries[months[i].key] = monthEntries;
    }
    var lastKey = months[months.length - 1].key;
    var entryNumberCounts = addressableEntryNumbers(lines);

    for (i = 0; i < lines.length; i++) {
      var line = lines[i];
      var addressable = !!line.entryNumber && entryNumberCounts[line.entryNumber] === 1;
      var monthKey = monthKeyFor(line, manifest);
      if (!monthly[monthKey]) continue; // outside the declared period
      var placed = manifest.months.classify(line, book, ctx);
      if (!placed.journal || !entries[monthKey][placed.journal]) continue;
      // A line whose account the chart does not carry reaches no total in
      // the workbook -- the money simply goes nowhere. It still belongs in
      // the month's entries so the reader can see it and fix it, marked for
      // what it is, and left out of the month's own figures.
      var posted = placed.key !== null;
      if (posted) monthly[monthKey][placed.key] += line.amount;
      entries[monthKey][placed.journal].push(entryOf(line, posted, addressable));
    }

    if (manifest.months.closeYear) manifest.months.closeYear(monthly[lastKey], book);

    for (i = 0; i < months.length; i++) {
      var key = months[i].key;
      manifest.months.derive(monthly[key], key, ctx);
      for (j = 0; j < journals.length; j++) entries[key][journals[j].id].sort(byDate);
    }

    return { monthly: monthly, entries: entries };
  }

  function buildChecks(checkResults) {
    return checkResults.map(function (c, i) {
      return {
        id:
          "check-" +
          i +
          "-" +
          String(c.name)
            .replace(/[^a-z0-9]+/gi, "-")
            .toLowerCase(),
        label: c.name,
        expected: c.expected,
        actual: c.actual,
        result: c.pass ? "pass" : "fail",
      };
    });
  }

  function buildBusinessDetails(book) {
    var entity = book.entityInformation || {};
    var info = book.documentInfo || {};
    return {
      organizationIdentifier: entity.organizationIdentifier || "",
      organizationDescription: entity.organizationDescription || "",
      organizationAddressLine: entity.organizationAddressLine || "",
      organizationTown: entity.organizationTown || "",
      organizationPostcode: entity.organizationPostcode || "",
      periodCoveredStart: isoDate(info.periodCoveredStart),
      periodCoveredEnd: isoDate(info.periodCoveredEnd),
      basisOfAccounting: entity["diya-gl:basisOfAccounting"] || "cash",
      vatRegistered: entity["diya-gl:vatRegistered"] === true,
    };
  }

  function isoDate(value) {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }

  // ============================== upload limits & content sniffing ==============================

  // 25 MB: refused before any parsing, so a customer sees this message
  // immediately rather than waiting through a partial read of a file this
  // page will not accept.
  var MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

  function assertWithinUploadLimit(bytes) {
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error("This file is larger than 25 MB, more than this page reads in the browser. Export a smaller file and try again.");
    }
  }

  // The workbook inside a package zip, found by content -- the single
  // .xlsx entry -- never by the zip's own file name. detectBookSource
  // already named this kind "package-zip" by the same rule (one .xlsx
  // entry, no lines.jsonl), so a .zip renamed .xlsx reaches here exactly
  // the same way a properly named one does.
  async function unwrapPackageZip(fileBytes) {
    var zip = await global.JSZip.loadAsync(fileBytes);
    var entryName = Object.keys(zip.files).filter(function (name) {
      return !zip.files[name].dir && /\.xlsx$/i.test(name);
    })[0];
    if (!entryName) throw new Error("No .xlsx workbook found inside this zip.");
    return zip.file(entryName).async("uint8array");
  }

  // Which product a workbook set came from, by the files it carries: the
  // same rule books-interchange.js's own sniff applies to a package. A set
  // with the multi-file hub is Self Employed when it carries the bank book
  // and Company when it carries the current account; a single workbook is
  // the Basic Sole Trader's, and its anchor guard says so by name when it is
  // not.
  var PACKAGE_HUB = "Financialaccounts.xlsx";
  var SE_BANK_BOOK = "Bank.xlsx";
  var LTD_CURRENT_ACCOUNT = "Currentaccount.xlsx";
  var SINGLE_WORKBOOK_PRODUCT = "bst";

  function productIdOfSet(set) {
    if (set.has(PACKAGE_HUB)) {
      if (set.has(SE_BANK_BOOK)) return "se";
      if (set.has(LTD_CURRENT_ACCOUNT)) return "ltd";
    }
    return SINGLE_WORKBOOK_PRODUCT;
  }

  /**
   * What a File is, dispatched by content and never by the name it arrived
   * under: the kind detectBookSource gives it and the product it belongs
   * to, so the shell can mount that product's manifest before loading. A
   * workbook or package keeps its bytes for the manifest's own upload path,
   * which carries the as-read layer and reads book fields off cells a
   * diya-gl source has none of; a diya-gl zip, a diya-gl JSON file or that
   * JSON zipped are read here through the engine's own readBookSource. The
   * legacy .xls and anything unrecognised reach readBookSource too, purely
   * to raise its own named refusal.
   * @param {File} file
   * @returns {Promise<{kind: string, name: string, productId: string, bytes?: Uint8Array, book?: Object, lines?: Array}>}
   */
  async function sniff(file) {
    var engine = await loadEngine();
    var fileBytes = new Uint8Array(await file.arrayBuffer());
    assertWithinUploadLimit(fileBytes);

    var kind = await engine.detectBookSource(fileBytes, file.name);
    if (kind === "workbook") return { kind: kind, name: file.name, productId: SINGLE_WORKBOOK_PRODUCT, bytes: fileBytes };
    if (kind === "package-zip" || kind === "package-set") {
      var set = await global.DiyaGlXlsxCells.openWorkbookSet(fileBytes);
      return { kind: kind, name: file.name, productId: productIdOfSet(set), bytes: fileBytes };
    }
    // readBookSource validates a diya-gl zip/JSON's book and lines against
    // the published schemas as it reads them, so the schemas have to be in
    // place before this call.
    var loaded = await loadEngineAndResources();
    var source = await loaded.engine.readBookSource(fileBytes, file.name);
    return { kind: source.kind, name: file.name, productId: source.product, book: source.book, lines: source.lines };
  }

  /**
   * The product a book already on hand declares for itself -- a saved
   * working book or an example -- so the shell can mount its manifest.
   * @param {Object} book
   * @returns {Promise<string>}
   */
  async function productIdOfBook(book) {
    var engine = await loadEngine();
    var schemaName = book.entityInformation && book.entityInformation["diya-gl:product"];
    var productId = engine.productIdOf(schemaName);
    if (!productId) {
      throw new Error(
        'The book declares no product this page carries: entityInformation."diya-gl:product" is ' + JSON.stringify(schemaName) + ".",
      );
    }
    return productId;
  }

  // ============================== the loaders ==============================

  function periodFromLines(lines) {
    if (lines.length === 0) throw new Error("This file carries no transaction lines to read an accounting period from.");
    var dates = lines.map(function (l) {
      return l.postingDate;
    });
    dates.sort();
    var first = dates[0];
    var firstYear = Number(first.slice(0, 4));
    var firstMonth = Number(first.slice(5, 7));
    var startYear = firstMonth >= 4 ? firstYear : firstYear - 1;
    return { start: startYear + "-04-01", end: startYear + 1 + "-03-31" };
  }

  // The chart an upload's book declares: one account per code the lines
  // post to, under the journal each line came from.
  function buildAccountsChart(lines, manifest) {
    var accounts = {};
    manifest.months.journals.forEach(function (journal) {
      accounts[journal.id] = {};
    });
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!accounts[line.sourceJournalID]) continue;
      var code = String(line.accountMainID);
      accounts[line.sourceJournalID][code] = { accountMainDescription: "Account " + code };
    }
    return accounts;
  }

  // The account chart the add-entry affordance offers, straight off the
  // book's own [accounts] tables so a new line can only be posted somewhere
  // the book already declares.
  function buildChart(book, manifest) {
    var accounts = book.accounts || {};
    var chart = {};
    manifest.months.journals.forEach(function (journal) {
      chart[journal.id] = Object.keys(accounts[journal.id] || {})
        .sort()
        .map(function (code) {
          var account = accounts[journal.id][code] || {};
          return { code: code, description: account.accountMainDescription || "Account " + code };
        });
    });
    return chart;
  }

  // The shared half of the snapshot, with the manifest's own half merged on
  // top. results joins it so a view can read a cell the derivations did not
  // copy.
  function assembleSnapshot(ctx) {
    var book = ctx.book;
    var months = monthsFor(book, ctx.manifest);
    ctx.months = months;
    var monthlyAndEntries = buildMonthlyAndEntries(ctx.lines, months, book, ctx);

    var shared = {
      scenario: ctx.scenarioLabel,
      book: book,
      lines: ctx.lines,
      chart: buildChart(book, ctx.manifest),
      period: { start: isoDate(book.documentInfo.periodCoveredStart), end: isoDate(book.documentInfo.periodCoveredEnd) },
      months: months,
      categories: ctx.manifest.months.categories(ctx.productMod),
      monthly: monthlyAndEntries.monthly,
      entries: monthlyAndEntries.entries,
      results: ctx.results,
      drift: ctx.drift,
      checks: buildChecks(ctx.checks),
      businessDetails: buildBusinessDetails(book),
    };
    return Object.assign(shared, ctx.manifest.snapshot(ctx));
  }

  // R, built the same call shape export.js's buildFileReportDocument builds
  // it with for the CLI: the same package name, engine name, results and
  // product module, the scenario merged with its own expected table, and
  // the checks this snapshot already ran. A browser export and a CLI
  // export of the same book write the same report.json bytes because both
  // pass through buildReportDocument with the same arguments.
  function buildReport(ctx, expectedScenario) {
    var periodEnd = ctx.book.documentInfo && ctx.book.documentInfo.periodCoveredEnd;
    var yearEnd = periodEnd ? new Date(periodEnd).toISOString().slice(0, 10) : null;
    return ctx.engine.buildReportDocument({
      packageName: ctx.manifest.id,
      engine: "js",
      results: ctx.results,
      productMod: ctx.productMod,
      scenario: expectedScenario,
      checks: ctx.checks,
      scenarioName: ctx.book.documentInfo && ctx.book.documentInfo.entriesComment,
      yearEnd: yearEnd,
    });
  }

  // One run of the D -> R loop, from whichever lines the page currently
  // holds. Every entry point below ends here, so a first load and a load
  // after an edit compute the same way -- the only difference is whether
  // the drift annotations call themselves recalculated.
  async function buildSnapshot(book, lines, context) {
    var engine = await loadEngine();
    var manifest = context.manifest;
    var productMod = engine.productModule(manifest.id);
    var scenario = engine.diyaGlToScenario(book, lines, manifest.id);
    var expected = Object.assign({}, scenario, scenario.expected);
    var results = engine.calculateFromDiyaGl(book, lines, manifest.id, context.taxData, expected);
    var checks = productMod.checkCompliance(Object.assign({}, results), expected, context.taxData, engine.calculateExpectedTax);
    var links = context.linkLayer
      ? { layer: context.linkLayer, cells: context.linkCells, hubFile: context.hubFile, classify: engine.classifyLinkCell }
      : null;
    var drift = context.asReadLayer ? global.DiyaGlDrift.driftFromAsRead(context.asReadLayer, results, !!context.edited, links) : [];

    var fullContext = Object.assign({}, context, { engine: engine, productMod: productMod });
    var ctx = Object.assign({ book: book, lines: lines, results: results, checks: checks, drift: drift }, fullContext);
    var snapshot = assembleSnapshot(ctx);
    snapshot.context = fullContext;
    snapshot.edited = !!context.edited;
    snapshot.source = context.source || null;
    snapshot.report = buildReport(ctx, expected);
    return snapshot;
  }

  // The tax year a book's period end falls in, named the way the product's
  // regime names its data file.
  function taxYearFor(engine, productMod, book) {
    return engine.taxYearFileName(new Date(book.documentInfo.periodCoveredEnd), productMod.PRODUCT.taxRegime);
  }

  /**
   * Recompute the whole book after an edit. The lines are the edit's own
   * output (diya-gl-edits.js returns a new array; nothing here mutates in
   * place), and the context carries what the load already resolved -- the
   * manifest, the tax year's data and the uploaded workbook's as-read layer.
   * @param {Object} book
   * @param {Array} lines
   * @param {Object} context - the context the loading snapshot carried
   * @param {boolean} [edited] - false when undo has taken the book all the
   *   way back to what was loaded, so the drift annotations go back to
   *   reading as findings rather than as the edits' own effect
   */
  async function recalculate(book, lines, context, edited) {
    return buildSnapshot(book, lines, Object.assign({}, context, { edited: edited !== false }));
  }

  /**
   * Recompute after a change to the book itself -- a business detail, an
   * address, the accounting period. The tax year the book declares is
   * resolved again, so a new year end brings that year's own rates and
   * every check re-runs against them. The as-read layer and the source the
   * load resolved carry through untouched.
   * @param {Object} book
   * @param {Array} lines
   * @param {Object} context - the context the loading snapshot carried
   * @param {boolean} [edited] - false when undo has taken the book back to
   *   what was loaded
   */
  async function recalculateWithBook(book, lines, context, edited) {
    var loaded = await loadEngineAndResources();
    var productMod = loaded.engine.productModule(context.manifest.id);
    var taxYearName = taxYearFor(loaded.engine, productMod, book);
    var taxData = await loaded.engine.loadTaxDataForBook(book, { resources: loaded.resources, taxYearName: taxYearName });

    return buildSnapshot(book, lines, Object.assign({}, context, { taxData: taxData, taxYearName: taxYearName, edited: edited !== false }));
  }

  // Every path that has a book and lines already assembled (an example's
  // book.toml+lines.jsonl, a brand-new empty book, a diya-gl source, or a
  // working book handed back from autosave): resolve the tax year the book
  // declares, then run the same loop. No as-read layer here -- only an
  // upload reads a workbook's cached values, so drift is always empty on
  // this path.
  async function computeAndAssemble(label, book, lines, sourceKind, manifest) {
    var loaded = await loadEngineAndResources();
    var productMod = loaded.engine.productModule(manifest.id);
    var taxYearName = taxYearFor(loaded.engine, productMod, book);
    var taxData = await loaded.engine.loadTaxDataForBook(book, { resources: loaded.resources, taxYearName: taxYearName });

    return buildSnapshot(book, lines, {
      manifest: manifest,
      scenarioLabel: label,
      taxData: taxData,
      taxYearName: taxYearName,
      asReadLayer: null,
      source: { kind: sourceKind, label: label, product: manifest.id },
    });
  }

  /**
   * Load one of the manifest's example books: book.toml + lines.jsonl only,
   * no workbook to read an as-read layer from.
   * @param {string} exampleKey - a key of manifest.examples
   * @param {Object} manifest
   */
  async function loadExample(exampleKey, manifest) {
    var meta = manifest.examples.filter(function (example) {
      return example.key === exampleKey;
    })[0];
    if (!meta) throw new Error('Unknown example "' + exampleKey + '"');

    var loaded = await loadEngineAndResources();
    var base = "examples/" + meta.dir + "/" + meta.product + "/";
    var bookToml = await loaded.resources.readText(base + "book.toml");
    var linesRaw = await loaded.resources.readText(base + "lines.jsonl");
    var parsed = loaded.engine.parseDiyaGlData(bookToml, linesRaw);

    return computeAndAssemble(exampleKey, parsed.book, parsed.lines, "example", manifest);
  }

  // The accounting period a year-end date implies: twelve months ending on
  // that date, starting the day after the same calendar date one year
  // earlier -- the same shape every fixture's own period takes, whether
  // it is a March tax-year-end or a personal 6 April one.
  function periodFromYearEnd(yearEndISO) {
    var parts = yearEndISO.split("-").map(Number);
    var endDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    var startDate = new Date(Date.UTC(parts[0] - 1, parts[1] - 1, parts[2] + 1));
    return { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) };
  }

  /**
   * Build an empty but valid book from the new-book form's values, already
   * checked by the shell against the manifest's field rules. The manifest
   * builds the book itself (documentInfo, entityInformation, its starting
   * chart); there are no lines and no as-read layer -- the data model's
   * second way in.
   * @param {Object} values - keyed by manifest.newBook.fields[].name; yearEnd is a validated "YYYY-MM-DD"
   * @param {Object} manifest
   */
  async function createNewBook(values, manifest) {
    var loaded = await loadEngineAndResources();
    var productMod = loaded.engine.productModule(manifest.id);
    var book = manifest.newBook.build(values, { engine: loaded.engine, productMod: productMod, period: periodFromYearEnd(values.yearEnd) });

    var bookValidation = loaded.engine.validateBook(book);
    if (!bookValidation.valid) {
      throw new Error("Could not build a valid new book: " + bookValidation.errors.join("; "));
    }

    return computeAndAssemble(manifest.newBook.label(values), book, [], "new", manifest);
  }

  /**
   * Recompute a snapshot from a book and lines already on hand -- the
   * "continue where you left off" path, handing autosave's stored working
   * book back through the same calculate/check loop every other load uses.
   * @param {object} book
   * @param {object[]} lines
   * @param {string} label
   * @param {string} sourceKind
   * @param {Object} manifest
   */
  function loadFromBookAndLines(book, lines, label, sourceKind, manifest) {
    return computeAndAssemble(label, book, lines, sourceKind || "continued", manifest);
  }

  /**
   * Load what sniff() found, with the manifest the shell mounted for it. A
   * diya-gl source already carries its book and lines; a workbook or
   * package goes through the manifest's upload path: the anchor guard, the
   * real extraction, a book from the same cells CELL_MAP names, live
   * calculation, and the as-read layer read off the same bytes.
   * @param {Object} sniffed - what sniff() returned
   * @param {Object} manifest
   */
  async function loadSniffed(sniffed, manifest) {
    if (sniffed.book) return computeAndAssemble(sniffed.name, sniffed.book, sniffed.lines, sniffed.kind, manifest);

    var loaded = await loadEngineAndResources();
    var engine = loaded.engine;
    var productMod = engine.productModule(manifest.id);
    var xlsxBytes = sniffed.kind === "package-zip" ? await unwrapPackageZip(sniffed.bytes) : sniffed.bytes;

    // validate throws the product's own anchor error, named by sheet and
    // header -- never a silent short read. Let it propagate; the shell
    // shows it.
    await manifest.upload.validate(engine, xlsxBytes);

    var lines = await manifest.upload.extract(engine, xlsxBytes);
    if (lines.length === 0) throw new Error("This file carries no transaction lines to build a book from.");

    var workbookCells = await global.DiyaGlXlsxCells.openWorkbookCells(xlsxBytes);
    var book = await manifest.upload.bookFromWorkbook(workbookCells, lines, {
      engine: engine,
      productMod: productMod,
      manifest: manifest,
      period: periodFromLines(lines),
      accounts: buildAccountsChart(lines, manifest),
      fileName: sniffed.name,
    });

    var bookValidation = engine.validateBook(book);
    var linesValidation = engine.validateLines(lines, book);

    var taxYearName = taxYearFor(engine, productMod, book);
    var taxData = await engine.loadTaxDataForBook(book, { resources: loaded.resources, taxYearName: taxYearName });
    // A multi-file package's hub caches every leaf cell it reads, so its
    // upload captures the link layer too, and the engine's unscoped link
    // cells once, beside it.
    var hubFile = manifest.multiFile ? engine.HUB_FILE : null;
    var set = manifest.multiFile ? await global.DiyaGlXlsxCells.openWorkbookSet(sniffed.bytes) : singleWorkbookSet(workbookCells);
    var asReadLayer = await global.DiyaGlDrift.captureAsReadLayer(productMod.CELL_MAP, set, hubFile, manifest);
    var linkLayer = manifest.multiFile ? await global.DiyaGlDrift.captureLinkLayer(set, hubFile, engine) : null;
    var linkCells = null;
    if (manifest.multiFile) {
      var scenario = engine.diyaGlToScenario(book, lines, manifest.id);
      linkCells = engine.calculateLinkCells(book, lines, manifest.id, taxData, Object.assign({}, scenario, scenario.expected));
    }

    var snapshot = await buildSnapshot(book, lines, {
      manifest: manifest,
      scenarioLabel: sniffed.name,
      taxData: taxData,
      taxYearName: taxYearName,
      asReadLayer: asReadLayer,
      linkLayer: linkLayer,
      linkCells: linkCells,
      hubFile: hubFile,
    });
    snapshot.bookValidation = bookValidation;
    snapshot.linesValidation = linesValidation;
    return snapshot;
  }

  global.DiyaGlBooksLoader = {
    sniff: sniff,
    productIdOfBook: productIdOfBook,
    loadSniffed: loadSniffed,
    loadExample: loadExample,
    createNewBook: createNewBook,
    loadFromBookAndLines: loadFromBookAndLines,
    recalculate: recalculate,
    recalculateWithBook: recalculateWithBook,
    headlinesFor: headlinesFor,
  };
})(window);
