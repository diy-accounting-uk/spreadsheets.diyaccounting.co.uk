// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/unit-tests/submit-step.test.js
//
// Every placement that sends a reader from the spreadsheets site to DIY Accounting Submit keeps
// its link, its placement tag and the copy. A page that loses its link fails here.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  SUBMIT_STEP_HEADING,
  SUBMIT_STEP_TEXT,
  submitStepUrl,
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

describe("the copy", () => {
  it("states what production offers and the price", () => {
    expect(SUBMIT_STEP_HEADING).toBe("File this return with HMRC");
    expect(SUBMIT_STEP_TEXT).toContain("HMRC recognised");
    expect(SUBMIT_STEP_TEXT).toContain("£9.99 a year (£0.99 a month)");
    expect(SUBMIT_STEP_TEXT).toContain("free day pass");
    expect(SUBMIT_STEP_TEXT).not.toMatch(/approved|income tax|CT600/i);
  });
});

describe("download page", () => {
  const html = read("download.html");
  it("carries the page step and the thank-you step, each tagged", () => {
    expectTagged(html, "download", "download");
    expectTagged(html, "donate-thanks", "download");
    expect(html).toContain('id="submit-step-download"');
    expect(html).toContain('id="submit-step-thanks"');
    expect(html.split(`<h3>${SUBMIT_STEP_HEADING}</h3>`).length - 1).toBe(2);
  });
  it("shows the thank-you step in place of the page step when a download is ready", () => {
    const script = readFileSync(resolve(publicDir, "lib/download-page.js"), "utf8");
    expect(script).toContain('getElementById("submit-step-thanks")');
    expect(script).toContain('getElementById("submit-step-download")');
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
