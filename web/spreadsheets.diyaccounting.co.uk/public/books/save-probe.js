// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// save-probe.js — the bare harness behind save-probe.html.
//
// Loads one book through the bundled engine, same as probe.js, then wires
// two real buttons to save.js -- the exact module shell.js's save controls
// call. Clicking either button runs the real save path: build the diya-gl
// zip or the JSON document, hand the browser a Blob to download. The
// report each carries is a placeholder ({}), since this probe proves the
// save mechanism, not the report's own fidelity -- that is books-formats
// browser test's job. The result also lands on window.__DIYA_SAVE_RESULT__
// so the browser test can read the bytes back without depending on how the
// browser's own download UI behaves.

import { parseDiyaGlData, loadSchemasFrom, loadCanonicalSchemasFrom } from "./engine/diya-gl-engine.js";
import { browserResourceLoader } from "./bundle-resources.js";
import { buildSaveArtifact, downloadArtifact } from "./save.js";

const FIXTURE = "examples/sp-sixty-driving/bst";

let currentBook = null;
let currentLines = null;

function toBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadFixture() {
  const status = document.getElementById("save-probe-status");
  const resources = browserResourceLoader();
  // The diya-gl zip and JSON writers read field order and typing off the
  // canonical schemas (diya-gl-canonical.js), which a browser build cannot
  // read off disk -- probe.js loads the same pair before it validates
  // anything, and shell.js's own data.js loads them once at first save.
  await Promise.all([loadSchemasFrom(resources), loadCanonicalSchemasFrom(resources)]);
  const bookToml = await resources.readText(`${FIXTURE}/book.toml`);
  const linesRaw = await resources.readText(`${FIXTURE}/lines.jsonl`);
  const { book, lines } = parseDiyaGlData(bookToml, linesRaw);
  currentBook = book;
  currentLines = lines;

  status.textContent = `loaded ${lines.length} lines`;
  document.getElementById("save-diya-gl-btn").disabled = false;
  document.getElementById("save-json-btn").disabled = false;
  document.body.dataset.saveState = "ready";
}

async function handleSaveClick(format) {
  const status = document.getElementById("save-probe-status");
  status.textContent = "saving…";
  document.body.dataset.saveState = "saving";
  try {
    const artifact = await buildSaveArtifact(currentBook, currentLines, format, { report: {} });
    downloadArtifact(artifact);
    window.__DIYA_SAVE_RESULT__ = {
      ok: true,
      format,
      filename: artifact.filename,
      mimeType: artifact.mimeType,
      base64: toBase64(artifact.bytes),
    };
    status.textContent = `saved ${artifact.filename}`;
    document.body.dataset.saveState = "done";
  } catch (error) {
    window.__DIYA_SAVE_RESULT__ = { ok: false, format, error: String(error && error.stack ? error.stack : error) };
    status.textContent = "failed";
    document.body.dataset.saveState = "failed";
  }
}

document.getElementById("save-diya-gl-btn").addEventListener("click", () => handleSaveClick("diya-gl-zip"));
document.getElementById("save-json-btn").addEventListener("click", () => handleSaveClick("json"));

loadFixture().catch((error) => {
  document.getElementById("save-probe-status").textContent = "load failed";
  document.body.dataset.saveState = "failed";
  window.__DIYA_SAVE_RESULT__ = { ok: false, error: String(error && error.stack ? error.stack : error) };
});
