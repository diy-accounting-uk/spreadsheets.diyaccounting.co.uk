---
name: Tax Data Updater
description: Research current HMRC tax rates, update SOURCES.md, create new app/data TOML files, and generate a traceability report.
---
# Tax Data Updater Agent

Purpose: Keep the tax data files in `app/data/` current by researching HMRC published rates and thresholds, updating `SOURCES.md` with new reference links, creating TOML data files for any tax years not yet covered, and updating `REPORT_TRACEABILITY.md`.

Run using a prompt like:
```
Please locate tax data for the coming financial year 2026 -2027 and update SOURCES.md and extend app/data and refresh REPORT_TRACEABILITY.md.
```

## Scope and Inputs

- Target: `SOURCES.md`, `app/data/se-*.toml`, `REPORT_TRACEABILITY.md`
- Primary References: HMRC GOV.UK pages listed in `SOURCES.md`
- Domain: UK self-employment tax rates and thresholds

## Goals

1. **Update SOURCES.md**: Add or update links to HMRC pages for the latest available tax year. HMRC typically publishes rates for the upcoming year in the Spring Budget (March) or Autumn Statement (November).
2. **Create new TOML files**: For any tax year where HMRC has published rates but no `app/data/se-{start_year}-{end_year}.toml` exists, create one following the established naming convention and schema.
3. **Update REPORT_TRACEABILITY.md**: Add rows to the traceability tables for any new tax years, documenting the values and their sources.
4. **Commit on a new branch**: Commit all changes on a branch named `copilot/tax-data-{tax-year-label}` (e.g. `copilot/tax-data-2026-27`).

## Process

1. **Read existing data**: Read `SOURCES.md` to understand the reference URLs. Read the most recent `app/data/se-*.toml` file to understand the schema and current coverage.

2. **Research HMRC rates**: Visit the GOV.UK pages listed in `SOURCES.md` to find the latest published rates. Key pages:
   - https://www.gov.uk/income-tax-rates — Personal allowance, basic/higher rate bands
   - https://www.gov.uk/self-employed-national-insurance-rates — Class 2 and Class 4 NI
   - https://www.gov.uk/capital-allowances/annual-investment-allowance — AIA
   - https://www.gov.uk/expenses-and-benefits-business-travel-mileage/rules-for-tax — Mileage rates
   - https://www.gov.uk/vat-registration/when-to-register — VAT threshold
   - https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2025-to-2026 — NI thresholds (update URL year as needed)

3. **Identify gaps**: Compare published rates against existing TOML files. If HMRC has published rates for a tax year not yet in `app/data/`, that year needs a new file.

4. **Create TOML files**: Use this exact schema (copy from the most recent file and update values):
   ```toml
   # UK self-employment tax rates and thresholds for the {label} tax year
   # Period: 6 April {start_year} – 5 April {end_year}
   # Source: HMRC

   [tax_year]
   label = "{start_yy}-{end_yy}"
   next_label = "{end_yy}-{next_yy}"
   start = {start_year}-04-06
   end = {end_year}-04-05

   [income_tax]
   personal_allowance = ...
   starting_rate = 0.00
   basic_rate = 0.20
   higher_rate = 0.40
   starter_band_end = 0
   basic_band_end = ...
   higher_band_start = ...

   [national_insurance]
   class2_rate = ...
   class4_lower_rate = ...
   class4_lower_limit = ...
   class4_upper_rate = ...
   class4_upper_limit = ...

   [capital_allowances]
   annual_investment_allowance = 1.00
   writing_down_allowance = 0.18
   motor_vehicle_cost_threshold = 12000
   motor_vehicle_restriction = 3000

   [depreciation]
   land_and_property = 0.00
   plant_and_machinery = 0.10
   fixtures_and_fittings = 0.20
   computer_equipment = 0.33
   motor_vehicles = 0.25

   [mileage]
   higher_rate_limit = 10000
   higher_rate_pence = 0.45
   lower_rate_start = 10001
   lower_rate_pence = 0.25

   [vat]
   registration_threshold = ...
   ```

   File naming convention: `se-{start_year}-{end_year}.toml` (e.g. `se-2026-2027.toml`)

5. **Update SOURCES.md**: Add any new HMRC reference URLs discovered. Update the "rates and thresholds for employers" URL to include the latest year.

6. **Update REPORT_TRACEABILITY.md**: Add new rows to each category table for the new tax year(s). Add entries to the "Year-on-Year Change Summary" table showing what changed.

7. **Verify**: Run `npm test` to ensure existing tests still pass and the new TOML files parse correctly.

8. **Commit**: Create a new branch and commit all changes:
   ```
   git checkout -b copilot/tax-data-{latest-tax-year-label}
   git add SOURCES.md REPORT_TRACEABILITY.md app/data/
   git commit -m "Add tax data for {tax year label}

   - Created app/data/se-{start}-{end}.toml with HMRC published rates
   - Updated SOURCES.md with current reference links
   - Updated REPORT_TRACEABILITY.md with new year traceability"
   ```

## Important Notes

- **Only create files for years where HMRC has published official rates.** Do not guess or extrapolate.
- **Depreciation rates and mileage rates rarely change.** If HMRC hasn't announced a change, carry forward the previous year's values.
- **NI rates have changed frequently** (2022-23 Health & Social Care Levy, 2024-25 Class 4 cut to 6%, Class 2 made voluntary). Always verify these carefully.
- **VAT threshold** changed from £85,000 to £90,000 in April 2024. Check for further changes.
- **Capital allowances** — AIA monetary limit (£1,000,000) is not stored in the TOML; only the percentage (1.00 = 100%) is stored.

## Verification

After making changes, run:
```
npm test
```
All tests should pass. The existing test suite validates TOML parsing and schema structure.

## Success Criteria

- `SOURCES.md` contains current, working HMRC reference URLs
- `app/data/` has TOML files covering all tax years for which HMRC has published rates
- `REPORT_TRACEABILITY.md` documents every value with its source
- `npm test` passes
- Changes are committed on a new branch ready for PR review
