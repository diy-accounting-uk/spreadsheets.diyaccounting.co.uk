// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// workbook-set.js — the workbooks a package carries, addressed by file
// name. One shape serves three sources: a directory the pipeline unpacked,
// the entries of a package zip a customer uploaded, and a single workbook.
// The extractors take a set rather than a directory path, so the same code
// reads a package under Node and in a browser, and nothing has to be staged
// to disk first.
//
// Node's own modules are reached through a dynamic import inside the
// directory adapter alone, so a bundle that stubs "fs" still loads this
// module and only throws if a caller actually asks for a directory.

import JSZip from "jszip";

/** A set that cannot answer: two entries share a basename, or a name it has not got. */
export class WorkbookSetError extends Error {
  constructor(message) {
    super(message);
    this.name = "WorkbookSetError";
  }
}

/**
 * The last segment of a zip entry path, which is how every workbook in a set
 * is addressed. A package zipped under its own directory and one zipped flat
 * carry the same workbooks under the same names.
 * @param {string} entryPath
 * @returns {string}
 */
export function workbookBaseName(entryPath) {
  const segments = entryPath.split("/");
  return segments[segments.length - 1];
}

/**
 * Whether a zip entry is one of the package's workbooks. The two PDF guides a
 * shipped package carries are not, and neither are the resource-fork shadows
 * a macOS re-zip of the folder ships alongside the real files.
 * @param {string} entryPath
 * @returns {boolean}
 */
export function isWorkbookEntry(entryPath) {
  const segments = entryPath.split("/");
  if (segments.includes("__MACOSX")) return false;
  const base = segments[segments.length - 1];
  if (base.startsWith("._")) return false;
  return /\.xlsx$/i.test(base);
}

function byNameThenCase(left, right) {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// Nothing is read or decompressed until a caller asks for it, and each
// workbook is read once: a populated package runs to a couple of megabytes
// over a dozen files, of which the extract path opens perhaps half.
function workbookSet(sources) {
  const byName = new Map();
  for (const source of sources) {
    const key = source.name.toLowerCase();
    const clash = byName.get(key);
    if (clash) {
      throw new WorkbookSetError(
        `Two entries carry the workbook name "${source.name}": ${clash.path} and ${source.path}. ` +
          `Zip the package's workbooks once each, so a file name names one file.`,
      );
    }
    byName.set(key, source);
  }

  const names = [...byName.values()].map((source) => source.name).sort(byNameThenCase);
  const bytesByName = new Map();
  const zipByName = new Map();

  function sourceFor(name) {
    const source = byName.get(workbookBaseName(name).toLowerCase());
    if (!source) {
      throw new WorkbookSetError(`No workbook named "${name}" here; this package carries ${names.length > 0 ? names.join(", ") : "none"}.`);
    }
    return source;
  }

  function bytes(name) {
    const source = sourceFor(name);
    if (!bytesByName.has(source.name)) bytesByName.set(source.name, source.read());
    return bytesByName.get(source.name);
  }

  return {
    names: () => [...names],
    has: (name) => byName.has(workbookBaseName(name).toLowerCase()),
    bytes,
    zip(name) {
      const source = sourceFor(name);
      if (!zipByName.has(source.name)) zipByName.set(source.name, bytes(source.name).then((buffer) => JSZip.loadAsync(buffer)));
      return zipByName.get(source.name);
    },
  };
}

/**
 * The workbooks in a directory the pipeline laid out. Node only: the file
 * system is reached inside this function, not at import time.
 * @param {string} dir
 * @returns {Promise<Object>} a workbook set
 */
export async function workbookSetFromDirectory(dir) {
  const { readdirSync, readFileSync } = await import("fs");
  const { resolve } = await import("path");
  const sources = readdirSync(dir)
    .filter(isWorkbookEntry)
    .map((name) => {
      const path = resolve(dir, name);
      return { name, path, read: async () => readFileSync(path) };
    });
  return workbookSet(sources);
}

/**
 * The workbooks inside a package zip, whether its entries sit under the
 * package's own directory or flat at the root.
 * @param {Uint8Array} zipBytes
 * @returns {Promise<Object>} a workbook set
 */
export async function workbookSetFromZipBytes(zipBytes) {
  const zip = await JSZip.loadAsync(zipBytes);
  const sources = Object.keys(zip.files)
    .filter((path) => !zip.files[path].dir && isWorkbookEntry(path))
    .map((path) => ({ name: workbookBaseName(path), path, read: () => zip.file(path).async("uint8array") }));
  return workbookSet(sources);
}

/**
 * A set of one, for the single-file products and for a workbook uploaded on
 * its own.
 * @param {string} name - the name the workbook is addressed by
 * @param {Uint8Array} bytes
 * @returns {Promise<Object>} a workbook set
 */
export async function workbookSetFromWorkbook(name, bytes) {
  const fileName = workbookBaseName(name);
  return workbookSet([{ name: fileName, path: fileName, read: async () => bytes }]);
}
