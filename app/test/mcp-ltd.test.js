// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// mcp-ltd.test.js -- the diya-gl-tools.js MCP tools over a Company book,
// following diya-gl-mcp.test.js's own harness (the stdio client for
// extract_book/save_workbook, the in-process tool layer for edit_lines).
//
// No LibreOffice: everything here is the JS engine, exactly as
// export-file-ltd.test.js and diya-gl-mcp.test.js already run it.

import { describe, it, expect, afterEach } from "vitest";
import { execFileSync, spawn } from "child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { createMethods } from "../lib/mcp/server.js";
import { createSession, loadIntoSession } from "../lib/mcp/diya-gl-tools.js";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";
import { savePackageZip } from "../lib/product-workbook.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const NODE = process.execPath;
const MCP_BIN = resolve(ROOT, "app", "bin", "diya-gl-mcp.js");
const EXPORT_BIN = resolve(ROOT, "app", "bin", "export.js");
const LTD_SOURCE_DIR = resolve(ROOT, "examples", "ltd-latest");
// The diya-gl book behind the edit tests: the fixture book-checks-ltd.test.js
// and ltd-workbook.test.js also anchor to, chosen because it carries the
// tax.nationalInsurance.class2WeeklyRate field a freshly extracted Ltd
// book.toml does not (a Company's own tax-year data has no
// [national_insurance] table, only [employer_ni] -- see
// diya-gl-loader.js's extractTaxDataFromBook).
const LTD_BOOK_DIR = resolve(ROOT, "examples", "precision-code-ltd", "full");

const tempDirs = [];
function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

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

// A minimal stdio JSON-RPC client, the same one diya-gl-mcp.test.js drives
// the diya-gl-mcp.js binary with.
function startMcpClient() {
  const proc = spawn(NODE, [MCP_BIN], { cwd: ROOT });
  let buffer = "";
  const pending = new Map();
  let nextId = 1;

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

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolvePromise, reject) => {
      pending.set(id, { resolve: resolvePromise, reject });
      proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }
  async function callTool(name, args) {
    const result = await request("tools/call", { name, arguments: args });
    return JSON.parse(result.content[0].text);
  }
  function close() {
    proc.kill();
  }

  return { request, callTool, close };
}

// In-process: a direct call into the JSON-RPC method table, over a session
// seeded straight from D (loadDiyaGlData), the way diya-gl-mcp.test.js's
// own toolLayer() runs the edit-recalc replay.
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

function valueAt(document, key) {
  const entry = document.values.find((v) => v.key === key);
  if (!entry) throw new Error(`R carries no value for ${key}`);
  return Number(entry.value);
}

describe("extract_book: a Company package, byte-for-byte with export.js --file", () => {
  it("matches book.toml and lines.jsonl exactly, and carries no overtype sidecar yet", async () => {
    const zipPath = await packageZipOf(LTD_SOURCE_DIR, resolve(tempDir("mcp-extract-ltd-zip-"), "ltd-package.zip"));

    const cliOutput = tempDir("mcp-extract-ltd-cli-out-");
    execFileSync(NODE, [EXPORT_BIN, "--package", "ltd", "--file", zipPath, "--output-dir", cliOutput], { cwd: ROOT });
    const cliBookToml = readFileSync(resolve(cliOutput, "book.toml"), "utf8");
    const cliLinesJsonl = readFileSync(resolve(cliOutput, "lines.jsonl"), "utf8");

    const client = startMcpClient();
    try {
      const extracted = await client.callTool("extract_book", { path: zipPath });
      expect(extracted.report.package).toBe("ltd");
      expect(extracted.bookToml).toBe(cliBookToml);
      expect(extracted.linesJsonl).toBe(cliLinesJsonl);
      // No ltd branch in readWorkbookSource's overtype sidecar wiring yet
      // (see export-file-ltd.test.js) -- the field is absent, not empty.
      expect(extracted.overtyped).toBeUndefined();
    } finally {
      client.close();
    }
  }, 30000);
});

describe("save_workbook: a Company package", () => {
  it("hands back a zip with all thirteen workbooks and the dividend voucher docx, byte-identical to savePackageZip", async () => {
    const zipPath = await packageZipOf(LTD_SOURCE_DIR, resolve(tempDir("mcp-save-ltd-zip-"), "ltd-package.zip"));

    const client = startMcpClient();
    try {
      const extracted = await client.callTool("extract_book", { path: zipPath });
      const saved = await client.callTool("save_workbook", { format: "zip" });

      expect(saved.format).toBe("zip");
      const bytes = Buffer.from(saved.base64, "base64");
      const zip = await JSZip.loadAsync(bytes);
      const entries = Object.keys(zip.files).filter((name) => !zip.files[name].dir);

      expect(entries.length).toBe(14);
      const xlsxEntries = entries.filter((name) => name.endsWith(".xlsx"));
      const docxEntries = entries.filter((name) => name.endsWith(".docx"));
      expect(xlsxEntries.length).toBe(13);
      expect(docxEntries.length).toBe(1);
      const dirName = saved.filename.replace(/\.zip$/, "");
      for (const entry of entries) expect(entry.startsWith(`${dirName}/`)).toBe(true);

      // The same book and lines the session loaded, run through
      // savePackageZip directly in Node, produce the exact same zip bytes.
      const { zip: directZip, filename: directFilename } = await savePackageZip(extracted.book, extracted.lines);
      expect(saved.filename).toBe(directFilename);
      expect(bytes.equals(Buffer.from(directZip))).toBe(true);
    } finally {
      client.close();
    }
  }, 600000); // composes the thirteen-workbook package twice; ltd-workbook.test.js's own package-composition tests carry the same budget

  it("refuses format xlsx by name, naming the Company package", async () => {
    const zipPath = await packageZipOf(LTD_SOURCE_DIR, resolve(tempDir("mcp-save-ltd-refuse-zip-"), "ltd-package.zip"));

    const client = startMcpClient();
    try {
      await client.callTool("extract_book", { path: zipPath });
      await expect(client.request("tools/call", { name: "save_workbook", arguments: { format: "xlsx" } })).rejects.toThrow(
        "a Company book saves as its package zip, not as one workbook",
      );
    } finally {
      client.close();
    }
  }, 30000);
});

describe("edit_lines: the Ltd-only edits", () => {
  it("changePayrollLine moves the payroll line's own WagesInterface figure and returns movedFigures anchored to it", async () => {
    const { book, lines } = loadDiyaGlData(LTD_BOOK_DIR);
    const tools = toolLayer(book, lines);

    // TXN-0076: Carol Smith (EMP003, a director), April 2025, gross pay
    // 1048 -- WagesInterface's director block reads April as row 17 (see
    // app/products/ltd.js's WAGES_INTERFACE_DIRECTOR_FIRST_ROW), and she is
    // the fixture's only director, so that cell is hers alone.
    const line = lines.find((entry) => entry.entryNumber === "TXN-0076");
    expect(line.sourceJournalID).toBe("payroll");
    const key = "cell/Financialaccounts.xlsx!WagesInterface!C17";

    const baseline = await tools.call("report", {});
    const grossPayBefore = valueAt(baseline.report, key);
    expect(grossPayBefore).toBe(line["diya-gl:grossPay"]);

    const raise = 100;
    const result = await tools.call("edit_lines", {
      edit: "changePayrollLine",
      params: { entryNumber: "TXN-0076", grossPay: grossPayBefore + raise },
    });

    expect(valueAt(result.report, key)).toBe(grossPayBefore + raise);
    expect(result.book).toBeUndefined(); // a line edit, not a book edit

    const moved = result.movedFigures.find((entry) => entry.key === key);
    expect(moved).toBeDefined();
    expect(moved.delta).toBe(raise);
  });

  it("setDividend returns the new book and moves PubP&L!F52 by the change in the declared amount", async () => {
    const { book, lines } = loadDiyaGlData(LTD_BOOK_DIR);
    const tools = toolLayer(book, lines);
    const key = "cell/Financialaccounts.xlsx!PubP&L!F52";

    const baseline = await tools.call("report", {});
    const dividendBefore = valueAt(baseline.report, key);
    expect(dividendBefore).toBe(book.dividends[0].amount);

    const increase = 1000;
    const newAmount = dividendBefore + increase;
    const result = await tools.call("edit_lines", {
      edit: "setDividend",
      params: { boardMeetingDate: "2026-02-01", amount: newAmount },
    });

    expect(result.book).toBeDefined();
    expect(result.book.dividends).toEqual([{ boardMeetingDate: "2026-02-01", amount: newAmount }]);
    expect(valueAt(result.report, key)).toBe(newAmount);

    const moved = result.movedFigures.find((entry) => entry.key === key);
    expect(moved).toBeDefined();
    expect(moved.delta).toBe(increase);
  });
});

describe("tools/list: the Ltd edits are named in edit_lines's enum", () => {
  it("lists changePayrollLine, setDividend, setMembers and setCharges alongside the shared edits", async () => {
    const client = startMcpClient();
    try {
      const listResult = await client.request("tools/list");
      const editTool = listResult.tools.find((tool) => tool.name === "edit_lines");
      const editNames = editTool.inputSchema.properties.edit.enum;
      for (const name of ["changePayrollLine", "setDividend", "setMembers", "setCharges"]) {
        expect(editNames).toContain(name);
      }
    } finally {
      client.close();
    }
  });
});
