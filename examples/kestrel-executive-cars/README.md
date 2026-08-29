# Kestrel Executive Cars -- Example Accounts

## Business Description

Kestrel Executive Cars is a fictional UK sole trader running executive chauffeur and airport transfer work out of a rented yard in Slough. The owner drives one car and employs three drivers on the other three. Corporate accounts settle weekly, so the takings reach the books as one banking each Friday rather than as daily fares. The business is VAT registered and the figures below are net of VAT -- the Taxi Driver workbook carries no VAT analysis. Accounts run from 6 April 2025 to 5 April 2026.

The point of this example is the size of the profit. At 144,878 it clears the 100,000 personal allowance taper and the 125,140 additional rate threshold, which no other Taxi Driver example reaches.

## Data Files

- **book.toml** -- Business metadata, chart of accounts (1 sales, 13 purchase accounts), and tax rates for FY2025/26. Conforms to `diya-gl-book-v1.schema.json`.
- **lines.jsonl** -- 155 transaction entries in JSON Lines format. Conforms to `diya-gl-lines-v1.schema.json`.

| Journal | Entries | Description |
|---------|--------:|-------------|
| sales | 52 | Weekly settlements banked each Friday |
| purchases | 103 | Fuel, insurance, servicing, yard rent, dispatch software, finance, wages and one camera system |

## Total Sales

| Item | Amount |
|------|-------:|
| Weekly settlements (52 Fridays) | 269,200 |
| **Total Sales** | **269,200** |

Settlements cycle through thirteen amounts between 4,700 and 5,700.

## Total Purchases by Category

| Code | Category | Entries | Total |
|------|----------|--------:|------:|
| e | Employee costs | 12 | 55,200 |
| d | Fuel | 12 | 31,400 |
| t | Road tax and insurance | 12 | 12,600 |
| r | Repairs and maintenance | 12 | 8,300 |
| p | Premises costs | 12 | 5,400 |
| g | General admin | 12 | 3,600 |
| i | Interest | 12 | 3,120 |
| l | Legal and professional | 2 | 2,100 |
| a | Advertising | 2 | 1,000 |
| o | Other expenses | 2 | 900 |
| f | Fixed assets (camera system) | 1 | 900 |
| b | Bank charges | 12 | 540 |
| | **Total Purchases** | **103** | **125,060** |

### Purchase Details

**Employee costs (code e)** -- Three employed drivers, 4,600 a month.

**Fuel (code d)** -- One fuel card settlement a month, 2,500 to 2,720.

**Road tax and insurance (code t)** -- Fleet insurance by monthly instalment, 1,050.

**Repairs and maintenance (code r)** -- Servicing, tyres and valeting, 650 to 740 a month.

**Premises costs (code p)** -- Yard and office rent, 450 a month.

**General admin (code g)** -- Dispatch software and mobile plans, 300 a month.

**Interest (code i)** -- Hire purchase interest on the vehicles, 260 a month.

**Legal and professional (code l)** -- Operator licence renewal 1,200 (Apr) and annual accounts preparation 900 (Jan).

**Advertising (code a)** -- Vehicle livery 600 (Jun) and airport terminal advertising 400 (Nov).

**Other expenses (code o)** -- Yard security gate 500 (Sep) and a waste contract 400 (Feb).

**Fixed assets (code f)** -- In-car camera system 900 (May).

**Bank charges (code b)** -- Business account charges, 45 a month.

## Profit

| Item | Amount |
|------|-------:|
| Turnover | 269,200 |
| Less: fuel, repairs, road tax and insurance | -52,300 |
| Less: writing down allowance on the camera system (900 at 18%) | -162 |
| **Gross profit** | **216,738** |
| Less: general expenses | -71,860 |
| **Net profit** | **144,878** |

## Expected Tax Calculation

The profit runs past the taper and into the additional rate, so the personal allowance is nil.

| Item | Amount |
|------|-------:|
| Profit for tax (SA103S box 31) | 144,140 |
| Personal allowance (12,570 less half of 44,140 over the 100,000 threshold) | 0 |
| Taxable income | 144,140 |
| Income tax at 20% on the first 37,700 | 7,540.00 |
| Income tax at 40% from 37,700 to 125,140 | 34,976.00 |
| Income tax at 45% above 125,140 | 8,550.00 |
| **Income tax** | **51,066.00** |
| NI Class 4 at 6% between 12,570 and 50,270 | 2,262.00 |
| NI Class 4 at 2% above 50,270 | 1,877.40 |
| **Total tax + NI** | **55,205.40** |

## Scenario Extract

The taxi scenario TOML fixture (`app/test/fixtures/taxi-scenario-kestrel.toml`) is derived from this master data for use in reconciliation testing. It uses the Taxi Driver product format with `[[sales.month]]` entries containing `date` and `amount` fields, and `[[purchases.month]]` entries containing `date`, `supplier`, `code`, and `amount` fields.
