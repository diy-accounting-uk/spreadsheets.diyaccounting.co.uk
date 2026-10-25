// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// frc-suite-concepts-node.js — the resolver the Node entry points pass to
// mapIxbrlAccounts: the concept names an FRC suite defines, read on first
// use from app/data/frc-taxonomy/<year>.json. Not part of the browser bundle.

import { readFileSync } from "node:fs";

const cache = new Map();

/**
 * The concept names the FRC suite of this date defines.
 * @param {string} suiteDate - the suite's date, e.g. "2021-01-01"
 * @returns {Set<string>|undefined} undefined when no list exists for the suite's year
 */
export function frcSuiteConcepts(suiteDate) {
  const year = String(suiteDate).slice(0, 4);
  if (!cache.has(year)) {
    let names;
    try {
      names = new Set(JSON.parse(readFileSync(new URL(`../data/frc-taxonomy/${year}.json`, import.meta.url), "utf8")).concepts);
    } catch (cause) {
      if (cause.code !== "ENOENT") throw cause;
    }
    cache.set(year, names);
  }
  return cache.get(year);
}
