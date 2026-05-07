# spreadsheets.diyaccounting.co.uk

Spreadsheet download site for [DIY Accounting](https://spreadsheets.diyaccounting.co.uk) — free Excel bookkeeping spreadsheets for UK sole traders, self-employed, and small companies.

# diy-accounting

This is the home of DIY Accounting's community edition spreadsheet based packages. Formerly, these DIY Accounting
spreadsheets were distributed as a set of proprietary products, owned by DIY Accounting Limited and created by
Terry Cartwright in the early 2000s. The spreadsheets are now Open Source and released under the Mozilla Public
License Version 2.0. See: https://www.mozilla.org/en-US/MPL/2.0/

# The relationship to DIY Accounting Limited

https://www.diyaccounting.co.uk/

DIY Accounting Limited continues to maintain these packages and remains a for-profit company. DIY Accounting Limited
shall be releasing new proprietary products in the future and if you wish to help with our running costs while we do
this, you can click the sponsor link above or send a donation here:
https://www.paypal.com/donate/?hosted_button_id=XTEQ73HM52QQW

# Getting help with DIY Accounting

As proprietary software support was supplied by email and staffed part-time. There is no longer a support service and
users are encouraged to start a discussion here: https://github.com/support-at-diyaccounting/spreadsheets.diyaccounting.co.uk/discussions or raise
an issue here https://github.com/support-at-diyaccounting/spreadsheets.diyaccounting.co.uk/issues .

## Architecture

- **AWS CDK** (Java) deploys an S3 + CloudFront static site with OAC
- **CloudFront Function** handles URL redirects from the old www site (generated from `redirects.toml`)
- **DNS** is managed separately by the [root.diyaccounting.co.uk](https://github.com/support-at-diyaccounting/root.diyaccounting.co.uk) repository
- **Account**: spreadsheets (`064390746177`) in the DIY Accounting AWS Organization

## Related Repositories

| Repository | Purpose |
|-----------|---------|
| [root.diyaccounting.co.uk](https://github.com/support-at-diyaccounting/root.diyaccounting.co.uk) | Route53 DNS records |
| [submit.diyaccounting.co.uk](https://github.com/support-at-diyaccounting/submit.diyaccounting.co.uk) | Submit VAT MTD application |

## Updating and Publishing Packages

### Annual Tax Data Update

1. Create or update tax data TOML files in `app/data/` for the new financial year (sole trader files use `se-YYYY-YYYY.toml`, limited company files use `ltd-YYYY.toml`)
2. Use the `update-tax-data.yml` workflow (scrapes HMRC rates and generates TOML via Copilot), a Copilot agent, or manual update (see `SKILL_PACKAGE_UPDATES.md`)
3. Push changes — generation workflows trigger automatically on changes to `app/data/`

### Package Generation

- **Automatic**: pushing changes to `app/data/`, `app/templates/`, or product files (`app/products/`) triggers the relevant generation workflows
- **Manual**: dispatch `generate-bst.yml`, `generate-se.yml`, `generate-taxi.yml`, or `generate-ltd.yml` from the Actions tab
- **Each workflow**: runs tests, generates packages, reconciles per year-end in parallel, then commits generated packages and reports back to the repo
- BST and Taxi use `app/data/se-*` files; Ltd uses `app/data/ltd-*` files

### Deployment

- Push to `main` triggers `deploy.yml` which deploys the CDK stack (S3 + CloudFront) and syncs zip packages to S3
- Packages are zipped by `build-packages.cjs` (from `packages/` into `target/zips/`) and uploaded alongside the static site
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

AGPL-3.0-only. Copyright (C) 2025-2026 DIY Accounting Ltd.
