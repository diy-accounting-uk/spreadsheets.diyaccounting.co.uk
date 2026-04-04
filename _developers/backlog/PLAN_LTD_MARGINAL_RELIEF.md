# PLAN: Corporation Tax Marginal Relief Support

## Background

Since April 2023, UK Corporation Tax has a two-tier rate structure:

| Profit band | Rate |
|-------------|------|
| Up to £50,000 | 19% (small profits rate) |
| £50,001–£250,000 | Marginal relief (effective rate between 19% and 25%) |
| Over £250,000 | 25% (main rate) |

The marginal relief fraction is 3/200. The formula is:

```
CT = profit × 25% − (upper_limit − profit) × (3/200)
```

Thresholds are divided by (1 + number of associated companies).

## Current State

The Ltd Company spreadsheet (Financialaccounts.xlsx CorporationTax sheet) calculates CT as:

```
CT = profit × Admin!P6 / 100
```

Where P6 is a single rate cell (currently 19 = small profits rate). There is no marginal relief calculation in the spreadsheet.

The generated packages are annotated as supporting **small profits rate only** (profits up to £50,000).

## TODO

- [ ] Add marginal relief formula to the CorporationTax sheet in the template
- [ ] Add upper/lower limit cells to the Admin sheet
- [ ] Add associated companies count cell
- [ ] Map new Admin cells to `ltd-*.toml` fields (`corporation_tax.small_profits_limit`, `main_rate_limit`, `marginal_relief_fraction`)
- [ ] Update `buildLtdCellEdits()` to write the new cells
- [ ] Update compliance checks to verify marginal relief calculation
- [ ] Test with scenarios at different profit levels: under £50k, between £50k–£250k, over £250k

## Reference

- HMRC marginal relief calculator: https://www.tax.service.gov.uk/marginal-relief-calculator
- HMRC guidance: https://www.gov.uk/guidance/corporation-tax-marginal-relief
- Appendix B (MRR validation): `_developers/hmrc-references/ct600-xml-samples/Appendix-B-CT-MRR-v9.0a.odt`
- `app/data/ltd-*.toml` already has the fields: `main_rate`, `small_profits_rate`, `small_profits_limit`, `main_rate_limit`, `marginal_relief_fraction`
