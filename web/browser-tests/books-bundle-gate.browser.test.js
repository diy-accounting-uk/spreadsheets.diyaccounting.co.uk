// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// books-bundle-gate.browser.test.js — the bundle gate.
//
// The engine the books page runs in a browser has to be the engine the
// pipeline runs in Node, not a copy of it that drifted. This loads the
// SP Sixty Driving BST book twice — once through the unbundled modules under
// Node, once through the esbuild bundle in Chromium — and requires the two to
// agree cell for cell and verdict for verdict.
//
// The Node side calls the same functions in the same order as
// web/spreadsheets.diyaccounting.co.uk/public/books/probe.js. Keep them in step.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { startStaticServer } from "./serve.js";

import {
  parseDiyaGlData,
  validateBook,
  validateLines,
  loadTaxDataForBook,
  diyaGlToScenario,
  calculateFromDiyaGl,
  reportSections,
  checkCompliance,
  calculateExpectedTax,
} from "../../app/lib/books-engine.js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "web/spreadsheets.diyaccounting.co.uk/public");
const BUNDLE = path.join(PUBLIC_DIR, "books/engine/diya-gl-engine.js");
const FIXTURE = path.join(ROOT, "examples/sp-sixty-driving/bst");

// The Node run: the same steps probe.js takes, against the modules themselves.
async function nodeRun() {
  const bookToml = fs.readFileSync(path.join(FIXTURE, "book.toml"), "utf8");
  const linesRaw = fs.readFileSync(path.join(FIXTURE, "lines.jsonl"), "utf8");
  const { book, lines } = parseDiyaGlData(bookToml, linesRaw);

  const bookValidation = validateBook(book);
  const linesValidation = validateLines(lines, book);

  const taxData = await loadTaxDataForBook(book);
  const scenario = diyaGlToScenario(book, lines, "bst");
  const expected = { ...scenario, ...scenario.expected };

  const results = calculateFromDiyaGl(book, lines, "bst", taxData, expected);
  const sections = reportSections(results);
  const checks = checkCompliance({ ...results }, expected, taxData, calculateExpectedTax);

  return {
    book: {
      entity: book.entityInformation,
      period: book.documentInfo,
      accountSections: Object.keys(book.accounts || {}).sort(),
      lineCount: lines.length,
    },
    bookValidation,
    linesValidation,
    results,
    sections,
    checks,
  };
}

// Each side serialises its own result with its own JSON.stringify, so a value
// that knows how to write itself — a TOML date — writes itself the same way in
// both. What is left to normalise is key order and the last bits of floating
// point. Six decimal places is far finer than any figure the checks compare to
// and far coarser than a rounding difference between two runs of the same
// arithmetic — there should be none.
function canonical(value) {
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toFixed(6)) : String(value);
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
}

const asJson = (value) => canonical(JSON.parse(JSON.stringify(value)));

test.describe("books bundle gate — the browser engine is the Node engine", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(BUNDLE)) {
      throw new Error(`No bundle at ${BUNDLE}. Run: npm run build:books-bundle`);
    }
  });

  test("the bundled engine and the pipeline modules agree on the sp-sixty BST book", async ({ page }) => {
    const { baseUrl, close } = await startStaticServer(PUBLIC_DIR);
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    try {
      await page.goto(`${baseUrl}/books/probe.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.body.dataset.probeState !== "running", null, { timeout: 60_000 });

      const probe = await page.evaluate(() => ({
        ok: window.__DIYA_PROBE__.ok,
        error: window.__DIYA_PROBE__.error,
        json: window.__DIYA_PROBE__.json,
      }));
      expect(consoleErrors, "the probe page raised no uncaught error").toEqual([]);
      expect(probe.error ?? null, "the probe ran to completion").toBeNull();
      expect(probe.ok).toBe(true);

      const browser = canonical(JSON.parse(probe.json));
      const node = asJson(await nodeRun());

      // The book itself, before anything is computed from it.
      expect(browser.book).toEqual(node.book);
      expect(browser.bookValidation).toEqual(node.bookValidation);
      expect(browser.linesValidation).toEqual(node.linesValidation);
      expect(browser.bookValidation.valid, "the fixture book validates").toBe(true);
      expect(browser.linesValidation.valid, "the fixture lines validate").toBe(true);

      // Every figure the calculator produced, sheet by sheet, so a mismatch
      // names the sheet rather than dumping the whole book.
      expect(Object.keys(browser.results).sort()).toEqual(Object.keys(node.results).sort());
      for (const sheet of Object.keys(node.results)) {
        expect(browser.results[sheet], `figures on ${sheet}`).toEqual(node.results[sheet]);
      }

      // Every check verdict.
      expect(browser.checks.length, "the same checks ran").toBe(node.checks.length);
      expect(browser.checks.map((c) => `${c.name}=${c.pass}`)).toEqual(node.checks.map((c) => `${c.name}=${c.pass}`));
      expect(browser.checks).toEqual(node.checks);

      // And the rendered report sections the page draws from.
      expect(browser.sections).toEqual(node.sections);

      // A gate that compared two empty objects would pass for the wrong
      // reason, so the run has to have produced something to compare.
      expect(node.checks.length, "the book produced checks to compare").toBeGreaterThan(0);
      expect(node.results["Profit & Loss Acc"].C4, "the book produced a turnover to compare").toBeGreaterThan(0);
    } finally {
      await close();
    }
  });

  test("a Node-only path fails loudly in the browser rather than returning nothing", async ({ page }) => {
    const { baseUrl, close } = await startStaticServer(PUBLIC_DIR);
    try {
      await page.goto(`${baseUrl}/books/probe.html`, { waitUntil: "domcontentloaded" });
      const outcome = await page.evaluate(async () => {
        const engine = await import("./engine/diya-gl-engine.js");
        try {
          engine.nodeResourceLoader();
          await engine.nodeResourceLoader().readText("data/se-2025-2026.toml");
          return { threw: false };
        } catch (error) {
          return { threw: true, message: String(error.message) };
        }
      });
      expect(outcome.threw, "reading a file through the Node loader throws in a browser").toBe(true);
      expect(outcome.message).toContain("not available in the books bundle");
    } finally {
      await close();
    }
  });

  test("validating before the schemas are supplied says so, rather than validating nothing", async ({ page }) => {
    const { baseUrl, close } = await startStaticServer(PUBLIC_DIR);
    try {
      // A fresh page, so the probe's own loadSchemasFrom() has not run yet.
      await page.goto(`${baseUrl}/books/probe.html`, { waitUntil: "commit" });
      const outcome = await page.evaluate(async () => {
        const engine = await import("/books/engine/diya-gl-engine.js");
        try {
          engine.validateBook({});
          return { threw: false };
        } catch (error) {
          return { threw: true, message: String(error.message) };
        }
      });
      expect(outcome.threw, "an unseeded validate throws").toBe(true);
      expect(outcome.message).toContain("useSchemas");
    } finally {
      await close();
    }
  });

  // Every other resource the engine reads is text. The BST template is bytes,
  // and nothing on the load path fetches it, so the asset layout's one binary
  // claim would otherwise go untested until W4 arrives.
  test("the BST template is where the asset layout says, and opens in the browser", async ({ page }) => {
    const { baseUrl, close } = await startStaticServer(PUBLIC_DIR);
    try {
      await page.goto(`${baseUrl}/books/probe.html`, { waitUntil: "domcontentloaded" });
      const fetched = await page.evaluate(async () => {
        const probe = await import("./probe.js");
        return probe.readTemplate();
      });

      const templatePath = path.join(ROOT, "app/templates/bst", fetched.name);
      expect(fetched.byteLength, "the copied template is the one in app/templates/bst").toBe(fs.statSync(templatePath).size);
      expect(fetched.metadata, "the browser read the workbook, not just its bytes").toBeTruthy();
    } finally {
      await close();
    }
  });
});
