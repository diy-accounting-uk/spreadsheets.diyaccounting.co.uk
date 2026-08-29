# PLAN: Corporation Tax marginal relief — what is still open

The working sheet charges marginal relief. `Admin!P8`, `P9`, `P12` and `P13` carry the main
rate, the relief fraction and the two limits from `app/data/ltd-*.toml`; `CorporationTax`
rows 33 and 34 apportion the limits across the financial years the accounting period falls
in and take the relief off each row's gross tax; the CT600 files the gross tax in box 63,
the relief in box 64 and the charge in box 65. Three things the sheet has no input for yet:

- **Associated companies.** The limits are divided by one plus the number of associated
  companies. There is no cell for the count, and the CT600's own boxes 38 and 41 carry no
  formula. A `P14` count, a `/(1+Admin!$P$14)` divisor on both apportioned limits and the two
  form boxes would close it.
- **Franked investment income.** Relief is strictly `(U - A) x N/A x F`, where A is augmented
  profits and N taxable total profits. With no input for franked investment income, A = N and
  the ratio is 1.
- **A period straddling a rate change.** One `ltd-<FY>.toml` feeds both tax rows, and the run
  checks that both carry the same small profits rate. Every financial year from 2020 on
  carries the same rates as the one after it, so nothing in the current data set needs two.

## Reference

- HMRC marginal relief calculator: https://www.tax.service.gov.uk/marginal-relief-calculator
- HMRC guidance: https://www.gov.uk/guidance/corporation-tax-marginal-relief
- Appendix B (MRR validation): `_developers/hmrc-references/ct600-xml-samples/Appendix-B-CT-MRR-v9.0a.odt`
