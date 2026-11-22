// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// web/unit-tests/company-register.test.js
//
// The code the download page and the DIYA-GL books page share for a company: the links between
// the two sites and the step from a register answer to the book builder.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";

const context = createContext({ URLSearchParams });
runInContext(readFileSync(resolve(process.cwd(), "web/spreadsheets.diyaccounting.co.uk/public/lib/company-register.js"), "utf8"), context);
const run = (expression) => JSON.parse(runInContext(`JSON.stringify(${expression})`, context));

describe("diyaGlBaseUrlFor", () => {
  it("names the ci DIYA-GL site from the ci spreadsheets site and the production site from every other host", () => {
    expect(run('diyaGlBaseUrlFor("ci-spreadsheets.diyaccounting.co.uk")')).toBe("https://ci.diya-gl.co.uk");
    expect(run('diyaGlBaseUrlFor("spreadsheets.diyaccounting.co.uk")')).toBe("https://diya-gl.co.uk");
    expect(run('diyaGlBaseUrlFor("localhost")')).toBe("https://diya-gl.co.uk");
  });
});

describe("newBookFromCompanyLink", () => {
  it("carries the company and, when given, the year end", () => {
    expect(run('newBookFromCompanyLink("spreadsheets.diyaccounting.co.uk", "06846849", "2026-03-31")')).toBe(
      "https://diya-gl.co.uk/ltd.html?company=06846849&yearEnd=2026-03-31",
    );
    expect(run('newBookFromCompanyLink("ci-spreadsheets.diyaccounting.co.uk", "SC123456")')).toBe(
      "https://ci.diya-gl.co.uk/ltd.html?company=SC123456",
    );
  });
});

describe("companyFromLinkParams", () => {
  const from = (query) => run(`companyFromLinkParams(new URLSearchParams(${JSON.stringify(query)}))`);

  it("reads a company number and a year end", () => {
    expect(from("company=06846849&yearEnd=2026-03-31")).toEqual({ companyNumber: "06846849", yearEnd: "2026-03-31" });
    expect(from("company=sc123456")).toEqual({ companyNumber: "SC123456", yearEnd: null });
  });

  it("ignores a year end that is not a date", () => {
    expect(from("company=06846849&yearEnd=soon")).toEqual({ companyNumber: "06846849", yearEnd: null });
  });

  it("names no company when the number is missing or malformed", () => {
    expect(from("")).toBeNull();
    expect(from("company=1234")).toBeNull();
    expect(from("company=%3Cscript%3E")).toBeNull();
  });
});

describe("buildBookFromRegisterAnswer", () => {
  class IxbrlError extends Error {}
  const answer = {
    profile: {
      companyNumber: "06846849",
      companyName: "EXAMPLE LIMITED",
      dateOfCreation: "2009-03-13",
      accountsNextPeriodEnd: "2026-03-31",
      accountsLastPeriodEnd: "2025-03-31",
      accountsLastPeriodStart: "2024-04-01",
      dateOfBirth: "1970-01-01",
    },
    officers: [{ name: "A, B", officerRole: "director", appointedOn: "2009-03-13", nationality: "British" }],
    filedAccounts: { status: "ixbrl", ixbrl: "<html/>" },
  };

  function engineWith(mapper) {
    const received = {};
    return {
      received,
      IxbrlError,
      mapIxbrlAccounts: mapper,
      buildBookFromRegister: async (input) => {
        received.input = input;
        return { book: {}, lines: [], differences: [] };
      },
    };
  }

  function build(engine, filedAccounts = answer.filedAccounts) {
    context.engine = engine;
    context.answer = { ...answer, filedAccounts };
    return runInContext('buildBookFromRegisterAnswer(engine, answer, "2026-03-31", "resources")', context);
  }

  it("hands the builder the mapped accounts, the copied profile and the copied officers", async () => {
    const engine = engineWith(() => ({ period: { end: "2025-03-31" } }));
    const built = await build(engine);
    expect(built.lastAccounts).toEqual({ period: { end: "2025-03-31" } });
    expect(engine.received.input.periodEnd).toBe("2026-03-31");
    expect(JSON.stringify(engine.received.input)).not.toContain("1970");
    expect(JSON.stringify(engine.received.input)).not.toContain("British");
  });

  it("names a set that cannot be read and builds without figures", async () => {
    const engine = engineWith(() => {
      throw new IxbrlError("no balance sheet");
    });
    const built = await build(engine);
    expect(built.unreadable).toBe("no balance sheet");
    expect(engine.received.input.lastAccounts).toBeUndefined();
  });

  it("passes an unexpected error on", async () => {
    const engine = engineWith(() => {
      throw new TypeError("broken");
    });
    await expect(build(engine)).rejects.toThrow("broken");
  });

  it("builds without figures for a PDF set and for none", async () => {
    const engine = engineWith(() => {
      throw new Error("must not map");
    });
    await build(engine, { status: "pdf" });
    expect(engine.received.input.lastAccounts).toBeUndefined();
    await build(engine, null);
    expect(engine.received.input.lastAccounts).toBeUndefined();
  });
});
