// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// workbook-set.test.js — the three ways a set of workbooks is built and the
// one shape they all answer through. Every fixture here is assembled in the
// test: a directory written to a temp path, a zip built with JSZip, and a
// single workbook's bytes, so what each adapter finds and what it refuses
// are both visible in the file.

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { mkdtempSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  workbookSetFromDirectory,
  workbookSetFromZipBytes,
  workbookSetFromWorkbook,
  isWorkbookEntry,
  workbookBaseName,
  WorkbookSetError,
} from "../lib/workbook-set.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const HUB_PATH = resolve(ROOT, "app", "templates", "se", "Financialaccounts.xlsx");
const BANK_PATH = resolve(ROOT, "app", "templates", "se", "Bank.xlsx");
const HUB_BYTES = readFileSync(HUB_PATH);
const BANK_BYTES = readFileSync(BANK_PATH);

async function zipOf(entries) {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) zip.file(name, content);
  return zip.generateAsync({ type: "uint8array" });
}

function directoryOf(files) {
  const dir = mkdtempSync(join(tmpdir(), "workbook-set-"));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

describe("workbookSetFromDirectory", () => {
  it("names every workbook in a directory and nothing else", async () => {
    const dir = directoryOf({
      "Financialaccounts.xlsx": HUB_BYTES,
      "Bank.xlsx": BANK_BYTES,
      "se-guide.pdf": Buffer.from("%PDF-1.4\n"),
    });
    const set = await workbookSetFromDirectory(dir);
    expect(set.names()).toEqual(["Bank.xlsx", "Financialaccounts.xlsx"]);
    expect(set.has("se-guide.pdf")).toBe(false);
  });

  it("matches a name by basename whatever case it arrived in", async () => {
    const dir = directoryOf({ "Financialaccounts.xlsx": HUB_BYTES });
    const set = await workbookSetFromDirectory(dir);
    expect(set.has("FINANCIALACCOUNTS.XLSX")).toBe(true);
    expect(set.has("financialaccounts.xlsx")).toBe(true);
    expect(await set.zip("financialaccounts.xlsx")).toBeDefined();
  });

  it("hands back the file's own bytes", async () => {
    const dir = directoryOf({ "Bank.xlsx": BANK_BYTES });
    const set = await workbookSetFromDirectory(dir);
    expect(Buffer.from(await set.bytes("Bank.xlsx")).equals(BANK_BYTES)).toBe(true);
  });
});

describe("workbookSetFromZipBytes", () => {
  it("reads a package zip whose entries sit under the package's own directory", async () => {
    const bytes = await zipOf({
      "GB_Accounts_Self_Employed_2026/Financialaccounts.xlsx": HUB_BYTES,
      "GB_Accounts_Self_Employed_2026/Bank.xlsx": BANK_BYTES,
      "GB_Accounts_Self_Employed_2026/se-guide.pdf": "%PDF-1.4\n",
    });
    const set = await workbookSetFromZipBytes(bytes);
    expect(set.names()).toEqual(["Bank.xlsx", "Financialaccounts.xlsx"]);
    expect(Buffer.from(await set.bytes("Financialaccounts.xlsx")).equals(HUB_BYTES)).toBe(true);
  });

  it("ignores a macOS re-zip's __MACOSX entries and its ._ shadows", async () => {
    const bytes = await zipOf({
      "package/Financialaccounts.xlsx": HUB_BYTES,
      "package/._Financialaccounts.xlsx": "resource fork",
      "__MACOSX/package/._Bank.xlsx": "resource fork",
      "__MACOSX/package/Bank.xlsx": "resource fork",
    });
    const set = await workbookSetFromZipBytes(bytes);
    expect(set.names()).toEqual(["Financialaccounts.xlsx"]);
    expect(set.has("Bank.xlsx")).toBe(false);
  });

  it("refuses two entries with the same basename, naming both paths", async () => {
    const bytes = await zipOf({
      "package/Bank.xlsx": BANK_BYTES,
      "backup/Bank.xlsx": BANK_BYTES,
    });
    let caught;
    try {
      await workbookSetFromZipBytes(bytes);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(WorkbookSetError);
    expect(caught.message).toContain("package/Bank.xlsx");
    expect(caught.message).toContain("backup/Bank.xlsx");
  });

  it("opens each workbook once and hands back the same instance", async () => {
    const bytes = await zipOf({ "Financialaccounts.xlsx": HUB_BYTES });
    const set = await workbookSetFromZipBytes(bytes);
    expect(await set.zip("Financialaccounts.xlsx")).toBe(await set.zip("Financialaccounts.xlsx"));
  });

  it("opens nothing until asked", async () => {
    const bytes = await zipOf({ "Financialaccounts.xlsx": HUB_BYTES, "Broken.xlsx": "not a workbook at all" });
    const set = await workbookSetFromZipBytes(bytes);
    expect(set.names()).toEqual(["Broken.xlsx", "Financialaccounts.xlsx"]);
    expect(await set.zip("Financialaccounts.xlsx")).toBeDefined();
    await expect(set.zip("Broken.xlsx")).rejects.toThrow();
  });

  it("refuses a name it has not got, naming what it carries", async () => {
    const bytes = await zipOf({ "Financialaccounts.xlsx": HUB_BYTES });
    const set = await workbookSetFromZipBytes(bytes);
    expect(set.has("Payslips.xlsx")).toBe(false);
    await expect(set.zip("Payslips.xlsx")).rejects.toThrow(WorkbookSetError);
    await expect(set.zip("Payslips.xlsx")).rejects.toThrow(/Financialaccounts\.xlsx/);
  });
});

describe("workbookSetFromWorkbook", () => {
  it("names the one workbook a single-workbook set was built with", async () => {
    const set = await workbookSetFromWorkbook("GB_Accounts_Basic_Sole_Trader.xlsx", HUB_BYTES);
    expect(set.names()).toEqual(["GB_Accounts_Basic_Sole_Trader.xlsx"]);
    expect(set.has("gb_accounts_basic_sole_trader.xlsx")).toBe(true);
    expect(Buffer.from(await set.bytes(set.names()[0])).equals(HUB_BYTES)).toBe(true);
  });
});

describe("the entry rules zipKind and the page share", () => {
  it("counts a workbook by its extension, past a directory prefix", () => {
    expect(isWorkbookEntry("package/Bank.xlsx")).toBe(true);
    expect(isWorkbookEntry("package/Bank.XLSX")).toBe(true);
    expect(isWorkbookEntry("package/se-guide.pdf")).toBe(false);
    expect(isWorkbookEntry("__MACOSX/package/Bank.xlsx")).toBe(false);
    expect(isWorkbookEntry("package/._Bank.xlsx")).toBe(false);
  });

  it("takes the last path segment as the name", () => {
    expect(workbookBaseName("a/b/Bank.xlsx")).toBe("Bank.xlsx");
    expect(workbookBaseName("Bank.xlsx")).toBe("Bank.xlsx");
  });
});
