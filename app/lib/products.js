// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 DIY Accounting Ltd
//
// products.js — the four product modules diya-gl carries, addressed by
// their short id. Browser-safe: nothing here touches fs or any Node
// builtin, so this loads in the books bundle exactly as it does under Node.

import * as bst from "../products/bst.js";
import * as taxi from "../products/taxi.js";
import * as se from "../products/se.js";
import * as ltd from "../products/ltd.js";

export const PRODUCTS = { bst, taxi, se, ltd };

/**
 * The product module for a short id.
 *
 * @param {string} id
 * @returns {Object} the product module (CELL_MAP, PRODUCT, cellWrites, ...)
 */
export function productModule(id) {
  const productMod = PRODUCTS[id];
  if (!productMod) {
    throw new Error(`Unknown product "${id}"; the products diya-gl carries are ${Object.keys(PRODUCTS).join(", ")}`);
  }
  return productMod;
}
