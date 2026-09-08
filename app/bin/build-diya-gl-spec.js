#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// build-diya-gl-spec.js — Generate the diya-gl format specification page.
//
// Usage:
//   node app/bin/build-diya-gl-spec.js
//
// Reads:  web/spreadsheets.diyaccounting.co.uk/public/schema/diya-gl-book-v2.schema.json
//         web/spreadsheets.diyaccounting.co.uk/public/schema/diya-gl-lines-v2.schema.json
//         app/data/hmrc/form-layouts/{bst,taxi,se}.json
//         app/data/hmrc/sa103-mtd-mapping.json
//         app/lib/books-interchange.js (the zip entries and the format version)
//         app/lib/book-checks.js, run over one example book per product
//         web/spreadsheets.diyaccounting.co.uk/public/reconciliation/*.json
// Writes: web/spreadsheets.diyaccounting.co.uk/public/diya-gl.html
//
// Every table on the page is read from the artefact it describes, so the
// page cannot claim a field, a box or a check the code does not carry. The
// prose sits in this file; the numbers in it are counted from the tables.

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData, diyaGlToScenario, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { runBookChecks } from "../lib/book-checks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const PUBLIC_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public");
const SCHEMA_DIR = resolve(PUBLIC_DIR, "schema");
const RECONCILIATION_DIR = resolve(PUBLIC_DIR, "reconciliation");
const HMRC_DIR = resolve(ROOT, "app", "data", "hmrc");
const EXAMPLES_DIR = resolve(ROOT, "examples");
const OUT_PATH = resolve(PUBLIC_DIR, "diya-gl.html");

const CANONICAL_URL = "https://spreadsheets.diyaccounting.co.uk/diya-gl.html";
const PAGE_TITLE = "The DIYA-GL format - DIY Accounting Spreadsheets";
const PAGE_DESCRIPTION =
  "The diya-gl accounting file format: the fields it declares and the XBRL GL 2015 element each one comes from, the SA103S box every computed figure lands in, the check catalogue, the zip layout and the reconciliation evidence.";

// The package name each declared product is calculated under.
const PACKAGE_OF_PRODUCT = { BasicSoleTrader: "bst", TaxiDriver: "taxi", SelfEmployed: "se", Company: "ltd" };
const PRODUCT_NAMES = { bst: "Basic Sole Trader", taxi: "Taxi Driver", se: "Self Employed", ltd: "Limited Company" };
const PRODUCT_ORDER = ["bst", "taxi", "se", "ltd"];

// ── Reading the schemas ─────────────────────────────────────────────────────

// The marker a schema description opens with: the GL element the field is
// taken from, or the diya-gl: extension label for a field the framework has
// no element for.
const ELEMENT_MARKER =
  /^(?:Adapted from\s+)?((?:gl-[a-z]{3}(?::[A-Za-z]+)?)(?:\s*\+\s*gl-[a-z]{3}(?::[A-Za-z]+)?)*|diya-gl: extension)\s*(?:—|--)\s*([\s\S]*)$/;
const ELEMENT_TOKEN = /gl-[a-z]{3}:[A-Za-z]+/;
const EXTENSION = "diya-gl: extension";

function resolveRef(schema, node) {
  if (!node || !node.$ref) return node;
  const name = node.$ref.replace("#/$defs/", "");
  return schema.$defs[name];
}

// A field's element and its meaning, read from the description: the leading
// marker where there is one, otherwise the first GL element the description
// names, otherwise the extension label inherited from the table above it.
function elementOf(description, inherited) {
  const marked = ELEMENT_MARKER.exec(description);
  if (marked) return { element: marked[1], meaning: marked[2].trim() };
  const named = ELEMENT_TOKEN.exec(description);
  if (named) return { element: named[0], meaning: description.trim() };
  return { element: inherited || "", meaning: description.trim() };
}

function typeLabel(node) {
  if (node.type === "array") return "array of tables";
  if (node.type === "object") return "table";
  if (node.enum) return `${node.type}, one of ${node.enum.length}`;
  return node.type || "";
}

// Every field the schema declares, depth first, in declaration order.
function fieldsOf(schema, node, path, inherited, rows) {
  const resolved = resolveRef(schema, node);
  const required = resolved.required || [];
  for (const [key, rawChild] of Object.entries(resolved.properties || {})) {
    const child = resolveRef(schema, rawChild);
    const childPath = path ? `${path}.${key}` : key;
    const { element, meaning } = elementOf(child.description || "", inherited);
    rows.push({
      path: childPath,
      type: typeLabel(child),
      required: required.includes(key),
      element,
      meaning,
    });
    const passDown = element === EXTENSION ? EXTENSION : inherited;
    // A section keyed by account code holds one account definition per key;
    // that definition is a table of its own rather than 4,000 repeated rows.
    if (child.type === "object" && child.properties) fieldsOf(schema, child, childPath, passDown, rows);
    if (child.type === "array") {
      const items = resolveRef(schema, child.items);
      if (items && items.properties) fieldsOf(schema, items, `${childPath}[]`, passDown, rows);
    }
  }
  return rows;
}

function loadSchemas() {
  const book = JSON.parse(readFileSync(resolve(SCHEMA_DIR, "diya-gl-book-v2.schema.json"), "utf8"));
  const lines = JSON.parse(readFileSync(resolve(SCHEMA_DIR, "diya-gl-lines-v2.schema.json"), "utf8"));
  return { book, lines };
}

// The three groups the field tables are shown in: the book's document info,
// the book's chart of accounts and its registers, and the transaction lines.
function fieldGroups({ book, lines }) {
  const bookRows = fieldsOf(book, book, "", "", []);
  const documentInfo = bookRows.filter((row) => row.path.startsWith("documentInfo") || row.path.startsWith("entityInformation"));
  const registers = bookRows.filter((row) => !documentInfo.includes(row));
  const accountDefinition = fieldsOf(book, book.$defs.accountDefinition, "", "", []);
  const lineRows = fieldsOf(lines, lines, "", "", []);
  return [
    {
      id: "document-info",
      title: "Document info",
      tables: [
        {
          note: "The two tables at the head of book.toml: what period the file covers, and whose business it is.",
          rows: documentInfo,
        },
      ],
    },
    {
      id: "accounts",
      title: "Accounts and registers",
      tables: [
        {
          note:
            "The chart of accounts, the registers a year-end needs (assets, hire purchase, members, charges) and the tax rates the period " +
            "was calculated at. The rate tables hold HMRC's published figures for the year; the framework has no element for a rate table, " +
            "so those rows name none.",
          rows: registers,
        },
        {
          heading: "One account",
          note: "Each four-digit account code in a section holds one of these.",
          rows: accountDefinition,
        },
      ],
    },
    {
      id: "lines",
      title: "Transaction lines",
      tables: [
        {
          note:
            "One JSON object per line of lines.jsonl. Four fields are required on every line, and a journal line must also say which side " +
            "it posts.",
          rows: lineRows,
        },
      ],
    },
  ];
}

// ── The SA103S boxes ────────────────────────────────────────────────────────

// What a product does with a box: read a workbook cell, work it out from the
// profit and loss account, or leave it blank.
function boxTreatment(box) {
  if (box.cell) return "figure";
  if (box.derived || box.rule) return "derived";
  return "blank";
}

function sa103sBoxes() {
  const layouts = {};
  for (const product of ["bst", "taxi", "se"]) {
    layouts[product] = JSON.parse(readFileSync(resolve(HMRC_DIR, "form-layouts", `${product}.json`), "utf8"));
  }
  const mapping = JSON.parse(readFileSync(resolve(HMRC_DIR, "sa103-mtd-mapping.json"), "utf8"));
  const apiField = new Map();
  for (const entry of mapping.boxes) if (entry.form === "SA103S" && entry.field) apiField.set(entry.box, entry.field);

  const rows = new Map();
  for (const [product, layout] of Object.entries(layouts)) {
    const form = layout.forms.sa103s;
    for (const section of form.sections) {
      for (const box of section.boxes) {
        if (!rows.has(box.box)) {
          rows.set(box.box, { box: box.box, heading: section.heading, label: box.label, products: {}, field: apiField.get(box.box) || "" });
        }
        rows.get(box.box).products[product] = boxTreatment(box);
      }
    }
  }
  const year = layouts.bst.forms.sa103s.year;
  return { rows: [...rows.values()], year, source: mapping.source };
}

// ── The check catalogue ─────────────────────────────────────────────────────

// What each check reads, in the page's own words. A check the code runs and
// this table has no line for stops the build, so the catalogue cannot fall
// behind the engine.
const CHECK_DESCRIPTIONS = {
  "book-dates-in-period": "Every entry is dated inside the accounting period the book declares.",
  "book-accounts-in-chart": "Every entry reaches an account the book's chart of accounts declares.",
  "book-amounts-whole-pence": "Every amount is a whole number of pence.",
  "book-bank-account-has-workbook": "Every bank entry is on an account the package keeps a workbook for.",
  "book-bank-code-analysed": "Every bank entry is coded to a column its workbook analyses.",
  "book-bank-line-has-side": "Every bank entry says whether it is a receipt or a payment.",
  "book-payslip-names-employee": "Every payslip names someone the book employs.",
  "book-fixed-asset-rows-fit": "Every asset, disposal and hire purchase agreement has a row on the fixed asset schedule.",
  "book-ltd-bank-line-has-side": "Every bank entry says whether it is a receipt or a payment.",
  "book-ltd-bank-code-analysed": "Every bank entry is coded to a column its workbook analyses.",
  "book-ltd-straddling-line-has-vat-period": "Every sale and purchase dated outside the period names the VAT return period it belongs to.",
  "book-ltd-payroll-line-names-employee": "Every payroll entry names someone on the payroll.",
  "book-ltd-fixed-asset-rows-fit-schedule": "Every asset, disposal and hire purchase agreement has a row on the fixed asset schedule.",
  "book-vat-threshold": "Turnover for the year against the VAT registration threshold for that year.",
  "book-duplicate-entries": "No two entries share the same journal, date, amount and detail without being each other's two sides.",
  "book-empty-detail": "Every entry names who or what it was with.",
  "book-negative-amount": "Every sale and purchase amount is zero or more.",
  "book-empty-month": "Every month between the first and last entry has at least one entry.",
  "book-cash-never-overdrawn": "The cash book closes every month at zero or more.",
  "book-bank-overdrawn": "The bank book closes every month at zero or more.",
  "book-employee-paid-every-month": "Every employee is paid in each month between their first and last payslip.",
  "book-taxi-fare-miles": "Every fare day that carries miles elsewhere carries its own.",
  "book-taxi-vehicle-register": "Every vehicle bought is on the fixed asset register.",
  "book-taxi-miles-band": "Business miles stay inside the higher-rate mileage band.",
  "book-ltd-transfer-has-counter-leg": "Every transfer between the company's own accounts appears on both of them.",
  "book-ltd-dividend-within-distributable-profits": "Dividends declared against the retained profits available to pay them.",
  "book-ltd-cis-on-subcontractor-line": "Every CIS deduction sits on a sub-contractor purchase.",
};

// One example book per product, taken in path order so the same book is read
// on every run.
function exampleBooksByProduct() {
  const found = {};
  const walk = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      if (!statSync(path).isDirectory()) continue;
      if (existsSync(join(path, "book.toml")) && existsSync(join(path, "lines.jsonl"))) {
        const book = readFileSync(join(path, "book.toml"), "utf8");
        const declared = /"diya-gl:product"\s*=\s*"([A-Za-z]+)"/.exec(book);
        const packageName = declared && PACKAGE_OF_PRODUCT[declared[1]];
        if (packageName && !found[packageName]) found[packageName] = path;
      }
      walk(path);
    }
  };
  walk(EXAMPLES_DIR);
  const missing = PRODUCT_ORDER.filter((product) => !found[product]);
  if (missing.length > 0) throw new Error(`No example book found for: ${missing.join(", ")}`);
  return found;
}

function checkCatalogue() {
  const byProduct = exampleBooksByProduct();
  const catalogue = new Map();
  for (const packageName of PRODUCT_ORDER) {
    const { book, lines } = loadDiyaGlData(byProduct[packageName]);
    const taxData = extractTaxDataFromBook(book, packageName);
    const scenario = diyaGlToScenario(book, lines, packageName);
    const results = calculateFromDiyaGl(book, lines, packageName, taxData, scenario);
    for (const result of runBookChecks({ book, lines, taxData, results }).results) {
      if (!catalogue.has(result.id)) catalogue.set(result.id, { id: result.id, tier: result.tier, products: [] });
      catalogue.get(result.id).products.push(packageName);
    }
  }
  const rows = [...catalogue.values()];
  const undescribed = rows.filter((row) => !CHECK_DESCRIPTIONS[row.id]).map((row) => row.id);
  if (undescribed.length > 0) {
    throw new Error(`The check catalogue has no description for: ${undescribed.join(", ")}. Add one to CHECK_DESCRIPTIONS.`);
  }
  const stale = Object.keys(CHECK_DESCRIPTIONS).filter((id) => !catalogue.has(id));
  if (stale.length > 0) {
    throw new Error(`CHECK_DESCRIPTIONS describes checks the engine no longer runs: ${stale.join(", ")}. Remove them.`);
  }
  // Shared rules first, then each product's own, and alphabetically inside
  // each group so a new check lands in a stable place.
  const shared = rows.filter((row) => row.products.length === PRODUCT_ORDER.length);
  const own = rows.filter((row) => row.products.length < PRODUCT_ORDER.length);
  const byId = (a, b) => (a.id < b.id ? -1 : 1);
  const byTier = (a, b) => (a.tier === b.tier ? byId(a, b) : a.tier === "check" ? -1 : 1);
  return shared.sort(byTier).concat(own.sort(byTier));
}

// ── The zip layout and the format version ───────────────────────────────────

const ZIP_ENTRY_NOTES = {
  "book.toml": "The business, the period, the chart of accounts and the registers. Always written.",
  "lines.jsonl": "One transaction per line, in canonical order. Always written.",
  "report.json": "Every figure the engine computed from the two files above, keyed by its cell reference. Always written.",
  "bookchecks.json": "The result of every check and warning in the catalogue above, sorted by id. Written when the writer has run them.",
  "overtyped.json": "Any cell a person typed over in the workbook, so the next generation keeps it. Written when there is one.",
};

// The zip's entries, the format name and the format version, read out of the
// module that writes them.
function interchangeFacts() {
  const source = readFileSync(resolve(ROOT, "app", "lib", "books-interchange.js"), "utf8");
  const writer = source.slice(source.indexOf("export async function writeDiyaGlZip"));
  const entries = [...writer.matchAll(/zip\.file\("([^"]+)"/g)].map((match) => match[1]);
  if (entries.length === 0) throw new Error("No zip entries found in writeDiyaGlZip.");
  const undescribed = entries.filter((entry) => !ZIP_ENTRY_NOTES[entry]);
  if (undescribed.length > 0) throw new Error(`The zip layout has no note for: ${undescribed.join(", ")}. Add one to ZIP_ENTRY_NOTES.`);
  const format = /const JSON_FORMAT = "([^"]+)"/.exec(source);
  const version = /const JSON_VERSION = (\d+)/.exec(source);
  if (!format || !version) throw new Error("The format name and version are no longer literals in books-interchange.js.");
  return { entries, format: format[1], version: version[1] };
}

// ── The reconciliation evidence ─────────────────────────────────────────────

function reconciliationScorecards() {
  if (!existsSync(RECONCILIATION_DIR)) return [];
  return readdirSync(RECONCILIATION_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(resolve(RECONCILIATION_DIR, file), "utf8")))
    .filter((card) => PRODUCT_ORDER.includes(card.product))
    .sort((a, b) => PRODUCT_ORDER.indexOf(a.product) - PRODUCT_ORDER.indexOf(b.product));
}

// ── Rendering ───────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function table(headings, rows, className = "spec-table") {
  const head = headings.map((heading) => `<th>${escapeHtml(heading)}</th>`).join("");
  const body = rows.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("\n            ");
  return [
    '        <div class="spec-scroll">',
    `          <table class="${className}">`,
    `            <thead><tr>${head}</tr></thead>`,
    `            <tbody>`,
    `            ${body}`,
    "            </tbody>",
    "          </table>",
    "        </div>",
  ].join("\n");
}

function code(value) {
  return `<code>${escapeHtml(value)}</code>`;
}

function fieldRow(row) {
  return [
    code(row.path),
    escapeHtml(row.type),
    row.element === EXTENSION ? "<em>diya-gl extension</em>" : row.element ? code(row.element) : "&mdash;",
    escapeHtml(row.meaning) || "&mdash;",
    row.required ? "required" : "optional",
  ];
}

function buildPage() {
  const schemas = loadSchemas();
  const groups = fieldGroups(schemas);
  const boxes = sa103sBoxes();
  const checks = checkCatalogue();
  const zip = interchangeFacts();
  const scorecards = reconciliationScorecards();

  const allFields = groups.flatMap((group) => group.tables.flatMap((part) => part.rows));
  const glElements = new Set();
  for (const row of allFields) {
    for (const token of row.element.split("+")) {
      const trimmed = token.trim();
      if (trimmed && trimmed !== EXTENSION) glElements.add(trimmed);
    }
  }
  const extensionCount = allFields.filter((row) => row.element === EXTENSION).length;
  const checkCount = checks.filter((row) => row.tier === "check").length;
  const warningCount = checks.filter((row) => row.tier === "warning").length;
  const boxesWithField = boxes.rows.filter((row) => row.field).length;

  const sections = [];

  sections.push(`      <h3 id="what-it-is">What DIYA-GL is</h3>
      <p>
        DIYA-GL is the file format behind DIY Accounting's DIYA-GL pages, its command line tools and the spreadsheets it generates. A whole
        year of a small business's accounts is two text files in a zip. <code>book.toml</code> says who the business is, what period the
        books cover and what the chart of accounts holds. <code>lines.jsonl</code> holds one transaction per line. A sole trader's year
        runs to about 15 KB.
      </p>
      <p>
        It is for people who want to own their accounting data outright. You can read it in a text editor, keep it in git and see what
        changed, and recalculate it in a browser or on a command line without Excel and without a server. This page is the specification:
        the fields, the figures they compute, the checks they have to pass, the zip they travel in, and the evidence that the figures agree
        with the spreadsheets we have shipped for twenty years.
      </p>`);

  sections.push(`      <h3 id="declared-subset">The declared subset</h3>
      <p>
        Every field name in the two schemas is taken from the XBRL Global Ledger Taxonomy Framework 2015, the XBRL Standards Board's
        recommendation of 25 March 2015. The tables below name the element each field comes from.
      </p>
      <p>
        That is a lineage and a published mapping, and this page claims nothing past what the tables show. XBRL GL runs no conformance
        programme and issues no certificate for a data format. A diya-gl file is TOML and JSON Lines; it is not an XBRL instance document,
        and no XBRL processor reads it.
      </p>
      <p>
        The format names ${glElements.size} elements, from four of the framework's modules: <code>gl-cor</code> (core),
        <code>gl-bus</code> (business), <code>gl-muc</code> (multicurrency) and <code>gl-taf</code> (tax audit file). No other element of
        the framework is named in either schema. The framework's nested tuples are flattened: an entry header and its detail are one line,
        and <code>gl-cor:account</code> becomes the pair <code>accountMainID</code> and <code>accountMainDescription</code>. Where a UK
        small business needs something the framework has no element for, the schema declares a diya-gl extension: a
        <code>diya-gl:</code> prefix on a field, or a whole table marked as one. There are ${extensionCount} extension fields, and the tables
        below mark every one.
      </p>
      <p>
        The schemas themselves are published beside this page:
        <a href="schema/diya-gl-book-v2.schema.json">diya-gl-book-v2.schema.json</a> and
        <a href="schema/diya-gl-lines-v2.schema.json">diya-gl-lines-v2.schema.json</a>, both JSON Schema draft 2020-12. A longer commentary
        on the mapping is in <a href="schema/diya-gl-docs.md">diya-gl-docs.md</a>.
      </p>`);

  for (const group of groups) {
    const body = group.tables
      .map(
        (part) =>
          (part.heading ? `      <h5>${escapeHtml(part.heading)}</h5>\n` : "") +
          `      <p>${escapeHtml(part.note)}</p>\n` +
          table(["Field", "Type", "XBRL GL 2015 element", "Meaning", "Required"], part.rows.map(fieldRow)),
      )
      .join("\n");
    sections.push(`      <h4 id="${group.id}">${escapeHtml(group.title)}</h4>\n${body}`);
  }

  const boxRow = (row) => [
    code(row.box),
    escapeHtml(row.label),
    ...["bst", "taxi", "se"].map((product) => escapeHtml(row.products[product] || "&mdash;")),
    row.field ? code(row.field) : "&mdash;",
  ];
  sections.push(`      <h3 id="sa103s">Computed figures and their SA103S boxes</h3>
      <p>
        The three sole trader products fill the short self-employment pages, SA103S. The table gives every box on the ${boxes.year} form.
        <em>figure</em> means the product computes the box. <em>derived</em> means the page works it out from the profit and loss account.
        <em>blank</em> means the format carries nothing for that box, so it prints empty. Box numbers follow the ${boxes.year} form; nothing
        here is the HMRC document itself.
      </p>
      <p>
        The last column is HMRC's own field name for the box in the Making Tax Digital Self Employment Business API, from HMRC's published
        SA103 mapping (<a href="${escapeHtml(boxes.source.url)}">${escapeHtml(boxes.source.csv)}</a>, read ${escapeHtml(boxes.source.read)}).
        ${boxesWithField} of the ${boxes.rows.length} boxes have one.
      </p>
      <p>
        Self Employed books fill the full pages, SA103F, as well, and both they and Limited Company books fill a VAT return. Limited Company
        books file a CT600 and micro-entity accounts rather than SA103S. Every one of those views is on the product's own DIYA-GL page, and
        the figures behind them are on its <a href="reconciliation/index.html">reconciliation scorecard</a>.
      </p>
${table(["Box", "Label", "Basic Sole Trader", "Taxi Driver", "Self Employed", "MTD API field"], boxes.rows.map(boxRow))}`);

  const checkRow = (row) => [
    code(row.id),
    escapeHtml(CHECK_DESCRIPTIONS[row.id]),
    row.tier === "check" ? "check" : "warning",
    row.products.length === PRODUCT_ORDER.length ? "all" : row.products.map((product) => PRODUCT_NAMES[product]).join(", "),
  ];
  sections.push(`      <h3 id="checks">The check catalogue</h3>
      <p>
        A book is read in three stages. The two JSON Schemas validate <code>book.toml</code> and every line of <code>lines.jsonl</code>. The
        validator then refuses a file whose lines reach an account the book does not declare, or name a hire purchase agreement, an asset or
        a member the registers do not hold. Last, the ${checks.length} book checks below run over the data itself.
      </p>
      <p>
        A <strong>check</strong> passes or fails, and a failure names the entries that caused it; ${checkCount} of the rules are checks. A
        <strong>warning</strong> passes or warns and never blocks a save; ${warningCount} of them are warnings. Which rules a book runs
        depends on the product it declares. Every result is written to <code>bookchecks.json</code> in the zip.
      </p>
      <p>
        Beside these, the engine runs its reconciliation checks: one for every figure the workbook and the engine both compute, compared to
        the penny. Those depend on the books in hand rather than on the format, and every one of them is published on the scorecards below.
      </p>
${table(["Id", "What it reads", "Severity", "Products"], checks.map(checkRow))}`);

  const zipRow = (entry) => [code(entry), escapeHtml(ZIP_ENTRY_NOTES[entry])];
  sections.push(`      <h3 id="zip">The zip layout</h3>
      <p>The zip has no directories. Its entries are:</p>
${table(["Entry", "What it holds"], zip.entries.map(zipRow))}
      <p>
        Two writes of the same book produce the same bytes, on any machine and in any of the three surfaces (the browser page, the command
        line tool and the MCP server). The rules that make that hold:
      </p>
      <ul>
        <li>Lines sort by posting date, then source journal, account, entry number, line number, document reference and amount.</li>
        <li>Fields within a line follow the order the lines schema declares them in, and a field with no value is left out.</li>
        <li><code>book.toml</code> follows the book schema's table and key order, and every array of tables sorts by its own id field.</li>
        <li>Money carries exactly two decimal places and a rate exactly four, trailing zeroes included.</li>
        <li>Dates are ISO 8601, <code>YYYY-MM-DD</code>, with no time.</li>
        <li>Every zip entry is stamped 1 January 1980, so the timestamp never varies between two writes.</li>
      </ul>
      <p>
        The same book and lines also travel as one JSON file, with a
        <code>{ "format": "${escapeHtml(zip.format)}", "version": ${escapeHtml(zip.version)}, "product": ..., "book": ..., "lines": [...] }</code>
        envelope, and as that JSON zipped. The DIYA-GL pages read all three, plus a workbook and a package zip.
      </p>`);

  const stampRows = [
    [
      "format version",
      `<code>${escapeHtml(zip.format)}</code> ${escapeHtml(zip.version)}`,
      "Can this tool read this file",
      "written today",
    ],
    ["engine version", "the package version, and the commit it was built from", "Which code produced these figures", "written today"],
    ["tax-data version", "a hash over the year's rate files", "Which rates were applied", "written today"],
    ["template version", "a hash over the product's workbook templates", "Which workbook this reproduces", "written today"],
    [
      "reconciled commit",
      "the commit whose reconciliation run passed",
      "The proof this release rests on",
      "written by the reconciliation workflows' commit job, empty until the first one runs",
    ],
  ];
  sections.push(`      <h3 id="versioning">Versioning and provenance</h3>
      <p>
        The format is <code>${escapeHtml(zip.format)}</code> version ${escapeHtml(zip.version)}. The two schemas are at v2, and the version is
        part of each schema's <code>$id</code> URL. A v1 existed but nothing outside this repository ever read it, so v2 replaced it in place.
      </p>
      <p>
        Five stamps sit in the book's document info and at the head of <code>report.json</code>. They answer the question a file raises
        years later. Recalculate a 2026 book in 2030 and it either reproduces its <code>report.json</code> byte for byte, or names the
        stamp that differs.
      </p>
${table(
  ["Stamp", "Value", "What it answers", "Status"],
  stampRows.map((row) => [escapeHtml(row[0]), row[1], escapeHtml(row[2]), escapeHtml(row[3])]),
)}`);

  // A scorecard's status, run count and date move with every generate run, so
  // they stay on the scorecard; this table carries what does not move.
  const scorecardRow = (card) => [
    `<a href="reconciliation/${escapeHtml(card.page)}">${escapeHtml(card.name)}</a>`,
    escapeHtml(card.featuredScenario),
  ];
  sections.push(`      <h3 id="evidence">Reconciliation evidence</h3>
      <p>
        Every figure this format computes is checked against the same figure in the spreadsheet. For each product, CI generates the
        package from a set of books, recalculates the workbook in LibreOffice, computes the same figures from the diya-gl data alone, and
        compares the two to the penny. Each scorecard carries the whole run: its status, the checks, the input transactions, screenshots
        of the recalculated sheets, the accounting statements and the tax review.
      </p>
${table(["Product", "Featured scenario"], scorecards.map(scorecardRow))}
      <p><a href="reconciliation/index.html">All reconciliation reports</a></p>`);

  sections.push(`      <h3 id="tools">Getting the tools</h3>
      <p>
        The DIYA-GL pages read and write the format in your browser. Nothing you load leaves the machine.
      </p>
      <ul>
        <li><a href="books/bst.html">Basic Sole Trader books</a></li>
        <li><a href="books/taxi.html">Taxi Driver books</a></li>
        <li><a href="books/se.html">Self Employed books</a></li>
        <li><a href="books/ltd.html">Limited Company books</a></li>
      </ul>
      <p>
        The same engine runs on the command line and as an MCP server, published as the npm package
        <code>@diy-accounting-uk/diya-gl</code>. It is not on npm yet; this page will carry the install line when it is.
      </p>
      <p>
        The spreadsheets themselves stay free to download on a donation basis. <a href="download.html">Download a package</a>, or
        <a href="donate.html">chip in</a> if the tools earn it.
      </p>`);

  const toc = [
    ["what-it-is", "What DIYA-GL is"],
    ["declared-subset", "The declared subset"],
    ["sa103s", "Computed figures and their SA103S boxes"],
    ["checks", "The check catalogue"],
    ["zip", "The zip layout"],
    ["versioning", "Versioning and provenance"],
    ["evidence", "Reconciliation evidence"],
    ["tools", "Getting the tools"],
  ];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(PAGE_TITLE)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(PAGE_DESCRIPTION)}" />
    <link rel="icon" type="image/svg+xml" href="favicon.svg" />
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
    <meta property="og:title" content="${escapeHtml(PAGE_TITLE)}" />
    <meta property="og:description" content="${escapeHtml(PAGE_DESCRIPTION)}" />
    <meta property="og:url" content="${CANONICAL_URL}" />
    <meta property="og:site_name" content="DIY Accounting" />
    <meta property="og:type" content="website" />
    <link rel="canonical" href="${CANONICAL_URL}" />
    <link rel="stylesheet" href="spreadsheets.css" />
    <style>
      .spec-scroll { overflow-x: auto; }
      .spec-table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 0.9em; }
      .spec-table th, .spec-table td { border: 1px solid #ddd; padding: 0.35em 0.6em; text-align: left; vertical-align: top; }
      .spec-table th { background: #f5f5f5; font-weight: 600; }
      .spec-table code { white-space: nowrap; }
      .spec-toc { margin: 1em 0 2em; padding: 0.8em 1em; background: #f7f7f7; border-radius: 4px; }
      .spec-toc ol { margin: 0; padding-left: 1.4em; }
    </style>
    <script src="lib/analytics.js"></script>
    <script src="lib/consent-banner.js"></script>
  </head>
  <body>
    <a href="#mainContent" class="skip-link">Skip to main content</a>

    <nav class="top-nav" aria-label="Main navigation">
      <a href="index.html">Products</a>
      <a href="download.html">Download</a>
      <a href="knowledge-base.html">Knowledge Base</a>
      <a href="community.html">Community</a>
      <a href="https://submit.diyaccounting.co.uk">Submit VAT MTD</a>
      <a href="donate.html">Donate</a>
    </nav>

    <header>
      <h1>DIY Accounting Spreadsheets</h1>
      <p class="subtitle">Excel bookkeeping and accounting software for UK small businesses</p>
    </header>

    <main id="mainContent">
      <nav class="nav-back" aria-label="Breadcrumb"><a href="index.html">&larr; Products</a></nav>

      <h2 class="kb-page-title">The DIYA-GL format</h2>
      <p class="kb-page-description">A year of accounts in two text files, and the mapping, the checks and the evidence behind them.</p>

      <nav class="spec-toc" aria-label="On this page">
        <ol>
${toc.map(([id, title]) => `          <li><a href="#${id}">${escapeHtml(title)}</a></li>`).join("\n")}
        </ol>
      </nav>

${sections.join("\n\n")}
    </main>

    <footer>
      <div class="footer-content">
        <div class="footer-left">
          <a href="https://diyaccounting.co.uk">diyaccounting.co.uk</a>
          <a href="knowledge-base.html">knowledge base</a>
          <a href="reconciliation/index.html">reconciliation</a>
          <a href="https://submit.diyaccounting.co.uk/privacy.html">privacy</a>
          <a href="https://submit.diyaccounting.co.uk/terms.html">terms</a>
          <a href="https://submit.diyaccounting.co.uk/accessibility.html">accessibility</a>
        </div>
        <div class="footer-center">
          <p>&copy; 2025-2026 DIY Accounting Limited</p>
        </div>
      </div>
    </footer>
  </body>
</html>
`;
}

/**
 * The diya-gl specification page, built from the schemas, the HMRC form
 * layouts, the check catalogue, the interchange writer and the published
 * reconciliation scorecards.
 * @returns {string} the whole HTML document
 */
export function buildDiyaGlSpecHtml() {
  return buildPage();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const html = buildDiyaGlSpecHtml();
  writeFileSync(OUT_PATH, html, "utf8");
  console.log(`diya-gl spec page: ${OUT_PATH} (${html.length} bytes)`);
}
