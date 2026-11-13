// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// knowledge-base.test.js — the knowledge base list is built from the published article pages.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { parse as parseTOML } from "smol-toml";
import { articleFields, buildKnowledgeBase, renderKnowledgeBaseToml } from "../lib/knowledge-base.js";

const ROOT = resolve(__dirname, "../..");
const PUBLIC_DIR = resolve(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");

function page({ question = "A Question", badge = "VAT", description = "A description." } = {}) {
  return `<!doctype html><html><head><title>${question} - DIY Accounting Spreadsheets</title>
<meta name="description" content="${description}" /></head><body>
<main><article class="kb-article"><span class="kb-category-badge">${badge}</span><h2>${question}</h2><p>Body.</p></article></main>
</body></html>`;
}

describe("articleFields", () => {
  it("reads the question, description and category from the page", () => {
    expect(articleFields("a", page({ question: "What is VAT?", description: "How VAT works." }))).toEqual({
      question: "What is VAT?",
      description: "How VAT works.",
      category: "vat",
    });
  });

  it("decodes an ampersand in the badge and maps it to its category id", () => {
    expect(articleFields("a", page({ badge: "Payroll &amp; PAYE" })).category).toBe("payroll");
    expect(articleFields("a", page({ badge: "Expenses &amp; Allowances" })).category).toBe("expenses");
  });

  it("files the Tax Returns badge under tax", () => {
    expect(articleFields("a", page({ badge: "Tax Returns" })).category).toBe("tax");
  });

  it("refuses a badge it does not know", () => {
    expect(() => articleFields("a", page({ badge: "Gardening" }))).toThrow(/unknown category badge "Gardening"/);
  });

  it("refuses a page with no description", () => {
    expect(() => articleFields("a", page({ description: "" }))).toThrow(/no meta description/);
  });

  it("refuses a page with no article element", () => {
    expect(() => articleFields("a", "<html><head><title>x</title></head><body></body></html>")).toThrow(/no article.kb-article/);
  });
});

describe("buildKnowledgeBase", () => {
  const articles = [
    { id: "b", html: page({ question: "Second" }) },
    { id: "a", html: page({ question: "First" }) },
  ];
  const search = [
    { id: "a", priority: 2, keywords: ["one"] },
    { id: "b", priority: 1, keywords: [] },
  ];

  it("orders the entries by priority and carries the search keywords", () => {
    const entries = buildKnowledgeBase(articles, search);
    expect(entries.map((entry) => entry.id)).toEqual(["b", "a"]);
    expect(entries[1]).toMatchObject({ question: "First", keywords: ["one"], priority: 2, category: "vat" });
  });

  it("refuses an article with no search entry", () => {
    expect(() => buildKnowledgeBase(articles, [search[0]])).toThrow(/no entry for b/);
  });

  it("refuses a search entry with no article", () => {
    expect(() => buildKnowledgeBase([articles[0]], search)).toThrow(/lists a, which has no article page/);
  });

  it("refuses a search entry listed twice", () => {
    expect(() => buildKnowledgeBase(articles, [...search, search[0]])).toThrow(/lists a twice/);
  });

  it("refuses a keyword with a comma, which the page parser would split", () => {
    expect(() => buildKnowledgeBase(articles, [{ id: "a", priority: 1, keywords: ["x, y"] }, search[1]])).toThrow(/comma/);
  });
});

describe("renderKnowledgeBaseToml", () => {
  it("writes a list the page reads back field for field", () => {
    const entries = buildKnowledgeBase(
      [{ id: "a", html: page({ question: "Q & A", description: "D" }) }],
      [{ id: "a", priority: 1, keywords: ["k1", "k2"] }],
    );
    const parsed = parseTOML(renderKnowledgeBaseToml(entries)).article;
    expect(parsed).toEqual([{ id: "a", category: "vat", question: "Q & A", description: "D", keywords: ["k1", "k2"], priority: 1 }]);
  });
});

describe("the published knowledge base", () => {
  const ids = readdirSync(resolve(PUBLIC_DIR, "articles"))
    .filter((file) => file.endsWith(".html"))
    .map((file) => file.replace(/\.html$/, ""));
  const articles = ids.map((id) => ({ id, html: readFileSync(resolve(PUBLIC_DIR, "articles", `${id}.html`), "utf8") }));
  const searchEntries = parseTOML(readFileSync(resolve(ROOT, "app/data/knowledge-base-search.toml"), "utf8")).article;
  const entries = buildKnowledgeBase(articles, searchEntries);

  it("lists every article page once", () => {
    expect(entries.map((entry) => entry.id).sort()).toEqual([...ids].sort());
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
  });

  it("lists no article whose address redirects elsewhere", () => {
    const redirects = parseTOML(readFileSync(resolve(ROOT, "web/spreadsheets.diyaccounting.co.uk/redirects.toml"), "utf8")).redirect;
    const redirected = redirects
      .map((redirect) => redirect.from)
      .filter((from) => from.startsWith("/articles/"))
      .map((from) => from.slice("/articles/".length).replace(/\.html$/, ""));
    expect(redirected.length).toBeGreaterThan(0);
    for (const slug of redirected) expect(entries.map((entry) => entry.id)).not.toContain(slug);
  });

  it("gives every entry a question, a description, a category and a distinct priority", () => {
    for (const entry of entries) {
      expect(entry.question, entry.id).not.toBe("");
      expect(entry.description, entry.id).not.toBe("");
      expect(entry.category, entry.id).not.toBe("");
    }
    expect(new Set(entries.map((entry) => entry.priority)).size).toBe(entries.length);
  });
});
