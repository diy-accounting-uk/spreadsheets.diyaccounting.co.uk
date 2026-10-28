// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// share-nominal.js — the nominal value of one share on a book's register of
// members. A book written under diya-gl/2 or later states it on every member.
// A book that predates that format, or carries no format marker, priced every
// share at £1, so its members read as £1 here and nowhere else.

export const NOMINAL_VALUE_FORMAT = 2;

// The numeric part of a "diya-gl/2" or "diya-gl-books/1" marker, or undefined
// where the book carries none.
export function bookFormatNumber(book) {
  const marker = book?.documentInfo?.["diya-gl:formatVersion"];
  const match = typeof marker === "string" ? /\/(\d+)$/.exec(marker) : null;
  return match ? Number(match[1]) : undefined;
}

export function statesNominalValue(book) {
  const format = bookFormatNumber(book);
  return format !== undefined && format >= NOMINAL_VALUE_FORMAT;
}

/**
 * The nominal value per share for one member of the book's register.
 * @param {Object} member - a members[] entry
 * @param {Object} book - the parsed book, for its format marker
 * @returns {number}
 */
export function memberNominalValue(member, book) {
  if (member.nominalValue !== undefined) return member.nominalValue;
  if (!statesNominalValue(book)) return 1;
  throw new Error(
    `members[] "${member.name}" has no nominalValue, and the book's format ${book.documentInfo["diya-gl:formatVersion"]} states one on every member`,
  );
}

/**
 * The one nominal value the register prices every holding at. The members
 * sheet takes its nominal value from a single cell, so members that differ
 * cannot be carried.
 * @param {number[]} nominalValues - one resolved value per member
 * @returns {number|undefined} undefined for an empty register
 */
export function registerNominalValue(nominalValues) {
  const values = new Set(nominalValues);
  if (values.size > 1) {
    throw new Error(`The register of members prices shares at ${[...values].join(" and ")}; the members sheet carries one nominal value`);
  }
  return values.size === 1 ? [...values][0] : undefined;
}
