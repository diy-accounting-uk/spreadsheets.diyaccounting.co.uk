// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// diya-gl-mcp.test.js — the stdio MCP server exposing the diya-gl BST
// pipeline as four tools (Phase 2 of
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
import * as bst from "../products/bst.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const NODE = process.execPath;
const MCP_BIN = resolve(ROOT, "app", "bin", "diya-gl-mcp.js");
const EXPORT_BIN = resolve(ROOT, "app", "bin", "export.js");
const BST_XLSX = resolve(ROOT, "examples", "bst-latest", "GB_Accounts_Basic_Sole_Trader.xlsx");
const SE_PACKAGE_DIR = resolve(ROOT, "examples", "se-latest");

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
  it("initializes, lists exactly the four planned tools, and answers tools/call", async () => {
    const client = startMcpClient();
    try {
      const initResult = await client.request("initialize", { protocolVersion: "2025-06-18" });
      expect(initResult.serverInfo.name).toBe("diya-gl");
      expect(initResult.protocolVersion).toBe("2025-06-18");

      client.notify("notifications/initialized");

      const listResult = await client.request("tools/list");
      const names = listResult.tools.map((tool) => tool.name).sort();
      expect(names).toEqual(["edit_lines", "extract_book", "report", "save_workbook"]);
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

  it("save_workbook format xlsx on an SE session answers with the single-file refusal and format zip returns nine entries under dirName", async () => {
    const zipDir = tempDir("mcp-save-se-zip-");
    const zipPath = await packageZipOf(SE_PACKAGE_DIR, resolve(zipDir, "se-package.zip"));

    const client = startMcpClient();
    try {
      await client.callTool("extract_book", { path: zipPath });

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

  it("extract_book on the SE package zip returns product se and the same lines.jsonl as export.js", async () => {
    const zipDir = tempDir("mcp-extract-se-zip-");
    const zipPath = await packageZipOf(SE_PACKAGE_DIR, resolve(zipDir, "se-package.zip"));

    const cliOutput = tempDir("mcp-extract-se-cli-out-");
    execFileSync(NODE, [EXPORT_BIN, "--package", "se", "--source-dir", SE_PACKAGE_DIR, "--output-dir", cliOutput], { cwd: ROOT });
    const cliLinesJsonl = readFileSync(resolve(cliOutput, "lines.jsonl"), "utf8");

    const client = startMcpClient();
    try {
      const extracted = await client.callTool("extract_book", { path: zipPath });
      expect(extracted.report.package).toBe("se");
      expect(extracted.linesJsonl).toBe(cliLinesJsonl);
    } finally {
      client.close();
    }
  }, 30000);
});

// ============================================================================
// extract_book on the interchange formats books-interchange.js added: a
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

    const { writeBookJson } = await import("../lib/books-interchange.js");
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
      expect(document.format).toBe("diya-gl-books");
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
      const result = await tools.call("edit_lines", { edit: "addPurchaseLine", params: { line: fixture.addPurchase.line } });

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
      const result = await tools.call("edit_lines", { edit: "addSaleLine", params: { line: fixture.addSale.line } });

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
      const result = await tools.call("edit_lines", { edit: "changeLineAmount", params: { entryNumber, newAmount } });

      expect(valueAt(result.report, "cell/Profit & Loss Acc!C4") - valueAt(baseline, "cell/Profit & Loss Acc!C4")).toBe(delta);
      expect(valueAt(result.report, "cell/Profit & Loss Acc!C24") - valueAt(baseline, "cell/Profit & Loss Acc!C24")).toBe(delta);
      expectAllChecksPass(result.report);
    });

    it("changes a purchase line's amount: its category and net profit move by the difference, checks stay green", async () => {
      const tools = toolLayer(book, lines);
      const { entryNumber, newAmount, delta, categoryCell } = fixture.changePurchaseLine;
      const result = await tools.call("edit_lines", { edit: "changeLineAmount", params: { entryNumber, newAmount } });

      const before = valueAt(baseline, `cell/Profit & Loss Acc!${categoryCell}`);
      const after = valueAt(result.report, `cell/Profit & Loss Acc!${categoryCell}`);
      expect(after - before).toBe(delta);
      expect(valueAt(result.report, "cell/Profit & Loss Acc!C4")).toBe(valueAt(baseline, "cell/Profit & Loss Acc!C4"));
      expect(valueAt(result.report, "cell/Profit & Loss Acc!C24") - valueAt(baseline, "cell/Profit & Loss Acc!C24")).toBe(-delta);
      expectAllChecksPass(result.report);
    });

    it("edit_lines composes: the session's lines carry the first edit into the second", async () => {
      const session = createSession();
      loadIntoSession(session, book, lines);
      const methods = createMethods(session);

      const first = await methods["tools/call"]({
        name: "edit_lines",
        arguments: { edit: "addPurchaseLine", params: { line: fixture.addPurchase.line } },
      });
      const second = await methods["tools/call"]({
        name: "edit_lines",
        arguments: { edit: "addSaleLine", params: { line: fixture.addSale.line } },
      });

      const secondDocument = second.structuredContent.report;
      const expectedTurnover = valueAt(baseline, "cell/Profit & Loss Acc!C4") + fixture.addSale.amount;
      const expectedProfit = valueAt(baseline, "cell/Profit & Loss Acc!C24") - fixture.addPurchase.amount + fixture.addSale.amount;
      expect(valueAt(secondDocument, "cell/Profit & Loss Acc!C4")).toBe(expectedTurnover);
      expect(valueAt(secondDocument, "cell/Profit & Loss Acc!C24")).toBe(expectedProfit);

      // report with no arguments reads the session's now-twice-edited lines.
      const reported = await methods["tools/call"]({ name: "report", arguments: {} });
      expect(reported.structuredContent.report).toEqual(secondDocument);
      void first;
    });

    it("removes a sale of Y: profit and turnover both fall by Y", async () => {
      const tools = toolLayer(book, lines);
      const result = await tools.call("edit_lines", { edit: "removeLine", params: { entryNumber: fixture.removeSaleLine.entryNumber } });

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
      const result = await tools.call("edit_lines", { edit: "changeLinePostingDate", params: { entryNumber, newPostingDate } });

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
      const result = await tools.call("edit_lines", { edit: "changeLineAccount", params: { entryNumber, newAccountMainID } });

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
        edit: "removeLine",
        params: { entryNumber: fixture.removePurchaseLine.entryNumber },
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
