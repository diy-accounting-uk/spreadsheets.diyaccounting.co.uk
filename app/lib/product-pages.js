// SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0
// Copyright (C) 2006-2026 DIY Accounting Limited
//
// product-pages.js — Pure functions that render one static page per spreadsheet product.

export const SITE = "https://spreadsheets.diyaccounting.co.uk";

const SUBMIT_URL = "https://submit.diyaccounting.co.uk/";
const SUBMIT_VAT_BLOCK = {
  heading: "File your VAT return with DIY Accounting Submit",
  text: "When your business is VAT registered, DIY Accounting Submit files your VAT return with HMRC under Making Tax Digital.",
  linkText: "Open DIY Accounting Submit",
};
const SUBMIT_COMPANY_BLOCK = {
  heading: "File your company filings with DIY Accounting Submit",
  text: "DIY Accounting Submit files micro-entity and small company accounts and the confirmation statement with Companies House, and sends VAT returns to HMRC under Making Tax Digital.",
  linkText: "Open DIY Accounting Submit",
};
const SUBMIT_GENERAL_BLOCK = {
  heading: "Filing with DIY Accounting Submit",
  text: "DIY Accounting Submit sends VAT returns to HMRC under Making Tax Digital. It also files micro-entity and small company accounts and the confirmation statement with Companies House.",
  linkText: "Open DIY Accounting Submit",
};

// What each workbook holds and who it suits, keyed by the product id in catalogue.toml.
export const PRODUCT_CONTENT = {
  BasicSoleTrader: {
    description:
      "Excel bookkeeping spreadsheet for UK sole traders not registered for VAT. Sales, purchases, profit and loss and tax return figures.",
    h1: "Basic Sole Trader Bookkeeping Spreadsheet",
    title: "Sole Trader Bookkeeping Spreadsheet for Excel (UK)",
    audience: "sole traders who are not VAT registered and have no employees",
    intro:
      "The simplest accounting package for sole traders who are not VAT registered and have no employees. Enter your sales and purchases in Excel and the workbook produces a profit and loss account and the figures for the short self-employed tax return.",
    holds: ["Sales spreadsheet", "Purchases spreadsheet", "Profit & loss account", "Self-employed tax return", "Income tax calculation"],
    submit: SUBMIT_VAT_BLOCK,
  },
  SelfEmployed: {
    description:
      "Excel bookkeeping spreadsheet for UK self-employed people. Sales, purchases, VAT returns, bank reconciliation and self assessment figures.",
    h1: "Self Employed Bookkeeping Spreadsheet",
    title: "Self Employed Accounts Spreadsheet for Excel (UK)",
    audience: "anyone self employed, VAT registered or not, with or without employees",
    intro:
      "Accounting software for anyone self employed, whether VAT registered or not, with or without employees. The workbooks produce both the short and full self-employed tax returns along with quarterly VAT returns.",
    holds: [
      "Sales spreadsheet",
      "Sales invoices",
      "Purchases spreadsheet",
      "Cash & bank reconciliation",
      "VAT returns",
      "Profit & loss account",
      "Self assessment tax return",
      "Payslips",
    ],
    submit: SUBMIT_VAT_BLOCK,
  },
  Company: {
    description:
      "Excel accounts spreadsheet for UK limited companies. Double-entry books, VAT returns, year-end accounts and CT600 corporation tax figures.",
    h1: "Limited Company Accounts Spreadsheet",
    title: "Limited Company Accounts Spreadsheet for Excel (UK)",
    audience: "limited companies, VAT registered or not, with or without employees",
    intro:
      "Small business accounting software for limited liability companies, whether VAT registered or not, with or without employees. It uses double-entry bookkeeping and produces quarterly VAT returns, profit and loss accounts, balance sheets, year-end accounts for Companies House, and CT600 corporation tax calculations.",
    holds: [
      "Sales spreadsheet",
      "Sales invoices",
      "Purchases spreadsheet",
      "Cash & bank reconciliation",
      "VAT returns",
      "Profit & loss account",
      "Balance sheet",
      "Final accounts",
      "Corporation tax (CT600)",
      "Fixed assets & capital allowances",
      "Payslips (5, 10, or 20 employees)",
    ],
    submit: SUBMIT_COMPANY_BLOCK,
  },
  TaxiDriver: {
    description:
      "Excel bookkeeping spreadsheet for UK taxi and private hire drivers. Compares mileage allowance with actual vehicle costs for your tax claim.",
    h1: "Taxi Driver Bookkeeping Spreadsheet (Cabsmart)",
    title: "Taxi Driver Accounts Spreadsheet for Excel (UK)",
    audience: "self-employed taxi drivers, private hire drivers, van drivers and couriers",
    intro:
      "Bookkeeping software designed for self-employed taxi drivers, private hire drivers, van drivers and couriers. It compares the mileage allowance against your actual vehicle running costs and selects the most tax-efficient method for your expenses claim.",
    holds: [
      "Income & expenses tracking",
      "Mileage allowance calculation",
      "Vehicle expense comparison",
      "Profit & loss account",
      "Self-employed tax return",
      "Fixed assets & capital allowances",
      "Income tax estimation",
    ],
    submit: SUBMIT_VAT_BLOCK,
  },
  Payslip05: {
    description:
      "Excel payslip spreadsheet for UK employers with 5 or 10 staff. Prints payslips with running yearly totals, alongside HMRC Basic PAYE Tools.",
    h1: "Payslip Spreadsheet for Small Employers",
    title: "Payslip Template for Excel (UK, up to 10 Staff)",
    audience: "small employers who use a separate tax calculator such as HMRC's Basic PAYE Tools",
    intro:
      "A payslip generator for businesses that use a separate tax calculator such as HMRC's Basic PAYE Tools. Enter the tax and National Insurance figures and the spreadsheet prints payslips on plain paper with a running total of wages and deductions through the year.",
    holds: [
      "Weekly or monthly payslips",
      "Plain paper printing",
      "Running yearly totals",
      "Compatible with HMRC Basic PAYE Tools",
      "Available for 5 or 10 employees",
    ],
    submit: SUBMIT_GENERAL_BLOCK,
  },
};

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// "Payslip 05" -> "payslip-05"
export function productSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function productPagePath(product) {
  return `products/${productSlug(product.name)}.html`;
}

export function buildProductPageHtml(product) {
  const content = PRODUCT_CONTENT[product.id];
  if (!content) {
    throw new Error(`product-pages: no page content for product id "${product.id}"`);
  }
  const e = escapeHtml;
  const url = `${SITE}/${productPagePath(product)}`;
  const title = `${content.title} - DIY Accounting Spreadsheets`;
  const downloadHref = `../download.html?product=${encodeURIComponent(product.id)}`;
  const submitHref = `${SUBMIT_URL}?utm_source=spreadsheets&utm_medium=product-page&utm_campaign=${encodeURIComponent(productSlug(product.name))}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": `DIY Accounting ${product.name} Spreadsheet`,
    "description": content.description,
    url,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Microsoft Excel",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "GBP", "url": `${SITE}/download.html?product=${product.id}` },
    "publisher": { "@type": "Organization", "name": "DIY Accounting Limited", "url": "https://diyaccounting.co.uk" },
  };
  const holds = content.holds.map((item) => `            <li>${e(item)}</li>`).join("\n");
  return `<!doctype html>
<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${e(title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${e(content.description)}" />
    <link rel="icon" type="image/svg+xml" href="../favicon.svg" />
    <link rel="icon" type="image/x-icon" href="../favicon.ico" />
    <link rel="canonical" href="${url}" />
    <link rel="stylesheet" href="../spreadsheets.css" />
    <script src="../lib/analytics.js"></script>
    <script src="../lib/consent-banner.js"></script>
  </head>
  <body>
    <a href="#mainContent" class="skip-link">Skip to main content</a>
    <nav class="top-nav" aria-label="Main navigation">
      <a href="../index.html" class="nav-current">Products</a>
      <a href="https://diya-gl.co.uk/">DIYA-GL</a>
      <a href="../download.html">Download</a>
      <a href="../knowledge-base.html">Knowledge Base</a>
      <a href="../community.html">Community</a>
      <a href="https://submit.diyaccounting.co.uk">Submit VAT MTD</a>
      <a href="../donate.html">Donate</a>
    </nav>
    <header>
      <h1>DIY Accounting Spreadsheets</h1>
      <p class="subtitle">Excel bookkeeping and accounting software for UK small businesses</p>
    </header>
    <main id="mainContent">
      <nav class="nav-back" aria-label="Breadcrumb">
        <a href="../index.html">&larr; Back to products</a>
      </nav>
      <article class="kb-article">
        <h2>${e(content.h1)}</h2>
        <p>${e(content.intro)}</p>
        <p>Made for ${e(content.audience)}. It works in Microsoft Excel and OpenOffice Calc.</p>
        <h3>What the workbook holds</h3>
        <ul>
${holds}
        </ul>
        <p>
          The spreadsheets are free to download and funded by voluntary <a href="../donate.html">donations</a>. Each download is one
          accounting period, so pick the year end that matches your accounts.
        </p>
        <p class="product-action"><a href="${downloadHref}" class="btn-download">Download ${e(product.name)}</a></p>
        <h3>${e(content.submit.heading)}</h3>
        <p>
          ${e(content.submit.text)}
          <a href="${e(submitHref)}">${e(content.submit.linkText)}</a>.
        </p>
      </article>
    </main>
    <footer>
      <div class="footer-content">
        <div class="footer-left">
          <a href="https://diyaccounting.co.uk">diyaccounting.co.uk</a>
          <a href="../knowledge-base.html">knowledge base</a>
          <a href="https://submit.diyaccounting.co.uk/privacy.html">privacy</a>
          <a href="https://submit.diyaccounting.co.uk/terms.html">terms</a>
          <a href="https://submit.diyaccounting.co.uk/accessibility.html">accessibility</a>
        </div>
        <div class="footer-center">
          <p>&copy; 2025-2026 DIY Accounting Limited</p>
        </div>
      </div>
    </footer>
    <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)
  .split("\n")
  .map((l) => `      ${l}`)
  .join("\n")}
    </script>
  </body>
</html>
`;
}
