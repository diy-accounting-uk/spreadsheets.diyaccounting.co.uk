// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-new-book.test.js — the MCP server's new_book tool and the
// new-book command: an empty book per product, the starting chart, the
// twelve months to the year end, that year's tax tables, no lines and no
// failing book check.

import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";

import { createMethods } from "../lib/mcp/server.js";
import { NEW_BOOK_CHARTS } from "../lib/diya-gl-new-book.js";
import { taxTablesForProduct } from "../lib/xlsx-exporter.js";
import { validateBook } from "../lib/diya-gl-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const DATA_DIR = resolve(ROOT, "app", "data");

async function callTool(methods, name, args) {
  const response = await methods["tools/call"]({ name, arguments: args });
  return response.structuredContent;
}

const CASES = [
  { product: "bst", schemaName: "BasicSoleTrader", yearEnd: "2027-04-05", start: "2026-04-06", dataFile: "se-2026-2027" },
  { product: "taxi", schemaName: "TaxiDriver", yearEnd: "2026-04-05", start: "2025-04-06", dataFile: "se-2025-2026" },
  { product: "se", schemaName: "SelfEmployed", yearEnd: "2027-04-05", start: "2026-04-06", dataFile: "se-2026-2027", vatRegistered: true },
  { product: "ltd", schemaName: "Company", yearEnd: "2027-03-31", start: "2026-04-01", dataFile: "ltd-2026", vatRegistered: true },
];

describe("new_book", () => {
  for (const { product, schemaName, yearEnd, start, dataFile, vatRegistered } of CASES) {
    it(`starts an empty ${product} book with the product's chart and that year's tax tables, and no check fails`, async () => {
      const result = await callTool(createMethods(), "new_book", { product, businessName: "Lark Lane", yearEnd, vatRegistered });
      expect(result.lines).toEqual([]);
      expect(result.book.documentInfo.periodCoveredStart).toBe(start);
      expect(result.book.documentInfo.periodCoveredEnd).toBe(yearEnd);
      expect(result.book.entityInformation.organizationIdentifier).toBe("Lark Lane");
      expect(result.book.entityInformation["diya-gl:product"]).toBe(schemaName);
      expect(result.book.entityInformation["diya-gl:vatRegistered"]).toBe(Boolean(vatRegistered));
      expect(result.book.accounts).toEqual(NEW_BOOK_CHARTS[product]);
      const rateData = parseTOML(readFileSync(resolve(DATA_DIR, `${dataFile}.toml`), "utf8"));
      expect(result.book.tax).toEqual(taxTablesForProduct(rateData, product));
      expect(validateBook(result.book).valid).toBe(true);
      expect(result.report.package).toBe(product);
      expect(result.bookChecks.summary.fail).toBe(0);
      expect(result.bookChecks.results.filter((check) => check.result === "fail")).toEqual([]);
    });
  }

  it("loads the new book into the session, so edit_lines adds its first sale", async () => {
    const methods = createMethods();
    await callTool(methods, "new_book", { product: "se", businessName: "Lark Lane", yearEnd: "2027-04-05" });
    const edited = await callTool(methods, "edit_lines", {
      edits: [
        {
          edit: "addSaleLine",
          params: {
            line: {
              entryNumber: "TXN-0001",
              sourceJournalID: "sales",
              postingDate: "2026-05-01",
              accountMainID: "4000",
              amount: 250,
              documentType: "invoice",
              documentReference: "INV-1",
              detailComment: "First customer",
              taxCode: "NA",
              taxRate: 0,
            },
          },
        },
      ],
    });
    expect(edited.lines).toHaveLength(1);
    const checks = await callTool(methods, "checks", {});
    expect(checks.summary.fail).toBe(0);
  });

  it("refuses a VAT registered Basic Sole Trader or Taxi Driver book", async () => {
    const methods = createMethods();
    for (const product of ["bst", "taxi"]) {
      await expect(
        callTool(methods, "new_book", { product, businessName: "Lark Lane", yearEnd: "2027-04-05", vatRegistered: true }),
      ).rejects.toThrow(/carries no VAT return/);
    }
  });

  it("refuses a year whose tax tables are not carried, naming the file", async () => {
    await expect(
      callTool(createMethods(), "new_book", { product: "se", businessName: "Lark Lane", yearEnd: "2041-04-05" }),
    ).rejects.toThrow("No tax tables for a year ending 2041-04-05: app/data/se-2040-2041.toml is not carried yet");
  });

  it("refuses an unknown product, a date that is not a date, and a missing name", async () => {
    const methods = createMethods();
    await expect(callTool(methods, "new_book", { product: "llp", businessName: "X", yearEnd: "2027-04-05" })).rejects.toThrow(
      /Unknown product "llp"/,
    );
    await expect(callTool(methods, "new_book", { product: "se", businessName: "X", yearEnd: "2027-02-30" })).rejects.toThrow(
      /not a real date/,
    );
    await expect(callTool(methods, "new_book", { product: "se", businessName: " ", yearEnd: "2027-04-05" })).rejects.toThrow(
      /businessName/,
    );
  });

  it("is advertised with the questions it answers", async () => {
    const { tools } = await createMethods()["tools/list"]();
    const tool = tools.find((entry) => entry.name === "new_book");
    expect(tool.description).toMatch(/Answers: .+\?/);
    expect(tool.inputSchema.required).toEqual(["product", "businessName", "yearEnd"]);
  });
});

describe("diya-gl new-book", () => {
  it("writes book.toml, an empty lines.jsonl, report.json and bookchecks.json with no failing check", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "diya-gl-new-book-"));
    try {
      execFileSync(
        process.execPath,
        [
          resolve(ROOT, "app", "bin", "new-book.js"),
          "--product",
          "ltd",
          "--name",
          "Lark Lane Ltd",
          "--year-end",
          "2027-03-31",
          "--vat",
          "--output-dir",
          outputDir,
        ],
        { encoding: "utf8" },
      );
      const book = parseTOML(readFileSync(join(outputDir, "book.toml"), "utf8"));
      expect(book.entityInformation.organizationIdentifier).toBe("Lark Lane Ltd");
      expect(book.entityInformation["diya-gl:vatRegistered"]).toBe(true);
      expect(new Date(book.documentInfo.periodCoveredEnd).toISOString().slice(0, 10)).toBe("2027-03-31");
      expect(readFileSync(join(outputDir, "lines.jsonl"), "utf8").trim()).toBe("");
      expect(existsSync(join(outputDir, "report.json"))).toBe(true);
      const bookchecks = JSON.parse(readFileSync(join(outputDir, "bookchecks.json"), "utf8"));
      expect(bookchecks.filter((check) => check.result === "fail")).toEqual([]);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }, 60000);

  it("prints the usage and exits 1 without a year end", () => {
    let failure;
    try {
      execFileSync(process.execPath, [resolve(ROOT, "app", "bin", "new-book.js"), "--product", "se", "--name", "Lark Lane"], {
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (error) {
      failure = error;
    }
    expect(failure.status).toBe(1);
    expect(failure.stderr).toContain("Usage: diya-gl new-book --product <bst|se|taxi|ltd>");
    expect(failure.stderr).toMatch(/Answers: .+\?/);
  }, 30000);
});
