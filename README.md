<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# spreadsheets.diyaccounting.co.uk

Spreadsheet download site for [DIY Accounting](https://spreadsheets.diyaccounting.co.uk) — free Excel bookkeeping spreadsheets for UK sole traders, self-employed, and small companies.

# diy-accounting

This is the home of DIY Accounting Spreadsheets™, spreadsheet-based packages for UK bookkeeping and accounts. Terry
Cartwright built the original spreadsheets in the early 2000s, and DIY Accounting Limited has maintained and extended
them since. They are free to use, source available, under the PolyForm Internal Use License 1.0.0 — see the License
section below.

# The relationship to DIY Accounting Limited

https://www.diyaccounting.co.uk/

DIY Accounting Limited continues to maintain these packages and remains a for-profit company. DIY Accounting Limited
will keep releasing new products, and if you wish to help with our running costs while we do this, you can click the
sponsor link above or send a donation here:
https://www.paypal.com/donate/?hosted_button_id=XTEQ73HM52QQW

# Getting help with DIY Accounting

Email support@diyaccounting.co.uk, or raise an issue here:
https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk/issues.

## Architecture

- **AWS CDK** (Java) deploys an S3 + CloudFront static site with OAC
- **CloudFront Function** handles URL redirects from the old www site (generated from `redirects.toml`)
- **DNS** is managed separately by the [root.diyaccounting.co.uk](https://github.com/diy-accounting-uk/root.diyaccounting.co.uk) repository
- **Account**: spreadsheets (`064390746177`) in the DIY Accounting AWS Organization

## Related Repositories

| Repository | Purpose |
|-----------|---------|
| [root.diyaccounting.co.uk](https://github.com/diy-accounting-uk/root.diyaccounting.co.uk) | Route53 DNS records |
| [submit.diyaccounting.co.uk](https://github.com/diy-accounting-uk/submit.diyaccounting.co.uk) | Submit VAT MTD application |

## Updating and Publishing Packages

### Annual Tax Data Update

1. Create or update tax data TOML files in `app/data/` for the new financial year (sole trader files use `se-YYYY-YYYY.toml`, limited company files use `ltd-YYYY.toml`)
2. Run `npm run update-tax-data` to scrape HMRC rates and generate TOML via Copilot, use a Copilot agent, or update manually (see `.claude/skills/package-updates/SKILL.md`)
3. Push changes. Generation workflows trigger automatically on changes to `app/data/`

### Package Generation

- **Automatic**: pushing changes to `app/data/`, `app/templates/`, or product files (`app/products/`) triggers the relevant generation workflows
- **Manual**: dispatch `generate-bst.yml`, `generate-se.yml`, `generate-taxi.yml`, or `generate-ltd.yml` from the Actions tab
- **Each workflow**: runs tests, generates packages, reconciles per year-end in parallel, then commits generated packages and reports back to the repo
- BST and Taxi use `app/data/se-*` files; Ltd uses `app/data/ltd-*` files

### Deployment

- Push to `main` triggers `deploy.yml` which deploys the CDK stack (S3 + CloudFront) and syncs zip packages to S3
- Packages are zipped by `app/bin/build-packages.js` (from `packages/` into `target/zips/`) and uploaded alongside the static site
- The workflow checks that all reconciliation reports in `reports/` show RECONCILES before deploying

### Dependency Updates

- Daily `update.yml` workflow runs formatting fixes, node dependency updates, and java dependency updates in parallel, validates with tests and Maven verify, then commits
- Manual: `npm run update:node`, `npm run update:java`, `npm run formatting-fix`

### Reconciliation

- Each generation workflow runs parallel per-year-end reconciliation (basic/extended scenarios for BST and SE, basic for Taxi, full for Ltd)
- Ltd supports a `reconcile-all` input for full historical reconciliation (otherwise limited to the latest 24 months)
- Reports are committed to `reports/` and checked by the deploy workflow before deployment
- See `SKILL_EXCEL.md` for testing approaches

### Reference Documentation

- `CONTEXT_BASIC_SOLE_TRADER.md`, `CONTEXT_TAXI.md`, `CONTEXT_SELF_EMPLOYED.md`, `CONTEXT_LIMITED_COMPANY.md` — product-specific details
- `SKILL_EXCEL.md` — Excel manipulation techniques and testing
- `SKILL_PACKAGE_UPDATES.md` — annual update process

## License

Three licences cover this repository, by layer:

- The spreadsheets, packages and this site: [PolyForm Internal Use License 1.0.0](LICENSE), with an additional grant
  for accountants preparing clients' accounts. Free to use, source available. No redistribution, and no hosting a
  copy — modified or not — under another name. Running on localhost is fine.
- The DIYA-GL engine (`diya-gl/`): Apache-2.0.
- The DIYA-GL specification text: CC BY 4.0. Its schemas: Apache-2.0.

See `LICENSING.md` for the file-by-file map. Copyright (C) 2006-2026 DIY Accounting Limited.

This repository does not accept contributions. Email support@diyaccounting.co.uk if you find a bug or want to raise
something.
