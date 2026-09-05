# HMRC source files

## sa103f_mapping_v3.csv

HMRC's own SA103-to-MTD-API box mapping, copied verbatim. Never hand-edit this file —
re-fetch it from the URL below if it needs to change.

- URL: https://raw.githubusercontent.com/hmrc/income-tax-mtd-changelog/main/mapping/csv/sa103f_mapping_v3.csv
- Published from: https://github.com/hmrc/income-tax-mtd-changelog/blob/main/mapping/mapping-csv-files.md
- Retrieved: 2026-09-04
- SHA-256: `2c08de788bd9ce5405b50625e00510824477c5f16965aaac46c738861a0f5815`

`sa103-mtd-mapping.json` in this directory is built from this CSV plus the `SE Full` and
`SE Short` `CELL_MAP` cell references in `app/products/se.js` (read, not edited).
