// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// drift.js — the as-read layer and the drift it shows against the engine.
//
// An uploaded workbook carries a cached value for every cell it was last
// saved with. The page reads those once, off the uploaded bytes, and every
// later snapshot compares the engine's figure with them: a difference before
// any edit is a reconciliation finding, after one it is the edit's own
// effect. Editing moves the calculated side only, so the layer never changes
// while the page is open.
//
// A multi-file package adds a second layer. The hub caches every leaf cell it
// reads across an external link, and a customer who saved a leaf without
// reopening the hub leaves that cache behind the leaf. For each such cell the
// page holds the hub's cache, the leaf's own value and the engine's figure,
// and the three tell a stale hub from a drifted leaf.
//
// Loaded before data.js, which calls it, as window.DiyaGlDrift.

(function (global) {
  "use strict";

  // Mirrors app/bin/verify-roundtrip.js's canonicalForUnit: a money value
  // rounds half up at a working precision finer than a penny first (so
  // binary-float noise never nudges the penny the wrong way), then to the
  // penny; a rate rounds half up to six places. Both operate on the numbers
  // the engine and the workbook already hand back -- there is no string
  // decimal arithmetic here, only enough guard to keep IEEE-754 noise from
  // reading as a genuine difference.
  var WORKING_DECIMALS = 6;
  var MONEY_DECIMALS = 2;
  var RATE_DECIMALS = 6;

  var STALE_NOTE = "the hub was saved before this leaf changed";

  function roundHalfUp(value, decimals) {
    if (typeof value !== "number" || !isFinite(value)) return value;
    var factor = Math.pow(10, decimals);
    var guarded = value + (value >= 0 ? 1 : -1) * Math.max(Math.abs(value), 1) * 1e-9;
    var sign = guarded < 0 ? -1 : 1;
    return (sign * Math.round(Math.abs(guarded) * factor)) / factor;
  }

  function canonicalise(value, unit) {
    if (typeof value !== "number" || !isFinite(value)) return value;
    if (unit === "rate") return roundHalfUp(value, RATE_DECIMALS);
    return roundHalfUp(roundHalfUp(value, WORKING_DECIMALS), MONEY_DECIMALS);
  }

  /**
   * The as-read layer: every CELL_MAP cell of the units the manifest names,
   * read once off the uploaded hub. Text cells carry no meaningful drift in
   * the pencil-correction sense, so only the manifest's units are read, and
   * the sections it excludes are skipped.
   *
   * The unit comes from the product module's own cellLabels(), which is
   * where the report reads it from too: a product declares it as a column of
   * CELL_MAP or as a function of the sheet the cell sits on, and this side
   * needs the answer, not the shape it was written in.
   *
   * @param {Array} cellMap - the product's CELL_MAP rows
   * @param {Object} labels - the product module's cellLabels(), keyed sheet!cell
   * @param {Object} set - a workbook set: hasSheet(file, sheet), readCell(file, sheet, cell)
   * @param {string} hubFile - the workbook the CELL_MAP names cells on
   * @param {Object} manifest - the product manifest, for drift.units and drift.excludedSections
   */
  async function captureAsReadLayer(cellMap, labels, set, hubFile, manifest) {
    var captured = [];
    for (var i = 0; i < cellMap.length; i++) {
      var entry = cellMap[i];
      var sheet = entry[0],
        cell = entry[1],
        label = entry[2],
        section = entry[4];
      var declared = labels[sheet + "!" + cell];
      var unit = declared ? declared.unit : undefined;
      if (!manifest.drift.units[unit]) continue;
      if (manifest.drift.excludedSections[section]) continue;
      if (!(await set.hasSheet(hubFile, sheet))) continue;
      var value = await set.readCell(hubFile, sheet, cell);
      if (typeof value !== "number") continue;
      captured.push({ sheet: sheet, cell: cell, label: label, unit: unit, value: value });
    }
    return captured;
  }

  /**
   * The link layer: every leaf cell the hub caches, with the hub's cached
   * value and the leaf's own. A leaf the set does not hold, or a cell it has
   * no value for, yields no entry: an absent cell cannot be judged.
   * @param {Object} set - a workbook set with zip(file) as well as readCell
   * @param {string} hubFile
   * @param {Object} engine - the diya-gl engine bundle
   */
  async function captureLinkLayer(set, hubFile, engine) {
    var hubZip = await set.zip(hubFile);
    var cache = await engine.linkCacheValues(hubZip);
    var addressed = await engine.linkAddressedCells(hubZip);
    var layer = [];
    for (var i = 0; i < addressed.length; i++) {
      var link = addressed[i];
      var key = link.targetFile + "!" + link.sheet + "!" + link.cell;
      if (!cache.has(key) || !set.has(link.targetFile)) continue;
      var leafValue = await set.readCell(link.targetFile, link.sheet, link.cell);
      if (leafValue === undefined || leafValue === null) continue;
      layer.push({
        file: link.targetFile,
        sheet: link.sheet,
        cell: link.cell,
        key: key,
        hubCache: cache.get(key),
        leafValue: leafValue,
        sources: link.sources,
      });
    }
    return layer;
  }

  function labelFor(asReadLayer, sheet, cell) {
    for (var i = 0; i < asReadLayer.length; i++) {
      if (asReadLayer[i].sheet === sheet && asReadLayer[i].cell === cell) return asReadLayer[i].label;
    }
    return sheet + "!" + cell;
  }

  // The engine's value for a leaf cell, from the unscoped link cells: the
  // hub's sheets under their bare names, every leaf sheet as File.xlsx!Sheet.
  function engineValueFor(links, entry) {
    var sheetKey = entry.file === links.hubFile ? entry.sheet : entry.file + "!" + entry.sheet;
    var sheet = links.cells[sheetKey];
    return sheet ? sheet[entry.cell] : undefined;
  }

  /**
   * Every captured cell compared to what the engine now computes, plus, for a
   * multi-file package, the stale and drifted link cells marked on the hub
   * cells that read them.
   *
   * Each entry is { id, label, computed, asRead, note, recalculated, state,
   * file, sheet, cell, leaf }. id is the report cell key without its "cell/"
   * prefix, which is what applyDriftMarks matches against data-r-key. A hub
   * cell whose cache predates the leaf is marked stale and loses its own
   * drift entry: its figure is downstream of that cache, so it cannot be
   * judged drifted. Link entries are computed from the uploaded bytes and
   * are never relabelled recalculated: staleness is a property of the file
   * the customer uploaded, not of the book they are editing.
   * @param {Array} asReadLayer - from captureAsReadLayer
   * @param {Object} results - the engine's scoped results
   * @param {boolean} recalculated - true once the book has been edited
   * @param {Object|null} links - { layer, cells, hubFile, classify } for a
   *   multi-file package: the link layer, the unscoped link cells, the hub's
   *   file name (which prefixes every id) and the engine's classifyLinkCell
   */
  function driftFromAsRead(asReadLayer, results, recalculated, links) {
    var prefix = links && links.hubFile ? links.hubFile + "!" : "";
    var drift = [];
    var staleIds = {};

    if (links) {
      for (var i = 0; i < links.layer.length; i++) {
        var entry = links.layer[i];
        var engineValue = engineValueFor(links, entry);
        if (typeof engineValue !== "number") continue;
        var verdict = links.classify({ hubCache: entry.hubCache, leafValue: entry.leafValue, engineValue: engineValue });
        if (!verdict.stale && !verdict.drift) continue;
        for (var s = 0; s < entry.sources.length; s++) {
          var source = entry.sources[s];
          var at = source.lastIndexOf("!");
          if (at === -1) continue;
          var hubSheet = source.slice(0, at),
            hubCell = source.slice(at + 1);
          var common = {
            id: prefix + source,
            label: labelFor(asReadLayer, hubSheet, hubCell),
            recalculated: false,
            file: links.hubFile,
            sheet: hubSheet,
            cell: hubCell,
            leaf: entry.key,
          };
          if (verdict.stale) {
            staleIds[common.id] = true;
            drift.push(Object.assign({ computed: engineValue, asRead: entry.hubCache, note: STALE_NOTE, state: "stale" }, common));
          }
          if (verdict.drift) {
            drift.push(Object.assign({ computed: engineValue, asRead: entry.leafValue, note: entry.key, state: "drift" }, common));
          }
        }
      }
    }

    for (var j = 0; j < asReadLayer.length; j++) {
      var read = asReadLayer[j];
      var id = prefix + read.sheet + "!" + read.cell;
      if (staleIds[id]) continue;
      var computedRaw = results[read.sheet] && results[read.sheet][read.cell];
      if (typeof computedRaw !== "number") continue;
      var computed = canonicalise(computedRaw, read.unit);
      var asRead = canonicalise(read.value, read.unit);
      if (Math.abs(computed - asRead) < 1e-9) continue;
      drift.push({
        id: id,
        label: read.label,
        computed: computedRaw,
        asRead: read.value,
        note: read.sheet + "!" + read.cell,
        recalculated: !!recalculated,
        state: "drift",
        file: links ? links.hubFile : null,
        sheet: read.sheet,
        cell: read.cell,
        leaf: null,
      });
    }
    return drift;
  }

  global.DiyaGlDrift = {
    captureAsReadLayer: captureAsReadLayer,
    captureLinkLayer: captureLinkLayer,
    driftFromAsRead: driftFromAsRead,
  };
})(window);
