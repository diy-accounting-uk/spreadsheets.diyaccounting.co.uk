// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// money-canonical.js — rounding a reconciliation value to the precision it
// is compared at. Excel stores binary floating point and the xls roundtrip
// re-serialises it, so both engines carry representation noise below a
// penny; canonicalForUnit removes that noise and keeps every real penny.
// This is canonicalisation, not tolerance: it applies to every money value,
// the filed boxes included.
//
// Node-only and browser code share this module: verify-roundtrip.js scores a
// reconciliation run against it, and the books bundle (books-engine.js) reexports
// it so the page can format a figure at the same precision the reconciliation
// compares it at, rather than trusting Intl.NumberFormat with the raw double.

// A working precision a money value passes through before the penny round,
// finer than any real penny difference but coarse enough to absorb the
// representation noise a binary float or an xls roundtrip leaves below it.
const WORKING_DECIMALS = 6;
const MONEY_DECIMALS = 2;
// A rate is stored as a fraction, and six places is finer than any rate the
// tax data declares.
const RATE_DECIMALS = 6;

/**
 * Round a decimal string half away from zero to a fixed number of places, on
 * the digits themselves rather than through a binary float, so 0.005 at two
 * places is 0.01 and never 0.00.
 * @param {string} text - a decimal string, optionally signed
 * @param {number} decimals
 * @returns {string} the value with exactly `decimals` places
 */
export function roundHalfUp(text, decimals) {
  const match = /^([-+]?)(\d*)(?:\.(\d*))?$/.exec(String(text).trim());
  if (!match) return String(text).trim();
  const sign = match[1] === "-" ? "-" : "";
  const whole = match[2] || "0";
  const fraction = match[3] || "";

  const kept = fraction.slice(0, decimals).padEnd(decimals, "0");
  const nextDigit = fraction.charCodeAt(decimals) - 48;
  let digits = BigInt(whole + kept);
  if (nextDigit >= 5) digits += 1n;

  const padded = digits.toString().padStart(decimals + 1, "0");
  const wholePart = padded.slice(0, padded.length - decimals);
  const fractionPart = decimals > 0 ? `.${padded.slice(padded.length - decimals)}` : "";
  const rounded = `${wholePart}${fractionPart}`;
  // A rounded nil is nil, never "-0.00".
  return digits === 0n ? rounded : `${sign}${rounded}`;
}

export function isDecimal(text) {
  const trimmed = String(text ?? "").trim();
  return /^[-+]?\d*(\.\d*)?$/.test(trimmed) && /\d/.test(trimmed);
}

/**
 * A report value in the form its unit is compared in. An unknown or absent
 * unit canonicalises to the trimmed string, so a value with no declared unit
 * is compared exactly and declaring a unit can only ever loosen a comparison,
 * never tighten one.
 * @param {string} value
 * @param {string} [unit] - money, rate, count, date, text, identifier or verdict
 * @returns {string}
 */
export function canonicalForUnit(value, unit) {
  const text = String(value ?? "").trim();
  // A money value is rounded to a working precision first (finer than the
  // penny but coarse enough to absorb binary-float noise below it), then to
  // the penny. Rounding straight to the penny lets the noise itself decide
  // which way a value on the boundary falls, and the two engines' noise
  // differs, so the same underlying penny can round two different ways.
  if (unit === "money" && isDecimal(text)) return roundHalfUp(roundHalfUp(text, WORKING_DECIMALS), MONEY_DECIMALS);
  if (unit === "rate" && isDecimal(text)) return roundHalfUp(text, RATE_DECIMALS);
  return text;
}

export { MONEY_DECIMALS, WORKING_DECIMALS, RATE_DECIMALS };
