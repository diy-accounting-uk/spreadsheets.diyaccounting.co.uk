#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// build-reconciliation-pages.js — Build the published reconciliation pages.
//
// Usage:
//   node app/bin/build-reconciliation-pages.js --product ltd
//   node app/bin/build-reconciliation-pages.js --product all --no-screenshots
//   node app/bin/build-reconciliation-pages.js --index-only
//
// Reads:  reports/*.md
//         app/test/fixtures/<scenario>.toml
//         examples/<product>-latest/*.xlsx
// Writes: web/spreadsheets.diyaccounting.co.uk/public/reconciliation/<product>.html
//         web/spreadsheets.diyaccounting.co.uk/public/reconciliation/<product>.json
//         web/spreadsheets.diyaccounting.co.uk/public/reconciliation/screenshots/*.png
//         web/spreadsheets.diyaccounting.co.uk/public/reconciliation/index.html

import { execFileSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { loadScenario, MONTH_SHEETS } from "../lib/scenario-loader.js";
import { getLibreOffice } from "../lib/spreadsheet-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const REPORTS_DIR = resolve(ROOT, "reports");
const FIXTURES_DIR = resolve(ROOT, "app", "test", "fixtures");
const EXAMPLES_DIR = resolve(ROOT, "examples");
const OUT_DIR = resolve(ROOT, "web", "spreadsheets.diyaccounting.co.uk", "public", "reconciliation");

// ── Product configuration ───────────────────────────────────────────────────

const PRODUCTS = {
  taxi: {
    name: "Taxi Driver",
    reportPrefix: "GB_Accounts_Taxi_Driver",
    featuredScenario: "taxi-scenario-basic",
    examples: "taxi-latest",
    catalogue: "GB Accounts Taxi Driver",
    screenshots: [
      { file: "GB_Accounts_Taxi_Driver.xlsx", sheet: "Profit & Loss Acc", caption: "Profit and loss account" },
      { file: "GB_Accounts_Taxi_Driver.xlsx", sheet: "Draft Tax calculation", caption: "Draft tax calculation" },
      { file: "GB_Accounts_Taxi_Driver.xlsx", sheet: "SE Short", caption: "Self assessment short pages" },
    ],
  },
  bst: {
    name: "Basic Sole Trader",
    reportPrefix: "GB_Accounts_Basic_Sole_Trader",
    featuredScenario: "bst-scenario-basic",
    examples: "bst-latest",
    catalogue: "GB Accounts Basic Sole Trader",
    screenshots: [
      { file: "GB_Accounts_Basic_Sole_Trader.xlsx", sheet: "Profit & Loss Acc", caption: "Profit and loss account" },
      { file: "GB_Accounts_Basic_Sole_Trader.xlsx", sheet: "Income Tax", caption: "Income tax calculation" },
      { file: "GB_Accounts_Basic_Sole_Trader.xlsx", sheet: "SE Short", caption: "Self assessment short pages" },
      { file: "GB_Accounts_Basic_Sole_Trader.xlsx", sheet: "Debtors & Creditors", caption: "Debtors and creditors" },
    ],
  },
  se: {
    name: "Self Employed",
    reportPrefix: "GB_Accounts_Self_Employed",
    featuredScenario: "se-scenario-advanced",
    examples: "se-latest",
    catalogue: "GB Accounts Self Employed",
    screenshots: [
      { file: "Financialaccounts.xlsx", sheet: "Profit & Loss Account", caption: "Profit and loss account" },
      { file: "Financialaccounts.xlsx", sheet: "Income Tax", caption: "Income tax calculation" },
      { file: "Financialaccounts.xlsx", sheet: "SE Short", caption: "Self assessment short pages" },
      { file: "Vat.xlsx", sheet: "VATQtr1", caption: "VAT return, quarter 1" },
      { file: "Fixedassets.xlsx", sheet: "Schedule", caption: "Fixed asset schedule" },
    ],
  },
  ltd: {
    name: "Limited Company",
    reportPrefix: "GB_Accounts_Company",
    featuredScenario: "ltd-scenario-full",
    examples: "ltd-latest",
    catalogue: "GB Accounts Company",
    screenshots: [
      { file: "Financialaccounts.xlsx", sheet: "MnthP&L", caption: "Monthly profit and loss" },
      { file: "Financialaccounts.xlsx", sheet: "PubP&L", caption: "Published profit and loss" },
      { file: "Financialaccounts.xlsx", sheet: "PubBalSht", caption: "Published balance sheet" },
      { file: "Financialaccounts.xlsx", sheet: "CorporationTax", caption: "Corporation tax computation" },
      { file: "Vatreturns.xlsx", sheet: "VATQtr1", caption: "VAT return, quarter 1" },
      { file: "Fixedassets.xlsx", sheet: "Schedule", caption: "Fixed asset schedule" },
    ],
  },
};

const PRODUCT_ORDER = ["taxi", "bst", "se", "ltd"];

// The six page sections, in the order every product page follows.
const PAGE_SECTIONS = [
  { id: "summary", title: "Summary" },
  { id: "reconciliation-checks", title: "Reconciliation checks" },
  { id: "input-transactions", title: "Input transactions" },
  { id: "screenshots", title: "Screenshots" },
  { id: "accounting-statements", title: "Accounting statements" },
  { id: "tax-review", title: "Tax review" },
];

// Report sections that belong under Tax review rather than Accounting statements.
const TAX_SECTION_PATTERNS = [/corporation tax/i, /income tax/i, /draft tax/i, /self assessment/i];

// The feature ladder shown on the index matrix, in a fixed order for every product.
const FEATURES = [
  { key: "checks", label: "Reconciliation checks" },
  { key: "sales", label: "Sales journal" },
  { key: "purchases", label: "Purchase journal" },
  { key: "bank", label: "Bank and cash" },
  { key: "payroll", label: "Payroll" },
  { key: "openingBalances", label: "Opening balances" },
  { key: "fixedAssets", label: "Fixed assets" },
  { key: "profitAndLoss", label: "Profit and loss" },
  { key: "balanceSheet", label: "Balance sheet" },
  { key: "stock", label: "Stock" },
  { key: "debtorsCreditors", label: "Debtors and creditors" },
  { key: "vat", label: "VAT quarters" },
  { key: "trialBalance", label: "Trial balance check" },
  { key: "corporationTax", label: "Corporation tax" },
  { key: "incomeTax", label: "Income tax" },
  { key: "selfAssessment", label: "Self assessment" },
  { key: "screenshots", label: "Sheet screenshots" },
];

// ── Small helpers ───────────────────────────────────────────────────────────

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Report cells carry &nbsp; indents and **bold** markers. Everything else is literal text.
function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/&amp;nbsp;/g, "&nbsp;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const numberFormat = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatAmount(value) {
  return typeof value === "number" ? numberFormat.format(value) : String(value);
}

function formatCell(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return numberFormat.format(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
}

function titleCase(key) {
  const words = String(key).replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ── Report markdown parsing ─────────────────────────────────────────────────

const REPORT_FILE_PATTERN = /^(.+?)_(\d{4})_(\d{2})_(\d{2})__([A-Za-z0-9]+)__Excel_2007_(.+)\.md$/;

function parseTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isSeparatorRow(line) {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function alignmentsFrom(separatorLine) {
  return parseTableRow(separatorLine).map((cell) => (cell.endsWith(":") ? "right" : "left"));
}

// Parses the committed report markdown by structure: the Status line, ## headings and pipe tables.
function parseReport(path) {
  const lines = readFileSync(path, "utf8").split("\n");
  const report = { title: "", scenario: "", status: "", sections: [] };
  let section = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("# ")) {
      report.title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("Scenario:")) {
      report.scenario = line.slice("Scenario:".length).trim();
      continue;
    }
    if (line.startsWith("Status:")) {
      report.status = line.slice("Status:".length).trim();
      continue;
    }
    if (line.startsWith("## ") || line.startsWith("### ")) {
      const level = line.startsWith("### ") ? 3 : 2;
      section = { name: line.replace(/^#+\s*/, "").trim(), level, blocks: [] };
      report.sections.push(section);
      continue;
    }
    if (line.trim().startsWith("|") && section) {
      const head = parseTableRow(line);
      const align = isSeparatorRow(lines[i + 1] ?? "") ? alignmentsFrom(lines[++i]) : head.map(() => "left");
      const rows = [];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) {
        rows.push(parseTableRow(lines[++i]));
      }
      section.blocks.push({ type: "table", head, align, rows });
      continue;
    }
    if (line.trim() && !line.startsWith("---") && section) {
      section.blocks.push({ type: "text", text: line.trim() });
    }
  }
  return report;
}

function loadProductReports(reportsDir, product) {
  const config = PRODUCTS[product];
  const runs = [];
  for (const file of readdirSync(reportsDir).sort()) {
    if (!file.endsWith(".md") || !file.startsWith(`${config.reportPrefix}_`)) continue;
    const match = REPORT_FILE_PATTERN.exec(file);
    if (!match) continue;
    const [, , year, month, day, label, scenario] = match;
    const path = join(reportsDir, file);
    const status = (
      readFileSync(path, "utf8")
        .split("\n")
        .find((l) => l.startsWith("Status:")) ?? ""
    )
      .slice(7)
      .trim();
    runs.push({ file, path, yearEnd: `${year}-${month}-${day}`, label, scenario, status });
  }
  runs.sort((a, b) => b.yearEnd.localeCompare(a.yearEnd));
  return runs;
}

// ── Scenario fixture rendering ──────────────────────────────────────────────

const JOURNAL_COLUMN_ORDER = ["date", "customer", "supplier", "account", "source", "description", "invoice", "code", "amount", "vat"];

function journalColumns(rows) {
  const keys = new Set();
  for (const row of rows) for (const key of Object.keys(row)) keys.add(key);
  const ordered = JOURNAL_COLUMN_ORDER.filter((key) => keys.has(key));
  for (const key of keys) if (!ordered.includes(key)) ordered.push(key);
  return ordered;
}

function journalTotal(rows) {
  return rows.reduce((total, row) => total + (typeof row.amount === "number" ? row.amount : 0), 0);
}

function monthsOf(journal) {
  return Object.keys(MONTH_SHEETS).filter((month) => Array.isArray(journal?.[month]) && journal[month].length > 0);
}

function renderJournalTable(rows) {
  const columns = journalColumns(rows);
  const head = columns.map(titleCase);
  const align = columns.map((key) => (key === "amount" ? "right" : "left"));
  const body = rows.map((row) => columns.map((key) => formatCell(row[key])));
  return renderTable({ head, align, rows: body });
}

function renderJournal(journal, heading, id) {
  const months = monthsOf(journal);
  if (months.length === 0) return "";
  const total = months.reduce((sum, month) => sum + journalTotal(journal[month]), 0);
  const count = months.reduce((sum, month) => sum + journal[month].length, 0);
  const parts = [
    `<details class="recon-details" id="${id}">`,
    `<summary>${escapeHtml(heading)}: ${count} entries, ${escapeHtml(formatAmount(total))}</summary>`,
  ];
  for (const month of months) {
    parts.push(`<h5>${escapeHtml(MONTH_SHEETS[month])}</h5>`);
    parts.push(renderJournalTable(journal[month]));
  }
  parts.push("</details>");
  return parts.join("\n");
}

function renderKeyValueTable(object) {
  const rows = Object.entries(object).map(([key, value]) => [titleCase(key), formatCell(value)]);
  return renderTable({ head: ["Item", "Value"], align: ["left", "right"], rows });
}

function renderRecordTable(records) {
  const columns = journalColumns(records);
  return renderTable({
    head: columns.map(titleCase),
    align: columns.map((key) => (key === "amount" || key === "cost" || key === "acc_dep" || key === "grossPay" ? "right" : "left")),
    rows: records.map((record) => columns.map((key) => formatCell(record[key]))),
  });
}

function renderMonthlySummary(scenario) {
  const journals = [
    ["Sales", scenario.sales],
    ["Purchases", scenario.purchases],
    ["Bank", scenario.bank],
  ].filter(([, journal]) => journal);
  if (journals.length === 0) return "";
  const head = ["Month", ...journals.flatMap(([name]) => [`${name} entries`, `${name} total`])];
  const align = head.map((_, index) => (index === 0 ? "left" : "right"));
  const rows = [];
  for (const month of Object.keys(MONTH_SHEETS)) {
    const cells = [MONTH_SHEETS[month]];
    let any = false;
    for (const [, journal] of journals) {
      const entries = journal[month] ?? [];
      if (entries.length) any = true;
      cells.push(String(entries.length), formatAmount(journalTotal(entries)));
    }
    if (any) rows.push(cells);
  }
  const totals = ["Year"];
  for (const [, journal] of journals) {
    const all = Object.keys(MONTH_SHEETS).flatMap((month) => journal[month] ?? []);
    totals.push(String(all.length), `**${formatAmount(journalTotal(all))}**`);
  }
  rows.push(totals);
  return renderTable({ head, align, rows });
}

function renderInputTransactions(scenario) {
  const parts = [];
  if (scenario.business) {
    parts.push("<h4>Business details</h4>");
    parts.push(renderKeyValueTable(scenario.business));
  }
  const summary = renderMonthlySummary(scenario);
  if (summary) {
    parts.push("<h4>Month by month</h4>");
    parts.push(summary);
  }
  const journals = [
    ["Sales journal", scenario.sales, "sales-journal"],
    ["Purchase journal", scenario.purchases, "purchase-journal"],
    ["Bank and cash entries", scenario.bank, "bank-journal"],
  ];
  const rendered = journals.map(([heading, journal, id]) => renderJournal(journal, heading, id)).filter(Boolean);
  if (rendered.length) {
    parts.push("<h4>Every entry</h4>");
    parts.push(...rendered);
  }
  if (Array.isArray(scenario.employees) && scenario.employees.length) {
    parts.push("<h4>Payroll</h4>");
    parts.push(renderRecordTable(scenario.employees));
  }
  const openings = [
    ["Opening debtors", scenario.opening_debtors],
    ["Closing debtors", scenario.closing_debtors],
    ["Opening creditors", scenario.opening_creditors],
    ["Closing creditors", scenario.closing_creditors],
    ["Opening fixed assets", scenario.opening_fixed_assets],
  ].filter(([, records]) => Array.isArray(records) && records.length);
  if (openings.length || scenario.opening_balance || scenario.stock) {
    parts.push("<h4>Opening and closing balances</h4>");
    if (scenario.opening_balance) {
      parts.push("<h5>Opening balance</h5>");
      parts.push(renderKeyValueTable(scenario.opening_balance));
    }
    if (scenario.stock) {
      parts.push("<h5>Stock</h5>");
      parts.push(renderKeyValueTable(scenario.stock));
    }
    for (const [heading, records] of openings) {
      parts.push(`<h5>${escapeHtml(heading)}</h5>`);
      parts.push(renderRecordTable(records));
    }
  }
  return parts.join("\n");
}

// ── Screenshots ─────────────────────────────────────────────────────────────

function decodeXmlAttribute(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function sheetPartPath(zip, relationshipId) {
  const relsFile = zip.file("xl/_rels/workbook.xml.rels");
  if (!relsFile) throw new Error("No xl/_rels/workbook.xml.rels");
  const rels = await relsFile.async("string");
  const pattern = new RegExp(`<Relationship[^>]*Id="${relationshipId}"[^>]*Target="([^"]*)"`);
  const match = pattern.exec(rels) ?? new RegExp(`<Relationship[^>]*Target="([^"]*)"[^>]*Id="${relationshipId}"`).exec(rels);
  if (!match) throw new Error(`No workbook relationship ${relationshipId}`);
  return `xl/${match[1].replace(/^\/?xl\//, "").replace(/^\//, "")}`;
}

// LibreOffice prints the file name, page number and today's date unless the sheet
// defines its own header and footer. Empty ones keep the image the same run to run.
function blankHeaderAndFooter(sheetXml) {
  const blank = "<headerFooter><oddHeader></oddHeader><oddFooter></oddFooter></headerFooter>";
  if (/<headerFooter[\s>]/.test(sheetXml)) {
    return sheetXml.replace(/<headerFooter\b[^>]*(?:\/>|>[\s\S]*?<\/headerFooter>)/, blank);
  }
  for (const anchor of [/<pageSetup\b[^>]*\/>/, /<\/pageSetup>/, /<pageMargins\b[^>]*\/>/]) {
    const match = anchor.exec(sheetXml);
    if (match) return sheetXml.replace(match[0], `${match[0]}${blank}`);
  }
  return sheetXml.replace("</worksheet>", `${blank}</worksheet>`);
}

// Hide every sheet but one, so LibreOffice's PDF export contains that sheet alone.
async function isolateSheet(xlsxPath, sheetName) {
  const zip = await JSZip.loadAsync(readFileSync(xlsxPath));
  const workbookFile = zip.file("xl/workbook.xml");
  if (!workbookFile) throw new Error(`No xl/workbook.xml in ${xlsxPath}`);
  let xml = await workbookFile.async("string");
  const tags = xml.match(/<sheet\b[^>]*?\/>/g) ?? [];
  let targetIndex = -1;
  let targetRelationship = null;

  tags.forEach((tag, index) => {
    const nameMatch = /name="([^"]*)"/.exec(tag);
    if (!nameMatch) return;
    const name = decodeXmlAttribute(nameMatch[1]);
    let updated;
    if (name === sheetName) {
      targetIndex = index;
      targetRelationship = /r:id="([^"]*)"/.exec(tag)?.[1] ?? null;
      updated = tag.replace(/\s+state="[^"]*"/, "");
    } else if (/\sstate="/.test(tag)) {
      updated = tag.replace(/state="[^"]*"/, 'state="hidden"');
    } else {
      updated = tag.replace(/\/>$/, ' state="hidden"/>');
    }
    xml = xml.replace(tag, () => updated);
  });

  if (targetIndex < 0) throw new Error(`Sheet "${sheetName}" not found in ${basename(xlsxPath)}`);
  xml = xml.replace(/activeTab="\d+"/, `activeTab="${targetIndex}"`);
  zip.file("xl/workbook.xml", xml);

  if (targetRelationship) {
    const path = await sheetPartPath(zip, targetRelationship);
    const sheetFile = zip.file(path);
    if (sheetFile) zip.file(path, blankHeaderAndFooter(await sheetFile.async("string")));
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function renderSheetScreenshot(xlsxPath, sheetName, outPath) {
  const workDir = mkdtempSync(join(tmpdir(), "recon-shot-"));
  try {
    const isolated = await isolateSheet(xlsxPath, sheetName);
    // The workbook name reaches the PDF page footer, so keep the real one.
    const workbookName = basename(xlsxPath);
    const sheetFile = join(workDir, workbookName);
    writeFileSync(sheetFile, isolated);
    execFileSync(
      getLibreOffice(),
      [
        "--headless",
        "--norestore",
        "--calc",
        `-env:UserInstallation=file://${join(workDir, "lo_profile")}`,
        "--convert-to",
        "pdf",
        "--outdir",
        workDir,
        sheetFile,
      ],
      { stdio: "pipe", timeout: 180000 },
    );
    const pdfPath = join(workDir, workbookName.replace(/\.xlsx$/, ".pdf"));
    if (!existsSync(pdfPath)) throw new Error(`LibreOffice produced no PDF for ${basename(xlsxPath)} ${sheetName}`);
    execFileSync("pdftoppm", ["-png", "-r", "100", "-f", "1", "-l", "1", "-singlefile", pdfPath, join(workDir, "shot")], {
      stdio: "pipe",
      timeout: 120000,
    });
    const pngPath = join(workDir, "shot.png");
    if (!existsSync(pngPath)) throw new Error(`pdftoppm produced no PNG for ${basename(xlsxPath)} ${sheetName}`);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, readFileSync(pngPath));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

async function buildScreenshots(product, outDir) {
  const config = PRODUCTS[product];
  const sourceDir = join(EXAMPLES_DIR, config.examples);
  const shots = [];
  if (!existsSync(sourceDir)) {
    console.log(`  no ${config.examples} workbooks, skipping screenshots`);
    return shots;
  }
  for (const shot of config.screenshots) {
    const xlsxPath = join(sourceDir, shot.file);
    if (!existsSync(xlsxPath)) {
      console.log(`  no ${shot.file}, skipping ${shot.sheet}`);
      continue;
    }
    const name = `${product}-${slug(shot.file.replace(/\.xlsx$/, ""))}-${slug(shot.sheet)}.png`;
    const outPath = join(outDir, "screenshots", name);
    await renderSheetScreenshot(xlsxPath, shot.sheet, outPath);
    console.log(`  screenshot ${shot.file} ${shot.sheet} -> ${name}`);
    shots.push({ ...shot, image: `screenshots/${name}` });
  }
  return shots;
}

// ── HTML rendering ──────────────────────────────────────────────────────────

// Cells are plain text unless given as { html }, which is emitted as written.
function cellContent(cell) {
  return cell !== null && typeof cell === "object" && "html" in cell ? cell.html : inlineMarkdown(cell);
}

function renderTable({ head, align, rows, className = "recon-table" }) {
  const headCells = head.map((cell, index) => `<th${align[index] === "right" ? ' class="num"' : ""}>${cellContent(cell)}</th>`).join("");
  const bodyRows = rows
    .map((row) => {
      const cells = row.map((cell, index) => `<td${align[index] === "right" ? ' class="num"' : ""}>${cellContent(cell)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("\n");
  return `<div class="recon-scroll"><table class="${className}">\n<thead><tr>${headCells}</tr></thead>\n<tbody>\n${bodyRows}\n</tbody>\n</table></div>`;
}

function renderBlocks(blocks) {
  return blocks.map((block) => (block.type === "table" ? renderTable(block) : `<p>${inlineMarkdown(block.text)}</p>`)).join("\n");
}

function renderReportSections(sections, headingLevel = 4) {
  return sections
    .map((section) => `<h${headingLevel}>${escapeHtml(section.name)}</h${headingLevel}>\n${renderBlocks(section.blocks)}`)
    .join("\n");
}

function pageShell({ title, description, canonical, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="icon" type="image/svg+xml" href="../favicon.svg" />
    <link rel="icon" type="image/x-icon" href="../favicon.ico" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:site_name" content="DIY Accounting" />
    <meta property="og:type" content="website" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <link rel="stylesheet" href="../spreadsheets.css" />
    <style>
      .recon-scroll { overflow-x: auto; }
      .recon-table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 0.9em; }
      .recon-table th, .recon-table td { border: 1px solid #ddd; padding: 0.35em 0.6em; text-align: left; vertical-align: top; }
      .recon-table th { background: #f5f5f5; font-weight: 600; }
      .recon-table th.num, .recon-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
      .recon-details { margin: 0.8em 0; border: 1px solid #ddd; border-radius: 4px; padding: 0.4em 0.8em; }
      .recon-details > summary { cursor: pointer; font-weight: 600; padding: 0.3em 0; }
      .recon-shot { margin: 1.2em 0; }
      .recon-shot img { max-width: 100%; border: 1px solid #ddd; }
      .recon-shot figcaption { font-size: 0.9em; color: #555; margin-top: 0.4em; }
      .recon-toc { margin: 1em 0 2em; padding: 0.8em 1em; background: #f7f7f7; border-radius: 4px; }
      .recon-toc ol { margin: 0; padding-left: 1.4em; }
      .recon-section { margin-top: 2.5em; }
      .recon-facts { list-style: none; padding: 0; }
      .recon-facts li { margin-bottom: 0.3em; }
    </style>
    <script src="../lib/analytics.js"></script>
  </head>
  <body>
    <a href="#mainContent" class="skip-link">Skip to main content</a>

    <nav class="top-nav" aria-label="Main navigation">
      <a href="../index.html">Products</a>
      <a href="../download.html">Download</a>
      <a href="../knowledge-base.html">Knowledge Base</a>
      <a href="../community.html">Community</a>
      <a href="https://submit.diyaccounting.co.uk">Submit VAT MTD</a>
      <a href="../donate.html">Donate</a>
    </nav>

    <header>
      <h1>DIY Accounting Spreadsheets</h1>
      <p class="subtitle">Excel bookkeeping and accounting software for UK small businesses</p>
    </header>

    <main id="mainContent">
${body}
    </main>

    <footer>
      <div class="footer-content">
        <div class="footer-left">
          <a href="https://diyaccounting.co.uk">diyaccounting.co.uk</a>
          <a href="../knowledge-base.html">knowledge base</a>
          <a href="index.html">reconciliation</a>
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

function renderSection(section, content) {
  return [
    `      <section class="recon-section" id="${section.id}">`,
    `        <h3>${escapeHtml(section.title)}</h3>`,
    content,
    "      </section>",
  ]
    .filter((part) => part !== "")
    .join("\n");
}

// ── Product page ────────────────────────────────────────────────────────────

function detectFeatures(report, scenario, shots) {
  const names = report.sections.map((section) => section.name);
  const has = (pattern) => names.some((name) => pattern.test(name));
  const shotSheets = shots.map((shot) => shot.sheet).join(" ");
  return {
    checks: has(/compliance checks/i),
    sales: Boolean(scenario.sales),
    purchases: Boolean(scenario.purchases),
    bank: Boolean(scenario.bank),
    payroll: Array.isArray(scenario.employees) && scenario.employees.length > 0,
    openingBalances: Boolean(scenario.opening_balance || scenario.opening_debtors || scenario.opening_creditors),
    fixedAssets: Array.isArray(scenario.opening_fixed_assets) && scenario.opening_fixed_assets.length > 0,
    profitAndLoss: has(/profit & loss|profit and loss/i),
    balanceSheet: has(/balance sheet/i),
    stock: has(/^stock$/i) || Boolean(scenario.stock),
    debtorsCreditors: has(/debtors/i) || Boolean(scenario.opening_debtors || scenario.opening_creditors),
    vat: has(/vat/i) || /VATQtr/.test(shotSheets),
    trialBalance: has(/trial balance/i),
    corporationTax: has(/corporation tax/i),
    incomeTax: has(/income tax|draft tax/i),
    selfAssessment: has(/self assessment/i),
    screenshots: shots.length > 0,
  };
}

function buildProductPage(product, options) {
  const config = PRODUCTS[product];
  const runs = loadProductReports(options.reportsDir, product);
  if (runs.length === 0) throw new Error(`No reports for ${product} in ${options.reportsDir}`);

  const featured = runs.find((run) => run.scenario === config.featuredScenario) ?? runs[0];
  const report = parseReport(featured.path);
  const scenario = loadScenario(join(FIXTURES_DIR, `${featured.scenario}.toml`));

  const checksSection = report.sections.find((section) => /compliance checks/i.test(section.name));
  const appendixIndex = report.sections.findIndex((section) => /^appendix/i.test(section.name));
  const bodySections = report.sections.filter((section, index) => {
    if (section === checksSection) return false;
    if (appendixIndex >= 0 && index >= appendixIndex) return false;
    return section.level === 2;
  });
  const taxSections = bodySections.filter((section) => TAX_SECTION_PATTERNS.some((pattern) => pattern.test(section.name)));
  const statementSections = bodySections.filter((section) => !taxSections.includes(section));
  const appendixSections = appendixIndex >= 0 ? report.sections.slice(appendixIndex + 1).filter((section) => section.level === 3) : [];

  return { config, runs, featured, report, scenario, checksSection, statementSections, taxSections, appendixSections };
}

function renderProductPage(product, built, shots) {
  const { config, runs, featured, report, scenario, checksSection, statementSections, taxSections, appendixSections } = built;
  const checks = checksSection?.blocks.find((block) => block.type === "table");
  const passes = checks ? checks.rows.filter((row) => /PASS/.test(row[row.length - 1])).length : 0;
  const warnings = checks ? checks.rows.filter((row) => /WARNING/.test(row[row.length - 1])).length : 0;
  const failures = checks ? checks.rows.filter((row) => /FAIL/.test(row[row.length - 1])).length : 0;

  const summary = [
    `        <ul class="recon-facts">`,
    `          <li><strong>Status:</strong> ${escapeHtml(featured.status)}</li>`,
    `          <li><strong>Featured scenario:</strong> ${escapeHtml(featured.scenario)} (${escapeHtml(scenario.metadata?.name ?? "")})</li>`,
    `          <li><strong>Year end:</strong> ${escapeHtml(featured.yearEnd)}</li>`,
    `          <li><strong>Checks:</strong> ${passes} passed, ${warnings} warnings, ${failures} failed</li>`,
    `          <li><strong>Reconciliation runs published:</strong> ${runs.length}</li>`,
    `        </ul>`,
    `        <h4>Every run</h4>`,
    renderTable({
      head: ["Year end", "Period", "Scenario", "Status"],
      align: ["left", "left", "left", "left"],
      rows: runs.map((run) => [run.yearEnd, run.label, run.scenario, run.status]),
    }),
  ].join("\n");

  const checksHtml = checksSection ? renderBlocks(checksSection.blocks) : "";

  const screenshotsHtml = shots
    .map(
      (shot) =>
        `        <figure class="recon-shot">\n          <img src="${escapeHtml(shot.image)}" alt="${escapeHtml(shot.caption)} sheet of the populated workbook" loading="lazy" />\n          <figcaption>${escapeHtml(shot.caption)} — ${escapeHtml(shot.file)}, sheet ${escapeHtml(shot.sheet)}</figcaption>\n        </figure>`,
    )
    .join("\n");

  const statementsHtml = [
    renderReportSections(statementSections),
    appendixSections.length
      ? [
          '<details class="recon-details">',
          "<summary>Cell values behind these statements</summary>",
          renderReportSections(appendixSections, 5),
          "</details>",
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const sectionContent = {
    "summary": summary,
    "reconciliation-checks": checksHtml,
    "input-transactions": renderInputTransactions(scenario),
    "screenshots": screenshotsHtml,
    "accounting-statements": statementsHtml,
    "tax-review": renderReportSections(taxSections),
  };

  const toc = [
    '      <nav class="recon-toc" aria-label="On this page">',
    "        <ol>",
    ...PAGE_SECTIONS.map((section) => `          <li><a href="#${section.id}">${escapeHtml(section.title)}</a></li>`),
    "        </ol>",
    "      </nav>",
  ].join("\n");

  const body = [
    '      <nav class="nav-back" aria-label="Breadcrumb"><a href="index.html">&larr; Reconciliation reports</a></nav>',
    `      <h2 class="kb-page-title">${escapeHtml(config.name)} reconciliation</h2>`,
    `      <p class="kb-page-description">${escapeHtml(report.title)}. Every figure below comes from a scenario driven through the shipped workbooks and read back out of the recalculated sheets.</p>`,
    toc,
    ...PAGE_SECTIONS.map((section) => renderSection(section, sectionContent[section.id])),
  ].join("\n");

  return pageShell({
    title: `${config.name} reconciliation - DIY Accounting Spreadsheets`,
    description: `Reconciliation of the DIY Accounting ${config.name} spreadsheets: input transactions, sheet screenshots, accounting statements and the tax computation.`,
    canonical: `https://spreadsheets.diyaccounting.co.uk/reconciliation/${product}.html`,
    body,
  });
}

// ── Index page ──────────────────────────────────────────────────────────────

function renderIndexPage(metadata) {
  const products = PRODUCT_ORDER.filter((product) => metadata[product]);
  const matrix = renderTable({
    head: ["Feature", ...products.map((product) => metadata[product].name)],
    align: ["left", ...products.map(() => "left")],
    rows: FEATURES.map((feature) => [feature.label, ...products.map((product) => (metadata[product].features[feature.key] ? "yes" : "—"))]),
  });

  const runsTable = renderTable({
    head: ["Product", "Featured scenario", "Year end", "Status", "Runs", "Updated"],
    align: ["left", "left", "left", "left", "right", "left"],
    rows: products.map((product) => {
      const meta = metadata[product];
      return [
        { html: `<a href="${escapeHtml(meta.page)}">${escapeHtml(meta.name)}</a>` },
        meta.featuredScenario,
        meta.yearEnd,
        meta.status,
        String(meta.runs),
        meta.updated,
      ];
    }),
  });

  const body = [
    '      <nav class="nav-back" aria-label="Breadcrumb"><a href="../index.html">&larr; Products</a></nav>',
    '      <h2 class="kb-page-title">Reconciliation reports</h2>',
    '      <p class="kb-page-description">Each product is driven with a full year of transactions, recalculated in the shipped workbooks, and read back sheet by sheet. These pages publish what went in, what the sheets produced, and how the two tie up.</p>',
    renderSection({ id: "products", title: "Products" }, runsTable),
    renderSection(
      { id: "matrix", title: "What each product reconciles" },
      `        <p>The same features are checked from product to product. The larger packages fill more of them.</p>\n${matrix}`,
    ),
  ].join("\n");

  return pageShell({
    title: "Reconciliation reports - DIY Accounting Spreadsheets",
    description:
      "Published reconciliation of the DIY Accounting spreadsheets: input transactions, sheet screenshots, accounting statements and tax computations for every product.",
    canonical: "https://spreadsheets.diyaccounting.co.uk/reconciliation/index.html",
    body,
  });
}

function buildIndex(outDir) {
  const metadata = {};
  for (const product of PRODUCT_ORDER) {
    const path = join(outDir, `${product}.json`);
    if (existsSync(path)) metadata[product] = JSON.parse(readFileSync(path, "utf8"));
  }
  const products = Object.keys(metadata);
  if (products.length === 0) {
    console.log("No product metadata, index not written");
    return;
  }
  writeFileSync(join(outDir, "index.html"), renderIndexPage(metadata), "utf8");
  console.log(`Index: ${products.length} products (${products.join(", ")})`);
}

// ── Entry point ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { product: "all", reportsDir: REPORTS_DIR, outDir: OUT_DIR, screenshots: true, indexOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--product") args.product = argv[++i];
    else if (arg === "--reports") args.reportsDir = resolve(argv[++i]);
    else if (arg === "--out") args.outDir = resolve(argv[++i]);
    else if (arg === "--no-screenshots") args.screenshots = false;
    else if (arg === "--index-only") args.indexOnly = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.product !== "all" && !PRODUCTS[args.product]) {
    throw new Error(`Unknown product: ${args.product}. Expected one of ${PRODUCT_ORDER.join(", ")} or all.`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.outDir, { recursive: true });

  if (!args.indexOnly) {
    const products = args.product === "all" ? PRODUCT_ORDER : [args.product];
    for (const product of products) {
      console.log(`${PRODUCTS[product].name}:`);
      const built = buildProductPage(product, args);
      const shots = args.screenshots ? await buildScreenshots(product, args.outDir) : [];
      writeFileSync(join(args.outDir, `${product}.html`), renderProductPage(product, built, shots), "utf8");
      const metadata = {
        product,
        name: built.config.name,
        page: `${product}.html`,
        catalogue: built.config.catalogue,
        featuredScenario: built.featured.scenario,
        yearEnd: built.featured.yearEnd,
        status: built.featured.status,
        runs: built.runs.length,
        updated: new Date().toISOString().slice(0, 10),
        features: detectFeatures(built.report, built.scenario, shots),
      };
      writeFileSync(join(args.outDir, `${product}.json`), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
      console.log(`  page ${product}.html (${built.runs.length} runs, ${shots.length} screenshots)`);
    }
  }

  buildIndex(args.outDir);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
