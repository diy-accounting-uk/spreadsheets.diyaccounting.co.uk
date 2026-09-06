// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// The Limited Company package is thirteen workbooks that read each other
// across external links, and each reading workbook keeps a cached copy of
// every leaf cell it reads. A cache is only as good as the figure behind it,
// so the calculator has to hold a value for every leaf cell any link
// addresses. These tests hold it to that.
//
// app/test/fixtures/ltd-link-cells.json pins the addressed list itself, so a
// template change that moves a link fails here by name rather than showing up
// later as a cache nobody refreshed.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { parse as parseTOML } from "smol-toml";
import { buildSheetMap, loadSharedStrings, readCellValue } from "../lib/xlsx-parts.js";
import { ltdAdminBColumnSerial } from "../lib/generator.js";
import { canonicalValue } from "../lib/report-serializer.js";
import { calculateLtdCells, calculateLtdResults } from "../lib/calculators/ltd.js";
import { loadDiyaGlData, diyaGlToScenario } from "../lib/diya-gl-loader.js";
import { BANK_ACCOUNT_FILES, BANK_LAYOUTS, monthTabOrder, nextColumn } from "../lib/ltd-layout.js";
import {
  LINK_ORDER,
  classifyLinkCell,
  externalCacheCell,
  externalLinks,
  linkAddressedCells,
  packageLinkCaches,
} from "../lib/link-caches.js";
import { dateFromExcelSerial } from "../lib/calculators/shared.js";
import { saveWorkbookFiles } from "../lib/product-workbook.js";
import { taxYearFileName } from "../lib/tax-year.js";
import * as ltd from "../products/ltd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const TEMPLATES = resolve(ROOT, "app", "templates", "ltd");

async function workbookZips(dir) {
  const zips = new Map();
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith(".xlsx"))) {
    zips.set(name, await JSZip.loadAsync(readFileSync(resolve(dir, name))));
  }
  return zips;
}

// Every leaf cell a set of workbooks addresses across their links, keyed the
// way a cache keys it.
async function addressedKeys(zips) {
  const keys = new Set();
  for (const zip of zips.values()) {
    for (const entry of await linkAddressedCells(zip)) keys.add(`${entry.targetFile}!${entry.sheet}!${entry.cell}`);
  }
  return keys;
}

async function firstTabOf(fileName) {
  const zip = await JSZip.loadAsync(readFileSync(resolve(TEMPLATES, fileName)));
  const sheetMap = await buildSheetMap(zip);
  const sharedStrings = await loadSharedStrings(zip);
  const xml = await zip.file(sheetMap.get([...sheetMap.keys()][0])).async("string");
  return (cellRef) => readCellValue(xml, cellRef, sharedStrings);
}

// Row 5 of a bank month tab names the code letter each analysis column
// totals, so it is the template's own statement of the layout row 1 is
// written against. The order the four transfer codes take across it is not
// the order BANK_TRANSFER_CODES declares them in, which is what this catches.
describe("the bank layouts match row 5 of the four templates", () => {
  // The analysis block a template declares: every column from the one after
  // the amount column up to the first that names no code.
  function codedRunAfter(cell, amountColumn) {
    const run = [];
    for (let column = nextColumn(amountColumn); ; column = nextColumn(column)) {
      const code = cell(`${column}5`);
      if (code === null) return run;
      run.push([code, column]);
    }
  }

  it.each(Object.values(BANK_ACCOUNT_FILES))("%s", async (fileName) => {
    const cell = await firstTabOf(fileName);
    const layout = BANK_LAYOUTS[fileName];
    // The amount column heads its block and carries no code of its own.
    expect(cell(`${layout.receipt.amount}5`)).toBeNull();
    expect(cell(`${layout.payment.amount}5`)).toBeNull();
    expect(codedRunAfter(cell, layout.receipt.amount)).toEqual(layout.receiptColumns);
    expect(codedRunAfter(cell, layout.payment.amount)).toEqual(layout.paymentColumns);
  });
});

const HUB = "Financialaccounts.xlsx";
const FIXTURE = JSON.parse(readFileSync(resolve(__dirname, "fixtures", "ltd-link-cells.json"), "utf8"));

// The package the roundtrip job runs: the Precision Code year at the March
// year end, written for the tax year the package is generated for.
function precisionCode() {
  const { book, lines } = loadDiyaGlData(resolve(ROOT, "examples", "precision-code-ltd", "full"), "-P1Y");
  const taxData = parseTOML(readFileSync(resolve(ROOT, "app", "data", "ltd-2024.toml"), "utf8"));
  const scenario = diyaGlToScenario(book, lines, "ltd");
  return {
    book,
    lines,
    scenario,
    cells: calculateLtdCells(book, lines, taxData, scenario),
    report: calculateLtdResults(book, lines, taxData, scenario),
    writes: ltd.cellWrites(scenario, 2024, 3),
  };
}

// Every cell an engine holds, keyed the way a link addresses it: the leaf
// file, the sheet on it, and the cell.
function addressKeys(results) {
  const keys = new Map();
  for (const [key, sheet] of Object.entries(results)) {
    const prefix = key.includes("!") ? key : `${HUB}!${key}`;
    for (const [cell, value] of Object.entries(sheet)) keys.set(`${prefix}!${cell}`, value);
  }
  return keys;
}

// One cell as the sheet XML holds it, self-closing or with a body, or null
// when the sheet does not carry the cell at all.
function cellTag(xml, cell) {
  const selfClosing = xml.match(new RegExp(`<c r="${cell}"[^>]*/>`));
  if (selfClosing) return selfClosing[0];
  const withBody = xml.match(new RegExp(`<c r="${cell}"[^>]*?>[\\s\\S]*?</c>`));
  return withBody ? withBody[0] : null;
}

function writtenKeys(writes) {
  const keys = new Map();
  for (const [file, sheets] of Object.entries(writes)) {
    for (const [sheet, cells] of Object.entries(sheets)) {
      for (const [cell, value] of Object.entries(cells)) keys.set(`${file}!${sheet}!${cell}`, value);
    }
  }
  return keys;
}

describe("every pinned cell is a calculator output, a writer input or a declared blank", () => {
  const run = precisionCode();
  const emitted = addressKeys(run.cells);
  const written = writtenKeys(run.writes);
  const blank = new Map(FIXTURE.blank.map((entry) => [entry.key, entry]));

  it("leaves no addressed cell uncovered", () => {
    expect(FIXTURE.addressed.filter((key) => !emitted.has(key) && !blank.has(key))).toEqual([]);
  });

  it("emits every addressed formula cell", () => {
    expect(FIXTURE.addressed.filter((key) => !blank.has(key)).length).toBe(2105);
    expect(FIXTURE.addressed.filter((key) => !blank.has(key) && emitted.has(key)).length).toBe(2105);
  });

  it("emits an addressed input cell exactly when the writer fills it", () => {
    expect(blank.size).toBe(109);
    const disagreements = [];
    let filled = 0;
    for (const [key, entry] of blank) {
      if (!entry.writer) {
        if (emitted.has(key) || written.has(key)) disagreements.push(`${key}: filled, but the fixture says it never is`);
        continue;
      }
      if (emitted.has(key) !== written.has(key)) {
        disagreements.push(`${key}: emitted ${emitted.has(key)}, written ${written.has(key)}`);
        continue;
      }
      if (!emitted.has(key)) continue;
      filled += 1;
      if (canonicalValue(emitted.get(key)) !== canonicalValue(written.get(key))) {
        disagreements.push(`${key}: emitted ${emitted.get(key)}, written ${written.get(key)}`);
      }
    }
    expect(disagreements).toEqual([]);
    expect(filled).toBe(25);
  });

  it("holds one value for a cell the report and the link cells both carry", () => {
    const reported = addressKeys(run.report);
    expect([...reported].filter(([key, value]) => !Object.is(emitted.get(key), value)).map(([key]) => key)).toEqual([]);
  });

  it("rolls the Admin date chain the way the generator rolls the cached one", () => {
    const yearEnd = run.cells.Admin.B32;
    for (let row = 6; row <= 40; row++) {
      expect([row, run.cells.Admin[`B${row}`]]).toEqual([row, ltdAdminBColumnSerial(yearEnd, row)]);
    }
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

describe("the report's cells do not move", () => {
  const run = precisionCode();
  const reported = addressKeys(run.report);

  it("holds 262 of the addressed cells", () => {
    expect(FIXTURE.addressed.filter((key) => reported.has(key)).length).toBe(262);
  });

  it.each([
    ["a bank book's receipts total", "Currentaccount.xlsx!Apr!F1"],
    ["a Sales tab's gross total", "Sales.xlsx!Apr!F1"],
    ["a Purchases tab's gross total", "Purchases.xlsx!Apr!F1"],
    ["a Payslips tab's gross pay", "Payslips.xlsx!Apr!M1"],
    ["the Admin date chain", `${HUB}!Admin!B6`],
    ["a Schedule new-asset allowance", "Fixedassets.xlsx!Schedule!Q67"],
    ["an OpenAccounts opening cost", `${HUB}!OpenAccounts!G13`],
  ])("keeps %s out of the report", (_name, key) => {
    expect(reported.has(key)).toBe(false);
  });
});

describe("LINK_ORDER.ltd names exactly the Ltd templates that carry external links", () => {
  it("matches the templates that hold an externalLink1.xml", async () => {
    const linkBearing = [];
    for (const [name, zip] of await workbookZips(TEMPLATES)) {
      if (zip.file("xl/externalLinks/externalLink1.xml")) linkBearing.push(name);
    }
    expect(new Set(linkBearing)).toEqual(new Set(LINK_ORDER.ltd));
  });
});

describe("every link-addressed cell in the thirteen templates is pinned", () => {
  it("lists 2,214 cells, no more and no fewer", async () => {
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
    expect(FIXTURE.addressed.length).toBe(2214);
  }, 120000);
});

const LATEST = resolve(ROOT, "examples", "ltd-latest");
const FULL_BOOK = resolve(ROOT, "examples", "precision-code-ltd", "full");

// The year end a package declares, which its Admin sheet holds as the serial
// in B32 and every date on every sheet is measured from.
async function packageYearEnd(zips) {
  const hub = zips.get(HUB);
  const sheetMap = await buildSheetMap(hub);
  const sharedStrings = await loadSharedStrings(hub);
  const adminXml = await hub.file(sheetMap.get("Admin")).async("string");
  return dateFromExcelSerial(readCellValue(adminXml, "B32", sharedStrings));
}

// The fixture book shifted to end on a package's own year end, at the tax
// data that year end falls in, as the cells a link addresses.
function engineFor(yearEnd) {
  const base = loadDiyaGlData(FULL_BOOK);
  const baseEnd = new Date(base.book.documentInfo.periodCoveredEnd);
  const months = (yearEnd.getUTCFullYear() - baseEnd.getUTCFullYear()) * 12 + (yearEnd.getUTCMonth() - baseEnd.getUTCMonth());
  const { book, lines } = months === 0 ? base : loadDiyaGlData(FULL_BOOK, `${months < 0 ? "-" : ""}P${Math.abs(months)}M`);
  const taxData = parseTOML(readFileSync(resolve(ROOT, "app", "data", `${taxYearFileName(yearEnd, "ltd")}.toml`), "utf8"));
  return addressKeys(calculateLtdCells(book, lines, taxData, diyaGlToScenario(book, lines, "ltd")));
}

// The pinned list is the March package's, whose tabs run Apr to Mar. A
// package written for another year end prints the same twelve months in its
// own order, so a pinned key names the tab holding the same position of it.
function tabShift(yearEndMonth) {
  const printed = monthTabOrder(yearEndMonth);
  const moved = Object.fromEntries(monthTabOrder(3).map((tab, index) => [tab, printed[index]]));
  return (key) => {
    const [file, sheet, cell] = key.split("!");
    return `${file}!${moved[sheet] || sheet}!${cell}`;
  };
}

// A package as these tests read it: its caches keyed by the leaf cell each
// holds, the calculator run that matches its year end, and the pinned lists
// shifted onto the tabs it prints.
async function packageUnderTest(dir) {
  const zips = await workbookZips(dir);
  const yearEnd = await packageYearEnd(zips);
  const shift = tabShift(yearEnd.getUTCMonth() + 1);
  return {
    zips,
    yearEnd,
    firstTab: monthTabOrder(yearEnd.getUTCMonth() + 1)[0],
    caches: await packageLinkCaches(zips, LINK_ORDER.ltd),
    engine: engineFor(yearEnd),
    addressed: new Set(FIXTURE.addressed.map(shift)),
    blank: new Map(FIXTURE.blank.map((entry) => [shift(entry.key), entry])),
  };
}

// Every cached reading of an addressed formula cell against the calculator's
// own figure for it. A blank input cell is left to its own test: what the
// calculator holds for one depends on what the book fills in.
function cacheAgreement({ caches, engine, addressed, blank }) {
  const disagreements = [];
  const uncached = [...addressed].filter((key) => !blank.has(key) && !caches.has(key));
  let readings = 0;
  let keys = 0;
  for (const [key, entry] of caches) {
    if (!addressed.has(key) || blank.has(key)) continue;
    keys += 1;
    for (const reading of entry.readings) {
      readings += 1;
      if (canonicalValue(reading.value) !== canonicalValue(engine.get(key))) {
        disagreements.push(`${reading.file} caches ${key} as ${reading.value}, the calculator holds ${engine.get(key)}`);
      }
    }
  }
  return { disagreements, keys, readings, uncached: uncached.sort() };
}

describe("the saved package's caches equal the calculator", () => {
  const run = precisionCode();
  const written = writtenKeys(run.writes);
  const blank = new Map(FIXTURE.blank.map((entry) => [entry.key, entry]));
  let saved;

  async function savedPackage() {
    if (!saved) {
      const { files } = await saveWorkbookFiles(run.book, run.lines);
      const zips = new Map();
      for (const file of files) zips.set(file.name, await JSZip.loadAsync(file.bytes));
      saved = { zips, caches: await packageLinkCaches(zips, LINK_ORDER.ltd), engine: addressKeys(run.cells) };
    }
    return saved;
  }

  it("gives every addressed formula cell the calculator's own figure", async () => {
    const { caches, engine } = await savedPackage();
    const { disagreements, keys, readings, uncached } = cacheAgreement({
      caches,
      engine,
      addressed: new Set(FIXTURE.addressed),
      blank,
    });
    expect(disagreements).toEqual([]);
    expect(uncached, "an addressed formula cell no workbook caches").toEqual([]);
    expect([keys, readings]).toEqual([2105, 2224]);
  }, 300000);

  it("caches an addressed input cell exactly where the writer filled it", async () => {
    const { caches } = await savedPackage();
    const stray = [];
    const cached = [];
    for (const key of blank.keys()) {
      if (!caches.has(key)) continue;
      cached.push(key);
      for (const reading of caches.get(key).readings) {
        if (!written.has(key)) stray.push(`${reading.file} caches ${key} as ${reading.value}, which the writer never wrote`);
        else if (canonicalValue(reading.value) !== canonicalValue(written.get(key))) {
          stray.push(`${reading.file} caches ${key} as ${reading.value}, the writer wrote ${written.get(key)}`);
        }
      }
    }
    expect(stray).toEqual([]);
    expect(cached.length).toBe(25);
  }, 300000);
});

describe("the committed package's caches equal the calculator", () => {
  let committed;
  const committedPackage = async () => (committed ||= await packageUnderTest(LATEST));

  it("agrees on every addressed formula cell it caches", async () => {
    const pkg = await committedPackage();
    const { disagreements, keys, readings, uncached } = cacheAgreement(pkg);
    expect(disagreements).toEqual([]);
    expect([keys, readings]).toEqual([2079, 2198]);
    // The 26 the package caches nothing for are the capital allowance cells
    // of the Schedule rows that hold no asset: the sheet's own formula
    // returns a space there, and a space is not a value to cache.
    expect(uncached.length).toBe(26);
    expect(uncached.filter((key) => !/^Fixedassets\.xlsx!Schedule![QR]\d+$/.test(key))).toEqual([]);
    expect([...new Set(uncached.map((key) => canonicalValue(pkg.engine.get(key))))]).toEqual([null]);
  }, 300000);

  it("names a cache that disagrees, with both figures", async () => {
    const pkg = await packageUnderTest(LATEST);
    const key = `Sales.xlsx!${pkg.firstTab}!O1`;
    await corruptCache(pkg.zips.get(HUB), "Sales.xlsx", pkg.firstTab, "O1", 1);
    pkg.caches = await packageLinkCaches(pkg.zips, LINK_ORDER.ltd);
    const { disagreements, keys, readings } = cacheAgreement(pkg);
    expect(disagreements).toEqual([`${HUB} caches ${key} as 1, the calculator holds ${pkg.engine.get(key)}`]);
    expect([keys, readings]).toEqual([2079, 2198]);
  }, 300000);

  it("caches a declared blank only where the package's own inputs fill it", async () => {
    const { caches, blank, firstTab } = await committedPackage();
    const cached = [...caches.keys()].filter((key) => blank.has(key));
    // Every other cached blank is an input cell the writer fills; the first
    // tab's flat-rate cell is empty on the sheet, and the recalculation
    // caches the 0 an empty referenced cell reads as.
    expect(cached.filter((key) => !blank.get(key).writer)).toEqual([`Sales.xlsx!${firstTab}!G4`]);
    expect(cached.length).toBe(26);
  }, 300000);
});

// A leaf's own value, read off the workbook's sheet the way a spreadsheet
// reads it when it re-resolves a link.
function leafReader(zips) {
  const opened = new Map();
  return async (file, sheet, cell) => {
    if (!opened.has(file)) {
      const zip = zips.get(file);
      opened.set(file, { zip, sheetMap: await buildSheetMap(zip), sharedStrings: await loadSharedStrings(zip), sheetXml: new Map() });
    }
    const workbook = opened.get(file);
    if (!workbook.sheetXml.has(sheet)) {
      const sheetPath = workbook.sheetMap.get(sheet);
      workbook.sheetXml.set(sheet, sheetPath ? await workbook.zip.file(sheetPath).async("string") : null);
    }
    const xml = workbook.sheetXml.get(sheet);
    return xml === null ? null : readCellValue(xml, cell, workbook.sharedStrings);
  };
}

// Every addressed formula cell of a package judged three ways: the cache a
// workbook kept, the leaf's own figure, and the calculator's. A blank input
// cell is left out; what the calculator holds for one is the book's business,
// not the cache's.
async function staleAndDrifted({ zips, engine, addressed, blank }) {
  const caches = await packageLinkCaches(zips, LINK_ORDER.ltd);
  const readLeaf = leafReader(zips);
  const stale = [];
  const drifted = new Set();
  for (const [key, entry] of caches) {
    if (!addressed.has(key) || blank.has(key)) continue;
    const leafValue = await readLeaf(entry.targetFile, entry.sheet, entry.cell);
    for (const reading of entry.readings) {
      const verdict = classifyLinkCell({ hubCache: reading.value, leafValue, engineValue: engine.get(key) });
      if (verdict.stale) stale.push(`${reading.file} caches ${key} as ${reading.value}, the leaf holds ${leafValue}`);
      if (verdict.drift) drifted.add(`${key}: the leaf holds ${leafValue}, the calculator ${engine.get(key)}`);
    }
  }
  return { stale, drifted: [...drifted] };
}

// One cached value in a reading workbook's link part, replaced in the zip
// the way a customer's spreadsheet leaves one behind: the leaf moved on and
// the cache did not.
async function corruptCache(zip, targetFile, sheet, cell, value) {
  const link = (await externalLinks(zip)).find((entry) => entry.targetFile === targetFile);
  const xml = await zip.file(link.path).async("string");
  const block = xml.match(new RegExp(`<sheetData\\s+sheetId="${link.sheetNames.indexOf(sheet)}"[^>]*>[\\s\\S]*?</sheetData>`))[0];
  const cached = block.match(new RegExp(`<cell r="${cell}"[^>]*?(/>|>[\\s\\S]*?</cell>)`))[0];
  zip.file(link.path, xml.replace(block, block.replace(cached, externalCacheCell(cell, value))));
}

// One value on a leaf's own sheet, replaced in the zip.
async function corruptLeaf(zip, sheet, cell, value) {
  const sheetPath = (await buildSheetMap(zip)).get(sheet);
  const xml = await zip.file(sheetPath).async("string");
  const tag = xml.match(new RegExp(`<c r="${cell}"[^>]*?>[\\s\\S]*?</c>`))[0];
  zip.file(sheetPath, xml.replace(tag, tag.replace(/<v>[^<]*<\/v>/, `<v>${value}</v>`)));
}

// One cell per hub sheet that reads across a link, and the hub cell that
// reads it.
const LINK_READ_CELLS = [
  ["the trial balance's drawings", (tab) => `Currentaccount.xlsx!${tab}!J1`, ["TrialBalance!H20"]],
  ["the trial balance's sales analysis and stock", (tab) => `Sales.xlsx!${tab}!O1`, ["TrialBalance!F53", "Stock!J8"]],
  ["the wages interface's directors' pay", (tab) => `Payslips.xlsx!${tab}!M2`, ["WagesInterface!C17"]],
  ["corporation tax's capital allowances", () => "Fixedassets.xlsx!Schedule!Q67", ["CorporationTax!I49"]],
  ["the published notes' fixed assets", () => "Fixedassets.xlsx!Schedule!E55", ["PubNotes!F8"]],
  ["the report's share capital", () => "Companysecretary.xlsx!RegisterofMembers!G1", ["Report!I95"]],
];

describe("a stale cache and a drifted leaf are told apart", () => {
  let committed;
  const committedPackage = async () => (committed ||= await packageUnderTest(LATEST));

  it.each(LINK_READ_CELLS)(
    "%s",
    async (_name, keyOf, sources) => {
      const { zips, engine, firstTab, caches } = await committedPackage();
      const key = keyOf(firstTab);
      const [file, sheet, cell] = key.split("!");
      const [reading] = caches.get(key).readings;
      expect([reading.file, reading.sources]).toEqual([HUB, sources]);

      const leafValue = await leafReader(zips)(file, sheet, cell);
      const engineValue = engine.get(key);
      expect(classifyLinkCell({ hubCache: reading.value, leafValue, engineValue })).toEqual({ stale: false, drift: false });
      expect(classifyLinkCell({ hubCache: reading.value + 1, leafValue, engineValue })).toEqual({ stale: true, drift: false });
      expect(classifyLinkCell({ hubCache: reading.value, leafValue: leafValue + 1, engineValue })).toEqual({ stale: false, drift: true });
    },
    300000,
  );

  it("finds nothing stale and nothing drifted in the package as it stands", async () => {
    expect(await staleAndDrifted(await committedPackage())).toEqual({ stale: [], drifted: [] });
  }, 300000);

  it("names the one cache left behind when a hub cache is corrupted", async () => {
    const pkg = await packageUnderTest(LATEST);
    const key = `Currentaccount.xlsx!${pkg.firstTab}!J1`;
    await corruptCache(pkg.zips.get(HUB), "Currentaccount.xlsx", pkg.firstTab, "J1", 44201);
    expect(await staleAndDrifted(pkg)).toEqual({
      stale: [`${HUB} caches ${key} as 44201, the leaf holds 44200`],
      drifted: [],
    });
  }, 300000);

  it("names the one leaf that drifted when a leaf value is corrupted", async () => {
    const pkg = await packageUnderTest(LATEST);
    const key = `Sales.xlsx!${pkg.firstTab}!O1`;
    await corruptLeaf(pkg.zips.get("Sales.xlsx"), pkg.firstTab, "O1", 1);
    const { stale, drifted } = await staleAndDrifted(pkg);
    expect(stale).toEqual([]);
    expect(drifted).toEqual([`${key}: the leaf holds 1, the calculator ${pkg.engine.get(key)}`]);
  }, 300000);
});
