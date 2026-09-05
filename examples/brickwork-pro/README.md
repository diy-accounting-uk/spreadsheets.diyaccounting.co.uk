# BrickWork Pro -- Example Accounts

## Business Description

BrickWork Pro Ltd is a fictional small construction company (bricklaying, plastering, general building). CIS-registered, not VAT-registered (turnover below £90,000 threshold), company number 87654321.

FY 2025-04-01 to 2026-03-31. Director-owner Mike Brown (100% shares) plus one labourer Tom Davies.

## Data Files

- **book.toml** -- Business metadata and address, chart of accounts, tax rates, the opening balance sheet, stock, the debtor and creditor ledgers, the van on the fixed asset register, 1 director, 1 member, 2 employees
- **lines.jsonl** -- 166 entries (25 sales, 58 purchases, 24 payroll, 52 bank, 7 opening journal)

The bank journal is the company's own statement: the balance brought forward,
a customer receipt and a supplier payment each month, the monthly net wages
and PAYE, three Construction Industry Scheme remittances and last year's
corporation tax. The sub-contractors are paid net of the tax withheld from
them, and February's deduction is still owed at the year end, which is what
leaves a CIS creditor on the closing balance sheet.

The business is on both sides of the scheme. May's invoice to Northgate
Contracts is sub-contract work of its own, so that contractor withholds 20%
of it and June's receipt settles the month net of the deduction. That
deduction is what the self-employment return takes off the tax bill at box 81
and what the company's own CIS bill is reduced by.

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
in size. There is one master: the registered twin is derived from it by a
declared build section in `app/bin/extract-scenarios.js`, which scales the
trade, adds the VAT, holds the capital purchase flat and settles the VAT
quarterly.

The company runs a director's salary and one labourer's wage through the
payroll and claims the Employment Allowance, which covers the whole of its
employer's National Insurance. The sole trader adaptations carry the
labourer's wage alone -- a sole trader is not his own employee -- so they
report a larger profit on the same turnover.

## Scenario Extract

`node app/bin/extract-scenarios.js` writes five fixtures and five diya-gl
subsets from this master data:

| Fixture | Subset | Adaptation |
|---------|--------|------------|
| `bst-brickwork-pro-nonvat` | `bst-nonvat/` | Sole trader, no bank journal, the labourer's wage bought in as an employee cost |
| `se-brickwork-pro-nonvat` | `se-nonvat/` | Sole trader with the bank and the payroll, the director's payslip replaced by monthly drawings |
| `se-brickwork-pro-vat` | `se-vat/` | The same, registered and trading half as much again |
| `ltd-brickwork-pro-nonvat` | `ltd-nonvat/` | The company as the master keeps it |
| `ltd-brickwork-pro-vat` | `ltd-vat/` | The company, registered and trading half as much again |

Nothing in any of them is stated by hand.
