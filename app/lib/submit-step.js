// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// submit-step.js — The "File this return with HMRC" step that links the spreadsheets site to
// DIY Accounting Submit. Every link names its placement in utm_medium and its page in utm_campaign,
// so Submit's referral report counts the visits each placement sends. The copy states only what
// production offers: VAT returns, company accounts and the confirmation statement.

const SUBMIT_ORIGIN = "https://submit.diyaccounting.co.uk/";

export const SUBMIT_STEP_HEADING = "File with HMRC and Companies House";
export const SUBMIT_STEP_TEXT =
  "DIY Accounting Submit is HMRC recognised. It files VAT returns, and company accounts and confirmation statements to Companies House. £9.99 a year (£0.99 a month), with a free day pass to try it.";
export const SUBMIT_STEP_LINK_TEXT = "File with DIY Accounting Submit";

const ARTICLE_STEP_START = "<!-- submit-step:start -->";
const ARTICLE_STEP_END = "<!-- submit-step:end -->";

// Companies House articles get one line in context, ahead of the footer step. Each line names a
// filing production offers and links to its Submit page.
const ACCOUNTS_LINE = {
  text: "DIY Accounting Submit files micro-entity, small company and dormant company accounts with Companies House.",
  linkText: "How Submit files company accounts",
  path: "small-company-accounts.html",
};
const CONFIRMATION_STATEMENT_LINE = {
  text: "DIY Accounting Submit files the confirmation statement with Companies House.",
  linkText: "How Submit files the confirmation statement",
  path: "confirmation-statement.html",
};
export const COMPANIES_HOUSE_ARTICLE_LINES = {
  "annual-return-dormant-company": CONFIRMATION_STATEMENT_LINE,
  "limited-liability-company-formation-next-steps": CONFIRMATION_STATEMENT_LINE,
  "limited-company-directors-report": ACCOUNTS_LINE,
  "audit-exemptions-for-small-companies": ACCOUNTS_LINE,
};

export function submitStepUrl({ medium, campaign, path = "" }) {
  return `${SUBMIT_ORIGIN}${path}?utm_source=spreadsheets&utm_medium=${encodeURIComponent(medium)}&utm_campaign=${encodeURIComponent(campaign)}`;
}

function escapeAttribute(text) {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// The article footer: one block at the foot of the article element.
export function articleStepHtml(slug) {
  const href = escapeAttribute(submitStepUrl({ medium: "article-footer", campaign: slug }));
  const line = COMPANIES_HOUSE_ARTICLE_LINES[slug];
  const lineHref = line && escapeAttribute(submitStepUrl({ medium: "article", campaign: slug, path: line.path }));
  return [
    `        ${ARTICLE_STEP_START}`,
    ...(line ? [`        <p>${line.text} <a href="${lineHref}">${line.linkText}</a>.</p>`] : []),
    `        <section class="submit-step" aria-label="${SUBMIT_STEP_HEADING}">`,
    `          <h3>${SUBMIT_STEP_HEADING}</h3>`,
    `          <p>${SUBMIT_STEP_TEXT}</p>`,
    `          <p><a href="${href}" class="btn-download">${SUBMIT_STEP_LINK_TEXT}</a></p>`,
    "        </section>",
    `        ${ARTICLE_STEP_END}`,
  ].join("\n");
}

// Put the step before the closing article tag, or replace the step already there.
export function withArticleStep(html, slug) {
  const block = articleStepHtml(slug);
  const start = html.indexOf(ARTICLE_STEP_START);
  if (start !== -1) {
    const end = html.indexOf(ARTICLE_STEP_END, start);
    if (end === -1) throw new Error(`submit-step: ${slug} has a step start marker and no end marker`);
    const lineStart = html.lastIndexOf("\n", start) + 1;
    return html.slice(0, lineStart) + block + html.slice(end + ARTICLE_STEP_END.length);
  }
  const close = html.lastIndexOf("</article>");
  if (close === -1) throw new Error(`submit-step: ${slug} has no closing article tag`);
  const lineStart = html.lastIndexOf("\n", close) + 1;
  return html.slice(0, lineStart) + block + "\n" + html.slice(lineStart);
}

// A Submit link inside an article's text, with no tag of its own, gets the placement "article".
// The step block, the top navigation and the page footer sit outside the text, so they are left alone.
export function tagArticleSubmitLinks(html, slug) {
  const open = html.indexOf('<article class="kb-article">');
  const close = html.lastIndexOf("</article>");
  if (open === -1 || close === -1) throw new Error(`submit-step: ${slug} has no kb-article element`);
  const stepStart = html.indexOf(ARTICLE_STEP_START, open);
  const textEnd = stepStart !== -1 && stepStart < close ? stepStart : close;
  const text = html.slice(open, textEnd).replace(/href="(https:\/\/submit\.diyaccounting\.co\.uk)(\/[^"?#]*)?"/g, (match, origin, path) => {
    return `href="${escapeAttribute(submitStepUrl({ medium: "article", campaign: slug, path: (path || "/").slice(1) }))}"`;
  });
  return html.slice(0, open) + text + html.slice(textEnd);
}
