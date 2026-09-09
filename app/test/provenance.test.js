// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { describe, it, expect } from "vitest";
import { provenanceStamps, provenanceHeader, stampBook } from "../lib/provenance.js";
import { PROVENANCE_DATA } from "../lib/provenance-data.js";

const PRODUCTS = ["bst", "taxi", "se", "ltd"];
const SCHEMA_NAME_OF = { bst: "BasicSoleTrader", taxi: "TaxiDriver", se: "SelfEmployed", ltd: "Company" };

describe("provenanceStamps: the five book.toml documentInfo keys", () => {
  it("carries the format version, engine version and tax data hash from the generated data, for every product", () => {
    for (const product of PRODUCTS) {
      const stamps = provenanceStamps(product);
      expect(stamps["diya-gl:formatVersion"]).toBe(PROVENANCE_DATA.formatVersion);
      expect(stamps["diya-gl:engineVersion"]).toBe(PROVENANCE_DATA.engineVersion);
      expect(stamps["diya-gl:taxDataHash"]).toBe(PROVENANCE_DATA.taxDataHash);
    }
  });

  it("carries that product's own template hash and scorecard, not another product's", () => {
    for (const product of PRODUCTS) {
      const stamps = provenanceStamps(product);
      expect(stamps["diya-gl:templateHash"]).toBe(PROVENANCE_DATA.templates[product].hash);
      expect(stamps["diya-gl:templateScorecard"]).toBe(PROVENANCE_DATA.templates[product].scorecard);
    }
    const hashes = new Set(PRODUCTS.map((product) => provenanceStamps(product)["diya-gl:templateHash"]));
    expect(hashes.size).toBe(PRODUCTS.length);
  });

  it("carries reconciledCommit only once the generated data has one", () => {
    const stamps = provenanceStamps("bst");
    if (PROVENANCE_DATA.reconciledCommit) {
      expect(stamps["diya-gl:reconciledCommit"]).toBe(PROVENANCE_DATA.reconciledCommit);
    } else {
      expect(stamps).not.toHaveProperty("diya-gl:reconciledCommit");
    }
  });

  it("refuses a product it carries no template stamp for", () => {
    expect(() => provenanceStamps("payslip")).toThrow(/"payslip" is not one of bst, taxi, se, ltd/);
  });

  it("is deterministic: two calls for the same product agree on every value", () => {
    expect(provenanceStamps("ltd")).toEqual(provenanceStamps("ltd"));
  });
});

describe("provenanceHeader: the same five values, shaped for report.json", () => {
  it("un-prefixes the book.toml keys into report.json's plain field names", () => {
    for (const product of PRODUCTS) {
      const bookStamps = provenanceStamps(product);
      const header = provenanceHeader(product);
      expect(header.formatVersion).toBe(bookStamps["diya-gl:formatVersion"]);
      expect(header.engineVersion).toBe(bookStamps["diya-gl:engineVersion"]);
      expect(header.taxDataHash).toBe(bookStamps["diya-gl:taxDataHash"]);
      expect(header.templateHash).toBe(bookStamps["diya-gl:templateHash"]);
      expect(header.templateScorecard).toBe(bookStamps["diya-gl:templateScorecard"]);
      expect(header.reconciledCommit).toBe(bookStamps["diya-gl:reconciledCommit"]);
    }
  });
});

describe("stampBook: documentInfo carries this build's provenance", () => {
  function minimalBook(schemaName) {
    return {
      documentInfo: { entriesType: "journal", periodCoveredStart: "2025-04-06", periodCoveredEnd: "2026-04-05", defaultCurrency: "GBP" },
      entityInformation: { "diya-gl:product": schemaName },
    };
  }

  it("adds the five stamps without disturbing the book's own documentInfo fields", () => {
    const book = minimalBook("BasicSoleTrader");
    const stamped = stampBook(book);
    expect(stamped.documentInfo.periodCoveredStart).toBe("2025-04-06");
    expect(stamped.documentInfo.periodCoveredEnd).toBe("2026-04-05");
    for (const [key, value] of Object.entries(provenanceStamps("bst"))) {
      expect(stamped.documentInfo[key]).toBe(value);
    }
  });

  it("does not mutate the book it was given", () => {
    const book = minimalBook("TaxiDriver");
    const before = JSON.stringify(book);
    stampBook(book);
    expect(JSON.stringify(book)).toBe(before);
  });

  it("keys the stamp to the book's own declared product", () => {
    for (const [product, schemaName] of Object.entries(SCHEMA_NAME_OF)) {
      const stamped = stampBook(minimalBook(schemaName));
      expect(stamped.documentInfo["diya-gl:templateHash"]).toBe(PROVENANCE_DATA.templates[product].hash);
    }
  });

  it("is idempotent: stamping an already-stamped book twice gives the same result", () => {
    const once = stampBook(minimalBook("Company"));
    const twice = stampBook(once);
    expect(twice.documentInfo).toEqual(once.documentInfo);
  });

  it("returns a book with no declared product unchanged", () => {
    const book = { documentInfo: {}, entityInformation: {} };
    expect(stampBook(book)).toBe(book);
  });
});
