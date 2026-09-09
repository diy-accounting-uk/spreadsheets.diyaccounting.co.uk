// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// The guides the download carries: what pandoc is told to stamp on every PDF,
// and what the guide text itself says about the terms.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

import { pandocArguments } from "../lib/guide.js";
import { PACKAGE_AUTHOR, PACKAGE_RIGHTS } from "../lib/generator.js";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES_DIR = join(APP_DIR, "templates");

function guideMarkdownFiles() {
  const found = [];
  for (const product of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
    if (!product.isDirectory()) continue;
    for (const entry of readdirSync(join(TEMPLATES_DIR, product.name))) {
      if (entry.endsWith("-guide.md")) found.push(join(TEMPLATES_DIR, product.name, entry));
    }
  }
  return found;
}

describe("what pandoc stamps on a guide", () => {
  const args = pandocArguments("/guides/se-guide.md", "/out/Self Employed User Guide.pdf");

  it("names the company as the author", () => {
    expect(args).toContain(`author=${PACKAGE_AUTHOR}`);
  });

  it("carries the copyright and the licence as the rights and the description", () => {
    expect(args).toContain(`rights=${PACKAGE_RIGHTS}`);
    expect(args).toContain(`description=${PACKAGE_RIGHTS}`);
    expect(PACKAGE_RIGHTS).toContain("Copyright (C) 2006-2026 DIY Accounting Limited");
    expect(PACKAGE_RIGHTS).toContain("PolyForm Internal Use License 1.0.0");
  });

  it("still asks weasyprint for the named markdown and output", () => {
    expect(args[0]).toBe("/guides/se-guide.md");
    expect(args.slice(1, 4)).toEqual(["-o", "/out/Self Employed User Guide.pdf", "--pdf-engine=weasyprint"]);
  });
});

describe("what a guide says about the terms", () => {
  const guides = guideMarkdownFiles();

  it("finds every product's guide", () => {
    expect(guides.length).toBeGreaterThanOrEqual(6);
  });

  for (const path of guides) {
    const text = readFileSync(path, "utf8");
    const name = path.slice(TEMPLATES_DIR.length + 1);

    it(`${name} calls the company's own work free to use rather than open source`, () => {
      expect(text.toLowerCase()).not.toContain("open source");
    });
  }

  for (const path of guides.filter((file) => readFileSync(file, "utf8").includes("## Contact Information"))) {
    const text = readFileSync(path, "utf8");
    const name = path.slice(TEMPLATES_DIR.length + 1);

    it(`${name} states the copyright, the licence and where to get the packages`, () => {
      expect(text).toContain("Copyright (C) 2006-2026 DIY Accounting Limited");
      expect(text).toContain("PolyForm Internal Use License 1.0.0 with an additional grant for accountants");
      expect(text).toContain("https://spreadsheets.diyaccounting.co.uk/");
      expect(text).toContain("https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk");
    });
  }
});
