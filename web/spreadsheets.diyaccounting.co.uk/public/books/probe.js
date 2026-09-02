// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// probe.js — the bare harness behind probe.html.
//
// It runs one book through the bundled engine and puts what came out on the
// page and on window.__DIYA_PROBE__. No design, no interaction: the designed
// shell is bst.html, and W1 wires that to the same bundle.
//
// The steps below are the whole of what the page asks the engine to do, and
// the Node side of the bundle gate (web/browser-tests/books-bundle-gate.browser.test.js)
// runs the same calls in the same order against the unbundled modules.

import * as engine from "./engine/diya-gl-engine.js";
import { browserResourceLoader } from "./bundle-resources.js";

const FIXTURE = "examples/sp-sixty-driving/bst";

export async function runProbe(options = {}) {
  const resources = browserResourceLoader(options);

  await engine.loadSchemasFrom(resources);

  const bookToml = await resources.readText(`${FIXTURE}/book.toml`);
  const linesRaw = await resources.readText(`${FIXTURE}/lines.jsonl`);
  const { book, lines } = engine.parseDiyaGlData(bookToml, linesRaw);

  const bookValidation = engine.validateBook(book);
  const linesValidation = engine.validateLines(lines, book);

  const taxData = await engine.loadTaxDataForBook(book, { resources });
  const scenario = engine.diyaGlToScenario(book, lines, "bst");
  const expected = { ...scenario, ...scenario.expected };

  const results = engine.calculateFromDiyaGl(book, lines, "bst", taxData, expected);
  const sections = engine.reportSections(results);
  const checks = engine.checkCompliance({ ...results }, expected, taxData, engine.calculateExpectedTax);

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

function render(target, state) {
  target.textContent = JSON.stringify(state, null, 2);
}

async function main() {
  const output = document.getElementById("probe-output");
  const status = document.getElementById("probe-status");
  try {
    const payload = await runProbe();
    // Serialised here rather than handed over as live objects: a TOML date
    // knows how to write itself and a structured clone across the automation
    // boundary would lose that, turning a difference in serialisation into a
    // difference in figures.
    window.__DIYA_PROBE__ = { ok: true, payload, json: JSON.stringify(payload) };
    status.textContent = `loaded ${payload.book.lineCount} lines; ${payload.checks.length} checks, ${payload.checks.filter((c) => c.pass).length} passing`;
    render(output, payload);
    console.log("book", payload.book);
    console.log("profit and loss", payload.results["Profit & Loss Acc"]);
    console.log("checks", payload.checks);
  } catch (error) {
    window.__DIYA_PROBE__ = { ok: false, error: String(error && error.stack ? error.stack : error) };
    status.textContent = "failed";
    render(output, window.__DIYA_PROBE__);
    console.error(error);
  }
  document.body.dataset.probeState = window.__DIYA_PROBE__.ok ? "done" : "failed";
}

main();
