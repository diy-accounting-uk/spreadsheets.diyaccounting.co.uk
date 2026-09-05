// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// books/xlsx-cells.js
//
// A minimal reader for one cell's cached value inside an uploaded .xlsx, and
// for finding the .xlsx entry inside an uploaded .zip.
//
// This is glue, not engine logic. app/lib/xlsx-exporter.js already reads
// cells this way (readCellValue in app/lib/spreadsheet-runner.js), but that
// helper is internal to the pipeline and is not part of the books-engine.js
// bundle surface the page imports (app/lib/ is read-only for this track), so
// the as-read layer -- reading the workbook's own cached formula results for
// the cells CELL_MAP names, to annotate drift against the diya-gl-computed
// figures -- needs its own small copy of the same OOXML cell-value mechanics.
// It duplicates no calculation, chart-of-accounts or extraction logic: it
// answers exactly one question, "what value is cached at sheet!cell", the
// same question a spreadsheet application answers when it opens the file.
//
// Depends on window.JSZip (vendored at books/assets/vendor/jszip.min.js,
// loaded by bst.html as a classic script before this one).

(function (global) {
  "use strict";

  function decodeXmlEntities(text) {
    return text
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  // Every <si> shared-string entry, in index order. A rich-text run splits
  // its text across several <t> children, so each entry joins all of them.
  function parseSharedStrings(xml) {
    const strings = [];
    for (const si of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      const text = [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("");
      strings.push(decodeXmlEntities(text));
    }
    return strings;
  }

  // One cell's value from a sheet's raw XML, following the same <c r="..."
  // t="..."><v>...</v></c> shape spreadsheet-runner.js's readCellValue reads:
  // "s" is a shared-string index, "str"/"inlineStr" a formula/inline string
  // result, "b" a boolean, and no "t" (or "n") a plain number. Returns
  // undefined where the cell is absent -- an empty cell in a sparse row is
  // not a zero on the sheet.
  function cellValue(sheetXml, cellRef, sharedStrings) {
    const re = new RegExp(`<c\\s+r="${cellRef}"([^>]*)(?:/>|>([\\s\\S]*?)</c>)`, "s");
    const match = re.exec(sheetXml);
    if (!match) return undefined;
    const attrs = match[1] || "";
    const inner = match[2] || "";
    const typeMatch = /\bt="([^"]+)"/.exec(attrs);
    const type = typeMatch ? typeMatch[1] : null;

    if (type === "s") {
      const index = /<v>(\d+)<\/v>/.exec(inner);
      return index ? sharedStrings[Number(index[1])] : undefined;
    }
    if (type === "str" || type === "inlineStr") {
      const text = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner) || /<v>([\s\S]*?)<\/v>/.exec(inner);
      return text ? decodeXmlEntities(text[1]) : undefined;
    }
    if (type === "b") {
      const value = /<v>([\s\S]*?)<\/v>/.exec(inner);
      return value ? value[1] === "1" : undefined;
    }
    const value = /<v>([\s\S]*?)<\/v>/.exec(inner);
    if (!value) return undefined;
    const num = Number(value[1]);
    return Number.isFinite(num) ? num : value[1];
  }

  /**
   * The single .xlsx entry inside an uploaded .zip, by extension. Returns
   * null where none is found, so the caller can name the file in its error
   * rather than throw from inside this helper.
   * @param {Object} zip - a loaded JSZip instance
   */
  function findXlsxEntryName(zip) {
    const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir && /\.xlsx$/i.test(name));
    return names[0] || null;
  }

  /**
   * The workbook bytes to read, from either a .xlsx directly or a .zip
   * carrying one.
   * @param {Uint8Array} fileBytes
   * @param {string} fileName - for the .zip/.xlsx extension check and the error message
   * @returns {Promise<Uint8Array>}
   */
  async function xlsxBytesFrom(fileBytes, fileName) {
    if (/\.zip$/i.test(fileName)) {
      const zip = await global.JSZip.loadAsync(fileBytes);
      const entryName = findXlsxEntryName(zip);
      if (!entryName) throw new Error(`No .xlsx workbook found inside ${fileName}`);
      return zip.file(entryName).async("uint8array");
    }
    return fileBytes;
  }

  /**
   * Open an .xlsx's cells for reading by sheet name and cell reference.
   * @param {Uint8Array} xlsxBytes
   * @returns {Promise<{hasSheet: (name: string) => boolean, readCell: (sheet: string, cellRef: string) => Promise<*>}>}
   */
  async function openWorkbookCells(xlsxBytes) {
    const zip = await global.JSZip.loadAsync(xlsxBytes);
    const workbookXml = await zip.file("xl/workbook.xml").async("string");
    const relsFile = zip.file("xl/_rels/workbook.xml.rels");
    const relsXml = relsFile ? await relsFile.async("string") : "";
    const sharedStringsFile = zip.file("xl/sharedStrings.xml");
    const sharedStrings = sharedStringsFile ? parseSharedStrings(await sharedStringsFile.async("string")) : [];

    const relTargetById = new Map();
    for (const rel of relsXml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
      const idMatch = /\bId="([^"]+)"/.exec(rel[1]);
      const targetMatch = /\bTarget="([^"]+)"/.exec(rel[1]);
      if (idMatch && targetMatch) relTargetById.set(idMatch[1], targetMatch[1]);
    }

    const sheetPathByName = new Map();
    for (const sheet of workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)) {
      const nameMatch = /\bname="([^"]*)"/.exec(sheet[1]);
      const ridMatch = /\br:id="([^"]*)"/.exec(sheet[1]);
      if (!nameMatch || !ridMatch) continue;
      const target = relTargetById.get(ridMatch[1]);
      if (!target) continue;
      const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
      sheetPathByName.set(decodeXmlEntities(nameMatch[1]), path);
    }

    const sheetXmlCache = new Map();
    async function sheetXmlFor(sheetName) {
      if (sheetXmlCache.has(sheetName)) return sheetXmlCache.get(sheetName);
      const path = sheetPathByName.get(sheetName);
      const file = path ? zip.file(path) : null;
      const xml = file ? await file.async("string") : null;
      sheetXmlCache.set(sheetName, xml);
      return xml;
    }

    return {
      hasSheet: (sheetName) => sheetPathByName.has(sheetName),
      async readCell(sheetName, cellRef) {
        const xml = await sheetXmlFor(sheetName);
        return xml === null ? undefined : cellValue(xml, cellRef, sharedStrings);
      },
    };
  }

  // The same four rules app/lib/workbook-set.js keeps: a workbook is a
  // .xlsx entry, addressed by the last segment of its path whatever case it
  // arrived in, and a macOS re-zip's __MACOSX entries and ._ shadows are not
  // workbooks. The page cannot import app/lib, so they are stated twice; the
  // browser test reads one real package through both.
  function workbookBaseName(entryPath) {
    var segments = entryPath.split("/");
    return segments[segments.length - 1];
  }

  function isWorkbookEntry(entryPath) {
    var segments = entryPath.split("/");
    if (segments.indexOf("__MACOSX") !== -1) return false;
    var base = segments[segments.length - 1];
    if (base.indexOf("._") === 0) return false;
    return /\.xlsx$/i.test(base);
  }

  /**
   * Every workbook in an uploaded package zip, addressed by file name. Each
   * one opens on the first question asked of it and stays open, so a page
   * that reads two cells off the hub decompresses nothing else.
   * @param {Uint8Array} zipBytes
   * @returns {Promise<{names: () => string[], has: (file: string) => boolean, hasSheet: (file: string, sheet: string) => Promise<boolean>, readCell: (file: string, sheet: string, cellRef: string) => Promise<*>, zip: (file: string) => Promise<Object>}>}
   */
  async function openWorkbookSet(zipBytes) {
    var zip = await global.JSZip.loadAsync(zipBytes);
    var pathByName = new Map();
    Object.keys(zip.files).forEach(function (entryPath) {
      if (zip.files[entryPath].dir || !isWorkbookEntry(entryPath)) return;
      pathByName.set(workbookBaseName(entryPath).toLowerCase(), entryPath);
    });

    var names = [];
    pathByName.forEach(function (entryPath) {
      names.push(workbookBaseName(entryPath));
    });
    names.sort(function (left, right) {
      var a = left.toLowerCase();
      var b = right.toLowerCase();
      return a < b ? -1 : a > b ? 1 : 0;
    });

    var cellsByName = new Map();
    function cellsFor(file) {
      var key = workbookBaseName(file).toLowerCase();
      var entryPath = pathByName.get(key);
      if (!entryPath) return null;
      if (!cellsByName.has(key)) {
        cellsByName.set(key, zip.file(entryPath).async("uint8array").then(openWorkbookCells));
      }
      return cellsByName.get(key);
    }

    // The workbook's own JSZip, for the engine's link-cache readers, which
    // take any JSZip-shaped object.
    var zipsByName = new Map();
    function zipFor(file) {
      var key = workbookBaseName(file).toLowerCase();
      var entryPath = pathByName.get(key);
      if (!entryPath) throw new Error("The package holds no workbook named " + file + ".");
      if (!zipsByName.has(key)) {
        zipsByName.set(
          key,
          zip
            .file(entryPath)
            .async("uint8array")
            .then(function (bytes) {
              return global.JSZip.loadAsync(bytes);
            }),
        );
      }
      return zipsByName.get(key);
    }

    return {
      names: function () {
        return names.slice();
      },
      has: function (file) {
        return pathByName.has(workbookBaseName(file).toLowerCase());
      },
      async hasSheet(file, sheetName) {
        var pending = cellsFor(file);
        if (!pending) return false;
        return (await pending).hasSheet(sheetName);
      },
      async readCell(file, sheetName, cellRef) {
        var pending = cellsFor(file);
        if (!pending) return undefined;
        return (await pending).readCell(sheetName, cellRef);
      },
      zip: zipFor,
    };
  }

  global.DiyaGlXlsxCells = { xlsxBytesFrom, openWorkbookCells, openWorkbookSet };
})(window);
