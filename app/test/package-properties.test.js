// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// What a reader sees under File > Properties on anything the pipeline hands
// out: the company as the author, and the terms as the rights. The template's
// own title and dates survive the write.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";

import { generateSpreadsheet, applyCoreProperties, PACKAGE_AUTHOR, PACKAGE_RIGHTS } from "../lib/generator.js";
import { saveWorkbookFiles } from "../lib/product-workbook.js";
import { loadDiyaGlData } from "../lib/diya-gl-loader.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(APP_DIR, "..");

async function coreProperties(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const part = zip.file("docProps/core.xml");
  if (!part) throw new Error("the package carries no docProps/core.xml");
  const xml = await part.async("string");
  const read = (tag) => (xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`)) || [])[1];
  return {
    xml,
    creator: read("dc:creator"),
    lastModifiedBy: read("cp:lastModifiedBy"),
    rights: read("dc:rights"),
    title: read("dc:title"),
    created: read("dcterms:created"),
  };
}

describe("a workbook the generator writes", () => {
  it("names the company as its author and carries the terms as its rights", async () => {
    const meta = parseTOML(readFileSync(resolve(APP_DIR, "templates/bst/meta.toml"), "utf8"));
    const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data/se-2025-2026.toml"), "utf8"));
    const template = readFileSync(resolve(APP_DIR, "templates/bst/bst-excel.xlsx"));

    const properties = await coreProperties(await generateSpreadsheet(template, taxData, meta.sheets));

    expect(properties.creator).toBe(PACKAGE_AUTHOR);
    expect(properties.lastModifiedBy).toBe(PACKAGE_AUTHOR);
    expect(properties.rights).toBe(PACKAGE_RIGHTS);
    expect(properties.rights).toContain("Copyright (C) 2006-2026 DIY Accounting Limited");
    expect(properties.rights).toContain("PolyForm Internal Use License 1.0.0");
  });

  it("leaves the title and the dates the template carries alone", async () => {
    const meta = parseTOML(readFileSync(resolve(APP_DIR, "templates/bst/meta.toml"), "utf8"));
    const taxData = parseTOML(readFileSync(resolve(APP_DIR, "data/se-2025-2026.toml"), "utf8"));
    const template = readFileSync(resolve(APP_DIR, "templates/bst/bst-excel.xlsx"));

    const before = await coreProperties(template);
    const after = await coreProperties(await generateSpreadsheet(template, taxData, meta.sheets));

    expect(after.title).toBe(before.title);
    expect(after.created).toBe(before.created);
  });
});

describe("a package the generator has no cells to edit", () => {
  it("still says who wrote it and on what terms", async () => {
    const voucher = readFileSync(resolve(APP_DIR, "templates/ltd/Dividend Voucher.docx"));

    const before = await coreProperties(voucher);
    const after = await coreProperties(await applyCoreProperties(voucher));

    expect(after.creator).toBe(PACKAGE_AUTHOR);
    expect(after.lastModifiedBy).toBe(PACKAGE_AUTHOR);
    expect(after.rights).toBe(PACKAGE_RIGHTS);
    expect(after.title).toBe(before.title);
  });

  it("builds the part, its content type and its relationship when the package holds none", async () => {
    const stripped = await JSZip.loadAsync(readFileSync(resolve(APP_DIR, "templates/ltd/Sales.xlsx")));
    stripped.remove("docProps/core.xml");
    const types = await stripped.file("[Content_Types].xml").async("string");
    stripped.file("[Content_Types].xml", types.replace(/<Override PartName="\/docProps\/core\.xml"[^>]*\/>/, ""));
    const rels = await stripped.file("_rels/.rels").async("string");
    stripped.file("_rels/.rels", rels.replace(/<Relationship [^>]*core-properties[^>]*\/>/, ""));

    const rebuilt = await JSZip.loadAsync(await applyCoreProperties(await stripped.generateAsync({ type: "uint8array" })));

    expect(await rebuilt.file("[Content_Types].xml").async("string")).toContain(
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    );
    expect(await rebuilt.file("_rels/.rels").async("string")).toContain(
      'Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"',
    );
    expect((await coreProperties(await rebuilt.generateAsync({ type: "uint8array" }))).rights).toBe(PACKAGE_RIGHTS);
  });
});

describe("the files of a written package", () => {
  it("each carry the author and the rights, the dividend voucher among them", async () => {
    const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples/precision-code-ltd/full"));

    const { files } = await saveWorkbookFiles(book, lines);

    expect(files.map((file) => file.name)).toContain("Dividend Voucher.docx");
    for (const file of files) {
      const properties = await coreProperties(file.bytes);
      expect(properties.creator, `${file.name} names someone else as its author`).toBe(PACKAGE_AUTHOR);
      expect(properties.lastModifiedBy, `${file.name} names someone else as its last editor`).toBe(PACKAGE_AUTHOR);
      expect(properties.rights, `${file.name} carries no rights`).toBe(PACKAGE_RIGHTS);
    }
  }, 300000);
});
