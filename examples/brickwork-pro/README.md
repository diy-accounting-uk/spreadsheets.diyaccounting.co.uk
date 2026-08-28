# BrickWork Pro -- Example Accounts

## Business Description

BrickWork Pro Ltd is a fictional small construction company (bricklaying, plastering, general building). CIS-registered, not VAT-registered (turnover below £90,000 threshold), company number 87654321.

FY 2025-04-01 to 2026-03-31. Director-owner Mike Brown (100% shares) plus one labourer Tom Davies.

## Data Files

- **book.toml** -- Business metadata, chart of accounts, tax rates, 1 director, 2 employees
- **lines.jsonl** -- 106 entries (24 sales, 58 purchases, 24 payroll)

## Key Figures

Every figure below is net of VAT. The non-VAT scenario carries them as they
stand; the VAT-registered one carries the same trade at VAT-inclusive amounts,
a fifth higher, and the books take the VAT back off.

| Metric | Amount |
|--------|-------:|
| Total Sales (building work) | 75,000 |
| Materials | 15,000 |
| Sub-contractors | 20,000 |
| Motor expenses | 2,400 |
| Insurance | 1,200 |
| Legal/professional | 1,000 |
| Telephone, advertising, repairs | 1,370 |
| Van purchase (fixed asset) | 12,000 |
| Annual payroll (2 staff) | 30,576 |

## Scenario Variants

| Variant | VAT | Use Case |
|---------|:---:|----------|
| non-vat | No | Amounts are face value. The rate cell on the first Sales month is set to 0, so the books charge no VAT and the return boxes are nil. |
| vat-reg | Yes | The same trade at amounts including VAT at 20%. Output VAT 15,000, input VAT 10,594. |

Both variants report the same trade, so both reach the same profit before tax.

The company runs a director's salary and one labourer's wage through the
payroll and claims the Employment Allowance, which covers the whole of its
employer's National Insurance. Its profit before tax is a little over
£1,700, and the van's annual investment allowance leaves nothing chargeable
to corporation tax. The sole trader adaptations carry the labourer's wage
alone -- a sole trader is not his own employee -- so they report a larger
profit on the same turnover.
