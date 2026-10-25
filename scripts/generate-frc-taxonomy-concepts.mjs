#!/usr/bin/env node
// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// generate-frc-taxonomy-concepts.mjs — fetch the FRS 102 entry point of each FRC
// taxonomy suite and the schema modules it pulls in, then write the flat list
// of element local names of that suite to app/data/frc-taxonomy/<year>.json.
// app/lib/ixbrl-accounts.js reads the list of the suite a file declares, so a
// name the suite defines is told apart from a name it does not.
//
// Usage:
//   node scripts/generate-frc-taxonomy-concepts.mjs
//
// A suite whose files the FRC site does not serve is named and skipped; its
// list is not written.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The suites the FRC publishes between 2014 and 2021. Each date is the folder
// the FRC site serves the suite under.
export const SUITE_DATES = ["2014-09-01", "2018-01-01", "2019-01-01", "2021-01-01"];

const BASE = "https://xbrl.frc.org.uk";

export function suiteUrls(date) {
  return {
    entryPoint: `${BASE}/FRS-102/${date}/FRS-102-${date}.xsd`,
    modules: {
      bus: `${BASE}/cd/${date}/business/bus-${date}.xsd`,
      core: `${BASE}/fr/${date}/core/frc-core-${date}.xsd`,
      direp: `${BASE}/reports/${date}/direp/direp-${date}.xsd`,
    },
  };
}

const OUTPUT_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "data", "frc-taxonomy");

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetching ${url} failed with status ${response.status}`);
  return response.text();
}

export function extractElementNames(schemaXml) {
  const names = [];
  const elementPattern = /<(?:[a-zA-Z0-9]+:)?element\b[^>]*\bname="([^"]+)"/g;
  let match;
  while ((match = elementPattern.exec(schemaXml)) !== null) names.push(match[1]);
  return names;
}

export function extractTargetNamespace(schemaXml) {
  const match = schemaXml.match(/targetNamespace="([^"]+)"/);
  if (!match) throw new Error("No targetNamespace found in schema");
  return match[1];
}

async function generateSuite(date) {
  const { entryPoint, modules } = suiteUrls(date);
  await fetchText(entryPoint);
  const namespaces = {};
  const concepts = new Set();
  for (const [prefix, url] of Object.entries(modules)) {
    const schemaXml = await fetchText(url);
    namespaces[prefix] = extractTargetNamespace(schemaXml);
    for (const name of extractElementNames(schemaXml)) concepts.add(name);
  }
  return { suite: date, entryPoint, namespaces, concepts: Array.from(concepts).sort() };
}

async function main() {
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const skipped = [];
  for (const date of SUITE_DATES) {
    try {
      const list = await generateSuite(date);
      const path = join(OUTPUT_DIRECTORY, `${date.slice(0, 4)}.json`);
      writeFileSync(path, JSON.stringify(list, null, 2) + "\n");
      console.log(`${date}: ${list.concepts.length} concepts to ${path}`);
    } catch (error) {
      skipped.push(date);
      console.error(`${date}: skipped (${error.message})`);
    }
  }
  if (skipped.length > 0) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
