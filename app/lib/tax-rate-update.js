// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// tax-rate-update.js — the monthly tax-rate update (.github/workflows/update-tax-rates.yml).
//
// For each tax data file whose period has not ended, and for the next year's
// pair, one Bedrock Converse call reads the gov.uk pages and answers through a
// forced tool call whose schema lists that file's fields. Each figure carries
// a verbatim quote and the page it came from. A figure is used only when the
// quote is on that page and the quote states the figure.
//
// The writer edits a data file line by line. A line changes only when its
// value differs from the accepted figure, and the new value is written in a
// fixed format for its kind. Key order, comments and every other byte stay as
// they are, so a month with no change writes the same bytes and the workflow
// commits nothing.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

export const MODEL_ID = "us.amazon.nova-2-lite-v1:0";
export const DEFAULT_REGION = "us-east-1";
export const TEMPERATURE = 0;
export const MAX_TOKENS = 30000;
const MODEL_REQUEST_FIELDS = { reasoningConfig: { type: "enabled", maxReasoningEffort: "medium" } };

export const RATES_TOOL = "record_rates";

// The most text one page contributes to the prompt.
export const PAGE_TEXT_LIMIT = 60000;

// Submit's tax-sources files whose names start with one of these hold the rate pages.
export const RATE_SOURCE_PREFIXES = [
  "income-tax-",
  "ni-",
  "corporation-tax-",
  "capital-allowances-",
  "vat-registration-threshold",
  "vat-standard-rate",
  "mileage-rates",
];

// Pages neither submit's sources nor scripts/hmrc-rate-urls.cjs name.
export const EXTRA_URLS = ["https://www.gov.uk/tax-on-dividends"];

// rate: a fraction (25% is 0.25). amount: whole pounds. money: pounds and pence.
const RATE = "rate";
const AMOUNT = "amount";
const MONEY = "money";

const MILEAGE_FIELDS = [
  [
    "mileage.higher_rate_pence",
    MONEY,
    "Approved mileage rate for cars and vans, in pounds per mile, for the first 10,000 business miles in the tax year",
  ],
  ["mileage.lower_rate_pence", MONEY, "Approved mileage rate for cars and vans, in pounds per mile, for each business mile over 10,000"],
  ["mileage.higher_rate_limit", AMOUNT, "Business miles in the tax year at the first approved mileage rate for cars and vans"],
];
const VAT_FIELDS = [
  ["vat.registration_threshold", AMOUNT, "VAT registration threshold: taxable turnover in a 12-month period"],
  ["vat.standard_rate", RATE, "Standard rate of VAT"],
];

// The figures the model reads, per kind of data file. A field the file does
// not carry is left out of that file's call.
export const FIELDS = {
  se: [
    ["income_tax.personal_allowance", AMOUNT, "Standard Personal Allowance"],
    ["income_tax.basic_rate", RATE, "Basic rate of Income Tax"],
    ["income_tax.higher_rate", RATE, "Higher rate of Income Tax"],
    ["income_tax.additional_rate", RATE, "Additional rate of Income Tax"],
    [
      "income_tax.basic_band_end",
      AMOUNT,
      "Top of the basic rate band as taxable income after the Personal Allowance (37,700 when the band is £1 to £37,700)",
    ],
    [
      "income_tax.higher_band_end",
      AMOUNT,
      "Top of the higher rate band, where the additional rate starts (125,140 when the additional rate is over £125,140)",
    ],
    ["income_tax.personal_allowance_taper_threshold", AMOUNT, "Income limit above which the Personal Allowance goes down"],
    [
      "national_insurance.class4_lower_rate",
      RATE,
      "Class 4 National Insurance main rate, on profits between the lower and upper profits limits",
    ],
    ["national_insurance.class4_upper_rate", RATE, "Class 4 National Insurance rate on profits over the upper profits limit"],
    ["national_insurance.class4_lower_limit", AMOUNT, "Class 4 lower profits limit (annual)"],
    ["national_insurance.class4_upper_limit", AMOUNT, "Class 4 upper profits limit (annual)"],
    ["national_insurance.class2_weekly_rate", MONEY, "Class 2 National Insurance weekly rate, in pounds"],
    ["national_insurance.class2_small_profits_threshold", AMOUNT, "Class 2 small profits threshold (annual)"],
    ["capital_allowances.writing_down_allowance", RATE, "Writing down allowance rate on the main pool"],
    ["capital_allowances.writing_down_allowance_special", RATE, "Writing down allowance rate on the special rate pool"],
    ["capital_allowances.structures_and_buildings_allowance", RATE, "Structures and buildings allowance rate"],
    ...MILEAGE_FIELDS,
    ...VAT_FIELDS,
  ],
  ltd: [
    ["corporation_tax.main_rate", RATE, "Corporation Tax main rate"],
    ["corporation_tax.small_profits_rate", RATE, "Corporation Tax small profits rate"],
    ["corporation_tax.small_profits_limit", AMOUNT, "Small profits rate limit: profits up to this pay the small profits rate"],
    ["corporation_tax.main_rate_limit", AMOUNT, "Main rate limit: profits over this pay the main rate"],
    ["corporation_tax.marginal_relief_fraction", RATE, "Marginal relief standard fraction as a decimal (3/200 is 0.015)"],
    ["capital_allowances.writing_down_allowance_main", RATE, "Writing down allowance rate on the main pool"],
    ["capital_allowances.writing_down_allowance_special", RATE, "Writing down allowance rate on the special rate pool"],
    ["employer_ni.rate", RATE, "Employer (secondary) Class 1 National Insurance rate"],
    ["employer_ni.secondary_threshold", AMOUNT, "Class 1 secondary threshold, per year"],
    ["employer_ni.employment_allowance", AMOUNT, "Employment Allowance, per year"],
    ["dividend_tax.allowance", AMOUNT, "Dividend allowance"],
    ["dividend_tax.basic_rate", RATE, "Dividend ordinary rate (basic rate taxpayers)"],
    ["dividend_tax.higher_rate", RATE, "Dividend upper rate (higher rate taxpayers)"],
    ["dividend_tax.additional_rate", RATE, "Dividend additional rate (additional rate taxpayers)"],
    ...MILEAGE_FIELDS,
    ...VAT_FIELDS,
  ],
};

// ── Data files ──────────────────────────────────────────────────────────────

const SECTION_LINE = /^\s*\[([A-Za-z0-9_.]+)\]\s*(#.*)?$/;
const KEY_LINE = /^(\s*)([A-Za-z0-9_]+)(\s*=\s*)("[^"]*"|[^\s#]+)(.*)$/;

/** Every key of a data file as "section.key" mapped to its raw value token. */
export function readTokens(text) {
  const tokens = new Map();
  let section = "";
  for (const line of text.split("\n")) {
    const header = SECTION_LINE.exec(line);
    if (header) {
      section = header[1];
      continue;
    }
    const entry = KEY_LINE.exec(line);
    if (entry && !line.trimStart().startsWith("#")) tokens.set(`${section}.${entry[2]}`, entry[4]);
  }
  return tokens;
}

/** A data file's numeric values as "section.key" mapped to a number. */
export function readNumbers(text) {
  const numbers = new Map();
  for (const [field, token] of readTokens(text)) {
    if (/^-?\d+(\.\d+)?$/.test(token)) numbers.set(field, Number(token));
  }
  return numbers;
}

/** The fixed format of a value of each kind. */
export function formatValue(kind, value) {
  if (kind === "string") return `"${value}"`;
  if (kind === "date") return String(value);
  if (kind === AMOUNT) return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (kind === MONEY) return value.toFixed(2);
  if (kind === RATE) {
    const trimmed = value.toFixed(6).replace(/0+$/, "");
    const decimals = trimmed.split(".")[1] ?? "";
    return decimals.length >= 2 ? trimmed : value.toFixed(2);
  }
  throw new Error(`Unknown value kind: ${kind}`);
}

function sameValue(kind, token, value) {
  if (kind === "string" || kind === "date") return token === formatValue(kind, value);
  return /^-?\d+(\.\d+)?$/.test(token) && Math.abs(Number(token) - value) < 1e-9;
}

/**
 * Writes values into a data file. `values` maps "section.key" to { kind, value }.
 * A line changes only when its value differs; nothing else in the file moves.
 * A field the file does not carry is ignored.
 */
export function applyValues(text, values) {
  let section = "";
  return text
    .split("\n")
    .map((line) => {
      const header = SECTION_LINE.exec(line);
      if (header) {
        section = header[1];
        return line;
      }
      if (line.trimStart().startsWith("#")) return line;
      const entry = KEY_LINE.exec(line);
      if (!entry) return line;
      const wanted = values.get(`${section}.${entry[2]}`);
      if (!wanted || sameValue(wanted.kind, entry[4], wanted.value)) return line;
      return `${entry[1]}${entry[2]}${entry[3]}${formatValue(wanted.kind, wanted.value)}${entry[5]}`;
    })
    .join("\n");
}

/** Values one file takes from its own figures or from the year before. */
export function derivedValues(kind, numbers, previousNumbers) {
  const values = new Map();
  const set = (field, valueKind, value) => {
    if (numbers.has(field) && value !== undefined) values.set(field, { kind: valueKind, value });
  };
  set(
    "income_tax.higher_band_start",
    AMOUNT,
    numbers.has("income_tax.basic_band_end") ? numbers.get("income_tax.basic_band_end") + 1 : undefined,
  );
  set(
    "mileage.lower_rate_start",
    AMOUNT,
    numbers.has("mileage.higher_rate_limit") ? numbers.get("mileage.higher_rate_limit") + 1 : undefined,
  );
  set("national_insurance.class2_rate", MONEY, numbers.get("national_insurance.class2_weekly_rate"));
  if (kind === "ltd" && previousNumbers) {
    for (const [field, valueKind] of FIELDS.ltd.filter(([f]) => f.startsWith("corporation_tax."))) {
      const key = field.slice("corporation_tax.".length);
      set(`corporation_tax_previous_financial_year.${key}`, valueKind, previousNumbers.get(field));
    }
    set(
      "capital_allowances_previous_financial_year.writing_down_allowance_main",
      RATE,
      previousNumbers.get("capital_allowances.writing_down_allowance_main"),
    );
  }
  return values;
}

// ── Years ───────────────────────────────────────────────────────────────────

const FILE_NAME = /^(se)-(\d{4})-(\d{4})\.toml$|^(ltd)-(\d{4})\.toml$/;

/** { kind, year, name } for a data file name, or null. `year` is the year the period starts. */
export function parseFileName(name) {
  const match = FILE_NAME.exec(name);
  if (!match) return null;
  return match[1] ? { kind: "se", year: Number(match[2]), name } : { kind: "ltd", year: Number(match[5]), name };
}

export function fileNameFor(kind, year) {
  return kind === "se" ? `se-${year}-${year + 1}.toml` : `ltd-${year}.toml`;
}

/** The first and last day of a data file's period. */
export function periodOf(kind, year) {
  return kind === "se" ? { start: `${year}-04-06`, end: `${year + 1}-04-05` } : { start: `${year}-04-01`, end: `${year + 1}-03-31` };
}

function shortYear(year) {
  return String(year % 100).padStart(2, "0");
}

function periodDescription(kind, year) {
  const taxYear = `the tax year 6 April ${year} to 5 April ${year + 1}`;
  if (kind === "se") return `Tax year ${year}-${shortYear(year + 1)}: ${taxYear}.`;
  return `Financial year ${year}: 1 April ${year} to 31 March ${year + 1}. Income Tax, dividend, National Insurance, mileage and VAT figures are those of ${taxYear}.`;
}

/** The ways gov.uk names a year, for the evidence that its rates are published. */
export function yearLabels(kind, year) {
  const labels = [
    `${year} to ${year + 1}`,
    `${year}-${shortYear(year + 1)}`,
    `${year}/${shortYear(year + 1)}`,
    `${year}-${year + 1}`,
    `${year}/${year + 1}`,
  ];
  if (kind === "se") labels.push(`6 April ${year}`);
  else labels.push(`financial year ${year}`, `FY${year}`, `FY ${year}`, `1 April ${year}`);
  return labels;
}

/**
 * A new year's file from the year before: the metadata moves on a year, the
 * header says where the figures come from, and a comment that names a year is
 * dropped because it describes the year before.
 */
export function newYearText(kind, year, previousName, previousText) {
  const lines = previousText.split("\n");
  const firstSection = lines.findIndex((line) => SECTION_LINE.test(line));
  const licence = lines.slice(0, 2);
  const { start, end } = periodOf(kind, year);
  const [startDay, startMonth] = kind === "se" ? ["6 April", "5 April"] : ["1 April", "31 March"];
  const title =
    kind === "se"
      ? [
          `# UK self-employment tax rates and thresholds for the ${year}-${shortYear(year + 1)} tax year`,
          `# Period: ${startDay} ${year} – ${startMonth} ${year + 1}`,
        ]
      : [`# UK Limited Company tax rates and thresholds for Financial Year ${year}`, `# (${startDay} ${year} – ${startMonth} ${year + 1})`];
  const header = [
    ...licence,
    ...title,
    `# Source: gov.uk, read by update-tax-rates.yml. A figure gov.uk does not state for this year carries forward from ${previousName}.`,
    "",
  ];
  const body = [];
  let block = [];
  const flush = (keep) => {
    if (keep) body.push(...block);
    block = [];
  };
  for (const line of lines.slice(firstSection)) {
    if (line.trimStart().startsWith("#")) {
      block.push(line);
      continue;
    }
    flush(!block.some((comment) => /\b20\d\d\b/.test(comment)));
    const entry = KEY_LINE.exec(line);
    if (entry && /#.*\b20\d\d\b/.test(entry[5])) body.push(`${entry[1]}${entry[2]}${entry[3]}${entry[4]}`);
    else body.push(line);
  }
  flush(!block.some((comment) => /\b20\d\d\b/.test(comment)));
  const metadata =
    kind === "se"
      ? new Map([
          ["tax_year.label", { kind: "string", value: `${year}-${shortYear(year + 1)}` }],
          ["tax_year.next_label", { kind: "string", value: `${year + 1}-${shortYear(year + 2)}` }],
          ["tax_year.start", { kind: "date", value: start }],
          ["tax_year.end", { kind: "date", value: end }],
        ])
      : new Map([
          ["financial_year.label", { kind: "string", value: `FY${year}` }],
          ["financial_year.start", { kind: "date", value: start }],
          ["financial_year.end", { kind: "date", value: end }],
        ]);
  return applyValues([...header, ...body].join("\n"), metadata);
}

// ── Page text and the quote check ───────────────────────────────────────────

const NAMED_ENTITIES = {
  nbsp: " ",
  amp: "&",
  pound: "£",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  ndash: "-",
  mdash: "-",
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
  hellip: "...",
};

/** Page or quote text with tags, entities, typographic quotes and dashes, and spacing made plain. */
export function normaliseText(text) {
  return text
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (whole, name) => NAMED_ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+([.,;:%)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+/g, " ")
    .trim();
}

/** The readable text of a gov.uk page: its <main> element when it has one. */
export function pageText(html) {
  const main = /<main[\s\S]*?<\/main>/i.exec(html);
  return normaliseText(main ? main[0] : html).slice(0, PAGE_TEXT_LIMIT);
}

function trimNumber(value, places) {
  return String(Number(value.toFixed(places)));
}

function withThousands(value) {
  return value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

/** The ways a page can print a figure of a kind. */
export function figureForms(kind, value) {
  if (kind === RATE) {
    const percent = trimNumber(value * 100, 4);
    const forms = [`${percent}%`, `${percent} %`, `${percent} per cent`, `${percent} percent`];
    const tenThousandths = Math.round(value * 10000);
    if (Math.abs(value * 10000 - tenThousandths) < 1e-6 && tenThousandths > 0) {
      const divisor = gcd(tenThousandths, 10000);
      if (10000 / divisor >= 100 && 10000 / divisor <= 1000) forms.push(`${tenThousandths / divisor}/${10000 / divisor}`);
    }
    return forms;
  }
  if (kind === AMOUNT) {
    const forms = [withThousands(value), String(value)];
    if (value >= 1000000 && value % 1000000 === 0) forms.push(`${value / 1000000} million`, `${value / 1000000}m`);
    return [...new Set(forms)];
  }
  if (kind === MONEY) {
    const forms = [value.toFixed(2)];
    if (value < 1) {
      const pence = trimNumber(value * 100, 2);
      forms.push(`${pence}p`, `${pence} pence`, `${pence} p`);
    }
    return forms;
  }
  throw new Error(`Unknown value kind: ${kind}`);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/** True when the quote prints the figure, as a whole number and not part of a longer one. */
export function quoteStatesFigure(quote, kind, value) {
  const text = normaliseText(quote);
  return figureForms(kind, value).some((form) => new RegExp(`(?<![\\d.,])${escapeRegExp(form)}(?![\\d]|[.,]\\d)`, "i").test(text));
}

function plausible(kind, value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return false;
  if (kind === RATE) return value <= 1 && Math.abs(value * 1e6 - Math.round(value * 1e6)) < 1e-6;
  if (kind === AMOUNT) return Number.isInteger(value) && value <= 10000000;
  if (kind === MONEY) return value < 100 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
  return false;
}

// A table row quoted without the cells between its label and its value leaves
// gaps in the page's words. Every word of the quote must still appear on the
// page, in order, with at most this many page words in each gap and in all,
// and no figure outside brackets in a gap.
const QUOTE_GAP_WORDS = 8;
const QUOTE_EXTRA_WORDS = 12;

function words(text) {
  return normaliseText(text)
    .toLowerCase()
    .split(" ")
    .map((word) => word.replace(/[.,;:]+$/, ""))
    .filter(Boolean);
}

/** True when the quote's words are on the page in order, close together, or the quote is on it word for word. */
export function quoteOnPage(quote, pageText) {
  const wanted = words(quote);
  if (wanted.length === 0) return false;
  const have = words(pageText);
  for (let start = 0; start < have.length; start++) {
    if (have[start] !== wanted[0]) continue;
    let at = start;
    let extra = 0;
    let found = true;
    for (let w = 1; w < wanted.length && found; w++) {
      let next = at + 1;
      let depth = 0;
      while (next < have.length && next - at - 1 <= QUOTE_GAP_WORDS && have[next] !== wanted[w]) {
        // A figure in the gap would be another column's value, such as another year's, unless it is in brackets.
        depth += (have[next].match(/\(/g) ?? []).length - (have[next].match(/\)/g) ?? []).length;
        if (/\d/.test(have[next]) && depth <= 0 && !have[next].includes(")")) break;
        next++;
      }
      if (next >= have.length || next - at - 1 > QUOTE_GAP_WORDS || have[next] !== wanted[w]) found = false;
      else {
        extra += next - at - 1;
        at = next;
      }
    }
    if (found && extra <= QUOTE_EXTRA_WORDS) return true;
  }
  return false;
}

/** The page the quote is on: the page the figure names, else any other page the job read that holds it, else null. */
export function quotePage(figure, pages) {
  const named = pages.find((p) => p.url === figure.url);
  if (named && quoteOnPage(figure.quote, named.text)) return named;
  return pages.find((p) => p !== named && quoteOnPage(figure.quote, p.text)) ?? null;
}

/**
 * Why a figure cannot be used, or null when it can: the quote must be on a
 * page the job read, its words in order on that page, and it must state the
 * figure.
 */
export function figureProblem(figure, kind, pages) {
  if (!plausible(kind, figure.value)) return `the value ${JSON.stringify(figure.value)} is not a ${kind}`;
  if (typeof figure.quote !== "string" || normaliseText(figure.quote).length === 0) return "the quote is empty";
  if (!words(figure.quote).some((word) => /[a-z]{2}/.test(word))) return "the quote has no words besides figures";
  if (!quotePage(figure, pages)) return `the quote is not on ${figure.url}`;
  if (!quoteStatesFigure(figure.quote, kind, figure.value)) return `the quote does not state ${formatValue(kind, figure.value)}`;
  return null;
}

/** Why the evidence does not show gov.uk has published a year's rates, or null when it does. */
export function yearEvidenceProblem(evidence, kind, year, pages) {
  if (!evidence) return "the model gave no evidence that this year's rates are published";
  const page = pages.find((p) => p.url === evidence.url);
  if (!page) return `${evidence.url} is not a page the job read`;
  const quote = normaliseText(evidence.quote ?? "");
  if (quote.length === 0 || !page.text.includes(quote)) return `the year evidence quote is not on ${evidence.url}`;
  const lower = quote.toLowerCase();
  if (!yearLabels(kind, year).some((label) => lower.includes(label.toLowerCase()))) return `the year evidence quote does not name ${year}`;
  return null;
}

// ── The model call ──────────────────────────────────────────────────────────

export const INSTRUCTIONS = [
  "You read UK tax rates from GOV.UK pages for a spreadsheet's tax data file.",
  "The pages are given below, each after a line that starts with PAGE and its URL. Use no other knowledge.",
  "Answer with one call to the record_rates tool.",
  "Give a figure only when a page states it for the year the request names. A table often has one column per year: read the column for that year.",
  "Leave out a field the pages do not state for that year. Never carry a figure across from another year.",
  "For each figure, quote copies the page text word for word: the sentence or the table row that states the figure, as the page prints it, without the column headings. In a table row, start the quote at the row's label and keep the figure of every year column in the page's order.",
  "url is the URL of the page the quote is on.",
  "value is a number: a rate as a decimal fraction (25% is 0.25), an amount in whole pounds (£12,570 is 12570), money in pounds (£3.65 is 3.65, 55p is 0.55).",
].join("\n");

/** The text of the pages, as the system prompt carries them. */
export function pagesPrompt(pages) {
  return pages.map((page) => `PAGE ${page.url}\n${page.text}`).join("\n\n");
}

/** The fields of one file's call: every model field the file carries. */
export function fieldsFor(kind, numbers) {
  return FIELDS[kind]
    .filter(([field]) => numbers.has(field))
    .map(([field, valueKind, description]) => ({ field, kind: valueKind, description }));
}

export function ratesSchema(fields, askForYearEvidence) {
  const quoted = {
    type: "object",
    properties: { quote: { type: "string" }, url: { type: "string" } },
    required: ["quote", "url"],
    additionalProperties: false,
  };
  const schema = {
    type: "object",
    properties: {
      figures: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: { type: "string", enum: fields.map((f) => f.field) },
            value: { type: "number" },
            quote: { type: "string" },
            url: { type: "string" },
          },
          required: ["field", "value", "quote", "url"],
          additionalProperties: false,
        },
      },
    },
    required: ["figures"],
    additionalProperties: false,
  };
  if (askForYearEvidence) schema.properties.year_evidence = quoted;
  return schema;
}

export function userPrompt({ name, kind, year, fields, numbers, isNew }) {
  const lines = [`Data file: ${name}`, periodDescription(kind, year), "", "Fields:"];
  for (const { field, kind: valueKind, description } of fields) {
    lines.push(`- ${field} (${valueKind}): ${description}. The file now holds ${formatValue(valueKind, numbers.get(field))}.`);
  }
  if (isNew) {
    lines.push(
      "",
      "This year has no data file yet. If a page states rates for this year, set year_evidence to a quote, word for word, that names the year, and the URL of its page. Otherwise leave year_evidence out and give no figures.",
    );
  }
  return lines.join("\n");
}

export function ratesRequest({ pages, user, fields, askForYearEvidence, model = MODEL_ID }) {
  return {
    modelId: model,
    // The instructions and the pages are the same in every call of a run; the
    // cache point after them lets the later calls read that prefix from cache.
    system: [{ text: INSTRUCTIONS }, { text: pagesPrompt(pages) }, { cachePoint: { type: "default" } }],
    messages: [{ role: "user", content: [{ text: user }] }],
    inferenceConfig: { maxTokens: MAX_TOKENS, temperature: TEMPERATURE },
    toolConfig: {
      tools: [
        {
          toolSpec: {
            name: RATES_TOOL,
            description: "Record the figures the pages state for this data file's year, each with its quote and page.",
            inputSchema: { json: ratesSchema(fields, askForYearEvidence) },
          },
        },
      ],
      toolChoice: { tool: { name: RATES_TOOL } },
    },
    additionalModelRequestFields: MODEL_REQUEST_FIELDS,
  };
}

export function parseRates(response) {
  const content = response?.output?.message?.content ?? [];
  const block = content.find((item) => item.toolUse?.name === RATES_TOOL);
  if (!block) {
    const stop = response?.stopReason ? ` (stop reason ${response.stopReason})` : "";
    throw new Error(`Model response carried no ${RATES_TOOL} call${stop}`);
  }
  const input = block.toolUse.input ?? {};
  if (!Array.isArray(input.figures)) throw new Error("Model returned no figures list");
  return { figures: input.figures, yearEvidence: input.year_evidence ?? null };
}

/** One call, retried once for a dropped connection or a malformed tool call. */
export async function requestRates(client, request, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return parseRates(await client.send(new ConverseCommand(request)));
    } catch (error) {
      lastError = error;
      if (attempt < attempts) console.warn(`Rates call attempt ${attempt} failed, retrying: ${error.message}`);
    }
  }
  throw lastError;
}

// ── The run ─────────────────────────────────────────────────────────────────

/**
 * Reads the pages through the model and updates the data files in `dataDir`.
 * `today` is an ISO date: a file whose period ended before it is left alone.
 * Nothing is written until every call has answered.
 *
 * @returns {Promise<{ written: string[], created: string[], changes: object[], rejected: object[] }>}
 */
export async function updateTaxRates({ dataDir, pages, client, today, model = MODEL_ID, log = console.log }) {
  if (pages.length === 0) throw new Error("No gov.uk page could be read");
  const files = readdirSync(dataDir)
    .map(parseFileName)
    .filter(Boolean)
    .map((file) => ({ ...file, text: readFileSync(join(dataDir, file.name), "utf8") }));
  const byKey = (kind, year) => files.find((file) => file.kind === kind && file.year === year);

  const work = [];
  for (const kind of ["se", "ltd"]) {
    const ofKind = files.filter((file) => file.kind === kind).sort((a, b) => a.year - b.year);
    for (const file of ofKind) if (periodOf(kind, file.year).end >= today) work.push({ ...file, isNew: false, original: file.text });
    const latest = ofKind.at(-1);
    if (latest) {
      const year = latest.year + 1;
      const name = fileNameFor(kind, year);
      work.push({ kind, year, name, isNew: true, original: null, text: newYearText(kind, year, latest.name, latest.text) });
    }
  }

  const changes = [];
  const rejected = [];
  const created = [];
  const results = new Map();
  for (const item of work) {
    const numbers = readNumbers(item.text);
    const fields = fieldsFor(item.kind, numbers);
    const user = userPrompt({ ...item, fields, numbers });
    log(`Reading ${fields.length} figures for ${item.name}${item.isNew ? " (new year)" : ""}`);
    const answer = await requestRates(client, ratesRequest({ pages, user, fields, askForYearEvidence: item.isNew, model }));
    if (item.isNew) {
      const problem = yearEvidenceProblem(answer.yearEvidence, item.kind, item.year, pages);
      if (problem) {
        log(`${item.name}: not created, ${problem}`);
        continue;
      }
    }
    const accepted = new Map();
    const judge = (figures, askedFields) => {
      const refused = [];
      for (const figure of figures) {
        const spec = askedFields.find((f) => f.field === figure.field);
        if (!spec) {
          rejected.push({ file: item.name, field: String(figure.field), reason: "the file has no such field" });
          continue;
        }
        if (accepted.has(spec.field)) continue;
        const problem = figureProblem(figure, spec.kind, pages);
        if (problem) {
          const entry = { file: item.name, field: spec.field, value: figure.value, quote: figure.quote, url: figure.url, reason: problem };
          if (problem.startsWith("the quote is not on") || problem.startsWith("the quote has no words")) refused.push({ spec, entry });
          else rejected.push(entry);
          continue;
        }
        accepted.set(spec.field, { kind: spec.kind, value: figure.value });
        if (Math.abs(numbers.get(spec.field) - figure.value) > 1e-9) {
          changes.push({
            file: item.name,
            field: spec.field,
            from: formatValue(spec.kind, numbers.get(spec.field)),
            to: formatValue(spec.kind, figure.value),
            quote: figure.quote,
            url: quotePage(figure, pages).url,
          });
        }
      }
      return refused;
    };
    const refused = judge(answer.figures, fields);
    // One more call for the figures whose quote was not on any page: it names
    // each refused quote and asks for the page's own words, or no figure.
    if (refused.length > 0) {
      const retryFields = refused.map(({ spec }) => spec);
      const retryUser = [
        user,
        "",
        "These quotes are not accepted: a quote must be on a page above word for word and hold more than its figure. For each field, give a quote copied from the page text, or leave the field out. Start a table row's quote at its label and keep the figure of every year column in the page's order:",
        ...refused.map(({ spec, entry }) => `- ${spec.field}: ${JSON.stringify(entry.quote)}`),
      ].join("\n");
      const second = await requestRates(
        client,
        ratesRequest({ pages, user: retryUser, fields: retryFields, askForYearEvidence: false, model }),
      );
      const again = new Set(judge(second.figures, retryFields).map(({ spec }) => spec.field));
      for (const { spec, entry } of refused) {
        if (accepted.has(spec.field)) continue;
        if (again.has(spec.field) || !second.figures.some((f) => f.field === spec.field)) rejected.push(entry);
      }
    }
    if (item.isNew && accepted.size === 0) {
      log(`${item.name}: not created, no figure passed the quote check`);
      continue;
    }
    results.set(item.name, { ...item, text: applyValues(item.text, accepted) });
    if (item.isNew) created.push(item.name);
  }

  // Derived values follow the accepted figures, in year order so a financial
  // year's previous-year section reads the year before as updated.
  const ordered = [...results.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.year - b.year);
  for (const item of ordered) {
    const previous = results.get(fileNameFor(item.kind, item.year - 1)) ?? byKey(item.kind, item.year - 1);
    const previousNumbers = previous ? readNumbers(previous.text) : null;
    item.text = applyValues(item.text, derivedValues(item.kind, readNumbers(item.text), previousNumbers));
  }

  const written = [];
  for (const item of ordered) {
    if (item.text === item.original) continue;
    writeFileSync(join(dataDir, item.name), item.text);
    written.push(item.name);
  }
  return { written, created, changes, rejected };
}

/** The run as Markdown, for the job summary and the commit body. */
export function summaryMarkdown({ written, created, changes, rejected }) {
  const lines = [];
  if (written.length === 0) lines.push("No tax data file changed.");
  else lines.push(`Changed: ${written.join(", ")}.`);
  if (created.length > 0) lines.push(`New year files: ${created.join(", ")}.`);
  for (const change of changes)
    lines.push(`- ${change.file} ${change.field}: ${change.from} to ${change.to}. "${change.quote}" (${change.url})`);
  if (rejected.length > 0) {
    lines.push("", "Figures not used:");
    for (const item of rejected) {
      lines.push(`- ${item.file} ${item.field}: ${item.reason}`);
      if (item.quote) lines.push(`  quote: ${JSON.stringify(item.quote)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
