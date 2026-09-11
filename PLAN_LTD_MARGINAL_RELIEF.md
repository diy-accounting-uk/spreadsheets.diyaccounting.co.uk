<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# PLAN: Corporation Tax marginal relief

The working sheet charges marginal relief financial year by financial year. Admin rows 6 and 7
are the two years the accounting period falls in, and each carries every figure its year charges
by: `P` the small profits rate, `R` the main rate, `S` the relief fraction, `T` and `U` the two
limits, all injected from `app/data/ltd-<FY>.toml` and from that file's
`corporation_tax_previous_financial_year` table for a row reaching back over 1 April. `P14` is
the associated companies count both limits are divided by. `CorporationTax!K29` takes the exempt
distributions received and `K30` the augmented profits the limits are tested against. Rows 33 and
34 apportion their own year's limits across the days they charge and take the relief off each
row's gross tax. On the CT600 sheet, box 38 is the distributions, boxes 40 and 41 the associated
companies counts, and the version 3 numbering files them as boxes 620, 327 and 328.

Every Company package needs regenerating against the widened rate table. The eleven with a year
end from 30 April 2023 to 29 February 2024 change the tax they charge: they straddle the FY2022
to FY2023 change from 19% flat with no relief to 25% with relief between 50,000 and 250,000.

## Reference

- HMRC marginal relief calculator: https://www.tax.service.gov.uk/marginal-relief-calculator
- HMRC guidance: https://www.gov.uk/guidance/corporation-tax-marginal-relief
- Appendix B (MRR validation): `_developers/hmrc-references/ct600-xml-samples/Appendix-B-CT-MRR-v9.0a.odt`
