// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ixbrl-document.js — small Inline XBRL documents for the reader and mapping
// tests: a header with the usual contexts and units, and the facts a test
// puts in the body.

export const CORE = "http://xbrl.frc.org.uk/fr/2024-01-01/core";
export const BUSINESS = "http://xbrl.frc.org.uk/cd/2024-01-01/business";
export const DIREP = "http://xbrl.frc.org.uk/reports/2024-01-01/direp";
export const IX_11 = "http://www.xbrl.org/2013/inlineXBRL";
export const IX_10 = "http://www.xbrl.org/2008/inlineXBRL";

const PERIOD = { start: "2024-04-01", end: "2025-03-31" };
const PRIOR_PERIOD = { start: "2023-04-01", end: "2024-03-31" };

/** A context element. `members` is [[dimension, member]] as prefixed names. */
export function context(id, { instant, start, end, members = [], scenario = false } = {}) {
  const period = instant
    ? `<xbrli:instant>${instant}</xbrli:instant>`
    : `<xbrli:startDate>${start}</xbrli:startDate><xbrli:endDate>${end}</xbrli:endDate>`;
  const explicit = members
    .map(([dimension, member]) => `<xbrldi:explicitMember dimension="${dimension}">${member}</xbrldi:explicitMember>`)
    .join("");
  const segment = explicit && !scenario ? `<xbrli:segment>${explicit}</xbrli:segment>` : "";
  const scenarioXml = explicit && scenario ? `<xbrli:scenario>${explicit}</xbrli:scenario>` : "";
  return `<xbrli:context id="${id}"><xbrli:entity><xbrli:identifier scheme="http://www.companieshouse.gov.uk/">12345678</xbrli:identifier>${segment}</xbrli:entity><xbrli:period>${period}</xbrli:period>${scenarioXml}</xbrli:context>`;
}

export const STANDARD_CONTEXTS = [
  context("CY", { start: PERIOD.start, end: PERIOD.end }),
  context("PY", { start: PRIOR_PERIOD.start, end: PRIOR_PERIOD.end }),
  context("CY_END", { instant: PERIOD.end }),
  context("PY_END", { instant: PRIOR_PERIOD.end }),
].join("");

const STANDARD_UNITS = `<xbrli:unit id="GBP"><xbrli:measure>iso4217:GBP</xbrli:measure></xbrli:unit><xbrli:unit id="pure"><xbrli:measure>xbrli:pure</xbrli:measure></xbrli:unit><xbrli:unit id="shares"><xbrli:measure>xbrli:shares</xbrli:measure></xbrli:unit>`;

/** An ix:nonFraction. */
export function money(name, contextRef, text, attributes = "") {
  return `<ix:nonFraction name="${name}" contextRef="${contextRef}" unitRef="GBP" decimals="0" ${attributes}>${text}</ix:nonFraction>`;
}

/** An ix:nonNumeric. */
export function words(name, contextRef, text, attributes = "") {
  return `<ix:nonNumeric name="${name}" contextRef="${contextRef}" ${attributes}>${text}</ix:nonNumeric>`;
}

/**
 * A whole document.
 * @param {Object} [options]
 * @param {string} [options.body] - the facts and text of the body
 * @param {string} [options.hidden] - facts for ix:hidden
 * @param {string} [options.contexts] - context elements; defaults to the four standard ones
 * @param {string} [options.units]
 * @param {string} [options.ix] - the inline XBRL namespace
 * @param {string} [options.namespaces] - extra xmlns declarations
 * @param {string} [options.schemaRef] - the entry point href
 */
export function ixbrlDocument({
  body = "",
  hidden = "",
  contexts = STANDARD_CONTEXTS,
  units = STANDARD_UNITS,
  ix = IX_11,
  namespaces = "",
  schemaRef = "https://xbrl.frc.org.uk/FRS-102/2024-01-01/FRS-102-2024-01-01.xsd",
} = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="${ix}" xmlns:ixt="http://www.xbrl.org/inlineXBRL/transformation/2010-04-20" xmlns:ixt2="http://www.xbrl.org/inlineXBRL/transformation/2011-07-31" xmlns:ixt3="http://www.xbrl.org/inlineXBRL/transformation/2015-02-26" xmlns:ixt4="http://www.xbrl.org/inlineXBRL/transformation/2020-02-12" xmlns:ixt5="http://www.xbrl.org/inlineXBRL/transformation/2022-02-16" xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:link="http://www.xbrl.org/2003/linkbase" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" xmlns:core="${CORE}" xmlns:uk-bus="${BUSINESS}" xmlns:direp="${DIREP}" ${namespaces}>
<head><title>Test accounts</title></head>
<body>
<div style="display:none"><ix:header><ix:hidden>${hidden}</ix:hidden><ix:references><link:schemaRef xlink:type="simple" xlink:href="${schemaRef}"/></ix:references><ix:resources>${units}${contexts}</ix:resources></ix:header></div>
${body}
</body>
</html>`;
}

/** A plain XBRL instance (xbrli:xbrl root) whose facts are child elements. */
export function xbrlInstance(facts) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:link="http://www.xbrl.org/2003/linkbase" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" xmlns:core="${CORE}" xmlns:uk-bus="${BUSINESS}">
<link:schemaRef xlink:type="simple" xlink:href="https://xbrl.frc.org.uk/FRS-102/2024-01-01/FRS-102-2024-01-01.xsd"/>
${STANDARD_UNITS}${STANDARD_CONTEXTS}
${facts}
</xbrli:xbrl>`;
}
