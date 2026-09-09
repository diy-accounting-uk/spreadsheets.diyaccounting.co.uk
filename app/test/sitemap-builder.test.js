// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

import { describe, it, expect } from "vitest";
import { escapeXml, buildSitemapXml } from "../lib/sitemap-builder.js";

describe("escapeXml", () => {
  it("escapes ampersands", () => {
    expect(escapeXml("a&b")).toBe("a&amp;b");
  });

  it("escapes angle brackets", () => {
    expect(escapeXml("<tag>")).toBe("&lt;tag&gt;");
  });

  it("leaves clean strings unchanged", () => {
    expect(escapeXml("hello")).toBe("hello");
  });
});

describe("buildSitemapXml", () => {
  it("includes main pages with no products or articles", () => {
    const { xml, urlCount } = buildSitemapXml([], []);
    expect(urlCount).toBe(5);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("https://spreadsheets.diyaccounting.co.uk/");
    expect(xml).toContain("https://spreadsheets.diyaccounting.co.uk/download.html");
    expect(xml).toContain("https://spreadsheets.diyaccounting.co.uk/donate.html");
    expect(xml).toContain("https://spreadsheets.diyaccounting.co.uk/knowledge-base.html");
    expect(xml).toContain("https://spreadsheets.diyaccounting.co.uk/diya-gl.html");
    expect(xml).toContain("</urlset>");
  });

  it("adds product download URLs", () => {
    const products = [{ id: "BasicSoleTrader" }, { id: "SelfEmployed" }];
    const { xml, urlCount } = buildSitemapXml(products, []);
    expect(urlCount).toBe(7);
    expect(xml).toContain("download.html?product=BasicSoleTrader");
    expect(xml).toContain("download.html?product=SelfEmployed");
  });

  it("adds article URLs", () => {
    const articles = [{ id: "tax-guide" }, { id: "vat-explained" }];
    const { xml, urlCount } = buildSitemapXml([], articles);
    expect(urlCount).toBe(7);
    expect(xml).toContain("articles/tax-guide.md");
    expect(xml).toContain("articles/vat-explained.md");
  });

  it("escapes special characters in product IDs", () => {
    const products = [{ id: "Test&Product" }];
    const { xml } = buildSitemapXml(products, []);
    expect(xml).toContain("product=Test&amp;Product");
  });

  it("produces valid XML structure", () => {
    const { xml } = buildSitemapXml([{ id: "P1" }], [{ id: "A1" }]);
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toMatch(/<urlset[^>]*>[\s\S]*<\/urlset>\n$/);
  });

  it("carries a licence comment right after the XML declaration", () => {
    const { xml } = buildSitemapXml([], []);
    const lines = xml.split("\n");
    expect(lines[0]).toBe('<?xml version="1.0" encoding="UTF-8"?>');
    expect(lines[1]).toBe("<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->");
    expect(lines[2]).toBe("<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->");
  });
});
