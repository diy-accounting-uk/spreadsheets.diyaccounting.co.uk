# BrickWork Pro -- Example Accounts

## Business Description

BrickWork Pro Ltd is a fictional small construction company (bricklaying, plastering, general building). CIS-registered, not VAT-registered (turnover below £90,000 threshold), company number 87654321.

FY 2025-04-01 to 2026-03-31. Director-owner Mike Brown (100% shares) plus one labourer Tom Davies.

## Data Files

- **book.toml** -- Business metadata, chart of accounts, tax rates, 1 director, 2 employees
- **lines.jsonl** -- 106 entries (24 sales, 58 purchases, 24 payroll)

## Key Figures

The non-VAT scenario is the business as described above. The VAT-registered
scenario is the same firm trading half as much again, which puts it over the
registration threshold; its journal amounts then carry VAT at 20% on top.

| Metric (net of VAT) | non-VAT | VAT registered |
|---------------------|--------:|---------------:|
| Total Sales (building work) | 75,000 | 112,500 |
| Materials | 15,000 | 22,500 |
| Sub-contractors | 20,000 | 30,000 |
| Motor expenses | 2,400 | 3,600 |
| Insurance | 1,200 | 1,800 |
| Legal/professional | 1,000 | 1,500 |
| Telephone, advertising, repairs | 1,370 | 2,055 |
| Van purchase (fixed asset) | 12,000 | 12,000 |
| Annual payroll (2 staff) | 30,576 | 30,576 |

## Scenario Variants

| Variant | VAT | Use Case |
|---------|:---:|----------|
| non-vat | No | Under the registration threshold. The rate cell on the first Sales month is set to 0, so the books charge no VAT and the return boxes are nil. |
| vat-reg | Yes | Over the threshold, journal amounts including VAT at 20%. Output VAT 22,500, input VAT 14,691. |

The van is the same vehicle in both, so it carries the VAT but not the change
in size.

The company runs a director's salary and one labourer's wage through the
payroll and claims the Employment Allowance, which covers the whole of its
employer's National Insurance. The sole trader adaptations carry the
labourer's wage alone -- a sole trader is not his own employee -- so they
report a larger profit on the same turnover.
