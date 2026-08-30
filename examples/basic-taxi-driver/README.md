# Basic Taxi Driver -- Example Accounts

## Business Description

Basic Taxi Driver is a fictional UK sole trader working as an owner-driver on
private hire and street fares out of Derby. The driver owns the car outright,
so nothing is spent on car hire or rental, and buys a replacement vehicle for
8,000 in June. The business is not VAT registered, keeps its books on the cash
basis, and its year runs from 6 April 2025 to 5 April 2026.

The point of this example is how plain it is. Steady daily fares, five running
costs and one capital purchase: it is the smallest book the Taxi Driver package
has to publish a return from.

## Data Files

- **book.toml** -- Business metadata, chart of accounts (1 sales, 13 purchase accounts), and tax rates for FY2025/26. Conforms to `diya-gl-book-v2.schema.json`.
- **lines.jsonl** -- 201 transaction entries in JSON Lines format. Conforms to `diya-gl-lines-v2.schema.json`.

| Journal | Entries | Description |
|---------|--------:|-------------|
| sales | 180 | Daily fares, 15 working days a month |
| purchases | 21 | Fuel, road tax and insurance, mobile, licence, accountant and the vehicle |

## Total Sales

| Item | Amount |
|------|-------:|
| Daily fares (180 working days) | 36,000 |
| **Total Sales** | **36,000** |

Fares run at 180 to 220 a day, averaging 3,000 a month.

## Total Purchases by Category

| Code | Category | Entries | Total |
|------|----------|--------:|------:|
| f | Fixed assets (the vehicle) | 1 | 8,000 |
| d | Fuel | 12 | 3,600 |
| t | Road tax and insurance | 2 | 1,380 |
| l | Legal and professional | 2 | 900 |
| g | General admin | 4 | 480 |
| | **Total Purchases** | **21** | **14,360** |

**Fuel (code d)** -- 300 a month at Shell.

**Road tax and insurance (code t)** -- Vehicle excise duty 180 (Apr) and hire and reward insurance 1,200 (May).

**Legal and professional (code l)** -- Private hire licence 400 (Apr) and accountancy fees 500 (Jan).

**General admin (code g)** -- Mobile telephone, 120 a quarter.

**Fixed assets (code f)** -- The taxi vehicle, 8,000 (Jun). It is registered on
`fixedAssets[]` as well, which is what puts it on the Fixed Assets schedule and
earns it its allowance.

## Profit

| Item | Amount |
|------|-------:|
| Turnover | 36,000 |
| Less: fuel, road tax and insurance | -4,980 |
| Less: writing down allowance on the vehicle (8,000 at 18%) | -1,440 |
| **Gross profit** | **29,580** |
| Less: general expenses | -1,380 |
| **Net profit** | **28,200** |

A vehicle earns no Annual Investment Allowance, so the allowance is the main
rate writing down allowance and the profit moves with it: at the 14% rate a
later year carries, the same book publishes 29,900 and 28,520.

## Scenario Extract

`node app/bin/extract-scenarios.js` writes the Taxi Driver fixture
(`app/test/fixtures/taxi-scenario-basic.toml`) and the diya-gl subset
(`taxi/`) from this master data. Nothing in either is stated by hand.
