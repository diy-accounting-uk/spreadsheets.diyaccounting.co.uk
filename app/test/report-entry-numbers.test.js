// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// The ledger entries behind each report figure: the JS calculators fill an
// attribution beside their values, and R carries it as entryNumbers. The
// values themselves must not move by a penny for it, and the Excel-side
// comparison must still score clean with the field present.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadDiyaGlData, diyaGlToScenario, extractTaxDataFromBook } from "../lib/diya-gl-loader.js";
import { calculateFromDiyaGl } from "../lib/diya-gl-calculator.js";
import { buildReportDocument } from "../lib/report-serializer.js";
import { addSaleLine, addPurchaseLine } from "../lib/diya-gl-edits.js";
import { BST_SALES_ACCOUNTS, TAXI_SALES_ACCOUNT } from "../lib/scenario-extractor.js";
import { readXlsxCellValues } from "../lib/xlsx-reader.js";
import { extractBookFromFile, buildFileReportDocument } from "../bin/export.js";
import { scoreReportDocuments } from "../bin/verify-roundtrip.js";
import { createMethods } from "../lib/mcp/server.js";
import { createSession, loadIntoSession } from "../lib/mcp/diya-gl-tools.js";
import * as bst from "../products/bst.js";
import * as taxi from "../products/taxi.js";
import * as se from "../products/se.js";
import * as ltd from "../products/ltd.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PRODUCTS = { bst, taxi, se, ltd };
const BST_BOOK = resolve(ROOT, "examples", "precision-code-ltd", "bst");
const TAXI_BOOK = resolve(ROOT, "examples", "kestrel-executive-cars", "taxi");

const TURNOVER = "section/profit-loss-account/sales-turnover";
const NET_PROFIT = "section/profit-loss-account/net-profit";
const PREMISES = "section/profit-loss-account/premises-costs";

function reportOf(book, lines, product) {
  const taxData = extractTaxDataFromBook(book, product);
  const scenario = diyaGlToScenario(book, lines, product);
  const attribution = {};
  const results = calculateFromDiyaGl(book, lines, product, taxData, scenario, { attribution });
  const document = buildReportDocument({
    packageName: product,
    engine: "js",
    results,
    productMod: PRODUCTS[product],
    scenario,
    taxData,
    attribution,
  });
  return new Map(document.values.map((entry) => [entry.key, entry]));
}

const sortedEntryNumbers = (lines) => [...new Set(lines.map((line) => line.entryNumber))].sort();

function newLine(lines, fields) {
  const template = lines.find((line) => line.sourceJournalID === fields.sourceJournalID);
  return { ...template, amount: 123.45, postingDate: "2025-06-15", detailComment: "Added", ...fields };
}

describe("entryNumbers on a Basic Sole Trader book", () => {
  const { book, lines } = loadDiyaGlData(BST_BOOK);
  const report = reportOf(book, lines, "bst");

  it("gives turnover exactly the entryNumbers of its sales lines", () => {
    const salesLines = lines.filter((line) => line.sourceJournalID === "sales" && BST_SALES_ACCOUNTS.has(String(line.accountMainID)));
    expect(salesLines.length).toBeGreaterThan(0);
    expect(report.get(TURNOVER).entryNumbers).toEqual(sortedEntryNumbers(salesLines));
  });

  it("adds a new sales line to turnover and net profit and nowhere it does not reach", () => {
    const sale = newLine(lines, { sourceJournalID: "sales", accountMainID: "4000", entryNumber: "ADDED-SALE" });
    const after = reportOf(book, addSaleLine(book, lines, { line: sale }), "bst");
    for (const key of [TURNOVER, NET_PROFIT]) {
      expect(after.get(key).entryNumbers).toEqual([...report.get(key).entryNumbers, "ADDED-SALE"].sort());
    }
    expect(after.get(PREMISES).entryNumbers).toEqual(report.get(PREMISES).entryNumbers);
  });

  it("lists a purchase line under its category row", () => {
    const purchase = newLine(lines, { sourceJournalID: "purchases", accountMainID: "5200", entryNumber: "ADDED-PREMISES" });
    const after = reportOf(book, addPurchaseLine(book, lines, { line: purchase }), "bst");
    expect(after.get(PREMISES).entryNumbers).toContain("ADDED-PREMISES");
    expect(after.get(NET_PROFIT).entryNumbers).toContain("ADDED-PREMISES");
    expect(after.get(TURNOVER).entryNumbers).not.toContain("ADDED-PREMISES");
  });

  it("gives every section row that reprints a cell its entryNumbers", () => {
    const missing = [...report.values()].filter((entry) => entry.key.startsWith("section/") && entry.source && !entry.entryNumbers);
    expect(missing.map((entry) => entry.key)).toEqual([]);
  });
});

describe("entryNumbers on a Taxi Driver book", () => {
  const { book, lines } = loadDiyaGlData(TAXI_BOOK);
  const report = reportOf(book, lines, "taxi");

  it("gives turnover exactly the entryNumbers of its fare lines", () => {
    const fares = lines.filter((line) => line.sourceJournalID === "sales" && String(line.accountMainID) === TAXI_SALES_ACCOUNT);
    expect(report.get("section/profit-loss-account/turnover-total-fares").entryNumbers).toEqual(sortedEntryNumbers(fares));
  });

  it("gives every section row that reprints a cell its entryNumbers", () => {
    const missing = [...report.values()].filter((entry) => entry.key.startsWith("section/") && entry.source && !entry.entryNumbers);
    expect(missing.map((entry) => entry.key)).toEqual([]);
  });
});

describe("attribution leaves the calculated values alone", () => {
  const BOOKS = [
    ["bst", BST_BOOK],
    ["taxi", TAXI_BOOK],
    ["se", resolve(ROOT, "examples", "brickwork-pro", "se-vat")],
    ["ltd", resolve(ROOT, "examples", "brickwork-pro", "ltd-vat")],
  ];

  it.each(BOOKS)("%s: the results are identical with and without an attribution", (product, dir) => {
    const { book, lines } = loadDiyaGlData(dir);
    const taxData = extractTaxDataFromBook(book, product);
    const plain = calculateFromDiyaGl(book, lines, product, taxData, diyaGlToScenario(book, lines, product));
    const attributed = calculateFromDiyaGl(book, lines, product, taxData, diyaGlToScenario(book, lines, product), { attribution: {} });
    expect(attributed).toEqual(plain);
  });
});

describe("the Excel-side comparison with entryNumbers present", () => {
  it("scores the published Basic Sole Trader example clean against its extracted book", { timeout: 60_000 }, async () => {
    const path = resolve(ROOT, "examples", "bst-latest", "GB_Accounts_Basic_Sole_Trader.xlsx");
    const excelResults = await readXlsxCellValues(readFileSync(path), bst.standardReads());
    const excel = buildReportDocument({ packageName: "bst", engine: "excel", results: excelResults, productMod: bst });
    const { book, lines } = await extractBookFromFile(path);
    const js = buildFileReportDocument(book, lines, "bst", bst, { attribute: true });
    expect(js.values.some((entry) => entry.entryNumbers?.length > 0)).toBe(true);
    const score = scoreReportDocuments(excel, js);
    expect(score.differingKeys).toEqual([]);
    expect(score.noJsValue).toBe(0);
  });

  it("leaves entryNumbers out of the written report unless asked", async () => {
    const { book, lines } = loadDiyaGlData(BST_BOOK);
    const document = buildFileReportDocument(book, lines, "bst", bst);
    expect(document.values.some((entry) => "entryNumbers" in entry)).toBe(false);
  });
});

describe("the MCP report tool", () => {
  const { book, lines } = loadDiyaGlData(BST_BOOK);
  async function reportTool(args) {
    const session = createSession();
    loadIntoSession(session, book, lines);
    const response = await createMethods(session)["tools/call"]({ name: "report", arguments: args });
    return new Map(response.structuredContent.report.values.map((entry) => [entry.key, entry]));
  }

  it("leaves entryNumbers out unless asked", async () => {
    const values = await reportTool({});
    expect([...values.values()].some((entry) => "entryNumbers" in entry)).toBe(false);
    expect(values.get(TURNOVER).label).toBe("Sales Turnover");
  });

  it("gives every attributed figure its entryNumbers when asked with true", async () => {
    const values = await reportTool({ entryNumbers: true });
    expect(values.get(TURNOVER).entryNumbers).toEqual(reportOf(book, lines, "bst").get(TURNOVER).entryNumbers);
    expect(values.get(NET_PROFIT).entryNumbers.length).toBeGreaterThan(0);
  });

  it("gives entryNumbers to the named keys alone when asked with a list", async () => {
    const values = await reportTool({ entryNumbers: [TURNOVER] });
    expect(values.get(TURNOVER).entryNumbers.length).toBeGreaterThan(0);
    expect([...values.values()].filter((entry) => "entryNumbers" in entry).map((entry) => entry.key)).toEqual([TURNOVER]);
  });
});
