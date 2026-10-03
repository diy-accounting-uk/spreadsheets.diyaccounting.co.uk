// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// entry-attribution.js — Which ledger entries stand behind each calculated
// cell, so a reader can go from a report figure to the lines that made it.
//
// An attribution is a plain map shaped like a calculator's results,
// { Sheet: { Cell: Set<entryNumber> } }. A calculator given one fills it
// beside the values it writes, from the same filtered lines, and a derived
// cell takes the union of its operands. A cell the map carries with an empty
// set has no line behind it (a tax rate, an opening figure the book states);
// a cell the map does not carry has not been attributed.
//
// Scenario transactions are built from lines but do not carry the line's
// entryNumber as a field, because the scenario is written out to sheets and
// TOML field by field. The builders tag each transaction here instead, and
// entryOf() reads a line's own field or a transaction's tag alike.

const ENTRY_OF = new WeakMap();

/**
 * Record the entryNumber of the line a derived record was built from.
 * @param {Object} record - a scenario transaction or other derived object
 * @param {string|undefined} entryNumber
 * @returns {Object} the record
 */
export function tagEntry(record, entryNumber) {
  if (entryNumber !== undefined && entryNumber !== null) ENTRY_OF.set(record, entryNumber);
  return record;
}

/**
 * The entryNumber behind a line or a tagged record, undefined when it has none.
 * @param {Object} record
 * @returns {string|undefined}
 */
export function entryOf(record) {
  if (!record || typeof record !== "object") return undefined;
  return record.entryNumber ?? ENTRY_OF.get(record);
}

/**
 * The entryNumbers behind a list of lines or tagged records.
 * @param {Iterable<Object>} records
 * @returns {Set<string>}
 */
export function entriesOf(records) {
  const entries = new Set();
  for (const record of records || []) {
    const entry = entryOf(record);
    if (entry !== undefined) entries.add(entry);
  }
  return entries;
}

/**
 * The union of any number of sources, each a set or array of entryNumbers or
 * of lines and tagged records; a missing one is empty.
 * @param {...(Iterable<string|Object>|undefined)} sources
 * @returns {Set<string>}
 */
export function unionOf(...sources) {
  const entries = new Set();
  for (const source of sources) {
    for (const item of source || []) {
      const entry = typeof item === "object" ? entryOf(item) : item;
      if (entry !== undefined) entries.add(entry);
    }
  }
  return entries;
}

/**
 * A set of entryNumbers as R carries it: sorted, each once.
 * @param {Iterable<string>} entries
 * @returns {Array<string>}
 */
export function sortedEntries(entries) {
  return [...new Set(entries)].sort((a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));
}

/**
 * Read and write one attribution map by sheet and cell. A cell is set from
 * any mix of entry sets, lines or tagged records' entries, and read back as
 * a set, empty when the cell was never attributed.
 * @param {Object} attribution - { Sheet: { Cell: Set } }, filled in place
 */
export function attributionWriter(attribution) {
  const get = (sheet, cell) => attribution[sheet]?.[cell] ?? new Set();
  return {
    set(sheet, cell, ...sources) {
      if (!attribution[sheet]) attribution[sheet] = {};
      attribution[sheet][cell] = unionOf(...sources);
    },
    get,
    cells(sheet, ...cells) {
      return unionOf(...cells.map((cell) => get(sheet, cell)));
    },
  };
}
