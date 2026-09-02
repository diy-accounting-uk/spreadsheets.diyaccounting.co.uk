// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// save-probe.js — the bare harness behind save-probe.html.
//
// Loads one book through the bundled engine, same as probe.js, then wires
// two real buttons to save.js -- the exact module bst.js's save controls
// call. Clicking either button runs the real save path: fetch the template
// through the resource loader, write the book into it, hand the browser a
// Blob to download. The result also lands on window.__DIYA_SAVE_RESULT__ so
// the browser test can read the bytes back without depending on how the
// browser's own download UI behaves.

import { parseDiyaGlData } from "./engine/diya-gl-engine.js";
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
  const bookToml = await resources.readText(`${FIXTURE}/book.toml`);
  const linesRaw = await resources.readText(`${FIXTURE}/lines.jsonl`);
  const { book, lines } = parseDiyaGlData(bookToml, linesRaw);
  currentBook = book;
  currentLines = lines;

  status.textContent = `loaded ${lines.length} lines`;
  document.getElementById("save-xlsx-btn").disabled = false;
  document.getElementById("save-zip-btn").disabled = false;
  document.body.dataset.saveState = "ready";
}

async function handleSaveClick(format) {
  const status = document.getElementById("save-probe-status");
  status.textContent = "saving…";
  document.body.dataset.saveState = "saving";
  try {
    const artifact = await buildSaveArtifact(currentBook, currentLines, format);
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

document.getElementById("save-xlsx-btn").addEventListener("click", () => handleSaveClick("xlsx"));
document.getElementById("save-zip-btn").addEventListener("click", () => handleSaveClick("zip"));

loadFixture().catch((error) => {
  document.getElementById("save-probe-status").textContent = "load failed";
  document.body.dataset.saveState = "failed";
  window.__DIYA_SAVE_RESULT__ = { ok: false, error: String(error && error.stack ? error.stack : error) };
});
