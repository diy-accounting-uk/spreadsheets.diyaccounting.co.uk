# Kestrel Executive Cars -- Example Accounts

## Business Description

Kestrel Executive Cars is a fictional UK sole trader running executive chauffeur and airport transfer work out of a rented yard in Slough. The owner drives one car and employs three drivers on the other three. Corporate accounts settle weekly, so the takings reach the books as one banking each Friday rather than as daily fares. The business is VAT registered and the figures below are net of VAT -- the Taxi Driver workbook carries no VAT analysis. Accounts run from 6 April 2025 to 5 April 2026.

The point of this example is the size of the profit. At 145,178 it clears the 100,000 personal allowance taper and the 125,140 additional rate threshold, which no other Taxi Driver example reaches. Two weeks also carry a second driver's vehicle rental and one week an advertising panel fee, so the package's rental and other-income rows are not bare on every fixture.

## Data Files

- **book.toml** -- Business metadata and address, chart of accounts (2 sales, 13 purchase accounts), tax rates for FY2025/26, and the camera system on the fixed asset register. Conforms to `diya-gl-book-v2.schema.json`.
- **lines.jsonl** -- 158 transaction entries in JSON Lines format. Conforms to `diya-gl-lines-v2.schema.json`.

| Journal | Entries | Description |
|---------|--------:|-------------|
| sales | 55 | Weekly settlements banked each Friday, plus two weekly vehicle rentals and one advertising panel fee |
| purchases | 103 | Fuel, insurance, servicing, yard rent, dispatch software, finance, wages and one camera system |

## Total Sales

| Item | Amount |
|------|-------:|
| Weekly settlements (52 Fridays) | 269,200 |
| Weekly vehicle rental from the second driver (13 and 20 June 2025) | 300 |
| **Total Sales** | **269,500** |

Settlements cycle through thirteen amounts between 4,700 and 5,700. The two
rentals post to account 4000 and carry the "Rental due" caption, so the
package still counts them as takings, on their own week's rental row rather
than a fare day.

Other business income: an advertising panel fee of 80 on 14 November 2025.
It carries the "Any other income" caption and posts to account 4001, so it
never joins turnover -- the Profit & Loss account keeps it on its own row
(box 29 of the tax return) and the fixture states it separately as
`total_other_income`.

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

**Fixed assets (code f)** -- In-car camera system 900 (May). It is on
`fixedAssets[]` as well, so the fixture registers it on the Fixed Assets
schedule. That does not change the profit: the Taxi Driver package allows the
main rate writing down allowance on the year's capital spend whichever way the
asset is recorded, which is the right treatment for a vehicle and the one the
profit below is struck after.

**Bank charges (code b)** -- Business account charges, 45 a month.

## Profit

| Item | Amount |
|------|-------:|
| Turnover | 269,500 |
| Less: fuel, repairs, road tax and insurance | -52,300 |
| Less: writing down allowance on the camera system (900 at 18%) | -162 |
| **Gross profit** | **217,038** |
| Less: general expenses | -71,860 |
| **Net profit** | **145,178** |

The 80 advertising panel fee sits outside this table -- it reaches the tax
computation through its own row, not through net profit.

The allowance is a writing down allowance at the year's own main rate, so
this profit belongs to a 2025-26 package. A later year's 14% rate publishes
217,074 and 145,214 from the same book, which is why the fixture states the
turnover and leaves the profit to the package.

## Expected Tax Calculation

The profit runs past the taper and into the additional rate, so the personal allowance is nil.

| Item | Amount |
|------|-------:|
| Profit for tax (SA103S box 30) | 144,520 |
| Personal allowance (12,570 less half of 44,520 over the 100,000 threshold) | 0 |
| Taxable income | 144,520 |
| Income tax at 20% on the first 37,700 | 7,540.00 |
| Income tax at 40% from 37,700 to 125,140 | 34,976.00 |
| Income tax at 45% above 125,140 | 8,721.00 |
| **Income tax** | **51,237.00** |
| NI Class 4 at 6% between 12,570 and 50,270 | 2,262.00 |
| NI Class 4 at 2% above 50,270 | 1,885.00 |
| **Total tax + NI** | **55,384.00** |

## Scenario Extract

`node app/bin/extract-scenarios.js` writes the fixture
(`app/test/fixtures/taxi-scenario-kestrel.toml`) and the diya-gl subset
(`taxi/`) from this master data. Nothing in either is stated by hand.
