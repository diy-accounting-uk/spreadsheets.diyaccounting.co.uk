// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ixbrl-set.test.js — an Inline XBRL document set read as one: several files,
// a zip of files, and a Companies House package. Each accepted set reads as
// the single file it was cut from; each refused set names what disagrees.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { readIxbrl, readIxbrlSet, IxbrlError } from "../lib/ixbrl-reader.js";
import { detectBookSource, readBookSource, readBookSources } from "../lib/diya-gl-interchange.js";
import { ixbrlDocument, money, words, context } from "./helpers/ixbrl-document.js";

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", "ixbrl");
const bytes = (path) => new Uint8Array(readFileSync(resolve(FIXTURES, path)));
const setOf = (directory) => ["accounts-1.xhtml", "accounts-2.xhtml"].map((name) => ({ name, bytes: bytes(`${directory}/${name}`) }));
const factKey = (fact) => JSON.stringify([fact.namespace, fact.localName, fact.contextRef, fact.unit, fact.value]);
const sortedKeys = (read) => read.facts.map(factKey).sort();
const text = (value) => new TextEncoder().encode(value);

describe("a document set of two files", () => {
  it("reads as the single file it was cut from, fact for fact", () => {
    const single = readIxbrl(bytes("builder-small.xhtml"));
    const set = readIxbrlSet(setOf("ixds-two-file"));
    expect(sortedKeys(set)).toEqual(sortedKeys(single));
    expect(set.contexts).toEqual(single.contexts);
    expect(set.units).toEqual(single.units);
    expect(set.suite).toEqual(single.suite);
  });

  it("reads the same whichever file comes first", () => {
    const forward = readIxbrlSet(setOf("ixds-two-file"));
    const backward = readIxbrlSet(setOf("ixds-two-file").reverse());
    expect(sortedKeys(backward)).toEqual(sortedKeys(forward));
  });

  it("refuses the second file alone and says what to drop", () => {
    expect(() => readIxbrl(setOf("ixds-two-file")[1].bytes)).toThrow(
      "This file is one part of a document set: its contexts are in another file. Drop all the files of the set together, or the zip.",
    );
  });

  it("refuses a set whose files state one concept with different values and names the concept", () => {
    expect(() => readIxbrlSet(setOf("ixds-two-file-disagree"))).toThrow(
      "The files state TurnoverRevenue twice for the same period with different values (50000 and 50001).",
    );
  });

  it("refuses a set that is empty", () => {
    expect(() => readIxbrlSet([])).toThrow(IxbrlError);
  });

  it("names the file that is not iXBRL", () => {
    const files = [...setOf("ixds-two-file"), { name: "notes.txt", bytes: text("plain text") }];
    expect(() => readIxbrlSet(files)).toThrow('"notes.txt" is not an Inline XBRL document or an XBRL instance.');
  });
});

describe("what the files of a set must agree on", () => {
  const document = (options) => ({ name: "a.xhtml", bytes: text(ixbrlDocument(options)) });
  const otherCompany = context("CY", { start: "2024-04-01", end: "2025-03-31" }).replace("12345678", "87654321");

  it("accepts a context defined identically in two files", () => {
    const body = money("core:TurnoverRevenue", "CY", "10");
    const read = readIxbrlSet([
      document({ body }),
      { name: "b.xhtml", bytes: text(ixbrlDocument({ body: money("core:CostSales", "CY", "4") })) },
    ]);
    expect(read.facts.map((fact) => fact.localName).sort()).toEqual(["CostSales", "TurnoverRevenue"]);
  });

  it("refuses a context id defined differently in two files", () => {
    expect(() => readIxbrlSet([document({}), document({ contexts: otherCompany })])).toThrow(
      'The files define the context "CY" differently.',
    );
  });

  it("refuses a unit id defined differently in two files", () => {
    const units = '<xbrli:unit id="GBP"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>';
    expect(() => readIxbrlSet([document({}), document({ units })])).toThrow('The files define the unit "GBP" differently.');
  });

  it("refuses files whose entity identifiers differ", () => {
    const second = context("OTHER", { start: "2024-04-01", end: "2025-03-31" }).replace("12345678", "87654321");
    expect(() => readIxbrlSet([document({}), document({ contexts: second })])).toThrow(
      "The files are for different companies (12345678 and 87654321).",
    );
  });

  it("refuses files whose schema references name different suites", () => {
    const old = "https://xbrl.frc.org.uk/FRS-102/2022-01-01/FRS-102-2022-01-01.xsd";
    expect(() => readIxbrlSet([document({}), document({ schemaRef: old })])).toThrow(
      "The files name different taxonomy suites (FRS-102 2024-01-01 and FRS-102 2022-01-01).",
    );
  });

  it("refuses a plain XBRL instance among several files", () => {
    const instance = { name: "i.xbml", bytes: text('<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance"/>') };
    expect(() => readIxbrlSet([document({}), instance])).toThrow('"i.xbml" is an XBRL instance; an instance is one file.');
  });
});

describe("targets in a document set", () => {
  const targeted = (name, value) => words(name, "CY", value, 'target="other"');

  it("leaves out the facts of another target and lists the target", () => {
    const body = money("core:TurnoverRevenue", "CY", "10") + targeted("uk-bus:ReportTitle", "Elsewhere");
    const read = readIxbrlSet([{ name: "a.xhtml", bytes: text(ixbrlDocument({ body })) }]);
    expect(read.facts.map((fact) => fact.localName)).toEqual(["TurnoverRevenue"]);
    expect(read.leftOutTargets).toEqual(["other"]);
  });

  it("refuses a set with no fact for the default target and names the targets", () => {
    const body = targeted("uk-bus:ReportTitle", "Elsewhere");
    expect(() => readIxbrlSet([{ name: "a.xhtml", bytes: text(ixbrlDocument({ body })) }])).toThrow(
      "The set has no facts for the default target; its facts are for the targets other.",
    );
  });

  it("joins a fact to the continuation that sits in another file", () => {
    const first = ixbrlDocument({ body: words("uk-bus:ReportTitle", "CY", "First ", 'continuedAt="more"') });
    const second = ixbrlDocument({ contexts: "", body: '<ix:continuation id="more">second</ix:continuation>' });
    const read = readIxbrlSet([
      { name: "a.xhtml", bytes: text(first) },
      { name: "b.xhtml", bytes: text(second) },
    ]);
    expect(read.facts[0].value).toBe("First second");
  });
});

describe("a zip of documents", () => {
  const packageOf = async (files) => {
    const zip = new JSZip();
    for (const [name, content] of Object.entries(files)) zip.file(name, content);
    return zip.generateAsync({ type: "uint8array" });
  };

  it("sniffs as ixbrl-zip when every file outside META-INF is an iXBRL document", async () => {
    expect(await detectBookSource(bytes("ch-welsh-package.zip"), "package.zip")).toBe("ixbrl-zip");
  });

  it("does not sniff as ixbrl-zip when one file is not an iXBRL document", async () => {
    const mixed = await packageOf({ "accounts.xhtml": bytes("builder-small.xhtml"), "notes.txt": "plain text" });
    expect(await detectBookSource(mixed, "mixed.zip")).toBe("unknown");
  });

  it("reads a zip of two files as a document set", async () => {
    const [one, two] = setOf("ixds-two-file");
    const zip = await packageOf({ [one.name]: one.bytes, [two.name]: two.bytes });
    const single = await readBookSource(bytes("builder-small.xhtml"), "builder-small.xhtml");
    const read = await readBookSource(zip, "set.zip");
    expect(read.kind).toBe("ixbrl-zip");
    expect(read.book).toEqual(single.book);
  });

  it("reads a Welsh package as the English document", async () => {
    const single = await readBookSource(bytes("builder-small.xhtml"), "builder-small.xhtml");
    const read = await readBookSource(bytes("ch-welsh-package.zip"), "package.zip");
    expect(read.kind).toBe("ixbrl-zip");
    expect(read.book).toEqual(single.book);
    expect(read.lines).toEqual(single.lines);
  });

  it("refuses a Welsh package whose Welsh figures differ and names the concept", async () => {
    await expect(readBookSource(bytes("ch-welsh-package-disagree.zip"), "package.zip")).rejects.toThrow(
      "The English and Welsh accounts differ at TurnoverRevenue.",
    );
  });

  it("refuses a package folder that holds two instances", async () => {
    await expect(readBookSource(bytes("ch-two-instances.zip"), "package.zip")).rejects.toThrow(
      'The zip holds more than one accounts file in "reports/english/"; a package folder holds one.',
    );
  });

  it("refuses a package with no folder for the company's own accounts", async () => {
    const zip = await packageOf({
      "agreement/a.xhtml": bytes("builder-small.xhtml"),
      "consolidated-accounts/b.xhtml": bytes("builder-small.xhtml"),
    });
    await expect(readBookSource(zip, "package.zip")).rejects.toThrow(/none is the company's own accounts/);
  });
});

describe("several files dropped together", () => {
  it("reads two iXBRL files as one set", async () => {
    const single = await readBookSource(bytes("builder-small.xhtml"), "builder-small.xhtml");
    const read = await readBookSources(setOf("ixds-two-file"));
    expect(read.book).toEqual(single.book);
    expect(read.lines).toEqual(single.lines);
  });

  it("reads one file as readBookSource reads it", async () => {
    const read = await readBookSources([{ name: "builder-small.xhtml", bytes: bytes("builder-small.xhtml") }]);
    expect(read.kind).toBe("ixbrl");
  });

  it("refuses an iXBRL file dropped with another kind of file", async () => {
    const files = [...setOf("ixds-two-file"), { name: "book.json", bytes: text('{"format":"diya-gl"}') }];
    await expect(readBookSources(files)).rejects.toThrow("Drop the accounts files on their own.");
  });

  it("refuses a set whose files disagree", async () => {
    await expect(readBookSources(setOf("ixds-two-file-disagree"))).rejects.toThrow(/TurnoverRevenue/);
  });
});
