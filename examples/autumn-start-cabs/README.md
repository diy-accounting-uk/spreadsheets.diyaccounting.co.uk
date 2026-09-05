# Autumn Start Cabs -- Example Accounts

## Business Description

Autumn Start Cabs is a fictional UK sole trader working as an owner-driver on
private hire out of Lincoln. The driver takes his first fare on Monday 6
October 2025 and his last on Friday 27 March 2026, so half the tax year is
already gone before the business opens. He drives a car he already owned, buys
nothing capital, is not VAT registered, keeps his books on the cash basis, and
his year runs from 6 April 2025 to 5 April 2026.

The point of this example is the part-traded year. Six of the twelve month tabs
carry takings and six are empty, which is the only way to reach the Wages
Forecast's spread: the forecast repeats each month that traded and gives every
month that did not a share of the year, so a six-month book forecasts roughly
twice what it earned.

## Data Files

- **book.toml** -- Business metadata, chart of accounts (2 sales, 13 purchase accounts), and tax rates for FY2025/26. Conforms to `diya-gl-book-v2.schema.json`.
- **lines.jsonl** -- 134 transaction entries in JSON Lines format. Conforms to `diya-gl-lines-v2.schema.json`.

| Journal | Entries | Description |
|---------|--------:|-------------|
| sales | 126 | Fares five days a week from 6 October to 27 March, plus a start-up grant on 15 October |
| purchases | 8 | Insurance, licence and six monthly fuel bills |

## Total Sales

| Item | Amount |
|------|-------:|
| Daily fares (125 working days) | 22,000 |
| **Total Sales** | **22,000** |

Fares run to a weekly pattern -- 150 on Monday up to 220 on Friday, 880 a week
across 25 trading weeks.

The takings reach the month tabs the weeks end in, not their calendar months:
2,640 in October (three weeks), 4,400 in November, 3,520 in December, January
and February each, and 4,400 in March.

Other business income: a start-up grant of 500 on 15 October 2025. It posts to
account 4001, so it never joins turnover -- the Profit & Loss account keeps it
on its own row (box 29 of the tax return) and the fixture states it separately
as `total_other_income`.

## Total Purchases by Category

| Code | Category | Entries | Total |
|------|----------|--------:|------:|
| d | Fuel | 6 | 1,560 |
| t | Road tax and insurance | 1 | 1,200 |
| l | Legal and professional | 1 | 400 |
| | **Total Purchases** | **8** | **3,160** |

**Fuel (code d)** -- 260 a month at Shell, from October.

**Road tax and insurance (code t)** -- Hire and reward insurance, 1,200, taken out on the first trading day.

**Legal and professional (code l)** -- Private hire licence, 400, on the same day.

No vehicle is bought, so the Fixed Assets schedule is empty and the year claims
no capital allowance.

## Profit

| Item | Amount |
|------|-------:|
| Turnover | 22,000 |
| Less: fuel, road tax and insurance | -2,760 |
| **Gross profit** | **19,240** |
| Less: general expenses | -400 |
| **Net profit** | **18,840** |

The 500 start-up grant sits outside this table -- it reaches the tax
computation through its own row, not through net profit.

## The Forecast

The Wages Forecast projects a full year from six months of trade. Each of the
six months that traded is repeated as it stands, and each of the six that did
not takes a sixth of the year's own figure, so the projected turnover is 44,000
and the projected cost of sales 5,520. General expenses come to 800 the same
way. Other income is the exception: the forecast reads each month straight
through, so the 500 grant is counted once, not twice. The projected profit is
38,180.

## Scenario Extract

`node app/bin/extract-scenarios.js` writes the Taxi Driver fixture
(`app/test/fixtures/taxi-scenario-autumn-start.toml`) and the diya-gl subset
(`taxi/`) from this master data. Nothing in either is stated by hand.
