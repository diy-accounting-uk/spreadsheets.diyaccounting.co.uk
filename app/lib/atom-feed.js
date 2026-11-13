// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// atom-feed.js — Pure function that renders an Atom 1.0 feed (RFC 4287) of recently updated articles.

// Whole seconds, then Z or an offset: the form recently-updated.toml uses.
const RFC_3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/;

export function escapeXmlText(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function checkedDate(value, what) {
  if (typeof value !== "string" || !RFC_3339.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`atom-feed.js: ${what} is not an RFC 3339 date: ${value}`);
  }
  return value;
}

// entries: { url, title, summary, updated }. The feed's own updated date is the newest entry's,
// so the same input always renders the same document.
export function renderAtomFeed({ siteUrl, feedUrl, title, subtitle, authorName, entries }) {
  if (entries.length === 0) throw new Error("atom-feed.js: a feed needs at least one entry");
  const dated = entries.map((entry) => ({ ...entry, updated: checkedDate(entry.updated, `the date of ${entry.url}`) }));
  dated.sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated) || a.url.localeCompare(b.url));
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->",
    "<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->",
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${escapeXmlText(feedUrl)}</id>`,
    `  <title>${escapeXmlText(title)}</title>`,
    `  <subtitle>${escapeXmlText(subtitle)}</subtitle>`,
    `  <updated>${dated[0].updated}</updated>`,
    `  <link rel="self" type="application/atom+xml" href="${escapeXmlText(feedUrl)}" />`,
    `  <link rel="alternate" type="text/html" href="${escapeXmlText(siteUrl)}" />`,
    `  <author><name>${escapeXmlText(authorName)}</name></author>`,
  ];
  for (const entry of dated) {
    lines.push(
      "  <entry>",
      `    <id>${escapeXmlText(entry.url)}</id>`,
      `    <title>${escapeXmlText(entry.title)}</title>`,
      `    <link rel="alternate" type="text/html" href="${escapeXmlText(entry.url)}" />`,
      `    <updated>${entry.updated}</updated>`,
      `    <summary>${escapeXmlText(entry.summary)}</summary>`,
      "  </entry>",
    );
  }
  lines.push("</feed>", "");
  return lines.join("\n");
}
