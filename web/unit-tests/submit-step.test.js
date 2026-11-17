// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/unit-tests/submit-step.test.js
//
// Every placement that sends a reader from the spreadsheets site to DIY Accounting Submit keeps
// its link, its placement tag and the copy. A page that loses its link fails here.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import {
  SUBMIT_STEP_HEADING,
  SUBMIT_STEP_TEXT,
  submitStepUrl,
  submitPlacementHref,
  articleStepHtml,
  withArticleStep,
  tagArticleSubmitLinks,
  COMPANIES_HOUSE_ARTICLE_LINES,
} from "../../app/lib/submit-step.js";

const publicDir = resolve(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public");
const articlesDir = resolve(publicDir, "articles");
const read = (file) => readFileSync(resolve(publicDir, file), "utf8");
const decodeEntities = (text) => text.replace(/&amp;/g, "&");

function submitHrefs(html) {
  return [...html.matchAll(/href="(https:\/\/submit\.diyaccounting\.co\.uk[^"]*)"/g)].map((match) => decodeEntities(match[1]));
}

function expectTagged(html, medium, campaign) {
  const wanted = submitStepUrl({ medium, campaign });
  expect(submitHrefs(html), `no Submit link tagged ${medium}/${campaign}`).toContain(wanted);
}

describe("submitStepUrl", () => {
  it("tags the source, the placement and the page", () => {
    expect(submitStepUrl({ medium: "download", campaign: "download" })).toBe(
      "https://submit.diyaccounting.co.uk/?utm_source=spreadsheets&utm_medium=download&utm_campaign=download",
    );
    expect(submitStepUrl({ medium: "article", campaign: "x", path: "confirmation-statement.html" })).toBe(
      "https://submit.diyaccounting.co.uk/confirmation-statement.html?utm_source=spreadsheets&utm_medium=article&utm_campaign=x",
    );
  });
});

describe("the article footer copy", () => {
  it("is neutral and states what production offers and the price", () => {
    expect(SUBMIT_STEP_HEADING).toBe("File with HMRC and Companies House");
    expect(SUBMIT_STEP_TEXT).toBe(
      "DIY Accounting Submit is HMRC recognised. It files VAT returns, and company accounts and confirmation statements to Companies House. £9.99 a year (£0.99 a month), with a free day pass to try it.",
    );
    expect(SUBMIT_STEP_TEXT).not.toMatch(/approved|income tax|CT600/i);
  });
});

describe("download page step by product", () => {
  const context = createContext({});
  runInContext(readFileSync(resolve(publicDir, "lib/download-submit-step.js"), "utf8"), context);
  const stepFor = (productId, medium) =>
    runInContext(`submitStepForProduct(${JSON.stringify(productId)}, ${JSON.stringify(medium)})`, context);
  const price = "It costs £9.99 a year (£0.99 a month), with a free day pass to try it.";

  it("offers a Company reader the Companies House filings", () => {
    const step = stepFor("Company", "download");
    expect(step.heading).toBe("File your accounts with Companies House");
    expect(step.text).toContain("micro-entity and small company accounts and confirmation statements to Companies House");
    expect(step.text).toContain(price);
    expect(decodeEntities(step.href)).toBe(submitStepUrl({ medium: "download", campaign: "company" }));
  });

  it.each([
    ["SelfEmployed", "self-employed"],
    ["TaxiDriver", "taxi-driver"],
  ])("offers %s the VAT step for VAT registered businesses", (productId, slug) => {
    const step = stepFor(productId, "download");
    expect(step.heading).toBe("File this return with HMRC");
    expect(step.text).toContain("If your business is VAT registered");
    expect(step.text).toContain("HMRC recognised");
    expect(step.text).toContain(price);
    expect(step.href).toBe(submitStepUrl({ medium: "download", campaign: slug }));
  });

  it.each(["BasicSoleTrader", "Payslip05", "Payslip10", "Payslip20", "", "Unknown"])("offers %s no step", (productId) => {
    expect(stepFor(productId, "download")).toBeNull();
  });

  it("tags the after-donation version donate-thanks", () => {
    expect(stepFor("Company", "donate-thanks").href).toBe(submitStepUrl({ medium: "donate-thanks", campaign: "company" }));
    expect(stepFor("SelfEmployed", "donate-thanks").href).toBe(submitStepUrl({ medium: "donate-thanks", campaign: "self-employed" }));
    expect(stepFor("BasicSoleTrader", "donate-thanks")).toBeNull();
  });

  it("is wired into the page: two sections, filled from the picker and after a donation", () => {
    const html = read("download.html");
    expect(html).toContain('id="submit-step-download"');
    expect(html).toContain('id="submit-step-thanks"');
    expect(html).toContain('src="lib/download-submit-step.js"');
    const script = readFileSync(resolve(publicDir, "lib/download-page.js"), "utf8");
    expect(script).toContain('submitStepForProduct(product.id, "download")');
    expect(script).toContain('submitStepForProduct(productId, "donate-thanks")');
  });
});

describe("donate page", () => {
  it("stays donation only, with no Submit prices beside the amounts", () => {
    const template = readFileSync(resolve(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/donate.template.html"), "utf8");
    expect(template).not.toContain("£9.99");
    expect(template).not.toContain("submit-step");
  });
});

describe("community page", () => {
  it("carries one tagged Submit line", () => {
    expectTagged(read("community.html"), "community", "community");
  });
});

describe("knowledge base articles", () => {
  const files = readdirSync(articlesDir).filter((file) => file.endsWith(".html"));

  it("has articles to check", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(files)("%s ends with the tagged step", (file) => {
    const slug = file.replace(/\.html$/, "");
    const html = readFileSync(resolve(articlesDir, file), "utf8");
    expectTagged(html, "article-footer", slug);
    expect(html.split(`<h3>${SUBMIT_STEP_HEADING}</h3>`).length - 1).toBe(1);
    expect(html.indexOf("submit-step:start")).toBeLessThan(html.lastIndexOf("</article>"));
  });

  it.each(Object.keys(COMPANIES_HOUSE_ARTICLE_LINES))("%s has its Companies House line", (slug) => {
    const html = readFileSync(resolve(articlesDir, `${slug}.html`), "utf8");
    const line = COMPANIES_HOUSE_ARTICLE_LINES[slug];
    expect(submitHrefs(html)).toContain(submitStepUrl({ medium: "article", campaign: slug, path: line.path }));
  });

  it("puts the step in once and replaces it on a second run", () => {
    const page = '<article class="kb-article">\n        <p>Text</p>\n      </article>';
    const once = withArticleStep(page, "demo");
    expect(once).toContain(articleStepHtml("demo"));
    expect(withArticleStep(once, "demo")).toBe(once);
  });

  it("tags a Submit link in the text and leaves the navigation alone", () => {
    const page =
      '<nav><a href="https://submit.diyaccounting.co.uk">Submit VAT MTD</a></nav><article class="kb-article"><a href="https://submit.diyaccounting.co.uk/vat-return-from-a-spreadsheet.html">x</a></article>';
    const tagged = tagArticleSubmitLinks(page, "demo");
    expect(tagged).toContain('<a href="https://submit.diyaccounting.co.uk">Submit VAT MTD</a>');
    expect(decodeEntities(tagged)).toContain(
      "https://submit.diyaccounting.co.uk/vat-return-from-a-spreadsheet.html?utm_source=spreadsheets&utm_medium=article&utm_campaign=demo",
    );
  });
});

describe("book VAT action", () => {
  it("is built into the shared form helper, both VAT views and the tagged handoff", () => {
    const shell = readFileSync(resolve(process.cwd(), "web/diya-gl.co.uk/public/shell.js"), "utf8");
    expect(shell).toContain("fileVatReturn: function");
    expect(shell).toContain('medium: "book-vat"');
    expect(shell).toContain("File this VAT return");
    for (const file of ["ltd-forms.js", "se-forms.js"]) {
      expect(readFileSync(resolve(process.cwd(), "web/diya-gl.co.uk/public/products", file), "utf8")).toContain("fileVatReturn(");
    }
  });
});

describe("Submit VAT MTD placement links", () => {
  it("builds the navigation and footer addresses with the site and the placement", () => {
    expect(submitPlacementHref({ site: "spreadsheets", medium: "nav" })).toBe(
      "https://submit.diyaccounting.co.uk/?utm_source=spreadsheets&amp;utm_medium=nav",
    );
    expect(submitPlacementHref({ site: "diya-gl", medium: "footer", path: "x.html" })).toBe(
      "https://submit.diyaccounting.co.uk/x.html?utm_source=diya-gl&amp;utm_medium=footer",
    );
  });

  it("tags every Submit VAT MTD link on both sites with its site and placement", () => {
    const webDir = resolve(process.cwd(), "web");
    const pages = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".html")) pages.push(full);
      }
    };
    walk(resolve(webDir, "spreadsheets.diyaccounting.co.uk"));
    walk(resolve(webDir, "diya-gl.co.uk/public"));
    let found = 0;
    for (const page of pages) {
      const site = page.includes("/diya-gl.co.uk/") ? "diya-gl" : "spreadsheets";
      for (const match of readFileSync(page, "utf8").matchAll(/<a href="([^"]*)">Submit VAT MTD<\/a>/g)) {
        found += 1;
        expect(decodeEntities(match[1]), page).toMatch(
          new RegExp(`^https://submit\\.diyaccounting\\.co\\.uk/?\\?utm_source=${site}&utm_medium=(nav|footer)$`),
        );
      }
    }
    expect(found).toBe(152);
  });
});
