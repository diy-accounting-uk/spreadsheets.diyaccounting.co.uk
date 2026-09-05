// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd

// Template-level guard for Home sheet hyperlinks: walks the Home sheet in
// BST and Taxi templates and asserts every hyperlink target sheet exists.
// Hyperlinks can rot when sheets are renamed or removed.
//
// The Home sheet contains navigation links to all other worksheets. Both
// location-based links (<hyperlink location="'SheetName'!A1"/>) and
// rel-based links (external URLs) must point to valid targets.

import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";
import { readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { buildSheetMap } from "../lib/spreadsheet-runner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const TEMPLATES_DIR = join(ROOT, "app", "templates");

// ── Discovery ────────────────────────────────────────────────────────────

// Finds BST and Taxi templates
function findTemplates() {
  const templates = [];
  const bstPath = join(TEMPLATES_DIR, "bst", "bst-excel.xlsx");
  const taxiPath = join(TEMPLATES_DIR, "taxi", "taxi-excel.xlsx");

  try {
    readFileSync(bstPath);
    templates.push({ name: "BST", path: bstPath });
  } catch {
    // BST template not found in this build
  }

  try {
    readFileSync(taxiPath);
    templates.push({ name: "Taxi", path: taxiPath });
  } catch {
    // Taxi template not found in this build
  }

  return templates;
}

// ── Hyperlink extraction ─────────────────────────────────────────────────

// Extracts all hyperlinks from Home sheet XML. Hyperlinks are implemented as
// HYPERLINK formulas inside <f> elements:
//   <f>HYPERLINK("#'SheetName'!A1","Display Text")</f>         (BST format, patched)
//   <f>HYPERLINK(B3&"'SheetName'!A1","Display Text")</f>      (Taxi format, pre-patch)
//   <f>HYPERLINK("http://example.com","Display Text")</f>     (external URLs)
function extractHyperlinks(xml) {
  const hyperlinks = [];

  // Pattern 1: #'SheetName'!Cell or (prefix)&"'SheetName'!Cell
  // Matches cells with HYPERLINK formulas that reference sheet names in quotes
  // The key is to capture what comes after the opening paren or &
  const formulaMatches = [...xml.matchAll(/<c\s+r="([^"]*)"[^>]*>\s*<f>HYPERLINK\(([^)]+)\)<\/f>/g)];

  for (const [, ref, formulaArgs] of formulaMatches) {
    // Parse the formula arguments to find the target
    // Could be: "#'SheetName'!A1", "Display Text"
    // Or: B3&"'SheetName'!A1", "Display Text"
    // Or: "http://...", "Display Text"

    // Look for quoted strings containing sheet references or URLs
    const quotedMatches = [...formulaArgs.matchAll(/"([^"]*)"/g)];

    for (const [, quotedContent] of quotedMatches) {
      // Check if this is a sheet reference (contains '!') or a display text (starts with #)
      if (quotedContent.includes("'") && quotedContent.includes("!")) {
        // This looks like a sheet reference
        let type = "internal";
        let target = quotedContent;

        // Keep target in its original form (with or without # prefix)
        if (quotedContent.startsWith("#")) {
          // BST format already has # prefix
          hyperlinks.push({ ref, type, target });
        } else if (quotedContent.match(/^'[^']*'!/)) {
          // Taxi format: 'SheetName'!Cell (without # prefix)
          hyperlinks.push({ ref, type, target });
        }
      } else if (quotedContent.includes("://")) {
        // This is an external URL
        hyperlinks.push({ ref, type: "external", target: quotedContent });
      }
    }
  }

  return hyperlinks;
}

// Parses sheet name from an internal hyperlink target
// Handles both formats:
//   "#'SheetName'!A1" -> "SheetName"   (BST format with # prefix)
//   "'SheetName'!A1" -> "SheetName"    (Taxi format without # prefix)
//   "'Sheet &amp; Name'!A1" -> "Sheet & Name" (with entity decoding)
function parseSheetNameFromTarget(target) {
  // Try with # prefix first (BST format)
  let m = target.match(/^#'([^']*)'!/);
  if (!m) {
    // Try without # prefix (Taxi format)
    m = target.match(/^'([^']*)'!/);
  }
  if (!m) return null;
  // Decode XML entities (named entities before &amp;, so an encoded
  // ampersand followed by an entity name, e.g. "&amp;lt;", is not
  // mistaken for a second, already-escaped entity)
  const name = m[1]
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
  return name;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Home sheet hyperlinks", () => {
  const templates = findTemplates();

  if (templates.length === 0) {
    it.skip("No templates found", () => {});
    // Exit early if no templates
    process.exit(0);
  }

  for (const { name, path } of templates) {
    describe(`${name} template`, () => {
      let zip;
      let sheetMap;
      let homeXml;
      let hyperlinks;
      let allSheetNames;

      beforeAll(async () => {
        const buffer = readFileSync(path);
        zip = await JSZip.loadAsync(buffer);
        sheetMap = await buildSheetMap(zip);

        // Get all sheet names from the workbook
        allSheetNames = Array.from(sheetMap.keys());

        // Find and read Home sheet
        const homeSheetPath = sheetMap.get("Home");
        if (!homeSheetPath) {
          throw new Error(`Home sheet not found in ${name} template`);
        }

        homeXml = await zip.file(homeSheetPath).async("string");
        hyperlinks = extractHyperlinks(homeXml);
      });

      it(`has Home sheet with hyperlinks`, () => {
        expect(hyperlinks.length).toBeGreaterThan(0);
      });

      it(`all internal hyperlinks point to existing sheets`, () => {
        const internalLinks = hyperlinks.filter((h) => h.type === "internal");
        expect(internalLinks.length).toBeGreaterThan(0);

        for (const link of internalLinks) {
          const targetSheet = parseSheetNameFromTarget(link.target);
          expect(targetSheet).not.toBeNull();
          expect(allSheetNames).toContain(targetSheet, `Hyperlink at ${link.ref} points to non-existent sheet: ${link.target}`);
        }
      });

      it(`every hyperlink target is well-formed`, () => {
        for (const link of hyperlinks) {
          if (link.type === "internal") {
            // Must match pattern: '#'SheetName'!A1' (BST) or ''SheetName'!A1' (Taxi)
            expect(link.target).toMatch(/^#?'[^']*'![A-Z]+\d+$/, `Malformed internal target: ${link.target}`);
          } else if (link.type === "external") {
            // External URLs (not validated in this test)
            expect(link.target).toContain("://");
          }
        }
      });
    });
  }
});

// ── Breakability test ────────────────────────────────────────────────────

describe("Home sheet hyperlinks — breakability", () => {
  const templates = findTemplates();

  if (templates.length === 0) {
    it.skip("No templates found", () => {});
    return;
  }

  for (const { name, path } of templates) {
    describe(`${name} template`, () => {
      it(`detects when a hyperlink target sheet is renamed`, async () => {
        // Load the template
        const buffer = readFileSync(path);
        const originalZip = await JSZip.loadAsync(buffer);
        const sheetMap = await buildSheetMap(originalZip);

        // Find an internal hyperlink to corrupt
        const homeSheetPath = sheetMap.get("Home");
        let homeXml = await originalZip.file(homeSheetPath).async("string");
        const hyperlinks = extractHyperlinks(homeXml);
        const internalLinks = hyperlinks.filter((h) => h.type === "internal");

        if (internalLinks.length === 0) {
          // Skip if no internal hyperlinks to corrupt
          return;
        }

        const linkToCorrupt = internalLinks[0];
        const targetSheet = parseSheetNameFromTarget(linkToCorrupt.target);

        // Create an in-memory copy with the hyperlink target corrupted
        const corruptedZip = new JSZip();
        for (const file of Object.keys(originalZip.files)) {
          const entry = originalZip.files[file];
          if (entry.dir) continue; // Skip directories
          const content = await originalZip.file(file).async("uint8array");
          corruptedZip.file(file, content, { date: entry.date });
        }

        // Corrupt the hyperlink: change the target sheet name to a non-existent one
        const corruptedTarget = linkToCorrupt.target.replace(`'${targetSheet}'!`, "'NonExistentSheet'!");
        // Simple string replacement - find the target in the formula and replace it
        const escapedTarget = linkToCorrupt.target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const corruptedHomeXml = homeXml.replace(new RegExp(escapedTarget, "g"), corruptedTarget);

        corruptedZip.file(homeSheetPath, corruptedHomeXml, {
          date: originalZip.file(homeSheetPath).date,
        });

        // Verify the corruption is present
        let corruptedSheetMap = await buildSheetMap(corruptedZip);
        let corruptedHomeXmlRead = await corruptedZip.file(homeSheetPath).async("string");
        let corruptedHyperlinks = extractHyperlinks(corruptedHomeXmlRead);

        // Find the corrupted link
        const corruptedLink = corruptedHyperlinks.find((h) => h.ref === linkToCorrupt.ref && h.target.includes("NonExistentSheet"));
        expect(corruptedLink).toBeDefined();

        // Now the test should fail: the corrupted hyperlink points to a sheet that doesn't exist
        const allSheetNames = Array.from(corruptedSheetMap.keys());
        const corruptedLinkTargetSheet = parseSheetNameFromTarget(corruptedLink.target);

        expect(allSheetNames).not.toContain(corruptedLinkTargetSheet, "Breakability test setup failed: corrupted sheet should not exist");
      });
    });
  }
});
