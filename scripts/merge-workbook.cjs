#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// merge-workbook.cjs — Merge sheets from a source xlsx into a hub xlsx.
// Handles: sheet XML copy, workbook.xml entries, rels, shared strings merge
// with index remapping, formula rewriting (external link removal/renumbering),
// definedName re-scoping, and external link XML cleanup.
//
// Usage: node scripts/merge-workbook.cjs --hub HUB.xlsx --source SOURCE.xlsx [--remove-source] [--dry-run]
//        node scripts/merge-workbook.cjs --config merge-config.json

const JSZip = require("jszip");
const fs = require("fs");
const path = require("path");

async function loadZip(filePath) {
  return JSZip.loadAsync(fs.readFileSync(filePath));
}

async function saveZip(zip, filePath) {
  const buf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  fs.writeFileSync(filePath, buf);
  return buf.length;
}

function parseSheets(wbXml) {
  const sheets = [];
  const re = /<sheet name="([^"]*)"[^>]*sheetId="(\d+)"[^>]*r:id="(rId\d+)"[^/]*\/>/g;
  let m;
  while ((m = re.exec(wbXml)) !== null) {
    sheets.push({ name: m[1].replace(/&amp;/g, "&"), xmlName: m[1], sheetId: parseInt(m[2]), rId: m[3] });
  }
  return sheets;
}

function parseRels(relsXml) {
  const rels = [];
  const re = /<Relationship\s+Id="(rId\d+)"[^>]*Type="([^"]*)"[^>]*Target="([^"]*)"[^/]*\/>/g;
  let m;
  while ((m = re.exec(relsXml)) !== null) {
    rels.push({ id: m[1], type: m[2], target: m[3] });
  }
  return rels;
}

function maxRIdNum(rels) {
  return Math.max(0, ...rels.map((r) => parseInt(r.id.replace("rId", ""))));
}

function maxSheetId(sheets) {
  return Math.max(0, ...sheets.map((s) => s.sheetId));
}

function countSharedStrings(ssXml) {
  return (ssXml.match(/<si>/g) || []).length;
}

function extractSharedStringEntries(ssXml) {
  const entries = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(ssXml)) !== null) {
    entries.push(m[0]);
  }
  return entries;
}

function offsetSharedStringRefs(xml, offset) {
  return xml.replace(
    /(<c\s+r="[A-Z]+\d+"[^>]*\st="s"[^>]*><v>)(\d+)(<\/v>)/g,
    (match, pre, idx, post) => `${pre}${parseInt(idx) + offset}${post}`
  );
}

function rewriteFormulas(xml, linkRewrites) {
  for (const { pattern, replacement } of linkRewrites) {
    xml = xml.replace(pattern, replacement);
  }
  return xml;
}

async function mergeWorkbook(hubPath, sourcePath, config) {
  const hubZip = await loadZip(hubPath);
  const srcZip = await loadZip(sourcePath);

  const hubWbXml = await hubZip.file("xl/workbook.xml").async("string");
  const hubRelsXml = await hubZip.file("xl/_rels/workbook.xml.rels").async("string");
  const srcWbXml = await srcZip.file("xl/workbook.xml").async("string");
  const srcRelsXml = await srcZip.file("xl/_rels/workbook.xml.rels").async("string");

  const hubSheets = parseSheets(hubWbXml);
  const srcSheets = parseSheets(srcWbXml);
  const hubRels = parseRels(hubRelsXml);
  const srcRels = parseRels(srcRelsXml);

  let nextRId = maxRIdNum(hubRels) + 1;
  let nextSheetId = maxSheetId(hubSheets) + 1;

  const srcSheetRels = srcRels.filter((r) => r.type.includes("worksheet"));
  const srcSheetMap = new Map();
  for (const sheet of srcSheets) {
    const rel = srcSheetRels.find((r) => r.id === sheet.rId);
    if (rel) srcSheetMap.set(sheet.name, { ...sheet, target: rel.target });
  }

  console.log(`Hub: ${hubSheets.length} sheets, max sheetId=${maxSheetId(hubSheets)}, max rId=${maxRIdNum(hubRels)}`);
  console.log(`Source: ${srcSheets.length} sheets (${srcSheets.map((s) => s.name).join(", ")})`);

  const hubSsXml = await hubZip.file("xl/sharedStrings.xml")?.async("string");
  const srcSsXml = await srcZip.file("xl/sharedStrings.xml")?.async("string");
  let ssOffset = 0;

  if (hubSsXml && srcSsXml) {
    ssOffset = countSharedStrings(hubSsXml);
    const srcEntries = extractSharedStringEntries(srcSsXml);
    console.log(`Shared strings: hub=${ssOffset}, source=${srcEntries.length}, offset=${ssOffset}`);

    let mergedSs = hubSsXml.replace(/<\/sst>/, srcEntries.join("") + "</sst>");
    const newCount = ssOffset + srcEntries.length;
    mergedSs = mergedSs.replace(/count="\d+"/, `count="${newCount}"`);
    mergedSs = mergedSs.replace(/uniqueCount="\d+"/, `uniqueCount="${newCount}"`);
    hubZip.file("xl/sharedStrings.xml", mergedSs, {
      date: hubZip.file("xl/sharedStrings.xml").date,
    });
  }

  const nextSheetFileNum =
    Math.max(
      0,
      ...Object.keys(hubZip.files)
        .filter((f) => f.match(/xl\/worksheets\/sheet\d+\.xml$/))
        .map((f) => parseInt(f.match(/sheet(\d+)/)[1]))
    ) + 1;

  const newSheetEntries = [];
  const newRelEntries = [];
  let sheetFileNum = nextSheetFileNum;

  for (const srcSheet of srcSheets) {
    const info = srcSheetMap.get(srcSheet.name);
    if (!info) continue;

    const srcTarget = `xl/${info.target}`;
    let sheetXml = await srcZip.file(srcTarget).async("string");

    if (ssOffset > 0) {
      sheetXml = offsetSharedStringRefs(sheetXml, ssOffset);
    }

    if (config.linkRewrites) {
      sheetXml = rewriteFormulas(sheetXml, config.linkRewrites);
    }

    const newTarget = `worksheets/sheet${sheetFileNum}.xml`;
    hubZip.file(`xl/${newTarget}`, sheetXml);

    const srcPrinterPath = `xl/worksheets/_rels/sheet${info.target.match(/sheet(\d+)/)?.[1]}.xml.rels`;
    if (srcZip.files[srcPrinterPath]) {
      const printerRels = await srcZip.file(srcPrinterPath).async("string");
      const newPrinterPath = `xl/worksheets/_rels/sheet${sheetFileNum}.xml.rels`;
      hubZip.file(newPrinterPath, printerRels);
    }

    const printerSettingsFiles = Object.keys(srcZip.files).filter(
      (f) => f.startsWith("xl/printerSettings/") && !hubZip.files[f]
    );
    for (const psf of printerSettingsFiles) {
      const content = await srcZip.file(psf).async("nodebuffer");
      hubZip.file(psf, content);
    }

    const rId = `rId${nextRId++}`;
    const sheetId = nextSheetId++;
    newSheetEntries.push({ name: srcSheet.xmlName, sheetId, rId });
    newRelEntries.push({
      id: rId,
      type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet",
      target: newTarget,
    });

    console.log(`  Copied: ${srcSheet.name} -> sheet${sheetFileNum}.xml (sheetId=${sheetId}, ${rId})`);
    sheetFileNum++;
  }

  let updatedWbXml = hubWbXml;
  const sheetInsertions = newSheetEntries
    .map((s) => `<sheet name="${s.name}" sheetId="${s.sheetId}" r:id="${s.rId}"/>`)
    .join("");
  updatedWbXml = updatedWbXml.replace("</sheets>", sheetInsertions + "</sheets>");

  if (config.definedNames) {
    const hubSheetCount = hubSheets.length;
    for (const dn of config.definedNames) {
      const localSheetId = hubSheetCount + dn.sourceSheetIndex;
      const dnXml = `<definedName name="${dn.name}" localSheetId="${localSheetId}">${dn.value}</definedName>`;
      updatedWbXml = updatedWbXml.replace("</definedNames>", dnXml + "</definedNames>");
    }
  }

  hubZip.file("xl/workbook.xml", updatedWbXml, {
    date: hubZip.file("xl/workbook.xml").date,
  });

  let updatedRelsXml = hubRelsXml;
  const relInsertions = newRelEntries
    .map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`)
    .join("");
  updatedRelsXml = updatedRelsXml.replace("</Relationships>", relInsertions + "</Relationships>");

  if (config.removeExternalLinks) {
    for (const linkNum of config.removeExternalLinks) {
      const linkPath = `xl/externalLinks/externalLink${linkNum}.xml`;
      const linkRelsPath = `xl/externalLinks/_rels/externalLink${linkNum}.xml.rels`;
      hubZip.remove(linkPath);
      if (hubZip.files[linkRelsPath]) hubZip.remove(linkRelsPath);

      const linkRelPattern = new RegExp(
        `<Relationship[^>]*Target="externalLinks/externalLink${linkNum}\\.xml"[^/]*/>`,
        "g"
      );
      updatedRelsXml = updatedRelsXml.replace(linkRelPattern, "");
      console.log(`  Removed external link ${linkNum}`);
    }
  }

  hubZip.file("xl/_rels/workbook.xml.rels", updatedRelsXml, {
    date: hubZip.file("xl/_rels/workbook.xml.rels").date,
  });

  if (config.hubLinkRewrites) {
    const sheetFiles = Object.keys(hubZip.files).filter(
      (f) => f.startsWith("xl/worksheets/sheet") && f.endsWith(".xml")
    );
    for (const sf of sheetFiles) {
      let xml = await hubZip.file(sf).async("string");
      const orig = xml;
      xml = rewriteFormulas(xml, config.hubLinkRewrites);
      if (xml !== orig) {
        hubZip.file(sf, xml, { date: hubZip.file(sf).date });
      }
    }
  }

  if (config.removeSourceExternalLinks) {
    for (const linkNum of config.removeSourceExternalLinks) {
      const linkPath = `xl/externalLinks/externalLink${linkNum}.xml`;
      const linkRelsPath = `xl/externalLinks/_rels/externalLink${linkNum}.xml.rels`;
      if (srcZip.files[linkPath]) {
        console.log(`  (Source external link ${linkNum} not copied to hub)`);
      }
    }
  }

  const size = await saveZip(hubZip, hubPath);
  console.log(`\nSaved: ${hubPath} (${(size / 1024).toFixed(0)} KB)`);

  return { hubSheets: hubSheets.length + srcSheets.length };
}

async function main() {
  const args = process.argv.slice(2);
  const configIdx = args.indexOf("--config");

  if (configIdx !== -1) {
    const configPath = args[configIdx + 1];
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    for (const step of config.steps) {
      console.log(`\n=== Merging ${path.basename(step.source)} into ${path.basename(step.hub)} ===`);

      const linkRewrites = (step.linkRewrites || []).map((r) => ({
        pattern: new RegExp(r.pattern, r.flags || "g"),
        replacement: r.replacement,
      }));

      const hubLinkRewrites = (step.hubLinkRewrites || []).map((r) => ({
        pattern: new RegExp(r.pattern, r.flags || "g"),
        replacement: r.replacement,
      }));

      await mergeWorkbook(step.hub, step.source, {
        linkRewrites,
        hubLinkRewrites,
        removeExternalLinks: step.removeExternalLinks || [],
        removeSourceExternalLinks: step.removeSourceExternalLinks || [],
        definedNames: step.definedNames || [],
      });

      if (step.removeSource) {
        fs.unlinkSync(step.source);
        console.log(`  Deleted: ${step.source}`);
      }
    }
  } else {
    console.error("Usage: node scripts/merge-workbook.cjs --config merge-config.json");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
