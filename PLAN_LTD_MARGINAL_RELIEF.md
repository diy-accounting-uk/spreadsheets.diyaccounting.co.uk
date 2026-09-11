<!-- SPDX-License-Identifier: LicenseRef-PolyForm-Internal-Use-1.0.0 -->
<!-- Copyright (C) 2006-2026 DIY Accounting Limited -->
# PLAN: Corporation Tax marginal relief

The working sheet charges marginal relief. `Admin!P8`, `P9`, `P12` and `P13` carry the main
rate, the relief fraction and the two limits from `app/data/ltd-*.toml`; `P6` and `P7` carry a
small profits rate for each of the two financial year rows; `P14` the associated companies
count both limits are divided by. `CorporationTax!K29` takes the exempt distributions received
and `K30` the augmented profits the limits are tested against. Rows 33 and 34 apportion the
limits across the financial years the accounting period falls in and take the relief off each
row's gross tax. On the CT600 sheet, box 38 is the distributions, boxes 40 and 41 the
associated companies counts, and the version 3 numbering files them as boxes 620, 327 and 328.

## MR-5, a period straddling a change in the main rate, the relief fraction or the limits

The sheet carries one `P8`, one `P9` and one `P12`/`P13` pair for the whole period, so both
tax rows charge the year end's figures. FY2022 to FY2023 is such a change, 19% flat with no
relief against 25% with relief between 50,000 and 250,000, so a 2023 package with a year end
other than 31 March charges its FY2022 days at FY2023's rates today. The Jul23 Precision Code
package charges 243 days of FY2022 at 25%. Closing it needs a cell per financial year for each
of those four figures, the four row formulas reading them, the previous year's table in
`app/data/ltd-<FY>.toml` widened past the small profits rate it carries now, and every 2023
non-March package regenerated.

## Reference

- HMRC marginal relief calculator: https://www.tax.service.gov.uk/marginal-relief-calculator
- HMRC guidance: https://www.gov.uk/guidance/corporation-tax-marginal-relief
- Appendix B (MRR validation): `_developers/hmrc-references/ct600-xml-samples/Appendix-B-CT-MRR-v9.0a.odt`
