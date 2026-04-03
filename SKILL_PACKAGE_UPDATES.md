# Skill: Annual Tax Data Updates and Package Publishing

How to update tax data for a new financial year and publish updated spreadsheet packages.

## What Changes Year to Year

Tax data files encode the UK tax rates, thresholds, and allowances that are injected into the Admin sheets of generated spreadsheets. The following values are subject to annual change:

**Income Tax**
- Personal allowance (frozen at 12,570 since 2021-22, scheduled until 2027-28)
- Basic rate band end (frozen at 37,700 since 2021-22)

**National Insurance (Self-Employment)**
- Class 2 rate and weekly rate (abolished from 2024-25 onwards)
- Class 4 lower rate (was 9%, blended 9.73% in 2022-23, cut to 6% from 2024-25)
- Class 4 lower/upper profit limits
- Class 4 upper rate (was 2%, blended 2.73% in 2022-23, back to 2% from 2023-24)

**National Insurance (Employers, Ltd only)**
- Employer NI rate (was 13.8%, increased to 15% from April 2025)
- Secondary threshold (was 9,100, reduced to 5,000 from April 2025)
- Employment allowance (was 5,000, increased to 10,500 from April 2025)

**Corporation Tax (Ltd only)**
- Main rate (was 19% flat pre-FY2023, now 25% with marginal relief)
- Small profits rate (19%) and limits (50,000 / 250,000)
- Marginal relief fraction (3/200 = 0.015)

**Capital Allowances**
- Annual Investment Allowance (stored as 1.00 = 100%, monetary limit of 1,000,000 not stored)
- Writing Down Allowance main pool (was 18%, reduced to 14% from FY2026)
- Writing Down Allowance special rate pool (6%)
- Full expensing rate (introduced FY2023 for companies)

**VAT**
- Registration threshold (was 85,000 until April 2024, now 90,000)
- Standard rate (20%, rarely changes)

**Dividend Tax (Ltd only)**
- Dividend allowance (2,000 pre-2023, 1,000 in 2023-24, 500 from 2024-25)
- Dividend tax rates at basic/higher/additional bands

**Mileage and Depreciation**
- Mileage rates (45p/25p, unchanged for many years)
- Depreciation rates (unchanged for many years)

### Files Needed for a New Year

For a new tax year (e.g. 2027-28), create:
- `app/data/se-2027-2028.toml` -- covers BST, SE, and Taxi products
- `app/data/ltd-2028.toml` -- covers Ltd product (named by the year the Financial Year ends)

## Tax Data Files

### SE Data: `app/data/se-YYYY-YYYY.toml`

Covers BST (Basic Sole Trader), SE (Self Employed), and Taxi Driver products. Uses the tax year (6 April to 5 April).

Current files: `se-2020-2021.toml` through `se-2026-2027.toml`

```toml
# UK self-employment tax rates and thresholds for the 2025-26 tax year
# Period: 6 April 2025 - 5 April 2026
# Source: HMRC

[tax_year]
label = "2025-26"            # Display label
next_label = "2026-27"       # Next year label (for UI)
start = 2025-04-06           # Bare TOML date, no quotes
end = 2026-04-05

[income_tax]
personal_allowance = 12570   # Annual personal allowance
starting_rate = 0.00         # Starting rate for savings
basic_rate = 0.20            # Basic rate
higher_rate = 0.40           # Higher rate
starter_band_end = 0         # Scottish starter band (0 for rest of UK)
basic_band_end = 37700       # Basic rate band ceiling
higher_band_start = 37701    # Higher rate band floor

[national_insurance]
class2_rate = 0              # Class 2 weekly rate (0 = abolished)
class4_lower_rate = 0.06     # Class 4 rate on profits in lower band
class4_lower_limit = 12570   # Class 4 lower profits limit
class4_upper_rate = 0.02     # Class 4 rate above upper limit
class4_upper_limit = 50270   # Class 4 upper profits limit
class2_weekly_rate = 0       # Weekly Class 2 amount (0 = abolished)

[capital_allowances]
annual_investment_allowance = 1.00   # 100% = full AIA
writing_down_allowance = 0.18       # WDA main pool rate
motor_vehicle_cost_threshold = 12000 # MV cost threshold
motor_vehicle_restriction = 3000     # MV annual restriction

[depreciation]
land_and_property = 0.00
plant_and_machinery = 0.10
fixtures_and_fittings = 0.20
computer_equipment = 0.33
motor_vehicles = 0.25

[mileage]
higher_rate_limit = 10000    # Miles at higher rate
higher_rate_pence = 0.45     # Rate per mile (first 10,000)
lower_rate_start = 10001     # Miles where lower rate starts
lower_rate_pence = 0.25      # Rate per mile (after 10,000)

[vat]
registration_threshold = 90000
standard_rate = 0.20
```

### Ltd Data: `app/data/ltd-YYYY.toml`

Covers Ltd (Limited Company) products. Uses the Financial Year (1 April to 31 March). The filename year is the year the FY starts (e.g. `ltd-2026.toml` covers FY2026 = 1 Apr 2026 to 31 Mar 2027).

Current files: `ltd-2020.toml` through `ltd-2027.toml`

Ltd files have all the sections from SE files plus:

```toml
[financial_year]
label = "FY2026"
start = 2026-04-01
end = 2027-03-31

[corporation_tax]
main_rate = 0.25
small_profits_rate = 0.19
small_profits_limit = 50000
main_rate_limit = 250000
marginal_relief_fraction = 0.015   # 3/200

[capital_allowances]
annual_investment_allowance = 1.00
writing_down_allowance_main = 0.14   # Changed from 0.18 to 0.14 at FY2026
writing_down_allowance_special = 0.06
full_expensing_rate = 1.00           # Companies only, main pool P&M
motor_vehicle_cost_threshold = 12000
motor_vehicle_restriction = 3000

[employer_ni]
rate = 0.15                  # Employer NI rate
secondary_threshold = 5000   # Secondary threshold per employee
employment_allowance = 10500 # Employment allowance

[dividend_tax]
allowance = 500              # Annual dividend allowance
basic_rate = 0.0875          # 8.75%
higher_rate = 0.3375         # 33.75%
additional_rate = 0.3935     # 39.35%
```

Note: SE files use `[tax_year]` with `label = "2025-26"`, while Ltd files use `[financial_year]` with `label = "FY2026"`. SE files have a single `writing_down_allowance`, while Ltd files have `writing_down_allowance_main` and `writing_down_allowance_special`.

## Updating Tax Data

### Option 1: GitHub Actions Workflow (update-tax-data.yml)

The `update-tax-data.yml` workflow automates tax data creation by scraping HMRC pages and using an LLM to generate TOML files.

**How it works:**
1. Runs `scripts/hmrc-rate-urls.cjs` to generate a list of HMRC URLs for the target year
2. Scrapes each HMRC page and extracts text content (up to 50,000 chars per page)
3. Identifies which TOML files are missing (checks back 5 years from the target year)
4. Concatenates scraped data with the agent prompt from `.github/agents/tax-data-updater.agent.md`
5. Calls `gh copilot` with GPT-5-mini to generate the missing TOML files
6. Validates all TOML files parse correctly
7. Runs `npm test`
8. Commits and pushes new files

**How to trigger:**
- Go to Actions > update-tax-data > Run workflow
- Optional: set `year` (defaults to current calendar year)
- Optional: enable `dry-run` to skip the commit step

**Limitation:** Uses GPT-5-mini via `gh copilot` which may produce inaccurate rates. Always verify the generated values against the HMRC source pages before merging.

**What it produces:** New or updated TOML files committed directly to the branch. Artifacts include the scraped HMRC data and LLM response for audit.

### Option 2: GitHub Copilot Agent (tax-data-updater.agent.md)

The `.github/agents/tax-data-updater.agent.md` file defines a Copilot coding agent that can research HMRC rates and create TOML files with full traceability.

**How it works:** The agent reads existing data files to understand the schema, visits HMRC GOV.UK pages to find published rates, creates missing TOML files, and updates `SOURCES.md` and `REPORT_TRACEABILITY.md`.

**Advisable to select a premium model** for accuracy when using Copilot agents.

**Prompt to use (from the agent file):**

```
Please locate tax data for the coming financial year 2026 -2027 and update SOURCES.md and extend app/data and refresh REPORT_TRACEABILITY.md.
Also add any new but missing tax years to .github/workflows/generate-bst.yml
```

(Adjust the year as needed.)

**What it produces:** A branch named `copilot/tax-data-{tax-year-label}` with new TOML files, updated SOURCES.md, and updated REPORT_TRACEABILITY.md.

### Option 3: Manual Update

1. **Copy the previous year's TOML file:**
   - For SE: `cp app/data/se-2026-2027.toml app/data/se-2027-2028.toml`
   - For Ltd: `cp app/data/ltd-2027.toml app/data/ltd-2028.toml`

2. **Update the metadata section:**
   - Change label, start date, end date, next_label

3. **Update rates from HMRC Budget announcements.** Key sources are listed in the next section.

4. **Validate:**
   ```bash
   npm test
   ```

5. **Commit and push** to trigger generation workflows.

## HMRC Rate Sources

The `scripts/hmrc-rate-urls.cjs` script generates the following URLs (with year-specific variants):

### Budget OOTLAR Annex A (Rates and Allowances)
For each of the last 6 years, the script generates:
- `https://www.gov.uk/government/publications/autumn-statement-{YYYY}-overview-of-tax-legislation-and-rates-ootlar/annex-a-rates-and-allowances` (for years up to 2024)
- `https://www.gov.uk/government/publications/budget-{YYYY}-overview-of-tax-legislation-and-rates-ootlar/annex-a-rates-and-allowances` (for 2025 onwards)

These are the most comprehensive single-page source for all rates announced in each Budget.

### Standing Reference Pages
- **Corporation Tax rates**: https://www.gov.uk/government/publications/rates-and-allowances-corporation-tax/rates-and-allowances-corporation-tax
- **Income Tax rates** (current and past): https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past
- **NI contributions**: https://www.gov.uk/government/publications/rates-and-allowances-national-insurance-contributions/rates-and-allowances-national-insurance-contributions
- **Capital allowances**: https://www.gov.uk/government/publications/rates-and-allowances-capital-allowances/rates-and-allowances-capital-allowances
- **Employer rates and thresholds** (year-specific): https://www.gov.uk/guidance/rates-and-thresholds-for-employers-{YYYY}-to-{YYYY+1}
- **Income tax rates** (simplified): https://www.gov.uk/income-tax-rates
- **Self-employed NI rates**: https://www.gov.uk/self-employed-national-insurance-rates
- **VAT registration threshold**: https://www.gov.uk/vat-registration/when-to-register
- **Corporation Tax marginal relief**: https://www.gov.uk/guidance/corporation-tax-marginal-relief
- **Capital allowances** (overview): https://www.gov.uk/capital-allowances
- **Mileage rates**: https://www.gov.uk/expenses-and-benefits-business-travel-mileage/rules-for-tax

## Key Rate Changes by Year

| Rate / Threshold | FY2022 / 2022-23 | FY2023 / 2023-24 | FY2024 / 2024-25 | FY2025 / 2025-26 | FY2026 / 2026-27 |
|---|---|---|---|---|---|
| CT main rate | 19% flat | 25% (new) | 25% | 25% | 25% |
| CT small profits | 19% (no distinction) | 19% (new tier) | 19% | 19% | 19% |
| Marginal relief | N/A | 3/200 (new) | 3/200 | 3/200 | 3/200 |
| Full expensing | N/A | 100% (new) | 100% | 100% | 100% |
| WDA main pool (Ltd) | 18% | 18% | 18% | 18% | **14%** |
| WDA special (Ltd) | 6% | 6% | 6% | 6% | 6% |
| WDA (SE) | 18% | 18% | 18% | 18% | 18% |
| Employer NI rate | 13.8% | 13.8% | 13.8% | **15%** | 15% |
| Employer NI threshold | 9,100 | 9,100 | 9,100 | **5,000** | 5,000 |
| Employment allowance | 5,000 | 5,000 | 5,000 | **10,500** | 10,500 |
| Class 4 NI lower | 9.73% (blended) | 9% | **6%** | 6% | 6% |
| Class 4 NI upper | 2.73% (blended) | 2% | 2% | 2% | 2% |
| Class 2 NI weekly | 3.15 | 3.45 | **0 (abolished)** | 0 | 0 |
| Class 4 lower limit | 11,908 | 12,570 | 12,570 | 12,570 | 12,570 |
| VAT threshold | 85,000 | 85,000 | **90,000** | 90,000 | 90,000 |
| Dividend allowance | 2,000 | **1,000** | **500** | 500 | 500 |
| Personal allowance | 12,570 | 12,570 | 12,570 | 12,570 | 12,570 |
| Basic band end | 37,700 | 37,700 | 37,700 | 37,700 | 37,700 |

Bold indicates a change from the previous year.

## Publishing Updated Packages

### How Generation Workflows Trigger

Each product has its own generation workflow that triggers automatically when data files or templates change:

| Workflow | Trigger paths | Product |
|---|---|---|
| `generate-bst.yml` | `app/data/se-*`, `app/templates/bst/**`, `app/products/bst.js` | Basic Sole Trader |
| `generate-se.yml` | `app/data/se-*`, `app/templates/se/**`, `app/products/se.js` | Self Employed |
| `generate-taxi.yml` | `app/data/se-*`, `app/templates/taxi/**`, `app/products/taxi.js` | Taxi Driver |
| `generate-ltd.yml` | `app/data/ltd-*`, `app/templates/ltd/**`, `app/products/ltd.js` | Limited Company |

All four also run on a daily schedule and can be triggered manually via workflow_dispatch.

### Generation Pipeline (per product)

1. **Test** -- runs `npm test` to validate data files and templates
2. **Generate** -- runs `npm run generate -- --package {product}`, produces Excel workbooks + PDF guides in `packages/`
3. **Reconcile** -- populates workbooks with test scenarios using LibreOffice, runs reconciliation checks. Each year-end is reconciled as a separate matrix job.
4. **Commit** -- commits generated `packages/`, `reports/`, and `examples/` back to the branch

### Deploy Workflow (deploy.yml)

The deploy workflow triggers on pushes to paths under `web/spreadsheets.diyaccounting.co.uk/` and infrastructure files. It does NOT trigger on `packages/` changes directly; instead, the `build:packages` step in the deploy workflow runs `scripts/build-packages.cjs` which:
1. Scans `packages/` directories for Excel workbooks
2. Creates zip archives in `target/zips/`
3. Generates `web/spreadsheets.diyaccounting.co.uk/public/catalogue.toml`

The deploy workflow then:
1. Checks all reconciliation reports are RECONCILES (no ANOMALYDETECTED)
2. Deploys CDK stack (S3 + CloudFront)
3. Uploads zip packages to S3 via `aws s3 sync target/zips/ s3://{bucket}/zips/ --delete`
4. Runs Playwright behaviour tests against the deployed environment

On `main`, this deploys to production. On other branches, it deploys to CI.

### End-to-End Flow

```
1. Create/update TOML file     -->  app/data/se-YYYY-YYYY.toml or ltd-YYYY.toml
2. Push to branch               -->  triggers generate-{bst,se,taxi,ltd}.yml
3. Workbooks generated          -->  packages/ directory populated
4. Reconciliation passes        -->  reports/ confirm RECONCILES
5. Packages committed           -->  packages/ pushed to branch
6. Merge to main                -->  triggers deploy.yml
7. CDK deploy + S3 sync         -->  zips uploaded to spreadsheets.diyaccounting.co.uk
8. Behaviour tests              -->  verify live site download page works
```

### How to Verify

- **Reconciliation reports**: check `reports/*.md` for `Status: RECONCILES` on all packages
- **CI matrix**: each year-end is reconciled independently; failures show as red matrix cells in the Actions UI
- **Live site**: visit `spreadsheets.diyaccounting.co.uk/download.html` and confirm the new year-end appears in the dropdown
- **Download test**: download a zip and verify the workbook opens and Admin sheet contains correct rates

### Dependency Updates (update.yml)

The `update.yml` workflow runs daily and handles Node/Java dependency updates and formatting. It does not touch tax data files, but updated dependencies could affect generation or reconciliation. If dependency updates break generation, the daily schedule on generate workflows will surface the failure.
