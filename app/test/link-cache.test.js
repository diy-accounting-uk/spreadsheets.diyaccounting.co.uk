// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The Self Employed package is nine workbooks, six of which read cells off
// their siblings across external links and keep a cached copy of every cell
// they read. link-caches.js fills those caches without a spreadsheet
// application: from the recalculated siblings in CI, from the calculator's
// own figures in the writer and the browser. These tests hold the refresh to
// the caches CI writes, hold the calculator to every cell a link addresses,
// and hold the page's stale-or-drift classification to its five cases.
//
// app/test/fixtures/se-link-cells.json pins the addressed list itself, so a
// template change that moves a link fails here by name.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import {
  HUB_FILE,
  LINK_ORDER,
  classifyLinkCell,
  externalLinks,
  linkAddressedCells,
  linkCacheValues,
  refreshLinkCaches,
} from "../lib/link-caches.js";
import { buildSheetMap, loadSharedStrings, readCellValue } from "../lib/xlsx-parts.js";
import { canonicalValue } from "../lib/report-serializer.js";
import { calculateSeCells, calculateSeResults } from "../lib/calculators/se.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { buildSeCellEdits } from "../lib/generator.js";
import { saveWorkbookFiles } from "../lib/product-workbook.js";
import * as se from "../products/se.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const TEMPLATES = resolve(ROOT, "app", "templates", "se");
const FIXTURE = JSON.parse(readFileSync(resolve(__dirname, "fixtures", "se-link-cells.json"), "utf8"));
const LTD_FIXTURE = JSON.parse(readFileSync(resolve(__dirname, "fixtures", "ltd-link-cells.json"), "utf8"));
const TAX_DATA = parseTOML(readFileSync(resolve(ROOT, "app", "data", "se-2025-2026.toml"), "utf8"));

const xlsxFiles = (dir) => readdirSync(dir).filter((name) => name.endsWith(".xlsx"));

async function workbookZips(dir) {
  const zips = new Map();
  for (const name of xlsxFiles(dir)) zips.set(name, await JSZip.loadAsync(readFileSync(resolve(dir, name))));
  return zips;
}

// A reader over a set of loaded workbooks, answering from each sheet's own
// cached values the way the runner's sibling reader answers from disk.
function zipMapReader(zips) {
  const opened = new Map();
  const open = async (file) => {
    if (!opened.has(file)) {
      const zip = zips.get(file);
      opened.set(file, { zip, sheetMap: await buildSheetMap(zip), sharedStrings: await loadSharedStrings(zip), sheetXml: new Map() });
    }
    return opened.get(file);
  };
  return {
    hasTarget: (file) => zips.has(file),
    hasSheet: async (file, sheet) => (await open(file)).sheetMap.has(sheet),
    async readTargetCell(file, sheet, cell) {
      const workbook = await open(file);
      if (!workbook.sheetXml.has(sheet)) {
        const sheetPath = workbook.sheetMap.get(sheet);
        workbook.sheetXml.set(sheet, sheetPath ? await workbook.zip.file(sheetPath).async("string") : null);
      }
      const xml = workbook.sheetXml.get(sheet);
      return xml === null ? null : readCellValue(xml, cell, workbook.sharedStrings);
    },
  };
}

const addressKey = (entry) => `${entry.targetFile}!${entry.sheet}!${entry.cell}`;

async function addressedKeys(zips) {
  const keys = new Set();
  for (const zip of zips.values()) for (const entry of await linkAddressedCells(zip)) keys.add(addressKey(entry));
  return keys;
}

// Every cell an engine holds, keyed the way a link addresses it.
function engineKeys(cells) {
  const keys = new Map();
  for (const [key, sheet] of Object.entries(cells)) {
    const prefix = key.includes("!") ? key : `${HUB_FILE}!${key}`;
    for (const [cell, value] of Object.entries(sheet)) keys.set(`${prefix}!${cell}`, value);
  }
  return keys;
}

// The Precision Code advanced book, the SE fixture the reconciliation runs.
function advancedBook() {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "advanced"));
  const scenario = diyaGlToScenario(book, lines, "se");
  return { book, lines, scenario, cells: calculateSeCells(book, lines, TAX_DATA, scenario) };
}

// One cell as the sheet XML holds it, or null when the sheet does not carry it.
function cellTag(xml, cell) {
  const selfClosing = xml.match(new RegExp(`<c r="${cell}"[^>]*/>`));
  if (selfClosing) return selfClosing[0];
  const withBody = xml.match(new RegExp(`<c r="${cell}"[^>]*?>[\\s\\S]*?</c>`));
  return withBody ? withBody[0] : null;
}

// The refresh over every link-bearing file of a set, then the agreement of
// every addressed cell's cache with the sibling's own value, then a second
// refresh that must find nothing to do.
async function refreshAgainstSiblings(zips, order) {
  const reader = zipMapReader(zips);
  let cells = 0;
  for (const file of order) cells += (await refreshLinkCaches(zips.get(file), reader)).cells;

  const disagreements = [];
  let compared = 0;
  for (const file of order) {
    const cached = await linkCacheValues(zips.get(file));
    for (const entry of await linkAddressedCells(zips.get(file))) {
      const sibling = await reader.readTargetCell(entry.targetFile, entry.sheet, entry.cell);
      if (sibling === null || sibling === undefined) continue;
      compared += 1;
      const key = addressKey(entry);
      if (canonicalValue(cached.get(key)) !== canonicalValue(sibling)) {
        disagreements.push(`${file} caches ${key} as ${cached.get(key)}, the sibling holds ${sibling}`);
      }
    }
  }

  const secondPass = [];
  for (const file of order) {
    if ((await refreshLinkCaches(zips.get(file), reader)).changed) secondPass.push(file);
  }
  return { cells, compared, disagreements, secondPass };
}

describe("LINK_ORDER.se names exactly the SE templates that carry external links", () => {
  it("matches the templates that hold an externalLink1.xml", async () => {
    const linkBearing = [];
    for (const [name, zip] of await workbookZips(TEMPLATES)) {
      if (zip.file("xl/externalLinks/externalLink1.xml")) linkBearing.push(name);
    }
    expect(new Set(linkBearing)).toEqual(new Set(LINK_ORDER.se));
  });
});

describe("every link-addressed cell in the nine SE templates is pinned", () => {
  it("lists 543 cells, no more and no fewer", async () => {
    const addressed = await addressedKeys(await workbookZips(TEMPLATES));
    const pinned = new Set(FIXTURE.addressed);
    expect(
      [...addressed].filter((key) => !pinned.has(key)),
      "addressed by a template but not pinned",
    ).toEqual([]);
    expect(
      FIXTURE.addressed.filter((key) => !addressed.has(key)),
      "pinned but no template addresses it",
    ).toEqual([]);
    expect(FIXTURE.addressed.length).toBe(543);
  });
});

describe("every pinned cell is a calculator output, a writer input or a declared blank", () => {
  const run = advancedBook();
  const emitted = engineKeys(run.cells);
  const written = new Set();
  for (const [file, sheets] of Object.entries(se.cellWrites(run.scenario, 2025))) {
    for (const [sheet, cells] of Object.entries(sheets)) for (const cell of Object.keys(cells)) written.add(`${file}!${sheet}!${cell}`);
  }
  const adminEdits = buildSeCellEdits(TAX_DATA, 2025);
  for (const cell of [...Object.keys(adminEdits.numericEdits), ...Object.keys(adminEdits.stringEdits)]) {
    written.add(`${HUB_FILE}!Admin!${cell}`);
  }
  const blank = new Set(FIXTURE.blank.map((entry) => entry.key));

  it("leaves no addressed cell uncovered", () => {
    expect(FIXTURE.addressed.filter((key) => !emitted.has(key) && !written.has(key) && !blank.has(key))).toEqual([]);
  });

  it("covers 539 cells and declares 4 blank", () => {
    expect(FIXTURE.addressed.filter((key) => emitted.has(key) || written.has(key)).length).toBe(539);
    expect(blank.size).toBe(4);
    expect(FIXTURE.addressed.filter((key) => blank.has(key)).length).toBe(4);
  });

  it("emits nothing for a declared blank", () => {
    expect([...blank].filter((key) => emitted.has(key) || written.has(key))).toEqual([]);
  });

  it.each([...new Set(FIXTURE.blank.map((entry) => entry.key.split("!")[0]))])("%s leaves its blank cells blank", async (fileName) => {
    const zip = await JSZip.loadAsync(readFileSync(resolve(TEMPLATES, fileName)));
    const sheetMap = await buildSheetMap(zip);
    const sheetXml = new Map();
    const holding = [];
    for (const entry of FIXTURE.blank) {
      const [file, sheet, cell] = entry.key.split("!");
      if (file !== fileName) continue;
      if (!sheetXml.has(sheet)) sheetXml.set(sheet, await zip.file(sheetMap.get(sheet)).async("string"));
      const tag = cellTag(sheetXml.get(sheet), cell);
      if (tag !== null && (tag.includes("<f") || tag.includes("<v>"))) holding.push(`${entry.key}: ${tag}`);
    }
    expect(holding).toEqual([]);
  });
});

describe("the pure refresh agrees with the sibling workbooks and settles in one pass", () => {
  it("over examples/se-latest", async () => {
    const zips = await workbookZips(resolve(ROOT, "examples", "se-latest"));
    const { cells, compared, disagreements, secondPass } = await refreshAgainstSiblings(zips, LINK_ORDER.se);
    expect(disagreements).toEqual([]);
    expect(cells).toBeGreaterThanOrEqual(FIXTURE.addressed.length - FIXTURE.blank.length);
    expect(compared).toBeGreaterThanOrEqual(FIXTURE.addressed.length - FIXTURE.blank.length);
    expect(secondPass, "a second refresh found something to rewrite").toEqual([]);
  }, 120000);

  // The order is derived from the files until Ltd's own row declares it.
  it("over examples/ltd-latest", async () => {
    const zips = await workbookZips(resolve(ROOT, "examples", "ltd-latest"));
    const order = [...zips.keys()].filter((name) => zips.get(name).file("xl/externalLinks/externalLink1.xml")).sort();
    const { cells, compared, disagreements, secondPass } = await refreshAgainstSiblings(zips, order);
    expect(disagreements).toEqual([]);
    expect(cells).toBeGreaterThanOrEqual(LTD_FIXTURE.addressed.length - LTD_FIXTURE.blank.length);
    expect(compared).toBeGreaterThanOrEqual(LTD_FIXTURE.addressed.length - LTD_FIXTURE.blank.length);
    expect(secondPass, "a second refresh found something to rewrite").toEqual([]);
  }, 300000);
});

describe("the saved advanced package's caches", () => {
  const run = advancedBook();
  const engine = engineKeys(run.cells);
  const blank = new Set(FIXTURE.blank.map((entry) => entry.key));

  async function savedCaches() {
    const { files } = await saveWorkbookFiles(run.book, run.lines);
    const caches = new Map();
    for (const file of files) caches.set(file.name, await linkCacheValues(await JSZip.loadAsync(file.bytes)));
    return caches;
  }

  it("give every link cache the calculator's value", async () => {
    const disagreements = [];
    let compared = 0;
    for (const [file, cached] of await savedCaches()) {
      for (const [key, value] of cached) {
        if (!engine.has(key)) continue;
        compared += 1;
        if (canonicalValue(value) !== canonicalValue(engine.get(key))) {
          disagreements.push(`${file} caches ${key} as ${value}, the calculator holds ${engine.get(key)}`);
        }
      }
    }
    expect(disagreements).toEqual([]);
    expect(compared).toBeGreaterThanOrEqual(539);
  }, 300000);

  // A blank leaf cell is never written; where the template ships a cache for
  // one, the shipped cell is kept as it is.
  it("carry a declared blank only where the template shipped it, unchanged", async () => {
    const templates = await workbookZips(TEMPLATES);
    const stray = [];
    for (const [file, cached] of await savedCaches()) {
      const shipped = await linkCacheValues(templates.get(file));
      for (const [key, value] of cached) {
        if (!blank.has(key)) continue;
        if (!shipped.has(key)) stray.push(`${file} caches ${key} as ${value}, which the template does not ship`);
        else if (shipped.get(key) !== value) stray.push(`${file} caches ${key} as ${value}, the template ships ${shipped.get(key)}`);
      }
    }
    expect(stray).toEqual([]);
  }, 300000);

  it("keep the template's ten unaddressed cached cells as they are", async () => {
    const templates = await workbookZips(TEMPLATES);
    const addressed = await addressedKeys(templates);
    const { files } = await saveWorkbookFiles(run.book, run.lines);
    const savedBytes = new Map(files.map((file) => [file.name, file.bytes]));

    const unaddressed = [];
    const moved = [];
    for (const file of LINK_ORDER.se) {
      const template = templates.get(file);
      const saved = await JSZip.loadAsync(savedBytes.get(file));
      for (const link of await externalLinks(template)) {
        const templateXml = await template.file(link.path).async("string");
        const savedXml = await saved.file(link.path).async("string");
        for (const block of templateXml.matchAll(/<sheetData\s+sheetId="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/sheetData>)/g)) {
          const sheet = link.sheetNames[Number(block[1])];
          for (const cell of (block[2] || "").matchAll(/<cell r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/cell>)/g)) {
            const key = `${link.targetFile}!${sheet}!${cell[1]}`;
            if (addressed.has(key)) continue;
            unaddressed.push(`${file}: ${key}`);
            if (!savedXml.includes(cell[0])) moved.push(`${file}: ${key} was ${cell[0]}`);
          }
        }
      }
    }
    expect(unaddressed).toHaveLength(10);
    expect(moved).toEqual([]);
  }, 300000);
});

describe("corrupting one cached value in the hub's externalLink2.xml is named by linkCacheValues", () => {
  it("differs in exactly Sales.xlsx!Apr!P1", async () => {
    const bytes = readFileSync(resolve(ROOT, "examples", "se-latest", HUB_FILE));
    const pristine = await JSZip.loadAsync(bytes);
    const corrupted = await JSZip.loadAsync(bytes);

    const salesLink = (await externalLinks(corrupted)).find((link) => link.targetFile === "Sales.xlsx");
    expect(salesLink.path).toBe("xl/externalLinks/externalLink2.xml");
    const aprilId = salesLink.sheetNames.indexOf("Apr");
    const xml = await corrupted.file(salesLink.path).async("string");
    const block = xml.match(new RegExp(`<sheetData\\s+sheetId="${aprilId}"[^>]*>[\\s\\S]*?</sheetData>`))[0];
    const cell = block.match(/<cell r="P1"><v>([^<]*)<\/v><\/cell>/);
    expect(cell).not.toBeNull();
    const corruptedBlock = block.replace(cell[0], `<cell r="P1"><v>${Number(cell[1]) + 1000}</v></cell>`);
    corrupted.file(salesLink.path, xml.replace(block, corruptedBlock));

    const before = await linkCacheValues(pristine);
    const after = await linkCacheValues(corrupted);
    expect([...before.keys()].filter((key) => !after.has(key))).toEqual([]);
    expect([...after.keys()].filter((key) => !before.has(key))).toEqual([]);
    expect([...before.keys()].filter((key) => before.get(key) !== after.get(key))).toEqual(["Sales.xlsx!Apr!P1"]);
  });
});

describe("classifyLinkCell tells a stale hub from a drifted leaf", () => {
  it.each([
    ["all three agree", { hubCache: 1200, leafValue: 1200, engineValue: 1200 }, { stale: false, drift: false }],
    ["the hub predates an edited leaf", { hubCache: 1000, leafValue: 1200, engineValue: 1200 }, { stale: true, drift: false }],
    ["the leaf's own figure is off", { hubCache: 1200, leafValue: 1000, engineValue: 1200 }, { stale: false, drift: true }],
    [
      "the hub and the leaf agree against the engine",
      { hubCache: 1000, leafValue: 1000, engineValue: 1200 },
      { stale: false, drift: true },
    ],
    ["all three differ", { hubCache: 900, leafValue: 1000, engineValue: 1200 }, { stale: true, drift: true }],
    [
      "a LibreOffice-written float reads as its JavaScript form",
      { hubCache: 25333.3333333333, leafValue: 25333.3333333333, engineValue: 25333.333333333332 },
      { stale: false, drift: false },
    ],
  ])("%s", (_name, values, expected) => {
    expect(classifyLinkCell(values)).toEqual(expected);
  });
});

describe("the row-1 block stays out of the report", () => {
  const { book, lines, scenario, cells } = advancedBook();
  const report = calculateSeResults(book, lines, TAX_DATA, scenario);
  const additionalReads = se.multiFileOptions().additionalReads;

  it.each([
    ["Sales.xlsx!Apr", "P1"],
    ["Purchases.xlsx!Apr", "P1"],
    ["Bank.xlsx!Mar", "J1"],
    ["Cash.xlsx!Mar", "J1"],
    ["Payslips.xlsx!Apr", "M1"],
  ])("%s holds only the cells the reconciliation reads", (key, linkCell) => {
    const [file, sheet] = key.split("!");
    expect(Object.keys(report[key]).sort()).toEqual([...additionalReads[file][sheet]].sort());
    expect(cells[key][linkCell]).toBeTypeOf("number");
    expect(report[key][linkCell]).toBeUndefined();
  });

  it("holds no tab the reconciliation never reads", () => {
    expect(cells["Bank.xlsx!Apr"].J1).toBeTypeOf("number");
    expect(report["Bank.xlsx!Apr"]).toBeUndefined();
  });
});
