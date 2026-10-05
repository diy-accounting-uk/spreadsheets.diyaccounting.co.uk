// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-roll-forward.test.js — the MCP server's roll_forward tool and the
// roll-forward command: the next year of a book opens on the balances the
// year closed on, its lines hold only the opening entries, and no book check
// fails.

import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";

import { createMethods } from "../lib/mcp/server.js";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { rollForwardChecks, rolledYearEnd } from "../lib/diya-gl-roll-forward.js";
import { taxTablesForProduct } from "../lib/xlsx-exporter.js";
import { validateBook, validateLines } from "../lib/diya-gl-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const example = (path) => loadDiyaGlData(resolve(ROOT, "examples", path));
const rateData = (name) => parseTOML(readFileSync(resolve(ROOT, "app", "data", `${name}.toml`), "utf8"));

async function callTool(name, args, methods = createMethods()) {
  const response = await methods["tools/call"]({ name, arguments: args });
  return response.structuredContent;
}

const failing = (checks) => checks.filter((check) => check.result === "fail");
const lineOn = (lines, account) => lines.filter((line) => line.sourceJournalID === "journal" && line.accountMainID === account);

describe("roll_forward on BrickWork Pro Ltd", async () => {
  const prior = example("brickwork-pro/ltd-nonvat");
  const rolled = await callTool("roll_forward", prior);

  it("moves the year to 2026-04-01 to 2027-03-31 with that year's rates, keeping the associated companies", () => {
    expect(rolled.book.documentInfo.periodCoveredStart).toBe("2026-04-01");
    expect(rolled.book.documentInfo.periodCoveredEnd).toBe("2027-03-31");
    const tables = taxTablesForProduct(rateData("ltd-2026"), "ltd");
    expect(rolled.book.tax).toEqual({ ...tables, corporationTax: { ...tables.corporationTax, associatedCompanies: 0 } });
  });

  it("holds only the opening journal and the bank's brought-forward lines, all dated 2026-04-01", () => {
    expect(rolled.lines.length).toBeGreaterThan(0);
    for (const line of rolled.lines) {
      expect(line.postingDate).toBe("2026-04-01");
      if (line.sourceJournalID === "journal") expect(line.documentReference).toBe("OB-001");
      else {
        expect(line.sourceJournalID).toBe("bank");
        expect(line["diya-gl:bankCode"]).toBe("BC");
      }
    }
    const debits = rolled.lines.filter((line) => line.sourceJournalID === "journal" && line.debitCreditCode === "D");
    const credits = rolled.lines.filter((line) => line.sourceJournalID === "journal" && line.debitCreditCode === "C");
    const total = (lines) => Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100);
    expect(total(debits)).toBe(total(credits));
  });

  it("splits the 726.70 of tax and social security into the CIS and the PAYE owed", () => {
    const published = rolled.rollChecks.find((check) => check.key === "section/opening-balance-sheet/taxation-and-social-security");
    expect(published).toEqual({ key: published.key, expected: 726.7, actual: 726.7, result: "pass" });
    expect(lineOn(rolled.lines, "2410")).toEqual([expect.objectContaining({ debitCreditCode: "C", amount: 600 })]);
    expect(lineOn(rolled.lines, "2400")).toEqual([expect.objectContaining({ debitCreditCode: "C", amount: 126.7 })]);
  });

  it("opens each bank account on its own balance, the unmatched sweep landing on the savings account", () => {
    const banks = rolled.lines.filter((line) => line.sourceJournalID === "bank");
    expect(banks.map((line) => [line["diya-gl:bankAccountID"], line.debitCreditCode, line.amount])).toEqual([
      ["1200", "C", 3819.3],
      ["1210", "D", 15000],
    ]);
    expect(rolled.book.accounts.bank["1210"]).toEqual({ accountMainDescription: "Savings account", accountType: "bank" });
  });

  it("carries the van at cost less a year's depreciation, and the debtors and creditors listings", () => {
    expect(rolled.book.fixedAssets).toEqual([
      {
        assetID: "FA-VAN-001",
        class: "motorVehicles",
        description: "Ford Transit Custom van",
        cost: 12000,
        acquiredDate: "2025-09-01",
        accumulatedDepreciation: 1200,
        taxWrittenDownValue: 0,
      },
    ]);
    expect(rolled.book.stock.openingValue).toBe(2500);
    expect(rolled.book.debtors.every((entry) => entry.timing === "opening")).toBe(true);
    expect(rolled.book.debtors.map((entry) => entry.invoice)).toEqual(["INV-1510", "INV-1520"]);
    expect(rolled.book.creditors.map((entry) => entry.invoice)).toEqual(["VF-2603", "JW-2603", "SH-2603", "TP-2603"]);
  });

  it("opens every figure of the opening balance sheet on the published balance sheet it closed on", () => {
    expect(rolled.rollChecks.map((check) => check.key)).toEqual([
      "section/opening-balance-sheet/tangible-assets-net-book-value",
      "section/opening-balance-sheet/stock-at-cost",
      "section/opening-balance-sheet/trade-debtors",
      "section/opening-balance-sheet/cash-and-bank-balances",
      "section/opening-balance-sheet/trade-creditors",
      "section/opening-balance-sheet/corporation-tax",
      "section/opening-balance-sheet/taxation-and-social-security",
      "section/opening-balance-sheet/directors-loan-account",
      "section/opening-balance-sheet/called-up-share-capital",
      "section/opening-balance-sheet/retained-profit-and-loss-account",
      "section/opening-balance-sheet/accuracy-check",
    ]);
    expect(failing(rolled.rollChecks)).toEqual([]);
    expect(rolled.bookChecks.summary.fail).toBe(0);
    expect(validateBook(rolled.book).valid).toBe(true);
    expect(validateLines(rolled.lines, rolled.book).valid).toBe(true);
  });

  it("fails exactly the checks a dropped opening line moves", async () => {
    const withoutCis = rolled.lines.filter((line) => !(line.sourceJournalID === "journal" && line.accountMainID === "2410"));
    expect(withoutCis.length).toBe(rolled.lines.length - 1);
    const { report } = await callTool("report", { book: rolled.book, lines: withoutCis });
    const priorReport = (await callTool("report", prior)).report;
    const checks = rollForwardChecks({
      priorBook: prior.book,
      priorLines: prior.lines,
      priorReport,
      rolledBook: rolled.book,
      rolledReport: report,
    });
    expect(failing(checks)).toEqual([
      { key: "section/opening-balance-sheet/taxation-and-social-security", expected: 726.7, actual: 126.7, result: "fail" },
      { key: "section/opening-balance-sheet/accuracy-check", expected: 0, actual: 600, result: "fail" },
    ]);
  });

  it("keeps the director's, employees' and member's dates as days through a JSON round trip", () => {
    const book = JSON.parse(JSON.stringify(rolled.book));
    expect(book.directors.map((director) => director.appointed)).toEqual(["2019-06-01"]);
    expect(book.employees.map((employee) => employee.startDate)).toEqual(["2019-06-01", "2023-03-15"]);
    expect(book.members.map((member) => member.acquiredDate)).toEqual(["2019-06-01"]);
    expect(validateBook(book).valid).toBe(true);
  });

  it("loads the next year into the session, so a second roll starts from it", async () => {
    const methods = createMethods();
    await callTool("roll_forward", prior, methods);
    const second = await callTool("roll_forward", {}, methods);
    expect(second.book.documentInfo.periodCoveredEnd).toBe("2028-03-31");
    expect(failing(second.rollChecks)).toEqual([]);
    expect(second.bookChecks.summary.fail).toBe(0);
  });
});

describe("roll_forward on Precision Code Ltd", async () => {
  const prior = example("precision-code-ltd/full");
  const rolled = await callTool("roll_forward", prior);

  it("clears the dividends, carries the loans and hire purchase owed on long term creditors, and passes every check", () => {
    expect(prior.book.dividends.length).toBeGreaterThan(0);
    expect(rolled.book.dividends).toBeUndefined();
    expect(rolled.book.hpAgreements).toBeUndefined();
    expect(lineOn(rolled.lines, "2600")).toEqual([expect.objectContaining({ debitCreditCode: "C", amount: 45000 })]);
    expect(failing(rolled.rollChecks)).toEqual([]);
    expect(rolled.bookChecks.summary.fail).toBe(0);
  });

  it("carries each asset still held with its own cost, depreciation and tax written-down value, and drops the one sold", () => {
    const ids = rolled.book.fixedAssets.map((asset) => asset.assetID);
    expect(ids).not.toContain("LTD-FA-1");
    const nbv = rolled.book.fixedAssets.reduce((sum, asset) => sum + asset.cost - asset.accumulatedDepreciation, 0);
    expect(Math.round(nbv * 100) / 100).toBe(208990);
  });
});

describe("roll_forward on the sole trader products", () => {
  it("Self Employed: opens the bank on a brought-forward line, and the stock and schedule on what the year closed on", async () => {
    const rolled = await callTool("roll_forward", example("brickwork-pro/se-nonvat"));
    expect(rolled.book.documentInfo.periodCoveredEnd).toBe("2027-03-31");
    expect(rolled.book.tax).toEqual(taxTablesForProduct(rateData("se-2026-2027"), "se"));
    expect(rolled.lines).toEqual([
      expect.objectContaining({
        sourceJournalID: "bank",
        postingDate: "2026-04-01",
        accountMainID: "1200",
        debitCreditCode: "D",
        amount: 5256.7,
      }),
    ]);
    expect(rolled.rollChecks.map((check) => [check.key, check.result])).toEqual([
      ["cell/Bank.xlsx!Mar!A1", "pass"],
      ["cell/Cash.xlsx!Mar!A1", "pass"],
      ["cell/Financialaccounts.xlsx!StockControl!AB6", "pass"],
      ["cell/Fixedassets.xlsx!Schedule!E57", "pass"],
      ["cell/Fixedassets.xlsx!Schedule!F1", "pass"],
      ["cell/Fixedassets.xlsx!Schedule!G1", "pass"],
    ]);
    expect(rolled.bookChecks.summary.fail).toBe(0);
  });

  it("Basic Sole Trader: owed at the start of the year equals owed at the end of the last, with no lines", async () => {
    const rolled = await callTool("roll_forward", example("brickwork-pro/bst-nonvat"));
    expect(rolled.lines).toEqual([]);
    expect(rolled.rollChecks).toEqual([
      { key: "section/debtors-creditors/owed-by-customers-at-start-of-year", expected: 6600, actual: 6600, result: "pass" },
      { key: "section/debtors-creditors/owed-to-suppliers-at-start-of-year", expected: 19510, actual: 19510, result: "pass" },
      { key: "section/stock/opening-stock", expected: 2500, actual: 2500, result: "pass" },
      { key: "fixedAssets.taxWrittenDownValue", expected: 0, actual: 0, result: "pass" },
    ]);
    expect(rolled.bookChecks.summary.fail).toBe(0);
  });

  it("Taxi Driver: the register carries the pool the year carried forward", async () => {
    const rolled = await callTool("roll_forward", example("basic-taxi-driver/taxi"));
    expect(rolled.book.documentInfo.periodCoveredEnd).toBe("2027-04-05");
    expect(rolled.lines).toEqual([]);
    expect(rolled.book.fixedAssets).toEqual([
      expect.objectContaining({ assetID: "FA-VEHICLE-001", cost: 8000, taxWrittenDownValue: 6560 }),
    ]);
    expect(rolled.rollChecks).toEqual([{ key: "fixedAssets.taxWrittenDownValue", expected: 6560, actual: 6560, result: "pass" }]);
    expect(rolled.bookChecks.summary.fail).toBe(0);
  });

  it("refuses a year whose tax tables are not carried, naming the file", async () => {
    const methods = createMethods();
    const first = await callTool("roll_forward", example("basic-taxi-driver/taxi"), methods);
    expect(first.book.documentInfo.periodCoveredEnd).toBe("2027-04-05");
    await expect(callTool("roll_forward", {}, methods)).rejects.toThrow(
      "No tax tables for a year ending 2028-04-05: app/data/se-2027-2028.toml is not carried yet",
    );
  });
});

describe("roll_forward's advertisement", () => {
  it("names the questions it answers", async () => {
    const { tools } = await createMethods()["tools/list"]();
    expect(tools.find((entry) => entry.name === "roll_forward").description).toMatch(/Answers: .+\?/);
  });
});

describe("rolledYearEnd", () => {
  it("moves the year end on a year, to 28 February from a 29th", () => {
    expect(rolledYearEnd({ documentInfo: { periodCoveredEnd: "2026-03-31" } })).toBe("2027-03-31");
    expect(rolledYearEnd({ documentInfo: { periodCoveredEnd: "2028-02-29" } })).toBe("2029-02-28");
  });
});

describe("diya-gl roll-forward", () => {
  it("writes the next year and its roll checks, and exits 0 when every check passes", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "diya-gl-roll-forward-"));
    try {
      execFileSync(
        process.execPath,
        [
          resolve(ROOT, "app", "bin", "roll-forward.js"),
          "--data",
          resolve(ROOT, "examples", "brickwork-pro", "ltd-nonvat"),
          "--output-dir",
          outputDir,
        ],
        { encoding: "utf8" },
      );
      const book = parseTOML(readFileSync(join(outputDir, "book.toml"), "utf8"));
      expect(new Date(book.documentInfo.periodCoveredEnd).toISOString().slice(0, 10)).toBe("2027-03-31");
      const lines = readFileSync(join(outputDir, "lines.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(lines.every((line) => line.postingDate === "2026-04-01")).toBe(true);
      const rollChecks = JSON.parse(readFileSync(join(outputDir, "rollchecks.json"), "utf8"));
      expect(failing(rollChecks)).toEqual([]);
      const bookchecks = JSON.parse(readFileSync(join(outputDir, "bookchecks.json"), "utf8"));
      expect(failing(bookchecks)).toEqual([]);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }, 60000);

  it("prints the usage and exits 1 without an output directory", () => {
    let failure;
    try {
      execFileSync(process.execPath, [resolve(ROOT, "app", "bin", "roll-forward.js"), "--data", "examples/brickwork-pro/ltd-nonvat"], {
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (error) {
      failure = error;
    }
    expect(failure.status).toBe(1);
    expect(failure.stderr).toContain("Usage: diya-gl roll-forward --data");
    expect(failure.stderr).toMatch(/Answers: .+\?/);
  }, 30000);
});
