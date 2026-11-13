// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// references.js — Pure functions that merge the citation record files into references.toml and
// read the reference ids an article cites. A record file holds [[reference]] tables, each with
// its [[reference.source]] tables. An id has one record across all the files.

import { parse as parseTOML } from "smol-toml";
import { parseHtml } from "./llms-txt.js";

const REFERENCE_ID = /^REF\d+$/;
const REFERENCES_LINK = "references.html#";

function idNumber(id) {
  return Number(id.slice(3));
}

// files: [{ name, text }]. Returns the records ordered by id number.
export function mergeReferences(files) {
  const definedIn = new Map();
  const records = [];
  for (const { name, text } of files) {
    for (const record of parseTOML(text).reference || []) {
      if (!REFERENCE_ID.test(record.id || "")) throw new Error(`references.js: ${name} holds a record with the id "${record.id}"`);
      if (definedIn.has(record.id)) throw new Error(`references.js: ${record.id} is defined in ${definedIn.get(record.id)} and in ${name}`);
      definedIn.set(record.id, name);
      records.push(record);
    }
  }
  return records.sort((first, second) => idNumber(first.id) - idNumber(second.id));
}

// The reference ids an article page cites, read from its links to references.html#REF<n>.
export function citedReferenceIds(html) {
  const links = parseHtml(html).getElementsByTagName("a");
  const cited = new Set();
  for (let index = 0; index < links.length; index += 1) {
    const href = links[index].getAttribute("href") || "";
    const at = href.indexOf(REFERENCES_LINK);
    if (at !== -1) cited.add(href.slice(at + REFERENCES_LINK.length));
  }
  return [...cited].sort((first, second) => idNumber(first) - idNumber(second));
}

function tomlString(text) {
  if (text.includes('"') || text.includes("\\")) {
    throw new Error(`references.js: "${text}" holds a quote or backslash the page parser cannot read`);
  }
  return `"${text}"`;
}

function tomlValue(value) {
  if (Array.isArray(value)) return `[${value.map(tomlString).join(", ")}]`;
  if (typeof value === "string") return tomlString(value);
  throw new Error(`references.js: cannot write the value ${JSON.stringify(value)}`);
}

function tomlFields(record, skipped) {
  return Object.entries(record)
    .filter(([key]) => key !== skipped)
    .map(([key, value]) => `${key} = ${tomlValue(value)}`);
}

export function renderReferencesToml(records) {
  const lines = [
    "# SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0",
    "# Copyright (C) 2006-2026 DIY Accounting Limited",
    "# DIY Accounting Knowledge Base — Citation Reference Database",
    "# Built from the record files in data/ by app/bin/build-references.js",
    "# Each [[reference]] has a unique ID, a claim summary, and one or more [[reference.source]] entries.",
    "",
  ];
  for (const record of records) {
    lines.push("[[reference]]", ...tomlFields(record, "source"), "");
    for (const source of record.source || []) lines.push("[[reference.source]]", ...tomlFields(source), "");
  }
  return lines.join("\n");
}
