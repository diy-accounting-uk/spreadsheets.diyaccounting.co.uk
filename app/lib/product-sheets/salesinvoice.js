// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2006-2026 DIY Accounting Limited

// ── Sales invoice sample line (Salesinvoice.xlsx) ───────────────────────────
// The customer-facing invoice template has no external link into the rest of
// the book, so its own VAT rate is proved directly: the generator now writes
// the tax year's standard rate into Product Details!D2:D99 (generator.js),
// and this checks one sample invoice line, anchored to the fixture's own
// first sale, computes the right net, VAT and gross from it. Row 2 of
// Product Details already ships the template's own placeholder product code
// (A2 = 1001); this only sets its selling price. Business Details!B11 is the
// VAT registration number the invoice template itself gates its per-row VAT
// lookup on (verified against the XML: Invoice Template!N38 reads
// 'Product Details'!D:D only when O8, which reads 'Business Details'!B11, is
// not blank) -- an unregistered business is left untouched, the same as the
// template's own guidance for it. The invoice also carries a carriage charge
// (Invoice Database!E, the "Carriage Charge" column), which the template
// taxes separately from the product lines in Invoice Template!P62. That term
// used to read a literal 0.2; it now reads 'Product Details'!$D$2, the same
// cell every row of D2:D99 carries the tax year's rate into, so carriage is
// taxed at the written rate like every other line.
export const SALESINVOICE_VAT_REG_CELL = "B11";
// The same sheet's "Telephone" box, the entry cell beside its A8 label.
export const SALESINVOICE_TELEPHONE_CELL = "B8";
export const SALESINVOICE_SAMPLE_PRODUCT_CODE = 1001;
export const SALESINVOICE_SAMPLE_PRODUCT_ROW = 2;
export const SALESINVOICE_SAMPLE_CARRIAGE_CHARGE = 37.5;
export const SALESINVOICE_PRODUCT_DETAILS_COLUMNS = { code: "A", price: "C", vatRate: "D" };
export const SALESINVOICE_INVOICE_DATABASE_COLUMNS = {
  activate: "A",
  invoiceNumber: "B",
  carriage: "E",
  productCode1: "F",
  quantity1: "G",
};
export const SALESINVOICE_INVOICE_TEMPLATE_CELLS = { netTotal: "P58", carriageNet: "P60", vatTotal: "P62", grossTotal: "P64" };
export const SALESINVOICE_LINE1_CELLS = { productCode: "C38", unitPrice: "J38", quantity: "L38", lineNet: "P38", lineVat: "V38" };

// The Salesinvoice.xlsx writes for a scenario: the telephone number, and one
// sample invoice line for a VAT-registered business.
export function writeSalesinvoice(scenario, rate) {
  // Anchored to the fixture's own first sale so the customer-facing invoice
  // total and VAT can be checked against a real figure (see checkSalesinvoice).
  const salesinvoiceWrites = {};
  // The invoice's own letterhead carries the business telephone number,
  // which no other sheet in these workbooks has a box for.
  if (scenario.business?.phone) salesinvoiceWrites["Business Details"] = { [SALESINVOICE_TELEPHONE_CELL]: scenario.business.phone };
  const firstInvoiceSale = Object.values(scenario.sales || {}).flat()[0];
  if (rate > 0 && scenario.business?.vat_number && firstInvoiceSale) {
    salesinvoiceWrites["Business Details"] = {
      ...salesinvoiceWrites["Business Details"],
      [SALESINVOICE_VAT_REG_CELL]: scenario.business.vat_number,
    };
    salesinvoiceWrites["Invoice Database"] = {
      [`${SALESINVOICE_INVOICE_DATABASE_COLUMNS.activate}2`]: 1,
      [`${SALESINVOICE_INVOICE_DATABASE_COLUMNS.invoiceNumber}2`]: 1,
      [`${SALESINVOICE_INVOICE_DATABASE_COLUMNS.carriage}2`]: SALESINVOICE_SAMPLE_CARRIAGE_CHARGE,
      [`${SALESINVOICE_INVOICE_DATABASE_COLUMNS.productCode1}2`]: SALESINVOICE_SAMPLE_PRODUCT_CODE,
      [`${SALESINVOICE_INVOICE_DATABASE_COLUMNS.quantity1}2`]: 1,
    };
    salesinvoiceWrites["Product Details"] = {
      [`${SALESINVOICE_PRODUCT_DETAILS_COLUMNS.price}${SALESINVOICE_SAMPLE_PRODUCT_ROW}`]: firstInvoiceSale.amount,
    };
  }
  return salesinvoiceWrites;
}

// The customer-facing invoice against the tax year's own VAT rate.
export function checkSalesinvoice({ check, num }, results, expected, taxData, rate) {
  // Salesinvoice.xlsx carries no external link to the rest of the book, so a
  // wrong figure here never reaches the accounts -- it reaches the
  // customer's customer. The generator writes the tax year's standard rate
  // into Product Details!D2:D99 (generator.js); this checks the rate landed
  // and that the one sample invoice line, plus the invoice's carriage
  // charge, both compute their VAT correctly from it, hand-computed from the
  // fixture's own first sale and the sample carriage charge.
  const invoiceProductDetails = results["Salesinvoice.xlsx!Product Details"];
  const invoiceTemplate = results["Salesinvoice.xlsx!Invoice Template"];
  if (invoiceProductDetails && invoiceTemplate && taxData) {
    const standardRatePercent = Math.round(taxData.vat.standard_rate * 100);
    check(
      "Salesinvoice Product Details: VAT Rate = the tax year's standard rate",
      num(invoiceProductDetails[`${SALESINVOICE_PRODUCT_DETAILS_COLUMNS.vatRate}${SALESINVOICE_SAMPLE_PRODUCT_ROW}`]),
      standardRatePercent,
      0,
    );

    // cellWrites only puts the sample invoice line and carriage charge on the
    // sheet for a VAT-registered business (rate > 0 and a VAT number) --
    // otherwise Salesinvoice.xlsx keeps its blank template state, and these
    // five figures would have nothing to compare against.
    const firstInvoiceSale = Object.values(expected.sales || {}).flat()[0];
    if (rate > 0 && expected.business?.vat_number && firstInvoiceSale) {
      const expectedNet = firstInvoiceSale.amount;
      const expectedLineVat = (expectedNet * standardRatePercent) / 100;
      const expectedCarriageVat = (SALESINVOICE_SAMPLE_CARRIAGE_CHARGE * standardRatePercent) / 100;
      const expectedVatTotal = expectedLineVat + expectedCarriageVat;
      check(
        "Salesinvoice: line VAT = price x quantity x the tax year's standard rate",
        num(invoiceTemplate[SALESINVOICE_LINE1_CELLS.lineVat]),
        expectedLineVat,
        0.01,
      );
      check(
        "Salesinvoice: net total = the invoice's one line",
        num(invoiceTemplate[SALESINVOICE_INVOICE_TEMPLATE_CELLS.netTotal]),
        expectedNet,
        0.01,
      );
      check(
        "Salesinvoice: carriage charge lands on the invoice",
        num(invoiceTemplate[SALESINVOICE_INVOICE_TEMPLATE_CELLS.carriageNet]),
        SALESINVOICE_SAMPLE_CARRIAGE_CHARGE,
        0.01,
      );
      check(
        "Salesinvoice: VAT total = line VAT plus carriage VAT at the tax year's standard rate",
        num(invoiceTemplate[SALESINVOICE_INVOICE_TEMPLATE_CELLS.vatTotal]),
        expectedVatTotal,
        0.01,
      );
      check(
        "Salesinvoice: amount payable = net plus carriage plus VAT",
        num(invoiceTemplate[SALESINVOICE_INVOICE_TEMPLATE_CELLS.grossTotal]),
        expectedNet + SALESINVOICE_SAMPLE_CARRIAGE_CHARGE + expectedVatTotal,
        0.01,
      );
    }
  }
}
