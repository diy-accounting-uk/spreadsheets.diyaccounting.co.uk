# Tax Data Traceability Report

Traces every value in `app/data/se-*.toml` back to its authoritative HMRC source (see [SOURCES.md](SOURCES.md) for reference URLs).

Data was extracted from the existing manually-created spreadsheets in `packages/GB Accounts Basic Sole Trader */` and cross-referenced against HMRC published rates.

## Income Tax

Source: https://www.gov.uk/income-tax-rates

| Tax Year | Personal Allowance | Basic Rate | Basic Band End | Higher Rate | Higher Band Start | TOML File |
|----------|-------------------|-----------|---------------|-------------|------------------|-----------|
| 2020-21 | 12,500 | 20% | 37,500 | 40% | 37,501 | `se-2020-2021.toml` |
| 2021-22 | 12,570 | 20% | 37,700 | 40% | 37,701 | `se-2021-2022.toml` |
| 2022-23 | 12,570 | 20% | 37,700 | 40% | 37,701 | `se-2022-2023.toml` |
| 2023-24 | 12,570 | 20% | 37,700 | 40% | 37,701 | `se-2023-2024.toml` |
| 2024-25 | 12,570 | 20% | 37,700 | 40% | 37,701 | `se-2024-2025.toml` |
| 2025-26 | 12,570 | 20% | 37,700 | 40% | 37,701 | `se-2025-2026.toml` |

Notes:
- Personal allowance increased from £12,500 to £12,570 in 2021-22 and has been frozen since.
- Basic rate band increased from £37,500 to £37,700 in 2021-22 and has been frozen since.
- Starting rate (0%) and starter band end (0) are present in TOML but unused for England/Wales. These fields exist to support Scotland in future.

## National Insurance (Self-Employed)

Source: https://www.gov.uk/self-employed-national-insurance-rates

| Tax Year | Class 2 (£/wk) | Class 4 Lower Rate | Class 4 Lower Limit | Class 4 Upper Rate | Class 4 Upper Limit | TOML File |
|----------|---------------|-------------------|--------------------|--------------------|--------------------|-----------|
| 2020-21 | 3.05 | 9% | 9,500 | 2% | 50,000 | `se-2020-2021.toml` |
| 2021-22 | 3.05 | 9% | 9,568 | 2% | 50,270 | `se-2021-2022.toml` |
| 2022-23 | 3.15 | 9.73% | 11,908 | 2.73% | 50,270 | `se-2022-2023.toml` |
| 2023-24 | 3.45 | 9% | 12,570 | 2% | 50,270 | `se-2023-2024.toml` |
| 2024-25 | 0 | 6% | 12,570 | 2% | 50,270 | `se-2024-2025.toml` |
| 2025-26 | 0 | 6% | 12,570 | 2% | 50,270 | `se-2025-2026.toml` |

Notes:
- **2022-23**: The Health and Social Care Levy added 1.25% to NI from April 2022, reversed from November 2022. The spreadsheet uses blended annual rates of 9.73% and 2.73%. The Class 4 lower limit was raised mid-year from £9,880 to £12,570 (July 2022); the spreadsheet uses £11,908 as the blended annual threshold.
- **2024-25 onwards**: Class 2 NI became voluntary (rate set to 0 in TOML). Class 4 lower rate reduced from 9% to 6% (January 2024 Autumn Statement cut, effective from April 2024).
- Class 4 upper limit increased from £50,000 to £50,270 in 2021-22 and frozen since.

## Capital Allowances

Source: https://www.gov.uk/capital-allowances/annual-investment-allowance

| Tax Year | AIA | WDA Rate | Motor Vehicle Threshold | Motor Vehicle Restriction | TOML File |
|----------|-----|---------|----------------------|------------------------|-----------|
| 2020-21 | 100% | 18% | 12,000 | 3,000 | `se-2020-2021.toml` |
| 2021-22 | 100% | 18% | 12,000 | 3,000 | `se-2021-2022.toml` |
| 2022-23 | 100% | 18% | 12,000 | 3,000 | `se-2022-2023.toml` |
| 2023-24 | 100% | 18% | 12,000 | 3,000 | `se-2023-2024.toml` |
| 2024-25 | 100% | 18% | 12,000 | 3,000 | `se-2024-2025.toml` |
| 2025-26 | 100% | 18% | 12,000 | 3,000 | `se-2025-2026.toml` |

Notes:
- AIA is stored as 1.00 (100%) in TOML. The monetary limit (£1,000,000 since Jan 2019, made permanent April 2023) is not stored in the spreadsheet — the AIA cell represents the percentage rate applied.
- WDA main pool rate has been 18% since April 2012.
- Motor vehicle cost threshold (£12,000) and restriction (£3,000) are specific to the spreadsheet's simplified treatment of expensive cars. HMRC's actual threshold for special rate pool cars is based on CO2 emissions since April 2021.

## Mileage Allowances

Source: https://www.gov.uk/expenses-and-benefits-business-travel-mileage/rules-for-tax

| Tax Year | First 10,000 miles | Over 10,000 miles | TOML File |
|----------|-------------------|------------------|-----------|
| 2020-21 | 45p | 25p | `se-2020-2021.toml` |
| 2021-22 | 45p | 25p | `se-2021-2022.toml` |
| 2022-23 | 45p | 25p | `se-2022-2023.toml` |
| 2023-24 | 45p | 25p | `se-2023-2024.toml` |
| 2024-25 | 45p | 25p | `se-2024-2025.toml` |
| 2025-26 | 45p | 25p | `se-2025-2026.toml` |

Notes:
- HMRC approved mileage rates have not changed since 2011-12.

## VAT

Source: https://www.gov.uk/vat-registration/when-to-register

| Tax Year | Registration Threshold | TOML File |
|----------|----------------------|-----------|
| 2020-21 | 85,000 | `se-2020-2021.toml` |
| 2021-22 | 85,000 | `se-2021-2022.toml` |
| 2022-23 | 85,000 | `se-2022-2023.toml` |
| 2023-24 | 85,000 | `se-2023-2024.toml` |
| 2024-25 | 90,000 | `se-2024-2025.toml` |
| 2025-26 | 90,000 | `se-2025-2026.toml` |

Notes:
- VAT registration threshold was frozen at £85,000 from April 2017 to March 2024.
- Increased to £90,000 from 1 April 2024 (Spring Budget 2024).

## Depreciation Rates

These are conventional accounting rates, not HMRC-mandated. Consistent across all years:

| Asset Class | Rate | Basis |
|-------------|------|-------|
| Land & Property | 0% | Not depreciated |
| Plant & Machinery | 10% | Reducing balance |
| Fixtures & Fittings | 20% | Reducing balance |
| Computer Equipment | 33% | Reducing balance (~3 year life) |
| Motor Vehicles | 25% | Reducing balance |

## Year-on-Year Change Summary

| Field | 2020-21 → 2021-22 | 2021-22 → 2022-23 | 2022-23 → 2023-24 | 2023-24 → 2024-25 | 2024-25 → 2025-26 |
|-------|-------------------|-------------------|-------------------|-------------------|-------------------|
| Personal Allowance | 12,500 → 12,570 | — | — | — | — |
| Basic Band End | 37,500 → 37,700 | — | — | — | — |
| Class 2 NI | — | 3.05 → 3.15 | 3.15 → 3.45 | 3.45 → 0 | — |
| Class 4 Lower Rate | — | 9% → 9.73% | 9.73% → 9% | 9% → 6% | — |
| Class 4 Lower Limit | 9,500 → 9,568 | 9,568 → 11,908 | 11,908 → 12,570 | — | — |
| Class 4 Upper Limit | 50,000 → 50,270 | — | — | — | — |
| VAT Threshold | — | — | — | 85,000 → 90,000 | — |

"—" indicates no change.

## Anomalies Found in Original Spreadsheets

| Year | Cell | Spreadsheet Value | Expected | Issue |
|------|------|------------------|----------|-------|
| 2020-21 | B24 (next_label) | "2020-21" | "2021-22" | Copy error — next year label same as current |
| 2024-25 | B2 (Feb date) | 2024-02-28 | 2024-02-29 | 2024 is a leap year — Feb has 29 days |
| 2025-26 | B21 (payment date) | 2026-01-31 | 2027-01-31 | Not updated when cloning from previous year |
| 2025-26 | B22 (payment date) | 2026-07-31 | 2027-07-31 | Same copy error as B21 |
| 2024-25 | SE Short!G1 | "31ST JANUARY 2024" | "31ST JANUARY 2026" | Deadline year not updated |

All anomalies are corrected by the generator.
