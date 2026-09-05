// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// canonical-report-value.js — the one rounding a report value gets for its
// unit, shared by verify-roundtrip.js (comparing an Excel-side value against
// a JS-side one) and each product's fmt() (printing a section value). A
// money value rounds half up at a working precision finer than a penny
// first, so binary-float noise below the penny never nudges it the wrong
// way, then to the penny; a rate rounds half up to six places; every other
// unit passes through untouched.

// Excel stores binary floating point and the xls roundtrip re-serialises it,
// so both sides carry representation noise below a penny. Rounding removes
// the noise and keeps every real penny. This is canonicalisation, not
// tolerance: it applies to every money value, the filed boxes included.
export const MONEY_DECIMALS = 2;
// A working precision a money value passes through before the penny round,
// finer than any real penny difference but coarse enough to absorb the
// representation noise a binary float or an xls roundtrip leaves below it.
export const WORKING_DECIMALS = 6;
// A rate is stored as a fraction, and six places is finer than any rate the
// tax data declares.
export const RATE_DECIMALS = 6;

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

/**
 * Whether a value reads as a plain decimal number, signed or not, so a
 * caller can tell a date or text value apart from one worth rounding.
 * @param {*} text
 * @returns {boolean}
 */
export function isDecimal(text) {
  const trimmed = String(text ?? "").trim();
  return /^[-+]?\d*(\.\d*)?$/.test(trimmed) && /\d/.test(trimmed);
}

/**
 * A report value in the form its unit is compared or printed in. An unknown
 * or absent unit canonicalises to the trimmed string, so a value with no
 * declared unit is left exactly as given.
 * @param {*} value
 * @param {string} [unit] - money, rate, count, date, text, identifier or verdict
 * @returns {string}
 */
export function canonicalForUnit(value, unit) {
  const text = String(value ?? "").trim();
  if (unit === "money" && isDecimal(text)) return roundHalfUp(roundHalfUp(text, WORKING_DECIMALS), MONEY_DECIMALS);
  if (unit === "rate" && isDecimal(text)) return roundHalfUp(text, RATE_DECIMALS);
  return text;
}
