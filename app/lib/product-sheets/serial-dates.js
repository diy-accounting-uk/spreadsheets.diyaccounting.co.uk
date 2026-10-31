// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// The date an Excel serial stands for.
export function excelSerialToUtcDate(serial) {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.round(serial) * 24 * 60 * 60 * 1000);
}

export function formatSerialDate(serial) {
  return excelSerialToUtcDate(serial).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
}

// The " (period ending d Month yyyy)" a VAT return line carries, or nothing
// at all when the form has no date on it.
export function periodEnding(serial) {
  return serial ? ` (period ending ${formatSerialDate(serial)})` : "";
}
