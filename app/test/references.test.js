// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// references.test.js — references.toml is merged from the record files, and every reference
// an article cites has exactly one record.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { parse as parseTOML } from "smol-toml";
import { citedReferenceIds, mergeReferences, renderReferencesToml } from "../lib/references.js";

const ROOT = resolve(__dirname, "../..");
const PUBLIC_DIR = resolve(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");

function record(id, claim = "A claim") {
  return `[[reference]]
id = "${id}"
claim = "${claim}"
category = "vat"
articles = ["one", "two"]

[[reference.source]]
id = "SRC-A"
url = "https://www.gov.uk/a"
title = "Title"
publisher = "GOV.UK"
extract = "Extract, with a comma"
accessed = "2026-02-05"
authority = "primary"
`;
}

describe("mergeReferences", () => {
  it("orders the records from every file by id number", () => {
    const merged = mergeReferences([
      { name: "b.toml", text: record("REF100") + record("REF009") },
      { name: "a.toml", text: record("REF1000") },
    ]);
    expect(merged.map((entry) => entry.id)).toEqual(["REF009", "REF100", "REF1000"]);
  });

  it("names both files when two define the same id", () => {
    expect(() =>
      mergeReferences([
        { name: "a.toml", text: record("REF010") },
        { name: "b.toml", text: record("REF010") },
      ]),
    ).toThrow(/REF010 is defined in a.toml and in b.toml/);
  });

  it("refuses a record whose id is not REF followed by digits", () => {
    expect(() => mergeReferences([{ name: "a.toml", text: record("ref10") }])).toThrow(/the id "ref10"/);
  });
});

describe("renderReferencesToml", () => {
  it("writes records the page reads back with their sources", () => {
    const merged = mergeReferences([{ name: "a.toml", text: record("REF010", "Claim & more") }]);
    const parsed = parseTOML(renderReferencesToml(merged)).reference;
    expect(parsed).toEqual(merged);
    expect(parsed[0].source[0].extract).toBe("Extract, with a comma");
  });

  it("refuses text the page parser would show with a backslash", () => {
    const merged = mergeReferences([{ name: "a.toml", text: record("REF010", "Say \\\\ here") }]);
    expect(() => renderReferencesToml(merged)).toThrow(/quote or backslash/);
  });
});

describe("citedReferenceIds", () => {
  it("reads every distinct id an article links to on the references page", () => {
    const html = `<p>x<a href="../references.html#REF012">[1]</a><a href="../references.html#REF003">[2]</a>
      <a href="../references.html#REF012">[3]</a><a href="../index.html">home</a></p>`;
    expect(citedReferenceIds(html)).toEqual(["REF003", "REF012"]);
  });
});

describe("the published references", () => {
  const additions = readdirSync(resolve(PUBLIC_DIR, "data/ref-additions")).filter((file) => file.endsWith(".toml"));
  const records = mergeReferences([
    { name: "references-core.toml", text: readFileSync(resolve(PUBLIC_DIR, "data/references-core.toml"), "utf8") },
    ...additions.map((file) => ({ name: file, text: readFileSync(resolve(PUBLIC_DIR, "data/ref-additions", file), "utf8") })),
  ]);
  const defined = new Set(records.map((entry) => entry.id));
  const articleFiles = readdirSync(resolve(PUBLIC_DIR, "articles")).filter((file) => file.endsWith(".html"));

  it("holds exactly one record for every reference an article cites", () => {
    const missing = [];
    for (const file of articleFiles) {
      for (const id of citedReferenceIds(readFileSync(resolve(PUBLIC_DIR, "articles", file), "utf8"))) {
        if (!defined.has(id)) missing.push(`${file} cites ${id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("gives every record a claim, a category and at least one source with a url", () => {
    for (const entry of records) {
      expect(entry.claim, entry.id).toBeTruthy();
      expect(entry.category, entry.id).toBeTruthy();
      expect(entry.source?.length, entry.id).toBeGreaterThan(0);
      for (const source of entry.source) expect(source.url, entry.id).toMatch(/^https?:\/\//);
    }
  });

  it("lists as a citing article only a page that exists", () => {
    const pages = new Set(articleFiles.map((file) => file.replace(/\.html$/, "")));
    const unknown = records.flatMap((entry) =>
      (entry.articles || []).filter((slug) => !pages.has(slug)).map((slug) => `${entry.id} lists ${slug}`),
    );
    expect(unknown).toEqual([]);
  });
});

describe("the references page headings", () => {
  const pageSource = readFileSync(resolve(PUBLIC_DIR, "lib/references-page.js"), "utf8");
  const labelled = new Set([...pageSource.split("};")[0].matchAll(/^\s+"([\w-]+)":\s*"/gm)].map((match) => match[1]));
  const files = [
    readFileSync(resolve(PUBLIC_DIR, "data/references-core.toml"), "utf8"),
    ...readdirSync(resolve(PUBLIC_DIR, "data/ref-additions"))
      .filter((file) => file.endsWith(".toml"))
      .map((file) => readFileSync(resolve(PUBLIC_DIR, "data/ref-additions", file), "utf8")),
  ];
  const records = mergeReferences(files.map((text, index) => ({ name: `file-${index}.toml`, text })));

  it("has a plain-English label for every category a record uses", () => {
    const unlabelled = [...new Set(records.map((entry) => entry.category))].filter((category) => !labelled.has(category));
    expect(unlabelled).toEqual([]);
  });
});
