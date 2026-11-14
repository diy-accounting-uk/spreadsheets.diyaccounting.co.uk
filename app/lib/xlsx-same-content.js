// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// xlsx-same-content.js — Say whether two xlsx files hold the same content.
// LibreOffice stamps the zip entries with the time of the save and writes the
// <dataValidation> elements of a sheet in a varying order, so two saves of the
// same workbook differ in bytes. This compares the uncompressed parts and
// treats the order of data validations as insignificant.

import JSZip from "jszip";

const DATA_VALIDATION = /<dataValidation\b[^>]*?(?:\/>|>[\s\S]*?<\/dataValidation>)/g;
const DATA_VALIDATION_RUN = /(?:<dataValidation\b[^>]*?(?:\/>|>[\s\S]*?<\/dataValidation>))+/g;

export function sortDataValidations(xml) {
  return xml.replace(DATA_VALIDATION_RUN, (run) => (run.match(DATA_VALIDATION) ?? []).sort().join(""));
}

async function readParts(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const parts = new Map();
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const bytes = await entry.async("nodebuffer");
    parts.set(name, name.startsWith("xl/worksheets/") && name.endsWith(".xml") ? sortDataValidations(bytes.toString("utf8")) : bytes);
  }
  return parts;
}

export async function xlsxSameContent(bufferA, bufferB) {
  const [a, b] = await Promise.all([readParts(bufferA), readParts(bufferB)]);
  if (a.size !== b.size) return false;
  for (const [name, partA] of a) {
    const partB = b.get(name);
    if (partB === undefined) return false;
    if (typeof partA === "string" ? partA !== partB : !partA.equals(partB)) return false;
  }
  return true;
}
