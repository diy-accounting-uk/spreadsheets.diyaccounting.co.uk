// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";

import { saveBstWorkbook, saveBstPackageZip, taxYearFileName, BookFieldError } from "../lib/bst-workbook.js";
import { nodeResourceLoader } from "../lib/app-resources.js";
import { generateSpreadsheet, packageNaming } from "../lib/generator.js";
import { applyCellWrites, buildSheetMap, readCellValue, loadSharedStrings } from "../lib/spreadsheet-runner.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { cellWrites } from "../products/bst.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP_DIR, "..");

const FIXTURES = [
  ["precision-code-ltd", "examples/precision-code-ltd/bst"],
  ["brickwork-pro", "examples/brickwork-pro/bst-nonvat"],
  ["sp-sixty-driving", "examples/sp-sixty-driving/bst"],
];

// The steps the CLI ran before there was a save function: generate the year's
// workbook from the template, then write the scenario's cells into it. A
// difference here means the two have drifted apart.
async function workbookTheGeneratePathComposes(book, lines) {
  const productMeta = parseTOML(readFileSync(resolve(APP_DIR, "templates/bst/meta.toml"), "utf8"));
  const sharedMeta = parseTOML(readFileSync(resolve(APP_DIR, "templates/meta.toml"), "utf8"));
  const taxData = parseTOML(
    readFileSync(resolve(APP_DIR, `data/${taxYearFileName(new Date(book.documentInfo.periodCoveredEnd))}.toml`), "utf8"),
  );

  const templateBuffer = readFileSync(resolve(APP_DIR, "templates/bst", productMeta.template.spreadsheet));
  const generated = await generateSpreadsheet(templateBuffer, taxData, productMeta.sheets);
  const workbook = await applyCellWrites(generated, cellWrites(diyaGlToScenario(book, lines, "bst")));

  const { xlsxFilename } = packageNaming(productMeta, sharedMeta, new Date(taxData.tax_year.end));
  return { workbook, filename: xlsxFilename };
}

async function readCell(workbook, sheetName, cellRef) {
  const zip = await JSZip.loadAsync(workbook);
  const sheetPath = (await buildSheetMap(zip)).get(sheetName);
  const sharedStrings = await loadSharedStrings(zip);
  return readCellValue(await zip.file(sheetPath).async("string"), cellRef, sharedStrings);
}

describe("saveBstWorkbook", () => {
  for (const [name, dir] of FIXTURES) {
    it(`writes ${name} to the same bytes the generate path composes`, async () => {
      const { book, lines } = loadDiyaGlData(resolve(ROOT, dir));

      const carved = await saveBstWorkbook(book, lines);
      const composed = await workbookTheGeneratePathComposes(book, lines);

      expect(carved.filename).toBe(composed.filename);
      expect(Buffer.compare(carved.workbook, composed.workbook)).toBe(0);
    }, 120000);
  }

  it("names the workbook for the tax year the book's period ends in", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/precision-code-ltd/bst"));
    const { filename } = await saveBstWorkbook(book, lines);
    expect(filename).toBe("Financialaccountsto050426.xlsx");
  }, 120000);

  it("carries the book's own figures, not the template's", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/brickwork-pro/bst-nonvat"));
    const { workbook } = await saveBstWorkbook(book, lines);

    expect(await readCell(workbook, "Business Details", "C5")).toBe(book.entityInformation.organizationIdentifier);
    expect(await readCell(workbook, "Business Details", "C10")).toBe(book.entityInformation.organizationTown);
  }, 120000);

  it("asks the spreadsheet app to recalculate on open", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/sp-sixty-driving/bst"));
    const { workbook } = await saveBstWorkbook(book, lines);
    const zip = await JSZip.loadAsync(workbook);
    expect(await zip.file("xl/workbook.xml").async("string")).toContain('fullCalcOnLoad="1"');
  }, 120000);
});

describe("the resource loader seam", () => {
  it("reads every resource through the injected loader", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/precision-code-ltd/bst"));

    // A loader with nothing behind it but a map: anything the save path still
    // reached for through fs would be missing from the answer, not silently
    // served from disk.
    const held = new Map([
      ["templates/bst/meta.toml", readFileSync(resolve(APP_DIR, "templates/bst/meta.toml"), "utf8")],
      ["templates/meta.toml", readFileSync(resolve(APP_DIR, "templates/meta.toml"), "utf8")],
      ["data/se-2025-2026.toml", readFileSync(resolve(APP_DIR, "data/se-2025-2026.toml"), "utf8")],
      ["templates/bst/bst-excel.xlsx", readFileSync(resolve(APP_DIR, "templates/bst/bst-excel.xlsx"))],
    ]);
    const asked = [];
    const resources = {
      async readText(path) {
        asked.push(path);
        if (!held.has(path)) throw new Error(`no resource ${path}`);
        return held.get(path);
      },
      async readBinary(path) {
        asked.push(path);
        if (!held.has(path)) throw new Error(`no resource ${path}`);
        return held.get(path);
      },
    };

    const injected = await saveBstWorkbook(book, lines, { resources });
    const onDisk = await saveBstWorkbook(book, lines);

    expect(asked.sort()).toEqual([...held.keys()].sort());
    expect(Buffer.compare(injected.workbook, onDisk.workbook)).toBe(0);
  }, 180000);

  it("defaults to reading this repo's app directory", async () => {
    const loader = nodeResourceLoader();
    expect(await loader.readText("templates/meta.toml")).toContain("[publisher]");
    expect((await loader.readBinary("templates/bst/bst-excel.xlsx")).slice(0, 2).toString()).toBe("PK");
  });
});

describe("taxYearFileName", () => {
  it("puts a 31 March year end in the year that started the April before", () => {
    expect(taxYearFileName(new Date("2026-03-31"))).toBe("se-2025-2026");
  });

  it("puts 5 April in the year that is ending", () => {
    expect(taxYearFileName(new Date("2026-04-05"))).toBe("se-2025-2026");
  });

  it("puts 6 April in the year that is starting", () => {
    expect(taxYearFileName(new Date("2026-04-06"))).toBe("se-2026-2027");
  });
});

describe("a book the writer cannot use", () => {
  function bookWithout(field) {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/precision-code-ltd/bst"));
    if (field === "documentInfo") delete book.documentInfo;
    else delete book.documentInfo[field];
    return { book, lines };
  }

  for (const field of ["documentInfo", "periodCoveredStart", "periodCoveredEnd"]) {
    it(`fails by name when the book has no ${field}`, async () => {
      const { book, lines } = bookWithout(field);
      const named = field === "documentInfo" ? "documentInfo" : `documentInfo.${field}`;

      await expect(saveBstWorkbook(book, lines)).rejects.toThrow(BookFieldError);
      await expect(saveBstWorkbook(book, lines)).rejects.toThrow(named);
    });
  }

  it("names the field on the error itself", async () => {
    const { book, lines } = bookWithout("periodCoveredEnd");
    await expect(saveBstWorkbook(book, lines)).rejects.toMatchObject({
      name: "BookFieldError",
      field: "documentInfo.periodCoveredEnd",
    });
  });

  it("gives up before it reads the template", async () => {
    const { book, lines } = bookWithout("periodCoveredEnd");
    const resources = {
      async readText() {
        throw new Error("the save path reached for a resource before checking the book");
      },
      async readBinary() {
        throw new Error("the save path reached for a resource before checking the book");
      },
    };
    await expect(saveBstWorkbook(book, lines, { resources })).rejects.toThrow(BookFieldError);
  });
});

describe("saveBstPackageZip", () => {
  it("wraps the workbook as the package zip the download page serves", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/precision-code-ltd/bst"));

    const { zip: zipBuffer, filename } = await saveBstPackageZip(book, lines);
    expect(filename).toBe("GB Accounts Basic Sole Trader 2026-04-05 (Apr26) Excel 2007.zip");

    const zip = await JSZip.loadAsync(zipBuffer);
    expect(Object.keys(zip.files)).toEqual(["Financialaccountsto050426.xlsx"]);

    const held = await zip.file("Financialaccountsto050426.xlsx").async("nodebuffer");
    const { workbook } = await saveBstWorkbook(book, lines);
    expect(Buffer.compare(held, workbook)).toBe(0);
  }, 180000);
});
