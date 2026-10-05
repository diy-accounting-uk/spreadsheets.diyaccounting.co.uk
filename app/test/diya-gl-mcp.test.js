// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-mcp.test.js — the stdio MCP server exposing the diya-gl BST
// pipeline as MCP tools (Phase 2 of
// PLAN_DIYA_GL_BST_CLI_MCP_WEB_SPIKE.md). Three things are proved here:
//
//   - the JSON-RPC handshake and tool listing work over the real stdio
//     transport (a spawned child process), not just in-process;
//   - extract_book on a generated package matches export.js's --file
//     output byte-for-byte: book.toml, lines.jsonl and the overtype
//     sidecar;
//   - the four edit cases app/test/diya-gl-edit-recalc.test.js proves
//     (add a purchase, add a sale, change a sale line, change a purchase
//     line, across all three BST fixtures) replayed through the edit_lines
//     and report tools produce the same movements and the same
//     all-checks-pass outcome as a direct call of the same D-to-R loop.
//
// No LibreOffice: everything here is the JS engine, exactly as the harness
// and export-file.test.js already run it.

import { describe, it, expect, afterEach } from "vitest";
import { execFileSync, spawn } from "child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseTOML } from "smol-toml";
import JSZip from "jszip";
import { createMethods } from "../lib/mcp/server.js";
import { createSession, loadIntoSession } from "../lib/mcp/diya-gl-tools.js";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { buildFileReportDocument } from "../bin/export.js";
import { savePackageZip } from "../lib/product-workbook.js";
import * as bst from "../products/bst.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const NODE = process.execPath;
const MCP_BIN = resolve(ROOT, "app", "bin", "diya-gl-mcp.js");
const EXPORT_BIN = resolve(ROOT, "app", "bin", "export.js");
const BST_XLSX = resolve(ROOT, "examples", "bst-latest", "GB_Accounts_Basic_Sole_Trader.xlsx");
const SE_PACKAGE_DIR = resolve(ROOT, "examples", "se-latest");
const TAXI_SOURCE_DIR = resolve(ROOT, "examples", "taxi-latest");

// A multi-file package zipped flat, the way a customer's own download ships
// it -- every workbook in the directory, at the zip root.
async function packageZipOf(dir, zipPath) {
  const zip = new JSZip();
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".xlsx"))) {
    zip.file(name, readFileSync(resolve(dir, name)));
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(zipPath, buffer);
  return zipPath;
}

const tempDirs = [];
function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

// ============================================================================
// A minimal stdio JSON-RPC client, driving the actual diya-gl-mcp.js binary
// as a child process -- the real transport, not a call into the method
// table in-process.
// ============================================================================

function startMcpClient() {
  const proc = spawn(NODE, [MCP_BIN], { cwd: ROOT });
  let buffer = "";
  const pending = new Map();
  let nextId = 1;
  const stderr = [];

  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const resolver = pending.get(message.id);
      if (resolver) {
        pending.delete(message.id);
        if (message.error) resolver.reject(new Error(message.error.message));
        else resolver.resolve(message.result);
      }
    }
  });
  proc.stderr.on("data", (chunk) => stderr.push(chunk.toString()));

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolvePromise, reject) => {
      pending.set(id, { resolve: resolvePromise, reject });
      proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }
  function notify(method, params) {
    proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }
  async function callTool(name, args) {
    const result = await request("tools/call", { name, arguments: args });
    return JSON.parse(result.content[0].text);
  }
  function close() {
    proc.kill();
  }

  return { request, notify, callTool, close, stderrText: () => stderr.join("") };
}

// ============================================================================
// The JSON-RPC handshake and tool listing, over real stdio.
// ============================================================================

describe("diya-gl MCP server: stdio handshake", () => {
  it("initializes, lists exactly the eight tools, and answers tools/call", async () => {
    const client = startMcpClient();
    try {
      const initResult = await client.request("initialize", { protocolVersion: "2025-06-18" });
      expect(initResult.serverInfo.name).toBe("diya-gl");
      expect(initResult.protocolVersion).toBe("2025-06-18");

      client.notify("notifications/initialized");

      const listResult = await client.request("tools/list");
      const names = listResult.tools.map((tool) => tool.name).sort();
      expect(names).toEqual(["book", "chart", "checks", "edit_lines", "extract_book", "lines", "new_book", "report", "save_workbook"]);
      for (const tool of listResult.tools) {
        expect(typeof tool.description).toBe("string");
        expect(tool.inputSchema.type).toBe("object");
      }

      const extracted = await client.callTool("extract_book", { path: BST_XLSX });
      expect(extracted.lines.length).toBeGreaterThan(0);
      expect(extracted.report.package).toBe("bst");
      expect(extracted.bookChecks.summary).toEqual({ pass: expect.any(Number), warn: expect.any(Number), fail: expect.any(Number) });
      expect(extracted.bookChecks.results.length).toBe(
        extracted.bookChecks.summary.pass + extracted.bookChecks.summary.warn + extracted.bookChecks.summary.fail,
      );

      const reported = await client.callTool("report", {});
      expect(reported.report).toEqual(extracted.report);
      expect(reported.bookChecks.summary).toEqual(extracted.bookChecks.summary);
    } finally {
      client.close();
    }
  }, 30000);

  it("rejects an unknown tool name by name, not a stack trace", async () => {
    const client = startMcpClient();
    try {
      await expect(client.request("tools/call", { name: "not_a_real_tool", arguments: {} })).rejects.toThrow(
        "Unknown tool: not_a_real_tool",
      );
    } finally {
      client.close();
    }
  });

  it("reports a missing book by name when report is called with nothing loaded", async () => {
    const client = startMcpClient();
    try {
      await expect(client.request("tools/call", { name: "report", arguments: {} })).rejects.toThrow("No book is loaded");
    } finally {
      client.close();
    }
  });
});

// ============================================================================
// save_workbook: the base64 the tool hands back decodes to a real workbook.
// ============================================================================

describe("save_workbook: the base64 payload decodes to a real workbook", () => {
  it("hands back bst-excel.xlsx as base64, recalculating on open", async () => {
    const client = startMcpClient();
    try {
      await client.callTool("extract_book", { path: BST_XLSX });
      const saved = await client.callTool("save_workbook", {});

      expect(saved.format).toBe("xlsx");
      expect(saved.filename).toMatch(/\.xlsx$/);

      const bytes = Buffer.from(saved.base64, "base64");
      expect(bytes.slice(0, 2).toString(), "the decoded bytes open as a zip (xlsx container)").toBe("PK");

      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(bytes);
      const workbookXml = await zip.file("xl/workbook.xml").async("string");
      expect(workbookXml).toContain('fullCalcOnLoad="1"');
    } finally {
      client.close();
    }
  }, 30000);

  it("hands back the package zip as base64 when asked for format zip", async () => {
    const client = startMcpClient();
    try {
      await client.callTool("extract_book", { path: BST_XLSX });
      const saved = await client.callTool("save_workbook", { format: "zip" });

      expect(saved.format).toBe("zip");
      expect(saved.filename).toMatch(/\.zip$/);

      const bytes = Buffer.from(saved.base64, "base64");
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(bytes);
      const entries = Object.keys(zip.files);
      expect(entries.length).toBe(1);
      expect(entries[0]).toMatch(/\.xlsx$/);
    } finally {
      client.close();
    }
  }, 30000);

  it("save_workbook format xlsx on an SE session answers with the single-file refusal and format zip returns nine entries under dirName, byte-identical to savePackageZip", async () => {
    const zipDir = tempDir("mcp-save-se-zip-");
    const zipPath = await packageZipOf(SE_PACKAGE_DIR, resolve(zipDir, "se-package.zip"));

    const client = startMcpClient();
    try {
      const extracted = await client.callTool("extract_book", { path: zipPath });

      await expect(client.request("tools/call", { name: "save_workbook", arguments: { format: "xlsx" } })).rejects.toThrow(
        "a Self Employed book saves as its package zip, not as one workbook",
      );

      const saved = await client.callTool("save_workbook", { format: "zip" });
      expect(saved.format).toBe("zip");

      const bytes = Buffer.from(saved.base64, "base64");
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(bytes);
      const entries = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
      expect(entries.length).toBe(9);
      const dirName = saved.filename.replace(/\.zip$/, "");
      for (const entry of entries) expect(entry.startsWith(`${dirName}/`)).toBe(true);

      // The same book and lines the session loaded, run through
      // savePackageZip directly in Node, produce the exact same zip bytes --
      // the MCP tool adds no distortion of its own.
      const { zip: directZip, filename: directFilename } = await savePackageZip(extracted.book, extracted.lines);
      expect(saved.filename).toBe(directFilename);
      expect(bytes.equals(Buffer.from(directZip))).toBe(true);
    } finally {
      client.close();
    }
  }, 60000);
});

// ============================================================================
// save_workbook on a Taxi book, seeded straight into the session
// (loadIntoSession) rather than through extract_book: a raw Taxi workbook has
// no anchor table yet (a separate row), so extract_book on one still refuses
// it as a Basic Sole Trader mismatch. save_workbook itself needs no anchor
// guard -- it writes from D, not from a workbook -- so it is fully exercised
// here independently of that gap.
// ============================================================================

describe("save_workbook: a Taxi book", () => {
  it("hands back Financialaccountsyearto050426.xlsx, recalculating on open", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "basic-taxi-driver", "taxi"));
    const session = createSession();
    loadIntoSession(session, book, lines);
    const methods = createMethods(session);

    const response = await methods["tools/call"]({ name: "save_workbook", arguments: {} });
    const saved = response.structuredContent;

    expect(saved.filename).toBe("Financialaccountsyearto050426.xlsx");
    const bytes = Buffer.from(saved.base64, "base64");
    const zip = await JSZip.loadAsync(bytes);
    const workbookXml = await zip.file("xl/workbook.xml").async("string");
    expect(workbookXml).toContain('fullCalcOnLoad="1"');
  });

  it("returns the named refusal for an off-grid fare", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "basic-taxi-driver", "taxi"));
    const offGridLine = {
      // Sorts after every TXN-* entry (diya-gl-loader.js's sourceJournalID-
      // then-entryNumber sort) so the book's own earliest fare stays the one
      // extractTaxYearStart reads the tax year off, and this line alone lands
      // off-grid.
      entryNumber: "ZZZ-TEST-OFFGRID-1",
      sourceJournalID: "sales",
      postingDate: "2026-04-07",
      accountMainID: "4000",
      amount: 50,
      documentType: "receipt",
      detailComment: "Daily fares",
      lineItemComment: "Gross fares taken",
      taxCode: "OS",
      taxRate: 0,
      paymentMethod: "cash",
    };
    const session = createSession();
    loadIntoSession(session, book, [...lines, offGridLine]);
    const methods = createMethods(session);

    await expect(methods["tools/call"]({ name: "save_workbook", arguments: {} })).rejects.toThrow("2026-04-07");
  });
});

// ============================================================================
// extract_book on a Taxi book, byte-for-byte with export.js --file. A raw
// Taxi workbook (or its package zip) still runs into the same missing anchor
// table as above, so this reaches --file's generic per-product plumbing
// (product resolution, report.json's package field) through the diya-gl JSON
// format instead, which carries its own declared product and skips the sniff.
// ============================================================================

describe("extract_book: a Taxi book, byte-for-byte with export.js --file", () => {
  it("matches lines.jsonl and reports product taxi", async () => {
    const sourceDirOutput = tempDir("mcp-extract-taxi-source-out-");
    execFileSync(NODE, [EXPORT_BIN, "--package", "taxi", "--source-dir", TAXI_SOURCE_DIR, "--output-dir", sourceDirOutput], {
      cwd: ROOT,
    });

    const book = parseTOML(readFileSync(resolve(sourceDirOutput, "book.toml"), "utf8"));
    const lines = readFileSync(resolve(sourceDirOutput, "lines.jsonl"), "utf8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    const { writeBookJson } = await import("../lib/diya-gl-interchange.js");
    const jsonDir = tempDir("mcp-extract-taxi-json-src-");
    const jsonPath = resolve(jsonDir, "book-diya-gl.json");
    writeFileSync(jsonPath, writeBookJson(book, lines));

    const cliFileOutput = tempDir("mcp-extract-taxi-cli-file-out-");
    execFileSync(NODE, [EXPORT_BIN, "--package", "taxi", "--file", jsonPath, "--output-dir", cliFileOutput], { cwd: ROOT });
    const cliLinesJsonl = readFileSync(resolve(cliFileOutput, "lines.jsonl"), "utf8");

    const client = startMcpClient();
    try {
      const extracted = await client.callTool("extract_book", { path: jsonPath, product: "taxi" });
      expect(extracted.report.package).toBe("taxi");
      expect(extracted.linesJsonl).toBe(cliLinesJsonl);
    } finally {
      client.close();
    }
  }, 30000);
});

// ============================================================================
// extract_book byte-for-byte with the CLI's own --file output.
// ============================================================================

describe("extract_book: byte-for-byte with export.js --file", () => {
  it("matches book.toml, lines.jsonl and overtyped.json exactly", async () => {
    const cliOutput = tempDir("mcp-extract-cli-out-");
    execFileSync(NODE, [EXPORT_BIN, "--package", "bst", "--file", BST_XLSX, "--output-dir", cliOutput], { cwd: ROOT });

    const cliBookToml = readFileSync(resolve(cliOutput, "book.toml"), "utf8");
    const cliLinesJsonl = readFileSync(resolve(cliOutput, "lines.jsonl"), "utf8");
    const cliOvertyped = JSON.parse(readFileSync(resolve(cliOutput, "overtyped.json"), "utf8"));

    const client = startMcpClient();
    try {
      const extracted = await client.callTool("extract_book", { path: BST_XLSX });
      expect(extracted.bookToml).toBe(cliBookToml);
      expect(extracted.linesJsonl).toBe(cliLinesJsonl);
      expect(extracted.overtyped).toEqual(cliOvertyped);
    } finally {
      client.close();
    }
  }, 30000);

  it("extract_book on the SE package zip returns product se and the CLI's own --file bytes", async () => {
    const zipDir = tempDir("mcp-extract-se-zip-");
    const zipPath = await packageZipOf(SE_PACKAGE_DIR, resolve(zipDir, "se-package.zip"));

    const cliOutput = tempDir("mcp-extract-se-cli-out-");
    execFileSync(NODE, [EXPORT_BIN, "--package", "se", "--file", zipPath, "--output-dir", cliOutput], { cwd: ROOT });
    const cliBookToml = readFileSync(resolve(cliOutput, "book.toml"), "utf8");
    const cliLinesJsonl = readFileSync(resolve(cliOutput, "lines.jsonl"), "utf8");

    const client = startMcpClient();
    try {
      const extracted = await client.callTool("extract_book", { path: zipPath });
      expect(extracted.report.package).toBe("se");
      expect(extracted.bookToml).toBe(cliBookToml);
      expect(extracted.linesJsonl).toBe(cliLinesJsonl);
    } finally {
      client.close();
    }
  }, 30000);
});

// ============================================================================
// extract_book on the interchange formats diya-gl-interchange.js added: a
// diya-gl zip and a diya-gl JSON file, both read from the same CLI output
// extract_book already matches byte-for-byte above.
// ============================================================================

describe("extract_book: the diya-gl zip and JSON formats", () => {
  it("reads a diya-gl zip to the same book.toml and lines.jsonl as the workbook it came from", async () => {
    const cliOutput = tempDir("mcp-extract-zip-cli-out-");
    execFileSync(NODE, [EXPORT_BIN, "--package", "bst", "--file", BST_XLSX, "--output-dir", cliOutput], { cwd: ROOT });

    const zip = new JSZip();
    for (const name of ["book.toml", "lines.jsonl", "report.json"]) zip.file(name, readFileSync(resolve(cliOutput, name)));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipPath = resolve(tempDir("mcp-extract-zip-src-"), "book-diya-gl.zip");
    writeFileSync(zipPath, buffer);

    const client = startMcpClient();
    try {
      const extracted = await client.callTool("extract_book", { path: zipPath });
      expect(extracted.bookToml).toBe(readFileSync(resolve(cliOutput, "book.toml"), "utf8"));
      expect(extracted.linesJsonl).toBe(readFileSync(resolve(cliOutput, "lines.jsonl"), "utf8"));
    } finally {
      client.close();
    }
  }, 30000);

  it("reads a diya-gl JSON file to the same book.toml and lines.jsonl", async () => {
    const cliOutput = tempDir("mcp-extract-json-cli-out-");
    execFileSync(NODE, [EXPORT_BIN, "--package", "bst", "--file", BST_XLSX, "--output-dir", cliOutput], { cwd: ROOT });

    const { writeBookJson } = await import("../lib/diya-gl-interchange.js");
    const book = parseTOML(readFileSync(resolve(cliOutput, "book.toml"), "utf8"));
    const lines = readFileSync(resolve(cliOutput, "lines.jsonl"), "utf8")
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    const jsonPath = resolve(tempDir("mcp-extract-json-src-"), "book-diya-gl.json");
    writeFileSync(jsonPath, writeBookJson(book, lines));

    const client = startMcpClient();
    try {
      const extracted = await client.callTool("extract_book", { path: jsonPath });
      expect(extracted.bookToml).toBe(readFileSync(resolve(cliOutput, "book.toml"), "utf8"));
      expect(extracted.linesJsonl).toBe(readFileSync(resolve(cliOutput, "lines.jsonl"), "utf8"));
    } finally {
      client.close();
    }
  }, 30000);
});

// ============================================================================
// save_workbook: the two diya-gl formats it gained alongside xlsx and zip.
// ============================================================================

describe("save_workbook: the diya-gl-zip and json formats", () => {
  it("hands back a diya-gl zip carrying book.toml, lines.jsonl and report.json", async () => {
    const client = startMcpClient();
    try {
      await client.callTool("extract_book", { path: BST_XLSX });
      const saved = await client.callTool("save_workbook", { format: "diya-gl-zip" });

      expect(saved.format).toBe("diya-gl-zip");
      const bytes = Buffer.from(saved.base64, "base64");
      const zip = await JSZip.loadAsync(bytes);
      expect(Object.keys(zip.files)).toEqual(["book.toml", "lines.jsonl", "report.json", "bookchecks.json"]);

      const bookchecks = JSON.parse(await zip.file("bookchecks.json").async("string"));
      expect(Array.isArray(bookchecks)).toBe(true);
      expect(bookchecks.length).toBeGreaterThan(0);
    } finally {
      client.close();
    }
  }, 30000);

  it("hands back a diya-gl JSON file that reads back to the same lines", async () => {
    const client = startMcpClient();
    try {
      const extracted = await client.callTool("extract_book", { path: BST_XLSX });
      const saved = await client.callTool("save_workbook", { format: "json" });

      expect(saved.format).toBe("json");
      const text = Buffer.from(saved.base64, "base64").toString("utf8");
      const document = JSON.parse(text);
      expect(document.format).toBe("diya-gl");
      expect(document.lines.length).toBe(extracted.lines.length);
    } finally {
      client.close();
    }
  }, 30000);
});

// ============================================================================
// The edit-recalc harness's four cases, replayed through edit_lines/report.
// Fixture data below is the same data app/test/diya-gl-edit-recalc.test.js
// anchors its own cases to -- see that file for why each line and account is
// the one it is (the fixture's own real transactions, never a synthetic
// category the fixture carries no data for).
// ============================================================================

const FIXTURES = [
  {
    name: "bst-scenario-basic",
    dir: resolve(ROOT, "examples", "precision-code-ltd", "bst"),
    addPurchase: {
      line: {
        entryNumber: "TEST-ADD-PURCHASE-1",
        sourceJournalID: "purchases",
        postingDate: "2025-08-15",
        accountMainID: "5500",
        amount: 200,
        documentType: "invoice",
        detailComment: "Test synthetic advertising spend",
        taxCode: "S",
        taxRate: 0.2,
      },
      amount: 200,
      categoryCell: "C17",
    },
    addSale: {
      line: {
        entryNumber: "TEST-ADD-SALE-1",
        sourceJournalID: "sales",
        postingDate: "2025-09-10",
        accountMainID: "4001",
        amount: 815,
        documentType: "invoice",
        documentReference: "INV-TEST-1",
        detailComment: "Test synthetic sale",
        lineItemComment: "Synthetic sale for the edit-recalc harness",
        taxCode: "S",
        taxRate: 0.2,
      },
      amount: 815,
      monthCell: "I4",
    },
    changeSaleLine: { entryNumber: "TXN-0016", newAmount: 1450, delta: 250, monthCell: "D4" },
    changePurchaseLine: { entryNumber: "TXN-0164", newAmount: 5450, delta: 450, categoryCell: "C7" },
    removeSaleLine: { entryNumber: "TXN-0029", amount: 360, monthCell: "D4" },
    removePurchaseLine: { entryNumber: "TXN-0030", amount: 180, categoryCell: "C21" },
    changeDateLine: { entryNumber: "TXN-0032", oldMonthCell: "D4", newPostingDate: "2025-05-05", newMonthCell: "E4", amount: 600 },
    changeAccountLine: { entryNumber: "TXN-0098", amount: 600, oldCategoryCell: "C17", newAccountMainID: "5501", newCategoryCell: "C14" },
  },
  {
    name: "bst-brickwork-pro-nonvat",
    dir: resolve(ROOT, "examples", "brickwork-pro", "bst-nonvat"),
    addPurchase: {
      line: {
        entryNumber: "TEST-ADD-PURCHASE-1",
        sourceJournalID: "purchases",
        postingDate: "2025-10-05",
        accountMainID: "5101",
        amount: 175,
        documentType: "invoice",
        detailComment: "Test synthetic employee cost",
        taxCode: "NA",
        taxRate: 0,
      },
      amount: 175,
      categoryCell: "C11",
    },
    addSale: {
      line: {
        entryNumber: "TEST-ADD-SALE-1",
        sourceJournalID: "sales",
        postingDate: "2025-11-20",
        accountMainID: "4000",
        amount: 2200,
        documentType: "invoice",
        documentReference: "INV-TEST-1",
        detailComment: "Test synthetic bricklaying job",
        lineItemComment: "Synthetic sale for the edit-recalc harness",
        taxCode: "NA",
        taxRate: 0,
        paymentMethod: "bank-transfer",
      },
      amount: 2200,
      monthCell: "K4",
    },
    changeSaleLine: { entryNumber: "TXN-0014", newAmount: 4850, delta: 300, monthCell: "D4" },
    changePurchaseLine: { entryNumber: "TXN-0028", newAmount: 6450, delta: 450, categoryCell: "C7" },
    removeSaleLine: { entryNumber: "TXN-0018", amount: 1950, monthCell: "D4" },
    removePurchaseLine: { entryNumber: "TXN-0009", amount: 60, categoryCell: "C14" },
    changeDateLine: { entryNumber: "TXN-0025", oldMonthCell: "E4", newPostingDate: "2025-06-10", newMonthCell: "F4", amount: 3200 },
    changeAccountLine: { entryNumber: "TXN-0035", amount: 300, oldCategoryCell: "C17", newAccountMainID: "5501", newCategoryCell: "C14" },
  },
  {
    name: "bst-sp-sixty",
    dir: resolve(ROOT, "examples", "sp-sixty-driving", "bst"),
    addPurchase: {
      line: {
        entryNumber: "TEST-ADD-PURCHASE-1",
        sourceJournalID: "purchases",
        postingDate: "2025-08-20",
        accountMainID: "5400",
        amount: 95,
        documentType: "invoice",
        detailComment: "Test synthetic road tax renewal",
        taxCode: "OS",
        taxRate: 0,
      },
      amount: 95,
      categoryCell: "C21",
    },
    addSale: {
      line: {
        entryNumber: "TEST-ADD-SALE-1",
        sourceJournalID: "sales",
        postingDate: "2025-09-12",
        accountMainID: "4000",
        amount: 340,
        documentType: "receipt",
        detailComment: "Daily fares",
        lineItemComment: "Synthetic fares for the edit-recalc harness",
        taxCode: "OS",
        taxRate: 0,
        paymentMethod: "online-payment",
      },
      amount: 340,
      monthCell: "I4",
    },
    changeSaleLine: { entryNumber: "TXN-0001", newAmount: 214, delta: 40, monthCell: "D4" },
    changePurchaseLine: { entryNumber: "TXN-0182", newAmount: 235, delta: 55, categoryCell: "C21" },
    removeSaleLine: { entryNumber: "TXN-0002", amount: 198, monthCell: "D4" },
    removePurchaseLine: { entryNumber: "TXN-0181", amount: 30, categoryCell: "C14" },
    changeDateLine: { entryNumber: "TXN-0003", oldMonthCell: "D4", newPostingDate: "2025-05-09", newMonthCell: "E4", amount: 221 },
    changeAccountLine: { entryNumber: "TXN-0201", amount: 150, oldCategoryCell: "C17", newAccountMainID: "5700", newCategoryCell: "C14" },
  },
];

function valueAt(document, key) {
  const entry = document.values.find((v) => v.key === key);
  if (!entry) throw new Error(`R carries no value for ${key}`);
  return Number(entry.value);
}

function expectAllChecksPass(document) {
  const failing = document.values.filter((v) => v.key.startsWith("check/") && v.value !== "pass");
  expect(failing, JSON.stringify(failing, null, 2)).toEqual([]);
}

// In-process: a direct call into the JSON-RPC method table, per the plan's
// "in-process or over stdio" -- no child process per case, so all three
// fixtures' four cases run in milliseconds rather than twelve process spawns.
function toolLayer(book, lines) {
  const session = createSession();
  loadIntoSession(session, book, lines);
  const methods = createMethods(session);
  return {
    async call(name, args) {
      const response = await methods["tools/call"]({ name, arguments: args });
      return response.structuredContent;
    },
  };
}

// The moved figures between two reports, computed independently of the tool
// layer: every key whose value differs, with the numeric delta.
function diffAgainst(beforeDocument, afterDocument) {
  const before = new Map(beforeDocument.values.map((entry) => [entry.key, entry.value]));
  const after = new Map(afterDocument.values.map((entry) => [entry.key, entry.value]));
  const moved = [];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const beforeValue = before.has(key) ? before.get(key) : null;
    const afterValue = after.has(key) ? after.get(key) : null;
    if (beforeValue === afterValue) continue;
    const beforeNumber = beforeValue === null ? null : Number(beforeValue);
    const afterNumber = afterValue === null ? null : Number(afterValue);
    const delta =
      beforeNumber !== null && afterNumber !== null && Number.isFinite(beforeNumber) && Number.isFinite(afterNumber)
        ? Number((afterNumber - beforeNumber).toFixed(6))
        : null;
    moved.push({ key, before: beforeValue, after: afterValue, delta });
  }
  return moved.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

for (const fixture of FIXTURES) {
  describe(`diya-gl edit-recalc replay through the tool layer: ${fixture.name}`, () => {
    const { book, lines } = loadDiyaGlData(fixture.dir);
    // Ground truth: the same D -> R function the tool layer's report and
    // edit_lines tools call (buildFileReportDocument, exported from
    // export.js), called directly rather than through JSON-RPC dispatch --
    // proving the tool layer adds no distortion of its own, not merely
    // that it agrees with itself.
    const baseline = buildFileReportDocument(book, lines, "bst", bst);

    it("baseline: every compliance check already passes, in the tool layer too", async () => {
      const tools = toolLayer(book, lines);
      const reported = await tools.call("report", {});
      expect(reported.report).toEqual(baseline);
      expectAllChecksPass(reported.report);
    });

    it("adds a purchase of X: profit falls by X, turnover is unchanged", async () => {
      const tools = toolLayer(book, lines);
      const result = await tools.call("edit_lines", { edits: [{ edit: "addPurchaseLine", params: { line: fixture.addPurchase.line } }] });

      expect(valueAt(result.report, "cell/Profit & Loss Acc!C4")).toBe(valueAt(baseline, "cell/Profit & Loss Acc!C4"));
      expect(valueAt(result.report, "cell/Profit & Loss Acc!C24") - valueAt(baseline, "cell/Profit & Loss Acc!C24")).toBe(
        -fixture.addPurchase.amount,
      );
      expectAllChecksPass(result.report);

      const moved = result.movedFigures.find((entry) => entry.key === "cell/Profit & Loss Acc!C24");
      expect(moved.delta).toBe(-fixture.addPurchase.amount);
    });

    it("adds a sale of Y: profit and turnover both rise by Y", async () => {
      const tools = toolLayer(book, lines);
      const result = await tools.call("edit_lines", { edits: [{ edit: "addSaleLine", params: { line: fixture.addSale.line } }] });

      expect(valueAt(result.report, "cell/Profit & Loss Acc!C4") - valueAt(baseline, "cell/Profit & Loss Acc!C4")).toBe(
        fixture.addSale.amount,
      );
      expect(valueAt(result.report, "cell/Profit & Loss Acc!C24") - valueAt(baseline, "cell/Profit & Loss Acc!C24")).toBe(
        fixture.addSale.amount,
      );
      expectAllChecksPass(result.report);
    });

    it("changes a sales line's amount: turnover and net profit move by the difference, checks stay green", async () => {
      const tools = toolLayer(book, lines);
      const { entryNumber, newAmount, delta } = fixture.changeSaleLine;
      const result = await tools.call("edit_lines", { edits: [{ edit: "changeLineAmount", params: { entryNumber, newAmount } }] });

      expect(valueAt(result.report, "cell/Profit & Loss Acc!C4") - valueAt(baseline, "cell/Profit & Loss Acc!C4")).toBe(delta);
      expect(valueAt(result.report, "cell/Profit & Loss Acc!C24") - valueAt(baseline, "cell/Profit & Loss Acc!C24")).toBe(delta);
      expectAllChecksPass(result.report);
    });

    it("changes a purchase line's amount: its category and net profit move by the difference, checks stay green", async () => {
      const tools = toolLayer(book, lines);
      const { entryNumber, newAmount, delta, categoryCell } = fixture.changePurchaseLine;
      const result = await tools.call("edit_lines", { edits: [{ edit: "changeLineAmount", params: { entryNumber, newAmount } }] });

      const before = valueAt(baseline, `cell/Profit & Loss Acc!${categoryCell}`);
      const after = valueAt(result.report, `cell/Profit & Loss Acc!${categoryCell}`);
      expect(after - before).toBe(delta);
      expect(valueAt(result.report, "cell/Profit & Loss Acc!C4")).toBe(valueAt(baseline, "cell/Profit & Loss Acc!C4"));
      expect(valueAt(result.report, "cell/Profit & Loss Acc!C24") - valueAt(baseline, "cell/Profit & Loss Acc!C24")).toBe(-delta);
      expectAllChecksPass(result.report);
    });

    it("edit_lines applies a batch in order: the second edit builds on the first, and one report comes back", async () => {
      const tools = toolLayer(book, lines);
      const result = await tools.call("edit_lines", {
        edits: [
          { edit: "addPurchaseLine", params: { line: fixture.addPurchase.line } },
          { edit: "addSaleLine", params: { line: fixture.addSale.line } },
        ],
      });

      expect(valueAt(result.report, "cell/Profit & Loss Acc!C4")).toBe(
        valueAt(baseline, "cell/Profit & Loss Acc!C4") + fixture.addSale.amount,
      );
      expect(valueAt(result.report, "cell/Profit & Loss Acc!C24")).toBe(
        valueAt(baseline, "cell/Profit & Loss Acc!C24") - fixture.addPurchase.amount + fixture.addSale.amount,
      );
      expect(result.lines.length).toBe(lines.length + 2);
    });

    it("two successive edit_lines calls compose: the session's lines carry the first call into the second", async () => {
      const session = createSession();
      loadIntoSession(session, book, lines);
      const methods = createMethods(session);

      await methods["tools/call"]({
        name: "edit_lines",
        arguments: { edits: [{ edit: "addPurchaseLine", params: { line: fixture.addPurchase.line } }] },
      });
      const second = await methods["tools/call"]({
        name: "edit_lines",
        arguments: { edits: [{ edit: "addSaleLine", params: { line: fixture.addSale.line } }] },
      });

      const secondDocument = second.structuredContent.report;
      expect(valueAt(secondDocument, "cell/Profit & Loss Acc!C4")).toBe(
        valueAt(baseline, "cell/Profit & Loss Acc!C4") + fixture.addSale.amount,
      );
      expect(valueAt(secondDocument, "cell/Profit & Loss Acc!C24")).toBe(
        valueAt(baseline, "cell/Profit & Loss Acc!C24") - fixture.addPurchase.amount + fixture.addSale.amount,
      );

      // report with no arguments reads the session's now-twice-edited lines.
      const reported = await methods["tools/call"]({ name: "report", arguments: {} });
      expect(reported.structuredContent.report).toEqual(secondDocument);
    });

    it("a batch of three edits equals three one-edit batches in sequence, figures and movedFigures included", async () => {
      const batch = [
        { edit: "addPurchaseLine", params: { line: fixture.addPurchase.line } },
        { edit: "addSaleLine", params: { line: fixture.addSale.line } },
        {
          edit: "changeLineAmount",
          params: { entryNumber: fixture.changeSaleLine.entryNumber, newAmount: fixture.changeSaleLine.newAmount },
        },
      ];
      const batched = await toolLayer(book, lines).call("edit_lines", { edits: batch });

      const sequential = toolLayer(book, lines);
      let last;
      for (const single of batch) last = await sequential.call("edit_lines", { edits: [single] });

      expect(batched.report).toEqual(last.report);
      expect(batched.lines).toEqual(last.lines);
      expect(batched.movedFigures).toEqual(diffAgainst(baseline, last.report));
    });

    it("a refusal mid-batch names the edit's index and name and leaves the session's lines as they were", async () => {
      const session = createSession();
      loadIntoSession(session, book, lines);
      const methods = createMethods(session);

      await expect(
        methods["tools/call"]({
          name: "edit_lines",
          arguments: {
            edits: [
              { edit: "addPurchaseLine", params: { line: fixture.addPurchase.line } },
              { edit: "removeLine", params: { entryNumber: "NO-SUCH-ENTRY" } },
            ],
          },
        }),
      ).rejects.toThrow(/^edits\[1\] "removeLine": /);

      expect(session.lines).toEqual(lines);
      const reported = await methods["tools/call"]({ name: "report", arguments: {} });
      expect(reported.structuredContent.report).toEqual(baseline);
    });

    it("removes a sale of Y: profit and turnover both fall by Y", async () => {
      const tools = toolLayer(book, lines);
      const result = await tools.call("edit_lines", {
        edits: [{ edit: "removeLine", params: { entryNumber: fixture.removeSaleLine.entryNumber } }],
      });

      expect(valueAt(result.report, "cell/Profit & Loss Acc!C4") - valueAt(baseline, "cell/Profit & Loss Acc!C4")).toBe(
        -fixture.removeSaleLine.amount,
      );
      expect(valueAt(result.report, "cell/Profit & Loss Acc!C24") - valueAt(baseline, "cell/Profit & Loss Acc!C24")).toBe(
        -fixture.removeSaleLine.amount,
      );
      expectAllChecksPass(result.report);

      const moved = result.movedFigures.find((entry) => entry.key === "cell/Profit & Loss Acc!C24");
      expect(moved.delta).toBe(-fixture.removeSaleLine.amount);
    });

    it("changes a sales line's posting date: its old and new month move by the amount, the year total is unmoved, checks stay green", async () => {
      const tools = toolLayer(book, lines);
      const { entryNumber, newPostingDate, oldMonthCell, newMonthCell, amount } = fixture.changeDateLine;
      const result = await tools.call("edit_lines", {
        edits: [{ edit: "changeLinePostingDate", params: { entryNumber, newPostingDate } }],
      });

      const beforeOld = valueAt(baseline, `cell/Profit & Loss Acc!${oldMonthCell}`);
      const afterOld = valueAt(result.report, `cell/Profit & Loss Acc!${oldMonthCell}`);
      expect(afterOld - beforeOld).toBe(-amount);
      const beforeNew = valueAt(baseline, `cell/Profit & Loss Acc!${newMonthCell}`);
      const afterNew = valueAt(result.report, `cell/Profit & Loss Acc!${newMonthCell}`);
      expect(afterNew - beforeNew).toBe(amount);
      expect(valueAt(result.report, "cell/Profit & Loss Acc!C4")).toBe(valueAt(baseline, "cell/Profit & Loss Acc!C4"));
      expectAllChecksPass(result.report);
    });

    it("changes a purchase line's account: its old and new category move by the amount, net profit is unmoved, checks stay green", async () => {
      const tools = toolLayer(book, lines);
      const { entryNumber, newAccountMainID, oldCategoryCell, newCategoryCell, amount } = fixture.changeAccountLine;
      const result = await tools.call("edit_lines", { edits: [{ edit: "changeLineAccount", params: { entryNumber, newAccountMainID } }] });

      const beforeOld = valueAt(baseline, `cell/Profit & Loss Acc!${oldCategoryCell}`);
      const afterOld = valueAt(result.report, `cell/Profit & Loss Acc!${oldCategoryCell}`);
      expect(afterOld - beforeOld).toBe(-amount);
      const beforeNew = valueAt(baseline, `cell/Profit & Loss Acc!${newCategoryCell}`);
      const afterNew = valueAt(result.report, `cell/Profit & Loss Acc!${newCategoryCell}`);
      expect(afterNew - beforeNew).toBe(amount);
      expect(valueAt(result.report, "cell/Profit & Loss Acc!C24")).toBe(valueAt(baseline, "cell/Profit & Loss Acc!C24"));
      expectAllChecksPass(result.report);
    });

    it("removes a purchase of Z: profit rises by Z, turnover is unchanged", async () => {
      const tools = toolLayer(book, lines);
      const result = await tools.call("edit_lines", {
        edits: [
          {
            edit: "removeLine",
            params: { entryNumber: fixture.removePurchaseLine.entryNumber },
          },
        ],
      });

      expect(valueAt(result.report, "cell/Profit & Loss Acc!C4")).toBe(valueAt(baseline, "cell/Profit & Loss Acc!C4"));
      expect(valueAt(result.report, "cell/Profit & Loss Acc!C24") - valueAt(baseline, "cell/Profit & Loss Acc!C24")).toBe(
        fixture.removePurchaseLine.amount,
      );
      expectAllChecksPass(result.report);

      const moved = result.movedFigures.find((entry) => entry.key === "cell/Profit & Loss Acc!C24");
      expect(moved.delta).toBe(fixture.removePurchaseLine.amount);
    });
  });
}

// ============================================================================
// addPayrollLine: the edit_lines tool's enum names it, and applying it on the
// SE Precision Code advanced book behaves the same through the tool layer as
// diya-gl-edits-payroll.test.js proves it does called directly.
// ============================================================================

describe("diya-gl MCP: addPayrollLine", () => {
  it("lists addPayrollLine among edit_lines's known edit names", async () => {
    const client = startMcpClient();
    try {
      await client.request("initialize", { protocolVersion: "2025-06-18" });
      client.notify("notifications/initialized");
      const listResult = await client.request("tools/list");
      const editTool = listResult.tools.find((tool) => tool.name === "edit_lines");
      expect(editTool.inputSchema.properties.edits.items.properties.edit.enum).toContain("addPayrollLine");
    } finally {
      client.close();
    }
  });

  it("adds a payslip through edit_lines: lines.length rises by one and net pay derives from gross less tax and employee NI", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "advanced"));
    const tools = toolLayer(book, lines);
    const line = {
      "entryNumber": "TEST-PAYROLL-MCP-1",
      "sourceJournalID": "payroll",
      "postingDate": "2025-05-31",
      "accountMainID": "5101",
      "documentType": "payslip",
      "documentReference": "PAY-EMP001-2025-05",
      "detailComment": "Alice Johnson",
      "lineItemComment": "Salary May 2025",
      "taxCode": "OS",
      "taxRate": 0,
      "diya-gl:employeeID": "EMP001",
      "diya-gl:grossPay": 2000,
      "diya-gl:incomeTax": 300,
      "diya-gl:employeeNI": 100,
      "diya-gl:employerNI": 138,
    };
    const result = await tools.call("edit_lines", { edits: [{ edit: "addPayrollLine", params: { line } }] });

    expect(result.lines.length).toBe(lines.length + 1);
    const added = result.lines.find((entry) => entry.entryNumber === "TEST-PAYROLL-MCP-1");
    expect(added["diya-gl:netPay"]).toBe(1600);
    expect(added.amount).toBe(2000);
  });
});

// ============================================================================
// The read tools: lines, chart, book and checks, over a Basic Sole Trader and
// a Limited Company example book, through tools/list and tools/call.
// ============================================================================

describe("diya-gl MCP server: reading every detail of the book", () => {
  const bstBook = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "bst"));
  const ltdBook = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "full"));
  const pence = (amount) => Math.round(amount * 100);

  it("advertises each read tool with the questions it answers", async () => {
    const { tools } = await createMethods()["tools/list"]();
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    expect(byName.lines.description).toContain("Who is my best customer?");
    expect(byName.lines.description).toContain("Which suppliers cost most?");
    expect(byName.lines.description).toContain("What did I spend on fuel in June?");
    for (const name of ["chart", "book", "checks"]) expect(byName[name].description).toMatch(/Answers: .+\?/);
    expect(Object.keys(byName.lines.inputSchema.properties)).toEqual(
      expect.arrayContaining(["journal", "accountMainID", "from", "to", "text", "documentReference", "groupBy", "top", "book", "lines"]),
    );
  });

  it("names the best customer of a Basic Sole Trader book with its sales total in pence", async () => {
    const { book, lines } = bstBook;
    const answer = await toolLayer(book, lines).call("lines", { journal: "sales", groupBy: "detailComment", top: 1 });
    const totals = {};
    for (const line of lines.filter((entry) => entry.sourceJournalID === "sales")) {
      totals[line.detailComment] = (totals[line.detailComment] || 0) + pence(line.amount);
    }
    const [bestName, bestPence] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    expect(answer.groups).toHaveLength(1);
    expect(answer.groups[0]).toMatchObject({ key: bestName, totalPence: bestPence });
    expect(answer.groups[0].entryNumbers).toEqual(
      lines.filter((line) => line.sourceJournalID === "sales" && line.detailComment === bestName).map((line) => line.entryNumber),
    );
    expect(answer.count).toBe(lines.filter((line) => line.sourceJournalID === "sales").length);
  });

  it("reduces a customer's total by a credit note against them", async () => {
    const { book, lines } = bstBook;
    const credit = {
      ...lines.find((line) => line.detailComment === "Acme Corp"),
      entryNumber: "CREDIT-1",
      amount: 100,
      documentType: "credit-note",
    };
    const tools = toolLayer(book, [...lines, credit]);
    const before = await toolLayer(book, lines).call("lines", { journal: "sales", text: "Acme Corp" });
    const after = await tools.call("lines", { journal: "sales", text: "Acme Corp" });
    expect(after.totalPence).toBe(before.totalPence - 10000);
  });

  it("takes a bad debt written off against a customer off that customer's sales total", async () => {
    const { book, lines } = bstBook;
    const writeOff = lines.find((line) => line.entryNumber === "TXN-0705");
    expect(writeOff).toMatchObject({ accountMainID: "4005", documentType: "credit-note", amount: 360, detailComment: "Zeta Corp" });
    const answer = await toolLayer(book, lines).call("lines", { journal: "sales", groupBy: "detailComment" });
    const zeta = answer.groups.find((group) => group.key === "Zeta Corp");
    expect(zeta.entryNumbers).toEqual(["TXN-0705"]);
    expect(zeta.totalPence).toBe(-36000);
  });

  it("answers what was spent on fuel in June: motor lines dated in June, text match, totalled", async () => {
    const { book, lines } = bstBook;
    const answer = await toolLayer(book, lines).call("lines", { journal: "purchases", text: "FUEL", from: "2025-06-01", to: "2025-06-30" });
    const expected = lines.filter(
      (line) =>
        line.sourceJournalID === "purchases" &&
        line.postingDate >= "2025-06-01" &&
        line.postingDate <= "2025-06-30" &&
        `${line.detailComment} ${line.lineItemComment}`.toLowerCase().includes("fuel"),
    );
    expect(expected.length).toBeGreaterThan(0);
    expect(answer.lines.map((line) => line.entryNumber)).toEqual(expected.map((line) => line.entryNumber));
    expect(answer.totalPence).toBe(expected.reduce((sum, line) => sum + pence(line.amount), 0));
  });

  it("groups by month in date order and by account largest first, naming the account", async () => {
    const { book, lines } = ltdBook;
    const tools = toolLayer(book, lines);
    const months = await tools.call("lines", { journal: "sales", groupBy: "month" });
    const keys = months.groups.map((group) => group.key);
    expect(keys).toEqual([...keys].sort());
    expect(months.groups.reduce((sum, group) => sum + group.count, 0)).toBe(months.count);

    const accounts = await tools.call("lines", { journal: "purchases", groupBy: "accountMainID", top: 3 });
    expect(accounts.groups).toHaveLength(3);
    const magnitudes = accounts.groups.map((group) => Math.abs(group.totalPence));
    expect(magnitudes).toEqual([...magnitudes].sort((a, b) => b - a));
    for (const group of accounts.groups) expect(group.name).toBe(book.accounts.purchases[group.key].accountMainDescription);
  });

  it("filters by account and documentReference, and gives the largest lines with top alone", async () => {
    const { book, lines } = ltdBook;
    const tools = toolLayer(book, lines);
    const reference = lines.find((line) => line.documentReference && line.sourceJournalID === "sales").documentReference;
    const byReference = await tools.call("lines", { documentReference: reference.toLowerCase() });
    expect(byReference.count).toBeGreaterThan(0);
    for (const line of byReference.lines) expect(line.documentReference.toLowerCase()).toContain(reference.toLowerCase());

    const rent = await tools.call("lines", { accountMainID: ["5200"] });
    expect(rent.count).toBe(lines.filter((line) => line.accountMainID === "5200").length);

    const largest = await tools.call("lines", { journal: "purchases", top: 5 });
    expect(largest.lines).toHaveLength(5);
    const largestAmount = Math.max(...lines.filter((line) => line.sourceJournalID === "purchases").map((line) => line.amount));
    expect(largest.lines[0].amount).toBe(largestAmount);
  });

  it("refuses a grouping it does not know by name", async () => {
    const { book, lines } = bstBook;
    await expect(toolLayer(book, lines).call("lines", { groupBy: "colour" })).rejects.toThrow(
      /groupBy must be one of detailComment, accountMainID, month/,
    );
  });

  it("lists the chart of accounts with each account's activity and the report row it feeds", async () => {
    for (const [{ book, lines }, premisesRow] of [
      [bstBook, "section/profit-loss-account/premises-costs"],
      [ltdBook, "section/profit-loss-account/premises-code-r"],
    ]) {
      const { accounts } = await toolLayer(book, lines).call("chart", {});
      const declared = Object.entries(book.accounts).flatMap(([group, table]) => Object.keys(table).map((id) => `${group}/${id}`));
      expect(accounts.map((account) => `${account.group}/${account.id}`)).toEqual(declared);
      const rent = accounts.find((account) => account.id === "5200");
      expect(rent.name).toBe(book.accounts.purchases["5200"].accountMainDescription);
      expect(rent.lineCount).toBe(lines.filter((line) => line.accountMainID === "5200").length);
      expect(rent.feeds.map((row) => row.key)).toContain(premisesRow);
    }
  });

  it("gives the book's profile: product, period, bank accounts, journals present and registers", async () => {
    const { book, lines } = ltdBook;
    const profile = await toolLayer(book, lines).call("book", {});
    expect(profile.product).toBe("ltd");
    expect(profile.period).toEqual({ start: "2025-04-01", end: "2026-03-31" });
    expect(profile.entity.organizationIdentifier).toBe(book.entityInformation.organizationIdentifier);
    expect(profile.bankAccounts.map((account) => account.id)).toEqual(Object.keys(book.accounts.bank));
    expect(profile.journals.reduce((sum, journal) => sum + journal.count, 0)).toBe(lines.length);
    expect(profile.journals.map((journal) => journal.journal)).toEqual([...new Set(lines.map((line) => line.sourceJournalID))].sort());
    expect(profile.directors).toHaveLength(book.directors.length);
    expect(profile.tax.vat).toBeDefined();
  });

  it("gives every book check its verdict and the entryNumbers of the lines that fail it", async () => {
    const { book, lines } = bstBook;
    const outside = { ...lines[0], postingDate: "2024-01-15" };
    const { summary, checks } = await toolLayer(book, lines).call("checks", { lines: [outside, ...lines.slice(1)] });
    const dates = checks.find((check) => check.id === "book-dates-in-period");
    expect(dates.verdict).toBe("fail");
    expect(dates.entryNumbers).toEqual([outside.entryNumber]);
    expect(summary.fail).toBeGreaterThan(0);
    const clean = await toolLayer(book, lines).call("checks", {});
    expect(clean.checks.find((check) => check.id === "book-dates-in-period")).toMatchObject({ verdict: "pass", entryNumbers: [] });
  });
});
