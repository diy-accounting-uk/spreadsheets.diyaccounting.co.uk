#!/usr/bin/env node
// Generate URLs to HMRC pages most likely to contain current and recent tax rates.
// Usage: node scripts/hmrc-rate-urls.cjs [year]
// If year not given, uses the current calendar year.
// Output: one URL per line, suitable for piping to a scraper.

const year = parseInt(process.argv[2], 10) || new Date().getFullYear();

const urls = [];

for (let y = year - 5; y <= year; y++) {
  const budgetSlug = y <= 2024 ? `autumn-statement-${y}` : `budget-${y}`;
  urls.push(`https://www.gov.uk/government/publications/${budgetSlug}-overview-of-tax-legislation-and-rates-ootlar/annex-a-rates-and-allowances`);
}

urls.push(`https://www.gov.uk/government/publications/rates-and-allowances-corporation-tax/rates-and-allowances-corporation-tax`);
urls.push(`https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past`);
urls.push(`https://www.gov.uk/government/publications/rates-and-allowances-national-insurance-contributions/rates-and-allowances-national-insurance-contributions`);
urls.push(`https://www.gov.uk/government/publications/rates-and-allowances-capital-allowances/rates-and-allowances-capital-allowances`);
urls.push(`https://www.gov.uk/guidance/rates-and-thresholds-for-employers-${year}-to-${year + 1}`);
urls.push(`https://www.gov.uk/guidance/rates-and-thresholds-for-employers-${year - 1}-to-${year}`);
urls.push(`https://www.gov.uk/income-tax-rates`);
urls.push(`https://www.gov.uk/self-employed-national-insurance-rates`);
urls.push(`https://www.gov.uk/vat-registration/when-to-register`);
urls.push(`https://www.gov.uk/guidance/corporation-tax-marginal-relief`);
urls.push(`https://www.gov.uk/capital-allowances`);
urls.push(`https://www.gov.uk/expenses-and-benefits-business-travel-mileage/rules-for-tax`);

for (const url of urls) {
  console.log(url);
}
