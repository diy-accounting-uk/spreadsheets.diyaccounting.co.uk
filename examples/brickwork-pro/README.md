# BrickWork Pro -- Example Accounts

## Business Description

BrickWork Pro Ltd is a fictional small construction company (bricklaying, plastering, general building). CIS-registered, not VAT-registered (turnover below £90,000 threshold), company number 87654321.

FY 2025-04-01 to 2026-03-31. Director-owner Mike Brown (100% shares) plus one labourer Tom Davies.

## Data Files

- **book.toml** -- Business metadata, chart of accounts, tax rates, 1 director, 2 employees
- **lines.jsonl** -- 106 entries (24 sales, 58 purchases, 24 payroll)

## Key Figures

| Metric | Amount |
|--------|-------:|
| Total Sales (building work) | 75,000 |
| Materials | 15,000 |
| Sub-contractors (with CIS) | 20,000 |
| CIS deductions withheld | 4,000 |
| Motor expenses | 2,400 |
| Insurance | 1,200 |
| Legal/professional | 1,000 |
| Van purchase (fixed asset) | 12,000 |
| Annual payroll (2 staff) | 30,576 |
| Estimated profit | ~14,000 |

## Scenario Variants

| Variant | VAT | Use Case |
|---------|:---:|----------|
| non-vat | No | Amounts are face value, no VAT split. Tests non-VAT code path in SE and Ltd. |
| vat-reg | Yes | Amounts treated as VAT-inclusive. Tests standard VAT-registered path. |

Both variants produce the same pre-tax profit (~£14,000), within the small profits CT rate.
