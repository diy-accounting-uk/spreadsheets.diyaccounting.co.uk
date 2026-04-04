# SP Sixty Driving -- Example Accounts

## Business Description

SP Sixty Driving is a fictional UK sole trader operating as a private hire and taxi driver. The business is NOT VAT registered (below the threshold), uses cash basis accounting, and the financial year runs from 6 April 2025 to 5 April 2026 (UK tax year).

The driver works 5 days per week (Monday to Friday) as a private hire driver, with revenue split approximately 70% from app-based platforms (Uber/Bolt) and 30% from direct bookings. The vehicle is a 2023 Toyota Prius (purchased for 22,000, 2 years old at the start of accounts). Daily mileage averages around 80-120 miles per day, totalling approximately 20,000 business miles per year.

## Data Files

- **book.toml** -- Business metadata, chart of accounts (1 sales, 13 purchase accounts), and tax rates for FY2025/26. Conforms to `diya-gl-book-v1.schema.json`.
- **lines.jsonl** -- 267 transaction entries in JSON Lines format. Conforms to `diya-gl-lines-v1.schema.json`.

| Journal | Entries | Description |
|---------|--------:|-------------|
| sales | 180 | Daily fare income with mileage (15 working days x 12 months) |
| purchases | 87 | Fuel, insurance, road tax, repairs, admin, licence, accountant, signage, dashcam |

## Total Sales

| Item | Amount |
|------|-------:|
| Daily fares (180 working days) | 38,000 |
| Other income | 0 |
| **Total Sales** | **38,000** |

Daily fares vary by day of week: Mondays average ~185, Tuesdays ~200, Wednesdays ~210, Thursdays ~220, Fridays ~240. Each entry includes measurableQuantity (daily miles driven, 70-127 range).

### Monthly Sales Breakdown

| Month | Fares | Miles |
|-------|------:|------:|
| Apr 2025 | 3,162 | 1,666 |
| May 2025 | 3,143 | 1,666 |
| Jun 2025 | 3,186 | 1,666 |
| Jul 2025 | 3,167 | 1,666 |
| Aug 2025 | 3,179 | 1,666 |
| Sep 2025 | 3,160 | 1,666 |
| Oct 2025 | 3,172 | 1,666 |
| Nov 2025 | 3,153 | 1,666 |
| Dec 2025 | 3,165 | 1,666 |
| Jan 2026 | 3,177 | 1,666 |
| Feb 2026 | 3,158 | 1,666 |
| Mar 2026 | 3,178 | 1,674 |
| **Total** | **38,000** | **20,000** |

## Total Purchases by Category

| Code | Category | Entries | Gross Total |
|------|----------|--------:|------------:|
| d | Fuel | 48 | 2,708 |
| t | Road tax and insurance | 2 | 1,580 |
| l | Legal and professional | 2 | 750 |
| r | Repairs and maintenance | 15 | 580 |
| g | General admin | 18 | 420 |
| f | Fixed assets (dashcam) | 1 | 200 |
| a | Advertising (car signage) | 1 | 150 |
| | **Total Purchases** | **87** | **6,388** |

### Purchase Details

**Fuel (code d)** -- 4 fill-ups per month at Shell, BP, and Texaco stations. Amounts range from 51 to 62 per fill. Annual total: 2,708.

**Road tax and insurance (code t)** -- Annual car insurance 1,400 (Admiral Insurance, direct debit) and road tax 180 (DVLA). Total: 1,580.

**Repairs and maintenance (code r)** -- Toyota interim service 170 (Jul), Toyota full service 175 (Jan), MOT 55 (Oct), monthly car wash 15 x 12 = 180. Total: 580.

**General admin (code g)** -- Vodafone mobile phone/data plan 30 x 12 = 360, plus 6 parking charges at 10 each = 60. Total: 420.

**Legal and professional (code l)** -- Council private hire licence renewal 400 (Apr), TaxAssist Accountants annual preparation 350 (Jan). Total: 750.

**Fixed assets (code f)** -- Nextbase dashcam 200 (May).

**Advertising (code a)** -- Vehicle door signage 150 (Jun, SignWorks).

## Mileage Summary

| Item | Miles |
|------|------:|
| Total business miles | 20,000 |
| First 10,000 at 45p/mile | 4,500 |
| Remaining 10,000 at 25p/mile | 2,500 |
| **Mileage allowance** | **7,000** |

## Vehicle Cost Comparison (Taxi Product Feature)

The Taxi Driver product compares actual vehicle running costs against HMRC mileage allowances and automatically selects the higher deduction.

| Method | Amount |
|--------|-------:|
| Actual vehicle costs (fuel 2,708 + insurance 1,400 + road tax 180 + repairs 580) | 4,868 |
| Mileage allowance (10,000 x 0.45 + 10,000 x 0.25) | 7,000 |
| **Selected (higher)** | **7,000 (mileage)** |

## Expected Tax Calculation (Approximate)

| Item | Amount |
|------|-------:|
| Total sales | 38,000 |
| Less: mileage allowance (vehicle costs) | -7,000 |
| Less: non-vehicle expenses (admin 420 + legal 750 + advertising 150 + dashcam 200) | -1,520 |
| **Net profit** | **~29,480** |
| Personal allowance | -12,570 |
| Taxable income | ~16,910 |
| Income tax at 20% | ~3,382 |
| NI Class 4 at 6% (on 12,570 to 29,480) | ~1,015 |
| **Total tax + NI** | **~4,397** |

Note: Exact figures depend on spreadsheet formula rounding and the mileage vs actual cost comparison outcome.

## Scenario Extract

The taxi scenario TOML fixture (`app/test/fixtures/taxi-scenario-sp-sixty.toml`) is derived from this master data for use in reconciliation testing. It uses the Taxi Driver product format with `[[sales.month]]` entries containing `date` and `amount` fields, and `[[purchases.month]]` entries containing `date`, `supplier`, `code`, and `amount` fields.
