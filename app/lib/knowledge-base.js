// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// knowledge-base.js — Pure functions that build the knowledge base index (knowledge-base.toml)
// from the published article pages. Each article page holds its question, description and
// category badge. The search keywords and the list order sit in app/data/knowledge-base-search.toml.
// Pages are read with the HTML parser that llms-txt.js uses, never with regular expressions.

import { parseHtml, metaContent } from "./llms-txt.js";

// The category badge text on an article page, and the category id the knowledge base page filters by.
const CATEGORY_BY_BADGE = new Map([
  ["Bookkeeping", "bookkeeping"],
  ["Sole Trader", "sole-trader"],
  ["Company Accounts", "company-accounts"],
  ["Company Formation", "company-formation"],
  ["VAT", "vat"],
  ["Expenses & Allowances", "expenses"],
  ["Payroll & PAYE", "payroll"],
  ["Taxi Driver", "taxi"],
  ["Financial Planning", "financial-planning"],
  ["Tax", "tax"],
  ["Tax Returns", "tax"],
  ["General", "general"],
]);

function squash(text) {
  return text.replace(/\s+/g, " ").trim();
}

function hasClass(element, name) {
  return (element.getAttribute("class") || "").split(/\s+/).includes(name);
}

function articleElement(document, id) {
  const articles = document.getElementsByTagName("article");
  for (let index = 0; index < articles.length; index += 1) {
    if (hasClass(articles[index], "kb-article")) return articles[index];
  }
  throw new Error(`knowledge-base.js: articles/${id}.html has no article.kb-article element`);
}

function firstWithin(element, tagName, className) {
  const found = element.getElementsByTagName(tagName);
  for (let index = 0; index < found.length; index += 1) {
    if (!className || hasClass(found[index], className)) return found[index];
  }
  return null;
}

// The question, description and category of one published article page.
export function articleFields(id, html) {
  const document = parseHtml(html);
  const article = articleElement(document, id);
  const heading = firstWithin(article, "h2");
  const badge = firstWithin(article, "span", "kb-category-badge");
  if (!heading) throw new Error(`knowledge-base.js: articles/${id}.html has no h2 question`);
  if (!badge) throw new Error(`knowledge-base.js: articles/${id}.html has no category badge`);
  const badgeText = squash(badge.textContent);
  const category = CATEGORY_BY_BADGE.get(badgeText);
  if (!category) throw new Error(`knowledge-base.js: articles/${id}.html has the unknown category badge "${badgeText}"`);
  const description = metaContent(document, "name", "description");
  if (!description) throw new Error(`knowledge-base.js: articles/${id}.html has no meta description`);
  return { question: squash(heading.textContent), description, category };
}

// articles: [{ id, html }]; searchEntries: [{ id, priority, keywords }].
// Returns the entries in list order. Every article has one search entry and every search entry has one article.
export function buildKnowledgeBase(articles, searchEntries) {
  const byId = new Map();
  for (const entry of searchEntries) {
    if (byId.has(entry.id)) throw new Error(`knowledge-base.js: knowledge-base-search.toml lists ${entry.id} twice`);
    byId.set(entry.id, entry);
  }
  const articleIds = new Set(articles.map((article) => article.id));
  for (const id of byId.keys()) {
    if (!articleIds.has(id)) throw new Error(`knowledge-base.js: knowledge-base-search.toml lists ${id}, which has no article page`);
  }
  const entries = articles.map(({ id, html }) => {
    const search = byId.get(id);
    if (!search) throw new Error(`knowledge-base.js: knowledge-base-search.toml has no entry for ${id}`);
    for (const keyword of search.keywords) {
      if (keyword.includes(",") || keyword.includes('"')) {
        throw new Error(`knowledge-base.js: keyword "${keyword}" of ${id} holds a comma or a quote the page parser cannot read`);
      }
    }
    return { id, ...articleFields(id, html), keywords: search.keywords, priority: search.priority };
  });
  entries.sort((first, second) => first.priority - second.priority || first.id.localeCompare(second.id));
  return entries;
}

function tomlString(text) {
  if (text.includes('"') || text.includes("\\")) {
    throw new Error(`knowledge-base.js: "${text}" holds a quote or backslash the page parser cannot read`);
  }
  return `"${text}"`;
}

export function renderKnowledgeBaseToml(entries) {
  const lines = [
    "# SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0",
    "# Copyright (C) 2006-2026 DIY Accounting Limited",
    "",
    "# DIY Accounting Spreadsheets Knowledge Base - Index",
    "# Built from the published pages in articles/ by app/bin/build-knowledge-base.js",
    "# Full article content in articles/{id}.md and articles/{id}.html",
    "",
  ];
  for (const entry of entries) {
    lines.push(
      "[[article]]",
      `id = ${tomlString(entry.id)}`,
      `category = ${tomlString(entry.category)}`,
      `question = ${tomlString(entry.question)}`,
      `description = ${tomlString(entry.description)}`,
      `keywords = [${entry.keywords.map(tomlString).join(", ")}]`,
      `priority = ${entry.priority}`,
      "",
    );
  }
  return lines.join("\n");
}
