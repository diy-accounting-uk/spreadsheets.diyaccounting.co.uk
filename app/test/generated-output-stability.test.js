// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// generated-output-stability.test.js — The generate-ltd workflow commits nothing for unchanged
// input, so every output it commits must come out byte-identical on a second build.

import { describe, it, expect, afterEach } from "vitest";
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import {
  buildProductMetadata,
  buildProductPage,
  renderIndexPage,
  renderProductPage,
  templateCommitDate,
} from "../bin/build-reconciliation-pages.js";
import { xlsxSameContent } from "../lib/xlsx-same-content.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPORTS = resolve(ROOT, "reports");
const tempDirs = [];

afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

function reportsDirWithOneCompanyReport() {
  const dir = mkdtempSync(join(tmpdir(), "stability-reports-"));
  tempDirs.push(dir);
  const name = readdirSync(REPORTS).find((file) => file.startsWith("GB_Accounts_Company_") && file.endsWith("ltd-scenario-full.md"));
  copyFileSync(join(REPORTS, name), join(dir, name));
  return dir;
}

function buildPages(reportsDir, updated) {
  const built = buildProductPage("ltd", { reportsDir });
  const metadata = buildProductMetadata("ltd", built, [], updated);
  return {
    json: JSON.stringify(metadata, null, 2),
    product: renderProductPage("ltd", built, []),
    index: renderIndexPage({ ltd: metadata }),
  };
}

describe("reconciliation page output", () => {
  it("is byte-identical when built twice from the same reports and date", () => {
    const reportsDir = reportsDirWithOneCompanyReport();
    expect(buildPages(reportsDir, "2026-01-02")).toEqual(buildPages(reportsDir, "2026-01-02"));
  });

  it("takes its updated date from the date given, not from the clock", () => {
    const reportsDir = reportsDirWithOneCompanyReport();
    expect(JSON.parse(buildPages(reportsDir, "2026-01-02").json).updated).toBe("2026-01-02");
  });

  it("dates the page by the last commit to the product's templates", () => {
    expect(templateCommitDate("ltd")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

async function workbook(entryDate, validations) {
  const zip = new JSZip();
  zip.file("xl/worksheets/sheet1.xml", `<worksheet><dataValidations count="2">${validations.join("")}</dataValidations></worksheet>`, {
    date: entryDate,
  });
  zip.file("xl/workbook.xml", "<workbook/>", { date: entryDate });
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("xlsxSameContent", () => {
  const first = '<dataValidation sqref="A1" type="date"><formula1>1</formula1></dataValidation>';
  const second = '<dataValidation sqref="B2" type="list"><formula1>"a,b"</formula1></dataValidation>';

  it("ignores zip entry times and the order of data validations", async () => {
    const a = await workbook(new Date("2026-01-01T00:00:00Z"), [first, second]);
    const b = await workbook(new Date("2026-06-01T12:00:00Z"), [second, first]);
    expect(a.equals(b)).toBe(false);
    expect(await xlsxSameContent(a, b)).toBe(true);
  });

  it("reports a changed validation as a change", async () => {
    const a = await workbook(new Date("2026-01-01T00:00:00Z"), [first, second]);
    const b = await workbook(new Date("2026-01-01T00:00:00Z"), [first, second.replace("B2", "C3")]);
    expect(await xlsxSameContent(a, b)).toBe(false);
  });
});
