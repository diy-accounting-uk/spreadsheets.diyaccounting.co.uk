// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// Matches [vat].standard_rate in the product tax data files. The analysis
// columns of the Sales, Purchases and Fixedassets workbooks all hold figures
// net of VAT, so a scenario's gross amount is converted with this rate.
export const VAT_RATE = 0.2;

// A scenario says whether the business is registered in its own metadata.
// Anything that does not say is registered, which is what every fixture
// written before the flag existed means.
export function vatRateFor(scenario) {
  return scenario?.metadata?.vat_registered === false ? 0 : VAT_RATE;
}

export function netOfVat(gross, rate = VAT_RATE) {
  return Math.round((gross / (1 + rate)) * 100) / 100;
}

// A journal row takes its own VAT off its own gross and rounds nothing
// (template: H = G * rate / (100 + rate), I = G - H), and the analysis
// columns the statements read sum those row figures. Netting an annual
// total instead leaves pennies behind, so the netting table sums per entry
// the same way the sheet does.
export function sheetNetOfVat(gross, rate) {
  return gross - (gross * rate) / (1 + rate);
}
