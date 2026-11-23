// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// tax-rate-update.test.js — the monthly tax-rate update: the line writer keeps
// every current data file byte for byte, a run with no gov.uk change writes
// nothing, a changed rate changes exactly its own line, and a figure whose
// quote is not on the page or does not state it is never used. The Bedrock
// call is a stub.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIELDS,
  MODEL_ID,
  RATES_TOOL,
  applyValues,
  derivedValues,
  formatValue,
  parseFileName,
  quoteOnPage,
  quoteStatesFigure,
  readNumbers,
  pageText,
  updateTaxRates,
} from "../lib/tax-rate-update.js";

const DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));
const DATA_FILES = readdirSync(DATA_DIR).filter((name) => parseFileName(name));
const TODAY = "2026-11-19";
const PAGE_URL = "https://www.gov.uk/government/publications/rates-and-allowances";

function page(...paragraphs) {
  const html = `<html><head><title>Rates - GOV.UK</title></head><body><nav>Menu</nav><main id="content">${paragraphs
    .map((p) => `<p>${p}</p>`)
    .join("\n")}</main></body></html>`;
  return [{ url: PAGE_URL, text: pageText(html) }];
}

function figure(field, value, quote, url = PAGE_URL) {
  return { field, value, quote, url };
}

function converseReply(input) {
  return {
    stopReason: "tool_use",
    output: { message: { role: "assistant", content: [{ toolUse: { toolUseId: "t1", name: RATES_TOOL, input } }] } },
  };
}

// A client whose answer for each data file comes from `answers`, keyed by the file name.
function stubClient(answers) {
  return {
    send: vi.fn(async (command) => {
      const name = /^Data file: (\S+)/.exec(command.input.messages[0].content[0].text)[1];
      return converseReply(answers[name] ?? { figures: [] });
    }),
  };
}

function changedLines(before, after) {
  const a = before.split("\n");
  const b = after.split("\n");
  expect(b.length).toBe(a.length);
  return a.map((line, i) => [line, b[i]]).filter(([x, y]) => x !== y);
}

let dir;
let originals;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tax-rates-"));
  originals = {};
  for (const name of DATA_FILES) {
    copyFileSync(join(DATA_DIR, name), join(dir, name));
    originals[name] = readFileSync(join(DATA_DIR, name), "utf8");
  }
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function run(answers, pages, today = TODAY) {
  const client = stubClient(answers);
  return updateTaxRates({ dataDir: dir, pages, client, today, log: () => {} }).then((result) => ({ ...result, client }));
}

function unchangedExcept(names) {
  for (const name of DATA_FILES.filter((n) => !names.includes(n))) {
    expect(readFileSync(join(dir, name), "utf8"), name).toBe(originals[name]);
  }
  expect(readdirSync(dir).sort()).toEqual([...DATA_FILES].sort());
}

describe("the line writer", () => {
  it.each(DATA_FILES)("writes %s back byte for byte from its own values", (name) => {
    const text = originals[name];
    const { kind, year } = parseFileName(name);
    const numbers = readNumbers(text);
    const values = new Map(
      FIELDS[kind]
        .filter(([field]) => numbers.has(field))
        .map(([field, valueKind]) => [field, { kind: valueKind, value: numbers.get(field) }]),
    );
    const previousName = DATA_FILES.find((n) => parseFileName(n).kind === kind && parseFileName(n).year === year - 1);
    for (const [field, value] of derivedValues(kind, numbers, previousName ? readNumbers(originals[previousName]) : null))
      values.set(field, value);
    expect(values.size).toBeGreaterThan(10);
    expect(applyValues(text, values)).toBe(text);
  });

  it("formats each kind one way", () => {
    expect(formatValue("rate", 0.2)).toBe("0.20");
    expect(formatValue("rate", 1)).toBe("1.00");
    expect(formatValue("rate", 0.015)).toBe("0.015");
    expect(formatValue("rate", 0.1175)).toBe("0.1175");
    expect(formatValue("amount", 12570)).toBe("12570");
    expect(formatValue("money", 3.5)).toBe("3.50");
    expect(formatValue("money", 0.55)).toBe("0.55");
  });

  it("keeps the inline comment when it changes a value", () => {
    const text = "[corporation_tax]\nmarginal_relief_fraction = 0.015   # 3/200\n";
    expect(applyValues(text, new Map([["corporation_tax.marginal_relief_fraction", { kind: "rate", value: 0.02 }]]))).toBe(
      "[corporation_tax]\nmarginal_relief_fraction = 0.02   # 3/200\n",
    );
  });
});

describe("the quote check", () => {
  it("finds a figure only as a whole number", () => {
    expect(quoteStatesFigure("Main rate 25%", "rate", 0.25)).toBe(true);
    expect(quoteStatesFigure("Main rate 125%", "rate", 0.25)).toBe(false);
    expect(quoteStatesFigure("Main rate 25.5%", "rate", 0.25)).toBe(false);
    expect(quoteStatesFigure("Personal Allowance £12,570", "amount", 12570)).toBe(true);
    expect(quoteStatesFigure("Personal Allowance £112,570", "amount", 12570)).toBe(false);
    expect(quoteStatesFigure("The standard fraction is 3/200.", "rate", 0.015)).toBe(true);
    expect(quoteStatesFigure("Cars and vans: 55p for the first 10,000 miles", "money", 0.55)).toBe(true);
    expect(quoteStatesFigure("The AIA amount is £1 million.", "amount", 1000000)).toBe(true);
  });
});

describe("a run", () => {
  const steadyPage = () => page("Corporation Tax main rate 25%", "Dividend ordinary rate 10.75%", "Personal Allowance £12,570");
  const steadyAnswers = {
    "ltd-2026.toml": {
      figures: [
        figure("corporation_tax.main_rate", 0.25, "Corporation Tax main rate 25%"),
        figure("dividend_tax.basic_rate", 0.1075, "Dividend ordinary rate 10.75%"),
      ],
    },
    "ltd-2027.toml": {
      figures: [
        figure("corporation_tax.main_rate", 0.25, "Corporation Tax main rate 25%"),
        figure("dividend_tax.basic_rate", 0.1075, "Dividend ordinary rate 10.75%"),
      ],
    },
    "se-2026-2027.toml": { figures: [figure("income_tax.personal_allowance", 12570, "Personal Allowance £12,570")] },
    "se-2027-2028.toml": { figures: [figure("income_tax.personal_allowance", 12570, "Personal Allowance £12,570")] },
  };

  it("writes nothing on two runs with no gov.uk change", async () => {
    for (let pass = 1; pass <= 2; pass++) {
      const result = await run(steadyAnswers, steadyPage());
      expect(result.written).toEqual([]);
      expect(result.changes).toEqual([]);
      expect(result.rejected).toEqual([]);
      unchangedExcept([]);
    }
  });

  it("asks once per file whose period has not ended, and once per next year, at temperature 0", async () => {
    const { client } = await run({}, steadyPage());
    const asked = client.send.mock.calls.map(([command]) => /^Data file: (\S+)/.exec(command.input.messages[0].content[0].text)[1]);
    expect(asked).toEqual([
      "se-2026-2027.toml",
      "se-2027-2028.toml",
      "se-2028-2029.toml",
      "ltd-2026.toml",
      "ltd-2027.toml",
      "ltd-2028.toml",
    ]);
    const request = client.send.mock.calls[3][0].input;
    expect(request.modelId).toBe(MODEL_ID);
    expect(request.inferenceConfig.temperature).toBe(0);
    expect(request.toolConfig.toolChoice).toEqual({ tool: { name: RATES_TOOL } });
    const fields = request.toolConfig.tools[0].toolSpec.inputSchema.json.properties.figures.items.properties.field.enum;
    expect(fields).toContain("corporation_tax.main_rate");
    expect(fields).not.toContain("corporation_tax_previous_financial_year.main_rate");
    expect(fields).not.toContain("mileage.lower_rate_start");
  });

  it("changes exactly the one line of a changed rate", async () => {
    const quote = "The dividend ordinary rate for 2027 to 2028 is 11.75%.";
    const result = await run({ "ltd-2027.toml": { figures: [figure("dividend_tax.basic_rate", 0.1175, quote)] } }, page(quote));
    expect(result.written).toEqual(["ltd-2027.toml"]);
    const after = readFileSync(join(dir, "ltd-2027.toml"), "utf8");
    expect(changedLines(originals["ltd-2027.toml"], after)).toEqual([["basic_rate = 0.1075", "basic_rate = 0.1175"]]);
    expect(result.changes).toEqual([
      { file: "ltd-2027.toml", field: "dividend_tax.basic_rate", from: "0.1075", to: "0.1175", quote, url: PAGE_URL },
    ]);
    unchangedExcept(["ltd-2027.toml"]);
  });

  it("asks for the reduced rate of VAT where the file carries it, and changes only its line", async () => {
    const { client } = await run({}, steadyPage());
    const fieldsFor = (name) => {
      const call = client.send.mock.calls.find(([command]) => command.input.messages[0].content[0].text.startsWith(`Data file: ${name}`));
      return call[0].input.toolConfig.tools[0].toolSpec.inputSchema.json.properties.figures.items.properties.field.enum;
    };
    expect(fieldsFor("ltd-2027.toml")).toContain("vat.reduced_rate");
    expect(fieldsFor("se-2027-2028.toml")).not.toContain("vat.reduced_rate");

    const quote = "Reduced rate 6% Some goods and services, for example children's car seats and home energy";
    const result = await run({ "ltd-2027.toml": { figures: [figure("vat.reduced_rate", 0.06, quote)] } }, page(quote));
    expect(result.written).toEqual(["ltd-2027.toml"]);
    expect(changedLines(originals["ltd-2027.toml"], readFileSync(join(dir, "ltd-2027.toml"), "utf8"))).toEqual([
      ["reduced_rate = 0.05", "reduced_rate = 0.06"],
    ]);
    unchangedExcept(["ltd-2027.toml"]);
  });

  it("carries a financial year's corporation tax into the next year's previous-year section", async () => {
    const quote = "Main rate for financial year 2026: 26%";
    const result = await run({ "ltd-2026.toml": { figures: [figure("corporation_tax.main_rate", 0.26, quote)] } }, page(quote));
    expect(result.written).toEqual(["ltd-2026.toml", "ltd-2027.toml"]);
    expect(changedLines(originals["ltd-2026.toml"], readFileSync(join(dir, "ltd-2026.toml"), "utf8"))).toEqual([
      ["main_rate = 0.25", "main_rate = 0.26"],
    ]);
    const nextYear = changedLines(originals["ltd-2027.toml"], readFileSync(join(dir, "ltd-2027.toml"), "utf8"));
    expect(nextYear).toEqual([["main_rate = 0.25", "main_rate = 0.26"]]);
    expect(readNumbers(readFileSync(join(dir, "ltd-2027.toml"), "utf8")).get("corporation_tax_previous_financial_year.main_rate")).toBe(
      0.26,
    );
    unchangedExcept(["ltd-2026.toml", "ltd-2027.toml"]);
  });

  it.each([
    [
      "a quote the page does not hold",
      figure("dividend_tax.basic_rate", 0.1175, "The dividend ordinary rate is 11.75%."),
      "the quote is not on",
    ],
    ["a quote that is only the figure", figure("dividend_tax.basic_rate", 0.1075, "10.75%"), "the quote has no words besides figures"],
    [
      "a quote that does not state the figure",
      figure("dividend_tax.basic_rate", 0.1175, "The dividend ordinary rate is 10.75%."),
      "the quote does not state 0.1175",
    ],
    [
      "a page the job did not read",
      figure("dividend_tax.basic_rate", 0.1175, "The dividend ordinary rate is 11.75%.", "https://example.com/"),
      "the quote is not on https://example.com/",
    ],
    ["a rate given as a percentage", figure("dividend_tax.basic_rate", 10.75, "The dividend ordinary rate is 10.75%."), "is not a rate"],
  ])("never uses %s", async (_, answer, reason) => {
    const result = await run({ "ltd-2027.toml": { figures: [answer] } }, page("The dividend ordinary rate is 10.75%."));
    expect(result.written).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain(reason);
    unchangedExcept([]);
  });

  it("leaves a file whose period has ended alone", async () => {
    const quote = "Main rate 30%";
    const { client, written } = await run({ "ltd-2025.toml": { figures: [figure("corporation_tax.main_rate", 0.3, quote)] } }, page(quote));
    expect(written).toEqual([]);
    expect(
      client.send.mock.calls.some(([command]) => command.input.messages[0].content[0].text.startsWith("Data file: ltd-2025.toml")),
    ).toBe(false);
  });
});

describe("a new year", () => {
  const evidence = "Income Tax rates and allowances for 2028 to 2029.";
  const allowance = "The Personal Allowance for 2028 to 2029 is £13,000.";

  it("is written once a page names the year and a figure passes the check", async () => {
    const result = await run(
      {
        "se-2028-2029.toml": {
          year_evidence: { quote: evidence, url: PAGE_URL },
          figures: [figure("income_tax.personal_allowance", 13000, allowance)],
        },
      },
      page(evidence, allowance),
    );
    expect(result.created).toEqual(["se-2028-2029.toml"]);
    expect(result.written).toEqual(["se-2028-2029.toml"]);
    const text = readFileSync(join(dir, "se-2028-2029.toml"), "utf8");
    expect(text).toContain('label = "2028-29"\nnext_label = "2029-30"\nstart = 2028-04-06\nend = 2029-04-05\n');
    expect(text).toContain("personal_allowance = 13000\n");
    expect(text).toContain("carries forward from se-2027-2028.toml");
    expect(text).not.toContain("Approved mileage rates");
    const numbers = readNumbers(text);
    expect(numbers.get("income_tax.basic_band_end")).toBe(37700);
    expect(numbers.get("income_tax.higher_band_start")).toBe(37701);
    expect(existsSync(join(dir, "ltd-2028.toml"))).toBe(false);
  });

  it.each([
    ["no evidence", { figures: [figure("income_tax.personal_allowance", 13000, allowance)] }],
    [
      "evidence that names another year",
      {
        year_evidence: { quote: "Rates for 2027 to 2028.", url: PAGE_URL },
        figures: [figure("income_tax.personal_allowance", 13000, allowance)],
      },
    ],
    [
      "evidence but no figure that passes",
      { year_evidence: { quote: evidence, url: PAGE_URL }, figures: [figure("income_tax.personal_allowance", 14000, allowance)] },
    ],
  ])("is not written with %s", async (_, answer) => {
    const result = await run({ "se-2028-2029.toml": answer }, page(evidence, allowance, "Rates for 2027 to 2028."));
    expect(result.created).toEqual([]);
    expect(result.written).toEqual([]);
    unchangedExcept([]);
  });
});

describe("the quote check on table pages", () => {
  const table = pageText(
    "<main><table><tr><td>Main rate</td><td>(companies with profits over &pound;250,000)</td><td>25&nbsp;%</td><td>25%</td></tr>" +
      "<tr><td>Dividend allowance</td><td>of</td><td>&pound;500</td></tr></main>",
  );

  it("accepts a table row quoted without the cells between its label and its value", () => {
    expect(quoteOnPage("Main rate 25%", table)).toBe(true);
    expect(quoteOnPage("dividend allowance \u00a3500", table)).toBe(true);
  });

  it("uses a figure whose quote is on another page the job read", async () => {
    const other = { url: "https://www.gov.uk/other", text: "The dividend ordinary rate is 11.75%." };
    const result = await run(
      { "ltd-2027.toml": { figures: [figure("dividend_tax.basic_rate", 0.1175, "The dividend ordinary rate is 11.75%.")] } },
      [...page("Nothing here."), other],
    );
    expect(result.rejected).toEqual([]);
    expect(result.changes[0].url).toBe(other.url);
  });

  it("refuses a quote that skips another column's figure", () => {
    const years = pageText("<main><p>Main rate expenditure 14% 12%</p></main>");
    expect(quoteOnPage("Main rate expenditure 12%", years)).toBe(false);
    expect(quoteOnPage("Main rate expenditure 14% 12%", years)).toBe(true);
  });

  it("refuses a paraphrase and a quote whose words are far apart", () => {
    expect(quoteOnPage("The main rate of corporation tax is 25%", table)).toBe(false);
    const far = pageText(`<main><p>Main rate ${"filler ".repeat(30)} 25%</p></main>`);
    expect(quoteOnPage("Main rate 25%", far)).toBe(false);
  });

  it("asks once more for a refused quote and uses the corrected one", async () => {
    const client = {
      send: vi.fn(async (command) => {
        const text = command.input.messages[0].content[0].text;
        if (!text.startsWith("Data file: ltd-2027.toml")) return converseReply({ figures: [] });
        const quote = text.includes("not accepted") ? "The dividend ordinary rate is 11.75%." : "The dividend ordinary rate was 11.75%.";
        return converseReply({ figures: [figure("dividend_tax.basic_rate", 0.1175, quote)] });
      }),
    };
    const result = await updateTaxRates({
      dataDir: dir,
      pages: page("The dividend ordinary rate is 11.75%."),
      client,
      today: TODAY,
      log: () => {},
    });
    expect(result.rejected).toEqual([]);
    expect(result.changes.map((c) => c.field)).toContain("dividend_tax.basic_rate");
    expect(client.send.mock.calls.some(([c]) => c.input.messages[0].content[0].text.includes("not accepted"))).toBe(true);
  });
});
