// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// diya-gl-tax-year-files.test.js — a caller with no file system hands the
// tax-year files to extractTaxDataFromBook, and the roll forward of a filed
// Company set reads nothing else from disk.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { extractTaxDataFromBook, loadTaxYearFilesFor } from "../lib/diya-gl-loader.js";
import { buildBookFromRegister, mapIxbrlAccounts } from "../lib/diya-gl-engine.js";
import { nodeResourceLoader } from "../lib/app-resources.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(resolve(HERE, "fixtures", "ixbrl", name));

const ltdBook = {
  documentInfo: { periodCoveredStart: "2025-04-01", periodCoveredEnd: "2026-03-31" },
  entityInformation: { "diya-gl:product": "Company" },
};

// A loader that records each read and serves it from app/data, as the page's fetch-backed loader serves the site's copy.
function recordingLoader() {
  const base = nodeResourceLoader();
  const reads = [];
  return {
    reads,
    readText: async (path) => {
      reads.push(path);
      return base.readText(path);
    },
    readBinary: async (path) => base.readBinary(path),
  };
}

describe("loadTaxYearFilesFor", () => {
  it("reads the company file and the self-employed file of the book's year", async () => {
    const resources = recordingLoader();
    const files = await loadTaxYearFilesFor(ltdBook, "ltd", resources);
    expect(Object.keys(files).sort()).toEqual(["ltd", "se"]);
    expect(resources.reads).toEqual(["data/ltd-2025.toml", "data/se-2025-2026.toml"]);
  });

  it("reads only the self-employed file for a sole trader's book", async () => {
    const resources = recordingLoader();
    const files = await loadTaxYearFilesFor(ltdBook, "se", resources);
    expect(Object.keys(files)).toEqual(["se"]);
    expect(resources.reads).toEqual(["data/se-2025-2026.toml"]);
  });
});

describe("extractTaxDataFromBook with the tax-year files supplied", () => {
  it("gives the figures it gives when it reads app/data itself", async () => {
    const files = await loadTaxYearFilesFor(ltdBook, "ltd", nodeResourceLoader());
    expect(extractTaxDataFromBook(ltdBook, "ltd", files)).toEqual(extractTaxDataFromBook(ltdBook, "ltd"));
  });

  it("refuses a company book when no company file was supplied", () => {
    expect(() => extractTaxDataFromBook(ltdBook, "ltd", { se: {} })).toThrow("no ltd tax-year file was supplied for ltd-2025.toml");
  });
});

describe("the roll forward of a filed set through a resource loader", () => {
  it("reads the filed year's tax-year files through the loader", async () => {
    const resources = recordingLoader();
    const lastAccounts = mapIxbrlAccounts(fixture("diya-2025-accounts.xhtml"), { companyNumber: "06846849", periodEnd: "2025-03-31" });
    await buildBookFromRegister(
      {
        profile: {
          companyNumber: "06846849",
          companyName: "DIY ACCOUNTING LIMITED",
          dateOfCreation: "2009-03-13",
          accountsNextPeriodStart: "2025-04-01",
          accountsNextPeriodEnd: "2026-03-31",
          accountsLastPeriodEnd: "2025-03-31",
        },
        lastAccounts,
      },
      { resources },
    );
    expect(resources.reads).toContain("data/ltd-2024.toml");
    expect(resources.reads).toContain("data/se-2024-2025.toml");
  });
});
