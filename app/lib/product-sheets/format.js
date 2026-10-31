// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

import { canonicalForUnit } from "../canonical-report-value.js";

export function fmt(v, unit = "money") {
  if (v === null || v === undefined || v === "" || v === " ") return "—";
  if (typeof v === "number") {
    const canonical = Number(canonicalForUnit(v, unit));
    // A nil that arrived by negation carries a sign bit and prints as "-0",
    // which reads as a defect in a statement.
    return (canonical === 0 ? 0 : canonical).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return String(v);
}
