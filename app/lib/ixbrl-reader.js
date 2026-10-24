// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// ixbrl-reader.js — turns an Inline XBRL document (or a plain XBRL instance)
// into a list of facts. Nothing here knows what a concept means; the mapping
// from concepts to accounts is ixbrl-accounts.js.
//
// A fact is { namespace, localName, contextRef, entity, period, dimensions,
// unit, decimals, value, hidden }. The namespace is the concept's namespace
// URI, resolved from the prefix on the element where it is written: one
// filer writes uk-bus, another bus, for the same namespace, so a prefix is
// never compared as text. A period is { instant } or { startDate, endDate }.
// dimensions maps "<namespace>#<Dimension>" to "<namespace>#<Member>" and is
// empty for a fact reported at every dimension's default.
//
// The reader uses @xmldom/xmldom, which runs in Node and in the books
// bundle; the browser's DOMParser does not exist where the CLI and the MCP
// server run.

import { DOMParser } from "@xmldom/xmldom";

const NS_IX_11 = "http://www.xbrl.org/2013/inlineXBRL";
const NS_IX_10 = "http://www.xbrl.org/2008/inlineXBRL";
const NS_XBRLI = "http://www.xbrl.org/2003/instance";
const NS_XBRLDI = "http://xbrl.org/2006/xbrldi";
const NS_LINK = "http://www.xbrl.org/2003/linkbase";
const NS_XLINK = "http://www.w3.org/1999/xlink";
const NS_XSI = "http://www.w3.org/2001/XMLSchema-instance";
const NS_ISO4217 = "http://www.xbrl.org/2003/iso4217";

// The five transformation registries, by namespace. A format in none of them
// refuses the file.
const TRANSFORMATION_REGISTRIES = [
  "http://www.xbrl.org/2008/inlineXBRL/transformation",
  "http://www.xbrl.org/inlineXBRL/transformation/2010-04-20",
  "http://www.xbrl.org/inlineXBRL/transformation/2011-07-31",
  "http://www.xbrl.org/inlineXBRL/transformation/2015-02-26",
  "http://www.xbrl.org/inlineXBRL/transformation/2020-02-12",
  "http://www.xbrl.org/inlineXBRL/transformation/2022-02-16",
];

const FRC_NAMESPACE = /^http:\/\/xbrl\.frc\.org\.uk\/(fr|cd|reports)\/(\d{4}-\d{2}-\d{2})\/(.+)$/;
const FRC_ENTRY_POINT = /xbrl\.frc\.org\.uk\/([^/]+)\/(\d{4}-\d{2}-\d{2})\//;
const OLD_UK_GAAP_NAMESPACE = /^http:\/\/www\.xbrl\.org\/uk\/(gaap|cd|fr)\b/;

// What a customer sees when a file reads as something other than FRS 102 or
// FRS 105 accounts.
const READ_SUITES = ["FRS-102", "FRS-105"];

/** A document that cannot be read as iXBRL accounts, with the message a customer reads. */
export class IxbrlError extends Error {
  constructor(message) {
    super(message);
    this.name = "IxbrlError";
  }
}

// ============================================================================
// What a byte array is
// ============================================================================

const SNIFF_BYTES = 32768;

function decodeUtf8(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Whether a byte array is an Inline XBRL document ("ixbrl"), a plain XBRL
 * instance ("xbrl") or neither (null). It reads the head of the document for
 * the inline XBRL namespace or an xbrli:xbrl root, never the extension.
 * @param {Uint8Array} bytes
 * @returns {"ixbrl"|"xbrl"|null}
 */
export function sniffIxbrl(bytes) {
  let start = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  while (start < bytes.length && (bytes[start] === 0x20 || bytes[start] === 0x09 || bytes[start] === 0x0a || bytes[start] === 0x0d))
    start += 1;
  if (bytes[start] !== 0x3c) return null; // "<"
  const head = decodeUtf8(bytes.subarray(start, start + SNIFF_BYTES));
  if (head.includes(NS_IX_11) || head.includes(NS_IX_10)) return "ixbrl";
  const root = head.match(/<(?!\?|!)([A-Za-z_][\w.-]*:)?xbrl\b[^>]*>/);
  if (root && root[0].includes(NS_XBRLI)) return "xbrl";
  return null;
}

// ============================================================================
// XML helpers
// ============================================================================

function elementChildren(node) {
  const out = [];
  for (let child = node.firstChild; child; child = child.nextSibling) if (child.nodeType === 1) out.push(child);
  return out;
}

function descendants(node, test, out = []) {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType !== 1) continue;
    if (test(child)) out.push(child);
    descendants(child, test, out);
  }
  return out;
}

const is = (element, namespace, localName) => element.namespaceURI === namespace && element.localName === localName;
const isIx = (element, localName) =>
  (element.namespaceURI === NS_IX_11 || element.namespaceURI === NS_IX_10) && element.localName === localName;

// A QName in an attribute or in text, resolved with the namespaces in scope
// at the element that holds it.
function resolveQName(element, qname, what) {
  const text = String(qname ?? "").trim();
  const colon = text.indexOf(":");
  const prefix = colon === -1 ? "" : text.slice(0, colon);
  const localName = colon === -1 ? text : text.slice(colon + 1);
  const namespace = element.lookupNamespaceURI(prefix === "" ? null : prefix);
  if (!namespace || !localName) throw new IxbrlError(`The file has ${what} "${text}" whose prefix is not declared.`);
  return { namespace, localName };
}

function textOf(element) {
  let out = "";
  for (let child = element.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 3 || child.nodeType === 4) out += child.nodeValue;
    else if (child.nodeType === 1 && !isIx(child, "exclude")) out += textOf(child);
  }
  return out;
}

// ============================================================================
// Transformations
// ============================================================================

const MONTH_NAMES = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

// number format -> the characters that group thousands and mark decimals
const NUMBER_FORMATS = {
  "numdotdecimal": { group: /[,\s]/g, decimal: "." },
  "num-dot-decimal": { group: /[,\s]/g, decimal: "." },
  "numcommadot": { group: /[,\s]/g, decimal: "." },
  "numspacedot": { group: /[\s]/g, decimal: "." },
  "numcommadecimal": { group: /[.\s]/g, decimal: "," },
  "num-comma-decimal": { group: /[.\s]/g, decimal: "," },
  "numdotcomma": { group: /[.\s]/g, decimal: "," },
  "numspacecomma": { group: /[\s]/g, decimal: "," },
};

const ZERO_FORMATS = new Set(["nocontent", "zerodash", "numdash", "fixed-zero"]);

// date format -> the order of its parts
const DATE_ORDERS = {
  "datedaymonthyear": "dmy",
  "datedaymonthyearen": "dmy",
  "date-day-monthname-year-en": "dmy",
  "date-day-month-year": "dmy",
  "dateslasheu": "dmy",
  "datelonguk": "dmy",
  "datedoteu": "dmy",
  "datedaymonthyearin": "dmy",
  "datemonthdayyear": "mdy",
  "datemonthdayyearen": "mdy",
  "date-monthname-day-year-en": "mdy",
  "date-month-day-year": "mdy",
  "dateslashus": "mdy",
  "datelongus": "mdy",
  "datedotus": "mdy",
  "dateyearmonthday": "ymd",
  "date-year-month-day": "ymd",
  "dateyearmonthdaycjk": "ymd",
};

const BOOLEAN_FORMATS = { "booleantrue": "true", "booleanfalse": "false", "fixed-true": "true", "fixed-false": "false" };

function transformationOf(element, format) {
  const { namespace, localName } = resolveQName(element, format, "a format");
  if (!TRANSFORMATION_REGISTRIES.includes(namespace)) {
    throw new IxbrlError(`The file uses the format "${format}", which is not in a transformation registry diya-gl reads.`);
  }
  return localName;
}

function unknownFormat(format) {
  return new IxbrlError(`The file uses the format "${format}", which diya-gl does not read.`);
}

function twoDigitYear(year) {
  const n = Number(year);
  if (year.length === 4) return n;
  return n < 70 ? 2000 + n : 1900 + n;
}

function isoDate(text, order, format) {
  const parts = text
    .trim()
    .replace(/(\d)(st|nd|rd|th)\b/gi, "$1")
    .split(/[\s./,-]+/)
    .filter(Boolean);
  if (parts.length !== 3) throw new IxbrlError(`The date "${text.trim()}" does not fit the format "${format}".`);
  const month = (part) => (/^\d+$/.test(part) ? Number(part) : MONTH_NAMES[part.toLowerCase()]);
  let day;
  let mon;
  let year;
  if (order === "dmy") [day, mon, year] = [Number(parts[0]), month(parts[1]), parts[2]];
  else if (order === "mdy") [mon, day, year] = [month(parts[0]), Number(parts[1]), parts[2]];
  else [year, mon, day] = [parts[0], month(parts[1]), Number(parts[2])];
  if (!/^\d{2}(\d{2})?$/.test(String(year)) || !mon || !day || mon > 12 || day > 31) {
    throw new IxbrlError(`The date "${text.trim()}" does not fit the format "${format}".`);
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${twoDigitYear(String(year))}-${pad(mon)}-${pad(day)}`;
}

function numberOf(text, localName, format) {
  const spec = NUMBER_FORMATS[localName];
  if (!spec) throw unknownFormat(format);
  let cleaned = text.replace(/[()]/g, "").trim().replace(spec.group, "");
  if (spec.decimal === ",") cleaned = cleaned.replace(",", ".");
  if (!/^-?\d*\.?\d+$|^-?\d+\.?$/.test(cleaned)) {
    throw new IxbrlError(`The number "${text.trim()}" does not fit the format "${format}".`);
  }
  return cleaned;
}

// ============================================================================
// Contexts and units
// ============================================================================

function readMember(element, what) {
  if (is(element, NS_XBRLDI, "explicitMember") && textOf(element).trim() === "") return null;
  const dimension = resolveQName(element, element.getAttribute("dimension"), what);
  const key = `${dimension.namespace}#${dimension.localName}`;
  if (is(element, NS_XBRLDI, "explicitMember")) {
    const member = resolveQName(element, textOf(element), what);
    return [key, `${member.namespace}#${member.localName}`];
  }
  const typed = elementChildren(element)[0];
  return [key, `typed:${typed ? textOf(typed).trim() : ""}`];
}

function readContext(element) {
  const id = element.getAttribute("id");
  const entityElement = elementChildren(element).find((child) => is(child, NS_XBRLI, "entity"));
  const identifier = entityElement && elementChildren(entityElement).find((child) => is(child, NS_XBRLI, "identifier"));
  const periodElement = elementChildren(element).find((child) => is(child, NS_XBRLI, "period"));
  if (!id || !identifier || !periodElement) throw new IxbrlError(`The file has a context ("${id ?? ""}") with no entity or period.`);

  const period = {};
  for (const child of elementChildren(periodElement)) {
    const value = textOf(child).trim();
    if (is(child, NS_XBRLI, "instant")) period.instant = value;
    else if (is(child, NS_XBRLI, "startDate")) period.startDate = value;
    else if (is(child, NS_XBRLI, "endDate")) period.endDate = value;
    else if (is(child, NS_XBRLI, "forever")) period.forever = true;
  }

  const dimensions = {};
  const holders = [
    ...elementChildren(entityElement).filter((child) => is(child, NS_XBRLI, "segment")),
    ...elementChildren(element).filter((child) => is(child, NS_XBRLI, "scenario")),
  ];
  for (const holder of holders) {
    for (const member of elementChildren(holder)) {
      if (is(member, NS_XBRLDI, "explicitMember") || is(member, NS_XBRLDI, "typedMember")) {
        const entry = readMember(member, "a dimension member");
        if (entry) dimensions[entry[0]] = entry[1];
      }
    }
  }
  return {
    id,
    entity: { identifier: textOf(identifier).trim(), scheme: identifier.getAttribute("scheme") || "" },
    period,
    dimensions,
  };
}

function readUnit(element) {
  const measures = descendants(element, (child) => is(child, NS_XBRLI, "measure")).map((measure) => {
    const text = textOf(measure).trim();
    if (!text.includes(":")) return text;
    const { namespace, localName } = resolveQName(measure, text, "a measure");
    if (namespace === NS_ISO4217) return localName;
    if (namespace === NS_XBRLI) return localName;
    return `${namespace}#${localName}`;
  });
  const isDivide = descendants(element, (child) => is(child, NS_XBRLI, "divide")).length > 0;
  return isDivide ? `divide:${measures.join("/")}` : measures.join("*");
}

// ============================================================================
// Reading a document
// ============================================================================

function periodKey(period) {
  return period.instant ? `i:${period.instant}` : period.forever ? "forever" : `d:${period.startDate}/${period.endDate}`;
}

function contextKey(context) {
  const dims = Object.entries(context.dimensions)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([d, m]) => `${d}=${m}`)
    .join(",");
  return `${context.entity.scheme}|${context.entity.identifier}|${periodKey(context.period)}|${dims}`;
}

function parseDocument(text) {
  const errors = [];
  const parser = new DOMParser({
    onError: (level, message) => {
      if (level !== "warning") errors.push(message);
    },
  });
  let document;
  try {
    document = parser.parseFromString(text, "application/xml");
  } catch (cause) {
    throw new IxbrlError(`The file is not well-formed XML (${cause.message}).`);
  }
  if (errors.length > 0 || !document || !document.documentElement) {
    throw new IxbrlError(`The file is not well-formed XML (${errors[0] ?? "no root element"}).`);
  }
  return document;
}

// Facts, contexts and units of an inline document.
function inlineParts(document) {
  const root = document.documentElement;
  const headers = descendants(root, (element) => isIx(element, "header"));
  const resources = headers.flatMap((header) => descendants(header, (element) => isIx(element, "resources")));
  const schemaRefs = headers.flatMap((header) => descendants(header, (element) => is(element, NS_LINK, "schemaRef")));
  const hiddenElements = new Set(headers.flatMap((header) => descendants(header, (element) => isIx(element, "hidden"))));
  const factElements = descendants(root, (element) => isIx(element, "nonFraction") || isIx(element, "nonNumeric"));
  const continuations = new Map(
    descendants(root, (element) => isIx(element, "continuation")).map((element) => [element.getAttribute("id"), element]),
  );
  return { root, resources, schemaRefs, hiddenElements, factElements, continuations };
}

function instanceParts(document) {
  const root = document.documentElement;
  const schemaRefs = elementChildren(root).filter((element) => is(element, NS_LINK, "schemaRef"));
  const factElements = elementChildren(root).filter(
    (element) =>
      element.namespaceURI !== NS_XBRLI &&
      element.namespaceURI !== NS_LINK &&
      element.namespaceURI !== null &&
      !element.localName.startsWith("xbrl"),
  );
  return { root, resources: [root], schemaRefs, hiddenElements: new Set(), factElements, continuations: new Map() };
}

function insideHidden(element, hiddenElements) {
  for (let node = element.parentNode; node; node = node.parentNode) if (hiddenElements.has(node)) return true;
  return false;
}

// The text of a nonNumeric fact: exclusions removed, continuation chain joined.
function nonNumericText(element, continuations) {
  let text = textOf(element);
  const seen = new Set();
  let next = element.getAttribute("continuedAt");
  while (next) {
    if (seen.has(next)) break;
    seen.add(next);
    const continuation = continuations.get(next);
    if (!continuation) {
      throw new IxbrlError(
        "This file is one part of a document set: a fact continues in another file. diya-gl reads single-file documents.",
      );
    }
    text += textOf(continuation);
    next = continuation.getAttribute("continuedAt");
  }
  return text;
}

function nonFractionValue(element) {
  let inner = element;
  for (;;) {
    const nested =
      elementChildren(inner).find((child) => isIx(child, "nonFraction")) ?? descendants(inner, (child) => isIx(child, "nonFraction"))[0];
    if (!nested) break;
    inner = nested;
  }
  const format = element.getAttribute("format");
  const raw = textOf(inner);
  let digits;
  if (format) {
    const localName = transformationOf(element, format);
    if (ZERO_FORMATS.has(localName)) digits = "0";
    else digits = numberOf(raw, localName, format);
  } else {
    digits = numberOf(raw, "numdotdecimal", "numdotdecimal");
  }
  const scale = Number(element.getAttribute("scale") || 0);
  let value = Number(`${digits}e${scale}`);
  if (element.getAttribute("sign") === "-") value = -value;
  return value === 0 ? 0 : value;
}

function nonNumericValue(element, continuations) {
  const raw = nonNumericText(element, continuations);
  const format = element.getAttribute("format");
  if (!format) return raw.replace(/\s+/g, " ").trim();
  const localName = transformationOf(element, format);
  if (localName === "nocontent") return "";
  if (BOOLEAN_FORMATS[localName] !== undefined) return BOOLEAN_FORMATS[localName] === "true" ? "true" : "false";
  if (localName === "fixed-empty") return "";
  if (DATE_ORDERS[localName]) return isoDate(raw, DATE_ORDERS[localName], format);
  throw unknownFormat(format);
}

function suiteOf(namespaces, schemaRefs) {
  const suite = { family: null, date: null, modules: new Set() };
  for (const ref of schemaRefs) {
    const href = ref.getAttributeNS(NS_XLINK, "href") || ref.getAttribute("xlink:href") || "";
    const match = href.match(FRC_ENTRY_POINT);
    if (match) {
      suite.family = match[1];
      suite.date = match[2];
    } else if (/xbrl\.org\/uk\//.test(href)) {
      suite.family = "UK-GAAP";
    }
  }
  for (const namespace of namespaces) {
    const match = namespace.match(FRC_NAMESPACE);
    if (match) {
      suite.date ??= match[2];
      suite.modules.add(match[3]);
    } else if (OLD_UK_GAAP_NAMESPACE.test(namespace)) {
      suite.family = "UK-GAAP";
    }
  }
  return suite;
}

const SUITE_LABELS = {
  "FRS-101": "FRS 101",
  "IFRS": "IFRS",
  "Charities": "Charities SORP",
  "UKSEF": "UK Single Electronic Format",
  "UK-GAAP": "old UK GAAP",
};

function checkSuite(suite) {
  if (suite.family && !READ_SUITES.includes(suite.family)) {
    const label = SUITE_LABELS[suite.family] ?? suite.family;
    throw new IxbrlError(`This file uses the ${label} taxonomy; the form takes FRS 102 and FRS 105 accounts.`);
  }
}

/**
 * Read an Inline XBRL document or an XBRL instance into facts.
 * @param {Uint8Array|string} input - the document
 * @returns {{kind: "ixbrl"|"xbrl", suite: {family: string|null, date: string|null, modules: string[]}, facts: Array<Object>, contexts: Object, units: Object}}
 * @throws {IxbrlError} when the document cannot be read, with a message a customer reads
 */
export function readIxbrl(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const kind = sniffIxbrl(bytes);
  if (!kind) throw new IxbrlError("This file is not an Inline XBRL document or an XBRL instance.");

  const document = parseDocument(decodeUtf8(bytes));
  const parts = kind === "ixbrl" ? inlineParts(document) : instanceParts(document);

  const contexts = {};
  const units = {};
  for (const resource of parts.resources) {
    for (const child of elementChildren(resource)) {
      if (is(child, NS_XBRLI, "context")) {
        const context = readContext(child);
        contexts[context.id] = context;
      } else if (is(child, NS_XBRLI, "unit")) {
        units[child.getAttribute("id")] = readUnit(child);
      }
    }
  }
  if (Object.keys(contexts).length === 0 && parts.factElements.length > 0) {
    throw new IxbrlError("This file is one part of a document set: its contexts are in another file. diya-gl reads single-file documents.");
  }

  const facts = [];
  const seen = new Map();
  const factNamespaces = new Set();
  for (const element of parts.factElements) {
    const nameAttribute = kind === "ixbrl" ? element.getAttribute("name") : null;
    if (kind === "ixbrl" && !nameAttribute) continue;
    if (element.getAttributeNS(NS_XSI, "nil") === "true" || element.getAttribute("xsi:nil") === "true") continue;

    const { namespace, localName } =
      kind === "ixbrl"
        ? resolveQName(element, nameAttribute, "a concept name")
        : { namespace: element.namespaceURI, localName: element.localName };
    factNamespaces.add(namespace);

    const contextRef = element.getAttribute("contextRef");
    const context = contexts[contextRef];
    if (!context) throw new IxbrlError(`The fact ${localName} refers to the context "${contextRef}", which the file does not define.`);

    const numeric = kind === "ixbrl" ? isIx(element, "nonFraction") : element.hasAttribute("unitRef");
    let value;
    let unit = null;
    let decimals;
    if (numeric) {
      const unitRef = element.getAttribute("unitRef");
      unit = units[unitRef];
      if (unit === undefined)
        throw new IxbrlError(`The fact ${localName} refers to the unit "${unitRef}", which the file does not define.`);
      if (unit !== "GBP" && unit !== "pure" && unit !== "shares" && !unit.startsWith("divide:")) {
        throw new IxbrlError(`The fact ${localName} is stated in ${unit}; diya-gl reads pounds sterling (GBP), shares and pure numbers.`);
      }
      const decimalsText = element.getAttribute("decimals");
      decimals = decimalsText === null ? undefined : decimalsText === "INF" ? Infinity : Number(decimalsText);
      value = kind === "ixbrl" ? nonFractionValue(element) : Number(textOf(element).trim());
    } else {
      value = kind === "ixbrl" ? nonNumericValue(element, parts.continuations) : textOf(element).trim();
    }

    const fact = {
      namespace,
      localName,
      contextRef,
      entity: context.entity,
      period: context.period,
      dimensions: context.dimensions,
      unit,
      decimals,
      value,
      hidden: insideHidden(element, parts.hiddenElements),
    };

    const key = `${namespace}#${localName}|${contextKey(context)}|${unit ?? ""}`;
    if (seen.has(key)) {
      const first = seen.get(key);
      if (first.value !== value) {
        throw new IxbrlError(`The file states ${localName} twice for the same period with different values (${first.value} and ${value}).`);
      }
      first.hidden = first.hidden && fact.hidden;
      continue;
    }
    seen.set(key, fact);
    facts.push(fact);
  }

  const suite = suiteOf(factNamespaces, parts.schemaRefs);
  checkSuite(suite);

  return { kind, suite: { family: suite.family, date: suite.date, modules: [...suite.modules] }, facts, contexts, units };
}
